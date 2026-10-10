// The hotel's look (src/hotel/): canvas textures for the 13th floor (red-light halls in neon green,
// purple and red; each wing's rooms; the ballroom's dance floor), the posters of "her" on the hall
// walls (Supergirl or the Impostor), and the user's green-screen costume flat-lays keyed for the
// Wardrobe wing. Pure canvas: no files beyond the frames and the costume pictures.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { CLIPS, clipsReady } from '../club3d/clips.js';
import { frameOf } from '../polaroids.js';
import { impostorize } from '../act/spot.js';
import { pick, rand, shuffle } from '../util.js';

export const NEON = [0x39ff6a, 0xc050ff, 0xff2a5a]; // green, purple, red
export const NEON_CSS = ['#39ff6a', '#c050ff', '#ff2a5a'];

export function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const speckle = (g, w, h, n, col, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); } };

/** Damask wallpaper over a dark wainscot (the halls), in a wing's colour. */
function damask(base, ink, rail) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = ink;
    for (let y = -32; y < h * 0.62; y += 64) for (let x = -32; x < w + 32; x += 64) {
      const ox = (y / 64) % 2 ? 32 : 0;
      g.save(); g.translate(x + ox, y + 32);
      g.beginPath(); g.moveTo(0, -22); g.bezierCurveTo(14, -10, 14, 10, 0, 22); g.bezierCurveTo(-14, 10, -14, -10, 0, -22); g.fill();
      g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fillStyle = base; g.fill(); g.fillStyle = ink;
      g.restore();
    }
    const top = h * 0.64;
    g.fillStyle = '#1a0c14'; g.fillRect(0, top, w, h - top);                 // wainscot
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2;
    for (let x = 16; x < w; x += 64) g.strokeRect(x, top + 12, 48, h - top - 24);
    g.fillStyle = rail; g.fillRect(0, top - 6, w, 7);                        // brass rail
    speckle(g, w, h, 300, '0,0,0', 0.25);
  });
}

/** A hotel corridor carpet: a repeating motif, worn. */
function carpet(a, b, c) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.strokeStyle = b; g.lineWidth = 6;
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
      g.beginPath(); g.moveTo(x + 32, y + 6); g.lineTo(x + 58, y + 32); g.lineTo(x + 32, y + 58); g.lineTo(x + 6, y + 32); g.closePath(); g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x + 32, y + 32, 6, 0, 7); g.fill();
    }
    speckle(g, w, h, 900, '0,0,0', 0.3);
  });
}

/** The ballroom floor: black and white squares, polished. */
function danceFloor() {
  return canvasTex(256, 256, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#0c0a10' : '#d8d2e0'; g.fillRect(x * 64, y * 64, 64, 64); }
    const r = g.createLinearGradient(0, 0, w, h); r.addColorStop(0, 'rgba(255,255,255,.12)'); r.addColorStop(0.5, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(255,255,255,.08)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

/** Per-wing room finishes. */
const ROOM_LOOK = {
  gallery: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2a2a30'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, '255,255,255', 0.05); }),
  wardrobe: () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8a0c0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,40,90,.35)'; g.lineWidth = 3; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }),
  lab: () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d8e4dc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,60,50,.35)'; g.lineWidth = 2; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.fillStyle = 'rgba(57,255,106,.25)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(rand(0, w), rand(h * 0.6, h), rand(6, 16), 0, 7); g.fill(); }
  }),
  switchboard: () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    speckle(g, w, h, 160, '30,15,5', 0.4);
  }),
  screening: () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#141018'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = (x + y) % 32 ? '#1c1622' : '#100c14'; g.beginPath(); g.moveTo(x, y + 16); g.lineTo(x + 8, y); g.lineTo(x + 16, y + 16); g.fill(); }
  }),
};

const doorTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#4a1424'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2a0a14'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h * 0.42); g.strokeRect(14, h * 0.5, w - 28, h * 0.44);
  g.fillStyle = '#d8b050'; g.beginPath(); g.arc(w * 0.82, h * 0.52, 7, 0, 7); g.fill();
  g.fillStyle = '#d8b050'; g.fillRect(w * 0.42, h * 0.08, w * 0.16, 12);                      // the peephole plate
}, false);

const ballDoorTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#2a0a14'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c8a040'; g.fillRect(w / 2 - 3, 0, 6, h);
  for (const x of [w * 0.25, w * 0.75]) { g.strokeStyle = '#c8a040'; g.lineWidth = 5; g.strokeRect(x - 44, 30, 88, 196); }
  g.fillStyle = '#39ff6a'; g.font = '900 34px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('?', w / 2, 130);
}, false);

/** All the hotel's materials (built once with the building, shared by every visit). */
export function makeMaterials() {
  const side = THREE.DoubleSide;
  const wallTex = damask('#4a1430', '#5e1c3e', '#c8a040');
  const rooms = {};
  for (const [k, f] of Object.entries(ROOM_LOOK)) rooms[k] = toon(0xffffff, { map: f(), side });
  return {
    hallWall: toon(0xffffff, { map: wallTex, side }),
    hallFloor: toon(0xffffff, { map: carpet('#3a0c1c', '#6a1838', '#c8a040'), side }, { halftone: 0.35 }),
    roomFloor: toon(0xffffff, { map: carpet('#2a1430', '#44204e', '#7a4a8a'), side }, { halftone: 0.35 }),
    lobbyFloor: toon(0xffffff, { map: carpet('#14281c', '#1e4a2c', '#39ff6a'), side }, { halftone: 0.35 }),
    danceFloor: toon(0xffffff, { map: danceFloor(), side }, { halftone: 0.2 }),
    stage: toon(0x5a1430, { side }),
    ballWall: toon(0xffffff, { map: damask('#1a0c24', '#2a1438', '#c8a040'), side }),
    rooms,
    mass: toon(0x1a1018, { side }),
    cap: toon(0x0a060c, { side }, { halftone: 0 }),
    wood: toon(0x5a2a1a),
    brass: toon(0xc8a040),
    linen: toon(0xf0e6ee),
    steel: toon(0x8a96a0),
    black: toon(0x141018),
    door: toon(0xffffff, { map: doorTex() }),
    ballDoor: toon(0xffffff, { map: ballDoorTex(), side }),
    neon: NEON.map((c) => { const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); m.userData.solid = false; return m; }), // (no collision)
    glowGreen: new THREE.MeshBasicMaterial({ color: 0x39ff6a, toneMapped: false, transparent: true, opacity: 0.85 }),
  };
}

// ---------------------------------------------------------------- the posters
const POSTER = { w: 240, h: 340 };
const HEAD = ['SUPERGIRL', 'TONIGHT ONLY', 'LIVE ON 13', 'HERO FOR HIRE', 'GIRL OF STEEL?', 'NOW SHOWING', 'SOLD OUT', 'THE MAIN EVENT'];

/** A poster of "her": a frame (real, or one with a tell), titled like a show bill. */
export function posterCanvas(frame, fake, k = 1) {
  const c = document.createElement('canvas'); c.width = POSTER.w; c.height = POSTER.h;
  const g = c.getContext('2d');
  g.fillStyle = pick(['#120a16', '#1a0820', '#0c1410']); g.fillRect(0, 0, c.width, c.height);
  const pw = 216, ph = 236, px = 12, py = 52;
  let pic = null;
  if (frame) {
    const sw = frame.width, sh = frame.height, s = Math.max(pw / sw, ph / sh);
    const t = document.createElement('canvas'); t.width = pw; t.height = ph;
    t.getContext('2d').drawImage(frame, (pw - sw * s) / 2 + rand(-20, 20) * s, (ph - sh * s) / 2, sw * s, sh * s);
    pic = fake ? impostorize(t, k) : t;
    if (fake && !pic) return null; // (no tell would show: the caller makes it a real one)
    g.drawImage(pic, px, py);
  } else { g.fillStyle = '#2a1430'; g.fillRect(px, py, pw, ph); }
  g.strokeStyle = '#c8a040'; g.lineWidth = 3; g.strokeRect(px, py, pw, ph);
  g.fillStyle = pick(NEON_CSS); g.font = '900 34px Impact, "Arial Black", sans-serif'; g.textAlign = 'center';
  g.fillText(pick(HEAD), c.width / 2, 40);
  g.fillStyle = '#f2e6d0'; g.font = '700 15px Georgia, serif';
  g.fillText(pick(['The Puzzle Maker presents', 'Floor 13 · nightly', 'As seen in the Daily Scoop', 'Accept no substitutes']), c.width / 2, 312);
  g.fillStyle = '#c8a040'; g.font = '900 13px Impact, sans-serif'; g.fillText('?  ?  ?', c.width / 2, 332);
  c.tell = pic?.tell || '';
  return c;
}

let framePool = null;
/** A few frames from every activity folder (club3d/clips.js), shared by every poster this visit. */
export function posterFrames(n = 5) {
  if (framePool) return framePool;
  framePool = clipsReady.then(() => {
    const urls = shuffle([...CLIPS.captive, ...CLIPS.press, ...CLIPS.high, ...CLIPS.shame]).slice(0, n);
    return Promise.all(urls.map((u) => frameOf(u).catch(() => null))).then((l) => l.filter(Boolean));
  });
  framePool.then((l) => { if (!l.length) framePool = null; }); // (offline / blocked: try again next visit)
  return framePool;
}

// ---------------------------------------------------------------- the costume flat-lays
export const COSTUMES = {
  knockoff: ['tubetop_01', 'tubetop_03', 'tubetop_05', 'tubetop_07'],
  replica: ['classic_03', 'classic_05', 'classic_07', 'classic_10'],
  dressing: ['tubetop_02_weak', 'tubetop_04_weak', 'tubetop_06_weak', 'classic_09_weak', 'classic_12_weak'],
};
const keyed = new Map();
/** One of the user's green-screen costume pictures, the green keyed out (a canvas; null on failure). */
export function costumeImage(name) {
  if (keyed.has(name)) return keyed.get(name);
  const p = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, 640, 360);
      try {
        const d = g.getImageData(0, 0, 640, 360), q = d.data;
        for (let i = 0; i < q.length; i += 4) {
          const gr = q[i + 1] - Math.max(q[i], q[i + 2]);
          if (gr > 30) { q[i + 3] = gr > 70 ? 0 : 255 * (70 - gr) / 40; q[i + 1] = Math.max(q[i], q[i + 2]); }
        }
        g.putImageData(d, 0, 0);
      } catch (e) { /* tainted: shown as is */ }
      resolve(c);
    };
    im.onerror = () => resolve(null);
    im.src = `assets/SGCostume/${name}.jpg`;
  });
  keyed.set(name, p);
  return p;
}
