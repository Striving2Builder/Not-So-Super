// Guards on patrol and what they see: walking their routes, spotting her (alert, "!" burst),
// and the comic vision cones, whose rays are clipped against the walls every frame. Mixed into
// Special3D.prototype (zones may override clearLOS / sightReach).
import * as THREE from 'three';
import { GUARD_RANGE, GUARD_FOV, CONE_RAYS, segEnter, segHitsBox } from './zonekit.js';

let bangTex = null; // the "!" burst, drawn once


export const guardMethods = {
  updateGuards(dt) {
    const h = this.hero.position;
    for (const gd of this.guards) {
      gd.seeing = false;
      if (gd.ko) { if (gd.bang) gd.bang.visible = false; continue; }
      const m = gd.mesh;
      gd.t += dt;
      const dx = h.x - m.position.x, dz = h.z - m.position.z, d = Math.hypot(dx, dz);
      const fx = Math.sin(m.rotation.y), fz = Math.cos(m.rotation.y);
      if (this.t > this.grace && d < GUARD_RANGE && d > 0.01 && (dx * fx + dz * fz) / d > Math.cos(GUARD_FOV / 2) && this.clearLOS(m.position, h)) {
        gd.seeing = true;
        if (gd.look <= 0) { const s = this.screenOf(m.position, 2.1); if (s) this.g.commentary.guardShout(s.x, s.y); this.alarmBurst(gd); }
        gd.look = 1.2;
        this.alert = Math.min(100, this.alert + dt * (30 + (GUARD_RANGE - d) * 9));
      }
      if (m.enemy) { if (gd.look > 0) m.enemy.play('combatIdle'); else m.enemy.play('walk', { speed: 1.2 }); } // walk clip at 1.7 m/s
      if (gd.look > 0) {
        gd.look -= dt;
        if (gd.seeing) m.rotation.y = Math.atan2(dx, dz);
      } else {
        const tgt = gd.route[gd.wp];
        const tx = tgt.x - m.position.x, tz = tgt.z - m.position.z, td = Math.hypot(tx, tz);
        if (td < 0.2) gd.wp = (gd.wp + 1) % gd.route.length;
        else {
          m.position.x += (tx / td) * 1.7 * dt; m.position.z += (tz / td) * 1.7 * dt;
          let da = Math.atan2(tx, tz) - m.rotation.y;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          m.rotation.y += da * Math.min(1, dt * 5);
        }
        const s = Math.sin(gd.t * 8) * 0.4;
        m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s;
      }
      if (!gd.cone.userData.comic) this.dressCone(gd.cone);
      // walls clip the cone: re-cast every frame against our box walls, ~20×/s against a club's BVH
      gd.shapeT = (gd.shapeT || 0) + dt;
      if (!this.club || gd.shapeT > 0.05 || !gd.shaped) { gd.shapeT = 0; gd.shaped = true; this.shapeCone(gd); }
      const cu = gd.cone.material.uniforms;
      cu.col.value.set(gd.seeing ? 0xff2a2a : gd.look > 0 ? 0xffa020 : 0xffe040);
      cu.k.value += ((gd.seeing ? 1 : 0.62) - cu.k.value) * Math.min(1, dt * 8);
      cu.alarm.value = gd.seeing ? 1 : 0;
      cu.t.value = this.t;
      if (gd.bang) {
        // pop in, hold while he's looking, shrink away
        gd.bangT += dt;
        const pop = gd.look > 0 ? Math.min(1, gd.bangT * 6) * (1 + 0.25 * Math.max(0, 1 - gd.bangT * 3)) : Math.max(0, gd.bang.scale.x / 0.9 - dt * 4);
        gd.bang.scale.setScalar(0.9 * pop);
        gd.bang.visible = pop > 0.02;
        gd.bang.position.set(m.position.x, m.position.y + 2.45 + Math.sin(this.t * 10) * 0.04, m.position.z);
      }
    }
  },

  /**
   * Vision cones as comic "spotlight wedges": a soft fill fading with distance, an inked leading
   * edge that follows wherever walls cut the cone short, sweeping scan lines, and a red pulse
   * while she's seen. Adopts whatever cone a zone built (replaces its geometry with a fan whose
   * rays are clipped against the walls every frame).
   */
  dressCone(cone) {
    const R = GUARD_RANGE, N = CONE_RAYS;
    cone.material.dispose();
    cone.geometry.dispose();
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((N + 2) * 3), rim = new Float32Array(N + 2), idx = [];
    rim.fill(1); rim[0] = 0;
    for (let i = 0; i <= N; i++) idx.push(0, i + 1, i + 2);
    idx.length = N * 3;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('rim', new THREE.BufferAttribute(rim, 1));
    g.setIndex(idx);
    cone.geometry = g;
    cone.frustumCulled = false;
    cone.material = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0xffe040) }, k: { value: 0.62 }, t: { value: 0 }, R: { value: R }, alarm: { value: 0 } },
      vertexShader: 'attribute float rim; varying vec3 vP; varying float vR; void main(){ vP = position; vR = rim; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 col; uniform float k, t, R, alarm; varying vec3 vP; varying float vR;
void main(){
  float d = length(vP.xz) / R;
  float a = atan(vP.x, vP.z);
  float edge = smoothstep(0.86, 0.95, vR);                       // leading edge (walls included)
  float side = smoothstep(0.44, 0.515, abs(a));
  float fill = (0.1 + 0.42 * (1.0 - d) * (1.0 - d)) * (1.0 - smoothstep(0.9, 1.0, vR) * 0.4);
  float scan = smoothstep(0.93, 1.0, sin((d * 7.0 - t * 2.2) * 6.2832) * 0.5 + 0.5) * 0.16 * (1.0 - d);
  float pulse = alarm * (0.5 + 0.5 * sin(t * 16.0));
  float al = (fill + scan) * k * (1.0 + pulse * 0.6) + (edge * 0.85 + side * 0.45) * 0.6 * k;
  vec3 c = mix(col, col * 0.25, edge * 0.75);
  gl_FragColor = vec4(c, clamp(al, 0.0, 0.9));
}`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    cone.renderOrder = 2;
    cone.userData.comic = true;
  },

  /** How far a guard can see along world direction (dx, dz) from (x, y, z), up to R. */
  sightReach(x, y, z, dx, dz, R) {
    let best = R;
    if (this.club && this.club.collider) {
      const ray = this._sray || (this._sray = new THREE.Raycaster());
      ray.firstHitOnly = true; ray.far = R;
      ray.set(this._sv.set(x, y + 1.2, z), this._sd.set(dx, 0, dz));
      const hit = ray.intersectObject(this.club.collider)[0];
      if (hit) best = hit.distance;
    }
    for (const c of this.colliders) {
      if (c.disabled || !(c.wall || c === this.doorCol) || (c === this.doorCol && this.doorOpen)) continue;
      const t = segEnter(x, z, x + dx * best, z + dz * best, c);
      if (t !== null) best *= t;
    }
    return best;
  },

  /** Re-cast the cone's rays (walls clip it) — every frame for her own guard's view. */
  shapeCone(gd) {
    const cone = gd.cone, m = gd.mesh, R = GUARD_RANGE, N = CONE_RAYS;
    const pos = cone.geometry.attributes.position.array;
    const sc = m.scale.x || 1, ry = m.rotation.y;
    this._sv = this._sv || new THREE.Vector3(); this._sd = this._sd || new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const a = -GUARD_FOV / 2 + (i / N) * GUARD_FOV;
      const r = this.sightReach(m.position.x, m.position.y, m.position.z, Math.sin(a + ry), Math.cos(a + ry), R) / sc;
      pos[(i + 1) * 3] = Math.sin(a) * r; pos[(i + 1) * 3 + 1] = 0; pos[(i + 1) * 3 + 2] = Math.cos(a) * r;
    }
    cone.geometry.attributes.position.needsUpdate = true;
  },

  /** A comic "!" burst over a guard's head the moment he spots her. */
  alarmBurst(gd) {
    if (!bangTex) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.translate(64, 64);
      const star = (r0, r1, n) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r0 : r1; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
      star(34, 60, 11); g.fillStyle = '#141014'; g.fill();
      star(28, 52, 11); g.fillStyle = '#ffe040'; g.fill();
      g.font = '900 72px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = '#141014'; g.strokeText('!', 0, 4); g.fillStyle = '#ff2a2a'; g.fillText('!', 0, 4);
      bangTex = new THREE.CanvasTexture(c);
      bangTex.colorSpace = THREE.SRGBColorSpace;
    }
    if (!gd.bang) {
      gd.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true }));
      gd.bang.renderOrder = 20;
      this.scene.add(gd.bang);
    }
    gd.bangT = 0;
  },

  clearLOS(a, b) {
    for (const c of this.colliders) {
      if (!c.wall || c.disabled) continue;
      if (segHitsBox(a.x, a.z, b.x, b.z, c)) return false;
    }
    if (!this.doorOpen && segHitsBox(a.x, a.z, b.x, b.z, this.doorCol)) return false;
    return true;
  },
};
