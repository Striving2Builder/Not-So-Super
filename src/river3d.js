// The river through the city (city.js `blk.river`) in 3D: water with the sea's cel waves and glint
// over each river block and under the streets between them, an embankment wall along its banks,
// and bridges on about half the streets that cross it (deck, inked railings, lamps). A landmark you read
// from altitude: the blue ribbon cutting the grid.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { M, STYLE, Builder, box, lamp, look } from './buildings3d.js';
import { hash2 } from './rng.js';

const DECK = { y: 2.2, rail: 1.1, lampEvery: 18 }; // metres

export function buildRiver(city, scene, look3, waterMat) {
  const pos = [], idx = [];
  const quad = (x0, z0, x1, z1) => {
    const n = pos.length / 3;
    pos.push(x0, 0.08, z0, x0, 0.08, z1, x1, 0.08, z1, x1, 0.08, z0);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const B = new Builder();
  const D = look('#8a8478', '#ffd890', STYLE.concrete, '#4a4a50', STYLE.tar), W = look('#a8a090', '#000', STYLE.brick, '#a8a090');
  const riv = (bx, by) => city.block(bx, by)?.river || (bx >= city.landCols && by >= 0 && by < city.rows);
  for (const b of city.blocks) {
    if (!b.river) continue;
    const x0 = b.x0 * M, z0 = b.y0 * M, x1 = (b.x0 + LOT) * M, z1 = (b.y0 + LOT) * M, r = ROAD * M;
    quad(x0, z0, x1, z1);
    // banks: a low embankment wall where the river meets land
    if (!riv(b.bx, b.by - 1)) box(B, x0, z0 - 0.6, x1, z0, -1, 0.6, W, { roof: true, ink: 0.8 });
    if (!riv(b.bx, b.by + 1)) box(B, x0, z1, x1, z1 + 0.6, -1, 0.6, W, { roof: true, ink: 0.8 });
    if (!riv(b.bx - 1, b.by)) box(B, x0 - 0.6, z0, x0, z1, -1, 0.6, W, { roof: true, ink: 0.8 });
    if (!riv(b.bx + 1, b.by)) box(B, x1, z0, x1 + 0.6, z1, -1, 0.6, W, { roof: true, ink: 0.8 });
    // water under the streets between river blocks (and the crossing between four of them); a
    // bridge only on north-south streets (they cross the east-flowing river), about every other one
    if (riv(b.bx + 1, b.by)) {
      quad(x1, z0, x1 + r, z1);
      if (hash2(b.bx, 0, 51) < 0.5) bridge(B, D, x1, z0, x1 + r, z1, true);
    }
    if (riv(b.bx, b.by + 1)) quad(x0, z1, x1, z1 + r);
    if (riv(b.bx + 1, b.by) && riv(b.bx, b.by + 1) && riv(b.bx + 1, b.by + 1)) quad(x1, z1, x1 + r, z1 + r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const water = new THREE.Mesh(g, waterMat);
  const deck = new THREE.Mesh(B.geometry(), look3.near), ink = new THREE.Mesh(B.inkGeometry(), look3.ink);
  scene.add(water, deck, ink);
  return { water, deck, ink };
}

/**
 * A bridge over the street strip [x0..x1] x [z0..z1]: the street runs along z when `alongZ` (the
 * strip is between two river blocks side by side), else along x. Deck, railings, lamps.
 */
function bridge(B, D, x0, z0, x1, z1, alongZ) {
  const w = alongZ ? x1 - x0 : z1 - z0, inset = w * 0.12;
  if (alongZ) {
    const a = x0 + inset, b = x1 - inset;
    box(B, a, z0 - 2, b, z1 + 2, DECK.y - 1.2, DECK.y, D, { ink: 1 });
    for (const x of [a, b - 0.4]) box(B, x, z0 - 2, x + 0.4, z1 + 2, DECK.y, DECK.y + DECK.rail, D, { ink: 0.7 });
    for (let z = z0; z <= z1; z += DECK.lampEvery) for (const x of [a, b]) lamp(B, x, DECK.y + 4, z, 0.4, '#ffd890');
  } else {
    const a = z0 + inset, b = z1 - inset;
    box(B, x0 - 2, a, x1 + 2, b, DECK.y - 1.2, DECK.y, D, { ink: 1 });
    for (const z of [a, b - 0.4]) box(B, x0 - 2, z, x1 + 2, z + 0.4, DECK.y, DECK.y + DECK.rail, D, { ink: 0.7 });
    for (let x = x0; x <= x1; x += DECK.lampEvery) for (const z of [a, b]) lamp(B, x, DECK.y + 4, z, 0.4, '#ffd890');
  }
}
