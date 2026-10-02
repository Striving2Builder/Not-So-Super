// The map's ground as seen from altitude (past the near baked tiles): a street-plan texture with
// district lots, parks and fields, landmark plazas, and avenues, plus a night twin where the avenue
// grid glows sodium-orange and the plazas are floodlit. So the street plan reads from high patrol.
import * as THREE from 'three';
import { BLOCK, ROAD, LOT } from './city.js';
import { DISTRICTS } from './data.js';
import { M, HAZE_GLSL } from './buildings3d.js';

const PX = 32 / BLOCK; // texture pixels per world unit (32 per block)

function plan(city, landmarks) {
  const W = Math.ceil(city.W * PX), H = Math.ceil(city.H * PX);
  const day = document.createElement('canvas'), night = document.createElement('canvas');
  day.width = night.width = W; day.height = night.height = H;
  const d = day.getContext('2d'), n = night.getContext('2d');
  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * PX, y * PX, w * PX, h * PX); };
  d.fillStyle = '#2a2a30'; d.fillRect(0, 0, W, H); // asphalt
  n.fillStyle = '#000'; n.fillRect(0, 0, W, H);
  // avenues glow at night: a warm line down each road, brighter at the crossings
  n.fillStyle = 'rgb(255,150,60)';
  for (let i = 0; i <= city.landCols; i++) n.fillRect((i * BLOCK + ROAD * 0.3) * PX, 0, ROAD * 0.4 * PX, city.H * PX);
  for (let j = 0; j <= city.rows; j++) n.fillRect(0, (j * BLOCK + ROAD * 0.3) * PX, city.coastX * PX, ROAD * 0.4 * PX);
  n.fillStyle = 'rgb(255,220,150)';
  for (let i = 0; i <= city.landCols; i++) for (let j = 0; j <= city.rows; j++) n.fillRect((i * BLOCK + ROAD * 0.2) * PX, (j * BLOCK + ROAD * 0.2) * PX, ROAD * 0.6 * PX, ROAD * 0.6 * PX);
  for (const b of city.blocks) {
    const D = DISTRICTS[b.d];
    // river blocks: green banks (the 3D ribbon of water lies on them, smoothly, not block-stepped)
    if (b.river) { R(d, b.x0 - ROAD / 2, b.y0 - ROAD / 2, LOT + ROAD, LOT + ROAD, '#4f7046'); continue; }
    R(d, b.x0, b.y0, LOT, LOT, D.lot);
    // the kerb: a pale line round each lot
    d.strokeStyle = 'rgba(255,255,255,.18)'; d.lineWidth = 1; d.strokeRect(b.x0 * PX + 0.5, b.y0 * PX + 0.5, LOT * PX - 1, LOT * PX - 1);
    for (const f of b.flats) {
      if (f.t === 'rect' || f.t === 'path') R(d, f.x, f.y, f.w, f.h, f.c);
      else if (f.t === 'field') R(d, f.x, f.y, f.w, f.h, f.c1);
      else if (f.t === 'pool') R(d, f.x, f.y, f.w, f.h, '#3aa8d8');
      else if (f.t === 'lot') R(d, f.x, f.y, f.w, f.h, '#4a4a50');
      else if (f.t === 'fountain') { d.fillStyle = '#7ac8e8'; d.beginPath(); d.arc(f.x * PX, f.y * PX, f.r * PX, 0, Math.PI * 2); d.fill(); }
    }
    // tree canopies as dark green dots (parks read from the air)
    d.fillStyle = '#2f5a2c';
    for (const o of b.b) if (o.kind === 'tree') { d.beginPath(); d.arc(o.x * PX, o.y * PX, Math.max(1.2, o.rad * PX), 0, Math.PI * 2); d.fill(); }
    // lit lots in the busy districts
    if (D.neon || b.d === 'downtown' || b.d === 'financial') { n.fillStyle = 'rgba(255,200,140,.18)'; n.fillRect(b.x0 * PX, b.y0 * PX, LOT * PX, LOT * PX); }
  }
  // landmark plazas: pale paving round the tower's block, a fountain, floodlit at night
  for (const lm of landmarks) {
    if (!lm.blk) continue;
    const b = lm.blk;
    R(d, b.x0 - ROAD * 0.35, b.y0 - ROAD * 0.35, LOT + ROAD * 0.7, LOT + ROAD * 0.7, '#cfc6b0');
    d.strokeStyle = '#8a8270'; d.lineWidth = 2;
    for (let k = 1; k < 4; k++) d.strokeRect((b.x0 + k * LOT / 8) * PX, (b.y0 + k * LOT / 8) * PX, (LOT - k * LOT / 4) * PX, (LOT - k * LOT / 4) * PX);
    n.fillStyle = 'rgba(255,240,200,.55)'; n.fillRect((b.x0 - ROAD * 0.35) * PX, (b.y0 - ROAD * 0.35) * PX, (LOT + ROAD * 0.7) * PX, (LOT + ROAD * 0.7) * PX);
  }
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; return t; };
  return { day: tex(day, true), night: tex(night, true) };
}

/** The land plane of the map, lit like the buildings and hazed like everything else. */
export function cityGround(city, U, landmarks) {
  const T = plan(city, landmarks), x1 = city.coastX * M, z1 = city.H * M;
  const g = new THREE.PlaneGeometry(x1, z1);
  g.rotateX(-Math.PI / 2); g.translate(x1 / 2, -0.25, z1 / 2);
  const uv = g.attributes.uv; // the canvas spans the whole city.W; the plane only the land
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (city.coastX / city.W));
  return new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { day: { value: T.day }, night: { value: T.night }, uKeyCol: U.uKeyCol, uAmbUp: U.uAmbUp, uNight: U.uNight, uLit: U.uLit, uHazeCol: U.uHazeCol, uHorizon: U.uHorizon, uHazeNear: U.uHazeNear, uHazeFar: U.uHazeFar },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
uniform sampler2D day; uniform sampler2D night; uniform vec3 uKeyCol; uniform vec3 uAmbUp; uniform float uNight; uniform float uLit;
${HAZE_GLSL}
varying vec2 vUv; varying vec3 vW;
void main() {
  vec3 c = texture2D(day, vUv).rgb * (uAmbUp + uKeyCol * 0.8) * (1. - uNight * 0.55) + texture2D(night, vUv).rgb * uLit * 0.5;
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  gl_FragColor.rgb = haze(gl_FragColor.rgb, length(vW - cameraPosition), 0., 1.);
}`,
  }));
}
