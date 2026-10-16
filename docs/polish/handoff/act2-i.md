# Act 2 job I: RLD Walks (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 1, job I, and "The contract between A and I"); the design is
docs/design/act2.md ("RLD Walks" under The venues, and "The night she lost the suit").

## Done (branch act2-i, rebased on phase-2 5ca5eed: A merged)
- `src/rld/`: `plan.js` (the H: west + east streets, cross street, 22 rooms with red doors + big
  curtained windows + neon tubes/signs, 2 lead rooms at the north ends, the gate at the west street's
  south end), `art.js` (canvas textures), `walk.js` (RldWalk extends ClubZone; asylum.js untouched),
  `perfume.js` (hostesses + door vents, puffs, haze: sign smear + X-ray flicker), `opening.js`
  (`zone.opening`: tied up, Polaroids, the note + cassette), `whichone.js` (four copies cut from the
  SGCostume flat-lays, all stained; fakes: shade / sheen / stitching / mirrored S), `camera.js`
  (over-the-shoulder: Close at most, lower pitch, right-shoulder offset; `?rldcam=far` = old camera).
- Rescues: X-ray shows captives (cyan) and minders waiting behind doors (red); +4 rep each; freed
  women walk to the gate; all freed → green ring at the gate wins. Lead doors open only at rep < 0;
  a right pick calls `game.act?.suitFind?.(piece, true)` and adds to `zone.finds`.
- Capture: tied up in an empty room far from where she was caught, easy struggle (2 traces), fail or
  not she's out (fail = -2 rep), intox capped at 55; the 3rd capture throws her out (lose).
- Opening clues: `game.act?.openingClue?.('note' | 'polaroids')` if A adds it; also `zone.clues`.
- Hooks: main.js (import, `modes.rldwalk`, resize, `modeFor`, `game.rldWalkFields`, `?zone=rldwalk`
  `&opening=1` after the welcome), commentary.js (ZONE_OPEN.rldwalk captions). No data.js/style.css.
- Harness `tools/shots/rld.js` (flows walk, opening, capture, lead, asylum; port 8897: 8884 is taken
  on this machine): all 0 errors.

## Next / notes
- Device check: the close camera in the narrow streets, the which-one cards at 844×390, perfume rate.
- A: show the opening's note/Polaroids on the board (hook name above), and the walk's map spawn is A's.
- Ideas not built: stain flashback as a Recall clip (G), minders using the cast models, window
  silhouettes of captives (kept curtains drawn: X-ray is the way to see in).
