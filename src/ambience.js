// Background beds per game mode, looped recordings from assets/audio/game/: the crime scene under an
// investigation (police-radio chatter drifts in now and then), a sub drone in the asylum and in
// captivity, street noise under a fight. Quiet under everything, silent while a menu or dialog is up
// or with sound off. A bed's decoded audio is dropped when its mode is left (iOS memory).
import { audioGraph, dropSample, loadSample, playSample, sfx } from './sfx.js';
import { rand } from './util.js';

/** game mode → bed. vol is the mix level (the loops are RMS-normalised to -20 dBFS). */
const BEDS = {
  investigate: { file: 'crime-scene.wav', vol: 0.5, radios: true },
  asylum: { file: 'drone.wav', vol: 0.7 },
  captured: { file: 'drone.wav', vol: 0.7 },
  brawler: { file: 'street.wav', vol: 0.35 },
};
const RADIOS = ['radio1.mp3', 'radio2.mp3'];
const RADIO = { vol: 0.4, first: [4, 8], every: [14, 30] }; // seconds

let bus = null, busOn = -1, bed = null, radioT = 0;

/** The ambience bus (→ master), gated by pause and the sound toggle. null if audio is unavailable. */
function ensureBus() {
  if (!bus) {
    const g = audioGraph();
    if (!g) return null;
    bus = g.ctx.createGain(); bus.gain.value = 0; bus.connect(g.out);
  }
  return bus;
}

function stopBed(b) {
  if (!b) return;
  b.gone = true;
  if (b.node) {
    const { s, g } = b.node;
    g.gain.setTargetAtTime(0, g.context.currentTime, 0.25);
    setTimeout(() => { try { s.stop(); } catch (e) { /* already stopped */ } }, 1200);
  }
  dropSample(b.cfg.file);
  if (b.cfg.radios) RADIOS.forEach(dropSample);
}

export const ambience = {
  /** The bed that's playing (its file), or null. For the harness / perf readout. */
  get playing() { return bed?.node ? bed.cfg.file : null; },

  /** Switch to the bed for game mode `name` (none for modes without one). Called on every mode switch. */
  setMode(name) {
    const cfg = BEDS[name] || null;
    if (bed && cfg && bed.cfg.file === cfg.file) { bed.cfg = cfg; return; } // asylum ↔ captured: the drone carries on
    stopBed(bed);
    bed = null;
    if (!cfg || !ensureBus()) return;
    const b = bed = { cfg, node: null, gone: false };
    radioT = rand(...RADIO.first);
    if (cfg.radios) RADIOS.forEach(loadSample);
    loadSample(cfg.file).then((buf) => {
      if (!buf || b.gone) return;
      const ctx = bus.context, s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf; s.loop = true;
      g.gain.value = 0; g.gain.setTargetAtTime(cfg.vol, ctx.currentTime, 0.6);
      s.connect(g).connect(bus);
      s.start(0, Math.random() * buf.duration);
      b.node = { s, g };
    });
  },

  /** Per frame. paused: a menu or dialog is open (or graphics are restoring). */
  update(dt, paused) {
    if (!bus) return;
    const on = sfx.enabled && !paused && bed ? 1 : 0;
    if (on !== busOn) { busOn = on; bus.gain.setTargetAtTime(on, bus.context.currentTime, on ? 0.4 : 0.08); }
    if (!on || !bed?.cfg.radios || (radioT -= dt) > 0) return;
    radioT = rand(...RADIO.every);
    // a radio somewhere around the scene: random take, side and a touch of pitch
    const ctx = bus.context, pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = rand(-0.7, 0.7); pan.connect(bus); }
    playSample(RADIOS[Math.floor(Math.random() * RADIOS.length)], RADIO.vol, rand(0.97, 1.03), pan || bus);
  },
};
