// Club Raid: a special zone that takes place inside a premade 3D club (converted from .blend by
// tools/export_club.py). Reuses the whole Special3D toolkit (heroine, guards, informant, items,
// X-ray, boss, capture) but swaps the generated rooms for a real building:
//   * capsule-vs-BVH collision against the actual club geometry (with step-up onto stages)
//   * the floor is scanned for walkable spots, and gameplay is placed on it automatically
//   * a clipping plane slices the building just above her head so the camera sees into the room
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH, acceleratedRaycast } from '../vendor/three-mesh-bvh/index.module.js';
import { Special3D } from './special3d.js';
import { VENUES, THEMES, INTOX_ITEMS, BAIT_ITEMS, FIRST_NAMES, HERO } from './data.js';
import { pick, shuffle, chance, rand, $ } from './util.js';
import { dialog, toast, banner } from './ui.js';
import { npcLook, portrait } from './art.js';
import { sfx } from './sfx.js';

// Premade clubs. Add more by exporting another .blend with tools/export_club.py.
export const CLUBS = {
  triangle: { file: 'assets/clubs/triangle.glb', meta: 'assets/clubs/triangle.json' },
  clubhouse: { file: 'assets/clubs/clubhouse.glb', meta: 'assets/clubs/clubhouse.json' },
  stripclub: { file: 'assets/clubs/stripclub.glb', meta: 'assets/clubs/stripclub.json' },
};

const RADIUS = 0.35, STEP = 0.45, HEADROOM = 1.9;
const cache = {};
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/'));

const _box = new THREE.Box3(), _seg = new THREE.Line3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);

/** Push a capsule (feet at p) out of the geometry. Returns how far it was pushed (x/z only). */
function capsulePush(collider, p, radius = RADIUS) {
  _seg.start.set(p.x, p.y + STEP + radius, p.z);
  _seg.end.set(p.x, p.y + HEADROOM - radius, p.z);
  _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
  _box.min.addScalar(-radius); _box.max.addScalar(radius);
  const sx = _seg.start.x, sz = _seg.start.z;
  collider.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(_box),
    intersectsTriangle: (tri) => {
      const d = tri.closestPointToSegment(_seg, _v1, _v2);
      if (d < radius) {
        const dir = _v2.sub(_v1).normalize();
        dir.y = 0; // horizontal push only; the floor is handled by grounding
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        _seg.start.addScaledVector(dir, radius - d);
        _seg.end.addScaledVector(dir, radius - d);
      }
    },
  });
  const dx = _seg.start.x - sx, dz = _seg.start.z - sz;
  p.x += dx; p.z += dz;
  return Math.hypot(dx, dz);
}

/** Load (once) a club: scene, metadata, BVH collider and walkable floor samples. */
export function loadClub(key) {
  if (cache[key]) return cache[key];
  const def = CLUBS[key];
  cache[key] = Promise.all([loader.loadAsync(def.file), fetch(def.meta).then((r) => r.json())]).then(([gltf, meta]) => {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = true;
      const m = o.material;
      if (m && m.transparent && m.opacity < 0.35) return; // light beams / glass don't block movement
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', o.geometry.attributes.position.clone());
      if (o.geometry.index) geo.setIndex(o.geometry.index.clone());
      geo.applyMatrix4(o.matrixWorld);
      parts.push(geo.index ? geo : geo.toNonIndexed());
    });
    const merged = mergeGeometries(parts.map((g) => (g.index ? g : (() => { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); return g; })())), false);
    merged.boundsTree = new MeshBVH(merged);
    const collider = new THREE.Mesh(merged);
    collider.raycast = acceleratedRaycast; // use the BVH for rays (otherwise it's a brute-force scan)
    collider.updateMatrixWorld(true);

    // Walkable floor scan on a 1 m grid.
    const box = new THREE.Box3().setFromObject(scene);
    const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
    const floor = [];
    const hits = {};
    // Walk down each column through every surface (models sit at any height, some have
    // several storeys), keeping upward-facing spots with standing room above.
    const cand = [];
    for (let x = box.min.x + 0.5; x < box.max.x; x += 1) {
      for (let z = box.min.z + 0.5; z < box.max.z; z += 1) {
        let y0 = box.max.y + 0.5;
        for (let n = 0; n < 12; n++) {
          ray.set(new THREE.Vector3(x, y0, z), DOWN); ray.far = y0 - box.min.y + 0.1;
          const h = ray.intersectObject(collider)[0];
          if (!h) break;
          y0 = h.point.y - 0.05;
          if (h.face.normal.y < 0.85) continue;
          ray.set(new THREE.Vector3(x, h.point.y + 0.05, z), UP); ray.far = HEADROOM;
          if (ray.intersectObject(collider)[0]) continue;
          cand.push(h.point.clone());
        }
      }
    }
    // Main floor = the most common walkable height; play within a storey of it.
    const lv = {};
    for (const p of cand) { const k = p.y.toFixed(1); lv[k] = (lv[k] || 0) + 1; }
    const baseY = cand.length ? +Object.entries(lv).sort((a, b) => b[1] - a[1])[0][0] : 0;
    for (const p of cand) {
      if (p.y < baseY - 0.5 || p.y > baseY + 1.6) continue;
      if (capsulePush(collider, p.clone()) > 0.04) continue; // not enough room to stand
      // Enclosed = walls in at least 3 of 4 directions (floor/roof slabs can overhang the walls,
      // so "is there a roof" isn't enough to tell inside from outside).
      let walls = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ray.set(new THREE.Vector3(p.x, p.y + 1.2, p.z), new THREE.Vector3(dx, 0, dz)); ray.far = 25;
        if (ray.intersectObject(collider)[0]) walls++;
      }
      p.indoor = walls >= 3;
      floor.push(p);
    }
    // Some models have floor slabs extending outside the walls; keep play indoors when possible.
    const indoor = floor.filter((p) => p.indoor);
    if (indoor.length >= 60) floor.splice(0, floor.length, ...indoor);
    for (const p of floor) { const k = p.y.toFixed(1); hits[k] = (hits[k] || 0) + 1; }
    const mainY = +Object.entries(hits).sort((a, b) => b[1] - a[1])[0][0];
    return { scene, meta, collider, floor, box, mainY };
  });
  return cache[key];
}

export class ClubZone extends Special3D {
  enter(p) {
    const zone = p.zone;
    this.zone = zone;
    this.scene = null;
    this.done = false;
    this.initRenderer();
    document.body.classList.add('three');
    $('hud-title').textContent = zone.name;
    $('hud-sub').textContent = 'Loading the club…';
    const key = VENUES[zone.venue].club;
    loadClub(key).then((club) => {
      if (this.g.mode !== this || this.done) return;
      this.club = club;
      super.enter(p);
    }).catch((e) => {
      console.error(e);
      toast('Could not load this club', 'bad');
      this.done = true;
      this.g.endZone(zone, { outcome: 'abort', rep: 0 });
    });
  }

  // ------------------------------------------------------------------ world
  buildWorld() {
    const c = this.club, S = this.scene;
    this.wallMat = null;
    S.add(c.scene);
    S.fog = new THREE.Fog(this.V.bg, 30, 80);
    S.add(new THREE.HemisphereLight(0xffffff, 0x3a3048, 1.1));
    S.add(new THREE.AmbientLight(0xffffff, 0.35));
    // The club's own strongest lights (from the .blend), as a handful of point lights.
    this.plights = c.meta.lights.slice(0, 6).map((l) => {
      const pl = new THREE.PointLight(new THREE.Color(...l.color), Math.min(30, Math.max(6, l.power / 30)), 22, 1.3);
      pl.position.set(...l.pos);
      S.add(pl);
      return pl;
    });
    this.placeClubGameplay();
  }

  detachShared() {
    if (this.club && this.scene) this.scene.remove(this.club.scene); // keep the cached building alive
    if (this.renderer) this.renderer.clippingPlanes = [];
  }

  spawnPoint() { return { pos: this.spawn.clone(), heading: this.spawnHeading }; }

  bossTrigger(h) { return this.boss && h.position.distanceTo(this.boss.position) < 7; }

  // ------------------------------------------------------------------ placement
  onMain(p) { return Math.abs(p.y - this.club.mainY) < 0.3; }

  /** Raid layout: informant, guards, temptations/bait, evidence, captives, boss. */
  placeClubGameplay() {
    const z = this.zone, th = this.theme;
    this.planLayout();
    this.placeInformant();
    this.placeGuards(Math.min(5, 2 + (z.boss ? 1 : 0) + (th.extraGuards || 0) + (chance(0.5) ? 1 : 0)));
    this.placeItems(4 + (th.extraTraps || 0));
    th.evidence.forEach((name) => this.placeEvidence(name, th.mind ? 'Smash' : 'Secure'));
    this.placeCaptives(th.captives || 0);
    if (z.boss) this.placeBoss();
  }

  // ---- layout building blocks (shared by raids and night cases)

  /** Spawn at the entrance end, exit ring, and a spot-picker that keeps things apart. */
  planLayout() {
    const c = this.club, floor = c.floor;
    this.near = (p, r) => floor.filter((q) => q.distanceToSquared(p) < r * r).length;
    const cz = (c.box.min.z + c.box.max.z) / 2, cx = (c.box.min.x + c.box.max.x) / 2;
    const open = floor.filter((p) => this.onMain(p) && this.near(p, 2.5) >= 14);
    open.sort((a, b) => Math.abs(b.z - cz) - Math.abs(a.z - cz));
    this.spawn = (open[0] || floor[0]).clone();
    this.spawnHeading = Math.atan2(cx - this.spawn.x, cz - this.spawn.z);
    this.far = (p) => p.distanceTo(this.spawn);
    this.maxD = Math.max(...floor.map(this.far));
    const used = [this.spawn];
    /** Random floor spot passing `test`, at least `gap` metres from everything placed so far. */
    this.choose = (test, gap = 3) => {
      const cands = shuffle(floor.filter((p) => test(p) && used.every((u) => u.distanceTo(p) > gap)));
      const p = cands[0] || pick(floor);
      used.push(p);
      return p.clone();
    };
    this.exitRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x3ee08a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    this.exitRing.rotation.x = -Math.PI / 2;
    this.exitRing.position.set(this.spawn.x, this.spawn.y + 0.04, this.spawn.z);
    this.scene.add(this.exitRing);
  }

  faceSpawn(obj) { obj.rotation.y = Math.atan2(this.spawn.x - obj.position.x, this.spawn.z - obj.position.z); }

  placeNPC(look, test, gap) {
    const mesh = this.makeNPC(look);
    mesh.position.copy(this.choose(test, gap));
    this.faceSpawn(mesh);
    return mesh;
  }

  placeInformant(label = 'Talk to the informant') {
    const look = npcLook('civilian');
    const mesh = this.placeNPC(look, (p) => this.onMain(p) && this.far(p) > 8 && this.far(p) < this.maxD * 0.55 && this.near(p, 2) >= 8);
    this.informant = { mesh, look, name: `${pick(FIRST_NAMES)} "${pick(['Whispers', 'Ears', 'Lucky', 'Two-Tone', 'Canary'])}"`, works: pick(['charm', 'press']), burned: false };
    this.addInter(mesh.position, label, () => true, () => this.talkInformant(), 'informant');
  }

  /** Patrolling guards between two points on one level with a clear line between them. */
  placeGuards(n) {
    const floor = this.club.floor;
    for (let i = 0; i < n; i++) {
      let route = null;
      for (let tries = 0; tries < 40 && !route; tries++) {
        const a = pick(floor);
        if (this.far(a) < 9) continue;
        const bs = floor.filter((b) => Math.abs(b.y - a.y) < 0.2 && a.distanceTo(b) > 6 && a.distanceTo(b) < 14 && this.lineClear(a, b));
        if (bs.length) route = [a.clone(), pick(bs).clone()];
      }
      if (!route) continue;
      const mesh = this.makeNPC(npcLook('guard'));
      mesh.position.copy(route[0]);
      const cone = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 24, -Math.PI / 2 - 0.525, 1.05).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = 0.06;
      mesh.add(cone);
      this.guards.push({ mesh, cone, route, wp: 1, ko: false, look: 0, seeing: false, t: rand(0, 3) });
    }
  }

  /**
   * Temptations (intoxicating) and bait (maybe a trap) on table tops / the bar.
   * `onTake(it)` runs after a temptation is taken (night cases hide notes under drinks).
   */
  placeItems(n, { onTake } = {}) {
    const spots = this.surfaceSpots();
    const count = Math.min(spots.length, n);
    for (let i = 0; i < count; i++) {
      const bait = i === 0 || (i === 3 && chance(0.5));
      const def = bait ? pick(BAIT_ITEMS) : pick(INTOX_ITEMS);
      const p = spots[i], trapped = bait ? chance(0.6) : false, col = bait ? 0xffd84d : 0xff7ad0;
      const mesh = new THREE.Mesh(bait ? new THREE.BoxGeometry(0.4, 0.25, 0.3) : new THREE.CylinderGeometry(0.07, 0.05, 0.28, 10), new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 }));
      mesh.position.set(p.x, p.y + 0.14, p.z);
      this.scene.add(mesh);
      const aura = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: trapped ? 0xff2020 : bait ? 0xffd84d : 0xff4db8, depthTest: false, transparent: true }));
      aura.rotation.x = -Math.PI / 2; aura.position.set(p.x, p.y + 0.05, p.z); aura.renderOrder = 11; aura.visible = false;
      this.scene.add(aura); this.hidden.push(aura);
      const it = { def, bait, trapped, mesh, aura, taken: false };
      this.anims.push((t) => { mesh.rotation.y = t * 1.5; mesh.position.y = p.y + 0.16 + Math.sin(t * 3 + p.x) * 0.04; });
      this.addInter(new THREE.Vector3(p.x, 0, p.z), `Examine: ${def.name}`, () => !it.taken, async () => {
        await this.takeItem(it);
        if (it.taken && !it.bait && onTake) await onTake(it);
      });
    }
  }

  /** Glowing evidence deep in the club; its beacon shows once the informant talks (X-ray shows it anyway). */
  placeEvidence(name, verb) {
    const p = this.choose((q) => this.far(q) > this.maxD * 0.55, 8);
    const glowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), new THREE.MeshLambertMaterial({ color: 0x39ff6a, emissive: 0x39ff6a, emissiveIntensity: 0.7 }));
    glowMesh.position.set(p.x, p.y + 0.25, p.z);
    this.scene.add(glowMesh);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.6, depthTest: false }));
    beacon.position.set(p.x, p.y + 1.6, p.z); beacon.renderOrder = 12; beacon.visible = false;
    this.scene.add(beacon); this.hidden.push(beacon);
    const e = { name, mesh: glowMesh, done: false, beacon };
    this.evidence.push(e);
    this.addInter(new THREE.Vector3(p.x, 0, p.z), `${verb}: ${name}`, () => !e.done, () => this.secureEvidence(e), 'evidence');
  }

  /** People held in cages toward the back. */
  placeCaptives(n) {
    for (let i = 0; i < n; i++) {
      const p = this.choose((q) => this.far(q) > this.maxD * 0.5 && this.near(q, 1.5) >= 7, 4);
      const person = this.makeNPC(npcLook('civilian'));
      person.position.copy(p);
      this.faceSpawn(person);
      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.4), new THREE.MeshBasicMaterial({ color: 0x999999, wireframe: true }));
      cage.position.set(p.x, p.y + 1.15, p.z); this.scene.add(cage);
      this.colliders.push({ minX: p.x - 0.7, maxX: p.x + 0.7, minZ: p.z - 0.7, maxZ: p.z + 0.7, mesh: cage });
      const cap = { person, cage, freed: false, x: p.x, z: p.z };
      this.captives.push(cap);
      this.addInter(new THREE.Vector3(p.x, 0, p.z + 1.1), this.theme.mind ? 'Snap them out of the trance' : 'Break open the cage', () => !cap.freed, () => this.freeClubCaptive(cap), 'captive');
    }
  }

  placeBoss() {
    this.boss = this.placeNPC(npcLook('boss'), (q) => this.far(q) > this.maxD * 0.75, 5);
  }

  /** Table tops / bar counters: upward-facing surfaces 0.55–1.25 m above the local floor. */
  surfaceSpots() {
    const c = this.club, ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 3;
    const out = [];
    for (let i = 0; i < 1500 && out.length < 24; i++) {
      const x = rand(c.box.min.x, c.box.max.x), z = rand(c.box.min.z, c.box.max.z);
      ray.set(new THREE.Vector3(x, c.mainY + 2.2, z), DOWN);
      const h = ray.intersectObject(c.collider)[0];
      if (!h || h.face.normal.y < 0.9) continue;
      const lift = h.point.y - c.mainY;
      if (lift < 0.55 || lift > 1.25) continue;
      if (out.some((o) => o.distanceTo(h.point) < 4)) continue;
      if (h.point.distanceTo(this.spawn) < 5) continue;
      out.push(h.point.clone());
    }
    return shuffle(out);
  }

  lineClear(a, b) {
    const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
    for (const hgt of [0.5, 1.3]) {
      const from = new THREE.Vector3(a.x, a.y + hgt, a.z), to = new THREE.Vector3(b.x, b.y + hgt, b.z);
      const d = from.distanceTo(to);
      ray.set(from, to.sub(from).normalize()); ray.far = d;
      if (ray.intersectObject(this.club.collider)[0]) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ physics
  collide(p, r) {
    super.collide(p, r);                       // cages and other dynamic boxes
    capsulePush(this.club.collider, p, r);     // the club itself
    // grounding: snap to the floor below (steps up to STEP). No floor there (an open doorway to
    // nowhere, a gap in the model) → treat it as a wall and stay where she last stood.
    const ray = this._gray || (this._gray = new THREE.Raycaster());
    ray.firstHitOnly = true; ray.far = STEP + 1.2;
    ray.set(new THREE.Vector3(p.x, p.y + STEP, p.z), DOWN);
    const h = ray.intersectObject(this.club.collider)[0];
    const last = this._lastGood || (this._lastGood = p.clone());
    if (h) {
      if (h.face.normal.y > 0.6) p.y = h.point.y; // steep bits (bevels, ramp edges): keep height
      last.copy(p);
    } else { p.x = last.x; p.z = last.z; p.y = last.y; } // no floor at all → treat as a wall
  }

  clearLOS(a, b) {
    const from = new THREE.Vector3(a.x, a.y + 1.6, a.z), to = new THREE.Vector3(b.x, b.y + 1.2, b.z);
    const d = from.distanceTo(to);
    const ray = this._lray || (this._lray = new THREE.Raycaster());
    ray.firstHitOnly = true; ray.far = d;
    ray.set(from, to.sub(from).normalize());
    return !ray.intersectObject(this.club.collider)[0];
  }

  // ------------------------------------------------------------------ story
  async talkInformant() {
    const inf = this.informant;
    if (this.hasCode) {
      await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: '"I already told you where to look. Now beat it before they see us."' });
      return;
    }
    const hint = inf.works === 'charm' ? 'They keep glancing toward the back, guilt written all over their face.' : 'They\'re sweating and eyeing every exit. A coward.';
    const v = await dialog({
      speaker: `Informant · ${inf.name}`, portrait: portrait(inf.look),
      text: `"Psst. Hero. The whole ${this.theme.name.toLowerCase()} racket runs through this club. I know where they stash the goods… but talk ain't cheap in here."<span class="hint">${hint}</span>`,
      options: [
        { label: '"Have a drink with me first." — Accept the drink', note: '+25 intoxication, guaranteed tip', value: 'drink', cls: 'risky' },
        { label: 'Appeal to their conscience', value: 'charm', disabled: inf.burned },
        { label: 'Pin them against the wall', value: 'press', disabled: inf.burned },
        { label: 'Walk away', value: null },
      ],
    });
    if (!v) return;
    if (v === 'drink') { sfx.drink(); this.g.state.addIntox(25); toast('🥴 Intoxication +25', 'bad'); }
    else if (v !== inf.works) {
      inf.burned = true;
      this.alert = Math.min(99, this.alert + 30);
      sfx.alarm();
      await dialog({ speaker: inf.name, text: '"Hey! Keep it down!" Heads turn toward you.<span class="hint">Guard alert +30. They\'ll only talk over a drink now.</span>' });
      return;
    }
    this.hasCode = true;
    for (const e of this.evidence) { e.beacon.visible = true; this.hidden = this.hidden.filter((h) => h !== e.beacon); }
    sfx.pickup();
    await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: `"Alright, alright. The ${this.theme.evidence[0].toLowerCase()} is at the back of the club. Look for the green glow."${this.captives.length ? ' "And… they\'ve got people locked up back there."' : ''}` });
  }

  async secureEvidence(e) {
    await super.secureEvidence(e);
    if (e.done) { e.beacon.visible = false; this.hidden = this.hidden.filter((h) => h !== e.beacon); }
  }

  freeClubCaptive(c) {
    c.freed = true;
    c.cage.visible = false;
    this.colliders = this.colliders.filter((col) => col.mesh !== c.cage);
    sfx.hit();
    toast(this.theme.mind ? 'They blink awake: "Where… where am I?"' : `"Thank you, ${HERO}!"`, 'good');
    const p = c.person, target = this.spawn.clone();
    this.anims.push((t, dt) => {
      if (!p.visible) return;
      const d = target.clone().sub(p.position); d.y = 0;
      if (d.length() < 0.6) { p.visible = false; return; }
      d.normalize();
      p.position.addScaledVector(d, dt * 4);
      const gp = p.position.clone(); capsulePush(this.club.collider, gp, 0.3); p.position.x = gp.x; p.position.z = gp.z;
      p.rotation.y = Math.atan2(d.x, d.z);
      p.legs[0].rotation.x = Math.sin(t * 12) * 0.6; p.legs[1].rotation.x = -Math.sin(t * 12) * 0.6;
    });
  }

  objectives() {
    const ev = this.evidence.every((e) => e.done), cap = this.captives.every((c) => c.freed);
    const list = [{ t: 'Get a tip from the informant', done: this.hasCode, target: this.informant.mesh.position }];
    if (this.zone.boss) list.push({ t: `Take down ${this.zone.boss}`, done: this.bossDone, target: this.boss.position });
    list.push({ t: `${this.theme.verb}${this.captives.length ? ` (${this.captives.filter((c) => c.freed).length}/${this.captives.length} freed)` : ''}`, done: ev && cap, target: (this.evidence.find((e) => !e.done) || {}).mesh?.position || (this.captives.find((c) => !c.freed) || {}).person?.position });
    list.push({ t: 'Escape through the entrance', done: false, target: this.exitRing.position, final: true });
    return list;
  }

  allDone() { return this.hasCode && this.bossDone && this.evidence.every((e) => e.done) && this.captives.every((c) => c.freed); }

  /** Pull the camera in when a booth, wall or pillar (below the slice plane) blocks the view. */
  cameraReach(h, off) {
    const d = off.length(), dir = off.clone().normalize();
    const ray = this._cray || (this._cray = new THREE.Raycaster());
    ray.firstHitOnly = true; ray.far = d;
    let reach = d;
    // Check from head and hip height: low booths hide her body even when her head is clear.
    for (const up of [1.3, 0.6]) {
      ray.set(new THREE.Vector3(h.x, h.y + up, h.z), dir);
      const hit = ray.intersectObject(this.club.collider)[0];
      // anything above the slice plane isn't drawn, so it can't block the view
      if (hit && hit.point.y <= h.y + 2.7) reach = Math.min(reach, hit.distance - 0.4);
    }
    return Math.max(1.8, reach);
  }

  // ------------------------------------------------------------------ render
  render() {
    if (!this.scene) return;
    // Slice the building just above her head so the overhead camera looks into the room.
    const y = this.hero.position.y + 2.7;
    if (!this._clip) this._clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), y);
    this._clip.constant = y;
    this.renderer.clippingPlanes = [this._clip];
    super.render();
  }
}
