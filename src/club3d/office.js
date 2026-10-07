// The back office (docs/design/nightclub.md "Special room: the back office"). Getting in: the staff
// keypad (the code comes through his door with super-hearing, or a whisper on the floor), or the
// drop, when the door swings open. Inside: the owner at his desk and his envelope, the safe behind
// the painting (X-ray finds it, super-hearing cracks it: empty it and his polaroids are gone), the
// CCTV recorder (wipe it and her dance is gone). The confrontation: he lays down a polaroid of her
// night and a line; she answers with evidence, in order (who deals it, who supplies it, the drop).
// The right card in time: he confesses. A wrong one: he releases it all (the humiliation).
import { dialog, toast, keypad, openModal, closeModal, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { showNewspaper } from '../newspaper.js';
import { playScreenScene } from '../cutscene.js';
import { BILLBOARDS, DEALS, DISTRICTS, HERO } from '../data.js';
import { pick, clamp } from '../util.js';

const STOLEN = new Set(['pill', 'drunk', 'sedated', 'fans', 'paparazzi', 'couch', 'photos']); // what the safe holds

export const officeMethods = {
  async officeKeypad() {
    const known = this.knowsOfficeCode;
    const code = await keypad(known ? `Staff door (${this.officeCode})` : 'Staff door: 4-digit code');
    if (code === null) return;
    if (code === this.officeCode) { this.officeOpen = true; this.openDoorOf('office'); sfx.door(); toast('The staff door clicks open.', 'good'); return; }
    this.alert = Math.min(95, this.alert + 25); sfx.alarm();
    toast('Wrong code. The keypad chirps and a bouncer looks over.', 'bad');
  },

  async stockKeypad() {
    const code = await keypad(this.uvRead ? `Stock room (${this.stockCode})` : 'Stock room: 4-digit code');
    if (code === null) return;
    if (code === this.stockCode) { this.stockOpen = true; this.openDoorOf('storage'); sfx.door(); toast('The stock room unlocks.', 'good'); return; }
    this.alert = Math.min(95, this.alert + 20); sfx.alarm();
    toast(this.uvRead ? 'Wrong code.' : 'Wrong code. Somebody must have written it down somewhere…', 'bad');
  },

  /** The stock room's stash: behind the beer crates (X-ray sees it; so does anyone who heard where). */
  async searchStash() {
    if (!this.xray && !this.noted.has('stash')) {
      await dialog({ title: 'Beer crates', text: 'Crates of beer, stacked to the ceiling. Nothing but beer, as far as you can see.<span class="hint">X-ray would see further.</span>' });
      return;
    }
    this.stashFound = true;
    sfx.hit();
    await this.gotClue('storage:stash', { title: 'Behind the crates' });
  },

  /** Super-hearing at the office door, from the hall: after a few seconds, his phone call. */
  listenAtOffice(dt) {
    if (this.officeHeard || this.officeOpen) return;
    const q = this.plan.byKind.office, h = this.hero.position;
    if (Math.hypot(h.x - q.door.x, h.z - q.door.z) > 5) { this.officeEar = 0; return; }
    this.officeEar = (this.officeEar || 0) + dt;
    if (this.officeEar < 3) return;
    this.officeHeard = true; this.knowsOfficeCode = true;
    this.run(async () => {
      await dialog({ title: 'Through the door', text: `With super-hearing you pick his voice out of the bass: <b>"…no, the door's ${this.officeCode}, same as always. And tell K Thursday's still on."</b><span class="hint">You know the staff door's code.</span>` });
      await this.gotClue('office:phone', { quiet: true });
    });
  },

  async safeCrack() {
    if (!this.xray) { await dialog({ title: 'A painting', text: 'An ugly sunset in a gold frame. Hung a little too carefully.<span class="hint">X-ray would show what\'s behind it.</span>' }); return; }
    const v = await dialog({ title: 'Behind the painting', text: 'X-ray: a wall safe, and through its door, a stack of envelopes. Polaroids.', options: [
      { label: 'Listen to the tumblers', note: this.hearing ? 'Super-hearing is on' : 'Needs super-hearing', value: 'ear', disabled: !this.hearing },
      { label: 'Tear the door off', note: 'Super-strength: everyone will hear it', value: 'rip', cls: 'risky' },
      { label: 'Leave it', value: null },
    ] });
    if (!v) return;
    if (v === 'rip') { sfx.hit(); flash('#fff'); this.alert = Math.min(95, this.alert + 50); this.bossWary = (this.bossWary || 0) + 1; }
    else sfx.click();
    this.safeDone = true;
    const before = (this.envelope || []).length;
    this.envelope = (this.envelope || []).filter((c) => !STOLEN.has(c.id));
    this.envHud();
    const n = before - this.envelope.length;
    await dialog({ title: 'The safe', text: `${n ? `${n} polaroid${n === 1 ? '' : 's'} of you, and the negatives. You take them all.` : 'Envelopes of polaroids. None of you, yet.'}${this.envelope.some((c) => c.id === 'dance') ? '<span class="hint">Your dance is still on the CCTV recorder.</span>' : ''}` });
    await this.gotClue('office:cash', { quiet: true });
  },

  async wipeRecorder() {
    this.recorderWiped = true;
    this.envelope = (this.envelope || []).filter((c) => c.id !== 'dance');
    this.envHud();
    if (this.guards.some((g) => g.seeing)) this.alert = Math.min(95, this.alert + 10);
    sfx.click();
    toast('Recorder wiped. Every feed shows snow now.', 'good');
    this.cctvDead = true;
    for (const m of this.roomA.office?.cctv || []) m.userData.screen.bright.value = 0.25;
  },

  /** Per frame (from stepCast): the CCTV shows her own dance once she's danced; the hall's video comes back outside. */
  officeVideo() {
    const inOffice = this.room === this.plan.byKind.office;
    if (inOffice === this.wasInOffice) return;
    this.wasInOffice = inOffice;
    if (inOffice && !this.cctvDead && (this.envelope || []).some((c) => c.id === 'dance')) this.video.show('ClubDance', { keyed: true });
    else this.video.show('ClubDJ', { extra: ['assets/nightclub/plates/set_main.mp4'] });
  },

  async confront() {
    const B = this.caseDef.boss, env = [...(this.envelope || [])].sort((a, b) => b.w - a.w);
    if (!B) return;
    const thick = env.length;
    const pat = thick ? `He pats an envelope on the desk. ${thick >= 4 ? 'It\'s thick.' : thick >= 2 ? 'There\'s something in it.' : 'It looks thin.'}` : 'He reaches for an envelope… and finds it empty. He sweats.';
    const go = await dialog({ speaker: B.name, text: `"${HERO}. I wondered when you'd come. Sit." ${pat}<span class="hint">He'll counter you three times. Answer each with evidence of the right kind (who deals it, who supplies it, the drop). Wrong, or too slow, and he releases what he has on you.</span>`, options: [{ label: 'Lay out your evidence', value: true, cls: 'risky' }, { label: 'Not yet', value: false }] });
    if (!go) return;
    const found = Object.keys(this.caseDef.clues).filter((k) => this.book.found.has(k) && !this.caseDef.clues[k].flavour && this.caseDef.clues[k].cat);
    if (!found.length) { await dialog({ speaker: B.name, text: '"You\'ve got nothing. Get out of my office."' }); return; }
    const secs = clamp(16 - 2.5 * thick - 2 * (this.bossWary || 0), 6, 18);
    const used = new Set();
    for (const step of B.steps) {
      const card = env.shift();
      const img = card?.img ? `<img class="c3-pol" src="${card.img.toDataURL('image/jpeg', 0.8)}">` : '';
      const lead = card ? `${img}He slides a polaroid across the desk: <i>${card.label}</i>. ` : '';
      const opts = found.filter((k) => !used.has(k)).map((k) => ({ label: this.caseDef.clues[k].note, value: k }));
      opts.push({ label: 'Back off', value: 'back' });
      const v = await this.choiceTimer({ speaker: B.name, text: `${lead}${step.line}`, options: opts, secs });
      if (v === 'back') { this.bossWary = (this.bossWary || 0) + 1; await dialog({ speaker: B.name, text: '"That\'s what I thought."' }); return; }
      const c = v && this.caseDef.clues[v];
      if (!c || c.cat !== step.cat) return this.leak(card || env[0] || null, v ? 'wrong' : 'slow');
      used.add(v); sfx.pickup();
    }
    this.bossDone = true;
    if (this.bossNPC?.enemy) this.bossNPC.enemy.play('defeated');
    await this.gotClue(B.confession, { title: `${B.name} folds` });
    await this.solveCase('confession');
  },

  /** A choice with a countdown bar: resolves with the value, or null when time runs out. */
  choiceTimer({ speaker, text, options, secs }) {
    return new Promise((resolve) => {
      const el = openModal(`${speaker ? `<div class="speaker">${speaker}</div>` : ''}<div class="dtext">${text}</div><div class="bar c3-clock"><i class="b-alert" style="width:100%"></i></div>
        <div class="opts">${options.map((o, i) => `<button class="opt ${o.cls || ''}" data-i="${i}"><span class="k">${i + 1}</span><span class="l">${o.label}</span></button>`).join('')}</div>`, 'dlg danger');
      const bar = el.querySelector('.c3-clock i'), t0 = performance.now();
      let done = false;
      const end = (v) => { if (done) return; done = true; removeEventListener('keydown', key, true); closeModal(el); sfx.click(); resolve(v); };
      el.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => end(options[+b.dataset.i].value)));
      const key = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); end(options[n - 1].value); } };
      addEventListener('keydown', key, true);
      const tick = () => {
        if (done) return;
        const left = 1 - (performance.now() - t0) / 1000 / secs;
        bar.style.width = Math.max(0, left * 100) + '%';
        if (left <= 0) return end(null);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },

  /** He releases what he has: the humiliation (front page + the billboards) or an embarrassing deal; then she's thrown out. */
  async leak(card, why) {
    const B = this.caseDef.boss, st = this.g.state, zone = this.zone;
    sfx.lose();
    await dialog({ speaker: B.name, text: `${why === 'slow' ? '"Too slow, hero."' : '"Wrong card."'} He picks up the phone. <b>"Send it all. Every paper, every screen in the city."</b>` });
    const deal = pick(DEALS), task = deal.task.replaceAll('{V}', B.name);
    const v = await dialog({ title: 'THE ULTIMATUM', speaker: B.name, cls: 'danger', text: `"Last chance. Choose."<br><br><b>A)</b> The photos of your night in my club go out. All of them.<br><br><b>B)</b> You <b>${task}</b>, and you stay out of every <b>${zone.lockKey}</b> for three minutes."`, options: [
      { label: 'A: Let him release them', note: '−30 reputation', value: 'A', cls: 'bad' },
      { label: 'B: Take the embarrassing deal', note: `−8 reputation · no ${zone.lockKey} for 3:00`, value: 'B', cls: 'risky' },
    ] });
    if (v === 'A') {
      st.addRep(-30, 'Your night, on every front page');
      st.photosLost = (st.photosLost || 0) + (this.envelope || []).length;
      await showNewspaper({ tabloid: true, rep: -30, photo: card?.img || 'tabloid', headline: `${HERO.toUpperCase()} PARTIES HARD AT ${(zone.venue || 'THE CLUB').toUpperCase()}`, sub: card ? `"${card.label}": the photos the club didn't want you to see` : 'Shock photos from inside the city\'s hottest club', body: [`The photographs arrived at every newsroom in the city overnight: ${HERO}, out of costume in all but name, very much not on patrol.`, '"Is this who protects us?" asked one reader. The club\'s owner declined to comment, smiling.'] });
      const vice = BILLBOARDS.vice.includes(zone.district);
      await playScreenScene({ screens: vice ? BILLBOARDS.rld : BILLBOARDS.downtown, folder: BILLBOARDS.folders, maxSecs: 12, holdSecs: 4, caption: `By morning, the billboards in ${DISTRICTS[zone.district]?.name || 'the city'} are playing it…` });
    } else {
      st.addRep(-8, 'An embarrassing deal');
      st.lockouts[zone.lockKey] = 180;
      await showNewspaper({ tabloid: true, photo: 'deal', rep: -8, headline: deal.headline.replaceAll('{H}', HERO.toUpperCase()).replaceAll('{V}', B.name.toUpperCase()), sub: `Fans baffled as ${HERO} agrees to ${task.charAt(0).toLowerCase() + task.slice(1)}`, body: ['Nobody knows why the city\'s favourite heroine would do such a thing. Insiders whisper about "some photos".'] });
    }
    await dialog({ speaker: B.name, text: '"Now get out of my club." Two bouncers walk you to the door.' });
    banner('THROWN OUT', 'The case stays open', '#ff3fb8');
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: 0 });
  },
};
