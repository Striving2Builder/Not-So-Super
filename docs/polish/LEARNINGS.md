# Learnings (append-only, one line each; every builder reads this, skims it in a minute)

- SwiftShader fps in the harness is ~5 in the club: too coarse for a 5% budget; use draw calls/triangles, or a long-window A/B (`tools/shots/flybench.js`).
- The machine can sleep mid-harness: rerun the area rather than trusting a partial run.
- `club3d.js` used to crash when the map had no free nightclub-district spot; it now clears other markers first (round 11 T).
- `?flight=2d` isn't seeded: a different city each run, so its before/after frames never match.
- Three builders + a scout in parallel hit the monthly spend limit mid-work three times in round 11: commit WIP every ~30 min.
- Worktrees don't have `docs/references/` (git-ignored): give agents absolute paths to the main checkout's pools.
- Round 11 T removed v1/v2 clubs: anything importing `src/nightclub/{nightclub,stage,intox,crowd,layout}.js`, `clubmood`, `clubdress`, `nlclub`, `NIGHT_JOBS`, `mergeStatic/packFloor` or the `club*` settings keys is stale.
