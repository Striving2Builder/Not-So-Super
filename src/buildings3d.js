// The 3D city's building kit: analytic facades + a roof atlas, one cel shader that draws everything a chunk
// holds in ONE draw call (walls, roofs, screen-space ink lines, neon, signs, beacons), and the
// geometry helpers that stack it into towers (tiers, prisms, gables, roof kit).
//
// Vertex layout (indexed quads): position, aAux (face normal; for ink: the line's other end),
// uv (facade metres / sign atlas uv / ink side+weight), aCol (rgb tint + kind), aLit (rgb window
// light + surface style). Kinds: 0 surface, 1 ink, 2 sign, 3 neon tube, 4 blinking beacon.
import * as THREE from 'three';
import { LOOK } from './look3d.js';

/** Metres per world unit (world = the 2D game's units). Scene: x = east, y = up, z = south. */
export const M = 0.5;

export const KIND = { surface: 0, ink: 1, sign: 2, neon: 3, beacon: 4 };
/** Surface styles: five facades (drawn in the shader), three roofs (the roof atlas). */
export const STYLE = { concrete: 0, glass: 1, brick: 2, deco: 3, industrial: 4, gravel: 5, tar: 6, helipad: 7 };
/** One facade tile = WIN.cols windows of WIN.w m by WIN.rows floors of WIN.floor m. */
export const WIN = { cols: 8, rows: 16, w: 3, floor: 3.5 };
const CELL = 32, CW = WIN.cols * CELL, CH = WIN.rows * CELL;

// ---------------------------------------------------------------- atlas
/**
 * The roof atlas (the facades are analytic: see `facade` in the shader), no alpha: R = shade,
 * B = paint. Three cells side by side: gravel (also leaves, lawns), tar, helipad.
 */
function atlas() {
  const c = document.createElement('canvas');
  c.width = CW * 3; c.height = CH;
  const g = c.getContext('2d');
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rgb = (r, gg, b) => `rgb(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0})`;
  const rect = (x, y, w, h, r, gg, b) => { g.fillStyle = rgb(r, gg, b); g.fillRect(x, y, w, h); };
  // gravel: speckle
  rect(0, 0, CW, CH, 0.72, 0, 0);
  for (let i = 0; i < 2600; i++) rect(rnd() * CW, rnd() * CH, 3, 3, 0.5 + rnd() * 0.45, 0, 0);
  // tar: dark membrane, seams, patches
  rect(CW, 0, CW, CH, 0.42, 0, 0);
  for (let i = 0; i < 26; i++) rect(CW + rnd() * CW, rnd() * CH, 20 + rnd() * 50, 14 + rnd() * 40, 0.34 + rnd() * 0.14, 0, 0);
  for (let y = 0; y < CH; y += 64) rect(CW, y, CW, 2, 0.28, 0, 0);
  // helipad (uv 0..1 over the pad): dark deck, painted ring and H
  {
    const ox = CW * 2, cx = ox + CW / 2, cy = CH / 2;
    rect(ox, 0, CW, CH, 0.35, 0, 0);
    g.strokeStyle = rgb(0.35, 0, 1); g.lineWidth = 14;
    g.save(); g.translate(cx, cy); g.scale(1, 2); g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.restore(); g.stroke();
    g.fillStyle = rgb(0.35, 0, 1);
    g.fillRect(cx - 50, cy - 110, 24, 220); g.fillRect(cx + 26, cy - 110, 24, 220); g.fillRect(cx - 50, cy - 12, 100, 24);
    g.fillRect(ox + 6, 0, 6, CH); g.fillRect(ox + CW - 12, 0, 6, CH); g.fillRect(ox, 6, CW, 6); g.fillRect(ox, CH - 12, CW, 6);
  }
  // masks stay linear data (no colour space); roofs are seen at a slant from altitude: a little anisotropy
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 2;
  return t;
}

// ---------------------------------------------------------------- the shader
/** Contact shade (AO) at the foot of walls: k = strength, h = falloff height in metres. */
const AO = { k: 0.5, h: 6.5 };
/**
 * Haze reach: far = max(fog far, camera height x perAlt), capped under the camera's far plane;
 * it starts at near x far, or nearAlt x the camera's height when that's further (from high patrol
 * the nearest ground is already ~600 m off: the haze began under her and swallowed the whole city).
 */
export const HAZE = { perAlt: 7, max: 4200, near: 0.1, nearAlt: 1.4, low: 0.48, lowDn: [0.015, 0.2] };
/** Key vs ambient: a clear lit / raking / shadow split on every tower, day and dusk too. */
const KEY = { key: 1.4, amb: 0.86, shade: [0.74, 0.8, 0.98] };
const _cool = new THREE.Color(0.93, 0.98, 1.1);
/**
 * Aerial perspective shared by every city material (buildings, ground, sea, street lights): a cool,
 * desaturated haze that thickens toward the ground and converges on the sky dome's own horizon
 * colour at uHazeFar, so the world never ends in an edge, a plate or a fog wall. The air itself
 * grades with the view ray: looking level it is the horizon's colour, looking down it is the darker
 * ground haze (`uHazeLow`, HAZE.low of the haze's value), so from altitude the far ground keeps
 * its value and grades up into the horizon instead of ending in one flat pale plate.
 */
export const HAZE_GLSL = /* glsl */`
uniform vec3 uHazeCol; uniform vec3 uHorizon; uniform vec3 uHazeLow; uniform float uHazeNear; uniform float uHazeFar;
uniform vec3 uSunAir; uniform vec2 uSunDirH;
// the view ray (world, normalised), set by each shader that knows it; zero = no sun tint
vec3 gRay = vec3(0.);
// the air's colour at haze amount f along a ray dipping dn (sine) below the horizon. Toward the
// sun the far air takes the dome's own warm glow (uSunAir: the same term the sky adds just above
// the horizon, so haze and sky still meet without an edge); away from it it stays cool
vec3 airAt(float f, float dn) {
  vec3 a = mix(uHazeCol, uHorizon, smoothstep(0.35, 1., f)), lo = uHazeLow;
  if (uSunAir.r > 0.002 && f > 0.2) { // (skipped at night and in the near, thin haze)
    float lw = max(dot(gRay.xz, uSunDirH), 0.); lw *= lw * lw; // (gRay.xz ~ unit where it matters: far, level rays)
    a += uSunAir * lw * smoothstep(0.2, 1., f); lo += uSunAir * lw * 0.35 * f;
  }
  return mix(a, lo, smoothstep(${HAZE.lowDn[0]}, ${HAZE.lowDn[1]}, dn));
}
// pulp grade: saturation and value contrast up (comic primaries), applied before the haze
vec3 pulp(vec3 c) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.35);
  return clamp((c - 0.5) * 1.12 + 0.5 + 0.02, 0., 1.);
}
vec3 haze(vec3 c, float d, float y, float k) {
  // aerial perspective in three moves, each starting a little later than the last: colour drains
  // first (distant towers go grey-blue), then values flatten toward the air's own value (darks lift,
  // lights dim: the far city loses contrast), then the colour itself becomes the air. It works over
  // ~40-70% of the draw distance; the near city keeps full punch. Shapes keep their edges because
  // every face moves by the same rule (face-to-face contrast shrinks, never flips).
  float t = clamp((d - uHazeNear) / (uHazeFar - uHazeNear), 0., 1.);
  float f = t * t * (3. - 2. * t);
  f = clamp(f + (1. - smoothstep(0., 160., y)) * t * 0.2, 0., 1.) * k; // thicker over the ground
  vec3 air = airAt(f, clamp((cameraPosition.y - y) / max(d, 1.), 0., 1.));
  const vec3 LW = vec3(0.299, 0.587, 0.114);
  float l = dot(c, LW), la = dot(air, LW);
  c = mix(c, vec3(l), smoothstep(0., 0.75, f) * 0.72);  // saturation
  c += (la - l) * 0.55 * f;                              // contrast (value toward the air)
  return mix(c, air, f * sqrt(f));                       // colour
}`;

const VERT = /* glsl */`
attribute vec3 aAux; attribute vec4 aCol; attribute vec4 aLit;
uniform vec2 res; uniform float dpr; uniform float uInkW; uniform float uNeonFar; uniform float uNight; uniform float uLit;
// per-face values are flat: exact (they seed hashes) and cheaper than interpolating
varying vec2 vUv; flat varying vec3 vCol; flat varying vec3 vLit; flat varying vec3 vN; varying vec3 vW;
flat varying float vStyle; flat varying float vKind; varying float vHb; varying vec2 vQ;
void main() {
  float kb = floor(aCol.a * 255. + .5), qc = floor(kb / 8.) - 4.; // kind + 8 x (4 + quad corner), or no corner
  vKind = mod(kb, 8.); vStyle = floor(aLit.a * 255. + .5);
  // the position inside its quad (0..1 each way; tris and lamps: the middle, no edges)
  vQ = qc < 0. ? vec2(0.5) : vec2(qc == 1. || qc == 2. ? 1. : 0., qc >= 2. ? 1. : 0.);
  vUv = uv; vCol = aCol.rgb; vLit = aLit.rgb; vN = aAux; vHb = length(aAux) - 1.;
  vec4 wp = modelMatrix * vec4(position, 1.);
  vec4 mv = viewMatrix * wp;
  if (vKind == 3.) {
    // neon tubes: off until it's dark (by day and at dusk the thin tubes read as stray strokes
    // across the towers), dropped past ~650 m (far off a dotted circuit board, not glow), and
    // never thinner than ~2 px: each side moves out across the tube (rings: up; corner posts,
    // style 1: sideways) by what a pixel spans at its depth
    if (uLit < 0.2 || -mv.z > uNeonFar * mix(0.45, 1., uNight)) { gl_Position = vec4(0., 0., 2., 1.); return; }
    vec3 across = vStyle == 1. ? cross(vec3(0., 1., 0.), aAux) : vec3(0., 1., 0.);
    float px = 2. * -mv.z / (projectionMatrix[1][1] * res.y); // metres per pixel here
    wp.xyz += across * (uv.y * 2. - 1.) * max(0., px - 0.3);
    mv = viewMatrix * wp;
  }
  vW = wp.xyz;
  gl_Position = projectionMatrix * mv;
}`;

/**
 * Ink: its own transparent layer (one more draw per near chunk). Each edge is a screen-space quad
 * a little wider than the line; the fragment fades its edges, so lines are anti-aliased, a
 * sub-pixel line fades instead of breaking into dashes, and the weight thins with depth.
 */
const INK_VERT = /* glsl */`
attribute vec3 aAux;
uniform vec2 res; uniform float dpr; uniform float uInkW;
varying float vAcross; varying float vWid; varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.);
  vP = wp.xyz;
  vec4 mv = viewMatrix * wp, mo = viewMatrix * (modelMatrix * vec4(aAux, 1.));
  const float NZ = -0.4;
  if (mv.z > NZ && mo.z > NZ) { gl_Position = vec4(0., 0., 2., 1.); return; }
  if (mv.z > NZ) mv.xyz = mix(mo.xyz, mv.xyz, (NZ - mo.z) / (mv.z - mo.z));
  else if (mo.z > NZ) mo.xyz = mix(mv.xyz, mo.xyz, (NZ - mv.z) / (mo.z - mv.z));
  float d = -mv.z;
  mv.xyz *= 1. - min(0.006 + 0.5 / d, 0.25); // sit in front of the faces it borders (no z-fight dashes)
  vec4 c0 = projectionMatrix * mv, c1 = projectionMatrix * mo;
  vec2 s = (c1.xy / c1.w - c0.xy / c0.w) * res;
  vec2 dir = dot(s, s) > 1e-8 ? normalize(s) : vec2(1., 0.);
  vWid = uInkW * dpr * uv.y * mix(1., 0.4, smoothstep(25., 600., d)); // wanted width, px
  vWid = max(vWid, 1.3 * dpr * uv.y * smoothstep(250., 450., d)); // far lines never a sub-pixel scratch
  float hw = max(vWid, 1.) * 0.5 + 1.; // the quad: a pixel of feather each side
  vAcross = uv.x * hw;
  c0.xy += vec2(-dir.y, dir.x) * uv.x * hw * 2. / res * c0.w;
  gl_Position = c0;
}`;
const INK_FRAG = /* glsl */`
uniform vec3 uInk;
${HAZE_GLSL}
varying float vAcross; varying float vWid; varying vec3 vP;
void main() {
  float d = length(vP - cameraPosition);
  float a = clamp(max(vWid, 1.) * 0.5 + 0.5 - abs(vAcross), 0., 1.) * min(vWid, 1.) * mix(1., 0.55, smoothstep(300., 700., d)) * (1. - smoothstep(1400., 2000., d));
  if (a < 0.01) discard;
  gRay = (vP - cameraPosition) / max(d, 1e-3);
  gl_FragColor = vec4(haze(uInk, d, vP.y, 0.85), a); // a notch under the walls: silhouettes keep their line
}`;

const FRAG = /* glsl */`
const vec2 AO = vec2(${AO.k}, ${AO.h.toFixed(1)}); // strength, falloff height (m)
uniform sampler2D uAtlas; uniform sampler2D uSigns;
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uAmbUp; uniform vec3 uAmbDn; uniform vec3 uSky; uniform vec3 uInk;
uniform float uNight; uniform float uLit; uniform float uTime; uniform float uFogK; uniform float dpr; uniform float uNeonFar;
uniform float uFogMax;
${HAZE_GLSL}
// per-face values are flat: exact (they seed hashes) and cheaper than interpolating
varying vec2 vUv; flat varying vec3 vCol; flat varying vec3 vLit; flat varying vec3 vN; varying vec3 vW;
flat varying float vStyle; flat varying float vKind; varying float vHb; varying vec2 vQ;
float gShine = 0.; // facade(): the near glass glint (out-of-band result)
// (sin-free: cheaper than the usual fract(sin()) where it runs on every lit wall pixel)
float h12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
// A periodic pulse (fract(x) in [a, b]) box-filtered over the pixel's footprint w: exact coverage at
// any scale, so a feature is crisp up close, soft at a few pixels and melts into its average share
// (b - a) once a cell is sub-pixel. No texture, no mip level to pick, nothing to shimmer.
float P1(float x, float a, float b) { return floor(x) * (b - a) + clamp(fract(x), a, b) - a; }
float pulse(float x, float a, float b, float w) { return (P1(x + 0.5 * w, a, b) - P1(x - 0.5 * w, a, b)) / w; }
/**
 * The facade, analytic (it was an atlas + a rows twin: the twin's floor bands read as stripes on
 * every mid-distance tower). c: facade coords in window cells, w: the pixel's footprint in cells
 * per axis. Per style (cell px of 32): window margins, bare wall shade, deco piers, brick courses;
 * floor slabs, mullion + transom, lintel recess and sill (near only). Lit windows: per floor (dark,
 * fully lit late-office floors, or runs) and per window, from a hash; once a window is under ~2 px
 * they fade to the style's mean (a solid lit tint, no sparkle). Returns (wall shade, glass, lit),
 * like the old atlas masks, + the lit windows' wash on the wall (night glow).
 */
// A window's light (id: its cell; busy 0..1): lit the way offices are, never dense 2D noise
// (that formed letters and Tetris shapes): a few whole lit floors with the odd dark window and a
// sparse scatter of single windows.
float litWin(vec2 id, float seed, float busy) {
  float b = 0.6 + 0.8 * busy, r = h12(id + seed * 3.17), hf = h12(vec2(id.y, seed));
  float fl = step(hf, 0.12 * b) * step(0.15, r);                 // lit floors (the odd dark window)
  float on = max(fl, step(r, 0.1 * b));                          // + a sparse scatter of single windows
  return on * (0.7 + 0.3 * fract(r * 37.1));
}
// The far facade: the windows grouped 2^k at a time (k from the pixel footprint), each group a
// window of the same margins and glass share: a window grid of >= ~3 px cells that keeps the
// facade's mean (no flat tint, no moire, no pinstripes), lit per window or 2 x 2 group at night,
// the mean past that. A level's cells blur toward its mean as they shrink; over the last
// third of a level the next one fades in (only there: every extra level costs fps).
vec2 grp(vec2 c, vec2 w, vec2 m, float lv, float seed, float busy, float lt) {
  float ip = lv > 0.5 ? 0.5 : 1.; // (levels 0 and 1 only: no exp2)
  vec2 q = c * ip, wq = w * ip;
  float g = pulse(q.x, m.x, 1. - m.x, wq.x) * pulse(q.y, m.y, 1. - m.y, wq.y);
  // lights: level 0 = the near windows' own, softened (a lit window of a few pixels, sharpened on the
  // upscale, became an "x" glyph); 2 x 2 groups glow at the mean (lit groups read as pale blotches)
  float lit = lt;
  if (uLit > 0. && lv < 0.5) lit = mix(litWin(floor(q), seed, busy), lt, 0.5);
  return vec2(g, lit);
}
vec4 groups(vec2 c, vec2 w, vec4 L, float style, float seed) {
  vec2 m = L.xy / 32., wa = 1. - 2. * m;
  float wn = wa.x * wa.y, lt = (0.08 + 0.62 / 3.) * (0.6 + 0.8 * L.w) * 0.8;
  float wl = mix(L.z, L.z * 0.72, 3. / 32.);
  if (style == 3.) wl = mix(wl, 1., 10. / 32. * (1. - wn));
  // the level and the place within it, linear (no log2): 2 x 2 groups fade to the mean early (past
  // ~2 px a group's pattern isn't worth its cost)
  // (2 x 2 groups only from high patrol, where they carry the far city: below it the mean)
  float t0 = max(w.x, w.y) * 3.3, top = cameraPosition.y > 420. ? 3. : 2., l0 = t0 >= 2. ? 1. : 0., k = l0 > 0.5 ? smoothstep(0.2, 0.5, t0 * 0.5 - 1.) : smoothstep(0.75, 1., t0 - 1.);
  if (t0 >= top) return vec4(wl * (1. - wn) + wn * 0.27, wn * 0.92, lt * wn * 0.92, lt * (1. - wn)); // (the mean)
  vec2 gl = grp(c, w, m, l0, seed, L.w, lt);
  if (k > 0.) gl = mix(gl, l0 > 0.5 || top < 2.5 ? vec2(wn, lt) : grp(c, w, m, 1., seed, L.w, lt), k); // (past level 1: the mean)
  float g = gl.x, lit = gl.y;
  return vec4(wl * (1. - g) + g * 0.27, g * 0.92, lit * g * 0.92, 0.);
}
vec4 facade(vec2 c, vec2 w, float style, float seed) {
  w = max(w, vec2(1e-3));
  if (style == 4.) {
    if (max(w.x, w.y) > 0.6) return vec4(0.74, 0.08, 0.019, 0.);
    // industrial: corrugated sheet, a strip window every fourth floor
    float corr = pulse(c.x * 8., 0., 0.5, w.x * 8.);
    float sx = pulse(c.x, 2. / 32., 30. / 32., w.x), sy = pulse(c.y * 0.25, 12. / 128., 22. / 128., w.y * 0.25);
    float win = sx * sy, on = step(h12(floor(c) + seed), 0.3);
    float lit = mix(on * 0.8, 0.24, smoothstep(0.25, 0.6, max(w.x, w.y)));
    return vec4(mix(mix(0.72, 0.92, corr), 0.25, win), win, lit * win, 0.);
  }
  vec4 L = style == 0. ? vec4(7., 7., 0.86, 0.6) : style == 1. ? vec4(1., 2., 0.7, 0.35) : style == 2. ? vec4(8., 8., 0.8, 0.55) : vec4(9., 4., 0.62, 0.55);
  vec2 m = L.xy / 32., wa = 1. - 2. * m;
  // windows under ~3 px (either way): grouped (sub-3 px cells were mush: moire, pinstripes)
  if (max(w.x, w.y) > 0.3) return groups(c, w, L, style, seed);
  float wx = pulse(c.x, m.x, 1. - m.x, w.x), wy = pulse(c.y, m.y, 1. - m.y, w.y), win = wx * wy;
  // the floor slab under each window row: its average once a floor is under ~3 px
  float slab = w.y > 0.35 ? 3. / 32. : pulse(c.y, 0., 3. / 32., w.y);
  float wall = mix(L.z, L.z * 0.72, slab);
  if (style == 3.) wall = mix(wall, 1., pulse(c.x + 4. / 32., 0., 10. / 32., w.x) * (1. - win)); // deco piers
  float fr = 0.08, rec = 0.; // (the frames' average share, once a window is a few pixels)
#ifndef FAR
  // the small features only while a window is ~6 px or more (past that they'd be their averages)
  float k = 1. - smoothstep(0.12, 0.2, max(w.x, w.y));
  if (k > 0.) {
    float wl = wall;
    if (style == 2.) {
      wl = mix(wl, 0.68 * L.z / 0.8, pulse(c.y * 4., 0.5, 0.625, w.y * 4.) * 0.6 * (1. - win)); // brick courses
      wl = mix(wl, 1., pulse(c.x, 6. / 32., 26. / 32., w.x) * pulse(c.y, 0.75, 0.84, w.y));     // pale lintel
    }
    float sill = pulse(c.x, m.x - 1. / 32., 1. - m.x + 1. / 32., w.x) * pulse(c.y, m.y - 2. / 32., m.y, w.y);
    wl = mix(wl, min(1., L.z * 1.18), sill);
    float f2 = pulse(c.x, 15. / 32., 17. / 32., w.x); // the mullion (a transom too made every pane a "+" glyph)
    wall = mix(wall, wl, k); fr = mix(fr, f2, k);
    rec = pulse(c.y, 1. - m.y - 2. / 32., 1. - m.y, w.y) * wx * k;                                         // recess under the lintel
    // big panes up close: a comic glint, one diagonal stroke across each pane (by day), so a
    // magnified curtain wall reads as glass, not a blown-up grid
    if (uNight < 0.6) gShine = pulse(c.x * 0.7 + c.y * 0.45, 0.62, 0.7, (w.x * 0.7 + w.y * 0.45)) * (1. - fr) * k * (1. - uNight / 0.6);
  }
#endif
  float lit = uLit > 0. ? mix(litWin(floor(c), seed, L.w), (0.08 + 0.62 / 3.) * (0.6 + 0.8 * L.w) * 0.8, 0.5 * smoothstep(0.15, 0.3, max(w.x, w.y))) : 0.; // (only lit windows care: skipped by day; few-pixel ones soften)
  float glass = max(0., win * (1. - fr * (1. - lit)) - rec * 0.45 * (1. - lit)); // (a lit window: a plain lit pane, no glyph)
  // night glow: a lit window washes its own cell's wall with a little of its light (cheap: no
  // extra shape, the cell is the window's); far off it simply brightens the lit tint
  return vec4(wall * (1. - win) + win * mix(0.25, 0.45, fr), glass, lit * glass, lit * (1. - win));
}
void main() {
  float dist = length(vW - cameraPosition);
  gRay = (vW - cameraPosition) / max(dist, 1e-3);
  vec3 col = vec3(0.), emi = vec3(0.);
  if (vKind == 2.) {
    vec3 s = texture2D(uSigns, vUv).rgb; // r tube core, g glow/letters, b board
    col = vec3(0.03, 0.02, 0.05) * s.b;
    emi = (vCol * s.g * 0.85 + mix(vCol, vec3(1.), 0.5) * s.r * 0.6) * mix(0.8, 1.15, uNight);
  } else if (vKind == 3.) {
    // a tube, not a painted stripe: a white-hot core and deeper-coloured edges across its width
    // (v runs across every tube), so a tube skimmed up close reads as neon rather than a streak
    // A tube under ~3 px across takes its profile's average (its sub-pixel white core broke into
    // red-white dashes far off), and by day / dusk a tube is barely lit: the thin corner posts and
    // cornice rings read as stray yellow lines across the canyons before dark
    float p = 1. - abs(vUv.y * 2. - 1.), thin = smoothstep(0.2, 0.5, fwidth(vUv.y));
    emi = vCol * mix(mix(0.55, 1.05, p), 0.8, thin) + mix(vCol, vec3(1.), 0.6) * mix(smoothstep(0.55, 0.95, p), 0.25, thin) * 0.55;
    emi *= mix(0.9, 1.3, uNight) * smoothstep(0.2, 0.6, uLit);
    col = vCol * 0.12; // (the unlit glass: a tube switching on is never a black stroke)
    emi *= 1. - smoothstep(uNeonFar * 0.6, uNeonFar, dist / mix(0.45, 1., uNight));
  } else if (vKind == 4.) {
    emi = vCol * (0.25 + 2.5 * step(0.6, fract(uTime * 0.7 + vUv.x)));
  } else {
    bool roof = vStyle > 4.5;
    vec4 m = vec4(0.);
    if (roof) {
#ifdef FAR
      m.rgb = vStyle == 5. ? vec3(0.72, 0., 0.) : vStyle == 6. ? vec3(0.41, 0., 0.) : vec3(0.36, 0., 0.18); // the roof cells' means
#else
      // gravel / tar / helipad: the roof atlas, its mip level from the unwrapped coords (no seam)
      vec2 u = vStyle == 7. ? clamp(vUv, 0.01, 0.99) : fract(vUv), sc = vec2(0.96, 0.98) / vec2(3., 1.), g = vUv * sc;
      m.rgb = textureGrad(uAtlas, u * sc + vec2((0.02 + vStyle - 5.) / 3., 0.01), dFdx(g), dFdy(g)).rgb;
#endif
    } else {
      vec2 c = vUv * vec2(${WIN.cols}., ${WIN.rows}.);
      m = facade(c, fwidth(c), vStyle, dot(vCol, vec3(17.3, 31.7, 7.1)) + dot(vLit, vec3(3.1, 5.7, 11.3)));
    }
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float ndl = dot(N, uKeyDir);
    // three cel bands per face: shade (the sky's cool fill alone, a darker, cooler step of the same
    // paint), raking (half the key), full light (roofs always full while the sun is up): the sun's
    // side and the shade side read apart on every tower, by day and at dusk
    float litK = smoothstep(0.0, 0.04, ndl), fullK = N.y > 0.5 ? 1. : smoothstep(0.3, 0.34, ndl);
    vec3 amb = mix(uAmbDn, uAmbUp, N.y * 0.5 + 0.5) * mix(vec3(${KEY.shade.join(', ')}), vec3(1.), litK);
    // (roofs take less of the moon: under its blue key every near roof was one cobalt slab)
    vec3 light = amb + uKeyCol * litK * (0.5 + 0.5 * fullK) * (N.y > 0.5 ? 1. - 0.45 * uNight : 1.);
    // each facade orientation keeps its own cel tone (east/west a step darker than north/south),
    // so a tower's two visible faces always read apart even when neither is in the sun
    if (N.y < 0.5) light *= abs(N.x) > abs(N.z) ? mix(0.82, 0.94, litK) : 1.;
    vec3 wall = vCol * m.r * light;
    if (roof) {
      col = mix(wall, vec3(0.9, 0.62, 0.05) * light, m.b);
    } else {
      // glass: dark by night, mirrors the sky (more at grazing angles) by day; curtain walls most
      float fres = 1. - max(dot(N, V), 0.); fres *= fres; // (no pow: exp/log in software GL)
      vec3 dayGlass = mix(vec3(0.07, 0.14, 0.3), uSky * 0.75, (vStyle == 1. ? 0.3 : 0.15) + 0.45 * fres);
      vec3 glass = mix(dayGlass, vec3(0.03, 0.035, 0.055) + uSky * 0.08 * fres, uNight);
      // (in the shade the glass dims and leans to the wall's own paint: a shaded face is the same
      // tower in shadow, not a dark blue panel)
      glass = mix(glass * mix(0.5, 1., litK), wall * 0.55, (1. - litK) * 0.35 * (1. - uNight));
      col = mix(wall, glass + (uSky * 0.6 + 0.25) * gShine * (0.4 + 0.6 * litK), m.g);
      float cy = smoothstep(0., 45., vW.y);
      col *= mix(0.42, 1., cy); // canyon floors are darker
      // contact shade: the foot of every wall darkens where it meets the ground, a setback's roof
      // or the roof under a box (cheap AO: the height above the part's own base, per vertex)
      col *= 1. - AO.x * exp(-vHb / AO.y) * (1. - 0.4 * uNight) * step(abs(N.y), 0.5);
      emi = vLit * (m.b * 1.15 + m.a * 0.12) * uLit * mix(0.55, 1., cy); // (the street floors' light sinks into the canyon too)
      // dusk rim: with the sun low, a face in shade gets a thin warm line on its sun-side edge
      // (the edge a backlit tower's lit face turns away at); its quad position gives the edge
      if (uKeyDir.y < 0.4 && uNight < 0.95) { // (a uniform branch: low sun only)
        vec3 T = vec3(N.z, 0., -N.x); // along the quad (cross(up, N))
        float ex = (dot(T, uKeyDir) > 0. ? 1. - vQ.x : vQ.x) / max(fwidth(vQ.x), 1e-5);
        float rim = (1. - smoothstep(1.2 * dpr, 2.4 * dpr, ex)) * (1. - litK) * smoothstep(0.4, 0.08, uKeyDir.y) * (1. - uNight) * step(abs(N.y), 0.5);
        col += uKeyCol * vec3(1., 0.8, 0.55) * rim * 0.7;
      }
      // night rim: a cool sky-lit edge on faces turning away from her (the silhouette reads)
      emi += uSky * 0.45 * uNight * smoothstep(0.55, 0.85, fres) * (1. - m.g * 0.5);
    }
#ifdef FAR
    // ink without line geometry: every quad's own edges (roof outlines, corners, setback lips),
    // ~1 px wide from the pixel's place in its quad, thinning off into the haze like the near ink
    vec2 e = min(vQ, 1. - vQ) / max(fwidth(vQ), vec2(1e-5));
    float inkA = (1. - smoothstep(0.9 * dpr - 0.5, 0.9 * dpr + 0.5, min(e.x, e.y))) * mix(0.9, 0.5, smoothstep(500., 1400., dist)) * (1. - smoothstep(1600., 2400., dist));
    col = mix(col, uInk, inkA); emi *= 1. - inkA;
#else
    // halftone dots in the shade, close up only: fixed dot size (shrinking dots turn to salt),
    // the strength fades out instead
    // (the raking band gets a lighter screen than the full shadow)
    float sh = (1. - 0.6 * litK - 0.4 * fullK * litK) * (1. - m.g * 0.7) * (1. - smoothstep(150., 300., dist)); // (by 300 m: further out the 45° dots beat against the window grid, a diagonal net)
    if (sh > 0.01) {
      vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / (6. * dpr);
      col *= 1. - 0.45 * sh * (1. - smoothstep(0.32, 0.44, length(fract(p) - 0.5) * 1.414));
    }
#endif
  }
#ifdef TONE_MAPPING
  col = toneMapping(col);
#endif
  gl_FragColor = linearToOutputTexel(vec4(col + emi, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  // towers rise out of the haze; neon cuts through it; landmarks stay pale silhouettes (uFogMax)
  gl_FragColor.rgb = haze(gl_FragColor.rgb, dist * uFogK, vW.y, (vKind >= 2. ? 0.7 : 1.) * uFogMax);
}`;

/**
 * The building materials: `near` (full facade detail, roof atlas, halftone), `far` (windows and slabs only, flat roofs, no texture
 * fetch: the cheap one for the many far pixels) and `make(fogK)` for always-on landmarks.
 * All share one uniforms set; update it once per frame with `light()`.
 */
export class CityLook {
  constructor(signTex) {
    this.atlas = atlas();
    const U = {
      uHazeCol: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uHazeLow: { value: new THREE.Color() }, uHazeNear: { value: 400 }, uHazeFar: { value: 1600 },
      uSunAir: { value: new THREE.Color(0, 0, 0) }, uSunDirH: { value: new THREE.Vector2(1, 0) },
      uAtlas: { value: this.atlas }, uSigns: { value: signTex },
      uKeyDir: { value: new THREE.Vector3(0.4, 0.7, 0.5).normalize() }, uKeyCol: { value: new THREE.Color(1, 1, 1) },
      uAmbUp: { value: new THREE.Color(0.4, 0.4, 0.5) }, uAmbDn: { value: new THREE.Color(0.2, 0.2, 0.3) },
      uSky: { value: new THREE.Color(0.6, 0.7, 0.9) }, uInk: { value: new THREE.Color(0x120c14) },
      uNight: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 }, uInkW: { value: 2.6 },
      res: LOOK.res, dpr: LOOK.dpr,
    };
    this.U = U;
    this.near = this.make(1);
    this.far = this.make(1, { FAR: 1 });
    this.ink = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: INK_VERT, fragmentShader: INK_FRAG, transparent: true, depthWrite: false });
  }

  make(fogK, defines = {}, fogMax = 1, neonFar = 550) {
    const uniforms = { ...this.U, uFogK: { value: fogK }, uFogMax: { value: fogMax }, uNeonFar: { value: neonFar } };
    return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, defines });
  }

  /**
   * Per frame: key light + ambient from the sky's own lights, sky colour for glass, night, and the
   * haze: its colour leans from the (district-tinted) fog toward a cool desaturated grey, ends on
   * the dome's horizon colour, and reaches further the higher the camera (a city to the horizon).
   */
  light(sun, hemi, fog, night, time, horizon, camY, dome = null) {
    const U = this.U;
    if (dome) {
      // the sky's warm glow toward the sun (its toSun term, Sky3D DOME_FS) for the haze to share
      const { band, mid, sunK, discDir } = dome, k = band.value.r > mid.value.r ? 0.35 * sunK.value : 0;
      U.uSunAir.value.copy(band.value).sub(mid.value).multiplyScalar(k);
      U.uSunDirH.value.set(discDir.value.x, discDir.value.z).normalize();
    }
    if (sun) {
      U.uKeyDir.value.copy(sun.position).sub(sun.target.position).normalize();
      U.uKeyCol.value.copy(sun.color).multiplyScalar((0.12 + 0.36 * sun.intensity) * (1 - 0.15 * night) * KEY.key);
    }
    if (hemi) {
      const k = 0.75 * hemi.intensity * (1 - 0.55 * night) * KEY.amb;
      U.uAmbUp.value.copy(hemi.color).multiplyScalar(k);
      U.uAmbDn.value.copy(hemi.groundColor).multiplyScalar(k * 1.2).lerp(U.uAmbUp.value, 0.25);
    }
    if (fog) {
      U.uSky.value.copy(fog.color);
      const c = fog.color, l = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
      U.uHorizon.value.copy(horizon || c);
      // aerial perspective: the horizon's own hue, lighter and a touch bluer (never a muddy brown),
      // so the far city pales into the sky and the haze meets the dome without a rim
      const h = U.uHorizon.value, hl = 0.3 * h.r + 0.59 * h.g + 0.11 * h.b;
      U.uHazeCol.value.copy(h).lerp(_t.setRGB(hl, hl, hl), 0.3).lerp(c, 0.1).multiply(_cool).multiplyScalar(1.12);
      U.uHazeLow.value.copy(U.uHazeCol.value).lerp(_t.setRGB(hl, hl, hl), 0.35).multiplyScalar(HAZE.low);
      U.uHazeFar.value = Math.min(HAZE.max, Math.max(fog.far, camY * HAZE.perAlt));
      U.uHazeNear.value = Math.max(U.uHazeFar.value * HAZE.near, camY * HAZE.nearAlt);
    }
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
  constructor(lite = false) {
    this.lite = lite; this.base = 0; this.pos = []; this.aux = []; this.uv = []; this.col = []; this.lit = []; this.n = 0;
    this.ip = []; this.ia = []; this.iu = []; this.inN = 0; // the ink layer
    // indices in two runs: the body, then the small detail (roof kit, trees) that a far or high
    // camera skips with the geometry's draw range (`userData.body`: the body's index count)
    this.runs = [[], []]; this.inkRuns = [[], []]; this.idx = this.runs[0]; this.ii = this.inkRuns[0];
  }

  /** Everything added inside fn() is detail (drawn only near and low: see City3D LOD). */
  detail(fn) {
    this.idx = this.runs[1]; this.ii = this.inkRuns[1];
    try { fn(); } finally { this.idx = this.runs[0]; this.ii = this.inkRuns[0]; }
  }

  /** tint/lit: THREE.Color or hex; style: atlas cell; kind: KIND.* */
  v(p, aux, u, w, tint, kind, lit, style, q = 0) {
    // surfaces: the face normal's length carries 1 + the height above the part's own base (contact
    // shade at the foot of every wall, setback and roof box; the shader normalises it back)
    const s = kind === 0 ? 1 + Math.max(0, p[1] - this.base) : 1;
    this.pos.push(p[0], p[1], p[2]); this.aux.push(aux[0] * s, aux[1] * s, aux[2] * s); this.uv.push(u, w);
    this.col.push(b255(tint.r), b255(tint.g), b255(tint.b), kind + q);
    this.lit.push(b255(lit.r), b255(lit.g), b255(lit.b), style);
    return this.n++;
  }

  /** a b c d counter-clockwise seen from the front; uvs: [[u,v] x4]. */
  quad(a, b, c, d, nrm, uvs, tint, lit, style, kind = 0) {
    // (the kind byte's spare bits carry the quad corner: the far shader inks every quad's edges)
    const i = this.v(a, nrm, uvs[0][0], uvs[0][1], tint, kind, lit, style, 32);
    this.v(b, nrm, uvs[1][0], uvs[1][1], tint, kind, lit, style, 40);
    this.v(c, nrm, uvs[2][0], uvs[2][1], tint, kind, lit, style, 48);
    this.v(d, nrm, uvs[3][0], uvs[3][1], tint, kind, lit, style, 56);
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
    // far (lite) builds ink only long edges: the skyline silhouettes keep their comic line
    const len = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
    if (this.lite || len < 2.5) return; // far: the haze bands and skyline card carry the line
    const i = this.inN;
    for (const [a, b, side] of [[p, q, 1], [p, q, -1], [q, p, 1], [q, p, -1]]) { this.ip.push(...a); this.ia.push(...b); this.iu.push(side, w); }
    this.inN += 4;
    this.ii.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** The ink layer's geometry (null when there is none). */
  inkGeometry() {
    if (!this.inN) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.ip, 3));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.ia, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.iu, 2));
    index(g, this.inkRuns, this.inN);
    g.computeBoundingSphere();
    return g;
  }

  geometry() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.aux, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(this.col), 4, true));
    g.setAttribute('aLit', new THREE.BufferAttribute(new Uint8Array(this.lit), 4, true));
    index(g, this.runs, this.n);
    g.computeBoundingSphere();
    return g;
  }
}
/** Body indices, then detail; userData.body = where the detail starts. */
function index(g, [body, extra], n) {
  const all = extra.length ? body.concat(extra) : body;
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(all, 1) : new THREE.Uint16BufferAttribute(all, 1));
  g.userData.body = body.length; g.userData.all = all.length;
}
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
  B.base = bot;
  if (walls) {
    const fl = 1 / WIN.rows, vo = L.voff - ((((L.voff + fv(top)) % fl) + fl) % fl) + fl * 0.02;
    const v0 = vo + fv(bot), v1 = vo + fv(top);
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
  B.base = bot;
  const circ = 2 * Math.PI * r, v0 = L.voff + fv(bot), v1 = L.voff + fv(top), slope = (r - rTop) / Math.max(0.01, top - bot);
  for (let i = 0; i < n; i++) {
    const [ca, sa] = P[i], [cb, sb] = P[i + 1], am = rot + ((i + 0.5) / n) * Math.PI * 2;
    const nrm = new THREE.Vector3(Math.cos(am), slope, Math.sin(am)).normalize();
    const u0 = L.uoff + fu((i / n) * circ), u1 = L.uoff + fu(((i + 1) / n) * circ);
    const a0 = [cx + ca * r, bot, cz + sa * r], b0 = [cx + cb * r, bot, cz + sb * r], b1 = [cx + cb * rTop, top, cz + sb * rTop], a1 = [cx + ca * rTop, top, cz + sa * rTop];
    // wound outward: (b0, a0, a1, b1) faces away from the axis
    // a face leaning back more than ~33° (pyramids, spire and dome tops, tank hats) is a roof: the
    // roof material, never the window grid (a windowed pyramid next to blank faces read as broken)
    B.quad(b0, a0, a1, b1, [nrm.x, nrm.y, nrm.z], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], L.tint, L.lit, nrm.y > 0.55 ? L.roofStyle : L.style);
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

/**
 * A slanted crown (the glass-tower wedge): a block from `bot` whose top rises by `rise` toward one
 * side (dir 0..3 = +x, -z, -x, +z), the sloped face in the facade's style (glass reads as a tilted
 * curtain wall catching the sky).
 */
export function wedge(B, x0, z0, x1, z1, bot, rise, L, dir = 0, ink = 1) {
  B.base = bot;
  const C = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
  const up = [[0, 1, 1, 0], [0, 0, 1, 1], [1, 0, 0, 1], [1, 1, 0, 0]][dir & 3];
  const P = C.map(([x, z], i) => [x, bot + rise * up[i], z]);
  const N = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];
  const v0 = L.voff + fv(bot);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, a = C[i], b = C[j];
    if (!up[i] && !up[j]) continue; // the low edge: no wall
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u1 = L.uoff + fu(len);
    B.quad([a[0], bot, a[1]], [b[0], bot, b[1]], P[j], P[i], N[i], [[L.uoff, v0], [u1, v0], [u1, L.voff + fv(P[j][1])], [L.uoff, L.voff + fv(P[i][1])]], L.tint, L.lit, L.style);
    if (up[i]) B.ink([a[0], bot, a[1]], P[i], ink);
  }
  const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
  const w = fu(Math.hypot(...e1)), h = fv(Math.hypot(...e2));
  B.quad(P[0], P[1], P[2], P[3], n.map((c) => c / l), [[L.uoff, v0], [L.uoff + w, v0], [L.uoff + w, v0 + h], [L.uoff, v0 + h]], L.tint, L.lit, L.style);
  for (let i = 0; i < 4; i++) B.ink(P[i], P[(i + 1) % 4], ink);
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
export function mast(B, x, z, bot, top, r = 0.35, beacon = '#ff3030', tint = '#8a8e98') {
  // no ink: an inked hairline mast reads as a stray line off the tower
  const L = MAST_L; L.tint.set(tint); L.roofTint.set(tint);
  r = Math.max(r, 0.6);
  prism(B, x, z, r, r * 0.6, bot, top, 4, L, { ink: 0, cap: false });
  if (beacon) lamp(B, x, top + 0.6, z, 0.9, beacon, KIND.beacon, (x * 0.37 + z * 0.11) % 1);
}
const MAST_L = look('#3a3d44', '#000', STYLE.industrial);

/** A glowing lamp: a small camera-independent diamond (beacons, lit tips, signal lights). */
export function lamp(B, x, y, z, s, colour, kind = KIND.neon, phase = 0) {
  _l.set(colour);
  const p = [[x, y + s, z], [x + s, y, z], [x, y, z + s], [x - s, y, z], [x, y, z - s], [x, y - s, z]];
  const f = [[0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4], [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1]];
  for (const [a, b, c] of f) {
    const i = B.v(p[a], [0, 1, 0], phase, 0.3, _l, kind, _l, 0);
    B.v(p[b], [0, 1, 0], phase, 0.3, _l, kind, _l, 0);
    B.v(p[c], [0, 1, 0], phase, 0.3, _l, kind, _l, 0);
    B.idx.push(i, i + 1, i + 2);
  }
}

/** Neon tubes: a glowing strip round a footprint at height y, just proud of the walls. */
export function neonRing(B, x0, z0, x1, z1, y, colour, t = 0.7) {
  _l.set(colour);
  t = Math.max(t, B.lite ? 1.6 : 0.6); // thin tubes alias into dashed lines at range
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
  // (style 1: the shader widens a post sideways, a ring upward)
  B.quad([x - h, y0, z + h], [x + h, y0, z + h], [x + h, y1, z + h], [x - h, y1, z + h], [0, 0, 1], UVP, _l, _l, 1, KIND.neon);
  B.quad([x + h, y0, z + h], [x + h, y0, z - h], [x + h, y1, z - h], [x + h, y1, z + h], [1, 0, 0], UVP, _l, _l, 1, KIND.neon);
  B.quad([x + h, y0, z - h], [x - h, y0, z - h], [x - h, y1, z - h], [x + h, y1, z - h], [0, 0, -1], UVP, _l, _l, 1, KIND.neon);
  B.quad([x - h, y0, z - h], [x - h, y0, z + h], [x - h, y1, z + h], [x - h, y1, z - h], [-1, 0, 0], UVP, _l, _l, 1, KIND.neon);
}
/** Neon uvs: v runs across the tube (the shader's tube profile); UVP for upright posts. */
const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]], UVP = [[0, 0], [0, 1], [1, 1], [1, 0]];
