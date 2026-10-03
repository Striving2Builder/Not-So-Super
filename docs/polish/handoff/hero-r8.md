# Hero framing r8 (brief 2): handoff

Branch: this worktree, based on phase-2 02d2bb0. Files: flightcam3d.js, heropass3d.js, herofly3d.js,
capefly3d.js; one-line hook in flight3d.js (keyline arg to heroPass.render).

## Done (WIP, not fully shot-verified)
- flightcam3d: chase moved to a 3/4 rear-side view (side 1.7-2.1 m, height 0.7-1.15); `maxElev`
  caps camera elevation above her (24° flying, 36° patrol view); `maxAz` 50° keeps the lagging
  yaw from swinging fully side-on in turns. Collision candidates: usual/other shoulder, then
  pulled in (same height), then a small lift (2.4 m, was 6 m, which made top-down "lump" shots).
  Patrol view closer (78/58/60): she measured ~0.25 of screen height (was ~0.22, visually ~0.18).
- heropass3d: silhouette keyline in the composite quad (8-tap dilation of her coverage + half-width
  taps), optional pale halo at night. Widths from `FlyHero3D.keyline(night, busy)` (LINE table in
  herofly3d): 1.4 px open sky → 2.6 px at night / canyons / patrol view; halo 1.4 px × night.

## In progress / next
1. Not yet run after the keyline + maxAz change: run the probe and shoot.js, look at frames.
2. Cape white notch (pair 7 = r7 fly3d_low_1, white "V" near the collar): suspect the body's
   cyan-white rim showing through where the cape (polygonOffset +1, pushed back) meets her back.
   Test: RIM.value = 0 in a probe; fix by dropping the cape's push-back or masking rim under it.
3. Cape: from below let speed lift the hem; slow patrol: bigger, slower billow (capefly3d update()).
4. fps before/after with fly3d.js (baseline run failed: machine overloaded, page.click timeouts).

## Tools / notes
- Probe (scratchpad, not in repo): projects bones + cape points → her screen bbox fraction,
  camera elevation/azimuth per fly3d plan; screenshots alongside. Rebuild it from shoot.js's
  shootFly3d if needed.
- Baseline shots: shots/r8hero-base/flying (day scenario failed to load). fps there 4-9 (load).
- Occlusion: her sharp pass composites over the frame with no scene depth, so a roof can never
  hide her; the risk is only wrong-looking depth, handled by camera pull-in.
