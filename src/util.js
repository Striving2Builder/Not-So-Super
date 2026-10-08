export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const chance = (p) => Math.random() < p;

/**
 * pick(), but every item gets its turn: a shuffled deck per `key`, dealt one at a time and
 * reshuffled when it runs out (never the same one twice in a row across the reshuffle). The deck
 * is kept in localStorage, so the rotation carries on across visits and reloads; items added or
 * removed from `list` join or leave it.
 */
export function cycle(key, list) {
  if (!list || !list.length) return undefined;
  if (list.length === 1) return list[0];
  const K = `sg-cycle:${key}`;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(K)); } catch (e) { /* private mode */ }
  let deck = (d && Array.isArray(d.deck) ? d.deck : []).filter((u) => list.includes(u));
  const last = d && d.last;
  if (!deck.length) {
    deck = shuffle(list.slice());
    if (deck[0] === last) deck.push(deck.shift());
  } else {
    // new files since the deck was dealt go in at random spots
    const seen = new Set(d.all || []);
    for (const u of list) if (!seen.has(u) && !deck.includes(u)) deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, u);
  }
  const out = deck.shift();
  try { localStorage.setItem(K, JSON.stringify({ deck, last: out, all: list })); } catch (e) { /* private mode */ }
  return out;
}
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const $ = (id) => document.getElementById(id);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const shadeCache = new Map();
/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. Cached: called every frame. */
export function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (amt < 0) { const f = 1 + amt; r *= f; g *= f; b *= f; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, v);
  return v;
}

export function rgba(hex, a) {
  const c = parseInt(hex.slice(1), 16);
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtClock(min) {
  const m = Math.floor(min) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Intoxication makes steering sway: the player's own input direction is bent by up to ~20°.
 * It never adds movement when there is no input, so "no stick" always means "stay put".
 */
export function wobble(a, intox, t) {
  if (intox <= 30 || (!a.x && !a.y)) return a;
  const ang = Math.sin(t * 1.7) * 0.35 * Math.min(1, (intox - 30) / 70);
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Fit a fixed logical scene (e.g. 1000x600) into the viewport, letterboxed. */
export function fitScene(w, h, lw, lh) {
  const s = Math.min(w / lw, h / lh);
  return { s, ox: (w - lw * s) / 2, oy: (h - lh * s) / 2 };
}
