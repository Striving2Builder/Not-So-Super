# Flight round 10 (cloud session, branch `cloud/flight-r10`)

Scope: STATUS "Round 10 review" → hero-pass perf (cycle 1), then F1 boost, F2 altitude cue, F3 dive
landing. F4 (camera) not touched (standing decision). Hero-owned files (herolook3d, heropose3d,
capefly3d) and city files untouched.

## Done
**Cycle 1: her sharp pass, cheaper on Balanced / Battery saver (High unchanged), S3 halo.**
- `herofly3d.js` `screenRect()`: her on-screen box from her bones + the cape cloth's vertices, padded
  (0.25 model m + 14 CSS px of ink). `heropass3d.js` clips her pass to it (never larger than the old
  bounding-sphere square). From the chase camera she's foreshortened: the pass shrinks from ~555×498
  to ~482×212 px at high band. Applies to every profile (no image change: checked in-page that her
  rendered alpha always sits inside the box, bands 0/1/2 + patrol view, fly/boost/hover/slow).
- `settings.js` Balanced `fly3dHero` [2, 1] → [0, 1, 1]; Saver [0, 1.5] → [0, 1, 1]: no MSAA, 1× density,
  plus a 1 px *inner* keyline (`heropass3d.js` `inkIn`): without MSAA her rim light left a hard white
  sliver along her silhouette; the ink eats 1 px into her edge and covers it. High stays [4, 1].
- S3 grey-white halo: it was the pass's deliberate pale night halo (`LINE.halo` 1.4 px, alpha .45);
  set to 0 on every profile (also saves 6 taps at night).
- Harness: `tools/shots/flybench.js` (from city-r10), `tools/shots/heroab.js` (hero-pass configs A/B'd
  inside ONE page, alternating; `--shots` crops, `--check` runs an in-page script). `v.noBox = true`
  turns the box off for A/Bs.

**Cycle 2: F1 boost + F2 drop shadow, first pass** (both small, done together).
- Harness bug: at SwiftShader fps the sim runs ~0.4× real time, so the `fly3d_boost` hold never reached
  the 300 boost speed: every earlier `boost_*` shot was really cruise. `shoot.js` now waits for
  `cam.boostK > 0.9`.
- F1 (`flightfx3d.js` drawLines, `flightcam3d.js`): black ink speed lines (28 tapered spindles from the
  vanishing point, drawn after the centre fade, stepping out of her screen ellipse), fading in with
  `boostK`; `boostK` eases in at rate 8 (~150 ms), boost pull-back 0.45 → 0.7 m.
- F2 (`flight3d.js` `shadowSpot`, `herofly3d.js`): the old contact blob sat straight under her, ~80°
  below the chase lens (never in frame). Now it's cast along a low light from behind her (1.8 m ahead
  per m down; straight down in the patrol view), ray-marched over roofs/streets (14 samples + 4
  bisections of `buildingAt`), hidden when the ray hits a wall; size 2.6 m + 0.07/m, opacity .8 → 0 by 130 m.

**Cycle 3: making F1/F2 land** (critic 2).
- F1: ink lines 40, half-width 2.2–4.8 px, length 0.5 H, start at 42% of each ray's edge distance (so
  they ring the whole frame, not just the corners); the boost dolly only compensates 60% of the lens
  (`dollyK`): she drops back ~15% while the city rushes out.
- F2: the blob was rendering but ~15 px wide (it lands ~100 m out): size now 2.8 m + 0.2/m above,
  opacity .95 → 0 over 6–160 m.

## Perf (flybench, Balanced, frozen pose, vs phase-2; head2 = head again, noise)
| band | phase-2 | cycle 1 (head / head2) | vs phase-2 |
|---|---|---|---|
| skim | 6.85 | 8.39 / 8.98 | ×1.27 |
| cruise | 6.38 | 8.04 / 7.95 | ×1.25 |
| high | 7.94 | 10.38 / 10.74 | ×1.33 |
Cycle 2 (F1+F2 first pass) vs phase-2: skim ×1.29, cruise ×1.27, high ×1.34 (a probe ran alongside: ratios only).
Cycle 3 vs phase-2: skim 6.87 → 8.68/9.01 (×1.29), cruise 6.31 → 7.73/7.88 (×1.24), high 7.72 → 10.07/10.21
(×1.31): F1/F2 cost nothing measurable (+1 call: the shadow is back in frame).
Cycle 1 calls/tris identical (57/82/66 calls); no new render targets (her target only shrinks: GPU memory down).
Battery saver (flybench `--graphics saver`, rounds 5): skim 8.34 → 9.88/9.50 (×1.16), cruise
8.86 → 9.96/10.19 (×1.14), high 10.74 → 12.81/13.47 (×1.22).

In-page heroab (same frame, Balanced, ms/frame): high band 125 → 90 ms (×1.40), cruise 153 → 125
(×1.22). Box alone ×1.05–1.08; MSAA 2× → none is the bulk in SwiftShader. On Apple GPUs MSAA is
cheap, so the real-device gain will be smaller (mostly the box + density): confirm with `?perf=1`.

## Critic scores (fresh sonnet critic, new shots only, vs best HTML5/WebGL)
- Cycle 3: 6.5/10. F1 "partial": a visible change, but lines still read as shards in places. F2 reads
  in `cruise_1` (inked ellipse ahead/below her) but its pale rim looks glossy; unseen on dark night streets.
- Cycle 2: 6/10. F1 "weak": ink lines too sparse/thin, partly under the HUD; FOV change not evident.
  F2 not seen in any shot. Hero: outline wobbly, white flecks (low, vice, patrolview).
- Cycle 1: 6/10. No grey halo seen. Still: hero soft/noisy at phone size, white slivers on *interior*
  edges (skirt waist, leg-over-leg: rim light in herolook3d, not the pass), no altitude cue, boost ≈ cruise.

## Next
Cycle 4: F3 dive landing (+ drop the shadow's pale rim).

## Flagged for local / other sessions
- Hero session (`cloud/hero-r10`): white slivers on interior edges (skirt/leg) come from the rim term in
  herolook3d.js (outside this pass's reach); cape flutter on boost lives in capefly3d.js.
- iPad: compare Balanced fps at high/cruise with `?perf=1` vs testdrive-2026-10-04; check her edges
  (no MSAA now on Balanced) still look clean on the Retina screen.
