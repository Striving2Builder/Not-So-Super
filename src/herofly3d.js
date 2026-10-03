// Supergirl in the three.js flight slice: the real rigged HeroModel (crisp at any distance, cel +
// ink like the 3D zones), posed from the flight state in three clear silhouettes: CRUISE (one fist
// forward, chest up, legs together trailing), BOOST (both fists forward, legs locked together) and
// DIVE (head-first, both fists down); upright hover only near a standstill; rolling into turns.
// Her cape (capefly3d.js) is a short tapered sheet with folds that streams behind her and ripples
// harder with speed. Her costume gets its own materials:
// pushed saturation, a little self-light and a cyan-white rim, so her red reads against a red
// dusk sky and a night city alike; plus an inked contact shadow on the street or roof below her.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { inkCharacter } from './look3d.js';
import { heroMaterial, hullGeometry, SUIT } from './herolook3d.js';
import { HERO_LAYER } from './heropass3d.js';
import { M } from './city3d.js';
import { FlightCape, CAPE_LIGHT } from './capefly3d.js';
import { FlightPose } from './heropose3d.js';

const POSE = {
  scale: 1.5,       // model metres → scene metres (heroic: she's the star of the shot)
  boot: 0.72,       // boot (foot bone) scale
  patrolScale: 18,  // in the overhead patrol view she becomes a big inked map figure
  shadow: 0x05060f,
};
/**
 * Her silhouette keyline (CSS px, drawn by her sharp pass round body + cape as one shape): ink width
 * in open sky → against a dark or busy background (night, the street canyons, the map below the
 * patrol view); a pale halo outside it at night, so the dark ink still separates her from dark walls.
 */
const LINE = { ink: [1.3, 2.3], halo: 1.4 };
/** Rim strength, shared by her materials (raised in the dark street canyons). */
export const RIM = { value: SUIT.rimK[0] };
export const RIM_K = SUIT.rimK;
const suitMaterial = (src, self) => heroMaterial(src, { self, rim: RIM, key: CAPE_LIGHT.key });

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
    this.model.root.traverse((o) => { if (o.userData.ink && o.isSkinnedMesh) o.geometry = hullGeometry(o.geometry); }); // (no ink on eyeballs / teeth)
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
    if (h.perch || hover) m.play('idle', { fade: 0.3 });
    else m.play('fly', { fade: 0.3 });
    m.mixer.update(dt); // (not m.update: the zones' simulated cloth cape is hidden in flight, don't step it)
    for (const f of ['LeftFoot', 'RightFoot']) m.bones[f]?.scale.setScalar(POSE.boot); // (the boots read oversized from behind; after the clip, which keys scale)
    const fly = h.perch || hover ? 0 : fk;
    if (fly > 0) this.pose.flying(m, fly, t); else if (!h.perch) this.pose.hovering(m, this.pose.hoverK);
    // cape: chain from between her shoulders, streaming back along her body
    const q = m.root.getWorldQuaternion(this._q);
    const fwd = this._f.set(0, 0, 1).applyQuaternion(q), up = this._s.set(0, 1, 0).applyQuaternion(q), side = this._o.set(1, 0, 0).applyQuaternion(q);
    m.bones.LeftArm.getWorldPosition(this._l); m.bones.RightArm.getWorldPosition(this._r);
    const anchor = this._l.add(this._r).multiplyScalar(0.5);
    // flying, "back" runs down her body (head → feet); hovering upright that's straight down
    const back = this._d.copy(fwd).negate().multiplyScalar(fly).addScaledVector(up, -(1 - fly)).normalize();
    // the side of her the cape lies on: her back faces the sky when flying, faces behind when upright
    const out = fly > 0.5 ? up : fwd.negate();
    anchor.addScaledVector(out, 0.06 * POSE.scale * this.size);
    this.cape.visible = true;
    this.cape.update(anchor, back, out, side, h.speed * M, t, dt, POSE.scale * this.size, boost ? 1.7 : 1);
    if (this.sun) { // the cape's key light and tint follow the sun/moon (darker, cooler at night)
      CAPE_LIGHT.key.value.subVectors(this.sun.position, this.sun.target.position).normalize();
      const day = Math.min(1, Math.max(0, (this.sun.intensity - 0.7) / 1.6));
      CAPE_LIGHT.tint.value.setRGB(1, 1, 1).lerp(this.sun.color, 0.35).multiplyScalar(0.7 + 0.3 * day);
    }
  }

  /** [ink, halo] keyline widths for her sharp pass; night 0..1, busy 0..1 (canyon / patrol view). */
  keyline(night, busy) {
    const k = Math.max(night, busy);
    return [LINE.ink[0] + (LINE.ink[1] - LINE.ink[0]) * k, LINE.halo * night];
  }
}
