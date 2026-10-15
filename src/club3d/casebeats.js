// The crowd beats of a generated case (casegen.js): at the story beats a knot of clubgoers closes
// in round her. Fans pushing shots on her (vices: tipsy, a lead blurted out, a card in the owner's
// envelope; say no and they get pushy), phones up, a "gotcha" poser cosying up for the shot, a
// glass pushed into her hand, a ring of hired fans that won't let her out. Then the photo hits the
// club's LIVE feed: the tabloid headline. Real photo: get the snapper's phone back. Fake (planted,
// a lookalike, doctored, a setup): find the proof. Every beat hands control back within ~8 s and a
// repeat changes the situation (pushier fans, a spilt drink, the snapper moves room).
// Mixed into Club3D.prototype; the knot moves the crowd's own dancers (their home spots), nothing
// new is drawn but one instanced mesh of phone screens and, for the gotcha, one extra NPC.
import * as THREE from 'three';
import { rand, pick } from '../util.js';
import { toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { npcLook } from '../art.js';
import { INTOX_HAZE } from '../state.js';
import { CLIPS } from './clips.js';
import { showNewspaper } from '../newspaper.js';
import { HERO } from '../data.js';
import { TWISTS } from './casedata.js';

export const BEAT = { first: [14, 20], gap: [20, 28], again: [38, 50], hold: 7, phones: 8, r: 1.9 };
const SNAP_ROOMS = ['restroom', 'lounge', 'storage', 'dark'];

export const beatMethods = {
  startBeats() {
    const G = this.caseDef.gen;
    this._kh = { knot: null, leaving: null }; // (the knot outside a generated case: the idle ring, the cage; danger.js)
    this.gb = G ? { i: 0, t: +(new URLSearchParams(location.search).get('club3beat') || rand(...BEAT.first)), knot: null, refused: 0, drank: 0, repeats: 0, photo: null, snapper: null, proof: false, phoneBack: false, headline: false } : null;
  },

  stepBeats(dt) {
    const B = this.gb;
    if (!B || this.done) return;
    // game-time waits and answer deadlines (a paused game doesn't run them out)
    if (B.waits?.length) B.waits = B.waits.filter((w) => (this.t >= w.t ? (w.res(), false) : true));
    if (B.deadline && this.t >= B.deadline) { B.deadline = 0; this.closeQuick?.('slow'); }
    this.stepKnot(dt);
    this.stepSnapper(dt);
    if ((B.knot && !B.knot.idle) || this.busy || this.sub || this.sedating || this.quickOn || this.room || this.escapeT > 0) return;
    B.t -= dt;
    if (B.t > 0) return;
    const list = this.caseDef.gen.beats;
    let kind = list[B.i];
    if (!kind) {
      if (B.repeats >= 2) { B.t = 1e9; return; }
      B.repeats++; kind = 'shots'; // (the crowd comes back for more, pushier)
    }
    B.i++;
    B.t = rand(...(B.i > list.length ? BEAT.again : BEAT.gap));
    this.run(() => this.beat(kind));
  },

  /** A beat by name (the harness calls this too). */
  async beat(kind) {
    if (kind === 'headline') return this.beatHeadline();
    if (kind === 'shots') return this.beatShots();
    if (kind === 'selfie') return this.beatSelfie();
    if (kind === 'push') return this.beatPush();
    if (kind === 'trap') return this.beatTrap();
  },

  // ------------------------------------------------------------------ the knot
  /** Where the knot lives: the generated case's beat state, else the visit's own (the idle ring, the cage). */
  knotHost() { return this.gb || this._kh || (this._kh = { knot: null, leaving: null }); },

  /** n dancers nearest her close in to a ring of radius r (north of her: the camera sees them). */
  formKnot(n, r = BEAT.r, phones = true) {
    const B = this.knotHost(), h = this.hero.position, P = this.crowd.people;
    if (B.knot) this.releaseKnot(); // (a beat's knot takes over the idle ring's dancers)
    // dancers still drifting home from the last knot: their real home spots are in `leaving`
    const was = new Map((B.leaving || []).map((q) => [q.p, q]));
    const home = (p) => was.get(p) || p;
    const near = P.filter((p) => p.pose === 'dance' && !p.fixed && !p.left && Math.hypot(home(p).hx - h.x, home(p).hz - h.z) < 9)
      .sort((a, b) => Math.hypot(home(a).hx - h.x, home(a).hz - h.z) - Math.hypot(home(b).hx - h.x, home(b).hz - h.z)).slice(0, n);
    const k = near.map((p, i) => {
      const a = -1.9 + (3.8 * (i + 0.5)) / near.length; // a fan of angles, none between her and the camera
      const o = was.get(p), q = o ? { ...o, a, r } : { p, hx: p.hx, hz: p.hz, rot: p.rot, col: p.col.getHex(), a, r };
      p.col.setHex(0xcfe8ff); // (lit by their own phone screens: the knot reads against the crowd)
      return q;
    });
    if (B.leaving) B.leaving = B.leaving.filter((q) => !near.includes(q.p));
    this.crowd.repickT = 0;
    B.knot = { k, t: 0, phones, r, flashT: 0.4, rate: 1 };
    if (phones) this.phoneMesh(k.length);
    return B.knot;
  },

  releaseKnot() {
    const B = this.knotHost(), K = B.knot;
    if (!K) return;
    B.knot = null;
    B.leaving = [...(B.leaving || []), ...K.k];
    B.leaveT = 2;
    if (this.phones) this.phones.visible = false;
  },

  stepKnot(dt) {
    const B = this.knotHost(), K = B.knot, h = this.hero.position, ease = Math.min(1, dt * 3);
    if (B.leaving) {
      B.leaveT -= dt;
      for (const q of B.leaving) { q.p.hx += (q.hx - q.p.hx) * ease; q.p.hz += (q.hz - q.p.hz) * ease; }
      if (B.leaveT <= 0) { for (const q of B.leaving) { q.p.hx = q.hx; q.p.hz = q.hz; q.p.rot = q.rot; q.p.col.setHex(q.col); } B.leaving = null; this.crowd.repickT = 0; }
    }
    if (!K) return;
    K.t += dt;
    const ph = this.phones, m = this._phM || (this._phM = new THREE.Matrix4()), v = new THREE.Vector3();
    K.k.forEach((q, i) => {
      const tx = h.x + Math.sin(q.a) * K.r, tz = h.z - Math.cos(q.a) * K.r * 0.85;
      q.p.hx += (tx - q.p.hx) * ease; q.p.hz += (tz - q.p.hz) * ease;
      q.p.rot = Math.atan2(h.x - q.p.x, h.z - q.p.z);
      if (ph && K.phones) {
        // a phone held up at arm's length, screen toward her (its back toward the camera glows)
        v.set(q.p.x + Math.sin(q.p.rot) * 0.38, (q.p.fy || 0) + 1.95 + Math.sin(this.t * 3 + i) * 0.03, q.p.z + Math.cos(q.p.rot) * 0.38);
        m.makeRotationY(q.p.rot); m.setPosition(v); ph.setMatrixAt(i, m);
      }
    });
    if (ph && K.phones) {
      ph.count = K.k.length; ph.instanceMatrix.needsUpdate = true; ph.visible = true;
      K.flashT -= dt;
      if (K.flashT <= 0) {
        K.flashT = rand(0.35, 0.9) / (K.rate || 1); // (the idle ring: faster the longer she stands there)
        const q = pick(K.k), s = this.screenOf({ x: q.p.x, y: 1.9, z: q.p.z }, 0);
        if (s) comic.pow(pick(['SNAP!', 'FLASH', 'CLICK!']), s.x, s.y, { size: 0.5, colors: ['#ffffff', '#ffd84d'] });
        ph.material.color.setHex(0xffffff); setTimeout(() => this.phones?.material.color.setHex(0x9fd8ff), 90);
        sfx.shutter?.();
      }
    }
  },

  phoneMesh(n) {
    if (!this.phones) {
      const g = new THREE.PlaneGeometry(0.17, 0.28);
      this.phones = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x9fd8ff, side: THREE.DoubleSide, fog: false }), BEAT.phones);
      this.phones.frustumCulled = false; this.phones.name = 'c3-phones';
      this.scene.add(this.phones);
    }
    this.phones.count = Math.min(n, BEAT.phones);
  },

  /** A small choice that answers itself after `secs` (no dead ends): `slow` when time runs out. */
  quickT(opts, secs = BEAT.hold) {
    const p = this.quick({ at: this.hero.position, away: 'away', ...opts });
    this.gb.deadline = this.t + secs;
    return p.finally(() => { this.gb.deadline = 0; });
  },

  /** A fan blurts out something useful (a rumour or whisper she hasn't noted). */
  blurt() {
    const d = this.caseDef, all = [...(d.whispers || []).map((r) => [r, true]), ...(d.rumours || []).map((r) => [r, false])];
    const got = all.find(([r]) => !this.noted.has(r.id));
    if (got) this.noteRumour(got[0], got[1]);
  },

  // ------------------------------------------------------------------ the beats
  async beatShots() {
    const B = this.gb, prof = this.caseDef.gen.profile, pushy = Math.min(1, prof.pushy + B.refused * 0.25);
    this.formKnot(prof.knot, B.refused ? 1.5 : BEAT.r);
    sfx.crowd?.();
    const s = this.screenOf(this.hero.position, 2.2);
    if (s) comic.pow(B.refused ? 'DRINK! DRINK!' : 'SHOTS!', s.x, s.y - 30, { size: 1 });
    await this.wait(0.6);
    const v = await this.quickT({ speaker: B.refused ? 'The fans, louder' : 'The fans', text: B.refused ? `"Come ON, ${HERO}! You can't say no twice!"` : `"OMG it's ${HERO}! One shot with us! Just one!"`,
      options: [{ label: 'Down it', note: '+18 intoxication · they talk', value: 'drink', cls: 'risky' }, { label: 'Palm it (super-speed)', note: 'if nobody\'s looking', value: 'fake' }, { label: '"Not tonight."', note: pushy > 0.6 ? 'they won\'t take it well' : '', value: 'no' }] });
    if (v === 'drink') {
      this.g.state.addIntox(18); sfx.drink(); B.drank++;
      if (s) comic.pow('GULP!', s.x, s.y, { size: 0.9 });
      this.addCard('drunk', 'Shots with the fans, phones up');
      toast('"LEGEND!" One of them leans in, loose-lipped:', 'good');
      this.blurt();
    } else if (v === 'fake') {
      if (Math.random() > pushy * 0.6) { toast('WHOOSH: the shot goes into a plant pot faster than any phone can see. They cheer anyway.', 'good'); if (s) comic.pow('WHOOSH', s.x, s.y, { size: 0.8 }); }
      else { this.g.state.addIntox(8); this.addCard('fans', 'Caught tipping a fan\'s shot away'); toast('"She POURED it OUT!" They boo, and someone sloshes theirs down her front. On camera.', 'bad'); }
    } else {
      B.refused++;
      this.g.state.addRep(-2, 'Snubbed fans');
      if (B.refused > 1 || pushy > 0.8) { this.g.state.addIntox(8); toast('"Stuck-up!" Somebody "trips" and a drink goes all over her. Phones catch it.', 'bad'); this.addCard('fans', 'Soaked in a fan\'s drink'); }
      else toast('"Booo! Stuck-up!" They\'ll be back, and pushier.', 'bad');
      B.t = Math.min(B.t, rand(12, 18)); // (they come back sooner: the situation changes)
    }
    await this.wait(1.2);
    this.releaseKnot();
  },

  /** The gotcha: phones up, a poser cosies up for the shot. Takes the photo the twist is about. */
  async beatSelfie() {
    const B = this.gb, G = this.caseDef.gen, h = this.hero.position;
    this.formKnot(Math.max(4, G.profile.knot - 1), 2.2);
    const poser = this.spawnSnapper(h.x + 0.85, h.z + 0.15);
    poser.rotation.y = 0.2;
    if (poser.arms) poser.arms[1].rotation.x = -2.7; // (the selfie arm)
    const s = this.screenOf(poser.position, 2.1);
    if (s) comic.pow('GOTCHA!', s.x, s.y - 20, { size: 1.1 });
    sfx.shutter?.(); flash('#ffffff');
    const tipsy = this.g.state.intox >= INTOX_HAZE;
    const v = await this.quickT({ speaker: 'A fan in a gold jacket', text: G.twist === 'lookalike' ? '"Do the bar dance again! Like an hour ago! Say cheese!"' : '"Squeeze in, Supergirl! Say cheese!"',
      options: [{ label: 'Smile for it', value: 'smile' }, { label: 'Cover your face', value: 'cover' }, { label: 'Grab his phone', note: 'a scene, on camera', value: 'grab', cls: 'risky' }] }, 6);
    sfx.shutter?.(); flash('#ffffff');
    B.photo = { real: tipsy, how: v };
    if (v === 'grab') {
      this.g.state.addRep(-2, 'Snatched a fan\'s phone');
      toast('She has it, but it\'s already sent. He yanks it back and bolts. Everyone filmed THAT.', 'bad');
    } else if (v === 'cover') toast('A hand over her face: "HIDING SOMETHING?" is a headline too.', 'info');
    else toast(tipsy ? 'She sways into the shot, grinning. That one\'s not flattering.' : 'A big smile. The fan is thrilled… a little too thrilled.', tipsy ? 'bad' : 'info');
    this.addCard('fans', tipsy ? 'Tipsy, cheek to cheek with a fan' : 'A "gotcha" selfie with a fan');
    await this.wait(1);
    this.releaseKnot();
    this.snapperRun();
  },

  /** Planted: a glass shoved into her hand, the flashes go before she can put it down. */
  async beatPush() {
    const B = this.gb;
    this.formKnot(this.caseDef.gen.profile.knot, 1.6);
    const s = this.screenOf(this.hero.position, 2.2);
    if (s) comic.pow('HOLD THIS!', s.x, s.y - 30, { size: 1 });
    this.say(this.hero.position, '"Hold this a sec!"', { speaker: 'A man in a gold jacket' });
    await this.wait(0.5);
    for (let i = 0; i < 3; i++) { sfx.shutter?.(); flash('#ffffff'); await this.wait(0.25); }
    const v = await this.quickT({ speaker: 'Glass in hand', text: 'A full glass, and every phone on her. Too late: they have it.',
      options: [{ label: 'Hand it back', value: 'back' }, { label: 'Drink it', note: '+18 intoxication', value: 'drink', cls: 'risky' }, { label: 'Fling it away', note: 'a scene', value: 'fling' }] }, 6);
    if (v === 'drink') { this.g.state.addIntox(18); sfx.drink(); }
    if (v === 'fling') { this.g.state.addRep(-2, 'Flung a drink'); if (s) comic.pow('SPLASH!', s.x, s.y, { size: 0.9 }); }
    B.photo = { real: false, planted: true, how: v };
    this.addCard('fans', 'Glass in hand, mid-flash');
    toast('The guy in the gold jacket melts into the crowd, phone first.', 'bad');
    await this.wait(0.8);
    this.releaseKnot();
    this.spawnSnapper(this.hero.position.x + 1.4, this.hero.position.z - 1);
    this.snapperRun();
  },

  /** The setup: a tight ring of hired fans, phones up, nobody lets her out. Lasts ≤ ~6 s. */
  async beatTrap() {
    const B = this.gb, again = !!B.trapped;
    B.trapped = (B.trapped || 0) + 1;
    this.formKnot(this.caseDef.gen.profile.knot + 1, 1.15);
    banner('RINGED IN!', again ? 'Again?! Somebody is running this crowd' : 'Phones up, all round her', '#ffd84d');
    this.alert = Math.min(95, (this.alert || 0) + 12);
    const v = await this.quickT({ speaker: 'Ringed in', text: '"Stay for one picture! Just one! Everybody squeeze in!" Nobody moves out of her way.',
      options: [{ label: 'Push through', note: 'super-strength · on camera', value: 'push', cls: 'risky' }, { label: 'Smile and wait it out', value: 'wait' }, { label: 'Jump out over them', note: 'everyone sees', value: 'jump' }] }, 6);
    const s = this.screenOf(this.hero.position, 2.2);
    if (v === 'push') {
      this.crowd.shove(this.hero.position.x, this.hero.position.z, 4, 1.6);
      if (s) comic.pow('SHOVE!', s.x, s.y, { size: 1.1 });
      this.g.state.addRep(-3, 'Shoved her own fans'); this.addCard('fans', 'Shoving through her own fans');
    } else if (v === 'jump') {
      this.heroClip?.('jump', 1.4);
      if (s) comic.pow('WHOOSH!', s.x, s.y, { size: 1 });
      this.alert = Math.min(95, this.alert + 15);
    } else { for (let i = 0; i < 4; i++) { sfx.shutter?.(); flash('#ffffff'); await this.wait(0.35); } }
    B.photo = { real: false, setup: true, how: v };
    this.releaseKnot();
    if (again) toast('The ringleader slips away toward the bar. Whatever the plan was, it\'s written down somewhere.', 'info');
    else { this.spawnSnapper(this.hero.position.x - 1.6, this.hero.position.z - 1.2); this.snapperRun(); }
  },

  /** The payoff: her photo on the club's LIVE feed, the tabloid headline, the crowd's phones on her. */
  async beatHeadline() {
    const B = this.gb, G = this.caseDef.gen, T = TWISTS[G.twist];
    if (!B.photo) B.photo = { real: false, staged: true };
    B.headline = true;
    const f = this.g.overworld?.feed;
    if (f && CLIPS.press.length) { f.setList('clubPress', CLIPS.press); f.play('clubPress', `${this.clubName} · ${G.headline}`, true); }
    sfx.alarm?.();
    banner(G.headline, G.sub.replace('{CLUB}', this.clubName), '#ffd84d');
    comic.caption(`Every phone in the club buzzes at once: ${G.headline}`, { ms: 5200 });
    this.formKnot(Math.min(BEAT.phones, G.profile.knot + 1), 2.6);
    const s = this.screenOf(this.hero.position, 2.2);
    if (s) comic.pow(G.twist === 'real' ? 'GONE WILD?!' : 'SCANDAL!', s.x, s.y - 40, { size: 1.3 });
    await this.wait(2.2);
    this.say(this.hero.position, `"Is that YOU?!"`, { speaker: 'A clubber' });
    await this.wait(1.4);
    this.releaseKnot();
    toast(`${T.obj}.`, 'info');
  },

  // ------------------------------------------------------------------ the snapper
  spawnSnapper(x, z) {
    const B = this.gb;
    if (B.snapper) return B.snapper.m;
    const m = this.npc({ ...npcLook('civilian'), top: '#e0b020', bottom: '#1a1a1a', skirt: null, hairStyle: 'slick' }, x, z, Math.PI);
    const o = this.addInter(m.position, 'Get the phone back', () => !!B.snapper && !B.phoneBack && B.snapper.walk === 0, () => this.run(() => this.confrontSnapper()));
    B.snapper = { m, o, walk: 0, path: [], room: null, moves: 0 };
    return m;
  },

  /** He makes for a side room (another one each time she lets him go). */
  snapperRun() {
    const S = this.gb?.snapper;
    if (!S) return;
    const rooms = SNAP_ROOMS.map((k) => this.plan.byKind[k]).filter((q) => q && q !== S.room);
    const q = rooms[(this.caseDef.gen.seed + S.moves) % rooms.length] || this.plan.byKind.restroom;
    S.room = q; S.moves++;
    const out = q.side === 'W' ? 1 : -1;
    S.path = [{ x: q.door.x + out * 1.6, z: q.door.z }, { x: q.cx, z: q.cz + 1.5 }];
    S.walk = 1;
  },

  stepSnapper(dt) {
    const S = this.gb.snapper;
    if (!S) return;
    const m = S.m;
    S.o.pos.set(m.position.x, 0, m.position.z);
    if (!S.walk || !S.path.length) { S.walk = 0; return; }
    const p = S.path[0], dx = p.x - m.position.x, dz = p.z - m.position.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { S.path.shift(); return; }
    m.position.x += (dx / d) * 2.2 * dt; m.position.z += (dz / d) * 2.2 * dt;
    m.rotation.y = Math.atan2(dx, dz);
    const sw = Math.sin(this.t * 9) * 0.45; if (m.legs) { m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; }
  },

  async confrontSnapper() {
    const B = this.gb, G = this.caseDef.gen, S = B.snapper, tipsy = this.g.state.intox >= INTOX_HAZE;
    const v = await this.quickT({ speaker: 'The man in the gold jacket', text: '"Whoa, whoa. It\'s a free country. People take pictures."',
      options: [{ label: '"Hand it over. Now."', note: tipsy ? 'hard to be stern when you\'re swaying' : '', value: 'ask' }, { label: 'X-ray his jacket', note: 'the memory card', value: 'xray' }, { label: 'Snatch it', note: 'on camera', value: 'grab', cls: 'risky' }] }, 7);
    if (v === 'away' || v === 'slow' || (v === 'ask' && tipsy)) {
      toast(v === 'ask' ? '"You can barely stand!" He laughs and slips off to another room.' : 'He slips off to another room.', 'bad');
      this.snapperRun(); return;
    }
    if (v === 'xray') { this.alert = Math.min(95, (this.alert || 0) + 10); toast('X-ray: a memory card, sewn into his lining. She has it before he can blink.', 'good'); }
    if (v === 'grab') { this.g.state.addRep(-2, 'Snatched a phone'); toast('SNATCH! Somebody filmed that, of course.', 'bad'); }
    if (v === 'ask') toast('He goes red and hands it over.', 'good');
    B.phoneBack = true;
    this.envelope = (this.envelope || []).filter((c) => c.id !== 'fans'); this.envHud?.();
    if (G.twist === 'real') await this.gotClue('crowd:phone', { title: 'The phone' });
    else toast(`The photo's on it, but it's already out. ${TWISTS[G.twist].obj}.`, 'info');
    const s = this.screenOf(S.m.position, 2); if (s) comic.pow('GOT IT!', s.x, s.y, { size: 0.9 });
    S.walk = 1; S.path = [{ x: this.plan.entrance.x, z: this.plan.entrance.z - 1 }]; // (he leaves)
  },

  /** casework.gotClue: the twist's proof found. */
  onGenClue(key) {
    const G = this.caseDef.gen, T = G && TWISTS[G.twist];
    if (!T || key !== T.proof || this.gb.proof) return;
    this.gb.proof = true;
    banner('IT\'S A FAKE!', T.proofNote, '#3ee08a');
    const s = this.screenOf(this.hero.position, 2.2); if (s) comic.pow('FAKE!', s.x, s.y - 30, { size: 1.3, colors: ['#3ee08a', '#ffffff'] });
  },

  /** The objective line the case board adds for a generated case. */
  genObjective() {
    const B = this.gb, G = this.caseDef.gen;
    if (!B || !G) return null;
    if (G.twist === 'real' && B.snapper && !B.phoneBack) return { t: 'Get the snapper\'s phone back', target: B.snapper.m.position };
    if (G.twist === 'real') return { t: B.phoneBack ? 'The photo is gone' : `${G.short}'s crowd wants a photo: watch the drinks`, done: B.phoneBack };
    if (B.photo || B.headline) return { t: TWISTS[G.twist].obj, done: B.proof };
    return { t: `${G.short}'s crowd wants a photo of you: watch out`, done: false };
  },

  /** casework.solveCase: the morning's papers, which depend on what she got back or proved. */
  async genSolved() {
    const B = this.gb, G = this.caseDef.gen;
    if (!B || !G) return;
    const st = this.g.state, card = (this.envelope || []).find((c) => c.id === 'fans') || this.envelope?.[0];
    let paper;
    if (G.twist === 'real' ? B.phoneBack : B.proof) {
      st.addRep(8, 'Killed the story');
      paper = { headline: G.twist === 'real' ? 'NO PHOTO, NO STORY' : `${HERO.toUpperCase()} PHOTO A FAKE`, sub: `${G.name} exposed`, rep: 8, body: [G.twist === 'real' ? 'The picture everyone was talking about has vanished. So has the man who took it.' : 'The picture was a fake, and the proof is on every desk in the city by morning.', `${G.name} declined to comment.`] };
    } else {
      st.addRep(-6, 'The photo ran');
      paper = { headline: G.headline, sub: G.sub.replace('{CLUB}', this.clubName), rep: -6, photo: card?.img || 'tabloid', body: ['The case is cracked, but the picture ran anyway.', 'Next time: get the phone, or get the proof.'] };
    }
    await showNewspaper({ tabloid: true, photo: 'tabloid', ...paper });
  },

  /** Game seconds (stepBeats resolves it; a dialog or the pause holds it). */
  wait(s) { return new Promise((res) => { const B = this.gb; if (!B || this.done) return res(); (B.waits = B.waits || []).push({ t: this.t + s, res }); }); },
};
