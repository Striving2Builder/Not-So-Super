// Sky for the three.js flight slice: a gradient dome that follows the game clock (day blue, dusk
// orange, night navy with a purple city glow on the horizon), the sun or moon, matching sun/moon
// light for the cel shading, distance fog tinted by the district she's over, and cloud decks she
// can climb through (merged horizontal puffs: one draw call).
import * as THREE from 'three';
import { RNG } from './rng.js';

/** Sky colours: [zenith, horizon] per time of day. */
const SKY = {
  day: ['#3f86d6', '#bfd9ef'],
  dusk: ['#2c3a78', '#ff9b62'],
  night: ['#050818', '#2b2152'],
};
const CLOUD = { count: 150, layers: [380, 430, 470], size: [120, 260], alpha: 0.6 }; // metres

let puff = null;
function puffTexture() {
  if (puff) return puff;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = new RNG(77);
  for (let i = 0; i < 12; i++) {
    const x = 64 + r.range(-28, 28), y = 64 + r.range(-20, 20), rad = r.range(22, 40);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,.6)'); grd.addColorStop(0.6, 'rgba(255,255,255,.25)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  puff = new THREE.CanvasTexture(c);
  return puff;
}

const _a = new THREE.Color(), _b = new THREE.Color(), _t = new THREE.Color();

export class Sky3D {
  constructor(scene, worldW, worldH) {
    this.scene = scene;
    this.uniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 12), new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.6 + 0.08, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
    }));
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.dome = dome; scene.add(dome);
    // sun / moon disc
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,1)'); grd.addColorStop(0.32, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    this.disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true }));
    this.disc.scale.setScalar(420);
    scene.add(this.disc);
    // lights for the toon bands
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x404858, 1.2);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0x2b2152, 300, 1600);
    this.addClouds(worldW, worldH);
  }

  addClouds(W, H) {
    const r = new RNG(9157), pos = [], uv = [], idx = [];
    for (let i = 0; i < CLOUD.count; i++) {
      const cx = r.range(0, W), cz = r.range(0, H), size = r.range(CLOUD.size[0], CLOUD.size[1]);
      // two or three stacked puffs per cloud, a few metres apart: reads as volume from any angle
      const layers = 2 + (i % 2);
      for (let l = 0; l < layers; l++) {
        const y = CLOUD.layers[i % CLOUD.layers.length] + l * 9, s = size * (1 - l * 0.18), a = r.range(0, Math.PI), base = pos.length / 3;
        for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const x = u * Math.cos(a) - v * Math.sin(a), z = u * Math.sin(a) + v * Math.cos(a);
          pos.push(cx + x * s, y, cz + z * s); uv.push((u + 1) / 2, (v + 1) / 2);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.cloudMat = new THREE.MeshBasicMaterial({ map: puffTexture(), transparent: true, opacity: CLOUD.alpha, depthWrite: false, side: THREE.DoubleSide });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.renderOrder = 5;
    this.scene.add(this.clouds);
  }

  /**
   * clock: minutes since midnight; night: 0..1 (the game's own); tint: district colour to lean the
   * horizon/fog toward; focus: the point the camera looks at (sun and dome follow it).
   */
  update(clock, night, tint, eye, fogFar) {
    const hr = (clock / 60) % 24;
    const dusk = Math.max(0, 1 - Math.min(Math.abs(hr - 19), Math.abs(hr - 6.5)) / 1.6) * (1 - night * 0.6);
    const day = 1 - night;
    this.uniforms.top.value.copy(_a.set(SKY.day[0])).lerp(_b.set(SKY.night[0]), night).lerp(_t.set(SKY.dusk[0]), dusk * 0.6);
    this.uniforms.bottom.value.copy(_a.set(SKY.day[1])).lerp(_b.set(SKY.night[1]), night).lerp(_t.set(SKY.dusk[1]), dusk);
    // fog = horizon, leaning toward the district colour (stronger at night: neon haze)
    const fog = this.scene.fog;
    fog.color.copy(this.uniforms.bottom.value).lerp(_t.set(tint || '#808080'), 0.12 + 0.18 * night);
    fog.near = fogFar * 0.25; fog.far = fogFar;
    // sun by day, moon by night: an arc across the southern sky (behind a north-flying camera)
    const a = ((hr - 6) / 12) * Math.PI, up = night > 0.5 ? 0.55 : Math.max(0.05, Math.sin(a));
    const dir = new THREE.Vector3(night > 0.5 ? 0.5 : -Math.cos(a), up, 0.6).normalize();
    this.dome.position.copy(eye);
    this.disc.position.copy(eye).addScaledVector(dir, 3200);
    this.disc.material.color.set(night > 0.5 ? '#e8eeff' : dusk > 0.3 ? '#ffb070' : '#fff6d8');
    this.disc.scale.setScalar(night > 0.5 ? 260 : 420);
    this.sun.position.copy(eye).addScaledVector(dir, 500);
    this.sun.target.position.copy(eye);
    this.sun.color.set(night > 0.5 ? '#8fa6ff' : dusk > 0.3 ? '#ffc08a' : '#fff4e0');
    this.sun.intensity = 0.7 + 1.6 * day;
    this.hemi.color.set(night > 0.5 ? '#5a5ca8' : '#ffffff');
    this.hemi.groundColor.set(night > 0.5 ? '#2a1e3a' : '#505a68');
    this.hemi.intensity = 0.55 + 0.7 * day;
    this.cloudMat.color.set(night > 0.5 ? '#6a6c96' : dusk > 0.3 ? '#ffd2b0' : '#ffffff');
  }
}
