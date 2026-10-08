// The detective nightclub mode (docs/design/nightclub-2d.md): walk a club's rooms side-on, go through
// its doors, find the items that open locked rooms, search close-ups for the case's clues, build
// the case board and make the accusation (solved → the drug's distribution points go on the city
// map). Super Squirt is offered along the way: each blackout plays the comic-panel cinematic and
// scatters polaroids of her night round the club (find them, or they're blackmail material); the
// third blackout in one visit and she's carried out: captured.
import { buildClub } from './layout.js';
import { ROOMS, PLATE, ART } from './rooms.js';
import { ClubStage } from './stage.js';
import { beforeScene, afterScene, freeIntox, TIERS } from './intox.js';
import { crowdAtlas, drawDancer, loadDancers } from './crowd.js';
import { CLOSEUPS, closeupFrame } from './scenes.js';
import { pickCase, CaseBook } from './case.js';
import { Snapshots, polaroid, drawCinematic, CINE_SECONDS } from './blackout.js';
import { heroReady, HeroSprite } from '../hero3d.js';
import { clamp, wobble, shuffle, $ } from '../util.js';
import { banner, toast, dialog, UI } from '../ui.js';
import { sfx } from '../sfx.js';

const WALK = 520;          // plate px per second
const REACH = 140;         // how close she must be to use a door or a spot
const HERO_H = 446;        // her sprite frame (2.6 m) in plate px: people are ~300 px (1.75 m)
const FADE = 0.28;         // room-change fade, each way
const BLACKOUT_WAKE = ['vip', 'office', 'storage', 'restroom'];
const CAPTURE_AT = 3;      // blackouts in one visit before she's carried out
const PHOTOS = 3;          // polaroids scattered after a blackout
const DOSE = 34;           // one Super Squirt
const LOST_PHOTO_REP = 10; // per polaroid left behind (it'll surface somewhere)

export class Nightclub {
  constructor(g) { this.g = g; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone; this.done = false; this.t = 0;
    loadDancers();
    const seed = +(new URLSearchParams(location.search).get('clubseed') || 0);
    this.club = buildClub(seed ? { seed, size: 'medium', name: zone.venue } : { flagship: true, name: zone.venue });
    this.byId = Object.fromEntries(this.club.rooms.map((r) => [r.id, r]));
    this.case = new CaseBook(pickCase(zone));
    this.items = new Set();
    this.taken = new Set();     // keys picked up / spots used, by "room:x"
    this.p = { x: 0, facing: 1, walking: false };
    this.fade = { a: 1, dir: -1, then: null };
    this.view = 'walk'; this.setT = 0;
    this.blackout = null; this.blackouts = 0;
    this.snaps = new Snapshots(); this.snapT = -99; this.wantSnap = false;
    this.photos = null;
    this.accuseLock = 0;
    this.go('entrance', null);
    g.input.setStick(true);
    g.input.setButtons([
      { id: 'interact', label: 'LOOK', key: 'E', cls: 'big' },
      { id: 'notes', label: 'CASE', key: 'N', slot: 1 },
      { id: 'leave', label: 'LEAVE', key: '⌫', slot: 2 },
    ]);
    this.hudPhotos();
    g.vice = { active: false };
    banner(this.club.name.toUpperCase(), this.case.def.tagline, '#ff3fb8');
  }

  /** Enter a room; arrive at the door that leads back to `from` (the street door from outside). */
  go(id, from) {
    const room = this.byId[id];
    this.room = room;
    this.stage = new ClubStage(room, this.byId, this.club.seed);
    const d = room.doors.find((e) => e.to === from) || room.doors[0];
    this.p.facing = d.x < room.w / 2 ? 1 : -1;
    this.p.x = !from && room.kind === 'entrance' ? room.w * 0.45 : clamp(d.x + this.p.facing * 220, 150, room.w - 150);
    this.cam = this.p.x;
    $('hud-title').textContent = `${this.club.name} · ${ROOMS[room.kind].name}`;
  }

  get k() { return Math.max(this.g.h / PLATE.h, this.room ? this.g.w / this.room.w : 0); }
  get oy() { const k = this.k; return clamp(this.stage.lane * k - this.g.h * 0.9, 0, PLATE.h * k - this.g.h); }
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
    // passed out (in any view: a shot drunk in a close-up counts); a hair under 100 because the meter drains
    if (st.intox >= 99.5 && !UI.open) { if (this.view === 'closeup') { this.g.input.setStick(true); document.body.classList.remove('closeup-on'); } this.view = 'walk'; this.startBlackout(); return; }
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
    // keys on the floor are picked up by walking over them; so are the blackout's polaroids
    for (const key of this.club.keys) {
      const id = `${key.room}:${key.x}`;
      if (key.room === r.id && !this.taken.has(id) && Math.abs(key.x - this.p.x) < 70) {
        this.taken.add(id); this.items.add(key.item); sfx.whoosh();
        toast(`Picked up: ${key.item}`, 'info');
      }
    }
    if (this.photos) for (const ph of this.photos.list) if (!ph.found && ph.room === r.id && Math.abs(ph.x - this.p.x) < 80) this.pickPhoto(ph);
    // while she's dosed, the night gets photographed (these become the blackout's panels and polaroids)
    if (st.intox >= 40 && this.t - this.snapT > 5) { this.snapT = this.t; this.wantSnap = true; }
    const n = this.near();
    const label = n.spot ? (n.spot.type === 'drink' ? 'DRINK' : n.spot.type === 'closeup' ? 'SEARCH' : 'LOOK') : n.door ? (n.door.to ? ROOMS[this.byId[n.door.to].kind].sign : 'EXIT') : 'LOOK';
    if (label !== this.lastLabel) { inp.setButton('interact', { label, lit: !!(n.spot || n.door) }); this.lastLabel = label; }
    inp.setButton('notes', { lit: this.case.ready && !this.solved });
    if (inp.pressed('interact')) this.use(n);
    if (inp.pressed('notes')) this.caseBoard();
    if (inp.pressed('leave')) this.leave();
  }

  async use(n) {
    if (n.door) {
      const d = n.door;
      if (!d.to) { this.leave(); return; }
      if (d.lock && !this.items.has(d.lock)) { toast(`Locked. You need the ${d.lock}.`, 'bad'); return; }
      const from = this.room.id;
      this.fade = { a: this.fade.a, dir: 1, then: () => this.go(d.to, from) };
      return;
    }
    if (n.spot?.type === 'drink') { this.offerDrink('The bartender slides a glowing shot across the bar. <em>"First one\'s on the house, hero."</em>'); return; }
    if (n.spot?.type === 'djview') { this.view = 'set'; this.setT = 0; this.setVideo(true); }
    if (n.spot?.type === 'closeup' && CLOSEUPS[this.room.kind]) this.openCloseup(CLOSEUPS[this.room.kind]);
  }

  async offerDrink(text) {
    const yes = await dialog({
      title: 'Super Squirt', text,
      options: [{ label: 'Knock it back', value: true }, { label: 'Leave it', value: false }],
    });
    if (yes) { this.g.state.addIntox(DOSE); sfx.whoosh(); toast('It burns… then the room starts to glow.', 'info'); }
  }

  // ------------------------------------------------------------------ the case
  async caseBoard() {
    if (UI.open) return;
    const d = this.case.def, notes = this.case.notes();
    const list = notes.length ? `<div class="list">${notes.map((s) => `<div class="item">${s}</div>`).join('')}</div>` : '<p>Nothing yet. Search the club: tap SEARCH where you see it.</p>';
    const status = this.solved ? 'Case solved.' : this.case.ready ? 'You have enough to make an accusation.' : `Find ${d.need - this.case.count} more solid clue${d.need - this.case.count === 1 ? '' : 's'} before you accuse anyone.`;
    const options = this.case.ready && !this.solved ? [{ label: 'Make the accusation', value: 'accuse' }, { label: 'Keep looking', value: null }] : [{ label: 'Close', value: null }];
    const v = await dialog({ title: `Case: ${d.title}`, text: `${list}<span class="hint">${status} (${this.case.count}/${d.need})</span>`, options });
    if (v === 'accuse') this.accuse();
  }

  async accuse() {
    if (this.t < this.accuseLock) { toast('Moe\'s people are watching you. Give it a minute.', 'bad'); return; }
    let right = 0;
    for (const q of this.case.def.questions) {
      const v = await dialog({ title: 'The accusation', text: q.q, options: q.options });
      if (v === q.answer) right++;
    }
    if (right === this.case.def.questions.length) { this.solve(); return; }
    // wrong: the crew knows she's onto them, and somebody spikes her drink
    this.accuseLock = this.t + 60;
    this.g.state.addIntox(40); sfx.whoosh();
    await dialog({ title: 'Wrong call', text: `${right} of ${this.case.def.questions.length} right. Word gets around the club fast. Before you can think it through, someone presses a glowing shot into your hand and the crowd makes sure you drink it.` });
  }

  async solve() {
    const st = this.g.state, d = this.case.def;
    this.solved = true;
    const leads = this.case.leads();
    st.leads = st.leads || []; st.leadsDone = st.leadsDone || [];
    const fresh = leads.filter((l) => !st.leads.some((q) => q.id === l.id) && !st.leadsDone.includes(l.id));
    for (const l of fresh) st.leads.push({ id: l.id, name: l.name, kind: l.kind, venue: l.venue || null, theme: l.theme || null, reward: l.reward, blurb: l.blurb });
    st.cases = st.cases || {}; st.cases[d.id] = { solved: true };
    st.save();
    sfx.pickup?.();
    banner('CASE SOLVED', fresh.length ? `${fresh.length} target${fresh.length === 1 ? '' : 's'} marked on your map` : 'The trail is already on your map', '#39ff6a');
    const where = (fresh.length ? fresh : leads).map((l) => `<div class="item"><b>${l.name}</b> · ${l.reward} REP<br>${l.blurb}</div>`).join('');
    await dialog({ title: 'Case solved', text: `${d.solvedText || ''} The distribution points are marked on your map:<div class="list">${where}</div>` });
    this.done = true;
    // the front page is about this case, not the club zone's rolled theme or boss
    if (d.theme) this.zone.theme = d.theme;
    this.zone.boss = null;
    this.g.endZone(this.zone, { outcome: 'win', rep: d.rep, photo: 'special' });
  }

  // ------------------------------------------------------------------ blackout
  startBlackout() {
    if (this.blackout) return;
    this.snaps.grab(this.g.canvas); // her last frame before it all goes
    this.blackouts++;
    this.view = 'walk'; this.setVideo(false);
    this.blackout = { t: 0, phase: 'cine' };
  }

  updateBlackout(dt) {
    const b = this.blackout, inp = this.g.input;
    b.t += dt;
    if (b.phase === 'cine') {
      const skip = b.t > 1.5 && (inp.pressed('interact') || inp.taps.length);
      inp.taps.length = 0;
      if (b.t < CINE_SECONDS && !skip) return;
      if (this.blackouts >= CAPTURE_AT) { this.capture(); return; }
      this.wake();
      b.phase = 'wake'; b.t = 0;
      return;
    }
    if (b.t > 1.2) this.blackout = null;
  }

  wake() {
    const st = this.g.state;
    const wake = this.club.rooms.filter((r) => BLACKOUT_WAKE.includes(r.kind));
    const r = wake.length ? wake[Math.floor(Math.random() * wake.length)] : this.room;
    this.go(r.id, null);
    this.p.x = r.w / 2; this.cam = r.w / 2;
    st.intox = 60;
    this.scatterPhotos();
    const left = CAPTURE_AT - this.blackouts;
    toast(`You come to in the ${ROOMS[r.kind].name.toLowerCase()}. Somebody took photos of you. Find them.`, 'info');
    if (left === 1) toast('One more blackout and they carry you out of here.', 'bad');
  }

  capture() {
    this.done = true;
    this.g.endZone(this.zone, { outcome: 'captured', reason: 'Dosed with Super Squirt one too many times, she is carried out of the club…' });
  }

  /** The memory-fragment hunt: PHOTOS polaroids of her night in rooms she can reach. */
  scatterPhotos() {
    if (this.photos) this.lostPhotos = (this.lostPhotos || 0) + this.photos.list.filter((p) => !p.found).length;
    const open = this.club.rooms.filter((r) => !ROOMS[r.kind].lock || this.items.has(ROOMS[r.kind].lock));
    const rooms = shuffle([...open]);
    const shots = this.snaps.latest(PHOTOS);
    const art = (ART.polaroids || []).map((src) => { const im = new Image(); im.src = PLATE.dir + src; return im; });
    const times = ['1:47 AM', '2:03 AM', '2:19 AM'];
    const list = [];
    for (let i = 0; i < PHOTOS; i++) {
      const room = rooms[i % rooms.length];
      let x = room.w / 2;
      for (let k = 0; k < 20; k++) {
        x = 300 + Math.random() * (room.w - 600);
        if (room.doors.every((d) => Math.abs(d.x - x) > 200) && list.every((p) => p.room !== room.id || Math.abs(p.x - x) > 400)) break;
      }
      const userArt = art.length && i === PHOTOS - 1 && art[Math.floor(Math.random() * art.length)];
      const src = userArt && userArt.complete && userArt.naturalWidth ? userArt : shots[i % Math.max(1, shots.length)];
      list.push({ room: room.id, x, img: src ? polaroid(src, times[i]) : null, found: false });
    }
    this.photos = { list };
    this.hudPhotos();
  }

  async pickPhoto(ph) {
    ph.found = true; sfx.whoosh();
    const n = this.photos.list.filter((p) => p.found).length;
    this.hudPhotos();
    const img = ph.img ? `<img src="${ph.img.toDataURL('image/jpeg', 0.8)}" style="display:block;width:46%;margin:6px auto;transform:rotate(-3deg);box-shadow:0 6px 18px #000a">` : '';
    await dialog({ title: `Polaroid ${n} of ${this.photos.list.length}`, text: `${img}You, last night, in no state to be photographed. Somebody wanted proof.` });
    if (n < this.photos.list.length) return;
    // all found: the night comes back, with something she saw while she was under
    const st = this.g.state, keys = this.case.unfound();
    st.intox = Math.max(0, st.intox - 20);
    this.photos = null; this.hudPhotos();
    if (keys.length) {
      const k = keys[Math.floor(Math.random() * keys.length)], [kind, id] = k.split(':');
      this.case.find(kind, id);
      await dialog({ title: 'It comes back to you', text: `${this.case.clue(kind, id).text}<span class="hint">Remembered clue (${this.case.count}/${this.case.def.need})</span>` });
    } else toast('The night comes back to you. Nothing new in it.', 'info');
  }

  hudPhotos() {
    const left = this.photos ? this.photos.list.filter((p) => !p.found).length : 0;
    $('hud-extra').innerHTML = left ? `<div class="barlabel"><span>Polaroids to find: ${left}</span></div>` : '';
  }

  leave() {
    if (this.done) return;
    this.done = true;
    // polaroids left behind will surface somewhere: tabloid heat now, blackmail later
    const lost = (this.lostPhotos || 0) + (this.photos ? this.photos.list.filter((p) => !p.found).length : 0);
    const st = this.g.state;
    if (lost) { st.photosLost = (st.photosLost || 0) + lost; st.stashVenue = this.zone?.venue || st.stashVenue; toast(`You left ${lost} polaroid${lost === 1 ? '' : 's'} of yourself behind. They'll turn up.`, 'bad'); }
    this.g.endZone(this.zone, { outcome: 'abort', rep: -LOST_PHOTO_REP * lost });
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
    // the room's backlight from behind and above, then her body graded by the room's light
    ctx.globalAlpha = 0.75; ctx.drawImage(rim, x - wpx / 2 - 1.5 * k, top - 3.5 * k, wpx, hpx);
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
    a.globalCompositeOperation = 'source-atop'; a.fillStyle = L.haze; a.globalAlpha = 0.36; a.fillRect(0, 0, lit.width, lit.height); a.globalAlpha = 1;
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
    // polaroids on the floor: a tilted white square + PHOTO
    if (this.photos) for (const ph of this.photos.list) {
      if (ph.found || ph.room !== r.id) continue;
      const x = this.stage.sx(view, ph.x), y = (this.stage.lane - 40) * k, s = Math.max(10, 46 * k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25 + Math.sin(this.t * 2) * 0.05);
      ctx.fillStyle = '#f4f1e8'; ctx.fillRect(-s / 2, -s / 2, s, s * 1.15);
      ctx.fillStyle = '#3a1a40'; ctx.fillRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6);
      ctx.strokeStyle = '#05040a'; ctx.lineWidth = 2; ctx.strokeRect(-s / 2, -s / 2, s, s * 1.15);
      ctx.restore();
      ctx.save(); ctx.font = `bold ${Math.round(Math.max(12, 24 * k))}px Bangers, Impact, sans-serif`;
      tag(x, y - s - 6, 'PHOTO', '#ff9ad8'); ctx.restore();
    }
    for (const s of r.spots) {
      if (this.taken.has(`${r.id}:${s.x}`)) continue;
      tag(this.stage.sx(view, s.x), (this.stage.lane - 384) * k + bob, { closeup: 'SEARCH ▼', drink: 'DRINK ▼', djview: 'LOOK ▼' }[s.type] || 'LOOK ▼', '#ffd84d');
    }
    if (n.door) tag(this.stage.sx(view, n.door.x), (this.stage.lane - 494) * k + bob, n.door.lock && !this.items.has(n.door.lock) ? 'LOCKED' : 'ENTER ▼', '#fff');
  }

  render(ctx) {
    const g = this.g, w = g.w, h = g.h, st = g.state;
    if (!this.stage) return;
    if (this.blackout?.phase === 'cine') { drawCinematic(ctx, w, h, this.blackout.t, this.snaps.list); return; }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    let view = { k: this.k, x0: this.cam - this.viewW / 2, w, h, oy: this.oy, heroX: this.view === 'walk' ? this.p.x : null };
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
    const world = (fn) => { ctx.save(); ctx.translate(0, -(view.oy || 0)); fn(); ctx.restore(); };
    if (this.view === 'walk') world(() => this.drawHero(ctx, view));
    this.stage.drawFront(ctx, view, this.t, this.dt || 1 / 60);
    afterScene(ctx, g.canvas, w, h, st ? st.intox : 0, this.t);
    // a photo of her night, taken before the markers go on (they'd give the game away)
    if (this.wantSnap && this.view === 'walk') { this.wantSnap = false; this.snaps.grab(g.canvas); }
    if (this.view === 'walk') world(() => this.drawMarkers(ctx, view)); // labels over the columns
    const dark = this.blackout ? clamp(1 - this.blackout.t / 1.2, 0, 1) : this.fade.a;
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
    if (!scene.img) { scene.img = new Image(); scene.img.src = PLATE.dir + scene.src; }
    this.ring = null;
    this.g.input.setStick(false); // its touch zone covers the left of the picture
    document.body.classList.add('closeup-on');
    this.g.input.setButton('interact', { label: 'BACK', lit: false }); this.lastLabel = 'BACK';
    toast('Tap anything that looks out of place.', 'info');
  }

  /** Where the image sits (see closeupFrame), to map taps into its 0..1 space. */
  closeupRect(w, h) {
    const img = this.scene.img;
    return closeupFrame(w, h, img.naturalWidth || 1280, img.naturalHeight || 720, this.scene.spots);
  }

  updateCloseup() {
    const inp = this.g.input, sc = this.scene, kind = this.room.kind;
    if (inp.pressed('interact') || inp.pressed('leave')) { this.view = 'walk'; inp.setStick(true); document.body.classList.remove('closeup-on'); inp.taps.length = 0; return; }
    if (inp.pressed('notes')) { this.caseBoard(); return; }
    const tap = inp.taps.shift();
    if (!tap || UI.open) return;
    const R = this.closeupRect(this.g.w, this.g.h), u = (tap.x - R.x) / R.w, v = (tap.y - R.y) / R.h;
    const hit = sc.spots.find((s) => Math.hypot((u - s.x) * (R.w / R.h), v - s.y) < s.r * 1.25);
    if (!hit) { this.ring = { x: tap.x, y: tap.y, t: 0, miss: true }; return; }
    this.ring = { x: R.x + hit.x * R.w, y: R.y + hit.y * R.h, t: 0 };
    const clue = this.case.clue(kind, hit.id);
    if (!clue) { toast('Nothing useful there.', 'info'); return; }
    const fresh = this.case.find(kind, hit.id);
    if (clue.item && !this.items.has(clue.item)) { this.items.add(clue.item); sfx.whoosh(); }
    if (clue.drink) { this.offerDrink(clue.text); return; }
    const d = this.case.def;
    const hint = fresh ? (clue.flavour ? '' : `<span class="hint">Case board: ${this.case.count}/${d.need} clues${this.case.ready && !this.solved ? ' · you can make an accusation (CASE)' : ''}</span>`) : '';
    dialog({ title: sc.title, text: clue.text + hint });
  }

  renderCloseup(ctx, w, h) {
    const sc = this.scene, img = sc.img, kind = this.room.kind;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if (!img.complete || !img.naturalWidth) return;
    const R = this.closeupRect(w, h);
    ctx.drawImage(img, R.x, R.y, R.w, R.h);
    // found spots get an inked check ring; the last tap ripples (gold on a hit, grey on a miss)
    let seen = 0;
    for (const s of sc.spots) {
      if (!this.case.has(kind, s.id)) continue;
      seen++;
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
    const label = `${sc.title.toUpperCase()} · ${seen}/${sc.spots.length} SEARCHED · CASE ${this.case.count}/${this.case.def.need}`;
    ctx.lineWidth = 5; ctx.strokeStyle = '#05040a'; ctx.strokeText(label, 18, 30); ctx.fillStyle = '#ffd84d'; ctx.fillText(label, 18, 30);
  }

  exit() {
    document.body.classList.remove('closeup-on');
    if (this.video) { this.video.pause(); this.video.remove(); this.video = null; }
    this.stage = null; freeIntox(); this.snaps?.free();
    $('hud-extra').innerHTML = '';
  }
}
