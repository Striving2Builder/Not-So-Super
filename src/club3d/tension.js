// Tension (round 11, the club loop): what the danger feels like. One number, `threat` (0..1: the
// most worried bouncer, the floor's alert), drives a heartbeat on the music's own beats (every
// other beat, then every beat), the club going muffled round her, and a red edge pulsing with the
// heart. The beats of the loop get their moment: a bouncer making her (a sting, a camera punch, the
// screens cut to her on CCTV), a "?" that nearly filled and fizzles (a close call: relief, a hint
// of slow motion, a yellow caption), and shaking a search off ("lost them"). Synth only, no
// samples. Mixed into Club3D.prototype.
import { audioGraph, sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { pick, clamp, $ } from '../util.js';

export const TENSION = {
  hb: [0.16, 0.6],       // a heartbeat from this much threat, every other beat; every beat from the second
  vig: 0.85,             // the red edge's opacity at full threat
  muffle: 0.45,          // the club's low-pass at full threat (super-hearing is 1)
  slow: { close: [0.4, 0.75], spot: [0.45, 0.55] }, // [time scale, seconds] of the slow-motion beat
  gap: 8,                // s between two close calls (a beat, not a stutter)
};
const CLOSE = ['Too close.', 'Phew. Still a ghost.', 'That was close.', 'Not tonight, pal.', 'Breathe, Kara. Breathe.', 'He looked right at her. And saw a dancer.'];
const LOST = ['Lost them.', 'Gone. Like she was never here.', 'Back in the crowd. Back in the game.', 'They\'ve lost the cape.'];

// ---- the synth voices (straight into the game's audio graph)
function voices() {
  const G = sfx.enabled === false ? null : audioGraph();
  return G ? { ctx: G.ctx, out: G.out, noise: G.noise, t: G.ctx.currentTime } : null;
}
function blip(V, f, f2, dur, vol, type = 'sine', delay = 0) {
  const { ctx, out } = V, t = V.t + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(V, f0, f1, dur, vol, delay = 0) {
  const { ctx, out, noise } = V, t = V.t + delay, s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}
export const TSFX = {
  /** lub-dub, low and round */
  heart(vol) { const V = voices(); if (!V) return; blip(V, 95, 52, 0.2, vol); blip(V, 80, 44, 0.18, vol * 0.7, 'sine', 0.17); },
  /** the "?" climbing: a soft rising tick (25 / 50 / 75 %) */
  tick(step) { const V = voices(); if (!V) return; blip(V, 480 + step * 140, 560 + step * 160, 0.09, 0.07, 'triangle'); },
  /** made: a bright two-note stab over a low hit */
  spot() { const V = voices(); if (!V) return; blip(V, 70, 40, 0.5, 0.5); hiss(V, 900, 3000, 0.18, 0.35); blip(V, 660, 0, 0.09, 0.16, 'square'); blip(V, 990, 0, 0.32, 0.16, 'square', 0.085); },
  /** relief: an air-out whoosh and a warm chord */
  relief() { const V = voices(); if (!V) return; hiss(V, 3200, 260, 0.75, 0.22); for (const [f, d] of [[262, 0.05], [330, 0.09], [392, 0.13], [494, 0.17]]) blip(V, f, f * 0.985, 0.9, 0.05, 'sine', d); },
  /** lost them: the relief, brighter, going up */
  lost() { const V = voices(); if (!V) return; hiss(V, 400, 2400, 0.5, 0.16); for (const [f, d] of [[392, 0], [494, 0.07], [587, 0.14], [784, 0.21]]) blip(V, f, 0, 0.5, 0.06, 'triangle', d); },
};

export const tensionMethods = {
  /** Per frame (after the guards): the threat, the heartbeat on the beat, the edge, the events. */
  stepTension(dt) {
    const gs = this.guards || [];
    let worst = 0, hunted = false, searching = false;
    for (const gd of gs) {
      if (gd.ko) continue;
      const w = gd.st === 'alert' ? 1 : gd.st === 'search' ? 0.5 + gd.sus * 0.003 : (gd.sus || 0) / 100 * 0.85;
      worst = Math.max(worst, w);
      if (gd.st === 'alert') hunted = true;
      if (gd.st === 'search') searching = true;
    }
    worst = Math.max(worst, (this.alert || 0) / 100, (this.scandal || 0) / 120);
    if (this.busy || this.sub || this.done || this.escapeT > 0) worst *= 0.3;
    // quick to rise, slow to settle
    this.threat = (this.threat || 0) + (worst - (this.threat || 0)) * Math.min(1, dt * (worst > (this.threat || 0) ? 6 : 1.2));
    const T = this.threat;
    // the heart, on the track's beats (its own clock), louder and faster with the threat
    const B = this.B;
    if (B && B.n !== this._hbN) {
      this._hbN = B.n;
      if (T > TENSION.hb[0] && (T > TENSION.hb[1] || B.n % 2 === 0) && !this.sub && !this.done) {
        TSFX.heart(0.18 + 0.5 * T);
        this.pulseAt = this.t;
      }
    }
    // the "?" climbing over the worst head: a tick at each quarter
    const top = gs.reduce((m, gd) => (gd.ko || gd.st === 'alert' ? m : Math.max(m, gd.sus || 0)), 0);
    const q = Math.floor(top / 25);
    if (q > (this._susQ || 0) && q < 4 && !this.busy) TSFX.tick(q);
    this._susQ = q;
    // the red edge, beating with the heart
    const vig = this.vigEl();
    if (vig) {
      const pulse = Math.exp(-Math.max(0, this.t - (this.pulseAt ?? -9)) * 5);
      const o = this.done || this.sub ? 0 : clamp((T - 0.1) * 1.15, 0, 1) * TENSION.vig * (0.55 + 0.45 * pulse);
      if (Math.abs(o - (vig._o || 0)) > 0.01) { vig._o = o; vig.r.style.opacity = o.toFixed(2); }
    }
    // the screens: on her while she's made (or the floor's alert is up), back to the show once she's shaken them
    const hot = hunted || (this.alert || 0) >= 75;
    this.cctvHold = hot ? 1.5 : Math.max(0, (this.cctvHold || 0) - dt);
    this.cctvWant = this.cctvHold > 0 && !this.escapeT;
    // lost them: she was made (or the alert ran high), and now nobody's looking and the alert's down
    if (hunted || (this.alert || 0) >= 55) this.wasHot = true;
    else if (this.wasHot && (this.alert || 0) < 6 && !searching && !this.done && !this.busy) { this.wasHot = false; this.lostThem(); }
  },

  /** The muffle the club's music takes from the threat (super-hearing's is 1). */
  tensionMuffle() { return clamp(((this.threat || 0) - 0.3) / 0.7, 0, 1) * TENSION.muffle; },

  vigEl() {
    if (this._vig?.isConnected) return this._vig;
    const host = $('game');
    if (!host) return null;
    const el = document.createElement('div');
    el.id = 'c3-vig';
    el.innerHTML = '<i class="r"></i><i class="c"></i><i class="s"></i>';
    host.insertBefore(el, $('hud'));
    el.r = el.querySelector('.r'); el.c = el.querySelector('.c'); el.s = el.querySelector('.s');
    return (this._vig = el);
  },

  /** A beat of slow motion: the world at `k` speed for `secs`, easing back. */
  slowMo(k, secs) { this.slowK = k; this.slowT = secs; this.slowDur = secs; },
  /** The update's time scale this frame (real dt in, scaled dt out). */
  timeScale(dt) {
    if (!(this.slowT > 0)) return 1;
    this.slowT -= dt;
    const u = clamp(1 - this.slowT / this.slowDur, 0, 1);
    return this.slowK + (1 - this.slowK) * u * u;
  },
  /** A camera punch (k 0..1): the FOV snaps in and eases out, a little shake. */
  kick(k = 1) { this.kickK = Math.max(k, this.kickK && this.t - this.kickAt < 0.4 ? this.kickK : 0); this.kickAt = this.t; },

  /** "!": a bouncer has made her. */
  spotted(gd) {
    TSFX.spot();
    this.kick(1);
    this.slowMo(...TENSION.slow.spot);
    this.pulseAt = this.t;
    const s = this.screenOf(gd.mesh.position, 2.6);
    if (s) comic.pow('!', s.x, s.y - 10, { size: 0.55, colors: ['#ffe040', '#ff2a2a'] });
    this.spotEvent?.();
    this.selfTalk?.('spotted');
  },

  /** A "?" that nearly filled and fizzled, or the alert dropping off the top: a close call. */
  closeCall() {
    if (this.t - (this.closeAt ?? -99) < TENSION.gap || this.done) return;
    this.closeAt = this.t;
    TSFX.relief();
    this.slowMo(...TENSION.slow.close);
    comic.caption(pick(CLOSE), { ms: 2600 });
    const v = this.vigEl();
    if (v) { v.c.classList.remove('go'); void v.c.offsetWidth; v.c.classList.add('go'); }
    this.selfTalk?.('close');
  },

  lostThem() {
    TSFX.lost();
    this.lostEvent?.();
    comic.caption(pick(LOST), { ms: 2600 });
    const v = this.vigEl();
    if (v) { v.c.classList.remove('go'); void v.c.offsetWidth; v.c.classList.add('go'); }
    this.closeAt = this.t;
  },

  endTension() { this._vig?.remove(); this._vig = null; this.threat = 0; },
};
