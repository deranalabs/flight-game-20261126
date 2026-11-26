// Mission 4, Ridgeback Short Strip: fire pumps for the ridge crew. A 380 m dirt strip on
// the spine of Tallow Island: slow, full flap, touch down on the numbers, brake hard,
// unload, and get out again before the end of the strip.

import { takeoff, land, holdStill } from './objectives.js';
import { lineUp } from './startPoints.js';

export default {
  id: 'shortStrip',
  order: 4,
  title: 'Ridgeback Short Strip',
  client: 'oren',
  place: 'Tallow Island ridge',
  summary: 'Land 220 kg of pumps on a 380 m ridge strip, unload, and fly home.',
  brief: [
    'Chief Oren Hale needs two pumps on the Ridgeback strip before the dry wind turns.',
    'The strip is 380 m of dirt on the spine at 700 ft. Land uphill to the south, full flap, 50 kt.',
    'Hold the brakes (B) after touchdown. Running off the end means rocks.',
  ],
  timeOfDay: 'day',
  weather: 'breezy',
  windFrom: 170,
  seed: 41,
  start: lineUp('halyard', 270),
  fuel: 0.6,
  payloadKg: 220,
  pay: 780,
  parTime: 600,
  build(ms) {
    return [
      takeoff('Take off from Port Halyard'),
      land('ridgeback', { bot: { aim: 50, glideDeg: 5, back: 2400 } }),
      holdStill('ridgeback', 6, 'Unloading the pumps', () => {
        ms.ac.payloadKg = Math.max(0, ms.ac.payloadKg - 220);
        ms.radio.setState('oren', 'Pumps on the ridge');
      }),
      takeoff('Turn round and take off downhill from Ridgeback', 0),
      land('halyard', {}),
    ];
  },
  update(ms) {
    const L = ms.ac.lastLanding;
    if (L && !L.used && L.runway && L.runway.id === 'ridgeback' && L.stoppedInside === false) {
      ms.fail('Rolled off the end of Ridgeback Strip into the scree');
    }
  },
  radio: {
    start: [
      ['oren', 'Ridgeback strip is marked with white rocks. Land south, uphill helps you stop. Leave downhill, to the north.'],
      ['teodor', 'Remember the flaps. She floats a long way with them up.'],
    ],
    obj2: [['oren', 'Down and stopped! Hold her there, we are rolling the pumps out.']],
    obj3: [['oren', 'Pumps are off. Light now, she will jump off the strip.']],
    obj4: [['marta', 'Welcome back to the circuit, Tern. Halyard is yours.']],
    done: [['oren', 'Ridge crew has water pressure. Drinks are on the fire service.']],
  },
};
