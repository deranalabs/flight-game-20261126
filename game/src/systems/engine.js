// The Tern's radial engine: RPM, cylinder temperature, fuel starvation, failures and
// restarts. Thrust comes from here; the flight model turns it into force.

import { damageEffects, hurt } from './damageModel.js';

export function makeEngine(running = true) {
  return { running, rpm: running ? 1100 : 0, temp: 70, failed: null, crank: 0, restarts: 0, overheat: 0, sputter: 0 };
}

/** Stop the engine with a reason ('fuel', 'ash', 'seized', 'failure'). */
export function killEngine(eng, reason) {
  eng.running = false;
  eng.failed = reason;
  eng.crank = 0;
}

/**
 * Start cranking; the engine catches after 2.5 s unless it is out of fuel or seized.
 * A failure from ash clears on the second try (the plugs burn clean).
 */
export function tryRestart(eng, fuelLitres, dmg) {
  if (eng.running || eng.crank > 0) return false;
  if (fuelLitres <= 0.5 || eng.failed === 'seized' || dmg.engine < 12) return false;
  eng.crank = 2.5;
  eng.restarts += 1;
  return true;
}

/**
 * Advance the engine. Returns thrust in newtons along the nose.
 * airspeed in m/s, throttle 0..1, dmg is mutated for overheat damage.
 */
export function stepEngine(eng, spec, throttle, airspeed, fuelLitres, dmg, dt, t, forcedOff = false) {
  const fx = damageEffects(dmg);
  if (eng.crank > 0) {
    eng.crank -= dt;
    eng.rpm = 260 + Math.sin(t * 30) * 60;
    if (eng.crank <= 0) {
      const ok = !forcedOff && fuelLitres > 0.5 && (eng.failed !== 'ash' || eng.restarts >= 2) && dmg.engine >= 12;
      if (ok) { eng.running = true; eng.failed = null; }
    }
  }
  if (eng.running && fuelLitres <= 0.01) killEngine(eng, 'fuel');
  if (eng.running && forcedOff) killEngine(eng, eng.failed ?? 'failure');
  if (eng.running && dmg.engine <= 0) killEngine(eng, 'seized');

  const target = eng.running ? 650 + throttle * 1850 * (0.6 + 0.4 * fx.thrustMul) : Math.min(airspeed * 18, 900);
  eng.rpm += (target - eng.rpm) * Math.min(1, dt * 2.2);
  // rough running: rpm wobble and lost thrust from a hurt engine
  eng.sputter = eng.running ? fx.rough * (0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 2.1)) : 0;

  // Cylinder temperature: heats with power, cools with airflow.
  const heat = eng.running ? 50 + throttle * 80 : 15;
  const cool = airspeed * 0.75;
  const tempTarget = Math.max(15, heat - cool + 10);
  eng.temp += (tempTarget - eng.temp) * Math.min(1, dt * 0.03);
  if (eng.temp > 108) {
    eng.overheat += dt;
    hurt(dmg, 'engine', (eng.temp - 108) * 0.04 * dt, 'overheated the engine', t);
  } else {
    eng.overheat = Math.max(0, eng.overheat - dt);
  }

  if (!eng.running) return 0;
  const speedFade = Math.max(0, 1 - airspeed / spec.propSpeed);
  return spec.maxThrust * throttle * fx.thrustMul * speedFade * (1 - eng.sputter * 0.5);
}
