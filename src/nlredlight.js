// Red Light Den decor + show: curtained window booths, paper lanterns, wet alley floor, neon.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, backBar, cnv, flicker, haze, heartPath, neonPath, neonText, onWall, tex, uvRect, wallQ } from './nlkit.js';
// puddles on the wet floor: x, z, size, the neon they catch, angle
const PUDDLES = [[-6, 2, 2.4, 0xff2244, 0.3], [7, 3, 2, 0xff66aa, -0.4], [-2.5, -8, 2.6, 0xff2244, 0.1], [10, -3, 1.8, 0xffaa33, 0.5], [-10, 8, 2.2, 0xff2244, -0.2]];

export function redlight(zn, X, h) {
  const { lam, table } = h, S = zn.scene;
  // booth windows on the front wall: curtains, backlit, a silhouette or two (tasteful: shoulders & hair)
  const winC = cnv(384, 256, (c) => {
    for (let v = 0; v < 3; v++) {
      const x0 = v * 128;
      const g = c.createRadialGradient(x0 + 64, 110, 10, x0 + 64, 110, 120);
      g.addColorStop(0, '#ff6a7a'); g.addColorStop(0.5, '#c0102a'); g.addColorStop(1, '#3a0008');
      c.fillStyle = g; c.fillRect(x0, 0, 128, 256);
      if (v === 1) { // a silhouette seated, side-on
        c.fillStyle = '#1a0006';
        c.beginPath(); c.ellipse(x0 + 64, 92, 13, 16, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x0 + 52, 84); c.quadraticCurveTo(x0 + 40, 130, x0 + 50, 150); c.lineTo(x0 + 60, 110); c.fill();
        c.beginPath(); c.moveTo(x0 + 58, 106); c.quadraticCurveTo(x0 + 44, 130, x0 + 50, 160); c.quadraticCurveTo(x0 + 56, 190, x0 + 48, 214); c.lineTo(x0 + 92, 214); c.quadraticCurveTo(x0 + 84, 180, x0 + 80, 150); c.quadraticCurveTo(x0 + 84, 124, x0 + 70, 106); c.fill();
      }
      if (v === 2) { c.fillStyle = 'rgba(255,230,180,.9)'; c.beginPath(); c.arc(x0 + 64, 120, 10, 0, TAU); c.fill(); c.fillStyle = '#2a0008'; c.fillRect(x0 + 56, 130, 16, 60); }
      // curtains (drawn fully across on v=0)
      const cw = v === 0 ? 64 : 36;
      for (const side of [0, 1]) {
        const cx = side ? x0 + 128 - cw : x0;
        const cg = c.createLinearGradient(cx, 0, cx + cw, 0);
        for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, i % 2 ? '#4a0010' : '#a01030');
        c.fillStyle = cg; c.globalAlpha = v === 0 ? 0.8 : 1; c.fillRect(cx, 10, cw, 240); c.globalAlpha = 1;
      }
      c.fillStyle = '#e0a040'; c.fillRect(x0, 8, 128, 5);
      c.strokeStyle = '#140204'; c.lineWidth = 10; c.strokeRect(x0 + 5, 5, 118, 246);
    }
  });
  const winT = tex(winC), wins = [];
  for (let i = 0; i < 6; i++) {
    const x = -12 + i * 4.8;
    zn.box(1.6, 3.2, 0.2, x, 1.6, 11.7, lam(0x1a0508), { collide: false });
    const v = [0, 1, 2, 1, 0, 2][i];
    wins.push(uvRect(wallQ(x, 1.55, 11.59, 1.45, 2.7, Math.PI), [v / 3, 0, (v + 1) / 3, 1]));
    X.pool(x, 10.7, 1.9, 0xff2244, 0.4);
  }
  S.add(new THREE.Mesh(mergeGeometries(wins), new THREE.MeshBasicMaterial({ map: winT })));
  for (let i = 0; i < 3; i++) table(4 + i * 3.2, -6, 0x5a0a1a);
  // paper lanterns: the row by the windows, plus strings sagging across the hall
  const lanT = tex(cnv(128, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#6a0010'); g.addColorStop(0.5, '#ff4a4a'); g.addColorStop(1, '#6a0010');
    c.fillStyle = g; c.fillRect(0, 0, 128, 64);
    c.strokeStyle = 'rgba(80,0,10,.7)'; c.lineWidth = 2; for (let x = 0; x < 128; x += 11) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 64); c.stroke(); }
    c.fillStyle = '#ffd24a'; c.font = 'bold 22px serif'; c.textAlign = 'center'; c.fillText('♥', 32, 40); c.fillText('♥', 96, 40);
  }), { repeat: true });
  const lanterns = [];
  for (let i = 0; i < 6; i++) lanterns.push([-12 + i * 4.8, 2.75, 10.5, 1]);
  for (const z of [5.5, -0.5, -6.5]) {
    for (let i = 0; i <= 8; i++) {
      const x = -13.5 + i * 3.375, sag = Math.sin((i / 8) * Math.PI) * 0.45;
      lanterns.push([x, 3.1 - sag, z + Math.sin(i * 1.3) * 0.2, 0.75]);
    }
  }
  const lanGeo = new THREE.SphereGeometry(0.3, 12, 8).scale(1, 1.2, 1);
  const lanMesh = new THREE.InstancedMesh(lanGeo, new THREE.MeshBasicMaterial({ map: lanT }), lanterns.length);
  const capMesh = new THREE.InstancedMesh(mergeGeometries([new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).translate(0, 0.37, 0), new THREE.CylinderGeometry(0.13, 0.13, 0.06, 10).translate(0, -0.37, 0), new THREE.CylinderGeometry(0.015, 0.03, 0.3, 5).translate(0, -0.55, 0)]), lam(0x2a1a08, { emissive: 0x3a2000 }), lanterns.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V1 = new THREE.Vector3();
  lanterns.forEach(([x, y, z, s], i) => { M.compose(V1.set(x, y, z), Q, new THREE.Vector3(s, s, s)); lanMesh.setMatrixAt(i, M); capMesh.setMatrixAt(i, M); });
  S.add(lanMesh, capMesh);
  const lanGlows = lanterns.map(([x, y, z, s], i) => {
    if (i >= 6 && i % 2) X.pool(x, z, 1.6 * s, 0xff2a3a, 0.35);
    else if (i < 6) X.cone(new THREE.Vector3(x, y - 0.2, z), new THREE.Vector3(x, 0, z - 0.2), 0.9, 0xff3344, 0.3);
    return X.bulb(x, y, z, 1.3 * s, 0xff3040);
  });
  // strings between lanterns
  const lp = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) { const a = lanterns[6 + r * 9 + i], b = lanterns[6 + r * 9 + i + 1]; lp.push(a[0], a[1] + 0.3, a[2], b[0], b[1] + 0.3, b[2]); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  S.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1a0a08 })));
  // wet floor: puddles catching the neon (painted into the floor glow)
  for (const [x, z, s, col, rot] of PUDDLES) X.paint.push({ x, z, rx: s * 0.8, rz: s * 0.45, rot, color: col, k: 0.4 });
  // beaded doorways on the back wall: a glowing red room beyond, strands of beads catching it
  for (const dx of [-4, 4]) {
    for (const s of [-0.7, 0.7]) X.prop(new THREE.BoxGeometry(0.12, 2.4, 0.12).translate(dx + s, 1.2, -11.72), 0x1a0806);
    X.prop(new THREE.BoxGeometry(1.56, 0.14, 0.14).translate(dx, 2.43, -11.72), 0x1a0806);
    X.halo('N', dx, 1.15, 1.3, 2.3, 0xff2a3a, 0.7);
    for (let i = 0; i < 12; i++) {
      const x = dx - 0.6 + i * 0.11;
      for (let j = 0; j < 9; j++) X.bulb(x, 2.3 - j * 0.24 - (i % 2) * 0.12, -11.6, 0.07, j % 3 ? 0xff6a8a : 0xffc060);
    }
  }
  // sodium street lamps by the corners: the alley outside, brought in
  for (const [x, z, dir] of [[-13.9, -8.8, 1], [13.9, -10, -1]]) {
    X.prop(new THREE.CylinderGeometry(0.05, 0.07, 3.1, 7).translate(x, 1.55, z), 0x1a1a1e);
    X.prop(new THREE.BoxGeometry(0.7, 0.05, 0.05).translate(x + dir * 0.35, 3.05, z), 0x1a1a1e);
    X.prop(new THREE.CylinderGeometry(0.1, 0.22, 0.16, 8).translate(x + dir * 0.7, 2.98, z), 0x2a2a2e);
    X.bulb(x + dir * 0.7, 2.88, z, 1.1, 0xffa050);
    X.cone(new THREE.Vector3(x + dir * 0.7, 2.9, z), new THREE.Vector3(x + dir * 0.9, 0, z), 1.2, 0xffa050, 0.28);
    X.pool(x + dir * 0.9, z, 2.2, 0xffa050, 0.45);
  }
  // signage
  const A = X.atlas;
  const sOpen = X.sign('N', -8, 2.45, 0.85, A.add(512, 128, (c) => neonText(c, 'OPEN ALL NIGHT', 256, 66, 76, '#ff2244', { maxW: 490 })), 0xff2244);
  const sHeart = X.sign('N', 8, 2.35, 1.3, A.add(384, 192, (c) => { neonPath(c, '#ff66aa', 6, heartPath(c, 90, 96, 60)); neonText(c, 'ROOMS', 262, 100, 70, '#ff66aa', { maxW: 220 }); }), 0xff66aa);
  X.sign('W', -1, 2.85, 0.6, A.add(256, 110, (c) => neonText(c, 'BAR', 128, 58, 84, '#ffaa33')), 0xffaa33);
  const den = A.add(512, 128, (c) => { neonPath(c, '#ff66aa', 4, heartPath(c, 60, 64, 34)); neonText(c, 'THE DEN', 300, 68, 92, '#ff2244', { maxW: 380 }); });
  const sDen = X.sign('E', 7, 2.45, 0.8, den, 0xff2244);
  const sHang = X.hangSign(-3.2, 2.95, 8.1, 0.25, 0.8, den, 0xff2244, { board: 0x14040a });
  X.sign('E', -7, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS', 192, 52, 62, '#ffaa33', { maxW: 360 })), 0xffaa33);
  backBar(X, -6.2, 4.2, '#6a1810');
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.4, 0xffaa33, 0.25);
  X.pool(12, 7, 2.6, 0xff2244, 0.3); X.pool(12, -7, 2.4, 0xff66aa, 0.25);
  haze(X, 0xff2a3a, X.rich ? 20 : 13, 0.6, 2.6);

  X.people.push(
    { x: -11.8, z: -3.5, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#2a2a2a' },
    { x: -11.7, z: 3.2, rot: -Math.PI / 2 + 0.3, pose: 'stand', type: 'dress', outfit: '#c02040' },
    { x: -14.35, z: -1, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#1a1a1a', fixed: true },
    { x: 5.6, z: -7.4, rot: 0.4, pose: 'stand', type: 'suit', outfit: '#3a1a1a' },
    { x: 8.8, z: -4.6, rot: 2.6, pose: 'stand', type: 'dress', outfit: '#e0e0e0' },
    { x: 10.8, z: 5.6, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#ff66aa' },
    { x: 10.7, z: 8.5, rot: -Math.PI / 2 - 0.3, pose: 'stand', type: 'suit', outfit: '#1a1a2a' },
    { x: 8.2, z: -10.9, rot: 0, pose: 'dance', type: 'dress', outfit: '#c02040' },
    { x: -9.4, z: -10.6, rot: 0.3, pose: 'stand', type: 'suit', outfit: '#222230' },
    // window shoppers along the booths, lingerers at the bead curtains and under the lamps
    { x: -9.6, z: 10.3, rot: 0.2, pose: 'stand', type: 'suit', outfit: '#1c1c24' },
    { x: 9.6, z: 10.3, rot: -0.2, pose: 'stand', type: 'suit', outfit: '#3a2a20' },
    { x: -5.2, z: 10.5, rot: 0.1, pose: 'stand', type: 'dress', outfit: '#5a1030' },
    { x: -5.6, z: -10.4, rot: 0.6, pose: 'stand', type: 'dress', outfit: '#ff2244' },
    { x: 5.7, z: -10.3, rot: -0.5, pose: 'stand', type: 'suit', outfit: '#20202a' },
    { x: -12.6, z: -8.2, rot: 1.2, pose: 'stand', type: 'dress', outfit: '#e0a0c0' },
    { x: 12.4, z: -9.2, rot: -1.4, pose: 'stand', type: 'suit', outfit: '#2a1a1a' },
  );

  X.fx.push((t, dt, B) => {
    const e = B.pulse;
    lanGlows.forEach((b, i) => b.c.setRGB(1, 0.19, 0.25).multiplyScalar(0.38 + 0.1 * Math.sin(t * 2.3 + i * 1.7)));
    X.signs.set(sOpen.s, flicker(t, 1)); X.glow.set(sOpen.h, 0.5 * flicker(t, 1));
    X.signs.set(sHeart.s, 0.7 + 0.3 * e); X.glow.set(sHeart.h, 0.35 + 0.35 * e);
    X.signs.set(sDen.s, flicker(t, 9));
    X.signs.set(sHang.s, 0.8 + 0.2 * e); X.glow.set(sHang.h, 0.25 + 0.25 * e);
    X.room.hall.forEach((l, i) => { l.intensity = 24 + Math.sin(t * 0.9 + i * 2) * 5 + (i === 1 ? (flicker(t, 2) - 1) * 14 : 0); });
  });
}
