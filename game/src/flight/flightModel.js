// The Tern's flight model: lift with stall, drag, thrust, gravity and wind on a rigid
// body; control authority that grows with airspeed and prop wash; float and wheel contact
// with water, runways and strips; touchdowns, bounces and crashes. Fixed steps, no three.js.

import {
  v3, add, sub, scale, dot, cross, len, norm, addScaled, rotate, quatMul, quatNormalize,
  quatFromHeadingPitchBank, headingPitchBank, FORWARD, UP, RIGHT, clamp, DEG,
} from '../util/vec3.js';
import { makeEngine, stepEngine } from '../systems/engine.js';
import { makeFuelTank, burnFuel, FUEL_KG_PER_L } from '../systems/fuelTank.js';
import { makeDamage, damageEffects, hurt } from '../systems/damageModel.js';
import { classifyContact, touchdownPlace, MS_TO_FPM, MS_TO_KT } from './landingJudge.js';

const G = 9.81;
const RHO = 1.225;
export const STEP = 1 / 60;

/**
 * New aircraft state. start: { x, y, z, hdg, pitch, bank, speed, onSurface, throttle,
 * fuel (0..1), flaps, engineOn, damage }.
 */
export function makeAircraft(spec, start) {
  const q = quatFromHeadingPitchBank(start.hdg ?? 0, start.pitch ?? 0, start.bank ?? 0);
  const f = rotate(q, FORWARD);
  const speed = start.speed ?? 0;
  return {
    spec,
    pos: v3(start.x, start.y, start.z),
    vel: scale(f, speed),
    q,
    pitchRate: 0, rollRate: 0, yawRate: 0,
    controls: { elevator: 0, aileron: 0, rudder: 0, throttle: start.throttle ?? 0.6, flaps: start.flaps ?? 0, brake: 0, trim: start.trim ?? 0 },
    engine: makeEngine(start.engineOn ?? true),
    fuel: makeFuelTank(spec, start.fuel ?? 1),
    damage: makeDamage(start.damage),
    payloadKg: start.payloadKg ?? 0,
    waterKg: 0,
    onSurface: !!start.onSurface,
    surfaceKind: null,
    runway: null,
    crashed: null,
    engineForcedOff: false,
    touch: null, // current landing being graded
    lastLanding: null, // finished landing record
    airborneTime: start.onSurface ? 0 : 10,
    t: 0,
    events: [],
    // read-outs refreshed every step
    ias: speed, gs: speed, vs: 0, alpha: 0, beta: 0, g: 1, agl: 0, stalled: false, stallWarn: false,
    hdg: start.hdg ?? 0, pitch: start.pitch ?? 0, bank: start.bank ?? 0, thrust: 0, mass: 0,
  };
}

export function massOf(ac) {
  return ac.spec.emptyMass + ac.spec.pilotMass + ac.fuel.litres * FUEL_KG_PER_L + ac.payloadKg + ac.waterKg;
}

function emit(ac, type, data = {}) {
  ac.events.push({ type, t: ac.t, ...data });
}

/**
 * Advance one fixed step. env: { wind: windField, surfaceAt(x,z), groundHeight(x,z),
 * placeName(x,z)? }. Controls are read from ac.controls (elevator/aileron/rudder -1..1).
 */
export function stepAircraft(ac, env, dt = STEP) {
  if (ac.crashed) return ac;
  const s = ac.spec;
  const c = ac.controls;
  const fx = damageEffects(ac.damage);
  ac.t += dt;

  const f = rotate(ac.q, FORWARD);
  const u = rotate(ac.q, UP);
  const r = rotate(ac.q, RIGHT);
  const wind = env.wind ? env.wind.at(ac.pos, ac.t) : v3();
  // On the surface the air near the water is slower and calmer.
  const w = ac.onSurface ? scale(v3(wind.x, 0, wind.z), 0.8) : wind;
  const air = sub(ac.vel, w);
  const V = len(air);
  const vf = dot(air, f);
  const vu = dot(air, u);
  const vr = dot(air, r);
  const alpha = V > 1 ? Math.atan2(-vu, Math.max(0.1, vf)) : 0;
  const beta = V > 1 ? Math.atan2(vr, Math.max(0.1, Math.abs(vf))) : 0;
  const qdyn = 0.5 * RHO * V * V;
  const mass = massOf(ac);

  // --- aerodynamic coefficients
  const flaps = c.flaps;
  const clMax = s.clMax + s.flapClMax * flaps - fx.clMaxLoss;
  const cl0 = s.cl0 + s.flapCl0 * flaps;
  const alphaStall = (clMax - cl0) / s.clAlpha;
  let cl = cl0 + s.clAlpha * alpha;
  let stalled = false;
  if (alpha > alphaStall) {
    stalled = true;
    cl = Math.max(clMax * 0.55, clMax - (alpha - alphaStall) * 3.2);
  } else if (alpha < -0.22) {
    cl = Math.min(cl, cl0 - s.clAlpha * 0.22);
  }
  const cd = s.cd0 + s.flapCd * flaps + fx.dragAdd + s.inducedK * cl * cl + (stalled ? 0.12 : 0) + Math.abs(beta) * 0.25;

  // --- forces (world frame)
  const airHat = V > 0.5 ? scale(air, 1 / V) : f;
  let force = v3(0, -mass * G, 0);
  if (V > 0.5) {
    const liftDir = norm(cross(r, airHat));
    force = addScaled(force, liftDir, qdyn * s.wingArea * cl);
    force = addScaled(force, airHat, -qdyn * s.wingArea * cd);
    force = addScaled(force, r, -qdyn * s.wingArea * 0.9 * beta);
  }
  const thrust = stepEngine(ac.engine, s, c.throttle, Math.max(0, vf), ac.fuel.litres, ac.damage, dt, ac.t, ac.engineForcedOff);
  force = addScaled(force, f, thrust);
  burnFuel(ac.fuel, s, c.throttle, ac.engine.running, dt);

  // --- rotation: rates in pilot terms (nose up, nose right, right wing down)
  const auth = clamp(qdyn / 950, 0, 1.6);
  const wash = ac.engine.running ? c.throttle * 0.45 : 0;
  const ctrl = fx.ctrlEff;
  const alphaTarget = (2.2 + c.trim * 4) * DEG + c.elevator * 17 * DEG;
  let pitchAcc = s.pitchPower * (auth + wash * 0.5) * (alphaTarget - alpha) * ctrl * 6 - ac.pitchRate * 6 * (0.35 + auth);
  let rollAcc = c.aileron * s.rollPower * auth * ctrl * 2.2 - ac.rollRate * 3.0 * (0.3 + auth) - beta * 1.4 * auth - fx.rollBias * auth;
  // hands off, she rolls gently back toward level (an easy-flying high wing)
  if (Math.abs(c.aileron) < 0.1 && Math.abs(ac.bank) < 70) rollAcc -= ac.bank * DEG * 0.9 * auth;
  let yawAcc = c.rudder * s.yawPower * (auth + wash) * ctrl * 1.3 - ac.yawRate * 2.4 * (0.3 + auth) + beta * 4.2 * auth - c.aileron * 0.12 * auth;
  if (stalled && !ac.onSurface) {
    // a stalled wing drops: which one depends on the slip
    rollAcc += (beta >= 0 ? 1 : -1) * 1.6 * Math.min(1, (alpha - alphaStall) * 8);
    pitchAcc -= 2.6; // nose falls through
  }

  // --- surface contact
  const surf = env.surfaceAt(ac.pos.x, ac.pos.z);
  const keel = ac.pos.y - s.gearHeight;
  const att = headingPitchBank(ac.q);
  let acc = scale(force, 1 / mass);

  if (!ac.onSurface && keel <= surf.height + 0.02) {
    const sink = -ac.vel.y;
    const hspeed = Math.hypot(ac.vel.x, ac.vel.z);
    const contact = classifyContact({
      kind: surf.kind === 'water' ? 'water' : surf.kind,
      sink, speed: hspeed, bank: att.bank, pitch: att.pitch,
      placeName: env.placeName ? env.placeName(ac.pos.x, ac.pos.z) : null,
    }, s);
    if (contact.crash) {
      ac.crashed = { reason: contact.reason, t: ac.t, x: ac.pos.x, z: ac.pos.z, fpm: sink * MS_TO_FPM, kt: hspeed * MS_TO_KT };
      ac.pos.y = surf.height + s.gearHeight;
      emit(ac, 'crash', { reason: contact.reason, kind: surf.kind });
      return ac;
    }
    if (contact.damage > 0) {
      hurt(ac.damage, 'floats', contact.damage, 'hard touchdown', ac.t);
      hurt(ac.damage, 'airframe', contact.damage * 0.4, 'hard touchdown', ac.t);
    }
    const rw = surf.runway ?? (env.laneAt ? env.laneAt(ac.pos.x, ac.pos.z) : null);
    const place = touchdownPlace(rw, ac.pos.x, ac.pos.z, att.hdg);
    if (ac.touch && ac.airborneTime < 4) {
      ac.touch.bounces += 1;
      emit(ac, 'bounce', { fpm: sink * MS_TO_FPM });
    } else {
      ac.touch = {
        fpm: sink * MS_TO_FPM, kt: hspeed * MS_TO_KT, kind: surf.kind, runway: rw, place, bounces: 0,
        hard: contact.hard, x: ac.pos.x, z: ac.pos.z, t: ac.t, bank: att.bank, maxAcross: place ? Math.abs(place.across) : null,
      };
      emit(ac, 'touchdown', { fpm: sink * MS_TO_FPM, kind: surf.kind, hard: contact.hard });
    }
    ac.onSurface = true;
    // the floats take the sink; a hard one throws her back up a little
    ac.vel.y = sink > 2.2 ? sink * 0.32 : 0;
    if (sink > 2.2) ac.onSurface = false;
    ac.airborneTime = 0;
    ac.pos.y = surf.height + s.gearHeight + 0.01;
  }

  if (ac.onSurface) {
    const hs = Math.hypot(ac.vel.x, ac.vel.z);
    const onWater = surf.kind === 'water';
    ac.surfaceKind = surf.kind;
    ac.runway = surf.runway;
    // rough land under the floats at speed is a wreck
    if (surf.kind === 'land' && hs > 9) {
      const reason = `Ran off onto rough ground at ${Math.round(hs * MS_TO_KT)} kt`;
      ac.crashed = { reason, t: ac.t, x: ac.pos.x, z: ac.pos.z, fpm: 0, kt: hs * MS_TO_KT };
      emit(ac, 'crash', { reason, kind: 'land' });
      return ac;
    }
    // friction and water drag along the ground track
    let mu;
    if (onWater) {
      const hump = Math.exp(-((hs - 9) ** 2) / 30) * 0.1; // ploughing hump before the step
      mu = (0.035 + hump + (hs < 3 ? 0.12 : 0)) * fx.waterDragMul;
    } else {
      mu = 0.035 + c.brake * 0.42 + (surf.kind === 'strip' ? 0.03 : 0);
    }
    const normalLoad = Math.max(0, -force.y); // weight the wings are not yet carrying
    if (hs > 0.05) {
      const dir = v3(ac.vel.x / hs, 0, ac.vel.z / hs);
      const decel = Math.min(hs / dt, (mu * Math.max(normalLoad, mass * G * 0.15)) / mass + (onWater ? 0.0012 * Math.min(hs, 15) ** 2 : 0));
      acc = addScaled(acc, dir, -decel);
      // tyres and float keels resist sideways sliding
      const side = dot(ac.vel, r);
      acc = addScaled(acc, r, -side * 3.5);
    }
    // the ground carries the weight
    if (acc.y < 0 && keel <= surf.height + 0.05) acc.y = 0;
    // steering: rudder and differential brakes on land, water rudder on the floats
    const steer = clamp(hs / 7, 0.15, 1) * (onWater ? 0.55 : 0.75);
    yawAcc = (c.rudder * steer * 1.6 - ac.yawRate) * 4 + (onWater ? fx.floatPull * 0.4 : 0);
    // keep wings level on the floats; nose sits near 2° unless the elevator lifts it at speed
    rollAcc = -att.bank * DEG * 30 - ac.rollRate * 8;
    const restPitch = 2.5 + Math.max(-2, c.elevator) * 11 * clamp((auth - 0.12) / 0.35, 0, 1);
    pitchAcc = (restPitch - att.pitch) * DEG * 12 - ac.pitchRate * 6;
    // weathervane into the wind on the water when slow
    if (onWater && hs < 6) {
      const wfrom = Math.atan2(-wind.x, wind.z) / DEG;
      const d = ((((wfrom - att.hdg) % 360) + 540) % 360) - 180;
      yawAcc += d * DEG * 0.4 * (1 - hs / 6);
    }
    // grade the landing once rolled down to taxi speed
    if (ac.touch && hs < 4) {
      finishTouchdown(ac, surf);
    } else if (ac.touch && ac.touch.place && ac.touch.runway) {
      const p = touchdownPlace(ac.touch.runway, ac.pos.x, ac.pos.z, att.hdg);
      ac.touch.maxAcross = Math.max(ac.touch.maxAcross ?? 0, Math.abs(p.across));
    }
  }

  // --- integrate
  ac.vel = addScaled(ac.vel, acc, dt);
  ac.pos = addScaled(ac.pos, ac.vel, dt);
  ac.pitchRate += pitchAcc * dt;
  ac.rollRate += rollAcc * dt;
  ac.yawRate += yawAcc * dt;
  ac.pitchRate = clamp(ac.pitchRate, -2.5, 2.5);
  ac.rollRate = clamp(ac.rollRate, -3.5, 3.5);
  ac.yawRate = clamp(ac.yawRate, -1.5, 1.5);
  // body angular velocity: +x nose up, +y nose left, +z right wing up
  const wb = v3(ac.pitchRate, -ac.yawRate, -ac.rollRate);
  const wl = len(wb);
  if (wl > 1e-6) {
    const half = (wl * dt) / 2;
    const sn = Math.sin(half) / wl;
    ac.q = quatNormalize(quatMul(ac.q, { x: wb.x * sn, y: wb.y * sn, z: wb.z * sn, w: Math.cos(half) }));
  }

  // leave the surface when the wings carry her
  if (ac.onSurface) {
    const keelNow = ac.pos.y - s.gearHeight;
    if (ac.vel.y > 0.25 && keelNow > surf.height + 0.15) {
      ac.onSurface = false;
      emit(ac, 'liftoff', { kt: Math.hypot(ac.vel.x, ac.vel.z) * MS_TO_KT });
    } else {
      ac.pos.y = Math.max(ac.pos.y, surf.height + s.gearHeight);
      if (ac.vel.y < 0) ac.vel.y = 0;
    }
  } else {
    ac.airborneTime += dt;
    // terrain strike while airborne
    const g = env.groundHeight(ac.pos.x, ac.pos.z);
    const s2 = env.surfaceAt(ac.pos.x, ac.pos.z);
    if (s2.kind === 'land' && ac.pos.y - 0.8 < g) {
      const reason = `Flew into ${env.placeName ? env.placeName(ac.pos.x, ac.pos.z) : 'the hillside'} at ${Math.round(V * MS_TO_KT)} kt`;
      ac.crashed = { reason, t: ac.t, x: ac.pos.x, z: ac.pos.z, fpm: -ac.vel.y * MS_TO_FPM, kt: V * MS_TO_KT };
      emit(ac, 'crash', { reason, kind: 'terrain' });
    }
    if (ac.touch && ac.airborneTime > 4) ac.touch = null; // a touch-and-go, not a landing
  }

  // --- structure: overspeed and over-g
  const gload = dot(addScaled(force, v3(0, 1, 0), mass * G), u) / (mass * G);
  ac.g = ac.g + (gload - ac.g) * Math.min(1, dt * 8);
  if (V > s.vne) hurt(ac.damage, 'airframe', (V - s.vne) * 0.6 * dt, 'overspeed', ac.t);
  if (Math.abs(ac.g) > s.gLimit) hurt(ac.damage, 'airframe', (Math.abs(ac.g) - s.gLimit) * 9 * dt, 'over-stressed the wings', ac.t);
  if (!ac.crashed && (ac.damage.airframe <= 0)) {
    const reason = 'The wing spar failed after too much stress';
    ac.crashed = { reason, t: ac.t, x: ac.pos.x, z: ac.pos.z, fpm: 0, kt: V * MS_TO_KT };
    emit(ac, 'crash', { reason, kind: 'structure' });
  }

  // --- read-outs
  const after = headingPitchBank(ac.q);
  ac.hdg = after.hdg; ac.pitch = after.pitch; ac.bank = after.bank;
  ac.ias = V; ac.gs = Math.hypot(ac.vel.x, ac.vel.z); ac.vs = ac.vel.y;
  ac.alpha = alpha; ac.beta = beta; ac.thrust = thrust; ac.mass = mass;
  const wasStalled = ac.stalled;
  ac.stalled = stalled && !ac.onSurface && V > 5;
  ac.stallWarn = !ac.onSurface && alpha > alphaStall - 3.5 * DEG && V > 5;
  if (ac.stalled && !wasStalled && ac.t - (ac.lastStallAt ?? -9) > 4) { emit(ac, 'stall'); ac.lastStallAt = ac.t; }
  ac.agl = ac.pos.y - s.gearHeight - Math.max(0, env.groundHeight(ac.pos.x, ac.pos.z));
  ac.alphaStall = alphaStall;
  return ac;
}

function finishTouchdown(ac, surf) {
  const t = ac.touch;
  const rw = t.runway;
  let stoppedInside = null;
  if (rw) {
    const p = touchdownPlace(rw, ac.pos.x, ac.pos.z, t.place ? t.place.landingHdg : ac.hdg);
    stoppedInside = Math.abs(p.along) <= rw.length / 2 + 15;
  }
  ac.lastLanding = { ...t, stoppedInside, stopX: ac.pos.x, stopZ: ac.pos.z, surface: surf.kind, tEnd: ac.t };
  ac.touch = null;
  emit(ac, 'landed', { landing: ac.lastLanding });
}

/** Snap a parked aircraft onto its surface (start of a mission on the water or runway). */
export function settleOnSurface(ac, env) {
  const surf = env.surfaceAt(ac.pos.x, ac.pos.z);
  ac.pos.y = surf.height + ac.spec.gearHeight;
  ac.vel = v3(ac.vel.x, 0, ac.vel.z);
  ac.onSurface = true;
  ac.surfaceKind = surf.kind;
  ac.airborneTime = 0;
  return ac;
}

export { MS_TO_KT, MS_TO_FPM };
