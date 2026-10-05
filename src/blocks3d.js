// What stands on a block in the 3D city: each city.js footprint becomes a tower with a silhouette
// (setbacks, podium + tower, Art Deco crown, spire, octagon), a roof kit (water tower, antenna with
// a lit tip, helipad, garden, HVAC, penthouse, roof sign), district colours and window light, neon
// and named venue signs. Everything is appended to the chunk's Builder (one draw call per chunk).
import { hash2 } from './rng.js';
import { LOT } from './city.js';
import { M, STYLE, box, prism, gable, wedge, tree, mast, lamp, neonRing, neonPost, look, KIND } from './buildings3d.js';
import { SIGN_WORDS, signQuad, bladeSign } from './signs3d.js';

/**
 * Per district: height (multiplier over the 2D data, random spread, `core` = extra height near the
 * city centre so the skyline peaks), wall / roof / window-light palettes, facade style and
 * silhouette weights, roof kit odds, crown odds (the district's signature top on plain towers), neon. Districts must read apart from the air. Neon trim
 * (`trimOdds`) is the night hierarchy: the casino strip blazes, the vice districts glow, the rest
 * recede into the haze with only a few lit crowns.
 */
export const DISTRICT_3D = {
  financial: { mult: 2.6, spread: 0.9, core: 0.45, walls: ['#7fa3c8', '#5f84ad', '#a9c0d8', '#46658c', '#8ab4bc', '#c4d2e0'], roofs: ['#3f6a96', '#4f7fae', '#5a6a80'], lit: ['#b8d4f0', '#9fc4ea', '#f0e2c0'], styles: { glass: 6, concrete: 1, deco: 1 }, shapes: { slab: 2, podium: 3, setback: 2, spire: 2, octa: 2 }, kit: { helipad: 0.35, antenna: 0.45, hvac: 0.8, sign: 0.08 }, crown: { slant: 0.45 } , trim: ['#5ff0ff', '#e8f4ff'], trimOdds: 0.22},
  downtown: { mult: 2.2, spread: 1.1, core: 0.4, walls: ['#d2bf98', '#b88a6a', '#9fa6b4', '#e0d4b8', '#8d7a6a', '#c46a4a'], roofs: ['#a0603a', '#8a7a5a', '#6a6e7a'], lit: ['#ffcf7a', '#ffe0a0', '#ffd890'], styles: { deco: 3, concrete: 3, brick: 1, glass: 1 }, shapes: { setback: 3, deco: 3, slab: 2, podium: 1, spire: 1 }, kit: { water: 0.5, antenna: 0.45, hvac: 0.8, sign: 0.15, garden: 0.1 }, crown: { pyramid: 0.2 } , trim: ['#ffd890', '#ff8a5a'], trimOdds: 0.22},
  casino: { mult: 1.8, spread: 0.6, core: 0.4, walls: ['#e6c66a', '#c9a13b', '#b8784a', '#9a2232', '#d8b24a'], roofs: ['#c9a13b', '#9a2232'], lit: ['#ffd36a', '#ff9a5a'], styles: { glass: 2, deco: 2, concrete: 1 }, shapes: { podium: 3, octa: 2, setback: 1, slab: 1 }, kit: { helipad: 0.2, antenna: 0.2, hvac: 0.5, sign: 0.5 }, crown: { dome: 0.55 }, neon: ['#ffd84d', '#ff4d4d', '#ffffff'] , trim: ['#ffd84d', '#ff4d4d'], trimOdds: 0.95},
  entertainment: { mult: 1.5, spread: 1.0, core: 0.3, walls: ['#8e5ab5', '#c24f7a', '#e0a042', '#4e7fc4', '#5ab5a8'], roofs: ['#7a3a9a', '#a03a6a', '#3a5a9a'], lit: ['#ffd27a', '#ff9be0'], styles: { concrete: 2, brick: 2, deco: 1 }, shapes: { slab: 3, setback: 1, podium: 1 }, kit: { water: 0.35, hvac: 0.7, antenna: 0.25, sign: 0.35 }, neon: ['#ffcc33', '#33ddff', '#ff55aa'] , trim: ['#ffcc33', '#33ddff', '#ff55aa'], trimOdds: 0.5},
  residential: { mult: 1.5, spread: 1.1, core: 0.3, walls: ['#a4553f', '#b8704f', '#8d5a45', '#c9a27e', '#7a4a3a', '#b0603a'], roofs: ['#b04a32', '#8a3a2a', '#c0703a'], lit: ['#ffb45a', '#ffcf7a'], styles: { brick: 5, concrete: 1 }, shapes: { slab: 4, setback: 1 }, kit: { water: 0.65, garden: 0.2, hvac: 0.6, antenna: 0.3 } , trim: ['#ffb45a', '#ff7a8a'], trimOdds: 0.1},
  nightclub: { mult: 1.3, spread: 0.4, core: 0, walls: ['#2c2440', '#3a2c55', '#46305e', '#1f1b2e'], roofs: ['#3a2a6a', '#2a1a4a'], lit: ['#ff7ae0', '#7ae8ff', '#c08aff'], styles: { concrete: 2, brick: 2 }, shapes: { slab: 3, setback: 1 }, kit: { hvac: 0.6, antenna: 0.2, sign: 0.4 }, crown: { neonCap: 0.4 }, neon: true },
  redlight: { mult: 1.2, spread: 0.4, core: 0, walls: ['#5a1a2a', '#6a2030', '#3a1a22', '#7a2a3a'], roofs: ['#7a1a2a', '#5a1420'], lit: ['#ff5a6a', '#ffaa66'], styles: { brick: 3, concrete: 1 }, shapes: { slab: 3, setback: 1 }, kit: { water: 0.45, hvac: 0.4, sign: 0.4 }, neon: true },
  naughty: { mult: 1.2, spread: 0.4, core: 0, walls: ['#5a2a66', '#3d1a44', '#6a2a6a', '#4a1e52'], roofs: ['#6a2a7a', '#4a1e52'], lit: ['#ff7ae0', '#cc88ff'], styles: { concrete: 2, brick: 2 }, shapes: { slab: 3, setback: 1 }, kit: { hvac: 0.5, sign: 0.4 }, crown: { neonCap: 0.4 }, neon: true },
  retail: { mult: 1.0, spread: 0.8, core: 0, walls: ['#e8a07a', '#f0c86a', '#7ac8b8', '#e07a9a', '#9ab0e8', '#f0e0c0'], roofs: ['#3aa08a', '#e07a9a', '#e0b04a'], lit: ['#fff0c0'], styles: { concrete: 3, brick: 1 }, shapes: { slab: 1 }, kit: { hvac: 0.9, sign: 0.15 } , trim: ['#ff6fb0', '#4fe0c8', '#ffe05a'], trimOdds: 0.2},
  warehouse: { mult: 1.0, spread: 0.2, core: 0, walls: ['#8a5a3a', '#7a6a5a', '#9a7a50', '#6a6a70'], roofs: ['#9a5a2a', '#7a6a4a'], lit: ['#ffd080'], styles: { industrial: 3, brick: 2 }, shapes: { slab: 1 }, kit: { water: 0.45, hvac: 0.6 } , trim: ['#ffb03a'], trimOdds: 0.08},
  factory: { mult: 1.0, spread: 0.2, core: 0, walls: ['#6d6a60', '#807765', '#5b6260', '#8b5a3c'], roofs: ['#6a5a4a', '#7a4a3a'], lit: ['#ffc070'], styles: { industrial: 3, brick: 1 }, shapes: { slab: 1 }, kit: { hvac: 0.7, water: 0.35 } , trim: ['#ff7a3a'], trimOdds: 0.08},
  docks: { mult: 1.0, spread: 0.1, core: 0, walls: ['#6a7078'], roofs: ['#4a4d52'], lit: ['#ffd080'], styles: { industrial: 1 }, shapes: { slab: 1 }, kit: {} , trim: ['#3ad0ff'], trimOdds: 0.1},
  lair: { mult: 1.0, spread: 0.3, core: 0, walls: ['#1d2a22', '#253228', '#101512'], roofs: ['#1a3a22'], lit: ['#7aff9a'], styles: { concrete: 1, industrial: 1 }, shapes: { slab: 1 }, kit: { antenna: 0.5 }, neon: true },
  suburb: { mult: 1.0, spread: 0.1, core: 0, walls: null, roofs: ['#5a5a5a'], lit: ['#ffcf7a'], styles: { brick: 1, concrete: 1 }, shapes: { slab: 1 }, kit: {} },
  farm: { mult: 1.0, spread: 0.1, core: 0, walls: null, roofs: ['#5a5a5a'], lit: ['#ffcf7a'], styles: { concrete: 1 }, shapes: { slab: 1 }, kit: {} },
};
const MAX_H = 880; // world units: the overworld's 3D collision ceiling is 900

const isTall = (o) => o.kind === 'box' && !o.house && !o.container && !o.truck && !o.ship && !o.barn && !o.antenna;

/** The 3D height (world units) of a building from city.js; `core` 0..1 = nearness to downtown. */
export function height3(o, district, core = 0) {
  if (o.h3 !== undefined) return o.h3;
  const d = DISTRICT_3D[district] || DISTRICT_3D.retail;
  // a few standouts break the mid-rise grid from altitude (not in the core: they'd wall the cruise band)
  const stand = d.core <= 0.3 && d.mult >= 1.3 && hash2(o.x | 0, o.y | 0, 37) < 0.07 ? 1.8 : 1;
  o.h3 = isTall(o) ? Math.min(MAX_H, o.h * (d.mult + d.spread * (hash2(o.x | 0, o.y | 0, 31) - 0.5)) * (1 + d.core * core) * stand) : o.h;
  return o.h3;
}

const pick = (a, h) => a[Math.min(a.length - 1, Math.floor(h * a.length))];
function pickW(weights, h) {
  let sum = 0;
  for (const k in weights) sum += weights[k];
  let t = h * sum;
  for (const k in weights) if ((t -= weights[k]) < 0) return k;
  return Object.keys(weights)[0];
}

/** Which side of the block's lot this footprint faces the street on. */
function streetFace(o, blk) {
  if (o.face) return o.face;
  const gaps = { n: o.y - blk.y0, s: blk.y0 + LOT - (o.y + o.d), w: o.x - blk.x0, e: blk.x0 + LOT - (o.x + o.w) };
  let best = 'n';
  for (const k in gaps) if (gaps[k] < gaps[best]) best = k;
  return best;
}

/** Tiers as [inset (fraction of the short side), top (fraction of the height)]. */
const TIERS = {
  slab: [[0, 1]],
  setback: [[0, 0.58], [0.12, 0.8], [0.22, 1]],
  deco: [[0, 0.55], [0.1, 0.72], [0.18, 0.86], [0.26, 1]],
  spire: [[0, 0.82], [0.14, 1]],
  podium: [[0, 0.2], [0.17, 1]],
};

/** The current building's first setback height (m; 0 = none), for its cornice trim. */
let ledge = 0;
/** The current building's wall tiers [x0, z0, x1, z1, bot, top] (m): neon goes on a real wall. */
let tiers = [];
/** The tier whose walls stand at height y (null: none, e.g. a crown or a round tower). */
const foot = (y) => tiers.find((t) => y >= t[4] && y <= t[5]) || null;

/** One city.js box building → tiers + crown + roof kit + neon + signs. Returns nothing. */
export function building(B, o, blk, S) {
  const D = DISTRICT_3D[blk.d] || DISTRICT_3D.retail;
  const x = o.x | 0, y = o.y | 0, h = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => hash2(x, y, 100 + k));
  const x0 = o.x * M, z0 = o.y * M, x1 = (o.x + o.w) * M, z1 = (o.y + o.d) * M, H = o.h3 * M, Smin = Math.min(x1 - x0, z1 - z0);
  const wall = D.walls ? pick(D.walls, h[0]) : o.col;
  let style = STYLE[pickW(D.styles, h[1])];
  if (o.glass && D.styles.glass) style = h[1] < 0.7 ? STYLE.glass : style;
  const L = look(o.gold ? '#e6c66a' : wall, pick(D.lit, h[2]), style, o.roofCol || pick(D.roofs, h[3]), h[4] < 0.55 ? STYLE.gravel : STYLE.tar, Math.floor(h[5] * 8) / 8, Math.floor(h[6] * 16) / 16);
  // roofs: the district's roof colour, pulled toward its own wall colour (no candy caps)
  L.roofTint.lerp(L.tint, 0.45).multiplyScalar(0.85);
  const face = streetFace(o, blk);
  tiers = [[x0, z0, x1, z1, 0, H]];
  if (o.container || o.truck) { L.style = STYLE.industrial; box(B, x0, z0, x1, z1, 0, H, L, { ink: 0.6 }); return; }
  if (o.house || o.barn) {
    if (o.barn) L.style = STYLE.industrial;
    else L.style = h[1] < 0.5 ? STYLE.brick : STYLE.concrete;
    gable(B, x0, z0, x1, z1, H * 0.62, H * 1.05, L);
    return;
  }
  if (o.antenna) { mast(B, (x0 + x1) / 2, (z0 + z1) / 2, 0, H, 0.8, '#39ff6a'); return; }
  // silhouette
  let shape = H < 22 || Smin < 12 ? 'slab' : pickW(D.shapes, h[7]);
  if ((shape === 'setback' || shape === 'deco') && H < 45) shape = 'slab';
  if (shape === 'spire' && H < 80) shape = 'setback';
  if ((shape === 'podium' || shape === 'octa') && (Smin < 26 || H < 50)) shape = 'slab';
  let top = H, rx0 = x0, rz0 = z0, rx1 = x1, rz1 = z1;
  ledge = 0; tiers = [];
  if (shape === 'octa') {
    // a round glass tower on a square plinth
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, pod = Math.min(18, H * 0.15);
    box(B, x0, z0, x1, z1, 0, pod, { ...L, style: STYLE.concrete });
    tiers.push([x0, z0, x1, z1, 0, pod]);
    const r = Smin * 0.46;
    prism(B, cx, cz, r, r, pod, H, 8, L, { rot: Math.PI / 8 });
    neonRing(B, cx - r * 0.7, cz - r * 0.7, cx + r * 0.7, cz + r * 0.7, H + 0.3, pick(D.lit, h[3]), 0.3);
    rx0 = cx - r * 0.6; rx1 = cx + r * 0.6; rz0 = cz - r * 0.6; rz1 = cz + r * 0.6;
  } else {
    let bot = 0;
    ledge = TIERS[shape].length > 1 ? H * TIERS[shape][0][1] : 0;
    for (const [inset, f] of TIERS[shape]) {
      const i = inset * Smin, t = H * f;
      rx0 = x0 + i; rz0 = z0 + i; rx1 = x1 - i; rz1 = z1 - i;
      const podium = shape === 'podium' && bot === 0;
      const TL = podium ? { ...L, style: STYLE.concrete, roofTint: L.roofTint } : L;
      box(B, rx0, rz0, rx1, rz1, bot, t, TL, { roof: true });
      tiers.push([rx0, rz0, rx1, rz1, bot, t]);
      if (podium && h[4] < 0.6) B.detail(() => roofGarden(B, x0, z0, x1, z1, t, h, rx0, rz0, rx1, rz1));
      bot = t;
    }
  }
  const cx = (rx0 + rx1) / 2, cz = (rz0 + rz1) / 2, w = rx1 - rx0, d = rz1 - rz0;
  // crowns
  if (shape === 'deco') {
    let b = top;
    const gold = '#ffd890';
    for (let k = 0; k < 2; k++) {
      const i = (0.12 + k * 0.1) * Math.min(w, d), t = b + H * 0.045;
      box(B, rx0 + i, rz0 + i, rx1 - i, rz1 - i, b, t, L);
      neonRing(B, rx0 + i, rz0 + i, rx1 - i, rz1 - i, t - 0.5, gold, 0.6);
      b = t;
    }
    const r = Math.min(w, d) * 0.28;
    prism(B, cx, cz, r * 1.41, 0, b, b + H * 0.08, 4, L, { rot: Math.PI / 4 });
    mast(B, cx, cz, b + H * 0.08, b + H * 0.12, 0.5, '#ff3030', '#c8c0b0');
    return roofExtras(B, o, blk, S, D, L, h, face, x0, z0, x1, z1, H, null);
  }
  if (shape === 'spire') {
    const r = Math.min(w, d) / 2;
    prism(B, cx, cz, r * 1.41, r * 0.1, top, top + H * 0.14, 4, L, { rot: Math.PI / 4 });
    mast(B, cx, cz, top + H * 0.14, top + H * 0.18, 0.5);
    return roofExtras(B, o, blk, S, D, L, h, face, x0, z0, x1, z1, H, null);
  }
  if (D.crown && (shape === 'slab' || shape === 'podium' || shape === 'setback') && H >= 60 && Math.min(w, d) >= 14 && crown(B, D, L, h, rx0, rz0, rx1, rz1, top, H)) {
    return roofExtras(B, o, blk, S, D, L, h, face, x0, z0, x1, z1, H, null);
  }
  roofExtras(B, o, blk, S, D, L, h, face, x0, z0, x1, z1, H, [rx0, rz0, rx1, rz1, top]);
}

/**
 * A district's signature top (`D.crown` odds) on a plain tower, so each district's skyline has its
 * own read from altitude: financial glass wedges, casino gold domes, downtown pyramids, the club
 * districts' neon-edged caps. Returns whether one was built (the roof kit is skipped then).
 */
function crown(B, D, L, h, x0, z0, x1, z1, top, H) {
  const r = hash2(x0 * 7 | 0, z0 * 7 | 0, 91), C = D.crown, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, m = Math.min(x1 - x0, z1 - z0);
  let acc = 0;
  const pick = (k) => C[k] && r < (acc += C[k]);
  if (pick('slant')) {
    wedge(B, x0, z0, x1, z1, top, Math.min(m * 0.55, H * 0.14), { ...L, style: STYLE.glass }, Math.floor(h[5] * 4));
    return true;
  }
  if (pick('dome')) {
    const G = { ...L, tint: L.tint.clone().set('#e6c66a'), style: STYLE.deco, roofTint: L.tint.clone().set('#ffd84d') }, R = m * 0.46;
    box(B, cx - R, cz - R, cx + R, cz + R, top, top + 3, L, { ink: 1 });
    for (let k = 0; k < 4; k++) prism(B, cx, cz, R * Math.cos(k * 0.38) * 0.9, R * Math.cos((k + 1) * 0.38) * 0.9, top + 3 + R * 0.22 * k, top + 3 + R * 0.22 * (k + 1), 10, G, { cap: k === 3, ink: k === 0 ? 1 : 0 });
    neonRing(B, cx - R * 0.66, cz - R * 0.66, cx + R * 0.66, cz + R * 0.66, top + 3.4, '#ffd84d', 0.6);
    mast(B, cx, cz, top + 3 + R * 0.88, top + 3 + R * 0.88 + 8, 0.4, '#ffd84d', '#c9a13b');
    return true;
  }
  if (pick('pyramid')) {
    prism(B, cx, cz, m * 0.5 * 1.41, 0, top, top + m * 0.45, 4, { ...L, tint: L.roofTint.clone().multiplyScalar(1.25) }, { rot: Math.PI / 4 });
    return true;
  }
  if (pick('neonCap')) {
    const s = m * 0.36, col = Array.isArray(D.neon) ? D.neon[0] : h[3] < 0.5 ? '#ff2fd0' : '#27e0ff';
    box(B, cx - s, cz - s, cx + s, cz + s, top, top + 5, L, { ink: 1 });
    prism(B, cx, cz, s * 1.41, 0, top + 5, top + 5 + s, 4, L, { rot: Math.PI / 4, ink: 1 });
    neonRing(B, cx - s, cz - s, cx + s, cz + s, top + 4.6, col, 0.6);
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) neonPost(B, cx + px * s, cz + pz * s, top, top + 4.4, col, 0.5);
    return true;
  }
  return false;
}

/** Lawn, planters and a few trees on a roof terrace. */
function roofGarden(B, x0, z0, x1, z1, t, h, ex0, ez0, ex1, ez1) {
  const G = look('#5e8f4a', '#000', STYLE.gravel, '#5e8f4a', STYLE.gravel);
  box(B, x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, t, t + 0.25, G, { walls: false, ink: 0 });
  for (let k = 0; k < 4; k++) {
    const u = hash2(k, h[0] * 1000 | 0, 3), v = hash2(k, h[1] * 1000 | 0, 4);
    const tx = x0 + 3 + u * (x1 - x0 - 6), tz = z0 + 3 + v * (z1 - z0 - 6);
    if (tx > ex0 - 2 && tx < ex1 + 2 && tz > ez0 - 2 && tz < ez1 + 2) continue; // not inside the tower
    tree(B, tx, tz, 2.2, t + 5, k % 2 ? '#3f7f3a' : '#4f8f3a');
  }
}

/** Roof kit (when `roof` = [x0, z0, x1, z1, top] is free), neon, and signs. */
function roofExtras(B, o, blk, S, D, L, h, face, x0, z0, x1, z1, H, roof) {
  const K = D.kit;
  if (roof && B.lite && Math.min(roof[2] - roof[0], roof[3] - roof[1]) >= 10 && H > 20) {
    // far LOD: one plain penthouse block (no ink), so distant roofs keep their clutter's mass
    const [rx0, rz0, rx1, rz1, top] = roof, w = rx1 - rx0, d = rz1 - rz0, r = (k) => hash2(o.x | 0, o.y | 0, 200 + k);
    const pw = w * (0.3 + r(3) * 0.15), pd = d * (0.3 + r(4) * 0.12), px = rx0 + w * (0.1 + r(5) * 0.4), pz = rz0 + d * (0.1 + r(6) * 0.4);
    B.detail(() => box(B, px, pz, px + pw, pz + pd, top, top + 3 + r(7) * 4, { ...L, style: STYLE.concrete, tint: L.roofTint.clone().multiplyScalar(1.5) }, { ink: 0 }));
  }
  // the roof kit is detail: skipped from high patrol and far off (the draw range, no rebuild)
  if (roof && !B.lite) B.detail(() => {
    const [rx0, rz0, rx1, rz1, top] = roof, w = rx1 - rx0, d = rz1 - rz0, m = Math.min(w, d);
    const r = (k) => hash2(o.x | 0, o.y | 0, 200 + k);
    if (K.helipad && r(1) < K.helipad && m >= 16 && H > 60) {
      const s = m * 0.4, cx = (rx0 + rx1) / 2, cz = (rz0 + rz1) / 2;
      box(B, cx - s, cz - s, cx + s, cz + s, top, top + 0.4, L, { roof: 'pad', ink: 0.6 });
      for (const [lx, lz] of [[cx - s, cz - s], [cx + s, cz - s], [cx + s, cz + s], [cx - s, cz + s]]) lamp(B, lx, top + 0.8, lz, 0.35, '#7aff9a');
    } else if (K.garden && r(2) < K.garden && m >= 12) {
      roofGarden(B, rx0, rz0, rx1, rz1, top, h, 0, 0, -1, -1);
    } else if (m >= 10) {
      // mechanical penthouse + HVAC boxes
      const P = { ...L, style: STYLE.concrete, tint: L.roofTint.clone().multiplyScalar(1.5) };
      const pw = w * (0.3 + r(3) * 0.15), pd = d * (0.3 + r(4) * 0.12), px = rx0 + w * (0.1 + r(5) * 0.4), pz = rz0 + d * (0.1 + r(6) * 0.4);
      box(B, px, pz, px + pw, pz + pd, top, top + 3 + r(7) * 4, P);
      if (r(8) < (K.hvac ?? 0.5)) {
        const HV = { ...P, style: STYLE.industrial, tint: P.tint.clone().multiplyScalar(1.15) };
        const n = 3 + Math.floor(r(9) * (m > 24 ? 5 : 3));
        for (let k = 0; k < n; k++) {
          const hx = rx0 + 2 + hash2(k, o.x | 0, 7) * (w - 6), hz = rz0 + 2 + hash2(k, o.y | 0, 8) * (d - 6);
          if (hx + 2.5 > px && hx < px + pw && hz + 2.5 > pz && hz < pz + pd) continue;
          box(B, hx, hz, hx + 2.5, hz + 2, top, top + 1.6, HV, { ink: 0.5 });
        }
      }
    }
    if (K.water && r(10) < K.water && m >= 10) waterTower(B, rx1 - 4, rz1 - 4, top);
    if (K.antenna && r(11) < K.antenna && r(16) < 0.4 && m >= 14) mast(B, rx1 - 3, rz0 + 3, top, top + 4 + r(17) * 5, 0.35, null); // a second, unlit
  });
  // the lit antennas (their beacons blink across the city at night) and roof boards stay in the body
  if (roof && !B.lite) {
    const [rx0, rz0, rx1, rz1, top] = roof, m = Math.min(rx1 - rx0, rz1 - rz0), r = (k) => hash2(o.x | 0, o.y | 0, 200 + k);
    if (K.antenna && r(11) < K.antenna) mast(B, rx0 + 2, rz0 + 2, top, top + 6 + r(12) * 8);
    if (K.sign && r(13) < K.sign && !o.sign && m >= 12) {
      const words = SIGN_WORDS[blk.d];
      if (words) roofBoard(B, S, pick(words, r(14)), neonOf(D, r(15)), rx0, rz0, rx1, rz1, face, top, Math.min(8, m * 0.3));
    }
  }
  // vice neon: tubes round the roof edge and a band two floors down, corner posts on some
  // every district gets the vice district's trick in its own colours: neon trim on some roofs
  // (every ring on the wall of the tier at its height: rings round the base footprint floated in
  // the air round the stepped-in tiers above, lines across the gaps between towers)
  const ring = (y, col, t) => { const f = foot(y); if (f) neonRing(B, f[0], f[1], f[2], f[3], y, col, t); };
  if (!o.neon && D.trim && hash2(o.x | 0, o.y | 0, 77) < D.trimOdds && H > 20) {
    ring((roof ? roof[4] : H) - 1, pick(D.trim, h[3]), 0.6);
    // a second ring: a cornice light on the first setback's ledge (a lone ring at 30% of a plain
    // slab read as a stray orange line across the tower); the vice districts keep their mid band
    if (H > 60 && h[4] < 0.5 && (ledge || D.neon)) ring(ledge ? ledge - 0.6 : Math.max(4, H * 0.3), pick(D.trim, h[5]), ledge ? 0.8 : 0.5);
  }
  if (o.neon) {
    const roofY = Math.min(H, roof ? roof[4] : H), f = foot(4);
    ring(roofY - 1.2, o.neon);
    ring(Math.max(3, H * 0.62), o.neon2 || o.neon);
    // corner posts up the bottom tier only (up a whole stepped tower they stood off in the air)
    if (h[5] < 0.4 && !B.lite && f) for (const [px, pz] of [[f[0], f[1]], [f[2], f[3]]]) neonPost(B, px, pz, 4, Math.min(roofY, f[5]) - 1, o.neon2 || o.neon);
  }
  // signs: the 2D view's named venue / mall signs on the street face and the roof
  const vice = o.neon || D.neon;
  if (o.sign) {
    const top = roof ? roof[4] : H;
    signQuad(B, S, o.sign, o.neon || neonOf(D, h[3]) || '#ffd84d', x0, z0, x1, z1, face, Math.max(4, Math.min(top - 10, top * 0.55)), Math.min(9, Math.max(4, top * 0.18)));
    if (roof && !B.lite) roofBoard(B, S, o.sign, o.neon || '#ffd84d', roof[0], roof[1], roof[2], roof[3], face, roof[4], Math.min(12, (roof[2] - roof[0]) * 0.22));
  } else if (vice && !B.lite) {
    const words = SIGN_WORDS[blk.d];
    if (words && h[6] < 0.55) {
      const word = pick(words, h[7]), col = o.neon2 || neonOf(D, h[4]) || '#ff55aa';
      if (h[6] < 0.3 && S.vslot(word)) bladeSign(B, S, word, col, x0, z0, x1, z1, face, 4, Math.min(H - 6, 16));
      else signQuad(B, S, word, col, x0, z0, x1, z1, face, Math.max(3.5, Math.min(H - 8, 9)), Math.min(5, H * 0.2));
    }
  }
}

function neonOf(D, h) { return Array.isArray(D.neon) ? pick(D.neon, h) : D.neon ? pick(['#ff2fd0', '#27e0ff', '#ffcc33'], h) : '#ffd84d'; }

/** A billboard standing on the roof's street edge, on two legs, dark-backed. */
function roofBoard(B, S, word, col, x0, z0, x1, z1, face, top, hgt) {
  const lift = 1.6, inset = 1.2;
  const r = [x0 + inset, z0 + inset, x1 - inset, z1 - inset];
  const hh = signQuad(B, S, word, col, r[0], r[1], r[2], r[3], face, top + lift, Math.max(3, hgt), { out: -0.2, back: true });
  if (!hh) return;
  const LEG = look('#3a3d44', '#000', STYLE.industrial, '#3a3d44');
  const legs = face === 'n' || face === 's' ? [[(r[0] + r[2]) / 2 - 3, face === 'n' ? r[1] + 0.4 : r[3] - 0.4], [(r[0] + r[2]) / 2 + 3, face === 'n' ? r[1] + 0.4 : r[3] - 0.4]]
    : [[face === 'w' ? r[0] + 0.4 : r[2] - 0.4, (r[1] + r[3]) / 2 - 3], [face === 'w' ? r[0] + 0.4 : r[2] - 0.4, (r[1] + r[3]) / 2 + 3]];
  for (const [lx, lz] of legs) box(B, lx - 0.2, lz - 0.2, lx + 0.2, lz + 0.2, top, top + lift + 0.2, LEG, { roof: false, ink: 0 });
}

/** The New York rooftop water tank: legs, a wooden barrel, a conical hat. */
function waterTower(B, x, z, top) {
  const W = look('#8a5a3a', '#000', STYLE.brick, '#4a3a30', STYLE.tar);
  const LEG = look('#3a3530', '#000', STYLE.industrial);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) box(B, x + dx - 0.15, z + dz - 0.15, x + dx + 0.15, z + dz + 0.15, top, top + 3.5, LEG, { roof: false, ink: 0.4 });
  prism(B, x, z, 2.4, 2.4, top + 3.5, top + 7.5, 8, W, { cap: false });
  prism(B, x, z, 2.6, 0, top + 7.5, top + 9.2, 8, { ...W, tint: W.roofTint });
}

/** Round structures: smokestacks (banded), silos (cone cap), the lair's dome. */
export function round(B, o) {
  const x = o.x * M, z = o.y * M, r = o.rad * M, H = o.h3 * M;
  if (o.dome) {
    const L = look(o.col, '#7aff9a', STYLE.concrete, o.col);
    for (let k = 0; k < 4; k++) prism(B, x, z, r * Math.cos(k * 0.38), r * Math.cos((k + 1) * 0.38), H * 0.25 * k, H * 0.25 * (k + 1), 10, L, { cap: k === 3, ink: k === 0 ? 1 : 0 });
    neonRing(B, x - r * 0.7, z - r * 0.7, x + r * 0.7, z + r * 0.7, 1.5, o.neon || '#39ff6a', 0.6);
    return;
  }
  const L = look(o.col, '#ffc070', STYLE.industrial, o.stack ? '#1a1a1a' : '#9a9a92');
  if (o.stack) {
    prism(B, x, z, r, r * 0.8, 0, H * 0.86, 8, L, { cap: false });
    prism(B, x, z, r * 0.8, r * 0.78, H * 0.86, H, 8, { ...L, tint: L.tint.clone().set('#c8322a') });
    lamp(B, x, H + 0.8, z, 0.7, '#ff3030', KIND.beacon, (x * 0.1) % 1);
  } else {
    prism(B, x, z, r, r, 0, H, 8, L);
    prism(B, x, z, r * 1.04, 0, H, H + r * 0.6, 8, { ...L, tint: L.roofTint });
  }
}

/** A dockside gantry crane along the block edge (city.js `crane`). */
export function crane(B, o) {
  const L = look(o.col || '#e0b020', '#000', STYLE.industrial, o.col || '#e0b020');
  const x = o.x * M, z = (o.y + o.y2) / 2 * M, H = o.h * M, t = 0.7;
  for (const [dx, dz] of [[-5, -7], [5, -7], [5, 7], [-5, 7]]) box(B, x + dx - t, z + dz - t, x + dx + t, z + dz + t, 0, H * 0.7, L, { ink: 0.6 });
  box(B, x - 6, z - 8, x + 6, z + 8, H * 0.7, H * 0.78, L);
  box(B, x - 18, z - 1.5, x + 45, z + 1.5, H * 0.74, H * 0.8, L, { ink: 0.7 });
  box(B, x - 3, z - 3, x + 3, z + 3, H * 0.78, H * 0.9, look('#d8d4c8', '#ffd080', STYLE.concrete, '#3a3d44'));
  mast(B, x, z, H * 0.9, H, 0.3);
}

export { tree };
