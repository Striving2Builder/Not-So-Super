// Supergirl's cape in the three.js flight view: a short tapered sheet (narrow at the collar,
// fanning out into a few deep folds toward a pointed hem, ending about her knees) streaming off a
// spine chain that ripples with speed. It is shaded from its real normals in two hard cel tones
// (outer red / a darker lining on the inside), and inked with a constant-width screen-space line
// round its outline plus two tapering fold strokes, like the body's ink hull. Seen side-on, its
// out-of-plane shape (arch, folds, wave) flattens so it reads as a thin streaming band, not a fin.
import * as THREE from 'three';
import { HERO_LAYER } from './heropass3d.js';
import { LOOK } from './look3d.js';

/**
 * segs × len: the spine (model metres, × her scale); w: half-width at collar / hem; arch: how far
 * the middle stands off her back; folds: pleat depth at the hem (per column, ± = ridge / valley).
 */
const CAPE = {
  segs: 7, len: 0.135, w: [0.075, 0.15], arch: 0.04, fold: 0.022, clear: 0.035, // clear: extra stand-off over her hips toward the hem
  folds: [0, 0.8, -1, 0.6, -1, 0.8, 0], // across the width, + side edge → − side edge
  key: 0.18,  // N·L cut between the lit and shaded tone
  outer: ['#ee2630', '#b8141f'], inner: ['#a01622', '#701018'], // [lit, shade] (sRGB; the outer shade stays bright: at dusk / night it went to a maroon block)
  ink: '#0b0b16', inkW: 2.2, foldFrom: 0.38, // inkW: px like the body's hull; fold strokes start this far down
  sideFlat: 0.55, // how much of the out-of-plane shape goes when seen exactly side-on
  lift: 0.7,      // seen from below at speed, the hem rises off her back by up to this × a segment per row (it shows past her)
  rise: 0.22,     // at speed the cape streams up off her back (× a segment per row), so her body and legs read under it
  billow: [0.55, 1.3], // slow flight: a big slow billow, × a segment / its rate (rad/s), instead of hanging straight down
};
const C = CAPE.folds.length; // columns across the width

/** World-space key light direction (the sun/moon), and its tint on the cape (dark at night). */
export const CAPE_LIGHT = { key: { value: new THREE.Vector3(0, 1, 0) }, tint: { value: new THREE.Color(1, 1, 1) } };

function clothMaterial() {
  const lin = (h) => new THREE.Color(h);
  const U = {
    capeKey: CAPE_LIGHT.key, capeTint: CAPE_LIGHT.tint,
    outLit: { value: lin(CAPE.outer[0]) }, outShade: { value: lin(CAPE.outer[1]) },
    inLit: { value: lin(CAPE.inner[0]) }, inShade: { value: lin(CAPE.inner[1]) },
  };
  // (pulled toward the camera: where it lies on her back, near-ties go to the cape, not to the
  // body's white rim under it, which used to cut a white zigzag through the cloth)
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCapeN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCapeN = mat3(modelMatrix) * normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vCapeN;
uniform vec3 capeKey, capeTint, outLit, outShade, inLit, inShade;`)
      // two hard tones from the real normal (the folds band themselves); the lining is darker, so
      // where the cape flips over you see its inside
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 n = normalize(vCapeN) * (gl_FrontFacing ? 1.0 : -1.0);
  float lit = smoothstep(${(CAPE.key - 0.04).toFixed(2)}, ${(CAPE.key + 0.04).toFixed(2)}, dot(n, capeKey));
  vec3 c = gl_FrontFacing ? mix(outShade, outLit, lit) : mix(inShade, inLit, lit);
  diffuseColor.rgb = c * capeTint; }`);
  };
  m.customProgramCacheKey = () => 'capefly';
  return m;
}

/** Constant-width ink strokes: each path vertex is a pair pushed apart on screen across the path. */
function inkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { res: LOOK.res, dpr: LOOK.dpr, olW: { value: CAPE.inkW }, ink: { value: new THREE.Color(CAPE.ink) } },
    vertexShader: `uniform vec2 res; uniform float dpr, olW;
attribute vec3 aPrev, aNext; attribute float aSide, aW;
vec2 scr(vec4 c) { return c.xy / c.w * res * 0.5; }
void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec2 s = scr(c), sp = scr(mvp * vec4(aPrev, 1.0)), sn = scr(mvp * vec4(aNext, 1.0));
  vec2 d1 = s - sp, d2 = sn - s;
  if (dot(d1, d1) < 1e-6) d1 = d2; if (dot(d2, d2) < 1e-6) d2 = d1;
  d1 = normalize(d1 + 1e-6); d2 = normalize(d2 + 1e-6);
  vec2 t = normalize(d1 + d2 + 1e-6), nrm = vec2(-t.y, t.x);
  float miter = 1.0 / max(0.5, dot(nrm, vec2(-d1.y, d1.x)));
  float w = olW * dpr * aW * miter * clamp(9.0 / c.w, 0.45, 1.0);
  c.xy += nrm * aSide * w * 2.0 / res * c.w;
  gl_Position = c;
}`,
    fragmentShader: 'uniform vec3 ink; void main() { gl_FragColor = vec4(ink, 1.0); }',
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
  });
}

export class FlightCape {
  constructor(scene) {
    const n = CAPE.segs + 1;
    this.n = n;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.placed = false;
    this.eye = new THREE.Vector3(); // the camera (from the last frame she was drawn)
    // the cloth: n rows × C columns
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * C * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * C * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < C - 1; j++) {
      const a = i * C + j, b = a + C; // (front face = her outer side)
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    g.setIndex(idx);
    this.cloth = this.mesh(scene, g, clothMaterial());
    this.cloth.onBeforeRender = (r, s, cam) => this.eye.setFromMatrixPosition(cam.matrixWorld);
    // ink paths (lists of cloth vertex indices): the outline (down one edge, across the hem, up the
    // other) and two fold strokes down the valleys
    const rim = [];
    for (let i = 0; i < n; i++) rim.push(i * C);
    for (let j = 1; j < C; j++) rim.push((n - 1) * C + j);
    for (let i = n - 2; i >= 0; i--) rim.push(i * C + C - 1);
    this.paths = [{ v: rim, w: () => 1 }];
    const i0 = Math.round(CAPE.foldFrom * (n - 1));
    for (const j of [2, 4]) {
      const v = []; for (let i = i0; i < n; i++) v.push(i * C + j);
      this.paths.push({ v, w: (k) => 0.8 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.05 }); // tapers both ends
    }
    const cnt = this.paths.reduce((s, p) => s + p.v.length, 0) * 2;
    const ig = new THREE.BufferGeometry();
    for (const [k, sz] of [['position', 3], ['aPrev', 3], ['aNext', 3]]) ig.setAttribute(k, new THREE.BufferAttribute(new Float32Array(cnt * sz), sz).setUsage(THREE.DynamicDrawUsage));
    const side = new Float32Array(cnt), w = new Float32Array(cnt), ii = [];
    let o = 0;
    for (const p of this.paths) {
      const L = p.v.length;
      for (let k = 0; k < L; k++) {
        side[o + k * 2] = 1; side[o + k * 2 + 1] = -1;
        w[o + k * 2] = w[o + k * 2 + 1] = p.w(k / (L - 1));
        if (k < L - 1) { const a = o + k * 2; ii.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      o += L * 2;
    }
    ig.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    ig.setAttribute('aW', new THREE.BufferAttribute(w, 1));
    ig.setIndex(ii);
    this.ink = this.mesh(scene, ig, inkMaterial());
    this._t = new THREE.Vector3(); this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._v = new THREE.Vector3();
  }

  mesh(scene, g, mat) {
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.layers.set(HERO_LAYER);
    scene.add(m);
    return m;
  }

  /**
   * anchor: world point on her upper back; back/up/side: her body axes (unit); v: airspeed m/s;
   * scale: model → scene metres (× the patrol-view enlargement); whip: boost flutter.
   */
  update(anchor, back, up, side, v, t, dt, scale, whip) {
    const n = this.n, L = CAPE.len * scale;
    const sk = Math.min(1, v / 60), f = 4 + v / 18, amp = (0.08 + 0.22 * sk) * whip * L;
    if (!this.placed) { this.placed = true; for (let i = 0; i < n; i++) this.p[i].copy(anchor).addScaledVector(back, i * L); }
    // seen side-on its depth (arch, folds, flap) flattens: a thin band, not a fin standing off her
    const view = this._v.subVectors(this.eye, anchor);
    const sideOn = this.eye.lengthSq() ? Math.abs(view.normalize().dot(side)) : 0;
    const flat = 1 - CAPE.sideFlat * sideOn * sideOn;
    // from below (the camera under her back's plane) the cape would hide behind her: speed lifts the hem
    const below = this.eye.lengthSq() ? Math.min(1, Math.max(0, -view.dot(up) * 3)) : 0, lift = (CAPE.lift * below + CAPE.rise) * sk * L;
    const slow = 1 - sk, B = CAPE.billow;
    this.p[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      const k = i / (n - 1);
      // around a straight line down her back: an S-wave that travels to the hem (bigger there),
      // a slower sway sideways, and a droop under gravity when she's slow
      const tgt = this._t.copy(anchor).addScaledVector(back, i * L * (0.5 + 0.5 * sk))
        .addScaledVector(up, ((Math.sin(t * f - i * 0.75) + 0.6) * amp + Math.sin(t * 1.7 - i * 0.5) * L * 0.12) * k * flat + lift * i * k
          + (Math.sin(t * B[1] - i * 0.45) + 0.5) * B[0] * L * slow * k * i * 0.5)
        .addScaledVector(side, Math.sin(t * f * 0.55 - i * 0.6) * amp * 0.6 * k + Math.sin(t * B[1] * 0.7 - i * 0.4) * B[0] * L * slow * k * i * 0.3);
      tgt.y -= L * slow * 0.45 * i;
      this.p[i].lerp(tgt, Math.min(1, dt * (8 + v / 6)));
      const d = this._a.subVectors(this.p[i], this.p[i - 1]), len = d.length() || 1; // keep the segment length
      this.p[i].copy(this.p[i - 1]).addScaledVector(d, L / len);
    }
    const pos = this.cloth.geometry.attributes.position;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), q = this.p[i];
      const w = (CAPE.w[0] + (CAPE.w[1] - CAPE.w[0]) * Math.pow(k, 0.75)) * scale;
      // along the spine at the hem: a shallow point (the middle trails the corners)
      const tan = i === n - 1 ? this._b.subVectors(q, this.p[i - 1]).normalize() : null;
      const breathe = 1 + 0.25 * Math.sin(t * f * 0.8 - i * 1.3);
      for (let j = 0; j < C; j++) {
        const u = 1 - (2 * j) / (C - 1), au = Math.abs(u);
        // out of her back: the arch (middle stands off), the folds (deeper toward the hem; the edges
        // curl down), and an out-of-phase flutter on the edges
        const fl = Math.sin(t * 6 - i * 1.1 + u * 1.5) * w * 0.07 * k * au;
        const o = (CAPE.arch * scale * (1 - u * u) + CAPE.clear * scale * Math.min(1, k * 2) + CAPE.folds[j] * CAPE.fold * scale * k * k * breathe - w * (0.08 + 0.16 * k) * au * au + fl) * flat;
        let x = q.x + side.x * w * u + up.x * o, y = q.y + side.y * w * u + up.y * o, z = q.z + side.z * w * u + up.z * o;
        if (tan) { const tip = w * 0.3 * (1 - au * au); x += tan.x * tip; y += tan.y * tip; z += tan.z * tip; }
        pos.setXYZ(i * C + j, x, y, z);
      }
    }
    pos.needsUpdate = true;
    this.cloth.geometry.computeVertexNormals();
    // the ink strokes follow the cloth's vertices
    const ia = this.ink.geometry.attributes, P = pos.array, A = ia.position.array, Pr = ia.aPrev.array, Nx = ia.aNext.array;
    let o = 0;
    for (const p of this.paths) {
      const vv = p.v, Ln = vv.length;
      for (let k = 0; k < Ln; k++) {
        const c = vv[k] * 3, a = vv[Math.max(0, k - 1)] * 3, b = vv[Math.min(Ln - 1, k + 1)] * 3;
        for (let e = 0; e < 2; e++) {
          const d = (o + k * 2 + e) * 3;
          for (let x = 0; x < 3; x++) { A[d + x] = P[c + x]; Pr[d + x] = P[a + x]; Nx[d + x] = P[b + x]; }
        }
      }
      o += Ln * 2;
    }
    ia.position.needsUpdate = ia.aPrev.needsUpdate = ia.aNext.needsUpdate = true;
  }

  set visible(v) { this.ink.visible = this.cloth.visible = v; }
}
