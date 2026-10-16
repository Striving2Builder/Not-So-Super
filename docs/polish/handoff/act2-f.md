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

## Done (2026-10-16)
- `src/asylum2.js` (new): `Act2Asylum`, made in `AsylumZone.enter` when `game.act.two.on()` and the
  opening is done; kept across sedations. Intox held ≥ haze+12 (enters at haze+25); the doctor's intro
  dialog with a Polaroid "proof" (alias Candy/Roxy/...), captions, her thought bubbles every ~18 s;
  X-RAY ? / HEAR ? (slot5) say "What's going on? Where are my powers?"; a Supergirl poster in a free
  cell (hotel `posterCanvas` + `spotCall`): right call = SHE REMEMBERS, powers back for the visit,
  `game.act.suitFind(cape|boots|briefs by counts.asylum % 3)`; wrong = alert +10, a new picture
  (obvious after 2 misses). With powers HEAR toasts the nearest clue + orderly. Crime spree:
  `two.spree(1)` every 16-24 s with a MEANWHILE caption; HUD sub shows powers + spree.
- Hooks in `src/asylum.js` (+9 lines, all `this.a2?.`): enter, setupControls, setXray, update,
  announce, placeClubGameplay (`a2.place(cells)`), objectives, hud.
- `src/act/act2run.js`: `spree(n)` (B.spree, default 0 via norm), board line in the ab-jig.
- `src/main.js` debugZone: `?zone=asylum` (with `&act=act2`: opening marked done, rep −50).
- Harness: `node tools/shots/act.js --flows act2asylum` (Act 2 visit + Act 1 asylum has no layer).

## Next / notes
- Debug: `?act=act2&zone=asylum&flight=2d`.
- Sedation cutscene/TV untouched (user's wiring); on waking a doctor caption instead of a dialog.
- Not done: spree crimes as map missions (later job), red spree markers on the map.
