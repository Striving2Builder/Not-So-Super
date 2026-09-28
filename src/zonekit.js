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

/** Where (0..1) the segment a→b first enters box c in x/z, or null. */
export function segEnter(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, mn, mx] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return null; continue; }
    let ta = (mn - p) / d, tb = (mx - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0 > 0.02 ? t0 : null;
}

export function segHitsBox(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, mn, mx] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return false; }
    else {
      let ta = (mn - p) / d, tb = (mx - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
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
