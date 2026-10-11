// Crowd chatter (docs/design/nightclub.md "Crowd chatter"): dancers near her get short bubbles,
// a few at a time. Atmosphere (its tone follows her reputation), rumours (tap to note: they're
// the VIP's answers and the case's leads), whispers (only with super-hearing), reactions to her
// state, offers (tap to accept: an intoxication path) and, in costume, fans who recognise her:
// phones come up and the bouncers look over.
import { tierOf } from '../commentary.js';
import { comic } from '../comic.js';
import { toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { pick, clamp, $ } from '../util.js';
import { scramble } from './cast.js';
import { INTOX_HAZE } from '../state.js';

const ATMOS = {
  good: ['This DJ is insane!', 'I love this song!', 'Best night ever!', 'Is that… Supergirl? No way!', 'Somebody said Supergirl\'s here!', 'Turn it UP!'],
  mid: ['Who\'s the girl in the cape?', 'Drinks are watered down again.', 'My feet are killing me.', 'Where\'s Jess? She had my phone.', 'Two more songs, then we go.'],
  bad: ['Ugh. The drunk superhero.', 'Hide your drinks, Supergirl\'s here.', 'Didn\'t she pass out on the news?', 'Ask her for a selfie. For the memes.'],
};
const REACT = {
  high: ['She\'s wasted!', 'Is Supergirl… drunk?', 'Somebody get her some water…', 'Whoa, careful!'],
  dance: ['Go off, cape!', 'She can DANCE!', 'Woooo!', 'Yes, girl!'],
  alert: ['Someone get security…', 'She\'s snooping around.', 'Why is she staring at the bouncers?'],
};
const OFFERS = [
  { id: 'pill', text: '"Want a hit? First one\'s free."', label: 'TAP: TAKE IT' },
  { id: 'shot', text: '"Shot for the hero?"', label: 'TAP: DRINK' },
];

export const chatterMethods = {
  startChatter() {
    this.chatterT = 3; this.recog = 0; this.fansCard = false;
    let layer = $('c3-chat');
    if (!layer) { layer = document.createElement('div'); layer.id = 'c3-chat'; $('game').appendChild(layer); }
    layer.innerHTML = '';
    this.chatLayer = layer;
  },

  endChatter() { if (this.chatLayer) this.chatLayer.innerHTML = ''; },

  stepChatter(dt) {
    if (!this.chatLayer) return;
    this.updateTapBubbles();
    if (this.busy || this.room && this.room.kind !== 'dark' && this.room.kind !== 'lounge') { this.chatterT = Math.max(this.chatterT, 1); return; }
    this.stepRecognition(dt);
    this.chatterT -= dt;
    if (this.chatterT > 0) return;
    this.chatterT = 2 + Math.random() * 1.8;
    const h = this.hero.position, st = this.g.state, d = this.caseDef;
    const p = this.crowd.nearest(h.x + (Math.random() - 0.5) * 5, h.z - 1 - Math.random() * 4, 6, (q) => Math.hypot(q.x - h.x, q.z - h.z) > 1.0 && !q.talking);
    if (!p) return;
    const anchor = () => this.screenOf({ x: p.x, y: p.y ?? 0, z: p.z }, 2.05);
    const a0 = anchor();
    const W = this.g.w, H = this.g.h;
    if (!a0 || a0.x < W * 0.2 || a0.x > W * 0.8 || a0.y < H * 0.24 || a0.y > H * 0.8) return; // (on screen, clear of the HUD panels and the buttons)
    const whispers = (d.whispers || []).filter((r) => !this.noted.has(r.id));
    const rumours = (d.rumours || []).filter((r) => !this.noted.has(r.id));
    const roll = Math.random();
    if (this.hearing && whispers.length && roll < 0.55) return this.tapBubble(p, anchor, whispers[0], 'whisper');
    if (rumours.length && roll < 0.3) return this.tapBubble(p, anchor, pick(rumours), 'rumour');
    if (roll < 0.42 && !this.offerOut) return this.tapBubble(p, anchor, pick(OFFERS), 'offer');
    let line;
    if (st.intox >= INTOX_HAZE && Math.random() < 0.6) line = pick(REACT.high);
    else if (this.dancing && Math.random() < 0.7) line = pick(REACT.dance);
    else if (this.alert > 60) line = pick(REACT.alert);
    else {
      const tier = tierOf(st.rep);
      line = pick(tier === 'idol' || tier === 'hero' ? ATMOS.good : tier === 'flop' || tier === 'fraud' ? ATMOS.bad : ATMOS.mid);
    }
    const a = anchor();
    comic.say(st.intox >= 60 ? scramble(line, 0.2) : line, a.x, a.y, { kind: 'speech', ms: 2000, anchor });
  },

  /** A bubble you can tap: a rumour or whisper (noted) or an offer (accepted). Lives in its own layer. */
  tapBubble(p, anchor, item, kind) {
    const st = this.g.state;
    const el = document.createElement('button');
    el.className = `c3b ${kind}`;
    const text = kind === 'offer' ? item.text : `"${this.rumourText(item)}"`;
    el.innerHTML = `${kind === 'whisper' ? '<b>WHISPER</b>' : ''}<span>${this.garbled() && kind !== 'offer' ? scramble(text, 0.25) : text}</span><small>${kind === 'offer' ? item.label : 'TAP TO NOTE'}</small>`;
    p.talking = true;
    const b = { el, anchor, p, t: kind === 'whisper' ? 5.5 : 4.4, item, kind };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (b.gone) return;
      b.gone = true; el.classList.add('out');
      if (kind === 'offer') { this.offerOut = false; this.run(() => this.acceptOffer(item.id)); }
      else if (this.garbled()) toast(this.caseDef.highOnly ? `Sober, it sounds like nonsense. On ${this.caseDef.drugName} you'd get it.` : 'The words swim away before you can hold on to them.', 'bad');
      else this.noteRumour(item, kind === 'whisper');
    });
    this.chatLayer.appendChild(el);
    if (kind === 'offer') this.offerOut = true;
    this.taps = this.taps || [];
    this.taps.push(b);
    sfx.click();
    while (this.taps.length > 2) this.dropBubble(this.taps[0]);
  },

  dropBubble(b) {
    b.gone = true; b.p.talking = false;
    if (b.kind === 'offer') this.offerOut = false;
    b.el.classList.add('out');
    setTimeout(() => b.el.remove(), 300);
    this.taps = this.taps.filter((q) => q !== b);
  },

  updateTapBubbles() {
    const dt = this.frameDt || 1 / 60;
    for (const b of [...(this.taps || [])]) {
      b.t -= dt;
      const a = b.anchor();
      if (b.gone || b.t <= 0 || !a || this.busy) { this.dropBubble(b); continue; }
      const w = b.el.offsetWidth || 180, hgt = b.el.offsetHeight || 60;
      const x = clamp(a.x - w / 2, 8, this.g.w - w - 8), y = clamp(a.y - hgt - 18, 56, this.g.h - hgt - 90);
      b.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    }
  },

  /** In costume and out in the open, people start to recognise her: phones up, a crowd gathers. */
  stepRecognition(dt) {
    if (this.undercover || this.room) { this.recog = Math.max(0, this.recog - dt * 10); return; }
    const open = this.blend < 0.3 && this.cover >= 1;
    this.recog = clamp(this.recog + dt * (open ? 7 : -6) * (this.dancing ? 0.3 : 1), 0, 100);
    if (this.recog < 100) return;
    this.recog = 25;
    const p = this.crowd.nearest(this.hero.position.x, this.hero.position.z, 3);
    const s = p && this.screenOf({ x: p.x, y: 0, z: p.z }, 2.05);
    if (s) { comic.say(pick(['OMG it\'s SUPERGIRL!', 'Supergirl! Over here!', 'Get a picture, quick!']), s.x, s.y, { kind: 'shout', ms: 2000 }); comic.pow('SNAP!', s.x + 40, s.y - 40, { size: 0.6, colors: ['#ffffff', '#ffd84d'] }); }
    sfx.shutter?.();
    this.alert = Math.min(95, this.alert + 14);
    toast('Phones are up. The bouncers look over.', 'bad');
    if (!this.fansCard) { this.fansCard = true; this.addCard('fans', 'Fans filmed you in the club'); }
  },
};
