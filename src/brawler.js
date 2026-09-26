// Side-scrolling beat 'em up for regular activity zones.
// Coordinates: x = world units along the street, z = depth 0 (sidewalk) .. 1 (front), y = height.
import { DISTRICTS, SIGN_WORDS, HERO } from './data.js';
import { drawHumanoid, pose, npcLook, HERO_LOOK, glow } from './art.js';
import { clamp, lerp, pick, rand, chance, shade, rgba, $ } from './util.js';
import { RNG } from './rng.js';
import { sfx } from './sfx.js';
import { banner, toast } from './ui.js';
import { heroReady, HeroSprite } from './hero3d.js';

const EN = {
  thug:     { hp: 30, spd: 120, dmg: 7, reach: 70 },
  knife:    { hp: 24, spd: 165, dmg: 9, reach: 64 },
  brute:    { hp: 75, spd: 85, dmg: 14, reach: 86 },
  gunman:   { hp: 26, spd: 110, dmg: 12, reach: 60, ranged: true },
  arsonist: { hp: 26, spd: 125, dmg: 8, reach: 66 },
  boss:     { hp: 260, spd: 115, dmg: 16, reach: 96, boss: true },
};
const DZ = 0.11;  // depth tolerance for hits

export class Brawler {
  constructor(g) { this.g = g; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone;
    this.D = DISTRICTS[zone.district];
    this.fire = zone.variant === 'fire';
    this.done = false;
    this.t = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.fx = [];
    this.bullets = [];
    this.enemies = [];
    this.captives = [];
    this.fires = [];
    this.rng = new RNG(zone.uid * 7919 + 13);
    const diff = zone.diff || 1;
    const nWaves = this.fire ? 2 : Math.min(4, 1 + diff);
    this.waves = [];
    for (let i = 0; i < nWaves; i++) {
      const x = 520 + i * 620;
      const n = this.fire ? 2 + i : Math.min(7, 2 + diff + i);
      const list = [];
      for (let j = 0; j < n; j++) list.push(pick(zone.def.enemies));
      if (i === nWaves - 1 && zone.boss) list.push('boss');
      this.waves.push({ x, list, spawned: false, cleared: false });
    }
    this.len = this.waves[nWaves - 1].x + 560;
    const nCap = zone.def.captives || 0;
    for (let i = 0; i < nCap; i++) {
      const x = 380 + ((this.len - 700) * (i + 0.6)) / nCap;
      const c = { x, z: rand(0.15, 0.45), freed: 0, done: false, run: 0, look: zone.id === 'rustlers' ? npcLook('farmer') : npcLook('civilian') };
      this.captives.push(c);
      if (this.fire) this.fires.push({ x: x - 110, z: c.z + 0.1, w: 150, hp: 100 });
    }
    if (this.fire) for (let i = 0; i < 2; i++) this.fires.push({ x: 800 + i * 700, z: rand(0.3, 0.8), w: 130, hp: 100 });

    this.p = { x: 260, z: 0.45, y: 0, vy: 0, hp: 100, en: 100, facing: 1, st: 'idle', st_t: 0, combo: 0, queued: false, inv: 0, hitSet: new Set() };
    this.cam = 0;
    this.lock = null;
    this.buildBackdrop();

    g.input.setStick(true);
    g.input.setButtons([
      { id: 'attack', label: 'PUNCH', key: 'J', cls: 'big' },
      { id: 'jump', label: 'JUMP', key: 'L' },
      { id: 'special', label: this.fire ? 'FREEZE<br>BREATH' : 'HEAT<br>VISION', key: 'K', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Health</span></div><div class="bar"><i id="b-hp" class="b-hp"></i></div>
      <div class="barlabel"><span>Power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>
      <div id="boss-wrap" style="display:none"><div class="barlabel"><span id="boss-name">Boss</span></div><div class="bar"><i id="b-boss" class="b-boss"></i></div></div>`;
    $('hud-title').textContent = `${zone.name} · ${this.D.name}`;
    $('objectives').classList.add('on');
    g.vice = { active: false };
    banner(zone.name.toUpperCase(), this.fire ? 'Put out the fires · Rescue the trapped' : 'Clear the street · Save the captives', '#ffd23f');
  }

  exit() { $('objectives').classList.remove('on'); }

  get viewHalf() { return this.g.w / 2 / this.k; }

  // ------------------------------------------------------------------ backdrop
  buildBackdrop() {
    const r = this.rng, D = this.D, st = D.style;
    this.facades = [];
    this.skyline = [];
    for (let x = -600; x < this.len + 1200; x += r.range(60, 140)) this.skyline.push({ x, w: r.range(60, 140), h: r.range(80, 260) });
    let x = -400;
    while (x < this.len + 600) {
      const w = st === 'houses' || st === 'farm' ? r.range(220, 320) : r.range(160, 280);
      const f = { x, w, h: r.range(140, 280), col: r.pick(D.pal), kind: st, sign: null, neon: D.neon ? r.pick(D.neon) : null };
      if (st === 'shops') { f.h = r.range(120, 170); f.sign = r.pick(SIGN_WORDS.shops); f.awn = r.pick(D.pal); }
      if (st === 'clubs') f.sign = r.pick(SIGN_WORDS[this.zone.district === 'redlight' ? 'redlight' : this.zone.district === 'naughty' ? 'naughty' : 'clubs']);
      if (st === 'casino') f.sign = r.pick(SIGN_WORDS.casino);
      if (st === 'venues') f.sign = r.pick(SIGN_WORDS.venues);
      if (st === 'lair') f.sign = r.chance(0.5) ? r.pick(SIGN_WORDS.lair) : null;
      if (st === 'towers') f.h = r.range(260, 420);
      if (st === 'houses') f.h = r.range(110, 150);
      if (st === 'farm') { f.h = r.range(120, 170); f.barn = r.chance(0.5); }
      if (st === 'docks') { f.h = r.range(50, 110); f.stack = r.int(1, 3); }
      this.facades.push(f);
      x += w + (st === 'houses' || st === 'farm' ? r.range(40, 120) : r.range(0, 12));
    }
    this.lamps = [];
    for (let lx = 100; lx < this.len + 400; lx += 420) this.lamps.push(lx);
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (this.done) return;
    const g = this.g;
    this.k = g.h / 430;
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    const p = this.p, inp = g.input, vh = this.viewHalf;

    // camera & wave locks
    for (const w of this.waves) {
      if (!w.spawned && !this.lock && p.x > w.x - 120) {
        w.spawned = true;
        this.lock = w;
        for (let i = 0; i < w.list.length; i++) this.spawnEnemy(w.list[i], w, i);
        if (w.list.includes('boss')) banner(this.zone.boss.toUpperCase(), 'BOSS FIGHT', '#ff3030');
        // Once they've run on screen, somebody mouths off.
        setTimeout(() => {
          if (this.done) return;
          const boss = this.enemies.find((e) => e.wave === w && e.def.boss && !e.dead);
          const e = boss || this.enemies.find((e) => e.wave === w && !e.dead);
          if (!e) return;
          const s = this.screenOf(e.x, e.z, 110 * (e.look.size || 1));
          if (boss) this.g.commentary.bossTaunt(this.zone.boss, s.x, s.y);
          else this.g.commentary.thugTaunt(s.x, s.y);
        }, 900);
      }
    }
    if (this.lock && this.enemies.every((e) => e.wave !== this.lock || e.dead)) {
      this.lock.cleared = true; this.lock = null; this.goT = 2.5; sfx.pickup();
      const s = this.screenOf(p.x, p.z, 115);
      this.g.commentary.heroQuip(s.x, s.y);
    }
    const camTarget = this.lock ? clamp(this.lock.x + 80, vh, this.len - vh) : clamp(p.x + 90, vh, this.len - vh);
    this.cam += (camTarget - this.cam) * Math.min(1, dt * 4);
    this.goT = Math.max(0, (this.goT || 0) - dt);

    this.updatePlayer(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => !(e.dead && e.st_t > 1.2));
    this.updateBullets(dt);
    this.updateCaptivesAndFires(dt);
    for (const f of this.fx) { f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt; }
    this.fx = this.fx.filter((f) => f.t < f.max);
    p.en = Math.min(100, p.en + dt * 9);

    this.updateObjectives();
    if (p.hp <= 0 && p.st === 'down' && p.st_t > 1.4) return this.finish(false);
    if (this.objectivesDone() && p.x > this.len - 180) return this.finish(true);
  }

  updatePlayer(dt) {
    const p = this.p, inp = this.g.input, vh = this.viewHalf;
    p.st_t += dt;
    p.inv = Math.max(0, p.inv - dt);
    const grounded = p.y <= 0;
    if (p.st === 'down') { if (p.hp > 0 && p.st_t > 0.9) { p.st = 'idle'; p.inv = 1; } return; }
    if (p.st === 'hurt') { if (p.st_t > 0.32) p.st = 'idle'; }

    const busy = p.st === 'attack' || p.st === 'hurt' || p.st === 'beam' || p.st === 'breath';
    const a = inp.axis();
    // Which way the 3D model should face: toward her movement while walking, side-on otherwise.
    const moving = !busy && p.y <= 0 && Math.hypot(a.x, a.y) > 0.15;
    const targetYaw = moving ? Math.atan2(a.x, a.y) : (p.facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    let dyaw = targetYaw - (p.yaw ?? targetYaw);
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    p.yaw = (p.yaw ?? targetYaw) + dyaw * Math.min(1, dt * 14);
    p.vertical = moving && Math.abs(a.y) > Math.abs(a.x);
    if (!busy || !grounded) {
      const sp = grounded ? 250 : 220;
      p.x += a.x * sp * dt;
      p.z = clamp(p.z + a.y * 0.8 * dt, 0.04, 1);
      if (Math.abs(a.x) > 0.2) p.facing = Math.sign(a.x);
      if (grounded && !busy) p.st = Math.hypot(a.x, a.y) > 0.15 ? 'walk' : 'idle';
    }
    // keep inside the camera view (and the level)
    p.x = clamp(p.x, this.cam - vh + 30, Math.min(this.cam + vh - 30, this.len - 40));

    // jump
    if (inp.pressed('jump') && grounded && !busy) { p.vy = 560; p.y = 0.01; sfx.whoosh(); }
    if (p.y > 0) {
      p.vy -= 1500 * dt; p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; if (p.st === 'flykick') p.st = 'idle'; }
    }

    // attack / combo
    if (inp.pressed('attack')) {
      if (p.y > 0 && p.st !== 'flykick') { p.st = 'flykick'; p.st_t = 0; p.hitSet.clear(); sfx.whoosh(); }
      else if (p.st === 'attack') { if (p.st_t > 0.1 && p.combo < 3) p.queued = true; }
      else if (!busy && grounded) this.startAttack(1);
    }
    if (p.st === 'attack') {
      const dur = p.combo === 3 ? 0.36 : 0.24;
      if (p.st_t > 0.06 && p.st_t < 0.16) this.playerHits(p.combo === 3 ? 90 : 72, p.combo === 3 ? 15 : 8 + p.combo, p.combo === 3);
      if (p.st_t >= dur) {
        if (p.queued) this.startAttack(p.combo + 1);
        else { p.st = 'idle'; p.combo = 0; }
      }
    }
    if (p.st === 'flykick') this.playerHits(86, 16, true);

    // special
    if (inp.pressed('special') && grounded && !busy) {
      if (this.fire) {
        if (p.en >= 15) {
          p.st = 'breath'; p.st_t = 0; p.en -= 15; sfx.breath();
          const s = this.screenOf(p.x + p.facing * 90, p.z, 90);
          this.g.commentary.frost(s.x, s.y);
        }
        else toast('Not enough power', 'bad');
      } else if (p.en >= 30) { p.st = 'beam'; p.st_t = 0; p.en -= 30; p.hitSet.clear(); sfx.beam(); }
      else toast('Not enough power', 'bad');
    }
    if (p.st === 'beam') {
      if (p.st_t > 0.1) for (const e of this.enemies) {
        if (e.dead || p.hitSet.has(e)) continue;
        const dx = (e.x - p.x) * p.facing;
        if (dx > 0 && dx < 760 && Math.abs(e.z - p.z) < DZ * 1.3) {
          if (!p.hitSet.size) { const s = this.screenOf(e.x, e.z, 85); this.g.commentary.beam(s.x, s.y); }
          p.hitSet.add(e); this.damage(e, 24, true, true);
        }
      }
      if (p.st_t > 0.6) p.st = 'idle';
    }
    if (p.st === 'breath') {
      for (const f of this.fires) {
        const dx = (f.x - p.x) * p.facing;
        if (dx > -f.w / 2 && dx < 300 && Math.abs(f.z - p.z) < 0.26 && f.hp > 0) {
          f.hp -= dt * 110;
          if (f.hp <= 0) { f.hp = 0; sfx.pickup(); this.fx.push({ kind: 'text', x: f.x, y: 120, z: f.z, t: 0, max: 1, txt: 'EXTINGUISHED!', col: '#9fe8ff', vy: 40 }); }
        }
      }
      for (const e of this.enemies) {
        const dx = (e.x - p.x) * p.facing;
        if (!e.dead && dx > 0 && dx < 280 && Math.abs(e.z - p.z) < 0.2 && e.st !== 'frozen') { e.st = 'frozen'; e.st_t = 0; }
      }
      if (chance(0.8)) this.fx.push({ kind: 'frost', x: p.x + p.facing * 40, y: 78, z: p.z, vx: p.facing * rand(350, 500), vy: rand(-30, 30), t: 0, max: 0.55 });
      if (p.st_t > 0.9) p.st = 'idle';
    }
  }

  startAttack(n) {
    const p = this.p;
    p.st = 'attack'; p.st_t = 0; p.combo = n; p.queued = false; p.hitSet.clear();
    sfx.whoosh();
  }

  playerHits(reach, dmg, knock) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead || p.hitSet.has(e) || e.st === 'down') continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx > -10 && dx < reach * (e.def.boss ? 1.2 : 1) && Math.abs(e.z - p.z) < DZ && Math.abs(e.y - p.y) < 60) {
        p.hitSet.add(e);
        this.damage(e, dmg, knock);
      }
    }
  }

  /** World (x, depth z, height y) → screen pixels, matching render(). */
  screenOf(x, z, y = 0) {
    const g = this.g, k = g.h / 430, gt = g.h * 0.58, gb = g.h * 0.97;
    const s = k * (0.8 + 0.32 * z);
    return { x: g.w / 2 + (x - this.cam) * k, y: gt + z * (gb - gt) - y * s };
  }

  damage(e, dmg, knock, silent = false) {
    const p = this.p;
    e.hp -= dmg;
    sfx.hit();
    if (!silent) {
      const s = this.screenOf(e.x, e.z, 80 * (e.look.size || 1));
      this.g.commentary.hit(s.x, s.y, { big: knock || e.hp <= 0 });
    }
    this.hitstop = 0.045;
    this.shake = Math.max(this.shake, knock ? 8 : 4);
    this.fx.push({ kind: 'spark', x: e.x - p.facing * 10, y: 70 + rand(-10, 10), z: e.z, t: 0, max: 0.22 });
    this.fx.push({ kind: 'text', x: e.x, y: 120, z: e.z, t: 0, max: 0.8, txt: String(dmg), col: '#fff', vy: 70 });
    e.facing = -p.facing;
    if (e.hp <= 0 || (knock && !e.def.boss) || (knock && e.def.boss && chance(0.35))) {
      e.st = 'down'; e.st_t = 0; e.vx = p.facing * (e.def.boss ? 180 : 360); e.vy = 260; e.y = Math.max(e.y, 1);
    } else { e.st = 'hurt'; e.st_t = 0; e.x += p.facing * 14; }
  }

  spawnEnemy(type, wave, i) {
    const vh = this.viewHalf, side = i % 2 === 0 ? 1 : -1;
    const cx = clamp(wave.x + 80, vh, this.len - vh);
    const def = EN[type];
    const look = type === 'boss' ? npcLook('boss') : npcLook(type);
    this.enemies.push({
      type, def, look, wave, x: cx + side * (vh + 60 + i * 40), z: rand(0.15, 0.95), y: 0, vy: 0, vx: 0,
      hp: def.hp, max: def.hp, facing: -side, st: 'approach', st_t: 0, cd: rand(0.4, 1.4), dead: false,
    });
    if (type === 'boss') { $('boss-wrap').style.display = 'block'; $('boss-name').textContent = this.zone.boss; }
  }

  updateEnemy(e, dt) {
    const p = this.p;
    e.st_t += dt;
    if (e.dead) return;
    if (e.y > 0 || e.vy) { e.vy -= 1500 * dt; e.y += e.vy * dt; if (e.y <= 0) { e.y = 0; e.vy = 0; } }
    if (e.st === 'down') {
      e.x += e.vx * dt; e.vx *= 1 - dt * 3;
      if (e.st_t > 1.1) {
        if (e.hp <= 0) { e.dead = true; e.st_t = 0; this.fx.push({ kind: 'text', x: e.x, y: 110, z: e.z, t: 0, max: 1, txt: 'K.O.!', col: '#ffd23f', vy: 50 }); }
        else { e.st = 'approach'; e.cd = 0.8; }
      }
      return;
    }
    if (e.st === 'hurt') { if (e.st_t > 0.3) e.st = 'approach'; return; }
    if (e.st === 'frozen') { if (e.st_t > 2.2) e.st = 'approach'; return; }
    e.cd -= dt;
    const dx = p.x - e.x, adx = Math.abs(dx);
    if (e.st === 'approach') {
      e.facing = Math.sign(dx) || 1;
      const engaged = this.enemies.filter((o) => !o.dead && (o.st === 'wind' || o.st === 'strike')).length;
      if (e.def.ranged) {
        const want = 360;
        const tx = p.x - Math.sign(dx || 1) * want;
        e.x += clamp(tx - e.x, -1, 1) * e.def.spd * dt * (Math.abs(tx - e.x) > 20 ? 1 : 0);
        e.z += clamp(p.z - e.z, -1, 1) * 0.45 * dt;
        if (e.cd <= 0 && Math.abs(e.z - p.z) < 0.06 && adx < 700) { e.st = 'aim'; e.st_t = 0; }
      } else {
        const hold = engaged >= 2 && e.def.spd < 200 ? 200 : e.def.reach * 0.8;
        const tx = p.x - Math.sign(dx || 1) * hold;
        if (Math.abs(tx - e.x) > 8) e.x += Math.sign(tx - e.x) * e.def.spd * dt;
        if (Math.abs(p.z - e.z) > 0.02) e.z += Math.sign(p.z - e.z) * 0.5 * dt;
        if (e.cd <= 0 && adx < e.def.reach && Math.abs(e.z - p.z) < DZ && engaged < 2) {
          e.st = e.def.boss && chance(0.35) ? 'charge' : 'wind'; e.st_t = 0;
        }
      }
    } else if (e.st === 'wind') {
      if (e.st_t > (e.def.boss ? 0.5 : 0.42)) { e.st = 'strike'; e.st_t = 0; e.hit = false; sfx.punch(); }
    } else if (e.st === 'strike') {
      if (!e.hit && e.st_t > 0.04) {
        e.hit = true;
        const fdx = (p.x - e.x) * e.facing;
        if (fdx > -10 && fdx < e.def.reach + 10 && Math.abs(e.z - p.z) < DZ && p.y < 40) this.hurtPlayer(e.def.dmg, e.facing);
      }
      if (e.st_t > 0.25) { e.st = 'approach'; e.cd = rand(0.9, 1.7); }
    } else if (e.st === 'aim') {
      if (e.st_t > 0.75) {
        this.bullets.push({ x: e.x + e.facing * 40, z: e.z, vx: e.facing * 620, t: 0 });
        sfx.punch();
        e.st = 'approach'; e.cd = rand(1.4, 2.4);
      }
    } else if (e.st === 'charge') {
      if (e.st_t < 0.6) return; // telegraph
      e.x += e.facing * 640 * dt;
      if (!e.hit && Math.abs(p.x - e.x) < 60 && Math.abs(e.z - p.z) < DZ * 1.2 && p.y < 40) { e.hit = true; this.hurtPlayer(20, e.facing, true); }
      if (e.st_t > 1.2) { e.st = 'approach'; e.cd = 1.2; e.hit = false; }
    }
    const vh = this.viewHalf;
    if (this.lock) e.x = clamp(e.x, this.cam - vh - 80, this.cam + vh + 80);
  }

  hurtPlayer(dmg, dir, knock = false) {
    const p = this.p;
    if (p.inv > 0 || p.st === 'down') return;
    p.hp = Math.max(0, p.hp - dmg);
    p.inv = 0.5;
    sfx.hurt();
    this.shake = 7;
    { const s = this.screenOf(p.x, p.z, 90); this.g.commentary.hurt(s.x, s.y); }
    this.fx.push({ kind: 'spark', x: p.x, y: 70, z: p.z, t: 0, max: 0.22, col: '#ff5050' });
    if (p.hp <= 0 || knock) { p.st = 'down'; p.st_t = 0; p.x += dir * 30; if (p.hp <= 0) { sfx.lose(); banner('DOWN!', '', '#ff4d6a'); } }
    else { p.st = 'hurt'; p.st_t = 0; p.x += dir * 18; }
  }

  updateBullets(dt) {
    const p = this.p;
    for (const b of this.bullets) {
      b.t += dt; b.x += b.vx * dt;
      if (!b.gone && Math.abs(b.x - p.x) < 24 && Math.abs(b.z - p.z) < 0.07 && p.y < 50) {
        b.gone = true;
        // Heroine can swat bullets away mid-punch.
        if (p.st === 'attack' && Math.sign(b.vx) === -p.facing) { sfx.hit(); this.fx.push({ kind: 'text', x: p.x, y: 120, z: p.z, t: 0, max: 0.7, txt: 'DEFLECT!', col: '#9fe8ff', vy: 60 }); }
        else this.hurtPlayer(12, Math.sign(b.vx));
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone && b.t < 2);
  }

  updateCaptivesAndFires(dt) {
    const p = this.p;
    for (const f of this.fires) {
      if (f.hp <= 0) continue;
      if (Math.abs(p.x - f.x) < f.w / 2 && Math.abs(p.z - f.z) < 0.14 && p.y < 30 && p.inv <= 0) {
        p.hp = Math.max(0, p.hp - dt * 18);
        if (chance(dt * 4)) this.fx.push({ kind: 'text', x: p.x, y: 120, z: p.z, t: 0, max: 0.6, txt: 'HOT!', col: '#ff9a3a', vy: 60 });
        if (p.hp <= 0 && p.st !== 'down') { p.st = 'down'; p.st_t = 0; sfx.lose(); }
      }
    }
    for (const c of this.captives) {
      if (c.done) { c.run += dt; c.x -= 220 * dt; continue; }
      const blocked = this.fires.some((f) => f.hp > 0 && Math.abs(f.x - c.x) < 170);
      const near = Math.abs(p.x - c.x) < 70 && Math.abs(p.z - c.z) < 0.16 && p.y <= 0;
      if (near && !blocked && (p.st === 'idle' || p.st === 'walk')) {
        c.freed += dt / 0.9;
        if (c.freed >= 1) {
          c.done = true; sfx.pickup();
          this.fx.push({ kind: 'text', x: c.x, y: 130, z: c.z, t: 0, max: 1.2, txt: 'SAVED!', col: '#3ee08a', vy: 50 });
        }
      } else c.freed = Math.max(0, c.freed - dt * 0.5);
      c.blocked = blocked;
    }
  }

  objectivesDone() {
    return this.waves.every((w) => w.cleared) && this.captives.every((c) => c.done) && this.fires.every((f) => f.hp <= 0);
  }

  updateObjectives() {
    const wc = this.waves.filter((w) => w.cleared).length;
    const cc = this.captives.filter((c) => c.done).length;
    const fc = this.fires.filter((f) => f.hp <= 0).length;
    const rows = [[`${this.fire ? 'Stop the arsonists' : 'Clear the thugs'} (${wc}/${this.waves.length})`, wc === this.waves.length]];
    if (this.captives.length) rows.push([`Free the captives (${cc}/${this.captives.length})`, cc === this.captives.length]);
    if (this.fires.length) rows.push([`Put out the fires (${fc}/${this.fires.length})`, fc === this.fires.length]);
    const done = this.objectivesDone();
    rows.push(['Head down the street →', false, !done]);
    const html = rows.map(([t, d, dim]) => `<div class="${d ? 'done' : dim ? '' : 'cur'}">${d ? '✓' : '•'} ${t}</div>`).join('');
    const el = $('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('hud-sub').textContent = this.captives.length && !this.captives.every((c) => c.done) ? 'Stand next to captives to untie them' : this.fire ? 'Freeze breath puts out fires' : 'Punch combos · Jump kicks · Heat vision';
    const boss = this.enemies.find((e) => e.def.boss && !e.dead);
    const bb = $('b-boss'); if (bb && boss) bb.style.width = (Math.max(0, boss.hp) / boss.max) * 100 + '%';
  }

  hud() {
    const hp = $('b-hp'), en = $('b-en');
    if (hp) { hp.style.width = this.p.hp + '%'; hp.parentElement.classList.toggle('warn', this.p.hp < 30); }
    if (en) en.style.width = this.p.en + '%';
  }

  finish(win) {
    if (this.done) return;
    this.done = true;
    const z = this.zone;
    const saved = this.captives.filter((c) => c.done).length;
    if (win) {
      sfx.win();
      banner('SAVED THE DAY!', '', '#3ee08a');
      setTimeout(() => this.g.endZone(z, { outcome: 'win', rep: z.reward + saved * 3, saved, photo: this.fire ? 'fire' : 'hero' }), 1200);
    } else {
      setTimeout(() => this.g.endZone(z, { outcome: 'lose', rep: -8, text: `${HERO} was overwhelmed and had to retreat. The crooks got away this time.` }), 600);
    }
  }

  abort() { this.done = true; this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h;
    const k = (this.k = H / 430);
    const gt = H * 0.58, gb = H * 0.97;
    const gy = (z) => gt + z * (gb - gt);
    const sc = (z) => k * (0.8 + 0.32 * z);
    const sx = (x) => W / 2 + (x - this.cam) * k;
    const night = g.state.night;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, gt);
    sky.addColorStop(0, night > 0.5 ? '#0b1030' : '#6fb4e8');
    sky.addColorStop(1, night > 0.5 ? '#3a2a5a' : '#f2d7a8');
    ctx.fillStyle = sky; ctx.fillRect(-20, -20, W + 40, gt + 20);
    if (night > 0.5) { ctx.fillStyle = '#fff8'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 + 13) % W, (i * 57) % (gt * 0.6), 2, 2); }
    // skyline (parallax)
    ctx.fillStyle = night > 0.5 ? '#1c1a38' : '#8aa4c0';
    for (const s of this.skyline) {
      const x = W / 2 + (s.x - this.cam * 0.3) * k * 0.6;
      if (x > W + 100 || x + s.w * k < -100) continue;
      ctx.fillRect(x, gt - s.h * k * 0.6 - 40 * k, s.w * k * 0.6, s.h * k * 0.6 + 40 * k);
    }
    if (this.D.style === 'docks') { ctx.fillStyle = '#2a5a80'; ctx.fillRect(-20, gt - 60 * k, W + 40, 60 * k); }
    // facades
    for (const f of this.facades) {
      const x = sx(f.x), w = f.w * k;
      if (x > W + 20 || x + w < -20) continue;
      this.drawFacade(ctx, f, x, gt, w, f.h * k, k, night);
    }
    // sidewalk + street
    ctx.fillStyle = this.D.style === 'farm' ? '#9a8458' : this.D.style === 'houses' ? '#b8b4aa' : '#8e8b84';
    ctx.fillRect(-20, gt, W + 40, (gb - gt) * 0.24);
    ctx.fillStyle = '#6d6a64'; ctx.fillRect(-20, gt + (gb - gt) * 0.24, W + 40, 4 * k);
    ctx.fillStyle = this.D.style === 'farm' ? '#7d6a48' : '#3a3b40';
    ctx.fillRect(-20, gt + (gb - gt) * 0.24 + 4 * k, W + 40, H);
    ctx.fillStyle = 'rgba(240,220,120,.7)';
    const dash = 80 * k, off = ((-this.cam * k) % (dash * 2) + dash * 2) % (dash * 2);
    for (let x = off - dash * 2; x < W + dash; x += dash * 2) ctx.fillRect(x, gy(0.64), dash, 5 * k);
    // lamps
    for (const lx of this.lamps) {
      const x = sx(lx); if (x < -50 || x > W + 50) continue;
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 3 * k, gt - 170 * k, 6 * k, 175 * k); ctx.fillRect(x - 3 * k, gt - 170 * k, 30 * k, 5 * k);
      ctx.fillStyle = night > 0.3 ? '#ffe6a0' : '#ddd'; ctx.fillRect(x + 20 * k, gt - 167 * k, 12 * k, 6 * k);
      if (night > 0.3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(glow('#ffd070'), x - 60 * k, gt - 220 * k, 160 * k, 160 * k); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    // night tint on the backdrop only
    if (night > 0) { ctx.fillStyle = `rgba(10,12,40,${0.35 * night})`; ctx.fillRect(-20, -20, W + 40, H + 40); }

    // depth-sorted actors
    const drawables = [];
    for (const f of this.fires) drawables.push({ z: f.z, f });
    for (const c of this.captives) drawables.push({ z: c.z, c });
    for (const e of this.enemies) drawables.push({ z: e.z, e });
    drawables.push({ z: this.p.z, p: this.p });
    drawables.sort((a, b) => a.z - b.z);
    for (const d of drawables) {
      if (d.f) this.drawFire(ctx, d.f, sx(d.f.x), gy(d.f.z), sc(d.f.z));
      else if (d.c) this.drawCaptive(ctx, d.c, sx(d.c.x), gy(d.c.z), sc(d.c.z));
      else if (d.e) this.drawEnemy(ctx, d.e, sx(d.e.x), gy(d.e.z), sc(d.e.z));
      else this.drawPlayer(ctx, sx(this.p.x), gy(this.p.z), sc(this.p.z));
    }
    // bullets
    ctx.fillStyle = '#ffe070';
    for (const b of this.bullets) { const s = sc(b.z); ctx.fillRect(sx(b.x) - 8 * s, gy(b.z) - 72 * s, 16 * s, 3 * s); }
    // fx
    for (const f of this.fx) {
      const x = sx(f.x), y = gy(f.z) - f.y * sc(f.z), a = 1 - f.t / f.max;
      if (f.kind === 'spark') {
        ctx.strokeStyle = f.col || '#fff6a0'; ctx.lineWidth = 3; ctx.globalAlpha = a;
        const r = (10 + f.t * 120) * k;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2; ctx.moveTo(x + Math.cos(an) * r * 0.4, y + Math.sin(an) * r * 0.4); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); }
        ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.kind === 'text') {
        ctx.globalAlpha = a; ctx.font = `900 ${18 * k}px system-ui`; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(f.txt, x + 2, y + 2); ctx.fillStyle = f.col; ctx.fillText(f.txt, x, y);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'frost') {
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#d8f6ff';
        ctx.beginPath(); ctx.arc(x, y, (6 + f.t * 40) * k, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    // GO arrow
    if (!this.lock && this.goT > 0 && Math.sin(this.t * 10) > -0.2) {
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.font = `900 ${42 * k}px Impact, system-ui`; ctx.textAlign = 'right';
      ctx.strokeText('GO ➜', W - 30, H * 0.35); ctx.fillText('GO ➜', W - 30, H * 0.35);
    }
    if (this.objectivesDone()) {
      const ex = sx(this.len - 120);
      if (ex < W + 40) { ctx.fillStyle = 'rgba(62,224,138,.25)'; ctx.fillRect(ex, gt, 120 * k, gb - gt); ctx.fillStyle = '#3ee08a'; ctx.font = `900 ${16 * k}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('EXIT', ex + 60 * k, gt - 10); }
    }
    ctx.restore();
  }

  drawFacade(ctx, f, x, gt, w, h, k, night) {
    const st = f.kind;
    const top = gt - h;
    const lit = night > 0.4;
    if (st === 'houses') {
      ctx.fillStyle = '#5f8a4a'; ctx.fillRect(x - 20 * k, gt - 20 * k, w + 60 * k, 20 * k);
      ctx.fillStyle = f.col; ctx.fillRect(x, top + h * 0.35, w, h * 0.65 - 20 * k);
      ctx.fillStyle = '#6a3a2a'; ctx.beginPath(); ctx.moveTo(x - 12 * k, top + h * 0.37); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w + 12 * k, top + h * 0.37); ctx.fill();
      ctx.fillStyle = lit ? '#ffd88a' : '#9cc8e8';
      ctx.fillRect(x + w * 0.15, top + h * 0.5, w * 0.2, h * 0.18); ctx.fillRect(x + w * 0.65, top + h * 0.5, w * 0.2, h * 0.18);
      ctx.fillStyle = '#6b3a24'; ctx.fillRect(x + w * 0.43, top + h * 0.6, w * 0.14, h * 0.4 - 20 * k);
      ctx.fillStyle = '#eee'; for (let i = 0; i < w + 40 * k; i += 12 * k) ctx.fillRect(x - 20 * k + i, gt - 16 * k, 4 * k, 16 * k);
      return;
    }
    if (st === 'farm') {
      if (f.barn) {
        ctx.fillStyle = '#a8322d'; ctx.fillRect(x, top + h * 0.3, w * 0.7, h * 0.7);
        ctx.fillStyle = '#6a2a24'; ctx.beginPath(); ctx.moveTo(x - 10 * k, top + h * 0.32); ctx.lineTo(x + w * 0.35, top); ctx.lineTo(x + w * 0.7 + 10 * k, top + h * 0.32); ctx.fill();
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 3 * k; ctx.strokeRect(x + w * 0.2, top + h * 0.55, w * 0.3, h * 0.45);
        ctx.beginPath(); ctx.moveTo(x + w * 0.2, top + h * 0.55); ctx.lineTo(x + w * 0.5, gt); ctx.moveTo(x + w * 0.5, top + h * 0.55); ctx.lineTo(x + w * 0.2, gt); ctx.stroke();
        ctx.fillStyle = '#c9c9c0'; ctx.fillRect(x + w * 0.78, top - 20 * k, w * 0.16, h + 20 * k);
        ctx.beginPath(); ctx.arc(x + w * 0.86, top - 20 * k, w * 0.08, Math.PI, 0); ctx.fill();
      } else {
        ctx.fillStyle = '#c9b25a'; ctx.fillRect(x - 40 * k, gt - 50 * k, w + 80 * k, 50 * k);
        ctx.fillStyle = '#b89e48'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 40 * k, gt - 50 * k + i * 9 * k, w + 80 * k, 3 * k);
      }
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3 * k; ctx.beginPath();
      ctx.moveTo(x - 60 * k, gt - 18 * k); ctx.lineTo(x + w + 60 * k, gt - 18 * k); ctx.moveTo(x - 60 * k, gt - 8 * k); ctx.lineTo(x + w + 60 * k, gt - 8 * k); ctx.stroke();
      return;
    }
    if (st === 'docks') {
      for (let i = 0; i < f.stack; i++) {
        const cw = w * 0.9, ch = 40 * k, cy = gt - ch * (i + 1);
        ctx.fillStyle = shade(f.col, -i * 0.1); ctx.fillRect(x, cy, cw, ch - 2);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let j = 0; j < cw; j += 10 * k) ctx.fillRect(x + j, cy, 3 * k, ch - 2);
      }
      return;
    }
    ctx.fillStyle = f.col; ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, top, 4 * k, h);
    if (st === 'warehouses' || st === 'factory') {
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < w; i += 12 * k) ctx.fillRect(x + i, top, 3 * k, h);
      ctx.fillStyle = '#555'; ctx.fillRect(x + w * 0.2, gt - h * 0.5, w * 0.5, h * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < h * 0.5; i += 8 * k) ctx.fillRect(x + w * 0.2, gt - h * 0.5 + i, w * 0.5, 2 * k);
      if (st === 'factory') { ctx.fillStyle = '#7a5a4a'; ctx.fillRect(x + w * 0.8, top - 120 * k, 22 * k, 120 * k); }
      ctx.fillStyle = '#f2c21a'; for (let i = 0; i < w; i += 24 * k) ctx.fillRect(x + i, top, 12 * k, 6 * k);
      return;
    }
    // windows grid
    const cols = Math.max(2, Math.floor(w / (34 * k))), rows = Math.max(2, Math.floor((h - 60 * k) / (38 * k)));
    const ww = w / cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = lit && ((c * 7 + r * 13 + (f.x | 0)) % 5) > 1;
      ctx.fillStyle = on ? '#ffd98a' : st === 'towers' ? '#8fb8dc' : '#2a3040';
      ctx.fillRect(x + c * ww + ww * 0.2, top + 16 * k + r * 38 * k, ww * 0.6, 22 * k);
    }
    // ground floor
    const gf = 56 * k;
    ctx.fillStyle = shade(f.col, -0.3); ctx.fillRect(x, gt - gf, w, gf);
    ctx.fillStyle = lit ? '#ffe7b0' : '#9cc8e8'; ctx.fillRect(x + w * 0.1, gt - gf * 0.8, w * 0.45, gf * 0.55);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(x + w * 0.65, gt - gf * 0.85, w * 0.18, gf * 0.85);
    if (f.awn) {
      ctx.fillStyle = f.awn; ctx.fillRect(x + 4 * k, gt - gf - 12 * k, w - 8 * k, 14 * k);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < w - 8 * k; i += 16 * k) ctx.fillRect(x + 4 * k + i, gt - gf - 12 * k, 8 * k, 14 * k);
    }
    if (f.sign) {
      const neon = f.neon && (st === 'clubs' || st === 'casino' || st === 'venues' || st === 'lair');
      ctx.font = `900 ${Math.min(22 * k, (w / f.sign.length) * 1.5)}px ${neon ? 'system-ui' : 'Georgia, serif'}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sy = gt - gf - (f.awn ? 30 : 20) * k;
      if (neon) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + w * 0.1, sy - 16 * k, w * 0.8, 32 * k);
        ctx.shadowColor = f.neon; ctx.shadowBlur = 14; ctx.fillStyle = f.neon;
        if (Math.sin(this.t * 6 + f.x) > -0.85) ctx.fillText(f.sign, x + w / 2, sy);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#f2ead8'; ctx.fillRect(x + w * 0.15, sy - 13 * k, w * 0.7, 26 * k);
        ctx.fillStyle = '#222'; ctx.fillText(f.sign, x + w / 2, sy);
      }
    }
  }

  drawShadow(ctx, x, y, s, w = 26) {
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x, y, w * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  drawPlayer(ctx, x, y, s) {
    const p = this.p;
    this.drawShadow(ctx, x, y, s);
    if (p.inv > 0 && p.st !== 'down' && Math.sin(this.t * 40) > 0.3) return;
    if (heroReady()) { this.drawPlayerModel(ctx, x, y, s); return; }
    let P;
    switch (p.st) {
      case 'walk': P = pose('walk', this.t); break;
      case 'attack': P = pose(p.combo === 3 ? 'kick' : p.combo === 2 ? 'punch2' : 'punch1'); break;
      case 'flykick': P = pose('flykick'); break;
      case 'hurt': P = pose('hurt'); break;
      case 'down': P = pose('down'); break;
      case 'beam': P = pose('beam'); break;
      case 'breath': P = pose('breath'); break;
      default: P = p.y > 0 ? pose('jump') : pose('idle', this.t);
    }
    drawHumanoid(ctx, x, y - p.y * s, s, p.facing, { ...HERO_LOOK, cape: HERO_LOOK.cape }, P, this.t);
    if (p.st === 'beam' && p.st_t > 0.08) {
      const ey = y - p.y * s - 86 * s;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,60,40,.55)'; ctx.lineWidth = 12 * s;
      ctx.beginPath(); ctx.moveTo(x + p.facing * 8 * s, ey); ctx.lineTo(x + p.facing * 760 * this.k, ey); ctx.stroke();
      ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Rigged 3D Supergirl rendered side-on as a sprite, clip chosen from the fight state. */
  drawPlayerModel(ctx, x, y, s) {
    const p = this.p;
    if (!this.sprite) this.sprite = new HeroSprite(220, 300);
    const H = this.sprite.hero;
    let punch = null;
    switch (p.st) {
      case 'walk': if (p.vertical) H.pose('jog', this.t * 1.1); else H.pose('run', this.t * 0.95); break;
      case 'attack': {
        // Real clips, time-mapped so the blow lands inside the hit window (st_t 0.06–0.16):
        // 1 = left jab, 2 = right cross (both from "Fist Fight A"), 3 = front-kick finisher ("Kick").
        const u = Math.min(1, p.st_t / (p.combo === 3 ? 0.36 : 0.24));
        if (p.combo === 1) H.pose('punch', 1.30 + u * 0.37);
        else if (p.combo === 2) H.pose('punch', 2.05 + u * 0.5);
        else H.pose('kick2', 0.30 + u * 0.7);
        break;
      }
      case 'flykick': H.pose('kick2', 0.67); break;
      case 'hurt': H.pose('hit', 0.15 + p.st_t * 1.6); break;
      case 'down': H.pose(p.hp > 0 && p.st_t > 0.5 ? 'getUp' : 'fallFlat', p.hp > 0 && p.st_t > 0.5 ? 4 + (p.st_t - 0.5) * 6 : 0.6 + p.st_t * 1.8); break;
      case 'beam': case 'breath': H.pose('combatIdle', 1.2); break;
      default: H.pose(p.y > 0 ? 'jump' : 'combatIdle', p.y > 0 ? 1.0 : this.t);
    }
    if (punch) H.punch(punch[0], punch[1]);
    // Cape wind: running pushes it out behind her; jumping/falling lifts it.
    const run = p.st === 'walk' ? 7 : p.st === 'attack' || p.st === 'flykick' ? 3 : 0.8;
    H.setWind(Math.sin(this.t * 1.7) * 0.8, p.y > 0 ? (p.vy < 0 ? 9 : -3) : 0.5, -run);
    // Fighting moves always face the enemy side-on; walking uses the smoothed movement heading.
    const sideOn = p.st !== 'walk' && p.st !== 'idle';
    const yaw = sideOn ? (p.facing > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.yaw ?? Math.PI / 2);
    const img = this.sprite.render({ view: 'side', yaw, span: 2.6, lift: 0.12 });
    // Sprite frame is 2.6 m tall; the 2D art is ~95 units for a 1.75 m person.
    const hpx = 2.6 * 54 * s, wpx = hpx * (220 / 300);
    ctx.drawImage(img, x - wpx / 2, y - p.y * s - hpx * (1 - 0.12 / 2.6), wpx, hpx);
    if (p.st === 'beam' && p.st_t > 0.08) {
      const ey = y - p.y * s - 90 * s;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,60,40,.55)'; ctx.lineWidth = 12 * s;
      ctx.beginPath(); ctx.moveTo(x + p.facing * 8 * s, ey); ctx.lineTo(x + p.facing * 760 * this.k, ey); ctx.stroke();
      ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (p.st === 'breath') {
      ctx.fillStyle = 'rgba(200,240,255,.5)';
      ctx.beginPath(); ctx.arc(x + p.facing * 12 * s, y - 88 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawEnemy(ctx, e, x, y, s) {
    if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.st_t) * (Math.sin(e.st_t * 30) > 0 ? 1 : 0.4);
    this.drawShadow(ctx, x, y, s * (e.look.size || 1));
    let P;
    switch (e.st) {
      case 'wind': P = pose('wind'); break;
      case 'strike': P = pose(e.type === 'brute' || e.type === 'boss' ? 'punch2' : 'punch1'); break;
      case 'hurt': P = pose('hurt'); break;
      case 'down': P = pose('down'); break;
      case 'aim': P = pose('aim'); break;
      case 'charge': P = e.st_t < 0.6 ? pose('wind') : pose('run', this.t); break;
      case 'frozen': P = pose('hurt'); break;
      default: P = pose(Math.abs(e.st_t % 2) < 2 ? 'walk' : 'idle', this.t + e.x * 0.01);
    }
    if (e.dead) P = pose('down');
    drawHumanoid(ctx, x, y - e.y * s, s, e.facing, e.look, P, this.t);
    if (e.st === 'frozen') { ctx.fillStyle = 'rgba(180,230,255,.45)'; ctx.fillRect(x - 22 * s, y - 104 * s * (e.look.size || 1), 44 * s, 104 * s * (e.look.size || 1)); }
    if ((e.st === 'wind' || (e.st === 'charge' && e.st_t < 0.6)) && Math.sin(this.t * 30) > 0) {
      ctx.fillStyle = '#ff3030'; ctx.font = `900 ${20 * s}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 118 * s * (e.look.size || 1));
    }
    if (e.st === 'aim') {
      ctx.strokeStyle = 'rgba(255,40,40,.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + e.facing * 30 * s, y - 72 * s); ctx.lineTo(x + e.facing * 700 * this.k, y - 72 * s); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.fillRect(x + e.facing * 18 * s - (e.facing < 0 ? 16 * s : 0), y - 76 * s, 16 * s, 5 * s);
    }
    if (e.type === 'knife' && !e.dead) { ctx.fillStyle = '#ddd'; ctx.fillRect(x + e.facing * 26 * s - (e.facing < 0 ? 10 * s : 0), y - 60 * s, 10 * s, 2.5 * s); }
    if (!e.def.boss && e.hp < e.max && !e.dead) {
      ctx.fillStyle = '#000a'; ctx.fillRect(x - 20 * s, y - 116 * s * (e.look.size || 1), 40 * s, 4 * s);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(x - 20 * s, y - 116 * s * (e.look.size || 1), 40 * s * Math.max(0, e.hp / e.max), 4 * s);
    }
    ctx.globalAlpha = 1;
  }

  drawCaptive(ctx, c, x, y, s) {
    if (c.done) {
      if (c.run > 2.5) return;
      drawHumanoid(ctx, x, y, s, -1, c.look, pose('run', this.t), this.t);
      return;
    }
    this.drawShadow(ctx, x, y, s);
    drawHumanoid(ctx, x, y, s, 1, c.look, pose('sitFloor', this.t), this.t);
    const bob = Math.sin(this.t * 4) * 3;
    ctx.font = `800 ${12 * s}px system-ui`; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    const label = c.blocked ? 'TRAPPED BY FIRE!' : 'HELP!';
    ctx.strokeText(label, x, y - 80 * s + bob); ctx.fillText(label, x, y - 80 * s + bob);
    if (c.freed > 0) {
      ctx.strokeStyle = '#3ee08a'; ctx.lineWidth = 5 * s;
      ctx.beginPath(); ctx.arc(x, y - 100 * s, 12 * s, -Math.PI / 2, -Math.PI / 2 + c.freed * Math.PI * 2); ctx.stroke();
    }
  }

  drawFire(ctx, f, x, y, s) {
    if (f.hp <= 0) {
      ctx.fillStyle = 'rgba(30,30,30,.5)'; ctx.beginPath(); ctx.ellipse(x, y, f.w / 2 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const k = f.hp / 100;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const fx = x + ((i / 8) - 0.5) * f.w * s;
      const h = (60 + Math.sin(this.t * 9 + i * 1.7) * 18) * s * (0.4 + 0.6 * k);
      const grd = ctx.createLinearGradient(fx, y, fx, y - h);
      grd.addColorStop(0, 'rgba(255,200,60,.9)'); grd.addColorStop(0.5, 'rgba(255,90,20,.7)'); grd.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(fx - 16 * s, y); ctx.quadraticCurveTo(fx - 8 * s, y - h * 0.6, fx + Math.sin(this.t * 7 + i) * 6 * s, y - h); ctx.quadraticCurveTo(fx + 8 * s, y - h * 0.6, fx + 16 * s, y); ctx.fill();
    }
    ctx.globalAlpha = 0.5; ctx.drawImage(glow('#ff8a30'), x - f.w * s, y - 120 * s, f.w * 2 * s, 160 * s); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
