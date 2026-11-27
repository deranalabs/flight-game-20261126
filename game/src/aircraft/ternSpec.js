// The Tern Mk II amphibious floatplane: numbers the flight model flies, and how each
// hangar upgrade changes them. SI units: kg, m, N, m/s, litres.

export const TERN_BASE = {
  name: 'Tern Mk II',
  emptyMass: 1480,
  pilotMass: 85,
  wingArea: 30,
  wingSpan: 14.6,
  cl0: 0.25,
  clAlpha: 5.0, // per radian
  clMax: 1.62,
  flapClMax: 0.55, // extra CLmax at full flap
  flapCl0: 0.35,
  cd0: 0.042,
  flapCd: 0.035,
  inducedK: 0.052,
  maxThrust: 7200,
  propSpeed: 92, // m/s where thrust fades out
  vne: 74, // never exceed, m/s (144 kt)
  gLimit: 4.4,
  fuelCapacity: 260,
  fuelBurnIdle: 20, // litres an hour at idle
  fuelBurnFull: 120, // litres an hour at full throttle
  burnTimeScale: 6, // game hours pass faster than flight time for fuel
  gearHeight: 1.7, // pivot above the float keels
  rollPower: 1.7,
  pitchPower: 7.5,
  yawPower: 2.0,
  waterTankLitres: 0,
  cargoKg: 0,
  lights: 1,
};

/** Hangar upgrades: id, name, cost in shillings, what it changes. */
export const UPGRADES = [
  { id: 'longTank', name: 'Long-range wing tanks', cost: 900, blurb: '+130 L fuel, +40 kg', apply: (s) => { s.fuelCapacity += 130; s.emptyMass += 40; } },
  { id: 'stolFlaps', name: 'Slotted STOL flaps', cost: 1100, blurb: 'stall 6 kt lower with flaps', apply: (s) => { s.flapClMax += 0.35; s.flapCd += 0.008; } },
  { id: 'bigProp', name: 'Three-blade prop', cost: 1400, blurb: '+12% thrust, faster climb', apply: (s) => { s.maxThrust *= 1.12; s.propSpeed += 4; } },
  { id: 'strongFloats', name: 'Reinforced floats', cost: 700, blurb: 'takes harder touchdowns', apply: (s) => { s.floatToughness = 1.6; s.emptyMass += 25; } },
  { id: 'scoopTank', name: 'Belly scoop tank', cost: 800, blurb: '800 L water bomber tank', apply: (s) => { s.waterTankLitres = 800; s.emptyMass += 30; } },
  { id: 'nightKit', name: 'Night landing lights', cost: 500, blurb: 'brighter lights, lit gauges', apply: (s) => { s.lights = 2; } },
];

/** Refit-only parts, fitted from the refit cards and charged to the Board's note. */
export const REFIT_PARTS = [
  { id: 'sealedCowl', name: 'Sealed cowl', cost: 600, blurb: '-12% fuel burn at full power', apply: (s) => { s.fuelBurnFull *= 0.88; } },
  { id: 'cleanStruts', name: 'Faired struts', cost: 750, blurb: '-8% drag, faster cruise', apply: (s) => { s.cd0 *= 0.92; } },
  { id: 'longAilerons', name: 'Long-span ailerons', cost: 650, blurb: '+18% roll rate', apply: (s) => { s.rollPower *= 1.18; } },
  { id: 'tallRudder', name: 'Tall rudder', cost: 550, blurb: '+20% yaw authority on the water', apply: (s) => { s.yawPower *= 1.2; } },
  { id: 'vortexGens', name: 'Vortex generators', cost: 700, blurb: 'stall 3 kt lower, gentler break', apply: (s) => { s.clMax += 0.12; } },
  { id: 'lightCabin', name: 'Stripped cabin', cost: 500, blurb: '-60 kg, quicker climb', apply: (s) => { s.emptyMass -= 60; } },
];

export function buildSpec(upgradeIds = []) {
  const s = { ...TERN_BASE, floatToughness: 1 };
  for (const u of [...UPGRADES, ...REFIT_PARTS]) if (upgradeIds.includes(u.id)) u.apply(s);
  // Every mission that bombs water borrows the fire service tank if none is fitted.
  return s;
}

/** Stall speed in m/s at a mass and flap setting (0..1), level flight. */
export function stallSpeed(spec, mass, flaps = 0) {
  const clMax = spec.clMax + spec.flapClMax * flaps;
  return Math.sqrt((2 * mass * 9.81) / (1.225 * spec.wingArea * clMax));
}
