// The factory's people (docs/design/act2.md "The factory production lines"): the foreman and his
// guards take Kell's role as the hunters. Each is a Kell (src/hotel/kell.js: patrol the hall graph,
// see her, charge, fire), run one after another through kellMethods, with a dart gun of Super Squirt
// instead of the ray. The cult's workers in red robes stand at the belts: harmless, but one that
// sees her shouts, and the nearest hunter comes running. Mixed into FactoryZone.prototype.
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV } from '../zonekit.js';
import { kellMethods } from '../hotel/kell.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { toast } from '../ui.js';
import { pick, rand } from '../util.js';
import { quality } from '../settings.js';
import { BELT, WHW, MAIN_N } from './plan.js';
import { PINK } from './art.js';

const FOREMAN_LINES = {
  spot: ['Off my floor!', 'Quota\'s behind and now YOU.', 'Hold her for the dart!', 'Supergurl wants her alive.'],
  miss: ['Somebody shut the doors!', 'You\'re only making the shift longer.', 'She can\'t leave without passing me.'],
  hunt: ['Spread out. Check the bays.', 'Nobody stops my lines.', 'Who left the dock open?'],
};
const GUARD_LINES = {
  spot: ['Heretic on the floor!', 'For Supergurl!', 'There! By the belt!'],
  miss: ['She\'s fast…', 'Find her!', 'The foreman will have our masks.'],
  hunt: ['Check behind the vats.', 'She went this way.', 'Sister, show yourself.'],
};
const WORKER_LINES = ['INTRUDER!', 'Foreman! FOREMAN!', 'It\'s HER!', 'Stop the line… no, call the guards!'];
const LOOKS = {
  foreman: { skin: '#0e0c10', top: '#141018', gown: true, hairStyle: 'cap', capCol: '#f2c12e', hair: '#141018', tie: '#c8102e', boots: '#151515', size: 1.08 },
  guard: { skin: '#c8a040', top: '#7a0c1a', gown: true, hairStyle: 'beanie', capCol: '#5a0812', hair: '#5a0812', tie: '#c8a040', boots: '#151515' },
  worker: { skin: '#0e0c10', top: '#8a1020', gown: true, hairStyle: 'beanie', capCol: '#6a0a16', hair: '#6a0a16', tie: '#2a1408', boots: '#151515' },
};
const WORKER = { see: 3.2, fov: Math.PI * 0.6, shout: 9, stun: 10, draw: 12, close: 0.9 };

export const crewMethods = {
  /** The hall graph (as Kell's): the dock, the main hall's spine, two lanes down every line. */
  buildCrewGraph() {
    const c = this.club, V = (x, z) => new THREE.Vector3(x, 0, z);
    const nodes = [], add = (p, rect) => { const n = { p, rect, nb: [] }; nodes.push(n); return n; };
    const link = (a, b) => { a.nb.push(b); b.nb.push(a); };
    const spine = [add(V(0, 3), 'lobby'), add(V(0, -4), 'main'), add(V(0, -12), 'main'), add(V(0, -20), 'main'), add(V(0, -28), 'main'), add(V(0, MAIN_N + 1.2), 'main')];
    for (let i = 1; i < spine.length; i++) link(spine[i - 1], spine[i]);
    for (const w of c.wings) {
      const at = spine.find((n) => Math.abs(n.p.z - w.zc) < 0.1);
      const j = add(V(w.side * 2.4, w.zc), w.id);
      link(at, j);
      for (const s of [-1, 1]) {
        const z = w.zc + s * (WHW - 0.8);
        const a = add(V(w.side * 2.7, z), w.id), b = add(V(w.side * 8.8, z), w.id), e = add(V(w.side * (BELT.to + 1.0), z), w.id);
        link(j, a); link(a, b); link(b, e);
      }
    }
    this.kellNodes = nodes;
  },

  /** A hunter: Kell's state plus his look, lines and pace. */
  makeHunter(kind, at) {
    const look = LOOKS[kind];
    const mesh = this.makeNPC(look);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false }));
    gun.position.set(0.22, 1.18, 0.32);
    mesh.add(gun);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    glow.position.set(0.22, 1.18, 0.58);
    mesh.add(glow);
    mesh.position.copy(at);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.16 }));
    cone.position.y = 0.06;
    mesh.add(cone);
    const ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 10), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.55, depthTest: false }));
    ghost.renderOrder = 10; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0xffa0dc, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.scene.add(beam);
    const foreman = kind === 'foreman';
    return {
      kind, mesh, cone, glow, ghost, beam, route: [at.clone()], wp: 0, path: [], state: 'patrol', charge: 0, stun: 0, t: rand(0, 3), beamT: 0, seen: null, seenT: 0, talkT: rand(3, 9), look: 0, seeing: false,
      rest: at.clone(), name: foreman ? 'The foreman' : 'A cult guard', speaker: foreman ? 'THE FOREMAN' : 'CULT GUARD', lines: foreman ? FOREMAN_LINES : GUARD_LINES, pace: foreman ? 1 : 1.12,
    };
  },

  /** The foreman (from his office) and his guards (out on the lines); fewer guards on a saver phone. */
  placeCrew() {
    this.buildCrewGraph();
    const c = this.club, V = (x, z) => new THREE.Vector3(x, 0, z);
    const guards = quality().look3d === 'min' ? 1 : 2;
    const w = (id) => c.wings.find((q) => q.id === id);
    const posts = [V(w('bottling').side * 9, w('bottling').zc - 1.6), V(w('press').side * 9, w('press').zc + 1.6)];
    this.hunters = [this.makeHunter('foreman', V(0, MAIN_N + 1.5)), ...posts.slice(0, guards).map((p) => this.makeHunter('guard', p))];
    this.kell = this.hunters[0];
    // the workers: two at every line's belt, robes to the floor, masks down at the work
    const per = quality().look3d === 'full' ? 2 : 1; // (phones: one a line)
    this.workers = [];
    for (const l of c.wings) for (let i = 0; i < per; i++) {
      const s = i % 2 ? 1 : -1, x = l.side * (5.5 + i * 4.4), z = l.zc + s * (BELT.w / 2 + 0.45);
      const mesh = this.makeNPC(LOOKS.worker);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = s > 0 ? Math.PI : 0; // facing the belt
      this.workers.push({ mesh, line: l.i, stun: 0, shoutT: 0, t: rand(0, 6), home: mesh.position.clone(), face: mesh.rotation.y });
    }
  },

  /** The nearest hunter on his feet (to an alarm, a shout). */
  nearestHunter(p) {
    let best = null, bd = Infinity;
    for (const k of this.hunters || []) { if (k.stun > 0) continue; const d = k.mesh.position.distanceToSquared(p); if (d < bd) { bd = d; best = k; } }
    return best;
  },

  /** An alarm: the nearest hunter runs to where she is (the hotel's kellAlarm, for him). */
  kellAlarm(why) {
    const k = this.nearestHunter(this.hero.position);
    if (!k) return;
    this.kell = k;
    kellMethods.kellAlarm.call(this, why);
  },

  /** Every hunter in turn through Kell's brain, then the workers. */
  updateKell(dt) {
    for (const k of this.hunters || []) {
      this.kell = k;
      kellMethods.updateKell.call(this, dt);
      k.cone.material.uniforms?.col.value.set(k.state === 'charge' ? 0xff2a2a : k.state === 'hunt' ? 0xffa020 : PINK);
    }
    this.kell = this.hunters?.[0] || null;
    this.updateWorkers(dt);
  },

  updateWorkers(dt) {
    const h = this.hero.position;
    for (const w of this.workers || []) {
      const m = w.mesh;
      w.t += dt;
      w.shoutT = Math.max(0, w.shoutT - dt);
      m.visible = m.position.distanceToSquared(h) < WORKER.draw * WORKER.draw; // (far down another line: not drawn)
      if (w.stun > 0) {
        if ((w.stun -= dt) <= 0) { m.rotation.x = 0; m.position.copy(w.home); m.rotation.y = w.face; }
        continue;
      }
      // the work: arms at the belt (the line stopped: they stand and stare)
      const running = !this.levers?.[w.line]?.on;
      if (m.arms) { const s = running ? Math.sin(w.t * 5) * 0.5 : 0; m.arms[0].rotation.x = -0.9 + s; m.arms[1].rotation.x = -0.9 - s; }
      if (this.t < this.grace || this.busy || w.shoutT > 0) continue;
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      if (d > WORKER.see || d < 0.01) continue;
      const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
      const front = (dx * fx + dz * fz) / d > Math.cos(WORKER.fov / 2);
      if (!(front || d < WORKER.close) || !this.clearLOS(m.position, h)) continue;
      w.shoutT = WORKER.shout;
      m.rotation.y = Math.atan2(dx, dz);
      sfx.alarm();
      const s = this.screenOf(m.position, 2.0);
      if (s) comic.say(pick(WORKER_LINES), s.x, s.y, { kind: 'shout', speaker: 'CULT WORKER' });
      this.kellAlarm();
    }
  },

  /** A punch: a hunter from behind (down for a few seconds), else a worker (down for longer). */
  punchCrew() {
    for (const k of this.hunters || []) { this.kell = k; if (kellMethods.punchKell.call(this)) { this.kell = this.hunters[0]; return true; } }
    this.kell = this.hunters?.[0] || null;
    const hp = this.hero.position, fx = Math.sin(this.hero.rotation.y), fz = Math.cos(this.hero.rotation.y);
    for (const w of this.workers || []) {
      const m = w.mesh, dx = m.position.x - hp.x, dz = m.position.z - hp.z, d = Math.hypot(dx, dz);
      if (w.stun > 0 || d > 1.7 || (dx * fx + dz * fz) / d < 0.3) continue;
      w.stun = WORKER.stun; m.rotation.x = -Math.PI / 2; m.position.y = 0.2;
      sfx.hit();
      const s = this.screenOf(m.position, 1.2);
      if (s) this.g.commentary.hit(s.x, s.y, { big: true });
      return true;
    }
    return false;
  },

  /** After a dart: every hunter back to his post. */
  resetKell() {
    for (const k of this.hunters || []) {
      k.mesh.position.copy(k.rest); k.mesh.rotation.set(0, 0, 0);
      Object.assign(k, { state: 'patrol', path: [], charge: 0, stun: 0, seen: null });
    }
  },

  crewStatus() {
    const ks = this.hunters || [];
    if (ks.some((k) => k.stun <= 0 && k.state === 'charge')) return '⚠ A DART GUN IS CHARGING';
    if (ks.some((k) => k.stun <= 0 && k.state === 'hunt')) return 'They\'re hunting you';
    return ks.every((k) => k.stun > 0) ? 'The guards are down' : 'The foreman\'s crew is patrolling';
  },
};

