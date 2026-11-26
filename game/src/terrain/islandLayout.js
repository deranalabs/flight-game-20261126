// The Cinder Reach island chain: every island, runway, water lane, village and landmark
// in metres. x runs east, z runs south, y is height above the sea. Heading 0 is north (-z).
// Terrain, missions, the bot and the map all read positions from here and nowhere else.
// Land pads and runways have no fixed height: heightmap.js resolves `elev` from the ground.

export const WORLD_HALF = 9500;
export const SEA_LEVEL = 0;

/** Islands: each is a bump of land; shape 'hills', 'ridge' or 'volcano'. */
export const ISLANDS = [
  { id: 'halyard', name: 'Halyard Isle', x: 0, z: 2000, r: 1900, h: 150, shape: 'hills', seed: 3 },
  { id: 'cinder', name: 'Mount Cinder', x: -200, z: -3000, r: 2300, h: 1150, shape: 'volcano', seed: 7 },
  { id: 'saltmoor', name: 'Saltmoor', x: 5400, z: 200, r: 1600, h: 190, shape: 'hills', seed: 11 },
  { id: 'tallow', name: 'Tallow Island', x: -5400, z: -100, r: 2300, h: 560, shape: 'ridge', seed: 13 },
  { id: 'gannet', name: 'Gannet Point', x: 2600, z: -6500, r: 560, h: 46, shape: 'hills', seed: 17 },
  { id: 'skerry', name: 'Far Skerry', x: 7900, z: 6900, r: 820, h: 70, shape: 'hills', seed: 19 },
];

/**
 * Landing places. Runways and strips are flat land pads; lanes are marked water.
 * hdg is the landing direction of the 'a' end (the reciprocal works too).
 */
export const RUNWAYS = {
  halyard: {
    id: 'halyard', name: 'Port Halyard 09/27', kind: 'runway',
    x: 0, z: 1100, hdg: 90, length: 1100, width: 30, elev: 0, numbers: ['09', '27'],
  },
  ridgeback: {
    id: 'ridgeback', name: 'Ridgeback Strip', kind: 'strip',
    x: -5150, z: -700, hdg: 0, length: 340, width: 18, elev: 0, numbers: ['36', '18'],
  },
  saltmoorLane: {
    id: 'saltmoorLane', name: 'Saltmoor Water Lane', kind: 'lane',
    x: 3750, z: 300, hdg: 0, length: 1000, width: 60, elev: 0, numbers: [],
  },
  gannetCove: {
    id: 'gannetCove', name: 'Gannet Cove', kind: 'lane',
    x: 2600, z: -5700, hdg: 270, length: 900, width: 70, elev: 0, numbers: [],
  },
  skerryLane: {
    id: 'skerryLane', name: 'Far Skerry Lane', kind: 'lane',
    x: 7000, z: 6750, hdg: 90, length: 900, width: 70, elev: 0, numbers: [],
  },
  halyardHarbour: {
    id: 'halyardHarbour', name: 'Halyard Harbour', kind: 'lane',
    x: 300, z: 4150, hdg: 90, length: 1200, width: 80, elev: 0, numbers: [],
  },
};

/** Flat pads cut into the terrain: villages, the hangar apron and the observatory. */
export const PADS = [
  { id: 'apron', x: 150, z: 1010, w: 280, d: 110, elev: 0 },
  { id: 'halyardTown', x: 700, z: 2500, w: 420, d: 300, elev: 0 },
  { id: 'saltmoorTown', x: 4550, z: 350, w: 380, d: 320, elev: 0 },
  { id: 'brackwater', x: -4300, z: 400, w: 300, d: 260, elev: 0 },
  { id: 'keeperYard', x: 2550, z: -6450, w: 150, d: 120, elev: 0 },
  { id: 'observatory', x: 950, z: -2650, w: 130, d: 130, elev: 0 },
  { id: 'skerryStation', x: 7950, z: 6950, w: 170, d: 150, elev: 0 },
];

/** Villages: house clusters drawn on their pads, also mail drop targets. */
export const VILLAGES = [
  { id: 'halyardTown', name: 'Halyard Town', x: 700, z: 2500, houses: 26, spread: 190 },
  { id: 'saltmoorTown', name: 'Saltmoor', x: 4550, z: 350, houses: 22, spread: 170 },
  { id: 'brackwater', name: 'Brackwater', x: -4300, z: 400, houses: 14, spread: 130 },
  { id: 'skerryStation', name: 'Far Skerry Station', x: 7950, z: 6950, houses: 4, spread: 55 },
];

export const LANDMARKS = {
  lighthouse: { name: 'Gannet Point Light', x: 2600, z: -6760, height: 34 },
  hangar: { name: 'Teodor\'s Hangar', x: 170, z: 990 },
  observatory: { name: 'Cinder Observatory', x: 950, z: -2650 },
  crater: { name: 'Cinder Crater', x: -200, z: -3000, r: 260 },
  dock: { name: 'Saltmoor Dock', x: 3990, z: 300 },
  fuelBarge: { name: 'Saltmoor Fuel Barge', x: 3700, z: 900 },
  lagoon: { name: 'Mirror Lagoon', x: -2700, z: 1900, r: 700 },
};

/** Forest fire sites on Tallow Island's eastern slopes (water-bomber mission). */
export const FIRE_SITES = [
  { id: 'north', name: 'North Gully', x: -4700, z: -1500 },
  { id: 'mid', name: 'Pine Shoulder', x: -4550, z: -300 },
  { id: 'south', name: 'Sawmill Slope', x: -4900, z: 1100 },
];

export function runwayEnds(rw) {
  const a = (rw.hdg * Math.PI) / 180;
  const dx = Math.sin(a) * rw.length * 0.5;
  const dz = -Math.cos(a) * rw.length * 0.5;
  // 'a' threshold is where a landing in direction hdg begins.
  return {
    a: { x: rw.x - dx, z: rw.z - dz },
    b: { x: rw.x + dx, z: rw.z + dz },
  };
}

/**
 * Where point (x, z) sits relative to a runway: along (m from centre, + toward
 * the far end of a landing on hdg), across (m right of centreline) and inside.
 */
export function runwayFrame(rw, x, z, landingHdg = rw.hdg) {
  const a = (landingHdg * Math.PI) / 180;
  const fx = Math.sin(a);
  const fz = -Math.cos(a);
  const dx = x - rw.x;
  const dz = z - rw.z;
  const along = dx * fx + dz * fz;
  const across = dx * -fz + dz * fx;
  return {
    along,
    across,
    inside: Math.abs(along) <= rw.length / 2 && Math.abs(across) <= rw.width / 2,
  };
}
