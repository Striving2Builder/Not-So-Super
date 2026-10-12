// The flight moments' comic overlay, drawn on the flight view's 2D layer every frame (cheap canvas
// paths, no DOM): a lettered tag over each target with a pointer down to it, a lock-on reticle with
// "DIVE!" when she's in range, and the moment's banner (title, clock, meters) under the HUD's top
// panel. Everything keeps out of the HUD rects, the LIVE panel and her own silhouette.
const FONT = (px) => `400 ${px}px Bangers, Impact, system-ui, sans-serif`;
const INK = '#0b0b16';

/** Rounded-rect path helper (older WebKit has no roundRect on some contexts). */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/**
 * A comic tag lettered `text` floating `lift` px above the screen point (x, y), with a pointer to it.
 * o: { col (fill), fg (letters), sub (small line under it, e.g. a distance), size, lift, alpha, shake }.
 */
export function tag(ctx, x, y, text, o = {}) {
  const size = o.size || 15, lift = o.lift ?? 26, col = o.col || '#ffe23a', fg = o.fg || INK;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.font = FONT(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const w = ctx.measureText(text).width + 16, h = size + 9;
  const sx = o.shake ? Math.sin(performance.now() / 30) * o.shake : 0;
  const bx = x - w / 2 + sx, by = y - lift - h;
  // pointer, then the box over it
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 6 + sx, by + h - 1); ctx.lineTo(x, y - 4); ctx.lineTo(x + 6 + sx, by + h - 1); ctx.closePath(); ctx.stroke(); ctx.fill();
  rr(ctx, bx, by, w, h, 5); ctx.stroke(); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(text, x + sx, by + h / 2 + 1);
  if (o.sub) {
    ctx.font = '800 10px system-ui, sans-serif';
    const sw = ctx.measureText(o.sub).width + 10;
    ctx.fillStyle = 'rgba(11,11,22,.85)'; rr(ctx, x - sw / 2, by - 15, sw, 14, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(o.sub, x, by - 7.5);
  }
  ctx.restore();
  return { x: bx, y: by, w, h };
}

/** Lock-on: a spinning broken ring round the target and, in range, a pulsing "DIVE! ▼". */
export function reticle(ctx, x, y, r, t, { col = '#ffe23a', dive = false, label = 'DIVE! ▼' } = {}) {
  ctx.save();
  const p = 0.5 + 0.5 * Math.sin(t * 9);
  ctx.translate(x, y);
  ctx.lineWidth = 5; ctx.strokeStyle = INK;
  const arcs = (rad, rot) => { for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, rad, rot + i * Math.PI / 2 + 0.25, rot + i * Math.PI / 2 + 1.3); ctx.stroke(); } };
  const R = r + (dive ? 4 * p : 0), rot = t * (dive ? 3 : 1.2);
  arcs(R, rot);
  ctx.lineWidth = 2.5; ctx.strokeStyle = col; arcs(R, rot);
  if (dive) {
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4)); ctx.lineTo(Math.cos(a) * (R + 13), Math.sin(a) * (R + 13)); ctx.stroke(); }
    ctx.font = FONT(17); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText(label, 0, -R - 16);
    ctx.fillStyle = p > 0.5 ? '#ffe23a' : '#ffffff'; ctx.fillText(label, 0, -R - 16);
  }
  ctx.restore();
}

/** An expanding "sound" ring (super-hearing) round a screen point. */
export function ping(ctx, x, y, t, col = '#9fdcff') {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3) % 1;
    ctx.globalAlpha = 0.85 * (1 - k);
    ctx.lineWidth = 3; ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 10 + k * 70, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/**
 * The moment's banner, centred under the HUD's top panel: an ink plate with the title, a clock and
 * up to two meters. b: { title, col, time (s left, or null), meters: [{ label, v 0..1, col, warn }] }.
 * top: px from the top (below #hud-top). Returns its height.
 */
export function banner(ctx, W, top, b, t) {
  const meters = b.meters || [], w = Math.min(330, W * 0.42), x = W / 2 - w / 2;
  const h = 30 + meters.length * 15;
  ctx.save();
  ctx.lineJoin = 'round';
  // plate: a slanted ink panel with a coloured spine
  ctx.fillStyle = 'rgba(11,11,22,.86)'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 8, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w - 8, top + h); ctx.lineTo(x, top + h); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = b.col || '#ffe23a';
  ctx.beginPath(); ctx.moveTo(x + 8, top); ctx.lineTo(x + 20, top); ctx.lineTo(x + 12, top + h); ctx.lineTo(x, top + h); ctx.closePath(); ctx.fill();
  ctx.font = FONT(16); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.fillText(b.title, x + 24, top + 15);
  if (b.time != null) {
    const s = Math.max(0, b.time), low = s < 6, txt = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    ctx.textAlign = 'right'; ctx.font = FONT(low ? 18 : 16);
    ctx.fillStyle = low && Math.sin(t * 12) > 0 ? '#ff4a4a' : '#ffe23a';
    ctx.fillText(txt, x + w - 14, top + 15);
  }
  meters.forEach((m, i) => {
    const y = top + 30 + i * 15, mx = x + 86, mw = w - 104;
    ctx.font = '800 9px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = m.warn ? '#ff7a7a' : '#cfd6e6';
    ctx.fillText(m.label, mx - 6, y + 4);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, mx, y, mw, 8, 4); ctx.fill();
    const v = Math.max(0, Math.min(1, m.v));
    if (v > 0.01) { ctx.fillStyle = m.warn && Math.sin(t * 14) > 0 ? '#ffffff' : (m.col || '#ffe23a'); rr(ctx, mx, y, Math.max(8, mw * v), 8, 4); ctx.fill(); }
    if (m.pips) { // pips: discrete (e.g. 3/6 Polaroids)
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      for (let k = 1; k < m.pips; k++) { const px = mx + (mw * k) / m.pips; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + 8); ctx.stroke(); }
    }
  });
  ctx.restore();
  return h;
}

/** The screen's top band free of the HUD (below #hud-top): where the banner goes. */
export function bannerTop(rects) {
  let top = 56;
  for (const r of rects) if (r.top < 40 && r.left < innerWidth * 0.62 && r.right > innerWidth * 0.38) top = Math.max(top, r.bottom + 6);
  return top;
}
