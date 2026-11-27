// The approach path to a runway or lane: the same 4° slope and aim point the autopilot
// flies, so the PAPI lights, the glideslope ladder and the HUD agree with the bot.

import { runwayFrame } from '../terrain/islandLayout.js';
import { groundHeight } from '../terrain/heightmap.js';

export const GLIDE_DEG = 4;
const DEG = Math.PI / 180;
// PAPI: each of the four lights turns white above its own angle, two white on slope
const PAPI_STEPS = [-0.6, -0.2, 0.2, 0.6];

/** Metres past the threshold where the path meets the surface. */
export function aimPoint(rw) {
  return Math.min(rw.length * 0.22, 160);
}

/** Surface height of a field: lanes sit on the sea, runways on their ground pad. */
export function fieldElevation(rw) {
  return rw.kind === 'lane' ? 0 : Math.max(0, groundHeight(rw.x, rw.z));
}

/**
 * Where the aircraft at (x, y, z) sits against the approach path into rw, from the end
 * it is lined up behind. null when it is not on an approach (behind the threshold,
 * within 6 km and inside a cone around the extended centreline).
 */
export function approachTo(rw, x, y, z) {
  let best = null;
  for (const hdg of [rw.hdg, (rw.hdg + 180) % 360]) {
    const fr = runwayFrame(rw, x, z, hdg);
    const toAim = -(fr.along + rw.length / 2 - aimPoint(rw)); // metres before the aim point
    if (toAim < 60 || toAim > 6000) continue;
    if (Math.abs(fr.across) > 120 + toAim * 0.3) continue;
    if (!best || Math.abs(fr.across) < Math.abs(best.across)) {
      const elev = fieldElevation(rw);
      const angle = Math.atan2(y - elev, toAim) / DEG;
      best = { hdg, toAim, across: fr.across, angle, dev: angle - GLIDE_DEG, pathY: elev + toAim * Math.tan(GLIDE_DEG * DEG) };
    }
  }
  return best;
}

/** How many of the four PAPI lights show white for a deviation in degrees (2 = on slope). */
export function papiWhite(dev) {
  return PAPI_STEPS.filter((s) => dev > s).length;
}

/**
 * The approach the pilot is flying for the mission's current objective: only a landing
 * objective has one, and of its fields the one the aircraft is lined up on.
 */
export function currentApproach(ms) {
  const o = ms.objectives[ms.index];
  if (!o || o.kind !== 'land' || ms.ac.onSurface) return null;
  const p = ms.ac.pos;
  let best = null;
  for (const rw of o.fields ?? [o.rw]) {
    const a = approachTo(rw, p.x, p.y, p.z);
    if (a && (!best || a.toAim < best.toAim)) best = { ...a, rw };
  }
  return best;
}
