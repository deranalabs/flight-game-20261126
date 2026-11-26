// Autopilot: holds a heading, altitude and airspeed, flies a takeoff, tracks a landing
// approach down a glide path with a flare, and stops on the runway. The test bot flies
// every mission with it, the shot mode poses scenes with it, and the player can hand
// over cruise with the Z key. It only moves the same controls the pilot does.

import { clamp, wrap180, DEG } from '../util/vec3.js';
import { runwayFrame } from '../terrain/islandLayout.js';
import { stallSpeed } from '../aircraft/ternSpec.js';

export function makeAutopilot() {
  return { vsInt: 0, spdInt: 0, mode: 'cruise', flare: false, phase: null };
}

/** Heading to fly from (x, z) to (tx, tz), 0 = north. */
export function bearingTo(x, z, tx, tz) {
  return ((Math.atan2(tx - x, -(tz - z)) / DEG) + 360) % 360;
}

/** Rudder that keeps the ball centred: a slip to the right needs right rudder. */
function coordinate(ac) {
  return clamp(ac.beta * 3, -1, 1);
}

function steerBank(ac, ap, bankWanted, dt) {
  const err = bankWanted - ac.bank;
  ac.controls.aileron = clamp(err * 0.06 - ac.rollRate * 0.35, -1, 1);
}

function holdVs(ac, ap, vsWanted, dt, gain = 0.06, protect = true) {
  // never trade the last of the airspeed for climb: below 1.18 Vs the nose comes down
  const vsMin = stallSpeed(ac.spec, ac.mass || 1800, ac.controls.flaps);
  const margin = ac.ias - vsMin * 1.18;
  if (protect && margin < 0 && ac.engine.running) vsWanted = Math.min(vsWanted, margin * 0.8);
  const err = vsWanted - ac.vs;
  ap.vsInt = clamp(ap.vsInt + err * dt * 0.035, -0.6, 0.8);
  // more back pressure in a bank to keep the nose up in the turn
  const bankComp = (1 / Math.max(0.35, Math.cos(ac.bank * DEG)) - 1) * 0.35;
  ac.controls.elevator = clamp(ap.vsInt + err * gain + bankComp - ac.pitchRate * 0.6, -1, 1);
}

function holdSpeed(ac, ap, speedWanted, dt) {
  const err = speedWanted - ac.ias;
  ap.spdInt = clamp(ap.spdInt + err * dt * 0.02, -0.4, 0.6);
  ac.controls.throttle = clamp(0.45 + ap.spdInt + err * 0.08, 0, 1);
}

/** Fly toward a heading at an altitude (m above sea) and speed (m/s). */
export function flyHeading(ac, ap, hdg, alt, speed, dt, maxBank = 30) {
  // steer the ground track, not the nose, so a crosswind does not push her off the line
  const track = ac.gs > 15 && !ac.onSurface ? Math.atan2(ac.vel.x, -ac.vel.z) / DEG : ac.hdg;
  const herr = wrap180(hdg - track);
  const bankWanted = clamp(herr * 1.1, -maxBank, maxBank);
  steerBank(ac, ap, bankWanted, dt);
  if (!ac.engine.running) {
    // no engine: the nose holds best-glide speed and height goes where it must
    glideSpeed(ac, ap, speed, dt);
  } else {
    const vsWanted = clamp((alt - ac.pos.y) * 0.12, -6, 4.5);
    holdVs(ac, ap, vsWanted, dt);
    holdSpeed(ac, ap, speed, dt);
  }
  ac.controls.rudder = coordinate(ac);
  ac.controls.flaps = speed < 32 ? 0.5 : 0;
  ac.controls.brake = 0;
}

/** Fly to a point at an altitude. Returns horizontal distance left. */
export function flyTo(ac, ap, tx, tz, alt, speed, dt, maxBank = 30) {
  flyHeading(ac, ap, bearingTo(ac.pos.x, ac.pos.z, tx, tz), alt, speed, dt, maxBank);
  return Math.hypot(tx - ac.pos.x, tz - ac.pos.z);
}

/** Takeoff run: full power, hold the runway heading, rotate at speed, climb out. */
export function flyTakeoff(ac, ap, hdg, dt) {
  const c = ac.controls;
  c.throttle = 1;
  c.flaps = 0.5;
  c.brake = 0;
  c.aileron = clamp(-ac.bank * 0.05 - ac.rollRate * 0.3, -1, 1);
  const herr = wrap180(hdg - ac.hdg);
  const rotate = stallSpeed(ac.spec, ac.mass || 1800, 0.5) * 1.08;
  if (ac.onSurface && Math.abs(herr) > 12 && ac.gs < 6) {
    // turn round on the spot first: a little power and full rudder
    c.throttle = 0.3;
    c.rudder = herr > 0 ? 1 : -1;
    c.elevator = 0;
    return;
  }
  if (ac.onSurface) {
    c.rudder = clamp(herr * 0.08, -1, 1);
    c.elevator = ac.ias > rotate ? 0.9 : ac.surfaceKind === 'water' ? 0.3 : 0;
  } else {
    c.rudder = coordinate(ac);
    steerBank(ac, ap, clamp(herr * 1.0, -10, 10), dt);
    // climb out at a fixed speed: the nose holds speed, full power gives the climb
    const climbSpeed = rotate * 1.2;
    const floor = ac.agl < 12 ? 1.2 : -1; // stay climbing in ground effect
    holdVs(ac, ap, clamp((ac.ias - climbSpeed) * 0.9, floor, 4.5), dt);
  }
}

/**
 * Landing approach to a runway or lane in direction landingHdg. Keeps a glide path that
 * meets the surface `aim` metres past the threshold, flares, holds the centreline and
 * brakes. Returns the phase name.
 */
export function flyLanding(ac, ap, rw, landingHdg, dt, opts = {}) {
  const c = ac.controls;
  const fr = runwayFrame(rw, ac.pos.x, ac.pos.z, landingHdg);
  const aim = opts.aim ?? Math.min(rw.length * 0.22, 160);
  const toTouch = -(fr.along + rw.length / 2 - aim); // metres before the aim point
  const elev = rw.kind === 'lane' ? 0 : rw.elev;
  const approachSpeed = opts.speed ?? stallSpeed(ac.spec, ac.mass || 1800, 1) * 1.3;
  const slope = Math.tan((opts.glideDeg ?? 4) * DEG);
  const gear = ac.spec.gearHeight;
  const hAbove = ac.pos.y - gear - elev;

  if (ac.onSurface) {
    ap.phase = 'rollout';
    c.throttle = 0;
    c.flaps = 1;
    c.elevator = -0.1;
    c.brake = rw.kind === 'lane' ? 0 : 1;
    c.aileron = 0;
    const herr = wrap180(landingHdg - ac.hdg) - fr.across * 0.4;
    c.rudder = clamp(herr * 0.06, -1, 1);
    return ap.phase;
  }

  // lateral: intercept the centreline, aiming at a point ahead on it
  const lead = Math.max(120, Math.min(1000, toTouch * 0.3));
  // crab into the crosswind: the track, not the nose, has to follow the centreline
  const track = Math.atan2(ac.vel.x, -ac.vel.z) / DEG;
  const crab = ac.gs > 5 ? wrap180(ac.hdg - track) : 0;
  const corr = clamp((Math.atan2(-fr.across, lead) / DEG), -35, 35) + clamp(crab, -20, 20);
  const hdgWanted = landingHdg + corr;
  const herr = wrap180(hdgWanted - ac.hdg);
  const lowBank = hAbove < 25 ? 6 : hAbove < 60 ? 14 : 25;
  steerBank(ac, ap, clamp(herr * 1.3, -lowBank, lowBank), dt);
  c.rudder = coordinate(ac);
  c.brake = 0;

  if (hAbove < 6 || ap.flare) {
    ap.phase = 'flare';
    ap.flare = true;
    c.throttle = opts.flareThrottle ?? 0.08;
    c.flaps = 1;
    holdVs(ac, ap, hAbove > 3 ? -1.1 : -0.45, dt, 0.55, false);
    return ap.phase;
  }
  ap.phase = toTouch > 2500 ? 'inbound' : 'final';
  const pathAlt = elev + gear + Math.max(0, toTouch) * slope;
  const hold = opts.minAlt ?? elev + 120;
  const altWanted = toTouch > 2500 ? Math.max(pathAlt, hold) : pathAlt;
  const vsPath = -ac.gs * slope;
  const vsWanted = clamp(vsPath + (altWanted - ac.pos.y) * 0.15, -5, 3);
  c.flaps = toTouch < 2500 ? 1 : 0.5;
  holdVs(ac, ap, vsWanted, dt);
  holdSpeed(ac, ap, approachSpeed, dt);
  if (!ac.engine.running) {
    // dead stick: below the path keep best glide and stretch; above it dive off height
    const glideV = ac.pos.y < altWanted ? approachSpeed * 1.08 : approachSpeed * 1.25;
    glideSpeed(ac, ap, glideV, dt);
    c.flaps = ac.pos.y < altWanted - 15 ? 0 : 1;
  }
  return ap.phase;
}

/** Pitch for speed: with no power the elevator holds an airspeed. */
function glideSpeed(ac, ap, speed, dt) {
  // fast: raise the nose a little; slow: lower it. Gentle, so no phugoid builds up.
  const err = ac.ias - speed;
  const pitchWanted = clamp(-4 + err * 0.7, -14, 6);
  ap.glideInt = clamp((ap.glideInt ?? 0) + (pitchWanted - ac.pitch) * dt * 0.01, -0.4, 0.4);
  ac.controls.elevator = clamp(ap.glideInt + (pitchWanted - ac.pitch) * 0.04 - ac.pitchRate * 0.9, -1, 1);
  ac.controls.throttle = 0;
}

/** Distance (m) of a standard approach start point before a runway's threshold. */
export function approachGate(rw, landingHdg, back = 2600) {
  const a = landingHdg * DEG;
  const fx = Math.sin(a);
  const fz = -Math.cos(a);
  const half = rw.length / 2;
  return { x: rw.x - fx * (half + back), z: rw.z - fz * (half + back) };
}
