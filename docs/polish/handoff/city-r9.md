# City round 9 handoff (the 3D city seen in flight)

Brief: STATUS.md "Round 8" r9fly list, city items: high-patrol trim, window textures, fog void,
key light + night window glow, bugs (black box, blue triangles, yellow lines), river parks.
Files: city3d, buildings3d, blocks3d, skyline3d, ground3d, river3d, street3d, landmarks3d
(+ signs3d one-liner, sky3d only for the haze hand-off).

## Done (WIP commits)
- Builder index runs (`B.detail(fn)`): roof kit (penthouse, HVAC, water tower, 2nd mast,
  gardens, helipads), lot/park trees and the lite penthouses go after the body in the index
  buffer; city3d draws them via `setDrawRange` only within `LOD.detail` 470 m / `liteDetail`
  800 m (3D distance) and below `LOD.detailAlt` 340 m camera height (cruise ~280). No rebuild.
- Ground tiles only below `LOD.tileAlt` 340 m: high patrol shows the street plan alone.
- Facades analytic (`facade()` in buildings3d FRAG): box-filtered window cells, slabs, frames,
  sills, deco piers, brick courses; lit windows from a hash (per-floor activity), fading to the
  style's mean under ~2 px. No more facade atlas or rows twin (the floor-band stripes); the atlas
  is roofs only (768x512).

- Haze: `airAt(f, dn)` in HAZE_GLSL: the air grades from the horizon colour (looking level) to
  `uHazeLow` (HAZE.low × the haze's value, looking down): far ground keeps its value.
- `FarRing` (skycard3d): cylinder ground→eye level at 4.3 km riding with the camera: each ray's
  air + 4 layers of borough silhouettes (skycard's mask) on land only, ink, night window clusters.
  Frozen-frame cost ~0-1%.
- Ground plan: far lots desaturate/darken (450-2000 m) before the haze.
- Key light: shade = ambient × cool `KEY.shade`, raking = half key, full; shaded glass dims and
  leans to the wall paint (the "dark-blue triangles" in pair 8 were shaded glass faces of the
  canyon walls under a banked camera: a blue panel, not the same tower in shadow).
- Night: lit-window halo (near), lit tint ×1.35 far; neon tubes under ~3 px use their average
  (no red-white dashes) and are dim until dark (the "yellow lines" in pair 8 were neon corner posts
  and cornice rings at dusk). Roof board backs mid-grey sheet metal (pair 1's black box).
- River: quay band outside the water (ribbon + basin), river-block parks with lawn stripes,
  promenade loop + diagonal paths, a round plaza.
- Near glass: a diagonal comic glint per pane by day (magnified curtain walls read as glass).

- Facades cheapened: frames/sills/brick only while a window is >= ~6 px, averages under ~1.7 px
  (early out), 2 sin-free hashes, lit hash only at night. Above 340 m the near/lite LOD goes by
  3D distance (high patrol = lite builds only).
- Merged phase-2 (Supergirl look pass + dive landing) at 34da1f2.

## Status: done, ready to merge
Bugs (r9fly): pair 1 black box = roof billboard's near-black tar back (fixed: grey sheet metal,
signs3d.js one-liner). Pair 8 yellow lines = neon posts / cornice rings lit full by day + their
sub-pixel cores (dimmed until dark, averaged when thin; venue corner posts still read as thin
yellow lines at dusk). Pair 8 blue triangles: not reproduced in r9city (shade step + glass leaning
to the wall paint); root cause not pinned (see report).

## Next ideas
- Venue neon corner posts: off until uLit > 0.3, or only on the street face.
- Far ring: per-borough density (the islands read as a uniform row); a faint second ink tier.
- Inner-corner AO on L-shaped footprints, parapets; flagship pass over the hero cost (her sharp
  pass is ~23-30% of the frame at high patrol on Balanced in SwiftShader).

## Shots / perf
- Shots: shots/r9city/flying (after, with phase-2 merged); base: scratchpad base/shots/base.
- Bench (scratchpad bench4.js: flyab + frozen sim at a fixed pose per band, 8 rounds, Balanced),
  x r7 02d2bb0: base 8a9918f skim 0.94 / cruise 0.99 / high 0.88; r9 (with the new Supergirl)
  0.90 / 0.97 / 0.91. Earlier run (pre-merge, own hero): 0.98 / 0.93 / 0.87 vs base 0.99/0.96/0.89.
  Noise between runs is +-5%. Tris high 91.8k -> 78.6k, calls 68 -> 62.
- Hero pass off (city only, bench3): r7 / base / r9: skim 1 / 1.03 / 1.01, cruise 1 / 0.87 / 0.96,
  high 1 / 0.95 / 0.93.
