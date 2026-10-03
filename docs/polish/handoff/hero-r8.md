# Hero framing r8 (brief 2): handoff

Branch: this worktree, based on phase-2 02d2bb0. Files: flightcam3d.js, heropass3d.js, herofly3d.js,
capefly3d.js; one-line hook in flight3d.js (keyline arg to heroPass.render).

## Done (WIP)
- flightcam3d: chase moved to a 3/4 rear-side view (side 1.7-2.1 m, height 0.7-1.15); `maxElev`
  caps camera elevation above her (24° flying, 36° patrol view); `maxAz` 50° caps the angle off
  her tail in turns (on the yaw and on the sprung offset; it used to swing 80-88° = flat side-on).
  Collision candidates: usual/other shoulder, then pulled in (same height), then a small lift
  (2.4 m, was 6 m, which made the top-down "lump" shots). Patrol view closer (78/58/60); boost
  pull-back 0.45 m (was 0.8: she shrank at FOV 77).
- herofly3d: patrolScale 18 (was 16); `LINE` table + `keyline(night, busy)`.
- heropass3d: silhouette keyline in the composite quad (8-tap dilation of her coverage + half-width
  taps), pale halo at night. 1.3 px open sky → 2.3 px at night / canyons / patrol view.
- capefly3d: white zigzag (pair 7) = the body's white rim showing through where the cape lies on
  her back (cape had polygonOffset +1, pushed back): cape now pulled forward (-1/-2, ink -3/-6) and
  stands off her hips (`clear`). From below, speed lifts the hem (`lift`); slow flight gets a big
  slow billow (`billow`) instead of hanging straight down.

Probe numbers (bones+cape bbox): chase elev 11-20°, az ~25° straight / 50° in turns; patrol
view ~0.24-0.3 of screen height, elev 30°.

## Next
1. Run shoot.js --label r8hero and look at all fly3d_* frames (cape notch, keyline weight).
2. fps before/after with fly3d.js (baseline run failed: machine overloaded, page.click timeouts;
   use a git-archive copy of 02d2bb0 in scratchpad for alternating A/B).

## Tools / notes
- Probe (scratchpad/heror8/probe.js, not in repo): projects bones + cape points → her screen bbox
  fraction, camera elevation/azimuth per fly3d plan; screenshots alongside.
- Baseline shots: shots/r8hero-base/flying (day scenario failed to load). fps there 4-9 (load).
- Occlusion: her sharp pass composites over the frame with no scene depth, so a roof can never
  hide her; the camera pull-in keeps the line of sight clear so the depth reads right.
