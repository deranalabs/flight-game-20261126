// Shot mode (?shot=<name>&seed=<n>): plays the game's own missions with the autopilot up
// to a chosen moment and freezes there, so the screenshots are real frames of real play.
//   cover   - Cinder Ring Trial, chase view, about to fly ring 8 with runway 09 beyond
//   cockpit - Tallow Ridge Fire, cockpit view, low run-in on a burning slope
//   night   - Gannet Point Lantern, chase view, the cove flare gate at night
//   hangar  - the hangar screens after the autopilot has flown the first five missions

import { missionById, MISSIONS } from '../missions/index.js';
import { startMission, stepMission, currentObjective, missionResult } from '../missions/missionRunner.js';
import { newCareer, recordFlight, buyUpgrade, repairAll } from '../hangar/careerSave.js';

function runUntil(ms, pred, maxSeconds = 1500) {
  for (let i = 0; i < maxSeconds * 60 && ms.status === 'flying'; i++) {
    stepMission(ms, {}, { bot: true });
    if (pred(ms)) return true;
  }
  return false;
}

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
    return { ms, view: 'chase', camera: { distance: 19, height: 7.5, side: 4, lookAhead: 40, lookDown: -10, fov: 64 } };
  },
  cockpit() {
    const ms = startMission(missionById('waterBomber'), {}, 1);
    runUntil(ms, (m) => {
      const o = currentObjective(m);
      return o && o.kind === 'fire' && o.bot && o.bot.phase === 'pass' && m.ac.waterKg > 700 && distTo(m, o.fire.x, o.fire.z) < 520;
    });
    return { ms, view: 'cockpit' };
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
    const career = newCareer();
    for (const def of MISSIONS.slice(0, 5)) {
      const ms = startMission(def, career, 1);
      runUntil(ms, () => false, 1800);
      const r = missionResult(ms);
      recordFlight(career, r, ms.ac, def.client);
      if (def.order === 3) buyUpgrade(career, 'nightKit');
      if (def.order < 5) repairAll(career);
    }
    // a scrape on the floats from the last job, waiting for Teodor
    career.damage.floats = Math.min(career.damage.floats, 82);
    return { career, view: 'hangar', selected: MISSIONS[5].id };
  },
};

export function readShotRequest(search = globalThis.location ? location.search : '') {
  const p = new URLSearchParams(search);
  const name = p.get('shot');
  if (!name || !SHOTS[name]) return null;
  return { name, seed: Number(p.get('seed') ?? 1) };
}
