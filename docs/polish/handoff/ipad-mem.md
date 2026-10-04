# iPad memory / freezes / black frames (ipad-mem) — IN PROGRESS

Brief: real iPad on a build with 774c006: "freezing, graphics not loading, all black at times".
Branch: worktree-agent-af99a0dff92db77be (from phase-2 ca40ffd).

## Done (WIP)
- `src/diag.js` (new, core): always-on session log in localStorage (3 sessions; ctx lost/restored/
  rebuilt, errors, freezes > 400 ms, mode changes, resizes, tab hidden, crash-reload flag); with
  `?perf=1`: 5 worst frames + work in them (built/freed/tiles/uploads/city ms), GPU MB estimate (GL
  upload wrapper: tex / render targets / geometry / canvases), memory every 10 s. Pause menu
  "Diagnostics" (?perf=1) or long-press the "Paused" title: text + Copy.
- gfx.js: losses/restores logged; LOADING text comes back after a restore mid-load; `onGfxReset`.
- city3d.js: KEEP near 40 / tiles 40 (of the lighting in use), idle 10 s AND > margin 450 m past the
  draw radius; jobs (builds, tile paint + upload) nearest/in-view first within 4 ms a frame; a near
  build's stand-in is its lite build; tiles painted in ONE scratch canvas + `initTexture` (no canvas
  per tile, no pool); reset on context restore/replace.
- ground3d.js: plan canvases released after upload (repaint on reset). settings.js: iOS tiles 112 px.
- flightpost3d.js: scene targets allocated once at the max scale, drawn in a corner viewport (no
  realloc on dyn-res steps / canyon switch). heropass3d.js: shrinks a target oversized for 300 frames.
- flight3d.js: re-applies its pixel ratio after a window resize; NaN hero/camera guard (logged).
- main.js: 0-size resize skipped; frame errors logged. stab.js `--turnback` (fly out, U-turn, timing).

## Next
- Measure before/after (stab --tour WebKit iPad, turnback, --lose), fly3d A/B, shoot.js errors.
