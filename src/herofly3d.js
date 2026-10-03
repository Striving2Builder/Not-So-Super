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
import { inkCharacter, comic, gradMap } from './look3d.js';
import { HERO_LAYER } from './heropass3d.js';
import { M } from './city3d.js';
import { FlightCape, CAPE_LIGHT } from './capefly3d.js';
import { FlightPose } from './heropose3d.js';

const POSE = {
  scale: 1.5,       // model metres → scene metres (heroic: she's the star of the shot)
  bankK: 0.85,      // roll per unit of the flight model's bank (≈50° at a hard turn: her side shows)
  flyFrom: 14, flyFull: 70, // speed (world units/s) where her horizontal flying pose starts / is full
  slowPitch: 0.45,  // head-up tilt (rad) while flying slowly
  arch: 0.35,       // cruise: chest lifted (spine aimed this much toward the sky)
  divePitch: 1.15,  // head-first dive angle (rad)
  legs: 0.95,       // how hard the legs straighten and trail (0..1)
  boot: 0.72,       // boot (foot bone) scale
  patrolScale: 18,  // in the overhead patrol view she becomes a big inked map figure
  shadow: 0x05060f,
};
/** Costume read: saturation, self-light (fraction of albedo), cyan-white rim (only the silhouette). */
const SUIT = { sat: 1.45, self: 0.32, rim: [0.62, 0.95, 1.0], rimK: [1.3, 2.4], rimEdge: [0.82, 0.92] }; // rimK: open sky / against dark walls; rimEdge: its fresnel band
/** Her hair: the model's fur-textured strands (this UV rect of the atlas) become a flat blonde mass. */
const HAIR = { uv: [0.0, 0.58, 0.6, 1.0], lit: [0.92, 0.66, 0.2], mid: [0.72, 0.42, 0.08], shade: [0.36, 0.16, 0.035], cut: [0.3, 0.55] }; // (linear colours; cut: light-band thresholds mid / lit)
/**
 * Her silhouette keyline (CSS px, drawn by her sharp pass round body + cape as one shape): ink width
 * in open sky → against a dark or busy background (night, the street canyons, the map below the
 * patrol view); a pale halo outside it at night, so the dark ink still separates her from dark walls.
 */
const LINE = { ink: [1.3, 2.3], halo: 1.4 };
/** Rim strength, shared by her materials (raised in the dark street canyons). */
export const RIM = { value: SUIT.rimK[0] };
export const RIM_K = SUIT.rimK;
/** Her own cel material for one source material (not the zones' shared cache: these are pushed). */
function suitMaterial(src, self, rim = true) {
  const m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: gradMap(3),
    transparent: !!src.transparent && (src.opacity ?? 1) < 0.99, opacity: src.opacity ?? 1, alphaTest: src.alphaTest || 0, side: src.side ?? THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.suitRim = RIM; sh.uniforms.suitKey = CAPE_LIGHT.key;
    const H = HAIR.uv.map((v) => v.toFixed(3));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float suitRim; uniform vec3 suitKey;')
      .replace('#include <map_fragment>', `#include <map_fragment>
float hairK = 0.0;
#ifdef USE_MAP
{ // the hair strands (orange-brown texels in their atlas rect): one flat blonde, lit by the cel bands
  vec2 hu = vMapUv; vec3 t = diffuseColor.rgb;
  float inRect = step(${H[0]}, hu.x) * step(hu.x, ${H[2]}) * step(${H[1]}, hu.y) * step(hu.y, ${H[3]});
  hairK = inRect * step(t.b * 1.25, t.r) * step(t.b, t.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${HAIR.lit.join(', ')}), hairK);
}
#endif
{ float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, ${SUIT.sat.toFixed(2)}), 0.0); }`)
      // a back-light rim on the true silhouette (her outline separates from the city behind her):
      // strongest on the edges turned away from the key light, and along her top
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(2)};
${rim ? `{ float rf = 1.0 - abs(dot(normal, normalize(vViewPosition)));
  vec2 kd = (viewMatrix * vec4(suitKey, 0.0)).xy; kd = kd / max(1e-3, length(kd));
  vec2 ns = normal.xy / max(1e-3, length(normal.xy));
  float rd = max(smoothstep(-0.2, 0.5, normal.y), smoothstep(-0.2, 0.6, -dot(ns, kd)));
  totalEmissiveRadiance += vec3(${SUIT.rim.join(', ')}) * suitRim * (1.0 - 0.75 * hairK) * smoothstep(${SUIT.rimEdge.join(', ')}, rf) * rd; }` : ''}`)
      // hair: three hard cel tones from the light band, and the underside (facing the ground) always
      // in the darkest, so her head reads as one solid shape rather than strands
      .replace('#include <opaque_fragment>', `{ float hl = dot(outgoingLight, vec3(0.333)) / 0.85;
  float under = smoothstep(-0.05, -0.35, (vec4(normal, 0.0) * viewMatrix).y);
  float tone = step(${HAIR.cut[0]}, hl) + step(${HAIR.cut[1]}, hl);
  tone = min(tone, 2.0 * (1.0 - under));
  vec3 hc = tone > 1.5 ? vec3(${HAIR.lit.join(', ')}) : tone > 0.5 ? vec3(${HAIR.mid.join(', ')}) : vec3(${HAIR.shade.join(', ')});
  outgoingLight = mix(outgoingLight, hc, hairK); }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `suit${self}${rim}`;
  return comic(m, { halftone: 0 });
}


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
