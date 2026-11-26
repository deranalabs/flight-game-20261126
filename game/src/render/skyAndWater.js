// Sky dome with a painted gradient, sun or moon disc and stars; soft clouds; and the sea:
// a wide plane with a rippled normal map drawn in code, see-through over the shallows.

import * as THREE from 'three';
import { seededRandom } from '../util/noise.js';

export function buildSky(time) {
  const geo = new THREE.SphereGeometry(30000, 32, 16);
  const sunDir = new THREE.Vector3(...time.sunDir).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(time.skyTop) },
      horizon: { value: new THREE.Color(time.skyHorizon) },
      sunColor: { value: new THREE.Color(time.sunDisc) },
      sunDir: { value: sunDir },
      halo: { value: time.halo ?? 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir; uniform float halo; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
        if (h < 0.0) col = mix(horizon, horizon * 0.7, -h * 4.0);
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 1.6 + pow(s, 12.0) * 0.25);
        col += sunColor * halo * (pow(s, 250.0) * 1.2 + pow(s, 40.0) * 0.45 + pow(s, 4.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  sky.renderOrder = -10;
  const g = new THREE.Group();
  g.add(sky);
  if (time.stars > 0) {
    const rnd = seededRandom(7);
    const pts = [];
    for (let i = 0; i < 1400; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(th) * r * 28000, y * 28000, Math.sin(th) * r * 28000);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: time.stars, fog: false, depthWrite: false }));
    g.add(stars);
  }
  return g;
}

function cloudTexture(seed, dark) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  const rnd = seededRandom(seed);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176;
    const y = 50 + rnd() * 40 - Math.abs(x - 128) * 0.15;
    const r = 18 + rnd() * 30;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    const base = dark ? '90,98,108' : '255,255,255';
    grd.addColorStop(0, `rgba(${base},0.85)`);
    grd.addColorStop(1, `rgba(${base},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Fair-weather cumulus, or a low dark deck in the storm. */
export function buildClouds(time, weather, seed = 3) {
  const g = new THREE.Group();
  g.name = 'clouds';
  const storm = weather === 'storm';
  const rnd = seededRandom(seed);
  const textures = [0, 1, 2].map((i) => cloudTexture(seed * 10 + i, storm));
  const count = storm ? 70 : weather === 'calm' ? 18 : 34;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: textures[i % 3], transparent: true, depthWrite: false, opacity: storm ? 0.9 : 0.85, fog: true });
    mat.color = new THREE.Color(time.windows > 0.9 ? 0x6070a0 : time.sunDisc).lerp(new THREE.Color(0xffffff), 0.5);
    const s = new THREE.Sprite(mat);
    const w = 900 + rnd() * 1400;
    s.scale.set(w, w * 0.45, 1);
    s.position.set((rnd() * 2 - 1) * 9000, (storm ? 520 : 1100) + rnd() * (storm ? 300 : 700), (rnd() * 2 - 1) * 9000);
    g.add(s);
  }
  return g;
}

function rippleTexture(repeat) {
  const n = 256;
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = (x / n) * Math.PI * 2;
      const b = (y / n) * Math.PI * 2;
      const dx = Math.cos(a * 3 + Math.sin(b * 2) * 1.5) * 0.5 + Math.cos(a * 7 + b * 5) * 0.25;
      const dy = Math.cos(b * 4 + Math.sin(a * 3) * 1.2) * 0.5 + Math.sin(b * 9 - a * 4) * 0.2;
      const i = (y * n + x) * 4;
      img.data[i] = 128 + dx * 90;
      img.data[i + 1] = 128 + dy * 90;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

export function buildWater(time) {
  const geo = new THREE.PlaneGeometry(60000, 60000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  // glitter: a broader, brighter sun path on coarser ripples, so it reads from far away
  const glitter = time.glitter ?? 0;
  const normalMap = rippleTexture(glitter ? 110 : 220);
  const mat = new THREE.MeshPhongMaterial({
    color: time.water,
    specular: new THREE.Color(time.sunDisc).multiplyScalar(glitter || 0.6),
    shininess: glitter ? 28 : 60,
    normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true,
    opacity: 0.82,
  });
  const water = new THREE.Mesh(geo, mat);
  water.name = 'water';
  water.position.y = 0;
  water.userData.tick = (t) => { normalMap.offset.set(t * 0.004, t * 0.0025); };
  return water;
}
