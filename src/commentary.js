// The comic commentary engine: decides WHAT the narrator, citizens, crooks and the press say,
// and WHEN, based on where Supergirl is, what's happening, and how the city feels about her.
// Rendering is done by comic.js.
import { comic } from './comic.js';
import { DISTRICTS, THEMES, NIGHT_CASES, ASYLUM_CASES, HERO, VENUES } from './data.js';
import { pick, chance, rand } from './util.js';
import { sfx } from './sfx.js';

const H = HERO.toUpperCase();

// Reputation tiers, from adored to despised.
export function tierOf(rep) {
  if (rep >= 150) return 'idol';
  if (rep >= 60) return 'hero';
  if (rep >= 0) return 'rookie';
  if (rep >= -50) return 'flop';
  return 'fraud';
}
const GOOD = new Set(['idol', 'hero']);

// ------------------------------------------------------------------ line banks
const POW = ['POW!', 'BAM!', 'BIFF!', 'SOCK!', 'WHAM!', 'ZOK!', 'BONK!', 'THWACK!', 'CRUNCH!', 'SMACK!', 'BOFF!', 'KLONK!'];
const BIG_POW = ['KAPOW!', 'ZLONK!', 'KER-SPLAT!', 'WHAMMM!', 'KA-BLAM!', 'ZOWIE!', 'SPLATT!', 'OOOFF!'];
const HURT = ['OOF!', 'UGH!', 'OUCH!', 'YOW!'];
const BEAM = ['ZZZAP!', 'FZZZT!', 'ZAP!'];
const FROST = ['FSSSH!', 'WHOOOSH!', 'FWOOSH!'];

const NARRATE_DISTRICT = {
  idol: ['Meanwhile, over {D}… citizens look up in adoration!', '{D} sleeps soundly, for its guardian is on patrol!', 'Over {D}, a streak of red and blue brings hope!'],
  hero: ['Meanwhile, in {D}…', 'High above {D}, our heroine keeps watch!', '{D}! Where danger lurks on every corner!'],
  rookie: ['Meanwhile, in {D}…', 'Our young heroine patrols {D}. Is she ready?', '{D}… a district that has seen better days!'],
  flop: ['Meanwhile, over {D}… the "heroine" makes another appearance.', '{D} braces itself. Not for crime, but for HER.', 'Can our so-called hero redeem herself in {D}?'],
  fraud: ['{D} groans. The FRAUD is back!', 'Even the crooks of {D} are laughing now!', 'Over {D}, the most disgraced cape in town…'],
};
// (the narration line already names the district; the report that follows it doesn't repeat it)
const CRIME_REPORT = ['{N} crimes reported!', 'Crime wave! {N} incidents and counting!', '{N} cries for help tonight!'];
const ONE_REPORT = ['Trouble is brewing!', 'A cry for help!', 'A crime has been reported!'];
const QUIET_REPORT = ['All quiet… for now!', 'Not a crook in sight. Suspicious!'];

const CITIZEN = {
  idol: ['LOOK! UP IN THE SKY!', 'We love you, Supergirl!', 'My hero!!', 'She waved at me! SHE WAVED AT ME!', 'Best. Hero. Ever!', 'Marry me, Supergirl!… wait, no, adopt me!'],
  hero: ['Hey, it\'s Supergirl!', 'Go get \'em, Supergirl!', 'Thanks for saving my cat!', 'Nice cape!', 'Safe streets thanks to her!'],
  rookie: ['Is that a bird? A plane?', 'Who\'s the new girl in the cape?', 'Huh. Another hero.', 'Is she any good?'],
  flop: ['Oh great, HER again.', 'Hey, false hero!', 'Get a real job!', 'Where were you when my car got stolen?!', 'Boo! Super-FLOP!'],
  fraud: ['FRAUD!', 'Go home, fake hero!', 'Give back the cape!', 'Even my GRANDMA fights crime better!', 'Imposter! IMPOSTER!', 'Don\'t let her near the bank!'],
};
const RUMOR = ['I heard there\'s a {C} in {D}!', 'Somebody said {C} over in {D}…', 'Did you hear? {C} in {D}!'];

const NEWS = {
  idol: ['CITY DECLARES "SUPERGIRL DAY"!', 'POLL: 9 IN 10 CITIZENS ♥ SUPERGIRL', 'CRIME AT ALL-TIME LOW — THANKS TO HER!', 'MAYOR: "GIVE THAT GIRL A PARADE!"'],
  hero: ['SUPERGIRL: THE CITY\'S NEW BEST FRIEND', 'CROOKS QUAKE AS HEROINE RISES', 'KIDS TRADE CAPES FOR SUPERGIRL LOOK'],
  rookie: ['NEW HEROINE — HIT OR MISS?', 'WHO IS THE GIRL IN THE CAPE?', 'CITY WATCHES NEW HERO WITH INTEREST'],
  flop: ['SUPER-FLOP? CITIZENS DEMAND ANSWERS', 'HERO OR ZERO? YOU DECIDE!', '"WE WANT A REAL HERO," SAYS CITY'],
  fraud: ['FRAUD IN A CAPE! PETITION TO BAN "HEROINE"', 'CITY HALL: "SHE\'S NO HERO"', 'CROOKS THANK SUPERGIRL FOR EASY WEEK', 'TOTAL DISGRACE: SUPERGIRL HITS NEW LOW'],
};
const REP_UP = ['{H} DOES IT AGAIN!', 'HEROINE OF THE HOUR!', 'THE CITY CHEERS {H}!', '{H} SAVES THE DAY!'];
const REP_DOWN = ['{H} BUNGLES IT!', 'OOPS! {H} IN HOT WATER', 'IS {H} LOSING HER TOUCH?', 'EMBARRASSING DAY FOR {H}'];
const REP_DOWN_FRAUD = ['{H} STRIKES OUT — AGAIN!', 'FAKE HERO FAILS FORWARD', 'THE "HERO" THE CITY DIDN\'T ORDER'];
const TIER_UP = { idol: 'A LEGEND IS BORN!', hero: 'THE CITY HAS A HERO!', rookie: 'SUPERGIRL BOUNCES BACK!' };
const TIER_DOWN = { hero: 'THE SHINE WEARS OFF…', rookie: 'FROM HERO TO ZERO?', flop: 'THE CITY TURNS ON SUPERGIRL!', fraud: 'DISGRACED! SUPERGIRL BRANDED A FRAUD!' };

const ZONE_OPEN = {
  brawl: ['Meanwhile, down in {D}… {C}!', 'Danger in {D}! Thugs run wild!', 'Holy havoc! {C} in {D}!'],
  investigate: ['Meanwhile, at the scene of the crime…', 'A mystery in {D}! Who dunnit?', 'The plot thickens in {D}…'],
  special: ['Meanwhile, inside {V}… a sinister {T} plot unfolds!', 'Deep inside {V}… a trap awaits!', 'Somewhere in {V}… VILLAINY!'],
  vice: ['Meanwhile, inside {V}… a sinister {T} plot unfolds!', 'Behind the velvet rope of {V}… VILLAINY!', 'Deep inside {V}… a trap awaits!'],
  asylum: ['Behind the walls of {V}… nobody hears you scream.', 'Meanwhile, at {V}… the case of {T}!', 'The lights flicker at {V}. Somebody here is hiding something…'],
  nightcase: ['Meanwhile, after hours at {V}… the case of {T}!', 'Midnight at {V}. The music is loud, the secrets louder…', '{V} after dark… somebody here knows something!'],
};
const THUG_TAUNT = ['Get her, boys!', 'It\'s the cape! Get her!', 'Ha! Just one girl!', 'Nobody messes with our turf!', 'You picked the wrong street, sister!'];
const THUG_TAUNT_FRAUD = ['Relax boys, it\'s just the FAKE one!', 'Ha! The fraud showed up!', 'This\'ll be easy!'];
const HERO_QUIP = ['Holy haymakers!', 'Crime doesn\'t pay!', 'Next!', 'That\'s what I call a knockout!', 'Justice is served!', 'Who\'s next?', 'Too easy!'];
const BOSS_TAUNT = ['So… the famous {H} at last!', 'You\'re too late, cape!', 'My henchmen will make mincemeat of you!'];
const GUARD_SHOUT = ['Hey! Intruder!', 'Who goes there?!', 'Sound the alarm!', 'Stop right there!'];
const VILLAIN_TV = ['Comfy, darling?', 'Mwa-ha-ha-HA!', 'Not so super now, are we?', 'Tick-tock, heroine…', 'The city will see you like THIS!'];
const OUTRO_WIN = ['And so, justice prevails!', 'Crime takes a holiday… for now!', 'Same Super-time! Same Super-channel!'];
const OUTRO_CAPTURED = ['Is this the end of our heroine?!', 'Trapped! Will she escape?! Tune in next time!', 'Curses! Captured at last!'];

/** 'Downtown', 'the Docks', 'the Financial District'… for use mid-sentence. */
export function placeName(key) {
  const n = DISTRICTS[key].name;
  if (n === 'Downtown') return n;
  return 'the ' + n + (/(District|Lair|Docks)$/.test(n) ? '' : ' District');
}

const fill = (s, v = {}) => s.replace(/\{(\w)\}/g, (_, k) => v[k] ?? '');

export class Commentary {
  constructor(game) {
    this.g = game;
    this.ambientT = 8;
    this.newsT = 30;
    this.tier = null;
    this.lastPow = 0;
    this.lastSay = 0;
    this.repAcc = 0;
    this.repTimer = 0;
  }

  get st() { return this.g.state; }
  get tierNow() { return tierOf(this.st.rep); }

  // ---------------------------------------------------------- per-frame
  update(dt) {
    const st = this.st;
    if (!st || this.g.title) return;
    const tier = this.tierNow;
    if (this.tier && tier !== this.tier) this.tierChanged(this.tier, tier);
    this.tier = tier;

    // Batch small reputation changes into one headline instead of spamming.
    if (this.repTimer > 0) {
      this.repTimer -= dt;
      if (this.repTimer <= 0) this.flushRep();
    }
    if (this.g.modeName !== 'overworld') return;
    this.ambientT -= dt;
    this.newsT -= dt;
    if (this.ambientT <= 0) this.ambientT = this.citizen() ? rand(14, 24) : 3; // nobody in view: try again soon
    if (this.newsT <= 0) { this.newsT = rand(55, 80); this.news(); }
  }

  // ---------------------------------------------------------- overworld
  onDistrict(key) {
    const D = DISTRICTS[key];
    if (!D) return;
    const ow = this.g.overworld;
    const n = ow.zones.filter((z) => z.district === key).length;
    const line = fill(pick(NARRATE_DISTRICT[this.tierNow]), { D: placeName(key) });
    const report = fill(pick(n > 1 ? CRIME_REPORT : n === 1 ? ONE_REPORT : QUIET_REPORT), { D: placeName(key), N: n });
    comic.caption(`${line} ${report}`);
  }

  /** A pedestrian in view pipes up. Returns false when nobody's on screen to say it. */
  citizen() {
    const ow = this.g.overworld;
    const spot = ow?.speakerSpot();
    if (!spot) return false;
    const { x: px, y: py, anchor } = spot;
    const zones = ow.zones.filter((z) => z.kind !== 'special');
    if (zones.length && chance(0.35)) {
      const z = pick(zones);
      comic.say(fill(pick(RUMOR), { C: z.name.toLowerCase(), D: placeName(z.district) }), px, py, { kind: 'speech', speaker: 'CITIZEN', anchor });
    } else {
      const bad = !GOOD.has(this.tierNow) && this.tierNow !== 'rookie';
      comic.say(pick(CITIZEN[this.tierNow]), px, py, { kind: bad ? 'shout' : 'speech', speaker: pick(['CITIZEN', 'KID', 'CABBIE', 'GRANNY', 'NEWSBOY']), anchor });
    }
    return true;
  }

  news() {
    const t = this.tierNow;
    comic.headline(fill(pick(NEWS[t]), { H }), { tone: GOOD.has(t) ? 'good' : t === 'rookie' ? 'neutral' : 'bad' });
  }

  // ---------------------------------------------------------- reputation
  onRep(n) {
    if (Math.abs(n) < 3) return;
    this.repAcc += n;
    this.repTimer = 0.6;
  }

  flushRep() {
    const n = this.repAcc;
    this.repAcc = 0;
    if (!n || this.g.modeName !== 'overworld') return; // newspapers already cover in-zone results
    const t = this.tierNow;
    if (n > 0) comic.headline(fill(pick(REP_UP), { H }), { tone: 'good' });
    else comic.headline(fill(pick(t === 'fraud' || t === 'flop' ? REP_DOWN_FRAUD : REP_DOWN), { H }), { tone: 'bad' });
  }

  tierChanged(from, to) {
    const order = ['fraud', 'flop', 'rookie', 'hero', 'idol'];
    const up = order.indexOf(to) > order.indexOf(from);
    const text = up ? TIER_UP[to] : TIER_DOWN[to];
    // Delay so it doesn't collide with the rep toast; skip it if the tier has moved again since.
    if (text) setTimeout(() => { if (this.tierNow === to) comic.headline(text, { tone: up ? 'good' : 'bad', kicker: up ? 'STOP THE PRESSES!' : 'SHOCKER!' }); }, 1200);
  }

  // ---------------------------------------------------------- zones
  onDive(zone) {
    sfx.spin();
    comic.spin(zone.mode === 'special' ? zone.venue.toUpperCase() : zone.name.toUpperCase() + '!');
  }

  onZoneStart(zone) {
    // venue with its article: 'the Warehouse', but 'The Clubhouse' as named (no 'the The')
    const venue = zone.venue || '', V = (/^the /i.test(venue) || zone.mode === 'asylum' ? venue : 'the ' + venue).toUpperCase();
    const v = { D: placeName(zone.district), C: zone.name.toUpperCase(), V, T: ((zone.mode === 'nightcase' ? NIGHT_CASES : zone.mode === 'asylum' ? ASYLUM_CASES : THEMES)[zone.theme]?.name || '').toLowerCase() };
    const nightlife = ['club', 'gentlemens', 'redlight', 'casino', 'premade'].includes(VENUES[zone.venue]?.kind);
    const lines = zone.mode === 'special' && nightlife ? ZONE_OPEN.vice : ZONE_OPEN[zone.mode];
    setTimeout(() => comic.caption(fill(pick(lines), v)), 1300);
  }

  onZoneEnd(outcome) {
    const txt = outcome === 'captured' ? pick(OUTRO_CAPTURED) : outcome === 'win' ? pick(OUTRO_WIN) : null;
    if (txt) comic.caption(txt, { where: 'bottom', ms: 2600 });
  }

  // ---------------------------------------------------------- fights (screen coords)
  hit(x, y, { big = false } = {}) {
    const now = performance.now();
    if (!big && now - this.lastPow < 260) return;
    this.lastPow = now;
    sfx.pow();
    comic.pow(pick(big ? BIG_POW : POW), x, y - 30, { size: big ? 1.35 : 0.95 });
  }

  hurt(x, y) { if (chance(0.5)) comic.pow(pick(HURT), x, y - 40, { size: 0.75, colors: ['#ffffff', '#ff2d2d'] }); }
  beam(x, y) { comic.pow(pick(BEAM), x, y, { size: 0.9, colors: ['#ff2d2d', '#ffe600'] }); }
  frost(x, y) { comic.pow(pick(FROST), x, y, { size: 0.9, colors: ['#bff4ff', '#39c6ff'] }); }

  talk(text, x, y, opts) {
    const now = performance.now();
    if (now - this.lastSay < 900) return;
    this.lastSay = now;
    comic.say(text, x, y, opts);
  }

  thugTaunt(x, y) {
    const lines = GOOD.has(this.tierNow) || this.tierNow === 'rookie' ? THUG_TAUNT : THUG_TAUNT.concat(THUG_TAUNT_FRAUD, THUG_TAUNT_FRAUD);
    this.talk(pick(lines), x, y, { kind: 'shout', speaker: 'THUG' });
  }
  heroQuip(x, y) { this.talk(pick(HERO_QUIP), x, y, { kind: 'speech', speaker: H }); }
  bossTaunt(name, x, y) { this.talk(fill(pick(BOSS_TAUNT), { H }), x, y, { kind: 'shout', speaker: name.toUpperCase() }); }
  guardShout(x, y) { this.talk(pick(GUARD_SHOUT), x, y, { kind: 'shout', speaker: 'GUARD' }); }
  villainTV(name, x, y) { this.talk(pick(VILLAIN_TV), x, y, { kind: 'speech', speaker: name.toUpperCase() }); }
  thought(text, x, y) { this.talk(text, x, y, { kind: 'thought' }); }
}
