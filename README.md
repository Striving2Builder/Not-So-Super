# Not So Super — Supergirl: City Patrol

A 2.5D top-down superheroine patrol game for the browser (desktop and mobile). Fly over a procedurally generated city, dive into crimes, and try to keep your reputation — and your dignity — intact. Campy 60s/80s comic-book style: POW! bursts, narrator captions and a press that loves or mocks you depending on how you're doing.

## Run it

ES modules don't load from `file://`, so serve the folder:

```bash
npm start          # or: node server.js
```

Open http://localhost:8080. The server also prints a LAN address for playing on a phone on the same Wi-Fi. There is no build step and no dependencies to install.

## What's in the game

- **City patrol** — a seeded city with 15 districts (Financial, Docks, Casino, Red Light, Villains' Lair…) drawn in 2.5D with traffic, day/night and neon.
- **Street crimes** — side-scrolling beat 'em up (jab/cross/kick combos, heat vision, freeze breath, captives to free).
- **Investigations** — point-and-click crime scenes with X-ray vision, a camera for evidence photos, witnesses and suspects.
- **Special zones** — third-person 3D infiltrations with guards, informants, tempting "gifts" and bosses. You can be captured.
- **Club raids** — the same, inside premade 3D clubs (`assets/clubs/`).
- **Capture** — an escape puzzle in a villain's room, or an ultimatum: public humiliation or an embarrassing deal.
- **Reputation** — front-page newspapers for victories and tabloids for humiliations; tabloid heat and intoxication drag it down.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | floating joystick (left side) |
| Dive / jump | Space | DIVE / JUMP |
| Punch / use | J or F / E | on-screen buttons |
| Special / X-ray | K / X | on-screen buttons |
| Boost | Shift | BOOST |
| Map / pause | M / Esc | MAP / ❚❚ |

Drag the screen to turn the camera in 3D zones. Add `?touch=1` to the URL to test touch controls on desktop.

**Graphics** (pause menu): *Auto* picks a profile for the device and drops to *Battery saver* by itself if flying can't hold ~45 fps. *Battery saver* caps at 30 fps, renders at 1× resolution and loads lighter clubs (512 px textures, simple materials). Gameplay runs on real time, so it plays the same at any frame rate.

## Project layout

- `index.html`, `style.css`, `server.js` — page, styles, zero-dependency static server
- `src/` — game code (plain ES modules)
  - `main.js` game loop and flow · `overworld.js` / `city.js` flight and city · `brawler.js` street fights · `investigate.js` crime scenes · `special3d.js` / `clubzone.js` 3D zones · `captured.js` capture scene
  - `hero3d.js` rigged Supergirl model + animations · `cape.js` cloth-simulated cape
  - `comic.js` / `commentary.js` comic overlay and commentary engine · `data.js` all tunable content
  - `settings.js` graphics profiles (Auto / High / Battery saver) · `clubgeo.js` club collision + walkable-floor scan
- `assets/` — models, animations, fonts, capture-room art, converted clubs
- `vendor/` — three.js, its loaders/Draco decoder, three-mesh-bvh
- `tools/` — `export_club.py` (Blender → web GLB for clubs), `repair_glb.js`, `bake_clubs.js` (lite club copies + baked floors)

## Adding content

- **Villain videos for the capture-room TV:** put MP4s in `assets/video/` and list them in `CAPTURE_VIDEOS` in `src/data.js`.
- **New clubs:** `blender -b club.blend --python tools/export_club.py -- assets/clubs/name.glb --replace assets/clubs/replacements`, then `node tools/repair_glb.js assets/clubs/name.glb` and `node tools/bake_clubs.js name` (makes `name.lite.glb` for phones and bakes the walkable floor into `name.json`; run `npm install --prefix tools` once first), add it to `CLUBS` in `src/clubzone.js` and a venue in `VENUES` in `src/data.js`.
- **Animations:** Mixamo-rigged FBX clips go in `assets/models/source_anims/` and are converted into `assets/models/supergirl_anims.glb`.
