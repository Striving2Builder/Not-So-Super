// Lens effects for the daytime crime scene: the camera viewfinder, the Polaroid pop when a photo is
// taken, speed lines on the clue punch-in, and the comic bubble/label lettering drawn in the scene.
// Mixed into Investigate (uses its view/toScreen/clues/case).
import { LW, LH, INK, CAPTION } from './crimescene.js';
import { $ } from './util.js';
import { drawClueGlyph } from './evidenceart.js';
import { tent } from './sceneprops.js';

export const LensFX = {
  /** Camera mode: a viewfinder with focus boxes on the evidence worth a front page. */
  drawViewfinder(ctx, f, dpr, v) {
    const t = this.t;
    ctx.save();
    this.view(ctx, f, dpr, 0);
    // letterbox dim + thirds
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 36 - v.y0); ctx.fillRect(v.x0, LH - 36, v.x1 - v.x0, v.y1 - LH + 36);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const k of [1, 2]) { ctx.moveTo(LW * k / 3, 36); ctx.lineTo(LW * k / 3, LH - 36); ctx.moveTo(0, LH * k / 3); ctx.lineTo(LW, LH * k / 3); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
    const m = 30, l = 60;
    for (const [x, y, dx, dy] of [[m, m + 20, 1, 1], [LW - m, m + 20, -1, 1], [m, LH - m, 1, -1], [LW - m, LH - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(LW / 2, LH / 2, 22, 0, Math.PI * 2); ctx.moveTo(LW / 2 - 34, LH / 2); ctx.lineTo(LW / 2 - 12, LH / 2); ctx.moveTo(LW / 2 + 12, LH / 2); ctx.lineTo(LW / 2 + 34, LH / 2); ctx.stroke();
    ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(72, LH - 60, 8 + Math.sin(t * 6) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.font = `22px ${CAPTION}`; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('REC', 88, LH - 59);
    // focus boxes on evidence found but not yet photographed
    for (const c of this.clues) {
      if (!c.found || !c.host) continue;
      const p = c.host;
      const blink = c.photo ? 1 : 0.55 + 0.45 * Math.sin(t * 8);
      ctx.strokeStyle = c.photo ? 'rgba(80,240,150,.9)' : `rgba(255,255,255,${blink})`; ctx.lineWidth = 3;
      const q = 6, k = 18;
      ctx.beginPath();
      for (const [bx, by, dx, dy] of [[p.x - q, p.y - q, 1, 1], [p.x + p.w + q, p.y - q, -1, 1], [p.x - q, p.y + p.h + q, 1, -1], [p.x + p.w + q, p.y + p.h + q, -1, -1]]) { ctx.moveTo(bx, by + dy * k); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * k, by); }
      ctx.stroke();
      this.label(ctx, p.x + p.w / 2, p.y - 20, c.photo ? '✓ FILED' : 'TAP TO SNAP', c.photo ? '#50f096' : '#fff');
    }
    ctx.restore();
  },

  /** Comic speed lines rushing in toward the clue while the view punches in. */
  drawSpeedLines(ctx, f, dpr, zk, W, H) {
    const p = this.focus.p;
    const cxL = p.x + p.w / 2, cyL = p.y + p.h / 2;
    const tx = cxL + (LW / 2 - cxL) * 0.55 * zk, ty = cyL + (LH / 2 - cyL) * 0.55 * zk;
    const s = this.toScreen(tx, ty);
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.hypot(W, H);
    ctx.fillStyle = `rgba(10,4,20,${0.35 * zk})`;
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(s.x, s.y, Math.max(W, H) * 0.32, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.fillStyle = `rgba(255,255,255,${0.75 * zk})`;
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + (i % 3) * 0.02;
      const r0 = Math.max(W, H) * (0.3 + ((i * 37) % 11) / 40), wdt = 0.006 + ((i * 13) % 5) * 0.003;
      ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0);
      ctx.lineTo(s.x + Math.cos(a - wdt) * R, s.y + Math.sin(a - wdt) * R); ctx.lineTo(s.x + Math.cos(a + wdt) * R, s.y + Math.sin(a + wdt) * R); ctx.fill();
    }
    ctx.restore();
  },

  /** Grab the framed prop out of the finished frame and toss it on screen as a polaroid. */
  takeSnapshot(ctx, dpr) {
    const { p, c: clue, n } = this.snapReq; this.snapReq = null;
    const layer = $('comic-layer'); if (!layer) return;
    const pad = 12, a = this.toScreen(p.x - pad, p.y - pad), b = this.toScreen(p.x + p.w + pad, p.y + p.h + pad);
    let sw = (b.x - a.x) * dpr, shh = (b.y - a.y) * dpr;
    const aspect = 4 / 3;
    if (sw / shh > aspect) { const nh = sw / aspect; a.y -= (nh - shh) / 2 / dpr; shh = nh; } else { const nw = shh * aspect; a.x -= (nw - sw) / 2 / dpr; sw = nw; }
    const c = document.createElement('canvas'); c.width = 240; c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, 240, 180);
    try { g.drawImage(ctx.canvas, a.x * dpr, a.y * dpr, sw, shh, 0, 0, 240, 180); } catch (e) { /* tainted/unsupported: keep the black frame */ }
    // the photo frames the evidence itself, lit by the flash, with its marker beside it
    const fl = g.createRadialGradient(120, 92, 10, 120, 92, 150); fl.addColorStop(0, 'rgba(255,255,255,.28)'); fl.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = fl; g.fillRect(0, 0, 240, 180);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    drawClueGlyph(g, clue.key, clue.value, 120, 92, 104, 'ink');
    g.shadowColor = 'transparent';
    tent(g, 196, 164, n, false);
    g.fillStyle = 'rgba(255,220,160,.12)'; g.fillRect(0, 0, 240, 180); // warm print
    try { clue.snap = c.toDataURL('image/jpeg', 0.8); } catch (e) { /* no snapshot on the board, the drawing stands in */ }
    const el = document.createElement('div');
    el.className = 'snap-polaroid';
    el.appendChild(c);
    const cap = document.createElement('span'); cap.textContent = `EVIDENCE #${n}`; el.appendChild(cap);
    const mid = this.toScreen(p.x + p.w / 2, p.y + p.h / 2);
    el.style.left = Math.max(70, Math.min(this.g.w - 70, mid.x)) + 'px';
    el.style.top = Math.max(80, Math.min(this.g.h - 80, mid.y)) + 'px';
    el.style.setProperty('--rot', ((Math.random() - 0.5) * 14).toFixed(1) + 'deg');
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  },

  bubble(ctx, x, y, txt) {
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(x, y, 34, 24, 0, 0, Math.PI * 2);
    ctx.moveTo(x - 14, y + 18); ctx.lineTo(x - 26, y + 42); ctx.lineTo(x - 2, y + 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, 31, 21, 0, 0, Math.PI * 2); ctx.fill(); // hide the tail seam
    ctx.fillStyle = INK; ctx.font = `28px ${CAPTION}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1);
    ctx.restore();
  },

  label(ctx, x, y, txt, col = '#fff') {
    ctx.font = `22px ${CAPTION}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 18;
    ctx.fillStyle = 'rgba(6,10,22,.88)'; ctx.fillRect(x - w / 2, y - 14, w, 28);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - 14, w, 28);
    ctx.fillStyle = col; ctx.fillText(txt, x, y + 1);
  },
};
