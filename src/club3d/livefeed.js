// The LIVE feed in the club (docs/design/nightclub.md "Look and feel"): while she's intoxicated
// (INTOX_HAZE, where the club's own effects start) the corner panel goes live with her, high, one
// clip after another for as long as it lasts, and closes when she sobers up. The clips are the
// checked ones from SG_Intox_Game (clips.js CLIPS.high), not the whole folder.
import { CLIPS } from './clips.js';
import { INTOX_HAZE } from '../state.js';
import { rand } from '../util.js';

export const CLUB_FEED = { gap: [4, 8] }; // seconds between clips while she's high

export const clubFeedMethods = {
  stepClubFeed(dt) {
    const f = this.g.overworld?.feed;
    if (!f) return;
    f.setList('clubHigh', CLIPS.high);
    const playing = f.tick(dt);
    const high = this.g.state.intox >= INTOX_HAZE && !this.sub && !this.done;
    if (!high) {
      if (playing && f.playing.cat === 'clubHigh') f.stop();
      this.feedT = Math.min(this.feedT || 0, 1.5); // (high again: it's back on almost at once)
      return;
    }
    if (playing) return;
    this.feedT = (this.feedT || 0) - dt;
    if (this.feedT > 0) return;
    this.feedT = rand(...CLUB_FEED.gap);
    f.play('clubHigh', `${this.clubName} · ${this.undercover ? 'Kara' : 'Supergirl'}, high`, true);
  },

  endClubFeed() { this.g.overworld?.feed?.stop(); },
};
