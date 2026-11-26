// What the flight model asks of the world: wind, the surface under the floats, ground
// height, which water lane a touchdown is in, and the name of the place for crash words.

import { ISLANDS, RUNWAYS, runwayFrame } from '../terrain/islandLayout.js';
import { groundHeight, surfaceAt } from '../terrain/heightmap.js';
import { makeWindField } from './windField.js';

const LANES = Object.values(RUNWAYS).filter((r) => r.kind === 'lane');

export function laneAt(x, z) {
  for (const ln of LANES) {
    const fr = runwayFrame(ln, x, z);
    if (Math.abs(fr.along) <= ln.length / 2 + 60 && Math.abs(fr.across) <= ln.width / 2 + 30) return ln;
  }
  return null;
}

export function placeName(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z) / isl.r;
    if (d < bestD) { bestD = d; best = isl; }
  }
  if (!best || bestD > 1.3) return 'the sea';
  if (best.shape === 'volcano') return 'the slopes of Mount Cinder';
  return `the hills of ${best.name}`;
}

export function makeFlightEnv(weatherId = 'calm', windFrom = 270, seed = 1) {
  return { wind: makeWindField(weatherId, windFrom, seed), surfaceAt, groundHeight, laneAt, placeName };
}
