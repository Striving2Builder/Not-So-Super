// Airborne events: short rescues that happen in the sky over the city, played entirely in flight.
// They make the altitude bands and perching matter:
//   faller  — a window-washer dangling from a tower, then falling: catch them at their height
//   car     — a runaway car (brakes gone) or a getaway car (dodges her): stop it at rooftop height
//   heli    — a news helicopter losing its engine, spiralling down: catch it before it hits
//   rings   — an optional stunt course of hoops at different heights, against the clock
//   kitten  — a kitten stuck on a rooftop: perch on that roof to rescue it
// The overworld owns this (update/draw hooks); each event exposes a marker for arrows, the map
// and the waypoint list.
import { BLOCK, ROAD } from './city.js';
import { BANDS } from './flight.js';
import { clamp, pick, chance, rand, dist, rgba } from './util.js';
import { toast } from './ui.js';
import { comic } from './comic.js';
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
const LOW_ENOUGH = 260; // cars can only be grabbed from about rooftop-skim height

// Reward and give-up costs per kind.
const KINDS = {
  faller: { reward: 6, fail: -2, color: '#ffd23f', glyph: '!', label: 'Falling window-washer' },
  car: { reward: 7, fail: -2, color: '#ff8a3d', glyph: '!', label: 'Runaway car' },
  getaway: { reward: 9, fail: -2, color: '#ff3d3d', glyph: '$', label: 'Getaway car' },
  heli: { reward: 10, fail: -3, color: '#ff5a5a', glyph: '!', label: 'Helicopter in trouble' },
  rings: { reward: 4, fail: 0, color: '#6ff7ff', glyph: '◎', label: 'Stunt course' },
  kitten: { reward: 2, fail: 0, color: '#ffb36b', glyph: '🐱', label: 'Kitten on a roof' },
};

export class AirEvents {
  constructor(ow) {
    this.ow = ow;
    this.reset();
  }

  reset() {
    this.list = [];
    this.urgentT = rand(20, 35);  // next falling person / car / helicopter
    this.ringsT = rand(40, 70);   // next stunt course
    this.kittenT = rand(8, 20);   // next kitten
    this.carry = null;            // someone she's carrying down after a catch
  }

  get g() { return this.ow.g; }
  get hero() { return this.ow.hero; }

  /** Diving into an incident: urgent events are resolved by someone else (no penalty). */
  abandon() {
    for (const e of this.list) if (e.kind === 'heli') this.releaseHeli(e);
    this.list = this.list.filter((e) => e.kind === 'kitten');
    this.carry = null;
  }

  /** Markers for off-screen arrows, the map and the waypoint list. */
  markers() {
    return this.list.filter((e) => e.kind !== 'rings' || e.next < e.rings.length).map((e) => {
      const p = e.kind === 'rings' ? e.rings[e.next] : e;
      return { x: p.x, y: p.y, color: KINDS[e.kind].color, glyph: KINDS[e.kind].glyph, name: e.label || KINDS[e.kind].label, ref: e, t: e.ttl - e.t };
    });
  }

  // ------------------------------------------------------------------ spawning
  update(dt) {
    const st = this.g.state;
    if (!st) return;
    this.urgentT -= dt; this.ringsT -= dt; this.kittenT -= dt;
    const has = (k) => this.list.some((e) => e.kind === k || (k === 'car' && e.kind === 'getaway'));
    const urgent = this.list.some((e) => ['faller', 'car', 'getaway', 'heli'].includes(e.kind));
    if (this.urgentT <= 0 && !urgent) {
      this.urgentT = rand(35, 60);
      const kind = pick(st.isNight ? ['faller', 'car', 'getaway', 'getaway', 'heli'] : ['faller', 'faller', 'car', 'getaway', 'heli']);
      this.spawn(kind);
    }
    if (this.ringsT <= 0 && !has('rings')) { this.ringsT = rand(80, 120); this.spawn('rings'); }
    if (this.kittenT <= 0 && !has('kitten')) { this.kittenT = rand(40, 70); this.spawn('kitten'); }

    for (const e of [...this.list]) {
      e.t += dt;
      const res = this[`step_${e.kind === 'getaway' ? 'car' : e.kind}`](e, dt);
      if (res === 'won') this.win(e);
      else if (res === 'lost' || e.t > e.ttl) this.lose(e, res === 'lost');
    }
    if (this.carry) { this.carry.t += dt; if (this.carry.t > 2.2) { toast(this.carry.done, 'good'); this.carry = null; } }
  }

  spawn(kind) {
    const e = this[`make_${kind === 'getaway' ? 'car' : kind}`](kind);
    if (!e) return null;
    Object.assign(e, { kind, t: 0 });
    this.list.push(e);
    const K = KINDS[kind];
    if (kind === 'rings') toast('◎ A stunt course has appeared nearby: fly through the hoops in order!', 'info');
    else if (kind === 'kitten') toast('🐱 A kitten is stuck on a rooftop. Perch there to rescue it.', 'info');
    else { toast(`🚨 ${e.label || K.label}! (${e.hint})`, 'bad'); sfx.alarm(); }
    return e;
  }

  /** A box building of height [lo, hi] roughly `near`..`far` from her. */
  pickBuilding(lo, hi, near, far) {
    const h = this.hero, city = this.g.city, out = [];
    const r = Math.ceil(far / BLOCK) + 1, bx = Math.floor(h.x / BLOCK), by = Math.floor(h.y / BLOCK);
    for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) {
      const b = city.block(x, y);
      if (!b) continue;
      for (const o of b.b) {
        if (o.kind !== 'box' || o.ship || o.h < lo || o.h > hi) continue;
        const d = dist(o.x + o.w / 2, o.y + o.d / 2, h.x, h.y);
        if (d > near && d < far) out.push(o);
      }
    }
    return out.length ? pick(out) : null;
  }

  // ------------------------------------------------------------------ falling window-washer
  make_faller() {
    const b = this.pickBuilding(110, 9999, 450, 1100);
    if (!b) return null;
    return { b, x: b.x + b.w * rand(0.3, 0.7), y: b.y + b.d + 4, z: b.h - 6, phase: 'dangle', vz: 0, ttl: 60, hint: 'catch them at their height' };
  }

  step_faller(e, dt) {
    const h = this.hero;
    if (e.phase === 'dangle' && e.t > 9) { e.phase = 'fall'; this.say(e, pick(['AAAAH!', 'The rope snapped!', 'HELP!']), 'shout', 'WINDOW-WASHER'); }
    else if (e.phase === 'dangle' && e.t > 1 && chance(dt * 0.4)) this.say(e, pick(['Help! My rig is slipping!', 'Somebody! Up here!']), 'shout', 'WINDOW-WASHER');
    if (e.phase === 'fall') {
      e.vz = Math.min(95, e.vz + 55 * dt); // a comic-book fall: slow enough to reach them
      e.z -= e.vz * dt;
      if (e.z <= 0) return 'lost';
    }
    if (dist(e.x, e.y, h.x, h.y) < 55 && Math.abs(h.z - e.z) < 150) return 'won';
    return null;
  }

  // ------------------------------------------------------------------ runaway / getaway car
  make_car(kind) {
    const h = this.hero, city = this.g.city;
    const getaway = kind === 'getaway';
    for (let tries = 0; tries < 30; tries++) {
      const ix = clamp(Math.round((h.x - ROAD / 2) / BLOCK) + Math.round(rand(-6, 6)), 0, city.landCols);
      const iy = clamp(Math.round((h.y - ROAD / 2) / BLOCK) + Math.round(rand(-6, 6)), 0, city.rows);
      const x = ix * BLOCK + ROAD / 2, y = iy * BLOCK + ROAD / 2, d = dist(x, y, h.x, h.y);
      if (d < 500 || d > 1200) continue;
      const e = { ix, iy, x, y, dir: 0, spd: getaway ? 285 : 235, ttl: getaway ? 34 : 28, getaway, label: getaway ? 'Getaway car' : 'Runaway car', hint: 'drop to rooftop height to grab it' };
      this.pickDir(e);
      return e;
    }
    return null;
  }

  /** Next road direction at an intersection. A getaway car turns away from her when she's close. */
  pickDir(e) {
    const city = this.g.city, h = this.hero;
    const opts = [];
    if (e.ix < city.landCols) opts.push(0);
    if (e.iy < city.rows) opts.push(1);
    if (e.ix > 0) opts.push(2);
    if (e.iy > 0) opts.push(3);
    const fwd = opts.filter((d) => d !== (e.dir + 2) % 4);
    const choices = fwd.length ? fwd : opts;
    const far = (d) => dist(e.x + [1, 0, -1, 0][d] * BLOCK, e.y + [0, 1, 0, -1][d] * BLOCK, h.x, h.y);
    if (e.getaway && dist(e.x, e.y, h.x, h.y) < 700) e.dir = choices.sort((a, b) => far(b) - far(a))[0];
    else e.dir = chance(0.6) && choices.includes(e.dir) ? e.dir : pick(choices);
    e.tx = e.ix + [1, 0, -1, 0][e.dir];
    e.ty = e.iy + [0, 1, 0, -1][e.dir];
  }

  step_car(e, dt) {
    const h = this.hero;
    const gx = e.tx * BLOCK + ROAD / 2, gy = e.ty * BLOCK + ROAD / 2;
    const dx = gx - e.x, dy = gy - e.y, step = e.spd * dt;
    if (Math.abs(dx) + Math.abs(dy) <= step) { e.x = gx; e.y = gy; e.ix = e.tx; e.iy = e.ty; this.pickDir(e); }
    else { e.x += Math.sign(dx) * step; e.y += Math.sign(dy) * step; }
    if (chance(dt * 12)) this.ow.parts.push({ x: e.x, y: e.y, z: 4, vx: rand(-10, 10), vy: rand(-10, 10), vz: 20, life: 0.8, max: 0.8, size: 5, col: e.getaway ? '#555555' : '#ffb040', glow: !e.getaway });
    if (e.getaway && e.t > 1 && chance(dt * 0.25)) this.say(e, pick(['Floor it!', 'She\'s on us!', 'Lose her in traffic!']), 'shout', 'GETAWAY DRIVER');
    const near = dist(e.x, e.y, h.x, h.y) < 55;
    if (near && h.z <= LOW_ENOUGH) return 'won';
    if (near && !e.toldLow) { e.toldLow = true; toast('Too high to grab it: drop to rooftop height (▼ / F)', 'info'); }
    return null;
  }

  // ------------------------------------------------------------------ helicopter
  make_heli() {
    const air = this.ow.airspace, h = this.hero;
    const heli = air.helis.find((c) => c.kind === 'news' && !c.ctl && !c.follow) || air.helis.find((c) => !c.ctl);
    if (!heli) return null;
    const a = rand(0, TAU), d = rand(650, 950);
    Object.assign(heli, { x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, z: 560, ctl: true });
    return { heli, x: heli.x, y: heli.y, z: heli.z, cx: heli.x, cy: heli.y, ttl: 60, hint: 'match its height and catch it' };
  }

  step_heli(e, dt) {
    const c = e.heli, h = this.hero;
    // a lazy spiral down, trailing smoke
    c.z -= 21 * dt;
    c.ang += 2.4 * dt;
    e.cx += Math.cos(e.t * 0.3) * 20 * dt;
    c.x = e.cx + Math.cos(e.t * 1.1) * 60; c.y = e.cy + Math.sin(e.t * 1.1) * 60;
    c.rotor += dt * 12;
    Object.assign(e, { x: c.x, y: c.y, z: c.z });
    if (chance(dt * 18)) this.ow.parts.push({ x: c.x, y: c.y, z: c.z, vx: rand(-15, 15), vy: rand(-15, 15), vz: 25, life: 2.2, max: 2.2, size: 9, col: '#3a3a3a' });
    if (e.t > 1 && chance(dt * 0.2)) this.say(e, pick(['Mayday, mayday!', 'We\'ve lost the tail rotor!', 'Is that… Supergirl?!']), 'shout', 'PILOT');
    if (c.z <= 40) return 'lost';
    if (dist(c.x, c.y, h.x, h.y) < 70 && Math.abs(h.z - c.z) < 120) return 'won';
    return null;
  }

  /** Hand the chopper back to normal air traffic. `away`: it landed/crashed, so it re-enters far off. */
  releaseHeli(e, away = false) {
    const c = e.heli, h = this.hero;
    c.ctl = false;
    c.z = 420 + rand(0, 90);
    if (away) { const a = rand(0, TAU); c.x = h.x + Math.cos(a) * 4000; c.y = h.y + Math.sin(a) * 4000; }
  }

  // ------------------------------------------------------------------ stunt rings
  make_rings() {
    const h = this.hero, city = this.g.city;
    let a = h.ang + rand(-0.6, 0.6), x = h.x + Math.cos(a) * 420, y = h.y + Math.sin(a) * 420;
    let band = h.band;
    const rings = [];
    for (let i = 0; i < 6; i++) {
      if (i > 0) {
        a += rand(-0.7, 0.7);
        x += Math.cos(a) * 480; y += Math.sin(a) * 480;
        // change height often, and always at least once, so the course makes you climb and dive
        if (chance(0.6) || (i >= 3 && rings.every((r) => r.z === BANDS[band].z))) band = band === 0 ? 1 : band === BANDS.length - 1 ? band - 1 : band + pick([-1, 1]);
      }
      rings.push({ x: clamp(x, 200, city.W - 200), y: clamp(y, 200, city.H - 200), z: BANDS[band].z, ang: a });
    }
    return { rings, next: 0, x: rings[0].x, y: rings[0].y, ttl: 70, started: 0, limit: 28 };
  }

  step_rings(e) {
    const h = this.hero, r = e.rings[e.next];
    Object.assign(e, { x: r.x, y: r.y });
    if (e.next > 0 && e.t - e.started > e.limit) { toast('◎ Out of time on the stunt course', 'info'); return 'lost'; }
    if (dist(r.x, r.y, h.x, h.y) < 62 && Math.abs(h.z - r.z) < 75) {
      if (e.next === 0) { e.started = e.t; e.ttl = e.t + e.limit + 1; }
      e.next++;
      sfx.pickup();
      if (e.next === e.rings.length) return 'won';
      const nz = e.rings[e.next].z;
      if (Math.abs(nz - h.z) > 75) toast(nz > h.z ? 'Next hoop is higher: ▲ / R' : 'Next hoop is lower: ▼ / F', 'info');
    } else if (dist(r.x, r.y, h.x, h.y) < 62 && !e.warned) {
      e.warned = true;
      toast(r.z > h.z ? 'The hoop is higher than you: ▲ / R' : 'The hoop is lower than you: ▼ / F', 'info');
    }
    return null;
  }

  // ------------------------------------------------------------------ kitten on a roof
  make_kitten() {
    const b = this.pickBuilding(40, 230, 500, 1400);
    if (!b) return null;
    return { b, x: b.x + b.w * rand(0.25, 0.75), y: b.y + b.d * rand(0.25, 0.75), z: b.h, ttl: 160, hint: 'perch on its roof' };
  }

  step_kitten(e) {
    const h = this.hero;
    return h.perch && this.ow.buildingAt(h.x, h.y) === e.b ? 'won' : null;
  }

  // ------------------------------------------------------------------ outcomes
  win(e) {
    const st = this.g.state, K = KINDS[e.kind];
    this.list = this.list.filter((q) => q !== e);
    st.stats.airSaves = (st.stats.airSaves || 0) + 1;
    const hs = this.ow.heroScreen || { x: this.g.w / 2, y: this.g.h / 2 };
    switch (e.kind) {
      case 'faller':
        comic.pow('GOTCHA!', hs.x, hs.y - 30, { size: 1.1 });
        this.carry = { kind: 'faller', t: 0, done: 'Window-washer set down safely.' };
        st.addRep(K.reward, 'Caught a falling window-washer');
        break;
      case 'car': case 'getaway':
        this.ow.shake = Math.max(this.ow.shake, 12);
        sfx.hit();
        comic.pow(e.getaway ? 'CRUNCH!' : 'SCREECH!', hs.x, hs.y - 30, { size: 1.2 });
        st.addRep(K.reward, e.getaway ? 'Stopped a getaway car' : 'Stopped a runaway car');
        break;
      case 'heli':
        comic.pow('CAUGHT IT!', hs.x, hs.y - 30, { size: 1.2 });
        this.releaseHeli(e, true);
        this.carry = { kind: 'heli', t: 0, done: 'Helicopter set down on a rooftop. Crew safe.' };
        st.addRep(K.reward, 'Saved a falling helicopter');
        break;
      case 'rings': {
        const time = e.t - e.started;
        const best = st.stats.bestRings;
        const record = !best || time < best;
        if (record) st.stats.bestRings = +time.toFixed(1);
        comic.pow(record ? 'NEW RECORD!' : 'NAILED IT!', hs.x, hs.y - 30);
        st.addRep(K.reward + (record ? 2 : 0), `Stunt course in ${time.toFixed(1)}s${record ? ' (record)' : ''}`);
        break;
      }
      case 'kitten':
        st.stats.kittens = (st.stats.kittens || 0) + 1;
        this.g.commentary.talk('Meow!', hs.x + 20, hs.y - 30, { kind: 'speech', speaker: 'KITTEN' });
        st.addRep(K.reward, `Rescued a kitten (${st.stats.kittens} so far)`);
        break;
    }
    sfx.win();
  }

  lose(e, failed) {
    const st = this.g.state, K = KINDS[e.kind];
    this.list = this.list.filter((q) => q !== e);
    if (e.kind === 'heli') this.releaseHeli(e, true);
    if (!failed) {
      if (e.kind === 'car' || e.kind === 'getaway') st.addRep(K.fail, e.getaway ? 'The getaway car escaped' : 'The runaway car crashed');
      return; // hoops and kittens just wander off
    }
    const why = { faller: 'Didn\'t catch the window-washer (the awning did)', heli: 'The helicopter crash-landed', rings: '' }[e.kind];
    if (K.fail) st.addRep(K.fail, why);
    else if (why) toast(why, 'info');
  }

  /** Speech bubble from the event's spot on screen (only when it's on screen). */
  say(e, text, kind, speaker) {
    const V = this.ow.V;
    if (!V) return;
    const x = V.SX(e.x, e.z || 0), y = V.SY(e.y, e.z || 0);
    if (x < 0 || y < 0 || x > V.W || y > V.H) return;
    this.g.commentary.talk(text, x, y - 20, { kind, speaker });
  }

  // ------------------------------------------------------------------ drawing
  /** Ground-level parts (cars, shadows, ring markers), drawn with the traffic. */
  drawGround(ctx, V) {
    for (const e of this.list) {
      if (e.kind === 'car' || e.kind === 'getaway') this.drawCar(ctx, V, e);
      else if (e.kind === 'faller' || e.kind === 'heli') {
        // target shadow on the ground: where they'll land
        const r = (e.kind === 'heli' ? 40 : 22) * V.k * (1 + e.z / 400);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(V.SX(e.x), V.SY(e.y), r, r * 0.6, 0, 0, TAU); ctx.fill();
      }
    }
  }

  drawCar(ctx, V, e) {
    const horiz = e.dir === 0 || e.dir === 2, w = horiz ? 26 : 13, d = horiz ? 13 : 26;
    const x = V.SX(e.x - w / 2), y = V.SY(e.y - d / 2);
    const pulse = (V.t * 1.6) % 1;
    ctx.strokeStyle = rgba(KINDS[e.kind].color, 0.9 * (1 - pulse)); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(V.SX(e.x), V.SY(e.y), (22 + pulse * 50) * V.k, 0, TAU); ctx.stroke();
    ctx.fillStyle = e.getaway ? '#1b1b1b' : '#e05b1a'; ctx.fillRect(x, y, w * V.k, d * V.k);
    ctx.fillStyle = 'rgba(20,30,50,.8)'; ctx.fillRect(x + (horiz ? 7 : 2) * V.k, y + (horiz ? 2 : 7) * V.k, (horiz ? 10 : 9) * V.k, (horiz ? 9 : 10) * V.k);
    if (e.getaway && Math.sin(V.t * 18) > 0) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, 4 * V.k, 4 * V.k); }
  }

  /** Everything in the air (people, helicopters, hoops, kittens), drawn after the buildings. */
  drawAir(ctx, V) {
    const k = V.k;
    for (const e of this.list) {
      if (e.kind === 'faller') {
        const x = V.SX(e.x, e.z), y = V.SY(e.y, e.z), s = k * V.P(e.z);
        if (e.phase === 'dangle') { // the broken rig
          ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2 * s;
          ctx.beginPath(); ctx.moveTo(V.SX(e.x - 20, e.b.h), V.SY(e.y, e.b.h)); ctx.lineTo(x, y); ctx.moveTo(V.SX(e.x + 20, e.b.h), V.SY(e.y, e.b.h)); ctx.lineTo(x + 14 * s, y); ctx.stroke();
          ctx.fillStyle = '#8a8a8a'; ctx.fillRect(x - 4 * s, y - 2 * s, 22 * s, 4 * s);
        }
        const flail = Math.sin(V.t * (e.phase === 'fall' ? 18 : 5)) * 4 * s;
        this.drawPerson(ctx, x + (e.phase === 'dangle' ? Math.sin(V.t * 2) * 4 * s : 0), y, s, flail, '#3f7fd8');
        this.drawTag(ctx, x, y - 26 * s, e.phase === 'fall' ? 'FALLING!' : 'HELP!', KINDS.faller.color);
      } else if (e.kind === 'heli') {
        this.drawTag(ctx, V.SX(e.x, e.z), V.SY(e.y, e.z) - 40 * k * V.P(e.z), 'MAYDAY', KINDS.heli.color);
      } else if (e.kind === 'rings') {
        e.rings.forEach((r, i) => {
          if (i < e.next || r.z > V.camH - 120) return;
          const x = V.SX(r.x, r.z), y = V.SY(r.y, r.z), s = k * V.P(r.z), cur = i === e.next;
          ctx.save(); ctx.translate(x, y); ctx.rotate(r.ang + Math.PI / 2);
          ctx.strokeStyle = cur ? '#6ff7ff' : 'rgba(111,247,255,.35)'; ctx.lineWidth = (cur ? 6 : 3) * s;
          ctx.beginPath(); ctx.ellipse(0, 0, 60 * s, 20 * s, 0, 0, TAU); ctx.stroke();
          ctx.restore();
          if (cur) this.drawTag(ctx, x, y - 34 * s, `${i + 1}/${e.rings.length} · ${BANDS.find((b) => b.z === r.z)?.label || ''}`, '#6ff7ff');
        });
        if (e.next > 0) this.drawTag(ctx, V.W / 2, 92, `◎ ${Math.max(0, e.limit - (e.t - e.started)).toFixed(1)}s`, '#6ff7ff');
      } else if (e.kind === 'kitten') {
        const x = V.SX(e.x, e.z), y = V.SY(e.y, e.z), s = k * V.P(e.z);
        const pulse = (V.t * 1.2) % 1;
        ctx.strokeStyle = `rgba(255,179,107,${0.8 * (1 - pulse)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, (14 + pulse * 26) * s, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#f0923a';
        ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 2 * s); ctx.lineTo(x - 4 * s, y - 8 * s); ctx.lineTo(x - 1 * s, y - 4 * s); ctx.moveTo(x + 5 * s, y - 2 * s); ctx.lineTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 1 * s, y - 4 * s); ctx.fill();
      }
    }
    // whoever she's carrying rides below her
    if (this.carry && this.ow.heroScreen) {
      const { x, y } = this.ow.heroScreen, s = k * V.P(this.hero.z);
      if (this.carry.kind === 'faller') this.drawPerson(ctx, x, y + 16 * s, s, 0, '#3f7fd8');
    }
  }

  drawPerson(ctx, x, y, s, flail, col) {
    ctx.fillStyle = col; ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 9 * s);
    ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(x, y - 5 * s, 3.2 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 8 * s, y - 4 * s + flail); ctx.moveTo(x + 3 * s, y); ctx.lineTo(x + 8 * s, y - 4 * s - flail); ctx.stroke();
  }

  drawTag(ctx, x, y, text, col) {
    ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x - w / 2, y - 9, w, 18);
    ctx.fillStyle = col; ctx.fillText(text, x, y + 1);
  }
}

