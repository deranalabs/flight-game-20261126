// Mission 2, Cinder Ring Trial: eight rings around Mount Cinder against the clock,
// each at its own height, then home to Port Halyard. Rewards smooth turns and throttle.

import { ring, landAny } from './objectives.js';
import { inFlight } from './startPoints.js';
import { groundHeight } from '../terrain/heightmap.js';

// x, z, height above sea (raised to clear the ground), name
const COURSE = [
  [300, -700, 300, 'Channel Gate'],
  [1300, -1900, 420, 'Observatory Shoulder'],
  [1600, -3300, 520, 'East Gully'],
  [800, -4900, 460, 'North Lip'],
  [-900, -5300, 380, 'Gannet Approach'],
  [-2200, -4100, 450, 'West Scarp'],
  [-2500, -2500, 380, 'Lava Fan'],
  [-1600, -900, 260, 'Home Gate'],
];

function facing(i) {
  const [x, , z] = COURSE[i];
  const [nx, , nz] = COURSE[Math.min(COURSE.length - 1, i + 1)];
  const [px, , pz] = COURSE[Math.max(0, i - 1)];
  const dx = (i === COURSE.length - 1 ? x - px : nx - px);
  const dz = (i === COURSE.length - 1 ? z - pz : nz - pz);
  return ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
}

export default {
  id: 'ringCourse',
  order: 2,
  title: 'Cinder Ring Trial',
  client: 'junie',
  place: 'Around Mount Cinder',
  summary: 'Fly eight rings around the volcano inside nine minutes, then land at home.',
  brief: [
    'Junie Ashby hung survey rings on balloons around Mount Cinder for the island air race.',
    'Each ring has its own height. Plan the climbs: full power is hot, a dive is fast.',
    'Rough air rolls off the peak on the downwind side.',
  ],
  timeOfDay: 'day',
  weather: 'breezy',
  windFrom: 300,
  seed: 23,
  start: inFlight(0, 600, 220, 340, 44, 0.65),
  fuel: 0.6,
  pay: 650,
  parTime: 600,
  timeLimit: 900,
  timeLimitText: 'The balloons drifted off before you finished the course',
  build() {
    const rings = COURSE.map(([x, z, y, name], i) => ring(x, Math.max(y, groundHeight(x, z) + 130), z, 48, facing(i), name));
    return [...rings, landAny(['halyard', 'halyardHarbour'], 'Land at Port Halyard or the harbour')];
  },
  radio: {
    start: [
      ['junie', 'Clock is running, Tern! Channel Gate first, then sunwise round the mountain.'],
      ['marta', 'Race traffic only around Cinder. Keep above the balloon lines.'],
    ],
    obj3: [['junie', 'Three down. East Gully next, she sits high, start climbing now.']],
    obj5: [['junie', 'Half way! The north lip gets bumpy in a westerly.']],
    obj8: [['junie', 'Home Gate! Bring her in to Halyard and I\'ll read out your time.']],
    done: [['junie', 'Course flown! I am writing your time on the observatory board.']],
  },
  bonus(ms) {
    return ms.t < 480 ? 150 : 0;
  },
};
