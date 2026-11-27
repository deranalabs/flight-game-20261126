// Keyboard and mouse to stick, rudder, throttle, flaps and switches. Keys move the
// surfaces at a steady rate and centre them when let go; the mouse wheel sets power,
// the mouse yoke (M) flies from the pointer, and dragging looks around the cockpit.
// A gamepad blends in through readPad; J and N answer the bingo box.

import { clamp } from '../util/vec3.js';

export const KEY_HELP = [
  ['W / S or Up / Down', 'Nose down / nose up'],
  ['A / D or Left / Right', 'Roll left / right'],
  ['Q / E', 'Rudder left / right'],
  ['Shift / Ctrl, mouse wheel', 'Throttle up / down'],
  ['1 to 9, 0', 'Throttle 10 to 90%, 100%'],
  ['F / V', 'Flaps down / up a stage'],
  ['B (hold)', 'Brakes on runways'],
  ['Space', 'Drop sack or water'],
  ['C', 'Chase / cockpit / tail view'],
  ['Gamepad', 'Left stick fly, triggers throttle, A drop, Y camera, bumpers flaps'],
  ['M', 'Mouse yoke on / off'],
  ['Z', 'Autopilot: hold heading and height'],
  ['R', 'Restart a stopped engine'],
  ['L', 'Landing light'],
  ['J / N', 'At bingo fuel: jettison the load / divert'],
  ['[ / ]', 'Pitch trim'],
  ['Esc / P', 'Pause'],
];

export function makePilotControls(target = window) {
  const keys = new Set();
  const pressed = new Set();
  const st = {
    elevator: 0, aileron: 0, rudder: 0, throttle: 0.6, flaps: 0, brake: 0, trim: 0,
    mouseYoke: false, mouse: { x: 0, y: 0 }, look: { yaw: 0, pitch: 0 }, dragging: false,
  };
  const down = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => keys.delete(e.code);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('wheel', (e) => { st.throttle = clamp(st.throttle - Math.sign(e.deltaY) * 0.05, 0, 1); }, { passive: true });
  target.addEventListener('mousemove', (e) => {
    st.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    st.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (st.dragging) {
      st.look.yaw = clamp(st.look.yaw - e.movementX * 0.005, -2.4, 2.4);
      st.look.pitch = clamp(st.look.pitch - e.movementY * 0.005, -0.9, 0.9);
    }
  });
  target.addEventListener('mousedown', (e) => { if (e.button === 0 && !st.mouseYoke) st.dragging = true; });
  target.addEventListener('mouseup', () => { st.dragging = false; });
  target.addEventListener('blur', () => keys.clear());

  const any = (...codes) => codes.some((c) => keys.has(c));
  function axis(cur, neg, pos, dt, rate = 2.6, centre = 3.4) {
    const want = (pos ? 1 : 0) - (neg ? 1 : 0);
    if (want !== 0) return clamp(cur + want * rate * dt, -1, 1);
    const back = Math.sign(cur) * Math.min(Math.abs(cur), centre * dt);
    return cur - back;
  }

  /** Read this frame's inputs. Returns one-shot actions pressed since the last call. */
  st.update = (dt) => {
    if (st.mouseYoke) {
      st.elevator = clamp(-st.mouse.y * 1.4, -1, 1);
      st.aileron = clamp(st.mouse.x * 1.4, -1, 1);
    } else {
      st.elevator = axis(st.elevator, any('KeyW', 'ArrowUp'), any('KeyS', 'ArrowDown'), dt);
      st.aileron = axis(st.aileron, any('KeyA', 'ArrowLeft'), any('KeyD', 'ArrowRight'), dt);
    }
    st.rudder = axis(st.rudder, any('KeyQ'), any('KeyE'), dt, 2.2, 3);
    const pad = readPad(st, dt);
    if (any('ShiftLeft', 'ShiftRight', 'Equal', 'NumpadAdd')) st.throttle = clamp(st.throttle + 0.45 * dt, 0, 1);
    if (any('ControlLeft', 'ControlRight', 'Minus', 'NumpadSubtract')) st.throttle = clamp(st.throttle - 0.45 * dt, 0, 1);
    for (let n = 0; n <= 9; n++) if (pressed.has(`Digit${n}`)) st.throttle = n === 0 ? 1 : n / 10;
    if (pressed.has('KeyF')) st.flaps = st.flaps < 0.25 ? 0.5 : 1;
    if (pressed.has('KeyV')) st.flaps = st.flaps > 0.75 ? 0.5 : 0;
    if (any('BracketLeft')) st.trim = clamp(st.trim - 0.4 * dt, -1, 1);
    if (any('BracketRight')) st.trim = clamp(st.trim + 0.4 * dt, -1, 1);
    st.brake = any('KeyB') ? 1 : 0;
    if (pressed.has('KeyM')) st.mouseYoke = !st.mouseYoke;
    const actions = {
      drop: pressed.has('Space') || pad.drop,
      camera: pressed.has('KeyC') || pad.camera,
      restart: pressed.has('KeyR'),
      autopilot: pressed.has('KeyZ'),
      light: pressed.has('KeyL'),
      jettison: pressed.has('KeyJ'),
      divert: pressed.has('KeyN'),
      pause: pressed.has('Escape') || pressed.has('KeyP') || pad.pause,
      any: pressed.size > 0,
      help: pressed.has('KeyH'),
      mouseYoke: pressed.has('KeyM'),
    };
    pressed.clear();
    if (!st.dragging) { st.look.yaw *= 1 - Math.min(1, dt * 2); st.look.pitch *= 1 - Math.min(1, dt * 2); }
    return actions;
  };

  // Gamepad (standard mapping): sticks blend into the smoothed surfaces, triggers set power,
  // bumpers step the flaps, buttons are edges so a held button acts once.
  const padWas = {};
  function readPad(cur, dt) {
    const out = { drop: false, camera: false, pause: false };
    const gp = globalThis.navigator?.getGamepads?.()?.[0];
    if (!gp) return out;
    const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    const ease = Math.min(1, dt * 10);
    if (dead(gp.axes[0]) || dead(gp.axes[1])) {
      cur.aileron += (dead(gp.axes[0]) - cur.aileron) * ease;
      cur.elevator += (dead(gp.axes[1]) - cur.elevator) * ease;
    }
    if (dead(gp.axes[2] ?? 0)) cur.rudder += (dead(gp.axes[2]) - cur.rudder) * ease;
    const btn = (i) => !!gp.buttons[i]?.pressed;
    const edge = (i) => { const now = btn(i); const e = now && !padWas[i]; padWas[i] = now; return e; };
    const rt = gp.buttons[7]?.value ?? 0;
    const lt = gp.buttons[6]?.value ?? 0;
    if (rt > 0.05 || lt > 0.05) cur.throttle = clamp(cur.throttle + (rt - lt) * 0.6 * dt, 0, 1);
    if (edge(5)) cur.flaps = cur.flaps < 0.25 ? 0.5 : 1;
    if (edge(4)) cur.flaps = cur.flaps > 0.75 ? 0.5 : 0;
    out.drop = edge(0);
    out.camera = edge(3);
    out.pause = edge(9);
    return out;
  }

  /** Copy the pilot's controls onto the aircraft. */
  st.apply = (ac) => {
    const c = ac.controls;
    c.elevator = st.elevator;
    c.aileron = st.aileron;
    c.rudder = st.rudder;
    c.throttle = st.throttle;
    c.flaps = st.flaps;
    c.brake = st.brake;
    c.trim = st.trim;
  };

  /** Start a sortie with the levers where the aircraft has them. */
  st.syncFrom = (ac) => {
    st.throttle = ac.controls.throttle;
    st.flaps = ac.controls.flaps;
    st.elevator = 0; st.aileron = 0; st.rudder = 0; st.trim = 0;
  };
  return st;
}
