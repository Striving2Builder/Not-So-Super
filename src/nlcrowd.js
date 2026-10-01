// Nightlife crowd: instanced patrons (six draw calls for everyone) posed per frame to the beat.
// Same comic treatment as the zone's NPCs: cel shading + rim from look3d, contact shadows from the
// zone's shared BlobShadows (through cheap proxy objects).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { comic, gradMap } from './look3d.js';
import { TAU, C, rnd, pickR, tint } from './nlkit.js';

const SKINS = ['#f6d1b3', '#e8b48f', '#c68642', '#8d5524', '#5c3a21', '#f1c27d', '#d9a07a'];
const HAIRS = ['#161616', '#2b1a10', '#5a3a1e', '#d8b050', '#a02a1a', '#e8e8e8', '#ff4fb0', '#3a3aa0'];

const cylP = (rt, rb, h, seg, x, y, z, s, sz = 1) => tint(new THREE.CylinderGeometry(rt, rb, h, seg).scale(1, 1, sz).translate(x, y, z), s);
function figureGeos() {
  const shoes = (x, s = 0.1) => tint(new THREE.BoxGeometry(0.11, 0.07, 0.24).translate(x, 0.035, 0.04), s);
  const suit = mergeGeometries([
    cylP(0.085, 0.07, 0.86, 6, -0.1, 0.46, 0, 0.42), cylP(0.085, 0.07, 0.86, 6, 0.1, 0.46, 0, 0.42), shoes(-0.1), shoes(0.1),
    cylP(0.19, 0.18, 0.2, 8, 0, 0.94, 0, 0.42, 0.75), cylP(0.235, 0.18, 0.58, 8, 0, 1.32, 0, 1, 0.7),
  ]);
  const dress = mergeGeometries([
    cylP(0.06, 0.045, 0.8, 5, -0.08, 0.42, 0, 0.3), cylP(0.06, 0.045, 0.8, 5, 0.08, 0.42, 0, 0.3), shoes(-0.08, 0.05), shoes(0.08, 0.05),
    cylP(0.16, 0.31, 0.5, 10, 0, 0.76, 0, 1), cylP(0.2, 0.15, 0.52, 8, 0, 1.27, 0, 1, 0.72),
  ]);
  const head = mergeGeometries([cylP(0.05, 0.06, 0.18, 7, 0, 1.62, 0, 1), tint(new THREE.SphereGeometry(0.125, 10, 7).scale(0.95, 1.08, 1).translate(0, 1.79, 0), 1)]);
  const cap = () => tint(new THREE.SphereGeometry(0.138, 10, 5, 0, TAU, 0, Math.PI * 0.52).scale(1, 1.05, 1.08).translate(0, 1.8, -0.012), 1);
  const hairS = cap();
  const hairL = mergeGeometries([cap(), tint(new THREE.BoxGeometry(0.27, 0.46, 0.09).translate(0, 1.64, -0.1), 1)]);
  const arm = mergeGeometries([cylP(0.052, 0.042, 0.6, 5, 0, -0.3, 0, 1), tint(new THREE.SphereGeometry(0.052, 5, 4).translate(0, -0.63, 0), 1)]);
  return { suit, dress, head, hairS, hairL, arm };
}

/**
 * people: [{ x, z, rot, pose, type: 'suit'|'dress', outfit, skin?, hair?, hairType?, y?, s? }]
 * Poses: dance · stand · dj · deal · perform · bar · slot
 */
export function buildCrowd(zn, people) {
  if (!people.length) return null;
  const G = figureGeos();
  const mat = comic(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradMap(3) }), { halftone: 0.45, rim: 0xfff0d0 });
  const groups = { suit: [], dress: [], head: [], hairS: [], hairL: [], arm: [] };
  for (const p of people) {
    p.skin = C(p.skin || pickR(SKINS)); p.outfit = C(p.outfit); p.hairC = C(p.hair || pickR(HAIRS));
    p.hairType = p.hairType || (p.type === 'dress' ? 'L' : pickR(['S', 'S', 'S', 'none']));
    p.y = p.y || 0; p.s = p.s || rnd(0.94, 1.06); p.ph = rnd(0, TAU); p.style = Math.floor(rnd(0, 4)); p.ox = 0; p.oz = 0;
    p.bi = groups[p.type].push(p) - 1;
    p.hi = groups.head.push(p) - 1;
    if (p.hairType !== 'none') p.ri = groups[p.hairType === 'L' ? 'hairL' : 'hairS'].push(p) - 1;
    p.ai = groups.arm.push(p, p) - 2;
    // a proxy the zone's contact shadows can follow
    p.proxy = new THREE.Object3D();
    zn.scene.add(p.proxy);
    if (zn.shadows && zn.shadows.items.length < 30) zn.shadows.track(p.proxy, 0.42 * p.s); // leave room for the cast
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

export function updateCrowd(cr, zn, t, dt, B) {
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
    p.proxy.position.set(root.position.x, p.y, root.position.z);
    root.updateMatrixWorld(true);
    meshes[p.type].setMatrixAt(p.bi, body.matrixWorld);
    meshes.head.setMatrixAt(p.hi, body.matrixWorld);
    if (p.ri !== undefined) meshes[p.hairType === 'L' ? 'hairL' : 'hairS'].setMatrixAt(p.ri, body.matrixWorld);
    meshes.arm.setMatrixAt(p.ai, aL.matrixWorld);
    meshes.arm.setMatrixAt(p.ai + 1, aR.matrixWorld);
  }
  for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
}
