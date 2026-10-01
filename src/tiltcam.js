// PROTOTYPE: altitude-driven camera tilt for the flight view, behind a switch that defaults OFF.
// Enable with ?tilt=mild or ?tilt=strong (read once at boot). With it off the projection is
// exactly the shipped one.
//
// The flight camera stays a perspective camera looking (almost) straight down; tilt adds an
// oblique component: ground rows foreshorten by cos(θ) and height lifts things up-screen by
// sin(θ), so façades stand up the steeper the tilt. Lines of constant x/y stay axis-aligned, which
// keeps roofs as rectangles for the 2D renderer. North stays up; controls are unchanged.
import { BANDS } from './flight.js';

const DEG = Math.PI / 180;
/** Tilt per altitude band (degrees): steep at rooftop skim, moderate cruising, ~flat up high. */
export const TILT_PROFILES = {
  off: null,
  mild: [20, 11, 3],
  strong: [30, 16, 5],
};

let chosen;
/** The active profile name ('off' unless the URL asks), read once. */
export function tiltProfile() {
  if (chosen === undefined) {
    let p = 'off';
    try { p = new URLSearchParams(location.search).get('tilt') || 'off'; } catch (e) { /* no location */ }
    chosen = TILT_PROFILES[p] ? p : 'off';
  }
  return chosen;
}

/** Tilt angle (radians) at hero height z, eased between the bands like the camera distance. */
export function tiltAngle(z) {
  const prof = TILT_PROFILES[tiltProfile()];
  if (!prof) return 0;
  if (z <= BANDS[0].z) return prof[0] * DEG;
  for (let i = 1; i < BANDS.length; i++) {
    if (z <= BANDS[i].z) { const f = (z - BANDS[i - 1].z) / (BANDS[i].z - BANDS[i - 1].z); return (prof[i - 1] + f * (prof[i] - prof[i - 1])) * DEG; }
  }
  return prof[prof.length - 1] * DEG;
}

/**
 * The projection: world (x, y, z) to screen. cx/scy = screen centre, k = ground scale at the
 * centre, T = the shipped oblique lean (perspective centre offset), th = tilt angle.
 */
export function projection({ cx, scy, k, camX, camY, camH, T, th }) {
  const c = Math.cos(th), s = Math.sin(th);
  const P = (z) => camH / (camH - z);
  return {
    c, s, th, P,
    SX: (x, z = 0) => cx + (x - camX) * k * P(z),
    SY: (y, z = 0) => scy + ((y - camY) * c - z * s) * k * P(z) - (P(z) - 1) * T,
    /** World point the camera sits over, for back-to-front drawing (the camera is south of it). */
    eye: { x: camX, y: camY + camH * Math.tan(th) },
  };
}

/** World-units to offset the camera so the view still centres her body (height z). */
export function centreOffset(z, camH, k, T, th) {
  const P = camH / (camH - z), c = Math.cos(th), s = Math.sin(th);
  return (z * s * k * P + (P - 1) * T) / (c * k * P);
}
