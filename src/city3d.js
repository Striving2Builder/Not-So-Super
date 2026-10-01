// The procedural city (city.js data) as real 3D for the three.js flight slice (?flight=3d).
// Buildings are extruded from their footprints, much taller than the 2D view's (DISTRICT_3D), and
// merged per 3x3-block chunk into ONE mesh with one material (a two-style facade texture: concrete
// and glass, picked per vertex), plus that chunk's ink edges and its ground tile (the 2D view's
// baked ground art, reused as a texture). Far away there is only a single district-coloured plane.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { CityArt, TILE } from './cityart.js';
import { comic, gradMap, pushBack } from './look3d.js';
import { hash2 } from './rng.js';

/** Metres per world unit (world = the 2D game's units). Scene: x = east, y = up, z = south. */
export const M = 0.5;
const CHUNK = TILE * BLOCK; // world units per chunk side (one ground tile)

/**
 * How each district stands up in 3D: height multiplier over the 2D data, extra random spread,
 * and the facade style (0 concrete, 1 glass). Downtown and Financial make the canyons.
 */
export const DISTRICT_3D = {
  financial: { mult: 2.3, spread: 0.7, glass: 1 },
  downtown: { mult: 2.0, spread: 0.8, glass: 0.4 },
  casino: { mult: 1.7, spread: 0.6, glass: 0.6 },
  entertainment: { mult: 1.4, spread: 0.5, glass: 0.2 },
  residential: { mult: 1.4, spread: 0.6, glass: 0 },
  nightclub: { mult: 1.2, spread: 0.4, glass: 0.1 },
  redlight: { mult: 1.1, spread: 0.4, glass: 0 },
  naughty: { mult: 1.1, spread: 0.4, glass: 0 },
  retail: { mult: 1.0, spread: 0.3, glass: 0.1 },
  warehouse: { mult: 1.0, spread: 0.2, glass: 0 },
  factory: { mult: 1.0, spread: 0.2, glass: 0 },
  docks: { mult: 1.0, spread: 0.1, glass: 0 },
  lair: { mult: 1.0, spread: 0.3, glass: 0 },
  suburb: { mult: 1.0, spread: 0.1, glass: 0 },
  farm: { mult: 1.0, spread: 0.1, glass: 0 },
};

/** The 3D height (world units) of a building from city.js. Cached on the object. */
export function height3(o, district) {
  if (o.h3 !== undefined) return o.h3;
  const d = DISTRICT_3D[district] || DISTRICT_3D.retail;
  const tall = o.kind === 'box' && !o.house && !o.container && !o.truck && !o.ship && !o.barn;
  o.h3 = tall ? o.h * (d.mult + d.spread * (hash2(o.x | 0, o.y | 0, 31) - 0.5)) : o.h;
  return o.h3;
}

// ---------------------------------------------------------------- facade textures
/**
 * Two facade styles side by side in one texture (concrete left, glass right), each a grid of
 * FACADE.cols x FACADE.rows windows (one window = FACADE.win m wide, one floor = FACADE.floor m).
 * The emissive twin has whole floors dark or busy, so lit towers don't look stamped. The shader
 * wraps uv per style with fract(), so one material covers every building.
 */
const FACADE = { cols: 8, rows: 16, cell: 32, win: 4, floor: 3.6 };
function facadeTextures() {
  const { cols, rows, cell } = FACADE, SW = cols * cell, H = rows * cell, W = SW * 2;
  const base = document.createElement('canvas'), lit = document.createElement('canvas');
  base.width = lit.width = W; base.height = lit.height = H;
  const b = base.getContext('2d'), l = lit.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, W, H);
  for (let style = 0; style < 2; style++) {
    const ox = style * SW;
    b.fillStyle = style ? '#d2dcea' : '#ebe4d6'; b.fillRect(ox, 0, SW, H);
    for (let r = 0; r < rows; r++) {
      const busy = hash2(r, style, 9); // per floor: dark, some, or most windows on
      for (let c = 0; c < cols; c++) {
        const x = ox + c * cell, y = r * cell;
        const [mx, my] = style ? [2, 4] : [7, 8]; // glass: big panes; concrete: punched windows
        b.fillStyle = style ? '#5a7898' : '#39404e';
        b.fillRect(x + mx, y + my, cell - mx * 2, cell - my * 2);
        b.fillStyle = 'rgba(255,255,255,.22)'; b.fillRect(x + mx, y + my, (cell - mx * 2) * 0.35, cell - my * 2); // sky glint
        b.fillStyle = 'rgba(0,0,0,.28)'; b.fillRect(x, y + cell - 2, cell, 2); // floor slab line
        if (hash2(c + style * 17, r, 5) < busy * 0.9) {
          l.fillStyle = hash2(c, r + style * 11, 6) < 0.75 ? '#ffcf7a' : '#bfe0ff';
          l.fillRect(x + mx + 1, y + my + 1, cell - mx * 2 - 2, cell - my * 2 - 2);
        }
      }
    }
    // a solid wall texel at each style's corner for roofs (uv 0.01, 0.01 within the style)
    b.fillStyle = style ? '#d2dcea' : '#ebe4d6'; b.fillRect(ox, 0, 5, 5);
    l.fillStyle = '#000'; l.fillRect(ox, 0, 5, 5);
  }
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: mk(base), lit: mk(lit) };
}

/** One shared toon material for every building; `aStyle` picks the facade half per vertex. */
function buildingMaterial(tex) {
  const m = new THREE.MeshToonMaterial({ map: tex.map, emissiveMap: tex.lit, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, gradientMap: gradMap(3) });
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aStyle;\nvarying float vStyle;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvStyle = aStyle;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vStyle;')
      .replace('#include <map_fragment>', `
vec2 fUV = vec2((fract(vMapUv.x) * 0.96 + 0.02 + vStyle) * 0.5, fract(vMapUv.y) * 0.96 + 0.02);
diffuseColor *= texture2D(map, fUV);`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= texture2D(emissiveMap, fUV).rgb;');
    if (prev) prev.call(m, sh, r);
  };
  comic(m, { halftone: 0.45 });
  pushBack(m);
  return m;
}

// ---------------------------------------------------------------- geometry
/** Collects quads for one chunk: positions, normals, uvs, colours, style. */
class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.s = []; }
  quad(a, b, c, d, nrm, uvs, col, style) {
    for (const [v, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [a, uvs[0]], [c, uvs[2]], [d, uvs[3]]]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.uv.push(t[0], t[1]);
      this.c.push(col.r, col.g, col.b); this.s.push(style);
    }
  }
  geometry() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aStyle', new THREE.Float32BufferAttribute(this.s, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const _c = new THREE.Color(), _r = new THREE.Color();
/** An extruded box building (world-unit footprint, height h) with facade uvs in metres. */
function addBox(B, x, y, w, d, h, col, style, seed, roofCol, base = 0) {
  const x0 = x * M, x1 = (x + w) * M, z0 = y * M, z1 = (y + d) * M, top = h * M, bot = base * M;
  const off = Math.floor(seed * FACADE.cols) / FACADE.cols, voff = (Math.floor(seed * 37) % FACADE.rows) / FACADE.rows; // vary which windows are lit
  _c.set(col);
  const wallU = (len) => len / (FACADE.win * FACADE.cols), wallV = (top - bot) / (FACADE.floor * FACADE.rows);
  const face = (a, b, nrm, len) => {
    const u1 = off + wallU(len);
    B.quad([a[0], bot, a[1]], [b[0], bot, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], nrm, [[off, voff], [u1, voff], [u1, voff + wallV], [off, voff + wallV]], _c, style);
  };
  face([x0, z1], [x1, z1], [0, 0, 1], (x1 - x0)); // south
  face([x1, z0], [x0, z0], [0, 0, -1], (x1 - x0)); // north
  face([x1, z1], [x1, z0], [1, 0, 0], (z1 - z0)); // east
  face([x0, z0], [x0, z1], [-1, 0, 0], (z1 - z0)); // west
  _r.set(roofCol || col).multiplyScalar(0.85);
  B.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0], [0, 1, 0], [[0.01, 0.01], [0.01, 0.01], [0.01, 0.01], [0.01, 0.01]], _r, style);
  return top;
}

/** Rooftop kit on bigger roofs: a mechanical penthouse and a water tank / AC block. */
function addRoofKit(B, o, h) {
  const s = hash2(o.x | 0, o.y | 0, 41);
  if (o.w < 50 || o.d < 50) return;
  const pw = o.w * (0.25 + s * 0.15), pd = o.d * (0.25 + s * 0.1);
  addBox(B, o.x + o.w * 0.2, o.y + o.d * 0.25, pw, pd, h + 14 + s * 16, '#6f7680', 0, s, '#5a616b', h);
  addBox(B, o.x + o.w * 0.65, o.y + o.d * 0.6, 12, 10, h + 8, '#aab0b8', 0, s, '#c3c8cf', h);
}

// ---------------------------------------------------------------- the city
export class City3D {
  constructor(city, scene, { tileRes = 144 } = {}) {
    this.city = city; this.scene = scene;
    this.tex = facadeTextures();
    this.mat = buildingMaterial(this.tex);
    this.inkMat = new THREE.LineBasicMaterial({ color: 0x120c14, transparent: true, opacity: 0.85 });
    this.neonMat = new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false });
    this.art = new CityArt(city, tileRes, 400); // big cache: tile canvases back live textures, never recycle them
    this.chunks = new Map();
    this.cols = Math.ceil(city.cols / TILE); this.rows = Math.ceil(city.rows / TILE);
    for (const b of city.blocks) for (const o of b.b) height3(o, b.d);
    this.addGround();
  }

  /** District-coloured ground for the whole city in one draw (the near tiles sit on top). */
  addGround() {
    const c = this.city, t = new THREE.CanvasTexture(c.minimap);
    t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.PlaneGeometry(c.W * M, c.H * M);
    g.rotateX(-Math.PI / 2); g.translate((c.W * M) / 2, -0.3, (c.H * M) / 2);
    this.far = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, color: 0x6a6878 }));
    this.scene.add(this.far);
    const sea = new THREE.PlaneGeometry(6000, c.H * M + 6000);
    sea.rotateX(-Math.PI / 2); sea.translate(c.coastX * M + 3000, -0.5, (c.H * M) / 2);
    this.sea = new THREE.Mesh(sea, comic(new THREE.MeshToonMaterial({ color: 0x1d4f78, gradientMap: gradMap(3) }), { halftone: 0.3 }));
    this.scene.add(this.sea);
    // the countryside round the city out to the horizon (no edge of the world at high patrol)
    const land = new THREE.PlaneGeometry(30000, 30000);
    land.rotateX(-Math.PI / 2); land.translate((c.W * M) / 2 - 6000, -1, (c.H * M) / 2);
    this.scene.add(new THREE.Mesh(land, new THREE.MeshBasicMaterial({ color: 0x2c4a30 })));
  }

  chunk(cx, cy) {
    const k = cy * 64 + cx;
    let ch = this.chunks.get(k);
    if (ch) return ch;
    const B = new Builder(), city = this.city, neon = [], neonCol = [];
    for (let by = cy * TILE; by < cy * TILE + TILE; by++) for (let bx = cx * TILE; bx < cx * TILE + TILE; bx++) {
      const blk = city.block(bx, by);
      if (!blk) continue;
      const D = DISTRICT_3D[blk.d] || DISTRICT_3D.retail;
      for (const o of blk.b) {
        const seed = hash2(o.x | 0, o.y | 0, 13);
        if (o.kind === 'box') {
          const style = !o.house && !o.container && hash2(o.x | 0, o.y | 0, 7) < D.glass ? 1 : 0;
          const h = addBox(B, o.x, o.y, o.w, o.d, o.h3, o.col, style, seed, o.roofCol || (o.gold ? '#d8b24a' : null));
          if (h > 30 && !o.container) addRoofKit(B, o, o.h3);
          if (o.neon) {
            // neon tubes round the roof edge and a band two floors down (the vice districts glow)
            for (const [yy, col] of [[h + 0.4, o.neon], [Math.max(3, h - 7), o.neon2 || o.neon]]) {
              const x0 = o.x * M, x1 = (o.x + o.w) * M, z0 = o.y * M - 0.2, z1 = (o.y + o.d) * M + 0.2;
              const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
              _c.set(col);
              for (let i = 0; i < 4; i++) { const a = pts[i], q = pts[(i + 1) % 4]; neon.push(a[0], yy, a[1], q[0], yy, q[1]); neonCol.push(_c.r, _c.g, _c.b, _c.r, _c.g, _c.b); }
            }
          }
        } else if (o.kind === 'round') {
          // octagonal prism
          const r = o.rad, n = 8, cxw = o.x, cyw = o.y;
          for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
            const p0 = [(cxw + Math.cos(a0) * r) * M, (cyw + Math.sin(a0) * r) * M], p1 = [(cxw + Math.cos(a1) * r) * M, (cyw + Math.sin(a1) * r) * M];
            const am = (a0 + a1) / 2, top = o.h3 * M;
            _c.set(o.col);
            B.quad([p1[0], 0, p1[1]], [p0[0], 0, p0[1]], [p0[0], top, p0[1]], [p1[0], top, p1[1]], [Math.cos(am), 0, Math.sin(am)], [[0.01, 0.01], [0.01, 0.01], [0.01, 0.01], [0.01, 0.01]], _c, 0);
            _r.set(o.stack ? '#1a1a1a' : o.col).multiplyScalar(0.8);
            B.quad([cxw * M, top, cyw * M], [p0[0], top, p0[1]], [p1[0], top, p1[1]], [cxw * M, top, cyw * M], [0, 1, 0], [[0.01, 0.01], [0.01, 0.01], [0.01, 0.01], [0.01, 0.01]], _r, 0);
          }
        }
      }
    }
    const geo = B.geometry();
    ch = { cx, cy, mesh: null, ink: null, ground: null, groundLit: null };
    if (geo) {
      ch.mesh = new THREE.Mesh(geo, this.mat);
      this.scene.add(ch.mesh);
      const e = new THREE.EdgesGeometry(geo, 30);
      ch.ink = new THREE.LineSegments(e, this.inkMat);
      this.scene.add(ch.ink);
    }
    if (neon.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(neon, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(neonCol, 3));
      ch.neon = new THREE.LineSegments(g, this.neonMat);
      this.scene.add(ch.neon);
    }
    this.chunks.set(k, ch);
    return ch;
  }

  /** Ground tile texture for a chunk (the 2D view's baked art), near chunks only. */
  groundTile(ch, lit, frame) {
    const key = lit ? 'gl' : 'gd';
    if (!ch[key]) {
      const c = this.art.tile(ch.cx, ch.cy, frame, true, lit);
      if (!c) return;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const g = new THREE.PlaneGeometry(CHUNK * M, CHUNK * M);
      g.rotateX(-Math.PI / 2); g.translate((ch.cx + 0.5) * CHUNK * M, 0, (ch.cy + 0.5) * CHUNK * M);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t }));
      ch[key] = m;
      this.scene.add(m);
    }
    for (const k of ['gl', 'gd']) if (ch[k]) ch[k].visible = k === key;
  }

  /**
   * Show the chunks around the camera: buildings within `far` metres, ground tiles and ink within
   * `near`. Builds chunks on first sight (a couple per frame, so flying never hitches).
   */
  update(cam, { far = 1500, near = 700, night = 0, frame = 0 } = {}) {
    const px = cam.position.x / M, pz = cam.position.z / M;
    const R = Math.ceil(far / M / CHUNK) + 1;
    const ccx = Math.floor(px / CHUNK), ccy = Math.floor(pz / CHUNK);
    let budget = this.built ? 2 : 999;
    for (const ch of this.chunks.values()) { if (ch.neon) ch.neon.visible = false; if (ch.mesh) ch.mesh.visible = false; if (ch.ink) ch.ink.visible = false; if (ch.gl) ch.gl.visible = false; if (ch.gd) ch.gd.visible = false; }
    for (let cy = ccy - R; cy <= ccy + R; cy++) for (let cx = ccx - R; cx <= ccx + R; cx++) {
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
      const dx = ((cx + 0.5) * CHUNK - px) * M, dz = ((cy + 0.5) * CHUNK - pz) * M, d = Math.hypot(dx, dz) - CHUNK * M * 0.7;
      if (d > far) continue;
      let ch = this.chunks.get(cy * 64 + cx);
      if (!ch) { if (budget-- <= 0) continue; ch = this.chunk(cx, cy); }
      if (ch.mesh) ch.mesh.visible = true;
      if (ch.neon) ch.neon.visible = true;
      if (ch.ink) ch.ink.visible = d < near;
      if (d < near * 1.2) this.groundTile(ch, night > 0.45, frame);
    }
    this.built = true;
    this.mat.emissiveIntensity = 1.2 * Math.max(0, night - 0.2);
  }
}
