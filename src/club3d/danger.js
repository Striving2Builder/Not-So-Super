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
import { pick, rand } from '../util.js';
import { HERO } from '../data.js';
import { DOSE } from './vices.js';

export const DANGER = {
  torches: 2,          // flashlight bouncers on the floor
  walk: [4, 7], sweep: [2.5, 4], swing: 0.85, // seconds walking / sweeping; the sweep's half-angle
  incident: [8, 14],   // seconds between things happening to her in a thick crowd
  againAfter: [60, 90], // until another man with a spiked glass turns up
};

const GROPE = ['Hey! Who was that?!', 'Who flipped my little red mini skirt?!', 'Hands OFF!', 'Did someone just pinch me?!', 'Okay, WHO did that?', 'My cape! Let go of my cape!'];
const LAUGH = ['Ha! Nice skirt, cape!', 'Whoops!', 'Wasn\'t me!', 'Supergirl\'s got a red one!', 'Hahaha!'];
const SHOT = ['Drink! Drink! Drink!', 'Down it, hero!', 'One for the Girl of Steel!', 'Open up, cape!'];

let beamMat = null;
function torchBeam() {
  // a soft white cone from his hand, angled down onto the floor ahead of him
  beamMat = beamMat || new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const L = 6.5, g = new THREE.ConeGeometry(1.5, L, 18, 1, true).translate(0, -L / 2, 0).rotateX(-Math.PI / 2 + 0.22);
  const beam = new THREE.Mesh(g, beamMat);
  beam.position.set(0.25, 1.35, 0.3);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bulb.position.copy(beam.position);
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

  /** After updateGuards: the torch guards stop now and then and swing the beam across the floor. */
  stepTorches(dt) {
    for (const gd of this.guards) {
      if (!gd.torch || gd.ko) continue;
      if (gd.seeing) { gd.phase = 'walk'; gd.phaseT = rand(...DANGER.walk); continue; }
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

  /** In a thick crowd, every so often, something happens to her. */
  stepIncidents(dt) {
    if (this.room || this.busy || this.done) return;
    this.incT = (this.incT ?? rand(...DANGER.incident)) - dt * (this.crowdThick >= 2 ? 1 : 0);
    this.stepPredatorAgain(dt);
    if (this.incT > 0) return;
    this.incT = rand(...DANGER.incident);
    const st = this.g.state, h = this.hero.position;
    const hs = this.screenOf(h, 2.3), p = this.crowd.nearest(h.x, h.z, 2.2), ps = p && this.screenOf({ x: p.x, y: 0, z: p.z }, 2);
    const me = (t, ms = 1900) => hs && comic.say(t, hs.x, hs.y, { kind: 'shout', ms });
    const them = (t, ms = 1600) => ps && comic.say(t, ps.x, ps.y, { ms });
    const roll = Math.random();
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
      me(pick(['Whoa, whoa!', 'Stop pushing!', 'I can\'t see!'])); st.addIntox(DOSE.bump);
    }
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
