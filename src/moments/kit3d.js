// The flight moments' 3D kit: everything the in-flight moments (and the old air events, drawn in
// 3D at last) put into the three.js flight scene. Built once, lazily, the first time a moment needs
// it, then pooled for the session: nothing is allocated per moment (iPad GPU memory is a hard
// budget), and what isn't in use is invisible (no draw calls). Per kind: actors = one merged cel
// mesh + one ink hull (2 draws); drones, cards and hoops = one InstancedMesh each (+ its hull);
// glows (camera flashes, sparks, jet flames) and puffs (smoke, dust) = one Points draw each.
// Coordinates in: world units (x, y on the ground, z up); the scene is metres (x·M, z·M, y·M).
import * as THREE from 'three';
import { M } from '../city3d.js';
import { comic, gradMap, LOOK } from '../look3d.js';
import { figurePoses, LOOKS, carGeo, heliGeo, rotorGeo, droneGeo, catGeo, strollerGeo, wigGeo, rigGeo, stackGeo, polaroidCanvas, qmarkCanvas } from './actors3d.js';

/** Sizes (× the metre-scale geometry) and pool limits. Figures stand ~1.5× life size, like her. */
export const KIT = {
  scale: { person: 1.55, car: 1.35, van: 1.35, heli: 1.0, drone: 2.4, cat: 3.2, stroller: 2.2, wig: 1.6, rig: 1.4, stack: 2.4 },
  card: 2.6,       // Polaroid card size (× its 0.88 × 1.05 m face)
  max: { drones: 10, cards: 8, hoops: 8, glows: 72, puffs: 64, rings: 5, beams: 6 },
  ink: 2.0,        // ink hull width, CSS px at arm's length (thins with distance)
};

const INK = new THREE.Color(0x140c16);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/** World units → a scene position. */
export const toScene = (out, x, y, z) => out.set(x * M, z * M, y * M);

/** Screen-constant ink hull (works on plain and instanced meshes); fades into the scene's fog. */
function inkMaterial(fog) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { olW: { value: KIT.ink }, res: LOOK.res, dpr: LOOK.dpr, fogC: { value: new THREE.Color() }, fogR: { value: new THREE.Vector2(1e5, 2e5) }, ink: { value: INK } },
    vertexShader: `uniform float olW, dpr; uniform vec2 res; varying float vD;
void main() {
  mat4 im = mat4(1.0);
#ifdef USE_INSTANCING
  im = instanceMatrix;
#endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * mat3(im) * normal);
  vec4 cp = projectionMatrix * viewMatrix * wp;
  vec4 cn = projectionMatrix * viewMatrix * vec4(wn, 0.0);
  vec2 d = cn.xy * res; float L = length(d);
  if (L > 1e-5) cp.xy += (d / L) * olW * dpr * clamp(16.0 / cp.w, 0.4, 1.0) * 2.0 / res * cp.w;
  vD = cp.w;
  gl_Position = cp;
}`,
    fragmentShader: `uniform vec3 fogC, ink; uniform vec2 fogR; varying float vD;
void main() { gl_FragColor = vec4(mix(ink, fogC, ${fog ? 'smoothstep(fogR.x, fogR.y, vD) * 0.85' : '0.0'}), 1.0); }`,
  });
}

/** The actors' cel surface: vertex colours, three light bands, a warm rim and some self-light (never black at night). */
function celMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap(3) });
  comic(m, { halftone: 0.3, rim: 0xfff0d0, rimK: 0.7 });
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.28;');
  };
  m.customProgramCacheKey = () => `moment|${key.call(m)}`;
  return m;
}

// Soft glows / star flashes (additive) and comic smoke puffs (normal blend): one Points draw each.
const PTS_VS = `attribute float psize, palpha, pshape; attribute vec3 pcol; uniform float px; varying vec3 vC; varying float vA, vS;
void main() { vC = pcol; vA = palpha; vS = pshape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(420.0, psize * px / max(0.5, -mv.z)); }`;
const GLOW_FS = `varying vec3 vC; varying float vA, vS;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 2.0);
  if (vS > 0.5) { // a four-point star (camera flash, sparkle)
    float rays = max(1.0 - smoothstep(0.0, 0.07, abs(d.x)), 1.0 - smoothstep(0.0, 0.07, abs(d.y))) * (1.0 - r);
    a = max(a * 0.8, rays) ;
  }
  a *= vA; if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.55, 1.0, a)) * a, a);
}`;
const PUFF_FS = `varying vec3 vC; varying float vA, vS;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float rim = smoothstep(0.78, 0.88, r); // an ink edge round each ball of smoke
  vec3 c = mix(vC * (0.9 + 0.25 * (0.5 - d.y)), vec3(0.08, 0.06, 0.09), rim * 0.9);
  gl_FragColor = vec4(c, vA * (1.0 - smoothstep(0.92, 1.0, r)));
}`;

class PointPool {
  constructor(scene, n, additive) {
    this.n = n; this.list = [];
    const g = new THREE.BufferGeometry();
    for (const [k, w] of [['position', 3], ['pcol', 3], ['psize', 1], ['palpha', 1], ['pshape', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * w), w).setUsage(THREE.DynamicDrawUsage));
    this.u = { px: { value: 400 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: PTS_VS, fragmentShader: additive ? GLOW_FS : PUFF_FS, transparent: true, depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false,
    }));
    if (additive) Object.assign(this.mesh.material, { blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 8 : 5; this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** p: { x, y, z (world), vx, vy, vz (world/s), size (m), grow (m/s), life (s), col, alpha, shape, drag, rise } */
  add(p) {
    if (this.list.length >= this.n) this.list.shift();
    this.list.push({ vx: 0, vy: 0, vz: 0, grow: 0, alpha: 1, shape: 0, drag: 0, t: 0, ...p, c: new THREE.Color(p.col || '#ffffff') });
  }

  update(dt, px) {
    this.u.px.value = px;
    const L = this.list = this.list.filter((p) => (p.t += dt) < p.life);
    const g = this.mesh.geometry, P = g.attributes.position, C = g.attributes.pcol, S = g.attributes.psize, A = g.attributes.palpha, H = g.attributes.pshape;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], k = p.t / p.life;
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      P.setXYZ(i, p.x * M, p.z * M, p.y * M);
      C.setXYZ(i, p.c.r, p.c.g, p.c.b);
      S.setX(i, p.size + p.grow * p.t);
      A.setX(i, p.alpha * (p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1) * (1 - k * k));
      H.setX(i, p.shape);
    }
    g.setDrawRange(0, L.length);
    for (const a of [P, C, S, A, H]) a.needsUpdate = true;
    this.mesh.visible = L.length > 0;
  }

  clear() { this.list = []; this.mesh.visible = false; }
}

// Ground rings: a solid inked band and pulses running out (the "it's here" decal on a roof or street).
const RING_FS = `uniform vec3 col; uniform float t, alpha, rate; varying vec2 vP;
void main() {
  float r = length(vP);
  float band = smoothstep(0.8, 0.84, r) * (1.0 - smoothstep(0.96, 1.0, r));
  float ink = smoothstep(0.76, 0.8, r) * (1.0 - smoothstep(0.84, 0.86, r)) + smoothstep(0.96, 0.98, r) * (1.0 - smoothstep(0.995, 1.0, r));
  float ph = fract(t * rate), pr = ph * 0.8;
  float pulse = (smoothstep(pr - 0.06, pr, r) - smoothstep(pr, pr + 0.02, r)) * (1.0 - ph);
  float fill = (1.0 - smoothstep(0.0, 0.8, r)) * 0.12;
  float a = max(max(band, pulse * 0.9), fill) * alpha;
  vec3 c = mix(col, vec3(0.06, 0.04, 0.08), clamp(ink, 0.0, 1.0));
  a = max(a, ink * alpha * 0.9);
  if (a < 0.01) discard;
  gl_FragColor = vec4(c, a);
}`;

// Moment beams: the incident beacon look (flight3d's BEAM shader), one quad per live moment.
const BEAM_VS = `attribute vec3 base; attribute vec3 bcol; attribute float bw; attribute float bh; varying vec2 vQ; varying vec3 vCol;
void main() {
  vec3 to = cameraPosition - base; to.y = 0.0;
  vec3 right = normalize(vec3(to.z, 0.0, -to.x) + 1e-5);
  vQ = vec2(position.x * 2.0, position.y); vCol = bcol;
  vec3 p = base + right * position.x * bw + vec3(0.0, position.y * bh, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const BEAM_FS = `uniform float time; varying vec2 vQ; varying vec3 vCol;
void main() {
  float x = vQ.x, core = exp(-x * x * 40.0), glow = exp(-x * x * 6.0) * 0.6;
  float up = pow(1.0 - vQ.y, 1.4) * smoothstep(0.0, 0.02, vQ.y);
  float pulse = 0.85 + 0.15 * sin(time * 4.0 - vQ.y * 14.0);
  float a = clamp((core + glow) * up * pulse * 0.95, 0.0, 1.0);
  gl_FragColor = vec4(mix(vCol, vec3(1.0), core / (core + glow + 1e-4) * 0.7), a);
}`;

/** One pooled actor: a cel mesh + its ink hull in a group; a figure swaps baked pose geometries. */
class Actor {
  constructor(kit, geo, scale, poses = null) {
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(geo, kit.cel);
    this.hull = new THREE.Mesh(geo, kit.ink);
    this.group.add(this.body, this.hull);
    this.group.scale.setScalar(scale);
    this.base = scale;
    this.poses = poses;
    this.group.visible = false;
    for (const m of [this.body, this.hull]) m.frustumCulled = false;
    kit.scene.add(this.group);
  }

  pose(name) {
    const g = this.poses?.[name];
    if (g && this.body.geometry !== g) { this.body.geometry = g; this.hull.geometry = g; }
    return this;
  }

  /** Place at world (x, y, z) facing heading `ang` (world radians, 0 = +x), pitch/roll in radians. */
  at(x, y, z, ang = 0, pitch = 0, roll = 0) {
    toScene(this.group.position, x, y, z);
    this.group.rotation.set(pitch, Math.PI / 2 - ang, roll, 'YXZ');
    this.group.visible = true;
    return this;
  }

  hide() { this.group.visible = false; this.busy = false; }
}

/** An InstancedMesh pool (+ optional ink hull) set per frame: begin(), put(...) per instance, end(). */
class Instances {
  constructor(kit, geo, mat, max, inked) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false;
    kit.scene.add(this.mesh);
    if (inked) {
      this.hull = new THREE.InstancedMesh(geo, kit.ink, max);
      this.hull.instanceMatrix = this.mesh.instanceMatrix; // (shared: one upload)
      this.hull.frustumCulled = false; this.hull.count = 0; this.hull.visible = false;
      kit.scene.add(this.hull);
    }
    this.max = max; this.n = 0;
  }

  begin() { this.n = 0; }

  /** World position, heading, pitch, roll, uniform scale (or a Vector3), optional colour. */
  put(x, y, z, ang, pitch, roll, scale, col) {
    if (this.n >= this.max) return;
    toScene(_v, x, y, z);
    _q.setFromEuler(_e.set(pitch, Math.PI / 2 - ang, roll, 'YXZ'));
    if (scale.isVector3) _s.copy(scale); else _s.setScalar(scale);
    this.mesh.setMatrixAt(this.n, _m.compose(_v, _q, _s));
    if (col !== undefined) this.mesh.setColorAt(this.n, _c.set(col));
    this.n++;
  }

  end() {
    const m = this.mesh;
    m.count = this.n; m.visible = this.n > 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    if (this.hull) { this.hull.count = this.n; this.hull.visible = this.n > 0; }
  }
}

export class Kit3D {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.cel = celMaterial();
    this.ink = inkMaterial(true);
    this.pools = {};      // role → [Actor]
    this.figures = {};    // look → pose geometries
    this.geos = {};
    this.t = 0;
    // instanced: drones, Polaroid cards, hoops
    this.drones = new Instances(this, droneGeo(), this.cel, KIT.max.drones, true);
    const cardTex = new THREE.CanvasTexture(polaroidCanvas()); cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.anisotropy = 4;
    const cardGeo = new THREE.PlaneGeometry(0.88, 1.05);
    this.cards = new Instances(this, cardGeo, new THREE.MeshBasicMaterial({ map: cardTex, side: THREE.DoubleSide, toneMapped: false }), KIT.max.cards, false);
    const hoopGeo = new THREE.TorusGeometry(1, 0.075, 10, 56);
    this.hoops = new Instances(this, hoopGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), KIT.max.hoops, true);
    this.hoops.mesh.setColorAt(0, _c.set('#6ff7ff')); // (creates instanceColor)
    // points
    this.glows = new PointPool(scene, KIT.max.glows, true);
    this.puffs = new PointPool(scene, KIT.max.puffs, false);
    // ground rings
    this.rings = [];
    const rg = new THREE.CircleGeometry(1, 48); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < KIT.max.rings; i++) {
      const u = { col: { value: new THREE.Color() }, t: { value: 0 }, alpha: { value: 1 }, rate: { value: 0.9 } };
      const m = new THREE.Mesh(rg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: RING_FS }));
      m.frustumCulled = false; m.renderOrder = 3; m.visible = false; m.u = u;
      scene.add(m); this.rings.push(m);
    }
    this.ringN = 0;
    // beams
    const N = KIT.max.beams, bg = new THREE.BufferGeometry(), pos = [], idx = [];
    for (let i = 0; i < N; i++) { const o = i * 4; pos.push(-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    for (const [k, n] of [['base', 3], ['bcol', 3], ['bw', 1], ['bh', 1]]) bg.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * 4 * n), n).setUsage(THREE.DynamicDrawUsage));
    bg.setIndex(idx);
    this.beamU = { time: { value: 0 } };
    this.beams = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: this.beamU, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    this.beams.frustumCulled = false; this.beams.renderOrder = 6; this.beams.visible = false;
    scene.add(this.beams);
    this.beamN = 0;
    // the riddle's "?" (a camera-facing sprite) and the news chopper's spotlight cone
    const qt = new THREE.CanvasTexture(qmarkCanvas()); qt.colorSpace = THREE.SRGBColorSpace;
    this.qmark = new THREE.Sprite(new THREE.SpriteMaterial({ map: qt, toneMapped: false, depthWrite: false, fog: false }));
    this.qmark.visible = false; this.qmark.renderOrder = 9; scene.add(this.qmark);
    const cone = new THREE.CylinderGeometry(0.06, 1, 1, 24, 1, true); cone.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: { alpha: { value: 0.35 }, col: { value: new THREE.Color(1, 0.97, 0.85) } }, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying float vY; void main(){ vY = -position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float alpha; uniform vec3 col; varying float vY; void main(){ gl_FragColor = vec4(col * alpha * (1.0 - vY) * smoothstep(0.0, 0.08, vY), 1.0); }',
    }));
    this.cone.frustumCulled = false; this.cone.visible = false; this.cone.renderOrder = 7; scene.add(this.cone);
    // ropes (the window-washer's rig), as one line list
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
    this.ropes = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x141016 }));
    this.ropes.frustumCulled = false; this.ropes.visible = false; scene.add(this.ropes);
  }

  // ------------------------------------------------------------------ actors
  /** Pose geometries for a figure look (built once). */
  figure(look) { return this.figures[look] || (this.figures[look] = figurePoses(LOOKS[look])); }

  /**
   * A pooled actor: 'person:<look>', 'car:<style>[:<stripe>]', 'heli:<kind>', 'cat', 'stroller',
   * 'wig', 'rig', 'stack', 'rotor'. Free it with actor.hide().
   */
  take(role) {
    const list = this.pools[role] || (this.pools[role] = []);
    let a = list.find((q) => !q.busy);
    if (!a) {
      const [kind, arg, arg2] = role.split(':'), S = KIT.scale;
      if (kind === 'person') { const P = this.figure(arg); a = new Actor(this, P.stand, S.person, P); }
      else if (kind === 'car') a = new Actor(this, carGeo(arg, arg2), arg === 'van' ? S.van : S.car);
      else if (kind === 'heli') { a = new Actor(this, heliGeo(arg), S.heli); a.rotor = new THREE.Mesh(this.geos.rotor || (this.geos.rotor = rotorGeo()), this.cel); a.rotor.position.y = 3.5; a.rotor.frustumCulled = false; a.group.add(a.rotor); }
      else {
        const make = { cat: catGeo, stroller: strollerGeo, wig: wigGeo, rig: rigGeo, stack: stackGeo }[kind];
        a = new Actor(this, this.geos[kind] || (this.geos[kind] = make()), S[kind]);
      }
      list.push(a);
    }
    a.busy = true; a.group.scale.setScalar(a.base);
    return a;
  }

  /** A ground ring decal at world (x, y, z) of radius r (world units) this frame. */
  ring(x, y, z, r, col, alpha = 1, rate = 0.9) {
    const m = this.rings[this.ringN++];
    if (!m) return;
    toScene(m.position, x, y, z + 0.6);
    m.scale.setScalar(r * M);
    m.u.col.value.set(col); m.u.alpha.value = alpha; m.u.t.value = this.t; m.u.rate.value = rate;
    m.visible = true;
  }

  /** A beacon shaft at world (x, y) from the ground (or z0) up, this frame. */
  beam(x, y, col, height = 260, z0 = 0) {
    if (this.beamN >= KIT.max.beams) return;
    const g = this.beams.geometry, i = this.beamN++, cam = this.cam;
    const d = cam ? Math.hypot(x * M - cam.position.x, y * M - cam.position.z) : 200;
    _c.set(col);
    for (let k = 0; k < 4; k++) {
      g.attributes.base.setXYZ(i * 4 + k, x * M, z0 * M, y * M);
      g.attributes.bcol.setXYZ(i * 4 + k, _c.r, _c.g, _c.b);
      g.attributes.bw.setX(i * 4 + k, Math.max(10, d * 0.03));
      g.attributes.bh.setX(i * 4 + k, height);
    }
  }

  /** The riddle's "?" at world (x, y, z), size in metres, this frame. */
  question(x, y, z, size) {
    toScene(this.qmark.position, x, y, z);
    this.qmark.scale.set(size, size, 1);
    this.qmark.visible = true;
  }

  /** The chopper's spotlight: a cone from world point a to b, radius r (world) at b, this frame. */
  spot(ax, ay, az, bx, by, bz, r, alpha) {
    const c = this.cone, a = toScene(c.position, ax, ay, az), b = toScene(_v, bx, by, bz);
    const len = a.distanceTo(b);
    c.scale.set(r * M, len, r * M);
    c.quaternion.setFromUnitVectors(_s.set(0, -1, 0), b.sub(a).normalize());
    c.material.uniforms.alpha.value = alpha;
    c.visible = true;
  }

  /** Two ropes from (a0 → b0) and (a1 → b1), world points [x, y, z], this frame. */
  rope(a0, b0, a1, b1) {
    const p = this.ropes.geometry.attributes.position;
    [a0, b0, a1, b1].forEach((q, i) => p.setXYZ(i, q[0] * M, q[2] * M, q[1] * M));
    p.needsUpdate = true;
    this.ropes.visible = true;
  }

  // ------------------------------------------------------------------ per frame
  /** Start a frame: per-frame decals are cleared (moments re-place them), instanced sets restart. */
  begin(cam) {
    this.cam = cam;
    for (const m of this.rings) m.visible = false;
    this.ringN = 0; this.beamN = 0;
    this.qmark.visible = false; this.cone.visible = false; this.ropes.visible = false;
    this.drones.begin(); this.cards.begin(); this.hoops.begin();
  }

  /** End a frame: upload instances, step the particles (dt), fog for the ink; scale = the scene's render scale. */
  end(dt, fog, scale = 1) {
    this.t += dt;
    this.drones.end(); this.cards.end(); this.hoops.end();
    this.beams.geometry.setDrawRange(0, this.beamN * 6);
    for (const k of ['base', 'bcol', 'bw', 'bh']) this.beams.geometry.attributes[k].needsUpdate = true;
    this.beams.visible = this.beamN > 0;
    this.beamU.time.value = this.t;
    const cam = this.cam, px = cam ? (this.renderer.getDrawingBufferSize(_s2).y * scale / (2 * Math.tan((cam.fov * Math.PI) / 360))) : 400;
    this.glows.update(dt, px); this.puffs.update(dt, px);
    if (fog) { this.ink.uniforms.fogC.value.copy(fog.color); this.ink.uniforms.fogR.value.set(fog.near, fog.far); }
  }

  /** Burst helpers (world units): sparks/flash (additive), smoke/dust (puffs). */
  flash(x, y, z, size = 9, col = '#ffffff', life = 0.18) { this.glows.add({ x, y, z, size, grow: size * 2, life, col, shape: 1 }); }
  spark(x, y, z, n = 10, col = '#ffe23a', speed = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI;
      this.glows.add({ x, y, z, vx: Math.cos(a) * Math.cos(b) * speed, vy: Math.sin(a) * Math.cos(b) * speed, vz: Math.sin(b) * speed, drag: 2.5, size: 1.6, life: 0.5 + Math.random() * 0.3, col, shape: Math.random() < 0.3 ? 1 : 0 });
    }
  }
  smoke(x, y, z, { size = 3, col = '#8a8a90', life = 1.6, rise = 14, n = 1, spread = 4 } = {}) {
    for (let i = 0; i < n; i++) this.puffs.add({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, z, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, vz: rise, drag: 0.6, size, grow: size * 1.2, life, col, alpha: 0.9, fadeIn: 0.08 });
  }

  /** Hide every actor and effect (moments over, or the flight left). */
  clear() {
    for (const list of Object.values(this.pools)) for (const a of list) a.hide();
    this.glows.clear(); this.puffs.clear();
    this.begin(this.cam); this.end(0, null);
  }

  /** Compile the kit's shaders once, at a quiet moment (no hitch the first time a moment shows up). */
  warm(cam) {
    if (this.warmed) return;
    this.warmed = true;
    try {
      for (const r of ['person:washer', 'car:runaway', 'heli:news', 'cat']) this.take(r).at(0, 0, -9999).hide();
      this.renderer.compile(this.scene, cam);
    } catch (e) { console.warn('moment kit warm-up', e); }
  }

  /** Free the kit's own GPU resources (only ours: the city's are shared and live on). */
  dispose() {
    const seen = new Set(), roots = [this.drones.mesh, this.drones.hull, this.cards.mesh, this.hoops.mesh, this.hoops.hull, this.glows.mesh, this.puffs.mesh, this.beams, this.qmark, this.cone, this.ropes, ...this.rings];
    for (const list of Object.values(this.pools)) for (const a of list) roots.push(a.group);
    for (const r of roots) {
      if (!r) continue;
      r.traverse((o) => { for (const x of [o.geometry, ...[].concat(o.material || []), o.material?.map]) if (x) seen.add(x); });
      this.scene.remove(r);
    }
    for (const P of Object.values(this.figures)) for (const g of Object.values(P)) seen.add(g);
    for (const x of seen) x.dispose?.();
    this.pools = {}; this.figures = {};
  }
}
const _s2 = new THREE.Vector2();
