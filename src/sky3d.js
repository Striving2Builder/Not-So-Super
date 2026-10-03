// Sky for the three.js flight view: a graded dome that follows the game clock (keyframed by the
// hour: a clear blue day over a pale warm horizon band, a sunset gradient from deep blue down to an
// orange band, a violet night), an inked comic sun disc by day and dusk, the moon with a halo only
// once it's properly night, matching sun/moon light for the cel shading, district-tinted fog, and
// decks of stylised comic cumulus: flat three-tone shapes with an ink outline and inner puff lines,
// always facing the camera (no paper-thin smears seen edge-on), one draw call.
//
// Colours here are DISPLAY values (what you see on screen): the dome writes them as they are, and
// the city's haze converges on `horizon` in the same space, so the horizon has no seam. At and
// below the horizon the dome is exactly `horizon`. `horizon` is also what the city's aerial
// perspective fades toward (buildings3d derives its haze colour from it): it is a mid-light blue
// by day, never white, so the far skyline keeps its value instead of bleaching out. SKY is the one
// place those colours live.
import * as THREE from 'three';
import { RNG } from './rng.js';

/**
 * Dome keyframes by the hour: [hour, zenith, mid, band (just above the horizon), horizon (= the
 * haze's end colour)]. Display colours, interpolated in order, wrapping at midnight.
 */
const SKY = [
  [4.6, '#04071a', '#141038', '#35275e', '#35275e'],  // night
  [5.6, '#1a2364', '#6a6cb4', '#ffb894', '#a48ea8'],  // dawn
  [7.4, '#1f58c0', '#5b98e0', '#f6e6cc', '#a9c4e4'],  // day: deep blue over a pale warm band, a mid-blue haze
  [17.2, '#1f58c0', '#5b98e0', '#f6e6cc', '#a9c4e4'],
  [18.4, '#2350ad', '#7098d6', '#ffd09a', '#aaaccc'], // golden hour
  [19.1, '#1e2b72', '#5e6cb8', '#ff9c5c', '#a98a9e'], // sunset: blue down to an orange band
  [19.8, '#0f1648', '#2e3482', '#c8706a', '#5e4a78'], // last light
  [20.6, '#04071a', '#141038', '#35275e', '#35275e'], // night
];
/** Sun/moon: disc radius (cos of the angle), the disc's highest drawn elevation (sin), day/dusk fills + rim. */
const SUN = { disc: 0.9988, maxUp: 0.42, day: ['#fffbe6', '#ffb340'], dusk: ['#ffdc5e', '#d8461e'], moonFrom: [0.82, 0.95], setBy: [0.55, 0.72] }; // moonFrom / setBy: the game's night value
/** Cloud decks (metres) and their three cel tones + ink, per time of day (display colours). */
const CLOUD = {
  count: 64, layers: [360, 520], size: [44, 250], aspect: [0.44, 0.62], variants: 8,
  big: { count: 10, size: [320, 520], y: [400, 440] }, // a few huge banks: the foreground at high patrol
  clear: [50, 60], // m: no cloud within clear[0] of the lens (box distance), faded in over clear[1]
  heroGap: 25,     // m past the camera→hero distance: nothing floats between the lens and her
  // [lit crown, body, shadowed base, ink]
  day: ['#ffffff', '#cddbf0', '#94a8cf', '#26304e'], dusk: ['#ffe6cc', '#cfa9c4', '#80689e', '#221a40'], night: ['#646aa0', '#383b72', '#23244c', '#07081a'],
};
const linear = (hex) => new THREE.Color().setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace); // as-is (display) values

const DOME_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const DOME_FS = `uniform vec3 top; uniform vec3 mid; uniform vec3 band; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 discDir; uniform vec3 sunCol; uniform vec3 sunRim;
uniform float sunK; uniform float moonK; varying vec3 vP;
void main(){
  vec3 p = normalize(vP);
  float h = max(p.y, 0.0);
  // the warm band hugs the horizon (warmer still toward the sun), then the mid tone, then the zenith
  vec2 sh = normalize(discDir.xz + 1e-5), ph = normalize(p.xz + 1e-5);
  float toSun = pow(max(dot(sh, ph), 0.0), 3.0) * sunK;
  vec3 c = mix(bottom, band, smoothstep(0.0, 0.035, h));
  c = mix(c, mid, smoothstep(0.03, mix(0.24, 0.32, toSun), h));
  c = mix(c, top, smoothstep(0.2, 0.8, h));
  c += (band - mid) * 0.35 * toSun * (1.0 - smoothstep(0.02, 0.3, h)) * step(0.0, band.r - mid.r);
  // the sun: a flat comic disc with a darker inked rim and a soft glow; anti-aliased by its own slope
  float d = dot(p, discDir), fw = fwidth(d) + 1e-6;
  c += sunCol * (pow(max(d, 0.0), 60.0) * 0.18 + pow(max(d, 0.0), 8.0) * 0.1) * sunK; // (a modest glow: a disc paler than its halo reads as a hollow ring)
  float disc = clamp((d - ${SUN.disc.toFixed(5)}) / fw + 0.5, 0.0, 1.0), core = clamp((d - ${(SUN.disc + 0.00025).toFixed(5)}) / fw + 0.5, 0.0, 1.0);
  c = mix(c, mix(sunRim, sunCol, core), disc * sunK);
  // the moon (night only): a pale disc + halo
  float m = dot(p, sunDir);
  c += vec3(0.55, 0.62, 0.9) * pow(max(m, 0.0), 60.0) * 0.35 * moonK;
  c = mix(c, vec3(0.92, 0.94, 1.0), clamp((m - 0.9994) / (fwidth(m) + 1e-6) + 0.5, 0.0, 1.0) * moonK);
  // night: a sparse field of stars, fading out toward the horizon glow
  if (moonK > 0.0 && p.y > 0.05) {
    vec3 q = p * 180.0, cell = floor(q);
    float rnd = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    if (rnd > 0.985) {
      vec3 f = fract(q) - 0.5 - (vec3(fract(rnd * 17.0), fract(rnd * 31.0), fract(rnd * 47.0)) - 0.5) * 0.5;
      c += vec3(0.9, 0.92, 1.0) * smoothstep(0.16, 0.0, length(f)) * smoothstep(0.05, 0.35, p.y) * moonK * (0.5 + 0.5 * fract(rnd * 91.0));
    }
  }
  if (vP.y <= 0.0) c = bottom; // at and below the horizon: exactly the horizon colour
  gl_FragColor = vec4(c, 1.0);
}`;

// Comic cumulus: billboards (corner offsets applied in view space), three flat cel tones + ink.
const BIG = '300.0'; // world size above which a cloud is one of the huge banks
const CLOUD_VS = `attribute vec2 corner; attribute vec2 size; attribute float variant; varying vec2 vUv; varying float vFade; varying float vDist; varying float vJit;
uniform vec3 sunDir; uniform vec2 clear; uniform float heroDist; uniform float bankK; uniform vec2 heroNdc; uniform float thin;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += corner * size;
  // lit from the sun/moon's side of the screen: the atlas lights its puffs from the upper left, so
  // mirror the shape when the light is on the right
  float flip = (viewMatrix * vec4(sunDir, 0.0)).x > 0.0 ? -1.0 : 1.0, v = floor(variant);
  vUv = vec2((corner.x * flip * 0.5 + 0.5 + mod(v, 4.0)) / 4.0, (corner.y * 0.5 + 0.5 + floor(v / 4.0)) * 0.5);
  vJit = fract(variant);
  vDist = -mv.z;
  // nothing near the lens: the distance from the camera to the cloud's box (its card's width
  // and height, and some depth), not its centre: a wide cloud passing under her still clears
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 q = max(abs(wp - cameraPosition) - vec3(size.x * 0.5, size.y * 0.5, size.x * 0.35), 0.0);
  float lo = max(clear.x, heroDist + ${CLOUD.heroGap.toFixed(1)});
  vFade = smoothstep(lo, lo + clear.y, length(q));
  // the patrol view thins the deck by dissolving whole clouds (a per-cloud dice roll), never by
  // turning them all see-through: a half-clear cloud over the city reads as a hollow ink outline
  float roll = fract(sin(dot(position.xz, vec2(0.0123, 0.0471))) * 43758.5453);
  vFade *= smoothstep(thin, thin + 0.12, roll);
  // nothing sits on her (the lower-left third at high patrol): fade clouds whose centre lands near
  // her, and keep the banks off to her right
  vec4 cc = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec2 n = cc.xy / max(cc.w, 1e-3);
  vFade *= mix(1.0, smoothstep(0.42, 0.56, length((n - heroNdc) * vec2(0.8, 1.0))), bankK); // (a short ramp: a half-faded cloud reads as a ghost)
  // the huge banks only exist for the high-patrol shot, seen from above, in the lower half of the
  // frame: from below or edge-on their ink outline would scrawl across the whole sky, and up top
  // they were cut off behind the minimap
  // and no ordinary cloud so close that it spans most of the frame (a wall of fill + ink overhead);
  // in the high views no big one up in the top half either (cut off behind the minimap and HUD)
  float halfW = size.x * 0.5 * projectionMatrix[0][0] / max(vDist, 1.0);
  if (size.x <= ${BIG}) vFade *= (1.0 - smoothstep(0.7, 1.1, halfW)) * (1.0 - bankK * smoothstep(0.12, 0.22, halfW) * smoothstep(0.1, 0.4, n.y));
  if (size.x > ${BIG}) vFade *= smoothstep(0.6, 0.9, bankK) * smoothstep(40.0, 90.0, cameraPosition.y - position.y) * smoothstep(0.15, 0.55, n.x - heroNdc.x) * (1.0 - smoothstep(-0.15, 0.2, n.y));
  // every fade is quick in the middle: a cloud lingering half see-through reads as a hollow ghost
  vFade = smoothstep(0.2, 0.8, vFade);
  gl_Position = projectionMatrix * mv;
}`;
const CLOUD_FS = `uniform sampler2D map; uniform vec3 lit; uniform vec3 shade; uniform vec3 under; uniform vec3 ink; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar; uniform float alpha;
varying vec2 vUv; varying float vFade; varying float vDist; varying float vJit;
void main(){
  vec4 t = texture2D(map, vUv);
  // every channel is a distance ramp (atlas: 0.5 on the edge, linear across ~16 texels), so its
  // screen-space slope gives the distance to the edge in pixels: crisp, anti-aliased edges at any
  // magnification, never the stair-steps of a magnified bitmap mask
  float fa = fwidth(t.a) + 1e-4, px = (t.a - 0.5) / fa, a = clamp(px + 0.5, 0.0, 1.0);
  if (a < 0.01 || vFade < 0.02) discard;
  float litK = clamp((t.r - 0.5) / (fwidth(t.r) + 1e-4) + 0.5, 0.0, 1.0);
  float shK = clamp((t.g - 0.5) / (fwidth(t.g) + 1e-4) + 0.5, 0.0, 1.0);
  // ink: a constant ~2 px band just inside the silhouette (the buildings' ink weight) + thinner
  // inner lines where the heads sit on the base row (B: distance to that line)
  // (a small far cloud keeps just its silhouette and lit crown: inner lines and the base shadow at a
  // few pixels across read as dirt; fa * 8 = atlas texels per screen pixel)
  float detail = 1.0 - smoothstep(2.5, 5.0, fa * 8.0);
  float lineK = (1.0 - smoothstep(0.6, 1.4, (1.0 - t.b) / (fwidth(t.b) + 1e-4))) * detail;
  shK *= mix(0.4, 1.0, detail);
  float inkK = max(1.0 - smoothstep(1.3, 2.3, px), lineK * 0.85);
  // far off the ink melts into the fill BEFORE the fill melts into the haze, and the cloud thins
  // out as a whole: the fill is about the horizon's colour, so fogging both alike left a hollow
  // ink outline hanging in the haze
  float fogK = smoothstep(fogNear, fogFar, vDist);
  inkK *= 1.0 - smoothstep(0.05, 0.4, fogK);
  // three flat cel tones: lit crowns, the body, a shadowed base
  vec3 c = mix(mix(shade, lit, litK), under, shK) * (0.97 + 0.06 * vJit);
  c = mix(c, ink, inkK);
  c = mix(c, fogCol, fogK * 0.85);
  gl_FragColor = vec4(c, a * alpha * vFade * (1.0 - 0.85 * smoothstep(0.3, 0.9, fogK)));
}`;

/**
 * One cloud shape as signed distances (texels, negative inside): a flat-bottomed row of base puffs
 * and a tier of heads, by kind. Returns the primitives; the atlas evaluates them per texel.
 */
function cloudShape(kind, r, CW, CH) {
  const base = CH - 30, row = [], heads = [];
  // the base row: overlapping puffs (spaced at ~1.1 radii, so they read as one body, never beads
  // on a string), their bottoms cut flat on the base line
  const puffs = (x0, x1, rr) => {
    const n = Math.max(2, Math.ceil((x1 - x0) / (((rr[0] + rr[1]) / 2) * 1.1)) + 1);
    for (let i = 0; i < n; i++) {
      const edge = i === 0 || i === n - 1, rad = r.range(rr[0], rr[1]) * (edge ? 0.8 : 1);
      row.push([x0 + (i / (n - 1)) * (x1 - x0) + r.range(-6, 6), base - rad * r.range(0.35, 0.6), rad, r.range(0.55, 0.85)]);
    }
  };
  const tier = (n, cx, spread, rr, lift) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0) + r.range(-12, 12), rad = r.range(rr[0], rr[1]);
      heads.push([x, base - lift - rad * 0.6 - r.range(0, 14), rad, r.range(0.3, 0.45)]);
    }
  };
  let x0, x1;
  if (kind === 'tower') { x0 = CW * r.range(0.16, 0.22); x1 = CW * r.range(0.78, 0.84); puffs(x0, x1, [30, 42]); tier(1 + r.int(0, 2), CW * r.range(0.44, 0.56), 120, [48, 66], 30); }
  else if (kind === 'wide') { x0 = CW * 0.09; x1 = CW * 0.91; puffs(x0, x1, [22, 32]); tier(2 + r.int(0, 1), CW * r.range(0.38, 0.62), 200, [28, 40], 12); }
  else if (kind === 'anvil') { x0 = CW * 0.24; x1 = CW * 0.76; puffs(x0, x1, [34, 44]); tier(1, CW * r.range(0.46, 0.54), 0, [74, 86], 34); tier(2, CW * 0.5, 170, [38, 48], 18); }
  else { x0 = CW * 0.3; x1 = CW * 0.7; puffs(x0, x1, [26, 34]); tier(1, CW * r.range(0.42, 0.58), 0, [40, 50], 14); } // small
  // keep the tallest head inside the cell (with room for the edge ramp)
  const top = Math.min(...[...row, ...heads].map(([, y, rad]) => y - rad));
  if (top < 14) { const k = (base - 14) / (base - top); for (const p of [...row, ...heads]) { p[1] = base - (base - p[1]) * k; p[2] *= k; } }
  const rb = Math.min(...row.map((p) => p[2]));
  return { row, heads, base, rect: [x0, base - rb * 0.9, x1, base] };
}

let cloudTex = null;
/**
 * 4×2 atlas of comic cumulus shapes (8 different silhouettes, 256×128 texels each), every channel
 * a signed-distance ramp so the shader can cut AA'd edges at any size. A = shape, R = lit crowns
 * (puffs shifted up-left), G = shadowed base (the shape minus its puffs lifted: scalloped undersides),
 * B = distance to the inner ink line where the heads sit on the base row.
 */
function cloudAtlas() {
  if (cloudTex) return cloudTex;
  // shapes are laid out in 512×256 design units and sampled every K units (the ramps make the
  // half-resolution atlas as smooth as the full one; it builds 4× faster)
  const CW = 512, CH = 256, K = 2, TW = (CW * 4) / K, TH = (CH * 2) / K, S = 8, L = 6, data = new Uint8Array(TW * TH * 4);
  const r = new RNG(4711), kinds = ['tower', 'wide', 'anvil', 'small', 'tower', 'wide', 'tower', 'small'];
  const ramp = (sd, k) => Math.max(0, Math.min(255, Math.round((0.5 - sd / (2 * k)) * 255)));
  const box = (x, y, b, dy = 0) => { const qx = Math.max(b[0] - x, x - b[2], 0), qy = Math.max(b[1] - dy - y, y - b[3] + dy, 0), ix = Math.max(b[0] - x, x - b[2]), iy = Math.max(b[1] - dy - y, y - b[3] + dy); return Math.sqrt(qx * qx + qy * qy) + Math.min(Math.max(ix, iy), 0); };
  for (let v = 0; v < 8; v++) {
    const { row, heads, rect, base } = cloudShape(kinds[v], r, CW, CH), all = [...row, ...heads.map((c) => [...c, 1])], M = 2 * S + 4, ox = (v % 4) * (CW / K), oy = Math.floor(v / 4) * (CH / K);
    // only puffs within reach of a texel can change it (past M texels every ramp is clamped): a
    // per-row list of nearby puffs keeps this to a few tens of ms
    for (let ty = 0; ty < CH / K; ty++) {
      const y = (ty + 0.5) * K, near = all.filter((c) => y > c[1] - c[2] * (1 + c[3]) - M && y < c[1] + c[2] + M);
      for (let tx = 0; tx < CW / K; tx++) {
        const x = (tx + 0.5) * K;
        let shape = box(x, y, rect), up = 1e9, lit = 1e9, hd = 1e9, bs = shape;
        for (let j = 0; j < near.length; j++) {
          const c = near[j], cx = c[0], cy = c[1], cr = c[2];
          if (x < cx - cr - M || x > cx + cr + M) continue;
          let u = x - cx, w = y - cy;
          const d = Math.sqrt(u * u + w * w) - cr;
          shape = Math.min(shape, d);
          if (c[4]) hd = Math.min(hd, d); else bs = Math.min(bs, d);
          w = y - cy + c[3] * cr; // (each puff lifted its own amount: a scalloped shadow, never a flat strip)
          up = Math.min(up, Math.sqrt(u * u + w * w) - cr * 0.96);
          u = x - cx + 0.14 * cr; w = y - cy + 0.22 * cr; // lit crowns: the puffs shifted up-left
          lit = Math.min(lit, Math.sqrt(u * u + w * w) - cr * 0.84);
        }
        if (shape > M) continue; // (outside: all four channels stay 0)
        shape = Math.max(shape, y - base); // the flat base
        const line = Math.max(Math.abs(hd), bs + 7); // the heads' outline, only where it crosses the base row
        // canvas y runs down, texture rows run up
        const i = ((TH - 1 - (oy + ty)) * TW + ox + tx) * 4;
        data[i] = ramp(Math.max(lit, shape), S);
        data[i + 1] = ramp(Math.max(shape, -up), S);
        data[i + 2] = Math.max(0, Math.min(255, Math.round((1 - line / (2 * L)) * 255)));
        data[i + 3] = ramp(shape, S);
      }
    }
  }
  cloudTex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat);
  cloudTex.colorSpace = THREE.NoColorSpace; // channels are distance ramps, not colours
  cloudTex.magFilter = THREE.LinearFilter; cloudTex.minFilter = THREE.LinearMipmapLinearFilter;
  cloudTex.generateMipmaps = true;
  cloudTex.needsUpdate = true;
  return cloudTex;
}

const _a = new THREE.Color(), _b = new THREE.Color(), _t = new THREE.Color(), _d = new THREE.Vector3(), _e = new THREE.Vector3();

export class Sky3D {
  constructor(scene, worldW, worldH) {
    this.scene = scene;
    /** The horizon's display colour (the city's haze converges on it). */
    this.horizon = new THREE.Color();
    this.uniforms = {
      top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, band: { value: new THREE.Color() }, bottom: { value: this.horizon },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, discDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunRim: { value: new THREE.Color() },
      sunK: { value: 0 }, moonK: { value: 0 },
    };
    const domeMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: DOME_VS, fragmentShader: DOME_FS,
    });
    domeMat.extensions = { derivatives: true };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), domeMat);
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.dome = dome; scene.add(dome);
    // lights for the toon bands
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404858, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0x2b2152, 300, 1600);
    this.addClouds(worldW, worldH);
  }

  addClouds(W, H) {
    const r = new RNG(9157), pos = [], corner = [], size = [], variant = [], idx = [];
    const B = CLOUD.big;
    for (let i = 0; i < CLOUD.count + B.count; i++) {
      const big = i >= CLOUD.count, cx = r.range(0, W), cz = r.range(0, H);
      // sizes skewed small (many little, few large), each with its own aspect
      const s = big ? r.range(B.size[0], B.size[1]) : CLOUD.size[0] + (CLOUD.size[1] - CLOUD.size[0]) * Math.pow(r.range(0, 1), 1.8);
      const y = big ? r.range(B.y[0], B.y[1]) : r.range(CLOUD.layers[0], CLOUD.layers[1]), asp = r.range(CLOUD.aspect[0], CLOUD.aspect[1]);
      // shape (integer part) + a small per-cloud tone jitter (fraction): no two neighbours stamped alike
      const v = (i % CLOUD.variants + Math.floor(r.range(0, 3)) * 3) % CLOUD.variants + r.range(0, 0.95), base = pos.length / 3;
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(cx, y, cz); corner.push(u, w); size.push(s, s * asp); variant.push(v); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 2));
    geo.setAttribute('variant', new THREE.Float32BufferAttribute(variant, 1));
    geo.setIndex(idx);
    this.cloudU = {
      map: { value: cloudAtlas() }, lit: { value: new THREE.Color() }, shade: { value: new THREE.Color() }, under: { value: new THREE.Color() }, ink: { value: new THREE.Color() },
      fogCol: { value: this.horizon }, sunDir: this.uniforms.sunDir, fogNear: { value: 600 }, fogFar: { value: 2400 }, alpha: { value: 1 }, clear: { value: new THREE.Vector2(...CLOUD.clear) }, heroDist: { value: 10 }, bankK: { value: 0 }, heroNdc: { value: new THREE.Vector2() }, thin: { value: 0 },
    };
    this.cloudMat = new THREE.ShaderMaterial({ uniforms: this.cloudU, vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, fog: false });
    this.cloudMat.extensions = { derivatives: true };
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 5;
    this.scene.add(this.clouds);
  }

  /** The dome's keyframe colours at hour hr: SKY column i (1 zenith, 2 mid, 3 band, 4 horizon) into out. */
  static grade(hr, i, out) {
    let k = SKY.findIndex((f) => f[0] > hr);
    if (k < 0) k = 0; // past the last key: wrap to the first (night)
    const a = SKY[(k + SKY.length - 1) % SKY.length], b = SKY[k];
    const span = (b[0] - a[0] + 24) % 24 || 24, f = ((hr - a[0] + 24) % 24) / span;
    return out.copy(linear(a[i])).lerp(_t.copy(linear(b[i])), f * f * (3 - 2 * f));
  }

  /**
   * clock: minutes since midnight; night: 0..1 (the game's own); tint: district colour to lean the
   * fog toward; eye: the camera (sun and dome follow it); patrol 0..1: the raised map view thins
   * the cloud deck under the camera; heroDist: camera→hero (m), clouds nearer than her (+ a margin) fade;
   * bankK 0..1: the high-patrol shot (shows the huge banks, clears clouds off her at heroNdc).
   */
  update(clock, night, tint, eye, fogFar, patrol = 0, heroDist = 10, bankK = 0, heroNdc = null) {
    const hr = (clock / 60) % 24;
    const near = Math.max(0, 1 - Math.min(Math.abs(hr - 19), Math.abs(hr - 6.5)) / 1.6); // how close to sunset/sunrise
    const dusk = near * (1 - night * 0.6), day = 1 - night;
    Sky3D.grade(hr, 1, this.uniforms.top.value);
    Sky3D.grade(hr, 2, this.uniforms.mid.value);
    Sky3D.grade(hr, 3, this.uniforms.band.value);
    Sky3D.grade(hr, 4, this.horizon);
    // fog (lit materials work in linear light): the horizon, leaning toward the district colour
    const fog = this.scene.fog;
    fog.color.copy(this.horizon).convertSRGBToLinear().lerp(_t.set(tint || '#808080'), 0.1 + 0.14 * night);
    fog.near = fogFar * (0.25 + 0.1 * patrol); fog.far = fogFar;
    // sun by day, moon by night: an arc across the southern sky (behind a north-flying camera)
    const a = ((hr - 6) / 12) * Math.PI;
    const arc = _e.set(-Math.cos(a), Math.max(0.02, Math.sin(a) * 0.9), 0.6).normalize();
    const dir = night > 0.5 ? _d.set(0.5, 0.42, 0.6).normalize() : _d.copy(arc);
    this.uniforms.sunDir.value.copy(dir);
    // the drawn sun sits a little lower than the light that shades the city (a comic sun you can
    // actually get in frame; the noon light stays high for the roofs), and it lingers on the
    // horizon into the sunset after the key light has gone over to the moon
    const up = Math.min(arc.y, SUN.maxUp), dd = this.uniforms.discDir.value.set(arc.x, 0, arc.z).normalize().multiplyScalar(Math.sqrt(1 - up * up));
    dd.y = up + 0.012;
    const S = dusk > 0.3 ? SUN.dusk : SUN.day;
    this.uniforms.sunCol.value.copy(linear(S[0])); this.uniforms.sunRim.value.copy(linear(S[1]));
    this.uniforms.sunK.value = 1 - Math.min(1, Math.max(0, (night - SUN.setBy[0]) / (SUN.setBy[1] - SUN.setBy[0])));
    this.uniforms.moonK.value = Math.min(1, Math.max(0, (night - SUN.moonFrom[0]) / (SUN.moonFrom[1] - SUN.moonFrom[0])));
    this.dome.position.copy(eye);
    this.sun.position.copy(eye).addScaledVector(dir, 500);
    this.sun.target.position.copy(eye);
    this.sun.color.set(night > 0.5 ? '#8fa6ff' : dusk > 0.3 ? '#ffc08a' : '#fff4e0');
    this.sun.intensity = 0.7 + 1.6 * day;
    this.hemi.color.set(night > 0.5 ? '#5a5ca8' : '#ffffff');
    this.hemi.groundColor.set(night > 0.5 ? '#2a1e3a' : '#505a68');
    this.hemi.intensity = 0.55 + 0.7 * day;
    // clouds: three cel tones + ink in the light of the hour; thinned in the patrol view
    const tone = (i) => _a.copy(linear(CLOUD.day[i])).lerp(_b.copy(linear(CLOUD.night[i])), night).lerp(_t.copy(linear(CLOUD.dusk[i])), near * (1 - night * 0.35));
    const U = this.cloudU;
    U.lit.value.copy(tone(0)); U.shade.value.copy(tone(1)); U.under.value.copy(tone(2)); U.ink.value.copy(tone(3));
    U.fogNear.value = fogFar * 0.5; U.fogFar.value = fogFar * 1.6;
    U.thin.value = 0.6 * patrol - 0.12; // (below 0: every cloud stays)
    U.heroDist.value = heroDist;
    U.bankK.value = bankK;
    if (heroNdc) U.heroNdc.value.copy(heroNdc);
  }
}
