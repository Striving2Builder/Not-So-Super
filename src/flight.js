// Flight model: pure physics + body dynamics, no rendering.
// Speed comes from how far the stick is pushed; acceleration is snappy, stopping is a glide,
// and turn rate falls with speed so she carves wide arcs when fast and pivots when slow.
import { clamp, lerp } from './util.js';

export const FLIGHT = {
  cruise: 560,          // top speed without boost
  boost: 1150,          // top speed with boost
  sonic: 1000,          // crossing this while boosting = sonic boom
  accel: 950,           // units/s² toward cruise speed
  boostAccel: 1800,     // units/s² while boosting (the "kick")
  glide: 520,           // units/s² of deceleration when coasting (no input)
  brake: 1400,          // units/s² when steering hard against the motion
  turnSlow: 8,          // rad/s turn rate at hover speed
  turnFast: 1.5,        // rad/s turn rate at full boost
  hoverBelow: 110,      // below this speed she pitches upright into a hover
};

/**
 * Altitude bands. `speedMul` scales top speed; `vice` scales tabloid heat gained over vice
 * districts (photographers can't snap you from high up). The camera rides CAM_ABOVE units above her,
 * so climbing naturally widens the view and skimming makes the towers loom.
 */
export const BANDS = [
  { id: 'skim', z: 150, speedMul: 0.8, vice: 1.8, label: 'Rooftop skim' },
  { id: 'cruise', z: 360, speedMul: 1, vice: 1.1, label: 'Cruising' },
  { id: 'high', z: 620, speedMul: 1.3, vice: 0.4, label: 'High patrol' },
];
export const CRUISE_BAND = 1;
export const CAM_ABOVE = 740;
const CLIMB_RATE = 380; // units/s

/** Ease toward the current band's height (or a perch). */
export function stepAltitude(h, dt) {
  const target = h.perch ? h.perch.z : BANDS[h.band].z;
  const d = target - h.z;
  // proportional ease, capped, with a minimum rate so landings finish decisively
  const step = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * 3, 90) * dt, CLIMB_RATE * dt);
  h.z += step;
}

/**
 * Advance the hero one step. `h` holds {x, y, ang, speed, bank, lean, hover, vx, vy}.
 * `a` is the stick {x, y} (magnitude 0..1). Returns one-shot events for FX/audio.
 */
export function stepFlight(h, a, boosting, dt, speedMul = 1) {
  const ev = { boostStart: false, sonic: false };
  const mag = Math.min(1, Math.hypot(a.x, a.y));
  const top = (boosting ? FLIGHT.boost : FLIGHT.cruise) * speedMul;
  const target = mag * top;
  const prev = h.speed || 0;

  // Heading: steer toward the stick with a speed-dependent turn rate.
  let omega = 0;
  if (mag > 0.08) {
    const want = Math.atan2(a.y, a.x);
    let da = want - h.ang;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const rate = lerp(FLIGHT.turnSlow, FLIGHT.turnFast, clamp(prev / FLIGHT.boost, 0, 1));
    const step = clamp(da, -rate * dt, rate * dt);
    h.ang += step;
    omega = step / Math.max(dt, 1e-4);
    // Pushing hard against the direction of travel bleeds speed (a braking turn).
    if (Math.abs(da) > 2.2 && prev > 200) h.speed = Math.max(0, prev - FLIGHT.brake * dt);
  }

  // Speed: accelerate toward the target, glide down when easing off.
  let s = h.speed ?? prev;
  if (target > s) s = Math.min(target, s + (boosting ? FLIGHT.boostAccel : FLIGHT.accel) * dt);
  else s = Math.max(target, s - FLIGHT.glide * dt);
  h.speed = s;
  if (boosting && !h.wasBoosting && mag > 0.2) ev.boostStart = true;
  if (s >= FLIGHT.sonic && prev < FLIGHT.sonic) ev.sonic = true;
  h.wasBoosting = boosting;

  h.vx = Math.cos(h.ang) * s;
  h.vy = Math.sin(h.ang) * s;
  h.x += h.vx * dt;
  h.y += h.vy * dt;

  // Body language (smoothed): bank from turn rate × speed, lean from acceleration, hover when slow.
  const k = Math.min(1, dt * 6);
  h.bank = lerp(h.bank || 0, clamp((omega * s) / 1400, -1, 1), k);
  h.lean = lerp(h.lean || 0, clamp((s - prev) / Math.max(dt, 1e-4) / 2000, -1, 1), Math.min(1, dt * 4));
  h.hover = lerp(h.hover ?? 1, s < FLIGHT.hoverBelow ? 1 : 0, Math.min(1, dt * 3));
  return ev;
}

/** Camera helpers derived from the flight state. */
export function speedFraction(h) { return clamp((h.speed || 0) / FLIGHT.boost, 0, 1); }
export function cameraZoom(h) { return 1 - 0.24 * speedFraction(h); }       // pull out with speed
export function cameraLead(h) { return 0.25 + 0.3 * speedFraction(h); }       // seconds of look-ahead
