// The island chain as one low-poly mesh: heights from heightmap.js, colours painted by
// height, slope and place: beach sand, meadow, forest floor, bare rock, ash and the glow
// of the crater. Flat shaded so every facet catches the sun.

import * as THREE from 'three';
import { groundHeight, slopeAt } from './heightmap.js';
import { WORLD_HALF, ISLANDS, LANDMARKS } from './islandLayout.js';
import { fbm } from '../util/noise.js';

const C = (hex) => new THREE.Color(hex);
const SAND = C(0xe3d09a);
const WET_SAND = C(0xc2ad78);
const SHALLOW = C(0x5fc4c0);
const DEEP = C(0x1f4f6a);
const MEADOW = C(0x7fa64e);
const GRASS = C(0x5c8a3c);
const FOREST = C(0x3d6a33);
const ROCK = C(0x857565);
const ASH = C(0x4d4542);
const SCORIA = C(0x6e3b2c);
const LAVA = C(0xff6a1c);

const CINDER = ISLANDS.find((i) => i.id === 'cinder');

/** Colour of the ground at a point, also used to scatter trees on the forest bands. */
export function groundColour(x, z, h, slope, out = new THREE.Color()) {
  if (h < 0) {
    return out.copy(DEEP).lerp(SHALLOW, Math.max(0, 1 + h / 14));
  }
  const dc = Math.hypot(x - CINDER.x, z - CINDER.z) / CINDER.r;
  const n = fbm(x / 260, z / 260, 3, 5);
  if (h < 3.5) return out.copy(WET_SAND).lerp(SAND, Math.min(1, h / 3.5));
  if (dc < 0.13) return out.copy(SCORIA).lerp(LAVA, Math.max(0, 1 - dc / 0.07));
  if (dc < 0.55 && h > 260) return out.copy(ASH).lerp(SCORIA, Math.max(0, n * 0.8 + (0.4 - dc)));
  if (slope > 0.75 || h > 420) return out.copy(ROCK).lerp(ASH, Math.min(1, Math.max(0, (h - 380) / 300)));
  if (forestAt(x, z, h, slope)) return out.copy(FOREST).lerp(GRASS, Math.max(0, n * 0.6));
  return out.copy(MEADOW).lerp(GRASS, Math.min(1, Math.max(0, h / 160 + n * 0.5)));
}

/** Forest bands: mid slopes away from the volcano's ash. */
export function forestAt(x, z, h, slope) {
  if (h < 8 || h > 380 || slope > 0.7) return false;
  const dc = Math.hypot(x - CINDER.x, z - CINDER.z) / CINDER.r;
  if (dc < 0.5) return false;
  return fbm(x / 520 + 11, z / 520 - 3, 3, 9) > 0.08;
}

export function buildTerrainMesh(segments = 300) {
  const size = WORLD_HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    groundColour(x, z, h, h > 0 ? slopeAt(x, z, 30) : 0, col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

/** A glowing pool in the crater that lights the smoke at dusk and night. */
export function buildCraterGlow() {
  const c = LANDMARKS.crater;
  const h = groundHeight(c.x, c.z);
  const geo = new THREE.CircleGeometry(c.r * 0.55, 24);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff5a10, fog: true }));
  mesh.position.set(c.x, h + 3, c.z);
  const light = new THREE.PointLight(0xff6a20, 4, 1600, 1.4);
  light.position.set(c.x, h + 60, c.z);
  const g = new THREE.Group();
  g.add(mesh, light);
  g.name = 'craterGlow';
  return g;
}
