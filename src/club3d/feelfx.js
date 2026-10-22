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
  quiet: 2.8,       // s nobody but her and the bouncers talks once she's made (and while any bouncer's after her)
  stamp: [1.4, 1.8], edge: 1.6, // s of game time: the SPOTTED! / LOST THEM! stamps, the thick red edge
  grab: { hold: 0.85, slow: [0.35, 0.7], push: 0.42 }, // s of the grab beat, its slow motion, the camera push
};
// her silhouette through the crowd: colour, halftone cell (px) and dot radius (of a cell), draw order
const SIL = { col: 0x6fd4ff, cell: 4, dot: 0.36, order: 30 };
const SPOT_W = ['SPOTTED!', 'MADE!', 'BUSTED!'];
const LOST_W = ['LOST THEM!', 'GONE!', 'SHAKEN!'];
// what bubbles keep clear of: the title card, the stats, the LIVE panel (and the corner buttons), the tip
const AVOID = '#hud-top, #hud-left, #hud-right, #objectives, #c3-tip.on, #prompt.on, #c3-stamp.on, #c3-talk.on, #btns .tbtn, #stick-base';

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
    const own = kind === 'shout' || kind === 'thought'; // (her own voice, the incidents' point)
    if (this.quietT > 0 || (!own && this.hunted())) return false;
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

  /** A bouncer has made her and is after her (no crowd chatter through a chase). */
  hunted() { return (this.guards || []).some((gd) => gd.st === 'alert' && !gd.ko); },

  /** As many bubbles up as the cap allows (crowd + tap bubbles)? */
  bubblesFull() {
    const n = ($('comic-layer')?.querySelectorAll('.bubble:not(.out)').length || 0) + (this.taps || []).filter((b) => !b.gone).length;
    return n >= L2B.cap;
  },

  /**
   * Per frame (the HUD pass): every bubble on screen (the comic layer's and the tap bubbles) apart from
   * each other and clear of the title card, the stats, the LIVE panel and the tip. Her own voice and
   * named voices are placed first, then the tap bubbles, then the crowd; a crowd bubble with no room goes.
   */
  layoutBubbles() {
    const L = $('comic-layer');
    const els = L ? [...L.querySelectorAll('.bubble:not(.out)')] : [];
    const taps = (this.taps || []).filter((b) => !b.gone && b.el.isConnected && b.by != null);
    const now = performance.now();
    if (now - this._avoidT > 250 || !this._avoid) { // (also read by the X-ray LEAD beacon, stealth.js)
      this._avoidT = now;
      this._avoid = [...document.querySelectorAll(AVOID)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    }
    if (!els.length && !taps.length) return;
    const W = innerWidth, H = innerHeight, taken = [...this._avoid];
    // and her: nobody's line sits on top of the girl the player is steering
    const hp = this.hero?.position, f = hp && this.screenOf(hp, 0), t = hp && this.screenOf(hp, 1.75);
    if (f && t && f.y > t.y) { const hw = (f.y - t.y) * 0.24; taken.push({ left: t.x - hw, right: t.x + hw, top: t.y - 4, bottom: f.y }); }
    const hit = (x, y, w, h) => taken.some((r) => x < r.right + 4 && x + w > r.left - 4 && y < r.bottom + 4 && y + h > r.top - 4);
    const ok = (x, y, w, h) => x >= 6 && x + w <= W - 6 && y >= 50 && y + h <= H - 6 && !hit(x, y, w, h);
    // the nearest free spot (last frame's first, so nothing jitters): up or down, or a step to either side
    const fit = (x, y0, w, h, last) => {
      if (last && ok(x + last[0], y0 + last[1], w, h)) return last;
      let best = null, bd = 1e9;
      for (const dx of [0, -(w * 0.55 + 8), w * 0.55 + 8, -(w + 12), w + 12]) {
        for (let k = -Math.floor(y0 / 16), dy; (dy = k * 16) < H - y0; k++) {
          const d = Math.abs(dx) * 0.5 + Math.abs(dy); // (beside her beats far below her)
          if (d < bd && ok(x + dx, y0 + dy, w, h)) { best = [dx, dy]; bd = d; }
        }
      }
      return best;
    };
    const own = (el) => el.dataset.k === '1' || el.classList.contains('shout') || el.classList.contains('thought');
    const items = [
      ...els.filter(own).map((el) => ({ el, keep: true })),
      ...taps.map((b) => ({ b })),
      ...els.filter((el) => !own(el)).map((el) => ({ el })),
    ];
    for (const it of items) {
      const o = it.b || it.el;
      let x, y0, w, h;
      if (it.b) ({ bx: x, by: y0, bw: w, bh: h } = it.b);
      else { x = parseFloat(o.style.left) || 0; y0 = parseFloat(o.style.top) || 0; w = o.offsetWidth; h = o.offsetHeight; }
      let d = fit(x, y0, w, h, o._t);
      // a whisper is the clue she turned hearing on to catch: park it in the open rather than delete it
      if (!d && it.b?.keep) {
        const Wg = this.g?.w || W, Hg = this.g?.h || H;
        it.b.bx = clamp((Wg - w) / 2, 8, Math.max(8, Wg - w - 8));
        it.b.by = clamp(Hg * 0.34, 64, Math.max(64, Hg - h - 80));
        x = it.b.bx; y0 = it.b.by;
        d = fit(x, y0, w, h, null) || [0, 0];
      }
      if (!d) {
        if (it.b) { this.dropBubble(it.b); continue; }
        if (!it.keep) { o.classList.add('out'); setTimeout(() => o.remove(), 300); continue; }
        d = o._t || [0, 0];
      }
      o._t = d;
      // (ease, so a bubble slides out of the way instead of jumping)
      o._dx = o._dx == null ? d[0] : o._dx + (d[0] - o._dx) * 0.35;
      o._dy = o._dy == null ? d[1] : o._dy + (d[1] - o._dy) * 0.35;
      if (it.b) o.el.style.transform = `translate(${Math.round(x + o._dx)}px,${Math.round(y0 + o._dy)}px)`;
      else { o.style.marginTop = `${Math.round(o._dy)}px`; o.style.marginLeft = `${Math.round(o._dx)}px`; }
      taken.push({ left: x + d[0], right: x + d[0] + w, top: y0 + d[1], bottom: y0 + d[1] + h });
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
    this.stampT = kind === 'spot' ? L2B.stamp[0] : L2B.stamp[1]; // (game time: stepFeelFx takes it down)
  },

  /** "!" (tension.spotted calls this after its sting): the event. */
  spotEvent() {
    this.hushFloor();
    this.quietT = L2B.quiet;
    this.stamp(pick(SPOT_W), 'spot');
    this.edgeT = L2B.edge;
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
      const cell = SIL.cell * Math.max(1, this.renderer?.getPixelRatio?.() || 1); // (dots the same size on a phone's dense screen)
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', `void main() {
  { vec2 c = gl_FragCoord.xy / ${cell.toFixed(1)}; vec2 f = fract(vec2(c.x + 0.5 * floor(c.y), c.y)) - 0.5; if (dot(f, f) > ${(SIL.dot * SIL.dot).toFixed(3)}) discard; }`);
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
    // the stamp and the red edge run on game time (a phone's 1.5 s, a harness frame's too)
    if (this.stampT > 0 && (this.stampT -= dt) <= 0) $('c3-stamp')?.classList.add('out');
    if (this.edgeT > 0 || this._edgeO) {
      this.edgeT = Math.max(0, (this.edgeT || 0) - dt);
      const u = 1 - this.edgeT / L2B.edge, o = this.edgeT > 0 ? Math.min(1, u * 10) * (1 - u * u * 0.9) : 0;
      const s = this.vigEl?.()?.s;
      if (s) s.style.opacity = o.toFixed(2);
      this._edgeO = o > 0;
    }
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
      // he's on her from behind, on the far side from the lens (the camera always looks north), a little
      // off to his side of her so both read: she faces us, flinching, his hand on her shoulder
      const side = Math.sign(m.position.x - h.x) || 1;
      m.position.x = h.x + side * 0.22; m.position.z = h.z - 0.5;
      m.rotation.y = Math.atan2(h.x - m.position.x, h.z - m.position.z);
      this.hero.rotation.y = 0; this.facing = true;
      this.grabAt = { x: (h.x + m.position.x) / 2, z: (h.z + m.position.z) / 2 };
      if (E) E.play('punch', { fade: 0.06, speed: 1.5 });
      this.heroModel?.play('pain', { fade: 0.08 });
      this.stunT = Math.max(this.stunT || 0, 1.2);
      this.slowMo(...L2B.grab.slow);
      this.kick?.(0.8);
      sfx.punch?.();
      const s = this.screenOf({ x: this.grabAt.x, y: h.y, z: this.grabAt.z }, 1.35);
      if (s) comic.pow('GRAB!', s.x, s.y, { size: 0.85, colors: ['#ffffff', '#ff2a2a'] });
      this.stamp('GRABBED!', 'spot');
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
