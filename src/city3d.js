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
import { chooseLandmarks, buildLandmarks, districtGlow } from './landmarks3d.js';
import { Horizon, haze } from './skyline3d.js';
import { Outer } from './outer3d.js';
import { cityGround, tone, dressNear, lotDressing } from './ground3d.js';
import { buildRiver } from './river3d.js';
import { SkyCard, FarRing } from './skycard3d.js';
import { Street } from './street3d.js';
import { onGfxReset } from './gfx.js';
import { work } from './diag.js';

export { M, DISTRICT_3D, height3 };

const GREEN3 = ['#2f6b34', '#3a7a3a', '#4a8a3a'];
const CHUNK = TILE * BLOCK; // world units per chunk side (one ground tile)
/**
 * farMat: metres past which a chunk switches to its lite build + flat-tone material (no texture, ink,
 * halftone, roof kit). The builds' detail (roof kit, trees; the lite builds' penthouses) is drawn
 * only within `detail` / `liteDetail` metres of the lens (3D distance) and below `detailAlt`; ground
 * tiles only below `tileAlt` (from high patrol the street plan carries the ground alone): high patrol
 * draws the skyline's mass, skim and cruise keep everything.
 */
const LOD = { farMat: 260, farInk: 0, landmarkFog: 0.8, landmarkMax: 0.93, coreR: 4.5, detail: 470, liteDetail: 800, detailAlt: 340, tileAlt: 340 }; // (cruise flies at ~280 m)
/**
 * Memory: at most `near` near builds / `tiles` ground tiles (of the lighting in use) stay built.
 * Past that the FARTHEST go first, and only those more than `margin` m beyond where they're drawn
 * and unseen for `idle` ms (a U-turn or a loop back finds them still there); the other lighting's
 * tiles go once unseen for `idle`. Building, painting and uploading run nearest / in view first
 * within `ms` per frame (at least one job a frame), so flying back over freed blocks never stalls a
 * frame on a burst of rebuilds: the far build (or the ground plan) stands in meanwhile.
 */
const KEEP = { near: 40, tiles: 40, idle: 6000, margin: 350, every: 500, ms: 4 }; // (ms: frame counts would trim far too late on a slow device)

/** Draw a build's body only, or body + detail (its index runs: Builder.detail). */
const range = (m, full) => m.geometry.setDrawRange(0, full ? m.geometry.userData.all : m.geometry.userData.body);

export class City3D {
  constructor(city, scene, { tileRes = 144 } = {}) {
    this.city = city; this.scene = scene;
    this.signs = new SignAtlas();
    this.look = new CityLook(this.signs.tex);
    // ground tiles are painted into one scratch canvas and uploaded at once (the texture keeps no
    // canvas: ~0.75 MB of canvas memory per tile saved); a lost/replaced context drops them all
    this.art = new CityArt(city, tileRes, 0);
    this.scratch = null;
    this.renderer = null; // (set by the caller each frame: textures upload through it)
    this.art.riverBank = '#4f7046'; // green banks: the 3D river is a smooth ribbon laid over them
    // the near tiles wear the far plan's muted lot tones and lot dressing, so there is no seam where they meet
    this.art.tone = tone; this.art.dress = dressNear;
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
    // the dome's horizon colour: the haze ends exactly on it, so there is never a visible edge
    this.dome = scene.children.find((o) => o.material?.uniforms?.bottom);
    const LB = buildLandmarks(this.landmarks, this.signs);
    // the harbour is hazed like everything else (in the landmarks' mesh it sat on the horizon as a dark band)
    const HB = new Builder();
    this.harbour(HB);
    this.harbourMesh = new THREE.Mesh(HB.geometry(), this.look.near);
    scene.add(this.harbourMesh, new THREE.Mesh(HB.inkGeometry(), this.look.ink));
    this.lmMat = this.look.make(LOD.landmarkFog, {}, LOD.landmarkMax, 1e5); // their crowns glow from anywhere
    this.lmMesh = new THREE.Mesh(LB.geometry(), this.lmMat);
    this.lmMesh.frustumCulled = false;
    scene.add(this.lmMesh, new THREE.Mesh(LB.inkGeometry(), this.look.ink));
    this.ground = cityGround(city, this.look.U, this.landmarks, tileRes >= 128); // lean tiles: a lighter plan too
    scene.add(this.ground);
    this.offReset = onGfxReset(() => this.gfxReset());
    this.horizon = new Horizon(scene, this.look.U, [0, 0, city.coastX * M, city.H * M]);
    this.outer = new Outer(city, scene, this.look, this.horizon);
    this.river = buildRiver(city, scene, this.look, this.horizon.sea.material);
    this.card = new SkyCard(scene, this.look.U);
    this.ring = new FarRing(scene, this.look.U, this.card.tex, city.coastX * M, this.outer.islands);
    this.glow = districtGlow(city, scene, this.look.U);
    /** Optional hook: flight3d may set `city3.sky = sky` so the haze ends on `Sky3D.horizon`. */
    this.sky = null;
    this.street = new Street(city, scene, this.look.U, M, this.outer.roads);
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
        else if (o.kind === 'tree') { if (!B.lite) B.detail(() => tree(B, o.x * M, o.y * M, o.rad * M * 0.8, o.h * M * 0.9, o.col)); }
        else if (o.kind === 'crane') crane(B, o);
      }
      // the lot dressing's tree clusters (the far plan paints the same trees as canopies)
      if (!B.lite && !blk.river) B.detail(() => { for (const t of lotDressing(blk).trees) tree(B, t.x * M, t.y * M, t.r * M * 0.8, (16 + t.h * 10) * M * 0.9, GREEN3[(t.h * 3) | 0]); });
    }
    const geo = B.geometry(), ink = B.inkGeometry();
    ch[which] = geo ? new THREE.Mesh(geo, B.lite ? this.look.far : this.look.near) : null;
    if (ch[which]) { ch[which].visible = false; this.scene.add(ch[which]); } // (update() shows what's wanted)
    // far chunks' ink only within LOD.farInk (one more draw each; the haze takes the rest)
    if (ink) { const m = (ch[which + 'Ink'] = new THREE.Mesh(ink, this.look.ink)); m.visible = false; this.scene.add(m); }
    work.built++;
  }

  /**
   * Paint + upload a chunk's ground tile (the 2D view's baked art) for the lighting `key` ('gl' lit /
   * 'gd' day). The canvas is a shared scratch: the texture is uploaded right away and keeps none.
   */
  groundTile(ch, key) {
    const r = this.renderer, size = this.art.res * TILE;
    let c = this.scratch;
    if (!r) c = document.createElement('canvas'); // (no renderer yet: this tile keeps its own canvas)
    else if (!c) c = this.scratch = document.createElement('canvas');
    if (c.width !== size) c.width = c.height = size;
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, size, size);
    this.art.paintTile(g, ch.cx, ch.cy, key === 'gl');
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (r) r.initTexture(t); // (uploaded now, so the scratch can take the next tile)
    const geo = new THREE.PlaneGeometry(CHUNK * M, CHUNK * M);
    geo.rotateX(-Math.PI / 2); geo.translate((ch.cx + 0.5) * CHUNK * M, 0, (ch.cy + 0.5) * CHUNK * M);
    const m = new THREE.Mesh(geo, haze(new THREE.MeshBasicMaterial({ map: t }), this.look.U));
    m.visible = false;
    ch[key] = m;
    this.scene.add(m);
    work.painted++;
  }

  /** Free one of a chunk's meshes ('near', 'nearInk', 'gl', 'gd'). */
  free(ch, k) {
    const m = ch[k];
    if (!m) return;
    this.scene.remove(m);
    m.geometry.dispose();
    if (m.material.map) { m.material.map.dispose(); m.material.dispose(); } // (tile materials are per tile; the city's are shared)
    delete ch[k];
    work.freed++;
  }

  /**
   * Give back what she flew away from. Every chunk's near build and ground tiles used to stay on
   * the GPU for good: one tour of the city piled up ~170 MB more (tiles ~1 MB each, day and night,
   * plus their 2D canvases), and long sessions took iOS Safari down. Past the KEEP budget, the near
   * builds and tiles farthest away (and well beyond their draw radius, unseen for a while) are
   * freed; the other lighting's tiles go once unseen for a while. They're rebuilt on the way back,
   * a few a frame, with stand-ins.
   */
  trim(n) {
    const dist = (ch) => Math.hypot(((ch.cx + 0.5) * CHUNK - this.px) * M, ((ch.cy + 0.5) * CHUNK - this.pz) * M) - CHUNK * M * 0.7;
    const prune = (key, max, far, drop) => {
      let total = 0;
      const list = [];
      for (const ch of this.chunks.values()) {
        if (!ch[key]) continue;
        total++;
        if (n - (ch[key + 'Seen'] || 0) > KEEP.idle && (ch.dd = dist(ch)) > far) list.push(ch);
      }
      if (total <= max) return;
      list.sort((a, b) => b.dd - a.dd);
      for (let i = 0; i < list.length && total > max; i++, total--) drop(list[i]);
    };
    prune('near', KEEP.near, LOD.farMat + KEEP.margin, (ch) => { this.free(ch, 'near'); this.free(ch, 'nearInk'); });
    const active = this.lit ? 'gl' : 'gd', other = this.lit ? 'gd' : 'gl';
    prune(active, KEEP.tiles, this.tileR + KEEP.margin, (ch) => this.free(ch, active));
    prune(other, 0, -Infinity, (ch) => this.free(ch, other));
  }

  /**
   * The screen's context was restored or replaced: the tiles kept no canvas, so they go (repainted
   * as needed). Not disposed: their GL objects died with the old context (deleting them on it only
   * logs "object does not belong to this context").
   */
  gfxReset() {
    for (const ch of this.chunks.values()) for (const k of ['gl', 'gd']) if (ch[k]) { this.scene.remove(ch[k]); delete ch[k]; }
    this.ground.userData.repaint?.();
  }

  /**
   * Show the chunks around the camera: buildings within `far` metres (flat-tone material past
   * LOD.farMat), ground tiles within `near`. Missing builds and tiles are made nearest / in view
   * first within KEEP.ms a frame; a near build's stand-in is its far build (built first when it has
   * none), a tile's is the ground plan underneath, so nothing is ever a hole.
   */
  update(cam, { far = 1500, near = 700, night = 0, renderer = null } = {}) {
    const px = cam.position.x / M, pz = cam.position.z / M, camY = cam.position.y;
    this.px = px; this.pz = pz;
    if (renderer) { this.renderer = renderer; this.ground.userData.upload?.(renderer); }
    const R = Math.ceil(Math.max(far, this.look.U.uHazeFar.value) / M / CHUNK) + 1;
    const ccx = Math.floor(px / CHUNK), ccy = Math.floor(pz / CHUNK);
    const n = (this.n = performance.now());
    for (const ch of this.chunks.values()) for (const k of ['near', 'lite', 'nearInk', 'liteInk', 'gl', 'gd']) if (ch[k]) ch[k].visible = false;
    // haze first: from altitude it reaches further than the band's fog, and so do the chunks
    this.look.light(this.sun, this.hemi, this.scene.fog, night, (performance.now() - this.t0) / 1000, this.sky?.horizon || this.dome?.material.uniforms.bottom.value, cam.position.y);
    const reach = Math.max(far, this.look.U.uHazeFar.value), cut = reach * 0.92; // the haze is all but solid past this
    const lit = (this.lit = night > 0.45), key = lit ? 'gl' : 'gd';
    this.tileR = near * 1.2;
    cam.getWorldDirection(_fwd);
    const shown = this._shown || (this._shown = []), jobs = this._jobs || (this._jobs = []);
    shown.length = 0; jobs.length = 0;
    for (let cy = ccy - R; cy <= ccy + R; cy++) for (let cx = ccx - R; cx <= ccx + R; cx++) {
      if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
      const dx = ((cx + 0.5) * CHUNK - px) * M, dz = ((cy + 0.5) * CHUNK - pz) * M, d = Math.hypot(dx, dz) - CHUNK * M * 0.7;
      if (d > cut) continue;
      // above detailAlt the LOD goes by true (3D) distance: from high patrol every chunk is a lite
      // build (no near build, ink layer or halftone under her: ~6% fps at high patrol)
      const ch = this.chunk(cx, cy), which = (camY > LOD.detailAlt ? Math.hypot(Math.max(0, d), camY) : d) > LOD.farMat ? 'lite' : 'near';
      ch.which = which; ch.d = d;
      ch.full = camY < LOD.detailAlt && Math.hypot(Math.max(0, d), camY) < (which === 'near' ? LOD.detail : LOD.liteDetail);
      // no baked tiles past the coast: those chunks are open bay, and their unpainted canvases were
      // near-black slabs lying on the sea
      ch.tile = d < this.tileR && camY < LOD.tileAlt && cx * TILE < this.city.landCols;
      if (which === 'near') ch.nearSeen = n;
      if (ch.tile) ch[key + 'Seen'] = n;
      // job priority: distance, halved for what's ahead of the lens (where she's flying comes first)
      ch.pri = Math.max(0, d) * (dx * _fwd.x + dz * _fwd.z > -CHUNK * M * 0.5 ? 0.5 : 1);
      shown.push(ch);
      if (ch[which] === undefined || (ch.tile && !ch[key])) jobs.push(ch);
    }
    // the work: all of it on the very first frame (it's behind the title / zone transition), then
    // within the frame budget, at least one job a frame
    if (jobs.length) {
      jobs.sort((a, b) => a.pri - b.pri);
      const t0 = performance.now(), limit = this.built ? KEEP.ms : 1e9, over = () => performance.now() - t0 > limit;
      let done = 0;
      for (const ch of jobs) {
        if (done && over()) break;
        // a near build with nothing to stand in for it gets its (cheap) far build first
        if (ch.which === 'near' && ch.near === undefined && ch.lite === undefined && this.built) { this.build(ch, 'lite'); done++; if (over()) break; }
        if (ch[ch.which] === undefined) { this.build(ch, ch.which); done++; if (over()) break; }
        if (ch.tile && !ch[key]) { this.groundTile(ch, key); done++; }
      }
      work.ms += performance.now() - t0;
    }
    this.built = true;
    for (const ch of shown) {
      // the wanted build, or the other one standing in while it waits
      const w = ch[ch.which] ? ch.which : ch.which === 'near' ? 'lite' : 'near', m = ch[w], ink = ch[w + 'Ink'];
      if (m) { m.visible = true; range(m, ch.full); }
      if (ink) { ink.visible = w === 'near' || ch.d < LOD.farInk; range(ink, ch.full); }
      if (ch.tile && ch[key]) ch[key].visible = true;
    }
    if (n - (this.trimT || 0) > KEEP.every) { this.trimT = n; this.trim(n); }
    this.outer.update(cam, cut);
    this.card.update(cam, this.look.U.uHazeFar.value);
    this.ring.update(cam);
    this.street.update(cam);
  }
}
const _fwd = new THREE.Vector3();
