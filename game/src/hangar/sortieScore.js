// Sortie score and combo. A finished sortie is scored from four lines (objectives,
// touchdown, time against par, fuel left) out of 1000 and graded A to F. A run of
// sorties graded B or better builds a combo multiplier; a crash or a grade below B ends
// the run. The career keeps the total, the best score per sortie and the combo.

import { MS_TO_KT } from '../flight/landingJudge.js';

export const MAX = { objectives: 200, touchdown: 400, time: 250, fuel: 150 };
const COMBO_STEP = 0.5;
const COMBO_CAP = 3;

/** Multiplier earned by the n-th sortie in a run of B-or-better grades. */
export const comboMultiplier = (n) => Math.min(COMBO_CAP, 1 + COMBO_STEP * Math.max(0, n - 1));

export function gradeOf(points, crashed = false) {
  if (crashed) return 'F';
  return points >= 850 ? 'A' : points >= 700 ? 'B' : points >= 500 ? 'C' : points >= 300 ? 'D' : 'F';
}

/**
 * Score a sortie from its mission state, while flying (live) or once it ended.
 * combo: the career's current run length. Returns { lines, base, grade, run, mult, total }.
 */
export function scoreSortie(ms, combo = 0) {
  const done = ms.status === 'done';
  const sc = ms.score;
  const n = ms.objectives.length || 1;
  const landings = sc.landings;
  const land = landings.length ? landings.reduce((s, l) => s + l.points, 0) / landings.length : null;
  const best = landings.reduce((b, l) => (!b || l.points > b.points ? l : b), null);
  const par = ms.def.parTime;
  const T = ms.t + (ms.extra?.timeAdd ?? 0);
  const fuelFrac = sc.fuelStart > 0 ? Math.min(1, ms.ac.fuel.litres / sc.fuelStart) : 0;
  const lines = [
    { key: 'objectives', label: `Objectives ${Math.min(ms.index, n)}/${n}`, pts: Math.round(MAX.objectives * Math.min(ms.index, n) / n) },
    { key: 'touchdown', label: best ? `Touchdown ${best.fpm} ft/min · ${best.across ?? '-'} m off · ${best.bounces} bounce${best.bounces === 1 ? '' : 's'}` : 'Touchdown: none yet', pts: land === null ? 0 : Math.round(MAX.touchdown * land / 100) },
    // time and fuel count only once the job is done, so a crash cannot bank them
    // a divert or a field repair adds its minutes to the clock
    { key: 'time', label: `Time ${fmt(T)} against par ${fmt(par)}`, pts: done ? Math.round(MAX.time * Math.max(0, Math.min(1, 2 - T / par))) : 0 },
    { key: 'fuel', label: `Fuel left ${Math.round(fuelFrac * 100)}% of the load`, pts: done ? Math.round(MAX.fuel * fuelFrac) : 0 },
  ];
  const base = lines.reduce((s, l) => s + l.pts, 0);
  const crashed = !!ms.ac.crashed;
  const grade = done ? gradeOf(base) : 'F';
  const good = grade === 'A' || grade === 'B';
  const run = good ? combo + 1 : 0;
  const mult = good ? comboMultiplier(run) : 1;
  return { lines, base, grade, crashed, run, mult, total: done ? Math.round(base * mult) : base, done };
}

/** What the next B-or-better sortie would earn: shown live in the HUD. */
export const nextMultiplier = (combo) => comboMultiplier(combo + 1);

/** One line on what to improve: the weakest line against its maximum. */
export function improveTip(s) {
  if (s.crashed) return 'Stay alive first: a crash zeroes time and fuel and ends the combo.';
  if (!s.done) return 'Finish the job: time and fuel only count on a completed sortie.';
  const weakest = s.lines.reduce((w, l) => (l.pts / MAX[l.key] < w.pts / MAX[w.key] ? l : w));
  if (weakest.pts / MAX[weakest.key] > 0.92) return 'Clean flying. Keep the run going for a bigger combo.';
  return {
    objectives: 'Clear every objective in order.',
    touchdown: 'Touch down softer: flaps out, power back, hold the nose up and aim for under 150 ft/min on the centreline.',
    time: 'Fly a tighter line: head straight for each target and skip the wide loops to beat par.',
    fuel: 'Save fuel: cruise at lower throttle and climb only as high as the job needs.',
  }[weakest.key];
}

/** Book a scored sortie into the career: total, best per sortie and the combo run. */
export function recordScore(c, id, s) {
  const sc = c.score;
  sc.total += s.total;
  sc.best[id] = Math.max(sc.best[id] ?? 0, s.total);
  sc.combo = s.run;
  sc.bestCombo = Math.max(sc.bestCombo, s.run);
  return sc;
}

/** Altitude (ft), airspeed (kt), fuel (% of tank) and load factor (g) once a second, for the flight recorder. */
export function traceSample(ac) {
  return [Math.round(ac.pos.y * 3.28084), Math.round(ac.ias * MS_TO_KT), Math.round((ac.fuel.litres / ac.fuel.capacity) * 100), Math.round(ac.g * 100) / 100];
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
