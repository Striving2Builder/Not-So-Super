// Speed juice for the three.js flight slice. In the 3D scene: a coloured contrail ribbon off her
// heels, wind streaks whipping past her (boost / top speed), and inked sonic-boom rings that stay
// where she punched through. On the 2D comic overlay: heavy radial action lines (ink + white
// wedges raking in from the screen edges toward where she's heading), scaled with speed and much
// denser at boost, plus wall-rush streaks down whichever side a tower face is flashing past.
import * as THREE from 'three';

const FX = {
  trail: { n: 24, life: 0.3, width: [0.34, 0.0], from: 140, head: [1, 0.2, 0.18], tail: [1, 0.8, 0.2], alpha: 1 },   // red off her heels → gold // speed (m/s) it starts
  wind: { n: 28, radius: [5, 14], ahead: [4, 26], width: 0.09, from: 0.62 },       // from = speed fraction; close round her (they read at the screen edges, never as far hairlines)
  ring: { life: 0.9, grow: [3, 70], boostGrow: [2, 26] },
  lines: { from: 0.18, deal: 70 },                                                  // speed fraction; re-deal ms
};

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
    for (let i = 0; i < W; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); }
    geo.setIndex(idx);
    this.windMat = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
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
    this.windMat.opacity = Math.min(0.75, 0.25 + wk * 0.6) * (live ? 1 : 0);
    const wp = this.wind.geometry.attributes.position, len = Math.min(26, 2 + speedM * 0.05);
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
      wp.setXYZ(i * 4 + 2, _a.x - _s.x * 0.2, _a.y - _s.y * 0.2, _a.z - _s.z * 0.2);
      wp.setXYZ(i * 4 + 3, _a.x + _s.x * 0.2, _a.y + _s.y * 0.2, _a.z + _s.z * 0.2);
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
   * Comic action lines on the 2D overlay: tapered white streaks that live only in the outer band
   * of the screen and fade out toward the middle (never through her or the view ahead). Sparse at
   * cruise, a full speed panel at boost; plus wall-rush streaks down the side a tower face is
   * passing. vp: the screen point she's heading for; walls: { l, r } 0..1 tower-face proximity.
   * Draw them first on a clear overlay: the centre fade erases what's under it.
   */
  drawLines(ctx, W, H, frac, boosting, vp, walls, night) {
    const f = Math.max(0, Math.min(1, (frac - FX.lines.from) / 0.45));
    const wall = Math.max(walls.l, walls.r);
    if (f <= 0.02 && wall < 0.05) return;
    const deal = Math.floor(performance.now() / FX.lines.deal);
    if (deal !== this.dealt) {
      this.dealt = deal;
      this.lines = [];
      const n = Math.floor(boosting ? 26 + f * 14 : 6 + f * 10);
      for (let i = 0; i < n; i++) this.lines.push({ a: Math.random() * Math.PI * 2, in: Math.random(), w: (boosting ? 5 : 2.5) + Math.random() * (boosting ? 13 : 5) });
      for (const [side, k] of [[-1, walls.l], [1, walls.r]]) {
        const m = Math.floor(k * 14);
        for (let i = 0; i < m; i++) this.lines.push({ a: (side < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.1, in: Math.random(), w: 3 + Math.random() * 8, wall: k });
      }
    }
    // radii from the vanishing point: the streaks run from past the screen edge in to the outer band
    const R = Math.hypot(Math.max(vp.x, W - vp.x), Math.max(vp.y, H - vp.y)), ox = vp.x, oy = vp.y;
    const inner = boosting ? 0.5 : 0.66;
    ctx.save();
    ctx.fillStyle = night > 0.5 ? `rgba(232,244,255,${boosting ? 0.95 : 0.7})` : `rgba(255,255,255,${boosting ? 0.95 : 0.75})`;
    ctx.beginPath();
    for (const l of this.lines) {
      const c = Math.cos(l.a), s = Math.sin(l.a), k = l.wall ?? f;
      const r0 = R * (inner + (1 - inner) * 0.6 * l.in * (1 - 0.5 * k)), w = l.w * (0.5 + 0.5 * k);
      // a needle: sharp tip inside, widest at the screen edge
      ctx.moveTo(ox + c * r0, oy + s * r0);
      ctx.lineTo(ox + c * R * 1.1 - s * w, oy + s * R * 1.1 + c * w); ctx.lineTo(ox + c * R * 1.1 + s * w, oy + s * R * 1.1 - c * w); ctx.closePath();
    }
    ctx.fill();
    // fade toward the middle: erase with a radial ramp (opaque in the centre → nothing at the edge)
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(ox, oy, R * inner, ox, oy, R * 0.98);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  dispose() {
    for (const r of this.rings) { this.scene.remove(r.g); for (const c of r.g.children) c.material.dispose(); }
    this.rings = [];
  }
}
