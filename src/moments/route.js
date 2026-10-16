// r11 F2c: route content. Between the director's offers the sky ahead of her is never empty for long:
// every ROUTE.after seconds of plain commuting one cheap piece goes up on her line, at her height:
//   hoops     a string of 3 gold hoops: thread them (a speed kick each)
//   slip      a slipstream ribbon: fly along it for a speed burst (BOOST without the button)
//   pigeons   a flock wheeling over the roofs: fly through and they scatter
//   smoke     a plume off a rooftop: swoop through it, she trails smoke
// Built once (one ribbon mesh, one bird InstancedMesh; hoops and smoke use the kit's pools), one piece
// at a time, logged in the director's timeline as route:<kind>. Gated on quality() (birds).
import * as THREE from 'three';
import { M } from '../city3d.js';
import { toScene } from './kit3d.js';
import { tag } from './hud.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { quality } from '../settings.js';
import { rand, pick, dist } from '../util.js';

export const ROUTE = {
  after: [5, 7],  // s of plain commuting (nothing offered) before a piece goes up
  ahead: [1000, 1250], // world units out along her line (~2 s at cruise: time to line up)
  life: 22,         // s before an unvisited piece goes
  burst: 2.2,       // s of slipstream boost
  hoopR: 20,        // m (the hoop's radius); the pass test is HOOP_PASS world units
  birds: { high: 22, balanced: 16, saver: 10 },
};
const HOOP_PASS = 52, KINDS = ['hoops', 'slip', 'pigeons', 'smoke'];
const GOLD = '#ffd23f', SLIP = new THREE.Color('#9ff6ff');

const RIB_VS = `attribute float ru, rv; varying float vU, vV; void main() { vU = ru; vV = rv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIB_FS = `uniform float time, alpha; uniform vec3 col; varying float vU, vV;
void main() {
  float chev = fract(vU * 26.0 - time * 2.6 + abs(vV) * 0.9);
  float band = smoothstep(0.0, 0.25, chev) * (1.0 - smoothstep(0.45, 0.62, chev));
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vV)), ends = smoothstep(0.0, 0.06, vU) * (1.0 - smoothstep(0.9, 1.0, vU));
  float a = (0.45 + 0.55 * band) * edge * ends * alpha;
  gl_FragColor = vec4(mix(col, vec3(1.0), band * 0.5) * a, a);
}`;
const SEG = 28;

export class RouteFX {
  constructor(dir) { this.dir = dir; this.reset(); }
  get ow() { return this.dir.ow; }

  reset() { this.p = null; this.since = 0; this.wait = ROUTE.after[1]; // (no Math.random here: the sim's random stream stays as it was)
    this.burst = 0; this.trail = 0; this.hide(); }

  // ------------------------------------------------------------------ meshes (built once per scene)
  build(scene) {
    if (this.scene === scene) return;
    this.dispose();
    this.scene = scene;
    const g = new THREE.BufferGeometry(), n = (SEG + 1) * 2;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const ru = new Float32Array(n), rv = new Float32Array(n), idx = [];
    for (let i = 0; i <= SEG; i++) { ru[i * 2] = ru[i * 2 + 1] = i / SEG; rv[i * 2] = -1; rv[i * 2 + 1] = 1; if (i < SEG) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    g.setAttribute('ru', new THREE.BufferAttribute(ru, 1)); g.setAttribute('rv', new THREE.BufferAttribute(rv, 1)); g.setIndex(idx);
    this.ribU = { time: { value: 0 }, alpha: { value: 1 }, col: { value: SLIP } };
    this.rib = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, uniforms: this.ribU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.rib.frustumCulled = false; this.rib.visible = false; scene.add(this.rib);
    // a bird: a flat V (wing tips raised a little: the flap scales them through y)
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.35, -0.6, 0.18, -0.12, 0, 0, -0.2, 0, 0, 0.35, 0, 0, -0.2, 0.6, 0.18, -0.12]), 3));
    this.nBirds = ROUTE.birds[quality().id] || ROUTE.birds.balanced;
    this.birds = new THREE.InstancedMesh(b, new THREE.MeshBasicMaterial({ color: 0x1b1622, side: THREE.DoubleSide }), 24);
    this.birds.frustumCulled = false; this.birds.count = 0; this.birds.visible = false; scene.add(this.birds);
  }

  dispose() {
    for (const m of [this.rib, this.birds]) if (m) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.rib = this.birds = null; this.scene = null;
  }

  hide() { if (this.rib) this.rib.visible = false; if (this.birds) { this.birds.visible = false; this.birds.count = 0; } }

  // ------------------------------------------------------------------ placing
  /** Per frame (game dt) from the director: place one when the sky's been empty long enough, test the pass. */
  update(dt, plain) {
    const ow = this.ow, h = ow.hero;
    if (this.burst > 0) this.burst -= dt;
    if (this.trail > 0) this.trail -= dt;
    if (this.p) {
      const p = this.p;
      p.t += dt;
      this[`step_${p.kind}`](p, dt);
      const ax = Math.cos(p.ang), ay = Math.sin(p.ang), back = (h.x - p.ex) * ax + (h.y - p.ey) * ay; // past its far end?
      if (p.t > ROUTE.life || back > 260 || (!p.hit && dist(h.x, h.y, p.x, p.y) > 2600)) { this.p = null; this.hide(); this.since = 0; }
      return;
    }
    if (!plain || !ow.view3d) { this.since = 0; return; }
    this.since += dt;
    if (this.since < this.wait || this.dir.clock - (this.dir.lastAny ?? -99) < this.wait) return;
    // (r11 F2c: every kind in turn, at her height then a band up: dense towers used to block it for ~28 s)
    let p = null;
    for (const kind of [this.pickKind(), ...KINDS]) { if (kind === this.last) continue; p = this.place(kind) || (kind !== 'smoke' ? this.place(kind, 160) : null); if (p) break; }
    this.since = this.wait - 2; // (nowhere to put it here: try again in a couple of seconds)
    if (!p) return;
    this.p = p; this.since = 0; this.wait = rand(...ROUTE.after); this.last = p.kind;
    this.dir.note({ kind: `route:${p.kind}` }, 'offered');
    this.dir.lastAny = this.dir.clock;
  }

  pickKind() { const k = KINDS.filter((q) => q !== this.last); return pick(k); }

  /** Her line: toward the waypoint when autopilot would fly it, else her heading. */
  line() {
    const ow = this.ow, h = ow.hero, t = ow.nav.target;
    return t && dist(t.x, t.y, h.x, h.y) > 1400 && ow.nav.autopilot ? Math.atan2(t.y - h.y, t.x - h.x) * 0.5 + h.ang * 0.5 : h.ang;
  }

  /** Clear sky along a segment at height z (no tower reaching within `pad` of it). */
  clear(x0, y0, x1, y1, z, pad = 40) {
    const ow = this.ow;
    for (let i = 0; i <= 10; i++) { const o = ow.buildingAt(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); if (o && ow.hOf(o) > z - pad) return false; }
    return true;
  }

  place(kind, up = 0) {
    const ow = this.ow, h = ow.hero, city = ow.g.city, a0 = this.line(), z = Math.max(h.z, 140) + up;
    for (let i = 0; i < 6; i++) {
      const ang = a0 + rand(-0.12, 0.12), d = rand(...ROUTE.ahead);
      const x = h.x + Math.cos(ang) * d, y = h.y + Math.sin(ang) * d;
      if (x < 300 || y < 300 || x > city.coastX - 300 || y > city.H - 300) continue;
      const p = { kind, ang, x, y, z, t: 0, hit: 0, ex: x, ey: y };
      if (kind === 'hoops') {
        p.hoops = [0, 1, 2].map((k) => ({ x: x + Math.cos(ang) * k * 230 - Math.sin(ang) * Math.sin(k * 1.7) * 40, y: y + Math.sin(ang) * k * 230 + Math.cos(ang) * Math.sin(k * 1.7) * 40, z: z + (k === 1 ? 30 : 0), ang, done: false }));
        p.next = 0; const L = p.hoops[2]; p.ex = L.x; p.ey = L.y;
        if (!this.clear(x - Math.cos(ang) * 200, y - Math.sin(ang) * 200, L.x, L.y, z)) continue;
      } else if (kind === 'slip') {
        const len = 1100, sx = x - Math.cos(ang) * 120, sy = y - Math.sin(ang) * 120;
        p.pts = Array.from({ length: SEG + 1 }, (_, k) => { const u = k / SEG, s = Math.sin(u * Math.PI * 1.5) * 70; return { x: sx + Math.cos(ang) * u * len - Math.sin(ang) * s, y: sy + Math.sin(ang) * u * len + Math.cos(ang) * s, z: z - 16 + Math.sin(u * Math.PI) * 24 }; });  // (a little under her line: a flat band at eye level is edge-on)
        const L = p.pts[SEG]; p.ex = L.x; p.ey = L.y;
        if (!this.clear(sx - Math.cos(ang) * 150, sy - Math.sin(ang) * 150, L.x, L.y, z)) continue;
        this.ribbon(p);
      } else if (kind === 'pigeons') {
        if (!this.clear(x - Math.cos(ang) * 200, y - Math.sin(ang) * 200, x + Math.cos(ang) * 120, y + Math.sin(ang) * 120, z)) continue;
        p.birds = Array.from({ length: this.nBirds }, (_, k) => ({ a: (k / this.nBirds) * Math.PI * 2 + rand(-0.2, 0.2), r: rand(30, 75), dz: rand(-18, 18), ph: rand(0, 6), w: rand(0.7, 1.1), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
      } else if (kind === 'smoke') {
        const r = this.dir.roofNear(x, y, 240, 60, z - 70, 30);
        if (!r) continue;
        Object.assign(p, { x: r.x, y: r.y, roof: r.z, ex: r.x, ey: r.y });
      }
      return p;
    }
    return null;
  }

  ribbon(p) {
    const P = this.rib.geometry.attributes.position, W = 22 / M; // half-width: 22 m
    for (let k = 0; k <= SEG; k++) {
      const a = p.pts[k], b = p.pts[Math.min(SEG, k + 1)], c = p.pts[Math.max(0, k - 1)];
      const dx = b.x - c.x, dy = b.y - c.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, tilt = Math.sin(k / SEG * Math.PI * 2) * 0.35;
      P.setXYZ(k * 2, (a.x - nx * W) * M, (a.z - tilt * W) * M, (a.y - ny * W) * M);
      P.setXYZ(k * 2 + 1, (a.x + nx * W) * M, (a.z + tilt * W) * M, (a.y + ny * W) * M);
    }
    P.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the pass tests
  pop(word, x, y, z, col) {
    const ow = this.ow, v = ow.view3d, kit = this.dir.kit;
    let sx = ow.heroScreen?.x ?? ow.g.w / 2, sy = (ow.heroScreen?.y ?? ow.g.h / 2) - 70;
    if (v?.cam) { const q = v.projector().proj(x, y, z); if (q[2]) { sx = q[0]; sy = q[1] - 30; } }
    comic.pow(word, sx, Math.max(90, sy), { size: 0.8 });
    if (kit) { kit.flash(x, y, z, 10, '#ffffff', 0.2); kit.spark(x, y, z, 12, col, 70); }
  }

  kick(k) { const h = this.ow.hero; h.speed = Math.min(1150, (h.speed || 0) + k); if (this.ow.view3d?.cam) this.ow.view3d.cam.kick = 1; }

  step_hoops(p) {
    const h = this.ow.hero, r = p.hoops[p.next];
    if (!r) return;
    const along = (h.x - r.x) * Math.cos(r.ang) + (h.y - r.y) * Math.sin(r.ang);
    if (Math.abs(along) < 40 && dist(h.x, h.y, r.x, r.y) < HOOP_PASS && Math.abs(h.z - r.z) < HOOP_PASS) {
      r.done = true; p.next++; p.hit++; sfx.pickup(); this.kick(160);
      if (p.hit === 1) this.dir.note({ kind: 'route:hoops' }, 'taken');
      this.pop(p.next === 3 ? (p.hit === 3 ? 'THREADED!' : 'SWISH!') : 'SWISH!', r.x, r.y, r.z, GOLD);
    } else if (along > 40) p.next++; // (missed: the next one)
  }

  step_slip(p) {
    const h = this.ow.hero;
    if (p.hit) return;
    for (const q of p.pts) if (Math.abs(h.x - q.x) < 60 && Math.abs(h.y - q.y) < 60 && Math.abs(h.z - q.z) < 70) {
      p.hit = 1; this.burst = ROUTE.burst; this.kick(260); sfx.pickup();
      this.dir.note({ kind: 'route:slip' }, 'taken');
      this.pop('SLIPSTREAM!', h.x, h.y, h.z, '#9ff6ff');
      return;
    }
  }

  step_pigeons(p, dt) {
    const h = this.ow.hero;
    for (const b of p.birds) {
      if (p.hit) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz += 20 * dt; continue; }
      b.a += dt * 0.9 * b.w;
      b.x = p.x + Math.cos(b.a) * b.r; b.y = p.y + Math.sin(b.a) * b.r; b.z = p.z + b.dz + Math.sin(p.t * 1.3 + b.ph) * 6;
    }
    if (!p.hit && Math.hypot(h.x - p.x, h.y - p.y, h.z - p.z) < 150) {
      p.hit = 1; sfx.pickup?.();
      this.dir.note({ kind: 'route:pigeons' }, 'taken');
      for (const b of p.birds) { const dx = b.x - h.x, dy = b.y - h.y, L = Math.hypot(dx, dy) || 1, s = rand(90, 170); b.vx = (dx / L) * s; b.vy = (dy / L) * s; b.vz = rand(30, 90); }
      this.pop('FLAP!', p.x, p.y, p.z + 20, '#ffffff');
    }
  }

  step_smoke(p) {
    const h = this.ow.hero;
    if (!p.hit && dist(h.x, h.y, p.x, p.y) < 70 && h.z > p.roof - 10 && h.z < p.z + 140) {
      p.hit = 1; this.trail = 1.4; this.kick(120);
      this.dir.note({ kind: 'route:smoke' }, 'taken');
      this.pop('SWOOSH!', h.x, h.y, h.z, '#d8d8e0');
    }
  }

  // ------------------------------------------------------------------ drawing (between the kit's begin/end)
  draw(kit, view, dt) {
    this.build(view.scene);
    const p = this.p, ow = this.ow, h = ow.hero, t = ow.t;
    this.ribU.time.value = t;
    if (this.trail > 0 && Math.random() < 0.6) kit.smoke(h.x - Math.cos(h.ang) * 6, h.y - Math.sin(h.ang) * 6, h.z, { size: 2.6, col: '#9a98a4', life: 1.1, rise: 2, spread: 2 });
    if (!p) { this.hide(); return; }
    this.rib.visible = p.kind === 'slip';
    if (p.kind === 'slip') this.ribU.alpha.value = Math.min(1, p.t * 2) * (p.hit ? 0.55 : 1);
    if (p.kind === 'hoops') p.hoops.forEach((r, i) => { if (!r.done && i >= p.next) kit.hoops.put(r.x, r.y, r.z, r.ang, 0, 0, ROUTE.hoopR, i === p.next ? GOLD : '#b38a1c'); });
    if (p.kind === 'smoke' && Math.random() < 0.55) kit.smoke(p.x + rand(-6, 6), p.y + rand(-6, 6), p.roof + 4, { size: 7, col: '#6b6a74', life: 3.4, rise: 70, spread: 10 });
    const B = this.birds;
    B.visible = p.kind === 'pigeons';
    if (p.kind === 'pigeons') {
      const _v = RouteFX._v || (RouteFX._v = new THREE.Vector3()), _q = RouteFX._q || (RouteFX._q = new THREE.Quaternion()), _s = RouteFX._s || (RouteFX._s = new THREE.Vector3()), _m = RouteFX._m || (RouteFX._m = new THREE.Matrix4()), _e = RouteFX._e || (RouteFX._e = new THREE.Euler());
      let n = 0;
      for (const b of p.birds) {
        if (n >= 24) break;
        const head = p.hit ? Math.atan2(b.vy, b.vx) : b.a + Math.PI / 2;
        toScene(_v, b.x, b.y, b.z);
        _q.setFromEuler(_e.set(0, Math.PI / 2 - head, 0, 'YXZ'));
        const s = 3.2, flap = Math.sin(t * (p.hit ? 22 : 12) + b.ph) * 1.6;
        B.setMatrixAt(n++, _m.compose(_v, _q, _s.set(s, s * flap, s)));
      }
      B.count = n; B.instanceMatrix.needsUpdate = true;
    }
  }

  /** A small tag over the piece while it's ahead (what it is, once). */
  overlay(ctx, P, W, H) {
    const p = this.p;
    if (!p || p.hit) return;
    const at = p.kind === 'hoops' ? p.hoops[p.next] : p.kind === 'slip' ? p.pts[6] : p;
    if (!at) return;
    const q = P.proj(at.x, at.y, (at.z || 0) + (p.kind === 'hoops' ? 50 : 30));
    if (!q[2] || q[0] < 40 || q[0] > W - 40 || q[1] < 60 || q[1] > H - 40) return;
    const word = { hoops: `HOOPS ${p.next}/3`, slip: 'SLIPSTREAM', pigeons: 'PIGEONS!', smoke: 'SWOOP IT!' }[p.kind];
    tag(ctx, q[0], q[1], word, { col: p.kind === 'hoops' ? GOLD : p.kind === 'slip' ? '#9ff6ff' : '#ffffff', size: 12, lift: 10 });
  }
}
