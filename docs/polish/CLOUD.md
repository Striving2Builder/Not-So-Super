# Polish pass in a cloud session

The user runs some rounds as Claude Code **cloud sessions** (their $100 cloud-session credit, expires
2026-11-05). Read STATUS.md first ("Pick up here" and "Round 10 review"), then this file, then
[BRIEF.md](BRIEF.md) (the builder brief: constraints, perf budget, handoff rules).

## What a cloud session can and can't do
- **Can:** edit code, run the harness headless (SwiftShader), commit, push its own branch.
- **Can't:** Blender (the blender-mcp addon runs on the user's PC: model edits, hair locks, weights,
  re-exporting GLBs), real-device testing (the iPad), blind AAA critics (`docs/references/` is
  git-ignored, copyrighted, local only). If a fix needs any of these, **stop that item, write it under
  "Flagged for local" in your handoff, and move to the next item.** Don't fake it in code.
- `shots/` is git-ignored: your screenshots don't reach the user. Put the few frames that prove a change
  into your handoff as descriptions + metrics; the local director re-shoots after merging.

## Setup (once per session)
1. `bash tools/cloud-setup.sh` (Playwright + Chromium + Pillow).
2. Smoke test: `node tools/shots/shoot.js flying --label smoke --port 8871 --only fly3d_cruise`, then
   look at `shots/smoke/flying/fly3d_cruise_1.png`. If WebGL fails to start (blank canvas or a
   "WebGL" page error), the Linux Chromium may want `--use-angle=swiftshader` instead of
   `--use-gl=swiftshader` in the launch args of the tool you're running; note what worked here.
3. If setup itself fails (no network to the npm registry / Playwright CDN), tell the user: the cloud
   environment's network access must allow them.

## Branches
- Branch off `phase-2` as `cloud/<area>-r10` (e.g. `cloud/city-r10`). Commit WIP often with
  `docs/polish/handoff/<area>-r10.md` updated in the same commit (BRIEF.md "Handoff file"), and push.
- **Never push to `phase-2` or `main`.** The local director merges your branch, re-shoots and runs
  the blind critic.
- Work alone (no sub-agent waves): one area per session keeps the credit going further. Read
  screenshots sparingly (`--only <scenario>`, crops): images are the expensive part.

## Conflict zone: the iPad memory builder (running locally, merges first)
Branch `worktree-agent-af99a0dff92db77be` (pushed for reference, WIP; handoff
`docs/polish/handoff/ipad-mem.md`) changes `src/city3d.js` (budgeted rebuilds, farthest-first trim,
`KEEP`), `src/ground3d.js` (tile canvases, sizes), `src/gfx.js`/`src/diag.js` and render-target sizes.
Keep your city changes in the building/shader/material code (buildings3d, blocks3d, skyline3d,
skycard3d, river3d, street3d, landmarks3d, sky3d) where you can; if you must touch the rebuild/memory
or tile-allocation code in city3d.js / ground3d.js, keep the diff small and say so in the handoff.
Don't raise GPU memory (textures, render targets): the iPad is crashing on memory.

## Session briefs (in the user's order)
1. **Buildings / city round 10** (`cloud/city-r10`): STATUS.md "Round 10 review" → City items
   C1–C13. Perf budget ≤5% vs phase-2 at every band (`fly3d.js` A/B, alternating, see STATUS
   "Harness"); report calls/tris/texture MB. All of it is procedural code (no Blender expected).
2. **Flying** (`cloud/flight-r10`): "Round 10 review" → Flying items F1–F4 and the Supergirl items
   marked *code*. The chase camera angle stays as it is (user, 2026-10-04).
3. **QA / testing** (`cloud/qa-r10`): run every harness tool on phase-2 and list what's broken,
   without visual changes: `shoot.js` for every area (page errors, missing frames), `brawlrun.js`
   (brawls complete), `clubreach.js` (no unreachable spots), `stab.js --tour` and `--lose` (context
   loss recovery), `dive.js` (all cases). Fix plain bugs (exceptions, stuck states) with a test or a
   tool run that proves the fix; list anything visual or design-level for the director instead.
