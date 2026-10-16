// The Act 2 boss (job H2; docs/design/act2.md "The hotel's new floor and the boss"): Supergurl, behind the
// sealed door, in a room of mirrors. The fight is built around the drug, on the shape of Act 1's ballroom
// (src/hotel/ballroom.js: phases, the struggle, a meter):
//   * coat: she fights in the long black coat and the red mask; her Super Squirt kisses, her strikes and the
//     floor vents all raise intoxication; three hits and the coat and mask come off (the reveal);
//   * suit: Supergirl's stolen original underneath; as intoxication climbs the mirrors multiply her
//     (reflections that mimic her, everything on them backwards); punch a reflection = glass + a dose;
//   * over the haze line: she hides among them and Supergirl has to pick her out (the call: tap the real one);
//     right = a hit, wrong = held (the S-shield struggle);
//   * haze: the last phase is fought high: two right calls take her down.
// One exchange of insults per phase (lines.js). Every captive moment hands control back and moves the fight on.
// Mixed into MirrorsZone.prototype (after its class body: these override bossDoor and capture).
import * as THREE from 'three';
import { makeGurl, Gurl, reflection, setPlane, reflectPoint } from './gurl.js';
import { EXCHANGES, TAUNTS, COMEBACKS, CAPTIVE, CALL, ENDING } from './lines.js';
import { BOSS_W, DOORGAP } from './bossroom.js';
import { VIOLET_CSS } from './art.js';
import { HotelZone } from '../hotel/hotel.js';
import { struggle } from '../club3d/struggle.js';
import { CLIPS, clipsReady, nextClip } from '../club3d/clips.js';
import { dialog, toast, banner, flash } from '../ui.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';
import { showNewspaper } from '../newspaper.js';
import { quality } from '../settings.js';
import { lightPool } from '../look3d.js';
import { INTOX_HAZE } from '../state.js';
import { pick, rand, shuffle, clamp, $ } from '../util.js';
import { PIECES, FINDS } from '../act/act2.js';

export const FIGHT = {
  hp: { coat: 3, suit: 3, haze: 2 },
  ring: 4.2, speed: 2.6,
  kiss: { every: [3, 4.8], speed: 5.5, life: 2.6, hit: 0.9, dose: 10 },
  melee: { reach: 2.1, wind: 0.5, land: 1.7, dose: 8, push: 1.8 },
  vent: { n: 3, cycle: 6, on: 1.7, r: 1.1, rate: 20 },
  reach: 1.9, shard: 6, callEvery: 6,
  decoys: { full: 5, mid: 3, min: 2 },
};
const PINK = 0xff3fb8;
const HAZE_FLOOR = INTOX_HAZE + 10; // (the haze phase is fought high)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** ?act=act2boss&zone=mirrors: straight into the fight. */
export const debugBossWanted = () => { const q = new URLSearchParams(location.search); return q.get('zone') === 'mirrors' && q.get('act') === 'act2boss'; };

export const bossMethods = {
  // ---------------------------------------------------------------- the door
  /** The seal's collider (the gap behind it is open in the building); the room's data. */
  placeBossRoom() {
    const z = this.club.ante.z0;
    this.sealCol = { minX: -DOORGAP / 2, maxX: DOORGAP / 2, minZ: z - 0.15, maxZ: z + 0.25, wall: true };
    this.colliders.push(this.sealCol);
    this.boss = null;
    this.bossOpen = false;
  },

  /** Ready: the act says so (bossReady), or the floor taught her to tell them apart (both rails, 3 portraits). */
  bossCanOpen() {
    const B = this.g.act?.two?.B;
    if (!B) return false;
    if (B.bossReady) return true;
    const loaded = this.portraits.filter((p) => p.canvas).length;
    if (B.lairOpen && this.rails.every((L) => L.solved) && this.called >= Math.min(3, loaded)) { B.bossReady = true; this.g.state.save(); return true; }
    return false;
  },

  async bossDoor() {
    if (this.bossOpen) return;
    const first = !this.reached;
    this.reached = true;
    if (!this.bossCanOpen()) {
      if (first) { sfx.alarm(); flash(VIOLET_CSS); this.g.state.save(); }
      await dialog({
        title: 'The sealed door', cls: 'villain',
        text: `A mirror the size of a door, your S cracked across it, and no handle on this side. Through the glass, a voice like yours, but sweeter:<div class="h13-note">“Not yet, little copy. Come back when you can tell us apart.”<i>— Supergurl</i></div><span class="hint">Check both rails (Which one is hers?) and call three portraits on this floor, then come back.</span>`,
      });
      return;
    }
    await dialog({ title: 'The sealed door', cls: 'villain', text: 'Your hand on the glass. The crack in the S lights up, purple, and the whole mirror slides up into the ceiling.<div class="h13-note">“Come in, little copy. Let\'s see which one of us walks out.”<i>— Supergurl</i></div>' });
    this.openSeal();
  },

  openSeal() {
    if (this.bossOpen) return;
    this.bossOpen = true;
    this.sealCol.disabled = true;
    sfx.door(); flash(VIOLET_CSS);
    const m = this.sealMesh, y0 = m.position.y;
    let k = 0;
    this.anims.push((t, dt) => { if (k < 1) { k = Math.min(1, k + dt * 1.2); m.position.y = y0 + k * 2.9; } });
    this.boss = { phase: 'wait', started: false, ready: this.loadGurl() };
  },

  /** Supergurl (the hero model + the coat), her twins in the side mirrors, and her reflections (decoys). */
  async loadGurl() {
    let gurl = await makeGurl().catch((e) => { console.warn('Supergurl model failed', e); return null; });
    if (!this.scene) return;
    if (!gurl) { // (no model: a plain figure in black, a red face)
      const npc = this.makeNPC({ skin: '#f0c8a8', hair: '#141018', hairStyle: 'long', top: '#141018', bottom: '#141018', skirt: null, boots: '#0a0a0c', gown: true });
      const g = new THREE.Group(); g.add(npc); npc.position.set(0, 0, 0);
      gurl = new Gurl(g, null, [], null);
    }
    const b = this.boss, R = this.club.boss;
    b.gurl = gurl;
    gurl.pos.set(0, 0, R.z0 + 2.4); gurl.group.rotation.y = 0;
    gurl.play('combatIdle');
    const pool = lightPool(0xff2a4a, 1.5, 0.45); pool.position.y = 0.025; gurl.group.add(pool); // (red light at her feet: she reads in the dark)
    this.scene.add(gurl.group);
    const q = quality().look3d;
    b.side = []; b.decoys = [];
    if (q !== 'min') for (const src of [this.hero, gurl.group]) for (const s of [-1, 1]) { const t = reflection(src, new THREE.Vector3(s * BOSS_W, 0, 0), 0); Object.assign(t, { src, s }); this.scene.add(t.holder); b.side.push(t); }
    b.sideAll = q === 'full'; // (else only the twin in the nearer wall)
    const n = FIGHT.decoys[q === 'full' ? 'full' : q === 'min' ? 'min' : 'mid'];
    const ink = []; gurl.group.traverse((o) => { if (o.userData.ink) ink.push(o); }); // (reflections skip the ink hulls: half the triangles)
    for (let i = 0; i < n; i++) { const t = reflection(gurl.group, R.c, 0, ink); t.holder.visible = false; t.off = 0; this.scene.add(t.holder); b.decoys.push(t); }
    this.rollPlanes();
  },

  /** New angles for the reflections' planes (after every captive moment: the room has changed). */
  rollPlanes() {
    const b = this.boss, n = b.decoys.length, j = rand(0, Math.PI / n);
    b.decoys.forEach((t, i) => setPlane(t, this.club.boss.c, j + (i * Math.PI) / n + 0.15));
  },

  async startBoss() {
    const b = this.boss;
    b.started = true; b.phase = 'intro';
    this.busy = true;
    await b.ready;
    if (!this.scene || this.g.mode !== this) return;
    for (const k of this.hunters) k.stun = 1e9; // (the robes stay outside)
    const R = this.club.boss;
    Object.assign(b, { hp: FIGHT.hp.coat, st: 0, ai: 'pose', wp: 0, kissT: 3, tauntT: 6, callT: FIGHT.callEvery, pinned: 0, hits: 0, captures: 0, fails: 0, right: 0, wrong: 0, kisses: [], vents: [], said: {}, captive: false, n: 0 });
    this.placeVents();
    this.hero.position.set(0, 0, R.z1 - 1.6); this.hero.rotation.y = Math.PI; this.yaw = 0; this.camPitch = null; this._lastGood = null;
    sfx.alarm();
    banner('SUPERGURL', 'The cult\'s leader, in your stolen suit', '#ff2a5a');
    await wait(900);
    await this.exchange('door');
    if (this.g.mode !== this) return;
    b.phase = 'coat'; b.fighting = true;
    this.grace = this.t + 2;
    this.busy = false;
    toast('Punch her (PUNCH, up close). Her pink kisses and the floor vents are Super Squirt: keep moving.', 'info');
  },

  /** One exchange: her line, then Supergirl's answer as the button (hazier when she's high). */
  async exchange(id) {
    const E = EXCHANGES[id], high = this.g.state.intox >= INTOX_HAZE;
    if (this.boss) this.boss.said[id] = true;
    let last = '';
    for (const L of E.lines) {
      last = high && L.h ? L.h : L.s;
      await dialog({ title: E.title, cls: 'villain', speaker: 'Supergurl', text: `“${L.g}”`, options: [{ label: `“${last}”`, value: true }] });
      if (this.g.mode !== this) return;
    }
    const s = this.screenOf(this.hero.position, 2.1);
    if (s) comic.say(last, s.x, s.y, { speaker: 'SUPERGIRL', ms: 2200 });
  },

  // ---------------------------------------------------------------- the room's traps
  placeVents() {
    const b = this.boss, c = this.club.boss.c;
    for (const v of b.vents) { this.scene.remove(v.ring, v.cloud); }
    b.vents = [];
    for (let i = 0; i < FIGHT.vent.n; i++) {
      const a = rand(0, Math.PI * 2) + (i * Math.PI * 2) / FIGHT.vent.n, r = rand(1.6, 3.6);
      const p = new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
      const ring = new THREE.Mesh(new THREE.RingGeometry(FIGHT.vent.r - 0.12, FIGHT.vent.r, 28), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.03, p.z);
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(FIGHT.vent.r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false }));
      cloud.position.copy(p); cloud.visible = false;
      this.scene.add(ring, cloud);
      b.vents.push({ p, ring, cloud, ph: i * FIGHT.vent.cycle / FIGHT.vent.n });
    }
  },

  /** A kiss of Super Squirt blown at her: a pink puff that flies straight; dodge it. */
  kiss() {
    const b = this.boss, g = b.gurl.pos, h = this.hero.position;
    const dir = new THREE.Vector3(h.x - g.x, 0, h.z - g.z).normalize();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false }));
    m.position.set(g.x + dir.x * 0.6, 1.3, g.z + dir.z * 0.6);
    this.scene.add(m);
    b.kisses.push({ m, dir, life: FIGHT.kiss.life });
    b.gurl.play('excited', { fade: 0.15 });
    sfx.whoosh?.();
    const s = this.screenOf(g, 2.2);
    if (s) comic.say(pick(['Mwah!', 'Have a taste.', 'Open wide, babe.']), s.x, s.y, { speaker: 'SUPERGURL', ms: 1300 });
  },

  /** A dose: intoxication up, a pink flash. */
  dosed(n, why) {
    const st = this.g.state;
    st.addIntox(n);
    flash('#ff3fb8');
    if (why) { const s = this.screenOf(this.hero.position, 2.0); if (s) comic.say(why, s.x, s.y, { kind: 'shout', speaker: 'POW', ms: 900 }); }
  },

  // ---------------------------------------------------------------- per frame
  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const R = this.club.boss, h = this.hero.position;
    if (!b.started && h.z < R.z1 - 1.0) this.startBoss();
    const gurl = b.gurl;
    if (!gurl) return;
    gurl.update(dt);
    // the side mirrors: anyone in the room has a twin in the glass
    for (const t of b.side || []) { t.holder.visible = t.src.visible && t.src.position.z < R.z1 + 0.5 && (b.sideAll || t.s * t.src.position.x >= 0); if (t.holder.visible) t.sync(); }
    this.updateDecoys(dt);
    if (!b.fighting || b.phase === 'down') return;
    if (this.busy) return;
    this.updateGurl(dt);
    // the kisses
    for (const k of [...b.kisses]) {
      k.life -= dt;
      k.m.position.addScaledVector(k.dir, FIGHT.kiss.speed * dt);
      k.m.scale.setScalar(1 + (FIGHT.kiss.life - k.life) * 0.5);
      if (Math.hypot(k.m.position.x - h.x, k.m.position.z - h.z) < FIGHT.kiss.hit) { this.dosed(FIGHT.kiss.dose, 'Squirt!'); k.life = 0; }
      if (k.life <= 0) { this.scene.remove(k.m); b.kisses.splice(b.kisses.indexOf(k), 1); }
    }
    // the vents: a puff every few seconds; standing in one = a dose a second
    for (const v of b.vents) {
      const ph = (this.t + v.ph) % FIGHT.vent.cycle, on = ph > FIGHT.vent.cycle - FIGHT.vent.on, warn = ph > FIGHT.vent.cycle - FIGHT.vent.on - 1;
      v.cloud.visible = on; v.cloud.material.opacity = on ? 0.35 : 0;
      v.ring.material.opacity = on ? 0.7 : warn ? 0.35 + 0.3 * Math.sin(this.t * 18) : 0.25;
      if (on && Math.hypot(v.p.x - h.x, v.p.z - h.z) < FIGHT.vent.r) this.g.state.addIntox(FIGHT.vent.rate * dt);
    }
    // the call: over the haze line she hides among her reflections
    const high = this.g.state.intox >= INTOX_HAZE;
    if ((b.phase === 'haze' || (b.phase === 'suit' && high)) && b.pinned <= 0 && (b.callT -= dt) <= 0) { this.mirrorCall(); return; }
    if (b.phase === 'suit' && !b.said.mirrors && this.decoysUp() > 0) { this.busy = true; this.exchange('mirrors').finally(() => { this.busy = false; }); return; }
    // the back-and-forth while they fight
    if ((b.tauntT -= dt) <= 0) {
      b.tauntT = rand(7, 11);
      const key = b.phase === 'coat' ? 'coat' : b.phase === 'haze' || high ? 'haze' : 'suit';
      const s = this.screenOf(gurl.pos, 2.2);
      if (s && s.x > 0 && s.x < this.g.w) comic.say(pick(TAUNTS[key]), s.x, s.y, { speaker: 'SUPERGURL', ms: 2000 });
      setTimeout(() => { if (this.boss?.fighting && !this.busy) { const q = this.screenOf(this.hero.position, 2.1); if (q) comic.say(pick(COMEBACKS[key]), q.x, q.y, { speaker: 'SUPERGIRL', ms: 1800 }); } }, 1700);
    }
  },

  /** Her moves: round the ring, a pose, then a kiss from range or a strike up close. */
  updateGurl(dt) {
    const b = this.boss, g = b.gurl, c = this.club.boss.c, h = this.hero.position;
    const face = (p) => { g.group.rotation.y = Math.atan2(p.x - g.pos.x, p.z - g.pos.z); };
    const dH = Math.hypot(h.x - g.pos.x, h.z - g.pos.z);
    if (b.pinned > 0) { b.pinned -= dt; return; }
    b.kissT -= dt;
    if (b.ai === 'move') {
      const to = new THREE.Vector3(c.x + Math.cos(b.wp) * FIGHT.ring, 0, c.z + Math.sin(b.wp) * FIGHT.ring);
      const d = to.clone().sub(g.pos); d.y = 0;
      const L = d.length(), step = FIGHT.speed * (b.phase === 'coat' ? 0.85 : 1) * dt;
      if (L < step + 0.05) { b.ai = 'pose'; b.st = rand(0.5, 1.1); g.play('combatIdle', { fade: 0.2 }); }
      else { g.pos.addScaledVector(d, step / L); face(to); g.play('run', { fade: 0.2 }); }
      if (dH < FIGHT.melee.reach) { b.ai = 'wind'; b.st = FIGHT.melee.wind; face(h); g.play('punch', { fade: 0.08, restart: true, from: 1.0 }); }
      return;
    }
    if (b.ai === 'pose') {
      face(h);
      if ((b.st -= dt) > 0) return;
      if (dH < FIGHT.melee.reach) { b.ai = 'wind'; b.st = FIGHT.melee.wind; g.play('punch', { fade: 0.08, restart: true, from: 1.0 }); return; }
      if (b.kissT <= 0) { b.kissT = rand(...FIGHT.kiss.every) * (b.phase === 'haze' ? 1.25 : 1); this.kiss(); }
      b.ai = 'move'; b.wp = Math.atan2(h.z - c.z, h.x - c.x) + rand(-1.6, 1.6);
      return;
    }
    if (b.ai === 'wind') {
      face(h);
      if ((b.st -= dt) > 0) return;
      if (dH < FIGHT.melee.land) {
        const st = this.g.state;
        this.dosed(FIGHT.melee.dose, 'SMACK!');
        sfx.hit();
        const away = new THREE.Vector3(h.x - g.pos.x, 0, h.z - g.pos.z).normalize();
        h.addScaledVector(away, FIGHT.melee.push); this.collide(h, 0.38);
        if (st.intox >= 70 && b.phase !== 'coat' && Math.random() < 0.35) { this.bossCaptive('grab'); return; }
      }
      b.ai = 'move'; b.wp += rand(1.2, 2.4) * (Math.random() < 0.5 ? -1 : 1);
    }
  },

  /** How many reflections the haze shows (more as intoxication climbs; all of them in the haze phase). */
  decoysUp() {
    const b = this.boss, n = b.decoys?.length || 0;
    if (!b.fighting || b.phase === 'down') return 0;
    if (b.phase === 'haze') return n;
    const k = clamp((this.g.state.intox - 15) / 45, 0, 1);
    return Math.min(n, Math.floor(n * k + (b.phase === 'suit' ? 0.5 : 0)));
  },

  updateDecoys(dt) {
    const b = this.boss;
    if (!b.decoys) return;
    const n = this.decoysUp(), flick = 5 * (1 - clamp(this.g.state.intox / 100, 0, 0.9)); // (the drug steadies them: harder to tell)
    b.decoys.forEach((t, i) => {
      t.off = Math.max(0, t.off - dt);
      const on = i < n && t.off <= 0 && !b.calling;
      t.holder.visible = on && !(Math.random() < flick * dt);
      if (on) t.sync();
    });
  },

  // ---------------------------------------------------------------- her punch
  /** PUNCH in the fight: auto-aims at the nearest of her and the reflections in reach. True if handled. */
  bossPunch() {
    const b = this.boss;
    if (!b?.fighting || b.phase === 'down' || this.busy) return false;
    const h = this.hero, g = b.gurl.pos, c = this.club.boss.c;
    this.punchT = 0.25;
    if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
    sfx.whoosh?.();
    const cand = [{ p: g, real: true }];
    b.decoys.forEach((t, i) => { if (t.holder.visible || (i < this.decoysUp() && t.off <= 0)) cand.push({ p: reflectPoint(g, c, t.th), t }); });
    let best = null, bd = FIGHT.reach;
    for (const q of cand) { const d = Math.hypot(q.p.x - h.position.x, q.p.z - h.position.z); if (d < bd) { bd = d; best = q; } }
    if (!best) return true;
    h.rotation.y = Math.atan2(best.p.x - h.position.x, best.p.z - h.position.z);
    if (best.t) { // a reflection: glass, and a dose
      best.t.off = 5; best.t.holder.visible = false;
      sfx.hit(); this.dosed(FIGHT.shard, 'CRASH!');
      toast('Glass! Only a reflection. Look for the one that isn\'t backwards.', 'bad');
      return true;
    }
    if (b.pinned <= 0 && (b.phase === 'haze' || (b.phase === 'suit' && this.g.state.intox >= INTOX_HAZE))) { this.mirrorCall(); return true; }
    this.hitGurl();
    return true;
  },

  /** A hit lands. She reels and steps back into the glass (somewhere else on the ring). */
  hitGurl() {
    const b = this.boss, g = b.gurl;
    b.hits++; b.hp--;
    sfx.hit(); flash('#ffffff');
    const s = this.screenOf(g.pos, 1.8);
    if (s) this.g.commentary.hit(s.x, s.y, { big: b.hp <= 0 });
    b.pinned = 0.7; b.ai = 'move'; b.wp = rand(0, Math.PI * 2);
    g.play('getUp', { fade: 0.1, restart: true });
    if (b.hp > 0) { banner('POW!', `Supergurl ${b.hp} to go`, '#3ee08a'); return; }
    if (b.phase === 'coat') this.revealGurl();
    else if (b.phase === 'suit') this.toHaze();
    else this.finishBoss();
  },

  async revealGurl() {
    const b = this.boss;
    this.busy = true;
    b.phase = 'reveal';
    await wait(500);
    b.gurl.reveal(this.scene);
    sfx.win(); flash('#ff2a5a');
    banner('THE REVEAL', 'Your suit. On her.', '#ff2a5a');
    await wait(1100);
    await this.exchange('reveal');
    if (this.g.mode !== this) return;
    this.dosed(12);
    toast('She blows the last of the Super Squirt off her glove, straight in your face.', 'bad');
    Object.assign(b, { phase: 'suit', hp: FIGHT.hp.suit, callT: 2, ai: 'move' });
    this.busy = false;
    this.grace = this.t + 1.5;
  },

  async toHaze() {
    const b = this.boss;
    this.busy = true;
    b.phase = 'reveal';
    await wait(500);
    const st = this.g.state;
    st.intox = Math.max(st.intox, HAZE_FLOOR);
    flash('#ff3fb8'); sfx.trap();
    banner('THE HAZE', 'Every mirror is her', VIOLET_CSS);
    await this.exchange('haze');
    if (this.g.mode !== this) return;
    Object.assign(b, { phase: 'haze', hp: FIGHT.hp.haze, callT: 2, ai: 'move' });
    this.busy = false;
  },

  // ---------------------------------------------------------------- the call
  /** Freeze; a ring over her and each reflection; tap the real Supergurl (or press 1-n). */
  async mirrorCall() {
    const b = this.boss;
    if (!b || b.calling || b.captive) return;
    b.calling = true; this.busy = true;
    const g = b.gurl.pos, c = this.club.boss.c;
    for (const t of b.decoys) t.off = 0;
    const pts = [{ p: g.clone(), real: true }, ...b.decoys.map((t) => ({ p: reflectPoint(g, c, t.th), t }))];
    const pickN = Math.max(2, Math.min(pts.length, b.phase === 'haze' ? pts.length : 1 + this.decoysUp()));
    const apart = [pts[0]]; // (reflections standing on top of her, or of each other, sit this one out)
    for (const q of shuffle(pts.slice(1))) if (apart.length < pickN && apart.every((o) => o.p.distanceTo(q.p) > 1.2)) apart.push(q);
    if (apart.length < 2) { b.gurl.pos.set(c.x + 2.5, 0, c.z - 1.5); g.copy(b.gurl.pos); apart.push(...pts.slice(1, 2).map((q) => ({ p: reflectPoint(g, c, q.t.th), t: q.t }))); }
    const cand = shuffle(apart);
    for (const t of b.decoys) { const on = cand.some((q) => q.t === t); t.holder.visible = on; if (on) t.sync(); }
    this.callTruth = cand.findIndex((q) => q.real); // (the harness reads it)
    const i = await this.callOverlay(cand.map((q) => this.screenOf(q.p, 1.0)));
    this.callTruth = null;
    b.calling = false;
    b.callT = FIGHT.callEvery;
    const right = i === cand.findIndex((q) => q.real);
    const s = this.screenOf(this.hero.position, 2.1);
    if (right) {
      b.right++;
      sfx.win();
      if (s) comic.say(pick(CALL.right), s.x, s.y, { speaker: 'SUPERGIRL', ms: 1400 });
      const h = this.hero.position, d = new THREE.Vector3(h.x - g.x, 0, h.z - g.z).normalize();
      h.set(g.x + d.x * 1.1, 0, g.z + d.z * 1.1); this.collide(h, 0.38);
      this.hero.rotation.y = Math.atan2(g.x - h.x, g.z - h.z);
      if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
      for (const t of b.decoys) { t.off = 2.5; t.holder.visible = false; }
      this.busy = false;
      this.hitGurl();
      return;
    }
    b.wrong++;
    const q = cand[i];
    if (q?.t) { q.t.off = 4; }
    const gs = this.screenOf(g, 2.2);
    if (gs) comic.say(pick(CALL.wrong), gs.x, gs.y, { speaker: 'SUPERGURL', ms: 1500 });
    this.busy = false;
    await this.bossCaptive('wrong');
  },

  /** The tap targets (HTML over the canvas): numbered rings; resolves the index picked. */
  callOverlay(spots) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'mcall';
      el.style.cssText = 'position:fixed;inset:0;z-index:60;pointer-events:none';
      el.innerHTML = `<div style="position:absolute;left:50%;top:8px;transform:translateX(-50%);max-width:92vw;text-align:center;font:900 22px Impact,'Arial Black',sans-serif;color:#ffd21a;text-shadow:2px 2px 0 #000,-1px -1px 0 #000;letter-spacing:1px">${CALL.title}<div style="font:700 13px system-ui,sans-serif;color:#fff;text-shadow:1px 1px 0 #000;letter-spacing:0">${CALL.hint}</div></div>`;
      const P = spots.map((s, i) => ({ x: s ? s.x : 60 + i * 70, y: s ? s.y : this.g.h / 2 }));
      for (let it = 0; it < 24; it++) for (let i = 0; i < P.length; i++) { // (push overlapping rings apart: thumbs need 64 px)
        for (let j = i + 1; j < P.length; j++) {
          let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
          if (d >= 68) continue;
          if (d < 0.5) { dx = 1; dy = 0.3 * (j - i); }
          const k = (68 - d) / 2 / Math.hypot(dx, dy);
          P[i].x -= dx * k; P[i].y -= dy * k; P[j].x += dx * k; P[j].y += dy * k;
        }
        for (const p of P) { p.x = clamp(p.x, 36, this.g.w - 36); p.y = clamp(p.y, 76, this.g.h - 36); }
      }
      P.forEach(({ x, y }, i) => {
        const bt = document.createElement('button');
        bt.className = 'mc-b'; bt.dataset.i = i;
        bt.style.cssText = `position:absolute;left:${x - 30}px;top:${y - 30}px;width:60px;height:60px;border-radius:50%;border:4px solid #120a16;background:rgba(255,210,26,.28);box-shadow:0 0 0 3px #ffd21a,0 0 16px #ff3fb8;color:#fff;font:900 22px Impact,sans-serif;text-shadow:2px 2px 0 #000;pointer-events:auto;touch-action:manipulation`;
        bt.textContent = String(i + 1);
        bt.addEventListener('click', (e) => { e.stopPropagation(); done(i); });
        el.appendChild(bt);
      });
      const key = (e) => { const n = +e.key; if (n >= 1 && n <= spots.length) { e.preventDefault(); e.stopPropagation(); done(n - 1); } };
      const done = (i) => { removeEventListener('keydown', key, true); el.remove(); resolve(i); };
      addEventListener('keydown', key, true);
      document.body.appendChild(el);
      sfx.alarm();
    });
  },

  // ---------------------------------------------------------------- captive moments
  /** Held (a wrong call, too high, her hold): the S-shield struggle. Either way the fight moves on. */
  async bossCaptive(kind) {
    const b = this.boss;
    if (!b || b.captive || b.phase === 'down') return;
    b.captive = true; this.busy = true;
    this.setXray(false);
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    flash(VIOLET_CSS); sfx.trap();
    const C = CAPTIVE[kind] || CAPTIVE.over, st = this.g.state;
    await clipsReady;
    const free = await struggle({ clip: nextClip(CLIPS.captive), title: C.title, text: C.text, diff: st.intox >= INTOX_HAZE && b.fails < 2 ? 'hard' : 'normal' });
    if (this.g.mode !== this) return;
    b.captures++;
    const floor = b.phase === 'haze' ? HAZE_FLOOR : 40;
    if (free) { sfx.win(); banner('FREE!', 'Back into the glass', '#3ee08a'); b.fails = 0; st.intox = Math.min(st.intox, floor + 8); }
    else {
      b.fails++;
      st.addRep(-3, 'Supergurl\'s Polaroid');
      b.hp = Math.min(FIGHT.hp[b.phase] || 2, b.hp + 1);
      st.intox = floor + 12;
      await dialog({ title: 'IN THE GLASS', cls: 'villain', text: `${pick(CAPTIVE.fail)}<span class="hint">She got a hit back. The mirrors have moved.</span>` });
    }
    // the room changes: Supergirl back by the door, Supergurl elsewhere on the ring, new reflections, new vents
    const R = this.club.boss;
    this.hero.position.set(rand(-1.5, 1.5), 0, R.z1 - 1.6); this.yaw = 0; this.camPitch = null;
    b.gurl.pos.set(R.c.x + rand(-3, 3), 0, R.c.z - rand(1, 3));
    b.ai = 'move'; b.wp = rand(0, Math.PI * 2); b.callT = FIGHT.callEvery; b.kissT = 3;
    for (const k of b.kisses) this.scene.remove(k.m);
    b.kisses = [];
    this.rollPlanes(); this.placeVents();
    this.heroClip('getUp', 1.6);
    this.grace = this.t + 2.5;
    b.captive = false;
    this.busy = false;
  },

  /** Too high (intox 100) in the fight: held; anywhere else on the floor: the dart (HotelZone's). */
  capture(reason) {
    if (this.boss?.fighting) return this.bossCaptive('over');
    return HotelZone.prototype.capture.call(this, reason);
  },

  // ---------------------------------------------------------------- the end
  async finishBoss() {
    const b = this.boss;
    b.phase = 'down'; b.fighting = false;
    this.busy = true;
    for (const t of b.decoys) t.holder.visible = false;
    for (const k of b.kisses) this.scene.remove(k.m);
    for (const v of b.vents) { v.cloud.visible = false; v.ring.visible = false; }
    b.gurl.play('defeated', { fade: 0.2 });
    flash('#ffffff'); sfx.win();
    banner('SUPERGURL IS DOWN!', 'Every reflection shatters', '#3ee08a');
    await wait(1600);
    await this.exchange('end');
    if (this.g.mode !== this) return;
    await dialog({ title: 'Your suit', text: `${ENDING.suit}<span class="hint">The police are on their way up.</span>` });
    this.done = true;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: 0 }), 600);
  },

  // ---------------------------------------------------------------- HUD, objectives, tests
  bossObjectives() {
    const b = this.boss, g = b.gurl?.pos;
    const what = { intro: 'Face Supergurl', coat: 'Take the coat and mask off her (punch)', reveal: 'Supergurl', suit: 'Beat her in your stolen suit', haze: 'Pick the real one out of the reflections', down: 'Supergurl is down' }[b.phase] || 'Supergurl';
    return [
      { t: `${what} (${Math.max(0, b.hp ?? 0)} to go)`, done: b.phase === 'down', target: g || null, final: true },
      { t: 'Super Squirt: her kisses, the pink vents, the glass', done: false },
    ];
  },

  bossHud() {
    const b = this.boss, al = $('b-alert'), lbl = $('hud-extra')?.querySelector('.barlabel span');
    if (lbl) lbl.textContent = 'Supergurl';
    const max = FIGHT.hp[b.phase] || 1;
    if (al) al.style.width = (b.phase === 'down' ? 0 : clamp((b.hp ?? max) / max, 0, 1) * 100) + '%';
    $('hud-sub').textContent = [b.gurl?.coatOn ? 'In the coat' : b.phase === 'haze' ? 'THE HAZE' : 'In your suit', b.right ? `Called ${b.right}/${b.right + b.wrong}` : '', b.captures ? `Held ${b.captures}×` : ''].filter(Boolean).join(' · ');
  },

  /** ?act=act2boss&zone=mirrors and tools/shots/mirrors.js: open the door and walk in. */
  debugBoss() {
    if (!this.boss) { this.g.act?.two?.B && (this.g.act.two.B.bossReady = true); this.openSeal(); }
    this.hero.position.set(0, 0, this.club.boss.z1 - 1.6);
  },
};

/** Act 2 is done (act.js complete(), from main.js endZone on the boss win): the suit back, the papers, the card. */
export async function endAct2(two) {
  const B = two.B, st = two.g.state;
  if (!B || B.done) return;
  B.done = true; B.bossReady = false; B.suitBack = true;
  for (const p of PIECES) B.suit[p.id] = Math.max(B.suit[p.id] || 0, FINDS);
  st.intox = 0;
  st.addRep(ENDING.paper.rep, 'Supergurl is behind bars');
  st.save();
  await showNewspaper(ENDING.paper);
  const C = ENDING.card;
  await dialog({ title: C.title, text: `<div style="text-align:center;font:900 34px Impact,'Arial Black',sans-serif;color:#ffd21a;text-shadow:3px 3px 0 #000,-1px -1px 0 #000;letter-spacing:2px;margin:6px 0 10px">${C.name.toUpperCase()}</div>${C.text}<span class="hint">Thanks for playing Act 2. Your patrol goes on.</span>`, options: [{ label: 'Back to the city', value: true }] });
}
