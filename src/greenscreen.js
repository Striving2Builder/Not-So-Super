// Green-screen compositing: video (or any image source) played inside the green screen of a painted
// still — a billboard seen at an angle, a cell TV, the capture room's monitor. Story is told through
// these clips, so this is shared by every place that shows one (cutscenes, the capture scene, …).
//
//   const scr = await loadScreen('assets/asylum/tv/asylum-tv02.webp');
//   drawScreen(ctx, scr, video, x, y, w, h);   // each frame: clip warped into the screen, still on top
//
// Keying is by hue, not exact RGB: some screens are painted pure #00ff00, others a darker, lit green.
// The screen is the largest green region (stray green — plants, neon — is ignored); its four corners
// give a homography, so a tilted billboard gets true perspective, not a skewed rectangle.

const cache = new Map(); // url → Promise<screen>

/** Load a still and find its screen. Resolves to { img, keyed, quad, w, h } or null (no screen). */
export function loadScreen(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((res) => {
      const img = new Image();
      img.onload = () => res(analyse(img));
      img.onerror = () => res(null);
      img.src = url;
    }));
  }
  return cache.get(url);
}

function isGreen(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx !== g || mx < 60) return false;            // green must dominate and not be near-black
  const s = (mx - mn) / mx;
  return s > 0.35 && g > r * 1.3 && g > b * 1.15;   // saturated green, not teal/olive/grey
}

function analyse(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  // 1) find the screen on a small copy (fast flood fill), 2) key the full-size copy inside it
  const S = 4, sw = Math.ceil(w / S), sh = Math.ceil(h / S);
  const small = canvas(sw, sh), sx = small.getContext('2d', { willReadFrequently: true });
  sx.drawImage(img, 0, 0, sw, sh);
  const sp = sx.getImageData(0, 0, sw, sh).data;
  const mask = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) mask[i] = isGreen(sp[i * 4], sp[i * 4 + 1], sp[i * 4 + 2]) ? 1 : 0;
  // largest 4-connected component = the screen
  const label = new Int32Array(sw * sh), stack = [];
  let best = 0, bestId = 0, id = 0;
  for (let i = 0; i < sw * sh; i++) {
    if (!mask[i] || label[i]) continue;
    id++; let n = 0; stack.push(i); label[i] = id;
    while (stack.length) {
      const j = stack.pop(); n++;
      const x = j % sw, y = (j / sw) | 0;
      for (const k of [x > 0 && j - 1, x < sw - 1 && j + 1, y > 0 && j - sw, y < sh - 1 && j + sw]) {
        if (k !== false && mask[k] && !label[k]) { label[k] = id; stack.push(k); }
      }
    }
    if (n > best) { best = n; bestId = id; }
  }
  if (best < sw * sh * 0.01) return null; // no screen worth the name
  // corners: extreme points along the diagonals (works for rectangles seen in perspective)
  let tl = [1e9, 0, 0], tr = [-1e9, 0, 0], br = [-1e9, 0, 0], bl = [1e9, 0, 0];
  for (let i = 0; i < sw * sh; i++) {
    if (label[i] !== bestId) continue;
    const x = i % sw, y = (i / sw) | 0;
    if (x + y < tl[0]) tl = [x + y, x, y];
    if (x + y > br[0]) br = [x + y, x, y];
    if (x - y > tr[0]) tr = [x - y, x, y];
    if (x - y < bl[0]) bl = [x - y, x, y];
  }
  const pad = 0.5; // half a small pixel outward so the clip tucks under the frame's edge
  const quad = [[tl[1] - pad, tl[2] - pad], [tr[1] + 1 + pad, tr[2] - pad], [br[1] + 1 + pad, br[2] + 1 + pad], [bl[1] - pad, bl[2] + 1 + pad]]
    .map(([x, y]) => [x * S, y * S]);
  // key the full-size still: screen pixels (inside the component's bounds) → transparent, with
  // green spill pulled out of the edge pixels so no green fringe shows around the clip
  const full = canvas(w, h), fx = full.getContext('2d', { willReadFrequently: true });
  fx.drawImage(img, 0, 0);
  const id2 = fx.getImageData(0, 0, w, h), d = id2.data;
  const x0 = Math.max(0, Math.min(...quad.map((q) => q[0])) - S), x1 = Math.min(w, Math.max(...quad.map((q) => q[0])) + S);
  const y0 = Math.max(0, Math.min(...quad.map((q) => q[1])) - S), y1 = Math.min(h, Math.max(...quad.map((q) => q[1])) + S);
  for (let y = y0 | 0; y < y1; y++) {
    for (let x = x0 | 0; x < x1; x++) {
      const o = (y * w + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
      const inScreen = label[((y / S) | 0) * sw + ((x / S) | 0)] === bestId || label[Math.min(sh - 1, (y / S) | 0) * sw + Math.min(sw - 1, ((x + S / 2) / S) | 0)] === bestId;
      if (inScreen && isGreen(r, g, b)) d[o + 3] = 0;
      else if (g > Math.max(r, b)) d[o + 1] = Math.max(r, b); // despill
    }
  }
  fx.putImageData(id2, 0, 0);
  return { img, keyed: full, quad, w, h };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Homography from the unit square to quad (p0 TL, p1 TR, p2 BR, p3 BL).
function homography(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
  return (u, v) => { const z = g * u + hh * v + 1; return [(a * u + b * v + c) / z, (d * u + e * v + f) / z]; };
}

const GRID = 8; // mesh cells per side: enough that affine triangles track the perspective warp

/**
 * Draw one frame: `src` (video / canvas / image; null = no signal) warped into the screen, then the
 * keyed still on top, all fitted into the destination rect (dx, dy, dw, dh) at the still's aspect.
 */
export function drawScreen(ctx, scr, src, dx, dy, dw, dh) {
  const k = Math.min(dw / scr.w, dh / scr.h), ox = dx + (dw - scr.w * k) / 2, oy = dy + (dh - scr.h * k) / 2;
  const H = homography(scr.quad.map(([x, y]) => [ox + x * k, oy + y * k]));
  const sw = src ? (src.videoWidth || src.naturalWidth || src.width) : 0, sh = src ? (src.videoHeight || src.naturalHeight || src.height) : 0;
  if (src && sw && sh) {
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const u0 = i / GRID, u1 = (i + 1) / GRID, v0 = j / GRID, v1 = (j + 1) / GRID;
        const p00 = H(u0, v0), p10 = H(u1, v0), p11 = H(u1, v1), p01 = H(u0, v1);
        tri(ctx, src, [u0 * sw, v0 * sh], [u1 * sw, v0 * sh], [u1 * sw, v1 * sh], p00, p10, p11);
        tri(ctx, src, [u0 * sw, v0 * sh], [u1 * sw, v1 * sh], [u0 * sw, v1 * sh], p00, p11, p01);
      }
    }
  } else {
    // no signal: dark screen with a little static
    ctx.save(); ctx.beginPath();
    const c = [H(0, 0), H(1, 0), H(1, 1), H(0, 1)];
    ctx.moveTo(...c[0]); for (const p of c.slice(1)) ctx.lineTo(...p); ctx.closePath();
    ctx.fillStyle = '#0b0f14'; ctx.fill(); ctx.clip();
    for (let n = 0; n < 220; n++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; ctx.fillRect(ox + Math.random() * scr.w * k, oy + Math.random() * scr.h * k, 2, 2); }
    ctx.restore();
  }
  ctx.drawImage(scr.keyed, ox, oy, scr.w * k, scr.h * k);
}

// Map source triangle (s0,s1,s2) onto destination triangle (d0,d1,d2), clipped, slightly expanded so
// neighbouring triangles leave no hairline seams.
function tri(ctx, src, s0, s1, s2, d0, d1, d2) {
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, grow = (p) => [p[0] + Math.sign(p[0] - cx) * 1.1, p[1] + Math.sign(p[1] - cy) * 1.1];
  const [e0, e1, e2] = [grow(d0), grow(d1), grow(d2)];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(...e0); ctx.lineTo(...e1); ctx.lineTo(...e2); ctx.closePath(); ctx.clip();
  // solve the affine transform taking s → d
  const [sx0, sy0] = s0, [sx1, sy1] = s1, [sx2, sy2] = s2;
  const den = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0) || 1e-9;
  const a = ((d1[0] - d0[0]) * (sy2 - sy0) - (d2[0] - d0[0]) * (sy1 - sy0)) / den;
  const b = ((d1[1] - d0[1]) * (sy2 - sy0) - (d2[1] - d0[1]) * (sy1 - sy0)) / den;
  const c = ((d2[0] - d0[0]) * (sx1 - sx0) - (d1[0] - d0[0]) * (sx2 - sx0)) / den;
  const d = ((d2[1] - d0[1]) * (sx1 - sx0) - (d1[1] - d0[1]) * (sx2 - sx0)) / den;
  ctx.transform(a, b, c, d, d0[0] - a * sx0 - c * sy0, d0[1] - b * sx0 - d * sy0);
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}
