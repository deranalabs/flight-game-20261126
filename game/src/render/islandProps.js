// Everything standing on the islands: forests, village houses with lit windows, the
// lighthouse and its beam, Teodor's hangar, the observatory, the dock and fuel barge,
// runways with painted markings, water-lane buoys, the windsock and the volcano's smoke.

import * as THREE from 'three';
import { groundHeight, slopeAt } from '../terrain/heightmap.js';
import { forestAt } from '../terrain/terrainMesh.js';
import { VILLAGES, LANDMARKS, RUNWAYS, PADS } from '../terrain/islandLayout.js';
import { seededRandom } from '../util/noise.js';
import { glowSprite } from './glowSprite.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function buildForest(rnd) {
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 5);
  trunkGeo.translate(0, 2, 0);
  const crownGeo = new THREE.ConeGeometry(4.2, 13, 6);
  crownGeo.translate(0, 10, 0);
  const spots = [];
  for (let i = 0; i < 26000 && spots.length < 5200; i++) {
    const x = (rnd() * 2 - 1) * 9000;
    const z = (rnd() * 2 - 1) * 9000;
    const h = groundHeight(x, z);
    if (h < 6) continue;
    const s = slopeAt(x, z, 20);
    if (!forestAt(x, z, h, s)) continue;
    if (Object.values(RUNWAYS).some((r) => Math.hypot(x - r.x, z - r.z) < r.length * 0.6 + 80)) continue;
    if (PADS.some((p) => Math.abs(x - p.x) < p.w / 2 + 40 && Math.abs(z - p.z) < p.d / 2 + 40)) continue;
    spots.push([x, h, z, 0.7 + rnd() * 0.9]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, lambert(0x5a4030), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, lambert(0xffffff), spots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach(([x, h, z, s], i) => {
    m.makeScale(s, s * (0.8 + (i % 5) * 0.08), s).setPosition(x, h - 0.5, z);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    col.setHSL(0.26 + (i % 7) * 0.012, 0.42, 0.2 + (i % 3) * 0.035);
    crowns.setColorAt(i, col);
  });
  const g = new THREE.Group();
  g.add(trunks, crowns);
  g.name = 'forest';
  return g;
}

function buildVillages(rnd, time) {
  const wallGeo = new THREE.BoxGeometry(9, 6, 11);
  wallGeo.translate(0, 3, 0);
  const roofGeo = new THREE.ConeGeometry(8.2, 4.5, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.scale(1, 1, 1.25);
  roofGeo.translate(0, 8.2, 0);
  const winGeo = new THREE.PlaneGeometry(2.2, 1.6);
  const total = VILLAGES.reduce((s, v) => s + v.houses, 0);
  const walls = new THREE.InstancedMesh(wallGeo, lambert(0xffffff), total);
  const roofs = new THREE.InstancedMesh(roofGeo, lambert(0xffffff), total);
  const wins = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffc86a, transparent: true, opacity: time.windows, fog: true }), total * 2);
  const roofColours = [0xb8432f, 0xc8693a, 0x3f6f8f, 0x7a4b8c, 0x4d8a6a, 0xa33a3a];
  const wallColours = [0xf2ead8, 0xe9dcc0, 0xf5f1e6, 0xd9cdb5];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  let w = 0;
  for (const v of VILLAGES) {
    for (let i = 0; i < v.houses; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * v.spread;
      const x = v.x + Math.cos(a) * r;
      const z = v.z + Math.sin(a) * r;
      const h = groundHeight(x, z);
      if (h < 1.5) continue;
      const yaw = Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.3;
      q.setFromAxisAngle(up, yaw);
      const s = 0.8 + rnd() * 0.6;
      m.compose(new THREE.Vector3(x, h - 0.3, z), q, new THREE.Vector3(s, s, s));
      walls.setMatrixAt(k, m);
      roofs.setMatrixAt(k, m);
      walls.setColorAt(k, new THREE.Color(wallColours[k % wallColours.length]));
      roofs.setColorAt(k, new THREE.Color(roofColours[(k * 7) % roofColours.length]));
      for (const side of [-1, 1]) {
        const off = new THREE.Vector3(side * 4.56 * s, 3 * s, 0).applyQuaternion(q);
        const wq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, side * Math.PI / 2));
        m.compose(new THREE.Vector3(x + off.x, h + off.y, z + off.z), wq, new THREE.Vector3(s, s, s));
        wins.setMatrixAt(w++, m);
      }
      k++;
    }
  }
  walls.count = k;
  roofs.count = k;
  wins.count = time.windows > 0 ? w : 0;
  const g = new THREE.Group();
  g.add(walls, roofs, wins);
  g.name = 'villages';
  return g;
}

function textTexture(lines, w, h, bg, fg, font) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((t, i) => ctx.fillText(t, w / 2, (h / (lines.length + 1)) * (i + 1)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function runwayTexture(rw) {
  const cv = document.createElement('canvas');
  const W = 128;
  const H = 2048;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const strip = rw.kind === 'strip';
  ctx.fillStyle = strip ? '#8a7350' : '#3b3d40';
  ctx.fillRect(0, 0, W, H);
  // weathering
  const rnd = seededRandom(rw.length);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = strip ? `rgba(60,45,25,${rnd() * 0.25})` : `rgba(90,92,95,${rnd() * 0.3})`;
    ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 6, 2 + rnd() * 14);
  }
  ctx.fillStyle = '#f4f1e8';
  if (strip) {
    // white rocks along both edges and a big end marker
    for (let y = 30; y < H - 30; y += 90) { ctx.fillRect(4, y, 10, 14); ctx.fillRect(W - 14, y, 10, 14); }
    ctx.fillRect(10, 20, W - 20, 12); ctx.fillRect(10, H - 32, W - 20, 12);
  } else {
    ctx.fillRect(4, 0, 4, H); ctx.fillRect(W - 8, 0, 4, H);
    for (let y = 230; y < H - 230; y += 80) ctx.fillRect(W / 2 - 2, y, 4, 44);
    for (const end of [0, 1]) {
      const y0 = end ? H - 110 : 20;
      for (let i = 0; i < 8; i++) ctx.fillRect(12 + i * 13.5, y0, 8, 90);
    }
  }
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  const [a, b] = rw.numbers;
  if (a) { ctx.save(); ctx.translate(W / 2, H - 170); ctx.fillText(a, 0, 0); ctx.restore(); }
  if (b) { ctx.save(); ctx.translate(W / 2, 170); ctx.rotate(Math.PI); ctx.fillText(b, 0, 0); ctx.restore(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildRunways(time) {
  const g = new THREE.Group();
  g.name = 'runways';
  for (const rw of Object.values(RUNWAYS)) {
    if (rw.kind === 'lane') {
      g.add(buildLaneBuoys(rw, time));
      continue;
    }
    const geo = new THREE.PlaneGeometry(rw.width, rw.length);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: runwayTexture(rw) }));
    mesh.position.set(rw.x, rw.elev + 0.9, rw.z);
    // canvas bottom (first number) lands at the 'a' threshold, glyphs upright for a pilot landing on hdg
    mesh.rotation.y = -(rw.hdg * Math.PI) / 180;
    g.add(mesh);
    if (rw.kind === 'runway') {
      g.add(approachLights(rw, time));
      if (time.windows > 0.3) g.add(runwayLights(rw));
    }
  }
  return g;
}

function laneAxes(rw) {
  const a = (rw.hdg * Math.PI) / 180;
  return { fx: Math.sin(a), fz: -Math.cos(a), rx: Math.cos(a), rz: Math.sin(a) };
}

function runwayLights(rw) {
  const { fx, fz, rx, rz } = laneAxes(rw);
  const pts = [];
  for (let s = -rw.length / 2; s <= rw.length / 2; s += 60) {
    for (const side of [-1, 1]) pts.push(rw.x + fx * s + rx * side * (rw.width / 2 + 2), rw.elev + 1, rw.z + fz * s + rz * side * (rw.width / 2 + 2));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd27a, size: 5, sizeAttenuation: false, fog: true }));
}

/** Approach light bars on poles before each threshold, and green threshold lights. */
function approachLights(rw, time) {
  const g = new THREE.Group();
  const { fx, fz, rx, rz } = laneAxes(rw);
  const size = time.windows > 0.5 ? 16 : 11;
  for (const end of [-1, 1]) {
    // end -1: the 'a' threshold; the lights run back out along the approach
    const base = (rw.length / 2) * end;
    for (let i = 1; i <= 10; i++) {
      const s = base + end * i * 32;
      const y = Math.max(rw.elev, groundHeight(rw.x + fx * s, rw.z + fz * s)) + 3;
      const bar = i === 5 ? [-3, -2, -1, 0, 1, 2, 3] : [-1, 0, 1];
      for (const k of bar) {
        const l = glowSprite(0xfff6dc, size);
        l.position.set(rw.x + fx * s + rx * k * 5, y, rw.z + fz * s + rz * k * 5);
        g.add(l);
      }
    }
    for (let k = -4; k <= 4; k++) {
      const l = glowSprite(0x44ff88, size * 0.8);
      l.position.set(rw.x + fx * base + rx * k * (rw.width / 8), rw.elev + 1.6, rw.z + fz * base + rz * k * (rw.width / 8));
      g.add(l);
    }
  }
  return g;
}

function buildLaneBuoys(rw, time) {
  const { fx, fz, rx, rz } = laneAxes(rw);
  const geo = new THREE.SphereGeometry(1.6, 8, 6);
  const n = Math.floor(rw.length / 100) + 1;
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xff7a1a, emissive: time.windows > 0.5 ? 0xff8a30 : 0x401500 }), n * 2);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = -rw.length / 2 + i * 100;
    for (const side of [-1, 1]) {
      m.makeTranslation(rw.x + fx * s + rx * side * rw.width / 2, 0.6, rw.z + fz * s + rz * side * rw.width / 2);
      mesh.setMatrixAt(k++, m);
    }
  }
  const g = new THREE.Group();
  g.add(mesh);
  if (time.windows > 0.5) {
    const pts = [];
    for (let i = 0; i < n; i++) for (const side of [-1, 1]) pts.push(rw.x + fx * (-rw.length / 2 + i * 100) + rx * side * rw.width / 2, 2.5, rw.z + fz * (-rw.length / 2 + i * 100) + rz * side * rw.width / 2);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffa040, size: 6, sizeAttenuation: false })));
  }
  return g;
}

/** Gannet Point lighthouse: banded tower, lantern room, glow and a turning beam. */
function buildLighthouse() {
  const L = LANDMARKS.lighthouse;
  const base = groundHeight(L.x, L.z);
  const g = new THREE.Group();
  g.name = 'lighthouse';
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const r0 = 4.2 - i * 0.35;
    const r1 = 4.2 - (i + 1) * 0.35;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L.height / bands, 14), lambert(i % 2 ? 0xc0392b : 0xf6f2ea));
    seg.position.y = (i + 0.5) * (L.height / bands);
    g.add(seg);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.6, 14), lambert(0x2a2a2a));
  gallery.position.y = L.height + 0.3;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.2, 12), new THREE.MeshLambertMaterial({ color: 0xfff1b0, emissive: 0xffd060, transparent: true, opacity: 0.9 }));
  lantern.position.y = L.height + 2.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 12), lambert(0x2a2a2a));
  cap.position.y = L.height + 5;
  const beamGeo = new THREE.ConeGeometry(70, 900, 20, 1, true);
  beamGeo.translate(0, -450, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Group();
  const b1 = new THREE.Mesh(beamGeo, beamMat);
  const b2 = b1.clone();
  b2.rotation.y = Math.PI;
  beam.add(b1, b2);
  beam.position.y = L.height + 2.2;
  const glow = glowSprite(0xffe090, 60);
  glow.position.y = L.height + 2.2;
  g.add(gallery, lantern, cap, beam, glow);
  g.position.set(L.x, base, L.z);
  g.userData = { beam, glow, lantern, on: true };
  g.userData.tick = (t, on) => {
    beam.visible = on;
    glow.visible = on;
    lantern.material.emissive.setHex(on ? 0xffd060 : 0x201808);
    beam.rotation.y = t * 0.6;
  };
  return g;
}

function buildHangar() {
  const H = LANDMARKS.hangar;
  const base = groundHeight(H.x, H.z);
  const g = new THREE.Group();
  g.name = 'hangar';
  const body = new THREE.Mesh(new THREE.BoxGeometry(38, 11, 30), lambert(0x8f9ba3));
  body.position.y = 5.5;
  const roofGeo = new THREE.CylinderGeometry(19.5, 19.5, 31, 16, 1, false, 0, Math.PI);
  roofGeo.rotateZ(Math.PI / 2);
  roofGeo.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, lambert(0x6d7a84));
  roof.scale.set(1, 0.42, 1);
  roof.position.y = 11;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(30, 9.5), new THREE.MeshBasicMaterial({ color: 0x16191c }));
  door.position.set(0, 4.8, 15.05);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.6), new THREE.MeshBasicMaterial({ map: textTexture(['TIDEWING AIR SERVICE'], 512, 72, '#c0392b', '#fff6e0', 'bold 40px sans-serif') }));
  sign.position.set(0, 13.2, 15.2);
  g.add(body, roof, door, sign);
  g.position.set(H.x, base, H.z);
  g.rotation.y = -Math.PI / 2; // doors face west, onto runway 36/18
  // windsock beside the apron
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), lambert(0xdddddd));
  pole.position.set(-34, 4.5, -10);
  const sockGeo = new THREE.ConeGeometry(1.1, 6, 8, 1, true);
  sockGeo.rotateZ(-Math.PI / 2);
  sockGeo.translate(3, 0, 0);
  const sock = new THREE.Mesh(sockGeo, new THREE.MeshLambertMaterial({ color: 0xff6a00, side: THREE.DoubleSide }));
  sock.position.set(-34, 8.6, -10);
  g.add(pole, sock);
  g.userData.sock = sock;
  return g;
}

function buildObservatory() {
  const O = LANDMARKS.observatory;
  const base = groundHeight(O.x, O.z);
  const g = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 8, 16), lambert(0xeeeeee));
  drum.position.y = 4;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xd8dde2));
  dome.position.y = 8;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 6), new THREE.MeshBasicMaterial({ color: 0x222831 }));
  slot.position.set(0, 11, 3);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 4), lambert(0x999999));
  mast.position.set(9, 7, 0);
  g.add(drum, dome, slot, mast);
  g.position.set(O.x, base, O.z);
  g.name = 'observatory';
  return g;
}

function buildHarbourBits() {
  const g = new THREE.Group();
  const D = LANDMARKS.dock;
  const dock = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 6), lambert(0x7a5a3a));
  dock.position.set(D.x + 30, 1, D.z);
  const B = LANDMARKS.fuelBarge;
  const barge = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 12), lambert(0x34495e));
  barge.position.set(B.x, 1.2, B.z);
  for (let i = -1; i <= 1; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 9, 10), lambert(0xd35400));
    tank.rotation.z = Math.PI / 2;
    tank.position.set(B.x + i * 7, 5, B.z);
    g.add(tank);
  }
  g.add(dock, barge);
  return g;
}

/** Smoke rising from Mount Cinder's crater: a column of drifting puffs. */
function buildVolcanoSmoke(time, rnd) {
  const c = LANDMARKS.crater;
  const top = groundHeight(c.x, c.z);
  const g = new THREE.Group();
  g.name = 'smoke';
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const puffs = [];
  for (let i = 0; i < 40; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, color: time.windows > 0.9 ? 0x50433d : 0x9a908a, transparent: true, depthWrite: false, opacity: 0.6 });
    const s = new THREE.Sprite(mat);
    s.userData.phase = rnd();
    s.userData.drift = rnd() * 2 - 1;
    puffs.push(s);
    g.add(s);
  }
  g.userData.tick = (t, windX, windZ) => {
    for (const s of puffs) {
      const p = (s.userData.phase + t * 0.012) % 1;
      const h = p * 900;
      s.position.set(c.x + windX * h * 0.9 + s.userData.drift * 60 * p, top + 20 + h, c.z + windZ * h * 0.9 + s.userData.drift * 40);
      const size = 160 + p * 640;
      s.scale.set(size, size, 1);
      s.material.opacity = 0.75 * (1 - p) * Math.min(1, p * 8);
    }
  };
  return g;
}

export function buildIslandProps(time, seed = 1) {
  const rnd = seededRandom(seed);
  const g = new THREE.Group();
  g.name = 'props';
  const lighthouse = buildLighthouse();
  const hangar = buildHangar();
  const smoke = buildVolcanoSmoke(time, rnd);
  g.add(buildForest(rnd), buildVillages(rnd, time), buildRunways(time), lighthouse, hangar, buildObservatory(), buildHarbourBits(), smoke);
  g.userData = { lighthouse, hangar, smoke };
  return g;
}
