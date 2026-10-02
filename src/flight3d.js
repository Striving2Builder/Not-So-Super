// Vertical slice: the flight view rendered in real 3D with three.js, behind ?flight=3d (default
// OFF: the 2D canvas flight is untouched). A renderer swap, not a rewrite: the Overworld keeps
// simulating (hero, altitude bands, zones, nav, events); this module draws it as a 3D city with a
// chase camera, and a transparent 2D overlay keeps the comic extras (action lines, edge chips,
// incident icons).
import * as THREE from 'three';
import { City3D, M, height3 } from './city3d.js';
import { Sky3D } from './sky3d.js';
import { FlyHero3D } from './herofly3d.js';
import { FlightCam3D } from './flightcam3d.js';
import { FlightFX3D } from './flightfx3d.js';
import { HeroPass, HERO_LAYER } from './heropass3d.js';
import { lookFrame } from './look3d.js';
import { setBandHeights, speedFraction, BANDS } from './flight.js';
import { DISTRICTS } from './data.js';
import { quality } from './settings.js';
import { sfx } from './sfx.js';

/**
 * Flight in 3D? The default since it beat the 2D view 6/6 in blind tests (2026-10-02). `?flight=2d`
 * keeps the old top-down view, and so does a device without WebGL. Read once.
 */
let on;
export function flight3dEnabled() {
  if (on === undefined) {
    let param = null;
    try { param = new URLSearchParams(location.search).get('flight'); } catch (e) { /* no URL */ }
    on = param !== '2d' && hasWebGL();
  }
  return on;
}
function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

/**
 * 3D look tunables. Altitude bands are re-set for the taller 3D city: skim threads the street
 * canyons, cruise weaves between the towers, high patrol rides above the cloud deck. Skim is
 * slower in 3D (at 2D speeds the canyons are a wall every second).
 */
const LOOK3 = {
  bands: [110, 560, 1100],     // world units (×0.5 m)
  speedMul: [0.5, 1, 1.3],     // top-speed multiplier per band in 3D
  fog: [1100, 1600, 2400],     // fog far (m) per band
  beam: { radius: 7, height: 420, alpha: 0.6, minPx: 0.012 }, // minPx: radius ≥ this × distance (stays a visible stroke far off)
  iconPx: 26,
  patrolBelow: 150,             // speed under which high patrol cranes up to the overhead view
  wallProbe: [10, 22],          // m to each side: a tower face this close rushes past (action lines)
  auto: { ahead: 260, step: 26, halfWidth: 24, turn: 0.22, tries: 6 }, // autopilot look-ahead (world units)
  chips: 3,                     // edge chips for off-screen incidents (the waypoint is extra)
  chipTop: 92,                  // px: chips stay below the top HUD row
  chip: { inset: 30, pad: 18, slide: 34, merge: 64, label: 25 }, // px
  hudAvoid: '#hud-left, #hud-top, #hud-right, #objectives.on, #prompt.on, #btns .tbtn, #stick-base, .caption',
};

const BEAM_VS = `varying vec3 vN; varying float vH; uniform float hgt;
void main() { vN = normalize(normalMatrix * normal); vH = position.y / hgt; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// comic light column: inked silhouette edges, a saturated body, white bands rising up it
const BEAM_FS = `uniform vec3 col; uniform float alpha; uniform float time; varying vec3 vN; varying float vH;
void main() {
  float e = abs(vN.z), ink = 1.0 - smoothstep(0.22, 0.42, e);
  float band = step(0.84, fract(vH * 16.0 - time * 0.9)) * (1.0 - ink);
  vec3 c = mix(mix(col, vec3(1.0), 0.25 * e + 0.55 * band), vec3(0.03, 0.03, 0.08), ink);
  float a = alpha * (1.0 - smoothstep(0.55, 1.0, vH)) * mix(1.0, 1.5, ink);
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export class Flight3D {
  constructor(ow) {
    this.ow = ow;
    this.g = ow.g;
    setBandHeights(LOOK3.bands);
    LOOK3.speedMul.forEach((s, i) => { BANDS[i].speedMul = s; });
    this.scene = null;
    this.beams = new Map();
    this.frame = 0;
    this.canyon = false;
  }

  /** World height (units) of a building for collisions/perching in the 3D city. */
  heightOf(o) { return o.h3 ?? o.h; }

  /** The overworld's collision ceiling: in 3D the towers go much higher. */
  get maxBuilding() { return 900; }

  build() {
    const city = this.g.city;
    this.city = city;
    this.scene = new THREE.Scene();
    this.cam = new FlightCam3D(this.g.w / this.g.h);
    this.sky = new Sky3D(this.scene, city.W * M, city.H * M);
    this.city3 = new City3D(city, this.scene, { tileRes: quality().flyTileRes });
    this.hero = new FlyHero3D(this.scene);
    this.fx3 = new FlightFX3D(this.scene);
    this.heroPass = new HeroPass();
    // a soft fill from the camera so she (and the façades facing us) never go to black at night
    this.fill = new THREE.DirectionalLight(0xffe8cc, 0.7);
    this.scene.add(this.fill, this.fill.target);
    for (const l of [this.fill, this.sky.sun, this.sky.hemi]) l.layers.enable(HERO_LAYER); // she's lit in her own pass too
    for (const b of city.blocks) for (const o of b.b) height3(o, b.d);
  }

  enter() {
    const special = this.g.modes.special;
    special.initRenderer(); // the one WebGL renderer the 3D zones share
    this.renderer = special.renderer;
    if (!this.scene || this.city !== this.g.city) this.build();
    document.body.classList.add('fly3d');
    if (!this.dragHooked) {
      // drag anywhere on the 3D view (the stick and buttons sit above it) to orbit the camera
      this.dragHooked = true;
      addEventListener('keydown', (e) => { if (e.code === 'KeyV' && document.body.classList.contains('fly3d')) this.patrolForced = !this.patrolForced; });
      let last = null;
      const host = document.getElementById('three-host');
      host.addEventListener('pointerdown', (e) => { if (document.body.classList.contains('fly3d')) last = e.clientX; });
      addEventListener('pointermove', (e) => { if (last !== null) { this.orbit(e.clientX - last); last = e.clientX; } });
      addEventListener('pointerup', () => { last = null; });
    }
    this.cam.placed = false; this.cam.yaw = null;
    this.dpr = 0;
  }

  exit() {
    document.body.classList.remove('fly3d');
    if (this.renderer) this.renderer.info.autoReset = true;
    this.g.modes.special.resize(); // hand the shared renderer back at the zones' resolution
  }

  steer(a) { return this.cam ? this.cam.steer(a) : a; }
  boost() {
    this.cam?.boost();
    if (this.fx3 && this.hero) this.fx3.ring(this.hero.group.position, _v.set(Math.cos(this.ow.hero.ang), 0, Math.sin(this.ow.hero.ang)), false);
  }

  /**
   * Autopilot in the 3D city: the 2D route is a straight line, but here the core's towers rise
   * through the cruise band. Look ahead along the wanted heading; if a tower taller than her is in
   * the way, swing to the nearest clear heading (alternating sides, widening), so she threads the
   * gaps at full speed instead of bouncing off façades.
   */
  autoSteer(h, a) {
    if (!a) return a;
    const mag = Math.hypot(a.x, a.y) || 1, base = Math.atan2(a.y, a.x), A = LOOK3.auto;
    const clear = (ang) => {
      const cx = Math.cos(ang), cy = Math.sin(ang), px = -cy * A.halfWidth, py = cx * A.halfWidth;
      for (let d = A.step; d <= A.ahead; d += A.step) {
        const x = h.x + cx * d, y = h.y + cy * d;
        for (const k of [0, 1, -1]) { const o = this.ow.buildingAt(x + px * k, y + py * k); if (o && this.heightOf(o) > h.z - 8) return false; }
      }
      return true;
    };
    // keep the last detour while it's still clear (no flip-flopping between gaps)
    if (this.detour !== undefined && Math.abs(this.detour) > 0 && clear(base + this.detour)) {
      if (clear(base)) this.detour = 0; else return { x: Math.cos(base + this.detour) * mag, y: Math.sin(base + this.detour) * mag };
    }
    if (clear(base)) { this.detour = 0; return a; }
    for (let i = 1; i <= A.tries; i++) for (const sgn of [1, -1]) {
      const off = sgn * i * A.turn;
      if (clear(base + off)) { this.detour = off; return { x: Math.cos(base + off) * mag, y: Math.sin(base + off) * mag }; }
    }
    return a;
  }

  /**
   * She hit a tower face (n = the wall's outward normal, world units): in 3D the towers are
   * everywhere in the cruise band, so instead of the 2D stop-dead she glances off along the
   * façade, losing speed only in proportion to how head-on the hit was. A hard head-on hit still
   * thumps (shake + sound).
   */
  slide(h, nx, ny) {
    const cx = Math.cos(h.ang), cy = Math.sin(h.ang), into = -(cx * nx + cy * ny);
    if (into <= 0) return; // already moving away from it
    let tx = -ny, ty = nx;
    if (tx * cx + ty * cy < 0) { tx = -tx; ty = -ty; }
    h.ang = Math.atan2(ty, tx);
    h.speed *= 1 - 0.45 * into;
    if (into > 0.85 && h.speed > 350 && this.ow.shake < 4) { this.ow.shake = 8; sfx.hit(); }
  }

  /** Drag on the screen (not the stick): orbit the camera round her. */
  orbit(dx) { if (this.cam) this.cam.orbit += dx * 0.006; }

  syncBeams(t) {
    const ow = this.ow, seen = new Set(), cp = this.cam.cam.position, B = LOOK3.beam;
    for (const z of ow.zones) {
      seen.add(z.uid);
      let b = this.beams.get(z.uid);
      if (!b) {
        const geo = new THREE.CylinderGeometry(B.radius, B.radius * 1.4, B.height, 14, 1, true);
        geo.translate(0, B.height / 2, 0);
        b = new THREE.Mesh(geo, new THREE.ShaderMaterial({
          uniforms: { col: { value: new THREE.Color(z.color) }, alpha: { value: B.alpha }, time: { value: 0 }, hgt: { value: B.height } },
          vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, toneMapped: false,
        }));
        b.renderOrder = 6;
        this.scene.add(b);
        this.beams.set(z.uid, b);
      }
      b.position.set(z.x * M, 0, z.y * M);
      b.material.uniforms.time.value = t;
      // far beams thicken so they stay a readable stroke on a phone instead of a hairline
      const d = Math.hypot(b.position.x - cp.x, b.position.z - cp.z), s = Math.max(1, (d * B.minPx) / B.radius);
      b.scale.set(s, 1, s);
    }
    for (const [uid, b] of this.beams) if (!seen.has(uid)) { this.scene.remove(b); b.geometry.dispose(); b.material.dispose(); this.beams.delete(uid); }
  }

  /** Screen projection helpers for the 2D overlay (markers), in CSS px. */
  projector() {
    const cam = this.cam.cam, W = this.g.w, H = this.g.h, v = new THREE.Vector3();
    const proj = (x, y, z) => {
      v.set(x * M, z * M, y * M).project(cam);
      let sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      if (v.z > 1) { sx = W - sx; sy = H * 2; } // behind the camera: push it off the bottom edge
      return [sx, sy, v.z <= 1];
    };
    return { proj };
  }

  /** Pixel ratio: capped lower for the 3D flight, lower again among the towers (fill-rate bound). */
  applyDpr() {
    const caps = quality().fly3dDpr || [1, 1];
    const want = Math.min(devicePixelRatio, caps[this.canyon ? 1 : 0]);
    if (want !== this.dpr) { this.dpr = want; this.renderer.setPixelRatio(want); this.renderer.setSize(this.g.w, this.g.h, false); }
  }

  /** How close a tower face is on her left / right (0..1), for the wall-rush lines. */
  walls(h) {
    const out = { l: 0, r: 0 }, rx = -Math.sin(h.ang), ry = Math.cos(h.ang);
    for (const [k, sgn] of [['l', -1], ['r', 1]]) {
      for (const [i, d] of LOOK3.wallProbe.entries()) {
        const u = d / M, o = this.ow.buildingAt(h.x + rx * u * sgn, h.y + ry * u * sgn);
        if (o && this.heightOf(o) > h.z) { out[k] = i ? 0.55 : 1; break; }
      }
    }
    return out;
  }

  render(ctx) {
    const ow = this.ow, g = this.g, h = ow.hero, st = g.state, W = g.w, H = g.h;
    const dt = Math.min(0.05, (performance.now() - (this.lastT || performance.now())) / 1000);
    this.lastT = performance.now();
    this.frame++;
    const night = st ? st.night : 0.8, clock = st ? st.clock : 22 * 60;
    const frac = speedFraction(h), boosting = !!h.wasBoosting && h.speed > 300 && !h.perch;
    const D = DISTRICTS[ow.district];
    const band = h.band ?? 1;
    // patrol view: V toggles it; it also cranes up by itself when she stops up at high patrol
    const patrol = !ow.diving && (this.patrolForced || (band === BANDS.length - 1 && h.speed < LOOK3.patrolBelow));
    // street canyons: skimming (and moving) among towers taller than her
    this.canyon = band === 0 && !h.perch && !ow.diving;
    this.applyDpr();
    // ground (or roof) under her, for the contact shadow
    const b = ow.buildingAt(h.x, h.y), ground = b && this.heightOf(b) < h.z ? this.heightOf(b) : 0;
    this.hero.update(h, dt, ow.t, !!ow.diving, ground, this.cam.patrolK, boosting);
    const solid = (x, y, z) => { const o = ow.buildingAt(x, y); return !!o && z < this.heightOf(o); };
    this.cam.update(h, dt, frac, { patrol, boosting, canyon: this.canyon ? 1 - h.hover : 0 }, solid);
    this.fill.position.copy(this.cam.cam.position); this.fill.target.position.copy(this.hero.group.position);
    const fogFar = LOOK3.fog[band] || 1600;
    this.sky.update(clock, night, D?.map, this.cam.cam.position, fogFar, this.cam.patrolK);
    this.city3.update(this.cam.cam, { far: fogFar, near: Math.min(700, fogFar * 0.5), night, frame: this.frame });
    this.syncBeams(ow.t);
    this.fx3.update(dt, this.hero, h, frac, boosting, this.cam.cam, ow.fx.rings.length);
    // render
    const r = this.renderer;
    r.info.autoReset = false; r.info.reset(); // count the whole frame (main + her pass), not just the last draw
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    if (this.cam.cam.aspect !== W / H) { this.cam.cam.aspect = W / H; this.cam.cam.updateProjectionMatrix(); }
    lookFrame(r);
    // her own sharp pass (her model moves to the hero layer once it has loaded); the profile's
    // fly3dHero = [MSAA samples, pixel ratio], a ratio of 0 draws her in the main pass instead
    if (this.hero.model && !this.layered) { this.layered = true; this.hero.pivot.traverse((o) => o.layers.set(HERO_LAYER)); }
    const hq = this.heroQ || quality().fly3dHero || [0, 0], sharp = this.layered && hq[1] > 0;
    if (sharp) this.cam.cam.layers.disable(HERO_LAYER); else this.cam.cam.layers.enable(HERO_LAYER);
    r.render(this.scene, this.cam.cam);
    if (sharp) this.heroPass.render(r, this.scene, this.cam.cam, this.hero.group.position, 2.4 * this.hero.size, W, H, hq);
    this.overlay(ctx, night, frac, boosting);
  }

  /** The 2D comic layer over the 3D view: action lines, incident icons at the beam tops, edge chips. */
  overlay(ctx, night, frac, boosting) {
    const ow = this.ow, W = this.g.w, H = this.g.h, h = ow.hero;
    ctx.clearRect(0, 0, W, H);
    const P = this.projector(), hs = P.proj(h.x, h.y, h.z);
    ow.heroScreen = { x: hs[0], y: hs[1] };
    // action lines converge on where she's heading (a point far ahead of her)
    const ahead = 400 / M, vp = P.proj(h.x + Math.cos(h.ang) * ahead, h.y + Math.sin(h.ang) * ahead, h.z);
    const walls = this.canyon && h.speed > 120 ? this.walls(h) : { l: 0, r: 0 };
    const k = this.cam.patrolK > 0.5 ? 0 : 1;
    // (under the HUD: the lines are clipped out of every panel and thumb button)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
    for (const r of this.hudRects()) ctx.roundRect(r.left - 4, r.top - 4, r.width + 8, r.height + 8, 16);
    ctx.clip('evenodd');
    this.fx3.drawLines(ctx, W, H, Math.max(frac * k, ow.fx.rush || 0), boosting && k, vp[2] ? { x: vp[0], y: vp[1] } : { x: W / 2, y: H / 2 }, walls, night);
    ctx.restore();
    // incident icons over everything
    for (const z of ow.zones) {
      const [x, y, front] = P.proj(z.x, z.y, LOOK3.beam.height / M * 0.55);
      if (!front || x < -20 || y < -20 || x > W + 20 || y > H + 20 || this.underHud(x, y, 4)) continue; // (never printed over the HUD)
      ow.drawIcon(ctx, x, y, 11, z, ow.g.state && ow.g.state.locked(z.lockKey), z === ow.near);
      if (z === ow.near && !ow.diving) this.diveTag(ctx, x, y, ow.t);
    }
    ow.heroArt.drawPops(ctx, hs[0], hs[1], Math.min(W, H) / 390);
    this.chips(ctx, P, W, H);
  }

  /** In range of an incident: a pulsing ring and a "DIVE!" tag on it, so the move reads in the world too. */
  diveTag(ctx, x, y, t) {
    const p = 0.5 + 0.5 * Math.sin(t * 7);
    ctx.save();
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,226,58,${0.5 + 0.5 * p})`;
    ctx.beginPath(); ctx.arc(x, y, 17 + 5 * p, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '900 13px Bangers, Impact, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = '#0b0b16'; ctx.strokeText('DIVE! ▼', x, y - 30);
    ctx.fillStyle = '#ffe23a'; ctx.fillText('DIVE! ▼', x, y - 30);
    ctx.restore();
  }

  /** Screen rects the overlay must keep clear (HUD panels, caption, stick, thumb buttons), cached briefly. */
  hudRects() {
    const now = performance.now();
    if (!this.rects || now - this.rectsT > 300) {
      this.rectsT = now;
      this.rects = [...document.querySelectorAll(LOOK3.hudAvoid)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    }
    return this.rects;
  }

  /** Is (x, y) within pad px of any HUD rect? */
  underHud(x, y, pad) {
    for (const r of this.hudRects()) if (x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad) return true;
    return false;
  }

  /**
   * Off-screen incidents as at most a few comic chips on the screen border, pointing the way
   * she'd have to turn: nearest first, chips that land close together merge into one with a
   * count, and a chip that would sit on the HUD, the caption, the stick or a thumb button slides
   * along its edge to the nearest clear spot. The waypoint always gets its own chip.
   */
  chips(ctx, P, W, H) {
    const ow = this.ow, h = ow.hero, cam = this.cam.cam, C = LOOK3.chip;
    cam.getWorldDirection(_f);
    const camYaw = Math.atan2(_f.z, _f.x);
    const list = [];
    const add = (m, waypoint) => {
      const [x, y, front] = P.proj(m.x, m.y, waypoint ? 0 : LOOK3.beam.height / M * 0.55);
      if (front && x > 24 && x < W - 24 && y > 60 && y < H - 24) return; // its beam/icon is in view
      list.push({ m, waypoint, d: Math.hypot(m.x - h.x, m.y - h.y), rel: Math.atan2(m.y - h.y, m.x - h.x) - camYaw });
    };
    for (const z of ow.zones) add(z, false);
    for (const e of ow.events.markers()) add(e, false);
    list.sort((a, b) => a.d - b.d);
    if (ow.nav.target) add({ ...ow.nav.target, color: '#78ffc8' }, true);
    const L = C.inset, T = LOOK3.chipTop, R = W - C.inset, B = H - C.inset, cx = W / 2, cy = H * 0.52;
    const groups = [];
    for (const c of list) {
      // screen direction: ahead = up, right = right, behind = down; onto the inset border
      const sx = Math.sin(c.rel), sy = -Math.cos(c.rel);
      const k = Math.min((sx > 0 ? R - cx : cx - L) / Math.abs(sx || 1e-6), (sy > 0 ? B - cy : cy - T) / Math.abs(sy || 1e-6));
      let x = cx + sx * k, y = cy + sy * k;
      const side = Math.abs(x - L) < 1 || Math.abs(x - R) < 1; // on a side edge: slide vertically
      for (let i = 0; i < 24 && this.underHud(x, y, C.pad); i++) {
        const step = Math.ceil((i + 1) / 2) * C.slide * (i % 2 ? -1 : 1);
        if (side) y = Math.min(B, Math.max(T, cy + sy * k + step)); else x = Math.min(R, Math.max(L, cx + sx * k + step));
      }
      if (this.underHud(x, y, C.pad)) continue; // no clear spot on that edge
      const near = !c.waypoint && groups.find((g) => !g.waypoint && Math.hypot(g.x - x, g.y - y) < C.merge);
      if (near) { near.n++; continue; }
      if (!c.waypoint && groups.filter((g) => !g.waypoint).length >= LOOK3.chips) {
        // full: fold it into the closest chip so the count still says it's out there
        let best = null;
        for (const g of groups) if (!g.waypoint && (!best || Math.hypot(g.x - x, g.y - y) < Math.hypot(best.x - x, best.y - y))) best = g;
        if (best) best.n++;
        continue;
      }
      groups.push({ ...c, x, y, n: 1, sx, sy });
    }
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const c of groups) {
      const { x, y } = c, a = Math.atan2(c.sy, c.sx), col = c.m.color || '#ffd23f';
      // arrow tip toward the target, a round inked chip with its icon
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = col; ctx.strokeStyle = '#0b0b16'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(11, -8); ctx.lineTo(11, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      if (c.waypoint) {
        ctx.fillStyle = col; ctx.strokeStyle = '#0b0b16'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath(); ctx.stroke(); ctx.fill();
      } else if (c.m.glyph) {
        ctx.lineWidth = 3; ctx.strokeStyle = '#0b0b16'; ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke();
        ow.drawIcon(ctx, x, y, 12, c.m, ow.g.state && ow.g.state.locked(c.m.lockKey), false);
      } else {
        ctx.fillStyle = col; ctx.strokeStyle = '#0b0b16'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
      }
      if (c.n > 1) { // count badge
        const bx = x + 12, by = y - 12;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b0b16'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0b0b16'; ctx.font = '900 10px system-ui, sans-serif'; ctx.fillText(String(c.n), bx, by + 0.5);
      }
      // distance in an ink pill, on the side facing the middle of the screen
      const label = `${Math.round(c.d / 10).toLocaleString()}m`, ly = y + (y > cy ? -C.label : C.label);
      const lx = Math.min(W - 26, Math.max(26, x));
      ctx.font = '800 11px system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(11,11,22,.82)'; ctx.beginPath(); ctx.roundRect(lx - tw / 2, ly - 8, tw, 16, 8); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#0b0b16'; ctx.strokeText(label, lx, ly);
      ctx.fillStyle = '#fff'; ctx.fillText(label, lx, ly);
    }
    ctx.restore();
  }
}
