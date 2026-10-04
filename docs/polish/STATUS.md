# Polish pass: status and handoff

Read this first when picking the polish pass up in a new thread. Last updated 2026-10-03 (end of the
round 7–8 thread). The companion docs are [BRIEF.md](BRIEF.md) (the builder brief),
[ARCHITECTURE.md](ARCHITECTURE.md) (module map and target layout), [ASSETS.md](ASSETS.md) (incoming
art) and the per-builder handoffs in [handoff/](handoff/).

## Pick up here (new thread)
Everything below is merged into `phase-2` and tagged `testdrive-2026-10-04`.
0. **Running: iPad black screens + freezes builder** (handoff `docs/polish/handoff/ipad-mem.md` on its `worktree-agent-*` branch). The user's iPad still went black and froze while flying on a build that **already had the stability fix** (tested ~midnight 2026-10-04 = `testdrive-2026-10-03` / phase-2 at that time). Scope: on-device diagnostics (`?perf=1` + a copyable pause-menu log: context losses, worst frames, GPU MB, heap), gentler iOS memory handling (rebuilds spread over frames, longer keep, stand-ins never holes), an iOS memory cap (smaller ground textures/render targets, no reallocation on dynRes steps), and any black-frame path without a context loss. Top priority; merge it before anything else.
1. **Waiting on the user's iPad test** of `testdrive-2026-10-04` with `?perf=1`: fps + worst frame per altitude, `tex`, `gl ctx`, the dive thud (sound never heard by a human), hover/perch, a brawl with a gunman and a skipped captive, club raids/night cases (nothing on stages, load time OK).
2. **Perf over budget vs round 7:** skim 0.90, cruise 0.97, high 0.91. The city alone is ~on budget; **her sharp pass costs 23–30% of the frame at high patrol** (canvas-density hero pass + MSAA + outline). Next perf step: a cheaper hero pass on Balanced/Battery (lower density, no MSAA or 2×, cheaper outline), keep High. Confirm against the iPad numbers first (Apple GPUs make MSAA cheap). Clouds may be trimmed for perf (user OK'd).
3. **Then, per the proposed order below:** a fresh blind critic; the 3D rooms round (perf first, own critic); motion/feel (dive done; fight hit feedback, audio review); flight visuals round 10.

Merged in this thread (details in the sections below and the handoffs): stability (774c006), hero variants Classic/Ponytail, Supergirl look pass, city round 9, comic dive landing (`src/divefx.js`), iPad device fixes.

## Merged in the round 7–9 thread (2026-10-03/04)
- **Stability: merged** (774c006). City GPU memory budget (`KEEP` in city3d.js: 30 detailed blocks / 40 ground tiles, unseen 4 s → freed and rebuilt), 1 WebGL context flying / 2 in a brawl (shared offscreen sprite renderer `offscreen3d.js`), lost-context recovery with a "RESTORING GRAPHICS…" card (`gfx.js`), LOADING card + staged zone loads, iOS caps (Auto → Balanced, flight canvas ≤2×, FXAA), crash-reload drops Auto to Battery saver once. Perf bisect brought 3D flight back to 0.92–1.00 of round 7 (high patrol still 8–12% under: ~25% more triangles from round-8 city content; the user chose to **trim** it). Tools: `tools/shots/stab.js` (`--tour`, `--lose`), `flyab.js`, `flytoggle.js`, `serve.js`. Handoff: `docs/polish/handoff/stability.md`.
- **City round 9: merged** (2026-10-04, handoff `docs/polish/handoff/city-r9.md`): high-patrol trim (detail by draw range within 470/800 m and below 340 m; LOD by 3D distance above 340 m), shader facades (no stripes/moiré; atlas now roofs only, −3.5 MB), haze graded horizon → darker ground air, `FarRing` skyline cylinder (skycard3d.js), 3-band key light + night window wash, black box = billboard back (fixed), neon dim by day, river quay + park paths. **Perf vs round 7 still over budget:** skim 0.90, cruise 0.97, high 0.91 (city alone: 1.01 / 0.96 / 0.93). **Her sharp pass now costs 23–30% of the frame at high patrol** (hero pass at canvas density + MSAA + outline): the biggest remaining perf lever. Open: dark-blue triangles (pair 8) cause unknown, venue neon posts as thin yellow lines at dusk, uniform far-ring row by day, pale day haze ~1 km.
- **Supergirl look pass: merged** (2026-10-03): flight body language (`src/heropose3d.js`: roll/pitch/yaw springs + cruise/boost/dive/glide/hover/turn bone poses, also drives the 2D flight sprite), solid hair shell + comic face paint + flat colour blocking in `supergirl.glb` (14.3k tris, 2.35 MB; pipeline `tools/supergirl/`), `src/herolook3d.js` cel material (golden flight hair palette), cel sprites in 2D/brawler/portraits, narrower cape. Hero lab: `node tools/supergirl/lab.js --label X --port 8812`. Open: the hair reads as a smooth cap in flight (wants lock shapes/strands at the silhouette), jagged hair hem, subtle boost pose from the chase cam, Classic/Ponytail still on the old hair cards. Handoff `docs/polish/handoff/supergirl.md`.
- **Comic dive landing:** `src/divefx.js` (tunables `DIVE_FX`), capture tool `tools/shots/dive.js` + `sheet.py`, handoff `dive.md`.
- **Hero variants:** Classic/Ponytail restyles (`tools/heroskins/`), pause menu "Hero", `?hero=`.

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
- **Shot options:** shoot.js pins dynamic resolution for fly3d shots (`?dynres=off`, so shots show phone sharpness); `--query k=v` appends to every scenario URL (e.g. `--query hero=ponytail`).
- **Round-vs-round perf A/B:** `git archive <commit> | tar -x -C <scratch>/rX` for each side, then run `node tools/shots/fly3d.js --port <p> --rounds 3` in each copy, alternating, on unique ports. fly3d.js does not pin dynRes.
- **Real phones:** `?perf=1` shows fps, worst frame, 3D scene scale, draw calls, triangles and texture count (src/perfhud.js). Ask the user for these numbers.
- **Blender:** Blender 5.2 with the MCP addon (protocol 13) is used by hero builders (`tools/heroskins/`). No image-to-3D generator is enabled (Rodin trial out of funds, no Hunyuan keys, no Premium for Tripo).
- **Machine load:** fps is noisy while other builders run. Use paired or alternating A/B runs before calling something a regression.

## Standing user decisions (don't re-litigate)
- **3D flight:** real 3D (three.js) and the default; `?flight=2d` keeps the old view. The Superman UE5 demo is the north star for feel; the blind bar is LEGO Batman mobile, GTA mods, Spider-Man, Prototype and Saints Row IV. The comic-book style stays.
- **Priority:** flying + city buildings + gameplay first. **Character art is delayed**, but hero *render quality* (aliasing, pixelation) is fair game.
- **Story through video:** the LIVE feed panel and video keyed into green screens tell the story. Never shrink, hide or move them.
- **HTML5 is the platform (2026-10-03):** the goal is "as close to AAA as an HTML5 game can be", not AAA. Every brief has a perf budget (≤5% fps per round unless the user agrees), and the director **raises a flag to the user** whenever a change costs fps, GPU memory or download size, or when a critic's ask isn't feasible in a browser. Filter critic asks for HTML5 feasibility before briefing. Real-phone numbers come from `?perf=1` (fps + worst frame, 3D scene scale, calls, triangles, textures).
- **Area order (2026-10-03):** flying + city and the 3D rooms (premade 3D clubs, self-built 3D zones, nightlife, night case) come first. **Brawler streets and investigation rooms are on hold** until those are better.
- **High patrol detail (2026-10-03):** trim the round-8 city detail at high patrol to get back within ~5% of round 7 (perf over detail there).
- **Clouds (2026-10-03):** good enough as they are; don't spend rounds on them. They may be dialled down (fewer, simpler, cheaper) whenever that helps performance. Drop cloud items from critic briefs.
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
- `testdrive-2026-10-02c` (dc6e56c): adds the crisp hero, city round 6 and flight round 6. The user tested on an iPad (see "Device testing").
- `testdrive-2026-10-03` (774c006): rounds 7–8, hero variants (pause menu "Hero"), iPad stability, `?perf=1`.
- `testdrive-2026-10-04`: adds the Supergirl look pass, city round 9, the comic dive landing and the iPad device fixes. **Latest; the user should iPad-test it.**

## Device testing (2026-10-03, iPad, real device)
- "Plays but crashes and is a bit janky." Diving from flight into a brawler/activity: very long load or freeze. 3D flight: after a few freezes or a black screen it goes back to 2D.
- Director's read: no `webglcontextlost` handling; 4 WebGL contexts (special3d shared, HeroSprite, brawlsprite, an unreleased `hasWebGL()` probe); the 3D flight scene stays in GPU memory inside zones; High runs the canvas at full Retina density. A stability builder is on it (WebKit iPad repro, context-loss recovery, fewer contexts, iOS caps, staged zone loading).

## Device testing, round 2 (2026-10-03, iPad) — fixed and merged 2026-10-04
- Fixes (handoff `docs/polish/handoff/devfix.md`): a real superhero hover pose (also on the perch descent and the 2D sprite); brawler camera follows her in a dead band (the "auto-advance" was a camera lead + view clamp, worst on 4:3 iPad), crooks share her fight bounds, gunmen stay on screen, off-screen >6 s safety net, HELP! arrow to skipped captives; clubs place everything only on floor reachable from the entrance (`reachableFloor()` in clubgeo.js; 0.3–1.7 s at club load). Tools: `tools/shots/brawlrun.js` (plays brawls to completion), `tools/shots/clubreach.js`. `brawler.js` is ~900 lines: split it when brawler work resumes.
- Original notes:
- Flight idle/hover pose "looks like she is standing on air".
- Brawler: the auto-advance that pushes the player forward skips hostages and other things — remove it, the player walks the level.
- Brawler: tends to stall near the end; the player has to quit the mission to get out.
- 3D clubs: items/objectives sometimes spawn on a stage the player can't climb — don't place them there, or add stairs.
- A device-fix builder is on all four (handoff `docs/polish/handoff/devfix.md` on its `worktree-agent-*` branch). These are gameplay bugs, so they're fixed even though brawler/investigation visual polish is on hold.

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

## Proposed order after the current builders (director's recommendation, 2026-10-03)
1. Tag the iPad build; get the user's `?perf=1` numbers and a first-load time on mobile data.
2. 3D rooms round (clubs, self-built 3D zones, nightlife, night case): perf first (Triangle Club draw-call doubling), plus their own blind critic (never had one).
3. Motion/feel round: dive transition into zones (**done and merged 2026-10-03**, `src/divefx.js`, tunables in `DIVE_FX`; capture tool `tools/shots/dive.js` + `sheet.py`; to tune on the iPad: holdMs, shake, push, wipeMs, word size; the thud sound is untested by ear: a comic "THUD" landing — hit-stop, shake, impact flash, inked shockwave, onomatopoeia burst, low boom, panel wipe merged with the LOADING card; handoff `docs/polish/handoff/dive.md`), fight hit feedback (hit-stop, shake, sound), an audio review, judged by frame-sequence critiques + the user's play notes.
4. Flight visuals round 10 from the next blind critic (no cloud work; clouds can be trimmed for perf).

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
- The iPad model and which build was tested (asked 2026-10-03, unanswered); `?perf=1` numbers from the next test build.
- Optional hero models from Meshy (the user has access); they drop into the same hero slot as Classic/Ponytail.
- The narrative story draft, which will define villains/enemies/NPCs (not before).
- A decision on the office "blackmail" packs. Style note: the photoreal asylum/office stills clash with the comic look, and some show a trademarked "S" shield.
