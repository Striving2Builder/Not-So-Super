// RLD Walks (docs/design/act2.md, "RLD Walks" under The venues): a rescue mission in the red-light
// district. The club engine plays it (ClubZone, like the asylum and the hotel's floor) on a generated
// H of canal streets (plan.js):
//   * captives behind the red doors: X-ray sees through the doors (and shows the minders waiting
//     behind some of them); free them and they walk out; every rescue raises her rep;
//   * minders patrolling the streets (the guards' vision cones): caught = she wakes up tied up in one
//     of the rooms, an easy S-shield struggle, and on her way (the third time, they throw her out);
//   * the house perfume (perfume.js): hostesses with atomizers, vents over some doors;
//   * two lead doors (X-ray can't see through them), open only while her rep is below zero: behind
//     each, "Which one is hers?" (whichone.js) for a piece of her original suit;
//   * zone.opening: Act 2's opening (opening.js), waking tied up with the Polaroids and the note.
// The over-the-shoulder camera is tried here first (camera.js).
import * as THREE from 'three';
import { ClubZone } from '../clubzone.js';
import { buildStreet, DOOR_W, DOOR_H, LEAD_W } from './plan.js';
import { perfumeMethods } from './perfume.js';
import { openingMethods } from './opening.js';
import { cameraMethods } from './camera.js';
import { makeCopies, whichOne, PIECES } from './whichone.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, clipsReady, nextClip } from '../club3d/clips.js';
import { INTOX_HAZE } from '../state.js';
import { npcLook } from '../art.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { lightPool } from '../look3d.js';
import { pick, shuffle, chance, rand, $ } from '../util.js';
import { HERO } from '../data.js';

export const RLD = {
  venue: 'Red Light Den',       // (data.js VENUES: the district's look and vice flag)
  reward: 30, rescueRep: 4, captures: 3,
  captives: [3, 5], minders: 2, hostesses: 2, vents: 5,
  easy: { traces: 2, time: 14, slip: 0.2, idle: 0.3 }, // the tied-up struggle: easy, no spiral
};
const MOOD = { bg: 0x0a0306, fog: [0x1a0610, 12, 34], hemi: [0xffa0b4, 0x2a0a18, 0.8], amb: 0.16, key: 0xffc0d0, keyK: 0.7 };
const THANKS = ['"They took my passport. I thought nobody was coming."', '"Is it over? Can I go home?"', '"There are more of us. Behind the other doors."', '"Supergirl? They said you were one of them now."'];

/** Zone fields for an RLD Walk on the map (the caller supplies the position; the district is redlight). */
export function rldWalkFields(opts = {}) {
  const opening = !!opts.opening;
  return {
    kind: 'special', mode: 'rldwalk', venue: RLD.venue, theme: 'trafficking', district: 'redlight',
    def: { crime: 'the red-light trafficking ring' }, opening,
    name: opening ? 'Red Light District: the morning after' : 'RLD Walk: the red doors',
    reward: RLD.reward, lockKey: 'RLD Walks', ttl: 320, color: '#ff2244', glyph: '♥', risk: 'Tied up · perfume',
    blurb: 'Free the women held behind the red doors. X-ray sees through the doors, not the lead ones. Mind the house perfume.',
  };
}

export class RldWalk extends ClubZone {
  themeFor() { return { name: 'RLD Walk', captives: 0, verb: 'Free the captives', headline: 'TRAFFICKING RING' }; }
  get staff() { return 'minder'; }
  loadBuilding() { return buildStreet(); }

  enter(p) {
    const z = p.zone || {};
    Object.assign(this, { captures: 0, tying: false, leadRooms: [], openingRun: false, opening: null, isOpening: !!(p.opening || z.opening) });
    super.enter(p);
  }

  spawnPoint() { return this.wakeAt ? { pos: this.wakeAt.pos.clone(), heading: this.wakeAt.heading } : super.spawnPoint(); }

  // waking up (the opening): on the floor, not the superhero landing
  heroClip(name, hold) { return this.isOpening && name === 'land' && !this.openingRun ? super.heroClip('defeated', 99) : super.heroClip(name, hold); }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'punch', label: 'PUNCH', key: 'F' },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Minder alert</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    if (this.isOpening) return; // (runOpening says it)
    banner('RLD WALK', 'The red doors', '#ff2244');
    setTimeout(() => { if (!this.done) toast('X-ray sees through the red doors: find the women held behind them and walk them out. Stay out of the minders\' sight, and away from the perfume.', 'info'); }, 1800);
  }

  // ---------------------------------------------------------------- world
  buildWorld() {
    const c = this.club, S = this.scene;
    S.add(c.scene);
    S.background = new THREE.Color(MOOD.bg);
    S.fog = new THREE.Fog(...MOOD.fog);
    this.backdrop = { color: 0x07040a };
    S.add(new THREE.HemisphereLight(...MOOD.hemi));
    S.add(new THREE.AmbientLight(0xffffff, MOOD.amb));
    this.key.color.set(MOOD.key); this.key.intensity = MOOD.keyK;
    this.pools();
    this.buildDoors();
    this.wallMat = this.doorMat; // X-ray sees through the red doors (and the windows: setXray)
    this.wallBaseOpacity = 1;
    this.buildPerfume();
    this.placeClubGameplay();
  }

  /** Neon pools down the streets (floor decals: no per-pixel lights on phones), one flickering. */
  pools() {
    const S = this.scene, c = this.club, cols = [0xff2244, 0xff6688, 0xffaa33];
    let i = 0;
    const list = [];
    for (const r of c.routes) for (const k of [0.1, 0.5, 0.9]) {
      const p = r.from.clone().lerp(r.to, k), m = lightPool(cols[i++ % 3], 2.3, 0.4);
      m.position.set(p.x, 0.02, p.z); S.add(m); list.push(m);
    }
    for (const r of c.leads) { const m = lightPool(0xffd0a0, 3, 0.3); m.position.set(r.cx, 0.02, r.cz); S.add(m); }
    const fl = list[3];
    this.anims.push((t) => { fl.material.opacity = Math.sin(t * 19) > 0.9 ? 0.08 : 0.4; });
  }

  /** The red doors: one instanced mesh (one draw call); the two lead doors on their own. */
  buildDoors() {
    const c = this.club, rooms = c.rooms;
    this.doorMat = c.M.door.clone();
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.1), this.doorMat, rooms.length);
    inst.raycast = () => {};
    this.scene.add(inst);
    this.doorInst = inst;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    this.doors = rooms.map((r, i) => {
      const pos = new THREE.Vector3(r.door.x, DOOR_H / 2, r.door.z);
      q.setFromAxisAngle(up, r.alongX ? 0 : Math.PI / 2);
      inst.setMatrixAt(i, m4.compose(pos, q, one));
      const hx = r.alongX ? DOOR_W / 2 : 0.08, hz = r.alongX ? 0.08 : DOOR_W / 2;
      const col = { minX: r.door.x - hx, maxX: r.door.x + hx, minZ: r.door.z - hz, maxZ: r.door.z + hz, wall: true };
      this.colliders.push(col);
      const d = { room: r, i, col, open: false, k: 0, home: pos.clone(), rot: q.clone(), slide: r.alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) };
      r.doorRef = d;
      this.addInter(r.door.clone().addScaledVector(r.inward, -0.6), 'Open the red door', () => !d.open && !this.busy, () => this.openRedDoor(d), 'door');
      return d;
    });
    inst.instanceMatrix.needsUpdate = true;
    this.anims.push((t, dt) => {
      let moved = false;
      for (const d of this.doors) {
        const want = d.open ? 1 : 0;
        if (d.k === want) continue;
        d.k = want > d.k ? Math.min(1, d.k + dt * 2.5) : Math.max(0, d.k - dt * 4);
        inst.setMatrixAt(d.i, m4.compose(d.home.clone().addScaledVector(d.slide, DOOR_W * 0.92 * d.k), d.rot, one));
        moved = true;
      }
      if (moved) inst.instanceMatrix.needsUpdate = true;
    });
    // the lead doors: opaque to X-ray, open only while her rep is below zero
    for (const r of c.leads) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(LEAD_W, DOOR_H, 0.14), c.M.lead.clone());
      mesh.position.set(r.door.x, DOOR_H / 2, r.door.z);
      this.scene.add(mesh);
      const col = { minX: r.door.x - LEAD_W / 2, maxX: r.door.x + LEAD_W / 2, minZ: r.door.z - 0.1, maxZ: r.door.z + 0.1, wall: true, mesh };
      this.colliders.push(col);
      const L = { room: r, mesh, col, open: false, solved: false, piece: null, copies: null, cards: [] };
      this.leadRooms.push(L);
      this.addInter(r.door.clone().addScaledVector(r.inward, -0.7), 'Lead door', () => !L.open && !this.busy, () => this.leadDoor(L), 'door');
      this.addInter(r.rail.clone().setY(0).add(new THREE.Vector3(0, 0, 1.0)), 'Which one is hers?', () => L.open && !L.solved, () => this.pickPiece(L), 'clue');
    }
    // the gate: the way out
    this.addInter(c.entrance.door, 'Leave the street', () => !this.busy, () => this.leaveGate());
  }

  openRedDoor(d, quiet = false) {
    if (d.open) return;
    d.open = true;
    d.col.disabled = true;
    if (!quiet) sfx.door();
    const r = d.room;
    if (r.minder && !r.minder.out) this.minderOut(r);
  }

  closeDoor(d) { d.open = false; d.col.disabled = false; }

  /** Closed doors (red and lead) block the minders' view as well as the walls. */
  clearLOS(a, b) {
    if (!super.clearLOS(a, b)) return false;
    for (const c of this.colliders) if (c.wall && !c.disabled && segHits(a.x, a.z, b.x, b.z, c)) return false;
    return true;
  }

  setXray(on) {
    super.setXray(on);
    const w = this.club?.M.window;
    if (w) { w.transparent = on; w.opacity = on ? 0.15 : 1; w.needsUpdate = true; }
    if (on) for (const cap of this.captives) if (!cap.freed && cap.person.position.distanceTo(this.hero.position) < 14) cap.seen = true;
  }

  // ---------------------------------------------------------------- layout
  placeClubGameplay() {
    const c = this.club;
    this.planLayout();
    this.spawn = c.entrance.pos.clone();
    this.spawnHeading = c.entrance.heading;
    this.exitRing.position.set(this.spawn.x, 0.04, this.spawn.z);
    this.wakeAt = null;
    for (const r of c.rooms) { r.minder = null; r.captive = null; }
    let rooms = shuffle([...c.rooms]);
    if (this.isOpening) {
      // she wakes in a room on the cross street, tied up, the vent over its door primed
      const wake = rooms.find((r) => r.st === 'X') || rooms[0];
      rooms = rooms.filter((r) => r !== wake);
      this.wakeAt = { pos: wake.wake.clone(), heading: wake.faceDoor }; // (this.spawn stays the gate: freed women walk out there)
      this.placeOpening(wake);
      this.placeVents([wake]);
    }
    const nCap = this.isOpening ? RLD.captives[0] : Math.round(rand(...RLD.captives));
    for (const r of rooms.splice(0, nCap)) this.placeCaptive(r);
    for (const r of rooms.splice(0, this.isOpening ? 1 : RLD.minders)) this.placeMinderIn(r);
    this.placeVents(rooms.splice(0, RLD.vents - (this.isOpening ? 1 : 0)));
    const startStreet = this.isOpening ? 'X' : 'W';
    this.placeMinders(startStreet);
    this.placeHostesses(RLD.hostesses);
    // the lead rooms: a piece of her suit each
    const pieces = shuffle(Object.keys(PIECES));
    this.leadRooms.forEach((L, i) => { L.piece = pieces[i]; this.dressLead(L); });
  }

  /** A woman held in a room: on the bed's edge, tied; X-ray shows her through the door. */
  placeCaptive(r) {
    const look = npcLook('civilian');
    Object.assign(look, { top: pick(['#f0f0f0', '#5ab0e0', '#e0c05a', '#c07ae0']), skirt: null, bottom: pick(['#3a4a6a', '#2a2a2a', '#6a5a3a']), hairStyle: 'long' }); // dressed for the street
    const person = this.makeNPC(look);
    person.position.copy(r.sit);
    person.rotation.y = r.faceDoor;
    const ropes = new THREE.Group();
    const ropeMat = this.ropeMat || (this.ropeMat = new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
    for (const y of [0.75, 1.05]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 18), ropeMat); t.rotation.x = Math.PI / 2; t.position.y = y; ropes.add(t); }
    ropes.position.copy(person.position);
    this.scene.add(ropes);
    const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 8), new THREE.MeshBasicMaterial({ color: 0x40e0ff, depthTest: false, transparent: true, opacity: 0.55 }));
    ghost.position.set(r.sit.x, 0.85, r.sit.z); ghost.renderOrder = 10; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    const cap = { person, cage: ropes, ghost, room: r, freed: false, seen: false, x: r.sit.x, z: r.sit.z };
    r.captive = cap;
    this.captives.push(cap);
    this.addInter(r.sit, 'Untie her', () => !cap.freed && r.doorRef.open, () => this.freeCaptive(cap), 'captive');
  }

  freeCaptive(cap) {
    cap.ghost.visible = false;
    this.hidden = this.hidden.filter((h) => h !== cap.ghost);
    this.freeClubCaptive(cap); // (she walks out to the gate)
    this.g.state.addRep(RLD.rescueRep, 'Rescued from the red doors');
    const left = this.captives.filter((c) => !c.freed).length;
    setTimeout(() => { if (!this.done) toast(left ? `${pick(THANKS)} (${left} still held)` : 'That\'s everyone. Walk out through the gate.', left ? 'info' : 'good'); }, 900);
  }

  /** A minder waiting behind a red door (X-ray shows him red). Opening it brings him out. */
  placeMinderIn(r) {
    const look = npcLook('guard'); look.top = '#3a1030'; look.bottom = '#1a0a14';
    const mesh = this.makeNPC(look);
    mesh.position.copy(r.sit); mesh.rotation.y = r.faceDoor;
    const ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 8), new THREE.MeshBasicMaterial({ color: 0xff3030, depthTest: false, transparent: true, opacity: 0.55 }));
    ghost.position.set(r.sit.x, 0.85, r.sit.z); ghost.renderOrder = 10; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    r.minder = { mesh, ghost, out: false };
  }

  minderOut(r) {
    const M = r.minder;
    M.out = true;
    M.ghost.visible = false;
    this.hidden = this.hidden.filter((h) => h !== M.ghost);
    sfx.alarm();
    this.alert = Math.min(99, this.alert + 40);
    toast('A minder was waiting behind that door!', 'bad');
    const street = this.club.routes.find((q) => q.id === r.st), front = r.door.clone().addScaledVector(r.inward, -1.2);
    const far = street.from.distanceTo(front) > street.to.distanceTo(front) ? street.from : street.to;
    this.addGuard(M.mesh, [front, far.clone()], 0);
  }

  /** Minders on patrol: the streets she doesn't start in. */
  placeMinders(startStreet) {
    const routes = shuffle(this.club.routes.filter((r) => r.id !== startStreet));
    for (const r of routes.slice(0, RLD.minders)) {
      const look = npcLook('guard'); look.top = '#3a1030'; look.bottom = '#1a0a14';
      const mesh = this.makeNPC(look);
      const route = chance(0.5) ? [r.from.clone(), r.to.clone()] : [r.to.clone(), r.from.clone()];
      mesh.position.copy(route[0]);
      this.addGuard(mesh, route, 1);
    }
  }

  addGuard(mesh, route, wp) {
    const cone = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 24, -Math.PI / 2 - 0.525, 1.05).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = 0.06;
    mesh.add(cone);
    this.guards.push({ mesh, cone, route, wp, ko: false, look: 0, seeing: false, t: rand(0, 3) });
  }

  // ---------------------------------------------------------------- the lead rooms
  /** The rail: four copies of the piece hanging on it (textures once the flat-lay has loaded). */
  dressLead(L) {
    const r = L.room;
    makeCopies(L.piece).then((copies) => {
      if (!this.scene || !copies) return;
      L.copies = copies;
      copies.forEach((cp, i) => {
        const t = new THREE.CanvasTexture(cp.canvas); t.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.74), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
        m.position.set(r.rail.x - 1.2 + i * 0.8, 1.2, r.rail.z + 0.08);
        m.raycast = () => {};
        this.scene.add(m);
        L.cards.push(m);
      });
    });
  }

  async leadDoor(L) {
    const rep = this.g.state.rep;
    if (rep >= 0) {
      await dialog({ title: 'A lead door', text: `Sheet lead, rivets, a brass plate: <b>PRIVATE</b>. Your X-ray stops dead at it. A voice through the slot: "Members only. <i>Good girls</i> need not apply."<span class="hint">Lead doors only open while your rep is below zero (now ${rep}). The rescues pull it back up: the lead rooms first, while you're still disgraced?</span>` });
      return;
    }
    L.open = true;
    L.col.disabled = true;
    sfx.door();
    const m = L.mesh, from = m.position.clone();
    let k = 0;
    this.anims.push((t, dt) => { if (k < 1) { k = Math.min(1, k + dt * 1.6); m.position.copy(from).setX(from.x + LEAD_W * 0.95 * k); } });
    toast(`"Come in, Supergirl. We kept something of yours." A dressing room, and a rail.`, 'info');
  }

  async pickPiece(L) {
    if (!L.copies) { await dialog({ title: 'The rail', text: 'Empty hangers. Whatever hung here is gone.' }); L.solved = true; return; }
    const st = this.g.state;
    const res = await whichOne(L.piece, L.copies, { haze: st.intox >= INTOX_HAZE, flash: st.intox >= INTOX_HAZE });
    if (!res) return;
    L.solved = true;
    for (const m of L.cards) m.visible = false;
    if (res.right) {
      sfx.win();
      this.bonus += 5;
      this.g.act?.suitFind?.(L.piece, true);
      this.zone.finds = [...(this.zone.finds || []), L.piece];
      toast(`A find for her ${L.piece}.`, 'good');
    } else sfx.lose();
  }

  // ---------------------------------------------------------------- caught: tied up in a room
  /** Caught (seen too long, or the perfume put her down): she wakes up tied up in a room. */
  capture(reason) {
    if (this.done || this.tying) return;
    this.tying = true;
    this.captures++;
    this.setXray(false);
    this.busy = true;
    this.grace = Infinity;
    if (this.heroModel) { this.heroModel.play('defeated', { fade: 0.2 }); this.landT = 99; }
    sfx.trap(); flash('#ff2244');
    banner('CAUGHT!', '', '#ff2244');
    $('prompt').classList.remove('on');
    if (this.captures >= RLD.captures) { // the third time: thrown out on the canal bank (the situation changes)
      this.done = true;
      setTimeout(() => this.g.endZone(this.zone, { outcome: 'lose', rep: -5, text: `${reason} This time the minders don't bother with the ropes: they throw ${HERO} out on the canal bank and lock the gate.` }), 1300);
      return;
    }
    setTimeout(async () => {
      if (this.g.mode !== this || this.done) return;
      const r = this.roomToWake();
      this.closeDoor(r.doorRef);
      this.hero.position.copy(r.wake);
      this.hero.rotation.y = r.faceDoor;
      this.yaw = r.faceDoor - Math.PI;
      this._lastGood = null; this.camPitch = null;
      this.heroClip('getUp', 2.6);
      await this.tiedStruggle({ title: 'TIED UP', text: `${reason}<br>You come to in room ${r.num}, tied to the bedpost.` });
      if (this.g.mode !== this || this.done) return;
      this.openRedDoor(r.doorRef, true);
      this.alert = 0;
      // no sedation spiral: she comes round woozy, but under the line where it puts her down
      this.g.state.intox = Math.min(this.g.state.intox, 55);
      for (const gd of this.guards) { gd.look = 0; gd.seeing = false; }
      this.busy = false;
      this.tying = false;
      this.grace = this.t + 3;
      toast(this.captures === RLD.captures - 1 ? 'Once more and they\'ll throw you out for good.' : 'Out of the ropes. The minders think you\'re still tied up.', 'info');
    }, 1300);
  }

  /** An empty room away from where she was caught. */
  roomToWake() {
    const h = this.hero.position, ok = this.club.rooms.filter((r) => !r.captive && !r.minder && (!this.opening || r !== this.opening.room));
    ok.sort((a, b) => b.door.distanceTo(h) - a.door.distanceTo(h));
    return pick(ok.slice(0, 5));
  }

  /** The struggle: easy, and either way she's out (a fail just costs rep: no dead ends). */
  async tiedStruggle({ title, text }) {
    await clipsReady;
    const free = await struggle({ clip: nextClip(CLIPS.captive), title, text, diff: RLD.easy });
    if (free) { sfx.win(); banner('FREE!', '', '#3ee08a'); } else {
      sfx.lose();
      this.g.state.addRep(-2, 'Left tied up for an hour');
      toast('It takes an hour, but the knots give in the end.', 'bad');
    }
    return free;
  }

  async leaveGate() {
    const left = this.captives.filter((c) => !c.freed).length;
    if (!left) { toast('Step into the green ring with them.', 'info'); return; }
    const v = await dialog({ title: 'The gate', text: `${left} still held behind the red doors.`, options: [{ label: 'Leave anyway', value: true, cls: 'risky' }, { label: 'Stay', value: false }] });
    if (v) this.abort();
  }

  punch() {
    if (this.disarmHostess()) {
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
    if (this.isOpening && !this.openingRun && this.t > 0.4) { this.openingRun = true; this.runOpening(); }
    this.updatePerfume(dt);
    if (this.xray) for (const cap of this.captives) if (!cap.seen && !cap.freed && cap.person.position.distanceTo(this.hero.position) < 14) cap.seen = true;
  }

  allDone() { return this.captives.length > 0 && this.captives.every((c) => c.freed); }

  objectives() {
    const list = [], o = this.opening, h = this.hero.position;
    if (o) {
      list.push({ t: 'Read the note', done: o.readNote, target: o.room.wake, skip: o.readNote });
      list.push({ t: 'Look at the Polaroids', done: o.seenPols, target: o.room.wake, skip: o.seenPols });
    }
    const held = this.captives.filter((c) => !c.freed), seen = held.filter((c) => c.seen).sort((a, b) => a.person.position.distanceTo(h) - b.person.position.distanceTo(h));
    list.push({ t: `Free the women behind the red doors (${this.captives.length - held.length}/${this.captives.length})${held.length && !seen.length ? ' · X-RAY the doors' : ''}`, done: !held.length, target: seen[0]?.person.position });
    const leads = this.leadRooms.filter((L) => !L.solved), rep = this.g.state.rep;
    if (this.leadRooms.length) list.push({ t: `Lead doors: which one is hers? (${this.leadRooms.length - leads.length}/${this.leadRooms.length})${rep >= 0 ? ' · rep must be < 0' : ''}`, done: !leads.length, target: rep < 0 ? leads.sort((a, b) => a.room.door.distanceTo(h) - b.room.door.distanceTo(h))[0]?.room.door : null });
    list.push({ t: 'Walk them out through the gate', done: false, final: true, target: this.exitRing.position });
    return list;
  }

  hud() {
    super.hud();
    if (!this.scene || this.warming) return;
    const st = this.g.state;
    $('hud-sub').textContent = [`Rep ${st.rep}`, st.intox >= INTOX_HAZE ? `Perfume ${Math.round(st.intox)}% · HAZE` : `Perfume ${Math.round(st.intox)}%`, this.captures ? `Tied up ${this.captures}×` : '', this.xray ? 'X-RAY' : ''].filter(Boolean).join(' · ');
  }

  exit() {
    const w = this.club?.M.window;
    if (w) { w.transparent = false; w.opacity = 1; w.needsUpdate = true; } // (shared by every visit)
    this.puffs = null; this.smear = null; this.opening = null;
    super.exit();
  }

  // ---------------------------------------------------------------- the test harness
  /** Named viewpoints and handles for tools/shots/rld.js. */
  debugSpots() {
    const c = this.club, cap = this.captives.find((q) => !q.freed), L = this.leadRooms[0];
    return [
      { name: 'west_street', x: -c.dims.XS, z: 6, yaw: 0 },
      { name: 'cross_street', x: -3, z: 0, yaw: -Math.PI / 2 },
      cap && { name: 'captive_door', x: cap.room.door.x - cap.room.inward.x * 1.4, z: cap.room.door.z - cap.room.inward.z * 1.4, yaw: Math.atan2(-cap.room.inward.x, -cap.room.inward.z) },
      L && { name: 'lead_room', x: L.room.cx, z: L.room.cz + 1.2, yaw: 0 },
    ].filter(Boolean);
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

Object.assign(RldWalk.prototype, perfumeMethods, openingMethods, cameraMethods);
