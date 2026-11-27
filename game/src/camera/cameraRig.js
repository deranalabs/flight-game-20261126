// Cameras: a chase view that trails behind and above, leads into turns and never dips
// under the water or the hills; a tail view, low and close behind the fin; a cockpit view
// at the pilot's eye with mouse head-look; and a slow orbit for the hangar and the
// debrief. Switching between chase and tail blends, since both ease toward their spot.

import * as THREE from 'three';
import { groundHeight } from '../terrain/heightmap.js';

/** The tail view: close behind the fin, just above it. */
export const TAIL = { distance: 11, height: 2.4 };
/** Order the C key cycles the flying views in. */
export const VIEWS = ['chase', 'cockpit', 'tail'];

export function makeCameraRig(camera) {
  const rig = {
    mode: 'chase',
    look: { yaw: 0, pitch: 0 },
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    init: false,
  };
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();

  rig.update = (ac, dt, opts = {}) => {
    q.set(ac.q.x, ac.q.y, ac.q.z, ac.q.w);
    const p = new THREE.Vector3(ac.pos.x, ac.pos.y, ac.pos.z);
    if (rig.mode === 'cockpit') {
      // pilot's eye in the left seat, just under the wing root
      const eye = new THREE.Vector3(-0.25, 0.7, -1.3).applyQuaternion(q).add(p);
      camera.position.copy(eye);
      const lookQ = q.clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rig.look.yaw))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rig.look.pitch - 0.13));
      camera.quaternion.copy(lookQ);
      camera.fov = 72;
      camera.updateProjectionMatrix();
      return;
    }
    if (rig.mode === 'orbit') {
      const t = opts.t ?? 0;
      const r = opts.radius ?? 26;
      camera.position.set(p.x + Math.sin(t * 0.15) * r, p.y + 6, p.z + Math.cos(t * 0.15) * r);
      camera.lookAt(p.x, p.y + 1, p.z);
      return;
    }
    // chase: behind along the flight path, up a little, smoothed
    const tail = rig.mode === 'tail';
    const back = opts.distance ?? (tail ? TAIL.distance : 21);
    const up = opts.height ?? (tail ? TAIL.height : 5.5);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (flat.lengthSq() < 0.01) flat.set(0, 0, -1);
    flat.normalize();
    // blend the nose direction with the velocity so the view follows where she is going
    const vel = new THREE.Vector3(ac.vel.x, ac.vel.y, ac.vel.z);
    const dir = vel.lengthSq() > 25 ? vel.normalize().lerp(fwd, 0.5).normalize() : fwd;
    const right = new THREE.Vector3(-flat.z, 0, flat.x);
    const want = p.clone().addScaledVector(dir, -back).addScaledVector(right, opts.side ?? 0).add(new THREE.Vector3(0, up, 0));
    if (!rig.init || opts.snap) { rig.pos.copy(want); rig.init = true; }
    rig.pos.lerp(want, Math.min(1, dt * 3.2));
    const floor = Math.max(0, groundHeight(rig.pos.x, rig.pos.z)) + 2.5;
    if (rig.pos.y < floor) rig.pos.y = floor;
    camera.position.copy(rig.pos);
    // look past the aircraft at the way ahead, a little below the nose
    tmp.copy(p).addScaledVector(flat, opts.lookAhead ?? 30).add(new THREE.Vector3(0, opts.lookDown ?? 1.5, 0));
    camera.up.set(0, 1, 0);
    camera.lookAt(tmp);
    camera.fov = opts.fov ?? 62;
    camera.updateProjectionMatrix();
  };
  return rig;
}
