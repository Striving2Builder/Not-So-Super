// Supergirl in the three.js flight slice: the real rigged HeroModel (crisp at any distance, cel +
// ink like the 3D zones), posed from the flight state: upright hover when slow, a streamlined
// fist-forward dive at speed (legs straight and trailing), rolling into turns so you see her side,
// cape streaming with airspeed; plus an inked contact shadow on the street or roof below her.
// Her costume gets its own materials: pushed saturation, a little self-light and a bright accent
// rim, so she reads as red/blue/gold against a night city instead of a dark smear.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { inkCharacter, comic, gradMap } from './look3d.js';
import { M } from './city3d.js';

const POSE = {
  scale: 1.3,       // model metres → scene metres (a touch heroic: she's the star of the shot)
  bankK: 1.05,      // roll per unit of the flight model's bank (≈60° at a hard turn: her side shows)
  flyFrom: 14, flyFull: 70, // speed (world units/s) where her horizontal flying pose starts / is full
  slowPitch: 0.45,  // head-up tilt (rad) while flying slowly
  legs: 0.9,        // how hard the legs straighten and trail at speed (0..1)
  patrolScale: 12,   // in the overhead patrol view she becomes a big inked map figure
  shadow: 0x05060f,
};
/** Costume read at night: saturation, self-light (fraction of albedo), accent rim. */
const SUIT = { sat: 1.45, self: 0.32, rim: [1.0, 0.85, 0.35], rimK: 0.9, capeSelf: 0.4 };

/** Her own cel material for one source material (not the zones' shared cache: these are pushed). */
function suitMaterial(src, self, rim = true) {
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: gradMap(3),
    transparent: !!src.transparent && (src.opacity ?? 1) < 0.99, opacity: src.opacity ?? 1, alphaTest: src.alphaTest || 0, side: src.side ?? THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, ${SUIT.sat.toFixed(2)}), 0.0); }`)
      // a thin rim (only the true silhouette edge, from the upper side): foreshortened limbs seen
      // end-on would otherwise light up gold all over
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(2)};
${rim ? `{ float rf = 1.0 - abs(dot(normal, normalize(vViewPosition)));
  float rd = smoothstep(0.0, 0.6, dot(normal, vec3(0.0, 1.0, 0.0)));
  totalEmissiveRadiance += vec3(${SUIT.rim.join(', ')}) * ${SUIT.rimK.toFixed(2)} * smoothstep(0.86, 0.93, rf) * rd; }` : ''}`);
  };
  m.customProgramCacheKey = () => `suit${self}${rim}`;
  return comic(m, { halftone: 0 });
}

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

export class FlyHero3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group(); // banking/pitch happen here, heading on the group
    this.group.add(this.pivot);
    scene.add(this.group);
    this.model = null;
    this.size = 1; // patrol-view enlargement (eased)
    // inked blob: a dark core with a crisp ink ring, so it reads on lit roofs and dark streets alike
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    grd.addColorStop(0, 'rgba(0,0,0,.85)'); grd.addColorStop(0.75, 'rgba(0,0,0,.6)'); grd.addColorStop(0.86, 'rgba(0,0,0,.95)'); grd.addColorStop(0.9, 'rgba(0,0,0,.95)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: POSE.shadow, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.shadow.renderOrder = 2;
    scene.add(this.shadow);
    this._f = new THREE.Vector3(); this._s = new THREE.Vector3(); this._o = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._d = new THREE.Vector3();
  }

  ensure() {
    if (this.model || !heroReady()) return !!this.model;
    this.model = new HeroModel();
    this.model.root.scale.setScalar(POSE.scale);
    const cape = this.model.cape.mesh;
    this.model.root.traverse((o) => {
      if (!o.isMesh || Array.isArray(o.material) || !o.material || o.material.isMeshBasicMaterial) return;
      o.material = suitMaterial(o.material, o === cape ? SUIT.capeSelf : SUIT.self, o !== cape); // (a rim on the cloth sheet washes it out)
    });
    inkCharacter(this.model.root, { skip: [cape] }); // outlines (materials are already comic)
    this.model.root.position.y = -0.9 * POSE.scale; // her body's middle on the pivot
    this.pivot.add(this.model.root);
    this.model.play('fly', { fade: 0 });
    return true;
  }

  /**
   * h = the overworld hero; ground = height (world units) of whatever is under her; patrol 0..1;
   * boost = boosting (the cape whips harder).
   */
  update(h, dt, t, diving, ground, patrol = 0, boost = false) {
    this.group.position.set(h.x * M, h.z * M, h.y * M);
    // heading: her forward (+z model) along (cos ang, sin ang) in the x/z plane
    this.group.rotation.set(0, Math.PI / 2 - h.ang, 0);
    // Flying vs hovering is her own blend, not the flight model's hover (which only drops below
    // ~55 m/s): any real forward motion lays her out horizontal; only near a standstill does she
    // stand upright in the air. It falls back slowly, so a bump off a tower doesn't stand her up.
    const want = h.perch || diving ? 0 : smooth(POSE.flyFrom, POSE.flyFull, h.speed);
    this.flyK = this.flyK === undefined ? want : this.flyK + (want - this.flyK) * Math.min(1, dt * (want > this.flyK ? 6 : 1.6));
    const fk = this.flyK, hover = !h.perch && !diving && fk < 0.3;
    const pitch = h.perch || hover ? -h.lean * 0.2 : diving ? -0.9 : (1 - fk) * POSE.slowPitch - h.lean * 0.25;
    this.pitch = this.pitch === undefined ? pitch : this.pitch + (pitch - this.pitch) * Math.min(1, dt * 7);
    this.pivot.rotation.set(-this.pitch, 0, h.perch ? 0 : h.bank * POSE.bankK);
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
    else if (diving) m.play('jump', { fade: 0.2 });
    else m.play('fly', { fade: 0.3 });
    m.update(dt);
    const fly = h.perch || diving || hover ? 0 : fk;
    if (fly > 0) m.superFly(fly);
    if (fly > 0.05) this.trailLegs(fly * POSE.legs, t);
    // the cape: a living ribbon, streaming straighter and fluttering faster with airspeed
    const v = h.speed * M, whip = boost ? 1.8 : 1, f = 5 + v / 25;
    const air = 7 + v / 16;
    m.setWind(Math.sin(t * f) * (1.2 + v / 90) * whip, 10.5 * (1 - 0.75 * fly) + Math.sin(t * f * 1.37 + 1) * (v / 120) * whip, -air * whip);
  }

  /** Straight legs streaming out behind her (a hint of scissor so they don't fuse into one). */
  trailLegs(k, t) {
    const m = this.model, q = m.root.getWorldQuaternion(this._q);
    const fwd = this._f.set(0, 0, 1).applyQuaternion(q), sky = this._s.set(0, 1, 0).applyQuaternion(q);
    const side = this._o.set(1, 0, 0).applyQuaternion(q);
    for (const [L, sgn] of [['Left', 1], ['Right', -1]]) {
      const d = this._d.copy(fwd).negate().addScaledVector(sky, -0.1 + 0.04 * sgn * Math.sin(t * 3)).addScaledVector(side, 0.07 * sgn).normalize();
      m.aim(`${L}UpLeg`, `${L}Leg`, d, k);
      m.aim(`${L}Leg`, `${L}Foot`, d, k);
    }
  }
}
