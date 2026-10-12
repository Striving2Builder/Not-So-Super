// The club engine: a Special3D zone played inside a building of its own instead of the code-built
// venue rooms. The asylum (asylum.js) and the hotel's 13th floor (hotel/) generate theirs
// (loadBuilding). Reuses the whole Special3D toolkit (heroine, guards, items, X-ray, capture) with:
//   * capsule-vs-BVH collision against the building's geometry (with step-up onto stages)
//   * the floor scanned for walkable spots, and gameplay placed only where she can walk
//   * a clipping plane slices the building just above her head so the camera sees into the room
import * as THREE from 'three';
import { Special3D, CAM_DIST, CAM_PITCHES } from './special3d.js';
import { INTOX_ITEMS, BAIT_ITEMS, HERO } from './data.js';
import { pick, shuffle, chance, rand, $ } from './util.js';
import { toast } from './ui.js';
import { sfx } from './sfx.js';
import { STEP, DOWN, capsulePush, reachableFloor } from './clubgeo.js';

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
    this.warming = true;
    this.showLoading();
    this.loadBuilding().then((club) => {
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

  warmUp() {} // (Special3D's: here warmShaders runs once the building has loaded)

  /** The building to play in: a Promise of { scene, collider, floor, mainY, box, … } (each zone generates its own). */
  loadBuilding() { return Promise.reject(new Error('this zone has no building')); }

  /**
   * Compile every shader the building needs before the first frame. Done lazily, the first frame
   * compiles hundreds of programs one after another and freezes for seconds on a slow device;
   * compileAsync lets the driver build them in parallel while the loading bar stays up.
   */
  warmShaders() {
    this.busy = true; // no input while the building is still invisible
    this.setClip(); // clipping planes are part of each shader: compile with the same set
    if (this._loading) this._loading.warming = true;
    const r = this.renderer;
    const compiled = r.compileAsync ? r.compileAsync(this.scene, this.cam) : Promise.resolve();
    return compiled.then(() => this.uploadTextures());
  }

  /** Push the building's textures to the GPU a few at a time (else the first frame uploads them all). */
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

  /** The loading bar: building the scene, then warming up its shaders. */
  showLoading() {
    const el = $('club-loading');
    if (!el) return;
    el.classList.add('on');
    const L = (this._loading = { warming: false });
    const tick = () => {
      if (this._loading !== L) return;
      el.querySelector('.lbl').textContent = L.warming ? 'Warming up…' : 'Building the scene…';
      el.querySelector('i').style.width = L.warming ? '90%' : '75%';
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

  // the camera isn't placed until the first real frame, so markers would land in the wrong spot
  hud() { if (!this.warming) super.hud(); }

  // ------------------------------------------------------------------ world
  detachShared() {
    if (this.club && this.scene) this.scene.remove(this.club.scene); // keep the cached building alive
    if (this.renderer) this.renderer.clippingPlanes = [];
  }

  spawnPoint() { return { pos: this.spawn.clone(), heading: this.spawnHeading }; }

  // ------------------------------------------------------------------ placement
  onMain(p) { return Math.abs(p.y - this.club.mainY) < 0.3; }

  /** Spawn at the entrance end, the exit ring, and the floor she can walk to from there (walkFloor). */
  planLayout() {
    const c = this.club, all = c.floor;
    const near = (p, r) => all.filter((q) => q.distanceToSquared(p) < r * r).length;
    const cz = (c.box.min.z + c.box.max.z) / 2, cx = (c.box.min.x + c.box.max.x) / 2;
    const open = all.filter((p) => this.onMain(p) && near(p, 2.5) >= 14);
    open.sort((a, b) => Math.abs(b.z - cz) - Math.abs(a.z - cz));
    // Spawn toward the entrance end, facing into the building, on the first spot where the normal
    // camera angle behind her is clear AND the camera hangs over the building's own floor (the very
    // end is often right against the outside wall: the camera either squashes into her back or
    // floats outside, looking down on sliced-open walls).
    const facing = (p) => Math.atan2(cx - p.x, cz - p.z);
    const camClear = (p) => {
      this.yaw = facing(p) - Math.PI;
      const off = this.cameraOffset(CAM_PITCHES[0]);
      if (this.cameraReach(p, off) < CAM_DIST * 0.75) return false;
      const gx = p.x + off.x, gz = p.z + off.z;
      return all.some((q) => Math.abs(q.y - p.y) < 0.5 && (q.x - gx) ** 2 + (q.z - gz) ** 2 < 1.5 * 1.5);
    };
    this.spawn = (open.slice(0, 120).find(camClear) || open[0] || all[0]).clone();
    this.spawnHeading = facing(this.spawn);
    // Gameplay is placed only where she can walk from the entrance: the scanned floor also holds
    // stage tops, risers and bar tops a step too high to climb (items used to land there).
    // Same spawn every visit (the pick above is deterministic), so the flood fill is done once per building.
    if (!c.reach || !c.reach.from.equals(this.spawn)) c.reach = { from: this.spawn.clone(), floor: reachableFloor(c.collider, all, this.spawn) };
    this.walkFloor = c.reach.floor.length >= 20 ? c.reach.floor : all;
    this.exitRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x3ee08a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    this.exitRing.rotation.x = -Math.PI / 2;
    this.exitRing.position.set(this.spawn.x, this.spawn.y + 0.04, this.spawn.z);
    this.scene.add(this.exitRing);
  }

  /**
   * Temptations (intoxicating) and bait (maybe a trap) on table tops / counters.
   * `onTake(it)` runs after a temptation is taken (night cases hide notes under drinks).
   */
  placeItems(n, { onTake, intox = INTOX_ITEMS, bait: baitPool = BAIT_ITEMS } = {}) {
    const spots = this.surfaceSpots();
    const count = Math.min(spots.length, n);
    for (let i = 0; i < count; i++) {
      const bait = i === 0 || (i === 3 && chance(0.5));
      const def = bait ? pick(baitPool) : pick(intox);
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

  /**
   * Table tops / counters: upward-facing surfaces 0.55–1.25 m above a floor spot she can walk
   * to within arm's reach (1.3 m; she interacts within 2 m). The middle of a stage or riser is too
   * far from any floor she can stand on, so nothing lands there.
   */
  surfaceSpots() {
    const c = this.club, ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 3;
    const out = [], R = 1.3;
    for (let i = 0; i < 1500 && out.length < 24; i++) {
      const x = rand(c.box.min.x, c.box.max.x), z = rand(c.box.min.z, c.box.max.z);
      ray.set(new THREE.Vector3(x, c.mainY + 2.2, z), DOWN);
      const h = ray.intersectObject(c.collider)[0];
      if (!h || h.face.normal.y < 0.9) continue;
      const stand = this.walkFloor.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < R * R && h.point.y - q.y >= 0.55 && h.point.y - q.y <= 1.25);
      if (!stand) continue;
      if (out.some((o) => o.distanceTo(h.point) < 4)) continue;
      if (h.point.distanceTo(this.spawn) < 5) continue;
      out.push(h.point.clone());
    }
    return shuffle(out);
  }

  // ------------------------------------------------------------------ physics
  collide(p, r) {
    super.collide(p, r);                       // cages and other dynamic boxes
    capsulePush(this.club.collider, p, r);     // the building itself
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
