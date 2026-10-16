// The Super Squirt factory (docs/design/act2.md "The factory production lines"): Act 1's Floor 13
// without the ballroom, re-themed as the cult's drug plant. HotelZone plays it (src/hotel/hotel.js:
// the doors, the struggle, the wake-up in a random room), on a generated building (plan.js):
//   * four production lines off the main hall, each a belt with the cult's workers in red robes at it
//     and six bays behind steel doors (vats, pill presses, bottling, packing): one bay holds the line's
//     key, two hold traps baited with a Super Squirt sample (the struggle; fail and the alarm rings);
//   * a lever at the end of every line: unlocked with its key, switched to green it shuts the line
//     down (the belt stops, the hazard light goes green) and the nearest hunter comes running;
//   * the foreman and his guards hunt the halls with dart guns (crew.js, Kell's brain): a dart = a dose
//     of Super Squirt, a clip, she wakes in a random bay with every door shut, and the foreman has
//     restarted one of her lines;
//   * all four green: walk out through the loading dock = the win (counts the act's factory gate).
import * as THREE from 'three';
import { ClubZone } from '../clubzone.js';
import { HotelZone } from '../hotel/hotel.js';
import { buildFactory, BELT } from './plan.js';
import { HAZARD, PINK, PINK_CSS, signCanvas } from './art.js';
import { crewMethods } from './crew.js';
import { DOOR_W, DOOR_H } from '../hotel/plan.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, clipsReady, nextClip } from '../club3d/clips.js';
import { playCutscene } from '../cutscene.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { lightPool } from '../look3d.js';
import { quality } from '../settings.js';
import { pick, shuffle, $ } from '../util.js';

export const FACTORY = { venue: 'Super Squirt Plant', reward: 45, dartRep: 3, dose: 20, bottles: 6 };
const MOOD = { bg: 0x0a0608, fog: [0x140a10, 12, 40], hemi: [0xffd8c0, 0x1a0a10, 0.6], amb: 0.12, key: 0xfff0dc, keyK: 0.75 };

/** The zone's fields for a map marker or a debug entry (act2run places one in the factory district). */
export function factoryFields(opts = {}) {
  return {
    kind: 'special', mode: 'factory', factoryLine: true, venue: FACTORY.venue, theme: 'drugs', district: 'factory',
    def: { crime: 'the Super Squirt production lines' }, name: 'The Super Squirt lines', reward: FACTORY.reward,
    lockKey: 'The factory', ttl: 600, color: PINK_CSS, glyph: 'S', risk: 'Dart guns · traps',
    blurb: 'The cult makes Super Squirt here. Find each line\'s key, throw its lever to green, and walk out. Mind the foreman.',
    ...opts,
  };
}

const BAY_TEXT = {
  mixing: ['Two vats of something pink and sweet-smelling, stirring themselves. A clipboard: BATCH 112. DOSE: "SUPER".', 'Sacks of sugar, a drum of food colouring, and one locked cabinet with a skull on it.'],
  press: ['The press thumps out pink pills stamped with an S. Not her S. Close enough.', 'Trays of pills drying under a lamp. A sign: COUNT TWICE. SHE IS WATCHING.'],
  bottling: ['Racks of little pink bottles. The label: SUPER SQUIRT, FEEL SUPER. A drawing of a girl in a crop top.', 'A capping machine and a bin of rejects. Someone has drawn a crown on every cap.'],
  packing: ['Crates stencilled SUPER SQUIRT, addressed to clubs you know: the Hive, the Gilded Cage, Flashpoint.', 'A shipping board: tonight\'s run goes to the red-light district. "Supergurl\'s girls sell it at the door."'],
  office: ['The foreman\'s desk: a mug that says WORLD\'S BEST FOREMAN, a pile of quota sheets, and a Polaroid of a woman in your old suit. Signed: "Keep them working. S."', 'The production board: four lines, four quotas, and a red pin on a map of the city where every club is.'],
};
const LINE_DOWN = ['The belt shudders and stops. Bottles topple. Somewhere a bell starts ringing.', 'The hazard light flicks to green and the line goes quiet. The workers just stand there.'];

export class FactoryZone extends HotelZone {
  themeFor() { return { name: 'Super Squirt factory', captives: 0, verb: 'Shut the lines down', headline: 'DRUG RING' }; }
  get staff() { return 'the foreman'; }
  loadBuilding() { return buildFactory(); }

  enter(p) {
    Object.assign(this, { keys: {}, leverObjs: [], darts: 0, samples: 0, hunters: [], workers: [], trapObjs: [] });
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
    banner('SUPER SQUIRT', 'The cult\'s production lines', PINK_CSS);
    setTimeout(() => {
      if (this.done) return;
      toast('Four lines, four levers. Each lever is padlocked: its key is in one of that line\'s bays. Punch the foreman\'s crew from behind; break their line of sight.', 'info');
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
    const S = this.scene, c = this.club, add = (x, z, col, r, k) => { const m = lightPool(col, r, k); m.position.set(x, 0.02, z); S.add(m); return m; };
    let i = 0;
    for (let z = 2; z > -36; z -= 5.5) add(0, z, i++ % 2 ? 0xfff0d0 : HAZARD[0], 2.4, 0.38);
    for (const w of c.wings) for (const x of [5, 10]) add(w.side * x, w.zc, i++ % 2 ? PINK : 0xfff0d0, 2.6, 0.36);
    for (const r of c.rooms) add(r.cx, r.cz, { mixing: 0xffb0e0, press: 0xfff0b0, bottling: 0xff8ac8, packing: 0xffc070, office: 0xffd8a0 }[r.wing], 2.2, 0.3);
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
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ map: plateTex(r.foreman ? 'BOSS' : r.num), color: 0xff4a6a, toneMapped: false }));
      const out = r.inward.clone().multiplyScalar(-0.1);
      plate.position.set(r.door.x + out.x, DOOR_H + 0.22, r.door.z + out.z);
      plate.rotation.y = Math.atan2(-r.inward.x, -r.inward.z);
      this.scene.add(plate);
      const d = { room: r, mesh, col, plate, open: false, home: mesh.position.clone(), slide: r.alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) };
      this.addInter(r.door.clone().addScaledVector(r.inward, -0.6), r.foreman ? 'Open the foreman\'s office' : `Open bay ${r.num}`, () => !d.open, () => this.openDoor(d), 'door');
      return d;
    });
    // the dock's shutter: the way out (with every line down, the green ring is the win)
    this.addInter(new THREE.Vector3(0, 0, 5.2), 'The loading dock: leave', () => !this.allDone(), () => this.leave());
  }

  // ---------------------------------------------------------------- layout
  placeClubGameplay() {
    const c = this.club;
    this.planLayout();
    this.spawn = c.entrance.pos.clone();
    this.spawnHeading = c.entrance.heading;
    this.exitRing.position.set(this.spawn.x, this.spawn.y + 0.04, this.spawn.z + 0.6);
    this.exitRing.material.color.set(0x39ff6a);
    this.placeSigns();
    this.placeLevers();
    this.placeBelts();
    this.placeRooms();
    this.placeCrew();
  }

  placeSigns() {
    const tex = [0, 1, 2].map((k) => { const t = new THREE.CanvasTexture(signCanvas(k)); t.colorSpace = THREE.SRGBColorSpace; return t; });
    this.club.signs.forEach((s, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.26), new THREE.MeshBasicMaterial({ map: tex[k % 3], toneMapped: false }));
      m.position.copy(s.pos); m.rotation.y = Math.atan2(s.n.x, s.n.z);
      this.scene.add(m);
      this.addInter(s.pos.clone().addScaledVector(s.n, 0.9), 'Read the poster', () => true, () => dialog({ title: 'SUPER SQUIRT', text: `A pink bottle, a lightning bolt, and a woman in your old suit on the small print: <b>"Supergurl approves."</b> The cult's faithful work the lines for her.` }), 'poster');
    });
  }

  /** A lever at the end of every line: a post, a handle, a lamp; and the line's hazard light. */
  placeLevers() {
    const M = this.club.M, S = this.scene;
    this.levers = []; // (crew.js reads levers[line].on)
    this.leverObjs = this.club.levers.map((L) => {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.4), M.black); post.position.y = 0.6; g.add(post);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.42), M.brass); stripe.position.y = 0.2; g.add(stripe);
      const pivot = new THREE.Group(); pivot.position.set(0, 1.0, 0.22); g.add(pivot);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), M.steel); arm.position.y = 0.3; pivot.add(arm);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false })); knob.position.y = 0.62; pivot.add(knob);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false })); lamp.position.set(0, 1.42, 0); g.add(lamp);
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: 0xffd21a, toneMapped: false })); lock.position.set(0, 0.8, 0.22); g.add(lock);
      g.position.copy(L.pos); g.rotation.y = L.face;
      S.add(g);
      this.colliders.push({ minX: L.pos.x - 0.35, maxX: L.pos.x + 0.35, minZ: L.pos.z - 0.35, maxZ: L.pos.z + 0.35, mesh: post });
      const pool = lightPool(0xffb020, 3.2, 0.45); pool.position.set(L.pos.x, 0.03, L.pos.z); S.add(pool);
      const o = { ...L, on: false, unlocked: false, pivot, knob, lamp, lock, pool };
      o.lit = () => {
        const col = o.on ? 0x39ff6a : 0xff2a2a;
        lamp.material.color.set(col); knob.material.color.set(col);
        pivot.rotation.x = o.on ? -1.1 : 0.5;
        lock.visible = !o.unlocked;
        pool.material.color.set(o.on ? 0x39ff6a : 0xffb020);
      };
      o.lit();
      this.levers[L.i] = o;
      this.anims.push((t) => { if (!o.on) { pool.material.opacity = 0.2 + 0.3 * Math.abs(Math.sin(t * 4 + L.i)); lamp.scale.setScalar(1 + 0.15 * Math.sin(t * 8)); } else { pool.material.opacity = 0.35; lamp.scale.setScalar(1); } });
      this.addInter(L.pos, `Throw the lever: ${L.name}`, () => !o.on, () => this.throwLever(o), 'seal');
      return o;
    });
  }

  async throwLever(o) {
    if (o.on) return;
    if (!o.unlocked && !this.keys[o.i]) {
      await dialog({ title: o.name, text: `The lever is padlocked in the red. A tag on the lock: <b>"Shift key only. Ask the foreman."</b><span class="hint">The key is in one of this line's six bays. X-ray sees through the doors.</span>` });
      return;
    }
    o.unlocked = true;
    o.on = true;
    o.lit();
    sfx.win(); flash('#39ff6a');
    const n = this.linesDown();
    banner(n >= 4 ? 'ALL LINES DOWN' : 'LINE DOWN', `${n}/4 · ${o.name}`, '#39ff6a');
    this.g.state.addRep(2, 'Shut down a Super Squirt line');
    if (n >= 4) toast('Every line is down. Walk out through the loading dock (the green ring).', 'good');
    else this.kellAlarm(pick(LINE_DOWN));
  }

  linesDown() { return this.leverObjs.filter((o) => o.on).length; }

  /** The belts (their textures scroll while the line runs) and the bottles riding them. */
  placeBelts() {
    const M = this.club.M, per = quality().look3d === 'min' ? 3 : FACTORY.bottles, lines = this.club.wings;
    const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false }), lines.length * per);
    mesh.userData.noCollide = true;
    this.scene.add(mesh);
    const m4 = new THREE.Matrix4(), len = BELT.to - BELT.from;
    const pos = lines.map(() => Array.from({ length: per }, (_, k) => (k / per) * len));
    const place = () => {
      lines.forEach((l, li) => pos[li].forEach((u, k) => { m4.makeTranslation(l.side * (BELT.from + u), BELT.h + 0.13, l.zc + (k % 2 ? 0.12 : -0.12)); mesh.setMatrixAt(li * per + k, m4); }));
      mesh.instanceMatrix.needsUpdate = true;
    };
    place();
    this.anims.push((t, dt) => {
      let moved = false;
      lines.forEach((l, li) => {
        if (this.levers[l.i]?.on) return;
        M.belts[l.i].map.offset.x -= dt * 0.9;
        pos[li] = pos[li].map((u) => (u + dt * 0.45) % len);
        moved = true;
      });
      if (moved) place();
    });
  }

  /** Each line's bays: its key, two traps baited with a sample, the rest its machines; the office. */
  placeRooms() {
    const byLine = {};
    for (const r of this.club.rooms) (byLine[r.wing] = byLine[r.wing] || []).push(r);
    for (const [wing, rooms] of Object.entries(byLine)) {
      const line = this.club.wings.find((w) => w.id === wing);
      shuffle([...rooms]).forEach((r, i) => {
        this.dressBay(r);
        if (!line) return; // (the foreman's office)
        if (i === 0) this.placeKey(r, line);
        else if (i <= 2) this.placeTrap(r);
      });
    }
  }

  dressBay(r) {
    const spot = new THREE.Vector3(r.cx, 0, r.cz).addScaledVector(r.inward, 0.2);
    this.addInter(spot, r.foreman ? 'Search the desk' : 'Look around', () => true, () => dialog({ title: r.foreman ? 'The foreman\'s office' : `Bay ${r.num}`, text: pick(BAY_TEXT[r.wing]) }));
  }

  placeKey(r, line) {
    const at = r.bench || new THREE.Vector3(r.cx, 0.8, r.cz);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.16), new THREE.MeshBasicMaterial({ color: 0xffe24a, toneMapped: false }));
    this.scene.add(card);
    const y = at.y || 0.8;
    this.anims.push((t) => { card.visible = !this.keys[line.i]; card.rotation.y = t * 1.4; card.position.set(at.x, y + 0.1 + Math.sin(t * 3) * 0.03, at.z); });
    // X-ray: the key glows through the door
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xffe24a, depthTest: false, transparent: true, opacity: 0.9 }));
    ghost.position.set(at.x, y + 0.1, at.z); ghost.renderOrder = 11; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    const stand = new THREE.Vector3(at.x, 0, at.z).addScaledVector(r.inward, -0.9);
    this.addInter(stand, `Take the key: ${line.name}`, () => !this.keys[line.i], async () => {
      sfx.pickup();
      this.keys[line.i] = true;
      ghost.visible = false; this.hidden.splice(this.hidden.indexOf(ghost), 1);
      toast(`🔑 The shift key for ${line.name}. Its lever is at the end of the line.`, 'good');
    }, 'note');
  }

  /** A device baited with a pink vial of Super Squirt: take it and the trap shuts. */
  placeTrap(r) {
    const M = this.club.M, S = this.scene, p = new THREE.Vector3(r.cx, 0, r.cz).addScaledVector(r.inward, 0.15);
    const kind = r.wing === 'mixing' ? 'pod' : r.wing === 'bottling' ? 'chair' : 'cage';
    const g = new THREE.Group();
    const part = (geo, mat, y, z = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(0, y, z); m.rotation.x = rx; g.add(m); return m; };
    if (kind === 'chair') {
      part(new THREE.BoxGeometry(0.6, 0.08, 0.6), M.steel, 0.5);
      part(new THREE.BoxGeometry(0.6, 0.8, 0.08), M.steel, 0.9, -0.28);
      for (const y of [0.62, 1.0]) part(new THREE.TorusGeometry(0.3, 0.03, 6, 16), M.black, y, -0.05, Math.PI / 2);
    } else if (kind === 'cage') {
      part(new THREE.BoxGeometry(1.1, 2.0, 1.1), new THREE.MeshBasicMaterial({ color: 0xf2c12e, wireframe: true }), 1.0);
    } else {
      part(new THREE.CylinderGeometry(0.5, 0.5, 2.0, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa0dc, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), 1.0);
      part(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 14), M.steel, 0.06);
    }
    g.position.copy(p);
    S.add(g);
    const bait = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 8), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false }));
    bait.position.set(p.x, 1.2, p.z);
    S.add(bait);
    const wired = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false, transparent: true }));
    wired.rotation.x = -Math.PI / 2; wired.position.set(p.x, 0.05, p.z); wired.renderOrder = 11; wired.visible = false;
    S.add(wired); this.hidden.push(wired);
    const t = { r, kind, bait, sprung: false };
    this.trapObjs.push(t);
    this.anims.push((tt) => { bait.rotation.y = tt * 2; bait.visible = !t.sprung; });
    this.addInter(p.clone().addScaledVector(r.inward, -0.8), 'Take the Super Squirt sample', () => !t.sprung, () => this.springTrap(t), 'trap');
  }

  async springTrap(t) {
    t.sprung = true;
    const free = await this.trap({
      title: 'TRAPPED!',
      text: { chair: 'The bottling chair\'s straps whip round your wrists the moment you touch the vial.', cage: 'A cage drops from the press frame. The bars are threaded with something that saps your strength.', pod: 'The mixing pod slams shut and fills with sweet pink mist.' }[t.kind],
    });
    if (free) { this.samples++; this.g.state.addRep(3, 'A sample of Super Squirt'); toast('🧪 A sample of Super Squirt. Evidence for the lab.', 'good'); }
  }

  /** The struggle over a held clip. Free: back on her feet. Not: the alarm, and the crew comes for her. */
  async trap({ title, text }) {
    sfx.trap(); flash(PINK_CSS);
    await clipsReady;
    const free = await struggle({ clip: nextClip(CLIPS.captive), title, text, diff: this.sensT > 0 ? 'hard' : 'normal' });
    if (free) { sfx.win(); banner('FREE!', '', '#3ee08a'); this.grace = this.t + 1.2; return true; }
    sfx.alarm();
    banner('ALARM!', 'The foreman\'s crew is coming', '#ff2a5a');
    this.kellAlarm('The restraints let go at last, but the alarm is ringing. They know where you are: run!');
    this.grace = this.t + 1.5;
    return false;
  }

  async leave() {
    const v = await dialog({ title: 'The loading dock', text: `Leave the factory? ${this.linesDown()}/4 lines are down; by the next shift the foreman will have them running again.`, options: [{ label: 'Leave', value: true }, { label: 'Stay', value: false }] });
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
    flash(PINK_CSS); sfx.trap();
    banner('DARTED!', 'Super Squirt', PINK_CSS);
    this.darts++;
    const st = this.g.state;
    st.addRep(-FACTORY.dartRep, 'Darted at the drug factory');
    st.intox = Math.min(60, (st.intox || 0) + FACTORY.dose); // (dosed, not out cold: she doesn't wake up passing out again)
    await new Promise((r) => setTimeout(r, 900));
    if (this.g.mode !== this) return;
    await clipsReady;
    await playCutscene({ src: nextClip(CLIPS.captive), maxSecs: 10, caption: 'Super Squirt. Pink, sweet, everywhere… then nothing.' });
    if (this.g.mode !== this) return;
    this.wakeInRoom();
    const on = this.leverObjs.filter((o) => o.on);
    const back = on.length ? pick(on) : null;
    if (back) { back.on = false; back.lit(); }
    await dialog({
      title: this.wokeIn.foreman ? 'The foreman\'s office' : `Bay ${this.wokeIn.num}`, cls: 'villain',
      text: `You come to on the floor of ${this.wokeIn.foreman ? 'the foreman\'s office' : `bay ${this.wokeIn.num}`}, sticky and pink, with every door shut. A note is tucked in your top:<div class="h13-note">“${back ? `${back.name} is running again. ` : ''}The quota doesn't care how super you are.”<i>— The Foreman</i></div><span class="hint">${back ? `${back.name}'s lever is back in the red (still unlocked). ` : ''}The keys you found are still in your pocket.</span>`,
    });
    this.wiping = false;
    this.busy = false;
    this.grace = this.t + 3;
  }

  punch() {
    if (!this.ball && this.punchCrew()) {
      this.punchT = 0.25;
      if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
      return;
    }
    const k = this.kell; this.kell = null; super.punch(); this.kell = k; // (HotelZone's: no Kell here → the plain punch)
  }

  // ---------------------------------------------------------------- the win, the HUD
  allDone() { return this.leverObjs.length === 4 && this.leverObjs.every((o) => o.on); }

  objectives() {
    const n = this.linesDown(), keys = Object.keys(this.keys).length, h = this.hero.position;
    const next = this.leverObjs.filter((o) => !o.on).sort((a, b) => a.pos.distanceTo(h) - b.pos.distanceTo(h))[0];
    return [
      { t: `Shut the lines down: levers to green (${n}/4)`, done: n >= 4, target: next?.pos },
      { t: `Find the lines' keys in the bays (${keys}/4)`, done: keys >= 4, skip: n >= 4 },
      { t: `Super Squirt samples: ${this.samples} (from the traps' bait)`, done: false, skip: !this.samples },
      { t: 'Walk out through the loading dock', done: false, final: true, target: this.exitRing.position },
    ].filter((o) => !o.skip);
  }

  hud() {
    ClubZone.prototype.hud.call(this);
    if (!this.scene || this.warming) return;
    $('hud-sub').textContent = [this.crewStatus(), this.darts ? `Darted ${this.darts}×` : '', this.xray ? 'X-RAY' : ''].filter(Boolean).join(' · ');
    const ch = Math.max(0, ...this.hunters.map((k) => (k.stun <= 0 && k.state === 'charge' ? k.charge : 0)));
    const al = $('b-alert'); if (al) al.style.width = Math.min(100, ch * 100) + '%';
  }

  /** Named viewpoints for the harness (tools/shots/factory.js). */
  debugSpots() {
    const c = this.club, w = (id) => c.wings.find((q) => q.id === id), bay = c.rooms.find((r) => r.wing === 'press');
    return [
      { name: 'dock', x: 0, z: 2.5, yaw: 0 },
      { name: 'main_hall', x: 0, z: -8, yaw: 0 },
      { name: 'line_mixing', x: w('mixing').side * 6, z: w('mixing').zc - 1.6, yaw: -Math.PI / 2 },
      { name: 'press_bay', x: bay.cx, z: bay.cz, yaw: Math.PI },
      { name: 'lever_packing', x: w('packing').side * 12.4, z: w('packing').zc + 1.4, yaw: -Math.PI / 2 },
    ];
  }
}

const plates = new Map();
function plateTex(label) {
  if (plates.has(label)) return plates.get(label);
  const c = document.createElement('canvas'); c.width = 128; c.height = 52;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c12e'; g.fillRect(0, 0, 128, 52);
  g.fillStyle = '#141018'; g.fillRect(4, 4, 120, 44);
  g.fillStyle = '#f2c12e'; g.font = '900 32px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(label), 64, 28);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  plates.set(label, t);
  return t;
}

Object.assign(FactoryZone.prototype, crewMethods);
