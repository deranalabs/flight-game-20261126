// Fuel: litres in the tanks, burn by throttle, time and range left at the present burn.
// Fuel weighs 0.72 kg a litre and its weight changes the aircraft's mass.

export const FUEL_KG_PER_L = 0.72;

export function makeFuelTank(spec, fraction = 1) {
  return { litres: spec.fuelCapacity * fraction, capacity: spec.fuelCapacity, burnLph: 0, empty: false };
}

/** Litres an hour of game time at a throttle (0..1) for a running engine. */
export function burnRate(spec, throttle, running) {
  if (!running) return 0;
  return spec.fuelBurnIdle + (spec.fuelBurnFull - spec.fuelBurnIdle) * throttle * throttle;
}

export function burnFuel(tank, spec, throttle, running, dt) {
  tank.burnLph = burnRate(spec, throttle, running);
  tank.litres = Math.max(0, tank.litres - (tank.burnLph * spec.burnTimeScale * dt) / 3600);
  tank.empty = tank.litres <= 0.01;
  return tank;
}

/** Minutes of flight left at the present burn (Infinity when the engine is off). */
export function enduranceMinutes(tank, spec) {
  if (tank.burnLph <= 0) return Infinity;
  return (tank.litres / (tank.burnLph * spec.burnTimeScale)) * 60;
}

/** Kilometres of range left at a ground speed in m/s. */
export function rangeKm(tank, spec, groundSpeed) {
  const min = enduranceMinutes(tank, spec);
  if (!Number.isFinite(min)) return Infinity;
  return (groundSpeed * min * 60) / 1000;
}

export function refuel(tank, litres) {
  tank.litres = Math.min(tank.capacity, tank.litres + litres);
  tank.empty = tank.litres <= 0.01;
  return tank;
}
