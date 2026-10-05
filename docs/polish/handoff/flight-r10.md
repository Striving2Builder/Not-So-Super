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

## Perf (flybench, Balanced, frozen pose, vs phase-2; head2 = head again, noise)
| band | phase-2 | cycle 1 (head / head2) | vs phase-2 |
|---|---|---|---|
| skim | 6.85 | 8.39 / 8.98 | ×1.27 |
| cruise | 6.38 | 8.04 / 7.95 | ×1.25 |
| high | 7.94 | 10.38 / 10.74 | ×1.33 |
Calls/tris identical (57/82/66 calls); no new render targets (her target only shrinks: GPU memory down).
Saver: see the cycle-2 table.

In-page heroab (same frame, Balanced, ms/frame): high band 125 → 90 ms (×1.40), cruise 153 → 125
(×1.22). Box alone ×1.05–1.08; MSAA 2× → none is the bulk in SwiftShader. On Apple GPUs MSAA is
cheap, so the real-device gain will be smaller (mostly the box + density): confirm with `?perf=1`.

## Critic scores (fresh sonnet critic, new shots only, vs best HTML5/WebGL)
- Cycle 1: 6/10. No grey halo seen. Still: hero soft/noisy at phone size, white slivers on *interior*
  edges (skirt waist, leg-over-leg: rim light in herolook3d, not the pass), no altitude cue, boost ≈ cruise.

## Next
Cycle 2: F1 boost readability (ink speed lines, faster FOV ease-in); cycle 3: F2 drop shadow; cycle 4: F3 dive landing.

## Flagged for local / other sessions
- Hero session (`cloud/hero-r10`): white slivers on interior edges (skirt/leg) come from the rim term in
  herolook3d.js (outside this pass's reach); cape flutter on boost lives in capefly3d.js.
- iPad: compare Balanced fps at high/cruise with `?perf=1` vs testdrive-2026-10-04; check her edges
  (no MSAA now on Balanced) still look clean on the Retina screen.
