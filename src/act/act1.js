// Act 1: The Puzzle Maker (docs/design/act1.md). The story's data: who his lieutenants are and
// which case unmasks each, what she has to do before his floor of the hotel opens, the story beats
// on the rank-ups, and the lines the comic boxes use. The runtime is act.js.

export const ACT1 = {
  id: 'act1',
  title: 'Act 1: The Puzzle Maker',
  boss: 'The Puzzle Maker',
  scientist: 'Dr Amos Kell',
  drug: 'Compound K',
  hotel: 'Slutty Little Red Mini Skirt',
  floor: 13,
};

/**
 * His lieutenants, one henchman storyline each. `cases` = the club cases (CLUB_CASE_LABELS ids)
 * whose solve unmasks them; the Impostor has none (caught in flight instead). `fact` is what they
 * give up about the Puzzle Maker himself: the masquerade clue (one attribute of his costume).
 */
export const LIEUTENANTS = [
  { id: 'fixer', name: 'Lenny Gold', alias: 'the Fixer', runs: 'The clubs\' money and the Polaroid safe', cases: ['squirt', 'blackmail'], color: '#ffd84d',
    line: '"You think this is my operation? I just count the money. He designs everything."', fact: 'mask' },
  { id: 'queen', name: 'Bianca Rook', alias: 'Queen Bee', runs: 'Street distribution of the drug', cases: ['halo'], color: '#ffb020',
    line: '"Kell cooks it, my girls sell it, and the man with the puzzles takes the cut. Nobody ever sees his face."', fact: 'gloves' },
  { id: 'roxy', name: 'Roxy Flash', alias: 'the Paparazzi Queen', runs: 'The paparazzi and the live humiliations', cases: ['flashpoint'], color: '#ff2a4a',
    line: '"He sends me the scripts. Every hot seat, every flash. He said you\'d be the finale."', fact: 'cane' },
  { id: 'curator', name: 'Marcus Vane', alias: 'the Curator', runs: 'Selling the tapes and the photos', cases: ['auction'], color: '#e0c060',
    line: '"I only sell what he gives me. The tapes, the Polaroids… he has a whole gallery of you."', fact: 'flower' },
  { id: 'mesmer', name: 'Madame Mesmer', alias: 'the Hypnotist', runs: 'Keeping the drugged crowd docile', cases: ['earworm'], color: '#c07ae0',
    line: '"The drug makes them soft. My song keeps them that way. His idea, dear. Always his idea."', fact: 'hat' },
  { id: 'impostor', name: 'The Impostor', alias: 'the fake Supergirl', runs: 'Wears the knockoff costume for the cameras', cases: [], color: '#3fa0ff',
    line: '"He pays me to be you. Badly, on purpose. The papers can\'t tell the difference."', fact: 'ring' },
];

/**
 * The masquerade's clue attributes: every guest has one value of each; the Puzzle Maker's set is
 * rolled once per game. `say` is how a lieutenant gives it up.
 */
export const MASQ = {
  mask:   { label: 'Mask',    values: ['gold', 'silver', 'black', 'red'], say: (v) => `He always wears a <b>${v} mask</b> at the hotel parties.` },
  gloves: { label: 'Gloves',  values: ['white gloves', 'black gloves', 'no gloves'], say: (v) => v === 'no gloves' ? 'He <b>never wears gloves</b>. Likes to feel the pieces.' : `<b>${v[0].toUpperCase() + v.slice(1)}</b>. He never takes them off.` },
  cane:   { label: 'Cane',    values: ['a cane', 'no cane'], say: (v) => v === 'a cane' ? 'He carries <b>a cane</b> he doesn\'t need.' : 'He <b>never carries a cane</b>. Hates looking old.' },
  flower: { label: 'Lapel',   values: ['a red carnation', 'a white rose', 'a bare lapel'], say: (v) => v === 'a bare lapel' ? 'Nothing in his lapel: <b>a bare lapel</b>, always.' : `<b>${v[0].toUpperCase() + v.slice(1)}</b> in his lapel.` },
  hat:    { label: 'Hat',     values: ['a top hat', 'no hat'], say: (v) => v === 'a top hat' ? 'He wears <b>a top hat</b> indoors.' : 'He <b>never wears a hat</b>. Vain about his hair.' },
  ring:   { label: 'Ring',    values: ['a jigsaw signet ring', 'a plain gold ring', 'no ring'], say: (v) => v === 'no ring' ? 'His hands are bare: <b>no ring</b>.' : `<b>${v[0].toUpperCase() + v.slice(1)}</b> on his little finger.` },
};

/** What she has to do before the 13th floor opens (docs/design/act1.md "Gates"). */
export const GATES = {
  rep: 300,            // Metro Icon
  clubs: 8,            // club missions won
  warehouses: 2,
  asylum: 1,
  factory: 1,
  entertainment: 1,    // a win in the entertainment district (any mission)
  lieutenants: 5,      // of 6
  fakes: 10,           // fake Polaroids called correctly
};

/** The story beats, each once, on the existing rank-ups (state.js RANKS). */
export const BEATS = [
  { id: 'start', rep: -Infinity,
    caption: 'Metro City. A hero, a skyline, and a new party drug everyone is whispering about…',
    headline: 'NEW PARTY DRUG HITS THE CLUBS', kicker: 'NEWS FLASH' },
  { id: 'local', rep: 60,
    caption: 'Local Hero! But someone has been taking pictures. Of her. Or of someone wearing her face…',
    paper: { tabloid: true, headline: 'SUPERGIRL\'S WILD NIGHT?', sub: 'Instant photos of the city\'s heroine, out of costume and out of control, turn up all over town',
      body: ['The Polaroids arrived at this newsroom in a plain envelope. A jigsaw piece was taped to the back of every one.', 'Supergirl says she has no memory of the night. "That\'s what they all say," said one reader.'] },
    after: 'Polaroids of "you" are turning up around the city. Some are real; some aren\'t you at all. Grab them before they go online, and call each one: Supergirl or Impostor?' },
  { id: 'guardian', rep: 150,
    caption: 'City Guardian. The drug is everywhere now, and every dealer, every photographer, every club owner answers to the same man.',
    headline: 'DRUG CLINICS OVERWHELMED', kicker: 'CITY IN CRISIS',
    after: 'Your act board is open (MAP → ACT BOARD): unmask the Puzzle Maker\'s lieutenants. And watch the map: "Supergirl" has been spotted in places you\'ve never been…' },
  { id: 'riddle', rep: 225,
    caption: 'A message on a downtown billboard. A jigsaw puzzle, and a riddle signed with a question mark.',
    riddle: true },
  { id: 'metro', rep: 300,
    caption: 'Metro Icon. The city loves her again. Somewhere, a man with a puzzle box is not pleased.' },
];

/** The comic yellow box mocking a wrong call (Polaroids and the hotel's posters). */
export const MOCK = {
  fakeCalledReal: [
    'Can\'t even recognise herself. Adorable.',
    'That\'s not you, sweetheart. Yours is the one with the dignity.',
    'The tabloids can\'t tell either. That\'s the point.',
    'Wow. Even the impostor\'s insulted.',
    'Look closer. Or don\'t. It\'s funnier this way.',
    'Fooled by a wig and a tube top. The Girl of Steel, everybody.',
  ],
  realCalledFake: [
    'Wrong! He\'ll want that one framed.',
    'That\'s you, hero. Not your best angle, but it\'s you.',
    'Denial isn\'t a superpower.',
    'Oh, that one\'s real. Ask the guy who took it.',
  ],
  right: ['Sharp eyes.', 'Nobody fools the Girl of Steel.', 'One less lie in the papers.', 'Called it.'],
};

/** The hotel's floor-13 seals: one per wing, a riddle each; the answer is on a note in that wing. */
export const SEALS = [
  { wing: 'gallery', name: 'The Gallery', q: 'I have a frame but no house, a face but no voice, and I tell the city lies about you. What am I?', a: 'A photograph', wrong: ['A mirror', 'A window', 'A painting'] },
  { wing: 'wardrobe', name: 'The Wardrobe', q: 'Worn by two, owned by one. The cape is real; the girl is not. What is the impostor\'s word for the costume?', a: 'A uniform', wrong: ['A disguise', 'A dress', 'A gift'] },
  { wing: 'lab', name: 'The Lab', q: 'Green and still, it makes the strong one weak. Kell cut his drug with it. What is it?', a: 'Kryptonite', wrong: ['Emerald', 'Jade', 'Uranium'] },
  { wing: 'switchboard', name: 'The Switchboard', q: 'The more of me you take, the more you leave behind. The paparazzi live on them. What are they?', a: 'Footsteps', wrong: ['Photos', 'Breaths', 'Secrets'] },
  { wing: 'screening', name: 'The Screening Rooms', q: 'I play the same scene again and again, and you are always in it. What am I?', a: 'A loop', wrong: ['A rerun', 'A dream', 'A trap'] },
];

/** The kryptonite emitters' locks in the ballroom fight: short riddles. */
export const LOCKS = [
  { q: 'What has keys but opens no locks?', a: 'A piano', wrong: ['A jailer', 'A map', 'A safe'] },
  { q: 'What gets wetter the more it dries?', a: 'A towel', wrong: ['A sponge', 'Rain', 'A river'] },
  { q: 'What can you catch but not throw?', a: 'A cold', wrong: ['A ball', 'A thief', 'A wave'] },
  { q: 'What has a neck but no head?', a: 'A bottle', wrong: ['A guitar case', 'A shirt', 'A swan'] },
  { q: 'The more you take away from me, the bigger I get. What am I?', a: 'A hole', wrong: ['A debt', 'A shadow', 'A secret'] },
  { q: 'What belongs to you but others use it more?', a: 'Your name', wrong: ['Your cape', 'Your phone', 'Your face'] },
];

/** Kell's after-effects when she wakes from a memory wipe (hotel.js). */
export const EXPERIMENTS = [
  { id: 'high', note: 'Subject response to Compound K: euphoric, compliant. Dose doubled.', toast: 'You wake up high.' },
  { id: 'tagged', note: 'Subject tagged with a kryptonite tracer. She cannot hide from me for long.', toast: 'Kell can find you faster for a while.' },
  { id: 'scrambled', note: 'Optic nerve stimulated. X-ray vision unstable for ~60 s.', toast: 'Your X-ray is down for a minute.' },
  { id: 'sensitive', note: 'Pain threshold lowered. Restraints will feel much tighter.', toast: 'The traps hold you harder for a while.' },
];

/** The crowd heckling her on the ballroom stage, worse each loop. */
export const HECKLES = [
  ['Is that really her?', 'Smile for the cameras, hero!', 'She looks smaller in person.'],
  ['Again?!', 'Encore! Encore!', 'Some Girl of Steel!', 'Get her a chair!'],
  ['She LIKES it up there!', 'Third time\'s the charm!', 'Somebody frame this!', 'Best show in town!'],
];

/**
 * Each lieutenant's trail through the ordinary missions (act.js tagZone): a rumour (an
 * investigation), then a raid (a warehouse, a factory, the asylum, a night case), then their own
 * case, whose confession unmasks them. The Impostor's trail ends with her next sighting.
 */
export const TRAILS = {
  fixer: ['A bartender talks: Lenny Gold\'s money moves through every club on the strip, in envelopes with a jigsaw piece inside.', 'Ledgers in a back room: payments to "V.", "S.", "C." and "V.", every one routed through Lenny Gold. Four buyers, one bookkeeper.'],
  queen: ['The dealers on the corner call their boss the Queen. Gold drug, gold nails, a club called the Hive.', 'Crates of jars labelled HONEY, stamped Helix Labs, bound for Pier 9. The Queen\'s seal on every lid.'],
  roxy: ['A paparazzo\'s memory card: shots of you, each with a time and a place written down before you got there.', 'A call sheet for Flashpoint Live. Tonight\'s guest: "S.G." Roxy Flash has saved her a seat.'],
  curator: ['A collector brags about a private auction at the Gilded Cage: "Lot one is a tape of the Girl of Steel."', 'An invoice from the Curator: "Preview tape, to be screened on Floor 13." Marcus Vane signs with a jigsaw piece.'],
  mesmer: ['Clubbers humming the same tune, eyes glazed. Somebody says "Madame" plays it at three in the morning.', 'Sheet music with one tone circled in red: "for the dosed only". Madame Mesmer\'s handwriting.'],
  impostor: ['A costume shop sold a dozen Supergirl outfits to one buyer, cash. Tube tops, vinyl skirts, cheap boots.', 'A dressing room: wigs on stands, a tube top on the chair, a schedule of "appearances". She\'s out tonight.'],
};
