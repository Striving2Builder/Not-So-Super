// The code-built infiltration venues (Warehouse, Penthouse, Underground Lair): materials, lights
// and set dressing on top of Special3D's shared floor plan (main hall 30×24 around the origin,
// back room behind the security door at z −12…−22, office at x 15…25). Everything registered
// here through zn.box / zn.cyl / add() is merged per material after decorate(), so the extra
// detail costs few draw calls. Textures are canvas-drawn in the comic style: flat pulp colour,
// ink lines, stencils, a little grime.
import * as THREE from 'three';
import { toon, lightPool } from './look3d.js';
import { rand, chance } from './util.js';
import { quality } from './settings.js';

export const VENUE_KINDS = new Set(['warehouse', 'penthouse', 'lair']);

// ---------------------------------------------------------------- canvas helpers
function tex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const blotch = (g, w, h, n, col, rMin, rMax, aMax) => {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rand(rMin, rMax);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', (Math.random() * aMax).toFixed(3))); gr.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
};
const specks = (g, w, h, n, dark = 0.12, light = 0.06, s = 2) => {
  for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < 0.6 ? `rgba(0,0,0,${dark})` : `rgba(255,255,255,${light})`; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
};
const hazardFill = (g, x, y, w, h, s = 16, a = '#f2c21a', b = '#141014') => {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h); g.fillStyle = b;
  for (let i = -h; i < w + h; i += s * 2) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + s, y); g.lineTo(x + i + s - h, y + h); g.lineTo(x + i - h, y + h); g.fill(); }
  g.restore();
};
const stencil = (g, text, x, y, size, col, rot = 0, font = 'Impact, "Arial Black", sans-serif') => {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `900 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col; g.fillText(text, 0, 0);
  g.restore();
};
const worldTile = (m, metres) => { m.userData.worldUV = metres; return m; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// ---------------------------------------------------------------- materials
/** Materials + light rig for a venue. Called before the rooms are built. */
export function venueMats(zn, k) {
  const V = zn.V;
  const cap = toon(0x17121c, {}, { halftone: 0 });
  const M = { cap, skirtH: 0.24 };
  const W = 1024, H = Math.round((1024 * 24) / 30);
  const px = (x) => ((x + 15) / 30) * W, pz = (z) => ((z + 12) / 24) * H, m2p = W / 30;

  if (k === 'warehouse') {
    const wallT = tex(256, 256, (g, w, h) => {
      // corrugated sheet above, painted brick below (1.2 m of the 3.4 m wall)
      const split = h * (1 - 1.2 / 3.4);
      g.fillStyle = '#62748a'; g.fillRect(0, 0, w, split);
      for (let x = 0; x < w; x += 10) { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, 0, 3, split); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 6, 0, 3, split); }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 3, split); g.fillRect(w / 2, 0, 3, split);
      for (let i = 0; i < 5; i++) { const x = Math.random() * w; const gr = g.createLinearGradient(0, 30, 0, split); gr.addColorStop(0, 'rgba(150,70,20,.5)'); gr.addColorStop(1, 'rgba(150,70,20,0)'); g.fillStyle = gr; g.fillRect(x, 30 + Math.random() * 30, rand(3, 7), split); }
      g.fillStyle = '#8a3b2a'; g.fillRect(0, split, w, h - split);
      g.strokeStyle = '#2a1410'; g.lineWidth = 2;
      for (let y = split, r = 0; y < h; y += 12, r++) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (r % 2) * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); }
      }
      g.fillStyle = '#141014'; g.fillRect(0, split - 4, w, 6);
      specks(g, w, h, 300);
    }, { repeat: true });
    M.wall = worldTile(toon(0xffffff, { map: wallT }, { halftone: 0.6 }), 3.4);
    M.skirt = worldTile(toon(0xffffff, { map: hazardTex() }, { halftone: 0 }), 1.2); M.skirtH = 0.2;
    M.hall = toon(0xffffff, { map: tex(W, H, (g) => { lit(g, () => {
      g.fillStyle = '#6d7077'; g.fillRect(0, 0, W, H);
      blotch(g, W, H, 60, 'rgba(30,32,40,A)', 30, 140, 0.35);
      blotch(g, W, H, 30, 'rgba(200,200,190,A)', 30, 120, 0.12);
      specks(g, W, H, 3000, 0.18, 0.08);
      g.strokeStyle = 'rgba(20,16,20,.7)'; g.lineWidth = 2;
      for (let x = -15; x <= 15; x += 3) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
      for (let z = -12; z <= 12; z += 3) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(W, pz(z)); g.stroke(); }
      // oil stains + tyre tracks
      blotch(g, W, H, 14, 'rgba(8,8,12,A)', 12, 40, 0.7);
      g.strokeStyle = 'rgba(15,15,20,.25)'; g.lineWidth = 9;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(px(rand(-12, 12)), pz(12)); g.bezierCurveTo(px(rand(-10, 10)), pz(4), px(rand(-10, 10)), pz(-4), px(rand(-12, 12)), pz(-11)); g.stroke(); }
      // painted walkway to the security door, hazard apron in front of it
      g.fillStyle = '#f2c21a';
      for (const x of [-2.1, 1.95]) g.fillRect(px(x), pz(-10.4), 0.15 * m2p, pz(11.5) - pz(-10.4));
      hazardFill(g, px(-2.2), pz(-12), 4.4 * m2p, 1.5 * m2p, 12);
      g.strokeStyle = '#141014'; g.lineWidth = 3; g.strokeRect(px(-2.2), pz(-12), 4.4 * m2p, 1.5 * m2p);
      // bay markings around the crate stacks
      g.strokeStyle = 'rgba(242,194,26,.85)'; g.lineWidth = 4;
      for (const [x, z] of [[-9.5, -6.5], [9, 7.5], [-8.5, 7.5]]) g.strokeRect(px(x - 3), pz(z - 2.5), 6 * m2p, 5 * m2p);
      stencil(g, 'DOCK 7', px(-8), pz(1.2), 64, 'rgba(242,242,230,.55)');
      stencil(g, 'B-2', px(9), pz(-1.5), 48, 'rgba(242,194,26,.6)');
      stencil(g, 'NO SMOKING', px(0), pz(9), 30, 'rgba(230,60,40,.7)');
      g.strokeStyle = 'rgba(230,60,40,.7)'; g.lineWidth = 4; g.strokeRect(px(-3.2), pz(8.4), 6.4 * m2p, 1.2 * m2p);
    }, LIGHT.warehouse); }) }, { halftone: 0.5 });
    M.back = roomFloor(concreteTile('#4a4c52', '#2a2a30'), 12, 10, [[0, 0, 3.5, '#ffd9a0', 0.45]]);
    M.office = roomFloor(planks('#7a5838', '#4a321e'), 10, 10, [[0, 0, 3.2, '#ffe6c0', 0.45]]);
    M.mat = toon(0xffffff, { map: tex(128, 96, (g, w, h) => { g.fillStyle = '#232323'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3a3a'; g.lineWidth = 3; for (let x = 4; x < w; x += 8) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); } hazardFill(g, 0, 0, w, 8, 6); hazardFill(g, 0, h - 8, w, 8, 6); }) });
    M.door = doorMat('#6a7480', 'RESTRICTED');
    M.hazard = toon(0xffffff, { map: hazardTex() }, { halftone: 0 });
    M.lights = () => rig(zn, { sky: 0xc8d4ea, ground: 0x3a342c, hemi: 0.85, amb: 0.15, key: 0xffe2b8, keyK: 1.2 });
  } else if (k === 'penthouse') {
    // floor-to-ceiling glass; bronze frames; the city far below
    M.wall = toon(0x9fd0ff, { transparent: true, opacity: 0.22, emissive: 0x0a1830 }, { halftone: 0 });
    M.skirt = toon(0x3a2a1c, {}, { halftone: 0.3 }); M.skirtH = 0.16;
    M.rail = toon(0x8a6a3a, { emissive: 0x2a1a08 }, { halftone: 0 }); M.railY = 3.32;
    M.posts = { mat: toon(0x2a2018, {}, { halftone: 0 }), every: 2.6 };
    M.hall = toon(0xffffff, { map: tex(W, H, (g) => { lit(g, () => {
      // cream marble slabs with gold joints, a black marble border, an art-deco medallion
      g.fillStyle = '#e8dfcf'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(${chance(0.5) ? '150,130,110' : '110,110,120'},${rand(0.12, 0.3)})`; g.lineWidth = rand(0.6, 2.2);
        g.beginPath(); let x = Math.random() * W, y = Math.random() * H; g.moveTo(x, y);
        for (let j = 0; j < 5; j++) { x += rand(-60, 60); y += rand(-60, 60); g.lineTo(x, y); } g.stroke();
      }
      blotch(g, W, H, 30, 'rgba(200,180,150,A)', 40, 160, 0.25);
      g.strokeStyle = '#b8903a'; g.lineWidth = 3;
      for (let x = -15; x <= 15; x += 2.5) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
      for (let z = -12; z <= 12; z += 2.5) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(W, pz(z)); g.stroke(); }
      const b = 1.1 * m2p;
      g.fillStyle = '#1c1a20';
      g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b); g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H);
      g.strokeStyle = '#d0a848'; g.lineWidth = 4; g.strokeRect(b, b, W - 2 * b, H - 2 * b); g.lineWidth = 2; g.strokeRect(b + 8, b + 8, W - 2 * b - 16, H - 2 * b - 16);
      // medallion
      const cx = px(-4), cy = pz(0.5);
      for (const [r, c] of [[3.1, '#1c1a20'], [2.9, '#d0a848'], [2.7, '#1c1a20'], [2.1, '#e8dfcf']]) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r * m2p, 0, 7); g.fill(); }
      g.fillStyle = '#d0a848';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a - 0.07) * 2.1 * m2p, cy + Math.sin(a - 0.07) * 2.1 * m2p); g.lineTo(cx + Math.cos(a + 0.07) * 2.1 * m2p, cy + Math.sin(a + 0.07) * 2.1 * m2p); g.fill(); }
      g.fillStyle = '#1c1a20'; g.beginPath(); g.arc(cx, cy, 0.5 * m2p, 0, 7); g.fill();
    }, LIGHT.penthouse); }) }, { halftone: 0.4 });
    M.back = roomFloor(planks('#5a3a24', '#2e1c10', true), 12, 10, [[0, 0, 3.5, '#ffd6a0', 0.35]]);
    M.office = roomFloor(planks('#6a4a2e', '#3a2616', true), 10, 10, [[0, 0, 3.2, '#fff0d0', 0.35]]);
    M.mat = toon(0x3a1420);
    M.door = doorMat('#2a2a34', 'PRIVATE', '#d0a848');
    M.hazard = toon(0xd0a848, { emissive: 0x3a2a08 }, { halftone: 0 });
    M.lights = () => rig(zn, { sky: 0x9ab4e8, ground: 0x6a5a48, hemi: 0.8, amb: 0.12, key: 0xffe6c8, keyK: 1.1 });
  } else {
    // lair: riveted bunker panels, a toxic-green glow in the floor grates
    const wallT = tex(256, 256, (g, w, h) => {
      g.fillStyle = '#3a4640'; g.fillRect(0, 0, w, h);
      blotch(g, w, h, 20, 'rgba(10,20,14,A)', 10, 60, 0.4);
      g.strokeStyle = '#0c120e'; g.lineWidth = 3;
      for (let y = 0; y <= h; y += h / 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let x = 0; x <= w; x += w / 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = '#6a7a70';
      for (let y = 8; y < h; y += h / 3) for (let x = 8; x < w; x += 20) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(57,255,106,.25)'; g.fillRect(0, h * 0.62, w, 5);
      specks(g, w, h, 300);
    }, { repeat: true });
    M.wall = worldTile(toon(0xffffff, { map: wallT }, { halftone: 0.6 }), 3.4);
    M.skirt = worldTile(toon(0xffffff, { map: hazardTex('#a0ff39') }, { halftone: 0 }), 1.2); M.skirtH = 0.26;
    const grateE = tex(W, H, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#39ff6a';
      for (const z of [-6, 0, 6]) g.fillRect(0, pz(z) - 3, W, 6);
      for (const x of [-9, 9]) g.fillRect(px(x) - 3, 0, 6, H);
      g.fillStyle = '#a0ff39'; g.fillRect(px(-2.1), pz(-12), 4.2 * m2p, 5);
    });
    M.hall = toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9, emissiveMap: grateE, map: tex(W, H, (g) => { lit(g, () => {
      g.fillStyle = '#2c3430'; g.fillRect(0, 0, W, H);
      // diamond plate in each 2 m panel
      g.fillStyle = 'rgba(255,255,255,.07)';
      for (let y = 4; y < H; y += 14) for (let x = (y / 14) % 2 ? 4 : 11; x < W; x += 14) { g.save(); g.translate(x, y); g.rotate(0.6); g.fillRect(-4, -1.2, 8, 2.4); g.restore(); }
      blotch(g, W, H, 50, 'rgba(0,0,0,A)', 30, 120, 0.45);
      g.strokeStyle = '#0a0e0c'; g.lineWidth = 3;
      for (let x = -15; x <= 15; x += 2) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
      for (let z = -12; z <= 12; z += 2) { g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(W, pz(z)); g.stroke(); }
      g.fillStyle = '#7a8a80';
      for (let x = -15; x < 15; x += 2) for (let z = -12; z < 12; z += 2) for (const [dx, dz] of [[0.15, 0.15], [1.85, 0.15], [0.15, 1.85], [1.85, 1.85]]) { g.beginPath(); g.arc(px(x + dx), pz(z + dz), 2.5, 0, 7); g.fill(); }
      // grates (glow comes from the emissive map)
      g.fillStyle = '#0a1a0e';
      for (const z of [-6, 0, 6]) g.fillRect(0, pz(z) - 7, W, 14);
      for (const x of [-9, 9]) g.fillRect(px(x) - 7, 0, 14, H);
      hazardFill(g, px(-2.2), pz(-12), 4.4 * m2p, 1.4 * m2p, 12, '#a0ff39');
      stencil(g, 'SECTOR 13', px(8), pz(3), 54, 'rgba(160,255,57,.35)');
      stencil(g, '☠', px(-8), pz(-3), 110, 'rgba(160,255,57,.2)', 0, 'Georgia, serif');
    }, LIGHT.lair); }) }, { halftone: 0.5 });
    M.back = roomFloor(concreteTile('#262e2a', '#101612'), 12, 10, [[0, 0, 3.5, '#39ff6a', 0.4]]);
    M.office = roomFloor(concreteTile('#303834', '#141a16'), 10, 10, [[0, 0, 3.2, '#d0ffe0', 0.35]]);
    M.mat = toon(0x1a201c);
    M.door = doorMat('#2e3a34', 'LAB 0', '#a0ff39');
    M.hazard = toon(0xffffff, { map: hazardTex('#a0ff39') }, { halftone: 0 });
    M.lights = () => rig(zn, { sky: 0xa8f0c0, ground: 0x0a1a10, hemi: 0.75, amb: 0.1, key: 0xd8ffe0, keyK: 1.0 });
  }
  return M;
}

function hazardTex(a = '#f2c21a') { return tex(64, 64, (g, w, h) => hazardFill(g, 0, 0, w, h, 16, a), { repeat: true }); }

function concreteTile(base, joint) {
  return tex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    blotch(g, w, h, 10, 'rgba(0,0,0,A)', 10, 40, 0.3);
    specks(g, w, h, 300);
    g.strokeStyle = joint; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, { repeat: true });
}

function planks(a, b, polished = false) {
  return tex(128, 128, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : shade(a, -12); g.fillRect(0, i * 16, w, 16);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
      for (let j = 0; j < 3; j++) { g.beginPath(); g.moveTo(0, i * 16 + rand(3, 13)); g.bezierCurveTo(w / 3, i * 16 + rand(2, 14), (2 * w) / 3, i * 16 + rand(2, 14), w, i * 16 + rand(3, 13)); g.stroke(); }
      g.fillStyle = b; g.fillRect(0, i * 16 + 15, w, 2);
      g.fillRect(((i * 37) % 4) * 32 + 16, i * 16, 2, 16);
    }
    if (polished) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }, { repeat: true });
}

function shade(hexCol, d) {
  const n = parseInt(hexCol.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function doorMat(base, label, accent = '#f2c21a') {
  return toon(0xffffff, { map: tex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(8, 8, w - 16, 4);
    g.fillStyle = 'rgba(0,0,0,.5)'; for (let x = 12; x < w; x += 13) for (const y of [12, h - 12]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    stencil(g, label, w / 2, h * 0.55, 17, accent);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(w / 2 - 1, 16, 2, h - 32);
  }) }, { halftone: 0.4 });
}

// Lamp positions over the hall (x, z) and their colours per venue. Their light is baked into the
// floor texture (pools + contact darkening along the walls) rather than being dynamic point
// lights: per-pixel lights are the most expensive thing a phone GPU does here.
export const LAMPS = [[-8, -3], [8, -3], [0, 7]];
const LIGHT = {
  warehouse: { cols: ['#ffc27a', '#ffd9a0', '#9fc8ff'], k: 0.5, edge: 0.55 },
  penthouse: { cols: ['#ffd6a0', '#ffe4b8', '#ffc890'], k: 0.35, edge: 0.3 },
  lair: { cols: ['#39ff6a', '#a0ff39', '#39ffd0'], k: 0.45, edge: 0.6 },
};

/** Run `draw`, then bake the lamp pools and the darkening at the foot of the walls into the hall floor. */
function lit(g, draw, L) {
  draw();
  const W = g.canvas.width, H = g.canvas.height, px = (x) => ((x + 15) / 30) * W, pz = (z) => ((z + 12) / 24) * H, m = W / 30;
  poolsOn(g, LAMPS.map(([x, z], i) => [px(x), pz(z), 6.5 * m, L.cols[i], L.k]));
  edgeShade(g, W, H, 1.6 * m, L.edge);
}

function poolsOn(g, pools) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, col, k] of pools) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = parseInt(col.slice(1), 16), rgb = `${c >> 16},${(c >> 8) & 255},${c & 255}`;
    gr.addColorStop(0, `rgba(${rgb},${k})`); gr.addColorStop(0.45, `rgba(${rgb},${k * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
}

function edgeShade(g, W, H, band, k) {
  for (const [x0, y0, x1, y1, x, y, w, h] of [[0, 0, 0, band, 0, 0, W, band], [0, H, 0, H - band, 0, H - band, W, band], [0, 0, band, 0, 0, 0, band, H], [W, 0, W - band, 0, W - band, 0, band, H]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(0,0,0,${k})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
}

/** A room floor (own UVs, w×d metres) tiled from a 2 m tile texture, with baked light pools. */
function roomFloor(tile, w, d, pools, ppm = 32) {
  const t = tex(w * ppm, d * ppm, (g, W, H) => {
    const pat = g.createPattern(tile.image, 'repeat');
    const k = (2 * ppm) / tile.image.width;
    pat.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    poolsOn(g, pools.map(([x, z, r, col, a]) => [W / 2 + x * ppm, H / 2 + z * ppm, r * ppm, col, a]));
    edgeShade(g, W, H, 1.2 * ppm, 0.5);
  });
  return toon(0xffffff, { map: t });
}

/** Hemisphere + ambient; the key light (set up by the zone) is tinted for the venue. No point lights. */
function rig(zn, o) {
  const S = zn.scene;
  S.add(new THREE.HemisphereLight(o.sky, o.ground, o.hemi));
  S.add(new THREE.AmbientLight(0xffffff, o.amb));
  zn.key.color.set(o.key); zn.key.intensity = o.keyK;
  zn.plights = [];
}

// ---------------------------------------------------------------- dressing
/** Set dressing for one venue. `h` = Special3D's decorating helpers. */
export function decorateVenue(zn, k, h) {
  const { spot } = h;
  const S = zn.scene;
  /** Any geometry as a static prop (merged after decorate). */
  const add = (geo, mat, x, y, z, { ry = 0, rx = 0, rz = 0, collide = null } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    S.add(m); zn._static.push(m);
    if (collide) zn.colliders.push({ minX: x - collide[0], maxX: x + collide[0], minZ: z - collide[1], maxZ: z + collide[1], mesh: m });
    return m;
  };
  const T = { add, spot, zn };
  if (k === 'warehouse') warehouse(zn, T);
  else if (k === 'penthouse') penthouse(zn, T, h);
  else lair(zn, T, h);
}

const C = {}; // per-build material cache (shared across props so they merge)
function mat(key, make) { return C[key] || (C[key] = make()); }

function crateTex(base, mark) {
  return tex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 21) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 2); }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4;
    g.fillStyle = shade(base, -25);
    g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12); g.fillRect(0, 0, 12, h); g.fillRect(w - 12, 0, 12, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4); g.fillRect(-80, -6, 160, 12); g.restore();
    g.strokeRect(2, 2, w - 4, h - 4);
    if (mark) stencil(g, mark, w / 2, h / 2, 22, 'rgba(20,16,20,.75)');
  });
}

function warehouse(zn, { add, spot }) {
  for (const key in C) delete C[key];
  const crateA = mat('crA', () => toon(0xffffff, { map: crateTex('#a8783e', 'FRAGILE') }));
  const crateB = mat('crB', () => toon(0xffffff, { map: crateTex('#5a6e3a', 'U.S.') }));
  const crateC = mat('crC', () => toon(0xffffff, { map: crateTex('#9a6a34', '') }));
  const pallet = mat('pal', () => toon(0x7a5a34));
  const steelBlue = mat('stB', () => toon(0x2f4c8a));
  const beamOr = mat('bmO', () => toon(0xe07a22));
  const card = mat('card', () => toon(0xc8a068));
  const yellow = mat('yel', () => toon(0xf2c21a));
  const black = mat('blk', () => toon(0x1d1a20));
  const drumR = mat('drR', () => toon(0xc0302a));
  const drumB = mat('drB', () => toon(0x2a5aa8));
  const shadeM = mat('shd', () => toon(0x2a4a3a));
  const bulb = mat('blb', () => new THREE.MeshBasicMaterial({ color: 0xffe6a8 }));
  const steel = mat('stl', () => toon(0x5a626e));

  // crate stacks on pallets (bottom crate collides; stacks leave the patrol lanes clear)
  const stacks = [[-11, -8], [-11, -5], [-8, -8], [10, 8], [10, 5], [7, 9], [-10, 7], [-7, 8], [11, -8], [8, -6], [4, 7], [-4, -7]];
  stacks.forEach(([x, z], i) => {
    const n = chance(0.5) ? 2 : 1, r = () => rand(-0.12, 0.12);
    add(new THREE.BoxGeometry(1.5, 0.14, 1.5), pallet, x, 0.07, z);
    for (let j = 0; j < n; j++) {
      const m = [crateA, crateB, crateC][(i + j) % 3];
      zn.box(1.4, 1.2, 1.4, x + r(), 0.74 + j * 1.2, z + r(), m, { collide: j === 0 });
      zn._static[zn._static.length - 1].rotation.y = rand(-0.12, 0.12);
    }
    spot(x, n * 1.2 + 0.16, z);
  });
  // pallet racking along the central aisle, loaded with boxes
  for (const x of [-3, 3]) {
    for (const z of [-2, 4]) zn.box(0.12, 3, 0.12, x, 1.5, z, steelBlue, { collide: false });
    for (const z of [-2, 4]) zn.box(0.12, 3, 0.12, x + (x < 0 ? -0.6 : 0.6), 1.5, z, steelBlue, { collide: false });
    zn.colliders.push({ minX: x - 0.75, maxX: x + 0.75, minZ: -2.1, maxZ: 4.1 });
    for (const y of [0.35, 1.3, 2.25]) {
      for (const dx of [0, x < 0 ? -0.6 : 0.6]) zn.box(0.1, 0.12, 6.1, x + dx, y, 1, beamOr, { collide: false });
      for (let z = -1.5; z < 3.6; z += rand(0.7, 1.1)) {
        const w = rand(0.4, 0.62), hh = rand(0.3, 0.7);
        if (chance(0.8)) add(new THREE.BoxGeometry(w, hh, rand(0.4, 0.62)), card, x + (x < 0 ? -0.3 : 0.3), y + 0.06 + hh / 2, z, { ry: rand(-0.2, 0.2) });
      }
    }
  }
  // forklift (same footprint as the old yellow block)
  zn.colliders.push({ minX: 6.2, maxX: 7.8, minZ: -3.4, maxZ: -0.7 });
  add(new THREE.BoxGeometry(1.4, 0.8, 2.0), yellow, 7, 0.6, -1.9);
  add(new THREE.BoxGeometry(1.3, 0.55, 0.6), black, 7, 0.95, -0.95); // counterweight
  for (const [dx, dz] of [[-0.62, -0.7], [0.62, -0.7], [-0.62, 0.5], [0.62, 0.5]]) add(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 14), black, 7 + dx, 0.32, -1.9 + dz, { rz: Math.PI / 2 });
  for (const [dx, dz] of [[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.6], [0.6, 0.6]]) add(new THREE.BoxGeometry(0.07, 1.3, 0.07), black, 7 + dx, 1.65, -1.9 + dz);
  add(new THREE.BoxGeometry(1.35, 0.07, 1.55), yellow, 7, 2.32, -2.0);
  add(new THREE.BoxGeometry(0.5, 0.5, 0.35), black, 7, 1.25, -1.6); // seat
  for (const dx of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.1, 2.4, 0.1), steel, 7 + dx, 1.3, -3.0);
  add(new THREE.BoxGeometry(1.0, 0.1, 0.1), steel, 7, 2.4, -3.0);
  for (const dx of [-0.3, 0.3]) add(new THREE.BoxGeometry(0.12, 0.06, 1.1), steel, 7 + dx, 0.12, -3.6);
  // oil drums against the walls
  for (const [x, z] of [[-13.9, 9.8], [-13.3, 10.6], [-14, 10.9], [13.9, -3.2], [13.2, -3.9], [13.9, -4.4], [-13.8, -1.2], [-13.8, -0.4]]) {
    const m = chance(0.5) ? drumR : drumB;
    add(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 14), m, x, 0.475, z, { collide: [0.32, 0.32] });
    for (const y of [0.3, 0.65]) add(new THREE.CylinderGeometry(0.335, 0.335, 0.05, 14), black, x, y, z);
  }
  // steel columns every 6 m along the long walls, hazard-banded
  const hz = zn.vmats.hazard;
  for (const z of [-6, 0, 6]) for (const x of [-14.6, 14.6]) {
    if (x > 0 && Math.abs(z) < 2) continue; // office doorway
    zn.box(0.45, 3.4, 0.45, x, 1.7, z, steel, { collide: true });
    add(new THREE.BoxGeometry(0.47, 0.5, 0.47), hz, x, 0.25, z);
  }
  for (const [x, z] of [[-14.6, 11.6], [14.6, 11.6], [-14.6, -11.6], [14.6, -11.6]]) zn.box(0.5, 3.4, 0.5, x, 1.7, z, steel, { collide: true });
  // roll-up loading door on the left wall
  const shutter = mat('shut', () => toon(0xffffff, { map: tex(128, 128, (g, w, h) => {
    g.fillStyle = '#8a9098'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, y + 2, w, 2); }
    hazardFill(g, 0, h - 14, w, 14, 8);
    stencil(g, '7', w / 2, h * 0.4, 60, 'rgba(242,194,26,.9)');
  }) }));
  add(new THREE.PlaneGeometry(4, 3), shutter, -14.78, 1.5, 3, { ry: Math.PI / 2 });
  add(new THREE.BoxGeometry(0.3, 0.3, 4.4), black, -14.7, 3.1, 3);
  // hanging work lamps over the light pools
  // office: desk, chair, filing boxes, a pin-board
  zn.box(2.6, 0.12, 1.2, 20, 0.78, 0, mat('desk', () => toon(0x6a4a2a)));
  for (const [dx, dz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) zn.box(0.08, 0.74, 0.08, 20 + dx, 0.37, dz, black, { collide: false });
  zn.colliders.push({ minX: 18.7, maxX: 21.3, minZ: -0.6, maxZ: 0.6 });
  add(new THREE.BoxGeometry(0.5, 0.36, 0.06), mat('mon', () => new THREE.MeshBasicMaterial({ color: 0x6ab0ff })), 20, 1.05, -0.3);
  add(new THREE.BoxGeometry(0.55, 0.5, 0.55), black, 20, 0.45, 1.1);
  spot(20.8, 0.86, 0.2);
  add(new THREE.PlaneGeometry(2.4, 1.4), mat('pin', () => toon(0xffffff, { map: tex(128, 76, (g, w, h) => {
    g.fillStyle = '#a07040'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { g.fillStyle = ['#f4f0e0', '#ffe070', '#9fd0ff'][i % 3]; g.save(); g.translate(rand(12, w - 12), rand(10, h - 10)); g.rotate(rand(-0.3, 0.3)); g.fillRect(-10, -8, 20, 16); g.restore(); }
    g.strokeStyle = '#c22'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 5; i++) g.lineTo(rand(10, w - 10), rand(10, h - 10)); g.stroke();
  }) })), 24.78, 1.8, 0, { ry: -Math.PI / 2 });
  // back room: weapons crates under a work light
  for (const [x, z] of [[-4.5, -21], [4.5, -21], [-4.8, -13.2]]) zn.box(1.4, 0.8, 0.9, x, 0.4, z, crateB);
}

function penthouse(zn, { add, spot }, h) {
  for (const key in C) delete C[key];
  const { table } = h;
  const white = mat('wht', () => toon(0xeee6d8));
  const leather = mat('lth', () => toon(0x2a1c18));
  const gold = mat('gld', () => toon(0xd0a848, { emissive: 0x2a1a04 }));
  const black = mat('blk', () => toon(0x16141a));
  const glass = mat('gls', () => toon(0xbfe6ff, { transparent: true, opacity: 0.35 }));
  const leaf = mat('lf', () => toon(0x2f8a4a));
  const pot = mat('pot', () => toon(0xe0dcd0));
  const lampGlow = mat('lmp', () => new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));

  // the city at night beyond the glass: a skyline band plus scattered lights far below
  const sky = tex(1024, 256, (g, w, hh) => {
    const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#050a18'); gr.addColorStop(0.55, '#16204a'); gr.addColorStop(1, '#3a2a5a');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    for (let x = 0; x < w;) {
      const bw = rand(18, 50), bh = rand(40, 170), c = rand(12, 26) | 0;
      g.fillStyle = `rgb(${c},${c + 4},${c + 18})`; g.fillRect(x, hh - bh, bw, bh);
      g.fillStyle = '#ffd98a';
      for (let y = hh - bh + 6; y < hh - 4; y += 7) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if (chance(0.28)) g.fillRect(wx, y, 2, 3);
      if (chance(0.15)) { g.fillStyle = '#ff3a3a'; g.fillRect(x + bw / 2, hh - bh - 6, 2, 6); }
      x += bw + rand(0, 6);
    }
  }, { repeat: true });
  sky.wrapT = THREE.ClampToEdgeWrapping; sky.repeat.set(3, 1);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 34, 40, 1, true), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false }));
  band.position.set(4, -8, -4);
  zn.scene.add(band);
  const pts = [];
  for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, d = rand(24, 55); pts.push(Math.cos(a) * d, rand(-22, -2), Math.sin(a) * d); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  zn.scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffd98a, size: 0.35, fog: false })));

  // rug under the lounge
  add(new THREE.BoxGeometry(8, 0.03, 5), mat('rug', () => toon(0xffffff, { map: tex(256, 160, (g, w, hh) => {
    g.fillStyle = '#7a1c2a'; g.fillRect(0, 0, w, hh);
    g.strokeStyle = '#d0a848'; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, hh - 20); g.lineWidth = 2; g.strokeRect(20, 20, w - 40, hh - 40);
    g.fillStyle = '#4a0e18'; g.beginPath(); g.ellipse(w / 2, hh / 2, 60, 40, 0, 0, 7); g.fill();
    g.strokeStyle = '#d0a848'; g.beginPath(); g.ellipse(w / 2, hh / 2, 60, 40, 0, 0, 7); g.stroke();
    specks(g, w, hh, 400, 0.1, 0.05);
  }) })), 4, 0.016, 3);
  // modular sofas: seat, back, arms, cushions
  const sofa = (x, z, len, rot) => {
    const ry = rot ? -Math.PI / 2 : 0;
    const P = (dx, dz) => (rot ? [x - dz, z + dx] : [x + dx, z + dz]);
    const box = (w, hh, d, dx, y, dz, m) => { const [px, pz] = P(dx, dz); add(new THREE.BoxGeometry(w, hh, d), m, px, y, pz, { ry }); };
    box(len, 0.42, 1.0, 0, 0.21, 0, white);
    box(len, 0.55, 0.26, 0, 0.62, 0.37, white);
    for (const s of [-1, 1]) box(0.24, 0.62, 1.0, s * (len / 2 - 0.12), 0.31, 0, white);
    for (let i = 0; i < Math.floor(len / 1.1); i++) { const [px, pz] = P(-len / 2 + 0.75 + i * 1.1, 0.2); add(new THREE.BoxGeometry(0.5, 0.42, 0.14), [gold, leather][i % 2], px, 0.66, pz, { ry: ry + rand(-0.15, 0.15), rx: -0.2 }); }
    const [cx, cz] = P(0, 0);
    zn.colliders.push(rot ? { minX: cx - 0.5, maxX: cx + 0.5, minZ: cz - len / 2, maxZ: cz + len / 2 } : { minX: cx - len / 2, maxX: cx + len / 2, minZ: cz - 0.5, maxZ: cz + 0.5 });
  };
  sofa(4, 5.8, 5, false);
  sofa(7.6, 3, 4, true);
  // glass coffee table on gold legs
  add(new THREE.BoxGeometry(2, 0.05, 1.1), glass, 4, 0.45, 3);
  for (const [dx, dz] of [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]]) add(new THREE.BoxGeometry(0.05, 0.43, 0.05), gold, 4 + dx, 0.215, 3 + dz);
  zn.colliders.push({ minX: 3, maxX: 5, minZ: 2.45, maxZ: 3.55 });
  spot(4, 0.5, 3);
  // grand piano
  const pb = new THREE.CylinderGeometry(1.0, 1.0, 0.36, 20, 1, false, 0, Math.PI); pb.scale(1.1, 1, 1.4);
  add(pb, black, -9, 0.92, 5.6, { ry: Math.PI / 2 });
  add(new THREE.BoxGeometry(2.2, 0.36, 0.9), black, -9, 0.92, 6.1);
  add(new THREE.BoxGeometry(2.1, 0.03, 0.2), white, -9, 1.12, 6.55);
  const lid = new THREE.CylinderGeometry(1.0, 1.0, 0.03, 20, 1, false, 0, Math.PI); lid.scale(1.1, 1, 1.4);
  add(lid, black, -9.4, 1.55, 5.5, { ry: Math.PI / 2, rz: 0.55 });
  for (const [dx, dz] of [[-0.9, 6.3], [0.9, 6.3], [0, 4.4]]) add(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 8), black, -9 + dx, 0.37, dz);
  add(new THREE.BoxGeometry(0.9, 0.5, 0.35), leather, -9, 0.25, 7.2);
  zn.colliders.push({ minX: -10.2, maxX: -7.8, minZ: 4.2, maxZ: 6.9 });
  // bar with a back shelf of bottles
  h.bar(-12.5, -5, 7, true);
  add(new THREE.BoxGeometry(0.3, 2.2, 7.2), mat('shelf', () => toon(0x3a2416)), -14.55, 1.1, -5);
  for (let i = 0; i < 18; i++) add(new THREE.CylinderGeometry(0.05, 0.06, rand(0.25, 0.38), 8), mat('b' + (i % 4), () => toon([0x2a8a4a, 0x8a2a2a, 0xd0a040, 0x4a6ab0][i % 4], { transparent: true, opacity: 0.85, emissive: [0x0a3a14, 0x3a0a0a, 0x3a2a08, 0x0a1a3a][i % 4] })), -14.4, 1.35 + (i % 2) * 0.55, -8 + (i / 18) * 6.2);
  for (const z of [-7.5, -5, -2.5]) add(new THREE.CylinderGeometry(0.22, 0.2, 0.08, 12), leather, -11.4, 0.78, z), add(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 6), gold, -11.4, 0.38, z);
  // side tables, statement lamps, plants
  table(9, -7, 0xeee6d8); table(-4, -6, 0xeee6d8);
  const plant = (x, z) => {
    add(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 12), pot, x, 0.3, z, { collide: [0.34, 0.34] });
    for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(rand(0.28, 0.4), 8, 6), leaf, x + rand(-0.25, 0.25), 0.85 + rand(0, 0.7), z + rand(-0.25, 0.25));
  };
  for (const [x, z] of [[-13.8, 10.8], [13.8, 10.8], [-13.8, -10.8], [13.8, -10.8], [-13.8, 2.6], [13.8, -7.5]]) plant(x, z);
  const floorLamp = (x, z) => {
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), gold, x, 0.02, z);
    add(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), gold, x, 0.87, z);
    add(new THREE.CylinderGeometry(0.2, 0.3, 0.35, 12), lampGlow, x, 1.75, z);
  };
  floorLamp(1.2, 6.6); floorLamp(9.2, 1); floorLamp(-11, 7.4);
  // sculpture on a plinth
  add(new THREE.BoxGeometry(0.7, 1.0, 0.7), white, 11.5, 0.5, -1.5, { collide: [0.35, 0.35] });
  add(new THREE.TorusKnotGeometry(0.28, 0.08, 48, 8), gold, 11.5, 1.45, -1.5);
  // office: executive desk, safe-grey cabinets are gameplay containers
  zn.box(2.8, 0.1, 1.3, 20, 0.78, 0, black);
  add(new THREE.BoxGeometry(2.6, 0.7, 0.1), black, 20, 0.38, 0.55);
  zn.colliders.push({ minX: 18.6, maxX: 21.4, minZ: -0.65, maxZ: 0.65 });
  add(new THREE.BoxGeometry(0.5, 0.34, 0.05), mat('mon', () => new THREE.MeshBasicMaterial({ color: 0x9fd0ff })), 20, 1.03, -0.35);
  add(new THREE.BoxGeometry(0.62, 1.1, 0.6), leather, 20, 0.55, 1.2);
  spot(20.8, 0.86, 0.2);
  // back room: a wall safe of cash and art crates
  for (const [x, z] of [[-4.6, -21], [4.6, -21]]) zn.box(1.2, 1.6, 0.8, x, 0.8, z, mat('art', () => toon(0x8a6a44)));
}

function lair(zn, { add, spot }, h) {
  for (const key in C) delete C[key];
  const { table } = h;
  const pipe = mat('pip', () => toon(0x2a6a3a));
  const pipeD = mat('pipD', () => toon(0x1e2a24));
  const metal = mat('mtl', () => toon(0x3a4640));
  const dark = mat('drk', () => toon(0x151a18));
  const goo = mat('goo', () => toon(0x39ff6a, { transparent: true, opacity: 0.42, emissive: 0x0e6a24 }));
  const glow = mat('glw', () => new THREE.MeshBasicMaterial({ color: 0x39ff6a }));
  const specimen = mat('spc', () => toon(0x0c2414, { emissive: 0x06200c }));

  // pipes: verticals along the back and left walls, a double run overhead along the walls
  for (let x = -13; x <= 13; x += 2.2) if (Math.abs(x) > 2) {
    add(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 10), pipe, x, 1.6, -11.55);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10), pipeD, x, 0.5, -11.55);
  }
  for (let z = -10; z <= 10; z += 2.5) add(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 10), pipe, -14.55, 1.6, z);
  for (const y of [2.7, 3.0]) {
    add(new THREE.CylinderGeometry(0.1, 0.1, 29, 10), pipeD, 0, y, -11.5, { rz: Math.PI / 2 });
    add(new THREE.CylinderGeometry(0.1, 0.1, 23, 10), pipeD, -14.5, y, 0, { rx: Math.PI / 2 });
    add(new THREE.CylinderGeometry(0.1, 0.1, 23, 10), pipeD, 14.5, y, 0, { rx: Math.PI / 2 });
  }
  // hypno-consoles with glowing screens
  const scr = mat('scr', () => new THREE.MeshBasicMaterial({ map: tex(128, 64, (g, w, hh) => {
    g.fillStyle = '#021a08'; g.fillRect(0, 0, w, hh);
    g.strokeStyle = '#39ff6a'; g.lineWidth = 2;
    g.beginPath(); for (let x = 0; x < w; x += 2) g.lineTo(x, hh / 2 + Math.sin(x * 0.2) * 12 * Math.sin(x * 0.03)); g.stroke();
    g.strokeStyle = 'rgba(57,255,106,.35)'; g.lineWidth = 1;
    for (let r = 6; r < 40; r += 8) { g.beginPath(); g.arc(w * 0.8, hh / 2, r, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(57,255,106,.5)'; for (let y = 4; y < hh; y += 6) g.fillRect(4, y, rand(8, 30), 2);
  }) }));
  for (let i = 0; i < 3; i++) {
    const x = -9 + i * 3;
    zn.box(2.5, 1.0, 1.0, x, 0.5, -9.8, metal);
    add(new THREE.BoxGeometry(2.5, 0.1, 1.1), dark, x, 1.05, -9.75, { rx: 0.25 });
    for (let b = 0; b < 6; b++) add(new THREE.BoxGeometry(0.12, 0.05, 0.12), [glow, mat('red', () => new THREE.MeshBasicMaterial({ color: 0xff3a3a }))][b % 2], x - 0.9 + b * 0.35, 1.12, -9.55);
    add(new THREE.BoxGeometry(2.3, 1.1, 0.12), dark, x, 1.95, -10.25);
    add(new THREE.PlaneGeometry(2.1, 0.95), scr, x, 1.95, -10.18);
    spot(x, 1.32, -9.6);
  }
  // specimen vats: steel base and crown, glowing fluid, a shape floating inside
  for (const [x, z] of [[10, 6], [10, -4], [-10, 6]]) {
    add(new THREE.CylinderGeometry(1.2, 1.3, 0.4, 20), metal, x, 0.2, z);
    add(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 20), goo, x, 1.7, z, { collide: [1.1, 1.1] });
    add(new THREE.CylinderGeometry(1.15, 1.15, 0.35, 20), metal, x, 3.15, z);
    for (const a of [0, 1, 2, 3]) add(new THREE.BoxGeometry(0.1, 2.6, 0.1), dark, x + Math.cos(a * 1.57 + 0.78) * 1.02, 1.7, z + Math.sin(a * 1.57 + 0.78) * 1.02);
    add(new THREE.CapsuleGeometry(0.28, 0.9, 4, 10), specimen, x, 1.7, z, { rz: 0.2 });
    add(new THREE.SphereGeometry(0.22, 10, 8), specimen, x + 0.15, 2.45, z);
    const pool = lightPool(0x39ff6a, 2.6, 0.35); pool.position.set(x, 0.015, z); zn.scene.add(pool);
    // cables snaking to the consoles
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.05, z), new THREE.Vector3(x * 0.7, 0.05, z - 3 + rand(-1, 1)), new THREE.Vector3(x * 0.4, 0.05, -7), new THREE.Vector3(-6 + rand(0, 6), 0.05, -9.2)]);
    add(new THREE.TubeGeometry(curve, 24, 0.06, 5), pipeD, 0, 0, 0);
  }
  // the villain's broadcast screen above the entrance
  const skull = tex(256, 128, (g, w, hh) => { g.fillStyle = '#021'; g.fillRect(0, 0, w, hh); g.strokeStyle = 'rgba(57,255,106,.2)'; for (let y = 0; y < hh; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.fillStyle = '#39ff6a'; g.font = '900 86px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', w / 2, hh / 2 + 4); });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: skull }));
  sm.position.set(0, 2.2, 11.72); sm.rotation.y = Math.PI; zn.scene.add(sm);
  // lab tables with flasks
  for (let i = 0; i < 3; i++) table(-2 + i * 4, 4, 0x2a322c);
  for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.1, 8, 6), goo, -2 + Math.floor(i / 2) * 4 + (i % 2 ? 0.25 : -0.25), 0.95, 4 + rand(-0.2, 0.2));
  // cover: riveted columns
  for (const [x, z] of [[-14, 11], [14, 11], [-14, -11], [14, -11], [-6, -1], [6, 8]]) {
    zn.box(0.8, 3.4, 0.8, x, 1.7, z, metal);
    add(new THREE.BoxGeometry(0.9, 0.3, 0.9), zn.vmats.hazard, x, 0.15, z);
    add(new THREE.BoxGeometry(0.9, 0.1, 0.9), glow, x, 2.9, z);
  }
  // office + back room
  zn.box(2.6, 0.8, 1.2, 20, 0.4, 0, metal);
  add(new THREE.BoxGeometry(0.5, 0.35, 0.05), scr, 20, 1.0, -0.3);
  spot(20.8, 0.82, 0.2);
  for (const [x, z] of [[-4.6, -21], [4.6, -21]]) zn.box(1.2, 1.8, 0.8, x, 0.9, z, metal);
}
