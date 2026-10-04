// Supergirl's flight body language (3D flight): her whole-body attitude and procedural bone offsets
// on top of the fly / idle clips, blended from the flight state, so every shot isn't the same stiff
// silhouette. Bones only (no extra clips, no extra draw calls): a handful of aims per frame.
//   CRUISE  right fist forward, left arm tucked, chest up, chin up (she looks where she goes), left
//           knee bent: the classic flying pose
//   BOOST   both fists punched forward together, head tucked, body and legs locked straight
//   DIVE    head-first, arms swept back along her sides, legs together (a stooping hawk)
//   SLOW    tilted up into a glide, one arm reaching ahead, the other out for balance, legs dangling
//   HOVER   upright: toes pointed, one knee lifted, a slow float bob
//   TURNS   roll into the bank on a spring (a little overshoot), head and fist lead into the turn,
//           legs swing to the outside; CLIMB / DESCEND pitch her with her vertical speed
import * as THREE from 'three';

/** Tunables (radians, unit-less weights; speeds in overworld units/s). */
export const FLY_POSE = {
  flyFrom: 14, flyFull: 70,   // speed where her horizontal flying pose starts / is full
  slowTo: 320,                // below this she tilts up into the slow glide (full at flyFull)
  bank: 0.95,                 // roll per unit of the flight model's bank
  boostBank: 1.2,             // (× at boost: tighter, more committed)
  rollSpring: [9, 0.5],       // [rad/s, damping]: rolls in with a small overshoot
  pitchSpring: [7, 0.8],
  slip: 0.16,                 // yaw her head into the turn (rad per unit bank)
  slowPitch: 0.55,            // glide: head-up tilt
  hoverLean: 0.2,
  climb: 0.85,                // body pitch per rad of climb angle (atan(vz / speed))
  climbMax: 0.6,
  divePitch: 1.15,
  chin: [1.6, 0.9, 0.5, 1.2], // head lift toward her back (tan of the crown's angle): cruise / boost / dive / slow
  arch: [0.35, 0.05, 0, 0.55],  // chest lift: cruise / boost / dive / slow
  bob: [0.05, 0.015],         // float bob (m): hover / flying
};

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (cur, want, rate, dt) => cur + (want - cur) * Math.min(1, dt * rate);
function spring(s, target, dt, [w, z]) {
  const a = w * w * (target - s.x) - 2 * z * w * s.v;
  s.v += a * dt; s.x += s.v * dt;
  return s.x;
}

const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _a = new THREE.Vector3();

export class FlightPose {
  constructor() {
    this.fly = null; this.boost = 0; this.dive = 0; this.slow = 0; this.turn = 0; this.climb = 0; this.hoverK = 0;
    this.roll = { x: 0, v: 0 }; this.pitch = { x: 0, v: 0 }; this.yaw = 0;
    this.lastZ = null; this.vz = 0;
    // body axes (world) and scratch, reused every frame
    this.f = new THREE.Vector3(); this.s = new THREE.Vector3(); this.l = new THREE.Vector3(); this.dn = new THREE.Vector3(0, -1, 0);
    this.v = [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3());
    this.hl = new THREE.Vector3(); this.hr = new THREE.Vector3(); this.mid = new THREE.Vector3(); this.inw = new THREE.Vector3();
  }

  /**
   * Blend weights + her attitude from the overworld hero. Returns { pitch, roll, yaw, bob } for the
   * pivot (pitch > 0 = head up; roll > 0 = banked right). dt may be 0 (a re-pose, no time passes).
   */
  step(h, dt, t, diving, boost, patrol) {
    const P = FLY_POSE;
    const perch = !!h.perch;
    // vertical speed (overworld units/s) from her height, smoothed: climbs and descents pitch her
    if (this.lastZ !== null && dt > 0) this.vz = ease(this.vz, clamp((h.z - this.lastZ) / dt, -900, 900), 5, dt);
    this.lastZ = h.z;
    const want = perch ? 0 : diving ? 1 : Math.max(smooth(P.flyFrom, P.flyFull, h.speed), patrol > 0.5 ? 0.85 : 0);
    if (this.fly === null) this.fly = want;
    this.fly = ease(this.fly, want, want > this.fly ? 6 : 1.6, dt); // (falls back slowly: a bump off a tower doesn't stand her up)
    const fk = this.fly;
    this.boost = ease(this.boost, boost && !diving ? 1 : 0, 6, dt);
    this.dive = ease(this.dive, diving ? 1 : 0, 5, dt);
    this.slow = ease(this.slow, perch || diving || patrol > 0.5 ? 0 : 1 - smooth(P.flyFull, P.slowTo, h.speed), 3, dt);
    this.turn = ease(this.turn, perch ? 0 : clamp(h.bank * 1.4, -1, 1), 5, dt);
    const ca = diving || perch ? 0 : clamp(Math.atan2(this.vz, Math.max(h.speed, 140)), -P.climbMax, P.climbMax);
    this.climb = ease(this.climb, ca, 4, dt);
    this.hover = !perch && !diving && fk < 0.3;
    this.hoverK = ease(this.hoverK, this.hover ? 1 : 0, 4, dt);
    // attitude
    let pitch;
    if (perch || this.hover) pitch = -h.lean * P.hoverLean;
    else if (diving) pitch = -P.divePitch;
    else pitch = (1 - fk) * P.slowPitch + this.slow * P.slowPitch * 0.8 + this.climb * P.climb * fk - h.lean * 0.25;
    const roll = perch ? 0 : h.bank * P.bank * (1 + (P.boostBank - 1) * this.boost) * (this.hover ? 0.5 : 1);
    if (!this.init) { this.init = true; this.pitch.x = pitch; this.roll.x = roll; }
    if (dt > 0) { spring(this.pitch, pitch, dt, P.pitchSpring); spring(this.roll, roll, dt, P.rollSpring); }
    this.yaw = ease(this.yaw, perch ? 0 : -h.bank * P.slip * fk, 6, dt);
    const bob = perch ? 0 : Math.sin(t * 1.7) * (P.bob[0] * this.hoverK + P.bob[1] * (1 - this.hoverK));
    return { pitch: this.pitch.x, roll: this.roll.x, yaw: this.yaw, bob };
  }

  /** Rotate a bone about a world axis (ang rad), keeping its children attached. */
  twist(m, name, axis, ang) {
    const b = m.bones[name];
    if (!b || Math.abs(ang) < 1e-4) return;
    b.parent.getWorldQuaternion(_pq);
    _q.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(_pq).premultiply(_q).premultiply(_pq.invert());
    b.updateWorldMatrix(false, true);
  }

  /** Weighted blend of directions [[w, x, y, z-ish vector], ...] into out (normalized). */
  mix(out, terms) {
    out.set(0, 0, 0);
    for (const [w, d] of terms) if (w > 1e-3) out.addScaledVector(_a.copy(d).normalize(), w);
    return out.lengthSq() > 1e-6 ? out.normalize() : null;
  }

  /** Body axes from the model root: f = head-first flight direction, s = her back (sky), l = her left. */
  axes(m) {
    m.root.updateWorldMatrix(true, true);
    const q = m.root.getWorldQuaternion(_q);
    this.f.set(0, 0, 1).applyQuaternion(q); this.s.set(0, 1, 0).applyQuaternion(q); this.l.set(1, 0, 0).applyQuaternion(q);
  }

  /** Bone offsets for the flying poses (after the clip; k = how much she's flying, 0..1). */
  flying(m, k, t) {
    if (k <= 0.01 || !m.bones.LeftArm) return;
    this.axes(m);
    const { f, s, l } = this, P = FLY_POSE, V = this.v, T = this.turn;
    const bk = this.boost * (1 - this.dive), dv = this.dive, sl = this.slow * (1 - bk) * (1 - dv), cr = Math.max(0, 1 - bk - dv - sl);
    const W = (c) => c.reduce((a, [w]) => a + w, 0);
    const D = (i, x, y, z) => V[i].copy(f).multiplyScalar(x).addScaledVector(s, y).addScaledVector(l, z);
    const into = -T; // her left is +l: a right turn (T > 0) leans toward -l
    // ---- spine: chest lifted at cruise / slow, flat at boost; twists a little into the bank
    const arch = cr * P.arch[0] + bk * P.arch[1] + dv * P.arch[2] + sl * P.arch[3] + Math.max(0, this.climb) * 0.4;
    if (arch > 0.01) m.aim('Spine1', 'Spine2', D(0, 1, arch, 0).normalize(), 0.6 * k);
    this.twist(m, 'Spine2', f, T * 0.22 * k);
    // ---- head: chin up so she looks where she's going (her face reads from the front, the back of
    // her head from the chase camera), turned and tilted into the turn
    const chin = cr * P.chin[0] + bk * P.chin[1] + dv * P.chin[2] + sl * P.chin[3] + this.climb * 0.3;
    const crown = D(1, 1, chin, into * 0.25).normalize();
    m.aim('Neck', 'Head', crown, 0.55 * k);
    m.aim('Head', 'HeadTop_End', crown, k);
    this.twist(m, 'Head', crown, -T * 0.35 * k);
    // ---- arms (upper, fore) per pose, blended
    const arm = (side, sg) => {
      // sg = +1 left / -1 right; the right arm leads at cruise
      const lead = sg < 0;
      const up = this.mix(V[2], [
        [cr, lead ? D(3, 1, 0.08, -0.05 + into * 0.3) : D(3, -1, -0.12, 0.38)],
        [bk, D(4, 1, 0.04, sg * 0.03 + into * 0.15)],
      ]);
      const terms = [];
      if (up) terms.push([cr + bk, V[5].copy(up)]);
      terms.push([dv, D(3, -1, 0.15, sg * 0.28)]);
      terms.push([sl, lead ? D(4, 0.6, -0.7, -0.22) : D(4, 0.05, -0.9, 0.5)]);
      const u = this.mix(V[2], terms);
      if (u) m.aim(`${side}Arm`, `${side}ForeArm`, u, k);
      const fore = this.mix(V[2], [
        [cr, lead ? D(3, 1, 0.08, -0.05 + into * 0.3) : D(3, -1, -0.22, 0.12)],
        [bk, D(4, 1, 0.02, -sg * 0.05)],
        [dv, D(0, -1, 0.1, sg * 0.18)],
        [sl, lead ? D(1, 0.85, -0.35, -0.1) : D(1, 0.5, -0.7, 0.3)],
      ]);
      if (fore) m.aim(`${side}ForeArm`, `${side}Hand`, fore, k);
    };
    arm('Right', -1); arm('Left', 1);
    // ---- legs: one tapering line behind her at speed (one knee bent at cruise), dangling when slow
    const hl = m.bones.LeftUpLeg.getWorldPosition(this.hl), hr = m.bones.RightUpLeg.getWorldPosition(this.hr);
    const mid = this.mid.addVectors(hl, hr).multiplyScalar(0.5);
    const dn = this.dn;
    for (const [L, hip, sg] of [['Left', hl, 1], ['Right', hr, -1]]) {
      const inward = this.inw.subVectors(mid, hip).normalize();
      const out = -into * 0.3; // swing to the outside of the turn
      const wob = 0.02 * Math.sin(t * 3 + sg);
      const thigh = this.mix(V[2], [
        [cr + bk + dv, D(0, -1, -0.06 + 0.04 * bk, out).addScaledVector(inward, 0.12 + 0.04 * bk)],
        [sl, V[1].copy(dn).multiplyScalar(0.75).addScaledVector(f, sg < 0 ? -0.15 : -0.5).addScaledVector(inward, 0.06)],
      ]);
      if (thigh) m.aim(`${L}UpLeg`, `${L}Leg`, thigh, k * 0.95);
      const bend = cr * (sg > 0 ? 0.65 : 0.1) * (1 - Math.abs(T) * 0.5); // the left knee bends at cruise
      const shin = this.mix(V[2], [
        [cr, D(0, -1, bend, out * 0.8).addScaledVector(inward, 0.06 + wob)],
        [bk + dv, D(3, -1, 0, out * 0.5).addScaledVector(inward, 0.08)],
        [sl, V[1].copy(dn).multiplyScalar(0.7).addScaledVector(f, sg < 0 ? -0.35 : -0.85)],
      ]);
      if (shin) {
        m.aim(`${L}Leg`, `${L}Foot`, shin, k * 0.95);
        m.aim(`${L}Foot`, `${L}ToeBase`, V[3].copy(shin).addScaledVector(s, -0.15).normalize(), k * 0.8); // pointed toes
      }
    }
  }

  /** Upright hover (on the idle clip): toes pointed, the right knee lifted. */
  hovering(m, k) {
    if (k <= 0.01 || !m.bones.LeftFoot) return;
    this.axes(m);
    const { f, l } = this, V = this.v, dn = this.dn;
    m.aim('RightUpLeg', 'RightLeg', V[0].copy(dn).addScaledVector(f, 0.45).addScaledVector(l, -0.05).normalize(), k * 0.8);
    m.aim('RightLeg', 'RightFoot', V[0].copy(dn).addScaledVector(f, -0.35).normalize(), k * 0.8);
    m.aim('LeftUpLeg', 'LeftLeg', V[0].copy(dn).addScaledVector(l, 0.06).addScaledVector(f, 0.05).normalize(), k * 0.6);
    m.aim('LeftLeg', 'LeftFoot', V[0].copy(dn).addScaledVector(f, -0.05).normalize(), k * 0.6);
    for (const L of ['Left', 'Right']) m.aim(`${L}Foot`, `${L}ToeBase`, V[1].copy(dn).addScaledVector(f, 0.35).normalize(), k * 0.85);
  }
}
