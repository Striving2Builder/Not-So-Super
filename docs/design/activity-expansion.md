# Activity expansion: isometric crawl, brawler and 3D investigations

2026-10-19. Working discussion doc, copied from the live planning doc:
https://claude.ai/code/artifact/029c3f02-e40f-4866-ba68-19d2a01fdf9d (the live doc may be newer).

## Purpose and status

This is a working discussion doc for Not So Super, not a plan: nothing here is scheduled. Core systems come first, and flight stays the anchor of the game. The goal is to decide which secondary activity is worth upgrading next, and how combat and failure fit.

## Where the activities stand today

Flight and the nightclub crawls are the two strong pillars; investigations and the side brawler are MVPs that show the shape of the game but not its ceiling.

| Activity | Maturity | What works | Main gap |
| --- | --- | --- | --- |
| Flight | Strong | The core loop; feels good and is done well | None blocking; polish only |
| Nightclub 3D investigation crawls | Strong | Adds atmosphere and feel; 3D infiltration clubs (`club3d/`) with crowds, bouncers, VIP and back-room fights | Club-shaped spaces only |
| Side brawler | MVP | Quick dopamine hit | Shallow next to dedicated brawlers |
| Investigations | MVP | Shows the detective fantasy | Point-and-click on one painted room (13 backdrops in `assets/scenes/`); little to explore |

The pattern: the activities that put the player inside a 3D space (flight, club crawls) are the ones landing. That points toward giving investigations and any new combat a real space to move through.

Also already built, and important for what follows: the Special3D infiltration zones (third-person, guards, captures), Ravenmoor Asylum (a generated 3D investigation level) and the hotel's 13th floor.

## The isometric crawl idea

Most of an isometric crawl already exists in the 3D zone engine. The new work is mainly a high fixed camera mode, more building layouts, and tuning for the phone budget.

**Already built**

- **Generated buildings with cutaway.** `ClubZone` (`clubzone.js`) builds a building, gives it BVH collision and a walkable-floor scan, and slices walls off above her head so the camera sees into rooms. The asylum and the hotel's 13th floor generate their own layouts this way.
- **A camera that already goes high.** `camera3d.js` pitches between about 44° and 76° (`CAM_PITCHES` in `zonekit.js`). An isometric view is close to a preset of what exists.
- **A crawl-shaped level.** Ravenmoor Asylum (`asylum.js`) is a generated cross of corridors and cells with orderlies, X-ray, witnesses, captives and a fail state (sedation, wake in a cell, case reset).
- **Room content.** The night-case investigation layer (`nightcase.js`, `CaseFile`: clues, witness, suspects, X-ray), guards with sight cones (`guards3d.js`), temptations and bait items, captures.
- **The comic look in 3D.** `look3d.js` gives every zone cel shading, halftone in shade, ink-hull outlines, ink edges on architecture and a panel vignette, with no post-processing pass, so it is mobile-cheap.
- **Mobile controls.** The floating joystick and on-screen buttons already drive the 3D zones.

**Missing**

- **Fixed high camera mode:** a locked isometric-style angle (likely orthographic or a narrow FOV) instead of the over-the-shoulder follow cam.
- **More layouts:** today's generators make a cross of corridors (asylum) and one hotel floor. Museums, fun houses and prisons each need a room-graph generator or a kit of rooms.
- **Phone budget:** a high, wide view draws more of the building at once. It must hold the iPad frame-rate and memory limits the polish rounds fought for.
- **3D combat**, if wanted: club fights currently hand off to the 2D brawler (see Brawler vs dungeon crawler).

**Bright, not dark.** The game's direction (campy comic, saturated pulp color, bold ink) already gives a crawl the readability dark crawlers get from lighting, in a bright register.

## Brawler vs dungeon crawler

My recommendation: build the isometric crawl, and keep the brawler as the fight engine inside it rather than replacing it. The clubs already work this way: a back-room fight drops into the 2D brawler on a painted room while the 3D club waits underneath (`club3d/brawls.js`), and the result is handed back.

| | Upgrade the side brawler | Build the isometric crawl |
| --- | --- | --- |
| What it fixes | Combat depth only | Investigations, exploration and story spaces, in one system |
| Starting point | Built: combos, heat vision, freeze breath, captives, baked 3D-model sprites, generated streets plus painted façades | Mostly built: `ClubZone` cutaway buildings, high camera, asylum generator, guards, investigation layer |
| Uses the game's strengths (X-ray, cases, captures, temptations) | Partly; fights, captives, loss = capture | Fully; every zone system already plugs in |
| Fit with the comic look | Strong; Streets of Rage / TMNT staging, critics keep the brawler sprites | Strong; `look3d.js` already gives zones ink and halftone |
| Market | Crowded, very high bar (Streets of Rage 4, Shredder's Revenge) | Bright comic crawlers are rare |
| Main cost | Animation and enemy variety for real depth | New layouts per space, a fixed camera mode, phone performance |
| Session length | 1–3 min quick hit | Longer; needs short single-floor runs |
| Main risk | Feels shallow next to dedicated brawlers | Wide views blow the iPad budget |

**Why the crawl wins.** It is cheaper than it looked: the engine exists, and the crawl gives investigations the 3D upgrade you already want.

**Why the brawler stays.** It is the quick dopamine hit, the fight engine the clubs borrow, and a lost street fight already counts as a capture, so it feeds the humiliation loop. Improve it on its own track; don't fold it into the crawl decision.

**Suggested order, after core systems:**

1. A fixed high camera preset in an existing zone (the asylum is the obvious test). Judge the feel on the iPad.
2. One new investigation space as a crawl (museum, fun house or prison).
3. Brawler fights inside crawl rooms, the same hand-off the clubs use.
4. Only if that feels thin: real 3D combat in the crawl.

Each step is useful on its own, so stopping early wastes nothing.

## 3D investigation spaces

Turning the point-and-click investigations into explorable spaces is the upgrade most worth doing. The asylum already proves the pattern: a generated 3D building running the full night-case investigation. Each new space needs one signature twist so it plays differently, not just looks different.

| Space | Premise | Signature twist |
| --- | --- | --- |
| Giant museum | After-hours theft; an exhibit was swapped | X-ray display cases to spot the forgery; laser-grid guards; photograph the evidence for the paper |
| Fun house | A villain's front; a witness is hiding inside | Mirrors and false walls; temptation stalls; getting caught means being trapped in a mirror maze |
| Prison | A transfer went wrong; a guard is on the take | Patrol cones to avoid; cells as captive rooms; getting caught means a cell, like the asylum's sedation |

**How it connects to what exists:**

- Each space is a `ClubZone`-style generated building plus the `nightcase.js` investigation layer, the way the asylum is built.
- The 13 painted rooms don't go to waste: one can be the establishing shot before you enter, or a set-piece room inside the space.
- Every failure state reuses the capture and humiliation systems (see Failure as story).
- The 3D clubs stay as they are; they already work.
- Camera: the new fixed high mode, or the existing follow cam. See open questions.

## Combat today and where it could go

Combat is already part of Not So Super; the open question is only whether it also needs a 3D form.

**What exists**

- The side brawler (`brawler.js`): jab/cross/kick combos, heat vision, freeze breath, captives to free, crooks drawn from rigged 3D models baked to inked sprites.
- Club back-room fights reuse it (restroom, dark room under strobe, alley).
- Losing a street fight counts as a capture; losing a club fight is a double loss (reputation plus full capture).
- Rigged 3D enemies already exist for the zones (`enemies.js`, Mixamo skeleton, borrowing her clips), so 3D fighting would not start from zero.

**Content decision, 2026-10-19:** blood is allowed at a basic level, with no time spent making it look great. The story's weight is drugs, hypnosis and a crime spree, not violence. Deeper gore is saved for a future game.

**If 3D combat is ever added to the crawl, it needs:** hit feedback (hit-stop, shake, POW! bursts), a 3D move set beyond her current clips, enemy attack AI on top of the guards' patrol logic, and touch aim assist. All of it within the iPad budget.

## Failure as story: bans and humiliation

Failing should cost the hero access and pride, not just a number. Today: after a capture, the villain's ultimatum offers "B — the embarrassing deal": -8 rep, a mocking tabloid, and a 3:00 lockout from every zone of that type in the city (`st.lockouts[zone.lockKey] = 180` in `main.js` and `club3d/office.js`). The lockout is saved, counts down in play time, and shows in the HUD. Losing or being thrown out does not trigger it yet. The idea is to grow that into a humiliation loop the player feels, and reuse it wherever she fails.

**Escalating club bans**

| Offense | Ban length | What it feels like |
| --- | --- | --- |
| 1st | 5 min | Bouncer laughs her off the door |
| 2nd | 10 min | The crowd recognizes her; mocking lines get personal |
| 3rd and later | 15 min (cap) | Her name is on the door; the club's signage taunts her by name |

Strikes should fall off after a clean stretch (for example one solved case elsewhere), so one bad night doesn't follow her forever.

**Keep the shame, avoid the frustration**

- Bans stay per zone type (the existing `lockKey`), never global. Flight and the rest of the city always stay open.
- Show the timer in the world, not just the HUD: the bouncer, a door sign, a journal entry.
- Offer costly ways back in early: a disguise, a stealth back entrance, a bribe or favor, or a redemption case. Forcing entry could cost reputation and start a tabloid story.
- Pay it off. Villains who mocked her should get a comeuppance moment later; shame works best when revenge is possible.

**Using it beyond the clubs**

| Where | Failure | Consequence |
| --- | --- | --- |
| Clubs | Thrown out or caught by bouncers (not wired to bans yet) | Escalating lockout for that club type, bouncers taunt her at the door |
| Street brawls | Loses a fight (already a capture) | Rematch locked for a while; the winner brags on the LIVE city feed |
| Investigations | Accuses the wrong suspect | The witness clams up for a while; the paper prints the blunder |
| Asylum | Sedated again | The unskippable cell-TV clip runs longer with each repeat |
| City press | Any public failure | Tabloid headlines escalate with her strike count |
| Billboards | Repeat humiliations | Her footage keyed onto the green-screen billboards across a district |
| Recurring villains | Repeated losses to the same villain | They remember and reference it (no system for this yet) |

**Existing systems it plugs into:** `state.js` lockouts (timer, save, HUD), the ultimatum in `main.js` and `club3d/office.js`, `newspaper.js` tabloids, the green-screen compositor (`greenscreen.js`) with the humiliation billboards, the capture scene (`captured.js`), the asylum's sedation sequence, and the LIVE city-feed video panel.

**Questions for this mechanic**

- [ ] Real-time minutes or in-game time? Real time hits harder; in-game time is kinder to short sessions.
- [ ] Does a ban keep counting while the game is closed?
- [ ] Is 15 minutes the cap, or can repeat offenders be banned for a whole in-game night?
- [ ] Is the humiliation played for dark comedy or for genuine shame?

## Art pipeline

The pipeline is already mature and deliberately mobile-first: mostly procedural and painted, plus a few slimmed 3D models. The upgrade is not a new shader layer (it exists) or a big kit purchase (the phone budget rules that out). It is more painted and generated 2D art, a few targeted models, and working through the critics' list.

**Where it stands today**

- **Direction** (`docs/polish/BRIEF.md`): bold ink outlines, halftone, POW! bursts, yellow narrator captions, saturated pulp color. Primary bar: LEGO Batman: Beyond Gotham on mobile; style references Arkham, TMNT: Shredder's Revenge, Streets of Rage 4, Telltale Batman, Marvel Snap.
- **3D style layer: built.** `look3d.js` gives every zone cel shading, halftone in shade, ink-hull outlines, ink edges and a panel vignette, with no post-processing.
- **City: procedural.** `city3d.js` with shader façades, a roof atlas, a far skyline ring and a 3-band key light.
- **Painted 2D sets in use:** 13 investigation rooms, 20 brawl façades, green-screen humiliation billboards, asylum TV stills (`docs/polish/ASSETS.md`).
- **3D models:** `supergirl.glb` through the Blender pipeline (`tools/supergirl/`), enemies through `tools/export_enemy.py`, baked to inked sprites for the 2D modes.
- **Budgets:** phone-first (844x390 touch), iPad memory and WebGL-context limits, new files under ~500 KB, no new runtime dependencies, small fps cost per round.

**How the look is made.** Three layers: shapes (models or code-built geometry), surface (flat colors plus ink-style textures), and the style layer that inks and halftones everything automatically. Because the style layer already exists here, plain code-built rooms already look comic; new assets mainly need to stay small and on-palette.

**Build, buy or generate**

| Kind of asset | Examples | Best route here |
| --- | --- | --- |
| Simple geometry | Walls, floors, corridors, crates, cells, display cases | Build in code, the way `clubgeo.js`, `rooms3d.js` and the asylum already do |
| Complex objects | Cars, furniture, statues, machines | Download small stylized CC0 models (Kenney, Quaternius), slimmed and recolored through the Blender tools; paid kits like Synty only if they slim under budget |
| Unique story props | Museum exhibits, clue objects | AI-generated 3D (blender-mcp `generate_3d`), then slimmed |
| Backdrops and establishing shots | Investigation rooms, brawl façades | AI-generated paintings as WebP, matching the existing painted sets |
| Signs, posters, grime | Billboards, posters, floor and wall hatching | AI images as small WebP tiles; video through the green-screen compositor |

No hand-modeling is required from you.

**What you provide**

- [ ] Decide whether paid kits are on the table at all, given the size budget
- [ ] Downloads and purchases dropped into the project (Claude can't buy or download marketplace files)
- [ ] Blender sessions on your machine; cloud sessions can't run Blender
- [ ] Generated paintings and tiles from Claude-written prompts
- [ ] iPad tests and taste calls against the references

**First art test:** one crawl room set (for example a museum gallery) built in code with two or three downloaded or generated props, checked with the screenshot harness and on the iPad.

**Art decisions still open:** the photoreal asylum and office packs clash with the comic look and some show a trademarked shield (already flagged in `ASSETS.md`); decide before using them.

## Style references

The Grok restyles of five existing game screenshots, judged against the game's own direction (bold ink, halftone, saturated pulp color) and the round 10 critics' note that districts need 3–4 muted hues plus one accent, with vice districts keeping their neon. The ink and halftone are close in all five; what separates them is how much color competes.

The images are local-only in `docs/references/grok_restyles/` (that folder is git-ignored, like the other reference screenshots).

| # | Shot | Fit | Why |
| --- | --- | --- | --- |
| 1 | City intersection | Strong for linework, too busy | The most comic-page city of the set, from a flight-like angle, with pulp color. But red brick, yellow taxis, blue police cars and green containers all compete: the "candy" problem the critics flagged. |
| 2 | Police station, isometric cutaway | Best for the crawl | Cutaway walls, bright and readable, accents only on posters and the item you can pick up. Effectively a mockup of a crawl room. |
| 3 | Street with van | Mixed (dropped) | Lovely halftone and grass hatching, but random accents that tell the player nothing. |
| 4 | Military checkpoint | Strong for vice districts at night | One neon family (magenta billboards) over a muted base, signal-green markers on interactables. Darker and more muted than the game's pulp direction. |
| 5 | Warm interior with dialogue | Strong for UI | The ink-framed dialogue box and comic portrait suit the game's dialogs and portraits; the warm wash shows how one hue can set a room's mood. |

**Takeaways**

- Pulp color works when each district or room commits to a small palette plus one accent; shots 2 and 4 read better than 1 for that reason alone.
- The cutaway crawl works visually; shot 2 is close to a proof of concept for a ClubZone room from a high camera.
- Bright beats dark: 2 keeps atmosphere without heavy blacks; 4 shows how quickly it slides toward the dark-crawler look.

**Reality check.** These are AI repaints of finished games. The game's real-time look already supplies outlines, flat bands and halftone; what it would not produce is the hand-inked grime (wood hatching, asphalt stains). In 2D modes the painted sets already carry that; in 3D it would come from small tile textures.

**Reference images** (in table order)

![1 — City intersection](../references/grok_restyles/1_city_intersection.jpg)

![2 — Police station, isometric cutaway](../references/grok_restyles/2_police_station_cutaway.jpg)

![3 — Street with van](../references/grok_restyles/3_street_with_van.jpg)

![4 — Military checkpoint](../references/grok_restyles/4_military_checkpoint.jpg)

![5 — Warm interior with dialogue](../references/grok_restyles/5_warm_interior_dialogue.jpg)

## North star

Working target: image 2 for crawl rooms, and for the city image 1's linework held to image 4's color restraint. This is provisional: the set is a first batch of saved favorites, and more examples are coming. The final north star should be a restyle of the game's own flight view.

The game already has a curated reference library (`docs/references/`: flying, premade3d, selfbuilt3d, brawler, investigation, nightlife, comicstyle) and a primary bar (LEGO Batman: Beyond Gotham on mobile). These Grok shots add something that library lacks: other games repainted in our own look.

**Current set: one reference per job** (image 3 dropped as mixed)

| Role | Image | Take from it | Leave behind |
| --- | --- | --- | --- |
| Crawl rooms | 2: Police station cutaway | Cutaway walls, brightness, accents only where they mean something | Nothing major |
| City linework | 1: City intersection | Building ink work (fire escapes, brick, window frames), pulp color | The clutter of competing colors |
| City color | 4: Military checkpoint | A muted base with one neon family per district; markers on interactables | The heavy blacks |
| UI and dialogue | 5: Warm interior | Ink-framed dialogue box, comic portrait, one hue setting a room's mood | The painted environment, which is illustration rather than real-time shading |

**Caveats**

- None of these show the main loop. Flight is the strongest system, and every reference is a top-down view of another game.
- They are AI repaints of finished games: a direction, not a guaranteed real-time result.

**Next renders** (Claude can capture these with the screenshot harness, `node tools/shots/shoot.js <area>`, and the hero lab; you run them through Grok)

- [ ] Supergirl flying over the city at night. Most important: it tests our camera, city and loop.
- [ ] The same flight shot by day.
- [ ] A 3D club interior.
- [ ] A close-up of Supergirl.
- [ ] The asylum from a high camera angle: a preview of the crawl.

**How to render them**

- Use the same prompt every time and change only the Mood line, so differences come from the scene.
- Generate 3–4 versions per shot and keep the best.

**Restyle prompt (Grok image edit)**

```
Redraw this game screenshot as a campy 60s/80s superhero comic book page.
Keep the exact same camera angle, composition, buildings, characters and
layout. Change only the rendering style. Do not add, remove or move any
objects.

Style:
- Bold black ink outlines on every shape and silhouette; flat comic
  coloring with only 2-3 tone bands per surface; no realistic textures.
- Visible halftone dots in the shadows, like printed comic paper.
- Saturated pulp colors, but disciplined: each area uses 3-4 related hues
  plus one bright accent. No rainbow of competing colors.
- Bright, graphic and readable, with a polished mobile-game finish.
  Not gritty and not photorealistic.

Mood: [NIGHT] glowing neon signs with bloom, warm lit windows, deep blue
sky, colored light pooling on the streets.
```

Day variant, replacing the Mood line:

```
Mood: [DAY] bright sunny comic page, crisp ink, strong halftone, clean
sky, neon signs unlit.
```

## Open questions

- [ ] Camera for 3D investigation spaces: a new fixed high (isometric-style) mode, or the existing follow cam?
- [ ] Does Supergirl fly inside crawl spaces (low hover, short bursts), or walk only?
- [ ] Crawl fights: keep handing off to the 2D brawler like the clubs do, or eventually build 3D combat?
- [ ] Which investigation space to prototype first: museum, fun house or prison?
- [ ] Should being thrown out of a club trigger a lockout, not only the ultimatum's embarrassing deal?
- [ ] Ban timing: keep 3:00 as the first step and escalate, or start at 5:00?
- [ ] Are paid 3D kits worth it under the ~500 KB-per-file and iPad memory budgets?
