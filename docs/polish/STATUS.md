# Polish pass: status and handoff

Read this first when picking the polish pass up in a new thread. Last updated 2026-10-02, during
flight/city round 6. The companion docs are [BRIEF.md](BRIEF.md) (the builder brief),
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
| 3D flight + city | **3** (r6fly, 8/8 identified at 98–99%) | Earlier rounds scored 3–4. Top tell: the hero looks pixelated. 3D beats 2D in blind tests 6/6. |
| Brawler | round 3 merged, not re-critiqued | Painted façades + bug fixes |
| Investigation (day) | round 3 merged, not re-critiqued | Painted rooms; the flat code-drawn witness is the weakest part |
| Premade 3D, self-built 3D, nightlife, night case | ~2.5–3, paused | 3D perf regression and Triangle Club draw-call doubling not fixed |

## Builds
- `testdrive-2026-10-02`: the first test build (3D flight default, brawler round 3, billboard/asylum beats).
- `testdrive-2026-10-02b` (15d95a7): adds flight 5/5b, city round 5 and investigation round 3.

## In flight right now (round 6)
- **Flight builder** (flight3d, flightcam3d, herofly3d, heropass3d, flightfx3d, flightpost3d, sky3d):
  - hero crispness (top: why does heropass3d output look pixelated? Density vs dynRes, quad filtering, texture, outline)
  - a flowing cape instead of the flat kite seen at high patrol
  - lit clouds
  - a safe zone away from the caption and joystick
- **City builder** (city3d, buildings3d, blocks3d, signs3d, landmarks3d, skyline3d, skycard3d, street3d, ground3d, outer3d, river3d):
  - crisp near walls (the `mag` threshold and dynRes)
  - window shimmer and the orange street "waffle" at altitude
  - closing off the world-edge void
  - a stronger sun/moon key with 3-tone faces
  - the floating low-rise slabs by day
  - one ink style in the casino district
  - the blue river restored in the 2D view

If a new thread starts before they report, check for their worktree branches
(`git branch --list "worktree-*"`; `git log phase-2..<branch>`). Merge what's committed and
re-brief fresh builders from this file for anything unfinished.

## Backlog (rough priority)
1. Next flight/city rounds from the critic list: the hero render, near walls, altitude noise, lighting, clouds.
2. Director items:
   - The caption sometimes appears clipped at the left edge in shots (slide-in captured mid-animation?).
   - The district caption can lag the district name.
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
