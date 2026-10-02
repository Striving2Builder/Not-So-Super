// Supergirl in the three.js flight slice: the real rigged HeroModel (crisp at any distance, cel +
// ink like the 3D zones), posed from the flight state in three clear silhouettes: CRUISE (one fist
// forward, chest up, legs together trailing), BOOST (both fists forward, legs locked together) and
// DIVE (head-first, both fists down); upright hover only near a standstill; rolling into turns.
// Her cape is a ribbon (a short chain that streams behind her and ripples harder with speed),
// inked on both edges so it reads as a shape, not cloth noise. Her costume gets its own materials:
// pushed saturation, a little self-light and a cyan-white rim, so her red reads against a red
// dusk sky and a night city alike; plus an inked contact shadow on the street or roof below her.
import * as THREE from 'three';
import { HeroModel, heroReady } from './hero3d.js';
import { inkCharacter, comic, gradMap } from './look3d.js';
import { HERO_LAYER } from './heropass3d.js';
import { M } from './city3d.js';

const POSE = {
  scale: 1.5,       // model metres → scene metres (heroic: she's the star of the shot)
  bankK: 0.85,      // roll per unit of the flight model's bank (≈50° at a hard turn: her side shows)
  flyFrom: 14, flyFull: 70, // speed (world units/s) where her horizontal flying pose starts / is full
  slowPitch: 0.45,  // head-up tilt (rad) while flying slowly
  arch: 0.35,       // cruise: chest lifted (spine aimed this much toward the sky)
  divePitch: 1.15,  // head-first dive angle (rad)
  legs: 0.95,       // how hard the legs straighten and trail (0..1)
  patrolScale: 16,  // in the overhead patrol view she becomes a big inked map figure
  shadow: 0x05060f,
};
/** Costume read: saturation, self-light (fraction of albedo), cyan-white rim (only the silhouette). */
const SUIT = { sat: 1.45, self: 0.32, rim: [0.62, 0.95, 1.0], rimK: 1.3 };
/** Ribbon cape: segments, segment length / widths at the shoulders and hem (m, × her scale). */
const CAPE = { segs: 8, len: 0.18, w: [0.16, 0.29], ink: 0.04, color: 0xd0141f, fold: 0x8a0a14 };

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
      // a thin rim on the true silhouette edge, from the upper side (limbs seen end-on would
      // otherwise light up all over)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(2)};
${rim ? `{ float rf = 1.0 - abs(dot(normal, normalize(vViewPosition)));
  float rd = smoothstep(-0.2, 0.5, dot(normal, vec3(0.0, 1.0, 0.0)));
  totalEmissiveRadiance += vec3(${SUIT.rim.join(', ')}) * ${SUIT.rimK.toFixed(2)} * smoothstep(0.8, 0.9, rf) * rd; }` : ''}`);
  };
  m.customProgramCacheKey = () => `suit${self}${rim}`;
  return comic(m, { halftone: 0 });
}

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/** The ribbon cape: a chain from her shoulders, drawn as a red strip over a slightly wider ink strip. */
class RibbonCape {
  constructor(scene) {
    const n = CAPE.segs + 1;
    this.p = Array.from({ length: n }, () => new THREE.Vector3());
    this.placed = false;
    const strip = (mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const idx = [];
      for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false; mesh.layers.set(HERO_LAYER);
      scene.add(mesh);
      return mesh;
    };
    this.ink = strip(new THREE.MeshBasicMaterial({ color: 0x0b0b16, side: THREE.DoubleSide }));
    // flat comic red, shading from one edge to the other (vertex colours) so it reads as a curved sheet
    this.cloth = strip(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const col = new Float32Array(n * 2 * 3), a = new THREE.Color(CAPE.color), b = new THREE.Color(CAPE.fold);
    for (let i = 0; i < n * 2; i++) { const c = i % 2 ? b : a; col.set([c.r, c.g, c.b], i * 3); }
    this.cloth.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._t = new THREE.Vector3(); this._a = new THREE.Vector3();
  }

  /** anchor: world point on her upper back; back/up/side: her body axes (unit); v: airspeed m/s. */
  update(anchor, back, up, side, v, t, dt, size, whip) {
    const n = this.p.length, L = CAPE.len * POSE.scale * size;
    const sk = Math.min(1, v / 60), f = 4 + v / 18, amp = (0.12 + 0.5 * sk) * whip * L;
    if (!this.placed) { this.placed = true; for (let i = 0; i < n; i++) this.p[i].copy(anchor).addScaledVector(back, i * L); }
    this.p[0].copy(anchor);
    for (let i = 1; i < n; i++) {
      const k = i / (n - 1);
      // streams back along her body, ripples (a wave running down it, bigger toward the hem),
      // and droops under gravity when she's slow
      const tgt = this._t.copy(this.p[i - 1]).addScaledVector(back, L * (0.3 + 0.7 * sk))
        .addScaledVector(up, Math.sin(t * f - i * 0.95) * amp * k)
        .addScaledVector(side, Math.sin(t * f * 0.63 - i * 0.7) * amp * 0.35 * k);
      tgt.y -= L * (1 - sk) * 0.9;
      this.p[i].lerp(tgt, Math.min(1, dt * (8 + v / 6)));
      // keep the segment length
      const d = this._a.subVectors(this.p[i], this.p[i - 1]), len = d.length() || 1;
      this.p[i].copy(this.p[i - 1]).addScaledVector(d, L / len);
    }
    for (const [mesh, extra] of [[this.ink, CAPE.ink], [this.cloth, 0]]) {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < n; i++) {
        const w = ((CAPE.w[0] + (CAPE.w[1] - CAPE.w[0]) * (i / (n - 1))) * POSE.scale + extra) * size, q = this.p[i];
        // the ink strip also runs a little past the hem
        const tail = extra && i === n - 1 ? this._a.subVectors(q, this.p[i - 1]).normalize().multiplyScalar(extra * size) : null;
        const x = q.x + (tail ? tail.x : 0), y = q.y + (tail ? tail.y : 0), z = q.z + (tail ? tail.z : 0);
        pos.setXYZ(i * 2, x + side.x * w, y + side.y * w, z + side.z * w);
        pos.setXYZ(i * 2 + 1, x - side.x * w, y - side.y * w, z - side.z * w);
      }
      pos.needsUpdate = true;
    }
  }

  set visible(v) { this.ink.visible = this.cloth.visible = v; }
}

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
    this.cape = new RibbonCape(scene);
    this.cape.visible = false;
    this._f = new THREE.Vector3(); this._s = new THREE.Vector3(); this._o = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._d = new THREE.Vector3();
    this._l = new THREE.Vector3(); this._r = new THREE.Vector3();
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
    // Flying vs hovering is her own blend, not the flight model's hover (which only drops below
    // ~55 m/s): any real forward motion lays her out horizontal; only near a standstill does she
    // stand upright in the air. It falls back slowly, so a bump off a tower doesn't stand her up.
    // (in the raised patrol view she glides over the map rather than standing in the sky)
    const want = h.perch ? 0 : diving ? 1 : Math.max(smooth(POSE.flyFrom, POSE.flyFull, h.speed), patrol > 0.5 ? 0.85 : 0);
    this.flyK = this.flyK === undefined ? want : this.flyK + (want - this.flyK) * Math.min(1, dt * (want > this.flyK ? 6 : 1.6));
    this.boostK = (this.boostK || 0) + ((boost || diving ? 1 : 0) - (this.boostK || 0)) * Math.min(1, dt * 6);
    const fk = this.flyK, hover = !h.perch && !diving && fk < 0.3;
    const pitch = h.perch || hover ? -h.lean * 0.2 : diving ? -POSE.divePitch : (1 - fk) * POSE.slowPitch - h.lean * 0.25;
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
    else m.play('fly', { fade: 0.3 });
    m.update(dt);
    const fly = h.perch || hover ? 0 : fk;
    if (fly > 0) this.flyPose(fly, this.boostK, t);
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
    this.cape.update(anchor, back, out, side, h.speed * M, t, dt, this.size, boost ? 1.7 : 1);
  }

  /**
   * The flying silhouette: cruise = right fist forward, left arm tucked, chest lifted; boost (and
   * dive) = both fists forward. Legs straight and together, trailing.
   */
  flyPose(k, bk, t) {
    const m = this.model;
    m.superFly(k * (1 - bk));
    const q = m.root.getWorldQuaternion(this._q);
    const fwd = this._f.set(0, 0, 1).applyQuaternion(q), sky = this._s.set(0, 1, 0).applyQuaternion(q), side = this._o.set(1, 0, 0).applyQuaternion(q);
    if (bk > 0.02) for (const [L, sgn] of [['Left', 1], ['Right', -1]]) {
      const d = this._d.copy(fwd).addScaledVector(sky, 0.04).addScaledVector(side, 0.05 * sgn).normalize();
      m.aim(`${L}Arm`, `${L}ForeArm`, d, k * bk);
      m.aim(`${L}ForeArm`, `${L}Hand`, d, k * bk);
    }
    // chest up (an arch through the spine) at cruise; flat and streamlined at boost
    const arch = POSE.arch * (1 - bk);
    if (arch > 0.01) m.aim('Spine1', 'Spine2', this._d.copy(fwd).addScaledVector(sky, arch).normalize(), 0.6 * k);
    for (const [L, sgn] of [['Left', 1], ['Right', -1]]) {
      const d = this._d.copy(fwd).negate().addScaledVector(sky, -0.12 * (1 - bk) + 0.015 * sgn * Math.sin(t * 3) * (1 - bk)).addScaledVector(side, 0.025 * sgn * (1 - bk)).normalize();
      m.aim(`${L}UpLeg`, `${L}Leg`, d, k * POSE.legs);
      m.aim(`${L}Leg`, `${L}Foot`, d, k * POSE.legs);
    }
  }
}
