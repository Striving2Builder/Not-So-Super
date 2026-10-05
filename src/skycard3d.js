// The far skyline card: two layers of city silhouettes (thinly inked) standing ON the horizon line,
// out past the last real geometry. It rides with the camera at eye level, so from any altitude its
// base sits on the horizon and only the tops break it (a cardboard wall rising above the horizon
// read as a fishbowl); its base melts into the horizon colour, its body is a shade of the haze.
import * as THREE from 'three';
import { HAZE_GLSL } from './buildings3d.js';
import { hazeU } from './skyline3d.js';

const CARD = { segs: 64, repeat: 4, below: 0.012, above: 0.026, r: [2600, 4300], minEye: 100 }; // below/above: of the radius

function silhouettes() {
  const W = 2048, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  // R: back layer (taller, clustered boroughs), G: front layer (lower, broken)
  const layer = (fill, minH, maxH, gap, phase) => {
    let x = 0;
    while (x < W) {
      const w = 8 + rnd() * 26, cl = 0.35 + 0.65 * Math.sin((x / W) * Math.PI * 2 * 3 + phase) ** 2;
      const h = minH + rnd() * (maxH - minH) * cl;
      g.fillStyle = fill;
      g.fillRect(x, H - h, w, h);
      if (rnd() < 0.35) g.fillRect(x + w * 0.25, H - h * 1.12, w * 0.5, h * 0.12); // setback
      if (rnd() < 0.18) { g.beginPath(); g.moveTo(x + w * 0.2, H - h); g.lineTo(x + w * 0.5, H - h * 1.35); g.lineTo(x + w * 0.8, H - h); g.fill(); } // spire
      x += w + rnd() * gap;
    }
  };
  layer('rgb(255,0,0)', 30, 110, 4, 0);
  layer('rgb(0,255,0)', 12, 70, 18, 1.7);
  g.globalCompositeOperation = 'source-over';
  // B: a thin ink line round every silhouette (pixels where either layer's mask changes)
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const at = (x, y, ch) => d[(((y + H) % H) * W + ((x + W) % W)) * 4 + ch] > 127;
  const ink = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) for (const ch of [0, 1]) {
    const v = at(x, y, ch);
    if (v && (!at(x - 1, y, ch) || !at(x + 1, y, ch) || !at(x, y - 1, ch))) ink[y * W + x] = 255;
  }
  for (let i = 0; i < W * H; i++) d[i * 4 + 2] = ink[i];
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export class SkyCard {
  constructor(scene, U) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, CARD.segs, 1, true);
    geo.translate(0, 0.5, 0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * CARD.repeat);
    this.tex = silhouettes();
    this.U = { map: { value: this.tex }, uHazeCol: U.uHazeCol, uHorizon: U.uHorizon, uInk: U.uInk };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.U, side: THREE.BackSide, depthWrite: false, transparent: true, // blended, no discard: early depth rejection stays on
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
uniform sampler2D map; uniform vec3 uHazeCol; uniform vec3 uHorizon; uniform vec3 uInk;
varying vec2 vUv;
void main() {
  vec3 m = texture2D(map, vUv).rgb;
  float a = clamp((m.r + m.g) * 2. - 0.6, 0., 1.);
  vec3 back = mix(uHorizon, uHazeCol, 0.6) * 0.88, front = uHazeCol * 0.74;
  vec3 c = m.g > 0.5 ? front : back;
  // behind the silhouettes: a warm glow band hugging the horizon line, fading up into the sky
  float hz = ${(CARD.below / (CARD.below + CARD.above)).toFixed(3)};
  float glow = (1. - smoothstep(hz, 1., vUv.y)) * smoothstep(hz - 0.2, hz, vUv.y) * 0.55;
  if (a < 0.01) { gl_FragColor = vec4(mix(uHorizon, vec3(1., 0.93, 0.8), 0.4), glow); return; }
  c = mix(c, mix(c, uInk, 0.45), m.b);          // thin ink edge
  c = mix(uHorizon, c, smoothstep(0.0, ${(CARD.below / (CARD.below + CARD.above) + 0.12).toFixed(3)}, vUv.y)); // base melts into the horizon
  gl_FragColor = vec4(c, a);
}`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; // after the city: only the pixels the towers leave are shaded
    scene.add(this.mesh);
  }

  /** Ride with the camera at eye level, just past the haze's end. */
  update(cam, hazeFar) {
    // down among the towers the horizon is hidden anyway: skip its fill cost there
    this.mesh.visible = cam.position.y > CARD.minEye;
    const R = Math.min(CARD.r[1], Math.max(CARD.r[0], hazeFar * 1.02));
    this.mesh.position.set(cam.position.x, cam.position.y - R * CARD.below, cam.position.z);
    this.mesh.scale.set(R, R * (CARD.below + CARD.above), R);
  }
}

/**
 * The far ring: a cylinder from the ground up to eye level, RING.r out, riding with the camera. It
 * stands in for all the ground past it (the camera's far plane ends at 4.5 km): each ray's air
 * (the ground haze grading up into the horizon colour, the same airAt() as the city's haze) and four
 * layers of borough silhouettes standing on the ground at virtual distances past the ring, on land
 * only (the bay stays open water, the islands get theirs), inked, with lit window clusters at
 * night. From high patrol it fills the band between the last real block and the horizon that was
 * one flat pale plate. One draw, one texture fetch per layer, early-z behind the city.
 * layers: [distance × r, tallest (m), how far the silhouette darkens off the air, texture repeat].
 */
const RING = { r: 4300, segs: 48, minEye: 80, layers: [[1.12, 110, 0.42, 7], [1.45, 150, 0.36, 5], [1.95, 200, 0.29, 4], [2.8, 260, 0.22, 3]], win: [14, 9], dip: [0.03, 0.07] }; // win: lit cluster cell (m); dip: ray slopes the layers fade out over

function ringLayer([k, hm, dk, rep], i) {
  return `  {
    // layer ${i}: the ray's height where it passes ${k} x the ring's radius out
    float D = ${(k * RING.r).toFixed(1)}, y = cameraPosition.y + slope * D;
    if (y > 0. && y < ${hm.toFixed(1)} && land(cameraPosition.xz + ray.xz / hl * D)) {
      vec3 m = textureLod(map, vec2(az * ${rep}. + ${(i * 0.37).toFixed(2)}, y / ${hm.toFixed(1)}), 0.).rgb;
      if (${i % 2 ? 'm.r' : 'm.g'} > 0.5) {
        vec3 s = mix(c, uHazeLow * 0.6, ${dk.toFixed(2)} * mix(0.7, 1., uNight)); // (softer by day: rows of teeth otherwise)
        s = mix(s, uInk, m.b * ${(dk * 0.5).toFixed(2)});
        // lit window clusters at night: a few warm specks per tower, dimmer on the far layer
        vec2 cell = floor(vec2(az * 6.2832 * D / ${RING.win[0]}., y / ${RING.win[1]}.));
        s += vec3(1., 0.72, 0.42) * step(h12(cell + ${i}.), 0.11) * uLit * uLit * ${(0.5 - i * 0.08).toFixed(2)};
        // grounded: the base melts into the ground haze, and a layer seen well below the horizon
        // (from high patrol) fades out: darker than the hazed city in front of it, it read as
        // a strip of skyline floating in the fog
        c = mix(c, s, smoothstep(0., ${(hm * 0.35).toFixed(1)}, y) * (1. - smoothstep(${RING.dip[0]}, ${RING.dip[1]}, -slope)));
      }
    }
  }`;
}

export class FarRing {
  /** tex: the skyline card's silhouette mask (R back, G front, B ink); coast: the bay's west shore x (m); islands: [[cx, cz, rx, rz]]. */
  constructor(scene, U, tex, coast, islands) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, RING.segs, 1, true);
    geo.translate(0, 0.5, 0);
    const I = islands.slice(0, 2).map(([x, z, rx, rz]) => new THREE.Vector4(x, z, rx, rz));
    while (I.length < 2) I.push(new THREE.Vector4(0, 0, 1e-3, 1e-3));
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uInk: U.uInk, uNight: U.uNight, uLit: U.uLit, uCoast: { value: coast }, uIsle: { value: I }, ...hazeU(U) },
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`
uniform sampler2D map; uniform vec3 uInk; uniform float uNight; uniform float uLit; uniform float uCoast; uniform vec4 uIsle[2];
${HAZE_GLSL}
varying vec3 vW;
float h12(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
bool land(vec2 p) {
  if (p.x < uCoast) return true;
  for (int i = 0; i < 2; i++) { vec2 q = (p - uIsle[i].xy) / uIsle[i].zw; if (dot(q, q) < 0.8) return true; }
  return false;
}
void main() {
  vec3 ray = vW - cameraPosition;
  gRay = normalize(ray);
  float hl = max(length(ray.xz), 1.), slope = ray.y / hl;
  vec3 c = airAt(1., clamp(-ray.y / length(ray), 0., 1.));
  float az = atan(ray.z, ray.x) / 6.2832 + 0.5;
  if (-slope < ${RING.dip[1]}) { // (steeper rays: every layer has faded out)
${RING.layers.map(ringLayer).reverse().join('\n')}
  }
  gl_FragColor = vec4(c, 1.);
}`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1; // after the city: early depth rejection leaves only the pixels it shows
    scene.add(this.mesh);
  }

  update(cam) {
    const y = cam.position.y;
    this.mesh.visible = y > RING.minEye;
    this.mesh.position.set(cam.position.x, 0, cam.position.z);
    this.mesh.scale.set(RING.r, y, RING.r);
  }
}
