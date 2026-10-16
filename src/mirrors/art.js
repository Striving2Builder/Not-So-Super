// The hall of mirrors' look (src/mirrors/, docs/design/act2.md "The hotel's new floor and the boss"),
// after the user's mood picture: purple neon tubes, old white tiles under graffiti, wet floor tiles
// with the neon smeared across them. Pure canvas, built once with the building.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { canvasTex } from '../hotel/art.js';
import { rand, pick } from '../util.js';

export const VIOLET = [0xb040ff, 0xe050ff, 0x8a5aff]; // the tubes: purple, magenta, violet
export const VIOLET_CSS = '#c050ff';

const solid = (m) => { m.userData.solid = true; return m; };
const speckle = (g, w, h, n, col, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };
const TAGS = ['SUPERGURL', 'S', 'FAKE', 'WHICH 1?', 'LOOK CLOSER', 'MIRROR MIRROR', 'SHE\'S NOT YOU', 'CULT', 'XOXO', 'NOT SO SUPER', '13+1'];
const INKS = ['#e050ff', '#ff4ab0', '#ffffff', '#8a5aff', '#c8102e', '#39d0ff'];

/** Spray tags, drips and crossed-out S shields over whatever is on `g`. */
function graffiti(g, w, h, n, y0 = 0, y1 = h) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand(0, w * 0.8), y = rand(y0 + 20, y1 - 10), col = pick(INKS);
    g.save(); g.translate(x, y); g.rotate(rand(-0.25, 0.15));
    g.globalAlpha = rand(0.45, 0.85);
    if (Math.random() < 0.25) { // the S, crossed out
      g.strokeStyle = col; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, -18); g.lineTo(18, -18); g.lineTo(26, -6); g.lineTo(13, 18); g.lineTo(0, -6); g.closePath(); g.stroke();
      g.font = '900 20px Impact, sans-serif'; g.fillStyle = col; g.fillText('S', 7, 6);
      g.lineWidth = 3; g.beginPath(); g.moveTo(-4, 20); g.lineTo(30, -22); g.stroke();
    } else {
      g.font = `${pick(['italic 900', '900', '700'])} ${Math.round(rand(14, 30))}px Impact, sans-serif`;
      g.strokeStyle = '#0a0410'; g.lineWidth = 4; const t = pick(TAGS);
      g.strokeText(t, 0, 0); g.fillStyle = col; g.fillText(t, 0, 0);
      g.fillStyle = col; for (let d = 0; d < 3; d++) g.fillRect(rand(0, 60), 2, 2, rand(6, 22)); // drips
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

/** Old square tiles, grimed, under graffiti (the halls and the mirror rooms behind the glass). */
function tileWall(base, grout, tags) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = grout; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    speckle(g, w, h, 900, '20,0,30', 0.3);
    g.fillStyle = 'rgba(10,0,20,.35)'; for (let i = 0; i < 5; i++) g.fillRect(rand(0, w), rand(0, h * 0.5), rand(2, 4), rand(30, 90)); // damp runs
    graffiti(g, w, h, tags, 0, h * 0.85);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, h * 0.88, w, h * 0.12); // a dark kick plate
  });
}

/** Wet floor tiles: dark, a purple sheen, and the tubes' light smeared down them in streaks. */
function wetTiles(base, sheen) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) for (let y = 0; y < h; y += 64) { g.fillStyle = `rgba(255,255,255,${rand(0, 0.05)})`; g.fillRect(x + 2, y + 2, 60, 60); }
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3;
    for (let i = 0; i <= w; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    for (let k = 0; k < 4; k++) { // the reflections: long soft streaks of the neon
      const x = rand(0, w), gr = g.createLinearGradient(x - 10, 0, x + 10, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, sheen); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - 10, 0, 20, h);
    }
    g.fillStyle = 'rgba(200,170,255,.10)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 30), rand(5, 12), rand(0, 3), 0, 7); g.fill(); } // puddles
    speckle(g, w, h, 500, '0,0,0', 0.3);
  });
}

/** The rooms off the hall: the shrine, the dressing rooms, the "parlours". */
const ROOM = {
  dressing: () => tileWall('#3a2a44', '#1a1020', 3),
  parlour: () => tileWall('#2a1430', '#14081a', 4),
  shrine: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#3a0812'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(200,160,64,.35)'; for (let x = 8; x < w; x += 32) g.fillRect(x, 0, 3, h); speckle(g, w, h, 200, '0,0,0', 0.3); }),
};

const doorTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#1a1020'; g.fillRect(0, 0, w, h);
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#6a5a8a'); gr.addColorStop(0.5, '#c8b8e8'); gr.addColorStop(1, '#4a3a6a');
  g.fillStyle = gr; g.fillRect(10, 10, w - 20, h - 20); // a mirrored door
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 60); g.lineTo(60, 20); g.moveTo(30, 90); g.lineTo(90, 30); g.stroke();
  graffiti(g, w, h, 2, h * 0.3, h * 0.8);
  g.fillStyle = '#c8a040'; g.fillRect(w * 0.8, h * 0.5, 8, 26);
}, false);

/** The sealed door at the end of the hall: a mirror with her S cracked across it. */
export function sealCanvas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 320); gr.addColorStop(0, '#2a1440'); gr.addColorStop(0.5, '#8a6ab8'); gr.addColorStop(1, '#1a0a2a');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#e050ff'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 308);
  g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(68, 110); g.lineTo(188, 110); g.lineTo(218, 150); g.lineTo(128, 250); g.lineTo(38, 150); g.closePath(); g.fill();
  g.fillStyle = '#ffd21a'; g.font = '900 96px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('S', 128, 205);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; // the crack
  g.beginPath(); g.moveTo(40, 40); g.lineTo(110, 120); g.lineTo(96, 170); g.lineTo(150, 230); g.lineTo(220, 300); g.moveTo(110, 120); g.lineTo(170, 90); g.stroke();
  g.fillStyle = '#ffffff'; g.font = '900 22px Impact, sans-serif'; g.fillText('SHE\'S WAITING', 128, 290);
  return c;
}

/** The hall of mirrors' materials (built once with the building, shared by every visit). */
export function makeMirrorMaterials() {
  const side = THREE.DoubleSide;
  const rooms = {};
  for (const [k, f] of Object.entries(ROOM)) rooms[k] = toon(0xffffff, { map: f(), side });
  const neon = VIOLET.map((c) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.userData.solid = false; return m; });
  return {
    hallWall: toon(0xffffff, { map: tileWall('#c8c0d0', '#6a5a7a', 7), side }),
    ballWall: toon(0xffffff, { map: tileWall('#2a1a3a', '#120818', 5), side }), // (the lobby, the antechamber)
    hallFloor: toon(0xffffff, { map: wetTiles('#1a1024', 'rgba(200,90,255,.32)'), side }, { halftone: 0.2 }),
    roomFloor: toon(0xffffff, { map: wetTiles('#160c1c', 'rgba(255,80,200,.22)'), side }, { halftone: 0.3 }),
    lobbyFloor: toon(0xffffff, { map: wetTiles('#100818', 'rgba(140,90,255,.3)'), side }, { halftone: 0.2 }),
    rooms,
    mass: toon(0x1a1018, { side }),
    cap: toon(0x0a060c, { side }, { halftone: 0 }),
    wood: toon(0x3a1a2a),
    brass: toon(0xc8a040),
    linen: toon(0xf0e6ee),
    steel: toon(0x8a86a0),
    black: toon(0x120a16),
    frame: toon(0x2a2030),
    red: toon(0xa8101e),
    door: toon(0xffffff, { map: doorTex() }),
    neon,
    glass: solid(new THREE.MeshBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0.12, depthWrite: false, side })), // (it blocks: she can't walk into her reflection)
    smear: new THREE.MeshBasicMaterial({ color: 0xc050ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
}
