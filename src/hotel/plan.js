// The hotel's 13th floor, generated (no model file): an elevator lobby, a long main hall north to the
// Grand Ballroom, four side wings (the Gallery, the Wardrobe, the Lab, the Switchboard) lined with
// rooms, the Screening Rooms off the main hall, and a seal console at the end of every wing. Built
// like the asylum (asylum.js): rectangles with their walls' inner faces, merged per material, a BVH
// collider for the club engine, plus the metadata the zone places its gameplay on.
// Metres: x east, z south; the lobby is at the south end, the ballroom at the north.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCollider, scanFloor } from '../clubgeo.js';
import { makeMaterials, NEON } from './art.js';

export const WALL_H = 3.2;
export const DOOR_W = 1.2, DOOR_H = 2.3;
const HW = 1.6;            // hall half-width
const RD = 4.2, RW = 4;    // room depth, width
const WING_L = 3 * RW + 2.4;
export const BALL = { x0: -14, x1: 14, z0: -70, z1: -46, stage: -64 };

/** The wings: id, side (-1 west / 1 east), hall centre z, seal index (act1.js SEALS). */
export const WINGS = [
  { id: 'gallery', name: 'The Gallery', side: -1, zc: -12, seal: 0 },
  { id: 'wardrobe', name: 'The Wardrobe', side: 1, zc: -12, seal: 1 },
  { id: 'lab', name: 'The Lab', side: -1, zc: -28, seal: 2 },
  { id: 'switchboard', name: 'The Switchboard', side: 1, zc: -28, seal: 3 },
];

// ---------------------------------------------------------------- geometry helpers
/** A quad through 4 points, UV-tiled every `tile` metres, facing `normal`. */
function quad(pts, normal, uLen, vLen, tileU, tileV = tileU) {
  const g = new THREE.BufferGeometry();
  const [a, b, c, d] = pts;
  const e1 = new THREE.Vector3().subVectors(b, a), e2 = new THREE.Vector3().subVectors(c, a);
  const flip = new THREE.Vector3().crossVectors(e1, e2).dot(normal) < 0;
  const order = flip ? [a, d, c, b] : [a, b, c, d];
  const u = uLen / tileU, v = vLen / tileV;
  const uv = flip ? [0, 0, 0, v, u, v, u, 0] : [0, 0, u, 0, u, v, 0, v];
  g.setAttribute('position', new THREE.Float32BufferAttribute(order.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [normal.x, normal.y, normal.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function pushBack(m) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }

/** A rectangle of floor with walls round it; `open[side]` = [from, to] gaps along that side. */
class Rect {
  constructor(id, x0, z0, x1, z1, floor, wall, extra = {}) {
    Object.assign(this, { id, x0, z0, x1, z1, floor, wall, open: { n: [], s: [], e: [], w: [] }, ...extra });
  }
  get cx() { return (this.x0 + this.x1) / 2; }
  get cz() { return (this.z0 + this.z1) / 2; }
  /** A gap in side `s` ('n' z0, 's' z1, 'w' x0, 'e' x1) centred at `c` (x for n/s, z for e/w), `w` wide. */
  gap(s, c, w, lintel = true) { this.open[s].push([c - w / 2, c + w / 2, lintel]); return this; }
}

class Builder {
  constructor(M) { this.M = M; this.parts = new Map(); }
  add(mat, geo) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push(geo); }
  box(mat, w, h, d, x, y, z, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); this.add(mat, g.toNonIndexed()); }

  floor(r, mat = r.floor, tile = 2) {
    this.add(mat, quad([V3(r.x0, 0, r.z0), V3(r.x1, 0, r.z0), V3(r.x1, 0, r.z1), V3(r.x0, 0, r.z1)], V3(0, 1, 0), r.x1 - r.x0, r.z1 - r.z0, tile));
  }

  /** One wall face along a side of `r`, inner face only, with its gaps (and lintels over doors). */
  side(r, s, neonK = -1) {
    const M = this.M, along = s === 'n' || s === 's';
    const lo = along ? r.x0 : r.z0, hi = along ? r.x1 : r.z1;
    const fixed = s === 'n' ? r.z0 : s === 's' ? r.z1 : s === 'w' ? r.x0 : r.x1;
    const n = s === 'n' ? V3(0, 0, 1) : s === 's' ? V3(0, 0, -1) : s === 'w' ? V3(1, 0, 0) : V3(-1, 0, 0);
    const P = (t, y) => (along ? V3(t, y, fixed + n.z * 0.08) : V3(fixed + n.x * 0.08, y, t));
    const tile = r.wall === M.hallWall || r.wall === M.ballWall ? WALL_H : 1.6;
    const seg = (a, b, y0, y1) => {
      if (b - a < 0.01) return;
      this.add(r.wall, quad([P(a, y0), P(b, y0), P(b, y1), P(a, y1)], n, b - a, y1 - y0, tile, y1 - y0 === WALL_H ? WALL_H : tile));
      if (y1 === WALL_H) { // the ink cap over the cut-away top (a comic floor plan)
        const c0 = along ? V3(a, 2.68, fixed - 0.1) : V3(fixed - 0.1, 2.68, a), c1 = along ? V3(b, 2.68, fixed - 0.1) : V3(fixed - 0.1, 2.68, b);
        const c2 = along ? V3(b, 2.68, fixed + 0.1) : V3(fixed + 0.1, 2.68, b), c3 = along ? V3(a, 2.68, fixed + 0.1) : V3(fixed + 0.1, 2.68, a);
        this.add(M.cap, quad([c0, c1, c2, c3], V3(0, 1, 0), b - a, 0.2, 1));
      }
      // neon tube along the hall walls, at the top of the cut
      if (neonK >= 0 && y1 === WALL_H && b - a > 0.6) {
        const k = (((neonK + Math.round(a)) % 3) + 3) % 3, mid = (a + b) / 2, len = b - a - 0.3; // (a can be negative)
        const o = P(mid, 2.32).addScaledVector(n, 0.05);
        this.box(M.neon[k], along ? len : 0.05, 0.06, along ? 0.05 : len, o.x, o.y, o.z);
        const o2 = P(mid, 0.12).addScaledVector(n, 0.05);
        this.box(M.neon[(k + 1) % 3], along ? len : 0.04, 0.035, along ? 0.04 : len, o2.x, o2.y, o2.z);
      }
    };
    const gaps = [...r.open[s]].sort((p, q) => p[0] - q[0]);
    let t = lo;
    const walls = [];
    for (const [a, b, lintel] of gaps) {
      seg(t, Math.max(t, a), 0, WALL_H); walls.push([t, a]);
      if (lintel) seg(a, b, DOOR_H, WALL_H);
      t = b;
    }
    seg(t, hi, 0, WALL_H); walls.push([t, hi]);
    return { walls, n, fixed, along };
  }

  /** Merge per material into a handful of meshes, ink lines along the solid ones. */
  scene() {
    const root = new THREE.Group(), M = this.M;
    const inked = new Set([M.hallWall, M.ballWall, M.mass, M.wood, M.brass, M.linen, M.steel, M.black, ...Object.values(M.rooms)]);
    const edges = [];
    for (const [mat, geos] of this.parts) {
      const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      if (inked.has(mat)) { for (const g of list) edges.push(new THREE.EdgesGeometry(g, 35)); pushBack(mat); }
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      if (M.neon.includes(mat)) mesh.userData.noCollide = true;
      root.add(mesh);
    }
    root.userData.inked = true;
    const lines = new THREE.LineSegments(mergeGeometries(edges, false), new THREE.LineBasicMaterial({ color: 0x0e0810 }));
    lines.raycast = () => {};
    root.add(lines);
    return root;
  }
}

/** The plan: rectangles, the rooms and what the zone puts where. */
function layout(M) {
  const rects = [], rooms = [], seals = [], posters = [];
  const R = (...a) => { const r = new Rect(...a); rects.push(r); return r; };
  const lobby = R('lobby', -4, 0, 4, 6, M.lobbyFloor, M.hallWall, { hall: true });
  const main = R('main', -HW, -46, HW, 0, M.hallFloor, M.hallWall, { hall: true });
  lobby.gap('n', 0, HW * 2, false); main.gap('s', 0, HW * 2, false);
  const ball = R('ballroom', BALL.x0, BALL.z0, BALL.x1, BALL.z1, M.danceFloor, M.ballWall, { ballroom: true });
  ball.gap('s', 0, 2.4); main.gap('n', 0, 2.4);
  // a room off a hall: its door on the side facing the hall, the hall's gap to match
  const room = (wing, hall, side, x0, z0, x1, z1, doorSide, num) => {
    const r = R(`room${num}`, x0, z0, x1, z1, M.roomFloor, M.rooms[wing], { wing, num });
    const along = doorSide === 'n' || doorSide === 's', c = along ? (x0 + x1) / 2 : (z0 + z1) / 2;
    r.gap(doorSide, c, DOOR_W);
    hall.gap({ n: 's', s: 'n', e: 'w', w: 'e' }[doorSide], c, DOOR_W);
    const dz = doorSide === 'n' ? z0 : doorSide === 's' ? z1 : null, dx = doorSide === 'w' ? x0 : doorSide === 'e' ? x1 : null;
    r.door = along ? V3(c, 0, dz) : V3(dx, 0, c);
    r.alongX = along; // the door slides along x
    r.inward = doorSide === 'n' ? V3(0, 0, 1) : doorSide === 's' ? V3(0, 0, -1) : doorSide === 'w' ? V3(1, 0, 0) : V3(-1, 0, 0);
    rooms.push(r);
    return r;
  };
  let num = 1301;
  for (const w of WINGS) {
    const inner = w.side * HW, outer = w.side * (HW + WING_L);
    const hall = R(w.id, Math.min(inner, outer), w.zc - HW, Math.max(inner, outer), w.zc + HW, M.hallFloor, M.hallWall, { hall: true, wing: w.id });
    hall.gap(w.side < 0 ? 'e' : 'w', w.zc, HW * 2, false);
    main.gap(w.side < 0 ? 'w' : 'e', w.zc, HW * 2, false);
    w.hall = hall;
    for (let i = 0; i < 3; i++) {
      const a = w.side * (HW + 1.2 + i * RW), b = w.side * (HW + 1.2 + (i + 1) * RW), x0 = Math.min(a, b), x1 = Math.max(a, b);
      room(w.id, hall, 'n', x0, w.zc - HW - RD, x1, w.zc - HW, 's', num++);
      room(w.id, hall, 's', x0, w.zc + HW, x1, w.zc + HW + RD, 'n', num++);
    }
    // the seal console against the wing's end wall
    seals.push({ i: w.seal, wing: w.id, name: w.name, pos: V3(w.side * (HW + WING_L - 0.55), 0, w.zc), face: w.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  // the Screening Rooms, off the main hall: two by the lobby, two by the ballroom
  for (const [z0, z1] of [[-5.8, -1.8], [-42, -38]]) for (const s of [-1, 1]) {
    room('screening', main, s < 0 ? 'w' : 'e', s < 0 ? -HW - RD : HW, z0, s < 0 ? -HW : HW + RD, z1, s < 0 ? 'e' : 'w', num++);
  }
  seals.push({ i: 4, wing: 'screening', name: 'The Screening Rooms', pos: V3(-HW + 0.5, 0, -44.6), face: Math.PI / 2 });
  return { rects, rooms, seals, posters, lobby, main, ball };
}

/** Dressing that's part of the building (static, merged): the lobby, the ballroom's stage and booth, room furniture. */
function dress(B, L) {
  const M = B.M;
  // lobby: the elevator doors on the south wall, a reception desk, two potted palms
  B.box(M.steel, 2.2, 2.5, 0.08, 0, 1.25, 5.9);
  B.box(M.black, 0.04, 2.5, 0.1, 0, 1.25, 5.85);
  B.box(M.brass, 2.6, 0.12, 0.12, 0, 2.62, 5.88);
  B.box(M.wood, 2.4, 1.05, 0.7, -2.4, 0.52, 2.2);
  B.box(M.brass, 2.5, 0.06, 0.8, -2.4, 1.07, 2.2);
  for (const x of [3.2, -3.4]) { B.box(M.black, 0.5, 0.6, 0.5, x, 0.3, 5.2); B.box(M.rooms.lab, 0.9, 1.2, 0.9, x, 1.2, 5.2); }
  // the ballroom: stage riser front, DJ booth, chandeliers' chains are above the cut (lights do it)
  B.add(M.stage, quad([V3(BALL.x0, 0.005, BALL.z0), V3(BALL.x1, 0.005, BALL.z0), V3(BALL.x1, 0.005, BALL.stage), V3(BALL.x0, 0.005, BALL.stage)], V3(0, 1, 0), BALL.x1 - BALL.x0, BALL.stage - BALL.z0, 2));
  B.box(M.brass, BALL.x1 - BALL.x0 - 0.4, 0.08, 0.12, 0, 0.04, BALL.stage);
  B.box(M.black, 3.4, 1.15, 1.2, 0, 0.58, -67.6);         // the DJ booth
  B.box(M.neon[0], 3.42, 0.06, 0.04, 0, 1.12, -66.99);
  // bar along the ballroom's west wall
  B.box(M.wood, 1.0, 1.1, 8, BALL.x0 + 1.2, 0.55, -56);
  B.box(M.brass, 1.1, 0.06, 8.1, BALL.x0 + 1.2, 1.12, -56);
  // room furniture: a bed or a desk against the back wall, by wing
  for (const r of L.rooms) {
    const back = r.inward.clone().multiplyScalar(1); // the door wall's inward normal: the back wall is opposite
    const bx = r.cx + back.x * (RD / 2 - 0.7), bz = r.cz + back.z * (RD / 2 - 0.7);
    r.back = V3(bx, 0, bz);
    const rot = r.alongX ? 0 : Math.PI / 2;
    if (r.wing === 'wardrobe' || r.wing === 'gallery') {
      B.box(M.wood, 2.0, 0.42, 1.5, bx, 0.21, bz, rot);
      B.box(M.linen, 1.9, 0.18, 1.4, bx, 0.5, bz, rot);
      r.bed = V3(bx, 0.6, bz);
    } else if (r.wing === 'lab') {
      B.box(M.steel, 2.0, 0.9, 0.8, bx, 0.45, bz, rot);
      r.bench = V3(bx, 0.92, bz);
    } else if (r.wing === 'switchboard') {
      B.box(M.wood, 2.2, 0.8, 0.8, bx, 0.4, bz, rot);
      B.box(M.black, 1.6, 0.9, 0.12, bx + back.x * 0.3, 1.25, bz + back.z * 0.3, rot);
      r.desk = V3(bx, 0.82, bz);
    } else { // screening: rows of seats facing the back wall's screen
      for (const k of [-1, 1]) B.box(M.black, r.alongX ? 2.6 : 0.6, 0.5, r.alongX ? 0.6 : 2.6, r.cx + (r.alongX ? 0 : k * 0.6) - back.x * 0.6, 0.25, r.cz + (r.alongX ? k * 0.6 : 0) - back.z * 0.6);
      r.screen = V3(bx + back.x * 0.55, 1.5, bz + back.z * 0.55);
    }
  }
}

let building = null;
/** The 13th floor as a club-engine building (built once, then shared). */
export function buildHotel() {
  if (!building) {
    building = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const M = makeMaterials();
      const B = new Builder(M);
      const L = layout(M);
      for (const r of L.rects) {
        B.floor(r, r.floor, r.ballroom ? 3 : 2);
        for (const s of ['n', 's', 'e', 'w']) {
          const res = B.side(r, s, r.hall ? (s === 'n' || s === 'w' ? 0 : 1) : -1);
          // posters on the long hall walls, between the doors
          if (!r.hall || r.id === 'lobby' || (r.wing && !res.along) || (r.id === 'main' && res.along)) continue;
          for (const [a, b] of res.walls) {
            for (let t = a + 1.1; t <= b - 1.1; t += 2.6) {
              const p = res.along ? V3(t, 1.55, res.fixed) : V3(res.fixed, 1.55, t);
              p.addScaledVector(res.n, 0.11);
              L.posters.push({ pos: p, n: res.n.clone(), hall: r.id });
            }
          }
        }
      }
      dress(B, L);
      const scene = B.scene();
      const collider = buildCollider(scene);
      collider.material.side = THREE.DoubleSide;
      const { floor, mainY } = scanFloor(scene, collider);
      return {
        scene, meta: { lights: [] }, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene), M,
        rooms: L.rooms, seals: L.seals, posters: L.posters, wings: WINGS, main: L.main, lobby: L.lobby, ball: L.ball,
        entrance: { pos: V3(0, 0, 4.4), heading: Math.PI, door: V3(0, 0, 5.4) },
        ballDoor: V3(0, 0, -46),
        halls: L.rects.filter((r) => r.hall),
      };
    });
  }
  return building;
}

export { NEON };
