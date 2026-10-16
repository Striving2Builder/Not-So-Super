# Act 2 job H1: the hotel's new floor, the hall of mirrors (handoff)

Brief: docs/polish/ACT2BUILD.md (job H1; H2 = the Supergurl boss fight comes after, in the same
floor). Design: docs/design/act2.md ("The hotel's new floor and the boss", the content line).

## Scope
- When the Act 2 lair is open (`act2run.js` `lairOpen`, `?act=act2lair`), the hotel zone takes her to
  a **new floor** (Act 1's Floor 13 stays as it is): a **hall of mirrors**, built on the hotel engine
  (`src/hotel/plan.js` exports, the way `src/factory/` reuses it). New files under `src/mirrors/`.
- **The look** (user's mood reference, local and git-ignored, read it from the main checkout:
  `C:/Users/ngnic/Documents/App Projects/Sandbox - Top Down Super Flying Game/docs/references/user/act2-mirror-mood.jpg`):
  purple neon tubes, graffiti, wet reflective tiles, her reflection in the glass.
- **Reflections, phone-cheap:** no real-time mirror render targets on phones. Fake them: mirrored
  "rooms" behind glass with a cloned hero (and NPCs) mirrored across the plane, gated on `quality()`.
- **On the floor** (user): Supergirl-or-Impostor games (the call screen, `src/act/spot.js`),
  original-costume puzzles (reuse `src/rld/whichone.js`), drugs (a Super Squirt stash = intoxication),
  traps and captive moments (the S-shield struggle, `src/club3d/struggle.js`). Cult members (red robes)
  as the hunters, Kell's hunt code like the factory's `crew.js`.
- The floor ends at a sealed door to the **boss room** (left empty for H2; a stub that says so).
- Debug entry (`?act=act2lair&zone=mirrors` or similar) + a harness flow.

## Done
(nothing yet)

## Next / notes
