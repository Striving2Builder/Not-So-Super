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

## Status
- Done: v3 sheets look right for brawl3d, inv3d, brawl2d, cold3d, spec3d (`shots/dive/v3/`).
- Next: reduced-motion + club2d sheets; shoot.js flying page-error check; tune on iPad.
