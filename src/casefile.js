// A detective case, independent of how it's presented (2D crime scene by day, 3D club by night).
// Owns the suspects, the clues that point at the culprit, what's been found/photographed,
// the notebook + accusation dialogs, and the result sent to the newspaper.
import { ATTRS, FIRST_NAMES, LAST_NAMES } from './data.js';
import { pick, shuffle } from './util.js';
import { dialog } from './ui.js';

export const CLUES_TO_ACCUSE = 3;

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
    this.suspects = shuffle(attrs.map((a, i) => ({ attrs: a, name: `${first[i]} ${last[i]}`, job: js[i % js.length], culprit: a === culprit })));
    const ms = shuffle([...methods]);
    this.clues = keys.map((k, i) => ({ key: k, value: culprit[k], method: ms[i], found: false, photo: false }));
    this.photos = 0;
  }

  get culprit() { return this.suspects.find((s) => s.culprit); }
  get found() { return this.clues.filter((c) => c.found); }
  get canAccuse() { return this.found.length >= CLUES_TO_ACCUSE; }
  byMethod(m) { return this.clues.filter((c) => c.method === m); }

  /** Human-readable clue text (HTML). */
  text(c) { return ATTRS[c.key].clue[c.value]; }
  label(c) { return ATTRS[c.key].label; }

  /** Mark a clue found. Returns false if it already was. */
  find(c) { if (c.found) return false; c.found = true; return true; }

  /** Photograph a found clue. Returns false if not possible. */
  photograph(c) { if (!c.found || c.photo) return false; c.photo = true; this.photos++; return true; }

  /** Any unfound clue (optionally excluding some discovery methods) — used for bonus tips. */
  anyUnfound(exclude = []) { return this.clues.find((c) => !c.found && !exclude.includes(c.method)); }

  async notes(title, hintWhenEmpty) {
    const found = this.found;
    const html = found.length
      ? found.map((c) => `<div class="item"><b>${this.label(c)}:</b> ${this.text(c)}${c.photo ? ' 📸' : ''}</div>`).join('')
      : `<div class="item">${hintWhenEmpty}</div>`;
    await dialog({ title: `Notebook — ${title}`, text: `<div class="list">${html}</div>Clues: ${found.length}/${this.clues.length} · Photos: ${this.photos}` });
  }

  /** Suspect board with trait matching. Resolves to the accused suspect, or null. */
  async accuse() {
    const found = this.found;
    const html = this.suspects.map((s) => `<div class="item"><b>${s.name}</b> — ${s.job}<br>${this.keys.map((k) => {
      const c = found.find((c) => c.key === k);
      const cls = c ? (c.value === s.attrs[k] ? 'match' : 'miss') : '';
      return `<span class="chip ${cls}">${s.attrs[k]}</span>`;
    }).join('')}</div>`).join('');
    const v = await dialog({
      title: 'Suspects',
      text: `<div class="list">${html}</div>${this.canAccuse ? 'Who did it?' : `Find at least ${CLUES_TO_ACCUSE} clues before you accuse anyone (${found.length}/${CLUES_TO_ACCUSE}).`}`,
      options: [...(this.canAccuse ? this.suspects.map((s, i) => ({ label: `Accuse ${s.name}`, value: i, cls: 'bad' })) : []), { label: 'Keep investigating', value: null }],
    });
    return v === null || v === undefined ? null : this.suspects[v];
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

export function randomPerson() { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
