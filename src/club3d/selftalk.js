// Her own voice in the club (round 11; the user: "self-mocking lines when she's intoxicated: 'Oh my
// god, what am I doing, I'm Supergirl!'"): thought bubbles over her head. Sober, a dry line at the
// big moments (made, a close call, a takedown). High, she can't stop narrating, and it's mostly at
// her own expense: as the drink climbs past each tier, and every so often while it lasts.
import { comic } from '../comic.js';
import { pick } from '../util.js';
import { INTOX_HAZE } from '../state.js';

const HIGH = {
  tipsy: ['Just one. For the case.', 'Okay. Okay. I\'m fine. Totally fine.', 'Is it warm in here, or is it me?', 'Why is the floor so… shiny?'],
  high: ['Oh my god, what am I doing? I\'m SUPERGIRL!', 'Focus, Kara. FOCUS.', 'Since when are there two DJs?', 'I can lift a bus. Why can\'t I walk straight?', 'Note to self: Kryptonians and club drugs. Bad.', 'Wow. I am SUCH a good dancer.'],
  wasted: ['Who keeps moving the walls?', 'Nobody saw that. Nobody saw that.', 'Is the cape… on backwards?', 'I love everybody in here. Even the bouncers.', 'Up, up and… nope. Sitting down.'],
};
const SOBER = {
  spotted: ['Busted.', 'Oh, come ON.', 'So much for subtle.'],
  close: ['Smooth, Kara.', 'Just a dancer. Nothing to see.', 'Too close.'],
  takedown: ['Sorry! Super-reflexes.', 'Nap time, big guy.', 'Shh.'],
};
const HIGHER = {
  spotted: ['Act natural. ACT NATURAL.', 'Hi! I\'m… not Supergirl.'],
  close: ['Ha! I\'m invisible!', 'Did I just… get away with that?'],
  takedown: ['Oops. Was that me?', 'Sorry sorry sorry!'],
};

export const selfTalkMethods = {
  /** Per frame: a line as the drink climbs a tier, and now and then while she's high. */
  stepSelfTalk(dt) {
    if (this.busy || this.sub || this.done) return;
    const i = this.g.state.intox, tier = i >= 75 ? 3 : i >= 50 ? 2 : i >= INTOX_HAZE ? 1 : 0;
    if (tier > (this.talkTier || 0)) { this.talkTier = tier; this.thinkT = 0; this.think(pick(HIGH[['', 'tipsy', 'high', 'wasted'][tier]])); return; }
    if (tier < (this.talkTier || 0) && i < INTOX_HAZE - 5) this.talkTier = 0;
    if (!tier) return;
    this.thinkT = (this.thinkT ?? 18) - dt;
    if (this.thinkT > 0) return;
    this.thinkT = 22 + Math.random() * 16;
    this.think(pick(HIGH[tier >= 3 ? 'wasted' : tier === 2 ? 'high' : pick(['tipsy', 'high'])]));
  },

  /** A line for a moment (spotted, close, takedown): drier sober, sillier high. */
  selfTalk(kind) {
    const high = this.g.state.intox >= INTOX_HAZE, pool = (high ? HIGHER : SOBER)[kind];
    if (!pool || Math.random() < (high ? 0.15 : 0.45)) return;
    setTimeout(() => this.think(pick(pool)), 650);
  },

  think(text) {
    if (this.done || this.sub || !this.hero) return;
    const anchor = () => (this.hero ? this.screenOf(this.hero.position, 2.05) : null);
    const a = anchor();
    if (!a) return;
    comic.say(text, a.x, a.y, { kind: 'thought', ms: 2600, anchor });
  },
};
