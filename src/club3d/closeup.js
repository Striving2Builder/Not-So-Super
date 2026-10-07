// Close-ups in the 3D club (docs/design/nightclub.md "Close-ups"): the user's close-up renders (the
// bar, the coat check, the DJ booth, the VIP table, the restroom sinks, the office desk) drawn
// flat over the paused 3D view; tap the spots. Same art, more kinds of looking: a phone opens as a
// phone (the messages drawn in code), a note or a ledger opens as paper, and in drug-vision a UV
// layer shows writing nobody sober can see. What a spot means is the case's (cases/*.js).
import { CLOSEUPS } from '../nightclub/scenes.js';
import { PLATE } from '../nightclub/rooms.js';
import { dialog, toast, UI } from '../ui.js';
import { $ } from '../util.js';

const READ = new Set(['napkin', 'list', 'setlist', 'ledger', 'receipt', 'card', 'tickets']);

export const closeupMethods = {
  openCloseup(kind) {
    const sc = CLOSEUPS[kind];
    if (!sc || this.sub) return;
    if (!sc.img) { sc.img = new Image(); sc.img.src = PLATE.dir + sc.src; }
    const g = this.g, inp = g.input;
    this.setXray(false);
    document.body.classList.add('c3-flat');
    inp.setStick(false); // (its touch zone sat over the spots on the left)
    inp.setButtons([{ id: 'back', label: 'BACK', key: 'E', cls: 'big' }, { id: 'notes', label: 'CASE', key: 'N', slot: 1 }]);
    $('prompt').classList.remove('on'); $('marker').classList.remove('on');
    const uv = this.dvision > 0 || g.state.intox >= 60;
    let ring = null, view = null;
    toast(uv ? 'Tap anything out of place. Drug-vision shows what\'s written in UV.' : 'Tap anything that looks out of place.', 'info');
    const close = () => {
      this.sub = null;
      document.body.classList.remove('c3-flat');
      inp.setStick(true);
      this.setupControls(); this.envHud();
    };
    const rect = (w, h) => {
      const iw = sc.img.naturalWidth || 1280, ih = sc.img.naturalHeight || 720, s = Math.max(w / iw, h / ih);
      return { x: (w - iw * s) / 2, y: (h - ih * s) * 0.8, w: iw * s, h: ih * s };
    };
    this.sub = {
      update: (dt) => {
        if (UI.open) return;
        if (inp.pressed('back') || inp.pressed('interact')) { if (view) view = null; else { inp.taps.length = 0; close(); } return; }
        if (inp.pressed('notes')) { this.run(() => this.caseBoard()); return; }
        const tap = inp.taps.shift();
        if (!tap) return;
        if (view) { view = null; return; }
        const R = rect(g.w, g.h), u = (tap.x - R.x) / R.w, v = (tap.y - R.y) / R.h;
        const hit = sc.spots.find((s) => Math.hypot((u - s.x) * (R.w / R.h), v - s.y) < s.r * 1.25);
        if (!hit) { ring = { x: tap.x, y: tap.y, t: 0, miss: true }; return; }
        ring = { x: R.x + hit.x * R.w, y: R.y + hit.y * R.h, t: 0 };
        this.run(() => this.useSpot(kind, sc, hit, (vw) => { view = vw; }));
      },
      render: (ctx) => {
        const w = g.w, h = g.h;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        if (!sc.img.complete || !sc.img.naturalWidth) return;
        const R = rect(w, h);
        ctx.drawImage(sc.img, R.x, R.y, R.w, R.h);
        if (uv) this.drawUV(ctx, R, kind);
        for (const s of sc.spots) {
          if (!this.book.has(kind, s.id)) continue;
          const x = R.x + s.x * R.w, y = R.y + s.y * R.h, r = s.r * R.w * 0.7;
          ctx.strokeStyle = '#05040a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 3; ctx.stroke();
        }
        if (ring) {
          ring.t += this.frameDt || 1 / 60;
          const a = Math.max(0, 1 - ring.t / 0.6), r = 18 + ring.t * 90;
          ctx.strokeStyle = ring.miss ? `rgba(200,200,220,${a})` : `rgba(255,216,77,${a})`; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2); ctx.stroke();
          if (a <= 0) ring = null;
        }
        const seen = sc.spots.filter((s) => this.book.has(kind, s.id)).length;
        ctx.font = `bold ${Math.round(Math.max(16, h * 0.05))}px Bangers, Impact, sans-serif`; ctx.textAlign = 'left';
        const label = `${sc.title.toUpperCase()} · ${seen}/${sc.spots.length} SEARCHED · CASE ${this.book.count}/${this.caseDef.need}`;
        ctx.lineWidth = 5; ctx.strokeStyle = '#05040a'; ctx.strokeText(label, 18, h - 22); ctx.fillStyle = '#ffd84d'; ctx.fillText(label, 18, h - 22);
        if (view) this.drawView(ctx, w, h, view);
      },
      hud: () => {},
    };
  },

  /** A tapped spot: a drink is offered, a phone opens as a phone, a note as paper, the rest as text. */
  async useSpot(kind, sc, s, show) {
    const key = `${kind}:${s.id}`, c = this.book.clue(kind, s.id);
    if (!c) { toast('Nothing useful there.', 'info'); return; }
    if (c.drink) {
      if (key === 'main:vial') return this.drinkVial(c.text);
      const v = await dialog({ title: this.caseDef.drugName || 'A drink', text: c.text, options: [{ label: 'Knock it back', note: '+22 intoxication', value: true, cls: 'risky' }, { label: 'Leave it', value: false }] });
      if (v) { this.g.state.addIntox(22); this.book.find(kind, s.id); }
      return;
    }
    const fresh = !this.book.has(kind, s.id);
    if (s.id.includes('phone')) show({ kind: 'phone', text: c.text });
    else if (READ.has(s.id)) show({ kind: 'paper', text: c.text });
    await this.gotClue(key, { title: sc.title, quiet: !fresh || s.id.includes('phone') || READ.has(s.id) });
  },

  /** A phone (lock screen + message bubbles) or a scrap of paper, drawn over the close-up. */
  drawView(ctx, w, h, v) {
    const text = v.text.replace(/<[^>]+>/g, '');
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, w, h);
    const wrap = (s, max, font) => {
      ctx.font = font;
      const out = []; let line = '';
      for (const word of s.split(' ')) { const t = line ? `${line} ${word}` : word; if (ctx.measureText(t).width > max && line) { out.push(line); line = word; } else line = t; }
      if (line) out.push(line);
      return out;
    };
    if (v.kind === 'phone') {
      const ph = Math.min(h * 0.86, 560), pw = Math.min(w * 0.8, ph * 0.58), x = (w - pw) / 2, y = (h - ph) / 2;
      ctx.fillStyle = '#0a0a0e'; ctx.fillRect(x - 10, y - 10, pw + 20, ph + 20);
      const g = ctx.createLinearGradient(x, y, x, y + ph); g.addColorStop(0, '#1a2a4a'); g.addColorStop(1, '#3a1a3a');
      ctx.fillStyle = g; ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(ph * 0.09)}px system-ui, sans-serif`; ctx.fillText('2:03', x + pw / 2, y + ph * 0.16);
      const font = `${Math.round(ph * 0.034)}px system-ui, sans-serif`, lines = wrap(text, pw * 0.72, font);
      const lh = ph * 0.046, bh = lines.length * lh + 18, by = y + ph * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(x + pw * 0.08, by, pw * 0.84, bh);
      ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.font = font;
      lines.forEach((l, i) => ctx.fillText(l, x + pw * 0.12, by + 14 + (i + 0.75) * lh));
      ctx.fillStyle = '#aab'; ctx.textAlign = 'center'; ctx.font = `${Math.round(ph * 0.028)}px system-ui, sans-serif`; ctx.fillText('tap to put it back', x + pw / 2, y + ph * 0.94);
    } else {
      const pw = Math.min(w * 0.6, 520), font = `${Math.round(Math.max(18, pw * 0.05))}px "Comic Sans MS", "Marker Felt", cursive`, lines = wrap(text, pw - 60, font);
      const lh = pw * 0.07, ph = lines.length * lh + 70, x = (w - pw) / 2, y = (h - ph) / 2;
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.03); ctx.translate(-w / 2, -h / 2);
      ctx.fillStyle = '#f4ecd8'; ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = 'rgba(80,110,180,.25)'; ctx.lineWidth = 1;
      for (let ly = y + 40; ly < y + ph - 10; ly += lh) { ctx.beginPath(); ctx.moveTo(x + 14, ly + 6); ctx.lineTo(x + pw - 14, ly + 6); ctx.stroke(); }
      ctx.fillStyle = '#2a2040'; ctx.textAlign = 'left'; ctx.font = font;
      lines.forEach((l, i) => ctx.fillText(l, x + 30, y + 40 + i * lh));
      ctx.restore();
    }
  },

  /** Drug-vision over a close-up: a violet wash and glowing scrawl (the DJ booth's has the stock code). */
  drawUV(ctx, R, kind) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(120,60,200,.55)'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = `bold ${Math.round(R.h * 0.07)}px "Comic Sans MS", "Marker Felt", cursive`; ctx.textAlign = 'center';
    ctx.shadowColor = '#c070ff'; ctx.shadowBlur = 18; ctx.fillStyle = '#e8b8ff';
    const t = this.t;
    if (kind === 'main') ctx.fillText(`STOCK ${this.stockCode}`, R.x + R.w * 0.3, R.y + R.h * (0.18 + Math.sin(t) * 0.003));
    ctx.fillText(this.caseDef.uvLine || '', R.x + R.w * 0.62, R.y + R.h * 0.12);
    ctx.restore();
  },

  /** Anything flat over the 3D view goes when the zone does. */
  closeOverlays() {
    if (this.brawlerOn) { this.brawlerOn.exit(); this.brawlerOn = null; }
    this.sub = null;
    document.body.classList.remove('c3-flat');
    const t = $('c3-talk'); if (t) t.classList.remove('on');
  },
};
