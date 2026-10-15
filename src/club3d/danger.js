// The floor bites back (docs/design/nightclub.md "NPCs", "Intoxication paths").
// Flashlight bouncers walk loops through the dance floor and stop to sweep it: their beam sees into
// the crowd (only DANCE hides her from them). In the thick of the crowd things happen to her:
// hands, a skirt flipped from behind, a shot pushed at her lips, a phone flash in her face, someone
// shouting her name. And the man in the sharp suit isn't the only one with a glass to offer: once
// one walks off, another turns up.
import * as THREE from 'three';
import { comic } from '../comic.js';
import { toast, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, rand, clamp } from '../util.js';
import { HERO } from '../data.js';
import { DOSE } from './vices.js';

export const DANGER = {
  torches: 2,          // flashlight bouncers on the floor
  walk: [4, 7], sweep: [2.5, 4], swing: 0.85, // seconds walking / sweeping; the sweep's half-angle
  incident: [8, 14],   // seconds between things happening to her in a thick crowd
  againAfter: [60, 90], // until another man with a spiked glass turns up
  // round 11 D2: standing still on the floor, the crowd closes in. `after` s still → a ring of `ring`
  // dancers (phones up); the incidents come faster the longer she stands, up to `faster`× after `max` s
  // more; moving `breakAt` m from where she stood breaks it. `flip`/`flash`: a held ring's own incidents
  // (the share of each roll), `say`: seconds between the crowd's lines.
  idle: { after: 4, max: 16, faster: 2.5, ring: 7, r: 1.8, breakAt: 1, flip: 0.3, flash: 0.25, say: [3, 5] },
};

const GROPE = ['Hey! Who was that?!', 'Who flipped my little red mini skirt?!', 'Hands OFF!', 'Did someone just rub me up?!', 'Okay, WHO did that?', 'OMG, Why am I wet?!'];
const LAUGH = ['Ha! Nice red mini skirt, cape!', 'Nice tent over that S', 'Wasn\'t me!', 'Supergirl\'s got a red one!', 'Hahaha!'];
const SHOT = ['Drink! Drink! Drink!', 'Down it, hero!', 'One for the Girl of Steel!', 'Take it, cape!'];
// round 11 D2 (new lines; the arrays above are the user's): the ring that closes in when she stands still
const IDLE = {
  closes: ['Uh… hi, everyone?', 'Okay, that\'s a lot of phones.', 'Personal space, people!', 'I\'m just… standing here.'],
  crowd: ['Phones up, she\'s not moving!', 'Get her from the front!', 'Is she posing for us?!', 'Supergirl! Over here!', 'Do a twirl, cape!', 'I\'m going live!'],
  flip: ['HEY! Hands off the skirt!', 'Did someone just— my SKIRT!', 'Not funny!', 'Who keeps doing that?!'],
  flash: ['Okay, enough flashes!', 'I can\'t see a thing!', 'Please, no flash!'],
  breaks: ['Excuse me. Coming through.', 'Show\'s over, folks.'],
};

let beamMat = null;
function torchBeam() {
  // a soft white cone from his hand, angled down onto the floor ahead of him
  beamMat = beamMat || new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const L = 6.5, g = new THREE.ConeGeometry(1.5, L, 18, 1, true).translate(0, -L / 2, 0).rotateX(-Math.PI / 2 + 0.22);
  const beam = new THREE.Mesh(g, beamMat);
  beam.position.set(0.25, 1.35, 0.3);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bulb.position.copy(beam.position);
  beam.userData.noX = bulb.userData.noX = true; // (X-ray glows the man, not his torch)
  return [beam, bulb];
}

export const dangerMethods = {
  /** Flashlight bouncers: loops round the dance floor (one each way). After the regular bouncers. */
  addTorchGuards() {
    const F = this.plan.V.floor;
    if (!F) return;
    const x0 = F.x - F.w * 0.32, x1 = F.x + F.w * 0.32, z0 = F.z - F.d * 0.3, z1 = F.z + F.d * 0.3;
    const loops = [[[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [[x1, z1], [x0, z1], [x0, z0], [x1, z0]], [[F.x, z0], [F.x, z1]]];
    for (const r of loops.slice(0, DANGER.torches)) {
      const gd = this.addBouncer(r);
      gd.torch = true; gd.phase = 'walk'; gd.phaseT = rand(...DANGER.walk);
      for (const m of torchBeam()) gd.mesh.add(m);
    }
  },

  /** After updateGuards: the torch guards stop now and then and swing the beam across the floor (only on their rounds). */
  stepTorches(dt) {
    for (const gd of this.guards) {
      if (!gd.torch || gd.ko) continue;
      if (gd.seeing || (gd.st && gd.st !== 'calm')) { gd.phase = 'walk'; gd.phaseT = rand(...DANGER.walk); gd.look = 0; continue; }
      gd.phaseT -= dt;
      if (gd.phase === 'walk' && gd.phaseT <= 0 && gd.look <= 0) { gd.phase = 'sweep'; gd.phaseT = rand(...DANGER.sweep); gd.base = gd.mesh.rotation.y; gd.sw = 0; }
      if (gd.phase === 'sweep') {
        // look > 0 keeps him standing (and his cone amber: searching); he turns the beam side to side
        gd.look = Math.max(gd.look, 0.1);
        gd.sw += dt;
        gd.mesh.rotation.y = gd.base + Math.sin(gd.sw * 1.6) * DANGER.swing;
        if (gd.phaseT <= 0) { gd.phase = 'walk'; gd.phaseT = rand(...DANGER.walk); gd.look = 0; }
      }
    }
  },

  /** A torch guard's line of sight goes into the crowd: only a full blend (dancing in it) hides her. */
  isTorch(pos) { return this.guards.some((gd) => gd.torch && gd.mesh.position === pos); },

  /** In a thick crowd, every so often, something happens to her. Standing still, it comes faster. */
  stepIncidents(dt) {
    this.stepIdleRing(dt);
    if (this.room || this.busy || this.done) return;
    const ring = this.idleRing, rate = ring ? this.idleRate() : 1;
    this.incT = (this.incT ?? rand(...DANGER.incident)) - dt * (this.crowdThick >= 2 || ring ? rate : 0);
    this.stepPredatorAgain(dt);
    if (this.incT > 0) return;
    this.incT = rand(...DANGER.incident);
    const st = this.g.state, h = this.hero.position;
    const hs = this.screenOf(h, 2.3), p = this.crowd.nearest(h.x, h.z, 2.2), ps = p && this.screenOf({ x: p.x, y: 0, z: p.z }, 2);
    const me = (t, ms = 1900) => hs && comic.say(t, hs.x, hs.y, { kind: 'shout', ms });
    const them = (t, ms = 1600) => ps && comic.say(t, ps.x, ps.y, { ms });
    const I = DANGER.idle, roll = Math.random();
    if (ring && roll < I.flip) {
      // the ring: somebody behind her flips her skirt up for the phones
      this.heroModel?.flip?.(1);
      me(pick(IDLE.flip)); setTimeout(() => !this.done && them(pick(LAUGH)), 700);
      sfx.shutter?.(); this.stunT = Math.max(this.stunT || 0, 0.4);
      this.idleFlips = (this.idleFlips || 0) + 1;
      if (!this.undercover) this.addCard('fans', `${HERO}'s skirt, flipped up on the dance floor`);
      return;
    }
    if (ring && roll < I.flip + I.flash) {
      // the ring: every phone flashes at once
      flash('#ffffff'); this.stunT = Math.max(this.stunT || 0, 0.5); sfx.shutter?.();
      if (hs) comic.pow('FLASH!', hs.x, hs.y - 30, { size: 0.9, colors: ['#ffffff', '#ffd84d'] });
      me(pick(IDLE.flash));
      this.addCard('paparazzi', `${HERO}, ringed by phones on the dance floor`);
      return;
    }
    if (roll < 0.34) {
      // hands in the crowd: she spins round, nobody's there
      me(pick(GROPE)); setTimeout(() => !this.done && them(pick(LAUGH)), 700);
      this.stunT = Math.max(this.stunT || 0, 0.6); sfx.hurt?.();
      if (!this.undercover && Math.random() < 0.4) { this.addCard('fans', `${HERO}, spinning round on the dance floor`); toast('A phone was up for that.', 'bad'); }
    } else if (roll < 0.58) {
      // a shot pushed at her lips
      them(pick(SHOT)); sfx.drink(); st.addIntox(DOSE.shot);
      setTimeout(() => !this.done && me(pick(['Mmph! I didn\'t order that!', 'Hey, I\'m on duty!', 'What WAS that?'])), 600);
    } else if (roll < 0.74) {
      // a phone flash right in her face
      flash('#ffffff'); this.stunT = Math.max(this.stunT || 0, 0.8);
      me(pick(['My eyes!', 'No photos!', 'Who\'s filming?!']));
      this.addCard('paparazzi', `${HERO}, caught in a phone flash`);
    } else if (roll < 0.88 && !this.undercover) {
      // somebody shouts her name: heads turn, the bouncers hear it
      them(`Is that ${HERO}?!`, 1800);
      this.alert = Math.min(90, this.alert + 14);
    } else {
      // the crowd surges and carries her off her spot
      h.x += rand(-1.4, 1.4); h.z += rand(-1.1, 1.1);
      if (this.idleRing) { this.idleRing.x = h.x; this.idleRing.z = h.z; } // (the ring goes with her)
      me(pick(['Whoa, whoa!', 'Stop pushing!', 'I can\'t see!'])); st.addIntox(DOSE.bump);
    }
  },

  /** 1 → DANGER.idle.faster: how much faster things happen the longer she has stood in the ring. */
  idleRate() {
    const I = DANGER.idle, k = clamp((this.still - I.after) / I.max, 0, 1);
    return 1 + (I.faster - 1) * k;
  },

  /**
   * Standing still on the main floor: the nearest dancers drift into a ring round her, phones up
   * (casebeats.js formKnot, outside a generated case too). A case beat's own knot comes first; moving
   * about a metre (or a room, a dialog that takes her away, the cage) breaks it and they drift back.
   */
  stepIdleRing(dt) {
    const I = DANGER.idle, B = this.knotHost(), h = this.hero.position;
    if (!this.gb) this.stepKnot(dt); // (a generated case steps its knot in stepBeats)
    const R = this.idleRing;
    if (R) {
      if (B.knot !== R.K) { this.idleRing = null; return; } // (a beat's knot took the dancers over)
      const moved = Math.hypot(h.x - R.x, h.z - R.z) > I.breakAt;
      if (moved || this.room || this.dancing || this.sub || this.sedating || this.caged || this.done) {
        this.idleRing = null; this.releaseKnot();
        const hs = moved && this.screenOf(h, 2.3);
        if (hs) comic.say(pick(IDLE.breaks), hs.x, hs.y, { kind: 'shout', ms: 1500 });
        return;
      }
      R.K.rate = this.idleRate();
      R.sayT -= dt * R.K.rate;
      if (R.sayT <= 0 && !this.busy) {
        R.sayT = rand(...I.say);
        const q = pick(R.K.k), s = q && this.screenOf({ x: q.p.x, y: 0, z: q.p.z }, 2);
        if (s) comic.say(pick(IDLE.crowd), s.x, s.y, { ms: 1600 });
      }
      return;
    }
    if (this.still < I.after || this.room || this.dancing || this.busy || this.sub || this.quickOn || this.sedating || this.caged || this.done) return;
    if (B.knot || this.escapeT > 0) return; // (a beat's knot is running: the idle ring waits)
    const K = this.formKnot(I.ring, I.r);
    if (!K.k.length) { this.releaseKnot(); this.still = 0; return; } // (nobody near: try again after another wait)
    K.idle = true;
    this.idleRing = { K, x: h.x, z: h.z, sayT: 1.2 };
    this.idleRings = (this.idleRings || 0) + 1;
    this.incT = Math.min(this.incT ?? 99, rand(2, 3.5)); // (the first thing happens soon)
    sfx.crowd?.();
    const hs = this.screenOf(h, 2.3);
    if (hs) { comic.pow('PHONES UP!', hs.x, hs.y - 40, { size: 0.8 }); setTimeout(() => !this.done && this.idleRing && comic.say(pick(IDLE.closes), hs.x, hs.y, { kind: 'shout', ms: 1800 }), 600); }
  },

  /** Another man with a glass, a while after the last one walked off. */
  stepPredatorAgain(dt) {
    const m = this.predator;
    if (!this.predatorDone || !m || m.visible) { this.againT = null; return; }
    this.againT = (this.againT ?? rand(...DANGER.againAfter)) - dt;
    if (this.againT > 0) return;
    const V = this.plan.V, side = Math.random() < 0.5 ? 1 : -1;
    m.position.set(side * (V.hw - 4), m.position.y, rand(-V.hd + 4, V.hd - 4));
    m.visible = true; this.predatorDone = false; this.againT = null;
  },
};
