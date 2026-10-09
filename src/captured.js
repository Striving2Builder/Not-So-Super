// Captured! A hotspot escape puzzle. The heroine is tied to a chair next to a power-draining
// crystal. Distract the guard, scoot the chair, then either kill the crystal's power or grab the keys.
import { HERO, BOSSES, VENUES, CAPTURE_VIDEOS } from './data.js';
import { drawHumanoid, pose, HERO_LOOK, npcLook, glow, portrait } from './art.js';
import { pick, shuffle, fitScene, $ } from './util.js';
import { dialog, toast, banner } from './ui.js';
import { sfx } from './sfx.js';
import { mediaFolders } from './media.js';
import * as THREE from 'three';
import { heroReady, HeroSprite } from './hero3d.js';

// The rigged 3D Supergirl, sat on the chair: scene pixels per metre (the painted room's scale,
// matching the old 2D figure) and the seat height her hips rest on.
const PX_PER_M = 125;
const SEAT_M = 0.5;

const LW = 1000, LH = 600;

// Painted room background (assets/capture/room.png, 1200x720 → drawn at 1000x600).
// Everything below is laid out in the 1000x600 scene space to match that painting.
const ROOM = new Image();
ROOM.src = 'assets/capture/room.png';
const L = {
  floorY: 468,                                   // where feet touch the floor
  screen: { x: 290, y: 89, w: 413, h: 214 },     // the big wall TV (video plays here)
  vent: { x: 0, y: 12, w: 102, h: 110 },
  tableTop: 330, keys: { x: 150, y: 326 },
  cradle: { x: 773, y: 283 },                    // glass cup on the brass stand
  socket: { x: 862, y: 366 },
  guardX: 948,
  seats: { centre: 500, table: 330, lamp: 640 }, // chair positions (heroine x)
};
const LINES = {
  water: 'Ask for a glass of water',
  faint: 'Pretend to faint',
  phone: '"Your boss is calling you — I heard your phone."',
};
const HINTS = {
  water: 'He keeps yawning and looking at the water cooler in the hall. Probably helpful if someone gave him a reason to go.',
  faint: 'He looks nervous. "The boss said NOT to hurt her," he mutters to himself.',
  phone: 'He keeps checking his phone, terrified of missing a call from the boss.',
};

export class Captured {
  constructor(g) { this.g = g; }

  enter({ zone, reason, direct }) {
    const g = this.g;
    this.zone = zone;
    this.direct = !!direct;
    this.done = false;
    this.busy = false;
    this.t = 0;
    this.moves = 7;
    this.villain = zone.boss || pick(BOSSES);
    this.venue = VENUES[zone.venue];
    this.works = pick(Object.keys(LINES));
    this.guardAway = 0;
    this.attentive = false;
    this.scoot = null;          // 'table' | 'lamp'
    this.crystalOff = false;
    this.keys = false;
    this.guardLook = npcLook('guard');
    this.chairX = L.seats.centre;
    this.chairDrawX = this.chairX;
    g.input.setStick(false);
    g.input.setButtons([]);
    $('hud-extra').innerHTML = '';
    $('hud-title').textContent = `CAPTURED — ${zone.venue}`;
    $('objectives').classList.add('on');
    g.vice = { active: true, where: zone.venue, rate: 1 };
    this.hotspots = [
      { id: 'self', name: `${HERO} (you)`, x: 0, y: 290, w: 170, h: 185 },   // x follows the chair
      { id: 'crystal', name: '$-tonite Crystal', x: 738, y: 240, w: 80, h: 200 },
      { id: 'socket', name: 'Power Cord', x: 822, y: 340, w: 70, h: 100 },
      { id: 'guard', name: 'Guard', x: 900, y: 215, w: 100, h: 255 },
      { id: 'keys', name: 'Key Ring', x: 90, y: 292, w: 130, h: 56 },
      { id: 'monitor', name: 'Monitor', ...L.screen },
      { id: 'vent', name: 'Air Vent', ...L.vent },
    ];
    this.setupVideo(zone);
    banner('CAPTURED!', reason || '', '#ff3fb8');
    this.intro(reason);
  }

  exit() {
    $('objectives').classList.remove('on');
    this.stopVideo();
  }

  // ------------------------------------------------------------------ monitor video
  /** Loop a villain video on the wall TV if any are listed in CAPTURE_VIDEOS (data.js). */
  setupVideo(zone) {
    this.stopVideo();
    const token = (this.videoToken = {});
    mediaFolders().then((folders) => {
      if (this.videoToken !== token || this.done) return; // left the scene while the list loaded
      const named = (CAPTURE_VIDEOS[zone.venue] || []).concat(CAPTURE_VIDEOS.any || []).map((f) => 'assets/video/' + f);
      const list = named.concat(folders[CAPTURE_VIDEOS.folder] || []);
      if (list.length) this.startVideo(pick(list));
    });
  }

  startVideo(url) {
    const v = document.createElement('video');
    v.src = url;
    v.loop = true;
    v.setAttribute('loop', '');
    v.playsInline = true;           // iOS: play inside the page, not fullscreen
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    // `loop` is dropped the first time a clip with sound plays (iOS). Start it again from the end.
    v.onended = () => { v.currentTime = 0; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); };
    // Try with sound first (the player has tapped plenty by now); fall back to muted autoplay.
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    this.video = v;
  }

  stopVideo() {
    this.videoToken = null;
    const v = this.video;
    if (!v) return;
    v.pause();
    v.removeAttribute('src');
    v.load();
    this.video = null;
  }

  async intro(reason) {
    this.busy = true;
    if (this.direct) {
      // Sometimes the villain skips the chair and goes straight to the deal.
      await dialog({ title: 'Captured!', text: `${reason || ''}<br><br>${HERO} comes to with ${this.villain} leaning over her, smiling.` });
      this.done = true;
      this.g.endCapture(this.zone, false, this.villain);
      return;
    }
    await dialog({ title: 'Captured!', text: `${reason || ''}<br><br>${HERO} wakes up tied to a chair. A glowing green <b>$-tonite</b> crystal hums beside her, draining her powers.<span class="hint">Tap things in the scene to act. Each action uses one of your ${this.moves} moves before ${this.villain} returns. Talking to the villain on the monitor is free.</span>` });
    const v = await dialog({
      speaker: this.villain, cls: 'villain',
      text: `"Comfortable? Don't bother struggling — that crystal keeps you weaker than a kitten. When I get back we'll discuss your… <em>future</em> with my organization."`,
      options: [
        { label: '"You won\'t get away with this."', note: 'Defiant', value: 'defy' },
        { label: '"Wait! Tell me about your plan first…"', note: 'Stall for time: +1 move', value: 'stall' },
        { label: '"Okay, okay… I\'ll cooperate."', note: 'Play along: −3 rep, the guard relaxes', value: 'play' },
      ],
    });
    if (v === 'stall') { this.moves++; await dialog({ speaker: this.villain, text: '"Ah, a fan! Well, it all began when I was a small, misunderstood child…" (the monologue goes on for a while)' }); }
    if (v === 'play') { this.g.state.addRep(-3, 'Footage of you begging'); this.attentive = false; this.relaxed = true; }
    this.busy = false;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    // The villain gloats from the wall TV now and then.
    this.tauntT = (this.tauntT ?? 3) - dt;
    if (this.tauntT <= 0 && !this.busy) {
      this.tauntT = 7 + Math.random() * 5;
      const f = this.frame(), s = L.screen;
      this.g.commentary.villainTV(this.villain, f.ox + (s.x + s.w * 0.7) * f.s, f.oy + (s.y + s.h * 0.55) * f.s);
    }
    const inp = this.g.input;
    if (!this.busy) for (const tap of inp.taps) { this.tap(tap.x, tap.y); break; }
    const rows = [
      [`Moves left: ${this.moves}`, false, true],
      ['Distract the guard', this.guardAway > 0],
      [this.scoot ? `Chair scooted toward the ${this.scoot}` : 'Get closer to something useful', !!this.scoot],
      [this.crystalOff ? 'Crystal powered down!' : this.keys ? 'You have the keys!' : 'Weaken the crystal — or get the keys', this.crystalOff || this.keys],
      ['Break free', false],
    ];
    const html = rows.map(([t, d, cur]) => `<div class="${d ? 'done' : cur ? 'cur' : ''}">${d ? '✓' : '•'} ${t}</div>`).join('');
    const el = $('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('hud-sub').textContent = this.guardAway > 0 ? `Guard is gone for ${this.guardAway} more move${this.guardAway > 1 ? 's' : ''}!` : 'The guard is watching';
  }

  hud() {}

  /** Scene-to-screen fit, panned up while a dialog is open (see render). */
  frame() {
    const f = fitScene(this.g.w, this.g.h, LW, LH);
    return { ...f, oy: f.oy - (this.lift || 0) };
  }

  toLogical(x, y) {
    const f = this.frame();
    return { x: (x - f.ox) / f.s, y: (y - f.oy) / f.s };
  }

  async tap(sx, sy) {
    const { x, y } = this.toLogical(sx, sy);
    const hsp = this.hotspots.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h && this.visible(h));
    if (!hsp) return;
    this.busy = true;
    try { await this.act(hsp); } finally { this.busy = false; }
    if (!this.done && this.moves <= 0) this.fail();
  }

  visible(h) {
    if (h.id === 'guard') return this.guardAway <= 0;
    if (h.id === 'keys') return !this.keys;
    return true;
  }

  guardPresent() { return this.guardAway <= 0; }

  spend() {
    this.moves--;
    if (this.guardAway > 0) {
      this.guardAway--;
      if (this.guardAway === 0) toast('The guard is back.', 'bad');
    }
  }

  async act(h) {
    const present = this.guardPresent();
    switch (h.id) {
      case 'monitor': {
        await dialog({ speaker: `${this.villain} (on screen)`, cls: 'villain', text: pick([
          '"Enjoying the crystal? A little souvenir from space. It\'s adorable how weak you get."',
          '"Tomorrow the whole city finds out their hero is just a girl in a cape tied to a chair."',
          '"My guard is an idiot, but he\'s MY idiot. Don\'t try anything."',
        ]) + '<span class="hint">(Free action)</span>' });
        return;
      }
      case 'vent':
        await dialog({ title: 'Air Vent', text: 'Fresh air. Freedom is right there… if you weren\'t tied to a chair.<span class="hint">(Free action)</span>' });
        return;
      case 'guard': {
        const v = await dialog({
          speaker: 'Guard', portrait: portrait(this.guardLook),
          text: `He stands by the door with his arms crossed.<span class="hint">${HINTS[this.works]}</span>`,
          options: [...Object.entries(LINES).map(([k, l]) => ({ label: l, value: k, note: '1 move' })), { label: 'Say nothing', value: null }],
        });
        if (!v) return;
        this.spend();
        if (v === this.works) {
          this.guardAway = 2; this.attentive = false; sfx.door();
          await dialog({ speaker: 'Guard', text: v === 'water' ? '"Ugh. Fine. Don\'t go anywhere." He steps out.' : v === 'faint' ? '"Hey! HEY! Oh no, the boss will kill me — I\'ll get the medic!" He runs out.' : '"The boss?! Where\'s my— I left it in the break room!" He rushes out.' });
          toast('The guard is gone for 2 moves — act fast!', 'good');
        } else {
          this.attentive = true; sfx.lose();
          await dialog({ speaker: 'Guard', text: '"Nice try, cape. I\'m watching you." He pulls his chair closer.' });
        }
        return;
      }
      case 'self': {
        const opts = [
          { label: 'Scoot the chair toward the table', value: 'table', note: '1 move', disabled: this.scoot === 'table' },
          { label: 'Scoot the chair toward the crystal', value: 'lamp', note: '1 move', disabled: this.scoot === 'lamp' },
          { label: 'Strain against the ropes', value: 'strain', note: '1 move' },
        ];
        if (this.keys) opts.unshift({ label: 'Unlock the cuffs with the keys', value: 'unlock', cls: 'good' });
        opts.push({ label: 'Do nothing', value: null });
        const v = await dialog({ title: HERO, text: `The ropes are tight${this.crystalOff ? ', but you feel your strength returning!' : ' and the crystal leaves you weak.'}`, options: opts });
        if (!v) return;
        if (v === 'unlock') return this.escape('You twist the key with your fingertips and the cuffs drop.');
        this.spend();
        if (v === 'strain') {
          if (this.crystalOff) return this.escape('With the crystal dark, your strength floods back. The ropes snap like spaghetti.');
          sfx.hurt();
          await dialog({ text: 'You strain until your arms shake. Nothing. The crystal pulses smugly.' + (present ? ' The guard snickers.' : '') });
          return;
        }
        if (present && (this.attentive || !this.relaxed)) {
          this.scoot = null; this.chairX = L.seats.centre; sfx.lose();
          await dialog({ speaker: 'Guard', text: '"Sit STILL!" He drags your chair back to the middle of the room.' });
          return;
        }
        this.scoot = v; this.chairX = v === 'table' ? L.seats.table : L.seats.lamp; sfx.whoosh();
        toast(`Scooted toward the ${v === 'table' ? 'table' : 'crystal'}`, 'good');
        return;
      }
      case 'crystal':
      case 'socket': {
        if (this.crystalOff) { await dialog({ text: 'The crystal is dark and harmless now.' }); return; }
        if (this.scoot !== 'lamp') { await dialog({ title: h.name, text: 'The crystal is powered by a cord plugged into the wall. It\'s out of reach from here.' }); return; }
        const v = await dialog({ title: h.name, text: 'Your boot can just reach the power cord.', options: [{ label: 'Kick the plug out of the wall', value: true, note: '1 move' }, { label: 'Not now', value: false }] });
        if (!v) return;
        this.spend();
        if (present) {
          sfx.lose();
          await dialog({ speaker: 'Guard', text: '"Oh no you don\'t." He plugs it right back in and shoves your chair away.' });
          this.scoot = null; this.chairX = L.seats.centre;
          return;
        }
        this.crystalOff = true; sfx.pickup();
        toast('The crystal flickers and goes dark!', 'good');
        return;
      }
      case 'keys': {
        if (this.scoot !== 'table') { await dialog({ title: 'Key Ring', text: 'The guard left his keys on the table. Too far to reach from the middle of the room.' }); return; }
        const v = await dialog({ title: 'Key Ring', text: 'You could hook the ring with the toe of your boot…', options: [{ label: 'Grab the keys', value: true, note: '1 move' }, { label: 'Not now', value: false }] });
        if (!v) return;
        this.spend();
        if (present) {
          sfx.lose();
          await dialog({ speaker: 'Guard', text: '"Hey!" He snatches the keys and pockets them. Then drags your chair back.' });
          this.hotspots = this.hotspots.filter((q) => q.id !== 'keys');
          this.scoot = null; this.chairX = L.seats.centre;
          return;
        }
        this.keys = true; sfx.pickup();
        toast('Got the keys! Tap yourself to unlock the cuffs.', 'good');
      }
    }
  }

  escape(text) {
    if (this.done) return;
    this.done = true;
    sfx.win();
    banner('ESCAPED!', '', '#3ee08a');
    dialog({ title: 'Free!', text }).then(() => this.g.endCapture(this.zone, true, this.villain));
  }

  fail() {
    if (this.done) return;
    this.done = true;
    sfx.lose();
    dialog({ speaker: this.villain, cls: 'villain', text: `The door swings open. "Out of time, hero. Now… let's make a deal."` })
      .then(() => this.g.endCapture(this.zone, false, this.villain));
  }


  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h;
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    // While a dialog is open along the bottom, pan the room up just enough that she (and her
    // chair) stay visible above it, capped so the wall TV doesn't slide under the HUD.
    const box = document.querySelector('#modal-root .dlg .modal');
    const base = fitScene(W, H, LW, LH);
    let want = 0;
    if (box) want = Math.max(0, Math.min(H * 0.24, base.oy + (L.floorY + 12) * base.s - (box.getBoundingClientRect().top - 10)));
    this.lift = (this.lift || 0) + (want - (this.lift || 0)) * 0.18;
    const f = this.frame();
    ctx.save();
    ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
    ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();

    // Chair glides to its new spot instead of teleporting.
    this.chairDrawX += (this.chairX - this.chairDrawX) * 0.12;
    this.hotspots[0].x = this.chairDrawX - 85;

    if (ROOM.complete && ROOM.naturalWidth) ctx.drawImage(ROOM, 0, 0, LW, LH);
    else this.drawFallbackRoom(ctx);
    if (this.venue) { ctx.fillStyle = this.venue.wall + '26'; ctx.fillRect(0, 0, LW, LH); } // faint venue tint

    this.drawScreen(ctx);
    this.drawKeys(ctx);
    this.drawCrystal(ctx);
    this.drawChairAndHero(ctx);
    if (this.guardPresent()) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(L.guardX, L.floorY, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
      drawHumanoid(ctx, L.guardX, L.floorY, 2.45, -1, this.guardLook, pose(this.attentive ? 'guard' : 'stand', this.t), this.t);
      if (this.attentive) { ctx.font = '900 34px system-ui'; ctx.textAlign = 'center'; ctx.fillText('👁', L.guardX, 200); }
    }
    this.drawHints(ctx);
    ctx.restore();
  }

  drawFallbackRoom(ctx) {
    ctx.fillStyle = this.venue ? this.venue.wall : '#333333'; ctx.fillRect(0, 0, LW, 420);
    ctx.fillStyle = '#26262a'; ctx.fillRect(0, 420, LW, LH - 420);
    ctx.fillStyle = '#555'; ctx.fillRect(L.vent.x + 6, L.vent.y + 6, L.vent.w - 12, L.vent.h - 12);
    const s = L.screen; ctx.fillStyle = '#222'; ctx.fillRect(s.x - 20, s.y - 16, s.w + 40, s.h + 32);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(0, L.tableTop, 229, 14); ctx.fillRect(10, L.tableTop, 12, 124); ctx.fillRect(205, L.tableTop, 12, 124);
    ctx.fillStyle = '#9a7a30'; ctx.fillRect(762, 300, 22, 130); ctx.fillRect(748, 420, 50, 12);
    ctx.fillStyle = '#3a3f48'; ctx.fillRect(918, 110, 82, 340);
  }

  /** Wall TV: plays a villain video if one is configured, otherwise a live green silhouette feed. */
  drawScreen(ctx) {
    const s = L.screen, v = this.video;
    ctx.save();
    ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
    if (v && v.readyState >= 2 && v.videoWidth) {
      // cover-fit the video into the screen
      const k = Math.max(s.w / v.videoWidth, s.h / v.videoHeight);
      const w = v.videoWidth * k, h = v.videoHeight * k;
      ctx.drawImage(v, s.x + (s.w - w) / 2, s.y + (s.h - h) / 2, w, h);
    } else {
      ctx.fillStyle = 'rgba(4,30,12,.55)'; ctx.fillRect(s.x, s.y, s.w, s.h);
      const cx = s.x + s.w / 2, bob = Math.sin(this.t * 1.5) * 2;
      ctx.fillStyle = 'rgba(10,40,16,.9)';
      ctx.beginPath(); ctx.arc(cx, s.y + 88 + bob, 38, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 95, s.y + s.h); ctx.quadraticCurveTo(cx - 90, s.y + 132, cx, s.y + 128); ctx.quadraticCurveTo(cx + 90, s.y + 132, cx + 95, s.y + s.h); ctx.fill();
      ctx.fillStyle = '#7dff9a'; ctx.fillRect(cx - 20, s.y + 82 + bob, 12, 5); ctx.fillRect(cx + 8, s.y + 82 + bob, 12, 5);
      ctx.fillStyle = '#c8ffd4'; ctx.font = '800 14px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`● LIVE — ${this.villain.toUpperCase()}`, s.x + 12, s.y + 22);
    }
    // scanlines + glass glare
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let y = s.y; y < s.y + s.h; y += 4) ctx.fillRect(s.x, y, s.w, 2);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(s.x, s.y + ((this.t * 60) % s.h), s.w, 3);
    const gl = ctx.createLinearGradient(s.x, s.y, s.x + s.w * 0.6, s.y + s.h);
    gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.restore();
  }

  drawKeys(ctx) {
    if (this.keys) return;
    const { x, y } = L.keys;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 4, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0c060'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y - 2, 11, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8c860';
    ctx.fillRect(x + 8, y - 3, 22, 4); ctx.fillRect(x + 24, y + 1, 3, 4); ctx.fillRect(x + 18, y + 1, 3, 3);
    ctx.fillStyle = '#c0c8d0'; ctx.fillRect(x - 6, y - 1, 4, 16); ctx.fillRect(x - 8, y + 11, 3, 4);
    if (Math.sin(this.t * 3) > 0.7) { ctx.fillStyle = 'rgba(255,240,180,.8)'; ctx.fillRect(x + 22, y - 5, 2, 2); }
  }

  drawCrystal(ctx) {
    const { x, y } = L.cradle, on = !this.crystalOff;
    const pulse = 0.75 + Math.sin(this.t * 3) * 0.25;
    if (on) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * pulse;
      ctx.drawImage(glow('#39ff6a'), x - 150, y - 150, 300, 300);
      ctx.globalAlpha = 0.25 * pulse;
      ctx.drawImage(glow('#39ff6a'), this.chairDrawX - 160, 200, 320, 320); // it bathes her in green
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // faceted crystal sitting in the glass cup
    const top = y - 30, mid = y - 4, bot = y + 18;
    ctx.fillStyle = on ? '#2fe060' : '#1e3a26';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 13, mid); ctx.lineTo(x, bot); ctx.lineTo(x - 13, mid); ctx.closePath(); ctx.fill();
    ctx.fillStyle = on ? '#9dffb8' : '#2e5038';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 13, mid); ctx.lineTo(x, mid + 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = on ? '#18a040' : '#15281b';
    ctx.beginPath(); ctx.moveTo(x, bot); ctx.lineTo(x - 13, mid); ctx.lineTo(x, mid + 4); ctx.closePath(); ctx.fill();
    if (!on) {
      // the kicked-out plug lying on the floor beside the socket
      ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(L.socket.x - 30, 430); ctx.quadraticCurveTo(L.socket.x - 10, 445, L.socket.x + 4, 438); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(L.socket.x + 2, 431, 16, 12);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(L.socket.x + 18, 433, 6, 2); ctx.fillRect(L.socket.x + 18, 439, 6, 2);
    }
  }

  drawChairAndHero(ctx) {
    const x = this.chairDrawX, fy = L.floorY;
    const face = this.scoot === 'table' ? -1 : 1; // she looks toward what she is reaching for
    const back = -face;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(x, fy + 2, 80, 12, 0, 0, Math.PI * 2); ctx.fill();
    const wood = '#4a2e18', woodHi = '#6a4426';
    // back post + rail (behind her)
    ctx.fillStyle = wood; ctx.fillRect(x + back * 46 - 7, fy - 200, 14, 200);
    ctx.fillStyle = woodHi; ctx.fillRect(x + back * 46 - 7, fy - 200, 4, 200);
    ctx.fillStyle = wood; ctx.fillRect(x + back * 46 - 9, fy - 190, 18, 12);
    if (heroReady()) this.drawSeatedHero(ctx, x, fy, face);
    else drawHumanoid(ctx, x, fy, 2.3, face, HERO_LOOK, pose('sitTied', this.t), this.t);
    // seat + front leg
    ctx.fillStyle = wood;
    ctx.fillRect(x - 52, fy - 58, 104, 10);
    ctx.fillRect(x + face * 44 - 5, fy - 50, 10, 50);
    ctx.fillStyle = woodHi; ctx.fillRect(x - 52, fy - 58, 104, 3);
    // rope binding her to the post
    ctx.strokeStyle = '#d8c28a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + back * 46, fy - 118); ctx.lineTo(x + face * 6, fy - 112); ctx.moveTo(x + back * 46, fy - 96); ctx.lineTo(x + face * 6, fy - 92); ctx.stroke();
  }

  /**
   * The rigged model, posed seated: hips dropped to the seat, thighs forward, shins down, arms
   * pulled behind the backrest. She strains against the ropes now and then. Rendered in a slight
   * three-quarter view, then shaded to the dim green-lit room.
   */
  drawSeatedHero(ctx, x, fy, face) {
    if (!this.sprite) { this.sprite = new HeroSprite(240, 300); this.sprite.hero.setWind(0, -2, -1); }
    const sp = this.sprite, M = sp.hero, B = M.bones;
    M.root.position.y = 0;
    M.pose('idle', this.t * 0.7);
    if (this.hipY === undefined) { M.root.updateWorldMatrix(true, true); this.hipY = B.Hips ? B.Hips.getWorldPosition(new THREE.Vector3()).y : 0.95; }
    M.root.position.y = SEAT_M - this.hipY;
    M.root.updateWorldMatrix(true, true);
    const q = M.root.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q), left = new THREE.Vector3(1, 0, 0).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0);
    const strain = Math.max(0, Math.sin(this.t * 1.7)) ** 6 * (this.crystalOff ? 0.35 : 0.15); // tugging at the ropes
    for (const [s, sg] of [['Left', 1], ['Right', -1]]) {
      const out = left.clone().multiplyScalar(sg);
      M.aim(`${s}UpLeg`, `${s}Leg`, fwd.clone().addScaledVector(out, 0.14).addScaledVector(up, -0.06).normalize());
      M.aim(`${s}Leg`, `${s}Foot`, up.clone().negate().addScaledVector(fwd, 0.1).addScaledVector(out, 0.04).normalize());
      M.aim(`${s}Arm`, `${s}ForeArm`, up.clone().negate().addScaledVector(fwd, -0.6 - strain).addScaledVector(out, 0.18 + strain).normalize());
      M.aim(`${s}ForeArm`, `${s}Hand`, fwd.clone().negate().addScaledVector(out, -0.9).addScaledVector(up, -0.15).normalize());
    }
    if (B.Head) M.aim('Neck', 'Head', up.clone().addScaledVector(fwd, 0.12 + strain * 0.5).normalize(), 0.8);
    const span = 2.4, lift = 0.05;
    const img = sp.render({ view: 'side', yaw: face * (Math.PI / 2 - 0.4), span, lift });
    // Shade her into the room: darker than the sprite's studio lights, greener while the crystal glows.
    const tc = this.tint || (this.tint = document.createElement('canvas'));
    if (tc.width !== img.width || tc.height !== img.height) { tc.width = img.width; tc.height = img.height; }
    const t = tc.getContext('2d');
    t.globalCompositeOperation = 'copy'; t.drawImage(img, 0, 0);
    t.globalCompositeOperation = 'source-atop';
    t.fillStyle = this.crystalOff ? 'rgba(10,14,30,.28)' : 'rgba(8,40,18,.34)'; t.fillRect(0, 0, tc.width, tc.height);
    const h = span * PX_PER_M, w = h * (img.width / img.height);
    ctx.drawImage(tc, x - w / 2 - face * 8, fy + lift * PX_PER_M - h, w, h);
  }

  drawHints(ctx) {
    const ptr = this.g.input.pointer;
    if (ptr.x >= 0 && !document.body.classList.contains('touch') && !this.busy) {
      const { x, y } = this.toLogical(ptr.x, ptr.y);
      const h = this.hotspots.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h && this.visible(h));
      if (h) {
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(h.x, h.y, h.w, h.h); ctx.setLineDash([]);
        ctx.font = '800 16px system-ui'; ctx.textAlign = 'center';
        const w = ctx.measureText(h.name).width + 16;
        const ly = h.y > 40 ? h.y - 30 : h.y + h.h + 6;
        ctx.fillStyle = 'rgba(8,12,26,.85)'; ctx.fillRect(h.x + h.w / 2 - w / 2, ly, w, 24);
        ctx.fillStyle = '#fff'; ctx.fillText(h.name, h.x + h.w / 2, ly + 18);
      }
    }
    // touch hint: pulse all hotspots briefly
    if (document.body.classList.contains('touch') && this.t < 6) {
      ctx.strokeStyle = `rgba(255,210,63,${0.5 + Math.sin(this.t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      for (const h of this.hotspots) if (this.visible(h)) ctx.strokeRect(h.x, h.y, h.w, h.h);
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(8,12,26,.8)'; ctx.fillRect(20, 540, 200, 44);
    ctx.fillStyle = this.moves <= 2 ? '#ff4d6a' : '#fff'; ctx.font = '900 22px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`MOVES LEFT: ${this.moves}`, 34, 570);
  }
}
