// Polaroids of her, out in the city (docs/design/nightclub.md "The envelope").
// The stash: every polaroid the club owner still holds when she leaves goes in his safe and stays
// there between visits (state.photosLost; the next visit's envelope starts thick with them). Once
// he holds STASH.jobAt or more, he puts a price on them: a job on the map ("get them back", at his
// club) with a deadline. Empty his safe in time and they're gone; miss it and he sells the lot to
// the tabloids. Separately, while her reputation is below zero, polaroids of her surface around
// the city (pinned to lamp posts, in newsstand racks): grab one before somebody posts it.
// The pictures are made up: a frame of one of her clips (the green-screen dance keyed onto a club
// plate, or a frame of a tipsy flight), developed as an instant photo.
import { polaroid } from './nightclub/blackout.js';
import { mediaFolders } from './media.js';
import { showNewspaper } from './newspaper.js';
import { dialog, toast } from './ui.js';
import { sfx } from './sfx.js';
import { DISTRICTS, HERO, VENUES } from './data.js';
import { pick, rand, dist, fmtClock } from './util.js';
import { LOT } from './city.js';

export const STASH = {
  jobAt: 4,        // polaroids in his safe before he puts a price on them
  secs: 420,       // the deadline (real seconds of flying; it waits while she's in a zone)
  repEach: 4,      // what each one costs when he sells (capped)
  repMax: 40,
};
export const STRAYS = {
  every: [55, 95], // seconds between polaroids turning up (faster the lower her rep)
  ttl: 60,         // before somebody else finds it
  max: 2,          // on the map at once
  grab: 2, lost: 3, // rep for grabbing one / for one going online
};

const PLATES = ['main', 'bar', 'vip', 'lounge', 'dark', 'balcony', 'corridor'].map((p) => `assets/nightclub/plates/${p}.jpg`);
const SCRAWL = ['oops', 'last call ♥', 'our hero!', 'VIP night', 'who invited her?', 'off duty', 'one more!', 'girl of steel?', 'shhh', 'after hours'];
const WHERE = ['pinned to a lamp post', 'tucked under a windscreen wiper', 'in a newsstand rack, between the gossip mags', 'taped to a bus shelter', 'blowing down the gutter', 'stuck in a club flyer'];

function load(make) {
  return new Promise((resolve) => {
    const el = make();
    const t = setTimeout(() => resolve(null), 3000);
    el.onload = el.onloadeddata = () => { clearTimeout(t); resolve(el); };
    el.onerror = () => { clearTimeout(t); resolve(null); };
  });
}

/** One frame of a clip (muted, inline), at a random point; null if the device won't give one. */
export async function frameOf(url) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
  const ok = await load(() => { v.src = url; return v; });
  if (!ok || !v.videoWidth) return null;
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 2500);
    v.onseeked = () => { clearTimeout(t); resolve(); };
    v.currentTime = (v.duration || 4) * rand(0.15, 0.85);
  });
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  try { c.getContext('2d').drawImage(v, 0, 0); } catch (e) { return null; }
  v.removeAttribute('src'); v.load();
  return c;
}

/** A frame shot on green, stood in a club plate (green pulled out on the CPU: it's one small picture). */
function keyOnto(frame, plate) {
  const S = 300, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (plate) { const s = Math.max(S / plate.width, S / plate.height); g.drawImage(plate, (S - plate.width * s) / 2, (S - plate.height * s) / 2, plate.width * s, plate.height * s); }
  else { g.fillStyle = '#1a0a24'; g.fillRect(0, 0, S, S); }
  const k = document.createElement('canvas'), s = Math.min(S / frame.width, S / frame.height) * 1.15;
  k.width = Math.round(frame.width * s); k.height = Math.round(frame.height * s);
  const kg = k.getContext('2d');
  kg.drawImage(frame, 0, 0, k.width, k.height);
  try {
    const d = kg.getImageData(0, 0, k.width, k.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const gr = p[i + 1] - Math.max(p[i], p[i + 2]);
      if (gr > 20) { p[i + 3] = gr > 55 ? 0 : 255 * (55 - gr) / 35; p[i + 1] = Math.max(p[i], p[i + 2]); }
    }
    kg.putImageData(d, 0, 0);
  } catch (e) { /* tainted: drawn as is */ }
  g.drawImage(k, (S - k.width) / 2, S - k.height);
  return c;
}

/** A made-up polaroid of her (a canvas). Always resolves: with no clip to hand it's a club plate. */
export async function makePolaroid(caption = pick(SCRAWL)) {
  const all = await mediaFolders();
  const dance = all.ClubDance || [], tipsy = (all.Flying || []).filter((u) => /Intoxicated/i.test(u));
  const plate = await load(() => { const i = new Image(); i.src = pick(PLATES); return i; });
  let pic = null;
  try {
    if (dance.length && (!tipsy.length || Math.random() < 0.6)) { const f = await frameOf(pick(dance)); if (f) pic = keyOnto(f, plate); }
    else if (tipsy.length) pic = await frameOf(pick(tipsy));
  } catch (e) { pic = null; }
  return polaroid(pic || plate || Object.assign(document.createElement('canvas'), { width: 8, height: 8 }), caption);
}

const the = (v) => (/^the /i.test(v || '') ? v : `the ${v || 'club'}`);
const imgTag = (c) => `<img class="c3-pol" src="${c.toDataURL('image/jpeg', 0.8)}">`;

/**
 * Leaving a club: what's still in the owner's envelope goes in his safe (the 'photos' card is the
 * stash he already had). Called by the clubs' exit.
 */
export function stashFromEnvelope(st, envelope, venue) {
  const n = (envelope || []).reduce((s, c) => s + (c.id === 'photos' ? c.n || st.photosLost || 1 : 1), 0);
  const before = st.photosLost || 0;
  st.photosLost = n;
  if (n) st.stashVenue = venue || st.stashVenue;
  if (!n && before) { const job = st.stash; st.stash = null; if (job || before >= STASH.jobAt) toast(`You got them back: no more polaroids of you in ${the(venue)}'s safe.`, 'good'); }
  else if (n > before) toast(`${the(venue).replace(/^t/, 'T')} keeps ${n} polaroid${n === 1 ? '' : 's'} of you in the safe.${n >= STASH.jobAt ? ' He\'ll want to use them.' : ''}`, 'bad');
  st.save();
}

/** Per frame, from the overworld's update (only while she's flying: the deadline waits for her). */
export function stepPolaroids(ow, dt) {
  const st = ow.g.state;
  if (!st || ow.attract) return;
  stepStash(ow, st, dt);
  stepStrays(ow, st, dt);
}

// ------------------------------------------------------------------ the stash job
function stepStash(ow, st, dt) {
  const n = st.photosLost || 0;
  if (!st.stash && n >= STASH.jobAt && st.stashVenue) {
    st.stash = { t: STASH.secs, venue: st.stashVenue };
    st.save();
    sfx.lose();
    dialog({ title: 'A message, slipped under a rooftop door', cls: 'danger', text: `A polaroid of you, and on the back: <b>"I've got ${n} of these. The papers would pay a lot. Come and get them, hero. You've got until ${fmtClock(st.clock + STASH.secs * 4)}."</b><span class="hint">Get back into ${the(st.stash.venue)} and empty the safe behind the painting in the owner's office before the deadline.</span>` });
  }
  const S = st.stash;
  if (!S) return;
  if (!n) { st.stash = null; ow.zones.filter((z) => z.stashJob).forEach((z) => ow.removeZone(z)); return; }
  S.t -= dt;
  const was = S.t + dt;
  for (const w of [120, 60, 20]) if (was > w && S.t <= w) toast(`📷 ${Math.round(w)}s until ${the(S.venue)} sells your polaroids`, 'bad');
  let z = ow.zones.find((q) => q.stashJob);
  if (!z && (ow.stashTry = (ow.stashTry || 0) - dt) <= 0) {
    ow.stashTry = 2;
    z = ow.spawn('special', true, VENUES[S.venue] ? S.venue : undefined);
    if (z) {
      Object.assign(z, { stashJob: true, name: `Get your polaroids back: ${z.venue}`, color: '#fff2c0', glyph: '📷', risk: 'Your secrets', blurb: `${n} polaroids of you in the owner's safe. Empty it before he sells them.` });
      if (S.x != null) { z.x = S.x; z.y = S.y; z.district = S.district; } else { S.x = z.x; S.y = z.y; S.district = z.district; }
    }
  }
  if (z) { z.ttl = z.t + Math.max(1, S.t); z.blurb = `${n} polaroids of you in the owner's safe. Empty it before he sells them.`; }
  if (S.t <= 0) sell(ow, st);
}

async function sell(ow, st) {
  const S = st.stash, n = st.photosLost || 0;
  st.stash = null; st.photosLost = 0;
  ow.zones.filter((z) => z.stashJob).forEach((z) => ow.removeZone(z));
  const rep = Math.min(STASH.repMax, n * STASH.repEach);
  const pic = await makePolaroid(`${S.venue}, ${fmtClock(st.clock - 300)}`);
  st.addRep(-rep, `${S.venue} sold your polaroids`);
  await showNewspaper({ tabloid: true, rep: -rep, photo: pic, headline: `${HERO.toUpperCase()}'S WILD NIGHTS: THE POLAROIDS`, sub: `${n} instant photos, sold to this paper by the owner of ${the(S.venue)}`, body: [`They came in a brown envelope with a price on it. We paid it. Inside: ${HERO}, very much off duty, very much at ${the(S.venue)}.`, `"She knew where they were," the owner told us. "She just never came to get them."`] });
  st.save();
  setTimeout(() => ow.feed?.play('leak', `SOLD · ${S.venue}`, true), 1200);
}

// ------------------------------------------------------------------ strays (rep below zero)
function stepStrays(ow, st, dt) {
  const strays = ow.zones.filter((z) => z.polaroid);
  const act = ow.g.act?.straysOn() ? ow.g.act : null; // the act's frame-up: they turn up whatever her reputation, most of them fakes
  if (st.rep >= 0 && !act) { ow.strayT = rand(...STRAYS.every) * 0.5; return; }
  ow.strayT = (ow.strayT ?? rand(...STRAYS.every) * 0.5) - dt * (st.rep < -50 ? 1.6 : 1);
  if (ow.strayT > 0 || strays.length >= STRAYS.max) return;
  ow.strayT = rand(...STRAYS.every);
  const h = ow.hero, cands = ow.g.city.blocks.filter((b) => {
    if (b.river) return false;
    const d = dist(b.x0 + LOT / 2, b.y0 + LOT / 2, h.x, h.y);
    return d > 350 && d < 1600 && ow.zones.every((z) => dist(z.x, z.y, b.x0 + LOT / 2, b.y0 + LOT / 2) > 400);
  });
  if (!cands.length) return;
  const b = pick(cands);
  const z = { uid: ow.uid++, kind: 'polaroid', polaroid: true, district: b.d, t: 0, x: b.x0 + LOT / 2, y: b.y0 + LOT / 2, ttl: STRAYS.ttl, name: 'A polaroid of you', color: '#fff2c0', glyph: '📷', risk: 'Your secrets', reward: STRAYS.grab, lockKey: 'Polaroids', where: pick(WHERE), blurb: 'One of the club\'s polaroids of you is loose in the city. Grab it before somebody posts it.' };
  if (act) Object.assign(z, { fake: act.strayFake(), name: 'A Polaroid of "you"', blurb: 'A Polaroid of "you" is loose in the city. Is it really you? Grab it before somebody posts it.' });
  ow.zones.push(z);
  toast(`📷 A polaroid of you turned up in ${DISTRICTS[b.d]?.name || 'the city'}. Get it before it goes online!`, 'bad');
}

/** Diving on a stray polaroid: no zone, she just snatches it. */
export async function grabPolaroid(ow, z) {
  const st = ow.g.state;
  ow.removeZone(z);
  sfx.pickup();
  if (ow.g.act?.straysOn()) return ow.g.act.callPolaroid(z); // the act: Supergirl or Impostor?
  const pic = await makePolaroid();
  await dialog({ title: 'Got it', text: `${imgTag(pic)}It was ${z.where}. Nobody's posted it. Yet.` });
  st.addRep(STRAYS.grab, 'Got a polaroid back');
}

/** A stray nobody grabbed in time. */
export function strayLost(st, z) {
  st.addRep(-STRAYS.lost, `A polaroid of you went online (${DISTRICTS[z.district]?.name || 'the city'})`);
}
