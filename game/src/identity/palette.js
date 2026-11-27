// Tidewing identity, declared once: the five colours, the two type voices, the one
// panel shape box() with its sulphur ledger tab and cut corner, the round DUE / PAID
// stamp of the Port Halyard Board, and the wordmark. The HUD, the instrument labels,
// the screens (through CSS variables) and the debrief chart all draw from here.

export const TOKENS = {
  basalt: '#16120f', // panels and the night
  sulphur: '#f2c230', // the service's colour: labels, trim, cautions
  lagoon: '#2fc4b4', // live data and things done well
  ledger: '#efe6cf', // ink, numerals, paper
  ember: '#e5482d', // the debt, and nothing else
  mist: '#9fbccc', // secondary ink on panels
};

export const INK = {
  panel: 'rgba(22,18,15,0.84)',
  panelDeep: 'rgba(14,11,9,0.92)',
  rule: 'rgba(239,230,207,0.2)',
  dim: 'rgba(239,230,207,0.62)',
  shadow: 'rgba(0,0,0,0.7)',
};

/** Banner and wordmark voice: tall and condensed. Numerals: a narrow engineering face. */
export const FACE = {
  display: 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif',
  numeral: '"DIN Condensed", "Bahnschrift Condensed", Bahnschrift, "Arial Narrow", sans-serif',
  body: '"Avenir Next Condensed", "Avenir Next", "Segoe UI", "Trebuchet MS", sans-serif',
};

export const WORDMARK = 'TIDEWING';
export const SERVICE = 'PORT HALYARD AIR SERVICE';

/**
 * The one panel shape: basalt, the top-right corner cut, a sulphur tab down the left edge
 * like a ledger's index. opts: { fill, tab (colour or null), cut }.
 */
export function box(ctx, x, y, w, h, opts = {}) {
  const cut = Math.min(opts.cut ?? 12, h / 2, w / 2);
  ctx.fillStyle = opts.fill ?? INK.panel;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.rule;
  ctx.lineWidth = 1;
  ctx.stroke();
  const tab = opts.tab === undefined ? TOKENS.sulphur : opts.tab;
  if (tab) {
    ctx.fillStyle = tab;
    ctx.fillRect(x, y, 4, Math.min(h, Math.max(18, h * 0.42)));
  }
}

/** Text in one of the faces. face: 'body' | 'numeral' | 'display'. */
export function text(ctx, s, x, y, size, color = TOKENS.ledger, align = 'left', face = 'body') {
  const weight = face === 'body' ? '700' : face === 'numeral' ? '700' : '400';
  ctx.font = `${weight} ${size}px ${FACE[face]}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = INK.shadow;
  ctx.shadowBlur = 4;
  // DIN Condensed sits high in its box: nudge it onto the line
  ctx.fillText(s, x, face === 'numeral' ? y + size * 0.08 : y);
  ctx.shadowBlur = 0;
}

/** Width of s in a face, for layout. */
export function measure(ctx, s, size, face = 'body') {
  ctx.font = `${face === 'display' ? '400' : '700'} ${size}px ${FACE[face]}`;
  return ctx.measureText(s).width;
}

/**
 * The Board's round stamp: two rings, the word big across the middle and the Board's name
 * small above and below. DUE stamps in ember, PAID in lagoon.
 */
export function stamp(ctx, cx, cy, r, word, opts = {}) {
  const color = opts.color ?? (word === 'PAID' ? TOKENS.lagoon : TOKENS.ember);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.angle ?? -0.21);
  ctx.globalAlpha = opts.alpha ?? 0.92;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.86, -r * 0.24, r * 1.72, r * 0.48);
  ctx.font = `400 ${Math.round(r * 0.42)}px ${FACE.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TOKENS.basalt;
  ctx.fillText(word, 0, r * 0.02);
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(r * 0.15)}px ${FACE.body}`;
  ctx.fillText(opts.top ?? 'PORT HALYARD', 0, -r * 0.48);
  ctx.fillText(opts.bottom ?? 'BOARD', 0, r * 0.5);
  ctx.restore();
}

/** The screens read the same palette as the canvas: write the tokens as CSS variables. */
export function applyPaletteToCss(root = globalThis.document?.documentElement) {
  if (!root) return;
  const vars = {
    '--basalt': TOKENS.basalt, '--sulphur': TOKENS.sulphur, '--lagoon': TOKENS.lagoon,
    '--ledger': TOKENS.ledger, '--ember': TOKENS.ember, '--mist': TOKENS.mist,
    '--panel': INK.panel, '--panel-deep': INK.panelDeep, '--rule': INK.rule, '--dim-ink': INK.dim,
    '--face-display': FACE.display, '--face-num': FACE.numeral, '--face-body': FACE.body,
    // older names the stylesheet still uses, mapped onto the five colours
    '--ink': TOKENS.ledger, '--dim': INK.dim, '--amber': TOKENS.sulphur, '--coral': TOKENS.ember,
    '--cyan': TOKENS.lagoon, '--good': TOKENS.lagoon, '--bad': TOKENS.sulphur, '--edge': INK.rule, '--red': TOKENS.ember,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}
