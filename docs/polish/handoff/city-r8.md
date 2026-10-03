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

- Shared lot dressing (ground3d `lotDressing`/`tone`/`dressNear`): near tiles muted to match the
  far plan, parking patches + tree shade on tiles, 3D lollipop trees stood up in chunk builds (near
  LOD only); river blocks = tree-dotted park banks. Farm blocks = 2-3 field patchwork.
- River: near-black navy linear tones (haze lifts it a lot from 600 m up), haze at true distance.
- buildings3d: window cells fade thin features per axis when a cell < ~10 px (moire fix);
  contact AO: aAux length = 1 + height above the part's base (box/prism/wedge set `B.base`),
  walls darken at their foot (`AO` table, weaker at night).
- blocks3d: the 2nd trim ring now sits on the first setback ledge (cornice light); plain slabs
  outside vice districts get none (was the stray orange line at 30% height).

## Status: done, ready to merge (no flight3d/settings changes)

## Next ideas
- River-block park banks still read as big flat green squares beside the basin: paths, a quay.
- Day near/far value contrast (sky/post owner's haze + our AO strength `AO.k`).
- Inner-corner AO (L-shaped footprints), roof-edge darkening; tree count if triangles matter.

## Shots / perf
- Base shots/r8city-base, after shots/r8city (shoot.js; fps noisy, other builders running).
- fly3d.js A/B in parallel vs a 02d2bb0 export: 3D fps skim 7.1/7.1, cruise 7.4/7.6, high
  7.7/7.1 (new/base); calls equal; triangles cruise +7% (3D lot trees), high -2%.
- Helper: scratchpad multi.js runs fly3d scenarios in parallel (ports 8741+).
