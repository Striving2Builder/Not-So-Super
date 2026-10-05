// The detective nightclubs' case engine: which case a club visit plays, the clues found so far, the
// case board's lines and the leads a solved case puts on the map. Cases are data
// (src/nightclub/cases/*.js); a second one (blackmail) slots in here.
import { SQUIRT } from './cases/squirt.js';

export const CLUB_CASES = { squirt: SQUIRT };

/** The case for this visit (one case for now; later by the zone's theme, e.g. 'blackmail'). */
export function pickCase(zone) { return CLUB_CASES[zone?.clubCase] || SQUIRT; }

export class CaseBook {
  constructor(def) { this.def = def; this.found = new Set(); }

  clue(kind, id) { return this.def.clues[`${kind}:${id}`] || null; }
  has(kind, id) { return this.found.has(`${kind}:${id}`); }

  /** Mark a clue found; true the first time. */
  find(kind, id) {
    const k = `${kind}:${id}`, fresh = !this.found.has(k);
    this.found.add(k);
    return fresh;
  }

  /** Clues that count toward the accusation (not flavour). */
  get count() { return [...this.found].filter((k) => this.def.clues[k] && !this.def.clues[k].flavour).length; }
  get ready() { return this.count >= this.def.need; }

  /** Case-board lines, in the order found. */
  notes() { return [...this.found].map((k) => this.def.clues[k]).filter(Boolean).map((c) => c.note); }

  /** A counted clue she hasn't found (the memory-fragment reward). */
  unfound() { return Object.keys(this.def.clues).filter((k) => !this.found.has(k) && !this.def.clues[k].flavour && !this.def.clues[k].drink); }

  /** The map leads this solve unlocks: every lead with a clue found (at least the first). */
  leads() {
    const got = this.def.leads.filter((l) => l.by.some((k) => this.found.has(k)));
    return got.length ? got : this.def.leads.slice(0, 1);
  }
}
