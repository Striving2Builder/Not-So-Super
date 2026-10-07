// Fights in the club's back rooms (docs/design/nightclub.md "Brawls"): the restroom (close
// quarters, the dealer in the last stall), the dark room (strobe light: fighting half blind) and
// the alley (the courier's run). The side-scroll brawler runs inside the club (the game's own
// brawler mode, borrowed: the club's 3D scene waits underneath) on a painted room, and hands the
// result back. Caught in one of these rooms, she fights instead of being sedated; losing is a
// double loss: the reputation, and the full capture.
import { dialog, toast, banner } from '../ui.js';
import { HERO } from '../data.js';
import { $ } from '../util.js';

export const FIGHTS = {
  restroom: { name: 'The last stall', enemies: ['thug', 'knife'], diff: 1, clue: 'restroom:deal',
    intro: 'You kick the stall door in. A dealer and his muscle, mid-handoff. They drop the bag and come at you.' },
  dark: { name: 'The dark room', enemies: ['thug', 'brute', 'knife'], diff: 2, clue: null,
    intro: 'The crew in the corner were waiting for you. The strobe kicks in. Fists up: you\'ll only see them in the flashes.' },
  alley: { name: 'The alley', enemies: ['thug', 'knife', 'gunman'], diff: 2, clue: 'alley:bag',
    intro: 'The courier drops his cigarette and whistles. Three more step out from behind the dumpsters.' },
};

export const brawlMethods = {
  async startBrawl(kind, { caught = false } = {}) {
    const F = FIGHTS[kind];
    if (!F || this.sub || this.done) return;
    this.fought = this.fought || {};
    this.busy = true;
    this.setXray(false); this.setHearing(false);
    await dialog({ title: caught ? 'They\'ve made you' : F.name, text: caught ? `${this.room?.name || 'In here'}, there's nowhere to blend in. They come at you.` : F.intro, options: [{ label: 'FIGHT!', value: true }] });
    const zone = {
      uid: Math.floor(Math.random() * 1e6), kind: 'street', mode: 'brawl', district: this.zone.district || 'nightclub',
      def: { id: `club-${kind}`, name: F.name, enemies: F.enemies, captives: 0, reward: 0, diff: F.diff },
      name: F.name, reward: 0, diff: F.diff, boss: null, variant: null, plate: kind,
      onEnd: (res) => this.endBrawl(kind, res),
    };
    const B = this.g.modes.brawler;
    document.body.classList.remove('three');
    this.brawlerOn = B;
    B.enter({ zone });
    this.sub = { update: (dt) => B.update(dt), render: (ctx) => B.render(ctx), hud: () => B.hud() };
    this.busy = false;
  },

  async endBrawl(kind, res) {
    const B = this.brawlerOn, F = FIGHTS[kind];
    if (!B) return;
    B.exit();
    this.brawlerOn = null; this.sub = null;
    document.body.classList.add('three');
    this.setupControls(); this.envHud();
    $('objectives').classList.add('on');
    $('hud-title').textContent = this.zone.name;
    this.g.input.setStick(true);
    this.camSnap = true;
    if (res.outcome === 'win') {
      this.fought[kind] = true;
      this.alert = 0;
      if (kind === 'alley' && this.courier) this.courier.visible = false;
      if (kind === 'dark') for (const m of this.darkCrew || []) m.visible = false;
      banner('KNOCKED OUT COLD', F.name, '#3ee08a');
      if (F.clue) this.run(() => this.gotClue(F.clue, { title: F.name }));
      else toast('The crew won\'t be watching the dark room any more.', 'good');
      return;
    }
    if (res.outcome === 'lose') {
      // a double loss: the reputation, and they carry her out
      this.done = true;
      this.g.state.addRep(-8, 'Lost the fight');
      await dialog({ title: 'Down', text: `${HERO} goes down under a pile of fists. This time nobody lets her get back up.` });
      this.g.endZone(this.zone, { outcome: 'captured', reason: `Beaten in the ${F.name.toLowerCase()}, ${HERO} is dragged out the back of the club.` });
      return;
    }
    // walked away from it (pause → abort): out of the room, the bouncers alerted
    this.alert = Math.min(80, this.alert + 40);
    toast('You back out. Word gets round.', 'bad');
  },
};
