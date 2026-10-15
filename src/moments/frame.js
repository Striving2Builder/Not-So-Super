// r11 F2b: the target in frame while a moment is in reach. The director picks one focus moment (the
// nearest live one she's on); while it's in reach the lens widens a few degrees (a lens change only:
// the chase rig stays exactly where it is), the target gets a pulsing inked halo, and when it's off
// screen (or behind her) a big comic arrow on the screen edge points the way, with its word and
// distance. It also keeps one message lane while a moment runs: the story slot (captions, news
// flashes) holds its queue and toasts drop below the moment's banner (body.mo-on).
import { comic } from '../comic.js';
import { M } from '../city3d.js';
import { PAYOFF, carrying } from './payoff.js';

export const FRAME = {
  near: 1400,     // a live moment closer than this (world units) can be the focus
  reach: 760,     // in reach: the lens widens
  lens: 9,        // degrees added to the lens while in reach
  lensRate: 2.2,  // ease (per s)
  halo: [26, 70], // halo radius range, px
  inset: 58,      // the edge arrow's inset from the screen edge, px
};

const WORD = { faller: 'WASHER!', car: 'CAR!', getaway: 'GETAWAY!', heli: 'CHOPPER!', rings: 'HOOP!', kitten: 'KITTEN!', impostor: 'IMPOSTOR!' };
const INK = '#0b0b16';
const FONT = (px) => `400 ${px}px Bangers, Impact, system-ui, sans-serif`;

/** The world point to frame for a moment (and roughly how big it is, world units). */
function aim(m) {
  const e = m.e;
  if (e?.kind === 'rings') { const r = e.rings[e.next]; return r ? { x: r.x, y: r.y, z: r.z, s: 26 / M } : null; }
  if (e?.vis) return { ...e.vis, s: e.kind === 'heli' ? 40 : e.kind === 'car' || e.kind === 'getaway' ? 22 : 14 }; // (r11 F2c: where its mesh is drawn)
  if (e) return { x: e.x, y: e.y, z: (e.z || 0) + (e.kind === 'car' || e.kind === 'getaway' ? 4 : 2), s: e.kind === 'heli' ? 40 : e.kind === 'car' || e.kind === 'getaway' ? 22 : 14 };
  return { x: m.x, y: m.y, z: (m.z || 0) + 5, s: 14 };
}

/** The moment to frame this frame (or null): a taken one first, then the nearest. */
export function focusOf(dir) {
  let best = null, bd = Infinity;
  for (const m of dir.live) {
    if (m.result) continue;
    const d = m.dist(), k = m.taken ? d * 0.5 : d;
    if (d < FRAME.near && k < bd) { bd = k; best = m; }
  }
  return best;
}

let held = false, watch = 0;
/** Per 3D frame (from the director): the lens and the message lane. */
export function frameStep(dir, view, dt) {
  const f = dir.focus = focusOf(dir), cam = view.cam;
  const hold = carrying(dir.ow); // (r11 F2c: the payoff in her hands: the lens punches in, the lane stays held)
  const want = hold ? PAYOFF.lens : f && f.dist() < FRAME.reach && !dir.sw ? FRAME.lens : 0;
  if (cam) cam.lens = (cam.lens || 0) + (want - (cam.lens || 0)) * Math.min(1, dt * FRAME.lensRate * (hold ? 2.5 : 1));
  const on = !!(f && f.taken) || hold;
  if (on !== held) {
    held = on;
    document.body.classList.toggle('mo-on', on);
    comic.hold?.(on);
  }
  if (on) { clearTimeout(watch); watch = setTimeout(() => frameOff(null), 800); } // (the flight stopped drawing: let go)
}

/** r11 F2c: one text lane: true while a moment (or its payoff) runs; the city's toasts and captions wait. */
export const laneBusy = () => held;

/** Line of sight from the lens to world (x, y, z): no tower in between (the last stretch is the target's own). */
function seen(dir, cam, x, y, z) {
  const ow = dir.ow, c = cam.position, cx = c.x / M, cy = c.z / M, cz = c.y / M;
  for (let i = 1; i < 14; i++) {
    const k = i / 15, o = ow.buildingAt(cx + (x - cx) * k, cy + (y - cy) * k);
    if (o && cz + (z - cz) * k < ow.hOf(o)) return false;
  }
  return true;
}

/** Release the lane (the flight ended, a zone opened). */
export function frameOff(view) {
  if (view?.cam) view.cam.lens = 0;
  clearTimeout(watch);
  if (held) { held = false; document.body.classList.remove('mo-on'); comic.hold?.(false); }
}

/** The halo round the target on screen, or the edge arrow when it isn't. */
export function overlayFocus(dir, ctx, P, W, H, view) {
  const m = dir.focus;
  if (!m || m.result || m.state === 'caught') return;
  const a = aim(m);
  if (!a) return;
  const t = dir.ow.t, col = m.color || '#ffe23a';
  const p = P.proj(a.x, a.y, a.z);
  const on = p[2] && p[0] > 30 && p[0] < W - 30 && p[1] > 40 && p[1] < H - 30;
  ctx.save();
  ctx.lineJoin = 'round';
  if (on && view.cam?.cam && !seen(dir, view.cam.cam, a.x, a.y, a.z)) {
    // r11 F2c: on screen but behind a tower: no halo round an empty wall, a small dashed "round there" ring
    ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6);
    ctx.beginPath(); ctx.arc(p[0], p[1], FRAME.halo[0] * 0.8, 0, Math.PI * 2); ctx.stroke();
  } else if (on) {
    // halo: the target's on-screen size from a second point a.s units up, two inked rings pulsing out
    const q = P.proj(a.x, a.y, a.z + a.s), R = Math.max(FRAME.halo[0], Math.min(FRAME.halo[1], q[2] ? Math.abs(q[1] - p[1]) * 0.9 : 0));
    const k = (t * 1.4) % 1, r0 = R * (1 + 0.06 * Math.sin(t * 8));
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(p[0], p[1], r0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = col; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p[0], p[1], r0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.8 * (1 - k); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p[0], p[1], r0 + k * R * 0.9, 0, Math.PI * 2); ctx.stroke();
  } else {
    // the edge arrow: direction from the screen centre toward the target (flipped when it's behind the lens)
    const cx = W / 2, cy = H * 0.52;
    let dx = p[0] - cx, dy = p[1] - cy;
    if (!p[2]) { dx = -dx; dy = -dy; if (dy < 0 && Math.abs(dy) > Math.abs(dx) * 0.2) dy = Math.abs(dy); } // (behind: point down/back)
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const I = FRAME.inset, s = Math.min((W / 2 - I) / Math.abs(dx || 1e-6), (H * 0.5 - I * 0.8) / Math.abs(dy || 1e-6));
    let x = cx + dx * s, y = cy + dy * s;
    for (let i = 0; i < 10 && view.underHud?.(x, y, 26); i++) { x = cx + dx * s * (0.9 - i * 0.07); y = cy + dy * s * (0.9 - i * 0.07); } // (in from the HUD)
    const ang = Math.atan2(dy, dx), pulse = 1 + 0.12 * Math.sin(t * 9);
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(pulse, pulse);
    ctx.beginPath(); // a fat comic arrow: shaft + head, pointing +x
    ctx.moveTo(30, 0); ctx.lineTo(6, -20); ctx.lineTo(6, -9); ctx.lineTo(-22, -9); ctx.lineTo(-22, 9); ctx.lineTo(6, 9); ctx.lineTo(6, 20); ctx.closePath();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
    ctx.restore(); ctx.save();
    // its word and distance, on the screen side of the arrow
    const word = WORD[m.kind] || 'HERE!', d = Math.round(m.dist() * M), lx = Math.max(50, Math.min(W - 50, x - dx * 46)), ly = Math.max(30, Math.min(H - 20, y - dy * 40));
    ctx.font = FONT(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(word, lx, ly);
    ctx.fillStyle = col; ctx.fillText(word, lx, ly);
    ctx.font = '800 11px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeText(`${d}m`, lx, ly + 15);
    ctx.fillStyle = '#fff'; ctx.fillText(`${d}m`, lx, ly + 15);
  }
  ctx.restore();
}
