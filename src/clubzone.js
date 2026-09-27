// Club Raid: a special zone that takes place inside a premade 3D club (converted from .blend by
// tools/export_club.py). Reuses the whole Special3D toolkit (heroine, guards, informant, items,
// X-ray, boss, capture) but swaps the generated rooms for a real building:
//   * capsule-vs-BVH collision against the actual club geometry (with step-up onto stages)
//   * the floor is scanned for walkable spots, and gameplay is placed on it automatically
//   * a clipping plane slices the building just above her head so the camera sees into the room
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Special3D, CAM_DIST, CAM_PITCHES } from './special3d.js';
import { VENUES, THEMES, INTOX_ITEMS, BAIT_ITEMS, FIRST_NAMES, HERO } from './data.js';
import { pick, shuffle, chance, rand, $ } from './util.js';
import { dialog, toast, banner } from './ui.js';
import { npcLook, portrait } from './art.js';
import { sfx } from './sfx.js';
import { quality } from './settings.js';
import { STEP, DOWN, capsulePush, buildCollider, scanFloor, unpackFloor } from './clubgeo.js';

// Premade clubs. Add more by exporting another .blend with tools/export_club.py, then run
// tools/bake_clubs.js to make the lite (512 px textures) copy and bake the walkable floor.
export const CLUBS = {
  triangle: { file: 'assets/clubs/triangle.glb', lite: 'assets/clubs/triangle.lite.glb', meta: 'assets/clubs/triangle.json' },
  clubhouse: { file: 'assets/clubs/clubhouse.glb', lite: 'assets/clubs/clubhouse.lite.glb', meta: 'assets/clubs/clubhouse.json' },
  stripclub: { file: 'assets/clubs/stripclub.glb', lite: 'assets/clubs/stripclub.lite.glb', meta: 'assets/clubs/stripclub.json' },
};

const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/');

// A club embeds up to ~360 images. GLTFLoader starts decoding them all in one go, which freezes
// the page for up to a second on slow devices, fatal to a background preload mid-flight. So image
// decodes go through a queue: background loads a few at a time, yielding to the frame loop between
// them; the club the player is waiting on (loadClub) at full speed; evicted clubs not at all.
const BACKGROUND_DECODES = 4;
let urgentId = null;
let decoding = 0;
const decodeQueue = []; // { e: entry, run(), skip() }
function pumpDecodes() {
  for (let i = 0; i < decodeQueue.length;) {
    const job = decodeQueue[i];
    if (job.e.cancelled) { decodeQueue.splice(i, 1); job.skip(); continue; }
    if (job.e.id !== urgentId && decoding >= BACKGROUND_DECODES) { i++; continue; }
    decodeQueue.splice(i, 1);
    decoding++;
    job.run().finally(() => { decoding--; setTimeout(pumpDecodes, 0); });
  }
}

/** A GLTFLoader for one club load, with its image decodes routed through the queue. */
function loaderFor(e) {
  return new GLTFLoader().setDRACOLoader(draco).register((parser) => {
    const load = parser.loadImageSource.bind(parser);
    parser.loadImageSource = (index, imgLoader) => new Promise((resolve, reject) => {
      decodeQueue.push({
        e,
        run: () => load(index, imgLoader).then(resolve, reject),
        skip: () => resolve(new THREE.Texture()), // evicted: the scene is about to be disposed anyway
      });
      pumpDecodes();
    });
    return { name: 'queued_image_decode' };
  });
}

// Loading happens in two stages so the slow parts can overlap with flying:
//   fetch  — download + decode the model (async; safe to start mid-flight)   → preloadClub()
//   ready  — build the BVH collider and floor (synchronous; done on entry)     → loadClub()
// Entries are keyed by club + texture variant and evicted (GPU memory freed) beyond the
// profile's clubCache limit, oldest first, never the club being played.
const entries = new Map(); // id → { key, fetch: Promise, ready: Promise|null, used, cancelled, stage, progress }
let activeId = null;

function variantId(key) {
  const q = quality();
  return `${key}:${q.clubTex}:${q.clubMaterials}`;
}

function entryFor(key) {
  const id = variantId(key);
  let e = entries.get(id);
  if (!e) {
    const q = quality(), def = CLUBS[key];
    const file = q.clubTex === 'lite' && def.lite ? def.lite : def.file;
    e = { id, key, ready: null, used: 0, cancelled: false, stage: 'Downloading', progress: 0 };
    const onProgress = (ev) => { if (ev.total) e.progress = ev.loaded / ev.total; };
    e.fetch = Promise.all([loaderFor(e).loadAsync(file, onProgress), fetch(def.meta).then((r) => r.json())]).then(([gltf, meta]) => {
      const scene = gltf.scene;
      const swapped = new Map(); // materials are shared between meshes: simplify each one once
      const simple = (m) => { if (!swapped.has(m)) swapped.set(m, simplify(m, q.clubMaterials)); return swapped.get(m); };
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = true;
        if (q.clubMaterials !== 'full') o.material = Array.isArray(o.material) ? o.material.map(simple) : simple(o.material);
      });
      e.stage = 'Building the club';
      return { scene, meta };
    });
    e.fetch.catch(() => entries.delete(id)); // let a failed download be retried
    entries.set(id, e);
    evict();
  }
  e.used = performance.now();
  return e;
}

/** Loading stage/progress of a club, for the loading bar. */
export function clubProgress(key) { const e = entries.get(variantId(key)); return e ? { stage: e.stage, progress: e.progress } : null; }

/** Start downloading/decoding a club in the background (no-op if it's already on its way). */
export function preloadClub(key) { if (CLUBS[key]) entryFor(key); }

/** A club ready to play: scene, metadata, BVH collider and walkable floor. */
export function loadClub(key) {
  const e = entryFor(key);
  urgentId = e.id; // the player is waiting: decode this club at full speed
  pumpDecodes();
  if (!e.ready) {
    e.ready = e.fetch.then(({ scene, meta }) => {
      const collider = buildCollider(scene);
      // floor baked offline by tools/bake_clubs.js; scan at runtime for clubs that weren't baked
      const { floor, mainY } = meta.floor ? unpackFloor(meta) : scanFloor(scene, collider);
      return { scene, meta, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene) };
    });
    e.ready.catch(() => entries.delete(e.id));
  }
  return e.ready;
}

/**
 * Cheaper stand-in for an exported material. 'standard': physical extras (glass transmission,
 * clearcoat, sheen) go, which also removes the extra transmission render pass. 'lambert': simple
 * diffuse lighting without normal/roughness maps: far fewer and cheaper shaders.
 */
function simplify(m, level) {
  if (!m || !m.isMeshStandardMaterial || (level === 'standard' && !m.isMeshPhysicalMaterial)) return m;
  const glass = m.transmission > 0;
  const common = {
    name: m.name, color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity, alphaMap: m.alphaMap, aoMap: m.aoMap,
    side: m.side, alphaTest: m.alphaTest, vertexColors: m.vertexColors,
    transparent: m.transparent || glass, opacity: glass ? Math.min(m.opacity, 0.3) : m.opacity,
    depthWrite: glass ? false : m.depthWrite,
  };
  const s = level === 'lambert'
    ? new THREE.MeshLambertMaterial(common)
    : new THREE.MeshStandardMaterial({ ...common, roughness: m.roughness, metalness: m.metalness, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, normalMap: m.normalMap, normalScale: m.normalScale });
  s.userData.solid = !(m.transparent && m.opacity < 0.35); // collision follows the original material
  m.dispose();
  return s;
}

function evict() {
  const limit = quality().clubCache;
  const loaded = [...entries.values()].sort((a, b) => a.used - b.used);
  for (const e of loaded) {
    if (entries.size <= limit) break;
    if (e.id === activeId) continue;
    entries.delete(e.id);
    e.cancelled = true;
    pumpDecodes(); // drop its queued decodes
    e.fetch.then(({ scene }) => disposeScene(scene)).catch(() => {});
    if (e.ready) e.ready.then(({ collider }) => collider.geometry.dispose()).catch(() => {});
  }
}

function disposeScene(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
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
    activeId = variantId(key);
    this.warming = true;
    this.showLoading(key);
    loadClub(key).then((club) => {
      if (this.g.mode !== this || this.done) return;
      this.club = club;
      super.enter(p);
      return this.warmShaders().then(() => { this.warming = false; this.busy = false; });
    }).catch((e) => {
      console.error(e);
      toast('Could not load this club', 'bad');
      this.done = true;
      this.g.endZone(zone, { outcome: 'abort', rep: 0 });
    }).finally(() => this.hideLoading());
  }

  /**
   * Compile every shader the club needs before the first frame. Done lazily, the first frame
   * compiles hundreds of programs one after another and freezes for seconds on a slow device;
   * compileAsync lets the driver build them in parallel while the loading bar stays up.
   */
  warmShaders() {
    this.busy = true; // no input while the club is still invisible
    this.setClip(); // clipping planes are part of each shader: compile with the same set
    if (this._loading) this._loading.warming = true;
    const r = this.renderer;
    const compiled = r.compileAsync ? r.compileAsync(this.scene, this.cam) : Promise.resolve();
    return compiled.then(() => this.uploadTextures());
  }

  /** Push the club's textures to the GPU a few at a time (else the first frame uploads them all). */
  uploadTextures() {
    const r = this.renderer, todo = new Set();
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) for (const v of Object.values(m)) if (v && v.isTexture) todo.add(v);
    });
    const list = [...todo];
    return new Promise((resolve) => {
      const step = () => {
        if (this.g.mode !== this || this.done) return resolve();
        const t0 = performance.now();
        while (list.length && performance.now() - t0 < 12) r.initTexture(list.pop());
        if (list.length) requestAnimationFrame(step); else resolve();
      };
      step();
    });
  }

  showLoading(key) {
    const el = $('club-loading');
    if (!el) return;
    el.classList.add('on');
    const L = (this._loading = { warming: false });
    const tick = () => {
      if (this._loading !== L) return;
      const p = L.warming ? { stage: 'Warming up', progress: 1 } : clubProgress(key) || { stage: 'Downloading', progress: 0 };
      const frac = p.stage === 'Downloading' ? 0.6 * p.progress : p.stage === 'Warming up' ? 0.9 : 0.75;
      el.querySelector('.lbl').textContent = p.stage + '…';
      el.querySelector('i').style.width = Math.round(frac * 100) + '%';
      requestAnimationFrame(tick);
    };
    tick();
  }

  hideLoading() {
    this._loading = null;
    const el = $('club-loading');
    if (el) el.classList.remove('on');
  }

  update(dt) {
    if (this.warming) return;
    super.update(dt);
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
    activeId = null;
    urgentId = null; // back to flying: further loads are background preloads
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
    // Spawn toward the entrance end, facing into the club, on the first spot where the normal
    // camera angle behind her is clear AND the camera hangs over the club's own floor (the very
    // end is often right against the outside wall: the camera either squashes into her back or
    // floats outside, looking down on sliced-open walls).
    const facing = (p) => Math.atan2(cx - p.x, cz - p.z);
    const camClear = (p) => {
      this.yaw = facing(p) - Math.PI;
      const off = this.cameraOffset(CAM_PITCHES[0]);
      if (this.cameraReach(p, off) < CAM_DIST * 0.75) return false;
      const gx = p.x + off.x, gz = p.z + off.z;
      return floor.some((q) => Math.abs(q.y - p.y) < 0.5 && (q.x - gx) ** 2 + (q.z - gz) ** 2 < 1.5 * 1.5);
    };
    this.spawn = (open.slice(0, 120).find(camClear) || open[0] || floor[0]).clone();
    this.spawnHeading = facing(this.spawn);
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
        // cheap tests first; raycast only until one clear partner turns up (testing every
        // candidate cost seconds on slow devices)
        const bs = shuffle(floor.filter((b) => Math.abs(b.y - a.y) < 0.2 && a.distanceTo(b) > 6 && a.distanceTo(b) < 14));
        const b = bs.find((q) => this.lineClear(a, q));
        if (b) route = [a.clone(), b.clone()];
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
  /** Slice the building just above her head so the overhead camera looks into the room. */
  setClip() {
    const y = this.hero.position.y + 2.7;
    if (!this._clip) this._clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), y);
    this._clip.constant = y;
    this.renderer.clippingPlanes = [this._clip];
  }

  render() {
    if (!this.scene || this.warming) return;
    this.setClip();
    super.render();
  }
}
