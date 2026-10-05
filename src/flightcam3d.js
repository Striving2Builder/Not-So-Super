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

/**
 * Framing per mode, in metres / degrees. Pairs are hover → full speed. Every `at` (her spot on
 * screen) stays inside the central safe zone: never under the narrator caption (left, mid-height),
 * the LIVE panel (top right), the stick (bottom left) or the thumb buttons (bottom right).
 */
const CAM = {
  // side: to her right, so the camera sits ~25-35° off her tail (a 3/4 rear-side view: her profile,
  // the cape and the punching arm read; straight behind she's a lump of boots and hair)
  chase: { dist: [4.4, 3.2], height: [0.7, 1.15], side: [1.7, 2.1], fov: [58, 66], at: [0.52, 0.58] }, // at = her spot on screen (x, y from top-left)
  dive: { closer: 0.35, up: 2.6, rate: 2.5 }, // the dive (a transition, not the chase framing): the camera pulls in (her ~1.5× on screen at the impact) and rises (m) to look down past her at the street rushing up; ease rate
  boost: { dist: 0.7, height: 0.15, fov: 13, dollyK: 0.6, kickFov: 8, shake: [0.035, 0.14], lag: 2.6 }, // shake m: sustained / on the punch; lag = spring rate         // sustained while boosting + a kick on the press
  canyon: { height: 1.3, dist: 3.1, at: [0.5, 0.58], fovUp: 4, snap: 0.62, side: 0.75 }, // skim band: lower, along the street (snap ≈ 35°); side: × the chase side
  // high patrol, flying: level with her, centred in the safe zone against the sky,
  // the city's far edge down in the bottom third (the Superman-over-the-city shot)
  high: { dist: 3.3, height: 0.15, side: 1.6, at: [0.56, 0.56], from: 760, to: 1000 }, // from/to: altitude (world units) it blends in over
  patrol: { dist: 78, height: 58, side: 60, fov: 60, at: [0.55, 0.58] }, // ≈ 30° down at the city, from her 3/4 rear-side (her side reads): horizon along the top
  maxElev: [24, 36], // camera elevation above her (deg), flying / patrol view: never down onto her back
  maxAz: 42,         // camera angle off her tail (deg) while flying: 3/4 rear-side, never fully side-on
  yawRate: 2.6,  // how fast the camera swings round behind her heading (1/s)
  orbitBack: 0.6, // drag-orbit eases back behind her at this rate while she's moving (1/s)
  roll: 0.1,      // camera roll into her turns (rad per unit bank)
  aimUp: 0.3,     // aim a little above her pivot (metres): her shoulders, not her hips
  // camera collision (m): sphere radius, line-of-sight steps, side probes; when blocked it pulls in
  // first (pullIn × the distance, same height), then a modest lift (never a top-down shot of her back)
  wall: { radius: 1.6, steps: 10, probe: [3.5, 8], crowdK: 0.45, pullIn: 0.55, lift: 2.4, liftIn: 0.7, minT: 0.3 },
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
    this.boostK = ease(this.boostK, o.boosting ? 1 : 0, o.boosting ? 8 : 1.5); // (in fast: the lens and the ink lines snap open in ~150 ms)
    this.canyonK = ease(this.canyonK, o.canyon || 0, 2);
    this.diveK = ease(this.diveK || 0, o.diving ? 1 : 0, o.diving ? CAM.dive.rate : 6);
    this.highK = ease(this.highK || 0, clamp((h.z - CAM.high.from) / (CAM.high.to - CAM.high.from), 0, 1) * (o.diving ? 0 : 1), 3);
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
    // in a hard turn the lagging yaw (plus the side offset) and the offset spring swing the camera
    // fully side-on (she fills the frame edge to edge, a flat profile): keep the camera within maxAz
    // of her tail while flying, here for the yaw and below for the sprung offset
    const azLim = (CAM.maxAz * Math.PI) / 180, flying = h.speed > 60 && this.patrolK < 0.5;
    if (flying && this.sideA !== undefined) this.yaw = h.ang + clamp(wrap(this.yaw - h.ang), this.sideA - azLim, this.sideA + azLim);
    this.orbit *= 1 - Math.min(1, dt * CAM.orbitBack * clamp(h.speed / 150, 0, 1));
    this.roll = ease(this.roll, (h.bank || 0) * CAM.roll * (1 - this.patrolK), 4);
    const yaw = this.yaw + this.orbit, fx = Math.cos(yaw), fz = Math.sin(yaw);
    const hx = h.x * M, hy = h.z * M, hz = h.y * M;
    const B = CAM.boost, P = CAM.patrol, K = this.patrolK;
    const A = CAM.high, hk = this.highK * Math.min(1, frac * 3); // (stopped up high: the patrol view takes over)
    const chaseDist = lerp(lerp(lerp(C.dist[0], C.dist[1], frac), CAM.canyon.dist, this.canyonK * Math.min(1, frac * 4)), A.dist, hk) + B.dist * this.boostK;
    const chaseUp = lerp(lerp(lerp(C.height[0], C.height[1], frac), CAM.canyon.height, this.canyonK), A.height, hk) + B.height * this.boostK;
    const dist = lerp(chaseDist * (1 - CAM.dive.closer * this.diveK), P.dist, K), up = lerp(chaseUp + CAM.dive.up * this.diveK, P.height, K);
    const side = lerp(lerp(lerp(C.side[0], C.side[1], frac) * lerp(1, CAM.canyon.side, this.canyonK), A.side, hk), P.side, K);
    // Sphere-cast from her to each candidate spot (her usual shoulder, the other one, then both
    // pulled in, then both a little lifted) and take the clearest: a candidate loses for a blocked
    // line of sight, and for a tower face right beside the lens (the "one wall fills the frame" shot).
    const W = CAM.wall, sideSign = this.sideSign || 1;
    const ball = (x, y, z) => solid(x / M, z / M, y / M) || solid((x + W.radius) / M, z / M, y / M) || solid((x - W.radius) / M, z / M, y / M)
      || solid(x / M, (z + W.radius) / M, y / M) || solid(x / M, (z - W.radius) / M, y / M);
    // never look down onto her back: cap the camera's elevation above her
    const maxUp = Math.tan((lerp(CAM.maxElev[0], CAM.maxElev[1], K) * Math.PI) / 180);
    let best = null;
    for (const [sg, mode] of [[sideSign, 0], [-sideSign, 0], [sideSign, 1], [-sideSign, 1], [sideSign, 2], [-sideSign, 2]]) {
      const d = dist * (mode === 1 ? W.pullIn : mode === 2 ? W.liftIn : 1), sd = side * (mode === 1 ? W.pullIn : 1);
      const u = Math.min(up + (mode === 2 ? W.lift * (1 - K) : 0), Math.hypot(d, sd) * maxUp);
      const cx = hx - fx * d - fz * sd * sg, cy = hy + u, cz = hz - fz * d + fx * sd * sg;
      let t = 1;
      for (let i = 2; i <= W.steps; i++) {
        const f = i / W.steps;
        if (ball(lerp(hx, cx, f), lerp(hy, cy, f), lerp(hz, cz, f))) { t = (i - 1.5) / W.steps; break; }
      }
      let crowd = 0; // tower faces right beside the camera, either side
      for (const lat of W.probe) for (const k of [1, -1]) if (solid((cx - fz * lat * k) / M, (cz + fx * lat * k) / M, cy / M)) crowd += 1 / lat;
      const score = t * 2 - crowd * W.crowdK - (mode === 1 ? 0.25 : mode === 2 ? 0.4 : 0) - (sg !== sideSign ? 0.12 : 0);
      if (!best || score > best.score) best = { score, t, sg, cx, cy, cz };
      if (t === 1 && crowd === 0) break; // this spot is clean: done
    }
    this.sideSign = best.sg;
    this.sideA = Math.atan2(side * best.sg, dist); // (the side offset's own angle off her tail)
    const g = Math.max(W.minT, best.t);
    _p.set(lerp(hx, best.cx, g), lerp(hy, best.cy, g), lerp(hz, best.cz, g));
    _p.y = Math.max(_p.y, 2);
    // Spring the camera's OFFSET from her (not its absolute position): at 300 m/s an absolute
    // spring would trail 50 m behind. The offset eases, so turns and climbs still swing smoothly.
    _p.x -= hx; _p.y -= hy; _p.z -= hz;
    if (!this.placed) { this.pos.copy(_p); this.placed = true; }
    this.pos.lerp(_p, Math.min(1, dt * lerp(5.5, B.lag, this.boostK))); // (boost: the camera lags, she pulls ahead)
    if (flying) {
      const tail = h.ang + Math.PI, cur = Math.atan2(this.pos.z, this.pos.x), off = wrap(cur - tail);
      const base = wrap(Math.atan2(_p.z, _p.x) - tail), ok = clamp(off, Math.min(base, -azLim), Math.max(base, azLim)); // (unless the wanted spot itself is wider)
      if (ok !== off && Math.abs(this.orbit) < 0.05) { // (not while the player orbits by hand)
        const r = Math.hypot(this.pos.x, this.pos.z), a = tail + ok;
        this.pos.x = Math.cos(a) * r; this.pos.z = Math.sin(a) * r;
      }
    }
    // the spring may swing it through a corner: if the eased spot is inside a wall, cut to the safe one
    if (ball(hx + this.pos.x, hy + this.pos.y, hz + this.pos.z)) this.pos.copy(_p);
    // the boost lens widens (the city rushes out); the camera dollies in to match most of it (B.dollyK)
    const boostFov = (B.fov * this.boostK + B.kickFov * Math.sin(this.kick * Math.PI)) * (1 - K);
    const fov0 = lerp(lerp(C.fov[0], C.fov[1], frac) + CAM.canyon.fovUp * this.canyonK, P.fov, K), fov = fov0 + boostFov;
    const dolly = Math.pow(Math.tan((fov0 * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360), B.dollyK); // (partly: she drops back a little, the city rushes out round her)
    this.cam.position.set(hx + this.pos.x * dolly, hy + this.pos.y * dolly, hz + this.pos.z * dolly);
    // boost shake: a light rattle while boosting, a jolt on the punch
    const sh = (B.shake[0] * this.boostK + B.shake[1] * this.kick) * (1 - K);
    if (sh > 0.001) { const t = performance.now() / 1000; this.cam.position.x += Math.sin(t * 71) * sh; this.cam.position.y += Math.sin(t * 53 + 1) * sh; this.cam.position.z += Math.sin(t * 61 + 2) * sh; }
    // the lens (the aim below depends on it)
    if (Math.abs(fov - this.cam.fov) > 0.05) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    // Aim: point the camera at her, then turn it so she lands on her screen spot.
    const ax = lerp(lerp(lerp(C.at[0], CAM.canyon.at[0], this.canyonK), A.at[0], hk), P.at[0], K), ay = lerp(lerp(lerp(C.at[1], CAM.canyon.at[1], this.canyonK), A.at[1], hk), P.at[1], K);
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
