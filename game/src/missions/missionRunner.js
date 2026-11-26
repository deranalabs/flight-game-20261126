// Runs one mission: sets up the aircraft, wind and radio from a mission file, steps the
// flight model, checks objectives in order, raises warnings, fails on a crash or the
// mission's own limits, and scores the sortie for the logbook and the pay packet.

import { makeAircraft, stepAircraft, settleOnSurface, STEP } from '../flight/flightModel.js';
import { makeFlightEnv } from '../flight/flightEnv.js';
import { makeAutopilot } from '../flight/autopilot.js';
import { buildSpec } from '../aircraft/ternSpec.js';
import { makeRadio } from '../characters/radioCast.js';
import { gradeLanding } from '../flight/landingJudge.js';
import { condition, PARTS } from '../systems/damageModel.js';
import { groundHeight } from '../terrain/heightmap.js';

/**
 * Begin a mission. career: { upgrades: [], damage: {...} } carries the hangar state in;
 * a mission may lend an upgrade (the fire service tank) for its own flight.
 */
export function startMission(def, career = {}, seed = 1) {
  const upgrades = [...(career.upgrades ?? []), ...(def.lends ?? [])];
  const spec = buildSpec(upgrades);
  const env = makeFlightEnv(def.weather, def.windFrom, def.seed ?? seed);
  const start = { ...def.start, fuel: def.fuel ?? 1, payloadKg: def.payloadKg ?? 0, damage: { ...(career.damage ?? {}) } };
  if (start.onSurface) start.y = 0;
  const ac = makeAircraft(spec, start);
  if (start.onSurface) settleOnSurface(ac, env);
  else if (start.agl !== undefined) ac.pos.y = Math.max(0, groundHeight(ac.pos.x, ac.pos.z)) + start.agl;
  const ms = {
    def, ac, env, spec,
    ap: makeAutopilot(),
    radio: makeRadio(def.radio ?? {}),
    windFrom: def.windFrom,
    objectives: [],
    index: 0,
    t: 0,
    status: 'flying',
    failReason: null,
    score: { drops: [], misses: 0, waterDrops: [], landings: [], damageStart: { ...ac.damage }, fuelStart: ac.fuel.litres },
    loads: [],
    splashes: [],
    extra: {},
    warned: {},
    ringNo(o) {
      const rings = ms.objectives.filter((x) => x.kind === 'ring');
      return `${rings.indexOf(o) + 1} of ${rings.length}`;
    },
    say(evt, data = {}) { ms.radio.say(evt, data, ms.t); },
    fail(text) {
      if (ms.status !== 'flying') return;
      ms.status = 'failed';
      ms.failReason = text;
      ms.radio.say('failed', {}, ms.t);
    },
    recordLanding(L, rw, opts) {
      const g = gradeLanding({
        fpm: L.fpm,
        across: L.place ? L.place.across : null,
        bounces: L.bounces,
        stoppedInside: rw.kind === 'lane' ? null : L.stoppedInside,
        widthHalf: rw.width / 2,
      });
      ms.score.landings.push({ where: rw.name, fpm: Math.round(L.fpm), across: L.place ? Math.round(Math.abs(L.place.across) * 10) / 10 : null, bounces: L.bounces, ...g });
      ms.say(L.fpm > 450 ? 'hardLanding' : L.fpm < 180 ? 'softLanding' : 'landing', {});
    },
    spawnLoad(l) { ms.loads.push({ ...l, kind: 'load', t: 0 }); },
    spawnWater(w) { ms.loads.push({ ...w, vy: 0, kind: 'water', t: 0 }); },
  };
  ms.objectives = def.build(ms);
  if (def.setup) def.setup(ms);
  for (const [who, text] of def.radio?.start ?? []) ms.radio.line(who, text, 0);
  return ms;
}

export function currentObjective(ms) {
  return ms.objectives[ms.index] ?? null;
}

/**
 * Advance the mission by one fixed step. actions: { drop: bool, restart: bool };
 * with bot true the autopilot flies the current objective.
 */
export function stepMission(ms, actions = {}, opts = {}) {
  if (ms.status !== 'flying') return ms;
  const dt = STEP;
  const ac = ms.ac;
  const obj = currentObjective(ms);
  const ctx = { ac, ms, dt, env: ms.env, actions: { ...actions } };
  // a mission may route the bot through a side task first (the storm's fuel stop)
  if (opts.bot && !(ms.def.botFly && ms.def.botFly(ms, ctx)) && obj && obj.fly) obj.fly(ctx);
  if (ms.def.beforeStep) ms.def.beforeStep(ms, dt, ctx);
  ac.events.length = 0;
  stepAircraft(ac, ms.env, dt);
  ms.t += dt;
  if (ms.def.update) ms.def.update(ms, dt, ctx);

  for (const e of ac.events) {
    if (e.type === 'crash') {
      ms.say('crash');
      ms.fail(e.reason);
    } else if (e.type === 'bounce') ms.say('bounce');
    else if (e.type === 'stall') ms.say('stall');
  }
  if (ms.status !== 'flying') return ms;

  if (obj && obj.update(ctx)) {
    obj.doneAt = ms.t;
    ms.index += 1;
    const lines = ms.def.radio?.[`obj${ms.index}`];
    if (lines) for (const [who, text] of lines) ms.radio.line(who, text, ms.t);
    if (ms.def.onObjective) ms.def.onObjective(ms, ms.index, obj);
    if (ms.index >= ms.objectives.length && ms.status === 'flying') {
      ms.status = 'done';
      for (const [who, text] of ms.def.radio?.done ?? []) ms.radio.line(who, text, ms.t);
    }
  }
  warnings(ms);
  stepLoads(ms, dt);
  ms.radio.update(ms.t);
  if (ms.def.timeLimit && ms.t > ms.def.timeLimit && ms.status === 'flying') ms.fail(ms.def.timeLimitText ?? 'Out of time');
  // stranded: engine dead and floating still, with work left
  if (ms.status === 'flying' && !ac.engine.running && ac.onSurface && ac.gs < 1 && ac.fuel.litres <= 0.01) {
    ms.fail('Out of fuel and drifting: the rescue boat towed you home');
  }
  return ms;
}

function warnings(ms) {
  const ac = ms.ac;
  const w = ms.warned;
  const frac = ac.fuel.litres / ac.fuel.capacity;
  if (frac < 0.15 && !w.lowFuel) { w.lowFuel = true; ms.say('lowFuel'); }
  if (frac < 0.05 && !w.fuelCritical) { w.fuelCritical = true; ms.say('fuelCritical'); }
  if (ac.engine.temp > 104) ms.say('overheat');
  if (!ac.engine.running && !w.engineOut && !ac.onSurface) { w.engineOut = true; ms.say('engineOut'); }
  if (ac.engine.running) w.engineOut = false;
  const worst = condition(ac.damage).worstHealth;
  if (w.worst === undefined) w.worst = worst;
  if (worst < w.worst - 12) { w.worst = worst; ms.say('damage'); }
}

function stepLoads(ms, dt) {
  for (const l of ms.loads) {
    l.t += dt;
    if (l.landed) continue;
    l.vy -= 9.81 * dt;
    l.vx *= 1 - 0.18 * dt;
    l.vz *= 1 - 0.18 * dt;
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.z += l.vz * dt;
    const g = Math.max(0, groundHeight(l.x, l.z));
    if (l.y <= g) { l.y = g; l.landed = true; ms.splashes.push({ x: l.x, y: g, z: l.z, t: ms.t, kind: l.kind }); }
  }
  ms.loads = ms.loads.filter((l) => !l.landed || l.t < 30);
  ms.splashes = ms.splashes.filter((s) => ms.t - s.t < 6);
}

/** Score a finished or failed sortie: stars, pay and notes for the debrief and logbook. */
export function missionResult(ms) {
  const def = ms.def;
  const ac = ms.ac;
  const done = ms.status === 'done';
  const landings = ms.score.landings;
  const avgLanding = landings.length ? landings.reduce((s, l) => s + l.points, 0) / landings.length : 70;
  const dmgTaken = PARTS.reduce((s, p) => s + Math.max(0, ms.score.damageStart[p] - ac.damage[p]), 0);
  const fuelUsed = ms.score.fuelStart - ac.fuel.litres;
  let stars = 0;
  const notes = [];
  if (done) {
    stars = 1;
    const fast = ms.t <= def.parTime;
    const neat = avgLanding >= 75 && dmgTaken < 8 && ms.score.misses <= (def.missAllowance ?? 1);
    if (fast || neat) stars = 2;
    if (fast && neat) stars = 3;
    notes.push(fast ? `inside par time ${fmtTime(def.parTime)}` : `over par time ${fmtTime(def.parTime)}`);
    if (ms.score.misses) notes.push(`${ms.score.misses} missed drop${ms.score.misses > 1 ? 's' : ''}`);
    if (dmgTaken >= 8) notes.push(`took ${Math.round(dmgTaken)} points of damage`);
  } else {
    notes.push(ms.failReason ?? 'mission abandoned');
  }
  let pay = 0;
  if (done) {
    pay = Math.round(def.pay * (0.55 + stars * 0.15) + (def.bonus ? def.bonus(ms) : 0));
    if (ms.extra.payCut) { pay -= ms.extra.payCut; notes.push(ms.extra.payCutNote ?? 'pay docked'); }
  }
  const bestLanding = landings.reduce((b, l) => (!b || l.points > b.points ? l : b), null);
  return {
    id: def.id, title: def.title, done, stars, pay: Math.max(0, pay), time: ms.t,
    landing: bestLanding ? bestLanding.letter : '-', landings, notes,
    damageTaken: Math.round(dmgTaken), fuelUsed: Math.round(fuelUsed),
    crashed: !!ac.crashed, reason: ms.failReason,
  };
}

export function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}
