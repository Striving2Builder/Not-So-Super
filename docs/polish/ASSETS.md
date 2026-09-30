# Incoming art (2026-09-30) — integration plan

Source: `C:\Users\ngnic\Desktop\Not So Super assets` (outside the repo). Copy into `assets/` as
WebP (≤ ~300 KB each) only when a builder integrates a set.

| Set | Contents | Use | Owner / round |
|---|---|---|---|
| Investigation Scenes (`city-patrol-scenes.zip`) | 13 painted rooms 2000x1200: office(+2), apartment(+2), alley(+2), barn, casino, factory, hotel, pier, burned, clubbar; lower-right left empty for the witness; no people/text | Replace the code-painted day-case rooms (crimescene.js) with these backdrops; per-image hotspot table (container rects, clue anchors, witness spot, foreground mask) in a data module; keep the dynamic layers (props that open, tents, X-ray, dust, light) drawn on top | investigation, round 3 (top priority there) |
| Side - RLD (`rld-alley-01..10.webp`) | side-view red-light street façades, neon, window silhouettes | brawler stage backdrops for red-light/nightclub districts (parallax facade layer) | brawler, round 3 |
| downtown-01..10.webp | daylight storefront façades, 2000x1200 | brawler stage backdrops for downtown/retail districts | brawler, round 3 |
| Humiliation Billboards: downtown-gs-01..05, sg-bb-01..10, sg-mix-* ; RLD Billboards sg-mix-02..10 | street scenes with a green-screen billboard (some with the heroine looking up at it), 1280x720 | "your humiliation on every billboard" cutscene / tabloid beat: capture footage keyed into the billboard | director: shared green-screen compositor, then story beat |
| capture/room.png | interrogation room with a green-screen wall TV, 2000x1200 | backdrop for the capture scene's villain TV | director (compositor) + captured.js |
| Humiliation Asylum packs (asylum, tv, mind, regen) | padded-cell stills, some with a green-screen TV, 1280x720, photoreal | asylum sedation / wake-up cutscene stills; TV variants take a keyed clip | later — style decision needed |
| office-gag / office-interrogation packs | captive interrogation stills, photoreal | capture-scene stills | later — style decision needed |

## Green-screen compositor (shared, `story/greenscreen.js` in the target layout)
- On load: chroma-key the image once (pure-green pixels → alpha, with spill suppression on the
  edge), and find the screen quad (the green region's four extreme corners).
- Draw: warp the video/frame into the quad (two affine triangles on 2D canvas, or a CSS
  `matrix3d` for DOM cutscenes), then the keyed image on top so frames/bezels/occluders overlap it.
- Works for flat TVs (capture room, asylum) and skewed billboards alike.

## Style notes for the user
- The painted sets (scenes, RLD, downtown, billboards) match the comic direction.
- The asylum / office packs are photoreal: they clash with the comic look the critics want, and
  several show the Superman "S" shield (trademark risk for a store release). Decide before use.
