# Code architecture (polish pass)

The game is plain ES modules served as-is (no bundler), three.js from `vendor/` via the import map
in `index.html`. Keep it that way: small, focused modules with obvious homes.

## Target layout (applied by the director between rounds, when no builder is mid-work)
```
src/
  main.js                 boot, game loop, mode switching (stays at the root)
  core/                   shared, mode-agnostic: ui, input, settings, util, rng, state, data, sfx, media
  story/                  comic overlay + narration: comic, commentary, newspaper, cutscene, captured
  flight/                 the overworld: overworld, city, cityart, sky, atmosphere, airspace,
                          airevents, paparazzi, flight, flightaudio, nav, cityfeed
  three/                  shared 3D engine: special3d (zone base), look3d, hero3d, cape, enemies
  zones/                  3D zone types + their sets: clubzone, clubgeo, clubmood, venues3d,
                          nightlife, asylum, nightcase
  brawl/                  side-scroller: brawler, brawlsprite, brawlstage, art (2D humanoids)
  investigate/            crime scenes: investigate, crimescene, evidenceart, casefile, leads
tools/                    dev-only scripts (Blender export, slimming, harness in tools/shots)
docs/polish/              brief, architecture, round notes
```
Until the move happens, keep writing code as if it had: a new module belongs to exactly one of
these folders, and its imports should make sense from there.

## Rules
1. **One responsibility per module.** Game logic, rendering, and set dressing live in separate
   files (e.g. `brawler.js` = rules/state, `brawlstage.js` = backdrop, `brawlsprite.js` = sprites).
   If a file passes ~800 lines, split it along a seam before adding more.
2. **Dependencies point inward.** Area modules may import from `core/`, `story/` and `three/`
   (3D areas), and from their own folder. Never import another area's module (flight must not
   import brawl, zones must not import investigate, etc.). If two areas need the same thing, it
   moves to `core/` or `three/` — ask the director.
3. **Shared 3D look goes through `three/`.** Materials, ink, shadows, rim, grading, backdrop and
   camera helpers live in `look3d.js` / `special3d.js`; zones configure them (colours, strengths)
   instead of re-implementing them.
4. **Data over code.** Per-venue / per-district / per-enemy tunables are tables at the top of the
   module (or in `core/data.js` if gameplay reads them), not magic numbers scattered in functions.
5. **Quality tiers in one place.** Read `quality()` (core/settings) and branch on its keys; add a
   key to the profiles rather than checking the profile name inline.
6. **No hidden globals.** State hangs off the mode object or `game`; anything reset per zone is
   listed in the zone's reset block (Special3D.enter's `Object.assign`).
7. **Dispose what you create.** Anything added to a 3D scene is freed on exit (or detached if
   shared/cached); 2D caches have a size bound.
8. **Comments explain why**, match the surrounding terse style; no dead code or commented-out
   experiments left behind; debug/profiling helpers live in `tools/`, not `src/`.
