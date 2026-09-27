// Enemy characters for the 3D zones: downloaded models made web-ready by tools/export_enemy.py
// (assets/models/enemies/). Rigged ones share the Mixamo skeleton, so they borrow Supergirl's
// clips (walk, combatIdle, fallFlat…) retargeted to their own rest pose; static ones stand posed
// and tip over when beaten. Until they've loaded, the zones fall back to the procedural NPCs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { heroRig, loadHero } from './hero3d.js';
import { pick } from './util.js';

const DIR = 'assets/models/enemies/';
// rigged: Mixamo bones, animated with Supergirl's clips. Static: one posed mesh.
const MODELS = {
  police: { rigged: true }, robber: { rigged: true }, riddler: { rigged: true },
  diva: {}, leather: {}, punk_girl: {}, hooded_thug: {}, alchemist: {}, blood_priest: {},
};

// Guards are crooks in stripes and cops on the villain's payroll.
export const GUARD_KINDS = ['robber', 'robber', 'police'];
// Each named boss always gets the same look; anyone else draws from the pool.
const BOSS_KINDS = {
  'Mister Midas': 'riddler', 'The Ringmaster': 'riddler', 'Professor Puppet': 'alchemist', 'Doctor Dollar': 'alchemist',
  'Count Cashflow': 'blood_priest', 'Baron Blackmail': 'hooded_thug', 'The Chairman': 'hooded_thug',
  'Madame Mesmer': 'diva', 'Lady Lullaby': 'diva', 'The Velvet Viper': 'leather', 'Silk Sinclair': 'leather', 'Queen Venom': 'punk_girl',
};
export const bossKind = (name) => BOSS_KINDS[name] || pick(['riddler', 'alchemist', 'blood_priest', 'hooded_thug', 'diva', 'leather', 'punk_girl']);

const templates = {}; // kind → { scene, clips: {name: retargeted clip} | null }
let loading = null;

export function loadEnemies() {
  if (loading) return loading;
  const L = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/gltf/'));
  loading = loadHero().then(() => Promise.all(Object.entries(MODELS).map(([kind, def]) => L.loadAsync(DIR + kind + '.glb')
    .then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
      templates[kind] = { scene: g.scene, rigged: !!def.rigged && !!heroRig(), clips: {} };
    })
    .catch((e) => console.warn(`Enemy model "${kind}" failed to load; using procedural art.`, e)))));
  return loading;
}

export const enemyReady = (kind) => !!templates[kind];

// ---------------------------------------------------------------- retargeting
// Both skeletons are Mixamo T-poses, but bone rest orientations differ between exports (the
// Riddler's hips carry no -90° X, Supergirl's do). Per bone, with rest-pose world rotations:
//   target local = inv(targetParent) · sourceParent · sourceLocal · inv(sourceBone) · targetBone
// Hips translation is carried over as a world-space offset, scaled by hip height.
function restOf(root) {
  root.updateMatrixWorld(true);
  const m = new Map();
  root.traverse((o) => {
    if (!o.isBone) return;
    m.set(o.name, {
      w: o.getWorldQuaternion(new THREE.Quaternion()), p: o.parent.getWorldQuaternion(new THREE.Quaternion()),
      pm: o.parent.matrixWorld.clone(), pos: o.position.clone(), wpos: o.getWorldPosition(new THREE.Vector3()),
    });
  });
  return m;
}

let srcRest = null;
function retargeted(t, name) {
  if (name in t.clips) return t.clips[name];
  const rig = heroRig(), src = rig && rig.clips[name];
  if (!src) return (t.clips[name] = null);
  srcRest = srcRest || restOf(rig.scene);
  const dst = t.rest || (t.rest = restOf(t.scene));
  const S = srcRest.get('mixamorigHips'), T = dst.get('mixamorigHips');
  const k = S && T ? T.wpos.y / S.wpos.y : 1;
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), c = src.clone();
  c.tracks = c.tracks.filter((tr) => {
    const [bone, prop] = tr.name.split('.');
    const s = srcRest.get(bone), d = dst.get(bone);
    if (!s || !d) return false;
    if (prop === 'quaternion') {
      const A = d.p.clone().invert().multiply(s.p), B = s.w.clone().invert().multiply(d.w);
      for (let i = 0; i < tr.values.length; i += 4) q.fromArray(tr.values, i).premultiply(A).multiply(B).toArray(tr.values, i);
      return true;
    }
    if (prop === 'position' && bone === 'mixamorigHips') {
      const inv = d.pm.clone().invert(), srest = s.pos.clone().applyMatrix4(s.pm);
      for (let i = 0; i < tr.values.length; i += 3) {
        v.fromArray(tr.values, i).applyMatrix4(s.pm).sub(srest).multiplyScalar(k).add(d.wpos).applyMatrix4(inv).toArray(tr.values, i);
      }
      return true;
    }
    return false;
  });
  return (t.clips[name] = c);
}

// ---------------------------------------------------------------- instances
/**
 * A character in a zone. `root` stands in for a procedural NPC: position/rotation it the same way,
 * add children to it (vision cones), and it carries dummy `legs`/`arms` so the old limb-swing code
 * is harmless. Call update(dt) every frame.
 */
export class Enemy {
  constructor(kind, scale = 1) {
    const t = templates[kind];
    this.kind = kind;
    this.t = t;
    this.model = t.rigged ? clone(t.scene) : t.scene.clone();
    this.model.scale.setScalar(scale);
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ'; // topple (x) in her own frame, after the facing (y)
    this.root.add(this.model);
    this.root.legs = [new THREE.Object3D(), new THREE.Object3D()];
    this.root.arms = [new THREE.Object3D(), new THREE.Object3D()];
    this.root.enemy = this;
    this.mixer = t.rigged ? new THREE.AnimationMixer(this.model) : null;
    this.actions = {};
    this.cur = null;
    this.down = false;
    if (this.mixer) this.play('idle', { fade: 0 });
  }

  get rigged() { return !!this.mixer; }

  play(name, { fade = 0.25, speed = 1 } = {}) {
    if (!this.mixer) return;
    let a = this.actions[name];
    if (!a) {
      const clip = retargeted(this.t, name);
      if (!clip) return;
      a = this.actions[name] = this.mixer.clipAction(clip);
      if (!heroRig().loops.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      a.time = Math.random() * clip.duration * 0.5; // patrols out of step with each other
    }
    a.timeScale = speed;
    if (this.cur === a) return;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.play();
    if (this.cur) { if (fade > 0) a.crossFadeFrom(this.cur, fade, false); else this.cur.stop(); }
    this.cur = a;
  }

  /** Knocked out / defeated: a falling clip on rigged models, a stiff topple on static ones. */
  knockDown() {
    if (this.down) return;
    this.down = true;
    this.floorY = this.root.position.y;
    if (this.rigged) this.play('fallFlat', { fade: 0.1 });
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    else if (this.down && this.root.rotation.x > -Math.PI / 2) {
      // backwards, pivoting on the heels; lifted a little so the body lies on the floor, not in it
      this.root.rotation.x = Math.max(-Math.PI / 2, this.root.rotation.x - dt * 4.5);
      this.root.position.y = this.floorY + 0.18 * (-this.root.rotation.x / (Math.PI / 2));
    }
  }
}
