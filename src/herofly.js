// Supergirl in the flight view: the rigged model rendered three-quarter from above (so she keeps
// volume at every heading: flying north reads as flying away, not as someone standing up), inked
// and rim-lit, with her shadow cast along the sun onto the street or the roof under her, and the
// comic "WHOOSH!" lettering when she kicks into a boost.
import { heroReady, HeroSprite } from './hero3d.js';
import { SUN, glow } from './cityart.js';
import { clamp } from './util.js';

const LOOK = {
  span: 3.4,        // sprite frame in metres (fits her fist-to-toe at any heading)
  unit: 40,         // art units per sprite metre
  tilt: 1.0,        // camera tilt from vertical (rad): matches the city's oblique lean
  aura: '#9fd8ff',
  pool: '#8fb8ff',   // the light pool around her shadow
  shadowA: 0.62,    // shadow opacity right under her; fades and softens with height
  pop: 0.9,         // seconds the WHOOSH! lettering stays up
};

/**
 * Her sprite, comic-inked: a dark outline all round, a warm rim of light on the sun side, and a
 * flat silhouette kept for her ground shadow. One read-back of the WebGL sprite per frame, then a
 * handful of cheap 2D blits at half resolution.
 */
export class InkSprite {
  constructor() { this.pad = 4; this.out = null; }

  ensure(w) {
    const S = w + this.pad * 2;
    if (this.out && this.out.width === S) return;
    const mk = (n) => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
    this.out = mk(S); this.shadow = mk(S >> 1); this.dil = mk(S >> 1); this.rim = mk(S >> 1);
  }

  /** lightAng: direction the light comes from, in sprite space (radians). Returns the inked canvas. */
  build(img, lightAng, rich, night) {
    this.ensure(img.width);
    const p = this.pad, S = this.out.width, h = S >> 1, hp = p / 2, hw = img.width / 2;
    const sg = this.shadow.getContext('2d');
    sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, h, h); sg.drawImage(img, hp, hp, hw, hw);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#05060f'; sg.fillRect(0, 0, h, h);
    const dg = this.dil.getContext('2d');
    dg.clearRect(0, 0, h, h);
    const r = rich ? 1.8 : 1.2, n = rich ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; dg.drawImage(this.shadow, Math.cos(a) * r, Math.sin(a) * r); }
    const og = this.out.getContext('2d');
    og.clearRect(0, 0, S, S);
    og.drawImage(this.dil, 0, 0, S, S);
    og.drawImage(img, p, p);
    if (rich) {
      // rim: silhouette minus itself nudged away from the light = a crescent on the lit edge
      const rg = this.rim.getContext('2d');
      rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, h, h);
      rg.fillStyle = night > 0.5 ? '#bfe6ff' : '#fff1c2'; rg.fillRect(0, 0, h, h);
      rg.globalCompositeOperation = 'destination-in'; rg.drawImage(this.shadow, 0, 0);
      rg.globalCompositeOperation = 'destination-out';
      rg.drawImage(this.shadow, -Math.cos(lightAng) * 1.6, -Math.sin(lightAng) * 1.6);
      og.globalAlpha = 0.85; og.drawImage(this.rim, 0, 0, S, S); og.globalAlpha = 1;
    }
    return this.out;
  }
}

export class FlightHero {
  constructor() { this.ink = new InkSprite(); this.sprite = null; this.pops = []; }

  get ready() { return heroReady(); }

  /** Boost kick: comic lettering bursts out behind her. */
  whoosh(ang) { this.pops.push({ t: 0, ang, word: Math.random() < 0.5 ? 'WHOOSH!' : 'ZOOM!' }); }

  update(dt) {
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < LOOK.pop);
  }

  /** On-screen size of the sprite frame for world scale `hs` (screen px per art unit). */
  size(hs) { return LOOK.span * LOOK.unit * hs; }

  /**
   * Her shadow, cast along the sun onto whatever is under that point (street or rooftop): it
   * slides away from her, shrinks and softens the higher she is above that surface.
   * `roofAt(x, y)` = tallest building footprint there (or null).
   */
  drawShadow(ctx, V, h, scale, roofAt) {
    const sil = this.ink.shadow;
    if (!sil || !this.sprite) return;
    const { SX, SY, k, P } = V;
    let zr = 0, x = h.x + h.z * SUN.x, y = h.y + h.z * SUN.y;
    const b = roofAt(x, y);
    if (b && b.h < h.z) { zr = b.h; x = h.x + (h.z - zr) * SUN.x; y = h.y + (h.z - zr) * SUN.y; }
    const above = h.z - zr;
    const full = this.size(k * P(zr) * scale) * (1 - clamp(above / 1500, 0, 0.4)) * sil.width / (sil.width - this.ink.pad);
    const a = LOOK.shadowA * clamp(1 - above / 1400, 0.45, 1);
    const blur = Math.min(8, 1 + above / 90) * k;
    ctx.save();
    ctx.translate(SX(x, zr), SY(y, zr)); ctx.scale(1, 0.8); // she's seen at an angle, the shadow isn't
    // A pool of pale light around the shadow (her aura on the surface below) so the dark shape
    // still reads on a night street; both shrink as she climbs.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.16 + 0.3 * V.night) * clamp(1 - above / 1600, 0.4, 1);
    ctx.drawImage(glow(LOOK.pool), -full * 0.62, -full * 0.62, full * 1.24, full * 1.24);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a * 0.45; ctx.drawImage(sil, -full / 2 - blur, -full / 2 - blur, full + blur * 2, full + blur * 2);
    ctx.globalAlpha = a * 0.75; ctx.drawImage(sil, -full / 2, -full / 2, full, full);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** Draw her at screen (x, y). o = { t, perch, diving, rich, night, px }. */
  draw(ctx, h, x, y, hs, o) {
    if (!this.sprite) this.sprite = new HeroSprite(o.px, o.px, { aa: false }); // ink hides jaggies; MSAA is costly on phones
    const sp = this.sprite;
    sp.setSize(o.px, o.px);
    if (h.perch) sp.hero.pose('idle', o.t);
    else {
      sp.hero.pose(o.diving ? 'jump' : 'fly', o.diving ? 0.9 : o.t);
      // fist punched forward while she's moving; arms relax as she slows into a hover
      if (!o.diving) sp.hero.superFly(1 - 0.8 * h.hover);
    }
    // Airspeed drives the cape: it streams behind her and lifts off her back.
    const air = 8 + h.speed / 45;
    sp.hero.setWind(Math.sin(o.t * 2.3) * 1.8, 10.5 * (1 - 0.6 * h.hover), -air);
    // Heading in 3D; bank into turns; pitch up into the upright hover only when she's stopped.
    const img = sp.render({
      view: 'aerial', tilt: LOOK.tilt, span: LOOK.span, yaw: Math.PI / 2 - h.ang,
      roll: h.perch ? 0 : h.bank * 0.5, pitch: h.perch ? 0 : h.hover * 1.15 - h.lean * 0.25,
    });
    const size = this.size(hs);
    const art = this.ink.build(img, Math.atan2(-1, -1), o.rich, o.night);
    const pad = this.ink.pad * (size / img.width);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.14 + 0.22 * o.night; // a soft aura so she separates from busy neon rooftops
    ctx.drawImage(glow(LOOK.aura), x - size * 0.4, y - size * 0.4, size * 0.8, size * 0.8);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(art, x - size / 2 - pad, y - size / 2 - pad, size + pad * 2, size + pad * 2);
  }

  /** Boost lettering, drawn in screen space behind her (opposite her heading). */
  drawPops(ctx, x, y, s) {
    for (const p of this.pops) {
      const e = p.t / LOOK.pop, grow = Math.min(1, p.t / 0.12);
      const sc = (0.6 + 0.6 * grow - 0.15 * Math.max(0, grow - 0.9)) * s;
      const d = 70 * s + e * 30 * s;
      ctx.save();
      ctx.globalAlpha = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
      ctx.translate(x - Math.cos(p.ang) * d, y - Math.sin(p.ang) * d - 18 * s);
      ctx.rotate(-0.18); ctx.scale(sc, sc);
      ctx.font = '40px Bangers, Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 9; ctx.strokeStyle = '#0b0b16'; ctx.strokeText(p.word, 0, 0);
      ctx.fillStyle = '#ffe23a'; ctx.fillText(p.word, 0, 0);
      ctx.lineWidth = 2; ctx.strokeStyle = '#e8321e'; ctx.strokeText(p.word, 0, 0);
      ctx.restore();
    }
  }
}
