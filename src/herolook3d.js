// Supergirl's own comic surface, shared by every place she's rendered from the rigged model (3D flight,
// and the HeroSprite renders behind the 2D flight view, the brawler and the portraits): three hard cel
// bands from the real normals (the model's baked normal map is not used: clean shapes, not cloth
// noise), pushed costume saturation, a little self-light, a back-light rim on the true silhouette and
// her hair as one blonde mass in three tones (the painted locks and shine kept on top).
import * as THREE from 'three';
import { comic, gradMap } from './look3d.js';

/** Costume read: saturation, self-light (fraction of albedo), cyan-white rim (only the silhouette). */
export const SUIT = { sat: 1.45, self: 0.32, rim: [0.62, 0.95, 1.0], rimK: [1.3, 2.4], rimEdge: [0.82, 0.92] }; // rimK: open sky / against dark walls; rimEdge: its fresnel band
/**
 * Her skin: the texels that read as skin (warm, mid-saturated: not the suit red, the gold or her hair)
 * keep a gentler saturation push, and their shade band takes its hue from the skin itself, a little
 * rosier (× shade), so the warm camera fill can't turn her thighs and hands orange-tan.
 */
const SKIN = { sat: 1.1, shade: [0.95, 0.86, 0.88], g: [0.5, 0.93], b: [0.36, 0.86] }; // g, b: G/R and B/R ranges
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
    const H = HAIR.uv.map((v) => v.toFixed(3));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float suitRim; uniform vec3 suitKey, heroTint, heroRimC;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float hairK = 0.0, hairD = 1.0, skinK = 0.0;
#ifdef USE_MAP
{ // her hair (orange-blonde texels in their atlas rect): one blonde, lit by the cel bands
  vec2 hu = vMapUv; vec3 t = diffuseColor.rgb;
  float inRect = step(${H[0]}, hu.x) * step(hu.x, ${H[2]}) * step(${H[1]}, hu.y) * step(hu.y, ${H[3]});
  hairK = inRect * step(t.b * 1.25, t.r) * step(t.b, t.g);
  hairD = clamp(dot(t, vec3(0.299, 0.587, 0.114)) / ${HAIR.ref.toFixed(3)}, 0.86, 1.12); // the painted locks / shine survive the flat tones (gently: a deep modulation turns blonde brown)
  diffuseColor.rgb = mix(diffuseColor.rgb, ${lit}, hairK);
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
  outgoingLight = mix(outgoingLight, a * L * mix(vec3(${SKIN.shade.join(', ')}), vec3(1.0), smoothstep(0.6, 1.0, L)), skinK); }
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
