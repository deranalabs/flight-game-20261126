// Mission 1, First Light Mail Run: two mail sacks dropped on village squares from low
// and slow, then the last sack carried by hand onto the Saltmoor water lane.

export default {
  id: 'mailRun',
  order: 1,
  title: 'First Light Mail Run',
  client: 'wren',
  place: 'Halyard Town and Saltmoor',
  summary: 'Drop two mail sacks on village squares, then land the last one at Saltmoor.',
  brief: [
    'Wren Tallis has the morning post sorted into three sacks.',
    'Release over the square a little before you reach it: a sack keeps your speed as it falls.',
    'Below 300 ft and under 80 kt the sacks land where you aim them.',
  ],
  timeOfDay: 'morning',
  weather: 'breezy',
  windFrom: 260,
  seed: 11,
  start: (k) => k.lineUp('halyard', 180),
  fuel: 0.7,
  payloadKg: 60,
  pay: 520,
  parTime: 360,
  missAllowance: 1,
  build(ms, k) {
    const town = k.VILLAGES.find((v) => v.id === 'halyardTown');
    const salt = k.VILLAGES.find((v) => v.id === 'saltmoorTown');
    return [
      k.takeoff('Take off from Port Halyard, runway 18'),
      k.drop(town.x, town.z, 55, 'Halyard Town square'),
      k.drop(salt.x, salt.z, 55, 'Saltmoor square'),
      k.land('saltmoorLane', {}),
    ];
  },
  radio: {
    start: [
      ['marta', 'Morning, Tern. Wind two-six-zero at twelve, runway one-eight is yours.'],
      ['wren', 'First sack is for Halyard Town, the square by the red roofs. Mind the chimneys.'],
    ],
    obj2: [['wren', 'Right on the square! Saltmoor next, east across the strait.']],
    obj3: [['wren', 'Saltmoor has it. Last sack goes by hand: put her down on the water lane.']],
    done: [['wren', 'Post\'s in. I\'ll have tea waiting at the dock next time.']],
  },
  onObjective(ms, i) {
    if (i === 4) ms.radio.setState('wren', 'Post delivered');
  },
};
