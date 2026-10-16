// "Which one is hers?" (docs/design/act2.md, RLD Walks: the lead doors): four copies of one piece of
// her original suit on a rail, cut from the user's green-screen flat-lays (assets/SGCostume/). Every
// copy is stained (drinks, lipstick, makeup), the real one too, so a stain never gives it away: the
// tell is how it's made. Each fake is wrong in one way: the shade of red, a plastic sheen, visible
// stitching, or (the top) the S mirrored. Over the haze line the copies swim and swap places.
import { costumeImage } from '../hotel/art.js';
import { dialog } from '../ui.js';
import { shuffle, pick, rand } from '../util.js';

// Where each piece sits in a flat-lay (fractions of the 640×360 keyed picture: x0, y0, x1, y1).
export const PIECES = {
  cape: { name: 'cape', src: 'classic_08', rect: [0.03, 0.08, 0.36, 0.98] },
  top: { name: 'top', src: 'classic_04', rect: [0.35, 0.02, 0.65, 0.42] },
  skirt: { name: 'skirt', src: 'classic_04', rect: [0.63, 0.02, 0.94, 0.47] },
  boots: { name: 'boots', src: 'classic_04', rect: [0.57, 0.44, 0.83, 0.99] },
  briefs: { name: 'briefs', src: 'tubetop_01', rect: [0.62, 0.04, 0.93, 0.45] },
};
const TELLS = {
  shade: 'the red is off: too orange, or too pink',
  sheen: 'it shines like plastic',
  stitch: 'the stitching shows on the outside',
  S: 'the S is the wrong way round',
};
const STAINS = [['#c0306a', 'lipstick'], ['#5a1020', 'red wine'], ['#2a2028', 'mascara'], ['#c89a40', 'spilled champagne']];
// the night she lost, a piece at a time (act2.md): a stain read while she's high brings one back
const FLASHES = ['The room spinning, the chandelier going round and round.', 'A lounge, a VIP rope, a glass she didn\'t order.', 'A dark room. Hands. Then nothing.', 'A red-lit floor, and her suit going out of the door in someone\'s arms.'];

const CW = 220, CH = 180;
/** One copy of the piece: the crop, fitted to a card, with its defect and a stain. */
function copyCanvas(img, P, defect) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const [x0, y0, x1, y1] = P.rect, sw = (x1 - x0) * img.width, sh = (y1 - y0) * img.height;
  const s = Math.min((CW - 16) / sw, (CH - 16) / sh), w = sw * s, h = sh * s;
  if (defect === 'S') { g.translate(CW, 0); g.scale(-1, 1); }
  g.drawImage(img, x0 * img.width, y0 * img.height, sw, sh, (CW - w) / 2, (CH - h) / 2, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (defect === 'shade') {
    const d = g.getImageData(0, 0, CW, CH), q = d.data, orange = Math.random() < 0.5;
    for (let i = 0; i < q.length; i += 4) {
      if (q[i + 3] < 20 || q[i] < 90 || q[i] < q[i + 1] * 1.5 || q[i] < q[i + 2] * 1.5) continue;
      if (orange) q[i + 1] = Math.min(255, q[i + 1] + q[i] * 0.32); else q[i + 2] = Math.min(255, q[i + 2] + q[i] * 0.42);
    }
    g.putImageData(d, 0, 0);
  }
  g.globalCompositeOperation = 'source-atop'; // everything below lands on the fabric only
  if (defect === 'sheen') {
    for (let k = 0; k < 3; k++) {
      const x = rand(0.1, 0.8) * CW, gr = g.createLinearGradient(x, 0, x + 40, CH);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
    }
  }
  if (defect === 'stitch') {
    g.strokeStyle = '#ffe066'; g.lineWidth = 2; g.setLineDash([5, 4]);
    for (const k of [0.32, 0.68]) { g.beginPath(); g.moveTo(CW * 0.1, CH * k); g.bezierCurveTo(CW * 0.4, CH * (k - 0.12), CW * 0.6, CH * (k + 0.12), CW * 0.9, CH * k); g.stroke(); }
    g.setLineDash([]);
  }
  const [col] = pick(STAINS), sx = rand(0.3, 0.7) * CW, sy = rand(0.3, 0.7) * CH, r = rand(10, 18);
  const st = g.createRadialGradient(sx, sy, 1, sx, sy, r);
  st.addColorStop(0, col); st.addColorStop(0.7, col + 'aa'); st.addColorStop(1, col + '00');
  g.fillStyle = st; g.beginPath(); g.ellipse(sx, sy, r * 1.3, r, rand(0, 3), 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over';
  return c;
}

/**
 * The four copies of `piece`, shuffled: [{ canvas, real, defect }]. Resolves null if the flat-lay
 * won't load (the room then says the rail is empty).
 */
export async function makeCopies(piece) {
  const P = PIECES[piece], img = await costumeImage(P.src);
  if (!img) return null;
  const pool = shuffle(piece === 'top' ? ['S', 'shade', 'sheen', 'stitch'] : ['shade', 'sheen', 'stitch']).slice(0, 3);
  return shuffle([null, ...pool].map((defect) => ({ canvas: copyCanvas(img, P, defect), real: !defect, defect })));
}

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `.rld-which .modal{width:min(96vw,760px);padding:12px 14px 10px}
.rld-which .opts{display:flex;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:6px}
.rld-which .opt.rld-c{width:calc(25% - 6px);min-width:0;padding:4px;flex-direction:column;align-items:center}
.rld-which .opt.rld-c .l{width:100%}
.rld-which .opt:not(.rld-c){width:100%}
.rld-card{display:block;width:100%;height:auto;max-height:28vh;object-fit:contain;background:radial-gradient(#3a1424,#12060c);border-radius:6px}
.rld-haze .opt.rld-c{animation:rld-swim 2.6s ease-in-out infinite}
.rld-haze .opt.rld-c:nth-child(2){animation-delay:-.7s}.rld-haze .opt.rld-c:nth-child(3){animation-delay:-1.4s}.rld-haze .opt.rld-c:nth-child(4){animation-delay:-2s}
@keyframes rld-swim{0%,100%{transform:translate(0,0) rotate(0)}30%{transform:translate(5px,-4px) rotate(2deg)}70%{transform:translate(-5px,3px) rotate(-2deg)}}`;
  document.head.appendChild(s);
}

/**
 * The pick. `copies` from makeCopies(); `haze` = over the haze line (the copies swim and swap).
 * Resolves { right, copy } after the verdict, or null if she steps back.
 */
export async function whichOne(piece, copies, { haze = false, flash = false } = {}) {
  style();
  const P = PIECES[piece];
  const memory = `Yours: deep cherry red, a soft matte finish, the seams hidden inside${piece === 'top' ? ', and the S just so' : ''}.`;
  const opts = copies.map((c, i) => ({ label: `<img class="rld-card" src="${c.canvas.toDataURL('image/jpeg', 0.85)}" alt="Copy ${i + 1}">`, value: i, cls: 'rld-c' }));
  opts.push({ label: 'Step back (come back later)', value: null });
  let timer = null;
  if (haze) {
    // the perfume: the copies swim, and every couple of seconds two of them trade places
    timer = setInterval(() => {
      const box = [...document.querySelectorAll('#modal-root .rld-which .opts')].pop();
      if (!box) return;
      const cards = [...box.querySelectorAll('.opt.rld-c')];
      const [a, b] = shuffle(cards).slice(0, 2);
      if (a && b) { const tmp = document.createElement('span'); a.replaceWith(tmp); b.replaceWith(a); tmp.replaceWith(b); }
    }, 2200);
  }
  const v = await dialog({
    title: 'WHICH ONE IS HERS?', cls: `rld-which${haze ? ' rld-haze' : ''}`,
    text: `Four of her ${P.name === 'boots' || P.name === 'briefs' ? P.name : P.name + 's'} on the rail, every one of them stained. ${memory}<span class="hint">The stains prove nothing. Look at how each one is made.${haze ? ' The perfume makes them swim.' : ''}</span>`,
    options: opts,
  });
  if (timer) clearInterval(timer);
  if (v === null || v === undefined) return null;
  const copy = copies[v];
  if (copy.real) {
    const stain = flash ? `<br><br>The stain on it pulls at something. <i>${pick(FLASHES)}</i>` : '<br><br>A stain on it she can\'t place. Not yet.';
    await dialog({ title: 'That one is hers.', text: `The right red, the right weight, the seams where she sewed them.${stain}` });
    return { right: true, copy };
  }
  await dialog({ title: 'A copy.', text: `Up close, ${TELLS[copy.defect]}. Somebody made these to fool her, and it worked. The real one is gone from this rail.` });
  return { right: false, copy };
}
