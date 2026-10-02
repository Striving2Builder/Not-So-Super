// Comic-book overlay: POW! bursts, speech/shout/thought bubbles, narrator captions,
// "EXTRA!" news flashes and the spinning-emblem scene transition. Pure DOM + CSS animation,
// drawn in screen space over whichever game mode is running.
import { $, pick, rand } from './util.js';

const MAX_BUBBLES = 3, MAX_BURSTS = 4;
const BURST_COLORS = [
  ['#ffe600', '#ff2d2d'], ['#ff2d2d', '#ffe600'], ['#39c6ff', '#ffe600'], ['#ff9a1f', '#fff36b'],
  ['#b04dff', '#ffe600'], ['#ffffff', '#ff2d2d'], ['#5dff6b', '#1e3cff'],
];
// no black: the word already has a black stroke + shadow, so black letters fuse into a solid block
const INK = ['#d8122e', '#1e3cff', '#ffffff'];

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

// The story slot: narrator captions and news flashes share one comic panel in the lower left and
// take turns there, so they never pile up. A new caption replaces any caption still showing or
// waiting (she's moved on); headlines queue behind. Nothing plays more than STALE ms late.
const STORY_GAP = 250, STORY_MAX = 3, STORY_STALE = 9000;
const story = { el: null, q: [] };
function storyEnd(el) {
  if (!el.isConnected || el._ending) return;
  el._ending = true;
  el.classList.add('out');
  setTimeout(() => { el.remove(); if (story.el === el) story.el = null; setTimeout(storyNext, STORY_GAP); }, 350);
}
function storyNext() {
  if (story.el || !layer()) return;
  const now = performance.now();
  story.q = story.q.filter((it) => now - it.at < STORY_STALE);
  const it = story.q.shift();
  if (!it) return;
  const el = it.make();
  el._key = it.key; el._kind = it.kind;
  layer().appendChild(el);
  story.el = el;
  setTimeout(() => storyEnd(el), it.ms);
}
function storyPush(kind, key, make, ms) {
  if (story.el && story.el._key === key && !story.el._ending) return; // already on screen
  story.q = story.q.filter((it) => it.key !== key && !(kind === 'caption' && it.kind === 'caption'));
  story.q.push({ kind, key, make, ms, at: performance.now() });
  while (story.q.length > STORY_MAX) story.q.shift();
  if (kind === 'caption' && story.el && story.el._kind === 'caption') storyEnd(story.el); // superseded
  storyNext();
}

export const comic = {
  get enabled() { return enabled; },
  toggle() { enabled = !enabled; if (!enabled) this.clear(); return enabled; },
  clear() { const l = layer(); if (l) l.innerHTML = ''; story.el = null; story.q = []; },

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

  /**
   * Speech bubble whose tail points at (x, y). kind: 'speech' | 'shout' | 'thought'.
   * anchor: optional () => {x, y} | null, called every frame so the bubble rides along with a
   * speaker in a scrolling world; returning null pops the bubble early.
   */
  say(text, x, y, { kind = 'speech', speaker = '', ms, anchor } = {}) {
    if (!enabled) return;
    const l = layer();
    const max = innerHeight < 480 ? 2 : MAX_BUBBLES; // phones: two voices at a time is plenty
    while (count('bubble') >= max) l.querySelector('.bubble').remove();
    const el = document.createElement('div');
    el.className = `bubble ${kind}`;
    el.innerHTML = `${speaker ? `<b>${esc(speaker)}</b>` : ''}${esc(text)}`;
    l.appendChild(el);
    // Place above the point (or below if too close to the top), keeping it on screen.
    const r = el.getBoundingClientRect();
    const below = y - r.height - 26 < 70;
    const place = (px, py) => {
      const left = clampX(px, r.width / 2) - r.width / 2;
      el.style.left = left + 'px';
      // whole bubble stays on screen (tall three-line rumours used to run off the bottom)
      el.style.top = Math.max(56, Math.min(innerHeight - r.height - 8, below ? py + 26 : py - r.height - 26)) + 'px';
      el.style.setProperty('--tail', Math.max(18, Math.min(r.width - 18, px - left)) + 'px');
    };
    place(x, y);
    if (below) el.classList.add('below');
    drop(el, ms || 1900 + text.length * 45);
    if (anchor) {
      const follow = () => {
        if (!el.isConnected || el.classList.contains('out')) return;
        const p = anchor();
        if (!p || p.x < -40 || p.y < -40 || p.x > innerWidth + 40 || p.y > innerHeight + 40) {
          el.classList.add('out'); setTimeout(() => el.remove(), 350);
          return;
        }
        place(p.x, p.y);
        requestAnimationFrame(follow);
      };
      requestAnimationFrame(follow);
    }
  },

  /** Yellow narrator caption box ("MEANWHILE..."), in the story slot. */
  caption(text, { ms } = {}) {
    if (!enabled) return;
    storyPush('caption', text, () => {
      const el = document.createElement('div');
      el.className = 'caption';
      el.textContent = text;
      return el;
    }, ms || 2600 + text.length * 40);
  },

  /** Newspaper flash about her reputation. tone: 'good' | 'bad' | 'neutral'. */
  headline(text, { tone = 'neutral', kicker } = {}) {
    if (!enabled) return;
    storyPush('headline', text, () => {
      const el = document.createElement('div');
      el.className = `newsflash ${tone}`;
      const k = kicker || (tone === 'good' ? 'EXTRA! EXTRA!' : tone === 'bad' ? 'SCANDAL!' : 'NEWS FLASH');
      el.innerHTML = `<i>${esc(k)}</i><span>${esc(text)}</span>${tone === 'bad' ? '<em>BOO!</em>' : tone === 'good' ? '<em>★</em>' : ''}`;
      return el;
    }, 4200);
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
