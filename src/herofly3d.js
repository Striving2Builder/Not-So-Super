// Supergirl in the three.js flight slice: the real rigged HeroModel (crisp at any distance, cel +
// ink like the 3D zones), posed from the flight state: upright hover when slow, horizontal
// fist-forward flight at speed, banking into turns, cape streaming with airspeed; plus a contact
// shadow on the street or roof straight below her.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { inkCharacter } from './look3d.js';
import { M } from './city3d.js';

const POSE = {
  scale: 1.0,      // model metres → scene metres
  bankK: 0.55,     // roll per unit of the flight model's bank
  hoverPitch: 1.2, // upright when hovering
  shadow: 0x05060f,
};

export class FlyHero3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group(); // banking/pitch happen here, heading on the group
    this.group.add(this.pivot);
    scene.add(this.group);
    this.model = null;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(0,0,0,.75)'); grd.addColorStop(0.5, 'rgba(0,0,0,.45)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: POSE.shadow, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    scene.add(this.shadow);
  }

  ensure() {
    if (this.model || !heroReady()) return !!this.model;
    this.model = new HeroModel();
    this.model.root.scale.setScalar(POSE.scale);
    inkCharacter(this.model.root, { rim: 0xfff4d0, skip: [this.model.cape.mesh] });
    inkCharacter(this.model.cape.mesh, { rim: 0xfff4d0, outline: false });
    this.model.root.position.y = -0.9; // her body's middle on the pivot
    this.pivot.add(this.model.root);
    this.model.play('fly', { fade: 0 });
    return true;
  }

  /** h = the overworld hero; ground = height (world units) of whatever is under her. */
  update(h, dt, t, diving, ground) {
    this.group.position.set(h.x * M, h.z * M, h.y * M);
    // heading: her forward (+z model) along (cos ang, sin ang) in the x/z plane
    this.group.rotation.set(0, Math.PI / 2 - h.ang, 0);
    const pitch = h.perch ? 0 : h.hover * POSE.hoverPitch - h.lean * 0.25 + (diving ? -0.9 : 0);
    this.pivot.rotation.set(-pitch, 0, h.perch ? 0 : h.bank * POSE.bankK);
    const above = Math.max(0, h.z - ground);
    this.shadow.position.set(h.x * M, ground * M + 0.15, h.y * M);
    const s = Math.max(1.2, 3.2 - above * M * 0.01);
    this.shadow.scale.set(s, 1, s * 1.6);
    this.shadow.rotation.y = Math.PI / 2 - h.ang;
    this.shadow.material.opacity = Math.max(0.15, 0.75 - above * M * 0.004);
    if (!this.ensure()) return;
    const m = this.model;
    if (h.perch) m.play('idle', { fade: 0.25 });
    else if (diving) m.play('jump', { fade: 0.2 });
    else m.play('fly', { fade: 0.25 });
    m.update(dt);
    if (!h.perch && !diving) m.superFly(1 - 0.8 * h.hover);
    const air = 8 + h.speed / 45;
    m.setWind(Math.sin(t * 2.3) * 1.8, 10.5 * (1 - 0.6 * h.hover), -air);
  }
}
