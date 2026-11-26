// The debrief's flight trace: height above the ground and airspeed over the whole
// sortie as an SVG chart, with liftoffs, objectives, touchdowns, bounces, stalls and the
// crash marked where they happened, so a bad landing or a crash reads as what it was.

const W = 820;
const H = 190;
const PAD = { l: 46, r: 46, t: 14, b: 26 };
const MARK_STYLE = {
  liftoff: ['#5fe3ff', 'UP'],
  touchdown: ['#7ee08f', 'TD'],
  bounce: ['#ffbf3c', 'B'],
  stall: ['#ff7a66', 'ST'],
  crash: ['#ff5a4a', 'X'],
  objective: ['#ffbf3c', ''],
};

export function flightTraceSvg(trace, marks) {
  if (!trace || trace.length < 2) return '';
  const t1 = trace[trace.length - 1][0] || 1;
  const maxAgl = Math.max(100, ...trace.map((p) => p[1]));
  const maxKt = Math.max(60, ...trace.map((p) => p[2] * 1.944));
  const x = (t) => PAD.l + (t / t1) * (W - PAD.l - PAD.r);
  const yA = (a) => H - PAD.b - (a / maxAgl) * (H - PAD.t - PAD.b);
  const yS = (kt) => H - PAD.b - (kt / maxKt) * (H - PAD.t - PAD.b);
  const alt = trace.map((p) => `${x(p[0]).toFixed(1)},${yA(p[1]).toFixed(1)}`).join(' ');
  const spd = trace.map((p) => `${x(p[0]).toFixed(1)},${yS(p[2] * 1.944).toFixed(1)}`).join(' ');
  const area = `${x(0)},${H - PAD.b} ${alt} ${x(t1)},${H - PAD.b}`;
  const ticks = [];
  const step = t1 > 600 ? 120 : 60;
  for (let t = 0; t <= t1; t += step) {
    ticks.push(`<line x1="${x(t)}" y1="${H - PAD.b}" x2="${x(t)}" y2="${H - PAD.b + 4}" stroke="#8a96a2"/><text x="${x(t)}" y="${H - 6}" fill="#8a96a2" font-size="11" text-anchor="middle">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</text>`);
  }
  const marksSvg = (marks ?? []).map((m) => {
    const [col, label] = MARK_STYLE[m.type] ?? ['#fff', '?'];
    const mx = x(Math.min(m.t, t1));
    const text = m.type === 'objective' ? `${m.n}` : label;
    return `<line x1="${mx}" y1="${PAD.t}" x2="${mx}" y2="${H - PAD.b}" stroke="${col}" stroke-dasharray="3 3" opacity="0.7"/>`
      + `<text x="${mx + 3}" y="${PAD.t + 10}" fill="${col}" font-size="11" font-weight="700">${text}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Flight trace: height and airspeed over time">
    <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="rgba(255,255,255,0.04)"/>
    <polygon points="${area}" fill="rgba(95,227,255,0.18)"/>
    <polyline points="${alt}" fill="none" stroke="#5fe3ff" stroke-width="2"/>
    <polyline points="${spd}" fill="none" stroke="#ffbf3c" stroke-width="1.6"/>
    ${ticks.join('')}${marksSvg}
    <text x="6" y="${PAD.t + 10}" fill="#5fe3ff" font-size="11" font-weight="700">${Math.round(maxAgl * 3.28)} ft</text>
    <text x="6" y="${H - PAD.b}" fill="#5fe3ff" font-size="11">AGL</text>
    <text x="${W - 6}" y="${PAD.t + 10}" fill="#ffbf3c" font-size="11" font-weight="700" text-anchor="end">${Math.round(maxKt)} kt</text>
    <text x="${W - 6}" y="${H - PAD.b}" fill="#ffbf3c" font-size="11" text-anchor="end">IAS</text>
  </svg>`;
}
