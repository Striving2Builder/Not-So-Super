// A sharp pass for the star of the shot. The shared WebGL renderer has no antialiasing on 2×+
// screens (fixed at creation by the 3D zones) and the flight view renders the city below native
// resolution for fill rate, so a figure drawn in the main pass comes out stair-stepped. Instead
// she lives on her own layer and is rendered into a small target covering only her screen
// rectangle, at twice the frame's pixel density (optionally MSAA too), then laid over the frame. Cost scales with her size
// on screen, not the screen.
import * as THREE from 'three';
import { LOOK } from './look3d.js';

export const HERO_LAYER = 1;
const PASS = { pad: 1.2, bucket: 64 }; // pad: margin round her bounding sphere

const _v = new THREE.Vector3(), _res = new THREE.Vector2(), _cc = new THREE.Color();

export class HeroPass {
  constructor() {
    this.rt = null;
    this.cam = new THREE.PerspectiveCamera();
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    // the target holds premultiplied colour (MSAA resolves her edges against a clear of 0,0,0,0)
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true, depthTest: false, depthWrite: false,
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
      this.mat.map = this.rt.texture; this.mat.needsUpdate = true;
    }
    return this.rt;
  }

  /**
   * Render the HERO_LAYER of `scene` as seen by `cam`, around a bounding sphere (center, radius
   * in metres), over what's already on the canvas. W/H: CSS size of the view; q = [MSAA samples,
   * density × the frame's] (the graphics profile's fly3dHero). At 2× density the quad's bilinear
   * read averages each 2×2 block: supersampled edges without MSAA (which is costly in software GL).
   */
  render(renderer, scene, cam, center, radius, W, H, q) {
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
    this.mat.map.repeat.set(rw / rt.width, rh / rt.height);
    this.quad.scale.set(w / W, h / H, 1);
    this.quad.position.set(((x0 + w / 2) / W) * 2 - 1, 1 - ((y0 + h / 2) / H) * 2, 0);
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.quadScene, this.ortho);
    renderer.autoClear = ac;
  }

  dispose() { this.rt?.dispose(); this.rt = null; }
}
