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
  dusk: ['#2a1f66', '#8a4f9e', '#ffb468'],
  night: ['#04071a', '#141038', '#35275e'],
};
/** Cloud decks (metres) and their two-tone fills + ink, per time of day (display colours). */
const CLOUD = {
  count: 70, layers: [380, 430, 470], size: [70, 150],
  fadeNear: [60, 160], // m from the camera: clouds fade out before they can smear the lens
  day: ['#ffffff', '#b9cbe6', '#2a3350'], dusk: ['#ffd9b8', '#b7769a', '#2a1630'], night: ['#5d6292', '#2e3060', '#07081a'],
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
  if (vP.y <= 0.0) c = bottom; // at and below the horizon: exactly the horizon colour
  gl_FragColor = vec4(c, 1.0);
}`;

// Comic cumulus: billboards (corner offsets applied in view space), alpha-tested, two-tone + ink.
const CLOUD_VS = `attribute vec2 corner; attribute vec2 size; attribute float variant; varying vec2 vUv; varying float vFade; varying float vDist;
uniform vec2 fadeNear;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += corner * size;
  vUv = vec2((corner.x * 0.5 + 0.5 + mod(variant, 2.0)) * 0.5, (corner.y * 0.5 + 0.5 + floor(variant / 2.0)) * 0.5);
  vDist = -mv.z;
  vFade = smoothstep(fadeNear.x, fadeNear.y, length(mv.xyz));
  gl_Position = projectionMatrix * mv;
}`;
const CLOUD_FS = `uniform sampler2D map; uniform vec3 lit; uniform vec3 shade; uniform vec3 ink; uniform vec3 fogCol; uniform float fogNear; uniform float fogFar; uniform float alpha;
varying vec2 vUv; varying float vFade; varying float vDist;
void main(){
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.5 || vFade < 0.02) discard;
  vec3 c = mix(mix(shade, lit, t.r), ink, t.b);
  c = mix(c, fogCol, smoothstep(fogNear, fogFar, vDist) * 0.85);
  gl_FragColor = vec4(c, alpha * vFade);
}`;

let cloudTex = null;
/** 2×2 atlas of cumulus shapes. R = lit top, B = ink outline, A = shape. */
function cloudAtlas() {
  if (cloudTex) return cloudTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S * 2;
  const g = c.getContext('2d'), r = new RNG(4711);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * S, oy = Math.floor(v / 2) * S, bumps = [];
    const n = 4 + (v % 3);
    for (let i = 0; i < n; i++) {
      const x = 50 + (i / (n - 1)) * 156 + r.range(-10, 10), rad = r.range(30, 52) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.7);
      bumps.push([x, 168 - rad * 0.6 - r.range(0, 22), rad]);
    }
    const shape = (grow, dy = 0) => {
      g.beginPath();
      for (const [x, y, rad] of bumps) { g.moveTo(ox + x + rad + grow, oy + y + dy); g.arc(ox + x, oy + y + dy, rad + grow, 0, Math.PI * 2); }
      g.rect(ox + 44 - grow, oy + 150 - grow + dy, 168 + grow * 2, 24 + grow * 2); // flat base
      g.fill();
    };
    g.fillStyle = 'rgba(0,0,255,1)'; shape(6);         // ink (B), the outline ring
    g.fillStyle = 'rgba(0,0,0,1)'; shape(0);           // shade fill
    g.fillStyle = 'rgba(255,0,0,1)'; g.save(); g.beginPath(); // lit top: the shape, shifted down = cut off at the bottom
    for (const [x, y, rad] of bumps) { g.moveTo(ox + x + rad, oy + y); g.arc(ox + x, oy + y, rad, 0, Math.PI * 2); }
    g.rect(ox + 44, oy + 150, 168, 24); g.clip();
    for (const [x, y, rad] of bumps) { g.beginPath(); g.arc(ox + x - 6, oy + y - 10, rad * 0.92, 0, Math.PI * 2); g.fill(); }
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
    for (let i = 0; i < CLOUD.count; i++) {
      const cx = r.range(0, W), cz = r.range(0, H), s = r.range(CLOUD.size[0], CLOUD.size[1]), y = CLOUD.layers[i % CLOUD.layers.length] + r.range(-12, 12);
      const v = Math.floor(r.range(0, 4)), base = pos.length / 3;
      for (const [u, w] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pos.push(cx, y, cz); corner.push(u, w); size.push(s, s * 0.5); variant.push(v); }
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
      fogCol: { value: this.horizon }, fogNear: { value: 600 }, fogFar: { value: 2400 }, alpha: { value: 1 }, fadeNear: { value: new THREE.Vector2(...CLOUD.fadeNear) },
    };
    this.cloudMat = new THREE.ShaderMaterial({ uniforms: this.cloudU, vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, fog: false });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 5;
    this.scene.add(this.clouds);
  }

  /**
   * clock: minutes since midnight; night: 0..1 (the game's own); tint: district colour to lean the
   * fog toward; eye: the camera (sun and dome follow it); patrol 0..1: the raised map view thins
   * the cloud deck under the camera.
   */
  update(clock, night, tint, eye, fogFar, patrol = 0) {
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
  }
}
