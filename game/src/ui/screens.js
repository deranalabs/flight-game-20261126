// The screens around a flight, all in the Tidewing identity: the title with the note and
// the assist level, the hangar board (the debt, the contracts, the Tern's repairs and
// refits, feats, the Board's ledger, crew and contacts), the briefing with its chapter,
// contract and the squeeze choice, the debrief as a stamped receipt with the flight
// recorder and the refit cards, pause and the controls card. Plain DOM, no framework.

import { MISSIONS } from '../missions/index.js';
import { UPGRADES } from '../aircraft/ternSpec.js';
import { CAST } from '../characters/radioCast.js';
import { WEATHER } from '../flight/windField.js';
import { timeOf } from '../render/timeOfDay.js';
import { repairCost, PARTS, PART_NAMES } from '../systems/damageModel.js';
import { isUnlocked, pilotRating, FUEL_PRICE } from '../hangar/careerSave.js';
import { fmtTime } from '../missions/missionRunner.js';
import { KEY_HELP } from '../input/pilotControls.js';
import { debtLeft, debtOwed, debtPaidFrac, chapterFor, standing } from '../hangar/harbourDebt.js';
import { MAX, improveTip } from '../hangar/sortieScore.js';
import { TOKENS, WORDMARK, SERVICE, stamp } from '../identity/palette.js';
import { contractFor, MISSION_TYPES, CHOICE } from '../story/storyline.js';
import { PEOPLE, personState, clerkPatience } from '../world/cast.js';
import { FEATS, featsEarned } from '../hangar/feats.js';
import { REFITS, refitsFitted } from '../hangar/refits.js';

const sh = (n) => `${Math.round(n).toLocaleString('en-US')}`;

/** The Board's note as a bar: what is paid of everything owed. */
function debtBar(career, cls = '') {
  const left = debtLeft(career);
  return `<div class="debt panel ${cls}"><div class="dl">PORT HALYARD BOARD · NOTE <b>${left ? `${sh(left)} SH OWED` : 'PAID IN FULL'}</b></div>
    <div class="dbar"><div style="width:${(debtPaidFrac(career) * 100).toFixed(1)}%"></div></div>
    <div class="dt">${sh(career.debtPaid ?? 0)} of ${sh(debtOwed(career))} sh paid</div></div>`;
}

/** A round DUE / PAID stamp: a canvas the mount step draws with the identity's stamp(). */
const stampTag = (word, size = 150, cls = '') => `<canvas class="stamp ${cls}" data-word="${word}" width="${size}" height="${size}"></canvas>`;
function drawStamps(el) {
  el.querySelectorAll('canvas.stamp').forEach((cv) => {
    const r = cv.width / 2 - 6;
    stamp(cv.getContext('2d'), cv.width / 2, cv.height / 2, r, cv.dataset.word);
  });
}

const nextSortie = (career) => Math.min(MISSIONS.length, MISSIONS.filter((m) => career.missions[m.id]?.stars > 0).length + 1);
const chapterNow = (career) => chapterFor(nextSortie(career), MISSIONS.length);

const root = () => document.getElementById('ui');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stars = (n, of = 3) => `${'★'.repeat(n)}<i>${'★'.repeat(of - n)}</i>`;
const initials = (name) => name.replace('Dr. ', '').replace('Chief ', '').split(' ').map((p) => p[0]).join('').slice(0, 2);
const healthColour = (v) => (v > 75 ? TOKENS.lagoon : v > 40 ? TOKENS.sulphur : TOKENS.ledger);

export function clearScreens() {
  root().innerHTML = '';
}

function mount(html, cls = 'screen dim') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  root().innerHTML = '';
  root().appendChild(el);
  drawStamps(el);
  return el;
}

/** Title: the wordmark, the note, the chapter and the clerk, the scope, the assist level. */
export function showTitle(onStart, career, info) {
  const ch = chapterNow(career);
  const left = debtLeft(career);
  const el = mount(`
    <div class="wordmark">${WORDMARK}<small>${SERVICE}</small></div>
    <p class="premise">A floatplane pilot owes the Port Halyard Board 12,000 sh and flies contracts across the Cinder Reach to clear it before the season closes.</p>
    <div class="note-hero">${stampTag(left ? 'DUE' : 'PAID', 150)}<div><div class="kick">THE NOTE · CHAPTER ${ch.no} ${esc(ch.title)}</div>
      <div class="owed">${sh(left)} <span>SH OWED</span></div><div class="clerk">“${esc(ch.clerk)}” · Ansel Mott, clerk of the Board</div></div></div>
    <div class="scope">${esc(info.scope)}</div>
    <div class="assist"><button class="ghost" data-assist="easy">EASY<small>auto rudder · stall nudge</small></button>
      <button data-assist="standard">STANDARD<small>the Tern as she flies</small></button>
      <button class="ghost" data-assist="expert">EXPERT<small>no hints · no autopilot</small></button></div>
    <p class="keys">Keyboard and mouse or a gamepad · press Esc in flight for the controls</p>`, 'screen title-screen dim');
  el.querySelectorAll('[data-assist]').forEach((b) => { b.onclick = () => onStart(b.dataset.assist); });
}

/**
 * The hangar board: the note in big numerals, the contracts, the Tern with repairs and
 * refits, the feats, the Board's ledger, crew and contacts.
 * h: { onBrief(id), onRepair(part), onBuy(id), selected }
 */
export function showHangar(career, castStates, h) {
  const ch = chapterNow(career);
  const left = debtLeft(career);
  const missionRows = MISSIONS.map((m, i) => {
    const rec = career.missions[m.id];
    const open = isUnlocked(career, i);
    const w = WEATHER[m.weather];
    const t = timeOf(m.timeOfDay);
    const k = contractFor(m.id);
    const best = rec && rec.bestTime ? `best ${sh(career.score.best[m.id] ?? 0)} · ${fmtTime(rec.bestTime)} · ${rec.bestLanding}` : open ? `${esc(PEOPLE[k.who]?.name ?? '')} · ${esc(t.label)} · ${esc(w.name)}` : 'locked';
    return `<div class="mission ${open ? '' : 'locked'} ${h.selected === m.id ? 'sel' : ''}" data-id="${m.id}" data-open="${open}">
      <div class="no">${m.order}</div>
      <div class="t">${esc(m.title)} <em class="ty ty-${k.type}">${esc(MISSION_TYPES[k.type])}</em></div>
      <div class="stars">${stars(rec ? rec.stars : 0)}</div>
      <div class="s">${best}</div>
    </div>`;
  }).join('');
  const parts = PARTS.map((p) => {
    const v = career.damage[p];
    const cost = repairCost({ engine: 100, airframe: 100, floats: 100, controls: 100, [p]: v });
    return `<div class="part"><span>${PART_NAMES[p]}</span><div class="bar"><div style="width:${v}%;background:${healthColour(v)}"></div></div>
      <span>${Math.round(v)}%</span>
      <button class="ghost" data-repair="${p}" ${cost <= 0 || career.cash < cost ? 'disabled' : ''}>${cost > 0 ? `Fix ${cost} sh` : 'OK'}</button></div>`;
  }).join('');
  const total = repairCost(career.damage);
  const refits = REFITS.map((r) => {
    const own = career.upgrades.includes(r.id);
    const shop = UPGRADES.find((u) => u.id === r.id);
    return `<div class="up ${own ? 'own' : ''}"><div><div class="n"><i>${esc(r.part)}</i> ${esc(r.name)}</div><div class="b">${esc(r.blurb)}</div></div>
      ${own || !shop ? '' : `<button class="ghost" data-buy="${r.id}" ${career.cash < r.cost ? 'disabled' : ''}>${r.cost} sh cash</button>`}</div>`;
  }).join('');
  const feats = FEATS.map((f) => {
    const n = career.feats?.[f.id] ?? 0;
    return `<div class="medal ${n ? 'won' : ''}" title="${esc(f.blurb)}"><b>${esc(f.icon)}</b><span>${esc(f.name)}</span>${n ? `<em>×${n}</em>` : ''}</div>`;
  }).join('');
  const ledger = (career.ledger ?? []).slice(-6).reverse().map((e) => `<tr><td>${esc(e.label)}</td><td class="${e.sh > 0 ? 'owe' : 'pay'}">${e.sh > 0 ? '+' : '−'}${sh(Math.abs(e.sh))}</td></tr>`).join('')
    || '<tr><td colspan="2" class="quiet">No entries yet. The note stands at 12,000 sh.</td></tr>';
  const crew = Object.keys(PEOPLE).map((id) => {
    const p = personState(id, ch.no, career.trust[id] ?? 0);
    const c = CAST[id];
    return `<div class="person panel"><div class="face" style="background:${c?.color ?? TOKENS.sulphur}">${esc(initials(p.name))}</div>
      <div><div class="nm">${esc(p.name)}</div><div class="st">${esc(id === 'ansel' ? `PATIENCE ${clerkPatience(ch.no, 1 - debtPaidFrac(career))}%` : p.mood)}</div>
      <div class="tr">wants ${esc(p.want)}</div></div></div>`;
  }).join('');
  const done = MISSIONS.filter((m) => career.missions[m.id]?.stars > 0).length;
  const el = mount(`
    <div class="topbar">
      <div class="logo">${WORDMARK}<small>${SERVICE}</small></div>
      <div class="owed-block">${stampTag(left ? 'DUE' : 'PAID', 104)}<div><div class="kick">CH ${ch.no} · ${esc(ch.title)} · ${done}/${MISSIONS.length} FLOWN</div><div class="owed">${sh(left)}<span> SH OWED</span></div></div></div>
      <div class="counts"><div><b>${featsEarned(career)}<i>/${FEATS.length}</i></b>FEATS</div><div><b>${refitsFitted(career)}<i>/${REFITS.length}</i></b>REFITS</div>
        <div><b>${sh(career.cash)}</b>CASH SH</div></div>
    </div>
    <div class="cols">
      <div class="card panel board"><h2>CONTRACTS <span>${esc(ch.plate)}</span></h2>${missionRows}</div>
      <div class="card panel"><h2>THE TERN <span>TW-07 · repairs · refits ${refitsFitted(career)}/${REFITS.length}</span></h2>${parts}
        <div class="row" style="justify-content:space-between;align-items:center"><span class="quiet">Fuel ${FUEL_PRICE} sh/L, billed after each flight</span>
        <button data-repair="all" ${total <= 0 || career.cash < total ? 'disabled' : ''}>Repair all ${total} sh</button></div>
        <div class="refits">${refits}</div></div>
      <div class="card panel log"><h2>FEATS <span>${featsEarned(career)} / ${FEATS.length} · score ${sh(career.score.total)} · ${esc(pilotRating(career))}</span></h2>
        <div class="medals">${feats}</div>
        <h2>THE BOARD'S LEDGER <span>${sh(career.debtPaid ?? 0)} paid</span></h2><table class="ledger">${ledger}</table>
      </div>
    </div>
    <div class="cast">${crew}</div>`);
  el.querySelectorAll('.mission').forEach((row) => { row.onclick = () => { if (row.dataset.open === 'true') h.onBrief(row.dataset.id); }; });
  el.querySelectorAll('[data-repair]').forEach((b) => { b.onclick = () => h.onRepair(b.dataset.repair); });
  el.querySelectorAll('[data-buy]').forEach((b) => { b.onclick = () => h.onBuy(b.dataset.buy); });
  return el;
}

/** Briefing: the chapter, the contract and who it helps, the day's event, the choice. */
export function showBriefing(def, objectives, career, onFly, onBack, story) {
  const c = CAST[def.client];
  const w = WEATHER[def.weather];
  const t = timeOf(def.timeOfDay);
  const k = story.contract;
  const ch = story.chapter;
  const choice = story.choice
    ? `<div class="choice panel"><div class="kick">${esc(story.choice.title)} · THE CHOICE MOVES THE NOTE</div>
        <div class="row" style="justify-content:flex-start">${story.choice.options.map((o) => `<button class="${(career.choice ?? story.choice.fallback) === o.id ? '' : 'ghost'}" data-choose="${o.id}">${esc(o.label)}<small>${esc(o.line)}</small></button>`).join('')}</div></div>`
    : '';
  const el = mount(`<div class="brief panel">
    <div class="kick">CHAPTER ${ch.no} · ${esc(ch.title)} · SORTIE ${def.order} OF ${MISSIONS.length} · ${esc(MISSION_TYPES[k.type])}</div>
    <div style="display:flex;gap:14px;align-items:center"><div class="face" style="width:58px;height:58px;font-size:22px;background:${c.color}">${esc(initials(c.name))}</div>
      <div><h1>${esc(def.title)}</h1><div class="quiet">${esc(story.island.name)} · ${esc(story.island.harbour)} · trade in ${esc(story.island.trade)} · ${esc(story.person.name)} ${esc(story.person.mood.toLowerCase())}</div></div>
      ${stampTag('DUE', 96, 'right')}</div>
    <div class="contract">“${esc(k.before)}”</div>
    ${story.event ? `<div class="event"><b>${esc(story.event.title)}</b> ${esc(story.event.cue)} <i>+${story.event.bonus} sh to the note</i></div>` : ''}
    <div class="meta"><span class="chip">${esc(t.label)}</span><span class="chip">${esc(w.name)} · wind ${String(def.windFrom).padStart(3, '0')}° ${w.windKt} kt</span>
      <span class="chip">Fuel <b>${Math.round((def.fuel ?? 1) * 100)}%</b></span><span class="chip">Pay <b>${def.pay} sh</b></span><span class="chip">Par <b>${fmtTime(def.parTime)}</b></span>
      <span class="chip owe">Owed <b>${sh(story.left)} sh</b></span></div>
    <ul>${def.brief.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <ol>${objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>
    ${choice}
    <div class="quiet">Your Tern: ${PARTS.map((p) => `${PART_NAMES[p]} ${Math.round(career.damage[p])}%`).join(' · ')}${def.lends ? ' · fire service tank fitted for this job' : ''}</div>
    <div class="row"><button class="ghost" id="back">Back to the board</button><button id="fly">Fly</button></div></div>`);
  el.querySelector('#fly').onclick = onFly;
  el.querySelector('#back').onclick = onBack;
  el.querySelectorAll('[data-choose]').forEach((b) => {
    b.onclick = () => { story.onChoose(b.dataset.choose); el.querySelectorAll('[data-choose]').forEach((x) => x.classList.toggle('ghost', x !== b)); };
  });
}

/**
 * The debrief, a stamped receipt: the grade as the headline, what the sortie paid and what
 * is still owed, the score lines and combo, the flight recorder, one tip, the feats earned
 * and three refit cards. On the last sortie the final receipt stamps the ending.
 * x: { scored, debtPaid, settled, trace, career, feats, refits, contract, last }
 */
export function showDebrief(def, result, fuelBill, h, x) {
  const s = x.scored;
  const lines = s.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="pts">${l.pts} / ${MAX[l.key]}</td></tr>`).join('');
  const left = debtLeft(x.career);
  const end = x.last && result.done ? standing(x.career) : null;
  const word = end ? end.word.split('-')[0] : left ? 'DUE' : 'PAID';
  const st = x.settled ?? { paid: x.debtPaid, bonus: 0, choice: 0, fee: 0 };
  const extra = [st.bonus ? `event +${st.bonus}` : '', st.choice ? `choice +${st.choice}` : '', st.fee ? `Board fee −${sh(st.fee)}` : ''].filter(Boolean).join(' · ');
  const feats = (x.feats ?? []).map((f) => `<span class="medal won"><b>${esc(f.icon)}</b><span>${esc(f.name)}</span></span>`).join('') || '<span class="quiet">No feats this time.</span>';
  const cards = (x.refits ?? []).map((r) => `<button class="refit ghost" data-refit="${r.id}"><i>${esc(r.part)}</i><b>${esc(r.name)}</b><span>${esc(r.blurb)}</span><em>+${sh(r.cost)} sh on the note</em></button>`).join('');
  const el = mount(`<div class="brief panel debrief">
    <div class="dhead"><div class="grade g-${s.grade}">${s.grade}</div>
      <div><div class="kick">RECEIPT · SORTIE ${def.order} OF ${MISSIONS.length} · ${esc(MISSION_TYPES[x.contract?.type ?? 'haul'])}</div>
      <h1>${esc(end ? end.title : def.title)}</h1>
      <div class="contract">“${esc(end ? end.text : result.done ? x.contract?.after ?? '' : result.reason ?? 'The job is not done.')}”</div></div>
      <div class="total"><div class="kick">PAID TO THE BOARD <b>+${sh(x.debtPaid)}</b></div>
        <div class="owed">${sh(left)}<span> SH OWED</span></div>${extra ? `<div class="quiet">${esc(extra)}</div>` : ''}</div>
      ${stampTag(word, 132)}</div>
    <div class="dcols"><div><table class="lines">${lines}<tr class="sum"><td>Base ${s.base} × combo ${s.mult}${s.mult > 1 ? ` · run of ${s.run}` : ''}</td><td class="pts">${s.total}</td></tr></table>
      <div class="tip">▶ ${esc(improveTip(s))}</div>
      <div class="medals row-medals">${feats}</div></div>
      <div class="chartbox"><canvas class="chart" width="460" height="232"></canvas></div></div>
    ${cards ? `<div class="kick">REFIT · PICK ONE CARD, CHARGED TO THE NOTE</div><div class="cards">${cards}</div>` : ''}
    <div class="meta"><span class="chip">Time <b>${fmtTime(result.time)}</b></span><span class="chip">Cash pay <b>${result.pay} sh</b></span>
      <span class="chip">Fuel bill <b>${fuelBill} sh</b></span>${debtBar(x.career)}</div>
    <div class="row"><button class="ghost" id="retry">Fly it again</button><button id="hangar">Back to the board (Enter)</button></div></div>`);
  drawTraceChart(el.querySelector('canvas.chart'), x.trace);
  el.querySelectorAll('[data-refit]').forEach((b) => {
    b.onclick = () => { h.onRefit?.(b.dataset.refit); el.querySelectorAll('[data-refit]').forEach((c) => { c.disabled = true; }); b.classList.remove('ghost'); };
  });
  const go = () => { window.removeEventListener('keydown', key); h.onHangar(); };
  const key = (e) => {
    if (!el.isConnected) { window.removeEventListener('keydown', key); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); go(); }
  };
  window.addEventListener('keydown', key);
  el.querySelector('#retry').onclick = () => { window.removeEventListener('keydown', key); h.onRetry(); };
  el.querySelector('#hangar').onclick = go;
}

/**
 * The flight recorder: four thin strips on one shared time axis (altitude, airspeed, fuel,
 * load factor), each with its own scale and one direct label, the touchdown marked and
 * sharp load changes (gusts) as small ticks. One axis per strip, never a dual axis.
 */
export function drawTraceChart(cv, trace) {
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!trace || trace.length < 2) return;
  const strips = [
    { i: 0, label: 'ALT FT', col: TOKENS.lagoon, min: 0 },
    { i: 1, label: 'SPEED KT', col: TOKENS.sulphur, min: 0 },
    { i: 2, label: 'FUEL %', col: TOKENS.ledger, min: 0, max: 100 },
    { i: 3, label: 'LOAD G', col: TOKENS.mist, min: 0, max: 2.5 },
  ];
  const l = 84;
  const r = 10;
  const top = 6;
  const bottom = 18;
  const sh = (H - top - bottom) / strips.length;
  const px = (k) => l + (k / (trace.length - 1)) * (W - l - r);
  // touchdown: the first moment after the highest point that the altitude is near the surface
  let peak = 0;
  trace.forEach((p, k) => { if (p[0] > trace[peak][0]) peak = k; });
  const td = trace.findIndex((p, k) => k > peak && p[0] < 15);
  strips.forEach((st, n) => {
    const y0 = top + n * sh;
    const vals = trace.map((p) => p[st.i] ?? 0);
    const max = st.max ?? Math.max(1, ...vals) * 1.08;
    const yOf = (v) => y0 + sh - 4 - ((Math.min(max, v) - st.min) / (max - st.min)) * (sh - 10);
    ctx.fillStyle = 'rgba(239,230,207,0.05)';
    ctx.fillRect(l, y0 + 2, W - l - r, sh - 4);
    ctx.strokeStyle = st.col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    vals.forEach((v, k) => (k ? ctx.lineTo(px(k), yOf(v)) : ctx.moveTo(px(k), yOf(v))));
    ctx.stroke();
    ctx.fillStyle = st.col;
    ctx.font = '700 13px "DIN Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(st.label, 4, y0 + sh / 2 - 7);
    ctx.fillStyle = 'rgba(239,230,207,0.7)';
    ctx.fillText(st.i === 3 ? Math.max(...vals).toFixed(1) : Math.round(Math.max(...vals)).toLocaleString('en-US'), 4, y0 + sh / 2 + 9);
    if (st.i === 3) {
      // gusts: sharp changes in load factor, as small ticks under the strip
      ctx.fillStyle = TOKENS.sulphur;
      for (let k = 1; k < vals.length; k++) if (Math.abs(vals[k] - vals[k - 1]) > 0.25) ctx.fillRect(px(k) - 1, y0 + sh - 5, 2, 5);
    }
  });
  if (td > 0) {
    ctx.strokeStyle = TOKENS.ledger;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(px(td), top); ctx.lineTo(px(td), H - bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = TOKENS.ledger;
    ctx.textAlign = 'center';
    ctx.fillText('TOUCHDOWN', Math.min(W - 40, px(td)), H - 7);
  }
  ctx.fillStyle = 'rgba(239,230,207,0.7)';
  ctx.textAlign = 'left';
  ctx.fillText(`0:00 · ${fmtTime(trace.length - 1)} FLIGHT`, l, H - 7);
}

export function showPause(h) {
  const el = mount(`<div class="brief" style="width:min(620px,92%)"><h1>Paused</h1>
    <div class="help">${KEY_HELP.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
    <div class="row"><button class="ghost" id="abort">Abort to hangar</button><button class="ghost" id="restart">Restart</button><button id="resume">Resume</button></div></div>`);
  el.querySelector('#resume').onclick = h.onResume;
  el.querySelector('#restart').onclick = h.onRestart;
  el.querySelector('#abort').onclick = h.onAbort;
}
