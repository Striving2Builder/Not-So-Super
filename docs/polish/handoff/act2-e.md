# Act 2 job E: the factory production lines (handoff)

Brief: docs/polish/ACT2BUILD.md (job E); design: docs/design/act2.md ("The factory production lines"
under The venues; the drug Super Squirt, made by the cult leader Supergurl's people). Gate: 2 shutdowns.

## Scope
- Reuse Act 1's hotel engine (`src/hotel/plan.js`, `hotel.js`, the Floor 13 wings, Kell's hunt in
  `kell.js`) **without the ballroom**, re-themed as a drug factory: wings become production lines
  (conveyors, vats, pill presses, Super Squirt crates, hazard light), cult members in red robes as workers.
- **4 levers switched to green shut the line down** (one per wing). All 4 green → walk out → win.
- A **foreman** and guards take Kell's role as the hunters. Trap devices and the struggle stay.
- Win counts the factory gate: the zone sets `factoryLine: true` (or mode `factory`), see `act2run.js`
  `onZoneWin`. Keep one factory line on the map in the factory district while that gate is short (the
  way act2run keeps an RLD Walk on the map; a small edit there is OK).
- Act 1's hotel and Floor 13 must play exactly as before.
- Debug entry + a harness flow (enter, flip 4 levers, win; a capture + struggle).

## Done
(nothing yet)

## Next / notes
