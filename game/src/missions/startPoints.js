// Where a sortie begins: lined up on a runway or lane end, or already in the air.

import { RUNWAYS } from '../terrain/islandLayout.js';
import { groundHeight } from '../terrain/heightmap.js';

/** Parked at the start of a runway or lane, facing hdg (one of its two directions). */
export function lineUp(rwId, hdg, throttle = 0) {
  const rw = RUNWAYS[rwId];
  const a = (hdg * Math.PI) / 180;
  const back = rw.length / 2 - (rw.kind === 'lane' ? 120 : 35);
  return { x: rw.x - Math.sin(a) * back, y: 0, z: rw.z + Math.cos(a) * back, hdg, speed: 0, throttle, onSurface: true, flaps: 0.5 };
}

/** Already flying at some height above the ground or sea. */
export function inFlight(x, z, agl, hdg, speed = 44, throttle = 0.6) {
  return { x, y: Math.max(0, groundHeight(x, z)) + agl, z, hdg, speed, throttle, onSurface: false, flaps: 0 };
}
