// The night-time "information network". Informants in the clubs, and cases solved after dark,
// unlock leads: extra incidents on the map beyond the normal quota, worth a little more.
import { pick } from './util.js';
import { toast } from './ui.js';
import { comic } from './comic.js';
import { sfx } from './sfx.js';

const LEAD_BONUS = 1.25;   // reward multiplier
const LEAD_TTL = 120;      // extra seconds before a lead goes cold

/** Unlock one new lead on the map. `source` is shown to the player ("Informant", "Solved case"). */
export function unlockLead(game, source) {
  const st = game.state, ow = game.overworld;
  const kind = st.isNight ? pick(['case', 'case', 'special']) : 'case';
  const z = ow.spawn(kind, true);
  if (!z) return null;
  z.lead = true;
  z.ttl += LEAD_TTL;
  z.reward = Math.round(z.reward * LEAD_BONUS);
  z.name = `Lead: ${z.name}`;
  st.stats.leads = (st.stats.leads || 0) + 1;
  sfx.pickup();
  toast(`🔎 ${source}: new lead — ${z.name}`, 'good');
  comic.headline(z.name.toUpperCase(), { tone: 'neutral', kicker: 'TIP-OFF!' });
  return z;
}
