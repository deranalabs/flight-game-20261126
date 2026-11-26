// The career's mission board: eight sorties, each its own file, in career order.

import mailRun from './mailRun.js';
import ringCourse from './ringCourse.js';
import medevac from './medevac.js';
import shortStrip from './shortStrip.js';
import waterBomber from './waterBomber.js';
import lighthouseNight from './lighthouseNight.js';
import stormCrossing from './stormCrossing.js';
import engineOutGlide from './engineOutGlide.js';

export const MISSIONS = [mailRun, ringCourse, medevac, shortStrip, waterBomber, lighthouseNight, stormCrossing, engineOutGlide];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}
