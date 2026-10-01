# Incoming art (2026-09-30) — integration plan

Source: `C:\Users\ngnic\Desktop\Not So Super assets`. The sets that will be used are now in the
repo as WebP (not wired in yet):

| Folder | Files |
|---|---|
| `assets/scenes/` | 13 painted investigation rooms (2000x1200) |
| `assets/brawl/backdrops/` | `rld-alley-01..10`, `downtown-01..10` side-view façades |
| `assets/billboards/downtown/` | green-screen billboards: `downtown-gs-01..05`, `sg-bb-01..10`, `sg-mix-01,03,05,07,09` |
| `assets/billboards/rld/` | red-light green-screen billboards `sg-mix-02..10` (even) |
| `assets/asylum/tv/` | 30 padded-cell stills with a wall TV (27 green-screen; tv2-01/03/06 show static) |
| `assets/asylum/cell/` | 15 cell stills without a TV (`asylum-01..05`, `asylum-r01..r05`, `asylum-m01..m05`) |
| `assets/capture/room-2000.webp` | hi-res repaint of the capture room (different layout from `room.png`, whose hotspots captured.js uses) |

Not moved (undecided): the office gag / interrogation packs (blackmail-style stills).

| Set | Contents | Use | Owner / round |
|---|---|---|---|
| Investigation Scenes (`city-patrol-scenes.zip`) | 13 painted rooms 2000x1200: office(+2), apartment(+2), alley(+2), barn, casino, factory, hotel, pier, burned, clubbar; lower-right left empty for the witness; no people/text | Replace the code-painted day-case rooms (crimescene.js) with these backdrops; per-image hotspot table (container rects, clue anchors, witness spot, foreground mask) in a data module; keep the dynamic layers (props that open, tents, X-ray, dust, light) drawn on top | investigation, round 3 (top priority there) |
| Side - RLD (`rld-alley-01..10.webp`) | side-view red-light street façades, neon, window silhouettes | brawler stage backdrops for red-light/nightclub districts, **mixed with** the procedural façades | brawler, round 3 |
| downtown-01..10.webp | daylight storefront façades, 2000x1200 | brawler stage backdrops for downtown/retail districts, **mixed with** the procedural façades | brawler, round 3 |

**User decision (after a device test):** the code-generated brawler streets (brawlstage/brawlfacades)
look better than expected — keep that generator as the primary stage and use the painted façades
alongside it (e.g. some blocks/segments or some fights use a painting, the rest are generated),
not as a replacement. Iterate until it's 100% right.
| Humiliation Billboards: downtown-gs-01..05, sg-bb-01..10, sg-mix-* ; RLD Billboards sg-mix-02..10 | street scenes with a green-screen billboard (some with the heroine looking up at it), 1280x720 | "your humiliation on every billboard" cutscene / tabloid beat: capture footage keyed into the billboard | director: shared green-screen compositor, then story beat |
| capture/room.png | interrogation room with a green-screen wall TV, 2000x1200 | backdrop for the capture scene's villain TV | director (compositor) + captured.js |
| Humiliation Asylum packs (asylum, tv, mind, regen) | padded-cell stills, some with a green-screen TV, 1280x720, photoreal | **Sedation sequence (user spec):** when she's sedated and locked in her cell, a TV still plays a video in its green screen for a full **30 s, unskippable**, before she can get out; optionally a clip also plays at the moment of sedation to show she's back in her cell. Cell stills (no TV) cover the "back in the cell" beat. | asylum (selfbuilt) + director compositor |
| office-gag / office-interrogation packs | captive interrogation stills, photoreal | capture-scene stills | later — style decision needed |

## Green-screen compositor (shared, `story/greenscreen.js` in the target layout)
- On load: chroma-key the image once (pure-green pixels → alpha, with spill suppression on the
  edge), and find the screen quad (the green region's four extreme corners).
- Draw: warp the video/frame into the quad (two affine triangles on 2D canvas, or a CSS
  `matrix3d` for DOM cutscenes), then the keyed image on top so frames/bezels/occluders overlap it.
- Works for flat TVs (capture room, asylum) and skewed billboards alike.
- Key by hue, not strict RGB: the RLD billboards and the capture room use a darker, lit green
  (≈ rgb(45,107,43) / (50,98,73)); the asylum TVs and downtown billboards are near-pure green.

## Style notes for the user
- The painted sets (scenes, RLD, downtown, billboards) match the comic direction.
- The asylum / office packs are photoreal: they clash with the comic look the critics want, and
  several show the Superman "S" shield (trademark risk for a store release). Decide before use.
