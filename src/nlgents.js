// Gentlemen's Club decor + show: the stage (spots, footlights, performer), velvet, gold, champagne.
import * as THREE from 'three';
import { SCRIPT, YAW, backBar, cnv, flicker, haze, neonText, onWall, tex, wallQ } from './nlkit.js';
export function gentlemens(zn, X, h) {
  const { lam, basic, table } = h, S = zn.scene;
  // stage (the original collider), in black lacquer with a gold lip and footlights
  zn.box(4, 0.5, 8, 11.5, 0.25, -3, lam(0x1a0a12));
  S.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 8.04).translate(9.49, 0.47, -3), basic(0xe0b040)));
  for (const z of [-7.2, 1.2]) zn.box(0.3, 3.2, 1.2, 13.2, 1.6, z, lam(0x7a1030), { collide: false });
  zn.cyl(0.05, 0.05, 2.9, 11.5, 1.95, -3, lam(0xf0e0b0, { emissive: 0x3a3020 }));
  for (let i = 0; i < 4; i++) {
    const x = 3 + (i % 2) * 3.5, z = -6 + Math.floor(i / 2) * 5;
    table(x, z, 0x1a1a1a);
    X.tableTop(x, z, 0.82, ['bucket', 'glass', 'glass', 'candle']);
  }
  // velvet rope along the stage lip: brass posts, red rope
  for (let i = 0; i <= 4; i++) {
    const z = -6.6 + i * 1.75;
    X.prop(new THREE.CylinderGeometry(0.035, 0.05, 0.9, 7).translate(9.0, 0.45, z), 0xd0a040);
    X.prop(new THREE.SphereGeometry(0.06, 7, 5).translate(9.0, 0.93, z), 0xf0c050);
    if (i < 4) X.prop(new THREE.CylinderGeometry(0.03, 0.03, 1.75, 5).rotateX(Math.PI / 2).translate(9.0, 0.8, z + 0.875), 0x9a1030);
  }
  // velvet curtain behind the stage (not across the office door)
  const velvet = tex(cnv(256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 8; i++) { g.addColorStop(i / 8, i % 2 ? '#2a0414' : '#8a1438'); }
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    const v = c.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,.55)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.2)');
    c.fillStyle = v; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#c09a34'; c.fillRect(0, 240, 256, 8);
  }), { repeat: true });
  velvet.repeat.set(3, 1);
  const [cx, , cz] = onWall('E', -4.4, 0, 0.05);
  S.add(new THREE.Mesh(wallQ(cx, 1.65, cz, 5.2, 3.3, YAW.E), lam(0xffffff, { map: velvet })));
  // spotlights on the stage: beams from the house, a hot pool on the boards
  X.cone(new THREE.Vector3(7.2, 3.4, -6.2), new THREE.Vector3(11.4, 0.5, -3.4), 1.1, 0xffc0e8, 0.55);
  X.cone(new THREE.Vector3(7.2, 3.4, 0.2), new THREE.Vector3(11.4, 0.5, -2.6), 1.1, 0xff66cc, 0.5);
  const stagePool = X.pool(11.4, -3, 2.1, 0xff88dd, 0.55, 0.52);
  X.pool(11.5, -3, 3.4, 0xff44cc, 0.2, 0.515);
  // footlights along the stage lip, chasing
  const foot = [];
  for (let z = -6.8; z <= 0.81; z += 0.38) foot.push(X.bulb(9.44, 0.56, z, 0.22, 0xffd890));
  // pole gleam
  X.bulb(11.5, 3.3, -3, 0.9, 0xffe0f0);
  // pink pendant glows over the tables
  for (let i = 0; i < 4; i++) {
    const x = 3 + (i % 2) * 3.5, z = -6 + Math.floor(i / 2) * 5;
    X.bulb(x, 2.7, z, 0.6, 0xff66cc); X.pool(x, z, 1.7, 0xff66cc, 0.3);
    X.cone(new THREE.Vector3(x, 2.7, z), new THREE.Vector3(x, 0.8, z), 0.7, 0xff66cc, 0.22);
  }
  for (let i = 0; i < 3; i++) X.pool(-5 + i * 5, 7, 1.5, 0xffb070, 0.25);
  X.pool(12, 7, 2.6, 0xcc66ff, 0.3);
  // gold sconces on the walls
  for (const [side, a] of [['N', -12], ['N', -4.5], ['N', 4.5], ['N', 12], ['S', -12], ['S', -6], ['S', 6], ['S', 12], ['W', -9], ['W', 8]]) {
    const [x, y, z] = onWall(side, a, 2.3, 0.1);
    X.bulb(x, y, z, 0.5, 0xffc070); X.halo(side, a, 2.3, 1.2, 1.6, 0xffa050, 0.35);
  }
  // signage
  const A = X.atlas;
  const sLive = X.sign('E', -4.4, 3.02, 0.55, A.add(512, 110, (c) => neonText(c, 'LIVE REVUE', 256, 58, 80, '#ff44cc', { maxW: 470 })), 0xff44cc, { streak: 0 });
  const lily = A.add(512, 150, (c) => neonText(c, 'The Gilded Lily', 256, 80, 96, '#ffc890', { font: SCRIPT, weight: '700', maxW: 490 }));
  const sLily = X.sign('N', -8, 2.4, 0.95, lily, 0xffc890);
  const sHang = X.hangSign(-3.2, 2.95, 8.1, 0.25, 0.8, lily, 0xffc890, { board: 0x1a0610 });
  const lilyBulbs = X.bulbFrame('N', -8, 2.4, 4.2, 1.3, 0xffd890);
  X.sign('N', 8, 2.45, 0.7, A.add(512, 110, (c) => neonText(c, 'CHAMPAGNE', 256, 58, 80, '#cc66ff', { maxW: 470 })), 0xcc66ff);
  X.sign('W', -1, 2.85, 0.6, A.add(256, 110, (c) => neonText(c, 'BAR', 128, 58, 84, '#ffc890')), 0xffc890);
  X.sign('S', -8, 2.5, 0.7, A.add(512, 110, (c) => neonText(c, 'VIP LOUNGE', 256, 58, 76, '#ff44cc', { maxW: 470 })), 0xff44cc);
  const sNoCam = X.sign('S', 8, 2.5, 0.65, A.add(384, 100, (c) => neonText(c, 'NO CAMERAS', 192, 52, 60, '#ffc890', { maxW: 360 })), 0xffc890);
  backBar(X, -6.2, 4.2, '#6a3010');
  haze(X, 0xff66cc, X.rich ? 18 : 12);

  // performer (sequins and a feather boa's worth of glamour, nothing more), patrons, bartender
  X.people.push(
    { x: 11.9, z: -3.4, y: 0.5, rot: -Math.PI / 2, pose: 'perform', type: 'dress', outfit: '#ffd24a', hair: '#e8c060', hairType: 'L', orbit: [11.5, -3], fixed: true, s: 1.02 },
    { x: 8.4, z: -6.0, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#1a1a24' },
    { x: 8.4, z: -4.3, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#3a2a1a' },
    { x: 8.5, z: -2.5, rot: Math.PI / 2 - 0.2, pose: 'stand', type: 'dress', outfit: '#c01848' },
    { x: 8.4, z: -0.8, rot: Math.PI / 2 - 0.2, pose: 'stand', type: 'suit', outfit: '#2a2a3a' },
    { x: 1.8, z: -6.3, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#20202a' },
    { x: 6.6, z: -7.2, rot: Math.PI / 2 - 0.5, pose: 'stand', type: 'dress', outfit: '#e0c060' },
    { x: 5.0, z: -0.1, rot: Math.PI / 2 + 0.3, pose: 'stand', type: 'suit', outfit: '#3a1a2a' },
    { x: -10.4, z: -3.2, rot: 2.4, pose: 'stand', type: 'dress', outfit: '#101010' },
    { x: 4.3, z: -6.8, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#111118' },
    { x: 2.2, z: -1.9, rot: Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#40203a' },
    { x: 7.6, z: -0.2, rot: Math.PI / 2 + 0.4, pose: 'stand', type: 'dress', outfit: '#cc2266' },
    { x: 10.5, z: 6.2, rot: -Math.PI / 2, pose: 'stand', type: 'dress', outfit: '#6a2aa0' },
    { x: 10.6, z: 8.2, rot: -Math.PI / 2 - 0.3, pose: 'stand', type: 'suit', outfit: '#1a1a1a' },
    { x: -11.8, z: 1.8, rot: -Math.PI / 2, pose: 'stand', type: 'suit', outfit: '#2a1a1a' },
    { x: -14.35, z: -1.5, rot: Math.PI / 2, pose: 'bar', type: 'dress', outfit: '#111111', fixed: true },
  );

  X.fx.push((t, dt, B) => {
    const e = B.pulse;
    foot.forEach((b, i) => b.c.setRGB(1, 0.85, 0.55).multiplyScalar((i + B.n) % 3 === 0 ? 0.9 : 0.35));
    lilyBulbs.forEach((b, i) => b.c.setRGB(1, 0.85, 0.55).multiplyScalar((i + Math.floor(t * 6)) % 4 === 0 ? 1 : 0.3));
    X.glow.set(stagePool, 0.45 + 0.2 * Math.sin(t * 1.3));
    X.signs.set(sLive.s, 0.8 + 0.2 * e); X.glow.set(sLive.h, 0.4 + 0.2 * e);
    X.signs.set(sNoCam.s, flicker(t, 5));
    X.glow.set(sLily.h, 0.45 + 0.1 * Math.sin(t * 2)); X.glow.set(sHang.h, 0.3 + 0.08 * Math.sin(t * 2));
    X.room.hall.forEach((l, i) => { l.intensity = 24 + Math.sin(t * 1.2 + i * 2) * 6 + e * 4; });
  });
}
