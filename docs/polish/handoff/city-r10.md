# City round 10 handoff (cloud session 1, branch `cloud/city-r10`)

Brief: STATUS.md "Round 10 review" → City items C1–C13. Gauntlet loop, 4 cycles: fix → re-shoot →
fresh sonnet critic (new fly3d frames + C-list only) → commit + push. Base for A/B: `git archive
b615a78 src` (= phase-2 1e65910 + the stub). All procedural: nothing needed Blender.

## Done (what a player sees; files)
- **C1 textured far LOD** (buildings3d FRAG, no geometry, no texture): `groups()` draws windows grouped
  (single windows ≥ ~3 px, 2×2 groups above 420 m camera height, then the mean; the next level fades
  in over the end of a level: no pops, no moiré). **In-shader ink** on lite builds: quad edges from a
  corner id in the kind byte's spare bits (`Builder.v(..., q)`, VERT `vQ`).
- **C2 neon** (blocks3d `tiers`/`foot()`): rings on the wall of the tier at their height (rings round
  the base footprint floated beside setbacks), posts up the bottom tier only; VS: tubes off until
  `uLit` 0.2, widened to ≥ ~2 px, unlit glass tint.
- **C3** dusk sun disc pale cream (sky3d). **C4** far ring layers fade on steep rays + bases melt into
  the ground haze (skycard3d); sea hazed like land (hard coast / lilac river band gone).
- **C5** prism faces leaning back > ~33° use the roof material (pyramids, spire/dome tops).
- **C6** dusk rim: warm line on the sun-side edge of shaded faces when the sun is low (quad position).
- **C7** sea (skyline3d): navy → sky Fresnel (capped), ink ripple dashes, glint streak toward the lens.
- **C8** haze takes the dome's warm toSun glow toward the sun (`uSunAir`/`uSunDirH`, `gRay` per
  shader; same term as the sky just above the horizon, so no seam). Off at night (uniform branch).
- **C9** halftone fades out by 300 m (its 45° dots beat against mid window grids). **C10** lights:
  a few whole lit floors + sparse single windows (`litWin`); lit panes drop mullion/recess; few-px lit
  windows softened (FXAA + sharpen turned them into "x" glyphs); transom dropped.
- **C11** non-vice walls 40% to grey (vice = `neon: true` districts), roofs half way to warm grey, less
  moonlight on roofs. **C12** AO 0.5 / 6.5 m, street floors' window light sinks into the canyon.
- **C13** `lotDetail()` (ground3d, hooked into CityArt + the far plan; same canvas sizes): plaza
  paving, lawn, construction pit, car park, plain ±tone.
- Tools: `shoot.js --only a,b` (list); **`tools/shots/flybench.js`** (frozen-pose A/B, see Perf).

## Perf (flybench.js, Balanced, SwiftShader, 21:00, 6 rounds, head vs base, head run twice)
- Full frame: **skim 0.953, cruise 0.978, high 1.02** (within ≤5%; skim near the edge). City alone
  (`--noclouds`): skim 0.905, cruise 0.932, high 0.952. Calls same, tris ±40. No new textures or
  render targets (GPU memory unchanged); ground canvases same sizes.
- Why a new bench: flyab.js live flight differs ±8% page to page here (each page's sim advances by its
  own frame count: altitude/position differ). flybench pins pose/altitude/speed; noise ~±4%.
- Cost bisect (city alone): groups ~2–3% (high), litWin/softening ~2%, water ~2.7% (trimmed), far
  ink ~1%, sun haze 0 at night; dropped for budget: roof parapet band (~2%), window colour temps.
- History: cycle 1 0.985/0.947/0.937, cycle 2 0.917/0.907/0.922, cycle 3 0.927/0.918/0.917 (those
  runs had per-page altitude noise; cycle 4 numbers are the trustworthy ones).
- Baseline fly3d.js (3D/2D): skim 0.70, cruise 0.71, high 0.70.

## Critic scores (fresh sonnet, vs best HTML5): 6 / 6 / 6 / 6 (cycles 1–4)
Cycle 4: **C1 FIXED**, C3 FIXED; C2 C4 C5 C6 C7 C8 C9 C13 improved; C10 C11 C12 not. Its ranked list:
roofs read as flat cobalt/navy slabs from patrol height (+ two dark "pillow" caps in patrolview_2);
lit-window runs / "x" marks; at dusk the camera-facing faces read cool and the shade warm; ghost
skyline strips above the fog; open sea flat lilac at dusk; a few plain far boxes (boost_2); thin
stray lines (neon on landmarks, cables); no visible base darkening; far lots still a grid.

## Next (not done)
- Roofs read empty (vice near roofs, far flat caps): a cheap instanced roof kit further out (C11),
  or roof value noise in the FAR shader if perf allows. Haze from high patrol away from the sun still
  reads as one flat lilac. Ghost far blocks (outer boroughs hazing out) above the fog line.
- `cruise_2` (19:11) neon on some crowned towers still overshoots: check `foot()` for crowns whose
  top tier is narrower than the ring's tier.

## Flagged for local
- Nothing needs Blender. Re-shoot and run the blind critic after merging (critics here saw only
  SwiftShader frames). iPad: check the far LOD and haze with `?perf=1` (shader ALU only, no memory).
- Conflict zone: city3d.js touched only for the light() dome arg + the lotDetail hook (2 lines).
