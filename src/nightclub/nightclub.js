// The detective nightclub mode (docs/design/nightclub.md): walk a club's rooms side-on, go through
// its doors, find the items that open locked rooms, take (or refuse) a Super Squirt at the bar, and
// black out when it gets too much. The look test for the redesign: placeholder art until the user's
// batch-1 assets arrive; the premade 3D clubs stay the default until this reaches parity
// (main.js routes club zones here only with ?club=v2).
import { buildClub } from './layout.js';
import { ROOMS, PLATE, ART } from './rooms.js';
import { ClubStage } from './stage.js';
import { beforeScene, afterScene, freeIntox, TIERS } from './intox.js';
import { crowdAtlas, drawDancer, loadDancers } from './crowd.js';
import { CLOSEUPS } from './scenes.js';
import { heroReady, HeroSprite } from '../hero3d.js';
import { clamp, wobble, $ } from '../util.js';
import { banner, toast, dialog, UI } from '../ui.js';
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
    loadDancers();
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
    if (this.view === 'closeup') { this.updateCloseup(); return; }
    if (this.view === 'set') {
      this.setT += dt;
      if (this.setT > 8 || inp.pressed('interact') || inp.taps.length) { this.view = 'walk'; inp.taps.length = 0; this.setVideo(false); }
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
    const label = n.spot ? (n.spot.type === 'drink' ? 'DRINK' : n.spot.type === 'closeup' ? 'SEARCH' : 'LOOK') : n.door ? (n.door.to ? ROOMS[this.byId[n.door.to].kind].sign : 'EXIT') : 'LOOK';
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
    if (n.spot?.type === 'djview') { this.view = 'set'; this.setT = 0; this.setVideo(true); }
    if (n.spot?.type === 'closeup' && CLOSEUPS[this.room.kind]) this.openCloseup(CLOSEUPS[this.room.kind]);
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
    this.heroAt = now; this.heroWalk = this.p.walking; this.heroFace = this.p.facing; this.heroStamp = (this.heroStamp || 0) + 1;
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
    const k = view.k, x = this.stage.sx(view, this.p.x), feet = this.stage.lane * k;
    const img = this.heroImage();
    if (!img) {
      if (!this.fallback) this.fallback = crowdAtlas('#ffd070');
      drawDancer(ctx, this.fallback, 0, 0, 0, x, feet, 300 * k);
      return;
    }
    const hpx = HERO_H * k, wpx = hpx * (img.width / img.height);
    const top = feet - hpx * (1 - 0.12 / 2.6);
    const { lit, rim } = this.litHero(img);
    // contact shadow, then (glossy plates) a faint squashed reflection below the feet
    ctx.save(); ctx.translate(x, feet); ctx.scale(1, 0.16);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, wpx * 0.42);
    sh.addColorStop(0, 'rgba(0,0,0,0.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, wpx * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (this.stage.spec) {
      ctx.save(); ctx.globalAlpha = 0.17; ctx.translate(x, feet); ctx.scale(1, -0.42);
      ctx.drawImage(lit, -wpx / 2, top - feet, wpx, hpx); ctx.restore();
    }
    // the room's backlight wraps her edges, then her body graded by the room's light
    ctx.globalAlpha = 0.85;
    ctx.drawImage(rim, x - wpx / 2 - 2.5 * k, top - 2 * k, wpx, hpx); ctx.drawImage(rim, x - wpx / 2 + 2.5 * k, top - 2 * k, wpx, hpx);
    ctx.globalAlpha = 1;
    ctx.drawImage(lit, x - wpx / 2, top, wpx, hpx);
  }

  /** Her sprite graded by the room's haze colour, plus a solid backlight-coloured copy for the rim. */
  litHero(img) {
    const L = ROOMS[this.room.kind].look, key = `${this.heroStamp}:${this.room.kind}`;
    if (this.litKey === key) return this.litCache;
    const mk = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; return c; };
    const lit = this.litCache?.lit || mk(), rim = this.litCache?.rim || mk();
    const a = lit.getContext('2d'), b = rim.getContext('2d');
    a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, lit.width, lit.height); a.drawImage(img, 0, 0);
    a.globalCompositeOperation = 'source-atop'; a.fillStyle = L.haze; a.globalAlpha = 0.26; a.fillRect(0, 0, lit.width, lit.height); a.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, rim.width, rim.height); b.drawImage(img, 0, 0);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = L.accent; b.fillRect(0, 0, rim.width, rim.height);
    this.litKey = key; this.litCache = { lit, rim };
    return this.litCache;
  }

  drawMarkers(ctx, view) {
    const k = view.k, r = this.room, n = this.near(), bob = Math.sin(this.t * 4) * 6 * k;
    ctx.font = `bold ${Math.round(Math.max(14, 34 * k))}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center';
    const tag = (x, y, text, col) => { ctx.lineWidth = 4; ctx.strokeStyle = '#05040a'; ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y); };
    if (this.stage.flashing) for (const key of this.club.keys) {
      if (key.room !== r.id || this.taken.has(`${key.room}:${key.x}`)) continue;
      const x = this.stage.sx(view, key.x), y = (this.stage.lane - 54) * k + bob;
      ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x, y, 12 * k + 4, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#05040a'; ctx.stroke();
      ctx.save(); ctx.font = `bold ${Math.round(Math.max(12, 24 * k))}px Bangers, Impact, sans-serif`;
      tag(x, y - 18 * k - 6, key.item.toUpperCase(), '#ffd84d'); ctx.restore();
    }
    for (const s of r.spots) {
      if (this.taken.has(`${r.id}:${s.x}`)) continue;
      tag(this.stage.sx(view, s.x), (this.stage.lane - 384) * k + bob, { closeup: 'SEARCH ▼', drink: 'DRINK ▼', djview: 'LOOK ▼' }[s.type] || 'LOOK ▼', '#ffd84d');
    }
    if (n.door) tag(this.stage.sx(view, n.door.x), (this.stage.lane - 494) * k + bob, n.door.lock && !this.items.has(n.door.lock) ? '🔒' : '▼', '#fff');
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
    if (this.view === 'closeup') { this.renderCloseup(ctx, w, h); afterScene(ctx, g.canvas, w, h, st ? st.intox : 0, this.t); return; }
    const vid = this.view === 'set' && this.video && this.video.readyState >= 2 ? this.video : null;
    const set = this.view === 'set' && (vid || this.setImage());
    if (set) this.stage.drawSetPiece(ctx, set, w, h, this.t, !vid);
    else this.stage.drawBack(ctx, view, this.t, this.view === 'walk' ? this.p.x : null);
    if (this.view === 'walk') { this.drawMarkers(ctx, view); this.drawHero(ctx, view); }
    this.stage.drawFront(ctx, view, this.t, this.dt || 1 / 60);
    afterScene(ctx, g.canvas, w, h, st ? st.intox : 0, this.t);
    const dark = this.blackout ? clamp(this.blackout.t < 2.4 ? this.blackout.t / 1.2 : 1 - (this.blackout.t - 2.4) / 1.2, 0, 1) : this.fade.a;
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, w, h); }
  }

  /** The room's set-piece render (loaded on first look), or null → the zoomed-in room. */
  setImage() {
    const src = ART.setPiece[this.room.kind];
    if (!src) return null;
    if (!this.setImg || this.setSrc !== src) { this.setImg = new Image(); this.setSrc = src; this.setImg.src = PLATE.dir + src; }
    return this.setImg.complete && this.setImg.naturalWidth ? this.setImg : null;
  }

  /** The DJ view's video loop: a hidden muted inline <video> (iOS autoplay rules), played only while looked at. */
  setVideo(on) {
    const src = ART.setLoop?.[this.room.kind];
    if (!src) return;
    if (on && !this.video) {
      const v = this.video = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      v.src = PLATE.dir + src;
      document.body.appendChild(v);
    }
    if (!this.video) return;
    if (on) this.video.play().catch(() => { /* the still stays */ }); else this.video.pause();
  }

  // ------------------------------------------------------------------ close-up search
  openCloseup(scene) {
    this.view = 'closeup'; this.scene = scene;
    this.found = this.found || {};
    if (!scene.img) { scene.img = new Image(); scene.img.src = PLATE.dir + scene.src; }
    this.missT = 0; this.ring = null;
    this.g.input.setButton('interact', { label: 'BACK', lit: false }); this.lastLabel = 'BACK';
    toast('Tap anything that looks out of place.', 'info');
  }

  /** Where the image sits on screen (cover-fit), to map taps into its 0..1 space. */
  closeupRect(w, h) {
    const img = this.scene.img, iw0 = img.naturalWidth || 1280, ih0 = img.naturalHeight || 720;
    const sc = Math.max(w / iw0, h / ih0);
    return { x: (w - iw0 * sc) / 2, y: (h - ih0 * sc) * 0.8, w: iw0 * sc, h: ih0 * sc }; // crop the top, keep the counter
  }

  updateCloseup() {
    const inp = this.g.input, sc = this.scene, key = this.room.kind;
    this.missT = Math.max(0, this.missT - (this.dt || 0));
    if (inp.pressed('interact') || inp.pressed('leave')) { this.view = 'walk'; inp.taps.length = 0; return; }
    const tap = inp.taps.shift();
    if (!tap || UI.open) return;
    const R = this.closeupRect(this.g.w, this.g.h), u = (tap.x - R.x) / R.w, v = (tap.y - R.y) / R.h;
    const hit = sc.spots.find((s) => Math.hypot((u - s.x) * (R.w / R.h), v - s.y) < s.r * 1.25);
    if (!hit) { this.ring = { x: tap.x, y: tap.y, t: 0, miss: true }; return; }
    this.ring = { x: R.x + hit.x * R.w, y: R.y + hit.y * R.h, t: 0 };
    const seen = (this.found[key] = this.found[key] || new Set());
    const fresh = !seen.has(hit.id);
    seen.add(hit.id);
    if (hit.item && !this.items.has(hit.item)) { this.items.add(hit.item); sfx.whoosh(); }
    if (hit.drink) { this.offerDrink(hit.text); return; }
    dialog({ title: sc.title, text: hit.text + (fresh ? `<span class="hint">Clue ${seen.size} of ${sc.spots.length}</span>` : '') });
  }

  async offerDrink(text) {
    const yes = await dialog({
      title: 'Super Squirt', text,
      options: [{ label: 'Knock it back', value: true }, { label: 'Leave it', value: false }],
    });
    if (yes) { this.g.state.addIntox(34); sfx.whoosh(); toast('It burns… then the room starts to glow.', 'info'); }
  }

  renderCloseup(ctx, w, h) {
    const sc = this.scene, img = sc.img;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (!img.complete || !img.naturalWidth) return;
    const R = this.closeupRect(w, h);
    ctx.drawImage(img, R.x, R.y, R.w, R.h);
    // found spots get an inked check ring; the last tap ripples (gold on a hit, grey on a miss)
    const seen = this.found[this.room.kind] || new Set();
    ctx.lineWidth = 3;
    for (const s of sc.spots) {
      if (!seen.has(s.id)) continue;
      const x = R.x + s.x * R.w, y = R.y + s.y * R.h, r = s.r * R.w * 0.7;
      ctx.strokeStyle = '#05040a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (this.ring) {
      const q = this.ring; q.t += this.dt || 1 / 60;
      const a = Math.max(0, 1 - q.t / 0.6), r = 18 + q.t * 90;
      ctx.strokeStyle = q.miss ? `rgba(200,200,220,${a})` : `rgba(255,216,77,${a})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke();
      if (a <= 0) this.ring = null;
    }
    ctx.font = `bold ${Math.round(Math.max(16, h * 0.05))}px Bangers, Impact, sans-serif`; ctx.textAlign = 'left';
    const label = `${sc.title.toUpperCase()} · ${seen.size}/${sc.spots.length} CLUES`;
    ctx.lineWidth = 5; ctx.strokeStyle = '#05040a'; ctx.strokeText(label, 18, h - 22); ctx.fillStyle = '#ffd84d'; ctx.fillText(label, 18, h - 22);
  }

  exit() {
    if (this.video) { this.video.pause(); this.video.remove(); this.video = null; }
    this.stage = null; freeIntox();
    $('hud-extra').innerHTML = '';
  }
}
