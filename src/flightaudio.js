// Continuous flight audio: a wind loop whose loudness and brightness follow airspeed,
// and a siren from the nearest incident that grows louder (and pans) as she approaches.
import { audioGraph, sfx } from './sfx.js';

export class FlightAudio {
  start() {
    if (this.nodes) return;
    const g = audioGraph();
    if (!g) return;
    const { ctx, out, noise } = g;
    // Wind: looped noise → band-pass (brightness) → gain (loudness)
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 0.7; band.frequency.value = 400;
    const windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(band).connect(windGain).connect(out);
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
    this.nodes = { ctx, src, band, windGain, osc, lfo, sirenGain, pan };
  }

  /**
   * @param speedFrac 0..1 airspeed
   * @param siren {vol 0..1, pan -1..1} for the nearest incident, or null
   * @param inCloud 0..1 — muffles the wind inside a cloud
   */
  update(speedFrac, siren, inCloud = 0) {
    const n = this.nodes;
    if (!n) return;
    const t = n.ctx.currentTime, on = sfx.enabled ? 1 : 0;
    n.windGain.gain.setTargetAtTime(on * (0.03 + 0.32 * speedFrac * speedFrac) * (1 - 0.4 * inCloud), t, 0.15);
    n.band.frequency.setTargetAtTime(Math.max(150, 300 + 2600 * speedFrac - 900 * inCloud), t, 0.2);
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
    setTimeout(() => { try { n.src.stop(); n.osc.stop(); n.lfo.stop(); } catch (e) { /* already stopped */ } }, 400);
  }
}
