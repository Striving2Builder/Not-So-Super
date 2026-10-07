// The fight's set indoors (the 3D club's back rooms: docs/design/nightclub.md "Brawls"): one of the
// user's painted side-on room plates (assets/nightclub/plates/: the restroom, the dark room, the
// alley) instead of the generated street. The plate's back-wall foot sits on the lane's back edge
// and its walk line on the front edge, tiled (mirrored every other tile) along the fight. The dark
// room is fought in strobe light: black between the flashes, but for a little light round her.
import { mk } from './brawlpaint.js';

const DIR = 'assets/nightclub/plates/';
// plate, its walk line and back-wall foot (fractions of its height), the floor colour below it
const PLATES = {
  restroom: ['restroom.jpg', 0.9, 0.64, '#0c1416'],
  dark: ['dark.jpg', 0.9, 0.64, '#05040a'],
  alley: ['alley.jpg', 0.9, 0.62, '#0c0c10'],
  storage: ['storage.jpg', 0.9, 0.66, '#121012'],
};
const STROBE = { every: 0.55, on: 0.1, dark: 0.9, light: 0.22 }; // seconds; darkness alpha; her light (fraction of the screen height)

export class PlateStage {
  constructor(b) {
    this.b = b;
    this.kind = b.zone.plate;
    const [src, lane, back, floor] = PLATES[this.kind] || PLATES.alley;
    Object.assign(this, { lane, back, floor });
    this.img = new Image();
    this.img.src = DIR + src;
    this.dpr = 1;
    this.flip = null;
  }

  /** No doorways crooks step out of: they come in from the edges. */
  doorNear() { return null; }

  drawBack(ctx, W, H, cam) {
    const b = this.b, img = this.img;
    ctx.fillStyle = this.floor; ctx.fillRect(0, 0, W, H);
    if (!img.complete || !img.naturalWidth) return;
    // scale so the plate's floor band spans the lane (back edge → walk line)
    const P = img.naturalHeight, s = (b.gb - b.gt) / ((this.lane - this.back) * P), top = b.gt - this.back * P * s;
    const TW = img.naturalWidth * s, tileWorld = TW / b.k;
    const x0 = cam - W / 2 / b.k, first = Math.floor(x0 / tileWorld);
    if (!this.flip) { this.flip = mk(img.naturalWidth, img.naturalHeight); const g = this.flip.getContext('2d'); g.translate(img.naturalWidth, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); }
    for (let i = first; i * tileWorld < x0 + W / b.k + tileWorld; i++) {
      const sx = W / 2 + (i * tileWorld - cam) * b.k;
      ctx.drawImage(Math.abs(i) % 2 ? this.flip : img, Math.floor(sx), top, Math.ceil(TW) + 1, P * s);
    }
  }

  drawFront() {}

  drawGrade(ctx, W, H) {
    const b = this.b;
    // vignette, like the street's: the eye goes to the lane
    const g = ctx.createRadialGradient(W / 2, H * 0.62, H * 0.35, W / 2, H * 0.62, W * 0.75);
    g.addColorStop(0, 'rgba(6,3,14,0)'); g.addColorStop(1, 'rgba(6,3,14,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (this.kind !== 'dark') return;
    // the dark room: black between the strobe's flashes, a little light round her
    const t = b.t || 0, on = (t % STROBE.every) < STROBE.on;
    if (on) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, W, H); return; }
    const hx = b.sx(b.p.x), hy = b.gy(b.p.z) - 60 * b.sc(b.p.z), r = H * STROBE.light;
    const d = ctx.createRadialGradient(hx, hy, r * 0.4, hx, hy, r);
    d.addColorStop(0, 'rgba(2,1,6,0)'); d.addColorStop(1, `rgba(2,1,6,${STROBE.dark})`);
    ctx.fillStyle = d; ctx.fillRect(0, 0, W, H);
  }
}
