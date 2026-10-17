// Supergirl's brawl poses that no clip has, bent bone by bone over a standing clip (HeroModel.aim):
//   powerPose  street clear: the classic hero stance, both fists on her hips (elbows out), feet
//              apart, chest and chin up; the happyIdle clip under it keeps her breathing.
//   heatVision heat vision / freeze breath: arms straight and swept back, fists by her hips, leaning
//              in with her chest thrust forward and her head up, eyes on the beam (level ahead).
// Directions come from her own bones (hips → neck = up, shoulders = across), so they hold for any yaw.
import * as THREE from 'three';

const _p = [0, 1, 2, 3].map(() => new THREE.Vector3());
const up = new THREE.Vector3(), left = new THREE.Vector3(), fwd = new THREE.Vector3(), lvl = new THREE.Vector3();
const V = [0, 1, 2].map(() => new THREE.Vector3());

/** Her body axes from the current pose: up (hips → neck), left (her left), fwd (where she faces). */
function axes(m) {
  const b = m.bones;
  m.root.updateWorldMatrix(true, true);
  const hips = b.Hips.getWorldPosition(_p[0]), neck = b.Neck.getWorldPosition(_p[1]);
  const L = b.LeftArm.getWorldPosition(_p[2]), R = b.RightArm.getWorldPosition(_p[3]);
  up.subVectors(neck, hips).normalize();
  left.subVectors(L, R).normalize();
  fwd.crossVectors(left, up).normalize();
  lvl.set(fwd.x, 0, fwd.z).normalize(); // ahead of her, level with the ground (the beam's line)
}

/** A world direction from (down, forward, out) in her body frame; out: away from her side (sg ±1 = Left / Right). */
const D = (i, down, fw, out, sg) => V[i].copy(up).multiplyScalar(-down).addScaledVector(fwd, fw).addScaledVector(left, out * sg).normalize();

/** Both fists on her hips, elbows out wide; feet a little wider than the clip's; chest up, chin up. t: her breathing. */
export function powerPose(m, t = 0) {
  if (!m.bones.LeftArm) return;
  const br = Math.sin(t * 1.6) * 0.03;
  axes(m);
  // chest up and open, chin raised a touch
  m.aim('Spine2', 'Neck', V[0].copy(up).addScaledVector(fwd, -0.06 - br).normalize(), 0.7);
  m.aim('Neck', 'Head', V[0].copy(up).addScaledVector(fwd, 0.04).normalize(), 0.8);
  m.aim('Head', 'HeadTop_End', V[0].copy(up).addScaledVector(fwd, -0.14).normalize(), 0.8);
  axes(m);
  for (const [S, sg] of [['Left', 1], ['Right', -1]]) {
    m.aim(`${S}Arm`, `${S}ForeArm`, D(0, 0.62, -0.12, 0.78 + br, sg), 1);
    m.aim(`${S}ForeArm`, `${S}Hand`, D(1, 0.55, 0.12, -0.83, sg), 1);
    m.aim(`${S}Hand`, `${S}HandMiddle1`, D(2, 0.7, 0.05, -0.7, sg), 0.9);
    // stance: feet set apart under her, knees straight
    m.aim(`${S}UpLeg`, `${S}Leg`, D(0, 1, 0, 0.16, sg), 0.85);
    m.aim(`${S}Leg`, `${S}Foot`, D(1, 1, -0.02, 0.1, sg), 0.85);
  }
}

/** Heat vision / freeze breath: lean in, chest out, arms straight back with fists by her hips, eyes level on the beam. */
export function heatVision(m) {
  if (!m.bones.LeftArm) return;
  axes(m);
  const ahead = fwd.clone();
  // legs braced: her left foot forward, the right back (a planted push into the beam)
  m.aim('LeftUpLeg', 'LeftLeg', D(0, 1, 0.26, 0.1, 1), 0.9);
  m.aim('LeftLeg', 'LeftFoot', D(1, 1, 0.02, 0.06, 1), 0.9);
  m.aim('RightUpLeg', 'RightLeg', D(0, 1, -0.34, 0.1, -1), 0.9);
  m.aim('RightLeg', 'RightFoot', D(1, 1, -0.3, 0.06, -1), 0.9);
  // torso leans into it, the chest pushed ahead of her hips
  m.aim('Spine', 'Spine2', V[0].copy(up).addScaledVector(ahead, 0.5).normalize(), 1);
  m.aim('Spine2', 'Neck', V[0].copy(up).addScaledVector(ahead, 0.6).normalize(), 1);
  axes(m);
  // shoulders pulled back (the chest leads), arms straight past her hips, fists down by them
  for (const [S, sg] of [['Left', 1], ['Right', -1]]) {
    m.aim(`${S}Shoulder`, `${S}Arm`, D(0, 0.08, -0.4, 1, sg), 0.8);
    const dir = D(0, 1, -0.2, 0.2, sg);
    m.aim(`${S}Arm`, `${S}ForeArm`, dir, 1);
    m.aim(`${S}ForeArm`, `${S}Hand`, dir, 1);
    m.aim(`${S}Hand`, `${S}HandMiddle1`, dir, 0.9);
  }
  // head up off the lean so her eyes look level along the beam
  m.aim('Neck', 'Head', V[0].set(0, 1, 0).addScaledVector(lvl, 0.35).normalize(), 1);
  m.aim('Head', 'HeadTop_End', V[0].set(0, 1, 0).addScaledVector(lvl, -0.05).normalize(), 1);
}
