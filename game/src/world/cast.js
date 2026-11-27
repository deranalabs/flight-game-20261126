// The people of the Reach with state: each has a role, a want, and a mood that moves with
// the story chapter and with what the pilot did for them (trust from the career). The
// crew-and-contacts board and the debrief read these lines.

export const PEOPLE = {
  ansel: { name: 'Ansel Mott', role: 'Clerk of the Port Halyard Board', want: 'the note paid on time', moods: ['PATIENT', 'WATCHFUL', 'CURT', 'FINAL'] },
  marta: { name: 'Marta Quill', role: 'Port Halyard tower', want: 'a clean regatta', moods: ['ON SHIFT', 'BUSY', 'WORRIED', 'PROUD'] },
  teodor: { name: 'Teodor Brask', role: 'Hangar chief', want: 'the Tern back in one piece', moods: ['WARY', 'TRUSTING', 'STRETCHED', 'LOYAL'] },
  ilse: { name: 'Dr. Ilse Varga', role: 'Saltmoor clinic', want: 'a generator for the clinic', moods: ['ON CALL', 'GRATEFUL', 'DESPERATE', 'GRATEFUL'] },
  oren: { name: 'Chief Oren Hale', role: 'Tallow fire watch', want: 'the slopes saved', moods: ['WATCHING', 'FIGHTING', 'TIRED', 'RELIEVED'] },
  pip: { name: 'Pip Calloway', role: 'Gannet Point keeper', want: 'a new lamp', moods: ['TRIMMING WICKS', 'HOPEFUL', 'IN THE DARK', 'LIT'] },
  junie: { name: 'Junie Ashby', role: 'Cinder Observatory', want: 'the ash plume charted', moods: ['READING', 'EXCITED', 'ALARMED', 'CALM'] },
  wren: { name: 'Wren Tallis', role: 'Saltmoor post office', want: 'the post on time', moods: ['SORTING', 'CHEERFUL', 'SNOWED UNDER', 'CAUGHT UP'] },
};

/** Who a person is and how they stand now: chapter 1-4 sets the mood, trust bumps it. */
export function personState(id, chapterNo, trust = 0) {
  const p = PEOPLE[id] ?? PEOPLE.marta;
  const mood = p.moods[Math.max(0, Math.min(3, chapterNo - 1))];
  const stand = trust >= 3 ? 'FIRM FRIEND' : trust >= 1 ? 'ON YOUR SIDE' : 'NEUTRAL';
  return { id, name: p.name, role: p.role, want: p.want, mood, stand };
}

/** The clerk's patience, which the debrief and board show beside the debt. */
export function clerkPatience(chapterNo, leftFrac) {
  const base = 100 - (chapterNo - 1) * 22;
  return Math.max(5, Math.min(100, Math.round(base + (1 - leftFrac) * 30)));
}
