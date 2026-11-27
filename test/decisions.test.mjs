// Decisions with a price: the bingo box (commit or divert, the countdown, the flameout,
// the receipt line) and named damage (each line's effect is real in the flight model,
// a holed float refuses the sea, YOUR CALL patches her at the next stop).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionById, MISSIONS } from '../game/src/missions/index.js';
import { startMission, stepMission, currentObjective, missionResult } from '../game/src/missions/missionRunner.js';
import { BINGO, REPAIR } from '../game/src/missions/pilotCalls.js';
import { makeAircraft, stepAircraft, settleOnSurface } from '../game/src/flight/flightModel.js';
import { makeFlightEnv } from '../game/src/flight/flightEnv.js';
import { buildSpec } from '../game/src/aircraft/ternSpec.js';
import { damageLines, damageEffects, noSeaLanding, makeDamage } from '../game/src/systems/damageModel.js';
import { RUNWAYS } from '../game/src/terrain/islandLayout.js';
import { newCareer } from '../game/src/hangar/careerSave.js';
import { scoreSortie } from '../game/src/hangar/sortieScore.js';
import { settleSortie, debtLeft } from '../game/src/hangar/harbourDebt.js';
import { flyMissionWithBot } from './botPilot.mjs';

/** Medevac flown by the bot until the last landing, home with the patient, is the job in hand. */
function onFinalLeg() {
  const ms = startMission(missionById('medevac'), {}, 1);
  for (let i = 0; i < 1800 * 60 && ms.status === 'flying'; i++) {
    stepMission(ms, {}, { bot: true });
    const o = currentObjective(ms);
    if (ms.index === ms.objectives.length - 1 && !ms.ac.onSurface && ms.ac.agl > 150) break;
  }
  assert.equal(currentObjective(ms).kind, 'land');
  return ms;
}
const toBingo = (ms, share = BINGO.frac - 0.01) => { ms.ac.fuel.litres = ms.ac.fuel.capacity * share; };
const stepN = (ms, n, actions = {}, opts = {}) => { for (let i = 0; i < n && ms.status === 'flying'; i++) stepMission(ms, i ? {} : actions, opts); };

test('bingo opens with both options priced, and silence commits on the countdown', () => {
  const ms = onFinalLeg();
  toBingo(ms);
  stepN(ms, 1);
  const b = ms.extra.bingo;
  assert.ok(b && b.open, 'box open');
  assert.match(b.commit.rwy, /^\d\d$/);
  assert.ok(b.divert.to && b.divert.field !== currentObjective(ms).rw, 'divert names another field');
  assert.equal(b.divert.sh, BINGO.divertSh);
  stepN(ms, Math.ceil(BINGO.seconds * 60) - 10);
  assert.ok(b.open, 'still open before the countdown ends');
  stepN(ms, 20);
  assert.equal(b.choice, 'commit');
});

test('commit keeps the plan, and a flameout short of the field ends the sortie at the stated penalty', () => {
  const ms = onFinalLeg();
  const target = currentObjective(ms).rw;
  toBingo(ms);
  stepN(ms, 1);
  stepN(ms, 1, { call: 1 });
  assert.equal(ms.extra.bingo.choice, 'commit');
  assert.equal(currentObjective(ms).rw, target);
  ms.ac.fuel.litres = 0;
  stepN(ms, 2);
  assert.equal(ms.status, 'failed');
  assert.match(ms.failReason, /ran dry/);
  const c = newCareer();
  const before = debtLeft(c);
  const st = settleSortie(c, ms.def, scoreSortie(ms, 0), MISSIONS.length, ms.extra);
  assert.equal(debtLeft(c) - before, BINGO.flameoutSh);
  assert.match(st.charges[0].label, /flameout short of RWY \d\d: −900 sh/);
});

test('divert re-targets the landing, the bot lands there, and the receipt books the sh and minutes', () => {
  const ms = onFinalLeg();
  toBingo(ms);
  stepN(ms, 1);
  const field = ms.extra.bingo.divert.field;
  stepN(ms, 1, { call: 2 });
  assert.equal(ms.extra.bingo.choice, 'divert');
  assert.equal(currentObjective(ms).rw, field);
  ms.ac.fuel.litres = ms.ac.fuel.capacity * 0.5; // the test is the re-target, not the fuel
  stepN(ms, 1500 * 60, {}, { bot: true });
  assert.equal(ms.status, 'done');
  assert.equal(ms.score.landings.at(-1).where, field.name);
  assert.ok(missionResult(ms).time >= ms.t + BINGO.divertMin * 60 - 1);
  const c = newCareer();
  const st = settleSortie(c, ms.def, scoreSortie(ms, 0), MISSIONS.length, ms.extra);
  assert.match(st.charges[0].label, new RegExp(`diverted to ${ms.extra.bingo.divert.to}: −${BINGO.divertSh} sh, \\+${BINGO.divertMin} min`));
});

test('the bot diverts only when the commit reserve is under its margin', () => {
  const thin = onFinalLeg();
  toBingo(thin, 0.01);
  stepN(thin, 1, {}, { bot: true });
  assert.ok(thin.extra.bingo.commit.reserveMin < BINGO.botMarginMin);
  assert.equal(thin.extra.bingo.choice, 'divert');
  const fine = onFinalLeg();
  toBingo(fine);
  stepN(fine, 1, {}, { bot: true });
  assert.ok(fine.extra.bingo.commit.reserveMin >= BINGO.botMarginMin);
  assert.equal(fine.extra.bingo.choice, 'commit');
});

const env = makeFlightEnv('calm', 270, 1);
const spec = buildSpec([]);
function fly(damage, seconds, start = {}) {
  const ac = makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 1, damage, ...start });
  if (start.onSurface) settleOnSurface(ac, env);
  for (let i = 0; i < seconds * 60; i++) stepAircraft(ac, env);
  return ac;
}

test('each damage line states a number taken from the effects the flight model applies', () => {
  const dmg = makeDamage({ engine: 60, airframe: 70, controls: 64, floats: 42 });
  const fx = damageEffects(dmg);
  const lines = damageLines(dmg).map((l) => l.text);
  assert.ok(lines.includes(`ENGINE 60% · thrust −${Math.round((1 - fx.thrustMul) * 100)}%`), lines.join('|'));
  assert.ok(lines.some((l) => l === `AILERONS 64% · roll rate −${Math.round((1 - fx.ctrlEff) * 100)}%, rolls left`));
  assert.ok(lines.some((l) => /^L WING 70% · stall \+\d+%, rolls left$/.test(l)));
  assert.ok(lines.includes('R FLOAT 42% · pulls right on water, no sea landing'));
  assert.equal(damageLines(makeDamage()).length, 0);
});

test('engine damage costs climb, aileron damage rolls her left, a holed float pulls right on the water', () => {
  assert.ok(fly({ engine: 60 }, 30).pos.y < fly({}, 30).pos.y - 20, 'less climb');
  assert.ok(fly({ controls: 50 }, 6).bank < fly({}, 6).bank - 1.5, 'rolls left');
  const rw = RUNWAYS.halyardHarbour;
  const water = { x: rw.x, y: 0, z: rw.z, hdg: rw.hdg, speed: 12, onSurface: true, throttle: 0.5 };
  const turn = (ac) => ((ac.hdg - rw.hdg + 540) % 360) - 180;
  assert.ok(turn(fly({ floats: 30 }, 6, water)) > turn(fly({}, 6, water)) + 2, 'pulls right');
});

test('a holed float refuses the sea: a water landing under the float limit ends the sortie', () => {
  assert.ok(noSeaLanding({ floats: 42 }) && !noSeaLanding({ floats: 80 }));
  const { result } = flyMissionWithBot(missionById('mailRun'), { maxSeconds: 1200, career: { damage: { floats: 40 } } });
  assert.equal(result.done, false);
  assert.match(result.reason, /holed float/);
});

test('YOUR CALL: repair is offered once a part is hurt, and patches her at the next stop for the stated price', () => {
  const ms = startMission(missionById('mailRun'), { damage: { controls: 70 } }, 1);
  stepN(ms, 1);
  const r = ms.extra.repair;
  assert.ok(r.open && r.sh > 0 && r.min === REPAIR.min);
  stepN(ms, 1, { call: 1 });
  assert.equal(r.choice, 'repair');
  stepN(ms, 1); // still sitting on the water at the start: that is the stop
  assert.equal(ms.ac.damage.controls, 100);
  assert.equal(ms.extra.charges[0].sh, r.sh);
  assert.match(ms.extra.charges[0].label, new RegExp(`field repair: −${r.sh} sh, \\+${REPAIR.min} min`));
  const pressed = startMission(missionById('mailRun'), { damage: { controls: 70 } }, 1);
  stepN(pressed, Math.ceil(REPAIR.seconds * 60) + 10);
  assert.equal(pressed.extra.repair.choice, 'press');
  assert.equal(pressed.ac.damage.controls, 70);
});
