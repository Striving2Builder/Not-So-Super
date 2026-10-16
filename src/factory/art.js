// The Super Squirt factory's look (src/factory/, docs/design/act2.md "The factory production lines"):
// canvas textures for the production floor (riveted steel walls over a hazard-striped kick plate,
// painted concrete with the yellow walk lines), each line's bays, steel doors, the belts (one texture
// per line, so a line that's shut down stops moving) and the cult's propaganda signs. Pure canvas.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { canvasTex } from '../hotel/art.js';
import { rand } from '../util.js';

export const HAZARD = [0xffb020, 0xff3fb8, 0xbfe8ff]; // the hall tubes: amber, Super Squirt pink, cold white
export const PINK = 0xff3fb8, PINK_CSS = '#ff3fb8';

const speckle = (g, w, h, n, col, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };
const stripes = (g, x, y, w, h, a = '#f2c12e', b = '#141018', step = 22) => {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = a; g.fillRect(x, y, w, h); g.fillStyle = b;
  for (let t = -h; t < w + h; t += step * 2) { g.beginPath(); g.moveTo(x + t, y + h); g.lineTo(x + t + step, y + h); g.lineTo(x + t + step + h, y); g.lineTo(x + t + h, y); g.fill(); }
  g.restore();
};

/** Riveted steel panels over a hazard-striped kick plate (the halls). */
function steelWall(base, seam) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = seam; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h * 0.78); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 6; x < w; x += 64) for (let y = 10; y < h * 0.76; y += 28) { g.fillRect(x, y, 3, 3); g.fillRect(x + 52, y, 3, 3); }
    g.fillStyle = 'rgba(110,60,20,.25)'; for (let i = 0; i < 6; i++) g.fillRect(rand(0, w), rand(h * 0.2, h * 0.7), rand(2, 5), rand(18, 50)); // rust runs
    stripes(g, 0, h * 0.8, w, h * 0.2);
    g.fillStyle = '#0e0810'; g.fillRect(0, h * 0.78, w, 6);
    speckle(g, w, h, 280, '0,0,0', 0.25);
  });
}

/** Painted concrete with a yellow walk line down the edge. */
function concrete(a, line) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1400, '0,0,0', 0.18); speckle(g, w, h, 400, '255,255,255', 0.06);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    if (line) { g.fillStyle = line; g.fillRect(0, h * 0.46, w, 8); }
    g.fillStyle = 'rgba(255,63,184,.12)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(8, 22), rand(5, 12), rand(0, 3), 0, 7); g.fill(); } // spills
  });
}

/** A line's bays: tiles, rubber mats, chipboard, by line. */
const BAY = {
  mixing: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c8d4d0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(40,60,60,.4)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } g.fillStyle = 'rgba(255,63,184,.3)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(rand(0, w), rand(h * 0.6, h), rand(6, 14), 0, 7); g.fill(); } }),
  press: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#4a4e56'; g.fillRect(0, 0, w, h); stripes(g, 0, h * 0.82, w, h * 0.18, '#f2c12e', '#141018', 12); speckle(g, w, h, 200, '255,255,255', 0.06); }),
  bottling: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#e8c0d8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,40,100,.35)'; g.lineWidth = 3; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }),
  packing: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#a07a50'; g.fillRect(0, 0, w, h); speckle(g, w, h, 500, '60,30,10', 0.35); g.strokeStyle = 'rgba(40,20,10,.4)'; g.lineWidth = 2; for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }),
  office: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2a1418'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(200,160,64,.3)'; g.fillRect(0, h * 0.62, w, 5); speckle(g, w, h, 200, '0,0,0', 0.3); }),
};

const doorTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#5a646c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2a3036'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = '#9fd8ff'; g.fillRect(w * 0.3, h * 0.14, w * 0.4, h * 0.16); // the wired glass
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w * 0.3 + i * 8, h * 0.14); g.lineTo(w * 0.3 + i * 8, h * 0.3); g.stroke(); }
  stripes(g, 8, h * 0.84, w - 16, h * 0.1, '#f2c12e', '#141018', 10);
  g.fillStyle = '#c8c8c8'; g.fillRect(w * 0.78, h * 0.5, 10, 30); // the push bar
}, false);

/** A belt: dark rubber with cleats; one per line (its own texture, so a stopped line stops). */
const beltTex = () => canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#1c1a20'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a3640'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 5, h);
  speckle(g, w, h, 60, '255,255,255', 0.08);
});

/** The cult's propaganda on the hall walls. */
export function signCanvas(k = 0) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 280;
  const g = c.getContext('2d');
  g.fillStyle = ['#2a0614', '#140a24', '#0a0a0a'][k % 3]; g.fillRect(0, 0, 200, 280);
  g.strokeStyle = '#c8a040'; g.lineWidth = 6; g.strokeRect(8, 8, 184, 264);
  // the bottle: pink, with a lightning-bolt label
  g.fillStyle = PINK_CSS; g.fillRect(70, 76, 60, 114); g.beginPath(); g.ellipse(100, 78, 30, 12, 0, 0, 7); g.fill(); g.fillRect(88, 46, 24, 28);
  g.fillStyle = '#ffe24a'; g.beginPath(); g.moveTo(104, 96); g.lineTo(86, 134); g.lineTo(100, 134); g.lineTo(94, 164); g.lineTo(116, 122); g.lineTo(102, 122); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = '900 30px Impact, sans-serif';
  g.fillText('SUPER SQUIRT', 100, 230);
  g.font = '700 16px Impact, sans-serif'; g.fillStyle = '#ffe24a';
  g.fillText(['FEEL SUPER.', 'SHE DRINKS IT.', 'QUOTA IS FAITH.'][k % 3], 100, 256);
  return c;
}

/** The factory's materials (built once with the building, shared by every visit). */
export function makeFactoryMaterials() {
  const side = THREE.DoubleSide;
  const rooms = {};
  for (const [k, f] of Object.entries(BAY)) rooms[k] = toon(0xffffff, { map: f(), side });
  const belts = [0, 1, 2, 3].map(() => toon(0xffffff, { map: beltTex() }));
  return {
    hallWall: toon(0xffffff, { map: steelWall('#3a3e46', '#22252c'), side }),
    ballWall: toon(0xffffff, { map: steelWall('#2a1418', '#160a0e'), side }), // (the dock's walls)
    hallFloor: toon(0xffffff, { map: concrete('#5a5a5e', '#c8a020'), side }, { halftone: 0.35 }),
    roomFloor: toon(0xffffff, { map: concrete('#46464c'), side }, { halftone: 0.35 }),
    lobbyFloor: toon(0xffffff, { map: concrete('#4a3a30', '#c8a020'), side }, { halftone: 0.35 }),
    rooms,
    mass: toon(0x1a1018, { side }),
    cap: toon(0x0a060c, { side }, { halftone: 0 }),
    wood: toon(0x7a5a34),        // pallets, crates
    brass: toon(0xf2c12e),       // hazard yellow (rails, guards)
    linen: toon(0xf0e6ee),       // (labels)
    steel: toon(0x8a96a0),
    black: toon(0x141018),
    vat: toon(0xb8c4cc),
    pink: toon(PINK),
    door: toon(0xffffff, { map: doorTex() }),
    belts,
    neon: HAZARD.map((c) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.userData.solid = false; return m; }), // (no collision)
    syrup: new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false, transparent: true, opacity: 0.85 }),
  };
}
