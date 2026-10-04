# Device fixes (iPad feedback, 2026-10-03): handoff

Branch from phase-2 d45e1c4, phase-2 (dive landing) merged in. Four gameplay/feel bugs only.

## 1. Flight idle pose ("standing on air") — done
- Cause: hover = the standing idle clip + a small knee lift; dropping onto a perch also played the
  standing idle all the way down.
- `src/heropose3d.js` `hovering(m, k, t)`: superhero float (body axes): right knee lifted, left leg
  trailing with a soft knee, toes pointed, right fist on hip, left arm loose, leg sway with the bob,
  forward lean (`FLY_POSE.hoverTilt`). Slow glide: knees bent, shins trailing back. `perched` only
  once she's within 6 units of the roof (floats down in the hover pose). `herofly3d.js`: hover cape
  drifts back + sways. `herofly.js` (2D sprite) uses the same pose, lean and perched flag.
- Shots: `shots/supergirl/devfix-hover-base.png` vs `devfix-hover1.png`; `devfix_hover_ab.png`.

## 2–3. Brawler auto-push + end stall — done
- Cause (repro `shots/devfix-base/`, robbery + kidnap stalled on iPad): camera led her by 110 units
  and she was clamped to the camera view, so a wave lock snapped it forward and shoved her (iPad 4:3
  view ≈333 units). Gunmen backed off to 360 units and were clamped to cam±(view+80) while she was
  clamped to cam±(view−30): 110-unit gap > punch reach, off screen → fight never ended.
- Fix `src/brawler.js`: window camera (holds still in a band left of centre, keeps the stage cache in
  fights), she's bounded only by the street or the fight arena (half ≥270, never ahead of her),
  crooks share the arena (cornerable), gunmen keep an on-screen distance, watchdog walks anyone off
  screen >6 s back in, NaN guard. `brawlfx.js`: "HELP!" arrow + objective row for captives/fires
  left behind.
- Tool: `tools/shots/brawlrun.js` (keyboard bot, god mode, stall dump + screenshot).

## 4. 3D club stages — done
- Cause: scanned floor keeps every upward surface within 1.6 m of the main floor (stage at +1.0 m in
  the Triangle, +1.1 m in the strip club, bar/table tops); `choose()` (evidence, captives, boss,
  night-case clues) used all of it, table-top items used heights vs mainY with no reach test.
  Old rules: 15% (triangle) / 24% (strip club) / 6% (clubhouse) of floor spots and 18% / 46% / 0%
  of table-top spots unreachable.
- Fix: `clubgeo.reachableFloor()` flood fill from the entrance, edges walked with the game's own
  movement (capsule push + STEP grounding); `clubzone.planLayout` places everything on it
  (`walkFloor`, cached per club); table-top items need a walkable spot ≤1.3 m away and 0.55–1.25 m
  below; cage interaction at the cage centre. Cost: flood ~0.3–1.7 s once per club load (SwiftShader).
- Tool: `tools/shots/clubreach.js` → `shots/devfix-club2/clubreach.json`: 0 unreachable across
  3 clubs × raid + night case × 25 seeds.

## Next
- If the one-off club flood stalls on iPad: bake it into `assets/clubs/*.json` (spawn is deterministic).
