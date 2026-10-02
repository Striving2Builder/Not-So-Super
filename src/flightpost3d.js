// Whole-frame anti-aliasing + resolution split for the 3D flight view. The CANVAS stays at a crisp
// output density (her pass and the comic overlay land on it at that density); only the 3D scene
// renders smaller (fill rate), into an offscreen target that is upscaled (bilinear + FXAA) to the
// canvas. Before, the whole canvas was shrunk, so she was rendered sharp and then blurred with it. The shared WebGL renderer is created without
// MSAA on 2×+ screens (the 3D zones decide that) and the flight renders below native resolution
// for fill rate, so every tower edge, beam and window grid stair-steps. Here the scene renders
// into an offscreen target that three treats exactly like the canvas (tone mapping + sRGB output:
// nothing in the city's or the hero's shaders changes), then one full-screen pass writes it to the
// canvas through FXAA (Balanced), or the target itself is multisampled (High).
import * as THREE from 'three';

// FXAA ("console" variant, Lottes): 5 taps to find an edge and its direction, 4 more to blend along it.
const FRAG = `
precision highp float;
uniform sampler2D tDiffuse; uniform vec2 px; uniform float streak; uniform vec2 vp; varying vec2 vUv;
#define LUMA vec3(0.299, 0.587, 0.114)
void main() {
  vec4 cM = texture2D(tDiffuse, vUv);
#ifdef FXAA
  vec3 nw = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb, ne = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * px).rgb;
  vec3 sw = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * px).rgb, se = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * px).rgb;
  float lNW = dot(nw, LUMA), lNE = dot(ne, LUMA), lSW = dot(sw, LUMA), lSE = dot(se, LUMA), lM = dot(cM.rgb, LUMA);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  gl_FragColor = vec4(cM.rgb, 1.0);
  if (lMax - lMin >= max(0.03, lMax * 0.1)) { // (flat: no edge here)
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * px;
  vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
  float lB = dot(b, LUMA);
  gl_FragColor = vec4((lB < lMin || lB > lMax) ? a : b, 1.0);
  }
#else
  gl_FragColor = vec4(cM.rgb, 1.0);
#endif
  // boost: a short motion smear along the line to the vanishing point, only in the outer band of
  // the frame. Many taps over a short span (≤ ~1.5% of the screen): a smooth smear, never the
  // duplicated "multi-exposure" copies a few wide taps give.
  if (streak > 0.0) {
    vec2 d = vUv - vp; float k = smoothstep(0.42, 0.8, length(d * vec2(px.y / px.x, 1.0))) * streak;
    if (k > 0.01) {
      vec2 step = normalize(d) * 0.0016 * k;
      vec3 acc = gl_FragColor.rgb;
      for (int i = 1; i <= 9; i++) acc += texture2D(tDiffuse, vUv - step * float(i)).rgb;
      gl_FragColor.rgb = acc / 10.0;
    }
  }
}`;
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class FlightPost {
  constructor() {
    this.rt = null; this.mode = null;
    this.mat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2() }, streak: { value: 0 }, vp: { value: new THREE.Vector2(0.5, 0.5) } }, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._s = new THREE.Vector2();
  }

  /**
   * mode: 'fxaa' | 'msaa' | 'none' (graphics profile fly3dAA); streak 0..1: the boost zoom smear
   * toward vp (uv of the vanishing point); scale: the scene's resolution relative to the canvas.
   * Returns the scene target's size (the shared screen uniforms must describe it while it renders:
   * the caller sets them through onSize before the scene draws).
   */
  render(renderer, scene, camera, mode, streak = 0, vp = null, scale = 1, onSize = null) {
    const size = renderer.getDrawingBufferSize(this._s);
    const w = Math.max(1, Math.round(size.x * scale)), h = Math.max(1, Math.round(size.y * scale)), samples = mode === 'msaa' ? 4 : 0;
    if ((mode === 'none' || !mode) && scale >= 0.999) { onSize?.(size.x, size.y); renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    if (!this.rt || this.rt.width !== w || this.rt.height !== h || this.rt.samples !== samples) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { samples, type: THREE.UnsignedByteType });
      // treated like the canvas by three: renderer tone mapping + sRGB output for every material
      // (the city's custom shaders included), stored as plain bytes (no second sRGB encode)
      this.rt.isXRRenderTarget = true;
      this.rt.texture.colorSpace = THREE.SRGBColorSpace;
      this.rt.texture.internalFormat = 'RGBA8';
      this.mat.uniforms.tDiffuse.value = this.rt.texture;
    }
    if (this.mode !== mode) { this.mode = mode; this.mat.defines = mode === 'fxaa' ? { FXAA: '' } : {}; this.mat.needsUpdate = true; }
    onSize?.(w, h);
    this.mat.uniforms.px.value.set(1 / w, 1 / h);
    this.mat.uniforms.streak.value = streak;
    if (vp) this.mat.uniforms.vp.value.copy(vp);
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quad, this.cam);
  }

  dispose() { this.rt?.dispose(); this.rt = null; }
}
