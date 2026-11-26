// Weather you can see: rain streaks around the camera, lightning flashes that light the
// whole scene, spray from the floats on the water and the wake behind them.

import * as THREE from 'three';
import { seededRandom } from '../util/noise.js';

export function makeWeatherEffects(scene, weather, time) {
  const rnd = seededRandom(5);
  const rainCount = weather.rain > 0 ? Math.round(2600 * weather.rain) : 0;
  let rain = null;
  if (rainCount) {
    const pos = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const x = (rnd() - 0.5) * 240;
      const y = (rnd() - 0.5) * 160;
      const z = (rnd() - 0.5) * 240;
      pos.set([x, y, z, x + 0.4, y - 5, z + 0.4], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.45, fog: false }));
    rain.frustumCulled = false;
    scene.add(rain);
  }
  const flash = new THREE.AmbientLight(0xe8eeff, 0);
  scene.add(flash);

  // float spray: a ring of white puffs behind the floats when running fast on water
  const sprayGeo = new THREE.BufferGeometry();
  const sprayN = 160;
  const sprayPos = new Float32Array(sprayN * 3);
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
  const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.8, depthWrite: false }));
  spray.frustumCulled = false;
  scene.add(spray);
  const drops = Array.from({ length: sprayN }, () => ({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  let nextDrop = 0;

  // a crash: a tall white splash on water or a dust burst on land, then dark smoke
  const wreckSmoke = new THREE.Group();
  const smokeTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const puffs = Array.from({ length: 24 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x3a3632, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.phase = i / 24;
    wreckSmoke.add(s);
    return s;
  });
  wreckSmoke.visible = false;
  scene.add(wreckSmoke);
  let crash = null;

  /** Start the crash effects at a point; kind is 'water' or anything else for land. */
  function crashBurst(pos, kind, t) {
    crash = { x: pos.x, y: Math.max(0, pos.y - 1.7), z: pos.z, kind, t };
    wreckSmoke.position.set(crash.x, crash.y, crash.z);
    wreckSmoke.visible = true;
    for (let i = 0; i < sprayN; i++) {
      const d = drops[i];
      const a = rnd() * Math.PI * 2;
      const sp = 4 + rnd() * 10;
      d.x = crash.x; d.y = crash.y + 0.5; d.z = crash.z;
      d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 6 + rnd() * (kind === 'water' ? 16 : 8);
      d.life = 2.5;
    }
    spray.material.color.setHex(kind === 'water' ? 0xffffff : 0x8a7a62);
  }

  function update(dt, t, camera, ac, flashAt) {
    if (crash) {
      const age = t - crash.t;
      for (const s of puffs) {
        const p = (s.userData.phase + age * 0.07) % 1;
        s.position.set(p * 18, 2 + p * 90, p * 9);
        s.scale.setScalar(8 + p * 40);
        s.material.opacity = Math.min(1, age / 1.5) * 0.65 * (1 - p);
      }
    }
    if (rain) {
      rain.position.copy(camera.position);
      rain.position.y -= (t * 60) % 5;
      rain.position.x += ac ? -ac.vel.x * 0 : 0;
    }
    const since = t - (flashAt ?? -99);
    flash.intensity = since < 0.25 ? 4 * (1 - since / 0.25) : 0;
    if (ac && ac.onSurface && ac.surfaceKind === 'water' && ac.gs > 6) {
      const n = Math.min(6, Math.floor(ac.gs / 5));
      for (let k = 0; k < n; k++) {
        const d = drops[nextDrop++ % sprayN];
        const side = k % 2 ? 1 : -1;
        d.x = ac.pos.x + (rnd() - 0.5) * 2 + side * 1.4;
        d.y = 0.4;
        d.z = ac.pos.z + (rnd() - 0.5) * 2;
        d.vx = ac.vel.x * 0.3 + (rnd() - 0.5) * 3 + side * 2;
        d.vy = 2 + rnd() * ac.gs * 0.15;
        d.vz = ac.vel.z * 0.3 + (rnd() - 0.5) * 3;
        d.life = 1.2;
      }
    }
    for (let i = 0; i < sprayN; i++) {
      const d = drops[i];
      if (d.life > 0) {
        d.life -= dt;
        d.vy -= 9.81 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < 0) d.life = 0;
      }
      sprayPos[i * 3] = d.x;
      sprayPos[i * 3 + 1] = d.life > 0 ? d.y : -100;
      sprayPos[i * 3 + 2] = d.z;
    }
    sprayGeo.attributes.position.needsUpdate = true;
  }
  return { update, crashBurst, clearCrash() { crash = null; wreckSmoke.visible = false; spray.material.color.setHex(0xffffff); } };
}
