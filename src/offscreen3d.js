// The one offscreen WebGL renderer behind every "3D model → 2D sprite" bake: the heroine sprites
// (HeroSprite: brawler, 2D flight, newspaper photo, capture room) and the street-fight crooks
// (brawlsprite.js). One context instead of one per sprite: iOS Safari runs out of WebGL memory
// fast, and each context also kept its own copy of the hero's textures and shaders. Each bake
// renders into the top-left w×h corner of a canvas that only grows, then is copied into the
// caller's own 2D canvas (the one GPU readback the bake needed anyway). Released while the 3D
// flight runs (it rebuilds itself on the next bake).
import * as THREE from 'three';
import { watchContext, unwatch } from './gfx.js';

let R = null;

function offscreen() {
  if (R) return R;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const me = { canvas, renderer, w: 0, h: 0 };
  // a context iOS never gives back is simply rebuilt on the next bake
  watchContext(renderer, { critical: false, onGiveUp: () => { if (R === me) R = null; renderer.dispose(); } });
  return (R = me);
}

/**
 * Render `scene` through `cam` at w×h pixels into `out` (a 2D canvas, resized to w×h). Returns
 * false (and leaves `out` as it was) while the context is lost, so callers don't cache a blank.
 */
export function renderToCanvas(out, scene, cam, w, h) {
  const o = offscreen(), r = o.renderer;
  if (r.getContext().isContextLost()) return false;
  if (o.w < w || o.h < h) { o.w = Math.max(o.w, w); o.h = Math.max(o.h, h); r.setSize(o.w, o.h, false); }
  // (GL's origin is bottom-left: the canvas's top-left w×h corner is y = h0 - h)
  r.setViewport(0, o.h - h, w, h); r.setScissor(0, o.h - h, w, h); r.setScissorTest(true);
  r.render(scene, cam);
  r.setScissorTest(false);
  if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
  const g = out.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.drawImage(o.canvas, 0, 0, w, h, 0, 0, w, h);
  return true;
}

/** Free the context and its GPU memory (the 3D flight wants it); the next bake makes a new one. */
export function releaseOffscreen() {
  if (!R) return;
  const { renderer } = R;
  R = null;
  unwatch(renderer.domElement);
  renderer.forceContextLoss();
  renderer.dispose();
}
