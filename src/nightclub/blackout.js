// The blackout (docs/design/nightclub.md "Intoxication and the blackout"): snapshots of her night
// while she's dosed, the comic-panel cinematic when she goes under (her last frames freeze into
// panels that slide in, crack and smear to black), and the polaroids of her the memory-fragment
// hunt scatters round the club (blackmail material if she leaves without them).

const SNAP_W = 320, SNAP_H = 180, KEEP = 6;
const CAPTIONS = ['The lights smear…', 'Flashes. Somebody has a camera.', 'Then nothing.'];

/** A ring of small frames grabbed off the game canvas while she's intoxicated. */
export class Snapshots {
  constructor() { this.list = []; }
  grab(canvas) {
    const c = this.list.length >= KEEP ? this.list.shift() : document.createElement('canvas');
    c.width = SNAP_W; c.height = SNAP_H;
    try { c.getContext('2d').drawImage(canvas, 0, 0, SNAP_W, SNAP_H); } catch (e) { return; }
    this.list.push(c);
  }
  latest(n) { return this.list.slice(-n); }
  free() { this.list = []; }
}

/** A polaroid of one snapshot (or one of the user's photos): white frame, square-ish crop, a time. */
export function polaroid(src, caption) {
  const c = document.createElement('canvas');
  c.width = 260; c.height = 300;
  const x = c.getContext('2d');
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 260, 300);
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, side = Math.min(sw, sh);
  x.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 14, 14, 232, 232);
  // flash-lit and a little washed out, like an instant photo
  x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,230,200,0.35)'; x.fillRect(14, 14, 232, 232);
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.strokeRect(14, 14, 232, 232);
  x.fillStyle = '#2a2230'; x.font = 'italic 22px "Comic Sans MS", "Marker Felt", cursive'; x.textAlign = 'center';
  x.fillText(caption, 130, 280);
  return c;
}

/**
 * The cinematic, drawn over a black screen: three panels of her last frames slide in tilted with
 * captions, then crack and fade. t in seconds; returns true while it's still playing.
 */
export function drawCinematic(ctx, w, h, t, shots) {
  ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, w, h);
  const pw = w * 0.36, ph = pw * (SNAP_H / SNAP_W), out = Math.max(0, (t - 3.6) / 1.2);
  for (let i = 0; i < 3; i++) {
    const ti = t - i * 0.75;
    if (ti <= 0) continue;
    const s = shots[shots.length - 3 + i] || shots[shots.length - 1];
    const ease = Math.min(1, ti / 0.35), cx = w * (0.22 + i * 0.28), cy = h * (0.42 + (i % 2) * 0.12);
    ctx.save();
    ctx.translate(cx + (1 - ease) * w * 0.4, cy);
    ctx.rotate((i - 1) * 0.08 + Math.sin(t * 3 + i) * 0.01 * (1 + out * 6));
    ctx.globalAlpha = Math.max(0, 1 - out);
    ctx.fillStyle = '#fff'; ctx.fillRect(-pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12);
    if (s) {
      ctx.drawImage(s, -pw / 2, -ph / 2, pw, ph);
      // the drug smears it: a magenta ghost off register, stronger with each panel
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.35 + i * 0.15;
      ctx.drawImage(s, -pw / 2 + 8 + i * 6, -ph / 2 - 4, pw, ph);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.max(0, 1 - out);
      ctx.fillStyle = `rgba(255,40,190,${0.18 + i * 0.1})`; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    } else { ctx.fillStyle = '#2a1030'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); }
    ctx.strokeStyle = '#05040a'; ctx.lineWidth = 6; ctx.strokeRect(-pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 12);
    // cracks once the panels start to go
    if (out > 0) {
      ctx.strokeStyle = '#05040a'; ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + i; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * pw * 0.6 * out, Math.sin(a) * ph * 0.6 * out); }
      ctx.stroke();
    }
    // caption box (yellow narrator, comic style)
    const cap = CAPTIONS[i];
    ctx.font = `bold ${Math.round(Math.max(13, h * 0.035))}px Bangers, Impact, sans-serif`;
    const tw = ctx.measureText(cap).width + 20;
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(-pw / 2 - 6, -ph / 2 - 40, tw, 30);
    ctx.strokeRect(-pw / 2 - 6, -ph / 2 - 40, tw, 30);
    ctx.fillStyle = '#05040a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(cap, -pw / 2 + 4, -ph / 2 - 25);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  return t < 5;
}

export const CINE_SECONDS = 5;
