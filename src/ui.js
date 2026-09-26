import { sfx } from './sfx.js';
import { $ } from './util.js';

/** UI.open > 0 means a modal is up and the game simulation is paused. */
export const UI = { open: 0 };

export function openModal(html, cls = '') {
  const back = document.createElement('div');
  back.className = 'modal-back ' + cls;
  back.innerHTML = `<div class="modal">${html}</div>`;
  $('modal-root').appendChild(back);
  UI.open++;
  return back;
}

export function closeModal(el) {
  if (!el.isConnected) return;
  el.remove();
  UI.open = Math.max(0, UI.open - 1);
}

/**
 * Show a dialog with choices. Resolves with the chosen option's value.
 * Number keys 1-n pick options on keyboard.
 */
export function dialog({ title, speaker, text, options = [{ label: 'Continue', value: true }], cls = '', portrait } = {}) {
  return new Promise((resolve) => {
    const el = openModal(
      `${portrait ? '<div class="portrait"></div>' : ''}` +
      `${title ? `<h2>${title}</h2>` : ''}` +
      `${speaker ? `<div class="speaker">${speaker}</div>` : ''}` +
      `${text ? `<div class="dtext">${text}</div>` : ''}` +
      `<div class="opts">${options.map((o, i) =>
        `<button class="opt ${o.cls || ''}" data-i="${i}" ${o.disabled ? 'disabled' : ''}><span class="k">${i + 1}</span><span class="l">${o.label}${o.note ? `<small>${o.note}</small>` : ''}</span></button>`).join('')}</div>`,
      'dlg ' + cls);
    if (portrait) el.querySelector('.portrait').appendChild(portrait);
    let done = false;
    const choose = (i) => {
      const o = options[i];
      if (done || !o || o.disabled) return;
      done = true;
      removeEventListener('keydown', onKey, true);
      closeModal(el);
      sfx.click();
      resolve(o.value);
    };
    el.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose(+b.dataset.i)));
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); choose(n - 1); }
      else if ((e.key === 'Enter' || e.key === ' ') && options.length === 1) { e.preventDefault(); e.stopPropagation(); choose(0); }
    };
    addEventListener('keydown', onKey, true);
  });
}

export function toast(msg, kind = 'info') {
  const host = $('toasts');
  if (!host) return;
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.textContent = msg;
  host.appendChild(d);
  while (host.children.length > 4) host.firstChild.remove();
  setTimeout(() => d.classList.add('out'), 2600);
  setTimeout(() => d.remove(), 3100);
}

export function banner(text, sub = '', color = '#fff') {
  const b = $('banner');
  b.innerHTML = `<div style="color:${color}">${text}</div>${sub ? `<small>${sub}</small>` : ''}`;
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

export function flash(color = '#fff') {
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}

/** Mash-the-button quick-time event. Resolves true if the player hits `need` presses in time. */
export function qte({ title, text, label = 'RESIST!', need = 14, time = 4 }) {
  return new Promise((resolve) => {
    const el = openModal(`<h2>${title}</h2><div class="dtext">${text}</div>
      <div class="bar" style="height:12px"><i class="b-alert" style="width:100%"></i></div>
      <div class="bar" style="height:12px;margin-top:6px"><i class="b-en" style="width:0%"></i></div>
      <button class="qte-btn">${label}</button>
      <div class="dtext" style="text-align:center;margin:8px 0 0;font-size:12px;opacity:.7">Tap fast — or mash SPACE / E</div>`, 'dlg danger');
    const [tBar, pBar] = el.querySelectorAll('.bar > i');
    let n = 0, t0 = performance.now(), done = false;
    const hit = () => {
      if (done) return;
      n++; sfx.punch();
      pBar.style.width = Math.min(100, (n / need) * 100) + '%';
      if (n >= need) finish(true);
    };
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); hit(); }
    };
    el.querySelector('.qte-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    addEventListener('keydown', onKey, true);
    const tick = () => {
      if (done) return;
      const left = 1 - (performance.now() - t0) / 1000 / time;
      tBar.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) finish(false); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    function finish(ok) {
      done = true;
      removeEventListener('keydown', onKey, true);
      setTimeout(() => { closeModal(el); resolve(ok); }, 250);
    }
  });
}

/** Numeric keypad. Resolves with the entered string, or null if cancelled. */
export function keypad(title, len = 4) {
  return new Promise((resolve) => {
    const el = openModal(`<h2>${title}</h2><div class="kp-screen">____</div><div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-d="${d}">${d}</button>`).join('')}
      <button data-d="c">✕</button><button data-d="0">0</button><button data-d="ok">OK</button></div>
      <div class="opts" style="margin-top:12px"><button class="opt" data-d="x"><span class="k">⎋</span><span class="l">Step away</span></button></div>`, 'dlg');
    const screen = el.querySelector('.kp-screen');
    let v = '';
    const draw = () => { screen.textContent = (v + '____').slice(0, len); };
    const press = (d) => {
      sfx.click();
      if (d === 'x') return finish(null);
      if (d === 'c') v = v.slice(0, -1);
      else if (d === 'ok') { if (v.length === len) return finish(v); }
      else if (v.length < len) v += d;
      draw();
    };
    el.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => press(b.dataset.d)));
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('c');
      else if (e.key === 'Enter') press('ok');
      else if (e.key === 'Escape') press('x');
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    addEventListener('keydown', onKey, true);
    function finish(r) { removeEventListener('keydown', onKey, true); closeModal(el); resolve(r); }
  });
}
