// The Grand Ballroom, the Act 1 boss (docs/design/act1.md "The boss fight"): the masquerade, then
// the fight. Masked guests fill the dance floor, impostor Supergirls among them; the Puzzle Maker is
// one of the guests, and every lieutenant she unmasked gave up one thing about his costume. Accuse
// the wrong guest: a trap. Unmask him: he takes the DJ booth, four kryptonite emitters light up round
// the floor (each guarded, each locked with a riddle), and the closer she gets to a live one the
// weaker she is. Knock them all out and take him down. Losing, anywhere in here, means the stage:
// the crowd heckles while she struggles, and again, and again, until she breaks free. Mixed into
// HotelZone.prototype.
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV } from '../zonekit.js';
import { LIEUTENANTS, MASQ, LOCKS, HECKLES, ACT1 } from '../act/act1.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, nextClip } from '../club3d/clips.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { npcLook } from '../art.js';
import { pick, shuffle, rand, chance, $ } from '../util.js';
import { HERO } from '../data.js';

const B = { guests: 18, impostors: 4, krypt: { reach: 7, rate: 3.2, fall: 6, surge: 35 }, booth: new THREE.Vector3(0, 0, -66.2) };
const EMITTERS = [[-8, -51.5], [8, -51.5], [-8, -60.5], [8, -60.5]];
const MASK_COL = { gold: 0xd8b040, silver: 0xc8ccd8, black: 0x141018, red: 0xc8102e };
const TAUNTS = ['Every piece in its place, Supergirl. Even you.', 'You were always the centrepiece.', 'Lovely of you to come in costume.', 'Shall we play again?', 'The crowd adores you. On stage.'];

/** Words for a guest's costume, one line per attribute. */
function describe(a) {
  return [`a <b>${a.mask} mask</b>`, a.gloves === 'no gloves' ? '<b>bare hands</b>' : `<b>${a.gloves}</b>`, `<b>${a.cane}</b>`, `<b>${a.flower}</b> in the lapel`, `<b>${a.hat}</b>`, a.ring === 'no ring' ? '<b>no ring</b>' : `<b>${a.ring}</b>`].join(', ');
}

export const ballroomMethods = {
  /** The facts she has about him: one per unmasked lieutenant. */
  knownFacts() {
    const A = this.A;
    return LIEUTENANTS.filter((l) => A.unmasked?.[l.id]).map((l) => ({ key: l.fact, value: A.pm[l.fact], who: l.name }));
  },

  startBallroom() {
    const A = this.A;
    this.ball = { phase: 'masq', guests: [], emitters: [], krypt: 0, loops: 0, tauntT: 6, pm: null, used: [] };
    if (this.kell) { this.kell.mesh.visible = false; this.kell.cone.visible = false; } // (he's in the ballroom's back room: the ending)
    this.alert = 0;
    // the guests: everyone in the area of the floor in front of the stage
    const floor = shuffle(this.walkFloor.filter((p) => p.x > -11.5 && p.x < 11.5 && p.z > -62.5 && p.z < -49));
    const spots = [];
    for (const p of floor) { if (spots.length >= B.guests + B.impostors) break; if (spots.every((q) => q.distanceTo(p) > 1.7)) spots.push(p.clone()); }
    const known = this.knownFacts().map((f) => f.key), keys = Object.keys(MASQ);
    const differs = (a) => known.filter((k) => a[k] !== A.pm[k]).length >= Math.min(2, known.length) && keys.some((k) => a[k] !== A.pm[k]);
    spots.forEach((p, i) => {
      const imp = i >= B.guests, pm = i === 3;
      let attrs = null;
      if (pm) attrs = { ...A.pm };
      else if (!imp) for (let tries = 0; tries < 60 && (!attrs || !differs(attrs)); tries++) { attrs = {}; for (const k of keys) attrs[k] = pick(MASQ[k].values); }
      const g = this.makeGuest(p, attrs, imp);
      this.ball.guests.push(g);
      if (pm) this.ball.pm = g;
    });
    sfx.win();
    banner('THE MASQUERADE', 'Find the Puzzle Maker', '#c050ff');
    const facts = this.knownFacts().map((f) => `<div class="item">${MASQ[f.key].say(f.value)} <small>(${f.who})</small></div>`).join('');
    setTimeout(() => { if (this.ball && !this.done) dialog({ title: 'What his people told you', text: `<div class="list">${facts}</div><span class="hint">Walk up to a guest and look closer (USE). When you're sure, unmask him. The impostor Supergirls are just there to rub it in.</span>` }); }, 900);
  },

  /** A masked guest (a suit or a gown, the mask in its colour, hat, cane and flower as rolled). */
  makeGuest(p, a, imp) {
    let look;
    if (imp) look = { skin: '#f0c8a8', hair: '#d8b040', hairStyle: 'long', top: '#2f5ed0', skirt: '#c81e2a', boots: '#c81e2a' };
    else if (chance(0.7)) look = { ...npcLook('civilian'), top: pick(['#141018', '#141018', '#f2f0ea', '#2a2a5a', '#4a1430']), bottom: '#141018', skirt: null, hairStyle: pick(['short', 'slick', 'short']) };
    else look = { ...npcLook('civilian'), gown: true, top: pick(['#c81e5a', '#5a1e8a', '#141018', '#d8b040']), hairStyle: 'long' };
    const mesh = this.makeNPC(look);
    mesh.position.copy(p);
    mesh.rotation.y = rand(0, Math.PI * 2);
    const add = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); mesh.add(m); return m; };
    const mask = add(new THREE.BoxGeometry(0.3, 0.1, 0.06), imp ? 0xc81e2a : MASK_COL[a.mask], 0, 1.84, 0.12);
    if (a && a.hat === 'a top hat') { add(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 12), 0x141018, 0, 2.06, 0); add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), 0x141018, 0, 1.94, 0); }
    if (a && a.cane === 'a cane') add(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6), 0x2a1a10, 0.3, 0.48, 0.1);
    if (a && a.flower !== 'a bare lapel') add(new THREE.SphereGeometry(0.05, 8, 6), a.flower === 'a red carnation' ? 0xd8122e : 0xf8f4f0, 0.1, 1.48, 0.16);
    const g = { mesh, attrs: a, imp, mask, done: false, base: p.clone(), ph: rand(0, 6) };
    this.anims.push((t) => { if (this.ball?.phase === 'masq' && !g.done) { mesh.rotation.y += Math.sin(t * 0.8 + g.ph) * 0.004; mesh.position.y = Math.abs(Math.sin(t * 4 + g.ph)) * 0.04; } });
    this.addInter(p, imp ? 'Look closer: a "Supergirl"' : 'Look closer: a masked guest', () => this.ball?.phase === 'masq' && !g.done, () => this.examineGuest(g), 'guest');
    return g;
  },

  async examineGuest(g) {
    if (g.imp) { await dialog({ title: 'Another you', text: 'Tube top, vinyl skirt, a blonde wig and a red mask. She blows you a kiss. "Love your work, babe."' }); return; }
    const facts = this.knownFacts().map((f) => `${MASQ[f.key].label}: ${f.value}`).join(' · ');
    const v = await dialog({ title: 'A masked guest', text: `${describe(g.attrs)}.<span class="hint">What you know about him: ${facts}</span>`, options: [{ label: 'Unmask him!', value: true, cls: 'risky' }, { label: 'Move on', value: false }] });
    if (!v || this.ball.phase !== 'masq') return;
    g.done = true;
    if (g === this.ball.pm) return this.unmaskPM();
    // the wrong guest: a henchman under the mask, and the trap was set for exactly this
    g.mask.visible = false;
    sfx.lose();
    const s = this.screenOf(g.mesh.position, 2.1);
    if (s) comic.say('Wrong piece, sweetheart!', s.x, s.y, { kind: 'shout', speaker: 'GUEST' });
    const free = await struggle({ clip: nextClip(CLIPS.captive), title: 'WRONG GUEST!', text: 'He grabs your wrists and the crowd closes in. Somewhere, the Puzzle Maker is laughing.', diff: this.sensT > 0 ? 'hard' : 'normal' });
    if (free) { banner('FREE!', 'Back into the crowd', '#3ee08a'); this.grace = this.t + 2; return; }
    await this.stageCapture('The crowd hands you up onto the stage.');
  },

  async unmaskPM() {
    const pm = this.ball.pm;
    pm.mask.visible = false;
    sfx.win(); flash('#39ff6a');
    banner('UNMASKED!', ACT1.boss, '#39ff6a');
    await dialog({ title: ACT1.boss, cls: 'villain', speaker: 'The Puzzle Maker', text: '"Well done. Truly. Every clue in its place." He doesn\'t run. He steps back toward the stage and snaps his fingers. Four pylons rise out of the dance floor, glowing green. "But a puzzle is no fun if it ends on the first move."<span class="hint">Four kryptonite emitters. The closer you are to a live one, the weaker you get. Each is guarded and locked with a riddle. Shut them all down, then take him at the DJ booth.</span>' });
    this.ballFight();
  },

  /** The fight: him at the booth, the four emitters, their guards; the crowd backs off to the walls. */
  ballFight() {
    const b = this.ball;
    b.phase = 'fight';
    const pm = b.pm;
    pm.mesh.position.copy(B.booth); pm.mesh.rotation.y = 0; pm.mask.visible = false;
    for (const g of b.guests) {
      if (g === pm) continue;
      g.done = true;
      const side = g.mesh.position.x < 0 ? -1 : 1;
      g.mesh.position.set(side * rand(11.5, 12.8), 0, rand(-62, -48));
      g.mesh.rotation.y = -side * Math.PI / 2;
    }
    const locks = shuffle([...LOCKS]);
    b.emitters = EMITTERS.map(([x, z], i) => {
      const p = new THREE.Vector3(x, 0, z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 8), new THREE.MeshLambertMaterial({ color: 0x1a1018 }));
      ped.position.set(x, 0.45, z); this.scene.add(ped);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0x39ff6a, toneMapped: false }));
      crystal.position.set(x, 1.45, z); this.scene.add(crystal);
      const halo = new THREE.Mesh(new THREE.RingGeometry(B.krypt.reach - 0.2, B.krypt.reach, 48), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2; halo.position.set(x, 0.03, z); this.scene.add(halo);
      this.colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5, mesh: ped });
      const e = { p, crystal, halo, on: true, lock: locks[i % locks.length], guard: null };
      this.anims.push((t) => { if (e.on) { crystal.rotation.y = t * 1.6; crystal.position.y = 1.45 + Math.sin(t * 2.2 + i) * 0.08; halo.material.opacity = 0.1 + 0.06 * Math.sin(t * 4 + i); } });
      e.guard = this.emitterGuard(p, i);
      this.addInter(p.clone().add(new THREE.Vector3(0, 0, 1.1)), 'Shut down the emitter', () => e.on && this.ball?.phase === 'fight', () => this.shutEmitter(e), 'emitter');
      return e;
    });
    this.addInter(B.booth.clone().add(new THREE.Vector3(0, 0, 1.4)), `Take down ${ACT1.boss}`, () => this.ball?.phase === 'fight', () => this.takedown(), 'boss');
    this.grace = this.t + 3;
    banner('THE FIGHT', 'Shut down the emitters', '#ff2a5a');
  },

  /** A guard walking a short beat by an emitter (the guards' cones: spotted = the alert). */
  emitterGuard(p, i) {
    const mesh = this.makeGuard();
    const a = p.clone().add(new THREE.Vector3(i % 2 ? -2.6 : 2.6, 0, 1.8)), c = p.clone().add(new THREE.Vector3(i % 2 ? -2.6 : 2.6, 0, -1.8));
    mesh.position.copy(a);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.y = 0.06;
    mesh.add(cone);
    const gd = { mesh, cone, route: [a, c], wp: 1, ko: false, look: 0, seeing: false, t: rand(0, 3) };
    this.guards.push(gd);
    return gd;
  },

  async shutEmitter(e) {
    if (e.guard && !e.guard.ko && e.guard.mesh.position.distanceTo(e.p) < 4.5) {
      await dialog({ title: 'The emitter', text: 'His guard is standing right over it.<span class="hint">Take the guard down first: PUNCH from behind, out of his cone.</span>' });
      return;
    }
    const L = e.lock;
    const v = await dialog({ title: 'The emitter\'s lock', speaker: ACT1.boss, text: `A keypad of jigsaw pieces, and a riddle etched round the crystal: “${L.q}”`, options: [...shuffle([L.a, ...L.wrong]).map((a) => ({ label: a, value: a })), { label: 'Step back', value: null }] });
    if (!v) return;
    if (v !== L.a) {
      sfx.lose(); flash('#39ff6a');
      this.ball.krypt = Math.min(100, this.ball.krypt + B.krypt.surge);
      toast('Wrong! The crystal flares: kryptonite surge.', 'bad');
      return;
    }
    e.on = false;
    e.crystal.visible = false; e.halo.visible = false;
    sfx.hit(); flash('#ffffff');
    const s = this.screenOf(e.p, 1.5);
    if (s) this.g.commentary.hit(s.x, s.y, { big: true });
    const left = this.ball.emitters.filter((q) => q.on).length;
    banner(left ? 'EMITTER DOWN!' : 'ALL EMITTERS DOWN!', left ? `${4 - left}/4` : 'Get him!', '#3ee08a');
  },

  async takedown() {
    const b = this.ball, left = b.emitters.filter((e) => e.on).length;
    if (left) {
      await dialog({ speaker: ACT1.boss, text: `"Not while ${left} of my little lights are still on, dear." The kryptonite pulls at you; you can barely lift your arms.<span class="hint">Shut down every emitter first (${4 - left}/4).</span>` });
      return;
    }
    this.busy = true;
    await dialog({ title: ACT1.boss, cls: 'villain', speaker: 'The Puzzle Maker', text: '"You can\'t arrest an idea, Supergirl. The drug, the photos, the doubt in every face out there… I only had to cut the pieces. The city put them together."', options: [{ label: '"Then I\'ll take the man who cut them."', value: true }] });
    if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.6; }
    sfx.hit(); flash('#ffffff');
    const pm = b.pm.mesh, s = this.screenOf(pm.position, 1.8);
    if (s) this.g.commentary.hit(s.x, s.y, { big: true });
    pm.rotation.x = -Math.PI / 2; pm.position.y = 0.2;
    banner('PUZZLE SOLVED!', `${ACT1.boss} is down`, '#3ee08a');
    await new Promise((r) => setTimeout(r, 1400));
    await dialog({ title: 'And Dr Kell', text: `In the ballroom's back room you find Dr Kell stuffing notebooks into a briefcase marked <b>KRYPTONIAN DATA</b>. He reaches for his ray. You're faster.<span class="hint">The police are on their way up.</span>` });
    this.done = true;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    sfx.win();
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: 0 }), 600);
  },

  /**
   * Losing in the ballroom: the stage. The crowd heckles, a clip of her held plays while she
   * struggles; fail and it starts again (worse heckling each time, a new clip, a little more of
   * her reputation), until she breaks free. No mercy: the struggle never gets easier.
   */
  async stageCapture(reason) {
    const b = this.ball;
    if (!b || b.onStage) return;
    b.onStage = true;
    this.busy = true;
    this.setXray(false);
    this.alert = 0;
    for (const gd of this.guards) { gd.look = 0; gd.seeing = false; }
    this.hero.position.set(0, 0, -64.6);
    this.hero.rotation.y = 0; this.yaw = -Math.PI; this.camPitch = null; this._lastGood = null;
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    flash('#ff3fb8'); sfx.trap();
    banner('ON STAGE', 'The masquerade\'s main event', '#ff3fb8');
    for (;;) {
      b.loops++;
      const tier = Math.min(HECKLES.length - 1, Math.floor((b.loops - 1) / 2));
      this.heckle(HECKLES[tier]);
      await new Promise((r) => setTimeout(r, 1700));
      if (this.g.mode !== this) return;
      const free = await struggle({ clip: nextClip(CLIPS.shame), title: b.loops > 1 ? `ON STAGE · ${b.loops}` : 'ON STAGE', text: `${b.loops === 1 ? reason + ' ' : ''}"${pick(HECKLES[tier])}" The whole room is watching.`, diff: 'hard' });
      if (this.g.mode !== this) return;
      if (free) break;
      this.g.state.addRep(-4, 'On stage at the masquerade');
    }
    sfx.win(); banner('FREE!', b.phase === 'fight' ? 'Back into the fight' : 'Back into the crowd', '#3ee08a');
    b.krypt = 0;
    this.g.state.intox = Math.min(this.g.state.intox, 60);
    this.heroClip('getUp', 1.6);
    this.grace = this.t + 3;
    b.onStage = false;
    this.busy = false;
  },

  /** The crowd's comments, as shouts round the screen. */
  heckle(lines) {
    const W = this.g.w, H = this.g.h;
    shuffle([...lines]).slice(0, 3).forEach((l, i) => setTimeout(() => comic.say(l, W * (0.22 + 0.28 * i), H * (0.35 + 0.15 * (i % 2)), { kind: 'shout', speaker: 'CROWD', ms: 2200 }), i * 420));
  },

  updateBallroom(dt) {
    const b = this.ball;
    if (b.onStage) return;
    if (b.phase === 'fight') {
      // kryptonite: stronger the closer she is to a live emitter
      const h = this.hero.position;
      let k = 0;
      for (const e of b.emitters) if (e.on) { const d = e.p.distanceTo(h); if (d < B.krypt.reach) k += (B.krypt.reach - d) * B.krypt.rate; }
      b.krypt = k ? Math.min(100, b.krypt + k * dt) : Math.max(0, b.krypt - B.krypt.fall * dt);
      if (b.krypt >= 100) { this.stageCapture('The kryptonite takes your legs out from under you.'); return; }
      if ((b.tauntT -= dt) <= 0) {
        b.tauntT = rand(8, 13);
        const s = this.screenOf(b.pm.mesh.position, 2.2);
        if (s && s.x > 0 && s.x < this.g.w) comic.say(pick(TAUNTS), s.x, s.y, { speaker: 'THE PUZZLE MAKER' });
      }
    }
  },

  ballObjectives() {
    const b = this.ball;
    if (b.phase === 'masq') {
      const facts = this.knownFacts().map((f) => f.value).join(', ');
      return [
        { t: `Find the Puzzle Maker in the crowd: ${facts}`, done: false, target: null },
        { t: 'Look closer at a guest (USE), then unmask him', done: false, final: true, target: null },
      ];
    }
    const on = b.emitters.filter((e) => e.on);
    const near = on.sort((a, c) => a.p.distanceTo(this.hero.position) - c.p.distanceTo(this.hero.position))[0];
    return [
      { t: `Shut down the kryptonite emitters (${4 - on.length}/4)`, done: !on.length, target: near?.p },
      { t: `Take down ${ACT1.boss} at the DJ booth`, done: false, final: true, target: B.booth },
    ];
  },

  ballHud() {
    const b = this.ball, al = $('b-alert'), lbl = $('h13-meter');
    if (lbl) lbl.textContent = b.phase === 'fight' ? 'Kryptonite' : 'Guard alert';
    if (al) { al.style.width = (b.phase === 'fight' ? Math.max(b.krypt, this.alert) : this.alert) + '%'; al.parentElement.classList.toggle('warn', b.krypt > 60 || this.alert > 60); }
    $('hud-sub').textContent = [b.phase === 'masq' ? 'The masquerade' : 'The fight', b.loops ? `On stage ${b.loops}×` : '', this.xray ? 'X-RAY' : ''].filter(Boolean).join(' · ');
  },

  /** tools/shots/act.js: straight to the ballroom (and its fight). */
  debugBallroom(phase) {
    if (!this.ball) { this.openBallroom(); this.hero.position.set(0, 0, -48.5); this.yaw = 0; this.hero.rotation.y = Math.PI; this.camPitch = null; }
    if (phase === 'fight' && this.ball.phase === 'masq') { this.ball.pm.done = true; this.ballFight(); this.hero.position.set(0, 0, -48.5); }
  },
};
