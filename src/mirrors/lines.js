// The Supergurl fight's words (docs/design/act2.md "The cast", "The hotel's new floor and the boss"; job H2).
// Supergurl accuses the real Supergirl of everything Supergurl did herself: the Polaroids, the tape, the
// crime spree, Super Squirt, the stolen suit. Supergirl answers back. One exchange per phase of the fight;
// each answer has a sober and a hazy version (over INTOX_HAZE it gets harder to deny). PG-13.
// `g` = Supergurl's line, `s` = her answer sober, `h` = her answer high (falls back to `s`).

export const EXCHANGES = {
  // the door opens: she's on the dais in the coat and the red mask (the Polaroids)
  door: { title: 'SUPERGURL', lines: [
    { g: 'There she is. The girl from the Polaroids. Bar tops, back rooms, a different stranger in every frame. The whole city has seen them, sweetie.',
      s: 'Those are your pictures. You staged every one of them.', h: 'Those were… your pictures. Weren\'t they?' },
    { g: 'My pictures? I\'ve been cleaning up after you for months. Somebody had to keep the S out of the gutter.',
      s: 'You put it there. You and your camera crew.', h: 'You put it there. I think. You and the cameras.' },
    { g: 'Look at you. A crop top from a costume shop, and you call ME the fake.',
      s: 'Take off the mask and say that.', h: 'Take off the mask. Let me see which one of us you are.' },
    { g: 'Come and take it, little copy.', s: 'Gladly.', h: 'Hold still.' },
  ] },
  // the coat and the mask come off: the stolen suit underneath
  reveal: { title: 'THE REVEAL', lines: [
    { g: 'There. Is this what you wanted to see? Your suit. It fits me better than it ever fit you.',
      s: 'That\'s my suit. You took it off me while I couldn\'t stand.', h: 'That\'s my suit. You took it while I… I can\'t remember.' },
    { g: 'Took it? You threw it at me, darling. On the bar at the Gilded Cage, in front of everyone. You don\'t remember? Funny, that.',
      s: 'I remember enough. That\'s your lipstick on my S.', h: 'I remember the lipstick. On the S. That was yours.' },
    { g: 'Every stain on this suit is yours, babe. Every night. Every drink.',
      s: 'Then I\'ll take them back with it.', h: 'Then I want them back. All of them.' },
  ] },
  // the mirrors start to multiply her (the tape, the crime spree)
  mirrors: { title: 'IN THE GLASS', lines: [
    { g: 'And then there\'s the tape. Shall I play it at your trial? The city is dying to know what its hero does after hours.',
      s: 'There is no tape of me. You wrote that note yourself.', h: 'There\'s no tape. Is there? You made it. You made all of it.' },
    { g: 'The crime spree, then. Jewellers, a bank, a police car on a roof. Every witness saw the S. Every camera.',
      s: 'They saw you. In my suit. While I was locked up in Ravenmoor.', h: 'They saw you. I was in Ravenmoor. I was… I was locked up.' },
    { g: 'Locked up for your own good, sweetheart. Even the doctors could tell.',
      s: 'The doctors work for your gang. I know whose side they\'re on.', h: 'Your doctors. Your gang. Your… everything.' },
  ] },
  // over the haze line (Super Squirt)
  haze: { title: 'THE HAZE', lines: [
    { g: 'Look at your eyes. Pink to the edges. How much Super Squirt did you have tonight? The stash, the darts, the drinks…',
      s: 'You dosed me. Every one of those was you.', h: 'I didn\'t… I didn\'t take it. You put it everywhere.' },
    { g: 'I cook it, you swallow it. So which one of us is the addict? The papers already have their answer.',
      s: 'The papers will print the truth when you\'re in cuffs.', h: 'The papers… will print the truth. When you\'re in cuffs.' },
    { g: 'Which one of us will they cuff? Pick. If you can.', s: 'Watch me.', h: 'I can. I will.' },
  ] },
  // the takedown
  end: { title: 'SUPERGURL', lines: [
    { g: 'You can\'t prove it was me. Not the pictures, not the tape, not the spree. The city will always wonder.',
      s: 'Let them wonder. They can wonder while you\'re behind bars.' },
    { g: '…It looked better on me.', s: 'It looks better on Supergirl. The real one.' },
  ] },
};

/** Bubbles during the fight, by phase: her taunts and Supergirl's comebacks (alternating). */
export const TAUNTS = {
  coat: ['Smile for the Polaroid!', 'Every bar top in town knows your face.', 'Kneel. The cameras love you on your knees.', 'You\'re the fake. Say it.'],
  suit: ['My suit, my city.', 'Your cousin\'s S looks good on me.', 'The tape\'s the best thing you ever did.', 'Who robbed the bank, Supergirl?'],
  haze: ['Which one am I?', 'Pick one, babe.', 'Have another squirt.', 'Look in the glass. That\'s an addict.'],
};
export const COMEBACKS = {
  coat: ['Nice coat. Hiding something?', 'Your pictures, your lies.', 'I\'ve met better fakes at the casino.'],
  suit: ['Give it back.', 'That\'s MY S.', 'You can\'t wear my name.'],
  haze: ['Focus… focus.', 'Backwards. The fakes are backwards.', 'The real one has a reflection.'],
};

/** The struggle (captive moments): why she's held, by what put her there. */
export const CAPTIVE = {
  wrong: { title: 'WRONG ONE!', text: 'The reflection you picked steps out of the glass and pins your arms. Supergurl laughs from somewhere behind you.' },
  over: { title: 'IN THE GLASS', text: 'Your knees go. Supergurl kneels over you with a Polaroid camera. "Say Super Squirt!"' },
  grab: { title: 'CAUGHT!', text: 'She gets you in a hold, your own cape across your throat. "Feel that? That\'s how it fits me."' },
  fail: ['The camera flashes. Somewhere, a new Polaroid is drying. She steps back into the mirrors to pose.', 'You wake on the wet tiles by the door. She\'s straightening her S in the glass.'],
};

/** The call over the haze line: the hint, and what she says when it's right or wrong. */
export const CALL = {
  title: 'WHICH ONE IS SHE?',
  hint: 'Reflections get everything backwards: the cord, the lipstick on the S. Tap the real Supergurl.',
  right: ['Got you.', 'There you are.', 'The real fake.'],
  wrong: ['Wrong one, babe!', 'Kiss the glass!', 'Backwards, sweetie.'],
};

/** The act's end: the papers, then the card. */
export const ENDING = {
  paper: {
    headline: 'THE REAL ONE', rep: 80, photo: 'hero',
    sub: 'Cult leader "Supergurl" arrested in the hotel\'s hall of mirrors; the stolen suit returned to its owner',
    body: ['Police led a woman in a long black coat out of the hotel in the Villains\' Lair at dawn. Officers found a cult\'s robes, a darkroom of Polaroids and a lab cooking Super Squirt on the top floor.',
      '"The pictures, the tape, the crime spree: it was her, in a stolen suit," said the Commissioner. Supergirl was seen leaving by the roof, in her own costume, stains and all.'],
  },
  suit: 'Your suit. The original. Somebody else\'s lipstick on the S and a cocktail down the skirt, but it\'s <b>yours</b>.',
  card: { title: 'END OF ACT 2', name: 'Not So Super', text: 'Supergurl is behind bars and the cult\'s robes are evidence. The suit is back where it belongs.' },
};
