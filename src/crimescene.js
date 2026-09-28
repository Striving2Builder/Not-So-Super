// Crime-scene set painting for the daytime investigation: the room as an illustrated comic panel.
// One-point perspective (the back wall is the 1000x600 logical stage; side walls, ceiling and floor
// run out past it to fill any screen shape), per-setting wall/floor materials, practical lights
// with light cones and dust, and the detective-vision "see-through" layer (studs, wiring, pipes).
// Everything is drawn in the scene's logical coordinates by the caller's transform.
import { shade } from './util.js';

export const LW = 1000, LH = 600, FLOOR = 380, CEIL = 14;
export const VP = { x: 500, y: 200 }; // vanishing point

/** y where the ray from the vanishing point through (px, py) reaches x. */
const rayY = (px, py, x) => VP.y + (py - VP.y) * (x - VP.x) / (px - VP.x);
/** Floor row depths: y positions from the back wall toward the viewer. */
function floorRows(y1, n = 9) {
  const out = [];
  for (let i = 1; i <= n; i++) { const y = FLOOR + 14 * (Math.pow(1.42, i) - 1); if (y > y1) break; out.push(y); }
  return out;
}
/** x on the floor at row y for lane u (u = logical x at the back wall). */
const laneX = (u, y) => VP.x + (u - VP.x) * (y - VP.y) / (FLOOR - VP.y);

// Per-setting materials and dressing (colours are hex so util.shade can work on them).
export const LOOKS = {
  office: { wainscot: '#34404f', trim: '#c9b48a', lamp: 'pendant', blinds: true, floorKind: 'tiles', outlets: [150, 690] },
  apartment: { wainscot: null, trim: '#e8dcc8', stripes: 'rgba(255,240,220,.07)', lamp: 'bulb', floorKind: 'boards', outlets: [300, 800] },
  alley: { lamp: 'caged', floorKind: 'asphalt', grime: true, outlets: [620] },
  barn: { lamp: 'bulb', floorKind: 'boards', slits: true, outlets: [700] },
  casino: { wainscot: '#2a0f18', trim: '#e0b040', damask: true, neon: '#ff3aa8', lamp: 'chandelier', floorKind: 'carpet', outlets: [380, 760] },
  factory: { lamp: 'caged', floorKind: 'concrete', hazard: true, pipes: true, outlets: [380, 830] },
};

/** Paint the room (walls, floor, windows, lights) across the visible logical rect v. */
export function paintRoom(g, key, S, night, v, t) {
  const L = LOOKS[key] || LOOKS.office;
  const x0 = v.x0 - 2, x1 = v.x1 + 2, y0 = v.y0 - 2, y1 = v.y1 + 2;
  const wall = S.wall;
  // ceiling (everything above/around; walls and floor paint over it)
  g.fillStyle = shade(wall, -0.72); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // back wall
  let gr = g.createLinearGradient(0, CEIL, 0, FLOOR);
  gr.addColorStop(0, shade(wall, -0.35)); gr.addColorStop(0.45, wall); gr.addColorStop(1, shade(wall, -0.2));
  g.fillStyle = gr; g.fillRect(0, CEIL, LW, FLOOR - CEIL);
  paintWallMaterial(g, key, S, L, t);
  // side walls, receding
  for (const side of [-1, 1]) {
    const bx = side < 0 ? 0 : LW, ex = side < 0 ? x0 : x1;
    if ((side < 0 && ex >= 0) || (side > 0 && ex <= LW)) continue;
    const ty = rayY(bx, CEIL, ex), by = rayY(bx, FLOOR, ex);
    g.beginPath(); g.moveTo(bx, CEIL); g.lineTo(ex, ty); g.lineTo(ex, by); g.lineTo(bx, FLOOR); g.closePath();
    gr = g.createLinearGradient(bx, 0, ex, 0);
    gr.addColorStop(0, shade(wall, -0.38)); gr.addColorStop(1, shade(wall, -0.62));
    g.fillStyle = gr; g.fill();
    // wainscot/baseboard lines follow the perspective
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.beginPath();
    for (const wy of [FLOOR - 16, L.wainscot ? FLOOR - 120 : null]) { if (wy == null) continue; g.moveTo(bx, wy); g.lineTo(ex, rayY(bx, wy, ex)); }
    g.stroke();
    if (S.brick || L.slits || L.hazard) { // vertical seams recede too
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; g.beginPath();
      for (let k = 1; k < 5; k++) { const xx = bx + (ex - bx) * (k / 5) ** 0.8; g.moveTo(xx, rayY(bx, CEIL, xx)); g.lineTo(xx, rayY(bx, FLOOR, xx)); }
      g.stroke();
    }
    // the corner: an inked crease
    g.strokeStyle = 'rgba(8,4,12,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, CEIL); g.lineTo(bx, FLOOR); g.stroke();
  }
  // ceiling edge
  g.strokeStyle = 'rgba(8,4,12,.55)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0, rayY(0, CEIL, x0)); g.lineTo(0, CEIL); g.lineTo(LW, CEIL); g.lineTo(x1, rayY(LW, CEIL, x1)); g.stroke();
  if (S.window) paintWindow(g, S, L, night);
  paintFloor(g, key, S, L, v, x0, x1, y1);
  // baseboard + wall/floor contact shadow
  g.fillStyle = L.trim ? shade(L.trim, -0.45) : 'rgba(0,0,0,.4)'; g.fillRect(0, FLOOR - 14, LW, 14);
  gr = g.createLinearGradient(0, FLOOR, 0, FLOOR + 26); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0, rayY(0, FLOOR, x0)); g.lineTo(0, FLOOR); g.lineTo(LW, FLOOR); g.lineTo(x1, rayY(LW, FLOOR, x1)); g.lineTo(x1, FLOOR + 26); g.lineTo(x0, FLOOR + 26); g.fill();
  // outlets: where the X-ray wiring comes from
  for (const ox of L.outlets) { g.fillStyle = '#e8e4d8'; g.fillRect(ox - 7, FLOOR - 44, 14, 20); g.fillStyle = '#333'; g.fillRect(ox - 3, FLOOR - 40, 2, 5); g.fillRect(ox + 1, FLOOR - 40, 2, 5); }
}

function paintWallMaterial(g, key, S, L, t) {
  const H = FLOOR - CEIL;
  if (S.brick) {
    for (let y = CEIL, r = 0; y < FLOOR; y += 22, r++) {
      for (let x = r % 2 ? -30 : 0; x < LW; x += 60) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, f = n - Math.floor(n);
        g.fillStyle = f < 0.33 ? 'rgba(0,0,0,.16)' : f < 0.66 ? 'rgba(255,190,150,.06)' : 'rgba(0,0,0,.05)';
        g.fillRect(x + 2, y + 2, 56, 18);
      }
    }
    g.strokeStyle = 'rgba(20,8,6,.35)'; g.lineWidth = 2; g.beginPath();
    for (let y = CEIL; y < FLOOR; y += 22) { g.moveTo(0, y); g.lineTo(LW, y); }
    g.stroke();
    // grime runs down from the top, a tag sprayed on the wall
    const gr = g.createLinearGradient(0, CEIL, 0, FLOOR); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.4, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = gr; g.fillRect(0, CEIL, LW, H);
    g.save(); g.translate(520, 120); g.rotate(-0.12); g.font = '48px Bangers, Impact, sans-serif'; g.textAlign = 'center';
    g.lineWidth = 6; g.strokeStyle = 'rgba(20,10,30,.55)'; g.strokeText('RAT KINGS', 0, 0); g.fillStyle = 'rgba(80,200,255,.45)'; g.fillText('RAT KINGS', 0, 0); g.restore();
  }
  if (S.planks || L.slits) {
    for (let x = 0; x < LW; x += 40) {
      g.fillStyle = (x / 40) % 3 === 0 ? 'rgba(0,0,0,.1)' : (x / 40) % 3 === 1 ? 'rgba(255,220,180,.04)' : 'rgba(0,0,0,.03)';
      g.fillRect(x, CEIL, 40, H);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, CEIL, 3, H);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x + 18, CEIL + 30, 3, 3); g.fillRect(x + 18, FLOOR - 50, 3, 3);
    }
    // cross beam
    g.fillStyle = shade(S.wall, -0.45); g.fillRect(0, CEIL + 40, LW, 22); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, CEIL + 62, LW, 5);
  }
  if (L.stripes) { g.fillStyle = L.stripes; for (let x = 0; x < LW; x += 48) g.fillRect(x, CEIL, 20, H); }
  if (L.damask) { // faint diamond wallpaper
    g.fillStyle = 'rgba(255,200,120,.06)';
    for (let y = CEIL + 20; y < FLOOR - 120; y += 44) for (let x = ((y / 44) % 2) * 30; x < LW; x += 60) {
      g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 9, y); g.lineTo(x, y + 12); g.lineTo(x - 9, y); g.fill();
    }
  }
  if (L.hazard) { // corrugated metal ribs + hazard band
    for (let x = 0; x < LW; x += 26) { const gr = g.createLinearGradient(x, 0, x + 26, 0); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(0.5, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(255,255,255,.03)'); g.fillStyle = gr; g.fillRect(x, CEIL, 26, H); }
    g.save(); g.beginPath(); g.rect(0, FLOOR - 40, LW, 24); g.clip();
    g.fillStyle = '#e8c21a'; g.fillRect(0, FLOOR - 40, LW, 24); g.fillStyle = '#1a1a1a';
    for (let x = -30; x < LW + 30; x += 36) { g.beginPath(); g.moveTo(x, FLOOR - 16); g.lineTo(x + 18, FLOOR - 40); g.lineTo(x + 36, FLOOR - 40); g.lineTo(x + 18, FLOOR - 16); g.fill(); }
    g.restore();
  }
  if (L.pipes) { // overhead pipes along the top of the wall
    for (const [py, r, c] of [[CEIL + 22, 9, '#6a7078'], [CEIL + 44, 6, '#8a5a3a']]) {
      const gr = g.createLinearGradient(0, py - r, 0, py + r); gr.addColorStop(0, shade(c, 0.35)); gr.addColorStop(0.5, c); gr.addColorStop(1, shade(c, -0.5));
      g.fillStyle = gr; g.fillRect(0, py - r, LW, r * 2);
      g.fillStyle = shade(c, -0.4); for (let x = 60; x < LW; x += 180) g.fillRect(x, py - r - 3, 10, r * 2 + 6);
    }
  }
  if (L.wainscot) {
    g.fillStyle = L.wainscot; g.fillRect(0, FLOOR - 120, LW, 106);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2;
    for (let x = 12; x < LW - 60; x += 110) g.strokeRect(x, FLOOR - 104, 92, 76);
    g.fillStyle = L.trim; g.fillRect(0, FLOOR - 126, LW, 7);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, FLOOR - 126, LW, 2);
  }
  if (L.trim && !S.brick) { g.fillStyle = shade(L.trim, -0.3); g.fillRect(0, CEIL, LW, 8); }
  if (L.neon) { // a neon strip under the ceiling
    const a = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 2.3);
    g.fillStyle = `rgba(255,58,168,${0.18 * a})`; g.fillRect(0, CEIL + 8, LW, 30);
    g.fillStyle = `rgba(255,190,230,${a})`; g.fillRect(0, CEIL + 14, LW, 4);
  }
}

function paintWindow(g, S, L, night) {
  const [x, y, w, h] = S.window;
  const gr = g.createLinearGradient(0, y, 0, y + h);
  if (night > 0.5) { gr.addColorStop(0, '#060a24'); gr.addColorStop(1, '#1c2250'); }
  else { gr.addColorStop(0, '#6fb6ec'); gr.addColorStop(1, '#cfe8f6'); }
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  // skyline
  g.fillStyle = night > 0.5 ? '#141834' : '#7b98b4';
  for (let i = 0; i < 9; i++) g.fillRect(x + i * (w / 9), y + h - 36 - ((i * 37) % 64), w / 10, 100);
  if (night > 0.5) { g.fillStyle = '#ffd98a'; for (let i = 0; i < 26; i++) g.fillRect(x + ((i * 41) % w), y + h - 22 - ((i * 23) % 60), 3, 4); }
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (L.blinds) { g.fillStyle = 'rgba(214,200,170,.92)'; for (let yy = y + 4; yy < y + h * 0.55; yy += 11) g.fillRect(x, yy, w, 7); }
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 20, y); g.lineTo(x + 70, y); g.lineTo(x + 10, y + h); g.lineTo(x - 40, y + h); g.fill(); // glass glint
  g.restore();
  g.strokeStyle = '#1e1a18'; g.lineWidth = 10; g.strokeRect(x, y, w, h);
  g.strokeStyle = shade(L.trim || '#9a8a70', -0.1); g.lineWidth = 5; g.strokeRect(x, y, w, h);
  g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
  g.fillStyle = shade(L.trim || '#9a8a70', -0.3); g.fillRect(x - 12, y + h + 2, w + 24, 10); // sill
}

function paintFloor(g, key, S, L, v, x0, x1, y1) {
  const f = S.floor;
  g.beginPath(); g.moveTo(x0, rayY(0, FLOOR, x0)); g.lineTo(0, FLOOR); g.lineTo(LW, FLOOR); g.lineTo(x1, rayY(LW, FLOOR, x1)); g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath();
  const gr = g.createLinearGradient(0, FLOOR, 0, y1);
  gr.addColorStop(0, shade(f, -0.4)); gr.addColorStop(0.35, f); gr.addColorStop(1, shade(f, -0.25));
  g.fillStyle = gr; g.fill();
  g.save(); g.clip();
  const rows = floorRows(y1, 12);
  const lanes = (step, a) => { g.beginPath(); for (let u = -3000; u <= 4000; u += step) { g.moveTo(u, FLOOR); g.lineTo(laneX(u, y1 + 40), y1 + 40); } g.strokeStyle = a; g.stroke(); };
  const across = (a, w = 2) => { g.beginPath(); for (const y of rows) { g.moveTo(x0, y); g.lineTo(x1, y); } g.strokeStyle = a; g.lineWidth = w; g.stroke(); };
  g.lineWidth = 2;
  switch (L.floorKind) {
    case 'boards': {
      lanes(46, 'rgba(0,0,0,.32)');
      // staggered board ends
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath();
      let prev = FLOOR;
      for (const [i, y] of rows.entries()) {
        for (let u = -3000 + (i % 2) * 92; u <= 4000; u += 184) { const xa = laneX(u, prev), xb = laneX(u, y); g.moveTo(xa, prev); g.lineTo(xb, y); }
        prev = y;
      }
      g.stroke();
      g.fillStyle = 'rgba(255,230,190,.05)';
      for (let u = -2990; u < 4000; u += 138) { g.beginPath(); g.moveTo(u, FLOOR); g.lineTo(u + 12, FLOOR); g.lineTo(laneX(u + 12, y1 + 40), y1 + 40); g.lineTo(laneX(u, y1 + 40), y1 + 40); g.fill(); }
      if (key === 'barn') { g.strokeStyle = 'rgba(230,200,110,.55)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 60; i++) { const sx = v.x0 + ((i * 197) % Math.max(1, v.x1 - v.x0)), sy = FLOOR + 20 + ((i * 89) % (y1 - FLOOR - 20)); g.moveTo(sx, sy); g.lineTo(sx + 10 - (i % 3) * 8, sy + (i % 2 ? 3 : -2)); } g.stroke(); }
      break;
    }
    case 'tiles': lanes(80, 'rgba(0,0,0,.2)'); across('rgba(0,0,0,.2)'); break;
    case 'concrete': {
      lanes(200, 'rgba(0,0,0,.25)'); across('rgba(0,0,0,.18)', 3);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(610, 520, 90, 16, 0, 0, Math.PI * 2); g.fill(); // oil stain
      g.fillStyle = 'rgba(120,200,255,.08)'; g.beginPath(); g.ellipse(620, 520, 60, 9, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'asphalt': {
      g.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 260; i++) { const sx = v.x0 + ((i * 131) % Math.max(1, v.x1 - v.x0)), sy = FLOOR + ((i * 71) % (y1 - FLOOR)); g.fillRect(sx, sy, 3, 2); }
      // puddles catching light
      for (const [px, py, rx] of [[330, 520, 110], [760, 560, 80], [-60, 470, 70]]) {
        const pg = g.createLinearGradient(0, py - 12, 0, py + 12); pg.addColorStop(0, 'rgba(160,200,255,.28)'); pg.addColorStop(1, 'rgba(40,60,90,.3)');
        g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, rx, rx * 0.16, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(px - rx * 0.5, py - 2); g.lineTo(px + rx * 0.2, py - 2); g.stroke();
      }
      g.fillStyle = '#1a1a1e'; g.fillRect(470, 450, 90, 18); g.fillStyle = '#333'; for (let i = 0; i < 6; i++) g.fillRect(476 + i * 14, 452, 6, 14); // drain
      break;
    }
    case 'carpet': {
      let prev = FLOOR;
      g.fillStyle = 'rgba(255,200,80,.1)';
      for (const y of rows) {
        const my = (prev + y) / 2, hh = (y - prev) * 0.32;
        for (let u = -2400; u < 3400; u += 70) {
          const cx = laneX(u, my), ww = (laneX(u + 70, my) - cx) * 0.22;
          g.beginPath(); g.moveTo(cx, my - hh); g.lineTo(cx + ww, my); g.lineTo(cx, my + hh); g.lineTo(cx - ww, my); g.fill();
        }
        prev = y;
      }
      // a gold-edged runner
      g.strokeStyle = 'rgba(224,176,64,.35)'; g.lineWidth = 4; g.beginPath();
      for (const u of [220, 780]) { g.moveTo(u, FLOOR); g.lineTo(laneX(u, y1 + 40), y1 + 40); }
      g.stroke();
      break;
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ lights

/** The practical light fixture (drawn before props; its glow is added after them). */
export function paintFixture(g, key) {
  const L = LOOKS[key] || LOOKS.office;
  const x = 500;
  g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, CEIL - 20); g.lineTo(x, CEIL + 8); g.stroke();
  if (L.lamp === 'chandelier') {
    g.fillStyle = '#e0b040'; g.strokeStyle = '#1a1208'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(x, CEIL + 14, 60, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = -3; i <= 3; i++) { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(x + i * 18, CEIL + 22 + Math.abs(i) * -1, 3.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,240,200,.6)'; g.beginPath(); g.moveTo(x + i * 18, CEIL + 24); g.lineTo(x + i * 18, CEIL + 34); g.stroke(); }
  } else if (L.lamp === 'pendant') {
    g.fillStyle = '#2a3a2a'; g.strokeStyle = '#111'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x - 36, CEIL + 34); g.lineTo(x - 14, CEIL + 8); g.lineTo(x + 14, CEIL + 8); g.lineTo(x + 36, CEIL + 34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(x, CEIL + 34, 30, 5, 0, 0, Math.PI * 2); g.fill();
  } else if (L.lamp === 'caged') {
    g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(x, CEIL + 22, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.arc(x, CEIL + 22, 12, 0, Math.PI); g.moveTo(x - 12, CEIL + 22); g.lineTo(x - 12, CEIL + 12); g.moveTo(x + 12, CEIL + 22); g.lineTo(x + 12, CEIL + 12); g.moveTo(x, CEIL + 10); g.lineTo(x, CEIL + 34); g.stroke();
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.moveTo(x - 30, CEIL + 14); g.lineTo(x + 30, CEIL + 14); g.lineTo(x + 18, CEIL + 6); g.lineTo(x - 18, CEIL + 6); g.fill();
  } else {
    g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(x, CEIL + 18, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#444'; g.fillRect(x - 4, CEIL + 4, 8, 8);
  }
}

/** Additive light: lamp cone, window shaft/blind stripes, barn-plank slits, drifting dust. */
export function paintLight(g, key, S, night, v, t) {
  const L = LOOKS[key] || LOOKS.office;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const warm = L.lamp === 'chandelier' ? '255,200,120' : L.lamp === 'caged' ? '255,236,170' : '255,226,160';
  // lamp cone down to a pool on the floor
  const top = CEIL + 30, floorY = 560;
  let gr = g.createLinearGradient(0, top, 0, floorY);
  gr.addColorStop(0, `rgba(${warm},.22)`); gr.addColorStop(1, `rgba(${warm},0)`);
  g.fillStyle = gr; g.beginPath(); g.moveTo(470, top); g.lineTo(530, top); g.lineTo(820, floorY); g.lineTo(180, floorY); g.closePath(); g.fill();
  gr = g.createRadialGradient(500, 470, 10, 500, 470, 320);
  gr.addColorStop(0, `rgba(${warm},.16)`); gr.addColorStop(1, `rgba(${warm},0)`);
  g.fillStyle = gr; g.save(); g.translate(500, 470); g.scale(1, 0.32); g.beginPath(); g.arc(0, 0, 320, 0, Math.PI * 2); g.restore(); g.fill();
  gr = g.createRadialGradient(500, top - 6, 2, 500, top - 6, 90);
  gr.addColorStop(0, `rgba(${warm},.55)`); gr.addColorStop(1, `rgba(${warm},0)`);
  g.fillStyle = gr; g.fillRect(410, top - 96, 180, 180);
  // window: a slanted shaft onto the floor (striped through blinds)
  if (S.window) {
    const [x, y, w, h] = S.window, day = night <= 0.5;
    const col = day ? '255,246,210' : '150,180,255', a = day ? 0.08 : 0.05;
    const dx = -170, fy = 520;
    const shaft = (ya, yb, alpha) => {
      g.fillStyle = `rgba(${col},${alpha})`; g.beginPath();
      g.moveTo(x, ya); g.lineTo(x + w, ya); g.lineTo(x + w + dx, fy + (yb - y) * 0.15); g.lineTo(x + dx, fy + (yb - y) * 0.15); g.closePath(); g.fill();
    };
    if (L.blinds) { for (let yy = y + h * 0.55; yy < y + h; yy += 16) shaft(yy, yy + 8, a); }
    else shaft(y, y + h, a);
  }
  if (L.slits) { // light knifing through gaps between barn planks
    for (const sx of [120, 280, 640, 880]) {
      gr = g.createLinearGradient(sx, CEIL, sx + 120, 560); gr.addColorStop(0, 'rgba(255,230,160,.16)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(sx, CEIL); g.lineTo(sx + 5, CEIL); g.lineTo(sx + 150, 560); g.lineTo(sx + 110, 560); g.fill();
    }
  }
  g.restore();
}

/** Dust motes drifting through the lamp light (live, every frame). */
export function paintDust(g, t, dust) {
  const top = CEIL + 30;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const d of dust) {
    const px = d.x + Math.sin(t * d.s + d.p) * 22, py = ((d.y + t * d.v * 18) % 470) + 60;
    const inCone = Math.abs(px - 500) < 30 + (py - top) * 0.55;
    const a = (inCone ? 0.55 : 0.12) * (0.6 + 0.4 * Math.sin(t * 2 + d.p));
    g.fillStyle = `rgba(255,240,210,${a.toFixed(3)})`; g.fillRect(px, py, d.r, d.r);
  }
  g.restore();
}

export function makeDust(n = 46) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: 160 + Math.random() * 680, y: Math.random() * 470, r: 1.5 + Math.random() * 2.5, s: 0.3 + Math.random() * 0.6, v: 0.2 + Math.random() * 0.6, p: Math.random() * 6.28 });
  return out;
}

// ------------------------------------------------------------------ grading (cached per size)

/** Screen-space vignette with halftone in the shadows: the "printed page" look. */
export function makeGrade(w, h, cx, cy, r) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  // halftone dots, bigger toward the edges
  const step = Math.max(6, Math.round(Math.min(w, h) / 70));
  g.fillStyle = 'rgba(12,6,24,.55)';
  for (let y = 0; y < h; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
    const d = Math.hypot((x - cx) / (w * 0.5), (y - cy) / (h * 0.55));
    const rr = Math.max(0, (d - 0.62)) * step * 0.9;
    if (rr > 0.4) { g.beginPath(); g.arc(x, y, Math.min(step * 0.62, rr), 0, Math.PI * 2); g.fill(); }
  }
  const gr = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r * 1.15);
  gr.addColorStop(0, 'rgba(10,4,20,0)'); gr.addColorStop(0.6, 'rgba(10,4,20,.18)'); gr.addColorStop(1, 'rgba(6,2,14,.62)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  return c;
}

/** Tiny tiles for patterns: CRT scanlines. */
export function scanPattern(g) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 4;
  const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 4, 1); x.fillStyle = 'rgba(120,230,255,.05)'; x.fillRect(0, 2, 4, 1);
  return g.createPattern(c, 'repeat');
}

// ------------------------------------------------------------------ detective vision

/** Studs, joists, conduit and pipes: the building's insides, drawn in scan colours. */
export function paintXrayStructure(g, key, v, t) {
  const L = LOOKS[key] || LOOKS.office;
  const x0 = v.x0, x1 = v.x1, y1 = v.y1;
  g.save();
  g.lineCap = 'round';
  // perspective grid on floor and walls
  g.strokeStyle = 'rgba(60,200,255,.16)'; g.lineWidth = 1.5; g.beginPath();
  for (let u = -2400; u <= 3400; u += 100) { g.moveTo(u, FLOOR); g.lineTo(laneX(u, y1 + 40), y1 + 40); }
  for (const y of floorRows(y1, 12)) { g.moveTo(x0, y); g.lineTo(x1, y); }
  for (let x = 0; x <= LW; x += 62.5) { g.moveTo(x, CEIL); g.lineTo(x, FLOOR); } // studs
  for (const side of [-1, 1]) {
    const bx = side < 0 ? 0 : LW, ex = side < 0 ? x0 : x1;
    for (let k = 0; k <= 4; k++) { const yy = CEIL + (FLOOR - CEIL) * k / 4; g.moveTo(bx, yy); g.lineTo(ex, rayY(bx, yy, ex)); }
  }
  g.moveTo(0, CEIL); g.lineTo(LW, CEIL); g.moveTo(0, FLOOR); g.lineTo(LW, FLOOR); g.moveTo(0, CEIL); g.lineTo(0, FLOOR); g.moveTo(LW, CEIL); g.lineTo(LW, FLOOR);
  g.stroke();
  // conduit: each outlet runs up to a junction box then along under the ceiling
  g.strokeStyle = 'rgba(140,255,200,.55)'; g.lineWidth = 3; g.beginPath();
  const jy = CEIL + 34;
  for (const [i, ox] of L.outlets.entries()) {
    const jx = ox + (i % 2 ? -40 : 40);
    g.moveTo(ox, FLOOR - 44); g.lineTo(ox, FLOOR - 150 - i * 30); g.lineTo(jx, FLOOR - 150 - i * 30); g.lineTo(jx, jy);
  }
  g.moveTo(-200, jy); g.lineTo(1200, jy); g.lineTo(1200, jy);
  g.moveTo(500, CEIL - 20); g.lineTo(500, jy);
  g.stroke();
  // current pulses running along the wires
  g.fillStyle = 'rgba(200,255,230,.9)';
  for (let k = 0; k < 6; k++) { const px = ((t * 160 + k * 230) % 1400) - 200; g.fillRect(px - 5, jy - 2, 10, 4); }
  for (const ox of L.outlets) { g.strokeStyle = 'rgba(140,255,200,.8)'; g.lineWidth = 2; g.strokeRect(ox - 9, FLOOR - 46, 18, 24); }
  g.restore();
}

/** Glowing skeleton for a person drawn by drawHumanoid at (x, y) with scale s. */
export function paintSkeleton(g, x, y, s, t) {
  const k = s / 2.1;
  g.save(); g.translate(x, y); g.scale(k, k);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(160,240,255,.9)'; g.shadowBlur = 10;
  g.strokeStyle = 'rgba(225,250,255,.92)'; g.fillStyle = 'rgba(225,250,255,.92)'; g.lineWidth = 4.5;
  g.beginPath();
  g.arc(2, -182, 14, 0, Math.PI * 2); // skull
  g.moveTo(0, -166); g.lineTo(0, -98); // spine
  g.moveTo(-22, -150); g.lineTo(22, -150); // shoulders
  g.moveTo(-22, -150); g.lineTo(-26, -118); g.lineTo(-24, -86); // arms
  g.moveTo(22, -150); g.lineTo(26, -118); g.lineTo(24, -86);
  g.moveTo(-14, -98); g.lineTo(14, -98); // pelvis
  g.moveTo(-10, -96); g.lineTo(-12, -50); g.lineTo(-12, -4); // legs
  g.moveTo(10, -96); g.lineTo(12, -50); g.lineTo(12, -4);
  g.stroke();
  g.lineWidth = 2.5; g.beginPath(); // ribs
  for (let i = 0; i < 4; i++) { const ry = -144 + i * 9, rw = 16 - i * 1.5; g.moveTo(-rw, ry + 4); g.quadraticCurveTo(0, ry - 5, rw, ry + 4); }
  g.stroke();
  g.fillStyle = 'rgba(0,10,20,.9)'; g.shadowBlur = 0; g.fillRect(-4, -186, 4, 4); g.fillRect(4, -186, 4, 4);
  // a beating heart
  const beat = Math.pow(Math.max(0, Math.sin(t * 7.5)), 6);
  g.shadowColor = 'rgba(255,120,60,.9)'; g.shadowBlur = 10 + beat * 12;
  g.fillStyle = `rgba(255,${120 + beat * 60 | 0},60,.9)`; g.beginPath(); g.arc(-5, -134, 5 + beat * 2.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ the case's own story

const rnd = (i, k = 1) => { const n = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return n - Math.floor(n); };

/** Floor (and wall) details that say what happened here, per case type. (x, y) is a clear floor spot. */
export function paintStory(g, id, x, y) {
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const ink = 'rgba(18,10,22,.8)';
  const paper = (px, py, a, w = 30, h = 38, col = '#efeadc') => {
    g.save(); g.translate(px, py); g.scale(1, 0.42); g.rotate(a);
    g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
    g.restore();
  };
  switch (id) {
    case 'arson': {
      // scorched floor, soot plume up the wall, charred debris, a gas can on its side
      let gr = g.createRadialGradient(x, y, 6, x, y, 150);
      gr.addColorStop(0, 'rgba(8,4,2,.92)'); gr.addColorStop(0.5, 'rgba(20,10,4,.6)'); gr.addColorStop(1, 'rgba(20,10,4,0)');
      g.save(); g.translate(x, y); g.scale(1, 0.3); g.translate(-x, -y); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 150, 0, Math.PI * 2); g.fill(); g.restore();
      gr = g.createLinearGradient(0, FLOOR, 0, CEIL + 40);
      gr.addColorStop(0, 'rgba(10,6,4,.75)'); gr.addColorStop(1, 'rgba(10,6,4,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 90, FLOOR); g.bezierCurveTo(x - 60, FLOOR - 150, x - 130, FLOOR - 250, x - 40, CEIL + 40);
      g.lineTo(x + 80, CEIL + 40); g.bezierCurveTo(x + 130, FLOOR - 230, x + 50, FLOOR - 140, x + 90, FLOOR); g.fill();
      for (let i = 0; i < 9; i++) { // charred bits
        const bx = x - 90 + rnd(i) * 180, by = y - 14 + rnd(i, 2) * 30;
        g.fillStyle = '#140c08'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 14, by - 4); g.lineTo(bx + 18, by + 3); g.lineTo(bx + 4, by + 6); g.fill();
        g.fillStyle = 'rgba(255,120,30,.8)'; g.fillRect(bx + 8, by, 3, 2); // embers
      }
      g.save(); g.translate(x + 120, y + 6); g.rotate(-0.25); // gas can
      g.fillStyle = '#c0281c'; g.fillRect(-22, -16, 44, 30); g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(-22, -16, 44, 30);
      g.fillStyle = '#e8c21a'; g.fillRect(14, -24, 8, 10); g.strokeRect(14, -24, 8, 10); g.restore();
      g.fillStyle = 'rgba(40,30,20,.35)'; g.beginPath(); g.ellipse(x + 90, y + 18, 50, 8, 0, 0, Math.PI * 2); g.fill(); // spilled fuel
      break;
    }
    case 'blackmail': { // cut-out ransom letters, an envelope, a pair of scissors
      paper(x, y, 0.2, 60, 44, '#f4efdf');
      const cols = ['#d8122e', '#1e3cff', '#111', '#e8c21a', '#2a8a3a'];
      for (let i = 0; i < 12; i++) {
        const lx = x - 110 + rnd(i) * 220, ly = y - 12 + rnd(i, 3) * 30;
        g.save(); g.translate(lx, ly); g.scale(1, 0.5); g.rotate(rnd(i, 4) * 2);
        g.fillStyle = '#fff'; g.fillRect(-7, -9, 14, 18); g.fillStyle = cols[i % 5]; g.font = '900 14px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('PAYMEORELS'[i % 10], 0, 1); g.restore();
      }
      g.save(); g.translate(x + 80, y + 14); g.rotate(0.3); g.strokeStyle = '#555'; g.lineWidth = 4; g.beginPath(); g.moveTo(-20, 0); g.lineTo(18, -6); g.moveTo(-20, -8); g.lineTo(18, 2); g.stroke();
      g.strokeStyle = '#d8122e'; g.lineWidth = 3; g.beginPath(); g.arc(-26, 2, 6, 0, Math.PI * 2); g.arc(-26, -10, 6, 0, Math.PI * 2); g.stroke(); g.restore();
      break;
    }
    case 'insider': { // shredder spill + a trail of stock-ticker tape
      for (let i = 0; i < 40; i++) { const sx = x - 70 + rnd(i) * 140, sy = y - 8 + rnd(i, 2) * 22; g.strokeStyle = i % 4 ? '#ece6d6' : '#9ab8e0'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 10 + rnd(i, 5) * 14, sy + (rnd(i, 6) - 0.5) * 6); g.stroke(); }
      g.strokeStyle = '#f2ead0'; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 160, y + 30); g.bezierCurveTo(x - 90, y - 10, x - 40, y + 50, x + 40, y + 24); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
      break;
    }
    case 'rigged': { // spilled chips and a fan of cards
      for (let i = 0; i < 16; i++) { const cx = x - 90 + rnd(i) * 180, cy = y - 10 + rnd(i, 2) * 28; g.fillStyle = ['#d8122e', '#1e3cff', '#111', '#2a8a3a'][i % 4]; g.beginPath(); g.ellipse(cx, cy, 9, 4, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); }
      for (let i = 0; i < 5; i++) { g.save(); g.translate(x + 60 + i * 8, y + 16); g.scale(1, 0.45); g.rotate(-0.6 + i * 0.3); g.fillStyle = '#fff'; g.fillRect(-12, -17, 24, 34); g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(-12, -17, 24, 34); g.fillStyle = i % 2 ? '#d8122e' : '#111'; g.font = '900 16px Georgia'; g.textAlign = 'center'; g.fillText('A', 0, 6); g.restore(); }
      break;
    }
    case 'sabotage': { // oil slick, a dropped wrench, scattered bolts, a cut cable sparking
      g.fillStyle = 'rgba(10,10,14,.7)'; g.beginPath(); g.ellipse(x, y, 110, 20, 0, 0, Math.PI * 2); g.fill();
      const og = g.createLinearGradient(x - 80, 0, x + 80, 0); og.addColorStop(0, 'rgba(255,60,200,.18)'); og.addColorStop(0.5, 'rgba(60,220,255,.2)'); og.addColorStop(1, 'rgba(255,230,60,.18)');
      g.fillStyle = og; g.beginPath(); g.ellipse(x + 10, y - 2, 70, 10, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(x - 40, y + 26); g.rotate(-0.3); g.fillStyle = '#8a929a'; g.fillRect(-34, -4, 60, 8); g.beginPath(); g.arc(30, 0, 10, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(-34, -4, 60, 8); g.restore();
      for (let i = 0; i < 8; i++) { g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(x + 60 + rnd(i) * 70, y - 6 + rnd(i, 2) * 26, 4, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'poison': { // tipped feed sack, green chemical seep, a dead crow
      g.fillStyle = 'rgba(90,220,60,.45)'; g.beginPath(); g.ellipse(x, y + 4, 90, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,255,120,.5)'; g.beginPath(); g.ellipse(x - 10, y + 1, 40, 5, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(x - 70, y - 8); g.rotate(-0.2); g.fillStyle = '#c8b27a'; g.beginPath(); g.ellipse(0, 0, 36, 18, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#1a1a1a'; g.font = '900 12px system-ui'; g.textAlign = 'center'; g.fillText('FEED', 0, 4); g.restore();
      g.save(); g.translate(x + 80, y + 14); g.fillStyle = '#14121a'; g.beginPath(); g.ellipse(0, 0, 18, 7, 0.2, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(16, -2); g.lineTo(28, 0); g.lineTo(16, 3); g.fill();
      g.strokeStyle = '#14121a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, 4); g.lineTo(-8, 14); g.moveTo(4, 4); g.lineTo(2, 14); g.stroke(); g.restore();
      break;
    }
    case 'smuggle': { // a crate burst open: slats, straw, loose banknotes, a stencilled stamp
      for (let i = 0; i < 5; i++) { g.save(); g.translate(x - 70 + i * 34, y - 4 + (i % 2) * 14); g.rotate(-0.5 + rnd(i) * 1.2); g.fillStyle = '#a8804a'; g.fillRect(-34, -5, 68, 10); g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(-34, -5, 68, 10); g.restore(); }
      g.strokeStyle = 'rgba(230,200,110,.7)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 26; i++) { const sx = x - 90 + rnd(i) * 180, sy = y - 8 + rnd(i, 3) * 26; g.moveTo(sx, sy); g.lineTo(sx + 12, sy + (i % 2 ? 3 : -3)); } g.stroke();
      for (let i = 0; i < 6; i++) paper(x + 70 + rnd(i) * 60, y + 10 + rnd(i, 2) * 20, rnd(i, 5) * 3, 30, 16, '#9ac89a');
      break;
    }
    case 'spiked': { // broken glass and spilled pills
      g.fillStyle = 'rgba(140,255,200,.25)'; g.beginPath(); g.ellipse(x, y + 4, 70, 11, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 10; i++) { const gx = x - 60 + rnd(i) * 120, gy = y - 4 + rnd(i, 2) * 20; g.fillStyle = 'rgba(210,245,255,.8)'; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 8, gy - 6); g.lineTo(gx + 12, gy + 2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(40,60,80,.7)'; g.lineWidth = 1; g.stroke(); }
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#ff5aa8' : '#fff'; g.beginPath(); g.ellipse(x + 70 + rnd(i) * 50, y + 12 + rnd(i, 3) * 14, 5, 2.6, rnd(i, 4) * 3, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'missing': default: { // an overturned handbag, its contents, a dropped phone with a cracked screen
      g.save(); g.translate(x - 30, y); g.rotate(0.5); g.fillStyle = '#8a2a4a'; g.beginPath(); g.moveTo(-26, -14); g.lineTo(26, -14); g.lineTo(32, 14); g.lineTo(-32, 14); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(0, -14, 14, Math.PI, 0); g.stroke(); g.restore();
      g.fillStyle = '#e8c21a'; g.beginPath(); g.arc(x + 20, y + 14, 5, 0, Math.PI * 2); g.fill(); // compact
      g.fillStyle = '#d8122e'; g.fillRect(x + 36, y + 4, 14, 4); // lipstick
      g.save(); g.translate(x + 80, y + 10); g.rotate(-0.2); g.fillStyle = '#111'; g.fillRect(-12, -7, 24, 14); g.strokeStyle = '#9ad8ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -5); g.lineTo(2, 1); g.lineTo(-2, 5); g.moveTo(2, 1); g.lineTo(9, -3); g.stroke(); g.restore();
      paper(x - 100, y + 16, -0.4);
    }
  }
  g.restore();
}

/** A near-black foreground silhouette at the frame's edge, per setting: depth, and a frame. */
export function paintForeground(g, key, v) {
  const x0 = v.x0, y1 = v.y1;
  const S = '#07040b', rim = 'rgba(255,220,170,.28)';
  g.save();
  g.fillStyle = S; g.strokeStyle = rim; g.lineWidth = 2;
  const fillRim = () => { g.fill(); g.stroke(); };
  switch (key) {
    case 'office': // an office chair's back and armrest, close to camera
      g.beginPath(); g.moveTo(x0 - 20, y1 + 10); g.lineTo(x0 - 20, 420); g.quadraticCurveTo(x0 + 20, 380, x0 + 110, 400); g.quadraticCurveTo(x0 + 160, 420, x0 + 150, 480);
      g.lineTo(x0 + 140, y1 + 10); g.closePath(); fillRim();
      g.beginPath(); g.rect(x0 + 130, 500, 90, 16); fillRim();
      break;
    case 'apartment': // the back of an armchair
      g.beginPath(); g.moveTo(x0 - 20, y1 + 10); g.lineTo(x0 - 10, 440); g.quadraticCurveTo(x0 + 40, 400, x0 + 120, 420); g.quadraticCurveTo(x0 + 190, 440, x0 + 180, 520); g.lineTo(x0 + 200, y1 + 10); g.closePath(); fillRim();
      break;
    case 'alley': // fire-escape stair stringers and rails
      g.lineWidth = 16; g.strokeStyle = S; g.beginPath(); g.moveTo(x0 - 10, 120); g.lineTo(x0 + 150, y1 + 20); g.moveTo(x0 + 30, 60); g.lineTo(x0 + 190, y1 + 20); g.stroke();
      g.lineWidth = 8; g.beginPath(); for (let i = 0; i < 7; i++) { const k = i / 7; g.moveTo(x0 - 10 + k * 160, 120 + k * (y1 - 100)); g.lineTo(x0 + 30 + k * 160, 60 + k * (y1 - 40)); } g.stroke();
      g.lineWidth = 2; g.strokeStyle = rim; g.beginPath(); g.moveTo(x0 + 38, 60); g.lineTo(x0 + 198, y1 + 20); g.stroke();
      break;
    case 'barn': // a timber post and a hanging pitchfork
      g.beginPath(); g.rect(x0 - 10, -20, 70, y1 + 40); fillRim();
      g.lineWidth = 5; g.strokeStyle = S; g.beginPath(); g.moveTo(x0 + 110, -10); g.lineTo(x0 + 110, 250); g.moveTo(x0 + 92, 250); g.lineTo(x0 + 128, 250);
      for (const dx of [-18, -6, 6, 18]) { g.moveTo(x0 + 110 + dx, 250); g.lineTo(x0 + 110 + dx, 300); } g.stroke();
      break;
    case 'casino': // bar stools
      for (const [sx, sy] of [[x0 + 40, 470], [x0 + 150, 510]]) {
        g.beginPath(); g.ellipse(sx, sy, 50, 14, 0, 0, Math.PI * 2); fillRim();
        g.beginPath(); g.rect(sx - 6, sy, 12, y1 - sy + 20); g.fill();
        g.beginPath(); g.ellipse(sx, sy + 70, 30, 6, 0, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = S; g.stroke(); g.strokeStyle = rim; g.lineWidth = 2;
      }
      break;
    case 'factory': // a safety railing and a hanging chain hook
      g.lineWidth = 12; g.strokeStyle = S; g.beginPath(); g.moveTo(x0 - 20, 480); g.lineTo(x0 + 190, 500); g.moveTo(x0 - 20, 540); g.lineTo(x0 + 190, 555);
      g.moveTo(x0 + 40, 480); g.lineTo(x0 + 40, y1 + 20); g.moveTo(x0 + 150, 495); g.lineTo(x0 + 150, y1 + 20); g.stroke();
      g.lineWidth = 4; g.beginPath(); for (let y = -10; y < 300; y += 16) g.ellipse(x0 + 100, y, 5, 8, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 9; g.beginPath(); g.arc(x0 + 100, 320, 16, -Math.PI / 2, Math.PI * 0.9); g.stroke();
      break;
  }
  g.restore();
}
