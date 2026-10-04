# Dive THUD (comic landing beat): handoff

Branch based on phase-2 8ad5bf2. Scope: the dive transition from flight into any zone.

## How it works
- `src/divefx.js` (new, story layer): `diveFx.start(label)` (from `commentary.onDive`, replaces the
  spinning emblem), `plunge(f, x, y)` per dive frame, `impact(x, y, land)` once. Table `DIVE_FX`.
- Plunge: manga focus lines converging on her (one canvas, redrawn per frame only during the dive),
  ink vignette, CSS `scale` push-in on `#three-host`/`#c2d` toward her (1.10 in 3D, 1.05 in 2D).
- Impact: the frame she lands on is copied off the game canvases into the overlay (same rAF task, so
  WebGL is still readable) = the hit-stop still, with halftone, crater, cracks and impact lines burnt
  in; flash (white-hot → yellow), 2 inked rings, cel dust clouds, burst-balloon onomatopoeia (8 words,
  4 palettes, per-letter tilt/swell), zone tag; `sfx.thud()`. The zone starts on the next frame,
  behind the panel; everything after is CSS transform/opacity (plays through blocking loads).
- Hold until the zone's LOADING is down (`gfx.isLoading()`, `#club-loading`), min 620 ms, max 2.6 s
  (tag grows loading dashes after 950 ms), then a diagonal panel wipe (320 ms).
- Hooks: overworld.js (`diveFrame()` after each dive render; impact at f > 0.88; render skipped once
  fired; old shock/shake/flash/white vignette removed), commentary.onDive, gfx `isLoading`, sfx `thud`,
  style.css `/* === dive === */` (HUD/btns/touch lifted to z 8 during the beat; `#banner` held until wipe).
- Reduced motion (`prefers-reduced-motion`): no push, no flash, no shake, no rings; word fades in; fade out.

## Tools
- `node tools/shots/dive.js --port 8841 --label dive/X --cases brawl3d,club3d,brawl2d,club2d,inv3d,spec3d,cold3d [--reduced]`
  virtual 60 Hz clock (rAF/now/setTimeout + every CSS animation stepped), so frames show phone timing
  even though SwiftShader runs ~7 fps. Sheets: `shots/dive/X/<case>.png` (`tools/shots/sheet.py`).

## Timeline (60 fps phone; dive pressed at 0)
- 0–0.97 s plunge (dive pose, focus lines building, push-in) → 0.97 impact: white-hot flash, still
  frame (80 ms hit-stop) → shake 420 ms, rings, dust, word pops (360 ms, overshoot) → zone starts
  next frame behind the panel → hold ≥ 620 ms after impact (until the zone's LOADING is down, ≤ 2.6 s)
  → 320 ms diagonal wipe with an ink gutter → the zone's title banner plays. Zone fully visible ≈ 1.9 s
  when its load is fast (was: spinner over everything to 1.45 s, zone at 1.1 s + LOADING card).

## Status: done
- Sheets (git-ignored): `shots/dive/v4hit/brawl3d.png` (impact window, every frame), `v3hit/club3d.png`,
  `v3/{inv3d,brawl2d,cold3d,spec3d}.png`, `v4/{club2d,inv2d}.png`, `v4reduced/brawl3d.png`.
  `node tools/shots/shoot.js flying --label dive --port 8841`: no page errors.
- Cost: nothing in normal flight (one `this.diving` check). During the beat: one full-screen 2D canvas
  (dpr ≤ 1.5, freed after), ~40 wedges/frame for ~1 s, one full-frame drawImage + ~6k halftone dots once.
- Fixed on the way: a `fill: both` 2nd animation hid the word's pop-in; the zone banner (z 55) is
  held paused until the panel is gone (`body.divefx-hold`).
- Unused now: `comic.spin` + `sfx.spin` (the old spinning-emblem transition) kept for other uses.

## To tune on the iPad
- `DIVE_FX` in divefx.js: holdMs (620), shake (16 px), push (1.10), wipeMs; word size in impact().
- Check `scale`/`translate` CSS animations stay smooth through the investigation bake (~0.7 s frame).
- 2D flight: the crater lands on the incident marker, at her fists (sprite is drawn below it).
