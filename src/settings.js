// Player settings (persisted separately from the save game) and the graphics profile that the
// renderers, the main loop and the club loader read. The player picks Auto / High / Battery saver;
// Auto resolves to a profile from the device type, then from the frame rate it actually measures.

const KEY = 'supergirl-settings';

/**
 * What each profile changes. Every renderer reads these through quality().
 * clubMaterials: 'full' as exported · 'standard' drops glass/clearcoat/sheen (no extra render
 * pass) · 'lambert' simple lit materials, no normal/roughness maps (fewest, cheapest shaders).
 */
export const PROFILES = {
  // desktop: everything on
  high: { id: 'high', label: 'High', fpsCap: 0, dpr2d: 2, dpr3d: 1.6, heroSprite: 192, clubTex: 'full', clubCache: 3, clubMaterials: 'full' },
  // phones/tablets that keep up: full frame rate, but lite club textures (memory is what runs out)
  balanced: { id: 'balanced', label: 'Balanced', fpsCap: 0, dpr2d: 2, dpr3d: 1.25, heroSprite: 192, clubTex: 'lite', clubCache: 1, clubMaterials: 'standard' },
  // older devices / low-power mode: 30 fps, 1× resolution, cheap club materials
  saver: { id: 'saver', label: 'Battery saver', fpsCap: 30, dpr2d: 1, dpr3d: 1, heroSprite: 128, clubTex: 'lite', clubCache: 1, clubMaterials: 'lambert' },
};

export const GRAPHICS_MODES = ['auto', 'high', 'saver'];

const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify({ graphics: state.graphics, autoSlow: state.autoSlow, autopilot: state.autopilot })); } catch (e) { /* private mode */ }
}

const saved = read();
const state = {
  graphics: GRAPHICS_MODES.includes(saved.graphics) ? saved.graphics : 'auto',
  autoSlow: !!saved.autoSlow, // Auto measured this device as too slow once → stay on Battery saver
  autopilot: saved.autopilot !== false, // fly toward the waypoint while the stick is idle
};
const listeners = [];

/** The active graphics profile. */
export function quality() {
  if (state.graphics === 'high') return PROFILES.high;
  if (state.graphics === 'saver' || state.autoSlow) return PROFILES.saver;
  return isTouch() ? PROFILES.balanced : PROFILES.high;
}

export const settings = {
  get graphics() { return state.graphics; },
  /** Label for menus, e.g. "Auto (Balanced)". */
  get graphicsLabel() { return state.graphics === 'auto' ? `Auto (${quality().label})` : PROFILES[state.graphics].label; },
  /** Cycle Auto → High → Battery saver. Picking Auto again re-measures from scratch. */
  cycleGraphics() {
    state.graphics = GRAPHICS_MODES[(GRAPHICS_MODES.indexOf(state.graphics) + 1) % GRAPHICS_MODES.length];
    if (state.graphics === 'auto') { state.autoSlow = false; autoTune.restart(); }
    write(); changed();
  },
  get autopilot() { return state.autopilot; },
  toggleAutopilot() { state.autopilot = !state.autopilot; write(); return state.autopilot; },
  onChange(fn) { listeners.push(fn); },
};

function changed() { const q = quality(); for (const fn of listeners) fn(q); }

/**
 * Auto mode: watch real frame times while flying. If the device can't hold ~45 fps it drops to
 * Battery saver once (never flip-flops back up; picking Auto in the menu re-measures).
 */
const WARMUP = 1.5, WINDOW = 4, SLOW_FPS = 45;
export const autoTune = {
  t: 0, frames: 0, time: 0, done: false,
  restart() { this.t = 0; this.frames = 0; this.time = 0; this.done = false; },
  /** Call once per rendered frame with the real (uncapped) frame time. Returns true if it downgraded. */
  sample(realDt) {
    if (this.done || state.graphics !== 'auto' || state.autoSlow) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    this.t += realDt;
    if (this.t < WARMUP || realDt > 0.5) return false; // skip start-up hitches and tab switches
    this.frames++; this.time += realDt;
    if (this.time < WINDOW) return false;
    this.done = true;
    if (this.frames / this.time >= SLOW_FPS) return false;
    state.autoSlow = true;
    write(); changed();
    return true;
  },
};
