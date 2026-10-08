// The 3D infiltration club (docs/design/nightclub.md): a Special3D zone built from a seeded plan
// (one of five main rooms + six side rooms + the alley), with a fixed-angle follow camera that
// drops into the crowd, a dense silhouette crowd to push through and hide in, the drop, bouncers,
// Talkers, chatter, X-ray and super-hearing, intoxication paths, sedation, the VIP host, the
// back office's blackmail and fights in the back rooms. This file is the conductor: the systems
// live in their own modules and are mixed in at the bottom.
import * as THREE from 'three';
import { Special3D } from '../special3d.js';
import { bakeStatic, comicScene, groundBackdrop } from '../look3d.js';
import { quality } from '../settings.js';
import { clamp, wobble, $ } from '../util.js';
import { banner, toast } from '../ui.js';
import { makePlan, roomAt, floorY } from './plan.js';
import { hallMats, makeClubKit, buildHall, buildShow, stepTiles, buildKit } from './build.js';
import { buildRoom, buildAlley } from './rooms.js';
import { dressHall } from './dressing.js';
import { ClubCrowd, placeCrowd } from './crowd.js';
import { ClubVideo, tickScreens } from './video.js';
import { ClubMusic } from './music.js';
import { castMethods } from './cast.js';
import { eventMethods } from './events.js';
import { powerMethods } from './powers.js';
import { chatterMethods } from './chatter.js';
import { viceMethods } from './vices.js';
import { caseMethods } from './casework.js';
import { sedationMethods } from './sedation.js';
import { vipMethods } from './vip.js';
import { officeMethods } from './office.js';
import { brawlMethods } from './brawls.js';
import { closeupMethods } from './closeup.js';
import { undercoverMethods } from './undercover.js';
import { quickMethods } from './quick.js';
import { feelMethods } from './feel.js';

const SPEED = 4.6;          // her walk (m/s); a packed crowd slows her by up to 40%
const IDLE_FACE = 1.5;      // seconds standing still before she turns to the viewer
const GUARD_GAIN = 0.7;     // how fast a bouncer who sees her raises the alert, vs the base zones'
// follow camera: [pitch, distance] in the open and inside the crowd
const CAM_OPEN = [0.7, 7.4], CAM_CROWD = [0.5, 5.0];

const tmpC = new THREE.Color(), tmpA = new THREE.Color(), tmpB = new THREE.Color();

/** Everything a visit changes (this object is reused for every club visit, so nothing may carry over). */
const VISIT = () => ({
  sub: null, brawlerOn: null, undercover: false, coat: null, coatFollow: null, pw: null, _castPos: null,
  still: 0, facing: false, dancing: false, posing: false, stunT: 0, cover: 0, crowdThick: 0, blend: 0,
  fought: {}, bonus: 0, sedations: 0, sedating: false, envelope: [],
  hearing: false, dvision: 0, dvisionWas: false, xrayFree: 0, recog: 0, fansCard: false,
  vipIn: false, vipDone: false, vipLock: 0, quizPenalty: false,
  officeOpen: false, officeHeard: false, officeEar: 0, knowsOfficeCode: false, bossDone: false, bossWary: 0,
  safeDone: false, recorderWiped: false, cctvDead: false,
  stockOpen: false, stashFound: false, uvRead: false, powderTaken: false, shotDone: false,
  drinks: 0, drunkCard: false, predator: null, predatorDone: false, taps: [], offerOut: false, snapQueue: [],
  videoWant: null, cctvRT: null, extraPeople: [], snapped: new Set(), coverRing: null, tipQ: [], tipOn: false,
});

export class Club3D extends Special3D {
  enter({ zone }) {
    const q = new URLSearchParams(location.search);
    const seed = +(q.get('club3seed') || 0) || Math.floor(Math.random() * 1e9);
    Object.assign(this, VISIT());
    this.plan = makePlan(seed, q.get('club3room'));
    this.exposure = 1.15; this.gradeTint = 0x05020c; this.gradeK = 0.5;
    this.startCase(zone);   // (the world is placed from the case and the event)
    this.pickEvent();
    // the zone is this case now (the HUD title, the commentary's captions, the front page)
    zone.theme = this.caseDef.theme || zone.theme;
    zone.name = `${this.caseDef.title} at ${/^the /i.test(zone.venue || '') ? zone.venue : 'the ' + (zone.venue || 'club')}`;
    super.enter({ zone });
    // after the base zone's reset: the camera's own state
    this.yaw = 0; this.camPD = [...CAM_OPEN]; this.camSnap = true; this.camPitch = null;
    this.seedEnvelope();
    this.music = new ClubMusic(); this.music.start();
    this.startEvents();
    this.startChatter();
    this.askUndercover();
  }

  // ---------------------------------------------------------------- world
  spawnPoint() { const s = this.plan.spawn; return { pos: new THREE.Vector3(s.x, 0, s.z), heading: Math.PI }; }

  buildWorld() {
    const plan = this.plan, S = this.scene, V = plan.V;
    S.background = new THREE.Color(V.bg);
    S.fog = new THREE.Fog(V.bg, 30, 95);
    this.backdrop = { color: new THREE.Color(V.bg).lerp(new THREE.Color(0x202028), 0.3) };
    this.video = new ClubVideo();
    const M = (this.M = hallMats(plan));
    this.wallMat = M.wall; this.wallBaseOpacity = 1;
    this.buildLights();
    this._static = [];
    const X = (this.X = makeClubKit(this));
    this.hallA = buildHall(this, plan, M, X, this.video);
    this.dressStep = dressHall(this, plan, M, X, this.video, this.hallA);
    this.roomA = {};
    for (const r of plan.rooms) this.roomA[r.kind] = buildRoom(this, plan, r, M, X, this.video);
    this.roomA.alley = buildAlley(this, plan, plan.alley, M, X);
    this.wallMats = [];
    this.scene.traverse((o) => { if (o.isMesh && o.material && o.material.userData.worldUV && !this.wallMats.includes(o.material) && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height > 1) this.wallMats.push(o.material); });
    this.showStep = buildShow(this, plan, X);
    bakeStatic(S, this._static); this._static = null;
    buildKit(X);
    this.screens = [...this.hallA.screens, ...(this.roomA.office?.cctv || [])];
    // the exit: a ring just inside the door
    this.exitRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x3ee08a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    this.exitRing.rotation.x = -Math.PI / 2; this.exitRing.position.set(0, 0.04, V.hd - 1.3);
    S.add(this.exitRing);
    this.placeGameplay();
    // everyone in the crowd: the hall's dancers + the DJs, the dark room's, the VIP's entourage, the loungers
    const Q = quality().club3;
    const keepOut = [[plan.spawn.x, plan.spawn.z, 2.6], ...this.inter.map((o) => [o.pos.x, o.pos.z, 1.4]), ...this.castSpots()];
    const people = placeCrowd(plan, Q.crowd, this.colliders, keepOut).map((p) => ({ ...p, pose: 'dance' }));
    const near = (p, cx, cz, r) => Math.hypot(p.x - cx, p.z - cz) < r;
    for (const p of people) if (near(p, this.hallA.spots.bar.x, this.hallA.spots.bar.z, 3)) p.pose = 'stand';
    people.push(...X.people, ...(this.roomA.dark?.dancers || []), ...(this.roomA.lounge?.loungers || []));
    for (const s of this.roomA.vip?.seats || []) people.push({ x: s.x, z: s.z, pose: 'sit', rot: 0, y: 0, fixed: true });
    people.push(...(this.extraPeople || []));
    this.crowd = new ClubCrowd(this, plan, people, { near: Q.near });
    this.video.show('ClubDJ', { extra: ['assets/nightclub/plates/set_main.mp4'] });
  }

  buildLights() {
    const S = this.scene, V = this.plan.V;
    S.add(new THREE.HemisphereLight(0x9a8aff, 0x160a22, 0.6));
    S.add(new THREE.AmbientLight(0xffffff, 0.16));
    this.key.intensity = 0.55;
    this.plights = [0, 1].map((i) => {
      const l = new THREE.PointLight(V.accent[i], 34, Math.max(V.hw, V.hd) * 1.9, 1.15);
      l.position.set((i ? 1 : -1) * Math.min(12, V.hw * 0.45), V.wallH - 0.8, V.floor.z);
      S.add(l);
      return l;
    });
  }

  /** The comic surface on everything, and ground out to the fog round the building (not under it). */
  finishLook() {
    comicScene(this.scene);
    const V = this.plan.V;
    this.scene.add(groundBackdrop(this.backdrop.color, -0.04, { size: 220, hole: [-V.hw + 0.6, V.hw - 0.6, -V.hd + 0.6, V.hd - 0.6] }));
  }

  exit() {
    this.closeOverlays?.();
    this.closeQuick?.(null);
    this.endTips?.();
    for (const rt of this.cctvRT || []) rt.dispose();
    this.cctvRT = null;
    this.endChatter?.();
    this.music?.stop();
    this.video?.dispose(); this.video = null;
    this.crowd?.dispose(); this.crowd = null; this.pw = null; this._castPos = null;
    document.body.classList.remove('c3-flat');
    super.exit();
  }

  // ---------------------------------------------------------------- controls
  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'dance', label: 'DANCE', key: 'G', slot: 1 },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
      { id: 'hear', label: 'HEAR', key: 'V', slot: 3 },
      { id: 'notes', label: 'CASE', key: 'N', slot: 4 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Guard alert</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>Power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>
      <div class="barlabel" id="c3-env-l"><span>His envelope: 0</span></div>`;
    this.envHud?.();
  }

  announce() {
    banner((this.zone.venue || 'THE CLUB').toUpperCase(), `${this.plan.name} · ${this.caseDef?.tagline || 'Work the club'}`, '#ff3fb8');
    setTimeout(() => { if (!this.done) toast('Blend into the crowd: the bouncers can\'t pick you out of it. Hold DANCE to disappear.', 'info'); }, 1800);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.warming) return;
    this.music.update(this.hearing ? 1 : 0, false); // (the beat goes on under a close-up, the dance, a fight)
    if (this.sub) { this.sub.update(dt); return; } // a fight in a back room, the VIP dance, a close-up
    if (this.done && this.keepAnimating && this.heroModel) this.heroModel.update(dt);
    if (this.scene) for (const e of this.cast) e.update(dt);
    if (this.done || !this.scene) return;
    const g = this.g, inp = g.input, st = g.state, h = this.hero, plan = this.plan;
    this.t += dt; this.frameDt = dt;
    g.vice = { active: true, where: this.zone.venue, rate: 1.2 };
    const B = (this.B = this.music.beat(this.t)); // (the lights and the crowd move with the track that's playing)
    this.room = roomAt(plan, h.position.x, h.position.z);
    this.stepEvents(dt);
    // moving: the camera never turns, so up is always toward the DJ wall
    const stunned = this.stunT > 0;
    this.stunT = Math.max(0, (this.stunT || 0) - dt);
    this.dancing = inp.down('dance') && !this.busy && !stunned && this.landT <= 0;
    const a = wobble(inp.axis(), st.intox, this.t);
    const thick = clamp((this.crowd?.thick || 0) / 4, 0, 1);
    const mx = a.x, mz = a.y, mag = Math.min(1, Math.hypot(mx, mz));
    const canMove = !this.busy && this.landT <= 0 && !this.dancing && !stunned;
    if (mag > 0.05 && canMove) {
      const sp = SPEED * (1 - 0.4 * thick);
      h.position.x += mx * sp * dt;
      h.position.z += mz * sp * dt;
      let da = Math.atan2(mx, mz) - h.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      h.rotation.y += da * Math.min(1, dt * 12);
      this.still = 0; this.facing = false;
    } else this.still += dt;
    if (this.surgeT > 0 && this.drop) { h.position.x += Math.sin(this.t * 3.1) * dt * 0.8; h.position.z += Math.cos(this.t * 2.3) * dt * 0.6; }
    this.collide(h.position, 0.36);
    h.position.y += (floorY(plan, h.position.x, h.position.z) - h.position.y) * Math.min(1, dt * 14);
    // standing still a moment, she turns to face the viewer
    if (this.still > IDLE_FACE && !this.dancing && !this.busy) {
      let da = 0 - h.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      h.rotation.y += da * Math.min(1, dt * 4);
      this.facing = true;
    }
    this.punchT = 0;
    const moving = mag > 0.05 && canMove ? mag * (1 - 0.3 * thick) : 0;
    this.animateHero(dt, moving);
    this.moving = (this.moving || 0) + (moving - (this.moving || 0)) * Math.min(1, dt * 3);
    // the crowd: they part for her, the guards and the cast; at the drop they jump and shove
    const obs = [h.position, ...this.guards.filter((gd) => !gd.ko).map((gd) => gd.mesh.position), ...this.castPositions()];
    const cov = this.crowd.update(this.t, dt, B, obs, this.surge || 0, this.music.bpm);
    this.cover = cov.cover; this.crowdThick = cov.thick;
    this.blend = this.computeBlend();
    this.stepPowers(dt);
    this.stepCast(dt);
    this.stepChatter(dt);
    this.stepVices(dt);
    const a0 = this.alert;
    this.updateGuards(dt);
    this.stepInvestigate(dt);
    if (this.alert > a0) this.alert = a0 + (this.alert - a0) * GUARD_GAIN; // (they're scanning a packed floor)
    this.stepCoverRing(dt);
    this.stepTips();
    this.stepAlert(dt);
    if (this.checkFailures()) return;
    this.stepQuick();
    // interactables
    let best = null, bd = 1.9;
    for (const o of this.inter) {
      if (!o.can()) continue;
      const d = Math.hypot(o.pos.x - h.position.x, o.pos.z - h.position.z);
      if (d < (o.r || bd) && d < bd + (o.r ? o.r : 0)) { bd = d; best = o; }
    }
    this.near = best;
    if (best && inp.pressed('interact') && !this.busy && !this.quickOn) this.run(() => best.act());
    if (inp.pressed('notes') && !this.busy) this.run(() => this.caseBoard());
    // the exit
    this.exitRing.material.opacity = this.caseSolved ? 0.5 + Math.sin(this.t * 5) * 0.3 : 0.18;
    const ex = this.exitRing.position;
    if (Math.hypot(h.position.x - ex.x, h.position.z - ex.z) < 1.3 && !this.busy && this.t > 4) this.run(() => this.leaveClub());
    for (const f of this.anims) f(this.t, dt);
    // the show
    const drop = this.strobe > 0;
    this.showStep(this.t, dt, B, drop);
    const avg = stepTiles(this.hallA.tiles, this.t, B, drop, tmpC);
    const hue = (B.bar * 0.13) % 1;
    tmpA.setHSL(hue, 1, 0.55); tmpB.setHSL((hue + 0.45) % 1, 1, 0.55);
    const flash = drop ? (Math.floor(this.t * 12) % 2 ? 1 : 0) : 0;
    this.flashK = flash;
    this.crowd.light(tmpA, tmpB, 0.85 + 0.5 * B.pulse, flash, this.scene.fog);
    this.plights.forEach((l, i) => { l.color.copy(i ? tmpB : tmpA); l.intensity = (drop ? (flash ? 120 : 4) : 18 + 26 * B.pulse); });
    this.dressStep(this.t, dt, B, drop, flash, tmpA, tmpB);
    tickScreens(this.screens, this.video, this.t, flash * 0.4);
    this.X.glow.flush(); this.X.signs.flush();
    if (this.X.pmat && this.renderer) this.X.pmat.uniforms.uScale.value = this.renderer.domElement.height / (2 * Math.tan((this.cam.fov * Math.PI) / 360));
  }

  /** Run an async interaction with the world held still until it's done. */
  run(fn) {
    this.busy = true;
    Promise.resolve().then(fn).catch((e) => console.error(e)).finally(() => { this.busy = false; });
  }

  onPaused() { this.music?.update(this.hearing ? 1 : 0, true); }

  /** How hidden she is: 0 in the open, 1 lost in the crowd (DANCE = fully). */
  computeBlend() {
    if (this.dancing) return this.cover >= 1 || this.room?.kind === 'dark' ? 1 : 0.6;
    const loud = (this.moving || 0) > 0.85 || this.xray || this.hearing;
    let b = clamp((this.cover - 1) / 4, 0, 1) * (loud ? 0.35 : 1);
    if (this.undercover) b = Math.min(1, b * 1.4 + 0.15);
    if (this.g.state.intox >= 45) b = Math.min(1, b + 0.15); // she fits right in
    return b;
  }

  /** Guards' sight goes through this: hidden in the crowd, or blinded by the strobe, they don't see her. */
  clearLOS(a, b) {
    if (this.strobe > 0 || this.blend >= 0.75 || this.event?.id === 'raid' && this.event.phase === 1) return false;
    // the VIP's rope bouncer is a gatekeeper, not an alarm: only someone in the VIP without leave alerts him
    if (this.ropeGuard && a === this.ropeGuard.mesh.position && !(this.room === this.plan.byKind.vip && !this.vipIn)) return false;
    return super.clearLOS(a, b);
  }

  stepAlert(dt) {
    const seen = this.guards.some((gd) => gd.seeing);
    if (!seen) this.alert = Math.max(0, this.alert - dt * (5 + 14 * this.blend));
  }

  // ---------------------------------------------------------------- animation
  animateHero(dt, mag) {
    const M = this.heroModel;
    if (!M) return super.animateHero(dt, mag);
    if (this.landT > 0) this.landT -= dt;
    else if (this.stunT > 0) M.play('pain', { fade: 0.15 });
    else if (this.dancing) M.play('dance', { fade: 0.25 });
    else if (mag > 0) {
      if (this.g.state.intox >= 50) M.play('drunkWalk', { speed: 0.8 + mag * 0.5 });
      else if (mag < 0.6) M.play('walk', { speed: 0.8 + mag * 0.9 });
      else M.play('jog', { speed: 0.7 + mag * 0.5 });
    } else M.play(this.posing ? 'pose' : this.g.state.intox >= 50 ? 'happyIdle' : this.guards.some((gd) => gd.seeing) ? 'combatIdle' : 'idle', { fade: 0.3 });
    M.setWind(Math.sin(this.t * 1.3) * 0.7, 0.4, -(0.8 + mag * 5));
    M.update(dt);
  }

  // ---------------------------------------------------------------- camera
  render() {
    if (!this.scene || this.warming) return;
    if (this.sub && this.sub.render) {
      this.sub.render(this.g.ctx);
      if (this.sub.render3d) { this.sub.render3d(this.renderer); return; } // (the VIP dance's keyed clip)
      if (!this.sub.see3d) return;
    }
    const h = this.hero.position, st = this.g.state, dt = this.frameDt || 1 / 60;
    // pitch + distance ease toward the crowd framing when she's in it
    const inCrowd = clamp((this.cover - 1) / 4, 0, 1) * (this.room ? 0.5 : 1);
    const want = [CAM_OPEN[0] + (CAM_CROWD[0] - CAM_OPEN[0]) * inCrowd, CAM_OPEN[1] + (CAM_CROWD[1] - CAM_OPEN[1]) * inCrowd];
    const k = 1 - Math.pow(0.02, dt);
    this.camPD[0] += (want[0] - this.camPD[0]) * k * 0.6; this.camPD[1] += (want[1] - this.camPD[1]) * k * 0.6;
    // walls between her and the camera: tip up toward top-down (rooms have no ceilings)
    let pitch = this.camPD[0], dist = this.camPD[1];
    for (const p of [pitch, 0.95, 1.15, 1.32]) {
      const off = this.cameraOffset(p, dist);
      if (this.cameraReach(h, off) >= dist * 0.8 || p === 1.32) { pitch = p; break; }
    }
    this.camPitch = this.camPitch == null ? pitch : this.camPitch + (pitch - this.camPitch) * (pitch > this.camPitch ? 0.25 : 0.06);
    const off = this.cameraOffset(this.camPitch, dist);
    const reach = this.cameraReach(h, off);
    const wantPos = h.clone().add(off.multiplyScalar(Math.min(1, reach / dist)));
    if (this.camSnap === undefined || this.camSnap) { this.cam.position.copy(wantPos); this.camSnap = false; }
    else this.cam.position.lerp(wantPos, Math.max(0.1, 1 - Math.pow(0.0008, dt)));
    const la = this._look || (this._look = h.clone());
    const tz = h.z - 1.4 - (this.moving || 0) * 0.6, tx = h.x;
    la.x += (tx - la.x) * Math.min(1, dt * 5); la.z += (tz - la.z) * Math.min(1, dt * 5); la.y = h.y;
    this.cam.lookAt(la.x, la.y + 0.7, la.z);
    if (st.intox > 30) {
      const ik = (st.intox - 30) / 70;
      this.cam.rotation.z += Math.sin(this.t * 1.3) * 0.07 * ik;
      this.cam.fov = 58 + Math.sin(this.t * 0.9) * 5 * ik;
      this.cam.updateProjectionMatrix();
    } else if (this.cam.fov !== 58) { this.cam.fov = 58; this.cam.updateProjectionMatrix(); }
    if (this.shadows) this.shadows.update();
    this.renderer.render(this.scene, this.cam);
    this.afterRender?.();
  }

  resize() {
    if (!this.renderer) return;
    const Q = quality().club3;
    if (this.g.modeName === 'club3') this.renderer.setPixelRatio(Math.min(devicePixelRatio, Q?.dpr ?? quality().dpr3d));
    this.renderer.setSize(this.g.w, this.g.h, false);
    if (this.cam) { this.cam.aspect = this.g.w / this.g.h; this.cam.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- HUD
  hud() {
    const al = $('b-alert'), en = $('b-en');
    if (al) { al.style.width = this.alert + '%'; al.parentElement.classList.toggle('warn', this.alert > 60); }
    if (en) en.style.width = this.en + '%';
    if (this.sub) { this.sub.hud?.(); return; }
    if (!this.scene) return;
    this.hudObjectives();
    this.hudCast();
    const pr = $('prompt');
    if (this.near && !this.busy && !this.done && !this.quickOn) {
      const key = document.body.classList.contains('touch') ? 'USE' : 'E';
      const html = `<b>${key}</b> ${this.near.label}`;
      if (pr._html !== html) { pr.innerHTML = html; pr._html = html; }
      pr.classList.add('on');
    } else pr.classList.remove('on');
    this.g.input.setButton('interact', { lit: !!this.near });
    this.g.input.setButton('dance', { toggled: this.dancing });
    const sub = [this.dropHint(), this.blend >= 0.75 ? 'Hidden in the crowd' : this.blend > 0.3 ? 'In the crowd' : '', this.hearing && 'SUPER-HEARING', this.xray && 'X-RAY', this.dvision > 0 && 'DRUG-VISION'].filter(Boolean).join(' · ');
    $('hud-sub').textContent = sub || (this.room ? this.room.name : this.plan.name);
  }
}

Object.assign(Club3D.prototype, castMethods, eventMethods, powerMethods, chatterMethods, viceMethods, caseMethods, sedationMethods, vipMethods, officeMethods, brawlMethods, closeupMethods, undercoverMethods, quickMethods, feelMethods);
