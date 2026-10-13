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
- **Nightclubs** — 3D infiltrations of the city's clubs: push through a packed dance floor, listen in, take (or dodge) the drinks, bluff the VIP host, blackmail the owner and fight in the back rooms. Each visit plays one of the clubs' cases; three story clubs have their own.
- **Ravenmoor Asylum** — a generated 3D level: a cross of corridors lined with padded cells behind steel doors. Investigate with X-ray and patients as witnesses; get caught and you're sedated (a clip plays) and wake in a cell with the case reset, until you solve it.
- **Capture** — an escape puzzle in a villain's room, or an ultimatum: public humiliation or an embarrassing deal.
- **Flight** — altitude bands, rooftop perching with super-hearing, district haze, clouds and air traffic; airborne rescues (falling window-washers, runaway and getaway cars, crashing helicopters), stunt hoops and stranded kittens; tabloid drones at night in vice districts; waypoints with autopilot.
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

**Graphics** (pause menu): *Auto* picks a profile for the device and drops to *Battery saver* by itself if flying can't hold ~45 fps. *Battery saver* caps at 30 fps, renders at 1× resolution and lightens the 3D scenes (a thinner club crowd, no haze, fewer stage lights). Gameplay runs on real time, so it plays the same at any frame rate.

## Project layout

- `index.html`, `style.css`, `server.js` — page, styles, zero-dependency static server
- `src/` — game code (plain ES modules)
  - `main.js` game loop and flow · `overworld.js` / `city.js` flight and city · `brawler.js` street fights · `investigate.js` crime scenes · `special3d.js` 3D zones · `club3d/` the 3D nightclubs (cases in `nightclub/cases/`) · `clubzone.js` the 3D zone engine of the asylum and the hotel · `captured.js` capture scene
  - `hero3d.js` rigged Supergirl model + animations · `cape.js` cloth-simulated cape
  - `comic.js` / `commentary.js` comic overlay and commentary engine · `data.js` all tunable content
  - `settings.js` graphics profiles (Auto / High / Battery saver) · `clubgeo.js` building collision + walkable-floor scan
  - `flight.js` flight physics · `sky.js` / `atmosphere.js` / `airspace.js` clouds, haze, air traffic · `airevents.js` airborne events · `paparazzi.js` tabloid drones · `nav.js` waypoint + autopilot · `asylum.js` the asylum level + sedation loop · `cutscene.js` full-screen clips
- `assets/` — models, animations, fonts, capture-room art, club art (room plates, close-ups, the dancer sheet), video
- `vendor/` — three.js, its loaders/Draco decoder, three-mesh-bvh
- `tools/` — dev only: the screenshot/perf harness (`shots/`), model pipelines (`supergirl/`, `heroskins/`, `export_enemy.py`, `repair_glb.js`), the club art (`nightclub/`), `build_video_manifest.js`

## Adding content

- **Videos and stills:** drop clips (mp4/webm/mov, or jpg/png/webp/gif) into the folders under `assets/video/`, then run `node tools/build_video_manifest.js` (the game reads `assets/video/manifest.json`; a static site can't list folders itself).
  - `Flying/`: plays in the minimap corner (which grows into a video panel) when she enters a district; in the Entertainment district clips keep coming while she stays.
  - `SG_RLD_Game/`: plays in that corner while she's in the Red Light district.
  - `SG_Intox_Game/`: plays in that corner while she's intoxicated (the meter is in the warning range).
  - `SG_Roof_Game/`: plays when she perches.
  - `SG_Captured_Game/`: loops on the capture-room TV (nightclubs and venues) and plays inside the green-screen billboards when she loses a street fight.
  - `SG_Humiliation_Game/`: plays inside those same billboards after she takes a deal that costs reputation (the capture ultimatum, and the club owner's blackmail). It loops until she taps out.
  - `SG_Office_Game/`: plays on the back-office monitors while she's in that room (the 3D nightclub). If the owner still has her dance on the recorder, that recording plays instead until she wipes it. One clip loops while she stays; the next visit deals the next clip.
  - `SG_DJ_Game/`: plays on the main-room screens (the DJ wall and the TVs) along with the clips already in `ClubDJ/`. One of them loops while she stays on the floor.
  - `SG_Asylum_Game/`: plays inside the cell TV's green screen after she's sedated, looping until she taps out.
  - Tuning (folders, hot districts, cooldowns, clip length) is `CITY_FEED` in `src/data.js`; players can switch the feed off in the pause menu.
  - Keep each file under 100 MB (GitHub's limit); short, compressed 720p clips load fastest on phones.
- **Clubs:** the 3D clubs are built in code from a seeded plan (`src/club3d/plan.js`: the main rooms and side rooms). A club case is data in `src/nightclub/cases/`, labelled on the map by `CLUB_CASE_LABELS` in `src/data.js`; a club venue is a `VENUES` entry with `club: true`.
- **Animations:** Mixamo-rigged FBX clips go in `assets/models/source_anims/` and are converted into `assets/models/supergirl_anims.glb`.
