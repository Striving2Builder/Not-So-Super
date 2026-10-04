// `?perf=1`: a small on-screen readout for real-phone tests (the harness runs on SwiftShader, so
// only a phone says whether HTML5 keeps up). Shows fps (1 s average + worst frame), the 3D flight's
// dynamic-resolution scale, draw calls, triangles, GPU textures/geometries, the GPU memory estimate,
// 2D canvas memory, context losses and the graphics profile. Every frame also feeds the session log (diag.js).
import { liveContexts } from './gfx.js';
import { diagFrame, gpuEstimate, canvasEstimate, perfOn } from './diag.js';

let el, frames = 0, acc = 0, worst = 0, lost = 0;

export const perfHudEnabled = perfOn;

/** Call once per displayed frame with the real frame time (s) and this frame's script time (ms). */
export function perfHud(realDt, game, profile, jsMs = 0) {
  diagFrame(realDt, game, jsMs); // (without ?perf=1: one compare)
  if (!perfOn()) return;
  if (!el) {
    el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;pointer-events:none;'
      + 'font:11px/1.35 monospace;color:#fff;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:4px;white-space:pre';
    document.body.appendChild(el);
    addEventListener('webglcontextlost', () => lost++, true);
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
  const g = gpuEstimate();
  if (g) lines.push(`GPU ~${g.total} MB (tex ${g.tex} rt ${g.rt} geo ${g.geo} cv ${g.canvas})  2D ${canvasEstimate().mb} MB${lost ? '  LOST ' + lost : ''}`);
  el.textContent = lines.join('\n');
  frames = 0; acc = 0; worst = 0;
}
