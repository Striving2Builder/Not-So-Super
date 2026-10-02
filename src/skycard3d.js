// The far skyline card: two layers of city silhouettes (thinly inked) standing ON the horizon line,
// out past the last real geometry. It rides with the camera at eye level, so from any altitude its
// base sits on the horizon and only the tops break it (a cardboard wall rising above the horizon
// read as a fishbowl); its base melts into the horizon colour, its body is a shade of the haze.
import * as THREE from 'three';

const CARD = { segs: 64, repeat: 4, below: 0.012, above: 0.026, r: [2600, 4300] }; // below/above: of the radius

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
    this.U = { map: { value: silhouettes() }, uHazeCol: U.uHazeCol, uHorizon: U.uHorizon, uInk: U.uInk };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.U, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
uniform sampler2D map; uniform vec3 uHazeCol; uniform vec3 uHorizon; uniform vec3 uInk;
varying vec2 vUv;
void main() {
  vec3 m = texture2D(map, vUv).rgb;
  if (m.r + m.g < 0.4) discard;
  vec3 back = mix(uHorizon, uHazeCol, 0.55) * 0.95, front = uHazeCol * 0.86;
  vec3 c = m.g > 0.5 ? front : back;
  c = mix(c, mix(c, uInk, 0.45), m.b);          // thin ink edge
  c = mix(uHorizon, c, smoothstep(0.0, ${(CARD.below / (CARD.below + CARD.above) + 0.12).toFixed(3)}, vUv.y)); // base melts into the horizon
  gl_FragColor = vec4(c, 1.);
}`,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
    scene.add(this.mesh);
  }

  /** Ride with the camera at eye level, just past the haze's end. */
  update(cam, hazeFar) {
    const R = Math.min(CARD.r[1], Math.max(CARD.r[0], hazeFar * 1.02));
    this.mesh.position.set(cam.position.x, cam.position.y - R * CARD.below, cam.position.z);
    this.mesh.scale.set(R, R * (CARD.below + CARD.above), R);
  }
}
