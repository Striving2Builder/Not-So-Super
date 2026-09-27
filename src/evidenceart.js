// Evidence icons: one little inked drawing per clue (a red hair, a muddy boot print, a gold ring…).
// The same shapes serve the evidence cards/case board ('ink': coloured + outlined) and detective
// vision ('scan': a single glowing colour, as if seen through the container).
const HAIR = { 'bright red hair': '#e0402a', 'silver hair': '#d8dde6', 'jet-black hair': '#1a1a22' };

/** Draw the clue glyph centred at (x, y), about `s` px across. */
export function drawClueGlyph(g, key, value, x, y, s, mode = 'ink', col = '#ffa630') {
  const scan = mode === 'scan';
  const ink = scan ? col : '#141018';
  const fill = (c) => { g.fillStyle = scan ? 'rgba(255,166,48,.22)' : c; g.fill(); };
  const line = (w = 3) => { g.strokeStyle = ink; g.lineWidth = w / 60 * s * (scan ? 1.2 : 1); g.stroke(); };
  g.save();
  g.translate(x, y); const k = s / 60; g.scale(k, k);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const L = (w) => { g.strokeStyle = ink; g.lineWidth = w; g.stroke(); };
  switch (key) {
    case 'hair': { // a long strand curling across a scrap of paper
      if (!scan) { g.beginPath(); g.rect(-22, -18, 44, 36); fill('#f2ead4'); L(2.5); }
      g.beginPath(); g.moveTo(-26, 14);
      g.bezierCurveTo(-14, -26, 0, 26, 10, -6); g.bezierCurveTo(16, -22, 24, -10, 27, -24);
      g.strokeStyle = scan ? col : HAIR[value] || '#6a3a1a'; g.lineWidth = 4.5; g.stroke();
      if (!scan) { g.strokeStyle = '#141018'; g.lineWidth = 1.2; g.stroke(); }
      break;
    }
    case 'shoes': {
      if (value === 'red heels') { // stiletto: sole curve + spike heel
        g.beginPath(); g.moveTo(-26, 10); g.quadraticCurveTo(-6, 12, 6, -2); g.lineTo(20, -16); g.quadraticCurveTo(28, -16, 26, -6);
        g.lineTo(22, 0); g.lineTo(21, 20); g.lineTo(18, 20); g.lineTo(17, 2); g.quadraticCurveTo(0, 22, -26, 20); g.closePath();
        fill('#d8122e'); L(3);
      } else { // a tread print: sole + heel with lugs
        g.save(); g.rotate(-0.35);
        g.beginPath(); g.ellipse(0, -9, 13, 17, 0, 0, Math.PI * 2); fill(value === 'shiny loafers' ? '#1b1b24' : '#6a4a2a'); L(3);
        g.beginPath(); g.ellipse(0, 19, 10, 9, 0, 0, Math.PI * 2); fill(value === 'shiny loafers' ? '#1b1b24' : '#6a4a2a'); L(3);
        if (value === 'muddy work boots') { g.beginPath(); for (let i = -18; i <= 2; i += 6) { g.moveTo(-9, i); g.lineTo(9, i); } L(2.5); }
        else if (!scan) { g.beginPath(); g.ellipse(-4, -15, 4, 6, -0.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill(); }
        g.restore();
      }
      break;
    }
    case 'scent': {
      if (value === 'cigar smoke') {
        g.beginPath(); g.rect(-26, 6, 38, 10); fill('#8a5a2a'); L(2.5);
        g.beginPath(); g.rect(12, 6, 6, 10); fill('#c8c0b0'); L(2.5);
        g.beginPath(); g.moveTo(16, 2); g.bezierCurveTo(4, -8, 26, -14, 12, -24); g.moveTo(22, 0); g.bezierCurveTo(30, -10, 16, -16, 26, -26); L(2.5);
      } else if (value === 'cheap cologne') {
        g.beginPath(); g.rect(-14, -8, 28, 30); fill('#9ad8ff'); L(3);
        g.beginPath(); g.rect(-5, -18, 10, 10); fill('#e0c040'); L(3);
        g.beginPath(); g.moveTo(8, -24); g.lineTo(18, -30); g.moveTo(10, -18); g.lineTo(22, -20); g.moveTo(8, -12); g.lineTo(18, -8); L(2);
      } else { // peppermint wrapper: candy with twisted ends
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(-28, -10); g.lineTo(-28, 10); g.closePath(); g.moveTo(12, 0); g.lineTo(28, -10); g.lineTo(28, 10); g.closePath(); fill('#f2f2f2'); L(2.5);
        g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); fill('#fff'); L(3);
        if (!scan) { g.fillStyle = '#d8122e'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 13, i * Math.PI / 2, i * Math.PI / 2 + 0.7); g.fill(); } }
      }
      break;
    }
    case 'ride': {
      if (value === 'a black van') { // ticket stub
        g.save(); g.rotate(-0.12); g.beginPath(); g.rect(-24, -16, 48, 32); fill('#f7e9a8'); L(3);
        g.beginPath(); g.moveTo(-16, -6); g.lineTo(14, -6); g.moveTo(-16, 2); g.lineTo(8, 2); g.moveTo(-16, 10); g.lineTo(16, 10); L(2);
        g.beginPath(); g.rect(-24, -16, 48, 7); fill('#d8122e'); L(2); g.restore();
      } else if (value === 'a red sports car') { // paint flakes
        for (const [fx, fy, r] of [[-12, -6, 11], [10, 4, 9], [-2, 16, 6], [16, -14, 5]]) {
          g.beginPath(); g.moveTo(fx - r, fy); g.lineTo(fx - r * 0.2, fy - r); g.lineTo(fx + r, fy - r * 0.3); g.lineTo(fx + r * 0.4, fy + r); g.closePath(); fill('#e02030'); L(2.5);
        }
      } else { // key + fob
        g.beginPath(); g.rect(-26, -14, 22, 28); fill('#2a2a36'); L(3);
        g.beginPath(); g.arc(-4, 0, 6, 0, Math.PI * 2); L(3);
        g.beginPath(); g.moveTo(2, 0); g.lineTo(26, 0); g.moveTo(18, 0); g.lineTo(18, 8); g.moveTo(24, 0); g.lineTo(24, 6); L(4);
      }
      break;
    }
    case 'mark': {
      if (value === 'a snake tattoo') {
        g.beginPath(); g.moveTo(-26, 16); g.bezierCurveTo(-10, 30, -6, -4, 4, 0); g.bezierCurveTo(14, 4, 14, -20, 20, -18);
        g.strokeStyle = ink; g.lineWidth = 10; g.stroke(); g.strokeStyle = scan ? 'rgba(255,166,48,.3)' : '#3a9a4a'; g.lineWidth = 6; g.stroke();
        g.beginPath(); g.ellipse(22, -19, 7, 5, -0.3, 0, Math.PI * 2); fill('#3a9a4a'); L(2.5);
      } else if (value === 'a gold ring') {
        g.beginPath(); g.arc(0, 6, 17, 0, Math.PI * 2); g.arc(0, 6, 11, 0, Math.PI * 2, true); fill('#f0c030'); L(3);
        g.beginPath(); g.moveTo(-7, -10); g.lineTo(0, -20); g.lineTo(7, -10); g.lineTo(0, -6); g.closePath(); fill('#9ae8ff'); L(2.5);
      } else { // bandage roll with a stain
        g.beginPath(); g.rect(-20, -12, 34, 26); fill('#f4f0e6'); L(3);
        g.beginPath(); g.moveTo(14, -12); g.quadraticCurveTo(30, 0, 22, 18); L(3);
        g.beginPath(); g.arc(-4, 2, 6, 0, Math.PI * 2); fill('#c01020');
      }
      break;
    }
    case 'hand': default: { // handwritten note: slant says which hand
      const back = value === 'left-handed';
      g.save(); g.rotate(0.08); g.beginPath(); g.rect(-20, -24, 40, 48); fill('#fbf7ea'); L(3);
      g.beginPath();
      for (let i = -14; i <= 14; i += 7) { for (let j = -14; j < 12; j += 7) { g.moveTo(j, i + 3); g.lineTo(j + (back ? -3 : 3), i - 3); } }
      g.strokeStyle = scan ? col : '#1e3cff'; g.lineWidth = 2; g.stroke();
      if (back && !scan) { g.beginPath(); g.moveTo(-14, 16); g.lineTo(12, 18); g.strokeStyle = 'rgba(30,60,255,.45)'; g.lineWidth = 5; g.stroke(); }
      g.restore();
    }
  }
  g.restore();
}

/** The glyph as a data URL (cached), for evidence cards in the DOM. */
const cache = new Map();
export function glyphURL(key, value, px = 96) {
  const id = key + '|' + value + '|' + px;
  if (!cache.has(id)) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    drawClueGlyph(c.getContext('2d'), key, value, px / 2, px / 2, px * 0.8);
    cache.set(id, c.toDataURL());
  }
  return cache.get(id);
}
