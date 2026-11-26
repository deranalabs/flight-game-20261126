// Tidewing: Cinder Reach Air Service. Boots the game: the career and hangar screens,
// the briefing, a sortie with the flight model at a fixed 60 Hz under the pilot's hands,
// the 3D world, the instrument panel and HUD, sound, and the debrief. ?shot=<name>
// freezes a real moment of play for the screenshots.

import { MISSIONS, missionById } from './missions/index.js';
import { STEP } from './flight/flightModel.js';
import { animateSeaplane } from './aircraft/seaplaneModel.js';
import { drawInstrumentPanel } from './instruments/instrumentPanel.js';
import { drawFlightHud, objectiveBearing } from './hud/flightHud.js';
import { startMission, stepMission, missionResult, currentObjective } from './missions/missionRunner.js';
import { loadCareer, saveCareer, recordFlight, repairAll, repairPart, buyUpgrade } from './hangar/careerSave.js';
import { buildWorld, makeRenderer } from './render/worldScene.js';
import { tryRestart } from './systems/engine.js';
import { makeCameraRig } from './camera/cameraRig.js';
import { makePilotControls } from './input/pilotControls.js';
import { makeSoundEngine } from './audio/soundEngine.js';
import { showTitle, showHangar, showBriefing, showDebrief, showPause, clearScreens } from './ui/screens.js';
import { SHOTS, readShotRequest } from './shots/shotMode.js';
import { flyHeading, makeAutopilot } from './flight/autopilot.js';
import { stallSpeed } from './aircraft/ternSpec.js';
import { LANDMARKS, RUNWAYS } from './terrain/islandLayout.js';
import * as THREE from 'three';

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
  endAt: null,
  shot: null,
  selected: null,
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
  });
  statusLine.textContent = `Hangar: ${game.career.cash} shillings`;
}

function toBriefing(id) {
  const def = missionById(id);
  game.selected = id;
  game.mode = 'brief';
  const preview = startMission(def, game.career, 1);
  showBriefing(def, preview.objectives.map((o) => o.label(preview)), game.career, () => startFlight(def), toHangar);
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
  game.endAt = null;
  game.banner = { text: def.title.toUpperCase(), color: '#ffbf3c', sub: currentObjective(game.ms).label(game.ms), until: game.t + 4 };
  statusLine.textContent = `Flying ${def.title}`;
}

function endFlight() {
  const ms = game.ms;
  const result = missionResult(ms);
  const { fuelBill } = recordFlight(game.career, result, ms.ac, ms.def.client);
  for (const [id, c] of Object.entries(ms.radio.cast)) game.castStates[id] = c.state;
  saveCareer(game.career);
  game.mode = 'debrief';
  sound.event(result.done ? 'success' : 'fail');
  showDebrief(ms.def, result, fuelBill, { onRetry: () => startFlight(ms.def), onHangar: toHangar });
  statusLine.textContent = `${ms.def.title}: ${result.done ? `${result.stars} stars` : 'failed'}`;
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
  const actions = input.update(dt);
  if (actions.pause) { pause(); return; }
  if (actions.camera) game.view = game.view === 'chase' ? 'cockpit' : 'chase';
  if (actions.light) game.landingLight = !game.landingLight;
  if (actions.restart && tryRestart(ac.engine, ac.fuel.litres, ac.damage)) ms.radio.line('teodor', 'Cranking... come on, girl.', ms.t);
  if (actions.autopilot) {
    game.autopilot = game.autopilot ? null : { ap: makeAutopilot(), hdg: ac.hdg, alt: ac.pos.y, speed: Math.max(36, ac.ias) };
  }
  if (game.autopilot && !ac.onSurface) {
    // stick input takes back control
    if (Math.abs(input.elevator) > 0.3 || Math.abs(input.aileron) > 0.3) game.autopilot = null;
  } else {
    if (game.autopilot) game.autopilot = null;
    input.apply(ac);
  }
  game.acc += Math.min(dt, 0.1);
  let first = true;
  const before = ms.index;
  while (game.acc >= STEP) {
    game.acc -= STEP;
    if (game.autopilot) flyHeading(ac, game.autopilot.ap, game.autopilot.hdg, game.autopilot.alt, game.autopilot.speed, STEP);
    stepMission(ms, first ? { drop: actions.drop } : {});
    first = false;
    for (const e of ac.events) {
      if (e.type === 'touchdown') sound.event(e.kind === 'water' ? 'splash' : 'touchdown');
      else if (e.type === 'bounce' || e.type === 'crash') sound.event(e.type);
      else if (e.type === 'landed' && e.landing) {
        const L = e.landing;
        game.banner = { text: `TOUCHDOWN ${Math.round(L.fpm)} FT/MIN`, color: L.fpm < 300 ? '#7ee08f' : '#ffbf3c', sub: L.place ? `${Math.abs(L.place.across).toFixed(1)} m off centre · ${L.bounces} bounce${L.bounces === 1 ? '' : 's'}` : 'on the water', until: game.t + 3 };
      }
    }
    if (ms.status !== 'flying') break;
  }
  if (actions.drop) sound.event('drop');
  if (ms.index > before) {
    const done = ms.objectives[ms.index - 1];
    sound.event(done.kind === 'ring' ? 'ring' : 'success');
    const next = currentObjective(ms);
    game.banner = { text: done.kind === 'ring' ? 'RING CLEARED' : 'OBJECTIVE DONE', color: '#7ee08f', sub: next ? next.label(ms) : 'Mission complete', until: game.t + 3 };
  }
  if (ms.radio.current && ms.radio.current !== game.lastRadio) { game.lastRadio = ms.radio.current; sound.event('radio'); }
  if (ms.extra.flashAt && ms.extra.flashAt !== game.lastFlash) { game.lastFlash = ms.extra.flashAt; sound.event('thunder'); }
  if (ms.status !== 'flying') {
    if (!game.endAt) {
      game.endAt = game.t + (ms.status === 'done' ? 3 : 3.5);
      game.banner = ms.status === 'done'
        ? { text: 'MISSION COMPLETE', color: '#7ee08f', sub: ms.def.title, until: game.endAt }
        : { text: ms.ac.crashed ? 'CRASHED' : 'MISSION FAILED', color: '#ff6b5a', sub: ms.failReason, until: game.endAt };
    } else if (game.t > game.endAt) endFlight();
  }
  sound.update(ac, false);
}

// ---------------------------------------------------------------- drawing

function lighthouseOn(ms) {
  if (!ms) return true;
  if (ms.def.id === 'lighthouseNight') return !!ms.extra.lightOn;
  return true;
}

function renderFlight(ms, dt, opts = {}) {
  const w = game.world;
  const ac = ms.ac;
  const model = w.plane;
  model.visible = true;
  model.position.set(ac.pos.x, ac.pos.y, ac.pos.z);
  model.quaternion.set(ac.q.x, ac.q.y, ac.q.z, ac.q.w);
  animateSeaplane(model, ac, opts.t ?? game.t, { dt, lightsOn: true, landingLight: opts.landingLight ?? game.landingLight, cockpit: game.view === 'cockpit', night: w.time.windows > 0.6 });
  const wind = ms.env.wind.at(ac.pos, ac.t);
  const wl = Math.hypot(wind.x, wind.z) || 1;
  w.markers.update(ms, game.t, { x: wind.x / wl * 0.4, z: wind.z / wl * 0.4 });
  w.props.userData.lighthouse.userData.tick(game.t, lighthouseOn(ms));
  w.props.userData.smoke.userData.tick(game.t, wind.x / wl, wind.z / wl);
  w.water.userData.tick(game.t);
  rig.mode = game.view;
  rig.look = input.look;
  rig.update(ac, dt, opts.camera ?? {});
  w.effects.update(dt, game.t, camera, ac, ms.extra.flashAt);
  renderer.render(w.scene, camera);
  const W = window.innerWidth;
  const H = window.innerHeight;
  hud.clearRect(0, 0, W, H);
  const panel = drawInstrumentPanel(hud, W, H, ac, game.view, { autopilot: !!game.autopilot, bug: objectiveBearing(ms) });
  const banner = game.banner && game.t < game.banner.until ? game.banner : null;
  drawFlightHud(hud, W, H, ms, {
    missionNo: ms.def.order, missionCount: MISSIONS.length, view: game.view,
    panelTop: panel.top, banner, radio: ms.radio.current,
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
    if (game.ms && game.mode === 'debrief') renderFlight(game.ms, dt);
    else renderHangarScene(dt);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- shots

function renderShot(dt) {
  const s = game.shot;
  if (s.view === 'hangar') { renderHangarScene(0); return; }
  game.view = s.view;
  renderFlight(s.ms, 0, { t: s.t, landingLight: s.landingLight, camera: { ...(s.camera ?? {}), snap: true } });
  s.frames = (s.frames ?? 0) + 1;
  if (s.frames === 3) { document.title = `${document.title} [shot ready]`; window.__shotReady = true; }
}

function startShot(req) {
  const s = SHOTS[req.name]();
  game.shot = s;
  game.mode = 'shot';
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
  showTitle(() => { sound.start(); toHangar(); });
}
requestAnimationFrame(frame);
