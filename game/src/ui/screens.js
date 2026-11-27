// The screens around a flight: title, the hangar (mission board, repairs and upgrades
// with costs, logbook and ratings, the radio cast with their states), the briefing, the
// debrief with grade, score lines, combo and a flight chart, the Harbour Board debt
// bar and chapter lines, pause and the controls card. Plain DOM, no framework.

import { MISSIONS } from '../missions/index.js';
import { UPGRADES } from '../aircraft/ternSpec.js';
import { CAST } from '../characters/radioCast.js';
import { WEATHER } from '../flight/windField.js';
import { timeOf } from '../render/timeOfDay.js';
import { repairCost, PARTS, PART_NAMES } from '../systems/damageModel.js';
import { isUnlocked, totalStars, pilotRating, FUEL_PRICE } from '../hangar/careerSave.js';
import { fmtTime } from '../missions/missionRunner.js';
import { KEY_HELP } from '../input/pilotControls.js';
import { DEBT, debtLeft, chapterFor, ENDING } from '../hangar/harbourDebt.js';
import { MAX, improveTip } from '../hangar/sortieScore.js';

export const WORDMARK = 'TIDEWING · CINDER REACH AIR SERVICE';

/** The Harbour Board debt as a bar: shillings left of the 12,000 owed. */
function debtBar(career, cls = '') {
  const left = debtLeft(career);
  const frac = 1 - left / DEBT;
  return `<div class="debt ${cls}"><div class="dl">HARBOUR BOARD NOTE <b>${left ? `${left.toLocaleString('en-US')} sh owed` : 'PAID IN FULL'}</b></div>
    <div class="dbar"><div style="width:${(frac * 100).toFixed(1)}%"></div></div>
    <div class="dt">${(DEBT - left).toLocaleString('en-US')} of ${DEBT.toLocaleString('en-US')} sh paid</div></div>`;
}

const nextSortie = (career) => Math.min(MISSIONS.length, MISSIONS.filter((m) => career.missions[m.id]?.stars > 0).length + 1);

const root = () => document.getElementById('ui');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = (n, of = 3) => `${'★'.repeat(n)}<i>${'★'.repeat(of - n)}</i>`;
const initials = (name) => name.replace('Dr. ', '').replace('Chief ', '').split(' ').map((p) => p[0]).join('').slice(0, 2);
const healthColour = (v) => (v > 75 ? '#7ee08f' : v > 45 ? '#ffd34a' : v > 20 ? '#ff9a3c' : '#ff5a4a');

export function clearScreens() {
  root().innerHTML = '';
}

function mount(html, cls = 'screen dim') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  root().innerHTML = '';
  root().appendChild(el);
  return el;
}

export function showTitle(onStart, career) {
  const ch = chapterFor(nextSortie(career));
  const el = mount(`
    <div class="logo">TIDEWING<small>CINDER REACH AIR SERVICE</small></div>
    <p>Ten sorties in the Tern Mk II floatplane for the islands of the Cinder Reach: mail drops, medevacs,
    fire bombing, a night lighthouse run, a squall-line crossing, a dead-stick glide off a volcano, a harbour survey and a buoy slalom.
    Every sortie is scored and debriefed, and every score pays down the 12,000 shillings the service owes the Harbour Board.</p>
    <p class="chapter">Chapter ${ch.no}: ${esc(ch.title)}. ${esc(debtLeft(career) ? ch.text : ENDING)}</p>
    ${debtBar(career, 'wide')}
    <button id="go">Open the hangar</button>
    <p style="font-size:15px;color:#b7c0c8">Keyboard and mouse · press H in flight for the controls</p>`, 'screen title-screen dim');
  el.querySelector('#go').onclick = onStart;
}

/**
 * The hangar: mission board, aircraft and shop, logbook, and the cast.
 * h: { onBrief(id), onRepair(part), onBuy(id), selected }
 */
export function showHangar(career, castStates, h) {
  const missionRows = MISSIONS.map((m, i) => {
    const rec = career.missions[m.id];
    const open = isUnlocked(career, i);
    const w = WEATHER[m.weather];
    const t = timeOf(m.timeOfDay);
    const best = rec && rec.bestTime ? `best ${(career.score.best[m.id] ?? 0).toLocaleString('en-US')} pts · ${fmtTime(rec.bestTime)} · landing ${rec.bestLanding}` : open ? `pays ${m.pay} sh · par ${fmtTime(m.parTime)}` : 'locked: fly the mission before';
    return `<div class="mission ${open ? '' : 'locked'} ${h.selected === m.id ? 'sel' : ''}" data-id="${m.id}" data-open="${open}">
      <div class="no">${m.order}</div>
      <div class="t">${esc(m.title)}</div>
      <div class="stars">${stars(rec ? rec.stars : 0)}</div>
      <div class="s">${esc(CAST[m.client].name)} · ${esc(t.label)} · ${esc(w.name)} · ${esc(best)}</div>
    </div>`;
  }).join('');
  const parts = PARTS.map((p) => {
    const v = career.damage[p];
    const cost = repairCost({ engine: 100, airframe: 100, floats: 100, controls: 100, [p]: v });
    return `<div class="part"><span>${PART_NAMES[p]}</span><div class="bar"><div style="width:${v}%;background:${healthColour(v)}"></div></div>
      <span style="color:${healthColour(v)}">${Math.round(v)}%</span>
      <button class="ghost" data-repair="${p}" ${cost <= 0 || career.cash < cost ? 'disabled' : ''}>${cost > 0 ? `Fix ${cost} sh` : 'OK'}</button></div>`;
  }).join('');
  const total = repairCost(career.damage);
  const ups = UPGRADES.map((u) => {
    const own = career.upgrades.includes(u.id);
    return `<div class="up ${own ? 'own' : ''}"><div><div class="n">${esc(u.name)}</div><div class="b">${esc(u.blurb)}</div></div>
      ${own ? '' : `<button data-buy="${u.id}" ${career.cash < u.cost ? 'disabled' : ''}>${u.cost} sh</button>`}</div>`;
  }).join('');
  const log = career.logbook.slice(0, 5).map((e) => `<tr><td>#${e.n}</td><td>${esc(e.title)}</td>
      <td class="${e.done ? 'a' : 'r'}">${e.done ? '★'.repeat(e.stars) : 'FAIL'}</td><td>${fmtTime(e.time)}</td>
      <td class="${e.landing === 'A' ? 'g' : ''}">${esc(e.landing)}</td><td class="g">+${e.pay}</td></tr>`).join('')
    || '<tr><td colspan="6" style="color:#b7c0c8">No flights yet. Your first job is on the board.</td></tr>';
  const cast = Object.entries(CAST).map(([id, c]) => {
    const trust = career.trust[id] ?? 0;
    return `<div class="person"><div class="face" style="background:${c.color}">${esc(initials(c.name))}</div>
      <div><div class="nm">${esc(c.name)}</div><div class="st">${esc(castStates[id] ?? c.state)}</div>
      <div class="tr">${esc(c.role)} · trust ${trust >= 0 ? '+' : ''}${trust}</div></div></div>`;
  }).join('');
  const done = MISSIONS.filter((m) => career.missions[m.id]?.stars > 0).length;
  const chapter = chapterFor(nextSortie(career));
  const el = mount(`
    <div class="topbar">
      <div class="logo">TIDEWING<small>CINDER REACH AIR SERVICE</small></div>
      ${debtBar(career)}
      <div class="cash">
        <div class="chip">Cash <b>${career.cash} sh</b></div>
        <div class="chip">Score <b>${career.score.total.toLocaleString('en-US')}</b> · combo <b>${career.score.combo}</b></div>
        <div class="chip">Stars <b>${totalStars(career)} / ${MISSIONS.length * 3}</b></div>
        <div class="chip">Rating <b>${esc(pilotRating(career))}</b></div>
      </div>
    </div>
    <div class="cols">
      <div class="card board"><h2>MISSION BOARD <span>${done}/${MISSIONS.length} flown · ch ${chapter.no}: ${esc(chapter.title)}</span></h2>
        <div class="boardnote">${esc(debtLeft(career) ? chapter.text : ENDING)}</div>${missionRows}</div>
      <div class="card"><h2>THE TERN <span>TW-07 · repairs and upgrades</span></h2>${parts}
        <div class="row" style="justify-content:space-between;align-items:center"><span style="color:#b7c0c8;font-size:14px">Fuel ${FUEL_PRICE} sh/L, billed after each flight</span>
        <button data-repair="all" ${total <= 0 || career.cash < total ? 'disabled' : ''}>Repair all ${total} sh</button></div>
        <h2 style="margin-top:4px">UPGRADES</h2>${ups}</div>
      <div class="card log"><h2>PILOT'S LOGBOOK <span>${career.flights} flights · ${career.hours.toFixed(1)} h</span></h2>
        <table><tr><th>#</th><th>Mission</th><th>Result</th><th>Time</th><th>Land</th><th>Pay</th></tr>${log}</table>
        <h2 style="margin-top:6px">RATINGS</h2>
        <table>${MISSIONS.map((m) => { const r = career.missions[m.id]; return `<tr><td>${m.order}. ${esc(m.title)}</td><td class="a">${r ? '★'.repeat(r.stars) || '-' : '-'}</td><td>${r && r.bestTime ? fmtTime(r.bestTime) : '--'}</td><td class="${r && r.bestLanding === 'A' ? 'g' : ''}">${r ? esc(r.bestLanding) : '-'}</td></tr>`; }).join('')}</table>
      </div>
    </div>
    <div class="cast">${cast}</div>`);
  el.querySelectorAll('.mission').forEach((row) => { row.onclick = () => { if (row.dataset.open === 'true') h.onBrief(row.dataset.id); }; });
  el.querySelectorAll('[data-repair]').forEach((b) => { b.onclick = () => h.onRepair(b.dataset.repair); });
  el.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => h.onBuy(b.dataset.buy); });
  return el;
}

export function showBriefing(def, objectives, career, onFly, onBack) {
  const c = CAST[def.client];
  const w = WEATHER[def.weather];
  const t = timeOf(def.timeOfDay);
  const el = mount(`<div class="brief">
    <div style="display:flex;gap:14px;align-items:center"><div class="face" style="width:58px;height:58px;font-size:22px;background:${c.color}">${esc(initials(c.name))}</div>
      <div><div style="color:var(--amber);font-weight:800">MISSION ${def.order} · ${esc(def.place.toUpperCase())}</div><h1>${esc(def.title)}</h1></div></div>
    <div class="meta"><span class="chip">${esc(t.label)}</span><span class="chip">${esc(w.name)} · wind ${String(def.windFrom).padStart(3, '0')}° ${w.windKt} kt</span>
      <span class="chip">Fuel <b>${Math.round((def.fuel ?? 1) * 100)}%</b></span><span class="chip">Pay <b>${def.pay} sh</b></span><span class="chip">Par <b>${fmtTime(def.parTime)}</b></span></div>
    <ul>${def.brief.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div style="color:var(--amber);font-weight:800">OBJECTIVES</div>
    <ol>${objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>
    <div style="color:#b7c0c8">Your Tern: ${PARTS.map((p) => `${PART_NAMES[p]} ${Math.round(career.damage[p])}%`).join(' · ')}${def.lends ? ' · fire service tank fitted for this job' : ''}</div>
    <div class="row"><button class="ghost" id="back">Back to hangar</button><button id="fly">Fly</button></div></div>`);
  el.querySelector('#fly').onclick = onFly;
  el.querySelector('#back').onclick = onBack;
}

/**
 * The debrief: grade letter, score lines, combo, a chart of altitude and airspeed over
 * the flight, one line on what to improve, and the Harbour Board note. Enter, Space or
 * Esc, or the button, goes back to the hangar.
 * x: { scored, debtPaid, trace, career }
 */
export function showDebrief(def, result, fuelBill, h, x) {
  const s = x.scored;
  const lines = s.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="pts">${l.pts} / ${MAX[l.key]}</td></tr>`).join('');
  const left = debtLeft(x.career);
  const gradeCol = { A: 'var(--good)', B: 'var(--good)', C: 'var(--amber)', D: 'var(--coral)', F: 'var(--bad)' }[s.grade];
  const el = mount(`<div class="brief debrief">
    <div class="dhead"><div class="grade" style="color:${gradeCol}">${s.grade}</div>
      <div><div class="kick">DEBRIEF · SORTIE ${def.order} OF ${MISSIONS.length}</div>
      <h1>${esc(def.title)}: ${result.done ? 'complete' : 'failed'}</h1>
      <div class="big-stars">${stars(result.stars)}</div></div>
      <div class="total"><div class="kick">SCORE</div><b>${s.total.toLocaleString('en-US')}</b>
        <div class="combo">${s.mult > 1 ? `COMBO ×${s.mult} · run of ${s.run}` : s.run ? 'COMBO RUN STARTED' : 'COMBO RESET'}</div></div></div>
    <div class="dcols"><table class="lines">${lines}<tr class="sum"><td>Base ${s.base} × combo ${s.mult}</td><td class="pts">${s.total}</td></tr></table>
      <div class="chartbox"><canvas width="460" height="150"></canvas></div></div>
    <div class="tip">▶ ${esc(improveTip(s))}</div>
    <div class="meta"><span class="chip">Time <b>${fmtTime(result.time)}</b></span><span class="chip">Pay <b>${result.pay} sh</b></span>
      <span class="chip">Fuel bill <b>${fuelBill} sh</b></span><span class="chip">To the Board <b>${x.debtPaid} sh</b></span></div>
    ${debtBar(x.career, 'wide')}
    ${left === 0 && x.debtPaid > 0 ? `<div class="ending">${esc(ENDING)}</div>` : ''}
    <div class="row"><button class="ghost" id="retry">Fly it again</button><button id="hangar">Back to the hangar (Enter)</button></div></div>`);
  drawTraceChart(el.querySelector('canvas'), x.trace);
  const go = () => { window.removeEventListener('keydown', key); h.onHangar(); };
  const key = (e) => {
    if (!el.isConnected) { window.removeEventListener('keydown', key); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); go(); }
  };
  window.addEventListener('keydown', key);
  el.querySelector('#retry').onclick = () => { window.removeEventListener('keydown', key); h.onRetry(); };
  el.querySelector('#hangar').onclick = go;
}

/** Altitude (amber, left scale) and airspeed (cyan, right scale) over the flight. */
export function drawTraceChart(cv, trace) {
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const pad = { l: 46, r: 40, t: 22, b: 20 };
  ctx.clearRect(0, 0, W, H);
  if (!trace || trace.length < 2) return;
  const maxFt = Math.max(500, ...trace.map((p) => p[0])) * 1.1;
  const maxKt = Math.max(60, ...trace.map((p) => p[1])) * 1.1;
  const px = (i) => pad.l + (i / (trace.length - 1)) * (W - pad.l - pad.r);
  ctx.font = 'bold 12px "Trebuchet MS", Arial, sans-serif';
  ctx.strokeStyle = 'rgba(255,220,190,0.14)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 2; k++) { const y = pad.t + k * (H - pad.t - pad.b) / 2; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); }
  const series = (idx, max, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
    trace.forEach((p, i) => { const y = H - pad.b - (p[idx] / max) * (H - pad.t - pad.b); i ? ctx.lineTo(px(i), y) : ctx.moveTo(px(i), y); });
    ctx.stroke();
  };
  series(0, maxFt, '#ffb347');
  series(1, maxKt, '#5fe3ff');
  ctx.fillStyle = '#ffb347'; ctx.textAlign = 'left'; ctx.fillText('ALTITUDE FT', pad.l, 12);
  ctx.textAlign = 'right'; ctx.fillText(Math.round(maxFt / 1.1).toLocaleString('en-US'), pad.l - 6, pad.t + 10);
  ctx.fillText('0', pad.l - 6, H - pad.b);
  ctx.fillStyle = '#5fe3ff'; ctx.fillText('AIRSPEED KT', W - pad.r, 12);
  ctx.textAlign = 'left'; ctx.fillText(String(Math.round(maxKt / 1.1)), W - pad.r + 6, pad.t + 10);
  ctx.fillStyle = '#d6c3b4'; ctx.textAlign = 'center';
  ctx.fillText(`${fmtTime(trace.length - 1)} flight`, (pad.l + W - pad.r) / 2, H - 5);
}

export function showPause(h) {
  const el = mount(`<div class="brief" style="width:min(620px,92%)"><h1>Paused</h1>
    <div class="help">${KEY_HELP.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
    <div class="row"><button class="ghost" id="abort">Abort to hangar</button><button class="ghost" id="restart">Restart</button><button id="resume">Resume</button></div></div>`);
  el.querySelector('#resume').onclick = h.onResume;
  el.querySelector('#restart').onclick = h.onRestart;
  el.querySelector('#abort').onclick = h.onAbort;
}
