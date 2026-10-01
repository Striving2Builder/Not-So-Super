// Street-fight building facades, painted once per building into a cached canvas (brawlstage bakes and
// places them). Local coordinates: x from the facade's left edge, y up is negative, ground at y = 0.
// Everything is inked, halftone-shaded, and lived-in: shop interiors behind the glass, named neon with
// icons, posters, grime streaks, and graffiti pieces only on the big blank walls where a crew would paint.
import { shade, rgba } from './util.js';
import { RNG } from './rng.js';
import { INK, pen } from './brawlpaint.js';

// Crew graffiti: bubble-letter pieces for warehouse walls (never sound-effect words, which read as UI).
export const TAGS = ['RATZ', 'KINGZ', 'SK8', 'B-BOYZ', 'LOVE', 'DOVE', 'GRIT', 'ACE'];
export const POSTERS = [['WANTED', '#f2e6c4', '#7a1f1f'], ['VOTE!', '#2a5ab8', '#fff'], ['LIVE!', '#e0402a', '#ffe14a'], ['SALE', '#ffe14a', '#d8122e'], ['LOST CAT', '#fff', '#222']];
// Shop interiors by sign word: food places get a counter + stools, the rest shelves of stock.
const EATERY = new Set(['DELI', 'PIZZA', 'BAKERY', 'DINER']);
const NEON_ICONS = ['star', 'glass', 'note', 'heart', 'dice'];

/** Paint facade `f` (lit = night windows on). Records neon glow placement on `out.neon`. */
export function paintFacade(g, f, lit, out) {
  const w = f.w, h = f.h, st = f.kind, r = new RNG(f.seed);
  const { ink, box, tone } = pen(g);
  const win = (x, y, ww, wh, on) => {
    box(x - 1.5, y - 1.5, ww + 3, wh + 3, shade(f.col, 0.25), 1.2);
    if (on) { g.fillStyle = r.pick(['#ffd98a', '#ffe7b0', '#ffc070']); g.fillRect(x, y, ww, wh); if (r.chance(0.3)) { g.fillStyle = 'rgba(60,30,40,.55)'; g.beginPath(); g.arc(x + ww * 0.5, y + wh * 0.62, ww * 0.18, 0, Math.PI * 2); g.fillRect(x + ww * 0.3, y + wh * 0.72, ww * 0.4, wh * 0.3); g.fill(); } }
    else {
      const gl = g.createLinearGradient(x, y, x, y + wh);
      gl.addColorStop(0, lit ? '#2a3050' : '#bfe0f8'); gl.addColorStop(1, lit ? '#141828' : '#5a86b8');
      g.fillStyle = gl; g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + ww * 0.15, y + wh); g.lineTo(x + ww * 0.45, y); g.lineTo(x + ww * 0.6, y); g.lineTo(x + ww * 0.3, y + wh); g.fill();
    }
    if (r.chance(0.35)) { g.fillStyle = rgba(r.pick(['#d8122e', '#ffffff', '#2a5ab8', '#e0a020']), 0.75); g.fillRect(x, y, ww, wh * 0.28); } // blinds/curtain
    g.beginPath(); g.rect(x, y, ww, wh); ink(1.2);
    g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.strokeStyle = shade(f.col, 0.25); g.lineWidth = 1.2; g.stroke();
    box(x - 3, y + wh + 1.5, ww + 6, 3, shade(f.col, 0.35), 1);
    // rain grime under the sill
    const gr = g.createLinearGradient(0, y + wh + 4, 0, y + wh + 22); gr.addColorStop(0, 'rgba(20,12,24,.16)'); gr.addColorStop(1, 'rgba(20,12,24,0)');
    g.fillStyle = gr; g.fillRect(x + ww * 0.1, y + wh + 4, ww * 0.8, 18);
  };

  if (st === 'houses') {
    box(-20, -18, w + 60, 18, '#5f8a4a', 0); // lawn strip
    box(0, -h * 0.65, w, h * 0.65 - 18, f.col);
    tone(0, -h * 0.65, w * 0.18, h * 0.65 - 18, 0.18);
    g.beginPath(); g.moveTo(-14, -h * 0.63); g.lineTo(w / 2, -h); g.lineTo(w + 14, -h * 0.63); g.closePath(); g.fillStyle = '#6a3a2a'; g.fill(); ink(1.8);
    g.save(); g.clip(); tone(w / 2, -h, w, h * 0.4, 0.25); g.restore();
    win(w * 0.14, -h * 0.5, w * 0.2, h * 0.17, lit && r.chance(0.7)); win(w * 0.66, -h * 0.5, w * 0.2, h * 0.17, lit && r.chance(0.6));
    box(w * 0.43, -h * 0.42, w * 0.14, h * 0.42 - 18, '#6b3a24'); g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w * 0.54, -h * 0.2, 1.8, 0, Math.PI * 2); g.fill();
    for (let i = -20; i < w + 40; i += 11) box(i, -15, 4, 15, '#f2f2ea', 1); // picket fence
    box(-20, -11, w + 60, 3, '#f2f2ea', 1);
    return;
  }
  if (st === 'farm') {
    if (f.barn) {
      box(0, -h * 0.7, w * 0.7, h * 0.7, '#a8322d');
      for (let x = 6; x < w * 0.7; x += 8) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, -h * 0.7, 1.4, h * 0.7); }
      g.beginPath(); g.moveTo(-10, -h * 0.68); g.lineTo(w * 0.35, -h); g.lineTo(w * 0.7 + 10, -h * 0.68); g.closePath(); g.fillStyle = '#6a2a24'; g.fill(); ink(1.8);
      g.strokeStyle = '#eee'; g.lineWidth = 3; g.strokeRect(w * 0.2, -h * 0.45, w * 0.3, h * 0.45);
      g.beginPath(); g.moveTo(w * 0.2, -h * 0.45); g.lineTo(w * 0.5, 0); g.moveTo(w * 0.5, -h * 0.45); g.lineTo(w * 0.2, 0); g.stroke();
      box(w * 0.78, -h - 20, w * 0.16, h + 20, '#c9c9c0'); g.beginPath(); g.arc(w * 0.86, -h - 20, w * 0.08, Math.PI, 0); g.fillStyle = '#9aa0a8'; g.fill(); ink();
      tone(w * 0.78, -h - 20, w * 0.05, h + 20, 0.25);
    } else {
      box(-40, -50, w + 80, 50, '#c9b25a');
      for (let i = 0; i < 6; i++) { g.fillStyle = '#b89e48'; g.fillRect(-40, -50 + i * 9, w + 80, 3); }
    }
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, -18); g.lineTo(w + 60, -18); g.moveTo(-60, -8); g.lineTo(w + 60, -8); g.stroke();
    for (let x = -60; x < w + 60; x += 30) box(x, -24, 4, 24, '#7a5a30', 1);
    return;
  }
  if (st === 'docks') {
    for (let i = 0; i < f.stack; i++) {
      const cw = w * 0.9, ch = 40, cy = -ch * (i + 1), col = shade(f.col, -i * 0.1);
      box(0, cy, cw, ch - 2, col, 1.8);
      for (let j = 4; j < cw; j += 7) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(j, cy + 2, 2, ch - 6); }
      tone(cw * 0.75, cy, cw * 0.25, ch - 2, 0.25);
      g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '900 9px Impact, system-ui'; g.textAlign = 'left'; g.fillText(r.pick(['CARGO', 'MAERK', 'EVERG', 'PORT 9']), 8, cy + 14);
    }
    return;
  }

  // ---- city block building
  const industrial = st === 'warehouses' || st === 'factory';
  const wall = g.createLinearGradient(0, -h, 0, 0);
  wall.addColorStop(0, shade(f.col, 0.1)); wall.addColorStop(1, shade(f.col, -0.12));
  g.beginPath(); g.rect(0, -h, w, h); g.fillStyle = wall; g.fill();
  if (st === 'towers') {
    // curtain wall: sky reflection bands + mullions
    const gl = g.createLinearGradient(0, -h, w, 0);
    gl.addColorStop(0, lit ? '#1c2a48' : '#a8d4f4'); gl.addColorStop(0.5, lit ? '#101a30' : '#5a8ec8'); gl.addColorStop(1, lit ? '#22335a' : '#8ab8e8');
    g.fillStyle = gl; g.fillRect(4, -h + 6, w - 8, h - 60);
    g.strokeStyle = shade(f.col, -0.3); g.lineWidth = 1.4;
    for (let x = 4; x < w - 4; x += 22) { g.beginPath(); g.moveTo(x, -h + 6); g.lineTo(x, -54); g.stroke(); }
    for (let y = -h + 6; y < -54; y += 18) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); }
    if (lit) for (let y = -h + 8; y < -56; y += 18) for (let x = 6; x < w - 6; x += 22) if (r.chance(0.35)) { g.fillStyle = 'rgba(255,220,140,.8)'; g.fillRect(x, y, 18, 14); }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(w * 0.2, -54); g.lineTo(w * 0.55, -h); g.lineTo(w * 0.7, -h); g.lineTo(w * 0.35, -54); g.fill();
  } else if (industrial) {
    for (let x = 3; x < w; x += 7) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(x, -h, 2.2, h); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2.2, -h, 1.2, h); }
    for (let x = 10; x < w - 30; x += 34) box(x, -h + 14, 24, 12, lit ? '#e8c060' : '#6a8aa0', 1.2); // clerestory windows
    // roll-up door + hazard stripes
    box(w * 0.18, -h * 0.55, w * 0.46, h * 0.55, '#5a5d62');
    for (let y = -h * 0.55 + 5; y < 0; y += 6) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(w * 0.18, y, w * 0.46, 1.6); }
    g.save(); g.beginPath(); g.rect(w * 0.18, -h * 0.55 - 7, w * 0.46, 6); g.clip();
    g.fillStyle = '#f2c21a'; g.fillRect(w * 0.18, -h * 0.55 - 7, w * 0.46, 6); g.fillStyle = INK;
    for (let x = w * 0.18 - 8; x < w * 0.64; x += 10) { g.beginPath(); g.moveTo(x, -h * 0.55 - 1); g.lineTo(x + 5, -h * 0.55 - 7); g.lineTo(x + 10, -h * 0.55 - 7); g.lineTo(x + 5, -h * 0.55 - 1); g.fill(); }
    g.restore();
    if (st === 'factory') { box(w * 0.78, -h - 120, 22, 120, '#7a5a4a'); g.fillStyle = '#d8d0c0'; g.fillRect(w * 0.78, -h - 110, 22, 5); g.fillRect(w * 0.78, -h - 80, 22, 5); }
  } else {
    if (st === 'apartments' || st === 'mixed') for (let y = -h + 4; y < -56; y += 6) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y, w, 1); }
    const cols = Math.max(2, Math.floor(w / 42)), ww = w / cols;
    const rows = Math.max(1, Math.floor((h - 76) / 40));
    for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
      const on = lit && r.chance(st === 'clubs' || st === 'lair' ? 0.35 : 0.55);
      win(cc * ww + ww * 0.22, -h + 20 + rr * 40, ww * 0.56, 24, on);
      if (!lit && r.chance(0.12)) box(cc * ww + ww * 0.3, -h + 20 + rr * 40 + 25, ww * 0.4, 9, '#b8bcc0', 1.2); // AC unit
    }
    if (f.escape && cols >= 2) {
      const ex = ww * 0.12, ew = ww * 1.76;
      g.strokeStyle = INK; g.lineWidth = 1.6;
      for (let rr = 0; rr < rows; rr++) {
        const py = -h + 20 + rr * 40 + 30;
        g.fillStyle = '#23202a'; g.fillRect(ex, py, ew, 3);
        g.beginPath(); for (let x = ex; x <= ex + ew; x += 5) { g.moveTo(x, py); g.lineTo(x, py - 10); } g.moveTo(ex, py - 10); g.lineTo(ex + ew, py - 10); g.lineWidth = 1; g.stroke();
        if (rr < rows - 1) { g.beginPath(); g.moveTo(ex + (rr % 2 ? ew * 0.2 : ew * 0.8), py); g.lineTo(ex + (rr % 2 ? ew * 0.8 : ew * 0.2), py + 40); g.lineWidth = 2; g.stroke(); }
      }
    }
  }
  // cornice + its shadow, and grime streaking down from it
  box(-3, -h - 4, w + 6, 8, shade(f.col, 0.28), 1.6);
  tone(0, -h + 4, w, 8, 0.3);
  for (let i = 0; i < 4; i++) {
    const sx = r.range(4, w - 10), sl = r.range(20, 60);
    const gr = g.createLinearGradient(0, -h + 4, 0, -h + 4 + sl); gr.addColorStop(0, 'rgba(20,12,24,.14)'); gr.addColorStop(1, 'rgba(20,12,24,0)');
    g.fillStyle = gr; g.fillRect(sx, -h + 4, r.range(4, 9), sl);
  }
  // ground floor
  const gf = 58;
  if (!industrial) {
    box(0, -gf, w, gf, shade(f.col, -0.32));
    const sx0 = w * 0.08, sw0 = w * 0.5, sy0 = -gf * 0.82, sh0 = gf * 0.6;
    paintInterior(g, r, sx0, sy0, sw0, sh0, lit, f.sign);
    box(w * 0.66, -gf * 0.86, w * 0.19, gf * 0.86, '#3a2418', 1.8); // door
    box(w * 0.69, -gf * 0.76, w * 0.13, gf * 0.3, lit ? '#ffd98a' : '#6a90b0', 1.2);
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w * 0.82, -gf * 0.4, 1.6, 0, Math.PI * 2); g.fill();
  }
  // awning: stripes, scalloped edge, halftone underside shadow
  if (f.awn) {
    const ay = -gf - 4, ah = 16;
    g.save(); g.beginPath(); g.moveTo(2, ay - ah); g.lineTo(w - 2, ay - ah); g.lineTo(w + 6, ay); g.lineTo(-6, ay); g.closePath(); g.clip();
    g.fillStyle = f.awn; g.fillRect(-6, ay - ah, w + 12, ah);
    g.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -6; x < w + 6; x += 14) g.fillRect(x, ay - ah, 7, ah);
    g.restore();
    g.beginPath(); g.moveTo(2, ay - ah); g.lineTo(w - 2, ay - ah); g.lineTo(w + 6, ay); g.lineTo(-6, ay); g.closePath(); ink(1.6);
    g.beginPath(); for (let x = -6; x < w + 6; x += 10) g.arc(x + 5, ay, 5, 0, Math.PI); g.fillStyle = f.awn; g.fill(); ink(1.3);
    tone(0, ay + 5, w, 12, 0.3);
  }
  if (f.sign) {
    const neon = f.neon && (st === 'clubs' || st === 'casino' || st === 'venues' || st === 'lair');
    const sy = -gf - (f.awn ? 34 : 20), sw = w * 0.72, sh = 24;
    if (neon) out.neon = paintNeon(g, f, w / 2, sy, sw, sh, lit, r);
    else {
      box(w / 2 - sw / 2, sy - sh / 2, sw, sh, '#f2ead8', 2);
      box(w / 2 - sw / 2 + 3, sy - sh / 2 + 3, sw - 6, sh - 6, 'rgba(0,0,0,0)', 1);
      g.font = `900 ${Math.min(17, (sw / f.sign.length) * 1.45)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = f.awn || '#d8122e'; g.fillText(f.sign, w / 2 + 1, sy + 2); g.fillStyle = INK; g.fillText(f.sign, w / 2, sy + 1);
    }
  }
  if (f.poster) {
    const [txt, bg, fg] = f.poster;
    g.save();
    if (industrial) g.translate(w * 0.8, -40); else g.translate(w * 0.58 - 60 < 0 ? w * 0.58 : w * 0.03 + 12, -gf - 32);
    g.rotate(r.range(-0.1, 0.1)); box(-10, -13, 20, 26, bg, 1.2); g.fillStyle = fg; g.font = '900 5px Impact, system-ui'; g.textAlign = 'center'; g.fillText(txt, 0, -5); g.fillRect(-6, -1, 12, 10);
    g.restore();
  }
  // graffiti: a deliberate bubble-letter piece on blank industrial wall, with drips
  if (f.tag && industrial) paintPiece(g, f.tag, f.tagCol, w * 0.82, -h * 0.3, Math.min(40, w * 0.3), r);
  tone(0, -h, 7, h, 0.35); // building side shade
  g.beginPath(); g.rect(0, -h, w, h); ink(2.2);
  const gr = g.createLinearGradient(0, -14, 0, 0); gr.addColorStop(0, 'rgba(20,12,20,0)'); gr.addColorStop(1, 'rgba(20,12,20,.4)');
  g.fillStyle = gr; g.fillRect(0, -14, w, 14);
}

/** A shop window with its interior painted in: back wall, lamps, stock or a counter, maybe the owner. */
function paintInterior(g, r, x, y, w, h, lit, sign) {
  const { ink, box } = pen(g);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const bw = g.createLinearGradient(0, y, 0, y + h);
  bw.addColorStop(0, lit ? '#ffe2a8' : '#efe0c4'); bw.addColorStop(1, lit ? '#c98a4a' : '#b8987a');
  g.fillStyle = bw; g.fillRect(x, y, w, h);
  // pendant lamps
  for (let i = 0; i < 2; i++) {
    const lx = x + w * (0.3 + i * 0.4);
    g.strokeStyle = INK; g.lineWidth = 0.8; g.beginPath(); g.moveTo(lx, y); g.lineTo(lx, y + 5); g.stroke();
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(lx - 3, y + 8); g.lineTo(lx + 3, y + 8); g.lineTo(lx + 1.5, y + 5); g.lineTo(lx - 1.5, y + 5); g.fill();
    g.fillStyle = 'rgba(255,240,180,.5)'; g.beginPath(); g.moveTo(lx - 3, y + 8); g.lineTo(lx + 3, y + 8); g.lineTo(lx + 9, y + h * 0.6); g.lineTo(lx - 9, y + h * 0.6); g.fill();
  }
  const cols = ['#d8122e', '#2a5ab8', '#e0a020', '#3a8a5a', '#8a3ab8', '#f2f2ea', '#e86a2a'];
  if (EATERY.has(sign)) {
    // counter with stools and a menu board
    box(x + 4, y + 7, w * 0.34, 9, '#2a2a2a', 1); g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) g.fillRect(x + 7, y + 9 + i * 2.2, w * 0.2 - i * 4, 1);
    box(x - 2, y + h * 0.62, w + 4, h * 0.14, '#b8452f', 1.2);
    for (let i = 0; i < 4; i++) { const sx = x + w * (0.15 + i * 0.22); box(sx - 4, y + h * 0.54, 8, 3, '#d8122e', 1); g.fillStyle = '#555'; g.fillRect(sx - 0.8, y + h * 0.57, 1.6, h * 0.4); }
    if (r.chance(0.7)) person(g, x + w * 0.62, y + h * 0.62, r);
  } else {
    // shelves of stock
    for (const sy of [0.36, 0.6]) {
      g.fillStyle = '#6a4a2a'; g.fillRect(x, y + h * sy, w, 1.8);
      let px = x + 2;
      while (px < x + w - 4) {
        const iw = r.range(2.5, 5), ih = r.range(3, 7);
        g.fillStyle = r.pick(cols); g.fillRect(px, y + h * sy - ih, iw, ih);
        g.strokeStyle = 'rgba(20,12,24,.55)'; g.lineWidth = 0.6; g.strokeRect(px, y + h * sy - ih, iw, ih);
        px += iw + r.range(0.5, 2);
      }
    }
    box(x + w * 0.58, y + h * 0.74, w * 0.44, h * 0.3, '#5a3a24', 1.2); // till counter
    box(x + w * 0.7, y + h * 0.66, 6, 5, '#333', 0.8);
    if (r.chance(0.55)) person(g, x + w * 0.8, y + h * 0.74, r);
  }
  g.restore();
  // glass: sky/street reflection streaks, frame, and a painted window decal
  g.fillStyle = lit ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.3)';
  g.beginPath(); g.moveTo(x + w * 0.1, y + h); g.lineTo(x + w * 0.35, y); g.lineTo(x + w * 0.46, y); g.lineTo(x + w * 0.21, y + h); g.fill();
  g.beginPath(); g.moveTo(x + w * 0.52, y + h); g.lineTo(x + w * 0.62, y); g.lineTo(x + w * 0.66, y); g.lineTo(x + w * 0.56, y + h); g.fill();
  g.beginPath(); g.rect(x, y, w, h); ink(2);
  if (r.chance(0.6)) { g.fillStyle = rgba('#ffffff', 0.85); g.font = 'italic 900 5.5px Georgia, serif'; g.textAlign = 'center'; g.fillText(r.pick(['OPEN', 'Since 1952', 'EST. 1978', 'Fresh Daily', '24 HRS']), x + w * 0.5, y + h - 3); }
}

/** A shopkeeper/patron silhouette from the waist up, standing behind something at y. */
function person(g, x, y, r) {
  g.fillStyle = r.pick(['#2a3a5a', '#6a2a2a', '#2a4a2a', '#4a3a5a']);
  g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x - 6, y - 11, x, y - 11); g.quadraticCurveTo(x + 6, y - 11, x + 6, y); g.fill();
  g.fillStyle = r.pick(['#f1c7a5', '#b57a55', '#8a5a3b']); g.beginPath(); g.arc(x, y - 14, 3.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1d15'; g.beginPath(); g.arc(x, y - 15, 3.8, Math.PI, 0); g.fill();
}

/** Named neon: dark backing board, glass-tube lettering in a script face and an icon. Returns glow spot. */
function paintNeon(g, f, cx, sy, sw, sh, lit, r) {
  const { box } = pen(g);
  const word = f.sign.split(' ').map((s) => s[0] + s.slice(1).toLowerCase()).join(' ');
  box(cx - sw / 2, sy - sh / 2, sw, sh, '#120e1a', 2);
  g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) g.fillRect(cx - sw / 2 + 3 + i * (sw - 6) / 6, sy - sh / 2 + 2, 0.8, sh - 4); // mounting rails
  const icon = NEON_ICONS[f.seed % NEON_ICONS.length], ix = cx - sw / 2 + 12, tx = cx + 6;
  const tube = (draw) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 3.4; g.strokeStyle = rgba(f.neon, 0.45); draw();
    g.lineWidth = 1.4; g.strokeStyle = lit ? '#ffffff' : f.neon; draw();
  };
  // icon in tube strokes
  tube(() => {
    g.beginPath();
    if (icon === 'star') for (let i = 0; i < 11; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 3 : 7; g.lineTo(ix + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
    else if (icon === 'glass') { g.moveTo(ix - 6, sy - 6); g.lineTo(ix + 6, sy - 6); g.lineTo(ix, sy + 1); g.closePath(); g.moveTo(ix, sy + 1); g.lineTo(ix, sy + 6); g.moveTo(ix - 4, sy + 6); g.lineTo(ix + 4, sy + 6); }
    else if (icon === 'note') { g.arc(ix - 3, sy + 4, 2.4, 0, Math.PI * 2); g.moveTo(ix - 0.6, sy + 4); g.lineTo(ix - 0.6, sy - 7); g.lineTo(ix + 5, sy - 4); }
    else if (icon === 'heart') { g.moveTo(ix, sy + 6); g.bezierCurveTo(ix - 10, sy - 1, ix - 4, sy - 9, ix, sy - 3); g.bezierCurveTo(ix + 4, sy - 9, ix + 10, sy - 1, ix, sy + 6); }
    else { g.rect(ix - 5, sy - 5, 10, 10); g.moveTo(ix - 2, sy - 2); g.arc(ix - 2, sy - 2, 0.6, 0, Math.PI * 2); g.moveTo(ix + 2, sy + 2); g.arc(ix + 2, sy + 2, 0.6, 0, Math.PI * 2); }
    g.stroke();
  });
  g.font = `italic 700 ${Math.min(16, ((sw - 24) / word.length) * 1.9)}px "Brush Script MT", "Segoe Script", cursive`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3.2; g.strokeStyle = rgba(f.neon, 0.45); g.strokeText(word, tx, sy + 1);
  g.fillStyle = lit ? '#ffffff' : f.neon; g.fillText(word, tx, sy + 1);
  g.lineWidth = 0.8; g.strokeStyle = f.neon; g.strokeText(word, tx, sy + 1);
  void r;
  return { x: cx, y: sy, w: sw };
}

/** Bubble-letter graffiti: fat outline, fill with a highlight, drips and a spray halo. */
function paintPiece(g, word, col, x, y, size, r) {
  g.save(); g.translate(x, y); g.rotate(r.range(-0.12, 0.05));
  g.font = `900 ${size * 0.62}px Impact, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.26; g.strokeStyle = rgba('#ffffff', 0.85); g.strokeText(word, 0, 0);
  g.lineWidth = size * 0.14; g.strokeStyle = INK; g.strokeText(word, 0, 0);
  g.fillStyle = col; g.fillText(word, 0, 0);
  const tw = g.measureText(word).width;
  g.fillStyle = col;
  for (let i = 0; i < 4; i++) { const dx = r.range(-tw / 2, tw / 2), dl = r.range(4, 12); g.fillRect(dx, size * 0.18, 1.4, dl); g.beginPath(); g.arc(dx + 0.7, size * 0.18 + dl, 1.1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = rgba('#ffffff', 0.6); g.fillRect(-tw * 0.4, -size * 0.2, tw * 0.25, size * 0.05);
  g.restore();
}
