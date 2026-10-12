// The moment director: while she flies between markers, something worth a short detour comes up
// every 20-40 s of commuting. It picks what by rank and the act's state (what the story still
// needs), places it ahead of her (toward her waypoint, clear of the map's incident markers), never
// runs more than two at once (one story-sized), and keeps the old air events (falling window-washer,
// runaway cars, the helicopter, hoops, kittens) and the act's impostor sightings in its schedule.
// It also owns the shared beats: the swoop (DIVE onto a moment's target), slow motion on a catch,
// the burst / stinger / camera kick, and a timeline of what was offered and taken (harness: .log).
import { Kit3D } from './kit3d.js';
import { banner, bannerSpot } from './hud.js';
import { AirMoment, drawAir3d, overlayAir } from './air3d.js';
import { ImpostorChase } from './impostor.js';
import { BLOCK, ROAD, LOT } from '../city.js';
import { clamp, lerp, rand, dist } from '../util.js';
import { comic } from '../comic.js';
import { M } from '../city3d.js';
import * as THREE from 'three';

/** Pacing tunables (seconds of commuting, world units). */
export const DIRECTOR = {
  first: [9, 14],      // before the first offer of a flight
  gap: [20, 40],       // between offers
  maxLive: 2,          // at once (only one story-sized)
  ignored: 14,         // an offer she hasn't touched in this long no longer holds the next one back
  clear: 380,          // keep this far from every incident marker
  arriving: 650,       // closer than this to her waypoint: no new offers (she's arriving)
  longTrip: 3000, longPace: 0.75, // a long trip to the waypoint: offers come a little sooner
  slow: { k: 0.25, hold: 0.42, ease: 0.3 }, // slow motion on a catch: time scale, real seconds held, eased back
};

/**
 * What can come up: cooldown (s), group (shares a cooldown), gate, weight, maker. (Designed next, not
 * built yet: a courier-van tail, Polaroids blowing off a roof, a super-hearing street rescue, a
 * Puzzle Maker riddle chain, a news chopper: docs/polish/handoff/travel-r11.md.)
 */
const KINDS = {
  impostor: { big: true, ok: (c) => !!c.act?.sightingDue?.(), w: () => 9, make: (d, f) => ImpostorChase.offer(d, f) },
  faller: { cool: 60, ok: () => true, w: () => 1.4, make: (d, f) => AirMoment.offer(d, 'faller', f) },
  car: { cool: 60, group: 'car', ok: () => true, w: () => 1, make: (d, f) => AirMoment.offer(d, 'car', f) },
  getaway: { cool: 60, group: 'car', ok: (c) => c.night || c.rep >= 40, w: () => 1.1, make: (d, f) => AirMoment.offer(d, 'getaway', f) },
  heli: { cool: 100, ok: () => true, w: () => 0.9, make: (d, f) => AirMoment.offer(d, 'heli', f) },
  rings: { cool: 100, ok: () => true, w: () => 1, make: (d, f) => AirMoment.offer(d, 'rings', f) },
  kitten: { cool: 90, ok: () => true, w: () => 0.6, make: (d, f) => AirMoment.offer(d, 'kitten', f) },
};
export const MOMENT_KINDS = Object.keys(KINDS);

const param = (k) => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
const _v = new THREE.Vector3();

export class MomentDirector {
  constructor(ow) {
    this.ow = ow;
    this.kit = null;
    this.off = param('moments') === 'off';
    this.forceKind = param('moment');
    this.reset();
  }

  get g() { return this.ow.g; }

  reset() {
    for (const m of this.live || []) m.end();
    this.kit?.clear();
    this.live = [];
    this.log = [];
    this.clock = 0; this.flyT = 0; this.commute = 0;
    this.quiet = 0; this.gap = rand(...DIRECTOR.first);
    this.lastAt = {}; this.seen = {}; this.lastKind = null;
    this.sw = null; this.slowT = 0; this.scale = 1;
    this.pings = [];
    this.forced = false;
  }

  /** The state the gates read: rank, the act, time of day. */
  ctx() {
    const st = this.g.state, act = this.g.act, A = act?.A;
    return {
      rep: st.rep, act, A, night: st.isNight,
      strays: !!act?.straysOn?.(), fakesShort: !!act?.straysShort?.(),
      gate: (act?.gateMissions?.() || []).includes('warehouse'),
      riddles: !!(A && A.beats?.riddle && !A.done),
    };
  }

  /** The time scale for this frame (slow motion), from the real frame time. */
  tick(rdt) {
    const S = DIRECTOR.slow;
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - rdt);
    this.scale = this.slowT > S.ease ? S.k : this.slowT > 0 ? lerp(1, S.k, this.slowT / S.ease) : 1;
    return this.scale;
  }
  slowmo() { this.slowT = DIRECTOR.slow.hold + DIRECTOR.slow.ease; }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const ow = this.ow, h = ow.hero;
    this.clock += dt;
    this.pings = this.pings.filter((p) => (p.t += dt) < 2.4);
    // an impostor sighting the act already put on the map (e.g. after a zone) gets its chase back
    for (const z of ow.zones) if (z.impostor && !this.live.some((m) => m.zone === z)) this.add(new ImpostorChase(this, z, true), true);
    for (const m of [...this.live]) {
      m.t += dt;
      m.update(dt);
      if (!m.result && m.t > m.ttl) { m.expire(); if (m.result) this.note(m, 'expired'); }
      if (m.result && (m.outro -= dt) <= 0) { m.end(); this.live = this.live.filter((q) => q !== m); }
    }
    if (this.off) return;
    const flying = !ow.diving && ow.rising === null && !h.perch && !this.sw;
    if (flying) this.flyT += dt;
    // ?moment=<kind>: the harness (and a tester) can call one up on demand
    if (this.forceKind && !this.forced && this.flyT > 1.2) { this.forced = true; this.force(this.forceKind); }
    // the commute clock: time flying with nothing on (or only an offer she's ignoring)
    const t = ow.nav.target, arriving = t && dist(t.x, t.y, h.x, h.y) < DIRECTOR.arriving;
    const busy = this.live.filter((m) => !m.result && (m.taken || m.t < DIRECTOR.ignored)).length;
    if (!flying || h.speed < 80) return;
    this.commute += dt;
    if (busy || arriving) return;
    this.quiet += dt;
    if (this.quiet < this.gap || this.live.filter((m) => !m.result).length >= DIRECTOR.maxLive) return;
    const long = t && dist(t.x, t.y, h.x, h.y) > DIRECTOR.longTrip;
    if (this.offer()) { this.quiet = 0; this.gap = rand(...DIRECTOR.gap) * (long ? DIRECTOR.longPace : 1); }
    else this.quiet = this.gap - 3; // nothing could be placed here: try again in a few seconds
  }

  /** Offer one moment (a weighted pick among the eligible kinds); forceKind skips the gates. */
  offer(forceKind = null) {
    const c = this.ctx(), bigLive = this.live.some((m) => m.big && !m.result), cands = [];
    for (const [k, K] of Object.entries(KINDS)) {
      if (forceKind) { if (k !== forceKind) continue; } else {
        if ((K.big && bigLive) || !K.ok(c)) continue;
        const at = this.lastAt[K.group || k];
        if (at != null && this.clock - at < (K.cool || 0)) continue;
        if (this.live.some((m) => m.kind === k && !m.result)) continue;
      }
      let w = K.w(c);
      if (k === this.lastKind) w *= 0.25;
      if (!this.seen[k]) w *= 1.6; // variety first
      cands.push([k, w]);
    }
    while (cands.length) {
      let r = Math.random() * cands.reduce((s, q) => s + q[1], 0), i = 0;
      for (; i < cands.length - 1; i++) { r -= cands[i][1]; if (r <= 0) break; }
      const [k] = cands.splice(i, 1)[0];
      let m = null;
      try { m = KINDS[k].make(this, !!forceKind); } catch (e) { console.error(e); }
      if (m) { this.add(m); return m; }
    }
    return null;
  }

  force(kind) { return KINDS[kind] ? this.offer(kind) : null; }

  add(m, quiet = false) {
    this.live.push(m);
    if (quiet) return;
    const K = KINDS[m.kind];
    this.lastAt[K?.group || m.kind] = this.clock; this.lastKind = m.kind; this.seen[m.kind] = true;
    this.pings.push({ x: m.x, y: m.y, t: 0, color: m.color });
    this.note(m, 'offered');
  }

  note(m, ev) {
    this.log.push({ t: +this.clock.toFixed(1), kind: m.kind, ev });
    if (this.log.length > 300) this.log.shift();
  }

  has(ref) { return this.live.includes(ref); }

  /** Diving into a zone: the airborne stuff is someone else's problem now (no penalty). */
  abandon() {
    for (const m of this.live) if (!m.result) m.abandon();
    this.live = [];
    this.sw = null;
  }

  markers() { return this.live.map((m) => m.marker()).filter(Boolean); }

  // ------------------------------------------------------------------ DIVE: the swoop
  diveTarget() {
    if (this.sw) return null;
    for (const m of this.live) { if (m.result) continue; const d = m.diveTarget(); if (d) return { m, ...d }; }
    return null;
  }

  /** DIVE pressed: a moment in range takes it (true), else the overworld handles it. */
  tryDive() {
    if (this.sw) return true;
    const d = this.diveTarget();
    if (!d) return false;
    d.m.onDive(d);
    return true;
  }

  /**
   * She swoops onto target() (a moving world point): an accelerating plunge (0.3-0.6 s), then
   * onHit() and she flies on (the band eases her back up). The camera just follows her.
   */
  swoopTo(target, onHit) {
    const h = this.ow.hero, p = target();
    const d = Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z);
    this.sw = { target, onHit, t: 0, x0: h.x, y0: h.y, z0: h.z, dur: clamp(0.22 + d / 1500, 0.3, 0.62) };
    h.perch = null;
    this.ow.audio?.sting('swoop');
  }

  /** Per frame from the overworld: true while a swoop drives her (flight physics wait). */
  swoop(dt) {
    const s = this.sw, h = this.ow.hero;
    if (!s) return false;
    s.t += dt;
    const p = s.target(), f = Math.min(1, s.t / s.dur), e = f * f * (1.6 - 0.6 * f); // (accelerating, landing true)
    const px = h.x, py = h.y;
    h.x = lerp(s.x0, p.x, e); h.y = lerp(s.y0, p.y, e); h.z = Math.max(4, lerp(s.z0, p.z + 6, e));
    const mx = h.x - px, my = h.y - py, mv = Math.hypot(mx, my);
    if (mv > 0.5) h.ang = Math.atan2(my, mx);
    h.speed = Math.max(300, Math.min(1150, mv / Math.max(dt, 1e-3)));
    h.vx = Math.cos(h.ang) * h.speed; h.vy = Math.sin(h.ang) * h.speed;
    if (f >= 1) { this.sw = null; h.speed = 240; s.onHit(); }
    return true;
  }

  /** The catch beat: a burst at the spot, slow motion, a camera kick, sparks, the stinger. */
  celebrate(x, y, z, word, { size = 1.25, colors, slow = true, sting = 'catch', sparks = '#ffe23a' } = {}) {
    const ow = this.ow, v = ow.view3d;
    let sx = ow.heroScreen?.x ?? this.g.w / 2, sy = (ow.heroScreen?.y ?? this.g.h / 2) - 40;
    if (v && v.cam && document.body.classList.contains('fly3d')) { const p = v.projector().proj(x, y, z); if (p[2]) { sx = p[0]; sy = p[1] - 40; } }
    comic.pow(word, sx, Math.max(90, sy), { size, colors });
    if (slow) this.slowmo();
    if (v?.cam?.cam) v.cam.kick = 1; // (the boost's own FOV punch: no bigger)
    if (this.kit) { this.kit.flash(x, y, z, 16, '#ffffff', 0.25); this.kit.spark(x, y, z, 18, sparks, 80); }
    if (v?.fx3 && v.hero?.group) v.fx3.ring(v.hero.group.position, _v.set(Math.cos(ow.hero.ang), 0, Math.sin(ow.hero.ang)), true);
    ow.audio?.sting(sting);
    ow.shake = Math.max(ow.shake, 10);
  }

  // ------------------------------------------------------------------ placement
  /**
   * A spot ahead of her (toward her waypoint when it's far): d0..d1 world units out, within ±cone
   * of that heading, inside the city, clear of incident markers and other moments. test(x, y) may
   * refine it (e.g. snap to a roof) and return the placed object or null.
   */
  ahead(d0, d1, { cone = 0.65, tries = 16, test = null, clear = DIRECTOR.clear } = {}) {
    const ow = this.ow, h = ow.hero, city = this.g.city, t = ow.nav.target;
    const base = t && dist(t.x, t.y, h.x, h.y) > d1 * 0.8 ? Math.atan2(t.y - h.y, t.x - h.x) : h.ang;
    for (let i = 0; i < tries; i++) {
      const a = base + rand(-cone, cone) * (i < tries / 2 ? 1 : 1.8), d = rand(d0, d1);
      const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
      if (x < 260 || y < 260 || x > city.coastX - 260 || y > city.H - 260) continue;
      if (!this.clearAt(x, y, clear)) continue;
      const r = test ? test(x, y) : { x, y };
      if (r) return r;
    }
    return null;
  }

  clearAt(x, y, r = DIRECTOR.clear) {
    return this.ow.zones.every((z) => dist(z.x, z.y, x, y) > r) && this.live.every((m) => m.result || dist(m.x, m.y, x, y) > 420)
      && this.ow.events.list.every((e) => dist(e.x, e.y, x, y) > 420);
  }

  /** A box building near (x, y) whose 3D height is in [lo, hi] and whose roof is at least `size` across. */
  roofNear(x, y, r, lo, hi, size = 40, avoid = null) {
    const city = this.g.city, ow = this.ow, out = [];
    const R = Math.ceil(r / BLOCK) + 1, bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    for (let j = by - R; j <= by + R; j++) for (let i = bx - R; i <= bx + R; i++) {
      const b = city.block(i, j);
      if (!b || b.river) continue;
      for (const o of b.b) {
        if (o.kind !== 'box' || o.ship || o.landmark || o === avoid || Math.min(o.w, o.d) < size) continue;
        const hh = ow.hOf(o);
        if (hh < lo || hh > hi) continue;
        const cx = o.x + o.w / 2, cy = o.y + o.d / 2, d = dist(cx, cy, x, y);
        if (d < r) out.push({ o, x: cx, y: cy, z: hh, d });
      }
    }
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
  }

  /** The nearest road intersection to (x, y): { ix, iy, x, y }. */
  crossing(x, y) {
    const city = this.g.city;
    const ix = clamp(Math.round((x - ROAD / 2) / BLOCK), 0, city.landCols), iy = clamp(Math.round((y - ROAD / 2) / BLOCK), 0, city.rows);
    return { ix, iy, x: ix * BLOCK + ROAD / 2, y: iy * BLOCK + ROAD / 2 };
  }

  // ------------------------------------------------------------------ drawing hooks
  /** 3D: every live moment's actors, the air events and the tabloid drones, for this frame. */
  render3d(view, dt) {
    if (!this.kit || this.kit.scene !== view.scene) { this.kit?.dispose(); this.kit = new Kit3D(view.scene, view.renderer); }
    const kit = this.kit;
    this.frameDt = dt;
    kit.begin(view.cam.cam);
    for (const m of this.live) { try { m.draw3d(kit, view); } catch (e) { console.error(e); m.result = m.result || 'lost'; } }
    drawAir3d(this, kit, view);
    kit.end(dt, view.scene.fog, view.sceneScale ?? 1);
    if (!kit.warmed && this.flyT > 2) kit.warm(view.cam.cam);
  }

  /** The comic overlay over the 3D view: tags, reticles, the banner of the moment she's on. */
  overlay(ctx, P, W, H, view) {
    for (const m of this.live) m.overlay(ctx, P, W, H, view);
    overlayAir(this, ctx, P, W, H, view);
    const focus = this.live.filter((m) => !m.result && m.banner).sort((a, b) => (b.taken - a.taken) || (a.t - b.t))[0];
    const b = focus?.banner();
    if (b) banner(ctx, bannerSpot(W), b, this.ow.t);
  }

  /** The old 2D view: tags only. */
  draw2d(ctx, V) { for (const m of this.live) m.draw2d(ctx, V); }

  /** Minimap: a ring pinging out from each new offer. */
  drawPings(g, ox, oy, m) {
    for (const p of this.pings) {
      const k = (p.t % 0.8) / 0.8;
      g.strokeStyle = p.color; g.globalAlpha = 1 - k; g.lineWidth = 2;
      g.beginPath(); g.arc(ox + p.x * m, oy + p.y * m, 4 + k * 14, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

export { M, LOT };
