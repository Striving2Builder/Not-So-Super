// Act 2: Not So Super (docs/design/act2.md). The story's data: what she has to do before the
// hotel's new floor opens (the gates), the pieces of her stolen suit, the story beats and the lines.
// The runtime is act2run.js (driven by act.js once Act 1 is complete).

export const ACT2 = {
  id: 'act2',
  title: 'Act 2: Not So Super',
  boss: 'Supergurl',
  drug: 'Super Squirt',
  opening: { venue: 'High-Roller Suite', club: 'the Gilded Cage', district: 'redlight' },
  hotel: 'Slutty Little Red Mini Skirt', // (the same hotel as Act 1: its new floor, the hall of mirrors)
  floor: 'the hall of mirrors',
  scandalRep: -50,                       // the opening scandal sets her rep here, whatever it was
};

/** What she has to do before the hall of mirrors opens (act2.md "Gates"). No reputation gate. */
export const GATES = {
  asylum: 6,          // Ravenmoor visits
  clubs: 8,           // nightclub missions
  casino: 6,          // casino nights won
  factory: 2,         // production lines shut down (4 levers each)
  rldwalk: 3,         // RLD Walks (the opening is the first)
  investigations: 3,  // drug and trafficking investigations
  promotions: 4,      // impostors caught at promotions (map events, phase B)
  polaroids: 12,      // cult Polaroids called right
  suit: 25,           // 5 pieces x 5 finds
};

export const GATE_LABELS = {
  asylum: 'Ravenmoor Asylum visits',
  clubs: 'Nightclub missions',
  casino: 'Casino nights won',
  factory: 'Factory lines shut down',
  rldwalk: 'RLD Walks',
  investigations: 'Drug and trafficking cases',
  promotions: 'Impostors caught at promotions',
  polaroids: 'Cult Polaroids called right',
  suit: 'Her original suit (finds)',
};

/** Finds per piece: 1-4 are stained copies or clues pointing on, the 5th is the real piece. */
export const FINDS = 5;

/** Her original suit, in five pieces. `from` = where its finds turn up (act2.md "Costumes"). */
export const PIECES = [
  { id: 'cape', name: 'Cape', glyph: '🦸', from: 'Selected clubs, investigations, RLD lead rooms' },
  { id: 'boots', name: 'Boots', glyph: '👢', from: 'Selected clubs, investigations, RLD lead rooms' },
  { id: 'briefs', name: 'Briefs', glyph: '🩲', from: 'Selected clubs, investigations, RLD lead rooms' },
  { id: 'top', name: 'Top', glyph: '👚', from: 'Won at the casino tables' },
  { id: 'skirt', name: 'Red skirt', glyph: '👗', from: 'Won at the casino tables' },
];
export const PIECE_ALIAS = { 'red skirt': 'skirt', redskirt: 'skirt', skirt: 'skirt', shirt: 'top', 'crop top': 'top', boot: 'boots', brief: 'briefs', bottoms: 'briefs' };

/** The act's first clues, pinned to the board after the opening. */
export const CLUES = [
  { id: 'polaroids', name: 'The Polaroids', glyph: '📷', line: 'Instant photos of her in a red-light room, in a Supergirl costume. The cult\'s "proof".' },
  { id: 'note', name: 'The blackmail note', glyph: '✉', line: '"We have the tape. Stay out of our way, or the city sees it." A cassette label: <b>HIGH-ROLLER SUITE, OPENING NIGHT</b>.' },
];

/** The story beats (event-driven: the pendulum makes rank-ups meaningless). */
export const BEATS = {
  // the title card, then she wakes up tied up inside the first RLD Walk
  opening: {
    title: 'ACT 2: NOT SO SUPER',
    caption: 'The Puzzle Maker is locked up. But Compound K is still out there, and now there\'s a stronger cut…',
    text: 'The after-party of the <b>High-Roller Suite\'s grand opening</b>, at the Gilded Cage. The room spinning. A drink in the lounge, another in the VIP. The dark room. Then nothing.'
      + '<span class="hint">You wake up in the red-light district, tied up, in a crop-top Supergirl costume. Your own suit is gone. Get free.</span>',
    wake: 'Wake up',
    noWalk: 'You come to in the red-light district, tied up in a back room. You twist free and stumble out into the street.',
  },
  // the morning papers, after the opening walk (however it went)
  morning: {
    paper: {
      tabloid: true, headline: 'SUPERGIRL\'S LOST NIGHT', kicker: 'SCANDAL!',
      sub: 'Polaroids, a blackmail note and a missing costume: the city\'s heroine wakes up in the red-light district',
      body: ['The photos came to this newsroom in a plain envelope: the Girl of Steel in a back room off the red-light strip, in a costume nobody has seen before.',
        'A note in the envelope mentions a videotape. Supergirl says she has no memory of the night. The city has seen enough Polaroids to make up its own mind.'],
    },
    after: '<b>The Polaroids and the blackmail note are on your act board</b> (MAP → ACT BOARD). The cassette label names the <b>High-Roller Suite</b>: the clues point to the casinos.'
      + '<span class="hint">Your reputation is in the gutter, and for once that helps: the casino and the worst clubs only open to a disgraced hero, and only then will you find the pieces of your stolen suit.</span>',
  },
  // every gate met: the hotel's new floor lights up
  lair: {
    paper: {
      headline: 'MIRRORS ON THE TOP FLOOR', rep: 0, photo: 'special',
      sub: 'The hotel in the Villains\' Lair lights a floor of mirrors. The cult\'s "Supergirl" is booked into the penthouse',
      body: ['Guests report purple neon and mirrored corridors on a floor that wasn\'t there last week.', 'The woman in the penthouse signs the register "Supergurl". She is wearing the real suit.'],
    },
    after: 'The hotel\'s new floor is lit: <b>the hall of mirrors</b>, where Supergurl waits in your stolen suit.<span class="hint">The hall of mirrors is still being built. Your patrol goes on.</span>',
  },
};

/** suitFind's toasts: a copy (finds 1-4) or the real piece (find 5). */
export const LINES = {
  copy: [
    'A stained copy, but the stitching points to the next one.',
    'Close, but not hers. A laundry tag on it names another address.',
    'Another fake, and a clue in the pocket.',
    'Lipstick on the collar, and a receipt from somewhere else.',
  ],
  real: 'It\'s hers. Stained, but hers.',
  wrong: 'Not hers. The S is the wrong shape.',
};
