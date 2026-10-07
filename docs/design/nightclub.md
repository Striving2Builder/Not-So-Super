# Nightclub v3: 3D infiltration clubs (design, not built)

Status: design agreed with the user over five brainstorm rounds, 2026-10-07. No code yet.
Supersedes the 2D detective clubs ([nightclub-2d.md](nightclub-2d.md), built in `src/nightclub/`,
still the default until v3 reaches parity). Art specs per batch: [nightclub-assets.md](nightclub-assets.md).

## Why the change
- The 2D side-scroll walk (v2) has the right vibe but no game loop and no danger, and every visit
  plays the same. The user's playtest (2026-10-05): "vibe right, gameplay off"; the reference is a
  **007 club infiltration**, not walk-and-search.
- The Resident Evil / FF7 fixed-camera plan was rejected after the user generated the angles: it
  looks good once, it doesn't fix the loop, and it goes stale on repeat. **Replay value is the bar.**
- The Warehouse missions (`special3d.js`) already have the 007 loop working on mobile: guards with
  vision cones, an alert meter, an informant, a keycard + security door, evidence, captives, a boss,
  capture, X-ray. v3 builds the club on that toolkit and adds what's club-specific.

## The pitch
Super Squirt, a drug cut with something Kryptonian, is spreading through the city's clubs, and it
works on *her*. Supergirl infiltrates a packed club: she pushes through a dancing crowd, listens in
on conversations, takes (or dodges) drinks that open doors, bluffs her way past a VIP host,
blackmails the owner and fights in the back rooms. Every slip is recorded: polaroids and clips of
her that the owner will use against her. Getting intoxicated is a tool and a risk, never just a
fail state.

## Pillars
1. **A big room with lots going on.** The main floor feels huge and packed: a DJ video wall,
   screens, beams, haze, hundreds of dancers, NPCs talking.
2. **Danger fits the room.** Cones and rings on the floor (sedation), a quiz at VIP (the dance),
   blackmail in the office (humiliation), fists in the back rooms (brawls).
3. **Intoxication is a key, not just a penalty.** Some clues can only be had dosed.
4. **The story is told through video.** Green-screen walls, CCTV, sedation and humiliation clips,
   the LIVE feed (see the standing rule: never shrink or hide them).
5. **Every visit plays differently.** Main-room variation × palette × DJ loop × side-room shuffle ×
   case × per-visit event.

## What we reuse
| Need | Existing code | Change |
|---|---|---|
| Mission loop, guards, alert, energy, X-ray, items, capture | `special3d.js`, `guards3d.js` | new club floor plan; Talkers, bubbles, events added |
| 3D club decor: LED wall, DJ booth, truss, mirror ball, lasers | `nightlife.js`, `nlclub.js`, `nlkit.js`, `nlroom.js` | scale up to the big hall; LED wall → video wall |
| Crowd, posed to the beat, instanced (6 draw calls) | `nlcrowd.js` | silhouette shading + rim; density map; parting/bumps |
| Silhouette dancer sheet | `nightclub/crowd.js`, `assets/nightclub/dancers.png` | far crowd as billboards behind the 3D crowd |
| Comic look (cel, ink, rim) | `look3d.js` | none |
| Green-screen keying of video into a painted still | `greenscreen.js` | a 3D path: key into a texture on a wall plane |
| Full-screen clips (sedation, humiliation) | `cutscene.js` (`playCutscene`) | new folders |
| Speech bubbles, reputation-aware lines | `comic.js`, `commentary.js` | crowd chatter lines per case |
| Close-ups (tap the spots) + art | `investigate.js`, `nightclub/scenes.js` | new close-up kinds (below) |
| Cases as data, case board, accusation, map leads | `nightclub/case.js`, `nightclub/cases/squirt.js`, `caseboard.js` | add rumours, VIP answers, the boss's script |
| Intoxication screen effects | `nightclub/intox.js` | run as a pass over the 3D view |
| Blackout → polaroids of her, `state.photosLost` | `nightclub/nightclub.js`, `state.js` | becomes the envelope (below) |
| Public humiliation: ultimatum + tabloid newspaper | `main.js` (`ultimatum`, `showNewspaper`) | triggered from the office |
| Side-scroll fights | `brawler.js`, `brawlstage.js` | a "club interior" style: restroom, dark room |
| Super-hearing (rings while perched) | `overworld.js` | the same rings, in the club |

Routing: `modeFor()` in `main.js` already sends club zones to the new mode behind a flag
(`NEW_CLUBS`); v3 gets its own flag the same way and stays opt-in until it reaches parity.

## Camera and controls
- **Follow camera** at a fixed angle that never rotates and always looks toward the back (video)
  wall, so the green screen is always in frame. In the crowd it drops lower and closer behind her
  (bodies fill the frame, like the reference frames); in open space it pulls up and out so the room
  reads big and guards can be tracked.
- **Joystick** to walk (decided 2026-10-05). The stick is turned off while a close-up, quiz or
  numpad is open (the old bug: the stick's touch zone ate taps on the left of the screen).
- **Idle pose:** after ~1.5 s standing still she turns to face the viewer (body + head). The same
  pose is the "posing" action in the paparazzi event.
- Buttons: X-RAY, HEARING, DANCE, USE/TALK (context), CASE (the board).

## The club layout
- **The main room** in the middle, entrance at the front (camera side), the DJ video wall at the
  back. Side rooms open off the **left and right walls, at most 3 per side**. Some side rooms
  lead on to a further room (office → safe room, restroom → alley).
- Room kinds: entrance + coat check, **main room**, bar (in the main room or a side room),
  **VIP**, **back office**, **restroom**, **dark room**, storage, **alley** (outside), stairs to a
  mezzanine (variation 2).
- **Special rooms:** back office (blackmail), VIP (quiz + dance), restroom / dark room / alley
  (brawls). The rest are search-and-sneak rooms with one green-screen wall each.
- **Accessibility rule (kept from v2):** every room reachable from the entrance, every lock has a
  way in that doesn't need that lock (a key, a code from a rumour, a power), every door works both
  ways. The layout check in `nightclub/layout.js` (`checkClub`) is reused on the new graph.
- Sizes: the main room is ~60×40 m (the Warehouse hall is 30×24). Side rooms 8–15 m.

## The main room: 5 variations
Code-built presets (the Warehouse is built in code, not Blender: light on memory, mixable by seed).
Each one plays differently, not just looks different:

| # | Name | Layout | What it does to play |
|---|---|---|---|
| 1 | **Warehouse Rave** | long hall, DJ video wall at the back, bar along one side | the baseline: dense centre, bouncers on the edges |
| 2 | **Mezzanine** | a balcony ring above the floor, stairs in two corners | guards look down from above; a balcony door leads to VIP |
| 3 | **The Pit** | a sunken dance floor in the centre, raised walkways round the walls | the pit is safe (crowd cover), the walkways are exposed, but every door is up there |
| 4 | **Centre Stage** | the DJ on an island in the middle, crowd all round, bar on the back wall | no safe side; the back wall shows a "DJ cam" feed |
| 5 | **The Tunnel** | a long, narrow brick railway arch (Berlin techno) | side arches = the doors (3 per side); very dark, so strobes and the drop rule |

**Per visit:** variation + colour palette + DJ loop + screen content + which side room sits behind
which door + the case + one event (below). Two visits to the same variation still play differently.
Blender is optional, for mockup renders only.

## The crowd: walking through it
The heart of the main room: crossing it means pushing through the dancers, like the reference frames.
- **Density:** thin by the doors and the bar, packed in the centre between her and the DJ wall.
- **Look:** dark backlit silhouettes with a coloured rim (the DJ wall, haze and beams sit *behind*
  the crowd). Near silhouettes pass between the camera and her (big, dark, out of focus).
- **Pushing through:** the crowd slows her; dancers step or lean aside as she passes; sometimes one
  bumps back: a spilled drink (+intox), a shove, a "watch it!" (+suspicion from anyone watching).
- **Blending (fitting in):** inside a dancer cluster the alert meter drains and vision cones can't
  pick her out. Running, flying or using a power in the crowd breaks it. **DANCE** (hold) blends her
  fully and recharges energy faster.
- **The drop:** about every 45 s the music builds (audible), then the lights cut to strobe for ~5 s
  and the crowd jumps and surges (she gets carried a little). Guards' cones switch off during the
  strobe: the window to slip through a staff door.
- Tech: the 3D crowd is `nlcrowd.js` instancing (hundreds of patrons in a few draw calls) with a
  silhouette material; the far crowd is billboards from the `dancers.png` sheet.

## Crowd chatter
Dancers near her get short comic bubbles (`comic.js`), a few at a time, never cluttered:
1. **Atmosphere:** "This DJ is insane!", "Is that… Supergirl?" Tone follows her reputation tier
   (`commentary.js`): fans, sceptics, hecklers.
2. **Rumours (gameplay):** fragments of the case, e.g. "…the green stuff hits harder than molly…",
   "K's guys only go in after the drop." **Tap a rumour to save it** to the case notes. Rumours are
   the answers to the VIP quiz and cards for the office. A pool per case and visit.
3. **State reactions:** "She's wasted!" (intoxicated), cheers (dancing), "Someone get security…"
   (high alert).
4. **Offers:** "Want a hit?", "Shot for the hero?" Tap to accept (an intoxication path) or walk on
   (refusing rudely is a small suspicion bump).

**Recognition:** in costume, people recognise her: phones come up, a small crowd gathers, and alert
rises because she draws attention. Undercover (below) avoids it.

## NPCs
| NPC | Where | Threat shape | Role |
|---|---|---|---|
| **Bouncer / guard** | everywhere, staff doors | vision cone (existing) | alert → sedation on the floor, a fight in the back rooms |
| **Talker** (new) | main room, bar, lounge corners | **a ring** on the floor | eavesdrop for evidence (below) |
| **Offerer** | crowd, bar | none | offers drinks/drugs (intoxication paths) |
| **Bartender** | bar | none | the house special: accept and they talk |
| **Predator** | crowd | hidden | a spiked drink: X-ray spots it (evidence), or it's a trap |
| **VIP host** (new) | VIP couch | the quiz | a lieutenant of "K"; gatekeeper of VIP evidence |
| **The boss** | back office | the blackmail | the club owner; confession or humiliation |
| **Courier / dealer** | restroom, alley | a fight | carries the bag (evidence) |
| **Photographers** | events | camera cones | the paparazzi event (inverted stealth) |

### The Talker (eavesdrop ring)
- A ring on the floor instead of a cone. Inside it, an **evidence bar** fills; a **suspicion bar**
  fills behind it. Evidence full first: a clue (and often a rumour for the quiz). Suspicion full
  first: they notice, and she's sedated (below).
- Dancing inside the ring slows suspicion. Super-hearing lets her listen from just outside the ring
  (costs energy). Intoxicated: suspicion rises more slowly (she fits in), but what she hears comes
  through scrambled.
- Using a power inside the ring (glowing eyes, sound rings) spikes suspicion.

## Meters
- **Alert** (existing, `special3d.js`): guards' sight; drains in the crowd. 100 → caught.
- **Suspicion** (per Talker, and the VIP host's): fills while she lingers; full → found out.
- **Energy** (existing X-ray bar, now shared by X-ray and hearing): refills slowly, faster in the
  crowd or dancing.
- **Intoxication** (`state.intox`, 0–100): tiers from `nightclub/intox.js` (light 20, medium 45,
  heavy 75); 100 → blackout/sedation.
- **The envelope** (new, the boss's leverage): cards of her worst moments this visit (below).

## Powers
**X-ray vision** (existing button, new uses):
- through walls: who's in a side room before she enters (guards, the boss, a deal);
- into the crowd: who's carrying (pills, cash, a weapon), which is how she finds the dealer;
- spiked drinks: the powder in a glass before she accepts it;
- hidden stashes (wall panels, speaker stacks), the office safe, containers and traps (the existing
  hints carry over).

**Super-hearing** (new in the club):
- the music muffles and the chatter becomes readable; **whispered rumours** appear only while it's on
  (the better clues);
- a Talker's conversation from outside the ring; the boss through the office door; the safe's dial;
- guard radios ("shift change in 30"), so she knows when a door is left alone;
- the overworld's pulsing sound rings as its visual.

**Rules:** one shared energy bar. Intoxicated, X-ray flickers and shows false things and hearing
scrambles words (the drug is part Kryptonian). Super-hearing during the drop stuns her (ringing
ears, 1–2 s). Visible powers raise suspicion in a ring or a cone.

## Intoxication paths
Some are optional shortcuts; some are the **only** way to a clue (marked).

| Source | Effect | Pays off |
|---|---|---|
| Bartender's house special | +intox | the bartender talks: a clue |
| DJ's vial (exists in v2) | **drug-vision** for a while | **required:** UV graffiti / a door code only visible dosed |
| Shot-off with a gangster (timing tap) | win: a little intox; lose: heavy | win: he spills a lead |
| Pill passed on the dance floor | +intox | alert reset to 0 at once |
| Restroom powder | +intox, X-ray boosted | blackout risk |
| Spiked drink (predator) | heavy, unless spotted | spotted with X-ray: evidence |
| VIP host's drinks | +intox | she looks like she belongs (less quiz suspicion), but the answers scramble |
| Bumped drink in the crowd | small +intox | none |

Intoxication is double-edged: it helps her blend (alert drains faster, Talkers suspect less) but
blurs powers, scrambles text, sways the controls when heavy, and every dosed moment can become a
card in the envelope.

## Close-ups (fewer, more varied)
The existing tap-the-spots system and its art (`investigate.js`, `nightclub/scenes.js`: bar,
coat check, DJ, office, restroom, VIP). New kinds get more out of the same art:
- **Search:** tap the spots (existing).
- **Read:** a note, a ledger, a guest list, zoomed.
- **Phone:** scroll someone's messages (drawn in code, no art).
- **Photo:** frame a deal through a gap and snap it (the daytime crime scene's viewfinder +
  polaroid, `lensfx.js`).
- **Drug-vision:** any close-up with a UV layer that only shows while she's dosed.

## Special room: VIP (the quiz and the dance)
- **The host** lounges on the VIP couch with an entourage of silhouettes: a lieutenant of "K",
  different per case (a pool of hosts). He never stands up; the room is his game: "Prove you belong."
- **The quiz:** answers picked **in order**, e.g. "Who sent you?", "What's the word tonight?",
  "What came in on Tuesday?" The answers come from rumours, Talkers and notes in the main room.
  He keeps offering drinks during it (see the intoxication table).
- **Success:** he hands over the evidence or brags his way into the next lead.
- **Fail → "Dance for me."** The dance is a mini-game **and** a video:
  - a **3×3 numpad next to the dance clip, never on top of it**: both are fully visible with no
    overlap. Landscape: the clip on the left (~60% of the width, uncropped 16:9), the numpad in
    its own panel on the right. Portrait: the clip on top, the numpad below. The numpad's panel is
    solid (not transparent) and sized for thumbs (cells ≥ 64 px); nothing (HUD, captions, the
    joystick) covers either one while it's open;
  - cells light on the beat (124 BPM) and she taps the lit one, like a CNS tap test; it speeds up;
  - **the clip plays only while taps are right**; a miss freezes it (record-scratch): the penalty is
    time and the host's patience;
  - **someone snaps a polaroid** (a card for the envelope); a clean run may earn a second quiz try,
    a messy one a second polaroid.
- Waking up sedated is most likely here (below): on the couch next to him, quiz started at a
  disadvantage.

## Special room: the back office (the blackmail)
- She goes in to blackmail the boss; he has been collecting on her all night. **His envelope is
  built from what actually happened this visit:** the pill she took, how drunk she got, the VIP
  dance, being sedated and dragged off, fans filming her in costume, polaroids left behind
  (`state.photosLost`).
- **The exchange:** he lays a polaroid on the desk; she answers with an evidence card. The right
  card in the right order, on time: he folds and confesses (the supplier, the drop, the next lead).
- **A wrong call:** he plays his best card and releases it. This goes to the existing **ultimatum**
  (`main.js`): take the public humiliation (the polaroids hit the tabloid front page via
  `showNewspaper`, the clip plays on the **LIVE feed and the billboards**, reputation drops) or take
  an embarrassing deal (smaller hit, a task, a lockout).
- **Steal his leverage first:** X-ray finds the safe behind a painting, super-hearing picks up the
  combination when he opens it; empty it and his envelope is thin. Wipe the CCTV recorder and the
  dance clip is gone too.
- **CCTV:** the office's monitor wall shows live low-res views of other rooms (guard positions, the
  dealer) and **recordings of her**: the VIP dance clip plays on one screen. During the confrontation
  his monitor plays the clip he's about to leak.

## Brawls (the side-scroll brawler, a "club interior" style)
- **Restroom: close quarters.** She walks in on a deal in a stall: the dealer, his muscle, maybe a
  Talker who has worked out who she is. One screen; kick in stall doors, throw people into mirrors
  and sinks; the mirror wall plays a hallucination clip if she's dosed. Backdrop: the batch 3
  restroom images.
- **Dark room: strobe fight.** Enemies show only in the flashes. X-ray shows them in the dark,
  super-hearing picks up footsteps between flashes; the drop makes it chaos.
- **Alley: the street fight** with the `assets/brawl/backdrops/rld-alley-*` backdrops; the courier
  makes his run here. Winning: the courier's bag.
- **Rule:** in these three rooms, getting caught starts a fight instead of sedation.
- **Losing a brawl is a double loss** (everywhere, street fights too): the existing lose penalty
  (−8 reputation, the crooks get away) **and** she's captured (the forced clip above, then the
  capture flow). Today a loss only ends the zone (`brawler.js`, `outcome: 'lose'`).
- Work: the brawler is built around district streets; it needs a club-interior style (props, room
  width, strobe lighting) and a way back into the club where she left.

## Sedation (hybrid)
1. Caught on the floor, by a Talker, or in VIP: a **sedation clip** plays full screen
   (`playCutscene`, the same as the asylum syringe), with the intox screen effects.
2. She **wakes elsewhere in the club**, weighted: **VIP most likely** (on the couch beside the
   host, a polaroid already taken), the office (tied to a chair while the boss decides), storage
   (locked in: X-ray or strength, which is loud), a dark corner of the main floor (groggy, +intox).
   Each wake spot starts its own short situation.
3. Every sedation adds a card to the envelope.
4. **The third sedation** in one visit goes to the full existing capture/asylum flow.

## Full capture: the forced clip
When she is fully captured (the third sedation, a lost brawl, or anything else that ends in the
`captured` outcome), the capture clip plays full screen and **loops at least 3 times**:
- the **first tap turns the sound on** (as `playCutscene` does today);
- after that, **3 more taps skip it** (a small "tap 2 more to skip" counter); a single stray tap
  never ends it;
- with no skip, it ends after the third loop and the capture/asylum flow carries on.
Today `playCutscene` ends on the second tap and `maxSecs` cuts clips at 12 s; this needs a
`loops` + `skipTaps` option. It applies game-wide, not just in the club.

## Events per visit
One per visit (some visits none), picked by the case and the seed. **The drop** happens every visit.
- **Red carpet:** a press line at the entrance, VIP packed, a celebrity guest (a witness or the
  target); more people, more cameras, so undercover matters.
- **Paparazzi: the celebrity is Supergirl.** The stealth rule flips: the cones are photographers'
  cameras and she has to **stay in the shots** for X seconds in total while moving through the crowd.
  The idle pose (looking at the viewer) fills the meter faster. Intoxicated, the photos come out
  sloppy and go to the tabloids instead of helping her reputation.
- **Police raid** (the crowd stampedes, staff doors open), **fire alarm** (the club empties; a
  timer), **a fight breaks out** (bouncers pulled away from their doors).

## Undercover
She can arrive as **Kara** in plain clothes: nobody recognises her (no recognition alert, better
blending), but **no powers** until she changes in the restroom (the phone-booth moment). If anyone
sees her change, her cover is blown at once.

## The exit
With the evidence in hand she has to get out: push back through the crowd under alert, or fly out
through a skylight (it's Supergirl). Then the case board / accusation and the map leads (v2's case
loop).

## Green-screen walls (used smartly)
- **One live video per room**; stills everywhere else (iPad memory).
- **Green walls only on walls that face the camera**, so the projected image never looks wrong.
- **A content pool per room kind**, picked per visit: rooms change without new geometry.

| Room | Green screen | Content |
|---|---|---|
| Main room | the DJ wall (back) + 2–3 TVs | DJ loops (`assets/nightclub/incoming/batch1/grok-video-*.mp4`, `set_main.mp4`); story clips on the TVs |
| Alley | the far wall: the street beyond | `assets/brawl/backdrops/rld-alley-01..10`, batch 3 `alley_01..10` |
| VIP | a window | night skyline stills |
| Office | the CCTV monitors | live room views + her recorded clips |
| Restroom | the mirror | a hallucination clip when dosed |
| Storage | an open loading dock | docks / pier images |

The DJ wall is `nlclub.js`'s LED wall turned into a video plane. `greenscreen.js` keys and warps
video into a painted still in 2D; v3 needs the same keying into a 3D wall texture.

## Cases
Cases stay data (`src/nightclub/cases/*.js`, engine `case.js`). Each case now also defines: its
rumour pool, Talker conversations, the VIP host + quiz answers, the boss's script and confession,
which intoxication paths are required, the brawl rooms used, and allowed events. Super Squirt is
first; the blackmail case is next. The accusation, case board and map leads carry over.

## Budget (HTML5 on an iPad)
- One WebGL context for the club (as Special3D today); 60 fps target, measured on the iPad.
- The crowd instanced (`nlcrowd.js`) + the billboard far crowd; at most one playing video per room
  (muted, inline, as the LIVE feed); textures freed when leaving a room's wing.
- The big main room is the risk: the first build step measures it.

## Assets needed from the user
- **Dance clips** for the VIP dance (the user is sending them; the `SG_RLD_Game` clips are the
  closest existing footage).
- **A sedation clip** (until then, an asylum or captured clip as a stand-in).
- **Humiliation clips / polaroid stills** for the leak (the LIVE feed + billboards + newspaper).
- More DJ loops, TV story clips, the VIP host and boss portraits, club music (own tracks).
- Batch 4 (fixed-camera angles) is dropped; those images can serve as close-ups or wall stills.

## Build order
1. **Main-room test (one variation, measured on the iPad):** the big hall, the DJ video wall, the
   silhouette crowd at full density, walking through it with the follow camera, beams + haze, the
   drop. Check fps, memory, and whether it reads as the reference frames. Go/no-go for the rest.
2. **The loop on the floor:** bouncers + alert + blending + DANCE, Talkers, crowd chatter and
   rumours, X-ray + hearing, the intoxication paths, sedation + wake points.
3. **Special rooms:** VIP (quiz + numpad dance), the back office (envelope, blackmail, CCTV,
   humiliation via the ultimatum).
4. **Brawls:** the club-interior style for the brawler; restroom, dark room, alley.
5. **Variety:** the other 4 main-room variations, side-room shuffle, events (red carpet, paparazzi,
   raid, fire alarm, fight), undercover.
6. **Cases:** port Super Squirt to v3, write the blackmail case.
7. **Replace v2** once v3 reaches parity (v2 stays behind a flag until then).

## Decisions (user, 2026-10-07)
- 3D clubs built like the Warehouse missions, with green-screen walls; the RE/FF7 plan is dropped.
- Main room much bigger than the Warehouse; walk through a dense crowd; NPCs talk as she passes.
- Alert drops near the silhouettes (fitting in). A new ring-shaped NPC (Talker): evidence if she
  stays, sedation if she stays too long.
- More drinks/drugs; some required for clues. Side rooms on the main room's sides, ≤3 per side.
- Back office blackmail; a wrong call → her polaroids/videos released to the public.
- VIP: a bad-guy host on the couch runs an ordered-answer quiz; fail → she dances (numpad + video,
  side by side: both clearly visible, no overlap).
- Brawls in the restroom, the dark room and the alley. X-ray and super-hearing both in.
- Yes: the drop, CCTV (incl. her dance clips), the exit, per-visit events (red carpet, paparazzi
  with Supergirl as the celebrity), undercover.
- Sedation: a clip, then she wakes elsewhere in the club, most likely VIP.
- Follow camera; her idle pose looks at the viewer.
- Full capture: the clip loops ≥3 times; tap 1 = sound, then 3 taps to skip (game-wide).
- Losing any brawl = a double loss: the lose penalty and capture (game-wide).

## Open questions
- Which main-room variations to build first (recommendation: The Pit or Warehouse Rave), and
  whether to make Blender mockup renders first.
- Why Super Squirt works on her (Kryptonian lore).
- The VIP hosts and the boss: names, looks (silhouettes or real models).
- Numpad dance tuning: grid size, speed curve, how many misses end it.
- How long the paparazzi target is; whether undercover is chosen per visit or set by the case.
