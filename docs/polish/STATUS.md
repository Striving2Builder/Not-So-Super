# Polish pass: status and handoff

Read this first when picking the polish pass up in a new thread. Last updated 2026-10-02, after
flight/city round 6 was merged and blind-tested (the r7fly critic). No builders are running: the
next step is to start round 7 from "Next round" below. The companion docs are [BRIEF.md](BRIEF.md) (the builder brief),
[ARCHITECTURE.md](ARCHITECTURE.md) (module map and target layout) and [ASSETS.md](ASSETS.md) (incoming art).

## How the loop runs
- **Branches:** work happens on `phase-2`; `main` is the last release.
  - Each builder is a sub-agent in its own git worktree (`.claude/worktrees/agent-*`, branch `worktree-agent-*`).
  - The director (the main thread) merges each worktree branch into `phase-2` with `--no-ff`, re-runs the harness, looks at the frames and pushes.
- **Waves:** run builders in waves of at most 3, because usage limits are the binding constraint.
  - Builders commit WIP often.
  - When a session limit kills them, resume each with a message: "commit WIP, continue".
- **Each round:** builders → merge → harness → blind AAA critic → the critic's ranked fixes become the next round's briefs.
  - Critics are fresh agents.
  - They are told that comic ink/halftone and the LIVE/caption story devices are intentional.
- **Usual merge conflicts:** `src/settings.js` (keep one line per area per profile), `tools/shots/shoot.js` and `docs/polish/ARCHITECTURE.md`.

## Harness (SwiftShader: compare fps between runs, never against a phone)
- **Screenshots and metrics:** `node tools/shots/shoot.js <area> --label <name> --port <unique> [--only <scenario>]`.
  - Areas: `flying premade3d selfbuilt3d brawler investigation nightlife`.
  - Output goes to `shots/<label>/<area>/` (PNGs + metrics.json with fps, calls, triangles, errors).
- **3D vs 2D flight:** `node tools/shots/fly3d.js --port <p> --rounds 6` gives the 3D/2D fps ratio per altitude band, how many incident beams are visible from high patrol, and time to a waypoint.
- **Blind AAA pairs:**
  1. Copy the shots into the folder the script reads:
     `mkdir shots/<label>/flying3d; cp shots/<label>/flying/fly3d_*.png shots/<label>/flying3d/`
  2. Build the pairs: `python tools/shots/blind.py flying3d <label> --pairs 8`
  3. Hand the critic `shots/blind/flying3d-<label>/` only.
  
  The answer keys are in `shots/keys/`; never show them to a critic.
- **Reference pools:** `docs/references/<area>/`; the AAA flight refs are in `flying3d/`.
- **Known artifact:** a black rectangle under the LIVE panel in headless shots. It is a compositor copy of the feed `<video>`: hiding the video removes it, and the DOM position is correct. It is not a game bug. Still to do: confirm on a real phone.
- **Machine load:** fps is noisy while other builders run. Use paired or alternating A/B runs before calling something a regression.

## Standing user decisions (don't re-litigate)
- **3D flight:** real 3D (three.js) and the default; `?flight=2d` keeps the old view. The Superman UE5 demo is the north star for feel; the blind bar is LEGO Batman mobile, GTA mods, Spider-Man, Prototype and Saints Row IV. The comic-book style stays.
- **Priority:** flying + city buildings + gameplay first. **Character art is delayed**, but hero *render quality* (aliasing, pixelation) is fair game.
- **Story through video:** the LIVE feed panel and video keyed into green screens tell the story. Never shrink, hide or move them.
- **Brawler:** keep the procedural streets and mix the painted façades in.
- **Asylum:** after sedation, a forced, unskippable 30 s clip plays on the cell TV.
- **Billboards:** losing a street fight (health 0) plays your footage on the district's billboards.
- **Office "blackmail" image packs:** undecided; not in the repo.
- **Architecture:** the user wants good file structure. Split files past ~800 lines, no cross-area imports. The `src/` folder reorganisation in ARCHITECTURE.md is planned but not applied: do it when no builders are running.

## Scores (blind AAA critic, 1–10; "identified" = critic picked the AAA image)
| Area | Latest | Notes |
|---|---|---|
| 3D flight + city | **3.5** (r7fly, 8/8 identified at 100%) | History: 3–4, then 3 (r6fly, "pixelated hero"), then 3.5 after the crisp-hero fix. Hero now "cleaner but not clean". The top tell is now the blurry, upscaled city. 3D beats 2D in blind tests 6/6. |
| Brawler | round 3 merged, not re-critiqued | Painted façades + bug fixes |
| Investigation (day) | round 3 merged, not re-critiqued | Painted rooms; the flat code-drawn witness is the weakest part |
| Premade 3D, self-built 3D, nightlife, night case | ~2.5–3, paused | 3D perf regression and Triangle Club draw-call doubling not fixed |

## Builds
- `testdrive-2026-10-02`: the first test build (3D flight default, brawler round 3, billboard/asylum beats).
- `testdrive-2026-10-02b` (15d95a7): adds flight 5/5b, city round 5 and investigation round 3.
- `testdrive-2026-10-02c` (dc6e56c): adds the crisp hero, city round 6 and flight round 6. **This is the latest build;** the user should phone-test it.

## Round 6 (done, merged)
- **Flight round 6: done and merged** (dc6e56c; files flight3d, flightcam3d, flightpost3d, herofly3d, heropass3d, sky3d, settings.js).
  - **Root cause of the "pixelated hero":** her sharp pass was composited onto a low-DPR canvas (Balanced 1.0, canyons 0.75, dynRes down to 0.8) that the browser upscaled.
  - **Now:** the canvas stays at a fixed density (new key `fly3dOut`: High 3, Balanced 1.5, Battery saver 1.5). Only the scene renders smaller (`fly3dDpr` × dynRes, floor 0.65) into an offscreen target, then FXAA and a bilinear upscale. The hero pass renders at canvas density with MSAA (`fly3dHero` High [4,1], Balanced [2,1]), tone-mapped in-pass.
  - **Also:** a cape with an arched cross-section and an S-wave around a straight spine line; lit and mirrored cloud puffs with constant ~2 px ink; a central safe zone for the hero (cruise (0.5, 0.58), high (0.52, 0.56), patrol (0.55, 0.58)).
  - **Perf:** 3D/2D is about 1.01–1.11, down from 1.4–1.6; the fixed-density canvas costs fill. Waypoint 7.3 s vs 8.6 s.
- **City round 6: done and merged** (ec553af; files city3d, buildings3d, blocks3d, skyline3d, skycard3d, ground3d, river3d, city.js, cityart.js).
  - crisp near walls (per-axis magnification), row-averaged far windows (no shimmer), a lit avenue every 4th street with dim side streets
  - the sea fades into the haze; a horizon glow band sits in the skycard; key light ×1.4 by day and dusk; contact rims under low-rise
  - casino palette fixed; the 2D river is blue again
  - perf: +1–7% against the round's start
  - its notes for flight: the post pass's speed streak softens the nearest wall when skimming; the horizon glow could move into sky3d
  - its next ideas: painted daytime sign boards for casino/neon, taper the river at the bay, setback-tier collision

All worktree branches from round 6 are merged. A new thread should spawn **fresh** builders
(old agents can't be resumed across threads) and give each this file plus BRIEF.md.

## Next round (7): briefs from the r7fly critic, ranked
**Harness caveat first:** SwiftShader is slow, so dynamic resolution sits at its 0.65× floor in every
shot, and the critic sees a much blurrier city than a phone would. Before judging blur, pin dynRes in
the harness (e.g. a `?dynres=off` or fixed-scale URL hook used by shoot.js/fly3d.js) so shots show
what a phone shows. Keep the dynRes logic for real devices.

1. **Background resolution and AA (flight builder, flightpost3d):** the city reads as "blur, not depth"; near and mid buildings are as soft as far ones, and both soft and jaggy.
   - Upscale with a sharpening filter (CAS-style) instead of plain bilinear, and/or raise the scene floor on Balanced.
   - Building edges must stay crisp at every distance.
2. **Real aerial perspective (city builder):** blend colour toward the sky or horizon *and* lower saturation and contrast with depth, over about 40–70% of draw distance, while edges stay sharp.
   - Fix the near-black ground slab (pair 1) and the yellow streak on a near wall (pair 3).
3. **Cape (flight):** still a flat, rigid, stripe-banded trapezoid that dominates her silhouette; the body is ~30% of her on-screen area.
   - Use a tapered mesh of 3+ segments with folds and a two-tone cel ramp from real normals, not fixed stripes.
   - Narrow it at the shoulders and cap its length at ~1.2× body length.
   - Collapse its width when seen side-on.
4. **Hero readability (flight):** ~1.3× larger on screen in cruise and skim. Add a rim or inner light on the side away from the camera. Give the hair 2–3 cel tones with a darker underside so the head reads as a solid shape.
5. **Clouds and speed lines (flight):**
   - Cloud fills must be as crisp as their ink.
   - A hollow, outline-only cloud lying across the city (pair 8) is a fill/sync bug.
   - The screen-wide hard white boost lines read as glitches: shorten and taper them, keep them out of the central ~60%, and fade them in at the edges only.
6. **City hierarchy (city):**
   - rooftop clutter (water towers, AC units, antennas, setbacks)
   - distinct landmark tops per district
   - dark street lanes with car-light streaks
   - one glowing district while the rest recede

## Backlog (rough priority)
1. Flight/city round 7 (above).
2. Director: the district caption can lag the district name. A caption clipped at the left edge in
   shots is just its slide-in/out animation caught mid-way; that's by design, not a bug.
3. Brawler round 4:
   - painted blocks by day (lit windows, brightening)
   - a wet reflective street from the red-light paintings
   - cache the fire gradients (a fire fight dropped to ~10 fps)
   - check the per-image ground lines
4. Investigation round 4:
   - a witness that matches the paintings (shading and rim light at minimum)
   - searched props react on the painting
   - shots of `alley_2` and `apartment`
5. Asylum: use the `assets/asylum/cell/` stills as the "back in the cell" backdrop. Capture room: wire `assets/capture/room-2000.webp` (tap spots need re-mapping) and its green-screen TV.
6. Paused areas: premade 3D, self-built 3D, nightlife, night case (perf first).
7. Apply the `src/` folder reorganisation (ARCHITECTURE.md) when no builders are running.

## Waiting on the user
- Video clips in `assets/video/AsylumTV/`, `assets/video/Asylum/` and `assets/video/Billboards/`, then run `node tools/build_video_manifest.js`. Until then the screens show static.
- A real-phone check of the LIVE panel (headless black box) and of the hero's sharpness in flight.
- A decision on the office "blackmail" packs. Style note: the photoreal asylum/office stills clash with the comic look, and some show a trademarked "S" shield.
