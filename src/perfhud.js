// `?perf=1`: a small on-screen readout for real-phone tests (the harness runs on SwiftShader, so
// only a phone says whether HTML5 keeps up). Shows fps (1 s average + worst frame), the 3D flight's
// dynamic-resolution scale, draw calls, triangles, GPU textures/geometries and the graphics profile.
import { liveContexts } from './gfx.js';

let on, el, frames = 0, acc = 0, worst = 0;

export function perfHudEnabled() {
  if (on === undefined) {
    try { on = new URLSearchParams(location.search).get('perf') === '1'; } catch (e) { on = false; }
  }
  return on;
}

/** Call once per displayed frame with the real frame time (s). */
export function perfHud(realDt, game, profile) {
  if (!perfHudEnabled()) return;
  if (!el) {
    el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;pointer-events:none;'
      + 'font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:4px;white-space:pre';
    document.body.appendChild(el);
  }
  frames++; acc += realDt; worst = Math.max(worst, realDt);
  if (acc < 1) return;
  const fps = frames / acc, lines = [`${fps.toFixed(0)} fps  worst ${(worst * 1000).toFixed(0)} ms  ${profile}`];
  const v = game.modeName === 'overworld' && game.overworld && game.overworld.view3d;
  if (v && v.renderer) {
    const i = v.renderer.info;
    lines.push(`3D scene ${(v.sceneScale ?? 1).toFixed(2)}x  dyn ${(v.resK ?? 1).toFixed(2)}  dpr ${v.dpr ?? '-'}`);
    lines.push(`calls ${i.render.calls}  tris ${(i.render.triangles / 1000).toFixed(0)}k`);
    lines.push(`tex ${i.memory.textures}  geo ${i.memory.geometries}  gl ctx ${liveContexts()}`);
  }
  el.textContent = lines.join('\n');
  frames = 0; acc = 0; worst = 0;
}
