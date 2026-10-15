// The story clubs (The Hive, The Gilded Cage, Flashpoint): what each case's own venue adds on top
// of the club. Difficulty (guards, how fast they spot her, how many times she can be taken, how
// hard the struggle is); traps instead of sedation (a struggle over a clip of her held: break free
// and she's back on her feet, fail and the room watches the humiliation on screen); the Hive's
// rule (highOnly: nothing in there opens up to a sober hero); the Gilded Cage's bidders' booths;
// the screens playing the case's clips. Flashpoint's paparazzi live in press.js.
import { struggle, STRUGGLE } from './struggle.js';
import { CLIPS, clipsReady, nextClip } from './clips.js';
import { showDJ } from './video.js';
import { playCutscene } from '../cutscene.js';
import { dialog, toast, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';
import { INTOX_HAZE } from '../state.js';
import { $, pick } from '../util.js';
import { comic } from '../comic.js';

/** normal = the original clubs. hard: two more bouncers, quicker to spot her, taken twice = carried out. */
export const DIFF = {
  normal: { name: 'Normal', guardGain: 0.7, captureAt: 3, guards: 0, struggle: 'normal' },
  hard:   { name: 'Hard', guardGain: 1.0, captureAt: 2, guards: 2, struggle: 'hard' },
};

// each club's trap: what holds her, and what the room sees when she can't get out
const TRAPS = {
  halo: { title: 'BREAK FREE!', text: 'The drones drag her into the back and lock her in. Her limbs are honey.', shame: 'The Queen plays it on every screen in the Hive…' },
  auction: { title: 'BREAK FREE!', text: 'She wakes in the Curator\'s gilded cage. The bidders are watching.', shame: 'Lot one: the preview plays on every screen in the ballroom…' },
  flashpoint: { title: 'THE HOT SEAT', text: 'Strapped into the chair under the lights. Two million people are watching.', shame: 'FLASHPOINT LIVE: the whole city is watching…' },
};
const TRAP_DEFAULT = { title: 'BREAK FREE!', text: 'They\'ve got her held tight.', shame: 'The club watches it on every screen…' };
// breaking free: she throws off whoever had hold of her. Bouncers within `r` metres go down for
// `daze` seconds; for `cover` seconds nobody (bouncers, paparazzi) can pick her out, so she can get
// into the crowd. Without this the bouncers who caught her were still staring at her and she was
// caught again the moment the struggle ended.
// `again`: caught again this soon after breaking free, she doesn't land back in the same spot: she
// bolts through the crowd to the far side of the floor (no dead end: the same lock never replays).
export const SHAKE = { r: 9, daze: 7, cover: 6, again: 30 };
// the USE spots a sober hero can still work in the Hive: the ways to get high, the fights, the way out
// round 11 D3: the Gilded Cage's empty birdcage. She dances in it on the beat for the bidders' phones:
// `rep` off her reputation (Act 2's fast way down, docs/design/act2.md), a dance card, the LIVE feed.
// `secs` of dance (STEP OUT any time), `again` s before she can go back in, `win`: the on-beat window
// (fraction of a beat either side), the crowd's ring (`ring` dancers at `r` m), the plinth's top `y`.
export const CAGE = { rep: 8, again: 20, secs: 12, win: 0.22, ring: 8, r: 2.7, y: 0.6, shut: 0.6, good: 6 };
const CAGE_SAY = {
  in: ['Fine. ONE dance.', 'Okay… I\'m part of the show now.', 'Just blending in. In a cage.'],
  crowd: ['She\'s IN the cage!', 'Lot one! Lot one!', 'Dance, Supergirl!', 'Phones up, phones up!', 'Is this part of the auction?!'],
  hit: ['WOO!', 'YES!', 'SNAP!', 'DANCE!'],
  out: ['That\'s enough show for tonight.', 'Never telling anyone about this.'],
};
const SOBER_OK = /^(Order at the bar|Fly out|Check the first stall|Take the shot-off|Change into|Kick in|Take on|Stop the courier|Read the glowing)/;

export const storyMethods = {
  /** From enter(), once the case is known: its difficulty. */
  startStory() {
    this.diff = DIFF[this.caseDef.difficulty] || DIFF.normal;
    this.scandal = 0; this.wallT = 20; this.escapeT = 0;
    // (per visit: the cage, the idle ring in danger.js)
    this.caged = null; this.cageAt = -99; this.cageDances = 0; this.idleRing = null; this.idleRings = 0; this.idleFlips = 0;
  },

  captureAt() { return this.diff?.captureAt ?? 3; },

  /** Is what people say coming through scrambled? Normally when she's high; in the Hive when she isn't. */
  garbled() {
    const H = this.caseDef.highOnly, i = this.g.state.intox;
    return H ? i < H.min : i >= INTOX_HAZE;
  },

  /** In the Hive, high enough for it to open up. Always true elsewhere. */
  highEnough() {
    const H = this.caseDef.highOnly;
    return !H || this.g.state.intox >= H.min;
  },

  /** The hall's screens: the case's clips in a story club, the DJ loops everywhere else. */
  hallVideo() {
    const go = () => {
      const W = this.caseDef?.clips?.wall;
      if (W?.length) return this.video.show([], { extra: W, deal: true });
      return showDJ(this.video);
    };
    // the manifest arrives a moment after the module loads; switch onto the full wall once it has
    const W = this.caseDef?.clips?.wall;
    if (W && !W.length) clipsReady.then(() => { if (!this.done && (!this.videoWant || this.videoWant === 'dj')) go(); });
    return go();
  },

  /** From placeGameplay: the booths, the press, the Hive's gate on every USE spot. */
  placeStory() {
    const d = this.caseDef, A = this.hallA;
    if (A.booths && d.booths) for (const b of A.booths) {
      const def = d.booths[b.i];
      if (!def) continue;
      this.addInter({ x: b.x, z: b.z }, `Peek into booth ${b.i + 1}`, () => !this.book.has('booth', String(b.i + 1)), () => this.peekBooth(b, def));
    }
    if (d.press) this.placePress?.();
    const cg = A.cages?.find((c) => c.empty && c.door);
    if (cg) this.addInter({ x: cg.x + 1.75, z: cg.z + 0.45 }, 'Dance in the cage', () => !this.caged && this.t >= this.cageAt + CAGE.again, () => this.cageDance(cg));
    if (d.highOnly) for (const o of this.inter) {
      if (SOBER_OK.test(o.label)) continue;
      const act = o.act, base = o.label;
      o.base = base; o.gated = true;
      o.act = () => {
        if (this.highEnough()) return act();
        sfx.lose();
        toast(d.highOnly.line, 'bad');
      };
    }
  },

  stepStory(dt) {
    const d = this.caseDef;
    if (d.highOnly) {
      const ok = this.highEnough();
      for (const o of this.inter) if (o.gated) o.label = ok ? o.base : `${o.base} · needs ${d.drugName}`;
      if (ok && !this._highOnce) { this._highOnce = true; banner('THE HIVE OPENS UP', `${d.drugName} hits: now they'll talk to you`, '#ffb020'); }
    }
    this.stepShake(dt);
    this.stepCage(dt);
    if (d.press) this.stepPress?.(dt);
    // the screens move on to the next clip now and then (the same clip all night is a dead screen)
    if (d.clips?.wall && this.videoWant === 'dj') {
      this.wallT -= dt;
      if (this.wallT <= 0) { this.wallT = 24; this.hallVideo(); }
    }
  },

  /** The story clubs' extra HUD bars (after setupControls): the Hive's high, Flashpoint's scandal. */
  storyHud() {
    const d = this.caseDef, el = $('hud-extra');
    if (!el) return;
    if (d.highOnly) el.insertAdjacentHTML('beforeend', `<div class="barlabel"><span>${d.drugName}</span></div><div class="bar c3-high"><i id="b-high" class="b-en"></i><u style="left:${d.highOnly.min}%"></u></div>`);
    if (d.press) el.insertAdjacentHTML('beforeend', '<div class="barlabel"><span>Scandal</span></div><div class="bar"><i id="b-scandal" class="b-alert"></i></div>');
  },

  hudStory() {
    const d = this.caseDef;
    if (d.highOnly) {
      const b = $('b-high');
      if (b) { b.style.width = this.g.state.intox + '%'; b.parentElement.classList.toggle('warn', !this.highEnough() || this.g.state.intox > 85); }
    }
    if (d.press) {
      const b = $('b-scandal');
      if (b) { b.style.width = this.scandal + '%'; b.parentElement.classList.toggle('warn', this.scandal > 60); }
    }
  },

  /**
   * Caught in a story club: a trap and a struggle instead of the sedation clip. Free: back on her
   * feet where she was, the floor on alert. Not free: the room watches it on screen (a humiliation
   * clip), it goes in the envelope, and she comes to somewhere else (or, the last time, is carried out).
   */
  async storyTrap(reason, { blackout = false, trap = null } = {}) {
    const d = this.caseDef, T = trap || TRAPS[d.id] || TRAP_DEFAULT, st = this.g.state;
    this.busy = true;
    this.setXray(false); this.setHearing(false);
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    sfx.trap();
    this.music.update(1, true);
    await clipsReady;
    const left = this.captureAt() - (this.sedations || 0);
    const stakes = left <= 1 ? '<b>Lose this one and they carry you out.</b>' : 'Lose it and the whole club watches. You come to somewhere else.';
    const again = this.t - (this.freeAt ?? -999) < SHAKE.again;
    const free = await struggle({ clip: nextClip(d.clips?.trap || CLIPS.captive), title: T.title, text: `${reason} ${T.text}<br>${stakes}`, diff: this.diff.struggle });
    if (free) {
      this.shakeOff();
      if (again) this.slipAway();
      this.heroClip('getUp', 1.0);
      banner('FREE!', again ? 'You bolt through the crowd to the far side' : `They're down. Get into the crowd: ${SHAKE.cover}s`, '#3ee08a');
      this.freeAt = this.t;
      this.kick?.(0.8);
      this.sedating = false; this.busy = false;
      return true;
    }
    this.sedations = (this.sedations || 0) + 1;
    this.addCard('sedated', blackout ? `${HERO}, passed out` : `${HERO}, caught and held`);
    await playCutscene({ src: nextClip(d.clips?.shame || CLIPS.shame), caption: T.shame, untilTap: true });
    if (this.sedations >= this.captureAt()) {
      this.done = true;
      this.g.endZone(this.zone, { outcome: 'captured', reason: `${reason} This time she doesn't get out: she's carried out the back.` });
      return;
    }
    st.addRep(-4, 'On every screen in the club');
    await this.wake();
    this.sedating = false; this.busy = false;
    if (this.captureAt() - this.sedations === 1) toast('One more time and they carry you out of here.', 'bad');
    return false;
  },

  /** She broke free: the bouncers round her go down, everyone loses her for a few seconds (SHAKE). */
  shakeOff() {
    const h = this.hero.position;
    this.alert = 0; this.escapeT = SHAKE.cover; this.scandal = 0;
    const st = this.g.state;
    st.intox = Math.min(st.intox, 80); // (a blackout she fought off mustn't take her down again the next frame)
    this.crowd?.shove(h.x, h.z, 4, 1);
    sfx.hit();
    this.resetGuardMinds?.(); // (whoever was coming to look forgets where she went: stealth.js)
    for (const gd of this.guards) {
      if (gd.ko) continue;
      gd.look = 0;
      const m = gd.mesh;
      if (gd.high || Math.hypot(m.position.x - h.x, m.position.z - h.z) > SHAKE.r) continue;
      gd.ko = true; gd.dazed = this.t + SHAKE.daze; gd.cone.visible = false;
      if (m.enemy) m.enemy.knockDown();
      else { gd.y0 = m.position.y; m.rotation.x = -Math.PI / 2; m.position.y = gd.y0 + 0.15; }
    }
  },

  /** Caught twice running: she breaks for it and comes out of the crowd on the far side of the floor. */
  slipAway() {
    const V = this.plan.V, h = this.hero.position;
    let best = null, bd = -1;
    for (const [x, z, rx, rz, w] of V.crowd || []) {
      if (w < 0.3 || Math.abs(x) > V.hw - 2 || Math.abs(z) > V.hd - 2) continue;
      for (const sx of [-0.5, 0, 0.5]) {
        const px = x + sx * rx, pz = z, d = Math.hypot(px - h.x, pz - h.z);
        if (d > bd && !this.colliders.some((c) => !c.disabled && px > c.minX - 0.5 && px < c.maxX + 0.5 && pz > c.minZ - 0.5 && pz < c.maxZ + 0.5)) { bd = d; best = { x: px, z: pz }; }
      }
    }
    if (!best) return;
    h.set(best.x, h.y, best.z); this.camSnap = true;
    this.escapeT = Math.max(this.escapeT, SHAKE.cover + 2);
    this.crowd?.shove(best.x, best.z, 3, 0.6);
  },

  /** The cover running out; dazed bouncers getting back up (and back on their rounds). */
  stepShake(dt) {
    if (this.escapeT > 0) this.escapeT = Math.max(0, this.escapeT - dt);
    for (const gd of this.guards) {
      if (!gd.dazed || this.t < gd.dazed) continue;
      gd.dazed = 0; gd.ko = false; gd.look = 0; gd.cone.visible = !gd.away;
      const m = gd.mesh, E = m.enemy;
      if (E) { E.down = false; E.root.rotation.x = 0; E.root.position.y = E.floorY ?? 0; }
      else { m.rotation.x = 0; m.position.y = gd.y0 ?? 0; }
    }
  },

  // ---------------------------------------------------------------- the cage dance (round 11 D3)
  /** Up onto the plinth, the door drops shut, the spot comes up, the crowd's phones: the dance. */
  async cageDance(cg) {
    const h = this.hero.position, col = this.colliders.find((c) => c.mesh === cg.plinth);
    if (col) col.disabled = true;
    this.setXray?.(false); this.setHearing?.(false);
    h.set(cg.x, CAGE.y, cg.z); this.hero.rotation.y = 0; this.camSnap = true;
    const C = (this.caged = { cg, col, t: 0, hits: 0, misses: 0, beat: -1, sayT: 2 });
    cg.door.visible = cg.spot.visible = true; cg.door.scale.y = 0.001;
    this.heroClip('dance', 999);
    this.formKnot(CAGE.ring, CAGE.r);
    sfx.crowd?.(); sfx.shutter?.();
    banner('LOT ONE', 'Dance on the beat for the bidders · STEP OUT any time', '#ffc840');
    const s = this.screenOf(h, 2.6);
    if (s) comic.say(pick(CAGE_SAY.in), s.x, s.y, { kind: 'shout', ms: 1800 });
    const f = this.g.overworld?.feed;
    if (f && CLIPS.shame.length) { f.setList('clubCage', CLIPS.shame); f.play('clubCage', `${this.clubName} · LIVE: ${HERO} dancing in a gilded cage`, true); }
    // the pad: DANCE on the beat (1, USE or DANCE), STEP OUT (2)
    let el = $('c3-cage');
    if (!el) { el = document.createElement('div'); el.id = 'c3-cage'; $('game').appendChild(el); }
    el.style.cssText = 'position:absolute;left:0;right:0;margin:0 auto;bottom:18px;z-index:52;width:min(420px,calc(100vw - 380px));min-width:250px;display:flex;gap:8px;pointer-events:auto;font:400 18px Bangers,Impact,sans-serif;letter-spacing:.05em';
    const btn = 'border:2px solid #111;border-radius:12px;box-shadow:4px 4px 0 rgba(0,0,0,.5);color:#fff;padding:10px 8px;cursor:pointer;font:inherit';
    el.innerHTML = `<button data-a="tap" style="${btn};flex:2;background:#c8302a">DANCE! <small style="font:12px sans-serif;opacity:.8">on the beat · 1</small></button><button data-a="out" style="${btn};flex:1;background:rgba(10,6,18,.9)">STEP OUT <small style="font:12px sans-serif;opacity:.8">2</small></button>`;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (b.dataset.a === 'tap') this.cageTap(); else this.cageOut(); }));
    const onKey = (e) => { if (e.key === '1') this.cageTap(); else if (e.key === '2') this.cageOut(); else return; e.preventDefault(); e.stopPropagation(); };
    addEventListener('keydown', onKey, true);
    C.el = el.querySelector('[data-a=tap]');
    await new Promise((res) => { C.res = res; });
    removeEventListener('keydown', onKey, true);
    el.remove();
    // the result: the phones got it, whatever she did
    const st = this.g.state, good = C.hits >= CAGE.good;
    st.addRep(-CAGE.rep, 'Danced in the Gilded Cage');
    this.addCard('dance', good ? `${HERO}, dancing in a gilded cage` : `${HERO}, stumbling about in a gilded cage`);
    this.cageDances++;
    toast(good ? `The bidders cheer. Every phone in the ballroom got it. −${CAGE.rep} reputation.` : `Off the beat, in a birdcage, on camera. −${CAGE.rep} reputation.`, 'bad');
    this.releaseKnot();
    cg.door.visible = cg.spot.visible = false;
    if (col) col.disabled = false;
    h.set(cg.x + 1.75, 0, cg.z + 0.45); this.camSnap = true; this.still = 0;
    this.landT = 0; this.heroModel?.play('idle', { fade: 0.2 });
    const s2 = this.screenOf(h, 2.3);
    if (s2) comic.say(pick(CAGE_SAY.out), s2.x, s2.y, { kind: 'shout', ms: 1600 });
    this.caged = null; this.cageAt = this.t;
  },

  /** A tap: on the beat, the crowd goes wild; off it, a stumble. */
  cageTap() {
    const C = this.caged, B = this.B;
    if (!C || C.done || !B) return;
    const on = B.ph < CAGE.win || B.ph > 1 - CAGE.win * 0.5, s = this.screenOf(this.hero.position, 2.4);
    if (on && C.beat !== B.n) {
      C.beat = B.n; C.hits++; sfx.shutter?.();
      if (s) comic.pow(pick(CAGE_SAY.hit), s.x + (Math.random() - 0.5) * 80, s.y - 30, { size: 0.7, colors: ['#ffd84d', '#ffffff'] });
    } else {
      C.misses++; sfx.scratch ? sfx.scratch() : sfx.lose?.();
      if (s) comic.pow('OOPS!', s.x, s.y - 20, { size: 0.6 });
    }
  },

  cageOut() { const C = this.caged; if (C && !C.done) { C.done = true; C.res?.(); } },

  /** Per frame while she's in the cage: on the plinth, the door, the beat on the pad, the bouncers let her be. */
  stepCage(dt) {
    const C = this.caged;
    if (!C || C.done) return;
    if (this.sedating) return this.cageOut(); // (a blackout takes her out of the show)
    const h = this.hero.position, cg = C.cg, inp = this.g.input, B = this.B;
    C.t += dt;
    h.set(cg.x, CAGE.y, cg.z);
    cg.door.scale.y = Math.min(1, C.t / CAGE.shut);
    cg.spot.material.opacity = 0.12 + 0.08 * (B?.pulse || 0);
    this.grace = Math.max(this.grace || 0, this.t + 0.5); // (she's part of the show: no bouncer reads her as an intruder)
    if (C.el && B) C.el.style.filter = `brightness(${0.75 + 0.6 * B.pulse})`;
    if (inp.pressed('interact') || inp.pressed('dance')) this.cageTap();
    C.sayT -= dt;
    const K = this.knotHost().knot;
    if (C.sayT <= 0 && K?.k.length) {
      C.sayT = 2.2;
      const q = pick(K.k), s = this.screenOf({ x: q.p.x, y: 0, z: q.p.z }, 2);
      if (s) comic.say(pick(CAGE_SAY.crowd), s.x, s.y, { ms: 1500 });
    }
    if (C.t >= CAGE.secs) this.cageOut();
  },

  /** The Gilded Cage's booths: X-ray sees through the velvet unseen; pulling it back, somebody sees you. */
  async peekBooth(b, def) {
    const key = `booth:${b.i + 1}`;
    if (this.xray) {
      await this.gotClue(key, { title: `X-ray: booth ${b.i + 1}` });
      return;
    }
    const v = await this.quick({ speaker: `Booth ${b.i + 1}`, text: `Voices behind the velvet. Somebody is bidding.<small>X-ray would see through it unseen.</small>`, options: [
      { label: 'Pull back the curtain', note: 'They\'ll see you', value: 'open', cls: 'risky' },
      { label: 'Leave it', value: null },
    ] });
    if (v !== 'open') return;
    await this.gotClue(key, { title: `Booth ${b.i + 1}` });
    this.say({ x: b.x, z: b.z - 1.2 }, def.line, { ms: 3600, speaker: def.who });
    this.alert = Math.min(95, this.alert + 25);
    if (b.i === 3) { this.addCard('photos', `${HERO} caught peeking into a booth`); sfx.shutter(); toast('FLASH! The photographer got you.', 'bad'); }
    else toast('"Security!"', 'bad');
  },
};

export { STRUGGLE };
