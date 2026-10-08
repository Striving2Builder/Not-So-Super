// Feel (docs/design/nightclub.md "Look and feel"): a ring on the floor round her feet that fills as
// the crowd hides her (red in the open, gold in the crowd, cyan when she's lost in it, flashing
// while a bouncer has eyes on her); bouncers who don't just shrug: one who loses sight of her walks
// over to where he saw her, looks round, and only then goes back to his round; and first-visit
// tips, each shown once (per device, not per save: they're about what the player knows).
import * as THREE from 'three';
import { pick, $ } from '../util.js';
import { floorY } from './plan.js';

const TIPS_KEY = 'supergirl-club3-tips';
const TIPS = {
  talker: "Stand in a Talker's ring to overhear them. Gold fills with evidence; red is their suspicion: step out before it fills.",
  seen: "Seen! Get back into the crowd. The ring under you turns cyan when they can't pick you out.",
  drop: 'The drop is coming. When the strobe hits, the bouncers are blind for a few seconds.',
  xray: 'X-ray and super-hearing drain power. Lie low in the crowd to recharge. Talkers notice glowing eyes.',
  intox: "You're tipsy: chatter scrambles and Talkers stop making sense. It wears off.",
  clue: 'Clues go on your case board (CASE). With enough of them, accuse someone, or take it to the owner.',
};
let seenTips = null;
const tipsSeen = () => {
  if (!seenTips) { try { seenTips = new Set(JSON.parse(localStorage.getItem(TIPS_KEY)) || []); } catch (e) { seenTips = new Set(); } }
  return seenTips;
};

const INV_LOOK = 3.2;   // seconds he stands looking round the spot
const INV_GIVEUP = 9;   // …or gives up getting there
const INV_MIN = 25;     // the alert it takes for him to bother

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

  // ---- bouncers who come and look
  stepInvestigate(dt) {
    const h = this.hero.position;
    for (const gd of this.guards) {
      if (gd.ko || gd.high || gd === this.ropeGuard) continue;
      const m = gd.mesh;
      if (gd.seeing) { gd.lastSeen = { x: h.x, z: h.z }; gd.sawT = this.t; }
      const inv = gd.inv;
      if (!inv) {
        // he had her a moment ago and now he doesn't: go and look (unless the way there is blocked)
        if (gd.lastSeen && !gd.seeing && this.t - gd.sawT < 0.5 && this.alert >= INV_MIN && this.clearPath(m.position, gd.lastSeen)) {
          gd.inv = { phase: 'go', t: 0, saved: { route: gd.route, wp: gd.wp } };
          gd.route = [new THREE.Vector3(gd.lastSeen.x, m.position.y, gd.lastSeen.z)]; gd.wp = 0;
          this.say(m, pick(['Hey…', 'Where\'d she go?', 'Huh?', 'I saw that.']), { ms: 1600 });
        }
        continue;
      }
      inv.t += dt;
      if (gd.seeing) continue; // (he's got her again: the alert does the rest)
      if (inv.phase === 'go') {
        const tgt = gd.route[0];
        if (Math.hypot(tgt.x - m.position.x, tgt.z - m.position.z) < 0.4 || inv.t > INV_GIVEUP) { inv.phase = 'look'; inv.t = 0; inv.yaw = m.rotation.y; }
      } else {
        // a slow look left and right, then back to his round
        m.rotation.y = inv.yaw + Math.sin(inv.t * 1.9) * 1.1;
        if (inv.t > INV_LOOK) {
          gd.route = inv.saved.route; gd.wp = inv.saved.wp; gd.inv = null; gd.lastSeen = null;
          if (Math.random() < 0.6) this.say(m, pick(['Must\'ve been nothing.', 'Hm.', 'Lost her.']), { ms: 1400 });
        }
      }
    }
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
    if (this.guards.some((g) => g.seeing)) this.tip('seen');
    if (this.dropPhase === 'build') this.tip('drop');
    if (this.xray || this.hearing) this.tip('xray');
    if (this.g.state.intox >= 45) this.tip('intox');
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
