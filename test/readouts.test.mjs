// Pilot readouts: the ring-cleared toast counts from the real objective list, the ring
// streak counts clears and misses, and the PAPI and glideslope agree with the autopilot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, missionById } from '../game/src/missions/index.js';
import { startMission, stepMission } from '../game/src/missions/missionRunner.js';
import { ringClearedText } from '../game/src/hud/flightHud.js';
import { approachTo, currentApproach, papiWhite, GLIDE_DEG, aimPoint, fieldElevation } from '../game/src/flight/glidepath.js';
import { RUNWAYS } from '../game/src/terrain/islandLayout.js';
import { flyMissionWithBot } from './botPilot.mjs';

test('ring toast reads n/m from the objective list', () => {
  const ms = startMission(missionById('buoySlalom'));
  const rings = ms.objectives.filter((o) => o.kind === 'ring');
  assert.equal(ringClearedText(ms, rings[0]), 'RING 1/6 CLEARED');
  assert.equal(ringClearedText(ms, rings[5]), 'RING 6/6 CLEARED');
});

test('passing close by a ring without going through is a miss and resets the streak', () => {
  const ms = startMission(missionById('ringCourse'));
  const o = ms.objectives[0];
  ms.score.ringStreak = 3;
  ms.ac.pos.x = o.x + o.r * 2; ms.ac.pos.y = o.y; ms.ac.pos.z = o.z;
  stepMission(ms);
  assert.equal(ms.score.ringMisses, 0);
  ms.ac.pos.x = o.x + o.r * 8;
  stepMission(ms);
  assert.equal(ms.score.ringMisses, 1);
  assert.equal(ms.score.ringStreak, 0);
  assert.equal(ms.index, 0);
});

test('the bot flies every ring job with an unbroken streak', () => {
  for (const def of MISSIONS) {
    const { ms } = flyMissionWithBot(def, { maxSeconds: 1800 });
    const rings = ms.objectives.filter((o) => o.kind === 'ring').length;
    if (!rings) continue;
    assert.equal(ms.score.bestStreak, rings, def.title);
    assert.equal(ms.score.ringMisses, 0, def.title);
  }
});

test('PAPI shows two white on the slope, all white high, all red low', () => {
  assert.equal(papiWhite(0), 2);
  assert.equal(papiWhite(1), 4);
  assert.equal(papiWhite(-1), 0);
  const rw = RUNWAYS.halyard;
  // 2 km out on the runway 36 approach, on the 4° path
  const d = 2000;
  const z = rw.z + rw.length / 2 - aimPoint(rw) + d;
  const on = approachTo(rw, 0, fieldElevation(rw) + d * Math.tan((GLIDE_DEG * Math.PI) / 180), z);
  assert.equal(on.hdg, 0);
  assert.ok(Math.abs(on.dev) < 0.05);
  assert.equal(approachTo(rw, 3000, 100, z), null, 'well off the centreline is no approach');
});

test('the autopilot flies down the same glideslope the PAPI shows', () => {
  const ms = startMission(missionById('mailRun'));
  const devs = [];
  for (let i = 0; i < 60 * 1500 && ms.status === 'flying'; i++) {
    stepMission(ms, {}, { bot: true });
    const ap = currentApproach(ms);
    if (ap && ap.toAim > 400 && ap.toAim < 1500 && ms.ap.flare === false) devs.push(ap.dev);
  }
  assert.equal(ms.status, 'done');
  assert.ok(devs.length > 60, 'saw the final approach');
  const mean = devs.reduce((s, v) => s + v, 0) / devs.length;
  assert.ok(Math.abs(mean) < 1, `mean deviation ${mean.toFixed(2)}°`);
});
