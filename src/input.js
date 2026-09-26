import { $ } from './util.js';
import { sfx } from './sfx.js';

// One physical key can drive several logical actions; each mode only reads the ones it cares about.
// e.code is the physical key position, so WASD works on AZERTY/QWERTZ layouts too.
const KEYS = {
  ArrowUp: ['up'], KeyW: ['up'], ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
  Space: ['dive', 'jump'], KeyL: ['jump'],
  KeyJ: ['attack', 'punch'], KeyZ: ['attack', 'punch'], KeyF: ['punch', 'attack', 'descend'],
  KeyR: ['climb'], PageUp: ['climb'], PageDown: ['descend'], KeyH: ['perch'],
  KeyK: ['special'], KeyX: ['xray', 'special'],
  ShiftLeft: ['boost'], ShiftRight: ['boost'],
  KeyE: ['interact'], Enter: ['interact', 'dive'],
  KeyC: ['camera'], KeyN: ['notes'], KeyQ: ['accuse'], KeyM: ['map'],
  Escape: ['pause'], KeyP: ['pause'], Backspace: ['leave'],
};

const STICK_R = 56;      // px the knob can travel
const DEAD = 0.14;       // radial dead zone (fraction of STICK_R)

export const haptic = (ms = 8) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ } };

export class Input {
  constructor() {
    this.held = new Set();
    this.btnHeld = new Set();
    this.pressedSet = new Set();
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.taps = [];
    this.drag = { dx: 0, dy: 0 };
    this.pointer = { x: -1, y: -1 };
    this.buttons = {};

    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      const ids = KEYS[e.code];
      if (!ids) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Backspace') e.preventDefault();
      sfx.unlock();
      if (e.repeat) return;
      for (const id of ids) { this.held.add(id); this.pressedSet.add(id); }
    });
    addEventListener('keyup', (e) => { const ids = KEYS[e.code]; if (ids) ids.forEach((id) => this.held.delete(id)); });
    addEventListener('blur', () => this.reset(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(true); });

    // Touch UI on touch devices (or as soon as someone touches the screen). ?touch=1 forces it on desktop.
    if (matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');
    addEventListener('touchstart', () => { document.body.classList.add('touch'); sfx.unlock(); }, { passive: true });
    addEventListener('pointerdown', () => sfx.unlock());
    // Block browser gestures that fight the game: pinch-zoom, double-tap zoom, long-press menus.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });

    this.initStick();
    this.initSurfaces();
  }

  // Floating joystick: rests bottom-left, jumps to wherever the thumb lands in the left zone,
  // and drags its base along if the thumb travels past the rim (so you never "run out" of stick).
  initStick() {
    const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
    this.stickEls = { zone, base, knob };
    const place = (cx, cy) => {
      const r = zone.getBoundingClientRect();
      base.style.left = (cx - r.left) + 'px';
      base.style.top = (cy - r.top) + 'px';
    };
    zone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null) return;
      e.preventDefault();
      this.stick.id = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      this.stick.ox = e.clientX; this.stick.oy = e.clientY;
      place(e.clientX, e.clientY);
      knob.style.transform = 'translate(-50%,-50%)';
      zone.classList.add('active');
      haptic(6);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const m = Math.hypot(dx, dy);
      if (m > STICK_R) {
        // follow the thumb
        const over = m - STICK_R;
        this.stick.ox += (dx / m) * over; this.stick.oy += (dy / m) * over;
        place(this.stick.ox, this.stick.oy);
        dx *= STICK_R / m; dy *= STICK_R / m;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const nx = dx / STICK_R, ny = dy / STICK_R, mag = Math.hypot(nx, ny);
      if (mag < DEAD) { this.stick.x = this.stick.y = 0; return; }
      const k = (mag - DEAD) / (1 - DEAD) / mag;   // rescale so output ramps smoothly from 0
      this.stick.x = nx * k; this.stick.y = ny * k;
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.releaseStick();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  releaseStick() {
    const { zone, base, knob } = this.stickEls;
    this.stick.id = null; this.stick.x = this.stick.y = 0;
    zone.classList.remove('active');
    base.style.left = ''; base.style.top = '';
    knob.style.transform = 'translate(-50%,-50%)';
  }

  // Taps (hotspot scenes) and drags (3D camera) on the game surfaces.
  initSurfaces() {
    for (const el of [$('c2d'), $('three-host')]) {
      el.addEventListener('pointerdown', (e) => {
        this._p = { id: e.pointerId, t: performance.now(), moved: 0, lx: e.clientX, ly: e.clientY };
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      });
      el.addEventListener('pointermove', (e) => {
        this.pointer.x = e.clientX; this.pointer.y = e.clientY;
        const p = this._p;
        if (!p || p.id !== e.pointerId) return;
        // A mouse moving with no button held is never a drag (guards against a lost pointerup).
        if (e.pointerType === 'mouse' && !e.buttons) { this._p = null; return; }
        const dx = e.clientX - p.lx, dy = e.clientY - p.ly;
        p.lx = e.clientX; p.ly = e.clientY;
        p.moved += Math.abs(dx) + Math.abs(dy);
        this.drag.dx += dx; this.drag.dy += dy;
      });
      const up = (e) => {
        const p = this._p;
        if (!p || p.id !== e.pointerId) return;
        if (e.type === 'pointerup' && p.moved < 14 && performance.now() - p.t < 600) this.taps.push({ x: e.clientX, y: e.clientY });
        this._p = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    }
  }

  /** Clear transient state (called on mode switches). full=true also drops held keys. */
  reset(full = false) {
    this._p = null;
    this.drag.dx = this.drag.dy = 0;
    this.taps.length = 0;
    this.btnHeld.clear();
    if (this.stickEls) this.releaseStick();
    if (full) this.held.clear();
    for (const el of Object.values(this.buttons)) el.classList.remove('on');
  }

  get dragging() { return !!this._p; }

  /** Movement vector: x right, y DOWN the screen (so "up" is y = -1). Magnitude 0..1. */
  axis() {
    if (this.stick.id !== null) return { x: this.stick.x, y: this.stick.y };
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  down(id) { return this.held.has(id) || this.btnHeld.has(id); }
  pressed(id) { return this.pressedSet.has(id); }

  endFrame() {
    this.pressedSet.clear();
    this.taps.length = 0;
    this.drag.dx = this.drag.dy = 0;
  }

  setStick(on) {
    $('stick-zone').classList.toggle('off', !on);
    if (!on && this.stickEls) this.releaseStick();
  }

  /** Build the on-screen action buttons for the current mode. */
  setButtons(list) {
    const host = $('btns');
    host.innerHTML = '';
    this.buttons = {};
    this.btnHeld.clear();
    list.forEach((b, i) => {
      const el = document.createElement('button');
      el.className = `tbtn slot${b.slot ?? i}${b.cls ? ' ' + b.cls : ''}`;
      el.innerHTML = `<span>${b.label}</span>${b.key ? `<kbd>${b.key}</kbd>` : ''}`;
      el.setAttribute('aria-label', b.label.replace(/<br>/g, ' '));
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        // Capture so a thumb that slides a little keeps the button held (e.g. BOOST).
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
        this.btnHeld.add(b.id); this.pressedSet.add(b.id);
        el.classList.add('on');
        haptic(10);
      };
      const up = () => { this.btnHeld.delete(b.id); el.classList.remove('on'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      host.appendChild(el);
      this.buttons[b.id] = el;
    });
  }

  setButton(id, { label, lit, toggled, dim } = {}) {
    const el = this.buttons[id];
    if (!el) return;
    if (label !== undefined) el.querySelector('span').innerHTML = label;
    if (lit !== undefined) el.classList.toggle('lit', lit);
    if (toggled !== undefined) el.classList.toggle('toggled', toggled);
    if (dim !== undefined) el.classList.toggle('dim', dim);
  }
}

/** Fullscreen + landscape lock where the platform allows it (Android Chrome; iOS ignores). */
export async function goFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (e) { /* not allowed here */ }
}
