// The Cinder Reach gazetteer: the island chain as one table that missions, radio, the
// chart and the ledger read from. Naming rule: an island is a plain landscape word with a
// local noun (Halyard Isle, Mount Cinder); a person is a given name and a trade surname
// (Marta Quill, Teodor Brask). No real place or brand appears anywhere.

export const REACH = 'Cinder Reach';

export const GAZETTEER = [
  { id: 'halyard', name: 'Halyard Isle', harbour: 'Port Halyard', trade: 'mail', landmark: 'the Board House on the quay', custom: 'the regatta at season close', history: 'Founded as a coaling stop; the Board has run the quay ever since.' },
  { id: 'cinder', name: 'Mount Cinder', harbour: 'Ash Cove', trade: 'sulphur', landmark: 'the crater observatory', custom: 'no fires lit the night the mountain speaks', history: 'Last erupted in the year of the long ash; the cove was dug out by hand.' },
  { id: 'saltmoor', name: 'Saltmoor', harbour: 'Saltmoor Dock', trade: 'fish', landmark: 'the clinic with the green roof', custom: 'the first catch is left on the dock for whoever needs it', history: 'Burned twice, rebuilt twice, each time a street further from the sea.' },
  { id: 'tallow', name: 'Tallow Island', harbour: 'Brackwater', trade: 'timber', landmark: 'the ridge strip', custom: 'every new roof gets a pine bough', history: 'The pine slopes were planted by the first sawyers and are still counted tree by tree.' },
  { id: 'gannet', name: 'Gannet Point', harbour: 'Lantern Steps', trade: 'ice', landmark: 'the Gannet light', custom: 'keepers write the weather on the lamp-room wall', history: 'The light has turned every night but three in ninety years.' },
  { id: 'skerry', name: 'Far Skerry', harbour: 'Skerry Station', trade: 'ice', landmark: 'the storm glass mast', custom: 'visitors carry one stone up to the cairn', history: 'A weather station first, a village later, a village still too small for a doctor.' },
];

export function islandById(id) {
  return GAZETTEER.find((i) => i.id === id) ?? GAZETTEER[0];
}

/** The harbour radio's call for an island, as the tower voices it. */
export function harbourCall(id) {
  const isl = islandById(id);
  return `${isl.harbour.toUpperCase()} RADIO`;
}
