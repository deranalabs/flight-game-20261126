// Mission 3, Saltmoor Medevac: a patient waits at the Saltmoor dock. Land gently, take
// them aboard, and bring them to Port Halyard. Hard touchdowns, high g and rough air
// all hurt the patient; time aboard slowly does too.

import { takeoff, land, holdStill } from './objectives.js';
import { lineUp } from './startPoints.js';

export default {
  id: 'medevac',
  order: 3,
  title: 'Saltmoor Medevac',
  client: 'ilse',
  place: 'Saltmoor to Port Halyard',
  summary: 'Pick up a patient on the Saltmoor lane and land them softly at Port Halyard.',
  brief: [
    'Dr. Ilse Varga has a fisherman with a broken hip at the Saltmoor dock.',
    'Touch down softer than 450 ft/min on the water, and softer than 300 ft/min with the patient aboard.',
    'Keep the turns gentle: every hard pull and every bump shows on the patient\'s chart.',
  ],
  timeOfDay: 'dusk',
  weather: 'breezy',
  windFrom: 20,
  seed: 31,
  start: lineUp('halyard', 0),
  fuel: 0.65,
  pay: 900,
  parTime: 560,
  build(ms) {
    return [
      takeoff('Take off from Port Halyard'),
      land('saltmoorLane', { maxFpm: 450, cargo: 'the floats and the stretcher crew' }),
      holdStill('saltmoorLane', 8, 'Stretcher coming aboard', () => {
        ms.extra.patientAboard = true;
        ms.ac.payloadKg += 160;
        ms.radio.setState('ilse', 'Riding in back with the patient');
      }),
      takeoff('Take off with the patient'),
      land('halyard', { maxFpm: 300, cargo: 'the patient', failText: undefined }),
    ];
  },
  setup(ms) {
    ms.extra.patient = 100;
    ms.extra.patientAboard = false;
  },
  update(ms, dt) {
    if (!ms.extra.patientAboard) return;
    const ac = ms.ac;
    let loss = 0.07 * dt; // slowly worse with time
    if (Math.abs(ac.g - 1) > 0.45) loss += (Math.abs(ac.g - 1) - 0.45) * 6 * dt;
    if (ac.events.some((e) => e.type === 'bounce')) loss += 6;
    ms.extra.patient = Math.max(0, ms.extra.patient - loss);
    const p = ms.extra.patient;
    ms.radio.setState('ilse', p > 70 ? 'Patient stable' : p > 40 ? 'Patient in pain' : 'Patient critical');
    if (p < 45 && !ms.extra.warned) { ms.extra.warned = true; ms.radio.line('ilse', 'He is not doing well back here. Smooth air, please, and quickly.', ms.t, 1); }
    if (p <= 0) ms.fail('The patient did not survive the flight');
  },
  hud(ms) {
    return ms.extra.patientAboard ? [`PATIENT ${Math.round(ms.extra.patient)}%`, ms.extra.patient > 60 ? 'good' : ms.extra.patient > 35 ? 'warn' : 'bad'] : null;
  },
  bonus(ms) {
    return Math.round((ms.extra.patient ?? 0) * 3);
  },
  radio: {
    start: [
      ['marta', 'Tern, medevac priority. Runway three-six, wind zero-two-zero light.'],
      ['ilse', 'He is strapped to the board at the dock. Gentle on the water, please.'],
    ],
    obj2: [['ilse', 'Good, nice and soft. Taxi to us and hold still while we load him.']],
    obj3: [['ilse', 'He is aboard. Smooth climb, no steep turns.']],
    obj4: [['marta', 'Halyard is clear for you, ambulance is at the apron. Softly does it.']],
    done: [['ilse', 'Feather landing. The ambulance has him. Thank you, Tern.']],
  },
  onObjective(ms, i) {
    if (i === 5) ms.radio.setState('ilse', 'Patient handed over');
  },
};
