// The story and the depth around it: counts come from the data, every sortie has a
// contract and a chapter, the three endings are reachable, the Board's fee and the squeeze
// choice move the debt, feats and refits award and charge, and the live calls read true.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../game/src/missions/index.js';
import { shipCounts, scopeLine } from '../game/src/story/counts.js';
import { CHAPTERS, CONTRACTS, MISSION_TYPES, chapterBounds, chapterOf, endingFor, CHOICE, DEBT, SQUEEZE_FEE, EXTENSION_LIMIT } from '../game/src/story/storyline.js';
import { GAZETTEER } from '../game/src/world/gazetteer.js';
import { PEOPLE, personState } from '../game/src/world/cast.js';
import { EVENTS, eventFor } from '../game/src/world/events.js';
import { FEATS, awardFeats, featsEarned } from '../game/src/hangar/feats.js';
import { REFITS, refitOffer, fitRefit, refitsFitted } from '../game/src/hangar/refits.js';
import { newCareer } from '../game/src/hangar/careerSave.js';
import { debtLeft, settleSortie, standing, squeezeSortie } from '../game/src/hangar/harbourDebt.js';
import { buildSpec } from '../game/src/aircraft/ternSpec.js';
import { callsFor, trackCalls } from '../game/src/feedback/liveCalls.js';
import { startMission, stepMission } from '../game/src/missions/missionRunner.js';

test('counts come from the data: sorties, four mission types, feats and refits', () => {
  const n = shipCounts(MISSIONS);
  assert.equal(n.sorties, MISSIONS.length);
  assert.equal(n.feats, FEATS.length);
  assert.ok(n.feats >= 24);
  assert.equal(n.refits, REFITS.length);
  assert.ok(n.refits >= 12);
  assert.equal(n.missionTypes, Object.keys(MISSION_TYPES).length);
  assert.equal(n.chapters, 4);
  assert.ok(n.islands >= 6);
  assert.equal(scopeLine(MISSIONS), `${n.sorties} SORTIES · ${n.missionTypes} MISSION TYPES · ${n.feats} FEATS · ${n.refits} REFITS`);
});

test('every sortie has a contract, a chapter, and the chapters run 1 to 4 in order', () => {
  for (const m of MISSIONS) assert.ok(CONTRACTS[m.id], m.id);
  const chapters = MISSIONS.map((m) => chapterOf(m.order, MISSIONS.length).no);
  assert.deepEqual([...new Set(chapters)], [1, 2, 3, 4]);
  assert.deepEqual(chapters, [...chapters].sort((a, b) => a - b));
  assert.equal(chapterOf(MISSIONS.length, MISSIONS.length).no, 4, 'the last sortie is the reckoning');
  for (const n of [4, 6, 10, 14]) {
    const b = chapterBounds(n);
    assert.equal(b[3], n);
    assert.ok(b[0] >= 1 && b[0] < b[1] && b[1] <= b[2]);
  }
  assert.equal(CHAPTERS.length, 4);
});

test('three endings by debt left: PAID, PART-PAID with an extension, UNPAID with a lien', () => {
  assert.equal(endingFor(0).word, 'PAID');
  assert.equal(endingFor(EXTENSION_LIMIT).word, 'PART-PAID');
  assert.equal(endingFor(EXTENSION_LIMIT + 1).word, 'UNPAID');
});

// a career flown with fixed sortie totals: each total reaches its own ending
function flyStory(total, choice) {
  const c = newCareer();
  if (choice) c.choice = choice;
  for (const def of MISSIONS) {
    c.missions[def.id] = { stars: 1, flown: 1 };
    settleSortie(c, def, { done: true, total, grade: 'B' }, MISSIONS.length);
  }
  return c;
}

test('the story reaches every ending and the fee and the choice move the debt', () => {
  const paid = flyStory(1400);
  assert.equal(standing(paid).word, 'PAID');
  assert.equal(paid.feeCharged, true);
  const part = flyStory(1100);
  assert.equal(standing(part).word, 'PART-PAID', `left ${debtLeft(part)}`);
  const unpaid = flyStory(600);
  assert.equal(standing(unpaid).word, 'UNPAID');
  const charter = flyStory(900, 'charter');
  const clinic = flyStory(900, 'clinic');
  const [a, b] = CHOICE.options;
  assert.equal(debtLeft(clinic) - debtLeft(charter), a.paid - b.paid, 'the choice changes the debt');
  assert.ok(clinic.trust.ilse > (charter.trust.ilse ?? 0));
  const ledgerSum = charter.ledger.reduce((s, e) => s + e.sh, 0);
  assert.equal(DEBT + ledgerSum, debtLeft(charter), 'the ledger adds up to what is owed');
  assert.ok(charter.ledger.some((e) => e.sh === SQUEEZE_FEE));
  assert.ok(squeezeSortie(MISSIONS.length) > 1);
});

test('the world: six islands, the cast with state, events tied to real sorties', () => {
  assert.ok(GAZETTEER.length >= 6);
  for (const i of GAZETTEER) for (const k of ['harbour', 'trade', 'landmark', 'custom', 'history']) assert.ok(i[k], `${i.id} ${k}`);
  assert.ok(Object.keys(PEOPLE).length >= 7);
  assert.notEqual(personState('ansel', 1).mood, personState('ansel', 4).mood);
  for (const e of EVENTS) assert.ok(MISSIONS.some((m) => m.id === e.mission), e.id);
  assert.equal(eventFor('nope'), null);
});

test('feats award once per sortie and count in the career', () => {
  const c = newCareer();
  const ms = startMission(MISSIONS[0], c);
  ms.status = 'done';
  ms.score.landings.push({ fpm: 50, across: 0.5, bounces: 0, letter: 'A', points: 98 });
  const got = awardFeats(c, { ms, scored: { grade: 'A', mult: 2 }, result: { damageTaken: 0 }, debtLeft: 100 });
  const ids = got.map((f) => f.id);
  for (const id of ['feather', 'greaser', 'perfectFlare', 'centreline', 'noBounce', 'cleanSheet', 'gradeA', 'combo2']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('noteCleared'));
  assert.equal(featsEarned(c), got.length);
  awardFeats(c, { ms, scored: { grade: 'A', mult: 2 }, result: { damageTaken: 0 }, debtLeft: 100 });
  assert.equal(c.feats.feather, 2);
  assert.equal(new Set(FEATS.map((f) => f.id)).size, FEATS.length, 'feat ids are unique');
});

test('refits deal three unfitted cards, change the spec and charge the note', () => {
  const c = newCareer();
  const offer = refitOffer(c);
  assert.equal(offer.length, 3);
  const before = debtLeft(c);
  assert.ok(fitRefit(c, offer[0].id));
  assert.equal(debtLeft(c), before + offer[0].cost);
  assert.equal(refitsFitted(c), 1);
  assert.ok(!refitOffer(c).some((r) => r.id === offer[0].id));
  assert.equal(fitRefit(c, offer[0].id), false);
  // every refit changes at least one number the model flies
  const base = buildSpec([]);
  for (const r of REFITS) {
    const s = buildSpec([r.id]);
    assert.ok(Object.keys(s).some((k) => s[k] !== base[k]), r.id);
  }
});

test('live calls: a clean banked turn, the streak, and a held speed band award', () => {
  const ms = startMission(MISSIONS[1]);
  ms.ac.onSurface = false;
  ms.ac.bank = 35; ms.ac.beta = 0;
  assert.match(callsFor(ms, null).map((c) => c.text).join('|'), /CLEAN TURN · 35° BANK · SLIP CENTERED/);
  for (let i = 0; i < 240; i++) trackCalls(ms, 1 / 60, null);
  ms.ac.bank = 0;
  trackCalls(ms, 1 / 60, null);
  assert.equal(ms.calls.cleanTurns, 1);
  ms.score.ringStreak = 8;
  assert.ok(callsFor(ms, null).some((c) => c.text === 'ON RAILS x8'));
  ms.ac.ias = 85 / 1.943844;
  for (let i = 0; i < 60 * 13; i++) trackCalls(ms, 1 / 60, null);
  assert.equal(ms.calls.bandAwards, 1);
  const ap = { dev: 0.1, word: 'ON', white: 2 };
  ms.ac.agl = 50;
  assert.match(callsFor(ms, ap)[0].text, /2 WHITE · ON SLOPE · MINIMUMS/);
  stepMission(ms);
});
