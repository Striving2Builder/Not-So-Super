// Comic-book overlay: POW! bursts, speech/shout/thought bubbles, narrator captions,
// "EXTRA!" news flashes and the spinning-emblem scene transition. Pure DOM + CSS animation,
// drawn in screen space over whichever game mode is running.
import { $, pick, rand } from './util.js';

const MAX_BUBBLES = 3, MAX_BURSTS = 4;
const BURST_COLORS = [
  ['#ffe600', '#ff2d2d'], ['#ff2d2d', '#ffe600'], ['#39c6ff', '#ffe600'], ['#ff9a1f', '#fff36b'],
  ['#b04dff', '#ffe600'], ['#ffffff', '#ff2d2d'], ['#5dff6b', '#1e3cff'],
];
const INK = ['#d8122e', '#1e3cff', '#111111', '#ffffff'];

let enabled = true;
const layer = () => $('comic-layer');
const count = (cls) => layer().querySelectorAll('.' + cls).length;

function drop(el, ms) {
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
}

/** Star-burst polygon points for an SVG. */
function burstPoints(cx, cy, r1, r2, spikes, jitter) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + rand(-0.06, 0.06);
    const r = (i % 2 ? r2 : r1) * (1 + rand(-jitter, jitter));
    pts.push((cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1));
  }
  return pts.join(' ');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function clampX(x, halfW) { return Math.max(halfW + 8, Math.min(innerWidth - halfW - 8, x)); }

export const comic = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; if (!enabled) this.clear(); return enabled; },
  clear() { const l = layer(); if (l) l.innerHTML = ''; },

  /** POW! BAM! etc. at a screen position. size 1 = normal, 1.6 = finisher. */
  pow(word, x, y, { size = 1, colors } = {}) {
    if (!enabled) return;
    const l = layer();
    while (count('pow') >= MAX_BURSTS) l.querySelector('.pow').remove();
    const [fill, rim] = colors || pick(BURST_COLORS);
    const ink = pick(INK.filter((c) => c !== fill));
    const el = document.createElement('div');
    el.className = 'pow';
    const base = Math.min(innerWidth, innerHeight) * 0.22 * size;
    const w = Math.max(110, Math.min(260 * size, base * 1.35)), h = w * 0.78;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.left = clampX(x, w / 2) - w / 2 + 'px';
    el.style.top = Math.max(60, Math.min(innerHeight - h - 10, y - h / 2)) + 'px';
    el.style.setProperty('--rot', rand(-18, 18).toFixed(1) + 'deg');
    const fs = Math.min(64, (w / Math.max(3, word.length)) * 1.2);
    el.innerHTML = `<svg viewBox="0 0 200 156" preserveAspectRatio="none">
      <polygon points="${burstPoints(100, 78, 96, 58, 13, 0.12)}" fill="${rim}" stroke="#111" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="${burstPoints(100, 78, 78, 50, 11, 0.1)}" fill="${fill}" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
    </svg><span style="font-size:${fs}px;color:${ink}">${esc(word)}</span>`;
    l.appendChild(el);
    drop(el, 700 + size * 250);
  },

  /** Speech bubble whose tail points at (x, y). kind: 'speech' | 'shout' | 'thought'. */
  say(text, x, y, { kind = 'speech', speaker = '', ms } = {}) {
    if (!enabled) return;
    const l = layer();
    while (count('bubble') >= MAX_BUBBLES) l.querySelector('.bubble').remove();
    const el = document.createElement('div');
    el.className = `bubble ${kind}`;
    el.innerHTML = `${speaker ? `<b>${esc(speaker)}</b>` : ''}${esc(text)}`;
    l.appendChild(el);
    // Place above the point (or below if too close to the top), keeping it on screen.
    const r = el.getBoundingClientRect();
    const below = y - r.height - 26 < 70;
    const left = clampX(x, r.width / 2) - r.width / 2;
    el.style.left = left + 'px';
    el.style.top = (below ? y + 26 : y - r.height - 26) + 'px';
    el.style.setProperty('--tail', Math.max(18, Math.min(r.width - 18, x - left)) + 'px');
    if (below) el.classList.add('below');
    drop(el, ms || 1900 + text.length * 45);
  },

  /** Yellow narrator caption box ("MEANWHILE..."). */
  caption(text, { ms, where = 'top' } = {}) {
    if (!enabled) return;
    const l = layer();
    l.querySelectorAll('.caption').forEach((c) => c.remove());
    const el = document.createElement('div');
    el.className = `caption ${where}`;
    el.textContent = text;
    l.appendChild(el);
    drop(el, ms || 2600 + text.length * 40);
  },

  /** Newspaper flash about her reputation. tone: 'good' | 'bad' | 'neutral'. */
  headline(text, { tone = 'neutral', kicker } = {}) {
    if (!enabled) return;
    const l = layer();
    l.querySelectorAll('.newsflash').forEach((c) => c.remove());
    const el = document.createElement('div');
    el.className = `newsflash ${tone}`;
    const k = kicker || (tone === 'good' ? 'EXTRA! EXTRA!' : tone === 'bad' ? 'SCANDAL!' : 'NEWS FLASH');
    el.innerHTML = `<i>${esc(k)}</i><span>${esc(text)}</span>${tone === 'bad' ? '<em>BOO!</em>' : tone === 'good' ? '<em>★</em>' : ''}`;
    l.appendChild(el);
    drop(el, 4200);
  },

  /** The spinning-emblem scene transition (sweeps the screen, plays over whatever loads underneath). */
  spin(label = '') {
    if (!enabled) return;
    const l = layer();
    l.querySelectorAll('.spinner').forEach((c) => c.remove());
    const el = document.createElement('div');
    el.className = 'spinner';
    el.innerHTML = `<div class="rays"></div><div class="shield"><span>$</span></div>${label ? `<div class="spin-label">${esc(label)}</div>` : ''}`;
    l.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  },
};
