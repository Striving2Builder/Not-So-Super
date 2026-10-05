// Super Squirt on screen (docs/design/nightclub.md "Intoxication and the blackout"): the comic panel
// tilts and breathes, the ink doubles (a ghost copy of the frame drifting off register), the colour
// slides toward magenta, the edges close in. Driven by the shared intox meter (state.intox, 0–100).
// Cost: nothing when sober; above it one half-res copy of the frame + two full-screen draws.

export const TIERS = { light: 20, medium: 45, heavy: 75 };

let ghost = null, gx = null;

/** Before the scene: tilt + zoom the panel (call, draw the scene, then afterScene). */
export function beforeScene(ctx, w, h, intox, t) {
  const u = Math.max(0, (intox - TIERS.light) / (100 - TIERS.light));
  ctx.save();
  if (u <= 0) return;
  const rot = Math.sin(t * 0.45) * 0.035 * u, z = 1 + 0.03 * u + Math.sin(t * 0.9) * 0.012 * u;
  ctx.translate(w / 2, h / 2); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
}

/** After the scene: doubled ink, colour slide, closing edges. */
export function afterScene(ctx, canvas, w, h, intox, t) {
  ctx.restore();
  const u = Math.max(0, (intox - TIERS.light) / (100 - TIERS.light));
  if (u <= 0) return;
  if (intox >= TIERS.medium) {
    if (!ghost) { ghost = document.createElement('canvas'); gx = ghost.getContext('2d'); }
    const gw = Math.round(w / 2), gh = Math.round(h / 2);
    if (ghost.width !== gw || ghost.height !== gh) { ghost.width = gw; ghost.height = gh; }
    gx.drawImage(canvas, 0, 0, gw, gh);
    const off = (8 + 14 * u) * Math.sin(t * 1.3);
    ctx.globalAlpha = 0.1 + 0.3 * u; ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(ghost, off, -off * 0.4, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = `rgba(255,40,190,${0.26 * u * u * (0.75 + 0.25 * Math.sin(t * 2.1))})`;
  ctx.globalCompositeOperation = 'overlay'; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(w / 2, h / 2, h * (0.6 - 0.3 * u), w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, 'rgba(10,0,20,0)'); g.addColorStop(1, `rgba(10,0,20,${0.15 + 0.7 * u})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/** Free the ghost buffer when the club is left. */
export function freeIntox() { if (ghost) { ghost.width = ghost.height = 0; ghost = gx = null; } }
