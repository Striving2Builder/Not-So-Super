// Continuous flight audio: a wind loop whose loudness and brightness follow airspeed,
// and a siren from the nearest incident that grows louder (and pans) as she approaches.
// The wind starts as filtered noise and hands over to two recorded loops (cruise / fast,
// crossfaded by airspeed) as soon as they're decoded.
import { audioGraph, loadSample, sfx } from './sfx.js';
import { clamp } from './util.js';

const WIND = ['wind-cruise.wav', 'wind-fast.wav'];

export class FlightAudio {
  start() {
    if (this.nodes) return;
    const g = audioGraph();
    if (!g) return;
    const { ctx, out, noise } = g;
    // Wind: looped noise → band-pass (brightness) → noise gain → wind gain (loudness)
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 0.7; band.frequency.value = 400;
    const noiseGain = ctx.createGain();
    const windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(band).connect(noiseGain).connect(windGain).connect(out);
    src.start();
    // Siren: square wave warbling between two pitches → low-pass → gain → stereo pan
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 700;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.3;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 110;
    lfo.connect(lfoAmt).connect(osc.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.connect(lp).connect(sirenGain);
    if (pan) sirenGain.connect(pan).connect(out); else sirenGain.connect(out);
    osc.start(); lfo.start();
    const n = this.nodes = { ctx, src, band, noiseGain, windGain, osc, lfo, sirenGain, pan, rec: null };
    Promise.all(WIND.map(loadSample)).then(([cruise, fast]) => {
      if (cruise && fast && this.nodes === n) this.recordedWind(n, cruise, fast);
    });
  }

  /** Swap the noise wind for the two recorded loops: each → its own gain → low-pass → wind gain. */
  recordedWind(n, cruise, fast) {
    const { ctx } = n, t = ctx.currentTime;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 2000;
    const loop = (buf) => {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; g.gain.value = 0;
      s.connect(g).connect(lp);
      s.start(t, Math.random() * buf.duration);
      return { s, g };
    };
    n.rec = { cruise: loop(cruise), fast: loop(fast), lp };
    lp.connect(n.windGain);
    n.noiseGain.gain.setTargetAtTime(0, t, 0.3);
    setTimeout(() => { try { n.src.stop(); } catch (e) { /* already stopped */ } }, 2000);
  }

  /**
   * @param speedFrac 0..1 airspeed
   * @param siren {vol 0..1, pan -1..1} for the nearest incident, or null
   * @param inCloud 0..1 — muffles the wind inside a cloud
   */
  update(speedFrac, siren, inCloud = 0) {
    const n = this.nodes;
    if (!n) return;
    const t = n.ctx.currentTime, on = sfx.enabled ? 1 : 0, s = speedFrac, r = n.rec;
    const level = r ? 0.09 + 0.9 * s * s : 0.03 + 0.32 * s * s;
    n.windGain.gain.setTargetAtTime(on * level * (1 - 0.4 * inCloud), t, 0.15);
    if (r) {
      // cruise → fast, equal-power, over 30–85% airspeed; the cruise loop pitches up a little with speed
      const k = clamp((s - 0.3) / 0.55, 0, 1), mix = k * k * (3 - 2 * k);
      r.cruise.g.gain.setTargetAtTime(Math.cos(mix * Math.PI / 2), t, 0.2);
      r.fast.g.gain.setTargetAtTime(Math.sin(mix * Math.PI / 2), t, 0.2);
      r.cruise.s.playbackRate.setTargetAtTime(0.9 + 0.25 * s, t, 0.3);
      r.lp.frequency.setTargetAtTime(Math.max(400, 1200 + 9000 * s - 3500 * inCloud), t, 0.2);
    } else {
      n.band.frequency.setTargetAtTime(Math.max(150, 300 + 2600 * s - 900 * inCloud), t, 0.2);
    }
    n.sirenGain.gain.setTargetAtTime(on * (siren ? siren.vol * 0.06 : 0), t, 0.3);
    if (n.pan && siren) n.pan.pan.setTargetAtTime(siren.pan, t, 0.2);
  }

  /**
   * A short musical stinger for the flight moments (src/moments/): 'alert' (something's up), 'ping'
   * (super-hearing), 'spy' (the courier van), 'riddle' (the Puzzle Maker), 'swoop' (the plunge),
   * 'catch' (got it), 'fail', 'smash' (a drone), 'tick' (the clock's last seconds), 'piece' (a riddle
   * solved). Synthesized on the spot: nothing to download, nothing kept.
   */
  sting(name) {
    const g = sfx.enabled && audioGraph();
    if (!g) return;
    const { ctx, out, noise } = g, t0 = ctx.currentTime + 0.01;
    const tone = (f, at, dur, { type = 'triangle', vol = 0.18, to = 0, q = 0 } = {}) => {
      const o = ctx.createOscillator(), a = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0 + at);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
      if (q) { const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = q; vg.gain.value = f * 0.02; v.connect(vg).connect(o.frequency); v.start(t0 + at); v.stop(t0 + at + dur + 0.05); }
      a.gain.setValueAtTime(0.0001, t0 + at); a.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(a).connect(out); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    };
    const hiss = (at, dur, { vol = 0.25, f = 1800, to = 0, type = 'bandpass' } = {}) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), a = ctx.createGain();
      s.buffer = noise; fl.type = type; fl.frequency.setValueAtTime(f, t0 + at); if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
      a.gain.setValueAtTime(vol, t0 + at); a.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      s.connect(fl).connect(a).connect(out); s.start(t0 + at, Math.random() * 0.5); s.stop(t0 + at + dur + 0.05);
    };
    switch (name) {
      case 'alert': tone(659, 0, 0.14, { type: 'square', vol: 0.07 }); tone(880, 0.11, 0.26, { type: 'square', vol: 0.08 }); hiss(0, 0.3, { vol: 0.12, f: 900, to: 3000 }); break;
      case 'ping': tone(1320, 0, 0.6, { type: 'sine', vol: 0.16 }); tone(1320, 0.28, 0.5, { type: 'sine', vol: 0.06 }); tone(1320, 0.52, 0.4, { type: 'sine', vol: 0.025 }); break;
      case 'spy': for (const [f, at] of [[110, 0], [110, 0.16], [131, 0.32], [98, 0.5]]) tone(f, at, 0.14, { type: 'sawtooth', vol: 0.1 }); hiss(0, 0.08, { vol: 0.1, f: 4000 }); break;
      case 'riddle': [523, 622, 784, 740].forEach((f, i) => tone(f, i * 0.16, 0.5, { type: 'triangle', vol: 0.1, q: 6 })); tone(196, 0, 0.9, { type: 'sine', vol: 0.12 }); break;
      case 'swoop': hiss(0, 0.45, { vol: 0.32, f: 600, to: 2600 }); tone(420, 0, 0.42, { type: 'sine', vol: 0.06, to: 140 }); break;
      case 'catch': tone(90, 0, 0.35, { type: 'sine', vol: 0.4, to: 45 }); hiss(0, 0.12, { vol: 0.35, f: 2200, type: 'lowpass' }); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.08 + i * 0.06, 0.32, { vol: 0.12 })); break;
      case 'fail': tone(392, 0, 0.3, { type: 'sawtooth', vol: 0.08, to: 370 }); tone(330, 0.26, 0.5, { type: 'sawtooth', vol: 0.08, to: 262 }); break;
      case 'smash': hiss(0, 0.25, { vol: 0.4, f: 3000, type: 'highpass' }); tone(1800, 0, 0.18, { type: 'square', vol: 0.05, to: 600 }); tone(120, 0, 0.2, { type: 'sine', vol: 0.2, to: 60 }); break;
      case 'tick': tone(1600, 0, 0.05, { type: 'square', vol: 0.05 }); break;
      case 'piece': [988, 1319].forEach((f, i) => tone(f, i * 0.08, 0.3, { vol: 0.14 })); hiss(0, 0.1, { vol: 0.12, f: 5000 }); break;
      default: break;
    }
  }

  /** Mute the loops without tearing them down (pause, map, dialogs). */
  silence() {
    const n = this.nodes;
    if (!n) return;
    const t = n.ctx.currentTime;
    n.windGain.gain.setTargetAtTime(0, t, 0.08);
    n.sirenGain.gain.setTargetAtTime(0, t, 0.08);
  }

  /** Fade out and release everything (leaving the overworld, title screen). */
  stop() {
    const n = this.nodes;
    if (!n) return;
    this.nodes = null;
    const t = n.ctx.currentTime;
    n.windGain.gain.setTargetAtTime(0, t, 0.08);
    n.sirenGain.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => {
      for (const s of [n.src, n.osc, n.lfo, n.rec?.cruise.s, n.rec?.fast.s]) {
        try { s?.stop(); } catch (e) { /* already stopped */ }
      }
    }, 400);
  }
}
