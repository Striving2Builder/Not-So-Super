# Round 11, track V (club variety): handoff

Branch `r11-variety` (from phase-2 a210550). Brief: docs/polish/ROUND11.md (V) + the user's 2026-10-13 ask
(crowd round her at the story beats: shots, phones, "gotcha" posers; the tabloid scandal, real or fake).

## Done
- `src/club3d/casedata.js`: 8 suspects (vlogger, fired publicist, councilman's aide, promoter, rival
  influencer, superfan, bartender in debt, the knockoff's handler), each with venue (main room), crowd
  profile (density, knot size, pushiness, difficulty), event pool, facts, talk, rumour, lead; 6 clue
  types (texts, prints, paper trail, loose talk, UV, X-ray); 5 twists (real, planted drink, lookalike,
  doctored, setup), each with beats, objective, proof spot, headline.
- `src/club3d/casegen.js`: `makeCase(seed)` → same shape as the hand-written cases (+ `gen`); 4th
  accusation question "what really happened?"; `genLabel(seed)` for the map. Seeds 1–8 = 8 suspects,
  6 clue types, 5 twists.
- `src/club3d/casebeats.js`: the knot (nearest dancers close to a ring north of her, lit, phones up on one
  instanced mesh, SNAP!/FLASH POWs), beats shots / selfie (gotcha poser) / push (planted glass) / trap
  (ringed in) / headline (LIVE feed plays CLIPS.press captioned with the headline, banner, caption, POW),
  the snapper (runs to a side room, moves room if she's tipsy or walks off), proof → "IT'S A FAKE!",
  the morning paper on solve. Every choice answers itself in ≤7 game-s; refusals make the next knot pushier.
- Hand-written cases unchanged (`?club3case=squirt` etc. and map labels still play them).

## Hooks outside V's files (tiny)
- `club3d.js`: import + mixin `beatMethods`, `startBeats()` in enter, `stepBeats(dt)` after stepStory,
  crowd count × `caseDef.gen.profile.crowd`.
- `overworld.js clubCase` (V-owned): half the club missions (all once hand-written are solved) → `gen:<seed>`.
- `casework.js` (V): gen case pick, `onGenClue`, `genObjective`, `genSolved`.
- `tools/shots/club3d.js`: `--gen a-b` flow.

## In progress / next
- Critic pack r11V-1 (see numbers below); read the strips, then tune readability of the knot (dancers
  can't raise phones: crowd.js pose is L's; a `p.phone` pose flag there would sell it).
- The lookalike twist could show the knockoff on a club screen (act/spot.js `impostorize`).
- Generated-case leads are `street` leads; give them proper venues later.

- **Weakest point (seen in strips gen2/gen5):** the knot doesn't read at phone size. Near-camera dancers
  hide it and the dancers can't hold phones up. Next: a closer camera during a beat, or pull the knot
  members in front of the foreground (L owns crowd.js / the camera).

## Numbers
- Base r11V-base (5 rooms, entrance + crowd): 2318 calls / 3.82M tris. r11V-1: 2336 / 3.82M (+0.8%,
  hand-written case; noise). During a beat: about 190–233 calls vs 184–217 for the crowd view (one NPC +
  one phone mesh, only while the beat runs).
- r11V-1: 8 gen flows, 0 failed, 0 page errors (shots/r11V-1/club3d/gen*_*.png = 9 phone frames per seed;
  strips/gen1..8.png + strips.md). r11V-reg: the 21 existing flows, 0 failed, 0 errors.
- Best shots: gen8_3_headline, gen2_1_trap, gen3_1_push, gen5_8_snapper, gen1_9_paper.
