// Simulated cloth cape. The model's own cape is rigid (no cape bones in the Mixamo rig), so it is
// hidden at load and replaced with this Verlet cloth pinned across the shoulders.
// Everything runs in the hero root's local space: +y up, +z = the direction she faces.
import * as THREE from 'three';

const COLS = 7, ROWS = 11;
const LENGTH = 1.02;           // metres, shoulders → hem
const TOP_W = 0.36, HEM_W = 0.78;
const ITER = 4;
const GRAVITY = 9.8;

/**
 * Remove the original cape triangles from a skinned mesh (it is a separate mesh island that
 * flares far behind the body in the bind pose). Mutates the shared geometry once.
 */
export function stripModelCape(mesh) {
  const geo = mesh.geometry;
  if (geo.userData.capeStripped) return;
  const pos = geo.attributes.position, idx = geo.index.array, n = pos.count;
  const parent = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (let i = 0; i < idx.length; i += 3) { unite(idx[i], idx[i + 1]); unite(idx[i], idx[i + 2]); }
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (seen.has(k)) unite(i, seen.get(k)); else seen.set(k, i);
  }
  // The cape island: the one whose vertices reach far behind the body.
  const minZ = new Map(), count = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    minZ.set(r, Math.min(minZ.get(r) ?? Infinity, pos.getZ(i)));
    count.set(r, (count.get(r) || 0) + 1);
  }
  let cape = null;
  for (const [r, z] of minZ) if (z < -0.5 && count.get(r) > 200) cape = r;
  if (cape === null) return;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) if (find(idx[i]) !== cape) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  geo.setIndex(keep);
  geo.userData.capeStripped = true;
}

export class Cape {
  /** @param root hero root object, @param bones name→Bone (without 'mixamorig'), @param baseMat model material to borrow the fabric texture from */
  constructor(root, bones, baseMat) {
    this.root = root;
    this.b = bones;
    this.wind = new THREE.Vector3();
    this.t = Math.random() * 10;
    const N = COLS * ROWS;
    this.p = new Float32Array(N * 3);
    this.prev = new Float32Array(N * 3);
    this.cons = [];
    const at = (c, r) => r * COLS + c;
    const link = (a, b, stiff) => this.cons.push([a, b, 0, stiff]);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1) link(at(c, r), at(c + 1, r), 1);
      if (r < ROWS - 1) link(at(c, r), at(c, r + 1), 1);
      if (c < COLS - 1 && r < ROWS - 1) { link(at(c, r), at(c + 1, r + 1), 0.6); link(at(c + 1, r), at(c, r + 1), 0.6); }
      if (r < ROWS - 2) link(at(c, r), at(c, r + 2), 0.3); // bend stiffness
    }
    // Rest lengths from an idealised flat trapezoid.
    const rest = (i) => {
      const c = i % COLS, r = (i / COLS) | 0, v = r / (ROWS - 1);
      const w = TOP_W + (HEM_W - TOP_W) * v;
      return [(c / (COLS - 1) - 0.5) * w, -v * LENGTH];
    };
    for (const k of this.cons) { const a = rest(k[0]), b = rest(k[1]); k[2] = Math.hypot(a[0] - b[0], a[1] - b[1]); }

    // Mesh
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const uv = new Float32Array(N * 2);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      // the plain red fabric area of the model's texture atlas
      uv[at(c, r) * 2] = 0.30 + (c / (COLS - 1)) * 0.46;
      uv[at(c, r) * 2 + 1] = 0.27 + (r / (ROWS - 1)) * 0.14;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const index = [];
    for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) {
      const a = at(c, r), b = at(c + 1, r), d = at(c, r + 1), e = at(c + 1, r + 1);
      index.push(a, d, b, b, d, e);
    }
    geo.setIndex(index);
    const mat = baseMat && baseMat.map
      ? new THREE.MeshStandardMaterial({ map: baseMat.map, color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: 0xb3141c, roughness: 0.85, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    root.add(this.mesh);
    this.reset();
  }

  // --- skeleton-derived anchor frame, in root-local space
  bonePos(name, out) {
    const b = this.b[name];
    b.getWorldPosition(out);
    return this.root.worldToLocal(out);
  }

  frame() {
    const L = this.bonePos('LeftArm', this._l || (this._l = new THREE.Vector3()));
    const R = this.bonePos('RightArm', this._r || (this._r = new THREE.Vector3()));
    const neck = this.bonePos('Neck', this._n || (this._n = new THREE.Vector3()));
    const hips = this.bonePos('Hips', this._h || (this._h = new THREE.Vector3()));
    const up = (this._up || (this._up = new THREE.Vector3())).subVectors(neck, hips).normalize();
    const across = (this._ac || (this._ac = new THREE.Vector3())).subVectors(R, L);
    const fwd = (this._fw || (this._fw = new THREE.Vector3())).crossVectors(across, up).normalize();
    if (this.sign === undefined) this.sign = fwd.z >= 0 ? 1 : -1; // calibrate once so fwd = where she faces
    fwd.multiplyScalar(this.sign);
    return { L, R, neck, up, fwd };
  }

  anchor(c, f, out) {
    const s = c / (COLS - 1);
    // pinned across the upper back, a little inside the shoulders, curving around the neck
    out.lerpVectors(f.L, f.R, 0.14 + s * 0.72);
    out.y = out.y * 0.5 + f.neck.y * 0.5 - 0.06;
    const bulge = 1 - Math.pow(s * 2 - 1, 2);
    out.addScaledVector(f.fwd, -(0.1 + bulge * 0.035));
    return out;
  }

  reset() {
    this.root.updateWorldMatrix(true, true);
    const f = this.frame(), a = new THREE.Vector3();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * 3;
      this.anchor(c, f, a);
      const v = r / (ROWS - 1);
      a.addScaledVector(f.up, -v * LENGTH).addScaledVector(f.fwd, -v * 0.15);
      const spread = (c / (COLS - 1) - 0.5) * (HEM_W - TOP_W) * v;
      a.x += spread;
      this.p[i] = this.prev[i] = a.x; this.p[i + 1] = this.prev[i + 1] = a.y; this.p[i + 2] = this.prev[i + 2] = a.z;
    }
    this.last = performance.now();
  }

  /** Run many steps so a one-off snapshot (newspaper photo) shows a settled cape. */
  settle(steps = 90) { for (let i = 0; i < steps; i++) this.step(1 / 60); }

  /** Advance using real elapsed time (for callers that only pose(), like sprites). */
  tick() {
    const now = performance.now();
    const dt = Math.min(1 / 20, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (dt > 0) this.step(dt);
  }

  step(dt) {
    this.root.updateWorldMatrix(true, true);
    const f = this.frame();
    this.t += dt;
    const sub = dt > 1 / 45 ? 2 : 1, h = dt / sub;
    const w = this.wind;
    // flutter: wind gusts perpendicular-ish to the flow
    const flut = 0.35 + w.length() * 0.12;
    const cols = this.colliders(f);
    const a = this._a || (this._a = new THREE.Vector3());
    for (let s = 0; s < sub; s++) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = (r * COLS + c) * 3;
        if (r === 0) { this.anchor(c, f, a); this.p[i] = this.prev[i] = a.x; this.p[i + 1] = this.prev[i + 1] = a.y; this.p[i + 2] = this.prev[i + 2] = a.z; continue; }
        const x = this.p[i], y = this.p[i + 1], z = this.p[i + 2];
        const vx = (x - this.prev[i]) * 0.985, vy = (y - this.prev[i + 1]) * 0.985, vz = (z - this.prev[i + 2]) * 0.985;
        const g = Math.sin(this.t * 7.3 + c * 0.9 + r * 0.6) * flut, g2 = Math.cos(this.t * 5.1 + r * 0.8) * flut;
        const ax = w.x + g * 0.6, ay = w.y - GRAVITY + g2, az = w.z + g * 0.4;
        this.prev[i] = x; this.prev[i + 1] = y; this.prev[i + 2] = z;
        this.p[i] = x + vx + ax * h * h;
        this.p[i + 1] = y + vy + ay * h * h;
        this.p[i + 2] = z + vz + az * h * h;
      }
      for (let it = 0; it < ITER; it++) {
        for (const [ia, ib, len, k] of this.cons) {
          const A = ia * 3, B = ib * 3;
          const dx = this.p[B] - this.p[A], dy = this.p[B + 1] - this.p[A + 1], dz = this.p[B + 2] - this.p[A + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          if (k < 1 && d < len) continue; // shear/bend links only resist stretching
          const diff = ((d - len) / d) * 0.5 * k;
          const pinA = ia < COLS, pinB = ib < COLS;
          const wa = pinA ? 0 : pinB ? 1 : 0.5, wb = pinB ? 0 : pinA ? 1 : 0.5;
          this.p[A] += dx * diff * wa * 2; this.p[A + 1] += dy * diff * wa * 2; this.p[A + 2] += dz * diff * wa * 2;
          this.p[B] -= dx * diff * wb * 2; this.p[B + 1] -= dy * diff * wb * 2; this.p[B + 2] -= dz * diff * wb * 2;
        }
        this.collide(cols, f);
      }
    }
    this.upload();
  }

  colliders(f) {
    const v = (n) => this.bonePos(n, new THREE.Vector3());
    const mid = (a, b) => v(a).add(v(b)).multiplyScalar(0.5);
    const list = [
      [v('Spine2'), 0.17], [v('Spine1'), 0.16], [v('Spine'), 0.16], [v('Hips'), 0.19],
      [mid('LeftUpLeg', 'LeftLeg'), 0.11], [mid('RightUpLeg', 'RightLeg'), 0.11],
      [v('LeftLeg'), 0.09], [v('RightLeg'), 0.09],
    ];
    // push the spheres slightly forward so the cloth rests on the back rather than inside it
    for (const s of list) s[0].addScaledVector(f.fwd, 0.02);
    return list;
  }

  collide(list, f) {
    const p = this.p;
    // The cape may never pass in front of her back: clamp every particle behind the plane
    // through the neck, facing her forward direction.
    const n = f.fwd, o = f.neck;
    for (let i = COLS * 3; i < p.length; i += 3) {
      const d = (p[i] - o.x) * n.x + (p[i + 1] - o.y) * n.y + (p[i + 2] - o.z) * n.z;
      if (d > -0.06) { const k = d + 0.06; p[i] -= n.x * k; p[i + 1] -= n.y * k; p[i + 2] -= n.z * k; }
    }
    for (let i = COLS * 3; i < p.length; i += 3) {
      for (const [c, r] of list) {
        const dx = p[i] - c.x, dy = p[i + 1] - c.y, dz = p[i + 2] - c.z, d = Math.hypot(dx, dy, dz);
        if (d < r && d > 1e-6) { const k = r / d; p[i] = c.x + dx * k; p[i + 1] = c.y + dy * k; p[i + 2] = c.z + dz * k; }
      }
    }
  }

  upload() {
    const attr = this.mesh.geometry.attributes.position;
    attr.array.set(this.p);
    attr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}
