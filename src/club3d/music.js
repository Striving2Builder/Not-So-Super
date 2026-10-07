// The club's music until the user's own tracks arrive: a synthesized four-on-the-floor loop at the
// club's tempo (kick, offbeat hats, a pulsing bass, a stab every other bar), scheduled ahead on the
// WebAudio clock. It drives the drop (a noise riser during the build, a cut, then the full beat
// back) and super-hearing (a low-pass that muffles everything while she listens).
import { audioGraph, sfx } from '../sfx.js';

const LOOK_AHEAD = 0.12; // seconds of notes scheduled ahead of the clock
const NOTES = [55, 55, 65.4, 49];  // bass root per bar (A, A, C, G)

export class ClubMusic {
  constructor(bpm) {
    this.bpm = bpm;
    this.beat = 60 / bpm;
    this.on = false;
  }

  start() {
    const G = audioGraph();
    if (!G || this.on) return;
    const ctx = (this.ctx = G.ctx);
    this.noise = G.noise;
    this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.Q.value = 0.7;
    this.bus.connect(this.lp).connect(G.out);
    this.bus.gain.setTargetAtTime(0.55, ctx.currentTime, 0.8);
    this.next = ctx.currentTime + 0.1; this.n = 0;
    this.cut = 0; this.rise = null;
    this.on = true;
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, 0.15);
    const bus = this.bus, lp = this.lp;
    setTimeout(() => { try { bus.disconnect(); lp.disconnect(); } catch (e) { /* gone */ } }, 1200);
  }

  /** Per frame. muffle 0..1 (super-hearing), paused: menus are up. */
  update(muffle, paused) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const want = paused || !sfx.enabled ? 0 : 0.55;
    if (want !== this.vol) { this.vol = want; this.bus.gain.setTargetAtTime(want, t, paused ? 0.06 : 0.4); }
    const f = 18000 * Math.pow(220 / 18000, muffle);
    if (Math.abs(f - (this.f || 0)) > 50) { this.f = f; this.lp.frequency.setTargetAtTime(f, t, 0.12); }
    while (this.next < t + LOOK_AHEAD) { this.play(this.n, this.next); this.n++; this.next += this.beat / 2; }
  }

  /** The build before a drop: `secs` of rising noise, then `cut` seconds of silence. */
  build(secs, cut = this.beat) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + secs);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + secs); g.gain.setValueAtTime(0.0001, t + secs + 0.01);
    s.connect(bp).connect(g).connect(this.bus);
    s.start(t); s.stop(t + secs + 0.05);
    this.cut = t + secs + cut; // the beat drops back in after the cut
    this.cutFrom = t + secs;
  }

  // one eighth note
  play(n, t) {
    if (t > (this.cutFrom || 0) && t < this.cut) return;
    const ctx = this.ctx, step = n % 2, beat = Math.floor(n / 2), bar = Math.floor(beat / 4);
    const out = this.bus;
    const env = (node, vol, dur, at = t) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      node.connect(g).connect(out);
      return g;
    };
    if (!step) {
      // kick: a pitch-dropping sine
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      env(o, 0.9, 0.28); o.start(t); o.stop(t + 0.3);
    } else {
      // offbeat hat: bright noise
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      s.connect(hp); env(hp, 0.16, 0.06); s.start(t, Math.random() * 0.5); s.stop(t + 0.08);
    }
    // rolling bass on every eighth, root of the bar
    const f = NOTES[bar % NOTES.length] * (step ? 2 : 1);
    const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(160, t + 0.14);
    b.connect(lp); env(lp, 0.16, 0.16); b.start(t); b.stop(t + 0.18);
    // a chord stab on the "and" of beat 2, every other bar
    if (step && beat % 4 === 1 && bar % 2 === 1) {
      for (const k of [1, 1.26, 1.5]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = NOTES[bar % NOTES.length] * 4 * k;
        const sl = ctx.createBiquadFilter(); sl.type = 'lowpass'; sl.frequency.value = 2200;
        o.connect(sl); env(sl, 0.05, 0.22); o.start(t); o.stop(t + 0.25);
      }
    }
  }
}
