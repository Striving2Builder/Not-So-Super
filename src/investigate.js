// Investigation zones: a hotspot crime scene. Search props, use X-ray vision on sealed things,
// question a witness, photograph evidence for the paper, then accuse the suspect who matches the clues.
import { ATTRS, FIRST_NAMES, LAST_NAMES, JOBS, WITNESS_MOODS, INTOX_ITEMS, HERO, DISTRICTS } from './data.js';
import { drawHumanoid, pose, npcLook, portrait, drawEmblem } from './art.js';
import { pick, shuffle, chance, fitScene, shade, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { sfx } from './sfx.js';
import { comic } from './comic.js';

const LW = 1000, LH = 600, FLOOR = 380;

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

export class Investigate {
  constructor(g) { this.g = g; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone;
    this.done = false;
    this.t = 0;
    this.en = 100;
    this.xray = false;
    this.camera = false;
    this.photos = 0;
    this.setting = SETTINGS[zone.def.setting];
    this.buildCase();

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

  buildCase() {
    const S = this.setting;
    const keys = shuffle(Object.keys(ATTRS)).slice(0, 4);
    const mk = () => Object.fromEntries(keys.map((k) => [k, pick(ATTRS[k].values)]));
    const diff = (a, b) => keys.filter((k) => a[k] !== b[k]).length;
    const culprit = mk();
    const suspects = [culprit];
    let guard = 0;
    while (suspects.length < 3 && guard++ < 500) {
      const s = mk();
      if (diff(s, culprit) >= 2 && suspects.every((o) => diff(o, s) >= 1)) suspects.push(s);
    }
    const jobs = shuffle([...JOBS[this.zone.def.setting]]);
    const names = shuffle([...FIRST_NAMES]), lasts = shuffle([...LAST_NAMES]);
    this.suspects = shuffle(suspects.map((a, i) => ({ attrs: a, name: `${names[i]} ${lasts[i]}`, job: jobs[i], culprit: a === culprit })));
    this.keys = keys;

    this.props = S.props.map(([type, name, x, y, w, h, desc]) => ({ type, name, x, y, w, h, desc }));
    const methods = shuffle(['visible', 'visible', 'xray', 'witness']);
    this.clues = keys.map((k, i) => ({ key: k, value: culprit[k], method: methods[i], found: false, photo: false }));
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
  }

  // ------------------------------------------------------------------ input
  update(dt) {
    if (this.done) return;
    const g = this.g, inp = g.input;
    this.t += dt;
    if (this.xray) { this.en -= dt * 11; if (this.en <= 0) { this.en = 0; this.setXray(false); toast('X-ray power drained', 'bad'); } }
    else this.en = Math.min(100, this.en + dt * 6);
    if (inp.pressed('xray')) this.setXray(!this.xray);
    if (inp.pressed('camera')) { this.camera = !this.camera; inp.setButton('camera', { toggled: this.camera }); toast(this.camera ? '📷 Camera ready — tap a found clue to photograph it' : 'Camera away', 'info'); }
    if (inp.pressed('notes')) this.showNotes();
    if (inp.pressed('accuse')) this.showSuspects();
    if (inp.pressed('leave')) this.leave();
    for (const tap of inp.taps) this.tap(tap.x, tap.y);
    this.updateObjectives();
  }

  setXray(on) {
    if (on && this.en < 10) { toast('Not enough X-ray power', 'bad'); return; }
    this.xray = on;
    this.g.input.setButton('xray', { toggled: on });
    $('xray-tint').classList.toggle('on', on);
    if (on) sfx.beam();
  }

  toLogical(x, y) {
    const f = fitScene(this.g.w, this.g.h, LW, LH);
    return { x: (x - f.ox) / f.s, y: (y - f.oy) / f.s };
  }

  /** Comic burst centred on a prop (scene coords → screen). */
  burst(word, p, colors) {
    const f = fitScene(this.g.w, this.g.h, LW, LH);
    comic.pow(word, f.ox + (p.x + p.w / 2) * f.s, f.oy + (p.y + p.h / 3) * f.s, { size: 1, colors });
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

  async search(p) {
    const c = p.clue;
    if (this.camera) {
      if (c && c.found && !c.photo) {
        c.photo = true; this.photos++; sfx.shutter(); flash('#fff');
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
      c.found = true; sfx.pickup();
      this.burst(c.method === 'xray' ? 'EUREKA!' : 'AHA!', p);
      await new Promise((r) => setTimeout(r, 450)); // let the burst land before the clue card
      const how = c.method === 'xray' ? `Your X-ray vision reveals something hidden inside the ${p.name.toLowerCase()}.` : `You search the ${p.name.toLowerCase()} and find something.`;
      await dialog({ title: 'CLUE FOUND', speaker: ATTRS[c.key].label, text: `${how}<br><br>${ATTRS[c.key].clue[c.value]}<span class="hint">Tip: switch on the camera and tap here to photograph it.</span>` });
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
      w.told = true; w.clue.found = true; sfx.pickup();
      await dialog({ title: 'CLUE FOUND', speaker: w.name, text: `"Okay… okay. The person I saw — ${ATTRS[w.clue.key].clue[w.clue.value].replace(/<b>|<\/b>/g, '')}"` });
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
      if (c) {
        c.found = true;
        await dialog({ title: 'CLUE FOUND', text: `The note reads: ${ATTRS[c.key].clue[c.value]}` });
      }
    }
    if (st.intox >= 100) {
      await dialog({ title: 'Everything spins…', text: `${HERO} stumbles out of the scene before she embarrasses herself. The case goes cold.` });
      this.finish(false, true);
    }
  }

  async showNotes() {
    const found = this.clues.filter((c) => c.found);
    const html = found.length
      ? found.map((c) => `<div class="item"><b>${ATTRS[c.key].label}:</b> ${ATTRS[c.key].clue[c.value]}${c.photo ? ' 📸' : ''}</div>`).join('')
      : '<div class="item">No clues yet. Tap objects in the scene to search them.</div>';
    await dialog({ title: `Notebook — ${this.zone.name}`, text: `<div class="list">${html}</div>Clues: ${found.length}/${this.clues.length} · Photos: ${this.photos}` });
  }

  async showSuspects() {
    const found = this.clues.filter((c) => c.found);
    const can = found.length >= 3;
    const html = this.suspects.map((s) => `<div class="item"><b>${s.name}</b> — ${s.job}<br>${this.keys.map((k) => {
      const c = found.find((c) => c.key === k);
      const cls = c ? (c.value === s.attrs[k] ? 'match' : 'miss') : '';
      return `<span class="chip ${cls}">${s.attrs[k]}</span>`;
    }).join('')}</div>`).join('');
    const v = await dialog({
      title: 'Suspects', text: `<div class="list">${html}</div>${can ? 'Who did it?' : `Find at least 3 clues before you accuse anyone (${found.length}/3).`}`,
      options: [...(can ? this.suspects.map((s, i) => ({ label: `Accuse ${s.name}`, value: i, cls: 'bad' })) : []), { label: 'Keep investigating', value: null }],
    });
    if (v === null || v === undefined) return;
    const s = this.suspects[v];
    this.finish(s.culprit, false, s);
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
    $('hud-sub').textContent = this.xray ? 'X-RAY ACTIVE' : this.camera ? 'CAMERA MODE — tap a found clue' : 'Tap objects to search';
    this.g.input.setButton('accuse', { lit: found >= 3 });
  }

  hud() { const b = $('b-en'); if (b) b.style.width = this.en + '%'; }

  finish(win, drunk = false, accused = null) {
    if (this.done) return;
    this.done = true;
    this.setXray(false);
    const z = this.zone;
    const culprit = this.suspects.find((s) => s.culprit);
    if (win) {
      sfx.win();
      this.g.state.stats.photos += this.photos;
      this.g.endZone(z, { outcome: 'win', rep: z.reward + this.photos * 4, culprit: culprit.name, job: culprit.job, photos: this.photos, photo: 'case' });
    } else if (drunk) {
      this.g.endZone(z, { outcome: 'lose', rep: -6, text: 'The case went cold.' });
    } else {
      sfx.lose();
      this.g.endZone(z, { outcome: 'lose', rep: -10, text: `Wrong suspect! ${accused.name} had an alibi, and the real culprit, ${culprit.name} (${culprit.job}), slipped away.` });
    }
  }

  abort() { this.done = true; this.setXray(false); this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h;
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    const f = fitScene(W, H, LW, LH);
    const st = g.state;
    ctx.save();
    ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
    if (st.intox > 30) { const a = Math.sin(this.t * 1.3) * (st.intox - 30) * 0.12; ctx.translate(a, Math.cos(this.t) * a * 0.3); }
    ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
    this.drawRoom(ctx);
    const props = [...this.props].sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const p of props) drawProp(ctx, p, this.t);
    this.drawTrap(ctx);
    const w = this.witness;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(w.x, w.y, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawHumanoid(ctx, w.x, w.y, 2.1, -1, w.look, pose('stand', this.t), this.t);
    if (!w.talked) this.bubble(ctx, w.x, w.y - 240, '…?');

    // hover highlight (mouse)
    const ptr = g.input.pointer;
    if (ptr.x >= 0 && !document.body.classList.contains('touch')) {
      const { x, y } = this.toLogical(ptr.x, ptr.y);
      const hp = [...props].reverse().find((p) => this.hit(p, x, y));
      if (hp) {
        ctx.strokeStyle = this.camera ? '#fff' : '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.strokeRect(hp.x - 4, hp.y - 4, hp.w + 8, hp.h + 8); ctx.setLineDash([]);
        this.label(ctx, hp.x + hp.w / 2, hp.y - 12, hp.name);
      }
    }
    // found-clue markers
    for (const c of this.clues) {
      if (!c.found || !c.host) continue;
      const p = c.host;
      ctx.fillStyle = c.photo ? '#3ee08a' : '#ffd23f';
      ctx.beginPath(); ctx.arc(p.x + p.w - 6, p.y + 6, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.photo ? '📷' : '!', p.x + p.w - 6, p.y + 7);
    }

    if (this.xray) this.drawXray(ctx, props);
    if (this.camera) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4;
      const m = 26, l = 60;
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [LW - m, m, -1, 1], [m, LH - m, 1, -1], [LW - m, LH - m, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y); ctx.stroke();
      }
      ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(LW - 60, 60, 8 + Math.sin(this.t * 6) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.textAlign = 'right'; ctx.fillText('REC', LW - 76, 66);
    }
    ctx.restore();
  }

  drawRoom(ctx) {
    const S = this.setting, night = this.g.state.night;
    ctx.fillStyle = S.wall; ctx.fillRect(0, 0, LW, FLOOR);
    if (S.brick) {
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      for (let y = 0; y < FLOOR; y += 22) for (let x = (y / 22) % 2 ? -30 : 0; x < LW; x += 60) ctx.fillRect(x, y, 56, 18);
    }
    if (S.planks) { ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let x = 0; x < LW; x += 40) ctx.fillRect(x, 0, 3, FLOOR); }
    if (S.window) {
      const [x, y, w, h] = S.window;
      ctx.fillStyle = night > 0.5 ? '#0b1030' : '#8cc4ec'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = night > 0.5 ? '#1c2040' : '#6a8aa8';
      for (let i = 0; i < 7; i++) ctx.fillRect(x + i * (w / 7), y + h - 30 - ((i * 37) % 70), w / 8, 100);
      if (night > 0.5) { ctx.fillStyle = '#ffd98a'; for (let i = 0; i < 20; i++) ctx.fillRect(x + ((i * 41) % w), y + h - 20 - ((i * 23) % 70), 3, 4); }
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 8; ctx.strokeRect(x, y, w, h);
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    }
    ctx.fillStyle = S.floor; ctx.fillRect(0, FLOOR, LW, LH - FLOOR);
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -6; i <= 16; i++) { ctx.moveTo(LW / 2 + (i - 5) * 30, FLOOR); ctx.lineTo(LW / 2 + (i - 5) * 150, LH); }
    for (let y = FLOOR + 30; y < LH; y += 40 + (y - FLOOR) * 0.3) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
    ctx.stroke();
    if (S.carpet) { ctx.fillStyle = 'rgba(255,210,80,.08)'; for (let x = 0; x < LW; x += 50) for (let y = FLOOR; y < LH; y += 50) ctx.fillRect(x + 20, y + 20, 10, 10); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, FLOOR - 8, LW, 8);
    // crime scene tape
    ctx.fillStyle = '#f2d21a'; ctx.save(); ctx.translate(0, 30); ctx.rotate(-0.06); ctx.fillRect(-20, 0, 300, 20);
    ctx.fillStyle = '#111'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('POLICE LINE — DO NOT CROSS — POLICE LINE', 0, 11); ctx.restore();
  }

  drawTrap(ctx) {
    const tr = this.trap;
    if (tr.taken) return;
    const x = tr.x + 18, y = tr.y + 36;
    const n = tr.item.name;
    if (n.includes('Champagne') || n.includes('Cocktail')) {
      ctx.fillStyle = n.includes('Cocktail') ? 'rgba(80,255,180,.8)' : 'rgba(255,230,140,.85)';
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
    const a = 0.4 + 0.4 * Math.sin(this.t * 4);
    ctx.strokeStyle = `rgba(255,140,220,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 16, 26, 0, Math.PI * 2); ctx.stroke();
  }

  drawXray(ctx, props) {
    ctx.fillStyle = 'rgba(0,20,60,.62)'; ctx.fillRect(0, 0, LW, LH);
    ctx.strokeStyle = 'rgba(120,230,255,.8)'; ctx.lineWidth = 2;
    for (const p of props) ctx.strokeRect(p.x, p.y, p.w, p.h);
    for (const c of this.clues) {
      if (c.method !== 'xray' || !c.host) continue;
      const p = c.host, x = p.x + p.w / 2, y = p.y + p.h / 2;
      const r = 20 + Math.sin(this.t * 5) * 4;
      ctx.fillStyle = c.found ? 'rgba(120,255,160,.5)' : 'rgba(255,240,120,.85)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.found ? '✓' : '?', x, y + 1);
    }
    // witness skeleton, for fun
    const w = this.witness;
    ctx.strokeStyle = 'rgba(220,250,255,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x + 2, w.y - 180, 13, 0, Math.PI * 2); ctx.moveTo(w.x, w.y - 166); ctx.lineTo(w.x, w.y - 96);
    ctx.moveTo(w.x, w.y - 96); ctx.lineTo(w.x - 12, w.y); ctx.moveTo(w.x, w.y - 96); ctx.lineTo(w.x + 12, w.y);
    ctx.moveTo(w.x - 20, w.y - 150); ctx.lineTo(w.x + 20, w.y - 150); ctx.stroke();
    if (!this.trap.taken) {
      const tr = this.trap;
      ctx.fillStyle = 'rgba(255,90,200,.55)'; ctx.beginPath(); ctx.arc(tr.x + 18, tr.y + 20, 22, 0, Math.PI * 2); ctx.fill();
      this.label(ctx, tr.x + 18, tr.y - 10, 'CHEMICAL TRACE');
    }
  }

  bubble(ctx, x, y, txt) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, 26, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 6, y + 14); ctx.lineTo(x + 2, y + 28); ctx.lineTo(x + 8, y + 12); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '900 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y);
  }

  label(ctx, x, y, txt) {
    ctx.font = '800 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 16;
    ctx.fillStyle = 'rgba(8,12,26,.85)'; ctx.fillRect(x - w / 2, y - 12, w, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y);
  }
}

// --------------------------------------------------------------------------
// Prop drawings (logical coordinates, x/y = top-left).
// --------------------------------------------------------------------------
function drawProp(ctx, p, t) {
  const { x, y, w, h } = p;
  const box = (xx, yy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, ww, hh); };
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  if (y + h > FLOOR) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill(); }
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

export { drawProp };
