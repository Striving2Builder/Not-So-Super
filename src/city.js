// Procedural city: districts are grown from seeded Voronoi cells laid out in rings
// (business core → mixed ring → industry/vice → suburbs → farmland), with an ocean on the east.
import { RNG, hash2 } from './rng.js';
import { DISTRICTS } from './data.js';
import { clamp } from './util.js';

export const BLOCK = 240;
export const ROAD = 52;
export const LOT = BLOCK - ROAD;
const RIVER = '#2f6fa8';

// Rough ring placement for each district seed: [type, minRadius, maxRadius, count, preferredAngle?]
const PLAN = [
  ['downtown', 0, 1.5, 1], ['financial', 2, 3.5, 1], ['downtown', 3, 5, 1],
  ['entertainment', 4, 6.5, 1], ['casino', 5, 8, 1], ['nightclub', 5, 8, 1],
  ['retail', 4, 8, 2], ['residential', 6, 11, 3],
  ['redlight', 7, 10, 1], ['naughty', 7, 10, 1],
  ['warehouse', 8, 12, 1, 0], ['factory', 9, 13, 1], ['warehouse', 10, 13, 1],
  ['lair', 11, 14, 1], ['suburb', 10, 14, 4], ['farm', 14, 22, 5],
];

export class City {
  constructor(seed) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.cols = 34;
    this.rows = 30;
    this.landCols = 30;
    this.coastX = this.landCols * BLOCK + ROAD;
    this.W = this.cols * BLOCK;
    this.H = this.rows * BLOCK + ROAD;
    this.blocks = [];
    this.water = [];      // ships / piers drawn over the sea
    this.stacks = [];     // smokestacks (for smoke particles)
    this.assignDistricts();
    this.carveRiver();
    this.buildBlocks();
    this.buildMinimap();
    this.buildTraffic();
  }

  assignDistricts() {
    const r = this.rng, cx = this.landCols / 2, cy = this.rows / 2;
    const seeds = [];
    const place = (type, rmin, rmax, angle) => {
      for (let tries = 0; tries < 60; tries++) {
        const a = angle == null ? r.range(0, Math.PI * 2) : angle + r.range(-0.9, 0.9);
        const d = r.range(rmin, rmax);
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        if (x < 0.5 || y < 0.5 || x > this.landCols - 0.5 || y > this.rows - 0.5) continue;
        if (seeds.some((s) => Math.hypot(s.x - x, s.y - y) < 2.3)) continue;
        seeds.push({ type, x, y });
        return;
      }
      seeds.push({ type, x: r.range(1, this.landCols - 1), y: r.range(1, this.rows - 1) });
    };
    for (const [type, a, b, n, ang] of PLAN) for (let i = 0; i < n; i++) place(type, a, b, ang);
    // Docks hug the coast.
    for (const fy of [0.28, 0.7]) seeds.push({ type: 'docks', x: this.landCols - 1.2, y: this.rows * fy + r.range(-2, 2) });
    this.seeds = seeds;

    for (let by = 0; by < this.rows; by++) {
      for (let bx = 0; bx < this.landCols; bx++) {
        let best = null, bd = 1e9;
        const n = (hash2(bx, by, this.seed) - 0.5) * 1.6;
        for (const s of seeds) {
          const d = Math.hypot(s.x - (bx + 0.5), s.y - (by + 0.5)) + n * (s.type === 'farm' ? 0.4 : 1);
          if (d < bd) { bd = d; best = s; }
        }
        this.blocks.push({ bx, by, d: best.type, x0: bx * BLOCK + ROAD, y0: by * BLOCK + ROAD, flats: [], b: [] });
      }
    }
  }

  /**
   * A river through the city: from the west edge eastward a few blocks north of downtown (it crosses
   * the view as she sets off and from the patrol view), meandering, widening into a basin near the
   * centre, out into the bay. River blocks hold water instead of buildings; the streets crossing it
   * are its bridges. Hash-driven: the rng stream is untouched.
   */
  carveRiver() {
    const dt = this.seeds.find((s) => s.type === 'downtown');
    if (!dt) return;
    let y = clamp(Math.round(dt.y) - 5, 2, this.rows - 3);
    const path = [];
    for (let x = 0; x < this.landCols; x++) {
      path.push([x, y]);
      if (Math.abs(x - dt.x) < 6) path.push([x, y - 1]); // the basin
      if (x < this.landCols - 1 && hash2(x, y, this.seed + 3) < 0.3) {
        const ny = clamp(y + (hash2(y, x, this.seed + 4) < 0.5 ? -1 : 1), 2, Math.round(dt.y) - 3);
        if (ny !== y) { y = ny; path.push([x, y]); }
      }
    }
    for (const [bx, by] of path) { const b = this.block(bx, by); if (b) b.river = true; }
  }

  block(bx, by) {
    if (bx < 0 || by < 0 || bx >= this.landCols || by >= this.rows) return null;
    return this.blocks[by * this.landCols + bx];
  }

  districtAt(x, y) {
    if (x >= this.coastX - ROAD / 2) return 'water';
    const b = this.block(clamp(Math.floor(x / BLOCK), 0, this.landCols - 1), clamp(Math.floor(y / BLOCK), 0, this.rows - 1));
    return b ? b.d : 'water';
  }

  buildBlocks() {
    for (const blk of this.blocks) {
      if (blk.river) { blk.flats.push({ t: 'rect', x: blk.x0, y: blk.y0, w: LOT, h: LOT, c: RIVER }); continue; }
      const r = new RNG((hash2(blk.bx, blk.by, this.seed + 7) * 4294967296) >>> 0);
      const D = DISTRICTS[blk.d];
      const gen = GEN[D.style] || GEN.mixed;
      gen.call(this, blk, r, D);
      // Coastal docks get piers and a ship.
      if (blk.d === 'docks' && blk.bx === this.landCols - 1) {
        for (let i = 0; i < 2; i++) {
          const py = blk.y0 + 30 + i * 90;
          this.water.push({ t: 'pier', x: this.coastX, y: py, w: 190, h: 34 });
          if (r.chance(0.7)) this.water.push({ t: 'ship', x: this.coastX + 30, y: py + 40, w: 170, h: 38, col: r.pick(['#3a4a5a', '#7a2a2a', '#2a5a4a']) });
        }
      }
    }
  }

  buildMinimap() {
    const S = 4;
    const c = document.createElement('canvas');
    c.width = this.cols * S; c.height = this.rows * S;
    const g = c.getContext('2d');
    g.fillStyle = '#1f4f7a'; g.fillRect(0, 0, c.width, c.height);
    for (const b of this.blocks) {
      g.fillStyle = b.river ? RIVER : DISTRICTS[b.d].map;
      g.fillRect(b.bx * S, b.by * S, S, S);
    }
    g.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i <= this.landCols; i++) g.fillRect(i * S, 0, 1, this.rows * S);
    for (let j = 0; j <= this.rows; j++) g.fillRect(0, j * S, this.landCols * S, 1);
    this.minimap = c;
    this.mapScale = S / BLOCK;
  }

  // Cars drive along road centre-lines between intersections.
  buildTraffic() {
    const r = this.rng;
    this.cars = [];
    const cols = ['#e8e8e8', '#222', '#c22', '#2a5ac8', '#e0b020', '#3a8a4a', '#888', '#f0f0f0', '#6a2a8a'];
    for (let i = 0; i < 140; i++) {
      const ix = r.int(0, this.landCols), iy = r.int(0, this.rows);
      const car = { ix, iy, x: ix * BLOCK + ROAD / 2, y: iy * BLOCK + ROAD / 2, dir: 0, spd: r.range(70, 130), col: r.pick(cols), taxi: r.chance(0.12) };
      if (car.taxi) car.col = '#f2c21a';
      this.pickCarDir(car, r);
      this.cars.push(car);
    }
  }

  pickCarDir(car, r = this.rng) {
    const opts = [];
    if (car.ix < this.landCols) opts.push(0);
    if (car.iy < this.rows) opts.push(1);
    if (car.ix > 0) opts.push(2);
    if (car.iy > 0) opts.push(3);
    const back = (car.dir + 2) % 4;
    const fwd = opts.filter((d) => d !== back);
    car.dir = (fwd.length ? (r.chance(0.55) && fwd.includes(car.dir) ? car.dir : r.pick(fwd)) : back);
    car.tx = car.ix + [1, 0, -1, 0][car.dir];
    car.ty = car.iy + [0, 1, 0, -1][car.dir];
  }

  updateTraffic(dt) {
    for (const c of this.cars) {
      const gx = c.tx * BLOCK + ROAD / 2, gy = c.ty * BLOCK + ROAD / 2;
      const dx = gx - c.x, dy = gy - c.y, d = Math.abs(dx) + Math.abs(dy);
      const step = c.spd * dt;
      if (d <= step) {
        c.x = gx; c.y = gy; c.ix = c.tx; c.iy = c.ty;
        this.pickCarDir(c, this.rng);
      } else {
        c.x += Math.sign(dx) * step; c.y += Math.sign(dy) * step;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Block generators. Buildings: {x,y,w,d,h,col,kind,...}; flats are ground decals.
// ---------------------------------------------------------------------------
// Rooftop sign names. signFor() spreads them over the grid so neighbouring blocks never share a
// name (a screenful of BOWL BOWL BOWL reads as clone-stamped). The rng pick is still drawn so the
// rest of the block generates exactly as before.
const VENUE_SIGNS = ['THEATER', 'CINEMA', 'ARCADE', 'BOWL', 'COMEDY', 'JAZZ', 'OPERA', 'KARAOKE', 'BILLIARDS', 'ROXY', 'PALACE', 'DINER'];
const MALLS = ['MALL', 'MEGAMART', 'OUTLET', 'PLAZA', 'SUPERSTORE', 'MARKET'];
function signFor(blk, names, _drawn) { return names[(blk.bx * 5 + blk.by * 3) % names.length]; }

function B(blk, x, y, w, d, h, col, extra = {}) {
  blk.b.push({ x, y, w, d, h, col, kind: 'box', ...extra });
}
function tree(blk, r, x, y) {
  blk.b.push({ x, y, w: 0, d: 0, h: r.range(16, 26), rad: r.range(9, 15), kind: 'tree', col: r.pick(['#2f6b34', '#3a7a3a', '#2a5a30', '#4a8a3a']) });
}
function park(blk, r, x, y, w, h) {
  blk.flats.push({ t: 'rect', x, y, w, h, c: '#4f8a44' });
  blk.flats.push({ t: 'path', x: x + w / 2 - 5, y, w: 10, h, c: '#b9a98a' });
  for (let i = 0; i < 6; i++) tree(blk, r, x + r.range(12, w - 12), y + r.range(12, h - 12));
}

const GEN = {
  towers(blk, r, D) {
    const { x0, y0 } = blk, m = 12, S = LOT - m * 2;
    if (r.chance(0.45)) {
      const w = r.range(110, 160), d = r.range(110, 160);
      B(blk, x0 + m + (S - w) / 2, y0 + m + (S - d) / 2, w, d, r.range(D.hMin, D.hMax), r.pick(D.pal), { glass: true, helipad: r.chance(0.35) });
      blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: '#6b7383' });
    } else {
      for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++) {
        if (!r.chance(0.85)) { tree(blk, r, x0 + m + qx * S / 2 + 40, y0 + m + qy * S / 2 + 40); continue; }
        const w = r.range(56, 76), d = r.range(56, 76);
        B(blk, x0 + m + qx * S / 2 + (S / 2 - w) / 2, y0 + m + qy * S / 2 + (S / 2 - d) / 2, w, d, r.range(D.hMin * 0.8, D.hMax), r.pick(D.pal), { glass: true });
      }
    }
  },
  mixed(blk, r, D) {
    const { x0, y0 } = blk, m = 10, S = LOT - m * 2;
    if (r.chance(0.1)) return park(blk, r, x0 + 6, y0 + 6, LOT - 12, LOT - 12);
    if (r.chance(0.12)) {
      blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: '#8d877a' });
      blk.flats.push({ t: 'fountain', x: x0 + LOT / 2, y: y0 + LOT / 2, r: 26 });
      for (let i = 0; i < 4; i++) tree(blk, r, x0 + 30 + (i % 2) * (LOT - 60), y0 + 30 + (i >> 1) * (LOT - 60));
      return;
    }
    for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++) {
      const w = r.range(62, 80), d = r.range(62, 80);
      B(blk, x0 + m + qx * S / 2 + (S / 2 - w) / 2, y0 + m + qy * S / 2 + (S / 2 - d) / 2, w, d, r.range(D.hMin, D.hMax), r.pick(D.pal), { glass: r.chance(0.3) });
    }
  },
  shops(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'lot', x: x0 + 50, y: y0 + 50, w: LOT - 100, h: LOT - 100 });
    if (r.chance(0.3)) {
      B(blk, x0 + 20, y0 + 22, LOT - 40, 90, r.range(28, 42), r.pick(D.pal), { skylight: true, sign: signFor(blk, MALLS, r.pick(MALLS)) });
      return;
    }
    // shop row around the perimeter
    for (let side = 0; side < 4; side++) {
      let p = 8;
      while (p < LOT - 50) {
        const w = r.range(34, 52), h = r.range(D.hMin, D.hMax), dep = 40, col = r.pick(D.pal);
        const awn = r.pick(D.pal);
        if (side === 0) B(blk, x0 + p, y0 + 6, w, dep, h, col, { awning: awn, face: 'n' });
        if (side === 1) B(blk, x0 + LOT - 6 - dep, y0 + p + 44, dep, w, h, col, { awning: awn, face: 'e' });
        if (side === 2) B(blk, x0 + p + 44, y0 + LOT - 6 - dep, w, dep, h, col, { awning: awn, face: 's' });
        if (side === 3) B(blk, x0 + 6, y0 + p, dep, w, h, col, { awning: awn, face: 'w' });
        p += w + 2;
      }
    }
  },
  apartments(blk, r, D) {
    const { x0, y0 } = blk;
    if (r.chance(0.15)) return park(blk, r, x0 + 6, y0 + 6, LOT - 12, LOT - 12);
    blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: '#5d7a52' });
    if (r.chance(0.6)) {
      const h1 = r.range(D.hMin, D.hMax), c1 = r.pick(D.pal);
      B(blk, x0 + 14, y0 + 14, LOT - 28, 58, h1, c1, { rooftop: true });
      B(blk, x0 + 14, y0 + LOT - 72, LOT - 28, 58, r.range(D.hMin, D.hMax), r.pick(D.pal), { rooftop: true });
      for (let i = 0; i < 4; i++) tree(blk, r, x0 + 30 + i * 42, y0 + LOT / 2);
    } else {
      for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++) {
        B(blk, x0 + 18 + qx * 88, y0 + 18 + qy * 88, 66, 66, r.range(D.hMin, D.hMax), r.pick(D.pal), { rooftop: true });
      }
    }
  },
  venues(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: '#5a5070' });
    B(blk, x0 + 20, y0 + 16, 150, 100, r.range(50, 80), r.pick(D.pal), { neon: r.pick(D.neon), sign: signFor(blk, VENUE_SIGNS, r.pick(VENUE_SIGNS)) });
    B(blk, x0 + 20, y0 + 132, 60, 44, r.range(D.hMin, D.hMax), r.pick(D.pal), { neon: r.pick(D.neon) });
    B(blk, x0 + 100, y0 + 132, 70, 44, r.range(D.hMin, D.hMax), r.pick(D.pal), { neon: r.pick(D.neon) });
  },
  clubs(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: shadeHex(D.lot, 0.1) });
    const n = r.int(3, 5);
    const cells = [[14, 14, 76, 76], [98, 14, 76, 76], [14, 98, 76, 76], [98, 98, 76, 76], [14, 60, 160, 60]];
    for (let i = 0; i < Math.min(n, 4); i++) {
      const [cx, cy, cw, ch] = cells[i];
      const w = cw - r.range(0, 14), d = ch - r.range(0, 14);
      B(blk, x0 + cx, y0 + cy, w, d, r.range(D.hMin, D.hMax), r.pick(D.pal), { neon: r.pick(D.neon), neon2: r.chance(0.5) ? r.pick(D.neon) : null });
    }
  },
  casino(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 6, y: y0 + 6, w: LOT - 12, h: LOT - 12, c: '#6a5a3a' });
    if (r.chance(0.6)) {
      B(blk, x0 + 18, y0 + 18, LOT - 36, 120, r.range(70, 110), r.pick(D.pal), { neon: '#ffd84d', neon2: '#ff4d4d', gold: true });
      blk.flats.push({ t: 'fountain', x: x0 + LOT / 2, y: y0 + LOT - 26, r: 18 });
    } else {
      B(blk, x0 + 18, y0 + 90, LOT - 36, 80, r.range(35, 50), r.pick(D.pal), { neon: '#ff4d4d', gold: true });
      B(blk, x0 + 50, y0 + 18, 90, 90, r.range(160, D.hMax), '#c9a13b', { neon: '#ffd84d', glass: true });
    }
  },
  warehouses(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 4, y: y0 + 4, w: LOT - 8, h: LOT - 8, c: '#5a5750' });
    // roof variety without touching the rng stream: skylight strips on some sheds, bare tin on others
    const v = hash2(blk.bx, blk.by, 91);
    B(blk, x0 + 12, y0 + 14, LOT - 24, 72, r.range(D.hMin, D.hMax), r.pick(D.pal), { corrugated: v > 0.35, skylight: v < 0.5 });
    if (r.chance(0.7)) B(blk, x0 + 12, y0 + 104, LOT - 24, 70, r.range(D.hMin, D.hMax), r.pick(D.pal), { corrugated: v < 0.7, skylight: v > 0.6 });
    else for (let i = 0; i < 3; i++) B(blk, x0 + 20 + i * 52, y0 + 120, 40, 16, 14, '#e8e8e8', { truck: true });
  },
  docks(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 2, y: y0 + 2, w: LOT - 4, h: LOT - 4, c: '#56585c' });
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      if (r.chance(0.25)) continue;
      const stack = r.chance(0.4) ? 2 : 1;
      B(blk, x0 + 14 + col * 56, y0 + 14 + row * 34, 48, 18, 14 * stack, r.pick(D.pal), { container: true });
    }
    if (r.chance(0.5)) blk.b.push({ kind: 'crane', x: x0 + LOT - 30, y: y0 + 20, x2: x0 + LOT - 30, y2: y0 + LOT - 20, h: 120, col: '#e0b020' });
  },
  factory(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 4, y: y0 + 4, w: LOT - 8, h: LOT - 8, c: '#5c5a52' });
    B(blk, x0 + 14, y0 + 16, 120, 110, r.range(D.hMin, D.hMax), r.pick(D.pal), { sawtooth: true });
    for (let i = 0; i < r.int(1, 3); i++) {
      const s = { kind: 'round', x: x0 + 155, y: y0 + 26 + i * 40, rad: 9, h: r.range(130, 180), col: '#8a6a5a', stack: true };
      blk.b.push(s); this.stacks.push(s);
    }
    for (let i = 0; i < 2; i++) blk.b.push({ kind: 'round', x: x0 + 40 + i * 60, y: y0 + 155, rad: 20, h: r.range(30, 45), col: '#b8b8b0' });
  },
  houses(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 4, y: y0 + 4, w: LOT - 8, h: LOT - 8, c: '#5f8a4a' });
    for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
      const lx = x0 + 6 + gx * 60, ly = y0 + 6 + gy * 60;
      if (gx === 1 && gy === 1) { if (r.chance(0.5)) blk.flats.push({ t: 'pool', x: lx + 14, y: ly + 16, w: 30, h: 20 }); tree(blk, r, lx + 30, ly + 30); continue; }
      blk.flats.push({ t: 'rect', x: lx + 2, y: ly + 2, w: 56, h: 56, c: r.chance(0.5) ? '#669450' : '#5c8a48' });
      B(blk, lx + 12, ly + 14, 34, 28, r.range(D.hMin, D.hMax), r.pick(D.pal), { house: true, roofCol: r.pick(['#7a3a2a', '#4a4a5a', '#6a4a3a', '#3a5a7a']) });
      if (r.chance(0.6)) tree(blk, r, lx + r.range(8, 50), ly + r.range(46, 54));
    }
  },
  farm(blk, r, D) {
    const { x0, y0 } = blk;
    const crops = [['#c9b25a', '#b89e48'], ['#5a9a3a', '#4a8a2e'], ['#8a6a3a', '#7a5a2e'], ['#a8c84a', '#98b83a']];
    const [c1, c2] = r.pick(crops);
    blk.flats.push({ t: 'field', x: x0 - 8, y: y0 - 8, w: LOT + 16, h: LOT + 16, c1, c2, vert: r.chance(0.5) });
    if (r.chance(0.35)) {
      blk.flats.push({ t: 'rect', x: x0 + 10, y: y0 + 10, w: 110, h: 90, c: '#7a8a4a' });
      B(blk, x0 + 20, y0 + 20, 54, 38, r.range(28, 36), '#a8322d', { barn: true, roofCol: '#6a2a24' });
      blk.b.push({ kind: 'round', x: x0 + 92, y: y0 + 34, rad: 11, h: r.range(48, 62), col: '#c9c9c0' });
      B(blk, x0 + 30, y0 + 70, 34, 24, 16, '#e8e0d0', { house: true, roofCol: '#4a4a5a' });
      for (let i = 0; i < 3; i++) tree(blk, r, x0 + 20 + i * 30, y0 + 108);
    }
  },
  lair(blk, r, D) {
    const { x0, y0 } = blk;
    blk.flats.push({ t: 'rect', x: x0 + 4, y: y0 + 4, w: LOT - 8, h: LOT - 8, c: '#1e241f' });
    blk.flats.push({ t: 'hazard', x: x0 + 8, y: y0 + 8, w: LOT - 16, h: LOT - 16 });
    if (r.chance(0.5)) {
      blk.b.push({ kind: 'round', x: x0 + LOT / 2, y: y0 + LOT / 2, rad: 48, h: 34, col: '#2a322c', dome: true, neon: '#39ff6a' });
      blk.b.push({ kind: 'box', x: x0 + 20, y: y0 + 20, w: 8, d: 8, h: 150, col: '#3a3a3a', antenna: true });
    } else {
      B(blk, x0 + 20, y0 + 24, 140, 100, r.range(D.hMin, D.hMax), r.pick(D.pal), { neon: '#39ff6a', vents: true });
      B(blk, x0 + 30, y0 + 140, 60, 36, 22, r.pick(D.pal), { neon: '#a0ff39' });
    }
  },
};

function shadeHex(hex, amt) {
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}
