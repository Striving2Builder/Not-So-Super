// The zones' third-person camera: ~43° over her shoulder, aimed a little past her so the room
// ahead reads, swinging up (or pulling in) when a wall would come between them. Mixed into
// Special3D.prototype; zones override cameraReach() for their own geometry (clubs use the BVH).
import * as THREE from 'three';
import { CAM_DIST, CAM_PITCHES, WALL_H, segEnter, sightBlockers } from './zonekit.js';
import { lookFrame } from './look3d.js';


export const cameraMethods = {
  /** How far the camera may sit from her along `off` (club raids shorten it past obstacles). */
  cameraReach(h, off) {
    // Box-built rooms: the sight line from her head to the camera may not pass through a wall
    // below its top (else the camera sits outside the room looking at the back of a wall).
    const len = off.length(), y0 = 1.3;
    let reach = len;
    for (const c of sightBlockers(this)) {
      if (c.disabled) continue;
      const t = segEnter(h.x, h.z, h.x + off.x, h.z + off.z, c);
      if (t === null) continue;
      if (y0 + t * (off.y - y0) < (c.top ?? WALL_H) + 0.1) reach = Math.min(reach, t * len - 0.35);
    }
    return Math.max(1.8, reach);
  },

  /** Camera offset from her at a given pitch (radians above horizontal), behind her along yaw. */
  cameraOffset(pitch, dist = CAM_DIST) {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(this.yaw) * Math.cos(pitch) * dist);
  },

  /**
   * The lowest camera pitch with a clear view of her. When a wall blocks the usual angle the
   * camera swings up toward top-down (club ceilings are sliced away above her head, so from
   * overhead the view is nearly always clear) instead of squashing in against her back.
   */
  cameraPitch(h) {
    let best = CAM_PITCHES[0], bestReach = -1;
    for (const p of CAM_PITCHES) {
      const reach = this.cameraReach(h, this.cameraOffset(p));
      if (reach >= CAM_DIST * 0.75) return p;
      if (reach > bestReach) { bestReach = reach; best = p; }
    }
    return best;
  },

  render() {
    if (!this.scene || this.warming) return; // (shaders still compiling behind the LOADING card)
    const h = this.hero.position, st = this.g.state;
    const target = this.cameraPitch(h), snap = this.camPitch === null;
    // tilt up quickly to get out from behind a wall; settle back down gently
    this.camPitch = snap ? target : this.camPitch + (target - this.camPitch) * (target > this.camPitch ? 0.3 : 0.08);
    const off = this.cameraOffset(this.camPitch);
    const want = h.clone().add(off.multiplyScalar(this.cameraReach(h, off) / CAM_DIST));
    // smoothed follow that eases toward a look-ahead point in the direction she's heading
    const k = snap ? 1 : 1 - Math.pow(0.0005, this.frameDt || 1 / 60);
    if (snap) this.cam.position.copy(want); else this.cam.position.lerp(want, Math.max(0.12, k));
    // Aim past her into the room (she sits below centre, the space ahead reads), plus a little
    // look-ahead the way she's running.
    const la = this._look || (this._look = h.clone());
    const ahead = 1.5, cx = -Math.sin(this.yaw) * ahead, cz = -Math.cos(this.yaw) * ahead;
    const fwdX = Math.sin(this.hero.rotation.y) * 0.9, fwdZ = Math.cos(this.hero.rotation.y) * 0.9;
    const tx = h.x + cx + fwdX * (this.moving || 0), tz = h.z + cz + fwdZ * (this.moving || 0);
    if (snap) la.set(tx, h.y, tz);
    la.x += (tx - la.x) * Math.max(0.1, k * 0.7);
    la.z += (tz - la.z) * Math.max(0.1, k * 0.7);
    la.y = h.y;
    this.cam.lookAt(la.x, la.y + 0.55, la.z);
    if (st.intox > 30) {
      const k = (st.intox - 30) / 70;
      this.cam.rotation.z += Math.sin(this.t * 1.3) * 0.08 * k;
      this.cam.fov = 58 + Math.sin(this.t * 0.9) * 6 * k;
      this.cam.updateProjectionMatrix();
    }
    if (this.shadows) this.shadows.update();
    for (const p of this.particles || []) p.update(this.t, this.renderer, this.cam);
    lookFrame(this.renderer);
    this.renderer.render(this.scene, this.cam);
  },
};
