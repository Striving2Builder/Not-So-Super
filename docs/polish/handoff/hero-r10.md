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

## Perf (flybench, frozen pose, 6 rounds, fps; head / base / head2)
- cycle 1: band0 5.92 / 5.82 / 5.89, band1 5.48 / 5.41 / 5.48, band2 7.39 / 7.29 / 7.42
  → head ≥ base everywhere (noise ±4%). Calls/tris identical (57/70k, 82/94k, 66/85k). No new
  textures or render targets (GPU memory unchanged).

## Critic (fresh sonnet, new shots only)
- cycle 1: **5/10** vs best HTML5 heroes (round-10 critic: 6.5 with different shots, not comparable).
  Open: cape still a stiff slab in some side-on frames; night still too bright in-game; skirt hatch
  noise; thighs orange-brown; outline heavy at phone size; pale edge at hair/cape hem.

## Next
- Cycle 2: see below once committed.

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
