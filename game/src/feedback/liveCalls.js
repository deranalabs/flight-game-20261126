// Live feedback strings that answer the flying: turn quality while banked, the ring
// streak, approach callouts down final, the flare, and awards for holding a speed band.
// trackCalls runs every fixed step inside the mission (so the headless bot earns the same
// counts the feats read); callsFor builds the lines the HUD shows this frame.

// No imports: the caller hands in the approach (glidepath.currentApproach, which already
// carries the PAPI count and the HIGH / ON / LOW word), so this file reads only the mission.
const DEG = 180 / Math.PI;
const MS_TO_KT = 1.943844;
const MS_TO_FPM = 196.8504;
/** A turn counts once the bank passes this and is held for TURN_HOLD seconds. */
export const TURN_BANK = 20;
const TURN_HOLD = 3;
/** Slip under this (degrees of sideslip) is a centred ball. */
export const SLIP_CENTRED = 2.5;
/** Cruise band: hold within ±BAND_HALF kt of the band centre for BAND_HOLD seconds. */
export const BAND_CENTRE = 85;
const BAND_HALF = 6;
const BAND_HOLD = 12;
/** Height (ft above the surface) where the approach call says MINIMUMS. */
const MINIMUMS_FT = 300;

/** The counters the feats read, kept on the mission. */
export function newCallStats() {
  return { cleanTurns: 0, slipTurns: 0, turnT: 0, turnSlip: 0, bandT: 0, bandAwards: 0, onSlopeT: 0, maxG: 1, minG: 1, flashText: null, flashUntil: 0 };
}

/** Step the counters by dt seconds of flight; ap is the current approach or null. */
export function trackCalls(ms, dt, ap) {
  const st = ms.calls ?? (ms.calls = newCallStats());
  const ac = ms.ac;
  if (ac.onSurface) { st.turnT = 0; st.bandT = 0; return st; }
  st.maxG = Math.max(st.maxG, ac.g);
  st.minG = Math.min(st.minG, ac.g);
  const bank = Math.abs(ac.bank);
  const slip = Math.abs(ac.beta) * DEG;
  if (bank > TURN_BANK) {
    st.turnT += dt;
    st.turnSlip = Math.max(st.turnSlip, slip);
  } else if (st.turnT > 0) {
    if (st.turnT >= TURN_HOLD) {
      const clean = st.turnSlip < SLIP_CENTRED * 2;
      if (clean) st.cleanTurns += 1; else st.slipTurns += 1;
      flash(ms, clean ? `CLEAN TURN x${st.cleanTurns}` : 'SLIPPY TURN · MORE RUDDER', 2.5);
    }
    st.turnT = 0;
    st.turnSlip = 0;
  }
  const kt = ac.ias * MS_TO_KT;
  if (Math.abs(kt - BAND_CENTRE) < BAND_HALF && bank < TURN_BANK) {
    st.bandT += dt;
    if (st.bandT >= BAND_HOLD) {
      st.bandT = 0;
      st.bandAwards += 1;
      flash(ms, `SPEED BAND · ${Math.round(kt)} KT HELD · x${st.bandAwards}`, 2.5);
    }
  } else st.bandT = 0;
  if (ap && ap.word === 'ON') st.onSlopeT += dt;
  return st;
}

function flash(ms, text, secs) {
  ms.calls.flashText = text;
  ms.calls.flashUntil = ms.t + secs;
}

/**
 * The lines to show now, most important first: [{ text, tone }] where tone is 'good',
 * 'warn' or 'info'. Pure: reads the mission, changes nothing.
 */
export function callsFor(ms, ap) {
  const ac = ms.ac;
  const st = ms.calls ?? newCallStats();
  const out = [];
  if (ac.onSurface || ms.status !== 'flying') return out;
  const bank = Math.abs(ac.bank);
  const slip = Math.abs(ac.beta) * DEG;
  const agl = Math.max(0, ac.agl) * 3.28084;
  if (ap) {
    const flaps = Math.round(ac.controls.flaps * 40);
    const parts = [`FLAPS ${flaps}`, `${ap.white} WHITE`, ap.word === 'ON' ? 'ON SLOPE' : `${ap.word} ${Math.abs(ap.dev).toFixed(1)}°`];
    if (agl < MINIMUMS_FT) parts.push('MINIMUMS');
    out.push({ text: parts.join(' · '), tone: ap.word === 'ON' ? 'good' : 'warn' });
  }
  if (agl < 40 && ac.vs < -0.5 && !ap && ms.objectives[ms.index]?.kind === 'land') {
    out.push({ text: `FLARE · SINK ${Math.round(-ac.vs * MS_TO_FPM / 10) * 10} FT/MIN`, tone: -ac.vs * MS_TO_FPM < 300 ? 'good' : 'warn' });
  }
  if (bank > TURN_BANK) {
    const ball = slip < SLIP_CENTRED ? 'SLIP CENTERED' : `SLIP ${slip.toFixed(0)}° · RUDDER ${ac.beta > 0 ? 'RIGHT' : 'LEFT'}`;
    out.push({ text: `${slip < SLIP_CENTRED ? 'CLEAN TURN' : 'TURNING'} · ${Math.round(bank)}° BANK · ${ball}`, tone: slip < SLIP_CENTRED ? 'good' : 'warn' });
  }
  if (ms.score.ringStreak >= 2) out.push({ text: `ON RAILS x${ms.score.ringStreak}`, tone: 'good' });
  if (st.flashText && ms.t < st.flashUntil) out.push({ text: st.flashText, tone: 'good' });
  return out;
}
