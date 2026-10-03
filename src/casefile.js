// A detective case, independent of how it's presented (2D crime scene by day, 3D club by night).
// Owns the suspects, the clues that point at the culprit, what's been found/photographed,
// and the result sent to the newspaper. Its on-screen paper trail (evidence card, case board,
// accusation splash) lives in caseboard.js.
import { ATTRS, FIRST_NAMES, LAST_NAMES } from './data.js';
import { pick, shuffle } from './util.js';
import { npcLook } from './art.js';
import { evidenceCard, caseBoard, accuseSplash } from './caseboard.js';

export const CLUES_TO_ACCUSE = 3;

// Suspects' hair shows on their mugshots, so a hair clue can be read off the board as well as the chips.
const HAIR_COL = { 'bright red hair': '#d8342a', 'silver hair': '#c8ccd4', 'jet-black hair': '#121216' };

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

  /** The "CLUE FOUND" moment (caseboard.evidenceCard). `from`: screen point the item flies from. */
  async reveal(c, how, hint = '', from = null) {
    if (!c.found) this.find(c);
    await evidenceCard(this, c, how, hint, from);
  }

  notes(title, hintWhenEmpty) { return caseBoard(this, title, { hint: this.found.length ? '' : hintWhenEmpty, clues: CLUES_TO_ACCUSE }); }

  /** Suspect board with trait matching, then the splash panel. Resolves to the accused, or null. */
  async accuse(title = '') {
    const i = await caseBoard(this, title, { accuse: true, clues: CLUES_TO_ACCUSE });
    if (i === null || i === undefined) return null;
    const s = this.suspects[i];
    await accuseSplash(this, s);
    return s;
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
