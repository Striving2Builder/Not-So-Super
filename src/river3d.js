// The river through the city (city.js `riverPath` / `riverBasin`) in 3D: a ribbon of water along
// the river blocks (corner-cut, not the block staircase) out into the bay, and the basin north of
// it. Both shores wander on their own (no pill-shaped sticker): the ribbon's width and each bank
// breathe with low-frequency noise along it, the basin's rim with a few harmonics. The water is a
// dark deep channel shading to teal shallows, tinted by the sky, with a thin foam lip and an ink
// shoreline (no wave-crest strokes: from altitude they read as road dashes). Bridges where the
// north-south streets cross it.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { M, STYLE, Builder, box, lamp, look, HAZE_GLSL } from './buildings3d.js';
import { hash2 } from './rng.js';

const DECK = { y: 2.2, rail: 1.1, lampEvery: 18 }; // metres
/** width: × the lot width; quay: the stone edge outside the water (× the half width); smooth: Chaikin passes; bank: per-bank wander [amplitude, wavelength m] ×3; rim: basin harmonics [k, amplitude]. */
const RIBBON = { width: 0.8, quay: 0.12, smooth: 4, bank: [[0.16, 61], [0.08, 23], [0.035, 8.5]], rim: [[2, 0.09], [3, 0.08], [5, 0.05], [7, 0.035], [11, 0.02]] };

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

/** A bank's wander at arc length s (metres): 1 ± a few percent, smooth. */
const bank = (s, ph) => 1 + RIBBON.bank.reduce((a, [amp, wl], k) => a + amp * Math.sin(s / wl + ph * (k + 1.7)), 0);
/** The basin rim's radius factor at angle t (the shader repeats it: keep the two in step). */
const RIM_GLSL = RIBBON.rim.map(([k, a], i) => `${a.toFixed(3)} * sin(${k}. * t + ${(i * 1.9 + 0.4).toFixed(2)})`).join(' + ');
const rim = (t) => 0.95 + RIBBON.rim.reduce((a, [k, amp], i) => a + amp * Math.sin(k * t + i * 1.9 + 0.4), 0);

/** The river's own water: deep channel → shallows, sky tint, glint, foam lip, ink shore. */
function riverMaterial(seaMat, basin, x1, basinQ) {
  const U = seaMat.uniforms;
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uBasin: { value: new THREE.Vector4(...basin) }, uBasinQ: { value: basinQ } },
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: 'attribute float aEdge; varying float vE; varying vec3 vW; void main(){ vE = aEdge; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform float uNight; uniform float uTime; uniform vec4 uBasin; uniform float uBasinQ;
${HAZE_GLSL}
varying vec3 vW; varying float vE;
void main() {
  // past the coast and the map's west edge the sea takes over (one water, no ribbon end)
  if (vW.x > ${x1.toFixed(1)} || vW.x < 0.) discard;
  // the shore distance: the ribbon's own, merged with the basin's where they overlap (no
  // shoreline across open water)
  float e = abs(vE);
  if (uBasin.z > 0.) {
    vec2 q = (vW.xz - uBasin.xy) / uBasin.zw;
    float t = atan(q.y, q.x);
    float eb = length(q) / (0.95 + ${RIM_GLSL});
    e = min(e, eb < 1. ? eb : 1. + (eb - 1.) * ${RIBBON.quay.toFixed(3)} / uBasinQ); // (its quay as wide as the ribbon's)
  }
  float dist = length(vW - cameraPosition);
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1. - max(V.y, 0.), 3.);
  // linear values: the haze lifts water a lot from altitude, so the channel starts near-black navy
  vec3 deep = mix(vec3(0.004, 0.02, 0.055), vec3(0.002, 0.008, 0.025), uNight);
  vec3 shallow = mix(vec3(0.02, 0.085, 0.11), vec3(0.008, 0.025, 0.045), uNight);
  vec3 c = mix(deep, shallow, smoothstep(0.4, 0.88, e));
  // the sky in it: a tint everywhere, the full colour at grazing angles
  c = mix(c, uSky * 0.5, 0.08 + 0.3 * fres);
  // slow broad swells in value only (no strokes), close up
  float w = sin(vW.x * 0.045 + uTime * 0.4 + sin(vW.z * 0.035) * 2.) * sin(vW.z * 0.055 - uTime * 0.3 + vW.x * 0.015);
  c *= 1. + 0.07 * w * (1. - smoothstep(150., 600., dist));
  vec3 R = reflect(-V, vec3(0., 1., 0.));
  c += uKeyCol * smoothstep(0.985, 0.996, dot(R, uKeyDir)) * 1.2;
  c = mix(c, mix(vec3(0.72, 0.84, 0.86), vec3(0.28, 0.34, 0.48), uNight), smoothstep(0.89, 0.93, e) * 0.3); // foam lip
  c = mix(c, vec3(0.06, 0.05, 0.09), smoothstep(0.93, 0.985, e));                                         // ink shoreline
  // the quay: a pale stone edge past the shoreline, its land side inked too (the banks read as a
  // made embankment, not a lawn running into the water)
  vec3 quay = mix(vec3(0.3, 0.28, 0.25), vec3(0.05, 0.05, 0.07), uNight * 0.75);
  quay = mix(quay, vec3(0.06, 0.05, 0.09), smoothstep(1. + ${(RIBBON.quay * 0.75).toFixed(3)}, 1. + ${(RIBBON.quay * 0.95).toFixed(3)}, e));
  c = mix(c, quay, step(1., e));
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  gRay = (vW - cameraPosition) / max(dist, 1e-3);
  gl_FragColor.rgb = haze(gl_FragColor.rgb, dist, 0., 1.);
}`,
  });
}

export function buildRiver(city, scene, look3, seaMat) {
  if (!city.riverPath?.length) return null;
  const pos = [], edge = [], idx = [], Y = 0.5; // high enough over the ground tiles to never z-fight from altitude
  const cen = ([bx, by]) => [(bx * BLOCK + ROAD + LOT / 2) * M, (by * BLOCK + ROAD + LOT / 2) * M];
  // ---- the ribbon, extended west off the map and east out into the bay
  const P0 = city.riverPath.map(cen);
  P0.unshift([P0[0][0] - BLOCK * M * 2, P0[0][1]]);
  P0.push([city.coastX * M + 120, P0[P0.length - 1][1]]);
  const P = chaikin(P0, RIBBON.smooth), hw = (LOT * M * RIBBON.width) / 2, ph = (city.seed % 97) * 0.13;
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const wl = hw * bank(s, ph), wr = hw * bank(s, ph + 2.3); // each bank wanders on its own
    const q = 1 + RIBBON.quay; // (the quay: a stone band outside the water's edge, e > 1)
    pos.push(P[i][0] - dz * wl * q, Y, P[i][1] + dx * wl * q, P[i][0] + dz * wr * q, Y, P[i][1] - dx * wr * q);
    edge.push(-q, q);
    if (i) { const n = i * 2; idx.push(n - 2, n - 1, n + 1, n - 2, n + 1, n); }
  }
  // ---- the basin over its blocks and their river partners, a wandering rim
  let basin = [0, 0, 0, 0], basinQ = 1;
  if (city.riverOval) {
    // the city's oval of whole river blocks, shrunk so the water never reaches a building's lot
    const E = city.riverOval, cx = (E.cx * BLOCK + ROAD / 2) * M, cz = (E.cy * BLOCK + ROAD / 2) * M;
    const rx = (E.rx - 0.6) * BLOCK * M, rz = (E.ry - 0.45) * BLOCK * M, base = pos.length / 3, n = 96;
    basin = [cx, cz, rx, rz]; basinQ = (RIBBON.quay * hw) / Math.min(rx, rz); // the quay in metres, as the ribbon's
    // a hair under the ribbon: where they overlap the ribbon wins (its shore distance already
    // knows the basin), so the basin's rim never draws a shoreline across the channel
    const yb = Y - 0.2;
    pos.push(cx, yb, cz); edge.push(9); // (its shore is the rim's own distance in the shader, not this)
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, w = rim(t) * (1 + basinQ);
      pos.push(cx + Math.cos(t) * rx * w, yb, cz + Math.sin(t) * rz * w); edge.push(9);
      idx.push(base, base + 1 + ((i + 1) % n), base + 1 + i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  const water = new THREE.Mesh(g, riverMaterial(seaMat, basin, city.coastX * M, basinQ));
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
