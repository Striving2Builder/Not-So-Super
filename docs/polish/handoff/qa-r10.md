# QA round 10 handoff (cloud session 3, branch `cloud/qa-r10`)

Ran every harness tool on **phase-2** (1e65910) and on an **integration build**: a local scratch branch
(not pushed) = phase-2 + `--no-ff` merges of `cloud/city-r10` (c18058f) → `cloud/flight-r10` (ef424de) →
`cloud/hero-r10` (c2577e0). Headless Chromium + SwiftShader (`--use-gl=swiftshader` works as is; no
WebKit in the cloud image, so `stab.js --browser chromium`). Both builds ran side by side (4 cores):
fps below are rough and only compare the two builds.

## Merge conflicts (city → flight → hero)
- **city-r10**: clean. **flight-r10**: clean. `tools/shots/shoot.js` auto-merges: city's `--only a,b` list
  and flight's boost wait (`cam.boostK > 0.9`). `tools/shots/flybench.js` is byte-identical on all three
  branches (blob 1d77e2a), so it never conflicts.
- **hero-r10**: one file, **`src/herofly3d.js`**, 2 hunks:
  1. `POSE`: flight adds `flesh` + `inkPx` (pads her on-screen box) and drops `shadow` (its drop shadow
     no longer reads `POSE.shadow`); hero adds `idleYaw` + `stretch`. **Keep the union without `shadow`**
     (nothing reads it after the flight merge; `grep POSE.shadow src` is empty).
  2. `LINE`: both set `halo: 0`; hero adds `near`, `min`, `hull` (read by its `keyline()` and ink-hull
     thinning). **Keep hero's line.**
  The rest of herofly3d auto-merges and reads right: flight's `update(h, dt, t, diving, spot, ...)` +
  `SHADOW` + `screenRect()`; hero's `idleK`/`boostK`/stretch, `light()`, own hull clone. The hero
  box (`screenRect`) takes the cape cloth's vertices, so hero's longer cape stays inside it (checked
  on the integration `fly3d_boost_1`/`cruise_1` crops: no clipped cape or limbs).
- No conflicts in settings.js / ARCHITECTURE.md this round.

## Results (phase-2 vs integration)
| Tool | phase-2 | integration | Notes |
|---|---|---|---|
| shoot.js flying (11 scenarios) | pass, 0 errors, 22/22 frames | pass, 0 errors, 22/22 | fly3d fps ~+10–20% (flight-r10 hero pass); calls ±4, tris ±5% |
| shoot.js premade3d (3) | pass | pass | |
| shoot.js selfbuilt3d (4) | pass | pass | |
| shoot.js brawler (5) | pass | pass | |
| shoot.js investigation (12) | pass | pass | |
| shoot.js nightlife (5) | pass | pass | |
| brawlrun.js (9 crimes × ipad/phone) | 17/18 | 14/18 → **18/18 with the qa fixes** | see bugs 1–2; phase-2 phone_heist = bot heuristic, below |
| clubreach.js (3 clubs × day/night, 25 layouts) | 0 bad | 1 bad (triangle guard waypoint) | not a regression: random layouts, see issue 3 |
| stab.js --tour 8 | pass, ends in 3D, 0 errors | pass, ends in 3D, 0 errors | GPU res MB after title→fly 90 → 72 (flight's smaller hero target) |
| stab.js --lose | pass (restore / never rebuild / nogl → 2D + toast) | same | the 2 "errors" are the context-creation failures the nogl case forces |
| dive.js (10 cases: brawl/club/cold/inv/spec × 3d/2d) | 10/10, 0 errors | 10/10, 0 errors | right mode at the end of every case |

**No regressions from the night branches**: everything that passes on phase-2 passes on the integration
build. The integration-only brawlrun failures were bug 1 (a phase-2 bug the random fights happened to
hit there) and its knock-on (bug 2).

## Bugs fixed (committed on cloud/qa-r10, 6c3997d)
1. **Freeze breath revived a KO'd crook** (`src/brawler.js`, breath loop): it froze any `!dead` crook in
   its cone, including one KO'd (`down`, hp ≤ 0) and still falling. `frozen` replaced `down`, so he never
   died. 2.2 s later he stood back up at hp ≤ 0 and held the wave and arena lock open. brawlrun: ipad_fire and
   phone_fire stalled at 3/5 fires, with the next fire behind the lock (dump: two arsonists `frozen` with hp −1).
   Fix: skip crooks that are `down` or at hp ≤ 0. **Proof:** a repro (scratch `freezeko.js`: fire brawl,
   KO a crook with `damage(e, 999, true)`, breathe on him for 5 s of 60 Hz updates) gives
   phase-2 code `states: down → frozen → approach, dead: false` and fixed code `states: down, dead: true`.
   Then brawlrun on integration + fix: **18/18** (fire 41 s / 36 s).
2. **brawlrun.js left dialogs open** (tool bug): `.first()` over `'#modal-root button, #modal-root .opt,
   #modal-root > *'` picks in document order, i.e. the dialog's own wrapper, which ignores clicks. After
   a stalled brawl, the "Mission failed" dialog stayed up, paused the game, and the next brawls (ipad
   heist, mob) hung on LOADING for 240 s. Fix: `tapModal()` tries the option, then the button, then the
   wrapper (the newspaper). Proof: the same 18/18 run, plus the STALL shot showing the dialog over
   "BANK HEIST" before the fix.

## Issues for the director (not changed)
3. **Club placement pool has 3 unwalkable points (triangle)**: clubreach reports `poolNotWalkable: 3` on
   both builds (pool 816 vs walkable 813). Layouts use unseeded `Math.random`, so now and then a guard
   waypoint lands on one (integration run: seed 17, guard waypoint (1.8, 14), y 0.01; 1 of ~186 waypoints).
   Low impact (guards walk, and she can reach him on the other leg). Fix: intersect `ClubZone.walkFloor` with
   the collide() flood in `clubgeo.reachableFloor`, or re-roll a route leg whose end fails the 0.8 m reach.
   Not fixed: placement code, and it is intermittent.
4. **brawlrun stall heuristic vs boss fights**: phase-2 phone_heist "stalled" at 3/4 waves with the boss
   in `getup` at hp 106. Progress only counts waves, captives and fires, so a boss fight longer than 45 s
   of wall time under load trips it. It passed on rerun (integration + fix, 121 s). Suggest `--stall 90`
   when the machine is loaded, or count boss hp as progress.
5. **phase-2 `fly3d_boost` shots are cruise** (known; fixed by flight-r10's shoot.js wait). Compare boost
   frames only after flight-r10 is merged.
6. stab tour: three's `textures` after title→fly is 43 on integration vs 30 on phase-2, while GPU res MB
   is lower (72 vs 90). Likely the city's lot-variant canvases (city says same sizes) or timing. Check
   with `?perf=1` on the iPad.
7. Visual (director's eye, not judged here): flight-r10's dive (camera rise, ground rush) combined with
   hero-r10's arms-overhead dive pose and 30% longer streaming cape is untested together by any critic.
   Sheets: `shots/qa-dive-integ/*.png` after re-shooting locally.

## Perf (flybench, integration vs phase-2, 6 rounds, run alone)
PENDING (filled when the run ends).

## Recommended merge order
city-r10 → flight-r10 → hero-r10 (as tested), resolving herofly3d as above, then cloud/qa-r10 (touches
only brawler.js 1 line + brawlrun.js; no overlap with the night branches).
