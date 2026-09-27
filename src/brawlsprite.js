// Street-fight sprites baked from the rigged 3D crooks (assets/models/enemies/, driven by Supergirl's
// clips through enemies.js retargeting). One small offscreen WebGL renderer poses a model, renders it
// side-on, and the frame is inked (bold comic outline + cel bands) into a cached 2D canvas. Frames are
// quantized per clip so a whole fight needs a few dozen bakes per model, spread over frames by a
// per-frame budget; anything not baked yet falls back to the procedural art in art.js.
import * as THREE from 'three';
import { Enemy, enemyReady } from './enemies.js';
import { quality } from './settings.js';

export const SPAN = 2.6, LIFT = 0.12; // frame covers 2.6 m of height, feet 0.12 m above the bottom edge

// Street-fight roles → model, scale, tint (tint multiplies the model's texture: shirt/crew colours).
export const LOOKS = {
  thug:     { model: 'robber', scale: 1 },
  knife:    { model: 'robber', scale: 0.96, tint: 0xffb0a0 },
  brute:    { model: 'robber', scale: 1.24, tint: 0x9aa0b8 },
  gunman:   { model: 'police', scale: 1, tint: 0x8c8ca8 },
  arsonist: { model: 'robber', scale: 1, tint: 0xffc070 },
  boss:     { model: 'riddler', scale: 1.14 },
};

// Clip sampling: loops get N evenly spaced frames; one-shots map u∈[0,1] onto [a,b] seconds in N steps.
export const CLIPS = {
  walk:   { clip: 'walk', loop: true, n: 10 },
  run:    { clip: 'run', loop: true, n: 8 },
  idle:   { clip: 'combatIdle', loop: true, n: 6 },
  wind:   { clip: 'punch', a: 0.95, b: 1.3, n: 3 },
  strike: { clip: 'punch', a: 1.35, b: 1.7, n: 3 },
  kick:   { clip: 'kick2', a: 0.3, b: 1.0, n: 4 },
  hit:    { clip: 'hit', a: 0.1, b: 0.7, n: 3 },
  fall:   { clip: 'fallFlat', a: 0.4, b: 2.2, n: 6 },
  getup:  { clip: 'getUp', a: 3.6, b: 6.4, n: 6 },
  jump:   { clip: 'jump', a: 0.3, b: 1.2, n: 3 },
};

let R = null; // shared renderer state, built on first use

function setup() {
  const q = quality();
  const H = q.id === 'saver' ? 180 : 256, W = Math.round(H * 0.72);
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // Same studio rig as HeroSprite so crooks and heroine share one light: warm key high front, cool rim.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5060, 2.1));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(2, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd0ff, 1.6); rim.position.set(-3, 2, -4); scene.add(rim);
  const a = W / H;
  const cam = new THREE.OrthographicCamera(-(SPAN * a) / 2, (SPAN * a) / 2, SPAN - LIFT, -LIFT, 0.1, 50);
  cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  R = { canvas, renderer, scene, cam, W, H, tmp, tctx: tmp.getContext('2d', { willReadFrequently: true }), inst: {}, cache: new Map(), budget: 0 };
}

/** A posable instance per look (own materials so the tint doesn't leak into the 3D zones). */
function instance(type) {
  if (R.inst[type]) return R.inst[type];
  const L = LOOKS[type];
  const e = new Enemy(L.model, L.scale);
  e.model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    if (L.tint) for (const m of [].concat(o.material)) if (m.color) m.color.multiply(new THREE.Color(L.tint));
  });
  e.root.visible = false;
  R.scene.add(e.root);
  const bones = {};
  e.model.traverse((o) => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o; });
  return (R.inst[type] = { e, bones });
}

export const spritesReady = (type) => !!LOOKS[type] && enemyReady(LOOKS[type].model);

let R0budget = 2;
/** Call once per rendered frame: how many new bakes this frame may do (keeps the frame time flat). */
export function spriteBudget(n = 2) { if (R) R.budget = n; else R0budget = n; }

const _v = new THREE.Vector3();

/**
 * The frame for `type` playing `anim` (key of CLIPS) at loop phase / progress `u`.
 * Returns { img, hand: [x,y] metres, head: [x,y] metres } or null (not loaded / over budget).
 */
export function frame(type, anim, u) {
  if (!spritesReady(type)) return null;
  if (!R) { setup(); R.budget = R0budget; }
  const C = CLIPS[anim];
  let i = C.loop ? Math.floor((((u % 1) + 1) % 1) * C.n) : Math.round(Math.min(1, Math.max(0, u)) * (C.n - 1));
  const key = type + '|' + anim + '|' + i;
  let f = R.cache.get(key);
  if (f) return f;
  if (R.budget <= 0) {
    // over budget: any neighbouring frame of the same clip beats popping to the procedural art
    for (let d = 1; d < C.n; d++) {
      const k2 = type + '|' + anim + '|' + ((i + d) % C.n), k3 = type + '|' + anim + '|' + ((i - d + C.n) % C.n);
      if (R.cache.has(k2)) return R.cache.get(k2);
      if (R.cache.has(k3)) return R.cache.get(k3);
    }
    return null;
  }
  R.budget--;
  f = bake(type, C, i);
  R.cache.set(key, f);
  return f;
}

/** Bake queue for the start of a fight: walk/idle first so the first wave never shows stand-ins. */
export function prewarm(types, n = 6) {
  if (!R) { if (!types.some(spritesReady)) return; setup(); }
  for (const t of types) for (const anim of ['walk', 'idle', 'wind', 'strike', 'hit', 'fall']) {
    if (R.budget <= 0 || !spritesReady(t)) return;
    const C = CLIPS[anim];
    for (let i = 0; i < C.n && R.budget > 0; i++) if (!R.cache.has(t + '|' + anim + '|' + i)) frame(t, anim, C.loop ? (i + 0.5) / C.n : i / (C.n - 1));
  }
}

function bake(type, C, i) {
  const { e, bones } = instance(type);
  for (const k in R.inst) R.inst[k].e.root.visible = false;
  e.root.visible = true;
  // Three-quarter view: side-on for readable punches, turned a little toward the camera.
  e.root.rotation.set(0, Math.PI / 2 - 0.42, 0);
  e.play(C.clip, { fade: 0 });
  const a = e.cur;
  if (a) {
    const d = a.getClip().duration;
    a.enabled = true; a.paused = false; a.setEffectiveWeight(1);
    a.time = C.loop ? (i / C.n) * d : Math.min(d - 1e-3, C.a + ((C.b - C.a) * i) / Math.max(1, C.n - 1));
    e.mixer.update(0);
  }
  e.root.updateMatrixWorld(true);
  R.renderer.render(R.scene, R.cam);
  const W = R.W, H = R.H;
  const toM = (b) => { if (!b) return null; b.getWorldPosition(_v); return [_v.x, _v.y]; };
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  inkInto(out.getContext('2d'), R.canvas, W, H, R.tctx, R.tmp);
  return { img: out, hand: toM(bones.RightHand), lhand: toM(bones.LeftHand), head: toM(bones.Head), foot: toM(bones.RightFoot) };
}

/**
 * Comic finish for a rendered character: cel-band the lighting (3 tones, a touch more saturation),
 * then a bold black ink outline around the silhouette. `src` may be a WebGL canvas.
 */
export function inkInto(ctx, src, W, H, tctx, tmp, { bands = true, width = 2.6 } = {}) {
  tctx.clearRect(0, 0, W, H);
  tctx.drawImage(src, 0, 0, W, H);
  if (bands) {
    const im = tctx.getImageData(0, 0, W, H), d = im.data;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 3] < 8) continue;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const l = 0.3 * r + 0.59 * g + 0.11 * b + 1;
      // soft 3-band quantize: shadow / mid / light, blended 60% toward the band so texture survives
      const q = l < 70 ? 48 : l < 150 ? 118 : 196;
      const k = (0.4 + (0.6 * q) / l);
      const m = (r + g + b) / 3;
      d[p] = Math.min(255, (m + (r - m) * 1.25) * k);
      d[p + 1] = Math.min(255, (m + (g - m) * 1.25) * k);
      d[p + 2] = Math.min(255, (m + (b - m) * 1.25) * k);
    }
    tctx.putImageData(im, 0, 0);
  }
  inkOutline(ctx, tmp, W, H, width);
}

const sils = new Map();
/**
 * Draw `img` into the W x H box at (x, y) on ctx with a solid ink outline `w` (dest units) around
 * its alpha. The silhouette canvas matches the source's pixel size (one per size+colour).
 */
export function inkOutline(ctx, img, W, H, w = 2.6, x = 0, y = 0, col = '#0b0a12') {
  const iw = img.width, ih = img.height, key = iw + 'x' + ih + col;
  let s = sils.get(key);
  if (!s) { const c = document.createElement('canvas'); c.width = iw; c.height = ih; s = { c, g: c.getContext('2d') }; sils.set(key, s); }
  const g = s.g;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, iw, ih);
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, iw, ih);
  g.globalCompositeOperation = 'source-over';
  for (let a = 0; a < 8; a++) {
    const an = (a / 8) * Math.PI * 2;
    ctx.drawImage(s.c, x + Math.cos(an) * w, y + Math.sin(an) * w, W, H);
  }
  ctx.drawImage(img, x, y, W, H);
}

/** Pixel size of baked frames (so callers can scale them like the hero sprite). */
export const frameSize = () => (R ? { w: R.W, h: R.H } : null);
