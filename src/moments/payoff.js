// r11 F2c: the payoff on her body. After a catch the rescued thing rides WITH her for PAYOFF.hold
// seconds, placed in the chase camera's own frame (so it is always on screen, whatever her heading):
// the car hoisted over her head side-on to the lens, the chopper hanging just under and ahead of her,
// the window-washer in her arms at her side, the kitten held up by her shoulder. The lens punches in
// a few degrees while she holds it, and the verdict panel stays up for the same hold (verdict.js).
// F2b placed these by her heading in world space: the car ended above the top of the frame and the
// chopper below the bottom edge.
import * as THREE from 'three';
import { M } from '../city3d.js';

export const PAYOFF = {
  hold: 2.6,   // seconds the payoff rides with her (airevents' carry, the verdict panel)
  lens: -5,    // degrees: the lens punches in while she holds it (lens only, the rig stays)
  setDown: 0.45, // the last seconds: the car is lowered out of frame (set down)
  // per kind, placed on SCREEN round her (fractions of the screen: dx right, dy down) at her depth
  // + `depth` metres further from the lens, and the actor's scale × its base
  car: { dx: 0.02, dy: -0.21, depth: 0.8, k: 0.5 },
  heli: { dx: 0.2, dy: 0.21, depth: 3, k: 0.45 },
  faller: { dx: 0.075, dy: 0.06, depth: -0.2, k: 0.62 },
  kitten: { dx: 0.06, dy: -0.1, depth: -0.3, k: 0.42 },
};

const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _p = new THREE.Vector3();

/** True while the payoff of a catch is on (the message lane and the lens read this). */
export const carrying = (ow) => !!ow.events?.carry;

/**
 * Place the carried actor this frame. slot(key, name, role) is drawAir3d's pooled-actor getter
 * (it scales a new actor once: we rescale here every frame, the pool is shared with the events).
 */
export function drawCarry(dir, view, slot) {
  const ow = dir.ow, C = ow.events.carry, cam = view.cam?.cam, hero = view.hero?.group;
  if (!C || !cam || !hero) return null;
  const P = PAYOFF[C.kind];
  if (!P) return null;
  cam.getWorldDirection(_f);
  const t = ow.t, end = Math.max(0, (C.t - (PAYOFF.hold - PAYOFF.setDown)) / PAYOFF.setDown); // 0..1 over the set-down
  // her spot on screen (NDC), then the payoff's spot beside it, at her depth + P.depth
  _u.copy(hero.position).project(cam);
  const nx = Math.max(-0.9, Math.min(0.9, _u.x + P.dx * 2)), ny = Math.max(-0.8, Math.min(0.8, _u.y - P.dy * 2 - (C.kind === 'car' ? end * 0.9 : 0)));
  _r.copy(hero.position).addScaledVector(_f, P.depth).project(cam);
  _p.set(nx, ny, _r.z).unproject(cam);
  const x = _p.x / M, y = _p.z / M, z = _p.y / M;
  const yaw = Math.atan2(_f.z, _f.x); // (world heading of the lens)
  let a;
  if (C.kind === 'car') {
    a = slot(C, 'car', C.getaway ? 'car:getaway' : 'car:runaway');
    a.at(x, y, z, yaw + Math.PI / 2 + 0.25 * Math.sin(t * 2.2), 0.12 * Math.sin(t * 7), 0.1 + 0.08 * Math.sin(t * 5)); // side-on, a wobble under the weight
  } else if (C.kind === 'heli') {
    a = slot(C, 'heli', 'heli:news');
    a.at(x, y, z, yaw + Math.PI / 2 + 0.3, 0, 0.12 * Math.sin(t * 3)); a.rotor.rotation.y += 0.25;
  } else if (C.kind === 'faller') {
    a = slot(C, 'p', 'person:washer');
    a.pose('cheer').at(x, y, z, yaw + Math.PI, 0.35, 0.2 * Math.sin(t * 3)); // facing the lens, leaning in her arms
  } else {
    a = slot(C, 'cat', 'cat');
    a.at(x, y, z, yaw + Math.PI * 0.8, 0, Math.sin(t * 4) * 0.12);
  }
  a.group.scale.setScalar(a.base * P.k);
  C.at = { x, y, z };
  return a;
}
