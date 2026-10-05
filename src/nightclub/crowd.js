// Silhouette crowd for the detective nightclubs: procedural dancers baked once into a small atlas
// (TYPES poses × FRAMES), solid ink with a thin backlit rim tinted per room. Stand-ins until the
// user's green-screen dancer clips arrive (docs/design/nightclub-assets.md, batch 1 item 5); the
// stage only asks crowdFrame() for a canvas, so real clips can replace this file's art later.

const FW = 170, FH = 250, FRAMES = 8;  // one frame cell, wide enough for outflung arms (no bleed between frames)

/** Poses: arms (shoulder angles, 0 = down, PI = straight up), sway, bob, hair/build. */
const TYPES = [
  { arms: [2.6, 2.4], sway: 0.10, bob: 10, build: 1.0, hair: 0 },   // hands up
  { arms: [0.5, 0.6], sway: 0.16, bob: 6, build: 0.92, hair: 1 },   // swaying, long hair
  { arms: [2.9, 0.4], sway: 0.08, bob: 12, build: 1.08, hair: 0 },  // one fist pumping
  { arms: [1.2, 1.3], sway: 0.12, bob: 8, build: 0.9, hair: 2 },    // elbows out, bun
  { arms: [0.3, 1.9], sway: 0.05, bob: 4, build: 1.12, hair: 0 },   // holding a drink up
  { arms: [2.2, 2.2], sway: 0.18, bob: 14, build: 0.95, hair: 1 },  // jumping
];
export const CROWD_TYPES = TYPES.length;

function figure(c, type, f, fill) {
  const T = TYPES[type], ph = (f / FRAMES) * Math.PI * 2;
  const bob = Math.abs(Math.sin(ph)) * T.bob, sway = Math.sin(ph) * T.sway;
  const cx = FW / 2, foot = FH - 6, b = T.build;
  const hip = foot - 92 + bob * 0.3, sh = hip - 70 * b + bob * 0.2, head = sh - 26;
  c.save();
  c.translate(cx, hip); c.rotate(sway); c.translate(-cx, -hip);
  c.fillStyle = c.strokeStyle = fill; c.lineCap = 'round'; c.lineJoin = 'round';
  // legs (a step on the beat): solid, not sticks
  c.lineWidth = 21 * b;
  const step = Math.sin(ph) * 9;
  c.beginPath(); c.moveTo(cx - 9 * b, hip); c.lineTo(cx - 13 * b - step, foot - 8); c.moveTo(cx + 9 * b, hip); c.lineTo(cx + 13 * b + step * 0.6, foot - 8); c.stroke();
  // torso: shoulders → waist → hips (a skirt flare on some)
  c.beginPath(); c.moveTo(cx - 25 * b, sh); c.lineTo(cx + 25 * b, sh); c.lineTo(cx + 17 * b, sh + 42 * b);
  if (T.hair === 1) { c.lineTo(cx + 30 * b, hip + 22); c.lineTo(cx - 30 * b, hip + 22); } else { c.lineTo(cx + 20 * b, hip + 8); c.lineTo(cx - 20 * b, hip + 8); }
  c.lineTo(cx - 17 * b, sh + 42 * b); c.closePath(); c.fill();
  c.beginPath(); c.arc(cx - 20 * b, sh + 6, 9 * b, 0, Math.PI * 2); c.arc(cx + 20 * b, sh + 6, 9 * b, 0, Math.PI * 2); c.fill();
  // arms: upper + forearm, swinging with the beat
  c.lineWidth = 14 * b;
  for (const [side, a0] of [[-1, T.arms[0]], [1, T.arms[1]]]) {
    const a = a0 + Math.sin(ph + side) * 0.25, sx = cx + side * 21 * b;
    const ex = sx + side * Math.sin(a) * 30, ey = sh + 4 + Math.cos(a) * 30;
    const a2 = a + side * 0.4 * Math.sin(ph * 2);
    c.beginPath(); c.moveTo(sx, sh + 6); c.lineTo(ex, ey); c.lineTo(ex + side * Math.sin(a2) * 27, ey + Math.cos(a2) * 27); c.stroke();
  }
  // neck, head + hair
  c.fillRect(cx + sway * 20 - 6, head + 8, 12, 14);
  c.beginPath(); c.arc(cx + sway * 20, head, 15, 0, Math.PI * 2); c.fill();
  if (T.hair === 1) { c.beginPath(); c.ellipse(cx + sway * 20 - 3, head + 13, 14, 22, 0.2, 0, Math.PI * 2); c.fill(); }
  if (T.hair === 2) { c.beginPath(); c.arc(cx + sway * 20 + 4, head - 16, 8, 0, Math.PI * 2); c.fill(); }
  c.restore();
}

let atlas = null;
/** Solid ink frames (shared by every room). */
function inkAtlas() {
  if (atlas) return atlas;
  atlas = document.createElement('canvas');
  atlas.width = FW * FRAMES; atlas.height = FH * TYPES.length;
  const c = atlas.getContext('2d');
  for (let t = 0; t < TYPES.length; t++) for (let f = 0; f < FRAMES; f++) {
    c.save(); c.translate(f * FW, t * FH); figure(c, t, f, '#05040a'); c.restore();
  }
  return atlas;
}

/**
 * A room's crowd atlas: each ink frame over a copy of itself in the room's rim colour, nudged up
 * and toward the light, so the haze behind them lights their edges (the reference's backlit look).
 */
export function crowdAtlas(rim) {
  const ink = inkAtlas();
  const a = document.createElement('canvas');
  a.width = ink.width; a.height = ink.height;
  const c = a.getContext('2d');
  const tint = document.createElement('canvas');
  tint.width = ink.width; tint.height = ink.height;
  const t = tint.getContext('2d');
  t.drawImage(ink, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = rim; t.fillRect(0, 0, tint.width, tint.height);
  c.drawImage(tint, -2, -3); c.drawImage(tint, 2, -3);
  c.drawImage(ink, 0, 0);
  return a;
}

/** Draw one dancer: atlas, type, beat phase (0..1), feet at (x, y), height in px, mirrored. */
export function drawDancer(ctx, a, type, phase, x, y, h, flip = false) {
  const f = Math.floor(((phase % 1) + 1) % 1 * FRAMES), w = h * (FW / FH);
  if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(a, f * FW, type * FH, FW, FH, -w / 2, y - h, w, h); ctx.restore(); }
  else ctx.drawImage(a, f * FW, type * FH, FW, FH, x - w / 2, y - h, w, h);
}
