// Shot mode (?shot=<name>&seed=<n>): plays the game's own missions with the autopilot up
// to a chosen moment and freezes there, so the screenshots are real frames of real play.
// Every shot that shows score, combo or the Harbour Board note first has the autopilot
// fly the sorties before it, so those numbers are the bot's real career.
//   cover   - Cinder Ring Trial at dusk, chase view, about to fly ring 8 with the runway beyond
//   fire    - Tallow Ridge Fire, chase view, the second fire just knocked out, drop meter
//   final   - Saltmoor Medevac, chase view, short final with the approach callouts, in day light
//   receipt - the stamped receipt after the bot's Harbour Board Survey
//   cockpit - Tallow Ridge Fire, cockpit view, low run-in on a burning slope, live score and combo
//   debrief - the debrief after the bot's sortie 4 (Ridge strip), grade, lines and flight chart
//   mail    - Morning Mail Run, chase view, short final onto the Saltmoor water lane
//   hangar  - the hangar board after the autopilot has flown the first seven sorties

import { missionById, MISSIONS } from '../missions/index.js';
import { startMission, stepMission, currentObjective, missionResult } from '../missions/missionRunner.js';
import { newCareer, recordFlight, repairAll } from '../hangar/careerSave.js';
import { scoreSortie, recordScore } from '../hangar/sortieScore.js';
import { settleSortie, debtLeft } from '../hangar/harbourDebt.js';
import { awardFeats } from '../hangar/feats.js';
import { fitRefit, refitOffer } from '../hangar/refits.js';
import { contractFor, objectiveHeadline } from '../story/storyline.js';
import { TOKENS } from '../identity/palette.js';

function runUntil(ms, pred, maxSeconds = 1500) {
  for (let i = 0; i < maxSeconds * 60 && ms.status === 'flying'; i++) {
    stepMission(ms, {}, { bot: true });
    if (pred(ms)) return true;
  }
  return false;
}

/** The bot flies the first n sorties in a healthy Tern and books flights, score and debt. */
function flyCareer(n) {
  const career = newCareer();
  let last = null;
  for (const def of MISSIONS.slice(0, n)) {
    const ms = startMission(def, { upgrades: career.upgrades }, 1);
    runUntil(ms, () => false, 1800);
    const scored = scoreSortie(ms, career.score.combo);
    const result = missionResult(ms);
    const { fuelBill } = recordFlight(career, result, ms.ac, def.client);
    recordScore(career, def.id, scored);
    const settled = settleSortie(career, def, scored, MISSIONS.length);
    const feats = awardFeats(career, { ms, scored, result, debtLeft: debtLeft(career) });
    const refits = refitOffer(career);
    // the pilot's refits: the night kit before the lantern run, then the first card dealt
    if (def.order === 3) fitRefit(career, 'nightKit');
    if (def.order === 5 || def.order === 8) fitRefit(career, refits[0].id);
    repairAll(career);
    last = { ms, result, fuelBill, extra: { scored, debtPaid: settled.total, settled, trace: ms.trace, career, feats, refits: refitOffer(career), contract: contractFor(def.id), last: def.order === MISSIONS.length } };
  }
  return { career, last };
}

// the low chase camera shared by the cover and the mail shot
const LOW_CHASE = { distance: 21, height: 5, side: -6, lookAhead: 40, fov: 64 };

const distTo = (ms, x, z) => Math.hypot(ms.ac.pos.x - x, ms.ac.pos.z - z);

export const SHOTS = {
  cover() {
    const ms = startMission(missionById('ringCourse'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      // lined up on the ring with runway 09 beyond it
      const off = Math.abs(((m.ac.hdg - o.hdg + 540) % 360) - 180);
      return m.index === 7 && o && distTo(m, o.x, o.z) < 330 && off < 10 && Math.abs(m.ac.bank) < 8;
    });
    // the same moment at dusk, the sunset sky behind the volcano
    ms.def = { ...ms.def, timeOfDay: 'dusk' };
    // t: frozen between two flashes of the fin strobe, which shows from dusk on
    return { ms, career: flyCareer(1).career, view: 'chase', t: 0.6, camera: { ...LOW_CHASE, lookDown: -10 } };
  },
  cockpit() {
    const ms = startMission(missionById('waterBomber'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return o && o.kind === 'fire' && o.bot && o.bot.phase === 'pass' && m.ac.waterKg > 700 && distTo(m, o.fire.x, o.fire.z) < 520;
    });
    return { ms, career: flyCareer(4).career, view: 'cockpit' };
  },
  debrief() {
    const { career, last } = flyCareer(4);
    return { ...last, career, view: 'debrief' };
  },
  fire() {
    const ms = startMission(missionById('waterBomber'), {}, 1);
    const fires = ms.objectives.filter((o) => o.kind === 'fire');
    // the run-in on the last fire, tank full, the drop cue up
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return o === fires[2] && o.bot && o.bot.phase === 'pass' && m.ac.waterKg > 700 && distTo(m, o.fire.x, o.fire.z) < 330;
    });
    return { ms, career: flyCareer(4).career, view: 'chase', camera: { distance: 26, height: 9, side: -5, lookAhead: 60, lookDown: -14, fov: 62 } };
  },
  final() {
    const ms = startMission(missionById('medevac'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return o && o.kind === 'land' && m.ac.agl * 3.28084 < 260 && m.ac.agl > 30 && distTo(m, o.rw.x, o.rw.z) < 1400;
    });
    // the same moment in day light, so water, lane and Tern read in a small cell (the sortie flies at dusk)
    ms.def = { ...ms.def, timeOfDay: 'day' };
    return { ms, career: flyCareer(2).career, view: 'chase', camera: { ...LOW_CHASE, lookDown: -8 } };
  },
  receipt() {
    const { career, last } = flyCareer(MISSIONS.findIndex((m) => m.id === 'dockSurvey') + 1);
    return { ...last, career, view: 'debrief' };
  },
  mail() {
    const ms = startMission(missionById('mailRun'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return m.index === 3 && o && o.bot && o.bot.phase === 'final' && distTo(m, o.rw.x, o.rw.z) < 1300;
    });
    return { ms, view: 'chase', camera: { ...LOW_CHASE, lookDown: -9 } };
  },
  night() {
    const ms = startMission(missionById('lighthouseNight'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return m.index === 3 && o && distTo(m, o.x, o.z) < 420;
    });
    return { ms, view: 'chase', landingLight: true, camera: { distance: 17, height: 4 } };
  },
  hangar() {
    const { career } = flyCareer(7);
    // a scrape on the floats from the last job, waiting for Teodor
    career.damage.floats = Math.min(career.damage.floats, 82);
    return { career, view: 'hangar', selected: MISSIONS[7].id };
  },
};

export function readShotRequest(search = globalThis.location ? location.search : '') {
  const p = new URLSearchParams(search);
  const name = p.get('shot');
  if (!name || !SHOTS[name]) return null;
  return { name, seed: Number(p.get('seed') ?? 1) };
}
