// Flying patrol over the procedural city, drawn in 2.5D: every point is projected with a
// straight-down perspective camera, so rooftops grow and lean away from screen centre.
import { BLOCK, ROAD, LOT } from './city.js';
import { DISTRICTS, STREET_CRIMES, CASES, VENUES, THEMES, BOSSES, HERO } from './data.js';
import { drawHeroTop, glow } from './art.js';
import { clamp, lerp, pick, chance, rand, dist, shade, rgba, easeOut, easeInOut, fmtClock, fmtTime, wobble, $ } from './util.js';
import { heroReady, HeroSprite } from './hero3d.js';
import { loadClub } from './clubzone.js';
import { toast, banner, flash, openModal, closeModal } from './ui.js';
import { hash2 } from './rng.js';
import { sfx } from './sfx.js';

const CAMH = 1100;   // camera height above ground (world units)
const ALT = 360;     // cruising altitude
const DIVE_T = 1.1;
const NEAR_R = 130;
const TARGET = { street: 5, case: 2, special: 2 };

export class Overworld {
  constructor(g) {
    this.g = g;
    this.zones = [];
    this.parts = [];
    this.hero = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, z: ALT, bank: 0 };
    this.cam = { x: 0, y: 0 };
    this.zoom = 1;
    this.k = 1;
    this.t = 0;
    this.uid = 1;
    this.spawnT = 0;
    this.smokeT = 0;
    this.attract = false;
    this.district = null;
  }

  reset() {
    const c = this.g.city;
    const s = c.seeds.find((s) => s.type === 'downtown') || { x: c.landCols / 2, y: c.rows / 2 };
    this.hero.x = Math.round(s.x) * BLOCK + ROAD / 2;
    this.hero.y = Math.round(s.y) * BLOCK + ROAD / 2;
    this.hero.vx = this.hero.vy = 0;
    this.hero.z = ALT;
    this.cam.x = this.hero.x; this.cam.y = this.hero.y;
    this.zones = [];
    this.parts = [];
    this.district = null;
    for (let i = 0; i < 12; i++) this.maintainZones(true);
  }

  enter(p = {}) {
    const inp = this.g.input;
    inp.setStick(true);
    inp.setButtons([
      { id: 'dive', label: 'DIVE', key: 'Space', cls: 'big' },
      { id: 'boost', label: 'BOOST', key: 'Shift' },
      { id: 'map', label: 'MAP', key: 'M', slot: 2 },
    ]);
    this.diving = null;
    this.rising = null;
    if (p.returnFrom) { this.rising = 0; this.zoom = 2.4; this.hero.z = 40; }
    $('hud-extra').innerHTML = '';
    $('objectives').classList.remove('on');
  }

  exit() { $('prompt').classList.remove('on'); }

  // ------------------------------------------------------------------ zones
  maintainZones(initial = false) {
    const counts = { street: 0, case: 0, special: 0 };
    for (const z of this.zones) counts[z.kind]++;
    // Always keep one club raid (premade 3D club) somewhere on the map.
    const clubs = Object.keys(VENUES).filter((v) => VENUES[v].club);
    if (clubs.length && !this.zones.some((z) => VENUES[z.venue]?.club)) { this.spawn('special', initial, pick(clubs)); return; }
    for (const k of ['street', 'case', 'special']) {
      if (counts[k] < TARGET[k]) { this.spawn(k, initial); return; }
    }
  }

  spawn(kind, initial, forceVenue) {
    const city = this.g.city, h = this.hero;
    let def, districts, venueName;
    if (kind === 'street') { def = pick(STREET_CRIMES); districts = def.districts; }
    else if (kind === 'case') { def = pick(CASES); districts = def.districts; }
    else { venueName = forceVenue || pick(Object.keys(VENUES)); def = VENUES[venueName]; districts = def.districts; }
    const cands = city.blocks.filter((b) => {
      if (districts !== '*' && !districts.includes(b.d)) return false;
      const cx = b.x0 + LOT / 2, cy = b.y0 + LOT / 2;
      return dist(cx, cy, h.x, h.y) > (initial ? 250 : 500) && this.zones.every((z) => dist(z.x, z.y, cx, cy) > 520);
    });
    if (!cands.length) return;
    const b = pick(cands);
    const z = { uid: this.uid++, kind, district: b.d, t: 0, x: b.x0 + LOT / 2, y: b.y0 + LOT / 2 };
    if (kind === 'street') {
      if (!def.variant) { z.x = b.x0 - ROAD / 2; z.y = b.y0 + LOT * rand(0.25, 0.75); }
      Object.assign(z, {
        mode: 'brawl', def, name: def.name, reward: def.reward, diff: def.diff, boss: def.boss || null, variant: def.variant,
        lockKey: 'Street Crime', ttl: rand(120, 180), color: def.variant === 'fire' ? '#ff7a1a' : def.boss ? '#ff3030' : '#ffd23f',
        glyph: def.variant === 'fire' ? 'F' : '!', risk: def.diff >= 3 ? 'Medium' : 'Low', blurb: def.blurb,
      });
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
    if (!initial && !this.attract && kind !== 'street') toast(`New ${kind === 'case' ? 'investigation' : 'special zone'}: ${z.name} (${DISTRICTS[z.district].name})`, 'info');
  }

  removeZone(z) { this.zones = this.zones.filter((q) => q !== z); }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.t += dt;
    const g = this.g, h = this.hero, st = g.state, inp = g.input, city = g.city;
    city.updateTraffic(dt);
    this.updateParticles(dt);

    if (this.diving) {
      const d = this.diving;
      d.t += dt;
      const e = easeInOut(Math.min(1, d.t / DIVE_T));
      h.x = lerp(d.sx, d.z.x, e); h.y = lerp(d.sy, d.z.y, e);
      h.z = lerp(ALT, 30, e);
      this.zoom = lerp(1, 2.4, e);
      this.cam.x = h.x; this.cam.y = h.y;
      if (d.t >= DIVE_T && !d.fired) { d.fired = true; flash(); g.startZone(d.z); }
      return;
    }
    if (this.rising !== null) {
      this.rising += dt;
      const e = easeOut(Math.min(1, this.rising / 1.1));
      h.z = lerp(40, ALT, e);
      this.zoom = lerp(2.4, 1, e);
      if (this.rising >= 1.1) this.rising = null;
    }

    // --- flight
    let a;
    if (this.attract) {
      const cx = city.landCols * BLOCK / 2, cy = city.rows * BLOCK / 2, R = 1500;
      const tx = cx + Math.cos(this.t * 0.12) * R, ty = cy + Math.sin(this.t * 0.12) * R;
      const m = Math.hypot(tx - h.x, ty - h.y) || 1;
      a = { x: (tx - h.x) / m, y: (ty - h.y) / m };
    } else a = wobble(inp.axis(), st ? st.intox : 0, this.t);
    const boost = !this.attract && inp.down('boost');
    const max = boost ? 1100 : 560;
    const acc = Math.min(1, dt * 3);
    h.vx += (a.x * max - h.vx) * acc;
    h.vy += (a.y * max - h.vy) * acc;
    h.x = clamp(h.x + h.vx * dt, 0, city.W);
    h.y = clamp(h.y + h.vy * dt, 0, city.H);
    const spd = Math.hypot(h.vx, h.vy);
    if (spd > 25) {
      const target = Math.atan2(h.vy, h.vx);
      let da = target - h.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      h.ang += da * Math.min(1, dt * 6);
      h.bank = lerp(h.bank, clamp(da, -1, 1), Math.min(1, dt * 5));
    }
    this.cam.x += (h.x + h.vx * 0.3 - this.cam.x) * Math.min(1, dt * 4);
    this.cam.y += (h.y + h.vy * 0.3 - this.cam.y) * Math.min(1, dt * 4);
    if (boost && spd > 700 && chance(dt * 30)) this.parts.push({ x: h.x - h.vx * 0.05, y: h.y - h.vy * 0.05, z: h.z, vx: 0, vy: 0, vz: 0, life: 0.4, max: 0.4, size: 5, col: '#bfe8ff', glow: true });

    // --- district tracking (drives tabloid heat)
    const d = city.districtAt(h.x, h.y);
    if (d !== this.district) {
      this.district = d;
      const D = DISTRICTS[d];
      if (D && !this.attract) {
        if (D.vice) toast('📸 Tabloid photographers lurk in this district', 'bad');
        this.g.commentary.onDistrict(d); // "MEANWHILE, IN THE DOCKS…" caption with the crime report
      }
    }
    const D = DISTRICTS[d];
    g.vice = { active: !!(D && D.vice), where: D && D.name, rate: 1.1 };

    // --- zones
    if (!this.attract) {
      for (const z of this.zones) {
        z.t += dt;
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

  updateParticles(dt) {
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (!p.glow) p.size += dt * 5;
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  tryDive() {
    const z = this.near, st = this.g.state;
    if (!z) { toast('Fly over a crime marker to dive in', 'info'); return; }
    const lock = st.locked(z.lockKey);
    if (lock) { toast(`You promised to stay out of ${z.lockKey} zones for ${fmtTime(lock)}`, 'bad'); sfx.lose(); return; }
    this.diving = { z, t: 0, sx: this.hero.x, sy: this.hero.y };
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
    $('hud-sub').textContent = `${fmtClock(st.clock)} · ${this.zones.length} incidents${D && D.vice ? ' · ⚠ vice district' : ''}`;
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
    const kinds = `<span><i style="background:#ffd23f"></i>Street crime</span><span><i style="background:#ff7a1a"></i>Fire</span><span><i style="background:#3fd0ff"></i>Investigation</span><span><i style="background:#ff3fb8"></i>Special zone</span><span><i style="background:#ff3030"></i>Boss</span>`;
    const el = openModal(`<h2>City Map</h2><div class="mapwrap"></div><div class="legend">${kinds}</div><div class="legend">${legend}</div><div class="opts" style="margin-top:12px"><button class="opt"><span class="k">M</span><span class="l">Close map</span></button></div>`);
    el.querySelector('.mapwrap').appendChild(c);
    const close = () => { removeEventListener('keydown', onKey, true); closeModal(el); };
    const onKey = (e) => { if (['KeyM', 'Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(); } };
    addEventListener('keydown', onKey, true);
    el.querySelector('.opt').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
  }

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h, city = g.city, st = g.state;
    const night = st ? st.night : 0.8;
    const k = (Math.min(W, H) / 760) * this.zoom;
    this.k = k;
    const cx = W / 2, cy = H / 2, camX = this.cam.x, camY = this.cam.y;
    const P = (z) => CAMH / (CAMH - z);
    const SX = (x, z = 0) => cx + (x - camX) * k * P(z);
    const SY = (y, z = 0) => cy + (y - camY) * k * P(z);
    const V = { cx, cy, k, P, SX, SY, night, lights: [], t: this.t };

    ctx.save();
    if (st && st.intox > 30) {
      const a = Math.sin(this.t * 1.1) * (st.intox - 30) * 0.0009;
      ctx.translate(cx, cy); ctx.rotate(a); ctx.scale(1 + (st.intox - 30) * 0.0008, 1 + (st.intox - 30) * 0.0008); ctx.translate(-cx, -cy);
    }
    // outskirts + roads
    ctx.fillStyle = '#26402a'; ctx.fillRect(-60, -60, W + 120, H + 120);
    const land = { x0: SX(0), y0: SY(0), x1: SX(city.coastX), y1: SY(city.H) };
    ctx.fillStyle = '#2d3038'; ctx.fillRect(land.x0, land.y0, land.x1 - land.x0, land.y1 - land.y0);

    const hw = W / 2 / k + 280, hh = H / 2 / k + 280;
    // ocean
    if (camX + hw > city.coastX) {
      const sx = SX(city.coastX);
      ctx.fillStyle = '#1d4f78'; ctx.fillRect(sx, -60, W - sx + 60, H + 120);
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
    const L = LOT * k;
    const blds = [];
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const b = city.block(bx, by);
        const D = DISTRICTS[b.d];
        const x = SX(b.x0), y = SY(b.y0);
        const farm = b.d === 'farm';
        ctx.fillStyle = farm ? '#6f8a42' : b.d === 'suburb' ? '#9a9a90' : '#8d8b86';
        ctx.fillRect(x, y, L, L);
        ctx.fillStyle = D.lot;
        ctx.fillRect(x + 5 * k, y + 5 * k, L - 10 * k, L - 10 * k);
        for (const f of b.flats) this.drawFlat(ctx, f, V);
        for (const o of b.b) blds.push(o);
      }
    }
    // lane markings
    ctx.strokeStyle = 'rgba(230,200,90,.55)'; ctx.lineWidth = Math.max(1, 1.5 * k);
    ctx.setLineDash([12 * k, 12 * k]);
    ctx.beginPath();
    for (let i = bx0; i <= bx1 + 1; i++) { const x = SX(i * BLOCK + ROAD / 2); ctx.moveTo(x, SY(by0 * BLOCK)); ctx.lineTo(x, SY((by1 + 1) * BLOCK + ROAD)); }
    for (let j = by0; j <= by1 + 1; j++) { const y = SY(j * BLOCK + ROAD / 2); ctx.moveTo(SX(bx0 * BLOCK), y); ctx.lineTo(SX(Math.min(city.landCols, bx1 + 1) * BLOCK + ROAD), y); }
    ctx.stroke();
    ctx.setLineDash([]);

    // water objects
    for (const o of city.water) {
      if (Math.abs(o.x - camX) > hw + 200 || Math.abs(o.y - camY) > hh) continue;
      if (o.t === 'pier') { ctx.fillStyle = '#6b5a45'; ctx.fillRect(SX(o.x), SY(o.y), o.w * k, o.h * k); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.strokeRect(SX(o.x), SY(o.y), o.w * k, o.h * k); }
      else { blds.push({ kind: 'box', x: o.x, y: o.y, w: o.w, d: o.h, h: 16, col: o.col, ship: true }); blds.push({ kind: 'box', x: o.x + o.w - 44, y: o.y + 6, w: 30, d: o.h - 12, h: 34, col: '#e8e8e8' }); }
    }

    // traffic
    for (const c of city.cars) {
      if (Math.abs(c.x - camX) > hw || Math.abs(c.y - camY) > hh) continue;
      const horiz = c.dir === 0 || c.dir === 2;
      const ox = c.dir === 1 ? -9 : c.dir === 3 ? 9 : 0, oy = c.dir === 0 ? 9 : c.dir === 2 ? -9 : 0;
      const w = horiz ? 22 : 11, d = horiz ? 11 : 22;
      const x = c.x + ox - w / 2, y = c.y + oy - d / 2;
      ctx.fillStyle = c.col; ctx.fillRect(SX(x), SY(y), w * k, d * k);
      ctx.fillStyle = 'rgba(20,30,50,.75)';
      ctx.fillRect(SX(x + (horiz ? 6 : 2)), SY(y + (horiz ? 2 : 6)), (horiz ? 9 : 7) * k, (horiz ? 7 : 9) * k);
      if (night > 0.3) {
        const fx = c.x + ox + [11, 0, -11, 0][c.dir], fy = c.y + oy + [0, 11, 0, -11][c.dir];
        V.lights.push({ t: 'glow', x: SX(fx), y: SY(fy), r: 16 * k, c: '#fff4c0' });
      }
    }

    // zone ground rings
    for (const z of this.zones) {
      if (Math.abs(z.x - camX) > hw || Math.abs(z.y - camY) > hh) continue;
      const pulse = (this.t * 1.2) % 1;
      ctx.strokeStyle = rgba(z.color, 0.9 * (1 - pulse)); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(SX(z.x), SY(z.y), (30 + pulse * 70) * k, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(z.color, 0.18);
      ctx.beginPath(); ctx.arc(SX(z.x), SY(z.y), 34 * k, 0, Math.PI * 2); ctx.fill();
    }

    // hero shadow (sun from the north-west)
    const h = this.hero;
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(SX(h.x + h.z * 0.12), SY(h.y + h.z * 0.2), 20 * k, 9 * k, h.ang, 0, Math.PI * 2); ctx.fill();

    // buildings, far from screen centre first so near ones overlap correctly
    for (const b of blds) {
      const bx = b.kind === 'crane' ? b.x : b.x + (b.w || 0) / 2, by = b.kind === 'crane' ? (b.y + b.y2) / 2 : b.y + (b.d || 0) / 2;
      b._d = (bx - camX) * (bx - camX) + (by - camY) * (by - camY);
    }
    blds.sort((a, b) => b._d - a._d);
    for (const b of blds) this.drawBuilding(ctx, b, V);

    // smoke (under the night overlay)
    for (const p of this.parts) {
      if (p.glow) continue;
      ctx.fillStyle = rgba(p.col, 0.45 * (p.life / p.max));
      ctx.beginPath(); ctx.arc(SX(p.x, p.z), SY(p.y, p.z), p.size * k * P(p.z), 0, Math.PI * 2); ctx.fill();
    }

    // night
    if (night > 0) {
      ctx.fillStyle = `rgba(6,10,32,${0.6 * night})`;
      ctx.fillRect(-60, -60, W + 120, H + 120);
      // street lamps at intersections
      for (let i = bx0; i <= bx1 + 1; i++) for (let j = by0; j <= by1 + 1; j++) {
        V.lights.push({ t: 'glow', x: SX(i * BLOCK + ROAD / 2), y: SY(j * BLOCK + ROAD / 2), r: 60 * k, c: '#ffcf7a', a: 0.35 });
      }
    }
    this.drawLights(ctx, V);

    for (const p of this.parts) {
      if (!p.glow) continue;
      ctx.globalAlpha = p.life / p.max;
      const r = p.size * k * P(p.z) * 3;
      ctx.drawImage(glow(p.col), SX(p.x, p.z) - r, SY(p.y, p.z) - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    // zone beacons
    for (const z of this.zones) {
      if (Math.abs(z.x - camX) > hw || Math.abs(z.y - camY) > hh) continue;
      const top = 230 + Math.sin(this.t * 3 + z.uid) * 10;
      const gx = SX(z.x), gy = SY(z.y), tx = SX(z.x, top), ty = SY(z.y, top);
      const grd = ctx.createLinearGradient(gx, gy, tx, ty);
      grd.addColorStop(0, rgba(z.color, 0.55)); grd.addColorStop(1, rgba(z.color, 0));
      ctx.strokeStyle = grd; ctx.lineWidth = 10 * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(tx, ty); ctx.stroke();
      const locked = st && st.locked(z.lockKey);
      this.drawIcon(ctx, tx, ty, 15 * k * P(top), z, locked, z === this.near);
    }

    // heroine
    const hs = k * P(h.z) * 1.3;
    const hx = SX(h.x, h.z), hy = SY(h.y, h.z) + Math.sin(this.t * 2.2) * 2 * k;
    this.heroScreen = { x: hx, y: hy };
    if (Math.hypot(h.vx, h.vy) > 700) {
      ctx.strokeStyle = 'rgba(190,230,255,.35)'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        const ox = Math.cos(h.ang + Math.PI / 2) * i * 10 * hs, oy = Math.sin(h.ang + Math.PI / 2) * i * 10 * hs;
        ctx.beginPath(); ctx.moveTo(hx + ox - Math.cos(h.ang) * 40 * hs, hy + oy - Math.sin(h.ang) * 40 * hs);
        ctx.lineTo(hx + ox - Math.cos(h.ang) * 90 * hs, hy + oy - Math.sin(h.ang) * 90 * hs); ctx.stroke();
      }
    }
    if (heroReady()) {
      // Real rigged model rendered top-down with the Flying clip; heading is +x on the sprite.
      if (!this.sprite) this.sprite = new HeroSprite(192, 192);
      const sp = this.sprite;
      sp.hero.pose(this.diving ? 'jump' : 'fly', this.diving ? 0.9 : this.t);
      if (!this.diving) sp.hero.superFly();
      // Airspeed drives the cape: it streams behind her (-z) and lifts a little off her back (+y).
      // Airflow over her back holds the cape up against gravity (y ≈ 10) and streams it to her feet.
      const air = 8 + Math.hypot(h.vx, h.vy) / 60;
      sp.hero.setWind(Math.sin(this.t * 2.3) * 1.8, 10.5, -air);
      const img = sp.render({ view: 'top', yaw: 0, span: 2.6 });
      const size = 2.6 * 40 * hs; // 1 sprite metre ≈ 40 art units
      ctx.save();
      ctx.translate(hx, hy); ctx.rotate(h.ang);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else drawHeroTop(ctx, hx, hy, hs, h.ang, this.t, h.bank);

    // off-screen zone arrows
    if (!this.attract && !this.diving) this.drawArrows(ctx, V);
    ctx.restore();

    if (this.diving) {
      const e = Math.min(1, this.diving.t / DIVE_T);
      const grd = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.2 * (1 - e * 0.6), cx, cy, Math.max(W, H) * 0.7);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, `rgba(255,255,255,${e * 0.8})`);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }
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
    for (const z of this.zones) {
      const sx = V.SX(z.x), sy = V.SY(z.y);
      if (sx > m && sx < W - m && sy > m + 50 && sy < H - m) continue;
      const a = Math.atan2(sy - V.cy, sx - V.cx);
      const tx = Math.cos(a), ty = Math.sin(a);
      const s = Math.min((W / 2 - m) / Math.abs(tx || 1e-6), (H / 2 - m - 20) / Math.abs(ty || 1e-6));
      const ax = V.cx + tx * s, ay = V.cy + ty * s;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = z.color; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, -9); ctx.lineTo(-4, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(z.x, z.y, this.hero.x, this.hero.y) / 10)}m`, ax - tx * 18, ay - ty * 18 + 3);
    }
  }

  drawFlat(ctx, f, V) {
    const { SX, SY, k } = V;
    const x = SX(f.x), y = SY(f.y);
    switch (f.t) {
      case 'rect': case 'path': ctx.fillStyle = f.c; ctx.fillRect(x, y, f.w * k, f.h * k); break;
      case 'lot':
        ctx.fillStyle = '#4a4a4c'; ctx.fillRect(x, y, f.w * k, f.h * k);
        ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 6; i++) { const xx = x + (f.w * k * i) / 6; ctx.moveTo(xx, y + 3); ctx.lineTo(xx, y + f.h * k * 0.4); ctx.moveTo(xx, y + f.h * k * 0.6); ctx.lineTo(xx, y + f.h * k - 3); }
        ctx.stroke();
        break;
      case 'field': {
        ctx.fillStyle = f.c1; ctx.fillRect(x, y, f.w * k, f.h * k);
        ctx.fillStyle = f.c2;
        const n = 12;
        for (let i = 0; i < n; i += 2) {
          if (f.vert) ctx.fillRect(x + (f.w * k * i) / n, y, (f.w * k) / n, f.h * k);
          else ctx.fillRect(x, y + (f.h * k * i) / n, f.w * k, (f.h * k) / n);
        }
        break;
      }
      case 'pool': ctx.fillStyle = '#4ac8e8'; ctx.fillRect(x, y, f.w * k, f.h * k); ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2; ctx.strokeRect(x, y, f.w * k, f.h * k); break;
      case 'fountain':
        ctx.fillStyle = '#c8c0b0'; ctx.beginPath(); ctx.arc(x, y, f.r * k, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5ab8e0'; ctx.beginPath(); ctx.arc(x, y, f.r * k * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x, y, f.r * k * (0.2 + 0.1 * Math.sin(V.t * 6)), 0, Math.PI * 2); ctx.fill();
        break;
      case 'hazard':
        ctx.strokeStyle = 'rgba(230,200,40,.5)'; ctx.lineWidth = 3 * k; ctx.setLineDash([8 * k, 8 * k]);
        ctx.strokeRect(x, y, f.w * k, f.h * k); ctx.setLineDash([]);
        break;
    }
  }

  drawBuilding(ctx, b, V) {
    const { cx, cy, k, P, SX, SY, night } = V;
    if (b.kind === 'tree') {
      const s = P(b.h), gx = SX(b.x), gy = SY(b.y);
      const x = cx + (gx - cx) * s, y = cy + (gy - cy) * s, r = b.rad * k * s;
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(gx + 4 * k, gy + 6 * k, b.rad * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(b.col, -0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
    const base = b.col;
    const quad = (x1, y1, x2, y2, x3, y3, x4, y4, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill(); };
    const walls = [];
    if (gy1 < cy) { quad(gx0, gy1, gx1, gy1, rx1, ry1, rx0, ry1, shade(base, -0.16)); walls.push('s'); }
    if (gy0 > cy) { quad(gx0, gy0, gx1, gy0, rx1, ry0, rx0, ry0, shade(base, -0.34)); walls.push('n'); }
    if (gx1 < cx) { quad(gx1, gy0, gx1, gy1, rx1, ry1, rx1, ry0, shade(base, -0.24)); walls.push('e'); }
    if (gx0 > cx) { quad(gx0, gy0, gx0, gy1, rx0, ry1, rx0, ry0, shade(base, -0.42)); walls.push('w'); }

    // floor lines by day / lit window rows by night
    if (b.h >= 36 && !b.container && !b.house && !b.ship) {
      const floors = Math.min(16, Math.floor(b.h / 13));
      const seed = hash2(b.x | 0, b.y | 0);
      ctx.strokeStyle = b.glass ? 'rgba(220,240,255,.22)' : 'rgba(0,0,0,.2)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let f = 1; f < floors; f++) {
        const p = P((f * b.h) / floors);
        for (const w of walls) {
          let x1, y1, x2, y2;
          if (w === 's') { x1 = cx + (gx0 - cx) * p; x2 = cx + (gx1 - cx) * p; y1 = y2 = cy + (gy1 - cy) * p; }
          else if (w === 'n') { x1 = cx + (gx0 - cx) * p; x2 = cx + (gx1 - cx) * p; y1 = y2 = cy + (gy0 - cy) * p; }
          else if (w === 'e') { x1 = x2 = cx + (gx1 - cx) * p; y1 = cy + (gy0 - cy) * p; y2 = cy + (gy1 - cy) * p; }
          else { x1 = x2 = cx + (gx0 - cx) * p; y1 = cy + (gy0 - cy) * p; y2 = cy + (gy1 - cy) * p; }
          ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          if (night > 0.2 && hash2(f, walls.length, (seed * 1e6) | 0) > 0.35) V.lights.push({ t: 'win', x1, y1, x2, y2 });
        }
      }
      ctx.stroke();
    }

    // roof
    const rw = rx1 - rx0, rh = ry1 - ry0;
    if (b.house || b.barn) {
      ctx.fillStyle = b.roofCol; ctx.fillRect(rx0, ry0, rw, rh);
      ctx.fillStyle = shade(b.roofCol, -0.25);
      if (rw > rh) ctx.fillRect(rx0, ry0 + rh / 2, rw, rh / 2); else ctx.fillRect(rx0 + rw / 2, ry0, rw / 2, rh);
      if (b.barn) { ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5; ctx.strokeRect(rx0 + 2, ry0 + 2, rw - 4, rh - 4); }
    } else {
      ctx.fillStyle = b.gold ? '#d8b24a' : b.ship ? shade(base, 0.1) : shade(base, 0.1);
      ctx.fillRect(rx0, ry0, rw, rh);
      ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.5; ctx.strokeRect(rx0 + 1, ry0 + 1, rw - 2, rh - 2);
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
      }
      if (b.skylight) { ctx.fillStyle = 'rgba(160,210,240,.6)'; ctx.fillRect(rx0 + rw * 0.2, ry0 + rh * 0.35, rw * 0.6, rh * 0.3); }
      if (b.helipad) {
        const r = Math.min(rw, rh) * 0.3;
        ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rx0 + rw / 2, ry0 + rh / 2, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f2f2f2'; ctx.font = `900 ${r * 1.1}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('H', rx0 + rw / 2, ry0 + rh / 2 + 1);
      }
      if (b.vents) {
        ctx.fillStyle = '#39ff6a';
        for (let i = 0; i < 3; i++) ctx.fillRect(rx0 + rw * (0.2 + i * 0.25), ry0 + rh * 0.4, rw * 0.08, rh * 0.2);
      }
      if (b.antenna) V.lights.push({ t: 'blink', x: rx0 + rw / 2, y: ry0 + rh / 2, c: '#ff3030' });
      if (b.awning) {
        ctx.fillStyle = b.awning;
        const t = 5 * k * s;
        if (b.face === 'n') ctx.fillRect(rx0, ry0, rw, t); else if (b.face === 's') ctx.fillRect(rx0, ry1 - t, rw, t);
        else if (b.face === 'e') ctx.fillRect(rx1 - t, ry0, t, rh); else ctx.fillRect(rx0, ry0, t, rh);
      }
      if (b.sign && rw > 40) {
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `900 ${Math.min(rh * 0.3, rw / b.sign.length * 1.4)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.sign, rx0 + rw / 2, ry0 + rh / 2);
      }
    }
    if (b.neon) V.lights.push({ t: 'neon', x: rx0, y: ry0, w: rw, h: rh, c: b.neon, c2: b.neon2, seed: b.x });
  }

  drawLights(ctx, V) {
    const n = V.night;
    const L = V.lights;
    if (n > 0.2) {
      ctx.strokeStyle = `rgba(255,214,130,${0.75 * n})`; ctx.lineWidth = Math.max(1.5, 2.2 * V.k);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (const l of L) if (l.t === 'win') { ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const l of L) {
      if (l.t === 'glow') {
        if (n < 0.2) continue;
        ctx.globalAlpha = (l.a ?? 0.6) * n;
        ctx.drawImage(glow(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
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
        if (Math.sin(V.t * 4) < 0) continue;
        ctx.globalAlpha = 1;
        ctx.drawImage(glow(l.c), l.x - 12, l.y - 12, 24, 24);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export { ALT };
