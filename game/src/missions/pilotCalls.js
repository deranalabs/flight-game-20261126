// Two in-flight decisions, each with its price stated before the pilot answers.
// Bingo fuel: When the tank falls under BINGO.frac on a sortie
// that still has a landing ahead, the pilot gets a short countdown and two priced options:
// commit to the planned field (full pay, but a flameout short of it ends the sortie and the
// Board charges the wreck) or divert to the nearest other harbour (safe, but the divert is
// charged to the note and adds minutes to the sortie). Silence commits. The bot diverts
// only when the reserve on the commit is under its margin.
// Damage: once a part falls under REPAIR.below, YOUR CALL offers a patch at the next stop
// (the repair bill and minutes on the receipt, parts back to 100) or pressing on hurt.
// Keys 1 and 2 answer whichever box is open; the bot presses on.

import { RUNWAYS } from '../terrain/islandLayout.js';
import { GAZETTEER } from '../world/gazetteer.js';
import { enduranceMinutes } from '../systems/fuelTank.js';
import { PARTS, repairCost } from '../systems/damageModel.js';

export const BINGO = {
  frac: 0.15, // fuel share of the tank that opens the box
  seconds: 8, // countdown; no answer commits
  divertSh: 450, // charged to the note for a divert
  divertMin: 6, // minutes the divert adds to the sortie clock
  flameoutSh: 900, // charged when a committed Tern runs dry before the field
  botMarginMin: 2, // the bot diverts when the commit reserve is under this
  groundSpeed: 45, // m/s used to time the run to a field
};

// only the sortie's last job, a landing: earlier landings have work at that field after them
const pendingLanding = (ms) => (ms.index === ms.objectives.length - 1 && ms.objectives[ms.index].kind === 'land' ? ms.objectives[ms.index] : null);
const targetOf = (o) => o.pick ?? o.rw;
const dist = (ac, f) => Math.hypot(f.x - ac.pos.x, f.z - ac.pos.z);
const minutesTo = (ac, f) => dist(ac, f) / BINGO.groundSpeed / 60;

/** Runway number of the end the Tern will land on, coming from where it is now. */
export function runwayNumber(rw, ac) {
  const brg = ((Math.atan2(rw.x - ac.pos.x, -(rw.z - ac.pos.z)) * 180) / Math.PI + 360) % 360;
  const off = (h) => Math.abs(((brg - h + 540) % 360) - 180);
  const hdg = off(rw.hdg) <= off(rw.hdg + 180) ? rw.hdg : (rw.hdg + 180) % 360;
  return String(Math.round(hdg / 10) || 36).padStart(2, '0');
}

/** The harbour a field belongs to, by the gazetteer. */
export function harbourOf(fieldId) {
  return GAZETTEER.find((i) => i.fields?.includes(fieldId))?.harbour ?? RUNWAYS[fieldId]?.name ?? fieldId;
}

/** Nearest field at another harbour than the planned one; a holed float rules out the water. */
export function divertField(ac, planned, { noWater = false } = {}) {
  let best = null;
  for (const f of Object.values(RUNWAYS)) {
    if (f.id === 'mirrorLagoon' || harbourOf(f.id) === harbourOf(planned.id) || (noWater && f.kind === 'lane')) continue;
    if (!best || dist(ac, f) < dist(ac, best)) best = f;
  }
  return best;
}

/** The two options as the box prices them, or null when no decision is due. */
export function bingoOptions(ms, { noWater = false } = {}) {
  const ac = ms.ac;
  const obj = pendingLanding(ms);
  if (!obj || obj.opts?.engineOff || ms.def.bingo === false) return null;
  const rw = targetOf(obj);
  const field = divertField(ac, rw, { noWater });
  if (!field) return null;
  const reserve = enduranceMinutes(ac.fuel, ac.spec) - minutesTo(ac, rw);
  return {
    commit: { rwy: runwayNumber(rw, ac), field: rw.name, reserveMin: Math.max(0, Math.round(reserve)), flameoutSh: BINGO.flameoutSh },
    divert: { to: harbourOf(field.id), field, sh: BINGO.divertSh, min: BINGO.divertMin },
  };
}

/** Act on a choice: 'commit' keeps the plan, 'divert' re-targets the landing and books the cost. */
export function chooseBingo(ms, choice) {
  const b = ms.extra.bingo;
  if (!b || !b.open) return;
  b.open = false;
  b.choice = choice;
  if (choice !== 'divert') return;
  const obj = pendingLanding(ms);
  const f = b.divert.field;
  obj.rw = f;
  obj.pick = f;
  if (obj.fields) obj.fields = [f];
  obj.label = () => `Divert: land at ${b.divert.to} (${f.name})`;
  obj.bot = null; // the bot plans a fresh approach to the new field
  ms.extra.timeAdd = (ms.extra.timeAdd ?? 0) + b.divert.min * 60;
  (ms.extra.charges ??= []).push({ sh: b.divert.sh, label: `diverted to ${b.divert.to}: −${b.divert.sh} sh, +${b.divert.min} min` });
  ms.radio.line('marta', `Copy the divert. ${b.divert.to} is expecting you.`, ms.t);
}

/**
 * Each step: open the box at bingo, take the pilot's answer (actions.call 1 or 2), commit
 * on the countdown, let the bot decide by its rule, and end a committed sortie that runs dry.
 */
export function stepBingo(ms, actions = {}, opts = {}) {
  const ac = ms.ac;
  const b = ms.extra.bingo;
  if (!b) {
    if (ac.onSurface || !ac.engine.running || ac.fuel.litres / ac.fuel.capacity >= BINGO.frac) return;
    const o = bingoOptions(ms, { noWater: opts.noWater });
    if (!o) return;
    ms.extra.bingo = { at: ms.t, open: true, ...o };
    if (opts.bot && !ms.extra.hold) chooseBingo(ms, o.commit.reserveMin < BINGO.botMarginMin ? 'divert' : 'commit');
    return;
  }
  if (b.open && !ms.extra.hold) {
    if (actions.call === 1) chooseBingo(ms, 'commit');
    else if (actions.call === 2) chooseBingo(ms, 'divert');
    else if (ms.t >= b.at + BINGO.seconds) chooseBingo(ms, 'commit');
  }
  if (b.choice === 'commit' && !b.flameout && ac.fuel.litres <= 0.01 && !ac.onSurface && pendingLanding(ms)) {
    b.flameout = true;
    (ms.extra.charges ??= []).push({ sh: b.commit.flameoutSh, label: `flameout short of RWY ${b.commit.rwy}: −${b.commit.flameoutSh} sh` });
    ms.fail(`Committed at bingo and ran dry short of RWY ${b.commit.rwy}`);
  }
}

/** Seconds left on the countdown, for the HUD. */
export const bingoLeft = (ms) => Math.max(0, Math.ceil(ms.extra.bingo.at + BINGO.seconds - ms.t));

export const REPAIR = {
  below: 80, // a part under this health opens YOUR CALL
  seconds: 8, // countdown; no answer presses on
  min: 15, // minutes Teodor's patch adds at the next stop
};

const worstPart = (dmg) => PARTS.reduce((w, p) => (dmg[p] < dmg[w] ? p : w), PARTS[0]);

/** YOUR CALL: offer the repair once a part is hurt, answer it, and patch her at the next stop. */
export function stepRepair(ms, actions = {}, opts = {}) {
  const ac = ms.ac;
  let r = ms.extra.repair;
  if (!r) {
    if (ms.extra.bingo?.open || ac.damage[worstPart(ac.damage)] >= REPAIR.below) return;
    r = ms.extra.repair = { at: ms.t, open: true, part: worstPart(ac.damage), sh: repairCost(ac.damage), min: REPAIR.min };
    if (opts.bot && !ms.extra.hold) { r.open = false; r.choice = 'press'; }
    return;
  }
  if (r.open && !ms.extra.hold) {
    if (actions.call === 1) { r.open = false; r.choice = 'repair'; }
    else if (actions.call === 2 || ms.t >= r.at + REPAIR.seconds) { r.open = false; r.choice = 'press'; }
  }
  if (r.choice === 'repair' && !r.done && ac.onSurface && ac.gs < 2) {
    r.done = true;
    r.sh = repairCost(ac.damage);
    for (const p of PARTS) ac.damage[p] = 100;
    ms.extra.timeAdd = (ms.extra.timeAdd ?? 0) + r.min * 60;
    (ms.extra.charges ??= []).push({ sh: r.sh, label: `field repair: −${r.sh} sh, +${r.min} min` });
    ms.radio.line('teodor', 'Patched. She will fly straight again.', ms.t);
  }
}
