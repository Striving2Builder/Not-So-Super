// Act 2's runtime (docs/design/act2.md): the gates, the opening (the scandal, then she wakes up
// tied up inside the first RLD Walk), the suit's finds, the cult's Polaroids and the act board's
// Act 2 page. act.js owns the instance (game.act.two) and hands over once Act 1 is complete.
// State lives in state.act.act2 (saved with Act 1's, so an Act 1 save loads exactly as before).
//
// The contract with the RLD Walks (src/rld/, job I): the level registers game.modes.rldwalk (and
// main.js modeFor). The zone fields come from game.rldWalkFields(opts) or game.modes.rldwalk.fields(opts)
// if either exists, else a stand-in zone; the opening zone carries `opening: true`. Without the
// mode, the opening skips the walk with a toast. A won walk counts (zone.mode === 'rldwalk'), and a
// right "Which one is hers?" pick calls game.act.suitFind(piece, true).
import { ACT2, GATES, GATE_LABELS, FINDS, PIECES, PIECE_ALIAS, CLUES, BEATS, LINES } from './act2.js';
import { spotCall, impostorize, fakeStrength } from './spot.js';
import { makePolaroid } from '../polaroids.js';
import { showNewspaper } from '../newspaper.js';
import { VENUES } from '../data.js';
import { dialog, toast, openModal, closeModal } from '../ui.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { LOT } from '../city.js';
import { pick, clamp, dist, chance } from '../util.js';

const POL_RECT = [14, 14, 232, 232]; // the photo inside a Polaroid (blackout.js polaroid())
const STRAY_FAKE = 0.6;              // share of the cult's Polaroids that are fakes
const WALK_EVERY = 3;                // s between checks for a walk on the map
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A new Act 2 (made when Act 1 completes). `opening`: 'pending' → 'walk' → 'done'. */
export function freshAct2() {
  return {
    id: ACT2.id, opening: 'pending', counts: Object.fromEntries(Object.keys(GATES).filter((k) => k !== 'suit').map((k) => [k, 0])),
    suit: Object.fromEntries(PIECES.map((p) => [p.id, 0])), clues: {}, beats: {}, unsorted: 0, lairOpen: false, bossReady: false, done: false,
  };
}

/** Fill in fields a newer build added (old Act 2 saves keep loading). */
function norm(B) {
  const f = freshAct2();
  for (const k of Object.keys(f)) if (B[k] === undefined) B[k] = f[k];
  for (const k of ['counts', 'suit']) for (const [q, v] of Object.entries(f[k])) if (typeof B[k][q] !== 'number') B[k][q] = v;
  return B;
}

const pieceOf = (p) => {
  const k = String(p || '').toLowerCase().trim();
  const id = PIECE_ALIAS[k] || k;
  return PIECES.some((q) => q.id === id) ? id : null;
};

export class Act2 {
  constructor(act) {
    this.act = act;
    this.g = act.g;
    this.walkLive = false; // the opening walk was started this session (vs a reload mid-walk)
    this.walkT = 0;
    this.seen = new WeakSet();
  }

  /** Act 2's state, or null while Act 1 is still running. */
  get B() {
    const B = this.act.A?.act2;
    if (!B) return null;
    if (!this.seen.has(B)) { this.seen.add(B); norm(B); }
    return B;
  }
  on() { const B = this.B; return !!(B && !B.done); }

  /** Act 1 is complete: Act 2 is next (the overworld plays its opening at the next calm moment). */
  begin() {
    const A = this.act.A;
    if (!A || A.act2) return;
    A.act2 = freshAct2();
    this.g.state.save();
  }

  /** ?act=act2 (the start of the act), act2lair (every gate met), act2boss (and the boss is next). */
  applyDebug(st, which) {
    const A = st.act;
    A.done = true; A.lairOpen = false;
    const B = A.act2 = freshAct2();
    if (which === 'act2') return;
    B.opening = 'done';
    for (const c of CLUES) B.clues[c.id] = true;
    for (const k of Object.keys(B.counts)) B.counts[k] = GATES[k];
    for (const p of PIECES) B.suit[p.id] = FINDS;
    B.beats.opening = B.beats.morning = true;
    st.rep = ACT2.scandalRep;
    if (which === 'act2boss') { B.beats.lair = true; B.lairOpen = true; B.bossReady = true; }
  }

  // ------------------------------------------------------------------ the gates
  suitFinds() { const B = this.B; return PIECES.reduce((n, p) => n + Math.min(FINDS, B.suit[p.id] || 0), 0); }

  gates() {
    const c = this.B.counts;
    return Object.keys(GATES).map((id) => ({ id, label: GATE_LABELS[id], have: id === 'suit' ? this.suitFinds() : c[id] || 0, need: GATES[id] }));
  }
  gatesMet() { return this.gates().every((r) => r.have >= r.need); }

  /** A drug or trafficking case (the investigations gate). */
  drugCase(z) {
    if (z.drugCase) return true;
    if (z.mode !== 'investigate' && z.mode !== 'nightcase') return false;
    return ['smuggle', 'spiked'].includes(z.def?.id) || ['drugs', 'trafficking', 'intoxication'].includes(z.theme)
      || /drug|traffick|smuggl|spik|squirt|pill/i.test(`${z.def?.crime || ''} ${z.name || ''}`);
  }

  /** A mission won (act.js onZoneWin, from main.js endZone): count it toward the gates. */
  async onZoneWin(zone) {
    const B = this.B;
    if (!B || B.done) return;
    const c = B.counts, V = VENUES[zone.venue];
    const casino = !!(zone.casino || zone.mode === 'casino' || V?.kind === 'casino');
    if (zone.mode === 'asylum') c.asylum++;
    if (zone.mode === 'rldwalk') c.rldwalk++;
    if (casino) c.casino++;
    else if (zone.clubCase || V?.club || V?.kind === 'club') c.clubs++;
    if (zone.mode === 'factory' || zone.factoryLine) c.factory++;
    if (this.drugCase(zone)) c.investigations++;
    this.g.state.save();
  }

  /** Count one toward a gate from elsewhere (e.g. count('promotions') when the call catches one). */
  count(id, n = 1) {
    const B = this.B;
    if (!B || B.done || !(id in B.counts)) return null;
    B.counts[id] += n;
    this.g.state.save();
    return B.counts[id];
  }

  /**
   * A find toward a piece of her original suit (state only; the board's picture is phase C2).
   * `real`: the pick was the genuine article (a wrong pick counts nothing). Finds 1-4 are stained
   * copies or clues; the 5th brings the real piece back. Returns { piece, n, back } or null.
   */
  suitFind(piece, real = true) {
    const B = this.B;
    if (!B || B.done) return null;
    let id = pieceOf(piece);
    if (!id) id = ['cape', 'boots', 'briefs'].sort((a, b) => B.suit[a] - B.suit[b])[0]; // (an unknown piece: the one furthest behind)
    const P = PIECES.find((p) => p.id === id);
    if (!real) { toast(LINES.wrong, 'info'); return { piece: id, n: B.suit[id], back: B.suit[id] >= FINDS }; }
    if (B.suit[id] >= FINDS) return { piece: id, n: FINDS, back: true };
    const n = ++B.suit[id];
    this.g.state.save();
    if (n >= FINDS) { sfx.win(); toast(`${P.glyph} ${P.name}: ${LINES.real} Your ${P.name.toLowerCase()} is back (${this.suitFinds()}/${GATES.suit})`, 'good'); }
    else toast(`${P.glyph} ${P.name} · find ${n}/${FINDS}: ${LINES.copy[(n - 1) % LINES.copy.length]}`, 'good');
    return { piece: id, n, back: n >= FINDS };
  }

  /** The impostors' reputation (a placeholder until the pendulum, phase B): roughly the inverse of hers. */
  impRep() { return clamp(-this.g.state.rep - 10 * (this.B?.counts.promotions || 0), -100, 300); }

  // ------------------------------------------------------------------ per frame (act.js update)
  update(dt, ow) {
    const B = this.B;
    if (!B || B.done) return;
    const q = this.act.queue, queued = () => q.some((e) => e.two);
    for (const z of ow.zones) if (z.hotel && !z.act2) ow.removeZone(z); // (Act 1's floor 13, if it was still on the map)
    if (B.opening !== 'done') {
      if (!queued() && !this.act.busy && this.g.modeName === 'overworld') q.push({ two: 'start' }); // (the wake-up, or the papers after it)
      return;
    }
    if (!B.lairOpen && this.gatesMet()) { B.lairOpen = true; this.g.state.save(); q.push({ two: 'lair' }); }
    if ((this.walkT -= dt) <= 0) { this.walkT = WALK_EVERY; this.ensureWalk(ow); }
  }

  async play(ev, ow) {
    const B = this.B, st = this.g.state;
    if (!B) return;
    if (ev.two === 'start' && B.opening !== 'done' && !(B.opening === 'walk' && this.walkLive)) return this.opening(ow);
    if (ev.two === 'start' && B.opening === 'walk') { // back from the opening walk (however it went): the morning papers
      B.opening = 'done'; B.beats.morning = true;
      for (const c of CLUES) B.clues[c.id] = true;
      st.save();
      const M = BEATS.morning, pic = await makePolaroid('the morning after');
      comic.headline(M.paper.headline, { tone: 'bad', kicker: M.paper.kicker });
      await showNewspaper({ ...M.paper, rep: ACT2.scandalRep, photo: pic });
      await dialog({ title: 'The first clues', text: M.after });
      return;
    }
    if (ev.two === 'lair') {
      B.beats.lair = true; st.save();
      sfx.alarm();
      await showNewspaper(BEATS.lair.paper);
      await dialog({ title: 'The hall of mirrors', text: BEATS.lair.after });
    }
  }

  /** The act's opening: the title card, the scandal (rep → −50), then the walk she wakes up in. */
  async opening(ow) {
    const B = this.B, st = this.g.state, O = BEATS.opening;
    if (B.opening === 'pending') {
      B.opening = 'walk'; B.beats.opening = true;
      st.addRep(ACT2.scandalRep - st.rep, 'The scandal: the Polaroids, the tape, the lost suit');
      st.save();
      comic.caption(O.caption, { ms: 6500 });
      await dialog({ title: O.title, text: O.text, options: [{ label: O.wake, value: true }] });
    }
    this.walkLive = true; // (whatever happens next, back in the sky the morning papers come out)
    if (!this.startWalk(ow, { opening: true })) toast('The RLD Walk isn\'t in this build yet: the act goes on without it', 'info');
  }

  // ------------------------------------------------------------------ the RLD Walks (job I's level)
  /** Zone fields for a walk, from the level if it's registered; null if it isn't. */
  walkFields(opts = {}) {
    const g = this.g, M = g.modes?.rldwalk;
    if (!M) return null;
    const f = typeof g.rldWalkFields === 'function' ? g.rldWalkFields : typeof M.fields === 'function' ? M.fields.bind(M) : null;
    const base = f ? f(opts) : {
      kind: 'special', venue: 'Red Light Den', name: 'RLD Walk: the red-light street', reward: 18, lockKey: 'RLD Walks', ttl: 600,
      color: '#ff2244', glyph: 'R', risk: 'House perfume', blurb: 'Women are being held behind the red doors. X-ray the rooms and free them.',
    };
    return { ...base, ...opts, mode: 'rldwalk' };
  }

  /** A spot in the red-light district, away from her and the other incidents. */
  walkSpot(ow, far = 500) {
    const city = this.g.city, h = ow.hero;
    const ok = (b) => !b.river && dist(b.x0 + LOT / 2, b.y0 + LOT / 2, h.x, h.y) > far && ow.zones.every((z) => dist(z.x, z.y, b.x0 + LOT / 2, b.y0 + LOT / 2) > 400);
    const b = pick(city.blocks.filter((q) => q.d === ACT2.opening.district && ok(q))) || pick(city.blocks.filter((q) => q.d === ACT2.opening.district && !q.river));
    return b ? { x: b.x0 + LOT / 2, y: b.y0 + LOT / 2, district: b.d } : null;
  }

  /** Start a walk now (the opening). False if the level isn't registered. */
  startWalk(ow, opts) {
    const f = this.walkFields(opts);
    if (!f) return false;
    const at = this.walkSpot(ow, 0) || { x: ow.hero.x, y: ow.hero.y, district: ACT2.opening.district };
    const z = { uid: ow.uid++, t: 0, ...f, x: at.x, y: at.y, district: at.district, actGate: 'rldwalk' };
    Object.assign(ow.hero, { x: at.x, y: at.y + 60 }); // (she comes out of it in the red-light district)
    this.g.startZone(z);
    return true;
  }

  /** While the gate is short, keep one walk on the map (beyond the incident quota: actGate). */
  ensureWalk(ow) {
    const B = this.B;
    if (ow.attract || B.counts.rldwalk >= GATES.rldwalk || ow.zones.some((z) => z.mode === 'rldwalk')) return;
    const f = this.walkFields();
    const at = f && this.walkSpot(ow);
    if (!at) return;
    ow.zones.push({ uid: ow.uid++, t: 0, ...f, ttl: Math.max(f.ttl || 0, 600), x: at.x, y: at.y, district: at.district, actGate: 'rldwalk' });
  }

  // ------------------------------------------------------------------ the cult's Polaroids
  straysOn() { const B = this.B; return !!(B && !B.done && B.opening === 'done'); }
  straysShort() { return this.straysOn() && this.B.counts.polaroids < GATES.polaroids; }
  strayFake() { return chance(STRAY_FAKE); }

  async callPolaroid(z) {
    const B = this.B, st = this.g.state;
    const pic = await makePolaroid();
    const fakePic = z.fake ? impostorize(pic, fakeStrength(B.counts.polaroids), POL_RECT) : null;
    const fake = !!fakePic;
    const r = await spotCall({ img: fakePic || pic, fake, sub: `It was ${z.where}.`, tell: fakePic?.tell, score: `Cult Polaroids called ${B.counts.polaroids}/${GATES.polaroids}` });
    if (fake && r.right) { B.counts.polaroids++; st.addRep(4, 'Proved a cult Polaroid was a fake'); }
    else if (fake) { B.unsorted++; toast('It\'s pinned to your act board: look at it again later', 'info'); }
    else if (r.right) st.addRep(2, 'Got a polaroid back');
    st.save();
  }

  async lookAgain() {
    const B = this.B;
    if (!B.unsorted) return;
    const pic = await makePolaroid();
    const fakePic = impostorize(pic, fakeStrength(B.counts.polaroids), POL_RECT);
    if (!fakePic) { toast('Too blurry to tell. Try again.', 'info'); return; }
    const r = await spotCall({ img: fakePic, fake: true, sub: 'Pinned to your board. Look closely this time.', tell: fakePic.tell });
    if (r.right) { B.unsorted--; B.counts.polaroids++; this.g.state.addRep(4, 'Proved a cult Polaroid was a fake'); }
    this.g.state.save();
  }

  // ------------------------------------------------------------------ the act board, page 2
  openBoard() {
    const B = this.B, st = this.g.state;
    const card = (on, i, glyph, name, sub, p, stamp) => `<div class="ab-lt${on ? ' on' : ''}" style="--r:${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg">
        <i class="cb-pin"></i><div class="ab-ph" style="display:grid;place-items:center;font-size:26px;background:${on ? '#fbe3e6' : '#3a3036'}">${glyph}</div>
        <b>${esc(name)}</b><small>${sub}</small>${p ? `<p class="${on ? '' : 'dim'}">${p}</p>` : ''}${stamp ? `<span class="ab-stamp">${stamp}</span>` : ''}</div>`;
    const pieces = PIECES.map((P, i) => {
      const n = Math.min(FINDS, B.suit[P.id] || 0), back = n >= FINDS;
      return card(back, i, P.glyph, P.name, `Finds ${n}/${FINDS}`, back ? 'Hers. Stained, but hers.' : esc(P.from), back ? 'BACK' : '');
    }).join('');
    const clueOn = CLUES.some((c) => B.clues[c.id]);
    const clues = card(clueOn, 5, clueOn ? CLUES[0].glyph : '?', 'The first clues', clueOn ? 'Polaroids and a note' : 'Not found yet',
      clueOn ? CLUES.map((c) => c.line).join(' ') : 'Wake up first.', '');
    const rows = this.gates().map((r) => `<div class="ab-gate${r.have >= r.need ? ' ok' : ''}"><span>${r.have >= r.need ? '✓' : '•'} ${esc(r.label)}</span><b>${Math.min(r.have, r.need)}/${r.need}</b></div>`).join('');
    const suitTxt = PIECES.map((P) => `${P.name} ${Math.min(FINDS, B.suit[P.id] || 0)}/${FINDS}`).join(' · ');
    const status = B.done ? 'Case closed. Supergurl is behind bars, and the suit is back.'
      : B.bossReady ? 'Supergurl is waiting in the hall of mirrors, in your stolen suit.'
        : B.lairOpen ? 'The hotel\'s new floor is lit: the hall of mirrors.'
          : B.opening !== 'done' ? 'You don\'t remember last night.'
            : st.rep < 0 ? 'Disgraced: the casino, the worst clubs and the suit hunt are open to you.' : 'A hero again: the casino and the suit hunt are shut until your name is dirt.';
    const el = openModal(`<div class="cb ab">
        <div class="cb-head"><b>ACT BOARD</b><span>${esc(ACT2.title)}</span></div>
        <div class="ab-grid">
          <div class="ab-lts">${pieces}${clues}</div>
          <div class="ab-side">
            <div class="ab-boss"><i class="cb-pin"></i><div class="ab-q">${B.done ? '✓' : '?'}</div><b>${ACT2.boss.toUpperCase()}</b><small>${B.done ? 'Behind bars' : 'The cult\'s leader, in your stolen suit'}</small></div>
            <div class="ab-jig"><small>Your rep <b>${st.rep}</b> · The impostors' rep <b>${this.impRep()}</b></small><br><small>Suit: ${this.suitFinds()}/${GATES.suit} finds · ${suitTxt}</small></div>
            <div class="ab-gates">${rows}</div>
          </div>
        </div>
        <div class="cb-foot"><span>${status}</span>${B.unsorted ? `<button class="cb-close ab-again">Look again (${B.unsorted})</button>` : ''}<button class="cb-close ab-p1">Act 1</button><button class="cb-close ab-x">Close</button></div>
      </div>`, 'caseboard actboard');
    return new Promise((resolve) => {
      const close = (next) => { removeEventListener('keydown', key, true); closeModal(el); sfx.click(); resolve(next ? next() : undefined); }; // (another page: resolves when that one closes)
      const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } };
      addEventListener('keydown', key, true);
      el.querySelector('.ab-x').addEventListener('click', () => close());
      el.querySelector('.ab-p1').addEventListener('click', () => close(() => this.act.openBoard(1)));
      el.querySelector('.ab-again')?.addEventListener('click', () => close(async () => { await this.lookAgain(); return this.openBoard(); }));
    });
  }
}
