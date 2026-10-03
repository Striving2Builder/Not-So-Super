// The map's ground as seen from altitude (past the near baked tiles): a comic-painted street plan,
// not coloured lot squares. Asphalt streets with inked kerbs and pale sidewalks, street trees,
// paved lots muted toward a common warm grey (a hint of the district's tone, no candy tiles),
// parking with stall ticks and parked cars, tree clusters in the lots' open corners, contact shade
// round every footprint, farm fields in crop rows with hedgerows, landmark plazas. Plus a night twin
// where the avenue grid glows sodium-orange and the plazas are floodlit. Painted once, at load.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { DISTRICTS } from './data.js';
import { hash2 } from './rng.js';
import { M, HAZE_GLSL } from './buildings3d.js';

/**
 * px: day texture pixels per block [rich, lean]; nightPx: the glow twin (soft anyway).
 * pave: the neutral every lot leans to (k of the way); mute: how far flats and fields lean to it.
 */
const GROUND = { px: [64, 48], nightPx: 32, pave: '#6f6b64', k: 0.55, mute: 0.3, walk: '#9a968c', kerb: 'rgba(16,16,24,.75)', asphalt: '#34353c', ink: 'rgba(14,14,22,.8)' };
const GREEN = ['#2f5a2c', '#38662f', '#2a5230', '#41702f'];
const STREET_TREES = new Set(['downtown', 'residential', 'suburb', 'entertainment', 'retail', 'financial']);
const NO_FILL = new Set(['farm', 'docks', 'lair', 'warehouse', 'factory']);
const CARS = ['#c22', '#e8e8e8', '#2a5ac8', '#222', '#e0b020', '#3a8a4a'];

const _a = new THREE.Color(), _b = new THREE.Color();
/** hex a leaned k of the way to hex b. */
const mix = (a, b, k) => '#' + _a.set(a).lerp(_b.set(b), k).getHexString();

/** A comic tree canopy: ink ring, flat green, a lit cap up-left. World units. */
function canopy(g, x, y, r, h) {
  g.fillStyle = GROUND.ink; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = GREEN[(h * 4) | 0]; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,200,90,.35)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); g.fill();
}

/** A parking patch: dark asphalt, white stall ticks, parked cars. */
function parking(g, x, y, w, h, s) {
  g.fillStyle = '#3c3d43'; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(235,235,225,.55)';
  const n = Math.max(2, Math.floor(w / 14));
  for (let i = 0; i <= n; i++) { const xx = x + (w * i) / n; g.fillRect(xx - 0.8, y + 2, 1.6, h * 0.38); g.fillRect(xx - 0.8, y + h * 0.62, 1.6, h * 0.38 - 2); }
  for (let i = 0; i < n; i++) for (const row of [0, 1]) {
    const k = hash2(s + i, row, 17);
    if (k < 0.4) continue;
    g.fillStyle = CARS[(k * 977 | 0) % CARS.length];
    g.fillRect(x + (w * (i + 0.5)) / n - 3.5, row ? y + h * 0.62 + 2 : y + 4, 7, h * 0.3);
  }
}

const inside = (o, x, y, pad) => o.kind === 'box' ? x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.d + pad
  : (o.kind === 'round' || o.kind === 'tree') ? Math.hypot(x - o.x, y - o.y) < o.rad + pad : false;
const covered = (f, x, y) => (f.t === 'lot' || f.t === 'pool' || f.t === 'fountain') && x > f.x - 24 && x < f.x + (f.w || 0) + 24 && y > f.y - 24 && y < f.y + (f.h || 0) + 24;

function plan(city, landmarks, PX) {
  const PN = GROUND.nightPx / BLOCK;
  const day = document.createElement('canvas'), night = document.createElement('canvas');
  day.width = Math.ceil(city.coastX * PX); day.height = Math.ceil(city.H * PX);
  night.width = Math.ceil(city.coastX * PN); night.height = Math.ceil(city.H * PN);
  const d = day.getContext('2d'), n = night.getContext('2d');
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // both painted in world units
  d.setTransform(PX, 0, 0, PX, 0, 0); n.setTransform(PN, 0, 0, PN, 0, 0);
  R(d, 0, 0, city.coastX, city.H, GROUND.asphalt);
  R(n, 0, 0, city.coastX, city.H, '#000');
  // avenues glow at night: a warm line down each road, brighter at the crossings
  // street classes: every fourth street is a sodium-lit avenue, the rest dim side streets; only
  // avenue crossings get a bright pool (a city plan, not a uniform orange waffle)
  const av = (i) => i % 4 === 0;
  for (let i = 0; i <= city.landCols; i++) R(n, i * BLOCK + ROAD * 0.3, 0, ROAD * 0.4, city.H, av(i) ? 'rgb(200,115,45)' : 'rgb(55,38,28)');
  for (let j = 0; j <= city.rows; j++) R(n, 0, j * BLOCK + ROAD * 0.3, city.coastX, ROAD * 0.4, av(j) ? 'rgb(200,115,45)' : 'rgb(55,38,28)');
  for (let i = 0; i <= city.landCols; i += 4) for (let j = 0; j <= city.rows; j += 4) R(n, i * BLOCK + ROAD * 0.2, j * BLOCK + ROAD * 0.2, ROAD * 0.6, ROAD * 0.6, 'rgb(255,220,150)');
  // day: a solid (never dashed) faded centre line down the avenues only
  for (let i = 0; i <= city.landCols; i += 4) R(d, i * BLOCK + ROAD / 2 - 1.5, 0, 3, city.H, 'rgba(210,180,90,.35)');
  for (let j = 0; j <= city.rows; j += 4) R(d, 0, j * BLOCK + ROAD / 2 - 1.5, city.coastX, 3, 'rgba(210,180,90,.35)');
  for (const b of city.blocks) {
    const D = DISTRICTS[b.d], farm = b.d === 'farm', sub = b.d === 'suburb';
    // river blocks: green banks with a few trees (the 3D ribbon of water lies on them)
    if (b.river) {
      R(d, b.x0 - ROAD / 2, b.y0 - ROAD / 2, LOT + ROAD, LOT + ROAD, '#4f6a44');
      for (let k = 0; k < 10; k++) canopy(d, b.x0 - ROAD / 2 + hash2(b.bx, k, 81) * (LOT + ROAD), b.y0 - ROAD / 2 + (k % 2 ? 6 : LOT + ROAD - 6), 6, hash2(k, b.by, 82));
      continue;
    }
    const { x0, y0 } = b;
    // the sidewalk ring with an inked kerb (farms: a dirt verge, no kerb)
    if (!farm) {
      R(d, x0 - 6, y0 - 6, LOT + 12, LOT + 12, GROUND.walk);
      d.strokeStyle = GROUND.kerb; d.lineWidth = 3; d.strokeRect(x0 - 6, y0 - 6, LOT + 12, LOT + 12);
    }
    R(d, x0, y0, LOT, LOT, sub ? '#587a45' : farm ? '#6a7a44' : mix(D.lot, GROUND.pave, GROUND.k));
    for (const f of b.flats) {
      if (f.t === 'rect' || f.t === 'path') R(d, f.x, f.y, f.w, f.h, mix(f.c, GROUND.pave, f.t === 'path' ? 0 : GROUND.mute));
      else if (f.t === 'field') {
        // crop rows: two muted tones in stripes, an inked field edge
        const c1 = mix(f.c1, '#6b6a48', GROUND.mute + 0.1), c2 = mix(f.c2, '#4a4a32', GROUND.mute + 0.15), k = 16;
        R(d, f.x, f.y, f.w, f.h, c1);
        for (let i = 1; i < k; i += 2) if (f.vert) R(d, f.x + (f.w * i) / k, f.y, f.w / k, f.h, c2); else R(d, f.x, f.y + (f.h * i) / k, f.w, f.h / k, c2);
        d.strokeStyle = 'rgba(60,45,25,.7)'; d.lineWidth = 4; d.strokeRect(f.x, f.y, f.w, f.h);
      } else if (f.t === 'pool') { R(d, f.x - 2, f.y - 2, f.w + 4, f.h + 4, '#e8e8e8'); R(d, f.x, f.y, f.w, f.h, '#2f9cc8'); }
      else if (f.t === 'lot') parking(d, f.x, f.y, f.w, f.h, b.bx * 31 + b.by);
      else if (f.t === 'fountain') {
        d.fillStyle = '#c8c0b0'; d.beginPath(); d.arc(f.x, f.y, f.r, 0, Math.PI * 2); d.fill();
        d.fillStyle = '#3a8ab8'; d.beginPath(); d.arc(f.x, f.y, f.r * 0.75, 0, Math.PI * 2); d.fill();
      }
    }
    // contact shade: a soft dark skirt round every footprint, so buildings sit on the ground
    for (const [pad, a] of [[9, 0.16], [4, 0.24]]) {
      d.fillStyle = `rgba(10,8,20,${a})`;
      for (const o of b.b) {
        if (o.kind === 'box' && !o.truck) d.fillRect(o.x - pad, o.y - pad, o.w + pad * 2, o.d + pad * 2);
        else if (o.kind === 'round') { d.beginPath(); d.arc(o.x, o.y, o.rad + pad, 0, Math.PI * 2); d.fill(); }
      }
    }
    // the open corners of a lot: tree clusters, or a parking patch in the busy districts
    if (!NO_FILL.has(b.d)) {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const px = x0 + LOT * (i + 0.5) / 3, py = y0 + LOT * (j + 0.5) / 3, h = hash2(b.bx * 3 + i, b.by * 3 + j, 83);
        if (b.b.some((o) => inside(o, px, py, 14)) || b.flats.some((f) => covered(f, px, py))) continue;
        if (h < 0.5 || sub) for (let k = 0; k < 4; k++) canopy(d, px + (hash2(i, k, b.bx + 84) - 0.5) * 34, py + (hash2(j, k, b.by + 85) - 0.5) * 34, 6 + hash2(k, i + j, 86) * 5, hash2(k, b.bx, 87));
        else if (h < 0.8) parking(d, px - 24, py - 14, 48, 28, b.bx * 7 + b.by * 13 + i + j * 3);
      }
    }
    // the city's own trees (parks, yards) as inked canopies
    for (const o of b.b) if (o.kind === 'tree') canopy(d, o.x, o.y, Math.max(5, o.rad), hash2(o.x | 0, o.y | 0, 88));
    // street trees along the sidewalks; hedgerows along the farm fields
    if (STREET_TREES.has(b.d) || farm) {
      const step = farm ? 13 : 22, r = farm ? 5 : 4.5, off = farm ? -4 : -3.5;
      for (let t = 8; t < LOT - 4; t += step) for (let s = 0; s < 4; s++) {
        if (hash2(b.bx * 64 + t | 0, b.by * 4 + s, 89) < (farm ? 0.55 : 0.4)) continue;
        const x = s === 0 ? x0 + t : s === 1 ? x0 + LOT - off : s === 2 ? x0 + LOT - t : x0 + off;
        const y = s === 0 ? y0 + off : s === 1 ? y0 + t : s === 2 ? y0 + LOT - off : y0 + LOT - t;
        canopy(d, x, y, r, hash2(t, s, 90));
      }
    }
    // lit lots in the busy districts
    // (the casino strip's lots blaze: the one district that glows from across the city at night)
    if (b.d === 'casino') R(n, x0, y0, LOT, LOT, 'rgba(255,190,90,.5)');
    else if (D.neon || b.d === 'downtown' || b.d === 'financial') R(n, x0, y0, LOT, LOT, 'rgba(255,200,140,.18)');
  }
  // landmark plazas: pale paving round the tower's block, inked rings, floodlit at night
  for (const lm of landmarks) {
    if (!lm.blk) continue;
    const b = lm.blk, x = b.x0 - ROAD * 0.35, y = b.y0 - ROAD * 0.35, s = LOT + ROAD * 0.7;
    R(d, x, y, s, s, '#c4bca8');
    d.strokeStyle = '#8a8270'; d.lineWidth = 3;
    for (let k = 1; k < 4; k++) d.strokeRect(b.x0 + k * LOT / 8, b.y0 + k * LOT / 8, LOT - k * LOT / 4, LOT - k * LOT / 4);
    d.strokeStyle = GROUND.kerb; d.strokeRect(x, y, s, s);
    R(n, x, y, s, s, 'rgba(255,240,200,.55)');
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { day: tex(day), night: tex(night) };
}

/** The land plane of the map, lit like the buildings and hazed like everything else. rich: the sharper plan. */
export function cityGround(city, U, landmarks, rich = true) {
  const T = plan(city, landmarks, GROUND.px[rich ? 0 : 1] / BLOCK), x1 = city.coastX * M, z1 = city.H * M;
  const g = new THREE.PlaneGeometry(x1, z1); // the canvases span exactly the land
  g.rotateX(-Math.PI / 2); g.translate(x1 / 2, -0.25, z1 / 2);
  return new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { day: { value: T.day }, night: { value: T.night }, uKeyCol: U.uKeyCol, uAmbUp: U.uAmbUp, uNight: U.uNight, uLit: U.uLit, uHazeCol: U.uHazeCol, uHorizon: U.uHorizon, uHazeNear: U.uHazeNear, uHazeFar: U.uHazeFar },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
uniform sampler2D day; uniform sampler2D night; uniform vec3 uKeyCol; uniform vec3 uAmbUp; uniform float uNight; uniform float uLit;
${HAZE_GLSL}
varying vec2 vUv; varying vec3 vW;
void main() {
  // lit like the near ground tiles it continues (the 2D view's baked art, drawn unlit): full plan
  // colour by day and dusk, the tiles' navy street veil by night. Lit by the scene's own (dim) dusk
  // light it fell to a near-black slab past the tiles.
  vec3 c = texture2D(day, vUv).rgb;
  c = mix(c, c * 0.65 + vec3(0.0006, 0.001, 0.006), smoothstep(0.3, 0.6, uNight)) + texture2D(night, vUv).rgb * uLit * 0.3;
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  gl_FragColor.rgb = haze(gl_FragColor.rgb, length(vW - cameraPosition), 0., 1.);
}`,
  }));
}
