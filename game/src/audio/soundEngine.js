// All sound is made in code with WebAudio: the radial engine's drone and its rough
// running, rushing wind that rises with airspeed, the float hiss on the water, the stall
// horn, a low-fuel chime, rain, the radio blip, splashes and thumps on touchdown, the
// ring chime and the crash. Starts on first input.

export function makeSoundEngine() {
  let ctx = null;
  let nodes = null;
  const se = { enabled: true };

  function noiseBuffer(c, seconds = 2) {
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // brown-ish
      d[i] = last * 3.5 + w * 0.15;
    }
    return b;
  }

  se.start = () => {
    if (ctx || !se.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // engine: two detuned saws through a low-pass, with a slow lumpy amplitude for the radial
    const eGain = ctx.createGain();
    eGain.gain.value = 0;
    const eFilter = ctx.createBiquadFilter();
    eFilter.type = 'lowpass';
    eFilter.frequency.value = 600;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'square';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain); lfoGain.connect(eGain.gain);
    o1.connect(eFilter); o2.connect(eFilter); eFilter.connect(eGain); eGain.connect(master);
    o1.start(); o2.start(); lfo.start();
    // wind: looping noise through a band-pass
    const wSrc = ctx.createBufferSource();
    wSrc.buffer = noiseBuffer(ctx, 3);
    wSrc.loop = true;
    const wFilter = ctx.createBiquadFilter();
    wFilter.type = 'bandpass';
    wFilter.frequency.value = 800;
    wFilter.Q.value = 0.6;
    const wGain = ctx.createGain(); wGain.gain.value = 0;
    wSrc.connect(wFilter); wFilter.connect(wGain); wGain.connect(master);
    wSrc.start();
    // stall horn
    const horn = ctx.createOscillator(); horn.type = 'square'; horn.frequency.value = 440;
    const hGain = ctx.createGain(); hGain.gain.value = 0;
    horn.connect(hGain); hGain.connect(master); horn.start();
    // float hiss: low noise that rises while the floats run on the water
    const fSrc = ctx.createBufferSource();
    fSrc.buffer = noiseBuffer(ctx, 2);
    fSrc.loop = true;
    const fFilter = ctx.createBiquadFilter();
    fFilter.type = 'lowpass';
    fFilter.frequency.value = 500;
    const fGain = ctx.createGain(); fGain.gain.value = 0;
    fSrc.connect(fFilter); fFilter.connect(fGain); fGain.connect(master);
    fSrc.start();
    nodes = { master, o1, o2, eFilter, eGain, wFilter, wGain, hGain, lfo, fGain, fFilter };
  };

  function burst(duration, freq, gain, type = 'lowpass') {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, duration);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(f); f.connect(g); g.connect(nodes.master);
    src.start();
  }

  function tone(freq, duration, gain = 0.15, type = 'sine', delay = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    o.connect(g); g.connect(nodes.master);
    o.start(t0); o.stop(t0 + duration + 0.05);
  }

  /** Follow the aircraft every frame. */
  se.update = (ac, paused) => {
    if (!ctx || !nodes) return;
    const t = ctx.currentTime;
    const rpm = paused ? 0 : ac.engine.rpm;
    const f = 20 + rpm / 60 * 4.5;
    nodes.o1.frequency.setTargetAtTime(f, t, 0.08);
    nodes.o2.frequency.setTargetAtTime(f * 0.5 + ac.engine.sputter * 8, t, 0.08);
    nodes.eFilter.frequency.setTargetAtTime(300 + rpm * 0.35, t, 0.1);
    nodes.eGain.gain.setTargetAtTime(paused ? 0 : 0.05 + (rpm / 2500) * 0.16 * (1 - ac.engine.sputter * 0.5), t, 0.1);
    nodes.lfo.frequency.setTargetAtTime(4 + rpm / 300, t, 0.2);
    const v = paused ? 0 : ac.ias;
    nodes.wGain.gain.setTargetAtTime(Math.min(0.35, (v / 60) ** 2 * 0.3), t, 0.15);
    nodes.wFilter.frequency.setTargetAtTime(300 + v * 22, t, 0.2);
    nodes.hGain.gain.setTargetAtTime(!paused && ac.stallWarn ? 0.06 : 0, t, 0.03);
    const onWater = !paused && ac.onSurface && ac.surfaceKind === 'water';
    nodes.fGain.gain.setTargetAtTime(onWater ? Math.min(0.4, ac.gs / 30 * 0.4) : 0, t, 0.08);
    nodes.fFilter.frequency.setTargetAtTime(300 + (ac.gs ?? 0) * 25, t, 0.1);
    // low fuel: a soft double chime every eight seconds while under 15%
    const low = !paused && ac.fuel && ac.fuel.litres / ac.fuel.capacity < 0.15;
    if (low && t - (se.lastChime ?? -99) > 8) { se.lastChime = t; tone(990, 0.18, 0.07); tone(740, 0.25, 0.07, 'sine', 0.2); }
  };

  se.event = (type) => {
    if (!ctx) return;
    if (type === 'touchdown') burst(0.5, 400, 0.5);
    else if (type === 'splash') burst(0.9, 1500, 0.35, 'bandpass');
    else if (type === 'bounce') burst(0.3, 300, 0.6);
    else if (type === 'crash') { burst(2.2, 500, 0.9); burst(1.5, 2500, 0.4, 'bandpass'); }
    else if (type === 'ring') { tone(880, 0.25, 0.12); tone(1320, 0.35, 0.1, 'sine', 0.12); }
    else if (type === 'radio') { tone(1200, 0.06, 0.05, 'square'); burst(0.12, 3000, 0.08, 'bandpass'); }
    else if (type === 'drop') burst(0.6, 900, 0.25, 'bandpass');
    else if (type === 'thunder') burst(3, 120, 0.9);
    else if (type === 'success') { tone(660, 0.2, 0.12); tone(880, 0.2, 0.12, 'sine', 0.15); tone(1320, 0.4, 0.12, 'sine', 0.3); }
    else if (type === 'fail') { tone(330, 0.4, 0.12, 'triangle'); tone(220, 0.6, 0.12, 'triangle', 0.3); }
  };

  se.stop = () => { if (nodes) nodes.master.gain.value = 0; };
  return se;
}
