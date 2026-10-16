// Act 2's casino (docs/design/act2.md "The casino", "The casino stakes"): the High-Roller Suite as a
// club3d venue (plan.js VARIANTS.casino, zone.casino = true). She goes in disgraced (rep below zero:
// act2.js DISGRACED_DOORS shuts the door otherwise) and in the knockoff suit (Supergirl_Dark, loaded for
// the night: main.js waits for it; her own costume comes back with the next zone). Two tables, high card
// and 21 (cards.js): win one = a top or skirt find (game.act.suitFind) + a dealer's lead; win both = the
// night counts toward the gate. Lose a hand = a dose of Super Squirt, one knockoff accessory off (cape,
// gloves, belt, boots: the cape visibly, the rest on the HUD), −8 rep; the fourth loss and she's thrown
// out, the night lost. Content line: accessories only, never below the top and skirt.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { neonText, TAU } from '../nlkit.js';
import { npcLook } from '../art.js';
import { dialog, toast, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';
import { INTOX_HAZE } from '../state.js';
import { unlockLead } from '../leads.js';
import { skinScene } from '../hero3d.js';
import { pick } from '../util.js';
import { caseMethods } from './casework.js';
import { sitAt } from './cards.js';

export const KNOCKOFF = 'dark'; // the knockoff's placeholder model (hero3d.js costume files)
export const CASINO = {
  dose: 20,        // a lost hand's Super Squirt (+intoxication)
  rep: 8,          // a lost hand's cost
  kit: [['cape', 'cape'], ['gloves', 'gloves'], ['belt', 'belt'], ['boots', 'boots']], // what the house takes, in order
  pieces: { high: 'top', bj: 'skirt' }, // the table → the piece of her suit it pays
  nightRep: 0,     // a won night pays in finds and leads, not rep (she has to stay disgraced to come back)
};
const LEADS = [
  'The dealer leans in as he pays out: "Your friends in the capes cash their chips at the Gilded Cage. Every night."',
  'The pit boss mutters into his radio: "Same girls as last week. The ones in the cheap suits. They took the back exit to the docks."',
  'Under your winnings, a matchbook: a club\'s name, and a time scrawled inside the flap.',
  'The croupier, under her breath: "They pay the house in Super Squirt. Ask where it comes from, not where it goes."',
];
const DOOR = `The doorman looks you up and down: the cheap knockoff suit, the wig, the cape that isn't yours. "One of the girls. Go on in."<span class="hint">Two tables tonight: high card and 21. Win one and the house pays in what you came for. Lose a hand and it costs you: a drink you can't refuse, a piece of the costume, your name. Four losses and you're out.</span>`;

// ------------------------------------------------------------------ the room (build.js buildStoryHall)
function signTex(X, text, color, w = 512, h = 120, size = 84) {
  return X.atlas.add(w, h, (c) => neonText(c, text, w / 2, h / 2 + 4, size, color, { maxW: w - 30 }));
}

/** The gaming floor's set pieces. Returns the anchors (tables, cashier) for placeCasino. */
export function buildCasinoHall(zn, plan, M, X) {
  const V = plan.V, S = zn.scene, gold = 0xd8aa40, H = V.wallH;
  const felt = toon(0x1f7a46, {}, { halftone: 0.25 }), wood = toon(0x3a1408, {}, { halftone: 0.3 }), red = toon(0x8a0c1e, {}, { halftone: 0.35 });
  const A = { tables: [] };
  // the card tables: a dark wood drum, green felt, a gold rail, the game's name in neon over each
  for (const t of V.tables) {
    zn.cyl(1.75, 1.6, 0.86, t.x, 0.43, t.z, wood, true);
    zn.cyl(1.62, 1.62, 0.04, t.x, 0.88, t.z, felt, false);
    X.prop(new THREE.TorusGeometry(1.7, 0.07, 6, 32).rotateX(Math.PI / 2).translate(t.x, 0.9, t.z), gold);
    for (let k = 0; k < 6; k++) { const a = Math.PI * 0.15 + (k / 5) * Math.PI * 0.7; X.prop(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10).translate(t.x + Math.cos(a) * 1.15, 0.92, t.z + Math.sin(a) * 1.15), k % 2 ? 0xc4102a : 0xf2f2f2); } // the chips
    X.sign(t.x, 3.6, t.z - 1.9, 0, 0.62, signTex(X, t.id === 'high' ? 'HIGH CARD' : 'TWENTY-ONE', '#ffd84d'), 0xffc840, 0.4);
    X.pool(t.x, t.z, 3.2, 0xffd890, 0.32);
    A.tables.push({ ...t, seat: { x: t.x, z: t.z + 2.15 }, dealer: { x: t.x, z: t.z - 2.05 } });
  }
  // the roulette wheel between them (just for show: the cult doesn't play roulette)
  const R = V.roulette;
  zn.cyl(1.4, 1.3, 0.85, R.x, 0.42, R.z, wood, true);
  zn.cyl(1.0, 1.0, 0.06, R.x, 0.88, R.z, red, false);
  X.prop(new THREE.TorusGeometry(1.05, 0.08, 6, 36).rotateX(Math.PI / 2).translate(R.x, 0.93, R.z), gold);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; X.prop(new THREE.BoxGeometry(0.05, 0.05, 0.9).rotateY(a).translate(R.x, 0.94, R.z), gold); }
  // the cashier's cage by the door: a counter, gold bars, the sign
  const C = V.cashier;
  zn.box(3.6, 1.1, 1.2, C.x, 0.55, C.z, wood);
  for (let k = 0; k < 9; k++) X.prop(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4).translate(C.x - 1.6 + k * 0.4, 1.85, C.z + 0.4), gold);
  X.prop(new THREE.BoxGeometry(3.7, 0.12, 1.3).translate(C.x, 2.65, C.z), gold);
  X.sign(C.x, 3.25, C.z + 0.62, 0, 0.5, signTex(X, 'CASHIER', '#fff2c0', 384, 100, 72), 0xffd84d, 0.35);
  A.cashier = { x: C.x, z: C.z + 1.5, clerk: { x: C.x, z: C.z - 1.0 } };
  // slot banks along the walls: three cabinets each, their screens glowing
  for (const [x, z] of V.slots) {
    const s = x < 0 ? 1 : -1;
    for (let k = -1; k <= 1; k++) {
      zn.box(0.9, 1.7, 0.8, x, 0.85, z + k * 1.0, red);
      X.glow.push(new THREE.PlaneGeometry(0.6, 0.5).rotateY(s * Math.PI / 2).translate(x + s * 0.42, 1.3, z + k * 1.0), k ? 0xffd84d : 0x7ec8f4, 0.9);
      X.bulb(x + s * 0.3, 1.82, z + k * 1.0, 0.35, k ? 0xff3a3a : 0xffd84d);
    }
  }
  // two chandeliers: gold rings and crystal drops (merged into the props batch: no new draws)
  for (const cx of [-11, 11]) {
    const y = H - 1.5;
    for (const r of [2.2, 1.4]) X.prop(new THREE.TorusGeometry(r, 0.07, 6, 32).rotateX(Math.PI / 2).translate(cx, y, 1), gold);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, r = k % 2 ? 1.4 : 2.2; X.prop(new THREE.OctahedronGeometry(0.13).translate(cx + Math.cos(a) * r, y - 0.35, 1 + Math.sin(a) * r), 0xfff4d0); }
  }
  // the house's name over the singer's stand, and a red carpet up the room
  X.sign(0, H - 0.9, -V.hd + 0.4, 0, 0.9, signTex(X, 'HIGH-ROLLER SUITE', '#ffd84d', 768, 120, 86), 0xffc840, 0.5);
  const run = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 18).rotateX(-Math.PI / 2), red);
  run.position.set(0, 0.014, 9); S.add(run); zn._static.push(run);
  return A;
}

// ------------------------------------------------------------------ the night (mixed into Club3D)
export const casinoMethods = {
  /** zone.casino: tonight is a casino night (club3d.js enter, before the base zone's world is built). */
  startCasino(zone) {
    const q = new URLSearchParams(location.search);
    this.casino = { won: {}, losses: 0, night: false, rig: q.get('casinorig'), api: {} };
    this.clubName = 'The High-Roller Suite';
    zone.name = 'A night at the High-Roller Suite';
  },

  /** Her model for tonight: the knockoff, if it loaded (Special3D builds her from it). */
  heroSrc() { return this.casino ? skinScene(KNOCKOFF) : null; },

  /** The doorman (instead of the club's "how do you go in?"): she's one of the girls tonight. */
  async casinoDoor() {
    if (!skinScene(KNOCKOFF)) toast('(The knockoff suit didn\'t load: you\'re in your own costume tonight.)', 'info');
    await dialog({ title: 'The High-Roller Suite', text: DOOR });
  },

  /** The tables' dealers and seats, the cashier (cast.js placeGameplay, after the story's spots). */
  placeCasino() {
    const A = this.hallA.casino;
    if (!this.casino || !A) return;
    for (const t of A.tables) {
      this.npc({ ...npcLook('civilian'), top: '#f2f2f2', bottom: '#111', skirt: null, tie: '#c4102a', hairStyle: 'slick' }, t.dealer.x, t.dealer.z, 0);
      this.addInter(t.seat, `Sit at the ${t.name} table`, () => !this.casino.won[t.id] && !this.casino.out, () => this.playTable(t));
    }
    const c = A.cashier;
    this.npc({ ...npcLook('civilian'), top: '#2a0a12', skirt: '#111', bottom: null, hairStyle: 'long' }, c.clerk.x, c.clerk.z, 0);
    this.addInter(c, 'The cashier', () => true, () => this.cashier());
  },

  /** The knockoff's accessories still on her (the HUD line). */
  kitHtml() {
    const n = this.casino?.losses || 0;
    return `Knockoff: ${CASINO.kit.map(([, name], i) => (i < n ? `<s>${name}</s>` : name)).join(' · ')}<br>Lost hands ${n}/${CASINO.kit.length} · Tables ${Object.keys(this.casino?.won || {}).length}/2`;
  },
  casinoHud() {
    if (!this.casino) return;
    const ex = document.getElementById('hud-extra');
    if (ex && !document.getElementById('cas-kit')) ex.insertAdjacentHTML('beforeend', '<div class="barlabel" id="cas-kit"></div>');
    const el = document.getElementById('cas-kit');
    if (el) el.innerHTML = `<span>${this.kitHtml()}</span>`;
  },

  /** Sit down: the world holds (a sub with no picture of its own) while the overlay plays. */
  async playTable(t) {
    const g = this.g, C = this.casino;
    this.sub = { update() {}, hud() {} };
    g.input.setStick(false); g.input.setButtons([]);
    let r;
    try {
      r = await sitAt(t.id, {
        name: `${t.name} · High-Roller Suite`, rig: C.rig,
        intro: t.id === 'high' ? 'One card each. Higher wins. You can swap yours once, or risk your X-ray on his.' : 'Get closer to 21 than the dealer without going over. He draws to 17.',
        haze: () => g.state.intox >= INTOX_HAZE, kit: () => this.kitHtml(),
        onWin: () => this.tableWon(t), onLose: (caught) => this.handLost(caught),
      }, C.api);
    } finally {
      this.sub = null;
      g.input.setStick(true);
      this.setupControls(); this.envHud?.();
    }
    if (r === 'out') return this.thrownOut();
    if (C.night && r === 'win') {
      banner('THE NIGHT IS YOURS', 'Cash out at the cashier, or walk out the front', '#ffd84d');
    }
  },

  /** A table won: a piece of her suit (top or skirt) and a lead. Returns the line for the overlay. */
  async tableWon(t) {
    const C = this.casino, piece = CASINO.pieces[t.id];
    C.won[t.id] = true;
    const f = this.g.act?.suitFind?.(piece, true);
    const z = unlockLead(this.g, 'The dealer\'s tip');
    const both = Object.keys(C.won).length >= 2;
    if (both) { C.night = true; sfx.win(); }
    const findLine = f ? `<b>The house pays out in silk:</b> your ${piece}${f.back ? ' (the real one: it\'s yours again)' : `, find ${f.n}/5 (a stained copy, a clue to the next)`}.` : `<b>The house pays out:</b> a ${piece} in a garment bag, but it isn't yours. (Finds only count while you're disgraced.)`;
    return `${findLine}<br>${pick(LEADS)}${z ? `<br><i>Lead on the map: ${z.name}</i>` : ''}${both ? '<br><b>Both tables beaten: the night is yours.</b>' : ''}`;
  },

  /** A lost hand: the stakes. Returns { out, line }. */
  async handLost(caught) {
    const C = this.casino, st = this.g.state;
    const [id, name] = CASINO.kit[Math.min(C.losses, CASINO.kit.length - 1)];
    C.losses++;
    st.addIntox(CASINO.dose); sfx.drink?.();
    st.addRep(-CASINO.rep, caught ? 'Caught cheating at the High-Roller Suite' : 'Lost a hand at the High-Roller Suite');
    if (id === 'cape' && this.heroModel) this.heroModel.cape.mesh.visible = false; // (the one the model can lose: the cloth cape)
    this.addCard?.('drunk', `${HERO} losing at the High-Roller Suite`);
    const out = C.losses >= CASINO.kit.length;
    if (out) C.out = true;
    toast(`The house takes the knockoff's ${name} · +${CASINO.dose} intoxication · −${CASINO.rep} rep`, 'bad');
    return {
      out,
      line: `${caught ? 'A hand on your shoulder: "No peeking, sweetheart." ' : ''}The dealer slides a shot of Super Squirt across the felt, and the house takes the knockoff's <b>${name}</b>.${out ? '<br><b>Nothing left to bet.</b> The pit bosses come for you.' : `<br>${CASINO.kit.length - C.losses} more loss${CASINO.kit.length - C.losses === 1 ? '' : 'es'} and you're out.`}`,
    };
  },

  /** Four losses: the pit bosses walk her out, the night is lost (no dead end: straight back to the sky). */
  async thrownOut() {
    if (this.done) return;
    this.done = true;
    sfx.lose();
    banner('THROWN OUT!', 'Nothing left to bet', '#ff3a5a');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'lose', rep: 0, text: `The pit bosses walk ${HERO} out through the kitchen and into the alley, in what's left of the knockoff. The night is lost. The tables will be there tomorrow.` }), 1200);
  },

  async cashier() {
    const C = this.casino;
    if (C.night) {
      const v = await dialog({ title: 'The cashier', text: 'She counts out your night without looking up. "Come back soon, Supergirl." The air quotes are audible.', options: [{ label: 'Cash out and leave', value: true }, { label: 'Not yet', value: false }] });
      if (v) this.casinoWin();
      return;
    }
    await dialog({ title: 'The cashier', text: `"Chips are on the house for the girls." She doesn't look up.<span class="hint">Win both tables (${Object.keys(C.won).length}/2) and the night counts.</span>` });
  },

  /** Both tables beaten and out the door: a won night (the casino gate, act2run.js onZoneWin). */
  casinoWin() {
    if (this.done) return;
    this.done = true;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    sfx.win();
    banner('CASHED OUT!', 'A night at the High-Roller Suite', '#ffd84d');
    this.zone.boss = null;
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: CASINO.nightRep + (this.caseSolved ? (this.caseDef.rep || 25) : 0), photo: 'special' }), 1200);
  },

  // the case's exits, casino first (caseMethods underneath for every other club)
  async leaveClub() {
    if (!this.casino) return caseMethods.leaveClub.call(this);
    if (this.casino.night) return this.casinoWin();
    const v = await dialog({ title: 'Leave the casino?', text: `The tables beat you tonight (${Object.keys(this.casino.won).length}/2): the night won't count.`, options: [{ label: 'Leave', value: true, cls: 'bad' }, { label: 'Stay', value: false }] });
    if (!v) { this.hero.position.z -= 2.2; return; }
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: 0 });
  },
  winClub(how) {
    if (!this.casino) return caseMethods.winClub.call(this, how);
    if (this.casino.night) return this.casinoWin();
    // (the case solved, the tables not: out through the skylight, but the night doesn't count)
    this.done = true;
    toast('Case closed, but the tables beat you: the night doesn\'t count.', 'info');
    this.g.state.addRep(this.caseDef.rep || 25, 'Solved a case at the High-Roller Suite');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'abort', rep: 0 }), 900);
  },
  objectiveList() {
    const list = caseMethods.objectiveList.call(this);
    if (!this.casino) return list;
    const A = this.hallA.casino, C = this.casino;
    if (C.night) return [{ t: 'The night is yours: cash out at the cashier, or walk out', target: A.cashier, cur: true }, ...list];
    const rows = A.tables.map((t) => ({ t: `Beat the ${t.name} table`, done: !!C.won[t.id], target: t.seat }));
    return [...rows, ...list];
  },
};
