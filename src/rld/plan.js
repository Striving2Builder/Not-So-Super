// An RLD Walk's street, generated (no model file): an H of narrow canal-side streets, the west and
// east streets joined by a cross street, rooms on both sides of all three behind red doors, each with
// a big curtained window on the street; a lead-lined door at the north end of each long street opens
// on a bigger dressing room ("Which one is hers?"); the way in is a gate at the west street's south end.
// Built like the asylum and the hotel's floor (rectangles with their walls' inner faces, merged per
// material, a BVH collider for the club engine) plus the metadata the zone places its gameplay on.
// Metres: x east, z south.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCollider, scanFloor } from '../clubgeo.js';
import { makeMaterials, WINDOWS, SIGNS } from './art.js';

export const WALL_H = 3.2;
export const DOOR_W = 1.1, DOOR_H = 2.3, LEAD_W = 1.4;
const SW = 1.8;                 // street half-width (narrow: the close camera's level)
const RD = 3.6, RW = 3.6;       // room depth, width
const NSEG = 2;                 // rooms per side between the cross street and a street's end
const ZL = SW + NSEG * RW + 0.5; // street half-length
export const XS = SW + RD + RW; // the long streets' centre lines, x = ±XS
const LEAD = { w: 7, d: 6 };     // the lead rooms
const WIN = { w: 1.5, y0: 0.7, y1: 2.45 };

// ---------------------------------------------------------------- geometry helpers
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
/** A quad through 4 points, UV-tiled every `tile` metres (or mapped to `uv` = [u0, v0, u1, v1]), facing `normal`. */
function quad(pts, normal, uLen, vLen, tileU, tileV = tileU, uv = null) {
  const g = new THREE.BufferGeometry();
  const [a, b, c, d] = pts;
  const e1 = new THREE.Vector3().subVectors(b, a), e2 = new THREE.Vector3().subVectors(c, a);
  const flip = new THREE.Vector3().crossVectors(e1, e2).dot(normal) < 0;
  const order = flip ? [a, d, c, b] : [a, b, c, d];
  const [u0, v0, u1, v1] = uv || [0, 0, uLen / tileU, vLen / tileV];
  const uvs = flip ? [u0, v0, u0, v1, u1, v1, u1, v0] : [u0, v0, u1, v0, u1, v1, u0, v1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(order.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 2, 3].flatMap(() => [normal.x, normal.y, normal.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
function pushBack(m) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; }
const NORMAL = { n: V3(0, 0, 1), s: V3(0, 0, -1), w: V3(1, 0, 0), e: V3(-1, 0, 0) }; // each side's inner face
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };

/** A rectangle of floor with walls round it; `open[side]` = [from, to, lintel] gaps along that side. */
class Rect {
  constructor(id, x0, z0, x1, z1, floor, wall, extra = {}) {
    Object.assign(this, { id, x0, z0, x1, z1, floor, wall, open: { n: [], s: [], e: [], w: [] }, ...extra });
  }
  get cx() { return (this.x0 + this.x1) / 2; }
  get cz() { return (this.z0 + this.z1) / 2; }
  gap(s, c, w, lintel = true) { this.open[s].push([c - w / 2, c + w / 2, lintel]); return this; }
  /** A point on side `s` at `t` (x for n/s, z for e/w), `out` metres off the wall into the rect. */
  on(s, t, out = 0, y = 0) {
    const n = NORMAL[s];
    const fixed = s === 'n' ? this.z0 : s === 's' ? this.z1 : s === 'w' ? this.x0 : this.x1;
    return s === 'n' || s === 's' ? V3(t, y, fixed + n.z * out) : V3(fixed + n.x * out, y, t);
  }
}

class Builder {
  constructor(M) { this.M = M; this.parts = new Map(); }
  add(mat, geo) { if (!this.parts.has(mat)) this.parts.set(mat, []); this.parts.get(mat).push(geo); }
  box(mat, w, h, d, x, y, z, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); this.add(mat, g.toNonIndexed()); }

  floor(r, tile = 2) {
    this.add(r.floor, quad([V3(r.x0, 0, r.z0), V3(r.x1, 0, r.z0), V3(r.x1, 0, r.z1), V3(r.x0, 0, r.z1)], V3(0, 1, 0), r.x1 - r.x0, r.z1 - r.z0, tile));
  }

  /** One wall face along side `s` of `r` (inner face only), with its gaps, lintels, and a neon tube on street walls. */
  side(r, s, neon = false) {
    const M = this.M, along = s === 'n' || s === 's';
    const lo = along ? r.x0 : r.z0, hi = along ? r.x1 : r.z1, n = NORMAL[s];
    const P = (t, y) => r.on(s, t, 0.08, y);
    const tile = r.wall === M.streetWall ? WALL_H : 1.6;
    const seg = (a, b, y0, y1) => {
      if (b - a < 0.01) return;
      this.add(r.wall, quad([P(a, y0), P(b, y0), P(b, y1), P(a, y1)], n, b - a, y1 - y0, tile, y1 - y0 === WALL_H ? WALL_H : tile));
      if (y1 === WALL_H) { // the ink cap over the cut-away top (a comic floor plan)
        const c = [r.on(s, a, -0.02, 2.68), r.on(s, b, -0.02, 2.68), r.on(s, b, 0.18, 2.68), r.on(s, a, 0.18, 2.68)];
        this.add(M.cap, quad(c, V3(0, 1, 0), b - a, 0.2, 1));
      }
      if (neon && y1 === WALL_H && b - a > 0.6) { // red neon along the street walls, under the cut
        const k = (((Math.round(a * 3) % 3) + 3) % 3), mid = (a + b) / 2, len = b - a - 0.3, o = r.on(s, mid, 0.13, 2.4);
        this.box(M.neon[k], along ? len : 0.05, 0.06, along ? 0.05 : len, o.x, o.y, o.z);
      }
    };
    const gaps = [...r.open[s]].sort((p, q) => p[0] - q[0]);
    let t = lo;
    for (const [a, b, lintel] of gaps) {
      seg(t, Math.max(t, a), 0, WALL_H);
      if (lintel) seg(a, b, DOOR_H, WALL_H);
      t = b;
    }
    seg(t, hi, 0, WALL_H);
  }

  /** A window (atlas look `v`) on the street face of side `s` of the street rect `r`, centred at `t`. */
  window(r, s, t, v) {
    const n = NORMAL[s], h = WIN.w / 2, u0 = v / WINDOWS, u1 = (v + 1) / WINDOWS;
    const pts = [r.on(s, t - h, 0.1, WIN.y0), r.on(s, t + h, 0.1, WIN.y0), r.on(s, t + h, 0.1, WIN.y1), r.on(s, t - h, 0.1, WIN.y1)];
    const flipU = s === 's' || s === 'w'; // (u left to right as seen from the street)
    this.add(this.M.window, quad(pts, n, 1, 1, 1, 1, flipU ? [u1, 0, u0, 1] : [u0, 0, u1, 1]));
    const sill = r.on(s, t, 0.16, WIN.y0 - 0.05);
    this.box(this.M.black, s === 'n' || s === 's' ? WIN.w + 0.2 : 0.14, 0.1, s === 'n' || s === 's' ? 0.14 : WIN.w + 0.2, sill.x, sill.y, sill.z);
  }

  /** A neon sign (atlas cell `i`) flat on a street wall, above a door. */
  sign(r, s, t, i) {
    const n = NORMAL[s], w = 1.3, h = w * 96 / 256, cx = (i % 2) / 2, cy = 1 - Math.floor(i / 2) / 4;
    const flipU = s === 's' || s === 'w'; // (u left to right as seen from the street)
    const pts = [r.on(s, t - w / 2, 0.12, 2.42 - h), r.on(s, t + w / 2, 0.12, 2.42 - h), r.on(s, t + w / 2, 0.12, 2.42), r.on(s, t - w / 2, 0.12, 2.42)];
    const uv = flipU ? [cx + 0.5, cy - 0.25, cx, cy] : [cx, cy - 0.25, cx + 0.5, cy];
    this.add(this.M.sign, quad(pts, n, 1, 1, 1, 1, uv));
  }

  /** Merge per material into a handful of meshes, ink lines along the solid ones. */
  scene() {
    const root = new THREE.Group(), M = this.M;
    const inked = new Set([M.streetWall, M.roomWall, M.leadWall, M.mass, M.wood, M.brass, M.linen, M.velvet, M.black]);
    const edges = [];
    for (const [mat, geos] of this.parts) {
      const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
      if (inked.has(mat)) { for (const g of list) edges.push(new THREE.EdgesGeometry(g, 35)); pushBack(mat); }
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      if (mat === M.sign) { mesh.renderOrder = 2; root.userData.signs = mesh; }
      root.add(mesh);
    }
    root.userData.inked = true;
    const lines = new THREE.LineSegments(mergeGeometries(edges, false), new THREE.LineBasicMaterial({ color: 0x0e0408 }));
    lines.raycast = () => {};
    root.add(lines);
    return root;
  }
}

// ---------------------------------------------------------------- the plan
function layout(M) {
  const rects = [], rooms = [], streets = {};
  const R = (...a) => { const r = new Rect(...a); rects.push(r); return r; };
  const W = streets.W = R('W', -XS - SW, -ZL, -XS + SW, ZL, M.street, M.streetWall, { street: true });
  const E = streets.E = R('E', XS - SW, -ZL, XS + SW, ZL, M.street, M.streetWall, { street: true });
  const X = streets.X = R('X', -XS + SW, -SW, XS - SW, SW, M.street, M.streetWall, { street: true });
  W.gap('e', 0, SW * 2, false); E.gap('w', 0, SW * 2, false); X.gap('w', 0, SW * 2, false); X.gap('e', 0, SW * 2, false);
  // the way in: a gate at the west street's south end
  const gate = R('gate', -XS - SW, ZL, -XS + SW, ZL + 3, M.street, M.streetWall, { street: true });
  W.gap('s', -XS, SW * 2, false); gate.gap('n', -XS, SW * 2, false);
  let num = 1;
  /** A room off street `st`, its door in side `ds` (facing the street), door + window on that wall. */
  const room = (st, x0, z0, x1, z1, ds) => {
    const r = R(`room${num}`, x0, z0, x1, z1, M.roomFloor, M.roomWall, { num: num++, street: false, st: st.id });
    const along = ds === 'n' || ds === 's', mid = along ? r.cx : r.cz;
    const k = rooms.length % 2 ? 1 : -1;           // the door on one side of the window or the other
    const dc = mid + k * 0.85, wc = mid - k * 0.8;
    r.gap(ds, dc, DOOR_W); st.gap(OPP[ds], dc, DOOR_W);
    Object.assign(r, {
      ds, along, alongX: along, door: r.on(ds, dc), inward: NORMAL[ds].clone(),
      win: { st, s: OPP[ds], t: wc }, doorT: dc,
    });
    rooms.push(r);
    return r;
  };
  for (const [st, sx] of [[W, -1], [E, 1]]) {
    const cx = sx * XS;
    // the outer side: rooms all along (one faces the cross street's mouth)
    for (let i = -NSEG; i <= NSEG; i++) {
      const z0 = i * RW - RW / 2, z1 = z0 + RW;
      if (sx < 0) room(st, cx - SW - RD, z0, cx - SW, z1, 'e'); else room(st, cx + SW, z0, cx + SW + RD, z1, 'w');
    }
    // the inner side: rooms either side of the cross street
    for (let i = -NSEG; i <= NSEG; i++) {
      if (!i) continue;
      const z0 = i * RW - RW / 2, z1 = z0 + RW;
      if (sx < 0) room(st, cx + SW, z0, cx + SW + RD, z1, 'w'); else room(st, cx - SW - RD, z0, cx - SW, z1, 'e');
    }
  }
  // the cross street's rooms, north and south
  for (let x0 = -XS + SW + RD; x0 < XS - SW - RD - 0.1; x0 += RW) {
    room(X, x0, -SW - RD, x0 + RW, -SW, 's');
    room(X, x0, SW, x0 + RW, SW + RD, 'n');
  }
  // the lead rooms: at the north end of each long street, through a lead-lined door
  const leads = [];
  for (const [st, sx] of [[W, -1], [E, 1]]) {
    const cx = sx * XS;
    const r = R(`lead${sx < 0 ? 'W' : 'E'}`, cx - LEAD.w / 2, -ZL - LEAD.d, cx + LEAD.w / 2, -ZL, M.leadFloor, M.leadWall, { lead: true, street: false, st: st.id });
    st.gap('n', cx, LEAD_W); r.gap('s', cx, LEAD_W);
    Object.assign(r, { ds: 's', along: true, alongX: true, door: V3(cx, 0, -ZL), inward: V3(0, 0, -1) });
    leads.push(r);
  }
  return { rects, rooms, leads, streets, gate };
}

/** Dressing that's part of the building (static, merged): beds and chairs, the dressing rooms' racks and mirrors. */
function dress(B, L) {
  const M = B.M;
  for (const r of L.rooms) {
    const back = r.inward.clone(); // from the door into the room: the back wall is that way
    const bx = r.cx + back.x * (RD / 2 - 0.62), bz = r.cz + back.z * (RD / 2 - 0.62), rot = r.alongX ? 0 : Math.PI / 2;
    B.box(M.wood, 1.9, 0.4, 1.2, bx, 0.2, bz, rot);
    B.box(M.linen, 1.8, 0.16, 1.1, bx, 0.48, bz, rot);
    B.box(M.velvet, r.alongX ? 1.9 : 0.12, 0.9, r.alongX ? 0.12 : 1.9, bx + back.x * 0.62, 0.65, bz + back.z * 0.62); // headboard
    r.bed = V3(bx, 0, bz);
    // where someone sits (on the bed's edge, facing the door) and where she comes to (by the window wall)
    r.sit = V3(r.cx + back.x * 0.25, 0, r.cz + back.z * 0.25);
    r.wake = V3(r.cx - back.x * 0.55 + (r.alongX ? 0.6 : 0), 0, r.cz - back.z * 0.55 + (r.alongX ? 0 : 0.6));
    r.faceDoor = Math.atan2(-back.x, -back.z);
  }
  for (const r of L.leads) {
    // a clothes rail along the back wall, a vanity with a bulb-lit mirror, a chaise
    const z = r.z0 + 0.8;
    B.box(M.brass, 3.4, 0.05, 0.05, r.cx, 1.75, z);
    for (const dx of [-1.7, 1.7]) B.box(M.brass, 0.05, 1.75, 0.05, r.cx + dx, 0.875, z);
    r.rail = V3(r.cx, 1.7, z);
    B.box(M.wood, 1.4, 0.8, 0.5, r.x1 - 1.0, 0.4, r.cz + 0.8);
    B.box(M.black, 1.1, 1.0, 0.06, r.x1 - 0.32, 1.45, r.cz + 0.8, Math.PI / 2);
    B.box(M.velvet, 0.8, 0.45, 1.8, r.x0 + 0.7, 0.23, r.cz + 0.6);
  }
}

let building = null;
/** The street as a club-engine building (built once, then shared). */
export function buildStreet() {
  if (!building) {
    building = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const M = makeMaterials();
      const B = new Builder(M);
      const L = layout(M);
      for (const r of L.rects) {
        B.floor(r, r.street ? 1.6 : 2);
        for (const s of ['n', 's', 'e', 'w']) B.side(r, s, r.street && r.id !== 'gate');
      }
      // the windows and the signs on the street faces
      L.rooms.forEach((r, i) => {
        r.look = [0, 1, 0, 3, 2, 0, 1, 3][i % 8];
        B.window(r.win.st, r.win.s, r.win.t, r.look);
        if (i % 3 === 0) B.sign(r.win.st, r.win.s, r.win.t, (i / 3) % SIGNS.length);
      });
      dress(B, L);
      const scene = B.scene();
      const collider = buildCollider(scene);
      collider.material.side = THREE.DoubleSide;
      const { floor, mainY } = scanFloor(scene, collider);
      const g = L.gate;
      return {
        scene, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene), M,
        rooms: L.rooms, leads: L.leads, streets: L.streets,
        entrance: { pos: V3(-XS, 0, ZL + 0.6), heading: Math.PI, door: V3(-XS, 0, g.z1 - 0.6) },
        // the routes the minders and the hostesses walk (ends of each street)
        routes: [
          { id: 'W', from: V3(-XS, 0, -ZL + 1), to: V3(-XS, 0, ZL - 1) },
          { id: 'E', from: V3(XS, 0, -ZL + 1), to: V3(XS, 0, ZL - 1) },
          { id: 'X', from: V3(-XS + SW + 0.6, 0, 0), to: V3(XS - SW - 0.6, 0, 0) },
        ],
        signs: scene.userData.signs,
        dims: { SW, ZL, XS, RD, RW },
      };
    });
  }
  return building;
}
