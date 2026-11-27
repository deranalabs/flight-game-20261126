// The Harbour Board ledger: what the Port Halyard Board is owed on the Tern's note and
// every entry against it. A completed sortie pays one shilling per score point, the day's
// event may add a bonus, refits and jettisoned cargo are charged, the Board's fee lands
// once when chapter 3 opens, and the squeeze choice pays what the pilot chose. The story
// itself (chapters, contracts, endings) is data in story/storyline.js.

import { DEBT, SQUEEZE_FEE, CHOICE, chapterOf, chapterBounds, endingFor } from '../story/storyline.js';
import { eventFor } from '../world/events.js';

export { DEBT };

/** Everything the Board is owed: the note plus every charge since. */
export const debtOwed = (c) => DEBT + (c.debtCharged ?? 0);
export const debtLeft = (c) => Math.max(0, debtOwed(c) - (c.debtPaid ?? 0));
export const debtCleared = (c) => debtLeft(c) === 0;
/** Share of the note paid, 0 to 1, for the debt bars. */
export const debtPaidFrac = (c) => Math.min(1, (c.debtPaid ?? 0) / debtOwed(c));

function entry(c, label, sh) {
  (c.ledger ??= []).push({ label, sh });
}

/** Pay the Board from a scored sortie; a failed sortie pays nothing. Returns shillings paid. */
export function payDebt(c, s, label = 'Sortie') {
  const paid = s.done ? Math.min(debtLeft(c), s.total) : 0;
  c.debtPaid = (c.debtPaid ?? 0) + paid;
  if (paid) entry(c, label, -paid);
  return paid;
}

/** Add a charge to the note (a refit, cargo thrown out, the Board's fee). */
export function chargeDebt(c, sh, label) {
  c.debtCharged = (c.debtCharged ?? 0) + sh;
  entry(c, label, sh);
  return sh;
}

/** The squeeze is offered on the first sortie of chapter 3. */
export function squeezeSortie(n) {
  return chapterBounds(n)[1] + 1;
}

/**
 * Book a finished sortie against the note: pay from the score, the day's event bonus and
 * the squeeze choice (the pilot's, or the fallback), then the Board's fee once the next
 * sortie opens chapter 3. n is the number of sorties on the board. Returns what moved.
 */
export function settleSortie(c, def, scored, n, extra = {}) {
  const paid = payDebt(c, scored, `${def.title}: ${scored.grade} grade`);
  let bonus = 0;
  let choice = 0;
  if (scored.done) {
    const ev = eventFor(def.id);
    if (ev) bonus = payDebt(c, { done: true, total: ev.bonus }, `${ev.title.toLowerCase()} bonus`);
    if (def.order === squeezeSortie(n) && !c.choiceDone) {
      const opt = CHOICE.options.find((o) => o.id === (c.choice ?? CHOICE.fallback));
      c.choice = opt.id;
      c.choiceDone = true;
      choice = payDebt(c, { done: true, total: opt.paid }, opt.label);
      for (const [who, k] of Object.entries(opt.trust)) (c.trust ??= {})[who] = (c.trust[who] ?? 0) + k;
    }
  }
  let fee = 0;
  const flown = Object.values(c.missions ?? {}).filter((m) => m.stars > 0).length;
  if (!c.feeCharged && chapterOf(Math.min(n, flown + 1), n).no >= 3) {
    c.feeCharged = true;
    fee = chargeDebt(c, SQUEEZE_FEE, 'Board fee raised');
  }
  // the sortie's own decisions (a bingo divert, a flameout, a field repair), as priced
  const charges = (extra.charges ?? []).map((ch) => ({ ...ch, sh: chargeDebt(c, ch.sh, `${def.title}: ${ch.label}`) }));
  return { paid, bonus, choice, fee, charges, total: paid + bonus + choice };
}

/** The chapter of the next sortie to fly. */
export function chapterFor(sortieNo, n) {
  return chapterOf(sortieNo, n);
}

/** The ending a career stands at: what the final receipt stamps. */
export function standing(c) {
  return endingFor(debtLeft(c));
}
