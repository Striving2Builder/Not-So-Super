// The act (docs/design/act1.md): the story running over the whole game. It keeps score of what she
// has done (the gates), unmasks the Puzzle Maker's lieutenants as their cases are solved, plays the
// story beats on the rank-ups, runs the Polaroid calls and the impostor sightings, opens the hotel's
// 13th floor once every gate is met, and shows it all on the act board. State lives in
// state.act (saved with the game). game.act is the one instance; the overworld ticks it.
import { ACT1, LIEUTENANTS, MASQ, GATES, BEATS } from './act1.js';
import { spotCall, impostorize, fakeStrength } from './spot.js';
import { makePolaroid } from '../polaroids.js';
import { showNewspaper } from '../newspaper.js';
import { playScreenScene } from '../cutscene.js';
import { BILLBOARDS, DISTRICTS, HERO, VENUES } from '../data.js';
import { dialog, toast, openModal, closeModal, UI } from '../ui.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { npcLook, portrait } from '../art.js';
import { LOT } from '../city.js';
import { pick, rand, dist, clamp, chance } from '../util.js';

const SIGHT = { first: 45, every: [150, 210], cut: 20, min: 100, ttl: 75, speed: 640, lazy: 260, catchRep: 12, lostRep: 6 };
const STRAY_FAKE = 0.6;       // share of the city's Polaroids that are fakes, once the frame-up starts
const POL_RECT = [14, 14, 232, 232]; // the photo inside a Polaroid (blackout.js polaroid())

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** A lieutenant's stand-in look until the user's henchmen land (the Impostor dresses as her). */
export function lookOf(l) {
  if (l.id === 'impostor') return { skin: '#f0c8a8', hair: '#c8962a', hairStyle: 'long', top: '#2f5ed0', skirt: '#c81e2a', boots: '#c81e2a' };
  const female = l.id === 'queen' || l.id === 'roxy' || l.id === 'mesmer';
  const base = npcLook(female ? 'civilian' : 'boss', () => 0.37);
  return female ? { ...base, top: l.color, skirt: '#1a1420', bottom: null, hairStyle: 'long', hair: l.id === 'roxy' ? '#e02040' : l.id === 'mesmer' ? '#2a1a30' : '#f0d070' }
    : { ...base, top: l.color, size: 1, shades: l.id === 'fixer', tie: '#1a1420' };
}

function freshAct() {
  const pm = {};
  for (const [k, M] of Object.entries(MASQ)) pm[k] = pick(M.values);
  return {
    id: ACT1.id, counts: { clubs: 0, warehouses: 0, asylum: 0, factory: 0, entertainment: 0 },
    unmasked: {}, fakes: 0, unsorted: 0, beats: {}, lairOpen: false, done: false, pm, seals: {}, posterBest: 0, caught: 0,
  };
}

export class Act {
  constructor(g) {
    this.g = g;
    this.queue = [];
    this.sightT = SIGHT.first;
    this.busy = false;
  }

  /** This game's act state (made on first use, so old saves pick the story up where they are). */
  get A() {
    const st = this.g.state;
    if (!st) return null;
    if (!st.act) st.act = freshAct();
    if (!this.debugDone) { this.debugDone = true; this.applyDebug(st); }
    return st.act;
  }

  /** ?act=lair: every gate met (the 13th floor opens). ?act=boss: and every seal set. */
  applyDebug(st) {
    const m = /[?&]act=(\w+)/.exec(location.search);
    if (!m) return;
    const A = st.act;
    if (m[1] === 'lair' || m[1] === 'boss') {
      Object.assign(A.counts, { clubs: GATES.clubs, warehouses: GATES.warehouses, asylum: GATES.asylum, factory: GATES.factory, entertainment: GATES.entertainment });
      for (const l of LIEUTENANTS) A.unmasked[l.id] = true;
      A.fakes = Math.max(A.fakes, GATES.fakes);
      for (const b of BEATS) A.beats[b.id] = true;
      st.rep = Math.max(st.rep, GATES.rep);
      if (m[1] === 'boss') for (let i = 0; i < 5; i++) A.seals[i] = true;
    }
    if (m[1] === 'local' || m[1] === 'guardian') {
      st.rep = Math.max(st.rep, m[1] === 'local' ? 60 : 150);
    }
  }

  // ------------------------------------------------------------------ the gates
  gates() {
    const A = this.A, st = this.g.state, c = A.counts, n = Object.keys(A.unmasked).length;
    return [
      { id: 'rep', label: `Reputation ${GATES.rep}+ (Metro Icon)`, have: st.rep, need: GATES.rep },
      { id: 'clubs', label: 'Nightclub missions', have: c.clubs, need: GATES.clubs },
      { id: 'warehouses', label: 'Warehouse raids', have: c.warehouses, need: GATES.warehouses },
      { id: 'asylum', label: 'Ravenmoor Asylum', have: c.asylum, need: GATES.asylum },
      { id: 'factory', label: 'Factory district', have: c.factory, need: GATES.factory },
      { id: 'entertainment', label: 'Entertainment district', have: c.entertainment, need: GATES.entertainment },
      { id: 'lieutenants', label: 'Lieutenants unmasked', have: n, need: GATES.lieutenants },
      { id: 'fakes', label: 'Fake Polaroids exposed', have: A.fakes, need: GATES.fakes },
    ];
  }

  gatesMet() { return this.gates().every((r) => r.have >= r.need); }
  keys() { return Object.keys(this.A?.unmasked || {}).length; }

  /** A mission won (from main.js endZone): count it toward the gates; a club case unmasks. */
  async onZoneWin(zone) {
    const A = this.A;
    if (!A || A.done) return;
    const c = A.counts, V = VENUES[zone.venue];
    if (zone.clubCase || V?.club || V?.kind === 'club') c.clubs++;
    if (zone.venue === 'Warehouse') c.warehouses++;
    if (zone.mode === 'asylum') c.asylum++;
    if (zone.district === 'factory' || zone.def?.setting === 'factory') c.factory++;
    if (zone.district === 'entertainment') c.entertainment++;
    this.g.state.save();
    if (zone.clubCase) await this.onCaseSolved(zone.clubCase);
  }

  /** A club case solved (in the club, right after the confession): its lieutenant is unmasked. */
  async onCaseSolved(caseId) {
    const A = this.A;
    if (!A || A.done) return;
    const l = LIEUTENANTS.find((q) => q.cases.includes(caseId));
    if (l && !A.unmasked[l.id]) await this.unmask(l);
  }

  // ------------------------------------------------------------------ unmasking
  async unmask(l) {
    const A = this.A;
    A.unmasked[l.id] = true;
    this.g.state.save();
    sfx.win();
    const n = Object.keys(A.unmasked).length;
    const fact = MASQ[l.fact].say(A.pm[l.fact]);
    await new Promise((resolve) => {
      const el = openModal(`<div class="um">
          <div class="um-burst"></div>
          <div class="um-pic"></div>
          <div class="um-stamp">UNMASKED</div>
          <div class="um-txt"><b>${esc(l.name)}</b><small>${esc(cap(l.alias))} · ${esc(l.runs)}</small>
            <p class="um-line">${l.line}</p>
            <p class="um-fact"><i>About the Puzzle Maker:</i> ${fact}</p>
            <div class="um-key">🗝 SEAL KEY · ${n}/${LIEUTENANTS.length} lieutenants unmasked</div></div>
          <button class="um-go">ONTO THE BOARD</button>
        </div>`, 'unmask');
      el.querySelector('.um-pic').appendChild(portrait(lookOf(l)));
      const close = () => { removeEventListener('keydown', key, true); closeModal(el); resolve(); };
      const key = (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
      addEventListener('keydown', key, true);
      el.querySelector('.um-go').addEventListener('click', close);
    });
  }

  // ------------------------------------------------------------------ per frame (from the overworld)
  update(dt, ow) {
    const A = this.A, st = this.g.state;
    if (!A || ow.attract) return;
    if (!A.done) {
      for (const b of BEATS) if (!A.beats[b.id] && !this.queue.some((q) => q.beat === b) && st.rep >= b.rep) this.queue.push({ beat: b });
      if (!A.lairOpen && A.beats.guardian && this.gatesMet()) { A.lairOpen = true; st.save(); this.queue.push({ lair: true }); }
      if (A.lairOpen) this.ensureHotel(ow);
      if (A.beats.guardian) this.stepSightings(dt, ow);
    }
    // story moments wait for a calm moment in the sky
    if (this.queue.length && !this.busy && !UI.open && this.g.modeName === 'overworld' && !ow.diving && ow.rising === null) {
      const ev = this.queue.shift();
      this.busy = true;
      this.play(ev, ow).catch((e) => console.error(e)).finally(() => { this.busy = false; });
    }
  }

  async play(ev, ow) {
    const A = this.A, st = this.g.state;
    if (ev.beat) {
      const b = ev.beat;
      A.beats[b.id] = true; st.save();
      if (b.caption) comic.caption(b.caption, { ms: 6500 });
      if (b.headline) setTimeout(() => comic.headline(b.headline, { tone: 'bad', kicker: b.kicker }), 2500);
      if (b.paper) {
        const pic = await makePolaroid('who is she?');
        await showNewspaper({ ...b.paper, rep: 0, photo: impostorize(pic, 1, POL_RECT) || pic });
      }
      if (b.riddle) await this.riddleBeat();
      if (b.after) await dialog({ title: b.id === 'guardian' ? 'The act board' : 'The frame-up', text: b.after });
      return;
    }
    if (ev.lair) {
      sfx.alarm();
      await showNewspaper({
        headline: 'EVERY TRAIL LEADS TO ONE HOTEL', rep: 0, photo: 'special',
        sub: `Varga, Strand, Crane, Volk: four buyers, one address. The ${ACT1.hotel}, Villains' Lair`,
        body: [`Every shell company behind the city's drug ring and the campaign against ${HERO} is registered to the same building: a hotel in the Villains' Lair district.`, 'Witnesses say its 13th floor lit up last night for the first time in years.'],
      });
      await dialog({ title: 'The 13th floor is open', text: `The ${ACT1.hotel}'s 13th floor is lit, and it's waiting for you. <b>Fly to the hotel tower in the Villains' Lair and dive in.</b><span class="hint">Five seals lock the Grand Ballroom: you hold ${this.keys()} Seal Keys. Dr Kell is on that floor, with a kryptonite stun ray.</span>` });
    }
  }

  /** ~225 rep: his first message, a jigsaw on a downtown billboard, a riddle naming a lieutenant. */
  async riddleBeat() {
    const A = this.A;
    const next = LIEUTENANTS.find((l) => !A.unmasked[l.id] && l.cases.length) || LIEUTENANTS[0];
    const RIDDLES = {
      fixer: 'I count what I never earn, and I keep what I never take. Ask the man with the gold in his name.',
      queen: 'A thousand workers, one queen, and every one of them sells honey. Find the hive.',
      roxy: 'I make stars and I burn them, one flash at a time. Sit in my chair.',
      curator: 'Everything in my gallery is for sale, especially you. Bid high.',
      mesmer: 'You can\'t get me out of your head. Listen to the radio at three.',
      impostor: 'I wear your face better than you do. Catch me if you can.',
    };
    const img = jigsawCard(RIDDLES[next.id] || RIDDLES.fixer);
    await playScreenScene({ screens: BILLBOARDS.downtown, image: img, untilTap: true, caption: 'Every billboard downtown, at once. Signed with a question mark.' });
  }

  // ------------------------------------------------------------------ Polaroids in the city
  /** After Local Hero, Polaroids turn up whatever her reputation (the frame-up): most are fakes. */
  straysOn() { const A = this.A; return !!(A && A.beats.local && !A.done); }
  strayFake() { return chance(STRAY_FAKE); }

  /** She dove on a Polaroid: the call. Returns once it's settled. */
  async callPolaroid(z) {
    const A = this.A, st = this.g.state;
    const pic = await makePolaroid();
    const fakePic = z.fake ? impostorize(pic, fakeStrength(A.fakes), POL_RECT) : null;
    const fake = !!fakePic;
    const r = await spotCall({ img: fakePic || pic, fake, sub: `It was ${z.where}.`, tell: fakePic?.tell, score: `Fakes exposed ${A.fakes}/${GATES.fakes}` });
    if (fake && r.right) {
      A.fakes++;
      st.addRep(4, 'Proved a Polaroid was a fake');
      toast(`🧩 Jigsaw piece ${Math.min(A.fakes, GATES.fakes)}/${GATES.fakes} on the act board`, 'good');
    } else if (fake) {
      A.unsorted = (A.unsorted || 0) + 1;
      toast('It\'s pinned to your act board: look at it again later', 'info');
    } else if (r.right) st.addRep(2, 'Got a polaroid back');
    st.save();
  }

  /** From the act board: another look at a fake she called real. */
  async lookAgain() {
    const A = this.A;
    if (!A.unsorted) return;
    const pic = await makePolaroid();
    const fakePic = impostorize(pic, fakeStrength(A.fakes), POL_RECT);
    if (!fakePic) { toast('Too blurry to tell. Try again.', 'info'); return; }
    const r = await spotCall({ img: fakePic, fake: true, sub: 'Pinned to your board. Look closely this time.', tell: fakePic.tell });
    if (r.right) { A.unsorted--; A.fakes++; this.g.state.addRep(4, 'Proved a Polaroid was a fake'); }
    this.g.state.save();
  }

  // ------------------------------------------------------------------ impostor sightings
  stepSightings(dt, ow) {
    const z = ow.zones.find((q) => q.impostor);
    if (z) return this.moveImpostor(z, dt, ow);
    this.sightT -= dt;
    if (this.sightT > 0) return;
    const n = this.keys();
    // the Puzzle Maker hits back harder the closer she gets
    this.sightT = Math.max(SIGHT.min, rand(...SIGHT.every) - n * SIGHT.cut);
    const h = ow.hero, blocks = this.g.city.blocks.filter((b) => {
      if (b.river) return false;
      const d = dist(b.x0 + LOT / 2, b.y0 + LOT / 2, h.x, h.y);
      return d > 900 && d < 1800 && ow.zones.every((q) => dist(q.x, q.y, b.x0 + LOT / 2, b.y0 + LOT / 2) > 400);
    });
    if (!blocks.length) return;
    const b = pick(blocks);
    ow.zones.push({
      uid: ow.uid++, kind: 'impostor', impostor: true, district: b.d, t: 0, x: b.x0 + LOT / 2, y: b.y0 + LOT / 2, ttl: SIGHT.ttl,
      name: '"Supergirl" spotted!', color: '#3fa0ff', glyph: '?', risk: 'Impostor', reward: SIGHT.catchRep, lockKey: 'Impostor',
      blurb: 'Someone in your costume is posing for the photographers. Catch her before the pictures run: get close and DIVE.',
      heading: rand(0, Math.PI * 2),
    });
    sfx.alarm();
    toast(`📸 "Supergirl" spotted in ${DISTRICTS[b.d]?.name || 'the city'}! That's not you. Catch her!`, 'bad');
    comic.headline(`SUPERGIRL SPOTTED IN ${(DISTRICTS[b.d]?.name || 'THE CITY').toUpperCase()}`, { tone: 'bad', kicker: 'LIVE' });
  }

  /** She runs: faster than cruising, slower than a boost, away from Supergirl, inside the city. */
  moveImpostor(z, dt, ow) {
    const h = ow.hero, city = this.g.city, d = dist(z.x, z.y, h.x, h.y);
    const flee = Math.atan2(z.y - h.y, z.x - h.x);
    let da = (d < 1400 ? flee : z.heading + Math.sin(z.t * 0.7) * 0.8) - z.heading;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    z.heading += clamp(da, -1.8 * dt, 1.8 * dt);
    const v = d < 1400 ? SIGHT.speed : SIGHT.lazy;
    z.x += Math.cos(z.heading) * v * dt; z.y += Math.sin(z.heading) * v * dt;
    const m = 120;
    if (z.x < m || z.x > city.coastX - m) { z.heading = Math.PI - z.heading; z.x = clamp(z.x, m, city.coastX - m); }
    if (z.y < m || z.y > city.H - m) { z.heading = -z.heading; z.y = clamp(z.y, m, city.H - m); }
    z.district = city.districtAt(z.x, z.y);
    if (z.district === 'water') z.district = 'docks';
  }

  /** DIVE close enough: caught. */
  async catchImpostor(ow, z) {
    const A = this.A, st = this.g.state;
    ow.removeZone(z);
    A.caught = (A.caught || 0) + 1;
    sfx.hit();
    comic.headline('IMPOSTOR UNMASKED!', { tone: 'good', kicker: 'CAUGHT!' });
    const imp = LIEUTENANTS.find((l) => l.id === 'impostor');
    if (!A.unmasked.impostor) {
      await dialog({ title: 'Caught her!', text: `You swoop down on a rooftop photo shoot. The "Supergirl" posing for the lenses is a stranger in a cheap tube-top costume and a blonde wig. The wig comes off in your hand.` });
      await this.unmask(imp);
    } else await dialog({ title: 'Another one', text: 'Another wig, another tube top, another stranger paid to be you. He has more than one of them.' });
    st.addRep(SIGHT.catchRep, 'Caught the impostor');
    st.save();
  }

  sightingLost(z) {
    this.g.state.addRep(-SIGHT.lostRep, 'The impostor\'s photos ran');
    comic.headline(`"SUPERGIRL" PARTIES IN ${(DISTRICTS[z.district]?.name || 'THE CITY').toUpperCase()}`, { tone: 'bad', kicker: 'SCANDAL!' });
  }

  // ------------------------------------------------------------------ the hotel
  /** Where the hotel tower stands: the Villains' Lair landmark (landmarks3d.js). */
  hotelSpot() {
    const city = this.g.city;
    if (city.hotelSpot !== undefined) return city.hotelSpot;
    const blk = city.blocks.find((b) => b.hotel);
    const o = blk && blk.b.find((q) => q.kind === 'box' && q.landmark) || blk && blk.b.find((q) => q.kind === 'box');
    city.hotelSpot = o ? { x: o.x + o.w / 2, y: o.y + o.d + 18, district: blk.d } : null;
    return city.hotelSpot;
  }

  ensureHotel(ow) {
    if (ow.zones.some((z) => z.hotel)) return;
    const at = this.hotelSpot();
    if (!at) return;
    ow.zones.push({
      uid: ow.uid++, kind: 'special', mode: 'hotel', hotel: true, venue: ACT1.hotel, district: at.district, t: 0, x: at.x, y: at.y, ttl: Infinity,
      name: `${ACT1.hotel}: Floor ${ACT1.floor}`, reward: 150, lockKey: 'The hotel', color: '#39ff6a', glyph: '13', risk: 'Act boss',
      blurb: `The Puzzle Maker's floor. Five seals, Dr Kell's stun ray, and the Grand Ballroom.`, theme: null,
    });
  }

  /** The act's end (hotel.js, after the boss). */
  async complete() {
    const A = this.A, st = this.g.state;
    A.done = true; A.lairOpen = false;
    st.addRep(100, 'The Puzzle Maker is behind bars');
    st.save();
    await showNewspaper({
      headline: 'PUZZLE SOLVED!', rep: 100, photo: 'hero',
      sub: `${HERO} brings down the Puzzle Maker and Dr Amos Kell in a raid on the ${ACT1.hotel}`,
      body: [`The man behind the city's drug ring, and behind months of doctored photos of its heroine, was led out of the hotel's 13th floor in cuffs at dawn. Dr Amos Kell, the chemist behind ${ACT1.drug}, followed in a kryptonite-proof van.`,
        `Police found a gallery of fake Polaroids, a wardrobe of knockoff costumes and a ballroom full of masks. "Every one of those pictures was a lie," said the Commissioner. "Well. Most of them."`],
    });
    await dialog({ title: 'ACT 1 COMPLETE', text: `<b>The Puzzle Maker</b> and <b>Dr Kell</b> are locked up. The impostors are out of work, and the city believes in its hero again.<span class="hint">But ${ACT1.drug} is still out there… More acts to come. Your patrol goes on.</span>` });
  }

  // ------------------------------------------------------------------ the act board
  openBoard() {
    const A = this.A;
    if (!A) return Promise.resolve();
    const n = Object.keys(A.unmasked).length;
    const cards = LIEUTENANTS.map((l, i) => {
      const on = A.unmasked[l.id];
      return `<div class="ab-lt${on ? ' on' : ''}" data-i="${i}" style="--r:${[-2, 1.5, -1, 2, -1.5, 1][i]}deg">
        <i class="cb-pin"></i><div class="ab-ph"></div>
        <b>${on ? esc(l.name) : '???'}</b><small>${on ? esc(cap(l.alias)) : esc(l.runs)}</small>
        ${on ? `<p>${MASQ[l.fact].say(A.pm[l.fact])}</p><span class="ab-stamp">UNMASKED</span>` : `<p class="dim">${l.cases.length ? 'Solve their club case.' : 'Catch her in the act: a "Supergirl" sighting on the map.'}</p>`}
      </div>`;
    }).join('');
    const rows = this.gates().map((r) => `<div class="ab-gate${r.have >= r.need ? ' ok' : ''}"><span>${r.have >= r.need ? '✓' : '•'} ${esc(r.label)}</span><b>${Math.min(r.have, r.need)}/${r.need}</b></div>`).join('');
    const status = A.done ? 'Case closed. The Puzzle Maker and Dr Kell are behind bars.'
      : A.lairOpen ? `The ${ACT1.hotel}'s 13th floor is open. Fly to the hotel tower in the Villains' Lair.`
        : `Meet every goal to find his floor. Seal Keys: ${n}.`;
    const el = openModal(`<div class="cb ab">
        <div class="cb-head"><b>ACT BOARD</b><span>${esc(ACT1.title)}</span></div>
        <div class="ab-grid">
          <div class="ab-lts">${cards}</div>
          <div class="ab-side">
            <div class="ab-boss"><i class="cb-pin"></i><div class="ab-q">${A.done ? '✓' : '?'}</div><b>THE PUZZLE MAKER</b><small>${A.done ? 'Behind bars' : 'Face unknown'}</small></div>
            <div class="ab-jig"><canvas width="300" height="150"></canvas><small>Jigsaw: ${Math.min(A.fakes, GATES.fakes)}/${GATES.fakes} fakes exposed</small></div>
            <div class="ab-gates">${rows}</div>
          </div>
        </div>
        <div class="cb-foot"><span>${status}</span>${A.unsorted ? `<button class="cb-close ab-again">Look again (${A.unsorted})</button>` : ''}<button class="cb-close ab-x">Close</button></div>
      </div>`, 'caseboard actboard');
    el.querySelectorAll('.ab-lt').forEach((c) => c.querySelector('.ab-ph').appendChild(portrait(lookOf(LIEUTENANTS[+c.dataset.i]))));
    drawJigsaw(el.querySelector('.ab-jig canvas'), Math.min(A.fakes, GATES.fakes), GATES.fakes, A.lairOpen || A.done);
    return new Promise((resolve) => {
      const close = (v) => { removeEventListener('keydown', key, true); closeModal(el); sfx.click(); resolve(v); };
      const key = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } };
      addEventListener('keydown', key, true);
      el.querySelector('.ab-x').addEventListener('click', () => close());
      el.querySelector('.ab-again')?.addEventListener('click', async () => { close(); await this.lookAgain(); this.openBoard(); });
    });
  }
}

/** The riddle on the billboards: a jigsaw-cut card with his question mark. */
function jigsawCard(text) {
  const c = document.createElement('canvas'); c.width = 960; c.height = 540;
  const g = c.getContext('2d');
  g.fillStyle = '#0e2a14'; g.fillRect(0, 0, 960, 540);
  g.strokeStyle = 'rgba(57,255,106,.35)'; g.lineWidth = 4;
  for (let y = 0; y < 540; y += 135) for (let x = 0; x < 960; x += 160) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60, y); g.arc(x + 80, y, 20, Math.PI, 0, (x / 160 + y / 135) % 2 > 0); g.lineTo(x + 160, y); g.lineTo(x + 160, y + 135); g.stroke();
  }
  g.fillStyle = '#39ff6a'; g.font = '900 220px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#39ff6a'; g.shadowBlur = 30; g.fillText('?', 480, 170); g.shadowBlur = 0;
  g.fillStyle = '#eafff0'; g.font = '700 40px Georgia, serif';
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) { if (g.measureText(line + ' ' + w).width > 820) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; }
  lines.push(line);
  lines.forEach((l, i) => g.fillText(l, 480, 330 + i * 52));
  return c;
}

/** The act board's jigsaw: the hotel at night, one piece per fake exposed. */
function drawJigsaw(c, have, need, lit) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0a0614'); sky.addColorStop(1, '#2a1030');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#141a16';
  g.beginPath(); g.moveTo(W / 2 - 40, H); g.lineTo(W / 2 - 40, H - 22); g.lineTo(W / 2, 8); g.lineTo(W / 2 + 40, H - 22); g.lineTo(W / 2 + 40, H); g.fill();
  for (let y = 30; y < H - 26; y += 9) for (let k = -1; k <= 1; k += 2) { g.fillStyle = Math.sin(y * 7 + k) > 0.2 ? '#ffd890' : '#2a3a2e'; g.fillRect(W / 2 + k * (4 + (y - 8) * 0.3) - 2, y, 3, 3); }
  if (lit) { g.fillStyle = '#39ff6a'; g.fillRect(W / 2 - 18, 62, 36, 6); }
  g.fillStyle = '#ff2a7a'; g.font = '900 13px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('HOTEL', W / 2, H - 8);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${pick(['57,255,106', '200,80,255', '255,40,90'])},.7)`; g.fillRect(rand(0, W), rand(H * 0.55, H), rand(8, 30), 3); }
  // cover the pieces not found yet
  const cols = 5, rows = Math.ceil(need / cols), pw = W / cols, ph = H / rows;
  for (let i = have; i < need; i++) {
    const x = (i % cols) * pw, y = Math.floor(i / cols) * ph;
    g.fillStyle = '#6a5a48'; g.fillRect(x, y, pw, ph);
    g.strokeStyle = '#3a2e22'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
    g.fillStyle = '#7a6a56'; g.beginPath(); g.arc(x + pw / 2, y + ph / 2, 10, 0, Math.PI * 2); g.fill();
  }
}
