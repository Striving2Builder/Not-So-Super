// The hall of mirrors' hunters (docs/design/act2.md "The cult"): Supergurl's acolytes in red robes and
// gold masks. Each is a Kell (src/hotel/kell.js, run one after another through the factory's crewMethods)
// with a dart of Super Squirt: patrol the gallery, see her, charge, fire. Mixed into MirrorsZone.prototype
// after crewMethods (these override its factory-specific parts).
import * as THREE from 'three';
import { crewMethods } from '../factory/crew.js';
import { quality } from '../settings.js';
import { GN, ANTE } from './plan.js';

const HIGH_LINES = {
  spot: ['There you are, little copy.', 'She said you\'d come.', 'Hold still. The glass loves you.', 'Kneel, and be shown which one you are.'],
  miss: ['The mirrors will find you for me.', 'Every glass on this floor is ours.', 'You can\'t hide from your own face.'],
  hunt: ['Check the glass. She always stops to look.', 'Sisters: the dressing rooms.', 'Supergurl wants her awake for it.'],
};
const ACOLYTE_LINES = {
  spot: ['The fake one! Here!', 'For Supergurl!', 'In the glass! She\'s right there!'],
  miss: ['Which one was she?', 'She went into the mirrors…', 'Sister, I saw two of her.'],
  hunt: ['Look behind the frames.', 'Mind the wet tiles.', 'Show yourself, impostor.'],
};

export const cultMethods = {
  /** The hall graph: the lobby, the gallery's two lanes, the antechamber. */
  buildCrewGraph() {
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    const nodes = [], add = (p, rect) => { const n = { p, rect, nb: [] }; nodes.push(n); return n; };
    const link = (a, b) => { a.nb.push(b); b.nb.push(a); };
    const lobby = add(V(0, 3), 'lobby');
    let prev = [add(V(-0.9, -1), 'gallery'), add(V(0.9, -1), 'gallery')];
    link(lobby, prev[0]); link(lobby, prev[1]); link(prev[0], prev[1]);
    for (let z = -7; z > GN; z -= 6) {
      const row = [add(V(-0.9, z), 'gallery'), add(V(0.9, z), 'gallery')];
      link(prev[0], row[0]); link(prev[1], row[1]); link(row[0], row[1]);
      prev = row;
    }
    const mid = add(V(0, ANTE.z1 - 3), 'ante'), l = add(V(-3, ANTE.z1 - 4), 'ante'), r = add(V(3, ANTE.z1 - 4), 'ante');
    link(prev[0], mid); link(prev[1], mid); link(mid, l); link(mid, r);
    this.kellNodes = nodes;
  },

  /** The High Acolyte (by the sealed door) and her acolytes in the gallery; fewer on a saver phone. */
  placeCrew() {
    this.buildCrewGraph();
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    const n = quality().look3d === 'min' ? 1 : 2;
    const mk = (at, high) => {
      const k = crewMethods.makeHunter.call(this, 'guard', at);
      Object.assign(k, high ? { name: 'The High Acolyte', speaker: 'HIGH ACOLYTE', lines: HIGH_LINES, pace: 1 } : { name: 'An acolyte', speaker: 'ACOLYTE', lines: ACOLYTE_LINES, pace: 1.1 });
      if (high) k.mesh.scale.setScalar(1.08);
      return k;
    };
    this.hunters = [mk(V(0, ANTE.z1 - 3), true), ...[V(0.9, -19), V(-0.9, -31)].slice(0, n).map((p) => mk(p, false))];
    this.kell = this.hunters[0];
    this.workers = [];
  },

  crewStatus() {
    const ks = this.hunters || [];
    if (ks.some((k) => k.stun <= 0 && k.state === 'charge')) return '⚠ A DART GUN IS CHARGING';
    if (ks.some((k) => k.stun <= 0 && k.state === 'hunt')) return 'The cult is hunting you';
    return ks.every((k) => k.stun > 0) ? 'The acolytes are down' : 'Red robes in the gallery';
  },
};
