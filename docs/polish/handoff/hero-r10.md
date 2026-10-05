# Supergirl round 10 (cloud, code items S1–S3 + S5 hover): handoff

Branch `cloud/hero-r10` off phase-2. Files: src/heropose3d.js, src/herolook3d.js, src/capefly3d.js,
src/herofly3d.js (hers only). No flight/city/heropass/settings edits. Bench: `tools/shots/flybench.js`
(copied from cloud/city-r10).

## Done (cycle 1)
- **S1 cape** (capefly3d): root = her shoulder joints (half-width 0.075 → 0.15 m), 1.33× longer
  (hem at the calves), wider hem, deeper cup (keeps its shape side-on: sideFlat 0.55 → 0.25), a slow
  sideways billow + hem spread, bigger travelling wave, less "flag" lift from below. Boost = taut:
  smaller wave, faster flutter, 10% longer. Inside colours lifted, and a floor after the night tint
  (outer ≥ #a01622, inside ≥ #8a1020).
- **S5 hover facing** (herofly3d + heropose3d): the idle clip (hover/perch) stood her 90° off her
  heading (measured: facing ⟂ heading), so the cape went across her front. Root turned back
  (eased); hover pose and cape axes now use her real facing (FlightPose.axes(m, idle)). Hover now
  shows her back + cape to the chase camera.
- **S2 poses** (heropose3d): cruise line of action (chest arch 0.35 → 0.5, shoulders above hips,
  legs angle down off the hips, left knee bent more, trailing arm swept back like a wing); boost =
  one fist dead ahead, the other pinned to her side, chin tucked, legs locked, + a 7% stretch along
  her body for 150 ms at onset; turns hand the lead to the outside arm and the bent knee to the
  inside leg (turnL mirrors turnR), more shoulder drop; dive = both arms locked overhead.
- **S3 light** (herolook3d + herofly3d): HERO_LIGHT tint × everything she shows (day 1, dusk warm,
  night ≈ 0.6/0.63/0.82, × a little of the sun colour; the hair's flat tones included); rim colour
  from the sky (cyan day, sunset orange, cool blue at night, softer at night); skin texels keep a
  gentler saturation and their shade takes its hue from the skin (rosier, not orange from the warm
  fill). Keyline thins with distance (to 0.6× at phone size); its night halo width set to 0.

## Done (cycle 2)
- Skin shade: desaturated 35% + brightness floor (0.66 × lit) + rosier (ACES had turned the dark
  peach orange). Night tint down to 0.5/0.53/0.74. Her ink hull is now her own clone of the shared
  hull material (same program) with an olW that thins with distance (√, floor 0.45); keyline floor
  0.45. Cape: more lag down the chain (follow rate 8+v/6 → 5+v/10) and a deeper cupped
  cross-section. Bank 0.95 → 1.15; cruise shoulders higher (0.14), trailing knee a touch bent.
- Lab (tools/supergirl/lab-main.js): the keyline distance uses each tile's own camera.

## Perf (flybench, frozen pose, 6 rounds, fps; head / base / head2)
- cycle 1: band0 5.92 / 5.82 / 5.89, band1 5.48 / 5.41 / 5.48, band2 7.39 / 7.29 / 7.42
  → head ≥ base everywhere (noise ±4%). Calls/tris identical (57/70k, 82/94k, 66/85k). No new
  textures or render targets (GPU memory unchanged).
- cycle 2: band0 5.78 / 5.72 / 5.83, band1 5.41 / 5.36 / 5.43, band2 7.37 / 7.22 / 7.34 → on budget,
  calls/tris identical; +1 material object (her hull clone), no textures/RTs.

## Critic (fresh sonnet, new shots only)
- cycle 1: **5/10** vs best HTML5 heroes (round-10 critic: 6.5 with different shots, not comparable).
  Open: cape still a stiff slab in some side-on frames; night still too bright in-game; skirt hatch
  noise; thighs orange-brown; outline heavy at phone size; pale edge at hair/cape hem.
- cycle 2: **5.5/10**. Met/partly: cape from the shoulders to the calves, hover faces away with the
  cape behind, turns bank + mirror, dive arms overhead, no grey halo seen. Still open (ranked):
  1) cape still reads as a flat wedge from the chase cam / a ribbon side-on; 2) dark maroon cape and
  skirt in the lab's night rows (lab has no city light; in-game is fine) and phone-size tiles hard to
  read; 3) legs + skirt one red mass, thigh shade still brownish in some frames; 4) hover cape narrow
  and bunched; 5) dive cape short and sideways, not streaming; 6) boost vs cruise still close from
  the side; 7) in-game night still reads bright to it; 8) outline still heavy at phone size.

## Next (the 2-cycle cap was reached; for the next round)
- Cape: 2–3 lateral bulge bands that travel down its length; in hover hang it straight down and
  wider; in dive trail it along −velocity (it uses body axes now) and lengthen it there.
- Boost: a stronger forward pitch and a longer stretch hold; legs/skirt separation (a darker skirt
  hem band or rim in herolook3d).
- Night: the camera fill (flight3d) is the real cause; see "Flagged for the flight session".
- The critic is a fresh sonnet each cycle (scores vary ±0.5); the director's blind critic decides.

## Flagged for the flight session (cloud/flight-r10, owns heropass3d/settings/flight3d)
- The pale halo outside her ink: its width comes from `FlyHero3D.keyline()` (now 0); colour/alpha in
  heropass3d `PASS.halo`. If a fringe remains it's the pass's dilation/AA, not the halo: clamp the
  dilation (lumps) and composite the edge premultiplied (heropass3d).
- The camera fill light (flight3d `this.fill`, warm 0.7, constant day and night) is what makes her
  bright at night; she's now tinted down, but a night-cooler/dimmer fill would help more.

## Flagged for local (Blender)
- S4 hair: strand ink lines + shine band, 5–7 pointed hem locks, lock bones, hem alpha shreds.
- S5 blue/white triangle at the nape/cape root, white slivers at the skirt waist and boots.
- Skirt halftone/hatch in the atlas reads as dirt at gameplay size (texture repaint).
