// Mission 9, Harbour Board Survey: a photo run for the Saltmoor Harbour Board. Fly over
// the observatory, the Saltmoor dock and the fuel barge with the camera running, then
// bring the film down onto the Saltmoor water lane.

const STOPS = ['observatory', 'dock', 'fuelBarge'];

export default {
  id: 'dockSurvey',
  order: 9,
  title: 'Harbour Board Survey',
  client: 'wren',
  place: 'Cinder Observatory to Saltmoor Dock',
  summary: 'Photograph the observatory, the Saltmoor dock and the fuel barge, then land the film at Saltmoor.',
  brief: [
    'The Saltmoor Harbour Board wants new photographs before it signs the dock repairs.',
    'Pass over each mark inside its circle: the belly camera fires on its own.',
    'Start with the observatory on Mount Cinder, keep well clear of the crater rim.',
  ],
  timeOfDay: 'day',
  weather: 'breezy',
  windFrom: 250,
  seed: 91,
  start: (k) => k.lineUp('halyard', 0),
  fuel: 0.7,
  payloadKg: 40,
  pay: 900,
  parTime: 540,
  build(ms, k) {
    const shots = STOPS.map((id) => {
      const p = k.LANDMARKS[id];
      return k.reach(p.x, p.z, 220, p.name, Math.max(0, k.groundHeight(p.x, p.z)) + 150);
    });
    return [
      k.takeoff('Take off from Port Halyard, runway 36'),
      ...shots,
      k.land('saltmoorLane', {}),
    ];
  },
  setup(ms) {
    ms.extra.photos = 0;
    ms.radio.setState('wren', 'Waiting on the Harbour Board');
  },
  radio: {
    start: [
      ['wren', 'The Harbour Board wants three photographs: observatory, dock and fuel barge.'],
      ['marta', 'Runway three-six, wind two-five-zero at fourteen. Observatory is north on the mountain.'],
    ],
    obj2: [['junie', 'I saw you pass! Saltmoor dock next, east across the strait.']],
    obj3: [['wren', 'Dock is on film. The fuel barge is moored just south of it.']],
    obj4: [['wren', 'That is all three. Land on the water lane and I will take the film.']],
    done: [['wren', 'The Board will have its pictures by supper. Good flying.']],
  },
  onObjective(ms, i, obj) {
    if (obj.kind === 'reach') ms.extra.photos += 1;
    if (i === 5) ms.radio.setState('wren', 'Film delivered');
  },
};
