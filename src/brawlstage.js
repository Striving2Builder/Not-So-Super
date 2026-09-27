// The street-fight set: sky, two parallax skyline layers, inked building facades, the sidewalk and
// road, street lamps, sidewalk clutter and foreground occluders, plus the light/vignette grade.
// Everything detailed is painted once into offscreen canvases (facades are baked lazily and evicted
// when they scroll away) so a frame is mostly drawImage calls: cheap on phones.
import { SIGN_WORDS } from './data.js';
import { glow } from './art.js';
import { shade, rgba, clamp } from './util.js';
import { RNG } from './rng.js';
import { quality } from './settings.js';

export const INK = '#15111c';
const TAGS = ['ZAP!', 'KRASH', 'CREW', 'BOOM', 'RATZ', 'WHAM', 'SK8', 'B-BOYZ', 'NO $$$', 'VANDL'];
const POSTERS = [['WANTED', '#f2e6c4', '#7a1f1f'], ['VOTE!', '#2a5ab8', '#fff'], ['LIVE!', '#e0402a', '#ffe14a'], ['SALE', '#ffe14a', '#d8122e'], ['LOST CAT', '#fff', '#222']];
const BILLBOARDS = [['DAILY CAPE', '#f2ead8', '#1e3cff'], ['FIZZ COLA', '#d8122e', '#fff'], ['HOT DOGS', '#ffe14a', '#d8122e'], ['CITY BANK', '#1a3a6a', '#ffd23f'], ['CAPE-TV', '#111', '#39c6ff']];

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

let dots = null;
/** Comic halftone dot pattern (tiny tile; the drawing transform scales it). */
function halftone(ctx) {
  if (!dots) {
    dots = mk(4, 4);
    const g = dots.getContext('2d');
    g.fillStyle = '#000'; g.beginPath(); g.arc(2, 2, 0.95, 0, Math.PI * 2); g.fill();
  }
  return ctx.createPattern(dots, 'repeat');
}

export class Stage {
  constructor(b) {
    this.b = b;
    this.D = b.D;
    this.st = b.D.style;
    this.rng = new RNG(b.zone.uid * 104729 + 7);
    this.cache = new Map();
    this.geomKey = '';
    this.build();
  }

  // ---------------------------------------------------------------- layout (world data)
  build() {
    const r = this.rng, D = this.D, st = this.st, len = this.b.len;
    this.facades = [];
    let x = -500;
    while (x < len + 700) {
      const wide = st === 'houses' || st === 'farm';
      const w = wide ? r.range(230, 320) : r.range(170, 290);
      const f = { x, w, h: r.range(170, 300), col: r.pick(D.pal), kind: st, sign: null, neon: D.neon ? r.pick(D.neon) : null, id: this.facades.length };
      if (st === 'shops' || (st === 'mixed' && r.chance(0.5)) || (st === 'apartments' && r.chance(0.35))) { f.sign = r.pick(SIGN_WORDS.shops); f.awn = r.pick(['#d8122e', '#1e7a4a', '#1e3cff', '#e0a020', '#8a2a8a']); }
      if (st === 'clubs') f.sign = r.pick(SIGN_WORDS[this.b.zone.district === 'redlight' ? 'redlight' : this.b.zone.district === 'naughty' ? 'naughty' : 'clubs']);
      if (st === 'casino') f.sign = r.pick(SIGN_WORDS.casino);
      if (st === 'venues') f.sign = r.pick(SIGN_WORDS.venues);
      if (st === 'lair') f.sign = r.chance(0.5) ? r.pick(SIGN_WORDS.lair) : null;
      if (st === 'towers') f.h = r.range(300, 440);
      if (st === 'houses') f.h = r.range(120, 160);
      if (st === 'farm') { f.h = r.range(130, 180); f.barn = r.chance(0.55); }
      if (st === 'docks') { f.h = r.range(60, 120); f.stack = r.int(1, 3); }
      if (st === 'warehouses' || st === 'factory') f.h = r.range(150, 220);
      f.escape = (st === 'apartments' || st === 'mixed') && r.chance(0.55);
      f.tag = r.chance(0.45) ? r.pick(TAGS) : null;
      f.tagCol = r.pick(['#ff3fa4', '#39e0ff', '#7dff4a', '#ffe14a', '#ff7a1a']);
      f.poster = r.chance(0.5) ? r.pick(POSTERS) : null;
      f.seed = r.int(1, 1e6);
      this.facades.push(f);
      x += w + (wide ? r.range(50, 130) : st === 'docks' ? r.range(20, 60) : r.range(0, 10));
    }
    // street furniture on the back edge of the sidewalk (never in the way)
    this.lamps = [];
    for (let lx = 140; lx < len + 500; lx += 460) this.lamps.push(lx + r.range(-40, 40));
    const PROPS = st === 'farm' ? ['hay', 'fence', 'hay'] : st === 'houses' ? ['hydrant', 'mailbox', 'tree', 'bin'] : st === 'docks' ? ['bollard', 'crate', 'bollard'] : st === 'warehouses' || st === 'factory' || st === 'lair' ? ['bags', 'bollard', 'crate', 'meter', 'hydrant'] : ['hydrant', 'newsbox', 'bags', 'bench', 'meter', 'tree'];
    this.props = [];
    for (let px = 60; px < len + 500; px += r.range(130, 240)) {
      if (this.lamps.some((l) => Math.abs(l - px) < 50)) continue;
      this.props.push({ x: px, kind: r.pick(PROPS) });
    }
    // foreground occluders: sparse, dark, fast parallax
    this.fg = [];
    // Frame the fights, never split them: one occluder near a screen edge of each locked fight camera
    // (parallax 1.4, so ~200 units off-centre lands ~40% out from the middle), one between fights.
    if (st !== 'farm' && st !== 'houses') this.b.waves.forEach((w, i) => {
      const cx = w.x + 80;
      this.fg.push({ x: cx + (i % 2 ? -1 : 1) * r.range(190, 215), kind: r.pick(['pole', 'pole', 'sign']) });
      this.fg.push({ x: cx + 330, kind: 'pole' });
    });
    this.skySeed = r.int(1, 1e6);
  }

  /** World x of a building doorway near x (within r), or null (docks/farm have none). */
  doorNear(x, r) {
    let best = null, bd = r;
    for (const f of this.facades) {
      const s = f.kind;
      if (s === 'docks' || s === 'farm') continue;
      const d = f.x + f.w * (s === 'warehouses' || s === 'factory' ? 0.41 : s === 'houses' ? 0.5 : 0.755);
      if (Math.abs(d - x) < bd) { bd = Math.abs(d - x); best = d; }
    }
    return best;
  }

  // ---------------------------------------------------------------- geometry & caches
  geom(W, H) {
    const dpr = Math.min(devicePixelRatio || 1, quality().dpr2d);
    const key = `${W}x${H}@${dpr}`;
    if (key !== this.geomKey) { this.geomKey = key; this.cache.clear(); this.facadeCache = new Map(); }
    this.dpr = dpr;
  }

  /** Cached canvas by key; `paint(ctx)` gets a context already scaled to CSS pixels. */
  cached(key, w, h, paint) {
    let c = this.cache.get(key);
    if (c) return c;
    c = mk(w * this.dpr, h * this.dpr);
    const g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paint(g);
    c.cssW = w; c.cssH = h;
    this.cache.set(key, c);
    return c;
  }

  // ---------------------------------------------------------------- per-frame drawing
  /** Everything behind the actors. */
  /**
   * Everything behind the actors. The static set is cached as one opaque screen layer whenever the
   * camera holds still (it's locked during every fight), so a fight frame costs one blit plus the
   * animated lights; while scrolling it's drawn layer by layer.
   */
  drawBack(ctx, W, H, cam, t, night) {
    this.geom(W, H);
    const nb = Math.round(night * 4) / 4, px = Math.round(cam * this.b.k * this.dpr);
    const key = px + '|' + nb + '|' + W + 'x' + H;
    if (this.bgKey !== key) {
      if (this.lastKey === key) {
        if (!this.bg) this.bg = mk(1, 1);
        if (this.bg.width !== Math.round(W * this.dpr) || this.bg.height !== Math.round(H * this.dpr)) { this.bg.width = Math.round(W * this.dpr); this.bg.height = Math.round(H * this.dpr); }
        const g = this.bg.getContext('2d');
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        this.drawStatic(g, W, H, cam, t, night);
        this.bgKey = key;
      } else { this.lastKey = key; this.bgKey = null; this.drawStatic(ctx, W, H, cam, t, night); }
    }
    if (this.bgKey === key) ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawLive(ctx, W, H, cam, t, night);
  }

  drawStatic(ctx, W, H, cam, t, night) {
    const b = this.b, k = b.k, gt = b.gt;
    // night is baked into every cached layer (bucketed), so there's no full-screen tint pass
    const nb = (this.nb = Math.round(night * 4) / 4);
    // Sky and skylines only show between/above facades: clip them to the gaps (saves fill on phones).
    const gaps = [];
    let cx = 0;
    const tall = this.facades
      .map((f) => ({ x0: W / 2 + (f.x - cam) * k, x1: W / 2 + (f.x + f.w - cam) * k, top: gt - (f.h + (f.kind === 'factory' ? 0 : 4)) * k }))
      .filter((f) => f.top <= 0 && f.x1 > 0 && f.x0 < W)
      .sort((a, c) => a.x0 - c.x0);
    for (const f of tall) { if (f.x0 > cx + 1) gaps.push([cx, f.x0 + 1]); cx = Math.max(cx, f.x1 - 1); }
    if (cx < W) gaps.push([cx, W]);
    if (gaps.length) {
      ctx.save();
      ctx.beginPath(); for (const [x0, x1] of gaps) ctx.rect(x0, -30, x1 - x0, gt + 34); ctx.clip();
      ctx.drawImage(this.cached(`sky${nb}`, W, Math.ceil(gt) + 4, (g) => { this.paintSky(g, W, gt + 4, nb); this.tint(g, nb); }), 0, 0, W, Math.ceil(gt) + 4);
      // skyline layers (tiles repeat; parallax 0.18 and 0.42)
      for (const [layer, par] of [[0, 0.18], [1, 0.42]]) {
        const tw = Math.ceil(W * 1.6);
        const tile = this.cached(`sl${layer}${nb}`, tw, Math.ceil(gt) + 2, (g) => { this.paintSkyline(g, tw, gt, layer, nb); this.tint(g, nb); });
        const off = -(((cam * k * par) % tw) + tw) % tw;
        for (let x = off; x < W; x += tw) ctx.drawImage(tile, x, 0, tw, Math.ceil(gt) + 2);
      }
      if (this.st === 'docks') {
        const wg = ctx.createLinearGradient(0, gt - 70 * k, 0, gt);
        wg.addColorStop(0, night > 0.5 ? '#12305a' : '#2f7ab0'); wg.addColorStop(1, night > 0.5 ? '#0a1a33' : '#1d4f7a');
        ctx.fillStyle = wg; ctx.fillRect(0, gt - 70 * k, W, 70 * k);
      }
      ctx.restore();
    }
    // facades
    const lit = night > 0.4;
    for (const f of this.facades) {
      const x = W / 2 + (f.x - cam) * k;
      if (x > W + 90 * k || x + (f.w + 90) * k < 0) { if (this.facadeCache.has(f)) this.facadeCache.delete(f); continue; }
      let fc = this.facadeCache.get(f);
      if (!fc || fc.lit !== lit || fc.nb !== nb) { fc = this.bakeFacade(f, lit, nb); this.facadeCache.set(f, fc); }
      ctx.drawImage(fc.c, x - fc.padX * k, gt - fc.top * k, fc.c.width / this.dpr, fc.c.height / this.dpr);
    }
    // ground (wall-contact shadow baked in)
    const tileW = Math.ceil(420 * k);
    const gtile = this.cached(`ground${nb}`, tileW, Math.ceil(H - gt) + 2, (g) => { this.paintGround(g, tileW, H - gt, k); this.tint(g, nb); });
    const goff = -(((cam * k) % tileW) + tileW) % tileW;
    for (let x = goff; x < W; x += tileW) ctx.drawImage(gtile, x, gt, tileW, Math.ceil(H - gt) + 2);
    // props + lamp posts (back edge of the sidewalk)
    for (const p of this.props) {
      const x = W / 2 + (p.x - cam) * k;
      if (x < -80 * k || x > W + 80 * k) continue;
      const spr = this.propSprite(p.kind, k);
      ctx.drawImage(spr, x - spr.cssW / 2, gt + 9 * k - spr.cssH, spr.cssW, spr.cssH);
    }
    for (const lx of this.lamps) {
      const x = W / 2 + (lx - cam) * k;
      if (x < -120 * k || x > W + 120 * k) continue;
      const spr = this.propSprite('lamp', k);
      ctx.drawImage(spr, x - spr.cssW / 2, gt + 6 * k - spr.cssH, spr.cssW, spr.cssH);
    }
    this.drawLamps(ctx, W, H, cam, night);
  }

  /** Animated light on top of the set: neon breathing/flicker, lamp heads, cones and pools. */
  drawLive(ctx, W, H, cam, t, night) {
    const b = this.b, k = b.k, gt = b.gt, lit = night > 0.4;
    if (lit) for (const f of this.facades) {
      const fc = this.facadeCache.get(f);
      if (!fc || !fc.neon) continue;
      const x = W / 2 + (f.x - cam) * k;
      if (fc.neon && lit) {
        const on = Math.sin(t * 7 + f.id * 3.1) > -0.9 ? 1 : 0.25;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.55 + Math.sin(t * 2.3 + f.id) * 0.12) * on;
        const gw = fc.neon.w * k * 1.6, gh = 70 * k;
        ctx.drawImage(glow(f.neon), x + fc.neon.x * k - gw / 2, gt + fc.neon.y * k - gh / 2, gw, gh);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** Night lamp heads, light cones and pools on the pavement (static, so part of the cached layer). */
  drawLamps(ctx, W, H, cam, night) {
    const k = this.b.k, gt = this.b.gt;
    if (night > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const lx of this.lamps) {
        const x = W / 2 + (lx - cam) * k;
        if (x < -200 * k || x > W + 200 * k) continue;
        const hx = x + 26 * k, hy = gt + 6 * k - 196 * k;
        ctx.globalAlpha = 0.85 * night; ctx.drawImage(glow('#ffd070'), hx - 40 * k, hy - 34 * k, 80 * k, 68 * k);
        // cone + pool on the pavement
        ctx.globalAlpha = 0.14 * night;
        ctx.fillStyle = '#ffcf70';
        ctx.beginPath(); ctx.moveTo(hx - 8 * k, hy + 6 * k); ctx.lineTo(hx + 8 * k, hy + 6 * k); ctx.lineTo(hx + 95 * k, gt + 95 * k); ctx.lineTo(hx - 95 * k, gt + 95 * k); ctx.fill();
        ctx.globalAlpha = 0.5 * night;
        ctx.drawImage(glow('#ffb850'), hx - 150 * k, gt + 30 * k, 300 * k, 110 * k);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Night grade painted into a cached layer (only where it has pixels). */
  tint(g, nb, extra = 0) {
    if (nb <= 0) return;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(14,10,46,${Math.min(0.8, (0.42 + extra) * nb)})`;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.restore();
  }

  /** Dark occluders that pass in front of the fight (parallax 1.4), faded when someone's behind them. */
  drawFront(ctx, W, H, cam, actors) {
    const k = this.b.k, par = 1.4, ks = k * par;
    for (const o of this.fg) {
      const x = W / 2 + (o.x - cam) * ks;
      if (x < -60 * ks || x > W + 60 * ks) continue;
      const near = actors.some((a) => Math.abs(a - x) < 60 * k);
      ctx.globalAlpha = near ? 0.7 : 0.97;
      const spr = this.propSprite('fg_' + o.kind, ks);
      ctx.drawImage(spr, x - spr.cssW / 2, H + 12 * ks - spr.cssH, spr.cssW, spr.cssH);
    }
    ctx.globalAlpha = 1;
  }

  /** Final grade: vignette + a top shade that pushes the eye down onto the lane. */
  drawGrade(ctx, W, H, night) {
    // edge bands only: the middle of the screen is left untouched (no full-screen blend pass)
    const a = 0.5 + night * 0.15, sw = Math.round(W * 0.14), th = Math.round(H * 0.3), bh = Math.round(H * 0.12);
    const band = (key, w, h, x0, y0, x1, y1, a0) => this.cached(key + Math.round(night * 4), w, h, (g) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(8,4,20,${a0})`); gr.addColorStop(1, 'rgba(8,4,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    ctx.drawImage(band('vt', W, th, 0, 0, 0, th, 0.5), 0, 0, W, th);
    ctx.drawImage(band('vb', W, bh, 0, bh, 0, 0, a * 0.7), 0, H - bh, W, bh);
    const side = band('vs', sw, H - th - bh, 0, 0, sw, 0, a);
    ctx.drawImage(side, 0, th, sw, H - th - bh);
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(side, 0, th, sw, H - th - bh); ctx.restore();
  }

  // ---------------------------------------------------------------- painters (run once)
  paintSky(g, W, h, night) {
    const day = 1 - night;
    const top = night > 0.5 ? '#070a26' : night > 0 ? '#3b2e6e' : '#2f7fd4';
    const hor = night > 0.5 ? '#46255e' : night > 0 ? '#ff9a5a' : '#ffdca0';
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, top); sky.addColorStop(0.7, night > 0.5 ? '#2a1a4a' : shade(hor, -0.05)); sky.addColorStop(1, hor);
    g.fillStyle = sky; g.fillRect(0, 0, W, h);
    const r = new RNG(this.skySeed);
    if (night > 0.5) {
      g.fillStyle = '#fff';
      for (let i = 0; i < 70; i++) { g.globalAlpha = r.range(0.3, 0.9); const s = r.chance(0.1) ? 2.2 : 1.2; g.fillRect(r.range(0, W), r.range(0, h * 0.7), s, s); }
      g.globalAlpha = 1;
      // comic moon: flat disc, ink rim, halftone crescent shade
      const mx = W * 0.78, my = h * 0.22, mr = h * 0.13;
      g.globalAlpha = 0.35; g.drawImage(glow('#b8c8ff'), mx - mr * 3, my - mr * 3, mr * 6, mr * 6); g.globalAlpha = 1;
      g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.save(); g.clip(); g.fillStyle = halftone(g); g.globalAlpha = 0.25; g.beginPath(); g.arc(mx + mr * 0.5, my - mr * 0.2, mr, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.stroke();
    } else {
      // sun glow + inked cartoon clouds
      g.globalAlpha = 0.6 * day + 0.2; g.drawImage(glow(night > 0 ? '#ff8a4a' : '#fff4c0'), W * 0.1, -h * 0.3, h * 1.4, h * 1.4); g.globalAlpha = 1;
      for (let i = 0; i < 5; i++) {
        const cx = r.range(0, W), cy = r.range(h * 0.12, h * 0.5), s = r.range(0.6, 1.3) * h * 0.1;
        g.fillStyle = night > 0 ? '#ffd0b0' : '#ffffff'; g.strokeStyle = rgba('#3a4a8a', 0.5); g.lineWidth = 1.5;
        g.beginPath();
        for (const [dx, dy, rr] of [[-1.6, 0.3, 0.8], [-0.7, -0.2, 1.1], [0.4, -0.35, 1.25], [1.5, 0.2, 0.85], [0, 0.4, 0.9]]) g.moveTo(cx + dx * s + rr * s, cy + dy * s), g.arc(cx + dx * s, cy + dy * s, rr * s, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = rgba('#8aa0d8', 0.35); g.fillRect(cx - 2.4 * s, cy + 0.55 * s, 4.8 * s, 0.5 * s);
      }
    }
  }

  /** Farm / suburb horizon: rolling hills far back, an inked treeline with the odd silo or water tower. */
  paintCountry(g, W, gt, far, night, r) {
    const k = this.b.k, dark = night > 0.5;
    const col = far ? (dark ? '#1e2a44' : '#8fb88a') : (dark ? '#142018' : '#4f8a44');
    g.fillStyle = col; g.strokeStyle = rgba(INK, far ? 0.25 : 0.6); g.lineWidth = far ? 1 : 1.6;
    g.beginPath(); g.moveTo(0, gt + 2);
    if (far) {
      const a1 = r.range(0.004, 0.008), a2 = r.range(0.011, 0.02), ph = r.range(0, 6);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, gt - 44 * k - Math.sin(x * a1 / k + ph) * 22 * k - Math.sin(x * a2 / k) * 9 * k);
    } else {
      let x = 0;
      while (x <= W + 20) { const rr = r.range(10, 20) * k; g.arc(x, gt - 18 * k - r.range(0, 12) * k, rr, Math.PI, 0); x += rr * 1.4; }
    }
    g.lineTo(W, gt + 2); g.closePath(); g.fill(); g.stroke();
    if (far) {
      // field stripes on the hills
      g.save(); g.clip(); g.fillStyle = dark ? 'rgba(255,255,255,.03)' : 'rgba(255,240,160,.18)';
      for (let x = -W; x < W * 2; x += 36 * k) { g.beginPath(); g.moveTo(x, gt); g.lineTo(x + 18 * k, gt); g.lineTo(x + 70 * k, gt - 120 * k); g.lineTo(x + 52 * k, gt - 120 * k); g.fill(); }
      g.restore();
    } else {
      for (let x = r.range(40, 200); x < W; x += r.range(260, 480)) {
        const sil = r.chance(0.5), c2 = dark ? '#1c2230' : '#9aa4ae';
        g.fillStyle = c2; g.strokeStyle = INK; g.lineWidth = 1.5;
        if (sil) { g.beginPath(); g.rect(x, gt - 90 * k, 22 * k, 90 * k); g.fill(); g.stroke(); g.beginPath(); g.arc(x + 11 * k, gt - 90 * k, 11 * k, Math.PI, 0); g.fill(); g.stroke(); }
        else { g.beginPath(); g.rect(x + 6 * k, gt - 60 * k, 3 * k, 60 * k); g.rect(x + 25 * k, gt - 60 * k, 3 * k, 60 * k); g.fill(); g.beginPath(); g.ellipse(x + 17 * k, gt - 72 * k, 18 * k, 13 * k, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
        if (dark && r.chance(0.6)) { g.fillStyle = '#ffd98a'; g.fillRect(x + 8 * k, gt - 40 * k, 4 * k, 5 * k); }
      }
    }
  }

  paintSkyline(g, W, gt, layer, night) {
    const r = new RNG(this.skySeed + layer * 977);
    const far = layer === 0;
    const base = night > 0.5 ? (far ? '#241c4a' : '#18142e') : (far ? '#8da4c8' : '#6a7ea0');
    const lit = night > 0.4;
    const k = this.b.k;
    if (this.st === 'farm' || this.st === 'houses') return this.paintCountry(g, W, gt, far, night, r);
    let x = -20;
    while (x < W + 20) {
      const w = r.range(far ? 30 : 50, far ? 80 : 120) * k * 0.7;
      const h = r.range(far ? 60 : 50, far ? 200 : 150) * k * 0.7 + (far ? 30 : 0);
      const top = gt - h;
      g.fillStyle = base; g.fillRect(x, top, w, h + 2);
      if (!far) {
        g.strokeStyle = rgba(INK, 0.5); g.lineWidth = 1.2; g.strokeRect(x + 0.5, top + 0.5, w, h + 2);
        // roof clutter: water tower / antenna / billboard
        const roll = r.next();
        if (roll < 0.25) {
          g.fillStyle = shade(base, -0.15);
          g.fillRect(x + w * 0.3, top - 16 * k, 3, 16 * k); g.fillRect(x + w * 0.6, top - 16 * k, 3, 16 * k);
          g.beginPath(); g.moveTo(x + w * 0.22, top - 16 * k); g.lineTo(x + w * 0.45, top - 30 * k); g.lineTo(x + w * 0.72, top - 16 * k); g.fill();
          g.fillRect(x + w * 0.24, top - 17 * k, w * 0.46, 14 * k * 0.9);
        } else if (roll < 0.45) {
          const [txt, bg, fg] = r.pick(BILLBOARDS);
          const bw = Math.min(w * 1.2, 90 * k), bh = 26 * k, bx = x + w / 2 - bw / 2, by = top - bh - 8 * k;
          g.fillStyle = shade(base, -0.2); g.fillRect(bx + bw * 0.2, by + bh, 2, 8 * k); g.fillRect(bx + bw * 0.8, by + bh, 2, 8 * k);
          g.fillStyle = night > 0.5 ? shade(bg, -0.45) : shade(bg, -0.15); g.fillRect(bx, by, bw, bh);
          g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(bx, by, bw, bh);
          g.fillStyle = night > 0.5 ? shade(fg, -0.3) : fg; g.font = `900 ${bh * 0.55}px Impact, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(txt, bx + bw / 2, by + bh / 2 + 1, bw * 0.9);
        } else if (roll < 0.6) { g.fillStyle = shade(base, -0.1); g.fillRect(x + w * 0.5, top - 26 * k, 2, 26 * k); }
      }
      // windows: scattered lit dots at night, faint panes by day
      const ww = far ? 3 : 4.5, gap = far ? 7 : 10;
      for (let yy = top + 6; yy < gt - 6; yy += gap) for (let xx = x + 4; xx < x + w - 4; xx += gap) {
        if (lit ? r.chance(far ? 0.28 : 0.35) : r.chance(0.5)) {
          g.fillStyle = lit ? r.pick(['#ffd98a', '#ffe8b0', '#9fe8ff']) : rgba('#ffffff', far ? 0.18 : 0.14);
          g.fillRect(xx, yy, ww, ww * 1.3);
        }
      }
      x += w + r.range(-4, far ? 6 : 14);
    }
    // haze toward the horizon (aerial perspective)
    const hz = g.createLinearGradient(0, gt - 140 * k, 0, gt);
    const hc = night > 0.5 ? '#3a2356' : '#ffd8a8';
    hz.addColorStop(0, rgba(hc, 0)); hz.addColorStop(1, rgba(hc, far ? 0.55 : 0.3));
    g.fillStyle = hz; g.fillRect(0, gt - 140 * k, W, 140 * k + 2);
  }

  paintGround(g, TW, h, k) {
    const st = this.st, b = this.b;
    const walk = (b.gb - b.gt) * 0.24; // sidewalk depth in px (lane z 0..0.24)
    const r = new RNG(this.skySeed + 31);
    const dirt = st === 'farm';
    // sidewalk
    g.fillStyle = dirt ? '#8a7650' : st === 'houses' ? '#bdb8ad' : '#9a958b';
    g.fillRect(0, 0, TW, walk);
    if (!dirt) {
      // slabs with oblique joints (reads as depth without a vanishing point)
      const sw = 46 * k;
      for (let x = -sw; x < TW + sw; x += sw) {
        g.fillStyle = r.chance(0.5) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, 0); g.lineTo(x + sw + walk * 0.35, walk); g.lineTo(x + walk * 0.35, walk); g.fill();
        g.strokeStyle = 'rgba(40,34,44,.45)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + walk * 0.35, walk); g.stroke();
      }
      g.strokeStyle = 'rgba(40,34,44,.3)'; g.beginPath(); g.moveTo(0, walk * 0.5); g.lineTo(TW, walk * 0.5); g.stroke();
    } else {
      g.fillStyle = '#6d8a3a'; for (let i = 0; i < 40; i++) { const x = r.range(0, TW), y = r.range(0, walk); g.fillRect(x, y, 2, -r.range(3, 7)); }
    }
    for (let i = 0; i < 120; i++) { g.fillStyle = r.chance(0.5) ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)'; g.fillRect(r.range(0, TW), r.range(0, walk), 1.5, 1.5); }
    // wall-contact shadow along the back of the sidewalk
    const ao = g.createLinearGradient(0, 0, 0, 16 * k);
    ao.addColorStop(0, 'rgba(10,8,20,.55)'); ao.addColorStop(1, 'rgba(10,8,20,0)');
    g.fillStyle = ao; g.fillRect(0, 0, TW, 16 * k);
    // curb: lit top face, dark riser, ink line, gutter
    const cy = walk;
    if (!dirt) {
      g.fillStyle = '#c9c4b8'; g.fillRect(0, cy - 3 * k, TW, 3 * k);
      g.fillStyle = '#5e5a58'; g.fillRect(0, cy, TW, 5 * k);
      g.fillStyle = INK; g.fillRect(0, cy - 3 * k, TW, 1.2); g.fillRect(0, cy + 5 * k, TW, 1.4);
    }
    // road
    const ry = cy + (dirt ? 0 : 5 * k);
    const road = g.createLinearGradient(0, ry, 0, h);
    road.addColorStop(0, dirt ? '#7a6644' : '#2e2f36'); road.addColorStop(1, dirt ? '#8e7850' : '#40414a');
    g.fillStyle = road; g.fillRect(0, ry, TW, h - ry + 2);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, ry, TW, 6 * k); // gutter shade
    for (let i = 0; i < 700; i++) {
      g.fillStyle = r.chance(0.55) ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.07)';
      const s = r.range(1, 2.4); g.fillRect(r.range(0, TW), r.range(ry, h), s, s);
    }
    if (!dirt) {
      // patches, cracks, a manhole, oil
      for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(r.range(0, TW - 80 * k), r.range(ry + 10, h - 30), r.range(40, 90) * k, r.range(14, 30) * k); }
      g.strokeStyle = 'rgba(10,8,14,.55)'; g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        let x = r.range(0, TW), y = r.range(ry + 10, h - 10);
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 5; j++) { x += r.range(-14, 14) * k; y += r.range(-5, 5) * k; g.lineTo(x, y); }
        g.stroke();
      }
      const mx = r.range(60, TW - 60) * 1, my = ry + (h - ry) * 0.78;
      g.fillStyle = '#26262c'; g.beginPath(); g.ellipse(mx, my, 26 * k, 8 * k, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
      for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(mx - 20 * k, my + j * 2.6 * k); g.lineTo(mx + 20 * k, my + j * 2.6 * k); g.stroke(); }
      g.fillStyle = 'rgba(60,20,90,.18)'; g.beginPath(); g.ellipse(r.range(0, TW), ry + (h - ry) * 0.45, 30 * k, 7 * k, 0, 0, Math.PI * 2); g.fill();
      // lane dashes at z≈0.64 with an ink edge
      const dy = (b.gb - b.gt) * 0.64, dash = 70 * k;
      for (let x = 0; x < TW; x += dash * 2) {
        g.fillStyle = '#e8c84a'; g.fillRect(x, dy, dash, 4.5 * k);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, dy + 4.5 * k, dash, 1.5);
      }
    } else {
      g.strokeStyle = 'rgba(60,44,24,.45)'; g.lineWidth = 3 * k;
      for (const f of [0.45, 0.78]) { g.beginPath(); g.moveTo(0, ry + (h - ry) * f); g.lineTo(TW, ry + (h - ry) * f); g.stroke(); }
    }
  }

  /** Small cached sprites for props; size in CSS px on cssW/cssH. */
  propSprite(kind, k) {
    const nb = kind.startsWith('fg_') ? 0 : this.nb || 0;
    const key = 'p_' + kind + k.toFixed(3) + '_' + nb;
    const S = {
      lamp: [70, 206], hydrant: [26, 34], newsbox: [26, 40], bags: [44, 26], bench: [70, 30], meter: [12, 46], tree: [70, 150], mailbox: [22, 44], bin: [26, 36], hay: [60, 40], fence: [90, 34], bollard: [22, 24], crate: [40, 40],
      fg_pole: [34, 330], fg_hydrant: [50, 70], fg_cone: [40, 52], fg_sign: [60, 330], fg_post: [26, 120],
    }[kind] || [30, 30];
    const w = S[0] * k, h = S[1] * k;
    return this.cached(key, w, h, (g) => { g.save(); g.scale(k, k); g.lineJoin = 'round'; this.paintProp(g, kind, S[0], S[1]); g.restore(); this.tint(g, nb); });
  }

  paintProp(g, kind, w, h) {
    const ink = (lw = 1.6) => { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
    const box = (x, y, bw, bh, col, lw = 1.6) => { g.beginPath(); g.rect(x, y, bw, bh); g.fillStyle = col; g.fill(); ink(lw); };
    const cx = w / 2;
    const fgc = '#0d0b14';
    switch (kind) {
      case 'lamp': {
        box(cx - 3.5, 20, 7, h - 20, '#2d3340');
        box(cx - 6, h - 16, 12, 16, '#262b36');
        g.beginPath(); g.moveTo(cx, 22); g.quadraticCurveTo(cx + 2, 6, cx + 26, 8); g.strokeStyle = '#2d3340'; g.lineWidth = 5; g.stroke();
        g.beginPath(); g.moveTo(cx + 16, 6); g.lineTo(cx + 36, 6); g.lineTo(cx + 32, 14); g.lineTo(cx + 20, 14); g.closePath(); g.fillStyle = '#2d3340'; g.fill(); ink(1.4);
        g.fillStyle = '#fff2c0'; g.fillRect(cx + 21, 13, 10, 3);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(cx - 2, 24, 2, h - 44);
        break;
      }
      case 'hydrant':
        box(cx - 7, 10, 14, h - 14, '#d8262e'); box(cx - 10, h - 6, 20, 6, '#a81c22');
        g.beginPath(); g.arc(cx, 10, 7, Math.PI, 0); g.fillStyle = '#d8262e'; g.fill(); ink();
        box(cx - 12, 16, 24, 5, '#b81f26'); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(cx - 4, 12, 2.5, h - 20);
        break;
      case 'newsbox':
        box(2, 4, w - 4, h - 10, '#1e3cff'); box(5, 8, w - 10, 12, '#dfe8f0'); g.fillStyle = INK; g.font = '900 6px system-ui'; g.textAlign = 'center'; g.fillText('NEWS', cx, 29);
        g.fillRect(5, h - 6, 3, 6); g.fillRect(w - 8, h - 6, 3, 6);
        break;
      case 'bags':
        for (const [x, r0, c] of [[12, 11, '#1b1b22'], [30, 12, '#23232c'], [22, 9, '#2c2c36']]) { g.beginPath(); g.ellipse(x, h - r0, r0, r0, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); ink(1.3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x - 4, h - r0 * 1.6, 3, 3); }
        break;
      case 'bench':
        box(4, 6, w - 8, 5, '#8a5a34'); box(4, 14, w - 8, 5, '#8a5a34'); box(8, 19, 4, 11, '#333'); box(w - 12, 19, 4, 11, '#333');
        break;
      case 'meter':
        box(cx - 1.5, 16, 3, h - 16, '#555'); box(cx - 5, 2, 10, 15, '#6a7a80'); g.fillStyle = '#cfe'; g.fillRect(cx - 3, 5, 6, 5);
        break;
      case 'tree':
        box(cx - 4, 70, 8, h - 80, '#5a3a24'); box(cx - 16, h - 12, 32, 12, '#6a6a6a');
        for (const [x, y, r0, c] of [[cx - 18, 52, 22, '#2f7a3a'], [cx + 16, 48, 24, '#2a6e34'], [cx, 28, 28, '#3a8a44'], [cx - 4, 60, 20, '#276a30']]) { g.beginPath(); g.arc(x, y, r0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); ink(1.5); }
        g.fillStyle = 'rgba(255,255,160,.18)'; g.beginPath(); g.arc(cx + 6, 20, 12, 0, Math.PI * 2); g.fill();
        break;
      case 'mailbox':
        box(cx - 1.5, 20, 3, h - 20, '#444'); g.beginPath(); g.moveTo(2, 22); g.lineTo(2, 10); g.arc(cx, 10, cx - 2, Math.PI, 0); g.lineTo(w - 2, 22); g.closePath(); g.fillStyle = '#2a5ab8'; g.fill(); ink();
        break;
      case 'bin': box(3, 6, w - 6, h - 6, '#4a6a4a'); box(1, 2, w - 2, 6, '#5a7a5a'); break;
      case 'hay':
        g.beginPath(); g.ellipse(cx, h - 18, cx - 2, 18, 0, 0, Math.PI * 2); g.fillStyle = '#d8b44a'; g.fill(); ink();
        g.strokeStyle = 'rgba(120,80,20,.5)'; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(cx, h - 18, (cx - 2) * (0.3 + Math.abs(i) * 0.15), 16, 0, 0, Math.PI * 2); g.stroke(); }
        break;
      case 'fence':
        for (let x = 4; x < w; x += 20) box(x, 4, 5, h - 4, '#9a7a4a', 1.3);
        box(0, 10, w, 4, '#8a6a3a', 1.3); box(0, 22, w, 4, '#8a6a3a', 1.3);
        break;
      case 'bollard': box(cx - 7, 6, 14, h - 6, '#2a2a2a'); g.fillStyle = '#f2c21a'; g.fillRect(cx - 7, 9, 14, 3); break;
      case 'crate': box(2, 2, w - 4, h - 4, '#a07040'); g.beginPath(); g.moveTo(2, 2); g.lineTo(w - 2, h - 2); g.moveTo(w - 2, 2); g.lineTo(2, h - 2); ink(1.6); break;
      // foreground silhouettes (drawn dark, with a thin cool rim so they still read as objects)
      case 'fg_pole': case 'fg_sign':
        g.fillStyle = fgc; g.fillRect(cx - 7, 0, 14, h);
        g.fillStyle = 'rgba(120,150,220,.35)'; g.fillRect(cx + 5, 0, 2, h);
        if (kind === 'fg_sign') { g.fillStyle = fgc; g.fillRect(cx - 28, 40, 56, 34); g.fillStyle = 'rgba(120,150,220,.3)'; g.fillRect(cx - 28, 40, 56, 2); }
        g.fillStyle = fgc; g.fillRect(cx - 11, h - 40, 22, 40);
        break;
      case 'fg_hydrant':
        g.fillStyle = fgc; g.beginPath(); g.arc(cx, 18, 13, Math.PI, 0); g.fillRect(cx - 13, 18, 26, h - 18); g.fill(); g.fillRect(cx - 20, 28, 40, 10);
        g.fillStyle = 'rgba(255,90,90,.35)'; g.fillRect(cx + 10, 18, 2, h - 18);
        break;
      case 'fg_cone':
        g.fillStyle = fgc; g.beginPath(); g.moveTo(cx - 5, 0); g.lineTo(cx + 5, 0); g.lineTo(cx + 16, h - 8); g.lineTo(cx - 16, h - 8); g.fill(); g.fillRect(0, h - 8, w, 8);
        g.fillStyle = 'rgba(255,140,40,.45)'; g.fillRect(cx - 9, h * 0.45, 18, 5);
        break;
      case 'fg_post': g.fillStyle = fgc; g.fillRect(cx - 6, 0, 12, h); g.fillRect(0, 20, w, 6); break;
    }
  }

  // ---------------------------------------------------------------- facades
  bakeFacade(f, lit, nb = 0) {
    const k = this.b.k, dpr = this.dpr, gt = this.b.gt;
    // tight bounds: transparent padding still costs fill on every frame
    const st = f.kind;
    const padX = st === 'farm' ? 64 : st === 'houses' ? 24 : 6;
    const top = Math.min(f.h + (st === 'factory' ? 125 : st === 'farm' ? 25 : 8), gt / k + 16);
    const c = mk((f.w + padX * 2) * k * dpr, (top + 4) * k * dpr);
    const g = c.getContext('2d');
    g.setTransform(k * dpr, 0, 0, k * dpr, padX * k * dpr, top * k * dpr);
    g.lineJoin = 'round';
    const out = { c, padX, top, lit, nb, neon: null };
    this.paintFacade(g, f, lit, out);
    this.tint(g, nb);
    return out;
  }

  paintFacade(g, f, lit, out) {
    const w = f.w, h = f.h, st = f.kind, r = new RNG(f.seed);
    const ink = (lw = 1.6) => { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); };
    const box = (x, y, bw, bh, col, lw = 1.6) => { g.beginPath(); g.rect(x, y, bw, bh); g.fillStyle = col; g.fill(); if (lw) ink(lw); };
    const tone = (x, y, bw, bh, a = 0.22) => { g.save(); g.globalAlpha = a; g.fillStyle = halftone(g); g.fillRect(x, y, bw, bh); g.restore(); };
    const win = (x, y, ww, wh, on) => {
      box(x - 1.5, y - 1.5, ww + 3, wh + 3, shade(f.col, 0.25), 1.2);
      if (on) { g.fillStyle = r.pick(['#ffd98a', '#ffe7b0', '#ffc070']); g.fillRect(x, y, ww, wh); if (r.chance(0.3)) { g.fillStyle = 'rgba(60,30,40,.55)'; g.beginPath(); g.arc(x + ww * 0.5, y + wh * 0.62, ww * 0.18, 0, Math.PI * 2); g.fillRect(x + ww * 0.3, y + wh * 0.72, ww * 0.4, wh * 0.3); g.fill(); } }
      else {
        const gl = g.createLinearGradient(x, y, x, y + wh);
        gl.addColorStop(0, lit ? '#2a3050' : '#bfe0f8'); gl.addColorStop(1, lit ? '#141828' : '#5a86b8');
        g.fillStyle = gl; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x + ww * 0.15, y + wh); g.lineTo(x + ww * 0.45, y); g.lineTo(x + ww * 0.6, y); g.lineTo(x + ww * 0.3, y + wh); g.fill();
      }
      if (r.chance(0.35)) { g.fillStyle = rgba(r.pick(['#d8122e', '#ffffff', '#2a5ab8', '#e0a020']), 0.75); g.fillRect(x, y, ww, wh * 0.28); } // blinds/curtain
      g.beginPath(); g.rect(x, y, ww, wh); ink(1.2);
      g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.strokeStyle = shade(f.col, 0.25); g.lineWidth = 1.2; g.stroke();
      box(x - 3, y + wh + 1.5, ww + 6, 3, shade(f.col, 0.35), 1);
    };

    if (st === 'houses') {
      box(-20, -18, w + 60, 18, '#5f8a4a', 0); // lawn strip
      box(0, -h * 0.65, w, h * 0.65 - 18, f.col);
      tone(0, -h * 0.65, w * 0.18, h * 0.65 - 18, 0.18);
      g.beginPath(); g.moveTo(-14, -h * 0.63); g.lineTo(w / 2, -h); g.lineTo(w + 14, -h * 0.63); g.closePath(); g.fillStyle = '#6a3a2a'; g.fill(); ink(1.8);
      g.save(); g.clip(); tone(w / 2, -h, w, h * 0.4, 0.25); g.restore();
      win(w * 0.14, -h * 0.5, w * 0.2, h * 0.17, lit && r.chance(0.7)); win(w * 0.66, -h * 0.5, w * 0.2, h * 0.17, lit && r.chance(0.6));
      box(w * 0.43, -h * 0.42, w * 0.14, h * 0.42 - 18, '#6b3a24'); g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w * 0.54, -h * 0.2, 1.8, 0, Math.PI * 2); g.fill();
      for (let i = -20; i < w + 40; i += 11) box(i, -15, 4, 15, '#f2f2ea', 1); // picket fence
      box(-20, -11, w + 60, 3, '#f2f2ea', 1);
      return;
    }
    if (st === 'farm') {
      if (f.barn) {
        box(0, -h * 0.7, w * 0.7, h * 0.7, '#a8322d');
        for (let x = 6; x < w * 0.7; x += 8) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, -h * 0.7, 1.4, h * 0.7); }
        g.beginPath(); g.moveTo(-10, -h * 0.68); g.lineTo(w * 0.35, -h); g.lineTo(w * 0.7 + 10, -h * 0.68); g.closePath(); g.fillStyle = '#6a2a24'; g.fill(); ink(1.8);
        g.strokeStyle = '#eee'; g.lineWidth = 3; g.strokeRect(w * 0.2, -h * 0.45, w * 0.3, h * 0.45);
        g.beginPath(); g.moveTo(w * 0.2, -h * 0.45); g.lineTo(w * 0.5, 0); g.moveTo(w * 0.5, -h * 0.45); g.lineTo(w * 0.2, 0); g.stroke();
        box(w * 0.78, -h - 20, w * 0.16, h + 20, '#c9c9c0'); g.beginPath(); g.arc(w * 0.86, -h - 20, w * 0.08, Math.PI, 0); g.fillStyle = '#9aa0a8'; g.fill(); ink();
        tone(w * 0.78, -h - 20, w * 0.05, h + 20, 0.25);
      } else {
        box(-40, -50, w + 80, 50, '#c9b25a');
        for (let i = 0; i < 6; i++) { g.fillStyle = '#b89e48'; g.fillRect(-40, -50 + i * 9, w + 80, 3); }
      }
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, -18); g.lineTo(w + 60, -18); g.moveTo(-60, -8); g.lineTo(w + 60, -8); g.stroke();
      for (let x = -60; x < w + 60; x += 30) box(x, -24, 4, 24, '#7a5a30', 1);
      return;
    }
    if (st === 'docks') {
      for (let i = 0; i < f.stack; i++) {
        const cw = w * 0.9, ch = 40, cy = -ch * (i + 1), col = shade(f.col, -i * 0.1);
        box(0, cy, cw, ch - 2, col, 1.8);
        for (let j = 4; j < cw; j += 7) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(j, cy + 2, 2, ch - 6); }
        tone(cw * 0.75, cy, cw * 0.25, ch - 2, 0.25);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '900 9px Impact, system-ui'; g.textAlign = 'left'; g.fillText(r.pick(['CARGO', 'MAERK', 'EVERG', 'PORT 9']), 8, cy + 14);
      }
      return;
    }

    // ---- city block building
    const wall = g.createLinearGradient(0, -h, 0, 0);
    wall.addColorStop(0, shade(f.col, 0.1)); wall.addColorStop(1, shade(f.col, -0.12));
    g.beginPath(); g.rect(0, -h, w, h); g.fillStyle = wall; g.fill();
    if (st === 'towers') {
      // curtain wall: sky reflection bands + mullions
      const gl = g.createLinearGradient(0, -h, w, 0);
      gl.addColorStop(0, lit ? '#1c2a48' : '#a8d4f4'); gl.addColorStop(0.5, lit ? '#101a30' : '#5a8ec8'); gl.addColorStop(1, lit ? '#22335a' : '#8ab8e8');
      g.fillStyle = gl; g.fillRect(4, -h + 6, w - 8, h - 60);
      g.strokeStyle = shade(f.col, -0.3); g.lineWidth = 1.4;
      for (let x = 4; x < w - 4; x += 22) { g.beginPath(); g.moveTo(x, -h + 6); g.lineTo(x, -54); g.stroke(); }
      for (let y = -h + 6; y < -54; y += 18) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); }
      if (lit) for (let y = -h + 8; y < -56; y += 18) for (let x = 6; x < w - 6; x += 22) if (r.chance(0.35)) { g.fillStyle = 'rgba(255,220,140,.8)'; g.fillRect(x, y, 18, 14); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(w * 0.2, -54); g.lineTo(w * 0.55, -h); g.lineTo(w * 0.7, -h); g.lineTo(w * 0.35, -54); g.fill();
    } else if (st === 'warehouses' || st === 'factory') {
      for (let x = 3; x < w; x += 7) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(x, -h, 2.2, h); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2.2, -h, 1.2, h); }
      // clerestory windows
      for (let x = 10; x < w - 30; x += 34) box(x, -h + 14, 24, 12, lit ? '#e8c060' : '#6a8aa0', 1.2);
      // roll-up door + hazard stripes
      box(w * 0.18, -h * 0.55, w * 0.46, h * 0.55, '#5a5d62');
      for (let y = -h * 0.55 + 5; y < 0; y += 6) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(w * 0.18, y, w * 0.46, 1.6); }
      g.save(); g.beginPath(); g.rect(w * 0.18, -h * 0.55 - 7, w * 0.46, 6); g.clip();
      g.fillStyle = '#f2c21a'; g.fillRect(w * 0.18, -h * 0.55 - 7, w * 0.46, 6); g.fillStyle = INK;
      for (let x = w * 0.18 - 8; x < w * 0.64; x += 10) { g.beginPath(); g.moveTo(x, -h * 0.55 - 1); g.lineTo(x + 5, -h * 0.55 - 7); g.lineTo(x + 10, -h * 0.55 - 7); g.lineTo(x + 5, -h * 0.55 - 1); g.fill(); }
      g.restore();
      if (st === 'factory') { box(w * 0.78, -h - 120, 22, 120, '#7a5a4a'); g.fillStyle = '#d8d0c0'; g.fillRect(w * 0.78, -h - 110, 22, 5); g.fillRect(w * 0.78, -h - 80, 22, 5); }
    } else {
      if (st === 'apartments' || st === 'mixed') for (let y = -h + 4; y < -56; y += 6) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y, w, 1); }
      // window grid
      const cols = Math.max(2, Math.floor(w / 42)), ww = w / cols;
      const rows = Math.max(1, Math.floor((h - 76) / 40));
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
        const on = lit && r.chance(st === 'clubs' || st === 'lair' ? 0.35 : 0.55);
        win(cc * ww + ww * 0.22, -h + 20 + rr * 40, ww * 0.56, 24, on);
        if (!lit && r.chance(0.12)) box(cc * ww + ww * 0.3, -h + 20 + rr * 40 + 25, ww * 0.4, 9, '#b8bcc0', 1.2); // AC unit
      }
      if (f.escape && cols >= 2) {
        const ex = ww * 0.12, ew = ww * 1.76;
        g.strokeStyle = INK; g.lineWidth = 1.6;
        for (let rr = 0; rr < rows; rr++) {
          const py = -h + 20 + rr * 40 + 30;
          g.fillStyle = '#23202a'; g.fillRect(ex, py, ew, 3);
          g.beginPath(); for (let x = ex; x <= ex + ew; x += 5) { g.moveTo(x, py); g.lineTo(x, py - 10); } g.moveTo(ex, py - 10); g.lineTo(ex + ew, py - 10); g.lineWidth = 1; g.stroke();
          if (rr < rows - 1) { g.beginPath(); g.moveTo(ex + (rr % 2 ? ew * 0.2 : ew * 0.8), py); g.lineTo(ex + (rr % 2 ? ew * 0.8 : ew * 0.2), py + 40); g.lineWidth = 2; g.stroke(); }
        }
      }
    }
    // cornice + its shadow
    box(-3, -h - 4, w + 6, 8, shade(f.col, 0.28), 1.6);
    tone(0, -h + 4, w, 8, 0.3);
    // ground floor
    const gf = 58;
    if (st !== 'warehouses' && st !== 'factory') {
      box(0, -gf, w, gf, shade(f.col, -0.32));
      // shop window with display + reflection
      const sx0 = w * 0.08, sw0 = w * 0.5, sy0 = -gf * 0.82, sh0 = gf * 0.6;
      g.beginPath(); g.rect(sx0, sy0, sw0, sh0);
      const sg = g.createLinearGradient(0, sy0, 0, sy0 + sh0);
      sg.addColorStop(0, lit ? '#ffe7b0' : '#a8d0ec'); sg.addColorStop(1, lit ? '#e8a860' : '#5a7a98');
      g.fillStyle = sg; g.fill();
      for (let i = 0; i < 4; i++) { g.fillStyle = r.pick(['#d8122e', '#2a5ab8', '#e0a020', '#3a8a5a', '#8a3ab8']); g.fillRect(sx0 + 6 + i * (sw0 / 4.4), sy0 + sh0 - 14 - r.range(0, 10), sw0 / 6, 14 + r.range(0, 10)); }
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(sx0 + sw0 * 0.1, sy0 + sh0); g.lineTo(sx0 + sw0 * 0.35, sy0); g.lineTo(sx0 + sw0 * 0.48, sy0); g.lineTo(sx0 + sw0 * 0.23, sy0 + sh0); g.fill();
      g.beginPath(); g.rect(sx0, sy0, sw0, sh0); ink(2);
      // door
      box(w * 0.66, -gf * 0.86, w * 0.19, gf * 0.86, '#3a2418', 1.8);
      box(w * 0.69, -gf * 0.76, w * 0.13, gf * 0.3, lit ? '#ffd98a' : '#6a90b0', 1.2);
      g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w * 0.82, -gf * 0.4, 1.6, 0, Math.PI * 2); g.fill();
      out.door = w * 0.755;
    } else out.door = w * 0.41;
    // awning: stripes, scalloped edge, halftone underside shadow
    if (f.awn) {
      const ay = -gf - 4, ah = 16;
      g.save(); g.beginPath(); g.moveTo(2, ay - ah); g.lineTo(w - 2, ay - ah); g.lineTo(w + 6, ay); g.lineTo(-6, ay); g.closePath(); g.clip();
      g.fillStyle = f.awn; g.fillRect(-6, ay - ah, w + 12, ah);
      g.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -6; x < w + 6; x += 14) g.fillRect(x, ay - ah, 7, ah);
      g.restore();
      g.beginPath(); g.moveTo(2, ay - ah); g.lineTo(w - 2, ay - ah); g.lineTo(w + 6, ay); g.lineTo(-6, ay); g.closePath(); ink(1.6);
      g.beginPath(); for (let x = -6; x < w + 6; x += 10) g.arc(x + 5, ay, 5, 0, Math.PI); g.fillStyle = f.awn; g.fill(); ink(1.3);
      tone(0, ay + 5, w, 12, 0.3);
    }
    // sign
    if (f.sign) {
      const neon = f.neon && (st === 'clubs' || st === 'casino' || st === 'venues' || st === 'lair');
      const sy = -gf - (f.awn ? 34 : 20), sw = w * 0.72, sh = 24;
      if (neon) {
        box(w / 2 - sw / 2, sy - sh / 2, sw, sh, '#120e1a', 2);
        g.font = `900 ${Math.min(18, (sw / f.sign.length) * 1.5)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 4; g.strokeStyle = rgba(f.neon, 0.45); g.strokeText(f.sign, w / 2, sy + 1);
        g.fillStyle = lit ? '#ffffff' : f.neon; g.fillText(f.sign, w / 2, sy + 1);
        g.lineWidth = 1; g.strokeStyle = f.neon; g.strokeText(f.sign, w / 2, sy + 1);
        out.neon = { x: w / 2 + 0, y: sy, w: sw };
      } else {
        box(w / 2 - sw / 2, sy - sh / 2, sw, sh, '#f2ead8', 2);
        box(w / 2 - sw / 2 + 3, sy - sh / 2 + 3, sw - 6, sh - 6, 'rgba(0,0,0,0)', 1);
        g.font = `900 ${Math.min(17, (sw / f.sign.length) * 1.45)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = f.awn || '#d8122e'; g.fillText(f.sign, w / 2 + 1, sy + 2); g.fillStyle = INK; g.fillText(f.sign, w / 2, sy + 1);
      }
    }
    // street-level grime: poster, graffiti tag
    if (f.poster) {
      const [txt, bg, fg] = f.poster, px = w * 0.58, py = -gf - (f.awn ? 0 : 0) + 12;
      if (st === 'warehouses' || st === 'factory') {
        g.save(); g.translate(w * 0.8, -40); g.rotate(r.range(-0.08, 0.08)); box(-12, -16, 24, 30, bg, 1.2); g.fillStyle = fg; g.font = '900 6px Impact, system-ui'; g.textAlign = 'center'; g.fillText(txt, 0, -6); g.fillRect(-7, -2, 14, 12); g.restore();
      } else { g.save(); g.translate(px - 60 < 0 ? px : w * 0.03 + 12, py - 44); g.rotate(r.range(-0.1, 0.1)); box(-10, -13, 20, 26, bg, 1.2); g.fillStyle = fg; g.font = '900 5px Impact, system-ui'; g.textAlign = 'center'; g.fillText(txt, 0, -5); g.fillRect(-6, -1, 12, 10); g.restore(); }
    }
    if (f.tag) {
      g.save(); g.translate(w * (st === 'warehouses' || st === 'factory' ? 0.84 : 0.37), -14); g.rotate(r.range(-0.18, 0.1));
      g.font = `900 ${r.range(13, 18)}px Impact, system-ui`; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = INK; g.strokeText(f.tag, 0, 0);
      g.fillStyle = f.tagCol; g.fillText(f.tag, 0, 0);
      g.fillStyle = rgba('#ffffff', 0.6); g.fillRect(-10, -9, 6, 2);
      g.restore();
    }
    // building side shade (halftone) + outline
    tone(0, -h, 7, h, 0.35);
    g.beginPath(); g.rect(0, -h, w, h); ink(2.2);
    // ground grime
    const gr = g.createLinearGradient(0, -14, 0, 0); gr.addColorStop(0, 'rgba(20,12,20,0)'); gr.addColorStop(1, 'rgba(20,12,20,.4)');
    g.fillStyle = gr; g.fillRect(0, -14, w, 14);
    void clamp;
  }
}
