// Supergirl's own comic surface, shared by every place she's rendered from the rigged model (3D flight,
// and the HeroSprite renders behind the 2D flight view, the brawler and the portraits): three hard cel
// bands from the real normals (the model's baked normal map is not used: clean shapes, not cloth
// noise), pushed costume saturation, a little self-light, a back-light rim on the true silhouette and
// her hair as one blonde mass in three tones (the painted locks and shine kept on top).
import * as THREE from 'three';
import { comic, gradMap } from './look3d.js';
import { HERO_SKIN } from './settings.js';

/**
 * How far her skirt's hem rises, per skin (model metres; THE tunable for the user's phone notes).
 * The modelled hem sits at 0.80 m, mid-thigh (hip joint 1.03, knee 0.56, waist 1.20); 0.12 puts it at
 * 0.92, upper thigh, a bit above the reference photo (in game it reads longer than it is). The legs
 * are modelled under it, so nothing opens up. ?skirt=<m> overrides every skin (?skirt=0: as modelled).
 */
export const SKIRT_TRIM = { supergirl: 0.12, classic: 0.12, ponytail: 0.12, dark: 0.135, croptop: 0.12 };
/**
 * Her skirt's flutter (morph targets on the skirt's own vertices, so every material, the ink hull and
 * the skinning carry it): sway: hem shift (m) at full wind; flip: the flare angle (deg) of flip();
 * ripple: [hem wave (m), lobes round the hem]; spring: flip() spring [stiffness, damping ratio, kick].
 */
export const SKIRT_SWAY = { sway: 0.06, flip: 80, ripple: [0.028, 3], spring: [60, 0.42, 11] };

/** Costume read: saturation, self-light (fraction of albedo), cyan-white rim (only the silhouette). */
export const SUIT = { sat: 1.45, self: 0.32, rim: [0.62, 0.95, 1.0], rimK: [1.3, 2.4], rimEdge: [0.82, 0.92] }; // rimK: open sky / against dark walls; rimEdge: its fresnel band
/**
 * Her skin: the texels that read as skin (warm, mid-saturated: not the suit red, the gold or her hair)
 * keep a gentler saturation push, and their shade band takes its hue from the skin itself, a little
 * rosier (× shade), so the warm camera fill can't turn her thighs and hands orange-tan.
 */
const SKIN = { sat: 1.1, shade: [1.0, 0.86, 0.9], grey: 0.3, floor: 0.8, g: [0.5, 0.93], b: [0.36, 0.86] }; // g, b: G/R and B/R ranges; grey: desaturation in the shade (ACES turns a dark peach orange); floor: shade brightness floor (× lit)
/**
 * Her skirt (its atlas rect; glTF uv, v down, the hem at v0): one flat red (the painted hatch read as
 * dirt at gameplay size), a deeper crimson shade, the underside always in it and a dark hem band, so
 * it reads as its own shape over the red boots instead of one red mass with her legs.
 */
const SKIRT = { uv: [0.283, 0.262, 0.79, 0.424], red: [0.69, 0.01, 0.016], shade: [0.42, 0.0, 0.03], hem: [0.284, 0.55] }; // red/shade: linear; hem: [v up to, darkness]
if (HERO_SKIN === 'dark') Object.assign(SKIRT, { red: [0.2, 0.004, 0.012], shade: [0.09, 0.0, 0.012] }); // Supergirl_Dark: maroon
/**
 * The scene's light on her (3D flight only; the sprites keep white): `tint` multiplies everything she
 * shows (time of day: full by day, warm at dusk, dim and blue at night, so she isn't a daylight sticker
 * on a night city) and `rim` is the silhouette rim's colour (sky-coloured: pale cyan by day, sunset
 * orange at dusk, cool blue at night). Set every frame by her flight code from the sun / sky.
 */
export const HERO_LIGHT = { tint: { value: new THREE.Color(1, 1, 1) }, rim: { value: new THREE.Color(...SUIT.rim) } };
/**
 * Her hair: the texels of this atlas rect that are orange-blonde (the hair shell's painted swatch and
 * the scalp) become one blonde mass in three tones; ref = linear luminance of the swatch's base blonde
 * (the painted locks, ink and shine modulate the tones around it).
 */
export const HAIR = {
  uv: [0.0, 0.58, 0.6, 1.0], cut: [0.24, 0.5], ref: 0.59, // cut: light-band thresholds mid / lit
  // [lit, mid, shade], linear: picked so they land on golden blonde after ACES (3D flight: a bright
  // yellow washes out to beige there) or as they are (the sprites render without tone mapping)
  aces: [[1.2, 0.8, 0.08], [0.8, 0.42, 0.035], [0.5, 0.24, 0.02]], // → ≈ (240,222,130) bright gold, (222,180,64) warm gold, (202,154,46) ochre
  raw: [[0.94, 0.62, 0.08], [0.73, 0.35, 0.034], [0.35, 0.107, 0.013]],
};

/**
 * Her cel material for one source material (her own, not the zones' shared cache: these are pushed).
 * self: self-light; rim: { value } strength uniform (null = no rim); key: { value: Vector3 } world
 * direction of the key light (the rim sits on the edges turned away from it); toneMapped: drawn with
 * ACES (the flight view) or not (HeroSprite).
 */
export function heroMaterial(src, { self = SUIT.self, rim = null, key = null, toneMapped = true, light = null } = {}) {
  const [lit, mid, shade] = (toneMapped ? HAIR.aces : HAIR.raw).map((c) => `vec3(${c.join(', ')})`);
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: gradMap(3),
    transparent: !!src.transparent && (src.opacity ?? 1) < 0.99, opacity: src.opacity ?? 1, alphaTest: src.alphaTest || 0, side: src.side ?? THREE.FrontSide,
  });
  const keyU = key || { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.suitRim = rim || { value: 0 }; sh.uniforms.suitKey = keyU;
    sh.uniforms.heroTint = light ? light.tint : { value: new THREE.Color(1, 1, 1) };
    sh.uniforms.heroRimC = light ? light.rim : { value: new THREE.Color(...SUIT.rim) };
    const H = HAIR.uv.map((v) => v.toFixed(3)), S = SKIRT.uv.map((v) => v.toFixed(3));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float suitRim; uniform vec3 suitKey, heroTint, heroRimC;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float hairK = 0.0, hairD = 1.0, skinK = 0.0, skirtK = 0.0, hemK = 0.0;
#ifdef USE_MAP
{ // her hair (orange-blonde texels in their atlas rect): one blonde, lit by the cel bands
  vec2 hu = vMapUv; vec3 t = diffuseColor.rgb;
  float inRect = step(${H[0]}, hu.x) * step(hu.x, ${H[2]}) * step(${H[1]}, hu.y) * step(hu.y, ${H[3]});
  hairK = inRect * step(t.b * 1.25, t.r) * step(t.b, t.g);
  hairD = clamp(dot(t, vec3(0.299, 0.587, 0.114)) / ${HAIR.ref.toFixed(3)}, 0.86, 1.12); // the painted locks / shine survive the flat tones (gently: a deep modulation turns blonde brown)
  diffuseColor.rgb = mix(diffuseColor.rgb, ${lit}, hairK);
  skirtK = step(${S[0]}, hu.x) * step(hu.x, ${S[2]}) * step(${S[1]}, hu.y) * step(hu.y, ${S[3]}) * step(t.g * 2.0, t.r + 0.02); // (red or its dark hatch; not the gold)
  hemK = skirtK * (1.0 - smoothstep(${(SKIRT.hem[0] - 0.01).toFixed(3)}, ${SKIRT.hem[0].toFixed(3)}, hu.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${SKIRT.red.join(', ')}), skirtK);
  vec2 sr = t.gb / max(t.r, 1e-3); // skin: warm and mid-saturated (the suit red has no green, the gold no blue)
  skinK = (1.0 - hairK) * step(0.25, t.r) * smoothstep(${SKIN.g[0].toFixed(2)}, ${(SKIN.g[0] + 0.06).toFixed(2)}, sr.x) * (1.0 - smoothstep(${(SKIN.g[1] - 0.04).toFixed(2)}, ${SKIN.g[1].toFixed(2)}, sr.x))
    * smoothstep(${SKIN.b[0].toFixed(2)}, ${(SKIN.b[0] + 0.06).toFixed(2)}, sr.y) * (1.0 - smoothstep(${(SKIN.b[1] - 0.04).toFixed(2)}, ${SKIN.b[1].toFixed(2)}, sr.y)) * step(sr.y, sr.x);
}
#endif
{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, mix(${SUIT.sat.toFixed(2)}, ${SKIN.sat.toFixed(2)}, skinK)), 0.0); }`)
      // a back-light rim on the true silhouette (her outline separates from what's behind her):
      // strongest on the edges turned away from the key light, and along her top
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(2)};
vec3 rimAdd = vec3(0.0);
${rim ? `{ float rf = 1.0 - abs(dot(normal, normalize(vViewPosition)));
  vec2 kd = (viewMatrix * vec4(suitKey, 0.0)).xy; kd = kd / max(1e-3, length(kd));
  vec2 ns = normal.xy / max(1e-3, length(normal.xy));
  float rd = max(smoothstep(-0.2, 0.5, normal.y), smoothstep(-0.2, 0.6, -dot(ns, kd)));
  rimAdd = heroRimC * suitRim * (1.0 - 0.75 * hairK) * smoothstep(${SUIT.rimEdge.join(', ')}, rf) * rd; }` : ''}`)
      // hair: three hard cel tones from the light band, and the underside (facing the ground) always
      // in the darkest, so her head reads as one solid shape
      .replace('#include <opaque_fragment>', `{ float hl = dot(outgoingLight, vec3(0.333)) / 0.85;
  float under = smoothstep(-0.05, -0.35, (vec4(normal, 0.0) * viewMatrix).y);
  float tone = step(${HAIR.cut[0]}, hl) + step(${HAIR.cut[1]}, hl);
  tone = min(tone, 2.0 * (1.0 - under));
  vec3 hc = tone > 1.5 ? ${lit} : tone > 0.5 ? ${mid} : ${shade};
  outgoingLight = mix(outgoingLight, hc * hairD, hairK); }
{ // skin: keep its brightness, take the hue from the skin (rosier in the shade), not from the warm fill
  vec3 a = max(diffuseColor.rgb, vec3(1e-3)); float al = dot(a, vec3(0.299, 0.587, 0.114));
  float L = dot(outgoingLight, vec3(0.299, 0.587, 0.114)) / al;
  float lit = smoothstep(0.6, 1.0, L);
  vec3 sh = mix(a, vec3(al), ${SKIN.grey.toFixed(2)}) * vec3(${SKIN.shade.join(', ')});
  outgoingLight = mix(outgoingLight, mix(sh * max(L, ${SKIN.floor.toFixed(2)}), a * L, lit), skinK); }
{ // skirt: two hard tones from the key light, lit red / deep crimson (its underside always the crimson), a darker hem band
  vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz;
  float lit = smoothstep(0.08, 0.22, dot(nw, suitKey)) * (1.0 - smoothstep(0.0, -0.3, nw.y));
  vec3 sk = mix(vec3(${SKIRT.shade.join(', ')}), outgoingLight, lit) * (1.0 - ${SKIRT.hem[1].toFixed(2)} * hemK);
  outgoingLight = mix(outgoingLight, sk, skirtK); }
outgoingLight = outgoingLight * heroTint + rimAdd; // (the scene's time of day on all of her; the rim on top)
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `suit${self}${rim ? 1 : 0}${toneMapped ? 1 : 0}${light ? 1 : 0}`;
  return comic(m, { halftone: 0 });
}

/**
 * Her ink hull's geometry: her mesh without the eyeballs, teeth and lash cards (atlas rects below).
 * Pushed out along their normals those small parts poke black blotches through her eyelids and lips;
 * they keep rendering, only their outline goes. Shares the mesh's attributes (only a new index).
 */
// (eyeballs + teeth, lashes, mouth/socket interior, and her face from the brows to the lips: its sockets
// and nostrils would ink through; the hair shell's rim and the jaw below still frame it)
const NO_INK = [[0.69, 0, 1, 0.12], [0.33, 0.05, 0.4, 0.11], [0.33, 0.41, 0.41, 0.52], [0.03, 0.04, 0.31, 0.18]]; // [u0, v0, u1, v1] (glTF uv, v down)
export function hullGeometry(geo) {
  if (geo.userData.hull) return geo.userData.hull;
  const uv = geo.attributes.uv, idx = geo.index.array, keep = [];
  const out = (i) => { const u = uv.getX(i), v = uv.getY(i); return NO_INK.some(([a, b, c, d]) => u > a && u < c && v > b && v < d); };
  for (let i = 0; i < idx.length; i += 3) if (!out(idx[i])) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  const g = new THREE.BufferGeometry();
  for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
  g.morphAttributes = geo.morphAttributes; g.morphTargetsRelative = geo.morphTargetsRelative; // (the skirt's flutter)
  g.setIndex(keep);
  g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox;
  return (geo.userData.hull = g);
}

/**
 * Give a HeroModel her comic surface (heroMaterial on every lit mesh except `skip`, e.g. the cloth
 * cape); call before inkCharacter (which then keeps these materials and adds the ink hull), then
 * inkHull(root) to drop the hull's face / eyeball parts.
 */
export function dressHero(root, opts, skip = []) {
  root.traverse((o) => {
    if (!o.isMesh || skip.includes(o) || o.userData.ink || !o.material || Array.isArray(o.material) || o.material.isMeshBasicMaterial) return;
    o.material = heroMaterial(o.material, opts);
  });
  return root;
}

/** Her ink hulls (inkCharacter's) skip the eyeballs, teeth, lashes and face interior. */
export function inkHull(root) {
  root.traverse((o) => { if (o.userData.ink && o.isSkinnedMesh && o.geometry.index) o.geometry = hullGeometry(o.geometry); });
  return root;
}

const _q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const TRIM = _q && _q.has('skirt') && Number.isFinite(+_q.get('skirt')) ? +_q.get('skirt') : SKIRT_TRIM[HERO_SKIN] ?? 0.12;

/**
 * Shorten her skirt (SKIRT_TRIM) and give it its flutter shapes: once per loaded geometry, at load.
 * The skirt's vertices (its atlas rect, below the chest) squeeze up toward the waist, flare kept; each
 * takes the skin weights of the original skirt vertex nearest its new spot, so walking doesn't stretch
 * it. Then five relative morph targets: sway x, sway z, flip (the panels swing out and up round the
 * belt), ripple sin / cos (a wave round the hem).
 */
export function shapeSkirt(mesh) {
  const geo = mesh.geometry;
  if (geo.userData.skirt !== undefined || !geo.attributes.uv || !geo.index) return;
  const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const [u0, v0, u1, v1] = SKIRT.uv, used = new Uint8Array(pos.count), list = [];
  for (const i of geo.index.array) used[i] = 1;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (used[i] && u > u0 && u < u1 && v > v0 && v < v1 && pos.getY(i) < 1.3) list.push(i);
  }
  geo.userData.skirt = null;
  if (list.length < 50) return;
  let top = -1e9, hem = 1e9;
  for (const i of list) { top = Math.max(top, pos.getY(i)); hem = Math.min(hem, pos.getY(i)); }
  const len0 = top - hem, trim = Math.min(Math.max(TRIM, -0.1), len0 * 0.6), s = (len0 - trim) / len0, len = len0 - trim;
  // the trim: squeeze toward the waist (normals by the inverse transpose), weights from the nearest original
  const n = list.length, op = new Float32Array(n * 3), oi = [], ow = [];
  list.forEach((i, k) => {
    op[k * 3] = pos.getX(i); op[k * 3 + 1] = pos.getY(i); op[k * 3 + 2] = pos.getZ(i);
    if (si && sw) { oi.push([si.getX(i), si.getY(i), si.getZ(i), si.getW(i)]); ow.push([sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)]); }
  });
  if (trim) list.forEach((i, k) => {
    const y = top - (top - op[k * 3 + 1]) * s, x = op[k * 3], z = op[k * 3 + 2];
    pos.setY(i, y);
    if (nrm) { const nx = nrm.getX(i), ny = nrm.getY(i) / s, nz = nrm.getZ(i), l = Math.hypot(nx, ny, nz) || 1; nrm.setXYZ(i, nx / l, ny / l, nz / l); }
    if (!oi.length) return;
    let best = k, bd = 1e9;
    for (let j = 0; j < n; j++) { const d = (op[j * 3] - x) ** 2 + (op[j * 3 + 1] - y) ** 2 + (op[j * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = j; } }
    si.setXYZW(i, ...oi[best]); sw.setXYZW(i, ...ow[best]);
  });
  pos.needsUpdate = true; if (nrm) nrm.needsUpdate = true; if (si) si.needsUpdate = true; if (sw) sw.needsUpdate = true;
  if (trim > 0) briefs(mesh, list);
  // the flutter shapes, weighted by depth below the waist (the belt stays put)
  let cx = 0, cz = 0, cn = 0;
  for (const i of list) if (pos.getY(i) > top - len * 0.3) { cx += pos.getX(i); cz += pos.getZ(i); cn++; }
  cx /= cn || 1; cz /= cn || 1;
  const S = SKIRT_SWAY, phi = (S.flip * Math.PI) / 180, [R, lobes] = S.ripple;
  const T = Array.from({ length: 5 }, () => new Float32Array(pos.count * 3));
  for (const i of list) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), t = (top - y) / len;
    const w = Math.pow(Math.min(1, Math.max(0, (t - 0.12) / 0.88)), 1.5), wb = Math.min(1, Math.max(0, (t - 0.08) / 0.3));
    let rx = x - cx, rz = z - cz; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    const th = Math.atan2(rz, rx), d = (top - y) * wb, o = i * 3;
    T[0][o] = S.sway * w;
    T[1][o + 2] = S.sway * w;
    T[2][o] = rx * d * Math.sin(phi); T[2][o + 1] = d * (1 - Math.cos(phi)); T[2][o + 2] = rz * d * Math.sin(phi);
    const a = Math.sin(lobes * th) * R * w, b = Math.cos(lobes * th) * R * w;
    T[3][o] = rx * a; T[3][o + 1] = a * 0.6; T[3][o + 2] = rz * a;
    T[4][o] = rx * b; T[4][o + 1] = b * 0.6; T[4][o + 2] = rz * b;
  }
  geo.morphAttributes.position = T.map((a) => new THREE.BufferAttribute(a, 3));
  geo.morphTargetsRelative = true;
  geo.userData.skirt = 0; // (index of its first morph target)
  mesh.updateMorphTargets();
}

/**
 * Under the shorter skirt her briefs show, and most atlases (Classic, Ponytail, Dark, both renders)
 * paint them as skin (the long skirt hid them): her pelvis below the belt (the vertices her hips bone
 * leads, so the leg holes follow the thighs' weights) takes the suit fabric's UVs from her abdomen
 * just above the belt, at the same angle round her body.
 */
function briefs(mesh, skirt) {
  const geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const bones = mesh.skeleton && mesh.skeleton.bones;
  if (!bones || !si || !sw) return;
  const hipJ = new Set(); bones.forEach((b, j) => { if (/Hips$/.test(b.name)) hipJ.add(j); });
  const inSkirt = new Uint8Array(pos.count); for (const i of skirt) inSkirt[i] = 1;
  const used = new Uint8Array(pos.count); for (const i of geo.index.array) used[i] = 1;
  const hipW = (i) => { let w = 0; for (let k = 0; k < 4; k++) if (hipJ.has(si.getComponent(i, k))) w += sw.getComponent(i, k); return w; };
  let cx = 0, cz = 0, cn = 0;
  for (const i of skirt) { cx += pos.getX(i); cz += pos.getZ(i); cn++; }
  cx /= cn; cz /= cn;
  const ang = (i) => Math.atan2(pos.getZ(i) - cz, pos.getX(i) - cx), src = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (used[i] && !inSkirt[i] && y > 1.24 && y < 1.3 && Math.abs(pos.getX(i) - cx) < 0.2) src.push([ang(i), uv.getX(i), uv.getY(i)]);
  }
  if (src.length < 8) return;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (!used[i] || inSkirt[i] || y < 0.78 || y > 1.1 || Math.abs(pos.getX(i) - cx) > 0.24 || hipW(i) < 0.45) continue;
    const a = ang(i);
    let best = src[0], bd = 9;
    for (const s of src) { const d = Math.abs(Math.atan2(Math.sin(a - s[0]), Math.cos(a - s[0]))); if (d < bd) { bd = d; best = s; } }
    uv.setXY(i, best[1], best[2]);
  }
  uv.needsUpdate = true;
}

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _m3 = new THREE.Matrix3();
/**
 * Drives one HeroModel's skirt shapes: the air on her (the cloth cape's wind, in her frame, plus her
 * own motion) sways it and sets a ripple travelling round the hem (faster with more air); flip() is
 * a short upward flare on a damped spring that settles in about a second.
 */
export class SkirtSway {
  constructor(root) {
    this.root = root; this.meshes = []; this.n = 0;
    root.traverse((o) => { if (o.isSkinnedMesh && o.geometry.userData.skirt != null && o.morphTargetInfluences) this.meshes.push(o); });
    this.v = new THREE.Vector3(); this.air = new THREE.Vector3(); this.last = null;
    this.k = [0, 0, 0, 0, 0]; this.fx = 0; this.fv = 0; this.ph = 0; this.t = Math.random() * 9;
  }

  /** A flare up and out (power ~1: a full flip; it peaks in ~0.15 s and settles in ~1 s). */
  flip(power = 1) { this.fv += SKIRT_SWAY.spring[2] * power; }

  /** wind: the air on her in her own frame (+z = the way she faces), or null (her motion only). */
  step(dt, wind = null) {
    if (!this.meshes.length || !(dt > 0)) return;
    if (this.n++ % 30 === 0) for (const m of this.meshes) for (const c of m.children) if (c.userData.ink && c.morphTargetInfluences) c.morphTargetInfluences = m.morphTargetInfluences; // (her ink hull: same shapes)
    // her own motion, in her frame (model metres/s): the air streams the other way
    this.root.getWorldPosition(_p);
    if (this.last) {
      _d.subVectors(_p, this.last).applyMatrix3(_m3.setFromMatrix4(this.root.matrixWorld).invert()).divideScalar(dt);
      if (_d.lengthSq() < 1e6) this.v.lerp(_d, Math.min(1, dt * 8)); // (a teleport isn't a gust)
    } else this.last = new THREE.Vector3();
    this.last.copy(_p);
    this.air.set(0, 0, 0); if (wind) this.air.copy(wind);
    this.air.addScaledVector(this.v, -0.6);
    const mag = this.air.length(), g = 1 - Math.exp(-mag / 6), dx = mag ? this.air.x / mag : 0, dy = mag ? this.air.y / mag : 0, dz = mag ? this.air.z / mag : 0;
    this.t += dt;
    // the flip: a damped spring kicked by flip()
    const [K, Z] = SKIRT_SWAY.spring, h = Math.min(dt, 1 / 30);
    this.fv += (-K * this.fx - 2 * Z * Math.sqrt(K) * this.fv) * h; this.fx += this.fv * h;
    this.ph += dt * (2.5 + 9 * g);
    const amp = 0.15 + 0.85 * g, tgt = [
      dx * g * 0.7 + Math.sin(this.t * 1.7) * 0.12 * g,
      dz * g * 0.7 + Math.sin(this.t * 2.3) * 0.1 * g,
      0.04 + Math.max(0, dy) * g * 0.25 + 0.06 * g,
    ];
    const e = Math.min(1, dt * 6);
    for (let j = 0; j < 3; j++) this.k[j] += (tgt[j] - this.k[j]) * e;
    this.k[3] = amp * Math.cos(this.ph); this.k[4] = amp * Math.sin(this.ph);
    const flare = Math.min(1.1, Math.max(-0.05, this.k[2] + this.fx));
    for (const m of this.meshes) {
      const I = m.morphTargetInfluences;
      I[0] = this.k[0]; I[1] = this.k[1]; I[2] = flare; I[3] = this.k[3]; I[4] = this.k[4];
    }
  }
}
