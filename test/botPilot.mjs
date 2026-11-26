// Test helper: the autopilot flies a whole mission headless and reports how it went.

import { startMission, stepMission, missionResult, currentObjective } from '../game/src/missions/missionRunner.js';

export function flyMissionWithBot(def, { maxSeconds = 1500, career = {}, trace = false } = {}) {
  const ms = startMission(def, career, 1);
  const steps = Math.round(maxSeconds * 60);
  const log = [];
  let lastIndex = -1;
  for (let i = 0; i < steps && ms.status === 'flying'; i++) {
    stepMission(ms, {}, { bot: true });
    if (ms.index !== lastIndex) {
      lastIndex = ms.index;
      const o = currentObjective(ms);
      log.push(`${ms.t.toFixed(0)}s -> ${o ? o.label(ms) : 'done'}`);
    }
    if (trace && i % 300 === 0) {
      const a = ms.ac;
      log.push(`  t${ms.t.toFixed(0)} pos ${a.pos.x.toFixed(0)},${a.pos.y.toFixed(0)},${a.pos.z.toFixed(0)} ias ${a.ias.toFixed(0)} hdg ${a.hdg.toFixed(0)} fuel ${a.fuel.litres.toFixed(0)} ph ${ms.ap.phase ?? ''}`);
    }
  }
  if (ms.status === 'flying') ms.fail('bot ran out of time');
  return { ms, result: missionResult(ms), log };
}
