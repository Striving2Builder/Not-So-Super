# Tech debt, round 11 (track T): the 2D club (v2) and the premade clubs (v1) are gone
Branch `worktree-agent-a047ac9311b1f985f` (from phase-2 0cc680e). Brief: docs/polish/ROUND11.md (T). Done.

## Done
- main.js: club venues (raid or night case) → `club3`, nothing else; no `?club=`, `CLUB_VERSION`,
  `game.newClubs`, modes `club`/`nightcase`/`nightclub`. 3D club can't start → `supergirl-club3-fail`
  in localStorage + toast "Couldn't open the club…" + back to the sky (was: the 2D club + a dialog).
  Fixed: a night club case's front page read "undefined, undefined, exposed as…" (now the raid paper).
- clubzone.js = the engine the asylum + hotel stand on (BVH collision, floor scan, slice plane,
  loading bar, placeItems). nightcase.js = the asylum's detective layer + nightCaseFields.
- Deleted (src): clubmood, clubdress, nlclub (code-built Nightclub: only ?club=v1 reached it),
  nightclub/{nightclub,stage,intox,crowd,layout}. Trimmed: blackout.js → polaroid, nightclub/rooms.js
  → PLATE.dir, clubgeo.js (− mergeStatic/packFloor/unpackFloor), data.js (club venues: `club: true`,
  − floor/lights; NIGHT_CASES → name+crime; − NIGHT_JOBS), settings.js (− clubTex/clubCache/
  clubMaterials/clubLights/heroSprite), overworld.js (− club preloading, − newClubs).
- Deleted (tools): shots/{nightclub,clubcase,clubreach}.js, nightclub/layoutcheck.mjs, bake_clubs.js,
  bake.html, slim_clubs.js, export_club.py, package(-lock).json. Harness: shoot.js nightcase (failing
  at 0cc680e) → a plain night club case; clue + X-ray shots → the asylum; club3d.js clears the map
  before spawning its club (spawn() could return null in a crowded nightclub district: a flake).
- Docs: README, ARCHITECTURE.md ("Zones" routing), nightclub.md / -2d.md, CLOUD.md.

## Numbers
- 18 files deleted; src 36,942 → 33,788 lines. Startup JS (static graph from main.js): 161 → 153
  modules, 2,480,534 → 2,300,381 bytes (−176 KB).
- Harness r11T-before (frozen 0cc680e) vs r11T-after: shoot.js 6 areas 0 → 0 page errors, failed
  scenarios 1 → 0; club3d.js 0 → 0 errors, 5 rooms + 16 flows pass; act.js 11 flows, 0 → 0. Club
  rooms' calls/tris ±1%; fps noisy (other builders, a machine sleep mid-run; no render code changed).
- Regression pack: shots/r11T-pack/ (23 before/after pairs + pack.md).

## Assets the user can delete (unreferenced now; 28.08 MB) — never deleted by T
- assets/clubs/: triangle.glb 4.75 MB, triangle.lite.glb 4.75, clubhouse.glb 7.83, clubhouse.lite.glb
  3.81, stripclub.glb 3.67, stripclub.lite.glb 1.83, triangle/clubhouse/stripclub.json 0.06,
  replacements/ (10 PNGs) 0.77.
- assets/nightclub/plates/entrance.jpg 0.44 MB, set_main.jpg 0.17 MB (the 2D club's; set_main.mp4 stays).
- Local only (gitignored): assets/models/3D Nightclubs/ (raw club .blends, ~1.8 GB) if still on disk.

## Next (round 2)
- Split overworld.js (1,103 lines), brawler.js (911); watch special3d.js (791), buildings3d.js (759).
- When files may move: rename for what they are now (clubzone → building zone, NightCase → the
  asylum's, src/nightclub/ → club3d data, `this.club` → `this.building`, venue kind 'premade' → 'club').
- Zone mode 'nightcase' = a club mission after dark: could be a flag; a real club-case front page.
- Dead one-liners: frameSize (brawlsprite.js), venueLight (venues3d.js); randi (util.js) kept for V.
- Harness: premade3d → `clubs`; nightcase duplicates it (pin a story club); club3d.js's `club=v3` is
  ignored now. Director docs: STATUS.md club line, BRIEF.md ownership rows.
