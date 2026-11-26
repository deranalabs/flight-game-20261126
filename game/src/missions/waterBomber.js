// Mission 5, Tallow Ridge Fire: three fires on the slopes of Tallow Island. Skim Mirror
// Lagoon to fill the borrowed 800 L belly tank, fly low over a fire and release. Fires
// you leave alone grow back; smoke and heat over them are rough on the engine.

export default {
  id: 'waterBomber',
  order: 5,
  title: 'Tallow Ridge Fire',
  client: 'oren',
  place: 'Mirror Lagoon and Tallow Island',
  summary: 'Scoop water from the lagoon and put out three spreading fires.',
  brief: [
    'Three fires are climbing the east slopes of Tallow Island toward Brackwater.',
    'Skim Mirror Lagoon above 28 kt on the floats to fill the tank, then lift off.',
    'Release (Space) below 300 ft, a little before the flames. A fire you leave grows back.',
  ],
  timeOfDay: 'day',
  weather: 'breezy',
  windFrom: 300,
  seed: 53,
  lends: ['scoopTank'],
  start: (k) => k.lineUp('mirrorLagoon', 0, 0),
  fuel: 0.75,
  pay: 1100,
  parTime: 720,
  build(ms, k) {
    ms.extra.fires = k.FIRE_SITES.map((f) => ({ ...f, r: 75, intensity: 0.9 }));
    const [north, mid, south] = ms.extra.fires;
    const objs = [];
    for (const fire of [south, mid, north]) {
      objs.push(k.scoop('mirrorLagoon', 800));
      objs.push(k.bombFire(fire, fire.name));
    }
    objs.push(k.landAny(['mirrorLagoon', 'halyardHarbour', 'halyard'], 'Land at the lagoon, the harbour or Port Halyard'));
    return objs;
  },
  update(ms, dt) {
    const ac = ms.ac;
    const { groundHeight, hurt } = ms.kit;
    ms.kit.fillScoopTank(ac, dt);
    for (const f of ms.extra.fires) {
      if (f.intensity > 0.05) f.intensity = Math.min(1, f.intensity + 0.0022 * dt);
      else f.intensity = 0;
      // flying through the smoke column low: heat and grit
      const d = Math.hypot(ac.pos.x - f.x, ac.pos.z - f.z);
      const agl = ac.pos.y - Math.max(0, groundHeight(ac.pos.x, ac.pos.z));
      if (f.intensity > 0.1 && d < f.r * 0.8 && agl < 22) hurt(ac.damage, 'engine', 2.5 * dt * f.intensity, 'flew through the flames', ms.t);
    }
    const lit = ms.extra.fires.filter((f) => f.intensity > 0.05).length;
    ms.radio.setState('oren', lit === 0 ? 'Fires out' : `${lit} fire${lit > 1 ? 's' : ''} burning`);
  },
  hud(ms) {
    return [`TANK ${Math.round(ms.ac.waterKg)} L`, ms.ac.waterKg > 600 ? 'good' : ms.ac.waterKg > 0 ? 'warn' : 'dim'];
  },
  bonus(ms) {
    return ms.score.waterDrops.filter((d) => d.knock > 80).length * 60;
  },
  radio: {
    start: [
      ['oren', 'Sawmill Slope is closest to the houses. Hit that one first.'],
      ['teodor', 'Tank is bolted on. She will be heavy and slow with a full load, mind the stall.'],
    ],
    obj2: [['oren', 'Sawmill Slope is out! Pine Shoulder next, north of Brackwater.']],
    obj4: [['oren', 'Pine Shoulder is down. North Gully is the big one.']],
    obj6: [['oren', 'All three out. The ridge crew is cheering. Bring her home.']],
    done: [['oren', 'Brackwater is safe. The whole island owes you a drink.']],
  },
};
