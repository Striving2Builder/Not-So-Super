// Dr Amos Kell on the 13th floor (docs/design/act1.md): instead of guards, one hunter with a
// kryptonite stun ray. He walks the halls (a graph down their middles); when he sees her he stops,
// the ray charges green for about a second (the warning), then fires. Still in his sight when it
// fires: she's hit (the memory wipe, hotel.js). Out of it: he hunts where he saw her. Never stops
// looking; slower than she is; a punch from behind knocks him down for a few seconds. Mixed into
// HotelZone.prototype.
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV } from '../zonekit.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { toast } from '../ui.js';
import { pick } from '../util.js';

export const KELL = { walk: 1.5, hunt: 2.5, charge: 1.0, chargeTagged: 0.7, stun: 6, tagEvery: 7, memory: 6 };
const LINES = {
  spot: ['There you are, specimen.', 'Hold still. This won\'t hurt. Much.', 'Back on the table, Supergirl.', 'Subject located.'],
  miss: ['Fascinating reflexes.', 'Run all you like.', 'You can\'t leave the floor, my dear.'],
  hunt: ['Come out, come out…', 'I can smell the kryptonite on you.', 'Every door on this floor is mine.'],
};

export const kellMethods = {
  /** Kell and his patrol graph: nodes down the middle of every hall (the lobby, the main hall, each wing). */
  placeKell() {
    const c = this.club, V = (x, z) => new THREE.Vector3(x, 0, z);
    const nodes = [], add = (p, rect) => { const n = { p, rect, nb: [] }; nodes.push(n); return n; };
    const link = (a, b) => { a.nb.push(b); b.nb.push(a); };
    const spine = [add(V(0, 3), 'lobby'), add(V(0, -4), 'main')];
    for (const w of c.wings) if (w.side < 0) spine.push(add(V(0, w.zc), 'main'));
    spine.push(add(V(0, -44.5), 'main'));
    for (let i = 1; i < spine.length; i++) link(spine[i - 1], spine[i]);
    for (const w of c.wings) {
      const at = spine.find((n) => Math.abs(n.p.z - w.zc) < 0.1);
      const mid = add(V(w.side * 8.8, w.zc), w.id), end = add(V(w.side * 15.2, w.zc), w.id);
      link(at, mid); link(mid, end);
    }
    this.kellNodes = nodes;
    // the man: a lab coat, silver hair, goggles; the ray gun glows in his hand
    const look = { skin: '#e8c8a8', hair: '#d8d8d0', hairStyle: 'short', top: '#f2f4f5', bottom: '#2a2a30', boots: '#151515', shades: true, size: 1 };
    const mesh = this.makeNPC(look);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), new THREE.MeshBasicMaterial({ color: 0x39ff6a, toneMapped: false }));
    gun.position.set(0.22, 1.18, 0.32);
    mesh.add(gun);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    glow.position.set(0.22, 1.18, 0.58);
    mesh.add(glow);
    const lab = c.wings.find((w) => w.id === 'lab');
    mesh.position.set(lab.side * 14, 0, lab.zc);
    this.scene.add(mesh);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.16 }));
    cone.position.y = 0.06;
    mesh.add(cone);
    // X-ray shows him through the walls
    const ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 10), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.55, depthTest: false }));
    ghost.renderOrder = 10; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: 0x9fffb8, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.scene.add(beam);
    this.kell = { mesh, cone, glow, ghost, beam, route: [mesh.position.clone()], wp: 0, path: [], state: 'patrol', charge: 0, stun: 0, t: 0, beamT: 0, seen: null, seenT: 0, talkT: 0, look: 0, seeing: false };
    this.kellRest = mesh.position.clone();
  },

  /** The hall a point is in (its rect id), or null (a room, the ballroom). */
  hallAt(p) {
    for (const r of this.club.halls) if (p.x > r.x0 - 0.05 && p.x < r.x1 + 0.05 && p.z > r.z0 - 0.05 && p.z < r.z1 + 0.05) return r.id;
    return null;
  },

  /** The graph node nearest `p` inside its hall (a room: the hall outside its door). */
  kellNode(p) {
    let q = p, hall = this.hallAt(p);
    if (!hall) {
      const room = this.club.rooms.find((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
      if (room) { q = room.door.clone().addScaledVector(room.inward, -1); hall = this.hallAt(q); }
    }
    const cands = this.kellNodes.filter((n) => !hall || n.rect === hall);
    let best = null, bd = Infinity;
    for (const n of cands.length ? cands : this.kellNodes) { const d = n.p.distanceToSquared(q); if (d < bd) { bd = d; best = n; } }
    return { node: best, at: q };
  },

  /** A path (points) through the hall graph from Kell to `to`. */
  kellPath(to) {
    const k = this.kell, from = this.kellNode(k.mesh.position).node, goal = this.kellNode(to);
    const prev = new Map([[from, null]]), queue = [from];
    while (queue.length) { const n = queue.shift(); if (n === goal.node) break; for (const m of n.nb) if (!prev.has(m)) { prev.set(m, n); queue.push(m); } }
    const pts = [];
    for (let n = goal.node; n; n = prev.get(n)) pts.unshift(n.p.clone());
    pts.push(goal.at.clone());
    return pts;
  },

  /** Send him after her (a trap's alarm, the tracer): straight to where she is now. */
  kellAlarm(why) {
    const k = this.kell;
    if (!k || k.stun > 0) return;
    k.state = 'hunt'; k.path = this.kellPath(this.hero.position); k.seen = this.hero.position.clone(); k.seenT = 0;
    if (why) toast(why, 'bad');
  },

  updateKell(dt) {
    const k = this.kell;
    if (!k) return;
    const m = k.mesh, h = this.hero.position;
    k.t += dt;
    k.beamT = Math.max(0, k.beamT - dt);
    k.beam.material.opacity = k.beamT > 0 ? Math.min(0.95, k.beamT * 4) : 0;
    k.ghost.position.set(m.position.x, 0.9, m.position.z);
    if (k.stun > 0) {
      k.stun -= dt; k.glow.material.opacity = 0; k.cone.visible = false;
      if (k.stun <= 0) { m.rotation.x = 0; m.position.y = 0; k.cone.visible = true; k.state = 'hunt'; k.path = this.kellPath(h); }
      return;
    }
    // the tracer (an experiment): he knows where she is every few seconds
    if (this.tagT > 0 && (k.tagT = (k.tagT || 0) - dt) <= 0) { k.tagT = KELL.tagEvery; if (k.state === 'patrol') this.kellAlarm(); }
    // sight
    const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
    const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
    k.seeing = this.t > this.grace && !this.busy && d < GUARD_RANGE && d > 0.01 && (dx * fx + dz * fz) / d > Math.cos(GUARD_FOV / 2) && this.clearLOS(m.position, h);
    if (k.state === 'charge') {
      m.rotation.y = k.seeing ? Math.atan2(dx, dz) : m.rotation.y;
      k.charge += dt;
      k.glow.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(k.charge * 18));
      k.glow.scale.setScalar(1 + k.charge * 2.5);
      if (k.charge >= (this.tagT > 0 ? KELL.chargeTagged : KELL.charge)) this.kellFire(k.seeing);
    } else if (k.seeing) {
      k.state = 'charge'; k.charge = 0; k.seen = h.clone();
      sfx.alarm();
      const s = this.screenOf(m.position, 2.1);
      if (s) comic.say(pick(LINES.spot), s.x, s.y, { kind: 'shout', speaker: 'DR KELL' });
    } else {
      k.glow.material.opacity = 0; k.glow.scale.setScalar(1);
      // walk: the path if he has one, else a new patrol leg (or back to patrolling after a hunt)
      if (!k.path.length) {
        if (k.state === 'hunt' && (k.seenT += dt) < KELL.memory) {
          m.rotation.y += dt * 2.2; // looking round where he lost her
        } else {
          k.state = 'patrol';
          const goal = pick(this.kellNodes);
          k.path = this.kellPath(goal.p);
        }
      } else {
        const tgt = k.path[0], tx = tgt.x - m.position.x, tz = tgt.z - m.position.z, td = Math.hypot(tx, tz);
        const v = k.state === 'hunt' ? KELL.hunt : KELL.walk;
        if (td < 0.25) { k.path.shift(); if (!k.path.length && k.state === 'hunt') k.seenT = 0; } else {
          m.position.x += (tx / td) * Math.min(td, v * dt); m.position.z += (tz / td) * Math.min(td, v * dt);
          let da = Math.atan2(tx, tz) - m.rotation.y;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          m.rotation.y += da * Math.min(1, dt * 6);
          const s = Math.sin(k.t * 9) * 0.45;
          if (m.legs) { m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s; }
        }
        if (k.state === 'hunt' && (k.talkT -= dt) <= 0) {
          k.talkT = 9;
          const s = this.screenOf(m.position, 2.1);
          if (s && s.x > 0 && s.x < this.g.w && s.y > 0 && s.y < this.g.h) comic.say(pick(LINES.hunt), s.x, s.y, { speaker: 'DR KELL' });
        }
      }
    }
    // the cone: the guards' comic wedge, in kryptonite green, red while he's charging
    if (!k.cone.userData.comic) this.dressCone(k.cone);
    k.shapeT = (k.shapeT || 0) + dt;
    if (k.shapeT > 0.05 || !k.shaped) { k.shapeT = 0; k.shaped = true; this.shapeCone(k); }
    const cu = k.cone.material.uniforms;
    cu.col.value.set(k.state === 'charge' ? 0xff2a2a : k.state === 'hunt' ? 0xffa020 : 0x39ff6a);
    cu.k.value += ((k.state === 'charge' ? 1 : 0.62) - cu.k.value) * Math.min(1, dt * 8);
    cu.alarm.value = k.state === 'charge' ? 1 : 0;
    cu.t.value = this.t;
  },

  /** The ray: a green beam from his hand; still in his sight = hit (the wipe), else a miss and a hunt. */
  kellFire(hit) {
    const k = this.kell, m = k.mesh, h = this.hero.position;
    const from = new THREE.Vector3(m.position.x, 1.2, m.position.z);
    const to = hit ? new THREE.Vector3(h.x, 1.1, h.z) : from.clone().add(new THREE.Vector3(Math.sin(m.rotation.y), 0, Math.cos(m.rotation.y)).multiplyScalar(GUARD_RANGE));
    k.beam.position.copy(from); k.beam.lookAt(to); k.beam.scale.set(1, 1, from.distanceTo(to));
    k.beamT = 0.35;
    k.state = 'hunt'; k.charge = 0; k.glow.material.opacity = 0;
    sfx.zap ? sfx.zap() : sfx.trap();
    if (hit) { this.kellHit(); return; }
    k.path = this.kellPath(k.seen || h); k.seenT = 0;
    const s = this.screenOf(m.position, 2.1);
    if (s) comic.say(pick(LINES.miss), s.x, s.y, { speaker: 'DR KELL' });
  },

  /** A punch from behind: he goes down for a few seconds (the ray clatters to the floor). */
  punchKell() {
    const k = this.kell, h = this.hero;
    if (!k || k.stun > 0) return false;
    const m = k.mesh, dx = m.position.x - h.position.x, dz = m.position.z - h.position.z, d = Math.hypot(dx, dz);
    const fx = Math.sin(h.rotation.y), fz = Math.cos(h.rotation.y);
    if (d > 1.9 || (dx * fx + dz * fz) / d < 0.3) return false;
    k.stun = KELL.stun; k.state = 'patrol'; k.path = []; k.charge = 0;
    m.rotation.x = -Math.PI / 2; m.position.y = 0.2;
    sfx.hit();
    const s = this.screenOf(m.position, 1.2);
    if (s) this.g.commentary.hit(s.x, s.y, { big: true });
    toast(`Dr Kell is down. Not for long: ${KELL.stun} seconds.`, 'good');
    return true;
  },

  /** Back to his lab (after a wipe: he's had his fun). */
  resetKell() {
    const k = this.kell;
    if (!k) return;
    k.mesh.position.copy(this.kellRest); k.mesh.rotation.set(0, 0, 0);
    Object.assign(k, { state: 'patrol', path: [], charge: 0, stun: 0, seen: null });
  },
};
