// The spinning front page shown after every victory (and every humiliation).
import { openModal, closeModal } from './ui.js';
import { PAPER, TABLOID } from './data.js';
import { drawHumanoid, pose, HERO_LOOK, npcLook } from './art.js';
import { sfx } from './sfx.js';
import { heroReady, HeroSprite } from './hero3d.js';

let photoSprite = null;
/** Draw the 3D heroine into the photo; returns false if the model isn't loaded. */
function modelShot(g, clip, time, x, feetY, heightPx, yaw = 0.45) {
  if (!heroReady()) return false;
  if (!photoSprite) photoSprite = new HeroSprite(300, 360);
  photoSprite.hero.pose(clip, time);
  // A still photo: settle the cloth in a heroic breeze before the snapshot.
  photoSprite.hero.setWind(1.2, 1.5, -4.5);
  photoSprite.hero.cape.reset();
  photoSprite.hero.cape.settle(120);
  photoSprite.still = true;
  const img = photoSprite.render({ view: 'side', yaw, span: 2.4, lift: 0.1 });
  const h = heightPx * (2.4 / 1.9), w = h * (300 / 360);
  g.drawImage(img, x - w / 2, feetY - h * (1 - 0.1 / 2.4), w, h);
  return true;
}

export function showNewspaper({ headline, sub = '', body = [], rep = 0, tabloid = false, photo = 'hero' }) {
  return new Promise((resolve) => {
    sfx.paper();
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const el = openModal(`<div class="paper ${tabloid ? 'tabloid' : ''}">
      <div class="mast"><span class="ed">${tabloid ? 'EXCLUSIVE!' : 'Late City Edition'}</span><h1>${tabloid ? TABLOID : PAPER}</h1><span class="ed">${date} · 25¢</span></div>
      <div class="hl">${headline}</div>${sub ? `<div class="sub">${sub}</div>` : ''}
      <div class="cols"><canvas class="photo" width="400" height="250"></canvas><div class="txt">${body.map((p) => `<p>${p}</p>`).join('')}</div></div>
      <div class="repd ${rep >= 0 ? 'good' : 'bad'}">${rep >= 0 ? '+' : ''}${rep} REPUTATION</div>
      <div class="tap">Tap to continue</div></div>`, 'paper-back');
    drawPhoto(el.querySelector('canvas'), photo, tabloid);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      removeEventListener('keydown', key, true);
      closeModal(el);
      resolve();
    };
    const key = (e) => { if (['Enter', ' ', 'Escape', 'e', 'E'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); } };
    setTimeout(() => { el.addEventListener('click', close); addEventListener('keydown', key, true); }, 900);
  });
}

function drawStamp(g, W, text) {
  g.save(); g.translate(W - 70, 36); g.rotate(-0.2);
  g.strokeStyle = '#d8122e'; g.lineWidth = 4; g.strokeRect(-60, -18, 120, 36);
  g.fillStyle = '#d8122e'; g.font = '900 20px Impact, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 0, 1); g.restore();
}

function drawPhoto(c, kind, tabloid) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, kind === 'fire' ? '#5a4a40' : '#6a8ab0'); sky.addColorStop(1, '#d8c8a8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3a4050';
  for (let i = 0; i < 14; i++) { const w = 20 + ((i * 37) % 30), h = 60 + ((i * 53) % 110); g.fillRect(i * 30 - 10, H - 60 - h, w, h + 60); }
  if (kind === 'fire') {
    for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(40,40,40,${0.4 + (i % 3) * 0.1})`; g.beginPath(); g.arc(60 + i * 18, 60 - i * 5, 30 + i * 4, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ff8a30'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40 + i * 20, 150); g.lineTo(50 + i * 20, 100 - (i % 2) * 20); g.lineTo(60 + i * 20, 150); g.fill(); }
  }
  g.fillStyle = '#6a6a6a'; g.fillRect(0, H - 40, W, 40);
  const hx = W * 0.55, hy = H - 22;
  if (kind === 'tabloid') {
    g.fillStyle = '#3a2a1a'; g.fillRect(hx - 30, hy - 110, 10, 110); g.fillRect(hx - 30, hy - 50, 70, 8);
    if (!modelShot(g, 'defeated', 5.8, hx, hy, 170, 0.3)) drawHumanoid(g, hx, hy, 1.6, 1, HERO_LOOK, pose('sitTied', 0.5), 0.5);
    g.fillStyle = 'rgba(57,255,106,.35)'; g.beginPath(); g.arc(hx + 80, hy - 80, 40, 0, Math.PI * 2); g.fill();
  } else if (kind === 'deal') {
    if (modelShot(g, 'dance', 2.2, hx, hy, 175, 0.2)) return drawStamp(g, W, 'SPONSORED?!');
    drawHumanoid(g, hx, hy, 1.7, 1, HERO_LOOK, pose('stand', 0.5), 0.5);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(hx - 22, hy - 160); g.lineTo(hx + 26, hy - 160); g.lineTo(hx + 2, hy - 215); g.fill();
    g.fillStyle = '#c22'; g.font = '900 12px system-ui'; g.textAlign = 'center'; g.fillText('I ♥', hx + 2, hy - 172);
  } else {
    if (kind === 'hero' || kind === 'special') {
      const b = npcLook(kind === 'special' ? 'boss' : 'thug', () => 0.3);
      drawHumanoid(g, hx - 120, hy, 1.3, 1, b, pose('down'), 0);
      drawHumanoid(g, hx + 110, hy + 4, 1.2, -1, npcLook('thug', () => 0.7), pose('down'), 0);
    }
    if (kind === 'case') {
      const s = npcLook('thug', () => 0.5);
      drawHumanoid(g, hx - 110, hy, 1.5, 1, s, pose('hurt'), 0);
      g.strokeStyle = '#ccc'; g.lineWidth = 3; g.beginPath(); g.arc(hx - 100, hy - 80, 6, 0, Math.PI * 2); g.stroke();
    }
    if (!modelShot(g, kind === 'case' ? 'pose' : 'excited', kind === 'case' ? 0 : 1.4, hx, hy, 185))
      drawHumanoid(g, hx, hy, 1.75, 1, HERO_LOOK, pose('cheer', 0.6), 0.6);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = '#2a2a30';
      const x = (i * 23) % W, y = H - 8 + (i % 3) * 3;
      g.beginPath(); g.arc(x, y - 26, 9, 0, Math.PI * 2); g.fill(); g.fillRect(x - 11, y - 18, 22, 30);
    }
  }
  if (tabloid) return drawStamp(g, W, kind === 'deal' ? 'SPONSORED?!' : 'SHOCKING!');
  // Classic newsprint: grayscale with a slight warm tint.
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const n = ((i >> 2) % 3 === 0 ? -8 : 0);
    d[i] = v + 8 + n; d[i + 1] = v + 4 + n; d[i + 2] = v - 6 + n;
  }
  g.putImageData(img, 0, 0);
}
