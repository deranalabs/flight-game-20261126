// Every mission on the board can be completed: the autopilot flies each one headless,
// start to finish, without crashing, and the result earns at least one star.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../game/src/missions/index.js';
import { flyMissionWithBot } from './botPilot.mjs';

for (const def of MISSIONS) {
  test(`bot completes mission ${def.order}: ${def.title}`, () => {
    const { ms, result, log } = flyMissionWithBot(def, { maxSeconds: 1800 });
    assert.equal(ms.status, 'done', `${def.title} failed: ${ms.failReason}\n${log.join('\n')}`);
    assert.ok(result.stars >= 1);
    assert.ok(result.pay > 0);
    assert.equal(result.crashed, false);
  });
}
