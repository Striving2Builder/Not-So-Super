// Supergurl's room behind the sealed door (job H2): north of the antechamber, mirrors down both long walls
// with the room built again behind each glass (the gallery's trick, plan.js), her dais and throne on the
// north wall. Called from plan.js layout()/dress(); the fight lives in boss.js.
import * as THREE from 'three';
import { quad, DOOR_W, DOOR_H } from '../hotel/plan.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const BOSS_W = 6;          // half-width
export const DOORGAP = 2.6;       // the sealed door's gap in the antechamber's north wall
const MIR_L = 12;                 // each wall's glass, along z

/** The room's rects (into plan.js's list via R), the gap in the antechamber, the mirrors. */
export function bossLayout(R, M, ante) {
  const z1 = ante.z0, z0 = z1 - 16, zc = (z0 + z1) / 2;
  const room = R('boss', -BOSS_W, z0, BOSS_W, z1, M.lobbyFloor, M.ballWall, { hall: true, boss: true });
  ante.gap('n', 0, DOORGAP); room.gap('s', 0, DOORGAP);
  const mirrors = [];
  for (const side of [-1, 1]) {
    const x = side * BOSS_W, gs = side < 0 ? 'w' : 'e', back = side < 0 ? 'e' : 'w';
    const x0 = side < 0 ? x - BOSS_W * 2 : x, x1 = side < 0 ? x : x + BOSS_W * 2;
    const box = R(`bglass${side}`, x0, z0, x1, z1, M.hallFloor, M.hallWall, { glass: true });
    room.gap(gs, zc, MIR_L); box.gap(back, zc, MIR_L);
    mirrors.push({ x, side, zc, n: V3(-side, 0, 0), box });
  }
  return { room, mirrors, c: V3(0, 0, zc), z0, z1, door: V3(0, 0, z1) };
}

/** The glass, the frames, the dais and throne (and their copies in the glass), tubes and smears. */
export function bossDress(B, L) {
  const M = B.M, b = L.boss, h = MIR_L / 2;
  for (const m of b.mirrors) {
    const x = m.x, n = m.n;
    B.add(M.glass, quad([V3(x, 0, m.zc - h), V3(x, 0, m.zc + h), V3(x, DOOR_H, m.zc + h), V3(x, DOOR_H, m.zc - h)], n, MIR_L, DOOR_H, 4));
    for (let dz = -h; dz <= h + 0.01; dz += MIR_L / 4) B.box(M.frame, 0.16, DOOR_H + 0.1, 0.12, x + n.x * 0.04, DOOR_H / 2, m.zc + dz);
    B.box(M.frame, 0.16, 0.12, MIR_L + 0.2, x + n.x * 0.04, DOOR_H + 0.02, m.zc);
    B.box(M.neon[m.side < 0 ? 0 : 1], 0.05, 0.05, MIR_L, x + n.x * 0.07, 0.1, m.zc);
    for (let dz = -h + 1.5; dz < h; dz += 3) {
      B.add(M.smear, quad([V3(x, 0.015, m.zc + dz - 0.25), V3(x, 0.015, m.zc + dz + 0.25), V3(x + n.x * 3.2, 0.015, m.zc + dz + 0.25), V3(x + n.x * 3.2, 0.015, m.zc + dz - 0.25)], V3(0, 1, 0), 0.5, 3.2, 1));
    }
  }
  // the dais and throne at the north end; the same again in each glass (reflected across x = ±BOSS_W)
  for (const ox of [0, -BOSS_W * 2, BOSS_W * 2]) {
    B.box(M.black, 5, 0.3, 1.6, ox, 0.15, b.z0 + 0.9);
    B.box(M.red, 4.6, 0.04, 1.3, ox, 0.31, b.z0 + 0.9);
    B.box(M.black, 1.3, 2.6, 0.3, ox, 1.3, b.z0 + 0.3);
    B.box(M.red, 1.0, 1.9, 0.06, ox, 1.5, b.z0 + 0.47);
    B.box(M.brass, 0.7, 0.7, 0.06, ox, 2.25, b.z0 + 0.5, Math.PI / 4);
    for (const sx of [-2.2, 2.2]) {
      B.box(M.black, 0.45, 1.0, 0.45, ox + sx, 0.5, b.z0 + 1.3);
      B.box(M.neon[2], 0.36, 0.12, 0.36, ox + sx, 1.06, b.z0 + 1.3);
    }
    if (ox) B.box(M.door, 0.06 + DOOR_W, DOOR_H, 0.06, ox, DOOR_H / 2, b.z1 - 0.1); // (the door, in the glass)
  }
  // purple tubes up the north wall
  for (const sx of [-4.4, -3.4, 3.4, 4.4]) B.box(M.neon[Math.abs(sx) > 4 ? 0 : 2], 0.05, 2.3, 0.05, sx, 1.3, b.z0 + 0.12);
  // the sealed door's frame (posts and a lintel: the gap stays open behind the seal)
  const z = b.z1 + 0.06, w = DOORGAP / 2;
  for (const sx of [-w - 0.1, w + 0.1]) B.box(M.frame, 0.2, 2.9, 0.16, sx, 1.45, z);
  B.box(M.frame, DOORGAP + 0.4, 0.2, 0.16, 0, 2.8, z);
}
