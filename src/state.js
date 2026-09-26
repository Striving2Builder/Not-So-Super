import { toast } from './ui.js';
import { HERO } from './data.js';

const KEY = 'sg-city-patrol-v1';

export const RANKS = [[-9999, 'Disgraced'], [0, 'Rookie Hero'], [60, 'Local Hero'], [150, 'City Guardian'], [300, 'Metro Icon'], [500, 'Living Legend']];

// Thresholds where meters start costing reputation.
export const VICE_LIMIT = 60;
export const INTOX_LIMIT = 50;

export class GameState {
  constructor(seed) {
    this.seed = seed;
    this.rep = 20;
    this.intox = 0;
    this.vice = 0;          // "tabloid heat" from loitering in vice venues/districts
    this.lockouts = {};     // lockKey -> seconds remaining (from villain deals)
    this.clock = 19 * 60;   // in-game minutes; 24h passes in 6 real minutes
    this.stats = { saves: 0, cases: 0, specials: 0, captures: 0, photos: 0 };
    this.drain = 0;
    this.lastWarn = -99;
    this.time = 0;
  }

  get rank() {
    let r = RANKS[0][1];
    for (const [v, n] of RANKS) if (this.rep >= v) r = n;
    return r;
  }

  get night() {
    const h = (this.clock / 60) % 24;
    if (h >= 20 || h < 5) return 1;
    if (h >= 18) return (h - 18) / 2;
    if (h < 7) return 1 - (h - 5) / 2;
    return 0;
  }

  /** The single day/night rule the whole game uses (cases, commentary, spawning). */
  get isNight() { return this.night >= 0.5; }

  addRep(n, why) {
    n = Math.round(n);
    if (!n) return;
    this.rep += n;
    if (this.onRep) this.onRep(n, why);
    toast(`${n > 0 ? '+' : ''}${n} REP${why ? ' · ' + why : ''}`, n > 0 ? 'good' : 'bad');
  }

  addIntox(n) { this.intox = Math.min(100, Math.max(0, this.intox + n)); }

  locked(key) { return this.lockouts[key] || 0; }

  /** @param vice {active:boolean, where?:string, rate?:number} — where the heroine is right now. */
  tick(dt, vice) {
    this.time += dt;
    this.clock = (this.clock + dt * 4) % 1440;
    for (const k in this.lockouts) {
      this.lockouts[k] -= dt;
      if (this.lockouts[k] <= 0) { delete this.lockouts[k]; toast(`The deal is done — ${k} zones unlocked`, 'good'); }
    }
    if (vice && vice.active) this.vice = Math.min(100, this.vice + dt * (vice.rate || 1.4));
    else this.vice = Math.max(0, this.vice - dt * 1.2);
    this.intox = Math.max(0, this.intox - dt * 0.7);

    let rate = 0;
    if (this.vice >= VICE_LIMIT) rate += 0.5;
    if (this.intox >= INTOX_LIMIT) rate += 0.35;
    if (!rate) return;
    this.drain += dt * rate;
    if (this.drain < 1) return;
    const n = Math.floor(this.drain);
    this.drain -= n;
    this.rep -= n;
    if (this.time - this.lastWarn > 8) {
      this.lastWarn = this.time;
      toast(this.vice >= VICE_LIMIT
        ? `📸 Tabloids caught ${HERO} lingering${vice && vice.where ? ' at the ' + vice.where : ''}!`
        : `🥴 ${HERO} looks tipsy in public…`, 'bad');
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ seed: this.seed, rep: this.rep, stats: this.stats, clock: this.clock, lockouts: this.lockouts }));
    } catch (e) { /* storage unavailable (private mode etc.) */ }
  }

  static load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d) return null;
      const s = new GameState(d.seed);
      s.rep = d.rep;
      s.stats = { ...s.stats, ...d.stats };
      s.clock = d.clock ?? s.clock;
      s.lockouts = d.lockouts || {};
      return s;
    } catch (e) { return null; }
  }

  static hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
}
