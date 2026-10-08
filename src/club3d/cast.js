// Who's in the club and what can be used (docs/design/nightclub.md "NPCs"): bouncers on patrol
// (vision cones; the Mezzanine's look down from the balcony), the Talkers (eavesdrop rings: stay
// in to hear the evidence, too long and they notice), the bartender, the coat check, the VIP host
// on his couch, the owner at his desk, the gangster in the lounge, the courier in the alley, the
// crew in the dark room; the locked doors (VIP rope, staff keypad, stock-room UV code) and every
// USE spot. Mixed into Club3D.prototype.
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV, basic } from '../zonekit.js';
import { quality } from '../settings.js';
import { npcLook } from '../art.js';
import { clamp, $ } from '../util.js';
import { comic } from '../comic.js';
import { DOOR_W, floorY } from './plan.js';
import { INTOX_HAZE } from '../state.js';

const TALK_R = 2.4, TALK_IN = 1.2, HEAR_R = 5.6;
// on High, one of each Talker pair is one of the game's character models (~40k triangles each: too heavy for phones)
const TALK_MODELS = ['leather', 'hooded_thug', 'punk_girl'];
const DOOR_MAT = () => new THREE.MeshToonMaterial({ color: 0x2a2633 });

/** Strip tags; keep a few words of a line, the rest lost in the music. */
function fragment(html) {
  const w = html.replace(/<[^>]+>/g, '').replace(/"/g, '').split(/\s+/).filter(Boolean);
  if (w.length < 4) return `…${w.join(' ')}…`;
  const i = Math.floor(Math.random() * Math.max(1, w.length - 4));
  return `…${w.slice(i, i + 3 + Math.floor(Math.random() * 2)).join(' ')}…`;
}
/** Intoxicated, what she hears comes through scrambled. */
export function scramble(text, k) {
  return text.replace(/[A-Za-z]/g, (ch) => (Math.random() < k ? 'aeioushtnr'[Math.floor(Math.random() * 10)] : ch));
}

export const castMethods = {
  placeGameplay() {
    const plan = this.plan, V = plan.V, A = this.roomA, H = this.hallA.spots, d = this.caseDef;
    this.doorCol = { minX: 1e6, maxX: 1e6, minZ: 1e6, maxZ: 1e6, disabled: true }; // (the base zone's security door: none here)
    this.doorOpen = true;
    this.npcs = [];
    // ---- bouncers
    const routes = V.routes.slice(0, 4 + (this.event?.id === 'redcarpet' ? 1 : 0));
    routes.forEach((r) => this.addBouncer(r));
    for (const r of V.balconyRoutes || []) this.addBouncer(r, { y: V.balcony.y + 0.15 });
    // the VIP rope's bouncer paces in front of the door
    const vq = plan.byKind.vip, vs = vq.side === 'W' ? 1 : -1;
    this.addTorchGuards();
    this.ropeGuard = this.addBouncer([[vq.door.x + vs * 2.0, vq.door.z - 1.4], [vq.door.x + vs * 2.0, vq.door.z + 1.4]]);
    // ---- locked doors
    this.doors = {};
    this.doors.vip = this.lockDoor(vq, 'rope');
    this.doors.office = this.lockDoor(plan.byKind.office, 'door');
    this.doors.storage = this.lockDoor(plan.byKind.storage, 'door');
    this.vipIn = false; this.officeOpen = false; this.stockOpen = false;
    const hall = (q, dd) => ({ x: q.door.x + (q.side === 'W' ? dd : -dd), z: q.door.z });
    this.addInter(hall(vq, 1.2), 'Talk to the rope bouncer', () => !this.vipIn, () => this.vipRope(), 'door');
    this.addInter(hall(plan.byKind.office, 1.1), 'Staff door keypad', () => !this.officeOpen, () => this.officeKeypad(), 'door');
    this.addInter(hall(plan.byKind.storage, 1.1), 'Stock room keypad', () => !this.stockOpen, () => this.stockKeypad(), 'door');
    // the stock room's code, painted in UV marker on the hall wall beside its door (drug-vision only)
    this.uvSpot = hall(plan.byKind.storage, 0.4); this.uvSpot.z += DOOR_W / 2 + 1.4;
    this.addInter({ x: this.uvSpot.x + (plan.byKind.storage.side === 'W' ? 0.9 : -0.9), z: this.uvSpot.z }, 'Read the glowing writing', () => this.dvision > 0 && !this.uvRead, () => this.readUV());
    // ---- the hall's people and spots
    const bt = H.bartender;
    this.bartender = this.npc({ ...npcLook('civilian'), top: '#f2f2f2', bottom: '#111', skirt: null, tie: '#111', hairStyle: 'slick' }, bt.x, bt.z, bt.rot);
    this.addInter(H.bar, 'Order at the bar', () => true, () => this.barOrder());
    this.addInter(H.barSearch, 'Search the bar', () => true, () => this.openCloseup('bar'));
    const at = H.attendant;
    this.npc({ ...npcLook('civilian'), top: '#2a2a3a', skirt: '#111', bottom: null, hairStyle: 'long' }, at.x, at.z, at.rot);
    this.addInter(H.coat, 'Search the coat check', () => true, () => this.openCloseup('entrance'));
    this.addInter(H.dj, 'Search the DJ booth', () => true, () => this.openCloseup('main'));
    this.addInter({ x: V.floor.x, z: V.floor.z }, 'Fly out through the skylight', () => this.caseSolved, () => this.skylight());
    // ---- Talkers: pairs talking, with a ring on the floor round them
    this.talkers = [];
    (d.talks || []).forEach((def, i) => {
      const p = V.talkers[i];
      if (!p) return;
      const [x, z] = p, y = floorY(plan, x, z);
      const a = this.npc(npcLook('civilian'), x - 0.42, z, Math.PI / 2);
      const look = npcLook(i === 1 ? 'thug' : 'civilian');
      const b = quality().look3d === 'full' ? this.castModel(TALK_MODELS[i % TALK_MODELS.length], look, x + 0.42, z, -Math.PI / 2) : this.npc(look, x + 0.42, z, -Math.PI / 2);
      const ring = new THREE.Mesh(new THREE.RingGeometry(TALK_R - 0.2, TALK_R, 48).rotateX(-Math.PI / 2), basic(0xffd84d, { transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      const inner = new THREE.Mesh(new THREE.CircleGeometry(TALK_IN, 32).rotateX(-Math.PI / 2), basic(0xffd84d, { transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      ring.position.set(x, y + 0.035, z); inner.position.set(x, y + 0.03, z);
      ring.renderOrder = inner.renderOrder = 3;
      this.scene.add(ring, inner);
      this.talkers.push({ def, pos: { x, z }, npcs: [a, b], ring, inner, ev: 0, sus: 0, done: false, sayT: 1 + i });
    });
    // ---- the side rooms' people and spots
    const { vip, office, restroom, dark, storage, lounge, alley } = A;
    if (vip) {
      const h = vip.host;
      this.vipHost = this.npc({ ...npcLook('boss'), top: '#f2f2f2', bottom: '#f2f2f2', tie: '#ffd84d', size: 1.05 }, h.x, h.z, 0, { sit: true });
      this.addInter(vip.quiz, `Sit with ${d.vip?.host || 'the host'}`, () => this.vipIn && !this.vipDone, () => this.vipQuiz());
      this.addInter(vip.closeup, 'Search the VIP table', () => this.vipIn, () => this.openCloseup('vip'));
    }
    if (office) {
      const b = office.boss;
      this.bossNPC = this.makeCharacter('riddler', npcLook('boss'), 1.04);
      this.bossNPC.position.set(b.x, 0, b.z); this.bossNPC.rotation.y = 0;
      this.npcs.push(this.bossNPC);
      this.addInter(office.confront, `Confront ${d.boss?.name || 'the owner'}`, () => !this.bossDone, () => this.confront());
      this.addInter(office.closeup, 'Search the desk', () => true, () => this.openCloseup('office'));
      this.addInter(office.safe, 'Look behind the painting', () => !this.safeDone, () => this.safeCrack());
      this.addInter(office.recorder, 'Wipe the CCTV recorder', () => !this.recorderWiped, () => this.wipeRecorder());
    }
    if (restroom) {
      this.addInter(restroom.closeup, 'Search the sinks', () => true, () => this.openCloseup('restroom'));
      this.addInter(restroom.deal, 'Kick in the last stall', () => !this.fought?.restroom, () => this.startBrawl('restroom'));
      this.addInter(restroom.powder, 'Check the first stall', () => !this.powderTaken, () => this.powder());
      this.addInter(restroom.change, 'Change into Supergirl', () => this.undercover, () => this.suitUp());
    }
    if (dark) {
      const t = dark.thugs;
      this.darkCrew = [this.npc(npcLook('thug'), t.x - 0.5, t.z, 0.5), this.npc(npcLook('brute'), t.x + 0.5, t.z + 0.2, -0.4)];
      this.addInter(t, 'Take on the crew', () => !this.fought?.dark, () => this.startBrawl('dark'));
    }
    if (storage) this.addInter(storage.stash, 'Search behind the crates', () => this.stockOpen && !this.stashFound, () => this.searchStash());
    if (lounge) {
      const gq = lounge.gangster;
      this.gangster = this.npc({ ...npcLook('gunman'), size: 1.1 }, gq.x, gq.z, 0, { sit: true });
      this.addInter(lounge.shots, 'Take the shot-off challenge', () => !this.shotDone, () => this.shotOff());
    }
    if (alley) {
      const c = alley.courier;
      this.courier = this.npc({ ...npcLook('thug'), top: '#1a1a1a' }, c.x, c.z, Math.PI);
      this.addInter(alley.fight, 'Stop the courier', () => !this.fought?.alley, () => this.startBrawl('alley'));
    }
    this.placeEvent?.();
    this.makeTalkHud();
  },

  /** A bouncer on a route ([[x, z], …]); y lifts him onto the balcony (his cone is drawn on the floor below). */
  addBouncer(route, { y = 0 } = {}) {
    const pts = route.map(([x, z]) => new THREE.Vector3(x, y, z));
    const mesh = this.makeGuard();
    mesh.position.copy(pts[0]);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2),
      basic(0xffe040, { transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = 0.04 - y;
    mesh.add(cone);
    const gd = { mesh, cone, route: pts, wp: 1, ko: false, look: 0, seeing: false, t: Math.random() * 3, high: y > 0 };
    this.guards.push(gd);
    return gd;
  },

  /** A procedural person standing (or sitting) somewhere, facing rot. */
  npc(look, x, z, rot = 0, { sit = false } = {}) {
    const m = this.makeNPC(look);
    // ink outlines on the club's extras only on High: on the phone profiles they'd double their draw calls
    if (quality().look3d !== 'full') m.traverse((o) => { if (o.userData.ink && o.parent) o.parent.remove(o); });
    m.position.set(x, floorY(this.plan, x, z), z);
    m.rotation.y = rot;
    if (sit) { for (const l of m.legs) l.rotation.x = -1.45; m.position.y -= 0.42; for (const a of m.arms) a.rotation.x = -0.4; }
    this.npcs.push(m);
    return m;
  },

  /** One of the game's character models (enemies.js) standing at (x, z), facing rot; the procedural person until they've loaded. */
  castModel(kind, look, x, z, rot = 0, scale = 1) {
    const m = this.makeCharacter(kind, look, scale);
    m.position.set(x, floorY(this.plan, x, z), z); m.rotation.y = rot;
    this.npcs.push(m);
    return m;
  },

  /** A closed door in a side room's doorway (the VIP's is a velvet rope). */
  lockDoor(q, kind) {
    const s = q.side === 'W' ? 1 : -1, x = q.door.x + s * 0.3;
    let mesh;
    if (kind === 'rope') {
      mesh = new THREE.Group();
      const brass = new THREE.MeshToonMaterial({ color: 0xc09a34 }), red = new THREE.MeshToonMaterial({ color: 0xa01030 });
      for (const dz of [-DOOR_W / 2, DOOR_W / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.0, 10), brass); p.position.set(0, 0.5, dz); mesh.add(p); }
      const rope = new THREE.Mesh(new THREE.TorusGeometry(DOOR_W / 2, 0.035, 6, 20, Math.PI), red);
      rope.rotation.set(Math.PI, Math.PI / 2, 0); rope.position.y = 0.95; rope.scale.set(1, 0.25, 1); mesh.add(rope);
      mesh.position.set(x + s * 0.4, 0, q.door.z);
      this.scene.add(mesh);
    } else mesh = this.box(0.16, 2.9, DOOR_W, x, 1.45, q.door.z, DOOR_MAT(), { live: true });
    const col = { minX: x - 0.2, maxX: x + 0.2, minZ: q.door.z - DOOR_W / 2, maxZ: q.door.z + DOOR_W / 2, wall: kind !== 'rope', mesh: kind === 'rope' ? null : mesh };
    if (kind === 'rope') this.colliders.push(col); else this.colliders[this.colliders.length - 1] = col;
    return { mesh, col, kind };
  },

  openDoorOf(key) {
    const d = this.doors[key];
    if (!d || d.col.disabled) return;
    d.col.disabled = true;
    const m = d.mesh;
    if (d.kind === 'rope') { m.visible = false; return; }
    this.anims.push((t, dt) => { if (m.position.y < 4.5) m.position.y += dt * 4; });
  },

  /** Where the crowd shouldn't stand (cast + their rings). */
  castSpots() {
    const out = [];
    for (const m of this.npcs || []) out.push([m.position.x, m.position.z, 1.0]);
    for (const tk of this.talkers || []) out.push([tk.pos.x, tk.pos.z, 1.1]);
    for (const gd of this.guards) out.push([gd.mesh.position.x, gd.mesh.position.z, 1.0]);
    return out;
  },

  /** Who the dancers step aside for (besides her and the guards). */
  castPositions() {
    if (!this._castPos) this._castPos = (this.npcs || []).map((m) => m.position);
    return this._castPos;
  },

  // ---- Talkers
  stepCast(dt) {
    const h = this.hero.position, st = this.g.state;
    this.officeVideo();
    let near = null, nd = 1e9;
    for (const tk of this.talkers) {
      const d = Math.hypot(h.x - tk.pos.x, h.z - tk.pos.z);
      if (!tk.done && d < nd) { nd = d; near = tk; }
      // they talk among themselves (fragments as bubbles while she's close enough to see)
      tk.sayT -= dt;
      if (!tk.done && d < 9 && tk.sayT <= 0) {
        tk.sayT = 3.2 + Math.random() * 2;
        const who = tk.npcs[Math.random() < 0.5 ? 0 : 1], text = fragment(this.book.clue(...tk.def.clue.split(':'))?.text || '…');
        const s = () => this.screenOf(who.position, 2.1);
        const p = s();
        if (p) comic.say(this.hearing || d < TALK_R ? (st.intox >= INTOX_HAZE ? scramble(text, 0.35) : text) : '…', p.x, p.y, { kind: 'speech', ms: 2200, anchor: s });
      }
      const a = tk.done ? 0.15 : 0.6 + 0.3 * Math.sin(this.t * 3);
      tk.ring.material.opacity = a; tk.inner.material.opacity = tk.done ? 0.02 : 0.06 + 0.04 * Math.sin(this.t * 3);
      tk.ring.material.color.set(tk.sus > 60 ? 0xff3a3a : tk.done ? 0x888888 : 0xffd84d);
    }
    this.nearTalker = near && nd < HEAR_R + 1 ? near : null;
    if (!near) return;
    let ev = 0, su = 0;
    if (nd < TALK_R) { const inn = nd < TALK_IN; ev = inn ? 13 : 8; su = inn ? 15 : 6.5; }
    else if (this.hearing && nd < HEAR_R) ev = 7;
    if (this.dancing) su *= 0.4;
    if (st.intox >= INTOX_HAZE) su *= 0.7;
    if (this.blend >= 0.75) su *= 0.6;
    if (nd < TALK_R && (this.xray || this.hearing)) su += 14; // glowing eyes, sound rings: they notice
    if (ev) { near.ev += ev * dt; near.sus += su * dt; } else near.sus = Math.max(0, near.sus - 10 * dt);
    for (const tk of this.talkers) if (tk !== near) tk.sus = Math.max(0, tk.sus - 10 * dt);
    if (near.sus >= 100) { near.sus = 30; near.ev = Math.max(0, near.ev - 30); this.foundOut(`${near.def.who} catch ${'her'} listening.`); return; }
    if (near.ev >= 100) this.run(() => this.talkerDone(near));
  },

  async talkerDone(tk) {
    const st = this.g.state, c = this.book.clue(...tk.def.clue.split(':'));
    if (st.intox >= INTOX_HAZE) {
      // too high to make sense of it: she has to come back sober
      tk.ev = 40;
      this.say(tk.pos, scramble(c.text.replace(/<[^>]+>/g, '').slice(0, 90), 0.4), { ms: 3400, speaker: tk.def.who });
      toast('You\'re too far gone to make sense of it. Come back when your head\'s clearer.', 'bad');
      return;
    }
    tk.done = true;
    await this.gotClue(tk.def.clue, { title: `Overheard: ${tk.def.who}` });
  },

  makeTalkHud() {
    let el = $('c3-talk');
    if (!el) {
      el = document.createElement('div');
      el.id = 'c3-talk';
      el.innerHTML = '<div class="t">LISTENING</div><div class="bar"><i class="ev"></i></div><div class="bar"><i class="su"></i></div>';
      $('hud').appendChild(el);
    }
    el.classList.remove('on');
  },

  hudCast() {
    const el = $('c3-talk'), tk = this.nearTalker;
    if (!el) return;
    if (!tk || this.done) { el.classList.remove('on'); return; }
    const p = this.screenOf({ x: tk.pos.x, y: floorY(this.plan, tk.pos.x, tk.pos.z), z: tk.pos.z }, 2.7);
    if (!p) { el.classList.remove('on'); return; }
    el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px)`;
    el.querySelector('.ev').style.width = clamp(tk.ev, 0, 100) + '%';
    el.querySelector('.su').style.width = clamp(tk.sus, 0, 100) + '%';
    el.querySelector('.t').textContent = Math.hypot(this.hero.position.x - tk.pos.x, this.hero.position.z - tk.pos.z) < TALK_R ? 'LISTENING' : this.hearing ? 'SUPER-HEARING' : 'GET CLOSER';
    el.classList.add('on');
  },
};
