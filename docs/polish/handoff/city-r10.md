# City round 10 handoff (cloud session 1, branch `cloud/city-r10`)

Brief: STATUS.md "Round 10 review" → City items C1–C13. Gauntlet loop, 4 cycles (+ cycles 5–6: roofs, dusk C6), then stopped as briefed: fix → re-shoot →
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
- After cycle 4 (verified by shot, not by a critic): **landmark neon** (landmarks3d): the navigation
  crown band sits on each landmark's own top (`p.nav` / `p.navOct`; one fixed square floated off the
  needle/deco/ziggurat/spike tops and hung between the twin towers), octagonal towers get octagonal
  tubes (`neonOct` in buildings3d; square rings' corners stood off the casino and deco crowns).
  This was the cruise_2 "yellow ring overshooting the tower" the critics kept flagging (C2).
- **Cycle 5 (roofs + dusk C6):** *Dusk key bug* (sky3d): from night 0.5 the key light was the high blue
  moon while the sun disc still sat on the horizon (default start 19:04 = night 0.54), so the faces
  toward the drawn sun were lit cold and the tan faces away from it read warm: "the wrong way round".
  The key now stays the low sun until its disc has set (`sunK` 0, night 0.72), dimming with the disc;
  the moon grows in after. Buildings FRAG: with the sun low (`dk`, from the key's height) walls get a
  warmer, stronger key and a deeper, cooler shade (towers into the sun = dark cool silhouettes with
  gold sun-side faces). *Roofs*: muted after lighting (60% to a warm grey of their own value: the blue
  sky / moon made every roof a cobalt slab), a per-building roof value ±20% baked into the tint
  (blocks3d, no ALU), FAR: a pale parapet lip inside the in-shader ink; city3d (1 line): the lite builds'
  penthouse detail now also draws above `detailAlt` (high patrol: real roof masses under her, +~770 tris).
  (A procedural FAR roof-clutter grid was tried and dropped in cycle 6: ~2–3% at high, no critic saw it.)
- **Cycle 6:** roofs (any face with N.y > 0.5) take the open sky's light (`uSky` × 0.55, less at night):
  at dusk the grazing sun left the top planes darker than the walls (brown / navy slabs from patrol);
  now they are the lightest planes, pale warm grey. Vice-district walls muted 20% toward grey (the
  tubes and signs carry their colour; candy mid-ground was the cycle-5 critic's #1).
- Tools: `shoot.js --only a,b` (list); **`tools/shots/flybench.js`** (frozen-pose A/B, see Perf).

Cycle 6: C1 C5 FIXED, C2 C4 C6 C8 C13 improved; C7 C9 C10 C11 C12 not. Still: candy pink/cyan/violet
mid-ground (high_1, patrolview_1: vice + entertainment districts), roofs read bare (no kit) from patrol,
water flat/no glint (boost_1, high_1), mid-distance pinstripes (cruise_1, low_1, night_2), lit-window
glyphs (boost_1, night_2), vice_2 neon running past the silhouette, towers into the sun "still detailed
and evenly lit" (wanted: darker backlit silhouettes), ghost far strips (high_1, patrolview_1).

## Perf cycle 6 (final, flybench 6 rounds, 21:00; head vs base b615a78 / vs the cycle-4 head 3b87137)
- skim **0.950** of base (+3% vs cycle 4), cruise **0.898** (+2.4% vs cycle 4), high **0.971** (after
  dropping the roof clutter: -1.6% vs cycle 4). Calls same; tris +~770 at high (penthouses), 0 elsewhere.
- **Flag:** cruise reads 0.90 of base this session, but the cycle-4 head reads 0.92 in the same run
  (it was 0.978 in cycle 4's run) and this round's changes measure ≥ cycle 4 at cruise: the machine-hour
  noise is ±4–6% here. Someone should re-run `flybench.js` locally (head vs base) before merging; if
  cruise is really over 5%, the dusk `dk` branch is free at 21:00, so look at cycle 1–3's FAR groups.

## Perf cycle 5 (flybench, frozen pose, 21:00)
- vs the cycle-4 head (3b87137), 5–6 rounds: skim 1.00, cruise ~0.97–0.98 (before the clutter was gated
  to >330 m), high 0.983. A head-vs-base run this session read 0.918 / 0.90 / 0.92 but its head2 copy
  spread ±3% and base ran fast that hour: compare against the cycle-4 head numbers below (skim 0.953 →
  ~0.95, cruise ~0.96, high ~1.0 of base). Offsetting trims made in the cycle: per-roof value moved to
  the vertex tint (blocks3d), FAR roof clutter only above 330 m. Same calls; tris +~770 at high only.

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

## Critic scores (fresh sonnet, vs best HTML5): 6 / 6 / 6 / 6 / 6 / 6 (cycles 1–6)
Cycle 5: C1 C3 FIXED; C6 improved ("cruise_2/boost_1/high_2 sun-facing faces warm orange, shade deeper
navy; towers into the sun read as warm silhouettes"); low_* canyons still evenly lit. Roofs from patrol
"still mostly read as flat dark slabs". Ranked: patrol ground lot grid + candy mid-ground blocks; boost_2
dark noisy far city; high_1 flat water + far ghost strips; Tetris lit windows (boost_1, night_2); low_1
pinstripes / x marks / no base darkening; vice_2 overbright neon bands; bare far roofs.

Cycle 4: **C1 FIXED**, C3 FIXED; C2 C4 C5 C6 C7 C8 C9 C13 improved; C10 C11 C12 not. Its ranked list:
roofs read as flat cobalt/navy slabs from patrol height (+ two dark "pillow" caps in patrolview_2);
lit-window runs / "x" marks; at dusk the camera-facing faces read cool and the shade warm; ghost
skyline strips above the fog; open sea flat lilac at dusk; a few plain far boxes (boost_2); thin
stray lines (neon on landmarks, cables); no visible base darkening; far lots still a grid.

## Next (not done)
- Towers into the sun: the critic wants darker backlit silhouettes (fade window detail / lit tint on
  shaded faces when looking toward a low sun: `dot(gRay, sunDir)` × (1 - litK)). Shade could go cooler.
- Candy mid-ground from patrol is the vice + entertainment districts' wall palettes: mute their far
  (FAR shader) saturation further, or swap palettes for 3–4 muted hues + one accent (C11).
- Roof kit from patrol: penthouses now draw; a cheap instanced tank/vent kit within ~800 m is next.
- Roofs read empty (vice near roofs, far flat caps): a cheap instanced roof kit further out (C11),
  or roof value noise in the FAR shader if perf allows. Haze from high patrol away from the sun still
  reads as one flat lilac. Ghost far blocks (outer boroughs hazing out) above the fog line.
- C6 at dusk: the critic reads camera-facing (shaded) faces as cool lilac and lit faces as warm tan
  "the wrong way round" when looking into the sun; the light is right, the read isn't: try a
  stronger warm key on lit faces at dusk and a deeper cool shade.

## Flagged for local
- Nothing needs Blender. Re-shoot and run the blind critic after merging (critics here saw only
  SwiftShader frames). iPad: check the far LOD and haze with `?perf=1` (shader ALU only, no memory).
- Conflict zone: city3d.js touched only for the light() dome arg + the lotDetail hook (2 lines).
