// Quick prompts (docs/design/nightclub.md "Look and feel"): the club's small talk, without stopping
// the club. A line someone says is a speech bubble over them; a small choice is a panel at the foot
// of the screen, its options on keys 1–3 (or a tap), while the music, the crowd and the bouncers
// carry on. Walk away and it's a no. Story beats (the office, the VIP host, the accusation) stay modal.
import { comic } from '../comic.js';
import { toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { $ } from '../util.js';

const WALK_OFF = 3.2;   // metres from where it was asked: further is a no

const where = (at) => (at && at.position ? at.position : at);

export const quickMethods = {
  /** Someone says a line: a speech bubble over them (a toast when they're off screen). at: {x, y?, z} or an Object3D. */
  say(at, text, { ms = 2800, speaker = '' } = {}) {
    const p = where(at);
    const anchor = () => (p ? this.screenOf({ x: p.x, y: p.y ?? 0, z: p.z }, 2.05) : null);
    const a = anchor();
    if (!a || a.x < 30 || a.x > this.g.w - 30 || a.y < 60 || a.y > this.g.h - 40) { toast(speaker ? `${speaker}: ${text}` : text, 'info'); return; }
    comic.say(text, a.x, a.y, { kind: 'speech', ms, anchor });
  },

  /**
   * A small choice that doesn't stop the club. options: [{ label, note?, value, cls? }]. Resolves the
   * chosen value, or `away` if she walks off or something takes over (a fight, sedation, the end).
   */
  quick({ speaker = '', text = '', options, at = null, away = null }) {
    if (this.closeQuick) this.closeQuick(this.quickOn?.away ?? null);
    return new Promise((resolve) => {
      let el = $('c3-quick');
      if (!el) { el = document.createElement('div'); el.id = 'c3-quick'; $('game').appendChild(el); }
      el.innerHTML = `${speaker ? `<b class="who">${speaker}</b>` : ''}${text ? `<div class="txt">${text}</div>` : ''}<div class="opts">${options.map((o, i) =>
        `<button class="q ${o.cls || ''}" data-i="${i}"><span class="k">${i + 1}</span><span class="l">${o.label}${o.note ? `<small>${o.note}</small>` : ''}</span></button>`).join('')}</div>`;
      el.classList.add('on');
      const h = this.hero.position, p = where(at) || h, from = { x: h.x, z: h.z, ax: p.x, az: p.z };
      const wasBusy = this.busy;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        removeEventListener('keydown', onKey, true);
        el.classList.remove('on');
        this.quickOn = null; this.closeQuick = null;
        this.busy = wasBusy; // (back to the act that asked, which finishes the interaction)
        resolve(v);
      };
      const choose = (i) => { if (!options[i]) return; sfx.click(); finish(options[i].value); };
      el.querySelectorAll('.q').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); choose(+b.dataset.i); }));
      const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) { e.preventDefault(); e.stopPropagation(); choose(n - 1); } };
      addEventListener('keydown', onKey, true);
      this.quickOn = { from, away };
      this.closeQuick = finish;
      this.busy = false; // she can move while it's up: walking off answers it
    });
  },

  /** Per frame: walking off, or anything taking over, closes the prompt. */
  stepQuick() {
    const q = this.quickOn;
    if (!q) return;
    const h = this.hero.position;
    if (this.sub || this.sedating || this.done || Math.hypot(h.x - q.from.x, h.z - q.from.z) > WALK_OFF) this.closeQuick(q.away);
  },
};
