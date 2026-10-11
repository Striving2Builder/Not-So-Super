// Neon venue signs for the 3D city: the 2D view's big named signs (COMEDY, ROXY, JAZZ...) as
// glowing boards on facades and rooftops, plus vice-district blade signs. All words live in one
// canvas atlas (comic lettering, R = tube core, G = glow/letters, B = dark board) that the city
// shader tints per sign, so every sign in a chunk rides in the chunk's single draw call.
import * as THREE from 'three';
import { KIND } from './buildings3d.js';

/** Words by district (the 2D view's venue + mall names come from the buildings themselves). */
export const SIGN_WORDS = {
  nightclub: ['CLUB', 'DISCO', 'LOUNGE', 'DANCE', 'VIP', 'BAR'],
  redlight: ['GIRLS', 'XXX', 'HOTEL', 'PEEP', 'LIVE', 'BAR'],
  naughty: ['CABARET', 'BURLESQUE', 'VIP', 'CLUB', 'GIRLS'],
  casino: ['CASINO', 'SLOTS', 'POKER', 'JACKPOT', 'LUCKY 7'],
  entertainment: ['THEATER', 'CINEMA', 'ARCADE', 'BOWL', 'COMEDY', 'JAZZ', 'OPERA', 'KARAOKE', 'BILLIARDS', 'ROXY', 'PALACE', 'DINER'],
  retail: ['MALL', 'MEGAMART', 'OUTLET', 'PLAZA', 'SUPERSTORE', 'MARKET', 'SALE', 'PIZZA', 'SHOES', 'DINER'],
  downtown: ['HOTEL', 'GAZETTE', 'NEWS', 'TRUST', 'GLOBE'],
  financial: ['BANK', 'TRUST', 'EXCHANGE'],
  lair: ['DANGER', 'KEEP OUT'],
  docks: ['PIER 9', 'CARGO'],
  hotel: ['SLUTTY LITTLE', 'RED MINI SKIRT'], // the act's hotel tower (landmarks3d.js spike), not a district
};
/** Upright (stacked-letter) blade signs. */
const VERTICAL = ['HOTEL', 'BAR', 'CLUB', 'ROXY', 'JAZZ', 'CASINO', 'GIRLS', 'DINER', 'BIJOU', 'LIVE', 'XXX', 'VIP', 'LOUNGE', 'PALACE', 'NEWS', 'GLOBE'];

const W = 1024, SH = 64, ROWS_H = 16, COLS = 4, SW = W / COLS, VW = 64, VH = 512;
const FONT = '"Bangers", Impact, "Arial Black", sans-serif';

/** The sign atlas: horizontal words in 4 x 16 slots on top, upright words in 16 slots below. */
export class SignAtlas {
  constructor() {
    const words = [...new Set(Object.values(SIGN_WORDS).flat())];
    this.words = words.slice(0, ROWS_H * COLS);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = ROWS_H * SH + VH;
    this.slots = new Map(); this.vslots = new Map();
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace; this.tex.anisotropy = 4;
    this.draw();
    // the comic face may still be loading: redraw once it's in
    try { document.fonts?.load(`48px ${FONT}`).then(() => { this.draw(); this.tex.needsUpdate = true; }); } catch (e) { /* no FontFace API */ }
  }

  draw() {
    const g = this.canvas.getContext('2d'), H = this.canvas.height;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const glowText = (text, x, y) => {
      g.shadowColor = 'rgb(0,160,0)'; g.shadowBlur = 6; g.fillStyle = 'rgb(0,200,0)'; g.fillText(text, x, y);
      g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = 'rgb(255,0,0)'; g.strokeText(text, x, y);
    };
    this.words.forEach((word, i) => {
      const col = i % COLS, row = (i / COLS) | 0, x0 = col * SW, y0 = row * SH;
      g.font = `44px ${FONT}`;
      const tw = Math.min(SW - 36, g.measureText(word).width), bw = tw + 30;
      const bx = x0 + (SW - bw) / 2;
      g.fillStyle = 'rgb(0,0,255)'; g.fillRect(bx, y0 + 4, bw, SH - 8); // board
      g.strokeStyle = 'rgb(160,0,0)'; g.lineWidth = 2; g.strokeRect(bx + 4, y0 + 8, bw - 8, SH - 16); // border tube
      g.save(); g.translate(x0 + SW / 2, y0 + SH / 2 + 2); g.scale(tw / Math.max(1, g.measureText(word).width), 1);
      glowText(word, 0, 0); g.restore();
      this.slots.set(word, { u0: bx / W, u1: (bx + bw) / W, v0: 1 - (y0 + SH - 4) / H, v1: 1 - (y0 + 4) / H, aspect: bw / (SH - 8) });
    });
    VERTICAL.forEach((word, i) => {
      const x0 = i * VW, y0 = ROWS_H * SH, n = word.length, step = (VH - 24) / Math.max(n, 3);
      g.fillStyle = 'rgb(0,0,255)'; g.fillRect(x0 + 4, y0 + 4, VW - 8, n * step + 16);
      g.strokeStyle = 'rgb(160,0,0)'; g.lineWidth = 2; g.strokeRect(x0 + 8, y0 + 8, VW - 16, n * step + 8);
      g.font = `${Math.min(46, step * 0.95)}px ${FONT}`;
      for (let k = 0; k < n; k++) glowText(word[k], x0 + VW / 2, y0 + 12 + step * (k + 0.5));
      const hgt = n * step + 16;
      this.vslots.set(word, { u0: (x0 + 4) / W, u1: (x0 + VW - 4) / W, v0: 1 - (y0 + 4 + hgt) / H, v1: 1 - (y0 + 4) / H, aspect: (VW - 8) / hgt });
    });
    g.globalCompositeOperation = 'source-over';
  }

  slot(word) { return this.slots.get(word) || this.slots.get(this.words[0]); }
  vslot(word) { return this.vslots.get(word) || null; }
}

const _c = new THREE.Color(), N = { n: [0, 0, -1], s: [0, 0, 1], e: [1, 0, 0], w: [-1, 0, 0] };

/**
 * A sign quad on face `f` ('n'|'s'|'e'|'w') of the box [x0..x1]x[z0..z1] (metres), centred at
 * `along` (0..1) and height y, `h` tall (shrunk to fit the face), `out` metres proud of the wall.
 * Inked round its edge; `back` adds a dark back so rooftop boards read from behind.
 */
export function signQuad(B, S, word, colour, x0, z0, x1, z1, f, y, h, { along = 0.5, out = 0.3, back = false, vertical = false } = {}) {
  const sl = vertical ? S.vslot(word) : S.slot(word);
  if (!sl) return 0;
  const faceLen = f === 'n' || f === 's' ? x1 - x0 : z1 - z0;
  let w = h * sl.aspect;
  if (w > faceLen * 0.92) { w = faceLen * 0.92; h = w / sl.aspect; }
  const n = N[f], y0 = y, y1 = y + h;
  // a, b = left/right ends as seen from outside
  let a, b;
  if (f === 's') { const c = x0 + (x1 - x0) * along, z = z1 + out; a = [c - w / 2, z]; b = [c + w / 2, z]; }
  else if (f === 'n') { const c = x0 + (x1 - x0) * along, z = z0 - out; a = [c + w / 2, z]; b = [c - w / 2, z]; }
  else if (f === 'e') { const c = z0 + (z1 - z0) * along, x = x1 + out; a = [x, c + w / 2]; b = [x, c - w / 2]; }
  else { const c = z0 + (z1 - z0) * along, x = x0 - out; a = [x, c - w / 2]; b = [x, c + w / 2]; }
  _c.set(colour);
  const P = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
  B.quad(P[0], P[1], P[2], P[3], n, [[sl.u0, sl.v0], [sl.u1, sl.v0], [sl.u1, sl.v1], [sl.u0, sl.v1]], _c, _c, 0, KIND.sign);
  if (back) {
    const k = 0.25, bn = [-n[0], -n[1], -n[2]], d = [-n[0] * k, 0, -n[2] * k];
    const Q = P.map((p) => [p[0] + d[0], p[1], p[2] + d[2]]);
    B.quad(Q[1], Q[0], Q[3], Q[2], bn, [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], BACK, BACK, 5);
  }
  for (let i = 0; i < 4; i++) B.ink(P[i], P[(i + 1) % 4], 0.8);
  return h;
}
// a mid-grey sheet-metal back, lit like any wall (a near-black tar back read as a big black box
// standing on the roof at night, right behind her in the rooftop-skim shots)
const BACK = new THREE.Color('#9a96a0');

/** An upright blade sign sticking out from a corner of face `f`, readable from both sides. */
export function bladeSign(B, S, word, colour, x0, z0, x1, z1, f, y, h) {
  const sl = S.vslot(word);
  if (!sl) return;
  const w = h * sl.aspect, o = 0.4; // depth out from the wall
  _c.set(colour);
  const uv = () => [[sl.u0, sl.v0], [sl.u1, sl.v0], [sl.u1, sl.v1], [sl.u0, sl.v1]];
  // along an axis perpendicular to the wall, at the face's left corner
  let p0, p1, nA;
  if (f === 's') { p0 = [x0 + 2, z1 + o]; p1 = [x0 + 2, z1 + o + w]; nA = [1, 0, 0]; }
  else if (f === 'n') { p0 = [x1 - 2, z0 - o]; p1 = [x1 - 2, z0 - o - w]; nA = [-1, 0, 0]; }
  else if (f === 'e') { p0 = [x1 + o, z1 - 2]; p1 = [x1 + o + w, z1 - 2]; nA = [0, 0, -1]; }
  else { p0 = [x0 - o, z0 + 2]; p1 = [x0 - o - w, z0 + 2]; nA = [0, 0, 1]; }
  const y1 = y + h;
  const A = [[p0[0], y, p0[1]], [p1[0], y, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]];
  // both windings start at their own bottom-left corner, so one uv set reads right from either side
  B.quad(A[0], A[1], A[2], A[3], nA, uv(false), _c, _c, 0, KIND.sign);
  B.quad(A[1], A[0], A[3], A[2], [-nA[0], 0, -nA[2]], uv(false), _c, _c, 0, KIND.sign);
  for (let i = 0; i < 4; i++) B.ink(A[i], A[(i + 1) % 4], 0.7);
}
