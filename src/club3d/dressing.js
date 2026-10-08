// The hall's dressing and atmosphere (docs/design/nightclub.md "Look and feel"): truss towers round
// the dance floor with par cans, speaker stacks either side of the video wall (their cones thump on
// the kick), neon art beside it, and the atmosphere every tier gets (the phones have no haze puffs):
// the video wall's reflection in the glossy floor, a low mist the crowd stands in, the stage's glow
// rising behind them, and light shafts from the towers chasing the beat.
import * as THREE from 'three';
import { cnv, tex, Batch, uvRect, wallQ, coneGeo, aimMatrix, neonPath, neonText, heartPath, boltPath, glassPath, SCRIPT } from '../nlkit.js';
import { toon } from '../look3d.js';
import { quality } from '../settings.js';
import { reflectMat } from './video.js';
import { floorY } from './plan.js';

const SEC = 0.4;          // the truss towers' section (m)

// ------------------------------------------------------------------ textures
let lattice = null, cone = null, mist = null;
/** A box truss's side: two chords and the zigzag between (alpha-tested, so the far side shows through). */
function latticeTex() {
  return (lattice = lattice || tex(cnv(64, 64, (c) => {
    c.strokeStyle = '#9a9aa8'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(0, 4); c.lineTo(64, 4); c.moveTo(0, 60); c.lineTo(64, 60); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.moveTo(0, 60); c.lineTo(32, 4); c.lineTo(64, 60); c.stroke();
  }), { repeat: true }));
}
/** A speaker cone: surround, cone rings, dust cap. */
function coneTex() {
  return (cone = cone || tex(cnv(128, 128, (c) => {
    const ring = (r, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(64, 64, r, 0, Math.PI * 2); c.stroke(); };
    c.fillStyle = '#0c0b10'; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
    ring(58, '#2a2a34', 6); ring(44, '#1a1a22', 3); ring(32, '#22222c', 2);
    const g = c.createRadialGradient(56, 56, 2, 64, 64, 18); g.addColorStop(0, '#5a5a68'); g.addColorStop(1, '#14141a');
    c.fillStyle = g; c.beginPath(); c.arc(64, 64, 16, 0, Math.PI * 2); c.fill();
  })));
}
/** Soft tileable blobs for the mist. */
function mistTex() {
  if (mist) return mist;
  mist = tex(cnv(128, 128, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 128, y = Math.random() * 128, r = 14 + Math.random() * 30, a = 0.25 + Math.random() * 0.35;
      for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) {
        const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }), { repeat: true });
  return mist;
}

/** Additive shader quads: the mist (scrolling blobs) and the stage glow (a gradient up from the floor). */
function fxMat(kind) {
  const U = { cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, k: { value: 0 }, t: { value: 0 }, T: { value: mistTex() } };
  const body = kind === 'mist'
    ? `float a = texture2D(T, vUv * vec2(3.0, 2.2) + vec2(t * 0.011, t * 0.006)).r;
  float b = texture2D(T, vUv * vec2(2.1, 1.7) - vec2(t * 0.008, -t * 0.004)).r;
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  vec3 c = mix(cA, cB, b) * a * (0.55 + 0.45 * b) * edge * k;`
    : `float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
  vec3 c = mix(cA, cB, vUv.x) * pow(1.0 - vUv.y, 3.0) * edge * k;`;
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D T; uniform vec3 cA, cB; uniform float k, t; varying vec2 vUv;
void main(){
  ${body}
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
}

/** A truss beam along x (or z): its lattice repeats along the length. */
function beamGeo(len, x, y, z, alongZ) {
  const g = new THREE.BoxGeometry(len, SEC, SEC), uv = g.attributes.uv, rep = len / SEC;
  for (let i = 8; i < 24; i++) uv.setX(i, uv.getX(i) * rep); // (top, bottom, front and back faces run along x)
  if (alongZ) g.rotateY(Math.PI / 2);
  return g.translate(x, y, z);
}

/** The four neon pieces, painted into their own little atlas. */
function neonArt(accent) {
  const pink = '#ff3fb8', cyan = '#27e0ff', gold = '#ffd84d', violet = '#b04dff';
  const draw = [
    (c) => { neonPath(c, pink, 9, heartPath(c, 128, 132, 72)); neonPath(c, gold, 7, boltPath(c, 132, 128, 70)); },
    (c) => { neonPath(c, cyan, 8, glassPath(c, 128, 118, 92)); neonPath(c, '#3dff9a', 7, () => { c.beginPath(); c.arc(150, 76, 13, 0, Math.PI * 2); }); },
    (c) => { neonText(c, 'after', 128, 92, 74, violet, { font: SCRIPT, maxW: 236 }); neonText(c, 'DARK', 128, 172, 86, pink, { maxW: 236 }); },
    (c) => { neonPath(c, gold, 8, () => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 40 : 96; c.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } c.closePath(); }); },
  ];
  const canvas = cnv(1024, 256, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 256); draw.forEach((d, i) => { c.save(); c.translate(i * 256, 0); d(c); c.restore(); }); });
  return { t: tex(canvas), cols: [pink, cyan, violet, gold].map((h) => new THREE.Color(h)), uv: (i) => [i / 4 + 0.004, 0.004, (i + 1) / 4 - 0.004, 0.996], accent };
}

// ------------------------------------------------------------------ the hall
/**
 * Build the dressing into the hall (static parts are baked with the rest). A: buildHall's anchors
 * (the reflection joins its screens). Returns the per-frame step (t, dt, B, drop, flash, cA, cB).
 */
export function dressHall(zn, plan, M, X, video, A) {
  const V = plan.V, S = zn.scene, F = V.floor, H = V.wallH, hw = V.hw, hd = V.hd, W = V.wall;
  const lite = quality().club3?.near < 80; // (Battery saver: fewer shafts)
  const metal = toon(0x5a5a68, { map: latticeTex(), alphaTest: 0.5, side: THREE.DoubleSide }, { halftone: 0.2 });
  const add = (g, mat) => { const m = new THREE.Mesh(g, mat); S.add(m); zn._static.push(m); return m; };
  // ---- truss towers round the dance floor (the camera always looks down: nothing much above 4 m is
  // ever on screen, so the rig stands on the floor), a par can on each, two shafts from each can
  const TH = 3.4, x0 = F.x - F.w / 2 - 1, x1 = F.x + F.w / 2 + 1, z0 = F.z - F.d / 2 - 0.75, z1 = F.z + F.d / 2 + 0.75;
  const towers = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
  const canMat = toon(0x16161c, {}, { halftone: 0.2 }), shafts = [], cols = [V.accent[0], V.accent[1], 0xffffff];
  towers.forEach(([x, z], i) => {
    const y0 = floorY(plan, x, z);
    add(beamGeo(TH, 0, 0, 0, false).rotateZ(Math.PI / 2).translate(x, y0 + TH / 2, z), metal);
    zn.colliders.push({ minX: x - SEC / 2, maxX: x + SEC / 2, minZ: z - SEC / 2, maxZ: z + SEC / 2 });
    const top = y0 + TH + 0.12;
    const m = add(new THREE.CylinderGeometry(0.15, 0.12, 0.36, 10), canMat);
    m.position.set(x, top, z); m.rotation.x = z < F.z ? 0.5 : -0.5;
    X.bulb(x, top - 0.05, z + (z < F.z ? 0.16 : -0.16), 0.5, 0xfff0d8);
    // one shaft in toward the middle of the floor, one along its edge (every other tower's second on Battery saver)
    const from = new THREE.Vector3(x, top - 0.1, z);
    for (const [k, to] of [[0, new THREE.Vector3(x + (F.x - x) * 0.3, 0, z + (F.z - z) * 0.35)], [1, new THREE.Vector3(x + (F.x - x) * 0.12, 0, z + (F.z - z) * 0.75)]]) {
      if (k && lite && i % 2) continue;
      to.y = floorY(plan, to.x, to.z);
      const L = from.distanceTo(to);
      shafts.push({ e: X.cones.push(coneGeo(0.05 / L, 1.5 / L).applyMatrix4(aimMatrix(from, to)), cols[(i + k) % 3], 1), g: (i + k) % 2 });
    }
  });
  // ---- speaker stacks either side of the video wall: two subs and a top, cones that thump
  const thump = [], sx = W.w / 2 + 1.4, zf = -hd + 1.0;
  for (const s of [-1, 1]) {
    const x = s * sx;
    zn.box(1.5, 2.0, 1.1, x, 1.0, zf, M.black);
    zn.box(1.1, 0.9, 0.9, x, 2.45, zf, M.black, { collide: false });
    for (const [y, r, dx] of [[0.5, 0.42, 0], [1.5, 0.42, 0], [2.45, 0.24, -0.25], [2.45, 0.24, 0.25]]) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: coneTex(), transparent: true, alphaTest: 0.1 }));
      c.position.set(x + dx, y, zf + (y > 2 ? 0.46 : 0.56)); S.add(c);
      thump.push(c);
    }
  }
  // ---- neon art: either side of the video wall, and on the long walls by the north corners
  const ART = neonArt(V.accent), art = new Batch(['position', 'uv']), artE = [];
  const size = 2.2, ay = 2.3; // (low enough for the camera to see from across the hall)
  const put = (i, x, y, z, yaw) => {
    artE.push({ e: art.push(uvRect(wallQ(x, y, z, size, size, yaw), ART.uv(i)), 0xffffff), i });
    X.glow.push(wallQ(x - Math.sin(yaw) * 0.01, y, z - Math.cos(yaw) * 0.01, size * 1.6, size * 1.6, yaw), ART.cols[i], 0.3);
  };
  const ax = W.w / 2 + (hw - W.w / 2) * 0.62;
  const off = 0.24; // (just proud of the walls' inner faces: they're 0.4 m thick, on their lines)
  if (hw - W.w / 2 > 5) { put(0, -ax, ay, -hd + off, 0); put(1, ax, ay, -hd + off, 0); } // (beside the stacks, if there's room)
  put(2, -hw + off, ay, -hd + 3, Math.PI / 2); put(3, hw - off, ay, -hd + 3, -Math.PI / 2);
  art.build(S, new THREE.MeshBasicMaterial({ map: ART.t, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  // ---- the video wall in the glossy floor: the further from the wall, the higher up it reflects
  const P = V.pit, D = Math.min(14, P ? P.z - P.d / 2 - (-hd + 0.3) : 14);
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(W.w * 1.04, D).rotateX(-Math.PI / 2), reflectMat(video, { reach: (D * 0.58) / W.h, from: (W.y ?? 0.9) / W.h }));
  refl.position.set(0, 0.03, -hd + 0.3 + D / 2); refl.renderOrder = 1; S.add(refl);
  A.screens.push(refl.material);
  // ---- the low mist (in the Pit, it pools in the bowl) and the stage's glow behind the crowd
  const mistM = fxMat('mist'), glowM = fxMat('glow');
  const mistQ = new THREE.Mesh(new THREE.PlaneGeometry(F.w + 10, F.d + 8).rotateX(-Math.PI / 2), mistM);
  mistQ.position.set(F.x, P ? 0.15 : 0.95, F.z); mistQ.renderOrder = 2; S.add(mistQ);
  const gw = Math.min(hw * 2, W.w + 14), glowQ = new THREE.Mesh(new THREE.PlaneGeometry(gw, H), glowM);
  glowQ.position.set(0, H / 2, -hd + 0.6); S.add(glowQ);

  let tuned = false;
  return (t, dt, B, drop, flash, cA, cB) => {
    if (!tuned && X.cones.mesh) { X.cones.mesh.material.uniforms.uNear.value = 6; tuned = true; } // (no beam washes the screen)
    const e = B.pulse;
    // the shafts chase: half on each beat, all of them strobing at the drop
    if (X.cones.col) {
      for (const s of shafts) X.cones.set(s.e, drop ? (flash ? 0.9 : 0.08) : (B.n + s.g) % 2 ? 0.05 : 0.14 + 0.32 * e);
      X.cones.flush();
    }
    for (const c of thump) c.scale.setScalar(1 + 0.08 * e);
    for (const a of artE) art.set(a.e, Math.sin(t * 23 + a.i * 7) > 0.97 ? 0.25 : 0.7 + 0.35 * e * (a.i % 2 ? 1 : 0.6)); // (a flicker now and then)
    art.flush();
    mistM.uniforms.t.value = t; mistM.uniforms.k.value = 0.032 + 0.026 * e + flash * 0.12;
    mistM.uniforms.cA.value.copy(cA); mistM.uniforms.cB.value.copy(cB);
    glowM.uniforms.k.value = 0.08 + 0.12 * e + flash * 0.4;
    glowM.uniforms.cA.value.copy(cA); glowM.uniforms.cB.value.copy(cB);
  };
}
