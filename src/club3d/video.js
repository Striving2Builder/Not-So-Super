// Video in the club's 3D set. One shared <video> (iOS: muted, inline, one decoder) feeds a
// VideoTexture that every screen samples: the DJ's LED wall, the TVs ("DJ cam"), the office CCTV.
// What it plays follows where she is: a DJ loop in the hall (ClubDJ and SG_DJ_Game), her recorded dance on the CCTV.
// Green-screen clips (assets/video/ClubDance/) are keyed in the shader, so a clip shot on green
// stands in the room's light instead of on a green card.
import * as THREE from 'three';
import { mediaFolders, keepLooping } from '../media.js';
import { cycle, pick } from '../util.js';

export class ClubVideo {
  constructor() {
    const v = (this.el = document.createElement('video'));
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    document.body.appendChild(v);
    this.tex = new THREE.VideoTexture(v);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter; this.tex.generateMipmaps = false;
    this.src = null; this.keyed = false;
    this.manual = false; this.kickT = -1e9; // manual: a scene drives play/pause itself (the VIP dance)
    this.folders = mediaFolders();
  }

  /**
   * Play a clip from the first of `folders` that has any (or `extra` urls); keyed = it's on green
   * (or { folder: true } for the folders that are). `mix` plays every folder together (the main
   * room: ClubDJ plus SG_DJ_Game). `deal` rotates through the pool, one clip each time she's sent
   * back to it, instead of keeping the same loop.
   */
  async show(folders, { keyed = false, extra = [], pin = null, deal = false, mix = false } = {}) {
    const all = await this.folders;
    const names = [].concat(folders);
    const from = names.find((f) => (all[f] || []).length);
    const list = mix ? names.flatMap((f) => all[f] || []) : ((from && all[from]) || []);
    let useKey = typeof keyed === 'object' ? !!(from && keyed[from]) : !!keyed;
    const pool = list.length ? list : extra;
    const url = pin && pool.includes(pin) ? pin : !deal && this.src && pool.includes(this.src) ? this.src : (deal ? cycle(`club:${mix ? names.join('+') : (from || 'extra')}`, pool) : pick(pool));
    // sg_dance_01 is shot on green. The other ClubDance clips are full scenes, so keying them punches out the neon.
    if (useKey && url && /\/ClubDance\//.test(url) && !/sg_dance_01/i.test(url)) useKey = false;
    this.keyed = useKey;
    if (!url || url === this.src) { this.resume(); return; }
    this.src = url;
    this.el.src = url;
    this.resume();
  }

  resume() { if (this.el.src) this.el.play().catch(() => { /* the screens stay dark */ }); }
  pause() { this.el.pause(); }
  get ready() { return this.el.readyState >= 2; }

  /** The screens loop: paused under it (a stall, iOS) or hung on the last frame, it's started again. */
  keepAlive(t) {
    if (this.manual || !this.src || t - this.kickT < 0.6) return;
    this.kickT = t; keepLooping(this.el);
  }

  dispose() {
    this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el.remove();
    this.tex.dispose();
  }
}

/** The main room's screens: the existing DJ loops, plus every clip in SG_DJ_Game. */
export const DJ_CLIPS = ['ClubDJ', 'SG_DJ_Game'];
export function showDJ(video) {
  return video.show(DJ_CLIPS, { extra: ['assets/nightclub/plates/set_main.mp4'], mix: true });
}

/**
 * A screen's material. led: an LED pixel grid; scan: CCTV scan lines + grain; mirror: the clip is
 * tiled twice across (wide walls show two mirrored copies instead of one stretched one); fit:
 * the plane's aspect, to pillarbox a clip of another shape instead of stretching it;
 * `keyed` (a uniform, flipped live) turns green to the screen's dark `bg`.
 */
export function screenMat(video, { led = false, scan = false, mirror = false, bright = 1, bg = 0x05040a, fit = 0 } = {}) {
  const U = {
    map: { value: video.tex }, ready: { value: 0 }, keyed: { value: 0 }, t: { value: 0 }, bright: { value: bright },
    bg: { value: new THREE.Color(bg) }, flash: { value: 0 }, fitA: { value: fit }, vidA: { value: 16 / 9 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float ready, keyed, t, bright, flash, fitA, vidA; uniform vec3 bg; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  ${mirror ? 'uv.x *= 2.0; if (uv.x > 1.0) uv.x = 2.0 - uv.x;' : ''}
  float inside = 1.0;
  if (fitA > 0.0) { uv.x = (uv.x - 0.5) * (fitA / vidA) + 0.5; inside = step(0.0, uv.x) * step(uv.x, 1.0); }
  vec3 c = texture2D(map, uv).rgb;
  // green screen: how much greener than the other two channels (soft edge, spill pulled back)
  float g = c.g - max(c.r, c.b);
  float a = 1.0 - smoothstep(0.08, 0.22, g) * keyed;
  c.g = mix(c.g, min(c.g, max(c.r, c.b) * 1.05), keyed);
  c = mix(bg, c, a * inside);
  c *= ready;
  ${led ? 'vec2 cell = fract(vUv * vec2(260.0, 72.0)); c *= 0.55 + 0.45 * smoothstep(0.5, 0.2, length(cell - 0.5));' : ''}
  ${scan ? 'c = vec3(dot(c, vec3(0.3, 0.59, 0.11))) * vec3(0.75, 1.05, 0.85); c *= 0.8 + 0.2 * sin(vUv.y * 360.0 + t * 8.0); c += (h(vUv * 300.0 + t) - 0.5) * 0.12;' : ''}
  c = c * bright + flash;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
    fog: false,
  });
  m.userData.screen = U;
  return m;
}

/**
 * The video wall in the glossy floor in front of it (additive): a floor point further from the wall
 * shows a higher part of it (reach: wall heights per reflection length; from: the wall's foot, in
 * wall heights), rippled, fading out with distance. Same uniforms as screenMat, so tickScreens feeds it.
 */
export function reflectMat(video, { reach = 1, from = 0, mirror = true, bright = 0.24 } = {}) {
  const U = {
    map: { value: video.tex }, ready: { value: 0 }, keyed: { value: 0 }, t: { value: 0 }, bright: { value: bright },
    bg: { value: new THREE.Color(0) }, flash: { value: 0 }, fitA: { value: 0 }, vidA: { value: 16 / 9 }, reach: { value: reach }, from: { value: from },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float ready, t, bright, flash, reach, from; varying vec2 vUv;
void main(){
  float d = 1.0 - vUv.y;                       // 0 at the wall → 1 at the far edge
  vec2 uv = vec2(vUv.x + 0.004 * sin(vUv.y * 70.0 + t * 1.7) * d, d * reach - from);
  ${mirror ? 'uv.x *= 2.0; if (uv.x > 1.0) uv.x = 2.0 - uv.x;' : ''}
  vec3 c = texture2D(map, clamp(uv, 0.0, 1.0)).rgb * ready * step(0.0, uv.y) * step(uv.y, 1.0);
  float k = (1.0 - d) * (1.0 - d) * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  gl_FragColor = vec4((c * bright + flash * 0.3) * k, 1.0);
  #include <colorspace_fragment>
}`,
  });
  m.userData.screen = U;
  return m;
}

/** Per frame: feed the screens the clock, whether the video has a frame yet and if it's keyed. */
export function tickScreens(mats, video, t, flash = 0) {
  video.keepAlive(t);
  const ready = video.ready ? 1 : 0;
  for (const m of mats) {
    const U = m.userData.screen;
    U.t.value = t; U.flash.value = flash;
    if (m.userData.live) { U.keyed.value = 0; U.ready.value = 1; continue; } // (a CCTV camera's own feed)
    U.keyed.value = video.keyed ? 1 : 0;
    if (video.el.videoWidth) U.vidA.value = video.el.videoWidth / video.el.videoHeight;
    U.ready.value += (ready - U.ready.value) * 0.2;
  }
}
