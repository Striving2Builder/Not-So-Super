// r11 V2 (track V): each main room its own place. Its own air (fog, background and key light colour,
// the sky light's tint) and one landmark you see from the door: the Warehouse Rave's giant neon triangle,
// the Mezzanine's gold chandelier, the Pit's fire ring, Centre Stage's halo over the round booth,
// the Tunnel's subway roundel. One merged mesh each (≤2 draws), no new lights. dressHall calls it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VENUE = {
  rave:      { fog: 0x24104a, key: 0xc8a8ff, sky: 0xa08aff, near: 24 },
  mezzanine: { fog: 0x2a1a0a, key: 0xffdcaa, sky: 0xffc880, near: 26 },
  pit:       { fog: 0x330c10, key: 0xffa080, sky: 0xff8a6a, near: 22 },
  centre:    { fog: 0x062a24, key: 0xa8ffe0, sky: 0x7affd0, near: 24 },
  tunnel:    { fog: 0x0c0a2a, key: 0x9aa8ff, sky: 0x7a8aff, near: 20 },
};

/** Paints a geometry one colour (vertex colours: the landmark is one draw). */
function paint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const at = (g, x, y, z, rx = 0, ry = 0) => { g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); return g; };

// (every hall already has a small mirror ball: the rave's landmark is a giant neon triangle, turning)
function neonTriangle(H, F) {
  const y = H - 1.9, tri = (r, t, c) => paint(new THREE.TorusGeometry(r, t, 4, 3).toNonIndexed(), c);
  return { geos: [at(tri(2.6, 0.13, 0x27e0ff), F.x, y, F.z, 0, 0), at(tri(1.9, 0.09, 0xff2fd0), F.x, y, F.z, 0, Math.PI), at(paint(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 4).toNonIndexed(), 0x777788), F.x, y + 2.4, F.z)], spin: true };
}
function chandelier(H, F) {
  const y = H - 1.6, gold = 0xffd27a, g = [paint(new THREE.TorusGeometry(3.2, 0.1, 6, 40), gold), paint(new THREE.TorusGeometry(2.1, 0.08, 6, 32), gold)].map((q) => at(q.toNonIndexed(), F.x, y, F.z, Math.PI / 2));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 2.1 : 3.2; g.push(at(paint(new THREE.OctahedronGeometry(0.16).toNonIndexed(), 0xfff4d0), F.x + Math.cos(a) * r, y - 0.45, F.z + Math.sin(a) * r)); }
  return { geos: g };
}
function fireRing(H, F, V) {
  const P = V.pit || F, y = H - 1.2;
  return { geos: [at(paint(new THREE.TorusGeometry(7, 0.22, 6, 48).toNonIndexed(), 0xff5a1e), P.x, y, P.z, Math.PI / 2), at(paint(new THREE.TorusGeometry(6.4, 0.08, 4, 48).toNonIndexed(), 0xffc23a), P.x, y - 0.2, P.z, Math.PI / 2)] };
}
function halo(H, F, V) {
  const I = V.island || F, y = H - 0.9;
  return { geos: [at(paint(new THREE.TorusGeometry(4.6, 0.16, 6, 48).toNonIndexed(), 0x3dff9a), I.x, y, I.z, Math.PI / 2), at(paint(new THREE.TorusGeometry(4.6, 0.05, 4, 48).toNonIndexed(), 0xffffff), I.x, y - 0.35, I.z, Math.PI / 2)] };
}
function roundel(H, V) {
  const z = Math.min(8, V.hd * 0.3), y = H - 1.7;
  return { geos: [at(paint(new THREE.TorusGeometry(1.5, 0.3, 6, 36).toNonIndexed(), 0xff2244), 0, y, z), at(paint(new THREE.BoxGeometry(4.2, 0.62, 0.12).toNonIndexed(), 0x2a4cff), 0, y, z),
    at(paint(new THREE.BoxGeometry(0.06, 1.2, 0.06).toNonIndexed(), 0x555566), -1.2, y + 1.2, z), at(paint(new THREE.BoxGeometry(0.06, 1.2, 0.06).toNonIndexed(), 0x555566), 1.2, y + 1.2, z)] };
}

/** The room's air and landmark. Returns a per-frame step (the mirror ball turns), or null. */
export function dressVenue(zn, plan) {
  const id = plan.id, V = plan.V, Z = VENUE[id], S = zn.scene;
  if (!Z) return null; // (the story clubs keep their own look)
  if (S.fog) { S.fog.color.setHex(Z.fog); S.fog.near = Z.near; }
  S.background = new THREE.Color(Z.fog).lerp(new THREE.Color(V.bg), 0.5);
  if (zn.key) zn.key.color.setHex(Z.key);
  S.traverse((o) => { if (o.isHemisphereLight) o.color.setHex(Z.sky); });
  const H = V.wallH, F = V.floor;
  const L = id === 'rave' ? neonTriangle(H, F) : id === 'mezzanine' ? chandelier(H, F) : id === 'pit' ? fireRing(H, F, V) : id === 'centre' ? halo(H, F, V) : roundel(H, V);
  const geo = mergeGeometries(L.geos);
  if (!geo) return null;
  let m;
  if (L.spin) { geo.translate(-F.x, -(H - 1.9), -F.z); m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); m.position.set(F.x, H - 1.9, F.z); }
  else m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  m.name = `c3-landmark-${id}`;
  S.add(m);
  return L.spin ? (t) => { m.rotation.y = t * 0.35; } : null;
}
