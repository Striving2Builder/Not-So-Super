// The dive's comic landing beat: the plunge (focus lines converging on her, a push-in), then the
// THUD — the frame she lands on freezes into a comic panel (hit-stop), shakes, flashes, an inked
// shockwave ring, dust, cracked ground, impact lines and a big hand-lettered "THOOM!" — and that
// panel stays up while the zone loads underneath it, then wipes away to reveal the zone.
//
// Cheap by construction: nothing exists outside a dive (no per-frame cost in flight). During the
// beat it is one 2D canvas (redrawn per frame only during the ~1 s plunge; after the impact it is a
// still) plus a few DOM elements whose motion is CSS transform/opacity, which the compositor keeps
// playing while a zone's load blocks the main thread. The HUD, the LIVE feed and the captions sit
// above it (style.css "dive" block) and never move.
import { clamp, lerp, pick, rand } from './util.js';
import { sfx } from './sfx.js';
import { quality } from './settings.js';
import { isLoading } from './gfx.js';
import { comic } from './comic.js';

export const DIVE_FX = {
  push: 1.1, push2d: 1.05,   // CSS zoom of the game view at the end of the plunge (2D already zooms)
  lines: 36, linesLite: 14,  // plunge focus lines
  linesFrom: 0.36,           // ...coming in from ~400 ms of the 1.1 s plunge
  stopMs: 80,                // hit-stop: the impact frame holds dead still before the shake
  shake: 16,                 // px, decays over shakeMs
  shakeMs: 680,              // (long enough to carry through the hold: the panel never sits dead still)
  holdMs: 620,               // impact → earliest wipe (the word lands and reads)
  maxHoldMs: 2600,           // the longest the panel waits for a slow zone (then the LOADING card shows)
  loadingAfterMs: 950,       // still loading by then: the zone tag grows the loading dashes
  wipeMs: 320,
  halftone: 9,               // px between halftone dots on the impact panel
};
const WORDS = ['THOOM!', 'KRAKOOM!', 'WHUMP!', 'KA-THUD!', 'THUDD!', 'BOOM!', 'KRA-KOOM!', 'WHAMM!'];
// [balloon, balloon rim, letters, letter shadow]
const PALETTES = [
  ['#d8122e', '#ffe600', '#ffe600', '#111'],
  ['#ffe600', '#d8122e', '#d8122e', '#111'],
  ['#1e3cff', '#ffe600', '#ffffff', '#d8122e'],
  ['#ff9a1f', '#fff36b', '#ffffff', '#d8122e'],
];

// one dust cloud: three puffs over a fatter ink silhouette, a cel shade underneath
const PUFF = '<svg viewBox="-52 -42 104 84"><g fill="#111"><circle cx="-22" cy="8" r="25"/><circle cx="4" cy="-8" r="30"/><circle cx="27" cy="11" r="22"/></g>'
  + '<g fill="#e4d8bf"><circle cx="-22" cy="8" r="21"/><circle cx="4" cy="-8" r="26"/><circle cx="27" cy="11" r="18"/></g>'
  + '<g fill="#b9a687"><path d="M-40 18a21 21 0 0 0 34 6a26 26 0 0 0 16 4a18 18 0 0 0 30-6a18 18 0 0 1-30 10a26 26 0 0 1-16-4a21 21 0 0 1-34-10z"/></g></svg>';

let S = null; // the beat in progress

const prefersReduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const views = () => [document.getElementById('three-host'), document.getElementById('c2d')].filter(Boolean);

/** Jagged comic balloon outline (SVG points): radii rx×ry round (cx, cy), spikes in to `inner`. */
function burst(cx, cy, rx, ry, spikes, inner, jitter) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + rand(-0.05, 0.05);
    const r = (i % 2 ? inner : 1) * (1 + rand(-jitter, jitter));
    pts.push((cx + Math.cos(a) * rx * r).toFixed(1) + ',' + (cy + Math.sin(a) * ry * r).toFixed(1));
  }
  return pts.join(' ');
}

function el(cls, parent, html = '') {
  const e = document.createElement('div');
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

function cleanup() {
  if (!S) return;
  const s = S;
  S = null;
  cancelAnimationFrame(s.raf);
  for (const v of views()) { v.style.scale = ''; v.style.transformOrigin = ''; }
  document.body.classList.remove('divefx', 'divefx-hold', 'divefx-landed', 'divefx-out');
  s.root.remove(); s.gutter?.remove();
  s.cv.width = s.cv.height = 0; // (iOS counts canvas memory until the backing store is dropped)
}

/** The ink gutter along the wipe's diagonal edge (outside the clipped panel, so it isn't cut). */
function wipeGutter(s) {
  const { W, H } = s, lean = W * 0.18; // (matches df-wipe: the edge's top runs 18% ahead of its bottom)
  const g = el('df-gutter', s.root.parentNode);
  g.style.setProperty('--gh', Math.ceil(Math.hypot(H, lean) + 40) + 'px');
  g.style.setProperty('--gr', Math.atan2(lean, H).toFixed(4) + 'rad');
  g.style.setProperty('--g0', (-lean / 2 - 12).toFixed(0) + 'px');
  g.style.setProperty('--g1', (W + lean / 2).toFixed(0) + 'px');
  g.style.setProperty('--wipe', DIVE_FX.wipeMs + 'ms');
  s.gutter = g;
}

/** Watchdog + the hold: wipe once the zone is ready (or the cap runs out); drop a beat that never landed. */
function tick() {
  if (!S) return;
  const now = performance.now();
  if (!S.impactT) {
    if (now - S.lastPlunge > 1500) { cleanup(); return; } // the dive never landed (mode changed under it)
  } else if (!S.out && S.landed) {
    const t = now - S.impactT;
    const ready = !isLoading() && !document.getElementById('club-loading')?.classList.contains('on');
    if (t > DIVE_FX.loadingAfterMs && !ready) S.tag?.classList.add('loading');
    if (t >= DIVE_FX.holdMs && (ready || t >= DIVE_FX.maxHoldMs)) {
      S.out = true;
      S.root.classList.add('out');
      document.body.classList.add('divefx-out');
      if (!S.reduced) wipeGutter(S);
      setTimeout(cleanup, (S.reduced ? 260 : DIVE_FX.wipeMs) + 40);
    }
  }
  S.raf = requestAnimationFrame(tick);
}

export const diveFx = {
  get active() { return !!S; },

  /** She's diving: put the (empty) overlay up. label: the zone's name for its tag. */
  start(label = '') {
    cleanup();
    const game = document.getElementById('game');
    if (!game) return;
    const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, quality().dpr2d, 1.5);
    const root = el('', game);
    root.id = 'dive-fx';
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    root.appendChild(cv);
    const reduced = prefersReduced();
    if (reduced) root.classList.add('lite');
    S = { root, cv, ctx: cv.getContext('2d'), dpr, W, H, label, reduced, lines: [], frame: 0, lastPlunge: performance.now(), impactT: 0, landed: false, out: false, scale: 1, raf: 0 };
    document.body.classList.add('divefx', 'divefx-hold');
    S.raf = requestAnimationFrame(tick);
  },

  /** One plunge frame: f = 0..1 through the dive, (x, y) = her on screen. */
  plunge(f, x, y) {
    if (!S || S.impactT) return;
    S.lastPlunge = performance.now();
    const { ctx: c, W, H, dpr } = S;
    const k = smooth(0.02, 1, f), lk = smooth(DIVE_FX.linesFrom, 0.75, f); // (the lines come in once the plunge is under way)
    // push-in toward her (the zone's own canvases are reset at the impact)
    S.scale = S.reduced ? 1 : 1 + ((document.body.classList.contains('fly3d') ? DIVE_FX.push : DIVE_FX.push2d) - 1) * k * k;
    for (const v of views()) { v.style.transformOrigin = `${x.toFixed(0)}px ${y.toFixed(0)}px`; v.style.scale = S.scale.toFixed(4); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 20;
    // ink vignette closing in on her
    const vg = c.createRadialGradient(x, y, R * lerp(0.75, 0.35, k), x, y, R);
    vg.addColorStop(0, 'rgba(12,10,24,0)'); vg.addColorStop(1, `rgba(12,10,24,${(0.55 * k).toFixed(3)})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // manga focus lines: tapered wedges from beyond the frame toward her, a third re-rolled per frame
    const n = Math.round((S.reduced ? DIVE_FX.linesLite : DIVE_FX.lines) * lk);
    S.frame++;
    S.lines.length = Math.min(S.lines.length, n);
    for (let i = 0; i < n; i++) {
      if (!S.lines[i] || (i + S.frame) % 3 === 0) S.lines[i] = { a: rand(0, Math.PI * 2), r: rand(0, 0.16), w: rand(3, 12), white: Math.random() < 0.3 };
    }
    const rin = lerp(0.95, 0.2, k);
    for (const white of [false, true]) {
      c.beginPath();
      for (const L of S.lines) {
        if (L.white !== white) continue;
        const ca = Math.cos(L.a), sa = Math.sin(L.a), r0 = R * Math.min(0.98, rin + L.r), w = L.w * (0.5 + k);
        c.moveTo(x + ca * R - sa * w, y + sa * R + ca * w);
        c.lineTo(x + ca * r0, y + sa * r0);
        c.lineTo(x + ca * R + sa * w, y + sa * R - ca * w);
      }
      c.fillStyle = white ? `rgba(255,255,255,${((0.2 + 0.55 * k) * lk).toFixed(3)})` : `rgba(10,10,18,${((0.25 + 0.65 * k) * lk).toFixed(3)})`;
      c.fill();
      if (!white) { c.strokeStyle = `rgba(255,255,255,${(0.35 * k * lk).toFixed(3)})`; c.lineWidth = 1; c.stroke(); } // (ink lines still read at night)
    }
  },

  /**
   * She hits the ground. Call right after the frame is drawn (the game canvases are copied into the
   * impact panel); land() starts the zone on the next frame, once the panel is on screen. gy: the
   * ground's screen y under her (the crater, shockwave and dust sit there), when the view knows it.
   */
  impact(x, y, land, gy = null) {
    if (!S) this.start();
    if (!S) { land(); return; }
    const s = S, { W, H, dpr, root, cv } = s, c = s.ctx;
    s.impactT = performance.now();
    x = clamp(x, W * 0.15, W * 0.85); y = clamp(y, H * 0.25, H * 0.85);
    const ground = gy === null ? y + H * 0.03 : clamp(gy, y + H * 0.03, H * 0.9);
    // 1) the impact panel: this exact frame, copied off the game canvases (same frame: still readable)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    for (const v of views()) {
      const src = v.tagName === 'CANVAS' ? v : v.querySelector('canvas');
      if (!src || !src.width || getComputedStyle(v).display === 'none') continue;
      try { c.drawImage(src, 0, 0, cv.width, cv.height); } catch (e) { /* tainted/lost: skip */ }
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawImpact(c, W, H, x, ground, s.reduced, groundTint(c, cv, dpr, x, ground));
    cv.style.transformOrigin = `${x.toFixed(0)}px ${y.toFixed(0)}px`;
    cv.style.setProperty('--s0', s.scale.toFixed(4));
    cv.style.setProperty('--s1', (s.scale * (s.reduced ? 1 : 1.04)).toFixed(4));
    cv.style.setProperty('--a', s.reduced ? 2 : DIVE_FX.shake);
    for (const v of views()) { v.style.scale = ''; v.style.transformOrigin = ''; } // (hidden under the panel now)
    root.style.setProperty('--x', x.toFixed(0) + 'px'); root.style.setProperty('--y', ground.toFixed(0) + 'px');
    root.style.setProperty('--stop', DIVE_FX.stopMs + 'ms'); root.style.setProperty('--shake', DIVE_FX.shakeMs + 'ms');
    root.style.setProperty('--wipe', DIVE_FX.wipeMs + 'ms');
    root.classList.add('hit');
    // 2) flash, shockwave rings, dust
    el('df-flash', root);
    if (!s.reduced) {
      const rw = Math.min(W, H) * 0.42;
      for (const d of [0, 1]) {
        el('df-ring' + (d ? ' late' : ''), root, `<svg viewBox="0 0 200 80" style="width:${rw}px;height:${rw * 0.4}px;margin:${-rw * 0.2}px 0 0 ${-rw / 2}px"><ellipse cx="100" cy="40" rx="94" ry="34" fill="none" stroke="#111" stroke-width="${d ? 4 : 7}" vector-effect="non-scaling-stroke"/><ellipse cx="100" cy="40" rx="94" ry="34" fill="none" stroke="#fff6c8" stroke-width="${d ? 1.5 : 3}" vector-effect="non-scaling-stroke"/></svg>`);
      }
    }
    // dust: inked cel clouds kicked out sideways along the ground
    const puffs = s.reduced ? 4 : 8, pr = Math.min(W, H);
    for (let i = 0; i < puffs; i++) {
      const side = i % 2 ? 1 : -1, a = (side > 0 ? 0 : Math.PI) + side * rand(-0.5, 0.35);
      const d = pr * rand(0.3, 0.55), sz = pr * rand(0.13, 0.2);
      const p = el('df-puff', root, PUFF);
      p.style.cssText = `width:${sz.toFixed(0)}px;height:${(sz * 0.8).toFixed(0)}px;margin:${(-sz * 0.5).toFixed(0)}px 0 0 ${(-sz / 2).toFixed(0)}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.35 - sz * 0.15).toFixed(0)}px;--d:${rand(0, 60).toFixed(0)}ms;--f:${side}`;
    }
    // 3) the onomatopoeia: a burst balloon + hand-lettered word, popped in with overshoot
    if (comic.enabled) {
      const word = pick(WORDS), [bal, rim, ink, shade] = pick(PALETTES);
      const fs = Math.min(W * 0.1, H * 0.17, 120) * (word.length > 7 ? 0.88 : 1);
      const bw = fs * (word.length * 0.62 + 1.6), bh = fs * 2.05;
      // above the crater (which stays in view), clear of the top HUD
      const wx = clamp(x + W * 0.04, bw / 2 + 12, W - bw / 2 - 12), wy = clamp(y - H * 0.26, bh / 2 + 50, H * 0.55);
      const letters = [...word].map((ch, i, a) => {
        const g = 0.86 + (0.28 * i) / Math.max(1, a.length - 1); // letters swell toward the end
        return `<i style="font-size:${g.toFixed(2)}em;--r:${rand(-7, 7).toFixed(1)}deg;--y:${rand(-0.06, 0.06).toFixed(2)}em">${esc(ch)}</i>`;
      }).join('');
      const w = el('df-word', root, `<svg viewBox="0 0 200 100" preserveAspectRatio="none"><polygon points="${burst(100, 50, 100, 50, 15, 0.7, 0.1)}" fill="${rim}" stroke="#111" stroke-width="3" stroke-linejoin="round"/><polygon points="${burst(100, 50, 80, 39, 13, 0.74, 0.06)}" fill="${bal}" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/></svg><span style="font-size:${fs.toFixed(0)}px;color:${ink};--sh:${shade}">${letters}</span>`);
      w.style.cssText += `;left:${(wx - bw / 2).toFixed(0)}px;top:${(wy - bh / 2).toFixed(0)}px;width:${bw.toFixed(0)}px;height:${bh.toFixed(0)}px;--rot:${rand(-9, -3).toFixed(1)}deg`;
      if (s.label) {
        s.tag = el('df-tag', root, `<b>${esc(s.label)}</b><s><i></i></s>`);
        s.tag.style.cssText = `left:${clamp(wx - bw * 0.3, 14, W - 260).toFixed(0)}px;top:${Math.min(H - 70, wy + bh * 0.42).toFixed(0)}px`;
      }
    }
    sfx.thud();
    // 4) the zone starts on the next frame (this panel has been painted by then; its motion is CSS
    // from here on, so it keeps playing while the zone's first frames block the main thread)
    requestAnimationFrame(() => {
      if (S === s) document.body.classList.add('divefx-landed'); // (the zone's HUD waits under the panel and comes in with the wipe)
      try { land(); } finally { if (S === s) s.landed = true; }
    });
  },

  /** Drop the beat at once (leaving the overworld some other way mid-dive). */
  cancel: cleanup,
};

/** The ground's colour beside (x, y) on the copied frame (CSS px; two patches either side of her) → [r, g, b], or null. */
function groundTint(c, cv, dpr, x, y) {
  try {
    const r = Math.round(20 * dpr);
    let R = 0, G = 0, B = 0, n = 0;
    for (const dx of [-80, 80]) {
      const cx = clamp(Math.round((x + dx) * dpr), r, cv.width - r), cy = clamp(Math.round(y * dpr), r, cv.height - r);
      const px = c.getImageData(cx - r, cy - r, r * 2, r * 2).data;
      for (let i = 0; i < px.length; i += 16) { R += px[i]; G += px[i + 1]; B += px[i + 2]; n++; }
    }
    return n ? [R / n, G / n, B / n] : null;
  } catch (e) { return null; }
}

/**
 * The comic treatment burnt onto the frozen impact frame: halftone, crater, cracks, impact lines.
 * tint: the ground's colour; the cracks are a dark shade of it with a lit lip, so they read as
 * broken pavement round her rather than black legs.
 */
function drawImpact(c, W, H, x, y, lite, tint = null) {
  const shade = (k, a) => tint ? `rgba(${tint.map((v) => Math.round(v * k)).join(',')},${a})` : k < 1 ? `rgba(17,17,17,${a})` : `rgba(255,246,210,${a})`;
  const lip = (a) => tint ? `rgba(${tint.map((v) => Math.round(v + (255 - v) * 0.45)).join(',')},${a})` : `rgba(255,246,210,${a})`;
  const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
  // halftone dots growing toward the frame edges (one path, one fill)
  const sp = DIVE_FX.halftone;
  c.beginPath();
  for (let gy = sp / 2; gy < H; gy += sp) {
    const row = Math.round(gy / sp) % 2 ? sp / 2 : 0;
    for (let gx = sp / 2 + row; gx < W; gx += sp) {
      const e = Math.hypot(gx - x, (gy - y) * 1.3) / R;
      if (e < 0.42) continue;
      const r = sp * 0.48 * smooth(0.42, 1.05, e);
      if (r < 0.6) continue;
      c.moveTo(gx + r, gy); c.arc(gx, gy, r, 0, Math.PI * 2);
    }
  }
  c.fillStyle = 'rgba(14,10,30,.5)'; c.fill();
  // crater: a dark pit with an inked lip, flattened to the ground plane
  const cr = Math.min(W, H) * 0.075;
  c.save(); c.translate(x, y); c.scale(1, 0.42);
  c.fillStyle = 'rgba(20,14,10,.55)'; c.beginPath(); c.arc(0, 0, cr * 1.25, 0, Math.PI * 2); c.fill();
  c.lineWidth = 4; c.strokeStyle = '#111'; c.beginPath();
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2, r = cr * (1 + (i % 2 ? 0.12 : -0.05)); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fillStyle = 'rgba(25,18,14,.75)'; c.fill(); c.stroke();
  c.restore();
  // ground cracks: jagged, tapering, with a pale edge so they read on any ground
  const n = lite ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.25, 0.25), len = Math.min(W, H) * rand(0.2, 0.36);
    let px = x + Math.cos(a) * cr, py = y + Math.sin(a) * cr * 0.42, ang = a;
    const segs = 6;
    for (let sgm = 0; sgm < segs; sgm++) {
      ang += rand(-0.45, 0.45);
      const l = len / segs, nx = px + Math.cos(ang) * l, ny = py + Math.sin(ang) * l * 0.42;
      const w = 5.5 * (1 - sgm / segs) + 0.8;
      c.lineCap = 'round';
      c.strokeStyle = lip(0.6); c.lineWidth = w + 2.5; c.beginPath(); c.moveTo(px, py + 1.5); c.lineTo(nx, ny + 1.5); c.stroke();
      c.strokeStyle = shade(0.28, 0.95); c.lineWidth = w; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
      if (sgm === 2 && Math.random() < 0.6) { // a side branch
        const ba = ang + rand(0.5, 0.9) * (Math.random() < 0.5 ? -1 : 1), bl = l * 1.4;
        c.lineWidth = w * 0.6; c.beginPath(); c.moveTo(nx, ny); c.lineTo(nx + Math.cos(ba) * bl, ny + Math.sin(ba) * bl * 0.42); c.stroke();
      }
      px = nx; py = ny;
    }
  }
  // impact lines: heavy ink wedges from beyond the frame, stopping well short of her
  c.beginPath();
  const m = lite ? 16 : 30;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2 + rand(-0.08, 0.08), ca = Math.cos(a), sa = Math.sin(a);
    const r0 = R * rand(0.48, 0.7), w = rand(6, 16);
    c.moveTo(x + ca * (R + 30) - sa * w, y + sa * (R + 30) + ca * w);
    c.lineTo(x + ca * r0, y + sa * r0);
    c.lineTo(x + ca * (R + 30) + sa * w, y + sa * (R + 30) - ca * w);
  }
  c.fillStyle = 'rgba(10,10,18,.82)'; c.fill();
}
