// Ravenmoor Asylum: a 3D investigation in a cross of padded-cell corridors.
//
// The building is generated here (no model file): four wings meet at a nurses' station, each wing
// lined with padded cells on both sides behind steel doors. It is handed to the club engine as a
// "club" (BVH collider + walkable floor), so movement, camera, orderlies, X-ray and the whole
// night-case investigation (CaseFile, clues, witness, captives, suspect board) come for free.
//
// What's different here: getting caught means being sedated. A clip plays (assets/video/Asylum/),
// and she wakes up in a random cell with the same case reset: the only way out is to solve it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NightCase } from './nightcase.js';
import { CaseFile } from './casefile.js';
import { buildCollider, scanFloor } from './clubgeo.js';
import { unlockLead } from './leads.js';
import { ASYLUM, ASYLUM_CASES, ASYLUM_JOBS, ASYLUM_ITEMS, ASYLUM_BAIT, WITNESS_MOODS, HERO } from './data.js';
import { pick, shuffle, chance, rand, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { npcLook, portrait } from './art.js';
import { sfx } from './sfx.js';
import { randomPerson } from './casefile.js';
import { playCutscene } from './cutscene.js';
import { toon, lightPool } from './look3d.js';
import { quality } from './settings.js';

// Layout (metres). Wings run outward from a square hub; cells sit on both sides of each wing.
const HW = 1.6;              // hall half-width
const HUB = 3.4;             // hub half-size
const CELL_D = 3.6;          // cell depth (away from the hall)
const CELL_W = 3.4;          // cell width (along the hall)
const WALL_H = 3.2;
const DOOR_W = 1.2, DOOR_H = 2.3;
const S0 = Math.max(HUB, HW + CELL_D);   // first cell starts here (keeps neighbouring wings' cells apart)
const N = ASYLUM.cellsPerSide;
const END = S0 + N * CELL_W + 1.2;       // far end of each wing
const WINGS = [
  { id: 'north', d: [0, -1] }, { id: 'east', d: [1, 0] }, { id: 'south', d: [0, 1] }, { id: 'west', d: [-1, 0] },
];

/** Zone fields for the asylum on the map (the overworld supplies position/district). */
export function asylumFields() {
  const theme = pick(Object.keys(ASYLUM_CASES));
  const th = ASYLUM_CASES[theme];
  return {
    kind: 'special', mode: 'asylum', venue: ASYLUM.venue, theme, def: { crime: th.crime },
    name: `${ASYLUM.venue}: ${th.name}`, reward: ASYLUM.reward, lockKey: ASYLUM.venue, ttl: 320,
    color: '#9fe8ff', glyph: '✚', risk: 'Sedation loop',
    blurb: `Investigate ${th.crime}. Get caught and you wake up in a padded cell, back at square one.`,
  };
}

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const grime = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(40,45,30,${Math.random() * a})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 14, 0, 7); g.fill(); } };

function makeMaterials() {
  // Hall wall: green tiles to waist height, stained plaster above, a dado rail between.
  const hall = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d6dccf'; g.fillRect(0, 0, w, h);
    const tileTop = h * 0.6;
    g.fillStyle = '#7fa894'; g.fillRect(0, tileTop, w, h - tileTop);
    g.strokeStyle = 'rgba(30,50,40,.45)'; g.lineWidth = 2;
    for (let y = tileTop; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, tileTop); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#4c6a5c'; g.fillRect(0, tileTop - 6, w, 8);
    grime(g, w, tileTop, 18, 0.12);
    g.fillStyle = 'rgba(80,70,40,.18)'; for (let i = 0; i < 5; i++) g.fillRect(Math.random() * w, 0, 3 + Math.random() * 5, tileTop * Math.random()); // drip stains
  });
  // Padding: cream quilted cushions with button tufts.
  const pad = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 70);
    grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(120,110,80,.25)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,108,80,.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke();
    g.fillStyle = '#9c9070'; for (const [x, y] of [[w / 2, 0], [0, h / 2], [w, h / 2], [w / 2, h]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    grime(g, w, h, 4, 0.08);
  });
  // Hall floor: worn checkered linoleum.
  const lino = canvasTex(256, 256, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#5c6b62' : '#9aa596'; g.fillRect(x * 64, y * 64, 64, 64); }
    grime(g, w, h, 40, 0.15);
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { g.strokeRect(i * 64, 0, 0, h); g.strokeRect(0, i * 64, w, 0); }
  });
  const door = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#6f7f86'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#1b2427'; g.fillRect(w * 0.3, h * 0.16, w * 0.4, h * 0.14);          // observation window
    g.strokeStyle = '#3c474c'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(w * 0.3 + (w * 0.4 * i) / 4, h * 0.16); g.lineTo(w * 0.3 + (w * 0.4 * i) / 4, h * 0.3); g.stroke(); }
    g.fillStyle = '#2d3538'; g.fillRect(w * 0.35, h * 0.55, w * 0.3, h * 0.035);         // food slot
    g.fillStyle = '#c9c9c0'; g.fillRect(w * 0.78, h * 0.47, 8, 18);                       // handle
    g.fillStyle = '#4a565b'; for (let y = 16; y < h; y += 40) for (const x of [10, w - 10]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    grime(g, w, h, 10, 0.12);
  }, false);
  const mainDoor = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c3a2e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a2c22'; g.fillRect(w / 2 - 2, 0, 4, h);
    g.fillStyle = '#9fb4c0'; g.fillRect(w * 0.14, h * 0.12, w * 0.24, h * 0.3); g.fillRect(w * 0.62, h * 0.12, w * 0.24, h * 0.3);
    g.strokeStyle = '#b0b0a8'; g.lineWidth = 6; g.beginPath();                          // chains across the doors
    g.moveTo(w * 0.1, h * 0.52); g.quadraticCurveTo(w / 2, h * 0.7, w * 0.9, h * 0.52); g.stroke();
    g.fillStyle = '#c8a24a'; g.fillRect(w / 2 - 12, h * 0.58, 24, 28);                   // padlock
  }, false);
  const side = THREE.DoubleSide;
  return {
    hall, pad, lino,
    // cel-shaded with the comic halftone (look3d); the lamps' light is decals, not per-pixel lights
    hallWall: toon(0xffffff, { map: hall, side }),
    padding: toon(0xffffff, { map: pad, side }),
    padFloor: toon(0xcfc6ae, { map: pad, side }),
    floor: toon(0xffffff, { map: lino, side }, { halftone: 0.4 }),
    mass: toon(0x2a302d, { side }),
    cap: toon(0x121614, { side }, { halftone: 0 }),
    bedFrame: toon(0x55606a),
    mattress: toon(0xf1ede2),
    desk: toon(0x8a7a62),
    cabinet: toon(0xc8cfd0),
    door: toon(0xffffff, { map: door }),
    mainDoor: toon(0xffffff, { map: mainDoor, side }),
    window: new THREE.MeshBasicMaterial({ color: 0x1e2a3a, side }),
  };
}

// ---------------------------------------------------------------- geometry helpers
/** A quad through 4 points (counter-clockwise), UV-tiled every `tile` metres, facing `normal`. */
function quad(pts, normal, uLen, vLen, tile) {
  const g = new THREE.BufferGeometry();
  const [a, b, c, d] = pts;
  const e1 = new THREE.Vector3().subVectors(b, a), e2 = new THREE.Vector3().subVectors(c, a);
  const flip = new THREE.Vector3().crossVectors(e1, e2).dot(normal) < 0;
  const order = flip ? [a, d, c, b] : [a, b, c, d];
  const uv = flip ? [0, 0, 0, vLen / tile, uLen / tile, vLen / tile, uLen / tile, 0] : [0, 0, uLen / tile, 0, uLen / tile, vLen / tile, 0, vLen / tile];
  g.setAttribute('position', new THREE.Float32BufferAttribute(order.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [normal.x, normal.y, normal.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** Nudge a surface back in depth so ink lines drawn exactly on its edges win (no dashed lines). */
function pushBack(m) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }

/** Builds the static asylum: geometry grouped per material, plus cell/route metadata. */
class Builder {
  constructor(M) { this.M = M; this.parts = new Map(); this.cells = []; this.routes = []; }

  add(mat, geo) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push(geo); }

  /** World point from wing frame: `along` from the centre, `lat` across (right of the wing). */
  static at(w, along, lat, y = 0) {
    const [dx, dz] = w.d, lx = -dz, lz = dx;
    return new THREE.Vector3(dx * along + lx * lat, y, dz * along + lz * lat);
  }

  floor(p0, p1, mat, tile) { // axis-aligned rectangle between two corners
    const x0 = Math.min(p0.x, p1.x), x1 = Math.max(p0.x, p1.x), z0 = Math.min(p0.z, p1.z), z1 = Math.max(p0.z, p1.z);
    this.add(mat, quad([new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 0, z0), new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x0, 0, z1)], new THREE.Vector3(0, 1, 0), x1 - x0, z1 - z0, tile));
  }

  /**
   * A wall from a to b (floor points), as two faces 0.16 m apart so each side can have its own
   * material. `matL`/`matR` face left/right of the direction a→b (null = no face on that side).
   */
  wall(a, b, matL, matR, y0 = 0, y1 = WALL_H, tile = 2) {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    if (len < 0.01) return;
    dir.normalize();
    const left = new THREE.Vector3(dir.z, 0, -dir.x);
    for (const [mat, n] of [[matL, left], [matR, left.clone().negate()]]) {
      if (!mat) continue;
      const o = n.clone().multiplyScalar(0.08);
      const pts = [a.clone().add(o).setY(y0), b.clone().add(o).setY(y0), b.clone().add(o).setY(y1), a.clone().add(o).setY(y1)];
      this.add(mat, quad(pts, n, len, y1 - y0, mat === this.M.hallWall ? WALL_H : tile));
    }
    if (y1 === WALL_H) { // ink-black cap over the cut-away top (reads as a comic floor plan)
      const o = left.clone().multiplyScalar(0.1);
      const pts = [a.clone().add(o), b.clone().add(o), b.clone().sub(o), a.clone().sub(o)].map((p) => p.setY(2.68)); // the zone slices walls at head height + 2.7
      this.add(this.M.cap, quad(pts, new THREE.Vector3(0, 1, 0), len, 0.2, 1));
    }
  }

  box(mat, w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
    this.add(mat, g.index ? g : g.toNonIndexed());
  }

  build() {
    const M = this.M;
    // hub: floor, the four corner wall stubs, and the nurses' station
    this.floor(new THREE.Vector3(-HUB, 0, -HUB), new THREE.Vector3(HUB, 0, HUB), M.floor, 2);
    for (const w of WINGS) {
      const at = (al, lat) => Builder.at(w, al, lat);
      this.wall(at(HUB, -HUB), at(HUB, -HW), M.mass, M.hallWall); // tiled side faces the hub
      this.wall(at(HUB, HW), at(HUB, HUB), M.mass, M.hallWall);
    }
    this.box(M.desk, 1.8, 1.0, 1.0, 0, 0.5, 0);
    this.box(M.cabinet, 0.9, 1.8, 0.45, -HUB + 0.3, 0.9, -HUB + 0.9);   // medicine cabinet in a hub corner
    this.cabinetPos = new THREE.Vector3(-HUB + 0.9, 0, -HUB + 0.9);
    for (const w of WINGS) this.buildWing(w);
  }

  buildWing(w) {
    const M = this.M, at = (al, lat, y = 0) => Builder.at(w, al, lat, y);
    // hall floor + the plain stretch between the hub and the first cells
    this.floor(at(HUB, -HW), at(END, HW), M.floor, 2);
    for (const s of [-1, 1]) {
      const L = (a, b) => (s < 0 ? [at(b, s * HW), at(a, s * HW)] : [at(a, s * HW), at(b, s * HW)]); // hall face on the left of the direction
      this.wall(...L(HUB, S0), M.hallWall, M.mass);
      for (let i = 0; i < N; i++) {
        const a0 = S0 + i * CELL_W, a1 = a0 + CELL_W, am = (a0 + a1) / 2;
        this.wall(...L(a0, am - DOOR_W / 2), M.hallWall, M.padding);
        this.wall(...L(am + DOOR_W / 2, a1), M.hallWall, M.padding);
        this.wall(...L(am - DOOR_W / 2, am + DOOR_W / 2), M.hallWall, M.padding, DOOR_H, WALL_H); // lintel
        this.buildCell(w, s, i, a0, a1, am);
      }
      this.wall(...L(S0 + N * CELL_W, END), M.hallWall, M.mass);
    }
    // end wall across the hall: the chained main entrance on the south wing, a barred window elsewhere
    this.wall(at(END, HW), at(END, -HW), M.hallWall, M.mass);
    const inner = END - 0.1;
    if (w.id === 'south') {
      this.add(M.mainDoor, quad([at(inner, -1.2, 0), at(inner, 1.2, 0), at(inner, 1.2, 2.6), at(inner, -1.2, 2.6)], new THREE.Vector3(-w.d[0], 0, -w.d[1]), 1, 1, 1));
      this.entrance = { pos: at(END - 2.2, 0), heading: Math.atan2(-w.d[0], -w.d[1]), door: at(END - 0.6, 0) };
    } else {
      this.add(M.window, quad([at(inner, -0.8, 1.3), at(inner, 0.8, 1.3), at(inner, 0.8, 2.5), at(inner, -0.8, 2.5)], new THREE.Vector3(-w.d[0], 0, -w.d[1]), 1, 1, 1));
      for (let k = -2; k <= 2; k++) this.box(M.bedFrame, 0.05, 1.2, 0.05, ...at(inner - 0.04, k * 0.35, 1.9).toArray());
    }
    this.routes.push({ wing: w.id, from: at(HUB + 0.6, 0), to: at(END - 1.4, 0) });
  }

  buildCell(w, s, i, a0, a1, am) {
    const M = this.M, at = (al, lat, y = 0) => Builder.at(w, al, lat, y);
    const inL = s * HW, outL = s * (HW + CELL_D), midL = s * (HW + CELL_D / 2);
    this.floor(at(a0, inL), at(a1, outL), M.padFloor, 0.8);
    // back wall and the two side walls: padding on the inside
    const back = s < 0 ? [at(a1, outL), at(a0, outL)] : [at(a0, outL), at(a1, outL)];
    this.wall(...back, M.padding, M.mass, 0, WALL_H, 0.8);
    for (const al of [a0, a1]) this.wall(at(al, inL), at(al, outL), M.padding, M.padding, 0, WALL_H, 0.8);
    // metal bed against the back wall
    const bedLat = s * (HW + CELL_D - 0.55), bed = at(am, bedLat);
    const alongX = w.d[0] !== 0; // the wing runs along x
    const bw = alongX ? 2.0 : 0.9, bd = alongX ? 0.9 : 2.0;
    this.box(M.bedFrame, bw, 0.38, bd, bed.x, 0.19, bed.z);
    this.box(M.mattress, bw - 0.08, 0.2, bd - 0.08, bed.x, 0.48, bed.z);
    const door = at(am, inL);
    this.cells.push({
      id: this.cells.length + 1, wing: w.id, side: s,
      center: at(am, midL), bed, door, alongX,
      slide: new THREE.Vector3(w.d[0], 0, w.d[1]),              // doors slide along the hall
      wake: at(am + 0.9 * (i % 2 ? 1 : -1), s * (HW + 1.1)),     // where she comes to, beside the bed
      faceDoor: Math.atan2(door.x - at(am, midL).x, door.z - at(am, midL).z),
    });
  }

  /** Merge per material into a handful of meshes. */
  scene() {
    const root = new THREE.Group();
    const M = this.M, inked = new Set([M.hallWall, M.padding, M.mass, M.bedFrame, M.mattress, M.desk, M.cabinet, M.mainDoor]);
    const edges = [];
    for (const [mat, geos] of this.parts) {
      const nonIdx = geos.some((g) => !g.index);
      if (inked.has(mat)) { for (const g of geos) edges.push(new THREE.EdgesGeometry(g, 35)); pushBack(mat); }
      const merged = mergeGeometries(nonIdx ? geos.map((g) => (g.index ? g.toNonIndexed() : g)) : geos, false);
      root.add(new THREE.Mesh(merged, mat));
    }
    // ink lines along every wall edge and corner: one draw call (not a mesh, so not a collider)
    root.userData.inked = true; // the shared inkEdges() pass needn't redo it
    const lines = new THREE.LineSegments(mergeGeometries(edges, false), new THREE.LineBasicMaterial({ color: 0x0e1210 }));
    lines.raycast = () => {};
    root.add(lines);
    return root;
  }
}

let building = null;
/** The generated asylum as a club-engine building (built once, then shared). */
function buildAsylum() {
  if (!building) {
    building = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const M = makeMaterials();
      const B = new Builder(M);
      B.build();
      const scene = B.scene();
      const collider = buildCollider(scene);
      collider.material.side = THREE.DoubleSide; // walls/floors are single faces: rays must hit either side
      const { floor, mainY } = scanFloor(scene, collider);
      return {
        scene, meta: { lights: [] }, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene),
        M, cells: B.cells, routes: B.routes, entrance: B.entrance, cabinetPos: B.cabinetPos,
      };
    });
  }
  return building;
}

/** Does the segment a→b (x/z) cross the axis-aligned box? */
function segHitsBox(ax, az, bx, bz, c) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, lo, hi] of [[ax, dx, c.minX, c.maxX], [az, dz, c.minZ, c.maxZ]]) {
    if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

// ---------------------------------------------------------------- the zone
export class AsylumZone extends NightCase {
  themeFor(zone) { return ASYLUM_CASES[zone.theme]; }
  get staff() { return 'orderly'; }

  loadBuilding() { return buildAsylum(); }

  enter(p) {
    if (!p.wake) { this.sedations = 0; this.keptCase = null; this.tipGivenEver = false; }
    this.waking = !!p.wake;
    super.enter(p);
  }

  // Waking up: she gets up off the cell floor instead of the superhero landing.
  heroClip(name, hold) { return this.waking && name === 'land' ? super.heroClip('getUp', 2.6) : super.heroClip(name, hold); }

  announce() {
    if (this.waking) {
      banner('WAKE UP', `Cell ${this.wakeCell.id} · sedated ${this.sedations}×`, '#9fe8ff');
      setTimeout(() => { if (!this.done) toast('Your notes are gone. Same case, same culprit: find the clues again and name them to break free.', 'info'); }, 1800);
    } else {
      banner(ASYLUM.venue.toUpperCase(), this.theme.name, '#9fe8ff');
      setTimeout(() => { if (!this.done) toast('Open the cell doors (USE) to search. X-ray sees through doors. Get caught and you wake up in a cell.', 'info'); }, 1800);
    }
  }

  // ---------------------------------------------------------------- world
  buildWorld() {
    const c = this.club, S = this.scene;
    S.add(c.scene);
    S.background = new THREE.Color(0x050706);
    S.fog = new THREE.Fog(0x08100c, 14, 40);
    S.add(new THREE.HemisphereLight(0xcfe8dc, 0x1a2420, 0.7));
    S.add(new THREE.AmbientLight(0xffffff, 0.1));
    this.key.color.set(0xe0fff0); this.key.intensity = 0.9;
    // Fluorescent tubes: pools of sickly light down each wing and over the hub (floor decals:
    // per-pixel point lights cost too much on phones). A couple buzz and flicker.
    const spots = [new THREE.Vector3(0, 0, 0)];
    for (const r of c.routes) for (const k of [0.3, 0.75]) spots.push(r.from.clone().lerp(r.to, k));
    const pools = spots.map((p, i) => {
      const m = lightPool(i ? 0xbfffe0 : 0xfff0c8, i ? 3.4 : 4.4, 0.42);
      m.position.set(p.x, 0.02, p.z); S.add(m);
      return m;
    });
    this.plights = [];
    const flicker = shuffle([...pools]).slice(0, 3);
    this.anims.push((t) => flicker.forEach((l, i) => { l.material.opacity = Math.sin(t * 23 + i * 7) > 0.93 || Math.sin(t * 3.1 + i) > 0.97 ? 0.05 : 0.42; }));
    this.buildDoors();
    this.wallMat = this.doorMat; // X-ray fades the doors so she can look into the cells
    this.wallBaseOpacity = 1;
    this.placeClubGameplay();
  }

  buildDoors() {
    const c = this.club;
    this.doorMat = c.M.door.clone();
    this.doors = c.cells.map((cell) => {
      const g = cell.alongX ? new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.14) : new THREE.BoxGeometry(0.14, DOOR_H, DOOR_W);
      const mesh = new THREE.Mesh(g, this.doorMat);
      mesh.position.set(cell.door.x, DOOR_H / 2, cell.door.z);
      this.scene.add(mesh);
      const hx = cell.alongX ? DOOR_W / 2 : 0.1, hz = cell.alongX ? 0.1 : DOOR_W / 2;
      const col = { minX: cell.door.x - hx, maxX: cell.door.x + hx, minZ: cell.door.z - hz, maxZ: cell.door.z + hz, wall: true, mesh };
      this.colliders.push(col);
      const d = { cell, mesh, col, open: false };
      this.addInter(cell.door, `Open cell ${cell.id}`, () => !d.open, () => this.openDoor(d), 'door');
      return d;
    });
    // the chained main doors at the entrance
    this.addInter(c.entrance.door, 'Main doors', () => true, () => dialog({ title: 'Main Doors', text: 'Chained and padlocked from the outside. <b>The only way out is to crack the case</b> and name the culprit (SUSPECTS).' }));
  }

  openDoor(d, quiet = false) {
    if (d.open) return;
    d.open = true;
    d.col.disabled = true;
    if (!quiet) sfx.door();
    const m = d.mesh, from = m.position.clone(), to = from.clone().addScaledVector(d.cell.slide, DOOR_W * 0.92);
    let k = 0;
    this.anims.push((t, dt) => { if (k < 1) { k = Math.min(1, k + dt * 2.5); m.position.lerpVectors(from, to, k); } });
  }

  /** Closed doors block the orderlies' view as well as the building itself. */
  clearLOS(a, b) {
    if (!super.clearLOS(a, b)) return false;
    return !this.doors.some((d) => !d.open && segHitsBox(a.x, a.z, b.x, b.z, d.col));
  }

  // ---------------------------------------------------------------- layout
  placeClubGameplay() {
    const c = this.club, th = this.theme;
    const nCap = th.captives || 0;
    // Same case across sedations (same culprit), but the progress is wiped.
    if (this.keptCase) { for (const k of this.keptCase.clues) { k.found = false; k.photo = false; } this.keptCase.photos = 0; this.case = this.keptCase; }
    else this.case = this.keptCase = new CaseFile(ASYLUM_JOBS, ['visible', 'visible', 'xray', nCap ? 'captive' : 'witness']);
    this.clueObjs = [];
    this.witness = null;
    this.tipGiven = this.tipGivenEver || false;
    this.planLayout();
    this.exitRing.visible = false;

    const cells = shuffle([...c.cells]);
    if (this.waking) {
      this.wakeCell = cells.shift();
      this.spawn = this.wakeCell.wake.clone();
      this.spawnHeading = this.wakeCell.faceDoor;
    } else {
      this.spawn = c.entrance.pos.clone();
      this.spawnHeading = c.entrance.heading;
    }
    const take = () => cells.shift();

    // informant and witness: patients in their cells
    this.placePatientInformant(take());
    for (const k of this.case.byMethod('witness')) this.placePatientWitness(k, take());
    this.placeRestrained(nCap, cells.splice(0, nCap));
    const props = [...th.clueProps];
    for (const k of this.case.byMethod('visible')) this.placeClueInCell(k, props.shift() || 'Evidence', take());
    for (const k of this.case.byMethod('xray')) {
      if (chance(0.5)) this.placeContainerAt(k, 'Medicine Cabinet', c.cabinetPos, false);
      else { const cell = take(); this.placeContainerAt(k, 'Loose Padding Panel', cell.center.clone().lerp(cell.bed, 0.35), true); }
    }
    this.placeOrderlies(2 + (chance(0.5) ? 1 : 0));
    this.placeItems(3 + (th.extraTemptations || 0), { onTake: () => this.noteUnderDrink(), intox: ASYLUM_ITEMS, bait: ASYLUM_BAIT });
  }

  /** A patient NPC standing in a cell, facing the door. */
  patientIn(cell) {
    const look = npcLook('civilian');
    look.top = '#e9ecef'; look.bottom = '#dfe3e6'; // hospital whites
    const mesh = this.makeNPC(look);
    mesh.position.copy(cell.center);
    mesh.rotation.y = cell.faceDoor;
    return { mesh, look };
  }

  placePatientInformant(cell) {
    const { mesh, look } = this.patientIn(cell);
    this.informant = { mesh, look, name: `${pick(['Old', 'Quiet', 'Humming', 'Lucky'])} ${pick(['Mae', 'Ernest', 'Vera', 'Otto', 'Dot', 'Silas'])}`, works: pick(['charm', 'press']), burned: false };
    this.addInter(mesh.position, 'Talk to the patient', () => true, () => this.talkInformant(), 'informant');
  }

  placePatientWitness(clue, cell) {
    const { mesh, look } = this.patientIn(cell);
    this.witness = { mesh, look, clue, mood: pick(WITNESS_MOODS), name: randomPerson(), talked: false };
    this.addInter(mesh.position, 'Question the patient', () => !this.witness.talked || this.witness.told, () => this.talkWitness(), 'witness');
  }

  /** Patients strapped down in their cells (the club engine's captives, restrained instead of caged). */
  placeRestrained(n, cells) {
    for (const cell of cells) {
      const { mesh: person } = this.patientIn(cell);
      const straps = new THREE.Group();
      for (const y of [0.6, 1.05, 1.4]) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 20), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
        r.rotation.x = Math.PI / 2; r.position.y = y; straps.add(r);
      }
      straps.position.copy(person.position);
      this.scene.add(straps);
      const cap = { person, cage: straps, freed: false, x: person.position.x, z: person.position.z };
      this.captives.push(cap);
      this.addInter(person.position, 'Undo the restraints', () => !cap.freed, () => this.freeClubCaptive(cap), 'captive');
    }
  }

  placeClueInCell(clue, name, cell) {
    const p = cell.center.clone().lerp(cell.bed, 0.45);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.28), new THREE.MeshLambertMaterial({ color: 0xffc040, emissive: 0x6a4a00 }));
    mesh.position.set(p.x, 0.09, p.z);
    this.scene.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.03, p.z);
    this.scene.add(ring);
    // visible through the door under X-ray
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffc040, depthTest: false, transparent: true, opacity: 0.8 }));
    ghost.position.set(p.x, 0.6, p.z); ghost.renderOrder = 10; ghost.visible = false;
    this.scene.add(ghost); this.hidden.push(ghost);
    this.anims.push((t) => { ring.material.opacity = clue.found ? 0.12 : 0.35 + Math.sin(t * 4) * 0.2; if (clue.found) ghost.material.opacity = 0; });
    const o = { clue, name, pos: new THREE.Vector3(p.x, 0, p.z) };
    this.clueObjs.push(o);
    this.addClueInteractions(o, () => this.searchClue(o));
  }

  placeContainerAt(clue, name, pos, padding) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, padding ? 0.9 : 0.5, 0.35), new THREE.MeshLambertMaterial({ color: padding ? 0xd9d0b8 : 0xb8c4c8 }));
    mesh.position.set(pos.x, padding ? 0.45 : 1.25, pos.z);
    this.scene.add(mesh);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), new THREE.MeshBasicMaterial({ color: 0x40e0ff, depthTest: false, transparent: true }));
    inner.position.copy(mesh.position); inner.renderOrder = 10; inner.visible = false;
    this.scene.add(inner); this.hidden.push(inner);
    const o = { clue, name, pos: new THREE.Vector3(pos.x, 0, pos.z), inner };
    this.clueObjs.push(o);
    this.addClueInteractions(o, () => this.searchContainer(o));
  }

  /** Orderlies in whites, walking the length of a wing and back (not the one she starts in). */
  placeOrderlies(n) {
    const startWing = this.waking ? this.wakeCell.wing : 'south';
    const routes = shuffle(this.club.routes.filter((r) => r.wing !== startWing)).slice(0, n);
    for (const r of routes) {
      const look = npcLook('guard'); look.top = '#f2f4f5'; look.bottom = '#f2f4f5'; look.shades = false;
      const mesh = this.makeNPC(look);
      const route = chance(0.5) ? [r.from.clone(), r.to.clone()] : [r.to.clone(), r.from.clone()];
      mesh.position.copy(route[0]);
      const cone = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 24, -Math.PI / 2 - 0.525, 1.05).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffe040, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = 0.06;
      mesh.add(cone);
      this.guards.push({ mesh, cone, route, wp: 1, ko: false, look: 0, seeing: false, t: rand(0, 3) });
    }
  }

  // ---------------------------------------------------------------- story
  async talkInformant() {
    const inf = this.informant;
    if (this.tipGiven) {
      await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: '"I told you already. The walls have ears, dearie."' });
      return;
    }
    const hint = inf.works === 'charm' ? 'They seem lonely. Nobody visits.' : 'They flinch at every footstep in the hall.';
    const v = await dialog({
      speaker: `Patient · ${inf.name}`, portrait: portrait(inf.look),
      text: `"You're looking into ${this.theme.crime}? Nobody listens to us in here… but we hear everything. Even about the city outside."<span class="hint">${hint}</span>`,
      options: [
        { label: 'Take the pill they offer you', note: '+20 intoxication, guaranteed tip', value: 'pill', cls: 'risky' },
        { label: 'Sit and listen kindly', value: 'charm', disabled: inf.burned },
        { label: 'Demand answers', value: 'press', disabled: inf.burned },
        { label: 'Leave them be', value: null },
      ],
    });
    if (!v) return;
    if (v === 'pill') { sfx.drink(); this.g.state.addIntox(20); toast('🥴 Intoxication +20', 'bad'); }
    else if (v !== inf.works) {
      inf.burned = true;
      this.alert = Math.min(99, this.alert + 25);
      sfx.alarm();
      await dialog({ speaker: inf.name, text: '"NURSE! NURSE!" They start shouting.<span class="hint">Orderly alert +25. They\'ll only talk if you take their pill now.</span>' });
      return;
    }
    this.tipGiven = this.tipGivenEver = true;
    await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: '"The night staff talk about another job across town tonight. I\'ll tell you where."' });
    unlockLead(this.g, 'Patient tip');
  }

  // ---------------------------------------------------------------- the sedation loop
  capture(reason) {
    if (this.done) return;
    this.done = true;
    this.setXray(false);
    if (this.heroModel) { this.heroModel.play('defeated', { fade: 0.2 }); this.keepAnimating = true; }
    sfx.trap(); flash('#d8fff0');
    banner('SEDATED!', '', '#9fe8ff');
    $('prompt').classList.remove('on');
    this.sedations = (this.sedations || 0) + 1;
    this.g.state.addRep(-2, 'Sedated in the asylum');
    setTimeout(async () => {
      if (this.g.mode !== this) return;
      await playCutscene({ folder: ASYLUM.videoFolder, caption: `${reason}<br>Everything goes dark…` });
      if (this.g.mode === this) this.restartInCell();
    }, 1300);
  }

  /** Back to square one: rebuild the level around her waking up in a random cell. */
  restartInCell() {
    const zone = this.zone;
    this.exit();
    this.enter({ zone, wake: true });
  }

  finish(accused) {
    if (accused.culprit) return super.finish(accused);
    sfx.lose();
    this.capture(`"${accused.name}? Another delusion, dear." The orderlies close in with a syringe.`);
  }

  objectives() {
    const list = super.objectives();
    list[list.length - 1].t = `Break free: name the culprit (SUSPECTS, ${this.case.found.length}/3 clues)`;
    return list;
  }

  hud() {
    super.hud();
    if (!this.scene || this.warming) return;
    $('hud-sub').textContent = `${this.sedations ? `Sedated ${this.sedations}× · ` : ''}Orderly alert ${Math.round(this.alert)}%${this.xray ? ' · X-RAY' : ''}`;
  }
}
