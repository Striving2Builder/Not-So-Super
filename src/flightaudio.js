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
