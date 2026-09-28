// Side-scrolling beat 'em up for regular activity zones (Streets of Rage / TMNT arcade staging).
// Coordinates: x = world units along the street, z = depth 0 (sidewalk) .. 1 (front), y = height.
// 54 world units = 1 metre. The set lives in brawlstage.js; crooks are the rigged 3D enemy models
// baked to inked sprites in brawlsprite.js (procedural art.js figures until those are ready).
import { DISTRICTS, HERO } from './data.js';
import { drawHumanoid, pose, npcLook, HERO_LOOK, glow } from './art.js';
import { clamp, pick, rand, chance, $ } from './util.js';
import { RNG } from './rng.js';
import { sfx } from './sfx.js';
import { banner, toast } from './ui.js';
import { comic } from './comic.js';
import { quality } from './settings.js';
import { heroReady, HeroSprite } from './hero3d.js';
import { Stage, INK } from './brawlstage.js';
import { frame as spriteFrame, spriteBudget, prewarm, inkOutline, SPAN, LIFT, LOOKS } from './brawlsprite.js';

const EN = {
  thug:     { hp: 30, spd: 120, dmg: 7, reach: 70, name: 'THUG' },
  knife:    { hp: 24, spd: 165, dmg: 9, reach: 64, name: 'SLASHER' },
  brute:    { hp: 75, spd: 85, dmg: 14, reach: 86, name: 'BRUTE' },
  gunman:   { hp: 26, spd: 110, dmg: 12, reach: 60, ranged: true, name: 'DIRTY COP' },
  arsonist: { hp: 26, spd: 125, dmg: 8, reach: 66, name: 'FIREBUG' },
  boss:     { hp: 260, spd: 115, dmg: 16, reach: 96, boss: true, name: 'BOSS' },
};
const DZ = 0.11;  // depth tolerance for hits
const M = 54;
const HERO_SCALE = 1.12; // the star reads a head taller than the crooks
const CROOK_SCALE = 0.95;     // world units per metre (sprites are authored in metres)
const BREAK = { can: { w: 34, h: 50 }, crate: { w: 44, h: 44 }, barrel: { w: 36, h: 52 }, newsbox: { w: 30, h: 46 } };

export class Brawler {
  constructor(g) { this.g = g; }

  enter({ zone }) {
    const g = this.g;
    this.zone = zone;
    this.D = DISTRICTS[zone.district];
    this.fire = zone.variant === 'fire';
    this.done = false;
    this.t = 0;
    this.shake = 0; this.shakeDir = 0;
    this.hitstop = 0; this.slow = 0; this.zoom = 0; this.flash = 0; this.redFlash = 0;
    this.hits = 0; this.hitT = 9; this.hitPop = 0; this.best = 0;
    this.cut = null;
    this.fx = [];
    this.bullets = [];
    this.enemies = [];
    this.captives = [];
    this.fires = [];
    this.breakables = [];
    this.pickups = [];
    this.rng = new RNG(zone.uid * 7919 + 13);
    const diff = zone.diff || 1;
    const nWaves = this.fire ? 2 : Math.min(4, 1 + diff);
    this.waves = [];
    for (let i = 0; i < nWaves; i++) {
      const x = 360 + i * 640;
      // More bodies per wave (same stats each); only a few attack at once, the rest circle and wait.
      const n = this.fire ? 2 + i : Math.min(8, 3 + diff + i);
      const list = [];
      for (let j = 0; j < n; j++) list.push(pick(zone.def.enemies));
      if (i === nWaves - 1 && zone.boss) list.push('boss');
      this.waves.push({ x, list, queue: [], spawned: false, cleared: false, next: 0, n: 0 });
    }
    this.len = this.waves[nWaves - 1].x + 600;
    const nCap = zone.def.captives || 0;
    for (let i = 0; i < nCap; i++) {
      const x = 420 + ((this.len - 740) * (i + 0.6)) / nCap;
      const c = { x, z: rand(0.15, 0.45), freed: 0, done: false, run: 0, look: zone.id === 'rustlers' ? npcLook('farmer') : npcLook('civilian') };
      this.captives.push(c);
      if (this.fire) this.fires.push({ x: x - 110, z: c.z + 0.1, w: 150, hp: 100 });
    }
    if (this.fire) for (let i = 0; i < 2; i++) this.fires.push({ x: 800 + i * 700, z: rand(0.3, 0.8), w: 130, hp: 100 });
    // breakables: a couple per stretch of street, kept clear of captives
    const kinds = this.D.style === 'docks' || this.D.style === 'warehouses' || this.D.style === 'factory' ? ['barrel', 'crate', 'barrel'] : this.D.style === 'farm' ? ['crate', 'barrel'] : ['can', 'can', 'crate', 'newsbox'];
    for (let x = 470; x < this.len - 200; x += this.rng.range(230, 380)) {
      if (this.captives.some((c) => Math.abs(c.x - x) < 90)) continue;
      this.breakables.push({ x, z: this.rng.range(0.1, 0.85), kind: this.rng.pick(kinds), broken: false, wob: 0 });
    }

    this.p = { x: 400, z: 0.5, y: 0, vy: 0, hp: 100, en: 100, facing: 1, st: 'idle', st_t: 0, combo: 0, queued: false, inv: 0, hitSet: new Set() };
    this.cam = 0;
    this.lock = null;
    this.geom();
    this.stage = new Stage(this);
    this.types = [...new Set([...zone.def.enemies, ...(zone.boss ? ['boss'] : [])])].filter((t) => LOOKS[t]);
    // Bake the crooks' sprites up front, behind the zone transition (~0.1 s on a phone GPU); anything
    // left over trickles in during the banner.
    this.warm = this.bossWarm = false;
    spriteBudget(quality().id === 'saver' ? 250 : 900);
    this.warm = prewarm(this.types.filter((t) => t !== 'boss'));

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

  /** Screen geometry: bigger fighters than a flat side view, lane in the lower half. */
  geom() {
    const H = this.g.h;
    // fighters ~35% of the screen tall, feet in the 66–90% band; the strip below is foreground
    this.k = H / 250;
    this.gt = H * 0.66;
    this.gb = H * 0.9;
  }

  get viewHalf() { return this.g.w / 2 / this.k; }
  gy(z) { return this.gt + z * (this.gb - this.gt); }
  sc(z) { return this.k * (0.74 + 0.36 * z); }
  sx(x) { return this.g.w / 2 + (x - this.cam) * this.k; }

  /** World (x, depth z, height y) → screen pixels, matching render(). */
  screenOf(x, z, y = 0) { return { x: this.sx(x), y: this.gy(z) - y * this.sc(z) }; }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (this.done) return;
    const g = this.g;
    this.geom();
    // presentation timers run in real time, even through hit-stop
    this.zoom = Math.max(0, this.zoom - dt * 0.25);
    this.flash = Math.max(0, this.flash - dt * 5);
    this.redFlash = Math.max(0, this.redFlash - dt * 2.5);
    this.hitPop = Math.max(0, this.hitPop - dt * 5);
    this.hitT += dt;
    if (this.hitT > 2.2 && this.hits) { this.hits = 0; }
    if (this.cut) { this.cut.t += dt; if (this.cut.t > 0.5) this.cut = null; }
    if (this.hitstop > 0) { this.hitstop -= dt; this.tickFx(dt * 0.35); return; }
    if (this.slow > 0) { this.slow -= dt; dt *= 0.35; }
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    const p = this.p, vh = this.viewHalf;

    // camera & wave locks
    for (const w of this.waves) {
      if (!w.spawned && !this.lock && p.x > w.x - 120 && this.t > 0.6) {
        w.spawned = true;
        this.lock = w;
        // first few pile in now, the rest are reinforcements that arrive as the crowd thins
        w.queue = w.list.slice();
        const first = Math.min(w.queue.length, 4);
        for (let i = 0; i < first; i++) this.spawnEnemy(w.queue.shift(), w, i);
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
        }, 1100);
      }
    }
    if (this.lock) {
      const w = this.lock;
      const alive = this.enemies.filter((e) => e.wave === w && !e.dead).length;
      w.next -= dt;
      if (w.queue.length && alive < 3 && w.next <= 0) { this.spawnEnemy(w.queue.shift(), w, w.n); w.next = 0.7; }
      if (!w.queue.length && alive === 0) {
        w.cleared = true; this.lock = null; this.goT = 3; sfx.pickup();
        const s = this.screenOf(p.x, p.z, 115);
        this.g.commentary.heroQuip(s.x, s.y);
      }
    }
    const camTarget = this.lock ? clamp(this.lock.x + 80, vh, this.len - vh) : clamp(p.x + 110, vh, this.len - vh);
    this.cam += (camTarget - this.cam) * Math.min(1, dt * 4);
    if (!this.camInit) { this.cam = camTarget; this.camInit = true; }
    this.goT = Math.max(0, (this.goT || 0) - dt);

    this.updatePlayer(dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.separate(dt);
    this.enemies = this.enemies.filter((e) => !(e.dead && e.st_t > 1.0));
    this.updateBullets(dt);
    this.updateCaptivesAndFires(dt);
    this.updatePickups(dt);
    this.tickFx(dt);
    p.en = Math.min(100, p.en + dt * 9);

    this.updateObjectives();
    if (p.hp <= 0 && p.st === 'down' && p.st_t > 1.4) return this.finish(false);
    if (this.objectivesDone() && p.x > this.len - 180) return this.finish(true);
  }

  tickFx(dt) {
    for (const f of this.fx) {
      f.t += dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      if (f.g) { f.vy -= f.g * dt; if (f.y < 0) { f.y = 0; f.vy = -f.vy * 0.35; f.vx *= 0.6; } }
      if (f.spin) f.rot = (f.rot || 0) + f.spin * dt;
    }
    this.fx = this.fx.filter((f) => f.t < f.max);
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
    const targetYaw = moving ? Math.atan2(a.x, a.y) : (p.facing > 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4);
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
      if (grounded && !busy) {
        const nst = Math.hypot(a.x, a.y) > 0.15 ? 'walk' : 'idle';
        if (nst === 'walk' && p.st !== 'walk') this.dust(p.x - p.facing * 14, p.z, 2);
        p.st = nst;
      }
    }
    // keep inside the camera view (and the level)
    p.x = clamp(p.x, this.cam - vh + 30, Math.min(this.cam + vh - 30, this.len - 40));

    // jump
    if (inp.pressed('jump') && grounded && !busy) { p.vy = 560; p.y = 0.01; sfx.whoosh(); this.dust(p.x, p.z, 3); }
    if (p.y > 0) {
      p.vy -= 1500 * dt; p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; if (p.st === 'flykick') p.st = 'idle'; this.dust(p.x, p.z, 4); }
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
          this.aimSpecial(300); p.st = 'breath'; p.st_t = 0; p.en -= 15; sfx.breath();
          this.superMove('frost');
          const s = this.screenOf(p.x + p.facing * 90, p.z, 90);
          this.g.commentary.frost(s.x, s.y);
        }
        else toast('Not enough power', 'bad');
      } else if (p.en >= 30) { this.aimSpecial(760); p.st = 'beam'; p.st_t = 0; p.en -= 30; p.hitSet.clear(); sfx.beam(); this.superMove('heat'); }
      else toast('Not enough power', 'bad');
    }
    if ((p.st === 'beam' || p.st === 'breath') && p.aimZ != null) p.z += (p.aimZ - p.z) * Math.min(1, dt * 14); // aim assist onto the lane of the pack
    if (p.st === 'beam') {
      this.shake = Math.max(this.shake, 3.5);
      if (p.st_t > 0.1) for (const e of this.enemies) {
        if (e.dead || p.hitSet.has(e)) continue;
        const dx = (e.x - p.x) * p.facing;
        if (dx > 0 && dx < 760 && Math.abs(e.z - p.z) < DZ * 1.3) {
          if (!p.hitSet.size) { const s = this.screenOf(e.x, e.z, 85); this.g.commentary.beam(s.x, s.y); }
          p.hitSet.add(e); this.damage(e, 24, true, true);
          e.scorch = 1.6; e.vx = p.facing * 520; e.vy = 360; // scorched and blasted off their feet
          for (let i = 0; i < 6; i++) this.fx.push({ kind: 'smoke', x: e.x + rand(-14, 14), y: rand(50, 100), z: e.z, vy: rand(40, 90), vx: rand(-30, 30), t: 0, max: rand(0.8, 1.4), r: rand(8, 14), dark: true });
        }
      }
      if (p.st_t > 0.1) for (const b of this.breakables) {
        const dx = (b.x - p.x) * p.facing;
        if (!b.broken && dx > 0 && dx < 760 && Math.abs(b.z - p.z) < DZ * 1.3) this.smash(b, p.facing);
      }
      if (p.st_t > 0.85) p.st = 'idle'; // (hits land once per beam; the tail is the burn-out)
    }
    if (p.st === 'breath') {
      for (const f of this.fires) {
        const dx = (f.x - p.x) * p.facing;
        if (dx > -f.w / 2 && dx < 300 && Math.abs(f.z - p.z) < 0.26 && f.hp > 0) {
          f.hp -= dt * 110;
          if (f.hp <= 0) { f.hp = 0; sfx.pickup(); this.fx.push({ kind: 'text', x: f.x, y: 120, z: f.z, t: 0, max: 1.2, txt: 'EXTINGUISHED!', col: '#9fe8ff', vy: 40 }); for (let i = 0; i < 10; i++) this.fx.push({ kind: 'smoke', x: f.x + rand(-60, 60), y: rand(10, 50), z: f.z, vy: rand(30, 70), vx: rand(-20, 20), t: 0, max: rand(1, 1.8), r: rand(14, 26) }); }
        }
      }
      for (const e of this.enemies) {
        const dx = (e.x - p.x) * p.facing;
        if (!e.dead && dx > 0 && dx < 280 && Math.abs(e.z - p.z) < 0.2 && e.st !== 'frozen') { e.st = 'frozen'; e.st_t = 0; }
      }
      if (chance(0.9)) this.fx.push({ kind: 'frost', x: p.x + p.facing * 40, y: 82, z: p.z, vx: p.facing * rand(380, 540), vy: rand(-40, 30), t: 0, max: 0.55, r: rand(0.7, 1.3) });
      if (p.st_t > 0.9) p.st = 'idle';
    }
  }

  startAttack(n) {
    const p = this.p;
    p.st = 'attack'; p.st_t = 0; p.combo = n; p.queued = false; p.hitSet.clear();
    p.x += p.facing * (n === 3 ? 10 : 5); // step into the blow
    sfx.whoosh();
  }

  playerHits(reach, dmg, knock) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead || p.hitSet.has(e) || e.st === 'down' || e.st === 'getup' || (e.st === 'enter' && e.y > 30)) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx > -10 && dx < reach * (e.def.boss ? 1.2 : 1) && Math.abs(e.z - p.z) < DZ && Math.abs(e.y - p.y) < 60) {
        p.hitSet.add(e);
        this.damage(e, dmg, knock);
      }
    }
    for (const b of this.breakables) {
      if (b.broken || p.hitSet.has(b)) continue;
      const dx = (b.x - p.x) * p.facing;
      if (dx > -10 && dx < reach + 10 && Math.abs(b.z - p.z) < DZ * 1.2 && p.y < 60) { p.hitSet.add(b); this.smash(b, p.facing); }
    }
  }

  /** Special move kick-off: freeze-frame, darkened world and a comic cut-in panel. */
  /**
   * Specials turn to face the heaviest crowd (closer and in-lane counts more) and slide onto the lane
   * of the nearest target, so the beam never fires down an empty street.
   */
  aimSpecial(range) {
    const p = this.p;
    const score = [0, 0];
    let best = null, bd = 1e9;
    const targets = this.enemies.filter((e) => !e.dead && e.st !== 'enter').map((e) => ({ x: e.x, z: e.z }));
    if (this.fire) for (const f of this.fires) if (f.hp > 0) targets.push({ x: f.x, z: f.z, fire: true });
    for (const t of targets) {
      const dx = t.x - p.x, adx = Math.abs(dx);
      if (adx > range * 1.2) continue;
      const w = (1 / (1 + adx / 250)) * (Math.abs(t.z - p.z) < 0.25 ? 1 : 0.45) * (t.fire ? 1.5 : 1);
      score[dx >= 0 ? 1 : 0] += w;
    }
    if (score[0] || score[1]) p.facing = score[1] >= score[0] ? 1 : -1;
    for (const t of targets) {
      const dx = (t.x - p.x) * p.facing;
      if (dx > 0 && dx < range && Math.abs(t.z - p.z) < 0.3 && dx + Math.abs(t.z - p.z) * 900 < bd) { bd = dx + Math.abs(t.z - p.z) * 900; best = t; }
    }
    p.aimZ = best ? clamp(best.z, 0.04, 1) : null;
  }

  superMove(kind) {
    this.cut = { t: 0, kind };
    this.hitstop = 0.3; // the super freeze: world holds while the cut-in slams across
    // a near-frontal portrait for the cut-in panel (guard pose), rendered once per special
    if (this.sprite) {
      const H = this.sprite.hero;
      H.pose('punch', 1.2);
      const img = this.sprite.render({ view: 'side', yaw: 0.5, span: 2.6, lift: 0.12 });
      if (!this.cutImg) { this.cutImg = document.createElement('canvas'); this.cutImg.width = img.width; this.cutImg.height = img.height; }
      const g = this.cutImg.getContext('2d'); g.clearRect(0, 0, img.width, img.height); g.drawImage(img, 0, 0);
      this.heroSt = null; // force her world sprite to re-render next frame
    }
    this.zoom = Math.max(this.zoom, 0.05);
    this.flash = 0.5;
  }

  damage(e, dmg, knock, silent = false) {
    const p = this.p;
    e.hp -= dmg;
    sfx.hit();
    const heavy = knock || e.hp <= 0;
    if (!silent) {
      const s = this.screenOf(e.x, e.z, 80 * (e.look.size || 1));
      this.g.commentary.hit(s.x, s.y, { big: heavy });
    }
    // juice: freeze, shake along the blow, zoom punch, white flash on the victim, spark, number
    this.hitstop = Math.max(this.hitstop, heavy ? 0.09 : 0.05);
    this.shake = Math.max(this.shake, heavy ? 9 : 4.5); this.shakeDir = p.facing;
    if (heavy) this.zoom = Math.max(this.zoom, 0.025);
    e.flash = 0.12; e.barT = 3;
    const hy = 72 + rand(-12, 10) + (p.y > 0 ? 10 : 0);
    this.fx.push({ kind: 'spark', x: e.x - p.facing * 12, y: hy, z: e.z + 0.001, t: 0, max: heavy ? 0.26 : 0.18, big: heavy, rot: rand(0, 6) });
    if (heavy) this.fx.push({ kind: 'ring', x: e.x - p.facing * 12, y: hy, z: e.z, t: 0, max: 0.3 });
    for (let i = 0; i < (heavy ? 7 : 4); i++) {
      const an = rand(-0.9, 0.9) + (p.facing > 0 ? 0 : Math.PI);
      this.fx.push({ kind: 'streak', x: e.x - p.facing * 10, y: hy, z: e.z, vx: Math.cos(an) * rand(300, 600), vy: Math.sin(an) * rand(200, 500), t: 0, max: 0.2 });
    }
    this.fx.push({ kind: 'num', x: e.x + rand(-10, 10), y: 128 * (e.look.size || 1), z: e.z, t: 0, max: 0.8, txt: String(dmg), big: heavy, vy: 90, vx: -p.facing * 30 });
    this.hits++; this.hitT = 0; this.hitPop = 1; this.best = Math.max(this.best, this.hits);
    if (this.hits === 10 || this.hits === 25 || this.hits === 50) {
      const s = this.screenOf(p.x, p.z, 150);
      comic.pow(this.hits >= 50 ? 'UNSTOPPABLE!' : this.hits >= 25 ? 'AMAZING!' : 'GREAT!', s.x, s.y, { size: 1.1, colors: ['#ffe600', '#1e3cff'] });
    }
    e.facing = -p.facing;
    if (e.hp <= 0 || (knock && !e.def.boss) || (knock && e.def.boss && chance(0.35))) {
      e.st = 'down'; e.st_t = 0; e.landed = false; e.bounced = false;
      e.vx = p.facing * (e.def.boss ? 180 : 380); e.vy = e.hp <= 0 ? 330 : 280; e.y = Math.max(e.y, 1);
      if (e.hp <= 0) {
        e.ko = true;
        const last = this.lock && e.wave === this.lock && !this.lock.queue.length && this.enemies.every((o) => o === e || o.wave !== this.lock || o.dead || o.hp <= 0);
        if (last) { this.slow = 0.7; this.zoom = 0.07; this.flash = 0.6; this.hitstop = 0.16; const s = this.screenOf(e.x, e.z, 110); comic.pow('K.O.!', s.x, s.y, { size: 1.5, colors: ['#ffe600', '#ff2d2d'] }); }
      }
    } else { e.st = 'hurt'; e.st_t = 0; e.x += p.facing * 16; }
  }

  smash(b, dir) {
    b.broken = true; b.t = 0;
    sfx.hit(); this.shake = Math.max(this.shake, 5); this.hitstop = Math.max(this.hitstop, 0.04);
    const cols = { can: ['#8a949c', '#5c666e', '#3a3a40'], crate: ['#b07a44', '#8a5a2c', '#6a4420'], barrel: ['#c0392b', '#8a2a20', '#333'], newsbox: ['#1e3cff', '#dfe8f0', '#152a9a'] }[b.kind];
    for (let i = 0; i < 9; i++) this.fx.push({ kind: 'chunk', x: b.x + rand(-12, 12), y: rand(10, 40), z: b.z, vx: dir * rand(60, 300) + rand(-80, 80), vy: rand(220, 480), g: 1400, t: 0, max: rand(0.8, 1.3), spin: rand(-14, 14), col: pick(cols), s: rand(5, 10) });
    if (b.kind === 'can') for (let i = 0; i < 4; i++) this.fx.push({ kind: 'chunk', x: b.x, y: 30, z: b.z, vx: rand(-120, 120), vy: rand(150, 320), g: 1300, t: 0, max: 1.1, spin: rand(-8, 8), col: pick(['#e8e0c0', '#6a8a3a', '#c9c2a8']), s: rand(3, 6) });
    this.dust(b.x, b.z, 5);
    const s = this.screenOf(b.x, b.z, 60);
    comic.pow(pick(['CRASH!', 'SMASH!', 'KRAK!']), s.x, s.y, { size: 0.8, colors: ['#ffffff', '#ff9a1f'] });
    // Gauntlet-style loot: roast chicken restores health, a power cell tops up the special.
    const r = Math.random();
    if (r < 0.4) this.pickups.push({ x: b.x, z: b.z, kind: 'food', t: 0 });
    else if (r < 0.65) this.pickups.push({ x: b.x, z: b.z, kind: 'power', t: 0 });
  }

  updatePickups(dt) {
    const p = this.p;
    for (const k of this.pickups) {
      k.t += dt;
      if (!k.got && k.t > 0.35 && Math.abs(k.x - p.x) < 34 && Math.abs(k.z - p.z) < 0.1 && p.y < 30) {
        k.got = true; sfx.pickup();
        if (k.kind === 'food') { p.hp = Math.min(100, p.hp + 20); this.fx.push({ kind: 'text', x: p.x, y: 140, z: p.z, t: 0, max: 1, txt: '+20 HEALTH', col: '#3ee08a', vy: 60 }); }
        else { p.en = Math.min(100, p.en + 35); this.fx.push({ kind: 'text', x: p.x, y: 140, z: p.z, t: 0, max: 1, txt: '+POWER', col: '#39c6ff', vy: 60 }); }
      }
    }
    this.pickups = this.pickups.filter((k) => !k.got && k.t < 20);
  }

  dust(x, z, n = 3) {
    for (let i = 0; i < n; i++) this.fx.push({ kind: 'dust', x: x + rand(-14, 14), y: rand(2, 8), z, vx: rand(-60, 60), vy: rand(10, 40), t: 0, max: rand(0.35, 0.6), r: rand(7, 13) });
  }

  spawnEnemy(type, wave, i) {
    const vh = this.viewHalf, side = i % 2 === 0 ? 1 : -1;
    const cx = clamp(wave.x + 80, vh, this.len - vh);
    const def = { ...EN[type] };
    if (def.boss) def.name = (this.zone.boss || 'BOSS').toUpperCase();
    const look = type === 'boss' ? npcLook('boss') : npcLook(type);
    const tz = rand(0.15, 0.95);
    const e = {
      type, def, look, wave, x: cx + side * (vh + 60 + (i % 4) * 40), z: tz, y: 0, vy: 0, vx: 0,
      hp: def.hp, max: def.hp, facing: -side, st: 'enter', st_t: 0, cd: rand(0.6, 1.5), dead: false,
      phase: rand(0, 1), flash: 0, barT: 0, entry: 'run', tx: cx + side * rand(120, vh - 60), tz,
    };
    wave.n++;
    // entrances: run in from the edge, drop from a fire escape, or step out of a doorway
    const roll = (i + wave.n) % 3;
    if (type !== 'boss' && roll === 1 && this.D.style !== 'farm') {
      e.entry = 'drop'; e.x = cx + side * rand(60, vh - 80); e.y = 360; e.vy = 0;
    } else if (type !== 'boss' && roll === 2) {
      const d = this.stage.doorNear(cx + side * rand(0, vh - 80), vh * 0.8);
      if (d != null) { e.entry = 'door'; e.x = d; e.z = 0.0; e.alpha = 0; }
    }
    this.enemies.push(e);
    if (type === 'boss') { $('boss-wrap').style.display = 'block'; $('boss-name').textContent = this.zone.boss; }
  }

  updateEnemy(e, dt) {
    const p = this.p;
    e.st_t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.barT = Math.max(0, e.barT - dt);
    if (e.scorch > 0) { e.scorch -= dt; if (chance(dt * 8)) this.fx.push({ kind: 'smoke', x: e.x + rand(-10, 10), y: rand(20, 70), z: e.z, vy: rand(30, 60), vx: rand(-15, 15), t: 0, max: 0.9, r: rand(6, 10), dark: true }); }
    const x0 = e.x, z0 = e.z;
    if (e.dead) return;
    if (e.st !== 'enter' && (e.y > 0 || e.vy)) {
      e.vy -= 1500 * dt; e.y += e.vy * dt;
      if (e.y <= 0) {
        // knocked-down bodies bounce once, kick up dust and shake the street
        if (e.st === 'down' && !e.bounced && e.vy < -250) { e.bounced = true; e.vy = 170; e.y = 0.01; this.dust(e.x, e.z, 5); this.shake = Math.max(this.shake, 4); sfx.punch(); }
        else { e.y = 0; e.vy = 0; if (e.st === 'down' && !e.landed) { e.landed = true; e.lieT = 0; this.dust(e.x, e.z, 3); } }
      }
    }
    if (e.st === 'enter') { this.updateEntrance(e, dt); return; }
    if (e.st === 'down') {
      e.x += e.vx * dt; e.vx *= 1 - dt * (e.landed ? 6 : 1.5);
      // a body flying through the crowd bowls others over
      if (!e.landed && Math.abs(e.vx) > 200) for (const o of this.enemies) {
        if (o === e || o.dead || o.st === 'down' || o.st === 'enter' || o.def.boss) continue;
        if (Math.abs(o.x - e.x) < 34 && Math.abs(o.z - e.z) < 0.09) {
          o.hp -= 4; o.st = 'down'; o.st_t = 0; o.landed = false; o.bounced = false; o.vx = Math.sign(e.vx) * 240; o.vy = 220; o.y = 1; o.flash = 0.12; o.barT = 3; if (o.hp <= 0) o.ko = true;
          this.fx.push({ kind: 'spark', x: o.x, y: 70, z: o.z, t: 0, max: 0.2, big: false, rot: 0 }); sfx.hit();
        }
      }
      if (!e.landed && Math.abs(e.vx) > 150) for (const b of this.breakables) if (!b.broken && Math.abs(b.x - e.x) < 30 && Math.abs(b.z - e.z) < 0.1) this.smash(b, Math.sign(e.vx));
      if (e.landed) {
        e.lieT += dt;
        if (e.lieT > (e.hp <= 0 ? 0.55 : 0.45)) {
          if (e.hp <= 0) {
            e.dead = true; e.st_t = 0;
            this.fx.push({ kind: 'ko', x: e.x, y: 60, z: e.z, t: 0, max: 0.9 });
          } else { e.st = 'getup'; e.st_t = 0; }
        }
      }
      return;
    }
    if (e.st === 'getup') { if (e.st_t > 0.5) { e.st = 'approach'; e.cd = 0.6; } return; }
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
        this.fx.push({ kind: 'muzzle', x: e.x + e.facing * 44, y: 76, z: e.z, t: 0, max: 0.08, dir: e.facing });
        sfx.punch();
        e.st = 'approach'; e.cd = rand(1.4, 2.4);
      }
    } else if (e.st === 'charge') {
      if (e.st_t < 0.6) return; // telegraph
      e.x += e.facing * 640 * dt;
      if (chance(dt * 20)) this.dust(e.x - e.facing * 20, e.z, 1);
      if (!e.hit && Math.abs(p.x - e.x) < 60 && Math.abs(e.z - p.z) < DZ * 1.2 && p.y < 40) { e.hit = true; this.hurtPlayer(20, e.facing, true); }
      if (e.st_t > 1.2) { e.st = 'approach'; e.cd = 1.2; e.hit = false; }
    }
    const vh = this.viewHalf;
    if (this.lock) e.x = clamp(e.x, this.cam - vh - 80, this.cam + vh + 80);
    e.moving = Math.hypot(e.x - x0, (e.z - z0) * 300) > 30 * dt;
    if (e.moving) e.phase += dt * (e.def.spd > 140 ? e.def.spd / 125 : e.def.spd / 80);
  }

  /** Walk/drop/door entrances: they can't attack until they've arrived. */
  updateEntrance(e, dt) {
    const p = this.p;
    if (e.entry === 'drop') {
      e.vy -= 1500 * dt; e.y += e.vy * dt;
      e.facing = Math.sign(p.x - e.x) || 1;
      if (e.y <= 0) { e.y = 0; e.vy = 0; this.dust(e.x, e.z, 6); this.shake = Math.max(this.shake, 5); sfx.punch(); e.st = 'approach'; e.st_t = 0; e.cd = rand(0.5, 1); e.landT = 0.25; }
      return;
    }
    if (e.entry === 'door') {
      e.alpha = Math.min(1, e.st_t / 0.4);
      e.facing = Math.sign(p.x - e.x) || 1;
      e.z += 0.55 * dt; e.moving = true; e.phase += dt * 1.4;
      if (e.z >= e.tz) { e.z = e.tz; e.st = 'approach'; e.st_t = 0; }
      return;
    }
    const dx = e.tx - e.x;
    e.facing = Math.sign(dx) || 1;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), e.def.spd * 1.7 * dt);
    e.moving = true; e.phase += dt * 2;
    if (Math.abs(dx) < 6 || e.st_t > 3) { e.st = 'approach'; e.st_t = 0; }
  }

  /** Keep the crowd from stacking into one sprite: gentle push apart along the street. */
  separate(dt) {
    const L = this.enemies;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.dead || b.dead || a.st === 'down' || b.st === 'down') continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      if (Math.abs(dx) < 38 && Math.abs(dz) < 0.07) {
        const push = (38 - Math.abs(dx)) * 3 * dt * (dx >= 0 ? 1 : -1);
        a.x -= push; b.x += push;
        const pz = 0.2 * dt * (dz >= 0 ? 1 : -1);
        a.z = clamp(a.z - pz, 0.04, 1); b.z = clamp(b.z + pz, 0.04, 1);
      }
    }
  }

  hurtPlayer(dmg, dir, knock = false) {
    const p = this.p;
    if (p.inv > 0 || p.god || p.st === 'down') return; // god: harness-only (tools/shots)
    p.hp = Math.max(0, p.hp - dmg);
    p.inv = 0.5;
    sfx.hurt();
    this.shake = 8; this.shakeDir = dir; this.redFlash = 0.5; this.hitstop = Math.max(this.hitstop, 0.06);
    p.flash = 0.12;
    { const s = this.screenOf(p.x, p.z, 90); this.g.commentary.hurt(s.x, s.y); }
    this.fx.push({ kind: 'spark', x: p.x - dir * 8, y: 74, z: p.z + 0.001, t: 0, max: 0.2, hurt: true, rot: rand(0, 6) });
    if (p.hp <= 0 || knock) { p.st = 'down'; p.st_t = 0; p.x += dir * 30; this.dust(p.x, p.z, 4); if (p.hp <= 0) { sfx.lose(); banner('DOWN!', '', '#ff4d6a'); } }
    else { p.st = 'hurt'; p.st_t = 0; p.x += dir * 18; }
  }

  updateBullets(dt) {
    const p = this.p;
    for (const b of this.bullets) {
      b.t += dt; b.x += b.vx * dt;
      if (!b.gone && Math.abs(b.x - p.x) < 24 && Math.abs(b.z - p.z) < 0.07 && p.y < 50) {
        b.gone = true;
        // Heroine can swat bullets away mid-punch.
        if (p.st === 'attack' && Math.sign(b.vx) === -p.facing) { sfx.hit(); this.fx.push({ kind: 'text', x: p.x, y: 130, z: p.z, t: 0, max: 0.8, txt: 'DEFLECT!', col: '#9fe8ff', vy: 60 }); this.fx.push({ kind: 'spark', x: p.x + p.facing * 20, y: 76, z: p.z, t: 0, max: 0.18, rot: 0 }); }
        else this.hurtPlayer(12, Math.sign(b.vx));
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone && b.t < 2);
  }

  updateCaptivesAndFires(dt) {
    const p = this.p;
    for (const f of this.fires) {
      if (f.hp <= 0) continue;
      if (chance(dt * 6)) this.fx.push({ kind: 'ember', x: f.x + rand(-f.w / 2, f.w / 2), y: rand(20, 60), z: f.z, vx: rand(-20, 20), vy: rand(60, 140), t: 0, max: rand(0.6, 1.2) });
      if (Math.abs(p.x - f.x) < f.w / 2 && Math.abs(p.z - f.z) < 0.14 && p.y < 30 && p.inv <= 0) {
        p.hp = Math.max(0, p.hp - dt * 18);
        if (chance(dt * 4)) this.fx.push({ kind: 'text', x: p.x, y: 130, z: p.z, t: 0, max: 0.6, txt: 'HOT!', col: '#ff9a3a', vy: 60 });
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
          this.fx.push({ kind: 'text', x: c.x, y: 140, z: c.z, t: 0, max: 1.2, txt: 'SAVED!', col: '#3ee08a', vy: 50 });
          const s = this.screenOf(c.x, c.z, 100);
          comic.say(pick(['My hero!', 'Thank you!', 'You saved me!']), s.x, s.y, { kind: 'speech', speaker: 'CITIZEN', ms: 1600 });
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
      banner('SAVED THE DAY!', this.best >= 10 ? `Best combo: ${this.best} hits` : '', '#3ee08a');
      setTimeout(() => this.g.endZone(z, { outcome: 'win', rep: z.reward + saved * 3, saved, photo: this.fire ? 'fire' : 'hero' }), 1200);
    } else {
      setTimeout(() => this.g.endZone(z, { outcome: 'lose', rep: -8, text: `${HERO} was overwhelmed and had to retreat. The crooks got away this time.` }), 600);
    }
  }

  abort() { this.done = true; this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.g, W = g.w, H = g.h;
    this.geom();
    const k = this.k;
    const night = g.state.night;
    // sprite bakes: a burst while the first wave piles in, then a trickle
    // Sprite bakes: a big burst while the banner plays and the first wave piles in, then ~one per frame.
    // The boss (a heavy model) is baked on the walk between waves, never mid-fight.
    spriteBudget(this.t < 3 ? 45 : 3);
    if (!this.warm) this.warm = prewarm(this.types.filter((t) => t !== 'boss'));
    else if (!this.bossWarm && this.types.includes('boss') && !this.lock) this.bossWarm = prewarm(['boss']);
    ctx.save();
    if (this.shake > 0) {
      const s = this.shake;
      ctx.translate(this.shakeDir * rand(-s, s) * 0.6 + rand(-s, s) * 0.5, rand(-s, s) * 0.7);
    }
    if (this.zoom > 0) {
      const z = 1 + this.zoom, fp = this.screenOf(this.p.x, this.p.z, 60);
      ctx.translate(fp.x, fp.y); ctx.scale(z, z); ctx.translate(-fp.x, -fp.y);
    }

    this.stage.drawBack(ctx, W, H, this.cam, this.t, night);

    // depth-sorted actors
    const drawables = [];
    for (const f of this.fires) drawables.push({ z: f.z, f });
    for (const c of this.captives) drawables.push({ z: c.z, c });
    for (const e of this.enemies) drawables.push({ z: e.z, e });
    for (const b of this.breakables) if (!b.broken) drawables.push({ z: b.z, b });
    for (const q of this.pickups) drawables.push({ z: q.z - 0.001, q });
    drawables.push({ z: this.p.z, p: this.p });
    drawables.sort((a, b) => a.z - b.z);
    // ground shadows first so nobody's shadow falls across someone standing in front
    for (const d of drawables) {
      const o = d.e || d.p || d.c || d.b;
      if (!o || (d.e && d.e.dead && d.e.st_t > 0.6)) continue;
      const lying = d.e && (d.e.st === 'down' && d.e.landed);
      const wide = d.b ? 1.1 : lying ? 2.1 : d.e ? (LOOKS[d.e.type]?.scale || 1) : 1;
      this.drawShadow(ctx, this.sx(o.x), this.gy(o.z), this.sc(o.z), 24 * wide, o.y || 0, d.e && d.e.alpha != null ? d.e.alpha : 1);
    }
    for (const d of drawables) {
      if (d.f) this.drawFire(ctx, d.f, this.sx(d.f.x), this.gy(d.f.z), this.sc(d.f.z));
      else if (d.c) this.drawCaptive(ctx, d.c, this.sx(d.c.x), this.gy(d.c.z), this.sc(d.c.z));
      else if (d.e) this.drawEnemy(ctx, d.e, this.sx(d.e.x), this.gy(d.e.z), this.sc(d.e.z));
      else if (d.b) this.drawBreakable(ctx, d.b, this.sx(d.b.x), this.gy(d.b.z), this.sc(d.b.z));
      else if (d.q) this.drawPickup(ctx, d.q, this.sx(d.q.x), this.gy(d.q.z), this.sc(d.q.z));
      else this.drawPlayer(ctx, this.sx(this.p.x), this.gy(this.p.z), this.sc(this.p.z));
    }
    // bullets: hot tracer streaks
    for (const b of this.bullets) {
      const s = this.sc(b.z), x = this.sx(b.x), y = this.gy(b.z) - 76 * s, d = Math.sign(b.vx);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,190,60,.6)'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - d * 34 * s, y); ctx.lineTo(x, y); ctx.stroke();
      ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 2 * s; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    this.drawFx(ctx);
    this.stage.drawFront(ctx, W, H, this.cam, [this.sx(this.p.x), ...this.enemies.map((e) => this.sx(e.x))]);

    // special move: world dims, beam burns over the top, then the cut-in panel
    if (this.cut || this.p.st === 'beam' || this.p.st === 'breath') {
      const a = this.cut ? Math.min(1, this.cut.t / 0.06) * (this.cut.t > 0.36 ? Math.max(0, 1 - (this.cut.t - 0.36) / 0.14) : 1) : 0;
      const dim = Math.max(a * 0.5, this.p.st === 'beam' || this.p.st === 'breath' ? 0.3 : 0);
      ctx.fillStyle = `rgba(10,4,24,${dim})`; ctx.fillRect(-20, -20, W + 40, H + 40);
      if (this.cut) this.drawSpeedLines(ctx, W, H, a);
    }
    if (this.p.st === 'beam' && this.p.st_t > 0.06) this.drawBeam(ctx);
    ctx.restore();

    this.stage.drawGrade(ctx, W, H, night);
    if (this.redFlash > 0) {
      const r = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
      r.addColorStop(0, 'rgba(255,0,40,0)'); r.addColorStop(1, `rgba(255,0,40,${this.redFlash * 0.7})`);
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, this.flash * 0.8)})`; ctx.fillRect(0, 0, W, H); }
    if (this.cut) this.drawCutIn(ctx, W, H);
    this.drawCombo(ctx, W, H);
    this.drawGo(ctx, W, H);
  }

  drawShadow(ctx, x, y, s, w = 24, air = 0, alpha = 1) {
    const f = Math.max(0.35, 1 - air / 320);
    ctx.globalAlpha = 0.55 * f * alpha;
    const rw = w * s * f * 1.25, rh = 7 * s * f;
    ctx.drawImage(shadowSprite(), x - rw, y - rh, rw * 2, rh * 2);
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx, x, y, s) {
    const p = this.p;
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
    this.inkedHumanoid(ctx, x, y - p.y * s, s, p.facing, { ...HERO_LOOK, cape: HERO_LOOK.cape }, P);
    this.drawSwing(ctx, x, y, s);
  }

  /** Rigged 3D Supergirl rendered side-on as a sprite, clip chosen from the fight state. */
  drawPlayerModel(ctx, x, y, s) {
    const p = this.p;
    if (!this.sprite) this.sprite = new HeroSprite(220, 300);
    // The 3D render + readback is the priciest thing in a frame: animate her at 30 Hz (arcade sprites run
    // slower still), but re-render at once whenever her state changes so hits stay frame-exact.
    const now = performance.now();
    this.heroN = (this.heroN || 0) + 1;
    const due = !this.heroCopy || this.heroN % 2 === 0 || now - (this.heroAt || 0) > 70 || p.st !== this.heroSt || p.combo !== this.heroCombo || p.facing !== this.heroFacing;
    if (due) {
    this.heroAt = now; this.heroSt = p.st; this.heroCombo = p.combo; this.heroFacing = p.facing;
    const H = this.sprite.hero;
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
      case 'beam': case 'breath': H.pose('punch', 1.2); break;
      default:
        // Guard up (fists raised, wide stance, chin up) while crooks are about; the hands-on-hips hero
        // pose when the street is clear. (combatIdle hangs her head: it read as dejected.)
        if (p.y > 0) H.pose('jump', 1.0);
        else if (this.enemies.some((e) => !e.dead && Math.abs(e.x - p.x) < 520)) H.pose('punch', 1.16 + Math.sin(this.t * 3) * 0.04);
        else H.pose('pose', 0.5 + this.t * 0.4);
    }
    // Cape wind: running pushes it out behind her; jumping/falling lifts it.
    const run = p.st === 'walk' ? 7 : p.st === 'attack' || p.st === 'flykick' ? 3 : 0.8;
    H.setWind(Math.sin(this.t * 1.7) * 0.8, p.y > 0 ? (p.vy < 0 ? 9 : -3) : 0.5, -run);
    // Fighting moves always face the enemy side-on; walking uses the smoothed movement heading.
    const sideOn = p.st !== 'walk' && p.st !== 'idle';
    // three-quarter turn toward the viewer (emblem and face read) instead of flat profile
    const q = p.facing > 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4;
    const yaw = sideOn ? q : (p.yaw ?? q);
    const img = this.sprite.render({ view: 'side', yaw, span: 2.6, lift: 0.12 });
    // one readback of the WebGL canvas into 2D, then outline from the copy (each WebGL drawImage is a readback)
    if (!this.heroCopy) { this.heroCopy = document.createElement('canvas'); this.heroCopy.width = img.width; this.heroCopy.height = img.height; this.hcx = this.heroCopy.getContext('2d'); }
    this.hcx.clearRect(0, 0, img.width, img.height); this.hcx.drawImage(img, 0, 0);
    // ink it once per render (not per frame): 3 px outline in sprite pixels, 4 px padding
    if (!this.heroInk) { this.heroInk = document.createElement('canvas'); this.heroInk.width = img.width + 8; this.heroInk.height = img.height + 8; this.hix = this.heroInk.getContext('2d'); }
    this.hix.clearRect(0, 0, this.heroInk.width, this.heroInk.height);
    inkOutline(this.hix, this.heroCopy, img.width, img.height, 3, 4, 4);
    }
    // Sprite frame is 2.6 m tall at 54 units per metre.
    const hpx = 2.6 * M * s * HERO_SCALE, wpx = hpx * (220 / 300);
    const top = y - p.y * s - hpx * (1 - 0.12 / 2.6);
    // hero rim light: a warm back-glow so she pops off the set
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18;
    ctx.drawImage(glow('#ffd070'), x - wpx * 0.5, top + hpx * 0.1, wpx, hpx * 0.8);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hc = this.heroCopy;
    const pk = wpx / 220;
    ctx.drawImage(this.heroInk, x - wpx / 2 - 4 * pk, top - 4 * pk, wpx + 8 * pk, hpx + 8 * pk);
    if (p.flash > 0) { p.flash -= 1 / 60; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(hc, x - wpx / 2, top, wpx, hpx); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    this.drawSwing(ctx, x, y, s);
    if (p.st === 'breath') {
      ctx.fillStyle = 'rgba(200,240,255,.6)';
      ctx.beginPath(); ctx.arc(x + p.facing * 14 * s, y - 88 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Impact smears: a white arc trailing the fist/boot during the active frames. */
  drawSwing(ctx, x, y, s) {
    const p = this.p;
    let u = -1, r = 0, hy = 0, big = false;
    if (p.st === 'attack' && p.st_t > 0.03 && p.st_t < 0.17) { u = (p.st_t - 0.03) / 0.14; big = p.combo === 3; r = (big ? 62 : 50) * s; hy = (big ? 60 : 82) * s; }
    else if (p.st === 'flykick') { u = 0.6; r = 58 * s; hy = 45 * s; big = true; }
    if (u < 0) return;
    const cx = x + p.facing * 6 * s, cy = y - p.y * s - hy;
    const a0 = p.facing > 0 ? -0.9 : Math.PI + 0.9, sweep = 1.5 * p.facing;
    ctx.save();
    ctx.globalAlpha = 0.85 * (1 - u * 0.6);
    ctx.fillStyle = big ? '#fff3b0' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + sweep * (0.35 + u * 0.65), p.facing < 0);
    ctx.arc(cx, cy, r * 0.72, a0 + sweep * (0.35 + u * 0.65), a0, p.facing > 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.globalAlpha *= 0.6; ctx.stroke();
    ctx.restore();
  }

  /** Radial comic speed lines converging on the heroine during the super freeze. */
  drawSpeedLines(ctx, W, H, a) {
    const c = this.screenOf(this.p.x, this.p.z, 90), R = Math.hypot(W, H);
    ctx.save(); ctx.globalAlpha = a * 0.55; ctx.fillStyle = this.cut.kind === 'heat' ? '#fff2d0' : '#e8fbff';
    for (let i = 0; i < 44; i++) {
      const an = i * 0.1428 * Math.PI + (i % 3) * 0.05, w = 0.012 + (i % 4) * 0.006, r0 = R * (0.22 + ((i * 37) % 10) / 40);
      ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * r0, c.y + Math.sin(an) * r0);
      ctx.lineTo(c.x + Math.cos(an - w) * R, c.y + Math.sin(an - w) * R); ctx.lineTo(c.x + Math.cos(an + w) * R, c.y + Math.sin(an + w) * R); ctx.fill();
    }
    ctx.restore();
  }

  drawBeam(ctx) {
    const p = this.p, s = this.sc(p.z) * HERO_SCALE;
    const x = this.sx(p.x), y = this.gy(p.z);
    const ey = y - p.y * s - 90 * s, x0 = x + p.facing * 12 * s, x1 = x + p.facing * 780 * this.k;
    const wob = 1 + Math.sin(this.t * 60) * 0.1, g = Math.min(1, p.st_t / 0.08);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    // orange halo → red body → hot orange → white core, ~3x the old weight
    for (const [w, c] of [[64, 'rgba(255,110,20,.22)'], [40, 'rgba(255,40,20,.5)'], [22, 'rgba(255,150,60,.9)'], [9, '#ffffff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w * s * wob * 0.5 * g;
      ctx.beginPath(); ctx.moveTo(x0, ey); ctx.lineTo(x1, ey + 4 * s); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.drawImage(glow('#ff6030'), x0 - 44 * s, ey - 44 * s, 88 * s, 88 * s);
    ctx.drawImage(glow('#ffffff'), x0 - 14 * s, ey - 14 * s, 28 * s, 28 * s);
    ctx.restore();
    // embers shed along the beam
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ember', x: p.x + p.facing * rand(30, 700), y: 90 + rand(-6, 6), z: p.z, vx: rand(-40, 40), vy: rand(40, 160), t: 0, max: rand(0.4, 0.8) });
    // impact burst wherever it's burning a crook
    for (const e of this.enemies) {
      const dx = (e.x - p.x) * p.facing;
      if (e.dead || dx <= 0 || dx > 780 || Math.abs(e.z - p.z) > DZ * 1.3) continue;
      if (chance(0.6)) this.fx.push({ kind: 'spark', x: e.x - p.facing * 10, y: 88, z: e.z + 0.001, t: 0, max: 0.1, big: true, hot: true, rot: rand(0, 6) });
      if (chance(0.6)) this.fx.push({ kind: 'streak', x: e.x - p.facing * 8, y: 88, z: e.z, vx: -p.facing * rand(100, 300), vy: rand(-100, 300), t: 0, max: 0.2, hot: true });
    }
  }

  drawEnemy(ctx, e, x, y, s) {
    s *= CROOK_SCALE;
    let alpha = e.alpha != null ? e.alpha : 1;
    if (e.dead) alpha *= Math.max(0, 1 - e.st_t / 0.9) * (Math.sin(e.st_t * 40) > 0 ? 1 : 0.35);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const jitter = e.flash > 0 ? rand(-2, 2) * s : 0;
    const fy = y - e.y * s;
    const f = this.enemyFrame(e);
    const scale = e.look.size || 1;
    let head = 108 * scale * s, hand = null;
    if (f) {
      const hpx = SPAN * M * s, wpx = hpx * (f.img.width / f.img.height), top = fy - hpx * (1 - LIFT / SPAN);
      // knocked down: the clip falls face-first, so flip it to fly away from the blow
      const dir = e.st === 'down' || e.st === 'getup' || e.dead ? -e.facing : e.facing;
      const ox = -wpx / 2 - (f.shift || 0) * M * s;
      ctx.save(); ctx.translate(x + jitter, 0); ctx.scale(dir, 1);
      if (e.scorch > 0) ctx.filter = `brightness(${0.35 + (1 - Math.min(1, e.scorch)) * 0.65}) sepia(0.5)`;
      ctx.drawImage(f.img, ox, top, wpx, hpx);
      if (e.scorch > 0) ctx.filter = 'none';
      if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.85; ctx.drawImage(f.img, ox, top, wpx, hpx); ctx.globalCompositeOperation = 'source-over'; }
      if (f.head && f.top) this.drawHeadgear(ctx, e, f, fy, s);
      ctx.restore();
      ctx.globalAlpha = alpha;
      if (f.head) head = (Math.max(f.head[1], f.top ? f.top[1] : 0) + 0.25) * M * s;
      e.drawDir = dir;
      if (f.hand) hand = [x + dir * f.hand[0] * M * s, fy - f.hand[1] * M * s];
    } else {
      let P;
      switch (e.st) {
        case 'wind': P = pose('wind'); break;
        case 'strike': P = pose(e.type === 'brute' || e.type === 'boss' ? 'punch2' : 'punch1'); break;
        case 'hurt': P = pose('hurt'); break;
        case 'down': case 'getup': P = pose('down'); break;
        case 'aim': P = pose('aim'); break;
        case 'charge': P = e.st_t < 0.6 ? pose('wind') : pose('run', this.t); break;
        case 'frozen': P = pose('hurt'); break;
        case 'enter': P = e.entry === 'drop' ? pose('jump') : pose('run', this.t); break;
        default: P = pose(e.moving ? 'walk' : 'idle', this.t + e.x * 0.01);
      }
      if (e.dead) P = pose('down');
      this.inkedHumanoid(ctx, x + jitter, fy, s, e.facing, e.look, P);
      hand = [x + e.facing * 30 * s * scale, fy - 72 * s * scale];
    }
    // held weapons ride the baked hand anchor
    if (hand && !e.dead && e.st !== 'down' && e.st !== 'frozen') {
      const [hx, hy] = hand;
      if (e.type === 'knife') {
        ctx.save(); ctx.translate(hx, hy); ctx.scale(e.facing, 1); ctx.rotate(e.st === 'strike' ? 0 : -0.6);
        ctx.fillStyle = '#e8eef4'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, -1.5 * s); ctx.lineTo(16 * s, -0.5 * s); ctx.lineTo(0, 2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2418'; ctx.fillRect(-6 * s, -1.8 * s, 6 * s, 3.6 * s);
        if (e.st === 'wind' && Math.sin(this.t * 30) > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffffff'), 6 * s, -8 * s, 16 * s, 16 * s); ctx.globalCompositeOperation = 'source-over'; }
        ctx.restore();
      } else if (e.type === 'gunman' || (e.type === 'boss' && e.st === 'aim')) {
        ctx.save(); ctx.translate(hx, hy); ctx.scale(e.facing, 1);
        ctx.fillStyle = '#1c1c22'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(-2 * s, -3 * s, 15 * s, 4.5 * s); ctx.fillRect(-2 * s, -3 * s, 4 * s, 9 * s);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, -2.6 * s, 12 * s, 1.2 * s);
        ctx.restore();
      } else if (e.type === 'arsonist') {
        ctx.save(); ctx.translate(hx, hy);
        ctx.fillStyle = '#4a8a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.fillRect(-3 * s, -9 * s, 6 * s, 12 * s); ctx.strokeRect(-3 * s, -9 * s, 6 * s, 12 * s);
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ff8a30'), -9 * s, -24 * s, 18 * s, 18 * s);
        ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.ellipse(0, -13 * s + Math.sin(this.t * 20) * s, 2.4 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    if (e.st === 'frozen') {
      const hh = 112 * scale * s;
      ctx.fillStyle = 'rgba(170,230,255,.45)'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 26 * s, y); ctx.lineTo(x - 30 * s, y - hh * 0.6); ctx.lineTo(x - 18 * s, y - hh); ctx.lineTo(x + 22 * s, y - hh * 1.02); ctx.lineTo(x + 30 * s, y - hh * 0.5); ctx.lineTo(x + 26 * s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(x - 16 * s, y - hh * 0.8); ctx.lineTo(x - 8 * s, y - hh * 0.3); ctx.stroke();
    }
    // wind-up tell: a red "!" and a flash glint
    if ((e.st === 'wind' || (e.st === 'charge' && e.st_t < 0.6) || e.st === 'aim') && Math.sin(this.t * 30) > -0.3) {
      const ty = fy - head - 18 * s;
      ctx.font = `900 ${26 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('!', x, ty); ctx.fillStyle = '#ff3030'; ctx.fillText('!', x, ty);
    }
    if (e.st === 'aim') {
      ctx.strokeStyle = 'rgba(255,40,40,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      const ay = hand ? hand[1] : fy - 72 * s;
      ctx.beginPath(); ctx.moveTo(x + e.facing * 30 * s, ay); ctx.lineTo(x + e.facing * 700 * this.k, ay); ctx.stroke(); ctx.setLineDash([]);
    }
    // health tag (SoR style): name + inked bar, shown for a while after taking a hit
    if (!e.def.boss && !e.dead && (e.barT > 0 || e.hp < e.max) && e.st !== 'enter') {
      const bw = 46 * s, bx = x - bw / 2, by = fy - head - 8 * s;
      ctx.fillStyle = INK; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, 5 * s + 3);
      ctx.fillStyle = '#5a1020'; ctx.fillRect(bx, by, bw, 5 * s);
      ctx.fillStyle = e.hp / e.max > 0.35 ? '#ffd23f' : '#ff4d4d'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.max), 5 * s);
      if (e.barT > 0) {
        ctx.font = `900 ${9 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
        ctx.strokeText(e.def.name, x, by - 3 * s); ctx.fillStyle = '#fff'; ctx.fillText(e.def.name, x, by - 3 * s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Hats, bandanas, shades and an angry comic face on the baked head anchor (drawn in the sprite's own
   * mirrored space): the low-poly crooks get personality and crews read apart at a glance.
   */
  drawHeadgear(ctx, e, f, fy, s) {
    const L = LOOKS[e.type];
    if (!L || !L.hat) return;
    const m = M * s;
    const hx = f.head[0] * m, hy = fy - f.head[1] * m, tx = f.top[0] * m, ty = fy - f.top[1] * m;
    const ux = tx - hx, uy = ty - hy, len = Math.hypot(ux, uy) || 1;
    const r = len * 0.62, ang = Math.atan2(uy, ux) + Math.PI / 2;
    const cx = hx + ux * 0.45, cy = hy + uy * 0.45;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, 1.6 * s);
    const down = e.st === 'down' || e.dead;
    // face on the 3/4 side toward the viewer (+x in sprite space)
    if (L.model !== 'riddler') {
      const ex = r * 0.42, ey = r * 0.02;
      if (down) { ctx.beginPath(); for (const d of [-1, 1]) { ctx.moveTo(ex + d * r * 0.2 - r * 0.08, ey - r * 0.08); ctx.lineTo(ex + d * r * 0.2 + r * 0.08, ey + r * 0.08); ctx.moveTo(ex + d * r * 0.2 + r * 0.08, ey - r * 0.08); ctx.lineTo(ex + d * r * 0.2 - r * 0.08, ey + r * 0.08); } ctx.stroke(); }
      else {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex - r * 0.16, ey, r * 0.07, r * 0.12, 0, 0, Math.PI * 2); ctx.ellipse(ex + r * 0.2, ey, r * 0.06, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex - r * 0.32, ey - r * 0.26); ctx.lineTo(ex - r * 0.04, ey - r * 0.14); ctx.moveTo(ex + r * 0.06, ey - r * 0.14); ctx.lineTo(ex + r * 0.34, ey - r * 0.24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - r * 0.12, ey + r * 0.42); ctx.quadraticCurveTo(ex + r * 0.05, ey + r * 0.34, ex + r * 0.22, ey + r * 0.44); ctx.stroke();
        if (L.beard) { ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(ex, ey + r * 0.55, r * 0.42, r * 0.3, 0, 0, Math.PI); ctx.fill(); ctx.stroke(); }
      }
    }
    const col = L.hatCol || '#333';
    if (L.hat === 'cap') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.1); ctx.quadraticCurveTo(r * 1.3, -r * 0.14, r * 1.45, r * 0.05); ctx.lineTo(r * 0.7, r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-r * 0.5, -r * 0.8, r * 0.3, r * 0.12);
    } else if (L.hat === 'beanie') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 1.04, Math.PI, 0); ctx.lineTo(r * 1.04, r * 0.08); ctx.lineTo(-r * 1.04, r * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a5a64'; ctx.fillRect(-r * 1.04, -r * 0.16, r * 2.08, r * 0.26); ctx.strokeRect(-r * 1.04, -r * 0.16, r * 2.08, r * 0.26);
    } else if (L.hat === 'bandana') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(r * 0.98, -r * 0.1); ctx.lineTo(-r * 0.98, -r * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.2); ctx.lineTo(-r * 1.6, r * 0.2 + Math.sin(this.t * 12) * r * 0.1); ctx.lineTo(-r * 1.35, r * 0.4); ctx.lineTo(-r * 0.9, r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-0.4, -0.55], [0.1, -0.7], [0.5, -0.45]]) { ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
    } else if (L.hat === 'shades' && !down) {
      ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.roundRect(r * 0.1, -r * 0.2, r * 0.8, r * 0.3, r * 0.1); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,.7)'; ctx.fillRect(r * 0.2, -r * 0.16, r * 0.25, r * 0.06);
    }
    ctx.restore();
  }

  /** Which baked sprite frame shows this crook right now. */
  enemyFrame(e) {
    const t = e.type;
    let anim = 'idle', u = this.t * 0.8 + e.phase;
    const brute = t === 'brute';
    switch (e.st) {
      case 'enter': if (e.entry === 'drop') { anim = 'jump'; u = 0.5 + Math.max(-0.5, Math.min(0.5, -e.vy / 900)); } else { anim = e.entry === 'run' ? 'run' : 'walk'; u = e.phase; } break;
      case 'approach': if (e.landT > 0) { e.landT -= 1 / 60; anim = 'fall'; u = 0; } else if (e.moving) { anim = e.def.spd > 140 ? 'run' : 'walk'; u = e.phase; } break;
      case 'wind': if (brute) { anim = 'kick'; u = (e.st_t / 0.42) * 0.3; } else { anim = 'wind'; u = e.st_t / (e.def.boss ? 0.5 : 0.42); } break;
      case 'strike': if (brute) { anim = 'kick'; u = 0.4 + Math.min(1, e.st_t / 0.12) * 0.6; } else { anim = 'strike'; u = Math.min(1, e.st_t / 0.1); } break;
      case 'aim': anim = 'strike'; u = 1; break;
      case 'charge': if (e.st_t < 0.6) { anim = 'wind'; u = 0.3; } else { anim = 'run'; u = this.t * 1.6; } break;
      case 'hurt': anim = 'hit'; u = e.st_t / 0.3; break;
      case 'down': anim = 'fall'; u = e.landed ? 1 : Math.min(0.85, e.st_t / 0.55); break;
      case 'getup': anim = 'getup'; u = e.st_t / 0.5; break;
      case 'frozen': return e.lastFrame || null;
    }
    if (e.dead) { anim = 'fall'; u = 1; }
    const f = spriteFrame(t, anim, u);
    if (f) e.lastFrame = f;
    return f || (e.lastFrame && e.st !== 'enter' ? e.lastFrame : null);
  }

  /** Procedural figure with the same ink outline as the baked sprites (captives, fallbacks). */
  inkedHumanoid(ctx, x, y, s, facing, look, P) {
    const dpr = this.stage.dpr || 1, sz = look.size || 1;
    const w = 130 * s * sz, h = 150 * s * sz;
    if (!this.scratch) { this.scratch = document.createElement('canvas'); this.sctx = this.scratch.getContext('2d'); }
    const cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr);
    if (this.scratch.width < cw || this.scratch.height < ch) { this.scratch.width = Math.max(cw, this.scratch.width); this.scratch.height = Math.max(ch, this.scratch.height); }
    const c = this.sctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.scratch.width, this.scratch.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHumanoid(c, w / 2, h - 12 * s * sz, s, facing, look, P, this.t);
    // outline only the used region: draw via a sub-rect copy
    if (!this.scratch2) { this.scratch2 = document.createElement('canvas'); }
    const s2 = this.scratch2;
    if (s2.width !== cw || s2.height !== ch) { s2.width = cw; s2.height = ch; }
    const g2 = s2.getContext('2d'); g2.clearRect(0, 0, cw, ch); g2.drawImage(this.scratch, 0, 0, cw, ch, 0, 0, cw, ch);
    inkOutline(ctx, s2, w, h, 1.4, x - w / 2, y - h + 12 * s * sz);
  }

  drawCaptive(ctx, c, x, y, s) {
    if (c.done) {
      if (c.run > 2.5) return;
      this.inkedHumanoid(ctx, x, y, s, -1, c.look, pose('run', this.t));
      return;
    }
    this.inkedHumanoid(ctx, x, y, s, 1, c.look, pose('sitFloor', this.t));
    // comic "HELP!" balloon
    const bob = Math.sin(this.t * 4) * 3;
    const label = c.blocked ? 'TRAPPED BY FIRE!' : 'HELP!';
    ctx.font = `900 ${12 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 14 * s, th = 20 * s, bx = x + 10 * s, by = y - 92 * s + bob;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(bx, by, tw / 2, th / 2 + 2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 8 * s, by + th / 2 - 1 * s); ctx.lineTo(x - 2 * s, y - 62 * s); ctx.lineTo(bx + 2 * s, by + th / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 7 * s, by + th / 2 - 3.5 * s, 9 * s, 3 * s);
    ctx.fillStyle = c.blocked ? '#d8122e' : INK; ctx.fillText(label, bx, by + 1);
    ctx.textBaseline = 'alphabetic';
    if (c.freed > 0) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.arc(x, y - 118 * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3ee08a'; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.arc(x, y - 118 * s, 12 * s, -Math.PI / 2, -Math.PI / 2 + c.freed * Math.PI * 2); ctx.stroke();
    }
  }

  drawBreakable(ctx, b, x, y, s) {
    const d = BREAK[b.kind], w = d.w * s, h = d.h * s;
    ctx.save(); ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const L = -w / 2, T = -h;
    if (b.kind === 'can') {
      const gr = ctx.createLinearGradient(L, 0, L + w, 0); gr.addColorStop(0, '#6a747c'); gr.addColorStop(0.35, '#b8c2ca'); gr.addColorStop(1, '#4a545c');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(L + 2 * s, T + 6 * s); ctx.lineTo(L + w - 2 * s, T + 6 * s); ctx.lineTo(L + w - 4 * s, 0); ctx.lineTo(L + 4 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L + (w * i) / 4, T + 8 * s); ctx.lineTo(L + (w * i) / 4, -2 * s); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = '#8a949c'; ctx.beginPath(); ctx.ellipse(0, T + 5 * s, w / 2 + 1 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5c666e'; ctx.fillRect(-4 * s, T - 1 * s, 8 * s, 4 * s);
    } else if (b.kind === 'crate') {
      ctx.fillStyle = '#b07a44'; ctx.fillRect(L, T, w, h); ctx.strokeRect(L, T, w, h);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(L, T, w, 5 * s); ctx.fillRect(L, -5 * s, w, 5 * s);
      ctx.beginPath(); ctx.moveTo(L + 3 * s, T + 5 * s); ctx.lineTo(L + w - 3 * s, -5 * s); ctx.moveTo(L + w - 3 * s, T + 5 * s); ctx.lineTo(L + 3 * s, -5 * s); ctx.stroke();
      ctx.strokeRect(L, T, w, h);
    } else if (b.kind === 'barrel') {
      const gr = ctx.createLinearGradient(L, 0, L + w, 0); gr.addColorStop(0, '#8a2a20'); gr.addColorStop(0.35, '#e0503a'); gr.addColorStop(1, '#6a1a14');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(L, T, w, h, 5 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(L, T + h * 0.25, w, 3 * s); ctx.fillRect(L, T + h * 0.7, w, 3 * s);
      ctx.fillStyle = '#ffe14a'; ctx.font = `900 ${9 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.fillText('☢', 0, T + h * 0.56);
    } else {
      ctx.fillStyle = '#1e3cff'; ctx.fillRect(L, T, w, h - 6 * s); ctx.strokeRect(L, T, w, h - 6 * s);
      ctx.fillStyle = '#dfe8f0'; ctx.fillRect(L + 3 * s, T + 4 * s, w - 6 * s, 12 * s); ctx.strokeRect(L + 3 * s, T + 4 * s, w - 6 * s, 12 * s);
      ctx.fillStyle = INK; ctx.fillRect(L + 3 * s, -6 * s, 3 * s, 6 * s); ctx.fillRect(L + w - 6 * s, -6 * s, 3 * s, 6 * s);
    }
    ctx.restore();
  }

  drawPickup(ctx, q, x, y, s) {
    const bob = Math.sin(this.t * 5 + q.x) * 3 * s, pop = Math.min(1, q.t / 0.25);
    const blink = q.t > 16 && Math.sin(this.t * 20) > 0;
    if (blink) return;
    ctx.save(); ctx.translate(x, y - 10 * s + bob - (1 - pop) * 30 * s); ctx.scale(pop, pop);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    ctx.drawImage(glow(q.kind === 'food' ? '#ffe070' : '#39c6ff'), -22 * s, -30 * s, 44 * s, 44 * s);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    if (q.kind === 'food') {
      // roast chicken on a plate
      ctx.fillStyle = '#f2f2ea'; ctx.beginPath(); ctx.ellipse(0, 0, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8742a'; ctx.beginPath(); ctx.ellipse(0, -8 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.ellipse(-3 * s, -11 * s, 5 * s, 2.5 * s, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(9 * s, -14 * s, 6 * s, 3 * s); ctx.strokeRect(9 * s, -14 * s, 6 * s, 3 * s);
    } else {
      ctx.fillStyle = '#39c6ff'; ctx.beginPath(); ctx.moveTo(2 * s, -24 * s); ctx.lineTo(-8 * s, -8 * s); ctx.lineTo(0, -8 * s); ctx.lineTo(-3 * s, 4 * s); ctx.lineTo(9 * s, -13 * s); ctx.lineTo(1 * s, -13 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawFire(ctx, f, x, y, s) {
    if (f.hp <= 0) {
      ctx.fillStyle = 'rgba(30,30,30,.5)'; ctx.beginPath(); ctx.ellipse(x, y, f.w / 2 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const k = f.hp / 100;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55; ctx.drawImage(glow('#ff8a30'), x - f.w * 1.2 * s, y - 150 * s, f.w * 2.4 * s, 200 * s); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const fx = x + ((i / 8) - 0.5) * f.w * s;
      const h = (70 + Math.sin(this.t * 9 + i * 1.7) * 20) * s * (0.4 + 0.6 * k);
      const grd = ctx.createLinearGradient(fx, y, fx, y - h);
      grd.addColorStop(0, 'rgba(255,220,90,.95)'); grd.addColorStop(0.5, 'rgba(255,100,20,.75)'); grd.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(fx - 17 * s, y); ctx.quadraticCurveTo(fx - 8 * s, y - h * 0.6, fx + Math.sin(this.t * 7 + i) * 6 * s, y - h); ctx.quadraticCurveTo(fx + 8 * s, y - h * 0.6, fx + 17 * s, y); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ effects
  drawFx(ctx) {
    for (const f of this.fx) {
      const s = this.sc(f.z), x = this.sx(f.x), y = this.gy(f.z) - f.y * s, u = f.t / f.max, a = 1 - u;
      switch (f.kind) {
        case 'spark': {
          // inked starburst: pops big then shrinks
          const r = (f.big ? 34 : 22) * s * (u < 0.3 ? 0.6 + u * 1.6 : 1.08 - (u - 0.3) * 1.1);
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot || 0);
          ctx.beginPath();
          const n = f.big ? 10 : 8;
          for (let i = 0; i < n * 2; i++) { const an = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r * (0.8 + ((i * 7) % 5) * 0.08); ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
          ctx.closePath();
          ctx.fillStyle = f.hurt ? '#ff4a5a' : f.hot ? '#ff9a2a' : f.big ? '#ffe14a' : '#fff6b0'; ctx.fill();
          ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'ring':
          ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 4 * s * a + 1;
          ctx.beginPath(); ctx.ellipse(x, y, (20 + u * 70) * s, (12 + u * 40) * s, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'streak': {
          const len = 0.035;
          ctx.strokeStyle = f.hot ? `rgba(255,${120 + a * 100},60,${a})` : `rgba(255,250,210,${a})`; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - f.vx * len * this.k, y + f.vy * len * s); ctx.stroke();
          break;
        }
        case 'num': {
          const sc = u < 0.15 ? 0.5 + u * 5 : 1.25 - Math.min(0.25, (u - 0.15) * 0.6);
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.font = `900 ${(f.big ? 22 : 16) * s * sc}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.txt, x, y);
          ctx.fillStyle = f.big ? '#ff5a3a' : '#ffe14a'; ctx.fillText(f.txt, x, y);
          ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
          f.vy -= 200 * (1 / 60);
          break;
        }
        case 'text':
          ctx.globalAlpha = Math.min(1, a * 2); ctx.font = `900 ${17 * this.k}px Impact, system-ui`; ctx.textAlign = 'center';
          ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.strokeText(f.txt, x, y); ctx.fillStyle = f.col; ctx.fillText(f.txt, x, y);
          ctx.globalAlpha = 1;
          break;
        case 'ko': {
          const sc = u < 0.2 ? u * 5 : 1;
          ctx.globalAlpha = Math.min(1, a * 3);
          ctx.save(); ctx.translate(x, y - 30 * s); ctx.rotate(-0.15); ctx.scale(sc, sc);
          ctx.font = `900 ${20 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeText('K.O.', 0, 0); ctx.fillStyle = '#ffd23f'; ctx.fillText('K.O.', 0, 0);
          ctx.restore(); ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
          break;
        }
        case 'dust':
          ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#d8d0c4'; ctx.strokeStyle = 'rgba(40,30,40,.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, f.r * s * (0.6 + u * 0.8), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case 'smoke':
          ctx.globalAlpha = a * 0.5; ctx.fillStyle = f.dark ? '#3a3238' : '#9aa0a8';
          ctx.beginPath(); ctx.arc(x, y, f.r * s * (0.6 + u), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          break;
        case 'chunk':
          ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot || 0); ctx.globalAlpha = Math.min(1, a * 3);
          ctx.fillStyle = f.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
          ctx.fillRect(-f.s * s / 2, -f.s * s / 3, f.s * s, f.s * s * 0.66); ctx.strokeRect(-f.s * s / 2, -f.s * s / 3, f.s * s, f.s * s * 0.66);
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        case 'muzzle':
          ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffd060'), x - 20 * s, y - 20 * s, 40 * s, 40 * s);
          ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.moveTo(x, y - 5 * s); ctx.lineTo(x + f.dir * 22 * s, y); ctx.lineTo(x, y + 5 * s); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'frost': {
          ctx.globalAlpha = a * 0.85;
          const r = (6 + u * 34) * s * (f.r || 1);
          ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.arc(x + r * 0.2, y + r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'ember':
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${150 + a * 80},60,${a})`;
          ctx.fillRect(x, y, 2.5 * s, 2.5 * s); ctx.globalCompositeOperation = 'source-over';
          break;
      }
    }
  }

  /** Comic cut-in for specials: a slanted panel slams across with the heroine's close-up. */
  drawCutIn(ctx, W, H) {
    const t = this.cut.t, heat = this.cut.kind === 'heat';
    const inT = Math.min(1, t / 0.08), outT = t > 0.36 ? (t - 0.36) / 0.14 : 0;
    const slide = (1 - inT) * W - outT * W * 1.2;
    const y0 = H * 0.2, bh = H * 0.24, sl = bh * 0.5;
    ctx.save();
    ctx.translate(slide, 0);
    ctx.beginPath(); ctx.moveTo(-20 + sl, y0); ctx.lineTo(W + 40, y0 - 6); ctx.lineTo(W + 40 - sl, y0 + bh); ctx.lineTo(-20, y0 + bh + 6); ctx.closePath();
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + bh);
    bg.addColorStop(0, heat ? '#ff3b1f' : '#39c6ff'); bg.addColorStop(1, heat ? '#8a0a1a' : '#1e3c9a');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); ctx.clip();
    // speed lines
    ctx.strokeStyle = heat ? 'rgba(255,220,120,.45)' : 'rgba(230,250,255,.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const yy = y0 + ((i * 37) % 100) / 100 * bh, xx = ((i * 211 + t * 3000) % (W + 200)) - 100; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 120 + (i % 3) * 60, yy); ctx.stroke(); }
    // hero close-up, cropped from the live sprite (head & shoulders), slightly zoomed
    const img = this.cutImg;
    if (img) {
      const cw = 120, ch = 110, cx = 50, cy = 62; // head & shoulders in the 220x300 frame
      const dh = bh * 1.6, dw = dh * (cw / ch);
      const dx = W * 0.14 + t * 30, dy = y0 - bh * 0.1;
      ctx.save();
      inkOutline(ctx, cropOf(img, cx, cy, cw, ch), dw, dh, 2.5, dx, dy);
      ctx.restore();
      if (heat) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9; ctx.drawImage(glow('#ff2010'), dx + dw * 0.54 - dw * 0.2, dy + dh * 0.33 - dh * 0.12, dw * 0.4, dh * 0.24); ctx.drawImage(glow('#ffffff'), dx + dw * 0.54 - dw * 0.07, dy + dh * 0.33 - dh * 0.04, dw * 0.14, dh * 0.08); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    // title lettering
    const txt = heat ? 'HEAT VISION!' : 'FREEZE BREATH!';
    ctx.font = `900 ${bh * 0.42}px Impact, system-ui`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const tx = W * 0.92, ty = y0 + bh * 0.52;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.05); ctx.scale(1 + (1 - inT) * 0.4, 1 + (1 - inT) * 0.4);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.strokeText(txt, 4, 4); ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = heat ? '#ffe14a' : '#ffffff'; ctx.fillText(txt, 0, 0);
    ctx.restore();
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  drawCombo(ctx, W, H) {
    if (this.hits < 2 || this.cut) return;
    const fade = this.hitT > 1.6 ? Math.max(0, 1 - (this.hitT - 1.6) / 0.6) : 1;
    if (fade <= 0) return;
    const n = this.hits, pop = 1 + this.hitPop * 0.45;
    const col = n >= 25 ? '#ff3b3b' : n >= 10 ? '#ff9a1f' : '#ffe14a';
    const x = W * 0.92, y = H * 0.45, fs = Math.min(64, H * 0.13); // inside the 8% safe inset
    ctx.save(); ctx.globalAlpha = fade;
    ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(pop, pop);
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `900 ${fs}px Impact, system-ui`;
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.strokeText(String(n), -2, 0);
    ctx.fillStyle = col; ctx.fillText(String(n), -2, 0);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-ctx.measureText(String(n)).width, -fs * 0.62, ctx.measureText(String(n)).width - 4, fs * 0.08);
    ctx.font = `900 ${fs * 0.36}px Impact, system-ui`;
    ctx.lineWidth = 6; ctx.strokeText('HITS!', -2, fs * 0.36); ctx.fillStyle = '#fff'; ctx.fillText('HITS!', -2, fs * 0.36);
    ctx.restore();
  }

  drawGo(ctx, W, H) {
    if (!this.lock && this.goT > 0) {
      const b = Math.sin(this.t * 8) * 8, x = W - 40 + b, y = H * 0.3, s = Math.min(1.2, H / 390);
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(-110, -20); ctx.lineTo(-30, -20); ctx.lineTo(-30, -40); ctx.lineTo(10, 0); ctx.lineTo(-30, 40); ctx.lineTo(-30, 20); ctx.lineTo(-110, 20); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.font = '900 30px Impact, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d8122e'; ctx.fillText('GO!', -62, 1);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    if (this.objectivesDone()) {
      const ex = this.sx(this.len - 120), k = this.k;
      if (ex < W + 40) {
        ctx.fillStyle = 'rgba(62,224,138,.22)'; ctx.fillRect(ex, this.gt, 120 * k, this.gb - this.gt);
        ctx.font = `900 ${18 * k}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = INK;
        ctx.strokeText('EXIT ➜', ex + 60 * k, this.gt - 10); ctx.fillStyle = '#3ee08a'; ctx.fillText('EXIT ➜', ex + 60 * k, this.gt - 10);
      }
    }
  }
}

let shadowC = null;
/** Soft contact shadow blob (cached). */
function shadowSprite() {
  if (shadowC) return shadowC;
  shadowC = document.createElement('canvas'); shadowC.width = 64; shadowC.height = 32;
  const g = shadowC.getContext('2d');
  const r = g.createRadialGradient(32, 16, 0, 32, 16, 32);
  r.addColorStop(0, 'rgba(8,4,16,1)'); r.addColorStop(0.55, 'rgba(8,4,16,.8)'); r.addColorStop(1, 'rgba(8,4,16,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 8); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return shadowC;
}

let cropC = null;
function cropOf(img, x, y, w, h) {
  if (!cropC) cropC = document.createElement('canvas');
  if (cropC.width !== w || cropC.height !== h) { cropC.width = w; cropC.height = h; }
  const g = cropC.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(img, x, y, w, h, 0, 0, w, h);
  return cropC;
}
