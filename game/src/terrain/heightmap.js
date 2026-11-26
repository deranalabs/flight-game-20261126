// Ground height of the Cinder Reach: island bumps shaped by noise, then runways,
// strips and village pads levelled into them and water lanes kept clear.
// Pure functions: the renderer, the flight model and the tests all call groundHeight().

import { ISLANDS, RUNWAYS, PADS } from './islandLayout.js';
import { fbm } from '../util/noise.js';
import { smoothstep, lerp } from '../util/vec3.js';

const SEA_FLOOR = -38;
const PAD_MARGIN = 140;
const LANE_MARGIN = 160;

function islandHeight(isl, x, z) {
  let dx = x - isl.x;
  let dz = z - isl.z;
  if (isl.shape === 'ridge') dx /= 0.55;
  const wobble = 1 + 0.22 * fbm(x / 1100 + isl.seed, z / 1100, 3, isl.seed);
  const d = Math.hypot(dx, dz) / (isl.r * wobble);
  if (d >= 1.15) return SEA_FLOOR;
  const t = Math.max(0, 1 - d);
  let h;
  if (isl.shape === 'volcano') {
    const crater = 0.11;
    const cone = Math.pow(t, 1.55);
    h = isl.h * cone;
    if (d < crater) h = isl.h * Math.pow(1 - crater, 1.55) - (crater - d) * isl.h * 2.2;
    h += isl.h * 0.05 * fbm(x / 260, z / 260, 4, isl.seed + 5) * t;
    // gullies down the cone
    h -= isl.h * 0.06 * Math.abs(Math.sin(Math.atan2(dz, dx) * 9 + d * 6)) * t * (1 - t);
  } else if (isl.shape === 'ridge') {
    const spine = Math.pow(t, 1.35);
    h = isl.h * spine * (0.75 + 0.25 * fbm(x / 500, z / 500, 4, isl.seed + 2));
  } else {
    h = isl.h * Math.pow(t, 2.0) * (0.65 + 0.35 * fbm(x / 420, z / 420, 4, isl.seed + 1));
  }
  // continental shelf: a beach band, then dropping under the sea
  const shelf = lerp(SEA_FLOOR, 2.5, smoothstep(1.15, 0.92, d));
  return Math.max(shelf, h + shelf - 2.5 + 3);
}

/** Natural height before any levelling. */
export function naturalHeight(x, z) {
  let h = SEA_FLOOR;
  for (const isl of ISLANDS) {
    const ih = islandHeight(isl, x, z);
    if (ih > h) h = ih;
  }
  return h;
}

function rectWeight(cx, cz, hdg, halfL, halfW, margin, x, z) {
  const a = (hdg * Math.PI) / 180;
  const fx = Math.sin(a);
  const fz = -Math.cos(a);
  const dx = x - cx;
  const dz = z - cz;
  const along = Math.abs(dx * fx + dz * fz) - halfL;
  const across = Math.abs(dx * -fz + dz * fx) - halfW;
  const out = Math.hypot(Math.max(0, along), Math.max(0, across));
  return 1 - smoothstep(0, margin, out);
}

// Resolve pad and runway heights once, from the natural ground at their centre.
const LAND_RUNWAYS = Object.values(RUNWAYS).filter((r) => r.kind !== 'lane');
const LANES = Object.values(RUNWAYS).filter((r) => r.kind === 'lane');
for (const rw of LAND_RUNWAYS) rw.elev = Math.max(6, Math.round(naturalHeight(rw.x, rw.z)));
for (const p of PADS) p.elev = Math.max(5, Math.round(naturalHeight(p.x, p.z)));
// The hangar apron joins the runway, so it shares the runway's level.
PADS.find((p) => p.id === 'apron').elev = RUNWAYS.halyard.elev;

/** Final ground height at (x, z); negative values are sea floor under water. */
export function groundHeight(x, z) {
  let h = naturalHeight(x, z);
  for (const p of PADS) {
    const w = rectWeight(p.x, p.z, 0, p.w / 2, p.d / 2, PAD_MARGIN, x, z);
    if (w > 0) h = lerp(h, p.elev, w);
  }
  for (const rw of LAND_RUNWAYS) {
    const w = rectWeight(rw.x, rw.z, rw.hdg, rw.length / 2 + 90, rw.width / 2 + 70, PAD_MARGIN, x, z);
    if (w > 0) h = lerp(h, rw.elev, w);
  }
  for (const ln of LANES) {
    const w = rectWeight(ln.x, ln.z, ln.hdg, ln.length / 2 + 200, ln.width / 2 + 60, LANE_MARGIN, x, z);
    if (w > 0) h = Math.min(h, lerp(h, -8, w));
  }
  return h;
}

/**
 * What the aircraft would touch at (x, z): water, a runway, a strip or rough land.
 * height is the surface the floats meet (sea level over water).
 */
export function surfaceAt(x, z) {
  for (const rw of LAND_RUNWAYS) {
    // a cleared overrun of 60 m beyond each end rolls like the runway itself
    const w = rectWeight(rw.x, rw.z, rw.hdg, rw.length / 2 + 60, rw.width / 2 + 4, 1, x, z);
    if (w >= 1) return { kind: rw.kind, height: rw.elev, runway: rw };
  }
  const g = groundHeight(x, z);
  if (g <= 0) return { kind: 'water', height: 0, runway: null, depth: -g };
  return { kind: 'land', height: g, runway: null };
}

/** Rough slope (rise over run) used for forest placement and crash wording. */
export function slopeAt(x, z, step = 20) {
  const hx = groundHeight(x + step, z) - groundHeight(x - step, z);
  const hz = groundHeight(x, z + step) - groundHeight(x, z - step);
  return Math.hypot(hx, hz) / (2 * step);
}
