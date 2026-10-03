# Stability (iPad crashes / zone-load freezes / "back to 2D") + 3D flight perf bisect — DONE

## Tools
- `tools/shots/stab.js`: fly → brawler / investigation / Warehouse → fly loop, iPad Pro 11 descriptor,
  WebKit + Chromium: sync ms, ready, longest frame gap, live/made WebGL contexts, GPU MB estimate
  (all contexts), JS heap (Chromium). `--tour N` flies the whole city first; `--lose` runs the
  lost-context tests (restore / never restored / no WebGL left); `--overlay dir` = baseline src.
- `tools/shots/flyab.js` (variants round-robin) + `tools/shots/flytoggle.js` (frozen frame, one
  feature off at a time); `tools/shots/serve.js` (overlay static server). Snapshots (gitignored):
  `shots/stabab/head` (2213251 src) and `shots/stabab/r7` (02d2bb0 src). Never run two benches at once.

## Root causes (evidence)
- City chunk builds + ground tiles never freed: a 40 s city tour took GPU 114 → 286 MB (187 textures,
  431 geometries) + 0.75 MB 2D canvas per tile. Now trimmed: 125 MB, 48 textures, 208 geometries.
- hasWebGL probe never released (WebKit: 3 live contexts flying); every HeroSprite + crook baker had
  its own context with its own 11 MB of hero textures (5 contexts after one brawl). Now 1 / 2.
- Brawler enter() baked sprites for up to 900 ms synchronously; 3D zones compiled shaders in frame 1.
- "Back to 2D": Flight3D.enter threw (no context) before body.fly3d → overworld silently drew 2D;
  a reload with WebGL blocked also went 2D silently; no lost-context handling at all (black screen).

## Before → after (WebKit iPad, same session load; Chromium similar)
- Contexts flying 3 → 1; in a brawl 5 → 2. GPU est. flying 112–132 → 87–112 MB; in zones 122–144 →
  61–92 MB. First brawl sync 1261 → 756 ms (later brawls 171 → 2 ms), now behind a LOADING card.
  Warehouse longest frame 702–749 → 265–366 ms. Investigation bake frame unchanged (~700 ms) but
  behind the card and done once (not stand-in + painting).
- Flight fps vs r7 (SwiftShader, round-robin): Balanced head 0.86–0.88 → 0.92–0.96;
  High head 0.82–0.90 → 0.88–1.00. Per-feature costs: shots/stabab/tog-*.json/log.

## Open / next
- High patrol still ~8% (Balanced) / 12% (High) under r7: more content drawn (+25% tris).
- Investigation room bake is still one ~0.5–0.7 s frame (could be split over frames).
- iPad real-device check: ?perf=1 shows `gl ctx`; watch for the RESTORING card / crash toast.
