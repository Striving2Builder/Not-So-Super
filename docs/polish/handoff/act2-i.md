# Act 2 job I: RLD Walks (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 1, job I, and "The contract between A and I"); the design is
docs/design/act2.md ("RLD Walks" under The venues, and "The night she lost the suit").

## Scope
- New `src/rld/`: an H-shaped red-light street (two parallel streets joined by a cross street, rooms
  both sides) built on the asylum engine (`src/asylum.js`: generated building handed to the club engine,
  orderlies-style hunters, X-ray, captives, CaseFile). Reuse by extending or by lifting the layout into
  a plan, whichever keeps asylum.js working unchanged in behaviour.
- The look: large windows, red doors, red neon (reuse `nlredlight.js` dressing where it fits).
- Goal: free the captives (X-ray through the red doors). Rescues raise rep.
- House perfume: hostesses with atomizers + spray vents over some doorways; each spray adds
  intoxication (the existing meter); over the haze line the neon smears and X-ray flickers.
- Capture: she wakes tied up in a room; easy S-shield struggle (`src/club3d/struggle.js`), no sedation spiral.
- Lead doors: X-ray can't see through them; behind each a bigger room with "Which one is hers?" (four
  copies of a suit piece from `assets/SGCostume/` flat-lays, all may be stained, the tell is the
  make: S shape, shade of red, stitching, sheen). Lead doors open only while rep < 0.
- `p.opening`: the act's opening (woken tied up, Polaroids on the floor, the blackmail note).
- Try the over-the-shoulder zoom (the camera distance setting) on this level.
- Debug param to enter directly (e.g. `?zone=rldwalk`, `&opening=1`), plus a harness flow.

## Done
(nothing yet)

## Next / notes
