// The back rooms' own trouble (docs/design/nightclub.md "The club layout"). The dark room: a few of
// the dancers in there are working it. They drift up to her in the dark, and stay close too long
// and one of them gets something into her drink, or a phone up close (reputation she won't get
// back). X-ray picks them out (expose one and he bolts), and finds the crew's hidden panel in the
// back wall: their kit, and something from the case. The alley: a dealer by the far wall, besides
// the courier: buy from him, take one on the house (he talks), or bust him.
import * as THREE from 'three';
import { basic } from '../zonekit.js';
import { npcLook } from '../art.js';
import { comic } from '../comic.js';
import { toast, dialog } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, rand } from '../util.js';
import { HERO } from '../data.js';
import { DOSE } from './vices.js';

export const DARK = {
  dosers: 3,            // dancers in the dark room who are working it
  drift: 0.75,          // m/s they close in on her
  close: 1.6,           // metres: "too close"
  stayTo: 3.2,          // seconds too close before one of them acts
  backOff: [7, 11],     // seconds a doser keeps his distance after
  dose: 14,             // intoxication from what goes in her drink
  filmRep: 4,           // what a phone up close costs
  exposeBonus: 3,       // rep (when she's out) per doser exposed
  panelBonus: 4,
};

const CLOSE_IN = ['Hey, cape… dance with me?', 'You look thirsty.', 'Stay a while, hero.', 'Nobody can see us in here.', 'Relax. Have a little fun.'];
const DOSED = ['Something in my drink…', 'Hey! What did you put in—', 'Mmph! Get that away from me!'];
const FILMED = ['No phones! Hey!', 'Delete that!', 'Who\'s filming?!'];
const SLIMY = ['Smile for the fans, Supergirl!', 'Ha! That\'s going online.', 'Got you, hero!'];

export const backroomMethods = {
  /** After the cast: the dark room's dosers and hidden panel, the alley's dealer. */
  placeBackrooms() {
    const plan = this.plan, A = this.roomA, dq = plan.byKind.dark;
    this.dosers = [];
    if (A.dark && dq) {
      // the dosers: dancers from the dark room's crowd, picked from those deepest in
      const pool = this.crowd.people.filter((p) => p.pose === 'dance' && p.x >= dq.x0 && p.x <= dq.x1 && p.z >= dq.z0 && p.z <= dq.z1);
      for (let i = 0; i < DARK.dosers && pool.length; i++) {
        const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        this.dosers.push({ p, home: { x: p.hx, z: p.hz }, t: 0, cool: rand(2, 5), said: false, gone: false, mark: null });
      }
      // X-ray: a red glow over each of them
      const mat = new THREE.SpriteMaterial({ color: 0xff3a5a, blending: THREE.AdditiveBlending, depthTest: false, transparent: true, opacity: 0.85 });
      for (const D of this.dosers) {
        D.mark = new THREE.Sprite(mat); D.mark.scale.set(0.5, 0.5, 1); D.mark.renderOrder = 12; D.mark.visible = false; this.scene.add(D.mark);
        this.addInter({ get x() { return D.p.x; }, get z() { return D.p.z; }, y: 0 }, 'Expose him: he\'s dosing people', () => this.xray && !D.gone, () => this.exposeDoser(D));
      }
      // the crew's hidden panel, in the back wall by the inner corner (only X-ray shows it's there)
      const s = dq.side === 'W' ? -1 : 1, u = -((dq.x1 - dq.x0) / 2 - 1.6);
      const px = dq.cx + s * u;
      this.darkPanel = { x: px, z: dq.z0 + 1.3 };
      this.darkPanelGlow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.2), basic(0xff3a5a, { transparent: true, opacity: 0.75, depthTest: false }));
      this.darkPanelGlow.renderOrder = 11; this.darkPanelGlow.visible = false;
      this.darkPanelGlow.position.set(px, 1.2, dq.z0 + 0.12); this.scene.add(this.darkPanelGlow);
      this.addInter(this.darkPanel, 'Pry open the hidden panel', () => this.xray && !this.darkPanelDone, () => this.openDarkPanel());
    }
    // the alley's dealer: against the far end, away from the courier
    const aq = plan.alley;
    if (A.alley && aq) {
      const z = aq.z0 + Math.min(14.5, aq.z1 - aq.z0 - 2.5);
      this.dealer = this.npc({ ...npcLook('thug'), top: '#3a2a5a', hairStyle: 'slick' }, aq.cx, z, Math.PI);
      this.addInter({ x: aq.cx, z: z + 1.1 }, 'Talk to the dealer', () => !this.dealerGone, () => this.dealerTalk());
    }
  },

  /** Per frame: the dosers close in while she's in the dark room; X-ray shows them and the panel. */
  stepBackrooms(dt) {
    const h = this.hero.position, inDark = this.room?.kind === 'dark';
    if (this.darkPanelGlow) this.darkPanelGlow.visible = !!this.xray && !this.darkPanelDone;
    if (!this.dosers?.length) return;
    if (inDark && !this.darkTold) { this.darkTold = true; toast('Hands in the dark in here. Keep moving, and keep your drink covered.', 'info'); }
    let worst = null;
    for (const D of this.dosers) {
      const p = D.p;
      if (D.mark) { D.mark.visible = !!this.xray && !D.gone; D.mark.position.set(p.x, (p.fy ?? 0) + 2.2, p.z); }
      if (D.gone) continue;
      D.cool = Math.max(0, D.cool - dt);
      const dx = h.x - p.hx, dz = h.z - p.hz, d = Math.hypot(dx, dz);
      // closing in on her (staying inside the room); otherwise drifting back to his spot
      const room = this.plan.byKind.dark, want = inDark && !D.cool && !this.busy && d > 0.95;
      const tx = want ? h.x : D.home.x, tz = want ? h.z : D.home.z, ex = tx - p.hx, ez = tz - p.hz, ed = Math.hypot(ex, ez);
      if (ed > 0.05) {
        const k = Math.min(ed, DARK.drift * dt * (want ? 1 : 0.6)) / ed;
        p.hx = Math.min(room.x1 - 0.6, Math.max(room.x0 + 0.6, p.hx + ex * k));
        p.hz = Math.min(room.z1 - 0.6, Math.max(room.z0 + 0.6, p.hz + ez * k));
      }
      const close = inDark && !this.busy && !D.cool && Math.hypot(h.x - p.x, h.z - p.z) < DARK.close;
      D.t = close ? D.t + dt : Math.max(0, D.t - dt * 0.6);
      if (close && D.t > DARK.stayTo * 0.45 && !D.said) { D.said = true; this.bubbleAt(p, pick(CLOSE_IN)); }
      if (!worst || D.t > worst.t) worst = D;
    }
    if (worst && worst.t >= DARK.stayTo) this.doserActs(worst);
  },

  bubbleAt(p, text, kind = 'speech') {
    const s = () => this.screenOf({ x: p.x, y: p.fy ?? 0, z: p.z }, 2);
    const a = s();
    if (a) comic.say(text, a.x, a.y, { kind, ms: 1800, anchor: s });
  },

  /** Too close for too long: a dose in her drink, or a phone in her face. */
  doserActs(D) {
    const st = this.g.state, hs = this.screenOf(this.hero.position, 2.3);
    D.t = 0; D.said = false; D.cool = rand(...DARK.backOff);
    if (Math.random() < 0.55) {
      sfx.drink(); st.addIntox(DARK.dose);
      this.addCard('pill', `${HERO}, dosed in the dark room`);
      if (hs) comic.say(pick(DOSED), hs.x, hs.y, { kind: 'shout', ms: 1900 });
      toast('Something went into your drink in the dark.', 'bad');
    } else {
      this.bubbleAt(D.p, pick(SLIMY));
      st.addRep(-DARK.filmRep, 'Filmed up close in the dark room');
      this.addCard('fans', `${HERO}, up close in the dark room`);
      this.stunT = Math.max(this.stunT || 0, 0.5);
      if (hs) setTimeout(() => !this.done && comic.say(pick(FILMED), hs.x, hs.y, { kind: 'shout', ms: 1700 }), 500);
    }
  },

  /** X-ray: she points him out; he bolts for the door and doesn't come back. */
  exposeDoser(D) {
    D.gone = true; D.mark.visible = false;
    D.home = { x: this.plan.byKind.dark.door.x, z: this.plan.byKind.dark.door.z };
    D.p.left = true; // (the crowd walks him out of the club)
    this.bonus = (this.bonus || 0) + DARK.exposeBonus;
    sfx.pickup();
    this.bubbleAt(D.p, pick(['I wasn\'t doing anything!', 'Get off me!', 'Okay, okay, I\'m going!']), 'shout');
    toast(`X-ray: pills palmed in his hand. You call him out and he bolts. (+${DARK.exposeBonus} rep when you're out)`, 'good');
  },

  /** The crew's hidden panel: their kit, the phones they lifted, and something from the case. */
  async openDarkPanel() {
    this.darkPanelDone = true;
    sfx.hit();
    const d = this.caseDef, keys = this.book.unfound(), had = (this.envelope || []).some((c) => c.id === 'fans');
    this.envelope = (this.envelope || []).filter((c) => c.id !== 'fans'); // (the phones that filmed her are in here)
    this.envHud?.();
    this.bonus = (this.bonus || 0) + DARK.panelBonus;
    let extra = '<span class="hint">Nothing in it for the case.</span>';
    if (keys.length) {
      const k = pick(keys), [kind, id] = k.split(':');
      this.book.find(kind, id);
      extra = `<br><br>Taped inside the lid: ${this.book.clue(kind, id).text}<span class="hint">Case board: ${this.book.count}/${d.need}${this.book.ready && !this.caseSolved ? ' · you can make an accusation (CASE)' : ''}</span>`;
    }
    await dialog({ title: 'Behind the panel', text: `A hollow in the wall: a tray of ${d.drugName || 'pills'}, a box of syringes, and a pile of phones the crew lifted off people they dosed.${had ? ' One of them has video of you on it. Not any more.' : ''}${extra}` });
  },

  // ---- the alley's dealer
  async dealerTalk() {
    const st = this.g.state, d = this.caseDef, hon = this.undercover ? 'hon' : 'cape';
    const opts = [];
    if (!this.dealerBought) {
      opts.push({ label: '"I\'ll buy a bag."', note: 'Evidence · he gets chatty', value: 'buy', cls: 'risky' });
      opts.push({ label: '"I\'ll try one here."', note: `+${DOSE.pill} intoxication · he talks to customers`, value: 'try', cls: 'risky' });
    } else opts.push({ label: '"Who supplies you?"', value: 'ask' });
    opts.push({ label: 'Bust him', note: this.fought?.alley ? 'He\'s on his own' : 'He\'ll whistle for the crew', value: 'bust', cls: 'bad' });
    opts.push({ label: 'Walk away', value: null });
    const v = await this.quick({ speaker: 'The dealer', text: `"Psst. Looking for something, ${hon}? ${d.drugName || 'The good stuff'}. First taste is half price."`, options: opts, at: this.dealer });
    if (v === 'buy') {
      this.dealerBought = true; sfx.pickup();
      this.items.add(`a bag of ${d.drugName || 'pills'}`);
      if (!this.undercover && Math.random() < 0.5) { this.addCard('paparazzi', `${HERO}, buying in the alley`); toast('A flash from the fire escape. Somebody got that.', 'bad'); }
      this.dealerRumour('"Pleasure doing business."');
    } else if (v === 'try') {
      this.dealerBought = true;
      sfx.drink(); st.addIntox(DOSE.pill);
      this.addCard('pill', `${HERO}, high in the alley`);
      this.stockTold = true;
      this.say(this.dealer, `"Atta girl. Want more? Stock room. Code's ${this.stockCode}. You didn't hear it from me."`, { ms: 4200, speaker: 'The dealer' });
      toast(`The stock room code: ${this.stockCode}`, 'good');
    } else if (v === 'ask') {
      this.dealerRumour('"That\'s all I know, I swear."');
    } else if (v === 'bust') {
      this.dealerGone = true;
      if (!this.fought?.alley) {
        this.say(this.dealer, '"COURIER!"', { speaker: 'The dealer' });
        this.dealer.visible = false;
        await this.startBrawl('alley');
        return;
      }
      this.dealer.visible = false;
      this.bonus = (this.bonus || 0) + 4;
      sfx.hit();
      toast(`He drops his stash and runs. (+4 rep when you're out)`, 'good');
    }
  },

  /** He talks: a rumour she hasn't heard (one that answers the VIP host's questions first). */
  dealerRumour(none) {
    const all = (this.caseDef.rumours || []).filter((r) => !this.noted.has(r.id));
    const r = all.find((q) => q.teach) || all[0];
    if (!r) { this.say(this.dealer, none, { speaker: 'The dealer' }); return; }
    this.noteRumour(r);
    this.say(this.dealer, `"${this.rumourText(r)}"`, { ms: 4200, speaker: 'The dealer' });
  },
};
