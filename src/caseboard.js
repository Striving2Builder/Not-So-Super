// The case's paper trail on screen: the "CLUE FOUND!" evidence card, the cork case board (notebook +
// suspects with red string), and the accusation splash panel. Pure DOM; styles in style.css under
// "=== investigation ===". Reads a CaseFile, never changes it (the caller applies the verdict).
import { ATTRS } from './data.js';
import { dialog, openModal, closeModal } from './ui.js';
import { portrait, drawHumanoid, pose, HERO_LOOK } from './art.js';
import { glyphURL } from './evidenceart.js';
import { sfx } from './sfx.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Splash timing (ms): the panel slams in, the hero steps up, the verdict lands, the recap follows.
const REVEAL = { hero: 320, stamp: 700, recap: 1250, close: 4200, tapAfter: 900 };

/** A crisp head-and-shoulders render of a look, `h` px tall (portrait() is too small to blow up). */
function bust(look, h, facing = 1, poseName = 'stand') {
  const c = document.createElement('canvas'); c.height = h; c.width = Math.round(h * 0.8);
  drawHumanoid(c.getContext('2d'), c.width / 2, h * 1.62, h / 70, facing, look, pose(poseName, 0), 0);
  return c;
}

/**
 * The evidence card. `from` (screen px) is where the item was found: its drawing flies from there
 * into the card, so the find reads as picking something up.
 */
export async function evidenceCard(cf, c, how, hint = '', from = null) {
  const shown = dialog({
    title: 'CLUE FOUND!', speaker: `Evidence #${cf.num(c)} · ${cf.label(c)}`, cls: 'evidence',
    text: `<div class="ev"><div class="ev-art"><img class="ev-glyph" src="${glyphURL(c.key, c.value, 256)}" alt=""></div><div class="ev-txt">${how ? `<i>${how}</i>` : ''}<p>${cf.text(c)}</p>${hint ? `<span class="hint">${hint}</span>` : ''}</div></div>`,
  });
  const img = [...document.querySelectorAll('#modal-root .ev-glyph')].pop();
  if (img && from) {
    const r = img.getBoundingClientRect();
    img.style.setProperty('--fx', `${from.x - (r.left + r.width / 2)}px`);
    img.style.setProperty('--fy', `${from.y - (r.top + r.height / 2)}px`);
    img.classList.add('fly');
  }
  return shown;
}

/**
 * The case board: evidence pinned along the top (the actual Polaroid once photographed), suspects'
 * mugshots below, red string from each clue to every suspect it fits, pinned at the chip's edge.
 * In accuse mode each mugshot gets an ACCUSE button. Resolves to the chosen suspect index or null.
 */
export function caseBoard(cf, title, { accuse = false, hint = '', clues = 3 } = {}) {
  const found = cf.found;
  const miss = (s) => found.some((c) => c.value !== s.attrs[c.key]);
  const ev = cf.keys.map((k) => {
    const c = cf.clues.find((q) => q.key === k);
    if (!c.found) return `<div class="cb-card unk" data-k="${k}"><div class="cb-q">?</div><b>${esc(ATTRS[k].label)}</b><small>unknown</small></div>`;
    const art = c.snap ? `<img class="cb-snap" src="${c.snap}" alt="">` : `<img src="${glyphURL(c.key, c.value, 72)}" alt="">`;
    return `<div class="cb-card${c.snap ? ' polaroid' : ''}" data-k="${k}" style="--r:${((cf.num(c) * 37) % 7) - 3}deg"><i class="cb-pin"></i><span class="cb-no">${cf.num(c)}</span>${art}<b>${esc(ATTRS[k].label)}</b><small>${esc(c.value)}</small></div>`;
  }).join('');
  const sus = cf.suspects.map((s, i) => `<div class="cb-mug${miss(s) ? ' out' : ''}" data-i="${i}" style="--r:${[-0.8, 0.7, -0.5][i % 3]}deg">
      <i class="cb-pin"></i><div class="cb-photo"></div>
      <div class="cb-info"><b>${esc(s.name)}</b><small>${esc(s.job)}</small><div class="cb-chips">${cf.keys.map((k) => {
        const c = found.find((q) => q.key === k);
        const cls = c ? (c.value === s.attrs[k] ? 'match' : 'miss') : '';
        return `<span class="chip ${cls}" data-k="${k}">${esc(s.attrs[k])}</span>`;
      }).join('')}</div></div>
      ${accuse ? `<button class="cb-acc" data-i="${i}" ${cf.canAccuse ? '' : 'disabled'}>ACCUSE</button>` : ''}
      ${miss(s) ? '<div class="cb-stamp">RULED OUT</div>' : ''}</div>`).join('');
  const msg = hint || (accuse ? (cf.canAccuse ? 'Who did it? The red string shows which clues fit whom.' : `Find at least ${clues} clues before you accuse anyone (${found.length}/${clues}).`)
    : `Clues ${found.length}/${cf.clues.length} · Photos ${cf.photos}`);
  const el = openModal(`<div class="cb">
      <div class="cb-head"><b>${accuse ? 'SUSPECTS' : 'CASE BOARD'}</b><span>${esc(title)}</span></div>
      <div class="cb-ev">${ev}</div>
      <svg class="cb-strings"></svg>
      <div class="cb-sus">${sus}</div>
      <div class="cb-foot"><span>${msg}</span><button class="cb-close">${accuse ? 'Keep investigating' : 'Back to the scene'}</button></div>
    </div>`, 'caseboard');
  el.querySelectorAll('.cb-mug').forEach((m) => m.querySelector('.cb-photo').appendChild(portrait(cf.suspects[+m.dataset.i].look)));
  // String runs from the card's pin to the top edge of each matching chip, ending in a pin head
  // just above the chip so it never sits on the words. The SVG sits between the rows: ruled-out
  // mugshots are stacked above it, so their strings pass underneath.
  const strings = () => {
    const svg = el.querySelector('.cb-strings'), root = el.querySelector('.cb');
    if (!svg || !root) return;
    const R = root.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
    let out = '';
    for (const c of found) {
      const card = el.querySelector(`.cb-card[data-k="${c.key}"]`);
      if (!card) continue;
      const a = card.getBoundingClientRect();
      const ax = a.left + a.width / 2 - R.left, ay = a.bottom - R.top - 6;
      el.querySelectorAll(`.chip.match[data-k="${c.key}"]`).forEach((chip) => {
        const b = chip.getBoundingClientRect();
        const bx = b.left - R.left + 3, by = b.top - R.top + 1; // the chip's top-left corner, clear of its words
        const sag = Math.min(26, Math.abs(bx - ax) * 0.12 + 8);
        out += `<path d="M${ax} ${ay} Q${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}"/><circle cx="${bx}" cy="${by}" r="4"/><circle class="hl" cx="${bx - 1.2}" cy="${by - 1.2}" r="1.3"/>`;
      });
    }
    svg.innerHTML = out;
  };
  requestAnimationFrame(() => requestAnimationFrame(strings));
  el.querySelector('.cb').addEventListener('scroll', strings, { passive: true });
  return new Promise((resolve) => {
    let done = false;
    const close = (v) => { if (done) return; done = true; removeEventListener('keydown', onKey, true); closeModal(el); sfx.click(); resolve(v); };
    el.querySelectorAll('.cb-acc').forEach((b) => b.addEventListener('click', () => close(+b.dataset.i)));
    el.querySelector('.cb-close').addEventListener('click', () => close(null));
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (accuse && cf.canAccuse && n >= 1 && n <= cf.suspects.length) { e.preventDefault(); e.stopPropagation(); close(n - 1); }
      else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(null); }
    };
    addEventListener('keydown', onKey, true);
  });
}

/**
 * The accusation as a splash page: a tilted panel slams in on the suspect's mugshot over a radial
 * burst, the hero steps into frame, the verdict lettering lands with a flash and shake, then three
 * small panels recap the evidence that convicted (or cleared) them.
 */
export function accuseSplash(cf, s) {
  const good = s.culprit;
  const recap = cf.found.slice(0, 3).map((c, i) => {
    const fits = s.attrs[c.key] === c.value;
    return `<div class="rv-rc ${fits ? 'fit' : 'no'}" style="--d:${REVEAL.recap + i * 160}ms"><img src="${c.snap || glyphURL(c.key, c.value, 96)}" alt=""><b>${esc(ATTRS[c.key].label)}</b><small>${esc(c.value)}</small><i>${fits ? '✓' : '✗'}</i></div>`;
  }).join('');
  const el = openModal(`<div class="rv2 ${good ? 'good' : 'bad'}">
      <div class="rv-burst"></div>
      <div class="rv-panel"><div class="rv-mug"></div><div class="rv-cap">${esc(s.name)}<small>${esc(s.job)}</small></div></div>
      <div class="rv-hero"></div>
      <div class="rv-word">${good ? 'GOTCHA!' : 'WRONG!'}</div>
      <div class="rv-stamp">${good ? 'GUILTY' : 'ALIBI'}</div>
      <div class="rv-recap">${recap}</div>
      <div class="rv-flash"></div>
    </div>`, 'reveal');
  el.querySelector('.rv-mug').appendChild(bust(s.look, 420));
  const hero = document.createElement('canvas'); hero.height = 560; hero.width = 300;
  drawHumanoid(hero.getContext('2d'), 150, 548, 2.5, -1, HERO_LOOK, pose('idle', 0), 0);
  el.querySelector('.rv-hero').appendChild(hero);
  setTimeout(() => { sfx.pow(); el.querySelector('.rv2')?.classList.add('hit'); }, REVEAL.stamp);
  return new Promise((resolve) => {
    let done = false;
    const close = () => { if (done) return; done = true; closeModal(el); resolve(); };
    setTimeout(() => el.addEventListener('click', close), REVEAL.tapAfter);
    setTimeout(close, REVEAL.close);
  });
}
