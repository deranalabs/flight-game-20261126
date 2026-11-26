// Wind over the Cinder Reach: a steady wind from a direction, gusts that come and go,
// storm downdrafts, and rough air in the lee of Mount Cinder. Deterministic in time and place.

import { ISLANDS } from '../terrain/islandLayout.js';
import { valueNoise } from '../util/noise.js';

const CINDER = ISLANDS.find((i) => i.id === 'cinder');

/** Weather presets every mission picks from. Speeds in m/s, visibility in metres. */
export const WEATHER = {
  calm: { name: 'Calm', windKt: 4, gustKt: 2, turbulence: 0.15, visibility: 14000, rain: 0, lightning: 0 },
  breezy: { name: 'Breezy', windKt: 12, gustKt: 6, turbulence: 0.35, visibility: 12000, rain: 0, lightning: 0 },
  gusty: { name: 'Gusty', windKt: 18, gustKt: 12, turbulence: 0.7, visibility: 9000, rain: 0.2, lightning: 0 },
  storm: { name: 'Squall line', windKt: 26, gustKt: 18, turbulence: 1.25, visibility: 3200, rain: 1, lightning: 1 },
};

const KT = 0.514444;

/**
 * Make a wind field. fromDeg is where the wind blows FROM (aviation style).
 * Returns { at(pos, t) -> {x,y,z} m/s, gustFactor(t), fromDeg, speedKt, weather }.
 */
export function makeWindField(weatherId, fromDeg, seed = 1) {
  const w = WEATHER[weatherId] ?? WEATHER.calm;
  const a = (fromDeg * Math.PI) / 180;
  // blowing toward the opposite of fromDeg
  const dirX = -Math.sin(a);
  const dirZ = Math.cos(a);
  const base = w.windKt * KT;
  const gust = w.gustKt * KT;

  function gustFactor(t) {
    // slow swell of gusts, 0..1
    const g = valueNoise(t / 7, seed * 3.1, seed) * 0.7 + valueNoise(t / 2.3, seed * 1.7, seed + 9) * 0.3;
    return Math.max(0, g * 1.6 - 0.45);
  }

  function at(pos, t) {
    const gf = gustFactor(t + pos.x / 400);
    const speed = base + gust * gf;
    let x = dirX * speed;
    let z = dirZ * speed;
    let y = 0;
    // small fast turbulence
    const tb = w.turbulence;
    if (tb > 0) {
      const p = t * 1.9;
      x += tb * 1.6 * (valueNoise(p, pos.z / 90, seed + 1) - 0.5) * 2;
      z += tb * 1.6 * (valueNoise(p + 31, pos.x / 90, seed + 2) - 0.5) * 2;
      y += tb * 1.1 * (valueNoise(p + 57, (pos.x + pos.z) / 110, seed + 3) - 0.5) * 2;
    }
    // storm cells: downdraft patches that move with the wind
    if (w.lightning > 0) {
      const cx = (pos.x - dirX * speed * t) / 1400;
      const cz = (pos.z - dirZ * speed * t) / 1400;
      const cell = valueNoise(cx, cz, seed + 21);
      if (cell > 0.62) y -= (cell - 0.62) * 22;
    }
    // lee of Mount Cinder: rotor turbulence below 900 m downwind of the peak
    const dx = pos.x - CINDER.x;
    const dz = pos.z - CINDER.z;
    const d = Math.hypot(dx, dz);
    if (d < CINDER.r * 1.2 && pos.y < 900) {
      const downwind = (dx * dirX + dz * dirZ) / (d || 1);
      if (downwind > 0.2) {
        const k = (downwind - 0.2) * (1 - d / (CINDER.r * 1.2)) * (base / 8);
        y += k * 4 * (valueNoise(t * 1.3, d / 150, seed + 5) - 0.6);
        x += k * 3 * (valueNoise(t * 1.1 + 4, d / 170, seed + 6) - 0.5);
      }
    }
    return { x, y, z };
  }

  return { at, gustFactor, fromDeg, speedKt: w.windKt, gustKt: w.gustKt, weather: w, weatherId };
}
