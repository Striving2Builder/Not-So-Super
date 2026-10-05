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

## Done (cycle 3, unattended overnight; files: capefly3d, herolook3d, heropose3d only)
- **Cape carried with her** (capefly3d): each frame the chain moves with her anchor before it lags. Before,
  at ~300 m/s a frame's travel dragged it along her velocity, so the lab dive (forward speed, head-down)
  threw it out sideways and the shape targets were mostly ignored. Now the targets count, so rise 0.16 → 0.07
  and lift 0.35 → 0.2 (boost × 0.3).
- **Dive**: detected from her body axis (feet up). The cape is 30% longer and streams straight up along her body,
  with the sideways sway and lift cut by 85%.
- **Hover / slow**: the chain spacing is no longer halved (it bunched into folds), the billow is a calmer
  one-sided drift (0.55 → 0.32), the hem fans 40% wider and the edges curl half as much.
- **Boost**: the cape is 25% longer, 18% narrower at the hem, taut and flat behind her. Her body dips nose-down
  0.14 rad. Cruise's trailing arm is swept wider (a wide X, against boost's narrow line) and the bent knee
  bends more.
- **Skirt** (herolook3d, by its atlas rect): one flat red (the painted hatch is gone in flight and sprites),
  two hard tones from the key light (lit red / deep crimson), its underside always crimson, and a 55% darker
  band at the hem (uv v0 is the hem, checked with a debug tint). It now reads as its own shape over the red
  boots.
- **Thigh skin**: the shade floor goes 0.66 → 0.8, desaturation 0.35 → 0.3 and the shade is rosier
  (1, 0.86, 0.9): less brown.

## Perf (flybench, frozen pose, 6 rounds, fps; head / base / head2)
- cycle 1: band0 5.92 / 5.82 / 5.89, band1 5.48 / 5.41 / 5.48, band2 7.39 / 7.29 / 7.42
  → head ≥ base everywhere (noise ±4%). Calls/tris identical (57/70k, 82/94k, 66/85k). No new
  textures or render targets (GPU memory unchanged).
- cycle 2: band0 5.78 / 5.72 / 5.83, band1 5.41 / 5.36 / 5.43, band2 7.37 / 7.22 / 7.34 → on budget,
  calls/tris identical; +1 material object (her hull clone), no textures/RTs.
- cycle 3 (clean run; the first run overlapped the screenshots and was discarded): band0 5.83 / 5.57 / 5.80,
  band1 5.25 / 5.33 / 5.36, band2 6.69 / 6.74 / 6.68. That's at most −1.5% against the base, inside the ±4% noise.
  Calls and tris are identical. No new materials, textures or RTs: a few more ALU ops in her fragment shader
  and one vector add per cape row on the CPU.

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
- cycle 3: **4.5/10** (a fresh critic, a harsher read; scores vary ±0.5–1 between critics).
  - Partly fixed: the cape in-game is shoulder-wide to the calves; night is darker; the thigh shade is better.
  - Claims that don't match the shots: it says the dive arms are still down, but they're overhead in the dive
    close-up and the grid. It says the dive cape is short and sideways, but it streams up along her legs in
    every dive tile.
  - Its ranked list: 1) boost / cruise / turns still too similar from the chase cam (asks for more boost
    pitch, legs straight together, a speed-line / FOV kick; FOV and FX are flight files); 2) the cape is
    still a flat sheet side-on (asks for travelling lateral bands and a 1.3× hem flare); 3) legs and skirt
    are still one red mass to it (asks for a different red or a gradient on the boots: a costume colour
    change, which the user parked); 4) the night cape's inside reads near-black (lift the floor toward
    #6a1a2a with a fold tint); 5) the outline is heavy at phone size (cap it near 1.5 px); 6) hair blob and
    slivers (Blender).

## Next (cycle 3 done; for the next round)
- Cape: 2–3 lateral bulge bands that travel down its length (the cycle-3 critic's #2), a hem flare. Now
  that it's carried with her, its target shape shows directly, so tune it in the lab.
- Boost: a longer stretch hold and an FOV / speed-line kick (herofly3d / flightfx: another session);
  the legs and skirt are done code-side; going further would mean a costume colour change (user decision).
- Night cape inside: try lifting the inner floor (#8a1020 → brighter) if the director's critic agrees.
- Phone-size outline: cap the hull / keyline at about 1.5 px (heropass3d / herofly3d LINE: the flight session).
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
