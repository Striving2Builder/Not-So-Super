// "Supergirl or Impostor?": a picture of "her" full screen, two buttons. The Polaroids she grabs in
// the city and the posters in the hotel's halls both use it. A wrong call gets the comic yellow box
// mocking her. The fakes are placeholders until the user's own impostor pictures arrive: a real
// frame with one of her colours swapped (the impostor's wig, her knockoff cape, the cheap suit),
// strong early in the act and subtler as it goes on.
import { openModal, closeModal } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, shuffle } from '../util.js';
import { MOCK } from './act1.js';

/** The tells a fake can have: which of her colours the knockoff gets wrong. */
const TELLS = {
  hair: { what: 'the hair: a wig, a shade too dark', test: (h, s, l) => h > 32 && h < 66 && s > 0.28 && l > 0.32 && l < 0.92, to: (h, s, l, k) => [h - 22 * k, s * (1 - 0.15 * k), l * (1 - 0.42 * k)] },
  cape: { what: 'the red: cheap vinyl, too pink', test: (h, s, l) => (h < 14 || h > 342) && s > 0.42 && l > 0.15 && l < 0.8, to: (h, s, l, k) => [h - 34 * k + (h < 14 ? 360 : 0), s, l * (1 + 0.12 * k)] },
  suit: { what: 'the blue: wrong fabric, nearly teal', test: (h, s, l) => h > 195 && h < 250 && s > 0.3 && l > 0.12, to: (h, s, l, k) => [h - 38 * k, s, l * (1 + 0.1 * k)] },
};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hsl2rgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/**
 * A fake made from a real picture: one tell, `k` strong (1 = obvious, ~0.5 = subtle), inside the
 * rect (the photo area of a Polaroid). Null when the picture hasn't enough of any of her colours
 * for a tell to show (the caller then uses it as a real one: a fair call either way).
 */
export function impostorize(src, k = 1, rect = null) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const [x, y, w, h] = rect || [0, 0, c.width, c.height];
  let d;
  try { d = g.getImageData(x, y, w, h); } catch (e) { return null; } // (tainted canvas)
  const p = d.data, n = w * h;
  for (const id of shuffle(Object.keys(TELLS))) {
    const T = TELLS[id];
    let hits = 0;
    for (let i = 0; i < p.length; i += 16) { const [hh, ss, ll] = rgb2hsl(p[i], p[i + 1], p[i + 2]); if (T.test(hh, ss, ll)) hits++; }
    if (hits * 4 < n * 0.006) continue; // under 0.6% of the picture: nobody could see it
    const out = new ImageData(new Uint8ClampedArray(p), w, h), q = out.data;
    for (let i = 0; i < q.length; i += 4) {
      const [hh, ss, ll] = rgb2hsl(q[i], q[i + 1], q[i + 2]);
      if (!T.test(hh, ss, ll)) continue;
      const [r2, g2, b2] = hsl2rgb(...T.to(hh, ss, ll, k));
      q[i] = r2; q[i + 1] = g2; q[i + 2] = b2;
    }
    g.putImageData(out, x, y);
    c.tell = T.what;
    return c;
  }
  return null;
}

/** How strong the next fake's tell is: obvious at first, subtler as she calls more of them. */
export function fakeStrength(called) { return 1 - 0.45 * Math.min(1, (called || 0) / 12); }

/**
 * The call. `img` a canvas, `fake` the truth. `title`/`sub` over it, `score` (optional) a line
 * under it (the hotel's poster tally). Resolves { right, called: 'real' | 'fake' }.
 */
export function spotCall({ img, fake, title = 'SUPERGIRL OR IMPOSTOR?', sub = '', score = '', tell = '' }) {
  return new Promise((resolve) => {
    const src = img.toDataURL('image/jpeg', 0.85);
    const el = openModal(`<div class="spot">
        <div class="spot-head"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>
        <div class="spot-pic"><img src="${src}" alt=""><div class="spot-stamp"></div></div>
        <div class="spot-mock"></div>
        <div class="spot-btns"><button class="spot-b real" data-v="real">SUPERGIRL</button><button class="spot-b fake" data-v="fake">IMPOSTOR</button></div>
        <div class="spot-score">${score}</div>
      </div>`, 'spotcall');
    let picked = null;
    const finish = () => { removeEventListener('keydown', onKey, true); closeModal(el); resolve(picked); };
    const choose = (v) => {
      if (picked) return finish();
      const right = (v === 'fake') === !!fake;
      picked = { right, called: v };
      sfx[right ? 'pickup' : 'lose']?.();
      const st = el.querySelector('.spot-stamp');
      st.textContent = fake ? 'FAKE' : 'REAL';
      st.className = `spot-stamp on ${fake ? 'fake' : 'real'}`;
      const mock = el.querySelector('.spot-mock');
      mock.textContent = right ? pick(MOCK.right) : pick(fake ? MOCK.fakeCalledReal : MOCK.realCalledFake);
      mock.className = `spot-mock on ${right ? 'right' : 'wrong'}`;
      if (fake && tell) el.querySelector('.spot-score').innerHTML = `${score ? score + ' · ' : ''}The tell: ${tell}.`;
      const btns = el.querySelector('.spot-btns');
      btns.innerHTML = '<button class="spot-b next">CONTINUE</button>';
      btns.querySelector('.next').addEventListener('click', finish);
    };
    el.querySelectorAll('.spot-b').forEach((b) => b.addEventListener('click', () => choose(b.dataset.v)));
    const onKey = (e) => {
      if (picked && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); finish(); return; }
      if (picked) return;
      if (e.key === '1' || e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); choose('real'); }
      else if (e.key === '2' || e.key.toLowerCase() === 'i') { e.preventDefault(); e.stopPropagation(); choose('fake'); }
    };
    addEventListener('keydown', onKey, true);
  });
}
