# Handoff: sky / clouds / post / speed lines, round 8 (DONE, ready to merge)

Builder area: round-8 briefs 3 (sky part), 4, 5 (post part) and 6 (speed lines). Branch based on phase-2 02d2bb0.

## Done
- `src/sky3d.js`:
  - The dome is keyframed by the hour (`SKY`: zenith, mid, warm band above the horizon, horizon = the haze's end colour). Blue day with a mid-blue (not white) horizon; a sunset going from blue down to an orange band (19:xx, where most harness shots are); violet night.
  - Inked comic sun disc (`SUN`, its own `discDir`, drawn lower than the key light). It lingers on the horizon until night 0.72. The moon and stars only show from night 0.82 on (about 19:38).
  - Clouds: an SDF atlas built at start (~90 ms in node). 8 shapes of 4 kinds; overlapping puffs with a flat cut base.
    - Three cel tones: lit crown, body, scalloped shadowed base.
    - Silhouette ink plus inner puff lines.
    - AA'd at any size; inner detail fades when a cloud is small.
  - Cloud fades:
    - Box distance: no cloud within 50 m of the lens or within hero distance + 25 m.
    - No ordinary cloud wider than the frame.
    - In the high views, no big cloud in the upper half (it was cut off behind the minimap). The huge banks are limited to the lower half.
    - Every fade is sharpened (no half-transparent ghosts).
- `src/buildings3d.js` (city file, a 2-line touch): `HAZE.nearAlt` 1.4. Haze starts at max(0.1·far, 1.4·camera height), so the high-patrol city reads.
- `src/flightfx3d.js`:
  - 2D action lines: thin spindles tapered at both ends, ending 10–44 px inside the screen, 'lighter' at low alpha.
  - 3D wind streaks: additive, fading 7–15 m from the lens.
- `src/flightpost3d.js` + `settings.js` (new line per profile, `fly3dSharpTaps`) + `flight3d.js` (one arg): both-diagonal sharpening on High.

## Measured
- Shots: `shots/r8sky3/flying/` (full set), `shots/r8sky4/` (boost and patrolview after the last tweaks).
- Clean baseline: scratchpad `skybase/shots/base/`.
- Perf: `fly3d.js`, 3D/2D ratio, 2 alternating A/B rounds each:
  - base skim/cruise/high: 0.94 / 1.09 / 1.15
  - mine: 1.12 / 1.19 / 1.23
  - Within noise, no regression.
- Balanced canyon `fly3dDpr` 0.75 → 1.05: skim ratio 0.88 vs 0.99 base (about −10%). REVERTED, over budget.

## Next ideas
- Canyon scale: try 0.85–0.9 with a pinned-dynres perf run.
- The lit-crown seams inside big heads read as rings ("eyes") up close. Shrink the lit offset or merge crowns per tier.
- The sun is often just off frame (south arc, north-flying camera). Consider a west-leaning sunset azimuth.
- The far ground at dusk is still a flat lilac plane from high patrol. That is the city haze curve (`HAZE_GLSL`, city builder).
