// Street life at canyon level, all on the GPU (static buffers, animated by one time uniform):
// traffic as streams of headlights (coming at you) and tail lights (going away) along every road,
// and steam rising from street vents in the dense districts. Two draw calls for the whole city.
import * as THREE from 'three';
import { BLOCK, ROAD } from './city.js';
import { hash2 } from './rng.js';

/** perLane: cars on a full road; speed m/s; lane: offset × ROAD; far: reach (m, + perAlt × her height); blend: m where tail/head lights melt into one warm glow; glow: max sprite px. */
const TRAFFIC = { perLane: 110, speed: [9, 17], lane: 0.2, far: 900, perAlt: 0.8, blend: [180, 650], glow: 8 };
const STEAM = { districts: ['downtown', 'financial', 'residential', 'entertainment', 'nightclub', 'redlight'], odds: 0.12, puffs: 6, far: 650 };
const BODY = ['#e8e8e8', '#222', '#c22', '#2a5ac8', '#f2c21a', '#3a8a4a', '#888'];

export class Street {
  /** extra: elevated lanes [{a:[x,z], b:[x,z], y, lanes, w}] (bridges, highway), metres. */
  constructor(city, scene, U, M, extra = []) {
    this.scene = scene;
    // ---- traffic
    const seg = [], car = [], body = [], ys = [], c = new THREE.Color();
    const roads = [];
    for (let iy = 0; iy <= city.rows; iy++) { const z = (iy * BLOCK + ROAD / 2) * M; roads.push([0, z, city.coastX * M, z]); }
    for (let ix = 0; ix <= city.landCols; ix++) { const x = (ix * BLOCK + ROAD / 2) * M; roads.push([x, 0, x, city.H * M]); }
    const off = ROAD * TRAFFIC.lane * M;
    const lanes = roads.map((r) => ({ r, y: 0.9, lanes: [-1, 1].map((l) => l * off) }));
    for (const e of extra) lanes.push({ r: [...e.a, ...e.b], y: e.y, lanes: e.lanes === 4 ? [-0.75, -0.3, 0.3, 0.75].map((k) => k * e.w) : [-0.4 * e.w, 0.4 * e.w], dense: e.lanes === 4 ? 1.6 : 0.6 });
    lanes.forEach(({ r: [ax, az, bx, bz], y, lanes: L, dense = 1 }, r) => {
      const vert = Math.abs(ax - bx) < Math.abs(az - bz), n = Math.round(TRAFFIC.perLane * dense * Math.hypot(bx - ax, bz - az) / 3600);
      for (const lo of L) {
        const lane = lo > 0 ? 1 : -1, loff = Math.abs(lo);
        // each lane drives one way; offset to its own side of the road
        const ox = vert ? lane * loff : 0, oz = vert ? 0 : lane * loff;
        const A = lane > 0 ? [ax + ox, az + oz, bx + ox, bz + oz] : [bx + ox, bz + oz, ax + ox, az + oz];
        for (let k = 0; k < n; k++) {
          const h = hash2(r, k, Math.round(lo * 10) + 5);
          seg.push(...A); ys.push(y);
          car.push(h, TRAFFIC.speed[0] + (TRAFFIC.speed[1] - TRAFFIC.speed[0]) * hash2(k, r, 9));
          c.set(BODY[(h * 977 | 0) % BODY.length]); body.push(c.r, c.g, c.b);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(car.length / 2 * 3), 3));
    g.setAttribute('aSeg', new THREE.Float32BufferAttribute(seg, 4));
    g.setAttribute('aCar', new THREE.Float32BufferAttribute(car, 2));
    g.setAttribute('aBody', new THREE.Float32BufferAttribute(body, 3));
    g.setAttribute('aY', new THREE.Float32BufferAttribute(ys, 1));
    // lights stay visible further from higher up (the avenue grid reads from high patrol)
    const TU = { uTime: U.uTime, uNight: U.uNight, res: U.res, uHazeCol: U.uHazeCol, uHazeFar: U.uHazeFar, uReach: { value: TRAFFIC.far } };
    this.TU = TU;
    this.cars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: TU, transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: /* glsl */`
attribute vec4 aSeg; attribute vec2 aCar; attribute vec3 aBody; attribute float aY;
uniform float uTime; uniform float uNight; uniform vec2 res; uniform float uHazeFar; uniform float uReach;
varying vec3 vC; varying float vA; varying vec4 vSeg; varying float vR;
void main() {
  vec2 A = aSeg.xy, B = aSeg.zw; float len = length(B - A);
  vec2 dir = (B - A) / len;
  vec2 p = mix(A, B, fract(aCar.x + uTime * aCar.y / len));
  vec3 wp = vec3(p.x, aY, p.y);
  vec4 mv = viewMatrix * vec4(wp, 1.);
  float d = -mv.z;
  vec4 c0 = projectionMatrix * mv;
  float head = step(0., dot(B - A, cameraPosition.xz - p));
  // far off, tail and head lights melt into one warm glow (red/white alternating along a road read
  // as dashed border lines from altitude)
  float far = smoothstep(${TRAFFIC.blend[0]}., ${TRAFFIC.blend[1]}., d);
  vec3 light = mix(mix(vec3(1.0, 0.12, 0.06), vec3(1.0, 0.9, 0.7), head), vec3(1.0, 0.6, 0.3), far * 0.75);
  float nk = smoothstep(0.15, 0.5, uNight);
  vC = mix(aBody * 0.8, light * 1.2, nk);
  // the car's true size on screen: below the minimum sprite it fades by coverage instead of
  // speckling the far ground with whole-pixel dots
  float px = 2.6 * projectionMatrix[1][1] * res.y * 0.5 / max(d, 1.);
  float base = clamp(px, 2., ${TRAFFIC.glow}.);
  vA = (1. - smoothstep(uReach * 0.6, uReach, d)) * (1. - smoothstep(uHazeFar * 0.4, uHazeFar * 0.75, d)) * clamp(px / 2., 0.12, 1.) * mix(1., 0.6, far * nk);
  // night: a long-exposure light streak trailing each car (~1.3 s of travel), so the
  // streets read as rivers of light from the air; by day a plain dot of body colour
  vec4 c1 = projectionMatrix * viewMatrix * vec4(wp - vec3(dir.x, 0., dir.y) * aCar.y * 1.3, 1.);
  vec2 s0 = c0.xy / c0.w * 0.5 * res, s1 = c1.w > 0.5 ? c1.xy / c1.w * 0.5 * res : s0;
  vec2 seg = (s1 - s0) * nk;
  float sl = min(length(seg), mix(56., 12., far));
  seg = sl > 0.01 ? normalize(seg) * sl : vec2(0.);
  float size = base + sl;
  gl_Position = vec4((s0 + seg * 0.5) / (0.5 * res) * c0.w, c0.z, c0.w);
  // the streak in sprite units (gl_PointCoord runs y-down): head end, tail end; radius
  vec2 h = seg * 0.5 / size;
  vSeg = vec4(-h.x, h.y, h.x, -h.y);
  vR = base * 0.5 / size;
  gl_PointSize = vA <= 0. ? 0. : size;
}`,
      fragmentShader: /* glsl */`
uniform float uNight;
varying vec3 vC; varying float vA; varying vec4 vSeg; varying float vR;
void main() {
  vec2 q = gl_PointCoord - 0.5, a = vSeg.xy, ab = vSeg.zw - vSeg.xy;
  float t = clamp(dot(q - a, ab) / max(dot(ab, ab), 1e-6), 0., 1.);
  float r = length(q - a - ab * t) / vR;
  float k = max(0., 1. - r * r);
  float al = k * k * vA * (1. - t) * (1. - 0.5 * t); // a soft core, bright at the car, dying away along the trail
  if (al < 0.01) discard;
  // premultiplied: light adds at night (a glow, never an opaque red bar), body-colour dots by day
  gl_FragColor = vec4(vC * al, al * (1. - smoothstep(0.15, 0.5, uNight)));
}`,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.cars.frustumCulled = false;
    this.cars.renderOrder = 2;
    scene.add(this.cars);
    // ---- steam vents
    const vp = [], vph = [];
    for (const blk of city.blocks) {
      if (!STEAM.districts.includes(blk.d) || hash2(blk.bx, blk.by, 61) > STEAM.odds * 3) continue;
      const x = (blk.bx * BLOCK + ROAD * (0.3 + 0.4 * hash2(blk.bx, blk.by, 62))) * M, z = (blk.by * BLOCK + BLOCK * hash2(blk.bx, blk.by, 63)) * M;
      for (let k = 0; k < STEAM.puffs; k++) { vp.push(x, 0, z); vph.push(k / STEAM.puffs + hash2(blk.bx, k, 64) * 0.1); }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    sg.setAttribute('aPhase', new THREE.Float32BufferAttribute(vph, 1));
    this.steam = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: TU, transparent: true, depthWrite: false,
      vertexShader: /* glsl */`
attribute float aPhase;
uniform float uTime; uniform vec2 res; uniform float uHazeFar;
varying float vA; varying float vT;
void main() {
  float t = fract(aPhase + uTime * 0.22);
  vec3 wp = position + vec3(sin(t * 3. + aPhase * 6.) * 1.5 * t, 0.6 + t * 15., cos(t * 2. + aPhase * 4.) * t);
  vec4 mv = viewMatrix * vec4(wp, 1.);
  float d = -mv.z;
  gl_Position = projectionMatrix * mv;
  vT = t;
  vA = (1. - t) * smoothstep(0., 0.15, t) * 0.55 * (1. - smoothstep(${STEAM.far * 0.6}., ${STEAM.far}., d)) * (1. - smoothstep(uHazeFar * 0.2, uHazeFar * 0.45, d));
  gl_PointSize = vA <= 0. ? 0. : min(260., (2.5 + t * 8.) * projectionMatrix[1][1] * res.y * 0.5 / max(d, 1.));
}`,
      fragmentShader: /* glsl */`
uniform vec3 uHazeCol; uniform float uNight;
varying float vA; varying float vT;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, r) * vA;
  if (a < 0.02) discard;
  // comic steam: a flat cloud colour with an ink-ish darker rim, lit by the street at night
  vec3 c = mix(vec3(0.92, 0.9, 0.88), vec3(0.75, 0.6, 0.65), uNight);
  c = mix(c * 0.6, c, smoothstep(0.42, 0.3, r));
  gl_FragColor = vec4(mix(c, uHazeCol, vT * 0.3), a);
}`,
    }));
    this.steam.frustumCulled = false;
    this.steam.renderOrder = 3;
    scene.add(this.steam);
  }

  update(cam) { this.TU.uReach.value = TRAFFIC.far + Math.max(0, cam.position.y) * TRAFFIC.perAlt; }
}
