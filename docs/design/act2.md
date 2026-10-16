# Act 2: Not So Super

Status: **draft, 2026-10-14; story details added 2026-10-16.** Nothing is built yet except the pieces pulled forward into round 11
(see "Built early" at the end). **(user)** marks the user's own calls: from their outline
(2026-10-14), or from their answers to the questions on it. Everything else is the director's
proposal, still open to change.

## The act in one paragraph
Act 1 ended with the Puzzle Maker and Dr Kell locked up, but **Compound K is still around, and now
there's an enhanced cut** **(user)**. During one of the memory gaps the new cut leaves, **the impostor
cult steals her original costume** **(user)**. Supergirl works the act in a backup suit, the **crop-top
Supergirl** **(user)**. The cult is no longer one woman in a knockoff: there are many of them, they
**run the show for the paparazzi** **(user)**, and they turn up at grand openings and promotions all over
the city's night districts **(user)**. Their leader wears **Supergirl's real suit**, and she's the act's
boss **(user)**. The drug works on Supergirl's mind as much as her body. In the asylum she **comes to
believe she's a working girl who dresses up as Supergirl** **(user)**, and her powers go with that
belief. To get the suit back she has to go where the hero can't: with a **negative reputation**, into
the casino and the city's worst clubs **(user)**. That swing in reputation is the act's core loop.

## The night she lost the suit (the act's opening)
**(user, 2026-10-16)** The after-party of the **High-Roller Suite's grand opening** (the casino district), held at **the Gilded Cage**
(the club with the cage). What she gets back, a piece at a time, in the Recall flashbacks:
1. The room spinning.
2. Doing drugs in the lounge and the VIP area.
3. Blacking out in the dark room.
4. Waking up in the red-light district, in her **crop-top Supergirl costume**, with her **original
   costume gone**.
5. **Polaroids scattered** around her, and a **blackmail note about a videotape** of her.

**She wakes up already captured, inside an RLD Walk** **(user, 2026-10-16)**: tied up in one of the
rooms, the Polaroids on the floor and the note beside her. The act opens as a playable level, not a
cutscene. **Why here and not the asylum** (the user offered either, 2026-10-16; the director picked
the RLD Walk): the cult dumps her in a red-light room in a Supergirl costume and photographs her
there. Those Polaroids are the "proof" behind the working-girl lie, and later the asylum's doctors
use them to keep her locked up. The asylum works better as the act's mid-point low, and the crime
spree only hits hard once the city has already seen her fighting back.

Proposal for how it runs:
- **The wake-up:** the asylum's wake-in-a-cell start (`asylum.js`, `p.wake`: the get-up clip, the
  WAKE UP banner) in the room, then the easy S-shield escape. A first spray of the house perfume
  before she's out the door, so she starts the act intoxicated.
- **What it teaches:** the escape, the perfume, X-ray through the red doors, freeing the first
  captives, and one lead door (her rep is already −50, so it's open) with a first "Which one is
  hers?" find.
- **It's the first of the 3 RLD Walks** in the gates, and the Polaroids and the note go onto the act
  board as the act's first clues.

The clues point to **the casinos** **(user)**. That's the act's first lead: the casino opening's
guest list, the Gilded Cage's VIP area, the tape. (Proposal: the Gilded Cage's cage dance is the
same place she lost the night, so going back there is both the fast way to negative rep and a set
of memory clues.)

## What's already in the game, and where it fits
| Already built | Its role in Act 2 |
|---|---|
| Act 1's runtime (`src/act/act.js`, gates, beats, the act board, `?act=`) | Grows to run more than one act: Act 2's data in a new `src/act/act2.js` |
| The Supergirl or Impostor call (`src/act/spot.js`) and the posters | The expanded impostor games: promotions, grand openings, the hall of mirrors |
| Polaroid strays below zero rep (`polaroids.js`) | The cult's Polaroids. They spread when the impostors' rep is high (below) |
| The Hive's `highOnly` rule (`club3d/story.js`) | **Recall:** clues that only read while she's intoxicated |
| Intoxication, sedation, the struggle (`struggle.js`, the S-shield trace from round 11) | Captive moments everywhere; the boss fight's drug meter |
| The cage dance in the Gilded Cage (round 11, D3) | The fast way down to a negative reputation |
| The 3D club engine (`src/club3d/`, plan variants like the Gilded Cage) | The casino venue, and the "selected clubs" that only open to a disgraced hero |
| The casino district, "Rigged Tables", the High-Roller Suite venue (`data.js`) | Where the casino sits on the map |
| The hotel generator and zone (`src/hotel/plan.js`, `hotel.js`) | The factory production lines, and the hotel's new floor |
| Ravenmoor Asylum (`asylum.js`) | The Act 2 asylum: always intoxicated, powers lost |
| Supergirl_Dark (`hero_dark.glb`) and the costume switch (`hero3d.js`) | Placeholder for the knockoff costume; the slot the crop top goes into |
| The green-screen costume flat-lays (`assets/SGCostume/`) | The original costume's pieces as found clues |
| The flight moments (`src/moments/`) and perching | Drug stashes found in flight and on rooftops |
| The brawler and the 2D investigations | Drug finds and trafficking cases |

## The cast
**The cult's leader, Act 2 boss.** **(user)** The first impostor, now the head of a cult of them. She
wears **Supergirl's stolen original suit**, which makes her the most convincing fake in the city. She
runs the paparazzi show and sells Super Squirt. Her real name is unknown;
everyone calls her **Supergurl** **(user)**.

**The impostor cult.** **(user)** Many women in knockoff suits. They do the promotions, cut the ribbons
at grand openings in the red-light, nightclub and naughty districts, and pose for every camera. Their
reputation moves opposite to hers (below).

**The cult's look (user, 2026-10-14, "the cult characters for now").** Hooded robes and coats in
black with red and gold trim, and faceless masks: gold, white, a red demon mask, and a wraith with
glowing red eyes. References (local, git-ignored): `docs/references/user/act2-cult-*.jpg`.

**The final looks (user, 2026-10-16).** References (local): `docs/references/user/act2-cult-member.jpg`
and `act2-cult-leader.jpg`.
- **A cult member:** a deep-red hooded robe to the floor, a rope belt, black gloves, and a black,
  faceless mask with a faint smile. Fog at the feet.
- **The cult leader:** a long black coat with red braided cord on the shoulder, a black hood, a
  glossy red mask with a sculpted face, black riding boots, hands behind her back. **The coat and
  mask go over Supergirl's stolen suit, and come off during the boss fight** **(user)**.

**The paparazzi gang.** **(user)** The cult controls them. The **doctors at the asylum work for
the gang** **(user)**, so the asylum is the cult's ground too.

**Holdovers.** Kell and the Puzzle Maker are locked up. Act 1's lieutenants can come back as
henchmen or informants until the user's own henchmen designs land.

## The drug: Super Squirt
- **Name:** **Super Squirt** **(user)**, the enhanced cut of Compound K.
- **What it does:** compliance, memory gaps, ecstasy and euphoria, intoxication, nightmares **(user)**.
  Memory gaps, compliance, ecstasy and intoxication lead the story **(user)**.
- **How it's taken (proposal):** in spiked drinks at the clubs and the casino, and as pills in the
  stashes. **Who makes it now (proposal):** the cult leader, on the factory production lines.
- **Recall** **(user)**: drinking and the drug sometimes bring memories back, and that helps solve the
  mystery. As a mechanic, some clues are **memory clues**: they only read while she's over the haze line
  (`INTOX_HAZE`), like the Hive's `highOnly` rule. Read one and a flashback plays: a frame from the
  hand-checked clips (`club3d/clips.js`) on the LIVE feed, and a line from the night she lost.
- **Drugs everywhere** **(user)**: stashes found while flying and perching on rooftops, in the brawler's
  streets, and in investigations. Taking one = intoxication, and sometimes a memory clue.
- **Nightmares:** the capture and sedation clips get a nightmare frame (an ink-wash, shaking caption)
  when she's high.

## The reputation pendulum
**(user)** Negative and positive reputation now both play into the story.

| Her rep | What it opens | The cost |
|---|---|---|
| **Negative** ("Disgraced") | The casino, selected nightclubs, some investigations **(user)**. **The only time she can find pieces of her original suit** **(user)** | The impostors' rep goes positive, so they spread **more Polaroids** **(user)** |
| **Positive** | Normal hero work. The impostors lose their audience: fewer Polaroids | The casino door and the selected clubs are shut |

- **The impostors' rep** is shown next to hers on the act board: the inverse of hers, roughly. It sets
  how fast the cult's Polaroids turn up (`polaroids.js` strays already speed up below zero).
- **Ways down, fast:** the cage dance (round 11), scandals, losing at the casino, a lost brawl.
- **Ways up:** rescues, Polaroids recovered, impostors caught at their promotions.
- **Opening the act:** the scandal sets her rep to −50, so she starts the act disgraced (see the gates).

## Costumes
- **The crop-top Supergirl:** her backup suit and the act's default costume **(user)**. Built in
  Blender from `supergirl.glb`, the way Supergirl_Dark was (`tools/heroskins/`, same rig, animations,
  cape and atlas layout), **from the user's reference image** **(user)** (received 2026-10-16,
  `docs/references/user/act2-croptop-sg.jpg`, local): a glossy light-blue long-sleeve crop top with the
  red and yellow S, bare midriff, a glossy red mini skirt with a yellow V waistband, wide silver cuffs
  at the wrists. Long wavy blonde hair. **The same red boots as the other
  Supergirls, and no cape for now** **(user)**.
- **The knockoff:** she has to wear a fake Supergirl suit, with a negative rep, to get into the casino
  and play **(user)**. Supergirl_Dark is its placeholder until real art lands.
- **Her original suit, in five pieces:** **(user)**
  - **Cape, boots, briefs:** found in the selected nightclubs and investigations **(user)**.
  - **Top and red skirt:** won at the casino **(user)**.
  - **5 finds per piece** **(user)**: finds 1–4 are stained copies or clues that point to the next one,
    and find 5 is the real piece. Most encounters with the original costume come with stains on it
    **(user)**. Finds only happen while her rep is negative.
  - The act board shows the suit filling in, piece by piece. The flat-lays in `assets/SGCostume/`
    serve as the found-clue images, keyed into the scene like Act 1's Wardrobe.

## The cult and the Supergirl or Impostor games
**(user)** The game is expanded. Impostors do promotions and show up for grand openings in the
**red-light, nightclub and naughty nightclub districts**, for shady business.
- **Promotions:** a new map event (like Act 1's sightings): "Supergirl at the grand opening of …". At
  the venue, a lineup of Supergirls on a stage; she picks the impostors out (the existing call screen).
  Catch them = rep up, impostors' rep down.
- **The paparazzi:** the cult runs them **(user)**. Their photos are the Polaroids, and they're the
  ones in the clubs' crowd scandal beats (round 11's casegen twists: real, doctored, planted, lookalike,
  setup).
- **The twist:** the cult has her real suit **(user)**, so late in the act the fakes become perfect:
  the only tell left is a stain, or the wrong boots.

## The venues
**The casino.** **(user)** Mini-games and small-stakes gambling for information and unlocks.
- A 3D club venue (a `club3d` plan variant, like the Gilded Cage): tables, a cashier, pit bosses as
  bouncers, the crowd.
- **Entry:** negative rep and the knockoff suit **(user)**.
- **Card games:** **high card** and **21** **(user)**, as a DOM overlay like the VIP dance's numpad.
- **Winning:** information, unlocks, and the top and the skirt of her original suit **(user)**.
- **Losing:** a higher dose of the drug, and an article of the impostor's clothing off **(user)**.
  Accessories only (cape, gloves, belt, boots); she never goes below the top and skirt. With nothing
  left to lose, she's thrown out.

**The factory production lines.** **(user)** Designed like Act 1's Floor 13 without the ballroom: the
hotel engine, reused **(user)**. Wings become production lines; **4 levers switched to green shut
the drug's production down** **(user)**. A foreman and guards take Kell's role as the hunters. Trap
devices and the struggle stay.

**The asylum.** **(user)**
- **She's always intoxicated in the asylum** **(user)**.
- **The story:** she's **drugged and hypnotized** into believing she's a working girl who dresses up as
  Supergirl, when the truth is that she *is* Supergirl **(user)**. The drug keeps her compliant,
  ecstatic, intoxicated and confused **(user)**. During those memory gaps she can't use her powers
  **(user)**.
- **How she got there:** the cult checked her in under the working-girl identity, and the doctors
  work for the paparazzi gang the cult controls **(user)**, so the staff believe the story.
- **A crime spree while she's locked up** **(user)**. Proposal: crimes pile up on the city map while
  she's inside (a counter on the act board, red markers in the districts), and each one is a mission
  waiting when she gets out. The cult uses the spree to make the city forget Supergirl.
- **The X-ray button is still there**, but instead of working it makes her say **"What's going on?
  Where are my powers?"** **(user)** (and the same for super-hearing).
- **Supergirl costume clues** are hidden in each visit. Once she finds one, she remembers, and her
  powers come back for the rest of that visit **(user)**.
- The clues in the asylum lean on Supergirl or fake games **(user)**: the posters, the call screen.

**RLD Walks.** **(user, 2026-10-16)** A new level and activity: a rescue mission to free the women
held in the red-light district.
- **The space** **(user)**: built like the asylum (generated 3D building, the same movement, camera,
  X-ray and hunters), re-themed as a red-light street: large windows, red doors, red neon. The asylum
  generator lays out wings around a hub; an RLD Walk is **an H**: two parallel streets joined by a
  cross street, rooms on both sides of each **(user)**.
- **The goal:** find and free the captives. X-ray shows who's behind the red doors; free them and walk
  them out (the asylum's rescue and witness code). Rescues raise her rep.
- **The house perfume** **(user)**: she keeps getting sprayed with it, and it intoxicates her. Proposal:
  hostesses with atomizers walk the streets, and spray vents sit over some doorways. Each spray adds
  intoxication; over the haze line the neon smears and the X-ray flickers.
- **Capture** **(user)**: she wakes up tied up in one of the rooms, and **the escape is easy**: a short
  S-shield struggle, no sedation spiral.
- **The lead doors** **(user)**: **X-ray can't see through them.** Behind each is a bigger room with a
  small puzzle. Proposal, one mini-game: **Which one is hers?** Four copies of one suit piece laid out
  on a bed or a rack, the green-screen flat-lays from `assets/SGCostume/`, three stained or wrong in a
  small detail. **The real one is stained too** **(user)**, so a stain never gives it away: the tell is
  how it's made (the S's exact shape, the right shade of red, the stitching, the fabric's sheen).
  Pick the real one and it counts as a find toward that piece. Proposal: the stain on the real one is
  a memory clue, so reading it while she's high plays a flashback of the night she lost. Over the haze line the copies swim and swap places, so the
  perfume makes the puzzle harder. It reuses the call screen and the flat-lays, and it's the same
  skill the late-act impostor games and the boss's mirror call need.
- **The camera** **(user)**: the level to try the **over-the-shoulder zoom** on. The street corridors are
  narrow and the windows are the point, so a close camera behind her should read well there first.
- **The pendulum:** the walks open at any rep, but the lead doors only open below zero, the same rule
  as every suit find. So a walk is a choice: the lead rooms first while she's still disgraced, then
  the rescues, which pull her rep back up.

**Investigations.** **(user)** A drug and trafficking theme, and the original costume turns up a lot
here **(user)**.

## Gates: what unlocks the boss
**(user, 2026-10-16)** 6 asylum visits, 8 nightclubs, 6 casinos; the user asked the director to fill
in the rest. Tune by feel, the way Act 1's were.

| Requirement | Count | Notes |
|---|---|---|
| Asylum visits | **6** **(user)** | Each one hides a costume clue that brings her powers back |
| Nightclub missions | **8** **(user)** | Going back to the Gilded Cage, where she lost the night, is one of them |
| Casino nights won | **6** **(user)** | The High-Roller Suite and the district's other tables |
| Factory shutdowns | **2** | 4 levers each |
| RLD Walks | **3** | Each with 2 lead doors |
| Drug and trafficking investigations | **3** | |
| Impostors caught at promotions | **4** | Short map events, not full missions |
| Cult Polaroids called right | **12** | Act 1 was 10 |
| Her original suit | **5 pieces x 5 finds = 25** **(user)** | See the supply below |

**28 missions** plus the promotions: about 5.5 to 7 hours at Act 1's pace (10 to 15 minutes a
mission), a little longer than Act 1's 4 to 6 hours.

**Where the 25 finds come from** (only while her rep is negative; the supply runs higher than the need,
so a missed find never blocks the act):
| Piece | Needs | Comes from | Supply over the gates |
|---|---|---|---|
| Cape, boots, briefs | 15 | 1 per club mission (the VIP or back room), 1 per asylum clue, 2 per RLD Walk (the lead rooms), 1 per investigation | 8 + 6 + 6 + 3 = 23 |
| Top, red skirt | 10 | Up to 2 per casino night: 1 per table won (high card, 21) | 12 |

**The opening scandal:** the tape, the Polaroids and the lost suit **set her rep to −50**, whatever it
was at the end of Act 1. She starts the act disgraced, so the casino and the suit hunt are open right
away, and rescues are what bring her back up. (For scale: a mission pays 10 to 22, a capture costs
10, the cage dance 8, a public humiliation 30.)

**The casino stakes:**
- **Entry:** rep below zero and the knockoff suit **(user)**.
- **A night:** two tables, high card and 21. Win a table: a top or skirt find, plus a lead or an unlock.
  Win both and the night counts toward the gate.
- **Lose a hand:** one dose of Super Squirt (+intoxication, like the stashes) and one knockoff accessory
  off **(user)**, in order: cape, gloves, belt, boots. A loss also costs 8 rep.
- **Four losses** and she has nothing left to bet: she's thrown out, and the night is lost.

No reputation gate: the pendulum makes a fixed number meaningless. Debug params: `?act=act2` (start of
the act), `?act=act2lair` (every gate met), `?act=act2boss`.

## The hotel's new floor and the boss
**(user)** The hotel unlocks a new floor with the Act 2 boss.
- **A hall of mirrors** **(user)**: mirrored corridors and rooms, her double in the glass. The mood
  reference is the user's mirror image (2026-10-14, `docs/references/user/act2-mirror-mood.jpg`): purple
  neon tubes, graffiti, wet tiles, the reflection.
- **What's on it** **(user)**: Supergirl or Impostor games, original-costume puzzles, doing drugs, traps
  and captive moments (the S-shield struggle).
- **The boss door** opens once the hall of mirrors is complete (both costume rails + 3 portraits) **(user, 2026-10-16)**.
- **The boss fight** is built around getting drugged up and intoxicated **(user)**. Proposal: the
  cult leader in the real suit fights with the drug. Every hit or trap raises intoxication, and the
  mirrors multiply her and the leader as it climbs. Over the haze line, Supergirl has to pick the real
  leader out of the reflections (the call). Win and she gets her real suit back, stains and all.
- **The reveal** **(user)**: the leader's black coat and red mask come off during the fight, and
  Supergirl's stolen suit is underneath.
- **The dialogue** **(user)**: a lot of back and forth between the fake and the real Supergirl. The
  fake insults the real one and accuses her of the things the fake did herself: the Polaroids, the
  tape, the crime spree, the drug. The real Supergirl answers back. (Proposal: one exchange per phase
  of the fight, with the accusations getting harder to deny as her intoxication climbs.)

## Content line (the same as round 11's crowd scandals)
- PG-13. Video only from the hand-checked list (`src/club3d/clips.js`), each clip checked at full size.
- Stains on the costume are spilled drinks, lipstick or makeup.
- Casino losses take accessories only and never go below the top and skirt.
- The identity story in the asylum is told in captions, stills and her own lines.
- The blackmail tape is a note and a label on a cassette. Nothing from it is shown.
- RLD Walks: the captives are rescued people, shown dressed and in captions and stills. Being tied up is
  the same captive moment as the asylum and the struggle.

## What to build (phases)
Each phase is one small fresh agent with a handoff file (`docs/polish/ROUND11.md` "Credit-lean process").
Start after round 11's tracks, or in a free builder slot.

- **A. The Act 2 skeleton:** `src/act/act2.js` (gates, beats, lines), the runtime working per act,
  state fields with defaults (saves keep loading), the act board's second page, the `?act=` params, and
  Act 2 opening after `act.complete()`.
- **B. The pendulum and the cult:** the negative-rep perks (doors that only open below zero), the
  impostors' rep driving the Polaroids, promotions and grand openings as map events.
- **C. Costumes:** the crop top (Blender, from `act2-croptop-sg.jpg`, once blender-mcp
  connects), the knockoff switch, the five pieces with five finds each, the act board's suit.
- **D. The casino:** the venue plan, high card and 21, the stakes (doses, knockoff pieces), the top
  and skirt.
- **E. The factory lines:** the hotel generator re-themed, 4 levers, the foreman.
- **F. The Act 2 asylum:** always high, powers lost, costume clues, the lines.
- **G. Recall and drug finds:** memory clues, flashbacks, stashes in flight, rooftops, brawls and
  investigations.
- **H. The new floor and the boss:** the hall of mirrors and the fight.
- **I. RLD Walks:** the asylum generator in an H, the red-light dressing, the perfume, the rescues,
  capture as tied up, the lead doors and the Which-one-is-hers puzzle. **Build it right after A**: the act opens
  inside it.

## Open questions (the user's calls)
- The numbers above are proposals around the user's 6 / 8 / 6, ready for a playtest.
- Which clubs are the "selected nightclubs" that open below zero (proposal: the three story clubs'
  districts plus one new club in the naughty district).

## Built early (pulled into round 11, 2026-10-14)
- **The S-shield struggle** (D1): the struggle becomes tracing the S on her chest, the pad cropped
  from the user's photo (`assets/ui/s_shield.webp`). Act 2's captive moments use it.
- **The cage dance** (D3): the Gilded Cage's empty birdcage. The fast way down to a negative rep.
- **A drug stash on a rooftop** (F round 2): perch to take it; intoxication plus a memory flash.
