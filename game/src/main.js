// Tidewing: Cinder Reach Air Service. Boots the game: the career and hangar screens,
// the briefing, a sortie with the flight model at a fixed 60 Hz under the pilot's hands,
// the 3D world, the instrument panel and HUD, sound, and the debrief. ?shot=<name>
// freezes a real moment of play for the screenshots.

import { applyPaletteToCss, TOKENS } from './identity/palette.js';
import { CHAPTERS, contractFor, MISSION_TYPES, CHOICE, objectiveHeadline } from './story/storyline.js';
import { islandById, findSpots, FIND_PAY } from './world/gazetteer.js';
import { personState } from './world/cast.js';
import { eventFor } from './world/events.js';
import { settleSortie, debtLeft, chapterFor, squeezeSortie, chargeDebt, payDebt } from './hangar/harbourDebt.js';
import { awardFeats } from './hangar/feats.js';
import { refitOffer, fitRefit } from './hangar/refits.js';
import { callsFor } from './feedback/liveCalls.js';
import { scopeLine } from './story/counts.js';
import { REPAIR, bingoLeft } from './missions/pilotCalls.js';
import { damageLines } from './systems/damageModel.js';
import { MISSIONS, missionById } from './missions/index.js';
import { STEP } from './flight/flightModel.js';
import { animateSeaplane } from './aircraft/seaplaneModel.js';
import { drawInstrumentPanel } from './instruments/instrumentPanel.js';
import { drawFlightHud, objectiveBearing, ringClearedText } from './hud/flightHud.js';
import { startMission, stepMission, missionResult, currentObjective } from './missions/missionRunner.js';
import { loadCareer, saveCareer, recordFlight, repairAll, repairPart, buyUpgrade } from './hangar/careerSave.js';
import { buildWorld, makeRenderer } from './render/worldScene.js';
import { tryRestart } from './systems/engine.js';
import { makeCameraRig, VIEWS } from './camera/cameraRig.js';
import { makePilotControls } from './input/pilotControls.js';
import { makeSoundEngine } from './audio/soundEngine.js';
import { showTitle, showHangar, showBriefing, showDebrief, showPause, showReach, clearScreens } from './ui/screens.js';
import { SHOTS, readShotRequest } from './shots/shotMode.js';
import { flyHeading, makeAutopilot } from './flight/autopilot.js';
import { stallSpeed } from './aircraft/ternSpec.js';
import { LANDMARKS, RUNWAYS, ISLANDS } from './terrain/islandLayout.js';
import { scoreSortie, recordScore, nextMultiplier } from './hangar/sortieScore.js';
import { currentApproach } from './flight/glidepath.js';
import * as THREE from 'three';

applyPaletteToCss();
const SCOPE = scopeLine(MISSIONS);
/** Seconds the chapter plate holds at the start of a sortie (any key skips it). */
const PLATE_SECONDS = 2.4;
/** Seconds of key hints at the start of a sortie, below Expert. */
const HINT_SECONDS = 60;
const HINTS = [['W / S', 'nose down / up'], ['A / D', 'roll'], ['SHIFT / CTRL', 'throttle'], ['F / V', 'flaps'], ['C', 'camera']];
const FINDS = findSpots(ISLANDS);
/** A find counts when the Tern passes within this many metres, below FIND_AGL metres. */
const FIND_RANGE = 140;
const FIND_AGL = 160;
/** Easy assist: rudder follows the slip, and the stick eases off near the stall. */
const EASY_COORD = 3;
const EASY_STALL_EASE = 0.4;

const worldCanvas = document.getElementById('world');
const hudCanvas = document.getElementById('hud');
const hud = hudCanvas.getContext('2d');
const statusLine = document.getElementById('status');
const renderer = makeRenderer(worldCanvas);
const camera = new THREE.PerspectiveCamera(62, 16 / 10, 0.5, 40000);
const rig = makeCameraRig(camera);
const input = makePilotControls(window);
const sound = makeSoundEngine();

const game = {
  mode: 'title',
  career: loadCareer(),
  castStates: {},
  world: null,
  worldKey: '',
  ms: null,
  def: null,
  view: 'chase',
  autopilot: null,
  landingLight: false,
  acc: 0,
  last: performance.now(),
  t: 0,
  banner: null,
  toast: null,
  endIn: null,
  shot: null,
  selected: null,
  assist: 'standard',
  plate: null,
};

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  hudCanvas.width = Math.round(w * dpr);
  hudCanvas.height = Math.round(h * dpr);
  hud.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function ensureWorld(timeId, weatherId) {
  const key = `${timeId}/${weatherId}`;
  if (game.worldKey === key) return game.world;
  game.world = buildWorld(timeId, weatherId);
  game.worldKey = key;
  return game.world;
}

// ---------------------------------------------------------------- screens

function toHangar() {
  game.mode = 'hangar';
  game.ms = null;
  ensureWorld('morning', 'breezy');
  showHangar(game.career, game.castStates, {
    selected: game.selected,
    onBrief: (id) => toBriefing(id),
    onRepair: (part) => { if (part === 'all' ? repairAll(game.career) : repairPart(game.career, part)) { saveCareer(game.career); toHangar(); } },
    onBuy: (id) => { if (buyUpgrade(game.career, id)) { saveCareer(game.career); toHangar(); } },
    onReach: () => showReach(game.career, toHangar),
  });
  statusLine.textContent = `Hangar: ${game.career.cash} shillings`;
}

function toBriefing(id) {
  const def = missionById(id);
  game.selected = id;
  game.mode = 'brief';
  const preview = startMission(def, game.career, 1);
  const contract = contractFor(def.id);
  const chapter = chapterFor(def.order, MISSIONS.length);
  const story = {
    chapter, contract, island: islandById(contract.island), person: personState(contract.who, chapter.no, game.career.trust[contract.who] ?? 0),
    event: eventFor(def.id), left: debtLeft(game.career),
    choice: def.order === squeezeSortie(MISSIONS.length) && !game.career.choiceDone ? CHOICE : null,
    onChoose: (id) => { game.career.choice = id; saveCareer(game.career); },
  };
  showBriefing(def, preview.objectives.map((o) => o.label(preview)), game.career, () => startFlight(def), toHangar, story);
}

function startFlight(def) {
  sound.start();
  clearScreens();
  game.def = def;
  game.ms = startMission(def, game.career, 1);
  ensureWorld(def.timeOfDay, def.weather);
  input.syncFrom(game.ms.ac);
  rig.init = false;
  game.autopilot = null;
  game.landingLight = def.timeOfDay === 'night';
  game.mode = 'flying';
  game.endIn = null;
  game.toast = null;
  const chapter = chapterFor(def.order, MISSIONS.length);
  const contract = contractFor(def.id);
  game.plate = { chapter, title: def.title.toUpperCase(), line: contract.before, clerk: chapter.clerk, left: debtLeft(game.career), until: PLATE_SECONDS };
  game.ms.radio.line('ansel', chapter.clerk, 0);
  const ev = eventFor(def.id);
  game.banner = ev
    ? { text: ev.title, color: TOKENS.sulphur, sub: ev.cue, until: PLATE_SECONDS + 4 }
    : { text: def.title.toUpperCase(), color: TOKENS.sulphur, sub: currentObjective(game.ms).label(game.ms), until: PLATE_SECONDS + 3 };
  statusLine.textContent = `Flying ${def.title}`;
}

function endFlight() {
  const ms = game.ms;
  const result = missionResult(ms);
  const scored = scoreSortie(ms, game.career.score.combo);
  const { fuelBill } = recordFlight(game.career, result, ms.ac, ms.def.client);
  recordScore(game.career, ms.def.id, scored);
  (game.career.tracks ??= {})[ms.def.id] = ms.track;
  const settled = settleSortie(game.career, ms.def, scored, MISSIONS.length, ms.extra);
  const feats = awardFeats(game.career, { ms, scored, result, debtLeft: debtLeft(game.career) });
  for (const [id, c] of Object.entries(ms.radio.cast)) game.castStates[id] = c.state;
  saveCareer(game.career);
  game.mode = 'debrief';
  sound.event(result.done ? 'success' : 'fail');
  showDebrief(ms.def, result, fuelBill, {
    onRetry: () => startFlight(ms.def),
    onHangar: toHangar,
    onRefit: (id) => { if (fitRefit(game.career, id)) saveCareer(game.career); },
  }, { scored, debtPaid: settled.total, settled, trace: ms.trace, career: game.career, feats, refits: result.done ? refitOffer(game.career) : [], contract: contractFor(ms.def.id), last: ms.def.order === MISSIONS.length });
  statusLine.textContent = `${ms.def.title}: ${result.done ? `${result.stars} stars` : 'failed'}`;
}

/** Hidden finds: a low pass over one books it, pays a little of the note and logs it. */
function spotFinds(ms) {
  const ac = ms.ac;
  if (ac.agl > FIND_AGL || ms.steps % 15) return;
  const c = game.career;
  c.finds ??= {};
  for (const f of FINDS) {
    if (c.finds[f.id] || Math.hypot(ac.pos.x - f.x, ac.pos.z - f.z) > FIND_RANGE) continue;
    c.finds[f.id] = true;
    payDebt(c, { done: true, total: FIND_PAY }, `Found ${f.name}`);
    c.logbook.unshift({ n: c.flights, id: 'find', title: `Found ${f.name}`, done: true, stars: 0, time: 0, landing: '-', pay: FIND_PAY, fuelBill: 0, damage: 0, note: islandById(f.island).name });
    saveCareer(c);
    game.toast = { text: `FOUND ${f.name.toUpperCase()} · +${FIND_PAY} SH · ${Object.keys(c.finds).length}/${FINDS.length}`, until: ms.t + 3 };
  }
}

function pause() {
  game.mode = 'paused';
  showPause({
    onResume: () => { clearScreens(); game.mode = 'flying'; game.last = performance.now(); },
    onRestart: () => startFlight(game.def),
    onAbort: () => { game.ms.fail('Abandoned the sortie'); endFlight(); },
  });
}

// ---------------------------------------------------------------- flying

function flyFrame(dt) {
  const ms = game.ms;
  const ac = ms.ac;
  input.callOpen = !!(ms.extra.bingo?.open || ms.extra.repair?.open);
  const actions = input.update(dt);
  if (actions.pause) { pause(); return; }
  if (actions.camera) game.view = VIEWS[(VIEWS.indexOf(game.view) + 1) % VIEWS.length];
  if (actions.any && game.plate) game.plate.until = 0;
  if (actions.light) game.landingLight = !game.landingLight;
  if (actions.restart && tryRestart(ac.engine, ac.fuel.litres, ac.damage)) ms.radio.line('teodor', 'Cranking... come on, girl.', ms.t);
  if (actions.autopilot && game.assist !== 'expert') {
    game.autopilot = game.autopilot ? null : { ap: makeAutopilot(), hdg: ac.hdg, alt: ac.pos.y, speed: Math.max(36, ac.ias) };
  }
  if (game.autopilot && !ac.onSurface) {
    // stick input takes back control
    if (Math.abs(input.elevator) > 0.3 || Math.abs(input.aileron) > 0.3) game.autopilot = null;
  } else {
    if (game.autopilot) game.autopilot = null;
    input.apply(ac);
    if (game.assist === 'easy' && !ac.onSurface) {
      if (Math.abs(input.rudder) < 0.05) ac.controls.rudder = Math.max(-1, Math.min(1, ac.beta * EASY_COORD));
      if (ac.stallWarn && ac.controls.elevator > 0) ac.controls.elevator *= EASY_STALL_EASE;
    }
  }
  game.acc += Math.min(dt, 0.1);
  let first = true;
  const before = ms.index;
  while (game.acc >= STEP) {
    game.acc -= STEP;
    if (game.autopilot) flyHeading(ac, game.autopilot.ap, game.autopilot.hdg, game.autopilot.alt, game.autopilot.speed, STEP);
    stepMission(ms, first ? { drop: actions.drop, call: actions.call } : {});
    first = false;
    for (const e of ac.events) {
      if (e.type === 'touchdown') sound.event(e.kind === 'water' ? 'splash' : 'touchdown');
      else if (e.type === 'bounce' || e.type === 'crash') sound.event(e.type);
      else if (e.type === 'landed' && e.landing) {
        const L = e.landing;
        game.banner = { text: `TOUCHDOWN ${Math.round(L.fpm)} FT/MIN`, color: L.fpm < 300 ? TOKENS.lagoon : TOKENS.sulphur, sub: L.place ? `${Math.abs(L.place.across).toFixed(1)} m off centre · ${L.bounces} bounce${L.bounces === 1 ? '' : 's'}` : 'on the water', until: ms.t + 3 };
      }
    }
    if (ms.status !== 'flying') break;
  }
  if (actions.drop) sound.event('drop');
  spotFinds(ms);
  if (ms.index > before) {
    const done = ms.objectives[ms.index - 1];
    sound.event(done.kind === 'ring' ? 'ring' : 'success');
    const next = currentObjective(ms);
    // a ring gets a small toast up top, so the big banner never hides the next ring
    if (done.kind === 'ring') game.toast = { text: ringClearedText(ms, done), until: ms.t + 2 };
    else game.banner = { text: objectiveHeadline(done.kind, contractFor(ms.def.id), !next), color: TOKENS.lagoon, sub: next ? next.label(ms) : contractFor(ms.def.id).after, until: ms.t + 3, big: true };
  }
  if (ms.radio.current && ms.radio.current !== game.lastRadio) { game.lastRadio = ms.radio.current; sound.event('radio'); }
  if (ms.extra.flashAt && ms.extra.flashAt !== game.lastFlash) { game.lastFlash = ms.extra.flashAt; sound.event('thunder'); }
  if (ms.status !== 'flying') {
    // the mission clock stops with the sortie: the end banner holds for a countdown instead
    if (game.endIn === null) {
      game.endIn = ms.status === 'done' ? 3 : 3.5;
      game.banner = ms.status === 'done'
        ? { text: contractFor(ms.def.id).headline, color: TOKENS.lagoon, sub: contractFor(ms.def.id).after, until: Infinity, big: true }
        : { text: ms.ac.crashed ? 'CRASHED' : 'MISSION FAILED', color: TOKENS.sulphur, sub: ms.failReason, until: Infinity, big: true };
    } else if ((game.endIn -= dt) <= 0) endFlight();
  }
  sound.update(ac, false);
}

// ---------------------------------------------------------------- drawing

function lighthouseOn(ms) {
  if (!ms) return true;
  if (ms.def.id === 'lighthouseNight') return !!ms.extra.lightOn;
  return true;
}

function renderFlight(ms, dt, opts = {}) { // opts is reassigned below for the cinematic cut
  const w = game.world;
  const ac = ms.ac;
  const model = w.plane;
  model.visible = true;
  model.position.set(ac.pos.x, ac.pos.y, ac.pos.z);
  model.quaternion.set(ac.q.x, ac.q.y, ac.q.z, ac.q.w);
  // one clock for the frame: the mission's own, or the frozen shot time
  const clock = opts.t ?? ms.t;
  animateSeaplane(model, ac, clock, { dt, lightsOn: true, landingLight: opts.landingLight ?? game.landingLight, cockpit: game.view === 'cockpit', night: w.time.windows > 0.6 });
  const wind = ms.env.wind.at(ac.pos, ac.t);
  const wl = Math.hypot(wind.x, wind.z) || 1;
  w.markers.update(ms, clock, { x: wind.x / wl * 0.4, z: wind.z / wl * 0.4 });
  w.props.userData.lighthouse.userData.tick(clock, lighthouseOn(ms));
  w.props.userData.smoke.userData.tick(clock, wind.x / wl, wind.z / wl, chapterFor(ms.def.order, MISSIONS.length).volcano);
  w.life.userData.tick(clock, wind.x / 12, wind.z / 12);
  w.water.userData.tick(clock);
  // the cinematic cut: an orbit while the chapter plate is up, and again once the job is done
  const cinematic = !opts.camera && (clock < PLATE_SECONDS || ms.status === 'done');
  rig.mode = cinematic ? 'orbit' : game.view;
  if (cinematic) opts = { ...opts, camera: { t: clock * 3 + 4, radius: 24 } };
  rig.look = input.look;
  rig.update(ac, dt, opts.camera ?? {});
  w.effects.update(dt, clock, camera, ac, ms.extra.flashAt);
  renderer.render(w.scene, camera);
  const W = window.innerWidth;
  const H = window.innerHeight;
  hud.clearRect(0, 0, W, H);
  if (opts.noHud) return; // the debrief receipt stands alone over the frozen scene
  const panel = drawInstrumentPanel(hud, W, H, ac, game.view, { autopilot: !!game.autopilot, bug: objectiveBearing(ms) });
  const banner = opts.banner ?? (game.banner && clock < game.banner.until ? game.banner : null);
  drawFlightHud(hud, W, H, ms, {
    missionNo: ms.def.order, missionCount: MISSIONS.length, view: game.view,
    live: scoreSortie(ms, game.career.score.combo), nextMult: nextMultiplier(game.career.score.combo),
    note: { left: debtLeft(game.career), chapter: chapterFor(ms.def.order, MISSIONS.length) },
    type: contractFor(ms.def.id).type, typeName: MISSION_TYPES[contractFor(ms.def.id).type],
    calls: callsFor(ms, currentApproach(ms)), scope: SCOPE,
    plate: opts.plate ?? (game.plate && clock < game.plate.until ? game.plate : null),
    hints: !opts.t && game.assist !== 'expert' && clock < HINT_SECONDS && clock > PLATE_SECONDS ? HINTS : null,
    bingo: ms.extra.bingo?.open ? { ...ms.extra.bingo, left: bingoLeft(ms), fuelPct: Math.round((ac.fuel.litres / ac.fuel.capacity) * 100) } : null,
    damage: damageLines(ac.damage),
    repair: ms.extra.repair?.open ? { ...ms.extra.repair, left: Math.max(0, Math.ceil(ms.extra.repair.at + REPAIR.seconds - ms.t)) } : null,
    panelTop: panel.top, banner, radio: ms.radio.current,
    toast: game.toast && clock < game.toast.until ? game.toast.text : null,
    rotateSpeed: stallSpeed(ac.spec, ac.mass, ac.controls.flaps) * 1.1,
    project: (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return v.z < 1 ? { x: (v.x + 1) * W / 2, y: (1 - v.y) * H / 2 } : null;
    },
  });
}

/** The Tern parked on the apron in front of Teodor's hangar, camera circling slowly. */
function renderHangarScene(dt) {
  const w = game.world;
  const H = LANDMARKS.hangar;
  const rw = RUNWAYS.halyard;
  const parked = { pos: { x: H.x + 10, y: rw.elev + 1.7, z: H.z + 55 }, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 2.4), vel: { x: 0, y: 0, z: 0 } };
  w.plane.position.set(parked.pos.x, parked.pos.y, parked.pos.z);
  w.plane.quaternion.copy(parked.q);
  animateSeaplane(w.plane, { controls: { aileron: 0, elevator: 0, rudder: 0, flaps: 0.5 }, engine: { rpm: 0 } }, game.t, { still: true, lightsOn: false });
  w.props.userData.lighthouse.userData.tick(game.t, true);
  w.props.userData.smoke.userData.tick(game.t, 0.3, 0.2);
  w.life.userData.tick(game.t, 0.3, 0.2);
  w.water.userData.tick(game.t);
  rig.mode = 'orbit';
  rig.update(parked, dt, { t: game.t + 8, radius: 30 });
  renderer.render(w.scene, camera);
  hud.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function frame(now) {
  const dt = Math.min(0.1, (now - game.last) / 1000);
  game.last = now;
  game.t += dt;
  if (game.mode === 'flying') {
    flyFrame(dt);
    if (game.ms && game.mode !== 'debrief') renderFlight(game.ms, dt);
  } else if (game.mode === 'paused' && game.ms) {
    sound.update(game.ms.ac, true);
    renderFlight(game.ms, 0);
  } else if (game.mode === 'shot') {
    renderShot(dt);
  } else if (game.world) {
    if (game.ms && game.mode === 'debrief') renderFlight(game.ms, dt, { noHud: true });
    else renderHangarScene(dt);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- shots

function renderShot(dt) {
  const s = game.shot;
  if (s.view === 'hangar') { renderHangarScene(0); return; }
  if (s.view === 'debrief') {
    renderFlight(s.ms, 0, { t: 0.6, camera: { snap: true }, noHud: true });
    s.frames = (s.frames ?? 0) + 1;
    if (s.frames === 3) { document.title = `${document.title} [shot ready]`; window.__shotReady = true; }
    return;
  }
  game.view = s.view;
  renderFlight(s.ms, 0, { t: s.t, landingLight: s.landingLight, banner: s.banner, plate: s.plate, camera: { ...(s.camera ?? {}), snap: true } });
  s.frames = (s.frames ?? 0) + 1;
  if (s.frames === 3) { document.title = `${document.title} [shot ready]`; window.__shotReady = true; }
}

function startShot(req) {
  const s = SHOTS[req.name]();
  game.shot = s;
  game.mode = 'shot';
  if (s.view === 'debrief') {
    game.career = s.career;
    game.ms = s.ms;
    game.view = 'chase';
    ensureWorld(s.ms.def.timeOfDay, s.ms.def.weather);
    showDebrief(s.ms.def, s.result, s.fuelBill, { onRetry() {}, onHangar() {} }, s.extra);
    return;
  }
  if (s.ms && s.career) game.career = s.career;
  if (s.view === 'hangar') {
    game.career = s.career;
    ensureWorld('morning', 'breezy');
    showHangar(s.career, {}, { selected: s.selected, onBrief() {}, onRepair() {}, onBuy() {} });
  } else {
    ensureWorld(s.ms.def.timeOfDay, s.ms.def.weather);
    s.ms.radio.update(s.ms.t);
  }
}

window.tidewing = game; // handle for the browser console and play-tests
const shotReq = readShotRequest();
if (shotReq) startShot(shotReq);
else {
  ensureWorld('morning', 'breezy');
  showTitle((assist) => { game.assist = assist; sound.start(); toHangar(); }, game.career, { scope: SCOPE, chapters: CHAPTERS });
}
requestAnimationFrame(frame);
