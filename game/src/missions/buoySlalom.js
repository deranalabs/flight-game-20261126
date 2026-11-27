// Mission 10, Harbour Buoy Slalom: the regatta's air display. Weave through six rings
// hung low over the buoys off Halyard Harbour, then land on the harbour lane.

// x, z, height above the sea, name: low over the water, alternating sides of the line
const BUOYS = [
  [-1400, 4750, 60, 'West buoy'],
  [-600, 4520, 60, 'Red buoy'],
  [200, 4780, 60, 'Green buoy'],
  [1000, 4520, 60, 'Bell buoy'],
  [1800, 4780, 60, 'Mark buoy'],
  [2600, 4550, 60, 'East buoy'],
];

function facing(i) {
  const [x, z] = BUOYS[Math.max(0, i - 1)];
  const [nx, nz] = BUOYS[Math.min(BUOYS.length - 1, i + 1)];
  return ((Math.atan2(nx - x, -(nz - z)) * 180) / Math.PI + 360) % 360;
}

export default {
  id: 'buoySlalom',
  order: 10,
  title: 'Harbour Buoy Slalom',
  client: 'marta',
  place: 'Off Halyard Harbour',
  summary: 'Weave six low rings over the regatta buoys, then land on Halyard Harbour.',
  brief: [
    'The harbour regatta wants an air display: six rings hang low over the buoys.',
    'The rings sit 200 ft above the sea. Keep the turns shallow, a steep bank sinks you.',
    'After the east buoy, land on the harbour lane in front of the crowd.',
  ],
  timeOfDay: 'dusk',
  weather: 'calm',
  windFrom: 90,
  seed: 101,
  start: (k) => k.lineUp('halyard', 180),
  fuel: 0.6,
  pay: 1100,
  parTime: 480,
  missAllowance: 0,
  build(ms, k) {
    const rings = BUOYS.map(([x, z, y, name], i) => k.ring(x, y, z, 36, facing(i), name, false, true));
    return [
      k.takeoff('Take off from Port Halyard, runway 18'),
      ...rings,
      k.land('halyardHarbour', {}),
    ];
  },
  setup(ms) {
    ms.radio.setState('marta', 'Calling the regatta');
  },
  radio: {
    start: [
      ['marta', 'Regatta display, Tern. Runway one-eight, then the west buoy off the harbour.'],
      ['marta', 'Six rings, low and slow. The crowd is on the harbour wall.'],
    ],
    after: {
      'West buoy': [['marta', 'Through the west buoy! Red buoy next, weave left.']],
      'Green buoy': [['marta', 'Half the course. The crowd is on its feet.']],
      'East buoy': [['marta', 'East buoy cleared! Land on the harbour lane, wind is from the east.']],
    },
    done: [['marta', 'What a display. The regatta is buying your fuel tonight.']],
  },
  onObjective(ms, i, obj) {
    if (obj.kind === 'land') ms.radio.setState('marta', 'Display flown');
  },
};
