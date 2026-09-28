// Nightclub decor + show: LED dance floor, DJ booth and LED wall, truss, mirror ball, moving heads, lasers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, DOWN, SCRIPT, TAU, backBar, beamCanvas, beat, boltPath, cnv, coneGeo, coneMat, flicker, floorQ, glassPath, haze, makePoints, neonPath, neonText, onWall, pickR, pointsMat, rnd, tex, wallQ } from './nlkit.js';
export function nightclub(zn, X, h) {
  const { lam, basic } = h, S = zn.scene;
  // dance floor: 36 LED panels in one instanced mesh
  const tileT = tex(cnv(64, 64, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 64, 64);
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 40);
    g.addColorStop(0, '#fff'); g.addColorStop(0.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
    c.fillStyle = g; c.fillRect(3, 3, 58, 58);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.strokeRect(5, 5, 54, 54);
  }));
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tileT }), 36);
  const M = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { M.makeTranslation(-3 + i * 1.2, 0.02, -2.5 + j * 1.2); tiles.setMatrixAt(i * 6 + j, M); tiles.setColorAt(i * 6 + j, C(0x222222)); }
  S.add(tiles);
  // chrome + neon frame around the floor
  const frame = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(7.5, 0.06, 0.12).translate(0, 0.03, -3.18), new THREE.BoxGeometry(7.5, 0.06, 0.12).translate(0, 0.03, 4.18),
    new THREE.BoxGeometry(0.12, 0.06, 7.5).translate(-3.68, 0.03, 0.5), new THREE.BoxGeometry(0.12, 0.06, 7.5).translate(3.68, 0.03, 0.5),
  ]), basic(0xff2fd0));
  S.add(frame);
  const floorGlow = X.glow.push(new THREE.RingGeometry(3.7, 4.9, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2).scale(1, 1, 1).translate(0, 0.03, 0.5), 0xffffff, 0.2);
  // truss over the floor, holding the ball and four moving heads
  const truss = mergeGeometries([
    new THREE.BoxGeometry(8.6, 0.14, 0.14).translate(0, 3.32, -3.7), new THREE.BoxGeometry(8.6, 0.14, 0.14).translate(0, 3.32, 4.7),
    new THREE.BoxGeometry(0.14, 0.14, 8.4).translate(-4.3, 3.32, 0.5), new THREE.BoxGeometry(0.14, 0.14, 8.4).translate(4.3, 3.32, 0.5),
    new THREE.BoxGeometry(8.6, 0.06, 0.06).translate(0, 3.32, 0.5), new THREE.CylinderGeometry(0.015, 0.015, 0.4).translate(0, 3.35, 0.5),
    ...[[-4.3, -3.7], [4.3, -3.7], [-4.3, 4.7], [4.3, 4.7]].map(([x, z]) => new THREE.BoxGeometry(0.26, 0.3, 0.26).translate(x, 3.1, z)),
  ]);
  S.add(new THREE.Mesh(truss, lam(0x2a2a33)));
  // mirror ball
  const facets = tex(cnv(128, 64, (c) => {
    for (let x = 0; x < 128; x += 4) for (let y = 0; y < 64; y += 4) { const v = Math.random(); c.fillStyle = v > 0.93 ? '#fff' : `hsl(${rnd(180, 320)},30%,${20 + v * 55}%)`; c.fillRect(x, y, 3, 3); }
  }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 12), new THREE.MeshBasicMaterial({ map: facets }));
  ball.position.set(0, 3.0, 0.5); S.add(ball);
  const ballGlow = X.bulb(0, 3.0, 0.5, 2.2, 0xaaccff);
  // mirror-ball specks sweeping the floor
  const specks = [];
  for (let i = 0; i < (X.lite ? 60 : X.rich ? 170 : 110); i++) {
    const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * 10.5 + 0.8;
    specks.push({ p: [Math.cos(a) * r, 0.05, Math.sin(a) * r * 0.95], s: rnd(0.1, 0.18), c: C(pickR([0xffffff, 0xbfe8ff, 0xffd0f0])).multiplyScalar(0.7) });
  }
  const speckPts = makePoints(specks, X.pmat || (X.pmat = pointsMat(X.glowT)));
  speckPts.name = 'nl-specks'; speckPts.position.set(0, 0, 0.5); S.add(speckPts);
  // moving heads: fake beams + their pools, swept across the floor
  const heads = [];
  const cm = coneMat();
  const hcols = [0xff2fd0, 0x27e0ff, 0xffe14d, 0x9d4dff];
  const nHeads = X.rich ? 4 : 2; // each beam is a screen-tall additive surface
  const hpos = [[-4.3, -3.7], [4.3, -3.7], [4.3, 4.7], [-4.3, 4.7]];
  for (let i = 0; i < nHeads; i++) {
    const mat = cm.clone(); mat.uniforms.uC.value = C(hcols[i]); mat.uniforms.uI.value = 0.55;
    const beam = new THREE.Mesh(coneGeo(0.03, 0.42), mat);
    beam.frustumCulled = false; beam.name = 'nl-heads';
    beam.position.set(hpos[i][0], 3.0, hpos[i][1]);
    S.add(beam);
    const pm = new THREE.Mesh(floorQ(0, 0, 3, 3, 0.04 + i * 0.003), new THREE.MeshBasicMaterial({ map: X.glowT, color: hcols[i], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pm.name = 'nl-heads'; S.add(pm);
    heads.push({ beam, pool: pm, ph: i * 1.7, col: C(hcols[i]) });
  }
  // lasers fanning from above the DJ over the crowd (not on Battery saver)
  let lasers = null;
  if (!X.lite) {
    const bt = tex(beamCanvas());
    const L = 17, gs = [];
    for (let i = 0; i < 8; i++) {
      const yaw = (i / 7 - 0.5) * 0.9;
      const a = new THREE.PlaneGeometry(0.07, L).rotateX(-Math.PI / 2).translate(0, 0, L / 2);
      const b = a.clone().rotateZ(Math.PI / 2);
      gs.push(a.rotateY(yaw), b.rotateY(yaw));
    }
    lasers = new THREE.Mesh(mergeGeometries(gs), new THREE.MeshBasicMaterial({ map: bt, color: 0x39ff6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    lasers.position.set(-8, 2.25, -10.4); lasers.frustumCulled = false; lasers.name = 'nl-lasers';
    S.add(lasers);
    X.bulb(-8, 2.25, -10.4, 0.7, 0x39ff6a);
  }
  // DJ booth: the original box + strip stay (collider); dress its front, decks, speakers and an LED wall
  zn.box(3.5, 1.2, 1.4, -8, 0.6, -10.2, lam(0x14141c));
  zn.box(3.3, 0.1, 1.2, -8, 1.25, -10.2, basic(0x27e0ff), { collide: false });
  for (const x of [-10.5, -5.5]) zn.box(0.9, 2, 0.9, x, 1, -10.8, lam(0x0c0c10));
  const boothT = tex(cnv(256, 96, (c) => {
    c.fillStyle = '#07060c'; c.fillRect(0, 0, 256, 96);
    neonText(c, 'VOLT', 128, 50, 54, '#27e0ff');
    neonPath(c, '#ff2fd0', 2.5, () => { c.beginPath(); c.moveTo(6, 88); c.lineTo(250, 88); });
  }));
  S.add(new THREE.Mesh(wallQ(-8, 0.62, -9.48, 3.4, 1.1, 0), new THREE.MeshBasicMaterial({ map: boothT })));
  const spkT = tex(cnv(64, 128, (c) => {
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, 64, 128);
    for (const [y, r] of [[32, 18], [88, 26]]) {
      c.fillStyle = '#1c1c26'; c.beginPath(); c.arc(32, y, r + 3, 0, TAU); c.fill();
      c.fillStyle = '#050508'; c.beginPath(); c.arc(32, y, r, 0, TAU); c.fill();
      c.fillStyle = '#2a2a3a'; c.beginPath(); c.arc(32, y, r * 0.35, 0, TAU); c.fill();
    }
  }));
  S.add(new THREE.Mesh(mergeGeometries([wallQ(-10.5, 1, -10.34, 0.86, 1.95, 0), wallQ(-5.5, 1, -10.34, 0.86, 1.95, 0)]), new THREE.MeshBasicMaterial({ map: spkT })));
  const decks = [];
  for (const x of [-9, -7]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20), new THREE.MeshBasicMaterial({ map: facets, color: 0x555566 }));
    d.position.set(x, 1.32, -10.2); S.add(d); decks.push(d);
  }
  const ledC = cnv(96, 32), ledT = tex(ledC, { nearest: true });
  const led = new THREE.Mesh(wallQ(...onWall('N', -8, 2.25, 0.03), 7, 2.2, 0), new THREE.MeshBasicMaterial({ map: ledT }));
  S.add(led);
  const ledHalo = X.halo('N', -8, 2.25, 8, 2.8, 0xffffff, 0.3);
  X.pool(-8, -9.5, 3.5, 0x27e0ff, 0.25);

  // signage
  const A = X.atlas;
  const sVolt = X.sign('N', 8, 2.35, 1.0, A.add(512, 128, (c, w, hh) => { neonPath(c, '#ffe14d', 5, boltPath(c, 58, 64, 46)); neonText(c, 'CLUB VOLT', 290, 68, 84, '#27e0ff', { maxW: 400 }); }), 0x27e0ff);
  const sBar = X.sign('W', -1, 2.85, 0.62, A.add(512, 110, (c) => neonText(c, 'Cocktails', 256, 58, 86, '#ff2fd0', { font: SCRIPT, weight: '700', maxW: 480 })), 0xff2fd0);
  const sVip = X.sign('E', 7, 2.55, 0.9, A.add(256, 128, (c) => { neonPath(c, '#ffe14d', 4, glassPath(c, 58, 64, 44)); neonText(c, 'VIP', 170, 68, 90, '#ffe14d'); }), 0xffe14d);
  const sDance = X.sign('E', -7, 2.55, 0.8, A.add(384, 110, (c) => neonText(c, 'DANCE', 192, 58, 84, '#9d4dff', { maxW: 360 })), 0x9d4dff);
  X.sign('S', -8, 2.5, 0.8, A.add(512, 110, (c) => neonText(c, 'PARTY ALL NIGHT', 256, 58, 70, '#ff2fd0', { maxW: 490 })), 0xff2fd0);
  const sNoPh = X.sign('S', 8, 2.5, 0.7, A.add(384, 100, (c) => neonText(c, 'NO PHOTOS!', 192, 52, 64, '#ff5a3d', { maxW: 360 })), 0xff5a3d);
  // bar: back-bar shelves, an LED strip along the bar front
  backBar(X, -6.2, 4.2, '#5a2a40');
  S.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 10.8).translate(-12.38, 0.12, -1), basic(0x27e0ff)));
  X.pool(-12.1, -1, 1.4, 0x27e0ff, 0.12);
  X.glow.push(floorQ(-11.9, -1, 1.2, 11, 0.026), 0x27e0ff, 0.3);
  // table candles as soft pools, sofa up-lights
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.6, 0xff6ab0, 0.3);
  X.pool(12, 7, 2.8, 0x9d4dff, 0.35); X.pool(12, -7, 2.6, 0x27e0ff, 0.3);
  haze(X, 0x8a5aff, X.rich ? 22 : 14);

  // crowd: dancers on the floor, patrons at the bar and by the sofas, the DJ and a bartender
  const OUT = ['#ff2fd0', '#27e0ff', '#f2f2f2', '#ffe14d', '#9d4dff', '#1a1a1a', '#ff6a3d', '#3dff9a', '#e0e0ff'];
  for (let gi = 0; gi < 4; gi++) for (let gj = 0; gj < 4; gj++) {
    if ((gi === 1 && gj === 3) || (gi === 2 && gj === 1) || Math.random() < 0.12) continue;
    X.people.push({ x: -2.7 + gi * 1.8 + rnd(-0.35, 0.35), z: -2.2 + gj * 1.8 + rnd(-0.35, 0.35), rot: rnd(-3, 3), pose: 'dance', type: Math.random() < 0.5 ? 'dress' : 'suit', outfit: pickR(OUT) });
  }
  X.people.push(
    { x: -11.75, z: -4.3, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#ff2fd0' },
    { x: -11.8, z: 2.6, rot: -Math.PI / 2 + 0.3, pose: 'stand', type: 'suit', outfit: '#20203a' },
    { x: 10.4, z: 5.4, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#f2f2f2' },
    { x: 10.6, z: 8.8, rot: -Math.PI / 2 - 0.4, pose: 'dance', type: 'dress', outfit: '#27e0ff' },
    { x: -8, z: 8.6, rot: 0.9, pose: 'stand', type: 'dress', outfit: '#ffe14d' },
    { x: -7.2, z: 9.3, rot: -2.2, pose: 'stand', type: 'suit', outfit: '#1a1a1a' },
    { x: -8, z: -11.25, rot: 0, pose: 'dj', type: 'suit', outfit: '#101010', hairType: 'S', fixed: true },
    { x: -14.35, z: -2.5, rot: Math.PI / 2, pose: 'bar', type: 'suit', outfit: '#f0f0f0', fixed: true },
  );

  // the show
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
  let ledNext = 0;
  X.fx.push((t, dt, B) => {
    const pat = B.sec % 4, e = B.pulse, hueBase = (B.bar * 0.13) % 1;
    let sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const k = i * 6 + j, d = Math.hypot(i - 2.5, j - 2.5);
      let on, hue;
      if (pat === 0) { on = (i + j + B.n) % 2 === 0 ? 1 : 0.12; hue = hueBase + (B.n % 2) * 0.5; }
      else if (pat === 1) { on = Math.max(0.1, 1 - Math.abs(d - ((B.b * 2) % 5)) * 1.2); hue = hueBase + d * 0.08; }
      else if (pat === 2) { on = 0.35 + 0.65 * (Math.sin((i + j) * 0.9 - t * 6) * 0.5 + 0.5); hue = (i + j) / 12 + t * 0.15; }
      else { on = ((k * 7919 + B.n * 104729) % 11) < 4 ? 1 : 0.1; hue = ((k * 31 + B.n * 17) % 100) / 100; }
      const lum = on * (0.55 + 0.45 * e);
      tmpC.setHSL(((hue % 1) + 1) % 1, 0.95, 0.5).multiplyScalar(lum);
      tiles.setColorAt(k, tmpC);
      sumR += tmpC.r; sumG += tmpC.g; sumB += tmpC.b;
    }
    tiles.instanceColor.needsUpdate = true;
    X.glow.set(floorGlow, 0.45, tmpC.setRGB(sumR / 36, sumG / 36, sumB / 36));
    frame.material.color.setHSL((hueBase + 0.5) % 1, 1, 0.45 + 0.2 * e);
    // ball, specks, decks
    ball.rotation.y += dt * 0.8; speckPts.rotation.y -= dt * 0.35;
    ballGlow.c.setScalar(0.35 + 0.35 * e);
    for (const d of decks) d.rotation.y += dt * 3.5;
    // moving heads sweep in figure-eights; faster in the "drop" sections
    const sp = pat === 1 || pat === 3 ? 1.9 : 0.8;
    for (const hd of heads) {
      const a = t * sp + hd.ph;
      tmpV.set(Math.sin(a) * 3.2, 0, 0.5 + Math.sin(a * 2 + hd.ph) * 2.8);
      const from = hd.beam.position, dx = tmpV.x - from.x, dy = -from.y, dz = tmpV.z - from.z, L = Math.hypot(dx, dy, dz);
      hd.beam.quaternion.setFromUnitVectors(DOWN, tmpV.set(dx / L, dy / L, dz / L));
      hd.beam.scale.setScalar(L);
      hd.beam.material.uniforms.uI.value = 0.35 + 0.45 * e;
      hd.pool.position.set(from.x + dx, 0, from.z + dz);
      hd.pool.material.opacity = 1; hd.pool.material.color.copy(hd.col).multiplyScalar(0.35 + 0.4 * e);
    }
    if (lasers) {
      const on = B.sec % 2 === 1;
      lasers.visible = on;
      if (on) {
        lasers.rotation.set(0.12 + Math.sin(t * 1.3) * 0.07, 0.62 + Math.sin(t * 0.9) * 0.45, 0);
        lasers.material.color.set(B.bar % 2 ? 0x39ff6a : 0xff2a4a).multiplyScalar(0.6 + 0.4 * e);
      }
    }
    // LED wall: a spectrum on the beat, or scrolling bars (redrawn ~12x a second)
    if (t >= ledNext) {
      ledNext = t + 0.08;
      const c = ledC.getContext('2d');
      c.fillStyle = '#000'; c.fillRect(0, 0, 96, 32);
      for (let x = 0; x < 96; x += 3) {
        const v = Math.max(0.1, (0.35 + 0.6 * e) * (0.5 + 0.5 * Math.sin(x * 0.21 + t * 4) * Math.sin(x * 0.07 - t * 1.3)) + Math.random() * 0.15);
        const hgt = Math.round(v * 30);
        for (let y = 0; y < hgt; y += 2) { c.fillStyle = `hsl(${(hueBase * 360 + y * 7 + x) % 360},100%,55%)`; c.fillRect(x, 31 - y, 2, 1); }
      }
      if (pat === 3) { c.font = 'bold 20px Impact'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('VOLT', 48 + Math.sin(t * 2) * 20, 22); }
      ledT.needsUpdate = true;
    }
    tmpC.setHSL(hueBase, 1, 0.5); X.glow.set(ledHalo, 0.18 + 0.2 * e, tmpC);
    // signs: the bolt throbs to the kick, one tube buzzes
    X.signs.set(sVolt.s, 0.75 + 0.25 * e); X.glow.set(sVolt.h, 0.35 + 0.3 * e);
    X.signs.set(sNoPh.s, flicker(t, 3)); X.glow.set(sNoPh.h, 0.45 * flicker(t, 3));
    X.signs.set(sDance.s, B.n % 2 ? 1 : 0.55);
    // the house lights cycle colour every bar
    X.room.hall.forEach((l, i) => { l.color.setHSL((hueBase + i * 0.3) % 1, 1, 0.55); l.intensity = 14 + 26 * e; });
  });
}
