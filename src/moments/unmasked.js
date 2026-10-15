// r11 F2b: the impostor's catch ends on a comic panel, not a text box with a Continue button: a
// blue halftone panel slams in left of centre (clear of the LIVE panel and the thumb controls) with
// UNMASKED! and one caption line, holds, and goes by itself. The act's catch flow awaits it.

export const UNMASK = { hold: 2.6 }; // seconds on screen

let el = null, timer = 0;

/** Show the panel; resolves when it's gone. */
export function unmaskedPanel(caption, { word = 'UNMASKED!', tag = 'WIG OFF!', hold = UNMASK.hold } = {}) {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!el) {
    el = document.createElement('div');
    el.id = 'mo-unmask';
    el.innerHTML = '<i></i><b></b><small></small>';
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  el.querySelector('i').textContent = tag;
  el.querySelector('b').textContent = word;
  el.querySelector('small').textContent = caption;
  el.classList.remove('on');
  void el.offsetWidth; // (restart the slam)
  el.classList.add('on');
  clearTimeout(timer);
  return new Promise((resolve) => { timer = setTimeout(() => { el.classList.remove('on'); setTimeout(resolve, 200); }, hold * 1000); });
}
