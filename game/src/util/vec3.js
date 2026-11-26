// Small 3D vector and quaternion helpers on plain {x, y, z} / {x, y, z, w} objects.
// The flight model and the bot use these so they run in Node without three.js.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : { x: 0, y: 0, z: 0 };
};
export const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const quat = (x = 0, y = 0, z = 0, w = 1) => ({ x, y, z, w });

export function quatMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatNormalize(q) {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

export function quatFromAxisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(angle / 2) };
}

/** Rotate vector v by unit quaternion q. */
export function rotate(q, v) {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y;
  const iy = q.w * v.y + q.z * v.x - q.x * v.z;
  const iz = q.w * v.z + q.x * v.y - q.y * v.x;
  const iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return {
    x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
    y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
    z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
  };
}

/**
 * Orientation from heading (deg, 0 = north = -z, 90 = east = +x), pitch (deg, nose up +)
 * and bank (deg, right wing down +). Body axes: forward -z, up +y, right +x.
 */
export function quatFromHeadingPitchBank(hdgDeg, pitchDeg, bankDeg) {
  const d = Math.PI / 180;
  const yaw = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, -hdgDeg * d);
  const pitch = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, pitchDeg * d);
  const roll = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, -bankDeg * d);
  return quatNormalize(quatMul(quatMul(yaw, pitch), roll));
}

export const FORWARD = { x: 0, y: 0, z: -1 };
export const UP = { x: 0, y: 1, z: 0 };
export const RIGHT = { x: 1, y: 0, z: 0 };

/** Heading, pitch and bank in degrees read back from an orientation. */
export function headingPitchBank(q) {
  const f = rotate(q, FORWARD);
  const r = rotate(q, RIGHT);
  const hdg = (Math.atan2(f.x, -f.z) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, f.y))) * 180) / Math.PI;
  // Bank: angle of the right wing below the horizon, signed.
  const bank = (Math.atan2(-r.y, Math.hypot(r.x, r.z)) * 180) / Math.PI;
  const u = rotate(q, UP);
  const inverted = u.y < 0;
  return {
    hdg: (hdg + 360) % 360,
    pitch,
    bank: inverted ? (bank >= 0 ? 180 - bank : -180 - bank) : bank,
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrap180 = (deg) => {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  if (d === -180) d = 180;
  return d;
};
export const DEG = Math.PI / 180;
