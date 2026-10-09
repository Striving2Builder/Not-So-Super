// The detective nightclubs' case engine: which case a club visit plays, the clues found so far, the
// case board's lines and the leads a solved case puts on the map. Cases are data
// (src/nightclub/cases/*.js): Super Squirt, the Polaroid Racket and the Earworm, plus the
// three story clubs' (Halo at the Hive, the Auction at the Gilded Cage, Flashpoint Live).
import { SQUIRT } from './cases/squirt.js';
import { BLACKMAIL } from './cases/blackmail.js';
import { EARWORM } from './cases/earworm.js';
import { HALO } from './cases/halo.js';
import { AUCTION } from './cases/auction.js';
import { FLASHPOINT } from './cases/flashpoint.js';

export const CLUB_CASES = { squirt: SQUIRT, blackmail: BLACKMAIL, earworm: EARWORM, halo: HALO, auction: AUCTION, flashpoint: FLASHPOINT };
/** The story clubs' cases: each plays only in its own venue (the 3D club; the 2D club never rolls them). */
export const STORY_CASES = ['halo', 'auction', 'flashpoint'];

/**
 * The case for this visit: the zone's own (the map labels a club mission with it), else one she
 * hasn't solved yet (any, once she's solved them all). `state` = the save (its solved cases).
 */
export function pickCase(zone, state = null) {
  const own = CLUB_CASES[zone?.clubCase];
  const solved = (c) => !!state?.cases?.[c.id]?.solved;
  if (own) return own;
  if (!state) return SQUIRT;
  const all = Object.values(CLUB_CASES).filter((c) => !STORY_CASES.includes(c.id));
  const open = all.filter((c) => !solved(c));
  const pool = open.length ? open : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
  unfound() { return Object.keys(this.def.clues).filter((k) => !this.found.has(k) && !this.def.clues[k].flavour && !this.def.clues[k].drink && !this.def.clues[k].v3); }

  /** The map leads this solve unlocks: every lead with a clue found (at least the first). */
  leads() {
    const got = this.def.leads.filter((l) => l.by.some((k) => this.found.has(k)));
    return got.length ? got : this.def.leads.slice(0, 1);
  }
}
