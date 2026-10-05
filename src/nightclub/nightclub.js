// The detective nightclub mode (docs/design/nightclub.md): walk a club's rooms side-on, go through
// its doors, find the items that open locked rooms, take (or refuse) a Super Squirt at the bar, and
// black out when it gets too much. The look test for the redesign: placeholder art until the user's
// batch-1 assets arrive; the premade 3D clubs stay the default until this reaches parity
// (main.js routes club zones here only with ?club=v2).
import { buildClub } from './layout.js';
import { ROOMS, PLATE } from './rooms.js';
import { ClubStage } from './stage.js';
import { beforeScene, afterScene, freeIntox, TIERS } from './intox.js';
import { crowdAtlas, drawDancer } from './crowd.js';
import { heroReady, HeroSprite } from '../hero3d.js';
import { clamp, wobble, $ } from '../util.js';
import { banner, toast, dialog } from '../ui.js';
import { sfx } from '../sfx.js';

const WALK = 520;          // plate px per second
const REACH = 140;         // how close she must be to use a door or a spot
const HERO_H = 446;        // her sprite frame (2.6 m) in plate px: people are ~300 px (1.75 m)
const FADE = 0.28;         // room-change fade, each way
const BLACKOUT_WAKE = ['vip', 'office', 'storage', 'restroom'];

export class Nightclub {
  constructor(g) { this.g = g; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone; this.done = false; this.t = 0;
    const seed = +(new URLSearchParams(location.search).get('clubseed') || 0);
    this.club = buildClub(seed ? { seed, size: 'medium', name: zone.venue } : { flagship: true });
    this.byId = Object.fromEntries(this.club.rooms.map((r) => [r.id, r]));
    this.items = new Set();
    this.taken = new Set();     // keys picked up / spots used, by "room:x"
    this.p = { x: 0, facing: 1, walking: false };
    this.fade = { a: 1, dir: -1, then: null };
    this.view = 'walk'; this.setT = 0;
    this.blackout = null;
    this.go('entrance', null);
    g.input.setStick(true);
    g.input.setButtons([
      { id: 'interact', label: 'LOOK', key: 'E', cls: 'big' },
      { id: 'leave', label: 'LEAVE', key: '⌫', slot: 2 },
    ]);
    $('hud-extra').innerHTML = ''; // (the HUD's own INTOXICATION bar is the Super Squirt meter)
    g.vice = { active: false };
    banner(this.club.name.toUpperCase(), 'Find out who is pushing Super Squirt', '#ff3fb8');
  }

  /** Enter a room; arrive at the door that leads back to `from` (the street door from outside). */
  go(id, from) {
    const room = this.byId[id];
    this.room = room;
    this.stage = new ClubStage(room, this.byId, this.club.seed);
    const d = room.doors.find((e) => e.to === from) || room.doors[0];
    this.p.x = d.x; this.p.facing = d.x < room.w / 2 ? 1 : -1;
    this.cam = d.x;
    $('hud-title').textContent = `${this.club.name} · ${ROOMS[room.kind].name}`;
  }

  get k() { return this.g.h / PLATE.h; }
  get viewW() { return this.g.w / this.k; }

  /** What's in reach: a door, a key on the floor, or a spot (drink, the DJ view). */
  near() {
    const x = this.p.x, r = this.room;
    const spot = r.spots.find((s) => Math.abs(s.x - x) < REACH && !this.taken.has(`${r.id}:${s.x}`));
    if (spot) return { spot };
    const door = r.doors.reduce((b, d) => (Math.abs(d.x - x) < REACH && (!b || Math.abs(d.x - x) < Math.abs(b.x - x)) ? d : b), null);
    return door ? { door } : {};
  }

  update(dt) {
    if (this.done) return;
    const g = this.g, inp = g.input, st = g.state;
    this.t += dt; this.dt = dt;
    // fades: out → switch → in
    const f = this.fade;
    if (f.dir) {
      f.a = clamp(f.a + f.dir * dt / FADE, 0, 1);
      if (f.dir > 0 && f.a >= 1) { const then = f.then; f.then = null; f.dir = -1; if (then) then(); }
      else if (f.dir < 0 && f.a <= 0) f.dir = 0;
    }
    if (this.blackout) { this.updateBlackout(dt); return; }
    if (this.view === 'set') {
      this.setT += dt;
      if (this.setT > 6 || inp.pressed('interact') || inp.taps.length) { this.view = 'walk'; inp.taps.length = 0; }
      return;
    }
    if (f.dir > 0) return;
    // walking: the stick (or arrows); Super Squirt bends her steering and, heavy, drifts her
    const a = wobble(inp.axis(), st.intox, this.t);
    let vx = a.x;
    if (st.intox > TIERS.heavy && Math.abs(vx) > 0.1) vx += Math.sin(this.t * 1.3) * 0.35;
    const r = this.room;
    this.p.walking = Math.abs(vx) > 0.12;
    if (this.p.walking) { this.p.x = clamp(this.p.x + vx * WALK * dt, 150, r.w - 150); this.p.facing = vx > 0 ? 1 : -1; }
    // camera: a dead band around her, never past the plate's ends
    const half = this.viewW / 2, band = this.viewW * 0.14;
    if (this.p.x > this.cam + band) this.cam = this.p.x - band;
    if (this.p.x < this.cam - band) this.cam = this.p.x + band;
    this.cam = r.w <= this.viewW ? r.w / 2 : clamp(this.cam, half, r.w - half);
    // keys on the floor are picked up by walking over them
    for (const key of this.club.keys) {
      const id = `${key.room}:${key.x}`;
      if (key.room === r.id && !this.taken.has(id) && Math.abs(key.x - this.p.x) < 70) {
        this.taken.add(id); this.items.add(key.item); sfx.whoosh();
        toast(`Picked up: ${key.item}`, 'info');
      }
    }
    const n = this.near();
    const label = n.spot ? (n.spot.type === 'drink' ? 'DRINK' : 'LOOK') : n.door ? (n.door.to ? ROOMS[this.byId[n.door.to].kind].sign : 'EXIT') : 'LOOK';
    if (label !== this.lastLabel) { inp.setButton('interact', { label, lit: !!(n.spot || n.door) }); this.lastLabel = label; }
    if (inp.pressed('interact')) this.use(n);
    if (inp.pressed('leave')) this.leave();
    if (st.intox >= 100) this.startBlackout();
  }

  async use(n) {
    const st = this.g.state;
    if (n.door) {
      const d = n.door;
      if (!d.to) { this.leave(); return; }
      if (d.lock && !this.items.has(d.lock)) { toast(`Locked. You need the ${d.lock}.`, 'bad'); return; }
      const from = this.room.id;
      this.fade = { a: this.fade.a, dir: 1, then: () => this.go(d.to, from) };
      return;
    }
    if (n.spot?.type === 'drink') {
      const yes = await dialog({
        title: 'Super Squirt',
        text: 'The bartender slides a glowing blue shot across the bar. <em>"First one\'s on the house, hero. Everybody\'s drinking it."</em>',
        options: [{ label: 'Knock it back', value: true }, { label: 'Pass', value: false }],
      });
      if (yes) { st.addIntox(34); sfx.whoosh(); toast('It burns… then the room starts to glow.', 'info'); }
      return;
    }
    if (n.spot?.type === 'djview') { this.view = 'set'; this.setT = 0; }
  }

  startBlackout() {
    if (this.blackout) return;
    this.blackout = { t: 0, woke: false };
    banner('BLACKOUT', 'The lights smear… then nothing.', '#ff3fb8');
  }

  /** The sedative loop's placeholder: black, then she wakes in a back room (the cinematic comes later). */
  updateBlackout(dt) {
    const b = this.blackout;
    b.t += dt;
    if (!b.woke && b.t > 2.4) {
      b.woke = true;
      const wake = this.club.rooms.filter((r) => BLACKOUT_WAKE.includes(r.kind));
      const r = wake.length ? wake[Math.floor(Math.random() * wake.length)] : this.room;
      this.go(r.id, null);
      this.p.x = r.w / 2; this.cam = r.w / 2;
      this.g.state.intox = 60;
      toast(`You come to in the ${ROOMS[r.kind].name.toLowerCase()}. How did you get here?`, 'info');
    }
    if (b.t > 3.6) this.blackout = null;
  }

  leave() {
    if (this.done) return;
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'abort', rep: 0 });
  }

  // ------------------------------------------------------------------ render
  heroImage() {
    if (!heroReady()) return null;
    if (!this.sprite) this.sprite = new HeroSprite(220, 300);
    const now = performance.now();
    if (this.heroAt && now - this.heroAt < 33 && this.heroWalk === this.p.walking && this.heroFace === this.p.facing) return this.heroInk;
    this.heroAt = now; this.heroWalk = this.p.walking; this.heroFace = this.p.facing;
    const H = this.sprite.hero;
    if (this.p.walking) H.pose('jog', this.t * 1.1); else H.pose('pose', 0.5 + this.t * 0.4);
    H.setWind(Math.sin(this.t * 1.7) * 0.8, 0.5, this.p.walking ? -5 : -0.8);
    const q = this.p.facing > 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4;
    const img = this.sprite.render({ view: 'side', yaw: q, span: 2.6, lift: 0.12 });
    // copy out of WebGL once, then ink her silhouette (8 offset stamps of a black copy)
    if (!this.heroInk) {
      this.heroInk = document.createElement('canvas'); this.heroInk.width = img.width + 8; this.heroInk.height = img.height + 8;
      this.heroTmp = document.createElement('canvas'); this.heroTmp.width = img.width; this.heroTmp.height = img.height;
    }
    const tx = this.heroTmp.getContext('2d'), ix = this.heroInk.getContext('2d');
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, img.width, img.height); tx.drawImage(img, 0, 0);
    ix.clearRect(0, 0, this.heroInk.width, this.heroInk.height);
    const black = this.heroBlack || (this.heroBlack = document.createElement('canvas'));
    black.width = img.width; black.height = img.height;
    const bx = black.getContext('2d');
    bx.drawImage(this.heroTmp, 0, 0); bx.globalCompositeOperation = 'source-in'; bx.fillStyle = '#05040a'; bx.fillRect(0, 0, black.width, black.height);
    for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) ix.drawImage(black, 4 + ox, 4 + oy);
    ix.drawImage(this.heroTmp, 4, 4);
    return this.heroInk;
  }

  drawHero(ctx, view) {
    const k = view.k, x = this.stage.sx(view, this.p.x), feet = (PLATE.floor + 24) * k;
    const img = this.heroImage();
    if (!img) {
      if (!this.fallback) this.fallback = crowdAtlas('#ffd070');
      drawDancer(ctx, this.fallback, 0, 0, x, feet, 300 * k);
      return;
    }
    const hpx = HERO_H * k, wpx = hpx * (img.width / img.height);
    const top = feet - hpx * (1 - 0.12 / 2.6);
    ctx.drawImage(img, x - wpx / 2, top, wpx, hpx);
  }

  drawMarkers(ctx, view) {
    const k = view.k, r = this.room, n = this.near(), bob = Math.sin(this.t * 4) * 6 * k;
    ctx.font = `bold ${Math.round(Math.max(14, 34 * k))}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center';
    const tag = (x, y, text, col) => { ctx.lineWidth = 4; ctx.strokeStyle = '#05040a'; ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y); };
    if (this.stage.flashing) for (const key of this.club.keys) {
      if (key.room !== r.id || this.taken.has(`${key.room}:${key.x}`)) continue;
      const x = this.stage.sx(view, key.x), y = (PLATE.floor - 30) * k + bob;
      ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x, y, 12 * k + 4, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#05040a'; ctx.stroke();
    }
    for (const s of r.spots) {
      if (this.taken.has(`${r.id}:${s.x}`)) continue;
      tag(this.stage.sx(view, s.x), (PLATE.floor - 360) * k + bob, s.type === 'drink' ? '?' : '👁', '#ffd84d');
    }
    if (n.door) tag(this.stage.sx(view, n.door.x), (PLATE.floor - 470) * k + bob, n.door.lock && !this.items.has(n.door.lock) ? '🔒' : '▼', '#fff');
  }

  render(ctx) {
    const g = this.g, w = g.w, h = g.h, st = g.state;
    if (!this.stage) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    let view = { k: this.k, x0: this.cam - this.viewW / 2, w, h };
    if (this.view === 'set') {
      // the DJ booth set piece (stand-in for the pre-rendered loop): zoomed in on the decks
      const z = 1.5, k = this.k * z, vw = w / k;
      view = { k, x0: clamp(this.room.w - 420 - vw / 2, 0, this.room.w - vw), w, h };
    }
    beforeScene(ctx, w, h, st ? st.intox : 0, this.t);
    this.stage.drawBack(ctx, view, this.t);
    if (this.view === 'walk') { this.drawMarkers(ctx, view); this.drawHero(ctx, view); }
    this.stage.drawFront(ctx, view, this.t, this.dt || 1 / 60);
    afterScene(ctx, g.canvas, w, h, st ? st.intox : 0, this.t);
    const dark = this.blackout ? clamp(this.blackout.t < 2.4 ? this.blackout.t / 1.2 : 1 - (this.blackout.t - 2.4) / 1.2, 0, 1) : this.fade.a;
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, w, h); }
  }

  exit() {
    this.stage = null; freeIntox();
    $('hud-extra').innerHTML = '';
  }
}
