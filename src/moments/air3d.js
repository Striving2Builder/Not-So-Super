// The old air events (airevents.js: falling window-washer, runaway / getaway car, a helicopter in
// trouble, the hoop course, a kitten on a roof) and the tabloid drones (paparazzi.js), drawn in the
// 3D flight at last (before this they were only edge chips and minimap dots), with their comic
// tags, lock-ons and banners. AirMoment puts each event in the director's schedule.
import { Moment } from './base.js';
import { KIT } from './kit3d.js';
import { tag, reticle } from './hud.js';
import { RUN, FLAIL } from './actors3d.js';
import { BANDS } from '../flight.js';
import { M } from '../city3d.js';
import { DIRECTOR } from './director.js';
import { verdict } from './verdict.js';
import { drawCarry } from './payoff.js';

const COL = { faller: '#ffd23f', car: '#ff8a3d', getaway: '#ff3d3d', heli: '#ff5a5a', rings: '#6ff7ff', kitten: '#ffb36b' };
const HOOP = 26; // hoop radius, m (the pass test is 62 world units wide)
/** r11 F2a: targets read from the chase camera: actors at BIG × their size (ink hull included), a beacon over each. */
const BIG = { person: 3, car: 3, rig: 2.55, heli: 2.25, cat: 3.3 }, BEAM = 520; // (r11 F2b: 1.5× again, + the bold ink hull)

/** An air event in the director's schedule (AirEvents runs it; this tracks it for pacing and the banner). */
export class AirMoment extends Moment {
  static offer(dir, kind, forced) {
    const S = { ...DIRECTOR.spawn }, h = dir.ow.hero, lead = Math.min(S.leadMax, (h.speed || 0) * S.lead);
    // r11 F2c: a street target (the cars) far enough out that it sits inside the chase frame from her
    // altitude (~40° down at most), not under her boots where only the arrow could show it
    if ((kind === 'car' || kind === 'getaway') && dir.ow.view3d) { const alt = h.z * M; S.d = [Math.max(S.d[0], Math.min(460, alt * 1.15)), Math.max(S.d[1], Math.min(560, alt * 1.45))]; }
    // in frame: the cone ahead of her heading, 80-160 m past her lead point; the event's maker
    // snaps it to the nearest building / crossing there (test: null = try another spot)
    const e = dir.ahead(S.d[0] / M + lead, S.d[1] / M + lead, { cone: S.cone, tries: 20, clear: forced ? 200 : DIRECTOR.clear, test: (x, y) => dir.ow.events.spawn(kind, { x, y, near: true }) })
      || dir.ow.events.spawn(kind, dir.ahead(S.d[1] / M + lead, 700 + lead, { cone: S.cone * 1.4 })); // (nothing that close: a bit further out)
    return e ? new AirMoment(dir, kind, e) : null;
  }

  constructor(dir, kind, e) {
    super(dir, kind, { name: e.label || kind, color: COL[kind], ttl: Infinity });
    this.e = e;
    this.sync();
  }

  sync() { const e = this.e, p = e.kind === 'rings' ? e.rings[Math.min(e.next, e.rings.length - 1)] : e; this.x = p.x; this.y = p.y; this.z = p.z || 0; }

  update() {
    const e = this.e;
    if (!this.result) this.sync();
    if (!this.taken && (this.dist() < 520 || (e.kind === 'rings' && e.next > 0))) this.take();
    if (!this.result && !this.ow.events.list.includes(e)) {
      if (e.outcome === 'won') this.win(0.2); else this.lose(0.2);
      if (e.outcome === 'won' || (e.outcome === 'lost' && (e.kind !== 'rings' || e.next > 0))) verdict(this.dir, e.kind, e.outcome === 'won'); // (r11 F2a: freeze + panel)
    }
  }

  marker() { return null; } // (AirEvents.markers() lists it)
  draw2d() {}               // (and draws it in the 2D view)
  abandon() {}

  banner() {
    const e = this.e, h = this.ow.hero;
    if (this.result) return null;
    if (e.kind === 'rings') return e.next > 0 ? { title: 'STUNT COURSE', col: COL.rings, time: e.limit - (e.t - e.started), meters: [{ label: 'HOOPS', v: e.next / e.rings.length, col: COL.rings, pips: e.rings.length }] } : null;
    if (!this.taken) return null;
    if (e.kind === 'faller') return { title: e.phase === 'fall' ? 'CATCH HIM!' : e.phase === 'ledge' ? 'HE GRABBED A LEDGE!' : 'WINDOW-WASHER IN TROUBLE', col: COL.faller, time: e.phase === 'fall' ? e.z / Math.max(40, e.vz) : e.phase === 'ledge' ? 3.5 - (e.t - e.ledgeT) : 9 - e.t, meters: [{ label: 'HEIGHT', v: e.z / Math.max(1, e.top || e.z), col: COL.faller, warn: e.phase === 'fall' }] };
    if (e.kind === 'car' || e.kind === 'getaway') return { title: e.getaway ? 'STOP THE GETAWAY CAR' : 'STOP THE RUNAWAY CAR', col: COL[e.kind], time: e.ttl - e.t, meters: [{ label: h.z > 260 ? 'TOO HIGH ▼' : 'IN REACH', v: h.z > 260 ? 0.25 : 1, col: COL[e.kind], warn: h.z > 260 }] };
    if (e.kind === 'heli') return { title: 'CATCH THE CHOPPER', col: COL.heli, time: (e.z - 40) / 21, meters: [{ label: 'ALTITUDE', v: (e.z - 40) / 520, col: COL.heli, warn: e.z < 200 }] };
    return null;
  }
}

/** Per-event actors this frame (pooled; released when the event is gone). */
export function drawAir3d(dir, kit, view) {
  const ow = dir.ow, h = ow.hero, A = dir.airA || (dir.airA = new Map()), seen = new Set(), t = ow.t;
  const slot = (e, n, role) => {
    let s = A.get(e); if (!s) A.set(e, (s = {})); seen.add(e);
    if (!s[n]) { const a = s[n] = kit.take(role); a.group.scale.setScalar(a.base * (e === ow.events.carry ? 0.85 : BIG[role.split(':')[0]] || 1)); a.hull.material = kit.inkBold; }
    return s[n];
  };
  for (const e of ow.events.list) { const p = e.kind === 'rings' ? e.rings[e.next] : e; if (p) kit.beam(p.x, p.y, COL[e.kind], BEAM); }
  const every = (e, k, s) => { e[k] = (e[k] || 0) - 1 / 60; if (e[k] <= 0) { e[k] = s; return true; } return false; };
  for (const e of ow.events.list) {
    if (e.kind === 'faller') {
      // r11 F2c: on the facade facing her (n = its outward normal, u = along it)
      const nx = e.nx ?? 0, ny = e.ny ?? 1, ux = ny, uy = -nx, fa = Math.atan2(ny, nx);
      const top = e.top ?? e.z + 6, rigZ = e.phase === 'dangle' ? e.z + 3 : top - 14, sw = Math.sin(t * 2) * 1.5;
      const rig = slot(e, 'rig', 'rig').at(e.x + nx * 3, e.y + ny * 3, rigZ, fa - Math.PI / 2, 0, e.phase === 'dangle' ? Math.sin(t * 2) * 0.08 : 0.5);
      const w = 4.5, rz = e.phase === 'dangle' ? 0 : 2.5;
      kit.rope([e.x - ux * w + nx * 2, e.y - uy * w + ny * 2, top], [e.x - ux * w + nx * 3, e.y - uy * w + ny * 3, rigZ - rz], [e.x + ux * w + nx * 2, e.y + uy * w + ny * 2, top], [e.x + ux * w + nx * 3, e.y + uy * w + ny * 3, rigZ + rz]);
      const p = slot(e, 'p', 'person:washer'), px = e.x + nx * 4, py = e.y + ny * 4;
      if (e.phase !== 'fall') { p.pose('hang').at(px + ux * sw, py + uy * sw, e.z - 3.6, fa, 0, Math.sin(t * 2) * 0.1); e.vis = { x: px, y: py, z: e.z - 2 }; }
      else { p.pose(FLAIL[Math.floor(t * 8) % 2]).at(px, py, e.z - 2, fa + t * 2, -0.4, Math.sin(t * 5) * 0.3); e.vis = { x: px, y: py, z: e.z }; }
      kit.ring(px, py, 0, 30, COL.faller, 0.9, e.phase === 'fall' ? 2.2 : 0.8);
      rig.group.visible = true;
    } else if (e.kind === 'car' || e.kind === 'getaway') {
      const c = slot(e, 'car', e.getaway ? 'car:getaway' : 'car:runaway');
      const ang = e.dir * Math.PI / 2, bob = Math.sin(t * 30) * 0.15;
      c.at(e.x, e.y, bob, ang, 0, Math.sin(t * 7) * 0.03); e.vis = { x: e.x, y: e.y, z: 4 };
      kit.ring(e.x, e.y, 0, 34, COL[e.kind], 0.9, 1.4);
      if (every(e, '_fx', e.getaway ? 0.07 : 0.05)) {
        const bx = e.x - Math.cos(ang) * 6, by = e.y - Math.sin(ang) * 6;
        if (e.getaway) kit.smoke(bx, by, 2, { size: 1.6, col: '#4a4a52', life: 0.9, rise: 6, spread: 1.5 });
        else kit.glows.add({ x: bx + (Math.random() - 0.5) * 3, y: by + (Math.random() - 0.5) * 3, z: 1, vz: 10, size: 1.2, life: 0.35, col: '#ffb040', drag: 1 });
      }
      if (e.getaway && Math.sin(t * 18) > 0) kit.glows.add({ x: e.x, y: e.y, z: 4.6, size: 2.4, life: 0.06, col: '#ffd23f' });
    } else if (e.kind === 'heli') {
      const c = slot(e, 'heli', 'heli:news');
      c.at(e.x, e.y, e.z, e.heli.ang + Math.PI / 2, 0.12, 0.35); e.vis = { x: e.x, y: e.y, z: e.z + 2 };
      c.rotor.rotation.y += 0.9;
      if (every(e, '_fx', 0.06)) {
        const bx = e.x - Math.cos(e.heli.ang + Math.PI / 2) * 10, by = e.y - Math.sin(e.heli.ang + Math.PI / 2) * 10;
        kit.smoke(bx, by, e.z + 4, { size: 3, col: '#3a3a40', life: 2.2, rise: 6, spread: 2 });
        kit.glows.add({ x: bx, y: by, z: e.z + 5, size: 3, life: 0.15, col: '#ff8a2a' });
      }
      kit.ring(e.x, e.y, 0, 40, COL.heli, 0.7, 1.6);
    } else if (e.kind === 'rings') {
      e.rings.forEach((r, i) => { if (i >= e.next) kit.hoops.put(r.x, r.y, r.z, r.ang, 0, 0, HOOP, i === e.next ? '#6ff7ff' : i === e.next + 1 ? '#2f8fb0' : '#1d5a70'); });
      const r = e.rings[e.next];
      if (r && every(e, '_fx', 0.05)) { const a = t * 4; kit.glows.add({ x: r.x + Math.cos(r.ang + Math.PI / 2) * Math.cos(a) * HOOP / M, y: r.y + Math.sin(r.ang + Math.PI / 2) * Math.cos(a) * HOOP / M, z: r.z + Math.sin(a) * HOOP / M, size: 3, life: 0.5, col: '#bffcff', shape: 1 }); }
    } else if (e.kind === 'kitten') {
      slot(e, 'cat', 'cat').at(e.x, e.y, e.z + 0.3, Math.atan2(h.y - e.y, h.x - e.x), 0, Math.sin(t * 3) * 0.06); e.vis = { x: e.x, y: e.y, z: e.z + 2 };
      kit.ring(e.x, e.y, e.z, 24, COL.kitten, 0.9, 0.7);
    }
  }
  // r11 F2c: the payoff rides with her in the camera's frame (src/moments/payoff.js)
  drawCarry(dir, view, slot);
  // tabloid drones (vice districts at night) and their flashes
  for (const d of ow.paps.drones) {
    const ang = Math.atan2(h.y - d.y, h.x - d.x);
    kit.drones.put(d.x, d.y, d.z, ang, 0.18, Math.sin(d.blink * 2) * 0.1, KIT.scale.drone);
    if (Math.sin(d.blink * 8) > 0.6) kit.glows.add({ x: d.x, y: d.y, z: d.z + 1, size: 1.3, life: 0.05, col: '#ff2a2a' });
    if (d.flashed > 0.2 && !d._fl) { d._fl = true; kit.flash(d.x + Math.cos(ang) * 2, d.y + Math.sin(ang) * 2, d.z, 10, '#ffffff', 0.2); }
    if (d.flashed <= 0) d._fl = false;
  }
  for (const [k, s] of A) if (!seen.has(k)) { for (const a of Object.values(s)) a.hide(); A.delete(k); }
}

/** Tags and lock-ons for the air events (over the 3D view). */
export function overlayAir(dir, ctx, P, W, H, view) {
  const ow = dir.ow, h = ow.hero, t = ow.t;
  const at = (x, y, z) => { const p = P.proj(x, y, z); return p[2] && p[0] > -20 && p[1] > -20 && p[0] < W + 20 && p[1] < H + 20 ? p : null; };
  const label = (e, x, y, z, text, col, near, hint) => {
    const p = at(x, y, z);
    if (!p || view.onHero(p[0], p[1], 6)) return;
    const d = Math.hypot(x - h.x, y - h.y, z - h.z) * M;
    if (near) reticle(ctx, p[0], p[1], 16, t, { col, dive: true, label: 'CATCH!' });
    if (!view.underHud(p[0], p[1] - 40, 4)) tag(ctx, p[0], p[1] - 10, text, { col, sub: hint || (d > 45 ? `${Math.round(d)}m` : null), lift: near ? 32 : 12, shake: e.phase === 'fall' ? 1.5 : 0 });
  };
  const band = (z) => (z > h.z + 150 ? '▲ CLIMB' : z < h.z - 150 ? '▼ DROP' : null);
  for (const e of ow.events.list) {
    const near2 = Math.hypot(e.x - h.x, e.y - h.y);
    if (e.kind === 'faller') label(e, e.vis?.x ?? e.x, e.vis?.y ?? e.y, e.z + 2, e.phase === 'fall' ? 'FALLING!' : 'HELP!', COL.faller, near2 < 160 && Math.abs(h.z - e.z) < 150, band(e.z));
    else if (e.kind === 'car' || e.kind === 'getaway') label(e, e.x, e.y, 6, e.getaway ? 'GETAWAY!' : 'NO BRAKES!', COL[e.kind], near2 < 140 && h.z <= 260, h.z > 260 ? '▼ DROP TO SKIM' : null);
    else if (e.kind === 'heli') label(e, e.x, e.y, e.z + 8, 'MAYDAY!', COL.heli, near2 < 170 && Math.abs(h.z - e.z) < 120, band(e.z));
    else if (e.kind === 'kitten') label(e, e.x, e.y, e.z + 4, 'MEOW!', COL.kitten, false, near2 < 140 ? 'SLOW DOWN · PERCH' : null);
    else if (e.kind === 'rings') {
      const r = e.rings[e.next];
      if (r) label(e, r.x, r.y, r.z + HOOP / M + 6, `HOOP ${e.next + 1}/${e.rings.length}`, COL.rings, false, Math.abs(r.z - h.z) > 75 ? (r.z > h.z ? '▲ HIGHER' : '▼ LOWER') : BANDS.find((b) => b.z === r.z)?.label);
    }
  }
}
