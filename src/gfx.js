// WebGL robustness for phone browsers (iOS Safari above all): the device check, lost-context
// handling for the game's renderers, the comic "RESTORING GRAPHICS" / "LOADING" panel, and a
// crash-reload check. iOS drops WebGL contexts under memory pressure and kills the tab outright when
// the page uses too much; three.js re-uploads its own resources after a restore, so this module only
// pauses the game, shows the panel, and asks the owner to rebuild a renderer that never comes back.
// Every loss / restore / rebuild goes into the session log (diag.js).
import { note, setInfo } from './diag.js';

/** iPhone / iPad, including iPadOS presenting itself as a Mac (desktop-class Safari, with touch). */
export const IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Does this browser give us WebGL? The probe context is released at once (WebKit keeps it alive otherwise). */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    c.width = c.height = 1;
    return true;
  } catch (e) { return false; }
}

const GIVE_UP_MS = 3500; // a context that isn't back by then is rebuilt by its owner
const watched = new Map(); // canvas → { lost, since, critical, onGiveUp, timer }
let panel = null;

/**
 * Watch a renderer's canvas. critical: the frame on screen depends on it (the game pauses and the
 * panel shows while it's lost). onGiveUp(): called once if the browser doesn't restore it in time.
 */
export function watchContext(renderer, { critical = true, onGiveUp = null, onRestored = null } = {}) {
  const canvas = renderer.domElement;
  if (watched.has(canvas)) return;
  const w = { lost: false, critical, onGiveUp, timer: 0 };
  watched.set(canvas, w);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); // (three does this too: it is what allows a restore)
    if (watched.get(canvas) !== w) return; // (released on purpose, e.g. the sprite baker while flying: not news)
    w.lost = true; w.since = performance.now();
    console.warn('WebGL context lost' + (critical ? '' : ' (offscreen)'));
    note('ctx-lost', `${critical ? 'screen' : 'offscreen'} ${canvas.width}x${canvas.height}${document.hidden ? ' (tab hidden)' : ''}${loadingText ? ' while loading' : ''}`, true);
    if (critical) showPanel('RESTORING GRAPHICS…');
    clearTimeout(w.timer);
    if (onGiveUp) w.timer = setTimeout(() => { if (w.lost) { note('ctx-giveup', critical ? 'screen' : 'offscreen', true); unwatch(canvas); onGiveUp(); refresh(); } }, GIVE_UP_MS);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (watched.get(canvas) !== w) return;
    w.lost = false;
    clearTimeout(w.timer);
    note('ctx-restored', `${critical ? 'screen' : 'offscreen'} after ${Math.round(performance.now() - w.since)} ms`, true);
    onRestored?.();
    if (critical) gfxReset();
    refresh();
  });
}

/** Stop watching (the renderer is being replaced or disposed). */
export function unwatch(canvas) { const w = watched.get(canvas); if (w) clearTimeout(w.timer); watched.delete(canvas); }

/** Is a critical context lost right now? (the main loop pauses the game meanwhile) */
export function gfxLost() {
  for (const w of watched.values()) if (w.lost && w.critical) return true;
  return false;
}

/** WebGL contexts the game holds right now (the ?perf=1 readout). */
export function liveContexts() { let n = 0; for (const c of watched.keys()) if (!watched.get(c).lost) n++; return n; }

// (a loss during a zone load shows RESTORING; once restored the card goes back to the LOADING text)
function refresh() { if (gfxLost()) return; if (loadingText) showPanel(loadingText); else hidePanel(); }

// ---- GPU state that lives outside three: owners that let go of a texture's source after upload
// (e.g. the city's ground tiles) rebuild it when the screen's context restarts or is replaced.
const resets = new Set();
/** fn() runs after the screen's WebGL context was restored or its renderer replaced. */
export function onGfxReset(fn) { resets.add(fn); return () => resets.delete(fn); }
export function gfxReset() { for (const fn of resets) { try { fn(); } catch (e) { console.error(e); } } }

// ---- the comic panel (also the zones' "LOADING…" card). It sits mid-screen, under the HUD, the
// LIVE feed and the captions (they stay up: they are the story).
let loadingText = null;
function showPanel(text) {
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'gfx-panel';
    panel.innerHTML = '<b></b><s><i></i></s>';
    document.getElementById('game')?.appendChild(panel);
  }
  panel.querySelector('b').textContent = text;
  panel.classList.add('on');
}
function hidePanel() { panel?.classList.remove('on'); }

/** Is a zone's LOADING card up? (the dive's impact panel holds until it's down) */
export function isLoading() { return !!loadingText; }

/** A zone is loading: show the panel (text) or take it down (null). */
export function loadingPanel(text) {
  loadingText = text;
  if (text && !gfxLost()) showPanel(text);
  else refresh();
}

// ---- crash-reload check. A tab iOS killed for memory reloads without ever firing pagehide, so a
// session flag still set at load time means the last visit died while playing.
const CRASH_KEY = 'supergirl-alive';
export function crashedLastTime() {
  let crashed = false;
  try {
    crashed = sessionStorage.getItem(CRASH_KEY) === '1';
    const set = (v) => { try { sessionStorage.setItem(CRASH_KEY, v); } catch (e) { /* private mode */ } };
    set('1');
    addEventListener('pagehide', () => set('0'));
    document.addEventListener('visibilitychange', () => set(document.hidden ? '0' : '1'));
  } catch (e) { /* no storage */ }
  setInfo('crashLast', crashed);
  if (crashed) note('crash-reload', 'the last visit died while playing (iOS memory kill?)', true);
  return crashed;
}
