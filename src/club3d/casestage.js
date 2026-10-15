// r11 V2 (track V): the twist's own beats and their staging in 3D. Each twist now plays its own
// story: a real photo has the snapper (and Dee Dee's livestream), a planted drink has the CCTV booth
// (the man in the gold jacket runs to wipe the tape), a lookalike has her double dancing on the bar
// with the club's screens on her, a setup has the break-out (the woman with the clipboard running
// the ring). The runner (casebeats spawnSnapper) carries a role: only the snapper takes a phone.
// Staging: phone flashes as light sprites at the knot's phones, a glass in her hand, a closer camera
// while a knot is round her (club3d render reads beatCamK), the runner's DASH!, and a grab of the
// real frame at the gotcha moment for the morning paper (no more drawn placeholder).
// Mixed into Club3D.prototype through casebeats.js beatMethods.
import * as THREE from 'three';
import { toast, banner, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { npcLook } from '../art.js';
import { INTOX_HAZE } from '../state.js';
import { HERO } from '../data.js';
import { TWISTS, PAPER_WIN } from './casedata.js';

export const STAGE = { cam: 0.24, flashMs: 90, glass: [0.32, 1.12, 0.22], runSpeed: 3.4, photo: [400, 250] };
// who runs, how they look, the case board's line, the prompt on them
const RUNNERS = {
  snapper: { label: 'Get the phone back' },
  wiper: { label: 'Stop the tape wipe', look: { top: '#e0b020', bottom: '#1a1a1a', hairStyle: 'slick' }, room: 'office', obj: 'Stop him wiping the CCTV tape' },
  double: { label: 'Catch the double', look: { top: '#2a5cff', bottom: '#d8122e', skirt: '#d8122e', hair: '#f2d27a', hairStyle: 'long' }, room: 'restroom', obj: 'Catch the other "Supergirl"' },
  leader: { label: 'Corner the ringleader', look: { top: '#2a3a6a', bottom: '#14141a', hairStyle: 'bun' }, spot: 'bar', obj: 'Corner the woman with the clipboard' },
};

let flashTex = null;
function glowTex() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,250,230,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (flashTex = new THREE.CanvasTexture(c));
}

export const stageMethods = {
  // ------------------------------------------------------------------ staging
  /** Per frame (stepBeats): the closer beat camera, the glass in her hand, the flash sprite. */
  stepStage(dt) {
    const K = this.knotHost().knot, on = !!K && !K.idle && !this.room;
    this.beatCamK = Math.max(0, Math.min(1, (this.beatCamK || 0) + (on ? dt * 2.2 : -dt * 1.4)));
    const G = this.stageGlassM;
    if (G && G.visible) {
      const h = this.hero.position, r = this.hero.rotation.y, [sx, sy, sz] = STAGE.glass;
      G.position.set(h.x + Math.cos(r) * -sx + Math.sin(r) * sz, h.y + sy, h.z + Math.sin(r) * sx + Math.cos(r) * sz);
      if (this.t > this.stageGlassT) G.visible = false;
    }
    if (this.flashSpr?.visible && performance.now() > this.flashUntil) this.flashSpr.visible = false;
  },

  /** A phone flash as light in the room (stepKnot calls it with the phone's spot). */
  stageFlash(x, y, z) {
    if (!this.flashSpr) {
      this.flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      this.flashSpr.scale.set(1.3, 1.3, 1); this.flashSpr.name = 'c3-flash';
      this.scene.add(this.flashSpr);
    }
    this.flashSpr.position.set(x, y, z); this.flashSpr.visible = true;
    this.flashUntil = performance.now() + STAGE.flashMs;
  },

  /** A glass in her hand for `secs` game-s (the planted drink, a shot). */
  stageGlass(secs = 4, color = 0xffb84d) {
    if (!this.stageGlassM) {
      const g = new THREE.CylinderGeometry(0.06, 0.045, 0.16, 10);
      this.stageGlassM = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
      this.stageGlassM.name = 'c3-glass'; this.scene.add(this.stageGlassM);
    }
    this.stageGlassM.material.color.setHex(color);
    this.stageGlassM.visible = true; this.stageGlassT = this.t + secs;
  },

  /** The real frame, round her, for the morning paper: one extra render, copied straight off the canvas. */
  grabPhoto() {
    const r = this.renderer, B = this.gb;
    if (!r || !B) return null;
    try {
      this.crowd?.seeThrough(this.cam, this.hero.position, r, true);
      r.render(this.scene, this.cam);
      this.crowd?.seeThrough(null);
      const src = r.domElement, k = src.width / Math.max(1, this.g.w), [W, H] = STAGE.photo;
      const s = this.screenOf(this.hero.position, 1.1) || { x: this.g.w / 2, y: this.g.h / 2 };
      const ch = Math.min(src.height, Math.round(src.height * 0.62)), cw = Math.min(src.width, Math.round(ch * (W / H)));
      const cx = Math.max(0, Math.min(src.width - cw, s.x * k - cw / 2)), cy = Math.max(0, Math.min(src.height - ch, s.y * k - ch / 2));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, W, H); // (the flash: the paper's photo is the bright one)
      return c;
    } catch (e) { return null; }
  },

  /** The photo the twist is about: taken now, with the real frame. */
  takePhoto(p) {
    const B = this.gb;
    B.photo = { ...p, img: this.grabPhoto() || B.photo?.img || null };
    return B.photo;
  },

  /** Points the club's screens (cctv.js) at someone else for a while, with a caption of its own. */
  screensOn(pos, label, secs = 5) {
    this.camSubject = pos; this.camLabel = label; this.camBeat = true; // (camBeat: the camera stays on her, not the hunt framing)
    this.cctvHold = Math.max(this.cctvHold || 0, secs);
    this.wait(secs + 0.8).then(() => { if (this.camSubject === pos) { this.camSubject = null; this.camLabel = null; this.camBeat = false; } });
  },

  // ------------------------------------------------------------------ the runner
  runnerLook(role) { return { ...npcLook('civilian'), skirt: null, ...(RUNNERS[role]?.look || { top: '#e0b020', bottom: '#1a1a1a', hairStyle: 'slick' }) }; },
  runnerLabel(role) { return RUNNERS[role]?.label || RUNNERS.snapper.label; },

  /** Where a runner heads (the snapper: casebeats snapperRun's side rooms). */
  runnerPath(role) {
    const R = RUNNERS[role];
    if (R?.spot) { const p = this.hallA.spots[R.spot]; return p && [{ x: p.x, z: p.z }]; }
    const q = R?.room && this.plan.byKind[R.room];
    if (!q) return null;
    const out = q.side === 'W' ? 1 : -1;
    return role === 'wiper' ? [{ x: q.door.x + out * 1.4, z: q.door.z }] : [{ x: q.door.x + out * 1.6, z: q.door.z }, { x: q.cx, z: q.cz + 1.5 }];
  },

  runRunner() {
    const S = this.gb?.snapper;
    if (!S) return;
    const path = this.runnerPath(S.role);
    if (!path) return this.snapperRun();
    S.path = path; S.walk = 1; S.moves++; S.room = RUNNERS[S.role]?.room ? this.plan.byKind[RUNNERS[S.role].room] : null;
    const s = this.screenOf(S.m.position, 2); if (s) comic.pow('DASH!', s.x, s.y, { size: 0.8, colors: ['#ffd84d', '#ffffff'] });
  },

  /** The board's line for a runner still loose. */
  runnerObjective() {
    const B = this.gb, S = B?.snapper;
    if (!S || S.role === 'snapper' || B.proof) return null;
    return { t: RUNNERS[S.role]?.obj || 'Catch him', target: S.m.position };
  },

  /** The runner caught: not a phone, the proof of the twist. */
  async confrontRunner() {
    const B = this.gb, G = this.caseDef.gen, S = B.snapper, T = TWISTS[G.twist];
    const Q = {
      wiper: { speaker: 'The man in the gold jacket', text: 'He\'s at the CCTV desk, thumb on DELETE. "This doesn\'t concern you, hero."',
        options: [{ label: 'Freeze the tape (super-speed)', value: 'speed' }, { label: '"Step away from the desk."', value: 'ask' }, { label: 'Yank the plug', note: 'a scene', value: 'grab', cls: 'risky' }] },
      double: { speaker: 'The other "Supergirl"', text: 'Wrong blue, the S stitched on crooked, her wig slipping. "Please. Vince pays me two hundred a night."',
        options: [{ label: '"Just give me the suit."', value: 'ask' }, { label: 'X-ray the bag', note: 'the knockoff suit', value: 'xray' }, { label: 'Pull the wig off', note: 'on camera', value: 'grab', cls: 'risky' }] },
      leader: { speaker: 'The woman with the clipboard', text: 'A whistle on a string, a clipboard of names. "They\'re just fans. Very enthusiastic fans."',
        options: [{ label: 'X-ray the clipboard', value: 'xray' }, { label: '"Who paid them?"', value: 'ask' }, { label: 'Snatch the clipboard', note: 'on camera', value: 'grab', cls: 'risky' }] },
    }[S.role];
    const v = await this.quickT(Q, 7);
    if (v === 'away' || v === 'slow') { toast('Too slow: they slip off again.', 'bad'); this.runRunner(); return; }
    if (v === 'grab') this.g.state.addRep(-2, 'A scene in the club');
    if (v === 'xray' || v === 'speed') { this.alert = Math.min(95, (this.alert || 0) + 8); flash('#9fd8ff'); }
    const s = this.screenOf(S.m.position, 2); if (s) comic.pow(S.role === 'double' ? 'UNMASKED!' : 'BUSTED!', s.x, s.y, { size: 1 });
    S.caught = true;
    if (T.proof) await this.gotClue(T.proof, { title: 'Proof' });
    S.walk = 1; S.path = [{ x: this.plan.entrance.x, z: this.plan.entrance.z - 1 }]; // (they leave)
  },

  // ------------------------------------------------------------------ the new beats
  /** Real (Dee Dee): she's being livestreamed, the club's screens carry the stream. */
  async beatStream() {
    const G = this.caseDef.gen, h = this.hero.position;
    this.formKnot(G.profile.knot, 2.0);
    const cam = this.spawnSnapper(h.x - 1.1, h.z - 0.9, 'snapper');
    cam.rotation.y = Math.atan2(h.x - cam.position.x, h.z - cam.position.z);
    if (cam.arms) cam.arms[1].rotation.x = -2.4;
    banner('LIVE!', `${G.name} is streaming you to the whole city`, '#ff3fb8');
    this.screensOn(h, `VOXPOP LIVE · ${HERO.toUpperCase()}`, 6);
    const s = this.screenOf(h, 2.2); if (s) comic.pow('ON AIR!', s.x, s.y - 30, { size: 1.1, colors: ['#ff3fb8', '#ffffff'] });
    sfx.shutter?.();
    const tipsy = this.g.state.intox >= INTOX_HAZE;
    const v = await this.quickT({ speaker: G.crew || 'A camera guy', text: '"Say hi to forty thousand viewers, Supergirl! Do something CRAZY!"',
      options: [{ label: 'Wave for the stream', value: 'wave' }, { label: 'Hand over the lens', value: 'cover' }, { label: 'Walk out of shot', value: 'walk' }] }, 6);
    flash('#ffffff');
    this.takePhoto({ real: tipsy, how: v, stream: true });
    toast(v === 'wave' ? (tipsy ? 'She waves, wobbles, and forty thousand people hit record.' : 'A big friendly wave. The chat wanted "crazy". It got wholesome.') : v === 'cover' ? '"WHAT IS SHE HIDING?" scrolls up the chat.' : 'She walks off. The camera follows her all the way.', tipsy ? 'bad' : 'info');
    this.addCard('fans', tipsy ? 'Tipsy, live on VoxPop' : 'Live on VoxPop, phones up');
    await this.wait(1);
    this.releaseKnot();
    this.runRunner();
  },

  /** Planted: someone's in the CCTV booth, wiping the tape that proves the glass was pushed on her. */
  async beatBooth() {
    const B = this.gb, h = this.hero.position;
    const m = this.spawnSnapper(h.x + 1.3, h.z - 1.1, 'wiper');
    banner('TAPE WIPE!', 'The gold jacket is heading for the CCTV desk', '#ffd84d');
    this.screensOn(m.position, 'REWINDING… ERASE?', 4);
    const s = this.screenOf(m.position, 2.1); if (s) comic.pow('ERASE?!', s.x, s.y - 20, { size: 1 });
    sfx.alarm?.();
    const v = await this.quickT({ speaker: 'The screens', text: 'Every screen in the club flickers back to the moment the glass hit her hand… then starts to rewind.',
      options: [{ label: 'Go after him', value: 'chase' }, { label: 'X-ray the wall: where is he?', value: 'xray' }, { label: 'Let him run (find a copy later)', value: 'let' }] }, 6);
    this.runRunner();
    if (v === 'xray') { this.alert = Math.min(95, (this.alert || 0) + 6); toast('X-ray: he\'s at the staff door with a keycard. Go!', 'good'); }
    else if (v === 'let') { B.snapper.slow = true; toast('He\'s gone. The office will have a copy, somewhere.', 'info'); }
    else toast('After him: the staff corridor.', 'info');
  },

  /** Lookalike: her double, on the bar, on every screen in the club. */
  async beatDouble() {
    const G = this.caseDef.gen, bar = this.hallA.spots.bar, h = this.hero.position;
    this.formKnot(Math.max(4, G.profile.knot - 1), 2.3);
    const d = this.spawnSnapper(bar.x, bar.z, 'double');
    d.rotation.y = Math.atan2(h.x - bar.x, h.z - bar.z);
    if (d.arms) { d.arms[0].rotation.x = -2.6; d.arms[1].rotation.x = -2.6; }
    banner('SEEING DOUBLE!', '"Supergirl" is dancing on the bar… and so are you?', '#3fa0ff');
    this.screensOn(d.position, 'SUPERGIRL?! LIVE AT THE BAR', 6);
    const s = this.screenOf(d.position, 2.3); if (s) comic.pow('WHO?!', s.x, s.y - 20, { size: 1.1, colors: ['#3fa0ff', '#ffffff'] });
    for (let i = 0; i < 3; i++) { sfx.shutter?.(); await this.wait(0.3); }
    const v = await this.quickT({ speaker: 'The crowd', text: '"Two of them?!" Half the phones turn to the bar, half to her.',
      options: [{ label: 'Chase her', value: 'chase' }, { label: 'Stand beside her: two of us', note: 'everyone sees', value: 'pose' }, { label: 'X-ray her suit', value: 'xray' }] }, 6);
    this.takePhoto({ real: false, lookalike: true, how: v });
    if (v === 'pose') { this.g.state.addRep(2, 'Faced her double'); toast('Side by side, the S on hers is crooked. The phones catch that too.', 'good'); }
    else if (v === 'xray') toast('X-ray: under the suit, a club staff lanyard. VINCE KROLL TALENT.', 'good');
    else toast('She jumps down and bolts for the restrooms.', 'info');
    this.releaseKnot();
    this.runRunner();
  },

  /** Setup: the ring closes again, and this time she sees who's running it. */
  async beatBreakout() {
    const G = this.caseDef.gen, h = this.hero.position;
    this.formKnot(G.profile.knot + 2, 1.05);
    const L = this.spawnSnapper(h.x + 2.6, h.z - 2.2, 'leader');
    L.rotation.y = Math.atan2(h.x - L.position.x, h.z - L.position.z);
    banner('BREAK OUT!', 'Somebody is blowing a whistle, and the ring tightens', '#ffd84d');
    const s = this.screenOf(L.position, 2.1); if (s) comic.pow('TWEET!', s.x, s.y - 20, { size: 0.9 });
    this.alert = Math.min(95, (this.alert || 0) + 8);
    const v = await this.quickT({ speaker: G.crew || 'A woman with a clipboard', text: '"Positions, people! Phones UP! Nobody lets her through!"',
      options: [{ label: 'Super-hearing: who gives the orders?', value: 'hear' }, { label: 'Get the ring dancing', note: 'turn their trap into a party', value: 'dance' }, { label: 'Leap out over them', note: 'everyone sees', value: 'jump', cls: 'risky' }] }, 6);
    const p = this.screenOf(h, 2.2);
    if (v === 'dance') { this.g.state.addRep(2, 'Turned the trap into a party'); if (p) comic.pow('DANCE!', p.x, p.y, { size: 1 }); this.heroClip?.('dance', 2); }
    else if (v === 'jump') { this.heroClip?.('jump', 1.4); if (p) comic.pow('WHOOSH!', p.x, p.y, { size: 1 }); }
    else toast('Under the music: a whistle, and a voice reading names off a list. Her.', 'good');
    this.takePhoto({ real: false, setup: true, how: v });
    this.releaseKnot();
    this.runRunner();
  },
};

/** The morning paper for a generated case (the visit's own headline and lede, her real photo). */
export function genPaper(G, B, clubName, win, card) {
  const club = (t) => t.replace(/\{CLUB\}/g, clubName), img = B.photo?.img;
  if (win) {
    const list = PAPER_WIN[G.twist] || PAPER_WIN.doctored, W = list[(G.seed || 0) % list.length];
    return { headline: club(W[0]), sub: `${G.name} exposed`, rep: 8, photo: img || 'tabloid', stamp: G.twist === 'real' ? 'DELETED!' : 'FAKE!', body: [club(W[1]), `${G.name} declined to comment.`] };
  }
  return { headline: G.headline, sub: club(G.sub), rep: -6, photo: img || card?.img || 'tabloid', stamp: 'SHOCKING!', body: [club(G.lede || 'The case is cracked, but the picture ran anyway.'), 'Next time: get the phone, or get the proof.'] };
}
