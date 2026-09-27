// Flying patrol over the procedural city, drawn in 2.5D: every point is projected with a
// straight-down perspective camera, so rooftops grow and lean away from screen centre.
import { BLOCK, ROAD, LOT } from './city.js';
import { DISTRICTS, STREET_CRIMES, CASES, VENUES, THEMES, BOSSES, HERO, NIGHT_DISTRICTS, ASYLUM } from './data.js';
import { drawHeroTop, glow } from './art.js';
import { clamp, lerp, pick, chance, rand, dist, shade, rgba, easeOut, easeInOut, fmtClock, fmtTime, wobble, $ } from './util.js';
import { heroReady, HeroSprite } from './hero3d.js';
import { loadClub, preloadClub } from './clubzone.js';
import { quality, settings } from './settings.js';
import { AirEvents } from './airevents.js';
import { Paparazzi } from './paparazzi.js';
import { Navigator } from './nav.js';
import { CityFeed } from './cityfeed.js';
import { stepFlight, stepAltitude, speedFraction, cameraZoom, cameraLead, FLIGHT, BANDS, CRUISE_BAND, CAM_ABOVE } from './flight.js';
import { Airspace } from './airspace.js';
import { drawAtmosphere, FOG_Z } from './atmosphere.js';
import { Sky, SpeedFX } from './sky.js';
import { CityArt, SUN, grade, headlight, InkSprite } from './cityart.js';
import { FlightAudio } from './flightaudio.js';
import { nightCaseFields } from './nightcase.js';
import { asylumFields } from './asylum.js';
import { toast, banner, flash, openModal, closeModal } from './ui.js';
import { hash2 } from './rng.js';
import { sfx } from './sfx.js';

const TILT = 0.2;    // oblique view: perspective centre sits this fraction of the screen below centre
const PERCH_EVERY = 40; // seconds between super-hearing reveals
const ALT = BANDS[CRUISE_BAND].z; // cruising altitude (single source: flight.js)
const DIVE_T = 1.1;
const NEAR_R = 130;
const PRELOAD_R = 1600; // start downloading a club's building when she's this close to its zone
const TARGET = { street: 5, case: 2, special: 2 };

export class Overworld {
  constructor(g) {
    this.g = g;
    this.zones = [];
    this.parts = [];
    this.hero = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, z: ALT, bank: 0, speed: 0, lean: 0, hover: 1, band: CRUISE_BAND, perch: null };
    this.camH = ALT + CAM_ABOVE;
    this.hearT = 0;
    this.cam = { x: 0, y: 0 };
    this.zoom = 1;
    this.k = 1;
    this.t = 0;
    this.uid = 1;
    this.spawnT = 0;
    this.smokeT = 0;
    this.attract = false;
    this.district = null;
    this.shake = 0;
    this.inCloud = 0;
    this.fx = new SpeedFX();
    this.audio = new FlightAudio();
    this.events = new AirEvents(this);   // airborne rescues and stunts
    this.paps = new Paparazzi(this);     // tabloid drones in vice districts at night
    this.nav = new Navigator();          // waypoint + autopilot
    this.feed = new CityFeed();          // clips in the minimap corner
    this.frame = 0;
    this.kick = 0;                       // boost punch (0..1), widens the view for a beat
    this.ink = new InkSprite();          // outlined, rim-lit copy of her sprite + her shadow
  }

  reset() {
    const c = this.g.city;
    const s = c.seeds.find((s) => s.type === 'downtown') || { x: c.landCols / 2, y: c.rows / 2 };
    this.hero.x = Math.round(s.x) * BLOCK + ROAD / 2;
    this.hero.y = Math.round(s.y) * BLOCK + ROAD / 2;
    Object.assign(this.hero, { vx: 0, vy: 0, speed: 0, hover: 1, z: ALT, band: CRUISE_BAND, perch: null });
    this.camH = ALT + CAM_ABOVE;
    this.airspace = new Airspace(c.seed, c.W, c.H, ALT);
    this.lastHeard = undefined;
    this.hearRings = [];
    this.sky = new Sky(c.seed, c.W, c.H, ALT);
    this.cam.x = this.hero.x; this.cam.y = this.hero.y;
    this.zones = [];
    this.parts = [];
    this.district = null;
    this.events.reset();
    this.paps.reset();
    this.feed.stop();
    this.nav.clear();
    this.shock = null;
    this.choppersAnnounced = false;
    this.crowdT = rand(10, 20);
    for (let i = 0; i < 12; i++) this.maintainZones(true);
  }

  enter(p = {}) {
    const inp = this.g.input;
    inp.setStick(true);
    inp.setButtons([
      { id: 'dive', label: 'DIVE', key: 'Space', cls: 'big' },
      { id: 'boost', label: 'BOOST', key: 'Shift' },
      { id: 'map', label: 'MAP', key: 'M', slot: 2 },
      { id: 'climb', label: '▲<br>UP', key: 'R', slot: 3 },
      { id: 'descend', label: '▼<br>DOWN', key: 'F', slot: 4 },
      { id: 'perch', label: 'PERCH', key: 'H', slot: 5 },
    ]);
    this.diving = null;
    this.rising = null;
    if (p.returnFrom) {
      this.rising = 0; this.zoom = 1.6; Object.assign(this.hero, { z: 40, speed: 0, band: CRUISE_BAND, perch: null });
      this.superJump();
    }
    if (!this.attract) this.audio.start();
    $('hud-extra').innerHTML = '';
    $('objectives').classList.remove('on');
  }

  exit() {
    $('prompt').classList.remove('on');
    this.audio.stop();
    this.feed.stop();
  }

  // ------------------------------------------------------------------ launch & landing
  /** Leaving a zone: a super-jump off the street, cracking the pavement. */
  superJump() {
    const h = this.hero;
    this.shock = { x: h.x, y: h.y, t: 0 };
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), v = rand(60, 200);
      this.parts.push({ x: h.x, y: h.y, z: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(20, 90), life: 1.1, max: 1.1, size: rand(5, 10), col: '#b8b0a0' });
    }
    this.shake = Math.max(this.shake, 10);
    this.fx.launch();
    if (!this.attract) sfx.boost();
  }

  // ------------------------------------------------------------------ altitude, perching, hearing
  /** World-units to offset the camera so the tilted view still centres on her. */
  tiltOffset() {
    const P = this.camH / (this.camH - this.hero.z), T = this.g.h * TILT;
    return ((P - 1) * T) / (this.k * P);
  }

  altitudeInput(inp, a) {
    const h = this.hero;
    if (inp.pressed('perch')) { if (h.perch) this.leavePerch(); else this.tryPerch(); }
    if (inp.pressed('climb')) {
      if (h.perch) this.leavePerch();
      else if (h.band < BANDS.length - 1) { h.band++; sfx.whoosh(); }
    }
    if (inp.pressed('descend') && !h.perch && h.band > 0) { h.band--; sfx.whoosh(); }
    if (h.perch && Math.hypot(a.x, a.y) > 0.45) this.leavePerch(); // push off to take flight
  }

  /** The tallest building footprint under (x, y), or null. */
  buildingAt(x, y) {
    const c = this.g.city, bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    let best = null;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const blk = c.block(bx + dx, by + dy);
      if (!blk) continue;
      for (const o of blk.b) {
        const inside = o.kind === 'box' ? x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.d
          : o.kind === 'round' ? Math.hypot(x - o.x, y - o.y) <= o.rad : false;
        if (inside && (!best || o.h > best.h)) best = o;
      }
    }
    return best;
  }

  /** A roof she can land on right now (slow enough, over a building worth standing on). */
  perchTarget() {
    const h = this.hero;
    if (h.perch || h.speed > 140) return null;
    const b = this.buildingAt(h.x, h.y);
    return b && b.h >= 35 ? b : null;
  }

  tryPerch() {
    const b = this.perchTarget();
    if (!b) { toast('Slow down over a rooftop to perch', 'info'); return; }
    const h = this.hero;
    h.perch = { z: b.h + 2 };
    h.speed = 0;
    this.feed.onPerch(DISTRICTS[this.district]?.name);
    this.perchT = 0;
    this.listened = false;
    this.waitNoted = false;
    sfx.whoosh();
  }

  leavePerch() {
    const h = this.hero;
    if (!h.perch) return;
    h.perch = null;
    for (let i = 0; i < 12; i++) this.parts.push({ x: h.x, y: h.y, z: h.z, vx: rand(-90, 90), vy: rand(-90, 90), vz: rand(20, 60), life: 0.7, max: 0.7, size: 5, col: '#c8c0b0' });
    sfx.whoosh();
  }

  /** While perched: after a moment, super-hearing picks up a crime nearby (with a cooldown). */
  updatePerch(dt) {
    this.perchT += dt;
    this.hearRings = (this.hearRings || []).filter((r) => (r.t += dt) < 1.6);
    if (this.perchT > 0.6 && Math.floor(this.perchT / 0.8) > Math.floor((this.perchT - dt) / 0.8)) this.hearRings.push({ t: 0 });
    if (this.listened || this.perchT < 1.6) return;
    const h = this.hero;
    // Cooldown on the overworld's own clock (this.t), which reset() clears with lastHeard.
    const wait = PERCH_EVERY - (this.t - (this.lastHeard ?? -Infinity));
    if (wait > 0) {
      // Keep listening while she stays perched; just tell her once how long it'll be.
      if (!this.waitNoted) { this.waitNoted = true; toast(`👂 Quiet out there… listening (${Math.ceil(wait)}s)`, 'info'); }
      return;
    }
    this.listened = true;
    const z = this.spawn(pick(['street', 'street', 'case']), true, undefined, { x: h.x, y: h.y, r: 1500 });
    if (!z) { toast('👂 Nothing but traffic noise.', 'info'); return; }
    this.lastHeard = this.t;
    z.name = `Heard: ${z.name}`;
    z.ttl += 60;
    sfx.pickup();
    toast(`👂 Super-hearing: ${z.name} in ${DISTRICTS[z.district].name}!`, 'good');
    if (this.heroScreen) this.g.commentary.thought('Did I hear… trouble?', this.heroScreen.x, this.heroScreen.y - 30);
  }

  /** Low-altitude rooftop skimming: towers taller than her are solid. */
  collideBuildings(h) {
    const c = this.g.city, bx = Math.floor(h.x / BLOCK), by = Math.floor(h.y / BLOCK), R = 18;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const blk = c.block(bx + dx, by + dy);
      if (!blk) continue;
      for (const o of blk.b) {
        if ((o.kind !== 'box' && o.kind !== 'round') || o.h <= h.z) continue; // only structures taller than her
        // Already above the footprint (descending onto it, rising out of a zone on its lot):
        // she floats over the roof instead of being shoved sideways through the walls.
        const inside = o.kind === 'box' ? h.x >= o.x && h.x <= o.x + o.w && h.y >= o.y && h.y <= o.y + o.d
          : Math.hypot(h.x - o.x, h.y - o.y) <= o.rad;
        if (inside) { h.z = o.h + 2; continue; }
        // Flying into its side: it's a wall.
        let px, py;
        if (o.kind === 'box') { px = clamp(h.x, o.x, o.x + o.w); py = clamp(h.y, o.y, o.y + o.d); }
        else { const a = Math.atan2(h.y - o.y, h.x - o.x); px = o.x + Math.cos(a) * o.rad; py = o.y + Math.sin(a) * o.rad; }
        const ddx = h.x - px, ddy = h.y - py, d = Math.hypot(ddx, ddy);
        if (d >= R || d < 1e-6) continue;
        h.x = px + (ddx / d) * R; h.y = py + (ddy / d) * R;
        if (h.speed > 350) { this.shake = Math.max(this.shake, 8); sfx.hit(); }
        h.speed *= 0.35;
      }
    }
  }

  /** Little pedestrians walking the sidewalks — only worth drawing when she's low. */
  drawPedestrians(ctx, V, city, bx0, bx1, by0, by1) {
    const fade = clamp((260 - this.hero.z) / 90, 0, 1) * (1 - 0.5 * V.night);
    if (fade <= 0) return;
    const cols = ['#e05a5a', '#5ab0e0', '#e0c05a', '#6ad08a', '#c07ae0', '#f0f0f0', '#333333'];
    const side = LOT - 6, per = side * 4, r = Math.max(1.3, 2.4 * V.k);
    ctx.save();
    ctx.globalAlpha = fade;
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
      const b = city.block(bx, by);
      if (b.d === 'farm') continue;
      const n = b.d === 'suburb' ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const s = hash2(bx * 7 + i, by, 5);
        const dir = i % 2 ? 1 : -1;
        let u = (s * per + dir * this.t * (10 + s * 10)) % per;
        if (u < 0) u += per;
        const e = Math.floor(u / side), f = u % side;
        const x = b.x0 + 3 + (e === 0 ? f : e === 1 ? side : e === 2 ? side - f : 0);
        const y = b.y0 + 3 + (e === 0 ? 0 : e === 1 ? f : e === 2 ? side : side - f);
        ctx.fillStyle = cols[i % cols.length];
        const px = V.SX(x), py = V.SY(y);
        if (fade > 0.35 && px > 0 && py > 0 && px < V.W && py < V.H) this.peds.push({ x, y });
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        // close to her: an arm raised, pointing up at her
        const dx = this.hero.x - x, dy = this.hero.y - y, d2 = dx * dx + dy * dy;
        if (d2 < 220 * 220) {
          const d = Math.sqrt(d2) || 1, len = r * 2.4;
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r * 0.6);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (dx / d) * len, py + (dy / d) * len - len * 0.5); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /**
   * A pedestrian on screen, off to one side of her, to put a citizen's line in the mouth of.
   * Returns { x, y, anchor } (screen point + a follower that keeps the tail on them as the
   * street scrolls), or null when nobody's in view, e.g. she's flying too high to see the street.
   */
  speakerSpot() {
    const V = this.V, hs = this.heroScreen;
    if (!V || !hs || !this.peds?.length) return null;
    const near = this.peds.filter((p) => {
      const d = dist(V.SX(p.x), V.SY(p.y), hs.x, hs.y);
      return d > 110 && d < 340;
    });
    if (!near.length) return null;
    const p = pick(near);
    const anchor = () => (this.g.modeName === 'overworld' && this.V ? { x: this.V.SX(p.x), y: this.V.SY(p.y) } : null);
    return { ...anchor(), anchor };
  }

  /** Called by the main loop while a modal (pause, map, dialog) is up. */
  onPaused() { this.audio.silence(); this.feed.pause(); }

  /** Siren from the nearest incident: louder as she approaches, panned to its side of the screen. */
  nearestSiren() {
    const h = this.hero;
    let best = null, bd = 1600;
    for (const z of this.zones) { const d = dist(z.x, z.y, h.x, h.y); if (d < bd) { bd = d; best = z; } }
    if (!best) return null;
    return { vol: 1 - bd / 1600, pan: clamp((best.x - h.x) / 800, -1, 1) };
  }

  // ------------------------------------------------------------------ zones
  maintainZones(initial = false) {
    const counts = { street: 0, case: 0, special: 0 };
    for (const z of this.zones) if (!z.lead) counts[z.kind]++; // leads are extra, beyond the quota
    // Always keep one club raid (premade 3D club) somewhere on the map.
    const clubs = Object.keys(VENUES).filter((v) => VENUES[v].club);
    if (clubs.length && !this.zones.some((z) => z.mode === 'special' && VENUES[z.venue]?.club)) { this.spawn('special', initial, pick(clubs)); return; }
    // ...and the asylum (its own zone type, src/asylum.js)
    if (!this.zones.some((z) => z.mode === 'asylum') && this.spawn('asylum', initial)) return;
    for (const k of ['street', 'case', 'special']) {
      if (counts[k] < TARGET[k]) { this.spawn(k, initial); return; }
    }
  }

  /** Create one incident of `kind` on the map; returns the zone (or null if there's no room). */
  /** `near` = {x, y, r}: only place it within r of that point (super-hearing). */
  spawn(kind, initial, forceVenue, near) {
    const city = this.g.city, h = this.hero;
    // After dark, most cases are night cases inside the 3D clubs.
    const night = kind === 'case' && this.g.state && this.g.state.isNight && chance(0.75);
    let def, districts, venueName;
    if (kind === 'asylum') districts = ASYLUM.districts;
    else if (kind === 'street') { def = pick(STREET_CRIMES); districts = def.districts; }
    else if (night) districts = NIGHT_DISTRICTS;
    else if (kind === 'case') { def = pick(CASES); districts = def.districts; }
    else { venueName = forceVenue || pick(Object.keys(VENUES).filter((v) => !VENUES[v].asylum)); def = VENUES[venueName]; districts = def.districts; }
    const cands = city.blocks.filter((b) => {
      if (districts !== '*' && !districts.includes(b.d)) return false;
      const cx = b.x0 + LOT / 2, cy = b.y0 + LOT / 2;
      if (near && dist(cx, cy, near.x, near.y) > near.r) return false;
      return dist(cx, cy, h.x, h.y) > (near ? 200 : initial ? 250 : 500) && this.zones.every((z) => dist(z.x, z.y, cx, cy) > 520);
    });
    if (!cands.length) return null;
    const b = pick(cands);
    const z = { uid: this.uid++, kind, district: b.d, t: 0, x: b.x0 + LOT / 2, y: b.y0 + LOT / 2 };
    if (kind === 'asylum') {
      Object.assign(z, asylumFields());
    } else if (kind === 'street') {
      if (!def.variant) { z.x = b.x0 - ROAD / 2; z.y = b.y0 + LOT * rand(0.25, 0.75); }
      Object.assign(z, {
        mode: 'brawl', def, name: def.name, reward: def.reward, diff: def.diff, boss: def.boss || null, variant: def.variant,
        lockKey: 'Street Crime', ttl: rand(120, 180), color: def.variant === 'fire' ? '#ff7a1a' : def.boss ? '#ff3030' : '#ffd23f',
        glyph: def.variant === 'fire' ? 'F' : '!', risk: def.diff >= 3 ? 'Medium' : 'Low', blurb: def.blurb,
      });
    } else if (night) {
      Object.assign(z, nightCaseFields());
    } else if (kind === 'case') {
      Object.assign(z, {
        mode: 'investigate', def, name: def.name, reward: def.reward, lockKey: 'Investigations', ttl: rand(160, 230),
        color: '#3fd0ff', glyph: '?', risk: 'Traps', blurb: `Investigate ${def.crime}. Your camera and X-ray vision are your weapons here.`,
      });
    } else {
      const theme = pick(def.themes);
      const boss = chance(0.4) ? pick(BOSSES) : null;
      Object.assign(z, {
        mode: 'special', venue: venueName, theme, name: `${venueName}: ${THEMES[theme].name}`, reward: 40 + (boss ? 30 : 0), boss,
        lockKey: venueName, ttl: rand(220, 300), color: boss ? '#ff3030' : '#ff3fb8', glyph: boss ? 'B' : '★', risk: 'CAPTURE',
        blurb: `${THEMES[theme].name} operation inside the ${venueName}${boss ? `, run by ${boss}` : ''}. Traps everywhere.`,
      });
    }
    this.zones.push(z);
    if (!initial && !this.attract && kind !== 'street') toast(`New ${z.mode === 'nightcase' ? 'night case' : kind === 'case' ? 'investigation' : 'special zone'}: ${z.name} (${DISTRICTS[z.district].name})`, 'info');
    return z;
  }

  removeZone(z) { this.zones = this.zones.filter((q) => q !== z); }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const g = this.g, h = this.hero, st = g.state, inp = g.input, city = g.city;
    city.updateTraffic(dt);
    this.updateParticles(dt);

    if (this.diving) {
      // Steerable dive: she homes in on the incident but the stick nudges where she hits;
      // she accelerates toward the ground (ease-in height) while the view rushes in.
      const d = this.diving;
      d.t += dt;
      const f = Math.min(1, d.t / DIVE_T), e = easeInOut(f);
      const a = inp.axis();
      d.ox = clamp((d.ox || 0) + a.x * 160 * dt, -80, 80); d.oy = clamp((d.oy || 0) + a.y * 160 * dt, -80, 80);
      h.x = lerp(d.sx, d.z.x + d.ox * (1 - f * 0.3), e); h.y = lerp(d.sy, d.z.y + d.oy * (1 - f * 0.3), e);
      h.z = lerp(d.z0, 30, f * f);
      this.zoom = lerp(d.zoom0, 1.6, e);
      this.camH = h.z + CAM_ABOVE;
      this.cam.x = h.x; this.cam.y = h.y - this.tiltOffset();
      this.fx.setRush(f);
      if (f > 0.88 && !d.impact) {
        d.impact = true;
        this.shock = { x: h.x, y: h.y, t: 0 };
        this.shake = Math.max(this.shake, 14);
        sfx.hit();
      }
      if (d.t >= DIVE_T && !d.fired) { d.fired = true; this.fx.setRush(0); flash(); g.startZone(d.z); }
      return;
    }
    if (this.shock) { this.shock.t += dt; if (this.shock.t > 0.8) this.shock = null; }
    if (this.rising !== null) {
      this.rising += dt;
      const e = easeOut(Math.min(1, this.rising / 1.1));
      h.z = lerp(40, BANDS[h.band].z, e);
      this.zoom = lerp(1.6, 1, e);
      this.camH = h.z + CAM_ABOVE;
      if (this.rising >= 1.1) this.rising = null;
    }

    // --- flight
    let a;
    if (this.attract) {
      const cx = city.landCols * BLOCK / 2, cy = city.rows * BLOCK / 2, R = 1500;
      const tx = cx + Math.cos(this.t * 0.12) * R, ty = cy + Math.sin(this.t * 0.12) * R;
      const m = Math.hypot(tx - h.x, ty - h.y) || 1;
      a = { x: (tx - h.x) / m, y: (ty - h.y) / m };
    } else {
      a = wobble(inp.axis(), st ? st.intox : 0, this.t);
      // Autopilot: steer to the waypoint while the stick is idle; any input takes over.
      // (Still subject to the drunk wobble: autopilot is not a way around intoxication.)
      if (this.nav.autopilot && this.nav.target && !h.perch && Math.hypot(a.x, a.y) < 0.12) a = wobble(this.nav.steer(h), st ? st.intox : 0, this.t);
    }
    const boost = !this.attract && inp.down('boost');
    if (!this.attract) this.altitudeInput(inp, a);
    const ev = stepFlight(h, h.perch ? { x: 0, y: 0 } : a, boost && !h.perch, dt, BANDS[h.band].speedMul);
    if (this.rising === null) stepAltitude(h, dt);
    this.camH += (h.z + CAM_ABOVE - this.camH) * Math.min(1, dt * 4);
    // perched = standing on the roof; rising out of a zone = the camera move owns her position
    if (h.z < 300 && !h.perch && this.rising === null) this.collideBuildings(h);
    h.x = clamp(h.x, 0, city.W);
    h.y = clamp(h.y, 0, city.H);
    if (h.perch) this.updatePerch(dt);
    const frac = speedFraction(h);
    if (!this.attract) {
      if (ev.boostStart) { sfx.boost(); this.shake = Math.max(this.shake, 5); this.kick = 1; }
      if (ev.sonic) { sfx.sonicBoom(); this.shake = 12; this.fx.sonicBoom(); }
    }
    // Camera: look further ahead and pull out as she speeds up (dive/rise animations own the zoom).
    const lead = cameraLead(h);
    this.cam.x += (h.x + h.vx * lead - this.cam.x) * Math.min(1, dt * 4);
    this.cam.y += (h.y + h.vy * lead - this.tiltOffset() - this.cam.y) * Math.min(1, dt * 4);
    if (this.rising === null) this.zoom += (cameraZoom(h) - this.zoom) * Math.min(1, dt * 2);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.kick = Math.max(0, this.kick - dt * 1.8);
    // Contrail at top speed.
    if (h.speed > FLIGHT.sonic && chance(dt * 40)) this.parts.push({ x: h.x - h.vx * 0.04, y: h.y - h.vy * 0.04, z: h.z, vx: 0, vy: 0, vz: 0, life: 0.6, max: 0.6, size: 5, col: '#dff4ff', glow: true });
    this.sky.update(dt);
    this.airspace.update(dt);
    this.inCloud = this.sky.immersion(h);
    if (this.inCloud > 0.3 && !this.wasInCloud) sfx.whoosh();
    this.wasInCloud = this.inCloud > 0.3;
    this.fx.update(dt, frac, h.ang, this.g.w, this.g.h);
    if (!this.attract) this.audio.update(frac, this.nearestSiren(), this.inCloud);

    // --- district tracking (drives tabloid heat)
    const d = city.districtAt(h.x, h.y);
    if (d !== this.district) {
      this.district = d;
      const D = DISTRICTS[d];
      if (D && !this.attract) {
        if (D.vice) toast('📸 Tabloid photographers lurk in this district', 'bad');
        this.g.commentary.onDistrict(d); // "MEANWHILE, IN THE DOCKS…" caption with the crime report
        this.feed.onDistrict(d, D.name);
      }
    }
    const D = DISTRICTS[d];
    // photographers can't snap her from high up; skimming the rooftops is riskier
    // exposure follows her actual height, so a low perch is as risky as skimming
    const exposure = h.perch ? BANDS[h.z < BANDS[CRUISE_BAND].z - 60 ? 0 : CRUISE_BAND].vice : BANDS[h.band].vice;
    g.vice = { active: !!(D && D.vice), where: D && D.name, rate: 1.1 * exposure };

    if (!this.attract && st) { this.updateCity(dt); this.feed.update(dt, DISTRICTS[this.district]?.name); }

    // --- zones
    if (!this.attract) {
      for (const z of this.zones) {
        z.t += dt;
        if (z.mode === 'nightcase' && !st.isNight && z !== this.near) {
          this.removeZone(z);
          toast(`Closing time: ${z.name} is off until tonight.`, 'info');
          break;
        }
        if (z.t > z.ttl) {
          this.removeZone(z);
          if (z.kind === 'street') st.addRep(-2, `${z.name} went unanswered`);
          else toast(`${z.name} has gone cold.`, 'info');
          break;
        }
      }
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = 2.5; this.maintainZones(); }
    }
    let near = null, nd = NEAR_R;
    for (const z of this.zones) { const dd = dist(z.x, z.y, h.x, h.y); if (dd < nd) { nd = dd; near = z; } }
    this.near = this.attract ? null : near;
    if (!this.attract) this.preloadNearbyClub(h);
    this.updatePrompt();
    if (!this.attract) {
      if (inp.pressed('dive')) this.tryDive();
      if (inp.pressed('map')) this.openMap();
    }

    // smoke from factory stacks & fire zones
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.12;
      const hw = this.g.w / this.k / 2 + 200, hh = this.g.h / this.k / 2 + 200;
      for (const s of city.stacks) {
        if (Math.abs(s.x - this.cam.x) < hw && Math.abs(s.y - this.cam.y) < hh && chance(0.5))
          this.parts.push({ x: s.x, y: s.y, z: s.h, vx: 18 + rand(-5, 5), vy: rand(-8, 8), vz: 25, life: 3, max: 3, size: 7, col: '#9a9a9a' });
      }
      for (const z of this.zones) {
        if (z.variant !== 'fire' || Math.abs(z.x - this.cam.x) > hw || Math.abs(z.y - this.cam.y) > hh) continue;
        this.parts.push({ x: z.x + rand(-40, 40), y: z.y + rand(-40, 40), z: 30, vx: rand(-10, 10), vy: rand(-10, 10), vz: 60, life: 2.5, max: 2.5, size: 12, col: '#3a3a3a' });
        this.parts.push({ x: z.x + rand(-40, 40), y: z.y + rand(-40, 40), z: 20, vx: 0, vy: 0, vz: 90, life: 0.8, max: 0.8, size: 6, col: '#ffa02a', glow: true });
      }
    }
  }

  /** The living city: airborne events, tabloid drones, news choppers, crowds, the waypoint. */
  updateCity(dt) {
    const h = this.hero, st = this.g.state;
    if (this.rising === null) this.events.update(dt);
    this.paps.update(dt);
    // (announced once per session: helicopter emergencies borrow and return choppers)
    if (this.airspace.follow(h, st.rep >= 300 ? 2 : st.rep >= 150 ? 1 : 0) && !this.choppersAnnounced) {
      this.choppersAnnounced = true;
      toast('📺 A news chopper is following you. The city is watching!', 'good');
    }
    // crowds below shout when she skims past
    this.crowdT -= dt;
    const spot = this.crowdT <= 0 && h.z < 260 && h.speed > 200 && DISTRICTS[this.district] && this.district !== 'farm' && this.speakerSpot();
    if (spot) {
      this.crowdT = rand(16, 28);
      const lines = st.rep < 0 ? ['Hey! Watch it!', 'Show-off!', 'There goes trouble…'] : ['Look! Up in the sky!', "It's Supergirl!", "Mommy, look, she's flying!", "Go get 'em!"];
      this.g.commentary.talk(pick(lines), spot.x, spot.y, { kind: 'shout', speaker: 'CROWD', anchor: spot.anchor });
    }
    const res = this.nav.update(h, (ref) => this.zones.includes(ref) || this.events.list.includes(ref));
    if (res === 'arrived') toast(this.near ? "You're over the incident: DIVE!" : '🧭 Arrived at your waypoint', 'info');
    else if (res === 'gone') toast('🧭 Waypoint cleared: that incident is over', 'info');
  }

  updateParticles(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (!p.glow) p.size += dt * 5;
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  /**
   * Load the nearest club building in the background, so diving in is quick. Sticks with its
   * choice while she stays in range: phones keep one club in memory, so hopping between two
   * nearby clubs would evict and reload them over and over.
   */
  preloadNearbyClub(h) {
    const range = (key) => Math.min(...this.zones.filter((z) => VENUES[z.venue]?.club === key).map((z) => dist(z.x, z.y, h.x, h.y)));
    if (this.preloadKey && range(this.preloadKey) < PRELOAD_R * 1.3) return;
    this.preloadKey = null;
    let best = PRELOAD_R;
    for (const z of this.zones) {
      const club = VENUES[z.venue]?.club;
      const d = club ? dist(z.x, z.y, h.x, h.y) : Infinity;
      if (d < best) { best = d; this.preloadKey = club; }
    }
    if (this.preloadKey) preloadClub(this.preloadKey);
  }

  tryDive() {
    const z = this.near, st = this.g.state;
    if (!z) { toast('Fly over a crime marker to dive in', 'info'); return; }
    const lock = st.locked(z.lockKey);
    if (lock) { toast(`You promised to stay out of ${z.lockKey} zones for ${fmtTime(lock)}`, 'bad'); sfx.lose(); return; }
    this.diving = { z, t: 0, sx: this.hero.x, sy: this.hero.y, z0: this.hero.z, zoom0: this.zoom };
    this.events.abandon(); // someone else handles the airborne stuff while she's busy
    if (this.nav.target && this.nav.target.ref === z) this.nav.clear(); // reached it
    this.hero.perch = null;
    this.g.commentary.onDive(z); // spinning-emblem transition + sting
    if (VENUES[z.venue]?.club) loadClub(VENUES[z.venue].club); // start loading the building during the dive
  }

  updatePrompt() {
    const el = $('prompt');
    const z = this.near;
    this.g.input.setButton('dive', { lit: !!z });
    if (!z || this.diving) { el.classList.remove('on'); return; }
    const lock = this.g.state.locked(z.lockKey);
    const rc = z.risk === 'CAPTURE' ? '#ff3fb8' : z.risk === 'Traps' ? '#3fd0ff' : '#ffd23f';
    const key = document.body.classList.contains('touch') ? 'DIVE' : 'SPACE';
    const html = lock
      ? `🔒 <b>${z.name}</b> — locked by your deal for ${fmtTime(lock)}`
      : `<b>${key}</b> to dive: <b>${z.name}</b> · ${DISTRICTS[z.district].name}<span class="risk" style="background:${rc}33;color:${rc}">${z.risk}</span><br><small>${z.blurb || ''} Reward +${z.reward} · ${fmtTime(z.ttl - z.t)} left</small>`;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.classList.add('on');
  }

  hud() {
    const st = this.g.state;
    const D = DISTRICTS[this.district];
    $('hud-title').textContent = D ? D.name : 'Harbor';
    const alt = this.hero.perch ? 'Perched' : BANDS[this.hero.band].label;
    const nav = this.nav.target ? ` · 🧭 ${Math.round(this.nav.distance(this.hero) / 10)}m${this.nav.autopilot ? ' (auto)' : ''}` : '';
    const drones = this.paps.drones.some((d) => !d.leaving) ? ' · 📸 drones!' : '';
    $('hud-sub').textContent = `${fmtClock(st.clock)} · ${alt} · ${this.zones.length} incidents${D && D.vice ? ' · ⚠ vice' : ''}${drones}${nav}`;
    this.g.input.setButton('perch', { lit: !this.hero.perch && !!this.perchTarget() });
    this.drawMinimap();
  }

  drawMinimap() {
    const c = $('minimap'), g = c.getContext('2d'), city = this.g.city;
    const W = c.width, H = c.height;
    g.fillStyle = '#0a1020'; g.fillRect(0, 0, W, H);
    const s = Math.min(W / city.minimap.width, H / city.minimap.height);
    const ox = (W - city.minimap.width * s) / 2, oy = (H - city.minimap.height * s) / 2;
    g.imageSmoothingEnabled = false;
    g.drawImage(city.minimap, ox, oy, city.minimap.width * s, city.minimap.height * s);
    const m = city.mapScale * s;
    const blink = Math.sin(this.t * 8) > 0;
    for (const z of this.zones) {
      g.fillStyle = z.color;
      const r = z.kind === 'special' ? 4.5 : 3.5;
      g.beginPath(); g.arc(ox + z.x * m, oy + z.y * m, blink ? r : r - 1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
    }
    for (const e of this.events.markers()) {
      g.fillStyle = e.color; g.fillRect(ox + e.x * m - 2.5, oy + e.y * m - 2.5, 5, 5);
    }
    if (this.nav.target) {
      const t = this.nav.target; g.strokeStyle = '#78ffc8'; g.lineWidth = 2;
      g.beginPath(); g.arc(ox + t.x * m, oy + t.y * m, 5, 0, Math.PI * 2); g.stroke();
    }
    const h = this.hero;
    g.save(); g.translate(ox + h.x * m, oy + h.y * m); g.rotate(h.ang);
    g.fillStyle = '#fff'; g.strokeStyle = '#d82630'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-2, 0); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  openMap() {
    const city = this.g.city;
    const S = 3;
    const c = document.createElement('canvas');
    c.width = city.minimap.width * S; c.height = city.minimap.height * S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(city.minimap, 0, 0, c.width, c.height);
    const m = city.mapScale * S;
    g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const z of this.zones) {
      g.fillStyle = z.color; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.arc(z.x * m, z.y * m, 8, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#000'; g.fillText(z.glyph === 'F' ? '🔥' : z.glyph, z.x * m, z.y * m + 1);
    }
    g.fillStyle = '#fff'; g.strokeStyle = '#d82630'; g.lineWidth = 3;
    g.beginPath(); g.arc(this.hero.x * m, this.hero.y * m, 7, 0, Math.PI * 2); g.fill(); g.stroke();
    const legend = Object.values(DISTRICTS).map((d) => `<span><i style="background:${d.map}"></i>${d.name}</span>`).join('');
    const kinds = `<span><i style="background:#ffd23f"></i>Street crime</span><span><i style="background:#ff7a1a"></i>Fire</span><span><i style="background:#3fd0ff"></i>Investigation</span><span><i style="background:#b36bff"></i>Night case</span><span><i style="background:#ff3fb8"></i>Special zone</span><span><i style="background:#ff3030"></i>Boss</span><span><i style="background:#9fe8ff"></i>Asylum</span>`;
    for (const e of this.events.markers()) {
      g.fillStyle = e.color; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.fillRect(e.x * m - 6, e.y * m - 6, 12, 12); g.strokeRect(e.x * m - 6, e.y * m - 6, 12, 12);
    }
    if (this.nav.target) {
      const t = this.nav.target; g.strokeStyle = '#78ffc8'; g.lineWidth = 3;
      g.beginPath(); g.arc(t.x * m, t.y * m, 11, 0, Math.PI * 2); g.stroke();
    }
    // Everything worth flying to, nearest first.
    const h = this.hero;
    const targets = [
      ...this.zones.map((z) => ({ x: z.x, y: z.y, color: z.color, name: z.name, where: DISTRICTS[z.district].name, left: z.ttl - z.t, ref: z })),
      ...this.events.markers().map((e) => ({ ...e, where: 'In the air', left: e.t })),
    ].map((t) => ({ ...t, d: dist(t.x, t.y, h.x, h.y) })).sort((a, b) => a.d - b.d);
    const rows = targets.slice(0, 8).map((t, i) => `<button class="opt navto" data-i="${i}"><span class="k" style="background:${t.color}"></span><span class="l">${t.name}<small>${t.where} · ${Math.round(t.d / 10)}m${t.left > 0 && t.left < 9999 ? ` · ${fmtTime(t.left)} left` : ''}</small></span></button>`).join('');
    const auto = () => `Autopilot: ${settings.autopilot ? 'ON' : 'OFF'}`;
    const el = openModal(`<h2>City Map</h2><p class="hint" style="margin:0 0 6px;opacity:.75;font-size:12px">Tap the map or an incident to set a waypoint. With autopilot on, she flies there whenever you let go of the stick.</p><div class="mapwrap"></div><div class="legend">${kinds}<span><i style="background:#6ff7ff"></i>In the air</span></div><h3 style="margin:12px 0 6px;font-size:13px">Nearest incidents</h3><div class="opts">${rows || '<small>Quiet night.</small>'}</div><div class="legend">${legend}</div><div class="opts" style="margin-top:12px"><button class="opt autop"><span class="k">A</span><span class="l">${auto()}</span></button>${this.nav.target ? '<button class="opt clearwp"><span class="k">X</span><span class="l">Clear waypoint</span></button>' : ''}<button class="opt closemap"><span class="k">M</span><span class="l">Close map</span></button></div>`);
    el.querySelector('.mapwrap').appendChild(c);
    const close = () => { removeEventListener('keydown', onKey, true); closeModal(el); };
    const setWaypoint = (t) => { this.nav.set(t); sfx.click(); toast(`🧭 Waypoint: ${t.name}${settings.autopilot ? ' (let go of the stick to fly there)' : ''}`, 'info'); close(); };
    const onKey = (e) => {
      if (['KeyM', 'Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.code === 'KeyA') { e.preventDefault(); e.stopPropagation(); settings.toggleAutopilot(); el.querySelector('.autop .l').textContent = auto(); }
    };
    addEventListener('keydown', onKey, true);
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * c.width / m, y = ((e.clientY - r.top) / r.height) * c.height / m;
      // snap onto an incident if the tap was close to one
      const hit = targets.find((t) => dist(t.x, t.y, x, y) < 90);
      setWaypoint(hit ? { x: hit.x, y: hit.y, name: hit.name, ref: hit.ref } : { x, y, name: 'Map waypoint' });
    });
    el.querySelectorAll('.navto').forEach((b) => b.addEventListener('click', () => { const t = targets[+b.dataset.i]; setWaypoint({ x: t.x, y: t.y, name: t.name, ref: t.ref }); }));
    el.querySelector('.autop').addEventListener('click', () => { settings.toggleAutopilot(); el.querySelector('.autop .l').textContent = auto(); });
    el.querySelector('.clearwp')?.addEventListener('click', () => { this.nav.clear(); close(); });
    el.querySelector('.closemap').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
  }

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h, city = g.city, st = g.state;
    const night = st ? st.night : 0.8;
    const q = quality(), rich = q.id !== 'saver';
    const DBG = window.__owx || {};
    this.frame++;
    if (!this.art || this.art.city !== city) this.art = new CityArt(city, rich ? 192 : 112, rich ? 64 : 40, rich ? 170 : 130);
    // The ground gets smaller as the camera climbs (true perspective); she stays the same size.
    // A boost kicks the view wider for a beat, like a camera FOV punch.
    const punch = this.kick > 0 ? Math.sin(this.kick * Math.PI) * 0.07 : 0;
    const k = (Math.min(W, H) / 760) * this.zoom * ((ALT + CAM_ABOVE) / this.camH) * (1 - punch);
    this.k = k;
    const cx = W / 2, scy = H / 2, camX = this.cam.x, camY = this.cam.y, camH = this.camH;
    // Perspective centre below the screen centre = a slight oblique view: roofs lean up-screen,
    // south faces show. Ground points are unaffected; height lifts things by (P-1)·T.
    const T = H * TILT, cy = scy + T;
    const P = (z) => camH / (camH - z);
    const SX = (x, z = 0) => cx + (x - camX) * k * P(z);
    const SY = (y, z = 0) => scy + (y - camY) * k * P(z) - (P(z) - 1) * T;
    const V = { cx, cy, scy, k, P, SX, SY, night, lights: [], t: this.t, W, H, camH, rich: rich && !DBG.noRich };
    this.V = V; // for things that place speech bubbles in world space
    const h = this.hero;

    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    // Camera sway: the world rolls a touch against her bank, and breathes at speed.
    const roll = rich && !h.perch ? -h.bank * 0.045 + Math.sin(this.t * 1.7) * 0.004 * speedFraction(h) : 0;
    if (roll) { ctx.translate(cx, scy); ctx.rotate(roll); ctx.translate(-cx, -scy); }
    if (st && st.intox > 30) {
      const a = Math.sin(this.t * 1.1) * (st.intox - 30) * 0.0009;
      ctx.translate(cx, scy); ctx.rotate(a); ctx.scale(1 + (st.intox - 30) * 0.0008, 1 + (st.intox - 30) * 0.0008); ctx.translate(-cx, -scy);
    }
    // outskirts + roads
    ctx.fillStyle = '#26402a'; ctx.fillRect(-120, -120, W + 240, H + 240);
    const land = { x0: SX(0), y0: SY(0), x1: SX(city.coastX), y1: SY(city.H) };
    ctx.fillStyle = '#2a2d35'; ctx.fillRect(land.x0, land.y0, land.x1 - land.x0, land.y1 - land.y0);

    const hw = W / 2 / k + 280, hh = H / 2 / k + 280;
    // ocean
    if (camX + hw > city.coastX) {
      const sx = SX(city.coastX);
      ctx.fillStyle = '#1d4f78'; ctx.fillRect(sx, -120, W - sx + 120, H + 240);
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const wy = Math.floor((camY - hh) / 90) * 90 + i * 90;
        const ox = ((this.t * 20 + i * 57) % 160);
        ctx.beginPath();
        for (let wx = city.coastX + 40 - ox; wx < camX + hw; wx += 160) { ctx.moveTo(SX(wx), SY(wy)); ctx.lineTo(SX(wx + 60), SY(wy)); }
        ctx.stroke();
      }
      ctx.fillStyle = '#6a6a66'; ctx.fillRect(sx - 4 * k, land.y0, 6 * k, land.y1 - land.y0);
    }

    const bx0 = Math.max(0, Math.floor((camX - hw) / BLOCK)), bx1 = Math.min(city.landCols - 1, Math.floor((camX + hw) / BLOCK));
    const by0 = Math.max(0, Math.floor((camY - hh) / BLOCK)), by1 = Math.min(city.rows - 1, Math.floor((camY + hh) / BLOCK));
    // Ground: pre-painted cells (roads, sidewalks, lots, cast shadows) just need the right on-screen
    // bounds (a ground point maps linearly), plus a margin for the camera roll and shake.
    const gw = (W / 2 + 90) / k, gh = (H / 2 + 90) / k + Math.abs(roll) * W / k;
    const gx0 = Math.max(0, Math.floor((camX - gw - Math.abs(roll) * H / k) / BLOCK)), gx1 = Math.min(city.landCols - 1, Math.floor((camX + gw + Math.abs(roll) * H / k) / BLOCK));
    const gy0 = Math.max(0, Math.floor((camY - gh) / BLOCK)), gy1 = Math.min(city.rows - 1, Math.floor((camY + gh) / BLOCK));
    const CS = BLOCK * k + 0.6; // a hair of overlap hides seams between cells
    if (!DBG.noGround) for (let by = gy0; by <= gy1; by++) for (let bx = gx0; bx <= gx1; bx++) {
      ctx.drawImage(this.art.cell(bx, by, this.frame), SX(bx * BLOCK), SY(by * BLOCK), CS, CS);
    }
    const blds = [];
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) for (const o of city.block(bx, by).b) blds.push(o);
    // Aerial perspective: the higher she flies, the more the street sinks into haze under the roofs.
    const haze = clamp((camH - 950) / 700, 0, 1) * (rich ? 0.3 : 0.2);
    if (haze > 0.01) {
      ctx.fillStyle = night > 0.5 ? `rgba(40,44,90,${haze})` : `rgba(170,190,215,${haze})`;
      ctx.fillRect(-120, -120, W + 240, H + 240);
    }

    // water objects
    for (const o of city.water) {
      if (Math.abs(o.x - camX) > hw + 200 || Math.abs(o.y - camY) > hh) continue;
      if (o.t === 'pier') { ctx.fillStyle = '#6b5a45'; ctx.fillRect(SX(o.x), SY(o.y), o.w * k, o.h * k); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.strokeRect(SX(o.x), SY(o.y), o.w * k, o.h * k); }
      else { blds.push({ kind: 'box', x: o.x, y: o.y, w: o.w, d: o.h, h: 16, col: o.col, ship: true }); blds.push({ kind: 'box', x: o.x + o.w - 44, y: o.y + 6, w: 30, d: o.h - 12, h: 34, col: '#e8e8e8' }); }
    }

    // traffic: inked car bodies, a glossy roof, headlight cones and tail lights after dark
    ctx.strokeStyle = '#0c0c16'; ctx.lineWidth = Math.max(1, 1.2 * k);
    for (const c of city.cars) {
      if (Math.abs(c.x - camX) > hw || Math.abs(c.y - camY) > hh) continue;
      const horiz = c.dir === 0 || c.dir === 2;
      const ox = c.dir === 1 ? -9 : c.dir === 3 ? 9 : 0, oy = c.dir === 0 ? 9 : c.dir === 2 ? -9 : 0;
      const w = horiz ? 22 : 11, d = horiz ? 11 : 22;
      const x = c.x + ox - w / 2, y = c.y + oy - d / 2, sx = SX(x), sy = SY(y);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(sx + 2 * k, sy + 3 * k, w * k, d * k);
      ctx.fillStyle = c.col; ctx.fillRect(sx, sy, w * k, d * k);
      if (k > 0.3) ctx.strokeRect(sx, sy, w * k, d * k);
      ctx.fillStyle = 'rgba(20,30,50,.8)';
      ctx.fillRect(SX(x + (horiz ? 6 : 2)), SY(y + (horiz ? 2 : 6)), (horiz ? 9 : 7) * k, (horiz ? 7 : 9) * k);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(SX(x + (horiz ? 7 : 3)), SY(y + (horiz ? 3 : 7)), (horiz ? 3 : 5) * k, (horiz ? 5 : 3) * k);
      if (night > 0.3) {
        const fx = c.x + ox + [11, 0, -11, 0][c.dir], fy = c.y + oy + [0, 11, 0, -11][c.dir];
        const bx = c.x + ox - [11, 0, -11, 0][c.dir], by = c.y + oy - [0, 11, 0, -11][c.dir];
        V.lights.push({ t: 'beam', x: SX(fx), y: SY(fy), a: c.dir * Math.PI / 2, r: 46 * k });
        V.lights.push({ t: 'glow', x: SX(bx), y: SY(by), r: 7 * k, c: '#ff3030', a: 0.9 });
      }
    }

    if (!this.attract) this.events.drawGround(ctx, V);

    // street life, visible when she's low
    this.peds = []; // pedestrians on screen this frame (world coords), for citizen chatter
    if (h.z < 260) this.drawPedestrians(ctx, V, city, bx0, bx1, by0, by1);

    // zone ground rings
    for (const z of this.zones) {
      if (Math.abs(z.x - camX) > hw || Math.abs(z.y - camY) > hh) continue;
      const pulse = (this.t * 1.2) % 1;
      ctx.strokeStyle = rgba(z.color, 0.9 * (1 - pulse)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(SX(z.x), SY(z.y), (30 + pulse * 70) * k, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(z.color, 0.18);
      ctx.beginPath(); ctx.arc(SX(z.x), SY(z.y), 34 * k, 0, Math.PI * 2); ctx.fill();
    }

    // shockwave from a landing or a super-jump launch
    if (this.shock) {
      const e = this.shock.t / 0.8, x = SX(this.shock.x), y = SY(this.shock.y);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - e)})`; ctx.lineWidth = 6 * (1 - e) + 1;
      ctx.beginPath(); ctx.ellipse(x, y, (20 + e * 170) * k, (14 + e * 120) * k, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(60,50,40,${0.35 * (1 - e)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 34 * k, 22 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
    // waypoint on the ground
    if (this.nav.target && !this.attract) {
      const t = this.nav.target, x = SX(t.x), y = SY(t.y), r = (20 + ((this.t * 1.5) % 1) * 30) * k;
      ctx.strokeStyle = `rgba(120,255,200,${0.9 * (1 - ((this.t * 1.5) % 1))})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
    }

    const sprite = heroReady();
    if (!sprite) {
      // placeholder art: a plain shadow ellipse (sun from the north-west)
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(SX(h.x + h.z * SUN.x), SY(h.y + h.z * SUN.y), 20 * k, 9 * k, h.ang, 0, Math.PI * 2); ctx.fill();
    }

    // buildings, far from screen centre first so near ones overlap correctly
    for (const b of blds) {
      const bx = b.kind === 'crane' ? b.x : b.x + (b.w || 0) / 2, by = b.kind === 'crane' ? (b.y + b.y2) / 2 : b.y + (b.d || 0) / 2;
      b._d = (bx - camX) * (bx - camX) + (by - camY) * (by - camY);
    }
    blds.sort((a, b) => b._d - a._d);
    if (!DBG.noBld) for (const b of blds) this.drawBuilding(ctx, b, V);

    // Her shadow, cast along the sun onto whatever is under it (street or rooftop): it slides
    // away from her and softens the higher she is above that surface, which reads as altitude.
    const HS = 1.65; // on-screen size of her sprite relative to the world (she's the star)
    if (sprite && this.sprite) this.drawHeroShadow(ctx, V, HS);

    // smoke (under the night overlay)
    for (const p of this.parts) {
      if (p.glow) continue;
      ctx.fillStyle = rgba(p.col, 0.45 * (p.life / p.max));
      ctx.beginPath(); ctx.arc(SX(p.x, p.z), SY(p.y, p.z), p.size * k * P(p.z), 0, Math.PI * 2); ctx.fill();
    }

    // Night grade: a moonlit multiply keeps colour (neon roofs stay saturated) instead of greying
    // everything under a flat navy veil; then the baked street-light maps add back warm pools.
    // (rich) the vignette rides in the same multiply pass; saver gets the flat tint only.
    if ((night > 0 || rich) && !DBG.noGrade) {
      ctx.globalCompositeOperation = 'multiply';
      if (rich) ctx.drawImage(grade(night, 0.7 + 0.3 * speedFraction(h)), -130, -130, W + 260, H + 260);
      else {
        const f = 0.66 * night;
        ctx.fillStyle = `rgb(${(255 - 222 * f) | 0},${(255 - 205 * f) | 0},${(255 - 120 * f) | 0})`;
        ctx.fillRect(-120, -120, W + 240, H + 240);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (night > 0.2 && !DBG.noLight) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, (night - 0.2) * 1.4);
      for (let by = gy0; by <= gy1; by++) for (let bx = gx0; bx <= gx1; bx++) {
        ctx.drawImage(this.art.lightCell(bx, by, this.frame), SX(bx * BLOCK), SY(by * BLOCK), CS, CS);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawLights(ctx, V);

    for (const p of this.parts) {
      if (!p.glow) continue;
      ctx.globalAlpha = p.life / p.max;
      const r = p.size * k * P(p.z) * 3;
      ctx.drawImage(glow(p.col), SX(p.x, p.z) - r, SY(p.y, p.z) - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    // sky layers below her: district haze (seen from above), clouds, searchlights, flyers
    const visBlocks = [];
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) visBlocks.push(city.block(bx, by));
    const clock = st ? st.clock : 22 * 60;
    if (h.z > FOG_Z) drawAtmosphere(ctx, V, city, visBlocks, clock, false);
    this.sky.draw(ctx, V, h.z, false);
    this.airspace.drawSearchlights(ctx, V);
    this.airspace.drawFlyers(ctx, V, h.z, false);

    // zone beacons (beams now; icons after the upper clouds so they always read)
    const icons = [];
    for (const z of this.zones) {
      if (Math.abs(z.x - camX) > hw || Math.abs(z.y - camY) > hh) continue;
      const top = 230 + Math.sin(this.t * 3 + z.uid) * 10;
      const gx = SX(z.x), gy = SY(z.y), tx = SX(z.x, top), ty = SY(z.y, top);
      const grd = ctx.createLinearGradient(gx, gy, tx, ty);
      grd.addColorStop(0, rgba(z.color, 0.55)); grd.addColorStop(1, rgba(z.color, 0));
      ctx.strokeStyle = grd; ctx.lineWidth = 10 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke();
      icons.push([tx, ty, 15 * k * P(top), z, st && st.locked(z.lockKey)]);
    }

    // airborne events and tabloid drones
    if (!this.attract) { this.events.drawAir(ctx, V); this.paps.draw(ctx, V); }

    // heroine
    const hs = k * P(h.z) * HS;
    this.fx.draw(ctx, SX(h.x, h.z), SY(h.y, h.z), hs);
    const hx = SX(h.x, h.z), hy = SY(h.y, h.z) + Math.sin(this.t * 2.2) * 2 * k;
    this.heroScreen = { x: hx, y: hy };
    if (sprite) {
      // Real rigged model rendered top-down with the Flying clip; heading is +x on the sprite.
      const px = q.heroSprite >= 192 ? 256 : q.heroSprite; // she's drawn big now: a sharper render
      if (!this.sprite) this.sprite = new HeroSprite(px, px);
      const sp = this.sprite;
      sp.setSize(px, px);
      if (h.perch) sp.hero.pose('idle', this.t); // standing on the roof (seen from above)
      else {
        sp.hero.pose(this.diving ? 'jump' : 'fly', this.diving ? 0.9 : this.t);
        // Arms relax out of the punch-forward pose as she slows into a hover.
        if (!this.diving) sp.hero.superFly(1 - 0.8 * h.hover);
      }
      // Airspeed drives the cape: it streams behind her (-z) and lifts a little off her back (+y).
      // Airflow over her back holds the cape up against gravity (y ≈ 10) and streams it to her feet.
      const air = 8 + h.speed / 50;
      sp.hero.setWind(Math.sin(this.t * 2.3) * 1.8, 10.5 * (1 - 0.6 * h.hover), -air);
      // Bank into turns, pitch up into a hover when slow, dip the head when accelerating.
      const img = sp.render({ view: 'top', yaw: 0, span: 2.6, roll: h.perch ? 0 : h.bank * 0.45, pitch: h.perch ? 0 : h.hover * 1.15 - h.lean * 0.25 });
      const size = 2.6 * 40 * hs; // 1 sprite metre ≈ 40 art units
      // Ink outline + a warm rim on her sun side (the light's direction, turned into sprite space).
      const art = DBG.noInk ? img : this.ink.build(img, Math.atan2(-1, -1) - h.ang - roll, rich, night);
      const sc = size / img.width, pad = this.ink.pad * sc;
      ctx.save();
      ctx.translate(hx, hy); ctx.rotate(h.ang);
      // a soft aura so she separates from busy neon rooftops
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.14 + 0.22 * night;
      ctx.drawImage(glow('#9fd8ff'), -size * 0.55, -size * 0.55, size * 1.1, size * 1.1);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(art, -size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
      ctx.restore();
    } else drawHeroTop(ctx, hx, hy, hs, h.ang, this.t, h.bank);
    // super-hearing: sound rings pulsing out while perched
    if (h.perch) for (const r of this.hearRings || []) {
      const e = r.t / 1.6;
      ctx.strokeStyle = `rgba(160,220,255,${0.7 * (1 - e)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hx, hy, (30 + e * 320) * k, 0, Math.PI * 2); ctx.stroke();
    }

    // clouds above her, then markers on top so they always read
    if (h.z <= FOG_Z) drawAtmosphere(ctx, V, city, visBlocks, clock, true);
    this.airspace.drawFlyers(ctx, V, h.z, true);
    this.sky.draw(ctx, V, h.z, true);
    this.airspace.drawPlanes(ctx, V);
    for (const [x, y, r, z, locked] of icons) this.drawIcon(ctx, x, y, r, z, locked, z === this.near);
    ctx.restore();

    // comic speed lines when she really moves
    this.fx.drawComic(ctx, hx, hy, W, H, night);

    // off-screen zone arrows (screen space, unrolled)
    if (!this.attract && !this.diving) this.drawArrows(ctx, V);

    // Inside a cloud: brief white-out.
    if (this.inCloud > 0.05) {
      ctx.fillStyle = `rgba(235,242,255,${Math.min(0.75, this.inCloud * 0.9) * (1 - 0.5 * night)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.paps.drawFlash(ctx, W, H);

    if (this.diving) {
      const e = Math.min(1, this.diving.t / DIVE_T);
      const grd = ctx.createRadialGradient(cx, scy, Math.min(W, H) * 0.2 * (1 - e * 0.6), cx, scy, Math.max(W, H) * 0.7);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, `rgba(255,255,255,${e * 0.8})`);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
  }

  /** Her silhouette on the street or roof below, offset along the sun by her height above it. */
  drawHeroShadow(ctx, V, HS) {
    const h = this.hero, { SX, SY, k, P } = V;
    let zr = 0, x = h.x + h.z * SUN.x, y = h.y + h.z * SUN.y;
    const b = this.buildingAt(x, y);
    if (b && b.h < h.z) { zr = b.h; x = h.x + (h.z - zr) * SUN.x; y = h.y + (h.z - zr) * SUN.y; }
    const above = h.z - zr, sil = this.ink.shadow;
    if (!sil) return;
    const size = 2.6 * 40 * HS * k * P(zr) * (1 + above / 2400);
    const sc = size / (sil.width - this.ink.pad * 2), full = sil.width * sc;
    ctx.save();
    ctx.translate(SX(x, zr), SY(y, zr)); ctx.rotate(h.ang);
    const a = clamp(0.5 - above / 1400, 0.16, 0.5) * (1 - 0.35 * V.night);
    // two offset passes fake a penumbra that widens with height
    const blur = Math.min(6, 1 + above / 120) * k;
    ctx.globalAlpha = a * 0.6; ctx.drawImage(sil, -full / 2 - blur, -full / 2 - blur, full + blur * 2, full + blur * 2);
    ctx.globalAlpha = a * 0.7; ctx.drawImage(sil, -full / 2, -full / 2, full, full);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawIcon(ctx, x, y, r, z, locked, near) {
    ctx.fillStyle = locked ? '#555' : z.color;
    ctx.strokeStyle = near ? '#fff' : 'rgba(0,0,0,.6)'; ctx.lineWidth = near ? 3 : 2;
    ctx.beginPath(); ctx.arc(x, y, r * (near ? 1.25 : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = `900 ${r * 1.2}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(locked ? '🔒' : z.glyph === 'F' ? '🔥' : z.glyph === 'B' ? '☠' : z.glyph, x, y + r * 0.08);
  }

  drawArrows(ctx, V) {
    const W = this.g.w, H = this.g.h, m = 34;
    const marks = [...this.zones, ...this.events.markers()];
    if (this.nav.target) marks.push({ ...this.nav.target, color: '#78ffc8', waypoint: true });
    for (const z of marks) {
      const sx = V.SX(z.x), sy = V.SY(z.y);
      if (sx > m && sx < W - m && sy > m + 50 && sy < H - m) continue;
      const a = Math.atan2(sy - V.scy, sx - V.cx);
      const tx = Math.cos(a), ty = Math.sin(a);
      const s = Math.min((W / 2 - m) / Math.abs(tx || 1e-6), (H / 2 - m - 20) / Math.abs(ty || 1e-6));
      const ax = V.cx + tx * s, ay = V.scy + ty * s;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = z.color; ctx.strokeStyle = z.waypoint ? '#fff' : 'rgba(0,0,0,.6)'; ctx.lineWidth = z.waypoint ? 3 : 2;
      const sc = z.waypoint ? 1.4 : 1;
      ctx.beginPath(); ctx.moveTo(14 * sc, 0); ctx.lineTo(-4 * sc, -9 * sc); ctx.lineTo(-4 * sc, 9 * sc); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(z.x, z.y, this.hero.x, this.hero.y) / 10)}m`, ax - tx * 18, ay - ty * 18 + 3);
    }
  }

  drawBuilding(ctx, b, V) {
    const { cx, cy, k, P, SX, SY, night } = V;
    if (b.kind === 'tree') {
      const s = P(b.h), gx = SX(b.x), gy = SY(b.y);
      const x = cx + (gx - cx) * s, y = cy + (gy - cy) * s, r = b.rad * k * s;
      // (its shadow is baked into the ground cell)
      ctx.fillStyle = shade(b.col, -0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (V.rich) { ctx.strokeStyle = '#0b1a0e'; ctx.lineWidth = Math.max(0.8, k); ctx.stroke(); }
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (b.kind === 'round') {
      const s = P(b.h), gx = SX(b.x), gy = SY(b.y);
      const rx = cx + (gx - cx) * s, ry = cy + (gy - cy) * s;
      const gr = b.rad * k, rr = b.rad * k * s;
      ctx.fillStyle = shade(b.col, -0.3);
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = shade(b.col, -0.3); ctx.lineWidth = gr * 2; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(rx, ry); ctx.stroke();
      if (b.dome) {
        const grd = ctx.createRadialGradient(rx - rr * 0.3, ry - rr * 0.3, rr * 0.1, rx, ry, rr);
        grd.addColorStop(0, '#4a5a4e'); grd.addColorStop(1, '#1a201c');
        ctx.fillStyle = grd;
      } else ctx.fillStyle = shade(b.col, 0.05);
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.fill();
      if (b.stack) { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(rx, ry, rr * 0.6, 0, Math.PI * 2); ctx.fill(); }
      if (b.neon) V.lights.push({ t: 'ring', x: rx, y: ry, r: rr, c: b.neon });
      return;
    }
    if (b.kind === 'crane') {
      const s = P(b.h);
      const a = [SX(b.x), SY(b.y)], c = [SX(b.x2), SY(b.y2)];
      const at = [cx + (a[0] - cx) * s, cy + (a[1] - cy) * s], ct = [cx + (c[0] - cx) * s, cy + (c[1] - cy) * s];
      ctx.strokeStyle = shade(b.col, -0.3); ctx.lineWidth = 4 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(at[0], at[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(ct[0], ct[1]); ctx.stroke();
      ctx.strokeStyle = b.col; ctx.lineWidth = 7 * k * s;
      ctx.beginPath(); ctx.moveTo(at[0], at[1]); ctx.lineTo(ct[0], ct[1]);
      const mx = (at[0] + ct[0]) / 2, my = (at[1] + ct[1]) / 2, bx = SX(b.x + 190, b.h), byy = SY((b.y + b.y2) / 2, b.h);
      ctx.moveTo(mx, my); ctx.lineTo(bx, byy); ctx.stroke();
      return;
    }

    const s = P(b.h);
    const gx0 = SX(b.x), gx1 = SX(b.x + b.w), gy0 = SY(b.y), gy1 = SY(b.y + b.d);
    const rx0 = cx + (gx0 - cx) * s, rx1 = cx + (gx1 - cx) * s, ry0 = cy + (gy0 - cy) * s, ry1 = cy + (gy1 - cy) * s;
    const base = b.col, small = b.container || b.truck;
    // One light for the whole city (sun/moon from the north-west, matching the baked shadows):
    // north and west faces catch it, south and east faces sit in shade.
    const walls = [];
    if (gy1 < cy) walls.push('s');
    if (gy0 > cy) walls.push('n');
    if (gx1 < cx) walls.push('e');
    if (gx0 > cx) walls.push('w');
    const TONE = { s: -0.36, n: -0.08, e: -0.5, w: -0.18 };
    // the edge of face `w` at perspective scale p (1 = ground, s = roof)
    const edge = (w, p) => {
      if (w === 's') return [cx + (gx0 - cx) * p, cy + (gy1 - cy) * p, cx + (gx1 - cx) * p, cy + (gy1 - cy) * p];
      if (w === 'n') return [cx + (gx0 - cx) * p, cy + (gy0 - cy) * p, cx + (gx1 - cx) * p, cy + (gy0 - cy) * p];
      if (w === 'e') return [cx + (gx1 - cx) * p, cy + (gy0 - cy) * p, cx + (gx1 - cx) * p, cy + (gy1 - cy) * p];
      return [cx + (gx0 - cx) * p, cy + (gy0 - cy) * p, cx + (gx0 - cx) * p, cy + (gy1 - cy) * p];
    };
    const band = (w, p0, p1) => { const a = edge(w, p0), c = edge(w, p1); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[2], a[3]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[0], c[1]); ctx.closePath(); };
    for (const w of walls) { ctx.fillStyle = shade(base, TONE[w]); ctx.beginPath(); band(w, 1, s); ctx.fill(); }
    const tall = b.h >= 36 && !small && !b.house && !b.ship;
    if (walls.length && V.rich && !small) {
      // ambient occlusion: the foot of each wall darkens toward the street
      ctx.fillStyle = 'rgba(4,6,20,.3)'; ctx.beginPath();
      const pf = P(Math.min(b.h * 0.35, 30));
      for (const w of walls) band(w, 1, pf);
      ctx.fill();
      // glass: a sky reflection streak up the lit half of each face
      if (b.glass && tall) {
        ctx.fillStyle = 'rgba(200,230,255,.13)'; ctx.beginPath();
        for (const w of walls) {
          const a = edge(w, 1), c = edge(w, s);
          ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], a[2], 0.35), lerp(a[1], a[3], 0.35)); ctx.lineTo(lerp(c[0], c[2], 0.35), lerp(c[1], c[3], 0.35)); ctx.lineTo(c[0], c[1]); ctx.closePath();
        }
        ctx.fill();
      }
    }

    // floor lines by day / lit window rows by night
    if (tall) {
      const floors = Math.min(16, Math.floor(b.h / 13));
      const seed = hash2(b.x | 0, b.y | 0);
      ctx.strokeStyle = b.glass ? 'rgba(220,240,255,.22)' : 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
      ctx.beginPath();
      const warm = !b.glass || seed > 0.7;
      for (let f = 1; f < floors; f++) {
        const p = P((f * b.h) / floors);
        for (const w of walls) {
          const [x1, y1, x2, y2] = edge(w, p);
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          if (night > 0.2 && hash2(f, walls.length, (seed * 1e6) | 0) > 0.35) V.lights.push({ t: 'win', x1, y1, x2, y2, cool: !warm });
        }
      }
      ctx.stroke();
    }

    // roof
    const rw = rx1 - rx0, rh = ry1 - ry0, u = k * s; // u: roof pixels per world unit
    if (b.house || b.barn) {
      ctx.fillStyle = b.roofCol; ctx.fillRect(rx0, ry0, rw, rh);
      // pitched roof: the half facing away from the sun is darker
      ctx.fillStyle = shade(b.roofCol, -0.3);
      if (rw > rh) ctx.fillRect(rx0, ry0 + rh / 2, rw, rh / 2); else ctx.fillRect(rx0 + rw / 2, ry0, rw / 2, rh);
      ctx.fillStyle = shade(b.roofCol, 0.25);
      if (rw > rh) ctx.fillRect(rx0, ry0 + rh / 2 - u, rw, u * 1.5); else ctx.fillRect(rx0 + rw / 2 - u, ry0, u * 1.5, rh);
      if (b.barn) { ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.strokeRect(rx0 + 2, ry0 + 2, rw - 4, rh - 4); }
    } else {
      const top = b.gold ? '#d8b24a' : shade(base, 0.12);
      if (!small && V.rich && rw > 14) {
        // parapet: a lit rim, the roof deck inside it, and the rim's own shadow on the deck
        const i = clamp(Math.min(rw, rh) * 0.07, 1.2, 4 * u + 1);
        ctx.fillStyle = shade(base, 0.32); ctx.fillRect(rx0, ry0, rw, rh);
        ctx.fillStyle = b.gold ? '#c49a36' : shade(base, 0.02); ctx.fillRect(rx0 + i, ry0 + i, rw - i * 2, rh - i * 2);
        ctx.fillStyle = 'rgba(0,0,10,.22)';
        ctx.fillRect(rx0 + i, ry0 + i, rw - i * 2, i * 0.9); ctx.fillRect(rx0 + i, ry0 + i, i * 0.9, rh - i * 2);
      } else { ctx.fillStyle = top; ctx.fillRect(rx0, ry0, rw, rh); }
      if (b.container || b.corrugated || b.sawtooth) {
        ctx.strokeStyle = b.sawtooth ? 'rgba(180,220,255,.45)' : 'rgba(0,0,0,.2)'; ctx.lineWidth = b.sawtooth ? 3 : 1;
        ctx.beginPath();
        const n = b.container ? 8 : 10;
        for (let i = 1; i < n; i++) {
          if (rw > rh || b.sawtooth) { const x = rx0 + (rw * i) / n; ctx.moveTo(x, ry0 + 2); ctx.lineTo(x, ry1 - 2); }
          else { const y = ry0 + (rh * i) / n; ctx.moveTo(rx0 + 2, y); ctx.lineTo(rx1 - 2, y); }
        }
        ctx.stroke();
      }
      if (b.rooftop && rw > 20) {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(rx0 + rw * 0.12, ry0 + rh * 0.2, rw * 0.12, rh * 0.18);
        ctx.fillRect(rx0 + rw * 0.7, ry0 + rh * 0.55, rw * 0.1, rh * 0.18);
        ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(rx0 + rw * 0.4, ry0 + rh * 0.5, Math.min(rw, rh) * 0.12, 0, Math.PI * 2); ctx.fill();
      } else if (V.rich && tall && !b.sign && !b.helipad && !b.vents && !b.neon && b.w > 56 && b.d > 56) this.roofKit(ctx, b, rx0, ry0, rw, rh, u, V);
      if (b.skylight) { ctx.fillStyle = 'rgba(160,210,240,.6)'; ctx.fillRect(rx0 + rw * 0.2, ry0 + rh * 0.35, rw * 0.6, rh * 0.3); }
      if (b.helipad) {
        const r = Math.min(rw, rh) * 0.3;
        ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(rx0 + rw / 2, ry0 + rh / 2, r * 1.15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#f2d23a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rx0 + rw / 2, ry0 + rh / 2, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f2f2f2'; ctx.font = `900 ${r * 1.1}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('H', rx0 + rw / 2, ry0 + rh / 2 + 1);
        V.lights.push({ t: 'blink', x: rx0 + rw / 2 - r * 1.15, y: ry0 + rh / 2, c: '#40ff70' });
      }
      if (b.vents) {
        ctx.fillStyle = '#39ff6a';
        for (let i = 0; i < 3; i++) ctx.fillRect(rx0 + rw * (0.2 + i * 0.25), ry0 + rh * 0.4, rw * 0.08, rh * 0.2);
      }
      if (b.antenna) V.lights.push({ t: 'blink', x: rx0 + rw / 2, y: ry0 + rh / 2, c: '#ff3030' });
      if (b.awning) {
        // striped shop awning, the comic-strip way
        const t = 6 * u;
        const r = b.face === 'n' ? [rx0, ry0, rw, t] : b.face === 's' ? [rx0, ry1 - t, rw, t] : b.face === 'e' ? [rx1 - t, ry0, t, rh] : [rx0, ry0, t, rh];
        ctx.fillStyle = b.awning; ctx.fillRect(r[0], r[1], r[2], r[3]);
        if (V.rich) {
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          const horiz = b.face === 'n' || b.face === 's', n = Math.max(2, Math.floor((horiz ? r[2] : r[3]) / (5 * u + 1)));
          for (let i = 0; i < n; i += 2) {
            if (horiz) ctx.fillRect(r[0] + (r[2] * i) / n, r[1], r[2] / n, r[3]); else ctx.fillRect(r[0], r[1] + (r[3] * i) / n, r[2], r[3] / n);
          }
        }
      }
      if (b.sign && rw > 40) {
        const fs = Math.min(rh * 0.3, rw / b.sign.length * 1.4);
        ctx.font = `900 ${fs}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, fs * 0.16); ctx.strokeStyle = '#0c0c16'; ctx.lineJoin = 'round';
        ctx.strokeText(b.sign, rx0 + rw / 2, ry0 + rh / 2);
        ctx.fillStyle = '#fff6d8'; ctx.fillText(b.sign, rx0 + rw / 2, ry0 + rh / 2);
      }
    }
    // Ink: comic outlines on the roof and the wall silhouette (thin for the small stuff).
    if (V.rich || tall) {
      ctx.strokeStyle = '#0b0b16'; ctx.lineWidth = small ? Math.max(0.6, 0.8 * k) : Math.max(1, 1.5 * k);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.rect(rx0, ry0, rw, rh);
      for (const w of walls) { if (!small) band(w, 1, s); }
      ctx.stroke();
    }
    if (b.neon) V.lights.push({ t: 'neon', x: rx0, y: ry0, w: rw, h: rh, c: b.neon, c2: b.neon2, seed: b.x });
  }

  /**
   * Rooftop clutter for towers and blocks: AC units, a stair bulkhead, a water tower on older
   * buildings or a mechanical penthouse on glass ones. Each piece casts a little shadow down-right
   * (same sun as everything else) so the roofs read as surfaces with things standing on them.
   */
  roofKit(ctx, b, x, y, w, h, u, V) {
    const seed = hash2(b.x | 0, b.y | 0, 17), sh = 'rgba(0,0,12,.35)', ink = '#0b0b16';
    const box = (fx, fy, bw, bd, lift, col) => {
      const px = x + w * fx, py = y + h * fy, pw = bw * u, pd = bd * u, o = lift * u;
      ctx.fillStyle = sh; ctx.fillRect(px + o * SUN.x * 2.2, py + o * SUN.y * 2.2, pw, pd);
      ctx.fillStyle = col; ctx.fillRect(px, py, pw, pd);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px, py, pw, Math.max(1, pd * 0.22));
      ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, pd);
    };
    if (b.glass) {
      box(0.3, 0.3, b.w * 0.4, b.d * 0.34, 10, shade(b.col, -0.28));
      box(0.4, 0.38, 7, 7, 5, '#9aa3ad');
      V.lights.push({ t: 'blink', x: x + w * 0.5, y: y + h * 0.47, c: '#ff3030' });
    } else {
      // AC units in a row along one side (placement varies per building so roofs don't repeat)
      const along = seed > 0.5, n = 2 + ((seed * 7) | 0) % 3;
      for (let i = 0; i < n; i++) box(along ? 0.1 + i * 0.16 : 0.74, along ? 0.74 : 0.1 + i * 0.16, 9, 7, 5, i % 2 ? '#aab0b8' : '#c3c8cf');
      if (seed > 0.35) box(0.14, 0.18, 14, 11, 9, shade(b.col, -0.2)); // stair bulkhead
      if (seed > 0.5 && b.h < 180) {
        // water tower: round wooden tank on legs
        const r = 7.5 * u, px = x + w * 0.66, py = y + h * 0.64;
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(px + 26 * u * SUN.x, py + 26 * u * SUN.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a5236'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#5a3a26'; ctx.beginPath(); ctx.arc(px + r * 0.15, py + r * 0.15, r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,180,.35)'; ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
      } else box(0.62, 0.6, 9, 9, 5, '#c3c7cc');
    }
  }

  drawLights(ctx, V) {
    const n = V.night;
    const L = V.lights;
    if (n > 0.2) {
      // lit window rows: mostly warm tungsten, glass towers cooler office light
      ctx.lineWidth = Math.max(1.5, 2.4 * V.k);
      ctx.setLineDash([3, 4]);
      for (const cool of [false, true]) {
        ctx.strokeStyle = cool ? `rgba(170,215,255,${0.8 * n})` : `rgba(255,212,120,${0.85 * n})`;
        ctx.beginPath();
        for (const l of L) if (l.t === 'win' && !!l.cool === cool) { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L) {
      if (l.t === 'glow') {
        if (n < 0.2) continue;
        ctx.globalAlpha = (l.a ?? 0.6) * n;
        ctx.drawImage(glow(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      } else if (l.t === 'beam') {
        if (n < 0.2) continue;
        ctx.globalAlpha = 0.45 * n;
        ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a);
        ctx.drawImage(headlight(), 0, -l.r * 0.3, l.r, l.r * 0.6);
        ctx.restore();
      } else if (l.t === 'neon') {
        const flick = Math.sin(V.t * 7 + l.seed) > -0.9 ? 1 : 0.3;
        ctx.globalAlpha = (0.35 + 0.65 * n) * flick;
        ctx.strokeStyle = l.c; ctx.lineWidth = 6; ctx.globalAlpha *= 0.35;
        ctx.strokeRect(l.x, l.y, l.w, l.h);
        ctx.globalAlpha = (0.35 + 0.65 * n) * flick;
        ctx.lineWidth = 2; ctx.strokeRect(l.x + 1, l.y + 1, l.w - 2, l.h - 2);
        if (l.c2) { ctx.strokeStyle = l.c2; ctx.strokeRect(l.x + 6, l.y + 6, l.w - 12, l.h - 12); }
      } else if (l.t === 'ring') {
        ctx.globalAlpha = 0.4 + 0.6 * n;
        ctx.strokeStyle = l.c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.stroke();
      } else if (l.t === 'blink') {
        if (Math.sin(V.t * 4 + l.x * 0.01) < 0) continue;
        ctx.globalAlpha = 1;
        ctx.drawImage(glow(l.c), l.x - 12, l.y - 12, 24, 24);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export { ALT };
