// Night cases: detective work on the club engine (ClubZone) plus the shared case logic (CaseFile):
// search clue objects, X-ray sealed containers, question a witness or free a captive who saw it,
// photograph evidence, dodge the staff, temptations and bait, then accuse from the suspect board.
// The informant is part of the night "information network": a tip unlocks a new lead.
// The asylum (asylum.js) lays a case out in its own building. On the map, a night case is a club
// mission after dark (nightCaseFields): it plays the 3D club (src/club3d/).
import * as THREE from 'three';
import { ClubZone } from './clubzone.js';
import { unlockLead } from './leads.js';
import { NIGHT_CASES, VENUES } from './data.js';
import { pick, chance, $ } from './util.js';
import { dialog, toast, banner, flash } from './ui.js';
import { portrait } from './art.js';
import { sfx } from './sfx.js';
import { NightScan } from './nightscan.js';

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
  /** Who works the floor here, in dialog text (the asylum says "orderly"). */
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

  /** "Search: X" until found, then "Photograph: X" until photographed. */
  addClueInteractions(o, search) {
    const at = new THREE.Vector3(o.pos.x, 0, o.pos.z + 0.9);
    this.addInter(at, `Search: ${o.name}`, () => !o.clue.found, search, 'clue');
    this.addInter(at, `📸 Photograph: ${o.name}`, () => o.clue.found && !o.clue.photo, () => this.photographClue(o), 'photo');
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
