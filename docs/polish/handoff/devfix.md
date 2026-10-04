# Device fixes (iPad feedback, 2026-10-03): handoff

Branch from phase-2 d45e1c4. Four gameplay/feel bugs; no visual polish beyond them.

## 1. Flight idle pose ("standing on air") — done
- `src/heropose3d.js` `hovering(m, k, t)`: new superhero float on the idle clip (body axes): right knee
  lifted, left leg trailing back with a soft knee, toes pointed, right fist on hip, left arm loose,
  leg sway with the bob; hover pitch leans her forward (`FLY_POSE.hoverTilt` 0.14). Slow glide legs:
  knees bent, shins trailing back. `herofly3d.js`: hover cape drifts back + sways. `herofly.js` (2D
  sprite) passes t and leans forward too. Perched on a roof = still the standing idle (on purpose).
- Shots: `shots/supergirl/devfix-hover-base.png` vs `devfix-hover1.png`; montage `devfix_hover_ab.png`.

## 2–3. Brawler auto-push + end stall — done, verifying
- Root cause (repro `shots/devfix-base/`, `node tools/shots/brawlrun.js --view ipad --punch-only`):
  the camera led her by 110 units and she was clamped to the camera view, so a wave lock snapped the
  camera forward and shoved her; on a 4:3 iPad the view is only ~333 units wide. Ranged crooks
  (gunman) backed off to 360 units and were clamped to cam±(view+80) while she was clamped to
  cam±(view−30): a 110-unit gap > punch reach, off screen → the fight could never end (robbery,
  kidnap, heist, mob). Captives skipped by the push needed a slow walk back (camera dragged her).
- Fix (`src/brawler.js`): window camera (holds still while she's in a band left of centre, so the
  stage cache still holds in fights), she's bounded only by the street or the fight arena (half-width
  ≥270 units, never ahead of where she triggered it), crooks share the arena bounds (cornerable),
  gunmen keep an on-screen distance, a watchdog walks anyone off screen >6 s back in, NaN guard.
  "HELP!" arrow (`brawlfx.js`) + objective row point back to captives/fires left behind.
- Tool: `tools/shots/brawlrun.js` plays brawls via keyboard (A/D/W/S, J, K), god mode, reports stalls.

## 4. 3D club stages — done, verifying
- `clubgeo.reachableFloor()`: flood fill from the entrance with the game's step rule (STEP 0.45,
  10 cm grounding walk) + clear rays. `clubzone.planLayout` places everything (informant, guards,
  evidence, captives, boss, night-case clues/witness) on that set; table-top items need a walkable
  spot within 1.3 m 0.55–1.25 m below; cage interaction at the cage centre.
- Tool: `tools/shots/clubreach.js` checks every club against a walk simulated with `collide()`.

## Next
- Run brawlrun on both views (all crimes, punch-only) and clubreach on all clubs; shoot brawler.
