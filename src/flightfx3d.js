// Speed juice for the three.js flight slice. In the 3D scene: a coloured contrail ribbon off her
// heels, wind streaks whipping past her (boost / top speed), and inked sonic-boom rings that stay
// where she punched through. On the 2D comic overlay: heavy radial action lines (ink + white
// wedges raking in from the screen edges toward where she's heading), scaled with speed and much
// denser at boost, plus wall-rush streaks down whichever side a tower face is flashing past.
import * as THREE from 'three';

const FX = {
  trail: { n: 36, life: 0.55, width: [0.42, 0.06], from: 140, head: [1, 0.93, 0.45], tail: [1, 0.12, 0.2], alpha: 0.95 }, // speed (m/s) it starts
  wind: { n: 40, radius: [2.5, 13], ahead: [14, 70], width: 0.06, from: 0.42 },     // from = speed fraction
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
      const al = i >= n ? 0 : T.alpha * amp * (1 - f) * Math.min(1, i / 2 + 0.4);
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
   * Comic action lines on the 2D overlay. vp: screen point she's heading for (vanishing point);
   * walls: { l, r } 0..1 how close a tower face is on each side.
   */
  drawLines(ctx, W, H, frac, boosting, vp, walls, night) {
    const f = Math.max(0, Math.min(1, (frac - FX.lines.from) / 0.45));
    const wall = Math.max(walls.l, walls.r);
    if (f <= 0.02 && wall < 0.05) return;
    const deal = Math.floor(performance.now() / FX.lines.deal);
    if (deal !== this.dealt) {
      this.dealt = deal;
      this.lines = [];
      const n = Math.floor(8 + f * 16 + (boosting ? 16 : 0));
      for (let i = 0; i < n; i++) this.lines.push({ a: Math.random() * Math.PI * 2, in: Math.random(), w: 9 + Math.random() * (boosting ? 34 : 20), ink: Math.random() < 0.45 });
      // wall rush: a fan of long streaks down the side the tower face is on
      for (const [side, k] of [[-1, walls.l], [1, walls.r]]) {
        const m = Math.floor(k * 16);
        for (let i = 0; i < m; i++) this.lines.push({ a: (side < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.3, in: 0.5 + Math.random() * 0.5, w: 6 + Math.random() * 14, ink: Math.random() < 0.5, wall: k });
      }
    }
    const R = Math.hypot(W, H) * 0.75, ox = vp.x, oy = vp.y;
    ctx.save();
    for (const pass of [true, false]) {
      ctx.fillStyle = pass ? 'rgba(8,10,30,0.8)' : night > 0.5 ? 'rgba(228,242,255,0.9)' : 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      for (const l of this.lines) {
        if (l.ink !== pass) continue;
        const k = l.wall ?? f, c = Math.cos(l.a), s = Math.sin(l.a);
        // inner tip: the faster, the deeper the lines reach toward where she's going
        const reach = l.wall ? 0.25 + 0.4 * l.wall : (boosting ? 0.42 : 0.18) + 0.22 * k;
        const r0 = R * (1 - reach * (0.55 + 0.45 * l.in)), w = l.w * (0.5 + 0.5 * k);
        const px = -s * w, py = c * w;
        ctx.moveTo(ox + c * r0, oy + s * r0);
        ctx.lineTo(ox + c * R * 1.3 + px, oy + s * R * 1.3 + py); ctx.lineTo(ox + c * R * 1.3 - px, oy + s * R * 1.3 - py); ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  }

  dispose() {
    for (const r of this.rings) { this.scene.remove(r.g); for (const c of r.g.children) c.material.dispose(); }
    this.rings = [];
  }
}
