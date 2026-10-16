# Act 2 job G: Recall and the drug finds (handoff)

Brief: docs/polish/ACT2BUILD.md (job G); design: docs/design/act2.md ("The drug: Super Squirt",
"The night she lost the suit", the content line).

## Scope
- **The night, remembered:** the five beats of the night she lost the suit (the room spinning; drugs
  in the lounge and VIP area; blacking out in the dark room; waking in the red-light district in the crop
  top; the Polaroids and the blackmail note) are recovered one at a time. Act 2 state + a board line
  ("The night: 2/5 remembered"), with the recovered lines listed.
- **Memory clues:** in Act 2 venues (clubs, the casino, RLD Walks, the asylum), some clues only read
  while she's over the haze line (`INTOX_HAZE`), the way the Hive's `highOnly` works in `club3d/story.js`.
  Reading one plays a **flashback**: a frame from the hand-checked clips (`src/club3d/clips.js`) on the
  LIVE feed plus the next beat's line, ink-wash styled.
- **The stain on the real piece** in "Which one is hers?" (`src/rld/whichone.js`) and the casino tables:
  reading it while high is a memory clue too.
- **Drug stashes everywhere:** extend round 11's rooftop stash (flight moments, perching) and add stashes
  in the brawler's streets and the 2D investigations. Taking one = a dose of Super Squirt
  (+intoxication) and sometimes a flashback.
- **Not in this job:** the nightmare frame over the capture/sedation clips (that's the user's own clip
  wiring; leave it alone).
- Act 1 unchanged. A harness flow: a stash taken, a memory clue read over the haze line, the board line.

## Done (branch act2-g; the builder hit the spend limit while writing the flows; the director committed the
harness, ran it and merged: 2731420)
- `src/act/recall.js` (`Recall`, `game.act.two.recall`): `NIGHT` = the five beats; `RECALL` tuning; the board
  line "The night: n/5 remembered · <beat>"; `feed(beat)` = a clips.js frame on the LIVE feed + an ink-wash card.
- Memory clues: `memoryClue(zone, pos, where, what)` (sober: "it means something…", over the haze: a flashback);
  placed in club3d (club3d.js), the casino (casino.js), RLD Walks (walk.js), the Act 2 asylum (asylum2.js).
- Stain reads: `stainRead(g, where)` from Which one is hers? (whichone.js) and a won casino table (casino.js).
- Stashes: `STASH_ITEM` (+18 intox, a squirt); a rooftop stash on the map (`spawnStash`, `actDive: 'stash'`),
  in the brawler's streets (brawler.js, brawlactors.js) and the 2D investigations (investigate.js).
- Harness `node tools/shots/recall.js` (flows sky, club, act1): 0 errors.

## Next / notes
