// Procedural character art. Everything is drawn with canvas paths so there are no sprite sheets.
import { shade } from './util.js';

export const HERO_LOOK = {
  hero: true, skin: '#f6d1b3', hair: '#f5d442', top: '#7ec8f4', skirt: '#d82630', band: '#f7d31e',
  boots: '#c91f2b', cape: '#c11d27', hairStyle: 'hero', size: 1,
};

const SKINS = ['#f1c7a5', '#d9a47f', '#b57a55', '#8a5a3b', '#f5d6c0', '#6b4430'];
const HAIRS = ['#2a1d15', '#4a3020', '#161616', '#7a4a24', '#c9a24a', '#8a8a8a', '#a33a1a'];

export function npcLook(kind, r = Math.random) {
  const p = (a) => a[Math.floor(r() * a.length)];
  const base = { skin: p(SKINS), hair: p(HAIRS), top: '#444', bottom: '#2a2d3a', boots: '#151515', size: 1, hairStyle: p(['short', 'short', 'bald', 'cap']) };
  switch (kind) {
    case 'thug': return { ...base, top: p(['#3b3b3b', '#6b2a2a', '#2a3f6b', '#4d5a2a', '#5a3a6b']), hairStyle: p(['short', 'cap', 'beanie', 'bald']), capCol: p(['#c22', '#224', '#333']) };
    case 'knife': return { ...base, top: p(['#b8b8b8', '#d0c090', '#8a9aa0']), bandana: '#c22', hairStyle: 'short', tank: true };
    case 'brute': return { ...base, size: 1.22, top: '#2b2118', hairStyle: 'bald', beard: true, tank: true };
    case 'gunman': return { ...base, top: '#1b1d22', bottom: '#1b1d22', shades: true, hairStyle: 'slick' };
    case 'arsonist': return { ...base, top: '#c86a1a', bottom: '#3a3a2a', hairStyle: 'beanie', capCol: '#333' };
    case 'boss': return { ...base, size: 1.3, top: '#5a2a7a', bottom: '#3a1a4a', hairStyle: 'slick', shades: true, tie: '#e0c040' };
    case 'guard': return { ...base, top: '#16181d', bottom: '#16181d', shades: true, hairStyle: 'short' };
    case 'civilian': {
      const f = r() < 0.5;
      return { ...base, top: p(['#e05a5a', '#5ab0e0', '#e0c05a', '#6ad08a', '#c07ae0', '#f0f0f0']), bottom: f ? null : p(['#3a4a6a', '#555', '#6a5a3a']), skirt: f ? p(['#3a4a6a', '#8a3a5a', '#2a2a2a']) : null, hairStyle: f ? 'long' : p(['short', 'bald', 'short']), boots: f ? '#6a2a2a' : '#222' };
    }
    case 'farmer': return { ...base, top: '#b33', bottom: '#35a', hairStyle: 'cap', capCol: '#c9a24a', beard: r() < 0.5 };
  }
  return base;
}

/**
 * Limb angles are measured from straight down; positive swings toward the facing direction.
 * lt/bt = front/back leg [thigh, shin]; fa/ba = front/back arm [upper, forearm].
 */
export function pose(name, t = 0) {
  const P = { lean: 0, crouch: 0, rot: 0, lt: [0.12, 0.04], bt: [-0.12, -0.04], fa: [0.2, 0.5], ba: [-0.1, 0.3], capeAmp: 1, capeBillow: 0 };
  const s = Math.sin(t);
  switch (name) {
    case 'idle': Object.assign(P, { lt: [0.28, 0.06], bt: [-0.24, -0.12], fa: [0.55, 2.3], ba: [0.35, 2.0], crouch: 2 + Math.sin(t * 3) * 1 }); break;
    case 'stand': Object.assign(P, { lt: [0.08, 0.03], bt: [-0.06, -0.03], fa: [0.12, 0.25], ba: [-0.1, 0.1], crouch: Math.sin(t * 2) * 0.6 }); break;
    case 'walk': {
      const w = Math.sin(t * 9);
      P.lt = [0.5 * w, 0.5 * w - (w < 0 ? -0.7 * w : 0.1)];
      P.bt = [-0.5 * w, -0.5 * w - (w > 0 ? 0.7 * w : 0.1)];
      P.fa = [-0.45 * w + 0.15, -0.45 * w + 0.7];
      P.ba = [0.45 * w + 0.15, 0.45 * w + 0.7];
      P.lean = 0.06; P.crouch = Math.abs(Math.cos(t * 9)) * 2;
      break;
    }
    case 'punch1': Object.assign(P, { fa: [1.55, 1.57], ba: [0.35, 2.1], lean: 0.14, lt: [0.38, 0.1], bt: [-0.38, -0.12], crouch: 3 }); break;
    case 'punch2': Object.assign(P, { ba: [1.55, 1.57], fa: [0.5, 2.3], lean: 0.18, lt: [0.3, 0.1], bt: [-0.45, -0.15], crouch: 3 }); break;
    case 'kick': Object.assign(P, { lt: [1.6, 1.62], bt: [-0.15, -0.05], lean: -0.28, fa: [-0.35, 0.2], ba: [0.9, 1.7] }); break;
    case 'jump': Object.assign(P, { lt: [1.0, -0.25], bt: [0.4, -0.55], fa: [2.5, 2.7], ba: [2.2, 2.5], capeBillow: 6 }); break;
    case 'flykick': Object.assign(P, { lt: [1.75, 1.75], bt: [0.7, -0.35], lean: -0.32, fa: [2.6, 2.8], ba: [0.6, 1.2], capeBillow: 10 }); break;
    case 'hurt': Object.assign(P, { lean: -0.38, fa: [-0.8, -0.4], ba: [-0.6, -0.2], lt: [0.25, 0.05], bt: [-0.3, -0.2] }); break;
    case 'down': Object.assign(P, { rot: -1.5, lt: [0.1, 0.05], bt: [0.05, 0], fa: [2.8, 2.9], ba: [2.6, 2.8], capeAmp: 0.1 }); break;
    case 'beam': Object.assign(P, { lean: -0.04, fa: [0.35, 1.0], ba: [0.25, 0.9], eyes: true, lt: [0.3, 0.05], bt: [-0.3, -0.1] }); break;
    case 'breath': Object.assign(P, { lean: 0.14, fa: [0.4, 1.2], ba: [0.3, 1.1], breath: true, lt: [0.3, 0.05], bt: [-0.3, -0.1] }); break;
    case 'cheer': Object.assign(P, { fa: [2.95, 3.05], ba: [0.3, 0.6], lt: [0.22, 0.12], bt: [-0.22, -0.12], capeBillow: 7, capeAmp: 1.6 }); break;
    case 'sitTied': Object.assign(P, { lt: [1.5, 0.05], bt: [1.45, 0.0], fa: [-0.55, -1.25], ba: [-0.65, -1.3], crouch: 22, tied: true, capeAmp: 0.2, lean: -0.05 + Math.sin(t * 1.4) * 0.03 }); break;
    case 'sitFloor': Object.assign(P, { lt: [1.45, 1.5], bt: [1.35, 1.45], fa: [-0.5, -1.2], ba: [-0.6, -1.3], crouch: 41, tied: true }); break;
    case 'dizzy': Object.assign(P, { lean: s * 0.14, fa: [0.35 + s * 0.2, 0.3], ba: [-0.2, 0.2], lt: [0.15, 0.05], bt: [-0.15, -0.05], stars: true }); break;
    case 'fly': Object.assign(P, { rot: 1.35, lt: [0.08, 0.04], bt: [-0.04, -0.12], fa: [3.05, 3.1], ba: [0.35, 0.45], capeBillow: 12, capeAmp: 2 }); break;
    case 'guard': Object.assign(P, { fa: [0.9, 2.1], ba: [0.2, 0.4], lt: [0.12, 0.04], bt: [-0.12, -0.04] }); break;
    case 'aim': Object.assign(P, { fa: [1.5, 1.52], ba: [1.3, 1.45], lt: [0.25, 0.05], bt: [-0.25, -0.1] }); break;
    case 'wind': Object.assign(P, { fa: [-0.9, 0.4], ba: [0.6, 2.0], lean: -0.15, lt: [0.3, 0.05], bt: [-0.35, -0.1] }); break;
    case 'run': {
      const w = Math.sin(t * 13);
      P.lt = [0.8 * w, 0.8 * w - (w < 0 ? -1.1 * w : 0.2)];
      P.bt = [-0.8 * w, -0.8 * w - (w > 0 ? 1.1 * w : 0.2)];
      P.fa = [-0.8 * w, -0.8 * w + 1.4]; P.ba = [0.8 * w, 0.8 * w + 1.4];
      P.lean = 0.2;
      break;
    }
  }
  return P;
}

function cap(ctx, a, b, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}

/** The $ shield emblem, centred at 0,0 with half-width ~w. */
export function drawEmblem(ctx, w, band = '#f7d31e', red = '#d82630') {
  ctx.fillStyle = band; ctx.strokeStyle = red; ctx.lineWidth = w * 0.18;
  ctx.beginPath();
  ctx.moveTo(-w, -w * 0.75); ctx.lineTo(w, -w * 0.75); ctx.lineTo(w * 1.1, -w * 0.1); ctx.lineTo(0, w); ctx.lineTo(-w * 1.1, -w * 0.1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = red; ctx.font = `900 ${w * 1.5}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', 0, -w * 0.05);
}

/**
 * Side-view humanoid. (x,y) = feet on the ground, s = pixels per unit (body is ~100 units tall).
 */
export function drawHumanoid(ctx, x, y, s, facing, L, P, t = 0) {
  const sz = s * (L.size || 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sz * facing, sz);
  const hipY = -46 + (P.crouch || 0);
  if (P.rot) { ctx.translate(0, hipY); ctx.rotate(P.rot); ctx.translate(0, -hipY); }
  const lean = P.lean || 0;
  const tx = Math.sin(lean), ty = -Math.cos(lean);
  const T = (d) => [tx * d, hipY + ty * d];
  const fem = L.hero || L.hairStyle === 'long';
  const thighCol = L.bottom || L.skin;
  const shinCol = L.hero ? L.boots : (L.bottom || L.skin);
  const sh = T(30), hc = T(40.5);

  // Cape (behind everything)
  if (L.cape) {
    const w = Math.sin(t * 6) * 3 * (P.capeAmp ?? 1), b = P.capeBillow || 0;
    ctx.fillStyle = shade(L.cape, -0.18);
    ctx.beginPath();
    ctx.moveTo(sh[0] - 3, sh[1] - 1);
    ctx.lineTo(sh[0] + 2.5, sh[1] + 1);
    ctx.quadraticCurveTo(-3, hipY - 4, -5 - b * 0.4 + w * 0.5, hipY + 15);
    ctx.lineTo(-16 - b * 1.4 + w, hipY + 11 - b * 0.3);
    ctx.quadraticCurveTo(-12 - b * 0.6, hipY - 10, sh[0] - 3, sh[1] - 1);
    ctx.fill();
  }

  const leg = (a, dx, dark) => {
    const h = [dx, hipY + 2];
    const k = [h[0] + Math.sin(a[0]) * 22, h[1] + Math.cos(a[0]) * 22];
    const f = [k[0] + Math.sin(a[1]) * 22, k[1] + Math.cos(a[1]) * 22];
    const d = (c) => (dark ? shade(c, -0.28) : c);
    cap(ctx, h, k, fem ? 8.2 : 9, d(thighCol));
    cap(ctx, k, f, fem ? 7 : 8, d(shinCol));
    if (L.hero) cap(ctx, k, [k[0] + Math.sin(a[1]) * 3, k[1] + Math.cos(a[1]) * 3], 8.6, d(L.boots));
    ctx.save(); ctx.translate(f[0], f[1]); ctx.rotate(-a[1]);
    ctx.fillStyle = d(L.boots);
    ctx.beginPath(); ctx.ellipse(3, -0.5, 5.8, 2.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const arm = (a, dark) => {
    const s0 = [sh[0], sh[1] + 1.5];
    const e = [s0[0] + Math.sin(a[0]) * 15, s0[1] + Math.cos(a[0]) * 15];
    const w = [e[0] + Math.sin(a[1]) * 14, e[1] + Math.cos(a[1]) * 14];
    const d = (c) => (dark ? shade(c, -0.28) : c);
    const upper = L.tank ? L.skin : L.top;
    const lower = L.hero || !(L.tank || L.hairStyle === 'long') ? (L.tank ? L.skin : L.top) : L.skin;
    cap(ctx, s0, e, fem ? 5.2 : 6, d(upper));
    cap(ctx, e, w, fem ? 4.8 : 5.5, d(lower));
    ctx.fillStyle = d(L.skin);
    ctx.beginPath(); ctx.arc(w[0], w[1], fem ? 3 : 3.5, 0, Math.PI * 2); ctx.fill();
  };

  arm(P.ba, true);
  leg(P.bt, -1.5, true);
  leg(P.lt, 1.5, false);

  // Torso
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean);
  ctx.fillStyle = L.top;
  ctx.beginPath();
  if (fem) {
    ctx.moveTo(-5, 2); ctx.lineTo(-4.5, -10); ctx.quadraticCurveTo(-6.2, -20, -5, -31);
    ctx.lineTo(4, -31.5); ctx.quadraticCurveTo(8.2, -24, 5.2, -18); ctx.quadraticCurveTo(3, -14, 3.6, -9); ctx.lineTo(5, 2);
  } else {
    ctx.moveTo(-6.5, 3); ctx.lineTo(-7, -30); ctx.lineTo(6.5, -31); ctx.lineTo(7, -10); ctx.lineTo(6, 3);
  }
  ctx.closePath(); ctx.fill();
  if (L.tank) { ctx.fillStyle = L.skin; ctx.fillRect(-4, -31, 8, 4); }
  if (L.tie) { ctx.strokeStyle = L.tie; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5.5, -29); ctx.lineTo(6.5, -12); ctx.stroke(); }
  if (L.hero) {
    ctx.fillStyle = L.skirt;
    ctx.beginPath(); ctx.moveTo(-6.4, -5); ctx.lineTo(6.2, -5); ctx.lineTo(9.5, 9.5); ctx.lineTo(-9.5, 9.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(L.skirt, -0.2);
    ctx.fillRect(-1, -4, 1.2, 13);
    ctx.fillStyle = L.band; ctx.fillRect(-6.8, -7.6, 13.6, 3.2);
    ctx.save(); ctx.translate(2.6, -22.5); ctx.scale(facing, 1); drawEmblem(ctx, 3.6, L.band, L.skirt); ctx.restore();
  } else if (L.skirt) {
    ctx.fillStyle = L.skirt;
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(6, -6); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = shade(L.bottom || '#333333', -0.3); ctx.fillRect(-7, -1, 13.5, 3);
  }
  if (P.tied) {
    ctx.strokeStyle = '#d8c28a'; ctx.lineWidth = 2.4;
    for (const yy of [-12, -19, -25]) { ctx.beginPath(); ctx.moveTo(-8, yy); ctx.lineTo(8, yy - 1); ctx.stroke(); }
  }
  // neck
  ctx.fillStyle = L.skin; ctx.fillRect(-2.2, -35, 4.4, 5);
  ctx.restore();

  // Head
  const [hx, hy] = hc;
  const hs = L.hairStyle;
  if (hs === 'hero' || hs === 'long') {
    const w = Math.sin(t * 5) * 1.5 * (P.capeAmp ?? 1);
    ctx.fillStyle = shade(L.hair, -0.12);
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 8);
    ctx.quadraticCurveTo(hx - 11, hy - 2, hx - 10 + w, hy + 17);
    ctx.lineTo(hx - 3 + w * 0.5, hy + 15);
    ctx.quadraticCurveTo(hx - 1, hy + 4, hx + 2, hy);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(hx + 0.6, hy, 7.3, 0, Math.PI * 2); ctx.fill();
  // nose bump
  ctx.beginPath(); ctx.arc(hx + 7.2, hy + 0.5, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.hair;
  if (hs === 'hero' || hs === 'long') {
    ctx.beginPath(); ctx.arc(hx - 0.2, hy - 0.8, 7.8, Math.PI * 0.62, Math.PI * 1.9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 3, hy - 5.2, 5, 2.6, 0.25, 0, Math.PI * 2); ctx.fill();
  } else if (hs === 'short' || hs === 'slick') {
    ctx.beginPath(); ctx.arc(hx, hy - 0.5, 7.8, Math.PI * 0.85, Math.PI * 1.95); ctx.closePath(); ctx.fill();
  } else if (hs === 'cap') {
    ctx.fillStyle = L.capCol || '#c22';
    ctx.beginPath(); ctx.arc(hx, hy - 1.2, 7.8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(hx + 2, hy - 2.5, 9, 2);
  } else if (hs === 'beanie') {
    ctx.fillStyle = L.capCol || '#333';
    ctx.beginPath(); ctx.arc(hx, hy - 1.5, 8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(hx - 8, hy - 2.5, 16, 2.5);
  }
  if (L.bandana) { ctx.fillStyle = L.bandana; ctx.fillRect(hx - 7.5, hy - 5, 15, 3); ctx.fillRect(hx - 10, hy - 4, 3, 5); }
  if (L.beard) { ctx.fillStyle = shade(L.hair, -0.2); ctx.beginPath(); ctx.arc(hx + 2, hy + 3, 5.5, 0, Math.PI); ctx.fill(); }
  // eye
  if (P.eyes) {
    ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(hx + 4.6, hy - 0.6, 1.8, 0, Math.PI * 2); ctx.fill();
  } else if (L.shades) {
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(hx + 1.5, hy - 2.2, 6.5, 2.6);
  } else {
    ctx.fillStyle = L.hero ? '#2a6bd8' : '#1a1a1a';
    ctx.beginPath(); ctx.arc(hx + 4.4, hy - 0.8, 1.05, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = L.hero ? '#c0505a' : shade(L.skin, -0.4); ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(hx + 4, hy + 3.4); ctx.lineTo(hx + 6.2, hy + 3.2); ctx.stroke();
  if (P.stars) {
    ctx.fillStyle = '#ffe14a';
    for (let i = 0; i < 3; i++) { const a = t * 3 + (i * Math.PI * 2) / 3; star(ctx, hx + Math.cos(a) * 11, hy - 11 + Math.sin(a) * 3, 2.6); }
  }

  arm(P.fa, false);
  ctx.restore();
}

/** Top-down flying heroine, heading along +x after rotation by `ang`. */
export function drawHeroTop(ctx, x, y, s, ang, t, bank = 0) {
  const L = HERO_LOOK;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s * (1 - Math.abs(bank) * 0.25));
  const w = Math.sin(t * 9);
  // cape
  ctx.fillStyle = L.cape;
  ctx.beginPath();
  ctx.moveTo(6, -8); ctx.lineTo(6, 8);
  ctx.quadraticCurveTo(-12, 12 + w * 3, -34, 9 + w * 5);
  ctx.lineTo(-38, w * 4);
  ctx.lineTo(-34, -9 + w * 5);
  ctx.quadraticCurveTo(-12, -12 + w * 3, 6, -8);
  ctx.fill();
  ctx.fillStyle = shade(L.cape, -0.25);
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(-18, w * 2, -36, w * 4); ctx.lineTo(0, 2); ctx.fill();
  // legs
  for (const side of [-1, 1]) {
    const k = Math.sin(t * 6 + side) * 1.5;
    cap(ctx, [-6, side * 3], [-18, side * 3.5 + k * 0.3], 5.5, L.skin);
    cap(ctx, [-18, side * 3.5 + k * 0.3], [-30, side * 4 + k], 5, L.boots);
  }
  // skirt + band
  ctx.fillStyle = L.skirt; ctx.beginPath(); ctx.ellipse(-6, 0, 6.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.band; ctx.fillRect(-2.5, -6.5, 2.2, 13);
  // torso
  ctx.fillStyle = L.top; ctx.beginPath(); ctx.ellipse(4, 0, 8.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  // arms forward
  for (const side of [-1, 1]) {
    cap(ctx, [7, side * 6.5], [24, side * 3], 4.5, L.top);
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(25, side * 3, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // head & hair
  ctx.fillStyle = shade(L.hair, -0.1);
  ctx.beginPath(); ctx.moveTo(14, -4); ctx.quadraticCurveTo(4, -7 + w, -8, -3 + w * 2); ctx.lineTo(-8, 3 + w * 2); ctx.quadraticCurveTo(4, 7 + w, 14, 4); ctx.fill();
  ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(14, 0, 5.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const glowCache = new Map();
/** Soft radial glow sprite (cheap light halo), cached per colour. */
export function glow(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color + '88');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}

/** Draw a portrait canvas of a character for dialogs. */
export function portrait(look, poseName = 'stand', facing = 1) {
  const c = document.createElement('canvas');
  c.width = 168; c.height = 220;
  const g = c.getContext('2d');
  drawHumanoid(g, 84, 330, 3.0, facing, look, pose(poseName, 0), 0);
  return c;
}
