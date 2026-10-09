// The VIP (docs/design/nightclub.md "Special room: VIP"). The rope: a wristband, a famous face,
// or the drop. Inside, the host lounges on his couch and runs his game: questions answered in
// order (the answers are the rumours she picked up on the floor), drinks offered between them
// (take one: a second chance, but the words swim; refuse: he times the next answer). Fail and he
// says "Dance for me": a 3x3 numpad lit on the beat next to the dance clip (never over it), the
// clip playing only while her taps are right. Clean: one more try at his questions. Messy:
// another polaroid in the owner's envelope.
import * as THREE from 'three';
import { dialog, toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { tierOf } from '../commentary.js';
import { HERO } from '../data.js';
import { clamp } from '../util.js';
import { scramble } from './cast.js';

// beats: a key lights every this many beats of the music; lose (more than `clean` misses) and the
// table plays her dance back full screen, on loop, until she taps
const DANCE = { playSecs: 12, maxMisses: 10, clean: 3, beats: 2, speedUp: 0.2, folder: 'ClubDance', plate: 'assets/nightclub/plates/vip.jpg' };

/**
 * The dance clip, keyed on the GPU at the clip's own resolution (one shader quad drawn by the 3D
 * renderer into the left viewport): the VIP room plate behind her (cover fit), the clip in front
 * (contain fit, standing on the bottom edge), green pulled out with a soft edge and its spill.
 */
const SIZE = new THREE.Vector2();
function danceView(video, plateUrl) {
  const plate = new THREE.TextureLoader().load(plateUrl);
  plate.colorSpace = THREE.SRGBColorSpace;
  const U = { vid: { value: video.tex }, plate: { value: plate }, viewA: { value: 1 }, vidA: { value: 9 / 16 }, plateA: { value: 3.375 }, ready: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D vid, plate; uniform float viewA, vidA, plateA, ready; varying vec2 vUv;
void main(){
  vec2 pu = vUv - 0.5;
  if (viewA > plateA) pu.y *= plateA / viewA; else pu.x *= viewA / plateA;
  vec3 c = texture2D(plate, pu + 0.5).rgb * 0.7;
  const float s = 0.98;
  vec2 vu;
  if (viewA > vidA) { float w = vidA / viewA * s; vu = vec2((vUv.x - (1.0 - w) * 0.5) / w, vUv.y / s); }
  else { float h = viewA / vidA * s; vu = vec2((vUv.x - (1.0 - s) * 0.5) / s, vUv.y / h); }
  if (vu.x >= 0.0 && vu.x <= 1.0 && vu.y >= 0.0 && vu.y <= 1.0) {
    vec3 v = texture2D(vid, vu).rgb;
    float g = v.g - max(v.r, v.b);
    float a = (1.0 - smoothstep(0.06, 0.2, g)) * ready;
    v.g = min(v.g, max(v.r, v.b) * 1.05);
    c = mix(c, v, a);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    U,
    /** Draw it into the CSS-pixel rect v of the renderer's canvas (top-left origin). */
    draw(r, v, H, video) {
      const el = video.el;
      U.ready.value = el.readyState >= 2 ? 1 : 0;
      if (el.videoWidth) U.vidA.value = el.videoWidth / el.videoHeight;
      if (plate.image?.width) U.plateA.value = plate.image.width / plate.image.height;
      U.viewA.value = v.w / v.h;
      const size = r.getSize(SIZE);
      r.setViewport(v.x, H - v.y - v.h, v.w, v.h);
      r.render(scene, cam);
      r.setViewport(0, 0, size.x, size.y);
    },
    dispose() { quad.geometry.dispose(); mat.dispose(); plate.dispose(); },
  };
}

export const vipMethods = {
  async vipRope() {
    if (this.items.has('VIP wristband')) {
      this.say(this.ropeGuard.mesh, '"Enjoy."', { speaker: 'Rope bouncer' });
      toast('He checks the wristband and unhooks the rope.', 'good');
      return this.letIntoVip();
    }
    const famous = !this.undercover && ['idol', 'hero'].includes(tierOf(this.g.state.rep));
    const v = await this.quick({ speaker: 'Rope bouncer', text: '"Wristband?"', at: this.ropeGuard.mesh, options: [
      ...(this.undercover ? [] : [{ label: `"I'm ${HERO}."`, note: famous ? 'Your name opens doors tonight' : 'Your reputation isn\'t great right now', value: 'fame' }]),
      { label: 'Walk away', value: null },
    ] });
    if (v !== 'fame') return;
    if (famous) {
      this.say(this.ropeGuard.mesh, `"No way. ${HERO}! Go on up. Can I… get a picture after?"`, { ms: 3600, speaker: 'Rope bouncer' });
      this.addCard('fans', `${HERO} posing at the VIP rope`);
      return this.letIntoVip();
    }
    this.alert = Math.min(90, this.alert + 15);
    this.say(this.ropeGuard.mesh, '"Sure you are. Get lost before I call it in."', { speaker: 'Rope bouncer' });
    toast('A wristband would do it: they turn up at the bar and the coat check. Or slip past at the drop.', 'info');
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
      const swim = clamp((st.intox - 30) / 80, 0, 0.45);
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
   * Resolves { misses } when the clip has played through (or too many misses). Lost: first the
   * table plays her dance back at her, full screen and looping, until she taps.
   */
  danceGame() {
    return new Promise((resolve) => {
      const g = this.g, inp = g.input;
      this.video.manual = true; // the clip plays only while she taps right
      this.video.show(DANCE.folder, { keyed: true }).then(() => this.video.el.play().catch(() => {}));
      this.video.pause();
      const view = danceView(this.video, DANCE.plate);
      const S = { t: 0, played: 0, misses: 0, lit: -1, litT: 0, hitWin: false, pauseT: 0.6, flash: 0, hits: 0 };
      const beat = (60 / this.music.bpm) * DANCE.beats; // (the keys light on the music's beat)
      const kb = (e) => { const n = +e.key; if (n >= 1 && n <= 9) { e.preventDefault(); e.stopPropagation(); press(n - 1); } };
      addEventListener('keydown', kb, true);
      document.body.classList.add('c3-flat');
      g.input.setStick(false);
      g.input.setButtons([]);
      const layout = () => {
        const W = g.w, H = g.h, land = W >= H;
        if (S.punish) return { vid: { x: 0, y: 0, w: W, h: H }, pad: { x: W, y: 0, w: 0, h: H }, cell: 64, gx: W, gy: H, land };
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
        if (!S.over && !S.punish && S.misses > DANCE.clean) {
          // the humiliation: every phone at the table, and the playback on the big screen
          S.punish = true; S.punishT = 0; S.flash = 0; this.video.el.loop = true;
          this.video.el.play().catch(() => {});
          sfx.lose();
          return;
        }
        S.done = true;
        // a frame of the dance (somebody at the table was filming): drawn now and copied straight off the 3D canvas
        const L = layout(), snap = document.createElement('canvas'), rc = this.renderer.domElement, k = rc.width / g.w;
        snap.width = Math.round(L.vid.w); snap.height = Math.round(L.vid.h);
        try { view.draw(this.renderer, L.vid, g.h, this.video); snap.getContext('2d').drawImage(rc, L.vid.x * k, L.vid.y * k, L.vid.w * k, L.vid.h * k, 0, 0, snap.width, snap.height); } catch (e) { /* no frame */ }
        view.dispose();
        removeEventListener('keydown', kb, true);
        document.body.classList.remove('c3-flat');
        this.sub = null;
        this.video.manual = false;
        this.video.show('ClubDJ', { extra: ['assets/nightclub/plates/set_main.mp4'] });
        this.setupControls(); this.envHud();
        g.input.setStick(true);
        resolve({ misses: S.misses, snap });
      };
      this.sub = {
        update: (dt) => {
          if (S.punish) {
            S.punishT += dt;
            if (this.video.el.paused) this.video.el.play().catch(() => {});
            const tapped = inp.taps.length > 0; inp.taps.length = 0;
            if (tapped && S.punishT > 1.5) { S.punish = false; S.over = true; finish(); }
            return;
          }
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
        // the clip is drawn by the 3D renderer (render3d); this canvas sits over it, clear where it shows
        render3d: (r) => view.draw(r, layout().vid, g.h, this.video),
        render: (ctx) => {
          const L = layout(), W = g.w, H = g.h;
          ctx.clearRect(0, 0, W, H);
          const v = L.vid;
          if (S.punish) {
            const f = Math.round(Math.min(W, H) * 0.075);
            ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H - f * 3.2, W, f * 3.2);
            ctx.textAlign = 'center'; ctx.font = `bold ${f}px Bangers, Impact, sans-serif`; ctx.fillStyle = '#ff3fb8';
            ctx.fillText('THE WHOLE TABLE IS FILMING', W / 2, H - f * 1.75);
            ctx.font = `${Math.round(f * 0.42)}px system-ui, sans-serif`; ctx.fillStyle = '#e8dcff';
            ctx.fillText(S.punishT > 1.5 ? 'They play it back on the big screen, again and again… tap to continue' : 'They play it back on the big screen…', W / 2, H - f * 0.7);
            if (Math.sin(S.punishT * 9) > 0.6) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, 0, W, H); } // phone flashes
            return;
          }
          ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
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
