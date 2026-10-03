# Hero framing r8 (brief 2): handoff

Branch: this worktree, based on phase-2 02d2bb0. Files: flightcam3d.js, heropass3d.js, herofly3d.js,
capefly3d.js; one-line hook in flight3d.js (keyline arg to heroPass.render); ARCHITECTURE notes.

## Done
- flightcam3d: 3/4 rear-side chase (side 1.7-2.1 m, height 0.7-1.15); `maxElev` caps elevation
  above her (24° flying, 36° patrol view); `maxAz` 42° caps the angle off her tail in turns (on the
  yaw and on the sprung offset; it used to swing 80-88° = flat side-on, edge to edge). Collision:
  usual/other shoulder, then pulled in (same height), then a small lift (2.4 m, was 6 m: the
  top-down "lump" shots). Patrol view closer (78/58/60). Boost: the lens still widens but the
  camera dollies in to keep her size (boost shots had her ~15%). Canyon dist 3.1 (was 2.6: too big).
  Chase spot x 0.52, high 0.56 (her boots touched the caption in the level high shot).
- herofly3d: patrolScale 18 (was 16); `LINE` table + `keyline(night, busy)`.
- heropass3d: silhouette keyline in the composite quad (8-tap dilation of her coverage + half-width
  taps), pale halo at night. 1.3 px open sky → 2.3 px at night / canyons / patrol view.
- capefly3d: white zigzag (pair 7) = the body's white rim showing through where the cape lies on
  her back (cape had polygonOffset +1, pushed back): cape pulled forward (-1/-2, ink -3/-6) and
  stands off her hips (`clear`). From below, speed lifts the hem (`lift`); slow flight billows.

Shots: shots/r8hero/flying (all 8 fly3d scenarios OK, no page errors). Baseline:
shots/r8hero-base/flying (day failed to load there: machine load).

## Open / next
- fps A/B running (scratchpad heror8/ab.sh: base copy vs worktree, alternating, 2 rounds).
- vice_2 (canyon turn): hard bank rolls her back toward the camera; a bank-aware camera
  (swing to the outside of the turn) would fix it.
- Patrol view is still ~30° down onto her back (by design for map reading); she's ~25% tall.
- Keyline is uniform per frame (night/canyon/patrol), not per-pixel background-aware.
- Occlusion: her pass composites over the frame with no scene depth, so a roof can never hide
  her; camera pull-in keeps the line of sight clear so the depth reads right.
