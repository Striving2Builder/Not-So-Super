// The house perfume (docs/design/act2.md, RLD Walks): hostesses with atomizers walk the streets and
// spray her when they get close; vents over some of the red doors hiss on a timer. Every spray adds
// intoxication (the shared meter). Over the haze line (state.js INTOX_HAZE) the neon smears (a ghost
// of the signs drifts round them) and the X-ray flickers. Mixed into RldWalk.prototype.
import * as THREE from 'three';
import { INTOX_HAZE } from '../state.js';
import { npcLook } from '../art.js';
import { toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, rand, shuffle } from '../util.js';
import { quality } from '../settings.js';
import { puffTex } from './art.js';
import { DOOR_H } from './plan.js';
import { capsulePush } from '../clubgeo.js';

const VENT_COL = { idle: new THREE.Color(0x8a6a30), warn: new THREE.Color(0xff7ab8), warn2: new THREE.Color(0xc04080) };
const PUFF = { n: 48, life: 1.4, col: new THREE.Color(0xff7ab8) };
const SPRAY = { hostess: 8, vent: 6, reach: 1.5, seeAt: 5.5, cd: 5, step: 1.5 };
const HOSTESS_LINES = ['"Try the house perfume, darling."', '"On the house, sweetheart."', '"Mm. You smell like trouble. Let me fix that."', '"Relax. Everybody here does."'];

export const perfumeMethods = {
  buildPerfume() {
    const n = PUFF.n, pos = new Float32Array(n * 3).fill(-50), col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.85, map: puffTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; pts.raycast = () => {};
    this.scene.add(pts);
    this.puffs = { pts, life: new Float32Array(n), vel: new Float32Array(n * 3), i: 0 };
    this.hostesses = [];
    this.vents = []; this.ventMesh = null;
    this.sprayToastT = 0;
    this.hazeTold = false;
    // the neon smear: a ghost of the signs, drifting round them over the haze line
    const signs = this.club.signs;
    if (signs && quality().look3d !== 'min') {
      const m = signs.material.clone(); m.opacity = 0; m.transparent = true;
      this.smear = new THREE.Mesh(signs.geometry.clone(), m);
      this.smear.raycast = () => {}; this.smear.renderOrder = 3; this.smear.visible = false;
      this.scene.add(this.smear);
    }
  },

  /** A burst of perfume at `at`, drifting along `dir` (x/z) and spreading. */
  emitPuff(at, dir, count = 10) {
    const P = this.puffs, pos = P.pts.geometry.attributes.position.array;
    for (let k = 0; k < count; k++) {
      const i = P.i = (P.i + 1) % PUFF.n;
      pos[i * 3] = at.x + rand(-0.1, 0.1); pos[i * 3 + 1] = at.y + rand(-0.1, 0.1); pos[i * 3 + 2] = at.z + rand(-0.1, 0.1);
      P.vel[i * 3] = dir.x * rand(0.6, 1.6) + rand(-0.4, 0.4); P.vel[i * 3 + 1] = dir.y * rand(0.6, 1.4) + rand(-0.2, 0.3); P.vel[i * 3 + 2] = dir.z * rand(0.6, 1.6) + rand(-0.4, 0.4);
      P.life[i] = PUFF.life * rand(0.7, 1);
    }
  },

  stepPuffs(dt) {
    const P = this.puffs, a = P.pts.geometry.attributes, pos = a.position.array, col = a.color.array;
    let live = false;
    for (let i = 0; i < PUFF.n; i++) {
      if (P.life[i] <= 0) continue;
      live = true;
      P.life[i] -= dt;
      const k = Math.max(0, P.life[i] / PUFF.life);
      for (let j = 0; j < 3; j++) { pos[i * 3 + j] += P.vel[i * 3 + j] * dt; P.vel[i * 3 + j] *= 1 - dt * 1.6; }
      col[i * 3] = PUFF.col.r * k; col[i * 3 + 1] = PUFF.col.g * k; col[i * 3 + 2] = PUFF.col.b * k;
      if (P.life[i] <= 0) pos[i * 3 + 1] = -50;
    }
    if (live || P.wasLive) { a.position.needsUpdate = true; a.color.needsUpdate = true; }
    P.wasLive = live;
  },

  /** Brass vents over a few of the red doors (street side), each on its own hiss timer. */
  placeVents(rooms) {
    // one instanced mesh for every vent this visit (one draw call), each with its own colour
    const n = rooms.length + this.vents.length, old = this.ventMesh;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.2, 0.22), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    mesh.raycast = () => {}; mesh.frustumCulled = false;
    this.scene.add(mesh);
    if (old) { this.scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
    this.ventMesh = mesh;
    for (const r of rooms) {
      const out = r.inward.clone().multiplyScalar(-0.2), p = r.door.clone().add(out).setY(DOOR_H + 0.28);
      const period = rand(6, 9);
      this.vents.push({ room: r, pos: r.door.clone().add(out.multiplyScalar(3)), top: p, period, ph: rand(0, period), last: 0, ry: r.alongX ? 0 : Math.PI / 2 });
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    this.vents.forEach((v, i) => { mesh.setMatrixAt(i, m4.compose(v.top, q.setFromAxisAngle(up, v.ry), one)); mesh.setColorAt(i, VENT_COL.idle); });
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  },

  placeHostesses(n) {
    const routes = shuffle([...this.club.routes]);
    for (let i = 0; i < n; i++) {
      const r = routes[i % routes.length];
      const look = npcLook('civilian'); Object.assign(look, { top: pick(['#ff4fa0', '#e03070', '#c050ff']), skirt: '#2a0a18', bottom: null, hairStyle: 'long', boots: '#1a0a10' });
      const mesh = this.makeNPC(look);
      const route = Math.random() < 0.5 ? [r.from.clone(), r.to.clone()] : [r.to.clone(), r.from.clone()];
      mesh.position.copy(route[0].clone().lerp(route[1], rand(0.2, 0.8)));
      // the atomizer: a little pink bottle in her hand
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0xff7ab8, toneMapped: false }));
      bottle.position.set(0.32, 1.05, 0.18); mesh.add(bottle);
      this.hostesses.push({ mesh, route, wp: 1, cd: rand(1, 3), t: rand(0, 3), bottle, disarmed: false, chase: false });
    }
  },

  /** A spray reached her: intoxication, a line, and the haze line crossed (once) explained. */
  spray(n, line) {
    const st = this.g.state, was = st.intox;
    st.addIntox(n);
    sfx.breath?.();
    if (this.t > this.sprayToastT) { this.sprayToastT = this.t + 2.5; toast(`🌸 ${line} Intoxication +${n}`, 'bad'); }
    if (was < INTOX_HAZE && st.intox >= INTOX_HAZE && !this.hazeTold) {
      this.hazeTold = true;
      setTimeout(() => { if (!this.done) toast('Over the haze line: the neon smears and your X-ray flickers. Fresh air helps (it wears off slowly).', 'info'); }, 1400);
    }
  },

  updatePerfume(dt) {
    const h = this.hero.position, t = this.t;
    if (!this.puffs) return;
    this.stepPuffs(dt);
    // the vents: glow pink for the last second, then hiss
    this.vents.forEach((v, i) => {
      const ph = (t + v.ph) % v.period, warn = ph > v.period - 1;
      this.ventMesh.setColorAt(i, warn ? (Math.sin(t * 30) > 0 ? VENT_COL.warn : VENT_COL.warn2) : VENT_COL.idle);
      if (ph < v.last) {
        this.emitPuff(v.top, new THREE.Vector3(0, -0.8, 0).addScaledVector(v.room.inward, -0.6), 12);
        if (!this.busy && Math.hypot(h.x - v.pos.x, h.z - v.pos.z) < SPRAY.reach + 0.3) this.spray(SPRAY.vent, 'A vent over the door hisses: the house perfume.');
      }
      v.last = ph;
    });
    if (this.ventMesh) this.ventMesh.instanceColor.needsUpdate = true;
    // the hostesses: stroll their street; close enough and in sight, they come over and spray
    for (const s of this.hostesses) {
      const m = s.mesh;
      s.t += dt; s.cd -= dt;
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      s.chase = !s.disarmed && !this.busy && this.t > this.grace && d < SPRAY.seeAt && this.clearLOS(m.position, h);
      let tx, tz, speed = 1.1;
      if (s.chase) { tx = h.x; tz = h.z; speed = SPRAY.step; } else {
        const tgt = s.route[s.wp];
        tx = tgt.x; tz = tgt.z;
        if (Math.hypot(tx - m.position.x, tz - m.position.z) < 0.25) s.wp = (s.wp + 1) % s.route.length;
      }
      const ex = tx - m.position.x, ez = tz - m.position.z, ed = Math.hypot(ex, ez);
      if (ed > (s.chase ? 1.0 : 0.05)) {
        m.position.x += (ex / ed) * speed * dt; m.position.z += (ez / ed) * speed * dt;
        if (s.chase) { const gp = this._hp || (this._hp = new THREE.Vector3()); gp.copy(m.position); capsulePush(this.club.collider, gp, 0.3); m.position.x = gp.x; m.position.z = gp.z; }
        let da = Math.atan2(ex, ez) - m.rotation.y;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        m.rotation.y += da * Math.min(1, dt * 6);
        const sw = Math.sin(s.t * 8) * 0.35;
        if (m.legs) { m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; }
      }
      if (s.chase && d < SPRAY.reach && s.cd <= 0) {
        s.cd = SPRAY.cd;
        const hand = new THREE.Vector3(0.32, 1.1, 0.18).applyMatrix4(m.matrixWorld);
        this.emitPuff(hand, new THREE.Vector3(dx / d, 0.15, dz / d), 12);
        this.spray(SPRAY.hostess, pick(HOSTESS_LINES));
      }
    }
    this.updateHaze(dt);
  },

  /** Over the haze line: the signs' ghost drifts, and the X-ray flickers in and out. */
  updateHaze(dt) {
    const st = this.g.state, k = Math.max(0, Math.min(1, (st.intox - INTOX_HAZE) / 30));
    if (this.smear) {
      this.smear.visible = k > 0.02;
      if (this.smear.visible) {
        this.smear.material.opacity = 0.25 + 0.45 * k;
        this.smear.position.set(Math.sin(this.t * 1.7) * 0.25 * k, Math.sin(this.t * 2.3) * 0.08 * k, Math.cos(this.t * 1.3) * 0.25 * k);
      }
    }
    if (this.xray && st.intox >= INTOX_HAZE) {
      this.flickT = (this.flickT || 0) - dt;
      if (this.flickT <= 0) {
        this.flickT = rand(0.06, 0.2);
        const on = Math.random() > 0.25 + 0.35 * k;
        for (const m of this.hidden) m.visible = on;
        if (this.wallMat) this.wallMat.opacity = on ? 0.15 : 0.85;
        if (this.club.M.window) this.club.M.window.opacity = on ? 0.15 : 0.85;
      }
    }
  },

  /** Her punch knocks the atomizer out of a hostess's hand (no more sprays from her). */
  disarmHostess() {
    const h = this.hero, fx = Math.sin(h.rotation.y), fz = Math.cos(h.rotation.y);
    for (const s of this.hostesses) {
      if (s.disarmed) continue;
      const dx = s.mesh.position.x - h.position.x, dz = s.mesh.position.z - h.position.z, d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / d > 0.3) {
        s.disarmed = true; s.bottle.visible = false;
        sfx.hit();
        toast('You knock the atomizer out of her hand. She backs off.', 'good');
        return true;
      }
    }
    return false;
  },
};
