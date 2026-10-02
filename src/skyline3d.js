// The 3D city's horizon: the sea (and the river round the map) with cel wave bands and a sun/moon
// glint, the "city carpet" ground of the outer boroughs that runs on to the horizon (a street
// grid drawn in the shader: lots by day, sodium-lit avenues by night), and the haze patch for flat
// ground materials. No billboards: past the real geometry everything melts into the shared
// aerial-perspective haze (HAZE_GLSL), which ends on the sky dome's own horizon colour.
import * as THREE from 'three';
import { HAZE_GLSL } from './buildings3d.js';

/** Metres. pitch/road: the outer street grid (the city's own block pitch). */
export const OUTER = { river: 260, reach: 9000, pitch: 120, road: 26 };

const hazeU = (U) => ({ uHazeCol: U.uHazeCol, uHorizon: U.uHorizon, uHazeNear: U.uHazeNear, uHazeFar: U.uHazeFar });

const WORLD_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';

export class Horizon {
  /** U: the city's shared look uniforms. land: [x0, z0, x1, z1] of the map's land in metres. */
  constructor(scene, U, land) {
    this.scene = scene;
    const [x0, z0, x1, z1] = land, R = OUTER.river, E = OUTER.reach;
    // ---- the water: one sheet under everything (the bay east, the river round the other sides)
    const sea = new THREE.PlaneGeometry(2 * E + (x1 - x0), 2 * E + (z1 - z0), 1, 1);
    sea.rotateX(-Math.PI / 2); sea.translate((x0 + x1) / 2, -0.6, (z0 + z1) / 2);
    this.sea = new THREE.Mesh(sea, new THREE.ShaderMaterial({
      uniforms: { uKeyDir: U.uKeyDir, uKeyCol: U.uKeyCol, uNight: U.uNight, uTime: U.uTime, uSky: U.uSky, ...hazeU(U) },
      vertexShader: WORLD_VS,
      fragmentShader: /* glsl */`
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform float uNight; uniform float uTime;
${HAZE_GLSL}
varying vec3 vW;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1. - max(V.y, 0.), 4.);
  // pulp blue water that reads against the city from any height: saturated body, sky in it at
  // grazing angles, comic wave-crest strokes (filtered out with distance), city lights by night
  vec3 deep = mix(vec3(0.03, 0.2, 0.52), vec3(0.012, 0.05, 0.15), uNight);
  vec3 c = mix(deep, uSky * 0.9, 0.06 + 0.4 * fres);
  float dist = length(vW - cameraPosition);
  float w = sin(vW.x * 0.07 + uTime * 0.5 + sin(vW.z * 0.03) * 2.) * sin(vW.z * 0.09 - uTime * 0.35 + vW.x * 0.02);
  float near = 1. - smoothstep(250., 1400., dist);
  c = mix(c, mix(vec3(0.7, 0.85, 1.), vec3(0.25, 0.3, 0.5), uNight), step(0.9, w) * 0.45 * near);
  c *= 0.94 + 0.08 * step(0.35, w) * near;
  c += vec3(1., 0.75, 0.4) * step(0.94, h21(floor(vW.xz / 6.) + floor(uTime * 1.5))) * uNight * 0.5 * near;
  // the glint: a hard comic streak toward the sun/moon, broken into sparkles at its edges
  vec3 R = reflect(-V, vec3(0., 1., 0.));
  float g = dot(R, uKeyDir);
  float sp = step(0.86, h21(floor(vW.xz / 3.) + floor(uTime * 3.))) * smoothstep(0.86, 0.97, g) * (1. - smoothstep(400., 1200., dist));
  c += uKeyCol * (smoothstep(0.985, 0.995, g) * 1.4 + sp * 0.9);
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  gl_FragColor.rgb = haze(gl_FragColor.rgb, dist, 0., 1.);
}`,
    }));
    scene.add(this.sea);
    // ---- the outer boroughs' ground: everything outside map + river, except the bay (east)
    const quads = [
      [x0 - R - E, z0 - R - E, x0 - R, z1 + R + E], // west
      [x0 - R, z0 - R - E, x1, z0 - R],             // north
      [x0 - R, z1 + R, x1, z1 + R + E],             // south
    ];
    const pos = [], idx = [];
    for (const [a, b, c, d] of quads) {
      const n = pos.length / 3;
      pos.push(a, -0.3, b, a, -0.3, d, c, -0.3, d, c, -0.3, b);
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.carpetMat = carpet(U);
    this.carpet = new THREE.Mesh(g, this.carpetMat);
    this.carpet.frustumCulled = false;
    scene.add(this.carpet);
  }

  /** Extra ground patches on the carpet (the bay islands): [[x, z] ...] polygons, fan-triangulated. */
  addLand(polys) {
    const pos = [], idx = [];
    for (const P of polys) {
      const n = pos.length / 3;
      let cx = 0, cz = 0;
      for (const [x, z] of P) { cx += x / P.length; cz += z / P.length; }
      pos.push(cx, -0.3, cz);
      for (const [x, z] of P) pos.push(x, -0.3, z);
      for (let i = 0; i < P.length; i++) idx.push(n, n + 1 + ((i + 1) % P.length), n + 1 + i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    this.scene.add(new THREE.Mesh(g, this.carpetMat));
  }
}

/** The outer street grid, all in the shader: lots and avenues by day, lit avenue grid by night. */
function carpet(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uKeyCol: U.uKeyCol, uAmbUp: U.uAmbUp, uNight: U.uNight, uLit: U.uLit, ...hazeU(U) },
    vertexShader: WORLD_VS,
    fragmentShader: /* glsl */`
uniform vec3 uKeyCol; uniform vec3 uAmbUp; uniform float uNight; uniform float uLit;
${HAZE_GLSL}
varying vec3 vW;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = vW.xz / ${OUTER.pitch}.;
  vec2 cell = floor(p), f = fract(p), fw = fwidth(p);
  const float RD = ${(OUTER.road / OUTER.pitch).toFixed(4)};
  // road coverage, box-filtered so the grid fades to its average instead of aliasing
  vec2 r = clamp((RD - f) / max(fw, 1e-4) + 0.5, 0., 1.);
  vec2 avgR = vec2(RD);
  r = mix(r, avgR, smoothstep(0.25, 0.6, fw));
  float road = max(r.x, r.y);
  float h = h21(cell);
  vec3 lot = h < 0.12 ? vec3(0.28, 0.42, 0.24) : mix(vec3(0.42, 0.4, 0.38), vec3(0.5, 0.36, 0.3), step(0.6, h));
  vec3 day = mix(lot, vec3(0.17, 0.17, 0.2), road) * (uAmbUp + uKeyCol * 0.8);
  // night: sodium avenues and a scatter of lit lots
  vec3 glow = vec3(1., 0.62, 0.25) * road * 0.8 + vec3(1., 0.8, 0.5) * step(0.55, h) * (1. - road) * 0.07;
  vec3 c = day * (1. - uNight * 0.6) + glow * uLit;
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  gl_FragColor.rgb = pulp(gl_FragColor.rgb);
  gl_FragColor.rgb = haze(gl_FragColor.rgb, length(vW - cameraPosition), 0., 1.);
}`,
  });
}

/** Ground-level haze for flat MeshBasic ground: same aerial perspective as everything else. */
export function haze(mat, U) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, hazeU(U));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${HAZE_GLSL}`)
      .replace('#include <fog_fragment>', `
#ifdef USE_FOG
  gl_FragColor.rgb = haze(gl_FragColor.rgb, vFogDepth, 0., 1.);
#endif`);
  };
  mat.customProgramCacheKey = () => 'cityHaze';
  return mat;
}
