// The approach path to a runway or lane: the same 4° slope and aim point the autopilot
// flies, so the PAPI lights, the glideslope ladder and the HUD agree with the bot.

import { runwayFrame } from '../terrain/islandLayout.js';
import { groundHeight } from '../terrain/heightmap.js';

export const GLIDE_DEG = 4;
const DEG = Math.PI / 180;
// PAPI: each of the four lights turns white above its own angle, two white on slope
const PAPI_STEPS = [-0.6, -0.2, 0.2, 0.6];
/** Degrees off the path that still count as on slope: the green band on the ladder and callouts. */
export const ON_SLOPE_DEG = 0.4;

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
    const beforeAim = -(fr.along + rw.length / 2 - aimPoint(rw)); // metres before the aim point
    if (beforeAim < 60 || beforeAim > 6000) continue;
    if (Math.abs(fr.across) > 120 + beforeAim * 0.3) continue;
    if (!best || Math.abs(fr.across) < Math.abs(best.across)) {
      const angle = Math.atan2(y - fieldElevation(rw), beforeAim) / DEG;
      best = { hdg, beforeAim, across: fr.across, angle, dev: angle - GLIDE_DEG };
    }
  }
  return best;
}

/** How many of the four PAPI lights show white for a deviation in degrees (2 = on slope). */
export function papiWhite(dev) {
  return PAPI_STEPS.filter((s) => dev > s).length;
}

/**
 * The one PAPI rule both the 3D bar and the HUD draw from: four lights from the outer one
 * (far from the runway, the pilot's left) to the inner one, true for white. Outer lights
 * turn white first, so on slope the two outer are white and the two inner red.
 */
export function papiLights(dev) {
  const white = papiWhite(dev);
  return [0, 1, 2, 3].map((i) => i < white);
}

/** HIGH, LOW or ON for a deviation, with the same band as the ladder. */
export function slopeWord(dev) {
  return dev > ON_SLOPE_DEG ? 'HIGH' : dev < -ON_SLOPE_DEG ? 'LOW' : 'ON';
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
    if (a && (!best || a.beforeAim < best.beforeAim)) best = { ...a, rw };
  }
  // the callouts read the same PAPI rule and band as the lights and the ladder
  if (best) { best.word = slopeWord(best.dev); best.white = papiWhite(best.dev); }
  return best;
}
