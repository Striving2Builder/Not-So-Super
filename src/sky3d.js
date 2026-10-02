// Sky for the three.js flight view: a graded dome that follows the game clock (a bright warm band
// on the horizon rising through a mid tone into a deep blue/violet zenith), the sun as a disc with
// a glow at dusk, the moon with a halo at night, matching sun/moon light for the cel shading,
// district-tinted fog, and decks of stylised comic cumulus: flat two-tone shapes with an ink
// outline, always facing the camera (no paper-thin smears seen edge-on), one draw call.
//
// Colours here are DISPLAY values (what you see on screen): the dome writes them as they are, and
// the city's haze converges on `horizon` in the same space, so the horizon has no seam. At and
// below the horizon the dome is exactly `horizon`.
import * as THREE from 'three';
import { RNG } from './rng.js';

/** [zenith, mid, horizon] display colours per time of day. */
const SKY = {
  day: ['#2a63c4', '#69a4e4', '#e8f2fa'],
  dusk: ['#1d2766', '#9a86c4', '#f2cbc4'], // deep blue over a light peach-lilac band (cool: complements her red)
  night: ['#04071a', '#141038', '#35275e'],
};
/** Cloud decks (metres) and their two-tone fills + ink, per time of day (display colours). */
const CLOUD = {
  count: 64, layers: [360, 520], size: [50, 240], aspect: [0.42, 0.8], variants: 6,
  big: { count: 10, size: [320, 520], y: [400, 440] }, // a few huge banks: the foreground at high patrol
  fadeNear: [40, 130], // m past the camera→hero distance: nothing floats between the lens and her
  day: ['#ffffff', '#b9cbe6', '#2a3350'], dusk: ['#ffe4d2', '#a58cbc', '#221a40'], night: ['#5d6292', '#2e3060', '#07081a'],
};
const linear = (hex) => new THREE.Color().setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace); // as-is (display) values

const DOME_VS = 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const DOME_FS = `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunK; uniform float moonK; varying vec3 vP;
void main(){
  float h = max(vP.y, 0.0);
  // a bright band hugging the horizon, then up through the mid tone into the zenith
  vec3 c = mix(bottom, mid, smoothstep(0.0, 0.22, h));
  c = mix(c, top, smoothstep(0.18, 0.75, h));
  float d = dot(normalize(vP), sunDir);
  // sun: hard disc + warm glow (dusk), moon: pale disc + halo (night)
  c += sunCol * (pow(max(d, 0.0), 24.0) * 0.55 + pow(max(d, 0.0), 6.0) * 0.18) * sunK;
  c = mix(c, sunCol * 1.2 + 0.25, smoothstep(0.9985, 0.9992, d) * sunK);
  c += vec3(0.55, 0.62, 0.9) * pow(max(d, 0.0), 60.0) * 0.35 * moonK;
  c = mix(c, vec3(0.92, 0.94, 1.0), smoothstep(0.9993, 0.9996, d) * moonK);
  // night: a sparse field of stars, fading out toward the horizon glow
  if (moonK > 0.0 && vP.y > 0.05) {
    vec3 q = normalize(vP) * 180.0, cell = floor(q);
    float rnd = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    if (rnd > 0.985) {
      vec3 f = fract(q) - 0.5 - (vec3(fract(rnd * 17.0), fract(rnd * 31.0), fract(rnd * 47.0)) - 0.5) * 0.5;
      c += vec3(0.9, 0.92, 1.0) * smoothstep(0.16, 0.0, length(f)) * smoothstep(0.05, 0.35, vP.y) * moonK * (0.5 + 0.5 * fract(rnd * 91.0));
    }
  }
  if (vP.y <= 0.0) c = bottom; // at and below the horizon: exactly the horizon colour
  gl_FragColor = vec4(c, 1.0);
}`;

// Comic cumulus: billboards (corner offsets applied in view space), alpha-tested, two-tone + ink.
const BIG = '300.0'; // world size above which a cloud is one of the huge banks
const CLOUD_VS = `attribute vec2 corner; attribute vec2 size; attribute float variant; varying vec2 vUv; varying float vFade; varying float vDist; varying float vLy;
uniform vec3 sunDir; uniform vec2 fadeNear; uniform float heroDist; uniform float bankK; uniform vec2 heroNdc;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += corner * size;
  // lit from the sun/moon's side of the screen: the atlas lights its puffs from the upper left, so
  // mirror the shape when the light is on the right
  float flip = (viewMatrix * vec4(sunDir, 0.0)).x > 0.0 ? -1.0 : 1.0;
  vUv = vec2((corner.x * flip * 0.5 + 0.5 + mod(variant, 3.0)) / 3.0, (corner.y * 0.5 + 0.5 + floor(variant / 3.0)) * 0.5);
  vLy = corner.y * 0.5 + 0.5;
  vDist = -mv.z;
  // the cloud's own centre, not the corner: a whole cloud fades together
  float d = length((modelViewMatrix * vec4(position, 1.0)).xyz) - max(size.x, size.y) * 0.5;
  vFade = smoothstep(heroDist + fadeNear.x, heroDist + fadeNear.y, d);
  // the huge banks only exist for the high-patrol shot, seen from above: from below or edge-on
  // their ink outline would scrawl across the whole sky
  // nothing sits on her (the lower-left third at high patrol): fade clouds whose centre lands near
  // her, and keep the banks off to her right
  vec4 cc = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vec2 n = cc.xy / max(cc.w, 1e-3);
  vFade *= mix(1.0, smoothstep(0.35, 0.7, length((n - heroNdc) * vec2(0.8, 1.0))), bankK);
  if (size.x > ${BIG}) vFade *= smoothstep(0.6, 0.9, bankK) * smoothstep(40.0, 90.0, cameraPosition.y - position.y) * smoothstep(0.15, 0.55, n.x - heroNdc.x);
  gl_Position = projectionMatrix * mv;
}`;
const CLOUD_FS = `uniform sampler2D map; uniform vec3 lit; uniform vec3 shade; uniform vec3 ink; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar; uniform float alpha;
varying vec2 vUv; varying float vFade; varying float vDist; varying float vLy;
void main(){
  vec4 t = texture2D(map, vUv);
  // a soft-but-crisp edge: the shape mask is blurred in the atlas, sharpened here by its own
  // screen-space slope (anti-aliased at any size, no jagged alpha-test fringe)
  float fw = fwidth(t.a) + 1e-4, w = fw * 0.75, a = smoothstep(0.5 - w, 0.5 + w, t.a);
  if (a < 0.01 || vFade < 0.02) discard;
  // ink: a constant ~2 px band just inside the silhouette (the buildings' ink weight), whatever
  // the cloud's size on screen; underside in shadow, lit crowns toward the light
  float px = (t.a - 0.5) / fw, inkK = max(1.0 - smoothstep(1.2, 2.2, px), t.b * smoothstep(0.0, 1.0, px));
  vec3 under = shade * mix(0.68, 1.0, smoothstep(0.1, 0.6, vLy));
  vec3 c = mix(mix(under, lit, t.r), ink, inkK);
  c = mix(c, fogCol, smoothstep(fogNear, fogFar, vDist) * 0.85);
  gl_FragColor = vec4(c, a * alpha * vFade);
}`;

let cloudTex = null;
/** 3×2 atlas of comic cumulus shapes. R = lit top, B = ink outline, A = shape (soft edge). */
function cloudAtlas() {
  if (cloudTex) return cloudTex;
  const S = 256, c = document.createElement('canvas'); c.width = S * 3; c.height = S * 2;
  const g = c.getContext('2d'), r = new RNG(4711);
  for (let v = 0; v < 6; v++) {
    const ox = (v % 3) * S, oy = Math.floor(v / 3) * S, bumps = [];
    // a low row of puffs along a flat base, and (most shapes) a taller tier of 1-3 big heads
    const n = 3 + (v % 3), base = 178;
    for (let i = 0; i < n; i++) {
      const x = 46 + (i / (n - 1)) * 164 + r.range(-8, 8), rad = r.range(24, 38);
      bumps.push([x, base - rad * 0.55, rad]);
    }
    const heads = v === 5 ? 0 : 1 + (v % 3);
    for (let i = 0; i < heads; i++) {
      const x = 128 + (i - (heads - 1) / 2) * 56 + r.range(-12, 12), rad = r.range(36, 54) * (heads === 1 ? 1.15 : 1);
      bumps.push([x, base - 40 - rad * 0.75 - r.range(0, 18), rad]);
    }
    const shape = (grow, dx = 0, dy = 0) => {
      g.beginPath();
      for (const [x, y, rad] of bumps) { g.moveTo(ox + x + dx + rad + grow, oy + y + dy); g.arc(ox + x + dx, oy + y + dy, rad + grow, 0, Math.PI * 2); }
      g.rect(ox + 40 - grow, oy + base - 22 - grow + dy, 176 + grow * 2, 22 + grow * 2); // flat base
      g.fill();
    };
    g.save(); g.filter = 'blur(2px)';
    g.fillStyle = 'rgba(0,0,255,1)'; shape(7);          // ink (B), the outline ring
    g.restore();
    g.fillStyle = 'rgba(0,0,0,1)'; shape(0);            // shade fill
    g.save();
    g.beginPath();
    for (const [x, y, rad] of bumps) { g.moveTo(ox + x + rad, oy + y); g.arc(ox + x, oy + y, rad, 0, Math.PI * 2); }
    g.rect(ox + 40, oy + base - 22, 176, 22); g.clip();
    g.fillStyle = 'rgba(255,0,0,1)';                   // lit tops: the bumps shifted up-left
    for (const [x, y, rad] of bumps) { g.beginPath(); g.arc(ox + x - 7, oy + y - 11, rad * 0.9, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.NoColorSpace; // channels are masks, not colours
  return cloudTex;
}

const _a = new THREE.Color(), _b = new THREE.Color(), _t = new THREE.Color(), _d = new THREE.Vector3();

export class Sky3D {
  constructor(scene, worldW, worldH) {
    this.scene = scene;
    /** The horizon's display colour (the city's haze converges on it). */
    this.horizon = new THREE.Color();
    this.uniforms = {
      top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bottom: { value: this.horizon },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunK: { value: 0 }, moonK: { value: 0 },
    };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false, vertexShader: DOME_VS, fragmentShader: DOME_FS,
    }));
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.dome = dome; scene.add(dome);
    // lights for the toon bands
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404858, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0x2b2152, 300, 1600);
    this.addClouds(worldW, worldH);
  }

  addClouds(W, H) {
    const r = new RNG(9157), pos = [], corner = [], size = [], variant = [], idx = [];
    const B = CLOUD.big;
    for (let i = 0; i < CLOUD.count + B.count; i++) {
      const big = i >= CLOUD.count, cx = r.range(0, W), cz = r.range(0, H);
      // sizes skewed small (many little, few large), each with its own aspect
      const s = big ? r.range(B.size[0], B.size[1]) : CLOUD.size[0] + (CLOUD.size[1] - CLOUD.size[0]) * Math.pow(r.range(0, 1), 1.8);
      const y = big ? r.range(B.y[0], B.y[1]) : r.range(CLOUD.layers[0], CLOUD.layers[1]), asp = r.range(CLOUD.aspect[0], CLOUD.aspect[1]);
      const v = Math.floor(r.range(0, CLOUD.variants)), base = pos.length / 3;
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(cx, y, cz); corner.push(u, w); size.push(s, s * asp); variant.push(v); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 2));
    geo.setAttribute('variant', new THREE.Float32BufferAttribute(variant, 1));
    geo.setIndex(idx);
    this.cloudU = {
      map: { value: cloudAtlas() }, lit: { value: new THREE.Color() }, shade: { value: new THREE.Color() }, ink: { value: new THREE.Color() },
      fogCol: { value: this.horizon }, sunDir: this.uniforms.sunDir, fogNear: { value: 600 }, fogFar: { value: 2400 }, alpha: { value: 1 }, fadeNear: { value: new THREE.Vector2(...CLOUD.fadeNear) }, heroDist: { value: 10 }, bankK: { value: 0 }, heroNdc: { value: new THREE.Vector2() },
    };
    this.cloudMat = new THREE.ShaderMaterial({ uniforms: this.cloudU, vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, fog: false });
    this.cloudMat.extensions = { derivatives: true };
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 5;
    this.scene.add(this.clouds);
  }

  /**
   * clock: minutes since midnight; night: 0..1 (the game's own); tint: district colour to lean the
   * fog toward; eye: the camera (sun and dome follow it); patrol 0..1: the raised map view thins
   * the cloud deck under the camera; heroDist: camera→hero (m), clouds nearer than her (+ a margin) fade;
   * bankK 0..1: the high-patrol shot (shows the huge banks, clears clouds off her at heroNdc).
   */
  update(clock, night, tint, eye, fogFar, patrol = 0, heroDist = 10, bankK = 0, heroNdc = null) {
    const hr = (clock / 60) % 24;
    const near = Math.max(0, 1 - Math.min(Math.abs(hr - 19), Math.abs(hr - 6.5)) / 1.6); // how close to sunset/sunrise
    const dusk = near * (1 - night * 0.6), day = 1 - night;
    // the warm band holds on the horizon well into the evening; the zenith goes dark first
    const grade = (i) => _a.copy(linear(SKY.day[i])).lerp(_b.copy(linear(SKY.night[i])), night).lerp(_t.copy(linear(SKY.dusk[i])), i === 0 ? dusk * 0.6 : near * (1 - night * 0.25));
    this.uniforms.top.value.copy(grade(0));
    this.uniforms.mid.value.copy(grade(1));
    this.horizon.copy(grade(2));
    // fog (lit materials work in linear light): the horizon, leaning toward the district colour
    const fog = this.scene.fog;
    fog.color.copy(this.horizon).convertSRGBToLinear().lerp(_t.set(tint || '#808080'), 0.1 + 0.14 * night);
    fog.near = fogFar * (0.25 + 0.1 * patrol); fog.far = fogFar;
    // sun by day, moon by night: an arc across the southern sky (behind a north-flying camera)
    const a = ((hr - 6) / 12) * Math.PI, up = night > 0.5 ? 0.42 : Math.max(0.04, Math.sin(a) * 0.9);
    const dir = _d.set(night > 0.5 ? 0.5 : -Math.cos(a), up, 0.6).normalize();
    this.uniforms.sunDir.value.copy(dir);
    this.uniforms.sunCol.value.copy(linear(dusk > 0.3 ? '#ffb070' : '#fff2c8'));
    this.uniforms.sunK.value = night > 0.5 ? 0 : 0.5 + 0.5 * dusk;
    this.uniforms.moonK.value = night > 0.5 ? 1 : 0;
    this.dome.position.copy(eye);
    this.sun.position.copy(eye).addScaledVector(dir, 500);
    this.sun.target.position.copy(eye);
    this.sun.color.set(night > 0.5 ? '#8fa6ff' : dusk > 0.3 ? '#ffc08a' : '#fff4e0');
    this.sun.intensity = 0.7 + 1.6 * day;
    this.hemi.color.set(night > 0.5 ? '#5a5ca8' : '#ffffff');
    this.hemi.groundColor.set(night > 0.5 ? '#2a1e3a' : '#505a68');
    this.hemi.intensity = 0.55 + 0.7 * day;
    // clouds: two-tone + ink in the light of the hour; thinned in the patrol view
    const tone = (i) => _a.copy(linear(CLOUD.day[i])).lerp(_b.copy(linear(CLOUD.night[i])), night).lerp(_t.copy(linear(CLOUD.dusk[i])), near * (1 - night * 0.35));
    this.cloudU.lit.value.copy(tone(0)); this.cloudU.shade.value.copy(tone(1)); this.cloudU.ink.value.copy(tone(2));
    this.cloudU.fogNear.value = fogFar * 0.5; this.cloudU.fogFar.value = fogFar * 1.6;
    this.cloudU.alpha.value = 1 - 0.6 * patrol;
    this.cloudU.heroDist.value = heroDist;
    this.cloudU.bankK.value = bankK;
    if (heroNdc) this.cloudU.heroNdc.value.copy(heroNdc);
  }
}
