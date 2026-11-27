// Refits: the Tern's parts catalogue. Between sorties the refit screen deals three cards
// the pilot has not fitted; picking one fits it and charges its price to the Board's
// note. Each refit changes a number the flight model flies (ternSpec.js).

import { UPGRADES, REFIT_PARTS } from '../aircraft/ternSpec.js';
import { chargeDebt } from './harbourDebt.js';

const PART = {
  longTank: 'TANKS', stolFlaps: 'FLAPS', bigProp: 'PROP', strongFloats: 'FLOATS', scoopTank: 'TANKS', nightKit: 'INSTRUMENTS',
  sealedCowl: 'ENGINE', cleanStruts: 'AIRFRAME', longAilerons: 'CONTROLS', tallRudder: 'RUDDER', vortexGens: 'WING', lightCabin: 'CABIN',
};

export const REFITS = [...UPGRADES, ...REFIT_PARTS].map(({ id, name, cost, blurb }) => ({ id, name, cost, blurb, part: PART[id] ?? 'AIRFRAME' }));

export const refitsFitted = (c) => REFITS.filter((r) => c.upgrades.includes(r.id)).length;

/** Three refits not yet fitted, dealt in a rotation that moves on with every flight. */
export function refitOffer(c) {
  const open = REFITS.filter((r) => !c.upgrades.includes(r.id));
  if (open.length <= 3) return open;
  const k = (c.flights ?? 0) * 5;
  return [0, 1, 2].map((i) => open[(k + i * 4) % open.length]).filter((r, i, a) => a.indexOf(r) === i);
}

/** Fit a refit and charge it to the note. False if it is unknown or already fitted. */
export function fitRefit(c, id) {
  const r = REFITS.find((x) => x.id === id);
  if (!r || c.upgrades.includes(id)) return false;
  c.upgrades.push(id);
  chargeDebt(c, r.cost, `Refit: ${r.name}`);
  return true;
}
