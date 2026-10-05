// One room of a detective nightclub, drawn as layers (docs/design/nightclub.md "How it's built"):
// a plate (the user's pre-rendered art when it exists, a painted comic placeholder until then),
// a far crowd fogged into the haze, the live light rig (moving beams, laser fans, strobes), the
// mid crowd, then — after the mode draws her — the near crowd passing the camera, drifting haze
// and the vignette. Canvas 2D only: no WebGL context (the iPad's limit), one room in memory.
import { PLATE, ROOMS, ART } from './rooms.js';
import { crowdAtlas, drawDancer, CROWD_TYPES, dancersVersion } from './crowd.js';
import { RNG } from '../rng.js';
import { rgba, shade } from '../util.js';

const RES = 0.5;          // placeholder plate canvas px per plate px (a 4096 room = 2048×512)
const FLOOR = PLATE.floor, H = PLATE.h;
const BPM = 124;
const FONT = 'Bangers, Impact, sans-serif';

/** Room tunables by light rig. */
const RIG = {
  beams:  { heads: 380, beamA: 0.5, lasers: true, haze: 0.16 },
  warm:   { heads: 620, beamA: 0.22, lasers: false, haze: 0.10 },
  strobe: { heads: 900, beamA: 0.12, lasers: false, haze: 0.06 },
  dim:    { heads: 900, beamA: 0.10, lasers: false, haze: 0.06 },
};

/** Lighten a #rrggbb toward white by amt (0..1), as #rrggbb (rgba() needs hex). */
const lighten = (hex, amt) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amt) + 255 * amt).toString(16).padStart(2, '0')).join('');
const hashStr = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** A vertical light wedge (white, faded along and across), tinted per colour. */
function beamSprite(col) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, rgba(col, 0.9)); g.addColorStop(0.5, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
  x.fillStyle = g;
  x.beginPath(); x.moveTo(30, 0); x.lineTo(34, 0); x.lineTo(64, 512); x.lineTo(0, 512); x.closePath(); x.fill();
  // soften the sides: erase toward the edges
  const s = x.createLinearGradient(0, 0, 64, 0);
  s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.35, 'rgba(0,0,0,0)'); s.addColorStop(0.65, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = s; x.fillRect(0, 0, 64, 512);
  return c;
}

function glowSprite(col) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, rgba(col, 1)); g.addColorStop(1, rgba(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}

let dots = null;
/** Halftone dot tile for the comic shadow screen. */
function dotTile() {
  if (dots) return dots;
  dots = document.createElement('canvas');
  dots.width = dots.height = 10;
  const x = dots.getContext('2d');
  x.fillStyle = '#000'; x.beginPath(); x.arc(5, 5, 2.1, 0, Math.PI * 2); x.fill();
  return dots;
}

// ------------------------------------------------------------------ placeholder plate
/** Paint a room as a comic placeholder plate (replaced by the user's render when it exists). */
function paintPlate(room, byId, rng) {
  const R = ROOMS[room.kind], L = R.look;
  const c = document.createElement('canvas');
  c.width = Math.round(room.w * RES); c.height = Math.round(H * RES);
  const x = c.getContext('2d');
  x.scale(RES, RES);
  const W = room.w;
  // back wall: dark at the top, glowing haze toward the floor (the light is behind the crowd)
  let g = x.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, shade(L.wall, -0.3)); g.addColorStop(0.55, L.wall); g.addColorStop(1, shade(L.haze, 0.1));
  x.fillStyle = g; x.fillRect(0, 0, W, FLOOR);
  // back glow pools behind the rig
  x.globalCompositeOperation = 'lighter';
  const glow = glowSprite(L.haze);
  for (let px = rng.range(100, 400); px < W; px += rng.range(500, 900)) x.drawImage(glow, px - 420, FLOOR - 620, 840, 760);
  x.globalCompositeOperation = 'source-over';
  // wall panels / pilasters
  x.fillStyle = shade(L.wall, -0.25);
  for (let px = 0; px < W; px += 512) x.fillRect(px + 236, 170, 40, FLOOR - 170);
  x.strokeStyle = rgba(L.accent, 0.35); x.lineWidth = 3;
  for (let px = 0; px < W; px += 512) { x.beginPath(); x.moveTo(px + 238, 180); x.lineTo(px + 238, FLOOR - 10); x.stroke(); }
  // ceiling truss
  x.strokeStyle = '#05040a'; x.lineWidth = 10;
  x.beginPath(); x.moveTo(0, 96); x.lineTo(W, 96); x.moveTo(0, 150); x.lineTo(W, 150); x.stroke();
  x.lineWidth = 5; x.beginPath();
  for (let px = 0; px < W; px += 54) { x.moveTo(px, 96); x.lineTo(px + 54, 150); }
  x.stroke();
  props(x, room, R, L, rng);
  // doorways: a glimpse of the next room's light, a neon sign over each
  for (const d of room.doors) doorway(x, d, d.to ? byId[d.to] : null, L);
  // floor: dark and glossy, reflecting the light above it
  g = x.createLinearGradient(0, FLOOR, 0, H);
  g.addColorStop(0, shade(L.haze, -0.45)); g.addColorStop(1, '#030206');
  x.fillStyle = g; x.fillRect(0, FLOOR, W, H - FLOOR);
  x.globalCompositeOperation = 'lighter';
  for (let px = rng.range(60, 200); px < W; px += rng.range(160, 320)) {
    const r = x.createLinearGradient(0, FLOOR, 0, H);
    r.addColorStop(0, rgba(L.haze, 0.35)); r.addColorStop(1, rgba(L.haze, 0));
    x.fillStyle = r; x.fillRect(px, FLOOR, rng.range(8, 30), H - FLOOR);
  }
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = '#05040a'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(0, FLOOR); x.lineTo(W, FLOOR); x.stroke();
  // halftone screen over the shadows (the comic print look)
  x.globalAlpha = 0.22; x.globalCompositeOperation = 'multiply';
  x.fillStyle = x.createPattern(dotTile(), 'repeat');
  x.fillRect(0, 0, W, 300); x.fillRect(0, FLOOR, W, H - FLOOR);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  return c;
}

/** Ink-outlined shape helper: fill, then the comic line. */
function inked(x, fill, path, lw = 5) {
  x.fillStyle = fill; x.beginPath(); path(); x.fill();
  x.strokeStyle = '#05040a'; x.lineWidth = lw; x.stroke();
}

/** A few props per room kind, so each placeholder reads as its room. */
function props(x, room, R, L, rng) {
  const W = room.w, F = FLOOR, ink = '#0a0812', acc = L.accent;
  const glowRect = (px, py, w, h, col, a = 0.8) => { x.fillStyle = rgba(col, a); x.fillRect(px, py, w, h); };
  switch (room.kind) {
    case 'main': {
      // DJ booth on a truss stage at the far end, an LED wall behind, speaker stacks either side
      const bx = W - 760;
      for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) glowRect(bx + 40 + i * 64, 260 + j * 52, 50, 40, j % 2 ? acc : L.haze, 0.45 + 0.4 * rng.next());
      inked(x, ink, () => x.rect(bx, F - 210, 640, 210));
      inked(x, '#141024', () => x.rect(bx + 120, F - 270, 400, 70));
      glowRect(bx + 150, F - 268, 340, 10, acc, 0.9);
      for (const sx of [bx - 170, bx + 650]) inked(x, '#0c0a14', () => x.rect(sx, F - 420, 150, 420));
      break;
    }
    case 'bar': case 'entrance': {
      const bx = room.kind === 'bar' ? W * 0.3 : W * 0.55, bw = room.kind === 'bar' ? W * 0.45 : 520;
      for (let r = 0; r < 4; r++) for (let px = bx + 20; px < bx + bw - 20; px += 34) glowRect(px, 300 + r * 70, 16, 46 - (px % 3) * 6, rng.pick([acc, L.haze, '#fff2c0']), 0.5 + 0.4 * rng.next());
      inked(x, ink, () => x.rect(bx, F - 170, bw, 170));
      glowRect(bx, F - 172, bw, 8, acc, 0.9);
      if (room.kind === 'entrance') for (const px of [W * 0.25, W * 0.4]) inked(x, '#c8a040', () => { x.rect(px - 6, F - 120, 12, 120); });
      break;
    }
    case 'lounge': case 'vip': {
      for (let px = 300; px < W - 300; px += room.kind === 'vip' ? 700 : 520) {
        inked(x, shade(acc, -0.55), () => x.roundRect(px, F - 190, 360, 190, 40));
        inked(x, '#0d0a14', () => x.rect(px + 120, F - 90, 120, 90));
        glowRect(px + 170, F - 104, 18, 12, '#ffd08a', 1);
      }
      if (room.kind === 'vip') for (let px = 0; px < W; px += 90) glowRect(px, 160, 44, F - 160, shade(acc, -0.6), 0.25);
      break;
    }
    case 'balcony': {
      // the view down onto the main floor: beams below, a railing in front
      x.globalCompositeOperation = 'lighter';
      for (let px = 200; px < W; px += 300) glowRect(px, F - 260, 6, 260, L.haze, 0.25);
      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = '#c8a040'; x.lineWidth = 10;
      x.beginPath(); x.moveTo(0, F - 120); x.lineTo(W, F - 120); x.stroke();
      x.lineWidth = 6; x.beginPath();
      for (let px = 0; px < W; px += 80) { x.moveTo(px, F - 120); x.lineTo(px, F); }
      x.stroke();
      break;
    }
    case 'restroom': {
      for (let px = 300; px < W - 300; px += 360) {
        glowRect(px, 300, 240, 220, '#bfe8ff', 0.25);
        inked(x, '#20262c', () => x.rect(px - 10, F - 160, 260, 40));
      }
      break;
    }
    case 'office': {
      inked(x, '#2a2216', () => x.rect(W * 0.4, F - 150, 520, 150));
      glowRect(W * 0.4 + 180, F - 290, 160, 110, '#9fd0ff', 0.6);
      inked(x, '#3a3a40', () => x.rect(W * 0.72, F - 380, 200, 380));
      break;
    }
    case 'storage': {
      for (let px = 300; px < W - 200; px += 260) for (let k = 0; k < 1 + Math.floor(rng.next() * 3); k++) inked(x, '#4a3a22', () => x.rect(px, F - 140 * (k + 1), 200, 136));
      break;
    }
    case 'alley': {
      x.fillStyle = '#0a1830'; x.fillRect(0, 0, W, 170);
      x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 3;
      for (let py = 190; py < F; py += 40) { x.beginPath(); x.moveTo(0, py); x.lineTo(W, py); x.stroke(); }
      inked(x, '#1e3a2a', () => x.rect(W * 0.55, F - 200, 340, 200));
      break;
    }
    case 'corridor': {
      for (let px = 320; px < W - 300; px += 460) inked(x, shade(acc, -0.4), () => x.rect(px, 330, 180, 250), 4);
      x.strokeStyle = '#2a2a34'; x.lineWidth = 16; x.beginPath(); x.moveTo(0, 210); x.lineTo(W, 210); x.stroke();
      break;
    }
    case 'dark': {
      x.globalCompositeOperation = 'lighter';
      for (let px = 100; px < W; px += 420) glowRect(px, 240, 8, F - 300, acc, 0.35);
      x.globalCompositeOperation = 'source-over';
      break;
    }
  }
}

/** An archway / door / staircase on the back wall, with the target's neon sign above it. */
function doorway(x, d, to, L, foot = FLOOR, signOnly = false) {
  const FLOOR = foot;
  const w = d.kind === 'stairs' ? 230 : 200, h = 380, px = d.x - w / 2, top = FLOOR - h;
  const TL = to ? ROOMS[to.kind].look : { haze: '#1a2a44', accent: '#ffffff' };
  const g = x.createLinearGradient(0, top, 0, FLOOR);
  g.addColorStop(0, shade(TL.haze, -0.5)); g.addColorStop(1, TL.haze);
  if (!signOnly) {
  x.fillStyle = d.lock ? '#120c10' : g;
  x.beginPath();
  if (d.kind === 'arch') { x.moveTo(px, FLOOR); x.lineTo(px, top + w / 2); x.arc(d.x, top + w / 2, w / 2, Math.PI, 0); x.lineTo(px + w, FLOOR); }
  else x.rect(px, top, w, h);
  x.fill();
  x.strokeStyle = '#05040a'; x.lineWidth = 10; x.stroke();
  x.strokeStyle = rgba(TL.accent, 0.8); x.lineWidth = 3; x.stroke();
  if (d.kind === 'stairs') {
    x.strokeStyle = rgba(TL.accent, 0.5); x.lineWidth = 4;
    for (let i = 1; i < 7; i++) { const sy = FLOOR - i * 50; x.beginPath(); x.moveTo(px + 10, sy); x.lineTo(px + w - 10, sy); x.stroke(); }
  }
  }
  if (d.lock) { x.fillStyle = '#ff2a3a'; x.beginPath(); x.arc(px + w - 26, FLOOR - h / 2, 9, 0, Math.PI * 2); x.fill(); }
  const word = to ? ROOMS[to.kind].sign : 'EXIT';
  x.save();
  x.font = `bold 64px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'bottom';
  x.shadowColor = TL.accent; x.shadowBlur = 26; x.fillStyle = shade(TL.accent, 0.35);
  x.fillText(word, d.x, top - 18);
  x.shadowBlur = 0; x.lineWidth = 2; x.strokeStyle = '#05040a'; x.strokeText(word, d.x, top - 18);
  x.restore();
}

/** The user's stitched plate with the club's doors on it: a neon sign over a painted arch, else a doorway. */
function composeArt(img, room, byId, spec) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.scale(img.width / room.w, img.height / H);
  const L = ROOMS[room.kind].look;
  for (const d of room.doors) doorway(x, d, d.to ? byId[d.to] : null, L, spec.back * H, spec.arches.includes(d.x));
  return c;
}

// ------------------------------------------------------------------ the stage
export class ClubStage {
  /** room: a layout room; byId: the club's rooms by id (doorway signs peek into the next room). */
  constructor(room, byId, seed) {
    this.room = room; this.R = ROOMS[room.kind]; this.L = this.R.look; this.rig = RIG[this.R.light];
    const rng = new RNG(hashStr(`${seed}:${room.id}`));
    this.plate = paintPlate(room, byId, rng);
    // the user's render replaces the placeholder once it has loaded (doorway signs are in the art)
    const spec = this.spec = ART.plates[room.kind] || null;
    this.lane = spec ? spec.lane * H : FLOOR + 24;  // her feet
    this.back = spec ? spec.back * H : FLOOR - 40;  // the back wall's foot (the far crowd stands here)
    this.art = null;
    if (spec) { const img = new Image(); img.onload = () => { this.art = composeArt(img, room, byId, spec); }; img.src = PLATE.dir + spec.src; }
    this.rim = lighten(this.L.haze, this.spec ? 0.2 : 0.55);
    this.atlas = crowdAtlas(this.rim);
    const W = room.w, dens = this.R.crowd / 1000;
    const clear = (px) => room.doors.every((d) => Math.abs(d.x - px) > 150);
    // far = small, fogged, slower; mid = full size on the floor line (kept out of doorways);
    // near = huge, pure ink, faster, feet below the frame
    this.far = []; this.mid = []; this.near = [];
    for (let i = 0, n = Math.round(W * dens * 1.3); i < n; i++) this.far.push(spec ? { x: rng.range(0, W), y: this.back + rng.range(5, 40), t: rng.int(0, CROWD_TYPES - 1), o: rng.next(), f: rng.chance(0.5), s: rng.range(0.4, 0.48) } : { x: rng.range(0, W), y: FLOOR - rng.range(20, 70), t: rng.int(0, CROWD_TYPES - 1), o: rng.next(), f: rng.chance(0.5), s: rng.range(0.5, 0.62) });
    for (let i = 0, n = Math.round(W * dens); i < n; i++) {
      const px = rng.range(120, W - 120);
      if (!clear(px)) continue;
      if (spec) { const y = rng.range(this.back + 70, this.lane - 40); this.mid.push({ x: px, y, t: rng.int(0, CROWD_TYPES - 1), o: rng.next(), f: rng.chance(0.5), s: 0.55 + 0.45 * (y - this.back) / (this.lane - this.back) }); }
      else this.mid.push({ x: px, y: FLOOR + rng.range(0, 40), t: rng.int(0, CROWD_TYPES - 1), o: rng.next(), f: rng.chance(0.5), s: rng.range(0.9, 1.05) });
    }
    this.mid.sort((a, b) => a.y - b.y);
    for (let i = 0, n = Math.round(W * dens * 0.22); i < n; i++) this.near.push({ x: rng.range(0, W * 1.3), y: H + rng.range(60, 160), t: rng.int(0, CROWD_TYPES - 1), o: rng.next(), f: rng.chance(0.5), s: rng.range(1.7, 2.0) });
    // the live rig: moving heads along the truss, laser emitters in beam rooms
    const cols = [this.L.accent, lighten(this.L.haze, 0.5), '#ffffff'];
    this.sprites = cols.map(beamSprite);
    this.heads = [];
    for (let px = rng.range(80, 240); px < W; px += this.rig.heads * rng.range(0.8, 1.2)) this.heads.push({ x: px, c: rng.int(0, 2), ph: rng.range(0, 6.28), sp: rng.range(0.25, 0.6), a0: rng.range(-0.25, 0.25) });
    this.lasers = this.rig.lasers ? [{ x: W * 0.3, ph: 0 }, { x: W * 0.72, ph: 2 }] : [];
    this.glow = glowSprite(this.L.haze);
    this.strobe = { next: 0.5, a: 0 };
  }

  /** view: { k (screen px per plate px), x0 (plate x at the screen's left), w, h } */
  sx(view, px, par = 1) { const vw = view.w / view.k, cx = view.x0 + vw / 2; return (px - cx * par + vw / 2) * view.k; }

  drawBack(ctx, view, t) {
    const { k, w, h } = view, beat = (t * BPM) / 60;
    if (this.atlas.version !== dancersVersion()) this.atlas = crowdAtlas(this.rim); // the baked sheet arrived
    // plate
    const vw = w / k;
    const src = this.art || this.plate, sc = src.width / this.room.w;
    ctx.drawImage(src, Math.max(0, view.x0 * sc), 0, Math.min(src.width, vw * sc), src.height, Math.max(0, -view.x0) * k, 0, Math.min(vw, this.room.w) * k, h);
    // far crowd, fogged into the haze
    ctx.globalAlpha = 0.75;
    for (const d of this.far) {
      const x = this.sx(view, d.x, 0.85);
      if (x < -80 || x > w + 80) continue;
      drawDancer(ctx, this.atlas, d.t, t, d.o, x, d.y * k, 300 * d.s * k, d.f);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    const fog = ctx.createLinearGradient(0, (this.back - 260) * k, 0, this.back * k);
    fog.addColorStop(0, rgba(this.L.haze, 0)); fog.addColorStop(1, rgba(this.L.haze, 0.35));
    ctx.fillStyle = fog; ctx.fillRect(0, (this.back - 260) * k, w, 260 * k);
    // moving heads: wedges sweeping from the truss, brightening on the beat
    const pulse = 0.75 + 0.25 * Math.max(0, Math.cos(beat * Math.PI * 2));
    for (const b of this.heads) {
      const x = this.sx(view, b.x);
      if (x < -500 || x > w + 500) continue;
      const a = b.a0 + Math.sin(t * b.sp + b.ph) * 0.55;
      ctx.save(); ctx.translate(x, 150 * k); ctx.rotate(a);
      ctx.globalAlpha = this.rig.beamA * pulse * (this.art ? 0.55 : 1);
      ctx.drawImage(this.sprites[b.c], -90 * k, 0, 180 * k, 900 * k);
      ctx.restore();
    }
    // laser fans
    ctx.lineWidth = Math.max(1, 2 * k);
    for (const L of this.lasers) {
      const x = this.sx(view, L.x);
      if (x < -900 || x > w + 900) continue;
      const sweep = Math.sin(t * 0.7 + L.ph) * 0.5;
      ctx.strokeStyle = rgba(this.L.accent, 0.35 + 0.25 * Math.sin(t * 9 + L.ph));
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + sweep + (i - 5.5) * 0.11; ctx.moveTo(x, 130 * k); ctx.lineTo(x + Math.cos(a + Math.PI) * 2400 * k, 130 * k - Math.sin(a + Math.PI) * 2400 * k * 0.18); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // the DJs behind the decks (main floor), cut off at the booth's front
    if (this.room.kind === 'main' && !this.spec) {
      const bx = this.room.w - 760;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, (FLOOR - 205) * k); ctx.clip();
      drawDancer(ctx, this.atlas, 5, t, 0, this.sx(view, bx + 250), (FLOOR - 130) * k, 300 * k);
      drawDancer(ctx, this.atlas, 6, t, 0.3, this.sx(view, bx + 400), (FLOOR - 130) * k, 290 * k, true);
      ctx.restore();
    }
    // mid crowd on the floor line
    for (const d of this.mid) {
      const x = this.sx(view, d.x);
      if (x < -120 || x > w + 120) continue;
      drawDancer(ctx, this.atlas, d.t, t, d.o, x, d.y * k, 300 * d.s * k, d.f);
    }
  }

  drawFront(ctx, view, t, dt) {
    const { k, w, h } = view, beat = (t * BPM) / 60;
    // ink pillars in the foreground hide the joins between stitched bays
    if (this.spec) for (const q of this.spec.seams) {
      const x = this.sx(view, q), pw = 300 * k;
      if (x < -pw || x > w + pw) continue;
      if (!this.colGrad || this.colGrad.pw !== pw) {
        const g = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0);
        g.addColorStop(0, '#05040a'); g.addColorStop(0.18, shade(this.L.wall, -0.2)); g.addColorStop(0.32, '#0a0912'); g.addColorStop(1, '#030206');
        this.colGrad = { pw, g };
      }
      ctx.save(); ctx.translate(x, 0);
      ctx.fillStyle = this.colGrad.g; ctx.fillRect(-pw / 2, 0, pw, h);
      ctx.fillStyle = '#05040a'; for (const cy of [0.12, 0.62]) ctx.fillRect(-pw / 2 - 6 * k, h * cy, pw + 12 * k, 26 * k);
      ctx.fillStyle = rgba(this.L.haze, 0.5); for (const cy of [0.12, 0.62]) ctx.fillRect(-pw / 2 - 6 * k, h * cy, pw + 12 * k, 3 * k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(this.L.accent, 0.55 + 0.15 * Math.sin(t * 3)); ctx.fillRect(pw * 0.22, h * 0.14, 6 * k, h * 0.46);
      ctx.fillStyle = rgba(this.L.accent, 0.12); ctx.fillRect(pw * 0.22 - 10 * k, h * 0.14, 26 * k, h * 0.46);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#05040a'; ctx.lineWidth = Math.max(2, 5 * k); ctx.strokeRect(-pw / 2, -10, pw, h + 20);
      ctx.restore();
    }
    for (const d of this.near) {
      const x = this.sx(view, d.x, 1.35);
      if (x < -300 || x > w + 300) continue;
      drawDancer(ctx, this.atlas, d.t, t, d.o, x, d.y * k, 300 * d.s * k, d.f);
    }
    // drifting haze
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.rig.haze;
    for (let i = 0; i < 3; i++) {
      const gx = ((t * (14 + i * 9) + i * 700) % (w + 1200)) - 600;
      ctx.drawImage(this.glow, gx - 500, h * (0.3 + i * 0.18) - 300, 1000 + i * 200, 600);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // strobe rooms: near-black, lit only in flashes
    if (this.R.light === 'strobe') {
      const s = this.strobe;
      s.next -= dt; s.a = Math.max(0, s.a - dt * 9);
      if (s.next <= 0) { s.a = 1; s.next = 0.35 + Math.random() * 0.9; }
      ctx.fillStyle = `rgba(0,0,0,${0.86 * (1 - s.a)})`; ctx.fillRect(0, 0, w, h);
      if (s.a > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${0.35 * s.a})`; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; }
    }
    // vignette
    if (!this.vig || this.vig.w !== w || this.vig.h !== h) {
      const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
      this.vig = { w, h, g };
    }
    ctx.fillStyle = this.vig.g; ctx.fillRect(0, 0, w, h);
  }

  /** The DJ booth view: the user's render covering the screen, live beams, the crowd's heads and hands. */
  drawSetPiece(ctx, img, w, h, t, live = true) {
    const iw0 = img.videoWidth || img.width, ih0 = img.videoHeight || img.height;
    const sc = Math.max(w / iw0, h / ih0), iw = iw0 * sc, ih = ih0 * sc;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    if (!live) return; // a video loop brings its own crowd and beams
    const beat = (t * BPM) / 60, pulse = 0.75 + 0.25 * Math.max(0, Math.cos(beat * Math.PI * 2));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.translate(w * (0.18 + i * 0.13), h * 0.08); ctx.rotate(Math.sin(t * (0.3 + i * 0.07) + i) * 0.5);
      ctx.globalAlpha = 0.28 * pulse; ctx.drawImage(this.sprites[i % 3], -h * 0.12, 0, h * 0.24, h * 1.1); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 14; i++) {
      const s = 0.9 + ((i * 37) % 5) * 0.12;
      drawDancer(ctx, this.atlas, i % CROWD_TYPES, t, i * 0.13, w * (i / 13), h * (1.2 + ((i * 53) % 7) * 0.02), h * 0.5 * s, i % 2 === 0);
    }
  }

  /** Is the strobe lit right now (clues in the dark room only show in a flash)? */
  get flashing() { return this.R.light !== 'strobe' || this.strobe.a > 0.2; }
}
