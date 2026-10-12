// Geometry for the flight moments' 3D actors (src/moments/kit3d.js pools them): small comic figures,
// cars, a van, a helicopter, a camera drone, a kitten, a stroller, a wig, Polaroid cards and hoops.
// Every actor is ONE merged, vertex-coloured geometry (one draw call, plus one for its ink hull);
// figures get a few baked poses swapped like flipbook frames (a run cycle reads fine at flight
// distances and costs nothing). Units: metres, y up, facing +z, feet / wheels on y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/** Bake one colour into a primitive and place it; uv dropped (merged parts must match). */
function part(list, geo, col, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0 } = {}) {
  geo.deleteAttribute('uv');
  geo.scale(sx, sy, sz);
  if (rx) geo.rotateX(rx);
  if (rz) geo.rotateZ(rz);
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  _c.set(col);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  list.push(geo.index ? geo : geo);
  return geo;
}
const merge = (list) => { const g = mergeGeometries(list, false); g.computeBoundingSphere(); return g; };
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const Cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const Sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

/**
 * A limb (cylinder) of length len hanging from a joint at (x, y, z), swung by pitch (about x:
 * positive = back, negative = forward, ±π = straight up) then roll (about z). Returns its far end.
 */
function limb(list, col, x, y, z, len, r0, r1, pitch, roll) {
  const g = Cyl(r0, r1, len, 7);
  g.deleteAttribute('uv');
  g.translate(0, -len / 2, 0);
  g.rotateX(pitch); g.rotateZ(roll);
  g.translate(x, y, z);
  part(list, g, col);
  const c = Math.cos(pitch);
  return { x: x + len * c * Math.sin(roll), y: y - len * c * Math.cos(roll), z: z - len * Math.sin(pitch) };
}

/**
 * A comic figure in one pose. look: { skin, hair, top, bottom, shoes, hood?, cap?, purse?, skirt? }.
 * pose: { lean, legs: [l, r] (pitch), arms: [[pitch, roll], [pitch, roll]], spread } (radians; roll
 * always swings a limb outward, raised or lowered).
 */
function figure(look, pose) {
  const L = [], lean = pose.lean || 0, spread = pose.spread || 0;
  const hip = 0.92, sh = 1.48;
  const out = (x, p, r) => (x < 0 ? -1 : 1) * r * (Math.cos(p) < 0 ? -1 : 1);
  // legs (from the hips)
  for (const [i, x] of [[0, -0.1], [1, 0.1]]) {
    const p = pose.legs[i];
    const f = limb(L, look.skirt ? look.skin : look.bottom, x, hip, 0, 0.84, 0.095, 0.07, p, out(x, p, spread));
    part(L, Sph(1, 8, 6), look.shoes, { x: f.x, y: f.y, z: f.z + 0.05, sx: 0.08, sy: 0.07, sz: 0.15 });
  }
  // body (leaning forward about the hips)
  const B = [];
  if (look.skirt) part(B, Cyl(0.18, 0.3, 0.4, 10), look.bottom, { y: 0.84 });
  else part(B, Cyl(0.2, 0.19, 0.24, 10), look.bottom, { y: 0.95, sz: 0.75 });
  part(B, Cyl(0.24, 0.19, 0.56, 10), look.top, { y: 1.3, sz: 0.66 });
  part(B, Cyl(0.06, 0.065, 0.12, 6), look.skin, { y: 1.62 });
  part(B, Sph(0.14, 10, 8), look.skin, { y: 1.77, sy: 1.12 });
  if (look.hood) part(B, Sph(0.17, 10, 8), look.top, { y: 1.8, z: -0.03, sy: 1.1 });
  else part(B, Sph(0.15, 10, 6), look.hair, { y: 1.82, z: -0.02, sy: 0.95 });
  if (look.cap) { part(B, Sph(0.155, 10, 6), look.cap, { y: 1.86, sy: 0.6 }); part(B, Box(0.2, 0.03, 0.14), look.cap, { y: 1.85, z: 0.15 }); }
  if (look.long) part(B, Sph(1, 8, 6), look.hair, { y: 1.62, z: -0.1, sx: 0.17, sy: 0.3, sz: 0.09 });
  for (const x of [-0.05, 0.05]) part(B, Sph(0.022, 5, 4), '#141016', { x, y: 1.79, z: 0.125 });
  // arms (from the shoulders)
  for (const [i, x] of [[0, -0.27], [1, 0.27]]) {
    const [p, r] = pose.arms[i];
    const h = limb(B, look.top, x, sh, 0, 0.66, 0.065, 0.05, p, out(x, p, r));
    part(B, Sph(0.06, 6, 5), look.skin, { x: h.x, y: h.y, z: h.z });
    if (look.purse && i === 1) part(B, Box(0.26, 0.2, 0.1), look.purse, { x: h.x, y: h.y - 0.14, z: h.z });
  }
  for (const g of B) { g.translate(0, -hip, 0); g.rotateX(lean); g.translate(0, hip, 0); }
  return merge([...L, ...B]);
}

const UP = -Math.PI * 0.95, FWD = -0.9, BACK = 0.7;
/** Pose library: name → pose (flipbook frames are name1..nameN). */
export const POSES = {
  stand: { legs: [0, 0], arms: [[0, 0.12], [0, 0.12]] },
  run1: { lean: 0.28, legs: [0.75, -0.55], arms: [[FWD, 0.12], [BACK, 0.12]] },
  run2: { lean: 0.28, legs: [0.15, -0.1], arms: [[-0.3, 0.12], [0.2, 0.12]] },
  run3: { lean: 0.28, legs: [-0.55, 0.75], arms: [[BACK, 0.12], [FWD, 0.12]] },
  run4: { lean: 0.28, legs: [-0.1, 0.15], arms: [[0.2, 0.12], [-0.3, 0.12]] },
  flail1: { legs: [0.4, -0.3], spread: 0.25, arms: [[UP, 0.7], [UP + 0.6, 0.3]] },
  flail2: { legs: [-0.3, 0.4], spread: 0.25, arms: [[UP + 0.6, 0.3], [UP, 0.7]] },
  hang: { legs: [0.1, -0.05], spread: 0.08, arms: [[UP, 0.12], [UP, 0.12]] },
  fall: { lean: -0.2, legs: [0.5, -0.4], spread: 0.45, arms: [[UP + 0.4, 1.0], [UP + 0.4, 1.0]] },
  cheer: { legs: [0, 0], spread: 0.08, arms: [[UP + 0.15, 0.45], [UP + 0.15, 0.45]] },
  wave: { legs: [0, 0], arms: [[0, 0.12], [UP + 0.2, 0.5]] },
};
export const RUN = ['run1', 'run2', 'run3', 'run4'], FLAIL = ['flail1', 'flail2'];

/** Every pose of one look, keyed by pose name. */
export function figurePoses(look) {
  const out = {};
  for (const [k, p] of Object.entries(POSES)) out[k] = figure(look, p);
  return out;
}

/** The looks the moments use (the impostor is her own model: impostor.js). */
export const LOOKS = {
  washer: { skin: '#e8b48c', hair: '#5a3a1a', top: '#3f7fd8', bottom: '#2a4a8a', shoes: '#2a2a2a', cap: '#ffcf2a' },
  thief: { skin: '#d9a07a', hair: '#1a1410', top: '#2b2f3a', bottom: '#1c1c24', shoes: '#e8e8e8', hood: true, purse: '#d8122e' },
  victim: { skin: '#f0c8a8', hair: '#8a3a1a', top: '#e05aa8', bottom: '#2a2440', shoes: '#c81e2a', long: true, skirt: true },
  mom: { skin: '#e8b48c', hair: '#2a1a10', top: '#3fb08a', bottom: '#2a3a5a', shoes: '#f0f0f0', long: true },
  promoter: { skin: '#c88a64', hair: '#121212', top: '#9a3fd8', bottom: '#141414', shoes: '#141414', cap: '#141414' },
};

/** A car (runaway: orange; getaway: black; van: navy + a stripe). len ~4.4 m. */
export function carGeo(style = 'runaway', stripe = '#ffd23f') {
  const L = [], van = style === 'van';
  const body = { runaway: '#e05b1a', getaway: '#16161c', van: '#1b2440', cab: '#e8e4d8' }[style] || '#e05b1a';
  const glass = '#1d2c48', dark = '#0e0e12';
  if (van) {
    part(L, Box(2.1, 2.1, 5.2), body, { y: 1.45 });
    part(L, Box(2.12, 0.34, 5.22), stripe, { y: 1.35 });
    part(L, Box(1.9, 0.75, 0.1), glass, { y: 1.95, z: 2.6 });
    part(L, Box(2.0, 0.3, 0.12), '#2a2a2a', { y: 0.55, z: 2.62 });
  } else {
    part(L, Box(1.9, 0.75, 4.4), body, { y: 0.75 });
    part(L, Box(1.7, 0.62, 2.2), style === 'getaway' ? '#2a2a34' : body, { y: 1.42, z: -0.2 });
    part(L, Box(1.6, 0.52, 0.1), glass, { y: 1.42, z: 0.92, rx: -0.35 });
    part(L, Box(1.72, 0.5, 1.9), glass, { y: 1.44, z: -0.25, sx: 1.02, sy: 0.9 });
  }
  const zl = van ? 2.62 : 2.21;
  for (const x of [-0.68, 0.68]) {
    part(L, Box(0.36, 0.2, 0.06), '#fff6c8', { x, y: van ? 0.95 : 0.85, z: zl });
    part(L, Box(0.36, 0.2, 0.06), '#ff2a2a', { x, y: van ? 0.95 : 0.85, z: -zl });
  }
  if (style === 'getaway') for (const x of [-0.5, 0.5]) part(L, Box(0.3, 0.14, 0.3), '#ffd23f', { x, y: 1.78, z: -0.2 });
  const wz = van ? 1.7 : 1.35;
  for (const x of [-0.92, 0.92]) for (const z of [-wz, wz]) part(L, Cyl(0.38, 0.38, 0.3, 10), dark, { x, y: 0.38, z, rz: Math.PI / 2 });
  return merge(L);
}

/** A helicopter (news: white + red; police: navy). ~13 m nose to tail. The rotor is separate (rotorGeo). */
export function heliGeo(kind = 'news') {
  const L = [], body = kind === 'police' ? '#1e2a4a' : '#eeeeea', trim = kind === 'police' ? '#3a6aff' : '#d8122e';
  part(L, Sph(1.6, 14, 10), body, { y: 1.9, sz: 1.55, sy: 0.95 });
  part(L, Sph(1.1, 12, 8), '#1d3a66', { y: 2.15, z: 1.35, sx: 1.05, sy: 0.7, sz: 0.8 }); // canopy
  part(L, Box(3.25, 0.32, 4.2), trim, { y: 1.55, sx: 0.98 });
  part(L, Cyl(0.32, 0.18, 6.4, 8), body, { y: 2.2, z: -4.6, rx: Math.PI / 2 });
  part(L, Box(0.14, 1.6, 0.9), trim, { y: 2.8, z: -7.6 });
  part(L, Box(1.5, 0.12, 0.6), body, { y: 2.3, z: -7.4 });
  for (const x of [-1.1, 1.1]) {
    part(L, Box(0.14, 0.12, 4.4), '#3a3a3a', { x, y: 0.12 });
    for (const z of [-1, 1]) part(L, Box(0.1, 0.8, 0.1), '#3a3a3a', { x: x * 0.8, y: 0.5, z, rz: x > 0 ? -0.4 : 0.4 });
  }
  part(L, Cyl(0.18, 0.18, 0.6, 6), '#2a2a2a', { y: 3.2 });
  part(L, Sph(0.22, 6, 5), '#111111', { y: 1.0, z: 2.3 }); // the camera ball
  return merge(L);
}
export function rotorGeo(span = 11.5) {
  const L = [];
  part(L, Box(span, 0.06, 0.4), '#26262a');
  part(L, Box(0.4, 0.06, span), '#26262a');
  return merge(L);
}

/** A camera drone (~1 m across before the kit scales it up): body, 4 arms + rotors, lens, a red light. */
export function droneGeo() {
  const L = [];
  part(L, Box(0.5, 0.2, 0.62), '#2b2b30');
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    const x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.48;
    part(L, Box(0.62, 0.07, 0.08), '#3a3a40', { x: x / 2, z: z / 2, ry: -a });
    part(L, Cyl(0.24, 0.24, 0.03, 12), '#b9bec8', { x, y: 0.12, z });
  }
  part(L, Sph(0.11, 8, 6), '#0c0c10', { y: -0.14, z: 0.24 });
  part(L, Sph(0.06, 6, 5), '#7fe0ff', { y: -0.15, z: 0.33 });
  part(L, Sph(0.06, 6, 5), '#ff2a2a', { y: 0.14, z: -0.2 });
  return merge(L);
}

/** A kitten (~0.5 m, scaled up by the kit): orange tabby with a white chest. */
export function catGeo() {
  const L = [], fur = '#f0923a', light = '#fff2dc';
  part(L, Sph(0.16, 10, 8), fur, { y: 0.2, sz: 1.5 });
  part(L, Sph(0.1, 8, 6), light, { y: 0.2, z: 0.15, sx: 1.1 });
  part(L, Sph(0.12, 10, 8), fur, { y: 0.38, z: 0.22 });
  for (const x of [-0.06, 0.06]) {
    part(L, new THREE.ConeGeometry(0.04, 0.09, 5), fur, { x, y: 0.5, z: 0.21 });
    part(L, Sph(0.018, 5, 4), '#141016', { x: x * 0.8, y: 0.4, z: 0.33 });
  }
  for (const x of [-0.08, 0.08]) for (const z of [-0.12, 0.12]) part(L, Cyl(0.03, 0.03, 0.18, 5), fur, { x, y: 0.09, z });
  part(L, Cyl(0.025, 0.018, 0.34, 5), fur, { y: 0.36, z: -0.3, rx: -0.6 });
  return merge(L);
}

/** A runaway pram: a tub, a hood and four wheels. */
export function strollerGeo() {
  const L = [];
  part(L, Box(0.6, 0.35, 0.9), '#5a9ae8', { y: 0.62 });
  part(L, Sph(0.42, 10, 6), '#e86ab0', { y: 0.82, z: -0.25, sy: 0.9, sx: 0.75 });
  part(L, Cyl(0.02, 0.02, 0.6, 4), '#d8d8d8', { y: 0.9, z: 0.55, rx: 0.5 });
  for (const x of [-0.3, 0.3]) for (const z of [-0.35, 0.35]) part(L, Cyl(0.13, 0.13, 0.06, 8), '#202024', { x, y: 0.15, z, rz: Math.PI / 2 });
  return merge(L);
}

/** The impostor's blonde wig (it flies off when she's caught). */
export function wigGeo() {
  const L = [], blonde = '#f2d24a';
  part(L, Sph(0.17, 10, 8), blonde, { sy: 0.9 });
  part(L, Sph(1, 8, 6), blonde, { y: -0.2, z: -0.06, sx: 0.18, sy: 0.3, sz: 0.11 });
  for (const x of [-0.13, 0.13]) part(L, Sph(1, 6, 5), blonde, { x, y: -0.16, sx: 0.06, sy: 0.22, sz: 0.08 });
  return merge(L);
}

/** The window-washer's platform. */
export function rigGeo() {
  const L = [];
  part(L, Box(3.2, 0.22, 0.75), '#8a8a8a');
  for (const z of [-0.36, 0.36]) part(L, Box(3.2, 0.06, 0.06), '#c8c8c8', { y: 0.55, z });
  for (const x of [-1.55, 1.55]) part(L, Box(0.06, 0.55, 0.75), '#c8c8c8', { x, y: 0.28 });
  part(L, Box(0.4, 0.35, 0.3), '#3f7fd8', { x: 0.9, y: 0.28 }); // a bucket
  return merge(L);
}

/** A stack of Polaroids lying on a roof (before the gust). */
export function stackGeo() {
  const L = [];
  for (let i = 0; i < 5; i++) part(L, Box(0.9, 0.04, 1.05), i % 2 ? '#f4f1e8' : '#e8e4d8', { y: i * 0.05, ry: i * 0.35 });
  return merge(L);
}

/** A Polaroid card's face (canvas): white frame, a dark club photo with a blonde figure, a scrawl. */
export function polaroidCanvas() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 152;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, 128, 152);
  const sky = g.createLinearGradient(0, 10, 0, 110); sky.addColorStop(0, '#3a1050'); sky.addColorStop(1, '#ff4fa8');
  g.fillStyle = sky; g.fillRect(9, 9, 110, 104);
  g.fillStyle = 'rgba(255,240,180,.85)'; g.beginPath(); g.arc(40, 36, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2d24a'; g.beginPath(); g.ellipse(70, 52, 13, 17, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f5ed0'; g.fillRect(58, 66, 24, 30);
  g.fillStyle = '#c81e2a'; g.beginPath(); g.moveTo(58, 96); g.lineTo(82, 96); g.lineTo(88, 112); g.lineTo(52, 112); g.fill();
  g.strokeStyle = '#2a1a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(26, 132); g.bezierCurveTo(46, 122, 70, 142, 102, 128); g.stroke();
  g.strokeStyle = '#141016'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 123, 147);
  return c;
}

/** The Puzzle Maker's "?" for the riddles (canvas): neon green, inked. */
export function qmarkCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 112px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = '#06140a'; g.strokeText('?', 64, 68);
  g.shadowColor = '#39ff6a'; g.shadowBlur = 18; g.fillStyle = '#39ff6a'; g.fillText('?', 64, 68);
  g.shadowBlur = 0; g.fillStyle = '#d8ffe0'; g.fillText('?', 61, 64);
  return c;
}
