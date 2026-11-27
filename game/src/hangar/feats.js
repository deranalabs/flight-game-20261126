// Feats: medals for flying well, each with an icon and a counter kept in the career. A
// feat is earned at the end of a sortie from what the sortie recorded (landings, rings,
// drops, the live-call counters) and what the career stands at.

const done = (x) => x.ms.status === 'done';
const landings = (x) => x.ms.score.landings;
const best = (x) => landings(x).reduce((b, l) => (!b || l.points > b.points ? l : b), null);
const rings = (x) => x.ms.objectives.filter((o) => o.kind === 'ring').length;
const drops = (x) => x.ms.objectives.filter((o) => o.kind === 'drop' || o.kind === 'fire').length;
const is = (id) => (x) => done(x) && x.ms.def.id === id;

export const FEATS = [
  { id: 'feather', name: 'Feather', icon: '◒', blurb: 'land under 120 ft/min', test: (x) => landings(x).some((l) => l.fpm < 120) },
  { id: 'greaser', name: 'Greaser', icon: '◓', blurb: 'land under 60 ft/min', test: (x) => landings(x).some((l) => l.fpm < 60) },
  { id: 'perfectFlare', name: 'Perfect Flare', icon: '◆', blurb: 'an A touchdown on the centreline', test: (x) => landings(x).some((l) => l.letter === 'A' && (l.across ?? 0) < 2) },
  { id: 'centreline', name: 'Centreline', icon: '┃', blurb: 'touch down within 1 m of the line', test: (x) => landings(x).some((l) => l.across !== null && l.across < 1) },
  { id: 'noBounce', name: 'Stuck It', icon: '▁', blurb: 'every landing with no bounce', test: (x) => done(x) && landings(x).length > 0 && landings(x).every((l) => l.bounces === 0) },
  { id: 'cleanSheet', name: 'Clean Sheet', icon: '✚', blurb: 'a sortie with no damage', test: (x) => done(x) && x.result.damageTaken === 0 },
  { id: 'streak5', name: 'On Rails x5', icon: '◎', blurb: 'five rings in a row', test: (x) => x.ms.score.bestStreak >= 5 },
  { id: 'fullCourse', name: 'Full Course', icon: '⦿', blurb: 'every ring, no miss', test: (x) => done(x) && rings(x) > 0 && x.ms.score.ringMisses === 0 },
  { id: 'cleanTurns', name: 'Coordinated', icon: '↻', blurb: 'ten clean turns in one sortie', test: (x) => (x.ms.calls?.cleanTurns ?? 0) >= 10 },
  { id: 'speedBand', name: 'Held The Band', icon: '═', blurb: 'hold the 85 kt band', test: (x) => (x.ms.calls?.bandAwards ?? 0) >= 1 },
  { id: 'onSlope', name: 'True Slope', icon: '⟋', blurb: '20 s on the glide slope', test: (x) => (x.ms.calls?.onSlopeT ?? 0) >= 20 },
  { id: 'smooth', name: 'Steady Hands', icon: '≈', blurb: 'never past 1.8 g', test: (x) => done(x) && (x.ms.calls?.maxG ?? 1) < 1.8 },
  { id: 'underPar', name: 'Under Par', icon: '◷', blurb: 'beat the par time', test: (x) => done(x) && x.ms.t <= x.ms.def.parTime },
  { id: 'halfTank', name: 'Half Tank', icon: '▤', blurb: 'finish with half the fuel load', test: (x) => done(x) && x.ms.ac.fuel.litres >= x.ms.score.fuelStart * 0.5 },
  { id: 'gradeA', name: 'Grade A', icon: 'A', blurb: 'a sortie graded A', test: (x) => x.scored.grade === 'A' },
  { id: 'combo2', name: 'Combo x2', icon: '×2', blurb: 'reach a x2 combo', test: (x) => x.scored.mult >= 2 },
  { id: 'combo3', name: 'Combo x3', icon: '×3', blurb: 'reach the x3 cap', test: (x) => x.scored.mult >= 3 },
  { id: 'bullseye', name: 'Bullseye', icon: '⊕', blurb: 'every drop on target', test: (x) => done(x) && drops(x) > 0 && x.ms.score.misses === 0 },
  { id: 'firebreak', name: 'Firebreak', icon: '♨', blurb: 'all fires out', test: is('waterBomber') },
  { id: 'nightOwl', name: 'Night Owl', icon: '☾', blurb: 'fly the lantern run', test: is('lighthouseNight') },
  { id: 'stormCrosser', name: 'Storm Crosser', icon: '⚡', blurb: 'cross the squall line', test: is('stormCrossing') },
  { id: 'deadStick', name: 'Dead Stick', icon: '✈', blurb: 'glide home without the engine', test: is('engineOutGlide') },
  { id: 'samaritan', name: 'Samaritan', icon: '✚', blurb: 'medevac with no hard landing', test: (x) => is('medevac')(x) && landings(x).every((l) => l.fpm <= 450) },
  { id: 'surveyor', name: 'Surveyor', icon: '▣', blurb: 'photograph the Board\'s dock', test: is('dockSurvey') },
  { id: 'noteCleared', name: 'Note Cleared', icon: '$', blurb: 'pay the Board in full', test: (x) => x.debtLeft === 0 },
];

/** Feats earned at least once. */
export const featsEarned = (c) => FEATS.filter((f) => (c.feats?.[f.id] ?? 0) > 0).length;

/**
 * Award the feats a finished sortie earned. x: { ms, scored, result, debtLeft }.
 * Adds one to each feat's counter and returns the feats earned this sortie.
 */
export function awardFeats(c, x) {
  c.feats ??= {};
  const got = FEATS.filter((f) => f.test(x));
  for (const f of got) c.feats[f.id] = (c.feats[f.id] ?? 0) + 1;
  return got;
}
