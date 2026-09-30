// Detective-vision readouts shared by the day scene (scanview.js) and night cases (nightscan.js):
// the orange honeycomb evidence glow, and Arkham-style data cards on leader lines, placed in the
// free space around what they point at (never under the HUD, never over the thing itself).
import { CAPTION } from './crimescene.js';
import { drawClueGlyph } from './evidenceart.js';

// Readout per clue kind: [card title, what the scan sees before extraction]
const TRACE = { hair: ['HAIR SAMPLE', 'Keratin fibre, sealed in'], shoes: ['SHOE TRACE', 'Sole impression, sealed in'], scent: ['RESIDUE', 'Airborne particulate'], ride: ['VEHICLE LINK', 'Paint / key trace'], mark: ['IDENT MARK', 'Skin or metal trace'], hand: ['HANDWRITING', 'Ink-stroke sample'] };
// A witness's condition read off their pulse, keyed by the approach that works on them.
const PULSE = { reassure: [132, 'TERRIFIED'], intimidate: [74, 'DEFIANT'], facts: [104, 'EVASIVE'] };
const CARD = { bg: 'rgba(4,14,30,.86)', reach: 260, keepOff: 55 };

export const SCAN = { cyan: '#8ff4ff', orange: '#ffa630', green: '#6dffb0', magenta: '#ff7ad8' };

/** Card for a sealed/extracted clue. */
export function clueTag(at, c, cf) {
  const info = TRACE[c.key] || ['EVIDENCE', 'Trace'], col = c.found ? SCAN.green : SCAN.orange;
  const n = cf.suspects.filter((s) => s.attrs[c.key] === c.value).length;
  return { at, col, w: 176, h: 72, lines: [[info[0], 20, col], [c.found ? c.value.toUpperCase() : info[1], 13, '#d8f6ff'], [c.found ? `MATCHES ${n} SUSPECT${n === 1 ? '' : 'S'}` : 'SEALED · TAP TO EXTRACT', 13, c.found ? SCAN.green : '#ffd08a']] };
}

export function trapTag(at) {
  return { at, col: SCAN.magenta, w: 150, h: 48, lines: [['CHEMICAL TRACE', 17, SCAN.magenta], ['Intoxicant · bait?', 12, '#ffd6f2']] };
}

/** Pulse readout; `works` = the witness's mood key, or null for a bystander (just the rate). */
export function pulseTag(at, works, t, seed = 0) {
  const [base, cond] = PULSE[works] || [84 + (seed % 5) * 6, null];
  const bpm = base + Math.round(Math.sin(t * 1.7 + seed) * 3);
  return cond
    ? { at, col: SCAN.cyan, w: 150, h: 46, ecg: true, lines: [[`${bpm} BPM`, 18, SCAN.cyan], [`CONDITION: ${cond}`, 11.5, '#d8f6ff']] }
    : { at, col: SCAN.cyan, w: 86, h: 28, lines: [[`${bpm} BPM`, 17, SCAN.cyan]] };
}

/** Screen rects the readouts must not sit under (HUD panels, buttons). */
export function blockers() {
  const out = [];
  for (const id of ['hud-left', 'hud-top', 'objectives', 'hud-right', 'prompt']) {
    const el = document.getElementById(id);
    if (!el || !el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) out.push(r);
  }
  for (const b of document.querySelectorAll('#btns > *, #stick-zone')) { const r = b.getBoundingClientRect(); if (r.width) out.push(r); }
  return out;
}

/** Draw the tags (ctx in CSS px) in a W x H screen. */
export function drawScanTags(ctx, tags, t, W, H) {
  const B = blockers();
  for (const tg of tags) B.push({ left: tg.at.x - CARD.keepOff, right: tg.at.x + CARD.keepOff, top: tg.at.y - CARD.keepOff, bottom: tg.at.y + CARD.keepOff });
  const free = (x, y, w, h) => x >= 6 && y >= 6 && x + w <= W - 6 && y + h <= H - 6 && B.every((r) => x + w < r.left - 4 || x > r.right + 4 || y + h < r.top - 4 || y > r.bottom + 4);
  // the closest free slot around the point, within a short leader line
  const place = (at, w, h) => {
    let best = null, bd = CARD.reach;
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
    const { w, h, col } = tg;
    const pos = place(tg.at, w, h);
    if (!pos) continue;
    const [x, y] = pos;
    B.push({ left: x, right: x + w, top: y, bottom: y + h });
    // leader line: dot on the source, elbow to the card
    const ex = x + w / 2 < tg.at.x ? x + w : x, ey = y + h / 2;
    ctx.strokeStyle = col; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tg.at.x, tg.at.y); ctx.lineTo(tg.at.x + (ex - tg.at.x) * 0.3, ey); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(tg.at.x, tg.at.y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = CARD.bg; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = col; ctx.fillRect(x, y, 4, h);
    let ly = y + 4;
    for (const [txt, size, c] of tg.lines) {
      ctx.font = size >= 17 ? `${size}px ${CAPTION}` : `700 ${size}px system-ui, sans-serif`;
      ctx.fillStyle = c; ctx.textAlign = 'left';
      ly += size * 0.62; ctx.fillText(txt, x + 12, ly, w - 20); ly += size * 0.62 + 3;
    }
    if (tg.ecg) { // a little ECG trace
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const px = x + w - 50 + i, ph = ((i / 40) + t * 1.3) % 1; const k = ph > 0.45 && ph < 0.55 ? Math.sin((ph - 0.45) * 62.8) * 9 : 0; if (i) ctx.lineTo(px, y + 14 - k); else ctx.moveTo(px, y + 14 - k); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

const honeyPats = new Map();
/** Honeycomb pattern in a colour (cached). */
export function honey(ctx, col) {
  if (honeyPats.has(col)) return honeyPats.get(col);
  const c = document.createElement('canvas'); c.width = 18; c.height = 31;
  const g = c.getContext('2d'); g.strokeStyle = col; g.lineWidth = 1.4;
  const hex = (x, y) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 10.4, y + Math.sin(a) * 10.4); } g.closePath(); g.stroke(); };
  hex(9, 0); hex(0, 15.5); hex(18, 15.5); hex(9, 31);
  const p = ctx.createPattern(c, 'repeat');
  honeyPats.set(col, p);
  return p;
}

/** The clue's drawing as a solid glowing object with honeycomb texture (cached on the clue). */
export function scanGlyph(c, col) {
  const id = c.key + c.value + col;
  if (c._glow && c._glow.id === id) return c._glow.cv;
  const S = 160, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  drawClueGlyph(g, c.key, c.value, S / 2, S / 2, S * 0.78, 'ink');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = col; g.globalAlpha = 0.72; g.fillRect(0, 0, S, S);
  g.globalAlpha = 1; g.fillStyle = honey(g, 'rgba(255,245,200,.55)'); g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  c._glow = { id, cv };
  return cv;
}
