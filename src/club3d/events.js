// The drop and the per-visit events (docs/design/nightclub.md "Events per visit").
// The drop, every visit: the music builds (audible), then ~5 s of strobe where the crowd jumps and
// surges, the bouncers are blind and the staff doors swing open. Then one event, picked per visit:
// a red carpet, the paparazzi (Supergirl is the celebrity: stay IN their shots), a police raid,
// a fire alarm (the club empties), or a fight breaking out (the bouncers leave their posts).
import * as THREE from 'three';
import { basic } from '../zonekit.js';
import { npcLook } from '../art.js';
import { rand, pick, clamp } from '../util.js';
import { banner, toast, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { HERO } from '../data.js';

export const DROP = { every: [38, 50], build: 7, strobe: 5.5, first: [22, 30] };
export const EVENTS = {
  redcarpet: { name: 'Red carpet night', sub: 'Cameras at the door, the VIP packed' },
  paparazzi: { name: 'The paparazzi are in', sub: 'They want Supergirl: stay in their shots' },
  raid: { name: 'Raid tonight?', sub: 'Word is the police are coming' },
  firealarm: { name: 'Packed to the rafters', sub: 'Over capacity' },
  fight: { name: 'Bad blood on the floor', sub: 'Two crews, one dance floor' },
};
const PAP = { need: 18, range: 7, fov: 0.8, n: 3 }; // seconds in shot to win them over

export const eventMethods = {
  /** Before the world is built: which event (if any) this visit has. ?club3event= forces one. */
  pickEvent() {
    const q = new URLSearchParams(location.search).get('club3event');
    const id = EVENTS[q] ? q : q === 'none' ? null : Math.random() < 0.6 ? pick(Object.keys(EVENTS)) : null;
    this.event = id ? { id, ...EVENTS[id], t: 0, phase: 0 } : null;
  },

  startEvents() {
    this.dropT = rand(...DROP.first); this.dropPhase = 'idle'; this.strobe = 0; this.surge = 0; this.drop = false;
    if (this.event) setTimeout(() => { if (!this.done && this.event) banner(this.event.name.toUpperCase(), this.event.sub, '#ffd84d'); }, 4200);
  },

  stepEvents(dt) {
    // ---- the drop
    this.dropT -= dt;
    if (this.dropPhase === 'idle' && this.dropT <= DROP.build) {
      this.dropPhase = 'build';
      this.music.build(DROP.build - 0.1);
    }
    if (this.dropPhase === 'build' && this.dropT <= 0) this.startDrop();
    if (this.dropPhase === 'strobe') {
      this.strobe -= dt;
      if (this.strobe <= 0) this.endDrop();
    }
    this.surge = Math.max(0, this.surge - dt * (this.strobe > 0 ? 0 : 0.8));
    this.surgeT = this.strobe;
    // ---- the visit's event
    const E = this.event;
    if (E) { E.t += dt; this[`step_${E.id}`]?.(dt, E); }
  },

  startDrop() {
    this.dropPhase = 'strobe'; this.strobe = DROP.strobe; this.drop = true; this.surge = 1;
    for (const gd of this.guards) gd.cone.visible = false;
    this.crowd.shove(this.hero.position.x + rand(-2, 2), this.hero.position.z + rand(-2, 2), 3.5, 0.6);
    // super-hearing at the drop: the bass hits her full on
    if (this.hearing) {
      this.setHearing(false);
      this.stunT = 1.8; flash('#ffffff'); sfx.hurt();
      const s = this.screenOf(this.hero.position, 2.1);
      if (s) comic.pow('EEEEE!', s.x, s.y, { size: 1.1 });
      toast('The drop hits her super-hearing full on. Her ears ring.', 'bad');
    }
    // the staff doors swing open while everyone's looking at the DJ
    this.dropOpened = [];
    for (const k of ['office', 'vip']) if (!(k === 'office' ? this.officeOpen : this.vipIn) && this.doors[k] && !this.doors[k].col.disabled) { this.openDoorOf(k); this.dropOpened.push(k); }
  },

  endDrop() {
    this.dropPhase = 'idle'; this.strobe = 0; this.drop = false;
    this.dropT = rand(...DROP.every);
    for (const gd of this.guards) gd.cone.visible = !gd.ko && !gd.away;
    // slipped through while the lights were out? then she's in; else the doors swing shut again
    for (const k of this.dropOpened || []) {
      const q = this.plan.byKind[k], inside = this.room === q;
      if (inside) { if (k === 'office') this.officeOpen = true; else this.vipIn = true; toast(k === 'office' ? 'You slipped into the back office.' : 'You slipped past the rope.', 'good'); }
      else this.closeDoorOf(k);
    }
    this.dropOpened = [];
  },

  closeDoorOf(key) {
    const d = this.doors[key];
    if (!d || !d.col.disabled) return;
    const h = this.hero.position, c = d.col;
    if (h.x > c.minX - 0.5 && h.x < c.maxX + 0.5 && h.z > c.minZ && h.z < c.maxZ) return; // standing in it
    d.col.disabled = false;
    if (d.kind === 'rope') { d.mesh.visible = true; return; }
    const m = d.mesh, y0 = 1.45;
    this.anims.push((t, dt) => { if (m.position.y > y0) m.position.y = Math.max(y0, m.position.y - dt * 6); });
  },

  dropHint() {
    if (this.dropPhase === 'strobe') return 'THE DROP!';
    if (this.dropPhase === 'build') return `The drop in ${Math.ceil(this.dropT)}…`;
    const E = this.event;
    if (E?.id === 'paparazzi' && !E.won && E.phase === 1) return `In the shots: ${Math.floor(E.got)}/${PAP.need}s`;
    if (E?.id === 'firealarm' && E.phase === 1) return `Evacuation: ${Math.ceil(E.left)}s`;
    if (E?.id === 'raid' && E.phase === 1) return `RAID: doors open ${Math.ceil(E.left)}s`;
    return '';
  },

  // ---- per-event setup (from placeGameplay) and steps
  placeEvent() {
    const E = this.event, V = this.plan.V;
    if (!E) return;
    if (E.id === 'redcarpet') {
      // a press line inside the door, flashes going off; a celebrity holding court by the VIP rope
      this.press = [-3.2, -2, 2, 3.2].map((x, i) => this.npc({ ...npcLook('civilian'), top: '#1a1a1a' }, x, V.hd - 4.6 - (i % 2) * 0.5, Math.PI + (x < 0 ? -0.5 : 0.5)));
      const vq = this.plan.byKind.vip, s = vq.side === 'W' ? 1 : -1;
      this.celeb = this.npc({ ...npcLook('civilian'), top: '#ffd84d', skirt: '#ffd84d', bottom: null, hairStyle: 'long', size: 1.04 }, vq.door.x + s * 4.2, vq.door.z + 2.6, -s * Math.PI / 2);
      this.addInter({ x: this.celeb.position.x, z: this.celeb.position.z + 1.2 }, 'Talk to the celebrity', () => !E.met, () => this.meetCeleb());
    }
    if (E.id === 'paparazzi') {
      E.pap = [];
      for (let i = 0; i < PAP.n; i++) {
        const x = rand(-V.hw * 0.5, V.hw * 0.5), z = rand(-2, V.hd - 6);
        const m = this.npc({ ...npcLook('civilian'), top: '#2a2a2a', bottom: '#1a1a1a', skirt: null, hairStyle: 'cap' }, x, z, Math.PI);
        const cone = new THREE.Mesh(new THREE.CircleGeometry(PAP.range, 20, -Math.PI / 2 - PAP.fov / 2, PAP.fov).rotateX(-Math.PI / 2), basic(0x7fd0ff, { transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
        cone.position.y = 0.05; m.add(cone);
        E.pap.push({ m, cone, tx: x, tz: z, t: rand(0, 3), flashT: rand(0.5, 2) });
      }
      E.got = 0;
    }
    if (E.id === 'fight') E.spot = { x: rand(-V.hw * 0.4, V.hw * 0.4), z: V.floor.z + rand(-3, 3) };
  },

  step_redcarpet(dt, E) {
    // flashes at the press line
    if (this.press) for (const p of this.press) {
      p._f = (p._f ?? rand(0.3, 2)) - dt;
      if (p._f <= 0) { p._f = rand(0.6, 2.4); const s = this.screenOf(p.position, 1.8); if (s && Math.hypot(this.hero.position.x - p.position.x, this.hero.position.z - p.position.z) < 9) comic.pow('FLASH', s.x, s.y, { size: 0.55, colors: ['#ffffff', '#ffd84d'] }); }
    }
  },

  async meetCeleb() {
    const E = this.event;
    E.met = true;
    const { dialog } = await import('../ui.js');
    if (this.undercover) {
      await dialog({ speaker: 'The celebrity', text: '"Ugh, a fan? Security!" They look straight through you: plain clothes don\'t get you into their world.' });
      return;
    }
    const v = await dialog({ speaker: 'The celebrity', text: `"Oh my god, ${HERO}?! Get in here. Selfie? Then come up to VIP with us, the rope's for other people."`, options: [{ label: 'Smile for the selfie', note: 'VIP access · a photo of you in a club, tonight', value: true, cls: 'risky' }, { label: '"Not tonight."', value: false }] });
    if (!v) return;
    sfx.shutter?.();
    this.addCard('fans', 'A celebrity selfie, posted from the club');
    this.items.add('VIP wristband');
    toast('They hand you a VIP wristband.', 'good');
  },

  step_paparazzi(dt, E) {
    if (E.won || !E.pap) return;
    E.phase = 1;
    const h = this.hero.position;
    let inShot = false;
    for (const p of E.pap) {
      // they drift toward her, cameras up
      p.t += dt;
      if (p.t > 3) { p.t = 0; p.tx = h.x + rand(-4, 4); p.tz = h.z + rand(2, 6); }
      const m = p.m, dx = p.tx - m.position.x, dz = p.tz - m.position.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { m.position.x += (dx / d) * 1.5 * dt; m.position.z += (dz / d) * 1.5 * dt; }
      const fx = h.x - m.position.x, fz = h.z - m.position.z, fd = Math.hypot(fx, fz);
      m.rotation.y += (Math.atan2(fx, fz) - m.rotation.y) * Math.min(1, dt * 3);
      const ang = Math.abs(Math.atan2(fx, fz) - m.rotation.y);
      const sees = fd < PAP.range && (ang < PAP.fov / 2 || ang > Math.PI * 2 - PAP.fov / 2);
      p.cone.material.color.set(sees ? 0xffffff : 0x7fd0ff); p.cone.material.opacity = sees ? 0.3 : 0.14;
      if (sees) {
        inShot = true;
        p.flashT -= dt;
        if (p.flashT <= 0) { p.flashT = rand(0.4, 1.2); const s = this.screenOf(m.position, 1.8); if (s) comic.pow('FLASH', s.x, s.y, { size: 0.5, colors: ['#ffffff', '#7fd0ff'] }); sfx.shutter?.(); }
      }
    }
    this.posing = inShot && this.facing;
    if (!inShot) return;
    E.got += dt * (this.posing ? 2 : 1);
    if (this.g.state.intox >= 45 && !E.sloppy) { E.sloppy = true; this.addCard('paparazzi', 'Paparazzi shots: Supergirl, out of it'); toast('The flashes catch you swaying. Those photos won\'t be flattering.', 'bad'); }
    if (E.got >= PAP.need) {
      E.won = true; this.posing = false;
      for (const p of E.pap) p.cone.visible = false;
      if (E.sloppy) { this.g.state.addRep(-6, 'Sloppy paparazzi shots'); banner('THE PAPARAZZI GOT THEIR SHOTS', 'Not your best side', '#ff3fb8'); }
      else { this.g.state.addRep(8, 'Stunning red-carpet shots'); this.bonus = (this.bonus || 0) + 5; banner('COVER GIRL!', 'The press loves you tonight', '#3ee08a'); }
    }
  },

  step_raid(dt, E) {
    if (E.phase === 0 && E.t > 55) {
      E.phase = 1; E.left = 30;
      banner('POLICE RAID!', 'Every door is open: go!', '#3fa0ff'); sfx.alarm();
      for (const k of ['office', 'vip', 'storage']) this.openDoorOf(k);
      for (const gd of this.guards) { gd.away = true; gd.cone.visible = false; }
      this.crowd.shove(0, this.plan.V.hd, 30, 3);
    }
    if (E.phase === 1) {
      E.left -= dt;
      this.alert = Math.max(0, this.alert - dt * 30);
      if (E.left <= 0) {
        E.phase = 2;
        for (const gd of this.guards) { gd.away = false; gd.cone.visible = !gd.ko; }
        if (this.room === this.plan.byKind.office) this.officeOpen = true;
        if (this.room === this.plan.byKind.vip) this.vipIn = true;
        if (this.room === this.plan.byKind.storage) this.stockOpen = true;
        toast('The police are gone. The bouncers are back on the doors.', 'info');
        for (const k of ['office', 'vip', 'storage']) if (!(k === 'office' ? this.officeOpen : k === 'vip' ? this.vipIn : this.stockOpen)) this.closeDoorOf(k);
      }
    }
  },

  step_firealarm(dt, E) {
    if (E.phase === 0 && E.t > 70) {
      E.phase = 1; E.left = 100;
      banner('FIRE ALARM!', 'The club is emptying: 100 seconds', '#ff5a3a'); sfx.alarm();
    }
    if (E.phase === 1) {
      E.left -= dt;
      // the crowd thins out toward the doors (the cover goes with them)
      const gone = clamp(1 - E.left / 100, 0, 1), P = this.crowd.people;
      for (let i = 0; i < P.length; i++) if (P[i].pose === 'dance' && (i % 100) / 100 < gone && !P[i].left) P[i].left = true; // (they walk out: crowd.js)
      if (Math.floor(E.t * 2) % 2 === 0) this.plights?.forEach((l) => l.color.set(0xff2020));
      if (E.left <= 0) {
        E.phase = 2;
        if (!this.caseSolved && !this.done) {
          this.done = true;
          toast('The fire brigade clears the building. Everyone out.', 'bad');
          this.g.endZone(this.zone, { outcome: 'abort', rep: -2 });
        }
      }
    }
  },

  step_fight(dt, E) {
    if (E.phase === 0 && E.t > 40) {
      E.phase = 1; E.left = 40;
      banner('FIGHT ON THE FLOOR!', 'The bouncers are busy: the doors aren\'t watched', '#ffd84d');
      const s = this.screenOf({ x: E.spot.x, y: 0, z: E.spot.z }, 1.8); if (s) comic.pow('FIGHT!', s.x, s.y, { size: 1.2 });
      for (const gd of this.guards) { if (gd.high) continue; gd.saved = gd.route; gd.route = [new THREE.Vector3(E.spot.x + rand(-1.5, 1.5), 0, E.spot.z + rand(-1.5, 1.5)), new THREE.Vector3(E.spot.x + rand(-1.5, 1.5), 0, E.spot.z + rand(-1.5, 1.5))]; gd.wp = 0; }
      this.crowd.shove(E.spot.x, E.spot.z, 6, 2);
      this.openDoorOf('vip');
    }
    if (E.phase === 1) {
      E.left -= dt;
      if (E.left <= 0) {
        E.phase = 2;
        for (const gd of this.guards) if (gd.saved) { gd.route = gd.saved; gd.wp = 0; gd.saved = null; }
        if (this.room === this.plan.byKind.vip) this.vipIn = true;
        if (!this.vipIn) this.closeDoorOf('vip');
        toast('The fight\'s broken up. The bouncers drift back.', 'info');
      }
    }
  },
};
