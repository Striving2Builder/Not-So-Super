// Nightlife venues built in code: the Nightclub, Gentlemen's Club, Red Light Den and High-Roller
// Suite. Entry points the zone calls: furnish (decor + show set-up), per-frame update, dispose.
// (The premade clubs, Triangle / Clubhouse / Velvet Lounge, are models: see clubzone.js.)
//   nlkit.js    shared toolbox (neon canvas art, merged additive batches, sign atlas, bulbs, beat)
//   nlroom.js   walls, floors, floor glow map, light rig
//   nlcrowd.js  instanced patrons
//   nlclub.js / nlgents.js / nlredlight.js / nlcasino.js   one venue each
import { makeKit, buildKit, beat } from './nlkit.js';
import { styleRoom, paintFloorGlow } from './nlroom.js';
import { buildCrowd, updateCrowd } from './nlcrowd.js';
import { nightclub } from './nlclub.js';
import { gentlemens } from './nlgents.js';
import { redlight } from './nlredlight.js';
import { casino } from './nlcasino.js';

export const NIGHTLIFE_KINDS = new Set(['club', 'gentlemens', 'redlight', 'casino']);

// Per venue: tempo of the show, the builder, the stock furniture's colours and what's on the
// tables (bar venues).
const VENUE = {
  club: { bpm: 126, build: nightclub, sofa: 0x2a1a4a, table: 0x2a1a2a, dress: ['glass', 'candle', 'glass', 'bottle'] },
  gentlemens: { bpm: 100, build: gentlemens, sofa: 0x4a1040, table: 0x1a0a0a, dress: ['bucket', 'glass', 'candle', 'glass'] },
  redlight: { bpm: 96, build: redlight, sofa: 0x6a1020, table: 0x2a1a2a, dress: ['candle', 'glass', 'ashtray', 'bottle'] },
  casino: { bpm: 92, build: casino },
};

/** Furnish a nightlife venue. `h` = the zone's decorating helpers { table, sofa, bar, spot, lam, basic }. */
export function decorateNightlife(zn, k, h) {
  const v = VENUE[k];
  const X = makeKit(zn, k);
  zn.nl = { k, X, bpm: v.bpm };
  X.room = styleRoom(zn, k);
  if (v.sofa !== undefined) {
    // the bar / sofas / tables every bar venue shares (item spots + colliders: gameplay layout)
    h.bar(-13, -1, 11, true);
    v.build(zn, X, h);
    h.sofa(12, 7, 5, -1, v.sofa);
    h.sofa(12, -7, 4, -1, v.sofa);
    for (let i = 0; i < 3; i++) { h.table(-5 + i * 5, 7, v.table); X.tableTop(-5 + i * 5, 7, 0.82, v.dress); }
    // glasses along the bar, clear of its three item spots
    for (const z of [-5.6, -2.6, 0.6, 3.7]) X.tableTop(-12.75, z, 1.16, ['glass', 'glass'], 0.12);
  } else v.build(zn, X, h);
  paintFloorGlow(X.room, X.paint);
  buildKit(X);
  X.crowd = buildCrowd(zn, X.people);
}

/** Per-frame: the beat, the show, the crowd. */
export function updateNightlife(zn, dt) {
  const nl = zn.nl;
  if (!nl || !nl.X) return;
  const X = nl.X, t = zn.t, B = beat(t, nl.bpm);
  for (const f of X.fx) f(t, dt, B);
  if (X.crowd) updateCrowd(X.crowd, zn, t, dt, B);
  if (X.bulbPts) {
    const a = X.bulbPts.geometry.attributes.color, arr = a.array;
    X.bulbs.forEach((b, i) => {
      if (b.flame) b.c.copy(b.base).multiplyScalar(0.7 + 0.2 * Math.sin(t * 13 + i * 5) + 0.1 * Math.sin(t * 31 + i));
      arr[i * 3] = b.c.r; arr[i * 3 + 1] = b.c.g; arr[i * 3 + 2] = b.c.b; });
    a.needsUpdate = true;
  }
  X.glow.flush(); X.signs.flush();
  const fl = X.room.follow, hp = zn.hero && zn.hero.position;
  if (hp) fl.position.set(hp.x, 2.6, hp.z + 0.6);
  // points are sized in world units: pixels per unit at distance 1
  if (X.pmat && zn.renderer) X.pmat.uniforms.uScale.value = zn.renderer.domElement.height / (2 * Math.tan((zn.cam.fov * Math.PI) / 360));
}

/**
 * Free what the zone's own teardown doesn't reach (it disposes geometry, materials and `.map`):
 * emissive maps and shader-uniform textures.
 */
export function disposeNightlife(zn) {
  const nl = zn.nl;
  if (!nl || !nl.X) return;
  zn.scene && zn.scene.traverse((o) => {
    for (const m of o.material ? [].concat(o.material) : []) {
      if (m.emissiveMap) m.emissiveMap.dispose();
      for (const u of Object.values(m.uniforms || {})) if (u.value && u.value.isTexture) u.value.dispose();
    }
  });
  zn.nl = null;
}
