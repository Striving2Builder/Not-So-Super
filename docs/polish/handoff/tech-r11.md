# Tech debt, round 11 (track T): remove the 2D club (v2) and the premade clubs (v1)
Branch `worktree-agent-a047ac9311b1f985f` (from phase-2 0cc680e). Brief: docs/polish/ROUND11.md (T).

## Done (WIP commit 1)
- main.js: no more `?club=`, `CLUB_VERSION`, `game.newClubs`, modes `club` / `nightcase` / `nightclub`.
  Club venues (special or night case) → `club3`. 3D club fails to start → `supergirl-club3-fail` in
  localStorage + toast "Couldn't open the club…" + back to the sky (was: the 2D club).
- Fixed: a night club case's front page said "undefined, undefined, exposed as…" (victoryPaper).
- clubzone.js: only the ClubZone engine the asylum + hotel use (loading bar, shader warm-up,
  planLayout/walkFloor, placeItems, BVH collide/LOS/camera, slice plane). Gone: CLUBS, loadClub,
  preloadClub, decode queue, material simplify, mergeStatic use, raid layout, ClubMood.
- nightcase.js: NightCase = the asylum's detective base (+ nightCaseFields for map night cases).
  Gone: the premade-club layout (clue props, containers, witness, chalk, tents, beams).
- Deleted: clubmood.js, clubdress.js, nlclub.js (code-built Nightclub decor: only ?club=v1 reached
  it), nightclub/{nightclub,stage,intox,crowd,layout}.js. Trimmed: nightclub/blackout.js → polaroid,
  nightclub/rooms.js → PLATE.dir, clubgeo.js (− mergeStatic, packFloor, unpackFloor).
- data.js: premade venues keep everything read (`club: true` flag, bg, wall, themes…; − floor,
  lights); NIGHT_CASES → name + crime; NIGHT_JOBS gone. settings.js: − clubTex/clubCache/
  clubMaterials/clubLights/heroSprite. overworld.js: − club preloading, − newClubs checks.
- Tools deleted: shots/{nightclub,clubcase,clubreach}.js, nightclub/layoutcheck.mjs, bake_clubs.js,
  bake.html, slim_clubs.js, export_club.py, tools/package(-lock).json (only bake/slim used them).

- Docs: README, ARCHITECTURE.md (+ "Zones" routing note), nightclub.md / nightclub-2d.md status,
  CLOUD.md (clubreach.js gone). Harness (shoot.js): premade3d keeps its name (it already shot the 3D
  club, mode club3); investigation/nightcase was failing (club3 has no clueObjs): now a plain night
  club case; the clue + X-ray shots moved to selfbuilt3d/asylum (opens the clue's cell first).
- Also: the Nightclub venue drops floor/lights (it only plays the 3D club now).

## In progress / next
- After-run: shoot.js ×6 areas + club3d.js + act.js with `--label r11T-after`, ports 8911–8913;
  the new asylum/nightcase shots on the frozen baseline as r11T-before2/3 (port 8914).
- Regression pack shots/r11T-pack/ (≥12 before/after pairs: club, flight, asylum, hotel) + pack.md.
- Assets now unreferenced → handoff list (never delete under assets/).

## Numbers
- Baseline `shots/r11T-before` (frozen copy of 0cc680e): every area ran; premade3d = club3 (mode club3).
- Startup JS: 161 → 153 modules reachable from main.js, 2,480,534 → 2,300,245 bytes (−180 KB).
