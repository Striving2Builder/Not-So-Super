# Polish pass: status and handoff

Read this first when picking the polish pass up in a new thread. Last updated 2026-10-02, after
flight/city round 7 was merged and blind-tested (the r8fly critic, 4.0). **Round 8 is running** (3 builders
in worktrees: city ground = brief 1 + city parts of 3/5/6; hero framing = 2; sky/clouds/post/speed
lines = 3/4/5/6). If they're gone in a new thread, check the `worktree-agent-*` branches for WIP. The companion docs are [BRIEF.md](BRIEF.md) (the builder brief),
[ARCHITECTURE.md](ARCHITECTURE.md) (module map and target layout) and [ASSETS.md](ASSETS.md) (incoming art).

## How the loop runs
- **Stateless by design (2026-10-03):** no step should need old chat history. The state lives in files:
  - this file (director state, scores, briefs), and each builder's `docs/polish/handoff/<area>-r<N>.md` on its branch (done / in progress / next / shot+perf notes), committed with every WIP commit.
  - **Director:** one round per thread is fine. Start a new thread with "Continue the polish pass: read docs/polish/STATUS.md". Update this file at each round boundary.
  - **After a session limit:** prefer a *fresh* builder pointed at its branch + handoff file (cheap, small context) over resuming a long transcript. Resume only if it was nearly done.
  - **Critics** are always fresh and see only the blind folder.
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
- **HTML5 is the platform (2026-10-03):** the goal is "as close to AAA as an HTML5 game can be", not AAA. Every brief has a perf budget (≤5% fps per round unless the user agrees), and the director **raises a flag to the user** whenever a change costs fps, GPU memory or download size, or when a critic's ask isn't feasible in a browser. Filter critic asks for HTML5 feasibility before briefing. Real-phone numbers come from `?perf=1` (fps + worst frame, 3D scene scale, calls, triangles, textures).
- **Shadows (2026-10-02):** no real cast shadow maps for now (too costly for HTML5); use cheap contact shading/AO. The user would love real sun shadows later if they become affordable.
- **Comic style stays** in every round (restated 2026-10-02): outlined, flat-shaded clouds and ink lines are kept; only their execution is fixed.
- **Brawler:** keep the procedural streets and mix the painted façades in.
- **Asylum:** after sedation, a forced, unskippable 30 s clip plays on the cell TV.
- **Billboards:** losing a street fight (health 0) plays your footage on the district's billboards.
- **Office "blackmail" image packs:** undecided; not in the repo.
- **Architecture:** the user wants good file structure. Split files past ~800 lines, no cross-area imports. The `src/` folder reorganisation in ARCHITECTURE.md is planned but not applied: do it when no builders are running.

## Scores (blind AAA critic, 1–10; "identified" = critic picked the AAA image)
| Area | Latest | Notes |
|---|---|---|
| 3D flight + city | **4.0** (r8fly, 8/8 identified at 98–99%) | History: 3–4, 3 (r6fly), 3.5 (r7fly), 4.0 after round 7. Night shots now "read as a stylised comic city"; day and high-altitude shots still "look like a prototype". Top tell: the board-game ground (flat lot tiles, pill-shaped river) seen from altitude. 3D beats 2D in blind tests 6/6. |
| Brawler | round 3 merged, not re-critiqued | Painted façades + bug fixes |
| Investigation (day) | round 3 merged, not re-critiqued | Painted rooms; the flat code-drawn witness is the weakest part |
| Premade 3D, self-built 3D, nightlife, night case | ~2.5–3, paused | 3D perf regression and Triangle Club draw-call doubling not fixed |

## Builds
- `testdrive-2026-10-02`: the first test build (3D flight default, brawler round 3, billboard/asylum beats).
- `testdrive-2026-10-02b` (15d95a7): adds flight 5/5b, city round 5 and investigation round 3.
- `testdrive-2026-10-02c` (dc6e56c): adds the crisp hero, city round 6 and flight round 6. **This is the latest build;** the user should phone-test it.

## Round 7 (done, merged; 2026-10-02)
- **Harness:** `?dynres=off` pins dynamic resolution at 1.0 (c1d53f0); shoot.js uses it for fly3d shots, fly3d.js (perf) doesn't. Shots now show phone sharpness. Baseline: `shots/r7base/`, merged round: `shots/r7/`, blind pairs: `shots/blind/flying3d-r7/`.
- **Hero/cape** (eaedffc): new `capefly3d.js` (7×7 folded, tapered cel-shaded cape to the knees, inked, flattens side-on); hero ~1.3× larger (chase/canyon camera ×0.77); full-outline rim light; 3-tone hair; hero pass sized by `FlyHero3D.RADIUS` 2.1 (was 3.4) to pay for the closer camera. Open: cape hidden from below; hangs straight in slow patrol; dark lining strip at hard banks; boot may touch the caption in close side-on shots.
- **City** (ce56633): aerial perspective in `buildings3d.js` (desaturate → flatten → haze over ~40–70% of draw distance; ink hazed less); sea only under the bay and river ring (fixed the pale-blue flood from altitude); no ground tiles past the coast (fixed the black slab); district crowns; roof clutter; night car streaks (`street3d.js`); neon odds set the night hierarchy; casino `districtGlow` dome. +6–10% triangles, fps within noise. Open: day haze very white ~1 km out; casino glow at 0.6 not re-shot; far streaks look like dashed red lines.
- **Post/clouds/speed lines** (merged after ce56633): CAS-style 2-tap sharpening upscale (`fly3dSharp` High/Balanced 0.6, Battery 0.5); boost smear limited to an edge ellipse and eased 75% in canyons; cloud ink fades before fill (hollow-cloud fix) and patrol drops whole clouds instead of ghosting all; wind streaks tapered, ≤9 m, outside the central 60%. ~4–6% fps. Open: only one diagonal is sharpened; Balanced canyons render at 0.5× canvas (`fly3dDpr` 0.75 vs `fly3dOut` 1.5) — raising to ~0.9 is the next sharpness win if perf allows.
- **Not yet attributed:** the thin orange line across towers in `fly3d_low_1` is downtown's neon trim ring at 30% height (`blocks3d.js` ~l.195, `#ff8a5a`), not the contrail.

## Next round (8): briefs from the r8fly critic, ranked
Filter for critics' asks that fight the comic style: outlined, flat-shaded puffs and ink lines stay; their execution (aliasing, repetition) is fair game. The caption clipped at the left edge is its slide animation (by design).
1. **Ground from altitude (city), the top tell:** the board-game look of flat coloured lot tiles with box buildings.
   - Texture the ground: streets, sidewalks, parking, tree clusters.
   - Water: an irregular shoreline, a darker deep tone, a sky reflection; remove the white dash pattern on the river (pairs 3, 5) and the pill shape.
   - Cut the red-white district-border lines by ~80% in 3D (keep them on the minimap). Also the "dashed red lines" of far car streaks and the red speckle noise on the far ground (pair 4).
2. **Hero framing (hero/camera):** keep her at ~18–25% of screen height in every band (high patrol and the patrol view still show her tiny); a 3/4 rear-side view, never straight down onto her back (pair 6: "an unreadable lump"); never hidden by a roof in front of her (pair 4: depth/occlusion — consider a silhouette or x-ray pass). Thicker outline on dark or busy backgrounds. Fix the white notch in the cape (pair 7).
3. **Daytime light (sky/post + city):** a blue gradient with a sun disc and warm horizon instead of the uniform pink-lavender wash; directional shadows or at least baked AO/contact shading on buildings; more value contrast near vs far; hide the moon by day. Re-check the day haze (very white ~1 km out) and the high-patrol haze that swallows most of the city.
4. **Clouds (sky):** no cloud within ~50 m of the camera (pair 1: a big cloud right under her); vary puff shapes and sizes; 2–3 tone shading (lit top, shadowed base); no pixel staircases on the ink (pair 4); a big dark-outlined cloud ring cut off behind the minimap.
5. **AA and texture filtering (post/city):** window moiré on near towers (pair 8): mipmaps/anisotropy or a distance fade for the window grids; ink width scaled with depth; noisy sketchy building ink (pair 6). Try the Balanced canyon scene-scale raise.
6. **Effects:** edge speed lines still read as "white paper shards" and stray white bars at the left edge (pairs 6, 8): thinner, additive, starting inside the frame; car streaks as soft additive trails, not opaque red rectangles; smaller headlight glow splats.

## Backlog (rough priority)
1. Flight/city round 8 (above).
2. Hero redesign round (after flight/city rounds; user confirmed this order 2026-10-03): the hero is a Mixamo-rigged GLB (`assets/models/supergirl.glb` + `supergirl_anims.glb`, loaded in hero3d.js; clips retarget via `heroRig()`; the flight cape is procedural in capefly3d.js). A new model on a Mixamo rig is a drop-in plus one round of shader retuning. User answer (2026-10-03): it's a personal learning project, so Supergirl stays for now; original characters come later. The user has other models in mind and also wants to test one generated here: an original comic-style hero behind `?hero=alt` for a phone A/B. Multiple playable heroes would need a select screen + per-hero story footage.
3. Director: the district caption can lag the district name. A caption clipped at the left edge in
   shots is just its slide-in/out animation caught mid-way; that's by design, not a bug.
4. Brawler round 4:
   - painted blocks by day (lit windows, brightening)
   - a wet reflective street from the red-light paintings
   - cache the fire gradients (a fire fight dropped to ~10 fps)
   - check the per-image ground lines
5. Investigation round 4:
   - a witness that matches the paintings (shading and rim light at minimum)
   - searched props react on the painting
   - shots of `alley_2` and `apartment`
6. Asylum: use the `assets/asylum/cell/` stills as the "back in the cell" backdrop. Capture room: wire `assets/capture/room-2000.webp` (tap spots need re-mapping) and its green-screen TV.
7. Paused areas: premade 3D, self-built 3D, nightlife, night case (perf first).
8. Apply the `src/` folder reorganisation (ARCHITECTURE.md) when no builders are running.

## Waiting on the user
- Video clips in `assets/video/AsylumTV/`, `assets/video/Asylum/` and `assets/video/Billboards/`, then run `node tools/build_video_manifest.js`. Until then the screens show static.
- A real-phone check of the LIVE panel (headless black box) and of the hero's sharpness in flight.
- A decision on the office "blackmail" packs. Style note: the photoreal asylum/office stills clash with the comic look, and some show a trademarked "S" shield.
