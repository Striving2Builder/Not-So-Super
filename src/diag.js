// Session diagnostics for real-device tests (the harness runs WebKit/SwiftShader on a PC: only the
// iPad itself can say why a frame froze or went black). Two layers:
// - always on, near-zero cost: a small event log (WebGL context lost / restored / rebuilt, errors,
//   freezes over FREEZE_MS, mode changes, resizes, tab hidden) kept in localStorage across reloads,
//   so a tab iOS killed still leaves its last session behind;
// - with ?perf=1 only: per-frame work counters (city blocks built / freed, ground tiles painted,
//   texture uploads), the 5 worst frames with what was happening, and a GPU memory estimate from a
//   thin wrapper on the WebGL upload calls (installed before any context exists).
// The pause menu shows it all as text with a Copy button ("Diagnostics" with ?perf=1, or a long
// press on the menu's title), for pasting to the director.
import { openModal, closeModal } from './ui.js';

const KEY = 'supergirl-diag', SESSIONS = 3, EVENTS = 80, WORST = 5;
const FREEZE_MS = 400; // a frame gap this long is logged even without ?perf=1
const SNAP_S = 10;     // ?perf=1: a memory snapshot this often (shows growth over a long flight)

let perf;
/** ?perf=1 (read once). */
export function perfOn() {
  if (perf === undefined) { try { perf = new URLSearchParams(location.search).get('perf') === '1'; } catch (e) { perf = false; } }
  return perf;
}

/** What the game did this frame (city3d + the GL wrapper bump these; diag reads and resets them). */
export const work = { built: 0, freed: 0, painted: 0, uploads: 0, upBytes: 0, ms: 0 };
let prevWork = { ...work };

const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
const now = () => (performance.now() - t0) / 1000;
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let sessions = [];
try { sessions = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { sessions = []; }
if (!Array.isArray(sessions)) sessions = [];
const S = {
  start: new Date().toISOString(), ua: typeof navigator !== 'undefined' ? navigator.userAgent : '', perf: perfOn(),
  ev: [], lost: 0, restored: 0, rebuilt: 0, errors: 0, freezes: 0, frames: 0, longest: null, worst: [], snaps: [], info: {},
};
sessions.push(S);
while (sessions.length > SESSIONS) sessions.shift();

let saveT = 0, timer = 0;
function save(force) {
  S.up = +now().toFixed(1);
  const t = performance.now();
  if (!force && t - saveT < 2000) { if (!timer) timer = setTimeout(() => { timer = 0; save(true); }, 2000); return; }
  saveT = t;
  try { localStorage.setItem(KEY, JSON.stringify(sessions)); } catch (e) { /* private mode / full */ }
}

/** Log an event (always on; rare things only). urgent: write through at once (the tab may die next). */
export function note(type, text = '', urgent = false) {
  if (type === 'ctx-lost') S.lost++;
  else if (type === 'ctx-restored') S.restored++;
  else if (type === 'renderer-rebuilt') S.rebuilt++;
  else if (type === 'error') S.errors++;
  const last = S.ev[S.ev.length - 1];
  if (last && last[1] === type && last[2] === text) { last[3] = (last[3] || 1) + 1; } // (repeats fold into a count)
  else { S.ev.push([+now().toFixed(1), type, String(text).slice(0, 160)]); if (S.ev.length > EVENTS) S.ev.splice(1, 1); } // (keep the first: start)
  save(urgent);
}

/** Facts about the device/session (iOS detection, profile, crash flag…), shown at the top. */
export function setInfo(k, v) { S.info[k] = v; save(); }

// ---------------------------------------------------------------- GPU estimate (?perf=1 only)
// Bytes per live GL object, from the upload calls; textures attached to a framebuffer count as
// render targets. A rough figure (drivers pad and compress), but it moves with what we allocate.
const gl = { tex: new Map(), rb: new Map(), buf: new Map(), rtTex: new Set(), ctxs: [] };
function installGL() {
  const wrap = (P) => {
    if (!P || P.__diag) return;
    P.__diag = true;
    const o = {};
    for (const k of ['bindTexture', 'texImage2D', 'texStorage2D', 'compressedTexImage2D', 'texSubImage2D', 'generateMipmap', 'deleteTexture', 'bindBuffer', 'bufferData', 'deleteBuffer', 'bindRenderbuffer', 'renderbufferStorage', 'renderbufferStorageMultisample', 'deleteRenderbuffer', 'framebufferTexture2D']) o[k] = P[k];
    const bound = (ctx, target) => ctx.__dt && ctx.__dt[target >= 0x8515 && target <= 0x851A ? 0x8513 : target];
    const setTex = (ctx, target, bytes, add) => { const t = bound(ctx, target); if (!t) return; const e = gl.tex.get(t) || { b: 0, mip: 1 }; e.b = add ? e.b + bytes : bytes; gl.tex.set(t, e); };
    const up = (bytes) => { work.uploads++; work.upBytes += bytes; };
    P.bindTexture = function (t, x) { (this.__dt || (this.__dt = {}))[t] = x; return o.bindTexture.apply(this, arguments); };
    P.texImage2D = function (target, level) {
      let w, h;
      if (arguments.length >= 8) { w = arguments[3]; h = arguments[4]; } else { const s = arguments[5]; w = (s && (s.videoWidth || s.naturalWidth || s.width)) || 0; h = (s && (s.videoHeight || s.naturalHeight || s.height)) || 0; }
      const b = w * h * 4;
      if (level === 0) setTex(this, target, b, target >= 0x8515 && target <= 0x851A && target !== 0x8515);
      up(b);
      return o.texImage2D.apply(this, arguments);
    };
    if (o.texStorage2D) P.texStorage2D = function (target, levels, fmt, w, h) { setTex(this, target, w * h * 4 * (levels > 1 ? 1.33 : 1)); return o.texStorage2D.apply(this, arguments); };
    P.texSubImage2D = function () { const s = arguments[arguments.length - 1]; up(s && s.byteLength !== undefined ? s.byteLength : ((s && s.width) || 0) * ((s && s.height) || 0) * 4); return o.texSubImage2D.apply(this, arguments); };
    P.compressedTexImage2D = function (target) { const d = arguments[arguments.length - 1]; setTex(this, target, (d && d.byteLength) || 0); up((d && d.byteLength) || 0); return o.compressedTexImage2D.apply(this, arguments); };
    P.generateMipmap = function (target) { const t = bound(this, target), e = t && gl.tex.get(t); if (e) e.mip = 1.33; return o.generateMipmap.apply(this, arguments); };
    P.deleteTexture = function (x) { gl.tex.delete(x); gl.rtTex.delete(x); return o.deleteTexture.apply(this, arguments); };
    P.bindBuffer = function (t, x) { (this.__db || (this.__db = {}))[t] = x; return o.bindBuffer.apply(this, arguments); };
    P.bufferData = function (t, d) { const x = this.__db && this.__db[t]; if (x) gl.buf.set(x, typeof d === 'number' ? d : (d && d.byteLength) || 0); return o.bufferData.apply(this, arguments); };
    P.deleteBuffer = function (x) { gl.buf.delete(x); return o.deleteBuffer.apply(this, arguments); };
    P.bindRenderbuffer = function (t, x) { this.__dr = x; return o.bindRenderbuffer.apply(this, arguments); };
    P.renderbufferStorage = function (t, f, w, h) { if (this.__dr) gl.rb.set(this.__dr, w * h * 4); return o.renderbufferStorage.apply(this, arguments); };
    if (o.renderbufferStorageMultisample) P.renderbufferStorageMultisample = function (t, s, f, w, h) { if (this.__dr) gl.rb.set(this.__dr, w * h * 4 * Math.max(1, s)); return o.renderbufferStorageMultisample.apply(this, arguments); };
    P.deleteRenderbuffer = function (x) { gl.rb.delete(x); return o.deleteRenderbuffer.apply(this, arguments); };
    P.framebufferTexture2D = function (t, a, tt, tex) { if (tex) gl.rtTex.add(tex); return o.framebufferTexture2D.apply(this, arguments); };
  };
  try {
    wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
    wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      const c = gc.apply(this, arguments);
      if (c && /webgl/.test(type) && !gl.ctxs.some((x) => x.c === c)) gl.ctxs.push({ c, canvas: this });
      return c;
    };
  } catch (e) { /* no WebGL */ }
}
if (typeof window !== 'undefined' && perfOn()) installGL();

/** GPU memory estimate in MB: { tex, rt, geo, canvas, total } (null without ?perf=1). */
export function gpuEstimate() {
  if (!perfOn()) return null;
  let tex = 0, rt = 0, geo = 0, canvas = 0;
  for (const [t, e] of gl.tex) { if (gl.rtTex.has(t)) rt += e.b; else tex += e.b * e.mip; }
  for (const b of gl.rb.values()) rt += b;
  for (const b of gl.buf.values()) geo += b;
  gl.ctxs = gl.ctxs.filter((x) => !x.c.isContextLost());
  for (const x of gl.ctxs) { const aa = x.c.getContextAttributes?.()?.antialias; canvas += x.canvas.width * x.canvas.height * 4 * (aa ? 6 : 2); } // (back + front; MSAA adds 4 samples)
  const MB = (b) => +(b / 1048576).toFixed(1);
  return { tex: MB(tex), rt: MB(rt), geo: MB(geo), canvas: MB(canvas), total: MB(tex + rt + geo + canvas), ctx: gl.ctxs.length };
}

// ---------------------------------------------------------------- per frame
/** What the game is doing (mode, band, altitude, 3D scale): a worst frame's context. */
function context(game) {
  const ow = game.overworld, h = ow && ow.hero, v = ow && ow.view3d;
  const c = { mode: game.modeName || '-' };
  if (game.modeName === 'overworld' && h) { c.band = ['skim', 'cruise', 'high'][h.band] || h.band; c.alt = Math.round((h.z || 0) * 0.5); }
  if (v && v.sceneScale !== undefined) c.scale = +v.sceneScale.toFixed(2);
  return c;
}

let snapT = 0;
/**
 * Once per displayed frame (from perfHud): realDt is the gap since the last frame, jsMs this
 * frame's own script time. A long gap is charged to the previous frame's work (it ran in it).
 */
export function diagFrame(realDt, game, jsMs = 0) {
  const ms = realDt * 1000;
  S.frames++;
  if (ms > FREEZE_MS && S.frames > 30) { S.freezes++; note('freeze', `${Math.round(ms)} ms ${context(game).mode}`); }
  if (perfOn()) {
    if (S.frames > 30 && (!S.longest || ms > S.longest.ms)) S.longest = { ms: Math.round(ms), at: +now().toFixed(1), ...context(game) };
    const W = S.worst;
    if (S.frames > 30 && (W.length < WORST || ms > W[W.length - 1].ms)) {
      W.push({ ms: Math.round(ms), at: +now().toFixed(1), ...context(game), built: prevWork.built, freed: prevWork.freed, tiles: prevWork.painted, uploads: prevWork.uploads, upMB: +(prevWork.upBytes / 1048576).toFixed(1), cityMs: +prevWork.ms.toFixed(1), js: Math.round(prevWork.js || 0) });
      W.sort((a, b) => b.ms - a.ms); W.length = Math.min(W.length, WORST);
      save();
    }
    if (now() - snapT > SNAP_S) {
      snapT = now();
      const g = gpuEstimate(), m = typeof performance !== 'undefined' && performance.memory;
      S.snaps.push([Math.round(snapT), g && g.total, m ? Math.round(m.usedJSHeapSize / 1048576) : null, context(game).mode]);
      if (S.snaps.length > 40) S.snaps.splice(0, S.snaps.length - 40);
      S.gpu = g; save();
    }
  }
  prevWork = { ...work, js: jsMs };
  work.built = work.freed = work.painted = work.uploads = work.upBytes = work.ms = 0;
}

// ---------------------------------------------------------------- the report
function sizesNow(game) {
  const v = game && game.overworld && game.overworld.view3d, r = v && v.renderer, out = [];
  if (r) {
    out.push(`canvas ${r.domElement.width}x${r.domElement.height} (pixel ratio ${r.getPixelRatio()})`);
    const p = v.post;
    if (p && p.rt) out.push(`scene target ${p.rt.width}x${p.rt.height}${p.rt.samples ? ' MSAA' + p.rt.samples : ''}, drawn ${p.used ? p.used.join('x') : '-'}${p.rtB ? ' (+FXAA copy)' : ''}`);
    const hp = v.heroPass;
    if (hp && hp.rt) out.push(`hero target ${hp.rt.width}x${hp.rt.height}${hp.rt.samples ? ' MSAA' + hp.rt.samples : ''}`);
    const i = r.info.memory;
    out.push(`three: ${i.textures} textures, ${i.geometries} geometries`);
    const c3 = v.city3;
    if (c3 && c3.chunks) { let n = 0, l = 0, t = 0; for (const ch of c3.chunks.values()) { if (ch.near) n++; if (ch.lite) l++; if (ch.gl) t++; if (ch.gd) t++; } out.push(`city: ${n} detailed blocks, ${l} far blocks, ${t} ground tiles${c3.queue ? `, ${c3.queue.length} queued` : ''}`); }
  }
  return out;
}

function sessionText(s, i, game, current) {
  const L = [], I = s.info || {};
  L.push(`--- session ${i + 1}${current ? ' (this one)' : ''}: ${s.start.replace('T', ' ').slice(0, 19)} UTC, ran ${fmtT(s.up || 0)}`);
  L.push(`device: iOS/iPad detected ${I.ios ? 'YES' : 'no'}, dpr ${I.dpr}, screen ${I.screen}, graphics ${I.profile || '-'}${s.perf ? ', ?perf=1' : ''}`);
  L.push(`crash-reload flag at start: ${I.crashLast ? 'YES (last visit died)' : 'no'}${I.afterCrash ? ' -> switched to Battery saver' : ''}`);
  L.push(`WebGL: lost ${s.lost}, restored ${s.restored}, rebuilt ${s.rebuilt} · errors ${s.errors} · freezes >${FREEZE_MS} ms ${s.freezes} in ${s.frames} frames`);
  if (s.longest) L.push(`longest frame ${s.longest.ms} ms at ${fmtT(s.longest.at)} (${s.longest.mode}${s.longest.band ? ' ' + s.longest.band + ' ' + s.longest.alt + ' m' : ''})`);
  if (s.worst && s.worst.length) {
    L.push('worst frames (work done in the frame before the gap):');
    for (const w of s.worst) L.push(`  ${w.ms} ms @${fmtT(w.at)} ${w.mode}${w.band ? ' ' + w.band + ' ' + w.alt + ' m' : ''}${w.scale !== undefined ? ' scale ' + w.scale : ''} · built ${w.built} freed ${w.freed} tiles ${w.tiles} · uploads ${w.uploads} (${w.upMB} MB) · city ${w.cityMs} ms · js ${w.js} ms`);
  }
  if (s.gpu) L.push(`GPU est. ${s.gpu.total} MB = textures ${s.gpu.tex} + render targets ${s.gpu.rt} + geometry ${s.gpu.geo} + canvases ${s.gpu.canvas} (${s.gpu.ctx} context${s.gpu.ctx === 1 ? '' : 's'})`);
  if (s.snaps && s.snaps.length) L.push('memory over time [t, GPU MB, JS heap MB, mode]: ' + s.snaps.map((x) => `${fmtT(x[0])} ${x[1] ?? '-'}/${x[2] ?? '-'} ${x[3]}`).join(' · '));
  if (current && game) for (const x of sizesNow(game)) L.push(x);
  L.push('events:');
  for (const e of s.ev) L.push(`  ${fmtT(e[0])} ${e[1]}${e[2] ? ' ' + e[2] : ''}${e[3] ? ' (x' + e[3] + ')' : ''}`);
  return L.join('\n');
}

/** The whole log as text (this session first, then the earlier ones). */
export function diagText(game) {
  if (perfOn()) S.gpu = gpuEstimate();
  const m = typeof performance !== 'undefined' && performance.memory;
  const head = [`SUPERGIRL DIAGNOSTICS ${new Date().toISOString().slice(0, 19)}`, `UA: ${S.ua}`,
    `JS heap: ${m ? Math.round(m.usedJSHeapSize / 1048576) + ' MB used / ' + Math.round(m.jsHeapSizeLimit / 1048576) + ' MB limit' : 'n/a (Safari does not say)'}`,
    perfOn() ? '' : '(open the game with ?perf=1 for worst frames and the GPU memory estimate)'].filter(Boolean);
  const list = sessions.map((s, i) => [s, i]).reverse();
  return head.join('\n') + '\n\n' + list.map(([s, i]) => sessionText(s, i, game, s === S)).join('\n\n');
}

/** The readable view with Copy / Clear / Close (resolves when closed). */
export function showDiagnostics(game) {
  return new Promise((resolve) => {
    const el = openModal('<h2>Diagnostics</h2><textarea readonly spellcheck="false" style="width:100%;height:52vh;font:11px/1.35 monospace;white-space:pre;overflow:auto;background:#0b0b16;color:#e8e8f0;border:0;border-radius:6px;padding:6px;box-sizing:border-box"></textarea>'
      + '<div class="opts"><button class="opt" data-a="copy"><span class="l">Copy</span></button><button class="opt" data-a="clear"><span class="l">Clear old sessions</span></button><button class="opt" data-a="close"><span class="l">Close</span></button></div>', 'dlg diag');
    const ta = el.querySelector('textarea');
    ta.value = diagText(game);
    const btn = (a) => el.querySelector(`[data-a="${a}"] .l`);
    el.querySelector('[data-a="copy"]').addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) { /* not a secure context / denied */ }
      if (!ok) { try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) { /* old API gone */ } }
      btn('copy').textContent = ok ? 'Copied!' : 'Select the text and copy it';
    });
    el.querySelector('[data-a="clear"]').addEventListener('click', () => { sessions.splice(0, sessions.length - 1); save(true); ta.value = diagText(game); });
    el.querySelector('[data-a="close"]').addEventListener('click', () => { closeModal(el); resolve(); });
  });
}

/** Long-press (1.2 s) on el opens the diagnostics (the hidden way in without ?perf=1). */
export function longPressDiagnostics(el, game) {
  if (!el) return;
  let t = 0;
  const off = () => clearTimeout(t);
  el.addEventListener('pointerdown', () => { off(); t = setTimeout(() => showDiagnostics(game), 1200); });
  for (const k of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(k, off);
}

// ---------------------------------------------------------------- always-on hooks
if (typeof window !== 'undefined') {
  note('start', `${location.search || ''}`.slice(0, 60));
  addEventListener('error', (e) => note('error', (e.message || 'error') + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')));
  addEventListener('unhandledrejection', (e) => note('error', 'promise: ' + ((e.reason && e.reason.message) || e.reason)));
  document.addEventListener('visibilitychange', () => note(document.hidden ? 'hidden' : 'visible', '', document.hidden));
  addEventListener('pagehide', () => { note('pagehide'); save(true); });
}
