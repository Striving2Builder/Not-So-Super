// Nightlife venues built in code: the Nightclub, Gentlemen's Club, Red Light Den and High-Roller
// Suite. Their decor (placed through the zone's building helpers) and their per-frame show.
// (The premade clubs, Triangle / Clubhouse / Velvet Lounge, are models: see clubzone.js.)
import * as THREE from 'three';

export const NIGHTLIFE_KINDS = new Set(['club', 'gentlemens', 'redlight', 'casino']);

/** Furnish a nightlife venue. `h` = the zone's decorating helpers { table, sofa, bar, spot, lam, basic }. */
export function decorateNightlife(zn, k, h) {
  const { table, sofa, bar, spot, lam, basic } = h;
  zn.nl = { tiles: null, ball: null };
  if (k === 'club' || k === 'gentlemens' || k === 'redlight') {
      bar(-13, -1, 11, true);
      if (k === 'club') {
        zn.nl.tiles = [];
        for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), basic(0xffffff));
          m.rotation.x = -Math.PI / 2; m.position.set(-3 + i * 1.2 + 0.6 - 0.6, 0.02, -2.5 + j * 1.2);
          zn.scene.add(m); zn.nl.tiles.push(m);
        }
        zn.nl.ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), lam(0xdddddd, { emissive: 0x555555 }));
        zn.nl.ball.position.set(0, 3.1, 0.5); zn.scene.add(zn.nl.ball);
        zn.box(3.5, 1.2, 1.4, -8, 0.6, -10.2, lam(0x222233));
        zn.box(3.3, 0.1, 1.2, -8, 1.25, -10.2, basic(0x27e0ff), { collide: false });
        for (const x of [-10.5, -5.5]) zn.box(0.9, 2, 0.9, x, 1, -10.8, lam(0x111111));
      }
      if (k === 'gentlemens') {
        zn.box(4, 0.5, 8, 11.5, 0.25, -3, lam(0x3a1a2a));
        for (const z of [-7.2, 1.2]) zn.box(0.3, 3.2, 1.2, 13.2, 1.6, z, lam(0xa0204a), { collide: false });
        zn.cyl(0.06, 0.06, 3, 11.5, 1.5, -3, lam(0xdddddd));
        for (let i = 0; i < 4; i++) table(3 + (i % 2) * 3.5, -6 + Math.floor(i / 2) * 5, 0x1a1a1a);
      }
      if (k === 'redlight') {
        for (let i = 0; i < 6; i++) {
          const x = -12 + i * 4.8;
          zn.box(1.6, 3.2, 0.2, x, 1.6, 11.7, lam(0xb01030), { collide: false });
          const lan = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), basic(0xff3355));
          lan.position.set(x, 2.8, 10.5); zn.scene.add(lan);
        }
        for (let i = 0; i < 3; i++) table(4 + i * 3.2, -6, 0x5a0a1a);
      }
      sofa(12, 7, 5, -1, k === 'redlight' ? 0x8a1a2a : 0x4a2a6a);
      sofa(12, -7, 4, -1, k === 'redlight' ? 0x8a1a2a : 0x4a2a6a);
      for (let i = 0; i < 3; i++) table(-5 + i * 5, 7);
  }
  if (k === 'casino') {
      for (let i = 0; i < 4; i++) {
        const x = -7 + (i % 2) * 8, z = -5 + Math.floor(i / 2) * 8;
        zn.cyl(1.5, 1.5, 0.1, x, 0.85, z, lam(0x1a6a3a));
        zn.cyl(0.25, 0.3, 0.85, x, 0.42, z, lam(0x3a2410), true);
        zn.colliders.push({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 1.5, maxZ: z + 1.5 });
        spot(x + 0.6, 0.92, z);
      }
      for (let i = 0; i < 6; i++) {
        zn.box(0.9, 1.9, 0.8, -13.6, 0.95, -8 + i * 2, lam(0x8a1a2a));
        zn.box(0.05, 0.6, 0.6, -13.1, 1.3, -8 + i * 2, basic(0xffd84d), { collide: false });
      }
      const ch = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), basic(0xfff1c0));
      ch.position.set(0, 3.1, 0); zn.scene.add(ch);
      bar(11, 4, 7, true);
      }
}

/** Per-frame: dance floor colours, mirror ball, pulsing coloured lights. */
export function updateNightlife(zn, dt) {
  const nl = zn.nl;
  if (!nl) return;
  if (nl.tiles) nl.tiles.forEach((m, i) => m.material.color.setHSL(((i * 0.13 + zn.t * 0.3) % 1), 0.9, 0.5 + 0.2 * Math.sin(zn.t * 6 + i)));
  if (nl.ball) nl.ball.rotation.y += dt;
  if (zn.V.kind === 'club' || zn.V.kind === 'redlight') zn.plights.forEach((l, i) => { l.intensity = 22 + Math.sin(zn.t * 4 + i * 2) * 10; });
}
