// The feel (round 11 L2b): the beats of the loop as events, and a HUD that stays readable.
// - Spotted: the floor goes quiet (crowd bubbles, tap bubbles, tips and toasts cleared, new crowd
//   lines held for a moment), a thick red edge, a SPOTTED! stamp, the screens cut to her at once.
//   Shaking them off gets a LOST THEM! stamp.
// - The bubble cap: the crowd may talk, but at most L2B.cap bubbles at once (the tap bubbles count),
//   a beat apart, pushed apart so they never overlap each other, the title card, the LIVE panel or
//   the tip. Nobody's lines are edited: the gate only decides how many show (comic.gate).
// - The grab: an alerted bouncer's hands on her, a beat of slow motion with the camera pushed in, a
//   white flash, then the struggle (or the sedation) as before.
// Mixed into Club3D.prototype.
import * as THREE from 'three';
import { comic } from '../comic.js';
import { quality } from '../settings.js';
import { clearToasts, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { clamp, pick, $ } from '../util.js';

export const L2B = {
  cap: 2,           // crowd bubbles on screen at once (tap bubbles included)
  gap: 0.7,         // s between two crowd bubbles popping
  quiet: 2.8,       // s the crowd holds its tongue once she's made
  grab: { hold: 0.85, slow: [0.35, 0.7], push: 0.42 }, // s of the grab beat, its slow motion, the camera push
};
// her silhouette through the crowd: colour, halftone cell (px) and dot radius (of a cell), draw order
const SIL = { col: 0x6fd4ff, cell: 4, dot: 0.36, order: 30 };
const SPOT_W = ['SPOTTED!', 'MADE!', 'BUSTED!'];
const LOST_W = ['LOST THEM!', 'GONE!', 'SHAKEN!'];
// what bubbles keep clear of: the title card, the stats, the LIVE panel (and the corner buttons), the tip
const AVOID = '#hud-top, #hud-left, #hud-right, #c3-tip.on, #prompt.on, #c3-stamp.on, #c3-talk.on, #btns .tbtn, #stick-base';

export const feelFxMethods = {
  startFeelFx() {
    this.quietT = 0; this.sayAt = -9; this.grabK = 0; this.grabbing = false; this._avoidT = -9;
    comic.gate = (text, kind, o) => this.bubbleGate(kind, o || {});
  },

  endFeelFx() {
    if (comic.gate) comic.gate = null;
    $('c3-stamp')?.classList.remove('on');
  },

  /** comic.say asks first: false = this bubble doesn't show. Named voices (prio 1) always speak. */
  bubbleGate(kind, o) {
    if (!this.scene || this.done || this.g.modeName !== 'club3') return true;
    if ((o.prio || 0) >= 1) return true;
    if (this.quietT > 0) return false;
    const own = kind === 'shout' || kind === 'thought'; // (her own voice, the incidents' point)
    if (!own && this.tipOn) return false;               // (one transient layer at a time)
    if (!own && this.t - this.sayAt < L2B.gap) return false;
    const live = [...($('comic-layer')?.querySelectorAll('.bubble:not(.out)') || [])];
    const n = live.length + (this.taps || []).filter((b) => !b.gone).length;
    if (n >= L2B.cap) {
      if (!own) return false;
      // she gets to speak: the oldest crowd line makes way
      const old = live.find((el) => el.dataset.k !== '1' && !el.classList.contains('shout') && !el.classList.contains('thought'));
      if (!old) return false;
      old.classList.add('out'); setTimeout(() => old.remove(), 300);
    }
    this.sayAt = this.t;
    return true;
  },

  /** As many bubbles up as the cap allows (crowd + tap bubbles)? */
  bubblesFull() {
    const n = ($('comic-layer')?.querySelectorAll('.bubble:not(.out)').length || 0) + (this.taps || []).filter((b) => !b.gone).length;
    return n >= L2B.cap;
  },

  /** Per frame (the HUD pass): bubbles apart, clear of the title card and the LIVE panel. */
  layoutBubbles() {
    const L = $('comic-layer');
    if (!L) return;
    const els = [...L.querySelectorAll('.bubble:not(.out)')];
    if (!els.length) return;
    const now = performance.now();
    if (now - this._avoidT > 250) {
      this._avoidT = now;
      this._avoid = [...document.querySelectorAll(AVOID)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    }
    const H = innerHeight, taken = [...this._avoid];
    for (const b of this.taps || []) if (!b.gone && b.el.isConnected) taken.push(b.el.getBoundingClientRect());
    const hit = (x, y, w, h) => taken.some((r) => x < r.right + 4 && x + w > r.left - 4 && y < r.bottom + 4 && y + h > r.top - 4);
    for (const el of els) {
      const x = parseFloat(el.style.left) || 0, y0 = parseFloat(el.style.top) || 0, w = el.offsetWidth, h = el.offsetHeight;
      let dy = null;
      for (let i = 0; i <= 8 && dy == null; i++) {
        for (const s of i ? [-1, 1] : [1]) {
          const d = s * i * (h * 0.5 + 6), y = y0 + d;
          if (y < 50 || y + h > H - 6) continue;
          if (!hit(x, y, w, h)) { dy = d; break; }
        }
      }
      if (dy == null) { if (el.dataset.k !== '1') { el.classList.add('out'); setTimeout(() => el.remove(), 300); continue; } dy = el._dy || 0; }
      // (ease, so a bubble slides out of the way instead of jumping)
      el._dy = el._dy == null ? dy : el._dy + (dy - el._dy) * 0.35;
      el.style.marginTop = `${Math.round(el._dy)}px`;
      taken.push({ left: x, right: x + w, top: y0 + dy, bottom: y0 + dy + h });
    }
  },

  /** Clear the floor's chatter: crowd bubbles, tap bubbles, the tip, the toasts. Named voices stay. */
  hushFloor() {
    for (const el of $('comic-layer')?.querySelectorAll('.bubble') || []) {
      if (el.dataset.k === '1') continue;
      el.classList.add('out'); setTimeout(() => el.remove(), 300);
    }
    for (const b of [...(this.taps || [])]) this.dropBubble(b);
    if (this.tipOn) { clearTimeout(this.tipTimer); this.tipOn = false; $('c3-tip')?.classList.remove('on'); setTimeout(() => !this.done && !this.tipOn && this.nextTip(), 3200); }
    clearToasts();
  },

  /** A comic stamp across the top of the frame (SPOTTED!, LOST THEM!). */
  stamp(word, kind) {
    let el = $('c3-stamp');
    if (!el) { el = document.createElement('div'); el.id = 'c3-stamp'; $('game').insertBefore(el, $('comic-layer')); }
    el.className = ''; el.textContent = word; void el.offsetWidth;
    el.className = `on s-${kind}`;
    clearTimeout(this._stampT);
    this._stampT = setTimeout(() => el.classList.remove('on'), kind === 'spot' ? 1500 : 1900);
  },

  /** "!" (tension.spotted calls this after its sting): the event. */
  spotEvent() {
    this.hushFloor();
    this.quietT = L2B.quiet;
    this.stamp(pick(SPOT_W), 'spot');
    const v = this.vigEl?.();
    if (v?.s) { v.s.classList.remove('go'); void v.s.offsetWidth; v.s.classList.add('go'); }
    // the screens go to her now (the cut's row glitch still plays), not after the ease
    this.cctvHold = Math.max(this.cctvHold || 0, 3); this.cctvWant = true;
    this.cctvK = Math.max(this.cctvK || 0, 0.55); this.cctvT = 0;
  },

  /** Shook them off (tension.lostThem). */
  lostEvent() { this.stamp(pick(LOST_W), 'lost'); },

  /**
   * Her ink silhouette through whatever stands in front of her: a second draw of her meshes, drawn
   * after the world and the crowd but before her (renderOrder), depth test inverted, as halftone dots in
   * her blue. Where she's in plain view her own draw paints over it; where a dancer covers her, the dots
   * stay. (Before her own draw, so her own body never shows through itself.)
   */
  buildSilhouette() {
    const M = this.heroModel;
    if (!M || this._sil) return;
    const mat = new THREE.MeshBasicMaterial({ color: SIL.col, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false, toneMapped: false });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', `void main() {
  { vec2 c = gl_FragCoord.xy / ${SIL.cell.toFixed(1)}; vec2 f = fract(vec2(c.x + 0.5 * floor(c.y), c.y)) - 0.5; if (dot(f, f) > ${(SIL.dot * SIL.dot).toFixed(3)}) discard; }`);
    };
    const sils = [];
    const add = (o) => {
      const s = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, mat) : new THREE.Mesh(o.geometry, mat);
      if (o.isSkinnedMesh) { s.bind(o.skeleton, o.bindMatrix); s.bindMode = o.bindMode; }
      if (o.morphTargetInfluences) { s.morphTargetInfluences = o.morphTargetInfluences; s.morphTargetDictionary = o.morphTargetDictionary; }
      s.userData.ink = true; s.userData.sil = true; s.frustumCulled = false; s.raycast = () => {};
      s.renderOrder = SIL.order - 1;
      o.add(s); sils.push(s);
    };
    const own = [];
    M.root.traverse((o) => { if (o.isMesh) own.push(o); });
    for (const o of own) {
      o.renderOrder = SIL.order; // (she draws after the silhouette: her pixels cover it where she's seen)
      if (!o.userData.ink && o.geometry?.attributes?.position && !(o.material?.transparent)) add(o);
    }
    this._sil = { mat, sils };
  },

  /** On while she's on the floor with people round her (nothing to see through otherwise). */
  stepSilhouette() {
    if (!this._sil) { if (quality().club3?.sil === false) return; this.buildSilhouette(); if (!this._sil) return; }
    const on = !this.done && !this.sub && ((this.cover || 0) >= 1 || (this.crowdThick || 0) >= 1 || this.idleRing || this.knotHost?.().knot);
    if (on === this._sil.on) return;
    this._sil.on = !!on;
    for (const s of this._sil.sils) s.visible = !!on;
  },

  stepFeelFx(dt) {
    this.stepSilhouette();
    if (this.quietT > 0) this.quietT -= dt;
    this.grabK = clamp((this.grabK || 0) + (this.grabbing ? dt * 6 : -dt * 3), 0, 1);
  },

  /** Game-time wait (a harness screenshot or a pause doesn't eat the beat). */
  waitGame(s) {
    const t0 = this.t;
    return new Promise((res) => {
      const tick = () => { if (this.done || !this.scene || this.t - t0 >= s) return res(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  },

  /**
   * The grab, shown: he steps in and gets his hands on her (his punch held at full reach on her arm),
   * she flinches, the camera pushes in on the two of them in slow motion, a white flash, then foundOut.
   */
  async grabBeat(gd, reason) {
    if (this.grabbing || this.done || this.sedating) return;
    this.grabbing = true; this.busy = true;
    const m = gd.mesh, h = this.hero.position, E = m.enemy;
    gd.grabbed = true;
    try {
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz) || 1;
      m.position.x = h.x - (dx / d) * 0.6; m.position.z = h.z - (dz / d) * 0.6;
      m.rotation.y = Math.atan2(dx, dz);
      this.hero.rotation.y = Math.atan2(-dx, -dz); // (she turns into it)
      this.grabAt = { x: (h.x + m.position.x) / 2, z: (h.z + m.position.z) / 2 };
      if (E) E.play('punch', { fade: 0.06, speed: 1.5 });
      this.heroModel?.play('pain', { fade: 0.08 });
      this.stunT = Math.max(this.stunT || 0, 1.2);
      this.slowMo(...L2B.grab.slow);
      this.kick?.(0.8);
      sfx.punch?.();
      const s = this.screenOf({ x: this.grabAt.x, y: h.y, z: this.grabAt.z }, 1.35);
      if (s) comic.pow('GRAB!', s.x, s.y, { size: 0.85, colors: ['#ffffff', '#ff2a2a'] });
      await this.waitGame(0.22);
      const a = E?.actions?.punch;
      if (a) a.paused = true; // (his hands stay on her)
      await this.waitGame(L2B.grab.hold - 0.22);
      flash('#ffffff');
      if (a) a.paused = false;
    } finally {
      this.grabbing = false; this.busy = false; gd.grabbed = false;
    }
    if (!this.done) this.foundOut(reason);
  },
};
