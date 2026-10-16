// RLD Walks' look (src/rld/): canvas textures for the red-light street (wet cobbles, soot brick, red
// doors, the big curtained windows, neon signs) and the rooms behind the doors. Pure canvas: no files.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { neonText, heartPath, neonPath } from '../nlkit.js';

export const RED = [0xff2244, 0xff6688, 0xffaa33];           // the district's neon (data.js DISTRICTS.redlight)
export const RED_CSS = ['#ff2244', '#ff6688', '#ffaa33'];
export const SIGNS = ['LOUNGE', 'OPEN 24H', 'HOTEL', 'BAR', 'ROOMS', 'KARAOKE', 'MASSAGE', '♥'];
export const WINDOWS = 4; // window looks in the atlas: drawn red, a lamp behind sheers, dark, drawn pink

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const speckle = (g, w, h, n, col, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

/** Wet cobbles catching the neon. */
const cobbles = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#140a0e'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32) {
    const l = 26 + Math.random() * 16;
    g.fillStyle = `rgb(${l + 14},${l - 6},${l})`;
    g.beginPath(); g.ellipse(x + 16, y + 16, 13, 12, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,60,90,.10)'; g.beginPath(); g.ellipse(x + 12, y + 11, 6, 3, -0.4, 0, 7); g.fill();
  }
  for (let i = 0; i < 6; i++) { // puddles: neon smeared in them
    const x = Math.random() * w, y = Math.random() * h, r = 18 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(255,40,80,.35)'); gr.addColorStop(0.6, 'rgba(120,10,40,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * 0.6, Math.random() * 3, 0, 7); g.fill();
  }
});

/** Soot-dark brick with a plaster band: the canal houses' street faces. */
const brick = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2a1014'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) {
    const l = 50 + Math.random() * 22;
    g.fillStyle = `rgb(${l + 24},${l * 0.42},${l * 0.4})`; g.fillRect(x + 1, y + 1, 30, 14);
  }
  g.fillStyle = '#1a0a0e'; g.fillRect(0, h * 0.86, w, h * 0.14);   // the dark plinth
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h * 0.84, w, 4);
  speckle(g, w, h, 400, '0,0,0', 0.35);
});

/** The rooms: rose flock wallpaper. */
const flock = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#6a1a2c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7e2438';
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) {
    g.beginPath(); g.moveTo(x + 16, y + 4); g.bezierCurveTo(x + 28, y + 12, x + 28, y + 22, x + 16, y + 28); g.bezierCurveTo(x + 4, y + 22, x + 4, y + 12, x + 16, y + 4); g.fill();
  }
  speckle(g, w, h, 120, '0,0,0', 0.2);
});

/** The lead rooms: dressing rooms, gold-striped paper. */
const stripes = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#2a1424'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(200,160,64,.35)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 3, h);
  speckle(g, w, h, 100, '0,0,0', 0.25);
});

const carpet = (a, b) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.strokeStyle = b; g.lineWidth = 3;
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, y + 16, 9, 0, 7); g.stroke(); }
  speckle(g, w, h, 300, '0,0,0', 0.3);
});

/** The red doors: glossy red, a brass knocker, a peephole. */
const doorTex = () => canvasTex(128, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#9a0c22'); gr.addColorStop(0.5, '#d0183a'); gr.addColorStop(1, '#8a0a1e');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#5a0614'; g.lineWidth = 6; g.strokeRect(14, 16, w - 28, h * 0.38); g.strokeRect(14, h * 0.48, w - 28, h * 0.44);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(20, 22, 6, h * 0.34);
  g.fillStyle = '#e0b850'; g.beginPath(); g.arc(w * 0.8, h * 0.52, 7, 0, 7); g.fill();
  g.beginPath(); g.arc(w / 2, h * 0.3, 10, 0, 7); g.lineWidth = 4; g.strokeStyle = '#e0b850'; g.stroke(); // knocker
  g.fillStyle = '#1a0408'; g.beginPath(); g.arc(w / 2, h * 0.12, 5, 0, 7); g.fill();             // peephole
}, false);

/** The lead doors: grey sheet lead, rivets, a brass plate. X-ray stops at them. */
const leadTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#5c6066'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 500, '20,24,28', 0.35);
  g.fillStyle = '#3a3e44'; for (let y = 10; y < h; y += 26) for (const x of [10, w - 10]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  g.fillStyle = '#c8a040'; g.fillRect(w * 0.18, h * 0.2, w * 0.64, 34);
  g.fillStyle = '#2a1408'; g.font = '900 17px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('PRIVATE', w / 2, h * 0.2 + 17);
  g.fillStyle = '#ff2244'; g.fillRect(w * 0.7, h * 0.52, 14, 14);                          // the lock's light
}, false);

/** The windows (an atlas, one look per column): drawn red curtains, a lamp behind sheers, dark, drawn pink. */
function windowTex() {
  const CW = 128, CH = 192;
  return canvasTex(CW * WINDOWS, CH, (g) => {
    for (let v = 0; v < WINDOWS; v++) {
      const x0 = v * CW;
      const glow = ['#ff3a5a', '#ffb070', '#2a0a14', '#ff7ab8'][v];
      const gr = g.createRadialGradient(x0 + 64, 90, 6, x0 + 64, 90, 110);
      gr.addColorStop(0, v === 2 ? '#3a1420' : '#fff0e8'); gr.addColorStop(0.35, glow); gr.addColorStop(1, '#14040a');
      g.fillStyle = gr; g.fillRect(x0, 0, CW, CH);
      if (v === 1) { g.fillStyle = '#3a1008'; g.fillRect(x0 + 58, 104, 12, 50); g.fillStyle = '#ffe0a0'; g.beginPath(); g.moveTo(x0 + 46, 104); g.lineTo(x0 + 82, 104); g.lineTo(x0 + 74, 82); g.lineTo(x0 + 54, 82); g.fill(); }
      // curtains: fully drawn on 0 and 3, tied back on 1, blinds on 2
      if (v === 2) { g.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 8; y < CH; y += 10) g.fillRect(x0, y, CW, 4); }
      else {
        const cw = v === 1 ? 30 : 64, col = v === 3 ? ['#c04080', '#7a1850'] : ['#c0102a', '#5a0010'];
        for (const sd of [0, 1]) {
          const cx = sd ? x0 + CW - cw : x0, cg = g.createLinearGradient(cx, 0, cx + cw, 0);
          for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, col[i % 2]);
          g.globalAlpha = v === 1 ? 1 : 0.88; g.fillStyle = cg; g.fillRect(cx, 8, cw, CH - 8); g.globalAlpha = 1;
        }
      }
      g.fillStyle = '#e0a040'; g.fillRect(x0, 6, CW, 4);                       // the curtain rail
      g.strokeStyle = '#0c0204'; g.lineWidth = 10; g.strokeRect(x0 + 5, 5, CW - 10, CH - 10); // the frame
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 18, 30); g.lineTo(x0 + 40, 14); g.stroke();
    }
  }, false);
}

/** The neon signs (an atlas, 2 columns × 4 rows of 256×96). */
function signTex() {
  return canvasTex(512, 384, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 384);
    SIGNS.forEach((word, i) => {
      const x = (i % 2) * 256 + 128, y = Math.floor(i / 2) * 96 + 48, col = RED_CSS[i % 3];
      if (word === '♥') { neonPath(g, col, 7, heartPath(g, x, y - 4, 1.5)); return; }
      neonText(g, word, x, y, word.length > 6 ? 44 : 56, col, { maxW: 230 });
    });
  }, false);
}

/** All of the walk's materials (built once with the building, shared by every visit). */
export function makeMaterials() {
  const side = THREE.DoubleSide;
  const neon = RED.map((c) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.userData.solid = false; return m; });
  const glow = (map, extra = {}) => { const m = new THREE.MeshBasicMaterial({ map, toneMapped: false, ...extra }); m.userData.solid = false; return m; };
  return {
    street: toon(0xffffff, { map: cobbles(), side }, { halftone: 0.3 }),
    streetWall: toon(0xffffff, { map: brick(), side }),
    roomWall: toon(0xffffff, { map: flock(), side }),
    leadWall: toon(0xffffff, { map: stripes(), side }),
    roomFloor: toon(0xffffff, { map: carpet('#3a0c18', '#5a1626'), side }, { halftone: 0.35 }),
    leadFloor: toon(0xffffff, { map: carpet('#1c0c18', '#3a1a30'), side }, { halftone: 0.35 }),
    mass: toon(0x1a0a10, { side }),
    cap: toon(0x0a0406, { side }, { halftone: 0 }),
    wood: toon(0x4a1a12),
    brass: toon(0xc8a040),
    linen: toon(0xf4c8d8),
    velvet: toon(0x8a1030),
    black: toon(0x120810),
    door: toon(0xffffff, { map: doorTex() }),
    lead: toon(0xffffff, { map: leadTex() }),
    neon,
    window: glow(windowTex()),
    sign: glow(signTex(), { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

// ---------------------------------------------------------------- small canvases for the zone
/** A soft round puff (the house perfume). */
export function puffTex() {
  return canvasTex(64, 64, (g) => {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }, false);
}
