# Learnings (append-only, one line each; every builder reads this, skims it in a minute)

- SwiftShader fps in the harness is ~5 in the club: too coarse for a 5% budget; use draw calls/triangles, or a long-window A/B (`tools/shots/flybench.js`).
- The machine can sleep mid-harness: rerun the area rather than trusting a partial run.
- `club3d.js` used to crash when the map had no free nightclub-district spot; it now clears other markers first (round 11 T).
- `?flight=2d` isn't seeded: a different city each run, so its before/after frames never match.
- Three builders + a scout in parallel hit the monthly spend limit mid-work three times in round 11: commit WIP every ~30 min.
- Worktrees don't have `docs/references/` (git-ignored): give agents absolute paths to the main checkout's pools.
- Round 11 T removed v1/v2 clubs: anything importing `src/nightclub/{nightclub,stage,intox,crowd,layout}.js`, `clubmood`, `clubdress`, `nlclub`, `NIGHT_JOBS`, `mergeStatic/packFloor` or the `club*` settings keys is stale.
- Club beat/prompt timers must run on game time (`this.t`), not `setTimeout`: a harness screenshot costs seconds of real time and ran a 6 s answer window out before the key press (round 11 V).
- `club3d.js` forces `&club3case=<--case>` unless the query brings one: generated cases use `&club3case=gen&club3gen=<seed>`; `&club3beat=9999` stops the crowd beats firing on their own timer (round 11 V).
- `travel.js` full run can report "impostor was never offered" after the other moments; `--only impostor` offers and wins it (harness ordering, not the game; round 11).
- club3d.js: all 5 rooms + flows + --gen in one run can crash the SwiftShader tab ("Target crashed") and take every later flow down with it; run --gen with `--rooms rave --flows none` (passes in isolation, 2026-10-13).
- club3d knot (casebeats.js) runs outside generated cases via `knotHost()` (idle ring, cage); formKnot releases a running knot first, so a beat takes over the idle ring's dancers (round 11 D2).
- The harness "black box" (bottom-right, under the LIVE panel) was Chromium culling the WebGL canvas in the LIVE <video>'s rect mirrored vertically (body bg #05070d showing); not in the GL or 2D canvas. Fix: `#feed video { filter: contrast(1.001) }` (style.css r11 F). Count it with a #05070d pixel scan (round 11 F2a-finish).
- comic.js bubbles and the club's tap bubbles (#c3-chat .c3b, chatter.js) are two layers: any de-overlap must place both in one pass (feelfx.js layoutBubbles). Bouncers aren't crowd, so the crowd's see-through dither never thins them (round 11 L2b).
- Port 8884 on the director's machine is another service (it answers JSON): a harness there times out waiting for `#btn-new` with no page errors; `tools/shots/rld.js` uses 8897 (Act 2 I).
