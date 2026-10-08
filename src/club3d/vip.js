// The VIP (docs/design/nightclub.md "Special room: VIP"). The rope: a wristband, a famous face,
// or the drop. Inside, the host lounges on his couch and runs his game: questions answered in
// order (the answers are the rumours she picked up on the floor), drinks offered between them
// (take one: a second chance, but the words swim; refuse: he times the next answer). Fail and he
// says "Dance for me": a 3x3 numpad lit on the beat next to the dance clip (never over it), the
// clip playing only while her taps are right. Clean: one more try at his questions. Messy:
// another polaroid in the owner's envelope.
import { dialog, toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { tierOf } from '../commentary.js';
import { HERO } from '../data.js';
import { clamp } from '../util.js';
import { scramble } from './cast.js';

const DANCE = { playSecs: 12, maxMisses: 8, clean: 2, speedUp: 0.55, folder: 'ClubDance', plate: 'assets/nightclub/plates/vip.jpg' };

export const vipMethods = {
  async vipRope() {
    if (this.items.has('VIP wristband')) {
      await dialog({ speaker: 'Rope bouncer', text: 'He checks the wristband, unhooks the rope. "Enjoy."' });
      return this.letIntoVip();
    }
    const famous = !this.undercover && ['idol', 'hero'].includes(tierOf(this.g.state.rep));
    const v = await dialog({ speaker: 'Rope bouncer', text: '"Wristband?"', options: [
      { label: `"I'm ${HERO}."`, note: famous ? 'Your name opens doors tonight' : this.undercover ? 'Not in these clothes' : 'Your reputation isn\'t great right now', value: 'fame', disabled: this.undercover },
      { label: 'Walk away', value: null },
    ] });
    if (v !== 'fame') return;
    if (famous) {
      await dialog({ speaker: 'Rope bouncer', text: `"No way. ${HERO}! Go on up. Can I… get a picture after?"` });
      this.addCard('fans', `${HERO} posing at the VIP rope`);
      return this.letIntoVip();
    }
    this.alert = Math.min(90, this.alert + 15);
    await dialog({ speaker: 'Rope bouncer', text: '"Sure you are. Get lost before I call it in."<span class="hint">A wristband would do it: they turn up at the bar and the coat check. Or slip past at the drop.</span>' });
  },

  letIntoVip() { this.vipIn = true; this.openDoorOf('vip'); sfx.door(); },

  async vipQuiz() {
    if (this.t < (this.vipLock || 0)) { toast(`${this.caseDef.vip?.host || 'He'} waves you off. "Come back when you've learned some manners."`, 'bad'); return; }
    const V = this.caseDef.vip, st = this.g.state;
    if (!V) return;
    await dialog({ speaker: V.host, text: V.intro });
    // waking up on his couch: he starts holding the cards (the first answer's on the clock, no second chances)
    let second = 0, penalty = this.quizPenalty;
    this.quizPenalty = false;
    for (const q of V.questions) {
      // a drink first: a second chance for her, but the words start to swim
      const drink = await dialog({ speaker: V.host, text: '"Champagne?"', options: [{ label: 'Take a glass', note: '+15 intoxication · he relaxes: one wrong answer forgiven', value: true, cls: 'risky' }, { label: '"I\'m fine."', note: 'He\'ll watch you more closely', value: false }] });
      let timed = 0;
      if (drink) { sfx.drink(); st.addIntox(15); if (!penalty) second++; } else timed = 9;
      if (penalty) { timed = 7; penalty = false; }
      const known = this.learned.has(q.id);
      const swim = clamp((st.intox - 40) / 80, 0, 0.45);
      const opts = q.options.map((o) => ({ label: swim > 0 ? scramble(o.label, swim) : o.label, value: o.value, note: known && o.value === q.answer ? 'You heard this on the floor' : undefined }));
      const a = timed ? await this.choiceTimer({ speaker: V.host, text: q.q, options: opts, secs: timed }) : await dialog({ speaker: V.host, text: q.q, options: opts });
      if (a === q.answer) { sfx.pickup(); continue; }
      if (second > 0) { second--; await dialog({ speaker: V.host, text: '"Ha. Wrong, but I like you. Try that again."' }); const b = await dialog({ speaker: V.host, text: q.q, options: opts }); if (b === q.answer) { sfx.pickup(); continue; } }
      return this.vipFail();
    }
    this.vipDone = true;
    await this.gotClue(V.win, { title: V.host });
  },

  async vipFail() {
    const V = this.caseDef.vip;
    await dialog({ speaker: V.host, text: '"Wrong. Now… <b>dance for me</b>." His friends whoop. Somebody lifts a phone.' });
    const res = await this.danceGame();
    this.addCard('dance', `${HERO} dancing for the VIP table`, res.snap);
    if (res.misses <= DANCE.clean) {
      await dialog({ speaker: V.host, text: '"Okay, okay. You can move. One more try."' });
      return this.vipQuiz();
    }
    this.addCard('couch', `${HERO} stumbling through a dance`);
    this.vipLock = this.t + 60;
    await dialog({ speaker: V.host, text: '"That was… something." The table laughs. A polaroid develops on the table.<span class="hint">He won\'t talk to you for a minute. Learn his answers on the floor.</span>' });
  },

  // ---------------------------------------------------------------- the dance
  /**
   * The VIP dance: the clip on the left (or top, portrait), the numpad in its own solid panel on
   * the right (or below). Cells light on the beat; the clip plays only while she taps them right.
   * Resolves { misses } when the clip has played through (or too many misses).
   */
  danceGame() {
    return new Promise((resolve) => {
      const g = this.g, inp = g.input;
      this.video.show(DANCE.folder, { keyed: true }).then(() => this.video.el.play().catch(() => {}));
      this.video.pause();
      const back = new Image(); back.src = DANCE.plate;
      const key = document.createElement('canvas'), kx = key.getContext('2d', { willReadFrequently: true });
      const S = { t: 0, played: 0, misses: 0, lit: -1, litT: 0, hitWin: false, pauseT: 0.6, flash: 0, hits: 0 };
      const beat = 60 / this.music.bpm; // (the keys light on the music's beat)
      const kb = (e) => { const n = +e.key; if (n >= 1 && n <= 9) { e.preventDefault(); e.stopPropagation(); press(n - 1); } };
      addEventListener('keydown', kb, true);
      document.body.classList.add('c3-flat');
      g.input.setStick(false);
      g.input.setButtons([]);
      const layout = () => {
        const W = g.w, H = g.h, land = W >= H;
        const vid = land ? { x: 0, y: 0, w: Math.round(W * 0.6), h: H } : { x: 0, y: 0, w: W, h: Math.round(H * 0.55) };
        const pad = land ? { x: vid.w, y: 0, w: W - vid.w, h: H } : { x: 0, y: vid.h, w: W, h: H - vid.h };
        const cell = Math.max(64, Math.min((pad.w - 40) / 3, (pad.h - 110) / 3));
        const gx = pad.x + (pad.w - cell * 3) / 2, gy = pad.y + Math.max(70, (pad.h - cell * 3) / 2 + 20);
        return { vid, pad, cell, gx, gy, land };
      };
      const press = (i) => {
        if (S.done) return;
        if (i === S.lit && S.hitWin) { S.hitWin = false; S.hits++; sfx.click(); S.good = 0.25; S.pauseT = 0; }
        else miss();
      };
      const miss = () => {
        S.misses++; S.pauseT = 0.8; S.flash = 0.3; S.hitWin = false;
        sfx.scratch ? sfx.scratch() : sfx.lose();
        if (S.misses >= DANCE.maxMisses) finish();
      };
      const finish = () => {
        if (S.done) return;
        S.done = true;
        // a frame of the dance (somebody at the table was filming)
        const L = layout(), snap = document.createElement('canvas');
        snap.width = Math.round(L.vid.w); snap.height = Math.round(L.vid.h);
        try { snap.getContext('2d').drawImage(g.canvas, 0, 0, g.canvas.width * (L.vid.w / g.w), g.canvas.height * (L.vid.h / g.h), 0, 0, snap.width, snap.height); } catch (e) { /* no frame */ }
        removeEventListener('keydown', kb, true);
        document.body.classList.remove('c3-flat');
        this.sub = null;
        this.video.show('ClubDJ', { extra: ['assets/nightclub/plates/set_main.mp4'] });
        this.setupControls(); this.envHud();
        g.input.setStick(true);
        resolve({ misses: S.misses, snap });
      };
      this.sub = {
        update: (dt) => {
          S.t += dt; S.flash = Math.max(0, S.flash - dt); S.good = Math.max(0, (S.good || 0) - dt);
          // speeds up as the clip goes on
          const spb = beat / (1 + DANCE.speedUp * clamp(S.played / DANCE.playSecs, 0, 1));
          S.litT -= dt;
          if (S.litT <= 0) {
            if (S.lit >= 0 && S.hitWin && S.t > 1) miss(); // the window closed without a tap
            S.litT = spb; S.lit = Math.floor(Math.random() * 9); S.hitWin = true;
          }
          const L = layout();
          for (const tap of inp.taps) {
            const c = Math.floor((tap.x - L.gx) / L.cell), r = Math.floor((tap.y - L.gy) / L.cell);
            if (c >= 0 && c < 3 && r >= 0 && r < 3) press(r * 3 + c);
          }
          inp.taps.length = 0;
          S.pauseT = Math.max(0, S.pauseT - dt);
          const playing = S.pauseT <= 0 && S.hits > 0;
          if (playing) { if (this.video.el.paused) this.video.el.play().catch(() => {}); S.played += dt; }
          else if (!this.video.el.paused) this.video.el.pause();
          if (S.played >= DANCE.playSecs) finish();
        },
        render: (ctx) => {
          const L = layout(), W = g.w, H = g.h;
          ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
          // the clip: keyed over the VIP room (cover-fit, nothing on top of it)
          const v = L.vid;
          ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
          if (back.complete && back.naturalWidth) {
            const s = Math.max(v.w / back.naturalWidth, v.h / back.naturalHeight);
            ctx.globalAlpha = 0.75; ctx.drawImage(back, v.x + (v.w - back.naturalWidth * s) / 2, v.y + (v.h - back.naturalHeight * s) / 2, back.naturalWidth * s, back.naturalHeight * s); ctx.globalAlpha = 1;
          }
          const el = this.video.el;
          if (el.readyState >= 2 && el.videoWidth) {
            const kw = 240, kh = Math.round((kw * el.videoHeight) / el.videoWidth);
            if (key.width !== kw || key.height !== kh) { key.width = kw; key.height = kh; }
            kx.drawImage(el, 0, 0, kw, kh);
            const im = kx.getImageData(0, 0, kw, kh), d = im.data;
            for (let i = 0; i < d.length; i += 4) {
              const r = d[i], gg = d[i + 1], b = d[i + 2], m = Math.max(r, b), gs = gg - m;
              if (gs > 18) { const a = clamp(1 - (gs - 18) / 45, 0, 1); d[i + 3] = a * 255; d[i + 1] = Math.min(gg, m * 1.05); }
            }
            kx.putImageData(im, 0, 0);
            const s = Math.min(v.w / kw, v.h / kh) * 0.98;
            ctx.drawImage(key, v.x + (v.w - kw * s) / 2, v.y + v.h - kh * s, kw * s, kh * s);
          }
          if (S.pauseT > 0 && S.t > 0.7) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(v.x, v.y, v.w, v.h); ctx.font = `bold ${Math.round(Math.min(v.w, v.h) * 0.12)}px Bangers, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff3a5a'; ctx.fillText(S.hits ? 'MISSED!' : 'TAP THE LIT KEY', v.x + v.w / 2, v.y + v.h / 2); }
          ctx.restore();
          // the numpad, in its own solid panel
          const p = L.pad;
          ctx.fillStyle = '#120a1c'; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#ff3fb8'; ctx.fillRect(L.land ? p.x : 0, L.land ? 0 : p.y, L.land ? 3 : W, L.land ? H : 3);
          ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(Math.max(16, L.cell * 0.22))}px Bangers, Impact, sans-serif`;
          ctx.fillStyle = '#ffd84d'; ctx.fillText('DANCE FOR HIM', p.x + p.w / 2, L.gy - Math.max(34, L.cell * 0.35));
          ctx.font = `${Math.round(Math.max(12, L.cell * 0.15))}px system-ui, sans-serif`; ctx.fillStyle = '#c8b8e0';
          ctx.fillText(`Tap the lit key on the beat · missed ${S.misses}/${DANCE.maxMisses}`, p.x + p.w / 2, L.gy - Math.max(12, L.cell * 0.12));
          for (let i = 0; i < 9; i++) {
            const x = L.gx + (i % 3) * L.cell, y = L.gy + Math.floor(i / 3) * L.cell, lit = i === S.lit;
            ctx.fillStyle = lit ? (S.good > 0 ? '#3ee08a' : '#ffd84d') : '#24183a';
            ctx.fillRect(x + 5, y + 5, L.cell - 10, L.cell - 10);
            ctx.strokeStyle = lit ? '#fff' : '#4a3a6a'; ctx.lineWidth = 3; ctx.strokeRect(x + 5, y + 5, L.cell - 10, L.cell - 10);
            ctx.fillStyle = lit ? '#120a1c' : '#7a6a9a'; ctx.font = `bold ${Math.round(L.cell * 0.32)}px Bangers, Impact, sans-serif`;
            ctx.fillText(String(i + 1), x + L.cell / 2, y + L.cell * 0.62);
          }
          // progress: how much of the clip she's danced through
          const pw = p.w - 40, py = L.gy + L.cell * 3 + 18;
          ctx.fillStyle = '#24183a'; ctx.fillRect(p.x + 20, py, pw, 10);
          ctx.fillStyle = '#ff3fb8'; ctx.fillRect(p.x + 20, py, pw * clamp(S.played / DANCE.playSecs, 0, 1), 10);
          if (S.flash > 0) { ctx.fillStyle = `rgba(255,40,80,${S.flash})`; ctx.fillRect(v.x, v.y, v.w, v.h); } // (the video only: the keys stay readable)
        },
      };
    });
  },
};
