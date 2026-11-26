// Mission 8, Dead Stick over Cinder: an ash survey over the crater. Ash chokes the
// engine and it stops. Hold best glide, pick a field you can reach, and land without
// power. A restart (R) works once the ash clears, at a cost to the score.

import { landAny } from './objectives.js';
import { inFlight } from './startPoints.js';
import { LANDMARKS } from '../terrain/islandLayout.js';
import { killEngine } from '../systems/engine.js';

const CRATER = LANDMARKS.crater;

export default {
  id: 'engineOutGlide',
  order: 8,
  title: 'Dead Stick over Cinder',
  client: 'junie',
  place: 'Over the crater of Mount Cinder',
  summary: 'Your engine dies in an ash plume. Glide to a field and land without power.',
  brief: [
    'Junie wants ash samples from over the crater. The plume is thicker than she thought.',
    'When the engine quits, hold 60 kt: that is the Tern\'s best glide, about 9 to 1.',
    'Port Halyard, the harbour and the Saltmoor lane are all in reach from up here.',
  ],
  timeOfDay: 'dusk',
  weather: 'calm',
  windFrom: 200,
  seed: 83,
  start: inFlight(CRATER.x + 900, CRATER.z + 500, 650, 150, 44, 0.55),
  fuel: 0.5,
  pay: 1200,
  parTime: 300,
  build() {
    return [landAny(['halyard', 'halyardHarbour', 'saltmoorLane'], 'Glide to Port Halyard, the harbour or Saltmoor', { anyWater: true, bot: { gateAlt: 260, back: 2000 } })];
  },
  setup(ms) {
    ms.extra.failAt = 9;
    ms.extra.ashClears = 55;
    ms.radio.setState('junie', 'Sampling the plume');
  },
  beforeStep(ms) {
    const ac = ms.ac;
    if (ms.t >= ms.extra.failAt && !ms.extra.failed) {
      ms.extra.failed = true;
      killEngine(ac.engine, 'ash');
      ac.engineForcedOff = true;
      ms.radio.line('junie', 'Your engine just went quiet on my scope! That\'s the ash.', ms.t, 1);
      ms.radio.setState('junie', 'Watching you glide');
    }
    if (ms.extra.failed && ms.t >= ms.extra.ashClears) ac.engineForcedOff = false;
    if (ac.engine.running && ms.extra.failed && !ms.extra.restarted) {
      ms.extra.restarted = true;
      ms.radio.line('teodor', 'She caught! Good. Land anyway, I want to look at those cylinders.', ms.t);
    }
  },
  hud(ms) {
    if (!ms.extra.failed) return ['ENGINE FAILS SOON', 'warn'];
    return [ms.ac.engine.running ? 'ENGINE RESTARTED' : 'ENGINE OUT: GLIDE', ms.ac.engine.running ? 'warn' : 'bad'];
  },
  bonus(ms) {
    return ms.extra.restarted ? 0 : 500;
  },
  radio: {
    start: [
      ['junie', 'Circle east of the crater and I\'ll read the ash from here. Thin plume today.'],
    ],
    done: [['marta', 'Dead stick and down in one piece. That is a story for the hangar.']],
  },
};
