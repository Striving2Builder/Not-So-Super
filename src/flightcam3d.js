// Chase camera for the three.js flight slice. She is the shot: the camera rides close behind and
// above her and is AIMED so she sits at a fixed spot in the lower third, a little left of centre
// (the city opens out ahead of her), whatever the offset spring is doing. Speed widens the lens
// and pulls back; boost adds a kick and a sustained pull-back; low over the streets it lines up
// with the street canyon and drops lower (look down the avenue, not side-on at a wall); it never
// sits inside a tower; and a "patrol view" swings up and back to a raised three-quarter view for
// reading the map (pitch capped so the horizon stays in shot).
import * as THREE from 'three';
import { M } from './city3d.js';
import { clamp, lerp } from './util.js';

/** Framing per mode, in metres / degrees. Pairs are hover → full speed. */
const CAM = {
  chase: { dist: [6.2, 4.8], height: [0.7, 2.4], side: [0.4, 1.3], fov: [58, 70], at: [0.46, 0.64] }, // side: to her right → a 3/4 rear view // at = her spot on screen (x, y from top-left)
  boost: { dist: 0.6, height: 0.2, fov: 6, kickFov: 8 },         // sustained while boosting + a kick on the press
  canyon: { height: 1.4, at: [0.47, 0.62], fovUp: 4, snap: 0.62 }, // skim band: lower, along the street (snap ≈ 35°)
  patrol: { dist: 115, height: 85, fov: 60, at: [0.5, 0.66] },    // ≈ 27° down at the city: horizon along the top
  yawRate: 2.6,  // how fast the camera swings round behind her heading (1/s)
  orbitBack: 0.6, // drag-orbit eases back behind her at this rate while she's moving (1/s)
  roll: 0.1,      // camera roll into her turns (rad per unit bank)
  aimUp: 0.3,     // aim a little above her pivot (metres): her shoulders, not her hips
};

const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, -1), _o = new THREE.Vector3();
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class FlightCam3D {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(60, aspect, 0.3, 4500);
    this.yaw = null; this.orbit = 0; this.patrolK = 0; this.kick = 0; this.boostK = 0; this.canyonK = 0; this.roll = 0;
    this.pos = new THREE.Vector3(); // offset from her (sprung)
  }

  /** Stick (x right, y down) → world direction {x, y} (2D world: y south), relative to the camera. */
  steer(a) {
    if (this.yaw === null) return a;
    const fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
    return { x: fx * -a.y + -fy * a.x, y: fy * -a.y + fx * a.x };
  }

  boost() { this.kick = 1; }

  /**
   * h: overworld hero; frac: speed fraction; o: { patrol, boosting, canyon (0..1: low among
   * towers) }; solid(x, y, z) in world units → true inside a building.
   */
  update(h, dt, frac, o, solid) {
    const C = CAM.chase;
    if (this.yaw === null) this.yaw = h.ang;
    const ease = (k, want, rate) => k + (want - k) * Math.min(1, dt * rate);
    this.patrolK = ease(this.patrolK, o.patrol ? 1 : 0, o.patrol ? 2.2 : 4.5); // quick to swoop back down
    if (!o.patrol && this.patrolK < 0.01) this.patrolK = 0;
    this.boostK = ease(this.boostK, o.boosting ? 1 : 0, o.boosting ? 3 : 1.5);
    this.canyonK = ease(this.canyonK, o.canyon || 0, 2);
    this.kick = Math.max(0, this.kick - dt * 1.6);
    // Swing behind her heading (only while she's going somewhere). In the street canyons the
    // target heading snaps to the street axis when she's roughly along it, so the shot looks
    // down the avenue and the camera-relative stick keeps her flying straight along it.
    let want = h.ang;
    if (this.canyonK > 0.05) {
      const axis = Math.round(h.ang / (Math.PI / 2)) * (Math.PI / 2), off = wrap(h.ang - axis);
      const w = this.canyonK * clamp(1 - Math.abs(off) / CAM.canyon.snap, 0, 1);
      want = h.ang - off * w;
    }
    this.yaw += wrap(want - this.yaw) * Math.min(1, dt * CAM.yawRate * clamp(h.speed / 200, 0.15, 1));
    this.orbit *= 1 - Math.min(1, dt * CAM.orbitBack * clamp(h.speed / 150, 0, 1));
    this.roll = ease(this.roll, (h.bank || 0) * CAM.roll * (1 - this.patrolK), 4);
    const yaw = this.yaw + this.orbit, fx = Math.cos(yaw), fz = Math.sin(yaw);
    const hx = h.x * M, hy = h.z * M, hz = h.y * M;
    const B = CAM.boost, P = CAM.patrol, K = this.patrolK;
    const chaseDist = lerp(C.dist[0], C.dist[1], frac) + B.dist * this.boostK;
    const chaseUp = lerp(lerp(C.height[0], C.height[1], frac), CAM.canyon.height, this.canyonK) + B.height * this.boostK;
    const dist = lerp(chaseDist, P.dist, K), up = lerp(chaseUp, P.height, K);
    const side = lerp(C.side[0], C.side[1], frac) * (1 - K) * (1 - 0.6 * this.canyonK);
    _p.set(hx - fx * dist - fz * side, hy + up, hz - fz * dist + fx * side);
    // never inside a tower: walk from her toward the wanted spot, stop short of the first wall
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const x = lerp(hx, _p.x, f), y = lerp(hy, _p.y, f), z = lerp(hz, _p.z, f);
      if (solid(x / M, z / M, y / M + 2)) { const g = Math.max(0.15, (i - 1.5) / steps); _p.set(lerp(hx, _p.x, g), lerp(hy, _p.y, g) + 2, lerp(hz, _p.z, g)); break; }
    }
    _p.y = Math.max(_p.y, 2);
    // Spring the camera's OFFSET from her (not its absolute position): at 300 m/s an absolute
    // spring would trail 50 m behind. The offset eases, so turns and climbs still swing smoothly.
    _p.x -= hx; _p.y -= hy; _p.z -= hz;
    if (!this.placed) { this.pos.copy(_p); this.placed = true; }
    this.pos.lerp(_p, Math.min(1, dt * 5.5));
    this.cam.position.set(hx + this.pos.x, hy + this.pos.y, hz + this.pos.z);
    // lens first (the aim below depends on it)
    const fov = lerp(lerp(C.fov[0], C.fov[1], frac) + CAM.canyon.fovUp * this.canyonK + B.fov * this.boostK + B.kickFov * Math.sin(this.kick * Math.PI), P.fov, K);
    if (Math.abs(fov - this.cam.fov) > 0.05) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    // Aim: point the camera at her, then turn it so she lands on her screen spot.
    const ax = lerp(lerp(C.at[0], CAM.canyon.at[0], this.canyonK), P.at[0], K), ay = lerp(lerp(C.at[1], CAM.canyon.at[1], this.canyonK), P.at[1], K);
    const ty = Math.tan((this.cam.fov * Math.PI) / 360), tx = ty * this.cam.aspect;
    _c.set((ax * 2 - 1) * tx, -(ay * 2 - 1) * ty, -1).normalize(); // where she should be, camera space
    _d.set(hx, hy + CAM.aimUp, hz).sub(this.cam.position).normalize();
    _m.lookAt(_o, _d, _up); // camera -z along _d, no roll
    _q.setFromRotationMatrix(_m);
    _q2.setFromUnitVectors(_c, _z);                           // her spot → the screen centre
    this.cam.quaternion.copy(_q).multiply(_q2);
    if (this.roll) this.cam.rotateZ(-this.roll);
  }
}
