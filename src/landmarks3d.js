// Signature towers: one per district, near its heart, each with a silhouette you can name from
// across the city (needle, deco crown, gold octagon, marquee tower, neon ziggurat, twin towers,
// the red hotel, the villain spike, the lighthouse). They replace a city.js footprint (so she can
// perch on them / bump into them at their body height), live in one always-drawn mesh that the
// haze barely touches, and are the city's navigation marks.
import { hash2 } from './rng.js';
import { M, STYLE, Builder, box, prism, mast, lamp, neonRing, neonPost, look, KIND } from './buildings3d.js';
import { signQuad, bladeSign } from './signs3d.js';

/** district → [kind, body height m, colour, window light]. Body tops stay under the 450 m collision ceiling. */
export const LANDMARKS = {
  financial: ['needle', 405, '#9ec4e8', '#d8ecff'],
  downtown: ['deco', 330, '#e8dcc0', '#ffd890'],
  casino: ['casino', 230, '#e6c66a', '#ffd36a'],
  entertainment: ['marquee', 170, '#8e5ab5', '#ffd27a'],
  nightclub: ['ziggurat', 150, '#3a2c55', '#ff7ae0'],
  residential: ['twin', 210, '#b0603a', '#ffb45a'],
  redlight: ['hotel', 150, '#6a2030', '#ff5a6a'],
  lair: ['spike', 170, '#1d2420', '#7aff9a'],
  docks: ['lighthouse', 58, '#f0ece0', '#fff2a0'],
};

/** Pick each district's landmark footprint (biggest tall box near its seed) and raise it. */
export function chooseLandmarks(city) {
  const out = [];
  for (const [type, [kind, h]] of Object.entries(LANDMARKS)) {
    const seed = city.seeds.find((s) => s.type === type);
    if (!seed) continue;
    if (kind === 'lighthouse') {
      out.push({ kind, district: type, x: city.coastX - 14, y: (seed.y + 0.5) * 240, o: null, h });
      continue;
    }
    let best = null, bs = -1;
    for (const blk of city.blocks) {
      if (blk.d !== type || Math.hypot(blk.bx + 0.5 - seed.x, blk.by + 0.5 - seed.y) > 3) continue;
      for (const o of blk.b) {
        if (o.kind !== 'box' || o.house || o.container || o.truck || o.barn || o.antenna) continue;
        const score = Math.min(o.w, o.d) - Math.hypot(blk.bx + 0.5 - seed.x, blk.by + 0.5 - seed.y) * 6;
        if (Math.min(o.w, o.d) >= 50 && score > bs) { bs = score; best = { o, blk }; }
      }
    }
    if (!best) continue;
    best.o.landmark = kind;
    best.o.h3 = h / M; // the overworld collides/perches at the body top
    out.push({ kind, district: type, x: best.o.x + best.o.w / 2, y: best.o.y + best.o.d / 2, o: best.o, blk: best.blk, h });
  }
  return out;
}

/** Build every landmark into one Builder. */
export function buildLandmarks(list, S) {
  const B = new Builder();
  for (const lm of list) {
    const [, H, col, lit] = LANDMARKS[lm.district];
    if (lm.kind === 'lighthouse') { lighthouse(B, lm.x * M, lm.y * M, H); continue; }
    const o = lm.o, x0 = o.x * M, z0 = o.y * M, x1 = (o.x + o.w) * M, z1 = (o.y + o.d) * M;
    BUILD[lm.kind](B, S, { x0, z0, x1, z1, H, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, S: Math.min(x1 - x0, z1 - z0), col, lit, seed: hash2(o.x | 0, o.y | 0, 5) });
  }
  return B;
}

/** Stack square tiers centred on (cx, cz): [half-size, top] each, from `bot`. */
function tiers(B, cx, cz, bot, list, L, neon = null) {
  for (const [hs, top] of list) {
    box(B, cx - hs, cz - hs, cx + hs, cz + hs, bot, top, L, { ink: 1.3 });
    if (neon) neonRing(B, cx - hs, cz - hs, cx + hs, cz + hs, top - 0.5, neon, 0.5);
    bot = top;
  }
  return bot;
}

const BUILD = {
  needle(B, S, p) {
    const L = look(p.col, p.lit, STYLE.glass, '#4a5260', STYLE.tar), s = p.S / 2, H = p.H;
    const top = tiers(B, p.cx, p.cz, 0, [[s, H * 0.5], [s * 0.8, H * 0.75], [s * 0.62, H * 0.9], [s * 0.46, H]], L, '#bfe8ff');
    prism(B, p.cx, p.cz, s * 0.46 * 1.41, 0.6, top, top + H * 0.24, 4, { ...L, style: STYLE.deco }, { rot: Math.PI / 4, ink: 1.3 });
    mast(B, p.cx, p.cz, top + H * 0.24, top + H * 0.33, 0.5, '#ff3030', '#d8dce4');
  },
  deco(B, S, p) {
    const L = look(p.col, p.lit, STYLE.deco, '#5a5550', STYLE.gravel), s = p.S / 2, H = p.H;
    let b = tiers(B, p.cx, p.cz, 0, [[s, H * 0.6], [s * 0.78, H * 0.8], [s * 0.64, H * 0.92], [s * 0.54, H]], L);
    // the sunburst crown: stacked octagons, each trimmed in light
    const C = { ...L, tint: L.tint.clone().set('#d8dce4'), style: STYLE.glass };
    for (let k = 0; k < 5; k++) {
      const r0 = s * (0.5 - k * 0.085), r1 = s * (0.5 - (k + 1) * 0.085), t = b + H * 0.04;
      prism(B, p.cx, p.cz, r0, r1 + s * 0.04, b, t, 8, C, { rot: Math.PI / 8, ink: 1.2 });
      neonRing(B, p.cx - r1 * 0.95, p.cz - r1 * 0.95, p.cx + r1 * 0.95, p.cz + r1 * 0.95, t - 0.3, '#fff0c0', 0.35);
      b = t;
    }
    prism(B, p.cx, p.cz, s * 0.08, 0.1, b, b + H * 0.14, 4, C, { ink: 1 });
    lamp(B, p.cx, b + H * 0.14 + 0.8, p.cz, 1.2, '#ff3030', KIND.beacon);
  },
  casino(B, S, p) {
    const H = p.H, pod = 28;
    const P = look('#9a2232', p.lit, STYLE.concrete, '#4a1a20', STYLE.tar);
    box(B, p.x0, p.z0, p.x1, p.z1, 0, pod, P, { ink: 1.2 });
    neonRing(B, p.x0, p.z0, p.x1, p.z1, pod - 0.6, '#ffd84d', 0.6);
    neonRing(B, p.x0, p.z0, p.x1, p.z1, 6, '#ff4d4d', 0.5);
    for (const f of ['n', 's', 'e', 'w']) signQuad(B, S, 'CASINO', '#ffd84d', p.x0, p.z0, p.x1, p.z1, f, 11, 12);
    const L = look(p.col, p.lit, STYLE.glass, '#6a4a2a', STYLE.tar), r = p.S * 0.36;
    prism(B, p.cx, p.cz, r, r, pod, H, 8, L, { rot: Math.PI / 8, ink: 1.3 });
    for (const y of [H - 1, H - 9, H * 0.6]) neonRing(B, p.cx - r * 0.93, p.cz - r * 0.93, p.cx + r * 0.93, p.cz + r * 0.93, y, y > H - 2 ? '#ffd84d' : '#ff4d4d', 0.7);
    const q = r * 0.7;
    prism(B, p.cx, p.cz, r * 0.75, r * 0.3, H, H + 18, 8, { ...L, tint: L.tint.clone().set('#ffd84d') }, { rot: Math.PI / 8 });
    for (const f of ['n', 's', 'e', 'w']) signQuad(B, S, 'JACKPOT', '#ffd84d', p.cx - q, p.cz - q, p.cx + q, p.cz + q, f, H - 8, 6, { out: 0.6 });
    mast(B, p.cx, p.cz, H + 18, H + 34, 0.5, '#ffd84d', '#c9a13b');
  },
  marquee(B, S, p) {
    const H = p.H, L = look(p.col, p.lit, STYLE.deco, '#3a3048', STYLE.tar);
    const i = p.S * 0.08;
    box(B, p.x0, p.z0, p.x1, p.z1, 0, 14, { ...L, style: STYLE.concrete }, { ink: 1.2 });
    neonRing(B, p.x0, p.z0, p.x1, p.z1, 13.4, '#ffcc33', 0.7);
    neonRing(B, p.x0, p.z0, p.x1, p.z1, 9, '#ff55aa', 0.5);
    box(B, p.x0 + i, p.z0 + i, p.x1 - i, p.z1 - i, 14, H, L, { ink: 1.3 });
    for (const f of ['n', 's']) signQuad(B, S, 'ROXY', '#33ddff', p.x0, p.z0, p.x1, p.z1, f, 15, 10);
    for (const f of ['n', 's', 'e', 'w']) bladeSign(B, S, 'PALACE', '#ffcc33', p.x0 + i, p.z0 + i, p.x1 - i, p.z1 - i, f, H * 0.3, H * 0.6);
    neonRing(B, p.x0 + i, p.z0 + i, p.x1 - i, p.z1 - i, H - 0.6, '#ff55aa', 0.6);
    const s = (p.S / 2 - i) * 0.5;
    box(B, p.cx - s, p.cz - s, p.cx + s, p.cz + s, H, H + 10, L, { ink: 1.1 });
    prism(B, p.cx, p.cz, s * 0.6, 0, H + 10, H + 26, 4, { ...L, tint: L.tint.clone().set('#e0a042') }, { rot: Math.PI / 4 });
    lamp(B, p.cx, H + 27, p.cz, 1.4, '#ffcc33', KIND.beacon);
  },
  ziggurat(B, S, p) {
    const H = p.H, L = look(p.col, p.lit, STYLE.concrete, '#1a1624', STYLE.tar), s = p.S / 2, n = 6;
    const list = [];
    for (let k = 0; k < n; k++) list.push([s * (1 - k * 0.13), H * (0.35 + 0.65 * (k + 1) / n)]);
    let bot = 0;
    list.forEach(([hs, top], k) => {
      box(B, p.cx - hs, p.cz - hs, p.cx + hs, p.cz + hs, bot, top, L, { ink: 1.3 });
      neonRing(B, p.cx - hs, p.cz - hs, p.cx + hs, p.cz + hs, top - 0.5, k % 2 ? '#27e0ff' : '#ff2fd0', 0.6);
      bot = top;
    });
    const hs = list[n - 1][0] * 0.8;
    prism(B, p.cx, p.cz, hs * 1.41, 0, bot, bot + hs * 1.6, 4, { ...L, tint: L.tint.clone().set('#ff2fd0') }, { rot: Math.PI / 4, ink: 1.2 });
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) neonPost(B, p.cx + x * hs, p.cz + z * hs, bot, bot + 2, '#27e0ff', 0.6);
    lamp(B, p.cx, bot + hs * 1.6 + 1.5, p.cz, 2.2, '#ff2fd0', KIND.beacon);
    for (const f of ['n', 's', 'e', 'w']) signQuad(B, S, 'CLUB', '#ff2fd0', p.x0, p.z0, p.x1, p.z1, f, 5, 6);
  },
  twin(B, S, p) {
    const H = p.H, L = look(p.col, p.lit, STYLE.brick, '#4a3a34', STYLE.gravel);
    const alongX = p.x1 - p.x0 >= p.z1 - p.z0, len = alongX ? p.x1 - p.x0 : p.z1 - p.z0, tw = len * 0.36;
    const towers = [];
    for (const side of [0, 1]) {
      const a = side ? len - tw : 0;
      const r = alongX ? [p.x0 + a, p.z0, p.x0 + a + tw, p.z1] : [p.x0, p.z0 + a, p.x1, p.z0 + a + tw];
      const H2 = H * (side ? 0.92 : 1);
      box(B, r[0], r[1], r[2], r[3], 0, H2 * 0.82, L, { ink: 1.3 });
      const i = Math.min(r[2] - r[0], r[3] - r[1]) * 0.14;
      box(B, r[0] + i, r[1] + i, r[2] - i, r[3] - i, H2 * 0.82, H2, L, { ink: 1.3 });
      const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
      prism(B, cx, cz, (Math.min(r[2] - r[0], r[3] - r[1]) / 2 - i) * 1.3, 0, H2, H2 + 14, 4, { ...L, tint: L.tint.clone().set('#4f7a6a') }, { rot: Math.PI / 4 });
      mast(B, cx, cz, H2 + 14, H2 + 24, 0.35);
      towers.push(r);
    }
    // the skybridge
    const [a, b] = towers, y = H * 0.66;
    const r = alongX ? [a[2], (p.z0 + p.z1) / 2 - 4, b[0], (p.z0 + p.z1) / 2 + 4] : [(p.x0 + p.x1) / 2 - 4, a[3], (p.x0 + p.x1) / 2 + 4, b[1]];
    box(B, r[0], r[1], r[2], r[3], y, y + 7, { ...L, style: STYLE.glass }, { ink: 1.2 });
    neonRing(B, r[0], r[1], r[2], r[3], y + 0.4, '#ffb45a', 0.4);
  },
  hotel(B, S, p) {
    const H = p.H, L = look(p.col, p.lit, STYLE.brick, '#2a1418', STYLE.tar), s = p.S / 2;
    const top = tiers(B, p.cx, p.cz, 0, [[s, H * 0.7], [s * 0.84, H]], L);
    for (const y of [H * 0.25, H * 0.5, H * 0.7 - 0.5, H - 0.6]) neonRing(B, p.cx - s * (y > H * 0.71 ? 0.84 : 1), p.cz - s * (y > H * 0.71 ? 0.84 : 1), p.cx + s * (y > H * 0.71 ? 0.84 : 1), p.cz + s * (y > H * 0.71 ? 0.84 : 1), y, '#ff2244', 0.5);
    for (const f of ['n', 's', 'e', 'w']) bladeSign(B, S, 'HOTEL', '#ff2244', p.cx - s, p.cz - s, p.cx + s, p.cz + s, f, H * 0.3, H * 0.36);
    const q = s * 0.84;
    for (const f of ['n', 's', 'e', 'w']) signQuad(B, S, 'GIRLS', '#ff6688', p.cx - q, p.cz - q, p.cx + q, p.cz + q, f, top + 1.5, 9, { out: -1.5, back: true });
    mast(B, p.cx, p.cz, top, top + 30, 0.4, '#ff2244');
  },
  spike(B, S, p) {
    const H = p.H, L = look(p.col, p.lit, STYLE.concrete, '#101512', STYLE.tar), s = p.S / 2;
    box(B, p.x0, p.z0, p.x1, p.z1, 0, 16, L, { ink: 1.2 });
    neonRing(B, p.x0, p.z0, p.x1, p.z1, 15.5, '#39ff6a', 0.6);
    const r = s * 0.8;
    prism(B, p.cx, p.cz, r * 1.41, r * 0.25, 16, H, 4, L, { rot: Math.PI / 4, ink: 1.4 });
    for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      // green slits up each corner of the spike
      const a = [p.cx + x * r * 1.41, p.cz + z * r * 1.41], b = [p.cx + x * r * 0.35, p.cz + z * r * 0.35];
      for (let k = 0; k < 6; k++) { const t = 0.08 + k * 0.15; neonPost(B, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 16 + (H - 16) * t, 16 + (H - 16) * (t + 0.08), '#39ff6a', 0.6); }
    }
    lamp(B, p.cx, H + 5, p.cz, 5, '#39ff6a', KIND.neon);
    mast(B, p.cx, p.cz, H, H + 3, 0.6, null, '#101512');
  },
};

/** The harbour lighthouse: banded tower, gallery, a beacon that blinks out to sea. */
function lighthouse(B, x, z, H) {
  const W = look('#f0ece0', '#fff2a0', STYLE.concrete, '#3a3d44', STYLE.tar), R = look('#c8322a', '#fff2a0', STYLE.concrete, '#3a3d44');
  box(B, x - 9, z - 9, x + 9, z + 9, 0, 3, look('#6a6a66', '#000', STYLE.gravel, '#6a6a66'), { ink: 1 });
  const n = 6;
  for (let k = 0; k < n; k++) prism(B, x, z, 5.5 - k * 0.35, 5.5 - (k + 1) * 0.35, 3 + (H - 3) * k / n, 3 + (H - 3) * (k + 1) / n, 8, k % 2 ? R : W, { cap: false, ink: k === 0 ? 1 : 0 });
  box(B, x - 4, z - 4, x + 4, z + 4, H, H + 1, R, { ink: 1 });
  prism(B, x, z, 2.4, 2.4, H + 1, H + 5, 8, { ...W, style: STYLE.glass }, { cap: false });
  prism(B, x, z, 3, 0, H + 5, H + 8, 8, R);
  lamp(B, x, H + 3, z, 2.6, '#fff2a0', KIND.beacon);
}
