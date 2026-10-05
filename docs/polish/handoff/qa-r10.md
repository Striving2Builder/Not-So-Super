# QA round 10 handoff (cloud session 3, branch `cloud/qa-r10`) — IN PROGRESS

Integration build = local scratch branch: origin/phase-2 + merge city-r10 → flight-r10 → hero-r10 (not pushed).

## Merge conflicts
- city-r10 → phase-2: clean. flight-r10: clean (shoot.js: city's `--only a,b` and flight's boost wait auto-merge;
  `tools/shots/flybench.js` is byte-identical on all three branches, blob 1d77e2a).
- hero-r10: **`src/herofly3d.js`**, 2 hunks:
  1. `POSE`: flight adds `flesh`/`inkPx` (screen box) and drops `shadow` (its shadow mesh no longer uses
     POSE.shadow); hero adds `idleYaw`/`stretch`. Keep the union, without `shadow` (no reader left).
  2. `LINE`: both set `halo: 0`; hero adds `near/min/hull` (read by its keyline()/ink hull). Keep hero's line.

## Status
Harness running on phase-2 and integration (logs in progress).
