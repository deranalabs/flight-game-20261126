// Damage to the Tern in four parts (engine, airframe, floats, controls), each 0..100 health,
// what hurts them, how hurt parts change the way she flies, and the plain line the HUD
// shows for each hurt part, its number taken from the same effects the flight model reads.

export const PARTS = ['engine', 'airframe', 'floats', 'controls'];
export const PART_NAMES = { engine: 'Engine', airframe: 'Airframe', floats: 'Floats', controls: 'Controls' };

export function makeDamage(start = {}) {
  return {
    engine: start.engine ?? 100,
    airframe: start.airframe ?? 100,
    floats: start.floats ?? 100,
    controls: start.controls ?? 100,
    log: [],
  };
}

/** Take damage; cause is a short phrase kept for the debrief. Returns the new health. */
export function hurt(dmg, part, amount, cause, t = 0) {
  if (amount <= 0) return dmg[part];
  const before = dmg[part];
  dmg[part] = Math.max(0, before - amount);
  const last = dmg.log[dmg.log.length - 1];
  if (last && last.part === part && last.cause === cause && t - last.t < 2) {
    last.amount += before - dmg[part];
    last.t = t;
  } else {
    dmg.log.push({ part, amount: before - dmg[part], cause, t });
  }
  return dmg[part];
}

/** Handling changes from damage, read by the flight model every step. */
export function damageEffects(dmg) {
  const e = dmg.engine / 100;
  const a = dmg.airframe / 100;
  const f = dmg.floats / 100;
  const c = dmg.controls / 100;
  return {
    thrustMul: 0.35 + 0.65 * e,
    rough: e < 0.6 ? (0.6 - e) * 1.6 : 0, // engine roughness 0..1
    clMaxLoss: (1 - a) * 0.45,
    dragAdd: (1 - a) * 0.03 + (1 - f) * 0.012,
    waterDragMul: 1 + (1 - f) * 1.4,
    floatPull: (1 - f) * 0.35, // yaw pull on water from a holed float
    ctrlEff: 0.45 + 0.55 * c,
    rollBias: (1 - c) * 0.12 + (1 - a) * 0.05, // a bent wing or aileron rolls her left
  };
}

/** Worst part and overall condition, for the HUD and the hangar. */
export function condition(dmg) {
  let worst = 'engine';
  for (const p of PARTS) if (dmg[p] < dmg[worst]) worst = p;
  const avg = PARTS.reduce((s, p) => s + dmg[p], 0) / PARTS.length;
  return { worst, worstHealth: dmg[worst], average: avg };
}

/** Repair cost in shillings to bring every part back to 100. */
export function repairCost(dmg) {
  const rate = { engine: 9, airframe: 7, floats: 5, controls: 6 };
  return Math.round(PARTS.reduce((s, p) => s + (100 - dmg[p]) * rate[p], 0));
}

/** Below this float health a water touchdown fills the holed float: no sea landing. */
export const FLOAT_SEA_MIN = 50;
export const noSeaLanding = (dmg) => dmg.floats < FLOAT_SEA_MIN;

const CLEAN_CL_MAX = 1.62;

/**
 * One line per hurt part, worst first: the part, its health and what it does in numbers.
 * Every number comes from damageEffects, which the flight model applies each step.
 */
export function damageLines(dmg, clMax = CLEAN_CL_MAX) {
  const fx = damageEffects(dmg);
  const pct = (v) => Math.round(v * 100);
  const hp = (p) => Math.round(dmg[p]);
  const out = [];
  if (dmg.engine < 100) out.push({ part: 'engine', text: `ENGINE ${hp('engine')}% · thrust −${pct(1 - fx.thrustMul)}%${fx.rough > 0 ? ', running rough' : ''}` });
  if (dmg.airframe < 100) out.push({ part: 'airframe', text: `L WING ${hp('airframe')}% · stall +${pct(Math.sqrt(clMax / (clMax - fx.clMaxLoss)) - 1)}%, rolls left` });
  if (dmg.controls < 100) out.push({ part: 'controls', text: `AILERONS ${hp('controls')}% · roll rate −${pct(1 - fx.ctrlEff)}%, rolls left` });
  if (dmg.floats < 100) out.push({ part: 'floats', text: `R FLOAT ${hp('floats')}% · pulls right on water, ${noSeaLanding(dmg) ? 'no sea landing' : `water drag +${pct(fx.waterDragMul - 1)}%`}` });
  return out.sort((a, b) => dmg[a.part] - dmg[b.part]);
}
