// The procedural city (city.js data) as real 3D for the three.js flight slice (?flight=3d).
// Orchestration only: chunks of 3x3 blocks, each ONE mesh in ONE draw call (towers, roofs, ink,
// neon, signs: see buildings3d / blocks3d), a cheaper material for far chunks, the signature
// landmarks (always drawn), the 2D view's baked ground art as near ground, the horizon (skyline
// ring, sea) and street life (traffic lights, steam).
import * as THREE from 'three';
import { BLOCK } from './city.js';
import { CityArt, TILE } from './cityart.js';
import { M, Builder, CityLook, box, prism, look, STYLE } from './buildings3d.js';
import { DISTRICT_3D, height3, building, round, crane, tree } from './blocks3d.js';
import { SignAtlas } from './signs3d.js';
import { chooseLandmarks, buildLandmarks } from './landmarks3d.js';
import { Horizon, haze } from './skyline3d.js';
import { Street } from './street3d.js';

export { M, DISTRICT_3D, height3 };

const CHUNK = TILE * BLOCK; // world units per chunk side (one ground tile)
/** farMat: metres past which a chunk switches to its lite build + flat-tone material (no texture, ink, halftone, roof kit). */
const LOD = { farMat: 300, landmarkFog: 0.45, coreR: 4.5 };

export class City3D {
  constructor(city, scene, { tileRes = 144 } = {}) {
    this.city = city; this.scene = scene;
    this.signs = new SignAtlas();
    this.look = new CityLook(this.signs.tex);
    this.art = new CityArt(city, tileRes, 400); // big cache: tile canvases back live textures, never recycle them
    this.chunks = new Map();
    this.cols = Math.ceil(city.cols / TILE); this.rows = Math.ceil(city.rows / TILE);
    // the skyline peaks over downtown + financial: buildings there get taller toward the core
    const core = ['downtown', 'financial'].map((t) => city.seeds.find((s) => s.type === t)).filter(Boolean);
    const cx = core.reduce((a, s) => a + s.x, 0) / core.length, cy = core.reduce((a, s) => a + s.y, 0) / core.length;
    this.landmarks = chooseLandmarks(city); // sets their o.h3 first
    for (const b of city.blocks) {
      const k = Math.exp(-((Math.hypot(b.bx + 0.5 - cx, b.by + 0.5 - cy) / LOD.coreR) ** 2));
      for (const o of b.b) height3(o, b.d, k);
    }
    // the key light + ambient come from the sky's own lights (Sky3D is built before the city)
    this.sun = scene.children.find((o) => o.isDirectionalLight);
    this.hemi = scene.children.find((o) => o.isHemisphereLight);
    const LB = buildLandmarks(this.landmarks, this.signs);
    this.harbour(LB);
    this.lmMat = this.look.make(LOD.landmarkFog);
    this.lmMesh = new THREE.Mesh(LB.geometry(), this.lmMat);
    this.lmMesh.frustumCulled = false;
    scene.add(this.lmMesh);
    this.addGround();
    this.horizon = new Horizon(scene, this.look.U, city, M);
    this.street = new Street(city, scene, this.look.U, M);
    this.t0 = performance.now();
  }

  /** Piers, ships and the quay edge along the coast (few: they ride with the landmarks). */
  harbour(B) {
    const c = this.city;
    const Q = look('#d8d4c8', '#000', STYLE.concrete, '#9a968c', STYLE.gravel);
    box(B, c.coastX * M - 2, 0, c.coastX * M + 0.5, c.H * M, -1, 1.2, Q, { ink: 1 });
    for (const w of c.water) {
      const x0 = w.x * M, z0 = w.y * M, x1 = (w.x + w.w) * M, z1 = (w.y + w.h) * M;
      if (w.t === 'pier') { box(B, x0, z0, x1, z1, -1, 1.5, Q, { ink: 0.8 }); continue; }
      const hull = look(w.col, '#ffd080', STYLE.industrial, '#5a5a58', STYLE.tar);
      box(B, x0, z0 + 1, x1, z1 - 1, -1, 5, hull, { ink: 1 });
      box(B, x1 - 18, z0 + 4, x1 - 6, z1 - 4, 5, 13, look('#e8e4d8', '#ffd080', STYLE.concrete, '#3a3d44'), { ink: 1 });
      for (let k = 0; k < 4; k++) box(B, x0 + 8 + k * 14, z0 + 3, x0 + 20 + k * 14, z1 - 3, 5, 8 + (k % 2) * 2.5, look(['#b8452f', '#2f6fb8', '#d9a53a', '#3a8a5a'][k], '#000', STYLE.industrial), { ink: 0.6 });
      prism(B, x1 - 12, (z0 + z1) / 2, 0.4, 0.3, 13, 20, 4, hull, { ink: 0.5 });
    }
  }

  /** District-coloured ground for the whole city in one draw (the near tiles sit on top). */
  addGround() {
    const c = this.city, t = new THREE.CanvasTexture(c.minimap);
    t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.PlaneGeometry(c.W * M, c.H * M);
    g.rotateX(-Math.PI / 2); g.translate((c.W * M) / 2, -0.3, (c.H * M) / 2);
    this.far = new THREE.Mesh(g, haze(new THREE.MeshBasicMaterial({ map: t, color: 0x6a6878 })));
    this.scene.add(this.far);
    // the countryside round the city out to the horizon (no edge of the world at high patrol)
    const land = new THREE.PlaneGeometry(30000, 30000);
    land.rotateX(-Math.PI / 2); land.translate((c.W * M) / 2 - 6000, -1, (c.H * M) / 2);
    this.scene.add(new THREE.Mesh(land, haze(new THREE.MeshBasicMaterial({ color: 0x3a5238 }))));
  }

  /** A chunk's record (meshes built lazily: `near` full detail, `lite` for the far LOD). */
  chunk(cx, cy) {
    const k = cy * 64 + cx;
    let ch = this.chunks.get(k);
    if (!ch) { ch = { cx, cy }; this.chunks.set(k, ch); }
    return ch;
  }

  /** Build one of a chunk's meshes ('near' | 'lite'); null when the chunk is empty. */
  build(ch, which) {
    const B = new Builder(which === 'lite'), city = this.city;
    for (let by = ch.cy * TILE; by < ch.cy * TILE + TILE; by++) for (let bx = ch.cx * TILE; bx < ch.cx * TILE + TILE; bx++) {
      const blk = city.block(bx, by);
      if (!blk) continue;
      for (const o of blk.b) {
        if (o.landmark) continue;
        if (o.kind === 'box') building(B, o, blk, this.signs);
        else if (o.kind === 'round') round(B, o);
        else if (o.kind === 'tree') { if (!B.lite) tree(B, o.x * M, o.y * M, o.rad * M * 0.8, o.h * M * 0.9, o.col); }
        else if (o.kind === 'crane') crane(B, o);
      }
    }
    const geo = B.geometry();
    ch[which] = geo ? new THREE.Mesh(geo, B.lite ? this.look.far : this.look.near) : null;
    if (ch[which]) this.scene.add(ch[which]);
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
      const m = new THREE.Mesh(g, haze(new THREE.MeshBasicMaterial({ map: t })));
      ch[key] = m;
      this.scene.add(m);
    }
    for (const k of ['gl', 'gd']) if (ch[k]) ch[k].visible = k === key;
  }

  /**
   * Show the chunks around the camera: buildings within `far` metres (flat-tone material past
   * LOD.farMat), ground tiles within `near`. Builds chunks on first sight (a couple per frame).
   */
  update(cam, { far = 1500, near = 700, night = 0, frame = 0 } = {}) {
    const px = cam.position.x / M, pz = cam.position.z / M;
    const R = Math.ceil(far / M / CHUNK) + 1;
    const ccx = Math.floor(px / CHUNK), ccy = Math.floor(pz / CHUNK);
    let budget = this.built ? 2 : 999;
    for (const ch of this.chunks.values()) for (const k of ['near', 'lite', 'gl', 'gd']) if (ch[k]) ch[k].visible = false;
    const cut = far * 0.92; // the haze is all but solid past this
    for (let cy = ccy - R; cy <= ccy + R; cy++) for (let cx = ccx - R; cx <= ccx + R; cx++) {
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
      const dx = ((cx + 0.5) * CHUNK - px) * M, dz = ((cy + 0.5) * CHUNK - pz) * M, d = Math.hypot(dx, dz) - CHUNK * M * 0.7;
      if (d > cut) continue;
      const ch = this.chunk(cx, cy), which = d > LOD.farMat ? 'lite' : 'near';
      if (ch[which] === undefined) {
        if (budget-- <= 0) { const other = ch[which === 'near' ? 'lite' : 'near']; if (other) other.visible = true; continue; }
        this.build(ch, which);
      }
      if (ch[which]) ch[which].visible = true;
      if (d < near * 1.2) this.groundTile(ch, night > 0.45, frame);
    }
    this.built = true;
    this.look.light(this.sun, this.hemi, this.scene.fog, night, (performance.now() - this.t0) / 1000);
    this.horizon.update(cam);
    this.street.update();
  }
}
