// World events that change a sortie: each one is tied to a contract, shows a cue at the
// start of the flight (a banner and a clerk or tower line) and changes what the Board
// pays. Squall and ash change the flying itself through the mission's own weather.

export const EVENTS = [
  { id: 'squall', mission: 'stormCrossing', title: 'SQUALL FRONT', cue: 'A squall wall is closing on Far Skerry. Beat it across.', bonus: 250, who: 'junie' },
  { id: 'ash', mission: 'engineOutGlide', title: 'ASH PLUME', cue: 'The Cinder plume closes the north route. Ash in the intake is likely.', bonus: 200, who: 'junie' },
  { id: 'festival', mission: 'buoySlalom', title: 'REGATTA DAY', cue: 'Regatta day: the whole harbour on the wall, and the Board in the stand.', bonus: 300, who: 'marta' },
  { id: 'strike', mission: 'dockSurvey', title: 'FERRY STRIKE', cue: 'The ferries are out on strike. The Board pays more for every flight.', bonus: 350, who: 'ansel' },
];

/** The event on a mission's day, or null. */
export function eventFor(missionId) {
  return EVENTS.find((e) => e.mission === missionId) ?? null;
}
