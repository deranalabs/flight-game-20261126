// The Harbour Board story as data: the 12,000 sh note the Port Halyard Board holds on the
// Tern, four chapters laid over however many sorties ship, one contract per sortie (who
// is helped, on which island, what kind of job, a radio line before and after), the
// clerk's notice for each chapter, the squeeze (a fee and one hard choice) and three
// endings by what is left owed. Pure data and arithmetic: no beat can block a sortie.

export const DEBT = 12000;
/** The Board raises its fee once, when chapter 3 opens. */
export const SQUEEZE_FEE = 1500;
/** Left owed at or below this after the last sortie, the Board grants an extension. */
export const EXTENSION_LIMIT = 3000;

export const CLERK = 'ansel';

export const CHAPTERS = [
  { no: 1, title: 'THE NOTE', plate: 'The Board calls in the note', clerk: 'Notice to the Tern: twelve thousand shillings, due when the season closes.', volcano: 0.3 },
  { no: 2, title: 'THE WORK', plate: 'Every contract pays the Board', clerk: 'The Board credits each completed contract against your note. Fly clean.', volcano: 0.5 },
  { no: 3, title: 'THE SQUEEZE', plate: 'The Board raises its fee', clerk: `The Board adds a fee of ${SQUEEZE_FEE.toLocaleString('en-US')} sh. Weather is turning. So is our patience.`, volcano: 0.8 },
  { no: 4, title: 'THE RECKONING', plate: 'Last contract before the season closes', clerk: 'Final sortie on the note. The Board will stamp what you have paid.', volcano: 1 },
];

/** Last sortie number of chapters 1 to 3 for a board of n sorties; chapter 4 is the last sortie. */
export function chapterBounds(n) {
  const one = Math.max(1, Math.round(n * 0.2));
  const two = Math.max(one + 1, Math.round(n * 0.6));
  const three = Math.max(two, n - 1);
  return [one, two, three, n];
}

/** The chapter a sortie (1-based) belongs to on a board of n sorties. */
export function chapterOf(sortieNo, n) {
  const b = chapterBounds(n);
  const i = b.findIndex((last) => sortieNo <= last);
  return CHAPTERS[i < 0 ? 3 : i];
}

/**
 * Mission types: four kinds of contract, each with its own HUD layout.
 * ring: a course of rings; drop: water or sacks onto targets with a drop meter;
 * landing: a graded touchdown is the job; haul: carry or survey from place to place.
 */
export const MISSION_TYPES = {
  ring: 'RING COURSE',
  drop: 'FIRE & DROP',
  landing: 'PRECISION LANDING',
  haul: 'CARGO & SURVEY',
};

/** One contract per sortie: the headline when it is done, kind, who it helps, the island, a line before and after. */
export const CONTRACTS = {
  mailRun: { headline: 'POST DELIVERED', type: 'haul', who: 'wren', island: 'saltmoor', before: 'Saltmoor has had no post in a week. The Board takes its cut on delivery.', after: 'Post is in Saltmoor. First receipt stamped against the note.' },
  ringCourse: { headline: 'GAUGES LOGGED', type: 'ring', who: 'junie', island: 'cinder', before: 'The observatory needs the wind gauges on the rings checked. Fly them clean.', after: 'Gauges logged. The Board counts the trial as paid work.' },
  medevac: { headline: 'PATIENT DELIVERED', type: 'landing', who: 'ilse', island: 'saltmoor', before: 'A fisherman with a broken back. Soft landings or he feels every one.', after: 'Patient delivered. Dr. Varga owes you one; the Board owes you nothing.' },
  shortStrip: { headline: 'PUMPS ON THE RIDGE', type: 'landing', who: 'oren', island: 'tallow', before: 'Pumps for Brackwater, onto a ridge strip three hundred and eighty metres long.', after: 'Pumps are on the ridge. Brackwater can fight fire again.' },
  waterBomber: { headline: 'EVERYONE HOME', type: 'drop', who: 'oren', island: 'tallow', before: 'Three fires on the Tallow slopes. Scoop the lagoon, hit them low.', after: 'Everyone home. Tallow keeps its timber, the Board keeps its rent.' },
  lighthouseNight: { headline: 'THE LIGHT TURNS', type: 'ring', who: 'pip', island: 'gannet', before: 'The Gannet light is dark. Fly the flare gates and carry the new lamp.', after: 'The light turns again. Pip says the Board never paid for a lamp in its life.' },
  stormCrossing: { headline: 'THROUGH THE SQUALL', type: 'haul', who: 'junie', island: 'skerry', before: 'Barometers for Far Skerry, through the squall line, on short fuel.', after: 'Far Skerry has its warning glass before the storm season.' },
  engineOutGlide: { headline: 'DEAD STICK, ALIVE', type: 'landing', who: 'teodor', island: 'cinder', before: 'Ash in the air over Cinder. If the engine chokes, glide it home.', after: 'Dead stick and down in one piece. Teodor wants the filter.' },
  dockSurvey: { headline: 'ON FILM', type: 'haul', who: 'wren', island: 'saltmoor', before: 'The Port Halyard Board wants photographs of its own dock before it pays repairs.', after: 'The Board has its pictures. It pays, slowly, in full.' },
  buoySlalom: { headline: 'REGATTA FLOWN', type: 'ring', who: 'marta', island: 'halyard', before: 'Regatta day. Thread the buoys in front of the whole harbour, and the Board.', after: 'The harbour cheers. The clerk writes the last line in the ledger.' },
};

/** The contract for a mission, with a safe fallback so a missing beat never blocks a sortie. */
export function contractFor(id) {
  return CONTRACTS[id] ?? { headline: 'JOB DONE', type: 'haul', who: 'marta', island: 'halyard', before: 'Fly the job, bring her home.', after: 'Job done.' };
}

/**
 * The squeeze choice, offered once on the first sortie of chapter 3: the Board's charter
 * pays the note, the clinic run helps Saltmoor and pays less. Either way the debt moves.
 */
export const CHOICE = {
  id: 'clinicOrCharter',
  title: 'THE BOARD OR THE CLINIC',
  options: [
    { id: 'charter', label: 'Fly the Board\'s charter', paid: 1200, line: 'The Board\'s own cargo first. 1,200 sh off the note.', trust: { ansel: 1 } },
    { id: 'clinic', label: 'Fly the clinic\'s spare parts', paid: 300, line: 'Saltmoor clinic gets its generator. 300 sh from a grateful town.', trust: { ilse: 2 } },
  ],
  fallback: 'charter',
};

export const ENDINGS = {
  PAID: { word: 'PAID', title: 'PAID IN FULL', text: 'The Board tears up the note. The Tern is yours, and so is the Reach.' },
  PART: { word: 'PART-PAID', title: 'EXTENSION GRANTED', text: 'The Board stamps an extension: one more season to clear what is left.' },
  UNPAID: { word: 'UNPAID', title: 'LIEN ON THE TERN', text: 'The Board puts a lien on the Tern. She flies for the Board now.' },
};

/** Which ending a career reaches with `left` shillings still owed after the last sortie. */
export function endingFor(left) {
  if (left <= 0) return ENDINGS.PAID;
  return left <= EXTENSION_LIMIT ? ENDINGS.PART : ENDINGS.UNPAID;
}

/** The headline for a cleared objective: what the pilot just did, in a few words. */
export function objectiveHeadline(kind, contract, last) {
  if (last) return contract.headline;
  return { fire: 'FIRE OUT', drop: 'ON TARGET', ring: 'THROUGH', land: 'DOWN SAFE', reach: 'ON FILM', takeoff: 'AIRBORNE' }[kind] ?? 'DONE';
}
