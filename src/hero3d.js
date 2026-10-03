// The rigged Supergirl model (Mixamo skeleton) + retargeted animation clips.
// - HeroModel: an animated instance you can drop into any Three.js scene (3D special zones).
// - HeroSprite: renders the model offscreen so the 2D canvas modes (flight, brawler, newspaper)
//   can draw the real character as a sprite.
// Everything degrades gracefully: until (or unless) the assets load, the procedural art is used.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { Cape, stripModelCape } from './cape.js';
import { settings, HERO_SKINS } from './settings.js';
import { renderToCanvas } from './offscreen3d.js';

// Her costume: the pause-menu choice, or ?hero=classic|ponytail (same rig and atlas layout, so the
// clips, the cape and the flight shaders work on every variant).
const HERO_FILES = { supergirl: 'supergirl.glb', classic: 'hero_classic.glb', ponytail: 'hero_ponytail.glb' };
const qHero = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hero') : null;
export const HERO_SKIN = HERO_SKINS.includes(qHero) ? qHero : settings.hero;
const MODEL_URL = 'assets/models/' + HERO_FILES[HERO_SKIN];
const ANIMS_URL = 'assets/models/supergirl_anims.glb';

// Clips that should repeat; everything else plays once and holds its last frame.
const LOOPS = new Set(['idle', 'combatIdle', 'happyIdle', 'run', 'jog', 'walk', 'drunkWalk', 'fly', 'excited', 'dance']);

const asset = { scene: null, clips: {}, ready: false, failed: false };
let loading = null;

export function loadHero() {
  if (loading) return loading;
  const L = new GLTFLoader();
  loading = Promise.all([L.loadAsync(MODEL_URL), L.loadAsync(ANIMS_URL)])
    .then(([model, anims]) => {
      asset.scene = model.scene;
      for (const c of anims.animations) asset.clips[c.name] = c;
      asset.scene.traverse((o) => {
        if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material.side = THREE.DoubleSide; }
        if (o.isSkinnedMesh) stripModelCape(o); // replaced by the simulated cloth cape
      });
      asset.ready = true;
      return true;
    })
    .catch((e) => { console.warn('Supergirl model failed to load; using procedural art.', e); asset.failed = true; return false; });
  return loading;
}

export const heroReady = () => asset.ready;

/** The loaded rig (rest-pose scene + clips by name), for retargeting her clips onto other characters. */
export const heroRig = () => (asset.ready ? { scene: asset.scene, clips: asset.clips, loops: LOOPS } : null);

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();

export class HeroModel {
  constructor() {
    this.root = clone(asset.scene);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    this.cur = null;
    this.curName = null;
    this.bones = {};
    let mat = null;
    this.root.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace('mixamorig', '')] = o;
      if (o.isSkinnedMesh) mat = o.material;
    });
    this.cape = new Cape(this.root, this.bones, mat);
  }

  /** Relative wind on the cape, in her own frame: +z is the way she faces (so -z streams behind). */
  setWind(x, y, z) { this.cape.wind.set(x, y, z); }

  /**
   * Classic superhero flight: right fist punched out ahead, left arm tucked along her side.
   * Layered on top of whatever the flying clip is doing with the rest of the body.
   */
  superFly(amount = 1) {
    const b = this.bones;
    if (!b.LeftArm || !b.RightArm) return;
    this.root.updateWorldMatrix(true, true);
    const q = this.root.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);          // flight direction (head-first)
    const L = b.LeftArm.getWorldPosition(new THREE.Vector3()), R = b.RightArm.getWorldPosition(new THREE.Vector3());
    const out = L.clone().sub(R).normalize();                            // towards her left side
    const sky = new THREE.Vector3(0, 1, 0).applyQuaternion(q);          // her back faces the sky when flying
    const reach = fwd.clone().addScaledVector(sky, 0.08).addScaledVector(out, -0.05).normalize();
    this.aim('RightArm', 'RightForeArm', reach, amount);
    this.aim('RightForeArm', 'RightHand', reach, amount);
    // Tucked arm angles a little away from her side so it isn't hidden under the cape from above.
    const tuck = fwd.clone().negate().addScaledVector(out, 0.38).addScaledVector(sky, -0.12).normalize();
    this.aim('LeftArm', 'LeftForeArm', tuck, amount);
    const fore = fwd.clone().negate().addScaledVector(out, 0.12).addScaledVector(sky, -0.22).normalize();
    this.aim('LeftForeArm', 'LeftHand', fore, amount);
  }

  action(name) {
    let a = this.actions[name];
    if (!a) {
      const clip = asset.clips[name];
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      if (!LOOPS.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[name] = a;
    }
    return a;
  }

  /** Cross-fade to a clip (no-op if it's already playing, unless restart). */
  play(name, { fade = 0.2, speed = 1, restart = false, from = 0 } = {}) {
    const a = this.action(name);
    if (!a) return null;
    a.timeScale = speed;
    if (this.cur === a && !restart) return a;
    a.reset();
    if (from) a.time = from; // start part-way in (e.g. one strike out of a longer combo clip)
    a.enabled = true;
    a.setEffectiveWeight(1);
    a.play();
    if (this.cur && this.cur !== a && fade > 0) a.crossFadeFrom(this.cur, fade, false);
    else if (this.cur && this.cur !== a) this.cur.stop();
    this.cur = a;
    this.curName = name;
    return a;
  }

  /** Snap to an exact frame of a clip (used for deterministic 2D sprites). */
  pose(name, time) {
    const a = this.action(name);
    if (!a) return;
    if (this.cur !== a) {
      this.mixer.stopAllAction();
      a.reset(); a.play();
      this.cur = a; this.curName = name;
    }
    const d = a.getClip().duration;
    a.time = LOOPS.has(name) ? ((time % d) + d) % d : Math.min(Math.max(time, 0), d - 1e-3);
    this.mixer.update(0);
  }

  update(dt) {
    this.mixer.update(dt);
    this.cape.step(Math.min(dt, 1 / 20));
    this.cape.last = performance.now();
  }

  /** Rotate `bone` so that the direction to `child` points along worldDir (blend 0..1). */
  aim(boneName, childName, worldDir, blend = 1) {
    const b = this.bones[boneName], c = this.bones[childName];
    if (!b || !c) return;
    b.updateWorldMatrix(true, true);
    b.getWorldPosition(_v1);
    c.getWorldPosition(_v2);
    const cur = _v2.sub(_v1).normalize();
    _q.setFromUnitVectors(cur, worldDir);
    if (blend < 1) _q.slerp(new THREE.Quaternion(), 1 - blend);
    b.parent.getWorldQuaternion(_pq);
    // local' = parentWorld^-1 * q * parentWorld * local
    const inv = _pq.clone().invert();
    b.quaternion.premultiply(_pq).premultiply(_q).premultiply(inv);
    b.updateWorldMatrix(false, true);
  }

  /** Procedural straight punch layered on top of the current animation. side: 'Right' | 'Left'. */
  punch(side, amount) {
    if (amount <= 0) return;
    this.root.updateWorldMatrix(true, true);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    const dir = fwd.clone().add(new THREE.Vector3(0, 0.12, 0)).normalize();
    this.aim(`${side}Arm`, `${side}ForeArm`, dir, amount);
    this.aim(`${side}ForeArm`, `${side}Hand`, dir, amount);
  }
}

/** Offscreen renderer that turns the 3D heroine into a 2D sprite. */
export class HeroSprite {
  /** Rendered by the shared offscreen renderer (offscreen3d.js) into this sprite's own 2D canvas. */
  constructor(w = 256, h = 256) {
    this.canvas = document.createElement('canvas');
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 1.2);
    rim.position.set(-3, 2, -4);
    this.scene.add(rim);
    this.hero = new HeroModel();
    this.pivot = new THREE.Group();
    this.pivot.add(this.hero.root);
    this.scene.add(this.pivot);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    this.setSize(w, h);
  }

  setSize(w, h) {
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h;
  }

  /**
   * view 'side': character stands on the bottom edge; frame spans `span` metres tall.
   * view 'top':  camera straight down, heading = +x on the sprite.
   * yaw rotates the character about the vertical axis (side view: PI/2 faces right).
   */
  /** roll = bank about her forward axis; pitch > 0 lifts her head (upright hover). Radians.
   *  view 'aerial': three-quarter from above, tilted `tilt` rad from vertical; yaw = PI/2 - heading. */
  render({ view = 'side', yaw = Math.PI / 2, span = 2.6, lift = 0.12, roll = 0, pitch = 0, tilt = 0.6 } = {}) {
    const a = this.w / this.h;
    const c = this.cam;
    this.pivot.rotation.set(-pitch, yaw, roll, 'XYZ');
    if (view === 'aerial') {
      // Three-quarter view from above and behind the screen's bottom edge (matching the flight
      // camera's oblique lean): she keeps visible volume, so flying north reads as flying away,
      // not as a figure standing up. yaw = heading (world); roll/pitch are in her own frame.
      this.pivot.rotation.set(-pitch, yaw, roll, 'YXZ');
      const half = span / 2;
      c.left = -half * a; c.right = half * a; c.top = half; c.bottom = -half;
      c.position.set(0, 20 * Math.cos(tilt), 20 * Math.sin(tilt)); c.up.set(0, 1, 0); c.lookAt(0, 0, 0);
      this.pivot.position.set(0, -0.9, 0); // her body sits ~0.9 m up in the clips: centre it
    } else if (view === 'top') {
      const half = span / 2;
      c.left = -half * a; c.right = half * a; c.top = half; c.bottom = -half;
      c.position.set(0, 20, 0); c.up.set(1, 0, 0); c.lookAt(0, 0, 0);
      this.pivot.position.set(0, 0, -0.1);
    } else {
      // Ortho bounds are relative to the camera, so keep the camera at ground height.
      c.left = -(span * a) / 2; c.right = (span * a) / 2; c.top = span - lift; c.bottom = -lift;
      c.position.set(0, 0, 20); c.up.set(0, 1, 0); c.lookAt(0, 0, 0);
      this.pivot.position.set(0, 0, 0);
    }
    c.updateProjectionMatrix();
    if (!this.still) this.hero.cape.tick(); // cloth advances with real time between sprite frames
    renderToCanvas(this.canvas, this.scene, c, this.w, this.h);
    return this.canvas;
  }
}
