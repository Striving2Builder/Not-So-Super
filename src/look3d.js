// The comic-book render look shared by every 3D zone (Special3D and everything built on it):
// cel shading with a halftone screen in the shade, a stepped rim light on characters, inverted-hull
// ink outlines, contact shadows, ink edges on the architecture and a vignette "panel" grade.
// All of it is plain materials + a few extra meshes: no post-processing pass, so it's mobile-cheap.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- cel shading
function gradient(steps) {
  const d = new Uint8Array(steps);
  const t = new THREE.DataTexture(d, steps, 1, THREE.RedFormat);
  d.set(steps === 3 ? [110, 185, 255] : [80, 140, 205, 255]);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
let GRAD3 = null, GRAD4 = null;
export const gradMap = (steps = 3) => (steps === 3 ? (GRAD3 = GRAD3 || gradient(3)) : (GRAD4 = GRAD4 || gradient(4)));

// Shared per-frame uniforms (screen size for pixel-true outlines and dots).
export const LOOK = {
  res: { value: new THREE.Vector2(1280, 720) },
  dpr: { value: 1 },
};

/**
 * Patch a lit material (Lambert/Toon/Phong/Standard/Physical) with the comic extras.
 *  halftone: 0..1 strength of the dot screen, drawn only where the surface is in real shade
 *  rim: colour of a stepped rim light (upper-left, in screen space); null = none
 *  cel: 0..1 quantise the direct light into flat bands (for materials that aren't MeshToon)
 * Any onBeforeCompile the material already had runs first.
 */
export function comic(mat, { halftone = 0.5, rim = null, rimK = 1, cel = 0 } = {}) {
  const U = {
    htK: { value: halftone }, rimCol: { value: new THREE.Color(rim || 0x000000) }, rimK: { value: rim ? rimK : 0 },
    celK: { value: cel }, res: LOOK.res, dpr: LOOK.dpr,
  };
  mat.userData.comic = U;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float htK; uniform vec3 rimCol; uniform float rimK; uniform float celK; uniform float dpr;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (rimK > 0.0) {
  float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float rimD = smoothstep(-0.1, 0.5, dot(normal, normalize(vec3(-0.55, 0.8, 0.2))));
  totalEmissiveRadiance += rimCol * rimK * smoothstep(0.55, 0.62, rimF) * rimD;
}`)
      .replace('#include <opaque_fragment>', `
{
  const vec3 LW = vec3(0.299, 0.587, 0.114);
  float base = max(dot(diffuseColor.rgb, LW), 0.04);
  if (celK > 0.0) {
    // flat light bands (dark / mid / lit), brighter-than-white stays as it is
    float dl = dot(reflectedLight.directDiffuse, LW) / base;
    float q = 0.45 * smoothstep(0.1, 0.16, dl) + 0.55 * smoothstep(0.5, 0.58, dl);
    float tgt = dl > 1.0 ? dl : q;
    outgoingLight += reflectedLight.directDiffuse * (tgt / max(dl, 1e-3) - 1.0) * celK;
  }
  if (htK > 0.0) {
    // dots only in real shade, growing as it darkens (not a screen-door over everything)
    float htL = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, LW) / base;
    vec2 htP = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / (4.0 * dpr);
    float htR = clamp((0.42 - htL) * 1.3, 0.0, 0.6);
    float htD = 1.0 - smoothstep(htR - 0.08, htR + 0.08, length(fract(htP) - 0.5) * 1.414);
    outgoingLight *= 1.0 - htD * htK * 0.6;
  }
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `comic${rim ? 1 : 0}${halftone > 0 ? 1 : 0}${cel > 0 ? 1 : 0}|${prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey ? prevKey.call(mat) : ''}`;
  mat.needsUpdate = true;
  return mat;
}

const LIT = new Set(['MeshLambertMaterial', 'MeshPhongMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshToonMaterial']);
/**
 * Give a whole prebuilt scene (a premade club, a venue) the comic surface treatment: flat
 * light bands + halftone in the shade on every lit material that doesn't have it yet.
 */
export function comicScene(root, { halftone = 0.45, cel = 0.85 } = {}) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.ink) return;
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.comic || !LIT.has(m.type)) continue;
      comic(m, { halftone, cel: m.isMeshToonMaterial ? 0 : cel });
    }
  });
}

/**
 * Ink lines along the hard edges of a static subtree, merged into one LineSegments added under
 * `root` (so they follow its transform and any clipping planes). Done once per root.
 */
export function inkEdges(root, { angle = 32, maxTris = 60000, color = 0x120c14 } = {}) {
  if (root.userData.inked) return null;
  root.userData.inked = true;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), mtx = new THREE.Matrix4();
  const parts = [];
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.userData.ink || !o.geometry || !o.geometry.attributes.position) return;
    const m = [].concat(o.material)[0];
    if (!m || m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial) return;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    if (tris + n > maxTris) return;
    tris += n;
    const e = new THREE.EdgesGeometry(o.geometry, angle);
    e.applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld));
    parts.push(e);
    pushBack(m);
  });
  if (!parts.length) return null;
  const lines = new THREE.LineSegments(mergeGeometries(parts, false), new THREE.LineBasicMaterial({ color }));
  lines.raycast = () => {};
  lines.userData.ink = true;
  root.add(lines);
  return lines;
}

/** Nudge a surface back in depth so ink lines drawn exactly on its edges win (no dashes). */
export function pushBack(m) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }

/** A cel-shaded material (the zones' stand-in for Lambert). */
export function toon(color, extra = {}, opts = {}) {
  const { steps = 3, halftone = 0.5, ...rest } = { ...extra, ...opts };
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradMap(steps), ...rest });
  return comic(m, { halftone });
}

// ---------------------------------------------------------------- characters
const INK = 0x140c16;
let outlineMat = null;
function makeOutlineMat() {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const U = { olW: { value: 2.2 }, res: LOOK.res, dpr: LOOK.dpr };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float olW; uniform vec2 res; uniform float dpr;')
      .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_SKINNING
vec3 olN = objectNormal;
#else
vec3 olN = normal;
#endif
vec4 olC = projectionMatrix * vec4(normalize(normalMatrix * olN), 0.0);
vec2 olD = olC.xy * res;
float olL = length(olD);
// constant ink width on screen, thinning a little for far-away figures
if (olL > 1e-5) gl_Position.xy += (olD / olL) * olW * dpr * clamp(9.0 / gl_Position.w, 0.45, 1.0) * 2.0 / res * gl_Position.w;`);
  };
  m.customProgramCacheKey = () => 'inkHull';
  return m;
}

const toonCache = new WeakMap();
function toonFrom(src, rim) {
  const key = rim ? 'rim' : 'plain';
  let per = toonCache.get(src);
  if (!per) toonCache.set(src, (per = {}));
  if (per[key]) return per[key];
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: gradMap(3),
    emissive: src.emissive ? src.emissive.clone() : 0x000000, emissiveMap: src.emissiveMap || null,
    transparent: !!src.transparent && (src.opacity ?? 1) < 0.99, opacity: src.opacity ?? 1, alphaTest: src.alphaTest || 0, side: src.side ?? THREE.FrontSide,
  });
  comic(m, { halftone: 0, rim, rimK: 1 });
  return (per[key] = m);
}

/**
 * Give a character (procedural NPC, cast enemy model or the heroine) the comic treatment: cel
 * materials + rim, and an inverted-hull ink outline on every mesh (skinned ones follow the rig).
 * `skip` = meshes to leave alone (e.g. the simulated cape, which is a single sheet).
 */
export function inkCharacter(root, { rim = 0xfff0c8, outline = true, skip = [] } = {}) {
  if (!outlineMat) outlineMat = makeOutlineMat();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && !o.userData.ink && !skip.includes(o)) meshes.push(o); });
  for (const o of meshes) {
    const isArr = Array.isArray(o.material);
    if (!isArr && o.material && !o.material.isMeshBasicMaterial && !o.material.userData.comic) o.material = toonFrom(o.material, rim);
    if (!outline || isArr || (o.material && o.material.transparent)) continue;
    const hull = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, outlineMat) : new THREE.Mesh(o.geometry, outlineMat);
    if (o.isSkinnedMesh) { hull.bind(o.skeleton, o.bindMatrix); hull.bindMode = o.bindMode; }
    hull.userData.ink = true;
    hull.frustumCulled = false;
    hull.raycast = () => {};
    o.add(hull);
  }
  return root;
}

// ---------------------------------------------------------------- contact shadows
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  r.addColorStop(0, 'rgba(0,0,0,0.8)'); r.addColorStop(0.45, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

/** Soft dark ovals under everyone who walks the floor, all in one instanced draw call. */
export class BlobShadows {
  constructor(scene, max = 40) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0x000000 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.mesh.raycast = () => {};
    this.items = [];
    this.max = max;
    this._m = new THREE.Matrix4(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._q = new THREE.Quaternion();
    scene.add(this.mesh);
  }

  track(obj, radius = 0.55) { if (this.items.length < this.max) this.items.push({ obj, r: radius }); }

  static shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  update() {
    let n = 0;
    for (const it of this.items) {
      const o = it.obj;
      if (!o.parent || !BlobShadows.shown(o)) continue;
      // a figure lying down (knocked out) casts a longer, flatter shadow
      const down = Math.min(1, Math.abs(o.rotation.x) / 1.4);
      this._p.set(o.position.x, o.position.y + 0.025, o.position.z);
      this._s.set(it.r * 2, 1, it.r * 2 * (1 + down * 1.4));
      this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, o.rotation.y);
      this.mesh.setMatrixAt(n++, this._m.compose(this._p, this._q, this._s));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- architecture
/**
 * Merge the given static meshes into one mesh per material look, baking world transforms, plus
 * one LineSegments of ink edges over all of them. Returns the new meshes. Materials with
 * userData.worldUV (metres per texture repeat) get box-projected world UVs so textures tile at
 * real scale across differently sized boxes.
 */
export function bakeStatic(scene, meshes, { ink = true, inkColor = INK, inkAngle = 35, inkOpacity = 0.85 } = {}) {
  const groups = new Map();
  const edges = [];
  for (const m of meshes) {
    if (!m.parent) continue;
    m.updateWorldMatrix(true, false);
    const mat = m.material;
    const key = sig(mat);
    let geo = m.geometry.index ? m.geometry.clone() : m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.index) geo = indexed(geo);
    if (mat.userData.worldUV) worldUV(geo, mat.userData.worldUV);
    if (!groups.has(key)) groups.set(key, { mat, geos: [] });
    groups.get(key).geos.push(geo);
    // ink only hard-edged shapes (round ones would come out as wireframe)
    if (ink && !m.userData.noInk && !mat.transparent && INKED.has(m.geometry.type)) {
      mat.polygonOffset = true; mat.polygonOffsetFactor = 1; mat.polygonOffsetUnits = 1; // lines win the depth test
    }
    if (ink && !m.userData.noInk && !mat.transparent && INKED.has(m.geometry.type)) edges.push(new THREE.EdgesGeometry(geo, m.geometry.type === 'CylinderGeometry' ? 40 : inkAngle));
    m.parent.remove(m);
    if (m.geometry) m.geometry.dispose();
  }
  const out = [];
  for (const { mat, geos } of groups.values()) {
    const g = mergeGeometries(geos, false);
    if (!g) continue;
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    out.push(mesh);
  }
  if (edges.length) {
    const e = mergeGeometries(edges, false);
    const lines = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: inkColor, transparent: inkOpacity < 1, opacity: inkOpacity }));
    lines.matrixAutoUpdate = false;
    lines.raycast = () => {};
    scene.add(lines);
    out.push(lines);
  }
  return out;
}

const INKED = new Set(['BoxGeometry', 'PlaneGeometry', 'CylinderGeometry']);

function indexed(g) {
  const n = g.attributes.position.count, idx = [];
  for (let i = 0; i < n; i++) idx.push(i);
  g.setIndex(idx);
  return g;
}

function sig(m) {
  const c = (x) => (x && x.getHexString ? x.getHexString() : '');
  return [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.map ? m.map.uuid : '', m.transparent, m.opacity, m.side, m.wireframe, m.uuid && m.userData.unique ? m.uuid : ''].join('|');
}

/** Box-projected UVs in world metres / `tile`. */
export function worldUV(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  if (!n) return;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i) * Math.sign(n.getX(i) || 1); v = p.getY(i); }
    else { u = -p.getX(i) * Math.sign(n.getZ(i) || 1); v = p.getY(i); }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// ---------------------------------------------------------------- grade
/** A full-screen vignette + colour cast, drawn last (one quad, no extra render pass). */
export function gradeQuad(tint = 0x0a0612, strength = 0.55) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(tint) }, k: { value: strength } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform vec3 tint; uniform float k; varying vec2 vUv;
void main(){ vec2 d = (vUv - 0.5) * vec2(1.0, 0.9); float v = smoothstep(0.32, 0.78, length(d));
gl_FragColor = vec4(tint, v * k); }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  q.frustumCulled = false;
  q.renderOrder = 1e6;
  q.raycast = () => {};
  return q;
}

/** Soft additive pool of light on the floor (radial gradient decal). */
let poolTex = null;
export function lightPool(color, radius, opacity = 0.35) {
  if (!poolTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 63);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    poolTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  m.raycast = () => {};
  return m;
}

/** Update the shared screen uniforms (call once per frame before rendering). */
export function lookFrame(renderer) {
  renderer.getDrawingBufferSize(LOOK.res.value);
  LOOK.dpr.value = renderer.getPixelRatio();
}

// ---------------------------------------------------------------- void
let groundTex = null;
/**
 * The ground the building stands on, out to the fog: no room ever floats in black nothing.
 * Unlit (one cheap draw call), tinted per venue, fades into the scene fog.
 */
export function groundBackdrop(color, y = -0.03, { size = 260, grid = true } = {}) {
  if (!groundTex) {
    groundTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * 256, yy = Math.random() * 256, r = 6 + Math.random() * 40;
        const gr = g.createRadialGradient(x, yy, 0, x, yy, r);
        const d = Math.random() < 0.5 ? '0,0,0' : '255,255,255';
        gr.addColorStop(0, `rgba(${d},${(Math.random() * 0.18).toFixed(3)})`); gr.addColorStop(1, `rgba(${d},0)`);
        g.fillStyle = gr; g.fillRect(x - r, yy - r, r * 2, r * 2);
      }
      for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
  }
  const map = groundTex.clone(); map.needsUpdate = true; map.repeat.set(size / 8, size / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, map: grid ? map : null }));
  m.position.y = y;
  m.renderOrder = -1;
  m.raycast = () => {};
  m.userData.backdrop = true;
  return m;
}

// ---------------------------------------------------------------- particles
/**
 * Cheap GPU-animated particles in one draw call. kind:
 *  'dust'  motes drifting and twinkling inside a box (light beams, pools)
 *  'drip'  drops falling from `top` to the floor and repeating (leaks)
 *  'spark' short bright arcs spraying out and falling (broken consoles)
 * `boxes`: [[x, z, halfW, halfD]] regions to fill; update(t) each frame.
 */
export class Particles {
  constructor(kind, boxes, { count = 60, color = 0xffffff, size = 0.06, top = 2.8, opacity = 0.8 } = {}) {
    const n = count, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [x, z, w, d] = boxes[i % boxes.length];
      pos[i * 3] = x + (Math.random() * 2 - 1) * w; pos[i * 3 + 1] = Math.random() * top; pos[i * 3 + 2] = z + (Math.random() * 2 - 1) * d;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const K = { dust: 0, drip: 1, spark: 2 }[kind];
    this.u = { t: { value: 0 }, col: { value: new THREE.Color(color) }, sz: { value: size }, top: { value: top }, op: { value: opacity }, px: { value: 400 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: K === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float t, sz, top, px; varying float vA;
void main(){
  vec3 p = position; float a = 1.0;
  ${K === 0 ? `p.x += sin(t * 0.3 + seed * 40.0) * 0.4; p.z += cos(t * 0.23 + seed * 30.0) * 0.4;
  p.y = mod(position.y + t * (0.05 + seed * 0.08), top); a = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * 2.0 + seed * 60.0));
  a *= smoothstep(0.0, 0.4, p.y) * smoothstep(top, top - 0.6, p.y);` : ''}
  ${K === 1 ? `float ph = fract(t * 0.45 + seed); p.y = top * (1.0 - ph * ph); a = step(0.05, p.y);` : ''}
  ${K === 2 ? `float ph = fract(t * 0.7 + seed * 3.0); float burst = step(0.6, fract(seed * 7.0 + floor(t * 0.7 + seed * 3.0) * 0.37));
  vec2 dir = vec2(cos(seed * 91.0), sin(seed * 91.0)); p.xz += dir * ph * 1.2; p.y = position.y + ph * 1.2 - ph * ph * 2.6; a = burst * (1.0 - ph);` : ''}
  vA = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = sz * px / -mv.z;
}`,
      fragmentShader: `uniform vec3 col; uniform float op; varying float vA;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(col, vA * op * smoothstep(0.5, 0.15, r)); }`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
  }

  update(t, renderer, cam) {
    this.u.t.value = t;
    if (renderer && cam) this.u.px.value = renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
  }
}
