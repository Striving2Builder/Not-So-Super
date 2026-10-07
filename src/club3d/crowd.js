// The main room's crowd (docs/design/nightclub.md "The crowd: walking through it"): hundreds of
// dancers as instanced figures (five draw calls for everyone), shaded as dark backlit silhouettes
// with a coloured rim (the DJ wall, haze and beams sit behind them). They dance to the beat, step
// aside as she pushes through, jump and surge at the drop, and tell the mode how much cover she
// has (inside a cluster the guards can't pick her out) and how thick it is (it slows her down).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorY } from './plan.js';

const TAU = Math.PI * 2;
const SPACING = 0.78;     // closest two dancers stand
const PART_R = 0.72;      // they step this far aside for her
const PART_NPC = 0.9;     // …and for guards, talkers, the cast
const COVER_R = 1.7;      // dancers this close count as cover
const THICK_R = 1.05;     // …and this close slow her down

const cyl = (rt, rb, h, seg, x, y, z, sz = 1) => new THREE.CylinderGeometry(rt, rb, h, seg).scale(1, 1, sz).translate(x, y, z);
function figures() {
  const shoes = (x) => new THREE.BoxGeometry(0.11, 0.07, 0.24).translate(x, 0.035, 0.04);
  const strip = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
  const m = (list) => mergeGeometries(list.map(strip));
  return {
    suit: m([cyl(0.085, 0.07, 0.86, 6, -0.1, 0.46, 0), cyl(0.085, 0.07, 0.86, 6, 0.1, 0.46, 0), shoes(-0.1), shoes(0.1),
      cyl(0.19, 0.18, 0.2, 8, 0, 0.94, 0, 0.75), cyl(0.235, 0.18, 0.58, 8, 0, 1.32, 0, 0.7)]),
    dress: m([cyl(0.06, 0.045, 0.8, 5, -0.08, 0.42, 0), cyl(0.06, 0.045, 0.8, 5, 0.08, 0.42, 0), shoes(-0.08), shoes(0.08),
      cyl(0.16, 0.31, 0.5, 10, 0, 0.76, 0), cyl(0.2, 0.15, 0.52, 8, 0, 1.27, 0, 0.72)]),
    headS: m([cyl(0.05, 0.06, 0.18, 7, 0, 1.62, 0), new THREE.SphereGeometry(0.13, 10, 7).scale(0.95, 1.1, 1).translate(0, 1.8, -0.01)]),
    headL: m([cyl(0.05, 0.06, 0.18, 7, 0, 1.62, 0), new THREE.SphereGeometry(0.14, 10, 7).scale(1, 1.08, 1.06).translate(0, 1.8, -0.015),
      new THREE.BoxGeometry(0.28, 0.46, 0.1).translate(0, 1.63, -0.1)]),
    arm: m([cyl(0.052, 0.042, 0.6, 5, 0, -0.3, 0), new THREE.SphereGeometry(0.052, 5, 4).translate(0, -0.63, 0)]),
  };
}

/** Ink-dark figures with a two-colour rim from behind/above, a glow on the legs from the floor, the strobe. */
function silhouetteMat() {
  const U = {
    rimA: { value: new THREE.Color(0x27e0ff) }, rimB: { value: new THREE.Color(0xff2fd0) }, floorC: { value: new THREE.Color(0x6a3aff) },
    k: { value: 1 }, flash: { value: 0 }, fogC: { value: new THREE.Color(0x140a26) }, fogN: { value: 28 }, fogF: { value: 85 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC; varying float vD;
void main(){
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vV = cameraPosition - wp.xyz; vD = length(vV); vV /= vD;
  vY = position.y;
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(1.0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: `uniform vec3 rimA, rimB, floorC, fogC; uniform float k, flash, fogN, fogF;
varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC; varying float vD;
void main(){
  // the light is behind them (the stage): edges turned toward it rim up, heads and shoulders
  // catch the beams; everything facing the camera stays ink
  vec3 L = normalize(vec3(0.0, 0.55, -1.0));
  float fres = 1.0 - clamp(dot(vN, vV), 0.0, 1.0);
  float rim = smoothstep(0.35, 0.8, fres) * smoothstep(-0.05, 0.55, dot(vN, L));
  float top = smoothstep(0.45, 0.95, vN.y) * smoothstep(1.2, 1.7, vY) * 0.45;
  vec3 rimC = mix(rimA, rimB, smoothstep(-0.5, 0.5, vN.x));
  vec3 c = vec3(0.006, 0.005, 0.012) + vC * 0.012;          // the ink body, a hint of the outfit
  c += rimC * (rim + top) * k;
  c += floorC * smoothstep(0.7, 0.0, vY) * 0.05 * k;        // the LED floor on their shoes
  c = mix(c, vec3(1.0), flash * (0.12 + 0.6 * (rim + top)));
  c = mix(c, fogC, smoothstep(fogN, fogF, vD));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  m.userData.sil = U;
  return m;
}

/** Random dancer spots from the plan's density blobs, clear of colliders, doors and the cast's spots. */
export function placeCrowd(plan, count, colliders, keepOut, rnd = Math.random) {
  const V = plan.V, blobs = V.crowd, out = [], cell = new Map();
  const key = (x, z) => `${Math.floor(x / SPACING)},${Math.floor(z / SPACING)}`;
  const near = (x, z) => {
    const cx = Math.floor(x / SPACING), cz = Math.floor(z / SPACING);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of cell.get(`${cx + i},${cz + j}`) || []) if (Math.hypot(p.x - x, p.z - z) < SPACING) return true;
    return false;
  };
  const tot = blobs.reduce((s, b) => s + b[4] * b[2] * b[3], 0);
  let tries = count * 30;
  while (out.length < count && tries-- > 0) {
    // pick a blob by area × weight, then a point inside it (denser toward its middle)
    let r = rnd() * tot, b = blobs[0];
    for (const q of blobs) { r -= q[4] * q[2] * q[3]; if (r <= 0) { b = q; break; } }
    const a = rnd() * TAU, d = Math.sqrt(rnd()) * (0.55 + 0.45 * rnd());
    const x = b[0] + Math.cos(a) * d * b[2], z = b[1] + Math.sin(a) * d * b[3];
    if (Math.abs(x) > V.hw - 1.2 || Math.abs(z) > V.hd - 1.2 || near(x, z)) continue;
    if (colliders.some((c) => x > c.minX - 0.45 && x < c.maxX + 0.45 && z > c.minZ - 0.45 && z < c.maxZ + 0.45)) continue;
    if (keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
    const p = { x, z };
    out.push(p);
    const k = key(x, z);
    if (!cell.has(k)) cell.set(k, []);
    cell.get(k).push(p);
  }
  return out;
}

export class ClubCrowd {
  /** people: [{ x, z, pose: 'dance'|'stand'|'dj', rot?, type?, fixed? }] */
  constructor(zn, plan, people) {
    this.zn = zn; this.plan = plan;
    this.people = people;
    const G = figures(), mat = (this.mat = silhouetteMat());
    const groups = { suit: [], dress: [], headS: [], headL: [], arm: [] };
    const OUT = [0xff2fd0, 0x27e0ff, 0xf2f2f2, 0xffe14d, 0x9d4dff, 0xff6a3d, 0x3dff9a, 0xe0e0ff];
    for (const p of people) {
      p.type = p.type || (Math.random() < 0.5 ? 'dress' : 'suit');
      p.rot = p.rot ?? Math.random() * TAU;
      p.s = 0.93 + Math.random() * 0.13; p.ph = Math.random() * TAU; p.style = Math.floor(Math.random() * 4);
      p.ox = 0; p.oz = 0; p.hx = p.x; p.hz = p.z;
      p.col = new THREE.Color(OUT[Math.floor(Math.random() * OUT.length)]);
      p.bi = groups[p.type].push(p) - 1;
      p.head = p.type === 'dress' || Math.random() < 0.2 ? 'headL' : 'headS';
      p.hi = groups[p.head].push(p) - 1;
      p.ai = groups.arm.push(p, p) - 2;
    }
    this.meshes = {};
    for (const [k, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(G[k], mat, list.length);
      m.frustumCulled = false; m.name = 'c3-crowd';
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((p, i) => m.setColorAt(i, p.col));
      zn.scene.add(m);
      this.meshes[k] = m;
    }
    for (const g of Object.values(G)) if (!Object.values(this.meshes).some((m) => m.geometry === g)) g.dispose();
    this.root = new THREE.Object3D(); this.body = new THREE.Object3D(); this.aL = new THREE.Object3D(); this.aR = new THREE.Object3D();
    this.root.add(this.body); this.body.add(this.aL, this.aR);
    this.aL.position.set(-0.26, 1.52, 0); this.aR.position.set(0.26, 1.52, 0);
    this.cover = 0; this.thick = 0;
  }

  /** Rim colours (the show's lights), the strobe, and the scene fog the figures fade into. */
  light(a, b, k, flash, fog) {
    const U = this.mat.userData.sil;
    U.rimA.value.copy(a); U.rimB.value.copy(b); U.k.value = k; U.flash.value = flash;
    if (fog) { U.fogC.value.copy(fog.color); U.fogN.value = fog.near; U.fogF.value = fog.far; }
  }

  /**
   * Per frame. obs: positions they step aside for (her first). B: the beat clock. surge: 0..1 at the
   * drop (they jump, arms up, the pack shoves). Returns { cover, thick } around her.
   */
  update(t, dt, B, obs, surge) {
    const { people, meshes, root, body, aL, aR } = this, plan = this.plan;
    const relax = Math.min(1, dt * 0.8), her = obs[0];
    let cover = 0, thick = 0;
    for (const p of people) {
      if (p.left) {
        // leaving (the fire alarm): walk for the door, then gone
        const ex = this.plan.entrance, dx = ex.x - p.hx, dz = ex.z + 3 - p.hz, d = Math.hypot(dx, dz);
        if (d > 1) { p.hx += (dx / d) * 2.6 * dt; p.hz += (dz / d) * 2.6 * dt; } else { p.hx = p.hz = 1e4; }
      }
      if (!p.fixed) {
        let ox = p.ox * (1 - relax), oz = p.oz * (1 - relax);
        for (let i = 0; i < obs.length; i++) {
          const o = obs[i];
          if (!o) continue;
          const R = i === 0 ? PART_R : PART_NPC;
          const dx = p.hx + ox - o.x, dz = p.hz + oz - o.z, d = Math.hypot(dx, dz);
          if (d < R && d > 1e-4) { ox += (dx / d) * (R - d); oz += (dz / d) * (R - d); }
        }
        const L = Math.hypot(ox, oz);
        if (L > 1.6) { ox *= 1.6 / L; oz *= 1.6 / L; }
        p.ox = ox; p.oz = oz;
      }
      const x = p.hx + p.ox, z = p.hz + p.oz;
      p.x = x; p.z = z;
      if (her && p.pose === 'dance') {
        const d = Math.hypot(x - her.x, z - her.z);
        if (d < COVER_R) cover++;
        if (d < THICK_R) thick++;
      }
      let bob = 0, sway = 0, lean = 0, turn = 0, l0 = 0.12, l1 = 0.1, r0 = 0.12, r1 = 0.1;
      const e = B.pulse, sw = Math.sin(B.ang * 0.5 + p.ph);
      if (p.pose === 'dance') {
        bob = e * (0.07 + surge * 0.22); sway = sw * 0.09;
        const st = (p.style + B.bar) % 4;
        if (surge > 0.3) { l0 = r0 = 2.8 + e * 0.3; l1 = 0.3; r1 = 0.3; }
        else if (st === 0) { r0 = 2.5 + e * 0.5; r1 = 0.25; l0 = 0.7 + sw * 0.3; l1 = 0.3; }
        else if (st === 1) { l0 = r0 = 2.75; l1 = 0.35 + sw * 0.25; r1 = 0.35 - sw * 0.25; }
        else if (st === 2) { l0 = 1.0 + Math.sin(B.ang + p.ph) * 0.6; r0 = 1.0 - Math.sin(B.ang + p.ph) * 0.6; l1 = r1 = 0.35; }
        else { turn = Math.sin(t * 0.7 + p.ph) * 0.8; l0 = 0.5; r0 = 0.5; l1 = r1 = 0.6 + e * 0.3; }
      } else if (p.pose === 'stand') {
        sway = Math.sin(t * 0.8 + p.ph) * 0.035; bob = e * 0.015;
        r0 = Math.sin(t * 0.35 + p.ph) > 0.93 ? 2.0 : 1.1; r1 = 0.08; l0 = 0.15;
      } else if (p.pose === 'dj') {
        lean = 0.12 + e * 0.12; l0 = 1.0; r0 = B.bar % 4 === 3 ? 2.8 + e * 0.3 : 1.0 + Math.sin(t * 3) * 0.2;
      } else if (p.pose === 'sit') {
        // the VIP's entourage on the couches: lowered, arms on the backrest
        l0 = 0.6; r0 = 0.6; l1 = r1 = 0.7;
      }
      const y = (p.y ?? floorY(plan, x, z)) - bob + (p.pose === 'sit' ? -0.42 : 0);
      root.position.set(x, y + (surge > 0.3 && p.pose === 'dance' ? Math.max(0, Math.sin(B.ang * 2 + p.ph)) * surge * 0.25 : 0), z);
      root.rotation.y = p.rot + turn;
      root.scale.set(p.s, p.s * (1 - bob * 0.4), p.s);
      body.rotation.set(lean, 0, sway);
      aL.rotation.set(-l0, 0, -l1); aR.rotation.set(-r0, 0, r1);
      root.updateMatrixWorld(true);
      meshes[p.type].setMatrixAt(p.bi, body.matrixWorld);
      meshes[p.head].setMatrixAt(p.hi, body.matrixWorld);
      meshes.arm.setMatrixAt(p.ai, aL.matrixWorld);
      meshes.arm.setMatrixAt(p.ai + 1, aR.matrixWorld);
    }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
    this.cover = cover; this.thick = thick;
    return { cover, thick };
  }

  /** The dancer nearest a point (within r), for speech bubbles and bumps. */
  nearest(x, z, r = 3, pred = null) {
    let best = null, bd = r;
    for (const p of this.people) {
      if (p.pose !== 'dance' && p.pose !== 'stand') continue;
      if (pred && !pred(p)) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** Nudge everyone near a point outward (the drop's shove, a fight breaking out). */
  shove(x, z, r, k) {
    for (const p of this.people) {
      if (p.fixed) continue;
      const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
      if (d < r && d > 1e-3) { p.ox += (dx / d) * k * (1 - d / r); p.oz += (dz / d) * k * (1 - d / r); }
    }
  }

  dispose() {
    for (const m of Object.values(this.meshes)) { m.geometry.dispose(); m.removeFromParent(); }
    this.mat.dispose();
  }
}
