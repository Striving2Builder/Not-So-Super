// Beyond the playable map: the outer boroughs (real far-LOD blocks on the city's street grid, with
// a few boroughs' own downtowns, so the skyline continues and sinks below the horizon as she
// climbs), two islands across the bay, bridges over the river on the avenues, two big suspension
// bridges out to the islands, and the elevated highway that rings the map. All in the cheap far
// material, chunked into tiles for culling. `roads` lists the bridge/highway lanes for traffic.
import * as THREE from 'three';
import { hash2 } from './rng.js';
import { BLOCK, ROAD } from './city.js';
import { M, STYLE, Builder, box, prism, lamp, look, KIND } from './buildings3d.js';
import { OUTER } from './skyline3d.js';

const TILE_M = 1200;                  // metres per culling tile
const BOROUGH = { band: 1700, base: [10, 34], tall: 0.05 }; // metres of blocks past the river; storeys
const WALLS = ['#8a8580', '#9a7a66', '#7d8696', '#a89878', '#6f6a74', '#b08a70', '#8c9aa0'];
const LITS = ['#ffcf7a', '#ffd890', '#cfe0ff'];
const BRIDGE = { river: { deck: 9, tower: 46, w: 16 }, bay: { deck: 16, tower: 120, w: 24 } };
const HWY = { off: 70, deck: 10, w: 22, pillar: 64 }; // metres outside the map edge, deck height

/** Smooth bump of extra height near each borough's own downtown. */
function peaks(list, x, z) {
  let k = 0;
  for (const [px, pz, r, h] of list) k = Math.max(k, h * Math.exp(-(((x - px) ** 2 + (z - pz) ** 2) / (r * r))));
  return k;
}

export class Outer {
  constructor(city, scene, look3, horizon) {
    const x0 = 0, z0 = 0, x1 = city.coastX * M, z1 = city.H * M, R = OUTER.river;
    this.tiles = new Map();
    this.roads = [];
    const tile = (x, z) => {
      const k = `${Math.floor(x / TILE_M)},${Math.floor(z / TILE_M)}`;
      let t = this.tiles.get(k);
      if (!t) this.tiles.set(k, (t = { B: new Builder(true), cx: (Math.floor(x / TILE_M) + 0.5) * TILE_M, cz: (Math.floor(z / TILE_M) + 0.5) * TILE_M }));
      return t.B;
    };
    // islands across the bay: [cx, cz, rx, rz]
    this.islands = [[x1 + 2100, z1 * 0.28, 850, 950], [x1 + 2500, z1 * 0.82, 1000, 760]];
    const P = [
      [x0 - R - 1300, z1 * 0.45, 700, 2], [x1 * 0.3, z0 - R - 1200, 650, 1.6], [x1 * 0.7, z1 + R + 1300, 700, 1.8],
      ...this.islands.map(([cx, cz]) => [cx, cz, 550, 3]),
    ];
    const inIsland = (x, z, k = 0.92) => this.islands.some(([cx, cz, rx, rz]) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 < k * k);
    const outerLand = (x, z) => (x < x0 - R || ((z < z0 - R || z > z1 + R) && x < x1)) && (x > x0 - R - BOROUGH.band && z > z0 - R - BOROUGH.band && z < z1 + R + BOROUGH.band);
    const pitch = OUTER.pitch, road = OUTER.road;
    for (let gx = Math.floor((x0 - R - BOROUGH.band) / pitch); gx * pitch < x1 + 4000; gx++) {
      for (let gz = Math.floor((z0 - R - BOROUGH.band) / pitch); gz * pitch < z1 + R + BOROUGH.band; gz++) {
        const lx = gx * pitch + road, lz = gz * pitch + road, lw = pitch - road, cx = lx + lw / 2, cz = lz + lw / 2;
        const island = inIsland(cx, cz);
        if (!island && !(outerLand(lx, lz) && outerLand(lx + lw, lz + lw))) continue;
        this.block(tile(cx, cz), gx, gz, lx, lz, lw, peaks(P, cx, cz));
      }
    }
    // ---- bridges over the river on some avenues, and two big ones out to the islands
    const span = (ax, az, bx, bz, kind) => { this.bridge(tile((ax + bx) / 2, (az + bz) / 2), ax, az, bx, bz, BRIDGE[kind]); };
    for (let ix = 3; ix < city.landCols; ix += 6) {
      const x = (ix * BLOCK + ROAD / 2) * M;
      span(x, z0 - R - 30, x, z0 + 10, 'river'); span(x, z1 - 10, x, z1 + R + 30, 'river');
    }
    for (let iy = 4; iy < city.rows; iy += 7) { const z = (iy * BLOCK + ROAD / 2) * M; span(x0 - R - 30, z, x0 + 10, z, 'river'); }
    for (const [cx, cz, rx] of this.islands) {
      const z = (Math.round((cz / M - ROAD / 2) / BLOCK) * BLOCK + ROAD / 2) * M;
      span(x1 - 10, z, cx - rx * 0.85, z, 'bay');
    }
    // ---- the elevated highway round the map (west, north, south, and along the east quay)
    const o = HWY.off;
    const legs = [[x0 - o, z0 - o, x0 - o, z1 + o], [x0 - o, z0 - o, x1 + o, z0 - o], [x0 - o, z1 + o, x1 + o, z1 + o], [x1 + o, z0 - o, x1 + o, z1 + o]];
    for (const [ax, az, bx, bz] of legs) this.highway(tile, ax, az, bx, bz);
    horizon.addLand(this.islands.map(([cx, cz, rx, rz]) => {
      const pts = [];
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, w = 1 + 0.07 * Math.sin(a * 5 + cx); pts.push([cx + Math.cos(a) * rx * w, cz + Math.sin(a) * rz * w]); }
      return pts;
    }));
    // meshes: their own material instance, hazed a little faster (they're the next boroughs over)
    this.mat = look3.make(1.25, { FAR: 1 });
    for (const t of this.tiles.values()) {
      const geo = t.B.geometry();
      t.B = null;
      if (!geo) continue;
      t.mesh = new THREE.Mesh(geo, this.mat);
      scene.add(t.mesh);
    }
  }

  /** One outer block: a park, or a building (taller near a borough downtown), sometimes stepped. */
  block(B, gx, gz, lx, lz, lw, peak) {
    const h = (k) => hash2(gx, gz, 300 + k);
    if (h(0) < 0.07) { // a park: lawn and a few trees
      const G = look('#4f7a40', '#000', STYLE.gravel, '#4f7a40', STYLE.gravel);
      box(B, lx + 2, lz + 2, lx + lw - 2, lz + lw - 2, -0.3, 0.3, G, { walls: false, ink: 0 });
      return;
    }
    const inset = 4 + h(1) * 10, storeys = BOROUGH.base[0] + h(2) * (BOROUGH.base[1] - BOROUGH.base[0]);
    let H = storeys * (1 + peak * (0.5 + h(3))) + (h(4) < BOROUGH.tall ? 60 + h(5) * 70 : 0);
    const L = look(WALLS[(h(6) * WALLS.length) | 0], LITS[(h(7) * LITS.length) | 0], [STYLE.concrete, STYLE.brick, STYLE.glass, STYLE.deco][(h(8) * 4) | 0], '#5a5856', h(9) < 0.5 ? STYLE.gravel : STYLE.tar, (h(10) * 8 | 0) / 8, (h(11) * 16 | 0) / 16);
    // split some lots into two or four buildings so the grain matches the city's
    const split = h(12) < 0.45 ? 2 : 1, cw = (lw - inset * 2) / split;
    for (let i = 0; i < split; i++) for (let j = 0; j < split; j++) {
      const bx = lx + inset + i * cw, bz = lz + inset + j * cw, hh = H * (split > 1 ? 0.5 + hash2(gx * 2 + i, gz * 2 + j, 9) * 0.6 : 1);
      box(B, bx + 1, bz + 1, bx + cw - 1, bz + cw - 1, 0, hh, L, { ink: 0 });
      if (hh > 70 && split === 1) { // stepped top on the tall ones
        const s = cw * 0.18;
        box(B, bx + s, bz + s, bx + cw - s, bz + cw - s, hh, hh + hh * 0.18, L, { ink: 0 });
        if (h(13) < 0.5) prism(B, bx + cw / 2, bz + cw / 2, cw * 0.25, 0, hh * 1.18, hh * 1.32, 4, L, { rot: Math.PI / 4, ink: 0 });
      }
    }
  }

  /** A deck on piers between two points (axis-aligned), towers and lit cables on the long ones. */
  bridge(B, ax, az, bx, bz, S) {
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az), len = Math.hypot(bx - ax, bz - az), w = S.w / 2;
    const D = look('#7a7670', '#ffd890', STYLE.concrete, '#3a3a40', STYLE.tar), T = look('#a8382e', '#ffd890', STYLE.industrial, '#a8382e');
    const r = alongX ? [Math.min(ax, bx), az - w, Math.max(ax, bx), az + w] : [ax - w, Math.min(az, bz), ax + w, Math.max(az, bz)];
    box(B, r[0], r[1], r[2], r[3], S.deck - 2, S.deck, D, { ink: 0 });
    const at = (t) => [ax + (bx - ax) * t, az + (bz - az) * t];
    const side = (s, x, z) => (alongX ? [x, z + s * (w + 1)] : [x + s * (w + 1), z]);
    for (const s of [-1, 1]) {
      for (const t of [0.25, 0.75]) {
        const [qx, qz] = side(s, ...at(t)), tw = 2.2;
        box(B, qx - tw, qz - tw, qx + tw, qz + tw, -1, S.deck + S.tower, T, { ink: 0 });
        lamp(B, qx, S.deck + S.tower + 1.5, qz, 1.2, '#ff3030', KIND.beacon, t);
      }
      // cable lights: a sagging string of lamps from the ends over both towers
      const n = Math.max(8, Math.round(len / 16));
      for (let k = 1; k < n; k++) {
        const u = k / n, dt = Math.min(1, Math.min(Math.abs(u - 0.25), Math.abs(u - 0.75)) / 0.25);
        const [cx, cz] = side(s, ...at(u));
        lamp(B, cx, S.deck + S.tower * (1 - Math.sin(dt * Math.PI / 2) * 0.92), cz, 0.7, '#fff2c0');
      }
    }
    this.roads.push({ a: [ax, az], b: [bx, bz], y: S.deck + 0.9, lanes: 2, w });
  }

  /** The elevated ring highway: deck on pillars, with lamps along its edge. */
  highway(tile, ax, az, bx, bz) {
    const alongX = Math.abs(bx - ax) > Math.abs(bz - az), w = HWY.w / 2, len = Math.hypot(bx - ax, bz - az);
    const D = look('#8a8682', '#ffd890', STYLE.concrete, '#2e2e34', STYLE.tar);
    const n = Math.ceil(len / 300);
    for (let i = 0; i < n; i++) { // in pieces so each sits in its own culling tile
      const t0 = i / n, t1 = (i + 1) / n, p0 = [ax + (bx - ax) * t0, az + (bz - az) * t0], p1 = [ax + (bx - ax) * t1, az + (bz - az) * t1];
      const B = tile((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      const r = alongX ? [Math.min(p0[0], p1[0]), p0[1] - w, Math.max(p0[0], p1[0]), p0[1] + w] : [p0[0] - w, Math.min(p0[1], p1[1]), p0[0] + w, Math.max(p0[1], p1[1])];
      box(B, r[0], r[1], r[2], r[3], HWY.deck - 1.6, HWY.deck, D, { ink: 0 });
      for (let k = 0; k * HWY.pillar < len * (t1 - t0); k++) {
        const u = t0 + (k * HWY.pillar) / len, px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
        box(B, px - 1.6, pz - 1.6, px + 1.6, pz + 1.6, -1, HWY.deck - 1.6, D, { ink: 0 });
        lamp(B, alongX ? px : px + w, HWY.deck + 3, alongX ? pz + w : pz, 0.5, '#ffb050');
      }
    }
    this.roads.push({ a: [ax, az], b: [bx, bz], y: HWY.deck + 0.9, lanes: 4, w });
  }

  /** Show the tiles within `far` metres of the camera. */
  update(cam, far) {
    for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = Math.hypot(t.cx - cam.position.x, t.cz - cam.position.z) - TILE_M * 0.71 < far;
  }
}
