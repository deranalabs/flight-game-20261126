// The career: cash in shillings, the Tern's damage and upgrades, which missions are flown
// and how well, the pilot's logbook and rating, and the trust of each radio character.
// Saved in the browser; a broken or blocked store starts a fresh career.

import { UPGRADES } from '../aircraft/ternSpec.js';
import { repairCost, PARTS } from '../systems/damageModel.js';
import { MISSIONS } from '../missions/index.js';

const KEY = 'tidewing.career.v1';
export const FUEL_PRICE = 1.6; // shillings a litre

export function newCareer() {
  return {
    version: 1,
    cash: 600,
    upgrades: [],
    damage: { engine: 100, airframe: 100, floats: 100, controls: 100 },
    missions: {},
    logbook: [],
    flights: 0,
    hours: 0,
    trust: {},
    score: { total: 0, best: {}, combo: 0, bestCombo: 0 },
    debtPaid: 0,
  };
}

export function loadCareer(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return newCareer();
    const c = JSON.parse(raw);
    return c && c.version === 1 ? { ...newCareer(), ...c } : newCareer();
  } catch {
    return newCareer();
  }
}

export function saveCareer(c, storage = globalThis.localStorage) {
  try { storage && storage.setItem(KEY, JSON.stringify(c)); } catch { /* private window: play on unsaved */ }
}

export function isUnlocked(c, index) {
  if (index === 0) return true;
  const prev = MISSIONS[index - 1];
  return !!(c.missions[prev.id] && c.missions[prev.id].stars > 0);
}

export function totalStars(c) {
  return Object.values(c.missions).reduce((s, m) => s + (m.stars || 0), 0);
}

export function pilotRating(c) {
  const s = totalStars(c);
  if (s >= 24) return 'Tidewing Ace';
  if (s >= 18) return 'Island Legend';
  if (s >= 12) return 'Bush Captain';
  if (s >= 6) return 'Line Pilot';
  return 'Cadet Pilot';
}

/** Book a finished sortie: pay, fuel bill, damage carried, best results, logbook line. */
export function recordFlight(c, result, ac, clientId) {
  const fuelBill = Math.round(result.fuelUsed * FUEL_PRICE);
  c.cash += result.pay - fuelBill;
  c.flights += 1;
  c.hours += result.time / 3600;
  for (const p of PARTS) c.damage[p] = Math.round(ac.damage[p] * 10) / 10;
  if (result.crashed) for (const p of PARTS) c.damage[p] = Math.min(c.damage[p], 35);
  const m = c.missions[result.id] ?? { stars: 0, bestTime: null, bestLanding: '-', flown: 0 };
  m.flown += 1;
  if (result.done) {
    m.stars = Math.max(m.stars, result.stars);
    m.bestTime = m.bestTime === null ? result.time : Math.min(m.bestTime, result.time);
    if (m.bestLanding === '-' || (result.landing !== '-' && result.landing < m.bestLanding)) m.bestLanding = result.landing;
  }
  c.missions[result.id] = m;
  if (clientId) c.trust[clientId] = Math.max(-3, Math.min(5, (c.trust[clientId] ?? 0) + (result.done ? result.stars - 1 : -1)));
  c.logbook.unshift({
    n: c.flights, id: result.id, title: result.title, done: result.done, stars: result.stars,
    time: Math.round(result.time), landing: result.landing, pay: result.pay, fuelBill, damage: result.damageTaken,
    note: result.done ? result.notes[0] ?? '' : result.reason ?? '',
  });
  c.logbook = c.logbook.slice(0, 40);
  return { fuelBill };
}

export function repairAll(c) {
  const cost = repairCost(c.damage);
  if (cost <= 0 || c.cash < cost) return false;
  c.cash -= cost;
  for (const p of PARTS) c.damage[p] = 100;
  return true;
}

export function repairPart(c, part) {
  const cost = repairCost({ engine: 100, airframe: 100, floats: 100, controls: 100, [part]: c.damage[part] });
  if (cost <= 0 || c.cash < cost) return false;
  c.cash -= cost;
  c.damage[part] = 100;
  return true;
}

export function buyUpgrade(c, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || c.upgrades.includes(id) || c.cash < u.cost) return false;
  c.cash -= u.cost;
  c.upgrades.push(id);
  return true;
}
