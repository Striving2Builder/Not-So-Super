// The Super Squirt factory, generated (docs/design/act2.md "The factory production lines"): Act 1's
// Floor 13 plan without the ballroom (the hotel's Builder, src/hotel/plan.js). A loading dock at the
// south end, the main hall north to the foreman's office, and four production lines off it in place
// of the hotel's wings: a wide hall with a conveyor down its middle, three bays a side behind steel
// doors (vats, pill presses, bottling, packing) and the line's lever against the end wall.
// Metres: x east, z south; the dock is at the south end.
import * as THREE from 'three';
import { buildCollider, scanFloor } from '../clubgeo.js';
import { Rect, Builder, quad, DOOR_W, HW } from '../hotel/plan.js';
import { makeFactoryMaterials } from './art.js';

const WHW = 2.4;            // a line's hall half-width (the belt down the middle, a lane either side)
const RD = 4.2, RW = 4;     // bay depth, width
const LINE_L = 3 * RW + 2.4;
const MAIN_N = -36;         // the main hall's north end (the foreman's office beyond)
export const BELT = { h: 0.85, w: 0.8, from: HW + 2.2, to: HW + LINE_L - 2.6 };

/** The production lines: id, side (-1 west / 1 east), hall centre z, lever index. */
export const LINES = [
  { id: 'mixing', name: 'Line 1: Mixing', side: -1, zc: -12, i: 0 },
  { id: 'press', name: 'Line 2: Pill Presses', side: 1, zc: -12, i: 1 },
  { id: 'bottling', name: 'Line 3: Bottling', side: -1, zc: -28, i: 2 },
  { id: 'packing', name: 'Line 4: Packing', side: 1, zc: -28, i: 3 },
];

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function layout(M) {
  const rects = [], rooms = [], levers = [], signs = [];
  const R = (...a) => { const r = new Rect(...a); rects.push(r); return r; };
  const lobby = R('lobby', -4, 0, 4, 6, M.lobbyFloor, M.ballWall, { hall: true });
  const main = R('main', -HW, MAIN_N, HW, 0, M.hallFloor, M.hallWall, { hall: true });
  lobby.gap('n', 0, HW * 2, false); main.gap('s', 0, HW * 2, false);
  const room = (wing, hall, x0, z0, x1, z1, doorSide, num) => {
    const r = R(`bay${num}`, x0, z0, x1, z1, M.roomFloor, M.rooms[wing], { wing, num });
    const along = doorSide === 'n' || doorSide === 's', c = along ? (x0 + x1) / 2 : (z0 + z1) / 2;
    r.gap(doorSide, c, DOOR_W);
    hall.gap({ n: 's', s: 'n', e: 'w', w: 'e' }[doorSide], c, DOOR_W);
    const dz = doorSide === 'n' ? z0 : doorSide === 's' ? z1 : null, dx = doorSide === 'w' ? x0 : doorSide === 'e' ? x1 : null;
    r.door = along ? V3(c, 0, dz) : V3(dx, 0, c);
    r.alongX = along;
    r.inward = doorSide === 'n' ? V3(0, 0, 1) : doorSide === 's' ? V3(0, 0, -1) : doorSide === 'w' ? V3(1, 0, 0) : V3(-1, 0, 0);
    rooms.push(r);
    return r;
  };
  for (const w of LINES) {
    const inner = w.side * HW, outer = w.side * (HW + LINE_L);
    const hall = R(w.id, Math.min(inner, outer), w.zc - WHW, Math.max(inner, outer), w.zc + WHW, M.hallFloor, M.hallWall, { hall: true, wing: w.id });
    hall.gap(w.side < 0 ? 'e' : 'w', w.zc, WHW * 2, false);
    main.gap(w.side < 0 ? 'w' : 'e', w.zc, WHW * 2, false);
    w.hall = hall;
    for (let i = 0; i < 3; i++) {
      const a = w.side * (HW + 1.2 + i * RW), b = w.side * (HW + 1.2 + (i + 1) * RW), x0 = Math.min(a, b), x1 = Math.max(a, b);
      room(w.id, hall, x0, w.zc - WHW - RD, x1, w.zc - WHW, 's', `${w.i + 1}${'ABC'[i]}`);
      room(w.id, hall, x0, w.zc + WHW, x1, w.zc + WHW + RD, 'n', `${w.i + 1}${'DEF'[i]}`);
    }
    levers.push({ i: w.i, line: w.id, name: w.name, pos: V3(w.side * (HW + LINE_L - 0.55), 0, w.zc), face: w.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  const office = room('office', main, -3, MAIN_N - 4.6, 3, MAIN_N, 's', 'F');
  office.foreman = true;
  return { rects, rooms, levers, signs, lobby, main, office };
}

/** The static dressing: the dock, the belts, the bays' machines (merged into the building). */
function dress(B, L) {
  const M = B.M;
  // the dock: a roller shutter on the south wall, pallets, a forklift's worth of crates
  B.box(M.steel, 3.2, 2.6, 0.08, 0, 1.3, 5.9);
  for (let y = 0.2; y < 2.6; y += 0.22) B.box(M.black, 3.2, 0.03, 0.1, 0, y, 5.85);
  B.box(M.brass, 3.4, 0.14, 0.14, 0, 2.66, 5.88);
  for (const [x, z] of [[-3, 1.4], [3, 1.2], [-3, 3.6]]) { B.box(M.wood, 1.1, 0.14, 1.1, x, 0.07, z); B.box(M.wood, 0.9, 0.7, 0.9, x, 0.5, z); B.box(M.pink, 0.92, 0.12, 0.92, x, 0.62, z); }
  // the belts down every line: rollers' frame, the belt, a guard rail; bottles riding it
  for (const w of LINES) {
    const a = w.side * BELT.from, b = w.side * BELT.to, len = Math.abs(b - a), cx = (a + b) / 2;
    B.box(M.steel, len, BELT.h - 0.1, BELT.w, cx, (BELT.h - 0.1) / 2, w.zc);
    const top = new THREE.BoxGeometry(len, 0.1, BELT.w - 0.06); top.translate(cx, BELT.h - 0.05, w.zc);
    B.add(M.belts[w.i], top.toNonIndexed());
    for (const s of [-1, 1]) B.box(M.brass, len, 0.06, 0.06, cx, BELT.h + 0.18, w.zc + s * (BELT.w / 2 + 0.02));
    // the hopper at the head of the line, the chute at its end
    B.box(M.steel, 1.2, 1.6, 1.2, w.side * (BELT.from - 0.2), 0.8, w.zc);
    B.box(M.pink, 0.9, 0.08, 0.9, w.side * (BELT.from - 0.2), 1.62, w.zc);
    B.box(M.black, 0.9, 1.2, 1.0, w.side * (BELT.to + 0.5), 0.6, w.zc);
  }
  // the bays: each line's machines against the back wall
  for (const r of L.rooms) {
    const back = r.inward.clone();
    const bx = r.cx + back.x * (RD / 2 - 0.8), bz = r.cz + back.z * (RD / 2 - 0.8);
    r.back = V3(bx, 0, bz);
    const rot = r.alongX ? 0 : Math.PI / 2;
    const off = (k) => (r.alongX ? [k, 0] : [0, k]);
    if (r.wing === 'mixing') { // two vats, pink to the brim
      for (const k of [-0.9, 0.9]) {
        const [ox, oz] = off(k);
        const vat = new THREE.CylinderGeometry(0.62, 0.62, 1.5, 14); vat.translate(bx + ox, 0.75, bz + oz); B.add(M.steel, vat.toNonIndexed());
        const syrup = new THREE.CylinderGeometry(0.56, 0.56, 0.04, 14); syrup.translate(bx + ox, 1.5, bz + oz); B.add(M.pink, syrup.toNonIndexed());
      }
      r.bench = V3(bx, 1.52, bz);
    } else if (r.wing === 'press') { // a pill press: a frame, the ram, the hopper
      B.box(M.steel, 1.6, 1.0, 0.9, bx, 0.5, bz, rot);
      B.box(M.black, 0.5, 1.2, 0.5, bx, 1.6, bz, rot);
      B.box(M.brass, 1.7, 0.08, 1.0, bx, 1.02, bz, rot);
      r.bench = V3(bx, 1.04, bz);
    } else if (r.wing === 'bottling') { // racks of pink bottles
      B.box(M.steel, 2.2, 1.7, 0.6, bx, 0.85, bz, rot);
      for (const y of [0.5, 1.05, 1.6]) B.box(M.pink, 2.0, 0.3, 0.4, bx, y, bz, rot);
      r.bench = V3(bx - back.x * 0.6, 0.9, bz - back.z * 0.6);
      B.box(M.wood, r.alongX ? 1.6 : 0.6, 0.85, r.alongX ? 0.6 : 1.6, r.bench.x, 0.42, r.bench.z);
    } else if (r.wing === 'packing') { // crates of Super Squirt, stacked
      for (const k of [-0.8, 0.8]) { const [ox, oz] = off(k); B.box(M.wood, 1.0, 0.9, 1.0, bx + ox, 0.45, bz + oz); B.box(M.pink, 0.4, 0.3, 0.02, bx + ox - back.x * 0.51, 0.5, bz + oz - back.z * 0.51, rot); }
      const [ox, oz] = off(-0.8); B.box(M.wood, 0.9, 0.8, 0.9, bx + ox, 1.3, bz + oz);
      r.bench = V3(bx + off(0.8)[0], 0.92, bz + off(0.8)[1]);
    } else { // the foreman's office: a desk, the production board
      B.box(M.wood, 2.4, 0.8, 0.9, bx, 0.4, bz, rot);
      B.box(M.black, 2.2, 1.0, 0.1, bx + back.x * 0.6, 1.6, bz + back.z * 0.6, rot);
      r.desk = V3(bx, 0.82, bz);
      r.bench = r.desk;
    }
  }
}

let building = null;
/** The factory as a club-engine building (built once, then shared). */
export function buildFactory() {
  if (!building) {
    building = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const M = makeFactoryMaterials();
      const B = new Builder(M);
      const L = layout(M);
      for (const r of L.rects) {
        B.floor(r, r.floor, 2);
        for (const s of ['n', 's', 'e', 'w']) {
          const res = B.side(r, s, r.hall && r.id !== 'lobby' ? (s === 'n' || s === 'w' ? 0 : 1) : -1);
          // signs on the main hall's long walls, between the lines
          if (r.id !== 'main' || res.along) continue;
          for (const [a, b] of res.walls) {
            if (b - a < 3) continue;
            const p = V3(res.fixed, 1.55, (a + b) / 2).addScaledVector(res.n, 0.11);
            L.signs.push({ pos: p, n: res.n.clone() });
          }
        }
      }
      dress(B, L);
      for (const m of M.belts) m.map.repeat.set((BELT.to - BELT.from) / 0.5, 1);
      const scene = B.scene();
      const collider = buildCollider(scene);
      collider.material.side = THREE.DoubleSide;
      const { floor, mainY } = scanFloor(scene, collider);
      return {
        scene, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene), M,
        rooms: L.rooms, levers: L.levers, signs: L.signs, wings: LINES, main: L.main, lobby: L.lobby, office: L.office,
        entrance: { pos: V3(0, 0, 4.0), heading: Math.PI },
        halls: L.rects.filter((r) => r.hall),
      };
    });
  }
  return building;
}

export { quad, WHW, MAIN_N };
