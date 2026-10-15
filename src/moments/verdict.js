// r11 F2a: every air event lands. A won or lost moment gets a brief freeze (the sim near-still for
// a beat) and a comic panel slammed in left of centre (clear of the LIVE panel top-right and the
// controls): SAVED! / BUSTED! on a yellow halftone panel, ESCAPED! / TOO LATE! on a red one, with a
// one-line caption under the word. One panel at a time; a newer verdict replaces the old one.

/** Word + caption per event kind and outcome (null: that outcome stays quiet). */
const WORDS = {
  faller: { won: ['SAVED!', 'The window-washer is safe'], lost: ['TOO LATE!', 'The awning broke his fall. Just.'] },
  car: { won: ['STOPPED!', 'Runaway car stopped cold'], lost: ['CRASHED!', 'The runaway car hit the barrier'] },
  getaway: { won: ['BUSTED!', 'The getaway car is going nowhere'], lost: ['ESCAPED!', 'The getaway car lost her in traffic'] },
  heli: { won: ['SAVED!', 'Chopper and crew set down safe'], lost: ['CRASHED!', 'The chopper went down hard'] },
  rings: { won: ['NAILED IT!', 'Stunt course cleared'], lost: ['OUT OF TIME!', 'The course closed on her'] },
  kitten: { won: ['SAVED!', 'One very grateful kitten'], lost: null },
};
export const VERDICT = { freeze: 0.3, hold: 2.8 }; // freeze: real seconds the sim nearly stops; hold: the panel's time on screen (r11 F2c: as long as the payoff rides with her, payoff.js)

let el = null, timer = 0;

/** Show the verdict for an air event (e.kind, e.outcome 'won' | 'lost'); dir freezes the sim. */
export function verdict(dir, kind, won) {
  const w = WORDS[kind]?.[won ? 'won' : 'lost'];
  if (!w || typeof document === 'undefined') return;
  dir.freeze?.(VERDICT.freeze);
  if (!el) {
    el = document.createElement('div');
    el.id = 'mo-verdict';
    el.innerHTML = '<b></b><small></small>';
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  el.querySelector('b').textContent = w[0];
  el.querySelector('small').textContent = w[1];
  el.className = won ? 'won' : 'lost';
  void el.offsetWidth; // (restart the slam)
  el.classList.add('on');
  clearTimeout(timer);
  // r11 F2c: and never before the payoff in her hands has gone (the carry runs on game time)
  const off = () => { if (dir.ow?.events?.carry) timer = setTimeout(off, 150); else el.classList.remove('on'); };
  timer = setTimeout(off, (VERDICT.freeze + VERDICT.hold) * 1000);
}
