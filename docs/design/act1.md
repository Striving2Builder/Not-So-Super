# Act 1: The Puzzle Maker

Status: built 2026-10-09 (see "Built so far" at the end). **(user)** marks the user's own calls: from
the outline, or from the answers to the drafts. Everything else was a proposal the user accepted.

## The act in one paragraph
Supergirl is the city's hero, saving the day as usual. Then a new drug starts showing up in the
clubs, and it looks like the big story. **(user)** It isn't. The drug is only half of what's going
on. The other half is a crime ring run by **the Puzzle Maker**. His people work out of the
nightclubs, warehouses, the asylum, factories and the entertainment district, and they use the
paparazzi to frame Supergirl. **(user)** The frame-up runs on an impostor in a knockoff costume
**(user)**, with staged photos and leaked tapes, so every Polaroid in the city is a question: her, or
the impostor? Once she has cleaned up enough of the city, every money trail leads to the same address:
the hotel in the Villains' Lair district, the **Slutty Little Red Mini Skirt** **(user)**. Its 13th
floor opens, and she goes in after him.

## What's already in the game, and where it fits
The existing cases already form most of this web. Act 1 mostly connects them. **(user)** Use the
existing villains for now; the user's own henchmen designs are in production separately and will
replace them later.

| Already built | Its role in Act 1 |
|---|---|
| **Super Squirt** (club case): "Lenny launders it, Moe sells it, K ships it" | The first case. It introduces the drug and the name **K** |
| **Halo** (the Hive): "Bianca Rook's drones, **Kell's** batch, Pier 9" | Same drug, a stronger cut. **K = Dr Amos Kell**, Helix Labs, "from kryptonite research" |
| **The Polaroid Racket**: "Flash shoots them, Varga pays" | The first sign of the frame-up machine |
| **The Auction** (Gilded Cage): "Vane sells the tape, Strand buys" | The tape of her is part of the frame |
| **Flashpoint Live**: "Roxy Flash's show, Volk's money" | The paparazzi arm at full power |
| **The Earworm**: "Mesmer runs it, Crane pays" | The drug makes people compliant, and the song keeps them that way |
| The back-office confrontation (`club3d/office.js`) | Where lieutenants are unmasked (below) |
| Polaroid strays + the club owner's safe (`polaroids.js`) | Becomes the Polaroid trail and its mini-game |
| Ravenmoor Asylum, "Illegal Experiments" | Kell tests the drug on patients |
| Factory "Sabotage" / Docks "Smuggling" 2D cases; the Halo leads Pier 9 + Helix Labs | Kell's lab and the shipping |
| Ranks: Local Hero 60, City Guardian 150, **Metro Icon 300** | The act's story beats fire on these rank-ups; 300 is the user's gate |
| Struggle mini-game (`struggle.js`), forced capture clip | Lair traps and the boss-fight capture loop |
| Asylum building generator + orderlies | The lair floor's wings and the scientist who hunts her |
| Gilded Cage ballroom + club crowd | The lair's Grand Ballroom (the boss arena) |
| The red-light district kit (`nlredlight.js`) | Dressing for the lair's neon halls |

**The twist:** the four money men in the confessions (Varga, Strand, Crane, Volk) are all fake names.
Every one of their shell companies is registered to the same address, the hotel. They're all the
Puzzle Maker.

## The cast

**The Puzzle Maker, Act 1 boss.** **(user)** He built the drug ring and the frame-up. He never deals
and never shoots a photo himself; he designs the system and leaves puzzles for her. Calling card: a
jigsaw piece in every cash envelope, on the back of every fake Polaroid, and in every lieutenant's
office. Why he wants her ruined: a city that has stopped trusting its hero stops looking up, and his
business runs on nobody looking. The Riddler model in `assets/Enemy Characters/` can stand in for his
look until his own design lands.

**Dr Amos Kell, the scientist.** The chemist who invented the drug, and the "co-author" of the evil.
**(user)** A partner, not a lieutenant. Inside the hotel he hunts her with a kryptonite stun ray.
**(user)** At the end of Act 1 he's **captured and locked up** **(user)**; Act 2's villain is someone
else.

**The lieutenants.** One henchman storyline each, using the existing villains for now **(user)**:

| Lieutenant | Runs | Base | Unmasked in |
|---|---|---|---|
| **Lenny Gold**, "the Fixer" | The clubs' money and the Polaroid safe | Nightclub district | Super Squirt, then the Polaroid Racket |
| **Bianca Rook**, "Queen Bee" | Street distribution of the drug | The Hive, Pier 9 | Halo |
| **Roxy Flash** | The paparazzi, the live humiliations | Entertainment district | Flashpoint Live |
| **Marcus Vane**, "the Curator" | Selling the tapes and photos | The Gilded Cage | The Auction |
| **Madame Mesmer** | Compliance: keeps the drugged crowd docile | Clubs, radio | The Earworm |
| **The Impostor** *(new)* | Wears the knockoff costume for the cameras | Moves around the city | An impostor-sighting chase |

## Unmasking a lieutenant: where it happens
The club cases already end in a showdown in the club's **back office** (`club3d/office.js`): the boss
counters her three times, she answers each with the right kind of evidence (who deals it, who supplies
it, the drop), and he folds and confesses. Act 1 turns that moment into the unmasking:

1. **The confession is the unmasking.** When the lieutenant folds, a comic panel slams in with their
   face, stamped **UNMASKED**, and the line that ties them to the Puzzle Maker. For example, Lenny:
   *"You think this is my operation? I just count the money. He designs everything."*
2. **Their silhouette on the act board flips to their portrait.** Red string runs from them to the
   Puzzle Maker's empty frame in the middle.
3. **They drop a Seal Key**: a jigsaw-shaped key with the hotel's crest. It opens one of the five
   locks on the lair's Ballroom door.
4. **A case solved by accusation instead** (no office showdown) still unmasks, with the same panel at
   the end of the case.
5. **The Impostor** has no club case. She's unmasked in flight: catch her during an impostor sighting,
   and the wig comes off on camera. The panel, the board and the Seal Key work the same way.

The act board is the existing cork case board (`caseboard.js`), grown to cover the whole act: six
lieutenant frames around the Puzzle Maker's silhouette, the jigsaw picture filling in below, and the
gate checklist down the side.

## The drug
- **What it does:** people go compliant, hazy, impulsive, flirty and oversensitive, with bad judgement.
  **(user)** On Supergirl, it hits the existing intoxication meter.
- **One compound, many cuts.** Kell cooks a base compound; Super Squirt and Halo are street brands of
  it. Each case she solves cuts off one brand, and a new one shows up. That's how the drug keeps
  feeling like the main story.
- **Name:** placeholder **Compound K** (OK'd for now **(user)**). The boss's name is **the Puzzle Maker** **(user)**.

## The frame-up and the Polaroids
**(user)** The Polaroids already scattered around the city become the act's collectible and its
evidence.

- **Two kinds.** *Real* ones are her own bad nights, the frames the game already makes from her clips.
  *Fakes* show the impostor. Recovering either kind restores reputation. **(user)**
- **The fakes get better.** Early fakes use the cheap tube-top knockoff, and the giveaways are obvious.
  Later ones use near-perfect replicas of her classic suit, so the giveaways are small.
- **Jigsaw backs.** Every fake has a jigsaw piece printed on the back. Pieces go on the act board and
  together form a picture: the hotel, with the 13th floor lit. That's how she learns where the lair is.
- **Impostor sightings** *(new map event, from City Guardian on)*: "Supergirl spotted at …" appears on
  the map with a timer. Get there before the photographers and chase the impostor in flight. Catch her
  for a big reputation win. Miss, and the photos run.

### Mini-game: Supergirl or Impostor? (Polaroids found in the city) **(user)**
Every Polaroid she picks up opens full screen with two buttons: **SUPERGIRL** and **IMPOSTOR**.
- **Right about a fake:** the tabloid prints a retraction (+ rep) and its jigsaw piece goes on the board.
- **Right about a real one:** she gets it back before it's posted (the existing +2).
- **Wrong:** a comic-book yellow caption box mocks her (same lines as the poster game below), and she
  loses the bonus. A fake she called real doesn't give its jigsaw piece yet; she can look again on the
  act board.
- **Gate:** 10 fakes called correctly.

### Using the costume images (`assets/SGCostume/`)
They're green-screen flat-lays, so the costume can be keyed into any investigation still:
- **tube-top set**: the impostor's knockoff. Found in her dressing rooms, laid out on beds and on
  club-office desks. It proves the frame.
- **classic set**: the replica suits from the impostor's tailor. Found in the forger's workshop (a
  factory or warehouse case) and in the hotel's Wardrobe wing. Each one is a little closer to the real
  thing.
- The `_weak` files: use them as background dressing, keep the strong ones for close-up clues.

## The henchmen storylines
**(user)** During this act, investigations carry storylines from the Puzzle Maker's henchmen. Each
lieutenant's thread is three steps, and the existing missions supply all of them:

1. **Rumour**: a 2D investigation (alley, office or apartment) tagged with the thread. A witness names
   a place.
2. **Raid**: a warehouse, factory, asylum or regular club visit at that place. It's tagged, so a
   thread clue is waiting inside.
3. **Showdown**: the lieutenant's own case and its back-office unmasking (above).

Untagged missions still spawn as usual, so normal crime keeps going. **(user)** Tagged missions show
the lieutenant's portrait on the map.

## Gates: what unlocks the boss
**(user)** Reputation 300+ plus activity counts. Agreed with the user to start from these numbers and
tune by feel: balanced plays well; off and it drags. **(user)**

| Requirement | Count | Why |
|---|---|---|
| Reputation | **300+** (Metro Icon) **(user)** | The rank already exists |
| Nightclub missions completed | **8** **(user)**, the 6 named club cases among them | 6 are the lieutenants' finales; 2 are repeats |
| Warehouses | **2** **(user)** | Raids for the Queen Bee and Fixer threads |
| Asylum | **1** | Points at Kell |
| Factory | **1** | Helix Labs / the forger's workshop |
| Entertainment district | **1** investigation + Flashpoint | Roxy Flash's thread |
| Lieutenants unmasked | **5 of 6** | Each gives a Seal Key |
| Fake Polaroids called correctly | **10** | Completes the hotel picture |

**Rough timing:** a club visit is ~10–15 min, so this is about 4–6 hours of play. Playtest with a
`?act=` debug param that pre-fills the gates, so the late game can be tested without the grind.

**Keeping 300 hard:** the Puzzle Maker hits back. The more lieutenants she unmasks, the more often
impostor sightings and leaks happen. Her reputation climbs, but he keeps dragging it down, so 300 is a
fight right to the end.

**The rule:** the lair opens the moment every gate is met, and it stays open even if her reputation
dips afterward.

## Story beats (on the existing rank-ups)
Told through the LIVE feed, the green-screen screens and the newspaper, as always.

| When | Beat |
|---|---|
| Start (rep 20) | Normal patrol. The LIVE feed mentions "a new party drug" |
| **Local Hero (60)** | Super Squirt is offered. The first fake Polaroid turns up: "SUPERGIRL'S WILD NIGHT?" She doesn't remember that night, because it wasn't her |
| **City Guardian (150)** | The story clubs and the act board open. The LIVE feed shows drugged civilians. The asylum's experiments case points at Kell. Impostor sightings start |
| ~225 | The Puzzle Maker's first message: a jigsaw keyed onto a downtown billboard, a riddle naming the next lieutenant |
| **Metro Icon (300) + gates** | The jigsaw picture is complete. Every shell company has the same address. The hotel's 13th floor lights up on the map |
| Boss beaten | The Puzzle Maker and Dr Kell are both locked up **(user)**; the impostor ring is exposed (front page, big rep). End of Act 1 |

## The lair: the Slutty Little Red Mini Skirt
**(user)** One building in the Villains' Lair district hosts every act's boss, like a giant hotel
with one floor open per act.

- **The building:** the Villains' Lair district's landmark tower, the "villain spike" (`landmarks3d.js`):
  170 m, a dark four-sided spike on a 16 m base, green neon slits up its corners, a green beacon on top.
  Proposed restyle into the hotel, keeping the silhouette: lit window floors, the name in neon (green,
  purple, red) on the base and up the spike, and Floor 13 lighting up when the lair opens. The entrance
  is a marker at its base. The landmark is placed on the biggest building near the district's centre,
  so the code should guarantee it on every map. Act 1 uses **Floor 13**; the elevator panel shows the
  other floors locked.
- **The layout:** mostly the asylum's design with more of it: **(user)** 4–5 wings off a central
  lobby, more rooms per wing than Ravenmoor, and the Grand Ballroom at the far end. Act 1's wings:
  - **The Gallery**: the frame-up archive. Blown-up fake photos and her tabloid covers.
  - **The Wardrobe**: impostor costumes on racks (the costume images).
  - **The Lab**: Kell's wing. Specimen jars and drug samples.
  - **The Screening Rooms**: the trap rooms, with videos on every screen.
  - **The Switchboard**: the paparazzi network's phones and monitors.
- **The halls** **(user)**: red-light-district style, lit in **neon green, purple and red**. Low
  light, lit door numbers, neon tube trim, a haze the neon cuts through. The halls use the
  red-light kit's dressing; the rooms off them use the asylum's.
- **Seals:** the Ballroom door has 5 locks. Each Seal Key opens one, and each matching wing holds a
  small puzzle (a Puzzle Maker riddle) to set it. So the lair recaps the whole act.
- **Trap devices:** **(user)** chairs, cages and pods in the rooms. Touching bait or a device triggers
  the struggle mini-game over a video. Break free and she's on her feet again. Fail and the alarm
  calls Kell to her.

### The hallway posters: Supergirl or Impostor? **(user)**
The walls of every hall are covered in posters of Supergirl, and of the impostor playing the hero.
- **Examine** any poster (walk up and tap): it opens full screen with **SUPERGIRL** / **IMPOSTOR**.
- **Score:** a running tally on the HUD while she's on the floor (e.g. *14 / 17*), kept as a personal
  best across visits. It's just for fun: no reputation, no gates. **(user)**
- **Wrong pick:** a comic-book **yellow caption box** mocks her. **(user)** Draft lines:
  - *"Can't even recognise herself. Adorable."*
  - *"That's not you, sweetheart. Yours is the one with the dignity."*
  - *"The tabloids can't tell either. That's the point."*
  - *"Wow. Even the impostor's insulted."*
  - *"Look closer. Or don't. It's funnier this way."*
  - *"Wrong! He'll want that one framed."* (on a real one called fake)
- **Right pick:** a quick stamp (**REAL** / **FAKE**) and the next poster's harder.
- Each poster is examined once per visit; the set reshuffles each time.
- The Polaroids in the city use the same screen and the same mocking box.

### Kell: the stun ray and the memory wipe
**(user)** Instead of security, Kell hunts her with a kryptonite stun ray. Getting hit means a
memory wipe and a video sequence, and she wakes in a random room knowing he ran experiments on her.

- **The ray:** a green beam he charges for about a second (the warning), then fires in a cone. Break
  line of sight or X-ray him through walls to stay ahead. He's slower than she is but never stops
  searching.
- **The wipe is a mechanic:** the minimap forgets the rooms she's explored, and her Seal progress
  stays. She knows she was there; she just can't remember the way.
- **The experiment:** each wake-up applies one random after-effect, shown as a note pinned to her
  ("Subject response to Compound K: …"):
  - She wakes high (intoxication starts at 40).
  - **Tagged:** Kell finds her faster for a while.
  - **Powers scrambled:** X-ray is down for a minute.
  - **Sensitive:** the struggles are harder for a while.
- **Captured at the end:** **(user)** once the Puzzle Maker falls, Kell is trapped on the floor; he's
  led out in cuffs in the final cutscene.

## The boss fight: the Grand Ballroom
**(user)** A huge dance floor full of the hotel's customers and villains. It's also where the boss
fight happens.

**The masquerade, then the fight** **(user)**. The puzzle floor from draft 1 is cut.

1. **The masquerade.** Everyone's masked, including several impostor Supergirls. The Puzzle Maker hides
   in the crowd. She narrows him down with the clue system the cases already use (hand, shoes, scent,
   mark, hair): every lieutenant she unmasked gave one fact about him. Accusing the wrong guest springs
   a trap (the struggle, then back into the crowd).
2. **The fight.** Unmasked, he takes the DJ booth. Four kryptonite emitters around the dance floor
   weaken her more the closer she gets to him; each is guarded and locked with a short riddle. Brawl the
   guards, solve the lock, knock it out. With all four down she reaches the booth and takes him down.

**Losing:** **(user)** she's captured and put on the stage, videos play, and the crowd comments (the
existing commentary system shouts). She escapes with the struggle mini-game. Break free and the fight
picks up where it was. **(user)** Fail and the capture loop repeats. **(user)**
- **No mercy:** the struggle never gets easier. **(user)** Being captured again and again is part of
  the humiliation ritual.
- Each failed loop costs reputation and plays a different curated clip, and the crowd's heckling
  escalates, so the loop doesn't feel like a replay.

## What to build (rough order)
1. **Act state:** the act, the gates, lieutenant threads, Polaroid kinds and jigsaw pieces in
   `state.js`; the act board (grown from `caseboard.js`); the unmasking panel on the office confession.
2. **Story beats** on the rank-ups (LIVE feed, billboard, newspaper), plus thread tags on spawned
   missions.
3. **Supergirl or Impostor screen** (shared by the Polaroids and the posters), the mocking yellow box,
   jigsaw backs, impostor sightings in flight.
4. **The hotel floor:** extend the asylum generator (more wings, bigger rooms, Seals), the neon
   red-light halls with examinable posters, trap devices using `struggle.js`, Kell as the hunter, the
   memory wipe and the experiments.
5. **The Ballroom boss:** the gilded layout plus crowd, the masquerade, the emitter fight, and the stage capture loop.

Clips and images: every new video or poster spot uses only material from the hand-checked lists (like
`src/club3d/clips.js`), each checked at full size.

## Impostor images
**(user)** The user is making the impostor images (posters, fake Polaroids). Until then the game uses
placeholders: the existing Polaroid frames for "real", and the same frames stamped with a visible
knockoff tell (a tube-top overlay keyed from `assets/SGCostume/`) for "impostor". No Blender work for
this.

## Built so far (2026-10-09)
**The act** (`src/act/`): `act1.js` is the data (lieutenants and their facts about the Puzzle Maker,
the gates, the beats, the mocking lines, the seals' and emitters' riddles, Kell's experiments, the
trails); `act.js` the runtime (`game.act`, state in `state.act`, saved); `spot.js` the Supergirl or
Impostor call and the placeholder fakes.
- **Gates** count in `main.js endZone` (any win): clubs (any club mission), `Warehouse` raids, the
  asylum, wins in the factory and entertainment districts. Fakes = Polaroids called right.
- **Unmasking:** a club case's confession (`club3d/casework.js solveCase`) or any win of its mission
  shows the UNMASKED panel: the lieutenant's line, their fact about him, a Seal Key. The Impostor is
  unmasked by catching her in a sighting. Case → lieutenant: squirt/blackmail → Lenny Gold, halo →
  Bianca Rook, flashpoint → Roxy Flash, auction → Marcus Vane, earworm → Madame Mesmer.
- **Trails:** from City Guardian on, ~35% of new investigations, night cases, asylum visits and
  warehouse raids carry a lieutenant's trail (their initial on the marker): two steps of story each.
- **Beats** on the rank-ups (start, 60, 150, 225 the billboard riddle, 300), each once, when she's
  flying and nothing else is up. The 13th floor opens once every gate is met and stays open.
- **Polaroids:** after Local Hero they turn up whatever her reputation (a little slower above 0), 60%
  fakes; the call; right about a fake = +4 and a jigsaw piece; a fake called real is pinned to the
  board ("Look again").
- **Sightings:** from City Guardian on, every 150–210 s, minus 20 s per lieutenant unmasked (min 100):
  a "Supergirl" marker that runs (640 u/s: faster than cruising, slower than a boost). DIVE close = +12
  (and the Impostor's unmasking, first time); she gets away after 75 s = −6.
- **The act board:** MAP → Act board, or the pause menu.

**The hotel tower** (`landmarks3d.js` spike): the lair landmark, always on the block nearest the lair
seed (`city.js`), with SLUTTY LITTLE / RED MINI SKIRT in neon on its base, HOTEL blades, green,
purple and red slits and lit rooms. Floor 13's green band (`city3d.js hotelBand`) shows once the act
opens it; the marker ("13") is at its foot.

**Floor 13** (`src/hotel/`): `plan.js` generates the building (lobby, main hall, four wings of six rooms,
four Screening Rooms, the ballroom), `art.js` the textures, posters and keyed costumes, `hotel.js` the
zone (ClubZone, like the asylum), `kell.js` Dr Kell, `ballroom.js` the boss.
- 18 posters per visit from frames of the hand-checked clips (`club3d/clips.js`), half made fakes.
- Each wing: a note with its seal's answer, two traps (jigsaw bait → the struggle; fail = Kell is
  sent after her), the rest dressing (the Wardrobe's beds hold the user's costume flat-lays).
- Seals: a Seal Key (unmasked lieutenants minus seals set) and the riddle; wrong = a trap. Seals are
  saved in the act and survive leaving (the elevator) and wipes.
- Kell: patrols the halls' graph, 1.0 s charge (0.7 tagged), ray = memory wipe: a captive clip, a
  random room, doors shut, notes forgotten, −3 rep and one experiment (high / tagged 60 s / X-ray
  scrambled 60 s / struggles hard 90 s). A punch from behind downs him for 6 s.
- Ballroom: 18 masked guests + 4 impostors; the Puzzle Maker's costume is rolled once per game, the
  other guests differ from him in at least two of the facts she has. Wrong guest = a struggle (fail =
  the stage). Then four emitters (reach 7 m), each with a guard and a riddle; the kryptonite meter
  fills near live ones; 100 = the stage. Stage: heckles, a shame clip struggle (hard, never easier),
  −4 rep per failure, repeat until free. The takedown → Kell caught → `act.complete()` (+100, the
  front page, ACT 1 COMPLETE).

**Placeholders** until the user's art lands: the impostor (a real frame with one colour swapped:
hair, cape or suit), the lieutenants' and Kell's looks (procedural NPCs), the Puzzle Maker (a masked
NPC; the Riddler model in `assets/Enemy Characters/` isn't wired).

**Testing:** `?act=local` / `?act=guardian` (start at that rank), `?act=lair` (every gate met: the
floor is open), `?act=boss` (and every seal set). `node tools/shots/act.js [--flows ...]` plays the
board, a trail, a Polaroid call, an unmasking, a sighting, the tower, the floor, Kell's wipe, a seal
and the ballroom (`shots/act/act/`).

**Tuning knobs:** `GATES` (act1.js), `SIGHT` and `STRAY_FAKE` (act.js), `KELL` (kell.js), `B` (ballroom.js),
`POSTERS` (hotel.js).
