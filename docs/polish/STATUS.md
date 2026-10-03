# Polish pass: status and handoff

Read this first when picking the polish pass up in a new thread. Last updated 2026-10-03: round 8 is
merged (all three builders) and blind-tested (r9fly: 4.0 vs AAA, 6.5 vs the best HTML5 games).
**Top priority now: iPad stability** (see "Device testing"). Running: a stability builder
(`handoff/stability.md`) and a Supergirl visuals builder (`handoff/supergirl.md`). Hero variants Classic/Ponytail are merged (fc7c052; pause menu "Hero", `?hero=`). The companion docs are [BRIEF.md](BRIEF.md) (the builder brief),
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
- **Character focus (2026-10-03):** Supergirl only for now (renders, visuals, animation feel). NPCs, enemies, villains and other characters wait until the user drafts the narrative story, which will define them. The current hero redesign is a Supergirl enhancement round (`handoff/supergirl.md`), not a new character.
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
| 3D flight + city | **4.0** vs AAA, **6.5** vs best HTML5 (r9fly, after round 8) | History: 3–4, 3, 3.5, 4.0 (r8fly), 4.0 (r9fly). Sky/sunset better; night skyline sells the comic look. Tells now: one stiff hero pose/silhouette, striped window textures (moiré), the fog void + coloured lot tiles at the world edge, no key-light direction or window bloom, cloud inner outlines. |
| Brawler | round 3 merged, not re-critiqued | Painted façades + bug fixes |
| Investigation (day) | round 3 merged, not re-critiqued | Painted rooms; the flat code-drawn witness is the weakest part |
| Premade 3D, self-built 3D, nightlife, night case | ~2.5–3, paused | 3D perf regression and Triangle Club draw-call doubling not fixed |

## Builds
- `testdrive-2026-10-02`: the first test build (3D flight default, brawler round 3, billboard/asylum beats).
- `testdrive-2026-10-02b` (15d95a7): adds flight 5/5b, city round 5 and investigation round 3.
- `testdrive-2026-10-02c` (dc6e56c): adds the crisp hero, city round 6 and flight round 6. **This is the latest build;** the user should phone-test it.

## Device testing (2026-10-03, iPad, real device)
- "Plays but crashes and is a bit janky." Diving from flight into a brawler/activity: very long load or freeze. 3D flight: after a few freezes or a black screen it goes back to 2D.
- Director's read: no `webglcontextlost` handling; 4 WebGL contexts (special3d shared, HeroSprite, brawlsprite, an unreleased `hasWebGL()` probe); the 3D flight scene stays in GPU memory inside zones; High runs the canvas at full Retina density. A stability builder is on it (WebKit iPad repro, context-loss recovery, fewer contexts, iOS caps, staged zone loading).

## Round 8 (done, merged; 2026-10-03)
- **City** (315b5d0): painted comic street-map ground (streets, sidewalks, parking, trees, farm patchwork), river water shader with irregular banks, car glows (the "border lines" and speckle were car streaks), window moiré fade, per-vertex contact shading, cornice trim. Ground textures ~20 MB GPU (was ~11).
- **Sky** (1559463): keyframed day/sunset/night sky with an inked sun, SDF cel cloud atlas (8 shapes, 3 tones) with placement rules, haze starts at 1.4× camera height, additive tapered speed lines, 4-tap sharpen on High. Shared haze colours live in sky3d's `SKY` table.
- **Hero** (merged after 1559463): 3/4 rear-side chase camera (elevation/azimuth caps, shoulder swap before lifting when occluded), one ink outline round body + cape (~5% fps), cape notch fix, hem lift, slow billow.
- **Perf flag (confirmed):** alternating `fly3d.js` A/B, round 7 (02d2bb0) vs round 8: 3D/2D ratio skim 1.05 → 0.79, cruise 0.95 → 0.81, high 1.03 → 0.82 (−15–25%, over the 5% budget); calls +5–10, triangles +5–15%. Suspects: 4-tap sharpen on High, hero outline dilation, SDF cloud shader, ground textures. The stability builder is bisecting and bringing it back within ~5%.
- **r9fly critic fixes (next flight round, filter for HTML5 cost):** 1) hero pose blends (bank into turns, boost/hover poses) and silhouette; 2) window textures: mipmaps + anisotropy, cell shapes not stripes, cap halftone cell size up close; 3) fill the fog void: far skyline ring cards, darker/desaturated far lots, haze toward the sky horizon colour; 4) a clear key-light ramp per face + cheap night window glow; 5) clouds as one union (no inner outlines), cull tiny far clouds; 6) speed lines radial from the vanishing point, boost only. Bugs: a big black box behind her (pair 1), dark-blue triangles at both screen edges and yellow lines in a canyon (pair 8).

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
1. iPad stability (above), then flight/city round 9 from the r9fly list.
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
