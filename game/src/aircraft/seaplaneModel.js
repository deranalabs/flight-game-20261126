// The Tern Mk II built from parts: tapered fuselage with cabin glass, radial cowling and
// spinner, a turning three-blade prop, high wing on struts, twin floats on spreader bars,
// tail with moving rudder and elevator, ailerons and flaps that follow the controls,
// navigation lights, a strobe, a landing light and the TW-07 registration.

import * as THREE from 'three';
import { glowSprite } from '../render/glowSprite.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const CREAM = 0xf1e7cf;
const RED = 0xb8322a;
const DARK = 0x2b2f36;
const GLASS = 0x2a4f6e;
const FLOAT = 0xc9ccd0;

/** A box whose front and back faces differ in size: the basis of fuselage and floats. */
function taperBox(w0, h0, w1, h1, len, dy1 = 0) {
  const z0 = -len / 2;
  const z1 = len / 2;
  const v = [
    [-w0 / 2, -h0 / 2, z0], [w0 / 2, -h0 / 2, z0], [w0 / 2, h0 / 2, z0], [-w0 / 2, h0 / 2, z0],
    [-w1 / 2, -h1 / 2 + dy1, z1], [w1 / 2, -h1 / 2 + dy1, z1], [w1 / 2, h1 / 2 + dy1, z1], [-w1 / 2, h1 / 2 + dy1, z1],
  ];
  const faces = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
  const pos = [];
  // wound so every face points outward (front faces are the ones the camera sees)
  for (const [a, b, c, d] of faces) pos.push(...v[a], ...v[c], ...v[b], ...v[a], ...v[d], ...v[c]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function registrationTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = '#1d2a3a';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TW-07', 128, 34);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildFloat(side) {
  const g = new THREE.Group();
  const front = new THREE.Mesh(taperBox(0.75, 0.7, 0.18, 0.25, 2.2, 0.18), mat(FLOAT));
  front.position.z = -3.9;
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 4.0), mat(FLOAT));
  mid.position.z = -0.8;
  const rear = new THREE.Mesh(taperBox(0.75, 0.7, 0.2, 0.22, 2.6, 0.14), mat(FLOAT));
  rear.position.z = 2.5;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.77, 0.12, 6.2), mat(RED));
  stripe.position.set(0, 0.2, -0.6);
  g.add(front, mid, rear, stripe);
  g.position.set(side * 1.45, -1.35, 0.1);
  return g;
}

function strut(from, to, r = 0.05, color = DARK) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** Control surface on a hinge: the mesh hangs behind its pivot so it swings like a flap. */
function hinged(w, d, t, color) {
  const pivot = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, t, d);
  geo.translate(0, 0, d / 2);
  pivot.add(new THREE.Mesh(geo, mat(color)));
  return pivot;
}

export function buildSeaplane() {
  const root = new THREE.Group();
  root.name = 'tern';
  const body = new THREE.Group();
  root.add(body);

  // fuselage: cabin box, then a long taper to the tail
  const cabin = new THREE.Mesh(taperBox(1.25, 1.45, 1.3, 1.5, 3.0), mat(CREAM));
  cabin.position.set(0, 0, -0.6);
  const tailcone = new THREE.Mesh(taperBox(1.3, 1.5, 0.28, 0.42, 5.2, 0.45), mat(CREAM));
  tailcone.position.set(0, 0, 3.5);
  const belly = new THREE.Mesh(taperBox(1.27, 0.32, 0.3, 0.12, 8.0, 0.5), mat(RED));
  belly.position.set(0, -0.55, 1.6);
  const cheat = new THREE.Mesh(new THREE.BoxGeometry(1.33, 0.14, 7.6), mat(RED));
  cheat.position.set(0, 0.1, 1.5);
  body.add(cabin, tailcone, belly, cheat);

  // cowling and spinner
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, 1.2, 14), mat(RED));
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 0.02, -2.65);
  const cowlRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.07, 6, 16), mat(DARK));
  cowlRing.position.set(0, 0.02, -3.25);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 10), mat(0xe8e8e8));
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0.02, -3.55);
  body.add(cowl, cowlRing, spinner);

  const prop = new THREE.Group();
  prop.position.set(0, 0.02, -3.4);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.05), mat(0x222222));
    blade.position.y = 0.62;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.14, 0.055), mat(0xf2c200));
    tip.position.y = 1.16;
    const arm = new THREE.Group();
    arm.add(blade, tip);
    arm.rotation.z = (i * Math.PI * 2) / 3;
    prop.add(arm);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  disc.position.set(0, 0.02, -3.42);
  body.add(prop, disc);

  // cabin glass: windshield and side windows
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.06), mat(GLASS, { emissive: 0x0a1a2a }));
  wind.position.set(0, 0.48, -2.02);
  wind.rotation.x = -0.55;
  body.add(wind);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.8), mat(GLASS, { emissive: 0x0a1a2a }));
      w.position.set(s * 0.64, 0.38, -1.4 + i * 0.95);
      body.add(w);
    }
  }
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0x8a5a3a));
  pilot.position.set(-0.25, 0.42, -1.25);
  body.add(pilot);

  // registration on both sides
  const regTex = registrationTexture();
  for (const s of [-1, 1]) {
    const reg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: regTex, transparent: true }));
    reg.position.set(s * 0.6, -0.05, 2.1);
    reg.rotation.y = s * Math.PI / 2;
    body.add(reg);
  }

  // high wing with tips, ailerons and flaps
  const wing = new THREE.Group();
  wing.position.set(0, 0.88, -1.0);
  const span = 14.6;
  const chord = 1.75;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(span, 0.2, chord * 0.72), mat(CREAM));
  panel.position.z = -chord * 0.14;
  wing.add(panel);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.21, chord * 0.98), mat(RED));
    tip.position.set(s * (span / 2 - 0.45), 0, 0);
    wing.add(tip);
  }
  const ailerons = [];
  const flaps = [];
  for (const s of [-1, 1]) {
    const ail = hinged(3.6, chord * 0.26, 0.12, CREAM);
    ail.position.set(s * 4.9, 0, chord * 0.22);
    ail.userData.side = s;
    wing.add(ail);
    ailerons.push(ail);
    const flap = hinged(3.6, chord * 0.26, 0.12, 0xe2d8bf);
    flap.position.set(s * 1.75, -0.02, chord * 0.22);
    wing.add(flap);
    flaps.push(flap);
  }
  // wing walk stripe and roof fairing
  const roofFair = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.6), mat(CREAM));
  roofFair.position.set(0, 0.72, -1.05);
  body.add(wing, roofFair);

  // struts from the lower fuselage to the wing, and float struts
  for (const s of [-1, 1]) {
    body.add(strut([s * 0.62, -0.45, -1.2], [s * 3.2, 0.82, -1.05], 0.055));
    body.add(strut([s * 0.62, -0.45, -0.6], [s * 3.2, 0.82, -0.85], 0.045));
    body.add(strut([s * 0.5, -0.7, -1.9], [s * 1.45, -1.05, -2.0], 0.06, 0x555a60));
    body.add(strut([s * 0.5, -0.7, 0.6], [s * 1.45, -1.05, 0.8], 0.06, 0x555a60));
    root.add(buildFloat(s));
  }
  root.add(strut([-1.45, -1.05, -2.0], [1.45, -1.05, -2.0], 0.05, 0x555a60));
  root.add(strut([-1.45, -1.05, 0.8], [1.45, -1.05, 0.8], 0.05, 0x555a60));

  // tail: stabiliser + elevator, fin + rudder
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 0.9), mat(CREAM));
  stab.position.set(0, 0.5, 5.6);
  const elevator = hinged(4.4, 0.55, 0.08, RED);
  elevator.position.set(0, 0.5, 6.05);
  const fin = new THREE.Mesh(taperBox(0.1, 1.6, 0.1, 1.2, 1.2, 0.2), mat(CREAM));
  fin.position.set(0, 1.25, 5.55);
  const rudder = new THREE.Group();
  const rgeo = new THREE.BoxGeometry(0.09, 1.7, 0.6);
  rgeo.translate(0, 0, 0.3);
  rudder.add(new THREE.Mesh(rgeo, mat(RED)));
  rudder.position.set(0, 1.3, 6.1);
  // water rudders on the float heels
  body.add(stab, elevator, fin, rudder);

  // lights: red port tip, green starboard tip, white tail, red strobe on the fin
  const lights = {
    port: glowSprite(0xff2a2a, 1.3), starboard: glowSprite(0x22ff55, 1.3),
    tail: glowSprite(0xffffff, 0.7), strobe: glowSprite(0xffffff, 3),
  };
  lights.port.position.set(-span / 2, 0.9, -1.0);
  lights.starboard.position.set(span / 2, 0.9, -1.0);
  lights.tail.position.set(0, 0.55, 6.45);
  lights.strobe.position.set(0, 2.1, 5.9);
  for (const l of Object.values(lights)) body.add(l);
  const landing = new THREE.SpotLight(0xfff4d8, 0, 900, 0.32, 0.5, 1.2);
  landing.position.set(-2.0, 0.85, -1.5);
  landing.target.position.set(-2.0, -18, -60);
  body.add(landing, landing.target);
  const landingGlow = glowSprite(0xfff4d8, 3);
  landingGlow.position.set(-2.0, 0.8, -1.95);
  body.add(landingGlow);

  // from the pilot's seat the cabin shell and glass would fill the view: hide them there
  // from the left seat the wing root sits edge-on at eye height: hide it with the cabin
  const cabinParts = [wing, cabin, tailcone, belly, cheat, wind, roofFair, pilot, cowl, cowlRing, spinner, ...body.children.filter((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 0.3 && Math.abs(c.position.x) > 0.6)];
  root.userData = { prop, disc, ailerons, flaps, elevator, rudder, lights, landing, landingGlow, cabinParts };
  return root;
}

/**
 * Pose the model from the aircraft state: control surfaces, prop speed, lights.
 * ac is the flight-model state; t is wall time for the strobe.
 */
export function animateSeaplane(model, ac, t, opts = {}) {
  const u = model.userData;
  const c = ac.controls;
  // right roll: right aileron trailing edge up, left one down
  for (const a of u.ailerons) a.rotation.x = -c.aileron * 0.35 * a.userData.side;
  for (const f of u.flaps) f.rotation.x = c.flaps * 0.6;
  u.elevator.rotation.x = -c.elevator * 0.4;
  u.rudder.rotation.y = c.rudder * 0.45;
  const spin = (ac.engine.rpm / 60) * Math.PI * 2;
  u.prop.rotation.z += spin * (opts.dt ?? 1 / 60) * 0.12;
  u.disc.material.opacity = opts.cockpit ? 0 : Math.min(0.32, ac.engine.rpm / 6000);
  // a running prop is a blur: blades show only when turning slowly or stopped
  u.prop.visible = ac.engine.rpm < 500 || !!opts.still;
  if (opts.still) u.prop.rotation.z = 0.4;
  const on = opts.lightsOn ?? true;
  u.lights.port.visible = on;
  u.lights.starboard.visible = on;
  u.lights.tail.visible = on;
  // the fin strobe flashes after dark only, where it helps; by day it is lost in the sun
  u.lights.strobe.visible = on && !!opts.night && (t % 1.2) < 0.08;
  u.landing.intensity = opts.landingLight ? 600 : 0;
  u.landingGlow.visible = !!opts.landingLight;
  for (const p of u.cabinParts) p.visible = !opts.cockpit;
}
