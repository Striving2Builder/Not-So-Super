# Stability (iPad crashes / zone-load freezes / "back to 2D") + 3D flight perf bisect

## Done
- `tools/shots/stab.js`: fly → brawler / investigation / Warehouse → fly loop on the iPad Pro 11
  descriptor (WebKit + Chromium): sync ms, ready, longest frame gap, live/made WebGL contexts, GPU MB
  estimate (all contexts), JS heap (Chromium). `--lose` loses + restores the shared context mid-flight.
- `tools/shots/flyab.js` (variants with overlay folders, round-robin) and `tools/shots/flytoggle.js`
  (frozen frame, each feature off in turn) for the r8 perf bisect.

## Baseline (before)
- WebKit iPad: 3 live contexts flying (hasWebGL probe never released: WebKit doesn't GC it), 5 after
  a brawl; fly→brawler blocks 2962 ms sync (ready 8.7 s), fly→investigate longest gap 3.1 s.
- Chromium iPad: GPU ~112 MB flying (+22 MB drawing buffers) and it stays while in a zone; grows to
  ~165 MB after 2 rounds; brawl entry 541–920 ms sync (900 ms prewarm budget inside enter + readbacks).
- Title attract (2D) makes a 512² HeroSprite context with its own 11 MB of hero textures; brawler makes
  a 2nd HeroSprite (11 MB again) + the crook baker; newspaper/captured make more.

## In progress / next
- see git log
