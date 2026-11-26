// What a mission puts in the world: numbered rings, smoke-flare drop targets, burning
// fires with their smoke, falling sacks and water, splashes, and a beacon on the next goal.

import * as THREE from 'three';
import { glowSprite } from './glowSprite.js';
import { groundHeight } from '../terrain/heightmap.js';

function numberTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 8;
  ctx.font = 'bold 92px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(text, 64, 68);
  ctx.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildRing(o, n, night) {
  const g = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(o.r, 2.6, 10, 40),
    new THREE.MeshLambertMaterial({ color: 0xffb020, emissive: night ? 0xff9a10 : 0x7a4a00 }),
  );
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(o.r - 5, 0.8, 6, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.8 }),
  );
  g.add(torus, inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bulb = glowSprite(0xffd060, night ? 22 : 12);
    bulb.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
    g.add(bulb);
  }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(String(n), '#fff4c8'), depthTest: false, transparent: true }));
  label.scale.set(26, 26, 1);
  label.position.set(0, o.r + 18, 0);
  label.renderOrder = 5;
  g.add(label);
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = -(o.hdg * Math.PI) / 180;
  g.userData.kind = 'ring';
  return g;
}

function buildDropTarget(o, night) {
  const g = new THREE.Group();
  const y = o.y + 0.6;
  const ringGeo = new THREE.RingGeometry(o.r * 0.82, o.r, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.85, depthWrite: false }));
  const bullGeo = new THREE.CircleGeometry(o.r * 0.22, 24);
  bullGeo.rotateX(-Math.PI / 2);
  const bull = new THREE.Mesh(bullGeo, new THREE.MeshBasicMaterial({ color: 0xfff1e0, transparent: true, opacity: 0.9, depthWrite: false }));
  outer.position.y = y;
  bull.position.y = y + 0.1;
  g.add(outer, bull);
  // a red smoke flare rising from the centre
  const flare = smokeColumn(0xff5040, 18, 140);
  flare.position.y = y;
  g.add(flare);
  if (night) { const glow = glowSprite(0xff4030, 30); glow.position.y = y + 3; g.add(glow); }
  g.position.set(o.x, 0, o.z);
  g.userData.kind = 'drop';
  return g;
}

let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(cv);
  return puffTex;
}

function smokeColumn(color, count, height) {
  const g = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color, transparent: true, depthWrite: false, opacity: 0.5 }));
    s.userData.phase = i / count;
    puffs.push(s);
    g.add(s);
  }
  g.userData.tick = (t, wx = 0, wz = 0, scale = 1) => {
    for (const s of puffs) {
      const p = (s.userData.phase + t * 0.08) % 1;
      const h = p * height * scale;
      s.position.set(wx * h * 0.6 + Math.sin(p * 9 + s.userData.phase * 20) * 3, h, wz * h * 0.6);
      const size = (10 + p * 58) * scale * (g.userData.width ?? 1);
      s.scale.set(size, size, 1);
      s.material.opacity = 0.6 * (1 - p);
    }
  };
  return g;
}

function buildFire(o) {
  const g = new THREE.Group();
  const flames = [];
  for (let i = 0; i < 16; i++) {
    const s = glowSprite(i % 2 ? 0xff7a1a : 0xffc040, 30);
    const a = i * 2.39;
    const r = Math.sqrt(i / 16) * o.r * 0.8;
    s.position.set(Math.cos(a) * r, 6, Math.sin(a) * r);
    s.userData.base = s.position.clone();
    flames.push(s);
    g.add(s);
  }
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(o.r, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x241510, transparent: true, opacity: 0.7, depthWrite: false }));
  scorch.position.y = 1;
  const smoke = smokeColumn(0x4a4440, 34, 520);
  smoke.userData.width = 2.4;
  g.add(scorch, smoke);
  const light = new THREE.PointLight(0xff7020, 60, 500, 1.2);
  light.position.y = 25;
  g.add(light);
  g.position.set(o.x, o.y, o.z);
  g.userData = { kind: 'fire', flames, smoke, light, fire: null };
  return g;
}

/**
 * Water released from the belly tank: 600 drops that leave the tank as a column, fall
 * with the aircraft's speed and spread into a wide curtain before they hit the slope.
 */
function makeWaterSpray(group) {
  const N = 600;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8f6ff, size: 1.6, map: puffTexture(), transparent: true, opacity: 0.8, depthWrite: false }));
  pts.frustumCulled = false;
  group.add(pts);
  const jitter = Array.from({ length: N }, (_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12543.123 % 1, Math.sin(i * 39.425) * 3758.77 % 1]);
  return {
    update(drops) {
      let k = 0;
      for (const l of drops.slice(-2)) {
        if (l.t > 6) continue;
        const spread = 3 + l.t * 14;
        for (let j = 0; j < N / 2 && k < N; j++, k++) {
          const [a, b, c] = jitter[j];
          // drops released earlier trail behind and above the leading ones
          const lag = Math.abs(c) * Math.min(l.t, 1.2);
          pos[k * 3] = l.x - l.vx * lag + a * spread;
          pos[k * 3 + 1] = Math.max(l.landed ? l.y : 0, l.y + lag * 9 + Math.abs(b) * spread * 0.4);
          pos[k * 3 + 2] = l.z - l.vz * lag + b * spread;
        }
      }
      for (; k < N; k++) pos[k * 3 + 1] = -500;
      geo.attributes.position.needsUpdate = true;
    },
  };
}

/** Keep the 3D markers in step with the mission's objectives and loose loads. */
export function makeMarkerLayer(scene, night) {
  const group = new THREE.Group();
  group.name = 'markers';
  scene.add(group);
  const built = new Map();
  const loads = new THREE.Group();
  group.add(loads);
  const sackGeo = new THREE.BoxGeometry(0.9, 0.6, 1.2);
  const sackMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const beacon = glowSprite(0x7fe0ff, 40);
  beacon.visible = false;
  group.add(beacon);

  function update(ms, t, wind) {
    const ringIndex = new Map();
    let n = 0;
    ms.objectives.forEach((o) => { if (o.kind === 'ring') ringIndex.set(o, ++n); });
    ms.objectives.forEach((o, i) => {
      const live = i >= ms.index;
      let m = built.get(o);
      if (!m && live) {
        const mk = o.marker();
        if (!mk) return;
        if (mk.type === 'ring') m = buildRing(mk, ringIndex.get(o), night);
        else if (mk.type === 'drop') m = buildDropTarget(mk, night);
        else if (mk.type === 'fire') { m = buildFire(mk); m.userData.fire = o.fire; }
        if (m) { built.set(o, m); group.add(m); }
      }
      if (!m) return;
      const current = i === ms.index;
      if (m.userData.kind === 'fire') {
        const f = m.userData.fire;
        m.visible = f.intensity > 0.02 || t - (m.userData.outAt ?? t) < 20;
        const k = Math.max(0.05, f.intensity);
        m.userData.flames.forEach((s, j) => {
          const flick = 0.75 + 0.25 * Math.sin(t * 9 + j * 1.7);
          s.scale.setScalar((34 + (j % 4) * 12) * k * flick * (f.intensity > 0.02 ? 1 : 0));
          s.position.y = s.userData.base.y + Math.sin(t * 5 + j) * 2 * k;
        });
        m.userData.light.intensity = 60 * k;
        m.userData.smoke.userData.tick(t, wind.x, wind.z, 0.4 + k);
      } else {
        m.visible = live;
        if (m.userData.kind === 'ring') m.scale.setScalar(current ? 1 + Math.sin(t * 4) * 0.04 : 0.92);
        m.traverse((c) => c.userData.tick && c.userData.tick(t, wind.x, wind.z));
      }
    });
    // beacon over a landing target so it can be found from far away
    const obj = ms.objectives[ms.index];
    const mk = obj && obj.marker ? obj.marker() : null;
    if (mk && (mk.type === 'runway' || mk.type === 'beacon' || mk.type === 'runways')) {
      const rw = mk.rw ?? (mk.fields ? mk.fields[0] : mk);
      const y = (rw.kind === 'lane' ? 0 : Math.max(0, groundHeight(rw.x, rw.z))) + 40 + Math.sin(t * 3) * 4;
      beacon.position.set(rw.x, y, rw.z);
      beacon.visible = true;
    } else beacon.visible = false;

    // loose loads: mail sacks tumble, a water drop is a falling, spreading curtain of spray
    while (loads.children.length < ms.loads.length) loads.add(new THREE.Mesh(sackGeo, sackMat));
    loads.children.forEach((mesh, i) => {
      const l = ms.loads[i];
      mesh.visible = !!l && l.kind !== 'water';
      if (!l || l.kind === 'water') return;
      mesh.position.set(l.x, l.y, l.z);
      mesh.rotation.set(l.t * 3, l.t * 2, 0);
    });
    spray.update(ms.loads.filter((l) => l.kind === 'water'));
  }
  const spray = makeWaterSpray(group);
  return { group, update };
}
