// Supergirl in the three.js flight slice: the real rigged HeroModel (crisp at any distance, cel +
// ink like the 3D zones), posed from the flight state by heropose3d.js (cruise / boost / dive / slow
// glide / hover, banking and climbing). Her cape (capefly3d.js) is a short tapered sheet with folds
// that streams behind her and ripples harder with speed. Her costume uses her own comic materials
// (herolook3d.js: pushed saturation, self-light, a cyan-white rim, so her red reads against a red
// dusk sky and a night city alike); plus an inked contact shadow on the street or roof below her.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { inkCharacter } from './look3d.js';
import { heroMaterial, inkHull, SUIT, HERO_LIGHT } from './herolook3d.js';
import { HERO_LAYER } from './heropass3d.js';
import { M } from './city3d.js';
import { FlightCape, CAPE_LIGHT } from './capefly3d.js';
import { FlightPose } from './heropose3d.js';

const POSE = {
  scale: 1.5,       // model metres → scene metres (heroic: she's the star of the shot)
  boot: 0.72,       // boot (foot bone) scale
  patrolScale: 18,  // in the overhead patrol view she becomes a big inked map figure
  shadow: 0x05060f,
  idleYaw: Math.PI / 2, // the idle clip (hover / perch) has her facing 90° off her heading: turned back to face ahead
  stretch: [0.07, 0.15], // boost onset: a squash-and-stretch along her body (× length, s)
};
/**
 * The scene's light on her (HERO_LIGHT): tint by day / dusk / night (× the sun's colour a little) and
 * the rim's sky colour (day cyan-white, dusk sunset orange, night cool blue).
 */
const SCENE = { night: [0.5, 0.53, 0.74], dusk: [1.0, 0.88, 0.8], sunMix: 0.18, rimDusk: [1.0, 0.62, 0.4], rimNight: [0.42, 0.55, 1.0] };
/**
 * Her silhouette keyline (CSS px, drawn by her sharp pass round body + cape as one shape): ink width
 * in open sky → against a dark or busy background (night, the street canyons, the map below the
 * patrol view), thinner as she gets small on screen (near: the chase distance, m; min: its floor).
 * No pale halo outside it any more (it read as a grey matte fringe): the sky-coloured rim separates her.
 */
const LINE = { ink: [1.3, 2.3], halo: 0, near: 9, min: 0.45, hull: 2.2 }; // hull: her own ink hull's width (px, look3d's), thinned the same way
/** Rim strength, shared by her materials (raised in the dark street canyons). */
export const RIM = { value: SUIT.rimK[0] };
export const RIM_K = SUIT.rimK;
const suitMaterial = (src, self) => heroMaterial(src, { self, rim: RIM, key: CAPE_LIGHT.key, light: HERO_LIGHT });

const _white = new THREE.Color(1, 1, 1), _c = new THREE.Color(), _c2 = new THREE.Color();

export class FlyHero3D {
  /** Her bounding radius about the pivot (m, before the patrol enlargement): her reach to the punching fist; the short cape stays inside it. Sizes her sharp pass. */
  static RADIUS = 2.1;

  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group(); // banking/pitch happen here, heading on the group
    this.group.add(this.pivot);
    scene.add(this.group);
    this.model = null;
    this.size = 1; // patrol-view enlargement (eased)
    this.pose = new FlightPose();
    // inked blob: a dark core with a crisp ink ring, so it reads on lit roofs and dark streets alike
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grd.addColorStop(0, 'rgba(0,0,0,.85)'); grd.addColorStop(0.75, 'rgba(0,0,0,.6)'); grd.addColorStop(0.86, 'rgba(0,0,0,.95)'); grd.addColorStop(0.9, 'rgba(0,0,0,.95)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: POSE.shadow, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    this.cape = new FlightCape(scene);
    this.sun = scene.children.find((o) => o.isDirectionalLight) || null; // Sky3D's sun/moon (added before her; the camera fill comes later)
    this.olW = { value: LINE.hull }; // her ink hull's width (px), thinned with distance in keyline()
    this.idleK = 0; this.boostK = 0; this.boostT = 9; // (idle-clip facing, boost blend, time since the boost kicked in)
    this.cape.visible = false;
    this._f = new THREE.Vector3(); this._s = new THREE.Vector3(); this._o = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._d = new THREE.Vector3();
    this._l = new THREE.Vector3(); this._r = new THREE.Vector3(); this._mid = new THREE.Vector3(); this._in = new THREE.Vector3();
  }

  ensure() {
    if (this.model || !heroReady()) return !!this.model;
    this.model = new HeroModel();
    this.model.root.scale.setScalar(POSE.scale);
    const cloth = this.model.cape.mesh;
    cloth.visible = false; // the ribbon cape replaces the cloth sheet in flight
    this.model.root.traverse((o) => {
      if (!o.isMesh || o === cloth || Array.isArray(o.material) || !o.material || o.material.isMeshBasicMaterial) return;
      o.material = suitMaterial(o.material, SUIT.self);
    });
    inkCharacter(this.model.root, { skip: [cloth] }); // outlines (materials are already comic)
    inkHull(this.model.root); // (no ink on eyeballs / teeth / face interior)
    // her own copy of the shared ink hull material, so its width can thin with distance (at phone
    // size the shared constant-px hull swallowed her silhouette); same program, own olW uniform
    const hulls = new Map();
    this.model.root.traverse((o) => {
      if (!o.userData.ink || !o.material || Array.isArray(o.material)) return;
      let h = hulls.get(o.material);
      if (!h) {
        const src = o.material, prev = src.onBeforeCompile;
        h = src.clone();
        h.onBeforeCompile = (sh, r) => { prev.call(h, sh, r); sh.uniforms.olW = this.olW; };
        h.customProgramCacheKey = src.customProgramCacheKey;
        hulls.set(src, h);
      }
      o.material = h;
    });
    this.model.root.position.y = -0.9 * POSE.scale; // her body's middle on the pivot
    this.pivot.add(this.model.root);
    this.model.play('fly', { fade: 0 });
    return true;
  }

  /**
   * h = the overworld hero; ground = height (world units) of whatever is under her; patrol 0..1;
   * boost = boosting (both fists, the cape whips harder).
   */
  update(h, dt, t, diving, ground, patrol = 0, boost = false) {
    this.group.position.set(h.x * M, h.z * M, h.y * M);
    // heading: her forward (+z model) along (cos ang, sin ang) in the x/z plane
    this.group.rotation.set(0, Math.PI / 2 - h.ang, 0);
    // her attitude and pose blends (cruise / boost / dive / slow glide / hover, banking, climbing):
    // heropose3d.js. Any real forward motion lays her out horizontal; only near a standstill does
    // she stand upright in the air (in the raised patrol view she glides over the map instead).
    const A = this.pose.step(h, dt, t, diving, boost, patrol), fk = this.pose.fly, hover = this.pose.hover;
    this.pivot.rotation.set(-A.pitch, A.yaw, A.roll);
    this.pivot.position.y = A.bob * POSE.scale * this.size;
    this.size += (1 + (POSE.patrolScale - 1) * patrol - this.size) * Math.min(1, dt * 6);
    this.pivot.scale.setScalar(this.size);
    const above = Math.max(0, h.z - ground) * M;
    this.shadow.position.set(h.x * M, ground * M + 0.15, h.y * M);
    const s = Math.max(1.6, 3.4 - above * 0.012) * this.size;
    this.shadow.scale.set(s, 1, s * (1.2 + 0.5 * fk));
    this.shadow.rotation.y = Math.PI / 2 - h.ang;
    this.shadow.material.opacity = Math.max(0.3, 0.85 - above * 0.003) * (1 - 0.3 * patrol) + 0.3 * patrol;
    if (!this.ensure()) return;
    const m = this.model;
    const perched = this.pose.perched;
    if (perched || hover) m.play('idle', { fade: 0.3 });
    else m.play('fly', { fade: 0.3 });
    m.mixer.update(dt); // (not m.update: the zones' simulated cloth cape is hidden in flight, don't step it)
    for (const f of ['LeftFoot', 'RightFoot']) m.bones[f]?.scale.setScalar(POSE.boot); // (the boots read oversized from behind; after the clip, which keys scale)
    const fly = perched || hover ? 0 : fk;
    // the idle clip faces 90° off her heading: turn her root back (eased with the clip's cross-fade),
    // so hovering she faces ahead with her back and cape to the chase camera
    this.idleK += ((perched || hover ? 1 : 0) - this.idleK) * Math.min(1, dt * 7);
    m.root.rotation.y = POSE.idleYaw * this.idleK;
    // boost onset: a quick stretch along her body (squash-and-stretch), settling back
    if (boost && this.boostK < 0.05) this.boostT = 0;
    this.boostK += ((boost ? 1 : 0) - this.boostK) * Math.min(1, dt * 6);
    this.boostT += dt;
    const st = 1 + POSE.stretch[0] * Math.max(0, 1 - this.boostT / POSE.stretch[1]) * fly;
    m.root.scale.set(POSE.scale / Math.sqrt(st), POSE.scale / Math.sqrt(st), POSE.scale * st);
    if (fly > 0) this.pose.flying(m, fly, t); else if (!perched) this.pose.hovering(m, this.pose.hoverK, t);
    // cape: chain from between her shoulders, streaming back along her body
    const q = m.root.getWorldQuaternion(this._q);
    // (the idle clip stands her facing the root's −x, her left along its +z: see FlightPose.axes)
    const idle = perched || hover;
    const fwd = this._f.set(idle ? -1 : 0, 0, idle ? 0 : 1).applyQuaternion(q), up = this._s.set(0, 1, 0).applyQuaternion(q), side = this._o.set(idle ? 0 : 1, 0, idle ? 1 : 0).applyQuaternion(q);
    m.bones.LeftArm.getWorldPosition(this._l); m.bones.RightArm.getWorldPosition(this._r);
    const anchor = this._l.add(this._r).multiplyScalar(0.5);
    // flying, "back" runs down her body (head → feet); hovering upright that's straight down
    // (hovering, it drifts back off her shoulders and sways a little, rather than hanging like a curtain)
    const hk = perched ? 0 : 1 - fly;
    const back = this._d.copy(fwd).negate().multiplyScalar(fly + 0.35 * hk).addScaledVector(up, -(1 - fly)).addScaledVector(side, Math.sin(t * 0.9) * 0.12 * hk).normalize();
    // the side of her the cape lies on: her back faces the sky when flying, faces behind when upright
    const out = fly > 0.5 ? up : fwd.negate();
    anchor.addScaledVector(out, 0.06 * POSE.scale * this.size);
    this.cape.visible = true;
    this.cape.update(anchor, back, out, side, h.speed * M, t, dt, POSE.scale * this.size, this.boostK);
    if (this.sun) this.light(); // her key light, time-of-day tint and rim colour follow the sun/moon
  }

  /** HERO_LIGHT + the cape's key/tint from the sky's sun (intensity 0.7 night → 2.3 day; its colour warm at dusk). */
  light() {
    const sun = this.sun, c = sun.color;
    CAPE_LIGHT.key.value.subVectors(sun.position, sun.target.position).normalize();
    const day = Math.min(1, Math.max(0, (sun.intensity - 0.7) / 1.6));
    const dusk = Math.min(1, Math.max(0, (c.r - c.b) * 2.2)) * Math.min(1, day * 3); // (a warm sun, while it's up)
    const T = HERO_LIGHT.tint.value.setRGB(...SCENE.night).lerp(_white, day);
    T.multiply(_c.setRGB(1, 1, 1).lerp(_c2.setRGB(...SCENE.dusk), dusk)).multiply(_c.setRGB(1, 1, 1).lerp(c, SCENE.sunMix));
    HERO_LIGHT.rim.value.setRGB(...SUIT.rim).lerp(_c.setRGB(...SCENE.rimDusk), dusk * 0.75).lerp(_c.setRGB(...SCENE.rimNight), 1 - day).multiplyScalar(0.6 + 0.4 * day); // (softer at night: a cool edge, not a neon one)
    CAPE_LIGHT.tint.value.copy(T);
  }

  /** [ink, halo] keyline widths for her sharp pass; night 0..1, busy 0..1 (canyon / patrol view). */
  keyline(night, busy) {
    const k = Math.max(night, busy);
    const d = this.cape.eye.lengthSq() ? this.cape.eye.distanceTo(this.group.position) / this.size : LINE.near;
    const far = Math.min(1, Math.max(LINE.min, LINE.near / Math.max(1, d)));
    this.olW.value = LINE.hull * Math.min(1, Math.max(LINE.min, Math.sqrt(LINE.near / Math.max(1, d)))); // (gentler: the hull draws her inner lines too)
    return [(LINE.ink[0] + (LINE.ink[1] - LINE.ink[0]) * k) * far, LINE.halo * night];
  }
}
