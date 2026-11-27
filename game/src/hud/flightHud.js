// The head-up display over the view: heading tape, big airspeed and altitude, vertical
// speed, the mission card with objective n of m and the clock, a north-up map with the
// next target, wind, fuel and damage chips, the radio line with who is speaking, and
// an objectives checklist, a score line with the job's pay and best landing, and
// big banners for stalls, drops and landings, a ring-cleared toast, and on a landing
// approach the PAPI lights and a glideslope ladder.

import { TOKENS, INK as PANEL, FACE, box, text, measure, stamp, WORDMARK } from '../identity/palette.js';
import { MS_TO_KT, MS_TO_FPM } from '../flight/landingJudge.js';
import { enduranceMinutes } from '../systems/fuelTank.js';
import { condition } from '../systems/damageModel.js';
import { groundHeight } from '../terrain/heightmap.js';
import { WORLD_HALF, RUNWAYS, VILLAGES, LANDMARKS, ISLANDS } from '../terrain/islandLayout.js';
import { fmtTime, currentObjective, ringsOf } from '../missions/missionRunner.js';
import { bearingTo } from '../flight/autopilot.js';
import { currentApproach, papiLights, slopeWord, ON_SLOPE_DEG } from '../flight/glidepath.js';

// HUD colours: the identity tokens under the names the HUD reads them by
const FONT = FACE.body;
const INK = TOKENS.ledger;
const AMBER = TOKENS.sulphur;
const CYAN = TOKENS.lagoon;
const BG = PANEL.panel;
const CORAL = TOKENS.ember; // the debt only
const GOOD = TOKENS.lagoon;
const OK = TOKENS.lagoon;
const BAD = TOKENS.sulphur; // cautions are sulphur: ember is kept for the debt
const DIM = TOKENS.mist;
const MUTED = TOKENS.mist;
const LABEL = TOKENS.sulphur;
const DARK = PANEL.panelDeep;

let mapCanvas = null;
function islandMap() {
  if (mapCanvas) return mapCanvas;
  const n = 220;
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = mapCanvas.height = n;
  const ctx = mapCanvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 * WORLD_HALF - WORLD_HALF;
      const z = (j / n) * 2 * WORLD_HALF - WORLD_HALF;
      const h = groundHeight(x, z);
      let c;
      if (h <= 0) c = h > -10 ? [70, 160, 175] : [24, 70, 104];
      else if (h < 4) c = [222, 205, 150];
      else if (h > 420) c = [110, 92, 84];
      else c = [86 + h * 0.12, 140 - h * 0.06, 70];
      const k = (j * n + i) * 4;
      img.data.set([c[0], c[1], c[2], 255], k);
    }
  }
  ctx.putImageData(img, 0, 0);
  const toMap = (x, z) => [((x + WORLD_HALF) / (2 * WORLD_HALF)) * n, ((z + WORLD_HALF) / (2 * WORLD_HALF)) * n];
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (const rw of Object.values(RUNWAYS)) {
    if (rw.kind === 'lane') continue;
    const a = (rw.hdg * Math.PI) / 180;
    const [x0, y0] = toMap(rw.x - Math.sin(a) * rw.length / 2, rw.z + Math.cos(a) * rw.length / 2);
    const [x1, y1] = toMap(rw.x + Math.sin(a) * rw.length / 2, rw.z - Math.cos(a) * rw.length / 2);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.fillStyle = TOKENS.sulphur;
  for (const v of VILLAGES) { const [x, y] = toMap(v.x, v.z); ctx.fillRect(x - 2, y - 2, 4, 4); }
  const [lx, ly] = toMap(LANDMARKS.lighthouse.x, LANDMARKS.lighthouse.z);
  ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
  return mapCanvas;
}

function targetOf(ms) {
  const o = currentObjective(ms);
  if (!o) return null;
  const mk = o.marker ? o.marker() : null;
  if (!mk) return null;
  if (mk.rw) return { x: mk.rw.x, z: mk.rw.z, name: mk.rw.name };
  if (mk.fields) return { x: mk.fields[0].x, z: mk.fields[0].z, name: mk.fields[0].name };
  return { x: mk.x, z: mk.z, name: o.name ?? '' };
}

/** Bearing from the aircraft to the current objective, for the heading bugs. */
export function objectiveBearing(ms) {
  const tgt = targetOf(ms);
  return tgt ? bearingTo(ms.ac.pos.x, ms.ac.pos.z, tgt.x, tgt.z) : null;
}

function headingTape(ctx, W, ac, bug) {
  const w = Math.min(560, W * 0.42);
  const x = W / 2 - w / 2;
  const y = 12;
  const h = 50;
  box(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 4, y, w - 8, h); ctx.clip();
  const pxPerDeg = w / 90;
  for (let d = Math.floor(ac.hdg - 50); d <= ac.hdg + 50; d++) {
    if (d % 5) continue;
    const px = W / 2 + (d - ac.hdg) * pxPerDeg;
    const dd = ((d % 360) + 360) % 360;
    ctx.strokeStyle = INK;
    ctx.lineWidth = dd % 10 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(px, y + h - 4); ctx.lineTo(px, y + h - (dd % 10 === 0 ? 16 : 9)); ctx.stroke();
    if (dd % 30 === 0) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] ?? String(dd).padStart(3, '0');
      text(ctx, label, px, y + 16, 17, isNaN(label) ? AMBER : INK, 'center');
    }
  }
  if (bug !== null && bug !== undefined) {
    let off = ((bug - ac.hdg + 540) % 360) - 180;
    off = Math.max(-44, Math.min(44, off));
    const px = W / 2 + off * pxPerDeg;
    ctx.fillStyle = CYAN;
    ctx.beginPath(); ctx.moveTo(px, y + h - 2); ctx.lineTo(px - 9, y + h - 16); ctx.lineTo(px + 9, y + h - 16); ctx.fill();
  }
  ctx.restore();
  box(ctx, W / 2 - 62, y + h - 2, 124, 40, { fill: DARK });
  text(ctx, `HDG ${String(Math.round(ac.hdg) % 360).padStart(3, '0')}`, W / 2, y + h + 18, 28, AMBER, 'center', 'numeral');
}

function bigReadout(ctx, x, y, label, value, unit, sub, color = INK, align = 'left') {
  const w = 186;
  const bx = align === 'left' ? x : x - w;
  box(ctx, bx, y, w, 96);
  text(ctx, label, bx + 14, y + 20, 18, AMBER);
  text(ctx, unit, bx + w - 14, y + 20, 16, DIM, 'right');
  text(ctx, value, bx + w - 14, y + 56, 50, color, 'right', 'numeral');
  if (sub) text(ctx, sub, bx + w - 14, y + 84, 16, DIM, 'right');
}

// The Board's note, top left: what is owed in big ember numerals with the DUE stamp.
function noteCard(ctx, note) {
  const x = 14;
  const y = 12;
  const w = 380;
  const h = 112;
  box(ctx, x, y, w, h, { tab: CORAL });
  text(ctx, `PORT HALYARD BOARD · CH ${note.chapter.no} ${note.chapter.title}`, x + 14, y + 17, 14, AMBER);
  const left = note.left.toLocaleString('en-US');
  text(ctx, left, x + 12, y + 70, 92, note.left ? CORAL : CYAN, 'left', 'numeral');
  const lw = measure(ctx, left, 92, 'numeral');
  text(ctx, note.left ? 'SH OWED' : 'SH · CLEAR', x + 20 + lw, y + 84, 18, INK);
  stamp(ctx, x + w - 52, y + 62, 40, note.left ? 'DUE' : 'PAID');
  return y + h;
}

function missionCard(ctx, ms, missionNo, missionCount, top, typeName) {
  const ac = ms.ac;
  const def = ms.def;
  const o = currentObjective(ms);
  const x = 14;
  const y = top;
  const w = 380;
  const h = 128;
  box(ctx, x, y, w, h);
  text(ctx, `SORTIE ${missionNo}/${missionCount} · ${typeName}`, x + 14, y + 17, 14, AMBER);
  text(ctx, def.title.toUpperCase(), x + 14, y + 42, 26, INK, 'left', 'display');
  const done = Math.min(ms.index, ms.objectives.length);
  // progress pips
  for (let i = 0; i < ms.objectives.length; i++) {
    ctx.fillStyle = i < done ? GOOD : i === done ? AMBER : 'rgba(239,230,207,0.25)';
    ctx.fillRect(x + w - 16 - (ms.objectives.length - i) * 13, y + 12, 9, 9);
  }
  const label = ms.status === 'done' ? 'Mission complete!' : o ? o.label(ms) : '';
  wrap(ctx, label, x + 14, y + 70, w - 28, 18, 1, INK);
  const tgt = targetOf(ms);
  const par = def.parTime;
  text(ctx, `TIME ${fmtTime(ms.t)} · PAR ${fmtTime(par)}`, x + 14, y + 104, 18, ms.t > par ? BAD : GOOD, 'left', 'numeral');
  if (tgt) {
    const dist = Math.hypot(tgt.x - ac.pos.x, tgt.z - ac.pos.z) / 1000;
    const brg = Math.round(bearingTo(ac.pos.x, ac.pos.z, tgt.x, tgt.z));
    text(ctx, `${dist.toFixed(1)} KM · BRG ${String(brg).padStart(3, '0')}`, x + w - 14, y + 104, 18, CYAN, 'right', 'numeral');
  }
  return y + h;
}

function wrap(ctx, s, x, y, w, size, maxLines, color) {
  ctx.font = `bold ${size}px ${FONT}`;
  const words = s.split(' ');
  let line = '';
  let n = 0;
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > w && line) {
      text(ctx, line, x, y + n * (size + 4), size, color);
      n += 1;
      line = word;
      if (n >= maxLines) return;
    } else line = t;
  }
  if (line && n < maxLines) text(ctx, line, x, y + n * (size + 4), size, color);
}

function miniMap(ctx, W, ms, y0) {
  const ac = ms.ac;
  const size = 196;
  const x = W - size - 16;
  const y = y0;
  box(ctx, x - 6, y - 6, size + 12, size + 12, { fill: BG });
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.clip();
  // 7 km across, centred on the aircraft
  const span = 7000;
  const scale = size / span;
  const m = islandMap();
  const k = m.width / (2 * WORLD_HALF);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(m, (ac.pos.x - span / 2 + WORLD_HALF) * k, (ac.pos.z - span / 2 + WORLD_HALF) * k, span * k, span * k, x, y, size, size);
  const toS = (wx, wz) => [x + size / 2 + (wx - ac.pos.x) * scale, y + size / 2 + (wz - ac.pos.z) * scale];
  // objectives still to do
  ms.objectives.forEach((o, i) => {
    if (i < ms.index) return;
    const mk = o.marker ? o.marker() : null;
    if (!mk) return;
    const p = mk.rw ?? (mk.fields ? mk.fields[0] : mk);
    const [sx, sy] = toS(p.x, p.z);
    ctx.fillStyle = i === ms.index ? AMBER : 'rgba(242,194,48,0.55)';
    ctx.beginPath(); ctx.arc(sx, sy, i === ms.index ? 7 : 4, 0, Math.PI * 2); ctx.fill();
  });
  const tgt = targetOf(ms);
  if (tgt) {
    const [sx, sy] = toS(tgt.x, tgt.z);
    ctx.strokeStyle = CYAN; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(x + size / 2, y + size / 2); ctx.lineTo(sx, sy); ctx.stroke();
    ctx.setLineDash([]);
  }
  // aircraft arrow
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate((ac.hdg * Math.PI) / 180);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 5); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  text(ctx, 'N', x + size / 2, y + 12, 15, AMBER, 'center');
  // island names that are on the map
  for (const isl of ISLANDS) {
    const [sx, sy] = toS(isl.x, isl.z);
    if (sx > x + 20 && sx < x + size - 20 && sy > y + 20 && sy < y + size - 10) text(ctx, isl.name, sx, sy, 11, 'rgba(255,255,255,0.85)', 'center');
  }
  return y + size + 6;
}

function windBlock(ctx, W, ms, y) {
  const w = ms.env.wind;
  const ac = ms.ac;
  const x = W - 222;
  box(ctx, x, y, 206, 62);
  // arrow showing where the wind blows to, relative to north-up
  const cx = x + 34;
  const cy = y + 31;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((w.fromDeg + 180) * Math.PI) / 180);
  ctx.fillStyle = CYAN;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(9, 4); ctx.lineTo(3, 2); ctx.lineTo(3, 18); ctx.lineTo(-3, 18); ctx.lineTo(-3, 2); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  const now = w.at(ac.pos, ac.t);
  const kt = Math.round(Math.hypot(now.x, now.z) * MS_TO_KT);
  text(ctx, `WIND ${String(Math.round(w.fromDeg)).padStart(3, '0')}°`, x + 64, y + 20, 17, INK);
  text(ctx, `${kt} KT  G${w.speedKt + w.gustKt}`, x + 64, y + 44, 17, w.gustKt > 10 ? AMBER : DIM);
  return y + 70;
}

function chips(ctx, W, ms, y) {
  const ac = ms.ac;
  const x = W - 222;
  const fuelPct = Math.round((ac.fuel.litres / ac.fuel.capacity) * 100);
  const mins = enduranceMinutes(ac.fuel, ac.spec);
  const cond = condition(ac.damage);
  const rows = [
    [`FUEL ${fuelPct}%`, Number.isFinite(mins) ? `${Math.round(mins)} MIN` : 'ENG OFF', fuelPct < 15 ? BAD : fuelPct < 30 ? AMBER : GOOD],
    [`DAMAGE ${Math.round(100 - cond.average)}%`, cond.worstHealth < 100 ? `${cond.worst.toUpperCase()} ${Math.round(cond.worstHealth)}%` : 'ALL GREEN', cond.worstHealth < 45 ? BAD : cond.worstHealth < 80 ? AMBER : GOOD],
  ];
  const extra = ms.def.hud ? ms.def.hud(ms) : null;
  if (extra) rows.push([extra[0], '', { good: GOOD, warn: AMBER, bad: BAD, dim: MUTED }[extra[1]] ?? INK]);
  rows.forEach(([a, b, col], i) => {
    box(ctx, x, y + i * 40, 206, 34, { fill: BG });
    text(ctx, a, x + 12, y + i * 40 + 17, 17, col);
    if (b) text(ctx, b, x + 194, y + i * 40 + 17, 14, DIM, 'right');
  });
  return y + rows.length * 40;
}

function clip(ctx, s, w, size) {
  ctx.font = `bold ${size}px ${FONT}`;
  if (ctx.measureText(s).width <= w) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > w) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// Objectives checklist: the last one done, the current one and what comes next, as many
// rows as fit between the altitude box and the radio line.
function checklist(ctx, ms, x, y, bottom) {
  const rows = Math.min(4, Math.floor((bottom - y - 12) / 24));
  if (rows < 2 || !ms.objectives.length) return;
  const first = Math.max(0, Math.min(ms.index - 1, ms.objectives.length - rows));
  const list = ms.objectives.slice(first, first + rows);
  const w = 330;
  box(ctx, x, y, w, 12 + list.length * 24);
  list.forEach((o, k) => {
    const i = first + k;
    const done = i < ms.index;
    const now = i === ms.index && ms.status === 'flying';
    const col = done ? GOOD : now ? AMBER : DIM;
    const cy = y + 18 + k * 24;
    text(ctx, done ? '✓' : now ? '▶' : '○', x + 22, cy, 16, col, 'center');
    text(ctx, clip(ctx, o.label(ms), w - 54, 16), x + 40, cy, 16, col);
  });
}

// Score box: the live sortie score (base points so far) and the combo the next B or
// better grade earns, big; then the job's pay, or what the runner has counted so far: the best landing
// grade once there is one, else the ring streak on a ring job or the drops on a drop job.
function scoreLine(ctx, W, ms, y, live, nextMult) {
  const x = W - 222;
  const sc = ms.score;
  const best = sc.landings.reduce((b, l) => (!b || l.points > b.points ? l : b), null);
  const rings = ringsOf(ms).length;
  const drops = ms.objectives.filter((o) => o.kind === 'drop').length;
  let line = [`JOB PAY ${ms.def.pay} SH`, AMBER];
  if (best) line = [`LANDING ${best.letter} · ${best.points} PTS`, GOOD];
  else if (rings) line = [`STREAK ${sc.ringStreak} · MISSED ${sc.ringMisses}`, sc.ringMisses ? AMBER : GOOD];
  else if (drops) line = [`DROPS ${sc.drops.length}/${drops} · MISSED ${sc.misses}`, sc.misses ? AMBER : GOOD];
  box(ctx, x, y, 206, 86);
  text(ctx, 'SCORE', x + 12, y + 14, 13, LABEL);
  text(ctx, live ? live.base.toLocaleString('en-US') : '0', x + 12, y + 38, 36, INK, 'left', 'numeral');
  text(ctx, 'COMBO', x + 194, y + 14, 13, LABEL, 'right');
  text(ctx, `×${nextMult ?? 1}`, x + 194, y + 38, 34, CYAN, 'right', 'numeral');
  text(ctx, line[0], x + 12, y + 68, 16, line[1]);
}

// Where the right column has no room (the cockpit), score and combo flank the heading box.
function scoreFlanks(ctx, W, live, nextMult) {
  box(ctx, W / 2 - 250, 60, 170, 42, { fill: BG });
  text(ctx, 'SCORE', W / 2 - 238, 81, 13, LABEL);
  text(ctx, live ? live.base.toLocaleString('en-US') : '0', W / 2 - 92, 82, 28, INK, 'right');
  box(ctx, W / 2 + 80, 60, 170, 42, { fill: BG });
  text(ctx, 'COMBO', W / 2 + 92, 81, 13, LABEL);
  text(ctx, `×${nextMult ?? 1}`, W / 2 + 238, 82, 28, CYAN, 'right');
}

/** Toast text for a cleared ring: its number and the count from the objective list. */
export function ringClearedText(ms, o) {
  const rings = ringsOf(ms);
  return `RING ${rings.indexOf(o) + 1}/${rings.length} CLEARED`;
}

// Ring-cleared toast: small, just under the heading box, above the sky ahead.
function toast(ctx, W, s) {
  ctx.font = `bold 22px ${FONT}`;
  const w = ctx.measureText(s).width + 36;
  box(ctx, W / 2 - w / 2, 108, w, 38, { fill: DARK });
  text(ctx, s, W / 2, 128, 22, OK, 'center');
}

// Glideslope ladder on a landing approach: four PAPI lights and a scale of ±1.5° about
// the 4° path with a diamond for where the aircraft sits against the path. Left of the right column, below
// its top cards, so the runway ahead and the aircraft stay clear.
function approachLadder(ctx, x, ms, y, bottom) {
  const ap = currentApproach(ms);
  const h = 210;
  if (!ap || y + h > bottom) return;
  box(ctx, x, y, 80, h);
  text(ctx, 'PAPI', x + 40, y + 16, 16, AMBER, 'center');
  const lit = papiLights(ap.dev);
  for (let i = 0; i < 4; i++) {
    // lights read left to right, outer first, from the same rule as the 3D bar
    ctx.fillStyle = lit[i] ? '#ffffff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(x + 13 + i * 18, y + 36, 6.5, 0, Math.PI * 2); ctx.fill();
  }
  const top = y + 56;
  const span = 120;
  const mid = top + span / 2;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  for (let k = -3; k <= 3; k++) {
    const ly = mid + (k * span) / 6;
    const len = k === 0 ? 30 : k % 2 ? 10 : 18;
    ctx.beginPath(); ctx.moveTo(x + 40 - len, ly); ctx.lineTo(x + 40 + len, ly); ctx.stroke();
  }
  // high above the path shows the diamond above the centre line
  const dy = Math.max(-1.5, Math.min(1.5, ap.dev)) * (span / 3);
  const onSlope = slopeWord(ap.dev) === 'ON';
  ctx.fillStyle = onSlope ? OK : AMBER;
  ctx.beginPath(); ctx.moveTo(x + 40, mid - dy - 9); ctx.lineTo(x + 49, mid - dy); ctx.lineTo(x + 40, mid - dy + 9); ctx.lineTo(x + 31, mid - dy); ctx.closePath(); ctx.fill();
  text(ctx, `${slopeWord(ap.dev)} ${ap.angle.toFixed(1)}°`, x + 40, y + h - 16, 16, onSlope ? GOOD : AMBER, 'center');
}

// Title strip: the wordmark and what ships (counts from the data), on the key-help row.
function scopeStrip(ctx, W, scope, y, left, right) {
  const tw = measure(ctx, WORDMARK, 26, 'display');
  const sw = measure(ctx, scope, 15);
  const full = tw + sw + 54 <= right - left;
  const w = full ? tw + sw + 54 : tw + 30;
  const x = Math.max(left, Math.min(W / 2 - w / 2, right - w));
  box(ctx, x, y, w, 34, { fill: DARK });
  text(ctx, WORDMARK, x + 14, y + 18, 26, AMBER, 'left', 'display');
  if (full) text(ctx, scope, x + tw + 34, y + 18, 15, INK);
}

// A tag beside the next ring in the world: its number and distance, left of the ring so
// the runway inside it and the aircraft below stay clear; drawn only in open sky.
function ringTag(ctx, ms, info) {
  const o = currentObjective(ms);
  if (!o || o.kind !== 'ring' || !info.project || info.view === 'cockpit') return;
  const c = info.project(o.x, o.y, o.z);
  const top = info.project(o.x, o.y + o.r, o.z);
  if (!c || !top) return;
  const rad = Math.abs(c.y - top.y);
  const m = Math.round(Math.hypot(ms.ac.pos.x - o.x, ms.ac.pos.y - o.y, ms.ac.pos.z - o.z) / 10) * 10;
  const s = `RING ${ms.ringNo(o).split(' ')[0]} · ${m} M`;
  ctx.font = `bold 18px ${FONT}`;
  const w = ctx.measureText(s).width + 24;
  const x = c.x - rad - 14 - w;
  const y = c.y - 15;
  if (x < 360 || y < 180 || y + 30 > info.panelTop - 150) return;
  box(ctx, x, y, w, 30, { fill: DARK });
  text(ctx, s, x + 12, y + 16, 18, AMBER);
}

function radioBox(ctx, W, msg, bottom, left = 14) {
  if (!msg) return;
  // bottom left, beside the aircraft: never over the aircraft, the runway or the sky ahead
  const w = Math.min(390, W * 0.3);
  const h = 116;
  const x = left;
  const y = bottom - h - 14;
  box(ctx, x, y, w, h, { fill: DARK });
  ctx.fillStyle = msg.color;
  ctx.beginPath(); ctx.arc(x + 30, y + 30, 20, 0, Math.PI * 2); ctx.fill();
  const initials = msg.name.split(' ').filter((p) => p[0] && p[0] === p[0].toUpperCase() && !p.endsWith('.')).map((p) => p[0]).join('').slice(0, 2);
  text(ctx, initials, x + 30, y + 31, 17, TOKENS.basalt, 'center');
  text(ctx, `${msg.name.toUpperCase()}`, x + 60, y + 20, 16, msg.color);
  text(ctx, `${msg.role} · RADIO`, x + 60, y + 40, 13, MUTED);
  wrap(ctx, msg.text, x + 12, y + 62, w - 24, 15, 3, INK);
}

function banner(ctx, W, H, s, color, sub, size = 56) {
  ctx.save();
  const w = Math.max(measure(ctx, s, size, 'display') + 70, 320);
  const y = H * (size > 60 ? 0.18 : 0.28);
  box(ctx, W / 2 - w / 2, y, w, size * 1.3 + (sub ? 34 : 0), { fill: DARK });
  text(ctx, s, W / 2, y + size * 0.68, size, color, 'center', 'display');
  if (sub) text(ctx, sub, W / 2, y + size * 1.3 + 12, 19, INK, 'center');
  ctx.restore();
}

// Live calls under the heading box: turn quality, the streak, approach callouts, awards.
function callStrip(ctx, W, calls) {
  let y = 112;
  for (const c of calls.slice(0, 2)) {
    const size = c.big ? 84 : 26;
    const w = measure(ctx, c.text, size, 'display') + 40;
    const h = size * 1.25 + 8;
    box(ctx, W / 2 - w / 2, y, w, h, { fill: DARK, tab: c.tone === 'good' ? CYAN : AMBER });
    text(ctx, c.text, W / 2, y + h / 2 + 1, size, c.tone === 'good' ? CYAN : c.tone === 'warn' ? AMBER : INK, 'center', 'display');
    y += h + 6;
  }
}

// The mission type's own panel, left of the right column: a drop meter for fire and drop
// jobs, a sink meter for landing jobs, a ring counter for courses, the load for hauls.
function typePanel(ctx, x, y, ms, type) {
  const ac = ms.ac;
  const w = 92;
  const h = 236;
  box(ctx, x, y, w, h);
  const meter = (frac, col, mark) => {
    const mx = x + 30;
    const my = y + 60;
    const mh = 120;
    ctx.fillStyle = 'rgba(239,230,207,0.12)';
    ctx.fillRect(mx, my, 32, mh);
    ctx.fillStyle = col;
    const f = Math.max(0, Math.min(1, frac));
    ctx.fillRect(mx, my + mh * (1 - f), 32, mh * f);
    if (mark !== undefined) { ctx.fillStyle = INK; ctx.fillRect(mx - 6, my + mh * (1 - mark) - 1, 44, 3); }
  };
  if (type === 'drop') {
    const fires = ms.objectives.filter((o) => o.kind === 'fire' || o.kind === 'drop');
    const out = fires.filter((o, i) => ms.objectives.indexOf(o) < ms.index).length;
    const cap = ac.spec.waterTankLitres || 1;
    const water = ac.waterKg ?? 0;
    text(ctx, ac.spec.waterTankLitres ? 'DROP' : 'LOADS', x + w / 2, y + 18, 18, AMBER, 'center', 'display');
    text(ctx, ac.spec.waterTankLitres ? `${Math.round(water)} L` : `${fires.length - out} LEFT`, x + w / 2, y + 42, 22, INK, 'center', 'numeral');
    meter(ac.spec.waterTankLitres ? water / cap : 1 - out / Math.max(1, fires.length), CYAN);
    text(ctx, `${out}/${fires.length}`, x + w / 2, y + 204, 30, out === fires.length ? CYAN : INK, 'center', 'numeral');
    text(ctx, ac.spec.waterTankLitres ? 'FIRES OUT' : 'DROPPED', x + w / 2, y + 226, 12, MUTED, 'center');
  } else if (type === 'landing') {
    const fpm = Math.max(0, Math.round(-ac.vs * MS_TO_FPM / 10) * 10);
    text(ctx, 'SINK', x + w / 2, y + 18, 18, AMBER, 'center', 'display');
    text(ctx, `${fpm}`, x + w / 2, y + 42, 24, fpm > 450 ? AMBER : INK, 'center', 'numeral');
    meter(fpm / 900, fpm > 450 ? AMBER : CYAN, 300 / 900);
    const best = ms.score.landings.reduce((b, l) => (!b || l.points > b.points ? l : b), null);
    text(ctx, best ? best.letter : '–', x + w / 2, y + 204, 34, best ? CYAN : MUTED, 'center', 'display');
    text(ctx, 'TOUCHDOWN', x + w / 2, y + 226, 12, MUTED, 'center');
  } else if (type === 'ring') {
    const rings = ringsOf(ms);
    const through = rings.filter((o) => ms.objectives.indexOf(o) < ms.index).length;
    text(ctx, 'RINGS', x + w / 2, y + 18, 18, AMBER, 'center', 'display');
    text(ctx, `x${ms.score.ringStreak}`, x + w / 2, y + 42, 24, CYAN, 'center', 'numeral');
    meter(through / Math.max(1, rings.length), CYAN);
    text(ctx, `${through}/${rings.length}`, x + w / 2, y + 204, 30, INK, 'center', 'numeral');
    text(ctx, `MISSED ${ms.score.ringMisses}`, x + w / 2, y + 226, 12, ms.score.ringMisses ? AMBER : MUTED, 'center');
  } else {
    const stops = ms.objectives.filter((o) => o.kind === 'reach' || o.kind === 'drop' || o.kind === 'land');
    const left = stops.filter((o) => ms.objectives.indexOf(o) >= ms.index).length;
    text(ctx, 'LOAD', x + w / 2, y + 18, 18, AMBER, 'center', 'display');
    text(ctx, `${Math.round(ac.payloadKg ?? 0)} KG`, x + w / 2, y + 42, 20, INK, 'center', 'numeral');
    meter(1 - left / Math.max(1, stops.length), CYAN);
    text(ctx, `${stops.length - left}/${stops.length}`, x + w / 2, y + 204, 30, INK, 'center', 'numeral');
    text(ctx, 'STOPS', x + w / 2, y + 226, 12, MUTED, 'center');
  }
}

// The chapter plate at the start of a sortie: chapter, the job, who it helps, the clerk.
function chapterPlate(ctx, W, H, plate) {
  const w = Math.min(980, W - 60);
  const x = W / 2 - w / 2;
  const y = H * 0.22;
  box(ctx, x, y, w, 236, { fill: PANEL.panelDeep, tab: CORAL, cut: 22 });
  text(ctx, `CHAPTER ${plate.chapter.no} · ${plate.chapter.title}`, x + 30, y + 30, 22, AMBER, 'left', 'display');
  text(ctx, plate.title, x + 30, y + 96, 78, INK, 'left', 'display');
  wrap(ctx, plate.line, x + 30, y + 150, w - 260, 20, 2, INK);
  text(ctx, `CLERK OF THE BOARD: ${plate.clerk}`, x + 30, y + 210, 15, MUTED);
  stamp(ctx, x + w - 110, y + 118, 78, 'DUE');
  text(ctx, `${plate.left.toLocaleString('en-US')} SH`, x + w - 110, y + 216, 26, CORAL, 'center', 'numeral');
}

/**
 * Draw the whole HUD for one frame. info: { missionNo, missionCount, view, panelTop,
 * banner: {text, color, sub}?, toast: string?, radio }.
 */
export function drawFlightHud(ctx, W, H, ms, info) {
  const ac = ms.ac;
  const tgt = targetOf(ms);
  const bug = tgt ? bearingTo(ac.pos.x, ac.pos.z, tgt.x, tgt.z) : null;
  headingTape(ctx, W, ac, bug);
  const noteBottom = noteCard(ctx, info.note);
  const cardBottom = missionCard(ctx, ms, info.missionNo, info.missionCount, noteBottom + 8, info.typeName);
  const kt = Math.round(ac.ias * MS_TO_KT);
  const ft = Math.round(ac.pos.y * 3.28084);
  const agl = Math.round(Math.max(0, ac.agl) * 3.28084);
  const fpm = Math.round((ac.vs * MS_TO_FPM) / 10) * 10;
  const ry = cardBottom + 8;
  bigReadout(ctx, 14, ry, 'SPD', String(kt), 'KT', `GS ${Math.round(ac.gs * MS_TO_KT)} KT`, ac.stallWarn ? BAD : INK);
  bigReadout(ctx, 208, ry, 'ALT', ft.toLocaleString('en-US'), 'FT', `AGL ${agl.toLocaleString('en-US')} · VS ${fpm > 0 ? '+' : ''}${fpm}`, agl < 150 && !ac.onSurface ? AMBER : INK);
  let y = miniMap(ctx, W, ms, 12);
  y = windBlock(ctx, W, ms, y + 4);
  y = chips(ctx, W, ms, y);
  if (y + 96 < info.panelTop - 24) { scoreLine(ctx, W, ms, y + 6, info.live, info.nextMult); y += 92; }
  else scoreFlanks(ctx, W, info.live, info.nextMult);
  ringTag(ctx, ms, info);
  const side = W - 222 - 92 - 8;
  if (236 + 236 < info.panelTop - 24) {
    typePanel(ctx, side, 236, ms, info.type);
    approachLadder(ctx, side - 92 - 8, ms, 236, info.panelTop - 24);
  }
  if (info.toast) toast(ctx, W, info.toast);
  else if (info.calls?.length && !info.banner && !info.plate) callStrip(ctx, W, info.calls);
  // in the cockpit the left column runs down to the glare shield, so the radio sits up top
  checklist(ctx, ms, 14, ry + 106, info.view === 'cockpit' ? info.panelTop - 10 : info.panelTop - (info.radio ? 144 : 24));
  if (info.view === 'cockpit') radioBox(ctx, W, info.radio, 236, W / 2 - 195);
  else radioBox(ctx, W, info.radio, info.panelTop);
  if (info.plate) chapterPlate(ctx, W, H, info.plate);
  else if (info.banner) banner(ctx, W, H, info.banner.text, info.banner.color, info.banner.sub, info.banner.big ? 100 : 56);
  else if (ac.stalled) banner(ctx, W, H, 'STALL', BAD, 'Nose down, wings level, power on');
  else if (ac.stallWarn) banner(ctx, W, H, 'STALL WARNING', AMBER);
  else if (ac.onSurface && ac.ias > (info.rotateSpeed ?? 27) && ac.controls.throttle > 0.5) banner(ctx, W, H, 'ROTATE', CYAN, 'Hold S or Down to lift the nose');
  else if (!ac.onSurface && ac.agl < 12 && ac.vs < -1.2 && ac.ias < 40) banner(ctx, W, H, 'FLARE', CYAN, 'Ease back and close the throttle');
  if (info.hints) keyHints(ctx, W, info.panelTop, info.hints);
  if (info.bingo) bingoBox(ctx, W, info.panelTop, info.bingo);
  const help = `${info.view.toUpperCase()} VIEW · C camera · F flaps · Space drop · Esc pause`;
  text(ctx, help, W - 16, info.panelTop - 12, 13, PANEL.dim, 'right');
  scopeStrip(ctx, W, info.scope, info.panelTop - 46, 412, W - 16 - measure(ctx, help, 13) - 14);
}

// The bingo decision, each option priced against the note; waiting it out presses on.
function bingoBox(ctx, W, bottom, b) {
  const w = 520;
  const x = W / 2 - w / 2;
  const y = bottom - 250;
  box(ctx, x, y, w, 150, { fill: PANEL.panelDeep, tab: AMBER, cut: 16 });
  text(ctx, 'BINGO FUEL', x + 22, y + 30, 40, AMBER, 'left', 'display');
  text(ctx, `PRESS ON IN ${b.left}`, x + w - 20, y + 30, 18, INK, 'right', 'numeral');
  text(ctx, `J  JETTISON THE LOAD  ·  ${b.cost} SH ON THE NOTE`, x + 22, y + 72, 18, INK);
  text(ctx, 'N  DIVERT  ·  LOSE THE CONTRACT, KEEP THE TERN', x + 22, y + 100, 18, INK);
  text(ctx, '…  PRESS ON  ·  LAND BEFORE THE TANK RUNS DRY', x + 22, y + 128, 18, MUTED);
}

// The first minute of a sortie: the keys, so the pilot learns by flying.
function keyHints(ctx, W, bottom, hints) {
  const w = 360;
  const x = W / 2 - w / 2;
  const y = bottom - 100 - hints.length * 22;
  box(ctx, x, y, w, 16 + hints.length * 22, { fill: DARK });
  hints.forEach(([k, v], i) => {
    text(ctx, k, x + 16, y + 19 + i * 22, 15, AMBER);
    text(ctx, v, x + 120, y + 19 + i * 22, 15, INK);
  });
}
