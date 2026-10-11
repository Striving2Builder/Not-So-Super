// The club's crowd (docs/design/nightclub.md "The crowd: walking through it"): hundreds of dancers,
// shaded as dark backlit silhouettes with a coloured rim (the DJ wall, the haze and the beams are
// behind them). Everyone is one entry in `people`. The ones nearest the camera are 3D figures
// (instanced: arms that bend at the elbow, hats and hairdos, each with a groove of their own a little
// off the beat); everyone further off is a sprite cut from the baked dancer sheet (the game's rigged
// models dancing: assets/nightclub/dancers.png), all in one draw call, their loops timed to the
// music. They step aside as she pushes through, jump and cheer at the drop, and tell the mode how
// much cover she has (inside a cluster the guards can't pick her out) and how thick it is (it slows
// her down).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorY, onCatwalk } from './plan.js';

const TAU = Math.PI * 2;
const SPACING = 0.7;      // closest two dancers stand
const PART_R = 0.72;      // they step this far aside for her
const PART_NPC = 0.9;     // …and for guards, talkers, the cast
const COVER_R = 1.7;      // dancers this close count as cover
const THICK_R = 1.05;     // …and this close slow her down
const REPICK = 0.2;       // seconds between re-picking who's drawn in 3D
const CELL_H = 2.2;       // metres a sheet cell stands for (a standing dancer fills ~85% of it)
const SHEET = { json: 'assets/nightclub/dancers.json', png: 'assets/nightclub/dancers.png' };
// the sheet's rows (dancers.json) by body and pose; poses with no row (sit, dj) are always 3D
const ROWS = { dress: { dance: [0, 1, 4], stand: [2, 3] }, suit: { dance: [5, 6], stand: [7] } };
const SOLID = new Set(['sit', 'dj']);

const cyl = (rt, rb, h, seg, x, y, z, sz = 1) => new THREE.CylinderGeometry(rt, rb, h, seg).scale(1, 1, sz).translate(x, y, z);
const strip = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
/** Merge parts; aY = each vertex's height on a standing figure (limbs: chest height). */
function part(list, limb = false) {
  const g = mergeGeometries(list.map(strip)), P = g.attributes.position, y = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) y[i] = limb ? 1.3 : P.getY(i);
  g.setAttribute('aY', new THREE.BufferAttribute(y, 1));
  return g;
}
function figures() {
  const shoes = (x) => new THREE.BoxGeometry(0.11, 0.07, 0.24).translate(x, 0.035, 0.04);
  const neckHead = (r, sy) => [cyl(0.05, 0.06, 0.18, 7, 0, 1.62, 0), new THREE.SphereGeometry(r, 12, 8).scale(0.95, sy, 1).translate(0, 1.8, -0.01)];
  return {
    suit: part([cyl(0.085, 0.07, 0.86, 7, -0.1, 0.46, 0), cyl(0.085, 0.07, 0.86, 7, 0.1, 0.46, 0), shoes(-0.1), shoes(0.1),
      cyl(0.19, 0.18, 0.2, 9, 0, 0.94, 0, 0.75), cyl(0.24, 0.18, 0.58, 9, 0, 1.32, 0, 0.7),
      new THREE.SphereGeometry(0.075, 8, 6).translate(-0.24, 1.53, 0), new THREE.SphereGeometry(0.075, 8, 6).translate(0.24, 1.53, 0)]),
    dress: part([cyl(0.06, 0.045, 0.8, 6, -0.08, 0.42, 0), cyl(0.06, 0.045, 0.8, 6, 0.08, 0.42, 0), shoes(-0.08), shoes(0.08),
      cyl(0.16, 0.31, 0.5, 11, 0, 0.76, 0), cyl(0.2, 0.15, 0.52, 9, 0, 1.27, 0, 0.72),
      new THREE.SphereGeometry(0.06, 8, 6).translate(-0.2, 1.49, 0), new THREE.SphereGeometry(0.06, 8, 6).translate(0.2, 1.49, 0)]),
    // heads: short hair, long hair, a hat (the sheet's men wear one), a bun
    headS: part(neckHead(0.13, 1.1)),
    headL: part([...neckHead(0.14, 1.08), new THREE.BoxGeometry(0.28, 0.48, 0.1).translate(0, 1.62, -0.1), new THREE.SphereGeometry(0.15, 10, 6, 0, TAU, 0, Math.PI * 0.55).translate(0, 1.82, -0.02)]),
    headH: part([...neckHead(0.13, 1.1), cyl(0.12, 0.13, 0.13, 10, 0, 1.94, -0.01), cyl(0.22, 0.22, 0.02, 14, 0, 1.88, -0.01)]),
    headB: part([...neckHead(0.135, 1.08), new THREE.SphereGeometry(0.075, 8, 6).translate(0, 1.95, -0.08)]),
    upper: part([cyl(0.055, 0.048, 0.32, 6, 0, -0.16, 0)], true),
    fore: part([cyl(0.046, 0.04, 0.29, 6, 0, -0.145, 0), new THREE.SphereGeometry(0.05, 6, 4).translate(0, -0.31, 0)], true),
  };
}

/** Ink figures with a two-colour rim from behind and above, floor light on the shoes, the strobe. */
function silhouetteMat() {
  const U = {
    rimA: { value: new THREE.Color(0x27e0ff) }, rimB: { value: new THREE.Color(0xff2fd0) }, floorC: { value: new THREE.Color(0x6a3aff) },
    k: { value: 1 }, flash: { value: 0 }, fogC: { value: new THREE.Color(0x140a26) }, fogN: { value: 28 }, fogF: { value: 85 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute float aY; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vC; varying float vD;
void main(){
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
  im = instanceMatrix;
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vV = cameraPosition - wp.xyz; vD = length(vV); vV /= vD;
  vY = aY;
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
  float rim = smoothstep(0.42, 0.85, fres) * smoothstep(0.0, 0.6, dot(vN, L));
  float top = smoothstep(0.6, 0.98, vN.y) * smoothstep(1.3, 1.75, vY) * smoothstep(0.25, 0.6, fres) * 0.22;
  // each figure mostly catches one of the two lights (their left / right edges lean to each)
  float pick = fract(dot(vC, vec3(12.9898, 78.233, 37.719))) - 0.5;
  vec3 rimC = mix(rimA, rimB, smoothstep(-0.15, 0.15, vN.x * 0.5 + pick * 0.6));
  vec3 c = vec3(0.003, 0.0025, 0.006) + vC * 0.006;         // the ink body, a hint of the outfit
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

/**
 * The far crowd: camera-facing quads cut from the dancer sheet (16 frames × 8 rows), solid ink
 * with the stage light round their top edges. At the drop the dancing rows switch to cheering.
 */
function spriteMat(map, U) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { map: { value: map }, beatB: { value: 0 }, surge: { value: 0 }, rimA: U.rimA, rimB: U.rimB, floorC: U.floorC, k: U.k, flash: U.flash, fogC: U.fogC, fogN: U.fogN, fogF: U.fogF },
    vertexShader: `attribute vec3 iPos; attribute vec4 iPar; uniform float beatB, surge;
varying vec2 vUv; varying float vD; varying float vSide; varying float vLy; varying float vPick;
void main(){
  // iPar: sheet row, loop length (beats), phase, height (m; negative = mirrored, 0 = drawn in 3D)
  float row = iPar.x;
  if (surge > 0.3) row = row < 1.5 ? 4.0 : abs(row - 5.0) < 0.5 ? 6.0 : row;
  float foot = abs(row - 1.0) < 0.5 ? 23.0 / 180.0 : 5.0 / 180.0;   // (the ponytail row stands higher in its cells)
  vec3 toCam = cameraPosition - iPos; toCam.y = 0.0;
  float len = length(toCam);
  vec3 f = len > 1e-3 ? toCam / len : vec3(0.0, 0.0, 1.0), right = vec3(f.z, 0.0, -f.x);
  float h = abs(iPar.w), w = h * (112.0 / 180.0);
  vec3 p = iPos + right * (position.x * w) + vec3(0.0, (position.y - foot) * h, 0.0);
  float frame = floor(fract(beatB / iPar.y + iPar.z) * 16.0);
  float u = mix(0.03, 0.97, iPar.w < 0.0 ? 1.0 - uv.x : uv.x);   // (inset: no bleed from the next frame)
  vUv = vec2((frame + u) / 16.0, 1.0 - (row + 1.0 - uv.y) / 8.0);
  vSide = position.x; vLy = (position.y - foot) * h; vPick = iPar.z - 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vD = -mv.z;
  gl_Position = h > 0.0 ? projectionMatrix * mv : vec4(0.0, 0.0, 2.0, 1.0);
}`,
    fragmentShader: `uniform sampler2D map; uniform vec3 rimA, rimB, floorC, fogC; uniform float k, flash, fogN, fogF;
varying vec2 vUv; varying float vD; varying float vSide; varying float vLy; varying float vPick;
void main(){
  if (texture2D(map, vUv).a < 0.5) discard;
  // backlit edges: where the sheet is empty just above (or beside) this pixel, the stage light
  // shows round them (a screen pixel or so out, so the far ones keep their rim)
  vec2 px = max(fwidth(vUv), vec2(1.0 / 1792.0, 1.0 / 1440.0));
  float up = texture2D(map, vUv + vec2(0.0, px.y * 1.5)).a;
  float sd = texture2D(map, vUv - vec2(px.x, 0.0)).a + texture2D(map, vUv + vec2(px.x, 0.0)).a;
  float edge = clamp((1.0 - up) * 1.1 + (2.0 - sd) * 0.3, 0.0, 1.0) * mix(1.0, 0.35, smoothstep(8.0, 25.0, vD));
  vec3 c = vec3(0.003, 0.0025, 0.006) + mix(rimA, rimB, smoothstep(-0.15, 0.15, vSide * 0.5 + vPick * 0.6)) * edge * k;
  c += floorC * smoothstep(0.25, 0.0, vLy) * 0.05 * k;
  c = mix(c, vec3(1.0), flash * (0.12 + 0.6 * edge));
  c = mix(c, fogC, smoothstep(fogN, fogF, vD));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
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
    if (onCatwalk(V, x, z, 0.5)) continue;
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
  /**
   * people: [{ x, z, pose: 'dance'|'stand'|'dj'|'sit', rot?, type?, fixed?, y? }]
   * near: how many (nearest the camera) are drawn as 3D figures; everyone else is a sprite.
   */
  constructor(zn, plan, people, { near = 140 } = {}) {
    this.zn = zn; this.plan = plan; this.people = people;
    const OUT = [0xff2fd0, 0x27e0ff, 0xf2f2f2, 0xffe14d, 0x9d4dff, 0xff6a3d, 0x3dff9a, 0xe0e0ff];
    const GROOVES = ['bounce', 'bounce', 'sway', 'jump', 'step'];
    const V = plan.V, pick = (a) => a[Math.floor(Math.random() * a.length)];
    for (const p of people) {
      p.type = p.type || (Math.random() < 0.55 ? 'dress' : 'suit');
      // most of the floor faces the booth; the rest dance with each other
      const inHall = Math.abs(p.x) < V.hw && Math.abs(p.z) < V.hd;
      p.rot = p.rot ?? (inHall && Math.random() < 0.7 ? Math.atan2(V.booth.x - p.x, V.booth.z - p.z) + (Math.random() - 0.5) * 1.4 : Math.random() * TAU);
      p.s = 0.93 + Math.random() * 0.13; p.ph = Math.random() * TAU; p.style = Math.floor(Math.random() * 4);
      p.off = Math.random() * 0.3; p.groove = pick(GROOVES);
      p.ox = 0; p.oz = 0; p.hx = p.x; p.hz = p.z;
      p.col = new THREE.Color(pick(OUT));
      p.head = p.type === 'dress' ? (Math.random() < 0.7 ? 'headL' : 'headB') : (Math.random() < 0.35 ? 'headH' : 'headS');
      p.solid = SOLID.has(p.pose);
      p.row = pick(ROWS[p.type][p.pose === 'stand' ? 'stand' : 'dance']);
      p.flip = Math.random() < 0.5; p.slow = Math.random() < 0.25;
      p.lod = 0;
    }
    const solids = people.filter((p) => p.solid).length;
    this.near = Math.min(people.length, near + solids);
    const G = (this.G = figures()), mat = (this.mat = silhouetteMat());
    this.meshes = {};
    for (const k of Object.keys(G)) {
      const n = k === 'upper' || k === 'fore' ? this.near * 2 : this.near;
      const m = new THREE.InstancedMesh(G[k], mat, n);
      m.frustumCulled = false; m.name = 'c3-crowd'; m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      zn.scene.add(m);
      this.meshes[k] = m;
    }
    // a little rig to pose each 3D figure: root → body (lean, sway) → shoulders → elbows
    this.root = new THREE.Object3D(); this.body = new THREE.Object3D(); this.root.add(this.body);
    this.sh = [0, 1].map(() => new THREE.Object3D()); this.el = [0, 1].map(() => new THREE.Object3D());
    this.sh.forEach((s, i) => { this.body.add(s); s.add(this.el[i]); this.el[i].position.set(0, -0.32, 0); });
    this.picked = []; this.repickT = 0; this.cover = 0; this.thick = 0;
    this.buildSprites();
  }

  /** Everyone as a sprite (hidden while that person is drawn in 3D): one instanced quad each. */
  buildSprites() {
    const P = this.people, n = P.length, g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.iPar = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iPar', this.iPar);
    g.instanceCount = n;
    const tex = (this.tex = new THREE.TextureLoader().load(SHEET.png));
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.spriteMat = spriteMat(tex, this.mat.userData.sil);
    this.sprites = new THREE.Mesh(g, this.spriteMat);
    this.sprites.frustumCulled = false; this.sprites.name = 'c3-crowd';
    this.zn.scene.add(this.sprites);
    // each row's loop in beats (sheet seconds rounded to the tempo: they dance on the beat)
    this.durs = [1.467, 1.467, 2.467, 2.467, 1.4, 1.467, 1.4, 2.467];
    fetch(SHEET.json).then((r) => r.json()).then((m) => { this.durs = m.types.map((t) => t.dur); this.bpm = 0; }).catch(() => { /* the defaults are the sheet's */ });
    P.forEach((p, i) => this.iPar.setXYZW(i, p.row, 4, Math.random(), p.solid ? 0 : (p.flip ? -1 : 1) * CELL_H * p.s));
    this.bpm = 0;
  }

  /** Fit each row's loop to whole beats at this tempo (a quarter of them on half time). */
  retime(bpm) {
    this.bpm = bpm;
    const beatLen = 60 / bpm;
    this.people.forEach((p, i) => this.iPar.setY(i, Math.max(2, Math.round(this.durs[p.row] / beatLen)) * (p.slow ? 2 : 1)));
    this.iPar.needsUpdate = true;
  }

  /** Rim colours (the show's lights), the strobe, and the scene fog everyone fades into. */
  light(a, b, k, flash, fog) {
    const U = this.mat.userData.sil;
    U.rimA.value.copy(a); U.rimB.value.copy(b); U.k.value = k; U.flash.value = flash;
    if (fog) { U.fogC.value.copy(fog.color); U.fogN.value = fog.near; U.fogF.value = fog.far; }
  }

  /** Who's drawn in 3D: the sitters and DJs, then the ones nearest the camera (in front of it). */
  pickNear() {
    const cam = this.zn.cam.position, P = this.people, n = P.length;
    const d = this._d || (this._d = new Float32Array(n)), idx = this._idx || (this._idx = Array.from({ length: n }, (_, i) => i));
    for (let i = 0; i < n; i++) {
      const p = P[i];
      if (p.solid) { d[i] = -1; continue; }
      const dx = p.x - cam.x, dz = p.z - cam.z;
      let v = dx * dx + dz * dz;
      if (dz > 1) v += 1e4;          // behind the camera (it always looks north)
      if (p.lod) v *= 0.8;           // (a little stickiness: nobody flickers at the boundary)
      d[i] = v;
    }
    idx.sort((a, b) => d[a] - d[b]);
    for (const i of this.picked) P[i].lod = 0;
    this.picked = idx.slice(0, this.near);
    for (const i of this.picked) P[i].lod = 1;
    for (let i = 0; i < n; i++) if (!P[i].solid) this.iPar.setW(i, P[i].lod ? 0 : (P[i].flip ? -1 : 1) * CELL_H * P[i].s);
    this.iPar.needsUpdate = true;
    // their slots' colours
    const M = this.meshes, c = {};
    for (const k of Object.keys(M)) c[k] = 0;
    for (const i of this.picked) {
      const p = P[i];
      for (const k of [p.type, p.head, 'upper', 'upper', 'fore', 'fore']) M[k].setColorAt(c[k]++, p.col);
    }
    for (const m of Object.values(M)) m.instanceColor.needsUpdate = true;
  }

  /**
   * Per frame. obs: positions they step aside for (her first). B: the beat clock. surge: 0..1 at the
   * drop (they jump, arms up, the pack shoves). bpm: the track's tempo. Returns { cover, thick } round her.
   */
  update(t, dt, B, obs, surge, bpm) {
    const { people, meshes, root, body, sh, el, plan } = this;
    if (bpm && bpm !== this.bpm) this.retime(bpm);
    this.spriteMat.uniforms.beatB.value = B.b; this.spriteMat.uniforms.surge.value = surge;
    this.repickT -= dt;
    if (this.repickT <= 0) { this.repickT = REPICK; this.pickNear(); }
    const relax = Math.min(1, dt * 0.8), her = obs[0], pos = this.iPos.array;
    let cover = 0, thick = 0;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.left) {
        // leaving (the fire alarm): walk for the door, then gone
        const ex = plan.entrance, dx = ex.x - p.hx, dz = ex.z + 3 - p.hz, d = Math.hypot(dx, dz);
        if (d > 1) { p.hx += (dx / d) * 2.6 * dt; p.hz += (dz / d) * 2.6 * dt; } else { p.hx = p.hz = 1e4; }
      }
      if (!p.fixed) {
        let ox = p.ox * (1 - relax), oz = p.oz * (1 - relax);
        for (let j = 0; j < obs.length; j++) {
          const o = obs[j];
          if (!o) continue;
          const R = j === 0 ? PART_R : PART_NPC, dx = p.hx + ox - o.x, dz = p.hz + oz - o.z;
          if (dx > R || dx < -R || dz > R || dz < -R) continue;
          const d = Math.hypot(dx, dz);
          if (d < R && d > 1e-4) { ox += (dx / d) * (R - d); oz += (dz / d) * (R - d); }
        }
        const L = Math.hypot(ox, oz);
        if (L > 1.6) { ox *= 1.6 / L; oz *= 1.6 / L; }
        p.ox = ox; p.oz = oz;
      }
      p.x = p.hx + p.ox; p.z = p.hz + p.oz;
      p.fy = (p.y ?? floorY(plan, p.x, p.z)) + (surge > 0.3 && p.pose === 'dance' ? Math.max(0, Math.sin(B.ang * 2 + p.ph)) * surge * 0.25 : 0);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.fy; pos[i * 3 + 2] = p.z;
      if (her && p.pose === 'dance') {
        const d = Math.hypot(p.x - her.x, p.z - her.z);
        if (d < COVER_R) cover++;
        if (d < THICK_R) thick++;
      }
    }
    this.iPos.needsUpdate = true;
    // the 3D figures, each on its own beat (a touch late or early), each bar a new move
    const n = {};
    for (const k of Object.keys(meshes)) n[k] = 0;
    for (const i of this.picked) {
      const p = people[i], lb = B.b + p.off, lph = lb - Math.floor(lb), e = Math.exp(-lph * 5);
      const s1 = Math.sin(lb * Math.PI + p.ph), half = Math.sin(lb * Math.PI * 0.5 + p.ph);
      let bob = 0, sway = 0, lean = 0, turn = 0, l0 = 0.12, l1 = 0.1, r0 = 0.12, r1 = 0.1, le = 0.25, re = 0.25;
      if (p.pose === 'dance') {
        const g = p.groove;
        bob = g === 'jump' ? (Math.floor(lb) % 4 === 0 ? e * 0.16 : e * 0.03) : g === 'sway' ? e * 0.025 : e * 0.07;
        bob += surge * e * 0.22;
        sway = g === 'sway' ? half * 0.14 : s1 * 0.07;
        turn = g === 'step' ? half * 0.45 : 0;
        const st = (p.style + Math.floor(lb / 4)) % 4;
        if (surge > 0.3) { l0 = r0 = 2.9 + e * 0.2; l1 = r1 = 0.25; le = re = 0.1; }
        else if (st === 0) { r0 = 2.3 + e * 0.5; r1 = 0.2; re = 0.3 - e * 0.2; l0 = 0.6 + s1 * 0.25; l1 = 0.25; le = 1.2; }   // fist pump
        else if (st === 1) { l0 = r0 = 2.6; l1 = 0.35 + half * 0.2; r1 = 0.35 - half * 0.2; le = re = 0.35 + e * 0.3; }  // hands up
        else if (st === 2) { l0 = 0.9 + s1 * 0.5; r0 = 0.9 - s1 * 0.5; l1 = r1 = 0.3; le = re = 1.4 + e * 0.3; }      // pumping arms
        else { l0 = r0 = 0.5 + e * 0.15; l1 = r1 = 0.6 + e * 0.3; le = re = 1.7; }                                     // elbows out
      } else if (p.pose === 'stand') {
        // at the bar: weight shifting, a sip now and then
        sway = Math.sin(t * 0.8 + p.ph) * 0.035; bob = e * 0.012;
        const sip = Math.sin(t * 0.35 + p.ph) > 0.9;
        r0 = sip ? 1.5 : 0.7; re = sip ? 2.1 : 1.3; r1 = 0.1; l0 = 0.1; le = 0.15;
      } else if (p.pose === 'dj') {
        lean = 0.12 + e * 0.12; l0 = 1.0; le = 0.9;
        const up = Math.floor(B.bar) % 4 === 3;
        r0 = up ? 2.8 + e * 0.3 : 1.0 + Math.sin(t * 3) * 0.2; re = up ? 0.2 : 0.9;
      } else if (p.pose === 'sit') {
        // the VIP's entourage: sunk into the couch, leaning back, hands on their knees, nodding along
        lean = -0.16 + e * 0.03; l0 = r0 = 0.4; l1 = r1 = 0.18; le = re = 1.0; sway = Math.sin(t * 0.6 + p.ph) * 0.02;
      }
      const sw = p.type === 'suit' ? 0.25 : 0.21, sy = p.type === 'suit' ? 1.52 : 1.48;
      root.position.set(p.x, p.fy - bob + (p.pose === 'sit' ? -0.42 : 0), p.z);
      root.rotation.y = p.rot + turn;
      root.scale.set(p.s, p.s * (1 - bob * 0.4), p.s);
      body.rotation.set(lean, 0, sway);
      sh[0].position.set(-sw, sy, 0); sh[1].position.set(sw, sy, 0);
      sh[0].rotation.set(-l0, 0, -l1); sh[1].rotation.set(-r0, 0, r1);
      el[0].rotation.set(-le, 0, 0); el[1].rotation.set(-re, 0, 0);
      root.updateMatrixWorld(true);
      meshes[p.type].setMatrixAt(n[p.type]++, body.matrixWorld);
      meshes[p.head].setMatrixAt(n[p.head]++, body.matrixWorld);
      meshes.upper.setMatrixAt(n.upper++, sh[0].matrixWorld); meshes.upper.setMatrixAt(n.upper++, sh[1].matrixWorld);
      meshes.fore.setMatrixAt(n.fore++, el[0].matrixWorld); meshes.fore.setMatrixAt(n.fore++, el[1].matrixWorld);
    }
    for (const [k, m] of Object.entries(meshes)) { m.count = n[k]; m.instanceMatrix.needsUpdate = true; }
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
    for (const m of [...Object.values(this.meshes), this.sprites]) m.removeFromParent();
    for (const g of Object.values(this.G)) g.dispose();
    this.sprites.geometry.dispose(); this.spriteMat.dispose(); this.tex.dispose(); this.mat.dispose();
  }
}
