// Intoxication paths (docs/design/nightclub.md "Intoxication paths"). Some are shortcuts, some the
// only way to a clue: the bartender talks over his house special, the DJ's vial gives drug-vision
// (the UV writing), the gangster's shot-off, a pill on the dance floor (the bouncers forget you),
// the restroom powder (X-ray for free, a blackout risk), the predator's spiked drink (X-ray spots
// it), drinks spilled on her in the crowd. Every dosed moment can become a card in the owner's
// envelope.
import { npcLook } from '../art.js';
import { dialog, toast, openModal, closeModal } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { pick, rand } from '../util.js';
import { HERO } from '../data.js';

export const DOSE = { special: 22, pill: 18, shot: 8, vial: 30, powder: 25, spiked: 45, bump: 3, shotWin: 10, shotLose: 40 };

export const viceMethods = {
  stepVices(dt) {
    const st = this.g.state, h = this.hero.position;
    if (st.intox >= 70 && !this.drunkCard && !this.room) { this.drunkCard = true; this.addCard('drunk', `${HERO}, drunk on the dance floor`); }
    // pushing through the packed crowd: someone's drink ends up on her
    this.bumpT = (this.bumpT ?? 4) - dt;
    if (this.bumpT <= 0 && (this.moving || 0) > 0.55 && this.crowdThick >= 2) {
      this.bumpT = rand(5, 9);
      const p = this.crowd.nearest(h.x, h.z, 1.4);
      const s = p && this.screenOf({ x: p.x, y: 0, z: p.z }, 2);
      const kind = Math.random();
      if (kind < 0.45) { st.addIntox(DOSE.bump); if (s) comic.say(pick(['Hey! My drink!', 'Watch it!', 'Oh no, all over you!']), s.x, s.y, { ms: 1500 }); }
      else if (kind < 0.75) { h.x += rand(-0.6, 0.6); h.z += rand(-0.4, 0.4); if (s) comic.say(pick(['Move!', 'Excuse YOU.', 'Ow!']), s.x, s.y, { kind: 'shout', ms: 1400 }); }
      else { if (s) comic.say('Watch it, cape!', s.x, s.y, { kind: 'shout', ms: 1500 }); if (this.guards.some((g) => g.mesh.position.distanceTo(h) < 9)) this.alert = Math.min(95, this.alert + 8); }
    }
    this.stepPredator(dt);
  },

  async barOrder() {
    const st = this.g.state, d = this.caseDef;
    const spiked = this.xray;
    const opts = [
      { label: '"The house special."', note: `+${DOSE.special} intoxication · he talks to drinkers`, value: 'special', cls: 'risky' },
      { label: '"Just water."', value: 'water' },
      { label: '"What\'s really going on in here?"', value: 'ask' },
    ];
    if (spiked && !this.book.has('bar', 'spiked')) opts.unshift({ label: 'Expose the spiked "house special"', note: 'X-ray: powder in the glass', value: 'expose', cls: 'good' });
    opts.push({ label: 'Leave it', value: null });
    const v = await this.quick({ speaker: 'Bartender', text: `"What'll it be, ${this.undercover ? 'hon' : 'hero'}?"${spiked ? '<small>X-ray: glittering green powder settles in every "house special" he pours.</small>' : ''}`, options: opts, at: this.bartender });
    if (v === 'special') {
      sfx.drink(); st.addIntox(DOSE.special); this.drinks = (this.drinks || 0) + 1;
      const key = ['bar:napkin', 'bar:phone', 'bar:pills'].find((k) => !this.book.has(...k.split(':')));
      if (key) await this.gotClue(key, { title: 'The bartender leans in' });
      else this.say(this.bartender, '"That\'s all I know, I swear."');
    } else if (v === 'ask') {
      if (!this.drinks) this.say(this.bartender, '"Buy something first. Then we talk."');
      else if (!this.book.has('bar', 'napkin')) await this.gotClue('bar:napkin', { title: 'The bartender leans in' });
      else this.say(this.bartender, '"That\'s all anybody says out loud in here. Ask upstairs."');
    } else if (v === 'expose') {
      await this.gotClue('bar:spiked', { title: 'Spiked' });
      this.alert = Math.min(90, this.alert + 15);
      toast('The bartender goes pale and stops pouring.', 'good');
    } else if (v === 'water') this.say(this.bartender, '"Water. In a club. Sure."');
  },

  async acceptOffer(id) {
    const st = this.g.state;
    if (id === 'pill') {
      sfx.drink(); st.addIntox(DOSE.pill);
      this.alert = 0;
      this.addCard('pill', `${HERO} taking a pill on the dance floor`);
      toast('The room softens. Nobody\'s looking at you any more.', 'info');
    } else {
      sfx.drink(); st.addIntox(DOSE.shot);
      toast('Down in one. The crowd cheers.', 'info');
    }
  },

  /** The DJ's vial (the booth close-up): drug-vision for a while. Required for the stock-room code. */
  async drinkVial(text) {
    const v = await dialog({ title: this.caseDef.drugName || 'The vial', text: `${text}<span class="hint">Drink it: +${DOSE.vial} intoxication. On a Kryptonian it does something else: you'll see what the sober crowd can't.</span>`, options: [{ label: 'Knock it back', value: true, cls: 'risky' }, { label: 'Leave it', value: false }] });
    if (!v) return;
    sfx.drink(); this.g.state.addIntox(DOSE.vial);
    this.dvision = 45;
    toast('It burns… and the walls start to glow.', 'info');
  },

  async readUV() {
    this.uvRead = true;
    await this.gotClue('uv:wall', { title: 'Drug-vision' });
    toast(`The stock room code: ${this.stockCode}`, 'good');
  },

  async shotOff() {
    const v = await this.quick({ speaker: 'The gangster', text: '"The hero drinks? Shot for shot, cape. Win and I\'ll tell you something. Lose and you\'re on the floor."', options: [{ label: 'Accept the shot-off', note: 'A timing challenge', value: true, cls: 'risky' }, { label: 'Walk away', value: false }], at: this.gangster });
    if (!v) return;
    this.shotDone = true;
    let hits = 0;
    for (let i = 0; i < 3; i++) if (await this.timingTap(`Shot ${i + 1} of 3`, 0.9 + i * 0.25)) hits++;
    const st = this.g.state;
    if (hits >= 2) {
      sfx.drink(); st.addIntox(DOSE.shotWin);
      this.items.add('VIP wristband');
      const r = (this.caseDef.rumours || []).find((q) => q.teach === 'who');
      if (r) this.noteRumour(r);
      this.say(this.gangster, `"Ha! Respect."${r ? ` "${this.rumourText(r)} Remember that."` : ''}`, { ms: 4200, speaker: 'The gangster' });
      toast('He slides a VIP wristband across the table.', 'good');
    } else {
      sfx.drink(); st.addIntox(DOSE.shotLose);
      this.addCard('drunk', `${HERO} losing a drinking game`);
      this.say(this.gangster, '"Lightweight."', { speaker: 'The gangster' });
      toast('The table roars. Somebody takes a picture.', 'bad');
    }
  },

  /** A needle sweeping a bar: tap (or press E/space) while it's in the green. Resolves true on a hit. */
  timingTap(title, speed = 1) {
    return new Promise((resolve) => {
      const el = openModal(`<h2>${title}</h2><div class="dtext">Tap when the needle is in the green.</div><div class="c3-timing"><i class="zone"></i><i class="needle"></i></div><button class="qte-btn">DRINK!</button>`, 'dlg');
      const needle = el.querySelector('.needle'), zone = el.querySelector('.zone');
      const z0 = 0.3 + Math.random() * 0.45, zw = 0.16;
      zone.style.left = z0 * 100 + '%'; zone.style.width = zw * 100 + '%';
      let t = 0, done = false, last = performance.now();
      const tick = (now) => {
        if (done) return;
        t += ((now - last) / 1000) * speed; last = now;
        const x = 0.5 - 0.5 * Math.cos(t * 2.6);
        needle.style.left = x * 100 + '%'; needle.dataset.x = x;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const hit = () => {
        if (done) return;
        done = true;
        const x = +needle.dataset.x, ok = x >= z0 && x <= z0 + zw;
        (ok ? sfx.pickup : sfx.lose)();
        el.querySelector('.qte-btn').textContent = ok ? 'NAILED IT' : 'SPILLED!';
        removeEventListener('keydown', key, true);
        setTimeout(() => { closeModal(el); resolve(ok); }, 450);
      };
      const key = (e) => { if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); hit(); } };
      addEventListener('keydown', key, true);
      el.querySelector('.qte-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    });
  },

  async powder() {
    const st = this.g.state;
    const v = await this.quick({ speaker: 'The first stall', text: 'Lines of glittering green powder on the cistern lid. Someone left in a hurry.', options: [
      { label: 'Take a bump', note: `+${DOSE.powder} intoxication · X-ray for free for a while · blackout risk`, value: 'take', cls: 'risky' },
      { label: 'Bag a sample', note: 'Evidence', value: 'bag' },
      { label: 'Leave it', value: null },
    ] });
    if (!v) return;
    this.powderTaken = true;
    if (v === 'bag') { await this.gotClue('restroom:pills', { title: 'The first stall' }); return; }
    sfx.drink(); st.addIntox(DOSE.powder);
    this.xrayFree = 30;
    this.addCard('pill', `${HERO} in a restroom stall`);
    toast('Everything sharpens. X-ray costs nothing for half a minute.', 'info');
    if (st.intox >= 80 && Math.random() < 0.35) setTimeout(() => this.sedate('The powder hits all at once. The stall spins away…', { blackout: true }), 900);
  },

  // ---- the predator: a sharp suit with a drink, working the edge of the floor
  stepPredator(dt) {
    const V = this.plan.V, h = this.hero.position;
    if (!this.predator) {
      if (this.t < 25 || this.predatorDone) return;
      this.predator = this.npc({ ...npcLook('civilian'), top: '#2a2a3a', bottom: '#2a2a3a', skirt: null, tie: '#a01030', hairStyle: 'slick' }, V.hw - 4, V.hd - 4, Math.PI);
      this._castPos = null;
    }
    const m = this.predator;
    if (this.predatorDone) { m.position.x += dt * 2; if (m.position.x > V.hw + 30) { m.visible = false; } return; }
    const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
    if (this.room || this.busy) return;
    if (d > 1.4) {
      const sp = d > 8 ? 2.2 : 1.3;
      m.position.x += (dx / d) * sp * dt; m.position.z += (dz / d) * sp * dt;
      m.rotation.y = Math.atan2(dx, dz);
      const s = Math.sin(this.t * 8) * 0.4; m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s;
    } else this.run(() => this.predatorOffer());
  },

  async predatorOffer() {
    this.predatorDone = true;
    const st = this.g.state;
    const x = this.xray;
    const opts = [{ label: 'Take the drink', note: 'Something feels off', value: 'take', cls: 'risky' }, { label: '"No thanks."', value: 'no' }];
    if (x) opts.unshift({ label: 'Expose him: the drink is spiked', value: 'expose', cls: 'good' });
    const v = await this.quick({ speaker: 'A man in a sharp suit', text: `"You look like you need this more than I do." He holds out a glass, smiling a little too long.${x ? '<small>X-ray: green powder still settling at the bottom of the glass.</small>' : ''}`, options: opts, at: this.predator, away: 'no' });
    if (v === 'take') {
      sfx.drink(); st.addIntox(DOSE.spiked);
      this.addCard('drunk', `${HERO}, spiked and swaying`);
      toast('Spiked. The floor tilts.', 'bad');
    } else if (v === 'expose') {
      await this.gotClue('bar:spiked', { title: 'Caught him' });
      this.bonus = (this.bonus || 0) + 5;
      toast('He drops the glass and bolts into the crowd.', 'good');
    }
  },
};
