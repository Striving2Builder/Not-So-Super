// High-Roller Suite decor + show: felt tables, slots, chandelier, dealers and players.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, SCRIPT, TAU, cnv, haze, neonText, pickR, rnd, tex, wallQ, tint } from './nlkit.js';
export function casino(zn, X, h) {
  const { lam, basic, spot, bar } = h, S = zn.scene;
  const felt = (kind) => tex(cnv(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#1f8a4a'); g.addColorStop(1, '#0c4a24');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#e0c060'; c.lineWidth = 3; c.beginPath(); c.arc(128, 128, 104, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(240,220,150,.85)'; c.font = 'bold 15px Georgia'; c.textAlign = 'center';
    if (kind === 'bj') {
      c.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = Math.PI * (0.2 + i * 0.15); c.strokeRect(128 + Math.cos(a) * 80 - 11, 128 + Math.sin(a) * 80 - 15, 22, 30); }
      c.fillText('BLACKJACK PAYS 3 TO 2', 128, 118); c.font = 'bold 11px Georgia'; c.fillText('INSURANCE PAYS 2 TO 1', 128, 140);
    } else {
      for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#b01020' : '#111'; c.fillRect(70 + (i % 6) * 20, 150 + Math.floor(i / 6) * 22, 19, 21); }
      c.fillStyle = 'rgba(240,220,150,.85)'; c.fillText('ROULETTE', 128, 138);
    }
  }));
  const tableCols = [], chips = [], cards = [], wheels = [];
  const feltBJ = felt('bj'), feltR = felt('r');
  for (let i = 0; i < 4; i++) {
    const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8, rou = i === 1 || i === 2;
    zn.cyl(1.5, 1.5, 0.1, x, 0.85, z, [lam(0x3a1a0a), lam(0xffffff, { map: rou ? feltR : feltBJ }), lam(0x3a1a0a)]);
    zn.cyl(0.25, 0.3, 0.85, x, 0.42, z, lam(0x2a1a0a), true);
    zn.colliders.push({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 });
    spot(x + 0.6, 0.92, z);
    tableCols.push(new THREE.TorusGeometry(1.5, 0.09, 8, 36).rotateX(Math.PI / 2).translate(x, 0.92, z));
    // chips at the players' places, cards in front of the dealer
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      const px = x + Math.sin(a + Math.PI) * -1.05, pz = z + Math.cos(a) * 1.05;
      for (let s = 0; s < 3; s++) {
        const n = 2 + Math.floor(Math.random() * 5), col = pickR([0xc02020, 0x202020, 0x1a8a3a, 0x2040c0, 0xf0f0f0, 0xe0b040]);
        chips.push(tint(new THREE.CylinderGeometry(0.06, 0.06, 0.025 * n, 10).translate(px + (s - 1) * 0.14, 0.9 + 0.0125 * n, pz), 1), col);
      }
      if (!rou) cards.push(new THREE.PlaneGeometry(0.12, 0.17).rotateX(-Math.PI / 2).rotateY(rnd(-0.3, 0.3)).translate(x + Math.sin(a) * 0.72, 0.905, z + Math.cos(a) * 0.72));
    }
    if (rou) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.08, 24), new THREE.MeshLambertMaterial({ map: wheelT(), emissive: 0x201008 }));
      w.position.set(x - 0.55, 0.94, z - 0.35); S.add(w); wheels.push(w);
    }
    // a pendant over each table: shade, warm beam, a pool on the felt
    X.cone(new THREE.Vector3(x, 2.85, z), new THREE.Vector3(x, 0.9, z), 1.35, 0xffd890, 0.28);
    X.pool(x, z, 1.7, 0xffe0a0, 0.45, 0.905);
    X.bulb(x, 2.8, z, 0.7, 0xffd890);
  }
  S.add(new THREE.Mesh(mergeGeometries(tableCols), lam(0x2a1206)));
  const shades = mergeGeometries([0, 1, 2, 3].map((i) => new THREE.CylinderGeometry(0.12, 0.38, 0.24, 16, 1, true).translate(-7 + (i % 2) * 8, 3.0, -5 + Math.floor(i / 2) * 8)));
  S.add(new THREE.Mesh(shades, lam(0x0e4a2a, { side: THREE.DoubleSide, emissive: 0x06200f })));
  const chipGeos = chips.filter((x, i) => i % 2 === 0), chipCols = chips.filter((x, i) => i % 2 === 1);
  chipGeos.forEach((g, i) => { const c = C(chipCols[i]); const a = g.attributes.color.array; for (let j = 0; j < a.length; j += 3) { a[j] = c.r; a[j + 1] = c.g; a[j + 2] = c.b; } });
  S.add(new THREE.Mesh(mergeGeometries(chipGeos), new THREE.MeshLambertMaterial({ vertexColors: true })));
  if (cards.length) S.add(new THREE.Mesh(mergeGeometries(cards), basic(0xf4f0e8)));
  // slot machines: the original cabinets, with lit fronts, spinning reels and chasing toppers
  const slotT = tex(cnv(128, 256, (c) => {
    c.fillStyle = '#1a0408'; c.fillRect(0, 0, 128, 256);
    const g = c.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, '#ffe070'); g.addColorStop(1, '#c02020');
    c.fillStyle = g; c.fillRect(6, 4, 116, 36);
    c.fillStyle = '#fff'; c.font = 'bold 30px Impact'; c.textAlign = 'center'; c.fillText('777', 64, 34);
    c.fillStyle = '#e0b040'; c.fillRect(10, 44, 108, 80);
    c.fillStyle = '#ffd84d'; c.font = 'bold 14px Impact'; c.fillText('★ JACKPOT ★', 64, 144);
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#ff3030', '#30ff60', '#3080ff', '#ffd030'][i]; c.beginPath(); c.arc(22 + i * 28, 168, 8, 0, TAU); c.fill(); }
    c.fillStyle = '#0a0204'; c.fillRect(20, 200, 88, 30); c.fillStyle = '#c09a34'; c.fillRect(20, 200, 88, 3);
  }));
  const reelT = tex(cnv(64, 256, (c) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 64, 256);
    const sy = ['7', '♦', 'BAR', '♣', '★', '7', '♥', '$'];
    c.textAlign = 'center'; c.textBaseline = 'middle';
    sy.forEach((s, i) => { c.fillStyle = ['#d01010', '#1060d0', '#111', '#107020', '#e0a000'][i % 5]; c.font = `bold ${s.length > 1 ? 16 : 26}px Impact`; c.fillText(s, 32, i * 32 + 16); });
  }), { repeat: true });
  reelT.repeat.set(3, 0.375);
  const fronts = [], reels = [], slotBulbs = [];
  for (let i = 0; i < 6; i++) {
    const z = -8 + i * 2;
    zn.box(0.9, 1.9, 0.8, -13.6, 0.95, z, lam(0x5a0a18));
    fronts.push(wallQ(-13.14, 0.95, z, 0.78, 1.9, Math.PI / 2));
    reels.push(wallQ(-13.13, 1.29, z, 0.62, 0.56, Math.PI / 2));
    X.pool(-12.6, z, 1.1, 0xffd84d, 0.3);
    X.glow.push(wallQ(-13.12, 1.3, z, 1.3, 2.2, Math.PI / 2), 0xffa040, 0.18);
    for (let k = 0; k < 5; k++) slotBulbs.push(X.bulb(-13.2, 1.96, z - 0.32 + k * 0.16, 0.16, 0xffd84d));
  }
  S.add(new THREE.Mesh(mergeGeometries(fronts), new THREE.MeshBasicMaterial({ map: slotT })));
  S.add(new THREE.Mesh(mergeGeometries(reels), new THREE.MeshBasicMaterial({ map: reelT })));
  // chandelier: gold rings, candle bulbs, twinkling crystal drops, a warm pool below
  const gold = lam(0xc09a34, { emissive: 0x4a3008 });
  S.add(new THREE.Mesh(mergeGeometries([
    new THREE.TorusGeometry(1.0, 0.035, 6, 40).rotateX(Math.PI / 2).translate(0, 2.8, 0),
    new THREE.TorusGeometry(0.6, 0.03, 6, 32).rotateX(Math.PI / 2).translate(0, 3.05, 0),
    new THREE.CylinderGeometry(0.02, 0.02, 0.7).translate(0, 3.1, 0), new THREE.SphereGeometry(0.12, 10, 8).translate(0, 2.72, 0),
  ]), gold));
  const crystals = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; X.bulb(Math.cos(a) * 1.0, 2.9, Math.sin(a) * 1.0, 0.3, 0xffe0a0); }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; X.bulb(Math.cos(a) * 0.6, 3.14, Math.sin(a) * 0.6, 0.26, 0xffe0a0); }
  for (let i = 0; i < (X.rich ? 48 : 20); i++) {
    const a = rnd(0, TAU), r = rnd(0.2, 1.0);
    crystals.push(X.bulb(Math.cos(a) * r, rnd(2.35, 2.8), Math.sin(a) * r, 0.12, 0xffffff));
  }
  X.bulb(0, 2.75, 0, X.rich ? 3.2 : 2.0, 0xffc070).c.multiplyScalar(0.35); // the big halo is fill-rate heavy
  X.pool(0, 0, 3.2, 0xffc070, 0.35);
  if (X.rich) X.cone(new THREE.Vector3(0, 2.7, 0), new THREE.Vector3(0, 0, 0), 2.6, 0xffc070, 0.15); // a screen-wide beam: High only
  // the bar and its bartender
  bar(11, 4, 7, true);
  X.pool(11, 4, 3, 0xffc070, 0.2);
  for (const z of [1.2, 3.0, 5.0, 6.8]) X.tableTop(11.4, z, 1.16, ['glass', 'glass'], 0.12);
  // cashier cage on the back wall: counter (a collider), brass bars, a warm lit window
  zn.box(3.6, 1.1, 0.8, 8, 0.55, -10.6, lam(0x2a1206));
  X.prop(new THREE.BoxGeometry(3.7, 0.06, 0.9).translate(8, 1.13, -10.6), 0xc09a34);
  for (let i = 0; i <= 24; i++) X.prop(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4).translate(6.2 + i * 0.15, 1.9, -10.25), 0xd0a840);
  X.prop(new THREE.BoxGeometry(3.7, 0.08, 0.08).translate(8, 2.66, -10.25), 0xc09a34);
  X.halo('N', 8, 1.8, 4.2, 2.2, 0xffc070, 0.5);
  X.pool(8, -9.6, 2.2, 0xffc070, 0.3);
  // signage
  const A = X.atlas;
  const hr = A.add(512, 128, (c) => neonText(c, 'HIGH ROLLER', 256, 66, 84, '#ffd84d', { maxW: 480 }));
  const sHR = X.sign('N', -8, 2.45, 0.85, hr, 0xffd84d);
  const sHang = X.hangSign(-3.2, 2.95, 8.1, 0.25, 0.75, hr, 0xffd84d, { board: 0x160a04 });
  const hrBulbs = X.bulbFrame('N', -8, 2.45, 4.1, 1.15, 0xffe070);
  X.sign('N', 8, 3.0, 0.5, A.add(384, 100, (c) => neonText(c, 'CASHIER', 192, 52, 70, '#fff1c0', { maxW: 360 })), 0xfff1c0, { streak: 0 });
  const sJack = X.sign('W', -3, 2.72, 0.75, A.add(512, 128, (c) => { neonText(c, 'JACKPOT', 256, 66, 92, '#ff4d4d', { maxW: 470 }); }), 0xff4d4d, { streak: 0.15 });
  const jpBulbs = X.bulbFrame('W', -3, 2.72, 3.4, 0.95, 0xffe070);
  X.sign('E', 5, 2.6, 0.65, A.add(512, 110, (c) => neonText(c, 'Cocktails', 256, 58, 86, '#fff1c0', { font: SCRIPT, weight: '700', maxW: 480 })), 0xfff1c0);
  X.sign('S', -8, 2.5, 0.8, A.add(384, 110, (c) => neonText(c, 'LUCKY 7', 192, 58, 84, '#ffd84d', { maxW: 360 })), 0xffd84d);
  X.sign('S', 8, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS', 192, 52, 62, '#ff4d4d', { maxW: 360 })), 0xff4d4d);
  haze(X, 0xffc070, X.rich ? 14 : 9);

  // dealers, players, slot players, a bartender
  const TUX = ['#111114', '#1a1a22', '#f0f0f0'], GOWN = ['#b01020', '#e0b040', '#0e6a3a', '#2040a0', '#6a1a6a', '#f0e0d0'];
  for (let i = 0; i < 4; i++) {
    const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8;
    X.people.push({ x, z: z - 1.95, rot: 0, pose: 'deal', type: 'suit', outfit: '#f4f4f4', hairType: 'S', fixed: true });
    for (const a of i % 2 ? [-0.8, 0.5] : [-0.5, 0.8]) {
      const px = x + Math.sin(a) * 1.95, pz = z + Math.cos(a) * 1.95, dress = Math.random() < 0.5;
      X.people.push({ x: px, z: pz, rot: Math.atan2(x - px, z - pz), pose: 'stand', type: dress ? 'dress' : 'suit', outfit: dress ? pickR(GOWN) : pickR(TUX) });
    }
  }
  X.people.push(
    { x: 8, z: -11.35, rot: 0, pose: 'deal', type: 'suit', outfit: '#e8e0d0', fixed: true },
    { x: 7.3, z: -9.4, rot: Math.PI, pose: 'stand', type: 'suit', outfit: '#111114' },
    { x: 3.6, z: -0.6, rot: 2.2, pose: 'stand', type: 'dress', outfit: '#101010' },
    { x: -3.2, z: 7.4, rot: 0.8, pose: 'stand', type: 'dress', outfit: '#b01020' },
    { x: -2.5, z: 8.1, rot: -2.4, pose: 'stand', type: 'suit', outfit: '#1a1a22' },
    { x: -12.55, z: -8, rot: -Math.PI / 2, pose: 'slot', type: 'dress', outfit: '#e0b040' },
    { x: -12.55, z: -4, rot: -Math.PI / 2, pose: 'slot', type: 'suit', outfit: '#3a3a4a' },
    { x: -12.55, z: 0, rot: -Math.PI / 2, pose: 'slot', type: 'dress', outfit: '#b01020' },
    { x: 9.7, z: 4, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#f0f0f0', fixed: true },
    { x: 12.3, z: 2.4, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#111114' },
    { x: 12.3, z: 6.2, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#0e6a3a' },
  );

  let spin = 0;
  X.fx.push((t, dt, B) => {
    for (const w of wheels) w.rotation.y += dt * 2.2;
    // reels spin for 2 s, rest on a symbol for 3 s
    const cyc = t % 5;
    if (cyc < 2) { spin += dt * 3; reelT.offset.y = spin; } else reelT.offset.y = Math.round(spin * 8) / 8;
    slotBulbs.forEach((b, i) => b.c.setRGB(1, 0.85, 0.3).multiplyScalar((i + Math.floor(t * 8)) % 5 === 0 ? 1 : 0.25));
    hrBulbs.forEach((b, i) => b.c.setRGB(1, 0.88, 0.45).multiplyScalar((i + Math.floor(t * 7)) % 3 === 0 ? 1 : 0.3));
    jpBulbs.forEach((b, i) => b.c.setRGB(1, 0.88, 0.45).multiplyScalar(Math.floor(t * 3) % 2 === i % 2 ? 1 : 0.25));
    crystals.forEach((b, i) => b.c.setScalar(Math.sin(t * 3 + i * 2.7) > 0.8 ? 1 : 0.3));
    X.signs.set(sJack.s, cyc < 2 ? (Math.floor(t * 6) % 2 ? 1 : 0.4) : 1);
    X.glow.set(sHR.h, 0.45 + 0.08 * Math.sin(t * 2));
    X.glow.set(sHang.h, 0.3 + 0.08 * Math.sin(t * 2));
    X.room.hall.forEach((l, i) => { l.intensity = 26 + Math.sin(t * 0.7 + i) * 3; });
  });
}
function wheelT() {
  return tex(cnv(128, 128, (c) => {
    c.fillStyle = '#3a1a0a'; c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 36; i++) {
      c.fillStyle = i === 0 ? '#10a040' : i % 2 ? '#b01020' : '#111';
      c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 60, (i / 36) * TAU, ((i + 1) / 36) * TAU); c.closePath(); c.fill();
    }
    c.fillStyle = '#c09a34'; c.beginPath(); c.arc(64, 64, 36, 0, TAU); c.fill();
    c.fillStyle = '#6a3a14'; c.beginPath(); c.arc(64, 64, 30, 0, TAU); c.fill();
    c.fillStyle = '#e0c060'; c.beginPath(); c.arc(64, 64, 8, 0, TAU); c.fill();
  }));
}
