// A flight moment: an optional bit of gameplay that comes up while she flies between markers (see
// director.js). Each one has a clear start (it's announced and marked), a short skill test, a juicy
// resolution and a small reward; failing costs a little and never blocks. Subclasses override the
// hooks below; the director runs them.
import { M } from '../city3d.js';
import { tag, reticle } from './hud.js';

export class Moment {
  /** o: { name, color, glyph, ttl, big } */
  constructor(dir, kind, o = {}) {
    this.dir = dir; this.ow = dir.ow; this.g = dir.ow.g; this.kind = kind;
    this.t = 0; this.ttl = o.ttl ?? 60;
    this.name = o.name || kind; this.color = o.color || '#ffe23a'; this.glyph = o.glyph || '!';
    this.big = !!o.big;
    this.x = 0; this.y = 0; this.z = 0;
    this.taken = false;   // she engaged (came close / started the test)
    this.result = null;   // 'won' | 'lost' | 'expired' once settled
    this.outro = 0;       // seconds the moment lingers after settling (its resolution beat)
  }

  get hero() { return this.ow.hero; }
  get st() { return this.g.state; }
  /** Horizontal distance from her (world units). */
  dist(x = this.x, y = this.y) { const h = this.ow.hero; return Math.hypot(x - h.x, y - h.y); }
  /** 3D distance from her (world units). */
  dist3(x = this.x, y = this.y, z = this.z) { const h = this.ow.hero; return Math.hypot(x - h.x, y - h.y, z - h.z); }
  /** She engaged: the director logs it once. */
  take() { if (!this.taken) { this.taken = true; this.dir.note(this, 'taken'); } }
  win(outro = 1.4) { if (this.result) return; this.result = 'won'; this.outro = outro; this.dir.note(this, 'won'); }
  lose(outro = 1.2) { if (this.result) return; this.result = 'lost'; this.outro = outro; this.dir.note(this, 'lost'); }

  // ---- hooks -------------------------------------------------------------------------------
  /** Per frame (game time). Call win() / lose() when it settles; it keeps updating through its outro. */
  update(dt) {}
  /** It ran out of time without settling (default: a quiet loss). */
  expire() { this.lose(0); }
  /** 3D: place this frame's actors and effects (kit.begin() has run). */
  draw3d(kit, view) {}
  /** The comic overlay over the 3D view (P = view.projector()). */
  overlay(ctx, P, W, H, view) {}
  /** The old 2D flight view (?flight=2d): a tag where it is. */
  draw2d(ctx, V) {
    if (this.result) return;
    const x = V.SX(this.x, this.z), y = V.SY(this.y, this.z);
    if (x < -40 || y < -40 || x > V.W + 40 || y > V.H + 40) return;
    tag(ctx, x, y, this.tagText(), { col: this.color, lift: 14 });
  }
  tagText() { return this.name.toUpperCase(); }
  /** In DIVE range: { x, y, z, label } of what a DIVE would swoop onto, else null. */
  diveTarget() { return null; }
  /** DIVE pressed with diveTarget() set. */
  onDive() {}
  /** Map / minimap / edge-chip marker (null: something else, e.g. a zone, already marks it). */
  marker() { return this.result ? null : { x: this.x, y: this.y, color: this.color, glyph: this.glyph, name: this.name, ref: this, t: this.ttl - this.t }; }
  /** The banner: { title, col, time, meters } or null. */
  banner() { return null; }
  /** Release actors (the moment is over). */
  end() {}
  /** She dove into a zone: leave quietly (no penalty). */
  abandon() { this.end(); }

  // ---- helpers for overlays ----------------------------------------------------------------
  /** Screen point of a world point via the 3D projector (null if behind the camera). */
  scr(P, x, y, z) { const p = P.proj(x, y, z); return p[2] ? p : null; }
  /** The standard target overlay: a tag (with the distance) and, when diveable, the reticle. */
  mark(ctx, P, view, x, y, z, text, o = {}) {
    const p = this.scr(P, x, y, z);
    if (!p || p[0] < -30 || p[1] < -30 || p[0] > this.g.w + 30 || p[1] > this.g.h + 30) return null;
    const d = this.dist3(x, y, z) * M;
    if (o.reticle !== false) reticle(ctx, p[0], p[1], o.r || 16, this.ow.t, { col: o.col || this.color, dive: !!o.dive, label: o.label });
    if (!view.underHud(p[0], p[1] - 40, 6)) tag(ctx, p[0], p[1] - (o.r || 16) + 6, text, { col: o.col || this.color, sub: d > 45 ? `${Math.round(d)}m` : null, lift: o.dive ? 30 : 12, shake: o.shake });
    return p;
  }
}
