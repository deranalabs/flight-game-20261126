// Mission objectives: take off, fly a ring, drop a sack, land and stop, wait on the water,
// scoop water, bomb a fire, reach a point. Each one knows how to check itself, how to
// describe itself on the HUD, where its marker stands, and how the autopilot flies it.

import { RUNWAYS, runwayFrame } from '../terrain/islandLayout.js';
import { groundHeight } from '../terrain/heightmap.js';
import { flyTo, flyHeading, flyTakeoff, flyLanding, approachGate, bearingTo } from '../flight/autopilot.js';
import { wrap180, DEG } from '../util/vec3.js';
import { MS_TO_FPM } from '../flight/landingJudge.js';

const G = 9.81;

/** Highest ground on the line ahead toward a target, so the bot keeps clear of hills. */
export function safeAltitude(x, z, tx, tz, alt, clearance = 140) {
  const d = Math.hypot(tx - x, tz - z);
  const n = Math.min(24, Math.ceil(d / 150) + 1);
  let hi = 0;
  for (let i = 0; i <= n; i++) {
    const t = Math.min(1, (i * 150) / Math.max(d, 1));
    hi = Math.max(hi, groundHeight(x + (tx - x) * t, z + (tz - z) * t));
    if (t >= 1) break;
  }
  return Math.max(alt, hi + clearance);
}

/** Also clear the ground along the present track for the next 40 seconds of flight. */
export function clearAhead(ac, alt, clearance = 110) {
  return safeAltitude(ac.pos.x, ac.pos.z, ac.pos.x + ac.vel.x * 40, ac.pos.z + ac.vel.z * 40, alt, clearance);
}

/** Where a released load hits the ground or water: simple fall with the aircraft's velocity. */
export function predictImpact(ac) {
  const surface = Math.max(0, groundHeight(ac.pos.x, ac.pos.z));
  const h = Math.max(0.1, ac.pos.y - 2 - surface);
  const vy = ac.vel.y;
  const t = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G;
  // a little air drag shortens the throw
  const k = 0.82;
  return { x: ac.pos.x + ac.vel.x * t * k, z: ac.pos.z + ac.vel.z * t * k, t };
}

function landingDirection(rw, windFromDeg, back = 2600) {
  // land into the wind: pick the runway end whose heading is closest to the wind's origin,
  // unless its approach gate sits over high ground (the volcano), then take the other end
  const d = Math.abs(wrap180(rw.hdg - windFromDeg));
  const into = d <= 90 ? rw.hdg : (rw.hdg + 180) % 360;
  const other = (into + 180) % 360;
  const elev = rw.kind === 'lane' ? 0 : rw.elev;
  const high = (h) => { const g = approachGate(rw, h, back); return groundHeight(g.x, g.z) > elev + 80; };
  return high(into) && !high(other) ? other : into;
}

function botApproach(o, ctx, rw, opts = {}) {
  const { ac, ms, dt } = ctx;
  const st = o.bot ?? (o.bot = { phase: 'gate', hdg: landingDirection(rw, ms.windFrom, opts.back ?? 2600) });
  const gate = approachGate(rw, st.hdg, opts.back ?? 2600);
  const alt = (rw.kind === 'lane' ? 0 : rw.elev) + (opts.gateAlt ?? 230);
  if (st.phase === 'gate' && ac.onSurface) {
    // still sitting on the water from the last stop: take off toward the gate first
    flyTakeoff(ac, ms.ap, st.depart ?? (st.depart = ac.hdg), dt);
    return;
  }
  if (st.phase === 'gate') {
    const safe = safeAltitude(ac.pos.x, ac.pos.z, gate.x, gate.z, alt);
    const d = flyTo(ac, ms.ap, gate.x, gate.z, safe, 43, dt, 30);
    if (d < 280) {
      // gliding in too high: circle down over the gate before turning final
      st.phase = !ac.engine.running && ac.pos.y > alt + 90 ? 'orbit' : 'final';
      ms.ap.flare = false;
    }
    return;
  }
  if (st.phase === 'orbit') {
    // circle the gate at about 600 m radius, then roll out lined up with the runway
    const brg = bearingTo(ac.pos.x, ac.pos.z, gate.x, gate.z);
    const dist = Math.hypot(gate.x - ac.pos.x, gate.z - ac.pos.z);
    const tangent = brg - 90 + Math.max(-40, Math.min(40, (dist - 600) * 0.08));
    flyHeading(ac, ms.ap, tangent, alt, 34, dt, 30);
    const aligned = Math.abs(wrap180(ac.hdg - st.hdg)) < 25;
    if (ac.pos.y < alt + 30 && aligned && dist < 1000) { st.phase = 'final'; ms.ap.flare = false; }
    return;
  }
  flyLanding(ac, ms.ap, rw, st.hdg, dt, opts);
}

/** Take off; hdg is the direction the bot departs (the player may pick their own). */
export function takeoff(label = 'Take off', hdg = null) {
  return {
    kind: 'takeoff',
    label: () => label,
    marker: () => null,
    update: ({ ac }) => !ac.onSurface && ac.agl > 40,
    fly(ctx) {
      const st = this.bot ?? (this.bot = { hdg: hdg ?? ctx.ac.hdg });
      flyTakeoff(ctx.ac, ctx.ms.ap, st.hdg, ctx.dt);
    },
  };
}

/**
 * Fly through a ring at (x, y, z) radius r; hdg is the way the ring faces. With lineUp
 * the bot swings out behind it and flies through straight along its facing.
 */
// how far the bot leads its turn onto a weaving ring (a share of the heading error, within
// RING_LEAD_RANGE m), so a slalom line converges on the centre instead of chasing it round
const RING_LEAD = 0.8;
const RING_LEAD_RANGE = 900;

export function ring(x, y, z, r, hdg, name, lineUp = false, weave = false) {
  return {
    kind: 'ring', x, y, z, r, hdg, name,
    label(ms) { return `Fly through ring ${ms.ringNo(this)}${name ? ` · ${name}` : ''}`; },
    marker() { return { type: 'ring', x, y, z, r, hdg }; },
    update({ ac }) {
      const d = Math.hypot(ac.pos.x - x, ac.pos.y - y, ac.pos.z - z);
      return d < r;
    },
    fly(ctx) {
      const { ac, ms, dt } = ctx;
      // line up through the ring along its facing: a point 900 m behind it, then the centre
      const fx = Math.sin(hdg * DEG);
      const fz = -Math.cos(hdg * DEG);
      const d = Math.hypot(ac.pos.x - x, ac.pos.z - z);
      const st = this.bot ?? (this.bot = {});
      // the lining-up point behind the ring, pulled in if it would sit over high ground
      let back = 2400;
      while (back > 600 && groundHeight(x - fx * back, z - fz * back) > y - 120) back -= 175;
      if (!lineUp) {
        // any ring is cleared by flying through its centre, from whatever side
        const alt = Math.max(safeAltitude(ac.pos.x, ac.pos.z, x, z, y, d < 600 ? 60 : 90), d < 700 ? 0 : clearAhead(ac, y));
        const brg = bearingTo(ac.pos.x, ac.pos.z, x, z);
        const lead = weave && d < RING_LEAD_RANGE ? Math.max(-30, Math.min(30, wrap180(brg - ac.hdg) * RING_LEAD)) : 0;
        flyHeading(ac, ms.ap, brg + lead, alt, 44, dt, d < 250 ? 20 : 34);
        return;
      }
      if (!st.phase) {
        const off = wrap180(bearingTo(ac.pos.x, ac.pos.z, x, z) - hdg);
        st.phase = d > 700 && Math.abs(off) > 12 ? 'behind' : 'through';
      }
      if (st.phase === 'behind') {
        const bx = x - fx * back;
        const bz = z - fz * back;
        if (flyTo(ac, ms.ap, bx, bz, clearAhead(ac, safeAltitude(ac.pos.x, ac.pos.z, bx, bz, y)), 44, dt, 32) < 300) st.phase = 'through';
        return;
      }
      // metres past the ring's plane along its facing (negative: still before it), and
      // metres right of the line through its centre: intercept that line like a runway
      const past = (ac.pos.x - x) * fx + (ac.pos.z - z) * fz;
      const cross = (ac.pos.x - x) * -fz + (ac.pos.z - z) * fx;
      const lead = Math.max(180, Math.min(600, -past * 0.25));
      const want = hdg + Math.max(-45, Math.min(45, Math.atan2(-cross, lead) / DEG));
      const alt = Math.max(safeAltitude(ac.pos.x, ac.pos.z, x, z, y, d < 600 ? 60 : 90), d < 700 ? 0 : clearAhead(ac, y));
      flyHeading(ac, ms.ap, want, alt, 44, dt, d < 400 ? 20 : 32);
      // flew past without going through: go round and line up again
      if (past > 250) st.phase = 'behind';
    },
  };
}

/**
 * Drop a load (mail sack, supply crate) on a target circle. Pressing Drop releases it;
 * the load falls with the aircraft's speed, so release before the mark.
 */
export function drop(x, z, r, name, item = 'mail sack') {
  return {
    kind: 'drop', x, z, r, name, item, result: null,
    label() { return `Drop the ${item} on ${name}`; },
    marker() { return { type: 'drop', x, z, r, y: Math.max(0, groundHeight(x, z)) }; },
    update(ctx) {
      if (!ctx.actions.drop) return false;
      const { ac, ms } = ctx;
      if (ac.onSurface) return false;
      const hit = predictImpact(ac);
      const miss = Math.hypot(hit.x - x, hit.z - z);
      ms.spawnLoad({ x: ac.pos.x, y: ac.pos.y - 2, z: ac.pos.z, vx: ac.vel.x, vy: ac.vel.y, vz: ac.vel.z, item });
      if (miss <= r) {
        this.result = { miss };
        ms.score.drops.push({ name, miss: Math.round(miss), r });
        return true;
      }
      ms.say('miss', { name, miss: Math.round(miss) });
      ms.score.misses += 1;
      return false;
    },
    fly(ctx) {
      const { ac, ms, dt } = ctx;
      const st = this.bot ?? (this.bot = { phase: 'runin', dir: bearingTo(ac.pos.x, ac.pos.z, x, z) });
      const gy = Math.max(0, groundHeight(x, z));
      const rx = x - Math.sin(st.dir * DEG) * 1400;
      const rz = z + Math.cos(st.dir * DEG) * 1400;
      if (st.phase === 'runin') {
        const d = flyTo(ac, ms.ap, rx, rz, safeAltitude(ac.pos.x, ac.pos.z, rx, rz, gy + 120), 42, dt, 30);
        if (d < 250) st.phase = 'pass';
      } else {
        const d = flyTo(ac, ms.ap, x, z, d2(ac, x, z) > 900 ? safeAltitude(ac.pos.x, ac.pos.z, x, z, gy + 70, 60) : gy + 60, 38, dt, 20);
        const hit = predictImpact(ac);
        const miss = Math.hypot(hit.x - x, hit.z - z);
        ctx.actions.drop = miss < r * 0.5;
        // went past the mark without a good release: go round for another run
        if (d < 700 && ac.vel.x * (x - ac.pos.x) + ac.vel.z * (z - ac.pos.z) < 0) {
          st.phase = 'runin';
          st.dir = (st.dir + 180) % 360;
        }
      }
    },
  };
}

const d2 = (ac, x, z) => Math.hypot(ac.pos.x - x, ac.pos.z - z);

/**
 * Land on a runway or lane and slow to taxi speed. opts.maxFpm fails a landing harder
 * than that (patients, fragile cargo); opts.engineOff accepts a dead-stick arrival.
 */
export function land(rwId, opts = {}) {
  const rw = RUNWAYS[rwId];
  return {
    kind: 'land', rw, opts, landing: null,
    label() { return `Land at ${rw.name}${opts.maxFpm ? ` (softer than ${opts.maxFpm} ft/min)` : ''}`; },
    marker() { return { type: 'runway', rw }; },
    update(ctx) {
      const { ac, ms } = ctx;
      const L = ac.lastLanding;
      if (!L || L.used) return false;
      if (L.runway !== rw) {
        if (L.runway || L.surface !== 'water') return false;
        // a water landing near the lane still counts if it stopped inside the marked area
        const fr = runwayFrame(rw, L.stopX, L.stopZ);
        if (Math.abs(fr.along) > rw.length / 2 + 120 || Math.abs(fr.across) > rw.width / 2 + 60) return false;
      }
      L.used = true;
      this.landing = L;
      ms.recordLanding(L, rw, opts);
      if (opts.maxFpm && L.fpm > opts.maxFpm) {
        ms.fail(opts.failText ?? `Touched down at ${Math.round(L.fpm)} ft/min: too hard for ${opts.cargo ?? 'the cargo'}`);
        return false;
      }
      return true;
    },
    fly(ctx) { botApproach(this, ctx, rw, opts.bot ?? {}); },
  };
}

/** Land on any of several fields (a dead-stick arrival takes what it can reach). */
export function landAny(rwIds, label, opts = {}) {
  const fields = rwIds.map((id) => RUNWAYS[id]);
  return {
    kind: 'land', rw: fields[0], fields, opts, landing: null,
    label: () => label,
    marker: () => ({ type: 'runways', fields }),
    update(ctx) {
      const { ac, ms } = ctx;
      const L = ac.lastLanding;
      if (!L || L.used) return false;
      let rw = fields.find((f) => f === L.runway);
      if (!rw && L.surface === 'water') {
        rw = fields.find((f) => {
          const fr = runwayFrame(f, L.stopX, L.stopZ);
          return Math.abs(fr.along) <= f.length / 2 + 200 && Math.abs(fr.across) <= f.width / 2 + 100;
        });
        // open water away from every lane still saves the aircraft, at a lower grade
        rw = rw ?? (opts.anyWater ? { name: 'open water', kind: 'lane', width: 80, length: 800 } : null);
      }
      if (!rw) return false;
      L.used = true;
      this.landing = L;
      ms.recordLanding(L, rw, opts);
      return true;
    },
    fly(ctx) {
      this.pick = this.pick ?? nearestField(fields, ctx.ac);
      botApproach(this, ctx, this.pick, opts.bot ?? {});
    },
  };
}

function nearestField(fields, ac) {
  let best = fields[0];
  let bd = Infinity;
  for (const f of fields) {
    const d = Math.hypot(f.x - ac.pos.x, f.z - ac.pos.z);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/** Sit stopped (or slow) inside a lane or runway for some seconds: loading, refuelling. */
export function holdStill(rwId, seconds, label, onDone) {
  const rw = RUNWAYS[rwId];
  return {
    kind: 'hold', rw, seconds, held: 0,
    label() { return `${label} (${Math.max(0, Math.ceil(seconds - this.held))} s)`; },
    marker: () => ({ type: 'runway', rw }),
    update(ctx) {
      const { ac, dt } = ctx;
      const fr = runwayFrame(rw, ac.pos.x, ac.pos.z);
      const inside = Math.abs(fr.along) < rw.length / 2 + 150 && Math.abs(fr.across) < rw.width / 2 + 80;
      if (ac.onSurface && ac.gs < 4 && inside) this.held += dt;
      if (this.held >= seconds) { if (onDone) onDone(ctx); return true; }
      return false;
    },
    fly(ctx) {
      const c = ctx.ac.controls;
      c.throttle = 0; c.brake = 1; c.elevator = 0; c.aileron = 0; c.rudder = 0;
    },
  };
}

/** Skim the floats on a water run to fill the belly tank, then climb away. */
export function scoop(rwId, litres) {
  const rw = RUNWAYS[rwId];
  return {
    kind: 'scoop', rw, litres,
    label(ms) { return `Scoop water on ${rw.name}: ${Math.round(ms.ac.waterKg)} / ${litres} L`; },
    marker: () => ({ type: 'runway', rw }),
    // the tank itself fills in fillScoopTank(), called by the mission every step
    update: ({ ac }) => ac.waterKg >= litres - 0.5 && !ac.onSurface && ac.agl > 25,
    fly(ctx) {
      const { ac, ms, dt } = ctx;
      const st = this.bot ?? (this.bot = { phase: 'gate', hdg: landingDirection(rw, ms.windFrom) });
      if (ac.waterKg >= litres - 0.5) { flyTakeoff(ac, ms.ap, st.hdg, dt); return; }
      if (ac.onSurface) {
        // stay on the step: power on, nose level, track the lane
        const c = ac.controls;
        c.throttle = ac.gs > 23 ? 0.35 : 0.85;
        c.elevator = 0; c.flaps = 0.5; c.brake = 0; c.aileron = 0;
        c.rudder = Math.max(-1, Math.min(1, wrap180(st.hdg - ac.hdg) * 0.08));
        return;
      }
      botApproach(this, ctx, rw, { aim: 200, flareThrottle: 0.3 });
    },
  };
}

/** Skimming the water on the floats above 27 kt fills a fitted belly tank. */
export function fillScoopTank(ac, dt) {
  const cap = ac.spec.waterTankLitres;
  if (cap > 0 && ac.onSurface && ac.surfaceKind === 'water' && ac.gs > 14) {
    ac.waterKg = Math.min(cap, ac.waterKg + 170 * dt);
  }
}

/**
 * Put out a fire: release water over it below 300 ft. Each good drop knocks the fire
 * down by how much water landed close; fires grow back slowly. With the tank empty and
 * the fire still burning, the bot goes back to the lagoon for more.
 */
export function bombFire(fire, label, refillLane = 'mirrorLagoon') {
  return {
    kind: 'fire', fire,
    label() { return `${label}: fire ${Math.round(fire.intensity * 100)}%`; },
    marker: () => ({ type: 'fire', x: fire.x, z: fire.z, r: fire.r, y: Math.max(0, groundHeight(fire.x, fire.z)) }),
    update(ctx) {
      const { ac, ms } = ctx;
      if (ctx.actions.drop && ac.waterKg > 20 && !ac.onSurface) {
        const hit = predictImpact(ac);
        const miss = Math.hypot(hit.x - fire.x, hit.z - fire.z);
        const agl = ac.pos.y - Math.max(0, groundHeight(ac.pos.x, ac.pos.z));
        const spread = agl > 95 ? 0.4 : 1; // a high drop turns to mist
        const hitShare = Math.max(0, 1 - miss / (fire.r * 1.6)) * spread;
        const knock = (ac.waterKg / 800) * hitShare * 1.25;
        ms.spawnWater({ x: ac.pos.x, y: ac.pos.y, z: ac.pos.z, vx: ac.vel.x, vz: ac.vel.z, litres: ac.waterKg });
        fire.intensity = Math.max(0, fire.intensity - knock);
        ms.score.waterDrops.push({ fire: fire.name, miss: Math.round(miss), knock: Math.round(knock * 100) });
        ac.waterKg = 0;
        ms.say(knock > 0.4 ? 'fireHit' : 'fireMiss', { name: fire.name });
      }
      return fire.intensity <= 0.05;
    },
    fly(ctx) {
      const { ac, ms, dt } = ctx;
      if (ac.waterKg < 100 || (this.refill && !this.refill.update(ctx))) {
        this.refill = this.refill ?? scoop(refillLane, ac.spec.waterTankLitres || 800);
        this.refill.fly(ctx);
        return;
      }
      this.refill = null;
      const st = this.bot ?? (this.bot = { phase: 'runin', dir: bearingTo(ac.pos.x, ac.pos.z, fire.x, fire.z) });
      const gy = Math.max(0, groundHeight(fire.x, fire.z));
      const rx = fire.x - Math.sin(st.dir * DEG) * 1500;
      const rz = fire.z + Math.cos(st.dir * DEG) * 1500;
      if (st.phase === 'runin') {
        const d = flyTo(ac, ms.ap, rx, rz, safeAltitude(ac.pos.x, ac.pos.z, rx, rz, gy + 150), 42, dt, 30);
        if (d < 250) st.phase = 'pass';
      } else {
        const far = d2(ac, fire.x, fire.z) > 700;
        const alt = far ? safeAltitude(ac.pos.x, ac.pos.z, fire.x, fire.z, gy + 70, 55) : gy + 55;
        flyTo(ac, ms.ap, fire.x, fire.z, alt, 38, dt, 20);
        // release at the closest predicted point, or as soon as it is dead on
        const hit = predictImpact(ac);
        const miss = Math.hypot(hit.x - fire.x, hit.z - fire.z);
        ctx.actions.drop = miss < 12 || (miss < fire.r * 0.45 && miss > (st.prevMiss ?? Infinity));
        st.prevMiss = miss;
        if (d2(ac, fire.x, fire.z) < 700 && ac.vel.x * (fire.x - ac.pos.x) + ac.vel.z * (fire.z - ac.pos.z) < 0) {
          st.phase = 'runin';
          st.dir = (st.dir + 180) % 360;
        }
      }
    },
  };
}

/** Reach a point (any height), e.g. a gate on a night approach. */
export function reach(x, z, r, name, alt = 300) {
  return {
    kind: 'reach', x, z, r, name,
    label: () => `Head for ${name}`,
    marker: () => ({ type: 'beacon', x, z, r, y: Math.max(0, groundHeight(x, z)) }),
    update: ({ ac }) => Math.hypot(ac.pos.x - x, ac.pos.z - z) < r,
    fly(ctx) {
      flyTo(ctx.ac, ctx.ms.ap, x, z, safeAltitude(ctx.ac.pos.x, ctx.ac.pos.z, x, z, alt), 45, ctx.dt, 30);
    },
  };
}

export { MS_TO_FPM };
