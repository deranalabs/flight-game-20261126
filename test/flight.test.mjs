// Flight model checks: trimmed cruise holds height, full power climbs, idle descends,
// a full pull stalls, takeoffs leave the runway and the water, landings grade sensibly,
// hard arrivals crash with words that say what happened, fuel and damage change flying.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAircraft, stepAircraft, settleOnSurface } from '../game/src/flight/flightModel.js';
import { makeFlightEnv } from '../game/src/flight/flightEnv.js';
import { buildSpec, stallSpeed } from '../game/src/aircraft/ternSpec.js';
import { makeAutopilot, flyTakeoff } from '../game/src/flight/autopilot.js';
import { gradeLanding, classifyContact } from '../game/src/flight/landingJudge.js';
import { RUNWAYS } from '../game/src/terrain/islandLayout.js';
import { enduranceMinutes } from '../game/src/systems/fuelTank.js';
import { hurt } from '../game/src/systems/damageModel.js';

const env = makeFlightEnv('calm', 270, 1);
const spec = buildSpec([]);

function fly(ac, seconds, each) {
  for (let i = 0; i < seconds * 60; i++) { if (each) each(ac); stepAircraft(ac, env); }
  return ac;
}

test('stall speed is a bush plane\'s: about 40 to 50 kt, lower with flaps', () => {
  const clean = stallSpeed(spec, 1750) * 1.944;
  const flaps = stallSpeed(spec, 1750, 1) * 1.944;
  assert.ok(clean > 42 && clean < 52, `clean ${clean}`);
  assert.ok(flaps < clean - 4, `flaps ${flaps}`);
  assert.ok(stallSpeed(buildSpec(['stolFlaps']), 1750, 1) < stallSpeed(spec, 1750, 1));
});

test('cruise at 60% holds height, full power climbs, idle descends', () => {
  const cruise = fly(makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 0.6 }), 40);
  assert.ok(Math.abs(cruise.pos.y - 600) < 40, `cruise alt ${cruise.pos.y}`);
  const climb = fly(makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 1 }), 40);
  assert.ok(climb.pos.y > 700, `climb alt ${climb.pos.y}`);
  const idle = fly(makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 0 }), 40);
  assert.ok(idle.pos.y < 450, `idle alt ${idle.pos.y}`);
});

test('a full pull at idle stalls and the stall warning comes first', () => {
  const ac = makeAircraft(spec, { x: 0, y: 900, z: -8000, hdg: 90, speed: 40, throttle: 0 });
  let warned = false;
  let stalled = false;
  fly(ac, 12, (a) => { a.controls.elevator = 1; a.controls.throttle = 0; if (a.stallWarn) warned = true; if (a.stalled) stalled = true; });
  assert.ok(warned && stalled);
});

test('control authority grows with speed: the same aileron rolls faster when fast', () => {
  const rollAfter = (speed) => {
    const ac = makeAircraft(spec, { x: 0, y: 900, z: -8000, hdg: 90, speed, throttle: 0.5 });
    fly(ac, 0.8, (a) => { a.controls.aileron = 1; });
    return Math.abs(ac.bank);
  };
  assert.ok(rollAfter(55) > rollAfter(28) * 1.4);
});

test('takeoff from the runway and from the water', () => {
  for (const [id, hdg] of [['halyard', 0], ['halyardHarbour', 90]]) {
    const rw = RUNWAYS[id];
    const a = (hdg * Math.PI) / 180;
    const ac = makeAircraft(spec, { x: rw.x - Math.sin(a) * (rw.length / 2 - 60), y: 0, z: rw.z + Math.cos(a) * (rw.length / 2 - 60), hdg, speed: 0, onSurface: true, throttle: 1 });
    settleOnSurface(ac, env);
    const ap = makeAutopilot();
    fly(ac, 45, (x) => flyTakeoff(x, ap, hdg, 1 / 60));
    assert.ok(!ac.crashed, `${id}: ${ac.crashed?.reason}`);
    assert.ok(!ac.onSurface && ac.agl > 40, `${id} agl ${ac.agl}`);
  }
});

test('contacts: soft touchdown, hard landing damage, and crashes that say why', () => {
  assert.equal(classifyContact({ kind: 'runway', sink: 1, speed: 26, bank: 0, pitch: 4 }, spec).crash, false);
  const hard = classifyContact({ kind: 'water', sink: 3.6, speed: 26, bank: 0, pitch: 4 }, spec);
  assert.equal(hard.crash, false);
  assert.ok(hard.hard && hard.damage > 0);
  assert.match(classifyContact({ kind: 'water', sink: 7, speed: 30, bank: 0, pitch: 2 }, spec).reason, /Slammed into the water/);
  assert.match(classifyContact({ kind: 'water', sink: 1, speed: 30, bank: 32, pitch: 2 }, spec).reason, /wingtip/);
  assert.match(classifyContact({ kind: 'runway', sink: 1, speed: 30, bank: 0, pitch: -12 }, spec).reason, /nose-first/);
  assert.match(classifyContact({ kind: 'land', sink: 4, speed: 40, bank: 0, pitch: 0, placeName: 'the slopes of Mount Cinder' }, spec).reason, /Mount Cinder/);
});

test('landing grades reward sink rate, centreline and no bounce', () => {
  const great = gradeLanding({ fpm: 110, across: 0.5, bounces: 0, stoppedInside: true });
  const poor = gradeLanding({ fpm: 520, across: 9, bounces: 2, stoppedInside: false });
  assert.equal(great.letter, 'A');
  assert.ok(['D', 'F'].includes(poor.letter));
  assert.ok(poor.notes.includes('ran off the end'));
});

test('fuel burns faster at full throttle, and an empty tank stops the engine', () => {
  const ac = makeAircraft(spec, { x: 0, y: 900, z: -8000, hdg: 90, speed: 45, throttle: 1, fuel: 0.01 });
  fly(ac, 1);
  const fullMin = enduranceMinutes(ac.fuel, spec);
  ac.controls.throttle = 0.4;
  fly(ac, 1);
  assert.ok(enduranceMinutes(ac.fuel, spec) > fullMin);
  fly(ac, 120);
  assert.equal(ac.engine.running, false);
  assert.equal(ac.engine.failed, 'fuel');
});

test('a hurt engine gives less thrust and bent controls roll her', () => {
  const healthy = fly(makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 1 }), 20);
  const sick = makeAircraft(spec, { x: 0, y: 600, z: -8000, hdg: 90, speed: 45, throttle: 1 });
  hurt(sick.damage, 'engine', 70, 'test');
  hurt(sick.damage, 'controls', 80, 'test');
  fly(sick, 20);
  assert.ok(sick.pos.y < healthy.pos.y - 30, `sick ${sick.pos.y} healthy ${healthy.pos.y}`);
  assert.ok(Math.abs(sick.bank) > Math.abs(healthy.bank) + 1);
});
