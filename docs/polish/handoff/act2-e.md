# Act 2 job E: the factory production lines (handoff)

Brief: docs/polish/ACT2BUILD.md (job E); design: docs/design/act2.md ("The factory production lines"
under The venues; the drug Super Squirt, made by the cult leader Supergurl's people). Gate: 2 shutdowns.

## Done (2026-10-16, branch act2-e)
- `src/factory/` (new): `plan.js` (Floor 13's plan without the ballroom via the hotel's exported
  `Builder`/`Rect`/`quad`: a loading dock, the main hall, 4 lines with a belt down the middle, 6 bays
  each behind steel doors, the foreman's office, a lever per line), `art.js` (steel/hazard/concrete,
  per-line belt textures, Super Squirt posters), `crew.js` (the foreman + 2 guards = Kell's brain run
  per hunter, pink dart guns; 2 robed workers per line shout for the nearest hunter; punchable),
  `factory.js` (`FactoryZone extends HotelZone`, `factoryFields()`).
- Loop: each lever is padlocked; its key is in one of the line's bays (X-ray shows it through doors).
  Key + lever → green: the belt and bottles stop, the hazard light goes green, nearest hunter alerted.
  2 bays per line = traps baited with a sample (the struggle; fail = alarm). A dart = rep −3, intox
  +20 (cap 60), the captive clip, wake in a random bay with every door shut, one green lever back in
  the red (still unlocked). All 4 green → the green ring at the dock = win (`mode: 'factory'`,
  `factoryLine: true` → act2run counts the factory gate).
- Hooks outside src/factory/: `main.js` (mode, `game.factoryFields`, resize, `modeFor`, `?zone=factory`),
  `act2run.js` (`ensureFactory`: one line on the map in the factory district while the gate is short),
  `data.js` (VENUES 'Super Squirt Plant', `factory: true`), `overworld.js` (random spawns skip it),
  `commentary.js` (ZONE_OPEN.factory), `hotel/plan.js` (exports only), `hotel/kell.js` (optional
  `k.lines/k.speaker/k.name/k.pace`, defaults = Kell, so Act 1 is unchanged).
- Perf gates: phones (`balanced`) 1 worker per line, desktop 2; saver 1 guard + 3 bottles per belt;
  workers > 12 m away aren't drawn. Workers shout only in front (or < 0.9 m): sneak behind them.
- Harness: `node tools/shots/factory.js` (lines: locked lever, 4 keys + levers, the ring, gate +1;
  dart: trap + struggle won, darted → woke in a bay, lever reset; map: one line in the factory
  district; reach: every interaction + hunter graph edge walked with the game's capsule; a worker
  shouts → a hunter hunts, punched). All 0 errors; act.js hotel,kell,act1save,act2,act2gates pass.
- Debug: `?zone=factory&act=act2lair&flight=2d` (or `?zone=factory` alone, Act 1 state).

## Next / notes
- Draw calls vs the hotel at the same main-hall spot (desktop profile): 230 / 63k tris vs 192 / 35k
  (the extra = 3 hunters + workers, makeNPC ~4k tris each with ink). Phones draw fewer workers.
- Ideas not built: a worker's robe/mask texture (makeNPC gown + hood stand-ins), drug finds (job G)
  in the bays, a "memory clue" on the foreman's desk.
