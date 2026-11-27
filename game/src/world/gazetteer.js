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

/**
 * Three hidden things on every island: a wreck, a shrine and a lost mail drop. at is the
 * offset from the island's centre as a share of its radius. Flying low over one finds it;
 * each pays FIND_PAY toward the note and goes in the logbook.
 */
export const FIND_PAY = 80;
const FIND_KINDS = [
  { kind: 'wreck', at: [0.62, 0.35] },
  { kind: 'shrine', at: [-0.4, -0.45] },
  { kind: 'mail', at: [-0.2, 0.62] },
];
const FIND_NAMES = {
  halyard: ['the coal tender Mabry', 'the quay saint', 'the lost regatta post'],
  cinder: ['the ash-buried dory', 'the crater cairn', 'the observatory mailbag'],
  saltmoor: ['the trawler Wendle', 'the net-mender\'s shrine', 'the clinic\'s parcel'],
  tallow: ['the log raft', 'the sawyers\' stone', 'the ridge post tin'],
  gannet: ['the keeper\'s skiff', 'the lamp shrine', 'the ice-house letters'],
  skerry: ['the storm-wrecked ketch', 'the cairn of stones', 'the station\'s last sack'],
};

/** Every hidden find placed on the island layout ([{ id, x, z, r }]). */
export function findSpots(layout) {
  const out = [];
  for (const isl of layout) {
    const names = FIND_NAMES[isl.id];
    if (!names) continue;
    FIND_KINDS.forEach((k, i) => out.push({ id: `${isl.id}:${k.kind}`, island: isl.id, kind: k.kind, name: names[i], x: isl.x + k.at[0] * isl.r, z: isl.z + k.at[1] * isl.r }));
  }
  return out;
}

export function islandById(id) {
  return GAZETTEER.find((i) => i.id === id) ?? GAZETTEER[0];
}

/** The harbour radio's call for an island, as the tower voices it. */
export function harbourCall(id) {
  const isl = islandById(id);
  return `${isl.harbour.toUpperCase()} RADIO`;
}
