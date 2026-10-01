// Chase camera for the three.js flight slice: behind and above her on a spring, swinging round
// into her turns, pulling back and widening the lens with speed (plus a kick on boost), never
// inside a tower (it slides in along the line to her until the view is clear), and a "patrol
// view" that cranes up to a steep overhead shot for reading the map (auto at high patrol).
import * as THREE from 'three';
import { M } from './city3d.js';
import { clamp, lerp } from './util.js';

/** Framing per mode, in metres / degrees. chase: [distance, height] at hover → full speed. */
const CAM = {
  // close behind her (she fills the lower third, the city opens out ahead), looking a little high
  chase: { dist: [4.6, 7.5], height: [1.1, 1.9], fov: [62, 80], boostFov: 8, lookAhead: [5, 16], lookUp: [1.5, 1.1] },
  patrol: { dist: 95, height: 150, fov: 55 },
  yawRate: 2.6,  // how fast the camera swings round behind her heading (1/s)
  orbitBack: 0.6, // drag-orbit eases back behind her at this rate while she's moving (1/s)
};

const _p = new THREE.Vector3(), _t = new THREE.Vector3();

export class FlightCam3D {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(62, aspect, 0.3, 4500);
    this.yaw = null; this.orbit = 0; this.patrolK = 0; this.kick = 0;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); // offsets from her
  }

  /** Stick (x right, y down) → world direction {x, y} (2D world: y south), relative to the camera. */
  steer(a) {
    if (this.yaw === null) return a;
    const fx = Math.cos(this.yaw), fy = Math.sin(this.yaw);
    return { x: fx * -a.y + -fy * a.x, y: fy * -a.y + fx * a.x };
  }

  boost() { this.kick = 1; }

  /**
   * h: overworld hero; frac: speed fraction; patrol: want the overhead view; solid(x, y, z) in
   * world units → true inside a building.
   */
  update(h, dt, frac, patrol, solid) {
    const C = CAM.chase;
    if (this.yaw === null) this.yaw = h.ang;
    // swing behind her heading (only while she's actually going somewhere)
    let d = h.ang - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * CAM.yawRate * clamp(h.speed / 200, 0.15, 1));
    this.orbit *= 1 - Math.min(1, dt * CAM.orbitBack * clamp(h.speed / 150, 0, 1));
    this.patrolK += ((patrol ? 1 : 0) - this.patrolK) * Math.min(1, dt * (patrol ? 2.2 : 4.5)); // quick to swoop back down
    if (!patrol && this.patrolK < 0.01) this.patrolK = 0;
    this.kick = Math.max(0, this.kick - dt * 1.6);
    const yaw = this.yaw + this.orbit, fx = Math.cos(yaw), fz = Math.sin(yaw);
    const hx = h.x * M, hy = h.z * M, hz = h.y * M;
    const dist = lerp(lerp(C.dist[0], C.dist[1], frac), CAM.patrol.dist, this.patrolK);
    const up = lerp(lerp(C.height[0], C.height[1], frac), CAM.patrol.height, this.patrolK);
    _p.set(hx - fx * dist, hy + up, hz - fz * dist);
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
    const ahead = lerp(C.lookAhead[0], C.lookAhead[1], frac) * (1 - this.patrolK);
    _t.set(fx * ahead, lerp(C.lookUp[0], C.lookUp[1], frac) * (1 - this.patrolK), fz * ahead);
    if (!this.lookPlaced) { this.look.copy(_t); this.lookPlaced = true; }
    this.look.lerp(_t, Math.min(1, dt * 8));
    this.cam.position.set(hx + this.pos.x, hy + this.pos.y, hz + this.pos.z);
    this.cam.lookAt(hx + this.look.x, hy + this.look.y, hz + this.look.z);
    const fov = lerp(lerp(C.fov[0], C.fov[1], frac) + C.boostFov * Math.sin(this.kick * Math.PI), CAM.patrol.fov, this.patrolK);
    if (Math.abs(fov - this.cam.fov) > 0.05) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
  }
}
