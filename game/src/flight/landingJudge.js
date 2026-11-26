// Touchdowns and crashes: what the floats met, how hard, how straight, and the words
// the debrief uses. A touchdown is graded once the aircraft has rolled to taxi speed.

import { runwayFrame } from '../terrain/islandLayout.js';

export const MS_TO_FPM = 196.85;
export const MS_TO_KT = 1.94384;

/**
 * Decide what a first contact with a surface is. Returns { crash, reason } or
 * { crash: false, hard, damage } for a touchdown that the floats survive.
 */
export function classifyContact(c, spec) {
  const fpm = c.sink * MS_TO_FPM;
  const kt = c.speed * MS_TO_KT;
  const where = c.kind === 'water' || c.kind === 'lane' ? 'the water' : c.kind === 'land' ? 'the rocks' : 'the runway';
  const tough = spec.floatToughness ?? 1;
  if (c.kind === 'land' && (c.speed > 14 || c.sink > 2)) {
    return { crash: true, reason: `Flew into ${c.placeName ?? 'the hillside'} at ${Math.round(kt)} kt` };
  }
  if (fpm > 1000 * tough) return { crash: true, reason: `Slammed into ${where} at ${Math.round(fpm)} ft/min` };
  if (Math.abs(c.bank) > 20) return { crash: true, reason: `Caught a wingtip on ${where} in a ${Math.round(Math.abs(c.bank))}° bank` };
  if (c.pitch < -7) return { crash: true, reason: `Floats dug in nose-first at ${Math.round(c.pitch)}° pitch` };
  if (c.kind === 'water' && kt > 95) return { crash: true, reason: `Hit the water at ${Math.round(kt)} kt and cartwheeled` };
  const hard = fpm > 520 * tough;
  const damage = hard ? (fpm - 520 * tough) * 0.09 : 0;
  return { crash: false, hard, damage, fpm, kt };
}

/** Where the touchdown point sits on a runway or lane, for centreline and zone scoring. */
export function touchdownPlace(rw, x, z, hdgDeg) {
  if (!rw) return null;
  // Use the runway direction closest to the aircraft's heading.
  const diff = Math.abs((((hdgDeg - rw.hdg) % 360) + 540) % 360 - 180);
  const landingHdg = diff <= 90 ? rw.hdg : (rw.hdg + 180) % 360;
  const fr = runwayFrame(rw, x, z, landingHdg);
  return { landingHdg, along: fr.along, across: fr.across, fromThreshold: fr.along + rw.length / 2 };
}

/**
 * Grade a finished landing. Inputs: fpm at first touch, centreline offset (m, null
 * off any runway), bounces, and whether it stopped inside the runway or lane.
 * Returns { letter, points 0..100, notes[] }.
 */
export function gradeLanding({ fpm, across, bounces, stoppedInside, widthHalf = 15 }) {
  let pts = 100;
  const notes = [];
  if (fpm > 120) pts -= Math.min(45, (fpm - 120) * 0.09);
  if (fpm <= 150) notes.push('butter-soft touchdown');
  else if (fpm <= 300) notes.push('firm touchdown');
  else notes.push(`hard touchdown, ${Math.round(fpm)} ft/min`);
  if (across !== null && across !== undefined) {
    const off = Math.abs(across);
    pts -= Math.min(25, (off / widthHalf) * 25);
    notes.push(off < widthHalf * 0.2 ? 'on the centreline' : `${Math.round(off)} m off centre`);
  }
  if (bounces > 0) {
    pts -= bounces * 12;
    notes.push(bounces === 1 ? 'one bounce' : `${bounces} bounces`);
  }
  if (stoppedInside === false) {
    pts -= 20;
    notes.push('ran off the end');
  }
  pts = Math.max(0, Math.round(pts));
  const letter = pts >= 90 ? 'A' : pts >= 75 ? 'B' : pts >= 55 ? 'C' : pts >= 35 ? 'D' : 'F';
  return { letter, points: pts, notes };
}
