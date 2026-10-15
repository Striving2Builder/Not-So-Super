// The struggle: caught in a trap, a clip of her held plays full screen while the player traces the S
// on her chest, over and over, to break free. Keep tracing and the clip plays on; stop and she slumps:
// the clip freezes and shakes, and the trace she's on drains away (finished ones stay banked). Full
// traces before the clock runs out = free. Difficulty sets the traces, the clock and the drain.
//
// The pad is the S-shield (a photo crop, assets/ui/s_shield.webp) in the old ring's spot, with a crisp
// ink S on top: a glowing dot at each end, a trail that fills as she traces, a bead where she is. The
// pad is ring-sized, too small to trace on with a thumb, so the thumb draws its S anywhere, any size
// (a dashed ghost S shows a comfortable one) and the bead follows it along the S (see tracer()). Either
// end can start: the first stroke picks (leftward = from the top serif, rightward = from the tail).
// Off the S or back along it = a miss: only that trace resets. Keyboard: roll WASD round, one turn =
// one trace. Mouse: drag like a thumb.
import { UI } from '../ui.js';
import { sfx } from '../sfx.js';
import { $ } from '../util.js';

// her lines (add variants freely: one is picked at random each time)
export const SAY_WIN = ["I'm Supergirl!"];
export const SAY_MISS = ['No… never… you won\'t get away with this.'];

export const STRUGGLE = {
  normal: { traces: 3, time: 12, slip: 0.35, idle: 0.45 }, // slip: share of the current trace drained per second still
  hard:   { traces: 4, time: 14, slip: 0.45, idle: 0.55 },
};

// the S stroke fitted to the yellow S in s_shield.webp (468×320 image px), top serif → tail
export const S_PATH = [398,80,384,86,369,90,354,92,338,92,323,88,309,84,295,77,280,72,265,69,250,67,235,66,219,65,204,66,188,67,173,68,158,71,144,76,132,87,123,99,114,112,107,125,102,139,114,149,129,152,144,153,159,154,175,155,190,156,205,157,221,159,236,160,252,161,267,161,282,165,282,177,268,184,253,186,237,185,222,183]
  .reduce((a, v, i, src) => (i % 2 ? a : a.concat([[v, src[i + 1]]])), []);
export const S_GAIN = 2;        // thumb px per pad px along the S at first; then each finished trace sets it to her own S
const IW = 468, IH = 320;
const LANE = Math.cos(45 * Math.PI / 180); // a stroke within 45° of the way the S heads follows it
const STEP = 10;                // screen px of thumb travel per heading read (jitter)
const OFF_MAX = 70;             // screen px of travel the S doesn't take (off it, or back) before it's a miss
const SKIP = 100;               // how far ahead an early turn may skip (image px of arc)
const END = 24;                 // this close to the far end (image px of arc) is a finished trace
const NEAR = 90;                // ... and this close, if the thumb turns away from the S
const MISS_GAP = 1.2;           // seconds between two miss lines
const TAU = Math.PI * 2;
const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const IMG = new URL('../../assets/ui/s_shield.webp', import.meta.url).href;

// the path both ways, with its running arc length
const mk = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, c, L: c[c.length - 1] }; };
const FWD = mk(S_PATH), REV = mk(S_PATH.slice().reverse()), LEN = FWD.L;
const at = (P, s) => {
  s = Math.max(0, Math.min(P.L, s));
  let i = 1; while (i < P.c.length - 1 && P.c[i] < s) i++;
  const a = P.pts[i - 1], b = P.pts[i], f = (s - P.c[i - 1]) / ((P.c[i] - P.c[i - 1]) || 1);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, i];
};
const ptsStr = (pts) => pts.map((p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(' ');
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/**
 * The tracing itself (no DOM: the harness can drive it too). A thumb's S isn't the pad's S: bigger or
 * smaller, taller, cutting or overshooting the curls. So a trace follows the S by heading, not by
 * position (a bead on a wire): a stroke heading the way the S heads at the bead slides it on, at most
 * to where the S turns away (an overshoot just waits at the corner); a turn taken early (a small S)
 * skips the bead ahead to where the S heads that way, if that's close; a stroke the S doesn't take
 * there (off it, or back along it) runs up OFF_MAX of travel, then it's a miss.
 * @param u image px of S per screen px of thumb
 */
export function tracer(u = 1) {
  const T = { s: 0, dir: 0, P: FWD, off: 0, h: null, chunk: [0, 0], lock: -1, prefer: 0, travel: 0, u, u0: u };
  const tan = (s, Q = T.P) => { const a = at(Q, s - 6), b = at(Q, s + 6), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const dot = (s, m, Q) => { const k = tan(s, Q); return k[0] * m[0] + k[1] * m[1]; };
  T.reset = () => { T.s = 0; T.dir = 0; T.P = FWD; T.off = 0; T.h = null; };
  T.point = () => at(T.P, T.s);
  /** the thumb moved (screen px) at time t → '' | 'win' | 'off' | 'back' */
  T.move = (dx, dy, t) => {
    T.chunk[0] += dx; T.chunk[1] += dy;
    const l = Math.hypot(T.chunk[0], T.chunk[1]);
    if (l < STEP) return '';
    let m = [T.chunk[0] / l, T.chunk[1] / l];
    T.chunk = [0, 0];
    if (t < T.lock) return '';
    if (T.h) { const a = T.h[0] * 0.45 + m[0], b = T.h[1] * 0.45 + m[1], n = Math.hypot(a, b) || 1; m = [a / n, b / n]; } // (a thumb's jitter)
    T.h = m;
    if (!T.dir) {
      // a new trace: the stroke picks the end (leftward: from the top serif; rightward: from the tail).
      // Straight after a trace, only the end she finished at (back and forth without lifting; the rest
      // of the old stroke running on mustn't start the next one from the far end)
      const df = dot(0, m, FWD), dr = dot(0, m, REV);
      if (T.prefer) { // (until she lifts: then either end)
        if ((T.prefer > 0 ? df : dr) < LANE) return '';
        T.dir = T.prefer;
      } else {
        if (Math.max(df, dr) < LANE) return '';
        T.dir = df >= dr ? 1 : -1;
      }
      T.P = T.dir > 0 ? FWD : REV; T.s = 0; T.off = 0; T.travel = 0;
    }
    T.travel += l;
    if (dot(T.s, m) > LANE) {
      let go = l * T.u; // slide on, but not round a corner the stroke doesn't take
      while (go > 0.05 && T.s < T.P.L) { const n = Math.min(T.P.L, T.s + Math.min(4, go)); if (dot(n, m) <= LANE) break; go -= n - T.s; T.s = n; }
      T.off = Math.max(0, T.off - l);
    } else {
      if (T.s < 20) { T.dir = 0; T.P = FWD; T.s = 0; return ''; } // (barely started: the wrong end: pick again)
      let skip = -1;
      for (let k = T.s + 5; k <= Math.min(T.P.L, T.s + SKIP); k += 5) if (dot(k, m) > LANE) { skip = k; break; }
      if (skip > 0) { T.s = skip; T.off = Math.max(0, T.off - l * 0.5); }
      else if (T.s >= T.P.L - NEAR) T.s = T.P.L; // (the tail's last curl, cut short: the thumb turning back there has drawn its S)
      else if ((T.off += l) > OFF_MAX) {
        const why = dot(T.s, m) < -0.5 ? 'back' : 'off';
        T.missAt = T.s; T.reset(); T.lock = t + 0.3; T.prefer = 0;
        return why;
      } else return '';
    }
    T.moved = t;
    return T.s >= T.P.L - END ? T.win() : '';
  };
  T.win = () => {
    // her S's size: the bead keeps a touch behind her thumb (a bead ahead finishes early, and the rest
    // of her stroke would start the next trace wrong; a bead behind catches up at the corners)
    if (T.travel > 40) T.u = Math.max(T.u0 * 0.5, Math.min(T.u0 * 2.5, T.u * 0.4 + 0.6 * 0.95 * LEN / T.travel));
    T.prefer = -T.dir; T.reset(); return 'win';
  };
  /** the thumb lifts (or lands): near the end, that trace is done; then either end can start the next */
  T.lift = () => {
    T.chunk = [0, 0]; T.h = null;
    const r = T.dir && T.s >= T.P.L - NEAR ? T.win() : '';
    T.prefer = 0;
    return r;
  };
  /** the keyboard roll: d radians turned the right way */
  T.roll = (d, t) => {
    if (!T.dir) { T.dir = 1; T.P = FWD; T.s = 0; }
    T.s += d / TAU * T.P.L; T.moved = t;
    if (T.s >= T.P.L - END) { T.reset(); return 'win'; }
    return '';
  };
  T.moved = -9;
  return T;
}

/**
 * @param clip   the clip's URL (null: a dark screen, the struggle still plays)
 * @param title  the headline (BREAK FREE!)
 * @param text   a line under it: where she is, what's holding her
 * @param diff   'normal' | 'hard', or an object like STRUGGLE.normal
 * @returns Promise<boolean> true when she breaks free
 */
export function struggle({ clip = null, title = 'BREAK FREE!', text = '', diff = 'normal' } = {}) {
  const D = typeof diff === 'object' ? diff : STRUGGLE[diff] || STRUGGLE.normal;
  const NEED = D.traces || D.turns || 3, SLIP = D.slip ?? 0.35, IDLE = D.idle ?? 0.45;
  const host = $('cutscene')?.parentElement || document.body;
  const el = document.createElement('div');
  el.className = 'c3-struggle sg';
  const [s0x, s0y] = S_PATH[0], [s1x, s1y] = S_PATH[S_PATH.length - 1], S = ptsStr(S_PATH);
  el.innerHTML = `<video muted playsinline loop preload="auto"></video><div class="st-tint"></div>
    <div class="st-top"><h2>${title}</h2>${text ? `<div class="st-text">${text}</div>` : ''}<div class="st-time"><i></i></div></div>
    <div class="st-gest sg"><svg viewBox="88 50 330 150"><polyline class="sg-ghost" points="${S}"/><circle class="sg-gdot" r="13"/></svg></div>
    <div class="st-shield"><img src="${IMG}" alt="" draggable="false"><svg viewBox="0 0 ${IW} ${IH}">
      <polygon class="sg-rim" points="66,30 384,17 432,95 214,289 21,88"/>
      <polyline class="sg-lane" points="${S}"/><polyline class="sg-ink" points="${S}"/><polyline class="sg-guide" points="${S}"/>
      <polyline class="sg-glow" points=""/><polyline class="sg-trail" points=""/>
      <circle class="sg-end" cx="${s0x}" cy="${s0y}" r="17"/><circle class="sg-end" cx="${s1x}" cy="${s1y}" r="17"/>
      <circle class="sg-cur" r="15" cx="-99" cy="-99"/>
      <text class="sg-count" x="203" y="262"></text></svg></div>
    <div class="st-say"></div>
    <div class="st-hint"></div>`;
  host.appendChild(el);
  UI.open++;
  const touchy = document.body.classList.contains('touch');
  const HINT = touchy ? 'TRACE THE S · ANY SPOT' : 'DRAG THE S · OR ROLL WASD';
  const video = el.querySelector('video'), pad = el.querySelector('.st-shield');
  const glow = el.querySelector('.sg-glow'), trail = el.querySelector('.sg-trail'), curDot = el.querySelector('.sg-cur'), gdot = el.querySelector('.sg-gdot');
  const timeBar = el.querySelector('.st-time i'), hint = el.querySelector('.st-hint'), count = el.querySelector('.sg-count'), say = el.querySelector('.st-say');
  hint.textContent = HINT;
  video.setAttribute('playsinline', '');
  if (clip) { video.src = clip; video.play().catch(() => {}); }

  return new Promise((resolve) => {
    const tr = tracer(IW / ((pad.getBoundingClientRect().width || 156) * S_GAIN));
    let banked = 0, t = 0, last = performance.now(), done = false, raf = 0, missT = -9, sayT = -9, misses = 0, drawn = '';
    let ang = null, kdir = 0, back = 0; // the keyboard roll
    let ptr = null;                       // { id, x, y } the thumb tracing
    const held = new Set(), whyMiss = [];
    const speak = (lines, cls) => { say.textContent = pick(lines); say.className = `st-say on ${cls}`; sayT = t; };
    const pop = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
    const finish = () => {
      if (done) return;
      banked++;
      speak(SAY_WIN, 'win'); sfx.punch(); pop(el, 'jolt'); pop(pad, 'flash');
    };
    const miss = (why) => {
      whyMiss.push(`${why}@${Math.round(tr.missAt / LEN * 100)}`); if (whyMiss.length > 12) whyMiss.shift();
      misses++; pop(pad, 'miss');
      if (t - missT >= MISS_GAP) { missT = t; speak(SAY_MISS, 'miss'); }
    };
    const result = (r) => { if (r === 'win') finish(); else if (r) miss(r); };
    const grab = (e) => { ptr = { id: e.pointerId, x: e.clientX, y: e.clientY }; result(tr.lift()); };
    const sample = (x, y) => { const dx = x - ptr.x, dy = y - ptr.y; ptr.x = x; ptr.y = y; result(tr.move(dx, dy, t)); };
    const down = (e) => { e.preventDefault(); if (!ptr) grab(e); };
    const move = (e) => {
      // a thumb that was already down when she got caught (on the joystick, mid-run) and keeps going:
      // it's the struggle's thumb now, no lift-and-tap first (a hovering mouse isn't)
      if (!ptr && (e.pointerType === 'touch' || e.pointerType === 'pen' || e.buttons)) { grab(e); return; }
      if (!ptr || e.pointerId !== ptr.id || done) return;
      const co = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      if (co.length > 1) for (const c of co) sample(c.clientX, c.clientY);
      else sample(e.clientX, e.clientY);
    };
    const up = (e) => { if (ptr && e.pointerId === ptr.id) { ptr = null; result(tr.lift()); } };
    // keyboard: roll round WASD; turning one way fills the trace, a wiggle back and forth doesn't
    const turnTo = (a) => {
      if (ang === null) { ang = a; return; }
      let d = a - ang;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      ang = a;
      if (Math.abs(d) > 1.65 || Math.abs(d) < 0.004) return;
      if (!kdir) kdir = Math.sign(d);
      if (Math.sign(d) !== kdir) { back += Math.abs(d); if (back > 0.9) { kdir = -kdir; back = 0; } return; }
      back = 0;
      result(tr.roll(Math.abs(d), t));
    };
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
      if (a !== null) turnTo(a);
    };
    const ku = (e) => {
      if (!KEYS[e.code]) return;
      e.preventDefault(); e.stopPropagation();
      held.delete(e.code);
      const a = keyAngle(); // (rolling W → W+D → D: letting go of W is part of the turn)
      if (a !== null) turnTo(a);
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
    // test hook (tools/shots): finish it either way, or bank one trace
    const hook = {
      win: () => end(true), lose: () => end(false), trace: () => { tr.reset(); finish(); },
      state: () => ({ got: banked + tr.s / LEN, need: NEED, traces: banked, cur: tr.s / LEN, dir: tr.dir, misses, whyMiss: whyMiss.slice(), t, stalled: el.classList.contains('stall'), say: say.classList.contains('on') ? say.textContent : '' }),
    };
    window.__struggle = hook;

    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now; t += dt;
      // standing still (after a moment's grace at the start): the clip freezes and shakes, the trace drains
      const stalled = t > 0.9 && t - Math.max(tr.moved, sayT) > IDLE;
      if (stalled) {
        if (tr.s > 0) tr.s = Math.max(0, tr.s - SLIP * LEN * dt);
        if (!el.classList.contains('stall')) { el.classList.add('stall'); video.pause(); hint.textContent = 'KEEP TRACING!'; }
      } else if (el.classList.contains('stall') || (video.paused && clip)) {
        el.classList.remove('stall'); hint.textContent = HINT;
        video.play().catch(() => {});
      }
      if (t - sayT > 1.3) say.classList.remove('on');
      // the gesture hint (a dot tracing a thumb-sized S) until she gets going, and whenever she stops
      const gest = (banked === 0 && tr.s < LEN * 0.3) || stalled;
      el.classList.toggle('gesture', gest);
      if (gest) { const g = at(FWD, ((t * 0.55) % 1.15) * LEN); gdot.setAttribute('cx', g[0].toFixed(0)); gdot.setAttribute('cy', g[1].toFixed(0)); }
      // the trail so far, the bead, the count
      const key = `${tr.dir}:${Math.round(tr.s)}`;
      if (key !== drawn) {
        drawn = key;
        const p = tr.point();
        const str = tr.dir && tr.s > 0 ? ptsStr(tr.P.pts.slice(0, p[2]).concat([[p[0], p[1]]])) : '';
        trail.setAttribute('points', str); glow.setAttribute('points', str);
        curDot.style.display = tr.dir ? "" : "none"; curDot.setAttribute("cx", p[0].toFixed(0)); curDot.setAttribute("cy", p[1].toFixed(0));
      }
      pad.classList.toggle('fresh', !tr.dir);
      count.textContent = `${Math.min(NEED, banked)}/${NEED}`;
      timeBar.style.width = Math.max(0, (1 - t / D.time) * 100) + '%';
      if (banked >= NEED) return end(true);
      if (t >= D.time) return end(false);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
