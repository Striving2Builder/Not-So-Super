// Case templates (round 11, track V): a club visit's case built from a seed instead of written by
// hand. A suspect (casedata.js SUSPECTS: who wants Supergirl caught "behaving badly", their venue,
// their crowd) × a clue type (how the trail shows: texts, prints, a paper trail, loose talk, UV,
// X-ray) × a twist (what the photo really is: real, a planted drink, a lookalike, doctored, or the
// crowd itself was the setup). The result has the same shape as the hand-written cases
// (src/nightclub/cases/*.js), plus `gen` for the visit: the crowd beats (casebeats.js), the
// objective line, the profile (crowd density, how pushy, the bouncers) and the headline.
// Any 8 consecutive seeds give 8 different suspects; the clue type and the twist rotate with them.
import { RNG } from '../rng.js';
import { SUSPECTS, ALLIES, DRINKS, CLUE_TYPES, FRAMES, FLAVOUR, TWISTS, TWIST_IDS, TWIST_MORE, STYLE } from './casedata.js';

// r11 V2: each twist's own beats (the snapper only for a real photo; the planted drink has the CCTV
// booth, the lookalike her double on the club's screens, the setup the break-out). A suspect playing
// their own twist runs their own list (casedata STYLE).
const TWIST_BEATS = { real: ['shots', 'selfie', 'headline'], planted: ['push', 'booth', 'headline'], lookalike: ['double', 'selfie', 'headline'], doctored: ['selfie', 'shots', 'headline'], setup: ['trap', 'breakout', 'headline'] };
/** The visit's own title, headline and lede (seeds with the same twist pick different ones). */
function variant(S, twist, s) {
  const own = SUSPECTS.filter((q) => q.twist === twist).indexOf(S), i = own >= 0 ? own : SUSPECTS.indexOf(S) + 2, M = TWIST_MORE[twist], lap = Math.floor((s - 1) / 8);
  const [headline, sub, lede] = M.papers[(i + lap) % M.papers.length];
  return { title: M.titles[(i + lap) % M.titles.length], headline, sub, lede };
}

const CLUE_IDS = Object.keys(CLUE_TYPES);
const CATS = ['deal', 'supply', 'drop'];
const ITEMS = { 'office:key': 'cellar key', 'bar:coaster': 'VIP wristband', 'entrance:band': 'VIP wristband' };

/** Which suspect, clue type and twist a seed plays. */
export function genParts(seed) {
  const s = Math.abs(Math.floor(seed)) || 1, i = s % SUSPECTS.length, r = new RNG(s * 31 + 7);
  const S = SUSPECTS[i];
  const clue = s <= 64 ? CLUE_IDS[(i * 5 + 1 + Math.floor((s - 1) / 8)) % CLUE_IDS.length] : r.pick(CLUE_IDS);
  let twist = s <= 64 ? TWIST_IDS[(TWIST_IDS.indexOf(S.twist) + Math.floor((s - 1) / 8) * 2) % TWIST_IDS.length] : r.pick(TWIST_IDS);
  if (S.id === 'kroll') twist = 'lookalike'; // (the knockoff's handler always runs his lookalike)
  return { S, clue, twist, r };
}

/** The map's label for a generated case (overworld clubCase). */
export function genLabel(seed) {
  const { S, twist } = genParts(seed);
  return { name: variant(S, twist, Math.abs(Math.floor(seed)) || 1).title, theme: 'extortion', risk: 'Scandal',
    blurb: `Someone wants a picture of Supergirl behaving badly, and tonight they've got the crowd on their side. ${S.rumour}` };
}

/** Four options, the right one among three others from the pool (shuffled by r). */
function choices(r, right, pool) {
  const seen = new Set([right.label]), others = pool.filter((p) => p.value !== right.value && !seen.has(p.label) && seen.add(p.label));
  for (let i = others.length - 1; i > 0; i--) { const j = r.int(0, i); [others[i], others[j]] = [others[j], others[i]]; }
  const opts = [right, ...others.slice(0, 3)];
  for (let i = opts.length - 1; i > 0; i--) { const j = r.int(0, i); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts;
}

/** The whole case for a seed: same shape as a hand-written one. */
export function makeCase(seed) {
  const { S, clue, twist, r } = genParts(seed), T = TWISTS[twist], C = CLUE_TYPES[clue];
  const own = twist === S.twist ? STYLE[S.id] || {} : {}, Vr = variant(S, twist, Math.abs(Math.floor(seed)) || 1);
  const pace = own.pace || [14 + r.int(0, 6), 20 + r.int(0, 8)];
  const clues = {};
  // the trail: the clue type's spots carry the suspect's three facts (two each)
  const trail = C.keys.filter((k) => k !== T.proof);
  trail.forEach((k, n) => {
    const cat = CATS[n % 3];
    clues[k] = { cat, note: S.note[cat], text: FRAMES[k](S.msg[cat]) };
  });
  // everything else is flavour (no names, nothing to contradict the trail)
  for (const [k, text] of Object.entries(FLAVOUR)) if (!clues[k]) clues[k] = { flavour: true, note: text.replace(/<[^>]+>/g, '').slice(0, 60), text, ...(ITEMS[k] ? { item: ITEMS[k] } : {}) };
  clues['bar:glass'] = { ...clues['bar:glass'], drink: true };
  clues['main:vial'] = { ...clues['main:vial'], drink: true };
  // the twist's proof: the spot that shows the photo is a fake
  if (T.proof) clues[T.proof] = { cat: 'deal', proof: true, note: T.proofNote, text: T.proofText };
  // the 3D club's own sources (v3)
  const talks = ['crowd', 'staff', 'phones'].map((id, n) => ({ id, who: ['Two clubbers', 'Two bar staff', 'Two girls with their phones out'][n], clue: `talk:${id}` }));
  talks.forEach((t, n) => { clues[t.clue] = { v3: true, cat: CATS[n], note: `Overheard: ${S.note[CATS[n]].charAt(0).toLowerCase()}${S.note[CATS[n]].slice(1)}`, text: S.talk[n] }; });
  Object.assign(clues, {
    'vip:host': { v3: true, cat: 'supply', note: `${S.host} let slip: ${S.buyer} is paying`, text: `${S.host}, three drinks in, can't help it: <b>"${S.msg.supply}"</b>` },
    'alley:bag': { v3: true, cat: 'drop', note: `The courier's bag: ${S.drop}`, text: `The courier's bag: prints of Supergirl, mid-laugh, mid-sip, mid-blink. A slip on top: <b>"${S.msg.drop}"</b>` },
    'restroom:deal': { v3: true, cat: 'deal', note: 'The stall: memory cards changing hands', text: `In the last stall, a memory card changes hands for a roll of cash. "${S.short} wants the best ones by midnight."` },
    'storage:stash': { v3: true, cat: 'deal', note: 'A crate of phones and power banks for the crowd', text: `Behind the beer crates: a box of cheap phones and power banks, each with a sticky note: <b>"FOR THE FLOOR. ${S.short.toUpperCase()}."</b>` },
    'bar:spiked': { v3: true, cat: 'deal', note: 'Her drinks are doubles, poured strong on purpose', text: 'X-ray shows the measure: every drink headed her way is a triple. Somebody wants her wobbly.' },
    'uv:wall': { v3: true, cat: 'drop', note: `UV writing: ${S.drop}`, text: `Under the drug-vision glow the wall is covered in UV marker: <b>"${S.msg.drop}"</b>` },
    'boss:confession': { v3: true, cat: 'drop', note: `${S.boss} confessed: ${S.name}, ${S.buyer}, ${S.drop}`, text: `${S.boss} folds: it's ${S.name}, ${S.who}. ${S.buyer} pays, and it goes out: ${S.drop}.` },
  });
  if (twist === 'real') clues['crowd:phone'] = { v3: true, cat: 'drop', note: 'You got the snapper\'s phone back', text: 'The phone, and the photo on it. Deleted. The memory card snaps in your fingers.' };
  const counted = Object.values(clues).filter((c) => !c.flavour).length;
  const others = SUSPECTS.filter((q) => q !== S);
  const alt = (f) => others.map((q) => ({ label: f(q), value: q.id }));
  const questions = [
    { q: 'Who is out to catch Supergirl behaving badly?', answer: S.id, options: choices(r, { label: `${S.name}, ${S.who}`, value: S.id }, alt((q) => `${q.name}, ${q.who}`)) },
    { q: 'Who is paying for the pictures?', answer: S.id, options: choices(r, { label: cap(S.buyer), value: S.id }, alt((q) => cap(q.buyer)).filter((o) => o.label !== cap(S.buyer))) },
    { q: 'Where do the pictures go out?', answer: S.id, options: choices(r, { label: cap(S.drop), value: S.id }, alt((q) => cap(q.drop))) },
    { q: 'The photo of her: what really happened?', answer: twist, options: choices(r, { label: T.q, value: twist }, TWIST_IDS.map((k) => ({ label: TWISTS[k].q, value: k }))) },
  ];
  const allyOpts = choices(r, { label: ALLIES[S.ally], value: S.ally }, Object.entries(ALLIES).map(([value, label]) => ({ label, value })));
  const drinkOpts = choices(r, { label: DRINKS[S.drink], value: S.drink }, Object.entries(DRINKS).map(([value, label]) => ({ label, value })));
  const camera = twist === 'setup' ? 'no' : 'ahead';
  return {
    id: `gen-${seed}`, gen: { seed, suspect: S.id, clue, twist, beats: [...(own.beats || TWIST_BEATS[twist])], again: TWIST_MORE[twist].again, runner: TWIST_MORE[twist].runner, pace, crew: STYLE[S.id]?.crew, lines: { shot: STYLE[S.id]?.shot, selfie: STYLE[S.id]?.selfie }, obj: T.obj, hint: C.hint, headline: Vr.headline, sub: Vr.sub, lede: Vr.lede, profile: S.profile, look: S.look, name: S.name, short: S.short, lead: S.lead },
    title: Vr.title, tagline: `${T.obj}. ${C.hint}.`, theme: 'extortion', room: S.room, events: S.events,
    difficulty: S.profile.difficulty || 'normal',
    need: Math.min(counted - 3, own.need || 6 + (r.chance(0.5) ? 1 : 0)), rep: 30,
    clues,
    solvedText: `${S.name}, ${S.who}, wanted a picture of Supergirl behaving badly for ${S.motive}. ${S.buyer} was paying, and it was going out: ${S.drop}.`,
    drugName: 'The house special', uvLine: S.msg.drop.toUpperCase().slice(0, 28), carrierLine: 'Free shots, all night, if you share one with Supergirl.',
    talks,
    rumours: [
      { id: 'who', text: `Want past the VIP rope? When they ask who sent you, say ${ALLIES[S.ally]}`, teach: 'who' },
      { id: 'drink', text: `Up in VIP everyone drinks ${DRINKS[S.drink].replace(/["“”.]/g, '').toLowerCase()}. ${S.short} insists.`, teach: 'drink' },
      { id: 'camera', text: camera === 'no' ? 'In VIP, say no to the cameras. They test you.' : `Never say no to a camera in VIP. ${S.short} hates it.`, teach: 'camera' },
      { id: 'sus', text: S.rumour },
      { id: 'phones', text: 'Everyone\'s got their phone out tonight. Like they\'re waiting for something.' },
      { id: 'swap', text: 'Bouncers lose it at the drop. Staff door\'s wide open for a beat.' },
      { id: 'shots', text: 'Somebody\'s buying shots for anyone who gets one into Supergirl.' },
      { id: 'alley', text: 'A courier comes for a package out the back. Every night this week.' },
    ],
    whispers: [
      { id: 'pass', text: `${S.short}'s crew uses the VIP. ${ALLIES[S.ally]} gets you in.`, teach: 'who' },
      { id: 'code', text: 'Office code\'s {CODE}. The owner never changes it.', code: true },
      { id: 'stash', text: 'There\'s a box of phones in the stock room. For the crowd.' },
      { id: 'when', text: `It goes out: ${S.drop}.` },
    ],
    vip: {
      host: S.host,
      intro: `"Well, well. Nobody comes up here unless I like them. Let's see if I like you."`,
      questions: [
        { id: 'who', q: '"Who sent you up?"', answer: S.ally, options: allyOpts },
        { id: 'drink', q: '"What are you drinking?"', answer: S.drink, options: drinkOpts },
        { id: 'camera', q: 'Phones come up all round the couch. "Picture?"', answer: camera,
          options: [{ label: '"No photos!"', value: 'no' }, { label: '"Only my good side."', value: 'side' }, { label: '"Go ahead. I love the camera."', value: 'ahead' }, { label: '"Delete it after."', value: 'delete' }] },
      ],
      win: 'vip:host',
    },
    boss: {
      name: S.boss,
      steps: [
        { cat: 'deal', line: '"People take pictures in clubs, hero. That\'s what clubs are for."' },
        { cat: 'supply', line: '"And who\'d pay good money for a picture of you having fun?"' },
        { cat: 'drop', line: '"It\'s out of my hands anyway. It\'s probably out already."' },
      ],
      confession: 'boss:confession',
    },
    questions,
    leads: [
      { id: `gen-${S.id}-lead`, name: S.lead.name, kind: 'street', reward: 100,
        by: Object.keys(clues).filter((k) => clues[k].cat === 'drop' || clues[k].cat === 'supply'), blurb: S.lead.blurb },
    ],
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
