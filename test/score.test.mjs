// Score, combo and the Harbour Board debt: grades from the four score lines, the combo
// grows on B-or-better runs and resets on a crash, the career keeps totals and bests,
// the Board is paid from completed sorties, and the bot's sorties clear the debt.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSortie, recordScore, comboMultiplier, gradeOf, improveTip, MAX } from '../game/src/hangar/sortieScore.js';
import { DEBT, debtLeft, payDebt, chapterFor, settleSortie, standing } from '../game/src/hangar/harbourDebt.js';
import { newCareer, recordFlight } from '../game/src/hangar/careerSave.js';
import { missionResult } from '../game/src/missions/missionRunner.js';
import { MISSIONS } from '../game/src/missions/index.js';
import { flyMissionWithBot } from './botPilot.mjs';

// a finished sortie as the runner leaves it, with only what the score reads
const fake = ({ status = 'done', t = 300, par = 360, fpm = 120, across = 0.5, points = 100, bounces = 0, fuel = 0.8, crashed = false } = {}) => ({
  status, t, index: status === 'done' ? 3 : 1, objectives: [{}, {}, {}],
  def: { parTime: par },
  ac: { crashed, fuel: { litres: 100 * fuel } },
  score: { fuelStart: 100, landings: status === 'done' ? [{ fpm, across, bounces, points }] : [] },
});

test('a clean sortie grades A, a slow hard one lower, a crash F', () => {
  const clean = scoreSortie(fake());
  assert.equal(clean.base, MAX.objectives + MAX.touchdown + MAX.time + 120);
  assert.equal(clean.grade, 'A');
  const rough = scoreSortie(fake({ t: 600, points: 40, fuel: 0.2 }));
  assert.ok(rough.base < clean.base && ['C', 'D'].includes(rough.grade), `${rough.grade} ${rough.base}`);
  const crash = scoreSortie(fake({ status: 'failed', crashed: true }));
  assert.equal(crash.grade, 'F');
  assert.equal(crash.lines.find((l) => l.key === 'time').pts, 0);
  assert.match(improveTip(crash), /crash/);
  assert.equal(gradeOf(990, true), 'F');
});

test('the combo grows on B-or-better runs, caps, and a crash resets it', () => {
  const c = newCareer();
  const seen = [];
  for (let i = 0; i < 4; i++) { const s = scoreSortie(fake(), c.score.combo); recordScore(c, 'x', s); seen.push(s.mult); }
  assert.deepEqual(seen, [1, 1.5, 2, 2.5]);
  assert.equal(c.score.combo, 4);
  const crash = scoreSortie(fake({ status: 'failed', crashed: true }), c.score.combo);
  recordScore(c, 'x', crash);
  assert.equal(c.score.combo, 0);
  assert.equal(c.score.bestCombo, 4);
  assert.equal(comboMultiplier(40), 3);
  const one = scoreSortie(fake(), 0);
  assert.equal(c.score.best.x, Math.round(one.base * 2.5));
});

test('the Board takes completed sorties only and never past the debt; chapters follow the board', () => {
  const c = newCareer();
  assert.equal(debtLeft(c), DEBT);
  assert.equal(payDebt(c, { done: false, total: 500 }), 0);
  assert.equal(payDebt(c, { done: true, total: 900 }), 900);
  c.debtPaid = DEBT - 10;
  assert.equal(payDebt(c, { done: true, total: 900 }), 10);
  assert.equal(debtLeft(c), 0);
  assert.deepEqual([1, 2, 3, 6, 7, 9, 10].map((n) => chapterFor(n, 10).no), [1, 1, 2, 2, 3, 3, 4]);
});

test('the bot flies every sortie for the Board and clears the debt', () => {
  const c = newCareer();
  const grades = [];
  for (const def of MISSIONS) {
    const { ms } = flyMissionWithBot(def) // a healthy Tern each time, as after Teodor's repairs;
    assert.equal(ms.status, 'done', def.id);
    assert.ok(ms.trace.length > 30, 'the chart needs a trace');
    const s = scoreSortie(ms, c.score.combo);
    recordFlight(c, missionResult(ms), ms.ac, def.client);
    recordScore(c, def.id, s);
    settleSortie(c, def, s, MISSIONS.length);
    grades.push(`${def.order}:${s.grade}${s.base}x${s.mult}`);
  }
  console.log(grades.join(' '), 'total', c.score.total, 'left', debtLeft(c));
  assert.equal(debtLeft(c), 0);
  assert.equal(standing(c).word, 'PAID');
  assert.equal(c.feeCharged, true, 'the Board raised its fee on the way');
});
