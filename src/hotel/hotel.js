// The Slutty Little Red Mini Skirt, Floor 13 (docs/design/act1.md "The lair"): the act's boss floor.
// The club engine plays it (ClubZone, like the asylum), on a generated building (plan.js):
//   * red-light halls in neon green, purple and red, their walls covered in posters of "her":
//     examine one and call it, Supergirl or Impostor (a score, just for fun);
//   * four wings and the Screening Rooms, each room behind its own door: notes with the seals'
//     answers, the wing's dressing (the knockoff costumes, Kell's jars, the paparazzi's phones),
//     and traps baited with a jigsaw piece (the struggle; fail and the alarm brings Kell);
//   * five seals on the Ballroom doors: a Seal Key (an unmasked lieutenant) and a riddle each;
//   * Dr Kell hunting the halls with his kryptonite ray (kell.js): hit = a memory wipe: a clip,
//     she wakes in a random room, every door shut, her notes forgotten, and one of his experiments
//     on her. The seals stay set (in the act's state: they survive leaving, too);
//   * the Grand Ballroom (ballroom.js): the masquerade, then the fight.
import * as THREE from 'three';
import { ClubZone } from '../clubzone.js';
import { buildHotel, DOOR_W, DOOR_H, BALL } from './plan.js';
import { NEON, NEON_CSS, posterCanvas, posterFrames, costumeImage, COSTUMES } from './art.js';
import { kellMethods } from './kell.js';
import { ballroomMethods } from './ballroom.js';
import { ACT1, SEALS, EXPERIMENTS } from '../act/act1.js';
import { spotCall, fakeStrength } from '../act/spot.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, clipsReady, nextClip } from '../club3d/clips.js';
import { playCutscene } from '../cutscene.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { lightPool } from '../look3d.js';
import { pick, shuffle, chance, $ } from '../util.js';
import { HERO } from '../data.js';

const MOOD = { bg: 0x07030a, fog: [0x14061c, 12, 38], hemi: [0xd8a0ff, 0x1a0610, 0.55], amb: 0.1, key: 0xffd0e8, keyK: 0.7 };
const POSTERS = 18;     // posters per visit (of the ~50 spots on the hall walls)
const WIPE_REP = 3;

const ROOM_TEXT = {
  gallery: ['Blow-ups of "you" cover the walls: dancing on a bar, slumped in a booth, kissing a stranger. Half of them are the impostor. Some aren\'t.', 'A darkroom. Trays of developer, a line of drying Polaroids, and a jigsaw piece taped to every one.'],
  wardrobe: ['Knockoff costumes, a dozen of them, in sizes from petite to "who cares".', 'A seamstress\'s dummy wearing your cape. The stitching is better than yours.'],
  lab: ['Jars of something green and glowing, labelled K-1 to K-40. Most are empty.', 'A cot with restraints, a drip stand, and a clipboard: SUBJECT: S. (KRYPTONIAN). DOSE TOLERANCE: REMARKABLE.'],
  switchboard: ['A wall of phones. Every one is ringing, and every caller wants to know where Supergirl is tonight.', 'Photographers\' rota pinned to a corkboard: who tails you, where, and which drink to send over.'],
  screening: ['Rows of velvet seats facing a screen. The film: you, on a loop.', 'A projection booth. The reels are labelled with dates. You were "busy" on every one of them.'],
};
const NOTES = {
  0: 'The Gallery\'s seal wants what the papers print: <b>a photograph</b>.',
  1: 'The Wardrobe\'s seal: what the impostor calls her costume. <b>A uniform.</b> She has a sense of humour.',
  2: 'The Lab\'s seal is green, and it is Kell\'s favourite thing in the world: <b>kryptonite</b>.',
  3: 'The Switchboard\'s seal: what the paparazzi leave behind them. <b>Footsteps.</b>',
  4: 'The Screening Rooms\' seal: the same scene, again and again. <b>A loop.</b>',
};
const SWITCHBOARD = ['"She just left the Hive. Heading east."', '"Send over the champagne. The special one."', '"Flash wants her in the hot seat by Saturday."', '"The impostor\'s ready. Same wig, same corner."'];

export class HotelZone extends ClubZone {
  themeFor() { return { name: `Floor ${ACT1.floor}`, captives: 0, verb: '' }; }
  get staff() { return 'Dr Kell'; }
  loadBuilding() { return buildHotel(); }

  get A() { return this.g.act.A; }

  enter(p) {
    Object.assign(this, { phase: 'floor', wipes: 0, notes: {}, posterRight: 0, posterCalled: 0, tagT: 0, xrayLockT: 0, sensT: 0, kell: null, ball: null });
    super.enter(p);
  }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'punch', label: 'PUNCH', key: 'F' },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span id="h13-meter">Kryptonite</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    banner(`FLOOR ${ACT1.floor}`, ACT1.hotel, '#39ff6a');
    setTimeout(() => {
      if (this.done) return;
      const set = this.sealCount();
      toast(set >= 5 ? 'Every seal is set. The Grand Ballroom is at the end of the main hall.' : `Five seals lock the Grand Ballroom (${set}/5 set). Watch out for Dr Kell's ray: break his line of sight, or punch him from behind.`, 'info');
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

  /** Light pools in the neon colours down the halls, warm ones in the rooms, the ballroom's chandeliers. */
  pools() {
    const S = this.scene, c = this.club, add = (x, z, col, r, k) => { const m = lightPool(col, r, k); m.position.set(x, 0.02, z); S.add(m); return m; };
    let i = 0;
    for (let z = 2; z > -46; z -= 5.5) add(0, z, NEON[i++ % 3], 2.4, 0.42);
    for (const w of c.wings) for (let x = 4; x < 16; x += 4.5) add(w.side * x, w.zc, NEON[i++ % 3], 2.2, 0.4);
    for (const r of c.rooms) add(r.cx, r.cz, { gallery: 0xffe0b0, wardrobe: 0xff8ac8, lab: 0x9fffc0, switchboard: 0xffc070, screening: 0x8a70ff }[r.wing], 2.2, 0.3);
    for (const [x, z] of [[-7, -52], [7, -52], [-7, -60], [7, -60], [0, -56]]) add(x, z, 0xfff0d0, 4, 0.32);
    this.stageLights = [add(-5, -67, 0xff2a5a, 3, 0.4), add(5, -67, 0xc050ff, 3, 0.4), add(0, -66, 0x39ff6a, 2.5, 0.35)];
    this.anims.push((t) => this.stageLights.forEach((l, k) => { l.material.opacity = 0.25 + 0.2 * Math.sin(t * 3 + k * 2); }));
  }

  buildDoors() {
    const c = this.club, M = c.M;
    this.doorMat = M.door.clone();
    this.doors = c.rooms.map((r) => {
      const g = r.alongX ? new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.12) : new THREE.BoxGeometry(0.12, DOOR_H, DOOR_W);
      const mesh = new THREE.Mesh(g, this.doorMat);
      mesh.position.set(r.door.x, DOOR_H / 2, r.door.z);
      this.scene.add(mesh);
      const hx = r.alongX ? DOOR_W / 2 : 0.1, hz = r.alongX ? 0.1 : DOOR_W / 2;
      const col = { minX: r.door.x - hx, maxX: r.door.x + hx, minZ: r.door.z - hz, maxZ: r.door.z + hz, wall: true, mesh };
      this.colliders.push(col);
      // the room number over the door, red until she's been in (a wipe makes her forget)
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: plateTex(r.num), color: 0xff4a6a, toneMapped: false }));
      const out = r.inward.clone().multiplyScalar(-0.1);
      plate.position.set(r.door.x + out.x, DOOR_H + 0.22, r.door.z + out.z);
      plate.rotation.y = Math.atan2(-r.inward.x, -r.inward.z);
      this.scene.add(plate);
      const d = { room: r, mesh, col, plate, open: false, home: mesh.position.clone(), slide: r.alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) };
      this.addInter(r.door.clone().addScaledVector(r.inward, -0.6), `Open room ${r.num}`, () => !d.open && !this.ball, () => this.openDoor(d), 'door');
      return d;
    });
    // the ballroom's double doors
    const bd = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.16), M.ballDoor);
    bd.position.set(0, 1.3, -46);
    this.scene.add(bd);
    this.ballDoorCol = { minX: -1.2, maxX: 1.2, minZ: -46.1, maxZ: -45.9, wall: true, mesh: bd };
    this.colliders.push(this.ballDoorCol);
    this.ballDoorMesh = bd;
    this.addInter(new THREE.Vector3(0, 0, -45.2), 'The Grand Ballroom', () => !this.ballOpen, () => this.ballroomDoor(), 'door');
    // the elevator: the way out
    this.addInter(new THREE.Vector3(0, 0, 5.2), 'Elevator: leave the hotel', () => !this.ball, () => this.leave());
  }

  openDoor(d, quiet = false) {
    if (d.open) return;
    d.open = true;
    d.col.disabled = true;
    if (!quiet) sfx.door();
    const m = d.mesh, from = m.position.clone(), to = d.home.clone().addScaledVector(d.slide, DOOR_W * 0.92);
    let k = 0;
    this.anims.push((t, dt) => { if (k < 1 && d.open) { k = Math.min(1, k + dt * 2.5); m.position.lerpVectors(from, to, k); } });
  }

  closeDoors() {
    for (const d of this.doors) { d.open = false; d.col.disabled = false; d.mesh.position.copy(d.home); d.plate.material.color.set(0xff4a6a); }
  }

  /** Closed doors block Kell's view as well as the walls. */
  clearLOS(a, b) {
    if (!super.clearLOS(a, b)) return false;
    for (const c of this.colliders) if (c.wall && !c.disabled && segHits(a.x, a.z, b.x, b.z, c)) return false;
    return true;
  }

  // ---------------------------------------------------------------- layout
  placeClubGameplay() {
    const c = this.club;
    this.planLayout();
    this.exitRing.visible = false;
    this.spawn = c.entrance.pos.clone();
    this.spawnHeading = c.entrance.heading;
    this.placePosters();
    this.placeSeals();
    this.placeRooms();
    this.placeKell();
    this.ballOpen = false; // (the doors open when she walks up to them with every seal set)
  }

  placePosters() {
    const spots = [];
    for (const s of shuffle([...this.club.posters])) {
      if (spots.length >= POSTERS) break;
      if (spots.every((q) => q.pos.distanceTo(s.pos) > 2.2)) spots.push(s);
    }
    const placeholder = new THREE.MeshBasicMaterial({ color: 0x2a1430 });
    this.posters = spots.map((s) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35), placeholder);
      mesh.position.copy(s.pos);
      mesh.rotation.y = Math.atan2(s.n.x, s.n.z);
      this.scene.add(mesh);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.45), new THREE.MeshBasicMaterial({ color: 0xc8a040 }));
      frame.position.copy(s.pos).addScaledVector(s.n, -0.01); frame.rotation.y = mesh.rotation.y;
      this.scene.add(frame);
      const p = { mesh, n: s.n, pos: s.pos, canvas: null, fake: false, tell: '', done: false };
      this.addInter(s.pos.clone().addScaledVector(s.n, 0.9), 'Examine the poster', () => !p.done && !!p.canvas, () => this.examinePoster(p), 'poster');
      return p;
    });
    // the pictures: frames of the hand-checked clips, half of them made fakes
    const zone = this.zone;
    posterFrames().then((frames) => {
      if (this.zone !== zone || !this.scene || !frames.length) return;
      const k = fakeStrength((this.A.fakes || 0) + 4);
      for (const p of this.posters) {
        const frame = pick(frames);
        let fake = chance(0.5), cv = posterCanvas(frame, fake, k);
        if (!cv) { fake = false; cv = posterCanvas(frame, false); }
        Object.assign(p, { canvas: cv, fake, tell: cv.tell });
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
        p.mesh.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      }
    });
  }

  async examinePoster(p) {
    if (p.done || !p.canvas) return;
    const r = await spotCall({ img: p.canvas, fake: p.fake, tell: p.tell, sub: 'A poster on the hall wall', score: `Posters called right: ${this.posterRight}/${this.posterCalled}${this.A.posterBest ? ` · best ${this.A.posterBest}` : ''}` });
    if (!r) return;
    p.done = true;
    this.posterCalled++;
    if (r.right) this.posterRight++;
    if (this.posterRight > (this.A.posterBest || 0)) { this.A.posterBest = this.posterRight; this.g.state.save(); }
    p.mesh.material.color?.set(r.right ? 0x9fffb8 : 0xff8a9a); // a tint: called
  }

  sealCount() { return SEALS.reduce((n, _, i) => n + (this.A.seals?.[i] ? 1 : 0), 0); }
  keysLeft() { return this.g.act.keys() - this.sealCount(); }

  placeSeals() {
    const M = this.club.M;
    this.sealObjs = this.club.seals.map((s) => {
      const g = new THREE.Group();
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), M.black);
      ped.position.y = 0.55; g.add(ped);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a5a, toneMapped: false }));
      slot.position.set(0, 1.45, 0); g.add(slot);
      g.position.copy(s.pos); g.rotation.y = s.face;
      this.scene.add(g);
      this.colliders.push({ minX: s.pos.x - 0.35, maxX: s.pos.x + 0.35, minZ: s.pos.z - 0.35, maxZ: s.pos.z + 0.35, mesh: ped });
      const o = { ...s, slot };
      const lit = () => slot.material.color.set(this.A.seals?.[s.i] ? 0x39ff6a : 0xff2a5a);
      lit(); o.lit = lit;
      this.anims.push((t) => { slot.rotation.z = this.A.seals?.[s.i] ? 0 : Math.sin(t * 2 + s.i) * 0.2; });
      this.addInter(s.pos, `Set the seal: ${s.name}`, () => !this.A.seals?.[s.i], () => this.setSeal(o), 'seal');
      return o;
    });
  }

  async setSeal(o) {
    const S = SEALS[o.i];
    if (this.keysLeft() <= 0) {
      await dialog({ title: S.name, text: `A jigsaw-shaped lock, glowing red. It takes a <b>Seal Key</b>, and you've used all yours.<span class="hint">Unmask another of the Puzzle Maker's lieutenants (the act board) to get one.</span>` });
      return;
    }
    const opts = shuffle([S.a, ...S.wrong]).map((a) => ({ label: a, value: a }));
    const note = this.notes[o.i] ? `<span class="hint">Your note: ${NOTES[o.i].replace(/<\/?b>/g, '')}</span>` : '<span class="hint">The answer is written down somewhere in this wing. Or guess, and risk the trap.</span>';
    const v = await dialog({ title: `${S.name}: the seal`, speaker: 'The Puzzle Maker (engraved)', text: `“${S.q}”${note}`, options: [...opts, { label: 'Step away', value: null }] });
    if (!v) return;
    if (v === S.a) {
      this.A.seals = this.A.seals || {};
      this.A.seals[o.i] = true;
      this.g.state.save();
      o.lit();
      sfx.win(); flash('#39ff6a');
      banner('SEAL SET', `${this.sealCount()}/5 · ${S.name}`, '#39ff6a');
      return;
    }
    sfx.lose();
    await this.trap({ text: `Wrong. The floor under the console drops a few inches and the restraints snap shut round your ankles.`, title: 'WRONG ANSWER!' });
  }

  /** Each wing's rooms: a note (a seal's answer), two traps baited with a jigsaw piece, the wing's dressing. */
  placeRooms() {
    const byWing = {};
    for (const r of this.club.rooms) (byWing[r.wing] = byWing[r.wing] || []).push(r);
    this.roomObjs = [];
    for (const [wing, rooms] of Object.entries(byWing)) {
      const seal = SEALS.findIndex((s) => s.wing === wing);
      const list = shuffle([...rooms]);
      list.forEach((r, i) => {
        const what = i === 0 ? 'note' : i <= 2 ? 'trap' : 'dress';
        this.dressRoom(r, wing);
        if (what === 'note') this.placeNote(r, seal);
        else if (what === 'trap') this.placeTrap(r);
      });
    }
  }

  /** What makes a room its wing's: a big photo, a costume on the bed, jars, phones, a screen. */
  dressRoom(r, wing) {
    const S = this.scene, back = r.back || new THREE.Vector3(r.cx, 0, r.cz);
    const face = Math.atan2(-r.inward.x, -r.inward.z); // facing the door
    const at = r.inward.clone().multiplyScalar(-1); // toward the door (from the back)
    const spot = new THREE.Vector3(r.cx, 0, r.cz).addScaledVector(at, -0.2);
    const look = pick(ROOM_TEXT[wing]);
    if (wing === 'wardrobe' && r.bed) {
      const name = pick(chance(0.6) ? COSTUMES.knockoff : COSTUMES.replica);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.96), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, alphaTest: 0.1 }));
      plane.rotation.x = -Math.PI / 2; plane.rotation.z = r.alongX ? 0 : Math.PI / 2;
      plane.position.set(r.bed.x, r.bed.y + 0.01, r.bed.z);
      S.add(plane);
      costumeImage(name).then((cv) => {
        if (!cv || !this.scene) return;
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
        plane.material.map = t; plane.material.opacity = 1; plane.material.needsUpdate = true;
        plane.userData.cv = cv;
      });
      const knock = COSTUMES.knockoff.includes(name);
      this.addInter(new THREE.Vector3(r.bed.x, 0, r.bed.z).addScaledVector(at, 1.1), 'Examine the costume', () => true, async () => {
        const cv = plane.userData.cv;
        await dialog({ title: knock ? 'A knockoff' : 'A replica', text: `${cv ? `<img class="h13-costume" src="${cv.toDataURL('image/png')}">` : ''}${knock ? 'Tube top, vinyl skirt, the cheap boots. The impostor\'s first outfits: close enough for a blurry Polaroid.' : 'Her classic suit, stitch for stitch. Even the cape\'s hem is right. The impostor\'s tailor is getting better.'} A tag in the collar: <b>"Property of the Puzzle Maker. One size fits everyone."</b>` });
      });
      return;
    }
    if (wing === 'gallery') {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.1), new THREE.MeshBasicMaterial({ color: 0x3a2a40 }));
      const wallAt = back.clone().addScaledVector(at, -0.62);
      plane.position.set(wallAt.x, 1.5, wallAt.z); plane.rotation.y = face;
      S.add(plane);
      const zone = this.zone;
      posterFrames().then((frames) => {
        if (this.zone !== zone || !this.scene || !frames.length) return;
        const cv = posterCanvas(pick(frames), chance(0.5), 0.8) || posterCanvas(pick(frames), false);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
        plane.material = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
      });
    }
    if (wing === 'lab' && r.bench) {
      for (const k of [-0.6, 0, 0.6]) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.75, toneMapped: false }));
        jar.position.set(r.bench.x + (r.alongX ? k : 0), r.bench.y + 0.17, r.bench.z + (r.alongX ? 0 : k));
        S.add(jar);
      }
    }
    if (wing === 'switchboard' && r.desk) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ color: 0x6ad0ff, toneMapped: false }));
      const wallAt = back.clone().addScaledVector(at, -0.38);
      glow.position.set(wallAt.x, 1.28, wallAt.z); glow.rotation.y = face;
      S.add(glow);
      this.anims.push((t) => { glow.material.color.setHSL(0.55, 0.8, 0.45 + 0.1 * Math.sin(t * 7 + r.num)); });
    }
    if (wing === 'screening' && r.screen) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ color: 0xd8d0ff, toneMapped: false }));
      scr.position.copy(r.screen); scr.rotation.y = face;
      S.add(scr);
      this.anims.push((t) => { scr.material.color.setHSL(0.72, 0.3, 0.55 + 0.25 * Math.abs(Math.sin(t * 13 + r.num))); });
    }
    // reading the room: a line of story, and in the Screening Rooms the film itself
    this.addInter(spot, wing === 'screening' ? 'Watch the screen' : wing === 'switchboard' ? 'Listen in on the phones' : 'Look around', () => true, async () => {
      if (wing === 'screening') { await clipsReady; await playCutscene({ src: nextClip(CLIPS.press), maxSecs: 9, caption: 'The film on the screen: you, on a loop.' }); return; }
      await dialog({ title: `Room ${r.num}`, text: wing === 'switchboard' ? `${look}<br><br>${pick(SWITCHBOARD)}` : look });
    });
  }

  placeNote(r, seal) {
    const at = r.bed || r.bench || r.desk || new THREE.Vector3(r.cx, 0.8, r.cz);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: 0xffe24a, toneMapped: false }));
    card.position.set(at.x, (at.y || 0.8) + 0.06, at.z);
    this.scene.add(card);
    this.anims.push((t) => { card.rotation.y = t * 1.2; card.position.y = (at.y || 0.8) + 0.08 + Math.sin(t * 3) * 0.03; });
    const stand = new THREE.Vector3(at.x, 0, at.z).addScaledVector(r.inward, -0.9);
    this.addInter(stand, 'Read: a card in his handwriting', () => !this.notes[seal], async () => {
      sfx.pickup();
      this.notes[seal] = true;
      await dialog({ title: 'A card, in the Puzzle Maker\'s neat hand', text: `${NOTES[seal]}<span class="hint">Remember it. If Kell's ray catches you, you won't.</span>` });
    }, 'note');
  }

  /** A device baited with a glowing jigsaw piece: take it and the trap shuts. */
  placeTrap(r) {
    const M = this.club.M, S = this.scene, p = new THREE.Vector3(r.cx, 0, r.cz);
    const kind = r.wing === 'lab' ? 'pod' : r.wing === 'screening' ? 'chair' : pick(['chair', 'cage']);
    const g = new THREE.Group();
    const part = (geo, mat, y, z = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(0, y, z); m.rotation.x = rx; g.add(m); return m; };
    if (kind === 'chair') {
      part(new THREE.BoxGeometry(0.6, 0.08, 0.6), M.steel, 0.5);
      part(new THREE.BoxGeometry(0.6, 0.8, 0.08), M.steel, 0.9, -0.28);
      for (const y of [0.62, 1.0]) part(new THREE.TorusGeometry(0.3, 0.03, 6, 16), M.black, y, -0.05, Math.PI / 2);
    } else if (kind === 'cage') {
      part(new THREE.BoxGeometry(1.2, 2.1, 1.2), new THREE.MeshBasicMaterial({ color: 0xc8a040, wireframe: true }), 1.05);
    } else {
      part(new THREE.CylinderGeometry(0.55, 0.55, 2.0, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fffc0, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), 1.0);
      part(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14), M.steel, 0.06);
    }
    g.position.copy(p);
    S.add(g);
    const bait = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd21a, toneMapped: false }));
    bait.position.set(p.x, 1.25, p.z);
    S.add(bait);
    // X-ray shows the wiring under it
    const wired = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false, transparent: true }));
    wired.rotation.x = -Math.PI / 2; wired.position.set(p.x, 0.05, p.z); wired.renderOrder = 11; wired.visible = false;
    S.add(wired); this.hidden.push(wired);
    const t = { r, kind, bait, sprung: false };
    this.anims.push((tt) => { bait.rotation.y = tt * 2; bait.visible = !t.sprung; });
    this.addInter(p.clone().addScaledVector(r.inward, -0.8), 'Take the jigsaw piece', () => !t.sprung, () => this.springTrap(t), 'trap');
  }

  async springTrap(t) {
    t.sprung = true;
    const free = await this.trap({
      title: 'TRAPPED!',
      text: { chair: 'The chair\'s straps whip round your wrists the moment you touch the piece.', cage: 'The cage drops. The bars hum: kryptonite, threaded through the steel.', pod: 'The pod slams shut and fills with green mist.' }[t.kind],
    });
    if (free) { this.g.state.addRep(3, 'A piece of his puzzle'); toast('🧩 A piece of the Puzzle Maker\'s puzzle. Evidence.', 'good'); }
  }

  /** The struggle over a held clip. Free: back on her feet. Not: the alarm, and Kell comes for her. */
  async trap({ title, text }) {
    sfx.trap(); flash('#ff3fb8');
    await clipsReady;
    const free = await struggle({ clip: nextClip(CLIPS.captive), title, text, diff: this.sensT > 0 ? 'hard' : 'normal' });
    if (free) { sfx.win(); banner('FREE!', '', '#3ee08a'); this.grace = this.t + 1.2; return true; }
    sfx.alarm();
    banner('ALARM!', 'Dr Kell is coming', '#ff2a5a');
    this.kellAlarm('The restraints let go at last, but the alarm is ringing. Kell knows where you are: run!');
    this.grace = this.t + 1.5;
    return false;
  }

  // ---------------------------------------------------------------- the ballroom doors, leaving
  async ballroomDoor() {
    const n = this.sealCount();
    if (n < 5) {
      const list = SEALS.map((s, i) => `<div class="item">${this.A.seals?.[i] ? '✅' : '🔴'} <b>${s.name}</b></div>`).join('');
      await dialog({ title: 'The Grand Ballroom', text: `Gilded doors, music and laughter behind them. Five jigsaw locks across the middle: ${n}/5 set.<div class="list">${list}</div><span class="hint">Each seal is at the end of its wing (the Screening Rooms' is right here by the doors). Each takes a Seal Key and a riddle.</span>` });
      return;
    }
    const go = await dialog({ title: 'The Grand Ballroom', text: 'Every seal is set. The doors swing open on a masked ball: music, chandeliers, a hundred masks turning to look at you. Somewhere in that crowd is the Puzzle Maker.<span class="hint">Find him with the clues his lieutenants gave you (the act board). Accuse the wrong guest and you\'ll regret it.</span>', options: [{ label: 'Go in', value: true, cls: 'risky' }, { label: 'Not yet', value: false }] });
    if (!go) return;
    this.openBallroom();
  }

  openBallroom() {
    this.ballOpen = true;
    this.ballDoorCol.disabled = true;
    sfx.door();
    const m = this.ballDoorMesh;
    let k = 0;
    this.anims.push((t, dt) => { if (k < 1) { k = Math.min(1, k + dt * 1.5); m.position.y = 1.3 + k * 2.7; } });
    this.startBallroom();
  }

  async leave() {
    const v = await dialog({ title: 'The elevator', text: 'Leave the 13th floor? The seals you\'ve set stay set.', options: [{ label: 'Take the elevator down', value: true }, { label: 'Stay', value: false }] });
    if (!v || this.done) return;
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: 0 });
  }

  // ---------------------------------------------------------------- Kell's ray: the memory wipe
  async kellHit() {
    if (this.done || this.wiping) return;
    this.wiping = true;
    this.busy = true;
    this.setXray(false);
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    flash('#39ff6a'); sfx.trap();
    banner('ZAPPED!', 'Kryptonite', '#39ff6a');
    this.wipes++;
    this.g.state.addRep(-WIPE_REP, 'Kell\'s experiments');
    this.g.state.intox = Math.min(this.g.state.intox, 60); // (passed out: she doesn't wake up passing out again)
    await new Promise((r) => setTimeout(r, 900));
    if (this.g.mode !== this) return;
    await clipsReady;
    await playCutscene({ src: nextClip(CLIPS.captive), maxSecs: 10, caption: 'Kryptonite. Everything goes green… then nothing.' });
    if (this.g.mode !== this) return;
    this.wakeInRoom();
    const ex = pick(EXPERIMENTS);
    if (ex.id === 'high') this.g.state.addIntox(Math.max(0, 40 - this.g.state.intox));
    if (ex.id === 'tagged') this.tagT = 60;
    if (ex.id === 'scrambled') this.xrayLockT = 60;
    if (ex.id === 'sensitive') this.sensT = 90;
    await dialog({ title: `Room ${this.wokeIn.num}`, cls: 'villain', text: `You come to on the carpet of room ${this.wokeIn.num}. Every door on the floor is shut, and you can't remember which rooms you've been in, or what you read in them. A note is pinned to your cape, in a doctor's scrawl:<div class="h13-note">“${ex.note}”<i>— Dr A. Kell</i></div><span class="hint">${ex.toast} The seals you set are still set.</span>` });
    this.wiping = false;
    this.busy = false;
    this.grace = this.t + 3;
  }

  /** After a wipe: a random room, every door shut, the notes forgotten, Kell back in his lab. */
  wakeInRoom() {
    const r = pick(this.club.rooms);
    this.wokeIn = r;
    this.closeDoors();
    this.notes = {};
    this.resetKell();
    const p = new THREE.Vector3(r.cx, 0, r.cz).addScaledVector(r.inward, 0.6);
    this.hero.position.copy(p);
    this.hero.rotation.y = Math.atan2(-r.inward.x, -r.inward.z);
    this.yaw = this.hero.rotation.y - Math.PI;
    this._lastGood = null;
    this.camPitch = null;
    this.heroClip('getUp', 2.6);
  }

  /** Passing out (intoxication) on the floor is Kell's too; in the ballroom it's the stage. */
  capture(reason) {
    if (this.ball) return this.stageCapture(reason);
    this.kellHit();
  }

  setXray(on) {
    if (on && this.xrayLockT > 0) { toast(`Your X-ray is scrambled (${Math.ceil(this.xrayLockT)}s)`, 'bad'); return; }
    super.setXray(on);
  }

  punch() {
    if (this.kell && !this.ball && this.punchKell()) {
      this.punchT = 0.25;
      if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
      return;
    }
    super.punch();
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    super.update(dt);
    if (this.warming || this.done || !this.scene) return;
    this.tagT = Math.max(0, this.tagT - dt);
    this.xrayLockT = Math.max(0, this.xrayLockT - dt);
    this.sensT = Math.max(0, this.sensT - dt);
    if (this.busy || this.wiping) return;
    // the room she's in: its number turns green (she's been here)
    const h = this.hero.position;
    for (const d of this.doors) {
      const r = d.room;
      if (h.x > r.x0 && h.x < r.x1 && h.z > r.z0 && h.z < r.z1) d.plate.material.color.set(0x39ff6a);
    }
    if (this.ball) this.updateBallroom(dt);
    else this.updateKell(dt);
  }

  allDone() { return false; }

  objectives() {
    if (this.ball) return this.ballObjectives();
    const n = this.sealCount(), list = [];
    const next = this.sealObjs.filter((o) => !this.A.seals?.[o.i]).sort((a, b) => a.pos.distanceTo(this.hero.position) - b.pos.distanceTo(this.hero.position))[0];
    list.push({ t: `Set the seals (${n}/5) · Seal Keys left: ${Math.max(0, this.keysLeft())}`, done: n >= 5, target: next?.pos });
    list.push({ t: `Find his notes: the seals' answers (${Object.keys(this.notes).length} read)`, done: false, skip: n >= 5 });
    list.push({ t: `Posters: ${this.posterRight}/${this.posterCalled} called right (just for fun)`, done: false });
    list.push({ t: 'Open the Grand Ballroom (end of the main hall)', done: false, final: true, target: this.club.ballDoor });
    return list;
  }

  hud() {
    super.hud();
    if (!this.scene || this.warming) return;
    const k = this.kell;
    if (!this.ball) {
      const st = !k ? '' : k.stun > 0 ? 'Kell is down' : k.state === 'charge' ? '⚠ KELL IS CHARGING' : k.state === 'hunt' ? 'Kell is hunting you' : 'Kell is patrolling';
      const fx = [this.tagT > 0 && `Tagged ${Math.ceil(this.tagT)}s`, this.xrayLockT > 0 && `X-ray scrambled ${Math.ceil(this.xrayLockT)}s`, this.sensT > 0 && `Sensitive ${Math.ceil(this.sensT)}s`].filter(Boolean).join(' · ');
      $('hud-sub').textContent = [st, fx, this.wipes ? `Wiped ${this.wipes}×` : '', this.xray ? 'X-RAY' : ''].filter(Boolean).join(' · ');
      const al = $('b-alert'); if (al) al.style.width = (k && k.state === 'charge' ? Math.min(100, (k.charge / 1) * 100) : 0) + '%';
      const lbl = $('h13-meter'); if (lbl) lbl.textContent = 'Kell\'s ray';
    } else this.ballHud();
  }

  // ---------------------------------------------------------------- the test harness
  /** Named viewpoints for tools/shots/act.js. */
  debugSpots() {
    const c = this.club, w = (id) => c.wings.find((q) => q.id === id);
    return [
      { name: 'main_hall', x: 0, z: -8, yaw: 0 },
      { name: 'gallery', x: w('gallery').side * 6, z: w('gallery').zc, yaw: -Math.PI / 2 },
      { name: 'wardrobe_room', x: c.rooms.find((r) => r.wing === 'wardrobe').cx, z: c.rooms.find((r) => r.wing === 'wardrobe').cz, yaw: Math.PI },
      { name: 'lab', x: w('lab').side * 10, z: w('lab').zc, yaw: Math.PI / 2 },
      { name: 'ballroom_doors', x: 0, z: -40, yaw: 0 },
    ];
  }
}

/** Does the segment a→b (x/z) cross the box? */
function segHits(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

const plates = new Map();
function plateTex(num) {
  if (plates.has(num)) return plates.get(num);
  const c = document.createElement('canvas'); c.width = 128; c.height = 52;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 52);
  g.fillStyle = '#120a16'; g.fillRect(4, 4, 120, 44);
  g.fillStyle = '#ffffff'; g.font = '900 34px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num), 64, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  plates.set(num, t);
  return t;
}

Object.assign(HotelZone.prototype, kellMethods, ballroomMethods);
export { BALL, NEON_CSS };
