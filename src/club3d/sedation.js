// Getting caught, and what it costs (docs/design/nightclub.md "Sedation", "The envelope").
// Found out on the floor, by a Talker or in the VIP: a sedation clip plays, then she wakes up
// somewhere else in the club (most likely on the VIP couch next to the host), each wake spot its
// own little situation. The third time in one visit she's carried out: the full capture. In the
// back rooms (restroom, dark room, alley) getting caught starts a fight instead. Every moment the
// club catches on camera goes in the owner's envelope (a polaroid of the actual frame).
import { playCutscene } from '../cutscene.js';
import { mediaFolders } from '../media.js';
import { polaroid } from '../nightclub/blackout.js';
import { dialog, toast, qte, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';
import { $, fmtClock } from '../util.js';

export const SEDATION = {
  folders: ['ClubSedation', 'SG_Captured_Game'], // the clip as she goes under (first folder with clips)
  captureAt: 3,                                   // sedations in one visit before she's carried out
  wake: [['vip', 0.45], ['office', 0.2], ['storage', 0.15], ['floor', 0.2]],
};
// how much each kind of card weighs in the owner's hand (the heaviest is played first)
const WEIGHT = { dance: 5, sedated: 4, pill: 3, paparazzi: 3, drunk: 2, fans: 2, couch: 3, photos: 2 };

export const sedationMethods = {
  /**
   * A card for the owner's envelope, with a polaroid: of `src` (a canvas: the dance's own frame) or
   * else of the 3D view's next frame.
   */
  addCard(id, label, src = null) {
    this.envelope = this.envelope || [];
    if (id !== 'sedated' && this.envelope.some((c) => c.id === id)) return;
    const card = { id, label, w: WEIGHT[id] || 1, img: null, time: fmtClock(this.g.state.clock) };
    this.envelope.push(card);
    if (src) card.img = this.snapOf(src, card.time);
    else (this.snapQueue = this.snapQueue || []).push(card);
    this.envHud();
  },

  snapOf(src, time) {
    try {
      const sw = src.width, sh = src.height, c = document.createElement('canvas'), W = 360, H = Math.round(360 * (sh / sw));
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(src, 0, 0, W, H);
      return polaroid(c, time);
    } catch (e) { return null; } // (no frame: the card is text only)
  },

  /** Right after a render of the 3D view: the waiting cards get this frame. */
  afterRender() {
    if (!this.snapQueue?.length) return;
    for (const card of this.snapQueue) card.img = this.snapOf(this.renderer.domElement, card.time);
    this.snapQueue = [];
  },

  envHud() {
    const el = $('c3-env-l');
    if (el) el.querySelector('span').textContent = `His envelope: ${(this.envelope || []).length}`;
  },

  /** Old polaroids of her from earlier visits (left behind in the 2D clubs) are already in his hand. */
  seedEnvelope() {
    const lost = this.g.state.photosLost || 0;
    this.envelope = [];
    if (lost) this.envelope.push({ id: 'photos', label: `${lost} polaroid${lost === 1 ? '' : 's'} of you from another night`, w: WEIGHT.photos, img: null, time: '' });
    this.envHud();
  },

  /** Caught: in the back rooms she fights; anywhere else they sedate her. */
  foundOut(reason) {
    if (this.done || this.sedating) return;
    if (this.room?.brawl && !this.fought?.[this.room.kind]) { this.startBrawl(this.room.kind, { caught: true }); return; }
    this.sedate(reason);
  },

  checkFailures() {
    if (this.alert >= 100) { this.alert = 60; this.foundOut(`The bouncers close in on ${HERO}.`); return true; }
    if (this.g.state.intox >= 99.5) { this.sedate(`${this.caseDef.drugName || 'The drink'} takes her legs out from under her…`, { blackout: true }); return true; }
    return false;
  },

  async sedate(reason, { blackout = false } = {}) {
    if (this.done || this.sedating) return;
    this.sedating = true;
    this.sedations = (this.sedations || 0) + 1;
    this.addCard('sedated', blackout ? `${HERO}, passed out` : `${HERO}, sedated and dragged off`);
    this.setXray(false); this.setHearing(false);
    if (this.sedations >= SEDATION.captureAt) {
      this.done = true;
      this.g.endZone(this.zone, { outcome: 'captured', reason: `${reason} The third time, they don't let her wake up in the club: she's carried out the back.` });
      return;
    }
    this.busy = true;
    if (this.heroModel) this.heroModel.play('defeated', { fade: 0.2 });
    sfx.trap();
    const folders = await mediaFolders();
    const folder = SEDATION.folders.find((f) => (folders[f] || []).length);
    this.music.update(1, true);
    await playCutscene({ folder, caption: `${reason}<br>${blackout ? 'Everything goes dark…' : 'A needle in the neck. Everything goes dark…'}`, maxSecs: 9 });
    await this.wake();
    this.sedating = false;
    this.busy = false;
    const left = SEDATION.captureAt - this.sedations;
    if (left === 1) toast('One more time and they carry you out of here.', 'bad');
  },

  /** Wake up somewhere else: weighted toward the VIP couch; each spot is its own situation. */
  async wake() {
    const st = this.g.state, A = this.roomA;
    const opts = SEDATION.wake.filter(([k]) => k === 'floor' || A[k]);
    let r = Math.random() * opts.reduce((s, [, w]) => s + w, 0), where = opts[0][0];
    for (const [k, w] of opts) { r -= w; if (r <= 0) { where = k; break; } }
    const forced = new URLSearchParams(location.search).get('club3wake');
    if (forced && opts.some(([k]) => k === forced)) where = forced;
    this.alert = 0;
    st.intox = Math.max(35, Math.min(60, st.intox));
    const put = (x, z) => { this.hero.position.set(x, 0, z); this.camSnap = true; this.landT = 1.6; this.heroClip('getUp', 1.6); };
    if (where === 'vip') {
      const h = A.vip.host;
      put(h.x + (this.plan.byKind.vip.side === 'W' ? -1.6 : 1.6), h.z + 1.1);
      this.vipIn = true; this.openDoorOf('vip');
      this.addCard('couch', `${HERO} asleep on the VIP couch`);
      this.quizPenalty = true;
      await dialog({ speaker: this.caseDef.vip?.host || 'The host', text: `You come to on a velvet couch. A man in a white suit is smiling down at you, a camera in his hand. <b>"Morning, sunshine. You came all the way up here. Shall we play?"</b><span class="hint">You're in the VIP. Someone took a polaroid. He'll be harder to convince now.</span>` });
    } else if (where === 'office') {
      const b = A.office.boss;
      put(b.x + 1.2, b.z + 2.6);
      this.officeOpen = true; this.openDoorOf('office');
      await dialog({ speaker: this.caseDef.boss?.name || 'The owner', text: `You wake tied to a chair in the back office. The owner is flicking through polaroids. <b>"Hold still. My best customer deserves a nice picture."</b>` });
      this.addCard('sedated', `${HERO}, tied to a chair in the office`);
      const ok = await qte({ title: 'BREAK FREE!', text: 'The ropes are cheap. Your head is pounding.', label: 'STRAIN!', need: 12, time: 4 });
      this.alert = ok ? 30 : 55;
      toast(ok ? 'The ropes snap. Everyone heard it.' : 'You tear free, loudly. The whole back corridor heard.', ok ? 'info' : 'bad');
    } else if (where === 'storage') {
      put(A.storage.stash.x, A.storage.stash.z + 2);
      this.stockOpen = true;
      await dialog({ text: 'You wake up between beer crates in the stock room, the door locked from outside.<span class="hint">X-ray shows the lock; your shoulder does the rest. Loudly.</span>' });
      this.openDoorOf('storage');
      this.alert = 35;
    } else {
      // a dark corner of the main floor: groggy, higher than ever
      const V = this.plan.V;
      put((Math.random() < 0.5 ? -1 : 1) * (V.hw - 3), -V.hd + 6);
      st.addIntox(15);
      toast('You come to in a dark corner of the dance floor. Your head is swimming.', 'info');
    }
    banner('YOU WAKE UP…', `${SEDATION.captureAt - this.sedations} more and you're carried out`, '#ff3fb8');
  },
};
