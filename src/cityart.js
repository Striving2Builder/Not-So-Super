// Baked city art for the flight view. Everything at street level is flat (z = 0), so the
// perspective camera maps it with a plain scale + offset: each 240-unit city cell (its lot plus the
// road strips on its top and left) is painted once into an offscreen canvas and then blitted.
// That makes ground detail free per frame: sidewalks, crosswalks, lane paint, parks, and the cast
// shadows of every building and tree (sun/moon from the north-west), with comic halftone in them.
// A second, low-res "light map" per cell holds the street-lamp pools, neon spill and shop-window
// glow, added on top at night in one blit instead of dozens of glow sprites.
import { BLOCK, ROAD, LOT } from './city.js';
import { DISTRICTS } from './data.js';
import { hash2 } from './rng.js';
import { shade } from './util.js';
import { glow } from './art.js';

/** Shadow offset per unit of height (light from the upper left of the screen). */
export const SUN = { x: 0.26, y: 0.36 };
const ASPHALT = '#2a2d35';
const URBAN_X = new Set(['farm', 'suburb']); // no crosswalks out in the sticks

let dots = null;
/** Comic halftone dot tile (screen-ish scale once the cell is blitted). */
function halftone() {
  if (dots) return dots;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(6,6,22,0.55)';
  g.beginPath(); g.arc(2, 2, 1.5, 0, Math.PI * 2); g.arc(6, 6, 1.5, 0, Math.PI * 2); g.fill();
  dots = c;
  return c;
}

/** Shadow hull of one structure, as a clockwise sub-path (so a single nonzero fill unions them). */
function shadowPath(g, o) {
  const dx = o.h * SUN.x, dy = o.h * SUN.y;
  if (o.kind === 'box') {
    const { x, y, w, d } = o;
    g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + dx, y + dy);
    g.lineTo(x + w + dx, y + d + dy); g.lineTo(x + dx, y + d + dy); g.lineTo(x, y + d); g.closePath();
  } else if (o.kind === 'round' || o.kind === 'tree') {
    const r = o.rad, a = Math.atan2(dy, dx) + Math.PI / 2;
    const ox = -Math.cos(a) * r, oy = -Math.sin(a) * r; // clockwise, like the arcs
    g.moveTo(o.x + o.rad, o.y); g.arc(o.x, o.y, r, 0, Math.PI * 2); g.closePath();
    g.moveTo(o.x + dx + r, o.y + dy); g.arc(o.x + dx, o.y + dy, r, 0, Math.PI * 2); g.closePath();
    g.moveTo(o.x - ox, o.y - oy); g.lineTo(o.x + ox, o.y + oy); g.lineTo(o.x + dx + ox, o.y + dy + oy); g.lineTo(o.x + dx - ox, o.y + dy - oy); g.closePath();
  } else if (o.kind === 'crane') {
    g.rect(o.x + o.h * SUN.x - 3, o.y + o.h * SUN.y, 6, o.y2 - o.y);
  }
}

export class CityArt {
  constructor(city, res = 192, lres = 64, max = 170) {
    this.city = city;
    this.res = res; this.lres = lres; this.max = max;
    this.ground = new Map();
    this.lights = new Map();
    this.pool = []; // recycled canvases
  }

  key(bx, by) { return by * 64 + bx; }

  /** Ground canvas for cell (bx, by), painted on first use; LRU-ish eviction by frame stamp. */
  cell(bx, by, frame) {
    const k = this.key(bx, by);
    let e = this.ground.get(k);
    if (!e) {
      if (this.ground.size >= this.max) this.evict(this.ground, frame);
      e = { c: this.canvas(this.res), f: frame };
      this.paintGround(e.c, bx, by);
      this.ground.set(k, e);
    }
    e.f = frame;
    return e.c;
  }

  lightCell(bx, by, frame) {
    const k = this.key(bx, by);
    let e = this.lights.get(k);
    if (!e) {
      if (this.lights.size >= this.max) this.evict(this.lights, frame, true);
      e = { c: document.createElement('canvas'), f: frame };
      e.c.width = e.c.height = this.lres;
      this.paintLights(e.c, bx, by);
      this.lights.set(k, e);
    }
    e.f = frame;
    return e.c;
  }

  canvas(res) {
    const c = this.pool.pop() || document.createElement('canvas');
    c.width = c.height = res;
    return c;
  }

  evict(map, frame, drop = false) {
    // drop the quarter that was used longest ago
    const es = [...map.entries()].sort((a, b) => a[1].f - b[1].f);
    for (let i = 0; i < es.length / 4; i++) {
      if (es[i][1].f >= frame) break;
      map.delete(es[i][0]);
      if (!drop) this.pool.push(es[i][1].c);
    }
  }

  // ---------------------------------------------------------------- ground
  paintGround(c, bx, by) {
    const g = c.getContext('2d'), s = this.res / BLOCK, X0 = bx * BLOCK, Y0 = by * BLOCK;
    const city = this.city, b = city.block(bx, by);
    g.setTransform(s, 0, 0, s, -X0 * s, -Y0 * s);
    g.fillStyle = ASPHALT; g.fillRect(X0, Y0, BLOCK, BLOCK);
    if (!b) return;
    const D = DISTRICTS[b.d], farm = b.d === 'farm', urban = !URBAN_X.has(b.d);
    // worn asphalt: a few darker patches and seams
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 3; i++) {
      const h = hash2(bx, by, 40 + i);
      g.fillRect(X0 + 6 + h * (BLOCK - 40), Y0 + 8 + (i % 2) * 26, 14 + h * 20, 6);
    }
    // lane paint (dashed centre lines) on this cell's top and left roads
    g.strokeStyle = 'rgba(236,200,90,.75)'; g.lineWidth = 1.6; g.setLineDash([12, 12]);
    g.beginPath();
    g.moveTo(X0 + ROAD, Y0 + ROAD / 2); g.lineTo(X0 + BLOCK, Y0 + ROAD / 2);
    g.moveTo(X0 + ROAD / 2, Y0 + ROAD); g.lineTo(X0 + ROAD / 2, Y0 + BLOCK);
    g.stroke(); g.setLineDash([]);
    // road edge lines
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X0 + ROAD, Y0 + 3); g.lineTo(X0 + BLOCK, Y0 + 3); g.moveTo(X0 + ROAD, Y0 + ROAD - 3); g.lineTo(X0 + BLOCK, Y0 + ROAD - 3);
    g.moveTo(X0 + 3, Y0 + ROAD); g.lineTo(X0 + 3, Y0 + BLOCK); g.moveTo(X0 + ROAD - 3, Y0 + ROAD); g.lineTo(X0 + ROAD - 3, Y0 + BLOCK);
    g.stroke();
    if (urban) {
      // zebra crossings at both ends of both road strips
      g.fillStyle = 'rgba(235,235,225,.8)';
      for (let i = 0; i < 6; i++) {
        const t = 5 + i * 7.3;
        for (const x of [X0 + ROAD + 3, X0 + BLOCK - 11]) g.fillRect(x, Y0 + t, 8, 3.6);
        for (const y of [Y0 + ROAD + 3, Y0 + BLOCK - 11]) g.fillRect(X0 + t, y, 3.6, 8);
      }
      // manhole
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.arc(X0 + ROAD + 40 + hash2(bx, by, 3) * 120, Y0 + ROAD * 0.3, 3, 0, Math.PI * 2); g.fill();
    }
    // sidewalk ring with a dark curb and paving seams, then the lot
    const { x0, y0 } = b;
    g.fillStyle = farm ? '#6f8a42' : b.d === 'suburb' ? '#a4a498' : '#8f8d88';
    g.fillRect(x0, y0, LOT, LOT);
    if (!farm) {
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 0.8; g.beginPath();
      for (let p = 12; p < LOT; p += 12) { g.moveTo(x0 + p, y0); g.lineTo(x0 + p, y0 + 5); g.moveTo(x0 + p, y0 + LOT - 5); g.lineTo(x0 + p, y0 + LOT); g.moveTo(x0, y0 + p); g.lineTo(x0 + 5, y0 + p); g.moveTo(x0 + LOT - 5, y0 + p); g.lineTo(x0 + LOT, y0 + p); }
      g.stroke();
      g.strokeStyle = '#15161c'; g.lineWidth = 1.6; g.strokeRect(x0, y0, LOT, LOT); // curb, inked
    }
    g.fillStyle = D.lot; g.fillRect(x0 + 5, y0 + 5, LOT - 10, LOT - 10);
    for (const f of b.flats) this.flat(g, f);
    // contact shadow where walls meet the ground
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.beginPath();
    for (const o of b.b) if (o.kind === 'box') g.rect(o.x, o.y, o.w, o.d);
    g.stroke();
    // cast shadows from this block and the ones up/left of it (shadows fall down-right)
    g.beginPath();
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
      const nb = city.block(bx + dx, by + dy);
      if (nb) for (const o of nb.b) if (!o.truck) shadowPath(g, o);
    }
    g.save();
    g.fillStyle = 'rgba(8,10,34,.34)'; g.fill();
    g.clip();
    g.setTransform(1, 0, 0, 1, 0, 0); // halftone in canvas pixels, so the dots stay crisp and even
    g.fillStyle = g.createPattern(halftone(), 'repeat'); g.fillRect(0, 0, this.res, this.res);
    g.restore();
    if (farm) {
      // tractor tracks: a dirt road edge instead of a curb
      g.strokeStyle = 'rgba(90,70,40,.5)'; g.lineWidth = 3; g.strokeRect(x0 - 3, y0 - 3, LOT + 6, LOT + 6);
    }
  }

  flat(g, f) {
    switch (f.t) {
      case 'rect': g.fillStyle = f.c; g.fillRect(f.x, f.y, f.w, f.h); break;
      case 'path':
        g.fillStyle = f.c; g.fillRect(f.x, f.y, f.w, f.h);
        g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(f.x, f.y, 1.5, f.h); g.fillRect(f.x + f.w - 1.5, f.y, 1.5, f.h);
        break;
      case 'lot':
        g.fillStyle = '#44454a'; g.fillRect(f.x, f.y, f.w, f.h);
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
        g.beginPath();
        for (let i = 1; i < 6; i++) { const xx = f.x + (f.w * i) / 6; g.moveTo(xx, f.y + 3); g.lineTo(xx, f.y + f.h * 0.4); g.moveTo(xx, f.y + f.h * 0.6); g.lineTo(xx, f.y + f.h - 3); }
        g.stroke();
        // parked cars
        for (let i = 0; i < 5; i++) {
          if (hash2(f.x | 0, f.y | 0, i) < 0.45) continue;
          const xx = f.x + (f.w * (i + 0.5)) / 6 + 3;
          g.fillStyle = ['#c22', '#e8e8e8', '#2a5ac8', '#222', '#e0b020'][i]; g.fillRect(xx, f.y + 6, 10, 18);
          g.fillStyle = 'rgba(20,30,50,.7)'; g.fillRect(xx + 1.5, f.y + 10, 7, 5);
        }
        break;
      case 'field': {
        g.fillStyle = f.c1; g.fillRect(f.x, f.y, f.w, f.h);
        g.fillStyle = f.c2;
        const n = 12;
        for (let i = 0; i < n; i += 2) {
          if (f.vert) g.fillRect(f.x + (f.w * i) / n, f.y, f.w / n, f.h);
          else g.fillRect(f.x, f.y + (f.h * i) / n, f.w, f.h / n);
        }
        break;
      }
      case 'pool':
        g.fillStyle = '#e8e8e8'; g.fillRect(f.x - 2, f.y - 2, f.w + 4, f.h + 4);
        g.fillStyle = '#2fb4dc'; g.fillRect(f.x, f.y, f.w, f.h);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(f.x + 2, f.y + 2, f.w * 0.5, 2);
        break;
      case 'fountain':
        g.fillStyle = '#c8c0b0'; g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#15161c'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = '#3aa8d8'; g.beginPath(); g.arc(f.x, f.y, f.r * 0.8, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(f.x, f.y, f.r * 0.25, 0, Math.PI * 2); g.fill();
        break;
      case 'hazard':
        g.strokeStyle = 'rgba(230,200,40,.55)'; g.lineWidth = 3; g.setLineDash([8, 8]);
        g.strokeRect(f.x, f.y, f.w, f.h); g.setLineDash([]);
        break;
    }
  }

  // ---------------------------------------------------------------- night light map
  /** Lamps and spill that touch cell (bx, by): its own and its neighbours' (glows cross cell edges). */
  paintLights(c, bx, by) {
    const g = c.getContext('2d'), s = this.lres / BLOCK, X0 = bx * BLOCK, Y0 = by * BLOCK;
    g.setTransform(s, 0, 0, s, -X0 * s, -Y0 * s);
    g.globalCompositeOperation = 'lighter';
    const lamp = glow('#ffcf7a'), cool = glow('#bfe0ff');
    const put = (spr, x, y, r, a) => { g.globalAlpha = a; g.drawImage(spr, x - r, y - r, r * 2, r * 2); };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = bx + dx, cy = by + dy, b = this.city.block(cx, cy);
      const x0 = cx * BLOCK, y0 = cy * BLOCK;
      if (!b) continue;
      if (b.d === 'farm') continue;
      const sub = b.d === 'suburb';
      // intersection pool + sodium lamps down both roads
      put(lamp, x0 + ROAD / 2, y0 + ROAD / 2, 58, sub ? 0.35 : 0.55);
      for (let i = 1; i <= 2; i++) {
        const t = ROAD + (LOT * i) / 3, alt = i % 2;
        put(i % 2 ? lamp : cool, x0 + t, y0 + (alt ? 6 : ROAD - 6), 36, sub ? 0.3 : 0.42);
        put(i % 2 ? cool : lamp, x0 + (alt ? ROAD - 6 : 6), y0 + t, 36, sub ? 0.3 : 0.42);
      }
      // neon + shopfront spill on the ground around the buildings
      for (const o of b.b) {
        if (o.kind !== 'box') continue;
        if (o.neon) put(glow(o.neon), o.x + o.w / 2, o.y + o.d / 2, Math.max(o.w, o.d) * 0.85, 0.3);
        if (o.neon2) put(glow(o.neon2), o.x + o.w / 2, o.y + o.d / 2, Math.max(o.w, o.d) * 0.6, 0.18);
        if (o.awning) {
          const fx = o.face === 'e' ? o.x + o.w + 6 : o.face === 'w' ? o.x - 6 : o.x + o.w / 2;
          const fy = o.face === 's' ? o.y + o.d + 6 : o.face === 'n' ? o.y - 6 : o.y + o.d / 2;
          put(lamp, fx, fy, 22, 0.4);
        }
        if (o.house && hash2(o.x | 0, o.y | 0, 9) > 0.4) put(lamp, o.x + o.w / 2, o.y + o.d + 4, 14, 0.35);
      }
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- screen-space helpers
let vig = null;
/** A graded vignette: transparent centre, ink-blue corners. Built once, stretched to the screen. */
export function vignette() {
  if (vig) return vig;
  vig = document.createElement('canvas');
  vig.width = 256; vig.height = 128;
  const g = vig.getContext('2d');
  g.setTransform(2, 0, 0, 1, 0, 0);
  const grd = g.createRadialGradient(64, 64, 30, 64, 64, 92);
  grd.addColorStop(0, 'rgba(8,10,30,0)');
  grd.addColorStop(0.6, 'rgba(8,10,30,0.25)');
  grd.addColorStop(1, 'rgba(4,4,18,0.8)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return vig;
}

let beam = null;
/** A soft headlight cone pointing +x, for car headlights at night. */
export function headlight() {
  if (beam) return beam;
  beam = document.createElement('canvas');
  beam.width = 64; beam.height = 32;
  const g = beam.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, 'rgba(255,246,210,0.9)'); grd.addColorStop(1, 'rgba(255,246,210,0)');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(0, 13); g.lineTo(64, 0); g.lineTo(64, 32); g.lineTo(0, 19); g.closePath(); g.fill();
  return beam;
}

/**
 * Her sprite, comic-inked: a dark outline all round, a warm rim of light on the sun side, and a
 * flat silhouette kept for her ground shadow. One read-back of the WebGL sprite per frame, then a
 * handful of cheap 2D blits on a ~260px canvas.
 */
export class InkSprite {
  constructor() { this.pad = 4; this.out = null; }

  ensure(w) {
    const S = w + this.pad * 2;
    if (this.out && this.out.width === S) return;
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
    this.base = mk(); this.shadow = mk(); this.rim = mk(); this.out = mk();
  }

  /** lightAng: direction the light comes from, in sprite space (radians). Returns the inked canvas. */
  build(img, lightAng, rich, night) {
    this.ensure(img.width);
    const p = this.pad, S = this.out.width;
    const bg = this.base.getContext('2d');
    bg.clearRect(0, 0, S, S); bg.drawImage(img, p, p);
    // silhouette (also her shadow)
    const sg = this.shadow.getContext('2d');
    sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, S, S); sg.drawImage(this.base, 0, 0);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#05060f'; sg.fillRect(0, 0, S, S);
    sg.globalCompositeOperation = 'source-over';
    const og = this.out.getContext('2d');
    og.clearRect(0, 0, S, S);
    // outline: the silhouette dilated by ~3px
    const r = rich ? 3 : 2, n = rich ? 8 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; og.drawImage(this.shadow, Math.cos(a) * r, Math.sin(a) * r); }
    og.drawImage(this.base, 0, 0);
    if (rich) {
      // rim: silhouette minus itself nudged away from the light = a crescent on the lit edge
      const rg = this.rim.getContext('2d');
      rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, S, S); rg.drawImage(this.shadow, 0, 0);
      rg.globalCompositeOperation = 'source-in'; rg.fillStyle = night > 0.5 ? '#bfe6ff' : '#fff1c2'; rg.fillRect(0, 0, S, S);
      rg.globalCompositeOperation = 'destination-out';
      rg.drawImage(this.shadow, -Math.cos(lightAng) * 3, -Math.sin(lightAng) * 3);
      rg.globalCompositeOperation = 'source-over';
      og.globalAlpha = 0.85; og.drawImage(this.rim, 0, 0); og.globalAlpha = 1;
    }
    return this.out;
  }
}

export { shade };
