// The sky layer over the city: clouds at several heights (real perspective parallax, since the
// overworld camera projects by height) plus screen-space speed effects (wind streaks, sonic boom).
import { RNG } from './rng.js';
import { rand } from './util.js';

const SPRITES = 4;
let cloudSprites = null;

/** Soft cloud sprites built once from overlapping radial puffs. */
function sprites() {
  if (cloudSprites) return cloudSprites;
  cloudSprites = [];
  for (let s = 0; s < SPRITES; s++) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const r = new RNG(1000 + s);
    for (let i = 0; i < 14; i++) {
      const a = r.range(0, Math.PI * 2), d = r.range(0, 60);
      const x = 128 + Math.cos(a) * d * 1.3, y = 128 + Math.sin(a) * d * 0.8, rad = r.range(40, 78);
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,0.55)');
      grd.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    cloudSprites.push(c);
  }
  return cloudSprites;
}

export class Sky {
  /** @param alt the hero's cruising altitude; clouds sit around and above it. */
  constructor(seed, W, H, alt) {
    const r = new RNG(seed ^ 0x5bd1e995);
    this.clouds = [];
    const n = Math.round((W * H) / (850 * 850));
    for (let i = 0; i < n; i++) {
      // ~25% sit right at her altitude (fly-through clouds); the rest float higher.
      const low = r.chance(0.25);
      this.clouds.push({
        x: r.range(0, W), y: r.range(0, H),
        z: low ? alt + r.range(-25, 25) : alt + r.range(90, 320),
        rad: low ? r.range(110, 190) : r.range(160, 320),
        spr: r.int(0, SPRITES - 1), rot: r.range(0, Math.PI * 2),
      });
    }
    this.W = W; this.H = H;
    this.wind = { x: 9, y: 3 };
  }

  update(dt) {
    for (const c of this.clouds) {
      c.x += this.wind.x * dt; c.y += this.wind.y * dt;
      if (c.x > this.W + 400) c.x = -400;
      if (c.y > this.H + 400) c.y = -400;
    }
  }

  /** Draw clouds below (`above=false`) or above (`above=true`) height `z`. V = overworld view. */
  draw(ctx, V, z, above) {
    const spr = sprites();
    // Clouds above her are fainter so the city stays readable; at night they fade to a dim veil.
    const alpha = (above ? 0.42 : 0.5) * (1 - 0.55 * V.night);
    for (const c of this.clouds) {
      if ((c.z >= z) !== above) continue;
      const p = V.P(c.z), x = V.SX(c.x, c.z), y = V.SY(c.y, c.z), s = c.rad * V.k * p;
      if (x < -s || y < -s || x > V.W + s || y > V.H + s) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y); ctx.rotate(c.rot);
      ctx.drawImage(spr[c.spr], -s, -s, s * 2, s * 2);
      ctx.restore();
    }
  }

  /** 0..1 — how deep the hero is inside a cloud at her altitude. */
  immersion(h) {
    let best = 0;
    for (const c of this.clouds) {
      if (Math.abs(c.z - h.z) > 60) continue;
      const d = Math.hypot(c.x - h.x, c.y - h.y);
      if (d < c.rad * 0.85) best = Math.max(best, 1 - d / (c.rad * 0.85));
    }
    return best;
  }
}

/** Screen-space speed effects around the hero. */
export class SpeedFX {
  constructor() { this.streaks = []; this.rings = []; }

  sonicBoom() { this.rings.push({ t: 0 }); }

  update(dt, speedFrac, ang, W, H) {
    // Wind streaks: more and longer the faster she goes, flowing against her heading.
    const want = speedFrac > 0.35 ? Math.floor((speedFrac - 0.35) * 70) : 0;
    while (this.streaks.length < want) {
      this.streaks.push({ x: rand(0, W), y: rand(0, H), len: rand(40, 120), life: rand(0.25, 0.6), t: 0 });
    }
    const vx = -Math.cos(ang), vy = -Math.sin(ang), v = 900 + speedFrac * 1600;
    for (const s of this.streaks) { s.t += dt; s.x += vx * v * dt; s.y += vy * v * dt; }
    this.streaks = this.streaks.filter((s) => s.t < s.life).slice(0, Math.max(want, 0) + 20);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.9);
    this.ang = ang; this.frac = speedFrac;
  }

  draw(ctx, hx, hy, scale) {
    if (this.streaks.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(220,240,255,0.5)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const dx = Math.cos(this.ang), dy = Math.sin(this.ang);
      ctx.beginPath();
      for (const s of this.streaks) {
        const a = Math.sin((s.t / s.life) * Math.PI);
        const l = s.len * a * (0.6 + this.frac);
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + dx * l, s.y + dy * l);
      }
      ctx.stroke();
      ctx.restore();
    }
    for (const r of this.rings) {
      const e = r.t / 0.9;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - e)})`;
      ctx.lineWidth = 6 * (1 - e) + 1;
      ctx.beginPath(); ctx.ellipse(hx, hy, (40 + e * 260) * scale, (26 + e * 170) * scale, this.ang, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}
