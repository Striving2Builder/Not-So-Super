// The RLD Walk's camera: the level to try the over-the-shoulder zoom on (act2.md: "the street
// corridors are narrow and the windows are the point"). The zones' follow camera (camera3d.js) at the
// player's Camera setting, but never further than Close here, a little lower, and set off over her
// right shoulder so the street and its windows run past on the left. ?rldcam=far plays it at the
// player's setting with no shoulder offset (for A/B looks). Mixed into RldWalk.prototype.
import { CAM_DIST, CAM_PITCHES } from '../zonekit.js';
import { camStep } from '../settings.js';
import { lookFrame } from '../look3d.js';

const OTS = { k: 0.6, dp: 0.14, side: 0.6, aimSide: 0.35 };
const plain = (() => { try { return new URLSearchParams(location.search).get('rldcam') === 'far'; } catch (e) { return false; } })();

/** [distance, pitches, k, shoulder]: the walk's camera at the player's setting. */
export function walkCam() {
  const { k, dp } = camStep();
  if (plain) return [CAM_DIST * k, dp ? [Math.max(0.35, CAM_PITCHES[0] - dp), ...CAM_PITCHES.slice(1)] : CAM_PITCHES, k, 0];
  const kk = Math.min(k, OTS.k), d = Math.max(dp, OTS.dp);
  return [CAM_DIST * kk, [Math.max(0.35, CAM_PITCHES[0] - d), ...CAM_PITCHES.slice(1)], kk, OTS.side];
}

export const cameraMethods = {
  render() {
    if (!this.scene || this.warming) return;
    this.setClip();
    const h = this.hero.position, st = this.g.state;
    const [dist, pitches, ck, side] = walkCam();
    const target = this.cameraPitch(h, dist, pitches), snap = this.camPitch === null;
    this.camPitch = snap ? target : this.camPitch + (target - this.camPitch) * (target > this.camPitch ? 0.3 : 0.08);
    // behind her, plus the shoulder (her right, as the camera sees it); pulled in where a wall cuts it
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const off = this.cameraOffset(this.camPitch, dist);
    const len = off.length();
    off.x += rx * side; off.z += rz * side;
    const want = h.clone().add(off.multiplyScalar(Math.min(1, this.cameraReach(h, off) / len)));
    const k = snap ? 1 : 1 - Math.pow(0.0005, this.frameDt || 1 / 60);
    if (snap) this.cam.position.copy(want); else this.cam.position.lerp(want, Math.max(0.12, k));
    const la = this._look || (this._look = h.clone());
    const ahead = 1.5 * (0.5 + 0.5 * ck), cx = -Math.sin(this.yaw) * ahead + rx * side * OTS.aimSide, cz = -Math.cos(this.yaw) * ahead + rz * side * OTS.aimSide;
    const fwdX = Math.sin(this.hero.rotation.y) * 0.9, fwdZ = Math.cos(this.hero.rotation.y) * 0.9;
    const tx = h.x + cx + fwdX * (this.moving || 0), tz = h.z + cz + fwdZ * (this.moving || 0);
    if (snap) la.set(tx, h.y, tz);
    la.x += (tx - la.x) * Math.max(0.1, k * 0.7);
    la.z += (tz - la.z) * Math.max(0.1, k * 0.7);
    la.y = h.y;
    this.cam.lookAt(la.x, la.y + 0.75, la.z);
    if (st.intox > 30) {
      const q = (st.intox - 30) / 70;
      this.cam.rotation.z += Math.sin(this.t * 1.3) * 0.08 * q;
      this.cam.fov = 58 + Math.sin(this.t * 0.9) * 6 * q;
      this.cam.updateProjectionMatrix();
    } else if (this.cam.fov !== 58) { this.cam.fov = 58; this.cam.updateProjectionMatrix(); }
    if (this.shadows) this.shadows.update();
    for (const p of this.particles || []) p.update(this.t, this.renderer, this.cam);
    lookFrame(this.renderer);
    this.renderer.render(this.scene, this.cam);
  },
};
