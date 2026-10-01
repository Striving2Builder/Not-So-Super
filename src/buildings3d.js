// The 3D city's building kit: one facade/roof atlas, one cel shader that draws everything a chunk
// holds in ONE draw call (walls, roofs, screen-space ink lines, neon, signs, beacons), and the
// geometry helpers that stack it into towers (tiers, prisms, gables, roof kit).
//
// Vertex layout (indexed quads): position, aAux (face normal; for ink: the line's other end),
// uv (facade metres / sign atlas uv / ink side+weight), aCol (rgb tint + kind), aLit (rgb window
// light + atlas style). Kinds: 0 surface, 1 ink, 2 sign, 3 neon tube, 4 blinking beacon.
import * as THREE from 'three';
import { LOOK } from './look3d.js';

/** Metres per world unit (world = the 2D game's units). Scene: x = east, y = up, z = south. */
export const M = 0.5;

export const KIND = { surface: 0, ink: 1, sign: 2, neon: 3, beacon: 4 };
/** Atlas cells: five facades, three roofs. */
export const STYLE = { concrete: 0, glass: 1, brick: 2, deco: 3, industrial: 4, gravel: 5, tar: 6, helipad: 7 };
/** One facade tile = WIN.cols windows of WIN.w m by WIN.rows floors of WIN.floor m. */
export const WIN = { cols: 8, rows: 16, w: 4, floor: 3.6 };
const CELL = 32, CW = WIN.cols * CELL, CH = WIN.rows * CELL, CELLS = 8;

// ---------------------------------------------------------------- atlas
/**
 * Mask atlas, no alpha (canvas premultiplication would eat it): R = wall shade, G = glass, B = lit
 * window (facades) or paint (roofs). The shader tints walls per building and lights windows per
 * district, so one texture serves the whole city. Returns the per-cell averages too: far away
 * (or edge-on) the grid is swapped for them, which is what kills the window moire.
 */
function atlas() {
  const c = document.createElement('canvas');
  c.width = CW * CELLS; c.height = CH;
  const g = c.getContext('2d');
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rgb = (r, gg, b) => `rgb(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0})`;
  const rect = (x, y, w, h, r, gg, b) => { g.fillStyle = rgb(r, gg, b); g.fillRect(x, y, w, h); };
  // per floor: dark, some or most windows on (whole floors, so lit towers don't look stamped)
  const litFloor = (r, k) => { const busy = rnd(); return () => rnd() < busy * k; };
  const windows = (ox, wall, [mx, my], glass, k, extra) => {
    rect(ox, 0, CW, CH, wall, 0, 0);
    for (let r = 0; r < WIN.rows; r++) {
      const on = litFloor(r, k);
      for (let col = 0; col < WIN.cols; col++) {
        const x = ox + col * CELL, y = r * CELL;
        if (extra) extra(x, y, r, col);
        const lit = on();
        rect(x + mx, y + my, CELL - mx * 2, CELL - my * 2, 0.25, glass, lit ? 1 : 0);
      }
    }
  };
  // 0 concrete: punched windows, slab lines
  windows(0, 0.86, [7, 8], 1, 0.6, (x, y) => rect(x, y + CELL - 3, CELL, 3, 0.7, 0, 0));
  // 1 glass curtain wall: big panes, thin mullions, dark spandrel per floor
  windows(CW, 0.7, [1, 2], 1, 0.6, (x, y) => rect(x, y + CELL - 7, CELL, 7, 0.38, 0.55, 0));
  // 2 brick: small windows with a pale lintel
  windows(CW * 2, 0.8, [9, 9], 1, 0.55, (x, y) => { rect(x + 7, y + 6, CELL - 14, 3, 1, 0, 0); for (let i = 0; i < 4; i++) rect(x, y + i * 8 + 3, CELL, 1, 0.68, 0, 0); });
  // 3 art deco: bright vertical piers, dark spandrels, tall narrow windows (reads TALL)
  windows(CW * 3, 0.62, [10, 5], 1, 0.55, (x, y) => { rect(x, y, 6, CELL, 1, 0, 0); rect(x + CELL - 4, y, 4, CELL, 0.95, 0, 0); });
  // 4 industrial: corrugated, a strip window every fourth floor
  {
    const ox = CW * 4;
    for (let x = 0; x < CW; x += 4) rect(ox + x, 0, 2, CH, 0.92, 0, 0), rect(ox + x + 2, 0, 2, CH, 0.72, 0, 0);
    for (let r = 0; r < WIN.rows; r += 4) for (let col = 0; col < WIN.cols; col++) rect(ox + col * CELL + 2, r * CELL + 10, CELL - 4, 10, 0.25, 1, rnd() < 0.3 ? 1 : 0);
  }
  // 5 gravel roof (also leaves, lawns): speckle
  rect(CW * 5, 0, CW, CH, 0.72, 0, 0);
  for (let i = 0; i < 2600; i++) rect(CW * 5 + rnd() * CW, rnd() * CH, 3, 3, 0.5 + rnd() * 0.45, 0, 0);
  // 6 tar roof: dark membrane, seams, patches
  rect(CW * 6, 0, CW, CH, 0.42, 0, 0);
  for (let i = 0; i < 26; i++) rect(CW * 6 + rnd() * CW, rnd() * CH, 20 + rnd() * 50, 14 + rnd() * 40, 0.34 + rnd() * 0.14, 0, 0);
  for (let y = 0; y < CH; y += 64) rect(CW * 6, y, CW, 2, 0.28, 0, 0);
  // 7 helipad (uv 0..1 over the pad): dark deck, painted ring and H
  {
    const ox = CW * 7, cx = ox + CW / 2, cy = CH / 2;
    rect(ox, 0, CW, CH, 0.35, 0, 0);
    g.strokeStyle = rgb(0.35, 0, 1); g.lineWidth = 14;
    g.save(); g.translate(cx, cy); g.scale(1, 2); g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.restore(); g.stroke();
    g.fillStyle = rgb(0.35, 0, 1);
    g.fillRect(cx - 50, cy - 110, 24, 220); g.fillRect(cx + 26, cy - 110, 24, 220); g.fillRect(cx - 50, cy - 12, 100, 24);
    g.fillRect(ox + 6, 0, 6, CH); g.fillRect(ox + CW - 12, 0, 6, CH); g.fillRect(ox, 6, CW, 6); g.fillRect(ox, CH - 12, CW, 6);
  }
  // per-cell averages (linear-ish masks: these are data, not colours)
  const avg = [];
  const px = g.getImageData(0, 0, c.width, c.height).data;
  for (let k = 0; k < CELLS; k++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = 0; y < CH; y += 2) for (let x = k * CW; x < (k + 1) * CW; x += 2) { const i = (y * c.width + x) * 4; r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
    avg.push(new THREE.Vector3(r / n / 255, gg / n / 255, b / n / 255));
  }
  const t = new THREE.CanvasTexture(c);
  // masks stay linear data (no colour space); isotropic: edge-on walls fade to their flat tone anyway
  return { tex: t, avg };
}

// ---------------------------------------------------------------- the shader
const VERT = /* glsl */`
attribute vec3 aAux; attribute vec4 aCol; attribute vec4 aLit;
uniform vec2 res; uniform float dpr; uniform float uInkW;
// per-face values are flat: exact (they seed hashes) and cheaper than interpolating
varying vec2 vUv; flat varying vec3 vCol; flat varying vec3 vLit; flat varying vec3 vN; varying vec3 vW;
flat varying float vStyle; flat varying float vKind;
void main() {
  vKind = floor(aCol.a * 255. + .5); vStyle = floor(aLit.a * 255. + .5);
  vUv = uv; vCol = aCol.rgb; vLit = aLit.rgb; vN = aAux;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vW = wp.xyz;
  vec4 mv = viewMatrix * wp;
  if (vKind == 1.) {
#ifdef FAR
    gl_Position = vec4(0., 0., 2., 1.); return; // far chunks: the haze does the outlining
#endif
    // ink: a screen-space quad along the edge, thick near and thin far (clipped at the near plane)
    vec4 mo = viewMatrix * (modelMatrix * vec4(aAux, 1.));
    const float NZ = -0.4;
    if (mv.z > NZ && mo.z > NZ) { gl_Position = vec4(0., 0., 2., 1.); return; }
    if (mv.z > NZ) mv.xyz = mix(mo.xyz, mv.xyz, (NZ - mo.z) / (mv.z - mo.z));
    else if (mo.z > NZ) mo.xyz = mix(mv.xyz, mo.xyz, (NZ - mv.z) / (mo.z - mv.z));
    float d = -mv.z;
    mv.xyz *= 1. - min(0.003 + 0.25 / d, 0.2); // ride on top of the faces it borders
    vec4 c0 = projectionMatrix * mv, c1 = projectionMatrix * mo;
    vec2 s = (c1.xy / c1.w - c0.xy / c0.w) * res;
    vec2 dir = dot(s, s) > 1e-8 ? normalize(s) : vec2(1., 0.);
    float w = uInkW * dpr * uv.y * mix(1., 0.3, smoothstep(25., 650., d));
    c0.xy += vec2(-dir.y, dir.x) * uv.x * max(w, 0.9) / res * c0.w;
    gl_Position = c0;
    return;
  }
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform sampler2D uAtlas; uniform sampler2D uSigns;
uniform vec3 uAvg[8];
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uAmbUp; uniform vec3 uAmbDn; uniform vec3 uSky; uniform vec3 uInk;
uniform float uNight; uniform float uLit; uniform float uTime; uniform float uFogK; uniform float dpr;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
// per-face values are flat: exact (they seed hashes) and cheaper than interpolating
varying vec2 vUv; flat varying vec3 vCol; flat varying vec3 vLit; flat varying vec3 vN; varying vec3 vW;
flat varying float vStyle; flat varying float vKind;
float h11(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float dist = length(vW - cameraPosition);
  vec3 col = vec3(0.), emi = vec3(0.);
  if (vKind == 1.) {
    col = uInk;
  } else if (vKind == 2.) {
    vec3 s = texture2D(uSigns, vUv).rgb; // r tube core, g glow/letters, b board
    col = vec3(0.03, 0.02, 0.05) * s.b;
    emi = (vCol * s.g * 0.85 + mix(vCol, vec3(1.), 0.5) * s.r * 0.6) * mix(0.8, 1.15, uNight);
  } else if (vKind == 3.) {
    emi = vCol * mix(0.9, 1.3, uNight);
  } else if (vKind == 4.) {
    emi = vCol * (0.25 + 2.5 * step(0.6, fract(uTime * 0.7 + vUv.x)));
  } else {
    bool roof = vStyle > 4.5;
    vec2 cu = vUv * vec2(${WIN.cols}., ${WIN.rows}.);
    vec2 fw = fwidth(cu);
    vec3 avg = uAvg[int(vStyle)];
    // past ~2-3 px per window the grid becomes the cell's flat tone plus lit floor bands
    float band = step(0.6, h11(floor(cu.y / 3.) * 7.13 + floor(vUv.x) * 3.7 + dot(floor(vCol * 255. + 0.5), vec3(0.97, 0.57, 0.23))));
    vec3 far = vec3(avg.r, avg.g, roof ? avg.b : mix(band * avg.b * 2.2, avg.b, smoothstep(0.15, 0.4, fw.y)));
    vec3 m = far;
#ifndef FAR
    float k = smoothstep(0.12, 0.28, max(fw.x, fw.y));
    if (k < 0.999) {
      vec2 sc = vec2(0.96, 0.98) / vec2(8., 1.);
      vec2 u = vStyle == 7. ? clamp(vUv, 0.01, 0.99) : fract(vUv);
      vec2 g = vUv * sc;
      // explicit isotropic LOD from the unwrapped uv (fract() seams would spike the mip otherwise)
      vec2 gx = dFdx(g) * vec2(${CW * CELLS}., ${CH}.), gy = dFdy(g) * vec2(${CW * CELLS}., ${CH}.);
      float lod = 0.5 * log2(max(dot(gx, gx), dot(gy, gy)));
      m = mix(textureLod(uAtlas, u * sc + vec2((0.02 + vStyle) / 8., 0.01), lod).rgb, far, k);
    }
#endif
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float ndl = dot(N, uKeyDir);
    float litK = smoothstep(0.0, 0.07, ndl);
    vec3 amb = mix(uAmbDn, uAmbUp, N.y * 0.5 + 0.5);
    vec3 light = amb + uKeyCol * litK * (N.y > 0.5 ? 1.0 : 0.85);
    vec3 wall = vCol * m.r * light;
    if (roof) {
      col = mix(wall, vec3(0.9, 0.62, 0.05) * light, m.b);
    } else {
      // glass: dark by night, mirrors the sky (more at grazing angles) by day; curtain walls most
      float fres = pow(1. - max(dot(N, V), 0.), 2.);
      vec3 glass = mix(vec3(0.03, 0.035, 0.055), uSky * 0.8, (1. - uNight * 0.85) * ((vStyle == 1. ? 0.4 : 0.2) + 0.45 * fres));
      col = mix(wall, glass * (0.6 + 0.4 * litK), m.g);
      col *= mix(0.42, 1., smoothstep(0., 45., vW.y)); // canyon floors are darker
      emi = vLit * m.b * uLit;
    }
#ifndef FAR
    // halftone dots in the shade, close up only: fixed dot size (shrinking dots turn to salt),
    // the strength fades out instead
    float sh = (1. - litK) * (1. - m.g) * (1. - smoothstep(50., 120., dist));
    if (sh > 0.01) {
      vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / (5. * dpr);
      col *= 1. - 0.25 * sh * (1. - smoothstep(0.3, 0.42, length(fract(p) - 0.5) * 1.414));
    }
#endif
  }
#ifdef TONE_MAPPING
  col = toneMapping(col);
#endif
  gl_FragColor = linearToOutputTexel(vec4(col + emi, 1.));
  // haze: distance fog, thicker toward the ground, so the towers rise out of it
  float d = dist * uFogK;
  float f = smoothstep(fogNear, fogFar, d);
  f = clamp(f + (1. - smoothstep(0., 200., vW.y)) * smoothstep(fogNear * 0.3, fogFar * 1.1, d) * 0.55, 0., 1.);
  if (vKind >= 2.) f *= 0.7; // neon cuts through the haze
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, f);
}`;

/**
 * The building materials: `near` (atlas + halftone), `far` (flat tones and lit bands, no texture
 * fetch: the cheap one for the many far pixels) and `make(fogK)` for always-on landmarks.
 * All share one uniforms set; update it once per frame with `light()`.
 */
export class CityLook {
  constructor(signTex) {
    const A = atlas();
    this.atlas = A.tex;
    const U = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(U, {
      uAtlas: { value: A.tex }, uSigns: { value: signTex }, uAvg: { value: A.avg },
      uKeyDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() }, uKeyCol: { value: new THREE.Color(1, 1, 1) },
      uAmbUp: { value: new THREE.Color(0.4, 0.4, 0.5) }, uAmbDn: { value: new THREE.Color(0.2, 0.2, 0.3) },
      uSky: { value: new THREE.Color(0.6, 0.7, 0.9) }, uInk: { value: new THREE.Color(0x120c14) },
      uNight: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 }, uInkW: { value: 2.6 },
      res: LOOK.res, dpr: LOOK.dpr,
    });
    this.U = U;
    this.near = this.make(1);
    this.far = this.make(1, { FAR: 1 });
  }

  make(fogK, defines = {}) {
    const uniforms = { ...this.U, uFogK: { value: fogK } };
    return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, defines, fog: true });
  }

  /** Per frame: key light + ambient from the sky's own lights, sky colour for glass, night. */
  light(sun, hemi, fog, night, time) {
    const U = this.U;
    if (sun) {
      U.uKeyDir.value.copy(sun.position).sub(sun.target.position).normalize();
      U.uKeyCol.value.copy(sun.color).multiplyScalar(0.12 + 0.36 * sun.intensity);
    }
    if (hemi) {
      const k = 0.75 * hemi.intensity;
      U.uAmbUp.value.copy(hemi.color).multiplyScalar(k);
      U.uAmbDn.value.copy(hemi.groundColor).multiplyScalar(k * 1.2).lerp(U.uAmbUp.value, 0.25);
    }
    if (fog) U.uSky.value.copy(fog.color);
    U.uNight.value = night;
    U.uLit.value = 0.85 * Math.min(1, Math.max(0, (night - 0.15) * 1.6));
    U.uTime.value = time;
  }
}

// ---------------------------------------------------------------- geometry
const _t = new THREE.Color(), _l = new THREE.Color();
const b255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Collects one chunk's vertices (indexed quads) in the layout above. */
export class Builder {
  /** lite: the far-LOD build (no ink, callers skip small detail). */
  constructor(lite = false) { this.lite = lite; this.pos = []; this.aux = []; this.uv = []; this.col = []; this.lit = []; this.idx = []; this.n = 0; }

  /** tint/lit: THREE.Color or hex; style: atlas cell; kind: KIND.* */
  v(p, aux, u, w, tint, kind, lit, style) {
    this.pos.push(p[0], p[1], p[2]); this.aux.push(aux[0], aux[1], aux[2]); this.uv.push(u, w);
    this.col.push(b255(tint.r), b255(tint.g), b255(tint.b), kind);
    this.lit.push(b255(lit.r), b255(lit.g), b255(lit.b), style);
    return this.n++;
  }

  /** a b c d counter-clockwise seen from the front; uvs: [[u,v] x4]. */
  quad(a, b, c, d, nrm, uvs, tint, lit, style, kind = 0) {
    const i = this.v(a, nrm, uvs[0][0], uvs[0][1], tint, kind, lit, style);
    this.v(b, nrm, uvs[1][0], uvs[1][1], tint, kind, lit, style);
    this.v(c, nrm, uvs[2][0], uvs[2][1], tint, kind, lit, style);
    this.v(d, nrm, uvs[3][0], uvs[3][1], tint, kind, lit, style);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  tri(a, b, c, nrm, tint, lit, style, uvs = UV0) {
    const i = this.v(a, nrm, uvs[0][0], uvs[0][1], tint, 0, lit, style);
    this.v(b, nrm, uvs[1][0], uvs[1][1], tint, 0, lit, style);
    this.v(c, nrm, uvs[2][0], uvs[2][1], tint, 0, lit, style);
    this.idx.push(i, i + 1, i + 2);
  }

  /** An ink line p→q (screen-space quad, always front-facing); w scales the weight. */
  ink(p, q, w = 1) {
    // none far away (the far shader drops it anyway), none on tiny parts (HVAC, legs): saves triangles
    if (this.lite || Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 2.5) return;
    const i = this.v(p, q, 1, w, BLACK, 1, BLACK, 0);
    this.v(p, q, -1, w, BLACK, 1, BLACK, 0);
    this.v(q, p, 1, w, BLACK, 1, BLACK, 0);
    this.v(q, p, -1, w, BLACK, 1, BLACK, 0);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.aux, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(this.col), 4, true));
    g.setAttribute('aLit', new THREE.BufferAttribute(new Uint8Array(this.lit), 4, true));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
const BLACK = new THREE.Color(0, 0, 0);
const UV0 = [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]];

/** Surface look of a part: wall tint, window light, facade style, roof tint + style, uv offsets. */
export function look(tint, lit, style, roofTint = tint, roofStyle = STYLE.gravel, uoff = 0, voff = 0) {
  return { tint: new THREE.Color(tint), lit: new THREE.Color(lit), style, roofTint: new THREE.Color(roofTint), roofStyle, uoff, voff };
}

const fu = (len) => len / (WIN.w * WIN.cols), fv = (y) => y / (WIN.floor * WIN.rows);

/**
 * A box tier in metres: walls (facade uv continuous in height, so floors line up across tiers),
 * optional roof, ink on every edge. roof: false | true | 'pad' (helipad uv over the whole roof).
 */
export function box(B, x0, z0, x1, z1, bot, top, L, { roof = true, ink = 1, walls = true } = {}) {
  if (walls) {
    const v0 = L.voff + fv(bot), v1 = L.voff + fv(top);
    const face = (a, b, nrm, len, u0) => {
      const u1 = u0 + fu(len);
      B.quad([a[0], bot, a[1]], [b[0], bot, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], nrm, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], L.tint, L.lit, L.style);
    };
    const u = L.uoff;
    face([x0, z1], [x1, z1], [0, 0, 1], x1 - x0, u);
    face([x1, z1], [x1, z0], [1, 0, 0], z1 - z0, u + 0.25);
    face([x1, z0], [x0, z0], [0, 0, -1], x1 - x0, u + 0.5);
    face([x0, z0], [x0, z1], [-1, 0, 0], z1 - z0, u + 0.75);
  }
  if (roof) {
    const pad = roof === 'pad';
    const s = pad ? [1, 1] : [1 / 32, 1 / 64];
    const uv = pad ? [[0, 1], [1, 1], [1, 0], [0, 0]] : [[x0 * s[0], z1 * s[1]], [x1 * s[0], z1 * s[1]], [x1 * s[0], z0 * s[1]], [x0 * s[0], z0 * s[1]]];
    B.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0], [0, 1, 0], uv, L.roofTint, L.lit, pad ? STYLE.helipad : L.roofStyle);
  }
  if (ink) {
    const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      B.ink([a[0], top, a[1]], [b[0], top, b[1]], ink);
      if (walls) B.ink([a[0], bot, a[1]], [a[0], top, a[1]], ink);
    }
  }
  return top;
}

/** n-sided prism round (cx, cz), radius r → rTop (0 = cone/pyramid). Facade uv wraps it. */
export function prism(B, cx, cz, r, rTop, bot, top, n, L, { cap = true, ink = 1, rot = 0, roofTint = null } = {}) {
  const P = [];
  for (let i = 0; i <= n; i++) { const a = rot + (i / n) * Math.PI * 2; P.push([Math.cos(a), Math.sin(a)]); }
  const circ = 2 * Math.PI * r, v0 = L.voff + fv(bot), v1 = L.voff + fv(top), slope = (r - rTop) / Math.max(0.01, top - bot);
  for (let i = 0; i < n; i++) {
    const [ca, sa] = P[i], [cb, sb] = P[i + 1], am = rot + ((i + 0.5) / n) * Math.PI * 2;
    const nrm = new THREE.Vector3(Math.cos(am), slope, Math.sin(am)).normalize();
    const u0 = L.uoff + fu((i / n) * circ), u1 = L.uoff + fu(((i + 1) / n) * circ);
    const a0 = [cx + ca * r, bot, cz + sa * r], b0 = [cx + cb * r, bot, cz + sb * r], b1 = [cx + cb * rTop, top, cz + sb * rTop], a1 = [cx + ca * rTop, top, cz + sa * rTop];
    // wound outward: (b0, a0, a1, b1) faces away from the axis
    B.quad(b0, a0, a1, b1, [nrm.x, nrm.y, nrm.z], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], L.tint, L.lit, L.style);
    if (ink && n <= 10) B.ink(a0, a1, ink);
    if (ink && rTop > 0) B.ink(a1, b1, ink);
  }
  if (cap && rTop > 0) {
    const t = roofTint ? _t.set(roofTint) : L.roofTint;
    for (let i = 0; i < n; i++) {
      const [ca, sa] = P[i], [cb, sb] = P[i + 1];
      B.tri([cx, top, cz], [cx + cb * rTop, top, cz + sb * rTop], [cx + ca * rTop, top, cz + sa * rTop], [0, 1, 0], t, L.lit, L.roofStyle);
    }
  }
}

/** Gabled house/barn: walls to the eaves, a pitched roof along the long side. */
export function gable(B, x0, z0, x1, z1, eave, ridge, L) {
  box(B, x0, z0, x1, z1, 0, eave, L, { roof: false });
  const alongX = x1 - x0 >= z1 - z0, rt = L.roofTint, st = STYLE.tar;
  const s = 1 / 8;
  if (alongX) {
    const zm = (z0 + z1) / 2, ny = (z1 - z0) / 2, nz = ridge - eave, l = Math.hypot(ny, nz);
    B.quad([x0, eave, z1], [x1, eave, z1], [x1, ridge, zm], [x0, ridge, zm], [0, ny / l, nz / l], [[x0 * s, 0], [x1 * s, 0], [x1 * s, 1], [x0 * s, 1]], rt, L.lit, st);
    B.quad([x1, eave, z0], [x0, eave, z0], [x0, ridge, zm], [x1, ridge, zm], [0, ny / l, -nz / l], [[x1 * s, 0], [x0 * s, 0], [x0 * s, 1], [x1 * s, 1]], rt, L.lit, st);
    B.tri([x1, eave, z1], [x1, eave, z0], [x1, ridge, zm], [1, 0, 0], L.tint, L.lit, L.style);
    B.tri([x0, eave, z0], [x0, eave, z1], [x0, ridge, zm], [-1, 0, 0], L.tint, L.lit, L.style);
    B.ink([x0, ridge, zm], [x1, ridge, zm]);
    for (const x of [x0, x1]) { B.ink([x, eave, z0], [x, ridge, zm]); B.ink([x, eave, z1], [x, ridge, zm]); }
  } else {
    const xm = (x0 + x1) / 2, nx = (x1 - x0) / 2, nz = ridge - eave, l = Math.hypot(nx, nz);
    B.quad([x1, eave, z1], [x1, eave, z0], [xm, ridge, z0], [xm, ridge, z1], [nz / l, nx / l, 0], [[z1 * s, 0], [z0 * s, 0], [z0 * s, 1], [z1 * s, 1]], rt, L.lit, st);
    B.quad([x0, eave, z0], [x0, eave, z1], [xm, ridge, z1], [xm, ridge, z0], [-nz / l, nx / l, 0], [[z0 * s, 0], [z1 * s, 0], [z1 * s, 1], [z0 * s, 1]], rt, L.lit, st);
    B.tri([x0, eave, z1], [x1, eave, z1], [xm, ridge, z1], [0, 0, 1], L.tint, L.lit, L.style);
    B.tri([x1, eave, z0], [x0, eave, z0], [xm, ridge, z0], [0, 0, -1], L.tint, L.lit, L.style);
    B.ink([xm, ridge, z0], [xm, ridge, z1]);
    for (const z of [z0, z1]) { B.ink([x0, eave, z], [xm, ridge, z]); B.ink([x1, eave, z], [xm, ridge, z]); }
  }
}

/** A comic lollipop tree: a squat double pyramid of leaves. */
export function tree(B, x, z, r, h, tint) {
  const L = TREE_L; L.tint.set(tint); L.roofTint.copy(L.tint).multiplyScalar(1.15);
  const mid = h * 0.55;
  prism(B, x, z, r, r * 0.15, mid, h, 6, L, { cap: false, ink: 0 });
  prism(B, x, z, r * 0.2, r, h * 0.2, mid, 6, L, { cap: false, ink: 0 });
}
const TREE_L = look('#3a7a3a', '#000', STYLE.gravel, '#3a7a3a', STYLE.gravel);

/** A thin mast with a blinking beacon on top (antennas, spires). */
export function mast(B, x, z, bot, top, r = 0.35, beacon = '#ff3030', tint = '#3a3d44') {
  const L = MAST_L; L.tint.set(tint); L.roofTint.set(tint);
  prism(B, x, z, r, r * 0.5, bot, top, 4, L, { ink: 0.6, cap: false });
  if (beacon) lamp(B, x, top + 0.6, z, 0.9, beacon, KIND.beacon, (x * 0.37 + z * 0.11) % 1);
}
const MAST_L = look('#3a3d44', '#000', STYLE.industrial);

/** A glowing lamp: a small camera-independent diamond (beacons, lit tips, signal lights). */
export function lamp(B, x, y, z, s, colour, kind = KIND.neon, phase = 0) {
  _l.set(colour);
  const p = [[x, y + s, z], [x + s, y, z], [x, y, z + s], [x - s, y, z], [x, y, z - s], [x, y - s, z]];
  const f = [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]];
  for (const [a, b, c] of f) {
    const i = B.v(p[a], [0, 1, 0], phase, 0, _l, kind, _l, 0);
    B.v(p[b], [0, 1, 0], phase, 0, _l, kind, _l, 0);
    B.v(p[c], [0, 1, 0], phase, 0, _l, kind, _l, 0);
    B.idx.push(i, i + 1, i + 2);
  }
}

/** Neon tubes: a glowing strip round a footprint at height y, just proud of the walls. */
export function neonRing(B, x0, z0, x1, z1, y, colour, t = 0.7) {
  _l.set(colour);
  const o = 0.15, X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, y0 = y - t / 2, y1 = y + t / 2;
  B.quad([X0, y0, Z1], [X1, y0, Z1], [X1, y1, Z1], [X0, y1, Z1], [0, 0, 1], UVQ, _l, _l, 0, KIND.neon);
  B.quad([X1, y0, Z1], [X1, y0, Z0], [X1, y1, Z0], [X1, y1, Z1], [1, 0, 0], UVQ, _l, _l, 0, KIND.neon);
  B.quad([X1, y0, Z0], [X0, y0, Z0], [X0, y1, Z0], [X1, y1, Z0], [0, 0, -1], UVQ, _l, _l, 0, KIND.neon);
  B.quad([X0, y0, Z0], [X0, y0, Z1], [X0, y1, Z1], [X0, y1, Z0], [-1, 0, 0], UVQ, _l, _l, 0, KIND.neon);
}
/** A vertical neon tube up a corner (x, z) from y0 to y1. */
export function neonPost(B, x, z, y0, y1, colour, t = 0.6) {
  _l.set(colour);
  const h = t / 2;
  B.quad([x - h, y0, z + h], [x + h, y0, z + h], [x + h, y1, z + h], [x - h, y1, z + h], [0, 0, 1], UVQ, _l, _l, 0, KIND.neon);
  B.quad([x + h, y0, z + h], [x + h, y0, z - h], [x + h, y1, z - h], [x + h, y1, z + h], [1, 0, 0], UVQ, _l, _l, 0, KIND.neon);
  B.quad([x + h, y0, z - h], [x - h, y0, z - h], [x - h, y1, z - h], [x + h, y1, z - h], [0, 0, -1], UVQ, _l, _l, 0, KIND.neon);
  B.quad([x - h, y0, z - h], [x - h, y0, z + h], [x - h, y1, z + h], [x - h, y1, z - h], [-1, 0, 0], UVQ, _l, _l, 0, KIND.neon);
}
const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
