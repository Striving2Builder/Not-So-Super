// Nightlife kit: the shared toolbox the venues are dressed with. Canvas neon, merged additive
// batches (light pools, halos, fake beams), a sign atlas, point-sprite bulbs, the beat clock.
// Nearly all the light in the venues is fake: additive geometry merged into a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { quality } from './settings.js';
import { comic, gradMap } from './look3d.js';

export const TAU = Math.PI * 2;
export const WALL_H = 3.4;
export const FONT = '"Bangers", Impact, "Arial Black", sans-serif';
export const SCRIPT = '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
// inner faces of the main hall's walls, and the yaw that turns a +z-facing plane to face into the room
export const FACE = { N: -11.8, S: 11.8, W: -14.8, E: 14.8 };
export const YAW = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };
export const NORMAL = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };

export const C = (c) => new THREE.Color(c);
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pickR = (a) => a[Math.floor(Math.random() * a.length)];
// ------------------------------------------------------------------ canvas helpers
export function cnv(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (draw) draw(c.getContext('2d'), w, h);
  return c;
}
export function tex(c, { repeat = false, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}
export function speckle(c, w, h, n, a, sz = 2) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${a})`;
    c.fillRect(Math.random() * w, Math.random() * h, sz, sz);
  }
}
/** A soft radial glow on black (for additive blending: black adds nothing). */
export const glowCanvas = () => cnv(64, 64, (c) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64);
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(0.18, 'rgba(255,255,255,.62)'); g.addColorStop(0.45, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});
/** A laser/beam cross-section: hot core across u, fading along its length (v=1 at the source). */
export const beamCanvas = () => cnv(32, 64, (c) => {
  const gx = c.createLinearGradient(0, 0, 32, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.42, 'rgba(255,255,255,.35)'); gx.addColorStop(0.5, '#fff'); gx.addColorStop(0.58, 'rgba(255,255,255,.35)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = gx; c.fillRect(0, 0, 32, 64);
  const gy = c.createLinearGradient(0, 0, 0, 64);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,.85)');
  c.fillStyle = gy; c.fillRect(0, 0, 32, 64);
});

// Neon tube lettering: a wide coloured bloom, the tube itself, then a white-hot core.
export function neonText(c, text, x, y, size, color, { font = FONT, maxW = 1e4, core = '#fff', weight = '400' } = {}) {
  c.font = `${weight} ${size}px ${font}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.strokeStyle = color; c.shadowColor = color;
  c.shadowBlur = size * 0.5; c.lineWidth = size * 0.13; c.strokeText(text, x, y, maxW); c.strokeText(text, x, y, maxW);
  c.shadowBlur = size * 0.12; c.lineWidth = size * 0.085; c.strokeText(text, x, y, maxW);
  c.shadowBlur = 0; c.strokeStyle = core; c.lineWidth = size * 0.035; c.strokeText(text, x, y, maxW);
}
export function neonPath(c, color, width, path) {
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = color; c.shadowColor = color;
  c.shadowBlur = width * 4; c.lineWidth = width * 1.6; path(); c.stroke(); c.stroke();
  c.shadowBlur = width; c.lineWidth = width; path(); c.stroke();
  c.shadowBlur = 0; c.strokeStyle = '#fff'; c.lineWidth = width * 0.4; path(); c.stroke();
}
export const heartPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
};
export const boltPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x + s * 0.25, y - s); c.lineTo(x - s * 0.35, y + s * 0.1); c.lineTo(x + s * 0.05, y + s * 0.1);
  c.lineTo(x - s * 0.25, y + s); c.lineTo(x + s * 0.35, y - s * 0.15); c.lineTo(x - s * 0.05, y - s * 0.15); c.closePath();
};
export const glassPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x - s * 0.7, y - s * 0.7); c.lineTo(x + s * 0.7, y - s * 0.7); c.lineTo(x, y + s * 0.1); c.closePath();
  c.moveTo(x, y + s * 0.1); c.lineTo(x, y + s * 0.8); c.moveTo(x - s * 0.4, y + s * 0.8); c.lineTo(x + s * 0.4, y + s * 0.8);
};
/** Give a geometry a flat vertex colour (shade s, tinted later by material/instance colour). */
export function tint(g, s) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(s);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// ------------------------------------------------------------------ batching
/** Collects world-space geometries with a per-vertex colour and merges them into one mesh. */
export class Batch {
  constructor(attrs) { this.attrs = attrs; this.geos = []; this.n = 0; }
  push(geo, color, k = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const a of Object.keys(g.attributes)) if (!this.attrs.includes(a)) g.deleteAttribute(a);
    const n = g.attributes.position.count, arr = new Float32Array(n * 3);
    const base = C(color).multiplyScalar(k);
    for (let i = 0; i < n; i++) { arr[i * 3] = base.r; arr[i * 3 + 1] = base.g; arr[i * 3 + 2] = base.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const e = { start: this.n, count: n, base };
    this.n += n; this.geos.push(g);
    return e;
  }
  build(scene, material) {
    if (!this.geos.length) return null;
    const g = mergeGeometries(this.geos);
    this.geos.forEach((x) => x.dispose()); this.geos = [];
    this.col = g.attributes.color;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.name = this.name || 'nl-batch';
    scene.add(this.mesh);
    return this.mesh;
  }
  /** Scale an entry's colour (k) or give it a new one. */
  set(e, k, color = e.base) {
    const a = this.col.array;
    for (let i = e.start; i < e.start + e.count; i++) { a[i * 3] = color.r * k; a[i * 3 + 1] = color.g * k; a[i * 3 + 2] = color.b * k; }
    this.dirty = true;
  }
  flush() { if (this.dirty) { this.col.needsUpdate = true; this.dirty = false; } }
}

/** Shelf-packed canvas atlas for the signage: every sign in a venue is one texture, one draw call. */
export class Atlas {
  constructor(W, H) { this.W = W; this.H = H; this.items = []; this.x = 0; this.y = 0; this.row = 0; }
  add(w, h, draw) {
    const pad = 12; // black gutter so neighbours don't bleed in through the mipmaps
    if (this.x + w + pad > this.W) { this.x = 0; this.y += this.row; this.row = 0; }
    const r = { x: this.x, y: this.y, w, h, draw };
    r.uv = [r.x / this.W, 1 - (r.y + h) / this.H, (r.x + w) / this.W, 1 - r.y / this.H];
    this.x += w + pad; this.row = Math.max(this.row, h + pad);
    this.items.push(r);
    return r;
  }
  paint() {
    const c = (this.canvas = this.canvas || cnv(this.W, this.H)), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, this.W, this.H);
    for (const r of this.items) { g.save(); g.translate(r.x, r.y); g.beginPath(); g.rect(0, 0, r.w, r.h); g.clip(); r.draw(g, r.w, r.h); g.restore(); }
    if (this.tex) this.tex.needsUpdate = true;
    return c;
  }
}

export function uvRect(g, r) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
  return g;
}
export const floorQ = (x, z, w, d, y = 0.03) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
export const wallQ = (x, y, z, w, h, yaw) => new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z);
/** A point on a wall's inner face: side N/S/W/E, `a` along it, `out` metres into the room. */
export function onWall(side, a, y, out = 0.03) {
  if (side === 'N') return [a, y, FACE.N + out];
  if (side === 'S') return [a, y, FACE.S - out];
  if (side === 'W') return [FACE.W + out, y, a];
  return [FACE.E - out, y, a];
}

// Fake volumetric beam: brighter where the surface faces the camera (the middle of the cone) and
// near the source; additive, so overlapping beams bloom.
export function coneMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uI: { value: 1 }, uC: { value: new THREE.Color(1, 1, 1) } },
    vertexColors: true,
    vertexShader: `varying vec3 vC; varying float vF; varying float vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vF = abs(dot(n, normalize(cameraPosition - wp.xyz)));
        vV = uv.y; vC = color;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform float uI; uniform vec3 uC; varying vec3 vC; varying float vF; varying float vV;
      void main() {
        float a = vF * vF * (0.12 + 0.88 * vV * vV);
        gl_FragColor = vec4(vC * uC * a * uI, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
// cone of unit length pointing down -y from its apex at the origin
export const coneGeo = (rTop, rBot) => new THREE.CylinderGeometry(rTop, rBot, 1, 18, 1, true).translate(0, -0.5, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);
export function aimMatrix(from, to) {
  const d = new THREE.Vector3().subVectors(to, from), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(DOWN, d.normalize());
  return new THREE.Matrix4().compose(from, q, new THREE.Vector3(L, L, L));
}

// Sprites without sprites: one point cloud, per-point size + colour (world-size attenuated).
export function pointsMat(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uScale: { value: 400 } },
    vertexColors: true,
    vertexShader: `attribute float size; uniform float uScale; varying vec3 vC;
      void main() {
        vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / max(0.2, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC;
      void main() {
        gl_FragColor = vec4(vC * texture2D(map, gl_PointCoord).rgb, 1.0);
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}
export function makePoints(list, mat) {
  const n = list.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n);
  list.forEach((b, i) => { p.set(b.p, i * 3); c.set([b.c.r, b.c.g, b.c.b], i * 3); s[i] = b.s; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('size', new THREE.BufferAttribute(s, 1));
  const o = new THREE.Points(g, mat);
  o.frustumCulled = false;
  return o;
}
// ------------------------------------------------------------------ the kit each venue builds with
export function makeKit(zn, k) {
  const tier = quality().nightlife || 'lite';
  const glowT = tex(glowCanvas());
  const X = {
    zn, k, lite: tier === 'min', rich: tier === 'full',
    glowT, glow: new Batch(['position', 'uv']), cones: new Batch(['position', 'normal', 'uv']),
    signs: new Batch(['position', 'uv']), atlas: new Atlas(1024, 1024),
    props: new Batch(['position', 'normal']),
    bulbs: [], fx: [], people: [], paint: [],
    /** A static prop (world-space geometry) in the one merged, cel-shaded props mesh. */
    prop(geo, color) { return this.props.push(geo, color); },
    /**
     * Dress a table top (surface at height y) around its rim; the centre stays clear because
     * gameplay items spawn there. set: glass · bottle · candle · bucket · ashtray · cards
     */
    tableTop(x, z, y, set, r = 0.42) {
      set.forEach((kind, i) => {
        const a = (i / set.length) * TAU + rnd(-0.2, 0.2), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const cy = (rt, rb, h, dy = 0, dx = 0) => new THREE.CylinderGeometry(rt, rb, h, 7).translate(px + dx, y + h / 2 + dy, pz);
        if (kind === 'glass') this.prop(cy(0.035, 0.028, 0.12), 0xbfe6ff);
        if (kind === 'bottle') { const c = pickR([0x1a6a2a, 0x8a4a10, 0x2a2a6a]); this.prop(cy(0.042, 0.045, 0.22), c); this.prop(cy(0.014, 0.02, 0.09, 0.22), c); }
        if (kind === 'candle') { this.prop(cy(0.045, 0.045, 0.07), 0xc0203a); this.bulb(px, y + 0.13, pz, 0.35, 0xffb050).flame = true; }
        if (kind === 'bucket') { this.prop(cy(0.1, 0.075, 0.2), 0xd0d0dc); this.prop(cy(0.02, 0.04, 0.14, 0.18, 0.02), 0xe0b040); }
        if (kind === 'ashtray') this.prop(cy(0.07, 0.06, 0.025), 0x2a2a30);
        if (kind === 'cards') this.prop(new THREE.BoxGeometry(0.1, 0.02, 0.14).rotateY(a).translate(px, y + 0.01, pz), 0xf4f0e8);
      });
    },
    /**
     * A signature sign hanging mid-room on chains, tilted up toward the camera, on a dark board so
     * it reads from across the room. Returns entries for pulsing.
     */
    hangSign(x, y, z, yaw, h, rect, color, { tilt = 0.5, board = 0x0c070e } = {}) {
      const w = (h * rect.w) / rect.h;
      const n = [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
      const at = (g, o) => g.rotateX(-tilt).rotateY(yaw).translate(x + n[0] * o, y + n[1] * o, z + n[2] * o);
      this.prop(at(new THREE.BoxGeometry(w * 1.06, h * 1.12, 0.06), -0.04), board);
      for (const s of [-1, 1]) {
        const cx = x + Math.cos(yaw) * s * w * 0.45, cz = z - Math.sin(yaw) * s * w * 0.45, top = y + h * 0.5 * Math.cos(tilt);
        this.prop(new THREE.CylinderGeometry(0.012, 0.012, 3.5 - top, 4).translate(cx, (3.5 + top) / 2, cz), 0x111111);
      }
      const e = { s: this.signs.push(uvRect(at(new THREE.PlaneGeometry(w, h), 0.01), rect.uv), 0xffffff) };
      e.h = this.glow.push(at(new THREE.PlaneGeometry(w * 1.5, h * 2.6), 0.0), color, 0.35);
      this.paint.push({ x: x + n[0] * 1.2, z: z + n[2] * 1.2, rx: w * 0.55, rz: w * 0.55, color, k: 0.28 });
      return e;
    },
    /** Additive light pool on the floor. */
    pool(x, z, r, color, k2 = 1, y) {
      if (y === undefined) { this.paint.push({ x, z, rx: r, rz: r, color, k: k2 }); return null; }
      return this.glow.push(floorQ(x, z, r * 2, r * 2, y), color, k2);
    },
    /** A glow on a wall (w x h), just off its face. */
    halo(side, a, y, w, h, color, k2 = 1) { const [x, yy, z] = onWall(side, a, y, 0.02); return this.glow.push(wallQ(x, yy, z, w, h, YAW[side]), color, k2); },
    bulb(x, y, z, s, color, f) { const b = { p: [x, y, z], s, c: C(color), f }; b.base = b.c.clone(); this.bulbs.push(b); return b; },
    /** A static beam from `from` to `to`, `r` wide where it lands. */
    cone(from, to, r, color, k2 = 1) {
      const m = aimMatrix(from, to), L = from.distanceTo(to);
      return this.cones.push(coneGeo(0.05 / L, r / L).applyMatrix4(m), color, k2);
    },
    /**
     * A neon sign from the atlas on a wall: `rect` from atlas.add, `h` metres tall. Adds its halo on the
     * wall and its smeared reflection on the floor. Returns entries for flicker/pulse.
     */
    sign(side, a, y, h, rect, color, { halo = 0.5, streak = 0.28 } = {}) {
      const w = (h * rect.w) / rect.h, [x, yy, z] = onWall(side, a, y, 0.035);
      const e = { s: this.signs.push(uvRect(wallQ(x, yy, z, w, h, YAW[side]), rect.uv), 0xffffff) };
      if (halo) e.h = this.halo(side, a, y, w * 1.25, h * 2.4, color, halo);
      if (streak) {
        const [nx, nz] = NORMAL[side];
        this.paint.push({ x: x + nx * 1.0, z: z + nz * 1.0, rx: nx ? 1.3 : w * 0.55, rz: nx ? w * 0.55 : 1.3, color, k: streak });
      }
      return e;
    },
    /** Marquee bulbs around a rectangle on a wall. */
    bulbFrame(side, a, y, w, h, color, f) {
      const n = Math.max(2, Math.round(w / 0.22)), m = Math.max(2, Math.round(h / 0.22)), list = [];
      const put = (u, v) => { const [x, yy, z] = onWall(side, a + (side === 'S' || side === 'E' ? -u : u), y + v, 0.06); list.push(this.bulb(x, yy, z, 0.2, color, f)); };
      for (let i = 0; i <= n; i++) { put(-w / 2 + (w * i) / n, h / 2); put(-w / 2 + (w * i) / n, -h / 2); }
      for (let j = 1; j < m; j++) { put(-w / 2, -h / 2 + (h * j) / m); put(w / 2, -h / 2 + (h * j) / m); }
      list.forEach((b, i) => { b.i = i; });
      return list;
    },
  };
  return X;
}

export function buildKit(X) {
  const { zn } = X, S = zn.scene;
  X.glow.name = 'nl-glow'; X.cones.name = 'nl-cones'; X.signs.name = 'nl-signs';
  X.glow.build(S, new THREE.MeshBasicMaterial({ map: X.glowT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  X.cones.build(S, coneMat());
  X.props.build(S, comic(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap(3) }), { halftone: 0.35 }));
  if (X.atlas.items.length) {
    X.atlas.paint();
    X.atlas.tex = tex(X.atlas.canvas);
    X.signs.build(S, new THREE.MeshBasicMaterial({ map: X.atlas.tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    // signage is lettered in Bangers; repaint once the webfont is in (the fallback shows until then)
    if (document.fonts && !document.fonts.check('40px Bangers')) document.fonts.load('40px Bangers').then(() => X.atlas.paint()).catch(() => {});
  }
  X.pmat = X.pmat || pointsMat(X.glowT);
  if (X.bulbs.length) { X.bulbPts = makePoints(X.bulbs, X.pmat); X.bulbPts.name = 'nl-bulbs'; S.add(X.bulbPts); }
}

/** Beat clock: n = beat number, ph = phase within the beat, pulse = a kick that decays over the beat. */
export function beat(t, bpm) {
  const b = (t * bpm) / 60, n = Math.floor(b), ph = b - n;
  return { b, n, ph, pulse: Math.exp(-ph * 5), ang: b * Math.PI, bar: Math.floor(n / 4), sec: Math.floor(n / 16) };
}
export const flicker = (t, seed) => (Math.sin(t * 17 + seed * 7) > 0.985 || Math.floor(t * 9 + seed) % 53 === 0 ? 0.2 : 1);
// ------------------------------------------------------------------ shared venue pieces
/** Warm back-bar behind the bar along the west wall: glowing shelves of bottles. */
export function backBar(X, z0, z1, tintC) {
  const w = z1 - z0, zc = (z0 + z1) / 2;
  const t = tex(cnv(512, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#1a0c04'); g.addColorStop(0.5, tintC); g.addColorStop(1, '#1a0c04');
    c.fillStyle = g; c.fillRect(0, 0, 512, 128);
    const cols = ['#3aff8a', '#ffc040', '#ff5a5a', '#5ab0ff', '#f0f0f0', '#c080ff', '#ffe080'];
    for (const [y, hh] of [[16, 34], [66, 34]]) {
      for (let x = 6; x < 506; x += rnd(9, 15)) {
        const bh = rnd(hh * 0.6, hh), bw = rnd(5, 9);
        c.fillStyle = pickR(cols); c.globalAlpha = 0.75;
        c.fillRect(x, y + hh - bh, bw, bh); c.fillRect(x + bw * 0.3, y + hh - bh - 6, bw * 0.4, 6);
        c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + 1, y + hh - bh + 2, 1.5, bh - 4);
      }
      c.fillStyle = '#2a1608'; c.fillRect(0, y + hh, 512, 5);
      c.fillStyle = 'rgba(255,230,180,.8)'; c.fillRect(0, y + hh, 512, 1.5);
    }
  }));
  const [x, y, z] = onWall('W', zc, 1.75, 0.03);
  const m = new THREE.Mesh(wallQ(x, y, z, w, 1.4, YAW.W), new THREE.MeshBasicMaterial({ map: t }));
  X.zn.scene.add(m);
  X.halo('W', zc, 1.75, w + 1, 2.4, 0xffb060, 0.22);
}

export function haze(X, color, n, y0 = 1.2, y1 = 3.0) {
  if (!X.rich) return; // big additive sprites: fill-rate heavy, High profile only
  const list = [];
  for (let i = 0; i < n; i++) list.push({ p: [rnd(-13, 13), rnd(y0, y1), rnd(-10, 10)], s: rnd(4, 7), c: C(color).multiplyScalar(rnd(0.03, 0.06)) });
  const pts = makePoints(list, X.pmat || (X.pmat = pointsMat(X.glowT)));
  pts.name = 'nl-haze';
  X.zn.scene.add(pts);
  X.fx.push((t) => { pts.rotation.y = Math.sin(t * 0.05) * 0.25; });
}
