// The river through the city (city.js `riverPath` / `riverBasin`) in 3D: a smooth ribbon of water
// along the river blocks (corner-cut, not the block staircase) out into the bay, an oval basin, a
// pale shore band and a thin ink shoreline, the sea's cel waves and glint, and bridges where the
// north-south streets cross it. The blue line you read from altitude.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { M, STYLE, Builder, box, lamp, look } from './buildings3d.js';
import { hash2 } from './rng.js';

const DECK = { y: 2.2, rail: 1.1, lampEvery: 18 }; // metres
const RIBBON = { width: 0.82, smooth: 4 };           // × the lot width; Chaikin passes

/** Chaikin corner cutting: the block-centre polyline becomes a gentle meander. */
function chaikin(P, n) {
  for (let k = 0; k < n; k++) {
    const out = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const [a, b] = [P[i], P[i + 1]];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(P[P.length - 1]);
    P = out;
  }
  return P;
}

/** The river's water material: the sea's shader plus a shore band and ink line across the ribbon. */
function riverMaterial(seaMat) {
  const m = seaMat.clone();
  m.uniforms = seaMat.uniforms; // shared, live
  m.vertexShader = 'attribute float aEdge; varying float vE; varying vec3 vW; void main(){ vE = aEdge; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  m.fragmentShader = m.fragmentShader
    .replace('varying vec3 vW;', 'varying vec3 vW; varying float vE;')
    .replace('#ifdef TONE_MAPPING', `  float e = abs(vE);
  c = mix(c, mix(vec3(0.82, 0.92, 1.0), vec3(0.3, 0.38, 0.6), uNight), smoothstep(0.8, 0.9, e) * 0.55); // shore band
  c = mix(c, vec3(0.06, 0.05, 0.09), smoothstep(0.93, 0.985, e));                                      // ink shoreline
#ifdef TONE_MAPPING`);
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4;
  return m;
}

export function buildRiver(city, scene, look3, seaMat) {
  if (!city.riverPath?.length) return null;
  const pos = [], edge = [], idx = [], Y = 0.5; // high enough over the ground tiles to never z-fight from altitude
  const cen = ([bx, by]) => [(bx * BLOCK + ROAD + LOT / 2) * M, (by * BLOCK + ROAD + LOT / 2) * M];
  // ---- the ribbon, extended west off the map and east out into the bay
  const P0 = city.riverPath.map(cen);
  P0.unshift([P0[0][0] - BLOCK * M * 2, P0[0][1]]);
  P0.push([city.coastX * M + 120, P0[P0.length - 1][1]]);
  const P = chaikin(P0, RIBBON.smooth), hw = (LOT * M * RIBBON.width) / 2;
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(P[i][0] - dz * hw, Y, P[i][1] + dx * hw, P[i][0] + dz * hw, Y, P[i][1] - dx * hw);
    edge.push(-1, 1);
    if (i) { const n = i * 2; idx.push(n - 2, n - 1, n + 1, n - 2, n + 1, n); }
  }
  // ---- the basin: an oval over its blocks and their river partners
  if (city.riverOval) {
    // the city's oval of whole river blocks, shrunk so the water never reaches a building's lot
    const E = city.riverOval, cx = (E.cx * BLOCK + ROAD / 2) * M, cz = (E.cy * BLOCK + ROAD / 2) * M;
    const rx = (E.rx - 0.75) * BLOCK * M, rz = (E.ry - 0.6) * BLOCK * M, base = pos.length / 3, n = 48;
    pos.push(cx, Y + 0.01, cz); edge.push(0);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, w = 1 + 0.06 * Math.sin(t * 3 + cx);
      pos.push(cx + Math.cos(t) * rx * w, Y + 0.01, cz + Math.sin(t) * rz * w); edge.push(1);
      idx.push(base, base + 1 + ((i + 1) % n), base + 1 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  const water = new THREE.Mesh(g, riverMaterial(seaMat));
  // ---- bridges: on about half the north-south streets crossing a river block run
  const B = new Builder(), D = look('#8a8478', '#ffd890', STYLE.concrete, '#4a4a50', STYLE.tar);
  for (const b of city.blocks) {
    if (!b.river || !city.block(b.bx + 1, b.by)?.river || hash2(b.bx, 0, 51) >= 0.5) continue;
    const x1 = (b.x0 + LOT) * M, z0 = (b.y0 - ROAD * 0.3) * M, z1 = (b.y0 + LOT + ROAD * 0.3) * M;
    bridge(B, D, x1, z0, x1 + ROAD * M, z1);
  }
  const deck = new THREE.Mesh(B.geometry(), look3.near), ink = new THREE.Mesh(B.inkGeometry(), look3.ink);
  scene.add(water, deck, ink);
  return { water, deck, ink };
}

/** A bridge along z over the strip [x0..x1]: deck, railings, lamps. */
function bridge(B, D, x0, z0, x1, z1) {
  const w = x1 - x0, a = x0 + w * 0.12, b = x1 - w * 0.12;
  box(B, a, z0, b, z1, DECK.y - 1.2, DECK.y, D, { ink: 1 });
  for (const x of [a, b - 0.4]) box(B, x, z0, x + 0.4, z1, DECK.y, DECK.y + DECK.rail, D, { ink: 0.7 });
  for (let z = z0; z <= z1; z += DECK.lampEvery) for (const x of [a, b]) lamp(B, x, DECK.y + 4, z, 0.4, '#ffd890');
}
