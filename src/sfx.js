// Tiny synthesized sound effects — no audio files to load.
let ac = null, master = null, noiseBuf = null, enabled = true;

function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.35;
      master.connect(ac.destination);
    } catch (e) { return null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
  const a = enabled && audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

/** The shared white-noise buffer (one second, created once). */
function ensureNoise(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
  const a = enabled && audio(); if (!a) return;
  const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = ensureNoise(a);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur);
}

/**
 * Original synthesized "scene change" sting for the spinning-emblem transition:
 * a swirling filtered whoosh + a rising two-oscillator glissando with vibrato,
 * landing on a short brass-style chord stab.
 */
function spinSting() {
  const a = enabled && audio(); if (!a) return;
  const t = a.currentTime;
  const out = a.createGain(); out.gain.value = 0.9; out.connect(master);
  // 1) swirling whoosh: noise through a sweeping band-pass, tremolo'd
  const n = a.createBufferSource(); n.buffer = ensureNoise(a); n.loop = true;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.7); bp.frequency.exponentialRampToValueAtTime(500, t + 1.2);
  const ng = a.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.5, t + 0.15); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  const trem = a.createOscillator(), tremG = a.createGain(); trem.frequency.value = 13; tremG.gain.value = 0.25;
  trem.connect(tremG).connect(ng.gain);
  n.connect(bp).connect(ng).connect(out);
  n.start(t); n.stop(t + 1.3); trem.start(t); trem.stop(t + 1.3);
  // 2) rising glissando, two detuned saws with vibrato
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.95);
  const gg = a.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(0.16, t + 0.2); gg.gain.setValueAtTime(0.16, t + 0.85); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.02);
  lp.connect(gg).connect(out);
  const vib = a.createOscillator(), vibG = a.createGain(); vib.frequency.value = 9; vibG.gain.value = 18;
  vib.connect(vibG); vib.start(t); vib.stop(t + 1.05);
  for (const det of [-9, 9]) {
    const o = a.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.95);
    vibG.connect(o.frequency);
    o.connect(lp); o.start(t); o.stop(t + 1.05);
  }
  // 3) brass-style stab
  const st = t + 1.0;
  const sl = a.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.setValueAtTime(3500, st); sl.frequency.exponentialRampToValueAtTime(700, st + 0.5);
  const sg = a.createGain(); sg.gain.setValueAtTime(0.0001, st); sg.gain.exponentialRampToValueAtTime(0.22, st + 0.02); sg.gain.exponentialRampToValueAtTime(0.0001, st + 0.6);
  sl.connect(sg).connect(out);
  for (const f of [220, 277.2, 329.6, 440]) {
    const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(sl); o.start(st); o.stop(st + 0.62);
  }
}

/** Shared audio graph for looping sounds (flight wind, sirens). null if audio is unavailable. */
export function audioGraph() {
  const a = audio();
  if (!a) return null;
  return { ctx: a, out: master, noise: ensureNoise(a) };
}

export const sfx = {
  spin: spinSting,
  /** Boost ignition: a rising rush. */
  boost() { noise(0.5, 0.35, 1800); tone(180, 0.45, 'sawtooth', 0.08, 260); },
  /** Sonic boom: deep double thump + crack. */
  sonicBoom() { tone(70, 0.6, 'sine', 0.5, -40); noise(0.35, 0.6, 700); tone(55, 0.5, 'sine', 0.35, -25, 0.12); noise(0.08, 0.5, 5000, 0.02); },
  /** Cartoon impact for POW! bursts: thump + slap. */
  pow() { tone(150, 0.14, 'square', 0.22, -110); noise(0.09, 0.55, 2600); tone(1200, 0.05, 'triangle', 0.08, -600, 0.01); },
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; return enabled; },
  unlock() { audio(); },
  click() { tone(900, 0.04, 'square', 0.08); },
  punch() { noise(0.08, 0.5, 900); tone(130, 0.08, 'square', 0.18, -60); },
  hit() { noise(0.12, 0.6, 2200); tone(90, 0.12, 'sawtooth', 0.22, -50); },
  hurt() { tone(320, 0.22, 'sawtooth', 0.22, -220); },
  whoosh() { noise(0.4, 0.25, 700); },
  dive() { tone(900, 0.9, 'sine', 0.18, -700); noise(0.9, 0.22, 900); },
  /** Comic landing THUD: a sub boom falling to ~30 Hz, a body knock, a gritty crunch, a crack, then rubble. */
  thud() {
    tone(118, 0.9, 'sine', 0.95, -86); tone(64, 0.6, 'sine', 0.5, -30, 0.01);
    tone(210, 0.2, 'triangle', 0.32, -150);
    noise(0.5, 0.7, 850); noise(0.07, 0.5, 5200);
    for (let i = 0; i < 5; i++) noise(0.04 + Math.random() * 0.05, 0.13, 2400, 0.14 + i * 0.075 + Math.random() * 0.04);
  },
  pickup() { [660, 880, 1175].forEach((f, i) => tone(f, 0.1, 'triangle', 0.2, 0, i * 0.06)); },
  shutter() { noise(0.04, 0.5, 6000); noise(0.05, 0.4, 3000, 0.07); },
  alarm() { tone(760, 0.22, 'square', 0.14, -240); tone(760, 0.22, 'square', 0.14, -240, 0.28); },
  beam() { tone(180, 0.5, 'sawtooth', 0.14, 700); },
  breath() { noise(0.6, 0.3, 4000); },
  drink() { tone(520, 0.35, 'sine', 0.2, -320); tone(260, 0.35, 'sine', 0.12, 140, 0.15); },
  paper() { noise(0.7, 0.3, 3500); tone(200, 0.6, 'triangle', 0.1, 400); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.22, 0, i * 0.12)); },
  lose() { [392, 311, 233].forEach((f, i) => tone(f, 0.32, 'sawtooth', 0.16, 0, i * 0.18)); },
  trap() { tone(200, 0.6, 'sawtooth', 0.2, -150); noise(0.5, 0.3, 500, 0.1); },
  door() { noise(0.5, 0.25, 400); tone(90, 0.5, 'square', 0.1, 30); },
};
