// Street-fight sprites baked from the rigged 3D crooks (assets/models/enemies/, driven by Supergirl's
// clips through enemies.js retargeting). One small offscreen WebGL renderer poses a model, renders it
// side-on, and the frame is inked (bold comic outline + cel bands) into a cached 2D canvas. Frames are
// quantized per clip so a whole fight needs a few dozen bakes per model, spread over frames by a
// per-frame budget; anything not baked yet falls back to the procedural art in art.js.
import * as THREE from 'three';
import { Enemy, enemyReady } from './enemies.js';
import { quality } from './settings.js';

export const SPAN = 2.6, LIFT = 0.12; // frame covers 2.6 m of height, feet 0.12 m above the bottom edge

// Crook looks → model, scale, shape (non-uniform [width, height] squash: fat bruiser, beanpole
// knifeman, slim kicker), and a palette swap of the model's flat-colour texture (the robber's atlas is
// stripes / trousers / skin). Headgear, faces and props are drawn on top in 2D at the baked anchors
// (hat: cap | beanie | bandana | hood | ponytail | helmet | mask | shades | none). kick: strikes with the
// kick clip. Stats come from the crook's type (brawldata EN); a look is purely how it reads.
export const LOOKS = {
  thug:      { model: 'robber', scale: 1, recolor: { stripe: '#f2f2f2', dark: '#1a1a22', pants: '#2a3550', skin: '#e8c49a' }, hat: 'cap', hatCols: ['#d8122e', '#1e3cff', '#1e7a4a'] },
  hoodie:    { name: 'HOODIE', model: 'robber', scale: 0.98, shape: [0.94, 1], recolor: { stripe: '#5a6a4a', dark: '#3e4a34', pants: '#22262e', skin: '#c9946a' }, hat: 'hood', hatCols: ['#4a5a3c', '#5a3a6a', '#3a4a6a'] },
  kicker:    { name: 'KICKER', model: 'robber', scale: 0.95, shape: [0.84, 0.98], kick: true, recolor: { stripe: '#ff5fa2', dark: '#3a0e2a', pants: '#1e2a4a', skin: '#f1c7a5' }, hat: 'ponytail', hatCols: ['#e8c040', '#1a1a1a', '#c8502a'] },
  knife:     { model: 'robber', scale: 1, shape: [0.84, 1.13], recolor: { stripe: '#e84a3a', dark: '#2a0e12', pants: '#1c1c20', skin: '#b57a55' }, hat: 'bandana', hatCols: ['#d8122e', '#1e3cff', '#111111'] },
  brute:     { model: 'robber', scale: 1.14, shape: [1.38, 1.04], kick: true, recolor: { stripe: '#9a6ae8', dark: '#1e1236', pants: '#2a2a34', skin: '#8a5a3b' }, hat: 'none', beard: true },
  riot:      { name: 'RIOT COP', model: 'police', scale: 1.08, shape: [1.12, 1], tint: 0x7a8aa8, hat: 'helmet', shield: true },
  gunman:    { model: 'police', scale: 1, tint: 0x9a9ab8, hat: 'shades' },
  arsonist:  { model: 'robber', scale: 1, recolor: { stripe: '#ff9a1f', dark: '#3a1a08', pants: '#3a3a2a', skin: '#f1c7a5' }, hat: 'beanie', hatCols: ['#2a2a30', '#6a1a1a'] },
  boss:      { model: 'riddler', scale: 1.14 },
  bossBrute: { model: 'robber', scale: 1.2, shape: [1.42, 1.12], kick: true, recolor: { stripe: '#1c1c22', dark: '#d8122e', pants: '#141418', skin: '#d9a47f' }, hat: 'mask', hatCols: ['#d8122e'] },
};
// Which looks can stand in for each gameplay type; a wave deals them out round-robin so a fight never
// shows two of the same look at once when it can avoid it.
export const VARIANTS = {
  thug: ['thug', 'hoodie', 'kicker'], knife: ['knife'], brute: ['brute', 'riot'], gunman: ['gunman'],
  arsonist: ['arsonist'], boss: ['boss', 'bossBrute'],
};

// Clip sampling: loops get N evenly spaced frames; one-shots map u∈[0,1] onto [a,b] seconds in N steps.
export const CLIPS = {
  walk:   { clip: 'walk', loop: true, n: 6 },
  run:    { clip: 'run', loop: true, n: 5 },
  idle:   { clip: 'combatIdle', loop: true, n: 4 },
  wind:   { clip: 'punch', a: 0.95, b: 1.3, n: 2 },
  strike: { clip: 'punch', a: 1.4, b: 1.7, n: 2 },
  kick:   { clip: 'kick2', a: 0.3, b: 1.0, n: 3 },
  hit:    { clip: 'hit', a: 0.15, b: 0.6, n: 2 },
  fall:   { clip: 'fallFlat', a: 0.02, b: 0.9, n: 4, shift: 0.5 },
  getup:  { clip: 'getUp', a: 0.6, b: 4.3, n: 3, shift: 0.5 },
  jump:   { clip: 'jump', a: 0.3, b: 1.2, n: 2 },
};

let R = null; // shared renderer state, built on first use
const MAX_FRAMES = 360; // ~8 crook looks' worth of frames; older zones' bakes are evicted first

function setup() {
  const q = quality();
  const H = q.brawlSprite || 256, W = H; // square: lying bodies and kicks need the width
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
  R = { canvas, renderer, scene, cam, W, H, tmp, tctx: tmp.getContext('2d', { willReadFrequently: true }), inst: {}, cache: new Map(), deadline: R0deadline };
}

/** Palette-swap a flat-colour atlas: top half shirt stripes, bottom-right skin, the rest trousers. */
function recolorMap(tex, rc) {
  const img = tex.image, w = Math.min(256, img.width), h = Math.min(256, img.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), px = d.data;
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const S = hex(rc.stripe), D = hex(rc.dark), P = hex(rc.pants), K = hex(rc.skin);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, l = (px[i] + px[i + 1] + px[i + 2]) / 765;
    const sat = Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]);
    let col;
    if (sat > 40) col = K.map((v) => v * (0.75 + l * 0.35));           // skin (the only saturated colour)
    else if (y < h * 0.53) col = l > 0.5 ? S : D;                       // shirt stripes
    else col = P.map((v) => v * (0.8 + l * 0.6));                      // trousers / shoes
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
  }
  g.putImageData(d, 0, 0);
  const t = tex.clone(); t.image = c; t.needsUpdate = true;
  return t;
}

/** A posable instance per look (own materials so recolours don't leak into the 3D zones). */
function instance(type) {
  if (R.inst[type]) return R.inst[type];
  const L = LOOKS[type];
  const e = new Enemy(L.model, L.scale);
  if (L.shape) e.model.scale.set(L.scale * L.shape[0], L.scale * L.shape[1], L.scale * L.shape[0]);
  e.model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of [].concat(o.material)) {
      if (L.recolor && m.map && m.map.image) m.map = recolorMap(m.map, L.recolor);
      if (L.tint && m.color) m.color.multiply(new THREE.Color(L.tint));
    }
  });
  e.root.visible = false;
  R.scene.add(e.root);
  const bones = {};
  e.model.traverse((o) => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o; });
  return (R.inst[type] = { e, bones });
}

export const spritesReady = (type) => !!LOOKS[type] && enemyReady(LOOKS[type].model);

let R0deadline = 0;
/**
 * Call once per rendered frame: milliseconds this frame may spend baking new frames (keeps the frame
 * time flat; a bake that's already started always finishes, so at least one fits per frame).
 */
export function spriteBudget(ms = 4) { const d = performance.now() + ms; if (R) R.deadline = d; else R0deadline = d; }
const overBudget = () => performance.now() > R.deadline;

const _v = new THREE.Vector3();

/**
 * The frame for `type` playing `anim` (key of CLIPS) at loop phase / progress `u`.
 * Returns { img, hand: [x,y] metres, head: [x,y] metres } or null (not loaded / over budget).
 */
export function frame(type, anim, u) {
  if (!spritesReady(type)) return null;
  if (!R) setup();
  const C = CLIPS[anim];
  let i = C.loop ? Math.floor((((u % 1) + 1) % 1) * C.n) : Math.round(Math.min(1, Math.max(0, u)) * (C.n - 1));
  const key = type + '|' + anim + '|' + i;
  let f = R.cache.get(key);
  if (f) return f;
  if (overBudget()) {
    // over budget: any neighbouring frame of the same clip beats popping to the procedural art
    for (let d = 1; d < C.n; d++) {
      const k2 = type + '|' + anim + '|' + ((i + d) % C.n), k3 = type + '|' + anim + '|' + ((i - d + C.n) % C.n);
      if (R.cache.has(k2)) return R.cache.get(k2);
      if (R.cache.has(k3)) return R.cache.get(k3);
    }
    return null;
  }
  f = bake(type, C, i);
  R.cache.set(key, f);
  if (R.cache.size > MAX_FRAMES) R.cache.delete(R.cache.keys().next().value); // bounded: oldest bake goes first
  return f;
}

/**
 * Bake ahead within this frame's budget, breadth-first (every type's walk and idle before anyone's
 * getup) so the first wave never shows stand-ins. Returns true once everything listed is baked.
 */
export const CORE_ANIMS = ['walk', 'idle', 'wind', 'strike', 'hit'];
const ALL_ANIMS = [...CORE_ANIMS, 'fall', 'run', 'getup', 'kick', 'jump'];
export function prewarm(types, anims = ALL_ANIMS) {
  if (!R) { if (!types.some(spritesReady)) return false; setup(); }
  for (const anim of anims) {
    for (const t of types) {
      if (!spritesReady(t) || (anim === 'kick' && !LOOKS[t].kick)) continue;
      const C = CLIPS[anim];
      for (let i = 0; i < C.n; i++) {
        if (R.cache.has(t + '|' + anim + '|' + i)) continue;
        if (overBudget()) return false;
        frame(t, anim, C.loop ? (i + 0.5) / C.n : i / (C.n - 1));
      }
    }
  }
  return true;
}

function bake(type, C, i) {
  const { e, bones } = instance(type);
  for (const k in R.inst) R.inst[k].e.root.visible = false;
  e.root.visible = true;
  // Three-quarter view: side-on for readable punches, turned a little toward the camera.
  e.root.rotation.set(0, Math.PI / 2 - 0.42, 0);
  // lying poses reach forward past the feet: slide the model back in frame, undone when drawn
  const sh = C.shift || 0;
  e.root.position.x = -sh;
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
  const toM = (b) => { if (!b) return null; b.getWorldPosition(_v); return [_v.x + sh, _v.y]; };
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  inkInto(out.getContext('2d'), R.canvas, W, H, R.tctx, R.tmp);
  return { img: out, shift: sh, hand: toM(bones.RightHand), lhand: toM(bones.LeftHand), head: toM(bones.Head), top: toM(bones.HeadTop_End), foot: toM(bones.RightFoot) };
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
