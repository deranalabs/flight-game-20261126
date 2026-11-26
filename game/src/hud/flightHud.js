// The head-up display over the view: heading tape, big airspeed and altitude, vertical
// speed, the mission card with objective n of m and the clock, a north-up map with the
// next target, wind, fuel and damage chips, the radio line with who is speaking, and
// big banners for stalls, rings, drops and landings.

import { MS_TO_KT, MS_TO_FPM } from '../flight/landingJudge.js';
import { enduranceMinutes } from '../systems/fuelTank.js';
import { condition } from '../systems/damageModel.js';
import { groundHeight } from '../terrain/heightmap.js';
import { WORLD_HALF, RUNWAYS, VILLAGES, LANDMARKS, ISLANDS } from '../terrain/islandLayout.js';
import { fmtTime, currentObjective } from '../missions/missionRunner.js';
import { bearingTo } from '../flight/autopilot.js';

const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
const INK = '#f4f7ef';
const AMBER = '#ffbf3c';
const CYAN = '#5fe3ff';
const BG = 'rgba(10,16,24,0.62)';

function box(ctx, x, y, w, h, fill = BG, radius = 10) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color = INK, align = 'left', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 4;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
}

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
  ctx.fillStyle = '#ffd27a';
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
  box(ctx, W / 2 - 62, y + h - 2, 124, 40, 'rgba(10,16,24,0.85)', 8);
  text(ctx, `HDG ${String(Math.round(ac.hdg) % 360).padStart(3, '0')}`, W / 2, y + h + 18, 24, AMBER, 'center');
}

function bigReadout(ctx, x, y, label, value, unit, sub, color = INK, align = 'left') {
  const w = 190;
  const bx = align === 'left' ? x : x - w;
  box(ctx, bx, y, w, 96);
  text(ctx, label, bx + 14, y + 20, 18, AMBER);
  text(ctx, unit, bx + w - 14, y + 20, 16, '#c9d3dc', 'right');
  text(ctx, value, bx + w - 14, y + 56, 44, color, 'right');
  if (sub) text(ctx, sub, bx + w - 14, y + 84, 16, '#c9d3dc', 'right');
}

function missionCard(ctx, ms, missionNo, missionCount) {
  const ac = ms.ac;
  const def = ms.def;
  const o = currentObjective(ms);
  const x = 14;
  const y = 12;
  const w = 380;
  const h = 150;
  box(ctx, x, y, w, h);
  text(ctx, `MISSION ${missionNo}/${missionCount} · ${def.title.toUpperCase()}`, x + 14, y + 20, 16, AMBER);
  const done = Math.min(ms.index, ms.objectives.length);
  text(ctx, `OBJECTIVE ${Math.min(done + 1, ms.objectives.length)} OF ${ms.objectives.length}`, x + 14, y + 46, 15, '#c9d3dc');
  // progress pips
  for (let i = 0; i < ms.objectives.length; i++) {
    ctx.fillStyle = i < done ? '#2ecc71' : i === done ? AMBER : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(x + 210 + i * 17, y + 46, 6, 0, Math.PI * 2); ctx.fill();
  }
  const label = ms.status === 'done' ? 'Mission complete!' : o ? o.label(ms) : '';
  wrap(ctx, label, x + 14, y + 76, w - 28, 21, 2, INK);
  const tgt = targetOf(ms);
  const par = def.parTime;
  text(ctx, `TIME ${fmtTime(ms.t)}  ·  PAR ${fmtTime(par)}`, x + 14, y + 128, 16, ms.t > par ? '#ff9a7a' : '#9ff0a8');
  if (tgt) {
    const dist = Math.hypot(tgt.x - ac.pos.x, tgt.z - ac.pos.z) / 1000;
    const brg = Math.round(bearingTo(ac.pos.x, ac.pos.z, tgt.x, tgt.z));
    text(ctx, `${dist.toFixed(1)} km · BRG ${String(brg).padStart(3, '0')}`, x + w - 14, y + 128, 16, CYAN, 'right');
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
  box(ctx, x - 6, y - 6, size + 12, size + 12, BG, 12);
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
    ctx.fillStyle = i === ms.index ? AMBER : 'rgba(255,220,140,0.55)';
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
  text(ctx, `${kt} KT  G${w.speedKt + w.gustKt}`, x + 64, y + 44, 17, w.gustKt > 10 ? AMBER : '#c9d3dc');
  return y + 70;
}

function chips(ctx, W, ms, y) {
  const ac = ms.ac;
  const x = W - 222;
  const fuelPct = Math.round((ac.fuel.litres / ac.fuel.capacity) * 100);
  const mins = enduranceMinutes(ac.fuel, ac.spec);
  const cond = condition(ac.damage);
  const rows = [
    [`FUEL ${fuelPct}%`, Number.isFinite(mins) ? `${Math.round(mins)} MIN` : 'ENG OFF', fuelPct < 15 ? '#ff6b5a' : fuelPct < 30 ? AMBER : '#9ff0a8'],
    [`DAMAGE ${Math.round(100 - cond.average)}%`, cond.worstHealth < 100 ? `${cond.worst.toUpperCase()} ${Math.round(cond.worstHealth)}%` : 'ALL GREEN', cond.worstHealth < 45 ? '#ff6b5a' : cond.worstHealth < 80 ? AMBER : '#9ff0a8'],
  ];
  const extra = ms.def.hud ? ms.def.hud(ms) : null;
  if (extra) rows.push([extra[0], '', { good: '#9ff0a8', warn: AMBER, bad: '#ff6b5a', dim: '#9aa4ad' }[extra[1]] ?? INK]);
  rows.forEach(([a, b, col], i) => {
    box(ctx, x, y + i * 40, 206, 34, BG, 8);
    text(ctx, a, x + 12, y + i * 40 + 17, 17, col);
    if (b) text(ctx, b, x + 194, y + i * 40 + 17, 14, '#c9d3dc', 'right');
  });
  return y + rows.length * 40;
}

function radioBox(ctx, W, msg, bottom, left = 14) {
  if (!msg) return;
  // bottom left, beside the aircraft: never over the aircraft, the runway or the sky ahead
  const w = Math.min(390, W * 0.3);
  const h = 116;
  const x = left;
  const y = bottom - h - 14;
  box(ctx, x, y, w, h, 'rgba(8,12,18,0.78)');
  ctx.fillStyle = msg.color;
  ctx.beginPath(); ctx.arc(x + 30, y + 30, 20, 0, Math.PI * 2); ctx.fill();
  const initials = msg.name.split(' ').filter((p) => p[0] && p[0] === p[0].toUpperCase() && !p.endsWith('.')).map((p) => p[0]).join('').slice(0, 2);
  text(ctx, initials, x + 30, y + 31, 17, '#101418', 'center');
  text(ctx, `${msg.name.toUpperCase()}`, x + 60, y + 20, 16, msg.color);
  text(ctx, `${msg.role} · RADIO`, x + 60, y + 40, 13, '#9aa4ad');
  wrap(ctx, msg.text, x + 12, y + 62, w - 24, 15, 3, INK);
}

function banner(ctx, W, H, s, color, sub) {
  ctx.save();
  ctx.font = `bold 46px ${FONT}`;
  const w = Math.max(ctx.measureText(s).width + 60, 300);
  box(ctx, W / 2 - w / 2, H * 0.28, w, sub ? 92 : 66, 'rgba(10,14,20,0.7)', 14);
  text(ctx, s, W / 2, H * 0.28 + 34, 44, color, 'center');
  if (sub) text(ctx, sub, W / 2, H * 0.28 + 72, 18, INK, 'center');
  ctx.restore();
}

/**
 * Draw the whole HUD for one frame. info: { missionNo, missionCount, view, panelTop,
 * banner: {text, color, sub}?, radio }.
 */
export function drawFlightHud(ctx, W, H, ms, info) {
  const ac = ms.ac;
  const tgt = targetOf(ms);
  const bug = tgt ? bearingTo(ac.pos.x, ac.pos.z, tgt.x, tgt.z) : null;
  headingTape(ctx, W, ac, bug);
  const cardBottom = missionCard(ctx, ms, info.missionNo, info.missionCount);
  const kt = Math.round(ac.ias * MS_TO_KT);
  const ft = Math.round(ac.pos.y * 3.28084);
  const agl = Math.round(Math.max(0, ac.agl) * 3.28084);
  const fpm = Math.round((ac.vs * MS_TO_FPM) / 10) * 10;
  const ry = cardBottom + 14;
  bigReadout(ctx, 14, ry, 'SPD', String(kt), 'KT', `GS ${Math.round(ac.gs * MS_TO_KT)} KT`, ac.stallWarn ? '#ff6b5a' : INK);
  bigReadout(ctx, 14, ry + 106, 'ALT', ft.toLocaleString('en-US'), 'FT', `AGL ${agl.toLocaleString('en-US')}  VS ${fpm > 0 ? '+' : ''}${fpm}`, agl < 150 && !ac.onSurface ? AMBER : INK);
  let y = miniMap(ctx, W, ms, 12);
  y = windBlock(ctx, W, ms, y + 4);
  chips(ctx, W, ms, y);
  // in the cockpit the left column runs down to the glare shield, so the radio sits up top
  if (info.view === 'cockpit') radioBox(ctx, W, info.radio, 236, W / 2 - 195);
  else radioBox(ctx, W, info.radio, info.panelTop);
  if (info.banner) banner(ctx, W, H, info.banner.text, info.banner.color, info.banner.sub);
  else if (ac.stalled) banner(ctx, W, H, 'STALL', '#ff4d3d', 'Nose down, wings level, power on');
  else if (ac.stallWarn) banner(ctx, W, H, 'STALL WARNING', AMBER);
  else if (ac.onSurface && ac.ias > (info.rotateSpeed ?? 27) && ac.controls.throttle > 0.5) banner(ctx, W, H, 'ROTATE', CYAN, 'Hold S or Down to lift the nose');
  else if (!ac.onSurface && ac.agl < 12 && ac.vs < -1.2 && ac.ias < 40) banner(ctx, W, H, 'FLARE', CYAN, 'Ease back and close the throttle');
  text(ctx, `${info.view === 'cockpit' ? 'COCKPIT' : 'CHASE'} VIEW · C camera · F flaps · Space drop · Esc pause`, W - 16, info.panelTop - 12, 13, 'rgba(255,255,255,0.7)', 'right');
}
