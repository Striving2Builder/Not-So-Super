// A sharp pass for the star of the shot. The shared WebGL renderer has no antialiasing on 2×+
// screens (fixed at creation by the 3D zones) and the flight view renders the city below native
// resolution for fill rate, so a figure drawn in the main pass comes out stair-stepped. Instead
// she lives on her own layer and is rendered into a small target covering only her screen
// rectangle, at twice the frame's pixel density (optionally MSAA too), then laid over the frame. Cost scales with her size
// on screen, not the screen.
import * as THREE from 'three';
import { LOOK } from './look3d.js';

export const HERO_LAYER = 1;
// pad: margin round her bounding sphere; taps: the silhouette ink's dilation samples (+ as many at
// half width, so thin limbs don't break it up); ink: its colour; halo: rgb + alpha of the night halo
const PASS = { pad: 1.2, bucket: 64, taps: 8, ink: 0x0b0b16, halo: [0.85, 0.9, 1.0, 0.45] };

const _v = new THREE.Vector3(), _res = new THREE.Vector2(), _cc = new THREE.Color();

export class HeroPass {
  constructor() {
    this.rt = null;
    this.cam = new THREE.PerspectiveCamera();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    // the target holds premultiplied colour (MSAA resolves her edges against a clear of 0,0,0,0)
    // and display values, so the copy is raw. On the way it adds a silhouette ink line round her
    // whole figure (body + cape as one shape, like a comic keyline): a dilation of her coverage,
    // wider on dark or busy backgrounds, with an optional pale halo outside it at night.
    let taps = '', halo = ''; // (unrolled: one line per direction)
    for (let i = 0; i < PASS.taps; i++) {
      const a = (i / PASS.taps) * Math.PI * 2, d = `vec2(${Math.cos(a).toFixed(4)}, ${Math.sin(a).toFixed(4)}) * texel`;
      taps += `  o = max(o, max(cover(vUv + ${d} * inkW), cover(vUv + ${d} * inkW * 0.5)));
`;
      halo += `    h = max(h, cover(vUv + ${d} * (inkW + haloW)));
`;
    }
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, rep: { value: new THREE.Vector2(1, 1) }, texel: { value: new THREE.Vector2() }, inkW: { value: 0 }, haloW: { value: 0 },
        ink: { value: new THREE.Color(PASS.ink) }, halo: { value: new THREE.Vector4(...PASS.halo) } },
      vertexShader: 'uniform vec2 rep; varying vec2 vUv; void main() { vUv = uv * rep; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 rep, texel; uniform float inkW, haloW; uniform vec3 ink; uniform vec4 halo; varying vec2 vUv;
float cover(vec2 uv) { return all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, rep)) ? texture2D(map, uv).a : 0.0; }
void main() {
  vec4 c = texture2D(map, vUv);
  if (inkW <= 0.0) { gl_FragColor = c; return; }
  float o = 0.0, h = 0.0;
${taps}  if (haloW > 0.0) {
${halo}  }
  o = smoothstep(0.15, 0.6, o);
  vec4 l = vec4(ink, 1.0) * o + vec4(halo.rgb, 1.0) * halo.a * smoothstep(0.15, 0.6, h) * (1.0 - o);
  gl_FragColor = c + l * (1.0 - c.a);
}`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Grow the target in buckets (no per-frame reallocation as she moves on screen). */
  target(w, h, samples) {
    const B = PASS.bucket, W = Math.ceil(w / B) * B, H = Math.ceil(h / B) * B;
    if (!this.rt || this.rt.width < w || this.rt.height < h || this.rt.samples !== samples) {
      const keep = this.rt && this.rt.samples === samples;
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(Math.max(W, keep ? this.rt.width : 0), Math.max(H, keep ? this.rt.height : 0), { samples });
      // like the canvas (see flightpost3d): she's tone-mapped and sRGB-encoded in her own pass,
      // so the 8-bit target holds display values (no banding in her darks)
      this.rt.isXRRenderTarget = true;
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.rt.texture.internalFormat = 'RGBA8';
      this.mat.uniforms.map.value = this.rt.texture;
    }
    return this.rt;
  }

  /**
   * Render the HERO_LAYER of `scene` as seen by `cam`, around a bounding sphere (center, radius
   * in metres), over what's already on the canvas. W/H: CSS size of the view; q = [MSAA samples,
   * density × the frame's] (the graphics profile's fly3dHero). At 2× density the quad's bilinear
   * read averages each 2×2 block: supersampled edges without MSAA (which is costly in software GL).
   * line = [ink, halo] CSS px of the silhouette keyline round her (0 = none).
   */
  render(renderer, scene, cam, center, radius, W, H, q, line = [0, 0]) {
    _v.copy(center).project(cam);
    if (_v.z > 1 || _v.z < -1) return;
    const dist = cam.position.distanceTo(center);
    const pr = (radius * PASS.pad) / (dist * Math.tan((cam.fov * Math.PI) / 360)) * (H / 2) / (cam.zoom || 1);
    const sx = (_v.x * 0.5 + 0.5) * W, sy = (-_v.y * 0.5 + 0.5) * H;
    const x0 = Math.max(0, Math.floor(sx - pr)), y0 = Math.max(0, Math.floor(sy - pr));
    const x1 = Math.min(W, Math.ceil(sx + pr)), y1 = Math.min(H, Math.ceil(sy + pr));
    const w = x1 - x0, h = y1 - y0;
    if (w < 2 || h < 2) return;
    const dpr = renderer.getPixelRatio() * q[1], rw = Math.ceil(w * dpr), rh = Math.ceil(h * dpr);
    const rt = this.target(rw, rh, q[0]);
    rt.viewport.set(0, 0, rw, rh); rt.scissor.set(0, 0, rw, rh); rt.scissorTest = true;
    // her camera: the main one, cropped to her rectangle
    this.cam.copy(cam);
    this.cam.layers.set(HERO_LAYER);
    this.cam.setViewOffset(W, H, x0, y0, w, h);
    // ink outlines are sized from the shared screen uniforms: point them at this target
    const dpr0 = LOOK.dpr.value;
    _res.copy(LOOK.res.value);
    LOOK.res.value.set(rw, rh); LOOK.dpr.value = dpr;
    renderer.getClearColor(_cc); const a0 = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(null);
    renderer.setClearColor(_cc, a0);
    LOOK.res.value.copy(_res); LOOK.dpr.value = dpr0;
    // lay it over the frame: a quad on her rectangle sampling the used corner of the target
    const u = this.mat.uniforms;
    u.rep.value.set(rw / rt.width, rh / rt.height);
    u.texel.value.set(dpr / rt.width, dpr / rt.height); // one CSS px in the target's uv
    u.inkW.value = line[0]; u.haloW.value = line[1];
    this.quad.scale.set(w / W, h / H, 1);
    this.quad.position.set(((x0 + w / 2) / W) * 2 - 1, 1 - ((y0 + h / 2) / H) * 2, 0);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.quadScene, this.ortho);
    renderer.autoClear = ac;
  }

  dispose() { this.rt?.dispose(); this.rt = null; }
}
