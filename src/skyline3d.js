// The 3D city's horizon: a ring of distant skyline silhouettes standing in the haze at the fog
// line (it follows the camera, so it's always "the next borough over" and the metropolis never
// ends), a sea with cel wave bands and a sun/moon glint, and ground haze for the flat ground
// layers so the streets melt into the sky colour before the towers do.
import * as THREE from 'three';

const RING = { segs: 72, repeat: 5, tall: 0.1, min: 1100, max: 3300 }; // tall = height / radius

function skylineTexture() {
  const W = 2048, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  // R: back layer (paler, taller clusters), G: front layer, B: lit windows on the front layer
  const layer = (chan, minH, maxH, gap) => {
    let x = 0;
    while (x < W) {
      const w = 10 + rnd() * 34, cluster = 0.5 + 0.5 * Math.sin(x / W * Math.PI * 2 * 3 + chan) ** 2;
      const h = minH + rnd() * (maxH - minH) * cluster;
      g.fillStyle = chan === 0 ? 'rgb(255,0,0)' : 'rgb(0,255,0)';
      g.fillRect(x, H - h, w, h);
      if (rnd() < 0.3) g.fillRect(x + w * 0.3, H - h - h * 0.12, w * 0.4, h * 0.12); // setback
      if (rnd() < 0.15) g.fillRect(x + w * 0.48, H - h - h * 0.3, 2, h * 0.3); // spire
      if (chan === 1) {
        g.fillStyle = 'rgb(0,0,255)';
        for (let yy = H - h + 4; yy < H - 4; yy += 6) for (let xx = x + 2; xx < x + w - 2; xx += 5) if (rnd() < 0.18) g.fillRect(xx, yy, 2, 2);
      }
      x += w + rnd() * gap;
    }
  };
  layer(0, 60, 230, 6);
  layer(1, 25, 150, 30);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

export class Horizon {
  /** U: the city's shared look uniforms (key light, night, time). */
  constructor(scene, U, city, M) {
    this.scene = scene;
    // ---- skyline ring
    const geo = new THREE.CylinderGeometry(1, 1, 1, RING.segs, 1, true);
    geo.translate(0, 0.5, 0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * RING.repeat);
    this.ringU = { map: { value: skylineTexture() }, fogColor: { value: new THREE.Color() }, uNight: U.uNight, uSky: U.uSky };
    this.ring = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.ringU, side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */`
uniform sampler2D map; uniform vec3 fogColor; uniform float uNight;
varying vec2 vUv;
void main() {
  vec3 m = texture2D(map, vUv).rgb;
  if (m.r + m.g < 0.5) discard;
  // silhouettes a shade off the haze: darker and cooler toward the top, melting into it at the base
  vec3 dark = fogColor * mix(0.78, 0.5, uNight) + vec3(0.0, 0.0, 0.02);
  vec3 c = mix(fogColor, dark, (m.g > 0.5 ? 0.6 : 0.3) * smoothstep(0.0, 0.6, vUv.y));
  c += vec3(1.0, 0.8, 0.45) * m.b * step(0.5, m.g) * uNight * 0.5 * smoothstep(0.05, 0.4, vUv.y);
  gl_FragColor = vec4(c, 1.);
}`,
    }));
    this.ring.frustumCulled = false;
    this.ring.renderOrder = -5;
    scene.add(this.ring);
    // ---- the sea (east of the coast), cel waves + glint
    const W = city.W * M, H = city.H * M, x0 = city.coastX * M;
    const sea = new THREE.PlaneGeometry(9000, H + 12000, 1, 1);
    sea.rotateX(-Math.PI / 2); sea.translate(x0 + 4500, -0.5, H / 2);
    const SU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
    Object.assign(SU, { uKeyDir: U.uKeyDir, uKeyCol: U.uKeyCol, uNight: U.uNight, uTime: U.uTime, uSky: U.uSky });
    this.sea = new THREE.Mesh(sea, new THREE.ShaderMaterial({
      uniforms: SU, fog: true,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSky; uniform float uNight; uniform float uTime;
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec3 vW;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1. - max(V.y, 0.), 4.);
  vec3 deep = mix(vec3(0.03, 0.16, 0.28), vec3(0.01, 0.025, 0.06), uNight);
  vec3 c = mix(deep, uSky, 0.12 + 0.6 * fres);
  // cel wave bands
  float w = sin(vW.x * 0.07 + uTime * 0.5 + sin(vW.z * 0.03) * 2.) * sin(vW.z * 0.09 - uTime * 0.35 + vW.x * 0.02);
  c *= 0.9 + 0.12 * step(0.35, w);
  // the glint: a hard comic streak toward the sun/moon, broken into sparkles at its edges
  vec3 R = reflect(-V, vec3(0., 1., 0.));
  float g = dot(R, uKeyDir);
  vec2 cell = floor(vW.xz / 3.);
  float sp = step(0.86, h21(cell + floor(uTime * 3.))) * smoothstep(0.86, 0.97, g);
  c += uKeyCol * (smoothstep(0.985, 0.995, g) * 1.4 + sp * 0.9);
#ifdef TONE_MAPPING
  c = toneMapping(c);
#endif
  gl_FragColor = linearToOutputTexel(vec4(c, 1.));
  float d = length(vW - cameraPosition);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear * 0.8, fogFar, d));
}`,
    }));
    scene.add(this.sea);
  }

  update(cam) {
    const fog = this.scene.fog;
    const R = Math.min(RING.max, Math.max(RING.min, fog.far * 1.04));
    // follows the camera across the ground: always "the next borough over"
    this.ring.position.set(cam.position.x, -R * 0.01, cam.position.z);
    this.ring.scale.set(R, R * RING.tall, R);
    this.ringU.fogColor.value.copy(fog.color);
  }
}

/** Ground-level haze for flat ground materials: they fade into the fog well before the towers. */
export function haze(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear * 0.5, fogFar * 0.85, vFogDepth));
#endif`);
  };
  mat.customProgramCacheKey = () => 'cityHaze';
  return mat;
}
