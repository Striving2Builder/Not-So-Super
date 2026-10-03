# Handoff: sky / clouds / post / speed lines, round 8

Builder area: round-8 briefs 3 (sky part), 4, 5 (post part), 6 (speed lines). Branch based on phase-2 02d2bb0.

## Done (committed)
- `src/sky3d.js`:
  - The dome is keyframed by the hour (`SKY` table: zenith, mid, warm band just above the horizon, horizon).
    - Day: deep blue over a pale warm band, with a mid-blue horizon. It was near-white, which turned the far skyline white.
    - Sunset: blue down to an orange band.
  - Inked comic sun disc (`SUN`) on a separate `discDir`, capped low so it can come into frame; it lingers into the sunset. The moon and stars only show from night 0.82 on (about 19:38).
  - Clouds: a new SDF atlas (DataTexture, 4×2 cells of 512×256, 4 kinds: tower, wide, anvil, small) with overlapping puffs, a flat cut base and three cel tones (lit crown R, body, shadowed base G), inner ink lines (B) and the silhouette ink (A). AA'd at any size, so no staircases. Inner detail fades when a cloud is small.
  - Clouds fade by box distance: none within 50 m of the lens or within hero distance + 25 m.
  - The huge banks only appear in the lower half of the frame (fixes the bank cut off behind the minimap).
- `src/buildings3d.js` (city file, a 2-line touch): `HAZE.nearAlt` 1.4. Haze starts at max(0.1·far, 1.4·camera height), so from high patrol the city under her isn't swallowed. The haze colour still derives from `Sky3D.horizon`, which now lives in sky3d's `SKY` table.
- `src/flightfx3d.js`:
  - The 2D action lines are thin spindles, tapered at both ends, that stop 10–44 px inside the screen edge, drawn with 'lighter' at low alpha. There are no more edge bars.
  - The 3D wind streaks are additive and fade within 7–15 m of the lens.
- `src/flightpost3d.js` + `settings.js` (new line `fly3dSharpTaps`) + `flight3d.js` (1 arg): 4-tap (both diagonals) sharpening on High.

## In progress / next
- Full shot set running: `shots/r8sky/flying/`. Clean baseline from a `git archive` copy at scratchpad `sky/../skybase/shots/base/` (port 8763).
  - Note: the first `shots/r8sky-base` in the worktree is CONTAMINATED: edits landed mid-run. Ignore it.
- Check the day, high, patrolview, boost and night PNGs: sunset grading at 19:xx, cloud near-camera fade, banks, speed lines.
- Perf A/B: `node tools/shots/fly3d.js --port 8762 --rounds 6`, alternating the baseline copy and the worktree (budget ≤5%).
- Try the Balanced canyon `fly3dDpr` [1, 0.75] → [1, ~1.0–1.35] if perf allows. Not done yet.
- The atlas is built on the main thread (~1M texels × ~15 circles). Time it; if it's slow, drop to 256-row cells or cache.

## Notes
- The scratchpad is shared with other builders: use the `sky/` subfolder only.
- Most harness shots are at 19:0x–19:3x (night 0.5–0.77). That is what the critic called the "pink-lavender day".
