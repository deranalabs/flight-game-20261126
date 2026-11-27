// The story: the air service owes the Harbour Board 12,000 shillings for the hangar
// and slip at Port Halyard. The Board credits one shilling for every score point of a
// completed sortie. Three chapters follow the board (sorties 1-3, 4-7, 8-10), and
// paying the last shilling ends the story.

export const DEBT = 12000;

const CHAPTERS = [
  { no: 1, from: 1, to: 3, title: 'The Note Comes Due', text: 'The Board wants 12,000 sh. Every good job pays it down.' },
  { no: 2, from: 4, to: 7, title: 'Working the Reach', text: 'The Board is watching. Each clean sortie buys trust.' },
  { no: 3, from: 8, to: 10, title: 'The Last Shillings', text: 'Pay the last shillings and the Port Halyard slip is ours.' },
];

export const ENDING = 'Paid in full. The Harbour Board tears up the note, and the Tern flies free for the Cinder Reach.';

export const debtLeft = (c) => Math.max(0, DEBT - (c.debtPaid ?? 0));
export const debtCleared = (c) => debtLeft(c) === 0;

/** The chapter of the next sortie to fly (sortie number = completed sorties + 1, at most 10). */
export function chapterFor(sortieNo) {
  return CHAPTERS.find((ch) => sortieNo <= ch.to) ?? CHAPTERS[CHAPTERS.length - 1];
}

/** Pay the Board from a scored sortie; a failed sortie pays nothing. Returns shillings paid. */
export function payDebt(c, s) {
  const paid = s.done ? Math.min(debtLeft(c), s.total) : 0;
  c.debtPaid = (c.debtPaid ?? 0) + paid;
  return paid;
}
