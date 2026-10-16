// The High-Roller Suite's two tables (docs/design/act2.md "The casino"): high card and 21, as a DOM
// overlay over the held 3D room (phone first: the felt on the left, big buttons on the right, like the
// VIP dance's numpad panel). One sitting plays hands until she wins the table, runs out of things to
// bet, or gets up. The stakes are the casino's (casino.js): `onLose()` pays for a lost hand and says
// whether she's thrown out. Her X-ray can read the dealer's face-down card, once a hand, but the pit
// boss may catch the glint: that hand is forfeit.
//   ?casinorig=win|lose stacks the deck (the harness).
import { sfx } from '../sfx.js';
import { shuffle, chance } from '../util.js';

const SUITS = ['♠', '♥', '♦', '♣'], RED = new Set(['♥', '♦']);
const FACE = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const XRAY_CAUGHT = 0.3; // the pit boss sees her eyes glow
const card = (r, s) => ({ r, s, up: true });
const label = (c) => FACE[c.r] || String(c.r);
const bjVal = (c) => (c.r === 14 ? 11 : Math.min(10, c.r));

/** 21: the best total of a hand (aces 11 or 1). */
export function total(hand) {
  let t = 0, aces = 0;
  for (const c of hand) { t += bjVal(c); if (c.r === 14) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return t;
}

function deck(kind, rig) {
  const d = shuffle(SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => card(i + 2, s))));
  if (!rig) return d;
  // draw order: high card = hers, the dealer's, then the swap; 21 = hers ×2, the dealer's ×2, then hits
  const seq = kind === 'high'
    ? (rig === 'win' ? [[14, '♠'], [2, '♣'], [13, '♥']] : [[2, '♦'], [14, '♣'], [3, '♥']])
    : (rig === 'win' ? [[14, '♥'], [13, '♠'], [9, '♣'], [7, '♦']] : [[10, '♣'], [6, '♦'], [10, '♥'], [10, '♠'], [10, '♦']]);
  return [...seq.map(([r, s]) => card(r, s)), ...d];
}

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `#cas-table{position:fixed;inset:0;z-index:54;display:flex;align-items:center;justify-content:center;padding:max(8px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:rgba(8,2,4,.55);font-family:system-ui,sans-serif;color:#fff;touch-action:manipulation;user-select:none}
#cas-table .ct{display:flex;width:min(100%,860px);height:min(100%,420px);border:3px solid #111;border-radius:16px;overflow:hidden;box-shadow:6px 6px 0 rgba(0,0,0,.6),inset 0 0 0 2px #e0b040}
#cas-table .felt{flex:1 1 62%;position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:10px 14px;background:radial-gradient(ellipse at 50% 40%,#1f7a46,#0b3a22 75%);min-width:0}
#cas-table .felt:after{content:'';position:absolute;inset:8px;border:2px solid rgba(255,216,77,.35);border-radius:40% / 22%;pointer-events:none}
#cas-table .side{flex:0 0 38%;display:flex;flex-direction:column;gap:7px;padding:10px 12px;background:#170a0c;border-left:3px solid #e0b040;min-width:0}
#cas-table h3{margin:0;font:400 clamp(20px,5.4vh,30px) Bangers,Impact,sans-serif;letter-spacing:.04em;color:#ffd84d;text-shadow:2px 2px 0 #000}
#cas-table .kit{font-size:12px;line-height:1.35;color:#e8d8c0}
#cas-table .kit s{color:#a07070}
#cas-table .row{display:flex;align-items:center;gap:8px;min-height:30%;z-index:1}
#cas-table .who{width:64px;font:400 15px Bangers,Impact,sans-serif;letter-spacing:.05em;color:#ffe9a8}
#cas-table .who small{display:block;font:600 11px system-ui,sans-serif;color:#cfe8d8}
#cas-table .c{width:clamp(44px,12vh,64px);aspect-ratio:5/7;border-radius:7px;background:#fbf7ee;border:2px solid #111;box-shadow:2px 3px 0 rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;font:800 clamp(16px,4.6vh,24px) Georgia,serif;color:#111;animation:ct-in .25s ease-out both}
#cas-table .c.r{color:#c4102a}
#cas-table .c i{font-style:normal;font-size:.9em;line-height:1}
#cas-table .c.down{background:repeating-linear-gradient(45deg,#8a0c1e 0 6px,#5a0610 6px 12px);color:transparent}
#cas-table .c.xr{background:#cfe8ff;color:#123;outline:3px solid #7ec8f4}
#cas-table .msg{z-index:1;text-align:center;min-height:22px;font:400 clamp(17px,4.6vh,24px) Bangers,Impact,sans-serif;letter-spacing:.04em;color:#fff;text-shadow:2px 2px 0 #000}
#cas-table .msg.good{color:#9dff9a}#cas-table .msg.bad{color:#ff8a8a}
#cas-table .line{font-size:12px;line-height:1.35;color:#f0e0c8;flex:1 1 auto;overflow:auto}
#cas-table .btns{display:flex;flex-direction:column;gap:6px}
#cas-table button{min-height:44px;border:2px solid #111;border-radius:10px;background:#e0b040;color:#1a0a06;font:400 19px Bangers,Impact,sans-serif;letter-spacing:.05em;box-shadow:2px 2px 0 #000;cursor:pointer}
#cas-table button.alt{background:#3a2228;color:#f0e0c8}
#cas-table button.risk{background:#7ec8f4}
#cas-table.haze .c{animation:ct-swim 2.4s ease-in-out infinite;filter:blur(.6px)}
#cas-table.haze .row .c:nth-child(3){animation-delay:-.8s}
@keyframes ct-in{from{transform:translateY(-14px) rotate(-6deg);opacity:0}}
@keyframes ct-swim{0%,100%{transform:translate(0,0) rotate(0)}40%{transform:translate(3px,-3px) rotate(3deg)}70%{transform:translate(-3px,2px) rotate(-2deg)}}
@media (orientation:portrait){#cas-table .ct{flex-direction:column;height:min(100%,640px)}#cas-table .side{border-left:0;border-top:3px solid #e0b040}}`;
  document.head.appendChild(s);
}

/**
 * Sit at a table. kind 'high' | 'bj'. opts: { name, rig, haze(), kit() (html), onWin(), onLose() → { out, line } }.
 * Resolves 'win' (the table is hers), 'out' (thrown out), or 'leave'. `api` (optional object) gets the
 * live hand for the harness: api.hand = { kind, mine, theirs, phase }.
 */
export function sitAt(kind, opts, api = {}) {
  style();
  const host = document.getElementById('modal-root')?.parentElement || document.body;
  const el = document.createElement('div');
  el.id = 'cas-table';
  el.innerHTML = `<div class="ct"><div class="felt"><div class="row theirs"></div><div class="msg"></div><div class="row mine"></div></div>
    <div class="side"><h3></h3><div class="kit"></div><div class="line"></div><div class="btns"></div></div></div>`;
  host.appendChild(el);
  const $ = (q) => el.querySelector(q);
  $('h3').textContent = opts.name;
  const cards = (hand) => hand.map((c) => `<div class="c${c.up ? '' : c.xr ? ' xr' : ' down'}${RED.has(c.s) && (c.up || c.xr) ? ' r' : ''}">${c.up || c.xr ? `${label(c)}<i>${c.s}</i>` : ''}</div>`).join('');
  const H = { kind, mine: [], theirs: [], phase: 'deal', xray: false };
  api.hand = H;
  const draw = () => {
    el.classList.toggle('haze', !!opts.haze?.());
    $('.kit').innerHTML = opts.kit?.() || '';
    const tot = (h) => (kind === 'bj' && h.length ? `<small>${h.every((c) => c.up) ? total(h) : '?'}</small>` : '');
    $('.theirs').innerHTML = `<div class="who">Dealer${tot(H.theirs)}</div>${cards(H.theirs)}`;
    $('.mine').innerHTML = `<div class="who">You${tot(H.mine)}</div>${cards(H.mine)}`;
  };
  const say = (t, cls = '') => { const m = $('.msg'); m.textContent = t; m.className = `msg ${cls}`; };
  const line = (html) => { $('.line').innerHTML = html || ''; };
  /** Buttons: [{ label, value, cls }] → the value tapped (keys 1-4 too). */
  const ask = (btns) => new Promise((resolve) => {
    const box = $('.btns');
    box.innerHTML = btns.map((b, i) => `<button data-i="${i}" class="${b.cls || ''}">${b.label}</button>`).join('');
    const done = (i) => { removeEventListener('keydown', key, true); sfx.click(); resolve(btns[i].value); };
    const key = (e) => { const n = +e.key; if (n >= 1 && n <= btns.length) { e.preventDefault(); e.stopPropagation(); done(n - 1); } };
    addEventListener('keydown', key, true);
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); done(+b.dataset.i); }, { once: true }));
  });
  const xray = () => {
    H.xray = true;
    const hole = H.theirs.find((c) => !c.up);
    if (chance(XRAY_CAUGHT) && opts.rig !== 'win') return false;
    if (hole) hole.xr = true;
    sfx.whoosh?.();
    return true;
  };

  /** One hand of high card: her card up, the dealer's down; keep, swap once, or X-ray his. */
  async function highHand(D) {
    H.mine = [D.shift()]; H.theirs = [{ ...D.shift(), up: false }]; H.phase = 'play';
    let swapped = false;
    for (;;) {
      draw(); say('Higher card wins');
      const v = await ask([
        { label: 'Show cards', value: 'show' },
        ...(!swapped ? [{ label: 'Swap yours (once)', value: 'swap', cls: 'alt' }] : []),
        ...(!H.xray ? [{ label: 'X-ray his card', value: 'xray', cls: 'risk' }] : []),
      ]);
      if (v === 'swap') { swapped = true; H.mine = [D.shift()]; sfx.click(); continue; }
      if (v === 'xray') { if (!xray()) return 'caught'; continue; }
      break;
    }
    H.theirs[0].up = true; H.phase = 'shown'; draw();
    return H.mine[0].r > H.theirs[0].r ? 'win' : H.mine[0].r < H.theirs[0].r ? 'lose' : 'push';
  }

  /** One hand of 21: hit or stand; the dealer draws to 17. */
  async function bjHand(D) {
    H.mine = [D.shift(), D.shift()]; H.theirs = [D.shift(), { ...D.shift(), up: false }]; H.phase = 'play';
    if (total(H.mine) === 21) { H.theirs[1].up = true; draw(); return total(H.theirs) === 21 ? 'push' : 'win'; }
    for (;;) {
      draw(); say(`You have ${total(H.mine)}`);
      const v = await ask([
        { label: 'Hit', value: 'hit' }, { label: 'Stand', value: 'stand', cls: 'alt' },
        ...(!H.xray ? [{ label: 'X-ray his card', value: 'xray', cls: 'risk' }] : []),
      ]);
      if (v === 'xray') { if (!xray()) return 'caught'; continue; }
      if (v === 'stand') break;
      H.mine.push(D.shift()); sfx.click();
      if (total(H.mine) > 21) { H.theirs[1].up = true; draw(); return 'lose'; }
    }
    H.theirs[1].up = true;
    while (total(H.theirs) < 17) H.theirs.push(D.shift());
    H.phase = 'shown'; draw();
    const a = total(H.mine), b = total(H.theirs);
    return b > 21 || a > b ? 'win' : a < b ? 'lose' : 'push';
  }

  const close = (v) => { el.remove(); return v; };
  return (async () => {
    line(opts.intro || '');
    draw();
    if (await ask([{ label: 'Deal me in', value: true }, { label: 'Get up', value: false, cls: 'alt' }]) !== true) return close('leave');
    for (;;) {
      const D = deck(kind, opts.rig);
      H.xray = false;
      const r = kind === 'high' ? await highHand(D) : await bjHand(D);
      H.phase = 'result';
      draw();
      if (r === 'push') { say('Push: nobody wins', ''); line('A tie. The dealer gathers the cards.'); await ask([{ label: 'Deal again', value: 1 }]); continue; }
      if (r === 'win') {
        sfx.pickup();
        say(kind === 'bj' && total(H.mine) === 21 && H.mine.length === 2 ? 'Twenty-one!' : 'You win the table!', 'good');
        line(await opts.onWin());
        await ask([{ label: 'Leave the table', value: 1 }]);
        return close('win');
      }
      sfx.lose();
      say(r === 'caught' ? 'The pit boss saw your eyes glow!' : kind === 'bj' && total(H.mine) > 21 ? 'Bust!' : 'The house wins', 'bad');
      const L = await opts.onLose(r === 'caught');
      draw(); line(L.line);
      if (L.out) { await ask([{ label: 'They walk you out…', value: 1, cls: 'alt' }]); return close('out'); }
      if (await ask([{ label: 'Deal again', value: true }, { label: 'Get up', value: false, cls: 'alt' }]) !== true) return close('leave');
    }
  })();
}
