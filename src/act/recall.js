// Recall (docs/design/act2.md "The drug: Super Squirt", job G): the night she lost the suit comes back
// a beat at a time. Memory clues in Act 2's venues (the clubs, the casino, RLD Walks, the asylum) only
// read while she's over the haze line (INTOX_HAZE), like the Hive's highOnly rule; reading one plays a
// flashback: a frame from the hand-checked clips (club3d/clips.js) on the LIVE feed, ink-washed, and the
// next beat's line. Super Squirt stashes (rooftops, the brawler's streets, the 2D investigations) are a
// dose (+intoxication) and sometimes a flashback. State: state.act.act2.night (beats remembered, 0-5).
// Act2 (act2run.js) owns the instance (two.recall); zones reach it through the helpers at the bottom.
import * as THREE from 'three';
import { CLIPS } from '../club3d/clips.js';
import { INTOX_HAZE } from '../state.js';
import { dialog, toast, flash } from '../ui.js';
import { sfx } from '../sfx.js';
import { LOT } from '../city.js';
import { DISTRICTS } from '../data.js';
import { pick, dist, chance, rand } from '../util.js';
import { laneBusy } from '../moments/frame.js';

/** The night she lost the suit (act2.md), in the order it comes back. */
export const NIGHT = [
  { id: 'spin', name: 'The room spinning', clip: 'high',
    text: 'The High-Roller Suite\'s grand opening, and the after-party at the Gilded Cage. Chandeliers going round and round, the floor tilting under her boots, everyone laughing a beat too late.' },
  { id: 'vip', name: 'The lounge and the VIP area', clip: 'high',
    text: 'A glass in the lounge she didn\'t order. Then the VIP rope lifting for her, a silver tray going round, pink pills in a dish. <i>"Super Squirt, sweetheart. On the house."</i>' },
  { id: 'dark', name: 'The dark room', clip: 'high',
    text: 'A hand on her arm, steering her through a curtain into the dark room. The bass through the wall. Somebody saying her name like a joke. Then nothing at all.' },
  { id: 'rld', name: 'Waking up in the red-light district', clip: 'captive',
    text: 'Red light on a bare floor. A crop top and a skirt that aren\'t hers, cut to look like her suit. Her own suit gone, cape and all.' },
  { id: 'tape', name: 'The Polaroids and the note', clip: 'captive',
    text: 'Polaroids all round her on the floor, every one of them her. And a note in block capitals: <b>WE HAVE THE TAPE.</b> Do as you\'re told, or the whole city sees it.' },
];

/** The 2D investigations' bait in Act 2 (investigate.js trap item; its plain drawing is a dish of pink pills). */
export const STASH_ITEM = { name: 'A Stash of Super Squirt', desc: 'A dish of pink pills behind the evidence, the cult\'s little joke: <em>"Super Squirt."</em> One would bring the haze back… and maybe the night with it.', intox: 18, perk: 'none', squirt: true };

export const RECALL = {
  dose: 18,            // +intoxication for a stash of Super Squirt
  stashFlash: 0.45,    // chance a stash brings a beat back (once she's over the haze line after the dose)
  roofEvery: [50, 80], // s between rooftop stashes on the map (one at a time)
  roofTtl: 90,         // s before an untaken rooftop stash is gone
  roofNear: 320,       // world units: perch this close to take it
  feedAfter: 5,        // s the flashback's clip stays on the LIVE feed after the card closes
  color: '#ff5fd0', glyph: '💊',
};
const SOBER = [
  'Something about it tugs at her. Sober, it slides away. (Over the haze line it might come back.)',
  'Familiar. Why is it familiar? Clear-headed, she can\'t hold on to it.',
  'It means something. Not now, not like this: she\'d have to be high to remember.',
];

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `#feed.recall video,#feed.recall img{filter:grayscale(1) contrast(1.7) brightness(1.08) sepia(.35)}
#feed.recall .feed-live{color:#e8e0cc}
.modal-back.recall-fb .modal{background:radial-gradient(ellipse at 40% 30%,#f4efe2,#d8d0bc 70%,#b8ae98);color:#16120e;border:3px solid #111;box-shadow:6px 6px 0 rgba(0,0,0,.55),inset 0 0 40px rgba(40,30,20,.35);font-family:Georgia,serif;max-width:min(92vw,520px)}
.modal-back.recall-fb h2{font:400 26px Bangers,Impact,sans-serif;letter-spacing:.06em;color:#111;text-shadow:2px 2px 0 rgba(0,0,0,.18);animation:rc-shake .18s steps(2) infinite}
.modal-back.recall-fb .dtext{font-style:italic;font-size:15px;line-height:1.45}
.modal-back.recall-fb .dtext small{display:block;margin-top:8px;font:700 12px sans-serif;font-style:normal;letter-spacing:.04em;color:#4a3f30}
.modal-back.recall-fb .opt{background:#16120e;color:#f4efe2}
#recall-wash{position:fixed;inset:0;z-index:55;pointer-events:none;background:radial-gradient(ellipse at center,rgba(240,232,214,.05) 20%,rgba(30,24,18,.85) 100%);mix-blend-mode:multiply;animation:rc-wash 1.8s ease-out forwards}
@keyframes rc-wash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes rc-shake{0%{transform:translate(0,0)}50%{transform:translate(1px,-1px) rotate(-.4deg)}}`;
  document.head.appendChild(s);
}

export class Recall {
  constructor(two) {
    this.two = two;
    this.g = two.g;
    this.roofT = rand(20, 35);
    this.feedT = null;
    this.busy = false;
  }

  get B() { return this.two.B; }
  on() { return this.two.on(); }
  /** Beats remembered (0-5). */
  get n() { return Math.min(NIGHT.length, this.B?.night || 0); }
  high() { return this.g.state.intox >= INTOX_HAZE; }

  /** The act board's line: "The night: 2/5 remembered" and the beats got back. */
  boardLine() {
    if (!this.B) return '';
    const got = NIGHT.slice(0, this.n).map((b) => b.name).join(' · ');
    return `<br><small>The night: <b>${this.n}/${NIGHT.length}</b> remembered${got ? ` · ${got}` : ' · read memory clues over the haze line'}</small>`;
  }

  /** The next beat comes back: the LIVE feed (ink-washed clip) and the ink-wash card. False if all's back. */
  async flashback(where = '') {
    const B = this.B;
    if (!B || this.busy) return false;
    if (this.n >= NIGHT.length) { toast('It\'s all back now. Nothing new in it, just the same night again.', 'info'); return false; }
    this.busy = true;
    const beat = NIGHT[this.n];
    B.night = this.n + 1;
    this.g.state.save();
    style();
    sfx.whoosh?.();
    flash('#e8e0cc');
    const wash = document.createElement('div'); wash.id = 'recall-wash';
    document.body.appendChild(wash);
    setTimeout(() => wash.remove(), 1900);
    this.feed(beat);
    try {
      await dialog({
        title: `FLASHBACK · ${B.night}/${NIGHT.length}`, cls: 'recall-fb',
        text: `<b>${beat.name}.</b> ${beat.text}<small>${where ? `${where} brought it back. ` : ''}The night: ${B.night}/${NIGHT.length} remembered (on the act board).</small>`,
        options: [{ label: B.night >= NIGHT.length ? 'It\'s all back.' : 'It\'s coming back…', value: true }],
      });
    } finally {
      this.busy = false;
      this.unfeed(RECALL.feedAfter);
    }
    if (B.night >= NIGHT.length) toast('The whole night is back: the Gilded Cage, the pills, the dark room, the tape.', 'good');
    return true;
  }

  /** A hand-checked clip on the LIVE feed, ink-washed (setList/play like the cage dance; the feed itself untouched). */
  feed(beat) {
    const f = this.g.overworld?.feed;
    if (!f?.panel) return;
    const list = beat.clip === 'high' ? CLIPS.high : CLIPS.captive;
    if (!list.length) return;
    clearTimeout(this.feedT);
    f.setList('recall', list);
    f.stop();
    f.panel.classList.add('recall');
    if (!f.play('recall', `FLASHBACK · ${beat.name}`, true)) f.panel.classList.remove('recall');
  }
  unfeed(secs) {
    const f = this.g.overworld?.feed;
    if (!f?.panel) return;
    clearTimeout(this.feedT);
    this.feedT = setTimeout(() => { f.panel.classList.remove('recall'); if (f.playing?.cat === 'recall') f.stop(); }, secs * 1000);
  }

  /** A memory clue read: over the haze line, a flashback; sober, it slips away. True if a beat came back. */
  async memory(where = '') {
    if (!this.on()) return false;
    if (!this.high()) { sfx.lose?.(); toast(pick(SOBER), 'info'); return false; }
    return this.flashback(where);
  }

  /** A stash of Super Squirt taken: a dose, and sometimes a flashback (`flash`: force it on/off). */
  async stash(where = 'A stash', { flash: force, dose = RECALL.dose } = {}) {
    if (!this.on()) return false;
    const st = this.g.state;
    if (dose) { st.addIntox(dose); sfx.drink?.(); toast(`${RECALL.glyph} Super Squirt · +${dose} intoxication`, 'bad'); } // (dose 0: the caller dosed her already)
    const go = force ?? (this.high() && this.n < NIGHT.length && chance(RECALL.stashFlash));
    return go ? this.flashback(where) : false;
  }

  // ---------------------------------------------------------------- rooftop stashes (flight)
  /** Per frame in the sky (Act2.update): one stash on a rooftop at a time; perch near it to take it. */
  update(dt, ow) {
    if (ow.attract || this.B?.opening !== 'done') return;
    const z = ow.zones.find((q) => q.actDive === 'stash');
    if (z) {
      if (ow.hero.perch && dist(z.x, z.y, ow.hero.x, ow.hero.y) < RECALL.roofNear) this.diveStash(ow, z);
      return;
    }
    if ((this.roofT -= dt) > 0) return;
    this.roofT = rand(...RECALL.roofEvery);
    this.spawnStash(ow);
  }

  /** A rooftop she can perch on, 500-1300 units from her, with a stash on it (a map marker). */
  spawnStash(ow) {
    const h = ow.hero, city = this.g.city;
    const free = (x, y) => ow.zones.every((q) => dist(q.x, q.y, x, y) > 300);
    const blocks = city.blocks.filter((b) => !b.river);
    let at = null;
    for (let i = 0; i < 16 && !at; i++) {
      const b = pick(blocks);
      if (!b) break;
      const x = b.x0 + LOT / 2, y = b.y0 + LOT / 2, d = dist(x, y, h.x, h.y);
      if (d < 500 || d > 1300 || !free(x, y)) continue;
      const bd = ow.buildingAt?.(x, y);
      if (bd && ow.hOf(bd) >= 35) at = { x, y, district: b.d };
    }
    if (!at) return null;
    const z = {
      uid: ow.uid++, t: 0, kind: 'stash', stash: true, actDive: 'stash', x: at.x, y: at.y, district: at.district, ttl: RECALL.roofTtl,
      name: 'A stash on a rooftop', color: RECALL.color, glyph: RECALL.glyph, risk: 'Super Squirt', reward: 0, lockKey: 'Stashes',
      blurb: 'Pink pills taped under a water tank. Perch on the roof (or DIVE) to take them: they might bring the night back.',
    };
    ow.zones.push(z);
    if (!laneBusy()) toast(`${RECALL.glyph} A stash of Super Squirt on a rooftop${DISTRICTS[at.district] ? ` in ${DISTRICTS[at.district].name}` : ''}. Perch there to take it.`, 'info');
    return z;
  }

  /** DIVE on the stash (or perched by it): take it. */
  async diveStash(ow, z) {
    if (this.busy) return;
    ow.removeZone(z);
    await this.stash('A rooftop stash');
  }

  // ---------------------------------------------------------------- memory clues in the 3D venues
  /**
   * A memory clue on the floor of a 3D zone (any Special3D: Club3D, the casino, RldWalk, the asylum):
   * a lipstick-stained glass and a spilled-drink stain, a shimmer round it over the haze line. USE
   * near it: memory(where). One read per clue (it stays readable until it gives a beat back).
   */
  placeClue(zone, pos, where, what = 'A lipstick-stained glass') {
    if (!pos || !this.on()) return null;
    const S = zone.scene, x = pos.x, z = pos.z;
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshBasicMaterial({ color: 0x5a1020, transparent: true, opacity: 0.55, depthWrite: false }));
    stain.rotation.x = -Math.PI / 2; stain.position.y = 0.02;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    glass.position.set(0.12, 0.1, 0.05); glass.rotation.z = Math.PI / 2.4;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 4, 10), new THREE.MeshBasicMaterial({ color: 0xc0306a }));
    lip.position.set(0.21, 0.13, 0.05); lip.rotation.y = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 28), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
    grp.add(stain, glass, lip, ring);
    S.add(grp);
    const C = { done: false, grp, where };
    const self = this;
    const o = zone.addInter(new THREE.Vector3(x, 0, z), what, () => !C.done && !zone.busy, async () => { if (await self.memory(where)) { C.done = true; ring.visible = false; } }, 'clue');
    Object.defineProperty(o, 'label', { get: () => (self.high() ? `Remember: ${what.toLowerCase()}` : `${what} (it means something…)`), set() {}, configurable: true }); // (set: the Hive's highOnly relabels every USE spot)
    o.recall = C;
    zone.anims?.push((t) => { const hi = !C.done && self.high(); ring.material.opacity = hi ? 0.35 + 0.3 * Math.sin(t * 4) : 0; ring.scale.setScalar(hi ? 1 + 0.12 * Math.sin(t * 2.2) : 1); });
    return C;
  }
}

// ------------------------------------------------------------------ helpers for the zones (no-ops in Act 1)
/** The live Recall (Act 2 running), or null. */
export function recallOf(g) { const two = g?.act?.two; return two?.on?.() && two.recall ? two.recall : null; }
/** A memory clue at `pos` in a 3D zone (Act 2 only). */
export function memoryClue(zone, pos, where, what) { return recallOf(zone.g)?.placeClue(zone, pos, where, what) || null; }
/** The stain on a real piece read (Which one is hers?, the casino tables): a memory clue if she's high. */
export async function stainRead(g, where) { const R = recallOf(g); return R && R.high() ? R.memory(where) : false; }
/** A stash of Super Squirt taken in a zone (the brawler's streets, the investigations). */
export async function stashTaken(g, where, opts) { const R = recallOf(g); return R ? R.stash(where, opts) : false; }
