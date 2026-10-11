// The case in the 3D club: the CaseBook (shared with the 2D club's case data), the rumours and
// whispers she's noted, the VIP answers she's learned, the case board (CASE), the accusation,
// solving it (the leads go on the map) and getting out (the exit ring or the skylight).
import { pickCase, CaseBook, CLUB_CASES } from '../nightclub/case.js';
import { dialog, toast, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';

export const caseMethods = {
  startCase(zone) {
    const forced = CLUB_CASES[new URLSearchParams(location.search).get('club3case')];
    this.caseDef = forced || pickCase(zone, this.g.state);
    this.book = new CaseBook(this.caseDef);
    this.noted = new Set();      // rumour / whisper ids she's noted
    this.learned = new Set();    // VIP questions she knows the answer to
    this.items = new Set();      // the VIP wristband…
    this.caseSolved = false;
    this.accuseLock = 0;
    this.officeCode = String(1000 + Math.floor(Math.random() * 9000));
    this.stockCode = String(1000 + Math.floor(Math.random() * 9000));
  },

  /** Mark a clue ("room:object") found. Shows its text unless quiet; true the first time. */
  async gotClue(key, { quiet = false, title = 'Clue' } = {}) {
    const [kind, id] = key.split(':');
    const c = this.book.clue(kind, id);
    if (!c) return false;
    const fresh = this.book.find(kind, id);
    if (c.item) this.items.add(c.item);
    if (!fresh) return false;
    sfx.pickup();
    const d = this.caseDef;
    const tail = c.flavour ? '' : `<span class="hint">Case board: ${this.book.count}/${d.need}${this.book.ready && !this.caseSolved ? ' · you can make an accusation (CASE)' : ''}</span>`;
    if (quiet) toast(`Clue: ${c.note}`, 'good');
    else await dialog({ title, text: c.text + tail });
    return true;
  },

  /** A rumour or whisper noted (tapped in the crowd, or heard). */
  noteRumour(r, whisper = false) {
    if (this.noted.has(r.id)) return false;
    this.noted.add(r.id);
    if (r.teach) this.learned.add(r.teach);
    if (r.code) this.knowsOfficeCode = true;
    toast(`${whisper ? 'Overheard' : 'Noted'}: ${this.rumourText(r)}`, 'good');
    sfx.click();
    return true;
  },

  rumourText(r) { return r.text.replace('{CODE}', this.officeCode); },

  async caseBoard() {
    const d = this.caseDef, notes = this.book.notes();
    const rumours = [...(d.rumours || []), ...(d.whispers || [])].filter((r) => this.noted.has(r.id));
    const list = notes.length ? `<div class="list">${notes.map((s) => `<div class="item">${s}</div>`).join('')}</div>` : '<p>No clues yet. Search the club (USE), listen in on the Talkers, tap rumours in the crowd.</p>';
    const rum = rumours.length ? `<b>Rumours</b><div class="list">${rumours.map((r) => `<div class="item"><i>"${this.rumourText(r)}"</i></div>`).join('')}</div>` : '';
    const status = this.caseSolved ? 'Case solved. Get out: the exit, or fly out through the skylight.'
      : this.book.ready ? 'You have enough to make an accusation.'
        : `Find ${d.need - this.book.count} more solid clue${d.need - this.book.count === 1 ? '' : 's'} before you accuse anyone.`;
    const opts = this.book.ready && !this.caseSolved ? [{ label: 'Make the accusation', value: 'accuse' }, { label: 'Keep looking', value: null }] : [{ label: 'Close', value: null }];
    const v = await dialog({ title: `Case: ${d.title}`, text: `${list}${rum}<span class="hint">${status} (${this.book.count}/${d.need})</span>`, options: opts });
    if (v === 'accuse') await this.accuse();
  },

  async accuse() {
    if (this.t < this.accuseLock) { toast('They\'re watching you now. Give it a minute.', 'bad'); return; }
    let right = 0;
    for (const q of this.caseDef.questions) if (await dialog({ title: 'The accusation', text: q.q, options: q.options }) === q.answer) right++;
    if (right === this.caseDef.questions.length) return this.solveCase('accusation');
    this.accuseLock = this.t + 60;
    this.g.state.addIntox(40); sfx.drink();
    this.alert = Math.min(95, this.alert + 25);
    this.addCard('drunk', 'Dosed after a wrong accusation');
    await dialog({ title: 'Wrong call', text: `${right} of ${this.caseDef.questions.length} right. Word gets round the club fast. Before you can think it through, someone presses a drink into your hand and the crowd makes sure you finish it.` });
  },

  /** Solved (accusation or confession): the leads go on the map; now she has to get out. */
  async solveCase(how) {
    if (this.caseSolved) return;
    this.caseSolved = true;
    const st = this.g.state, d = this.caseDef, leads = this.book.leads();
    st.leads = st.leads || []; st.leadsDone = st.leadsDone || [];
    const fresh = leads.filter((l) => !st.leads.some((q) => q.id === l.id) && !st.leadsDone.includes(l.id));
    for (const l of fresh) st.leads.push({ id: l.id, name: l.name, kind: l.kind, venue: l.venue || null, theme: l.theme || null, reward: l.reward, blurb: l.blurb });
    st.cases = st.cases || {}; st.cases[d.id] = { solved: true };
    st.save();
    sfx.win();
    banner('CASE SOLVED', 'Now get out: the exit, or the skylight', '#39ff6a');
    const where = (fresh.length ? fresh : leads).map((l) => `<div class="item"><b>${l.name}</b> · ${l.reward} REP<br>${l.blurb}</div>`).join('');
    await dialog({ title: how === 'confession' ? 'He folds' : 'Case solved', text: `${d.solvedText || ''} The distribution points are marked on your map:<div class="list">${where}</div><span class="hint">Get out with it: walk out the front, or fly out through the skylight over the dance floor.</span>` });
    await this.g.act?.onCaseSolved(d.id); // the act: this case's lieutenant is unmasked
    this.alert = Math.max(this.alert, 35); // they know now
  },

  async leaveClub() {
    if (this.caseSolved) return this.winClub('door');
    const v = await dialog({ title: 'Leave the club?', text: 'The case stays open. Anything they have on you stays here with them.', options: [{ label: 'Leave', value: true, cls: 'bad' }, { label: 'Stay', value: false }] });
    if (!v) { this.hero.position.z -= 2.2; return; }
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: -3 });
  },

  winClub(how) {
    if (this.done) return;
    this.done = true;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    sfx.win();
    banner(how === 'sky' ? 'UP AND AWAY!' : 'CASE CLOSED!', '', '#3ee08a');
    const d = this.caseDef;
    if (d.theme) this.zone.theme = d.theme;
    this.zone.boss = null;
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: (d.rep || 25) + (this.bonus || 0), photo: 'special' }), 1200);
  },

  // ---- objectives (the panel + the marker)
  objectiveList() {
    const d = this.caseDef, A = this.roomA, T = this.talkers || [];
    const list = [];
    if (this.caseSolved) {
      list.push({ t: 'Get out: the exit, or the skylight over the floor', target: this.exitRing.position, cur: true });
      return list;
    }
    list.push({ t: `Build the case: ${this.book.count}/${d.need} clues${this.book.ready ? ' (CASE to accuse)' : ''}`, done: this.book.ready });
    const heard = T.filter((q) => q.done).length;
    list.push({ t: `Listen in on the Talkers (${heard}/${T.length})`, done: heard === T.length, target: T.find((q) => !q.done)?.pos });
    if (A.vip && !this.vipDone) list.push({ t: this.vipIn ? `Win over ${d.vip?.host || 'the VIP host'}` : 'Get past the VIP rope', target: this.vipIn ? this.vipHost?.position : this.plan.byKind.vip.door });
    if (A.office && !this.bossDone) list.push({ t: this.officeOpen ? `Confront ${d.boss?.name || 'the owner'} in the office` : 'Get into the back office', target: this.officeOpen ? this.bossNPC?.position : this.plan.byKind.office.door });
    return list;
  },

  hudObjectives() {
    const list = this.objectiveList();
    let cur = null;
    const html = list.map((o) => {
      const isCur = !o.done && !cur;
      if (isCur) cur = o;
      return `<div class="${o.done ? 'done' : isCur ? 'cur' : ''}">${o.done ? '✓' : '•'} ${o.t}</div>`;
    }).join('');
    const el = document.getElementById('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    this.markerFor(cur && cur.target);
  },

  markerFor(target) {
    const mk = document.getElementById('marker');
    if (!target || this.done || this.busy) { mk.classList.remove('on'); return; }
    const s = this.screenOf({ x: target.x, y: 0, z: target.z }, 2.6);
    const w = this.g.w, h = this.g.h;
    let x = s ? s.x : w / 2, y = s ? s.y : h - 40;
    x = Math.max(30, Math.min(w - 30, x)); y = Math.max(70, Math.min(h - 40, y));
    mk.style.transform = `translate(${x}px,${y}px)`;
    mk.querySelector('span').textContent = `${Math.round(Math.hypot(target.x - this.hero.position.x, target.z - this.hero.position.z))}m`;
    mk.classList.add('on');
  },

  /** Fly out through the skylight (once the case is solved): the comic way to leave. */
  async skylight() {
    if (!this.caseSolved) return;
    this.heroClip('jump', 2);
    this.anims.push((t, dt) => { this.hero.position.y += dt * 9; });
    toast(`${HERO} punches through the skylight!`, 'good');
    setTimeout(() => this.winClub('sky'), 700);
  },
};
