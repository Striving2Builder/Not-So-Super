// Nightlife venues built in code: the Nightclub, Gentlemen's Club, Red Light Den and High-Roller
// Suite. Their decor (placed through the zone's building helpers) and their per-frame show.
// (The premade clubs, Triangle / Clubhouse / Velvet Lounge, are models: see clubzone.js.)
//
// The look is neon-noir on a phone budget: nearly all the light is fake. Light pools, sign halos,
// floor reflections and "volumetric" beams are additive geometry merged into a handful of meshes
// (one draw call each); bulbs and sparkles are one point cloud; the crowd is instanced. A beat clock
// (no audio needed) drives the pulse of everything.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { quality } from './settings.js';

export const NIGHTLIFE_KINDS = new Set(['club', 'gentlemens', 'redlight', 'casino']);

const TAU = Math.PI * 2;
const WALL_H = 3.4;
const FONT = '"Bangers", Impact, "Arial Black", sans-serif';
const SCRIPT = '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
// inner faces of the main hall's walls, and the yaw that turns a +z-facing plane to face into the room
const FACE = { N: -11.8, S: 11.8, W: -14.8, E: 14.8 };
const YAW = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };
const NORMAL = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };
const BPM = { club: 126, redlight: 96, gentlemens: 100, casino: 92 };

const C = (c) => new THREE.Color(c);
const rnd = (a, b) => a + Math.random() * (b - a);
const pickR = (a) => a[Math.floor(Math.random() * a.length)];

// ------------------------------------------------------------------ canvas helpers
function cnv(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  if (draw) draw(c.getContext('2d'), w, h);
  return c;
}
function tex(c, { repeat = false, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}
function speckle(c, w, h, n, a, sz = 2) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${a})`;
    c.fillRect(Math.random() * w, Math.random() * h, sz, sz);
  }
}
/** A soft radial glow on black (for additive blending: black adds nothing). */
const glowCanvas = () => cnv(64, 64, (c) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64);
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(0.18, 'rgba(255,255,255,.62)'); g.addColorStop(0.45, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
});
/** A laser/beam cross-section: hot core across u, fading along its length (v=1 at the source). */
const beamCanvas = () => cnv(32, 64, (c) => {
  const gx = c.createLinearGradient(0, 0, 32, 0);
  gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.42, 'rgba(255,255,255,.35)'); gx.addColorStop(0.5, '#fff'); gx.addColorStop(0.58, 'rgba(255,255,255,.35)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = gx; c.fillRect(0, 0, 32, 64);
  const gy = c.createLinearGradient(0, 0, 0, 64);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, 'rgba(0,0,0,.85)');
  c.fillStyle = gy; c.fillRect(0, 0, 32, 64);
});

// Neon tube lettering: a wide coloured bloom, the tube itself, then a white-hot core.
function neonText(c, text, x, y, size, color, { font = FONT, maxW = 1e4, core = '#fff', weight = '400' } = {}) {
  c.font = `${weight} ${size}px ${font}`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.strokeStyle = color; c.shadowColor = color;
  c.shadowBlur = size * 0.5; c.lineWidth = size * 0.13; c.strokeText(text, x, y, maxW); c.strokeText(text, x, y, maxW);
  c.shadowBlur = size * 0.12; c.lineWidth = size * 0.085; c.strokeText(text, x, y, maxW);
  c.shadowBlur = 0; c.strokeStyle = core; c.lineWidth = size * 0.035; c.strokeText(text, x, y, maxW);
}
function neonPath(c, color, width, path) {
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = color; c.shadowColor = color;
  c.shadowBlur = width * 4; c.lineWidth = width * 1.6; path(); c.stroke(); c.stroke();
  c.shadowBlur = width; c.lineWidth = width; path(); c.stroke();
  c.shadowBlur = 0; c.strokeStyle = '#fff'; c.lineWidth = width * 0.4; path(); c.stroke();
}
const heartPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
};
const boltPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x + s * 0.25, y - s); c.lineTo(x - s * 0.35, y + s * 0.1); c.lineTo(x + s * 0.05, y + s * 0.1);
  c.lineTo(x - s * 0.25, y + s); c.lineTo(x + s * 0.35, y - s * 0.15); c.lineTo(x - s * 0.05, y - s * 0.15); c.closePath();
};
const glassPath = (c, x, y, s) => () => {
  c.beginPath(); c.moveTo(x - s * 0.7, y - s * 0.7); c.lineTo(x + s * 0.7, y - s * 0.7); c.lineTo(x, y + s * 0.1); c.closePath();
  c.moveTo(x, y + s * 0.1); c.lineTo(x, y + s * 0.8); c.moveTo(x - s * 0.4, y + s * 0.8); c.lineTo(x + s * 0.4, y + s * 0.8);
};

// ------------------------------------------------------------------ batching
/** Collects world-space geometries with a per-vertex colour and merges them into one mesh. */
class Batch {
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
class Atlas {
  constructor(W, H) { this.W = W; this.H = H; this.items = []; this.x = 0; this.y = 0; this.row = 0; }
  add(w, h, draw) {
    if (this.x + w > this.W) { this.x = 0; this.y += this.row; this.row = 0; }
    const r = { x: this.x, y: this.y, w, h, draw };
    r.uv = [r.x / this.W, 1 - (r.y + h) / this.H, (r.x + w) / this.W, 1 - r.y / this.H];
    this.x += w; this.row = Math.max(this.row, h);
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

function uvRect(g, r) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
  return g;
}
const floorQ = (x, z, w, d, y = 0.03) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z);
const wallQ = (x, y, z, w, h, yaw) => new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z);
/** A point on a wall's inner face: side N/S/W/E, `a` along it, `out` metres into the room. */
function onWall(side, a, y, out = 0.03) {
  if (side === 'N') return [a, y, FACE.N + out];
  if (side === 'S') return [a, y, FACE.S - out];
  if (side === 'W') return [FACE.W + out, y, a];
  return [FACE.E - out, y, a];
}

// Fake volumetric beam: brighter where the surface faces the camera (the middle of the cone) and
// near the source; additive, so overlapping beams bloom.
function coneMat() {
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
const coneGeo = (rTop, rBot) => new THREE.CylinderGeometry(rTop, rBot, 1, 18, 1, true).translate(0, -0.5, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
function aimMatrix(from, to) {
  const d = new THREE.Vector3().subVectors(to, from), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(DOWN, d.normalize());
  return new THREE.Matrix4().compose(from, q, new THREE.Vector3(L, L, L));
}

// Sprites without sprites: one point cloud, per-point size + colour (world-size attenuated).
function pointsMat(map) {
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
function makePoints(list, mat) {
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

// ------------------------------------------------------------------ room surfaces
// Walls get world-space UVs (1 texture tile = 3.4 m square, so v runs exactly floor→top and the
// painted trims/neon strips line up on every wall), and an emissive map for the glowing parts.
function worldUV(mesh, su, sv) {
  const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, o = mesh.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + o.x, y = p.getY(i) + o.y, z = p.getZ(i) + o.z;
    const nx = Math.abs(n.getX(i)), nz = Math.abs(n.getZ(i));
    // wall tops read as an ink-black cap (the texture's top rows), like the comic floor plan
    if (nx < 0.5 && nz < 0.5) uv.setXY(i, 0.5, 0.997);
    else uv.setXY(i, (nx > 0.5 ? z : x) / su, Math.min(y / sv, 0.985));
  }
  uv.needsUpdate = true;
}
const WS = 512 / WALL_H; // wall texture pixels per metre
const WY = (m) => 512 - m * WS; // canvas y of a height on the wall

function neonLine(c, y, color, w, blur) {
  c.save(); c.shadowColor = color; c.shadowBlur = blur; c.fillStyle = color;
  c.fillRect(-60, y - w / 2, 632, w); c.fillRect(-60, y - w / 2, 632, w);
  c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-60, y - w / 6, 632, w / 3);
  c.restore();
}
function coveWash(c, color, from, to, a) {
  const g = c.createLinearGradient(0, WY(from), 0, WY(to));
  g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', 0));
  c.fillStyle = g; c.fillRect(0, WY(from), 512, WY(to) - WY(from));
}
function wainscot(c, top, wood, edge, rail) {
  c.fillStyle = wood; c.fillRect(0, WY(top), 512, WY(0) - WY(top));
  for (let x = 0; x < 512; x += 128) {
    c.strokeStyle = edge; c.lineWidth = 4; c.strokeRect(x + 14, WY(top - 0.12), 100, (top - 0.3) * WS);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.strokeRect(x + 19, WY(top - 0.17), 90, (top - 0.4) * WS);
  }
  c.fillStyle = rail; c.fillRect(0, WY(top + 0.07), 512, 0.07 * WS);
  c.fillStyle = 'rgba(255,240,180,.6)'; c.fillRect(0, WY(top + 0.07), 512, 2);
  c.fillStyle = '#050204'; c.fillRect(0, WY(0.08), 512, 0.08 * WS);
}
function damask(c, y0, y1, bg, fg, cw = 64, ch = 96) {
  c.fillStyle = bg; c.fillRect(0, WY(y1), 512, WY(y0) - WY(y1));
  c.save(); c.beginPath(); c.rect(0, WY(y1), 512, WY(y0) - WY(y1)); c.clip();
  c.fillStyle = fg;
  for (let r = 0; r * ch < 600; r++) for (let q = -1; q <= 512 / cw; q++) {
    const cx = q * cw + (r % 2) * cw / 2, cy = WY(y1) + r * ch / 2;
    c.beginPath(); c.ellipse(cx, cy, 7, 17, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - 11, cy + 5, 5, 11, -0.7, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx + 11, cy + 5, 5, 11, 0.7, 0, TAU); c.fill();
    c.beginPath(); c.arc(cx, cy - 22, 3.5, 0, TAU); c.fill();
  }
  c.restore();
}

const WALLS = {
  club: [
    (c) => {
      c.fillStyle = '#0b0816'; c.fillRect(0, 0, 512, 512);
      const y0 = WY(2.7), y1 = WY(0.18), D = 64;
      c.save(); c.beginPath(); c.rect(0, y0, 512, y1 - y0); c.clip();
      for (let r = -1; r * D / 2 < y1 - y0 + D; r++) for (let q = -1; q <= 8; q++) {
        const cx = q * D + ((r + 2) % 2) * D / 2, cy = y0 + r * D / 2;
        const g = c.createLinearGradient(cx - D / 4, cy - D / 4, cx + D / 4, cy + D / 4);
        g.addColorStop(0, '#2a2150'); g.addColorStop(1, '#0d0a1c');
        c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy - D / 2); c.lineTo(cx + D / 2, cy); c.lineTo(cx, cy + D / 2); c.lineTo(cx - D / 2, cy); c.closePath(); c.fill();
        c.strokeStyle = '#05030a'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#4a3f7a'; c.beginPath(); c.arc(cx, cy - D / 2, 2.5, 0, TAU); c.fill();
      }
      c.restore();
      c.fillStyle = '#3a3550'; c.fillRect(0, y0 - 3, 512, 3); c.fillRect(0, y1, 512, 3);
      c.fillStyle = '#05040a'; c.fillRect(0, 0, 512, y0 - 3);
      c.fillStyle = '#020104'; c.fillRect(0, y1 + 3, 512, 512);
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      coveWash(c, 'rgba(255,47,208,A)', 2.86, 2.2, 0.28);
      neonLine(c, WY(2.86), '#ff2fd0', 5, 16);
      coveWash(c, 'rgba(39,224,255,A)', 0.1, 0.6, 0.22);
      neonLine(c, WY(0.1), '#27e0ff', 4, 14);
    },
  ],
  redlight: [
    (c) => {
      c.fillStyle = '#120605'; c.fillRect(0, 0, 512, 512);
      const cols = ['#4a1a16', '#3e1512', '#552019', '#3a1714', '#2e100e', '#5e231b'];
      for (let r = 0, y = 0; y < 512; r++, y += 12) {
        const off = (r % 2) * 16;
        for (let x = -32; x < 512; x += 32) { c.fillStyle = pickR(cols); c.fillRect(x + off + 1, y + 1, 30, 10); }
      }
      speckle(c, 512, 512, 1800, 0.08);
      let g = c.createLinearGradient(0, WY(1.2), 0, 512); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
      c.fillStyle = g; c.fillRect(0, WY(1.2), 512, 1.2 * WS);
      g = c.createLinearGradient(0, 0, 0, WY(2.6)); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 512, WY(2.6));
      // drips of grime
      for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(Math.random() * 512, WY(2.9), 3 + Math.random() * 4, rnd(40, 200)); }
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      coveWash(c, 'rgba(255,34,68,A)', 2.95, 2.1, 0.3);
      neonLine(c, WY(2.95), '#ff2244', 5, 18);
    },
  ],
  gentlemens: [
    (c) => {
      c.fillStyle = '#16060f'; c.fillRect(0, 0, 512, 512);
      damask(c, 1.12, 2.85, '#3a0c2c', '#58184a');
      wainscot(c, 1.05, '#2a120b', '#4a2414', '#b8902a');
      c.fillStyle = '#b8902a'; c.fillRect(0, WY(2.92), 512, 0.07 * WS);
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#3a2a08'; c.fillRect(0, WY(1.12), 512, 0.07 * WS); c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      coveWash(c, 'rgba(255,68,204,A)', 3.3, 2.5, 0.35);
      neonLine(c, WY(3.3), '#ff44cc', 3, 12);
    },
  ],
  casino: [
    (c) => {
      c.fillStyle = '#12060a'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#4d0a16'; c.fillRect(0, WY(2.85), 512, (2.85 - 1.1) * WS);
      c.save(); c.beginPath(); c.rect(0, WY(2.85), 512, (2.85 - 1.1) * WS); c.clip();
      c.strokeStyle = '#8a6a22'; c.lineWidth = 2;
      for (let x = -512; x < 1024; x += 64) {
        c.beginPath(); c.moveTo(x, WY(2.85)); c.lineTo(x + 300, WY(2.85) + 300); c.stroke();
        c.beginPath(); c.moveTo(x, WY(2.85)); c.lineTo(x - 300, WY(2.85) + 300); c.stroke();
      }
      c.fillStyle = '#b08a30';
      for (let x = 0; x < 512; x += 64) for (let y = WY(2.85); y < WY(1.1); y += 64) { c.beginPath(); c.arc(x + 32, y, 5, 0, TAU); c.fill(); c.beginPath(); c.arc(x, y + 32, 5, 0, TAU); c.fill(); }
      c.restore();
      wainscot(c, 1.05, '#1f0d06', '#3e1d0c', '#c09a34');
      c.fillStyle = '#c09a34'; c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      c.fillStyle = '#0c0306'; c.fillRect(0, 0, 512, WY(2.92));
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#4a3408'; c.fillRect(0, WY(1.12), 512, 0.07 * WS); c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      coveWash(c, 'rgba(255,200,100,A)', 3.4, 2.3, 0.42);
    },
  ],
};

// floors: [tile size in metres, painter]
const FLOORS = {
  club: [3, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 128, y = j * 128, g = c.createLinearGradient(x, y, x + 128, y + 128);
      g.addColorStop(0, '#1c1830'); g.addColorStop(0.5, '#0e0c1a'); g.addColorStop(1, '#141124');
      c.fillStyle = g; c.fillRect(x + 2, y + 2, 124, 124);
    }
    speckle(c, 512, 512, 900, 0.05);
  }],
  redlight: [4, (c) => {
    c.fillStyle = '#0c0504'; c.fillRect(0, 0, 512, 512);
    const cols = ['#2b140f', '#24110c', '#301812', '#27120d'];
    for (let y = 0; y < 512; y += 28) {
      let x = -rnd(0, 300);
      while (x < 512) {
        const L = rnd(160, 360); c.fillStyle = pickR(cols); c.fillRect(x + 1, y + 1, L - 2, 26);
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
        for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y + 4 + k * 6 + rnd(-2, 2)); c.lineTo(x + L, y + 4 + k * 6 + rnd(-2, 2)); c.stroke(); }
        x += L;
      }
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,120,120,.05)'; c.fillRect(rnd(0, 512), 0, rnd(20, 60), 512); }
    speckle(c, 512, 512, 800, 0.06);
  }],
  gentlemens: [3, (c) => {
    c.fillStyle = '#220a1e'; c.fillRect(0, 0, 512, 512);
    speckle(c, 512, 512, 4000, 0.05, 2);
    c.strokeStyle = '#3e2412'; c.lineWidth = 3;
    for (let x = -512; x <= 512; x += 128) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 512, 512); c.stroke();
      c.beginPath(); c.moveTo(x + 512, 0); c.lineTo(x, 512); c.stroke();
    }
    c.fillStyle = '#4e123c';
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) {
      for (const [dx, dy] of [[0, 0], [64, 64]]) { c.beginPath(); c.arc(x + dx, y + dy, 9, 0, TAU); c.fill(); }
    }
    c.fillStyle = '#8a6a2a';
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) for (const [dx, dy] of [[0, 0], [64, 64]]) { c.beginPath(); c.arc(x + dx, y + dy, 3, 0, TAU); c.fill(); }
  }],
  casino: [3.6, (c) => {
    c.fillStyle = '#3e0710'; c.fillRect(0, 0, 512, 512);
    speckle(c, 512, 512, 3000, 0.05, 2);
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) {
      for (const [dx, dy] of [[0, 0], [64, 64]]) {
        const cx = x + dx, cy = y + dy;
        c.strokeStyle = '#7a5a1e'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, 26, 0, TAU); c.stroke();
        c.strokeStyle = '#14504c'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.stroke();
        c.fillStyle = '#8a6a26'; for (let a = 0; a < 8; a++) { c.beginPath(); c.arc(cx + Math.cos(a * TAU / 8) * 38, cy + Math.sin(a * TAU / 8) * 38, 4, 0, TAU); c.fill(); }
        c.fillStyle = '#2a0408'; c.beginPath(); c.arc(cx, cy, 8, 0, TAU); c.fill();
      }
    }
    c.strokeStyle = 'rgba(20,80,76,.5)'; c.lineWidth = 3;
    for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 30, 128, x - 30, 384, x, 512); c.stroke(); }
  }],
};

function styleRoom(zn, k) {
  const [wallAlb, wallEm] = WALLS[k];
  const wm = zn.wallMat;
  wm.color.set(0xffffff);
  const cap = (c, col) => { c.fillStyle = col; c.fillRect(0, 0, 512, 5); };
  wm.map = tex(cnv(512, 512, (c) => { wallAlb(c); cap(c, '#0c070c'); }), { repeat: true });
  wm.emissive = C(0xffffff); wm.emissiveMap = tex(cnv(512, 512, (c) => { wallEm(c); cap(c, '#000'); }), { repeat: true });
  wm.needsUpdate = true;
  for (const c of zn.colliders) if (c.wall && c.mesh) worldUV(c.mesh, WALL_H, WALL_H);
  const [T, paint] = FLOORS[k];
  let floorMat = null;
  const floors = [];
  zn.scene.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry' || !o.material.map || o.position.y > 0.01 || Math.abs(o.rotation.x + Math.PI / 2) > 1e-3) return;
    floorMat = o.material; floors.push(o);
    const uv = o.geometry.attributes.uv, p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + o.position.x) / T, (p.getY(i) - o.position.z) / T);
    uv.needsUpdate = true;
  });
  if (floorMat) {
    floorMat.map.dispose();
    floorMat.map = tex(cnv(512, 512, paint), { repeat: true });
    floorMat.color.set(0xffffff);
    floorMat.needsUpdate = true;
  }
  // Darker ambient: contrast comes from the neon, not from flat fill light.
  const amb = { club: [0.45, 0.12], redlight: [0.55, 0.14], gentlemens: [0.55, 0.14], casino: [0.7, 0.2] }[k];
  for (const o of zn.scene.children) {
    if (o.isHemisphereLight) o.intensity = amb[0];
    else if (o.isAmbientLight) o.intensity = amb[1];
  }
  // Three point lights, not five: every lit pixel pays for each one. Two light the hall (driven
  // by the show); the third follows her, so wherever she goes (back room, office) she's in the neon.
  const pl = [];
  zn.scene.traverse((o) => { if (o.isPointLight) pl.push(o); });
  for (const l of pl) if (!zn.plights.includes(l) || zn.plights.indexOf(l) > 2) l.visible = false;
  const follow = zn.plights[2];
  follow.distance = 11; follow.decay = 1.2; follow.intensity = 16; follow.color = C(zn.V.lights[0]);
  // no black void past the walls: a deep neon-tinted night instead
  const bg = { club: 0x1c0d38, redlight: 0x2a0a12, gentlemens: 0x260b28, casino: 0x22120a }[k];
  zn.scene.background = C(bg); zn.scene.fog.color = C(bg);
  return { floorMat, floors, follow, hall: zn.plights.slice(0, 2) };
}

// Static light pools and sign reflections are painted into one glow texture on the floor
// (emissive, second UV set spanning the whole building), so they cost no overdraw at all.
const LM = { x0: -15, z0: -22, w: 40, d: 36, px: 512 };
function paintFloorGlow(room, list) {
  if (!room.floorMat || !list.length) return;
  const c = cnv(LM.px, LM.px), g = c.getContext('2d'), sx = LM.px / LM.w, sz = LM.px / LM.d;
  g.fillStyle = '#000'; g.fillRect(0, 0, LM.px, LM.px);
  g.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const col = C(p.color).convertLinearToSRGB();
    const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
    g.save();
    g.translate((p.x - LM.x0) * sx, (p.z - LM.z0) * sz);
    g.rotate(p.rot || 0);
    g.scale(p.rx * sx, p.rz * sz);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${rgb},${Math.min(1, p.k * 1.6)})`); gr.addColorStop(0.3, `rgba(${rgb},${p.k * 0.8})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
    g.restore();
  }
  const t = tex(c);
  t.channel = 1;
  for (const f of room.floors) {
    const pos = f.geometry.attributes.position, uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + f.position.x, z = -pos.getY(i) + f.position.z;
      uv1[i * 2] = (x - LM.x0) / LM.w; uv1[i * 2 + 1] = 1 - (z - LM.z0) / LM.d;
    }
    f.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  }
  const m = room.floorMat;
  m.emissive = C(0xffffff); m.emissiveMap = t; m.emissiveIntensity = 1;
  m.needsUpdate = true;
}

// ------------------------------------------------------------------ the crowd (instanced)
const SKINS = ['#f6d1b3', '#e8b48f', '#c68642', '#8d5524', '#5c3a21', '#f1c27d', '#d9a07a'];
const HAIRS = ['#161616', '#2b1a10', '#5a3a1e', '#d8b050', '#a02a1a', '#e8e8e8', '#ff4fb0', '#3a3aa0'];

function tint(g, s) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(s);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const cylP = (rt, rb, h, seg, x, y, z, s, sz = 1) => tint(new THREE.CylinderGeometry(rt, rb, h, seg).scale(1, 1, sz).translate(x, y, z), s);
function figureGeos() {
  const shoes = (x, s = 0.1) => tint(new THREE.BoxGeometry(0.11, 0.07, 0.24).translate(x, 0.035, 0.04), s);
  const suit = mergeGeometries([
    cylP(0.085, 0.07, 0.86, 7, -0.1, 0.46, 0, 0.42), cylP(0.085, 0.07, 0.86, 7, 0.1, 0.46, 0, 0.42), shoes(-0.1), shoes(0.1),
    cylP(0.19, 0.18, 0.2, 10, 0, 0.94, 0, 0.42, 0.75), cylP(0.235, 0.18, 0.58, 10, 0, 1.32, 0, 1, 0.7),
  ]);
  const dress = mergeGeometries([
    cylP(0.06, 0.045, 0.8, 7, -0.08, 0.42, 0, 0.3), cylP(0.06, 0.045, 0.8, 7, 0.08, 0.42, 0, 0.3), shoes(-0.08, 0.05), shoes(0.08, 0.05),
    cylP(0.16, 0.31, 0.5, 12, 0, 0.76, 0, 1), cylP(0.2, 0.15, 0.52, 10, 0, 1.27, 0, 1, 0.72),
  ]);
  const head = mergeGeometries([cylP(0.05, 0.06, 0.18, 7, 0, 1.62, 0, 1), tint(new THREE.SphereGeometry(0.125, 12, 9).scale(0.95, 1.08, 1).translate(0, 1.79, 0), 1)]);
  const cap = () => tint(new THREE.SphereGeometry(0.138, 12, 7, 0, TAU, 0, Math.PI * 0.52).scale(1, 1.05, 1.08).translate(0, 1.8, -0.012), 1);
  const hairS = cap();
  const hairL = mergeGeometries([cap(), tint(new THREE.BoxGeometry(0.27, 0.46, 0.09).translate(0, 1.64, -0.1), 1)]);
  const arm = mergeGeometries([cylP(0.052, 0.042, 0.6, 6, 0, -0.3, 0, 1), tint(new THREE.SphereGeometry(0.052, 6, 5).translate(0, -0.63, 0), 1)]);
  return { suit, dress, head, hairS, hairL, arm };
}

/**
 * people: [{ x, z, rot, pose, type: 'suit'|'dress', outfit, skin?, hair?, hairType?, y?, s? }]
 * Poses: dance · stand · dj · deal · perform · bar · slot
 */
function buildCrowd(zn, people) {
  if (!people.length) return null;
  const G = figureGeos();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const groups = { suit: [], dress: [], head: [], hairS: [], hairL: [], arm: [] };
  for (const p of people) {
    p.skin = C(p.skin || pickR(SKINS)); p.outfit = C(p.outfit); p.hairC = C(p.hair || pickR(HAIRS));
    p.hairType = p.hairType || (p.type === 'dress' ? 'L' : pickR(['S', 'S', 'S', 'none']));
    p.y = p.y || 0; p.s = p.s || rnd(0.94, 1.06); p.ph = rnd(0, TAU); p.style = Math.floor(rnd(0, 4)); p.ox = 0; p.oz = 0;
    p.bi = groups[p.type].push(p) - 1;
    p.hi = groups.head.push(p) - 1;
    if (p.hairType !== 'none') p.ri = groups[p.hairType === 'L' ? 'hairL' : 'hairS'].push(p) - 1;
    p.ai = groups.arm.push(p, p) - 2;
  }
  const meshes = {};
  for (const [key, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const m = new THREE.InstancedMesh(G[key], mat, list.length);
    m.frustumCulled = false;
    m.name = 'nl-crowd';
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    list.forEach((p, i) => m.setColorAt(i, key === 'head' ? p.skin : key.startsWith('hair') ? p.hairC : key === 'arm' ? (p.type === 'dress' || p.pose === 'dance' && i % 3 === 0 ? p.skin : p.outfit) : p.outfit));
    zn.scene.add(m);
    meshes[key] = m;
  }
  // a little rig of dummies to compose each figure's matrices
  const root = new THREE.Object3D(), body = new THREE.Object3D(), aL = new THREE.Object3D(), aR = new THREE.Object3D();
  root.add(body); body.add(aL, aR);
  aL.position.set(-0.26, 1.52, 0); aR.position.set(0.26, 1.52, 0);
  return { people, meshes, root, body, aL, aR };
}

function updateCrowd(cr, zn, t, dt, B) {
  const { people, meshes, root, body, aL, aR } = cr;
  const obs = [zn.hero && zn.hero.position];
  for (const g of zn.guards) obs.push(g.mesh.position);
  if (zn.informant) obs.push(zn.informant.mesh.position);
  if (zn.boss) obs.push(zn.boss.position);
  const relax = Math.min(1, dt * 0.6);
  for (const p of people) {
    // step aside for her, the guards and the informant (they aren't colliders; this keeps them from clipping)
    if (!p.fixed) {
      let ox = p.ox * (1 - relax), oz = p.oz * (1 - relax);
      for (const o of obs) {
        if (!o) continue;
        const dx = p.x + ox - o.x, dz = p.z + oz - o.z, d = Math.hypot(dx, dz);
        if (d < 0.95 && d > 1e-4) { ox += (dx / d) * (0.95 - d); oz += (dz / d) * (0.95 - d); }
      }
      const L = Math.hypot(ox, oz);
      if (L > 2.2) { ox *= 2.2 / L; oz *= 2.2 / L; }
      p.ox = ox; p.oz = oz;
    }
    let bob = 0, sway = 0, lean = 0, turn = 0, l0 = 0.12, l1 = 0.1, r0 = 0.12, r1 = 0.1;
    const e = B.pulse, sw = Math.sin(B.ang * 0.5 + p.ph);
    switch (p.pose) {
      case 'dance': {
        bob = e * 0.07; sway = sw * 0.09;
        const st = (p.style + B.bar) % 4;
        if (st === 0) { r0 = 2.5 + e * 0.5; r1 = 0.25; l0 = 0.7 + sw * 0.3; l1 = 0.3; }
        else if (st === 1) { l0 = r0 = 2.75; l1 = 0.35 + sw * 0.25; r1 = 0.35 - sw * 0.25; }
        else if (st === 2) { l0 = 1.0 + Math.sin(B.ang + p.ph) * 0.6; r0 = 1.0 - Math.sin(B.ang + p.ph) * 0.6; l1 = r1 = 0.35; }
        else { turn = Math.sin(t * 0.7 + p.ph) * 0.8; l0 = 0.5; r0 = 0.5; l1 = r1 = 0.6 + e * 0.3; }
        break;
      }
      case 'stand': {
        sway = Math.sin(t * 0.8 + p.ph) * 0.035; bob = e * 0.015;
        const sip = Math.sin(t * 0.35 + p.ph) > 0.93;
        r0 = sip ? 2.0 : 1.1; r1 = 0.08; l0 = 0.15;
        break;
      }
      case 'dj': lean = 0.12 + e * 0.12; l0 = 1.0; r0 = B.bar % 4 === 3 ? 2.8 + e * 0.3 : 1.0 + Math.sin(t * 3) * 0.2; break;
      case 'deal': lean = 0.12; l0 = 1.1 + Math.sin(t * 2 + p.ph) * 0.18; r0 = 1.15 + Math.sin(t * 2.6 + p.ph + 1) * 0.25; l1 = r1 = 0.15; break;
      case 'bar': { const shake = Math.sin(t * 0.5 + p.ph) > 0.3; r0 = shake ? 2.1 + Math.sin(t * 16) * 0.3 : 1.0; l0 = 0.9; lean = 0.05; break; }
      case 'slot': lean = 0.08; r0 = 1.2 + (Math.sin(t * 1.5 + p.ph) > 0.8 ? 0.4 : 0); l0 = 0.2; break;
      case 'perform': {
        sway = Math.sin(t * 1.7) * 0.14; bob = (Math.sin(t * 3.4) * 0.5 + 0.5) * 0.03;
        l0 = 2.3 + Math.sin(t * 1.3) * 0.6; l1 = 0.6; r0 = 1.5 + Math.sin(t * 1.3 + 2) * 0.9; r1 = 0.55;
        if (p.orbit) { const a = t * 0.35; p.x = p.orbit[0] + Math.cos(a) * 0.5; p.z = p.orbit[1] + Math.sin(a) * 0.5; turn = -a * 0.3; }
        break;
      }
    }
    root.position.set(p.x + p.ox, p.y - bob, p.z + p.oz);
    root.rotation.y = p.rot + turn;
    root.scale.set(p.s, p.s * (1 - bob * 0.4), p.s);
    body.rotation.set(lean, 0, sway);
    aL.rotation.set(-l0, 0, -l1); aR.rotation.set(-r0, 0, r1);
    root.updateMatrixWorld(true);
    meshes[p.type].setMatrixAt(p.bi, body.matrixWorld);
    meshes.head.setMatrixAt(p.hi, body.matrixWorld);
    if (p.ri !== undefined) meshes[p.hairType === 'L' ? 'hairL' : 'hairS'].setMatrixAt(p.ri, body.matrixWorld);
    meshes.arm.setMatrixAt(p.ai, aL.matrixWorld);
    meshes.arm.setMatrixAt(p.ai + 1, aR.matrixWorld);
  }
  for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ the kit each venue builds with
function makeKit(zn, k) {
  const q = quality();
  const glowT = tex(glowCanvas());
  const X = {
    zn, k, lite: q.id === 'saver', rich: q.id === 'high',
    glowT, glow: new Batch(['position', 'uv']), cones: new Batch(['position', 'normal', 'uv']),
    signs: new Batch(['position', 'uv']), atlas: new Atlas(1024, 1024),
    bulbs: [], fx: [], people: [], paint: [],
    /** Additive light pool on the floor. */
    pool(x, z, r, color, k2 = 1, y) {
      if (y === undefined) { this.paint.push({ x, z, rx: r, rz: r, color, k: k2 }); return null; }
      return this.glow.push(floorQ(x, z, r * 2, r * 2, y), color, k2);
    },
    /** A glow on a wall (w x h), just off its face. */
    halo(side, a, y, w, h, color, k2 = 1) { const [x, yy, z] = onWall(side, a, y, 0.02); return this.glow.push(wallQ(x, yy, z, w, h, YAW[side]), color, k2); },
    bulb(x, y, z, s, color, f) { const b = { p: [x, y, z], s, c: C(color), f }; this.bulbs.push(b); return b; },
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

function buildKit(X) {
  const { zn } = X, S = zn.scene;
  paintFloorGlow(X.room, X.paint);
  X.glow.name = 'nl-glow'; X.cones.name = 'nl-cones'; X.signs.name = 'nl-signs';
  X.glow.build(S, new THREE.MeshBasicMaterial({ map: X.glowT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  X.cones.build(S, coneMat());
  if (X.atlas.items.length) {
    X.atlas.paint();
    X.atlas.tex = tex(X.atlas.canvas);
    X.signs.build(S, new THREE.MeshBasicMaterial({ map: X.atlas.tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    // signage is lettered in Bangers; repaint once the webfont is in (the fallback shows until then)
    if (document.fonts && !document.fonts.check('40px Bangers')) document.fonts.load('40px Bangers').then(() => X.atlas.paint()).catch(() => {});
  }
  X.pmat = X.pmat || pointsMat(X.glowT);
  if (X.bulbs.length) { X.bulbPts = makePoints(X.bulbs, X.pmat); X.bulbPts.name = 'nl-bulbs'; S.add(X.bulbPts); }
  X.crowd = buildCrowd(zn, X.people);
}

/** Beat clock: n = beat number, ph = phase within the beat, pulse = a kick that decays over the beat. */
function beat(t, bpm) {
  const b = (t * bpm) / 60, n = Math.floor(b), ph = b - n;
  return { b, n, ph, pulse: Math.exp(-ph * 5), ang: b * Math.PI, bar: Math.floor(n / 4), sec: Math.floor(n / 16) };
}
const flicker = (t, seed) => (Math.sin(t * 17 + seed * 7) > 0.985 || Math.floor(t * 9 + seed) % 53 === 0 ? 0.2 : 1);

// ------------------------------------------------------------------ shared venue pieces
/** Warm back-bar behind the bar along the west wall: glowing shelves of bottles. */
function backBar(X, z0, z1, tintC) {
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

function haze(X, color, n, y0 = 1.2, y1 = 3.0) {
  if (!X.rich) return; // big additive sprites: fill-rate heavy, High profile only
  const list = [];
  for (let i = 0; i < n; i++) list.push({ p: [rnd(-13, 13), rnd(y0, y1), rnd(-10, 10)], s: rnd(4, 7), c: C(color).multiplyScalar(rnd(0.03, 0.06)) });
  const pts = makePoints(list, X.pmat || (X.pmat = pointsMat(X.glowT)));
  pts.name = 'nl-haze';
  X.zn.scene.add(pts);
  X.fx.push((t) => { pts.rotation.y = Math.sin(t * 0.05) * 0.25; });
}

// ------------------------------------------------------------------ Nightclub
function nightclub(zn, X, h) {
  const { lam, basic } = h, S = zn.scene;
  // dance floor: 36 LED panels in one instanced mesh
  const tileT = tex(cnv(64, 64, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64);
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 40);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
    c.fillStyle = g; c.fillRect(3, 3, 58, 58);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.strokeRect(5, 5, 54, 54);
  }));
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tileT }), 36);
  const M = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { M.makeTranslation(-3 + i * 1.2, 0.02, -2.5 + j * 1.2); tiles.setMatrixAt(i * 6 + j, M); tiles.setColorAt(i * 6 + j, C(0x222222)); }
  S.add(tiles);
  // chrome + neon frame around the floor
  const frame = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(7.5, 0.06, 0.12).translate(0, 0.03, -3.18), new THREE.BoxGeometry(7.5, 0.06, 0.12).translate(0, 0.03, 4.18),
    new THREE.BoxGeometry(0.12, 0.06, 7.5).translate(-3.68, 0.03, 0.5), new THREE.BoxGeometry(0.12, 0.06, 7.5).translate(3.68, 0.03, 0.5),
  ]), basic(0xff2fd0));
  S.add(frame);
  const floorGlow = X.glow.push(new THREE.RingGeometry(3.7, 4.9, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2).scale(1, 1, 1).translate(0, 0.03, 0.5), 0xffffff, 0.2);
  // truss over the floor, holding the ball and four moving heads
  const truss = mergeGeometries([
    new THREE.BoxGeometry(8.6, 0.14, 0.14).translate(0, 3.32, -3.7), new THREE.BoxGeometry(8.6, 0.14, 0.14).translate(0, 3.32, 4.7),
    new THREE.BoxGeometry(0.14, 0.14, 8.4).translate(-4.3, 3.32, 0.5), new THREE.BoxGeometry(0.14, 0.14, 8.4).translate(4.3, 3.32, 0.5),
    new THREE.BoxGeometry(8.6, 0.06, 0.06).translate(0, 3.32, 0.5), new THREE.CylinderGeometry(0.015, 0.015, 0.4).translate(0, 3.35, 0.5),
    ...[[-4.3, -3.7], [4.3, -3.7], [-4.3, 4.7], [4.3, 4.7]].map(([x, z]) => new THREE.BoxGeometry(0.26, 0.3, 0.26).translate(x, 3.1, z)),
  ]);
  S.add(new THREE.Mesh(truss, lam(0x2a2a33)));
  // mirror ball
  const facets = tex(cnv(128, 64, (c) => {
    for (let x = 0; x < 128; x += 4) for (let y = 0; y < 64; y += 4) { const v = Math.random(); c.fillStyle = v > 0.93 ? '#fff' : `hsl(${rnd(180, 320)},30%,${20 + v * 55}%)`; c.fillRect(x, y, 3, 3); }
  }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), new THREE.MeshBasicMaterial({ map: facets }));
  ball.position.set(0, 3.0, 0.5); S.add(ball);
  X.nl.ball = ball;
  const ballGlow = X.bulb(0, 3.0, 0.5, 2.2, 0xaaccff);
  // mirror-ball specks sweeping the floor
  const specks = [];
  for (let i = 0; i < (X.lite ? 60 : X.rich ? 170 : 110); i++) {
    const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 10.5 + 0.8;
    specks.push({ p: [Math.cos(a) * r, 0.05, Math.sin(a) * r * 0.95], s: rnd(0.1, 0.18), c: C(pickR([0xffffff, 0xbfe8ff, 0xffd0f0])).multiplyScalar(0.7) });
  }
  const speckPts = makePoints(specks, X.pmat || (X.pmat = pointsMat(X.glowT)));
  speckPts.name = 'nl-specks'; speckPts.position.set(0, 0, 0.5); S.add(speckPts);
  // moving heads: fake beams + their pools, swept across the floor
  const heads = [];
  const cm = coneMat();
  const hcols = [0xff2fd0, 0x27e0ff, 0xffe14d, 0x9d4dff];
  const nHeads = X.rich ? 4 : 2; // each beam is a screen-tall additive surface
  const hpos = [[-4.3, -3.7], [4.3, -3.7], [4.3, 4.7], [-4.3, 4.7]];
  for (let i = 0; i < nHeads; i++) {
    const mat = cm.clone(); mat.uniforms.uC.value = C(hcols[i]); mat.uniforms.uI.value = 0.55;
    const beam = new THREE.Mesh(coneGeo(0.03, 0.42), mat);
    beam.frustumCulled = false; beam.name = 'nl-heads';
    beam.position.set(hpos[i][0], 3.0, hpos[i][1]);
    S.add(beam);
    const pm = new THREE.Mesh(floorQ(0, 0, 3, 3, 0.04 + i * 0.003), new THREE.MeshBasicMaterial({ map: X.glowT, color: hcols[i], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pm.name = 'nl-heads'; S.add(pm);
    heads.push({ beam, pool: pm, ph: i * 1.7, col: C(hcols[i]) });
  }
  // lasers fanning from above the DJ over the crowd (not on Battery saver)
  let lasers = null;
  if (!X.lite) {
    const bt = tex(beamCanvas());
    const L = 17, gs = [];
    for (let i = 0; i < 8; i++) {
      const yaw = (i / 7 - 0.5) * 0.9;
      const a = new THREE.PlaneGeometry(0.07, L).rotateX(-Math.PI / 2).translate(0, 0, L / 2);
      const b = a.clone().rotateZ(Math.PI / 2);
      gs.push(a.rotateY(yaw), b.rotateY(yaw));
    }
    lasers = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ map: bt, color: 0x39ff6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    lasers.position.set(-8, 2.25, -10.4); lasers.frustumCulled = false; lasers.name = 'nl-lasers';
    S.add(lasers);
    X.bulb(-8, 2.25, -10.4, 0.7, 0x39ff6a);
  }
  // DJ booth: the original box + strip stay (collider); dress its front, decks, speakers and an LED wall
  zn.box(3.5, 1.2, 1.4, -8, 0.6, -10.2, lam(0x14141c));
  zn.box(3.3, 0.1, 1.2, -8, 1.25, -10.2, basic(0x27e0ff), { collide: false });
  for (const x of [-10.5, -5.5]) zn.box(0.9, 2, 0.9, x, 1, -10.8, lam(0x0c0c10));
  const boothT = tex(cnv(256, 96, (c) => {
    c.fillStyle = '#07060c'; c.fillRect(0, 0, 256, 96);
    neonText(c, 'VOLT', 128, 50, 54, '#27e0ff');
    neonPath(c, '#ff2fd0', 2.5, () => { c.beginPath(); c.moveTo(6, 88); c.lineTo(250, 88); });
  }));
  S.add(new THREE.Mesh(wallQ(-8, 0.62, -9.48, 3.4, 1.1, 0), new THREE.MeshBasicMaterial({ map: boothT })));
  const spkT = tex(cnv(64, 128, (c) => {
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, 64, 128);
    for (const [y, r] of [[32, 18], [88, 26]]) {
      c.fillStyle = '#1c1c26'; c.beginPath(); c.arc(32, y, r + 3, 0, TAU); c.fill();
      c.fillStyle = '#050508'; c.beginPath(); c.arc(32, y, r, 0, TAU); c.fill();
      c.fillStyle = '#2a2a3a'; c.beginPath(); c.arc(32, y, r * 0.35, 0, TAU); c.fill();
    }
  }));
  S.add(new THREE.Mesh(mergeGeometries([wallQ(-10.5, 1, -10.34, 0.86, 1.95, 0), wallQ(-5.5, 1, -10.34, 0.86, 1.95, 0)]), new THREE.MeshBasicMaterial({ map: spkT })));
  const decks = [];
  for (const x of [-9, -7]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20), new THREE.MeshBasicMaterial({ map: facets, color: 0x555566 }));
    d.position.set(x, 1.32, -10.2); S.add(d); decks.push(d);
  }
  const ledC = cnv(96, 32), ledT = tex(ledC, { nearest: true });
  const led = new THREE.Mesh(wallQ(...onWall('N', -8, 2.25, 0.03), 7, 2.2, 0), new THREE.MeshBasicMaterial({ map: ledT }));
  S.add(led);
  const ledHalo = X.halo('N', -8, 2.25, 8, 2.8, 0xffffff, 0.3);
  X.pool(-8, -9.5, 3.5, 0x27e0ff, 0.25);

  // signage
  const A = X.atlas;
  const sVolt = X.sign('N', 8, 2.35, 1.0, A.add(512, 128, (c, w, hh) => { neonPath(c, '#ffe14d', 5, boltPath(c, 58, 64, 46)); neonText(c, 'CLUB VOLT', 290, 68, 84, '#27e0ff', { maxW: 400 }); }), 0x27e0ff);
  const sBar = X.sign('W', -1, 2.85, 0.62, A.add(512, 110, (c) => neonText(c, 'Cocktails', 256, 58, 86, '#ff2fd0', { font: SCRIPT, weight: '700', maxW: 480 })), 0xff2fd0);
  const sVip = X.sign('E', 7, 2.55, 0.9, A.add(256, 128, (c) => { neonPath(c, '#ffe14d', 4, glassPath(c, 58, 64, 44)); neonText(c, 'VIP', 170, 68, 90, '#ffe14d'); }), 0xffe14d);
  const sDance = X.sign('E', -7, 2.55, 0.8, A.add(384, 110, (c) => neonText(c, 'DANCE', 192, 58, 84, '#9d4dff', { maxW: 360 })), 0x9d4dff);
  X.sign('S', -8, 2.5, 0.8, A.add(512, 110, (c) => neonText(c, 'PARTY ALL NIGHT', 256, 58, 70, '#ff2fd0', { maxW: 490 })), 0xff2fd0);
  const sNoPh = X.sign('S', 8, 2.5, 0.7, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS!', 192, 52, 64, '#ff5a3d', { maxW: 360 })), 0xff5a3d);
  // bar: back-bar shelves, an LED strip along the bar front
  backBar(X, -6.2, 4.2, '#5a2a40');
  S.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 10.8).translate(-12.38, 0.12, -1), basic(0x27e0ff)));
  X.pool(-12.1, -1, 1.4, 0x27e0ff, 0.12);
  X.glow.push(floorQ(-11.9, -1, 1.2, 11, 0.026), 0x27e0ff, 0.3);
  // table candles as soft pools, sofa up-lights
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.6, 0xff6ab0, 0.3);
  X.pool(12, 7, 2.8, 0x9d4dff, 0.35); X.pool(12, -7, 2.6, 0x27e0ff, 0.3);
  haze(X, 0x8a5aff, X.rich ? 22 : 14);

  // crowd: dancers on the floor, patrons at the bar and by the sofas, the DJ and a bartender
  const OUT = ['#ff2fd0', '#27e0ff', '#f2f2f2', '#ffe14d', '#9d4dff', '#1a1a1a', '#ff6a3d', '#3dff9a', '#e0e0ff'];
  for (let gi = 0; gi < 4; gi++) for (let gj = 0; gj < 4; gj++) {
    if ((gi === 1 && gj === 3) || (gi === 2 && gj === 1) || Math.random() < 0.12) continue;
    X.people.push({ x: -2.7 + gi * 1.8 + rnd(-0.35, 0.35), z: -2.2 + gj * 1.8 + rnd(-0.35, 0.35), rot: rnd(-3, 3), pose: 'dance', type: Math.random() < 0.5 ? 'dress' : 'suit', outfit: pickR(OUT) });
  }
  X.people.push(
    { x: -11.75, z: -4.3, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#ff2fd0' },
    { x: -11.8, z: 2.6, rot: -Math.PI / 2 + 0.3, pose: 'stand', type: 'suit', outfit: '#20203a' },
    { x: 10.4, z: 5.4, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#f2f2f2' },
    { x: 10.6, z: 8.8, rot: -Math.PI / 2 - 0.4, pose: 'dance', type: 'dress', outfit: '#27e0ff' },
    { x: -8, z: 8.6, rot: 0.9, pose: 'stand', type: 'dress', outfit: '#ffe14d' },
    { x: -7.2, z: 9.3, rot: -2.2, pose: 'stand', type: 'suit', outfit: '#1a1a1a' },
    { x: -8, z: -11.25, rot: 0, pose: 'dj', type: 'suit', outfit: '#101010', hairType: 'S', fixed: true },
    { x: -14.35, z: -2.5, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#f0f0f0', fixed: true },
  );

  // the show
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
  let ledNext = 0;
  X.fx.push((t, dt, B) => {
    const pat = B.sec % 4, e = B.pulse, hueBase = (B.bar * 0.13) % 1;
    let sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, d = Math.hypot(i - 2.5, j - 2.5);
      let on, hue;
      if (pat === 0) { on = (i + j + B.n) % 2 === 0 ? 1 : 0.12; hue = hueBase + (B.n % 2) * 0.5; }
      else if (pat === 1) { on = Math.max(0.1, 1 - Math.abs(d - ((B.b * 2) % 5)) * 1.2); hue = hueBase + d * 0.08; }
      else if (pat === 2) { on = 0.35 + 0.65 * (Math.sin((i + j) * 0.9 - t * 6) * 0.5 + 0.5); hue = (i + j) / 12 + t * 0.15; }
      else { on = ((k * 7919 + B.n * 104729) % 11) < 4 ? 1 : 0.1; hue = ((k * 31 + B.n * 17) % 100) / 100; }
      const lum = on * (0.55 + 0.45 * e);
      tmpC.setHSL(((hue % 1) + 1) % 1, 0.95, 0.5).multiplyScalar(lum);
      tiles.setColorAt(k, tmpC);
      sumR += tmpC.r; sumG += tmpC.g; sumB += tmpC.b;
    }
    tiles.instanceColor.needsUpdate = true;
    X.glow.set(floorGlow, 0.45, tmpC.setRGB(sumR / 36, sumG / 36, sumB / 36));
    frame.material.color.setHSL((hueBase + 0.5) % 1, 1, 0.45 + 0.2 * e);
    // ball, specks, decks
    ball.rotation.y += dt * 0.8; speckPts.rotation.y -= dt * 0.35;
    ballGlow.c.setScalar(0.35 + 0.35 * e);
    for (const d of decks) d.rotation.y += dt * 3.5;
    // moving heads sweep in figure-eights; faster in the "drop" sections
    const sp = pat === 1 || pat === 3 ? 1.9 : 0.8;
    for (const hd of heads) {
      const a = t * sp + hd.ph;
      tmpV.set(Math.sin(a) * 3.2, 0, 0.5 + Math.sin(a * 2 + hd.ph) * 2.8);
      const from = hd.beam.position, dx = tmpV.x - from.x, dy = -from.y, dz = tmpV.z - from.z, L = Math.hypot(dx, dy, dz);
      hd.beam.quaternion.setFromUnitVectors(DOWN, tmpV.set(dx / L, dy / L, dz / L));
      hd.beam.scale.setScalar(L);
      hd.beam.material.uniforms.uI.value = 0.35 + 0.45 * e;
      hd.pool.position.set(from.x + dx, 0, from.z + dz);
      hd.pool.material.opacity = 1; hd.pool.material.color.copy(hd.col).multiplyScalar(0.35 + 0.4 * e);
    }
    if (lasers) {
      const on = B.sec % 2 === 1;
      lasers.visible = on;
      if (on) {
        lasers.rotation.set(0.12 + Math.sin(t * 1.3) * 0.07, 0.62 + Math.sin(t * 0.9) * 0.45, 0);
        lasers.material.color.set(B.bar % 2 ? 0x39ff6a : 0xff2a4a).multiplyScalar(0.6 + 0.4 * e);
      }
    }
    // LED wall: a spectrum on the beat, or scrolling bars (redrawn ~12x a second)
    if (t >= ledNext) {
      ledNext = t + 0.08;
      const c = ledC.getContext('2d');
      c.fillStyle = '#000'; c.fillRect(0, 0, 96, 32);
      for (let x = 0; x < 96; x += 3) {
        const v = Math.max(0.1, (0.35 + 0.6 * e) * (0.5 + 0.5 * Math.sin(x * 0.21 + t * 4) * Math.sin(x * 0.07 - t * 1.3)) + Math.random() * 0.15);
        const hgt = Math.round(v * 30);
        for (let y = 0; y < hgt; y += 2) { c.fillStyle = `hsl(${(hueBase * 360 + y * 7 + x) % 360},100%,55%)`; c.fillRect(x, 31 - y, 2, 1); }
      }
      if (pat === 3) { c.font = 'bold 20px Impact'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('VOLT', 48 + Math.sin(t * 2) * 20, 22); }
      ledT.needsUpdate = true;
    }
    tmpC.setHSL(hueBase, 1, 0.5); X.glow.set(ledHalo, 0.18 + 0.2 * e, tmpC);
    // signs: the bolt throbs to the kick, one tube buzzes
    X.signs.set(sVolt.s, 0.75 + 0.25 * e); X.glow.set(sVolt.h, 0.35 + 0.3 * e);
    X.signs.set(sNoPh.s, flicker(t, 3)); X.glow.set(sNoPh.h, 0.45 * flicker(t, 3));
    X.signs.set(sDance.s, B.n % 2 ? 1 : 0.55);
    // the house lights cycle colour every bar
    X.room.hall.forEach((l, i) => { l.color.setHSL((hueBase + i * 0.3) % 1, 1, 0.55); l.intensity = 14 + 26 * e; });
  });
}

// ------------------------------------------------------------------ Gentlemen's Club
function gentlemens(zn, X, h) {
  const { lam, basic, table } = h, S = zn.scene;
  // stage (the original collider), in black lacquer with a gold lip and footlights
  zn.box(4, 0.5, 8, 11.5, 0.25, -3, lam(0x1a0a12));
  S.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 8.04).translate(9.49, 0.47, -3), basic(0xe0b040)));
  for (const z of [-7.2, 1.2]) zn.box(0.3, 3.2, 1.2, 13.2, 1.6, z, lam(0x7a1030), { collide: false });
  zn.cyl(0.05, 0.05, 2.9, 11.5, 1.95, -3, lam(0xf0e0b0, { emissive: 0x3a3020 }));
  for (let i = 0; i < 4; i++) table(3 + (i % 2) * 3.5, -6 + Math.floor(i / 2) * 5, 0x1a1a1a);
  // velvet curtain behind the stage (not across the office door)
  const velvet = tex(cnv(256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 8; i++) { g.addColorStop(i / 8, i % 2 ? '#2a0414' : '#8a1438'); }
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    const v = c.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,.55)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.2)');
    c.fillStyle = v; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#c09a34'; c.fillRect(0, 240, 256, 8);
  }), { repeat: true });
  velvet.repeat.set(3, 1);
  const [cx, , cz] = onWall('E', -4.4, 0, 0.05);
  S.add(new THREE.Mesh(wallQ(cx, 1.65, cz, 5.2, 3.3, YAW.E), lam(0xffffff, { map: velvet })));
  // spotlights on the stage: beams from the house, a hot pool on the boards
  X.cone(new THREE.Vector3(7.2, 3.4, -6.2), new THREE.Vector3(11.4, 0.5, -3.4), 1.1, 0xffc0e8, 0.55);
  X.cone(new THREE.Vector3(7.2, 3.4, 0.2), new THREE.Vector3(11.4, 0.5, -2.6), 1.1, 0xff66cc, 0.5);
  const stagePool = X.pool(11.4, -3, 2.1, 0xff88dd, 0.55, 0.52);
  X.pool(11.5, -3, 3.4, 0xff44cc, 0.2, 0.515);
  // footlights along the stage lip, chasing
  const foot = [];
  for (let z = -6.8; z <= 0.81; z += 0.38) foot.push(X.bulb(9.44, 0.56, z, 0.22, 0xffd890));
  // pole gleam
  X.bulb(11.5, 3.3, -3, 0.9, 0xffe0f0);
  // pink pendant glows over the tables
  for (let i = 0; i < 4; i++) {
    const x = 3 + (i % 2) * 3.5, z = -6 + Math.floor(i / 2) * 5;
    X.bulb(x, 2.7, z, 0.6, 0xff66cc); X.pool(x, z, 1.7, 0xff66cc, 0.3);
    X.cone(new THREE.Vector3(x, 2.7, z), new THREE.Vector3(x, 0.8, z), 0.7, 0xff66cc, 0.22);
  }
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.5, 0xffb070, 0.25);
  X.pool(12, 7, 2.6, 0xcc66ff, 0.3);
  // gold sconces on the walls
  for (const [side, a] of [['N', -12], ['N', -4.5], ['N', 4.5], ['N', 12], ['S', -12], ['S', -6], ['S', 6], ['S', 12], ['W', -9], ['W', 8]]) {
    const [x, y, z] = onWall(side, a, 2.3, 0.1);
    X.bulb(x, y, z, 0.5, 0xffc070); X.halo(side, a, 2.3, 1.2, 1.6, 0xffa050, 0.35);
  }
  // signage
  const A = X.atlas;
  const sLive = X.sign('E', -4.4, 3.02, 0.55, A.add(512, 110, (c) => neonText(c, 'LIVE REVUE', 256, 58, 80, '#ff44cc', { maxW: 470 })), 0xff44cc, { streak: 0 });
  const sLily = X.sign('N', -8, 2.4, 0.95, A.add(512, 150, (c) => neonText(c, 'The Gilded Lily', 256, 80, 96, '#ffc890', { font: SCRIPT, weight: '700', maxW: 490 })), 0xffc890);
  const lilyBulbs = X.bulbFrame('N', -8, 2.4, 4.2, 1.3, 0xffd890);
  X.sign('N', 8, 2.45, 0.7, A.add(512, 110, (c) => neonText(c, 'CHAMPAGNE', 256, 58, 80, '#cc66ff', { maxW: 470 })), 0xcc66ff);
  X.sign('W', -1, 2.85, 0.6, A.add(256, 110, (c) => neonText(c, 'BAR', 128, 58, 84, '#ffc890')), 0xffc890);
  X.sign('S', -8, 2.5, 0.7, A.add(512, 110, (c) => neonText(c, 'VIP LOUNGE', 256, 58, 76, '#ff44cc', { maxW: 470 })), 0xff44cc);
  const sNoCam = X.sign('S', 8, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO CAMERAS', 192, 52, 60, '#ffc890', { maxW: 360 })), 0xffc890);
  backBar(X, -6.2, 4.2, '#6a3010');
  haze(X, 0xff66cc, X.rich ? 18 : 12);

  // performer (sequins and a feather boa's worth of glamour, nothing more), patrons, bartender
  X.people.push(
    { x: 11.9, z: -3.4, y: 0.5, rot: -Math.PI / 2, pose: 'perform', type: 'dress', outfit: '#ffd24a', hair: '#e8c060', hairType: 'L', orbit: [11.5, -3], fixed: true, s: 1.02 },
    { x: 8.7, z: -5.3, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#1a1a24' },
    { x: 8.8, z: -3.3, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#3a2a1a' },
    { x: 8.7, z: -1.3, rot: Math.PI / 2 - 0.2, pose: 'stand', type: 'suit', outfit: '#2a2a3a' },
    { x: 4.3, z: -6.8, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#111118' },
    { x: 2.2, z: -1.9, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#40203a' },
    { x: 7.6, z: -0.2, rot: Math.PI / 2 + 0.4, pose: 'stand', type: 'dress', outfit: '#cc2266' },
    { x: 10.5, z: 6.2, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#6a2aa0' },
    { x: 10.6, z: 8.2, rot: -Math.PI / 2 - 0.3, pose: 'stand', type: 'suit', outfit: '#1a1a1a' },
    { x: -11.8, z: 1.8, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#2a1a1a' },
    { x: -14.35, z: -1.5, rot: Math.PI / 2, pose: 'bar', type: 'dress', outfit: '#111111', fixed: true },
  );

  X.fx.push((t, dt, B) => {
    const e = B.pulse;
    foot.forEach((b, i) => b.c.setRGB(1, 0.85, 0.55).multiplyScalar((i + B.n) % 3 === 0 ? 0.9 : 0.35));
    lilyBulbs.forEach((b, i) => b.c.setRGB(1, 0.85, 0.55).multiplyScalar((i + Math.floor(t * 6)) % 4 === 0 ? 1 : 0.3));
    X.glow.set(stagePool, 0.45 + 0.2 * Math.sin(t * 1.3));
    X.signs.set(sLive.s, 0.8 + 0.2 * e); X.glow.set(sLive.h, 0.4 + 0.2 * e);
    X.signs.set(sNoCam.s, flicker(t, 5));
    X.glow.set(sLily.h, 0.45 + 0.1 * Math.sin(t * 2));
    X.room.hall.forEach((l, i) => { l.intensity = 24 + Math.sin(t * 1.2 + i * 2) * 6 + e * 4; });
  });
}

// ------------------------------------------------------------------ Red Light Den
function redlight(zn, X, h) {
  const { lam, table } = h, S = zn.scene;
  // booth windows on the front wall: curtains, backlit, a silhouette or two (tasteful: shoulders & hair)
  const winC = cnv(384, 256, (c) => {
    for (let v = 0; v < 3; v++) {
      const x0 = v * 128;
      const g = c.createRadialGradient(x0 + 64, 110, 10, x0 + 64, 110, 120);
      g.addColorStop(0, '#ff6a7a'); g.addColorStop(0.5, '#c0102a'); g.addColorStop(1, '#3a0008');
      c.fillStyle = g; c.fillRect(x0, 0, 128, 256);
      if (v === 1) { // a silhouette seated, side-on
        c.fillStyle = '#1a0006';
        c.beginPath(); c.ellipse(x0 + 64, 92, 13, 16, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x0 + 52, 84); c.quadraticCurveTo(x0 + 40, 130, x0 + 50, 150); c.lineTo(x0 + 60, 110); c.fill();
        c.beginPath(); c.moveTo(x0 + 58, 106); c.quadraticCurveTo(x0 + 44, 130, x0 + 50, 160); c.quadraticCurveTo(x0 + 56, 190, x0 + 48, 214); c.lineTo(x0 + 92, 214); c.quadraticCurveTo(x0 + 84, 180, x0 + 80, 150); c.quadraticCurveTo(x0 + 84, 124, x0 + 70, 106); c.fill();
      }
      if (v === 2) { c.fillStyle = 'rgba(255,230,180,.9)'; c.beginPath(); c.arc(x0 + 64, 120, 10, 0, TAU); c.fill(); c.fillStyle = '#2a0008'; c.fillRect(x0 + 56, 130, 16, 60); }
      // curtains (drawn fully across on v=0)
      const cw = v === 0 ? 64 : 36;
      for (const side of [0, 1]) {
        const cx = side ? x0 + 128 - cw : x0;
        const cg = c.createLinearGradient(cx, 0, cx + cw, 0);
        for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, i % 2 ? '#4a0010' : '#a01030');
        c.fillStyle = cg; c.globalAlpha = v === 0 ? 0.8 : 1; c.fillRect(cx, 10, cw, 240); c.globalAlpha = 1;
      }
      c.fillStyle = '#e0a040'; c.fillRect(x0, 8, 128, 5);
      c.strokeStyle = '#140204'; c.lineWidth = 10; c.strokeRect(x0 + 5, 5, 118, 246);
    }
  });
  const winT = tex(winC), wins = [];
  for (let i = 0; i < 6; i++) {
    const x = -12 + i * 4.8;
    zn.box(1.6, 3.2, 0.2, x, 1.6, 11.7, lam(0x1a0508), { collide: false });
    const v = [0, 1, 2, 1, 0, 2][i];
    wins.push(uvRect(wallQ(x, 1.55, 11.59, 1.45, 2.7, Math.PI), [v / 3, 0, (v + 1) / 3, 1]));
    X.pool(x, 10.7, 1.9, 0xff2244, 0.4);
  }
  S.add(new THREE.Mesh(mergeGeometries(wins), new THREE.MeshBasicMaterial({ map: winT })));
  for (let i = 0; i < 3; i++) table(4 + i * 3.2, -6, 0x5a0a1a);
  // paper lanterns: the row by the windows, plus strings sagging across the hall
  const lanT = tex(cnv(128, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#6a0010'); g.addColorStop(0.5, '#ff4a4a'); g.addColorStop(1, '#6a0010');
    c.fillStyle = g; c.fillRect(0, 0, 128, 64);
    c.strokeStyle = 'rgba(80,0,10,.7)'; c.lineWidth = 2; for (let x = 0; x < 128; x += 11) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); }
    c.fillStyle = '#ffd24a'; c.font = 'bold 22px serif'; c.textAlign = 'center'; c.fillText('♥', 32, 40); c.fillText('♥', 96, 40);
  }), { repeat: true });
  const lanterns = [];
  for (let i = 0; i < 6; i++) lanterns.push([-12 + i * 4.8, 2.75, 10.5, 1]);
  for (const z of [5.5, -0.5, -6.5]) {
    for (let i = 0; i <= 8; i++) {
      const x = -13.5 + i * 3.375, sag = Math.sin((i / 8) * Math.PI) * 0.45;
      lanterns.push([x, 3.1 - sag, z + Math.sin(i * 1.3) * 0.2, 0.75]);
    }
  }
  const lanGeo = new THREE.SphereGeometry(0.3, 12, 8).scale(1, 1.2, 1);
  const lanMesh = new THREE.InstancedMesh(lanGeo, new THREE.MeshBasicMaterial({ map: lanT }), lanterns.length);
  const capMesh = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).translate(0, 0.37, 0), new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).translate(0, -0.37, 0), new THREE.CylinderGeometry(0.015, 0.03, 0.3, 5).translate(0, -0.55, 0)]), lam(0x2a1a08, { emissive: 0x3a2000 }), lanterns.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3();
  lanterns.forEach(([x, y, z, s], i) => { M.compose(V1.set(x, y, z), Q, new THREE.Vector3(s, s, s)); lanMesh.setMatrixAt(i, M); capMesh.setMatrixAt(i, M); });
  S.add(lanMesh, capMesh);
  const lanGlows = lanterns.map(([x, y, z, s], i) => {
    if (i >= 6 && i % 2) X.pool(x, z, 1.6 * s, 0xff2a3a, 0.35);
    else if (i < 6) X.cone(new THREE.Vector3(x, y - 0.2, z), new THREE.Vector3(x, 0, z - 0.2), 0.9, 0xff3344, 0.3);
    return X.bulb(x, y, z, 1.3 * s, 0xff3040);
  });
  // strings between lanterns
  const lp = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) { const a = lanterns[6 + r * 9 + i], b = lanterns[6 + r * 9 + i + 1]; lp.push(a[0], a[1] + 0.3, a[2], b[0], b[1] + 0.3, b[2]); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  S.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1a0a08 })));
  // wet floor: puddles catching the neon
  const pudT = tex(cnv(128, 128, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) { c.globalAlpha = 0.25; c.beginPath(); c.ellipse(64 + rnd(-24, 24), 64 + rnd(-20, 20), rnd(18, 40), rnd(10, 24), rnd(0, 3), 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }));
  const pud = new Batch(['position', 'uv']);
  for (const [x, z, s, col] of [[-6, 2, 2.4, 0xff2244], [7, 3, 2, 0xff66aa], [-2.5, -8, 2.6, 0xff2244], [10, -3, 1.8, 0xffaa33], [-10, 8, 2.2, 0xff2244]]) pud.push(floorQ(x, z, s * 1.6, s, 0.028).rotateY(rnd(-0.5, 0.5)), col, 0.4);
  pud.build(S, new THREE.MeshBasicMaterial({ map: pudT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  // signage
  const A = X.atlas;
  const sOpen = X.sign('N', -8, 2.45, 0.85, A.add(512, 128, (c) => neonText(c, 'OPEN ALL NIGHT', 256, 66, 76, '#ff2244', { maxW: 490 })), 0xff2244);
  const sHeart = X.sign('N', 8, 2.35, 1.3, A.add(384, 192, (c) => { neonPath(c, '#ff66aa', 6, heartPath(c, 90, 96, 60)); neonText(c, 'ROOMS', 262, 100, 70, '#ff66aa', { maxW: 220 }); }), 0xff66aa);
  X.sign('W', -1, 2.85, 0.6, A.add(256, 110, (c) => neonText(c, 'BAR', 128, 58, 84, '#ffaa33')), 0xffaa33);
  const sDen = X.sign('E', 7, 2.45, 0.9, A.add(384, 128, (c) => neonText(c, 'THE DEN', 192, 66, 86, '#ff2244', { maxW: 360 })), 0xff2244);
  X.sign('E', -7, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS', 192, 52, 62, '#ffaa33', { maxW: 360 })), 0xffaa33);
  backBar(X, -6.2, 4.2, '#6a1810');
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.4, 0xffaa33, 0.25);
  X.pool(12, 7, 2.6, 0xff2244, 0.3); X.pool(12, -7, 2.4, 0xff66aa, 0.25);
  haze(X, 0xff2a3a, X.rich ? 20 : 13, 0.6, 2.6);

  X.people.push(
    { x: -11.8, z: -3.5, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#2a2a2a' },
    { x: -11.7, z: 3.2, rot: -Math.PI / 2 + 0.3, pose: 'stand', type: 'dress', outfit: '#c02040' },
    { x: -14.35, z: -1, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#1a1a1a', fixed: true },
    { x: 5.6, z: -7.4, rot: 0.4, pose: 'stand', type: 'suit', outfit: '#3a1a1a' },
    { x: 8.8, z: -4.6, rot: 2.6, pose: 'stand', type: 'dress', outfit: '#e0e0e0' },
    { x: 10.8, z: 5.6, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#ff66aa' },
    { x: 10.7, z: 8.5, rot: -Math.PI / 2 - 0.3, pose: 'stand', type: 'suit', outfit: '#1a1a2a' },
    { x: 8.2, z: -10.9, rot: 0, pose: 'dance', type: 'dress', outfit: '#c02040' },
    { x: -9.4, z: -10.6, rot: 0.3, pose: 'stand', type: 'suit', outfit: '#222230' },
  );

  X.fx.push((t, dt, B) => {
    const e = B.pulse;
    lanGlows.forEach((b, i) => b.c.setRGB(1, 0.19, 0.25).multiplyScalar(0.38 + 0.1 * Math.sin(t * 2.3 + i * 1.7)));
    X.signs.set(sOpen.s, flicker(t, 1)); X.glow.set(sOpen.h, 0.5 * flicker(t, 1));
    X.signs.set(sHeart.s, 0.7 + 0.3 * e); X.glow.set(sHeart.h, 0.35 + 0.35 * e);
    X.signs.set(sDen.s, flicker(t, 9));
    X.room.hall.forEach((l, i) => { l.intensity = 24 + Math.sin(t * 0.9 + i * 2) * 5 + (i === 1 ? (flicker(t, 2) - 1) * 14 : 0); });
  });
}

// ------------------------------------------------------------------ High-Roller Suite
function casino(zn, X, h) {
  const { lam, basic, spot, bar } = h, S = zn.scene;
  const felt = (kind) => tex(cnv(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#1f8a4a'); g.addColorStop(1, '#0c4a24');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#e0c060'; c.lineWidth = 3; c.beginPath(); c.arc(128, 128, 104, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(240,220,150,.85)'; c.font = 'bold 15px Georgia'; c.textAlign = 'center';
    if (kind === 'bj') {
      c.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = Math.PI * (0.2 + i * 0.15); c.strokeRect(128 + Math.cos(a) * 80 - 11, 128 + Math.sin(a) * 80 - 15, 22, 30); }
      c.fillText('BLACKJACK PAYS 3 TO 2', 128, 118); c.font = 'bold 11px Georgia'; c.fillText('INSURANCE PAYS 2 TO 1', 128, 140);
    } else {
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#b01020' : '#111'; c.fillRect(70 + (i % 6) * 20, 150 + Math.floor(i / 6) * 22, 19, 21); }
      c.fillStyle = 'rgba(240,220,150,.85)'; c.fillText('ROULETTE', 128, 138);
    }
  }));
  const tableCols = [], chips = [], cards = [], wheels = [];
  const feltBJ = felt('bj'), feltR = felt('r');
  for (let i = 0; i < 4; i++) {
    const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8, rou = i === 1 || i === 2;
    zn.cyl(1.5, 1.5, 0.1, x, 0.85, z, [lam(0x3a1a0a), lam(0xffffff, { map: rou ? feltR : feltBJ }), lam(0x3a1a0a)]);
    zn.cyl(0.25, 0.3, 0.85, x, 0.42, z, lam(0x2a1a0a), true);
    zn.colliders.push({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 });
    spot(x + 0.6, 0.92, z);
    tableCols.push(new THREE.TorusGeometry(1.5, 0.09, 8, 36).rotateX(Math.PI / 2).translate(x, 0.92, z));
    // chips at the players' places, cards in front of the dealer
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const px = x + Math.sin(a + Math.PI) * -1.05, pz = z + Math.cos(a) * 1.05;
      for (let s = 0; s < 3; s++) {
        const n = 2 + Math.floor(Math.random() * 5), col = pickR([0xc02020, 0x202020, 0x1a8a3a, 0x2040c0, 0xf0f0f0, 0xe0b040]);
        chips.push(tint(new THREE.CylinderGeometry(0.06, 0.06, 0.025 * n, 10).translate(px + (s - 1) * 0.14, 0.9 + 0.0125 * n, pz), 1), col);
      }
      if (!rou) cards.push(new THREE.PlaneGeometry(0.12, 0.17).rotateX(-Math.PI / 2).rotateY(rnd(-0.3, 0.3)).translate(x + Math.sin(a) * 0.72, 0.905, z + Math.cos(a) * 0.72));
    }
    if (rou) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.08, 24), new THREE.MeshLambertMaterial({ map: wheelT(), emissive: 0x201008 }));
      w.position.set(x - 0.55, 0.94, z - 0.35); S.add(w); wheels.push(w);
    }
    // a pendant over each table: shade, warm beam, a pool on the felt
    X.cone(new THREE.Vector3(x, 2.85, z), new THREE.Vector3(x, 0.9, z), 1.35, 0xffd890, 0.28);
    X.pool(x, z, 1.7, 0xffe0a0, 0.45, 0.905);
    X.bulb(x, 2.8, z, 0.7, 0xffd890);
  }
  S.add(new THREE.Mesh(mergeGeometries(tableCols), lam(0x2a1206)));
  const shades = mergeGeometries([0, 1, 2, 3].map((i) => new THREE.CylinderGeometry(0.12, 0.38, 0.24, 16, 1, true).translate(-7 + (i % 2) * 8, 3.0, -5 + Math.floor(i / 2) * 8)));
  S.add(new THREE.Mesh(shades, lam(0x0e4a2a, { side: THREE.DoubleSide, emissive: 0x06200f })));
  const chipGeos = chips.filter((x, i) => i % 2 === 0), chipCols = chips.filter((x, i) => i % 2 === 1);
  chipGeos.forEach((g, i) => { const c = C(chipCols[i]); const a = g.attributes.color.array; for (let j = 0; j < a.length; j += 3) { a[j] = c.r; a[j + 1] = c.g; a[j + 2] = c.b; } });
  S.add(new THREE.Mesh(mergeGeometries(chipGeos), new THREE.MeshLambertMaterial({ vertexColors: true })));
  if (cards.length) S.add(new THREE.Mesh(mergeGeometries(cards), basic(0xf4f0e8)));
  // slot machines: the original cabinets, with lit fronts, spinning reels and chasing toppers
  const slotT = tex(cnv(128, 256, (c) => {
    c.fillStyle = '#1a0408'; c.fillRect(0, 0, 128, 256);
    const g = c.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, '#ffe070'); g.addColorStop(1, '#c02020');
    c.fillStyle = g; c.fillRect(6, 4, 116, 36);
    c.fillStyle = '#fff'; c.font = 'bold 30px Impact'; c.textAlign = 'center'; c.fillText('777', 64, 34);
    c.fillStyle = '#e0b040'; c.fillRect(10, 44, 108, 80);
    c.fillStyle = '#ffd84d'; c.font = 'bold 14px Impact'; c.fillText('★ JACKPOT ★', 64, 144);
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#ff3030', '#30ff60', '#3080ff', '#ffd030'][i]; c.beginPath(); c.arc(22 + i * 28, 168, 8, 0, TAU); c.fill(); }
    c.fillStyle = '#0a0204'; c.fillRect(20, 200, 88, 30); c.fillStyle = '#c09a34'; c.fillRect(20, 200, 88, 3);
  }));
  const reelT = tex(cnv(64, 256, (c) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 64, 256);
    const sy = ['7', '♦', 'BAR', '♣', '★', '7', '♥', '$'];
    c.textAlign = 'center'; c.textBaseline = 'middle';
    sy.forEach((s, i) => { c.fillStyle = ['#d01010', '#1060d0', '#111', '#107020', '#e0a000'][i % 5]; c.font = `bold ${s.length > 1 ? 16 : 26}px Impact`; c.fillText(s, 32, i * 32 + 16); });
  }), { repeat: true });
  reelT.repeat.set(3, 0.375);
  const fronts = [], reels = [], slotBulbs = [];
  for (let i = 0; i < 6; i++) {
    const z = -8 + i * 2;
    zn.box(0.9, 1.9, 0.8, -13.6, 0.95, z, lam(0x5a0a18));
    fronts.push(wallQ(-13.14, 0.95, z, 0.78, 1.9, Math.PI / 2));
    reels.push(wallQ(-13.13, 1.29, z, 0.62, 0.56, Math.PI / 2));
    X.pool(-12.6, z, 1.1, 0xffd84d, 0.3);
    X.glow.push(wallQ(-13.12, 1.3, z, 1.3, 2.2, Math.PI / 2), 0xffa040, 0.18);
    for (let k = 0; k < 5; k++) slotBulbs.push(X.bulb(-13.2, 1.96, z - 0.32 + k * 0.16, 0.16, 0xffd84d));
  }
  S.add(new THREE.Mesh(mergeGeometries(fronts), new THREE.MeshBasicMaterial({ map: slotT })));
  S.add(new THREE.Mesh(mergeGeometries(reels), new THREE.MeshBasicMaterial({ map: reelT })));
  // chandelier: gold rings, candle bulbs, twinkling crystal drops, a warm pool below
  const gold = lam(0xc09a34, { emissive: 0x4a3008 });
  S.add(new THREE.Mesh(mergeGeometries([
    new THREE.TorusGeometry(1.0, 0.035, 6, 40).rotateX(Math.PI / 2).translate(0, 2.8, 0),
    new THREE.TorusGeometry(0.6, 0.03, 6, 32).rotateX(Math.PI / 2).translate(0, 3.05, 0),
    new THREE.CylinderGeometry(0.02, 0.02, 0.7).translate(0, 3.1, 0), new THREE.SphereGeometry(0.12, 10, 8).translate(0, 2.72, 0),
  ]), gold));
  const crystals = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; X.bulb(Math.cos(a) * 1.0, 2.9, Math.sin(a) * 1.0, 0.3, 0xffe0a0); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; X.bulb(Math.cos(a) * 0.6, 3.14, Math.sin(a) * 0.6, 0.26, 0xffe0a0); }
  for (let i = 0; i < (X.lite ? 24 : 48); i++) {
    const a = rnd(0, TAU), r = rnd(0.2, 1.0);
    crystals.push(X.bulb(Math.cos(a) * r, rnd(2.35, 2.8), Math.sin(a) * r, 0.12, 0xffffff));
  }
  X.bulb(0, 2.75, 0, 3.2, 0xffc070).c.multiplyScalar(0.35);
  X.pool(0, 0, 3.2, 0xffc070, 0.35);
  X.cone(new THREE.Vector3(0, 2.7, 0), new THREE.Vector3(0, 0, 0), 2.6, 0xffc070, 0.15);
  // the bar and its bartender
  bar(11, 4, 7, true);
  X.pool(11, 4, 3, 0xffc070, 0.2);
  // signage
  const A = X.atlas;
  const sHR = X.sign('N', -8, 2.45, 0.85, A.add(512, 128, (c) => neonText(c, 'HIGH ROLLER', 256, 66, 84, '#ffd84d', { maxW: 480 })), 0xffd84d);
  const hrBulbs = X.bulbFrame('N', -8, 2.45, 4.1, 1.15, 0xffe070);
  X.sign('N', 8, 2.45, 0.75, A.add(512, 110, (c) => neonText(c, 'BLACKJACK', 256, 58, 80, '#ff4d4d', { maxW: 470 })), 0xff4d4d);
  const sJack = X.sign('W', -3, 2.72, 0.75, A.add(512, 128, (c) => { neonText(c, 'JACKPOT', 256, 66, 92, '#ff4d4d', { maxW: 470 }); }), 0xff4d4d, { streak: 0.15 });
  const jpBulbs = X.bulbFrame('W', -3, 2.72, 3.4, 0.95, 0xffe070);
  X.sign('E', 5, 2.6, 0.65, A.add(512, 110, (c) => neonText(c, 'Cocktails', 256, 58, 86, '#fff1c0', { font: SCRIPT, weight: '700', maxW: 480 })), 0xfff1c0);
  X.sign('S', -8, 2.5, 0.8, A.add(384, 110, (c) => neonText(c, 'LUCKY 7', 192, 58, 84, '#ffd84d', { maxW: 360 })), 0xffd84d);
  X.sign('S', 8, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS', 192, 52, 62, '#ff4d4d', { maxW: 360 })), 0xff4d4d);
  haze(X, 0xffc070, X.rich ? 14 : 9);

  // dealers, players, slot players, a bartender
  const TUX = ['#111114', '#1a1a22', '#f0f0f0'], GOWN = ['#b01020', '#e0b040', '#0e6a3a', '#2040a0', '#6a1a6a', '#f0e0d0'];
  for (let i = 0; i < 4; i++) {
    const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8;
    X.people.push({ x, z: z - 1.95, rot: 0, pose: 'deal', type: 'suit', outfit: '#f4f4f4', hairType: 'S', fixed: true });
    for (const a of i % 2 ? [-0.8, 0.5] : [-0.5, 0.8]) {
      const px = x + Math.sin(a) * 1.95, pz = z + Math.cos(a) * 1.95, dress = Math.random() < 0.5;
      X.people.push({ x: px, z: pz, rot: Math.atan2(x - px, z - pz), pose: 'stand', type: dress ? 'dress' : 'suit', outfit: dress ? pickR(GOWN) : pickR(TUX) });
    }
  }
  X.people.push(
    { x: -12.55, z: -8, rot: -Math.PI / 2, pose: 'slot', type: 'dress', outfit: '#e0b040' },
    { x: -12.55, z: -4, rot: -Math.PI / 2, pose: 'slot', type: 'suit', outfit: '#3a3a4a' },
    { x: -12.55, z: 0, rot: -Math.PI / 2, pose: 'slot', type: 'dress', outfit: '#b01020' },
    { x: 9.7, z: 4, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#f0f0f0', fixed: true },
    { x: 12.3, z: 2.4, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#111114' },
    { x: 12.3, z: 6.2, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#0e6a3a' },
  );

  let spin = 0;
  X.fx.push((t, dt, B) => {
    for (const w of wheels) w.rotation.y += dt * 2.2;
    // reels spin for 2 s, rest on a symbol for 3 s
    const cyc = t % 5;
    if (cyc < 2) { spin += dt * 3; reelT.offset.y = spin; } else reelT.offset.y = Math.round(spin * 8) / 8;
    slotBulbs.forEach((b, i) => b.c.setRGB(1, 0.85, 0.3).multiplyScalar((i + Math.floor(t * 8)) % 5 === 0 ? 1 : 0.25));
    hrBulbs.forEach((b, i) => b.c.setRGB(1, 0.88, 0.45).multiplyScalar((i + Math.floor(t * 7)) % 3 === 0 ? 1 : 0.3));
    jpBulbs.forEach((b, i) => b.c.setRGB(1, 0.88, 0.45).multiplyScalar(Math.floor(t * 3) % 2 === i % 2 ? 1 : 0.25));
    crystals.forEach((b, i) => b.c.setScalar(Math.sin(t * 3 + i * 2.7) > 0.8 ? 1 : 0.3));
    X.signs.set(sJack.s, cyc < 2 ? (Math.floor(t * 6) % 2 ? 1 : 0.4) : 1);
    X.glow.set(sHR.h, 0.45 + 0.08 * Math.sin(t * 2));
    X.room.hall.forEach((l, i) => { l.intensity = 26 + Math.sin(t * 0.7 + i) * 3; });
  });
}
function wheelT() {
  return tex(cnv(128, 128, (c) => {
    c.fillStyle = '#3a1a0a'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 36; i++) {
      c.fillStyle = i === 0 ? '#10a040' : i % 2 ? '#b01020' : '#111';
      c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 60, (i / 36) * TAU, ((i + 1) / 36) * TAU); c.closePath(); c.fill();
    }
    c.fillStyle = '#c09a34'; c.beginPath(); c.arc(64, 64, 36, 0, TAU); c.fill();
    c.fillStyle = '#6a3a14'; c.beginPath(); c.arc(64, 64, 30, 0, TAU); c.fill();
    c.fillStyle = '#e0c060'; c.beginPath(); c.arc(64, 64, 8, 0, TAU); c.fill();
  }));
}

// ------------------------------------------------------------------ entry points
/** Furnish a nightlife venue. `h` = the zone's decorating helpers { table, sofa, bar, spot, lam, basic }. */
export function decorateNightlife(zn, k, h) {
  const { table, sofa, bar } = h;
  const X = makeKit(zn, k);
  X.nl = zn.nl = { k, X, bpm: BPM[k] };
  X.room = styleRoom(zn, k);
  if (k !== 'casino') {
    bar(-13, -1, 11, true);
    if (k === 'club') nightclub(zn, X, h);
    if (k === 'gentlemens') gentlemens(zn, X, h);
    if (k === 'redlight') redlight(zn, X, h);
    const sc = k === 'redlight' ? 0x6a1020 : k === 'gentlemens' ? 0x4a1040 : 0x2a1a4a;
    sofa(12, 7, 5, -1, sc);
    sofa(12, -7, 4, -1, sc);
    for (let i = 0; i < 3; i++) table(-5 + i * 5, 7, k === 'gentlemens' ? 0x1a0a0a : 0x2a1a2a);
  } else casino(zn, X, h);
  buildKit(X);
}

/** Per-frame: the beat, the show, the crowd. */
export function updateNightlife(zn, dt) {
  const nl = zn.nl;
  if (!nl || !nl.X) return;
  const X = nl.X, t = zn.t, B = beat(t, nl.bpm);
  for (const f of X.fx) f(t, dt, B);
  if (X.crowd) updateCrowd(X.crowd, zn, t, dt, B);
  if (X.bulbPts) {
    const a = X.bulbPts.geometry.attributes.color, arr = a.array;
    X.bulbs.forEach((b, i) => { arr[i * 3] = b.c.r; arr[i * 3 + 1] = b.c.g; arr[i * 3 + 2] = b.c.b; });
    a.needsUpdate = true;
  }
  X.glow.flush(); X.signs.flush();
  const fl = X.room.follow, hp = zn.hero && zn.hero.position;
  if (hp) fl.position.set(hp.x, 2.6, hp.z + 0.6);
  // points are sized in world units: pixels per unit at distance 1
  if (X.pmat && zn.renderer) X.pmat.uniforms.uScale.value = zn.renderer.domElement.height / (2 * Math.tan((zn.cam.fov * Math.PI) / 360));
}
