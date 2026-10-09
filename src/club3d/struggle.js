// The struggle: caught in a trap, a clip of her held plays full screen while the player turns the
// stick round and round to break free. Keep turning and the clip plays on; stop and she slumps:
// the clip freezes and shakes, and the grip she'd won slips back. Full turns before the clock runs
// out = free. Touch: circle a thumb anywhere on the screen (the centre is where it lands);
// keyboard: roll round WASD / the arrows. Difficulty sets the turns, the clock and the slip.
import { UI } from '../ui.js';
import { sfx } from '../sfx.js';
import { $ } from '../util.js';

export const STRUGGLE = {
  normal: { turns: 3, time: 12, slip: 0.12, idle: 0.45 },
  hard:   { turns: 5, time: 12, slip: 0.22, idle: 0.35 },
};

const TAU = Math.PI * 2;
const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const R = 46, RING = TAU * R; // the progress ring (svg units)

/**
 * @param clip   the clip's URL (null: a dark screen, the struggle still plays)
 * @param title  the headline (BREAK FREE!)
 * @param text   a line under it: where she is, what's holding her
 * @param diff   'normal' | 'hard', or an object like STRUGGLE.normal
 * @returns Promise<boolean> true when she breaks free
 */
export function struggle({ clip = null, title = 'BREAK FREE!', text = '', diff = 'normal' } = {}) {
  const D = typeof diff === 'object' ? diff : STRUGGLE[diff] || STRUGGLE.normal;
  const host = $('cutscene')?.parentElement || document.body;
  const el = document.createElement('div');
  el.className = 'c3-struggle';
  el.innerHTML = `<video muted playsinline loop preload="auto"></video><div class="st-tint"></div>
    <div class="st-top"><h2>${title}</h2>${text ? `<div class="st-text">${text}</div>` : ''}<div class="st-time"><i></i></div></div>
    <div class="st-pad"><svg viewBox="0 0 120 120"><circle class="st-track" cx="60" cy="60" r="${R}"/><circle class="st-prog" cx="60" cy="60" r="${R}" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg><i class="st-knob"></i><b class="st-count"></b></div>
    <div class="st-hint">TURN THE STICK IN CIRCLES</div>`;
  host.appendChild(el);
  UI.open++;
  const video = el.querySelector('video'), knob = el.querySelector('.st-knob'), prog = el.querySelector('.st-prog');
  const timeBar = el.querySelector('.st-time i'), hint = el.querySelector('.st-hint'), count = el.querySelector('.st-count');
  video.setAttribute('playsinline', '');
  if (clip) { video.src = clip; video.play().catch(() => {}); }

  return new Promise((resolve) => {
    const need = D.turns * TAU;
    let got = 0, ang = null, dir = 0, back = 0, moveT = 0, t = 0, last = performance.now(), done = false, raf = 0, quarter = 0;
    let ptr = null; // { id, cx, cy } the thumb drawing circles
    const held = new Set();
    // a new reading of the stick's angle: turning one way counts; a wiggle back and forth doesn't
    const turnTo = (a) => {
      if (ang === null) { ang = a; return; }
      let d = a - ang;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      ang = a;
      if (Math.abs(d) > 1.65 || Math.abs(d) < 0.01) return; // (a jump across the middle, or jitter)
      if (!dir) dir = Math.sign(d);
      if (Math.sign(d) !== dir) { back += Math.abs(d); if (back > 0.9) { dir = -dir; back = 0; } return; }
      back = 0; got += Math.abs(d); moveT = t;
      const q = Math.floor(got / (TAU / 4));
      if (q > quarter) { quarter = q; sfx.punch(); }
    };
    const showKnob = (a) => { knob.style.transform = `translate(${Math.cos(a) * 38}px, ${Math.sin(a) * 38}px)`; };
    const down = (e) => {
      e.preventDefault();
      if (ptr) return;
      ptr = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
      ang = null;
    };
    const move = (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const dx = e.clientX - ptr.cx, dy = e.clientY - ptr.cy, m = Math.hypot(dx, dy);
      if (m < 14) return;
      if (m > 90) { ptr.cx += (dx / m) * (m - 90); ptr.cy += (dy / m) * (m - 90); } // (the centre follows a thumb that drifts)
      const a = Math.atan2(dy, dx);
      turnTo(a); showKnob(a);
    };
    const up = (e) => { if (ptr && e.pointerId === ptr.id) { ptr = null; ang = null; } };
    const keyAngle = () => {
      let x = 0, y = 0;
      for (const k of held) { x += KEYS[k][0]; y += KEYS[k][1]; }
      return x || y ? Math.atan2(y, x) : null;
    };
    const kd = (e) => {
      if (!KEYS[e.code]) return;
      e.preventDefault(); e.stopPropagation();
      held.add(e.code);
      const a = keyAngle();
      if (a !== null) { turnTo(a); showKnob(a); }
    };
    const ku = (e) => {
      if (!KEYS[e.code]) return;
      e.preventDefault(); e.stopPropagation();
      held.delete(e.code);
      const a = keyAngle(); // (rolling W → W+D → D: letting go of W is part of the turn)
      if (a !== null) { turnTo(a); showKnob(a); }
    };
    el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move, true);
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', up, true);
    addEventListener('keydown', kd, true);
    addEventListener('keyup', ku, true);

    const end = (ok) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move, true);
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', up, true);
      removeEventListener('keydown', kd, true);
      removeEventListener('keyup', ku, true);
      el.classList.remove('stall');
      el.classList.add(ok ? 'won' : 'lost');
      hint.textContent = ok ? 'FREE!' : 'TOO WEAK…';
      (ok ? sfx.win : sfx.lose)();
      video.pause();
      setTimeout(() => {
        video.removeAttribute('src'); video.load();
        el.remove();
        UI.open = Math.max(0, UI.open - 1);
        if (window.__struggle === hook) window.__struggle = null;
        resolve(ok);
      }, 900);
    };
    // test hook (tools/shots): finish it either way
    const hook = { win: () => end(true), lose: () => end(false), state: () => ({ got: got / TAU, need: D.turns, t, stalled: el.classList.contains('stall') }) };
    window.__struggle = hook;

    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; t += dt;
      // standing still (after a moment's grace at the start): the clip freezes and shakes, the grip slips
      const stalled = t > 0.7 && t - moveT > D.idle;
      if (stalled) {
        got = Math.max(0, got - D.slip * TAU * dt);
        quarter = Math.min(quarter, Math.floor(got / (TAU / 4)));
        if (!el.classList.contains('stall')) { el.classList.add('stall'); video.pause(); hint.textContent = 'KEEP TURNING!'; }
      } else if (el.classList.contains('stall') || (video.paused && clip)) {
        el.classList.remove('stall'); hint.textContent = 'TURN THE STICK IN CIRCLES';
        video.play().catch(() => {});
      }
      const k = Math.min(1, got / need);
      prog.setAttribute('stroke-dashoffset', String(RING * (1 - k)));
      count.textContent = `${Math.min(D.turns, Math.floor(got / TAU))}/${D.turns}`;
      timeBar.style.width = Math.max(0, (1 - t / D.time) * 100) + '%';
      if (got >= need) return end(true);
      if (t >= D.time) return end(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
