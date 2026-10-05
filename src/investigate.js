// Investigation zones: a hotspot crime scene. Search props, use X-ray vision on sealed things,
// question a witness, photograph evidence for the paper, then accuse the suspect who matches the clues.
// The room is a painting (assets/scenes, hotspots in scenespots.js) with the live layers drawn over it
// and graded into its light: witness, bait, story dressing, evidence tents, dust, detective vision.
// Until the painting has loaded (or if it fails) the code painter (crimescene.js) stands in.
// X-RAY is detective vision; clue finds punch in.
import { ATTRS, FIRST_NAMES, LAST_NAMES, JOBS, WITNESS_MOODS, INTOX_ITEMS, HERO, DISTRICTS } from './data.js';
import { drawHumanoid, pose, npcLook, portrait } from './art.js';
import { pick, shuffle, chance, fitScene, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { sfx } from './sfx.js';
import { CaseFile } from './casefile.js';
import { comic } from './comic.js';
import { quality } from './settings.js';
import { LW, LH, FLOOR, INK, CAPTION, ease, paintRoom, paintFixture, paintLight, paintDust, makeDust, makeGrade, paintStory, paintForeground, paintBackdrop, paintSceneLight, paintSceneFx } from './crimescene.js';
import { SCENES, pickScene, loadScene, sceneImage, dropScene } from './scenespots.js';
import { loadingPanel } from './gfx.js';
import { SETTINGS, CONTAINERS, SURFACES, ANIM, drawProp, drawPropAnim, shadeProp, contactShadow, tent } from './sceneprops.js';
import { ScanView } from './scanview.js';
import { LensFX } from './lensfx.js';

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
    this.paint = pickScene(zone.def.setting, zone.def.id, zone.paint); // zone.paint: debug/harness override
    this.scene = this.paint ? SCENES[this.paint] : null;
    if (this.paint) loadScene(this.paint); // the bake picks it up once decoded (baseKey)
    this.buildCase();
    if (this.lay) this.lay.baseKey = ''; // new case, new room
    // the room is baked in one long frame (painting, ink pass, light, grade): it happens behind a
    // LOADING card, once the painting has decoded (not first with the code-drawn stand-in, then again)
    this.loading = 0; this.loadT = performance.now();
    loadingPanel('LOADING…');
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

  exit() {
    loadingPanel(null);
    $('objectives').classList.remove('on');
    dropScene(); this.lay = null; // the painting and the full-screen layers go with the scene
  }

  get photos() { return this.case.photos; }

  buildCase() {
    const S = this.setting;
    this.case = new CaseFile(JOBS[this.zone.def.setting]);
    this.clues = this.case.clues;
    const sc = this.scene;
    // in a painted room each prop is the painted thing at its spot (renamed to what the painting shows)
    this.props = S.props.map(([type, name, x, y, w, h, desc], i) => {
      const sp = sc && sc.spots[i];
      return sp ? { type, name: sp[4] || name, x: sp[0], y: sp[1], w: sp[2], h: sp[3], desc: sp[5] || desc } : { type, name, x, y, w, h, desc };
    });
    const pool = shuffle([...this.props]);
    for (const c of this.clues) {
      if (c.method === 'witness') continue;
      const want = c.method === 'xray' ? CONTAINERS : null;
      const host = pool.find((p) => !p.clue && (!want || want.includes(p.type))) || pool.find((p) => !p.clue);
      host.clue = c; c.host = host;
    }
    const mood = pick(WITNESS_MOODS);
    const wl = npcLook('civilian');
    const [wx, wy, ws] = sc ? sc.witness : [780, 520, 2.1];
    this.witness = { x: wx, y: wy, s: ws, look: wl, mood, clue: this.clues.find((c) => c.method === 'witness'), talked: false, name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` };
    const surf = this.props.filter((p) => SURFACES.includes(p.type));
    const th = surf.length ? pick(surf) : pick(this.props);
    const item = pick(INTOX_ITEMS);
    const [bx, by] = sc ? sc.bait : [th.x + th.w * 0.72, th.y + 2];
    this.trap = { item, x: bx - 18, y: by - 36, w: 36, h: 36, taken: false, givesClue: chance(0.5) };
    this.chalk = sc ? { x: sc.chalk[0], y: sc.chalk[1], wallX: sc.chalk[2] } : this.freeFloorSpot();
  }

  /** A patch of floor clear of furniture and the witness, for the chalk outline. */
  freeFloorSpot() {
    const spots = [[480, 528], [250, 532], [640, 522], [150, 540], [900, 545]];
    const clear = ([x, y]) => Math.hypot(x - this.witness.x, y - this.witness.y) > 150 &&
      this.props.every((p) => p.y + p.h < FLOOR + 10 || x + 90 < p.x || x - 90 > p.x + p.w || y - 28 > p.y + p.h + 8);
    const s = spots.find(clear) || spots[0];
    // a stretch of back wall no tall prop hides (for scorch marks and the like)
    let wallX = s[0], best = 1e9;
    for (let x = 140; x <= 860; x += 20) {
      const open = this.props.every((p) => p.y > FLOOR - 120 || p.y + p.h < FLOOR - 200 || x + 70 < p.x || x - 70 > p.x + p.w);
      if (open && Math.abs(x - s[0]) < best) { best = Math.abs(x - s[0]); wallX = x; }
    }
    return { x: s[0], y: s[1], wallX };
  }

  // ------------------------------------------------------------------ input
  update(dt) {
    if (this.done) return;
    if (this.loading !== null) { // (render bakes the room once the card is up and the painting is in)
      if (this.loading === 'baked') { this.loading = null; loadingPanel(null); }
      else this.loading++;
      return;
    }
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
    if (on) sfx.xray();
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

  /** Hit test, grown to at least 68 logical units (44 px on a landscape phone) each way. */
  hit(p, x, y) {
    const px = Math.max(0, (68 - p.w) / 2), py = Math.max(0, (68 - p.h) / 2);
    return x >= p.x - px && x <= p.x + p.w + px && y >= p.y - py && y <= p.y + p.h + py;
  }

  /** The witness's tappable body, from their drawn scale. */
  witnessBox() { const w = this.witness; return { x: w.x - 19 * w.s, y: w.y - 106 * w.s, w: 38 * w.s, h: 106 * w.s }; }

  /** The floor line of the room in use (the painting's, or the code room's). */
  get floorY() { return this.scene ? this.scene.floor : FLOOR; }

  async tap(sx, sy) {
    if (this.busy || this.loading !== null) return;
    const { x, y } = this.toLogical(sx, sy);
    const w = this.witness;
    const tr = this.trap;
    this.busy = true;
    try {
      if (!tr.taken && this.hit(tr, x, y)) return await this.useTrap();
      if (this.hit(this.witnessBox(), x, y)) return await this.talk();
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
        this.snapReq = { p, c, n: this.case.num(c) };
        this.burst('KA-CHIK!', p, ['#ffffff', '#1e3cff']);
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
        this.burst('!', p, ['#ffe600', '#ff2d2d']);
        await new Promise((r) => setTimeout(r, 520)); // let the burst land before the clue card
        const how = c.method === 'xray' ? `Your X-ray vision reveals something hidden inside the ${p.name.toLowerCase()}.` : `You search the ${p.name.toLowerCase()} and find something.`;
        const from = this.toScreenZ(p.x + p.w / 2, p.y + p.h / 2, fitScene(this.g.w, this.g.h, LW, LH), this.zoomK());
        await this.case.reveal(c, how, 'Tip: switch on the camera and tap here to photograph it.', from);
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
    if (this.loading !== null && this.loading !== 'baked') {
      const waiting = this.paint && !sceneImage(this.paint) && performance.now() - this.loadT < 6000;
      if (this.loading < 2 || waiting) { ctx.fillStyle = '#0b0b16'; ctx.fillRect(0, 0, W, H); return; }
      this.loading = 'baked'; // (this frame bakes the room)
    }
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
    const rec = this.paint ? sceneImage(this.paint) : null, sc = rec ? this.scene : null;
    const baseKey = `${L.w}x${L.h}|${key}|${sc ? this.paint : ''}|${night > 0.5}|${this.trap.taken}|${this.witness.talked}`;
    const props = [...this.props].sort((a, b) => (a.y + a.h) - (b.y + b.h));
    const w = this.witness;
    if (L.baseKey !== baseKey) {
      const B = L.base.getContext('2d');
      B.setTransform(1, 0, 0, 1, 0, 0); B.clearRect(0, 0, L.w, L.h);
      if (sc) this.paintSceneTo(B, f, dpr, v, rec.img);
      else this.paintRoomTo(B, f, dpr, 0, v, key, night, t);
      const P = L.props.getContext('2d');
      P.setTransform(1, 0, 0, 1, 0, 0); P.clearRect(0, 0, L.w, L.h);
      this.view(P, f, dpr, 0, true);
      if (sc) { // the painting has the furniture: only the live cast and the case's story go on top
        if (sc.story !== false) this.drawFloorDressing(P);
        this.drawWitness(P); this.drawTrap(P);
        this.gradeLayer(L, sc);
      } else {
        let witnessDrawn = false;
        for (const p of props) {
          if (!witnessDrawn && p.y + p.h > w.y) { this.drawWitness(P); witnessDrawn = true; }
          drawProp(P, p, 0); shadeProp(P, p);
        }
        if (!witnessDrawn) this.drawWitness(P);
        this.drawTrap(P);
      }
      this.inkLayer(L, f, dpr, lite);
      const sh = 9 * f.s * dpr;
      B.globalAlpha = 0.4; B.drawImage(L.ink, sh, sh * 0.7); // comic drop shadow away from the lamp
      B.globalAlpha = 1; B.drawImage(L.ink, 0, 0); B.drawImage(L.props, 0, 0);
      // static light, the witness's bubble, the tape, then the print grade: all baked
      B.save(); this.view(B, f, dpr, 0, true);
      if (sc) paintSceneLight(B, sc); else paintLight(B, key, this.setting, night, v, t);
      if (!w.talked) this.bubble(B, w.x + 14 * w.s, w.y - 119 * w.s, '…?');
      const id = this.zone.def.id;
      if (id === 'arson') { // smoke still hanging under the ceiling
        const hz = B.createLinearGradient(0, v.y0, 0, FLOOR);
        hz.addColorStop(0, 'rgba(70,64,60,.55)'); hz.addColorStop(1, 'rgba(70,64,60,0)');
        B.fillStyle = hz; B.fillRect(v.x0, v.y0, v.x1 - v.x0, FLOOR - v.y0);
      }
      if (key === 'apartment' || key === 'alley') this.drawTape(B, v); // outdoors/at a home the police tape up
      if (!sc) paintForeground(B, key, v);
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
    if (sc) paintSceneFx(ctx, sc.fx || [], t);
    else for (const p of props) if (ANIM.includes(p.type)) drawPropAnim(ctx, p, t);
    this.drawTrapGlow(ctx);
    ctx.restore();

    // 3) live bits: dust in the light, evidence markers
    ctx.save();
    this.view(ctx, f, dpr, zk);
    paintDust(ctx, t, lite ? this.dust.slice(0, 18) : this.dust, sc && sc.lamp);
    this.drawMarkers(ctx);
    if (sc && sc.fg) { const [x, y, fw, fh] = sc.fg, k = rec.img.naturalWidth / LW; ctx.drawImage(rec.img, x * k, y * k, fw * k, fh * k, x, y, fw, fh); }
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

  /** The painted room: backdrop (edge-extended past the stage), the witness's contact shadow. */
  paintSceneTo(c, f, dpr, v, img) {
    c.save();
    this.view(c, f, dpr, 0);
    paintBackdrop(c, img, v);
    const w = this.witness;
    contactShadow(c, { x: w.x - 16 * w.s, y: w.y - 10, w: 32 * w.s, h: 10 });
    c.restore();
  }

  /** Multiply the live layer by the painting's ambient colour (alpha kept), so the drawn-on cast
   *  and dressing take the room's light instead of sitting on it like stickers. */
  gradeLayer(L, sc) {
    if (!L.tmp) { L.tmp = document.createElement('canvas'); L.tmp.width = L.w; L.tmp.height = L.h; }
    const T = L.tmp.getContext('2d');
    T.setTransform(1, 0, 0, 1, 0, 0); T.clearRect(0, 0, L.w, L.h); T.drawImage(L.props, 0, 0);
    const P = L.props.getContext('2d');
    P.save(); P.setTransform(1, 0, 0, 1, 0, 0);
    P.globalCompositeOperation = 'multiply'; P.fillStyle = sc.tint; P.fillRect(0, 0, L.w, L.h);
    P.globalCompositeOperation = 'destination-in'; P.drawImage(L.tmp, 0, 0);
    P.restore();
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
    drawHumanoid(c, w.x, w.y, w.s, -1, w.look, pose('stand', this.t), this.t);
    if (this.scene) shadeProp(c, { x: w.x - 22 * w.s, y: w.y - 96 * w.s, w: 44 * w.s, h: 96 * w.s });
  }

  /** What happened here, told on the floor: per case type (scorch marks, ransom letters…). */
  drawFloorDressing(g) {
    const ch = this.chalk, id = this.zone.def.id;
    paintStory(g, id, ch.x, ch.y, ch.wallX);
    if (id === 'missing' || id === 'smuggle' || id === 'spiked') { // a trail of prints leading out
      g.fillStyle = 'rgba(20,10,8,.3)';
      for (let i = 0; i < 6; i++) {
        const x = -40 + i * 52, y = 590 - i * 9 + (i % 2) * 12;
        g.beginPath(); g.ellipse(x, y, 11, 5, 0.2, 0, Math.PI * 2); g.ellipse(x + 15, y + 1, 5, 4, 0, 0, Math.PI * 2); g.fill();
      }
    }
  }

  /** Numbered evidence tents at every clue found (green check once photographed). */
  drawMarkers(g) {
    for (const c of this.clues) {
      if (!c.found || !c.host) continue;
      const p = c.host, n = this.case.num(c);
      const x = Math.min(LW - 30, Math.max(30, p.x + p.w * 0.5 + (n % 2 ? -1 : 1) * Math.min(40, p.w * 0.3)));
      // on the floor in front of whatever the prop stands on (a computer's desk), never on furniture
      let foot = p.y + p.h;
      for (let k = 0; k < 3; k++) {
        const q = this.props.find((q) => q !== p && x > q.x && x < q.x + q.w && foot + 12 > q.y && foot < q.y + q.h);
        if (!q) break; foot = q.y + q.h;
      }
      const floorY = Math.min(LH - 12, Math.max(foot + 16, this.floorY + 30));
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
}

Object.assign(Investigate.prototype, ScanView, LensFX);
