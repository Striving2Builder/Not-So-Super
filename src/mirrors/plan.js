// The hotel's new floor, generated (docs/design/act2.md "The hotel's new floor and the boss"): the hall
// of mirrors, built with the hotel's Builder (src/hotel/plan.js) like the factory. The elevator lobby at
// the south end, one long tiled gallery north to the antechamber and the sealed door of the boss room
// (H2 builds the room behind it). Down both sides of the gallery, slots four metres wide alternate:
// a room behind a mirrored door, then a tall mirror. Each mirror is glass in a gap in the wall with a
// mirrored copy of the gallery built behind it (the "room in the glass": the old game trick, no render
// target), where glass.js stands her reflected twin. Metres: x east, z south; the lobby is at the south.
import * as THREE from 'three';
import { buildCollider, scanFloor } from '../clubgeo.js';
import { Rect, Builder, quad, DOOR_W, DOOR_H } from '../hotel/plan.js';
import { makeMirrorMaterials } from './art.js';
import { bossLayout, bossDress } from './bossroom.js';

export const GHW = 2;           // the gallery's half-width (a mirror box is the gallery's width deep)
const SLOT = 4, SLOTS = 9, RD = 4.2;
export const GN = -1 - SLOT * SLOTS; // the gallery's north end (-37), the antechamber beyond
export const ANTE = { x0: -5, x1: 5, z0: GN - 8, z1: GN };
export const MIRROR_W = 2.6;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** What each room is (by its order down the hall); the zone gives the parlours their jobs per visit. */
const WINGS = ['parlour', 'dressing', 'parlour', 'shrine', 'parlour', 'parlour', 'dressing', 'parlour', 'parlour'];

function layout(M) {
  const rects = [], rooms = [], mirrors = [], posters = [];
  const R = (...a) => { const r = new Rect(...a); rects.push(r); return r; };
  const lobby = R('lobby', -4, 0, 4, 6, M.lobbyFloor, M.ballWall, { hall: true });
  const gallery = R('gallery', -GHW, GN, GHW, 0, M.hallFloor, M.hallWall, { hall: true });
  const ante = R('ante', ANTE.x0, ANTE.z0, ANTE.x1, ANTE.z1, M.lobbyFloor, M.ballWall, { hall: true });
  lobby.gap('n', 0, GHW * 2, false); gallery.gap('s', 0, GHW * 2, false);
  gallery.gap('n', 0, GHW * 2, false); ante.gap('s', 0, GHW * 2, false);
  const boss = bossLayout(R, M, ante); // (job H2: Supergurl's room behind the sealed door)
  let ri = 0;
  for (let k = 0; k < SLOTS; k++) {
    const z1 = -1 - SLOT * k, z0 = z1 - SLOT, zc = (z0 + z1) / 2;
    for (const side of [-1, 1]) {
      const wall = side * GHW, gs = side < 0 ? 'w' : 'e', back = { w: 'e', e: 'w' }[gs];
      const isRoom = (k + (side < 0 ? 1 : 0)) % 2 === 0;
      if (isRoom) {
        const x0 = side < 0 ? wall - RD : wall, x1 = side < 0 ? wall : wall + RD;
        const wing = WINGS[ri % WINGS.length];
        const r = R(`room${ri + 1}`, x0, z0, x1, z1, M.roomFloor, M.rooms[wing], { wing, num: `M${ri + 1}` });
        r.gap(back, zc, DOOR_W); gallery.gap(gs, zc, DOOR_W);
        r.door = V3(wall, 0, zc); r.alongX = false; r.inward = V3(side, 0, 0);
        rooms.push(r);
        ri++;
      } else {
        // the room in the glass: as deep as the gallery is wide (it's the gallery, reflected)
        const x0 = side < 0 ? wall - GHW * 2 : wall, x1 = side < 0 ? wall : wall + GHW * 2;
        const box = R(`glass${mirrors.length}`, x0, z0, x1, z1, M.hallFloor, M.hallWall, { glass: true });
        box.gap(back, zc, MIRROR_W); gallery.gap(gs, zc, MIRROR_W);
        mirrors.push({ i: mirrors.length, x: wall, side, zc, z0, z1, n: V3(-side, 0, 0), box });
      }
    }
  }
  return { rects, rooms, mirrors, posters, lobby, gallery, ante, boss };
}

/** The static dressing: the frames, glass and tubes of the mirrors, the room in each glass, the rooms. */
function dress(B, L) {
  const M = B.M;
  for (const m of L.mirrors) {
    const x = m.x, s = m.side, n = m.n, h = MIRROR_W / 2;
    // the glass (it collides: she can't walk into her reflection) and a black frame round it
    B.add(M.glass, quad([V3(x, 0, m.zc - h), V3(x, 0, m.zc + h), V3(x, DOOR_H, m.zc + h), V3(x, DOOR_H, m.zc - h)], n, MIRROR_W, DOOR_H, 4));
    for (const dz of [-h, h]) B.box(M.frame, 0.16, DOOR_H + 0.1, 0.12, x + n.x * 0.04, DOOR_H / 2, m.zc + dz);
    B.box(M.frame, 0.16, 0.12, MIRROR_W + 0.2, x + n.x * 0.04, DOOR_H + 0.02, m.zc);
    B.box(M.frame, 0.2, 0.06, MIRROR_W, x + n.x * 0.06, 0.03, m.zc);
    // the purple tubes either side, and their light smeared down the wet tiles
    for (const dz of [-h - 0.3, h + 0.3]) {
      B.box(M.neon[(m.i + (dz > 0 ? 1 : 0)) % 3], 0.05, 2.1, 0.05, x + n.x * 0.07, 1.25, m.zc + dz);
      B.add(M.smear, quad([V3(x, 0.015, m.zc + dz - 0.22), V3(x, 0.015, m.zc + dz + 0.22), V3(x + n.x * 2.6, 0.015, m.zc + dz + 0.22), V3(x + n.x * 2.6, 0.015, m.zc + dz - 0.22)], V3(0, 1, 0), 0.44, 2.6, 1));
    }
    // the room in the glass: the far wall is the gallery's other side, reflected: a mirrored door in it
    const far = x - n.x * GHW * 2;
    B.box(M.door, 0.06, DOOR_H, DOOR_W, far + n.x * 0.1, DOOR_H / 2, m.zc);
    B.add(M.smear, quad([V3(far, 0.015, m.zc - 0.3), V3(far, 0.015, m.zc + 0.3), V3(x, 0.015, m.zc + 0.3), V3(x, 0.015, m.zc - 0.3)], V3(0, 1, 0), 0.6, 4, 1));
  }
  // the rooms: what's in them goes against the back wall
  for (const r of L.rooms) {
    const back = r.inward.clone(), bx = r.cx + back.x * (RD / 2 - 0.7), bz = r.cz;
    r.back = V3(bx, 0, bz);
    if (r.wing === 'dressing') { // a rail (the copies hang on it), a vanity with a mirror
      B.box(M.steel, 0.06, 1.7, 0.06, bx, 0.85, bz - 1.4); B.box(M.steel, 0.06, 1.7, 0.06, bx, 0.85, bz + 1.4);
      B.box(M.steel, 0.05, 0.05, 2.9, bx, 1.7, bz);
      r.rail = V3(bx - back.x * 0.05, 0, bz);
      B.box(M.wood, 1.2, 0.8, 0.6, r.cx, 0.4, r.z0 + 0.4);
      B.add(M.glass, quad([V3(r.cx - 0.5, 0.9, r.z0 + 0.12), V3(r.cx + 0.5, 0.9, r.z0 + 0.12), V3(r.cx + 0.5, 1.9, r.z0 + 0.12), V3(r.cx - 0.5, 1.9, r.z0 + 0.12)], V3(0, 0, 1), 1, 1, 1));
      for (const dx of [-0.55, 0.55]) B.box(M.neon[1], 0.04, 1.0, 0.04, r.cx + dx, 1.4, r.z0 + 0.14);
      r.bench = V3(r.cx, 0.82, r.z0 + 0.4);
    } else if (r.wing === 'shrine') { // the cult's altar: a red cloth, candles, a gold S
      B.box(M.black, 0.9, 0.9, 2.2, bx, 0.45, bz);
      B.box(M.red, 0.94, 0.06, 2.3, bx, 0.92, bz);
      for (const dz of [-0.8, -0.4, 0.4, 0.8]) B.box(M.linen, 0.06, 0.22, 0.06, bx, 1.06, bz + dz);
      B.box(M.brass, 0.06, 0.8, 0.8, bx + back.x * 0.4, 1.6, bz, Math.PI / 4);
      r.bench = V3(bx, 0.96, bz);
    } else { // a parlour: a chaise, a low table
      B.box(M.red, 0.8, 0.45, 1.8, bx, 0.22, bz);
      B.box(M.red, 0.2, 0.5, 1.8, bx + back.x * 0.35, 0.6, bz);
      B.box(M.black, 0.6, 0.4, 0.6, r.cx - back.x * 0.2, 0.2, bz + 1.2);
      r.bench = V3(r.cx - back.x * 0.2, 0.42, bz + 1.2);
    }
  }
  // the lobby: the elevator (shut behind her), the antechamber: braziers either side of the sealed door
  B.box(M.steel, 2.4, 2.4, 0.08, 0, 1.2, 5.9);
  B.box(M.black, 0.04, 2.4, 0.1, 0, 1.2, 5.85);
  B.box(M.neon[0], 2.8, 0.06, 0.06, 0, 2.5, 5.84);
  for (const sx of [-3.2, 3.2]) {
    B.box(M.black, 0.5, 1.0, 0.5, sx, 0.5, ANTE.z0 + 1.2);
    B.box(M.neon[2], 0.4, 0.12, 0.4, sx, 1.06, ANTE.z0 + 1.2);
    B.box(M.neon[0], 0.05, 2.4, 0.05, sx * 0.62, 1.3, ANTE.z0 + 0.1);
  }
  bossDress(B, L); // (the sealed door's frame, Supergurl's room)
}

/** Posters ("mirror portraits") on the gallery's walls, between the doors and the mirrors. */
function wallSpots(res, L) {
  for (const [a, b] of res.walls) {
    if (b - a < 1.2) continue;
    const p = V3(res.fixed, 1.45, (a + b) / 2).addScaledVector(res.n, 0.11);
    L.posters.push({ pos: p, n: res.n.clone() });
  }
}

let building = null;
/** The hall of mirrors as a club-engine building (built once, then shared). */
export function buildMirrors() {
  if (!building) {
    building = new Promise((resolve) => setTimeout(resolve, 0)).then(() => {
      const M = makeMirrorMaterials();
      const B = new Builder(M);
      const L = layout(M);
      for (const r of L.rects) {
        B.floor(r, r.floor, 2);
        for (const s of ['n', 's', 'e', 'w']) {
          const neonK = r.id === 'gallery' ? (s === 'w' ? 0 : 1) : r.glass ? 2 : -1;
          const res = B.side(r, s, neonK);
          if (r.id === 'gallery' && !res.along) wallSpots(res, L);
        }
      }
      dress(B, L);
      const scene = B.scene();
      for (const o of scene.children) if (o.material === M.smear) o.userData.noCollide = true;
      const collider = buildCollider(scene);
      collider.material.side = THREE.DoubleSide;
      const { floor, mainY } = scanFloor(scene, collider);
      return {
        scene, collider, floor, mainY, box: new THREE.Box3().setFromObject(scene), M,
        rooms: L.rooms, mirrors: L.mirrors, posters: L.posters, gallery: L.gallery, lobby: L.lobby, ante: L.ante, boss: L.boss,
        wings: [], sealDoor: V3(0, 0, ANTE.z0 + 1.0),
        entrance: { pos: V3(0, 0, 4.0), heading: Math.PI },
        halls: L.rects.filter((r) => r.hall),
      };
    });
  }
  return building;
}
