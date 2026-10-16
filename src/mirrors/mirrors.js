// The hotel's new floor: the hall of mirrors (docs/design/act2.md "The hotel's new floor and the boss";
// job H1, docs/polish/handoff/act2-h1.md). Once Act 2's lair is open, the hotel's elevator goes to this
// floor instead of Act 1's 13th (that one stays as it was). HotelZone plays it (src/hotel/hotel.js: the
// doors, the struggle, waking in a random room), on a generated building (plan.js):
//   * a long tiled gallery in purple neon and graffiti, wet tiles, tall mirrors with her twin in the
//     glass (glass.js: faked, phone-cheap), rooms behind mirrored doors between them;
//   * "mirror portraits" on the walls: Supergirl or Impostor? (the call screen, act/spot.js);
//   * dressing rooms with a rail of four copies of a piece of her suit: Which one is hers? (rld/whichone.js);
//   * the cult's shrine: a stash of Super Squirt and a memory clue (act/recall.js);
//   * parlours baited with a Polaroid of her: traps (the S-shield struggle, club3d/struggle.js);
//   * Supergurl's acolytes in red robes hunting the gallery (cult.js, Kell's brain): a dart = a dose;
//   * the antechamber and the sealed door of the boss room (job H2 builds what's behind it: bossDoor()).
import * as THREE from 'three';
import { ClubZone } from '../clubzone.js';
import { HotelZone } from '../hotel/hotel.js';
import { buildMirrors, ANTE, GN } from './plan.js';
import { VIOLET, VIOLET_CSS, sealCanvas } from './art.js';
import { cultMethods } from './cult.js';
import { glassMethods } from './glass.js';
import { crewMethods } from '../factory/crew.js';
import { DOOR_W, DOOR_H } from '../hotel/plan.js';
import { posterCanvas, posterFrames } from '../hotel/art.js';
import { spotCall, fakeStrength } from '../act/spot.js';
import { makeCopies, whichOne, PIECES as RAIL } from '../rld/whichone.js';
import { memoryClue, stainRead, stashTaken, recallOf } from '../act/recall.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, clipsReady, nextClip } from '../club3d/clips.js';
import { playCutscene } from '../cutscene.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { lightPool } from '../look3d.js';
import { INTOX_HAZE } from '../state.js';
import { pick, shuffle, chance, $ } from '../util.js';

export const MIRRORS = { venue: 'Slutty Little Red Mini Skirt', portraits: 8, dartRep: 3, dose: 20, doseCap: 70, traps: 3 };
const MOOD = { bg: 0x06020c, fog: [0x12061e, 10, 34], hemi: [0xc8a0ff, 0x14061c, 0.55], amb: 0.1, key: 0xe8d0ff, keyK: 0.65 };

/** The zone's fields (act2run.js puts one on the hotel once the lair is open; ?zone=mirrors for tests). */
export function mirrorsFields(opts = {}) {
  return {
    kind: 'special', mode: 'mirrors', mirrors: true, act2: true, venue: MIRRORS.venue, theme: null, district: 'lair',
    def: { crime: 'the hall of mirrors' }, name: 'The hotel: the hall of mirrors', reward: 0,
    lockKey: 'The hotel', ttl: Infinity, color: VIOLET_CSS, glyph: '◈', risk: 'Act 2 lair',
    blurb: 'The hotel\'s new floor. Mirrors, red robes, and at the end of it a sealed door with your S cracked across it.',
    ...opts,
  };
}

const ROOM_TEXT = {
  parlour: ['A chaise, a low table, a ring of lipstick on a glass. On the wall: a mirror painted over with one word, YOU.', 'Velvet curtains over a wall of mirrors. Somebody has drawn a crown on every reflection.', 'A guest book. Every signature is "Supergirl", in a dozen different hands.'],
  dressing: ['A vanity with bulbs round the mirror, half of them dead. Wigs on stands: all blonde.', 'Make-up laid out like surgical tools. A card: "SHE WEARS IT SMUDGED."'],
  shrine: ['An altar in red cloth. On it, framed: a photo of "you" in your own suit, signed in gold. "To my faithful. S."', 'Candles, a gold S, and a ledger of names: the acolytes, and what each one paid to wear the robe.'],
};
const TRAP_TEXT = {
  chair: 'The chaise\'s arms snap shut on your wrists the moment you touch the Polaroid.',
  glass: 'The mirror swings out like a door and a cage drops behind it.',
  ring: 'A ring of red robes steps out of the curtains and the cords go tight.',
};

export class MirrorsZone extends HotelZone {
  themeFor() { return { name: 'The hall of mirrors', captives: 0, verb: 'Reach the sealed door', headline: 'HALL OF MIRRORS' }; }
  get staff() { return 'the High Acolyte'; }
  loadBuilding() { return buildMirrors(); }

  enter(p) {
    Object.assign(this, { darts: 0, called: 0, right: 0, finds: 0, polaroids: 0, reached: false, hunters: [], workers: [], trapObjs: [], rails: [], twins: null });
    super.enter(p);
  }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'punch', label: 'PUNCH', key: 'F' },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Dart gun</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    banner('THE HALL OF MIRRORS', 'The hotel\'s new floor', VIOLET_CSS);
    setTimeout(() => {
      if (this.done) return;
      toast('Every face in the glass is yours, or one of hers. The sealed door is at the end of the gallery. Red robes: break their line of sight, or punch them from behind.', 'info');
    }, 1800);
  }

  // ---------------------------------------------------------------- world
  buildWorld() {
    const c = this.club, S = this.scene;
    S.add(c.scene);
    S.background = new THREE.Color(MOOD.bg);
    S.fog = new THREE.Fog(...MOOD.fog);
    this.backdrop = false;
    S.add(new THREE.HemisphereLight(...MOOD.hemi));
    S.add(new THREE.AmbientLight(0xffffff, MOOD.amb));
    this.key.color.set(MOOD.key); this.key.intensity = MOOD.keyK;
    this.pools();
    this.buildDoors();
    this.wallMat = this.doorMat; // X-ray sees through the doors
    this.wallBaseOpacity = 1;
    this.placeClubGameplay();
  }

  pools() {
    const S = this.scene, add = (x, z, col, r, k) => { const m = lightPool(col, r, k); m.position.set(x, 0.02, z); S.add(m); return m; };
    let i = 0;
    for (let z = 2; z > GN - 6; z -= 5) add(0, z, VIOLET[i++ % 3], 2.6, 0.4);
    for (const r of this.club.rooms) add(r.cx, r.cz, { parlour: 0xff5ab0, dressing: 0xfff0e0, shrine: 0xff3a3a }[r.wing], 2.2, 0.3);
    this.doorGlow = add(0, ANTE.z0 + 1.6, 0xe050ff, 3, 0.4);
    this.anims.push((t) => { this.doorGlow.material.opacity = 0.25 + 0.2 * Math.sin(t * 2.4); });
  }

  buildDoors() {
    const c = this.club, M = c.M;
    this.doorMat = M.door.clone();
    this.doors = c.rooms.map((r) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, DOOR_H, DOOR_W), this.doorMat);
      mesh.position.set(r.door.x, DOOR_H / 2, r.door.z);
      this.scene.add(mesh);
      const col = { minX: r.door.x - 0.1, maxX: r.door.x + 0.1, minZ: r.door.z - DOOR_W / 2, maxZ: r.door.z + DOOR_W / 2, wall: true, mesh };
      this.colliders.push(col);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: plateTex(r.num), color: 0xe050ff, toneMapped: false }));
      plate.position.set(r.door.x - r.inward.x * 0.1, DOOR_H + 0.22, r.door.z);
      plate.rotation.y = Math.atan2(-r.inward.x, -r.inward.z);
      this.scene.add(plate);
      const d = { room: r, mesh, col, plate, open: false, home: mesh.position.clone(), slide: new THREE.Vector3(0, 0, 1) };
      this.addInter(r.door.clone().addScaledVector(r.inward, -0.6), `Open door ${r.num}`, () => !d.open, () => this.openDoor(d), 'door');
      return d;
    });
    this.addInter(new THREE.Vector3(0, 0, 5.2), 'The elevator: leave', () => !this.busy, () => this.leave());
  }

  // ---------------------------------------------------------------- layout
  placeClubGameplay() {
    const c = this.club;
    this.planLayout();
    this.spawn = c.entrance.pos.clone();
    this.spawnHeading = c.entrance.heading;
    this.exitRing.visible = false;
    this.placePortraits();
    this.placeRooms();
    this.placeSealDoor();
    this.placeCrew();
  }

  /** "Mirror portraits": frames of the hand-checked clips, half of them made fakes; call each one. */
  placePortraits() {
    const spots = [];
    for (const s of shuffle([...this.club.posters])) {
      if (spots.length >= MIRRORS.portraits) break;
      if (spots.every((q) => q.pos.distanceTo(s.pos) > 3)) spots.push(s);
    }
    const blank = new THREE.MeshBasicMaterial({ color: 0x2a1438 });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xc050ff, toneMapped: false });
    this.portraits = spots.map((s) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.25), blank);
      mesh.position.copy(s.pos); mesh.rotation.y = Math.atan2(s.n.x, s.n.z);
      this.scene.add(mesh);
      const fr = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.37), frameMat);
      fr.position.copy(s.pos).addScaledVector(s.n, -0.01); fr.rotation.y = mesh.rotation.y;
      this.scene.add(fr);
      const p = { mesh, pos: s.pos, canvas: null, fake: false, tell: '', done: false };
      this.addInter(s.pos.clone().addScaledVector(s.n, 0.9), 'Look into the portrait', () => !p.done && !!p.canvas, () => this.callPortrait(p), 'poster');
      return p;
    });
    const zone = this.zone;
    posterFrames().then((frames) => {
      if (this.zone !== zone || !this.scene || !frames.length) return;
      const k = fakeStrength(8 + (this.A?.fakes || 0)); // (late in the act: the fakes are good)
      for (const p of this.portraits) {
        let fake = chance(0.5), cv = posterCanvas(pick(frames), fake, k);
        if (!cv) { fake = false; cv = posterCanvas(pick(frames), false); }
        Object.assign(p, { canvas: cv, fake, tell: cv.tell });
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        p.mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      }
    });
  }

  async callPortrait(p) {
    if (p.done || !p.canvas) return;
    const r = await spotCall({ img: p.canvas, fake: p.fake, tell: p.tell, sub: 'A portrait in the hall of mirrors', score: `Called right: ${this.right}/${this.called}` });
    if (!r) return;
    p.done = true;
    this.called++;
    if (r.right) { this.right++; this.g.state.addRep(1, 'Called the cult\'s portrait'); }
    else { this.g.state.addIntox(6); toast('The glass swims. Which one of you was that?', 'bad'); }
    p.mesh.material.color?.set(r.right ? 0x9fffb8 : 0xff8a9a);
  }

  /** The rooms: two rails (Which one is hers?), the shrine (a stash, a memory clue), traps, the rest dressed. */
  placeRooms() {
    const pieces = this.railPieces();
    const parlours = shuffle(this.club.rooms.filter((r) => r.wing === 'parlour'));
    let rail = 0;
    for (const r of this.club.rooms) {
      this.addInter(new THREE.Vector3(r.cx, 0, r.cz).addScaledVector(r.inward, -0.4), 'Look around', () => true, () => dialog({ title: `Room ${r.num}`, text: pick(ROOM_TEXT[r.wing]) }));
      if (r.wing === 'dressing') this.placeRail(r, pieces[rail++ % pieces.length]);
      if (r.wing === 'shrine') this.placeShrine(r);
    }
    parlours.slice(0, MIRRORS.traps).forEach((r, i) => this.placeTrap(r, ['chair', 'glass', 'ring'][i % 3]));
    if (parlours[MIRRORS.traps]) this.placeStash(parlours[MIRRORS.traps], 'A dish of pink pills on the low table');
  }

  /** The two pieces she's furthest behind on (Act 2's suit finds), else any two. */
  railPieces() {
    const suit = this.g.act?.two?.B?.suit || {};
    return shuffle(Object.keys(RAIL)).sort((a, b) => (suit[a] || 0) - (suit[b] || 0)).slice(0, 2);
  }

  placeRail(r, piece) {
    const L = { room: r, piece, copies: null, cards: [], solved: false };
    this.rails.push(L);
    makeCopies(piece).then((copies) => {
      if (!this.scene || !copies) return;
      L.copies = copies;
      copies.forEach((cp, i) => {
        const t = new THREE.CanvasTexture(cp.canvas); t.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
        m.position.set(r.rail.x, 1.25, r.rail.z - 1.05 + i * 0.7);
        m.rotation.y = -Math.sign(r.inward.x) * Math.PI / 2;
        m.raycast = () => {};
        this.scene.add(m);
        L.cards.push(m);
      });
    });
    const stand = r.rail.clone().addScaledVector(r.inward, -1.0);
    this.addInter(stand, `The rail: which ${piece} is hers?`, () => !L.solved, () => this.pickPiece(L), 'clue');
  }

  async pickPiece(L) {
    if (!L.copies) { await dialog({ title: 'The rail', text: 'Empty hangers, swinging. Whatever hung here is gone.' }); L.solved = true; return; }
    const high = this.g.state.intox >= INTOX_HAZE;
    const res = await whichOne(L.piece, L.copies, { haze: high, flash: high && (recallOf(this.g) ? 'recall' : true) });
    if (!res) return;
    L.solved = true;
    for (const m of L.cards) m.visible = false;
    if (res.right) {
      sfx.win();
      this.finds++;
      this.g.act?.suitFind?.(L.piece, true);
      toast(`A find for her ${L.piece}.`, 'good');
      await stainRead(this.g, 'The stain on her ' + L.piece);
    } else sfx.lose();
  }

  /** The cult's shrine: Super Squirt in a gold dish on the altar, and a memory clue on the floor before it. */
  placeShrine(r) {
    this.placeStash(r, 'Super Squirt in a gold dish on the altar');
    memoryClue(this, new THREE.Vector3(r.cx, 0, r.cz + 1.1), 'The shrine in the hall of mirrors', 'A lipstick-stained glass by the altar');
  }

  placeStash(r, what) {
    const at = r.bench || new THREE.Vector3(r.cx, 0.8, r.cz);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.05, 12), new THREE.MeshBasicMaterial({ color: 0xffd21a, toneMapped: false }));
    const pills = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6), new THREE.MeshBasicMaterial({ color: 0xff3fb8, toneMapped: false }));
    dish.position.set(at.x, at.y + 0.03, at.z); pills.position.set(at.x, at.y + 0.08, at.z); pills.scale.y = 0.45;
    this.scene.add(dish, pills);
    const s = { taken: false };
    this.stashes = [...(this.stashes || []), s];
    const stand = new THREE.Vector3(at.x, 0, at.z).addScaledVector(r.inward, -0.9);
    this.addInter(stand, `Take it: ${what.toLowerCase()}`, () => !s.taken, async () => {
      s.taken = true; pills.visible = false;
      if (!(await stashTaken(this.g, 'A stash in the hall of mirrors')) && !recallOf(this.g)) { this.g.state.addIntox(18); toast('Super Squirt. Sweet, pink, and the mirrors start to breathe.', 'bad'); }
    }, 'drink');
  }

  /** A Polaroid of "her" left as bait in a parlour: take it and the trap shuts (the struggle). */
  placeTrap(r, kind) {
    const M = this.club.M, at = r.bench || new THREE.Vector3(r.cx, 0.5, r.cz);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.24), new THREE.MeshBasicMaterial({ color: 0xf4f0e8, toneMapped: false, side: THREE.DoubleSide }));
    pic.rotation.x = -Math.PI / 2; pic.position.set(at.x, at.y + 0.02, at.z);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 20), new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(at.x, at.y + 0.03, at.z);
    this.scene.add(pic, glow);
    const wired = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false, transparent: true }));
    wired.rotation.x = -Math.PI / 2; wired.position.set(at.x, 0.05, at.z); wired.renderOrder = 11; wired.visible = false;
    this.scene.add(wired); this.hidden.push(wired); // (X-ray: the trap shows)
    if (kind === 'glass') { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 1.2), M.frame); f.position.set(r.back.x + r.inward.x * 0.6, 1.1, r.back.z); this.scene.add(f); }
    const t = { r, kind, pic, glow, sprung: false };
    this.trapObjs.push(t);
    this.anims.push((tt) => { pic.visible = glow.visible = !t.sprung; glow.material.opacity = 0.4 + 0.4 * Math.sin(tt * 4); });
    this.addInter(new THREE.Vector3(at.x, 0, at.z).addScaledVector(r.inward, -0.8), 'Take the Polaroid of "you"', () => !t.sprung, () => this.springTrap(t), 'trap');
  }

  async springTrap(t) {
    t.sprung = true;
    const free = await this.trap({ title: 'TRAPPED!', text: TRAP_TEXT[t.kind] });
    if (free) { this.polaroids++; this.g.state.addRep(2, 'Burned one of the cult\'s Polaroids'); toast('The Polaroid: "you" on a bar top, in your stolen suit. It goes in the bin, in pieces.', 'good'); }
  }

  /** The struggle over a held clip. Free: back on her feet. Not: the alarm, and the robes come for her. */
  async trap({ title, text }) {
    sfx.trap(); flash(VIOLET_CSS);
    await clipsReady;
    const free = await struggle({ clip: nextClip(CLIPS.captive), title, text, diff: this.g.state.intox >= INTOX_HAZE ? 'hard' : 'normal' });
    if (free) { sfx.win(); banner('FREE!', '', '#3ee08a'); this.grace = this.t + 1.2; return true; }
    sfx.alarm();
    banner('ALARM!', 'The red robes are coming', '#ff2a5a');
    this.kellAlarm('The cords give at last, but a bell is ringing somewhere in the glass. They know where you are: run!');
    this.grace = this.t + 1.5;
    return false;
  }

  /** The sealed door of the boss room (job H2 builds the room and the fight; this is the stub). */
  placeSealDoor() {
    const tex = new THREE.CanvasTexture(sealCanvas()); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 * 1.25 * 0.86), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set(0, 1.45, ANTE.z0 + 0.16);
    this.scene.add(m);
    this.sealMesh = m;
    this.addInter(this.club.sealDoor, 'The sealed door', () => !this.busy, () => this.bossDoor(), 'seal');
  }

  async bossDoor() {
    const first = !this.reached;
    this.reached = true;
    if (first) { sfx.alarm(); flash(VIOLET_CSS); this.g.state.save(); }
    await dialog({
      title: 'The sealed door', cls: 'villain',
      text: `A mirror the size of a door, your S cracked across it, and no handle on this side. Through the glass, a voice like yours, but sweeter:<div class="h13-note">“Not yet, little copy. Come back when you can't tell us apart.”<i>— Supergurl</i></div><span class="hint">The boss room is sealed for now (it opens in a later update).</span>`,
    });
  }

  async leave() {
    const v = await dialog({ title: 'The elevator', text: 'Leave the hall of mirrors? The floor will be here; so will they.', options: [{ label: 'Take the elevator down', value: true }, { label: 'Stay', value: false }] });
    if (!v || this.done) return;
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: 0 });
  }

  // ---------------------------------------------------------------- a dart: the dose
  async kellHit() {
    if (this.done || this.wiping) return;
    this.wiping = true;
    this.busy = true;
    this.setXray(false);
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    flash(VIOLET_CSS); sfx.trap();
    banner('DARTED!', 'Super Squirt', VIOLET_CSS);
    this.darts++;
    const st = this.g.state;
    st.addRep(-MIRRORS.dartRep, 'Darted in the hall of mirrors');
    st.intox = Math.min(MIRRORS.doseCap, (st.intox || 0) + MIRRORS.dose);
    await new Promise((r) => setTimeout(r, 900));
    if (this.g.mode !== this) return;
    await clipsReady;
    await playCutscene({ src: nextClip(CLIPS.captive), maxSecs: 10, caption: 'Purple light, a hundred of her in the glass… then nothing.' });
    if (this.g.mode !== this) return;
    this.wakeInRoom();
    await dialog({
      title: `Room ${this.wokeIn.num}`, cls: 'villain',
      text: `You come to on the wet tiles of room ${this.wokeIn.num}, every door shut, and your reflection is already awake, watching you. A card is tucked in your top:<div class="h13-note">“She lets you keep trying. It's funnier.”<i>— The High Acolyte</i></div>`,
    });
    this.wiping = false;
    this.busy = false;
    this.grace = this.t + 3;
  }

  punch() {
    if (this.punchCrew()) {
      this.punchT = 0.25;
      if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
      return;
    }
    const k = this.kell; this.kell = null; super.punch(); this.kell = k; // (HotelZone's: the plain punch)
  }

  update(dt) {
    super.update(dt);
    if (this.warming || this.done || !this.scene || !this.hero) return;
    this.updateGlass();
  }

  // ---------------------------------------------------------------- the HUD
  objectives() {
    const rails = this.rails.filter((L) => L.solved).length;
    const next = this.rails.find((L) => !L.solved);
    return [
      { t: `Which one is hers? Rails checked: ${rails}/${this.rails.length}`, done: rails >= this.rails.length, target: next ? next.room.rail : null },
      { t: `Portraits: ${this.right}/${this.called} called right`, done: false },
      { t: `The cult's Polaroids burned: ${this.polaroids}`, done: false, skip: !this.polaroids },
      { t: this.reached ? 'The sealed door: not yet' : 'Find the sealed door at the end of the gallery', done: this.reached, final: true, target: this.club.sealDoor },
    ].filter((o) => !o.skip);
  }

  hud() {
    ClubZone.prototype.hud.call(this);
    if (!this.scene || this.warming) return;
    $('hud-sub').textContent = [this.crewStatus(), this.darts ? `Darted ${this.darts}×` : '', this.xray ? 'X-RAY' : ''].filter(Boolean).join(' · ');
    const ch = Math.max(0, ...this.hunters.map((k) => (k.stun <= 0 && k.state === 'charge' ? k.charge : 0)));
    const al = $('b-alert'); if (al) al.style.width = Math.min(100, ch * 100) + '%';
  }

  /** Named viewpoints for the harness (tools/shots/mirrors.js). */
  debugSpots() {
    const c = this.club, m = c.mirrors[2], dr = c.rooms.find((r) => r.wing === 'dressing');
    return [
      { name: 'lobby', x: 0, z: 2.5, yaw: 0 },
      { name: 'gallery', x: 0, z: -12, yaw: 0 },
      { name: 'mirror', x: m.x + m.n.x * 1.6, z: m.zc, yaw: Math.atan2(-m.n.x, 0) + Math.PI },
      { name: 'dressing', x: dr.cx - dr.inward.x * 0.6, z: dr.cz, yaw: Math.atan2(dr.inward.x, 0) - Math.PI },
      { name: 'sealed_door', x: 0, z: ANTE.z0 + 3.5, yaw: 0 },
    ];
  }
}

const plates = new Map();
function plateTex(label) {
  if (plates.has(label)) return plates.get(label);
  const c = document.createElement('canvas'); c.width = 128; c.height = 52;
  const g = c.getContext('2d');
  g.fillStyle = '#e050ff'; g.fillRect(0, 0, 128, 52);
  g.fillStyle = '#120a16'; g.fillRect(4, 4, 120, 44);
  g.fillStyle = '#ffffff'; g.font = '900 32px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(label), 64, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  plates.set(label, t);
  return t;
}

Object.assign(MirrorsZone.prototype, crewMethods, cultMethods, glassMethods);
