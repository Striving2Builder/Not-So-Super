// Detective vision for the daytime crime scene, as an overlay on the painted scene: the art drains
// to deep navy, props keep their real shape as cyan edges, hidden evidence glows orange through its
// container with an Arkham-style data card on a leader line, the witness shows a skeleton + pulse.
// Mixed into Investigate (uses its view/toScreen/layers/clues).
import { LW, LH, ease, scanPattern, paintXrayStructure, paintSkeleton } from './crimescene.js';
import { sceneImage, sceneEdges } from './scenespots.js';
import { honey, scanGlyph, clueTag, trapTag, pulseTag, drawScanTags } from './scanhud.js';

export const ScanView = {
  /** Detective vision as an overlay on the real scene: the painting drains to deep navy, every prop
   *  keeps its real shape as a cyan edge, and hidden evidence glows orange through its container,
   *  with a leader line out to a data card. Opens as a ring expanding from the middle. */
  drawXray(ctx, f, dpr, zk, v, L, props) {
    const now = performance.now(), t = this.t;
    const open = ease((now - this.xrayAt) / 460);
    const Wd = L.w, Hd = L.h;
    const c0 = this.toScreen(LW / 2, LH / 2), cx = c0.x * dpr, cy = c0.y * dpr, maxR = Math.hypot(Wd, Hd) * 0.6;
    if (!L.xrOk) this.bakeXray(L, f, dpr, v);
    ctx.save();
    this.view(ctx, f, dpr, 0, true); const M0 = ctx.getTransform();
    this.view(ctx, f, dpr, zk); const K = ctx.getTransform().multiply(M0.inverse());
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (open < 1) { ctx.beginPath(); ctx.arc(cx, cy, open * maxR, 0, Math.PI * 2); ctx.clip(); }
    ctx.fillStyle = '#030814'; ctx.fillRect(0, 0, Wd, Hd);
    ctx.setTransform(K); ctx.drawImage(L.xr, 0, 0);

    // scene-space: soft sweep, skeleton, glowing evidence
    this.view(ctx, f, dpr, zk);
    const period = 5.5, sweepX = v.x0 - 300 + ((t / period) % 1) * (v.x1 - v.x0 + 600);
    const sg = ctx.createLinearGradient(sweepX - 260, 0, sweepX + 60, 0);
    sg.addColorStop(0, 'rgba(60,200,255,0)'); sg.addColorStop(0.8, 'rgba(90,215,255,.13)'); sg.addColorStop(1, 'rgba(60,200,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg; ctx.fillRect(sweepX - 260, v.y0, 320, v.y1 - v.y0);
    ctx.globalCompositeOperation = 'source-over';
    const w = this.witness;
    paintSkeleton(ctx, w.x, w.y, w.s, t);
    const tags = [];
    for (const c of this.clues) {
      if (c.method !== 'xray' || !c.host) continue;
      const p = c.host, x = p.x + p.w / 2, y = p.y + p.h / 2;
      const hitSweep = Math.max(0, 1 - Math.abs(sweepX - x) / 160);
      const col = c.found ? '#6dffb0' : '#ffa630';
      // the container itself warms up: honeycomb wash inside its outline box
      ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
      const rg = ctx.createRadialGradient(x, y, 4, x, y, Math.max(p.w, p.h) * 0.7);
      rg.addColorStop(0, c.found ? 'rgba(80,255,170,.3)' : 'rgba(255,150,40,.38)'); rg.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = rg; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.globalAlpha = 0.35 + hitSweep * 0.3; ctx.fillStyle = honey(ctx, col); ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      // the item, glowing through
      const gs = 92 + hitSweep * 14 + Math.sin(t * 4) * 4;
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22 + hitSweep * 20;
      ctx.drawImage(scanGlyph(c, col), x - gs / 2, y - gs / 2, gs, gs);
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 8;
      const m = 8, l = Math.min(24, p.w * 0.25);
      ctx.beginPath();
      for (const [bx, by, dx, dy] of [[p.x - m, p.y - m, 1, 1], [p.x + p.w + m, p.y - m, -1, 1], [p.x - m, p.y + p.h + m, 1, -1], [p.x + p.w + m, p.y + p.h + m, -1, -1]]) {
        ctx.moveTo(bx, by + dy * l); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * l, by);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      tags.push(clueTag(this.toScreenZ(x, y, f, zk), c, this.case));
    }
    if (!this.trap.taken) {
      const tr = this.trap;
      ctx.fillStyle = 'rgba(255,70,200,.4)'; ctx.shadowColor = '#ff4ad0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(tr.x + 18, tr.y + 20, 18 + Math.sin(t * 6) * 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      tags.push(trapTag(this.toScreenZ(tr.x + 18, tr.y + 4, f, zk)));
    }
    tags.push(pulseTag(this.toScreenZ(w.x - 6 * w.s, w.y - 89 * w.s, f, zk), w.mood.works, t));

    // screen-space: grain, falloff, data cards and tags kept clear of the HUD
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.scanPat) this.scanPat = scanPattern(ctx);
    ctx.globalAlpha = 0.5; ctx.fillStyle = this.scanPat; ctx.fillRect(0, 0, Wd, Hd); ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(cx, cy, Math.min(Wd, Hd) * 0.35, cx, cy, maxR);
    vg.addColorStop(0, 'rgba(0,8,24,0)'); vg.addColorStop(1, 'rgba(0,6,20,.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, Wd, Hd);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScanTags(ctx, tags, t, this.g.w, this.g.h);
    ctx.restore();
    if (open < 1) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = `rgba(160,245,255,${1 - open})`; ctx.lineWidth = 6 * dpr; ctx.shadowColor = '#5fe8ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(cx, cy, open * maxR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  },

  /** The static part of detective vision, baked once: desaturated navy scene, faint studs/wiring,
   *  cyan edges traced from the props' own ink. */
  bakeXray(L, f, dpr, v) {
    const Wd = L.w, Hd = L.h;
    if (!L.edge) L.edge = document.createElement('canvas');
    L.edge.width = Wd; L.edge.height = Hd;
    const E = L.edge.getContext('2d');
    E.drawImage(L.ink, 0, 0);
    E.globalCompositeOperation = 'destination-out'; E.drawImage(L.props, 0, 0);
    E.globalCompositeOperation = 'source-in'; E.fillStyle = '#8ff4ff'; E.fillRect(0, 0, Wd, Hd);
    E.globalCompositeOperation = 'source-over';
    if (!L.xr) L.xr = document.createElement('canvas');
    L.xr.width = Wd; L.xr.height = Hd;
    const X = L.xr.getContext('2d');
    X.drawImage(L.base, 0, 0);
    X.globalCompositeOperation = 'saturation'; X.globalAlpha = 0.88; X.fillStyle = '#808080'; X.fillRect(0, 0, Wd, Hd);
    X.globalAlpha = 1; X.globalCompositeOperation = 'multiply'; X.fillStyle = '#3a68b0'; X.fillRect(0, 0, Wd, Hd);
    X.globalCompositeOperation = 'source-over'; X.fillStyle = 'rgba(2,8,24,.18)'; X.fillRect(0, 0, Wd, Hd);
    const rec = this.paint && sceneImage(this.paint);
    if (rec) { X.fillStyle = 'rgba(2,6,18,.4)'; X.fillRect(0, 0, Wd, Hd); } // a painting dims further: the scan lines carry the room
    X.save(); this.view(X, f, dpr, 0, true); X.globalAlpha = 0.55; paintXrayStructure(X, this.settingKey, v, 0, this.floorY);
    if (rec) { X.globalCompositeOperation = 'lighter'; X.globalAlpha = 0.5; X.drawImage(sceneEdges(rec), 0, 0, LW, LH); } // its own edges, traced
    X.restore();
    X.globalCompositeOperation = 'lighter'; X.drawImage(L.edge, 0, 0); X.globalAlpha = 0.45; X.drawImage(L.edge, 0, 0);
    X.globalAlpha = 1; X.globalCompositeOperation = 'source-over';
    L.xrOk = true;
  },

  /** Scene point → screen CSS px, including the punch-in zoom. */
  toScreenZ(x, y, f, zk) {
    if (zk > 0 && this.focus) {
      const p = this.focus.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2, z = 1 + 0.3 * zk;
      x = cx + (LW / 2 - cx) * 0.55 * zk + (x - cx) * z; y = cy + (LH / 2 - cy) * 0.55 * zk + (y - cy) * z;
    }
    return { x: f.ox + x * f.s, y: f.oy + y * f.s };
  },

};
