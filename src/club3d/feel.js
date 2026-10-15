// Feel (docs/design/nightclub.md "Look and feel"): a ring on the floor round her feet that fills as
// the crowd hides her (red in the open, gold in the crowd, cyan when she's lost in it, flashing
// while a bouncer has eyes on her), and first-visit tips, each shown once (per device, not per
// save: they're about what the player knows). The bouncers' searching lives in stealth.js now.
import * as THREE from 'three';
import { $ } from '../util.js';
import { floorY } from './plan.js';
import { INTOX_HAZE } from '../state.js';

const TIPS_KEY = 'supergirl-club3-tips';
const TIPS = {
  // (r11 L2b: one line each, the critic's "HUD diet")
  talker: 'Stand in the ring to overhear. Gold = evidence, red = they notice you.',
  seen: 'Made! Break his sight: the crowd (cyan ring), a wall, or the drop.',
  sus: 'The ? fills while he sees you. Into the crowd or out of his cone.',
  takedown: 'His back is to you: USE drops him. Crowds film it.',
  drop: 'At the drop the strobe blinds the bouncers for a few seconds.',
  xray: 'X-ray: blue calm, amber suspicious, red after you. Drains power.',
  intox: "Tipsy: chatter scrambles, Talkers stop making sense. It wears off.",
  clue: 'Clues go on the CASE board. Enough of them: accuse, or go to the owner.',
};
let seenTips = null;
const tipsSeen = () => {
  if (!seenTips) { try { seenTips = new Set(JSON.parse(localStorage.getItem(TIPS_KEY)) || []); } catch (e) { seenTips = new Set(); } }
  return seenTips;
};

const COLS = { open: new THREE.Color(0xff5a3a), crowd: new THREE.Color(0xffd84d), hidden: new THREE.Color(0x3de0ff), seen: new THREE.Color(0xff1a3a) };

function ringMat() {
  return new THREE.ShaderMaterial({
    uniforms: { fill: { value: 0 }, col: { value: new THREE.Color() }, k: { value: 0.6 }, t: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float fill, k, t; uniform vec3 col; varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5;
  float a = fract(atan(p.x, -p.y) / 6.2831853 + 1.0);          // 0 at the top (toward the stage), clockwise
  float on = step(a, fill), tick = step(0.9, fract(a * 12.0));  // the filled arc, notches every 30 degrees
  gl_FragColor = vec4(col * k * (0.22 + 0.78 * on) * (1.0 - tick * 0.6), 1.0);
  #include <colorspace_fragment>
}`,
  });
}

export const feelMethods = {
  // ---- the cover ring
  stepCoverRing(dt) {
    const h = this.hero.position;
    if (!this.coverRing) {
      this.coverRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.78, 48).rotateX(-Math.PI / 2), ringMat());
      this.coverRing.renderOrder = 3;
      this.scene.add(this.coverRing);
    }
    const r = this.coverRing, U = r.material.uniforms, seen = this.guards.some((g) => g.seeing);
    r.position.set(h.x, floorY(this.plan, h.x, h.z) + 0.05, h.z);
    const b = this.blend || 0;
    U.fill.value += (b - U.fill.value) * Math.min(1, dt * 6);
    U.col.value.copy(seen ? COLS.seen : b >= 0.75 ? COLS.hidden : b > 0.3 ? COLS.crowd : COLS.open);
    U.k.value = seen ? 0.55 + 0.45 * Math.abs(Math.sin(this.t * 9)) : this.busy || this.sub ? 0 : 0.55;
    r.visible = !this.done;
  },

  /** Can someone walk straight from a to b (nothing solid on the way)? */
  clearPath(a, b) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 0.5);
    for (let i = 1; i < n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      if (this.colliders.some((c) => !c.disabled && x > c.minX - 0.3 && x < c.maxX + 0.3 && z > c.minZ - 0.3 && z < c.maxZ + 0.3)) return false;
    }
    return true;
  },

  // ---- first-visit tips
  stepTips() {
    if (this.busy || this.sub || this.done) return;
    const h = this.hero.position;
    if (this.talkers?.some((tk) => !tk.done && Math.hypot(h.x - tk.pos.x, h.z - tk.pos.z) < 2.4)) this.tip('talker');
    if (this.guards.some((g) => g.seeing && g.sus > 10)) this.tip('sus');
    if (this.takeTarget) this.tip('takedown');
    if (this.dropPhase === 'build') this.tip('drop');
    if (this.xray || this.hearing) this.tip('xray');
    if (this.g.state.intox >= INTOX_HAZE) this.tip('intox');
    if (this.book?.count >= 1) this.tip('clue');
  },

  /** Show a tip once ever (queued behind any showing). */
  tip(id) {
    const S = tipsSeen();
    if (S.has(id) || !TIPS[id]) return;
    S.add(id);
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...S])); } catch (e) { /* private mode: once per session */ }
    (this.tipQ = this.tipQ || []).push(TIPS[id]);
    if (!this.tipOn) this.nextTip();
  },

  nextTip() {
    let el = $('c3-tip');
    if (!el) { el = document.createElement('div'); el.id = 'c3-tip'; $('game').appendChild(el); }
    if (this.quietT > 0 && this.tipQ?.length) { clearTimeout(this.tipTimer); el.classList.remove('on'); this.tipOn = false; this.tipTimer = setTimeout(() => this.nextTip(), 600); return; } // (r11 L2b: not while she's just been made)
    const text = (this.tipQ || []).shift();
    clearTimeout(this.tipTimer);
    if (!text || this.done || !this.scene) { el.classList.remove('on'); this.tipOn = false; return; }
    el.innerHTML = `<b>TIP</b>${text}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); // (restart the pop-in)
    this.tipOn = true;
    this.tipTimer = setTimeout(() => this.nextTip(), 6500);
  },

  endTips() { this.tipQ = []; clearTimeout(this.tipTimer); this.tipOn = false; $('c3-tip')?.classList.remove('on'); },
};
