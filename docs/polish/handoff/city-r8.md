# City round 8 handoff (3D city in flight)

Brief: STATUS.md "Next round (8)" brief 1 + city parts of 3, 5, 6. Files: city3d, buildings3d,
blocks3d, skyline3d, ground3d, river3d, street3d, landmarks3d (+ cityart/city hooks only).

## Done (WIP commits)
- ground3d.js: far plan rewritten as a comic-painted street plan at 64 px/block (48 on lean
  tiles, `tileRes < 128`): sidewalks + inked kerbs, lots muted toward a warm grey, parking with
  stalls/cars, tree clusters in open lot corners, street trees, farm crop rows + hedgerows,
  soft contact shade round footprints, solid avenue centre lines. Canvases span land only.
- river3d.js: own water shader (deep navy channel → teal shallows, sky tint, glint, foam lip, ink
  shore), no wave-crest strokes; banks wander independently; basin rim with harmonics.
- skyline3d.js: sea deeper navy, crest strokes only within ~650 m (were white dashes far off).
- street3d.js: cars premultiplied (additive at night, normal by day), soft falloff, smaller glow
  (max 8 px), far tail/head lights melt to warm amber, coverage fade instead of speckle, reach
  grows 0.8×altitude (was 1.6×). The "red-white border lines" were these car streaks.
- cityart.js: optional hooks `this.tone(c, what)` and `this.dress(g, b)` (unset = 2D unchanged).

## In progress
- Wire `tone`/`dress` hooks from city3d (near tiles match the far plan; export `tone`,
  `lotDressing`, `dressNear` from ground3d; 3D trees from lotDressing in chunk build).

## Next
- Window moiré (buildings3d FRAG), contact AO on walls (encode height-above-tier-base in aAux
  length), downtown 30%-height trim ring (blocks3d ~l.244) → ledge trim or vice-only.
- Day value contrast near vs far.

## Shots / perf
- Base: shots/r8city-base (fps noisy: patrolview 5.5, calls 96, tris 118.6k).
- Helper: scratchpad multi.js runs fly3d scenarios in parallel (ports 8741+).
