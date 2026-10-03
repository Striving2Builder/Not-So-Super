// Street-fight effects and overlays (mixed into Brawler.prototype): hit sparks, numbers, dust and
// debris, the heat-vision beam, the super-move speed lines and cut-in panel, combo counter, GO arrow.
import { glow } from './art.js';
import { rand, chance } from './util.js';
import { INK } from './brawlpaint.js';
import { inkOutline } from './brawlsprite.js';
import { HERO_SCALE, DZ } from './brawldata.js';

export const fxDraw = {
  /** Radial comic speed lines converging on the heroine during the super freeze. */
  drawSpeedLines(ctx, W, H, a) {
    const c = this.screenOf(this.p.x, this.p.z, 90), R = Math.hypot(W, H);
    ctx.save(); ctx.globalAlpha = a * 0.55; ctx.fillStyle = this.cut.kind === 'heat' ? '#fff2d0' : '#e8fbff';
    for (let i = 0; i < 44; i++) {
      const an = i * 0.1428 * Math.PI + (i % 3) * 0.05, w = 0.012 + (i % 4) * 0.006, r0 = R * (0.22 + ((i * 37) % 10) / 40);
      ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * r0, c.y + Math.sin(an) * r0);
      ctx.lineTo(c.x + Math.cos(an - w) * R, c.y + Math.sin(an - w) * R); ctx.lineTo(c.x + Math.cos(an + w) * R, c.y + Math.sin(an + w) * R); ctx.fill();
    }
    ctx.restore();
  },

  drawBeam(ctx) {
    const p = this.p, s = this.sc(p.z) * HERO_SCALE;
    const x = this.sx(p.x), y = this.gy(p.z);
    const ey = y - p.y * s - 90 * s, x0 = x + p.facing * 12 * s, x1 = x + p.facing * (p.beamEnd || 520) * this.k;
    const wob = 1 + Math.sin(this.t * 60) * 0.1, g = Math.min(1, p.st_t / 0.08);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // orange halo → red body → hot orange → white core, ~3x the old weight
    for (const [w, c] of [[64, 'rgba(255,110,20,.22)'], [40, 'rgba(255,40,20,.5)'], [22, 'rgba(255,150,60,.9)'], [9, '#ffffff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w * s * wob * 0.5 * g;
      ctx.beginPath(); ctx.moveTo(x0, ey); ctx.lineTo(x1, ey + 4 * s); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.drawImage(glow('#ff6030'), x0 - 44 * s, ey - 44 * s, 88 * s, 88 * s);
    ctx.drawImage(glow('#ffffff'), x0 - 14 * s, ey - 14 * s, 28 * s, 28 * s);
    // the end: a white-hot splash on the target (or a flare where it dies out in open air)
    const fl = (p.beamHit ? 60 : 36) * s * (1 + Math.sin(this.t * 50) * 0.15);
    ctx.drawImage(glow('#ff7a30'), x1 - fl, ey - fl, fl * 2, fl * 2);
    ctx.drawImage(glow('#ffffff'), x1 - fl * 0.4, ey - fl * 0.4, fl * 0.8, fl * 0.8);
    ctx.restore();
    // embers shed along the beam
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ember', x: p.x + p.facing * rand(30, p.beamEnd || 520), y: 90 + rand(-6, 6), z: p.z, vx: rand(-40, 40), vy: rand(40, 160), t: 0, max: rand(0.4, 0.8) });
    // impact burst wherever it's burning a crook
    for (const e of this.enemies) {
      const dx = (e.x - p.x) * p.facing;
      if (e.dead || dx <= 0 || dx > (p.beamEnd || 520) + 30 || Math.abs(e.z - p.z) > DZ * 1.3) continue;
      if (chance(0.6)) this.fx.push({ kind: 'spark', x: e.x - p.facing * 10, y: 88, z: e.z + 0.001, t: 0, max: 0.1, big: true, hot: true, rot: rand(0, 6) });
      if (chance(0.6)) this.fx.push({ kind: 'streak', x: e.x - p.facing * 8, y: 88, z: e.z, vx: -p.facing * rand(100, 300), vy: rand(-100, 300), t: 0, max: 0.2, hot: true });
    }
  },

  // ------------------------------------------------------------------ effects
  drawFx(ctx) {
    const W = this.g.w;
    for (const f of this.fx) {
      const s = this.sc(f.z), y = this.gy(f.z) - f.y * s, u = f.t / f.max, a = 1 - u;
      // lettering stays inside the 8% safe inset; everything else sits where it happened
      const x = f.kind === 'num' || f.kind === 'text' ? Math.max(W * 0.08, Math.min(W * 0.92, this.sx(f.x))) : this.sx(f.x);
      switch (f.kind) {
        case 'spark': {
          // inked starburst: pops big then shrinks
          const r = (f.big ? 34 : 22) * s * (u < 0.3 ? 0.6 + u * 1.6 : 1.08 - (u - 0.3) * 1.1);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot || 0);
          ctx.beginPath();
          const n = f.big ? 10 : 8;
          for (let i = 0; i < n * 2; i++) { const an = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r * (0.8 + ((i * 7) % 5) * 0.08); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
          ctx.closePath();
          ctx.fillStyle = f.hurt ? '#ff4a5a' : f.hot ? '#ff9a2a' : f.big ? '#ffe14a' : '#fff6b0'; ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'ring':
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 4 * s * a + 1;
          ctx.beginPath(); ctx.ellipse(x, y, (20 + u * 70) * s, (12 + u * 40) * s, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'streak': {
          const len = 0.035;
          ctx.strokeStyle = f.hot ? `rgba(255,${120 + a * 100},60,${a})` : `rgba(255,250,210,${a})`; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - f.vx * len * this.k, y + f.vy * len * s); ctx.stroke();
          break;
        }
        case 'num': {
          const sc = u < 0.15 ? 0.5 + u * 5 : 1.25 - Math.min(0.25, (u - 0.15) * 0.6);
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.font = `900 ${(f.big ? 22 : 16) * s * sc}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.txt, x, y);
          ctx.fillStyle = f.big ? '#ff5a3a' : '#ffe14a'; ctx.fillText(f.txt, x, y);
          ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
          f.vy -= 200 * (1 / 60);
          break;
        }
        case 'text':
          ctx.globalAlpha = Math.min(1, a * 2); ctx.font = `900 ${17 * this.k}px Impact, system-ui`; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.txt, x, y); ctx.fillStyle = f.col; ctx.fillText(f.txt, x, y);
          ctx.globalAlpha = 1;
          break;
        case 'ko': {
          const sc = u < 0.2 ? u * 5 : 1;
          ctx.globalAlpha = Math.min(1, a * 3);
          ctx.save(); ctx.translate(x, y - 30 * s); ctx.rotate(-0.15); ctx.scale(sc, sc);
          ctx.font = `900 ${20 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('K.O.', 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText('K.O.', 0, 0);
          ctx.restore(); ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
          break;
        }
        case 'dust':
          ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#d8d0c4'; ctx.strokeStyle = 'rgba(40,30,40,.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, f.r * s * (0.6 + u * 0.8), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.5; ctx.fillStyle = f.dark ? '#3a3238' : '#9aa0a8';
          ctx.beginPath(); ctx.arc(x, y, f.r * s * (0.6 + u), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          break;
        case 'chunk':
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot || 0); ctx.globalAlpha = Math.min(1, a * 3);
          ctx.fillStyle = f.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
          { const cw = f.s * s * (f.plank ? 2.4 : 1), ch = f.s * s * (f.plank ? 0.5 : 0.66); ctx.fillRect(-cw / 2, -ch / 2, cw, ch); ctx.strokeRect(-cw / 2, -ch / 2, cw, ch); }
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        case 'muzzle':
          ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffd060'), x - 20 * s, y - 20 * s, 40 * s, 40 * s);
          ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x + f.dir * 22 * s, y); ctx.lineTo(x, y + 5 * s); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'frost': {
          ctx.globalAlpha = a * 0.85;
          const r = (6 + u * 34) * s * (f.r || 1);
          ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'ember':
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${150 + a * 80},60,${a})`;
          ctx.fillRect(x, y, 2.5 * s, 2.5 * s); ctx.globalCompositeOperation = 'source-over';
          break;
      }
    }
  },

  /** Comic cut-in for specials: a slanted panel slams across with the heroine's close-up. */
  drawCutIn(ctx, W, H) {
    const t = this.cut.t, heat = this.cut.kind === 'heat';
    const inT = Math.min(1, t / 0.08), outT = t > 0.5 ? (t - 0.5) / 0.16 : 0;
    const slide = (1 - inT) * W - outT * W * 1.2;
    const y0 = H * 0.2, bh = H * 0.24, sl = bh * 0.5;
    ctx.save();
    ctx.translate(slide, 0);
    ctx.beginPath(); ctx.moveTo(-20 + sl, y0); ctx.lineTo(W + 40, y0 - 6); ctx.lineTo(W + 40 - sl, y0 + bh); ctx.lineTo(-20, y0 + bh + 6); ctx.closePath();
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + bh);
    bg.addColorStop(0, heat ? '#ff3b1f' : '#39c6ff'); bg.addColorStop(1, heat ? '#8a0a1a' : '#1e3c9a');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); ctx.clip();
    // speed lines
    ctx.strokeStyle = heat ? 'rgba(255,220,120,.45)' : 'rgba(230,250,255,.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const yy = y0 + ((i * 37) % 100) / 100 * bh, xx = ((i * 211 + t * 3000) % (W + 200)) - 100; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 120 + (i % 3) * 60, yy); ctx.stroke(); }
    // hero close-up, cropped from the live sprite (head & shoulders), slightly zoomed
    const img = this.cutImg;
    if (img) {
      const cw = 108, ch = 104, cx = 58, cy = 64; // head & shoulders in the 220x300 frame
      const dh = bh * 1.6, dw = dh * (cw / ch);
      const dx = W * 0.14 + t * 30, dy = y0 - bh * 0.1;
      ctx.save();
      inkOutline(ctx, cropOf(img, cx, cy, cw, ch), dw, dh, 2.5, dx, dy);
      ctx.restore();
      if (heat) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(glow('#ff2010'), dx + dw * 0.54 - dw * 0.2, dy + dh * 0.33 - dh * 0.12, dw * 0.4, dh * 0.24); ctx.drawImage(glow('#ffffff'), dx + dw * 0.54 - dw * 0.07, dy + dh * 0.33 - dh * 0.04, dw * 0.14, dh * 0.08); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    // title lettering
    const txt = heat ? 'HEAT VISION!' : 'FREEZE BREATH!';
    ctx.font = `900 ${bh * 0.42}px Impact, system-ui`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const tx = W * 0.92, ty = y0 + bh * 0.52;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.05); ctx.scale(1 + (1 - inT) * 0.4, 1 + (1 - inT) * 0.4);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.strokeText(txt, 4, 4); ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = heat ? '#ffe14a' : '#ffffff'; ctx.fillText(txt, 0, 0);
    ctx.restore();
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  },

  drawCombo(ctx, W, H) {
    if (this.hits < 2 || this.cut) return;
    const fade = this.hitT > 1.6 ? Math.max(0, 1 - (this.hitT - 1.6) / 0.6) : 1;
    if (fade <= 0) return;
    const n = this.hits, pop = 1 + this.hitPop * 0.45;
    const col = n >= 25 ? '#ff3b3b' : n >= 10 ? '#ff9a1f' : '#ffe14a';
    const x = W * 0.92, y = H * 0.45, fs = Math.min(64, H * 0.13); // inside the 8% safe inset
    ctx.save(); ctx.globalAlpha = fade;
    ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(pop, pop);
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `900 ${fs}px Impact, system-ui`;
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.strokeText(String(n), -2, 0);
    ctx.fillStyle = col; ctx.fillText(String(n), -2, 0);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-ctx.measureText(String(n)).width, -fs * 0.62, ctx.measureText(String(n)).width - 4, fs * 0.08);
    ctx.font = `900 ${fs * 0.36}px Impact, system-ui`;
    ctx.lineWidth = 6; ctx.strokeText('HITS!', -2, fs * 0.36); ctx.fillStyle = '#fff'; ctx.fillText('HITS!', -2, fs * 0.36);
    ctx.restore();
  },

  drawGo(ctx, W, H) {
    if (!this.lock && this.goT > 0) {
      const b = Math.sin(this.t * 8) * 8, x = W - 40 + b, y = H * 0.3, s = Math.min(1.2, H / 390);
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(-110, -20); ctx.lineTo(-30, -20); ctx.lineTo(-30, -40); ctx.lineTo(10, 0); ctx.lineTo(-30, 40); ctx.lineTo(-30, 20); ctx.lineTo(-110, 20); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.font = '900 30px Impact, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d8122e'; ctx.fillText('GO!', -62, 1);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    if (this.objectivesDone()) {
      const ex = this.sx(this.len - 120), k = this.k;
      if (ex < W + 40) {
        ctx.fillStyle = 'rgba(62,224,138,.22)'; ctx.fillRect(ex, this.gt, 120 * k, this.gb - this.gt);
        ctx.font = `900 ${18 * k}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
        ctx.strokeText('EXIT ➜', ex + 60 * k, this.gt - 10); ctx.fillStyle = '#3ee08a'; ctx.fillText('EXIT ➜', ex + 60 * k, this.gt - 10);
      }
    }
  },
};

let cropC = null;
function cropOf(img, x, y, w, h) {
  if (!cropC) cropC = document.createElement('canvas');
  if (cropC.width !== w || cropC.height !== h) { cropC.width = w; cropC.height = h; }
  const g = cropC.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(img, x, y, w, h, 0, 0, w, h);
  return cropC;
}
