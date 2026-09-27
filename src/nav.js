// Navigation: one waypoint (a spot on the map, an incident or an airborne event) and an optional
// autopilot that steers toward it whenever the player isn't touching the stick. Any stick input
// takes over immediately, so it's an assist, not a cutscene.
import { dist } from './util.js';
import { settings } from './settings.js';

export class Navigator {
  constructor() { this.target = null; }

  /** @param t {x, y, name, color, ref?} — ref (a zone or event) keeps the waypoint on a moving target */
  set(t) { this.target = { ...t }; }
  clear() { this.target = null; }

  get autopilot() { return settings.autopilot; }

  /**
   * Follow a moving target; drop the waypoint when its target is gone or she arrives.
   * `alive(ref)` says whether a referenced zone/event still exists. Returns 'arrived' once.
   */
  update(h, alive) {
    const t = this.target;
    if (!t) return null;
    if (t.ref) {
      if (!alive(t.ref)) { this.target = null; return 'gone'; }
      t.x = t.ref.x; t.y = t.ref.y;
    }
    if (dist(t.x, t.y, h.x, h.y) < 70) { this.target = null; return 'arrived'; }
    return null;
  }

  /** Stick input toward the waypoint, easing off as she closes in (so she arrives slowly). */
  steer(h) {
    const t = this.target;
    if (!t) return null;
    const dx = t.x - h.x, dy = t.y - h.y, d = Math.hypot(dx, dy) || 1;
    const mag = Math.min(1, Math.max(0.25, d / 450));
    return { x: (dx / d) * mag, y: (dy / d) * mag };
  }

  distance(h) { return this.target ? dist(this.target.x, this.target.y, h.x, h.y) : 0; }
}
