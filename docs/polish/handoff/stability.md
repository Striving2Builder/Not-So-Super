# Stability (iPad crashes / zone-load freezes / "back to 2D") + 3D flight perf bisect

## Tools
- `tools/shots/stab.js`: fly → brawler / investigation / Warehouse → fly loop on the iPad Pro 11
  descriptor (WebKit + Chromium): sync ms, ready, longest frame gap, live/made WebGL contexts, GPU MB
  estimate over all contexts, JS heap (Chromium). `--tour N` flies the whole city first; `--lose`
  runs lost-context tests (restore / never restored / no WebGL left); `--overlay dir` = baseline src.
- `tools/shots/flyab.js` (variants with overlay folders, round-robin) and `tools/shots/flytoggle.js`
  (frozen frame, each feature off in turn) for the r8 perf bisect. Baseline snapshots in
  `shots/stabab/{head,r7,nosky,nocity,nohero}` (head = 2213251 src, r7 = 02d2bb0 src).
- Never run two benches at once (and don't edit src while one serves the live tree: use --overlay).

## Root causes found (before)
- City chunk builds + ground tiles never freed: a 42 s city tour took the GPU estimate 114 → 286 MB
  (187 textures, 431 geometries), plus ~0.75 MB of 2D canvas per tile. Long sessions → iOS kills tab.
- hasWebGL() probe context never released (WebKit keeps it: 3 live contexts flying).
- Every HeroSprite and the crook baker had its own WebGL context (title attract 512², brawler,
  newspaper, capture room) each with its own 11 MB of hero textures.
- Brawler entry: 900 ms prewarm budget inside enter() (WebKit 3.0 s sync, ready 8.7 s).
- No lost-context UI/recovery; if the renderer can't be (re)made the overworld silently drew 2D
  (Flight3D.enter threw before adding body.fly3d), and a no-WebGL reload starts in 2D silently.

## Changes (WIP, see git log)
gfx.js (IOS, hasWebGL with release, watchContext/gfxLost/loadingPanel, crash-reload flag),
offscreen3d.js (one shared sprite renderer, released in 3D flight), special3d.js (makeRenderer +
replaceRenderer on give-up, warmUp compileAsync behind LOADING), flight3d.js (drop2D, free targets
on exit, release offscreen), overworld.js (drop3D, try/catch enter, 2D-blocked toast), main.js
(pause while lost, gfxFailed, startZone try/catch, crash → Battery saver), settings.js (iOS caps,
afterCrash), city3d.js/cityart.js (trim KEEP), brawler.js/investigate.js (staged LOADING),
camera3d.js/clubzone.js (warming guards), perfhud.js (gl ctx count), style.css (#gfx-panel).

## Next
- Test everything (stab.js webkit+chromium, --lose, --tour), shoot.js flying/brawler/investigation.
- Perf bisect results → fixes (ground plan aniso, keyline, hero pass, sharpen taps on High).
