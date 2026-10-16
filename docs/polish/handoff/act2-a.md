# Act 2 job A: the skeleton (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 1, job A, and "The contract between A and I"); the design is
docs/design/act2.md (gates table, opening, pendulum, phases A and I).

## Scope
- `src/act/act2.js`: ACT2 meta (title "Not So Super", boss "Supergurl", drug "Super Squirt"), GATES
  (asylum 6, clubs 8, casino 6, factory 2, rldwalk 3, investigations 3, promotions 4, polaroids 12,
  suit 5 pieces × 5 finds), BEATS and lines (the opening, the Polaroids + blackmail note as first clues).
- The runtime runs per act: Act 1 untouched for a save mid-Act-1; Act 2 starts after `act.complete()`.
  New state fields with defaults; old saves load.
- The opening scandal sets rep to −50; the act starts with the opening RLD Walk (contract with I).
- `suitFind(piece, real)` hook (state only). Counting missions per Act 2 gate.
- The act board's Act 2 page (gates, impostors' rep placeholder, suit progress as text for now).
- `?act=act2`, `?act=act2lair`, `?act=act2boss`.

## Done
(nothing yet)

## Next / notes
