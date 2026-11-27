// The career and hangar: a flight pays and bills fuel, damage carries into the hangar,
// repairs and upgrades cost shillings, missions unlock in order, ratings follow stars,
// and a store that throws still gives a playable career.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCareer, loadCareer, saveCareer, recordFlight, repairAll, repairPart, buyUpgrade,
  isUnlocked, totalStars, pilotRating, FUEL_PRICE,
} from '../game/src/hangar/careerSave.js';
import { repairCost } from '../game/src/systems/damageModel.js';
import { MISSIONS } from '../game/src/missions/index.js';

const flown = (over = {}) => ({
  id: MISSIONS[0].id, title: MISSIONS[0].title, done: true, stars: 3, pay: 600, time: 300,
  landing: 'A', landings: [], notes: ['inside par'], damageTaken: 0, fuelUsed: 40, crashed: false, reason: null, ...over,
});
const healthyAc = { damage: { engine: 100, airframe: 100, floats: 90, controls: 100 } };

test('a flight pays, bills fuel, writes the logbook and unlocks the next mission', () => {
  const c = newCareer();
  assert.equal(isUnlocked(c, 1), false);
  const { fuelBill } = recordFlight(c, flown(), healthyAc, 'wren');
  assert.equal(fuelBill, Math.round(40 * FUEL_PRICE));
  assert.equal(c.cash, 600 + 600 - fuelBill);
  assert.equal(c.logbook[0].title, MISSIONS[0].title);
  assert.equal(c.damage.floats, 90);
  assert.equal(isUnlocked(c, 1), true);
  assert.equal(totalStars(c), 3);
  assert.equal(c.trust.wren, 2);
});

test('a crash leaves the Tern badly hurt and pays nothing', () => {
  const c = newCareer();
  recordFlight(c, flown({ done: false, stars: 0, pay: 0, crashed: true, reason: 'Slammed into the water' }), healthyAc, 'wren');
  assert.ok(c.damage.engine <= 35 && c.damage.floats <= 35);
  assert.equal(isUnlocked(c, 1), false);
  assert.equal(c.logbook[0].note, 'Slammed into the water');
});

test('repairs and upgrades cost what the hangar says, and never go into debt', () => {
  const c = newCareer();
  c.damage.engine = 60;
  const cost = repairCost(c.damage);
  c.cash = cost - 1;
  assert.equal(repairAll(c), false);
  c.cash = cost + 1000;
  assert.equal(repairPart(c, 'engine'), true);
  assert.equal(c.damage.engine, 100);
  assert.equal(c.cash, 1000); // only the engine was hurt, so its fix is the whole bill
  assert.equal(buyUpgrade(c, 'nightKit'), true);
  assert.equal(buyUpgrade(c, 'nightKit'), false);
  assert.equal(buyUpgrade(c, 'bigProp'), false); // 1400 sh, only 500 left
});

test('ratings climb with stars', () => {
  const c = newCareer();
  assert.equal(pilotRating(c), 'Cadet Pilot');
  MISSIONS.forEach((m) => { c.missions[m.id] = { stars: 3 }; });
  assert.equal(pilotRating(c), 'Tidewing Ace');
});

test('save and load round-trip, and a broken store starts fresh', () => {
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const c = newCareer();
  c.cash = 1234;
  saveCareer(c, store);
  assert.equal(loadCareer(store).cash, 1234);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadCareer(broken).cash, newCareer().cash);
  saveCareer(c, broken);
});

test('the board holds ten sorties and the unlock chain reaches sortie 10', () => {
  assert.equal(MISSIONS.length, 10);
  assert.deepEqual(MISSIONS.map((m) => m.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const c = newCareer();
  MISSIONS.forEach((m, i) => {
    assert.equal(isUnlocked(c, i), true, `sortie ${m.order} should be open`);
    if (i + 1 < MISSIONS.length) assert.equal(isUnlocked(c, i + 1), false);
    recordFlight(c, flown({ id: m.id, title: m.title }), healthyAc, m.client);
  });
  assert.equal(totalStars(c), 30);
});
