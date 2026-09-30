// The code-built floor plan shared by the infiltration venues (main hall, back room behind the
// security door, office) and its building helpers (box / cyl / wall), lights and decor hooks.
// Mixed into Special3D.prototype; the venues' art lives in venues3d.js / nightlife.js.
import * as THREE from 'three';
import { WALL_H, lam, basic, canvasTex } from './zonekit.js';
import { NIGHTLIFE_KINDS, decorateNightlife } from './nightlife.js';
import { decorateVenue, VENUE_KINDS } from './venues3d.js';


export const roomMethods = {
  // ------------------------------------------------------------------ building
  /**
   * A box in the scene. While the room is being built (buildRooms/decorate) it's registered as
   * static and merged into one mesh per material afterwards: pass live: true to keep your own
   * mesh (anything you move, recolour or hide later).
   */
  box(w, h, d, x, y, z, mat, { collide = true, wall = false, live = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (this._static && !live) this._static.push(m);
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, wall, mesh: m });
    return m;
  },

  cyl(rt, rb, h, x, y, z, mat, collide = false, live = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (this._static && !live) this._static.push(m);
    if (collide) this.colliders.push({ minX: x - rb, maxX: x + rb, minZ: z - rb, maxZ: z + rb, mesh: m });
    return m;
  },

  wall(x1, z1, x2, z2) {
    const t = 0.4;
    const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t, x = (x1 + x2) / 2, z = (z1 + z2) / 2;
    this.box(w, WALL_H, d, x, WALL_H / 2, z, this.wallMat, { wall: true });
    const M = this.vmats;
    if (!M) return;
    // an ink-black cap (the cutaway reads like a comic floor plan) and skirting on both faces
    this.box(w + 0.06, 0.1, d + 0.06, x, WALL_H + 0.05, z, M.cap, { collide: false });
    if (M.skirt) this.box(w + 0.08, M.skirtH || 0.22, d + 0.08, x, (M.skirtH || 0.22) / 2, z, M.skirt, { collide: false });
    if (M.rail) this.box(w + 0.07, 0.09, d + 0.07, x, M.railY || 1.1, z, M.rail, { collide: false });
    if (M.posts) {
      const len = Math.max(w, d), n = Math.max(1, Math.round(len / M.posts.every));
      for (let i = 0; i <= n; i++) {
        const t = -len / 2 + (i * len) / n;
        this.box(0.14, WALL_H, 0.14, w > d ? x + t : x, WALL_H / 2, w > d ? z : z + t, M.posts.mat, { collide: false });
      }
    }
  },

  buildLights() {
    if (this.vmats) return this.vmats.lights();
    const S = this.scene, V = this.V;
    const bright = V.kind === 'penthouse';
    S.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(V.floor), bright ? 0.55 : 1.0));
    S.add(new THREE.AmbientLight(0xffffff, bright ? 0.15 : 0.35));
    const pos = [[-8, 3, -3], [8, 3, -3], [0, 3, 7], [0, 3, -17]];
    this.plights = pos.map((p, i) => {
      const l = new THREE.PointLight(V.lights[i % V.lights.length], bright ? 14 : 30, 26, 1.3);
      l.position.set(...p);
      S.add(l);
      return l;
    });
    const office = new THREE.PointLight(0xfff0d0, 18, 14, 1.3);
    office.position.set(20, 3, 0);
    S.add(office);
  },

  buildRooms() {
    const V = this.V;
    const tile = V.kind === 'warehouse' || V.kind === 'lair' ? 'concrete' : V.kind === 'penthouse' ? 'marble' : 'tile';
    const floorTex = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = V.floor; c.fillRect(0, 0, w, h);
      if (tile === 'concrete') {
        for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; c.fillRect(Math.random() * w, Math.random() * h, 4, 4); }
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
      } else if (tile === 'marble') {
        c.strokeStyle = 'rgba(120,110,100,.35)'; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(Math.random() * w, 0); c.bezierCurveTo(Math.random() * w, h / 3, Math.random() * w, (2 * h) / 3, Math.random() * w, h); c.stroke(); }
        c.strokeStyle = 'rgba(0,0,0,.2)'; c.strokeRect(0, 0, w, h);
      } else {
        c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2);
        c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
      }
    }, [8, 8]);
    const floorMat = lam(0xffffff, { map: floorTex });
    const M = this.vmats;
    const floor = (w, d, x, z, mat = floorMat, y = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
      this.scene.add(m);
      if (this._static) this._static.push(m);
    };
    floor(30, 24, 0, 0, M ? M.hall : floorMat);
    floor(12, 10, 0, -17, M ? M.back : floorMat);
    floor(10, 10, 20, 0, M ? M.office : floorMat);
    floor(4.4, 3, 0, 13, M ? M.mat : floorMat, 0.004); // entrance mat
    // main hall
    this.wall(-15, -12, -1.6, -12); this.wall(1.6, -12, 15, -12);
    this.wall(-15, 12, -2.2, 12); this.wall(2.2, 12, 15, 12);
    this.wall(-15, -12, -15, 12);
    this.wall(15, -12, 15, -1.8); this.wall(15, 1.8, 15, 12);
    // back room
    this.wall(-6, -22, -6, -12); this.wall(6, -22, 6, -12); this.wall(-6, -22, 6, -22);
    // office
    this.wall(15, -5, 25, -5); this.wall(15, 5, 25, 5); this.wall(25, -5, 25, 5);
    // entrance blocker (invisible) — you leave by finishing or aborting
    this.colliders.push({ minX: -2.2, maxX: 2.2, minZ: 13.6, maxZ: 14.2 });
    // security door + keypad
    this.door = this.box(3.2, 3.2, 0.3, 0, 1.6, -12, M ? M.door : lam(0x5a6270), { live: true });
    this.doorCol = this.colliders[this.colliders.length - 1];
    const stripe = this.box(3.2, 0.25, 0.32, 0, 2.6, -12, M ? M.hazard : basic(0xf2c21a), { collide: false, live: true });
    this.door.add(stripe); stripe.position.set(0, 1, 0);
    this.keypadMesh = this.box(0.35, 0.5, 0.12, 2.1, 1.45, -11.75, basic(0x39ff6a), { collide: false, live: true });
    // exit ring
    this.exitRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), basic(0x3ee08a, { transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    this.exitRing.rotation.x = -Math.PI / 2; this.exitRing.position.set(0, 0.03, 10.8);
    this.scene.add(this.exitRing);
    // venue sign above the door
    const sign = canvasTex(512, 96, (c, w, h) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.font = '900 56px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#' + this.V.lights[0].toString(16).padStart(6, '0'); c.shadowBlur = 20;
      c.fillStyle = c.shadowColor; c.fillText('PRIVATE — STAFF ONLY', w / 2, h / 2);
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), new THREE.MeshBasicMaterial({ map: sign }));
    sm.position.set(0, 3.0, -11.78); this.scene.add(sm);
  },

  decorate() {
    const V = this.V, k = V.kind;
    const spot = (x, y, z) => this.itemSpots.push(new THREE.Vector3(x, y, z));
    const table = (x, z, top = 0x3a2a1a) => {
      this.cyl(0.6, 0.6, 0.08, x, 0.78, z, lam(top));
      this.cyl(0.08, 0.1, 0.78, x, 0.39, z, lam(0x222222), true);
      spot(x, 0.86, z);
    };
    const sofa = (x, z, w, rot, col) => {
      const m = this.box(rot ? 1 : w, 0.6, rot ? w : 1, x, 0.3, z, lam(col));
      const back = this.box(rot ? 0.3 : w, 0.7, rot ? w : 0.3, x + (rot ? rot * 0.35 : 0), 0.85, z + (rot ? 0 : 0.35), lam(col), { collide: false });
      return [m, back];
    };
    const bar = (x, z, len, vertical) => {
      this.box(vertical ? 1.2 : len, 1.1, vertical ? len : 1.2, x, 0.55, z, lam(0x3a1a0a));
      this.box(vertical ? 1.4 : len + 0.2, 0.08, vertical ? len + 0.2 : 1.4, x, 1.12, z, lam(0x8a5a2a), { collide: false });
      for (let i = 0; i < 8; i++) {
        const t = (i / 7 - 0.5) * (len - 1);
        const bx = vertical ? x - 0.9 : x + t, bz = vertical ? z + t : z - 0.9;
        this.cyl(0.06, 0.06, 0.35, bx, 1.35, bz, basic([0x3aff8a, 0xffc040, 0xff5a5a, 0x5ab0ff][i % 4]));
      }
      for (let i = 0; i < 3; i++) spot(vertical ? x : x + (i - 1) * len * 0.3, 1.2, vertical ? z + (i - 1) * len * 0.3 : z);
    };

    if (NIGHTLIFE_KINDS.has(k)) decorateNightlife(this, k, { table, sofa, bar, spot, lam, basic });
    else if (VENUE_KINDS.has(k)) return decorateVenue(this, k, { table, sofa, bar, spot, lam, basic, canvasTex, WALL_H });
    // everywhere: some plants/columns for cover
    for (const [x, z] of [[-14, 11], [14, 11], [-14, -11], [14, -11]]) this.cyl(0.35, 0.35, WALL_H, x, WALL_H / 2, z, lam(0x333333), true);
    // office furniture
    this.box(2.6, 0.8, 1.2, 20, 0.4, 0, lam(0x5a3a1a));
    this.box(0.5, 0.35, 0.05, 20, 1.0, -0.3, basic(0x6ab0ff), { collide: false });
    spot(20.8, 0.82, 0.2);
    // back room
    this.box(12, 0.02, 10, 0, 0.01, -17, lam(0x222222, { transparent: true, opacity: 0.5 }), { collide: false });
  },
};
