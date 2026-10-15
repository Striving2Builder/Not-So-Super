// The hall floor's finish (round 11 L2a; critic L-1: "the black void floor covers 30-40% of every
// frame", "the downed bouncer floats"):
// - an LED-tile grid over the whole hall: one canvas texture, the grout lit in the show's two
//   colours, pulsing on the beat, with a ring rolling out from the booth each beat (one draw);
// - soft light pools under the lighting rigs, breathing with the beat (in the kit's glow batch: no
//   draw of their own);
// - blob contact shadows under everyone: the crowd, her, the bouncers and the cast; a bouncer she
//   drops lies in a long one (one instanced draw).
// buildFloor() runs before buildKit(X) (its pools go into the glow batch); the step runs per frame.
import * as THREE from 'three';
import { cnv, tex, floorQ, TAU } from '../nlkit.js';
import { floorY } from './plan.js';
import { quality } from '../settings.js';

const TILE = 0.75;            // metres per LED tile (the texture holds 4 × 4)
const LED = { base: 0.1, beat: 0.22, ring: 0.42, wave: 15, danceK: 0.25 }; // grout glow: idle, on the beat, the ring; ring metres per beat; how much shows over the dance floor
const SHADOW = { r: 0.34, a: 0.62, actors: 48 };

/** The tile sheet: grout lines in red, a bevel in green, a halftone dot in blue (the shader mixes them). */
function ledCanvas() {
  return cnv(256, 256, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 64, y = j * 64;
      // grout: a hot line with a soft spill either side
      c.fillStyle = 'rgba(255,0,0,0.35)'; c.fillRect(x, y, 64, 5); c.fillRect(x, y, 5, 64);
      c.fillStyle = 'rgba(255,0,0,1)'; c.fillRect(x + 1, y + 1, 62, 2); c.fillRect(x + 1, y + 1, 2, 62);
      // bevel: the tile's top-left edges catch the light
      const g = c.createLinearGradient(x + 3, y + 3, x + 30, y + 30);
      g.addColorStop(0, 'rgba(0,255,0,0.9)'); g.addColorStop(1, 'rgba(0,255,0,0)');
      c.fillStyle = g; c.fillRect(x + 3, y + 3, 58, 58);
      // a halftone dot pattern in each tile (the comic look on the floor)
      c.fillStyle = 'rgba(0,0,255,1)';
      for (let u = 0; u < 4; u++) for (let v = 0; v < 4; v++) { c.beginPath(); c.arc(x + 14 + u * 12, y + 14 + v * 12, 2.2 - (u + v) * 0.18, 0, TAU); c.fill(); }
    }
  });
}

function ledMat(plan) {
  const V = plan.V, F = V.floor, map = tex(ledCanvas(), { repeat: true });
  map.colorSpace = THREE.NoColorSpace; // (a mask, not a colour)
  map.anisotropy = 4;
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: {
      map: { value: map }, cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, pulse: { value: 0 }, wave: { value: 0 }, k: { value: 1 },
      wc: { value: new THREE.Vector2(V.booth.x, V.booth.z) }, dance: { value: new THREE.Vector4(F.x, F.z, F.w / 2, F.d / 2) }, fogN: { value: 18 }, fogF: { value: 60 },
    },
    vertexShader: `varying vec2 vW; varying float vD;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  vec4 mv = viewMatrix * wp; vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `uniform sampler2D map; uniform vec3 cA, cB; uniform float pulse, wave, k, fogN, fogF; uniform vec2 wc; uniform vec4 dance;
varying vec2 vW; varying float vD;
void main(){
  vec3 t = texture2D(map, vW / ${(TILE * 4).toFixed(2)}).rgb;
  float r = length(vW - wc), ring = exp(-pow((r - wave) * 0.9, 2.0)) * (1.0 - smoothstep(10.0, 34.0, r));
  vec3 col = mix(cA, cB, 0.5 + 0.5 * sin(vW.x * 0.22 + vW.y * 0.13 + wave * 0.1));
  float g = t.r * (${LED.base} + ${LED.beat} * pulse + ${LED.ring} * ring) + t.g * (0.035 + 0.05 * pulse) + t.b * (0.02 + 0.1 * ring);
  vec2 q = abs(vW - dance.xy) - dance.zw;
  g *= mix(1.0, ${LED.danceK}, step(max(q.x, q.y), 0.0)); // (the dance floor keeps its own LED show)
  gl_FragColor = vec4(col * g * k * (1.0 - smoothstep(fogN, fogF, vD)), 1.0);
}`,
  });
}

/** Contact shadows: instanced quads, each a soft dark ellipse (iS: x, y, z, radius; iD: axis x, z, half-length, strength). */
function shadowMesh(n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  const iS = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iD = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iS', iS); g.setAttribute('iD', iD);
  g.instanceCount = 0;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { fogN: { value: 18 }, fogF: { value: 70 } },
    side: THREE.DoubleSide,
    vertexShader: `attribute vec4 iS; attribute vec4 iD; uniform float fogN, fogF; varying vec2 vQ; varying float vA;
void main(){
  vec2 a = length(iD.xy) > 0.01 ? normalize(iD.xy) : vec2(1.0, 0.0), b = vec2(-a.y, a.x);
  float L = max(iD.z, iS.w);
  vec2 xz = iS.xz + a * position.x * L + b * position.z * iS.w;
  vQ = position.xz;
  vec4 mv = viewMatrix * vec4(xz.x, iS.y + 0.03, xz.y, 1.0);
  vA = iD.w * (1.0 - smoothstep(fogN, fogF, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `varying vec2 vQ; varying float vA;
void main(){
  float a = (1.0 - smoothstep(0.25, 1.0, length(vQ))) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.015, a);
}`,
  }));
  m.frustumCulled = false; m.renderOrder = 2; m.name = 'c3-shadows';
  m.userData = { iS, iD, n };
  return m;
}

/**
 * The floor's finish for the main hall. Returns step(t, dt, B, drop, colA, colB) for the frame
 * (B = the beat clock; colA/colB = the show's two colours).
 */
export function buildFloor(zn, plan, X) {
  const V = plan.V, F = V.floor, S = zn.scene, hw = V.hw, hd = V.hd, saver = quality().id === 'saver';
  // the LED grid: the hall's floor again (the Pit's bowl too), a hair above it
  const g = new THREE.PlaneGeometry(hw * 2, hd * 2, V.pit ? Math.round(hw * 1.6) : 1, V.pit ? Math.round(hd * 1.6) : 1).rotateX(-Math.PI / 2);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, floorY(plan, P.getX(i), P.getZ(i)) + 0.008);
  const led = new THREE.Mesh(g, ledMat(plan));
  led.frustumCulled = false; led.renderOrder = 0; led.name = 'c3-led';
  S.add(led);
  // light pools under the rigs round the dance floor and under the two wash lights (glow batch)
  const pools = [];
  const cols = [V.accent[0], V.accent[1], 0xffe14d, 0x9d4dff, 0x27e0ff, 0xff6a3d];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5, x = F.x + Math.cos(a) * F.w * 0.5, z = F.z + Math.sin(a) * F.d * 0.5;
    if (Math.abs(x) > hw - 1.5 || Math.abs(z) > hd - 1.5) continue;
    pools.push({ e: X.glow.push(floorQ(x, z, 5, 5, floorY(plan, x, z) + 0.03), cols[i], 0.3), ph: i * 0.9, k: 0.3 });
  }
  for (const s of [-1, 1]) {
    const x = s * Math.min(12, hw * 0.45), z = F.z + F.d * 0.3;
    pools.push({ e: X.glow.push(floorQ(x, z, 8, 8, floorY(plan, x, z) + 0.031), V.accent[s > 0 ? 1 : 0], 0.22), ph: s, k: 0.22 });
  }
  let sh = null;
  const up = new THREE.Vector3();
  return (t, dt, B, drop, cA, cB) => {
    const U = led.material.uniforms;
    U.cA.value.copy(cA); U.cB.value.copy(cB);
    U.pulse.value = drop ? 1 : B.pulse;
    U.wave.value = (B.b % 1) * LED.wave;
    U.k.value = zn.xray ? 0.25 : 1;
    if (zn.scene.fog) { U.fogN.value = zn.scene.fog.near * 0.6; U.fogF.value = zn.scene.fog.far * 0.7; }
    if (X.glow.col) for (const p of pools) X.glow.set(p.e, p.k * (0.7 + 0.5 * B.pulse + 0.15 * Math.sin(t * 0.7 + p.ph)));
    // the contact shadows (once the crowd exists)
    const cr = zn.crowd;
    if (!cr) return;
    if (!sh) { sh = shadowMesh(cr.people.length + SHADOW.actors); S.add(sh); }
    const { iS, iD, n } = sh.userData, s = iS.array, d = iD.array;
    let k = 0;
    const put = (x, y, z, r, ax, az, len, a) => {
      if (k >= n) return;
      s[k * 4] = x; s[k * 4 + 1] = y; s[k * 4 + 2] = z; s[k * 4 + 3] = r;
      d[k * 4] = ax; d[k * 4 + 1] = az; d[k * 4 + 2] = len; d[k * 4 + 3] = a;
      k++;
    };
    const far = saver ? 22 : 40, cam = zn.cam.position;
    for (const p of cr.people) {
      if (p.hx > 1e3 || (Math.abs(p.x - cam.x) > far || Math.abs(p.z - cam.z) > far)) continue;
      put(p.x, p.gy ?? p.fy ?? 0, p.z, SHADOW.r * (p.s || 1) * (p.pose === 'sit' ? 1.5 : 1), 0, 0, 0, SHADOW.a);
    }
    // her (lighter the higher she is), the bouncers (a long one lying down), the cast
    const actor = (m, r, a = SHADOW.a) => {
      if (!m || !m.visible) return;
      const p = m.position;
      up.setFromMatrixColumn(m.matrixWorld, 1).normalize();
      if (Math.abs(up.y) < 0.5) {
        const L = Math.hypot(up.x, up.z) || 1;
        put(p.x + (up.x / L) * 0.85, p.y - 0.15, p.z + (up.z / L) * 0.85, r * 1.1, up.x, up.z, 1.05, a);
      } else put(p.x, p.y, p.z, r, 0, 0, 0, a);
    };
    const h = zn.hero;
    if (h) {
      const gy = floorY(plan, h.position.x, h.position.z), lift = Math.max(0, h.position.y - gy);
      put(h.position.x, gy, h.position.z, 0.38 * (1 + lift * 0.3), 0, 0, 0, SHADOW.a * Math.max(0, 1 - lift / 2.5));
    }
    for (const gd of zn.guards || []) actor(gd.mesh, 0.44);
    for (const m of zn.npcs || []) actor(m, 0.36);
    iS.needsUpdate = true; iD.needsUpdate = true;
    sh.geometry.instanceCount = k;
  };
}
