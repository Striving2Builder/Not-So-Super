# Act 2 job F: the Act 2 asylum (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 3, job F); design: docs/design/act2.md ("The asylum" under The
venues). Ravenmoor (`src/asylum.js`) plays exactly as now in Act 1; in Act 2 (`game.act.two` live, see
`src/act/act2run.js`) a visit changes:

## Scope
- **Always intoxicated** inside (held above the haze line).
- **The story:** drugged and hypnotized into believing she's a working girl who dresses up as
  Supergirl. Captions, stills and her own lines; the doctors work for the paparazzi gang the cult runs,
  and they wave the opening's Polaroids at her as "proof". PG-13.
- **Powers gone:** X-ray and super-hearing buttons stay, but say "What's going on? Where are my powers?"
  (and a hearing line) instead of working.
- **A Supergirl costume clue** hidden in each visit (leaning on the Supergirl-or-fake games: a poster,
  the call screen). Find it: she remembers, powers back for the rest of the visit, and
  `game.act.suitFind('cape' | 'boots' | 'briefs')` (it refuses at rep ≥ 0, that's fine).
- **The crime spree while she's locked up:** a counter that rises during an Act 2 asylum visit, shown
  on the act board; small API in act2run.js (`spree(n)`), board line only. (Turning them into missions
  later is not this job.)
- Debug entry (`?act=act2` + the asylum) and a harness flow; Act 1's asylum flow must still pass.

## Done
(nothing yet)

## Next / notes
