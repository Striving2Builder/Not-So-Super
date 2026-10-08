// The club's set, built in code from a plan (plan.js): the main hall (walls with the side-room
// doors, the low comic cutaway on the camera side, the LED dance floor, the DJ booth under the
// video wall, bar, coat check, TVs), the light show (moving heads, lasers, mirror ball, haze) and
// the shared nightlife kit's batches for neon signs, glow and props. The side rooms and the alley
// are dressed in rooms.js. Static boxes go through the zone's merge (bakeStatic), so the whole
// building is a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../look3d.js';
import { Batch, Atlas, uvRect, floorQ, wallQ, coneMat, coneGeo, DOWN, pointsMat, makePoints, glowCanvas, beamCanvas, neonText, neonPath, boltPath, cnv, tex, C, rnd, pickR, TAU, speckle, buildKit } from '../nlkit.js';
import { quality } from '../settings.js';
import { DOOR_W, floorY } from './plan.js';
import { screenMat } from './video.js';

const CAP = 0x17121c;     // ink-black wall caps
export const CUT_H = 1.05; // the camera-side cutaway walls (the camera always looks north: these are the south walls)

const worldTile = (m, metres) => { m.userData.worldUV = metres; return m; };
const hex = (c) => '#' + C(c).getHexString();

// ------------------------------------------------------------------ materials
function hallWallMat(accent) {
  const A = hex(accent[0]), B = hex(accent[1]);
  const S = 512, H = 6; // one tile = 6 m square
  const Y = (m) => S - (m / H) * S;
  const alb = cnv(S, S, (c) => {
    c.fillStyle = '#07060c'; c.fillRect(0, 0, S, S);
    // tall acoustic panels, quilted, ink seams
    for (let x = 0; x < S; x += 128) {
      const g = c.createLinearGradient(x, 0, x + 128, 0);
      g.addColorStop(0, '#1a1530'); g.addColorStop(0.5, '#120f22'); g.addColorStop(1, '#0c0a18');
      c.fillStyle = g; c.fillRect(x + 4, Y(5.4), 120, Y(0.35) - Y(5.4));
      c.strokeStyle = '#04030a'; c.lineWidth = 4; c.strokeRect(x + 4, Y(5.4), 120, Y(0.35) - Y(5.4));
      c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 2;
      for (let y = Y(5.2); y < Y(0.5); y += 32) { c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + 118, y + 14); c.stroke(); }
    }
    speckle(c, S, S, 1400, 0.05);
  });
  const em = cnv(S, S, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
    // LED bars between every other panel, a neon line at the skirting and under the top
    for (const [x, col] of [[0, A], [256, B]]) {
      c.save(); c.shadowColor = col; c.shadowBlur = 16; c.fillStyle = col; c.fillRect(x - 3, Y(5.3), 6, Y(0.5) - Y(5.3)); c.restore();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x - 1, Y(5.3), 2, Y(0.5) - Y(5.3));
    }
    for (const [y, col] of [[0.2, A], [5.55, B]]) {
      c.save(); c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.fillRect(0, Y(y) - 3, S, 6); c.restore();
      c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(0, Y(y) - 1, S, 2);
    }
    const g = c.createLinearGradient(0, Y(5.5), 0, Y(3.6)); g.addColorStop(0, A + '55'); g.addColorStop(1, A + '00');
    c.fillStyle = g; c.fillRect(0, Y(5.5), S, Y(3.6) - Y(5.5));
  });
  return worldTile(toon(0xffffff, { map: tex(alb, { repeat: true }), emissive: 0xffffff, emissiveMap: tex(em, { repeat: true }) }, { halftone: 0.5 }), H);
}

function brickMat(base = '#3a1c18', mortar = '#140a0a', tile = 3.4) {
  return worldTile(toon(0xffffff, { map: tex(cnv(256, 256, (c) => {
    c.fillStyle = mortar; c.fillRect(0, 0, 256, 256);
    for (let r = 0, y = 0; y < 256; r++, y += 16) for (let x = -32 + (r % 2) * 16; x < 256; x += 32) {
      c.fillStyle = base; c.globalAlpha = 0.75 + Math.random() * 0.25; c.fillRect(x + 1, y + 1, 30, 14); c.globalAlpha = 1;
    }
    speckle(c, 256, 256, 600, 0.08);
  }), { repeat: true }) }, { halftone: 0.6 }), tile);
}

function hallFloorMat() {
  return worldTile(toon(0xffffff, { map: tex(cnv(512, 512, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 128, y = j * 128, g = c.createLinearGradient(x, y, x + 128, y + 128);
      g.addColorStop(0, '#1c1830'); g.addColorStop(0.5, '#0e0c1c'); g.addColorStop(1, '#151226');
      c.fillStyle = g; c.fillRect(x + 2, y + 2, 124, 124);
    }
    speckle(c, 512, 512, 1600, 0.05);
  }), { repeat: true }) }, { halftone: 0.4 }), 3);
}

/** All the materials a hall needs (side rooms make their own in rooms.js). */
export function hallMats(plan) {
  const V = plan.V;
  return {
    wall: hallWallMat(V.accent),
    cut: brickMat('#2a1a28', '#0c070c', 2),
    floor: hallFloorMat(),
    cap: toon(CAP, {}, { halftone: 0 }),
    black: toon(0x0c0b12, {}, { halftone: 0 }),
    steel: toon(0x2a2a33, {}, { halftone: 0.4 }),
    wood: toon(0x3a1a0a, {}, { halftone: 0.4 }),
    top: toon(0x8a5a2a, {}, { halftone: 0 }),
    chrome: toon(0x9aa0b0, {}, { halftone: 0 }),
  };
}

// ------------------------------------------------------------------ walls
/** A wall from (x1, z1) to (x2, z2), h tall, with an ink cap; registered as a sight/camera blocker. */
export function wallSeg(zn, x1, z1, x2, z2, h, mat, M, { collide = true } = {}) {
  const t = 0.4;
  const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t, x = (x1 + x2) / 2, z = (z1 + z2) / 2;
  if (w < 0.05 || d < 0.05) return;
  zn.box(w, h, d, x, h / 2, z, mat, { wall: true, collide });
  if (collide) zn.colliders[zn.colliders.length - 1].top = h;
  zn.box(w + 0.06, 0.1, d + 0.06, x, h + 0.05, z, M.cap, { collide: false });
}

/** A straight wall along x (const z) or z (const x) with door gaps [centre, width]. */
export function wallWithGaps(zn, axis, fixed, from, to, gaps, h, mat, M, opts) {
  const cuts = gaps.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  let a = from;
  for (const [g0, g1] of [...cuts, [to, to]]) {
    if (g0 > a + 0.05) axis === 'x' ? wallSeg(zn, a, fixed, g0, fixed, h, mat, M, opts) : wallSeg(zn, fixed, a, fixed, g0, h, mat, M, opts);
    a = Math.max(a, g1);
  }
}

/** A frame along one of the hall's walls: at(a, d) = the point `a` metres along it, `d` in from it. */
export function wallFrame(side, hw, hd) {
  if (side === 'W') return { x: false, yaw: Math.PI / 2, at: (a, d) => [-hw + d, a] };
  if (side === 'E') return { x: false, yaw: -Math.PI / 2, at: (a, d) => [hw - d, a] };
  return { x: true, yaw: 0, at: (a, d) => [a, -hd + d] };
}

// ------------------------------------------------------------------ the kit (signs, glow, props)
export function makeClubKit(zn) {
  const glowT = tex(glowCanvas());
  const X = {
    zn, glowT, lite: quality().nightlife === 'min', rich: quality().nightlife === 'full',
    glow: new Batch(['position', 'uv']), cones: new Batch(['position', 'normal', 'uv']), signs: new Batch(['position', 'uv']),
    atlas: new Atlas(1024, 1024), props: new Batch(['position', 'normal']), bulbs: [], fx: [], people: [],
    prop(geo, color) { return this.props.push(geo, color); },
    bulb(x, y, z, s, color) { const b = { p: [x, y, z], s, c: C(color) }; b.base = b.c.clone(); this.bulbs.push(b); return b; },
    pool(x, z, r, color, k = 0.4, y = 0.035) { return this.glow.push(floorQ(x, z, r * 2, r * 2, y), color, k); },
    /** A neon sign (atlas rect) on a plane facing `yaw` at (x, y, z), h metres tall, with a halo. */
    sign(x, y, z, yaw, h, rect, color, halo = 0.45) {
      const w = (h * rect.w) / rect.h;
      const e = { s: this.signs.push(uvRect(wallQ(x, y, z, w, h, yaw), rect.uv), 0xffffff) };
      if (halo) e.h = this.glow.push(wallQ(x - Math.sin(yaw) * 0.01, y, z - Math.cos(yaw) * 0.01, w * 1.3, h * 2.4, yaw), color, halo);
      return e;
    },
  };
  return X;
}

/** Glyphs for the signs, painted once into the kit's atlas. */
function signRect(X, text, color, { w = 512, h = 128, size = 90, font } = {}) {
  return X.atlas.add(w, h, (c) => neonText(c, text, w / 2, h / 2 + 4, size, color, { maxW: w - 30, ...(font ? { font } : {}) }));
}

// ------------------------------------------------------------------ the hall
/**
 * Build the main hall. Returns its anchors for gameplay: the bar and coat check spots, the DJ
 * booth front, the TVs (screens), the video wall and the dance floor tiles (animated by the show).
 */
export function buildHall(zn, plan, M, X, video) {
  const V = plan.V, S = zn.scene, hw = V.hw, hd = V.hd, H = V.wallH;
  const A = { screens: [], spots: {} };
  // floors: the hall (the Pit gets its sunken bowl), then the entrance mat outside the door
  if (V.pit) {
    const P = V.pit;
    const g = new THREE.PlaneGeometry(hw * 2, hd * 2, Math.round(hw * 1.6), Math.round(hd * 1.6)).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, floorY(plan, p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.floor); m.userData.noInk = true;
    S.add(m); zn._static.push(m);
    // the pit's rim: a glowing edge where the ramps begin
    X.glow.push(new THREE.RingGeometry(0, 1, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2).scale(P.w / Math.SQRT2, 1, P.d / Math.SQRT2).translate(P.x, 0.03, P.z), V.accent[0], 0.12);
    for (const [x0, z0, x1, z1] of [[-P.w / 2, -P.d / 2, P.w / 2, -P.d / 2], [-P.w / 2, P.d / 2, P.w / 2, P.d / 2], [-P.w / 2, -P.d / 2, -P.w / 2, P.d / 2], [P.w / 2, -P.d / 2, P.w / 2, P.d / 2]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), horiz = z0 === z1;
      X.glow.push(floorQ(P.x + (x0 + x1) / 2, P.z + (z0 + z1) / 2, horiz ? len : 0.12, horiz ? 0.12 : len, 0.02), V.accent[0], 0.9);
    }
  } else {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, hd * 2).rotateX(-Math.PI / 2), M.floor);
    S.add(m); zn._static.push(m);
  }
  // a carpet runner in from the door, edged in light: the eye walks in with her
  const run = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9).rotateX(-Math.PI / 2), toon(0x5a0c1e, {}, { halftone: 0.3 }));
  run.position.set(0, 0.012, hd - 4.5); S.add(run); zn._static.push(run);
  for (const sx of [-1.7, 1.7]) X.glow.push(floorQ(sx, hd - 4.5, 0.08, 9, 0.02), V.accent[1], 0.9);
  X.pool(0, hd - 2.5, 3.5, 0xffd8a0, 0.22);
  // walls: the DJ wall, the long walls with three doors each, the low cutaway on the camera side
  wallSeg(zn, -hw - 0.2, -hd, hw + 0.2, -hd, H, M.wall, M);
  for (const s of [-1, 1]) wallWithGaps(zn, 'z', s * hw, -hd, hd, V.doors.map((z) => [z, DOOR_W]), H, M.wall, M);
  wallWithGaps(zn, 'x', hd, -hw - 0.2, hw + 0.2, [[0, plan.entrance.w]], CUT_H, M.cut, M);
  // you leave by the exit ring, not by walking out (an invisible bar across the door)
  zn.colliders.push({ minX: -plan.entrance.w / 2, maxX: plan.entrance.w / 2, minZ: hd + 0.6, maxZ: hd + 1.1 });
  // door frames + neon signs over each side door, facing into the hall
  for (const q of plan.rooms) {
    const s = q.side === 'W' ? 1 : -1, x = q.door.x + s * 0.24, yaw = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    zn.box(0.36, 3.1, 0.3, x, 1.55, q.door.z - DOOR_W / 2 - 0.1, M.steel, { collide: false });
    zn.box(0.36, 3.1, 0.3, x, 1.55, q.door.z + DOOR_W / 2 + 0.1, M.steel, { collide: false });
    zn.box(0.36, 0.3, DOOR_W + 0.5, x, 3.2, q.door.z, M.steel, { collide: false });
    X.sign(x + s * 0.2, 3.85, q.door.z, yaw, 0.85, signRect(X, q.sign, hex(q.accent), { w: 384, h: 110, size: 80 }), q.accent);
    X.pool(q.door.x + s * 1.4, q.door.z, 1.6, q.accent, 0.22);
  }
  // the video wall: two mirrored copies of the DJ loop across an LED panel, in a black frame
  const W = V.wall, wy = (W.y ?? 0.9) + W.h / 2;
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(W.w, W.h), screenMat(video, { led: true, mirror: true, bright: 0.85 }));
  wallMesh.position.set(0, wy, -hd + 0.25); S.add(wallMesh);
  A.screens.push(wallMesh.material); A.videoWall = wallMesh;
  zn.box(W.w + 0.6, W.h + 0.6, 0.2, 0, wy, -hd + 0.12, M.black, { collide: false });
  X.glow.push(wallQ(0, wy, -hd + 0.3, W.w * 1.35, W.h * 1.6, 0), 0xffffff, 0.12);
  // the DJ booth: a riser with an LED front, decks, speaker stacks; the DJs dance behind it
  const B = V.booth;
  if (B.round) {
    zn.cyl(B.w / 2, B.w / 2 + 0.2, 1.2, B.x, 0.6, B.z, M.black, true);
    zn.cyl(B.w / 2 + 0.05, B.w / 2 + 0.05, 0.08, B.x, 1.22, B.z, toon(V.accent[0], { emissive: V.accent[0], emissiveIntensity: 0.8 }));
    X.people.push({ x: B.x - 0.8, z: B.z + 0.3, rot: Math.PI, pose: 'dj', type: 'suit', fixed: true, y: 0 }, { x: B.x + 0.8, z: B.z - 0.3, rot: 0, pose: 'dj', type: 'dress', fixed: true, y: 0 });
  } else {
    zn.box(B.w, 1.2, B.d, B.x, 0.6, B.z, M.black);
    zn.box(B.w - 0.2, 0.1, B.d - 0.3, B.x, 1.25, B.z, toon(V.accent[0], { emissive: V.accent[0], emissiveIntensity: 0.7 }), { collide: false });
    const front = tex(cnv(512, 96, (c) => {
      c.fillStyle = '#05040a'; c.fillRect(0, 0, 512, 96);
      neonText(c, (zn.zone?.venue || 'CLUB').toUpperCase(), 256, 50, 56, hex(V.accent[0]), { maxW: 470 });
    }));
    const fm = new THREE.Mesh(wallQ(B.x, 0.62, B.z + B.d / 2 + 0.02, B.w - 0.1, 1.1, 0), new THREE.MeshBasicMaterial({ map: front }));
    S.add(fm);
    for (const sx of [-1, 1]) zn.box(1.2, 2.6, 1.2, B.x + sx * (B.w / 2 + 1.0), 1.3, B.z - 0.3, M.black);
    X.people.push({ x: B.x - 1.2, z: B.z - B.d / 2 - 0.5, rot: 0, pose: 'dj', type: 'suit', fixed: true, y: 0 }, { x: B.x + 1.2, z: B.z - B.d / 2 - 0.5, rot: 0, pose: 'dj', type: 'dress', fixed: true, y: 0 });
  }
  A.spots.dj = { x: B.x, z: B.round ? B.z + B.w / 2 + 0.9 : B.z + B.d / 2 + 0.9 };
  X.pool(B.x, B.z + (B.round ? 0 : 1.5), 3.4, V.accent[0], 0.3);
  // the dance floor: LED tiles (one instanced mesh) inside a neon frame
  const F = V.floor, n = Math.max(6, Math.round(F.w / 1.5)), m = Math.max(6, Math.round(F.d / 1.5)), tw = F.w / n, td = F.d / m;
  const tileT = tex(cnv(64, 64, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64);
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 40);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
    c.fillStyle = g; c.fillRect(3, 3, 58, 58);
  }));
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(tw * 0.94, td * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tileT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), n * m);
  const Mx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const x = F.x - F.w / 2 + (i + 0.5) * tw, z = F.z - F.d / 2 + (j + 0.5) * td;
    Mx.makeTranslation(x, floorY(plan, x, z) + 0.025, z); tiles.setMatrixAt(i * m + j, Mx); tiles.setColorAt(i * m + j, C(0x111111));
  }
  tiles.frustumCulled = false; tiles.renderOrder = 1; S.add(tiles);
  A.tiles = { mesh: tiles, n, m };
  // bar along a wall between its doors: counter + LED strip, the back bar of bottles on the wall,
  // stools on the customers' side; the bartender works between the counter and the wall
  const R = V.bar, Rf = wallFrame(R.wall, hw, hd), mid = (R.from + R.to) / 2, len = R.to - R.from;
  const along = (a, d, w, h, dd, y, mat, o) => { const [x, z] = Rf.at(a, d); return zn.box(Rf.x ? w : dd, h, Rf.x ? dd : w, x, y, z, mat, o); };
  along(mid, 2.3, len, 1.1, 1.0, 0.55, M.wood);
  along(mid, 2.3, len + 0.2, 0.08, 1.25, 1.12, M.top, { collide: false });
  { const [x, z] = Rf.at(mid, 2.83); X.glow.push(new THREE.BoxGeometry(Rf.x ? len : 0.04, 0.04, Rf.x ? 0.04 : len).translate(x, 0.15, z), V.accent[1], 0.9); }
  const backT = tex(cnv(512, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#1a0c04'); g.addColorStop(0.5, '#5a2a40'); g.addColorStop(1, '#1a0c04');
    c.fillStyle = g; c.fillRect(0, 0, 512, 128);
    const cols = ['#3aff8a', '#ffc040', '#ff5a5a', '#5ab0ff', '#f0f0f0', '#c080ff', '#ffe080'];
    for (const [y, hh] of [[16, 34], [66, 34]]) {
      for (let x = 6; x < 506; x += rnd(9, 15)) { const bh = rnd(hh * 0.6, hh), bw = rnd(5, 9); c.fillStyle = pickR(cols); c.globalAlpha = 0.8; c.fillRect(x, y + hh - bh, bw, bh); c.globalAlpha = 1; }
      c.fillStyle = '#2a1608'; c.fillRect(0, y + hh, 512, 5);
    }
  }));
  { const [x, z] = Rf.at(mid, 0.27); S.add(new THREE.Mesh(wallQ(x, 1.65, z, len * 0.92, 1.4, Rf.yaw), new THREE.MeshBasicMaterial({ map: backT }))); }
  { const [x, z] = Rf.at(mid, 0.3); X.glow.push(wallQ(x, 1.65, z, len, 2.4, Rf.yaw), 0xffb060, 0.2); }
  for (let a = R.from + 0.7; a < R.to - 0.4; a += 1.3) {
    const [x, z] = Rf.at(a, 3.45);
    zn.cyl(0.2, 0.2, 0.06, x, 0.75, z, M.chrome);
    zn.cyl(0.04, 0.05, 0.72, x, 0.36, z, M.steel);
  }
  { const [x, z] = Rf.at(mid, 0.3); X.sign(x, Rf.x ? 2.6 : 2.95, z, Rf.yaw, 0.6, signRect(X, 'BAR', '#ff2fd0', { w: 256, h: 110, size: 86 }), 0xff2fd0); }
  { const [x, z] = Rf.at(mid, 3.0); X.pool(x, z, Math.min(5, len / 2), 0xffb060, 0.22); }
  { const [x, z] = Rf.at(R.from + len * 0.75, 3.5); A.spots.bar = { x, z }; }
  { const [x, z] = Rf.at(R.from + len * 0.25, 3.5); A.spots.barSearch = { x, z }; }
  { const [x, z] = Rf.at(R.from + len * 0.35, 1.25); A.spots.bartender = { x, z, rot: Rf.yaw }; }
  // the coat check on the other long wall, by the entrance: a counter, a rail of coats behind it
  const Kf = wallFrame(R.wall === 'E' ? 'W' : 'E', hw, hd), k0 = hd - 6.6, k1 = hd - 3, km = (k0 + k1) / 2;
  { const [x, z] = Kf.at(km, 2.1); zn.box(Kf.x ? 3.4 : 0.8, 1.1, Kf.x ? 0.8 : 3.4, x, 0.55, z, M.wood); zn.box(Kf.x ? 3.6 : 1.0, 0.06, Kf.x ? 1.0 : 3.6, x, 1.12, z, M.top, { collide: false }); }
  for (let a = k0 + 0.2; a < k1; a += 0.36) { const [x, z] = Kf.at(a, 0.45); X.prop(new THREE.BoxGeometry(0.14, 0.9, 0.3).translate(x, 1.55, z), pickR([0x2a2a3a, 0x4a1a2a, 0x1a3a2a, 0x3a3020])); }
  { const [x, z] = Kf.at(km, 0.25); X.sign(x, 2.6, z, Kf.yaw, 0.45, signRect(X, 'COAT CHECK', '#ffe14d', { w: 512, h: 100, size: 66 }), 0xffe14d, 0.3); }
  { const [x, z] = Kf.at(km, 3.2); A.spots.coat = { x, z }; }
  { const [x, z] = Kf.at(km, 1.25); A.spots.attendant = { x, z, rot: Kf.yaw }; }
  // TVs on the long walls: the DJ cam
  for (const [z, side] of V.tvs) {
    const f = wallFrame(side, hw, hd), [x] = f.at(z, 0.08);
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), screenMat(video, { bright: 0.85 }));
    tv.position.set(x, 3.4, z); tv.rotation.y = f.yaw; S.add(tv);
    const [bx] = f.at(z, 0.02);
    zn.box(0.12, 2.0, 3.4, bx, 3.4, z, M.black, { collide: false });
    A.screens.push(tv.material);
  }
  // the venue's name, big, above the DJ wall
  const name = (zn.zone?.venue || plan.name).toUpperCase();
  X.sign(0, Math.min(H - 0.7, (W.y ?? 0.9) + W.h + 0.75), -hd + 0.3, 0, 0.95, A.nameRect = X.atlas.add(1024, 160, (c) => { neonPath(c, '#ffe14d', 5, boltPath(c, 70, 80, 56)); neonText(c, name, 560, 84, 110, hex(V.accent[0]), { maxW: 860 }); }), V.accent[0], 0.5);
  // the Mezzanine's balcony ring (guards patrol it; the floor below stays the player's)
  if (V.balcony) {
    const Bc = V.balcony, y = Bc.y, i = Bc.inset;
    const ring = [[-hw, -hd, hw, -hd + i], [-hw, -hd + i, -hw + i, hd - 6], [hw - i, -hd + i, hw, hd - 6]];
    for (const [x0, z0, x1, z1] of ring) {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), M.steel);
      deck.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); S.add(deck); zn._static.push(deck);
    }
    for (const [x0, z0, x1, z1] of [[-hw + i, -hd + i, hw - i, -hd + i], [-hw + i, -hd + i, -hw + i, hd - 6], [hw - i, -hd + i, hw - i, hd - 6]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.08, 0.08, Math.abs(z1 - z0) + 0.08), M.chrome);
      rail.position.set((x0 + x1) / 2, y + 1.05, (z0 + z1) / 2); S.add(rail); zn._static.push(rail);
      X.glow.push(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.05, 0.05, Math.abs(z1 - z0) + 0.05).translate((x0 + x1) / 2, y - 0.17, (z0 + z1) / 2), V.accent[0], 0.8);
    }
    for (let x = -hw + i; x <= hw - i + 0.1; x += 7) zn.box(0.35, y, 0.35, x, y / 2, -hd + i, M.steel, { collide: true });
    for (let z = -hd + i + 7; z < hd - 6; z += 7) for (const s of [-1, 1]) zn.box(0.35, y, 0.35, s * (hw - i), y / 2, z, M.steel, { collide: true });
  }
  // the Tunnel's brick arches: ribs over the walk every few metres
  if (V.arches) {
    const rib = brickMat('#4a2418', '#120806', 2);
    for (let z = -hd + 4; z < hd - 2; z += 6) {
      if (V.doors.some((dz) => Math.abs(dz - z) < DOOR_W)) continue; // (never a rib across a doorway)
      for (const s of [-1, 1]) zn.box(0.8, H, 0.7, s * (hw - 0.4), H / 2, z, rib, { collide: false });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(hw - 0.4, 0.35, 6, 24, Math.PI).scale(1, 0.45, 1), rib);
      arch.position.set(0, H - 0.6, z); S.add(arch); zn._static.push(arch); arch.userData.noInk = true;
    }
  }
  // the island stage (Centre Stage): a raised ring round the booth
  if (V.island) {
    const I = V.island;
    zn.cyl(I.r, I.r + 0.3, 0.35, I.x, 0.17, I.z, M.black, true);
    X.glow.push(new THREE.RingGeometry(I.r + 0.25, I.r + 0.45, 40).rotateX(-Math.PI / 2).translate(I.x, 0.37, I.z), V.accent[0], 0.9);
  }
  return A;
}

// ------------------------------------------------------------------ the light show
/** The haze puffs: the kit's point sprites, but a puff the camera is in (or nearly) fades away
 * instead of washing the whole screen (the crowd round her stays ink; the far room stays hazy). */
function hazeMat(pm) {
  const m = pm.clone();
  m.uniforms = { map: pm.uniforms.map, uScale: pm.uniforms.uScale };   // (uScale follows the canvas, set per frame)
  m.vertexShader = m.vertexShader.replace('vC = color;', 'vC = color * smoothstep(size * 0.45, size * 1.1, -(modelViewMatrix * vec4(position, 1.0)).z);');
  return m;
}

/** Moving heads over the floor, lasers from the booth, the mirror ball, haze. Returns its per-frame step. */
export function buildShow(zn, plan, X) {
  const V = plan.V, S = zn.scene, Q = quality().club3, F = V.floor, H = V.wallH;
  const heads = [], cm = coneMat();
  const hcols = [V.accent[0], V.accent[1], 0xffe14d, 0x9d4dff, 0x27e0ff, 0xff6a3d];
  for (let i = 0; i < Q.heads; i++) {
    const mat = cm.clone(); mat.uniforms.uC.value = C(hcols[i % hcols.length]); mat.uniforms.uI.value = 0.5; mat.uniforms.uNear.value = 6;
    const beam = new THREE.Mesh(coneGeo(0.03, 0.5), mat);
    beam.frustumCulled = false;
    const a = (i / Q.heads) * TAU;
    beam.position.set(F.x + Math.cos(a) * F.w * 0.42, H - 0.4, F.z + Math.sin(a) * F.d * 0.42);
    S.add(beam);
    const pool = new THREE.Mesh(floorQ(0, 0, 3.4, 3.4, 0.05 + i * 0.003), new THREE.MeshBasicMaterial({ map: X.glowT, color: hcols[i % hcols.length], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    S.add(pool);
    heads.push({ beam, pool, ph: i * 1.3, col: C(hcols[i % hcols.length]) });
  }
  // floor scanners: soft coloured spots sweeping the open floor between the doors and the crowd
  const sweeps = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(floorQ(0, 0, 6, 6, 0.045 + i * 0.002), new THREE.MeshBasicMaterial({ map: X.glowT, color: hcols[i % hcols.length], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    S.add(m);
    sweeps.push({ m, ph: i * 1.27, r: 0.5 + (i % 3) * 0.15, col: C(hcols[i % hcols.length]) });
  }
  // mirror ball under the skylight
  const facets = tex(cnv(128, 64, (c) => { for (let x = 0; x < 128; x += 4) for (let y = 0; y < 64; y += 4) { const v = Math.random(); c.fillStyle = v > 0.93 ? '#fff' : `hsl(${rnd(180, 320)},30%,${20 + v * 55}%)`; c.fillRect(x, y, 3, 3); } }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), new THREE.MeshBasicMaterial({ map: facets }));
  ball.position.set(F.x, H - 1.2, F.z); S.add(ball);
  X.bulb(F.x, H - 1.2, F.z, 3, 0xaaccff);
  const specks = [];
  for (let i = 0; i < (X.lite ? 70 : X.rich ? 220 : 140); i++) {
    const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * Math.max(F.w, F.d) * 0.6 + 1;
    specks.push({ p: [Math.cos(a) * r, 0.06, Math.sin(a) * r * (F.d / F.w)], s: rnd(0.12, 0.22), c: C(pickR([0xffffff, 0xbfe8ff, 0xffd0f0])).multiplyScalar(0.7) });
  }
  const pm = (X.pmat = X.pmat || pointsMat(X.glowT));
  const speckPts = makePoints(specks, pm);
  speckPts.position.set(F.x, 0, F.z); S.add(speckPts);
  // lasers fanning out over the crowd from above the booth
  let lasers = null;
  if (!X.lite) {
    const bt = tex(beamCanvas()), L = Math.max(V.hd * 1.4, 26), gs = [];
    for (let i = 0; i < 10; i++) {
      const yaw = (i / 9 - 0.5) * 1.0;
      const a = new THREE.PlaneGeometry(0.08, L).rotateX(-Math.PI / 2).translate(0, 0, L / 2);
      gs.push(a.clone().rotateY(yaw), a.rotateZ(Math.PI / 2).rotateY(yaw));
    }
    lasers = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ map: bt, color: 0x39ff6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    lasers.position.set(V.booth.x, Math.min(H - 1, 4.2), V.booth.z); lasers.frustumCulled = false;
    S.add(lasers);
  }
  // haze: big soft additive sprites (High only: fill-rate heavy)
  if (Q.haze) {
    const list = [];
    for (let i = 0; i < Q.haze; i++) list.push({ p: [rnd(-V.hw + 3, V.hw - 3), rnd(1.4, H - 0.8), rnd(-V.hd + 3, V.hd * 0.4)], s: rnd(6, 10), c: C(pickR(V.accent)).multiplyScalar(rnd(0.025, 0.045)) });
    const hz = makePoints(list, hazeMat(pm)); S.add(hz);
    X.fx.push((t) => { hz.rotation.y = Math.sin(t * 0.04) * 0.08; });
  }
  const tmpV = new THREE.Vector3();
  return (t, dt, B, drop) => {
    ball.rotation.y += dt * 0.7; speckPts.rotation.y -= dt * 0.3;
    const pat = B.sec % 4, e = B.pulse, sp = drop ? 2.6 : pat === 1 || pat === 3 ? 1.6 : 0.7;
    for (const hd of heads) {
      const a = t * sp + hd.ph;
      tmpV.set(F.x + Math.sin(a) * F.w * 0.38, 0, F.z + Math.sin(a * 2 + hd.ph) * F.d * 0.36);
      const from = hd.beam.position, dx = tmpV.x - from.x, dy = floorY(plan, tmpV.x, tmpV.z) - from.y, dz = tmpV.z - from.z, L = Math.hypot(dx, dy, dz);
      hd.beam.quaternion.setFromUnitVectors(DOWN, tmpV.set(dx / L, dy / L, dz / L));
      hd.beam.scale.setScalar(L);
      hd.beam.material.uniforms.uI.value = drop ? 0.9 : 0.3 + 0.45 * e;
      hd.pool.position.set(from.x + dx, from.y + dy, from.z + dz);
      hd.pool.material.color.copy(hd.col).multiplyScalar(0.35 + 0.4 * e);
    }
    for (const s of sweeps) {
      const a = t * 0.22 + s.ph, x = Math.cos(a) * V.hw * s.r, z = Math.sin(a * 1.3) * V.hd * s.r * 0.85 + V.hd * 0.12;
      s.m.position.set(x, floorY(plan, x, z), z);
      s.m.material.color.copy(s.col).multiplyScalar(drop ? 0.9 : 0.25 + 0.3 * e);
    }
    if (lasers) {
      const on = drop || B.sec % 2 === 1;
      lasers.visible = on;
      if (on) {
        lasers.rotation.set(0.1 + Math.sin(t * 1.3) * 0.06, Math.sin(t * 0.9) * 0.45, 0);
        lasers.material.color.set(B.bar % 2 ? 0x39ff6a : 0xff2a4a).multiplyScalar(0.6 + 0.4 * e);
      }
    }
    for (const f of X.fx) f(t, dt, B);
  };
}

/** Animate the LED floor (four patterns, a beat each). Returns the floor's average colour for the rim light. */
export function stepTiles(T, t, B, drop, out) {
  const { mesh, n, m } = T, pat = drop ? 3 : B.sec % 4, e = B.pulse, hueBase = (B.bar * 0.13) % 1;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const k = i * m + j, d = Math.hypot(i - n / 2, j - m / 2);
    let on, hue;
    if (pat === 0) { on = (i + j + B.n) % 2 === 0 ? 1 : 0.12; hue = hueBase + (B.n % 2) * 0.5; }
    else if (pat === 1) { on = Math.max(0.1, 1 - Math.abs(d - ((B.b * 2) % (n * 0.6))) * 0.9); hue = hueBase + d * 0.05; }
    else if (pat === 2) { on = 0.35 + 0.65 * (Math.sin((i + j) * 0.7 - t * 6) * 0.5 + 0.5); hue = (i + j) / (n + m) + t * 0.15; }
    else { on = ((k * 7919 + B.n * 104729) % 11) < 4 ? 1 : 0.1; hue = ((k * 31 + B.n * 17) % 100) / 100; }
    out.setHSL(((hue % 1) + 1) % 1, 0.95, 0.5).multiplyScalar(on * (0.5 + 0.5 * e));
    mesh.setColorAt(k, out);
    r += out.r; g += out.g; b += out.b;
  }
  mesh.instanceColor.needsUpdate = true;
  const N = n * m;
  return out.setRGB(r / N, g / N, b / N);
}

export { buildKit };
