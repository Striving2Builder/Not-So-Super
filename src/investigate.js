// Investigation zones: a hotspot crime scene. Search props, use X-ray vision on sealed things,
// question a witness, photograph evidence for the paper, then accuse the suspect who matches the clues.
// The scene is painted as an inked comic panel (crimescene.js): perspective room, practical light,
// inked props with drop shadows, halftone grading. X-RAY is detective vision; clue finds punch in.
import { ATTRS, FIRST_NAMES, LAST_NAMES, JOBS, WITNESS_MOODS, INTOX_ITEMS, HERO, DISTRICTS } from './data.js';
import { drawHumanoid, pose, npcLook, portrait } from './art.js';
import { pick, shuffle, chance, fitScene, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { sfx } from './sfx.js';
import { CaseFile } from './casefile.js';
import { comic } from './comic.js';
import { quality } from './settings.js';
import { LW, LH, FLOOR, paintRoom, paintFixture, paintLight, paintDust, makeDust, makeGrade, scanPattern, paintXrayStructure, paintSkeleton } from './crimescene.js';
import { drawClueGlyph } from './evidenceart.js';

const SETTINGS = {
  office: { wall: '#4f5d70', floor: '#3d3326', window: [560, 60, 240, 150], props: [
    ['desk', 'Executive Desk', 330, 330, 280, 120, 'Paperwork, a stapler and three coffee rings.'],
    ['computer', 'Computer', 420, 262, 96, 70, 'Password-locked. The screensaver scrolls "SELL SELL SELL".'],
    ['cabinet', 'Filing Cabinet', 70, 240, 110, 220, 'Alphabetized folders. Mostly tax forms.'],
    ['shelf', 'Bookshelf', 830, 160, 150, 300, 'Business books nobody has opened.'],
    ['painting', 'Oil Painting', 220, 90, 150, 110, 'A stern portrait of the company founder.'],
    ['coat', 'Coat Rack', 700, 240, 60, 230, 'An umbrella and a lonely scarf.'],
    ['bin', 'Wastebasket', 640, 410, 50, 60, 'Crumpled memos about the coffee machine.'],
    ['plant', 'Potted Plant', 200, 380, 60, 100, 'A ficus. Surprisingly healthy.'],
  ] },
  apartment: { wall: '#7a5f55', floor: '#5a4030', window: [560, 60, 200, 150], props: [
    ['sofa', 'Sofa', 360, 350, 270, 120, 'Lumpy cushions. Someone left in a hurry.'],
    ['tv', 'Television', 90, 290, 160, 120, 'The news is on mute.'],
    ['fridge', 'Fridge', 830, 190, 110, 280, 'Expired milk and a sad lemon.'],
    ['painting', 'Framed Photo', 380, 100, 150, 100, 'A family at the beach, all smiles.'],
    ['coat', 'Coat Hooks', 720, 240, 60, 230, 'A rain jacket, still damp.'],
    ['bin', 'Trash Can', 290, 420, 50, 60, 'Takeout boxes. Lots of them.'],
    ['lamp', 'Floor Lamp', 660, 290, 40, 180, 'The bulb flickers.'],
    ['shelf', 'Wall Shelf', 130, 110, 160, 110, 'Knick-knacks and a snow globe.'],
  ] },
  alley: { wall: '#5a3a33', floor: '#2e2e33', brick: true, props: [
    ['dumpster', 'Dumpster', 90, 330, 230, 140, 'It smells exactly how you would expect.'],
    ['crate', 'Wooden Crate', 420, 380, 110, 90, 'Stamped "PRODUCE". It rattles like glass.'],
    ['barrel', 'Oil Drum', 570, 370, 70, 110, 'Half-full of rainwater.'],
    ['painting', 'Torn Poster', 330, 130, 120, 160, 'A peeling club flyer: "LADIES NIGHT — FREE DRINKS".'],
    ['pipe', 'Drainpipe', 900, 40, 34, 440, 'Rusty, loose at the joint.'],
    ['door', 'Back Door', 690, 180, 120, 250, 'Steel. Locked from the inside.'],
    ['bin', 'Trash Can', 850, 410, 60, 70, 'Broken bottles and cigarette butts.'],
  ] },
  barn: { wall: '#7a3b2a', floor: '#8a7443', planks: true, props: [
    ['hay', 'Hay Bales', 60, 350, 220, 130, 'Stacked neat and tight.'],
    ['tractor', 'Tractor', 560, 300, 260, 180, 'The engine is still warm.'],
    ['trough', 'Feed Trough', 310, 430, 190, 50, 'The feed smells chemical.'],
    ['crate', 'Seed Crate', 330, 340, 100, 80, 'Seed packets, some torn open.'],
    ['barrel', 'Chemical Drum', 860, 370, 70, 110, 'A skull-and-crossbones label, half scraped off.'],
    ['shelf', 'Tool Shelf', 820, 110, 150, 170, 'Pitchforks, rope, a rusty sickle.'],
    ['door', 'Hayloft Door', 380, 90, 170, 200, 'The latch has been forced.'],
  ] },
  casino: { wall: '#3a1a24', floor: '#5a1830', carpet: true, props: [
    ['pokertable', 'Roulette Table', 300, 380, 300, 100, 'The wheel lands on 17. Again. And again.'],
    ['slot', 'Slot Machine', 50, 220, 100, 240, 'JACKPOT lights, no jackpots.'],
    ['slot', 'Slot Machine', 160, 220, 100, 240, 'It eats your quarter and blinks smugly.'],
    ['bar', 'Cocktail Bar', 690, 320, 290, 140, 'Bottles glitter under the lights.'],
    ['painting', 'Gilded Mirror', 420, 90, 160, 110, 'Two-way glass? Could be.'],
    ['tv', 'Security Monitor', 820, 90, 130, 90, 'Camera 4 shows static.'],
    ['cabinet', 'Cashier Cage', 580, 170, 100, 160, 'Chips stacked in neat towers.'],
  ] },
  factory: { wall: '#4a4d52', floor: '#35373b', props: [
    ['machine', 'Press Machine', 60, 230, 270, 240, 'Hydraulic press. Someone jammed a wrench in it.'],
    ['crate', 'Parts Crate', 420, 380, 100, 90, 'Bolts and brackets.'],
    ['barrel', 'Oil Drum', 540, 370, 70, 110, 'Leaking a rainbow puddle.'],
    ['cabinet', 'Staff Lockers', 860, 190, 110, 280, 'Names taped on each door.'],
    ['painting', 'Shift Board', 400, 110, 170, 110, 'The night shift roster, pinned with darts.'],
    ['shelf', 'Parts Shelf', 650, 180, 150, 270, 'Everything labeled, one gap.'],
    ['bin', 'Scrap Bin', 350, 440, 50, 50, 'Metal shavings.'],
  ] },
};
const CONTAINERS = ['cabinet', 'painting', 'crate', 'barrel', 'dumpster', 'fridge', 'sofa', 'machine', 'hay', 'slot', 'desk', 'tv', 'door', 'tractor'];
const SURFACES = ['desk', 'bar', 'pokertable', 'crate', 'sofa', 'trough', 'hay', 'dumpster'];
const INK = '#120a16';
const ANIM = ['computer', 'tv', 'slot', 'pokertable', 'machine']; // props with moving parts (see drawPropAnim)
const CAPTION = '"Bangers", Impact, "Arial Black", sans-serif';
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export class Investigate {
  constructor(g) { this.g = g; this.dust = makeDust(); this.lay = null; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone;
    this.done = false;
    this.t = 0;
    this.en = 100;
    this.xray = false;
    this.xrayAt = 0;
    this.camera = false;
    this.focus = null;
    this.snapReq = null;
    this.setting = SETTINGS[zone.def.setting];
    this.settingKey = zone.def.setting;
    this.buildCase();
    if (this.lay) this.lay.baseKey = ''; // new case, new room
    if (document.fonts && document.fonts.load) document.fonts.load('20px Bangers').catch(() => {});

    g.input.setStick(false);
    g.input.setButtons([
      { id: 'xray', label: 'X-RAY', key: 'X', cls: 'big' },
      { id: 'camera', label: 'CAMERA', key: 'C' },
      { id: 'notes', label: 'NOTES', key: 'N', slot: 2 },
      { id: 'accuse', label: 'SUSPECTS', key: 'Q', slot: 3 },
      { id: 'leave', label: 'LEAVE', key: '⌫', slot: 4, cls: 'red' },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
    $('hud-title').textContent = `${zone.name} · ${DISTRICTS[zone.district].name}`;
    $('objectives').classList.add('on');
    g.vice = { active: false };
    banner('INVESTIGATION', `Solve ${zone.def.crime}`, '#3fd0ff');
    setTimeout(() => {
      if (!this.done) toast('Tap objects to search. X-ray sees inside sealed things. Photograph clues for the paper.', 'info');
    }, 1500);
  }

  exit() { $('objectives').classList.remove('on'); }

  get photos() { return this.case.photos; }

  buildCase() {
    const S = this.setting;
    this.case = new CaseFile(JOBS[this.zone.def.setting]);
    this.clues = this.case.clues;
    this.props = S.props.map(([type, name, x, y, w, h, desc]) => ({ type, name, x, y, w, h, desc }));
    const pool = shuffle([...this.props]);
    for (const c of this.clues) {
      if (c.method === 'witness') continue;
      const want = c.method === 'xray' ? CONTAINERS : null;
      const host = pool.find((p) => !p.clue && (!want || want.includes(p.type))) || pool.find((p) => !p.clue);
      host.clue = c; c.host = host;
    }
    const mood = pick(WITNESS_MOODS);
    const wl = npcLook('civilian');
    this.witness = { x: 780, y: 520, look: wl, mood, clue: this.clues.find((c) => c.method === 'witness'), talked: false, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` };
    const surf = this.props.filter((p) => SURFACES.includes(p.type));
    const th = surf.length ? pick(surf) : pick(this.props);
    const item = pick(INTOX_ITEMS);
    this.trap = { item, x: th.x + th.w * 0.72 - 18, y: th.y - 34, w: 36, h: 36, taken: false, givesClue: chance(0.5) };
    this.chalk = this.freeFloorSpot();
  }

  /** A patch of floor clear of furniture and the witness, for the chalk outline. */
  freeFloorSpot() {
    const spots = [[480, 548], [250, 552], [640, 540], [150, 560], [900, 565]];
    const clear = ([x, y]) => Math.hypot(x - this.witness.x, y - this.witness.y) > 150 &&
      this.props.every((p) => p.y + p.h < FLOOR + 10 || x + 90 < p.x || x - 90 > p.x + p.w || y - 28 > p.y + p.h + 8);
    const s = spots.find(clear) || spots[0];
    return { x: s[0], y: s[1], rot: (Math.random() - 0.5) * 0.5 };
  }

  // ------------------------------------------------------------------ input
  update(dt) {
    if (this.done) return;
    const g = this.g, inp = g.input;
    this.t += dt;
    if (this.xray) { this.en -= dt * 11; if (this.en <= 0) { this.en = 0; this.setXray(false); toast('X-ray power drained', 'bad'); } }
    else this.en = Math.min(100, this.en + dt * 6);
    if (inp.pressed('xray')) this.setXray(!this.xray);
    if (inp.pressed('camera')) { this.camera = !this.camera; inp.setButton('camera', { toggled: this.camera }); toast(this.camera ? '📷 Camera ready — tap a found clue to photograph it' : 'Camera away', 'info'); if (this.camera) sfx.click(); }
    if (inp.pressed('notes')) this.showNotes();
    if (inp.pressed('accuse')) this.showSuspects();
    if (inp.pressed('leave')) this.leave();
    for (const tap of inp.taps) this.tap(tap.x, tap.y);
    this.updateObjectives();
  }

  setXray(on) {
    if (on && this.en < 10) { toast('Not enough X-ray power', 'bad'); return; }
    if (on && !this.xray) { this.xrayAt = performance.now(); if (this.lay) this.lay.xrOk = false; }
    this.xray = on;
    this.g.input.setButton('xray', { toggled: on });
    $('xray-tint').classList.remove('on'); // detective vision is painted by the scene itself
    if (on) sfx.beam();
  }

  toLogical(x, y) {
    const f = fitScene(this.g.w, this.g.h, LW, LH);
    return { x: (x - f.ox) / f.s, y: (y - f.oy) / f.s };
  }

  /** Scene coords → screen (CSS px). */
  toScreen(x, y) {
    const f = fitScene(this.g.w, this.g.h, LW, LH);
    return { x: f.ox + x * f.s, y: f.oy + y * f.s };
  }

  /** Comic burst centred on a prop (scene coords → screen). */
  burst(word, p, colors) {
    const s = this.toScreen(p.x + p.w / 2, p.y + p.h / 3);
    comic.pow(word, s.x, s.y, { size: 1, colors });
    sfx.pow();
  }

  hit(p, x, y) { return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h; }

  async tap(sx, sy) {
    if (this.busy) return;
    const { x, y } = this.toLogical(sx, sy);
    const w = this.witness;
    const tr = this.trap;
    this.busy = true;
    try {
      if (!tr.taken && this.hit(tr, x, y)) return await this.useTrap();
      if (x > w.x - 40 && x < w.x + 40 && y > w.y - 230 && y < w.y) return await this.talk();
      const props = [...this.props].sort((a, b) => (b.y + b.h) - (a.y + a.h));
      const p = props.find((p) => this.hit(p, x, y));
      if (p) await this.search(p);
    } finally { this.busy = false; }
  }

  /** Punch the view in on a prop while its evidence card is up. */
  async focusOn(p, fn) {
    this.focus = { p, t0: performance.now(), out: 0 };
    try { await fn(); } finally { if (this.focus && this.focus.p === p) this.focus.out = performance.now(); }
  }

  async search(p) {
    const c = p.clue;
    if (this.camera) {
      if (c && c.found && !c.photo) {
        this.case.photograph(c); sfx.shutter(); flash('#fff');
        this.snapReq = { p, n: this.case.num(c) };
        this.burst('SNAP!', p, ['#ffffff', '#1e3cff']);
        toast(`📸 Evidence photo #${this.photos} — the Gazette will love this`, 'good');
      } else if (c && c.photo) toast('Already photographed.', 'info');
      else toast('Nothing newsworthy there… yet.', 'info');
      return;
    }
    if (c && !c.found) {
      if (c.method === 'xray' && !this.xray) {
        await dialog({ title: p.name, text: `${p.desc}<span class="hint">It's sealed tight. Something inside seems heavier than it should be…</span>` });
        return;
      }
      this.case.find(c); sfx.pickup();
      this.pulseAt = performance.now();
      await this.focusOn(p, async () => {
        this.burst(c.method === 'xray' ? 'EUREKA!' : 'AHA!', p);
        await new Promise((r) => setTimeout(r, 520)); // let the burst land before the clue card
        const how = c.method === 'xray' ? `Your X-ray vision reveals something hidden inside the ${p.name.toLowerCase()}.` : `You search the ${p.name.toLowerCase()} and find something.`;
        await this.case.reveal(c, how, 'Tip: switch on the camera and tap here to photograph it.');
      });
      return;
    }
    await dialog({ title: p.name, text: c ? `${p.desc}<span class="hint">You already found the clue here${c.photo ? ' and photographed it' : ''}.</span>` : p.desc });
  }

  async talk() {
    const w = this.witness;
    if (w.talked) {
      await dialog({ speaker: w.name, text: w.told ? `"I told you everything I know. ${ATTRS[w.clue.key].clue[w.clue.value]}"` : '"I\'ve got nothing more to say to you."', portrait: portrait(w.look) });
      return;
    }
    const v = await dialog({
      speaker: `Witness · ${w.name}`, portrait: portrait(w.look),
      text: `"I saw… something. I don't know if I should get involved."<span class="hint">${w.mood.hint}</span>`,
      options: [
        { label: 'Reassure them: "You\'re safe with me."', value: 'reassure' },
        { label: 'Lean in: "Talk. Now."', value: 'intimidate' },
        { label: 'Lay out the facts you already know.', value: 'facts' },
        { label: 'Come back later', value: null },
      ],
    });
    if (!v) return;
    w.talked = true;
    if (v === w.mood.works) {
      w.told = true; sfx.pickup();
      await this.case.reveal(w.clue, `${w.name} leans in: "Okay… okay. The person I saw —"`);
    } else {
      sfx.lose();
      await dialog({ speaker: w.name, text: '"Forget it. I didn\'t see anything." They clam up and turn away.<span class="hint">You\'ll have to find that clue some other way. Maybe the others are enough.</span>' });
      this.g.state.addRep(-2, 'Witness complained');
    }
  }

  async useTrap() {
    const tr = this.trap, it = tr.item, st = this.g.state;
    const v = await dialog({
      title: it.name, text: `${it.desc}${tr.givesClue ? '<span class="hint">There\'s a folded note tucked underneath it.</span>' : ''}`,
      options: [{ label: 'Take it', note: 'Risky: raises intoxication', value: true, cls: 'risky' }, { label: 'Leave it alone', value: false }],
    });
    if (!v) return;
    tr.taken = true;
    sfx.drink();
    st.addIntox(it.intox);
    toast(`🥴 Intoxication +${it.intox}`, 'bad');
    if (it.perk === 'energy') { this.en = 100; toast('Power fully recharged', 'good'); }
    if (tr.givesClue) {
      const c = this.clues.find((c) => !c.found && c.method !== 'witness');
      if (c) await this.case.reveal(c, 'The note tucked under it reads:');
    }
    if (st.intox >= 100) {
      await dialog({ title: 'Everything spins…', text: `${HERO} stumbles out of the scene before she embarrasses herself. The case goes cold.` });
      this.finish(false, true);
    }
  }

  showNotes() { return this.case.notes(this.zone.name, 'No clues yet. Tap objects in the scene to search them.'); }

  async showSuspects() {
    const s = await this.case.accuse(this.zone.name);
    if (s) this.finish(s.culprit, false, s);
  }

  async leave() {
    const v = await dialog({ title: 'Leave the scene?', text: 'The case will go cold and the city will notice.', options: [{ label: 'Stay on the case', value: false }, { label: 'Leave (−3 rep)', value: true, cls: 'bad' }] });
    if (v) this.abort();
  }

  updateObjectives() {
    const found = this.clues.filter((c) => c.found).length;
    const rows = [
      [`Find clues (${found}/${this.clues.length})`, found === this.clues.length],
      [`Photograph evidence (${this.photos})`, false, true],
      [`Accuse the culprit (need 3 clues)`, false, found < 3],
    ];
    const html = rows.map(([t, d, dim]) => `<div class="${d ? 'done' : dim ? '' : 'cur'}">${d ? '✓' : '•'} ${t}</div>`).join('');
    const el = $('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('hud-sub').textContent = this.xray ? 'DETECTIVE VISION' : this.camera ? 'CAMERA — tap a found clue' : 'Tap objects to search';
    this.g.input.setButton('accuse', { lit: found >= 3 });
  }

  hud() { const b = $('b-en'); if (b) b.style.width = this.en + '%'; }

  finish(win, drunk = false, accused = null) {
    if (this.done) return;
    this.done = true;
    this.setXray(false);
    const z = this.zone;
    if (win) {
      sfx.win();
      this.g.state.stats.photos += this.photos;
      this.g.endZone(z, this.case.winResult(z.reward));
    } else if (drunk) {
      this.g.endZone(z, { outcome: 'lose', rep: -6, text: 'The case went cold.' });
    } else {
      sfx.lose();
      this.g.endZone(z, this.case.loseResult(accused));
    }
  }

  abort() { this.done = true; this.setXray(false); this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ render
  /** Offscreen layers (device pixels): props, their ink silhouette, the X-ray edge pass. */
  layers(w, h) {
    const L = this.lay;
    if (L && L.w === w && L.h === h) return L;
    const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    this.lay = { w, h, props: mk(), ink: mk(), base: mk(), baseKey: '', xrOk: false, edge: null, grade: null, gradeKey: '' };
    return this.lay;
  }

  /** Zoom-in amount for the clue-found punch (0..1). */
  zoomK() {
    const F = this.focus;
    if (!F) return 0;
    const now = performance.now();
    const k = ease((now - F.t0) / 380);
    if (!F.out) return k;
    const o = 1 - ease((now - F.out) / 320);
    if (o <= 0) { this.focus = null; return 0; }
    return Math.min(k, o);
  }

  /** The scene transform (fit + drunk sway + focus punch) on any context at device scale. */
  view(c, f, dpr, zk, still = false) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.translate(f.ox, f.oy); c.scale(f.s, f.s);
    if (still) return;
    const st = this.g.state;
    if (st.intox > 30) { const a = Math.sin(this.t * 1.3) * (st.intox - 30) * 0.12; c.translate(a, Math.cos(this.t) * a * 0.3); }
    if (zk > 0) {
      const p = this.focus.p, cx = p.x + p.w / 2, cy = p.y + p.h / 2, z = 1 + 0.3 * zk;
      c.translate(cx + (LW / 2 - cx) * 0.55 * zk, cy + (LH / 2 - cy) * 0.55 * zk); c.scale(z, z); c.translate(-cx, -cy);
    }
  }

  render(ctx) {
    const g = this.g, W = g.w, H = g.h;
    const dpr = ctx.getTransform().a || 1;
    const f = fitScene(W, H, LW, LH);
    const v = { x0: -f.ox / f.s, y0: -f.oy / f.s, x1: (W - f.ox) / f.s, y1: (H - f.oy) / f.s };
    const zk = this.zoomK();
    const L = this.layers(Math.round(W * dpr), Math.round(H * dpr));
    const night = g.state.night, key = this.settingKey, t = this.t;
    const lite = quality().id === 'saver';

    // The painted room and the inked static props are expensive (gradients, a dilation pass over a
    // full-screen layer), so they're baked once per case into a "base" image. Animated things
    // (slot reels, screens, the roulette wheel, the witness, the bait) are inked per frame in small
    // sprite-sized canvases. The punch-in zoom and tipsy sway just transform the baked image.
    const baseKey = `${L.w}x${L.h}|${key}|${night > 0.5}|${this.trap.taken}|${this.witness.talked}`;
    const props = [...this.props].sort((a, b) => (a.y + a.h) - (b.y + b.h));
    const w = this.witness;
    if (L.baseKey !== baseKey) {
      const B = L.base.getContext('2d');
      B.setTransform(1, 0, 0, 1, 0, 0); B.clearRect(0, 0, L.w, L.h);
      this.paintRoomTo(B, f, dpr, 0, v, key, night, t);
      const P = L.props.getContext('2d');
      P.setTransform(1, 0, 0, 1, 0, 0); P.clearRect(0, 0, L.w, L.h);
      this.view(P, f, dpr, 0, true);
      let witnessDrawn = false;
      for (const p of props) {
        if (!witnessDrawn && p.y + p.h > w.y) { this.drawWitness(P); witnessDrawn = true; }
        drawProp(P, p, 0); shadeProp(P, p);
      }
      if (!witnessDrawn) this.drawWitness(P);
      this.drawTrap(P);
      this.inkLayer(L, f, dpr, lite);
      const sh = 9 * f.s * dpr;
      B.globalAlpha = 0.4; B.drawImage(L.ink, sh, sh * 0.7); // comic drop shadow away from the lamp
      B.globalAlpha = 1; B.drawImage(L.ink, 0, 0); B.drawImage(L.props, 0, 0);
      // static light, the witness's bubble, the tape, then the print grade: all baked
      B.save(); this.view(B, f, dpr, 0, true);
      paintLight(B, key, this.setting, night, v, t);
      if (!w.talked) this.bubble(B, w.x + 30, w.y - 250, '…?');
      this.drawTape(B, v);
      B.restore();
      const c = this.toScreen(LW / 2, LH * 0.55);
      B.setTransform(1, 0, 0, 1, 0, 0);
      B.drawImage(makeGrade(L.w, L.h, c.x * dpr, c.y * dpr, Math.hypot(L.w, L.h) * 0.5), 0, 0);
      L.baseKey = baseKey; L.xrOk = false;
    }
    // device-space matrix taking the still view to the current (zoomed/swaying) one
    ctx.save();
    this.view(ctx, f, dpr, 0, true); const M0 = ctx.getTransform();
    this.view(ctx, f, dpr, zk); const M = ctx.getTransform();
    const K = M.multiply(M0.inverse());
    ctx.setTransform(K); ctx.drawImage(L.base, 0, 0);
    ctx.restore();
    // moving parts (reels, screens, the roulette wheel, the bait's glow) are drawn live on top
    ctx.save();
    this.view(ctx, f, dpr, zk);
    for (const p of props) if (ANIM.includes(p.type)) drawPropAnim(ctx, p, t);
    this.drawTrapGlow(ctx);
    ctx.restore();

    // 3) live bits: dust in the light, evidence markers
    ctx.save();
    this.view(ctx, f, dpr, zk);
    paintDust(ctx, t, lite ? this.dust.slice(0, 18) : this.dust);
    this.drawMarkers(ctx);
    ctx.restore();

    if (this.snapReq) this.takeSnapshot(ctx, dpr);
    if (this.xray) this.drawXray(ctx, f, dpr, zk, v, L, props);
    if (this.camera) this.drawViewfinder(ctx, f, dpr, v);
    if (zk > 0) this.drawSpeedLines(ctx, f, dpr, zk, W, H);

    // hover highlight (mouse)
    const ptr = g.input.pointer;
    if (ptr.x >= 0 && !document.body.classList.contains('touch') && !zk) {
      const { x, y } = this.toLogical(ptr.x, ptr.y);
      const hp = [...props].reverse().find((p) => this.hit(p, x, y));
      if (hp) {
        ctx.save(); this.view(ctx, f, dpr, 0);
        ctx.strokeStyle = this.camera ? '#fff' : this.xray ? '#7ff0ff' : '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 30;
        ctx.strokeRect(hp.x - 5, hp.y - 5, hp.w + 10, hp.h + 10); ctx.setLineDash([]);
        this.label(ctx, hp.x + hp.w / 2, hp.y - 18, hp.name.toUpperCase());
        ctx.restore();
      }
    }
  }

  /** Ink the full-screen props layer: its silhouette, dilated, becomes the outline. */
  inkLayer(L, f, dpr, lite) {
    const I = L.ink.getContext('2d');
    I.setTransform(1, 0, 0, 1, 0, 0); I.globalCompositeOperation = 'source-over'; I.clearRect(0, 0, L.w, L.h);
    const r = Math.max(1.5, 2.4 * f.s * dpr), dirs = lite ? 4 : 8;
    for (let i = 0; i < dirs; i++) { const a = (i / dirs) * Math.PI * 2 + 0.3; I.drawImage(L.props, Math.cos(a) * r, Math.sin(a) * r); }
    I.globalCompositeOperation = 'source-in'; I.fillStyle = INK; I.fillRect(0, 0, L.w, L.h);
    I.globalCompositeOperation = 'source-over';
  }

  /** Room, fixture, floor dressing and contact shadows onto a device-pixel canvas. */
  paintRoomTo(c, f, dpr, zk, v, key, night, t) {
    c.save();
    this.view(c, f, dpr, zk);
    paintRoom(c, key, this.setting, night, v, t);
    paintFixture(c, key);
    this.drawFloorDressing(c);
    for (const p of this.props) contactShadow(c, p);
    contactShadow(c, { x: this.witness.x - 30, y: this.witness.y - 10, w: 60, h: 10 });
    c.restore();
  }

  drawWitness(c) {
    const w = this.witness;
    drawHumanoid(c, w.x, w.y, 2.1, -1, w.look, pose('stand', this.t), this.t);
  }

  /** Chalk outline, scattered papers, a trail of prints: the floor tells a story. */
  drawFloorDressing(g) {
    const ch = this.chalk;
    g.save(); g.translate(ch.x, ch.y); g.scale(1, 0.36); g.rotate(ch.rot);
    g.strokeStyle = 'rgba(245,245,240,.85)'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    g.arc(0, -78, 20, 0, Math.PI * 2);
    g.moveTo(-14, -58); g.lineTo(-58, -40); g.lineTo(-84, -70);
    g.moveTo(14, -58); g.lineTo(52, -24); g.lineTo(70, 6);
    g.moveTo(-14, -58); g.lineTo(-22, 10); g.lineTo(-50, 78);
    g.moveTo(14, -58); g.lineTo(22, 10); g.lineTo(40, 80);
    g.moveTo(-22, 10); g.lineTo(0, 2); g.lineTo(22, 10);
    g.stroke();
    g.restore();
    // papers
    for (const [dx, dy, a] of [[-120, 8, 0.3], [-96, 22, -0.5], [110, -6, 0.9]]) {
      g.save(); g.translate(ch.x + dx, ch.y + dy); g.scale(1, 0.4); g.rotate(a);
      g.fillStyle = '#efeadc'; g.fillRect(-16, -20, 32, 40); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(-16, -20, 32, 40);
      g.fillStyle = 'rgba(40,40,60,.35)'; for (let i = 0; i < 4; i++) g.fillRect(-11, -13 + i * 8, 22, 2);
      g.restore();
    }
    // prints leading in from the side
    g.fillStyle = 'rgba(20,10,8,.3)';
    for (let i = 0; i < 6; i++) {
      const x = -40 + i * 52, y = 590 - i * 9 + (i % 2) * 12;
      g.beginPath(); g.ellipse(x, y, 11, 5, 0.2, 0, Math.PI * 2); g.ellipse(x + 15, y + 1, 5, 4, 0, 0, Math.PI * 2); g.fill();
    }
  }

  /** Numbered evidence tents at every clue found (green check once photographed). */
  drawMarkers(g) {
    for (const c of this.clues) {
      if (!c.found || !c.host) continue;
      const p = c.host, n = this.case.num(c);
      const floorY = Math.min(LH - 12, Math.max(p.y + p.h + 16, FLOOR + 30));
      const x = Math.min(LW - 30, Math.max(30, p.x + p.w * 0.5 + (n % 2 ? -1 : 1) * Math.min(40, p.w * 0.3)));
      tent(g, x, floorY, n, c.photo);
    }
  }

  drawTape(g, v) {
    // Police tape strung across the near corners of the frame, in front of everything.
    const strip = (x0, y0, x1, y1, off) => {
      const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
      g.save(); g.translate(x0, y0); g.rotate(a);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(4, 8, len, 26);
      g.fillStyle = '#f5d312'; g.fillRect(0, 0, len, 26);
      g.strokeStyle = INK; g.lineWidth = 2.5; g.strokeRect(0, 0, len, 26);
      g.fillStyle = INK; g.font = `20px ${CAPTION}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      for (let x = -off; x < len; x += 250) g.fillText('POLICE LINE · DO NOT CROSS ·', x, 14);
      g.restore();
    };
    strip(v.x0 - 10, LH - 150, 150, LH + 10, 40);
    strip(v.x1 + 10, LH - 120, LW - 190, LH + 20, 110);
  }

  drawTrapGlow(ctx) {
    const tr = this.trap;
    if (tr.taken) return;
    const a = 0.4 + 0.4 * Math.sin(this.t * 4);
    ctx.strokeStyle = `rgba(255,140,220,${a})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tr.x + 18, tr.y + 20, 26, 0, Math.PI * 2); ctx.stroke();
  }

  drawTrap(ctx) {
    const tr = this.trap;
    if (tr.taken) return;
    const x = tr.x + 18, y = tr.y + 36;
    const n = tr.item.name;
    if (n.includes('Champagne') || n.includes('Cocktail')) {
      ctx.fillStyle = n.includes('Cocktail') ? 'rgba(80,255,180,.9)' : 'rgba(255,230,140,.95)';
      ctx.beginPath(); ctx.moveTo(x - 10, y - 34); ctx.lineTo(x + 10, y - 34); ctx.lineTo(x, y - 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x, y - 2); ctx.moveTo(x - 7, y - 1); ctx.lineTo(x + 7, y - 1); ctx.stroke();
    } else if (n.includes('Perfume')) {
      ctx.fillStyle = '#ff9ad0'; ctx.fillRect(x - 9, y - 22, 18, 22); ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 4, y - 30, 8, 8);
    } else if (n.includes('Candies')) {
      ctx.fillStyle = '#c8e0f0'; ctx.beginPath(); ctx.ellipse(x, y - 6, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#f44', '#4af', '#fd4', '#4d4', '#f8f'][i]; ctx.beginPath(); ctx.arc(x - 10 + i * 5, y - 11, 4, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(x, y - 4, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f4f'; ctx.beginPath(); ctx.arc(x - 6 + i * 4, y - 7, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  /** Detective vision: the room goes dark and cyan, walls turn to studs and wiring, and anything
   *  hidden inside something glows orange. Opens as a ring expanding from the middle. */
  drawXray(ctx, f, dpr, zk, v, L, props) {
    const now = performance.now(), t = this.t;
    const open = ease((now - this.xrayAt) / 460);
    const Wd = L.w, Hd = L.h;
    const c0 = this.toScreen(LW / 2, LH / 2), cx = c0.x * dpr, cy = c0.y * dpr, maxR = Math.hypot(Wd, Hd) * 0.6;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (open < 1) { ctx.beginPath(); ctx.arc(cx, cy, open * maxR, 0, Math.PI * 2); ctx.clip(); }
    ctx.fillStyle = 'rgba(1,6,16,.86)'; ctx.fillRect(0, 0, Wd, Hd);
    if (!L.xrOk) { // the baked props' ink ring minus the props = their outline, recoloured as the scan edge
      if (!L.edge) L.edge = document.createElement('canvas');
      L.edge.width = Wd; L.edge.height = Hd;
      const E = L.edge.getContext('2d');
      E.drawImage(L.ink, 0, 0);
      E.globalCompositeOperation = 'destination-out'; E.drawImage(L.props, 0, 0);
      E.globalCompositeOperation = 'source-in'; E.fillStyle = '#8ff4ff'; E.fillRect(0, 0, Wd, Hd);
      E.globalCompositeOperation = 'source-over';
      L.xrOk = true;
    }
    ctx.save();
    this.view(ctx, f, dpr, 0, true); const M0 = ctx.getTransform();
    this.view(ctx, f, dpr, zk); const K = ctx.getTransform().multiply(M0.inverse());
    ctx.setTransform(K);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.42; ctx.drawImage(L.props, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#1aa8ff'; ctx.fillRect(0, 0, Wd, Hd);
    ctx.globalCompositeOperation = 'source-over';
    // the building's bones
    ctx.save(); this.view(ctx, f, dpr, zk); paintXrayStructure(ctx, this.settingKey, v, t); ctx.restore();
    ctx.save(); ctx.setTransform(K);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(L.edge, 0, 0); ctx.globalAlpha = 0.5; ctx.drawImage(L.edge, 0, 0);
    ctx.restore();

    // scene-space highlights
    ctx.save(); this.view(ctx, f, dpr, zk);
    const w = this.witness;
    paintSkeleton(ctx, w.x, w.y, 2.1, t);
    const sweepX = -150 + ((t * 0.42) % 1) * 1300;
    for (const c of this.clues) {
      if (c.method !== 'xray' || !c.host) continue;
      const p = c.host, x = p.x + p.w / 2, y = p.y + p.h / 2;
      const hitSweep = Math.max(0, 1 - Math.abs(sweepX - x) / 90);
      const col = c.found ? '#6dffb0' : '#ffa630';
      // brackets
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.shadowColor = col; ctx.shadowBlur = 10;
      const m = 8, l = Math.min(26, p.w * 0.25);
      ctx.beginPath();
      for (const [bx, by, dx, dy] of [[p.x - m, p.y - m, 1, 1], [p.x + p.w + m, p.y - m, -1, 1], [p.x - m, p.y + p.h + m, 1, -1], [p.x + p.w + m, p.y + p.h + m, -1, -1]]) {
        ctx.moveTo(bx, by + dy * l); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * l, by);
      }
      ctx.stroke();
      // pulse rings
      for (let k = 0; k < 2; k++) {
        const ph = ((t * 0.9 + k * 0.5) % 1);
        ctx.globalAlpha = (1 - ph) * (c.found ? 0.3 : 0.75); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 18 + ph * 60, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const gs = 46 + hitSweep * 16 + Math.sin(t * 5) * 3;
      ctx.shadowBlur = 16 + hitSweep * 20;
      drawClueGlyph(ctx, c.key, c.value, x, y, gs, 'scan', col);
      ctx.shadowBlur = 0;
      this.label(ctx, x, p.y - 26, c.found ? 'LOGGED' : 'ANOMALY DETECTED', col);
    }
    if (!this.trap.taken) {
      const tr = this.trap;
      ctx.fillStyle = 'rgba(255,70,200,.35)'; ctx.shadowColor = '#ff4ad0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(tr.x + 18, tr.y + 20, 20 + Math.sin(t * 6) * 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      this.label(ctx, tr.x + 18, tr.y - 16, 'CHEMICAL TRACE', '#ff7ad8');
    }
    // the scanning sweep
    const sg = ctx.createLinearGradient(sweepX - 140, 0, sweepX, 0);
    sg.addColorStop(0, 'rgba(60,200,255,0)'); sg.addColorStop(1, 'rgba(60,200,255,.22)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg; ctx.fillRect(sweepX - 140, v.y0, 140, v.y1 - v.y0);
    ctx.fillStyle = 'rgba(180,245,255,.7)'; ctx.fillRect(sweepX - 1.5, v.y0, 3, v.y1 - v.y0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // scanlines, edge falloff, the opening ring
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.scanPat) this.scanPat = scanPattern(ctx);
    ctx.fillStyle = this.scanPat; ctx.fillRect(0, 0, Wd, Hd);
    const vg = ctx.createRadialGradient(cx, cy, Math.min(Wd, Hd) * 0.3, cx, cy, maxR);
    vg.addColorStop(0, 'rgba(0,10,30,0)'); vg.addColorStop(1, 'rgba(0,20,50,.75)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, Wd, Hd);
    ctx.restore();
    if (open < 1) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = `rgba(160,245,255,${1 - open})`; ctx.lineWidth = 6 * dpr; ctx.shadowColor = '#5fe8ff'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(cx, cy, open * maxR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  /** Camera mode: a viewfinder with focus boxes on the evidence worth a front page. */
  drawViewfinder(ctx, f, dpr, v) {
    const t = this.t;
    ctx.save();
    this.view(ctx, f, dpr, 0);
    // letterbox dim + thirds
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 36 - v.y0); ctx.fillRect(v.x0, LH - 36, v.x1 - v.x0, v.y1 - LH + 36);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const k of [1, 2]) { ctx.moveTo(LW * k / 3, 36); ctx.lineTo(LW * k / 3, LH - 36); ctx.moveTo(0, LH * k / 3); ctx.lineTo(LW, LH * k / 3); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4;
    const m = 30, l = 60;
    for (const [x, y, dx, dy] of [[m, m + 20, 1, 1], [LW - m, m + 20, -1, 1], [m, LH - m, 1, -1], [LW - m, LH - m, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(LW / 2, LH / 2, 22, 0, Math.PI * 2); ctx.moveTo(LW / 2 - 34, LH / 2); ctx.lineTo(LW / 2 - 12, LH / 2); ctx.moveTo(LW / 2 + 12, LH / 2); ctx.lineTo(LW / 2 + 34, LH / 2); ctx.stroke();
    ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(LW - 150, LH - 60, 8 + Math.sin(t * 6) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.font = `22px ${CAPTION}`; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('REC', LW - 136, LH - 59);
    ctx.fillText(`ISO 800  1/125  F2.8   ▮▮▮▯   ${this.photos} SHOTS`, 60, LH - 59);
    // focus boxes on evidence found but not yet photographed
    for (const c of this.clues) {
      if (!c.found || !c.host) continue;
      const p = c.host;
      const blink = c.photo ? 1 : 0.55 + 0.45 * Math.sin(t * 8);
      ctx.strokeStyle = c.photo ? 'rgba(80,240,150,.9)' : `rgba(255,255,255,${blink})`; ctx.lineWidth = 3;
      const q = 6, k = 18;
      ctx.beginPath();
      for (const [bx, by, dx, dy] of [[p.x - q, p.y - q, 1, 1], [p.x + p.w + q, p.y - q, -1, 1], [p.x - q, p.y + p.h + q, 1, -1], [p.x + p.w + q, p.y + p.h + q, -1, -1]]) { ctx.moveTo(bx, by + dy * k); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * k, by); }
      ctx.stroke();
      this.label(ctx, p.x + p.w / 2, p.y - 20, c.photo ? '✓ FILED' : 'TAP TO SNAP', c.photo ? '#50f096' : '#fff');
    }
    ctx.restore();
  }

  /** Comic speed lines rushing in toward the clue while the view punches in. */
  drawSpeedLines(ctx, f, dpr, zk, W, H) {
    const p = this.focus.p;
    const cxL = p.x + p.w / 2, cyL = p.y + p.h / 2;
    const tx = cxL + (LW / 2 - cxL) * 0.55 * zk, ty = cyL + (LH / 2 - cyL) * 0.55 * zk;
    const s = this.toScreen(tx, ty);
    ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.hypot(W, H);
    ctx.fillStyle = `rgba(10,4,20,${0.35 * zk})`;
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(s.x, s.y, Math.max(W, H) * 0.32, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.fillStyle = `rgba(255,255,255,${0.75 * zk})`;
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + (i % 3) * 0.02;
      const r0 = Math.max(W, H) * (0.3 + ((i * 37) % 11) / 40), wdt = 0.006 + ((i * 13) % 5) * 0.003;
      ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0);
      ctx.lineTo(s.x + Math.cos(a - wdt) * R, s.y + Math.sin(a - wdt) * R); ctx.lineTo(s.x + Math.cos(a + wdt) * R, s.y + Math.sin(a + wdt) * R); ctx.fill();
    }
    ctx.restore();
  }

  /** Grab the framed prop out of the finished frame and toss it on screen as a polaroid. */
  takeSnapshot(ctx, dpr) {
    const { p, n } = this.snapReq; this.snapReq = null;
    const layer = $('comic-layer'); if (!layer) return;
    const pad = 30, a = this.toScreen(p.x - pad, p.y - pad), b = this.toScreen(p.x + p.w + pad, p.y + p.h + pad);
    let sw = (b.x - a.x) * dpr, shh = (b.y - a.y) * dpr;
    const aspect = 4 / 3;
    if (sw / shh > aspect) { const nh = sw / aspect; a.y -= (nh - shh) / 2 / dpr; shh = nh; } else { const nw = shh * aspect; a.x -= (nw - sw) / 2 / dpr; sw = nw; }
    const c = document.createElement('canvas'); c.width = 240; c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, 240, 180);
    try { g.drawImage(ctx.canvas, a.x * dpr, a.y * dpr, sw, shh, 0, 0, 240, 180); } catch (e) { /* tainted/unsupported: keep the black frame */ }
    g.fillStyle = 'rgba(255,220,160,.12)'; g.fillRect(0, 0, 240, 180); // warm print
    const el = document.createElement('div');
    el.className = 'snap-polaroid';
    el.appendChild(c);
    const cap = document.createElement('span'); cap.textContent = `EVIDENCE #${n}`; el.appendChild(cap);
    const mid = this.toScreen(p.x + p.w / 2, p.y + p.h / 2);
    el.style.left = Math.max(70, Math.min(this.g.w - 70, mid.x)) + 'px';
    el.style.top = Math.max(80, Math.min(this.g.h - 80, mid.y)) + 'px';
    el.style.setProperty('--rot', ((Math.random() - 0.5) * 14).toFixed(1) + 'deg');
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  bubble(ctx, x, y, txt) {
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(x, y, 34, 24, 0, 0, Math.PI * 2);
    ctx.moveTo(x - 14, y + 18); ctx.lineTo(x - 26, y + 42); ctx.lineTo(x - 2, y + 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, 31, 21, 0, 0, Math.PI * 2); ctx.fill(); // hide the tail seam
    ctx.fillStyle = INK; ctx.font = `28px ${CAPTION}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1);
    ctx.restore();
  }

  label(ctx, x, y, txt, col = '#fff') {
    ctx.font = `22px ${CAPTION}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 18;
    ctx.fillStyle = 'rgba(6,10,22,.88)'; ctx.fillRect(x - w / 2, y - 14, w, 28);
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - 14, w, 28);
    ctx.fillStyle = col; ctx.fillText(txt, x, y + 1);
  }
}

/** Contact shadow under a floor-standing prop (drawn on the room, so it isn't inked). */
function contactShadow(g, p) {
  if (p.y + p.h <= FLOOR) return;
  const cx = p.x + p.w / 2, cy = p.y + p.h, rx = p.w * 0.62;
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, rx);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.7, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.save(); g.translate(cx, cy); g.scale(1, 16 / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.restore(); g.fill();
}

/** Evidence tent: yellow A-frame card with the marker number. */
function tent(g, x, y, n, photo) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(4, 2, 24, 6, 0, 0, Math.PI * 2); g.fill();
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
  g.fillStyle = '#c9a20e'; g.beginPath(); g.moveTo(-6, -40); g.lineTo(12, -40); g.lineTo(24, 0); g.lineTo(6, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd21a'; g.beginPath(); g.moveTo(-8, -40); g.lineTo(6, -40); g.lineTo(18, 0); g.lineTo(-20, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK; g.font = `26px ${CAPTION}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), -1, -16);
  if (photo) { g.fillStyle = '#3ee08a'; g.beginPath(); g.arc(16, -40, 9, 0, Math.PI * 2); g.fill(); g.stroke(); g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(11, -40); g.lineTo(15, -36); g.lineTo(21, -44); g.stroke(); }
  g.restore();
}

/** Light from above: warm highlight on top, falloff toward the floor, painted over the prop only. */
function shadeProp(g, p) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, p.y, 0, p.y + p.h);
  gr.addColorStop(0, 'rgba(255,236,200,.16)'); gr.addColorStop(0.35, 'rgba(255,236,200,0)'); gr.addColorStop(1, 'rgba(12,4,24,.42)');
  g.fillStyle = gr; g.fillRect(p.x - 12, p.y - 12, p.w + 24, p.h + 12);
  const sg = g.createLinearGradient(p.x, 0, p.x + p.w, 0); // the side away from the lamp falls into shadow
  const away = p.x + p.w / 2 < LW / 2;
  sg.addColorStop(0, away ? 'rgba(12,4,24,.22)' : 'rgba(12,4,24,0)'); sg.addColorStop(1, away ? 'rgba(12,4,24,0)' : 'rgba(12,4,24,.22)');
  g.fillStyle = sg; g.fillRect(p.x - 12, p.y - 12, p.w + 24, p.h + 12);
  g.restore();
}

// --------------------------------------------------------------------------
// Prop drawings (logical coordinates, x/y = top-left).
// --------------------------------------------------------------------------
function drawProp(ctx, p, t) {
  const { x, y, w, h } = p;
  // Every panel gets a thin ink line so the props read as drawn, not flat-filled.
  const box = (xx, yy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, ww, hh); if (ww > 5 && hh > 5) { ctx.strokeStyle = 'rgba(14,6,18,.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(xx, yy, ww, hh); } };
  switch (p.type) {
    case 'desk':
      box(x, y, w, 18, '#6b4424'); box(x + 10, y + 18, 70, h - 18, '#5a381c'); box(x + w - 80, y + 18, 70, h - 18, '#5a381c');
      box(x + 20, y + 35, 50, 6, '#c9a24a'); box(x + 20, y + 70, 50, 6, '#c9a24a');
      box(x + w * 0.62, y - 8, 50, 8, '#eee'); break;
    case 'computer':
      box(x, y, w, h - 12, '#222'); box(x + 5, y + 5, w - 10, h - 24, `hsl(${(t * 40) % 360},60%,40%)`); box(x + w / 2 - 8, y + h - 12, 16, 12, '#333'); break;
    case 'cabinet':
      box(x, y, w, h, '#7d8590');
      for (let i = 0; i < 4; i++) { box(x + 6, y + 8 + i * (h / 4), w - 12, h / 4 - 12, '#8f98a3'); box(x + w / 2 - 12, y + 20 + i * (h / 4), 24, 5, '#444'); }
      break;
    case 'shelf':
      box(x, y, w, h, '#5a3a22');
      for (let i = 0; i < 4; i++) {
        const sy = y + 10 + i * (h / 4);
        box(x + 6, sy + h / 4 - 14, w - 12, 5, '#3a2414');
        for (let j = 0; j < 7; j++) box(x + 10 + j * ((w - 20) / 7), sy + 8 + (j % 3) * 4, (w - 20) / 7 - 3, h / 4 - 22 - (j % 3) * 4, ['#a33', '#35a', '#3a5', '#aa3', '#737', '#a63'][(i + j) % 6]);
      }
      break;
    case 'painting':
      box(x, y, w, h, '#c9a24a'); box(x + 8, y + 8, w - 16, h - 16, '#2a4a3a');
      ctx.fillStyle = '#e0c090'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2); ctx.fill(); break;
    case 'coat':
      box(x + w / 2 - 4, y, 8, h, '#4a3020'); box(x + w / 2 - 25, y + h - 8, 50, 8, '#4a3020');
      ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 20); ctx.lineTo(x + w / 2 + 26, y + 120); ctx.lineTo(x + w / 2 - 6, y + 120); ctx.fill(); break;
    case 'bin':
      ctx.fillStyle = '#556'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x + 6, y + h); ctx.fill();
      ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(x + w / 2, y + 2, 9, Math.PI, 0); ctx.fill(); break;
    case 'plant':
      box(x + 10, y + h - 36, w - 20, 36, '#8a4a2a');
      ctx.fillStyle = '#3a8a3a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x + w / 2 + Math.cos(i) * 14, y + 30 + Math.sin(i * 2) * 14, 10, 22, i, 0, Math.PI * 2); ctx.fill(); } break;
    case 'sofa':
      box(x, y + 20, w, h - 20, '#6a3a5a'); box(x, y, w, 40, '#7a4a6a'); box(x - 10, y + 20, 26, h - 20, '#5a2a4a'); box(x + w - 16, y + 20, 26, h - 20, '#5a2a4a');
      box(x + 20, y + 45, w / 2 - 25, 30, '#8a5a7a'); box(x + w / 2 + 5, y + 45, w / 2 - 25, 30, '#8a5a7a'); break;
    case 'tv':
      box(x, y, w, h * 0.7, '#111'); box(x + 6, y + 6, w - 12, h * 0.7 - 12, '#3a5a8a');
      ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 6, y + 6 + ((t * 30 + i * 12) % (h * 0.7 - 12)), w - 12, 2);
      box(x + w / 2 - 20, y + h * 0.7, 40, h * 0.3, '#333'); break;
    case 'fridge':
      box(x, y, w, h, '#e8e8e4'); box(x, y + h * 0.35, w, 3, '#bbb'); box(x + w - 16, y + 30, 6, 40, '#999'); box(x + w - 16, y + h * 0.45, 6, 60, '#999'); break;
    case 'lamp':
      box(x + w / 2 - 3, y + 40, 6, h - 40, '#333'); box(x + w / 2 - 18, y + h - 6, 36, 6, '#333');
      ctx.fillStyle = '#f0e0b0'; ctx.beginPath(); ctx.moveTo(x - 6, y + 44); ctx.lineTo(x + w + 6, y + 44); ctx.lineTo(x + w - 6, y); ctx.lineTo(x + 6, y); ctx.fill(); break;
    case 'dumpster':
      box(x, y + 20, w, h - 20, '#2f6a3a'); box(x - 6, y + 10, w + 12, 16, '#26562f');
      ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('WASTE', x + w / 2, y + h / 2 + 18); break;
    case 'crate':
      box(x, y, w, h, '#a8804a'); ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 6; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke(); break;
    case 'barrel':
      box(x, y, w, h, '#3a5a8a'); box(x, y + 12, w, 6, '#2a3a5a'); box(x, y + h - 20, w, 6, '#2a3a5a');
      ctx.fillStyle = '#f2d21a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2); ctx.fill(); break;
    case 'pipe':
      box(x, y, w, h, '#6a6a6a'); for (let i = 0; i < h; i += 90) box(x - 4, y + i, w + 8, 10, '#555'); break;
    case 'door':
      box(x, y, w, h, '#4a4f58'); box(x + 10, y + 10, w - 20, h * 0.4, '#555c66'); box(x + w - 24, y + h / 2, 12, 12, '#c9a24a'); break;
    case 'hay':
      for (let i = 0; i < 3; i++) { box(x + (i % 2) * 20, y + i * (h / 3), w - 20, h / 3 - 4, '#d8b85a'); ctx.fillStyle = '#b8983a'; for (let j = 0; j < 8; j++) ctx.fillRect(x + (i % 2) * 20 + j * (w / 9), y + i * (h / 3), 3, h / 3 - 4); }
      break;
    case 'tractor':
      box(x + 20, y + 40, w - 80, h - 90, '#3a8a3a'); box(x + w - 110, y, 80, 80, '#3a8a3a'); box(x + w - 100, y + 8, 60, 40, '#9cc8e8');
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 60, y + h - 40, 40, 0, Math.PI * 2); ctx.arc(x + w - 60, y + h - 50, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(x + 60, y + h - 40, 16, 0, Math.PI * 2); ctx.arc(x + w - 60, y + h - 50, 20, 0, Math.PI * 2); ctx.fill(); break;
    case 'trough':
      box(x, y, w, h, '#7a5a3a'); box(x + 8, y + 6, w - 16, 14, '#b8a860'); break;
    case 'pokertable':
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 30, w / 2, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a6a3a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 28, w / 2 - 12, 26, 0, 0, Math.PI * 2); ctx.fill();
      box(x + 40, y + 50, 16, h - 50, '#3a2410'); box(x + w - 56, y + 50, 16, h - 50, '#3a2410');
      ctx.save(); ctx.translate(x + w / 2, y + 26); ctx.rotate(t * 2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a22'; for (let i = 0; i < 8; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4); ctx.fill(); } ctx.restore(); break;
    case 'slot':
      box(x, y, w, h, '#8a1a2a'); box(x + 6, y + 6, w - 12, 40, '#ffd84d');
      ctx.fillStyle = '#222'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('JACKPOT', x + w / 2, y + 31);
      box(x + 12, y + 60, w - 24, 50, '#eee');
      ctx.font = '900 22px system-ui'; ctx.fillStyle = '#a22'; ctx.fillText(['7', '$', '♦'][Math.floor(t * 8) % 3] + ' 7 ' + ['♦', '7', '$'][Math.floor(t * 6) % 3], x + w / 2, y + 94);
      box(x + w - 4, y + 60, 10, 60, '#bbb'); break;
    case 'bar':
      box(x, y, w, 20, '#3a1a0a'); box(x, y + 20, w, h - 20, '#5a2a14');
      for (let i = 0; i < 8; i++) box(x + 20 + i * 32, y - 50 - (i % 3) * 10, 12, 50 + (i % 3) * 10, ['#3a8a3a', '#8a3a3a', '#c9a24a', '#3a3a8a'][i % 4]);
      break;
    case 'board':
      box(x, y, w, h, '#b8905a'); for (let i = 0; i < 5; i++) box(x + 10 + (i % 3) * 50, y + 10 + Math.floor(i / 3) * 50, 40, 36, '#f2ead8'); break;
    case 'machine':
      box(x, y + 40, w, h - 40, '#5a6a7a'); box(x + 30, y, w - 60, 60, '#4a5a6a'); box(x + w / 2 - 30, y + 60, 60, h * 0.5, '#8a9aaa');
      box(x + 20, y + h - 60, 40, 20, (Math.sin(t * 5) > 0 ? '#ff4040' : '#401010'));
      box(x + w - 60, y + 80, 30, 30, '#f2d21a'); break;
    default:
      box(x, y, w, h, '#777');
  }
}

/** Just the moving parts of a prop, drawn over its baked image every frame. */
function drawPropAnim(ctx, p, t) {
  const { x, y, w, h } = p;
  const box = (xx, yy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, ww, hh); ctx.strokeStyle = 'rgba(14,6,18,.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(xx, yy, ww, hh); };
  switch (p.type) {
    case 'computer': box(x + 5, y + 5, w - 10, h - 24, `hsl(${(t * 40) % 360},60%,40%)`); break;
    case 'tv':
      box(x + 6, y + 6, w - 12, h * 0.7 - 12, '#3a5a8a');
      ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 6, y + 6 + ((t * 30 + i * 12) % (h * 0.7 - 12)), w - 12, 2);
      break;
    case 'slot':
      box(x + 12, y + 60, w - 24, 50, '#eee');
      ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#a22';
      ctx.fillText(['7', '$', '♦'][Math.floor(t * 8) % 3] + ' 7 ' + ['♦', '7', '$'][Math.floor(t * 6) % 3], x + w / 2, y + 94);
      break;
    case 'pokertable':
      ctx.save(); ctx.translate(x + w / 2, y + 26); ctx.rotate(t * 2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#120a16'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#a22'; for (let i = 0; i < 8; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4); ctx.fill(); } ctx.restore();
      break;
    case 'machine': box(x + 20, y + h - 60, 40, 20, (Math.sin(t * 5) > 0 ? '#ff4040' : '#401010')); break;
  }
}

export { drawProp };
