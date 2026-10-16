# Act 2 job A: the skeleton (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 1, job A, and "The contract between A and I"); the design is
docs/design/act2.md (gates table, opening, pendulum, phases A and I).

## Done (2026-10-16, all harness flows pass, 0 console errors)
- `src/act/act2.js`: data (ACT2 meta, GATES 6/8/6/2/3/3/4/12/25, PIECES, CLUES, BEATS opening/morning/lair, LINES).
- `src/act/act2run.js`: the `Act2` runtime (`game.act.two`), state in `state.act.act2` (an Act 1 save has
  none, so it loads and plays exactly as before; `norm()` fills new fields on old Act 2 saves).
- `act.js`: hands over once `A.done && A.act2` (update, play, onZoneWin, Polaroids, board); `complete()`
  calls `two.begin()`; new `suitFind(piece, real)`, `count(id, n)`, `title()`, `A2`.
- Opening: title card, rep set to −50 (toast), then the walk (`opening: true`, redlight spot, hero
  moved there); no `rldwalk` mode → a toast and straight on. Back in the sky (any outcome): the
  tabloid + "The first clues" (Polaroids + note on the board, the lead = the casinos).
- Gates: asylum (mode), rldwalk (mode), casino (`zone.casino`, mode 'casino' or venue kind casino),
  clubs (club venues/cases, not casino), factory (mode 'factory' or `zone.factoryLine`),
  investigations (investigate/nightcase on smuggle/spiked, drug themes, or `zone.drugCase`),
  promotions via `game.act.count('promotions')`, polaroids via the cult Polaroid call, suit = finds.
- `suitFind(piece, real=true)`: +1 find (max 5; the 5th = the real piece back), a toast; `real:false`
  counts nothing. Aliases ('red skirt' → skirt); an unknown piece → the furthest-behind of cape/boots/briefs.
- Keeps one RLD Walk on the map while that gate is short (`actGate: 'rldwalk'`), once the mode exists.
- Board page 2 (gates, rep + impostors' rep placeholder = −rep − 10×promotions, suit as text, clues),
  "Act 1" / "Act 2" buttons between pages. Pause menu note = `game.act.title()` (main.js, 1 line).
- `?act=act2` (opening plays), `?act=act2lair` (every gate met → the lair beat), `?act=act2boss` (+ bossReady).
- Harness: `node tools/shots/act.js --flows act1save,act2,act2gates,act2handoff` (Act 1 flows still pass).

## Notes for job I (the contract, as built)
- A looks for zone fields at `game.rldWalkFields(opts)` or `game.modes.rldwalk.fields(opts)`; set one
  in main.js next to the mode. The opening calls `game.startZone(z)` with `z.opening === true`
  (read it as `p.zone.opening`). `modeFor` must map `rldwalk`. A owns placing walks on the map.
- Call `game.act?.suitFind?.(piece, true)` on a right pick.

## Next (later phases)
- B: real impostors' rep (replace `impRep()`), promotions call `count('promotions')`.
- C2: the board's suit picture. D: casino zones set `zone.casino` (or call `count('casino')`).
- H: the hall of mirrors zone (Act 2 lair currently only lights the band + the beat; `bossReady`).
