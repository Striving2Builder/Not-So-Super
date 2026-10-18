// Incident beacons in the 3D flight: a vertical shaft of light over every incident, a pulsing ring
// on the ground at its foot, and a faint ghost of the shaft wherever a tower stands in front of it
// (so a beacon behind the skyline still says where it is). All of them in one geometry, drawn twice:
// the lit pass (depth-tested) and the ghost pass (only where something is in front of it).
//
// The shaft is a quad that turns about its own vertical axis to face the camera (never leans): a
// hot core in a coloured glow, light pulses climbing it, a flare at its foot, a soft ink fringe so
// it reads against a bright day sky too. Its width never drops under a few screen pixels, however
// far off. The incident in DIVE range and the waypoint's target get a bolder shaft.
import * as THREE from 'three';
import { M } from './city3d.js';

export const BEACON = {
  height: 650,     // m: tall enough to stand above the cruise band on the horizon
  width: 9,        // m, up close
  minPx: 16,       // css px: the narrowest a shaft gets on screen, however far off
  bold: 1.45,      // × width for the near / waypoint incident
  ring: 46,        // m: the ground ring's radius
  alpha: 1,
  ghost: 0.32,     // the shaft's alpha where a tower is in front of it
  max: 24,
};

const VS = `attribute vec3 base; attribute vec3 bcol; attribute float bw; attribute float bold; attribute float kind;
uniform float hgt; uniform float ringR;
varying vec2 vQ; varying vec3 vCol; varying float vKind; varying float vBold; varying float vNear;
void main() {
  vec3 p; vNear = 1.0;
  if (kind < 0.5) {
    vec3 to = cameraPosition - base; to.y = 0.0;
    vec3 right = normalize(vec3(to.z, 0.0, -to.x) + 1e-5);
    vQ = vec2(position.x * 2.0, position.y / hgt);
    vNear = mix(0.35, 1.0, smoothstep(30.0, 150.0, length(to))); // (eases off as the camera closes in: no wall of light)
    p = base + right * position.x * bw + vec3(0.0, position.y, 0.0);
  } else {
    vQ = position.xz * 2.0;
    p = base + vec3(position.x, 0.0, position.z) * ringR * 2.0 * (1.0 + 0.35 * bold) + vec3(0.0, 0.8, 0.0);
  }
  vCol = bcol; vKind = kind; vBold = bold;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const FS = `uniform float alpha; uniform float time; uniform float day; uniform float ghost;
varying vec2 vQ; varying vec3 vCol; varying float vKind; varying float vBold; varying float vNear;
void main() {
  float seed = vCol.r * 7.0 + vCol.g * 3.0;
  if (vKind > 0.5) {
    // the ground ring: a rim, a soft disc, and a wave rolling outward from the middle
    if (ghost > 0.5) discard;
    float r = length(vQ);
    if (r > 1.0) discard;
    float ph = fract(time * 0.55 + seed);
    float wave = exp(-pow((r - ph) * 10.0, 2.0)) * (1.0 - ph);
    float rim = exp(-pow((r - 0.9) * 16.0, 2.0)) * 0.8;
    float disc = (1.0 - r) * 0.3;
    float a = clamp(wave + rim + disc, 0.0, 1.0) * alpha * (0.8 + 0.2 * vBold);
    gl_FragColor = vec4(mix(vCol, vec3(1.0), wave * 0.6), a);
    return;
  }
  float x = vQ.x, y = vQ.y;
  float core = exp(-x * x * 22.0) * (1.0 + 0.4 * vBold), glow = exp(-x * x * 4.5) * 0.6;
  float up = pow(1.0 - y, 1.15) * smoothstep(0.0, 0.01, y);
  float foot = exp(-y * 28.0) * exp(-x * x * 2.5) * 0.7;
  // bright pulses climbing the shaft
  float rise = pow(0.5 + 0.5 * sin(y * 11.0 - time * 3.2 + seed), 8.0);
  float pulse = 0.78 + 0.55 * rise;
  float a = (core + glow) * up * pulse + foot;
  // a soft ink fringe each side: lost against the night sky, it keeps the shaft crisp against a day one
  float ink = exp(-pow((abs(x) - 0.62) * 7.0, 2.0)) * up * day * 0.55;
  vec3 c = mix(vCol, vec3(1.0), clamp(core / (core + glow + 1e-4), 0.0, 1.0) * 0.75 + rise * 0.15);
  c = mix(c, vec3(0.04, 0.04, 0.09), clamp(ink / (a + ink + 1e-4), 0.0, 1.0));
  a = clamp(max(a, ink), 0.0, 1.0) * vNear * (ghost > 0.5 ? ${BEACON.ghost.toFixed(2)} : alpha);
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
}`;

const _c = new THREE.Color();

// The signal at the top of each beacon, bat-signal style: a glowing searchlight disc in the
// incident's colour with its glyph knocked out of it as an ink silhouette. Baked once per glyph and
// colour (the emoji glyphs too: drawn, then filled with ink, so every one reads as a silhouette).
const SIG = { size: 192, disc: 60, ink: '#0b0b16' };
const sprites = new Map();
const glyphOf = (z, locked) => (locked ? '🔒' : z.glyph === 'F' ? '🔥' : z.glyph === 'B' ? '☠' : z.glyph || '!');

/** The baked signal for an incident: a canvas SIG.size square, its disc SIG.disc px in radius. */
export function signalSprite(z, locked) {
  const glyph = glyphOf(z, locked), color = locked ? '#7a7a86' : z.color || '#ffd23f', key = glyph + color;
  let cv = sprites.get(key);
  if (cv) return cv;
  const S = SIG.size, R = SIG.disc, c = S / 2;
  cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  // the light spilling round it
  let g = ctx.createRadialGradient(c, c, R * 0.8, c, c, c);
  g.addColorStop(0, hexA(color, 0.55)); g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // the lit disc: white-hot in the middle, the incident's colour at the edge
  g = ctx.createRadialGradient(c, c - R * 0.15, R * 0.1, c, c, R);
  g.addColorStop(0, '#fffdf0'); g.addColorStop(0.55, mixHex(color, '#ffffff', 0.45)); g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = SIG.ink; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = hexA(color, 0.8); ctx.beginPath(); ctx.arc(c, c, R + 8, 0, Math.PI * 2); ctx.stroke();
  // the glyph as a silhouette in the light
  const gc = document.createElement('canvas'); gc.width = gc.height = S;
  const gx = gc.getContext('2d');
  gx.font = `900 ${Math.round(R * (glyph.length > 1 && !/\p{Extended_Pictographic}/u.test(glyph) ? 0.95 : 1.25))}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  gx.textAlign = 'center'; gx.textBaseline = 'middle';
  gx.fillStyle = '#fff'; gx.fillText(glyph, c, c + R * 0.06);
  gx.globalCompositeOperation = 'source-in'; gx.fillStyle = SIG.ink; gx.fillRect(0, 0, S, S);
  ctx.drawImage(gc, 0, 0);
  sprites.set(key, cv);
  return cv;
}
export const SIGNAL_DISC = SIG.disc / SIG.size; // the disc's radius as a fraction of the sprite

// (canvas colours: parsed by hand, THREE.Color would hand back linear values)
const rgb = (hex) => { let h = hex.replace('#', ''); if (h.length === 3) h = [...h].map((q) => q + q).join(''); const n = parseInt(h.slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function hexA(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mixHex(a, b, k) { const p = rgb(a), q = rgb(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * k)).join(',')})`; }

export class Beacons3D {
  constructor() { this.scene = null; }

  /** Build the geometry and both passes into `scene` (again, if the flight rebuilt its scene). */
  build(scene) {
    this.dispose();
    const B = BEACON, N = B.max, g = new THREE.BufferGeometry(), pos = [], kind = [], idx = [];
    for (let i = 0; i < N; i++) {
      const o = i * 8; // 4 for the shaft, 4 for the ring
      pos.push(-0.5, 0, 0, 0.5, 0, 0, 0.5, B.height, 0, -0.5, B.height, 0);
      pos.push(-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5);
      kind.push(0, 0, 0, 0, 1, 1, 1, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3, o + 4, o + 5, o + 6, o + 4, o + 6, o + 7);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
    for (const [k, n] of [['base', 3], ['bcol', 3], ['bw', 1], ['bold', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * 8 * n), n).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    const uniforms = { alpha: { value: B.alpha }, time: { value: 0 }, hgt: { value: B.height }, ringR: { value: B.ring }, day: { value: 0 }, ghost: { value: 0 } };
    const mat = (ghost) => new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ghost: { value: ghost ? 1 : 0 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      depthFunc: ghost ? THREE.GreaterDepth : THREE.LessEqualDepth,
    });
    this.geo = g;
    this.lit = new THREE.Mesh(g, mat(false));
    this.ghost = new THREE.Mesh(g, mat(true));
    for (const m of [this.ghost, this.lit]) { m.frustumCulled = false; scene.add(m); } // (placed in the vertex shader)
    this.ghost.renderOrder = 5; this.lit.renderOrder = 6;
    this.scene = scene;
  }

  /**
   * This frame's beacons. zones: the incidents ({x, y, color} in world units); bold: the ones to
   * draw bolder (in DIVE range, the waypoint's target); cam: the flight camera; H: css px high.
   */
  sync(scene, zones, bold, cam, H, t, night) {
    if (this.scene !== scene) this.build(scene);
    const B = BEACON, N = B.max, g = this.geo, cp = cam.position;
    const base = g.attributes.base, col = g.attributes.bcol, bw = g.attributes.bw, bo = g.attributes.bold;
    const ppm = H / (2 * Math.tan((cam.fov * Math.PI) / 360)); // css px per metre, at 1 m
    let i = 0;
    for (const z of zones) {
      if (i >= N) break;
      const x = z.x * M, y = z.y * M, d = Math.hypot(x - cp.x, y - cp.z), b = bold.includes(z) ? 1 : 0;
      const w = Math.max(B.width, (B.minPx * d) / ppm) * (b ? B.bold : 1);
      _c.set(z.color || '#ffd23f');
      for (let k = 0; k < 8; k++) {
        const v = i * 8 + k;
        base.setXYZ(v, x, 0, y); col.setXYZ(v, _c.r, _c.g, _c.b); bw.setX(v, w); bo.setX(v, b);
      }
      i++;
    }
    g.setDrawRange(0, i * 12);
    base.needsUpdate = col.needsUpdate = bw.needsUpdate = bo.needsUpdate = true;
    for (const m of [this.lit, this.ghost]) { const u = m.material.uniforms; u.time.value = t; u.day.value = 1 - night; }
  }

  dispose() {
    if (!this.geo) return;
    for (const m of [this.lit, this.ghost]) { m.parent?.remove(m); m.material.dispose(); }
    this.geo.dispose();
    this.geo = this.lit = this.ghost = this.scene = null;
  }
}
