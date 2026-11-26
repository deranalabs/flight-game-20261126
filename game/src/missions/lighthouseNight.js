// Mission 6, Gannet Point Lantern: night. The Gannet Point light has failed and Pip
// Calloway needs a new lamp lens before the fishing fleet comes home. Follow the flare
// gates up the coast, land in the cove between the buoys, and the light comes back on.

const GATES = [
  [1400, -800, 260, 'Channel flare'],
  [2300, -3300, 300, 'Cinder East flare'],
  [2500, -4800, 230, 'Cove approach flare'],
];

export default {
  id: 'lighthouseNight',
  order: 6,
  title: 'Gannet Point Lantern',
  client: 'pip',
  place: 'Night run to Gannet Point',
  summary: 'Fly the flare gates by night and land a new lamp lens in Gannet Cove.',
  brief: [
    'The Gannet Point light went dark at sunset and the fishing fleet is due home.',
    'Three flare gates mark a safe line up the coast, clear of Mount Cinder.',
    'Gannet Cove is lit by buoys. Use your landing light (L) and watch the altimeter.',
  ],
  timeOfDay: 'night',
  weather: 'calm',
  windFrom: 280,
  seed: 61,
  start: (k) => k.lineUp('halyard', 0),
  fuel: 0.6,
  pay: 1000,
  parTime: 540,
  build(ms, k) {
    const gates = GATES.map(([x, z, y, name], i) => {
      const [nx, , nz] = GATES[Math.min(GATES.length - 1, i + 1)];
      const hdg = i === GATES.length - 1 ? 0 : ((Math.atan2(nx - x, -(nz - z)) * 180) / Math.PI + 360) % 360;
      return k.ring(x, Math.max(y, k.groundHeight(x, z) + 140), z, 55, hdg, name);
    });
    return [
      k.takeoff('Take off from Port Halyard'),
      ...gates,
      k.land('gannetCove', {}),
      k.holdStill('gannetCove', 6, 'Handing the lens to Pip', () => {
        ms.extra.lightOn = true;
        ms.radio.setState('pip', 'Light burning');
      }),
    ];
  },
  setup(ms) {
    ms.extra.lightOn = false;
    ms.radio.setState('pip', 'Lamp dark, waiting on the jetty');
  },
  radio: {
    start: [
      ['pip', 'It is black as tar up here. The fleet is two hours out. I have the jetty lantern lit.'],
      ['marta', 'Night departure, runway three-six. First flare is over the channel, northeast.'],
    ],
    obj2: [['marta', 'Through the channel flare. Next one is east of Cinder. Stay above a thousand.']],
    obj4: [['pip', 'I can hear your engine! The cove buoys are lit, land between them heading west.']],
    obj5: [['pip', 'You found the cove in the dark! Hold there, I am rowing out.']],
    done: [['pip', 'There she goes! The fleet will see Gannet Light tonight.']],
  },
};
