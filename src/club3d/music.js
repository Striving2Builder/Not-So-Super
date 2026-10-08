// The club's music: the user's tracks (assets/Music/), one after another, streamed through a media
// element into the game's audio graph (a 2–3 minute track decoded whole would cost tens of MB on an
// iPad). Each track's tempo, first beat and drops were measured offline (TRACKS), so the lights,
// the crowd and the VIP dance move with the actual music, and the club's drop (the strobe, the
// blind bouncers) lands on the track's own drops. Super-hearing runs it all through a low-pass.
// No audio graph, or a track that won't play: the synthesized loop (SynthBeat) stands in.
import { audioGraph, sfx } from '../sfx.js';
import { beat } from '../nlkit.js';

/** src, tempo (BPM), first downbeat (s), drops: where the energy jumps back in after a breakdown (s). */
export const TRACKS = [
  { src: 'assets/Music/Neon Case File.mp3', bpm: 124.0, first: 0.176, drops: [18.5, 61.0, 99.5] },
  { src: 'assets/Music/Case of Steel.mp3', bpm: 128.05, first: 0.428, drops: [30.5, 64.5, 128.0] },
  { src: 'assets/Music/Cape and Cufflinks.mp3', bpm: 135.8, first: 0.116, drops: [37.5, 84.0] },
];
const VOL = 0.5, DUCK = 0.22;   // the music's level, and while a dialog is up (the club doesn't stop)
const SILENCE = 'assets/audio/game/silence.mp3';
export const SYNTH_BPM = 124;

// One media element for every visit (a MediaElementSource can only ever be made once per element).
// iOS only lets an element play from code once it has played in a tap: it's primed on the first one.
let el = null, source = null;
const element = () => {
  if (!el) { el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', ''); }
  return el;
};
const prime = () => {
  removeEventListener('pointerdown', prime, true); removeEventListener('keydown', prime, true);
  const a = element();
  if (a.src) return;
  a.src = SILENCE;
  a.play().then(() => a.pause()).catch(() => { /* a later tap will do */ });
};
if (typeof addEventListener !== 'undefined') { addEventListener('pointerdown', prime, true); addEventListener('keydown', prime, true); }

export class ClubMusic {
  constructor() { this.on = false; this.mode = null; this.track = null; }

  start() {
    const G = audioGraph();
    if (!G || this.on) return;
    const ctx = (this.ctx = G.ctx);
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.Q.value = 0.7;
    this.bus.connect(this.lp).connect(G.out);
    this.on = true; this.vol = -1; this.f = 0;
    try {
      const a = element();
      if (!source) source = ctx.createMediaElementSource(a);
      source.connect(this.bus);
      this.mode = 'track';
      this.ti = Math.floor(Math.random() * TRACKS.length);
      this.onEnded = () => this.load(this.ti + 1);
      a.addEventListener('ended', this.onEnded);
      this.onHide = () => { if (document.hidden) a.pause(); else if (this.on && this.mode === 'track') a.play().catch(() => {}); };
      document.addEventListener('visibilitychange', this.onHide);
      this.load(this.ti);
    } catch (e) { this.useSynth(); }
  }

  load(i) {
    const a = element();
    this.ti = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    this.track = TRACKS[this.ti];
    this.used = new Set();
    a.loop = false;
    a.src = encodeURI(this.track.src);
    a.currentTime = 0;
    a.play().catch(() => this.useSynth()); // (blocked or missing: the synth carries the night)
  }

  /** Fall back to the synthesized loop (no media element, or the track won't play). */
  useSynth() {
    if (!this.on || this.mode === 'synth') return;
    if (this.mode === 'track') { element().pause(); try { source.disconnect(); } catch (e) { /* not connected */ } }
    this.mode = 'synth';
    this.track = null;
    this.synth = new SynthBeat(this.ctx, this.bus, SYNTH_BPM);
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, 0.15);
    if (this.mode === 'track') {
      const a = element();
      a.removeEventListener('ended', this.onEnded);
      document.removeEventListener('visibilitychange', this.onHide);
      setTimeout(() => { a.pause(); try { source.disconnect(); } catch (e) { /* gone */ } }, 600);
    }
    const bus = this.bus, lp = this.lp;
    setTimeout(() => { try { bus.disconnect(); lp.disconnect(); } catch (e) { /* gone */ } }, 1200);
  }

  /** The media element the tracks stream through (the harness seeks it). */
  get media() { return element(); }

  /** The tempo she's dancing to right now. */
  get bpm() { return this.mode === 'track' ? this.track.bpm : SYNTH_BPM; }

  /** The beat clock (nlkit's beat()): from the track's own position, or the game clock for the synth. */
  beat(gameT) {
    if (this.mode === 'track' && this.track) return beat(element().currentTime - this.track.first, this.track.bpm);
    return beat(gameT, SYNTH_BPM);
  }

  /** Seconds to the track's next drop not played yet (null: the synth keeps its own timer). */
  timeToDrop() {
    if (this.mode !== 'track' || !this.track) return null;
    const now = element().currentTime;
    const d = this.track.drops.find((q, i) => !this.used.has(i) && q > now - 0.3);
    return d === undefined ? null : d - now;
  }

  /** That drop has happened (or been missed): don't count it again. */
  consumeDrop() {
    if (this.mode !== 'track' || !this.track) return;
    const now = element().currentTime;
    const i = this.track.drops.findIndex((q, k) => !this.used.has(k) && q > now - 0.3);
    if (i >= 0) this.used.add(i);
  }

  /** Per frame. muffle 0..1 (super-hearing), paused: a dialog is up (the music ducks, it doesn't stop). */
  update(muffle, paused) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const want = !sfx.enabled ? 0 : paused ? DUCK : VOL;
    if (want !== this.vol) { this.vol = want; this.bus.gain.setTargetAtTime(want, t, paused ? 0.1 : 0.4); }
    const f = 18000 * Math.pow(220 / 18000, muffle);
    if (Math.abs(f - this.f) > 50) { this.f = f; this.lp.frequency.setTargetAtTime(f, t, 0.12); }
    if (this.mode === 'synth') this.synth.update();
  }

  /** The build before a drop: the tracks build by themselves; the synth needs its riser and cut. */
  build(secs) { if (this.mode === 'synth') this.synth.build(secs); }
}

// ------------------------------------------------------------------ the stand-in
const NOTES = [55, 55, 65.4, 49];  // bass root per bar (A, A, C, G)
const LOOK_AHEAD = 0.12;           // seconds of notes scheduled ahead of the clock

/** A four-on-the-floor loop (kick, offbeat hats, rolling bass, a stab every other bar), scheduled ahead. */
class SynthBeat {
  constructor(ctx, out, bpm) {
    this.ctx = ctx; this.out = out; this.noise = audioGraph().noise;
    this.beat = 60 / bpm; this.next = ctx.currentTime + 0.1; this.n = 0; this.cut = 0; this.cutFrom = 0;
  }

  update() {
    const t = this.ctx.currentTime;
    while (this.next < t + LOOK_AHEAD) { this.play(this.n, this.next); this.n++; this.next += this.beat / 2; }
  }

  /** `secs` of rising noise, then a beat of silence before the drop. */
  build(secs, cut = this.beat) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + secs);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + secs); g.gain.setValueAtTime(0.0001, t + secs + 0.01);
    s.connect(bp).connect(g).connect(this.out);
    s.start(t); s.stop(t + secs + 0.05);
    this.cutFrom = t + secs; this.cut = t + secs + cut;
  }

  play(n, t) {
    if (t > this.cutFrom && t < this.cut) return;
    const ctx = this.ctx, step = n % 2, beatN = Math.floor(n / 2), bar = Math.floor(beatN / 4);
    const env = (node, vol, dur) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      node.connect(g).connect(this.out);
    };
    if (!step) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      env(o, 0.9, 0.28); o.start(t); o.stop(t + 0.3);
    } else {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      s.connect(hp); env(hp, 0.16, 0.06); s.start(t, Math.random() * 0.5); s.stop(t + 0.08);
    }
    const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = NOTES[bar % NOTES.length] * (step ? 2 : 1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(160, t + 0.14);
    b.connect(lp); env(lp, 0.16, 0.16); b.start(t); b.stop(t + 0.18);
    if (step && beatN % 4 === 1 && bar % 2 === 1) {
      for (const k of [1, 1.26, 1.5]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = NOTES[bar % NOTES.length] * 4 * k;
        const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 2200;
        o.connect(sl); env(sl, 0.05, 0.22); o.start(t); o.stop(t + 0.25);
      }
    }
  }
}
