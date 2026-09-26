// Special activity zones: an immersive 3D venue in third person. A multi-step infiltration:
// informant → keycard → security door → evidence/captives (→ boss) → exit, with guards,
// intoxicating temptations and bait items that can get the heroine captured.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { VENUES, THEMES, INTOX_ITEMS, BAIT_ITEMS, HERO, FIRST_NAMES, LAST_NAMES } from './data.js';
import { pick, shuffle, chance, clamp, rand, wobble, $ } from './util.js';
import { dialog, toast, banner, qte, keypad, flash } from './ui.js';
import { drawEmblem, portrait, npcLook } from './art.js';
import { sfx } from './sfx.js';

const WALL_H = 3.4;
const SPEED = 5.2;
const GUARD_RANGE = 7.5;
const GUARD_FOV = 1.05;

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });

function segHitsBox(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, mn, mx] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) return false; }
    else {
      let ta = (mn - p) / d, tb = (mx - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export class Special3D {
  constructor(g) { this.g = g; }

  initRenderer() {
    if (this.renderer) return;
    // One WebGL renderer shared by every 3D mode (special zones and club raids).
    if (!Special3D.sharedRenderer) {
      const r = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      r.outputColorSpace = THREE.SRGBColorSpace;
      $('three-host').appendChild(r.domElement);
      Special3D.sharedRenderer = r;
    }
    this.renderer = Special3D.sharedRenderer;
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    this.renderer.setSize(this.g.w, this.g.h, false);
    if (this.cam) { this.cam.aspect = this.g.w / this.g.h; this.cam.updateProjectionMatrix(); }
  }

  enter({ zone }) {
    const g = this.g;
    this.initRenderer();
    document.body.classList.add('three');
    this.zone = zone;
    this.V = VENUES[zone.venue];
    this.theme = this.themeFor(zone);
    Object.assign(this, {
      done: false, busy: false, t: 0, alert: 0, en: 100, xray: false, inside: 0, bonus: 0, wrong: 0,
      hasCode: false, hasKey: false, doorOpen: false, bossDone: !zone.boss, bossMet: false, punchT: 0,
      code: String(1000 + Math.floor(Math.random() * 9000)),
      colliders: [], inter: [], guards: [], anims: [], hidden: [], itemSpots: [], evidence: [], captives: [],
      // per-zone references: this object is reused for every zone, so nothing may carry over
      boss: null, informant: null, near: null, _lastGood: null,
    });
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color(this.V.bg);
    S.fog = new THREE.Fog(this.V.bg, 24, 62);
    this.cam = new THREE.PerspectiveCamera(58, g.w / g.h, 0.1, 160);
    this.resize();
    this.buildWorld();
    this.heroModel = heroReady() ? new HeroModel() : null;
    this.keepAnimating = false;
    this.landT = 0;
    if (this.heroModel) {
      this.hero = new THREE.Group();
      this.hero.add(this.heroModel.root);
      this.heroClip('land', 1.4); // she arrives with a superhero landing
    } else this.hero = this.makeHero();
    const sp = this.spawnPoint();
    this.hero.position.copy(sp.pos);
    this.hero.rotation.y = sp.heading;
    this.yaw = sp.heading - Math.PI; // camera behind her
    S.add(this.hero);

    g.input.setStick(true);
    this.setupControls();
    $('hud-title').textContent = zone.name;
    $('objectives').classList.add('on');
    this.announce();
  }

  // ---- presentation hooks (night cases override these)
  themeFor(zone) { return THEMES[zone.theme]; }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'punch', label: 'PUNCH', key: 'F' },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Guard alert</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    banner(this.zone.venue.toUpperCase(), `${this.theme.name} · Risk of capture`, '#ff3fb8');
    setTimeout(() => { if (!this.done) toast('Drag the screen to turn the camera. Stay out of the guards\' vision cones.', 'info'); }, 1600);
  }

  // ---- overridable world hooks (ClubZone replaces these with a premade building)
  buildWorld() {
    this.wallMat = this.V.kind === 'penthouse'
      ? lam(0x9fd0ff, { transparent: true, opacity: 0.28 })
      : lam(this.V.wall);
    this.wallBaseOpacity = this.wallMat.opacity;
    this.buildLights();
    this.buildRooms();
    this.decorate();
    this.placeGameplay();
  }

  spawnPoint() { return { pos: new THREE.Vector3(0, 0, 10), heading: Math.PI }; }

  /** How far the camera may sit from her along `off` (club raids shorten it past obstacles). */
  cameraReach(h, off) { return off.length(); }

  /** Should the boss confrontation start now? */
  bossTrigger(h) { return this.doorOpen && h.position.z < -13; }

  /** Anything to pull out of the scene before it's disposed (e.g. a cached building). */
  detachShared() {}

  exit() {
    this.detachShared();
    document.body.classList.remove('three');
    $('marker').classList.remove('on');
    $('xray-tint').classList.remove('on');
    $('objectives').classList.remove('on');
    $('prompt').classList.remove('on');
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      this.scene = null;
    }
    this.renderer && this.renderer.renderLists.dispose();
  }

  // ------------------------------------------------------------------ building
  box(w, h, d, x, y, z, mat, { collide = true, wall = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (collide) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, wall, mesh: m });
    return m;
  }

  cyl(rt, rb, h, x, y, z, mat, collide = false) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), mat);
    m.position.set(x, y, z);
    this.scene.add(m);
    if (collide) this.colliders.push({ minX: x - rb, maxX: x + rb, minZ: z - rb, maxZ: z + rb, mesh: m });
    return m;
  }

  wall(x1, z1, x2, z2) {
    const t = 0.4;
    const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t;
    this.box(w, WALL_H, d, (x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2, this.wallMat, { wall: true });
  }

  buildLights() {
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
  }

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
    const floor = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z);
      this.scene.add(m);
    };
    floor(30, 24, 0, 0);
    floor(12, 10, 0, -17);
    floor(10, 10, 20, 0);
    floor(4.4, 3, 0, 13); // entrance mat
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
    this.door = this.box(3.2, 3.2, 0.3, 0, 1.6, -12, lam(0x5a6270));
    this.doorCol = this.colliders[this.colliders.length - 1];
    const stripe = this.box(3.2, 0.25, 0.32, 0, 2.6, -12, basic(0xf2c21a), { collide: false });
    this.door.add(stripe); stripe.position.set(0, 1, 0);
    this.keypadMesh = this.box(0.35, 0.5, 0.12, 2.1, 1.45, -11.75, basic(0x39ff6a), { collide: false });
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
  }

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

    if (k === 'club' || k === 'gentlemens' || k === 'redlight') {
      bar(-13, -1, 11, true);
      if (k === 'club') {
        this.tiles = [];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), basic(0xffffff));
          m.rotation.x = -Math.PI / 2; m.position.set(-3 + i * 1.2 + 0.6 - 0.6, 0.02, -2.5 + j * 1.2);
          this.scene.add(m); this.tiles.push(m);
        }
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), lam(0xdddddd, { emissive: 0x555555 }));
        this.ball.position.set(0, 3.1, 0.5); this.scene.add(this.ball);
        this.box(3.5, 1.2, 1.4, -8, 0.6, -10.2, lam(0x222233));
        this.box(3.3, 0.1, 1.2, -8, 1.25, -10.2, basic(0x27e0ff), { collide: false });
        for (const x of [-10.5, -5.5]) this.box(0.9, 2, 0.9, x, 1, -10.8, lam(0x111111));
      }
      if (k === 'gentlemens') {
        this.box(4, 0.5, 8, 11.5, 0.25, -3, lam(0x3a1a2a));
        for (const z of [-7.2, 1.2]) this.box(0.3, 3.2, 1.2, 13.2, 1.6, z, lam(0xa0204a), { collide: false });
        this.cyl(0.06, 0.06, 3, 11.5, 1.5, -3, lam(0xdddddd));
        for (let i = 0; i < 4; i++) table(3 + (i % 2) * 3.5, -6 + Math.floor(i / 2) * 5, 0x1a1a1a);
      }
      if (k === 'redlight') {
        for (let i = 0; i < 6; i++) {
          const x = -12 + i * 4.8;
          this.box(1.6, 3.2, 0.2, x, 1.6, 11.7, lam(0xb01030), { collide: false });
          const lan = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basic(0xff3355));
          lan.position.set(x, 2.8, 10.5); this.scene.add(lan);
        }
        for (let i = 0; i < 3; i++) table(4 + i * 3.2, -6, 0x5a0a1a);
      }
      sofa(12, 7, 5, -1, k === 'redlight' ? 0x8a1a2a : 0x4a2a6a);
      sofa(12, -7, 4, -1, k === 'redlight' ? 0x8a1a2a : 0x4a2a6a);
      for (let i = 0; i < 3; i++) table(-5 + i * 5, 7);
    } else if (k === 'warehouse') {
      const r = () => rand(-0.3, 0.3);
      const crates = [[-11, -8], [-11, -5], [-8, -8], [10, 8], [10, 5], [7, 9], [-10, 7], [-7, 8], [11, -8], [8, -6], [4, 7], [-4, -7]];
      for (const [x, z] of crates) {
        const h = chance(0.5) ? 2 : 1;
        for (let i = 0; i < h; i++) this.box(1.4, 1.2, 1.4, x + r(), 0.6 + i * 1.2, z + r(), lam([0x8a6a3a, 0x7a5a2a, 0x3a5a3a][(x + z + i) & 1 ? 0 : 2]), { collide: i === 0 });
        spot(x, h * 1.2 + 0.02, z);
      }
      for (const x of [-3, 3]) {
        this.box(0.3, 3, 6, x, 1.5, 1, lam(0x3a4a8a));
        for (let y = 0.4; y < 3; y += 0.9) this.box(1.3, 0.06, 6, x, y, 1, lam(0xd07a2a), { collide: false });
      }
      this.box(1.6, 1.4, 2.6, 7, 0.7, -2, lam(0xf2c21a));
      this.box(0.1, 2.4, 1.2, 7, 1.2, -3.4, lam(0x333333), { collide: false });
    } else if (k === 'penthouse') {
      const lights = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * Math.PI * 2, d = rand(30, 55);
        pts.push(Math.cos(a) * d, rand(-18, 6), Math.sin(a) * d);
      }
      lights.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.scene.add(new THREE.Points(lights, new THREE.PointsMaterial({ color: 0xffd98a, size: 0.35 })));
      this.box(8, 0.03, 5, 4, 0.02, 3, lam(0x7a2a2a), { collide: false });
      sofa(4, 5.8, 5, 0, 0xe8e0d0);
      sofa(7.5, 3, 4, -1, 0xe8e0d0);
      table(4, 3, 0xffffff);
      this.box(2.2, 1, 1.4, -9, 0.5, 6, lam(0x111111));
      this.box(2.2, 0.06, 1.6, -9, 1.2, 6.3, lam(0x111111), { collide: false });
      bar(-12.5, -5, 7, true);
      table(9, -7, 0xffffff); table(-4, -6, 0xffffff);
    } else if (k === 'lair') {
      for (let x = -13; x <= 13; x += 2.2) if (Math.abs(x) > 2) this.cyl(0.12, 0.12, 3.2, x, 1.6, -11.4, basic(0x2a8a3a));
      for (let z = -10; z <= 10; z += 2.5) this.cyl(0.12, 0.12, 3.2, -14.4, 1.6, z, basic(0x2a8a3a));
      for (let i = 0; i < 3; i++) {
        this.box(2.5, 1.3, 1, -9 + i * 3, 0.65, -9.8, lam(0x2a322c));
        this.box(2.3, 0.9, 0.05, -9 + i * 3, 1.8, -10.2, basic(0x39ff6a), { collide: false });
        spot(-9 + i * 3, 1.32, -9.6);
      }
      for (const [x, z] of [[10, 6], [10, -4], [-10, 6]]) {
        this.cyl(1, 1, 3, x, 1.5, z, lam(0x39ff6a, { transparent: true, opacity: 0.45, emissive: 0x0a3a14 }), true);
        this.cyl(1.05, 1.05, 0.2, x, 3.05, z, lam(0x333333));
      }
      const screen = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#021'; c.fillRect(0, 0, w, h); c.fillStyle = '#39ff6a'; c.font = '900 80px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('☠', w / 2, h / 2); });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: screen }));
      sm.position.set(0, 2.4, 11.75); sm.rotation.y = Math.PI; this.scene.add(sm);
      for (let i = 0; i < 3; i++) table(-2 + i * 4, 4, 0x2a322c);
    } else if (k === 'casino') {
      for (let i = 0; i < 4; i++) {
        const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8;
        this.cyl(1.5, 1.5, 0.1, x, 0.85, z, lam(0x1a6a3a));
        this.cyl(0.25, 0.3, 0.85, x, 0.42, z, lam(0x3a2410), true);
        this.colliders.push({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 });
        spot(x + 0.6, 0.92, z);
      }
      for (let i = 0; i < 6; i++) {
        this.box(0.9, 1.9, 0.8, -13.6, 0.95, -8 + i * 2, lam(0x8a1a2a));
        this.box(0.05, 0.6, 0.6, -13.1, 1.3, -8 + i * 2, basic(0xffd84d), { collide: false });
      }
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), basic(0xfff1c0));
      ch.position.set(0, 3.1, 0); this.scene.add(ch);
      bar(11, 4, 7, true);
    }
    // everywhere: some plants/columns for cover
    for (const [x, z] of [[-14, 11], [14, 11], [-14, -11], [14, -11]]) this.cyl(0.35, 0.35, WALL_H, x, WALL_H / 2, z, lam(0x333333), true);
    // office furniture
    this.box(2.6, 0.8, 1.2, 20, 0.4, 0, lam(0x5a3a1a));
    this.box(0.5, 0.35, 0.05, 20, 1.0, -0.3, basic(0x6ab0ff), { collide: false });
    spot(20.8, 0.82, 0.2);
    // back room
    this.box(12, 0.02, 10, 0, 0.01, -17, lam(0x222222, { transparent: true, opacity: 0.5 }), { collide: false });
  }

  // ------------------------------------------------------------------ characters
  emblemTex() {
    return canvasTex(128, 128, (c) => { c.translate(64, 60); drawEmblem(c, 44); });
  }

  makeHero() {
    const G = new THREE.Group();
    const skin = lam(0xf6d1b3), blue = lam(0x7ec8f4), red = lam(0xd82630), boots = lam(0xc91f2b), gold = lam(0xf7d31e), hair = lam(0xf5d442);
    const add = (geo, mat, x, y, z, parent = G) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const leg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.92, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 10), skin, 0, -0.22, 0, p);
      add(new THREE.CylinderGeometry(0.08, 0.065, 0.48, 10), boots, 0, -0.67, 0, p);
      add(new THREE.BoxGeometry(0.12, 0.07, 0.2), boots, 0, -0.9, 0.05, p);
      return p;
    };
    this.legL = leg(-0.1); this.legR = leg(0.1);
    add(new THREE.CylinderGeometry(0.19, 0.28, 0.22, 16), red, 0, 0.93, 0);
    add(new THREE.CylinderGeometry(0.195, 0.195, 0.06, 16), gold, 0, 1.05, 0);
    const torso = add(new THREE.CylinderGeometry(0.2, 0.16, 0.52, 14), blue, 0, 1.33, 0);
    torso.scale.z = 0.8;
    add(new THREE.SphereGeometry(0.085, 10, 8), blue, -0.075, 1.43, 0.1);
    add(new THREE.SphereGeometry(0.085, 10, 8), blue, 0.075, 1.43, 0.1);
    const em = add(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: this.emblemTex(), transparent: true }), 0, 1.42, 0.19);
    em.rotation.x = -0.1;
    const arm = (x) => {
      const p = new THREE.Group(); p.position.set(x, 1.55, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.055, 0.05, 0.56, 8), blue, 0, -0.28, 0, p);
      add(new THREE.SphereGeometry(0.058, 8, 6), skin, 0, -0.58, 0, p);
      return p;
    };
    this.armL = arm(-0.26); this.armR = arm(0.26);
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 8), skin, 0, 1.63, 0);
    add(new THREE.SphereGeometry(0.14, 14, 12), skin, 0, 1.78, 0.01);
    const h1 = add(new THREE.SphereGeometry(0.155, 14, 12), hair, 0, 1.81, -0.025); h1.scale.set(1, 0.95, 1);
    add(new THREE.BoxGeometry(0.28, 0.42, 0.08), hair, 0, 1.6, -0.13);
    for (const x of [-0.05, 0.05]) add(new THREE.SphereGeometry(0.018, 6, 4), lam(0x1a4aa8), x, 1.79, 0.135);
    this.cape = new THREE.Group(); this.cape.position.set(0, 1.56, -0.17); G.add(this.cape);
    add(new THREE.PlaneGeometry(0.52, 1.0), lam(0xc11d27, { side: THREE.DoubleSide }), 0, -0.5, 0, this.cape);
    return G;
  }

  makeNPC(look, size = 1) {
    const G = new THREE.Group();
    const col = (c) => parseInt(c.slice(1), 16);
    const skin = lam(col(look.skin)), top = lam(col(look.top)), bottom = lam(col(look.bottom || look.skirt || '#333333'));
    const add = (geo, mat, x, y, z, p = G) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
    G.legs = [];
    for (const x of [-0.12, 0.12]) {
      const p = new THREE.Group(); p.position.set(x, 0.9, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.09, 0.08, 0.9, 8), look.skirt ? skin : bottom, 0, -0.45, 0, p);
      G.legs.push(p);
    }
    add(new THREE.BoxGeometry(0.5, 0.65, 0.3), top, 0, 1.25, 0);
    G.arms = [];
    for (const x of [-0.31, 0.31]) {
      const p = new THREE.Group(); p.position.set(x, 1.52, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.06, 0.055, 0.6, 8), top, 0, -0.3, 0, p);
      add(new THREE.SphereGeometry(0.06, 8, 6), skin, 0, -0.62, 0, p);
      G.arms.push(p);
    }
    add(new THREE.SphereGeometry(0.15, 12, 10), skin, 0, 1.77, 0);
    if (look.hairStyle !== 'bald') {
      const hm = add(new THREE.SphereGeometry(0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(col(look.hair)), 0, 1.79, -0.01);
      if (look.hairStyle === 'long') add(new THREE.BoxGeometry(0.3, 0.4, 0.08), lam(col(look.hair)), 0, 1.6, -0.13);
      hm.scale.y = 1.1;
    }
    if (look.shades) add(new THREE.BoxGeometry(0.26, 0.06, 0.04), lam(0x050505), 0, 1.8, 0.14);
    else for (const x of [-0.05, 0.05]) add(new THREE.SphereGeometry(0.02, 6, 4), lam(0x111111), x, 1.79, 0.14);
    if (look.tie) add(new THREE.BoxGeometry(0.06, 0.4, 0.02), lam(col(look.tie)), 0, 1.3, 0.16);
    G.scale.setScalar(size * (look.size || 1));
    this.scene.add(G);
    return G;
  }

  // ------------------------------------------------------------------ gameplay setup
  placeGameplay() {
    const z = this.zone, th = this.theme, V = this.V;
    // Informant
    const spots = shuffle([[-11, 4], [10, 9], [-11, -6], [9, -9], [5, 5], [-5, 9]]);
    const [ix, iz] = spots[0];
    const infLook = npcLook('civilian');
    const inf = (this.informant = { mesh: this.makeNPC(infLook), look: infLook, name: `${pick(FIRST_NAMES)} "${pick(['Whispers', 'Ears', 'Lucky', 'Two-Tone', 'Slick', 'Canary'])}"`, works: pick(['charm', 'press']), burned: false });
    inf.mesh.position.set(ix, 0, iz);
    inf.mesh.rotation.y = Math.atan2(-ix, -iz);
    this.addInter(inf.mesh.position, 'Talk to the informant', () => !this.hasCode || true, () => this.talkInformant(), 'informant');

    // Guards
    // Patrol routes stay clear of the entrance so nobody spots you the moment you arrive.
    const routes = shuffle([
      [[-10, -8], [10, -8]], [[12, 6], [12, -9]], [[-12, 5], [-5, 1], [-12, -5]],
      [[17, -3], [23, 3], [17, 3]], [[-6, -3], [6, -3]], [[5, -10], [5, 2]],
    ]);
    const nG = Math.min(5, 2 + (z.boss ? 1 : 0) + (th.extraGuards || 0) + (chance(0.5) ? 1 : 0));
    for (let i = 0; i < nG; i++) {
      const route = routes[i].map(([x, zz]) => new THREE.Vector3(x, 0, zz));
      const mesh = this.makeNPC(npcLook('guard'));
      mesh.position.copy(route[0]);
      const cone = new THREE.Mesh(
        new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2),
        basic(0xffe040, { transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = 0.04;
      mesh.add(cone);
      this.guards.push({ mesh, cone, route, wp: 1, ko: false, look: 0, seeing: false, t: rand(0, 3) });
    }

    // Office containers: one keycard, one gas trap
    const cont = shuffle(['key', 'trap', 'empty', 'empty']);
    const defs = [['Filing Cabinet', 16.3, -4.2, 0x7d8590, [0.9, 1.6, 0.6]], ['Staff Locker', 23.7, -4.2, 0x4a6a8a, [0.8, 2, 0.6]], ['Wall Safe', 23.7, 4.2, 0x333333, [0.9, 0.9, 0.6]], ['Desk Drawer Unit', 16.3, 4.2, 0x6a4a2a, [0.9, 0.8, 0.6]]];
    this.containers = defs.map(([name, x, zz, c, [w, h, d]], i) => {
      const mesh = this.box(w, h, d, x, h / 2, zz, lam(c));
      const content = cont[i];
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), basic(content === 'key' ? 0x40e0ff : content === 'trap' ? 0xff4db8 : 0x444444, { depthTest: false, transparent: true, opacity: 0.95 }));
      inner.position.set(x, h / 2, zz); inner.renderOrder = 10; inner.visible = false;
      this.scene.add(inner);
      if (content !== 'empty') this.hidden.push(inner);
      const o = { name, mesh, content, opened: false, inner };
      this.addInter(new THREE.Vector3(x, 0, zz), `Search the ${name.toLowerCase()}`, () => !o.opened, () => this.searchContainer(o));
      return o;
    });

    // Tempting items and bait
    const spotsI = shuffle([...this.itemSpots]);
    const nItems = Math.min(spotsI.length, 3 + (th.extraTraps || 0));
    for (let i = 0; i < nItems; i++) {
      const bait = i === 0 || (i === 3 && chance(0.5));
      const def = bait ? pick(BAIT_ITEMS) : pick(INTOX_ITEMS);
      const p = spotsI[i];
      const trapped = bait ? chance(0.6) : false;
      const col = bait ? 0xffd84d : 0xff7ad0;
      const mesh = new THREE.Mesh(bait ? new THREE.BoxGeometry(0.4, 0.25, 0.3) : new THREE.CylinderGeometry(0.07, 0.05, 0.28, 10), lam(col, { emissive: col, emissiveIntensity: 0.4 }));
      mesh.position.set(p.x, p.y + 0.14, p.z);
      this.scene.add(mesh);
      const aura = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), basic(trapped ? 0xff2020 : bait ? 0xffd84d : 0xff4db8, { depthTest: false, transparent: true }));
      aura.rotation.x = -Math.PI / 2; aura.position.set(p.x, p.y + 0.05, p.z); aura.renderOrder = 11; aura.visible = false;
      this.scene.add(aura); this.hidden.push(aura);
      const it = { def, bait, trapped, mesh, aura, taken: false };
      this.anims.push((t) => { mesh.rotation.y = t * 1.5; mesh.position.y = p.y + 0.16 + Math.sin(t * 3 + p.x) * 0.04; });
      this.addInter(new THREE.Vector3(p.x, 0, p.z), `Examine: ${def.name}`, () => !it.taken, () => this.takeItem(it));
    }

    // Back room: evidence + captives
    const ev = th.evidence;
    ev.forEach((name, i) => {
      const x = ev.length === 1 ? 0 : -2.2 + i * 4.4, zz = -20;
      this.box(1, 0.9, 1, x, 0.45, zz, lam(0x333333));
      const glowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), lam(0x39ff6a, { emissive: 0x39ff6a, emissiveIntensity: 0.6 }));
      glowMesh.position.set(x, 1.12, zz); this.scene.add(glowMesh);
      const e = { name, mesh: glowMesh, done: false };
      this.evidence.push(e);
      this.addInter(new THREE.Vector3(x, 0, zz + 0.8), `${th.mind && i === 0 ? 'Smash' : 'Secure'}: ${name}`, () => !e.done, () => this.secureEvidence(e), 'evidence');
    });
    const cageSpots = [[-4.4, -14.6], [4.4, -14.6], [-4.4, -19], [4.4, -19]];
    for (let i = 0; i < (th.captives || 0); i++) {
      const [x, zz] = cageSpots[i];
      const person = this.makeNPC(npcLook('civilian'));
      person.position.set(x, 0, zz);
      person.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.4), new THREE.MeshBasicMaterial({ color: 0x999999, wireframe: true }));
      cage.position.set(x, 1.15, zz); this.scene.add(cage);
      this.colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: zz - 0.7, maxZ: zz + 0.7, mesh: cage });
      const c = { person, cage, freed: false, x, z: zz };
      this.captives.push(c);
      this.addInter(new THREE.Vector3(x + (x < 0 ? 1.1 : -1.1), 0, zz), th.mind ? 'Snap them out of the trance' : 'Break open the cage', () => !c.freed, () => this.freeCaptive(c), 'captive');
    }
    // Boss
    if (z.boss) {
      this.boss = this.makeNPC(npcLook('boss'));
      this.boss.position.set(0, 0, -21.2);
    }
    this.keypadInter = this.addInter(new THREE.Vector3(2.1, 0, -11), 'Use the security door', () => !this.doorOpen, () => this.useDoor(), 'door');
  }

  addInter(pos, label, can, act, tag) {
    const o = { pos: pos.clone ? pos.clone() : pos, label, can, act, tag };
    o.pos.y = 0;
    this.inter.push(o);
    return o;
  }

  // ------------------------------------------------------------------ interactions
  async talkInformant() {
    const inf = this.informant;
    if (this.hasCode) {
      await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: `"The code is <b>${this.code}</b>. The keycard's somewhere in the office. Now get lost before they see us together."` });
      return;
    }
    const hint = inf.works === 'charm'
      ? 'They keep glancing at the back room door, guilt written all over their face.'
      : 'They\'re sweating and their eyes dart to every exit. A coward.';
    const v = await dialog({
      speaker: `Informant · ${inf.name}`, portrait: portrait(inf.look),
      text: `"Psst. Hero. You want in the back room? Whole ${this.theme.name.toLowerCase()} racket runs through there. I know the door code… but talk ain't cheap in here."<span class="hint">${hint}</span>`,
      options: [
        { label: '"Have a drink with me first." — Accept the drink', note: '+25 intoxication, guaranteed code', value: 'drink', cls: 'risky' },
        { label: 'Appeal to their conscience', value: 'charm', disabled: inf.burned },
        { label: 'Pin them against the wall', value: 'press', disabled: inf.burned },
        { label: 'Walk away', value: null },
      ],
    });
    if (!v) return;
    if (v === 'drink') {
      sfx.drink();
      this.g.state.addIntox(25);
      toast('🥴 Intoxication +25', 'bad');
      this.hasCode = true;
    } else if (v === inf.works) this.hasCode = true;
    else {
      inf.burned = true;
      this.alert = Math.min(99, this.alert + 30);
      sfx.alarm();
      await dialog({ speaker: inf.name, text: '"Hey! Keep it down!" Heads turn toward you.<span class="hint">Guard alert +30. They\'ll only talk over a drink now.</span>' });
      return;
    }
    sfx.pickup();
    await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: `"Alright, alright. The back room code is <b>${this.code}</b>. You'll need the keycard too — the manager keeps it in the office. Watch the guards."` });
  }

  async searchContainer(o) {
    const hint = this.xray
      ? (o.content === 'key' ? '<span class="hint">X-ray: a keycard is inside!</span>' : o.content === 'trap' ? '<span class="hint">X-ray: a pressurized gas canister is rigged to the latch.</span>' : '<span class="hint">X-ray: nothing but paper.</span>')
      : '<span class="hint">X-ray vision would show you what\'s inside.</span>';
    const v = await dialog({ title: o.name, text: `It's closed.${hint}`, options: [{ label: 'Open it', value: true }, { label: 'Leave it', value: false }] });
    if (!v) return;
    o.opened = true;
    o.inner.visible = false;
    this.hidden = this.hidden.filter((h) => h !== o.inner);
    o.mesh.rotation.y = 0.25;
    if (o.content === 'key') { this.hasKey = true; sfx.pickup(); await dialog({ title: 'Keycard found!', text: 'A security keycard for the back room.' }); }
    else if (o.content === 'trap') { sfx.trap(); this.g.state.addIntox(28); toast('🥴 Knockout gas! Intoxication +28', 'bad'); }
    else toast('Empty — just old receipts.', 'info');
  }

  async takeItem(it) {
    const d = it.def;
    const note = it.bait ? 'Could be evidence (+15)… or a trap' : `+${d.intox} intoxication${d.perk === 'rep' ? ', +2 rep' : d.perk === 'energy' ? ', recharges power' : ''}`;
    const xr = this.xray ? (it.bait ? (it.trapped ? '<span class="hint">X-ray: wires and a tracking beacon — it\'s bait!</span>' : '<span class="hint">X-ray: looks clean.</span>') : '<span class="hint">X-ray: chemical traces.</span>') : '';
    const v = await dialog({ title: d.name, text: d.desc + xr, options: [{ label: 'Take it', note, value: true, cls: 'risky' }, { label: 'Leave it', value: false }] });
    if (!v) return;
    it.taken = true;
    it.mesh.visible = false; it.aura.visible = false;
    this.hidden = this.hidden.filter((h) => h !== it.aura);
    if (it.bait) {
      if (it.trapped) { this.capture(`The ${d.name.toLowerCase()} was bait! A net drops from the ceiling and the guards pile on.`); return; }
      this.bonus += 15; sfx.pickup(); toast('Evidence! +15 rep when you finish', 'good');
    } else {
      sfx.drink();
      this.g.state.addIntox(d.intox);
      toast(`🥴 Intoxication +${d.intox}`, 'bad');
      if (d.perk === 'rep') this.g.state.addRep(2, 'The crowd cheers you');
      if (d.perk === 'energy') this.en = 100;
    }
  }

  async useDoor() {
    if (this.doorOpen) return;
    const opts = [];
    if (this.hasKey) opts.push({ label: 'Swipe the keycard & enter a code', value: 'code' });
    opts.push({ label: 'Smash it down', note: 'Very loud: guard alert +60', value: 'smash', cls: 'risky' });
    opts.push({ label: 'Step away', value: null });
    const v = await dialog({
      title: 'Security Door',
      text: `Reinforced steel. A keycard reader and a keypad.${this.hasKey ? ' You have the keycard.' : ' You need the <b>keycard</b> (try the office).'}${this.hasCode ? ` The code is <b>${this.code}</b>.` : ' You don\'t know the <b>code</b> (the informant does).'}`,
      options: opts,
    });
    if (v === 'smash') {
      sfx.hit(); sfx.alarm();
      this.alert = Math.min(99, this.alert + 60);
      this.openDoor();
      toast('CRASH! Everyone heard that.', 'bad');
    } else if (v === 'code') {
      const code = await keypad(this.hasCode ? `Enter code (${this.code})` : 'Enter 4-digit code');
      if (code === null) return;
      if (code === this.code) { this.openDoor(); toast('Access granted', 'good'); }
      else { this.wrong++; this.alert = Math.min(99, this.alert + 25); sfx.alarm(); toast('ACCESS DENIED — the alarm chirps!', 'bad'); }
    }
  }

  openDoor() {
    this.doorOpen = true;
    this.doorCol.disabled = true;
    this.keypadMesh.material.color.set(0x3ee08a);
    sfx.door();
    const d = this.door;
    this.anims.push(() => { if (d.position.y < 5) d.position.y += 0.06; });
  }

  async secureEvidence(e) {
    const th = this.theme;
    const v = await dialog({ title: e.name, text: `This is it — the proof behind the ${th.name.toLowerCase()} operation.`, options: [{ label: th.mind ? 'Smash it with super-strength' : 'Secure it for the police', value: true }, { label: 'Not yet', value: false }] });
    if (!v) return;
    e.done = true; e.mesh.visible = false;
    sfx.pickup(); flash('#3ee08a');
    toast(`${e.name} secured`, 'good');
  }

  async freeCaptive(c) {
    c.freed = true;
    c.cage.visible = false;
    this.colliders = this.colliders.filter((col) => col.mesh !== c.cage);
    sfx.hit();
    toast(this.theme.mind ? 'They blink awake: "Where… where am I?"' : '"Thank you, Supergirl!"', 'good');
    const p = c.person;
    this.anims.push((t, dt) => {
      if (!p.visible) return;
      const target = new THREE.Vector3(0, 0, 13);
      const d = target.clone().sub(p.position);
      if (d.length() < 0.5) { p.visible = false; return; }
      const via = p.position.z < -12.5 && Math.abs(p.position.x) > 0.8 ? new THREE.Vector3(0, 0, p.position.z) : target;
      const dir = via.clone().sub(p.position).normalize();
      p.position.addScaledVector(dir, dt * 4);
      p.rotation.y = Math.atan2(dir.x, dir.z);
      p.legs[0].rotation.x = Math.sin(t * 12) * 0.6; p.legs[1].rotation.x = -Math.sin(t * 12) * 0.6;
    });
  }

  async bossFight() {
    this.bossMet = true;
    const name = this.zone.boss, th = this.theme;
    const lines = {
      hypnosis: '"Look into my eyes, darling… you are getting very… sleepy…"',
      mindcontrol: '"One press of this button and you\'ll be MY hero. Obedient. Adoring."',
      blackmail: '"I have photos of half this city. By tomorrow, I\'ll have some of you."',
      intoxication: '"Relax, have a drink. Everybody does, eventually."',
    };
    const v = await dialog({
      title: name, speaker: 'BOSS', cls: 'villain',
      text: `${lines[th.name === 'Hypnosis' ? 'hypnosis' : th.mind ? 'mindcontrol' : th.name === 'Blackmail' ? 'blackmail' : th.name === 'Spiked Drinks' ? 'intoxication' : 'blackmail'] || '"Well, well. The famous hero walks right into my parlor."'}`,
      options: [
        { label: `"It's over, ${name}!" — Attack`, value: 'fight' },
        { label: '"The police are right behind me." — Bluff', note: 'Works if you haven\'t raised the alarm much', value: 'bluff' },
        { label: 'Accept a "truce" drink', note: '+30 intoxication — the boss relaxes', value: 'drink', cls: 'risky' },
      ],
    });
    let need = th.mind ? 16 : 13;
    if (v === 'bluff') {
      if (this.alert < 40) { await dialog({ speaker: name, text: '"The police?! I— this isn\'t over!" The boss panics and trips over a crate. Out cold.' }); return this.defeatBoss(); }
      await dialog({ speaker: name, text: '"Nice try. My guards already told me you came alone."' });
      need += 3;
    } else if (v === 'drink') {
      sfx.drink(); this.g.state.addIntox(30); toast('🥴 Intoxication +30', 'bad');
      need -= 4;
      if (this.g.state.intox >= 100) return this.capture(`${HERO} passes out mid-toast. ${name} laughs.`);
    }
    const ok = await qte(th.mind
      ? { title: 'RESIST!', text: `${name} unleashes the ${th.evidence[0].toLowerCase()} at full power. Fight for your mind!`, label: 'RESIST!', need, time: 4 }
      : { title: 'SHOWDOWN!', text: `${name} lunges at you. Overpower them!`, label: 'PUNCH!', need, time: 4 });
    if (!ok) return this.capture(th.mind ? `${HERO}'s eyes glaze over. "Yes… master…"` : `${name} lands a sucker punch and the goons pile on.`);
    this.defeatBoss();
  }

  /** World position (+ height) → screen pixels, or null if behind the camera. */
  screenOf(pos, up = 0) {
    const v = new THREE.Vector3(pos.x, pos.y + up, pos.z).project(this.cam);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.g.w, y: (-v.y * 0.5 + 0.5) * this.g.h };
  }

  defeatBoss() {
    { const s = this.screenOf(this.boss.position, 2.2); if (s) this.g.commentary.hit(s.x, s.y, { big: true }); }
    this.bossDone = true;
    sfx.hit(); flash('#fff');
    const b = this.boss;
    this.anims.push(() => { if (b.rotation.x > -Math.PI / 2) { b.rotation.x -= 0.08; b.position.y = 0.2; } });
    banner(`${this.zone.boss.toUpperCase()} DEFEATED`, '', '#3ee08a');
    this.bonus += 10;
  }

  animateHero(dt, mag) {
    const M = this.heroModel;
    if (M) {
      // Rigged model: pick a clip from what she's doing.
      if (this.landT > 0) this.landT -= dt;
      else if (mag > 0) {
        if (this.g.state.intox >= 50) M.play('drunkWalk', { speed: 0.8 + mag * 0.5 });
        else if (mag < 0.55) M.play('jog', { speed: 0.7 + mag });
        else M.play('run', { speed: 0.75 + mag * 0.35 });
      } else M.play(this.g.state.intox >= 50 ? 'happyIdle' : this.guards.some((gd) => gd.seeing) ? 'combatIdle' : 'idle', { fade: 0.3 });
      M.setWind(Math.sin(this.t * 1.3) * 0.7, 0.4, -(0.8 + mag * 6.5));
      M.update(dt);
      return;
    }
    const walk = mag ? Math.sin(this.t * 11) * 0.55 * mag : 0;
    this.legL.rotation.x = walk; this.legR.rotation.x = -walk;
    this.armL.rotation.x = -walk * 0.8;
    this.armR.rotation.x = this.punchT > 0 ? -1.5 : walk * 0.8;
    this.cape.rotation.x = 0.15 + mag * 0.5 + Math.sin(this.t * 6) * 0.06;
  }

  /** Play a one-off clip on the rigged model while the game logic freezes her in place. */
  heroClip(name, hold = 1.5) {
    if (!this.heroModel) return;
    this.heroModel.play(name, { fade: 0.15, restart: true });
    this.landT = hold;
  }

  capture(reason) {
    if (this.done) return;
    if (this.heroModel) { this.heroModel.play('defeated', { fade: 0.2 }); this.keepAnimating = true; }
    this.done = true;
    sfx.trap(); flash('#ff3fb8');
    banner('CAPTURED!', '', '#ff3fb8');
    $('prompt').classList.remove('on');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'captured', reason }), 1300);
  }

  win() {
    if (this.done) return;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    this.done = true;
    sfx.win();
    banner('ZONE CLEARED!', '', '#3ee08a');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: this.zone.reward + this.bonus, photo: 'special' }), 1100);
  }

  abort() { this.done = true; this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ objectives
  objectives() {
    const ev = this.evidence.every((e) => e.done), cap = this.captives.every((c) => c.freed);
    const list = [
      { t: this.hasCode ? `Door code: ${this.code}` : 'Get the door code from the informant', done: this.hasCode, target: this.informant.mesh.position, tag: 'informant', skip: this.doorOpen },
      { t: 'Find the keycard in the office', done: this.hasKey, target: new THREE.Vector3(20, 0, 0), skip: this.doorOpen },
      { t: 'Get into the back room', done: this.doorOpen, target: new THREE.Vector3(2.1, 0, -11) },
    ];
    if (this.zone.boss) list.push({ t: `Take down ${this.zone.boss}`, done: this.bossDone, target: this.boss.position });
    list.push({ t: `${this.theme.verb}${this.captives.length ? ` (${this.captives.filter((c) => c.freed).length}/${this.captives.length} freed)` : ''}`, done: ev && cap, target: (this.evidence.find((e) => !e.done) || {}).mesh?.position || (this.captives.find((c) => !c.freed) || {}).person?.position });
    list.push({ t: 'Escape through the front entrance', done: false, target: this.exitRing.position, final: true });
    return list;
  }

  allDone() { return this.doorOpen && this.bossDone && this.evidence.every((e) => e.done) && this.captives.every((c) => c.freed); }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (this.done && this.keepAnimating && this.heroModel) this.heroModel.update(dt);
    if (this.done || !this.scene) return;
    const g = this.g, inp = g.input, st = g.state;
    this.t += dt;
    this.inside += dt;
    g.vice = { active: this.V.vice, where: this.zone.venue, rate: 1.6 };

    // camera yaw from drags (not while using the joystick)
    if (inp.drag.dx) this.yaw -= inp.drag.dx * 0.0065;

    // movement relative to camera
    const a = wobble(inp.axis(), st.intox, this.t);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const mx = fx * -a.y + rx * a.x, mz = fz * -a.y + rz * a.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const h = this.hero;
    if (mag > 0.05 && !this.busy && this.landT <= 0) {
      h.position.x += mx * SPEED * dt;
      h.position.z += mz * SPEED * dt;
      const target = Math.atan2(mx, mz);
      let da = target - h.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      h.rotation.y += da * Math.min(1, dt * 12);
    }
    this.collide(h.position, 0.38);
    this.punchT = Math.max(0, this.punchT - dt);
    this.animateHero(dt, mag > 0.05 && !this.busy && this.landT <= 0 ? mag : 0);

    // X-ray
    if (inp.pressed('xray')) this.setXray(!this.xray);
    if (this.xray) { this.en -= dt * 12; if (this.en <= 0) { this.en = 0; this.setXray(false); } }
    else this.en = Math.min(100, this.en + dt * 7);

    // punch
    if (inp.pressed('punch') && !this.busy) this.punch();

    this.updateGuards(dt);
    this.alert = Math.max(0, this.alert - dt * (this.guards.some((g) => g.seeing) ? 0 : 7));
    if (this.alert >= 100) return this.capture(`The guards swarm ${HERO} and drag her into the back.`);
    if (st.intox >= 100) return this.capture(`${HERO}'s knees buckle. The room spins… and goes dark.`);

    // boss trigger
    if (this.boss && !this.bossMet && this.bossTrigger(h)) {
      this.busy = true;
      this.bossFight().finally(() => { this.busy = false; });
    }

    // interactables
    let best = null, bd = 2.0;
    for (const o of this.inter) {
      if (!o.can()) continue;
      const d = Math.hypot(o.pos.x - h.position.x, o.pos.z - h.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    this.near = best;
    if (best && inp.pressed('interact') && !this.busy) {
      this.busy = true;
      Promise.resolve(best.act()).finally(() => { this.busy = false; });
    }

    // exit
    const done = this.allDone();
    this.exitRing.material.opacity = done ? 0.5 + Math.sin(this.t * 5) * 0.3 : 0.12;
    const ex = this.exitRing.position;
    if (done && Math.hypot(h.position.x - ex.x, h.position.z - ex.z) < 1.4) this.win();

    for (const f of this.anims) f(this.t, dt);
    if (this.tiles) this.tiles.forEach((m, i) => m.material.color.setHSL(((i * 0.13 + this.t * 0.3) % 1), 0.9, 0.5 + 0.2 * Math.sin(this.t * 6 + i)));
    if (this.ball) this.ball.rotation.y += dt;
    this.plights.forEach((l, i) => { if (this.V.kind === 'club' || this.V.kind === 'redlight') l.intensity = 22 + Math.sin(this.t * 4 + i * 2) * 10; });
  }

  punch() {
    this.punchT = 0.25;
    // The jab from "Fist Fight A" (lands ~0.23 s in); she plants her feet for the strike.
    if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
    sfx.whoosh();
    const h = this.hero;
    const fx = Math.sin(h.rotation.y), fz = Math.cos(h.rotation.y);
    for (const gd of this.guards) {
      if (gd.ko) continue;
      const dx = gd.mesh.position.x - h.position.x, dz = gd.mesh.position.z - h.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / d > 0.3) {
        gd.ko = true;
        gd.cone.visible = false;
        sfx.hit();
        const m = gd.mesh;
        const s = this.screenOf(m.position, 1.6);
        if (s) this.g.commentary.hit(s.x, s.y, { big: true });
        this.anims.push(() => { if (m.rotation.x > -Math.PI / 2) { m.rotation.x -= 0.12; m.position.y = 0.15; } });
        if (gd.seeing) { this.alert = Math.min(99, this.alert + 20); toast('He got a shout off before going down!', 'bad'); }
        else toast('Silent takedown', 'good');
        return;
      }
    }
  }

  updateGuards(dt) {
    const h = this.hero.position;
    for (const gd of this.guards) {
      gd.seeing = false;
      if (gd.ko) continue;
      const m = gd.mesh;
      gd.t += dt;
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
      if (this.t > 3 && d < GUARD_RANGE && d > 0.01 && (dx * fx + dz * fz) / d > Math.cos(GUARD_FOV / 2) && this.clearLOS(m.position, h)) {
        gd.seeing = true;
        if (gd.look <= 0) { const s = this.screenOf(m.position, 2.1); if (s) this.g.commentary.guardShout(s.x, s.y); }
        gd.look = 1.2;
        this.alert = Math.min(100, this.alert + dt * (30 + (GUARD_RANGE - d) * 9));
      }
      if (gd.look > 0) {
        gd.look -= dt;
        if (gd.seeing) m.rotation.y = Math.atan2(dx, dz);
      } else {
        const tgt = gd.route[gd.wp];
        const tx = tgt.x - m.position.x, tz = tgt.z - m.position.z, td = Math.hypot(tx, tz);
        if (td < 0.2) gd.wp = (gd.wp + 1) % gd.route.length;
        else {
          m.position.x += (tx / td) * 1.7 * dt; m.position.z += (tz / td) * 1.7 * dt;
          let da = Math.atan2(tx, tz) - m.rotation.y;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          m.rotation.y += da * Math.min(1, dt * 5);
        }
        const s = Math.sin(gd.t * 8) * 0.4;
        m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s;
      }
      gd.cone.material.color.set(gd.seeing ? 0xff3030 : 0xffe040);
      gd.cone.material.opacity = gd.seeing ? 0.3 : 0.16;
    }
  }

  clearLOS(a, b) {
    for (const c of this.colliders) {
      if (!c.wall || c.disabled) continue;
      if (segHitsBox(a.x, a.z, b.x, b.z, c)) return false;
    }
    if (!this.doorOpen && segHitsBox(a.x, a.z, b.x, b.z, this.doorCol)) return false;
    return true;
  }

  collide(p, r) {
    for (const c of this.colliders) {
      if (c.disabled) continue;
      const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); }
      else {
        const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
      }
    }
  }

  setXray(on) {
    if (on && this.en < 10) { toast('Not enough X-ray power', 'bad'); return; }
    this.xray = on;
    this.g.input.setButton('xray', { toggled: on });
    $('xray-tint').classList.toggle('on', on);
    if (this.wallMat) {
      this.wallMat.transparent = on || this.wallBaseOpacity < 1;
      this.wallMat.opacity = on ? 0.15 : this.wallBaseOpacity;
      this.wallMat.depthWrite = !on;
      this.wallMat.needsUpdate = true;
    }
    for (const m of this.hidden) m.visible = on;
    if (on) sfx.beam();
  }

  // ------------------------------------------------------------------ HUD + render
  hud() {
    const al = $('b-alert'), en = $('b-en');
    if (al) { al.style.width = this.alert + '%'; al.parentElement.classList.toggle('warn', this.alert > 60); }
    if (en) en.style.width = this.en + '%';
    if (!this.scene) return;
    const list = this.objectives();
    let cur = null;
    const html = list.filter((o) => !o.skip || o.done).map((o) => {
      const isCur = !o.done && !cur && (!o.final || this.allDone());
      if (isCur) cur = o;
      return `<div class="${o.done ? 'done' : isCur ? 'cur' : ''}">${o.done ? '✓' : '•'} ${o.t}</div>`;
    }).join('');
    const el = $('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('hud-sub').textContent = `Inside ${Math.floor(this.inside)}s${this.V.vice ? ' · tabloids watching' : ''}${this.xray ? ' · X-RAY' : ''}`;
    // objective marker
    const mk = $('marker');
    if (cur && cur.target && !this.done) {
      const v = new THREE.Vector3(cur.target.x, 2.6, cur.target.z).project(this.cam);
      let x = (v.x * 0.5 + 0.5) * this.g.w, y = (-v.y * 0.5 + 0.5) * this.g.h;
      if (v.z > 1) { x = this.g.w - x; y = this.g.h - 40; }
      x = clamp(x, 30, this.g.w - 30); y = clamp(y, 70, this.g.h - 40);
      mk.style.transform = `translate(${x}px,${y}px)`;
      mk.querySelector('span').textContent = `${Math.round(Math.hypot(cur.target.x - this.hero.position.x, cur.target.z - this.hero.position.z))}m`;
      mk.classList.add('on');
    } else mk.classList.remove('on');
    // prompt
    const pr = $('prompt');
    if (this.near && !this.busy && !this.done) {
      const key = document.body.classList.contains('touch') ? 'USE' : 'E';
      const html2 = `<b>${key}</b> ${this.near.label}`;
      if (pr._html !== html2) { pr.innerHTML = html2; pr._html = html2; }
      pr.classList.add('on');
    } else pr.classList.remove('on');
    this.g.input.setButton('interact', { lit: !!this.near });
  }

  render() {
    if (!this.scene) return;
    const h = this.hero.position, st = this.g.state;
    const pitch = 0.86, dist = 7.6;
    const off = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(this.yaw) * Math.cos(pitch) * dist);
    const want = h.clone().add(off.multiplyScalar(this.cameraReach(h, off) / dist));
    this.cam.position.lerp(want, 0.2);
    this.cam.lookAt(h.x, h.y + 1.1, h.z);
    if (st.intox > 30) {
      const k = (st.intox - 30) / 70;
      this.cam.rotation.z += Math.sin(this.t * 1.3) * 0.08 * k;
      this.cam.fov = 58 + Math.sin(this.t * 0.9) * 6 * k;
      this.cam.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.cam);
  }
}
