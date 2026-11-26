// The screens around a flight: title, the hangar (mission board, repairs and upgrades
// with costs, logbook and ratings, the radio cast with their states), the briefing, the
// debrief with stars and pay, pause and the controls card. Plain DOM, no framework.

import { MISSIONS } from '../missions/index.js';
import { UPGRADES } from '../aircraft/ternSpec.js';
import { CAST } from '../characters/radioCast.js';
import { WEATHER } from '../flight/windField.js';
import { timeOf } from '../render/timeOfDay.js';
import { repairCost, PARTS, PART_NAMES } from '../systems/damageModel.js';
import { isUnlocked, totalStars, pilotRating, FUEL_PRICE } from '../hangar/careerSave.js';
import { fmtTime } from '../missions/missionRunner.js';
import { KEY_HELP } from '../input/pilotControls.js';

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

export function showTitle(onStart) {
  const el = mount(`
    <div class="logo">TIDEWING<small>CINDER REACH AIR SERVICE</small></div>
    <p>Fly the Tern Mk II floatplane for the islands of the Cinder Reach: mail drops, medevacs,
    fire bombing, a night lighthouse run, a squall-line crossing and a dead-stick glide off a volcano.</p>
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
    const best = rec && rec.bestTime ? `best ${fmtTime(rec.bestTime)} · landing ${rec.bestLanding}` : open ? `pays ${m.pay} sh · par ${fmtTime(m.parTime)}` : 'locked: fly the mission before';
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
  const log = career.logbook.slice(0, 7).map((e) => `<tr><td>#${e.n}</td><td>${esc(e.title)}</td>
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
  const el = mount(`
    <div class="topbar">
      <div class="logo">TIDEWING<small>TEODOR'S HANGAR · PORT HALYARD</small></div>
      <div class="cash">
        <div class="chip">Cash <b>${career.cash} sh</b></div>
        <div class="chip">Missions <b>${done} / ${MISSIONS.length}</b></div>
        <div class="chip">Stars <b>${totalStars(career)} / ${MISSIONS.length * 3}</b></div>
        <div class="chip">Rating <b>${esc(pilotRating(career))}</b></div>
      </div>
    </div>
    <div class="cols">
      <div class="card"><h2>MISSION BOARD <span>pick a job, read the brief, fly</span></h2>${missionRows}</div>
      <div class="card"><h2>THE TERN <span>TW-07 · repairs and upgrades</span></h2>${parts}
        <div class="row" style="justify-content:space-between;align-items:center"><span style="color:#b7c0c8;font-size:14px">Fuel ${FUEL_PRICE} sh/L, billed after each flight</span>
        <button data-repair="all" ${total <= 0 || career.cash < total ? 'disabled' : ''}>Repair all ${total} sh</button></div>
        <h2 style="margin-top:4px">UPGRADES</h2>${ups}</div>
      <div class="card"><h2>PILOT'S LOGBOOK <span>${career.flights} flights · ${career.hours.toFixed(1)} h</span></h2>
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

export function showDebrief(def, result, fuelBill, h) {
  const lands = result.landings.map((l) => `<tr><td>${esc(l.where)}</td><td>${l.fpm} ft/min</td><td>${l.across === null ? '-' : `${l.across} m`}</td><td>${l.bounces}</td><td class="${l.letter === 'A' ? 'g' : l.letter === 'F' ? 'r' : 'a'}">${l.letter}</td></tr>`).join('');
  const el = mount(`<div class="brief">
    <div style="color:var(--amber);font-weight:800">DEBRIEF · MISSION ${def.order}</div>
    <h1>${result.done ? esc(def.title) + ': complete' : esc(def.title) + ': failed'}</h1>
    <div class="big-stars">${stars(result.stars)}</div>
    <ul>${result.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${lands ? `<table><tr><th>Landing</th><th>Sink</th><th>Off centre</th><th>Bounces</th><th>Grade</th></tr>${lands}</table>` : ''}
    <div class="meta"><span class="chip">Time <b>${fmtTime(result.time)}</b></span><span class="chip">Pay <b>${result.pay} sh</b></span>
      <span class="chip">Fuel bill <b>${fuelBill} sh</b></span><span class="chip">Damage taken <b>${result.damageTaken}</b></span></div>
    <div class="row"><button class="ghost" id="retry">Fly it again</button><button id="hangar">Back to the hangar</button></div></div>`);
  el.querySelector('#retry').onclick = h.onRetry;
  el.querySelector('#hangar').onclick = h.onHangar;
}

export function showPause(h) {
  const el = mount(`<div class="brief" style="width:min(620px,92%)"><h1>Paused</h1>
    <div class="help">${KEY_HELP.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
    <div class="row"><button class="ghost" id="abort">Abort to hangar</button><button class="ghost" id="restart">Restart</button><button id="resume">Resume</button></div></div>`);
  el.querySelector('#resume').onclick = h.onResume;
  el.querySelector('#restart').onclick = h.onRestart;
  el.querySelector('#abort').onclick = h.onAbort;
}
