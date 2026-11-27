// Pilot readouts: the ring-cleared toast counts from the real objective list, the ring
// streak counts clears and misses, and the PAPI and glideslope agree with the autopilot.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, missionById } from '../game/src/missions/index.js';
import { startMission, stepMission } from '../game/src/missions/missionRunner.js';
import { ringClearedText } from '../game/src/hud/flightHud.js';
import { approachTo, currentApproach, papiWhite, papiLights, slopeWord, ON_SLOPE_DEG, GLIDE_DEG, aimPoint, fieldElevation } from '../game/src/flight/glidepath.js';
import { readFileSync } from 'node:fs';
import { RUNWAYS } from '../game/src/terrain/islandLayout.js';
import { flyMissionWithBot } from './botPilot.mjs';

test('ring toast reads n/m from the objective list', () => {
  const ms = startMission(missionById('buoySlalom'));
  const rings = ms.objectives.filter((o) => o.kind === 'ring');
  assert.equal(ringClearedText(ms, rings[0]), 'RING 1/6 CLEARED');
  assert.equal(ringClearedText(ms, rings[5]), 'RING 6/6 CLEARED');
});

// put the aircraft `along` metres past ring o's plane and `off` metres right of its centre
function placeAt(ms, o, along, off) {
  const a = (o.hdg * Math.PI) / 180;
  ms.ac.pos.x = o.x + Math.sin(a) * along + Math.cos(a) * off;
  ms.ac.pos.y = o.y;
  ms.ac.pos.z = o.z - Math.cos(a) * along + Math.sin(a) * off;
}

test('a ring miss is a pass through its plane outside the radius, once per pass', () => {
  const ms = startMission(missionById('ringCourse'));
  const o = ms.objectives[0];
  ms.index = 0;
  ms.score.ringStreak = 3;
  let lines = 0;
  const say = ms.say;
  ms.say = (evt, d) => { if (evt === 'ringMiss') lines += 1; say(evt, d); };
  // starting close to the ring, inside the old bubble, and leaving it is no miss
  placeAt(ms, o, -o.r * 2, o.r * 1.5); stepMission(ms);
  placeAt(ms, o, -o.r * 8, o.r * 1.5); stepMission(ms);
  assert.equal(ms.score.ringMisses, 0);
  // passing beside it, through the plane but outside the radius: one miss, one radio line
  placeAt(ms, o, -o.r, o.r * 2); stepMission(ms);
  placeAt(ms, o, o.r, o.r * 2); stepMission(ms);
  placeAt(ms, o, o.r * 3, o.r * 2); stepMission(ms);
  assert.equal(ms.score.ringMisses, 1);
  assert.equal(ms.score.ringStreak, 0);
  assert.equal(ms.index, 0);
  assert.equal(lines, 1);
  // crossing the plane far from the ring is no pass at all
  placeAt(ms, o, -o.r, o.r * 20); stepMission(ms);
  placeAt(ms, o, o.r, o.r * 20); stepMission(ms);
  assert.equal(ms.score.ringMisses, 1);
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

test('one PAPI rule: the 3D bar and the HUD both light from papiLights', () => {
  assert.deepEqual(papiLights(0), [true, true, false, false]);
  assert.deepEqual(papiLights(2), [true, true, true, true]);
  assert.deepEqual(papiLights(-2), [false, false, false, false]);
  assert.equal(slopeWord(ON_SLOPE_DEG / 2), 'ON');
  assert.equal(slopeWord(ON_SLOPE_DEG * 2), 'HIGH');
  for (const f of ['game/src/render/missionMarkers.js', 'game/src/hud/flightHud.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.ok(src.includes('papiLights('), `${f} lights from papiLights`);
    assert.ok(!src.includes('papiWhite('), `${f} keeps no second rule`);
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
    if (ap && ap.beforeAim > 400 && ap.beforeAim < 1500 && ms.ap.flare === false) devs.push(ap.dev);
  }
  assert.equal(ms.status, 'done');
  assert.ok(devs.length > 60, 'saw the final approach');
  const mean = devs.reduce((s, v) => s + v, 0) / devs.length;
  assert.ok(Math.abs(mean) < 1, `mean deviation ${mean.toFixed(2)}°`);
});
