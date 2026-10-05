// Speed juice for the three.js flight slice. In the 3D scene: a coloured contrail ribbon off her
// heels, wind streaks whipping past her (boost / top speed), and inked sonic-boom rings that stay
// where she punched through. On the 2D comic overlay: radial action lines (thin tapered streaks of
// light in the outer band of the screen, converging on where she's heading), scaled with speed and
// much denser at boost, plus wall-rush streaks down whichever side a tower face is flashing past.
import * as THREE from 'three';

const FX = {
  trail: { n: 24, life: 0.3, width: [0.34, 0.0], from: 140, head: [1, 0.2, 0.18], tail: [1, 0.8, 0.2], alpha: 1 },   // red off her heels → gold // speed (m/s) it starts
  wind: { n: 28, radius: [5, 14], ahead: [4, 26], width: 0.09, from: 0.62, len: 9, clear: [0.62, 0.95], eye: [7, 15] }, // from = speed fraction; close round her (they read at the screen edges, never as far hairlines); len cap (m); clear: NDC radius they fade in over; eye: m from the lens they fade in over
  ring: { life: 0.9, grow: [3, 70], boostGrow: [2, 26] },
  lines: { from: 0.18, deal: 70, clear: [0.6, 1.0], len: [0.22, 0.32], width: [0.7, 1.6], edge: [10, 44], ink: { n: 28, len: 0.4, width: [1.6, 3.4], inner: 0.5, rgba: [14, 10, 28, 0.85], night: 0.55 } }, // speed fraction; re-deal ms; clear: the screen ellipse they fade in over (× the half size); len: longest streak × screen height (cruise, boost); width: half-width px at the widest; edge: px each one stops short of the screen edge
};

// wind streaks: tapered at both ends, soft across, and only out at the screen edges (faded in
// from an ellipse round the centre, so none rakes across her or the view ahead). Display colour.
const WIND_VS = `attribute vec2 k; varying vec2 vK; varying vec3 vClip; varying float vEye;
void main(){ vK = k; vec4 mv = modelViewMatrix * vec4(position, 1.0); vEye = -mv.z; gl_Position = projectionMatrix * mv; vClip = gl_Position.xyw; }`;
const WIND_FS = `uniform vec3 color; uniform float opacity; uniform vec2 clear; varying vec2 vK; varying vec3 vClip; varying float vEye;
void main(){
  vec2 ndc = vClip.xy / max(vClip.z, 1e-3);
  float a = opacity * smoothstep(0.0, 0.25, vK.x) * (1.0 - smoothstep(0.45, 1.0, vK.x)) * (1.0 - smoothstep(0.3, 1.0, abs(vK.y)));
  a *= smoothstep(clear.x, clear.y, length(ndc));
  a *= smoothstep(${FX.wind.eye[0].toFixed(1)}, ${FX.wind.eye[1].toFixed(1)}, vEye); // never a fat blade right at the lens
  if (a < 0.01) discard;
  gl_FragColor = vec4(color * a, 1.0); // additive: a glint of light, never an opaque white sliver
}`;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** A camera-facing ribbon through a list of points (dynamic buffers, one draw call). */
function ribbon(n, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, material);
  m.frustumCulled = false;
  return m;
}

export class FlightFX3D {
  constructor(scene) {
    this.scene = scene;
    // contrail: gold at her heels fading to red, a sampled history of her position
    this.trailPts = [];
    this.trail = ribbon(FX.trail.n, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    this.trail.renderOrder = 4;
    // wind: thin quads along her velocity, recycled ahead of her as she passes them
    const W = FX.wind.n, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(W * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    const kk = new Float32Array(W * 4 * 2);
    for (let i = 0; i < W; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); kk.set([0, 1, 0, -1, 1, -1, 1, 1], a * 2); }
    geo.setIndex(idx);
    geo.setAttribute('k', new THREE.BufferAttribute(kk, 2)); // (along: head 0 → tail 1, across −1..1)
    this.windMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xeaf6ff) }, opacity: { value: 0 }, clear: { value: new THREE.Vector2(...FX.wind.clear) } },
      vertexShader: WIND_VS, fragmentShader: WIND_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, // (premultiplied add)
    });
    this.wind = new THREE.Mesh(geo, this.windMat);
    this.wind.frustumCulled = false; this.wind.renderOrder = 4;
    this.gusts = Array.from({ length: W }, () => ({ p: new THREE.Vector3(), live: false }));
    // sonic-boom rings: an ink band behind a white one, facing along her heading
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    this.inkGeo = new THREE.RingGeometry(0.74, 1.08, 48);
    scene.add(this.trail, this.wind);
    this.lines = []; this.dealt = -1; this.sonicSeen = 0;
  }

  /** A ring where she is, facing along dir (a THREE.Vector3). big = the sonic boom, else the boost punch. */
  ring(pos, dir, big) {
    const g = new THREE.Group();
    const ink = new THREE.Mesh(this.inkGeo, new THREE.MeshBasicMaterial({ color: 0x0b0b16, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    const white = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: big ? 0xffffff : 0xfff0a0, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    white.position.z = 0.05;
    g.add(ink, white);
    g.position.copy(pos);
    g.lookAt(_a.copy(pos).add(dir));
    g.renderOrder = 7;
    this.scene.add(g);
    this.rings.push({ g, t: 0, big });
  }

  /**
   * hero3d: FlyHero3D (its group = her position); h: overworld hero; frac: speed fraction;
   * boosting; cam: the THREE camera; sonic: the 2D SpeedFX's ring count (a new one = a boom).
   */
  update(dt, hero3d, h, frac, boosting, cam, sonicRings) {
    const pos = hero3d.group.position, speedM = h.speed * 0.5;
    _v.set(Math.cos(h.ang), 0, Math.sin(h.ang)); // heading in the scene
    if (sonicRings > this.sonicSeen) this.ring(pos, _v, true);
    this.sonicSeen = sonicRings;
    // --- contrail (from her heels: a body length behind the pivot)
    const T = FX.trail, now = performance.now() / 1000;
    const on = speedM > T.from && !h.perch;
    if (on) this.trailPts.unshift({ p: _a.copy(pos).addScaledVector(_v, -1.1 * hero3d.size).clone(), t: now });
    while (this.trailPts.length > T.n || (this.trailPts.length && now - this.trailPts[this.trailPts.length - 1].t > T.life)) this.trailPts.pop();
    const tp = this.trail.geometry.attributes.position, tc = this.trail.geometry.attributes.color, n = this.trailPts.length;
    const amp = Math.min(1, (speedM - T.from) / 120) * (boosting ? 1.3 : 1);
    for (let i = 0; i < T.n; i++) {
      const j = Math.min(i, n - 1), q = this.trailPts[j];
      if (!q) { tp.setXYZ(i * 2, pos.x, pos.y, pos.z); tp.setXYZ(i * 2 + 1, pos.x, pos.y, pos.z); continue; }
      const f = n > 1 ? Math.min(1, i / (n - 1)) : 1;
      const nx = this.trailPts[Math.min(j + 1, n - 1)].p, pv = this.trailPts[Math.max(j - 1, 0)].p;
      _a.subVectors(pv, nx); if (_a.lengthSq() < 1e-6) _a.copy(_v);
      _b.subVectors(cam.position, q.p);
      _s.crossVectors(_a, _b).normalize().multiplyScalar((T.width[0] + (T.width[1] - T.width[0]) * f) * hero3d.size * (boosting ? 1.5 : 1) * 0.5);
      tp.setXYZ(i * 2, q.p.x + _s.x, q.p.y + _s.y, q.p.z + _s.z);
      tp.setXYZ(i * 2 + 1, q.p.x - _s.x, q.p.y - _s.y, q.p.z - _s.z);
      // (fades out before it reaches the lens: right under the camera it would be a smear)
      const near = Math.min(1, Math.max(0, (q.p.distanceTo(cam.position) - 3) / 9));
      const al = i >= n ? 0 : T.alpha * amp * (1 - f) * Math.min(1, i / 2 + 0.4) * near;
      const r = T.head[0] + (T.tail[0] - T.head[0]) * f, g = T.head[1] + (T.tail[1] - T.head[1]) * f, b = T.head[2] + (T.tail[2] - T.head[2]) * f;
      for (const k of [0, 1]) tc.setXYZW(i * 2 + k, r, g, b, Math.max(0, al));
    }
    tp.needsUpdate = tc.needsUpdate = true;
    this.trail.visible = n > 1;
    // --- wind streaks
    const Wd = FX.wind, wk = Math.max(0, (frac - Wd.from) / (1 - Wd.from)), live = Math.round(Wd.n * Math.min(1, wk * 1.4 + (boosting ? 0.4 : 0)));
    this.windMat.uniforms.opacity.value = Math.min(0.7, 0.25 + wk * 0.55) * (live ? 1 : 0);
    const wp = this.wind.geometry.attributes.position, len = Math.min(Wd.len, 2 + speedM * 0.04);
    _b.set(-_v.z, 0, _v.x); // her right
    for (let i = 0; i < Wd.n; i++) {
      const s = this.gusts[i];
      if (i >= live) { s.live = false; for (let k = 0; k < 4; k++) wp.setXYZ(i * 4 + k, 0, -1e4, 0); continue; }
      _a.subVectors(s.p, pos);
      const along = _a.dot(_v);
      if (!s.live || along < -12 || _a.lengthSq() > 120 * 120) {
        const r = Wd.radius[0] + Math.random() * (Wd.radius[1] - Wd.radius[0]), th = Math.random() * Math.PI * 2;
        s.p.copy(pos).addScaledVector(_v, Wd.ahead[0] + Math.random() * (Wd.ahead[1] - Wd.ahead[0]) * (s.live ? 1 : Math.random()))
          .addScaledVector(_b, Math.cos(th) * r).add(_a.set(0, Math.sin(th) * r * 0.7, 0));
        s.live = true;
      }
      // a streak from the gust point back along her motion, widened across the view
      _a.copy(s.p).addScaledVector(_v, -len);
      _s.subVectors(cam.position, s.p).cross(_v).normalize().multiplyScalar(Wd.width * (1 + s.p.distanceTo(cam.position) * 0.02));
      wp.setXYZ(i * 4, s.p.x + _s.x, s.p.y + _s.y, s.p.z + _s.z);
      wp.setXYZ(i * 4 + 1, s.p.x - _s.x, s.p.y - _s.y, s.p.z - _s.z);
      wp.setXYZ(i * 4 + 2, _a.x - _s.x * 0.15, _a.y - _s.y * 0.15, _a.z - _s.z * 0.15);
      wp.setXYZ(i * 4 + 3, _a.x + _s.x * 0.15, _a.y + _s.y * 0.15, _a.z + _s.z * 0.15);
    }
    wp.needsUpdate = true;
    this.wind.visible = live > 0;
    // --- rings
    for (const r of this.rings) {
      r.t += dt;
      const e = Math.min(1, r.t / FX.ring.life), G = r.big ? FX.ring.grow : FX.ring.boostGrow, ease = 1 - (1 - e) * (1 - e);
      r.g.scale.setScalar(G[0] + (G[1] - G[0]) * ease);
      r.g.children[0].material.opacity = 0.75 * (1 - e);
      r.g.children[1].material.opacity = 0.95 * (1 - e);
    }
    for (const r of this.rings) if (r.t >= FX.ring.life) { this.scene.remove(r.g); for (const c of r.g.children) c.material.dispose(); }
    this.rings = this.rings.filter((r) => r.t < FX.ring.life);
  }

  /**
   * Comic action lines on the 2D overlay: thin streaks of light that live only in the outer band of
   * the screen, tapered at BOTH ends and starting and ending inside the frame (a streak widest at the
   * screen edge read as a white bar or a paper shard sticking in). They fade in from an ellipse
   * round the screen's centre (its middle ~60% is always clear: never through her or the view
   * ahead); while boosting (boostK 0..1, eased) a comic panel's black ink speed lines join them, longer
   * and reaching further in, so boost reads at a glance against any sky, drawn with 'lighter' compositing at a low alpha so crossings glow instead of stacking
   * into opaque white. Sparse at cruise, a full speed panel at boost; plus wall-rush streaks down the
   * side a tower face is passing. vp: the screen point she's heading for; walls: { l, r } 0..1
   * tower-face proximity; hero: her screen ellipse { x, y, rx, ry } (the ink lines keep out of it). Draw them first on a clear overlay: the centre fade erases what's under it.
   */
  drawLines(ctx, W, H, frac, boosting, vp, walls, night, boostK = 0, hero = null) {
    const f = Math.max(0, Math.min(1, (frac - FX.lines.from) / 0.45));
    const wall = Math.max(walls.l, walls.r), Lc = FX.lines, I = Lc.ink;
    if (f <= 0.02 && wall < 0.05 && boostK < 0.03) return;
    const deal = Math.floor(performance.now() / Lc.deal);
    if (deal !== this.dealt) {
      this.dealt = deal;
      this.lines = [];
      const n = Math.floor(boosting ? 26 + f * 14 : 6 + f * 10);
      const line = (a, wall) => ({ a, in: Math.random(), w: Lc.width[0] + Math.random() * (Lc.width[1] - Lc.width[0]), edge: Lc.edge[0] + Math.random() * (Lc.edge[1] - Lc.edge[0]), wall });
      for (let i = 0; i < n; i++) this.lines.push(line(Math.random() * Math.PI * 2));
      this.ink = [];
      for (let i = 0; i < I.n; i++) this.ink.push({ a: Math.random() * Math.PI * 2, in: Math.random(), w: I.width[0] + Math.random() * (I.width[1] - I.width[0]), edge: Lc.edge[0] + Math.random() * (Lc.edge[1] - Lc.edge[0]) });
      for (const [side, k] of [[-1, walls.l], [1, walls.r]]) {
        const m = Math.floor(k * 14);
        for (let i = 0; i < m; i++) this.lines.push(line((side < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.1, k));
      }
    }
    // radii from the vanishing point: each streak ends a little inside where its ray leaves the screen
    const R = Math.hypot(Math.max(vp.x, W - vp.x), Math.max(vp.y, H - vp.y)), ox = vp.x, oy = vp.y;
    const inner = boosting ? 0.6 : 0.7, L = H * Lc.len[boosting ? 1 : 0], k0 = Math.min(1, W / 844);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = night > 0.5 ? `rgba(150,200,255,${boosting ? 0.5 : 0.38})` : `rgba(235,245,255,${boosting ? 0.55 : 0.42})`;
    ctx.beginPath();
    for (const l of this.lines) {
      const c = Math.cos(l.a), s = Math.sin(l.a), k = l.wall ?? f;
      const ex = Math.min(c > 1e-3 ? (W - ox) / c : c < -1e-3 ? -ox / c : 1e9, s > 1e-3 ? (H - oy) / s : s < -1e-3 ? -oy / s : 1e9);
      const r1 = ex - l.edge * k0, r0 = Math.max(R * (inner + (1 - inner) * 0.6 * l.in * (1 - 0.5 * k)), r1 - L * (0.6 + 0.4 * l.in)), w = l.w * (0.6 + 0.4 * k) * k0;
      if (r1 - r0 < 12) continue;
      // a thin spindle: sharp at both ends, widest two thirds of the way out
      const rm = r0 + (r1 - r0) * 0.68;
      ctx.moveTo(ox + c * r0, oy + s * r0);
      ctx.lineTo(ox + c * rm - s * w, oy + s * rm + c * w); ctx.lineTo(ox + c * r1, oy + s * r1); ctx.lineTo(ox + c * rm + s * w, oy + s * rm - c * w); ctx.closePath();
    }
    ctx.fill();
    // fade toward the middle: erase with an elliptical ramp round the screen's centre (fully clear
    // inside clear[0] × the half size → untouched from clear[1] out)
    const C = Lc.clear;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.translate(W / 2, H / 2); ctx.scale(W / 2, H / 2);
    const g = ctx.createRadialGradient(0, 0, C[0], 0, 0, C[1]);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-1.5, -1.5, 3, 3);
    ctx.restore();
    ctx.save();
    if (boostK > 0.03 && this.ink) { // the ink panel, after the centre fade: it starts out past her and keeps its full weight
      const L2 = H * I.len * (0.6 + 0.4 * boostK);
      ctx.beginPath();
      for (const l of this.ink) {
        const c = Math.cos(l.a), s = Math.sin(l.a);
        const ex = Math.min(c > 1e-3 ? (W - ox) / c : c < -1e-3 ? -ox / c : 1e9, s > 1e-3 ? (H - oy) / s : s < -1e-3 ? -oy / s : 1e9);
        const r1 = ex - l.edge * k0 * 0.5, w = l.w * k0 * (0.5 + 0.5 * boostK);
        let r0 = Math.max(ex * (I.inner + 0.2 * l.in), r1 - L2 * (0.6 + 0.4 * l.in));
        if (hero) { // never across her: start where the ray leaves her ellipse
          const px = (ox - hero.x) / hero.rx, py = (oy - hero.y) / hero.ry, dx = c / hero.rx, dy = s / hero.ry;
          const A = dx * dx + dy * dy, B = px * dx + py * dy, D = B * B - A * (px * px + py * py - 1);
          if (D > 0) r0 = Math.max(r0, (-B + Math.sqrt(D)) / A);
        }
        if (r1 - r0 < 12) continue;
        const rm = r0 + (r1 - r0) * 0.7;
        ctx.moveTo(ox + c * r0, oy + s * r0);
        ctx.lineTo(ox + c * rm - s * w, oy + s * rm + c * w); ctx.lineTo(ox + c * r1, oy + s * r1); ctx.lineTo(ox + c * rm + s * w, oy + s * rm - c * w); ctx.closePath();
      }
      const [r, g, b, a] = I.rgba;
      ctx.fillStyle = `rgba(${r},${g},${b},${(a * boostK * (night > 0.5 ? I.night : 1)).toFixed(3)})`;
      ctx.fill();
    }
    ctx.restore();
  }

  dispose() {
    for (const r of this.rings) { this.scene.remove(r.g); for (const c of r.g.children) c.material.dispose(); }
    this.rings = [];
  }
}
