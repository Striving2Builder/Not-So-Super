// Airspace traffic: bird flocks, news and police helicopters (with a spotlight at night),
// airliners high above, and searchlight beams sweeping up from the ground at night.
import { RNG } from './rng.js';
import { rand, pick } from './util.js';

const TAU = Math.PI * 2;

export class Airspace {
  constructor(seed, W, H, cruiseZ) {
    const r = new RNG(seed ^ 0x2545f491);
    this.W = W; this.H = H;
    this.birds = [];
    for (let i = 0; i < 10; i++) {
      this.birds.push({ x: r.range(0, W), y: r.range(0, H), z: cruiseZ + r.range(-120, 60), ang: r.range(0, TAU), spd: r.range(60, 110), n: r.int(5, 9), flap: r.range(0, TAU) });
    }
    this.helis = [];
    for (let i = 0; i < 4; i++) {
      this.helis.push({ x: r.range(0, W), y: r.range(0, H), z: cruiseZ + r.range(30, 120), ang: r.range(0, TAU), spd: r.range(120, 200), kind: i === 0 ? 'police' : 'news', turn: r.range(-0.15, 0.15), rotor: 0 });
    }
    this.planes = [];
    for (let i = 0; i < 2; i++) this.planes.push({ x: r.range(0, W), y: r.range(0, H), ang: r.range(0, TAU), spd: 420 });
    this.lights = [];
    for (let i = 0; i < 6; i++) this.lights.push({ x: r.range(W * 0.2, W * 0.8), y: r.range(H * 0.2, H * 0.8), phase: r.range(0, TAU), speed: r.range(0.3, 0.6) });
  }

  update(dt) {
    const wrap = (o) => { if (o.x < -500) o.x = this.W + 400; if (o.x > this.W + 500) o.x = -400; if (o.y < -500) o.y = this.H + 400; if (o.y > this.H + 500) o.y = -400; };
    for (const b of this.birds) { b.ang += Math.sin(b.flap * 0.1) * 0.2 * dt; b.flap += dt * 10; b.x += Math.cos(b.ang) * b.spd * dt; b.y += Math.sin(b.ang) * b.spd * dt; wrap(b); }
    for (const h of this.helis) { h.ang += h.turn * dt; if (Math.random() < dt * 0.1) h.turn = rand(-0.2, 0.2); h.rotor += dt * 30; h.x += Math.cos(h.ang) * h.spd * dt; h.y += Math.sin(h.ang) * h.spd * dt; wrap(h); }
    for (const p of this.planes) { p.x += Math.cos(p.ang) * p.spd * dt; p.y += Math.sin(p.ang) * p.spd * dt; wrap(p); }
    for (const l of this.lights) l.phase += l.speed * dt;
  }

  /** Night searchlights: additive beams from the ground, drawn before the flyers. */
  drawSearchlights(ctx, V) {
    if (V.night < 0.5) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lights) {
      const gx = V.SX(l.x), gy = V.SY(l.y);
      if (gx < -600 || gy < -600 || gx > V.W + 600 || gy > V.H + 600) continue;
      const tipX = l.x + Math.cos(l.phase) * 380, tipY = l.y + Math.sin(l.phase) * 380;
      const top = Math.min(520, V.camH - 150);
      const tx = V.SX(tipX, top), ty = V.SY(tipY, top);
      const nx = -(ty - gy), ny = tx - gx, len = Math.hypot(nx, ny) || 1, wdt = 38 * V.k;
      const grd = ctx.createLinearGradient(gx, gy, tx, ty);
      grd.addColorStop(0, 'rgba(255,250,220,0.22)'); grd.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(gx, gy);
      ctx.lineTo(tx + (nx / len) * wdt, ty + (ny / len) * wdt); ctx.lineTo(tx - (nx / len) * wdt, ty - (ny / len) * wdt);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /** Birds and helicopters at/below `z` (drawn before the hero) or above it. */
  drawFlyers(ctx, V, z, above) {
    const vis = (x, y, m) => x > -m && y > -m && x < V.W + m && y < V.H + m;
    for (const b of this.birds) {
      if ((b.z >= z) !== above || b.z > V.camH - 150) continue;
      const k = V.k * V.P(b.z);
      ctx.strokeStyle = 'rgba(20,20,26,0.8)'; ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      for (let i = 0; i < b.n; i++) {
        // V formation
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        const ox = -row * 14, oy = side * row * 10;
        const wx = b.x + Math.cos(b.ang) * ox - Math.sin(b.ang) * oy, wy = b.y + Math.sin(b.ang) * ox + Math.cos(b.ang) * oy;
        const x = V.SX(wx, b.z), y = V.SY(wy, b.z);
        if (!vis(x, y, 20)) continue;
        const f = Math.sin(b.flap + i) * 3 * k, w = 5 * k;
        const px = -Math.sin(b.ang), py = Math.cos(b.ang);
        ctx.moveTo(x - px * w, y - py * w - f); ctx.lineTo(x, y); ctx.lineTo(x + px * w, y + py * w - f);
      }
      ctx.stroke();
    }
    for (const h of this.helis) {
      if ((h.z >= z) !== above || h.z > V.camH - 150) continue;
      const x = V.SX(h.x, h.z), y = V.SY(h.y, h.z), k = V.k * V.P(h.z);
      if (!vis(x, y, 120 * k)) continue;
      if (V.night > 0.5) { // spotlight on the ground below
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const sx = V.SX(h.x + Math.cos(h.ang) * 40), sy = V.SY(h.y + Math.sin(h.ang) * 40), r = 60 * V.k;
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grd.addColorStop(0, 'rgba(255,255,230,0.35)'); grd.addColorStop(1, 'rgba(255,255,230,0)');
        ctx.fillStyle = grd; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(h.ang); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-4, 14, 30, 6);
      ctx.fillStyle = h.kind === 'police' ? '#1e2a4a' : '#e8e8e8';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, 0, 0, TAU); ctx.fill();
      ctx.fillRect(-28, -1.5, 18, 3);
      ctx.fillStyle = h.kind === 'police' ? '#3a6aff' : '#d8122e'; ctx.fillRect(-4, -7, 8, 2);
      ctx.fillStyle = 'rgba(120,200,255,0.8)'; ctx.beginPath(); ctx.ellipse(7, 0, 5, 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,30,30,0.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const a = h.rotor + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(-Math.cos(a) * 20, -Math.sin(a) * 20); ctx.stroke(); }
      if (h.kind === 'police' && V.night > 0.3 && Math.sin(h.rotor * 0.3) > 0) { ctx.fillStyle = '#ff3030'; ctx.fillRect(-2, 6, 4, 3); }
      ctx.restore();
    }
  }

  /** Airliners far above everything: small silhouettes with contrails. */
  drawPlanes(ctx, V) {
    for (const p of this.planes) {
      // Very high = close to the camera, so they sweep across fast (strong parallax) at a fixed size.
      const pz = V.camH * 0.72, x = V.SX(p.x, pz), y = V.SY(p.y, pz);
      if (x < -200 || y < -200 || x > V.W + 200 || y > V.H + 200) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.ang);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-90, -4); ctx.moveTo(-14, 4); ctx.lineTo(-90, 4); ctx.stroke();
      ctx.fillStyle = 'rgba(230,236,245,0.9)';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 2.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-4, -13); ctx.lineTo(-8, -13); ctx.lineTo(-5, 0); ctx.lineTo(-8, 13); ctx.lineTo(-4, 13); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
