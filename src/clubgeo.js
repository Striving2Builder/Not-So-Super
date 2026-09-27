// Club geometry: the BVH collider, capsule collision and the walkable-floor scan for a premade
// club. Pure three.js (no DOM, no game state) so tools/bake_clubs.js can run the exact same scan
// offline and ship the result in the club's .json.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH, acceleratedRaycast } from '../vendor/three-mesh-bvh/index.module.js';

export const RADIUS = 0.35, STEP = 0.45, HEADROOM = 1.9;
export const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);

const _box = new THREE.Box3(), _seg = new THREE.Line3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

/** Push a capsule (feet at p) out of the geometry. Returns how far it was pushed (x/z only). */
export function capsulePush(collider, p, radius = RADIUS) {
  _seg.start.set(p.x, p.y + STEP + radius, p.z);
  _seg.end.set(p.x, p.y + HEADROOM - radius, p.z);
  _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
  _box.min.addScalar(-radius); _box.max.addScalar(radius);
  const sx = _seg.start.x, sz = _seg.start.z;
  collider.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(_box),
    intersectsTriangle: (tri) => {
      const d = tri.closestPointToSegment(_seg, _v1, _v2);
      if (d < radius) {
        const dir = _v2.sub(_v1).normalize();
        dir.y = 0; // horizontal push only; the floor is handled by grounding
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        _seg.start.addScaledVector(dir, radius - d);
        _seg.end.addScaledVector(dir, radius - d);
      }
    },
  });
  const dx = _seg.start.x - sx, dz = _seg.start.z - sz;
  p.x += dx; p.z += dz;
  return Math.hypot(dx, dz);
}

/** One static mesh (with a BVH) of everything solid in the club. The slow step: runs once per load. */
export function buildCollider(scene) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    // light beams / see-through glass don't block movement (simplified materials remember the original)
    if (m && (m.userData.solid !== undefined ? !m.userData.solid : m.transparent && m.opacity < 0.35)) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', o.geometry.attributes.position.clone());
    if (o.geometry.index) geo.setIndex(o.geometry.index.clone());
    else geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    geo.applyMatrix4(o.matrixWorld);
    parts.push(geo);
  });
  const merged = mergeGeometries(parts, false);
  merged.boundsTree = new MeshBVH(merged);
  const collider = new THREE.Mesh(merged);
  collider.raycast = acceleratedRaycast; // use the BVH for rays (otherwise it's a brute-force scan)
  collider.updateMatrixWorld(true);
  return collider;
}

/** Most common height among points (the club's main floor). */
function commonY(points) {
  const n = {};
  for (const p of points) { const k = p.y.toFixed(1); n[k] = (n[k] || 0) + 1; }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top ? +top[0] : 0;
}

/**
 * Walkable floor on a 1 m grid: upward-facing spots with standing room, within a storey of the
 * main floor, preferring enclosed (indoor) spots. Returns { floor: Vector3[] (with .indoor), mainY }.
 */
export function scanFloor(scene, collider) {
  const box = new THREE.Box3().setFromObject(scene);
  const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
  // Walk down each column through every surface (models sit at any height, some have
  // several storeys), keeping upward-facing spots with standing room above.
  const cand = [];
  for (let x = box.min.x + 0.5; x < box.max.x; x += 1) {
    for (let z = box.min.z + 0.5; z < box.max.z; z += 1) {
      let y0 = box.max.y + 0.5;
      for (let n = 0; n < 12; n++) {
        ray.set(new THREE.Vector3(x, y0, z), DOWN); ray.far = y0 - box.min.y + 0.1;
        const h = ray.intersectObject(collider)[0];
        if (!h) break;
        y0 = h.point.y - 0.05;
        if (h.face.normal.y < 0.85) continue;
        ray.set(new THREE.Vector3(x, h.point.y + 0.05, z), UP); ray.far = HEADROOM;
        if (ray.intersectObject(collider)[0]) continue;
        cand.push(h.point.clone());
      }
    }
  }
  // Main floor = the most common walkable height; play within a storey of it.
  const baseY = commonY(cand);
  const floor = [];
  for (const p of cand) {
    if (p.y < baseY - 0.5 || p.y > baseY + 1.6) continue;
    if (capsulePush(collider, p.clone()) > 0.04) continue; // not enough room to stand
    // Enclosed = walls in at least 3 of 4 directions (floor/roof slabs can overhang the walls,
    // so "is there a roof" isn't enough to tell inside from outside).
    let walls = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ray.set(new THREE.Vector3(p.x, p.y + 1.2, p.z), new THREE.Vector3(dx, 0, dz)); ray.far = 25;
      if (ray.intersectObject(collider)[0]) walls++;
    }
    p.indoor = walls >= 3;
    floor.push(p);
  }
  // Some models have floor slabs extending outside the walls; keep play indoors when possible.
  const indoor = floor.filter((p) => p.indoor);
  if (indoor.length >= 60) floor.splice(0, floor.length, ...indoor);
  return { floor, mainY: commonY(floor) };
}

/** Compact JSON form of a floor scan (mm precision), and back. */
export const packFloor = ({ floor, mainY }) => ({
  mainY, floor: floor.map((p) => [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), p.indoor ? 1 : 0]),
});
export function unpackFloor(baked) {
  const floor = baked.floor.map(([x, y, z, i]) => Object.assign(new THREE.Vector3(x, y, z), { indoor: !!i }));
  return { floor, mainY: baked.mainY };
}
