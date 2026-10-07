// The side rooms and the alley (docs/design/nightclub.md "The club layout"): each one's walls,
// floor and props, plus its back wall: the user's painted room (the v2 walk plates, cropped to
// the wall above the floor line) brought in as a backdrop, the "one wall that brings in images"
// idea. Returns per-room anchors (where the cast stands, the close-up spots, the stash) for the
// mode to place its gameplay on.
import * as THREE from 'three';
import { toon } from '../look3d.js';
import { wallQ, floorQ, cnv, tex, C, rnd, pickR, TAU, speckle, neonText } from '../nlkit.js';
import { damask, wainscot, coveWash, neonLine, WY, WS } from '../nlroom.js';
import { ROOM_H, DOOR_W } from './plan.js';
import { wallSeg, wallWithGaps, CUT_H } from './build.js';
import { screenMat } from './video.js';

const PLATES = 'assets/nightclub/plates/';
// the painted plates: back wall's foot as a fraction of the image height (above it: the back wall)
const PLATE = {
  vip: ['vip.jpg', 0.68], office: ['office.jpg', 0.66], restroom: ['restroom.jpg', 0.64], dark: ['dark.jpg', 0.64],
  storage: ['storage.jpg', 0.66], lounge: ['lounge.jpg', 0.66], alley: ['alley.jpg', 0.62],
};
const PLATE_ASPECT = 3.375; // 2430 x 720 renders

const worldTile = (m, metres) => { m.userData.worldUV = metres; return m; };
const hex = (c) => '#' + C(c).getHexString();

// ------------------------------------------------------------------ surfaces
const WALLS = {
  vip: (c) => { c.fillStyle = '#16060f'; c.fillRect(0, 0, 512, 512); damask(c, 1.12, 3.1, '#3a0c2c', '#5a1a4a'); wainscot(c, 1.05, '#2a120b', '#4a2414', '#c09a34'); },
  office: (c) => { c.fillStyle = '#1a120a'; c.fillRect(0, 0, 512, 512); for (let x = 0; x < 512; x += 32) { c.fillStyle = x % 64 ? '#3a2614' : '#33210f'; c.fillRect(x, 0, 30, 512); } wainscot(c, 1.0, '#24140a', '#3e2412', '#a07a2a'); },
  restroom: (c) => {
    c.fillStyle = '#0c1a1c'; c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) for (let x = 0; x < 512; x += 32) { c.fillStyle = (x + y) % 64 ? '#cfe8e6' : '#b8d8d6'; c.fillRect(x + 1, y + 1, 30, 30); }
    c.fillStyle = 'rgba(10,30,30,.35)'; c.fillRect(0, 0, 512, WY(2.4));
    speckle(c, 512, 512, 900, 0.12);
  },
  dark: (c) => {
    c.fillStyle = '#050409'; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(176,77,255,.22)'; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(rnd(0, 512), rnd(WY(3), WY(0.5))); c.bezierCurveTo(rnd(0, 512), rnd(0, 512), rnd(0, 512), rnd(0, 512), rnd(0, 512), rnd(WY(3), WY(0.5))); c.stroke(); }
  },
  storage: (c) => {
    c.fillStyle = '#140a08'; c.fillRect(0, 0, 512, 512);
    for (let r = 0, y = 0; y < 512; r++, y += 16) for (let x = -32 + (r % 2) * 16; x < 512; x += 32) { c.fillStyle = pickR(['#3a1c14', '#45221a', '#331810']); c.fillRect(x + 1, y + 1, 30, 14); }
    speckle(c, 512, 512, 1200, 0.1);
  },
  lounge: (c) => { c.fillStyle = '#120612'; c.fillRect(0, 0, 512, 512); damask(c, 0.9, 3.1, '#2a0a2a', '#3e1440', 48, 72); coveWash(c, 'rgba(255,95,208,A)', 3.2, 1.6, 0.25); },
  alley: (c) => {
    c.fillStyle = '#0c0808'; c.fillRect(0, 0, 512, 512);
    for (let r = 0, y = 0; y < 512; r++, y += 14) for (let x = -28 + (r % 2) * 14; x < 512; x += 28) { c.fillStyle = pickR(['#2a1a1a', '#331f1c', '#24161a']); c.fillRect(x + 1, y + 1, 26, 12); }
    for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(rnd(0, 512), 0, rnd(3, 8), rnd(80, 300)); }
    speckle(c, 512, 512, 1600, 0.1);
  },
};
const EMIT = {
  vip: (c, A) => { neonLine(c, WY(3.15), A, 4, 14); coveWash(c, 'rgba(255,216,77,A)', 3.1, 1.4, 0.22); },
  restroom: (c, A) => { neonLine(c, WY(2.9), A, 4, 14); },
  dark: (c, A) => { neonLine(c, WY(0.12), A, 3, 12); },
  lounge: (c, A) => { neonLine(c, WY(3.2), A, 4, 16); },
};
const FLOORS = {
  vip: [2, (c) => { c.fillStyle = '#2a0c26'; c.fillRect(0, 0, 256, 256); speckle(c, 256, 256, 2000, 0.05); c.strokeStyle = '#4a1840'; c.lineWidth = 3; for (let x = -256; x <= 256; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 256, 256); c.stroke(); c.beginPath(); c.moveTo(x + 256, 0); c.lineTo(x, 256); c.stroke(); } }],
  office: [2, (c) => { c.fillStyle = '#4a3018'; c.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 32) { c.fillStyle = y % 64 ? '#5a3a1e' : '#4e3219'; c.fillRect(0, y + 1, 256, 30); } speckle(c, 256, 256, 600, 0.06); }],
  restroom: [1.2, (c) => { for (let y = 0; y < 256; y += 64) for (let x = 0; x < 256; x += 64) { c.fillStyle = ((x + y) / 64) % 2 ? '#e8e8e0' : '#141418'; c.fillRect(x, y, 64, 64); } speckle(c, 256, 256, 500, 0.08); }],
  dark: [2, (c) => { c.fillStyle = '#060509'; c.fillRect(0, 0, 256, 256); speckle(c, 256, 256, 800, 0.05); }],
  storage: [3, (c) => { c.fillStyle = '#3a3a3e'; c.fillRect(0, 0, 256, 256); speckle(c, 256, 256, 3000, 0.12); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 3; c.strokeRect(0, 0, 256, 256); }],
  lounge: [2, (c) => { c.fillStyle = '#1e0a20'; c.fillRect(0, 0, 256, 256); speckle(c, 256, 256, 2400, 0.05); }],
  alley: [3, (c) => { c.fillStyle = '#1a1a1e'; c.fillRect(0, 0, 256, 256); speckle(c, 256, 256, 3500, 0.12); for (let i = 0; i < 6; i++) { const g = c.createRadialGradient(rnd(0, 256), rnd(0, 256), 2, rnd(0, 256), rnd(0, 256), rnd(20, 60)); g.addColorStop(0, 'rgba(80,90,120,.35)'); g.addColorStop(1, 'rgba(80,90,120,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } }],
};

function roomMats(kind, accent) {
  const A = hex(accent);
  const emit = EMIT[kind] ? tex(cnv(512, 512, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512); EMIT[kind](c, A); }), { repeat: true }) : null;
  const wall = worldTile(toon(0xffffff, { map: tex(cnv(512, 512, WALLS[kind]), { repeat: true }), ...(emit ? { emissive: 0xffffff, emissiveMap: emit } : {}) }, { halftone: 0.5 }), ROOM_H);
  const [T, paint] = FLOORS[kind];
  const floor = worldTile(toon(0xffffff, { map: tex(cnv(256, 256, paint), { repeat: true }) }, { halftone: 0.4 }), T);
  return { wall, floor };
}

/** The user's painted room on the back wall: the plate cropped to the wall above its floor line. */
function backPlate(zn, kind, x, y, z, w, h, yaw = 0) {
  const [file, back] = PLATE[kind] || [];
  if (!file) return null;
  const t = new THREE.TextureLoader().load(PLATES + file);
  t.colorSpace = THREE.SRGBColorSpace;
  const uw = Math.min(1, (back * (w / h)) / PLATE_ASPECT);
  t.repeat.set(uw, back); t.offset.set((1 - uw) / 2, 1 - back);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: 0xb8b8c0 }));
  m.position.set(x, y, z); m.rotation.y = yaw;
  zn.scene.add(m);
  return m;
}

// ------------------------------------------------------------------ the rooms
/** Walls + floor of a side room (the hall wall is its inner side), its back plate, then its props. */
export function buildRoom(zn, plan, q, M, X, video) {
  const S = zn.scene, s = q.side === 'W' ? -1 : 1;
  const R = roomMats(q.kind, q.accent);
  const w = q.x1 - q.x0, d = q.z1 - q.z0;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), R.floor);
  fl.position.set(q.cx, 0.002, q.cz); S.add(fl); zn._static.push(fl);
  const outer = s < 0 ? q.x0 : q.x1;
  wallSeg(zn, q.x0 - 0.2, q.z0, q.x1 + 0.2, q.z0, ROOM_H, R.wall, M);
  wallSeg(zn, q.x0 - 0.2, q.z1, q.x1 + 0.2, q.z1, CUT_H, R.wall, M); // the camera side: a low cutaway
  const gaps = q.kind === 'storage' ? [[q.cz, DOOR_W]] : [];
  wallWithGaps(zn, 'z', outer, q.z0, q.z1, gaps, ROOM_H, R.wall, M);
  backPlate(zn, q.kind, q.cx, ROOM_H / 2 + 0.05, q.z0 + 0.22, w - 0.7, ROOM_H - 0.25);
  X.pool(q.cx, q.cz, Math.min(w, d) * 0.42, q.accent, 0.14);
  const A = { closeup: null };
  const at = (u, v) => [q.cx + s * u, q.z0 + v]; // u: metres outward from the room's middle, v: metres in from its back wall
  const box = (bw, h, bd, u, y, v, mat, o) => { const [x, z] = at(u, v); return zn.box(bw, h, bd, x, y, z, mat, o); };
  const lam = (c, e) => toon(c, e || {}, { halftone: 0.4 });
  if (q.kind === 'vip') {
    const sofa = lam(0x6a1040), gold = lam(0xc09a34);
    box(w - 3, 0.45, 1.1, 0, 0.22, 1.3, sofa); box(w - 3, 0.95, 0.35, 0, 0.47, 0.8, sofa, { collide: false });
    box(1.1, 0.45, 4, -(w / 2 - 2.1), 0.22, 4, sofa);
    box(2.6, 0.42, 1.2, 0, 0.21, 3.2, lam(0x14080e)); box(2.7, 0.04, 1.3, 0, 0.44, 3.2, gold, { collide: false });
    for (const u of [-0.8, 0.5]) { const [x, z] = at(u, 3.1); X.prop(new THREE.CylinderGeometry(0.1, 0.075, 0.22, 8).translate(x, 0.56, z), 0xd0d0dc); }
    for (const u of [-0.3, 0.1, 0.9]) { const [x, z] = at(u, 3.35); X.prop(new THREE.CylinderGeometry(0.035, 0.028, 0.14, 7).translate(x, 0.52, z), 0xbfe6ff); }
    A.host = { x: at(0, 1.35)[0], z: at(0, 1.35)[1], rot: 0 };
    A.seats = [at(-2.2, 1.35), at(2.2, 1.35), at(-3.6, 1.35)].map(([x, z]) => ({ x, z }));
    { const [x, z] = at(0.4, 4.6); A.closeup = { x, z }; }
    { const [x, z] = at(0, 4.9); A.quiz = { x, z }; }
    X.pool(...at(0, 2.5), 3, 0xffd84d, 0.35);
    for (const u of [-3, 3]) { const [x, z] = at(u, 0.4); X.bulb(x, 2.6, z, 0.5, 0xffd84d); }
  } else if (q.kind === 'office') {
    const wood = lam(0x4a2410), steel = lam(0x5a6270);
    box(3.2, 0.8, 1.3, 0, 0.4, 3.4, wood); box(3.3, 0.05, 1.4, 0, 0.82, 3.4, lam(0x1e6a3a), { collide: false });
    box(0.7, 1.1, 0.7, 0, 0.55, 2.2, lam(0x2a1a14), { collide: false });
    for (const v of [6.2, 7.2]) box(0.7, 1.6, 0.9, -(w / 2 - 0.55), 0.8, v, steel);
    A.boss = { x: at(0, 2.3)[0], z: at(0, 2.3)[1], rot: 0 };
    { const [x, z] = at(0.6, 4.7); A.closeup = { x, z }; A.confront = { x, z: z + 0.2 }; }
    // the safe, behind a painting on the outer wall; X-ray sees through the canvas
    const sv = 2.0;
    { const [x, z] = [outer - s * 0.12, q.z0 + sv]; A.safe = { x: outer - s * 1.1, z, wx: x, wz: z };
      const art = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ map: tex(cnv(128, 96, (c) => { const g = c.createLinearGradient(0, 0, 128, 96); g.addColorStop(0, '#c08a40'); g.addColorStop(1, '#3a1a40'); c.fillStyle = g; c.fillRect(0, 0, 128, 96); c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(80, 34, 16, 0, TAU); c.fill(); c.strokeStyle = '#c09a34'; c.lineWidth = 8; c.strokeRect(0, 0, 128, 96); })) }));
      art.position.set(x, 1.7, z); art.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; S.add(art); A.safe.art = art; }
    // the CCTV wall on the outer wall, nearer the camera: four feeds
    A.cctv = [];
    for (let i = 0; i < 4; i++) {
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.72), screenMat(video, { scan: true, bright: 1.1, bg: 0x0a1a12 }));
      sc.position.set(outer - s * 0.1, 1.55 + (i >> 1) * 0.8, q.z0 + 4.4 + (i & 1) * 1.25);
      sc.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; S.add(sc);
      A.cctv.push(sc.material);
    }
    box(0.25, 1.9, 2.8, w / 2 - 0.15, 1.95, 5.0, lam(0x0c0b12), { collide: false }); // the monitors' backing
    A.recorder = { x: outer - s * 1.0, z: q.z0 + 6.6 };
    X.pool(...at(0, 3.4), 2.4, 0xfff2a0, 0.3);
  } else if (q.kind === 'restroom') {
    const part = lam(0x2a4a4c), door = lam(0x1a3436);
    for (let i = 0; i <= 3; i++) box(0.12, 2.1, 1.6, -w / 2 + 2 + i * 1.6, 1.05, 0.8, part);
    for (let i = 0; i < 3; i++) box(1.3, 1.9, 0.08, -w / 2 + 2.8 + i * 1.6, 1.05, 1.62, door, { collide: false });
    A.stalls = [0, 1, 2].map((i) => ({ x: at(-w / 2 + 2.8 + i * 1.6, 2.4)[0], z: at(0, 2.4)[1] }));
    // sinks along the outer wall + the mirror above them
    box(0.7, 0.9, 4.2, w / 2 - 0.5, 0.45, 5.6, lam(0xd8e0e0));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.2), new THREE.MeshBasicMaterial({ color: 0x5a7a88 }));
    mirror.position.set(outer - s * 0.08, 1.75, q.z0 + 5.6); mirror.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; S.add(mirror);
    A.mirror = mirror;
    { const [x, z] = at(w / 2 - 1.6, 5.6); A.closeup = { x, z }; }
    A.deal = A.stalls[2]; A.powder = A.stalls[0]; A.change = A.stalls[1];
    X.pool(...at(0, 4), 3, 0x7fffd4, 0.18);
  } else if (q.kind === 'dark') {
    A.dancers = [];
    for (let i = 0; i < 9; i++) { const [x, z] = at(rnd(-w / 2 + 1.6, w / 2 - 1.6), rnd(2, d - 2.4)); A.dancers.push({ x, z, pose: 'dance', y: 0 }); }
    { const [x, z] = at(w / 2 - 2.2, 2.2); A.thugs = { x, z }; }
    { const [x, z] = at(-w / 2 + 2, d - 2.2); A.graffiti = { x, z }; }
  } else if (q.kind === 'storage') {
    const crate = lam(0x6a4a2a), keg = lam(0x8a8a90);
    for (const [u, v, h] of [[-4, 1.2, 2], [-2.6, 1.2, 1.2], [3.6, 1.6, 2.4], [2.2, 1.2, 1.2], [-4, 4.4, 1.2], [3.8, 8.6, 1.6]]) box(1.2, h, 1.2, u, h / 2, v, crate);
    for (const [u, v] of [[0.6, 1.0], [1.2, 1.0], [0.9, 1.6]]) { const [x, z] = at(u, v); zn.cyl(0.3, 0.3, 0.9, x, 0.45, z, keg, true); }
    { const [x, z] = at(-2.6, 3.0); A.stash = { x, z }; }
    A.back = { x: outer, z: q.cz };
    X.pool(...at(0, 5), 3, 0xa0ff9f, 0.14);
  } else if (q.kind === 'lounge') {
    const sofa = lam(0x4a1040), tbl = lam(0x1a0a1a);
    box(w - 3, 0.45, 1.0, 0, 0.22, 1.2, sofa); box(w - 3, 0.9, 0.3, 0, 0.45, 0.75, sofa, { collide: false });
    for (const u of [-3, 0, 3]) { const [x, z] = at(u, 2.6); zn.cyl(0.55, 0.55, 0.06, x, 0.72, z, tbl); zn.cyl(0.08, 0.1, 0.72, x, 0.36, z, lam(0x222222), true); X.bulb(x, 0.85, z, 0.35, 0xffb050); }
    A.gangster = { x: at(3, 1.4)[0], z: at(3, 1.4)[1], rot: 0 };
    { const [x, z] = at(3, 3.6); A.shots = { x, z }; }
    A.loungers = [at(-3, 1.4), at(0, 1.4)].map(([x, z]) => ({ x, z, pose: 'sit', rot: 0, y: 0 }));
  }
  return A;
}

/** The alley: an outdoor strip behind the storage room, its far wall one of the painted alleys. */
export function buildAlley(zn, plan, q, M, X) {
  const S = zn.scene, s = q.side === 'W' ? -1 : 1;
  const R = roomMats('alley', q.accent), st = plan.byKind.storage;
  const w = q.x1 - q.x0, d = q.z1 - q.z0, inner = s < 0 ? q.x1 : q.x0, outer = s < 0 ? q.x0 : q.x1;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), R.floor);
  fl.position.set(q.cx, 0.002, q.cz); S.add(fl); zn._static.push(fl);
  wallSeg(zn, outer, q.z0, outer, q.z1, 5, R.wall, M);
  wallSeg(zn, q.x0 - 0.2, q.z0, q.x1 + 0.2, q.z0, 5, R.wall, M);
  wallSeg(zn, q.x0 - 0.2, q.z1, q.x1 + 0.2, q.z1, CUT_H, R.wall, M); // the camera side: a low cutaway
  wallSeg(zn, inner, q.z0, inner, st.z0, 5, R.wall, M);
  wallSeg(zn, inner, st.z1, inner, q.z1, 5, R.wall, M);
  // the far wall: a painted red-light alley (the brawler's backdrops), with the v2 alley plate as a fallback
  const t = new THREE.TextureLoader().load(`assets/brawl/backdrops/rld-alley-0${1 + Math.floor(Math.random() * 9)}.webp`);
  t.colorSpace = THREE.SRGBColorSpace;
  const uw = Math.min(1, (0.66 * (w / 4.6)) / (2000 / 1200)); t.repeat.set(uw, 0.66); t.offset.set((1 - uw) / 2, 0.34);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, 4.6), new THREE.MeshBasicMaterial({ map: t, color: 0xa0a0b0 }));
  far.position.set(q.cx, 2.35, q.z0 + 0.22); S.add(far);
  const lam = (c) => toon(c, {}, { halftone: 0.4 });
  for (const [v, c] of [[3.5, 0x2a5a3a], [9, 0x3a3a5a]]) zn.box(1.6, 1.3, 1.0, outer - s * 0.9, 0.65, q.z0 + v, lam(c));
  for (let y = 1.2; y < 4.6; y += 1.1) X.prop(new THREE.BoxGeometry(0.06, 0.06, 4).translate(outer - s * 0.5, y, q.z0 + 12), 0x101014);
  // a caged lamp over the stock room's back door and one at the far end; wet light on the asphalt
  for (const [v, k] of [[q.cz - q.z0 + 1.8, 0.45], [2.5, 0.35]]) { X.bulb(inner - s * 0.3, 2.8, q.z0 + v, 0.7, 0xffb050); X.pool(q.cx, q.z0 + v, 3.2, 0xffb050, k); }
  for (let i = 0; i < 5; i++) X.pool(q.cx + rnd(-w / 3, w / 3), q.z0 + rnd(2, d - 2), rnd(0.6, 1.2), pickR([0xff2244, 0x27e0ff, 0xff6688]), 0.18);
  return { courier: { x: q.cx, z: q.z0 + 3.2 }, fight: { x: q.cx, z: q.z0 + 5 } };
}
