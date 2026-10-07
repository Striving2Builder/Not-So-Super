// Club v3 floor plans (docs/design/nightclub.md "The club layout", "The main room: 5 variations").
// A plan is pure data, seeded per visit: the main hall (one of five variations), the side rooms
// (at most 3 per side, behind doors in the hall's long walls), the alley behind the storage room,
// guard routes, crowd density blobs and where the gameplay spots stand. build.js turns it into
// geometry; the mode reads it for gameplay. The camera always looks north, at the DJ wall (-z).
import { RNG } from '../rng.js';

export const SIDE_W = 12;        // side room width (x), metres
export const SIDE_D = 11.5;      // side room depth (z)
export const ROOM_H = 3.4;       // side room wall height
export const ALLEY_W = 7;        // the alley strip behind the storage room
export const DOOR_W = 2.6;       // door gaps
export const BPM = 124;          // the club's tempo (the show, the music, the VIP dance)

/**
 * The five main rooms. hw/hd: half width/depth; wallH: the hall's walls (the south wall is a low
 * comic cutaway so the camera never fights it); doors: z of the three door slots per side;
 * crowd: density blobs [x, z, rx, rz, weight]; bar: along a wall between its doors (the coat
 * check takes the other long wall, by the entrance); tvs: [z, wall]; dark: strobes rule.
 */
export const VARIANTS = {
  rave: {
    name: 'Warehouse Rave', hw: 30, hd: 20, wallH: 6, doors: [-12.5, 0, 12.5],
    booth: { x: 0, z: -16.6, w: 9, d: 2.6 }, wall: { w: 26, h: 7.2 },
    floor: { x: 0, z: -6, w: 24, d: 15 }, bar: { wall: 'W', from: 2.5, to: 10.5 },
    crowd: [[0, -7, 14, 8, 1], [0, 3, 11, 4, 0.45], [-24, 6.5, 3, 4, 0.35], [0, 12, 24, 5, 0.12]],
    routes: [[[-26, -14], [-26, 14]], [[26, 14], [26, -14]], [[-14, -12.5], [14, -12.5]], [[-12, 10], [12, 10]], [[-20, 0], [-8, 6], [-20, 8]]],
    talkers: [[-11, 9.5], [16, -4], [9, 11]], tvs: [[-6.25, 'W'], [6.25, 'E']],
    accent: [0x27e0ff, 0xff2fd0], bg: 0x140a26,
  },
  mezzanine: {
    name: 'Mezzanine', hw: 28, hd: 21, wallH: 8, doors: [-13, 0, 13], balcony: { inset: 4.2, y: 4.2 },
    booth: { x: 0, z: -17.6, w: 9, d: 2.6 }, wall: { w: 24, h: 6.8, y: 5.2 },
    floor: { x: 0, z: -4, w: 26, d: 18 }, bar: { wall: 'E', from: 2.5, to: 11 },
    crowd: [[0, -5, 15, 9, 1], [0, 8, 12, 4, 0.4], [21, 6.5, 2.5, 4, 0.3], [0, 14, 20, 4, 0.12]],
    routes: [[[-22, -15], [22, -15]], [[-23, 15], [-23, -13]], [[23, -13], [23, 15]], [[-10, 12], [10, 12]]],
    balconyRoutes: [[[-24.5, -18], [24.5, -18]], [[24.5, -16], [24.5, 16]], [[-24.5, 16], [-24.5, -16]]],
    talkers: [[-14, 11], [14, -6], [-8, -13]], tvs: [[-6.5, 'W'], [-6.5, 'E']],
    accent: [0xffd84d, 0x9d4dff], bg: 0x120a1e,
  },
  pit: {
    name: 'The Pit', hw: 30, hd: 22, wallH: 6, doors: [-13.5, 0, 13.5], pit: { x: 0, z: -3, w: 34, d: 22, depth: 1.1, ramp: 2.2 },
    booth: { x: 0, z: -18.6, w: 9, d: 2.6 }, wall: { w: 26, h: 7.2 },
    floor: { x: 0, z: -3, w: 26, d: 15 }, bar: { wall: 'W', from: 2.5, to: 11.5 },
    crowd: [[0, -3, 15, 9.5, 1], [-24, 7, 3, 4, 0.3], [0, 14, 24, 5, 0.12]],
    routes: [[[-26, -17], [26, -17]], [[-26, 16], [-26, -15]], [[26, -15], [26, 16]], [[-14, 14], [14, 14]]],
    talkers: [[-21, 4], [21, -9], [12, 15]], tvs: [[-6.75, 'W'], [6.75, 'E']],
    accent: [0xff6a3d, 0x27e0ff], bg: 0x1a0a14,
  },
  centre: {
    name: 'Centre Stage', hw: 30, hd: 22, wallH: 6, doors: [-13.5, 0, 13.5], island: { x: 0, z: -2, r: 4.6 },
    booth: { x: 0, z: -2, w: 5.6, d: 5.6, round: true }, wall: { w: 26, h: 6.4, y: 3.2 },
    floor: { x: 0, z: -2, w: 28, d: 22 }, bar: { wall: 'N', from: -9, to: 9 },
    crowd: [[0, -2, 15, 11, 1], [0, 15, 24, 4, 0.12]],
    routes: [[[-26, -17], [26, -17]], [[-26, 16], [-26, -15]], [[26, -15], [26, 16]], [[-14, 15], [14, 15]], [[-9, -9], [9, -9], [9, 6], [-9, 6]]],
    talkers: [[-20, 10], [20, -10], [-10, -15]], tvs: [[-6.75, 'W'], [6.75, 'E']],
    accent: [0x3dff9a, 0xff2fd0], bg: 0x0a1418,
  },
  tunnel: {
    name: 'The Tunnel', hw: 13, hd: 34, wallH: 6, doors: [-21, 0, 21], arches: true, dark: true,
    booth: { x: 0, z: -30.6, w: 8, d: 2.4 }, wall: { w: 20, h: 6.4 },
    floor: { x: 0, z: -12, w: 20, d: 30 }, bar: { wall: 'W', from: 4, to: 16 },
    crowd: [[0, -14, 9, 14, 1], [0, 8, 8, 8, 0.6], [0, 24, 9, 6, 0.15]],
    routes: [[[-10, -26], [-10, 26]], [[10, 26], [10, -26]], [[-8, -6], [8, -6]], [[8, 14], [-8, 14]]],
    talkers: [[-6, 22], [8, -18], [-7, -4]], tvs: [[-10.5, 'W'], [10.5, 'E']],
    accent: [0xb04dff, 0xff2244], bg: 0x0a0610,
  },
};
export const VARIANT_IDS = Object.keys(VARIANTS);

// Side rooms. lock: how the door opens (keycode = a 4-digit code, rope = the VIP rope, null = open);
// brawl: getting caught in here starts a fight instead of a sedation.
export const SIDE_ROOMS = {
  vip:      { name: 'VIP', sign: 'VIP', lock: 'rope', accent: 0xffd84d, plate: 'vip.jpg' },
  office:   { name: 'Back Office', sign: 'STAFF', lock: 'keycode', accent: 0xfff2a0, plate: 'office.jpg' },
  restroom: { name: 'Restrooms', sign: 'WC', lock: null, accent: 0x7fffd4, plate: 'restroom.jpg', brawl: true },
  dark:     { name: 'Dark Room', sign: 'DARK', lock: null, accent: 0xb04dff, plate: 'dark.jpg', brawl: true },
  storage:  { name: 'Storage', sign: 'STOCK', lock: 'uvcode', accent: 0xa0ff9f, plate: 'storage.jpg' },
  lounge:   { name: 'Lounge', sign: 'LOUNGE', lock: null, accent: 0xff5fd0, plate: 'lounge.jpg' },
};
export const ALLEY = { name: 'Alley', sign: 'EXIT', accent: 0xff6b5a, brawl: true };

/** The plan for one visit. `variant` forces a main room (else the seed picks one). */
export function makePlan(seed, variant) {
  const r = new RNG(seed * 7919 + 17);
  const id = VARIANTS[variant] ? variant : VARIANT_IDS[r.int(0, VARIANT_IDS.length - 1)];
  const V = VARIANTS[id];
  // the six side slots, shuffled per visit (any order works: every room opens off the hall)
  const kinds = Object.keys(SIDE_ROOMS);
  for (let i = kinds.length - 1; i > 0; i--) { const j = r.int(0, i); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const rooms = [];
  ['W', 'E'].forEach((side, si) => V.doors.forEach((zc, i) => {
    const kind = kinds[si * 3 + i], s = side === 'W' ? -1 : 1;
    const xi = s * V.hw, xo = s * (V.hw + SIDE_W);
    rooms.push({
      id: kind, kind, side, slot: i, ...SIDE_ROOMS[kind],
      x0: Math.min(xi, xo), x1: Math.max(xi, xo), z0: zc - SIDE_D / 2, z1: zc + SIDE_D / 2,
      cx: (xi + xo) / 2, cz: zc,
      door: { x: xi, z: zc, side },     // the gap in the hall's wall
    });
  }));
  // the alley runs along the storage room's outer wall
  const st = rooms.find((q) => q.kind === 'storage'), s = st.side === 'W' ? -1 : 1;
  const ax = s * (V.hw + SIDE_W), axo = s * (V.hw + SIDE_W + ALLEY_W);
  const alley = {
    id: 'alley', kind: 'alley', ...ALLEY, side: st.side,
    x0: Math.min(ax, axo), x1: Math.max(ax, axo), z0: st.cz - 9, z1: st.cz + 9, cx: (ax + axo) / 2, cz: st.cz,
    door: { x: ax, z: st.cz, side: st.side },
  };
  const all = [...rooms, alley];
  return {
    seed, id, V, name: V.name, rooms, alley, all,
    byKind: Object.fromEntries(all.map((q) => [q.kind, q])),
    entrance: { x: 0, z: V.hd, w: 6 },
    spawn: { x: 0, z: V.hd - 3.2 },
  };
}

/** Which room a point is in ('hall' if none of the side rooms). */
export function roomAt(plan, x, z) {
  for (const q of plan.all) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return q;
  return null;
}

/** Floor height at a point: 0 everywhere but the Pit's sunken dance floor (with ramps round it). */
export function floorY(plan, x, z) {
  const P = plan.V.pit;
  if (!P) return 0;
  const dx = Math.abs(x - P.x) - P.w / 2, dz = Math.abs(z - P.z) - P.d / 2;
  const out = Math.max(dx, dz); // ≤ 0 inside the pit's rim, negative = deeper in
  if (out >= 0) return 0;
  return -P.depth * Math.min(1, -out / P.ramp);
}
