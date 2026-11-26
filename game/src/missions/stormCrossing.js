// Mission 7, Squall Line to Far Skerry: the weather station on Far Skerry has a broken
// barometer and a storm on top of it. You leave with 16 percent fuel into a headwind.
// The choice: press on, or put down at the Saltmoor fuel barge (time and pay lost).

import { takeoff, land, holdStill } from './objectives.js';
import { lineUp } from './startPoints.js';
import { RUNWAYS, runwayFrame } from '../terrain/islandLayout.js';
import { refuel, enduranceMinutes } from '../systems/fuelTank.js';
import { hurt } from '../systems/damageModel.js';
import { flyLanding, approachGate, flyTo } from '../flight/autopilot.js';
import { seededRandom } from '../util/noise.js';

const BARGE = RUNWAYS.saltmoorLane;

export default {
  id: 'stormCrossing',
  order: 7,
  title: 'Squall Line to Far Skerry',
  client: 'junie',
  place: 'Port Halyard to Far Skerry',
  summary: 'Cross a squall line to Far Skerry on low fuel. Refuel at Saltmoor or press on.',
  brief: [
    'Junie\'s station on Far Skerry needs barometer parts before the squall line hits it.',
    'You have 16 percent fuel and the tanker boat is late. The headwind is 26 kt with gusts.',
    'Saltmoor\'s fuel barge is on the way: land on its lane and hold for fuel, or press on.',
  ],
  timeOfDay: 'storm',
  weather: 'storm',
  windFrom: 135,
  seed: 71,
  start: lineUp('halyard', 180),
  fuel: 0.16,
  pay: 1300,
  parTime: 600,
  build(ms) {
    return [
      takeoff('Take off into the squall'),
      land('skerryLane', {}),
      holdStill('skerryLane', 6, 'Handing over the barometer parts', () => ms.radio.setState('junie', 'Station back on the air')),
    ];
  },
  setup(ms) {
    ms.extra.refuelled = false;
    ms.extra.rng = seededRandom(99);
    ms.extra.nextStrike = 40;
    ms.radio.setState('junie', 'Barometer broken');
  },
  update(ms, dt) {
    const ac = ms.ac;
    // the side option: stop at the barge
    if (!ms.extra.refuelled && ac.onSurface && ac.gs < 4) {
      const fr = runwayFrame(BARGE, ac.pos.x, ac.pos.z);
      if (Math.abs(fr.along) < BARGE.length / 2 + 200 && Math.abs(fr.across) < BARGE.width / 2 + 120) {
        ms.extra.bargeTime = (ms.extra.bargeTime ?? 0) + dt;
        if (ms.extra.bargeTime > 7) {
          refuel(ac.fuel, ac.fuel.capacity * 0.45);
          ms.extra.refuelled = true;
          ms.extra.payCut = 220;
          ms.extra.payCutNote = 'fuel stop at Saltmoor: 220 sh';
          ms.radio.line('wren', 'Barge has you topped up. Go on, the island is waiting.', ms.t);
        }
      }
    }
    // lightning: a strike now and then while airborne in the squall
    if (!ac.onSurface && ms.t > ms.extra.nextStrike) {
      const r = ms.extra.rng();
      ms.extra.nextStrike = ms.t + 25 + r * 30;
      ms.extra.flashAt = ms.t;
      if (r < 0.45) {
        hurt(ac.damage, r < 0.2 ? 'controls' : 'airframe', 6 + r * 10, 'lightning strike', ms.t);
        ms.say('lightning');
      }
    }
    if (ms.t > 2 && !ms.extra.toldFuel) {
      ms.extra.toldFuel = true;
      const min = enduranceMinutes(ac.fuel, ac.spec);
      ms.radio.line('teodor', `At this power you have about ${Math.round(min)} minutes of fuel. Skerry is eleven kilometres into wind.`, ms.t);
    }
  },
  /** The bot takes the safe choice: barge first, then Skerry. */
  botFly(ms, ctx) {
    if (ms.extra.refuelled || ms.index < 1) return false;
    const ac = ms.ac;
    const st = ms.extra.botBarge ?? (ms.extra.botBarge = { phase: 'gate' });
    if (st.phase === 'gate') {
      const g = approachGate(BARGE, 180, 2200);
      if (flyTo(ac, ms.ap, g.x, g.z, 250, 43, ctx.dt) < 300) { st.phase = 'land'; ms.ap.flare = false; }
    } else if (st.phase === 'land') {
      flyLanding(ac, ms.ap, BARGE, 180, ctx.dt);
      if (ac.onSurface && ac.gs < 4) st.phase = 'wait';
    } else {
      const c = ac.controls; c.throttle = 0; c.elevator = 0;
    }
    return true;
  },
  onObjective(ms, i) {
    if (i === 2 && ms.extra.refuelled) ms.extra.bargeUsed = true;
  },
  hud(ms) {
    return [ms.extra.refuelled ? 'BARGE FUEL TAKEN' : 'OPTION: SALTMOOR BARGE', ms.extra.refuelled ? 'dim' : 'warn'];
  },
  bonus(ms) {
    return ms.extra.refuelled ? 0 : 350;
  },
  radio: {
    start: [
      ['junie', 'The squall line is over Skerry now and moving your way. I need those parts, Tern.'],
      ['marta', 'Runway one-eight, wind one-three-five at twenty-six gusting forty. Your call.'],
    ],
    obj2: [['junie', 'You made it through that? Hold on the lane, I am coming down the slip.']],
    done: [['junie', 'Barometer is reading again. The fleet gets a proper warning tonight.']],
  },
};
