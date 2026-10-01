// Comic painting primitives shared by the street-fight set painters: the ink colour, an offscreen canvas
// maker, the halftone dot pattern, and inked box / tone helpers bound to a context.
export const INK = '#15111c';

export function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

let dots = null;
/** Comic halftone dot pattern (tiny tile; the drawing transform scales it). */
export function halftone(ctx) {
  if (!dots) {
    dots = mk(4, 4);
    const g = dots.getContext('2d');
    g.fillStyle = '#000'; g.beginPath(); g.arc(2, 2, 0.95, 0, Math.PI * 2); g.fill();
  }
  return ctx.createPattern(dots, 'repeat');
}

/** Inked drawing helpers for one context: ink() strokes the current path, box() fills + inks, tone() halftones. */
export function pen(g) {
  const ink = (lw = 1.6) => { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
  return {
    ink,
    box: (x, y, w, h, col, lw = 1.6) => { g.beginPath(); g.rect(x, y, w, h); g.fillStyle = col; g.fill(); if (lw) ink(lw); },
    tone: (x, y, w, h, a = 0.22) => { g.save(); g.globalAlpha = a; g.fillStyle = halftone(g); g.fillRect(x, y, w, h); g.restore(); },
  };
}
