// Everything a mission file may use, handed to it by the runner (ms.kit and the build
// argument), so each mission file is only its own story, objectives and rules.

import { takeoff, ring, drop, land, landAny, holdStill, scoop, bombFire, reach, fillScoopTank } from './objectives.js';
import { lineUp, inFlight } from './startPoints.js';
import { VILLAGES, FIRE_SITES, LANDMARKS, RUNWAYS, runwayFrame } from '../terrain/islandLayout.js';
import { groundHeight } from '../terrain/heightmap.js';
import { hurt } from '../systems/damageModel.js';
import { refuel, enduranceMinutes } from '../systems/fuelTank.js';
import { killEngine } from '../systems/engine.js';
import { flyLanding, approachGate, flyTo } from '../flight/autopilot.js';
import { seededRandom } from '../util/noise.js';

export const KIT = {
  takeoff, ring, drop, land, landAny, holdStill, scoop, bombFire, reach, fillScoopTank,
  lineUp, inFlight,
  VILLAGES, FIRE_SITES, LANDMARKS, RUNWAYS, runwayFrame, groundHeight,
  hurt, refuel, enduranceMinutes, killEngine,
  flyLanding, approachGate, flyTo, seededRandom,
};
