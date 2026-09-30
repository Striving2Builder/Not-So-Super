// The skyline in the flight view: every building, tree, tank and crane drawn in 2.5D from the
// overworld's perspective camera (V: projection helpers + per-frame light list), plus the night
// lights they queue up (lit windows, neon, headlights, beacons), drawn in one additive pass.
// One sun for everything (north-west), matching the shadows baked into the ground tiles.
import { SUN, glow, headlight } from './cityart.js';
import { hash2 } from './rng.js';
import { clamp, lerp, shade } from './util.js';

const INK = '#0b0b16';
/** Wall tone per face (shade amount): north/west catch the sun, south/east sit in shade. */
const TONE = { s: -0.36, n: -0.08, e: -0.5, w: -0.18 };
/** Lit window colours: warm tungsten, cool office light (glass towers). */
/** Roofs smaller than this (screen px) on both sides drop their detail passes. */
const LOD_PX = 22;
const WINDOW = { warm: [255, 212, 120, 0.85], cool: [170, 215, 255, 0.8] };

export function drawBuilding(ctx, b, V) {
  const { cx, cy, k, P, SX, SY, night } = V;
  if (b.kind === 'tree') {
    const s = P(b.h), gx = SX(b.x), gy = SY(b.y);
    const x = cx + (gx - cx) * s, y = cy + (gy - cy) * s, r = b.rad * k * s;
    // (its shadow is baked into the ground cell)
    ctx.fillStyle = shade(b.col, -0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (V.rich) { ctx.strokeStyle = '#0b1a0e'; ctx.lineWidth = Math.max(0.8, k); ctx.stroke(); }
    ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (b.kind === 'round') {
    const s = P(b.h), gx = SX(b.x), gy = SY(b.y);
    const rx = cx + (gx - cx) * s, ry = cy + (gy - cy) * s;
    const gr = b.rad * k, rr = b.rad * k * s;
    ctx.fillStyle = shade(b.col, -0.3);
    ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(b.col, -0.3); ctx.lineWidth = gr * 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(rx, ry); ctx.stroke();
    if (b.dome) {
      const grd = ctx.createRadialGradient(rx - rr * 0.3, ry - rr * 0.3, rr * 0.1, rx, ry, rr);
      grd.addColorStop(0, '#4a5a4e'); grd.addColorStop(1, '#1a201c');
      ctx.fillStyle = grd;
    } else ctx.fillStyle = shade(b.col, 0.05);
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
    if (b.stack) { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(rx, ry, rr * 0.6, 0, Math.PI * 2); ctx.fill(); }
    if (b.neon) V.lights.push({ t: 'ring', x: rx, y: ry, r: rr, c: b.neon });
    return;
  }
  if (b.kind === 'crane') {
    const s = P(b.h);
    const a = [SX(b.x), SY(b.y)], c = [SX(b.x2), SY(b.y2)];
    const at = [cx + (a[0] - cx) * s, cy + (a[1] - cy) * s], ct = [cx + (c[0] - cx) * s, cy + (c[1] - cy) * s];
    ctx.strokeStyle = shade(b.col, -0.3); ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(at[0], at[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(ct[0], ct[1]); ctx.stroke();
    ctx.strokeStyle = b.col; ctx.lineWidth = 7 * k * s;
    ctx.beginPath(); ctx.moveTo(at[0], at[1]); ctx.lineTo(ct[0], ct[1]);
    const mx = (at[0] + ct[0]) / 2, my = (at[1] + ct[1]) / 2, bx = SX(b.x + 190, b.h), byy = SY((b.y + b.y2) / 2, b.h);
    ctx.moveTo(mx, my); ctx.lineTo(bx, byy); ctx.stroke();
    return;
  }

  const s = P(b.h);
  const gx0 = SX(b.x), gx1 = SX(b.x + b.w), gy0 = SY(b.y), gy1 = SY(b.y + b.d);
  const rx0 = cx + (gx0 - cx) * s, rx1 = cx + (gx1 - cx) * s, ry0 = cy + (gy0 - cy) * s, ry1 = cy + (gy1 - cy) * s;
  // cull: nothing of it (walls or roof) on screen
  if (Math.max(gx1, rx1) < -4 || Math.min(gx0, rx0) > V.W + 4 || Math.max(gy1, ry1) < -4 || Math.min(gy0, ry0) > V.H + 4) return;
  const base = b.col, small = b.container || b.truck;
  // LOD: a building only a few pixels across (high patrol) gets flat walls and roof, no detail
  const lite = rx1 - rx0 < LOD_PX && ry1 - ry0 < LOD_PX;
  // One light for the whole city (sun/moon from the north-west, matching the baked shadows):
  // north and west faces catch it, south and east faces sit in shade.
  const walls = [];
  if (gy1 < cy) walls.push('s');
  if (gy0 > cy) walls.push('n');
  if (gx1 < cx) walls.push('e');
  if (gx0 > cx) walls.push('w');
  const TONE = { s: -0.36, n: -0.08, e: -0.5, w: -0.18 };
  // the edge of face `w` at perspective scale p (1 = ground, s = roof)
  const edge = (w, p) => {
    if (w === 's') return [cx + (gx0 - cx) * p, cy + (gy1 - cy) * p, cx + (gx1 - cx) * p, cy + (gy1 - cy) * p];
    if (w === 'n') return [cx + (gx0 - cx) * p, cy + (gy0 - cy) * p, cx + (gx1 - cx) * p, cy + (gy0 - cy) * p];
    if (w === 'e') return [cx + (gx1 - cx) * p, cy + (gy0 - cy) * p, cx + (gx1 - cx) * p, cy + (gy1 - cy) * p];
    return [cx + (gx0 - cx) * p, cy + (gy0 - cy) * p, cx + (gx0 - cx) * p, cy + (gy1 - cy) * p];
  };
  const band = (w, p0, p1) => { const a = edge(w, p0), c = edge(w, p1); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[0], c[1]); ctx.closePath(); };
  // Ink: comic outlines. Only fills (strokes and big overdraw are what mobile GPUs choke on):
  // thin quads up the wall corners here, and a dark rect under the roof for its rim.
  const small0 = b.container || b.truck;
  const ink = (V.rich || b.h >= 36) && !lite, lw = small0 ? Math.max(0.5, 0.7 * k) : Math.max(0.9, 1.4 * k);
  for (const w of walls) { ctx.fillStyle = shade(base, TONE[w]); ctx.beginPath(); band(w, 1, s); ctx.fill(); }
  if (ink && walls.length && !small0) {
    ctx.fillStyle = INK; ctx.beginPath();
    const line = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * lw * 0.5, ny = (dx / l) * lw * 0.5;
      ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath();
    };
    for (const w of walls) { const a = edge(w, 1), c = edge(w, s); line(a[0], a[1], c[0], c[1]); line(a[2], a[3], c[2], c[3]); }
    ctx.fill();
  }
  const tall = b.h >= 36 && !small && !b.house && !b.ship;
  if (walls.length && V.rich && !small && !lite && b.h * k > 14) { // (skipped where it'd be a sliver)
    // ambient occlusion: the foot of each wall darkens toward the street
    ctx.fillStyle = 'rgba(4,6,20,.3)'; ctx.beginPath();
    const pf = P(Math.min(b.h * 0.35, 30));
    for (const w of walls) band(w, 1, pf);
    ctx.fill();
    // glass: a sky reflection streak up the lit half of each face
    if (b.glass && tall) {
      ctx.fillStyle = 'rgba(200,230,255,.13)'; ctx.beginPath();
      for (const w of walls) {
        const a = edge(w, 1), c = edge(w, s);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], a[2], 0.35), lerp(a[1], a[3], 0.35)); ctx.lineTo(lerp(c[0], c[2], 0.35), lerp(c[1], c[3], 0.35)); ctx.lineTo(c[0], c[1]); ctx.closePath();
      }
      ctx.fill();
    }
  }

  // floor lines by day / lit window rows by night
  if (tall) {
    const floors = Math.min(16, Math.floor(b.h / 13));
    const seed = hash2(b.x | 0, b.y | 0);
    ctx.strokeStyle = b.glass ? 'rgba(220,240,255,.22)' : 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const step = lite ? 2 : 1; // far away: every other floor
    const warm = !b.glass || seed > 0.7;
    for (let f = 1; f < floors; f += step) {
      const p = P((f * b.h) / floors);
      for (const w of walls) {
        const [x1, y1, x2, y2] = edge(w, p);
        if (!lite) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        if (night > 0.2 && hash2(f, walls.length, (seed * 1e6) | 0) > 0.35) V.lights.push({ t: 'win', x1, y1, x2, y2, cool: !warm });
      }
    }
    if (!lite) ctx.stroke();
  }

  // roof (with its inked crease against the walls)
  const rw = rx1 - rx0, rh = ry1 - ry0, u = k * s; // u: roof pixels per world unit
  if (b.house || b.barn) {
    ctx.fillStyle = b.roofCol; ctx.fillRect(rx0, ry0, rw, rh);
    // pitched roof: the half facing away from the sun is darker
    ctx.fillStyle = shade(b.roofCol, -0.3);
    if (rw > rh) ctx.fillRect(rx0, ry0 + rh / 2, rw, rh / 2); else ctx.fillRect(rx0 + rw / 2, ry0, rw / 2, rh);
    ctx.fillStyle = shade(b.roofCol, 0.25);
    if (rw > rh) ctx.fillRect(rx0, ry0 + rh / 2 - u, rw, u * 1.5); else ctx.fillRect(rx0 + rw / 2 - u, ry0, u * 1.5, rh);
    if (b.barn) { ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.strokeRect(rx0 + 2, ry0 + 2, rw - 4, rh - 4); }
  } else {
    const top = b.gold ? '#d8b24a' : shade(base, 0.12);
    if (!small && V.rich && rw > 14) {
      // parapet: a lit rim, the roof deck inside it, and the rim's own shadow on the deck
      const i = clamp(Math.min(rw, rh) * 0.07, 1.2, 4 * u + 1);
      // (thin strips over one deck fill: overdraw is what costs on phones)
      ctx.fillStyle = b.gold ? '#c49a36' : shade(base, 0.02); ctx.fillRect(rx0, ry0, rw, rh);
      ctx.fillStyle = shade(base, 0.32); ctx.beginPath();
      ctx.rect(rx0, ry0, rw, i); ctx.rect(rx0, ry1 - i, rw, i); ctx.rect(rx0, ry0 + i, i, rh - 2 * i); ctx.rect(rx1 - i, ry0 + i, i, rh - 2 * i);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,10,.22)'; ctx.beginPath();
      ctx.rect(rx0 + i, ry0 + i, rw - i * 2, i * 0.9); ctx.rect(rx0 + i, ry0 + i * 1.9, i * 0.9, rh - i * 2.9);
      ctx.fill();
    } else { ctx.fillStyle = top; ctx.fillRect(rx0, ry0, rw, rh); }
    if (b.container || b.corrugated || b.sawtooth) {
      ctx.strokeStyle = b.sawtooth ? 'rgba(180,220,255,.45)' : 'rgba(0,0,0,.2)'; ctx.lineWidth = b.sawtooth ? 3 : 1;
      ctx.beginPath();
      const n = b.container ? 8 : 10;
      for (let i = 1; i < n; i++) {
        if (rw > rh || b.sawtooth) { const x = rx0 + (rw * i) / n; ctx.moveTo(x, ry0 + 2); ctx.lineTo(x, ry1 - 2); }
        else { const y = ry0 + (rh * i) / n; ctx.moveTo(rx0 + 2, y); ctx.lineTo(rx1 - 2, y); }
      }
      ctx.stroke();
    }
    if (b.rooftop && rw > 20) {
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(rx0 + rw * 0.12, ry0 + rh * 0.2, rw * 0.12, rh * 0.18);
      ctx.fillRect(rx0 + rw * 0.7, ry0 + rh * 0.55, rw * 0.1, rh * 0.18);
      ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(rx0 + rw * 0.4, ry0 + rh * 0.5, Math.min(rw, rh) * 0.12, 0, Math.PI * 2); ctx.fill();
    } else if (V.rich && tall && !b.sign && !b.helipad && !b.vents && !b.neon && b.w > 56 && b.d > 56 && rw > 34 && rh > 34) roofKit(ctx, b, rx0, ry0, rw, rh, u, V);
    if (b.skylight) { ctx.fillStyle = 'rgba(160,210,240,.6)'; ctx.fillRect(rx0 + rw * 0.2, ry0 + rh * 0.35, rw * 0.6, rh * 0.3); }
    if (b.helipad) {
      const r = Math.min(rw, rh) * 0.3;
      ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(rx0 + rw / 2, ry0 + rh / 2, r * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f2d23a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rx0 + rw / 2, ry0 + rh / 2, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f2f2f2'; ctx.font = `900 ${r * 1.1}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', rx0 + rw / 2, ry0 + rh / 2 + 1);
      V.lights.push({ t: 'blink', x: rx0 + rw / 2 - r * 1.15, y: ry0 + rh / 2, c: '#40ff70' });
    }
    if (b.vents) {
      ctx.fillStyle = '#39ff6a';
      for (let i = 0; i < 3; i++) ctx.fillRect(rx0 + rw * (0.2 + i * 0.25), ry0 + rh * 0.4, rw * 0.08, rh * 0.2);
    }
    if (b.antenna) V.lights.push({ t: 'blink', x: rx0 + rw / 2, y: ry0 + rh / 2, c: '#ff3030' });
    if (b.awning) {
      // striped shop awning, the comic-strip way
      const t = 6 * u;
      const r = b.face === 'n' ? [rx0, ry0, rw, t] : b.face === 's' ? [rx0, ry1 - t, rw, t] : b.face === 'e' ? [rx1 - t, ry0, t, rh] : [rx0, ry0, t, rh];
      ctx.fillStyle = b.awning; ctx.fillRect(r[0], r[1], r[2], r[3]);
      if (V.rich) {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        const horiz = b.face === 'n' || b.face === 's', n = Math.max(2, Math.floor((horiz ? r[2] : r[3]) / (5 * u + 1)));
        for (let i = 0; i < n; i += 2) {
          if (horiz) ctx.fillRect(r[0] + (r[2] * i) / n, r[1], r[2] / n, r[3]); else ctx.fillRect(r[0], r[1] + (r[3] * i) / n, r[2], r[3] / n);
        }
      }
    }
    if (b.sign && rw > 40) {
      const fs = Math.min(rh * 0.3, rw / b.sign.length * 1.4);
      ctx.font = `900 ${fs}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeStyle = '#0c0c16'; ctx.lineJoin = 'round';
      ctx.strokeText(b.sign, rx0 + rw / 2, ry0 + rh / 2);
      ctx.fillStyle = '#fff6d8'; ctx.fillText(b.sign, rx0 + rw / 2, ry0 + rh / 2);
    }
  }
  if (ink) {
    // inked roof edge: four thin strips
    const e = lw * 0.8;
    ctx.fillStyle = INK; ctx.beginPath();
    ctx.rect(rx0 - e, ry0 - e, rw + 2 * e, 2 * e); ctx.rect(rx0 - e, ry1 - e, rw + 2 * e, 2 * e);
    ctx.rect(rx0 - e, ry0 + e, 2 * e, rh - 2 * e); ctx.rect(rx1 - e, ry0 + e, 2 * e, rh - 2 * e);
    ctx.fill();
  }
  if (b.neon) V.lights.push({ t: 'neon', x: rx0, y: ry0, w: rw, h: rh, c: b.neon, c2: b.neon2, seed: b.x });
}

/**
 * Rooftop clutter for towers and blocks: AC units, a stair bulkhead, a water tower on older
 * buildings or a mechanical penthouse on glass ones. Each piece casts a little shadow down-right
 * (same sun as everything else) so the roofs read as surfaces with things standing on them.
 */
function roofKit(ctx, b, x, y, w, h, u, V) {
  const seed = hash2(b.x | 0, b.y | 0, 17), sh = 'rgba(0,0,12,.35)', ink = INK;
  const box = (fx, fy, bw, bd, lift, col) => {
    const px = x + w * fx, py = y + h * fy, pw = bw * u, pd = bd * u, o = lift * u;
    ctx.fillStyle = sh; ctx.fillRect(px + o * SUN.x * 2.2, py + o * SUN.y * 2.2, pw, pd);
    ctx.fillStyle = col; ctx.fillRect(px, py, pw, pd);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px, py, pw, Math.max(1, pd * 0.22));
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, pd);
  };
  if (b.glass) {
    box(0.3, 0.3, b.w * 0.4, b.d * 0.34, 10, shade(b.col, -0.28));
    box(0.4, 0.38, 7, 7, 5, '#9aa3ad');
    V.lights.push({ t: 'blink', x: x + w * 0.5, y: y + h * 0.47, c: '#ff3030' });
  } else {
    // AC units in a row along one side (placement varies per building so roofs don't repeat)
    const along = seed > 0.5, n = 2 + ((seed * 7) | 0) % 3;
    for (let i = 0; i < n; i++) box(along ? 0.1 + i * 0.16 : 0.74, along ? 0.74 : 0.1 + i * 0.16, 9, 7, 5, i % 2 ? '#aab0b8' : '#c3c8cf');
    if (seed > 0.35) box(0.14, 0.18, 14, 11, 9, shade(b.col, -0.2)); // stair bulkhead
    if (seed > 0.5 && b.h < 180) {
      // water tower: round wooden tank on legs
      const r = 7.5 * u, px = x + w * 0.66, py = y + h * 0.64;
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(px + 26 * u * SUN.x, py + 26 * u * SUN.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5236'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.arc(px + r * 0.15, py + r * 0.15, r * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,180,.35)'; ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
    } else box(0.62, 0.6, 9, 9, 5, '#c3c7cc');
  }
}

export function drawLights(ctx, V) {
  const n = V.night;
  const L = V.lights;
  if (n > 0.2) {
    // lit window rows: mostly warm tungsten, glass towers cooler office light
    ctx.lineWidth = Math.max(1.5, 2.4 * V.k);
    ctx.setLineDash([3, 4]);
    for (const cool of [false, true]) {
      const [r, g, bl, a] = cool ? WINDOW.cool : WINDOW.warm;
      ctx.strokeStyle = `rgba(${r},${g},${bl},${a * n})`;
      ctx.beginPath();
      for (const l of L) if (l.t === 'win' && !!l.cool === cool) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) {
    if (l.t === 'glow') {
      if (n < 0.2) continue;
      ctx.globalAlpha = (l.a ?? 0.6) * n;
      ctx.drawImage(glow(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    } else if (l.t === 'beam') {
      if (n < 0.2) continue;
      ctx.globalAlpha = 0.45 * n;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a);
      ctx.drawImage(headlight(), 0, -l.r * 0.3, l.r, l.r * 0.6);
      ctx.restore();
    } else if (l.t === 'neon') {
      const flick = Math.sin(V.t * 7 + l.seed) > -0.9 ? 1 : 0.3;
      ctx.globalAlpha = (0.35 + 0.65 * n) * flick;
      ctx.strokeStyle = l.c; ctx.lineWidth = 6; ctx.globalAlpha *= 0.35;
      ctx.strokeRect(l.x, l.y, l.w, l.h);
      ctx.globalAlpha = (0.35 + 0.65 * n) * flick;
      ctx.lineWidth = 2; ctx.strokeRect(l.x + 1, l.y + 1, l.w - 2, l.h - 2);
      if (l.c2) { ctx.strokeStyle = l.c2; ctx.strokeRect(l.x + 6, l.y + 6, l.w - 12, l.h - 12); }
    } else if (l.t === 'ring') {
      ctx.globalAlpha = 0.4 + 0.6 * n;
      ctx.strokeStyle = l.c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.stroke();
    } else if (l.t === 'blink') {
      if (Math.sin(V.t * 4 + l.x * 0.01) < 0) continue;
      ctx.globalAlpha = 1;
      ctx.drawImage(glow(l.c), l.x - 12, l.y - 12, 24, 24);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
