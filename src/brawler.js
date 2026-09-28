// Side-scrolling beat 'em up for regular activity zones (Streets of Rage / TMNT arcade staging).
// Coordinates: x = world units along the street, z = depth 0 (sidewalk) .. 1 (front), y = height.
// 54 world units = 1 metre. The set lives in brawlstage.js; crooks are the rigged 3D enemy models
// baked to inked sprites in brawlsprite.js (procedural art.js figures until those are ready).
import { DISTRICTS, HERO } from './data.js';
import { npcLook } from './art.js';
import { clamp, pick, rand, chance, $ } from './util.js';
import { RNG } from './rng.js';
import { sfx } from './sfx.js';
import { banner, toast } from './ui.js';
import { comic } from './comic.js';
import { quality } from './settings.js';
import { Stage } from './brawlstage.js';
import { spriteBudget, prewarm, LOOKS, VARIANTS } from './brawlsprite.js';
import { EN, DZ } from './brawldata.js';
import { actorDraw } from './brawlactors.js';
import { fxDraw } from './brawlfx.js';

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
      // deal each type's looks round-robin (offset per wave) so the pack reads as different people
      const rr = {};
      const looks = list.map((t) => {
        const v = VARIANTS[t] || [t];
        if (t === 'boss') return v[[...(zone.boss || '')].reduce((h, c) => h + c.charCodeAt(0), 0) % v.length];
        rr[t] = (rr[t] ?? i) + 1;
        return v[(rr[t] - 1) % v.length];
      });
      this.waves.push({ x, list, looks, queue: [], spawned: false, cleared: false, next: 0, n: 0 });
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
    const lk = (ws) => [...new Set(ws.flatMap((w) => w.looks))].filter((l) => LOOKS[l]);
    this.looks = lk(this.waves);
    this.firstLooks = lk(this.waves.slice(0, 1)).filter((l) => LOOKS[l].model !== 'riddler');
    // Bake the crooks' sprites up front, behind the zone transition (~0.1 s on a phone GPU); anything
    // left over trickles in during the banner.
    this.warm = this.bossWarm = false;
    spriteBudget(quality().brawlBakeMs || 900);
    this.warm = prewarm(this.firstLooks) && prewarm(this.looks.filter((l) => LOOKS[l].model !== 'riddler'));

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
    if (this.cut) { this.cut.t += dt; if (this.cut.t > 0.66) this.cut = null; }
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
        w.queue = w.list.map((t, j) => [t, w.looks[j]]);
        const first = Math.min(w.queue.length, 4);
        for (let i = 0; i < first; i++) this.spawnEnemy(...w.queue.shift(), w, i);
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
      if (w.queue.length && alive < 3 && w.next <= 0) { this.spawnEnemy(...w.queue.shift(), w, w.n); w.next = 0.7; }
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
    // Big SFX lettering is saved for finishers, lifted up-and-away from the heads; white card = readable ink.
    if (!silent && heavy) {
      const s = this.screenOf(e.x + p.facing * 40, e.z, 150);
      comic.pow(pick(e.hp <= 0 ? ['KAPOW!', 'WHAM!', 'K-RACK!', 'BOOM!'] : ['POW!', 'BAM!', 'SMACK!', 'THWACK!']), s.x, s.y, { size: e.hp <= 0 ? 1.25 : 1, colors: ['#ffffff', pick(['#ff2d2d', '#ffe600', '#39c6ff', '#ff9a1f'])] });
    }
    // juice: freeze, shake along the blow, zoom punch, white flash on the victim, spark, number
    this.hitstop = Math.max(this.hitstop, heavy ? 0.08 : 0.06);
    this.shake = Math.max(this.shake, heavy ? 9 : 4.5); this.shakeDir = p.facing;
    if (heavy) this.zoom = Math.max(this.zoom, 0.025);
    e.flash = 0.12; e.barT = 3;
    // contact point: where the fist / boot meets the body
    const hy = (p.st === 'flykick' ? 55 + p.y * 0.6 : p.combo === 3 ? 62 : 84) + rand(-5, 5);
    this.fx.push({ kind: 'spark', x: e.x - p.facing * 16, y: hy, z: e.z + 0.001, t: 0, max: heavy ? 0.26 : 0.18, big: heavy, rot: rand(0, 6) });
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
    } else { e.st = 'hurt'; e.st_t = 0; e.x += p.facing * 5; }
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

  spawnEnemy(type, lk, wave, i) {
    const vh = this.viewHalf, side = i % 2 === 0 ? 1 : -1;
    const cx = clamp(wave.x + 80, vh, this.len - vh);
    const def = { ...EN[type] };
    if (LOOKS[lk] && LOOKS[lk].name) def.name = LOOKS[lk].name;
    if (def.boss) def.name = (this.zone.boss || 'BOSS').toUpperCase();
    const look = type === 'boss' ? npcLook('boss') : npcLook(type);
    const tz = rand(0.15, 0.95);
    const e = {
      type, lk, hatCol: LOOKS[lk] && LOOKS[lk].hatCols ? pick(LOOKS[lk].hatCols) : null, def, look, wave, x: cx + side * (vh + 60 + (i % 4) * 40), z: tz, y: 0, vy: 0, vx: 0,
      hp: def.hp, max: def.hp, facing: -side, st: 'enter', st_t: 0, cd: rand(0.6, 1.5), dead: false,
      phase: rand(0, 1), flash: 0, barT: 0, slot: wave.n % 3, zOff: ((wave.n % 4) - 1.5) * 0.18, entry: 'run', tx: cx + side * rand(120, vh - 60), tz,
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
        const waiting = engaged >= 2 && e.def.spd < 200;
        const hold = waiting ? 170 + e.slot * 45 : e.def.reach * 0.8;
        const tx = p.x - Math.sign(dx || 1) * hold;
        const tz = waiting ? clamp(p.z + e.zOff, 0.04, 1) : p.z;
        if (Math.abs(tx - e.x) > 8) e.x += Math.sign(tx - e.x) * e.def.spd * dt;
        if (Math.abs(tz - e.z) > 0.02) e.z += Math.sign(tz - e.z) * 0.5 * dt;
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
      // bodies are ~46 units wide; keep screen overlap under ~30% (elliptical, depth counts too)
      const d = Math.hypot(dx / 34, dz / 0.12);
      if (d < 1) {
        const f = (1 - d) * Math.min(1, dt * 9), ang = Math.atan2(dz / 0.12, dx / 34 || (i % 2 ? 0.01 : -0.01));
        const px = Math.cos(ang) * 34 * f * 0.5, pz = Math.sin(ang) * 0.12 * f * 0.5;
        a.x -= px; b.x += px;
        a.z = clamp(a.z - pz, 0.04, 1); b.z = clamp(b.z + pz, 0.04, 1);
      }
    }
  }

  hurtPlayer(dmg, dir, knock = false) {
    const p = this.p;
    if (p.inv > 0 || p.st === 'down') return;
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
    if (!this.warm) this.warm = prewarm(this.firstLooks) && prewarm(this.looks.filter((l) => LOOKS[l].model !== 'riddler'));
    else if (!this.bossWarm && !this.lock) this.bossWarm = prewarm(this.looks);
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
      const wide = d.b ? 1.1 : lying ? 2.1 : d.e ? (LOOKS[d.e.lk] ? LOOKS[d.e.lk].scale * (LOOKS[d.e.lk].shape ? LOOKS[d.e.lk].shape[0] : 1) : 1) : 1;
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
      const a = this.cut ? Math.min(1, this.cut.t / 0.06) * (this.cut.t > 0.5 ? Math.max(0, 1 - (this.cut.t - 0.5) / 0.16) : 1) : 0;
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

}

// Drawing lives in its own modules (actors, effects); the class keeps rules, state and frame order.
Object.assign(Brawler.prototype, actorDraw, fxDraw);
