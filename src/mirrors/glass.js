// The reflections in the hall of mirrors, faked for phones (docs/polish/handoff/act2-h1.md): no render
// target, no second camera. Behind every mirror's glass the building has a mirrored copy of the gallery
// (plan.js); here her twin stands in it: a clone of her model, posed from hers every frame (bone for
// bone), inside a holder whose matrix reflects it across the glass's plane. The cult's hunters get
// twins too on the full look. A saver phone keeps only the rooms in the glass (no twins).
// Mixed into MirrorsZone.prototype. H2 can reuse `twinOf` to multiply her and the boss in the glass.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { quality } from '../settings.js';
import { GHW } from './plan.js';

/**
 * A mirrored copy of `src` that follows it. `hide` = objects under `src` whose copies stay hidden
 * (a vision cone on the floor). Returns { holder, obj, sync(), at(mirror) }.
 */
export function twinOf(src, hide = []) {
  const obj = clone(src), a = [], b = [];
  src.traverse((o) => a.push(o));
  obj.traverse((o) => b.push(o));
  const off = new Set(hide.map((h) => b[a.indexOf(h)]).filter(Boolean));
  for (const o of b) { o.raycast = () => {}; if (off.has(o)) o.visible = false; }
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.visible = false;
  holder.add(obj);
  let plane = null;
  return {
    holder, obj,
    /** Copy her pose (every bone, every part's transform) onto the twin. */
    sync() {
      for (let i = 0, n = Math.min(a.length, b.length); i < n; i++) {
        const s = a[i], d = b[i];
        d.position.copy(s.position); d.quaternion.copy(s.quaternion); d.scale.copy(s.scale);
        if (!off.has(d)) d.visible = s.visible;
      }
    },
    /** Reflect across mirror `m` (a plane x = m.x), or hide with null. */
    at(m) {
      holder.visible = !!m;
      if (!m || m === plane) return;
      plane = m;
      holder.matrix.set(-1, 0, 0, 2 * m.x, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      holder.matrixWorldNeedsUpdate = true;
    },
  };
}

export const glassMethods = {
  /** The twins (once her model is in): hers on every look but the saver, the hunters' on the full look. */
  setupGlass() {
    this.twins = [];
    const q = quality().look3d;
    if (q === 'min' || !this.hero) return;
    const add = (src, hide) => { const t = twinOf(src, hide); this.scene.add(t.holder); this.twins.push({ src, t }); return t; };
    add(this.hero);
    if (q === 'full') for (const k of this.hunters || []) add(k.mesh, [k.cone]);
  },

  /** The mirror whose glass `p` stands in front of (in the gallery, within the glass's width), or null. */
  mirrorFacing(p) {
    for (const m of this.club.mirrors) {
      const d = (p.x - m.x) * m.n.x;
      if (d > 0.05 && d < GHW * 2 - 0.2 && p.z > m.z0 + 0.4 && p.z < m.z1 - 0.4) return m;
    }
    return null;
  },

  updateGlass() {
    if (!this.twins) this.setupGlass();
    for (const { src, t } of this.twins) {
      const m = src.visible && src.parent ? this.mirrorFacing(src.position) : null;
      t.at(m);
      if (m) t.sync();
    }
  },
};
