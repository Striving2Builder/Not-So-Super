// Off-screen incident markers in the flight view: an arrow on the screen edge pointing at each
// incident, with its distance. Arrows that land close together merge into one chip ("3 · 220m"),
// only the nearest few are shown, and none sit under a HUD panel or thumb button.
import { avoidHud } from './ui.js';

const MARK = {
  edge: 34,        // px from the screen edge
  merge: 46,       // arrows closer than this (px) become one chip
  max: 4,          // chips shown (nearest first); the waypoint always shows on top of these
  font: '700 11px system-ui, sans-serif',
};

/**
 * marks: [{ x, y, color, waypoint?, dist? }] in world units (dist overrides the distance shown);
 * V: the view's projection (SX/SY, cx/scy);
 * from: { x, y } (the hero) for distances.
 */
export function drawEdgeMarkers(ctx, V, marks, from, W, H) {
  const m = MARK.edge, chips = [];
  const sorted = marks
    .map((z) => ({ z, sx: V.SX(z.x), sy: V.SY(z.y), d: z.dist ?? Math.hypot(z.x - from.x, z.y - from.y) }))
    .filter((q) => !(q.sx > m && q.sx < W - m && q.sy > m + 50 && q.sy < H - m))
    .sort((a, b) => (b.z.waypoint ? 1 : 0) - (a.z.waypoint ? 1 : 0) || a.d - b.d);
  for (const q of sorted) {
    const a = Math.atan2(q.sy - V.scy, q.sx - V.cx), tx = Math.cos(a), ty = Math.sin(a);
    const s = Math.min((W / 2 - m) / Math.abs(tx || 1e-6), (H / 2 - m - 20) / Math.abs(ty || 1e-6));
    const ax = V.cx + tx * s, ay = V.scy + ty * s;
    const near = !q.z.waypoint && chips.find((c) => !c.waypoint && Math.hypot(c.ax - ax, c.ay - ay) < MARK.merge);
    if (near) { near.n++; continue; }
    if (chips.filter((c) => !c.waypoint).length >= MARK.max && !q.z.waypoint) continue;
    chips.push({ ax, ay, a, tx, ty, d: q.d, n: 1, color: q.z.color, waypoint: !!q.z.waypoint });
  }
  ctx.font = MARK.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const c of chips) {
    const [x, y] = avoidHud(c.ax, c.ay, 6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(c.a);
    const sc = c.waypoint ? 1.4 : c.n > 1 ? 1.2 : 1;
    ctx.fillStyle = c.color; ctx.strokeStyle = c.waypoint ? '#fff' : '#0b0b16'; ctx.lineWidth = c.waypoint ? 3 : 2.5;
    ctx.beginPath(); ctx.moveTo(14 * sc, 0); ctx.lineTo(-4 * sc, -9 * sc); ctx.lineTo(-4 * sc, 9 * sc); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    const label = `${c.n > 1 ? `${c.n} · ` : ''}${Math.round(c.d / 10)}m`;
    const [lx, ly] = avoidHud(x - c.tx * 24, y - c.ty * 20, 4);
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#0b0b16'; ctx.strokeText(label, lx, ly);
    ctx.fillStyle = '#fff'; ctx.fillText(label, lx, ly);
  }
}
