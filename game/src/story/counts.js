// What ships, counted from the data and never typed by hand: the cover, the title strip,
// the board and the README all show these numbers.

import { FEATS } from '../hangar/feats.js';
import { REFITS } from '../hangar/refits.js';
import { CHAPTERS, MISSION_TYPES, contractFor } from './storyline.js';
import { GAZETTEER } from '../world/gazetteer.js';

/** Counts for a board of missions (the mission list is passed in, so this file stays first). */
export function shipCounts(missions) {
  const types = new Set(missions.map((m) => contractFor(m.id).type));
  return {
    sorties: missions.length,
    feats: FEATS.length,
    refits: REFITS.length,
    missionTypes: types.size,
    typeNames: [...types].map((t) => MISSION_TYPES[t]),
    chapters: CHAPTERS.length,
    islands: GAZETTEER.length,
  };
}

/** The one-line scope: "10 SORTIES · 4 MISSION TYPES · 25 FEATS · 12 REFITS". */
export function scopeLine(missions) {
  const n = shipCounts(missions);
  return `${n.sorties} SORTIES · ${n.missionTypes} MISSION TYPES · ${n.feats} FEATS · ${n.refits} REFITS`;
}

/** The README's counts line, written by tools/readmeCounts.mjs. */
export function readmeCountsLine(missions) {
  const n = shipCounts(missions);
  return `**${scopeLine(missions)}** · ${n.chapters} chapters · ${n.islands} islands`;
}
