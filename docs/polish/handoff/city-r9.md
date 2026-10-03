# City round 9 handoff (the 3D city seen in flight)

Brief: STATUS.md "Round 8" r9fly list, city items: high-patrol trim, window textures, fog void,
key light + night window glow, bugs (black box, blue triangles, yellow lines), river parks.
Files: city3d, buildings3d, blocks3d, skyline3d, ground3d, river3d, street3d, landmarks3d
(+ signs3d one-liner, sky3d only for the haze hand-off).

## Done (WIP commits)
- Builder index runs (`B.detail(fn)`): roof kit (penthouse, HVAC, water tower, 2nd mast,
  gardens, helipads), lot/park trees and the lite penthouses go after the body in the index
  buffer; city3d draws them via `setDrawRange` only within `LOD.detail` 470 m / `liteDetail`
  800 m (3D distance) and below `LOD.detailAlt` 430 m camera height. No rebuild, no memory.
- Ground tiles only below `LOD.tileAlt` 430 m: high patrol shows the street plan alone.
- Facades analytic (`facade()` in buildings3d FRAG): box-filtered window cells, slabs, frames,
  sills, deco piers, brick courses; lit windows from a hash (per-floor activity), fading to the
  style's mean under ~2 px. No more facade atlas or rows twin (the floor-band stripes); the atlas
  is roofs only (768x512).

## In progress / next
- Haze vertical gradient + far skyline ring; key light ramp; night window glow; bug fixes.

## Shots / perf
- Base shots: scratchpad `base/shots/base/flying` (8a9918f). Tools in scratchpad: quick.js,
  repro.js (frozen frame + toggles), citytoggle.js (per-material cost).
- flyab (balanced, 5 rounds, ×r7 02d2bb0): base 8a9918f skim 1.02 / cruise 0.99 / high 0.93;
  after LOD + analytic facades: 1.07 / 0.97 / 0.99. High tris 83.5k → 75.2k, calls 68 → 62.
