// The screens turn on her (round 11): when a bouncer makes her, security puts her up on the club's
// screens. The DJ wall and the TVs cut (a glitchy row-by-row switch) from the show to a security
// camera on her: green, scan-lined, REC blinking, a red frame and hazard stripes either side, her
// name in the box. The whole floor can see where she is. Shake them off and the screens cut back
// to the show. The feed is a small camera above and in front of her, drawn into one 256×144 target
// five times a second (a security camera's stutter); Battery saver gets snow instead of the feed.
// Mixed into Club3D.prototype; the screens' shader is video.js's screenMat (its `cam` uniforms).
import * as THREE from 'three';
import { quality } from '../settings.js';
import { clamp } from '../util.js';
import { HERO } from '../data.js';

export const CCTV = { size: [256, 144], every: 0.2, fov: 40, at: [0.25, 4.4, -5.6] };

let overlay = null;
/** The burnt-in text over the feed (REC, the camera, the clock, the subject box): drawn once. */
function overlayTex(subject) {
  if (overlay && overlay.subject === subject) return overlay.tex;
  overlay?.tex.dispose();
  const W = 512, H = 288, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(235,255,240,.9)'; g.lineWidth = 4;
  // the reticle round the middle (she's always in it) and the frame's corner marks
  const box = (x0, y0, x1, y1, l) => { g.beginPath(); for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.moveTo(x + dx * l, y); g.lineTo(x, y); g.lineTo(x, y + dy * l); } g.stroke(); };
  box(18, 18, W - 18, H - 18, 34);
  g.strokeStyle = 'rgba(255,60,70,.95)'; g.lineWidth = 5;
  box(W * 0.36, H * 0.16, W * 0.64, H * 0.86, 26);
  g.fillStyle = 'rgba(235,255,240,.92)'; g.font = 'bold 26px monospace'; g.textBaseline = 'top';
  g.fillText('REC', 62, 30);
  g.textAlign = 'right'; g.fillText('CAM 03', W - 30, 30);
  g.textAlign = 'left'; g.font = 'bold 20px monospace';
  g.fillText('MAIN FLOOR  02:14:37', 30, H - 44);
  // the subject box under the reticle
  g.font = '400 30px Bangers, Impact, sans-serif'; g.textAlign = 'center';
  const tw = g.measureText(subject).width + 28;
  g.fillStyle = 'rgba(210,10,30,.92)'; g.fillRect(W / 2 - tw / 2, H * 0.86 + 6, tw, 38);
  g.fillStyle = '#fff'; g.fillText(subject, W / 2, H * 0.86 + 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  overlay = { subject, tex };
  return tex;
}

export const cctvMethods = {
  /** The hall's screens (wall, TVs, the floor's reflection): which ones go to the feed, and their shapes. */
  camScreens() {
    if (this._camMats) return this._camMats;
    const mats = (this.hallA?.screens || []).filter((m) => m.userData.screen?.cam);
    // each plane's aspect, so the feed is pillarboxed on the wide wall instead of stretched
    this.scene.traverse((o) => {
      if (!o.isMesh || !mats.includes(o.material)) return;
      const p = o.geometry.parameters;
      if (p?.width && p?.height && o.material.userData.screen.planeA) o.material.userData.screen.planeA.value = p.width / p.height;
    });
    return (this._camMats = mats);
  },

  /** Per frame: ease the screens toward the feed (cctvWant, from tension.js) and back. */
  stepCctv(dt) {
    const want = !!this.cctvWant && !this.room && !this.sub && !this.done;
    const k = (this.cctvK = clamp((this.cctvK || 0) + (want ? dt * 2.5 : -dt * 1.6), 0, 1));
    this.stageLightsCut(k > 0.35);
    if (!k && !this._camOn) return;
    this._camOn = k > 0;
    const mats = this.camScreens(), ov = overlayTex(this.camLabel || (this.undercover ? 'SUBJECT: UNKNOWN' : `SUBJECT: ${HERO.toUpperCase()}`)); // (r11 V2 hook: a beat's own caption)
    for (const m of mats) {
      const U = m.userData.screen;
      U.cam.value = k;
      if (U.ovMap) U.ovMap.value = ov;
      if (U.camLive) U.camLive.value = this.camRT && this.camFed ? 1 : 0;
    }
  },

  /** Before the frame: the security camera's next picture of her (only while the screens show it). */
  renderCctv() {
    if (!(this.cctvK > 0) || !this.renderer || (quality().club3?.near ?? 0) < 96) return;
    this.cctvT = (this.cctvT ?? 0) - (this.frameDt || 1 / 60);
    if (this.cctvT > 0 && this.camFed) return;
    this.cctvT = CCTV.every;
    if (!this.camRT) {
      this.camRT = new THREE.WebGLRenderTarget(CCTV.size[0], CCTV.size[1]);
      this.camCam = new THREE.PerspectiveCamera(CCTV.fov, CCTV.size[0] / CCTV.size[1], 0.2, 70);
      this.camPos = null;
    }
    const h = this.camSubject || this.hero.position, C = this.camCam, [ox, oy, oz] = CCTV.at; // (r11 V2 hook: a beat can aim it at someone else)
    // a dome camera on the rig in front of her: it pans after her, a beat behind
    const want = new THREE.Vector3(h.x + ox * Math.sign(h.x || 1) * 4, h.y + oy, h.z + oz);
    if (!this.camPos) this.camPos = want.clone(); else this.camPos.lerp(want, 0.35);
    C.position.copy(this.camPos); C.lookAt(h.x, h.y + 1.05, h.z);
    const mats = this.camScreens(), r = this.renderer;
    // (a screen can't sample the target it's being drawn into: they show the clip for this pass)
    for (const m of mats) if (m.userData.screen.camMap) m.userData.screen.camMap.value = this.video.tex;
    // (r11 L2b: the stage's glow, beams, haze and lasers wash a security camera's picture out: off for its pass)
    const glow = this.camGlow || (this.camGlow = this.glowObjects());
    for (const o of glow) { o.userData.camVis = o.visible; o.visible = false; }
    r.setRenderTarget(this.camRT);
    r.render(this.scene, C);
    r.setRenderTarget(null);
    for (const o of glow) o.visible = o.userData.camVis;
    for (const m of mats) if (m.userData.screen.camMap) m.userData.screen.camMap.value = this.camRT.texture;
    this.camFed = true;
  },

  /**
   * r11 L2b: security has the screens, so the show's air lights (beams, haze, lasers) cut out: in front
   * of the DJ wall they washed the feed of her out to a white block. The floor's own glow stays, and so
   * do the bouncers' torches (gameplay).
   */
  stageLightsCut(on) {
    if (!!on === !!this._lightsCut) return;
    this._lightsCut = !!on;
    if (!this._air) {
      const v = new THREE.Vector3();
      this._air = this.glowObjects().filter((o) => {
        for (let p = o; p; p = p.parent) if (p.userData.noX) return false;
        o.geometry?.computeBoundingSphere?.();
        v.copy(o.geometry?.boundingSphere?.center || v.set(0, 0, 0)).applyMatrix4(o.matrixWorld);
        return v.y > 1.5;
      });
    }
    for (const o of this._air) {
      if (on) { o.userData.cutVis = o.visible; o.visible = false; } else if (o.userData.cutVis !== undefined) { o.visible = o.userData.cutVis; o.userData.cutVis = undefined; }
    }
  },

  /** Everything additive in the hall (beams, haze, pools, lasers, glows): left out of the camera's picture. */
  glowObjects() {
    const out = [], screens = this.camScreens();
    this.scene.traverse((o) => {
      const m = o.material;
      if (!m || Array.isArray(m) || screens.includes(m) || o === this.hero) return;
      if (m.blending === THREE.AdditiveBlending || (m.transparent && m.depthWrite === false && (o.isSprite || o.isPoints))) out.push(o);
    });
    return out;
  },

  endCctv() {
    this.stageLightsCut(false);
    this.camGlow = null; this._air = null;
    this.camRT?.dispose(); this.camRT = null; this.camCam = null; this.camFed = false;
    this._camMats = null; this.cctvK = 0; this._camOn = false;
  },
};
