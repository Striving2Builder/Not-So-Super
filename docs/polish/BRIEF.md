# AAA polish pass: builder brief

Goal: take each core area of *Not So Super* as close as an HTML5 mobile game can get to the look and
feel of AAA superhero games (LEGO Batman: Beyond Gotham on mobile is the primary bar; Arkham
Asylum/City, TMNT: Shredder's Revenge, Streets of Rage 4, Telltale Batman and Marvel Snap are style
references) **while keeping our comic-book identity**: bold ink outlines, halftone, POW! bursts, yellow
narrator captions, saturated pulp colour. We are not chasing photorealism; we are chasing *finish*:
lighting, depth, juice, animation, composition, readability.

The flight and brawler modes stay 2D canvas, but should read "as close to 3D as we can mimic":
parallax, depth shading, drop shadows, perspective, lighting, and the real 3D models rendered as
sprites. The zone interiors are three.js.

## Story is told through video (user's design — protect it)
The LIVE city-feed video panel and videos keyed into green-screen images (billboards, the asylum
cell TV, the capture room) are the game's narrative channel. Never shrink, hide, move or
"declutter" them; critics must not penalise them; build around them.

## Hard constraints
- **Mobile first.** Test at 844x390 landscape, touch. Text and targets must stay readable and
  tappable. Nothing may break the touch controls or the HUD layout.
- **Performance budget.** Run the harness for your area before you change anything (your baseline)
  and after. Your area's fps must not drop more than ~10% below the baseline, and 3D draw calls must
  not balloon. Expensive effects (post-processing, extra lights, particles-heavy stuff) must be gated
  on the graphics profile: `quality()` from `src/settings.js` (`high` / `balanced` / `saver`); add
  profile keys there if you need them (additive only).
- **Gameplay unchanged** unless your brief says otherwise: same objectives, same controls, same
  difficulty. Don't break saves (`state.js`).
- **No new runtime dependencies** beyond what's in `vendor/` (three.js + addons are there). No CDNs.
- Assets you add must be small (keep any new file under ~500 KB; prefer procedural/canvas art).
- Match the surrounding code style (see the existing files: terse, commented "why", no frameworks).

## File ownership (edit only your files; tiny hooks elsewhere are OK if unavoidable — list them in your report)
| Area | Owns |
|---|---|
| flying | overworld.js, sky.js, atmosphere.js, airspace.js, airevents.js, paparazzi.js, city.js, flight.js, cityfeed.js, cape.js, HeroSprite in hero3d.js |
| premade3d | clubzone.js, clubgeo.js, club asset tooling in tools/ |
| selfbuilt3d | special3d.js (renderer, lights, camera, rooms, hero/NPC rendering, UI hooks), asylum.js, enemies.js, HeroModel in hero3d.js |
| brawler | brawler.js, art.js |
| investigation | investigate.js, nightcase.js, casefile.js, leads.js, newspaper.js |
| nightlife | nightlife.js (the code-built Nightclub / Gentlemen's Club / Red Light Den / High-Roller Suite decor + show), plus nightlife-specific atmosphere inside the premade clubs via small hooks |
| director (shared) | style.css (append area-specific CSS at the end in a block headed `/* === <area> === */`), ui.js, comic.js, index.html, main.js, settings.js (additive keys only) |

The 3D base class in special3d.js is shared by premade3d, selfbuilt3d, investigation (nightcase)
and nightlife. selfbuilt3d owns it; others should add hooks/overrides in their own files.

## Architecture
Read docs/polish/ARCHITECTURE.md: module boundaries, the target folder layout (the director moves
files between rounds; don't move files yourself), split files past ~800 lines, no cross-area imports.

## Harness
`node tools/shots/shoot.js <area> --label <you>-r<N> --port <yourPort>` → `shots/<label>/<area>/`
(PNGs + metrics.json with fps, draw calls, triangles, page errors). Look at your own screenshots
(Read the PNGs) after every meaningful change. Reference images: `docs/references/<area>/` and
`docs/references/comicstyle/`.

## Each round, report back
1. What you changed (files, one line each) and why, in terms of what a player sees.
2. Before/after metrics for your area (fps, calls, triangles) and any page errors.
3. The screenshot paths of your best "after" frames.
4. What you'd do next.
Commit your work on your branch with a clear message before reporting.

## Handoff file (required)
Keep `docs/polish/handoff/<area>-r<N>.md` on your branch: what's done, what's in progress, next
steps, best shots and perf numbers, under ~40 lines. Update and commit it with every WIP commit, so a
fresh agent can continue from it plus `git log` alone if you're cut off.

## HTML5 budget (required)
This is an HTML5 game played in a phone browser. Target "as close to AAA as HTML5 allows". Report the
cost of every change (fps A/B, draw calls, triangles, texture memory, download size) and stay within
≤5% fps per round unless told otherwise. If an ask can't be done cheaply in a browser, say so and
propose the cheap version instead of shipping the expensive one.
