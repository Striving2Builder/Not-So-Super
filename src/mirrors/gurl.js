// Supergurl (job H2; the user's reference: docs/references/user/act2-cult-leader.jpg): the cult's leader in
// Supergirl's stolen original suit. A clone of the hero's classic model (supergirl.glb, its own mixer) with a
// procedural long black coat, red braided cord on the left shoulder, a black hood, a glossy red mask and black
// riding boots on top, each piece riding a bone. reveal() takes the coat, hood and mask off: the suit (and a
// lipstick kiss on the left of the S) underneath. Reflections of her (decoys) are twins (glass.js twinOf)
// mirrored across vertical planes through the room's centre: everything on them is backwards (the tell).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HeroModel, heroReady, loadSkin, skinScene, HERO_COMIC } from '../hero3d.js';
import { dressHero, inkHull } from '../herolook3d.js';
import { inkCharacter, toon } from '../look3d.js';
import { twinOf } from './glass.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    coat: toon(0x141016, { side: THREE.DoubleSide }, { halftone: 0.25 }),
    boot: new THREE.MeshPhongMaterial({ color: 0x0a0a0c, shininess: 90, specular: 0x8888aa }),
    mask: new THREE.MeshPhongMaterial({ color: 0xb0101c, shininess: 140, specular: 0xffffff, emissive: 0x2a0004 }),
    eyes: new THREE.MeshBasicMaterial({ color: 0x050002 }),
    cord: toon(0xd0182a, {}, { halftone: 0 }),
    stain: new THREE.MeshBasicMaterial({ map: kissTex(), transparent: true, depthWrite: false, toneMapped: false }),
  };
  return mats;
}

/** A lipstick kiss (the stain on the S: the content line's lipstick). */
function kissTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(232,20,90,.9)';
  for (const [y, r] of [[26, 1], [38, -1]]) { g.beginPath(); g.ellipse(32, y, 22, 9, 0, r > 0 ? Math.PI : 0, r > 0 ? Math.PI * 2 : Math.PI); g.fill(); }
  g.fillStyle = 'rgba(232,20,90,.5)'; g.fillRect(12, 30, 40, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Supergurl, or null if the hero's model isn't in (the caller stands in a plain figure). */
export async function makeGurl() {
  if (!heroReady()) return null;
  await loadSkin('supergirl');
  const model = new HeroModel(skinScene('supergirl') || null);
  if (HERO_COMIC) {
    dressHero(model.root, { self: 0.12, rim: { value: 0.9 } }, [model.cape.mesh]);
    inkHull(inkCharacter(model.root, { rim: 0xffc0d0, skip: [model.cape.mesh] }));
    inkCharacter(model.cape.mesh, { rim: 0xffc0d0, outline: false });
  }
  const group = new THREE.Group();
  group.add(model.root);
  const { coat, stain } = dressCoat(model);
  return new Gurl(group, model, coat, stain);
}

/** The coat, hood, mask, cord and boots, built in the rest pose in world space, then attached to bones. */
function dressCoat(model) {
  const M = materials(), b = model.bones, root = model.root, coat = [];
  root.updateMatrixWorld(true);
  const W = (bone) => bone.getWorldPosition(new THREE.Vector3());
  const put = (bone, geo, mat, at, q = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(at); if (q) m.quaternion.copy(q);
    m.frustumCulled = false; m.raycast = () => {};
    root.add(m); m.updateMatrixWorld(true);
    bone.attach(m);
    return m;
  };
  /** A tapered tube from `bone` toward `child` (from..to of the way), radii in metres. */
  const limb = (bone, child, r0, r1, from, to, mat) => {
    const a = W(bone), c = W(child), dir = c.clone().sub(a), L = dir.length();
    dir.normalize();
    const geo = new THREE.CylinderGeometry(r1, r0, L * (to - from), 10, 1, true);
    const at = a.clone().addScaledVector(dir, L * (from + to) / 2);
    return put(bone, geo, mat, at, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir));
  };
  const hips = W(b.Hips), neck = W(b.Neck), head = W(b.Head), sh = W(b.LeftShoulder);
  // the coat: chest to hips on the spine, the long skirt from the hips to mid-calf, the sleeves
  const torsoH = neck.y - hips.y - 0.02;
  const torso = new THREE.CylinderGeometry(0.17, 0.165, torsoH, 12, 1, true); torso.scale(1.18, 1, 0.82);
  coat.push(put(b.Spine1 || b.Spine, torso, M.coat, V(hips.x, hips.y + torsoH / 2 + 0.02, hips.z)));
  const skirtH = hips.y - 0.32;
  const skirt = new THREE.CylinderGeometry(0.2, 0.33, skirtH, 14, 1, true); skirt.scale(1.1, 1, 0.85);
  coat.push(put(b.Hips, skirt, M.coat, V(hips.x, hips.y - skirtH / 2 + 0.06, hips.z)));
  for (const s of ['Left', 'Right']) {
    coat.push(limb(b[`${s}Arm`], b[`${s}ForeArm`], 0.075, 0.065, -0.05, 1, M.coat));
    coat.push(limb(b[`${s}ForeArm`], b[`${s}Hand`], 0.066, 0.07, 0, 0.95, M.coat));
  }
  // the hood, the drape over the shoulders, the mask (and its eyes)
  const hood = new THREE.SphereGeometry(0.135, 14, 10); hood.scale(1, 1.18, 1.08);
  coat.push(put(b.Head, hood, M.coat, V(head.x, head.y + 0.08, head.z - 0.025)));
  coat.push(put(b.Neck, new THREE.CylinderGeometry(0.12, 0.2, 0.16, 12, 1, true), M.coat, V(neck.x, neck.y + 0.0, neck.z - 0.01)));
  const mask = new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, 0, Math.PI); mask.scale(0.82, 1.1, 0.6);
  coat.push(put(b.Head, mask, M.mask, V(head.x, head.y + 0.08, head.z + 0.085)));
  const eye = (x) => new THREE.BoxGeometry(0.034, 0.011, 0.02).translate(x, 0, 0);
  coat.push(put(b.Head, mergeGeometries([eye(-0.033), eye(0.033)]), M.eyes, V(head.x, head.y + 0.105, head.z + 0.142)));
  // the red braided cord on her LEFT shoulder (+x: the model faces +z), draped across the chest
  const cord = new THREE.CatmullRomCurve3([V(sh.x + 0.06, sh.y + 0.05, sh.z), V(sh.x + 0.03, sh.y + 0.0, sh.z + 0.11), V(sh.x - 0.03, sh.y - 0.12, sh.z + 0.14), V(sh.x - 0.07, sh.y - 0.22, sh.z + 0.13), V(sh.x - 0.02, sh.y - 0.26, sh.z + 0.135), V(sh.x + 0.05, sh.y - 0.14, sh.z + 0.13)]);
  coat.push(put(b.Spine2 || b.Spine1, new THREE.TubeGeometry(cord, 24, 0.017, 6, false), M.cord, V(0, 0, 0)));
  coat.push(put(b.LeftShoulder, new THREE.BoxGeometry(0.14, 0.03, 0.1), M.cord, V(sh.x + 0.07, sh.y + 0.06, sh.z)));
  // black riding boots (they stay on)
  for (const s of ['Left', 'Right']) {
    limb(b[`${s}Leg`], b[`${s}Foot`], 0.062, 0.056, 0.22, 1.02, M.boot);
    if (b[`${s}ToeBase`]) limb(b[`${s}Foot`], b[`${s}ToeBase`], 0.055, 0.05, -0.1, 1.15, M.boot);
  }
  // the stain: a lipstick kiss on the left of the S (shows once the coat is off)
  const chest = W(b.Spine2 || b.Spine1);
  const stain = put(b.Spine2 || b.Spine1, new THREE.PlaneGeometry(0.075, 0.075), M.stain, V(chest.x + 0.065, chest.y + 0.03, chest.z + 0.125));
  return { coat, stain };
}

export class Gurl {
  constructor(group, model, coat, stain) {
    Object.assign(this, { group, model, coat, stain, coatOn: true, dropped: [] });
    if (model) model.cape.mesh.visible = false; // (under the coat)
    if (stain) stain.visible = false;
  }
  get pos() { return this.group.position; }
  play(name, o) { this.model?.play(name, o); }
  update(dt) { this.model?.update(dt); }

  /** The coat, hood and mask off: they land on the floor beside her. */
  reveal(scene) {
    if (!this.coatOn) return;
    this.coatOn = false;
    for (const m of this.coat) m.visible = false;
    if (this.model) this.model.cape.mesh.visible = true;
    if (this.stain) this.stain.visible = true;
    const M = materials(), p = this.pos;
    const heap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.12, 12), M.coat);
    heap.scale.set(1.3, 1, 0.8); heap.position.set(p.x + 0.9, 0.06, p.z + 0.3); heap.rotation.y = 0.6;
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.mask);
    mask.scale.set(0.82, 0.6, 1.1); mask.rotation.x = -Math.PI / 2; mask.position.set(p.x - 0.8, 0.04, p.z + 0.6);
    scene.add(heap, mask);
    this.dropped.push(heap, mask);
  }
}

/** A twin of `src` (twinOf) mirrored across the vertical plane through `c` with normal angle `th`. */
export function reflection(src, c, th) {
  const t = twinOf(src);
  setPlane(t, c, th);
  return t;
}
export function setPlane(t, c, th) {
  const nx = Math.cos(th), nz = Math.sin(th), d = 2 * (c.x * nx + c.z * nz);
  t.holder.matrix.set(1 - 2 * nx * nx, 0, -2 * nx * nz, d * nx, 0, 1, 0, 0, -2 * nx * nz, 0, 1 - 2 * nz * nz, d * nz, 0, 0, 0, 1);
  t.holder.matrixWorldNeedsUpdate = true;
  t.holder.visible = true;
  t.th = th;
}
/** Where a twin across plane `th` through `c` stands when `p` stands at p. */
export function reflectPoint(p, c, th) {
  const nx = Math.cos(th), nz = Math.sin(th), k = 2 * ((p.x - c.x) * nx + (p.z - c.z) * nz);
  return new THREE.Vector3(p.x - k * nx, p.y, p.z - k * nz);
}
