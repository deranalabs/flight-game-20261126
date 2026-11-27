// The people on the radio: who they are, where they sit, the state they are in right now,
// and what they say when something happens. Missions add their own scripted lines.

export const CAST = {
  marta: { name: 'Marta Quill', role: 'Port Halyard Tower', color: '#ffb347', home: 'Port Halyard', state: 'On shift' },
  teodor: { name: 'Teodor Brask', role: 'Hangar chief', color: '#9fd3ff', home: 'Teodor\'s Hangar', state: 'Wrench in hand' },
  ilse: { name: 'Dr. Ilse Varga', role: 'Saltmoor clinic', color: '#ff8fa3', home: 'Saltmoor', state: 'On call' },
  oren: { name: 'Chief Oren Hale', role: 'Tallow fire watch', color: '#ff7043', home: 'Brackwater', state: 'Watching the ridge' },
  pip: { name: 'Pip Calloway', role: 'Gannet Point keeper', color: '#c5e1a5', home: 'Gannet Point', state: 'Trimming wicks' },
  junie: { name: 'Junie Ashby', role: 'Cinder Observatory', color: '#b39ddb', home: 'Cinder Observatory', state: 'Reading the barometer' },
  wren: { name: 'Wren Tallis', role: 'Saltmoor post office', color: '#80cbc4', home: 'Saltmoor', state: 'Sorting sacks' },
  ansel: { name: 'Ansel Mott', role: 'Clerk, Port Halyard Board', color: '#e5482d', home: 'Port Halyard', state: 'Keeping the ledger' },
};

/** Lines for events every mission shares. {name} and {miss} are filled in. */
const GENERIC = {
  lowFuel: [['marta', 'Tern, you are showing low fuel on my board. Plan your landing now.']],
  fuelCritical: [['teodor', 'Fuel needle is on the peg. Whatever is under you, that is your field.']],
  overheat: [['teodor', 'Cylinder temp is in the red. Ease the throttle and give her some airspeed.']],
  stall: [['marta', 'Stall horn on your frequency! Nose down, wings level.']],
  damage: [['teodor', 'I heard that from here. She is flying hurt, take it gently.']],
  miss: [['wren', 'That one landed {miss} metres off {name}. Try releasing a touch earlier.']],
  ringMiss: [['junie', 'Missed {name}! Swing round and fly through the middle.']],
  fireHit: [['oren', 'Good drop on {name}! That knocked it right down.']],
  fireMiss: [['oren', 'Mostly steam and hillside. Lower and slower over {name}.']],
  hardLanding: [['marta', 'That was a firm arrival, Tern. Teodor will want to see those floats.']],
  softLanding: [['marta', 'Lovely touchdown. Couldn\'t have spilled a teacup.']],
  bounce: [['marta', 'Bounce! Hold the attitude, let her settle.']],
  engineOut: [['marta', 'Engine out? Best glide, pick your water, I am rolling the boat.']],
  lightning: [['junie', 'Lightning strike near you! Check your instruments.']],
  windShear: [['junie', 'Shear line over the ridge: expect a sink of a few hundred feet.']],
  crash: [['marta', 'Tern, Tern, do you read? ... Rescue boat is launching.']],
};

export function makeRadio(scripted = {}) {
  const cast = {};
  for (const [id, c] of Object.entries(CAST)) cast[id] = { ...c };
  const radio = {
    cast,
    queue: [],
    current: null,
    log: [],
    cooldown: {},
    /** Queue a line: who is a cast id, text is shown for a few seconds. */
    line(who, text, t, priority = 0) {
      const msg = { who, text, t, priority, name: cast[who]?.name ?? who, role: cast[who]?.role ?? '', color: cast[who]?.color ?? '#fff' };
      if (priority > 0) radio.queue.unshift(msg);
      else radio.queue.push(msg);
      radio.log.push(msg);
    },
    /** Say a generic or scripted event line, at most once every 12 s per event. */
    say(event, data = {}, t = 0) {
      if (radio.cooldown[event] && t - radio.cooldown[event] < 12) return;
      radio.cooldown[event] = t;
      const set = scripted[event] ?? GENERIC[event];
      if (!set) return;
      for (const [who, text] of set) radio.line(who, fill(text, data), t, event === 'crash' || event === 'stall' ? 1 : 0);
    },
    setState(who, state) { if (cast[who]) cast[who].state = state; },
    /** Advance: show each line for a time that depends on its length. */
    update(t) {
      // a call stays on screen after its time is up, until the next one comes in
      const expired = radio.current && t - radio.current.shownAt > radio.current.hold;
      if (expired) radio.current.stale = true;
      if ((!radio.current || expired) && radio.queue.length) {
        const m = radio.queue.shift();
        m.shownAt = t;
        m.hold = 2.8 + m.text.length * 0.045;
        radio.current = m;
      }
      return radio.current;
    },
  };
  return radio;
}

function fill(text, data) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (data[k] ?? `{${k}}`));
}
