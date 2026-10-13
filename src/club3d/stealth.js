// The bouncers' heads (round 11, the club loop): readable states instead of one hidden alert bar.
// calm (patrolling) → "?" a meter over his head fills while he can see her (faster close up, in
// the open, if she runs or her eyes glow) → at a quarter he stops and stares → lose him and he
// walks over to look (searching) → "!" he's made her: the screens cut to her on CCTV, he radios
// the nearest bouncer and comes for her (close enough, he grabs her). A "?" that nearly filled and
// fizzles is a close call (tension.js plays it). From behind, she can drop one (USE): silent in a
// side room, filmed in a packed crowd, and he's back on his feet in 40 s, looking for her.
// The read is on screen: icons over heads, arrows at the screen edge for the ones she can't see,
// and with X-ray every bouncer glows through the walls in his state's colour, labelled.
// Mixed into Club3D.prototype; it replaces guards3d's updateGuards for the club.
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV, segHitsBox } from '../zonekit.js';
import { comic } from '../comic.js';
import { toast, avoidHud } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, clamp, $ } from '../util.js';
import { HERO } from '../data.js';
import { INTOX_HAZE } from '../state.js';

export const STEALTH = {
  rate: [30, 10],       // "?" per second at the cone's edge, + per metre closer
  stare: 25,            // at this much he stops walking and stares
  hold: 1.1,            // s he keeps the "?" after losing sight of her
  fade: 14, fadeSearch: 7,
  close: 1.7, closeRate: 22, // a searching bouncer this close finds her in the crowd unless she dances
  spotAlert: 45,        // the floor's alert the moment he makes her
  chase: [16, 24],      // alert per second while a bouncer who's made her can see her (normal, hard): ~3.4 s / 2.3 s to break his sight
  grab: 1.2,            // an alerted bouncer this close (and seeing her for grabT) grabs her
  grabT: 0.6,
  speed: { walk: 1.7, slow: 0.8, search: 2.1, chase: 2.3 },
  look: 3.2, giveUp: 9, // s looking round the spot / trying to get there
  lose: 1.6,            // s an alerted bouncer keeps coming after he's lost sight of her
  radio: 24,            // m: an alerted bouncer calls the nearest other one this close
  ko: 40,               // s a bouncer she drops stays down
  closeCall: 60,        // a "?" that got this far and fizzled
};
const COL = { calm: 0xffe040, sus: 0xffa020, search: 0xff7a1a, alert: 0xff2a2a };
const XCOL = { calm: 0x3ad8ff, sus: 0xffb020, search: 0xff8a2a, alert: 0xff2a3a, ko: 0x6a7a8a, poi: 0xffd84d };
const LABEL = { calm: 'CALM', sus: 'SUSPICIOUS', search: 'SEARCHING', alert: 'ALERT', ko: 'OUT COLD' };
const SAY = {
  sus: ['Hm?', 'Hey… is that…?', 'Wait.', 'Huh?', 'You. Hold up.'],
  search: ['Where\'d she go?', 'I saw something.', 'Over here…', 'Hello?'],
  calm: ['Must\'ve been nothing.', 'Hm.', 'Lost her.', 'Huh. Nothing.'],
  spot: ['THERE she is!', 'Hey! YOU!', 'Got eyes on the cape!', 'Security! Over here!', 'It\'s HER!'],
  radio: ['Copy. Moving.', 'On my way!', 'Where? Where?!'],
  wake: ['Who hit me?!', 'Ugh… where is she?', 'Find the cape!'],
};
const POW = ['POW!', 'THWACK!', 'BIFF!', 'WHAM!'];
const STAR = (() => { const p = []; for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 36 : 50; p.push(`${(50 + Math.cos(a) * r).toFixed(1)}% ${(50 + Math.sin(a) * r).toFixed(1)}%`); } return `polygon(${p.join(',')})`; })();

const turnTo = (m, ang, k) => {
  let da = ang - m.rotation.y;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  m.rotation.y += da * Math.min(1, k);
};
let xmats = null;
const xMat = (k) => {
  if (!xmats) {
    xmats = {};
    for (const [n, c] of Object.entries(XCOL)) xmats[n] = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  }
  return xmats[k];
};

export const stealthMethods = {
  /** The club's guards: walking, seeing, the states. (Replaces guards3d.updateGuards here.) */
  updateGuards(dt) {
    const h = this.hero.position, R = GUARD_RANGE, cosF = Math.cos(GUARD_FOV / 2), S = STEALTH;
    const hard = (this.diff?.guardGain ?? 0.7) >= 1, rateK = hard ? 1 : 0.75;
    const st = this.g.state;
    const odd = ((this.moving || 0) > 0.85 && !this.dancing ? 1.5 : 1) * (this.xray || this.hearing ? 1.8 : 1) * (st.intox >= INTOX_HAZE ? 1.2 : 1) * (this.caseSolved ? 1.3 : 1);
    const vis = 1 - 0.75 * clamp((this.blend || 0) / 0.75, 0, 1); // half lost in the crowd: he's slower to be sure
    for (const gd of this.guards) {
      gd.seeing = false;
      if (gd.st === undefined) { gd.st = 'calm'; gd.sus = 0; gd.peak = 0; gd.holdT = 0; }
      if (gd.ko) { gd.st = 'ko'; if (gd.bang) gd.bang.visible = false; continue; }
      if (gd.st === 'ko') this.wakeGuard(gd); // (dazed: back on his feet, and looking for her)
      const m = gd.mesh;
      gd.t += dt;
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
      const inCone = this.t > this.grace && !gd.away && d < R && d > 0.01 && (dx * fx + dz * fz) / d > cosF;
      if (inCone && this.clearLOS(m.position, h)) {
        gd.seeing = true; gd.lastSeen = { x: h.x, z: h.z }; gd.sawT = this.t; gd.holdT = S.hold;
        this.lastKnown = { x: h.x, z: h.z };
        if (gd.st !== 'alert') gd.sus = Math.min(100, gd.sus + (S.rate[0] + (R - d) * S.rate[1]) * vis * odd * rateK * (gd.st === 'search' ? 1.5 : 1) * dt);
      } else if (gd.st === 'search' && inCone && d < S.close && !this.dancing && !this.strobe && !this.escapeT && !this.wallBetween(m.position, h)) {
        // he's searching right on top of her: hidden in the crowd isn't enough up close, dancing is
        gd.holdT = S.hold; gd.lastSeen = { x: h.x, z: h.z };
        gd.sus = Math.min(100, gd.sus + S.closeRate * rateK * dt);
      } else {
        gd.holdT -= dt;
        if (gd.holdT <= 0 && gd.st !== 'alert') gd.sus = Math.max(0, gd.sus - (gd.st === 'search' ? S.fadeSearch : S.fade) * dt);
      }
      gd.peak = Math.max(gd.peak, gd.sus);
      this.guardThink(gd, dt, d, hard);
      this.guardMove(gd, dt);
      // the cone: clipped by the walls ~20×/s, coloured by what's in his head
      if (!gd.cone.userData.comic) this.dressCone(gd.cone);
      gd.shapeT = (gd.shapeT || 0) + dt;
      if (gd.shapeT > 0.05 || !gd.shaped) { gd.shapeT = 0; gd.shaped = true; this.shapeCone(gd); }
      const cu = gd.cone.material.uniforms;
      cu.col.value.set(gd.seeing && gd.st === 'alert' ? COL.alert : COL[gd.st] || COL.calm);
      cu.k.value += ((gd.seeing ? 1 : gd.st === 'calm' ? 0.62 : 0.8) - cu.k.value) * Math.min(1, dt * 8);
      cu.alarm.value = gd.seeing && gd.st === 'alert' ? 1 : 0;
      cu.t.value = this.t;
    }
  },

  /** What he does about what he's seen: the state changes, and their lines. */
  guardThink(gd, dt, d, hard) {
    const S = STEALTH, m = gd.mesh;
    if (gd.st === 'calm' || gd.st === 'sus' || gd.st === 'search') {
      if (gd.sus >= 100) return this.spot(gd);
      if (gd.st === 'calm' && gd.sus >= S.stare && gd.seeing) { gd.st = 'sus'; gd.stT = 0; this.say(m, pick(SAY.sus), { ms: 1300 }); this.onSuspicious?.(gd); }
    }
    if (gd.st === 'sus') {
      gd.stT += dt;
      // he lost her: go and look where she was (if he can walk there), else stand and stare it out
      if (!gd.seeing && gd.holdT <= 0) {
        if (!gd.high && gd !== this.ropeGuard && gd.lastSeen && this.clearPath(m.position, gd.lastSeen)) this.startSearch(gd, gd.lastSeen, pick(SAY.search));
        else if (gd.sus <= 4) this.calmDown(gd);
      }
    } else if (gd.st === 'search') {
      const inv = gd.inv;
      inv.t += dt;
      if (gd.seeing) { inv.phase = 'go'; inv.t = 0; gd.goal = gd.lastSeen; }
      else if (inv.phase === 'go') {
        const g = gd.goal;
        if (!g || Math.hypot(g.x - m.position.x, g.z - m.position.z) < 0.5 || inv.t > S.giveUp) { inv.phase = 'look'; inv.t = 0; inv.yaw = m.rotation.y; gd.goal = null; }
      } else if (inv.t > S.look && gd.sus <= 6) this.calmDown(gd);
    } else if (gd.st === 'alert') {
      gd.alertT += dt;
      if (gd.seeing) {
        gd.lostT = 0;
        this.alert = Math.min(100, this.alert + S.chase[hard ? 1 : 0] * dt);
        gd.grabT = d < S.grab ? gd.grabT + dt : 0;
        if (gd.grabT > S.grabT && !this.busy && !this.sedating) { gd.grabT = 0; this.say(m, 'Gotcha!', { ms: 1200 }); this.foundOut(`A bouncer grabs ${HERO} by the arm.`); }
      } else {
        gd.lostT = (gd.lostT || 0) + dt;
        // he keeps coming to where she was, then searches round it with his blood up
        if (gd.lostT > S.lose) { gd.sus = 85; gd.peak = 100; this.startSearch(gd, gd.lastSeen || this.lastKnown, null); }
      }
    }
  },

  /** Walking: his round, slowing to a stop as something catches his eye; to a spot; after her. */
  guardMove(gd, dt) {
    const S = STEALTH, m = gd.mesh, E = m.enemy, h = this.hero.position;
    let tgt = null, sp = S.speed.walk;
    if (gd.st === 'alert') { tgt = gd.seeing ? h : gd.lastSeen; sp = S.speed.chase; if (gd.seeing && Math.hypot(h.x - m.position.x, h.z - m.position.z) < 1.0) tgt = null; }
    else if (gd.st === 'search') { tgt = gd.inv.phase === 'go' ? gd.goal : null; sp = S.speed.search; }
    else if (gd.st === 'sus') tgt = null;
    else if (!(gd.torch && gd.phase === 'sweep')) { tgt = gd.route[gd.wp]; sp = gd.sus > 2 ? S.speed.slow : S.speed.walk; }
    if (gd.high && gd.st !== 'calm') tgt = null; // (up on the balcony: he stares down, he radios)
    let moved = false;
    if (tgt) {
      const tx = tgt.x - m.position.x, tz = tgt.z - m.position.z, td = Math.hypot(tx, tz);
      if (td < 0.2) { if (gd.st === 'calm') gd.wp = (gd.wp + 1) % gd.route.length; }
      else {
        m.position.x += (tx / td) * sp * dt; m.position.z += (tz / td) * sp * dt;
        turnTo(m, Math.atan2(tx, tz), dt * (gd.st === 'alert' ? 8 : 5));
        moved = true;
      }
    }
    // where he's looking: at her while he can see her; round the spot when searching; a slow double take
    if (gd.seeing && gd.st !== 'calm') turnTo(m, Math.atan2(h.x - m.position.x, h.z - m.position.z), dt * 5);
    else if (gd.seeing && gd.sus > 6) turnTo(m, Math.atan2(h.x - m.position.x, h.z - m.position.z), dt * 1.6);
    else if (gd.st === 'search' && gd.inv.phase === 'look') m.rotation.y = gd.inv.yaw + Math.sin(gd.inv.t * 1.9) * 1.1;
    else if (gd.st === 'sus' && gd.lastSeen) turnTo(m, Math.atan2(gd.lastSeen.x - m.position.x, gd.lastSeen.z - m.position.z), dt * 3);
    if (E) { if (moved) E.play('walk', { speed: 1.2 * sp / S.speed.walk }); else E.play(gd.st === 'calm' && !gd.seeing ? 'idle' : 'combatIdle'); }
    else if (m.legs) { const s = moved ? Math.sin(gd.t * 8 * sp / S.speed.walk) * 0.4 : 0; m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s; }
  },

  /** A wall (or a shut door) between two points (the crowd doesn't count). */
  wallBetween(a, b) {
    for (const c of this.colliders) if (c.wall && !c.disabled && segHitsBox(a.x, a.z, b.x, b.z, c)) return true;
    return false;
  },

  startSearch(gd, at, line) {
    gd.st = 'search';
    gd.goal = at ? { x: at.x, z: at.z } : null;
    gd.inv = { phase: gd.goal && !gd.high && this.clearPath(gd.mesh.position, gd.goal) ? 'go' : 'look', t: 0, yaw: gd.mesh.rotation.y };
    if (gd.inv.phase === 'go' && gd.high) gd.inv.phase = 'look';
    if (line) this.say(gd.mesh, line, { ms: 1500 });
  },

  calmDown(gd) {
    const peak = gd.peak;
    gd.st = 'calm'; gd.sus = 0; gd.peak = 0; gd.goal = null; gd.inv = null;
    if (peak >= STEALTH.closeCall && !this.busy && !this.done) {
      if (Math.random() < 0.7) this.say(gd.mesh, pick(SAY.calm), { ms: 1400 });
      this.closeCall?.('guard');
    }
  },

  /** "!": he's made her. The floor's alert jumps, he radios, the screens cut to her. */
  spot(gd) {
    if (gd.st === 'alert') return;
    const first = !this.guards.some((q) => q !== gd && q.st === 'alert');
    gd.st = 'alert'; gd.sus = 100; gd.peak = 100; gd.alertT = 0; gd.lostT = 0; gd.grabT = 0; gd.goal = null; gd.inv = null;
    this.alert = Math.max(this.alert, STEALTH.spotAlert);
    this.say(gd.mesh, pick(SAY.spot), { ms: 1500 });
    if (first) this.spotted?.(gd);
    this.tip?.('seen');
    // the radio: the nearest other bouncer on the floor comes to look
    const h = this.hero.position;
    let near = null, nd = STEALTH.radio;
    for (const q of this.guards) {
      if (q === gd || q.ko || q.high || q === this.ropeGuard || q.st === 'alert' || q.st === 'search') continue;
      const dd = Math.hypot(q.mesh.position.x - h.x, q.mesh.position.z - h.z);
      if (dd < nd) { nd = dd; near = q; }
    }
    if (near) { near.sus = Math.max(near.sus, 70); near.peak = Math.max(near.peak, 70); this.startSearch(near, { x: h.x, z: h.z }, pick(SAY.radio)); }
  },

  /** A bouncer she dropped gets back up (story.js stepShake clears the daze): he goes looking. */
  wakeGuard(gd) {
    gd.st = 'calm'; gd.sus = 0; gd.peak = 0;
    const at = this.lastKnown || { x: gd.mesh.position.x, z: gd.mesh.position.z };
    gd.sus = 55; gd.peak = 55;
    this.startSearch(gd, at, gd.kod ? pick(SAY.wake) : pick(SAY.search));
    gd.kod = false;
  },

  /** Everyone forgets her (she broke free: story.js shakeOff), downed ones stay down. */
  resetGuardMinds() {
    for (const gd of this.guards) {
      if (gd.ko) continue;
      gd.st = 'calm'; gd.sus = 0; gd.peak = 0; gd.goal = null; gd.inv = null; gd.lastSeen = null;
    }
  },

  // ---- takedowns from behind
  /** The bouncer she could drop right now (close, his back to her, not the VIP's rope man), or null. */
  takedownTarget() {
    const h = this.hero.position;
    let best = null, bd = 1.7;
    for (const gd of this.guards) {
      if (gd.ko || gd.high || gd === this.ropeGuard || gd.away) continue;
      if (gd.st === 'alert' && gd.seeing) continue;
      const m = gd.mesh, dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      if (d > bd || d < 0.05) continue;
      const behind = (dx * Math.sin(m.rotation.y) + dz * Math.cos(m.rotation.y)) / d; // < 0: she's at his back
      if (behind > -0.2) continue;
      best = gd; bd = d;
    }
    return best;
  },

  async takedown(gd) {
    const m = gd.mesh, h = this.hero.position;
    this.hero.rotation.y = Math.atan2(m.position.x - h.x, m.position.z - h.z);
    if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.5; }
    sfx.whoosh();
    await new Promise((r) => setTimeout(r, 220));
    if (this.done || gd.ko) return;
    sfx.punch(); sfx.hit();
    gd.ko = true; gd.kod = true; gd.dazed = this.t + STEALTH.ko; gd.cone.visible = false; gd.st = 'ko'; gd.sus = 0; gd.goal = null; gd.inv = null;
    if (m.enemy) m.enemy.knockDown();
    else { gd.y0 = m.position.y; m.rotation.x = -Math.PI / 2; m.position.y = gd.y0 + 0.15; }
    const s = this.screenOf(m.position, 1.4);
    if (s) comic.pow(pick(POW), s.x, s.y, { size: 0.9 });
    this.kick?.(0.7);
    this.crowd?.shove(m.position.x, m.position.z, 2.2, 0.5);
    // who saw it: any bouncer with eyes on her makes her on the spot; a packed floor gets it on a phone
    let seen = false;
    for (const q of this.guards) {
      if (q === gd || q.ko || q.st === 'alert') continue;
      const dx = h.x - q.mesh.position.x, dz = h.z - q.mesh.position.z, d = Math.hypot(dx, dz);
      const fx = Math.sin(q.mesh.rotation.y), fz = Math.cos(q.mesh.rotation.y);
      if (d < GUARD_RANGE * 1.2 && (dx * fx + dz * fz) / Math.max(d, 0.01) > Math.cos(GUARD_FOV / 2 + 0.3) && this.clearLOS(q.mesh.position, h)) { this.spot(q); seen = true; }
    }
    const filmed = !this.room && !this.undercover && (this.cover || 0) >= 2;
    if (filmed) {
      this.addCard?.('fans', `${HERO} decking a bouncer on the dance floor`);
      this.recog = Math.min(100, (this.recog || 0) + 45);
      this.alert = Math.min(95, this.alert + 15);
      toast(seen ? 'His friends saw that. So did every phone on the floor.' : 'Down he goes. Somebody on the floor got it on a phone.', 'bad');
    } else toast(seen ? 'Down he goes, but they saw it.' : 'Silent takedown. He\'ll be out for a while.', seen ? 'bad' : 'good');
    this.selfTalk?.('takedown');
  },

  // ---- the read on screen: icons over heads, arrows at the edges, X-ray tags
  hudThreats() {
    let layer = $('c3-threat');
    if (!layer) { layer = document.createElement('div'); layer.id = 'c3-threat'; $('game').insertBefore(layer, $('comic-layer')); }
    const W = this.g.w, H = this.g.h, cam = this.cam, v = this._tv || (this._tv = new THREE.Vector3());
    const show = !this.busy && !this.sub && !this.done && !!this.scene;
    for (const gd of this.guards) {
      const u = gd.ui || (gd.ui = this.threatEls(layer));
      const m = gd.mesh;
      const live = show && gd.st !== 'ko' && (gd.st !== 'calm' || gd.sus > 2);
      const tagOn = show && this.xray;
      v.set(m.position.x, m.position.y + 2.55, m.position.z).project(cam);
      const behind = v.z > 1;
      let sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      const onScreen = !behind && sx > 24 && sx < W - 24 && sy > 40 && sy < H - 24;
      // the icon over his head
      if (live && onScreen) {
        const k = gd.st === 'alert' ? 'alert' : gd.st;
        if (u.k !== k) { u.k = k; u.icon.className = `c3-sus s-${k}`; u.glyph.textContent = k === 'alert' ? '!' : '?'; }
        u.icon.style.transform = `translate(${Math.round(sx)}px,${Math.round(sy)}px)`;
        const p = Math.round(gd.st === 'alert' ? 100 : gd.sus);
        if (u.p !== p) { u.p = p; u.icon.style.setProperty('--p', p); }
        u.icon.classList.add('on');
      } else u.icon.classList.remove('on');
      // off screen (or behind the camera): an arrow on the edge, pointing at him
      if (live && !onScreen) {
        let x = behind ? -v.x : v.x, y = behind ? v.y : -v.y; // (y up → down)
        if (behind && Math.abs(x) < 0.05 && Math.abs(y) < 0.05) y = 1;
        const s = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.8, 1e-3);
        x *= s; y *= s;
        const ang = Math.atan2(y * H, x * W);
        const [ex, ey] = avoidHud(clamp((x * 0.5 + 0.5) * W, 30, W - 30), clamp((y * 0.5 + 0.5) * H, 64, H - 30), 6);
        const k = gd.st === 'alert' ? 'alert' : gd.st;
        if (u.ek !== k) { u.ek = k; u.edge.className = `c3-edge s-${k}`; u.eglyph.textContent = k === 'alert' ? '!' : '?'; }
        u.edge.style.transform = `translate(${Math.round(ex)}px,${Math.round(ey)}px)`;
        u.earrow.style.transform = `rotate(${ang.toFixed(2)}rad)`;
        u.edge.classList.add('on');
      } else u.edge.classList.remove('on');
      // X-ray: every bouncer labelled with his state (through walls), the downed ones with their count;
      // the tag sits under his feet (over his head it hid the glowing figure itself at a distance)
      let tp = null;
      if (tagOn && !behind) {
        v.set(m.position.x, m.position.y - 0.05, m.position.z).project(cam);
        const fx = (v.x * 0.5 + 0.5) * W, fy = (-v.y * 0.5 + 0.5) * H + 6;
        if (v.z <= 1 && fx > 0 && fx < W && fy > 30 && fy < H - 10) tp = { x: fx, y: fy };
      }
      if (tp && Math.hypot(m.position.x - this.hero.position.x, m.position.z - this.hero.position.z) < 30) {
        const txt = gd.st === 'ko' ? `${LABEL.ko} ${Math.max(0, Math.ceil((gd.dazed || 0) - this.t))}s` : gd.torch && gd.st === 'calm' ? 'CALM · TORCH' : gd === this.ropeGuard && gd.st === 'calm' ? 'CALM · ROPE' : LABEL[gd.st] || '';
        if (u.tt !== txt) { u.tt = txt; u.tag.textContent = txt; u.tag.className = `c3-xtag s-${gd.st}`; }
        u.tag.style.transform = `translate(${Math.round(tp.x)}px,${Math.round(tp.y)}px)`;
        u.tag.classList.add('on');
      } else u.tag.classList.remove('on');
    }
  },

  threatEls(layer) {
    const icon = document.createElement('div'); icon.className = 'c3-sus';
    icon.innerHTML = '<i class="ring"></i><i class="star"></i><b>?</b>';
    icon.style.setProperty('--star', STAR);
    const edge = document.createElement('div'); edge.className = 'c3-edge';
    edge.innerHTML = '<i class="arr"></i><b>?</b>';
    const tag = document.createElement('div'); tag.className = 'c3-xtag';
    layer.append(icon, edge, tag);
    return { icon, glyph: icon.querySelector('b'), edge, earrow: edge.querySelector('.arr'), eglyph: edge.querySelector('b'), tag, k: null, ek: null, p: -1, tt: null };
  },

  endThreats() { const l = $('c3-threat'); if (l) l.innerHTML = ''; for (const gd of this.guards || []) gd.ui = null; },

  // ---- X-ray: the bouncers glow through the walls in their state's colour (the detective read)
  /** Swap the bouncers' (and the case's people's) materials for the X-ray glow, or put them back. */
  xrayGlow(on) {
    const people = [...this.guards.map((gd) => ({ root: gd.mesh, gd })), ...this.xrayPOIs().map((root) => ({ root, gd: null }))];
    for (const { root, gd } of people) {
      if (!root) continue;
      const k = gd ? (gd.st === 'ko' ? 'ko' : gd.st || 'calm') : 'poi';
      root.traverse((o) => {
        if (o.userData.noX) return;
        if (!o.isMesh || o === gd?.cone || o.parent?.userData.noX) return;
        if (o.userData.ink) { o.visible = !on; return; }
        if (on) {
          if (!o.userData.xKeep) { o.userData.xKeep = o.material; o.userData.xOrder = o.renderOrder; }
          o.material = xMat(k); o.renderOrder = 14;
        } else if (o.userData.xKeep) { o.material = o.userData.xKeep; o.renderOrder = o.userData.xOrder; o.userData.xKeep = null; }
      });
      if (gd) gd.xk = on ? k : null;
    }
  },

  /** Per frame under X-ray: a bouncer whose state changed changes colour. */
  stepXrayGlow() {
    if (!this.xray) return;
    for (const gd of this.guards) {
      const k = gd.st === 'ko' ? 'ko' : gd.st || 'calm';
      if (gd.xk === k) continue;
      gd.xk = k;
      gd.mesh.traverse((o) => { if (o.isMesh && o.userData.xKeep) o.material = xMat(k); });
    }
  },

  /** Who else glows gold under X-ray: the Talkers, the host, the owner, the courier, the crew. */
  xrayPOIs() {
    const out = [];
    for (const tk of this.talkers || []) out.push(...tk.npcs);
    out.push(this.vipHost, this.bossNPC, this.courier, ...(this.darkCrew || []), this.gangster);
    return out.filter(Boolean);
  },
};
