# Act 2: The Cult in Her Suit (working title)

Status: **draft, 2026-10-14.** Nothing is built yet except the pieces pulled forward into round 11
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
runs the paparazzi show and sells the enhanced cut. Name: open (the user's call).

**The impostor cult.** **(user)** Many women in knockoff suits. They do the promotions, cut the ribbons
at grand openings in the red-light, nightclub and naughty districts, and pose for every camera. Their
reputation moves opposite to hers (below).

**The cult's look (user, 2026-10-14, "the cult characters for now").** Hooded robes and coats in
black with red and gold trim, and faceless masks: gold, white, a red demon mask, and a wraith with
glowing red eyes. References (local, git-ignored): `docs/references/user/act2-cult-*.jpg`.

**Holdovers.** Kell and the Puzzle Maker are locked up. Act 1's lieutenants can come back as
henchmen or informants until the user's own henchmen designs land.

## The drug: the enhanced cut
- **What it does:** compliance, memory gaps, ecstasy and euphoria, intoxication, nightmares **(user)**.
  Memory gaps, compliance, ecstasy and intoxication lead the story **(user)**.
- **Name:** open. Placeholder: "the new cut of K".
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
- **Opening the act:** the stolen-suit scandal costs her a big chunk of rep (proposed −150, to tune), so
  she starts closer to the line than where Act 1 left her.

## Costumes
- **The crop-top Supergirl:** her backup suit and the act's default costume **(user)**. Built in
  Blender from `supergirl.glb`, the way Supergirl_Dark was (`tools/heroskins/`, same rig, animations,
  cape and atlas layout), **from a reference image the user will supply** **(user)**.
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
- **The story:** the drug has her believing she's a working girl who dresses up as Supergirl **(user)**.
  During those memory gaps she can't use her powers **(user)**.
- **The X-ray button is still there**, but instead of working it makes her say **"What's going on?
  Where are my powers?"** **(user)** (and the same for super-hearing).
- **Supergirl costume clues** are hidden in each visit. Once she finds one, she remembers, and her
  powers come back for the rest of that visit **(user)**.
- The clues in the asylum lean on Supergirl or fake games **(user)**: the posters, the call screen.

**Investigations.** **(user)** A drug and trafficking theme, and the original costume turns up a lot
here **(user)**.

## Gates: what unlocks the boss
**(user)** X missions, X Polaroids, and the original costume at 5 finds per piece. Proposed numbers,
to tune by feel the way Act 1's were:

| Requirement | Count |
|---|---|
| Act 2 missions | **8**: 2 casino wins, 2 factory shutdowns, 1 asylum, 3 clubs or investigations |
| Cult Polaroids called right | **12** |
| Her original suit | **all 5 pieces, 5 finds each** **(user)** |

No reputation gate: the pendulum makes a fixed number meaningless. Debug params: `?act=act2` (start of
the act), `?act=act2lair` (every gate met), `?act=act2boss`.

## The hotel's new floor and the boss
**(user)** The hotel unlocks a new floor with the Act 2 boss.
- **A hall of mirrors** **(user)**: mirrored corridors and rooms, her double in the glass. The mood
  reference is the user's mirror image (2026-10-14, `docs/references/user/act2-mirror-mood.jpg`): purple
  neon tubes, graffiti, wet tiles, the reflection.
- **What's on it** **(user)**: Supergirl or Impostor games, original-costume puzzles, doing drugs, traps
  and captive moments (the S-shield struggle).
- **The boss fight** is built around getting drugged up and intoxicated **(user)**. Proposal: the
  cult leader in the real suit fights with the drug. Every hit or trap raises intoxication, and the
  mirrors multiply her and the leader as it climbs. Over the haze line, Supergirl has to pick the real
  leader out of the reflections (the call). Win and she gets her real suit back, stains and all.

## Content line (the same as round 11's crowd scandals)
- PG-13. Video only from the hand-checked list (`src/club3d/clips.js`), each clip checked at full size.
- Stains on the costume are spilled drinks, lipstick or makeup.
- Casino losses take accessories only and never go below the top and skirt.
- The identity story in the asylum is told in captions, stills and her own lines.

## What to build (phases)
Each phase is one small fresh agent with a handoff file (`docs/polish/ROUND11.md` "Credit-lean process").
Start after round 11's tracks, or in a free builder slot.

- **A. The Act 2 skeleton:** `src/act/act2.js` (gates, beats, lines), the runtime working per act,
  state fields with defaults (saves keep loading), the act board's second page, the `?act=` params, and
  Act 2 opening after `act.complete()`.
- **B. The pendulum and the cult:** the negative-rep perks (doors that only open below zero), the
  impostors' rep driving the Polaroids, promotions and grand openings as map events.
- **C. Costumes:** the crop top (Blender, once the reference image arrives and blender-mcp
  connects), the knockoff switch, the five pieces with five finds each, the act board's suit.
- **D. The casino:** the venue plan, high card and 21, the stakes (doses, knockoff pieces), the top
  and skirt.
- **E. The factory lines:** the hotel generator re-themed, 4 levers, the foreman.
- **F. The Act 2 asylum:** always high, powers lost, costume clues, the lines.
- **G. Recall and drug finds:** memory clues, flashbacks, stashes in flight, rooftops, brawls and
  investigations.
- **H. The new floor and the boss:** the hall of mirrors and the fight.

## Open questions (the user's calls)
- The cult leader's name, and the act's title.
- The enhanced drug's name.
- The numbers: the gates, the opening scandal's rep cost, the casino stakes.
- The crop top: the reference image.
- Which clubs are the "selected nightclubs" that open below zero (proposal: the three story clubs'
  districts plus one new club in the naughty district).

## Built early (pulled into round 11, 2026-10-14)
- **The S-shield struggle** (D1): the struggle becomes tracing the S on her chest, the pad cropped
  from the user's photo (`assets/ui/s_shield.webp`). Act 2's captive moments use it.
- **The cage dance** (D3): the Gilded Cage's empty birdcage. The fast way down to a negative rep.
- **A drug stash on a rooftop** (F round 2): perch to take it; intoxication plus a memory flash.
