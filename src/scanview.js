// Detective vision for the daytime crime scene, as an overlay on the painted scene: the art drains
// to deep navy, props keep their real shape as cyan edges, hidden evidence glows orange through its
// container with an Arkham-style data card on a leader line, the witness shows a skeleton + pulse.
// Mixed into Investigate (uses its view/toScreen/layers/clues).
import { LW, LH, CAPTION, ease, scanPattern, paintXrayStructure, paintSkeleton } from './crimescene.js';
import { drawClueGlyph } from './evidenceart.js';

// Readout per clue kind: [card title, what the scan sees before extraction]
const TRACE = { hair: ['HAIR SAMPLE', 'Keratin fibre, sealed in'], shoes: ['SHOE TRACE', 'Sole impression, sealed in'], scent: ['RESIDUE', 'Airborne particulate'], ride: ['VEHICLE LINK', 'Paint / key trace'], mark: ['IDENT MARK', 'Skin or metal trace'], hand: ['HANDWRITING', 'Ink-stroke sample'] };
// Witness condition read off their pulse, keyed by the approach that works on them.
const PULSE = { reassure: [132, 'TERRIFIED'], intimidate: [74, 'DEFIANT'], facts: [104, 'EVASIVE'] };

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
    paintSkeleton(ctx, w.x, w.y, 2.1, t);
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
      ctx.globalAlpha = 0.35 + hitSweep * 0.3; ctx.fillStyle = this.honey(ctx, col); ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();
      // the item, glowing through
      const gs = 92 + hitSweep * 14 + Math.sin(t * 4) * 4;
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 22 + hitSweep * 20;
      ctx.drawImage(this.glowGlyph(c, col), x - gs / 2, y - gs / 2, gs, gs);
      ctx.restore();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.shadowColor = col; ctx.shadowBlur = 8;
      const m = 8, l = Math.min(24, p.w * 0.25);
      ctx.beginPath();
      for (const [bx, by, dx, dy] of [[p.x - m, p.y - m, 1, 1], [p.x + p.w + m, p.y - m, -1, 1], [p.x - m, p.y + p.h + m, 1, -1], [p.x + p.w + m, p.y + p.h + m, -1, -1]]) {
        ctx.moveTo(bx, by + dy * l); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * l, by);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      tags.push({ kind: 'clue', c, col, at: this.toScreenZ(x, y, f, zk) });
    }
    if (!this.trap.taken) {
      const tr = this.trap;
      ctx.fillStyle = 'rgba(255,70,200,.4)'; ctx.shadowColor = '#ff4ad0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(tr.x + 18, tr.y + 20, 18 + Math.sin(t * 6) * 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      tags.push({ kind: 'trap', col: '#ff7ad8', at: this.toScreenZ(tr.x + 18, tr.y + 4, f, zk) });
    }
    tags.push({ kind: 'pulse', col: '#8ff4ff', at: this.toScreenZ(w.x - 12, w.y - 186, f, zk) });

    // screen-space: grain, falloff, data cards and tags kept clear of the HUD
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.scanPat) this.scanPat = scanPattern(ctx);
    ctx.globalAlpha = 0.5; ctx.fillStyle = this.scanPat; ctx.fillRect(0, 0, Wd, Hd); ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(cx, cy, Math.min(Wd, Hd) * 0.35, cx, cy, maxR);
    vg.addColorStop(0, 'rgba(0,8,24,0)'); vg.addColorStop(1, 'rgba(0,6,20,.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, Wd, Hd);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawScanTags(ctx, tags, t);
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
    X.save(); this.view(X, f, dpr, 0, true); X.globalAlpha = 0.55; paintXrayStructure(X, this.settingKey, v, 0); X.restore();
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

  /** Screen rects the scan labels must not sit under (HUD panels, buttons). */
  blockers() {
    const out = [];
    for (const id of ['hud-left', 'hud-top', 'objectives', 'hud-right']) {
      const el = document.getElementById(id);
      if (!el || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) out.push(r);
    }
    for (const b of document.querySelectorAll('#btns > *')) { const r = b.getBoundingClientRect(); if (r.width) out.push(r); }
    return out;
  },

  /** Arkham-style scan readouts: a data card per anomaly on a leader line, a pulse tag on the witness. */
  drawScanTags(ctx, tags, t) {
    const B = this.blockers(), W = this.g.w, H = this.g.h;
    for (const tg of tags) B.push({ left: tg.at.x - 55, right: tg.at.x + 55, top: tg.at.y - 55, bottom: tg.at.y + 55 }); // never cover what a card points at
    const free = (x, y, w, h) => x >= 6 && y >= 6 && x + w <= W - 6 && y + h <= H - 6 && B.every((r) => x + w < r.left - 4 || x > r.right + 4 || y + h < r.top - 4 || y > r.bottom + 4);
    // candidate slots down the left edge and along the bottom-left, then anywhere near the point
    const place = (at, w, h) => {
      // the closest free slot around the point, within a short leader line
      let best = null, bd = 260;
      for (let dy = -h - 180; dy <= 180; dy += 14) for (let dx = -w - 200; dx <= 200; dx += 14) {
        const x = Math.round(at.x + dx), y = Math.round(at.y + dy);
        if (!free(x, y, w, h)) continue;
        const d = Math.hypot(Math.max(x - at.x, 0, at.x - x - w), Math.max(y - at.y, 0, at.y - y - h));
        if (d < bd) { bd = d; best = [x, y]; }
      }
      return best;
    };
    ctx.save();
    ctx.textBaseline = 'middle';
    for (const tg of tags) {
      let lines, w, h;
      if (tg.kind === 'clue') {
        const c = tg.c, info = TRACE[c.key] || ['EVIDENCE', 'Trace'];
        const n = this.case.suspects.filter((s) => s.attrs[c.key] === c.value).length;
        lines = [[info[0], 20, tg.col], [c.found ? c.value.toUpperCase() : info[1], 13, '#d8f6ff'], [c.found ? `MATCHES ${n} SUSPECT${n === 1 ? '' : 'S'}` : 'SEALED · TAP TO EXTRACT', 13, c.found ? '#6dffb0' : '#ffd08a']];
        w = 176; h = 72;
      } else if (tg.kind === 'trap') {
        lines = [['CHEMICAL TRACE', 17, tg.col], ['Intoxicant · bait?', 12, '#ffd6f2']]; w = 150; h = 48;
      } else {
        const [base, cond] = PULSE[this.witness.mood.works] || [96, 'CALM'], bpm = base + Math.round(Math.sin(t * 1.7) * 3);
        lines = [[`${bpm} BPM`, 18, '#8ff4ff'], [`CONDITION: ${cond}`, 11.5, '#d8f6ff']]; w = 150; h = 46;
      }
      const pos = place(tg.at, w, h);
      if (!pos) continue;
      const [x, y] = pos;
      B.push({ left: x, right: x + w, top: y, bottom: y + h });
      // leader line: dot on the source, elbow to the card
      const ex = x + w / 2 < tg.at.x ? x + w : x, ey = y + h / 2;
      ctx.strokeStyle = tg.col; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tg.at.x, tg.at.y); ctx.lineTo(tg.at.x + (ex - tg.at.x) * 0.3, ey); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = tg.col; ctx.beginPath(); ctx.arc(tg.at.x, tg.at.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(4,14,30,.86)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = tg.col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = tg.col; ctx.fillRect(x, y, 4, h);
      let ly = y + 4;
      for (const [txt, size, col] of lines) {
        ctx.font = size >= 17 ? `${size}px ${CAPTION}` : `700 ${size}px system-ui, sans-serif`;
        ctx.fillStyle = col; ctx.textAlign = 'left';
        ly += size * 0.62; ctx.fillText(txt, x + 12, ly, w - 20); ly += size * 0.62 + 3;
      }
      if (tg.kind === 'pulse') { // a little ECG trace
        ctx.strokeStyle = '#8ff4ff'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const px = x + w - 50 + i, ph = ((i / 40) + t * 1.3) % 1; const k = ph > 0.45 && ph < 0.55 ? Math.sin((ph - 0.45) * 62.8) * 9 : 0; if (i) ctx.lineTo(px, y + 14 - k); else ctx.moveTo(px, y + 14 - k); }
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /** Honeycomb pattern (cached) in a colour. */
  honey(ctx, col) {
    this.honeyPat = this.honeyPat || {};
    if (this.honeyPat[col]) return this.honeyPat[col];
    const c = document.createElement('canvas'); c.width = 18; c.height = 31;
    const g = c.getContext('2d'); g.strokeStyle = col; g.lineWidth = 1.4;
    const hex = (x, y) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 10.4, y + Math.sin(a) * 10.4); } g.closePath(); g.stroke(); };
    hex(9, 0); hex(0, 15.5); hex(18, 15.5); hex(9, 31);
    return (this.honeyPat[col] = ctx.createPattern(c, 'repeat'));
  },

  /** The clue's drawing as a solid glowing object with honeycomb texture (cached per clue state). */
  glowGlyph(c, col) {
    const id = c.key + c.value + col;
    if (c._glow && c._glow.id === id) return c._glow.cv;
    const S = 160, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    drawClueGlyph(g, c.key, c.value, S / 2, S / 2, S * 0.78, 'ink');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = col; g.globalAlpha = 0.72; g.fillRect(0, 0, S, S);
    g.globalAlpha = 1; g.fillStyle = this.honey(g, 'rgba(255,245,200,.55)'); g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    c._glow = { id, cv };
    return cv;
  },

};
