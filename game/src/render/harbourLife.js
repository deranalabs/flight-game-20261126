// The Reach going about its day around the aircraft, all cheap instanced props built once
// and moved in place each frame (no allocation in tick): fishing boats working the lanes,
// the Halyard-Saltmoor ferry on its timetable, gulls wheeling off the coast, windsocks on
// every water lane that swing with the real wind, and quay lamps that light from dusk.

import * as THREE from 'three';
import { RUNWAYS, LANDMARKS } from '../terrain/islandLayout.js';
import { glowSprite } from './glowSprite.js';

const BOATS = 14;
const GULLS = 36;
/** The ferry crosses Halyard Harbour to Saltmoor Dock and back every FERRY_PERIOD seconds. */
const FERRY_PERIOD = 360;
const FERRY_FROM = { x: 900, z: 4050 };
const FERRY_TO = { x: 4050, z: 380 };
// where the boats work: around the harbour and the Saltmoor lane, each on its own loop
const GROUNDS = [
  { x: 300, z: 4300, r: 700 }, { x: 3700, z: 900, r: 500 }, { x: -2600, z: 2400, r: 600 }, { x: 2600, z: -5300, r: 450 },
];

const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

export function buildHarbourLife(time) {
  const g = new THREE.Group();
  g.name = 'harbourLife';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // fishing boats: a hull and a cabin, instanced
  const hulls = new THREE.InstancedMesh(new THREE.BoxGeometry(3.2, 1.4, 9), lambert(0x2a6f8a), BOATS);
  const cabins = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.2, 3), lambert(0xefe6cf), BOATS);
  const boats = Array.from({ length: BOATS }, (_, i) => ({ ground: GROUNDS[i % GROUNDS.length], phase: i * 1.7, speed: 0.008 + (i % 5) * 0.002, rad: 0.45 + ((i * 37) % 50) / 100 }));
  g.add(hulls, cabins);

  // the ferry: a long white hull with a sulphur funnel
  const ferry = new THREE.Group();
  const fh = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 34), lambert(0xf2efe6));
  fh.position.y = 1.6;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 16), lambert(0x16120f));
  deck.position.set(0, 4.6, -2);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 4, 8), lambert(0xf2c230));
  funnel.position.set(0, 7.5, 4);
  ferry.add(fh, deck, funnel);
  g.add(ferry);

  // gulls: two flat wings each, wheeling in loose circles over the coasts
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -1.4, 0.35, 0.3, -1.4, 0.35, -0.3, 0, 0, 0, 1.4, 0.35, -0.3, 1.4, 0.35, 0.3], 3));
  wing.computeVertexNormals();
  const gullMesh = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xf4f1ea, side: THREE.DoubleSide }), GULLS);
  const gulls = Array.from({ length: GULLS }, (_, i) => ({ ground: GROUNDS[i % GROUNDS.length], phase: i * 0.61, h: 25 + (i % 7) * 9, r: 60 + (i % 9) * 22 }));
  g.add(gullMesh);

  // a windsock on every water lane, beside its threshold
  const socks = [];
  for (const rw of Object.values(RUNWAYS)) {
    if (rw.kind !== 'lane') continue;
    const a = (rw.hdg * Math.PI) / 180;
    const x = rw.x - Math.sin(a) * rw.length * 0.45 + Math.cos(a) * (rw.width / 2 + 25);
    const z = rw.z + Math.cos(a) * rw.length * 0.45 + Math.sin(a) * (rw.width / 2 + 25);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 10, 5), lambert(0xefe6cf));
    pole.position.set(x, 5, z);
    const geo = new THREE.ConeGeometry(1.2, 6.5, 8, 1, true);
    geo.rotateZ(-Math.PI / 2);
    geo.translate(3.2, 0, 0);
    const sock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf2c230, side: THREE.DoubleSide }));
    sock.position.set(x, 9.6, z);
    g.add(pole, sock);
    socks.push(sock);
  }

  // quay lamps along Halyard Harbour and Saltmoor Dock, lit from dusk
  const lit = time.windows > 0.3;
  const lampSpots = [];
  for (let i = 0; i < 12; i++) lampSpots.push([-300 + i * 90, 3900]);
  const D = LANDMARKS.dock;
  for (let i = 0; i < 6; i++) lampSpots.push([D.x + i * 12, D.z + 4]);
  for (const [x, z] of lampSpots) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 4), lambert(0x16120f));
    post.position.set(x, 3, z);
    g.add(post);
    if (lit) {
      const glow = glowSprite(0xffd27a, 9);
      glow.position.set(x, 6.4, z);
      g.add(glow);
    }
  }

  g.userData.tick = (t, windX, windZ) => {
    boats.forEach((b, i) => {
      const a = b.phase + t * b.speed * 6;
      p.set(b.ground.x + Math.cos(a) * b.ground.r * b.rad, 0.5 + Math.sin(t * 1.3 + i) * 0.25, b.ground.z + Math.sin(a) * b.ground.r * b.rad);
      q.setFromAxisAngle(up, -a);
      m.compose(p, q, s);
      hulls.setMatrixAt(i, m);
      p.y += 1.6;
      m.compose(p, q, s);
      cabins.setMatrixAt(i, m);
    });
    hulls.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    // ferry: out and back, a pause at each end
    const f = (t % FERRY_PERIOD) / FERRY_PERIOD;
    const leg = f < 0.5 ? f * 2 : 2 - f * 2;
    const k = Math.min(1, Math.max(0, (leg - 0.08) / 0.84));
    ferry.position.set(FERRY_FROM.x + (FERRY_TO.x - FERRY_FROM.x) * k, 0, FERRY_FROM.z + (FERRY_TO.z - FERRY_FROM.z) * k);
    ferry.rotation.y = Math.atan2(FERRY_TO.x - FERRY_FROM.x, FERRY_TO.z - FERRY_FROM.z) + (f < 0.5 ? 0 : Math.PI);
    gulls.forEach((b, i) => {
      const a = b.phase + t * 0.35;
      p.set(b.ground.x + Math.cos(a) * b.r, b.h + Math.sin(t + i) * 3, b.ground.z + Math.sin(a) * b.r);
      q.setFromAxisAngle(up, -a);
      const flap = 0.7 + Math.sin(t * 9 + i) * 0.3;
      s.set(1.4, flap * 1.4, 1.4);
      m.compose(p, q, s);
      gullMesh.setMatrixAt(i, m);
    });
    s.set(1, 1, 1);
    gullMesh.instanceMatrix.needsUpdate = true;
    // the socks point where the wind blows to, and droop in a calm
    const yaw = Math.atan2(-windZ, windX);
    const strength = Math.min(1, Math.hypot(windX, windZ) * 2.5);
    for (const sock of socks) {
      sock.rotation.set(0, yaw, -(1 - strength) * 1.1 + Math.sin(t * 3) * 0.05);
    }
  };
  return g;
}
