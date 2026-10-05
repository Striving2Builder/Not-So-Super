// Renders the crowd's dancers from the game's own rigged models + Mixamo clips as solid ink
// silhouettes: one row per (body, clip), FRAMES frames over the clip's best-looping stretch.
// Result → window.__out = { png (data URL), meta } for tools/nightclub/dancers.js to save.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { loadHero, heroRig } from '/src/hero3d.js';
import { loadEnemies, Enemy } from '/src/enemies.js';
import { stripModelCape } from '/src/cape.js';

const FW = 112, FH = 180, FRAMES = 16, SS = 2;      // cell, frames per loop, supersampling
const SPAN = 2.15;                                   // metres in the frame's height (feet at the bottom)
const TYPES = [
  ['hero', 'supergirl', 'dance'], ['hero', 'hero_ponytail', 'dance'], ['hero', 'hero_classic', 'happyIdle'],
  ['hero', 'supergirl', 'happyIdle'], ['hero', 'supergirl', 'excited'], ['enemy', 'riddler', 'dance'],
  ['enemy', 'riddler', 'excited'], ['enemy', 'riddler', 'happyIdle'],
];

const L = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('/vendor/three/addons/libs/draco/gltf/'));

/** A posable body: { root, mixer, action, clip }. */
async function body(kind, name, clipName) {
  if (kind === 'enemy') {
    const e = new Enemy(name);
    e.play(clipName, { fade: 0 });
    const action = e.actions[clipName];
    return { root: e.model, mixer: e.mixer, action, clip: action.getClip() };
  }
  const g = await L.loadAsync(`/assets/models/${name}.glb`);
  g.scene.traverse((o) => { if (o.isMesh && /cape/i.test(o.name)) o.visible = false; if (o.isSkinnedMesh) stripModelCape(o); }); // the game's own cape strip
  const clip = heroRig().clips[clipName];
  const mixer = new THREE.AnimationMixer(g.scene);
  const action = mixer.clipAction(clip); action.play();
  return { root: g.scene, mixer, action, clip };
}

function pose(b, t) {
  b.action.time = t; b.mixer.update(0);
  b.root.updateMatrixWorld(true);
  const v = [];
  b.root.traverse((o) => { if (o.isBone) v.push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w); });
  return v;
}

/** The stretch [t0, t0 + len) whose end pose best matches its start (1.4–2.8 s), so the loop doesn't pop. */
function bestLoop(b) {
  const D = b.clip.duration, fps = 30, n = Math.floor(D * fps);
  const P = []; for (let i = 0; i < n; i++) P.push(pose(b, i / fps));
  let best = { cost: Infinity, i: 0, j: Math.min(n - 1, 60) };
  for (let i = 0; i < n; i += 2) for (let j = i + 42; j <= Math.min(n - 1, i + 84); j++) {
    let c = 0; const a = P[i], z = P[j];
    for (let q = 0; q < a.length; q += 4) c += 1 - Math.abs(a[q] * z[q] + a[q + 1] * z[q + 1] + a[q + 2] * z[q + 2] + a[q + 3] * z[q + 3]);
    if (c < best.cost) best = { cost: c, i, j };
  }
  return { t0: best.i / fps, len: (best.j - best.i) / fps, cost: +best.cost.toFixed(3) };
}

(async () => {
  try {
    await loadHero(); await loadEnemies();
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(FW * SS, FH * SS); r.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0x05040a, side: THREE.DoubleSide });
    const cam = new THREE.OrthographicCamera(-SPAN * FW / FH / 2, SPAN * FW / FH / 2, SPAN - 0.05, -0.05, 0.1, 50);
    cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0);
    const atlas = document.createElement('canvas');
    atlas.width = FW * FRAMES; atlas.height = FH * TYPES.length;
    const ax = atlas.getContext('2d');
    const meta = { fw: FW, fh: FH, frames: FRAMES, types: [] };
    for (let row = 0; row < TYPES.length; row++) {
      const [kind, name, clipName] = TYPES[row];
      const b = await body(kind, name, clipName);
      const loop = bestLoop(b);
      // normalise height to ~1.75 m (± a little per body) and stand on the frame's floor
      pose(b, loop.t0);
      const box = new THREE.Box3().setFromObject(b.root), h = box.max.y - box.min.y;
      const holder = new THREE.Group(); holder.add(b.root);
      holder.scale.setScalar((1.75 * (0.96 + 0.08 * ((row * 37) % 5) / 4)) / h);
      holder.rotation.y = 0.35;
      scene.add(holder);
      for (let f = 0; f < FRAMES; f++) {
        pose(b, loop.t0 + (f / FRAMES) * loop.len);
        holder.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(holder);
        holder.position.y -= bb.min.y; holder.position.x -= (bb.min.x + bb.max.x) / 2; // feet on the floor, body centred
        r.render(scene, cam);
        ax.drawImage(r.domElement, f * FW, row * FH, FW, FH);
        holder.position.set(0, 0, 0);
      }
      scene.remove(holder);
      meta.types.push({ body: name, clip: clipName, dur: +loop.len.toFixed(3), loopCost: loop.cost });
    }
    window.__out = { png: atlas.toDataURL('image/png'), meta };
  } catch (e) { window.__out = { error: String(e.stack || e) }; }
})();
