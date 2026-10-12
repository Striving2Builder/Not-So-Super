// The impostor sighting as a rooftop chase (Act 1, from City Guardian on; the act's clock says when).
// "Supergirl" is posing on a low roof for a swarm of tabloid camera drones: it's her own model in a
// knockoff (cheap teal tube top, hot-pink skirt and boots, no cape) with a sputtering rocket pack.
// When Supergirl closes in she bolts, rocket-hopping roof to roof and posing for the lenses at each
// stop. The test: drop to rooftop height, get in close and DIVE: a swoop tackle in slow motion, the
// blonde wig flies off, and the act unmasks her (act.js catchImpostor). Smash a drone on the way
// through for a point; let the flashes catch you and the tabloid heat climbs. She gets away if the
// sighting's clock runs out (the photos run: −6), or if Supergirl gives up the chase.
import * as THREE from 'three';
import { Moment } from './base.js';
import { RUN } from './actors3d.js';
import { KIT } from './kit3d.js';
import { reticle, tag } from './hud.js';
import { HeroModel, heroReady, HERO_COMIC } from '../hero3d.js';
import { heroMaterial, inkHull, SUIT, HERO_LIGHT } from '../herolook3d.js';
import { inkCharacter } from '../look3d.js';
import { M } from '../city3d.js';
import { DISTRICTS } from '../data.js';
import { clamp, lerp, pick, rand, dist } from '../util.js';
import { comic } from '../comic.js';
import { sfx } from '../sfx.js';

export const CHASE = {
  spot: [900, 1500], spotForced: [520, 760], // where she's posing, ahead of Supergirl (world units)
  roof: [30, 150], size: 36,  // roofs she uses: 3D height (world units: the skim band flies at 110) and width
  alert: 520,                 // she bolts when Supergirl is this close (horizontal)
  hop: [170, 330], hopT: [1.3, 1.9], arc: [40, 0.22], // hop length, time in the air, apex (units + × length)
  pose: [1.5, 2.4],           // seconds posing on each roof once she's running
  catchR: 80, catchZ: 150,    // DIVE range: horizontal, vertical (world units)
  drones: 3, droneR: 34, droneUp: 16, flash: [0.8, 1.5], // the swarm round her
  smash: 18,                  // fly through a drone this close (3D) and it's scrap
  heat: 3,                    // tabloid heat per flash that catches Supergirl close up
  lost: 2600, lostT: 8,       // she gets away if Supergirl stays this far for this long, once running
  scale: 1.5,                 // her model's size (Supergirl's own)
};

const KNOCKOFF = `{ vec3 kc = outgoingLight;
  if (kc.r > kc.g * 1.8 && kc.r > kc.b * 1.6) outgoingLight = vec3(kc.r * 0.98, kc.r * 0.3 + kc.g * 0.3, kc.r * 0.7);
  else if (kc.b > kc.r * 1.25 && kc.b > kc.g * 0.9) outgoingLight = vec3(kc.b * 0.22, kc.b * 0.82, kc.b * 0.74); }`;
/** Her own cel suit with the colours swapped: red → hot pink, blue → cheap teal. */
function knockoff(src) {
  const m = heroMaterial(src, { self: SUIT.self, rim: { value: 1.3 }, light: HERO_LIGHT });
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('outgoingLight = outgoingLight * heroTint + rimAdd;', `outgoingLight = outgoingLight * heroTint + rimAdd; ${KNOCKOFF}`); };
  m.customProgramCacheKey = () => `knockoff|${key.call(m)}`;
  return m;
}

let body = null; // her body, built once per flight scene and reused by every sighting
function impostorBody(scene) {
  if (body && body.scene === scene) return body;
  if (!heroReady()) return null;
  const m = new HeroModel();
  m.cape.mesh.visible = false; // (a knockoff: no cape)
  if (HERO_COMIC) {
    m.root.traverse((o) => { if (o.isMesh && o !== m.cape.mesh && !o.userData.ink && o.material && !Array.isArray(o.material) && !o.material.isMeshBasicMaterial) o.material = knockoff(o.material); });
    inkHull(inkCharacter(m.root, { skip: [m.cape.mesh] }));
  }
  m.root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  m.root.scale.setScalar(CHASE.scale);
  const group = new THREE.Group();
  group.add(m.root); group.visible = false;
  scene.add(group);
  body = { scene, model: m, group };
  return body;
}

export class ImpostorChase extends Moment {
  /** Offer a sighting: a roof ahead of Supergirl, the act's zone on it. */
  static offer(dir, forced) {
    const act = dir.g.act, [d0, d1] = forced ? CHASE.spotForced : CHASE.spot;
    const roof = dir.ahead(d0, d1, { cone: forced ? 0.3 : 0.6, test: (x, y) => dir.roofNear(x, y, 260, ...CHASE.roof, CHASE.size) });
    if (!roof || !act) return null;
    const zone = act.spawnSighting(dir.ow, roof);
    const m = new ImpostorChase(dir, zone, false, roof);
    const D = DISTRICTS[zone.district];
    dir.ow.feed?.play('flying', `"SUPERGIRL" · ${(D?.name || 'the city').toUpperCase()}`, true); // the news has it live (it's the frame-up)
    setTimeout(() => comic.caption(`Meanwhile, on a rooftop in ${D?.name || 'the city'}… "Supergirl" is posing for the cameras. It isn't her.`), 900);
    dir.ow.audio?.sting('alert');
    return m;
  }

  /** zone: the act's sighting marker (this chase moves it); resume: picked up after a zone visit. */
  constructor(dir, zone, resume = false, roof = null) {
    super(dir, 'impostor', { name: '"Supergirl" spotted!', color: '#3fa0ff', glyph: '?', ttl: Infinity, big: true });
    this.zone = zone;
    this.roof = roof || dir.roofNear(zone.x, zone.y, 320, ...CHASE.roof, 24) || { x: zone.x, y: zone.y, z: 0, o: null };
    this.x = this.roof.x; this.y = this.roof.y; this.z = this.roof.z;
    this.state = 'pose'; this.stateT = 0; this.alerted = false; this.lostT = 0;
    this.posT = rand(...CHASE.pose); this.clip = null; this.face = rand(0, Math.PI * 2);
    this.drones = Array.from({ length: CHASE.drones }, (_, i) => ({ a: (i / CHASE.drones) * Math.PI * 2, x: this.x, y: this.y, z: this.z + 20, fl: rand(...CHASE.flash), alive: true, fall: 0, vz: 0 }));
    this.flashK = 0; this.smashed = 0;
    if (resume) this.alerted = true;
  }

  // ------------------------------------------------------------------ the chase
  update(dt) {
    const ow = this.ow, z = this.zone, h = this.hero;
    this.stateT += dt;
    this.flashK = Math.max(0, this.flashK - dt * 3);
    if (this.result) { this.outroStep(dt); return; }
    if (!ow.zones.includes(z)) { this.getaway(); return; } // the sighting's clock ran out (act: the photos ran)
    const d = this.dist();
    if (!this.taken && d < 1100) this.take();
    if (!this.alerted && d < CHASE.alert) {
      this.alerted = true; this.posT = 0.35;
      this.say(pick(['Uh-oh. The real one!', 'No autographs!', 'Gotta jet!', 'Not the face!']), 'shout');
    }
    if (this.alerted) {
      this.lostT = d > CHASE.lost ? this.lostT + dt : 0;
      if (this.lostT > CHASE.lostT) { ow.removeZone(z); this.g.act?.sightingLost(z); this.getaway(); return; }
    }
    if (this.state === 'pose') {
      this.z = this.roof.z;
      if (this.alerted) this.face = Math.atan2(h.y - this.y, h.x - this.x);
      else this.face += dt * 0.4;
      if (this.alerted && (this.posT -= dt) <= 0) this.takeoff();
    } else if (this.state === 'hop') {
      const p = this.hop, f = Math.min(1, this.stateT / p.T);
      this.x = lerp(p.x0, p.x1, f); this.y = lerp(p.y0, p.y1, f);
      this.z = lerp(p.z0, p.z1, f) + p.arc * 4 * f * (1 - f);
      this.face = Math.atan2(p.y1 - p.y0, p.x1 - p.x0);
      if (f >= 1) { this.roof = p.to; this.state = 'pose'; this.stateT = 0; this.posT = rand(...CHASE.pose); this.z = this.roof.z; this.landed = 0.35; }
    }
    z.x = this.x; z.y = this.y; z.district = this.g.city.districtAt(this.x, this.y) === 'water' ? z.district : this.g.city.districtAt(this.x, this.y);
    this.updateDrones(dt, d);
  }

  /** A rocket hop to the next roof, away from Supergirl. */
  takeoff() {
    const h = this.hero, dir = this.dir, away = Math.atan2(this.y - h.y, this.x - h.x);
    let best = null;
    for (let i = 0; i < 14 && !best; i++) {
      const a = away + rand(-1.1, 1.1), L = rand(...CHASE.hop);
      const r = dir.roofNear(this.x + Math.cos(a) * L, this.y + Math.sin(a) * L, 110, ...CHASE.roof, 24, this.roof.o);
      if (r && dist(r.x, r.y, this.x, this.y) > 90 && r.x > 200 && r.y > 200 && r.x < this.g.city.coastX - 200 && r.y < this.g.city.H - 200) best = r;
    }
    if (!best) { this.posT = 0.8; return; } // boxed in: she keeps posing (catch her!)
    // a spot inside that roof (not dead centre)
    const o = best.o, tx = o ? o.x + o.w * rand(0.3, 0.7) : best.x, ty = o ? o.y + o.d * rand(0.3, 0.7) : best.y;
    const L = dist(tx, ty, this.x, this.y);
    this.hop = { x0: this.x, y0: this.y, z0: this.roof.z, x1: tx, y1: ty, z1: best.z, T: rand(...CHASE.hopT), arc: CHASE.arc[0] + L * CHASE.arc[1], to: { ...best, x: tx, y: ty } };
    this.state = 'hop'; this.stateT = 0;
    if (Math.random() < 0.5) this.say(pick(['Catch me if you can!', 'Smile for the cameras!', 'Wheee!', 'Too slow, sweetie!']), 'shout');
  }

  updateDrones(dt, dSup) {
    const h = this.hero, t = this.ow.t, kit = this.dir.kit;
    this.drones.forEach((q, i) => {
      if (!q.alive) {
        if (q.fall < 2) { q.fall += dt; q.vz -= 80 * dt; q.z += q.vz * dt; q.a += dt * 9; if (kit && Math.random() < dt * 20) kit.smoke(q.x, q.y, q.z, { size: 1.6, col: '#3a3a40', life: 0.8, rise: 4, spread: 1 }); }
        return;
      }
      // circle her at shoulder height, trailing her hops
      const a = q.a + t * (0.9 + i * 0.15);
      const tx = this.x + Math.cos(a) * CHASE.droneR, ty = this.y + Math.sin(a) * CHASE.droneR, tz = this.z + CHASE.droneUp + Math.sin(t * 2 + i) * 4;
      const k = Math.min(1, dt * (this.state === 'hop' ? 2.2 : 4));
      q.x += (tx - q.x) * k; q.y += (ty - q.y) * k; q.z += (tz - q.z) * k;
      // flashes: at her while she poses; at Supergirl when she's close (tabloid heat)
      if ((q.fl -= dt) <= 0) {
        q.fl = rand(...CHASE.flash);
        const atHer = dSup < 220 && Math.random() < 0.6;
        if (this.state === 'pose' || atHer) {
          q.flash = 0.2;
          if (kit) kit.flash(q.x, q.y, q.z, atHer ? 12 : 8, '#ffffff', 0.2);
          if (dSup < 700) sfx.shutter();
          if (atHer) { this.flashK = 1; const st = this.st; if (st) st.vice = Math.min(100, st.vice + CHASE.heat); }
        }
      }
      // fly through one and it's scrap
      if (Math.hypot(q.x - h.x, q.y - h.y, q.z - h.z) < CHASE.smash) {
        q.alive = false; q.vz = 20; this.smashed++;
        this.dir.celebrate(q.x, q.y, q.z, pick(['SMASH!', 'KRUNCH!', 'BZZT!']), { size: 0.8, slow: false, sting: 'smash', sparks: '#9fe8ff' });
        this.st?.addRep(1, 'Smashed a tabloid drone');
      }
    });
  }

  // ------------------------------------------------------------------ the catch
  diveTarget() {
    if (this.state === 'caught' || this.result) return null;
    const h = this.hero;
    return this.dist() < CHASE.catchR && Math.abs(h.z - this.z) < CHASE.catchZ ? { x: this.x, y: this.y, z: this.z, label: 'TACKLE! ▼' } : null;
  }

  onDive() {
    this.dir.swoopTo(() => ({ x: this.x, y: this.y, z: this.z + 3 }), () => this.caught());
  }

  caught() {
    if (this.result) return;
    this.state = 'caught'; this.stateT = 0;
    if (this.hop && this.z > this.roof.z + 4) { this.roof = this.hop.to; } // (tackled mid-hop: they land on the next roof)
    this.dir.celebrate(this.x, this.y, this.z + 4, pick(['GOTCHA!', 'TACKLED!', 'KA-POW!']), { size: 1.4 });
    this.wig = { x: this.x, y: this.y, z: this.z + 6, vx: Math.cos(this.hero.ang) * 40, vy: Math.sin(this.hero.ang) * 40, vz: 70, r: 0 };
    this.say(pick(['Hey! Watch the wig!', "It's just a JOB, okay?!", 'Ow! My extensions!']), 'shout');
    for (const q of this.drones) if (q.alive) q.scatter = rand(0, Math.PI * 2);
    this.win(1.7);
    this.outroDone = false;
  }

  /** The beats after it settles: the wig in flight, the drones scattering, then the act's unmasking. */
  outroStep(dt) {
    const kit = this.dir.kit;
    if (this.wig) { const w = this.wig; w.vz -= 120 * dt; w.x += w.vx * dt; w.y += w.vy * dt; w.z = Math.max(this.roof.z, w.z + w.vz * dt); w.r += dt * 12; }
    for (const q of this.drones) if (q.alive) { const a = q.scatter ?? 0; q.x += Math.cos(a) * 160 * dt; q.y += Math.sin(a) * 160 * dt; q.z += 60 * dt; }
    if (this.result === 'lost' && this.hop) {
      const p = this.hop, f = Math.min(1, this.stateT / p.T);
      this.x = lerp(p.x0, p.x1, f); this.y = lerp(p.y0, p.y1, f); this.z = lerp(p.z0, p.z1, f) + p.arc * Math.sin(f * Math.PI);
    }
    if (this.result === 'won' && !this.outroDone && this.outro < 0.3) {
      this.outroDone = true;
      const z = this.zone;
      if (this.ow.zones.includes(z)) this.g.act?.catchImpostor(this.ow, z); // (the act's beat: the dialog, the unmasking, +12)
    }
    if (kit && this.state === 'caught' && Math.random() < dt * 4) kit.spark(this.x, this.y, this.z + 5, 2, '#ffe23a', 20);
  }

  /** She got away: a long rocket hop out of town. */
  getaway() {
    if (this.result) return;
    const a = Math.atan2(this.y - this.hero.y, this.x - this.hero.x);
    this.hop = { x0: this.x, y0: this.y, z0: this.z, x1: this.x + Math.cos(a) * 1400, y1: this.y + Math.sin(a) * 1400, z1: this.z + 500, T: 3, arc: 200 };
    this.state = 'hop'; this.stateT = 0;
    for (const q of this.drones) if (q.alive) q.scatter = a + rand(-0.4, 0.4);
    this.lose(2.2);
  }

  expire() {}

  // ------------------------------------------------------------------ 3D
  draw3d(kit, view) {
    const B = impostorBody(kit.scene), t = this.ow.t;
    const gone = this.result === 'lost' && this.stateT > 2.6;
    let headZ = this.z + 5.2;
    if (B && !gone) {
      const m = B.model;
      B.group.visible = true;
      B.group.position.set(this.x * M, this.z * M, this.y * M);
      B.group.rotation.set(0, Math.PI / 2 - this.face, 0);
      const want = this.state === 'caught' ? 'fallFlat' : this.state === 'hop' ? 'jump' : this.landed > 0 ? 'land' : this.alerted ? (Math.floor(t / 1.6) % 2 ? 'excited' : 'pose') : (Math.floor(t / 3) % 3 === 2 ? 'dance' : 'pose');
      if (want !== this.clip) { this.clip = want; m.play(want, { fade: 0.18, restart: want === 'jump' || want === 'fallFlat' }); }
      const fdt = this.dir.frameDt || 1 / 60;
      this.landed = Math.max(0, (this.landed || 0) - fdt);
      m.mixer.update(Math.min(0.05, fdt));
    } else if (!B && !gone) {
      // her model isn't loaded (yet): a stand-in figure in the knockoff colours
      const a = this.fig || (this.fig = kit.take('person:impostor'));
      a.pose(this.state === 'hop' ? 'cheer' : this.state === 'caught' ? 'fall' : RUN[Math.floor(t * 6) % 4]).at(this.x, this.y, this.z, this.face, this.state === 'caught' ? -1.4 : 0);
    } else if (B) B.group.visible = false;
    if (gone && this.fig) { this.fig.hide(); this.fig = null; }
    // the rocket pack: a sputtering flame and a smoke trail while she's in the air
    if (this.state === 'hop' && !gone) {
      const bx = this.x - Math.cos(this.face) * 1.5, by = this.y - Math.sin(this.face) * 1.5;
      kit.glows.add({ x: bx, y: by, z: this.z + 2.2, vz: -30, size: rand(1.6, 2.6), life: 0.18, col: Math.random() < 0.5 ? '#ffb02a' : '#ff5a2a' });
      if (Math.random() < 0.5) kit.smoke(bx, by, this.z + 1.5, { size: 1.6, col: '#b8b0b8', life: 1.1, rise: -4, spread: 0.8 });
    }
    if (this.state === 'pose' && !this.result) kit.ring(this.roof.x, this.roof.y, this.roof.z, 34, '#3fa0ff', 0.75, this.alerted ? 1.6 : 0.7);
    // the swarm (live ones circling, smashed ones tumbling down)
    for (const q of this.drones) if (q.alive || q.fall < 2) kit.drones.put(q.x, q.y, q.z, Math.atan2(this.y - q.y, this.x - q.x), q.alive ? 0.25 : q.a, q.alive ? Math.sin(t * 3) * 0.1 : q.a * 0.7, KIT.scale.drone);
    // the wig, flying off
    if (this.wig) { const w = this.wig, a = this.wigA || (this.wigA = kit.take('wig')); a.at(w.x, w.y, w.z, w.r, w.r * 0.7, 0); headZ = w.z; }
    this.headZ = headZ;
  }

  overlay(ctx, P, W, H, view) {
    if (this.result === 'lost') return;
    const h = this.hero, low = Math.abs(h.z - this.z) < CHASE.catchZ;
    if (this.flashK > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * this.flashK})`; ctx.fillRect(0, 0, W, H); }
    if (this.state === 'caught') return;
    const dive = !!this.diveTarget();
    const text = this.alerted ? 'IMPOSTOR!' : '"SUPERGIRL"?';
    const p = this.mark(ctx, P, view, this.x, this.y, this.z + 6, text, { col: '#3fa0ff', dive, label: 'TACKLE! ▼', r: 18, shake: this.state === 'hop' ? 1.5 : 0 });
    if (p && !dive && !low && this.dist() < 900) tag(ctx, p[0], p[1] + 46, '▼ DROP TO THE ROOFTOPS', { col: '#ffffff', size: 12, lift: 0 });
  }

  draw2d(ctx, V) {
    if (this.result) return;
    const x = V.SX(this.x, this.z), y = V.SY(this.y, this.z);
    if (x < -40 || y < -40 || x > V.W + 40 || y > V.H + 40) return;
    reticle(ctx, x, y, 14, this.ow.t, { col: '#3fa0ff', dive: !!this.diveTarget(), label: 'TACKLE! ▼' });
    tag(ctx, x, y - 10, this.alerted ? 'IMPOSTOR!' : '"SUPERGIRL"?', { col: '#3fa0ff' });
  }

  banner() {
    if (this.result || !this.taken) return null;
    const h = this.hero, d = this.dist(), low = Math.abs(h.z - this.z) < CHASE.catchZ;
    return {
      title: 'CATCH THE IMPOSTOR', col: '#3fa0ff', time: this.zone.ttl - this.zone.t,
      meters: [{ label: low ? 'CLOSING IN' : 'TOO HIGH ▼', v: 1 - clamp((d - CHASE.catchR) / 900, 0, 1), col: '#3fa0ff', warn: !low }],
    };
  }

  marker() { return null; } // (the act's zone marks her on the map)

  say(text, kind) {
    const v = this.ow.view3d, P = v && document.body.classList.contains('fly3d') ? v.projector() : null;
    const p = P ? P.proj(this.x, this.y, this.z + 7) : null;
    if (p && p[2] && p[0] > 40 && p[0] < this.g.w - 40 && p[1] > 60 && p[1] < this.g.h - 40) {
      const anchor = () => { const q = this.ow.view3d?.projector().proj(this.x, this.y, this.z + 7); return q && q[2] && this.g.modeName === 'overworld' ? { x: q[0], y: q[1] } : null; };
      this.g.commentary.talk(text, p[0], p[1], { kind, speaker: '"SUPERGIRL"', anchor });
    }
  }

  end() {
    if (body) body.group.visible = false;
    this.fig?.hide(); this.wigA?.hide();
  }

  abandon() { this.end(); } // (the act's zone stays: the chase picks up again when she's back)
}
