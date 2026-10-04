# Code architecture (polish pass)

The game is plain ES modules served as-is (no bundler), three.js from `vendor/` via the import map
in `index.html`. Keep it that way: small, focused modules with obvious homes.

## Target layout (applied by the director between rounds, when no builder is mid-work)
```
src/
  main.js                 boot, game loop, mode switching (stays at the root)
  core/                   shared, mode-agnostic: ui, input, settings, util, rng, state, data, sfx, media
  story/                  comic overlay + narration: comic, commentary, newspaper, cutscene, captured
  flight/                 the overworld: overworld, city, cityart, sky, atmosphere, airspace,
                          airevents, paparazzi, flight, flightaudio, nav, cityfeed
  three/                  shared 3D engine: special3d (zone base), look3d, hero3d, cape, enemies
  zones/                  3D zone types + their sets: clubzone, clubgeo, clubmood, venues3d,
                          nightlife, asylum, nightcase
  brawl/                  side-scroller: brawler, brawlsprite, brawlstage, art (2D humanoids)
  investigate/            crime scenes: investigate, crimescene, evidenceart, casefile, leads
tools/                    dev-only scripts (Blender export, slimming, harness in tools/shots)
docs/polish/              brief, architecture, round notes
```
Until the move happens, keep writing code as if it had: a new module belongs to exactly one of
these folders, and its imports should make sense from there.

## WebGL budget (iOS Safari): one context for the screen, one for sprite bakes
- `gfx.js` (core): `IOS`, `hasWebGL()` (releases its probe), `watchContext(renderer)` (lost →
  the game pauses behind a "RESTORING GRAPHICS…" card; not back in 3.5 s → the owner rebuilds),
  `loadingPanel(text)` (the zones' LOADING card), the crash-reload flag (→ Battery saver once).
- `offscreen3d.js` (three): the ONE offscreen renderer for HeroSprite + brawlsprite bakes
  (`renderToCanvas`), released while the 3D flight runs. Never `new THREE.WebGLRenderer` elsewhere:
  the screen uses Special3D's shared renderer (rebuilt by `replaceRenderer` if iOS drops it; no
  context at all → 3D flight drops to 2D via `Overworld.drop3D`, a 3D zone is left).
- Zones load behind the LOADING card over several frames (brawler `load()`, investigation's one
  bake frame, Special3D `warmUp()` compileAsync); city3d trims near builds/tiles (`KEEP`).

## Rules
1. **One responsibility per module.** Game logic, rendering, and set dressing live in separate
   files (e.g. `brawler.js` = rules/state, `brawlstage.js` = backdrop, `brawlsprite.js` = sprites).
   If a file passes ~800 lines, split it along a seam before adding more.
2. **Dependencies point inward.** Area modules may import from `core/`, `story/` and `three/`
   (3D areas), and from their own folder. Never import another area's module (flight must not
   import brawl, zones must not import investigate, etc.). If two areas need the same thing, it
   moves to `core/` or `three/` — ask the director.
3. **Shared 3D look goes through `three/`.** Materials, ink, shadows, rim, grading, backdrop and
   camera helpers live in `look3d.js` / `special3d.js`; zones configure them (colours, strengths)
   instead of re-implementing them.
4. **Data over code.** Per-venue / per-district / per-enemy tunables are tables at the top of the
   module (or in `core/data.js` if gameplay reads them), not magic numbers scattered in functions.
5. **Quality tiers in one place.** Read `quality()` (core/settings) and branch on its keys; add a
   key to the profiles rather than checking the profile name inline.
6. **No hidden globals.** State hangs off the mode object or `game`; anything reset per zone is
   listed in the zone's reset block (Special3D.enter's `Object.assign`).
7. **Dispose what you create.** Anything added to a 3D scene is freed on exit (or detached if
   shared/cached); 2D caches have a size bound.
8. **Comments explain why**, match the surrounding terse style; no dead code or commented-out
   experiments left behind; debug/profiling helpers live in `tools/`, not `src/`.

## Flight in 3D (the DEFAULT since 2026-10-02; `?flight=2d` or no WebGL = the old top-down view) — `flight/`
A renderer swap, not a rewrite: `overworld.js` keeps simulating (hero, bands, zones, nav, events)
and, when `view3d` exists, hands the frame to it. Hooks in overworld.js are deliberately few:
camera-relative steering (`view3d.steer`), building heights for collisions/perching (`hOf`), the
render hand-off, enter/exit, the boost kick, and the 3D flight button set (`setButtons` branch +
`.gone` toggles on DIVE/PERCH; CSS in style.css's flying block).
- `flight3d.js` — mode glue: shared WebGL renderer (Special3D's), scene, per-frame update order,
  inked incident beams (one shader mesh each, thickened with distance), pixel-ratio caps
  (`quality().fly3dDpr`: open sky / canyons), and the transparent 2D comic overlay (icons, ≤3 edge
  chips kept out of the thumb zones). Table: `LOOK3` (3D band heights + speed multipliers, fog,
  beams, chips).
- `flightfx3d.js` — speed juice: contrail ribbon, wind streaks, sonic/boost rings (3D), comic
  action lines + wall-rush lines (2D overlay). Table: `FX`.
- `city3d.js` — the city's orchestrator: chunks of 3x3 blocks, each ONE mesh = ONE draw call plus
  one ink-layer draw (near build + a lite far-LOD build past `LOD.farMat`), landmarks (always drawn),
  the 2D view's baked ground art as near ground, horizon, outer boroughs, street life. Reads the key
  light / ambient from Sky3D's lights and the haze's end colour from the dome's `bottom` uniform
  (or `Sky3D.horizon` when flight3d sets the optional hook `city3.sky = sky`). Chunks reach as far as the haze (further than the band's fog when
  high up). Exposes `landmarks` ([{kind, district, x, y, h}], world units) for navigation.
  - `buildings3d.js` — the building kit: mask atlas (5 facades + 3 roofs), the one cel shader
    (`CityLook`: near / far / landmark materials + the anti-aliased `ink` layer; 3 cel bands +
    halftone, windows → scale-aware lit clusters far off), `HAZE_GLSL` (the shared aerial
    perspective: cool, thicker low, ends on the dome horizon), `Builder`, `box` / `prism` / ….
  - `blocks3d.js` — what stands on a block: `DISTRICT_3D` (heights + core bump, palettes, window
    light, neon trims, facade/silhouette/roof-kit odds), tower archetypes, roof kits, venue signs.
  - `signs3d.js` — neon sign word atlas (comic lettering) + facade / rooftop / blade sign quads.
  - `landmarks3d.js` — one signature tower per district (`LANDMARKS`), chosen near its seed.
  - `river3d.js` — the river (city.js `riverPath`/`riverBasin`; river blocks hold no buildings or
    zones): a smooth corner-cut ribbon + oval basin with shore band and ink line, bridges.
  - `skycard3d.js` — the far skyline silhouette card riding on the horizon line (only above the towers).
  - `ground3d.js` — the map's ground from altitude: street-plan texture (lots, parks, plazas) +
    night avenue glow.
  - `outer3d.js` — beyond the map: outer boroughs (far-LOD blocks), bay islands, river bridges, the
    bay bridges, the ring highway (their lanes feed the traffic).
  - `skyline3d.js` — horizon: the water (bay + river round the map), the outer "city carpet" ground
    (street grid in the shader), the haze patch for MeshBasic ground.
  - `street3d.js` — GPU traffic light streams (streets, bridges, highway) + street steam.
- `sky3d.js` — dome keyframed by the hour (`SKY`: zenith, mid, warm band above the horizon,
  horizon; a blue day with a mid-blue horizon, an orange sunset band, violet night), an inked comic
  sun disc (`SUN`, drawn lower than the key light), moon + stars only once properly night, sun/moon
  lights, district-tinted fog, and comic cumulus billboards (one draw call) from a signed-distance
  atlas built at start (8 shapes; three cel tones + silhouette ink + inner puff lines, AA'd at any
  size); no cloud within 50 m of the lens. Exposes `horizon` (display colour; also the city haze's
  end colour, so `SKY` is the one place it lives). Tables: `SKY`, `SUN`, `CLOUD`.
- `flightpost3d.js` — whole-frame AA: the scene renders into a target three treats like the canvas
  (tone mapping + sRGB output), FXAA at the scene's size, then a contrast-adaptive sharpening
  upscale to the canvas (`quality().fly3dSharp`, both diagonals with `fly3dSharpTaps` 4 on High; + the boost zoom streak, only in a screen-edge ellipse);
  `quality().fly3dAA` = 'fxaa' | 'msaa' | 'none'. flight3d adds dynamic resolution on top of the
  `fly3dDpr` caps (`LOOK3.dynRes`).
- `herofly3d.js` — the HeroModel in flight: heading, patrol-view enlargement, inked blob shadow,
  cape anchoring, keyline widths. Tables: `POSE`, `LINE`.
  - `heropose3d.js` — her flight body language (`FlightPose`): attitude springs (roll into turns
    with overshoot, pitch from the climb angle, yaw slip, float bob) and blended bone offsets for
    cruise / boost / dive / slow glide / hover. Table: `FLY_POSE`.
- `herolook3d.js` (three/: shared by flight, the zones' HeroModel and HeroSprite) — her comic
  surface: `heroMaterial` (3 cel bands, pushed saturation, self-light, silhouette rim, the hair as a
  3-tone blonde mass with the painted locks kept; ACES / raw palettes), `dressHero`, `inkHull`
  (no ink hull on eyeballs / teeth / face interior). Tables: `SUIT`, `HAIR`. Her model is rebuilt by
  `tools/supergirl/sg_blender.py` + `paint_sg.py` (hair shell, atlas repaint); the hero lab
  (`tools/supergirl/lab.js`) shoots every pose × camera + her 2D sprites on one sheet.
- `capefly3d.js` — her flight cape: a tapered, folded sheet on a rippling spine chain, two-tone cel
  from its real normals (darker lining), screen-space ink outline + fold strokes, flattens side-on;
  seen from below speed lifts the hem, slow flight billows. Table: `CAPE`.
- `flightcam3d.js` — chase camera aimed so she sits at a fixed screen spot (lower third, 3/4
  rear-side: elevation and angle off her tail capped by `maxElev` / `maxAz`, so she never reads as a
  lump seen straight down her back), offset spring, speed FOV, boost lens + kick with a dolly that
  keeps her size, street-canyon framing at skim (yaw snaps to the street axis), a level shot at high
  patrol, sphere-cast collision (shoulder swap, pull-in, then a small lift; no wall-only frames),
  patrol view with capped pitch. Table: `CAM`.
- `heropass3d.js` — her sharp pass: the hero layer rendered into a small target over her screen
  rect at 2× the frame's density (optional MSAA; `quality().fly3dHero`), laid over the frame with a
  silhouette keyline round body + cape (wider at night / in canyons / patrol view, pale halo at
  night; widths from herofly3d's `LINE`). She is always drawn over the city (no scene depth).
Other 3D hooks in overworld.js: `view3d.autoSteer` (autopilot routes round towers taller than her)
and `view3d.slide` (she glances off façades instead of the 2D stop-dead).
Measurements: `tools/shots/fly3d.js` (2D vs 3D fps A/B, beams, time-to-waypoint); harness
scenarios `fly3d_*` in `tools/shots/shoot.js`.
