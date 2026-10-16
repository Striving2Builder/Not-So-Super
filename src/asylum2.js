// The Act 2 asylum (docs/design/act2.md "The asylum"): the layer asylum.js adds to a Ravenmoor visit
// while Act 2 runs (game.act.two.on()). Act 1's asylum never makes one, so it plays as before.
//   * She's always intoxicated in here: the meter is held above the haze line.
//   * The story: the cult checked her in as a working girl who dresses up as Supergirl; the doctors
//     work for the cult's paparazzi gang and wave the opening's Polaroids at her as "proof". Told in
//     captions, stills (Polaroids) and her own lines. PG-13.
//   * Her powers are gone: X-RAY and HEAR answer with "What's going on? Where are my powers?".
//   * One Supergirl costume clue per visit: a poster in a cell, a "Supergirl or impostor?" call
//     (act/spot.js). Called right, she remembers: powers back for the rest of the visit and a suit
//     find (game.act.suitFind). Called wrong, the poster changes and she can look again.
//   * The crime spree: while she's locked up the count rises (game.act.two.spree(n), the act board).
import * as THREE from 'three';
import { INTOX_HAZE } from './state.js';
import { HERO } from './data.js';
import { pick, shuffle, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { comic } from './comic.js';
import { sfx } from './sfx.js';
import { makePolaroid } from './polaroids.js';
import { spotCall, fakeStrength } from './act/spot.js';
import { posterCanvas, posterFrames } from './hotel/art.js';
import { memoryClue } from './act/recall.js';

const HOLD = INTOX_HAZE + 12;      // the meter never drops below this in here
const ENTER_AT = INTOX_HAZE + 25;  // where it starts (if she came in soberer)
const SPREE_EVERY = [16, 24];      // s between crimes outside
const SELF_EVERY = [14, 22];       // s between her own lines while she doesn't remember
const PIECES = ['cape', 'boots', 'briefs'];

const DOCTORS = ['Dr. Lowe', 'Dr. Haskett', 'Dr. Prine', 'Dr. Vey'];
const ALIASES = ['Candy', 'Roxy', 'Starla', 'Destiny'];

/** Lines (PG-13): the doctors, her, the powers, the crimes outside. */
export const A2_LINES = {
  noXray: '"What\'s going on? Where are my powers?"',
  noHear: '"What\'s going on? Where are my powers? I can\'t hear a thing past these walls."',
  self: [
    'My name is… {alias}? That\'s what the doctor says.',
    'Supergirl\'s a costume. Just a costume I wear for work… right?',
    'Why do I know how to fly? I don\'t know how to fly.',
    'Those Polaroids… that\'s me. In the red-light district. In the suit.',
    'Everything\'s so soft and warm. Why am I fighting it?',
    'Someone\'s out there, wearing my face. I can feel it.',
  ],
  orderly: ['"Back to your cell, {alias}."', '"No capes in here, sweetheart."', '"Doctor says you think you can fly. Cute."'],
  remember: 'I\'m not {alias}. I never was. I\'m Supergirl.',
  wrongPoster: ['"That\'s not me. Is it? I can\'t tell any more."', '"They all look like me. Which one is me?"'],
  crimes: [
    'a jewellery store on Gold Row cleaned out',
    'the Harbor Bank\'s night vault emptied',
    'an armoured car hijacked on the bridge',
    'the museum\'s diamond swapped for glass',
    'a rooftop gala\'s champagne spiked',
    'a pharmacy stockroom stripped bare',
    'the docks handed to a new crew of dealers',
    'a councilman\'s files stolen from City Hall',
  ],
};
const fill = (s, a) => s.replace(/\{alias\}/g, a);
const rnd = ([a, b]) => a + Math.random() * (b - a);

/** The Act 2 layer for one asylum visit (kept across sedations: the visit goes on). */
export class Act2Asylum {
  constructor(zone) {
    this.z = zone;
    this.g = zone.g;
    this.two = this.g.act.two;
    this.powers = false;        // back once she's found the clue
    this.alias = pick(ALIASES);
    this.doctor = pick(DOCTORS);
    this.piece = PIECES[(this.two.B.counts.asylum || 0) % PIECES.length];
    this.intro = false;         // the doctor's "proof" has been shown
    this.spreeT = rnd(SPREE_EVERY) * 0.6;
    this.spreeN = 0;            // crimes during this visit
    this.selfT = rnd(SELF_EVERY);
    this.lines = [];            // what she said (the harness reads it)
    this.poster = null;
    this.tries = 0;
  }

  /** Is Act 2 running (and past its opening)? Then an asylum visit gets this layer. */
  static wanted(g) {
    const two = g.act?.two;
    return !!(two?.on?.() && two.B?.opening === 'done');
  }

  // ------------------------------------------------------------------ the zone's hooks
  /** Each enter (the first one and every wake-up): the meter goes up into the haze. */
  entered() {
    const st = this.g.state;
    if (st.intox < ENTER_AT) st.addIntox(ENTER_AT - st.intox);
    this.poster = null;
    this.waking = !!this.z.waking;
    if (this.waking) this.selfT = 7;
  }

  /** Controls: the night case's, plus HEAR (super-hearing). */
  controls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'xray', label: 'X-RAY', key: 'X' },
      { id: 'accuse', label: 'SUSPECTS', key: 'Q', slot: 2 },
      { id: 'notes', label: 'NOTES', key: 'N', slot: 3 },
      { id: 'punch', label: 'PUNCH', key: 'F', slot: 4 },
      { id: 'hear', label: 'HEAR', key: 'V', slot: 5 },
    ]);
    if (!this.powers) { this.g.input.setButton('xray', { label: 'X-RAY ?' }); this.g.input.setButton('hear', { label: 'HEAR ?' }); }
  }

  /** The banner and the opening toast (true: the zone's own announce is skipped). */
  announce() {
    const z = this.z;
    if (this.waking) {
      banner('WAKE UP', `Cell ${z.wakeCell.id} · "${this.alias}" · sedated ${z.sedations}×`, '#ff9ad0');
      comic.caption(`${this.doctor}, at the hatch: "Again, ${this.alias}? We showed you the Polaroids. That's you, in your work costume. Supergirl's a costume, dear."`, { ms: 6000 });
    }
    else banner('RAVENMOOR', `Patient: "${this.alias}"`, '#ff9ad0');
    setTimeout(() => {
      if (z.done || z.a2 !== this) return;
      if (this.powers) toast('You remember who you are. Same case: find the clues again and name the culprit.', 'info');
      else toast('Your powers are gone. Somewhere in here is something that remembers Supergirl: a poster, a picture. Find it.', 'info');
    }, 1800);
    return true;
  }

  /** X-ray on: refused (her line) while she doesn't remember. True = handled. */
  blockXray(on) {
    if (!on || this.powers) return false;
    this.say(A2_LINES.noXray, 'thought');
    sfx.lose?.();
    toast('🥴 The X-ray doesn\'t come. The drug is in the way.', 'bad');
    return true;
  }

  /** HEAR: her line without powers; with them, the nearest thing worth hearing. */
  hear() {
    const z = this.z;
    if (!this.powers) { this.say(A2_LINES.noHear, 'thought'); toast('🥴 Super-hearing: nothing. Just her own heartbeat.', 'bad'); return; }
    sfx.xray?.();
    const h = z.hero.position;
    const near = (z.clueObjs || []).filter((o) => !o.clue.found).sort((a, b) => a.pos.distanceTo(h) - b.pos.distanceTo(h))[0];
    const g = z.guards.filter((q) => !q.ko).sort((a, b) => a.mesh.position.distanceTo(h) - b.mesh.position.distanceTo(h))[0];
    const where = (p) => { const dx = p.x - h.x, dz = p.z - h.z, m = Math.hypot(dx, dz); return `${Math.round(m)} m ${Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north'}`; };
    const bits = [];
    if (near) bits.push(`something rattling: the ${near.name.toLowerCase()}, ${where(near.pos)}`);
    if (g) bits.push(`an orderly's shoes, ${where(g.mesh.position)}`);
    toast(`👂 Super-hearing: ${bits.join(' · ') || 'only the drip of the leaks'}`, 'good');
  }

  /** Per frame (before the zone's own update). */
  update(dt) {
    const z = this.z, st = this.g.state;
    if (z.done || !z.scene || z.warming) return;
    if (st.intox < HOLD) st.intox = HOLD; // (always high in here)
    if (this.talking) z.grace = Math.max(z.grace || 0, 2);
    if (!this.intro && !z.busy) { this.intro = true; z.runBusy(() => this.introBeat()); return; }
    if (this.g.input.pressed('hear') && !z.busy) this.hear();
    if ((this.spreeT -= dt) <= 0) { this.spreeT = rnd(SPREE_EVERY); this.crime(); }
    if (!this.powers && (this.selfT -= dt) <= 0) { this.selfT = rnd(SELF_EVERY); this.say(fill(pick(A2_LINES.self), this.alias), 'thought'); }
  }

  /** The doctor's welcome: the Polaroids from the opening, held up as "proof". */
  async introBeat() {
    this.talking = true;
    try {
      const pol = await makePolaroid('you, last week').catch(() => null);
      const img = pol ? `<img class="c3-pol" src="${pol.toDataURL('image/jpeg', 0.8)}">` : '';
      comic.caption(`Ravenmoor's night staff work for the paparazzi gang. The cult checked her in as "${this.alias}".`, { ms: 5500 });
      {
        await dialog({
          speaker: `${this.doctor} · Ravenmoor`, text: `"Good evening, ${this.alias}. You were brought in last night, very confused. You told the nurses you were <i>Supergirl</i>."${img}"Here's the proof, from the night you were found. A working girl in a Supergirl costume. That's all you are, dear. The pills will help you remember."`,
          options: [{ label: '"That… is me. But I\'m not her. Am I?"', value: true }],
        });
        await dialog({ speaker: HERO, text: '"Why can\'t I think straight? Where are my powers?"<span class="hint">The drug holds her in the haze: no X-ray, no super-hearing. Find what remembers Supergirl (a poster in one of the cells) to get them back.</span>' });
      }
      if (this.powers) this.say(fill(A2_LINES.remember, this.alias), 'thought');
    } finally { this.talking = false; }
  }

  /** A crime outside (the cult's spree): the count goes up, a caption says what happened. */
  crime() {
    const n = this.two.spree(1);
    if (n == null) return;
    this.spreeN++;
    const what = pick(A2_LINES.crimes);
    comic.caption(`MEANWHILE, OUTSIDE: ${what}. "Supergirl" was seen leaving. (Crime spree: ${n})`, { ms: 4500 });
  }

  /** Her own line in a bubble over her head (thought or speech). */
  say(text, kind = 'speech') {
    this.lines.push(text);
    const z = this.z, s = z.screenOf?.(z.hero.position, 2);
    if (s) comic.say(text.replace(/^"|"$/g, ''), s.x, s.y, { kind, speaker: this.powers ? HERO : `"${this.alias.toUpperCase()}"`, ms: 2600 });
  }

  /** Objective line (inserted before the final accuse). */
  objective() {
    return { t: this.powers ? `You remember: powers back (${this.piece} find)` : 'Find what remembers Supergirl (powers gone)', done: this.powers, target: this.poster?.pos };
  }

  hudBit() { return `${this.powers ? 'Powers back' : 'Powers gone'} · Spree ${this.two.B.spree || 0}`; }

  // ------------------------------------------------------------------ the costume clue
  /** A Supergirl poster taped inside a free cell (placeClubGameplay calls this with the cells left). */
  place(cells) {
    if (this.powers) return; // (found this visit already: a wake-up doesn't hide it again)
    const z = this.z, cell = cells.find((c) => c !== z.wakeCell) || cells[0];
    if (!cell) return;
    // on the back wall, over the bed, facing the door
    const n = new THREE.Vector3().subVectors(cell.door, cell.bed).setY(0).normalize();
    const pos = cell.bed.clone().addScaledVector(n, -0.3).setY(1.7);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.12), new THREE.MeshBasicMaterial({ color: 0x3a1630 }));
    mesh.position.copy(pos); mesh.rotation.y = Math.atan2(n.x, n.z);
    z.scene.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xff5aa8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    const floorAt = cell.bed.clone().lerp(cell.center, 0.55);
    ring.rotation.x = -Math.PI / 2; ring.position.set(floorAt.x, 0.03, floorAt.z);
    z.scene.add(ring);
    const P = this.poster = { cell, mesh, ring, pos: new THREE.Vector3(floorAt.x, 0, floorAt.z), canvas: null, fake: false, tell: '' };
    z.anims.push((t) => { ring.material.opacity = this.powers ? 0 : 0.3 + Math.sin(t * 4) * 0.2; });
    z.addInter(P.pos, 'Look at the poster', () => !this.powers && !!P.canvas, () => this.examine(), 'clue');
    this.paint();
    const mc = cells.find((c) => c !== z.wakeCell && c !== cell); // (Act 2 Recall: always high in here, so it reads)
    if (mc) memoryClue(z, mc.bed.clone().lerp(mc.center, 0.6), 'A cell in Ravenmoor', 'A Polaroid under the bed');
  }

  /** A picture for the poster: real or a fake (the call decides if she remembers). */
  paint() {
    const P = this.poster, zone = this.z.zone;
    posterFrames().then((frames) => {
      if (!P || this.poster !== P || this.z.zone !== zone || !this.z.scene) return;
      const frame = frames.length ? pick(frames) : null;
      const k = this.tries >= 2 ? 1 : fakeStrength(4); // (after two wrong calls the fakes get obvious)
      let fake = Math.random() < 0.5, cv = posterCanvas(frame, fake, k);
      if (!cv) { fake = false; cv = posterCanvas(frame, false); }
      Object.assign(P, { canvas: cv, fake, tell: cv?.tell || '' });
      if (!cv) return;
      const g = cv.getContext('2d'); // (the hotel's poster, re-captioned for the asylum)
      g.fillStyle = '#120a16'; g.fillRect(0, 296, cv.width, cv.height - 296);
      g.fillStyle = '#f2e6d0'; g.font = '700 15px Georgia, serif'; g.textAlign = 'center';
      g.fillText(pick(['Accept no substitutes', 'The real one. The only one.', 'Have you seen this woman?']), cv.width / 2, 318);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      P.mesh.material.dispose?.();
      P.mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    });
  }

  /** The call: Supergirl or impostor? Right = she remembers. */
  async examine() {
    const P = this.poster;
    if (!P?.canvas || this.powers) return;
    this.talking = true;
    let r;
    try {
      r = await spotCall({ img: P.canvas, fake: P.fake, tell: P.tell, title: 'SUPERGIRL OR IMPOSTOR?', sub: `Taped up in cell ${P.cell.id}. The face is yours… or is it?`, score: 'Call it right and you might remember who you are.' });
    } finally { this.talking = false; }
    if (!r) return;
    if (!r.right) {
      this.tries++;
      this.z.alert = Math.min(99, (this.z.alert || 0) + 10);
      this.say(pick(A2_LINES.wrongPoster), 'thought');
      toast('The picture swims. Look again in a moment: it won\'t look the same.', 'bad');
      P.canvas = null;
      setTimeout(() => this.paint(), 1500);
      return;
    }
    await this.remember();
  }

  /** She remembers: powers back for the rest of the visit, and a find toward her suit. */
  async remember() {
    this.powers = true;
    const inp = this.g.input;
    inp.setButton('xray', { label: 'X-RAY' }); inp.setButton('hear', { label: 'HEAR' });
    sfx.win?.(); flash('#ffe8f4');
    banner('SHE REMEMBERS', 'Powers back', '#ffd23a');
    comic.caption(fill(A2_LINES.remember, this.alias), { ms: 5000 });
    this.say(fill(A2_LINES.remember, this.alias), 'thought');
    this.z.en = 100;
    this.g.act.suitFind?.(this.piece, true);
  }
}
