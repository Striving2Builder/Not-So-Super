# Nightclub redesign: detective nightclubs (plan, not built)

Status: planning, agreed with the user 2026-10-04. No code yet. The current premade 3D clubs
(`clubzone.js`, `clubgeo.js`) and the guard/flashlight stealth stay as the **fallback** until the new
system reaches parity, then they're retired.

## The pitch
A new drug is spreading through the city's clubs. Supergirl works the clubs as a detective: she walks
the rooms, reads the crowd, taps scenes for clues, talks to informants, and at some point gets dosed.
The drug is the mystery: she should be immune to drugs, so a drug that works on *her* is the threat
(working idea: it's cut with something Kryptonian). Getting intoxicated is part of the story, not a
fail state.

**Premium** = a higher bar for visuals, atmosphere and how rich the cases are (not paid content).

## Look (target: the user's two reference frames, in comic style)
- Dense haze lit from behind, light beams from a lighting rig, laser fans, a bright DJ booth as the
  focal point, the crowd as dark backlit silhouettes. Cool blue/cyan palette with magenta and amber
  accents.
- Comic version: ink outlines on architecture and props, flat cel shading, halftone in shadows,
  silhouettes in solid ink (noir comic: Sin City, Batman TAS). The haze and beams carry the realism;
  the ink carries the identity.
- Characters: **silhouettes** for now (the crowd, informants, suspects). An informant is a silhouette
  with a coloured rim light and a tap marker. Real models can replace any silhouette later without
  changing room design. (Standing decision: real NPC designs wait for the story draft.)

## How it's built: pre-rendered backgrounds + a live foreground
No real-time 3D club. Each room is layers:
1. **Background plate**: a pre-rendered image (or short seamless video loop for set-piece views) with
   the baked volumetric haze, beams and lighting. This is where the quality comes from: offline
   renders can afford real volumetrics that no phone browser can.
2. **Mid layers**: crowd silhouettes in 2–3 depth bands (sway/dance loops), parallax.
3. **Live FX**: a few additive beams and lasers that sweep and pulse to the music, drifting haze
   sheets, strobes, all cheap.
4. **Foreground**: Supergirl (her existing side-view sprite from the brawler), near silhouettes that
   pass in front of the camera (large and dark), pillars and railings as occluders, tap markers.
5. **Post**: one full-screen pass for the intoxication effects (see below).

Why: one image or video plus sprites is far lighter than a 3D club (GPU memory is what crashes the
iPad), and the look comes from offline renders instead of live lighting.

## Movement: hybrid
- **Walk view (side-scroll):** each room is a side-view panorama, 1–4 screens wide depending on its
  size. She walks left/right; the crowd parallaxes past; doors, arches and stairs along the walk lead
  to other rooms (tap to go through). The brawler's side-scroll core (camera dead band, parallax)
  is the starting point; it gets split into a shared module first (brawler.js is ~900 lines, and
  areas may not import each other).
- **Set-piece views (fixed):** big rooms open with an establishing shot. The main floor looking at
  the DJ booth is exactly the user's reference frames. It's a 3–5 s video loop with live beams on top,
  then it cuts to the walk view. It can be revisited from a "look" button.
- **Investigation close-ups:** tapping a hotspot in the walk view opens a close-up scene (bar counter,
  VIP table, DJ decks, a restroom stall): the existing tap-the-spots investigation system
  (`investigate.js`), with new art.

## The club: rooms
Every club is a graph of rooms. Room kinds (size = walk width):

| Room | Size | Notes |
|---|---|---|
| Entrance + coat check | small | arrival from the dive landing; bouncer informant |
| Main dance floor | big (3–4 screens) | the flagship set piece; DJ booth view |
| Dark dance room | big/medium | near-black, strobe only; clues visible only in strobe flashes |
| Bar | medium | bartender informant, spiked-drink scenes |
| Lounge / seating area | medium | booths, overheard conversations |
| VIP balcony | medium | overlooks the main floor (looking down gives a second set-piece view) |
| VIP rooms (several) | small | locked: guest list, wristband, a bribe or a super-power route |
| Restrooms | small | deals happen here |
| Corridors / stairs | connector | short walks; link floors (upstairs VIP, basement) |
| Back office | small | staff only; the club's books |
| Storage / cellar | small | product stash, the lab lead |
| Alley exit / smoking terrace | small | couriers come and go |

**Accessibility rule (hard):** every room is reachable from the entrance. Every lock has a way in
that is itself reachable without that lock: a key or guest list in another reachable room, or a
power (x-ray to read the guest list, super-hearing for the door code). Every door works both ways.
The engine checks this on every generated club (graph search, like `tools/shots/clubreach.js` does
for the 3D clubs today) and rejects layouts that fail. A blackout may *move* her into a room, but
there's always a way back out.

## Flagship + engine (hybrid)
- **Flagship club (hand-made):** a fixed layout with the best art: the main floor, the DJ booth set
  piece, the VIP balcony, and the first case written by hand. This is the quality bar and the first
  thing built.
- **Club engine (generator, after the flagship):** builds more clubs from a **room kit**:
  - each room kind has several pre-rendered plates (variants), all made to the same plate rules
    (below), so they snap together;
  - a layout generator picks the rooms, connects them into a graph (a tree plus a few loops), assigns
    floors (basement / ground / upstairs) and checks accessibility;
  - each club gets its own palette grade (colour shift of plates + light colours), signage, music,
    crowd density and DJ, so reused plates read as a different venue;
  - a **case generator** places the case (below) into the rooms.
- The flagship's extra rooms can come from the kit too: the main floor is hand-made, the side rooms
  are kit plates. That's the fastest path to a full club and it tests the kit early.
- Replay value comes from new layouts, a different culprit and clue placement per run, and night
  events (raids, a VIP party, a power cut that kills the lights).

## Cases (the drug storyline)
- **Case template:** a chain of roles: street dealer → courier → supplier → the lab. Each club case
  uncovers one link; the flight map's incidents point to the next venue.
- **Per case:** a culprit among 3–5 suspects (silhouettes with one distinct visual tell: hat, coat
  colour, a glowing wristband), 6–10 clues, 1–2 red herrings, informants with short dialogue in the
  game's caption style, and a deduction step on the existing case board (`casefile.js`, `leads.js`).
- **Clue types:** physical (tap a hotspot), testimony (an informant), power (x-ray through a bag or
  wall; super-hearing to pick one conversation out of the music), timed (the dark room's strobe
  shows it for a flash), **intoxicated** (visible only while she's dosed: some are real, some are
  hallucinations, and part of the deduction is telling them apart).
- **The end:** confront the culprit. That's a choice of brawl (the brawler engine, on hold for now),
  arrest, or follow them out the alley to the next lead.

## Intoxication and the blackout (the premium sedative loop)
- **Meter 0–100.** Sources: accepting a drink (a choice, sometimes the only way to get an informant
  to talk), a spiked drink you didn't spot, a dealer's "free sample", the haze in a VIP room.
- **Tiers:** light (colour bloom, beams smear), medium (doubled ink lines, the frame tilts like a
  comic panel, sound muffles, hallucinated hotspots appear), heavy (the room warps, silhouettes turn
  toward her, controls drift).
- **Blackout at 100:** a cinematic sequence (pre-rendered video, comic panels breaking apart), then
  she wakes somewhere else: a VIP back room, the cellar, the dealer's van. Unlike the asylum there's
  no forced 30 s wait: it's a short scene, an escape beat, then **piecing the lost time back
  together** by putting memory-fragment panels in order. Done right, the fragments reveal who dosed
  her. The detective work happens inside the blackout.
- The asylum loop stays as it is; this is its premium cousin, not a replacement.

## Budget (HTML5 on an iPad)
- Target 60 fps on the iPad. One WebGL context (shared, as `offscreen3d.js` does today) or Canvas
  2D; decided in the look test. Per room: ≤ ~40 draw calls, one intoxication post pass.
- **GPU memory:** per room ≤ ~48 MB of textures (plate tiles ≤ 2048 px + one silhouette atlas). The
  previous room is freed on exit: no club-wide memory.
- **Download:** per room ≤ ~3 MB (plate as WebP; video loops 720p H.264 ≤ 2 MB each), streamed on
  room entry behind a short transition. Flagship first load ≤ ~12 MB.
- iOS video: muted, inline, autoplay (as the LIVE feed does); at most one playing video per view.

## Build order
1. **Look test (one room, measured on the iPad):** the main floor set piece (one video loop) + the
   walk view (one plate) + 3 silhouette layers + live beams + the intoxication pass. Check fps,
   worst frame, memory, and whether it reads as "the reference frames, in comic style". Go/no-go for
   everything below.
2. **Flagship:** 6–8 rooms (entrance, main floor, bar, lounge, dark room, VIP balcony + 1 VIP room,
   restrooms, back office), one hand-written case, the intoxication tiers, one blackout sequence.
3. **Room kit + layout generator:** 3+ plates per room kind, the palette grades, the accessibility
   check, a test tool that generates 100 clubs and validates them.
4. **Case generator:** roles, clue placement, red herrings, intoxicated clues.
5. **Replace the premade clubs** once the new ones are at parity; keep the old ones behind a flag
   until then.

## Assets the user produces
The user makes the images, videos and audio with their tools (AI image/video generators, Blender);
the director gives prompts and specs per batch. See [nightclub-assets.md](nightclub-assets.md).

## Open questions
- The drug's name and look (pill, vial, glowing powder, a drink); how it ties to Kryptonian lore.
- Can she refuse every drink, or are some cases only solvable dosed?
- Music: licensed-free loops per club (user-made) or one shared score with per-room filters?
- Age rating: drugs + intoxication + the existing adult venues → likely a mature rating.
