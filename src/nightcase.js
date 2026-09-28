// Night cases: detective work inside the premade 3D clubs after dark.
// Built from the club engine's building blocks (ClubZone) plus the shared case logic (CaseFile):
// search clue objects, X-ray sealed containers, question a witness or free a captive who saw it,
// photograph evidence, dodge bouncers/temptations/bait, then accuse from the suspect board.
// The club's informant is part of the night "information network": tips unlock new leads.
import * as THREE from 'three';
import { ClubZone } from './clubzone.js';
import { CaseFile } from './casefile.js';
import { unlockLead } from './leads.js';
import { NIGHT_CASES, NIGHT_JOBS, WITNESS_MOODS, VENUES } from './data.js';
import { pick, chance, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { npcLook, portrait } from './art.js';
import { sfx } from './sfx.js';
import { quality } from './settings.js';
import { NightScan } from './nightscan.js';
import { randomPerson } from './casefile.js';

const CONTAINERS = ['Locked Cash Box', 'Staff Locker', 'Sealed Crate', 'Floor Safe', 'DJ Flight Case'];

/** Zone fields for a night case on the map (the overworld supplies position/district). */
export function nightCaseFields() {
  const themeKey = pick(Object.keys(NIGHT_CASES));
  const venue = pick(Object.keys(VENUES).filter((v) => VENUES[v].club));
  const th = NIGHT_CASES[themeKey];
  return {
    mode: 'nightcase', venue, theme: themeKey, def: { crime: th.crime }, name: `${th.name} at ${/^The /.test(venue) ? venue : 'the ' + venue}`,
    reward: 30, lockKey: venue, ttl: 240, color: '#b36bff', glyph: '?', risk: 'Night · traps',
    blurb: `After-hours investigation into ${th.crime}. Informants here can tip you off to more cases.`,
  };
}

export class NightCase extends ClubZone {
  themeFor(zone) { return NIGHT_CASES[zone.theme]; }

  /** Who works the floor here, in dialog text ("bouncer" in clubs; the asylum says "orderly"). */
  get staff() { return 'bouncer'; }
  get Staff() { return this.staff[0].toUpperCase() + this.staff.slice(1); }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'xray', label: 'X-RAY', key: 'X' },
      { id: 'accuse', label: 'SUSPECTS', key: 'Q', slot: 2 },
      { id: 'notes', label: 'NOTES', key: 'N', slot: 3 },
      { id: 'punch', label: 'PUNCH', key: 'F', slot: 4 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>${this.Staff} alert</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    banner('NIGHT CASE', `${this.zone.venue} · ${this.theme.name}`, '#b36bff');
    setTimeout(() => { if (!this.done) toast('Search for clues, photograph them, then open SUSPECTS to accuse. Informants unlock new leads.', 'info'); }, 1600);
  }

  // ------------------------------------------------------------------ layout
  placeClubGameplay() {
    const th = this.theme;
    const nCap = th.captives || 0;
    // Per-case state (the mode object is reused for every night case, so reset everything here).
    this.case = new CaseFile(NIGHT_JOBS, ['visible', 'visible', 'xray', nCap ? 'captive' : 'witness']);
    this.clueObjs = [];
    this.witness = null;
    this.tipGiven = false;
    this.planLayout();
    this.exitRing.visible = false; // the case ends with an accusation, not by walking out
    this.placeInformant('Talk to your informant');
    this.placeGuards(1 + (chance(0.5) ? 1 : 0));
    this.placeItems(3 + (th.extraTemptations || 0), { onTake: () => this.noteUnderDrink() });
    this.placeCaptives(nCap);
    const props = [...th.clueProps];
    for (const c of this.case.byMethod('visible')) this.placeClueObject(c, props.shift() || 'Evidence');
    for (const c of this.case.byMethod('xray')) this.placeContainer(c);
    for (const c of this.case.byMethod('witness')) this.placeWitness(c);
    if (th.chalk) this.placeChalkOutline();
  }

  placeClueObject(clue, name) {
    const p = this.choose((q) => this.far(q) > 6, 5);
    // the evidence itself: a small bagged item catching the light
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.26), new THREE.MeshLambertMaterial({ color: 0xd8c8a0, emissive: 0x3a2a08 }));
    mesh.position.set(p.x - 0.15, p.y + 0.05, p.z); mesh.rotation.y = 0.5;
    this.scene.add(mesh);
    const tent = evidenceTent(); tent.position.set(p.x + 0.3, p.y, p.z + 0.1); tent.rotation.y = -0.4; tent.scale.setScalar(1.8);
    this.scene.add(tent);
    // a soft column of light marks unsearched evidence from across the room
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xffc040, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(p.x, p.y + 1.6, p.z);
    this.scene.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, p.y + 0.03, p.z);
    this.scene.add(ring);
    let shown = 0;
    const saver = quality().id === 'saver'; // additive column = overdraw; skip it on low-end
    this.anims.push((t) => {
      ring.material.opacity = clue.found ? 0.12 : 0.35 + Math.sin(t * 4) * 0.2;
      beam.visible = !clue.found && !saver;
      beam.material.opacity = 0.32 + Math.sin(t * 2.2) * 0.1;
      const n = clue.found ? this.case.num(clue) : 0;
      if (n !== shown) { shown = n; tent.userData.paint(n); }
    });
    const o = { clue, name, pos: new THREE.Vector3(p.x, p.y, p.z) };
    this.clueObjs.push(o);
    this.addClueInteractions(o, () => this.searchClue(o));
  }

  placeContainer(clue) {
    const name = pick(CONTAINERS);
    const p = this.choose((q) => this.far(q) > 8, 5);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.6), new THREE.MeshLambertMaterial({ color: 0x3a3f48 }));
    box.position.set(p.x, p.y + 0.35, p.z);
    this.scene.add(box);
    this.colliders.push({ minX: p.x - 0.4, maxX: p.x + 0.4, minZ: p.z - 0.3, maxZ: p.z + 0.3, mesh: box });
    // detective vision: the container's edges light up cyan, the thing inside glows orange
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x8ff4ff, depthTest: false, transparent: true }));
    edges.position.copy(box.position); edges.renderOrder = 9; edges.visible = false;
    this.scene.add(edges); this.hidden.push(edges);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.2), new THREE.MeshBasicMaterial({ color: 0xffa630, depthTest: false, transparent: true }));
    inner.position.copy(box.position); inner.renderOrder = 10; inner.visible = false;
    this.scene.add(inner); this.hidden.push(inner);
    this.anims.push((t) => { const k = 1 + Math.sin(t * 6) * 0.18; inner.scale.set(k, k, k); inner.rotation.y = t * 1.2; });
    const o = { clue, name, pos: new THREE.Vector3(p.x, p.y, p.z), inner };
    this.clueObjs.push(o);
    this.addClueInteractions(o, () => this.searchContainer(o));
  }

  /** "Search: X" until found, then "Photograph: X" until photographed. */
  addClueInteractions(o, search) {
    const at = new THREE.Vector3(o.pos.x, 0, o.pos.z + 0.9);
    this.addInter(at, `Search: ${o.name}`, () => !o.clue.found, search, 'clue');
    this.addInter(at, `📸 Photograph: ${o.name}`, () => o.clue.found && !o.clue.photo, () => this.photographClue(o), 'photo');
  }

  placeWitness(clue) {
    const look = npcLook('civilian');
    const mesh = this.placeNPC(look, (q) => this.far(q) > 6 && this.onMain(q), 4);
    this.witness = { mesh, look, clue, mood: pick(WITNESS_MOODS), name: randomPerson(), talked: false };
    this.addInter(mesh.position, 'Question the witness', () => !this.witness.talked || this.witness.told, () => this.talkWitness(), 'witness');
  }

  placeChalkOutline() {
    const p = this.choose((q) => this.far(q) > this.maxD * 0.4 && this.near(q, 1.5) >= 7, 4);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineJoin = 'round';
    g.beginPath(); g.arc(128, 48, 24, 0, Math.PI * 2);                         // head
    g.moveTo(112, 72); g.lineTo(60, 110); g.lineTo(40, 150);                  // arm
    g.moveTo(144, 72); g.lineTo(196, 96); g.lineTo(220, 70);                  // arm
    g.moveTo(112, 72); g.lineTo(104, 160); g.lineTo(80, 236);                 // side + leg
    g.moveTo(144, 72); g.lineTo(152, 160); g.lineTo(180, 236);
    g.moveTo(104, 160); g.lineTo(128, 150); g.lineTo(152, 160);
    g.stroke();
    const tex = new THREE.CanvasTexture(c);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    decal.rotation.x = -Math.PI / 2; decal.position.set(p.x, p.y + 0.03, p.z);
    this.scene.add(decal);
  }

  // ------------------------------------------------------------------ interactions
  async revealClue(c, how, at = null) {
    if (!this.case.find(c)) return;
    sfx.pickup();
    const s = this.screenOf(at || this.hero.position, at ? 0.3 : 2);
    if (s) this.g.commentary.hit(s.x, s.y, { big: false });
    await this.case.reveal(c, how, 'Tip: USE it again to photograph it for the Gazette.', s);
  }

  searchClue(o) { return this.revealClue(o.clue, `You examine the ${o.name.toLowerCase()}.`, o.pos); }

  async searchContainer(o) {
    if (!this.xray) {
      await dialog({ title: o.name, text: 'Locked tight. Something inside rattles.<span class="hint">X-ray vision would show you what\'s in there.</span>' });
      return;
    }
    o.inner.visible = false;
    this.hidden = this.hidden.filter((h) => h !== o.inner);
    await this.revealClue(o.clue, `Your X-ray vision spots something hidden inside the ${o.name.toLowerCase()}. You pop it open.`, o.pos);
  }

  async photographClue(o) {
    if (!this.case.photograph(o.clue)) return;
    sfx.shutter(); flash('#fff');
    const s = this.screenOf(o.pos, 0.8);
    if (s) this.g.commentary.hit(s.x, s.y); // cosmetic burst
    toast(`📸 Evidence photo #${this.case.photos} — ${o.name}`, 'good');
  }

  async talkWitness() {
    const w = this.witness;
    if (w.talked) {
      await dialog({ speaker: w.name, portrait: portrait(w.look), text: `"Like I said: ${this.case.text(w.clue).replace(/<\/?b>/g, '')}"` });
      return;
    }
    const v = await dialog({
      speaker: `Witness · ${w.name}`, portrait: portrait(w.look),
      text: `"I saw something tonight. I don't want trouble."<span class="hint">${w.mood.hint}</span>`,
      options: [
        { label: 'Reassure them: "You\'re safe with me."', value: 'reassure' },
        { label: 'Lean in: "Talk. Now."', value: 'intimidate' },
        { label: 'Lay out the facts you already know.', value: 'facts' },
        { label: 'Come back later', value: null },
      ],
    });
    if (!v) return;
    w.talked = true;
    if (v === w.mood.works) {
      w.told = true;
      await this.revealClue(w.clue, `${w.name} leans in and whispers what they saw.`);
    } else {
      sfx.lose();
      this.alert = Math.min(99, this.alert + 20);
      await dialog({ speaker: w.name, text: `"Forget it." They clam up and signal ${/^[aeiou]/.test(this.staff) ? 'an' : 'a'} ${this.staff}.<span class="hint">${this.Staff} alert +20. The other clues may be enough — or check the temptations for notes.</span>` });
    }
  }

  freeClubCaptive(c) {
    super.freeClubCaptive(c);
    const clue = this.case.byMethod('captive').find((k) => !k.found);
    if (clue) this.revealClue(clue, 'Shaking, the captive grabs your arm: "I saw who did this to us!"');
  }

  /** Some drinks hide a note with a clue: the risky shortcut. */
  async noteUnderDrink() {
    if (!chance(0.5)) return;
    // A witness who clammed up can't be asked again, so their clue may turn up in a note instead.
    const w = this.witness, witnessLost = w && w.talked && !w.told;
    const c = this.case.anyUnfound(witnessLost ? ['captive'] : ['witness', 'captive']);
    if (c) await this.revealClue(c, 'A folded note was tucked under the glass.');
  }

  /** The informant is the club's piece of the information network: a tip unlocks a new lead. */
  async talkInformant() {
    const inf = this.informant;
    if (this.tipGiven) {
      await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: '"I gave you what I had. Come back another night."' });
      return;
    }
    const hint = inf.works === 'charm' ? 'They look guilty about something.' : 'They\'re jumpy and eyeing the exits.';
    const v = await dialog({
      speaker: `Informant · ${inf.name}`, portrait: portrait(inf.look),
      text: `"You're working ${this.theme.crime}? I hear things in here after dark… other jobs going down across town."<span class="hint">${hint}</span>`,
      options: [
        { label: '"Let me buy you a drink."', note: '+20 intoxication, guaranteed tip', value: 'drink', cls: 'risky' },
        { label: 'Appeal to their conscience', value: 'charm', disabled: inf.burned },
        { label: 'Pin them against the wall', value: 'press', disabled: inf.burned },
        { label: 'Walk away', value: null },
      ],
    });
    if (!v) return;
    if (v === 'drink') { sfx.drink(); this.g.state.addIntox(20); toast('🥴 Intoxication +20', 'bad'); }
    else if (v !== inf.works) {
      inf.burned = true;
      this.alert = Math.min(99, this.alert + 25);
      sfx.alarm();
      await dialog({ speaker: inf.name, text: '"Not so loud!" A bouncer glances over.<span class="hint">They\'ll only talk over a drink now.</span>' });
      return;
    }
    this.tipGiven = true;
    await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: '"Word is there\'s another job going down tonight. I\'ll mark it on your map."' });
    unlockLead(this.g, 'Informant tip');
  }

  // ------------------------------------------------------------------ detective vision
  setXray(on) {
    super.setXray(on);
    if (this.xray || this.scan) (this.scan || (this.scan = new NightScan(this))).set(this.xray);
  }

  render() {
    super.render();
    if (this.scan) this.scan.draw(this.t);
  }

  exit() {
    if (this.scan) { this.scan.dispose(); this.scan = null; }
    super.exit();
  }

  // ------------------------------------------------------------------ flow
  update(dt) {
    if (!this.done && this.scene && !this.busy) {
      const inp = this.g.input;
      if (inp.pressed('accuse')) this.runBusy(() => this.accuse());
      else if (inp.pressed('notes')) this.runBusy(() => this.case.notes(this.zone.name, 'No clues yet. Search the glowing spots in the club.'));
    }
    super.update(dt);
  }

  runBusy(fn) { this.busy = true; Promise.resolve(fn()).finally(() => { this.busy = false; }); }

  async accuse() {
    const s = await this.case.accuse(this.zone.name);
    if (s) this.finish(s);
  }

  finish(accused) {
    if (this.done) return;
    this.done = true;
    this.setXray(false);
    if (accused.culprit) {
      sfx.win();
      banner('CASE CLOSED!', '', '#3ee08a');
      const freed = this.captives.filter((c) => c.freed).length;
      this.g.state.stats.photos += this.case.photos;
      if (this.g.state.isNight) unlockLead(this.g, 'Solved case');
      // bonus = evidence from untrapped bait items (set by the shared takeItem)
      setTimeout(() => this.g.endZone(this.zone, this.case.winResult(this.zone.reward, freed * 5 + this.bonus)), 1100);
    } else {
      sfx.lose();
      this.g.endZone(this.zone, this.case.loseResult(accused));
    }
  }

  allDone() { return false; }

  objectives() {
    const cf = this.case, found = cf.found.length;
    const nextClue = this.clueObjs.find((o) => !o.clue.found);
    const list = [{ t: `Find clues (${found}/${cf.clues.length})`, done: found === cf.clues.length, target: nextClue && nextClue.pos }];
    const w = this.witness;
    if (w) list.push({ t: w.talked && !w.told ? 'Witness clammed up' : 'Question the witness', done: w.talked, target: w.mesh.position }); // either way, nothing more to do there
    if (this.captives.length) list.push({ t: `Free the captives (${this.captives.filter((c) => c.freed).length}/${this.captives.length})`, done: this.captives.every((c) => c.freed), target: (this.captives.find((c) => !c.freed) || {}).person?.position });
    list.push({ t: 'Get a tip from the informant (new lead)', done: !!this.tipGiven, target: this.informant.mesh.position });
    list.push({ t: `Accuse the culprit — SUSPECTS (${found}/3 clues)`, done: false, final: true, target: null });
    return list;
  }
}

// ------------------------------------------------------------------ evidence art (3D)

/** A yellow A-frame evidence tent; userData.paint(n) writes its marker number ('?' for 0). */
function evidenceTent() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  const paint = (n) => {
    g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#120a16'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
    g.fillStyle = '#120a16'; g.font = '900 40px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(n ? String(n) : '?', 32, 35);
    tex.needsUpdate = true;
  };
  paint(0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  const grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.3), mat);
    face.position.set(0, 0.14, s * 0.06); face.rotation.x = s * 0.4;
    grp.add(face);
  }
  grp.userData.paint = paint;
  return grp;
}

let beamTexture = null;
/** Vertical falloff for the light column: bright at the floor, gone at the top. */
function beamTex() {
  if (beamTexture) return beamTexture;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  beamTexture = new THREE.CanvasTexture(c);
  return beamTexture;
}
