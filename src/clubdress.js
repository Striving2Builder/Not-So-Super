// Set dressing for the premade clubs, on top of the exported models:
//   * emitters: where the club's neon/lamps physically are (captured before meshes are merged)
//   * materials: calmer floors (bigger pattern, half the contrast), contact AO darkening toward
//     walls and furniture, neon that glows without blowing out, padded walls where a club asks
//   * the poché cap: a dark "cut" surface at the slice height over walls and everything outside
//     the rooms, so the cutaway reads as a building section, never a diorama floating in a void
//   * fixtures: pendant lamps hanging just under the cut, plus glow halos on lamps and neon
// Everything is a handful of draw calls; the floor/AO patch is a few ALU ops per pixel.
import * as THREE from 'three';
import { DOWN, UP } from './clubgeo.js';

// ---------------------------------------------------------------- emitters
/** Emissive meshes (neon, sign boxes, bulbs) as { pos, size, color, k }, before the static merge. */
export function captureEmitters(scene) {
  scene.updateMatrixWorld(true);
  const out = [], box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const m = o.material, e = m.emissive;
    if (!e || e.getHex() === 0) return;
    const k = Math.max(e.r, e.g, e.b) * (m.emissiveIntensity || 1);
    if (k < 0.2) return;
    box.setFromObject(o).getCenter(c); box.getSize(s);
    const size = s.length();
    if (size < 0.15 || size > 14) return;
    const col = e.clone();
    // white emission × a texture (signs, screens): guess the hue from the base colour
    if (Math.min(col.r, col.g, col.b) > 0.8 && m.color) col.lerp(m.color, 0.6);
    const mx = Math.max(col.r, col.g, col.b) || 1;
    col.multiplyScalar(1 / mx);
    out.push({ pos: c.clone(), size, flat: Math.min(s.x, s.y, s.z) < 0.08, color: col, k });
  });
  // one halo per cluster (a sign made of 20 letters is one glow)
  const merged = [];
  for (const e of out.sort((a, b) => b.size - a.size)) {
    const near = merged.find((m) => m.pos.distanceTo(e.pos) < Math.max(0.8, m.size * 0.35));
    if (near) { near.color.lerp(e.color, 0.3); near.size = Math.max(near.size, e.size); } else merged.push(e);
  }
  return merged.slice(0, 80);
}

/**
 * Drop the meshes a club's DRESS entry lists. The Velvet Lounge outlines every wall box and floor
 * edge with hair-thin neon tubing that shimmers into dashed pink lines on a phone screen and reads
 * as debug wireframe (40k triangles of it); its signs and stage ring keep their neon.
 */
export function dropMeshes(scene, key) {
  const names = new Set((DRESS[key] || {}).drop || []), gone = [];
  if (!names.size) return 0;
  scene.traverse((o) => { if (o.isMesh && names.has(o.name)) gone.push(o); });
  for (const o of gone) { o.removeFromParent(); o.geometry.dispose(); }
  return gone.length;
}

// ---------------------------------------------------------------- materials
// Per club: floor pattern scale, floor contrast, floor tint, AO strength, padded walls (material
// name → colour), meshes to drop (node names).
const DRESS = {
  triangle: { floorScale: 1.6, contrast: 0.7, floorTint: 0xffffff, ao: 0.5 },
  clubhouse: { floorScale: 2.8, contrast: 0.45, floorTint: 0x8a6048, ao: 0.45 },
  stripclub: {
    floorScale: 2.8, contrast: 0.5, floorTint: 0xb07868, ao: 0.45, padded: { 'BLISTERED PAINT': 0x1d4a2c },
    drop: ['walls002', 'walls003', 'walls005', 'Cube002', 'Cube_3'],
  },
};

/** Club-wide AO map: dark where the floor bake found no room to stand (walls, bars, booths). */
function aoTexture(club) {
  const F = club.floor, b = club.box;
  const x0 = Math.floor(b.min.x) - 1, z0 = Math.floor(b.min.z) - 1;
  const W = Math.ceil(b.max.x - x0) + 2, H = Math.ceil(b.max.z - z0) + 2;
  const grid = new Float32Array(W * H);
  for (const p of F) {
    if (Math.abs(p.y - club.mainY) > 0.6) continue;
    const i = Math.floor(p.x - x0), j = Math.floor(p.z - z0);
    if (i >= 0 && j >= 0 && i < W && j < H) grid[j * W + i] = 1;
  }
  // two box blurs: open floor stays 1, it falls off over ~1.5 m toward anything solid
  let a = grid;
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        s += a[jj * W + ii]; n++;
      }
      o[j * W + i] = s / n;
    }
    a = o;
  }
  const d = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = Math.round(Math.min(1, a[i] * 1.25) * 255);
  const t = new THREE.DataTexture(d, W, H, THREE.RedFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  // texel centres sit on the 1 m floor grid (spots are at x0 + i + 0.5)
  return { tex: t, min: new THREE.Vector2(x0, z0), size: new THREE.Vector2(W, H) };
}

let _padTex = null;
/** Diamond-tufted padding (velvet banquette walls), tinted by the material colour. */
function paddedTex() {
  if (_padTex) return _padTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, S, S);
  // each diamond: bright puffed centre falling to dark creases, a button at every crossing
  const cells = [[S / 2, S / 2], [0, 0], [S, 0], [0, S], [S, S]];
  for (const [cx, cy] of cells) {
    const g = x.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, S * 0.52);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#b8b8b8'); g.addColorStop(1, '#3a3a3a');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(cx, cy - S / 2); x.lineTo(cx + S / 2, cy); x.lineTo(cx, cy + S / 2); x.lineTo(cx - S / 2, cy); x.closePath(); x.fill();
  }
  x.strokeStyle = 'rgba(20,20,20,0.9)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S / 2, 0); x.lineTo(S, S / 2); x.lineTo(S / 2, S); x.closePath(); x.stroke();
  for (const [bx, by] of [[S / 2, 0], [0, S / 2], [S, S / 2], [S / 2, S]]) {
    x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(bx, by, 5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#d0d0d0'; x.beginPath(); x.arc(bx - 1, by - 1, 2, 0, Math.PI * 2); x.fill();
  }
  _padTex = new THREE.CanvasTexture(c);
  _padTex.colorSpace = THREE.SRGBColorSpace;
  _padTex.wrapS = _padTex.wrapT = THREE.RepeatWrapping;
  return _padTex;
}

/** Mean colour of a texture (tiny canvas read), linear. */
const averages = new WeakMap(); // (by image: texture clones share it)
export function texAverage(tex) {
  const img0 = tex.source || tex;
  if (averages.has(img0)) return averages.get(img0);
  let c = new THREE.Color(0.5, 0.5, 0.5);
  const img = tex.image;
  if (img && img.width) {
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = 4;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 4, 4);
      const d = x.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      c = new THREE.Color().setRGB(r / 16 / 255, g / 16 / 255, b / 16 / 255, THREE.SRGBColorSpace);
    } catch (e) { /* unreadable: mid-grey */ }
  }
  averages.set(img0, c);
  return c;
}

/**
 * Dress the club's (cached, shared) materials once per building: floors, AO, neon, padding.
 * The AO uniforms are shared, so a re-entered club just updates them.
 */
export function dressMaterials(club, key) {
  const D = DRESS[key] || DRESS.triangle;
  const chunks = club.scene.userData.chunks || [];
  const U = club.scene.userData.dressU || (club.scene.userData.dressU = (() => {
    const ao = aoTexture(club);
    return { cAo: { value: ao.tex }, cAoMin: { value: ao.min }, cAoSize: { value: ao.size }, cAoY: { value: club.mainY }, cAoK: { value: D.ao } };
  })());
  // floors: big, flat, upward-facing chunks near the main floor → their materials
  const floorMats = new Set();
  const size = new THREE.Vector3();
  for (const m of chunks) {
    const bb = m.geometry.boundingBox;
    bb.getSize(size);
    if (size.y < 0.35 && size.x * size.z > 12 && Math.abs(bb.max.y - club.mainY) < 0.4 && m.material.map) floorMats.add(m.material);
  }
  const seen = new Set();
  for (const m of chunks) {
    const mat = m.material;
    if (seen.has(mat) || mat.userData.dressed) continue;
    seen.add(mat);
    mat.userData.dressed = true;
    // neon: glowing but not blown out to white; lifts the dim ones, reins in the 10× ones
    if (mat.emissive && mat.emissive.getHex() !== 0) {
      const ei = mat.emissiveIntensity || 1;
      mat.emissiveIntensity = THREE.MathUtils.clamp(ei * 1.6, 1.4, 3.2);
      continue;
    }
    if (!(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial)) continue;
    const floor = floorMats.has(mat);
    if (floor && mat.map) {
      const t = mat.map.clone(); // (shares the image: no extra GPU upload)
      t.repeat.divideScalar(D.floorScale);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      mat.map = t;
    }
    const pad = D.padded && D.padded[mat.name];
    if (pad !== undefined) {
      mat.map = paddedTex();
      mat.color.set(pad);
      mat.normalMap = null; mat.roughnessMap = null;
      if (mat.roughness !== undefined) mat.roughness = 0.9;
      mat.needsUpdate = true;
    }
    patchShader(mat, U, floor ? { avg: texAverage(mat.map).clone().multiply(mat.color), contrast: D.contrast, tint: new THREE.Color(D.floorTint) } : null, pad !== undefined);
  }
}

// padding tiles in world metres (the model's own UVs stretch one tile over a whole wall)
const PADDED_MAP = `
#ifdef USE_MAP
{
  vec3 pn = normalize(cross(dFdx(vCWorld), dFdy(vCWorld)));
  vec2 puv = abs(pn.x) > abs(pn.z) ? vCWorld.zy : vCWorld.xy;
  if (abs(pn.y) > 0.7) puv = vCWorld.xz;
  diffuseColor *= texture2D(map, puv / 0.6);
}
#endif`;

function patchShader(mat, U, floor, padded) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  const FU = floor ? { cFlAvg: { value: floor.avg }, cFlK: { value: floor.contrast }, cFlTint: { value: floor.tint } } : null;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, U, FU || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let frag = `
{
  // contact AO: darker toward anything standing on the floor, fading out by knee-to-waist height
  float aoV = texture2D(cAo, (vCWorld.xz - cAoMin) / cAoSize).r;
  float aoH = 1.0 - smoothstep(0.0, 1.3, vCWorld.y - cAoY);
  diffuseColor.rgb *= mix(1.0, mix(1.0 - cAoK, 1.0, aoV), aoH);
}`;
    if (floor) frag = `
diffuseColor.rgb = mix(cFlAvg, diffuseColor.rgb, cFlK) * cFlTint;` + frag;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCWorld; uniform sampler2D cAo; uniform vec2 cAoMin; uniform vec2 cAoSize; uniform float cAoY; uniform float cAoK;
${floor ? 'uniform vec3 cFlAvg; uniform float cFlK; uniform vec3 cFlTint;' : ''}`)
      .replace('#include <map_fragment>', (padded ? PADDED_MAP : '#include <map_fragment>') + frag);
  };
  mat.customProgramCacheKey = () => prevKey() + (floor ? '|clubfloor' : padded ? '|clubpad' : '|clubao');
  mat.needsUpdate = true;
}

// ---------------------------------------------------------------- poché cap
let _hatch = null;
function hatchTex() {
  if (_hatch) return _hatch;
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
  for (let i = -S; i < S * 2; i += 10) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + S, S); x.stroke(); }
  _hatch = new THREE.CanvasTexture(c);
  _hatch.wrapS = _hatch.wrapT = THREE.RepeatWrapping;
  return _hatch;
}

/**
 * A dark section surface at the slice height: over every wall the slice cuts through and over
 * everything outside the building. Cells: 0.35 m, classified by two short BVH rays each.
 */
export class Poche {
  constructor(scene, club, color) {
    this.scene = scene; this.club = club;
    this.mat = new THREE.MeshBasicMaterial({ color, map: hatchTex(), fog: false });
    this.mesh = null; this.level = null;
  }

  /** (Re)build for the storey whose slice plane sits at clipY; cheap if unchanged. */
  update(clipY) {
    const lvl = Math.round(clipY * 2) / 2;
    if (this.mesh && Math.abs(lvl - this.level) < 0.9) { this.mesh.position.y = clipY - 0.03 - this.level; return; }
    this.level = lvl;
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
    this.mesh = new THREE.Mesh(this.build(lvl), this.mat);
    this.mesh.matrixAutoUpdate = true;
    this.mesh.renderOrder = -1;
    this.mesh.raycast = () => {};
    this.mesh.position.y = clipY - 0.03 - lvl;
    this.scene.add(this.mesh);
  }

  build(Y) {
    const C = 0.35, b = this.club.box, col = this.club.collider;
    const x0 = b.min.x - 1, z0 = b.min.z - 1, nx = Math.ceil((b.max.x + 1 - x0) / C), nz = Math.ceil((b.max.z + 1 - z0) / C);
    const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
    const o = new THREE.Vector3(), d = new THREE.Vector3(), side = col.material.side;
    col.material.side = THREE.DoubleSide; // walls hit from either side
    // Rooms = everything reachable from where she can stand without passing a wall at the cut
    // (tested just under it, above the furniture) or leaving the roof. The rest gets capped.
    const H = Y - 0.3, fy = Y - 2.7;
    const open = new Uint8Array(nx * nz), queue = [];
    const center = (k, v) => v.set(x0 + ((k % nx) + 0.5) * C, H, z0 + (Math.floor(k / nx) + 0.5) * C);
    for (const p of this.club.floor) {
      if (Math.abs(p.y - fy) > 0.8) continue;
      const k = Math.floor((p.z - z0) / C) * nx + Math.floor((p.x - x0) / C);
      if (k >= 0 && k < nx * nz && !open[k]) { open[k] = 1; queue.push(k); }
    }
    const roofed = (v) => { ray.set(v, UP); ray.far = 20; return !!ray.intersectObject(col)[0]; };
    const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      const k = queue.pop(), i = k % nx, j = (k - i) / nx;
      center(k, o);
      for (const [di, dj] of STEPS) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const n = jj * nx + ii;
        if (open[n]) continue;
        ray.set(o, d.set(di, 0, dj)); ray.far = C;
        if (ray.intersectObject(col)[0]) continue;           // a wall between the two cells
        if (!roofed(center(n, d))) continue;                // out under the sky
        open[n] = 1; queue.push(n);
      }
    }
    col.material.side = side;
    const solid = open.map((v) => 1 - v);
    // one open cell alone (a thin gap in a wall, a hole in the roof) isn't a room: fill it
    for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      if (!solid[k] && solid[k - 1] + solid[k + 1] + solid[k - nx] + solid[k + nx] >= 3) solid[k] = 1;
    }
    const pos = [], idx = [];
    const quad = (ax, az, bx, bz) => {
      const n = pos.length / 3;
      pos.push(ax, Y, az, bx, Y, az, bx, Y, bz, ax, Y, bz);
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    };
    // runs of capped cells per row → quads
    for (let j = 0; j < nz; j++) {
      let i = 0;
      while (i < nx) {
        if (!solid[j * nx + i]) { i++; continue; }
        const s = i;
        while (i < nx && solid[j * nx + i]) i++;
        quad(x0 + s * C, z0 + j * C, x0 + i * C, z0 + (j + 1) * C);
      }
    }
    // and the world beyond the model, as far as the camera can see
    const X1 = x0 + nx * C, Z1 = z0 + nz * C, F = 80;
    quad(x0 - F, z0 - F, X1 + F, z0); quad(x0 - F, Z1, X1 + F, Z1 + F);
    quad(x0 - F, z0, x0, Z1); quad(X1, z0, X1 + F, Z1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uv = new Float32Array(pos.length / 3 * 2);
    for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3] / 1.5; uv[i * 2 + 1] = pos[i * 3 + 2] / 1.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  dispose() { if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); } this.mat.dispose(); }
}

// ---------------------------------------------------------------- fixtures + glow
let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/** Additive camera-facing halos (lamps, neon), one draw call, world-sized. */
export function glowPoints(list) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  list.forEach((g, i) => {
    pos.set([g.pos.x, g.pos.y, g.pos.z], i * 3);
    col.set([g.color.r * g.k, g.color.g * g.k, g.color.b * g.k], i * 3);
    size[i] = g.size;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, scale: { value: 400 } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
gl_PointSize = min(size * scale / -mv.z, 256.0); }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC;
void main(){ gl_FragColor = vec4(vC * texture2D(map, gl_PointCoord).a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  p.renderOrder = 4;
  p.raycast = () => {};
  return p;
}

/**
 * Lamps hanging just under the cut over the club's main lights. Seen from above a dark shade on a
 * cord reads as a floor lamp on a pole, so they are glowing shades with an inked rim instead.
 * One merged, unlit mesh (vertex colours).
 */
export function pendants(list) {
  const geos = [];
  const tint = (g, c) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'color'].includes(k)) g.deleteAttribute(k);
    return g.index ? g.toNonIndexed() : g;
  };
  const ink = new THREE.Color(0x140c16), white = new THREE.Color(1, 1, 1);
  for (const p of list) {
    const shade = p.color.clone().lerp(white, 0.35);
    geos.push(tint(new THREE.CylinderGeometry(0.07, 0.24, 0.2, 12, 1, true).translate(p.x, p.y, p.z), shade));
    geos.push(tint(new THREE.TorusGeometry(0.24, 0.018, 4, 16).rotateX(Math.PI / 2).translate(p.x, p.y - 0.1, p.z), ink));
    geos.push(tint(new THREE.TorusGeometry(0.07, 0.015, 4, 10).rotateX(Math.PI / 2).translate(p.x, p.y + 0.1, p.z), ink));
  }
  if (!geos.length) return null;
  const merged = mergeAll(geos);
  const m = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
  m.raycast = () => {};
  return m;
}

function mergeAll(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
