// The Tern's lit instrument panel, drawn in 2D: airspeed with its coloured arcs, attitude
// ball, two-needle altimeter, heading card with a course bug, vertical speed, tachometer,
// fuel, cylinder temperature, throttle and flap levers, warning lights, and a damage
// diagram of the four parts. Laid out as a strip in chase view, a full panel in the cockpit.

import { MS_TO_KT, MS_TO_FPM } from '../flight/landingJudge.js';
import { enduranceMinutes } from '../systems/fuelTank.js';

const D = Math.PI / 180;
const FACE = '#14181c';
const MARK = '#eef2e6';
const NEEDLE = '#ffb02e';
const LIT = '#ffe7a8';
const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';

function bezel(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.12);
  g.addColorStop(0, '#5b6066');
  g.addColorStop(1, '#1c1f22');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = FACE;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // backlight glow around the rim: the gauges are lit
  const glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  glow.addColorStop(0, 'rgba(255,200,120,0)');
  glow.addColorStop(1, 'rgba(255,200,120,0.16)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function glass(ctx, cx, cy, r) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function needle(ctx, cx, cy, len, angle, width = 4, color = NEEDLE) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(255,170,60,0.8)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(-width / 2, len * 0.15);
  ctx.lineTo(width / 2, len * 0.15);
  ctx.lineTo(width * 0.2, -len);
  ctx.lineTo(-width * 0.2, -len);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, width), 0, Math.PI * 2); ctx.fill();
}

function ticks(ctx, cx, cy, r, from, to, steps, major, labelFn, fs) {
  ctx.strokeStyle = MARK;
  ctx.fillStyle = MARK;
  ctx.font = `bold ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    const big = i % major === 0;
    ctx.lineWidth = big ? 2.5 : 1.2;
    const r0 = r * (big ? 0.8 : 0.87);
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r * 0.95, cy - Math.cos(a) * r * 0.95);
    ctx.stroke();
    if (big && labelFn) {
      const t = labelFn(i);
      if (t !== null) ctx.fillText(t, cx + Math.sin(a) * r * 0.62, cy - Math.cos(a) * r * 0.62);
    }
  }
}

function arc(ctx, cx, cy, r, a0, a1, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0 - Math.PI / 2, a1 - Math.PI / 2);
  ctx.stroke();
}

function caption(ctx, cx, y, text, fs) {
  ctx.fillStyle = LIT;
  ctx.font = `bold ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y);
}

// ------------------------------------------------------------------ gauges

function airspeed(ctx, cx, cy, r, ac) {
  bezel(ctx, cx, cy, r);
  const kt = ac.ias * MS_TO_KT;
  const toA = (v) => (-150 + Math.min(160, v) / 160 * 300) * D;
  arc(ctx, cx, cy, r * 0.93, toA(41), toA(88), '#f5f5f5', r * 0.05);
  arc(ctx, cx, cy, r * 0.87, toA(48), toA(120), '#2ecc71', r * 0.06);
  arc(ctx, cx, cy, r * 0.87, toA(120), toA(144), '#f1c40f', r * 0.06);
  arc(ctx, cx, cy, r * 0.87, toA(144), toA(147), '#e74c3c', r * 0.08);
  ticks(ctx, cx, cy, r, toA(0), toA(160), 32, 4, (i) => (i === 0 ? null : String(i * 5)), r * 0.16);
  caption(ctx, cx, cy + r * 0.32, 'KNOTS', r * 0.12);
  caption(ctx, cx, cy + r * 0.55, String(Math.round(kt)), r * 0.2);
  needle(ctx, cx, cy, r * 0.85, toA(kt), r * 0.07);
  glass(ctx, cx, cy, r);
}

function attitude(ctx, cx, cy, r, ac) {
  bezel(ctx, cx, cy, r);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2); ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-ac.bank * D);
  const py = ac.pitch * r * 0.035;
  ctx.fillStyle = '#2f7fd0';
  ctx.fillRect(-r * 2, -r * 3 + py, r * 4, r * 3);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(-r * 2, py, r * 4, r * 3);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-r * 2, py); ctx.lineTo(r * 2, py); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.font = `bold ${r * 0.12}px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  for (let p = -20; p <= 20; p += 5) {
    if (!p) continue;
    const y = py - p * r * 0.035;
    const w = p % 10 === 0 ? r * 0.32 : r * 0.16;
    ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
    if (p % 10 === 0) ctx.fillText(String(Math.abs(p)), w + 4, y + 4);
  }
  ctx.restore();
  // bank scale
  ctx.strokeStyle = MARK;
  for (const b of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = b * D;
    ctx.lineWidth = b % 30 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r * 0.82, cy - Math.cos(a) * r * 0.82);
    ctx.lineTo(cx + Math.sin(a) * r * 0.95, cy - Math.cos(a) * r * 0.95);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-ac.bank * D);
  ctx.fillStyle = NEEDLE;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(-r * 0.07, -r * 0.68); ctx.lineTo(r * 0.07, -r * 0.68); ctx.fill();
  ctx.restore();
  // the little aeroplane
  ctx.strokeStyle = NEEDLE;
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.18, cy); ctx.lineTo(cx, cy + r * 0.1); ctx.lineTo(cx + r * 0.18, cy); ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = NEEDLE;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2); ctx.fill();
  glass(ctx, cx, cy, r);
}

function altimeter(ctx, cx, cy, r, ac) {
  bezel(ctx, cx, cy, r);
  const ft = Math.max(0, ac.pos.y * 3.28084);
  ticks(ctx, cx, cy, r, 0, Math.PI * 2 - (Math.PI * 2) / 50, 49, 5, (i) => String(i / 5), r * 0.18);
  // digital drum
  ctx.fillStyle = '#05070a';
  ctx.fillRect(cx - r * 0.34, cy + r * 0.2, r * 0.68, r * 0.26);
  ctx.fillStyle = '#9ff0a8';
  ctx.font = `bold ${r * 0.2}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ft / 10) * 10).padStart(4, ' '), cx, cy + r * 0.34);
  caption(ctx, cx, cy - r * 0.3, 'ALT FT', r * 0.12);
  needle(ctx, cx, cy, r * 0.5, ((ft % 10000) / 10000) * Math.PI * 2, r * 0.1, '#f5f5f5');
  needle(ctx, cx, cy, r * 0.85, ((ft % 1000) / 1000) * Math.PI * 2, r * 0.06);
  glass(ctx, cx, cy, r);
}

function heading(ctx, cx, cy, r, ac, bug) {
  bezel(ctx, cx, cy, r);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-ac.hdg * D);
  ctx.strokeStyle = MARK;
  ctx.fillStyle = MARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) {
    const a = d * D;
    const big = d % 30 === 0;
    ctx.lineWidth = big ? 2.5 : 1.2;
    const r0 = r * (big ? 0.78 : d % 10 === 0 ? 0.84 : 0.88);
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    ctx.lineTo(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95);
    ctx.stroke();
    if (big) {
      const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10);
      ctx.save();
      ctx.translate(Math.sin(a) * r * 0.62, -Math.cos(a) * r * 0.62);
      ctx.rotate(a);
      ctx.font = `bold ${r * (label.length === 1 && isNaN(label) ? 0.22 : 0.16)}px ${FONT}`;
      ctx.fillStyle = isNaN(label) ? NEEDLE : MARK;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }
  if (bug !== null && bug !== undefined) {
    const a = bug * D;
    ctx.fillStyle = '#4fe0ff';
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-r * 0.08, -r * 0.99, r * 0.16, r * 0.12);
    ctx.restore();
  }
  ctx.restore();
  // lubber line and aircraft symbol
  ctx.fillStyle = NEEDLE;
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.98); ctx.lineTo(cx - r * 0.07, cy - r * 0.84); ctx.lineTo(cx + r * 0.07, cy - r * 0.84); ctx.fill();
  ctx.strokeStyle = NEEDLE;
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.32); ctx.lineTo(cx, cy + r * 0.3);
  ctx.moveTo(cx - r * 0.28, cy - r * 0.05); ctx.lineTo(cx + r * 0.28, cy - r * 0.05);
  ctx.moveTo(cx - r * 0.12, cy + r * 0.26); ctx.lineTo(cx + r * 0.12, cy + r * 0.26);
  ctx.stroke();
  ctx.fillStyle = '#05070a';
  ctx.fillRect(cx - r * 0.24, cy + r * 0.38, r * 0.48, r * 0.22);
  ctx.fillStyle = '#9ff0a8';
  ctx.font = `bold ${r * 0.18}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ac.hdg) % 360).padStart(3, '0'), cx, cy + r * 0.5);
  glass(ctx, cx, cy, r);
}

function vsi(ctx, cx, cy, r, ac) {
  bezel(ctx, cx, cy, r);
  const fpm = ac.vs * MS_TO_FPM;
  const toA = (v) => (-90 + (Math.max(-2000, Math.min(2000, v)) / 2000) * 170) * D;
  ticks(ctx, cx, cy, r, toA(-2000), toA(2000), 20, 5, (i) => String(Math.abs((i - 10) / 5)), r * 0.15);
  caption(ctx, cx + r * 0.25, cy, 'VS', r * 0.13);
  caption(ctx, cx + r * 0.25, cy + r * 0.2, 'x1000', r * 0.1);
  ctx.fillStyle = fpm < -700 ? '#ff6b5a' : '#9ff0a8';
  ctx.font = `bold ${r * 0.17}px ${FONT}`;
  ctx.fillText(`${fpm > 0 ? '+' : ''}${Math.round(fpm / 10) * 10}`, cx + r * 0.1, cy + r * 0.48);
  needle(ctx, cx, cy, r * 0.85, toA(fpm), r * 0.06);
  glass(ctx, cx, cy, r);
}

function smallGauge(ctx, cx, cy, r, value, min, max, label, unit, zones, readout) {
  bezel(ctx, cx, cy, r);
  const toA = (v) => (-130 + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 260) * D;
  for (const [a, b, col] of zones) arc(ctx, cx, cy, r * 0.84, toA(a), toA(b), col, r * 0.1);
  ticks(ctx, cx, cy, r, toA(min), toA(max), 10, 5, null, r * 0.15);
  caption(ctx, cx, cy + r * 0.38, label, r * 0.2);
  ctx.fillStyle = '#9ff0a8';
  ctx.font = `bold ${r * 0.24}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(readout ?? `${Math.round(value)}${unit}`, cx, cy + r * 0.66);
  needle(ctx, cx, cy, r * 0.82, toA(value), r * 0.08);
  glass(ctx, cx, cy, r);
}

function levers(ctx, x, y, w, h, ac) {
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(x, y, w, h);
  const c = ac.controls;
  const lever = (lx, frac, color, label, value) => {
    const top = y + 16;
    const bot = y + h - 30;
    ctx.fillStyle = '#2a2f35';
    ctx.fillRect(lx - 4, top, 8, bot - top);
    const ky = bot - frac * (bot - top);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(lx - 13, ky - 9, 26, 18, 5); ctx.fill();
    caption(ctx, lx, y + h - 18, label, 12);
    caption(ctx, lx, y + 8, value, 12);
  };
  lever(x + w * 0.27, c.throttle, '#d9d9d9', 'THR', `${Math.round(c.throttle * 100)}%`);
  lever(x + w * 0.73, c.flaps, '#e8b923', 'FLAP', c.flaps === 0 ? 'UP' : c.flaps < 0.75 ? 'T/O' : 'LAND');
}

function lights(ctx, x, y, w, h, ac, extra) {
  const items = [
    ['STALL', ac.stallWarn, '#ff3b30'],
    ['FUEL LOW', ac.fuel.litres / ac.fuel.capacity < 0.15, '#ffb020'],
    ['ENG HOT', ac.engine.temp > 104, '#ff6a00'],
    ['ENG OUT', !ac.engine.running, '#ff3b30'],
    ['BRAKE', ac.controls.brake > 0, '#4fe0ff'],
    ['A/P', !!extra.autopilot, '#2ecc71'],
  ];
  const cols = 2;
  const cw = w / cols;
  const ch = h / 3;
  items.forEach(([label, on, col], i) => {
    const bx = x + (i % cols) * cw + 3;
    const by = y + Math.floor(i / cols) * ch + 3;
    ctx.fillStyle = on ? col : '#1d2126';
    ctx.fillRect(bx, by, cw - 6, ch - 6);
    ctx.fillStyle = on ? '#111' : '#59616a';
    ctx.font = `bold ${Math.min(14, ch * 0.42)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + (cw - 6) / 2, by + (ch - 6) / 2 + 1);
  });
}

function damageDiagram(ctx, x, y, w, h, ac) {
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(x, y, w, h);
  const d = ac.damage;
  const col = (v) => (v > 75 ? '#2ecc71' : v > 45 ? '#f1c40f' : v > 20 ? '#ff8a2a' : '#ff3b30');
  const cx = x + w * 0.36;
  const cy = y + h * 0.5;
  const s = Math.min(w * 0.36, h * 0.42);
  // wing
  ctx.fillStyle = col(d.airframe);
  ctx.fillRect(cx - s, cy - s * 0.42, s * 2, s * 0.24);
  // fuselage + tail (controls)
  ctx.fillStyle = col(d.airframe);
  ctx.fillRect(cx - s * 0.09, cy - s * 0.75, s * 0.18, s * 1.45);
  ctx.fillStyle = col(d.controls);
  ctx.fillRect(cx - s * 0.42, cy + s * 0.55, s * 0.84, s * 0.14);
  // engine at the nose
  ctx.fillStyle = col(d.engine);
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.8, s * 0.16, 0, Math.PI * 2); ctx.fill();
  // floats
  ctx.fillStyle = col(d.floats);
  ctx.fillRect(cx - s * 0.5, cy - s * 0.55, s * 0.13, s * 1.05);
  ctx.fillRect(cx + s * 0.37, cy - s * 0.55, s * 0.13, s * 1.05);
  const rows = [['ENG', d.engine], ['FRAME', d.airframe], ['FLOAT', d.floats], ['CTRL', d.controls]];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fs = Math.min(15, h / 6.2);
  rows.forEach(([n, v], i) => {
    const ty = y + h * 0.17 + i * (h * 0.22);
    ctx.font = `bold ${fs}px ${FONT}`;
    ctx.fillStyle = '#b8c2cc';
    ctx.fillText(n, x + w * 0.68, ty);
    ctx.fillStyle = col(v);
    ctx.fillText(`${Math.round(v)}%`, x + w * 0.68, ty + fs);
  });
  caption(ctx, x + w * 0.36, y + 9, 'DAMAGE', 12);
}

function panelBackground(ctx, x, y, w, h, cockpit) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cockpit ? '#30363a' : 'rgba(34,39,44,0.94)');
  g.addColorStop(1, cockpit ? '#1a1e21' : 'rgba(18,21,24,0.97)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = '#6b7178';
  for (let sx = x + 14; sx < x + w; sx += Math.max(160, w / 8)) {
    for (const sy of [y + 10, y + h - 10]) { ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

/**
 * Draw the panel. mode 'chase' puts a strip along the bottom; 'cockpit' draws the glare
 * shield, window posts and a full two-row panel. extra: { bug, autopilot }.
 */
export function drawInstrumentPanel(ctx, W, H, ac, mode, extra = {}) {
  const fuelPct = (ac.fuel.litres / ac.fuel.capacity) * 100;
  const mins = enduranceMinutes(ac.fuel, ac.spec);
  const fuelText = `${Math.round(ac.fuel.litres)} L`;
  const rpm = ac.engine.rpm;
  if (mode === 'cockpit') {
    // window frame: posts, roof edge and the glare shield over the panel
    ctx.fillStyle = '#23272b';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.07, 0); ctx.lineTo(W * 0.15, H * 0.62); ctx.lineTo(0, H * 0.62); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.93, 0); ctx.lineTo(W * 0.85, H * 0.62); ctx.lineTo(W, H * 0.62); ctx.fill();
    ctx.fillRect(0, 0, W, H * 0.045);
    const py = H * 0.58;
    const ph = H - py;
    ctx.fillStyle = '#16191c';
    ctx.beginPath(); ctx.moveTo(0, py + 10); ctx.quadraticCurveTo(W / 2, py - 40, W, py + 10); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    panelBackground(ctx, W * 0.03, py + 12, W * 0.94, ph - 12, true);
    const r1 = Math.min(ph * 0.24, W * 0.062);
    const row1 = py + 18 + r1 * 1.15;
    const row2 = row1 + r1 * 2.3;
    const xs = [0.17, 0.32, 0.47, 0.62].map((f) => W * f);
    airspeed(ctx, xs[0], row1, r1, ac);
    attitude(ctx, xs[1], row1, r1, ac);
    altimeter(ctx, xs[2], row1, r1, ac);
    vsi(ctx, xs[3], row1, r1, ac);
    heading(ctx, xs[1], row2, r1, ac, extra.bug);
    const r2 = r1 * 0.7;
    smallGauge(ctx, xs[0], row2, r2, rpm, 0, 3000, 'RPM', '', [[2400, 2600, '#2ecc71'], [2700, 3000, '#e74c3c']], `${Math.round(rpm / 10) * 10}`);
    smallGauge(ctx, xs[2], row2, r2, fuelPct, 0, 100, 'FUEL', '', [[0, 12, '#e74c3c'], [12, 25, '#f1c40f']], fuelText);
    smallGauge(ctx, xs[3], row2, r2, ac.engine.temp, 0, 140, 'CHT °C', '°', [[60, 100, '#2ecc71'], [100, 108, '#f1c40f'], [108, 140, '#e74c3c']]);
    levers(ctx, W * 0.71, py + 26, W * 0.09, ph - 40, ac);
    lights(ctx, W * 0.81, py + 26, W * 0.14, ph * 0.42, ac, extra);
    damageDiagram(ctx, W * 0.81, py + 30 + ph * 0.44, W * 0.14, ph * 0.46, ac);
    caption(ctx, W * 0.47, H - 14, Number.isFinite(mins) ? `ENDURANCE ${Math.round(mins)} MIN` : 'ENGINE OFF', 14);
    return { top: py };
  }
  // chase view strip
  const h = Math.round(Math.min(178, H * 0.22));
  const y = H - h;
  panelBackground(ctx, 0, y, W, h, false);
  const r = Math.min(h * 0.38, W * 0.053);
  const cy = y + h * 0.48;
  const step = r * 2.18;
  let x = r * 1.25;
  airspeed(ctx, x, cy, r, ac); x += step;
  attitude(ctx, x, cy, r, ac); x += step;
  altimeter(ctx, x, cy, r, ac); x += step;
  heading(ctx, x, cy, r, ac, extra.bug); x += step;
  vsi(ctx, x, cy, r, ac); x += step * 0.88;
  const rs = r * 0.6;
  smallGauge(ctx, x, y + h * 0.3, rs, rpm, 0, 3000, 'RPM', '', [[2400, 2600, '#2ecc71'], [2700, 3000, '#e74c3c']], `${Math.round(rpm / 10) * 10}`);
  smallGauge(ctx, x + rs * 2.35, y + h * 0.3, rs, fuelPct, 0, 100, 'FUEL', '', [[0, 12, '#e74c3c'], [12, 25, '#f1c40f']], fuelText);
  smallGauge(ctx, x + rs * 4.7, y + h * 0.3, rs, ac.engine.temp, 0, 140, 'CHT', '°', [[60, 100, '#2ecc71'], [100, 108, '#f1c40f'], [108, 140, '#e74c3c']]);
  caption(ctx, x + rs * 2.35, y + h * 0.82, Number.isFinite(mins) ? `ENDURANCE ${Math.round(mins)} MIN` : 'ENGINE OFF', 14);
  const lx = x + rs * 6.1;
  levers(ctx, lx, y + 8, 60, h - 16, ac);
  const dx = lx + 66;
  if (W - dx > 120) damageDiagram(ctx, dx, y + 8, W - dx - 8, h - 16, ac);
  return { top: y };
}

/** Warning lights block for HUD use outside the panel. */
export { lights as drawWarningLights };
