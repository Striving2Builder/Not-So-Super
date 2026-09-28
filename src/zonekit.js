// Shared kit for the 3D zones' code: dimensions and vision tunables, the cel material helpers the
// set-dressing code uses, canvas textures and 2D line-vs-box tests (sight lines, camera reach).
import * as THREE from 'three';
import { toon } from './look3d.js';

export const WALL_H = 3.4;
export const SPEED = 5.2;
export const GUARD_RANGE = 7.5;
export const GUARD_FOV = 1.05;
export const CONE_RAYS = 22; // rays per vision cone, re-cast against the walls every frame

// Cel-shaded stand-in for Lambert (same call shape, so venue decor code needn't change).
export const lam = (c, extra = {}) => toon(c, extra);
export const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

// Segment-vs-box slab tests in x/z. Allocation-free: they run a few thousand times a frame
// (vision-cone rays, camera reach) and SwiftShader-class phones feel every bit of GC.
let T0 = 0, T1 = 1;
function slab(p, d, mn, mx) {
  if (Math.abs(d) < 1e-9) return p >= mn && p <= mx;
  let ta = (mn - p) / d, tb = (mx - p) / d;
  if (ta > tb) { const t = ta; ta = tb; tb = t; }
  if (ta > T0) T0 = ta;
  if (tb < T1) T1 = tb;
  return T0 <= T1;
}

/** Where (0..1) the segment a→b first enters box c in x/z, or null. */
export function segEnter(ax, az, bx, bz, c) {
  T0 = 0; T1 = 1;
  if (!slab(ax, bx - ax, c.minX, c.maxX) || !slab(az, bz - az, c.minZ, c.maxZ)) return null;
  return T0 > 0.02 ? T0 : null;
}

export function segHitsBox(ax, az, bx, bz, c) {
  T0 = 0; T1 = 1;
  return slab(ax, bx - ax, c.minX, c.maxX) && slab(az, bz - az, c.minZ, c.maxZ);
}

/** The colliders that block sight (walls, the closed security door), cached per collider list. */
export function sightBlockers(zn) {
  if (zn._blk && zn._blkOf === zn.colliders && zn._blkN === zn.colliders.length) return zn._blk;
  zn._blkOf = zn.colliders; zn._blkN = zn.colliders.length;
  return (zn._blk = zn.colliders.filter((c) => c.wall || c === zn.doorCol));
}

// Third-person camera: distance behind her, and the pitches it may use (the first is the normal view).
// ~43° over her shoulder and close enough that she fills ~1/6 of the screen height (the room
// ahead still reads because the view is aimed a little past her: see render()).
export const CAM_DIST = 6.3;
export const CAM_PITCHES = [0.76, 0.92, 1.1, 1.32];

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
