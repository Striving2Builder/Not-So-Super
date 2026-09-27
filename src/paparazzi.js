// Tabloid drones: after dark in vice districts, camera drones swarm out to tail her. Every flash
// that lands adds tabloid heat. They top out below high patrol and can't match her boost, so she
// shakes them by climbing (▲) or boosting away; they give up once she leaves the district.
import { DISTRICTS } from './data.js';
import { rand, dist, clamp } from './util.js';
import { toast } from './ui.js';
import { sfx } from './sfx.js';

const MAX_DRONES = 3;
const SPEED = 640;      // faster than cruising, slower than boost
const CEILING = 430;    // can't climb to high patrol
const FLASH_RANGE = 150;
const HEAT_PER_FLASH = 5;

export class Paparazzi {
  constructor(ow) { this.ow = ow; this.reset(); }

  reset() { this.drones = []; this.spawnT = 3; this.warned = false; this.flash = 0; }

  get active() {
    const ow = this.ow, st = ow.g.state, D = DISTRICTS[ow.district];
    return !!(st && st.isNight && D && D.vice && !ow.attract);
  }

  update(dt) {
    const ow = this.ow, h = ow.hero, st = ow.g.state;
    this.flash = Math.max(0, this.flash - dt * 3);
    const hunting = this.active;
    if (hunting) {
      this.spawnT -= dt;
      // no new drones while she is out of their reach at high patrol
      if (this.spawnT <= 0 && h.z < CEILING + 120 && this.drones.filter((d) => !d.leaving).length < MAX_DRONES) {
        this.spawnT = rand(3, 6);
        const a = rand(0, Math.PI * 2);
        this.drones.push({ x: h.x + Math.cos(a) * 900, y: h.y + Math.sin(a) * 900, z: 260, flashT: rand(0.5, 1.5), side: rand(-1, 1), leaving: false, lostT: 0, blink: rand(0, 6) });
        if (!this.warned) { this.warned = true; toast('📸 Tabloid drones on your tail! Boost away or climb to high patrol (▲) to shake them', 'bad'); }
      }
    }
    for (const d of this.drones) {
      d.blink += dt;
      const dh = dist(d.x, d.y, h.x, h.y);
      if (!hunting) d.leaving = true;
      if (h.z > CEILING + 120 || dh > 1400) d.lostT += dt; else d.lostT = 0;
      if (d.lostT > 2.5 && !d.leaving) { d.leaving = true; if (this.drones.every((q) => q.leaving)) toast('Shook off the tabloid drones', 'good'); }
      if (d.leaving) { // peel off and climb away
        const a = Math.atan2(d.y - h.y, d.x - h.x);
        d.x += Math.cos(a) * SPEED * dt; d.y += Math.sin(a) * SPEED * dt; d.z += 60 * dt;
        continue;
      }
      // hold a spot just off her shoulder, at the closest height they can reach
      const tx = h.x - Math.cos(h.ang) * 70 + -Math.sin(h.ang) * 90 * d.side, ty = h.y - Math.sin(h.ang) * 70 + Math.cos(h.ang) * 90 * d.side;
      const m = dist(tx, ty, d.x, d.y) || 1, step = Math.min(m, SPEED * dt);
      d.x += ((tx - d.x) / m) * step; d.y += ((ty - d.y) / m) * step;
      d.z += clamp(Math.min(h.z, CEILING) - d.z, -150 * dt, 150 * dt);
      d.flashT -= dt;
      if (d.flashT <= 0 && dh < FLASH_RANGE && Math.abs(d.z - h.z) < 160) {
        d.flashT = rand(1.4, 2.2);
        d.flashed = 0.25;
        this.flash = 1;
        sfx.shutter();
        if (st) st.vice = Math.min(100, st.vice + HEAT_PER_FLASH);
      }
      d.flashed = Math.max(0, (d.flashed || 0) - dt);
    }
    this.drones = this.drones.filter((d) => !(d.leaving && dist(d.x, d.y, h.x, h.y) > 1600));
  }

  draw(ctx, V) {
    for (const d of this.drones) {
      if (d.z > V.camH - 120) continue;
      const x = V.SX(d.x, d.z), y = V.SY(d.y, d.z), s = V.k * V.P(d.z);
      if (x < -50 || y < -50 || x > V.W + 50 || y > V.H + 50) continue;
      ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.5, s * 1.5);
      // pale halo so the drone reads against dark streets and neon haze
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,40,.55)';
      for (const [px, py] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-4, -4, 8, 8);
      if (Math.sin(d.blink * 8) > 0) { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(0, 5, 2, 0, Math.PI * 2); ctx.fill(); // camera lens
      ctx.restore();
      if (d.flashed > 0) { // camera flash burst
        const r = 50 * s * (1 + (0.25 - d.flashed) * 4);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgba(255,255,255,${d.flashed * 3})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  /** Brief white pop over the whole screen when a flash lands. */
  drawFlash(ctx, W, H) {
    if (this.flash <= 0) return;
    ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.22})`;
    ctx.fillRect(0, 0, W, H);
  }
}
