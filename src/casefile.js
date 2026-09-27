// A detective case, independent of how it's presented (2D crime scene by day, 3D club by night).
// Owns the suspects, the clues that point at the culprit, what's been found/photographed,
// the evidence cards, the case board (notebook + accusation) and the result sent to the newspaper.
import { ATTRS, FIRST_NAMES, LAST_NAMES } from './data.js';
import { pick, shuffle } from './util.js';
import { dialog, openModal, closeModal } from './ui.js';
import { npcLook, portrait } from './art.js';
import { glyphURL } from './evidenceart.js';
import { sfx } from './sfx.js';

export const CLUES_TO_ACCUSE = 3;

// Suspects' hair shows on their mugshots, so a hair clue can be read off the board as well as the chips.
const HAIR_COL = { 'bright red hair': '#d8342a', 'silver hair': '#c8ccd4', 'jet-black hair': '#121216' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = (html) => html.replace(/<\/?b>/g, '');

export class CaseFile {
  /**
   * @param jobs     pool of suspect occupations for this kind of scene
   * @param methods  how each clue is discovered, one per clue (e.g. 'visible', 'xray', 'witness')
   */
  constructor(jobs, methods = ['visible', 'visible', 'xray', 'witness']) {
    const keys = shuffle(Object.keys(ATTRS)).slice(0, methods.length);
    const mk = () => Object.fromEntries(keys.map((k) => [k, pick(ATTRS[k].values)]));
    const diff = (a, b) => keys.filter((k) => a[k] !== b[k]).length;
    // The culprit differs from every innocent in ≥2 traits, so any 3 clues are enough to tell them apart.
    const culprit = mk();
    const attrs = [culprit];
    for (let guard = 0; attrs.length < 3 && guard < 500; guard++) {
      const s = mk();
      if (diff(s, culprit) >= 2 && attrs.every((o) => diff(o, s) >= 1)) attrs.push(s);
    }
    const js = shuffle([...jobs]), first = shuffle([...FIRST_NAMES]), last = shuffle([...LAST_NAMES]);
    this.keys = keys;
    this.suspects = shuffle(attrs.map((a, i) => {
      const look = npcLook('civilian');
      if (a.hair) { look.hair = HAIR_COL[a.hair]; if (look.hairStyle === 'bald') look.hairStyle = 'short'; }
      return { attrs: a, name: `${first[i]} ${last[i]}`, job: js[i % js.length], culprit: a === culprit, look };
    }));
    const ms = shuffle([...methods]);
    this.clues = keys.map((k, i) => ({ key: k, value: culprit[k], method: ms[i], found: false, photo: false }));
    this.photos = 0;
    this.order = []; // discovery order → evidence numbers
  }

  get culprit() { return this.suspects.find((s) => s.culprit); }
  get found() { return this.clues.filter((c) => c.found); }
  get canAccuse() { return this.found.length >= CLUES_TO_ACCUSE; }
  byMethod(m) { return this.clues.filter((c) => c.method === m); }

  /** Human-readable clue text (HTML). */
  text(c) { return ATTRS[c.key].clue[c.value]; }
  label(c) { return ATTRS[c.key].label; }
  /** Evidence marker number (1-based, in the order found). */
  num(c) { const i = this.order.indexOf(c); return i < 0 ? 0 : i + 1; }

  /** Mark a clue found. Returns false if it already was. */
  find(c) { if (c.found) return false; c.found = true; this.order.push(c); return true; }

  /** Photograph a found clue. Returns false if not possible. */
  photograph(c) { if (!c.found || c.photo) return false; c.photo = true; this.photos++; return true; }

  /** Any unfound clue (optionally excluding some discovery methods) — used for bonus tips. */
  anyUnfound(exclude = []) { return this.clues.find((c) => !c.found && !exclude.includes(c.method)); }

  /** The "CLUE FOUND" moment: an inked evidence card with the clue's drawing. */
  async reveal(c, how, hint = '') {
    if (!c.found) this.find(c);
    await dialog({
      title: 'CLUE FOUND!', speaker: `Evidence #${this.num(c)} · ${this.label(c)}`, cls: 'evidence',
      text: `<div class="ev"><img class="ev-glyph" src="${glyphURL(c.key, c.value)}" alt=""><div class="ev-txt">${how ? `<i>${how}</i>` : ''}<p>${this.text(c)}</p></div></div>${hint ? `<span class="hint">${hint}</span>` : ''}`,
    });
  }

  notes(title, hintWhenEmpty) { return this.board(title, { hint: this.found.length ? '' : hintWhenEmpty }); }

  /** Suspect board with trait matching. Resolves to the accused suspect, or null. */
  async accuse(title = '') {
    const i = await this.board(title, { accuse: true });
    if (i === null || i === undefined) return null;
    const s = this.suspects[i];
    await this.revealAccused(s);
    return s;
  }

  /**
   * The case board: evidence cards pinned along the top, suspects' mugshots below, red string from
   * each clue to every suspect it fits. In accuse mode each mugshot gets an ACCUSE button.
   * Resolves to the chosen suspect index (accuse mode) or null.
   */
  board(title, { accuse = false, hint = '' } = {}) {
    const found = this.found;
    const miss = (s) => found.some((c) => c.value !== s.attrs[c.key]);
    const ev = this.keys.map((k) => {
      const c = this.clues.find((q) => q.key === k);
      if (!c.found) return `<div class="cb-card unk" data-k="${k}"><div class="cb-q">?</div><b>${esc(ATTRS[k].label)}</b><small>unknown</small></div>`;
      return `<div class="cb-card" data-k="${k}" style="--r:${((this.num(c) * 37) % 7) - 3}deg"><i class="cb-pin"></i><span class="cb-no">${this.num(c)}</span><img src="${glyphURL(c.key, c.value, 72)}" alt=""><b>${esc(ATTRS[k].label)}</b><small>${esc(c.value)}</small>${c.photo ? '<em class="cb-ph">PHOTO</em>' : ''}</div>`;
    }).join('');
    const sus = this.suspects.map((s, i) => `<div class="cb-mug${miss(s) ? ' out' : ''}" data-i="${i}">
      <div class="cb-photo"></div>
      <div class="cb-info"><b>${esc(s.name)}</b><small>${esc(s.job)}</small><div class="cb-chips">${this.keys.map((k) => {
        const c = found.find((q) => q.key === k);
        const cls = c ? (c.value === s.attrs[k] ? 'match' : 'miss') : '';
        return `<span class="chip ${cls}" data-k="${k}">${esc(s.attrs[k])}</span>`;
      }).join('')}</div></div>
      ${accuse ? `<button class="cb-acc" data-i="${i}" ${this.canAccuse ? '' : 'disabled'}>ACCUSE</button>` : ''}
      ${miss(s) ? '<div class="cb-stamp">RULED OUT</div>' : ''}</div>`).join('');
    const msg = hint || (accuse ? (this.canAccuse ? 'Who did it? The red string shows which clues fit whom.' : `Find at least ${CLUES_TO_ACCUSE} clues before you accuse anyone (${found.length}/${CLUES_TO_ACCUSE}).`)
      : `Clues ${found.length}/${this.clues.length} · Photos ${this.photos}`);
    const el = openModal(`<div class="cb">
      <div class="cb-head"><b>${accuse ? 'SUSPECTS' : 'CASE BOARD'}</b><span>${esc(title)}</span></div>
      <div class="cb-ev">${ev}</div>
      <div class="cb-sus">${sus}</div>
      <svg class="cb-strings"></svg>
      <div class="cb-foot"><span>${msg}</span><button class="cb-close"><span class="k">${accuse ? 4 : 1}</span>${accuse ? 'Keep investigating' : 'Back to the scene'}</button></div>
    </div>`, 'caseboard');
    el.querySelectorAll('.cb-mug').forEach((m) => {
      const cv = portrait(this.suspects[+m.dataset.i].look);
      m.querySelector('.cb-photo').appendChild(cv);
    });
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
        const ax = a.left + a.width / 2 - R.left, ay = a.bottom - R.top - 4;
        el.querySelectorAll(`.chip.match[data-k="${c.key}"]`).forEach((chip) => {
          const b = chip.getBoundingClientRect();
          const bx = b.left + b.width / 2 - R.left, by = b.top - R.top + 2;
          const sag = Math.min(26, Math.abs(bx - ax) * 0.12 + 8);
          out += `<path d="M${ax} ${ay} Q${(ax + bx) / 2} ${(ay + by) / 2 + sag} ${bx} ${by}"/><circle cx="${bx}" cy="${by}" r="3.2"/>`;
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
        if (accuse && this.canAccuse && n >= 1 && n <= this.suspects.length) { e.preventDefault(); e.stopPropagation(); close(n - 1); }
        else if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || n === (accuse ? 4 : 1)) { e.preventDefault(); e.stopPropagation(); close(null); }
      };
      addEventListener('keydown', onKey, true);
    });
  }

  /** The accusation: mugshot, beat, then the stamp slams down. */
  revealAccused(s) {
    const good = s.culprit;
    const el = openModal(`<div class="rv ${good ? 'good' : 'bad'}">
      <div class="rv-kick">YOU ACCUSE…</div>
      <div class="rv-photo"></div>
      <div class="rv-name">${esc(s.name)}</div><div class="rv-job">${esc(s.job)}</div>
      <div class="rv-stamp">${good ? 'GUILTY!' : 'WRONG!'}</div>
      <div class="rv-sub">${good ? 'Case closed. The evidence fits like a glove.' : 'Airtight alibi. The real culprit is getting away…'}</div>
    </div>`, 'reveal');
    el.querySelector('.rv-photo').appendChild(portrait(s.look));
    setTimeout(() => sfx.pow(), 650);
    return new Promise((resolve) => {
      let done = false;
      const close = () => { if (done) return; done = true; closeModal(el); resolve(); };
      setTimeout(() => el.addEventListener('click', close), 700);
      setTimeout(close, 2300);
    });
  }

  /** endZone() payload for a correct accusation. */
  winResult(reward, extraRep = 0) {
    const c = this.culprit;
    return { outcome: 'win', rep: reward + this.photos * 4 + extraRep, culprit: c.name, job: c.job, photos: this.photos, photo: 'case' };
  }

  loseResult(accused) {
    const c = this.culprit;
    return { outcome: 'lose', rep: -10, text: `Wrong suspect! ${accused.name} had an alibi, and the real culprit, ${c.name} (${c.job}), slipped away.` };
  }
}

export { plain };
export function randomPerson() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
