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

## In progress / next
- Perf: frozen-frame round robin (scratchpad bench.js = flyab with a 12 s settle at high + frozen
  sim) h6 vs r7: skim 0.97, cruise 0.955, high 0.93 (base 0.93 / 1.00 / 0.925). Frozen-frame toggles
  at high: hero pass ~29% (r7 22%: Supergirl side), outer boroughs 8%, dome 5%. Testing which of
  my shader adds cost at cruise (halo, facade detail, air gradient: scratchpad vhalo/vdet/vair).
- Then merge phase-2, final shots (r9city), report.

## Shots / perf
- Base shots: scratchpad `base/shots/base/flying` (8a9918f). Tools in scratchpad: quick.js,
  repro.js (frozen frame + toggles), citytoggle.js (per-material cost).
- flyab (balanced, 5 rounds, ×r7 02d2bb0): base 8a9918f skim 1.02 / cruise 0.99 / high 0.93;
  after LOD + analytic facades: 1.07 / 0.97 / 0.99. High tris 83.5k → 75.2k, calls 68 → 62.
