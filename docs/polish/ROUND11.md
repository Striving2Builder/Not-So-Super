# Round 11: the four-track pass (started 2026-10-11)

The director (the main thread) runs this round as a self-paced `/loop`. Each tick: read this file, act
on the protocol below, update the board. A new thread can pick the round up from this file alone (plus
[STATUS.md](STATUS.md) for the standing decisions).

## The ask (user, 2026-10-11)
Polish the game toward AAA superhero open-world quality (LEGO Batman, Arkham Asylum) **as an HTML5
game on a phone**, keeping performance, speed and gameplay in mind, and keeping our comic-book look.
Four tracks, each with its own builder and its own harsh critic. A track isn't done until its critic,
judging blind side-by-side against the AAA games, is wowed (the bar is below).

1. **Tech debt (T):** one or two rounds. Remove the 2D club fallback (v2) and the old premade clubs (v1).
2. **The 10-minute club loop (L):** the club infiltration is the heart of Act 1, so make it the best part
   of the game. Polish the moment-to-moment feel (danger, stealth, close calls) before adding modes.
   Videos stay at its heart, but the player must never be stuck in a loop they can't act on.
3. **Every club visit different (V):** vary events, objectives, NPC behaviour and layout per visit.
   Build cases from templates (a suspect, a clue type, a twist) instead of writing each by hand. Eight
   visits should feel like eight stories.
4. **Travel worth doing (F):** the impostor sightings are the right idea. Give flight more moments like
   them, so the time between markers is gameplay, not commuting.

## Standing rules for every builder (on top of STATUS.md's standing decisions)
- **Phone first:** 844×390 landscape, touch. Perf budget ≤5% fps vs the track's round-start baseline on the
  harness (SwiftShader: compare runs on the same machine, alternate A/B, never against a phone). Gate
  anything costly on `quality()` (`high` / `balanced` / `saver`). No new runtime dependencies, no CDNs.
- **Story through video (user):** never shrink, hide or move the LIVE panel or the green-screen videos.
- **Clips (user + director line):** new code plays only the hand-checked list in `src/club3d/clips.js`.
  Never add a clip to it without full-size frame checks. Never touch the user's own clip wiring
  (billboards, capture TV, city feed, sedation folders) or delete or rename any file under `assets/`.
- **No dead ends (user, round 11):** any failure state must hand control back within ~8 s (skip or
  struggle), and repeated failure must change the situation (new room, new route, thrown out) instead of
  replaying the same lock. The struggle itself stays interactive and winnable on touch.
- **The camera (user):** the flight chase camera stays as it is.
- **Comic style stays:** ink, halftone, POW!, yellow captions. We chase finish, not photorealism.
- **Saves:** don't break `state.js` saves; add fields with defaults.
- **Commits:** commit WIP often on your branch, with `docs/polish/handoff/<track>-r11.md` (done / in
  progress / next / best shots / perf numbers, under ~40 lines) updated in every WIP commit.
- **Don't move files** this round (only the tech-debt track deletes files). Split a file past ~800 lines.

## File ownership (edit only your files; tiny hooks elsewhere are OK, list them in your report)
| Track | Owns |
|---|---|
| T tech debt | `src/main.js` zone flow (club version switch, `modeFor`, `startZone` fallback); `src/clubzone.js` premade-club loading (the `ClubZone` base stays: the asylum and the hotel use it); `src/clubdress.js`, `src/clubmood.js`, `src/nightcase.js` if dead; `src/nightclub/*` except `cases/` and anything v3 imports; premade-only lines in `data.js`, `overworld.js`, `settings.js`, `special3d.js`; `tools/` scripts for the premade clubs; README and ARCHITECTURE.md |
| L club loop | `worktree-agent-acf0df8fc46297e1d` | 1 done | **L-2: NOT YET**: 2/8 (1 win, 1 tie), 3 / 6.5 / feel 5.5 (L-1 was 0/8, 2.5 / 6 / 5.5) (`critiques/r11/L-2.md`) | **merged** (L2a 42a6e7f, L2b a18038b; round 1): readable bouncer states, tension layer, CCTV on the screens, takedowns, self-talk, touch struggle winnable on hard; 21/21 flows, 0 errors, calls/tris flat. Phone-check: CCTV washed out by stage lights; X-ray tag can sit on her head |
| V club variety | `src/club3d/`: `plan.js`, `events.js`, `casework.js`, `chatter.js`, `backrooms.js`, `office.js`, `vip.js`, `rooms.js`, `build.js`, `dressing.js`, `vices.js`, `undercover.js`; `src/nightclub/cases/`; new `src/club3d/casegen.js` (+ data files); `CLUB_CASE_LABELS` in `data.js`; `clubCase` in `overworld.js` |
| F travel | `src/overworld.js` (not the camera), `src/airevents.js`, `src/paparazzi.js`, `src/nav.js`, `src/flightmarks.js`, `src/flightfx3d.js`, `src/polaroids.js` strays, the sightings in `src/act/act.js`, `src/airspace.js`, `src/flightaudio.js`, new flight-moment files |
| D device fixes (2026-10-14) | D1 `src/club3d/struggle.js` · D2 `src/club3d/danger.js` (+ `formKnot` in `casebeats.js`) · D3 the cages in `build.js` + `story.js` · D4 `src/cape.js`, `src/capefly3d.js`, `src/herolook3d.js`, `src/hero3d.js` · D5 the camera in `club3d.js` `render()`, `zonekit.js` camera constants, the crowd dither in `crowd.js` |
| director | `style.css` (append per-track blocks headed `/* === r11 <track> === */`), `ui.js`, `comic.js`, `index.html`, `settings.js` (additive keys), `sfx.js` (additive), this file, STATUS.md |

L and V share `src/club3d/`. When V needs a per-visit knob in an L file (bouncer style, crowd density),
it adds a tiny read of a `visit.profile` field and lists it; L owns the behaviour.

## The wow bar (what "done" means for L, V and F)
A fresh critic each round, harsh, image-only. It sees only the blind folder and the strips folder, never
the code, the answer key or earlier critiques. It's told that one image in each pair is an HTML5 game
running in a phone browser and the other a shipped AAA game. It's also told that the comic ink and
halftone, the LIVE video panel and the green-screen videos are intentional.
1. **Blind pairs (8):** ours vs the track's AAA pool, cropped to the phone aspect (`tools/shots/blind.py`).
   For each pair the critic answers: which one is the HTML5 game (and its confidence), and **which one
   looks better, allowing that one runs in a phone browser** (A / B / tie).
2. **Moment strips:** contact sheets of 6–8 frames from the track's key moments, plus one plain-language
   line per moment saying what the player does and sees. Scored for feel: readability, juice, tension,
   and whether the player is ever stuck without a choice.
3. **Scores:** vs AAA (raw), vs the best HTML5/WebGL games, feel (strips), and a verdict:
   **WOWED** or **NOT YET**, with ranked fixes (most impact first, each with its cheapest browser-feasible
   version).

**Done** = the verdict is WOWED, ours is better or tied (HTML5-adjusted) in ≥6/8 pairs, ≥9/10 vs the best
HTML5 games, feel ≥8.5/10, and the gate holds: 0 page errors, fps within budget, no flow broken.
**T** is done when v1 and v2 are gone, every harness area runs with 0 errors, and a harsh regression
critic, comparing before/after frames of the club, flight, asylum and hotel, finds nothing broken.

**If a track stalls** (no score gain over two critic rounds), the director changes its approach (a
fresh builder with a new angle, or splitting the work) instead of re-sending the same fixes, and tells
the user.

## Reference pools (local only, git-ignored; absolute paths, since worktrees don't have them)
- Club (L, V): `C:\Users\ngnic\Documents\App Projects\Sandbox - Top Down Super Flying Game\docs\references\club3d\`
- Travel (F): `...\docs\references\travel\`
- Each folder's README lists the game, what the shot shows, and the source.

## Critic packs (each builder delivers one per round, from its own worktree)
- `node tools/shots/<track harness> --label r11<track>-<n> ...` → `shots/r11<track>-<n>/<area>/*.png` (the
  stills for the blind pairs: at least 12 phone frames, 844×390, the best views and moments).
- Strips: `shots/r11<track>-<n>/strips/*.png` (contact sheets via `tools/shots/sheet.py` or an equivalent),
  plus `strips.md` with one line per strip.
- The director builds the blind pairs with
  `python tools/shots/blind.py <area> <label> --pairs 8 --refs <absolute pool parent>`, run from the
  builder's worktree, and copies the strips beside them. The answer key goes to the worktree's
  `shots/keys/`. Critic reports go to `docs/polish/critiques/r11/<track>-<n>.md` on phase-2.

## Harness ports
T 8911–8919 · L 8921–8929 · V 8931–8939 · F 8941–8949 · director and critics 8951–8959 · D 8961–8969.

## Director protocol (each loop tick)
1. Read the board. For each running agent that has reported: review its report and handoff, merge its
   branch into `phase-2` (`--no-ff`), run the area harness (0 errors, perf within budget), look at frames.
2. When a builder round lands: build the blind pairs and strips, then launch a fresh critic. When the
   critic reports: record the scores on the board. NOT YET → the ranked fixes become the next brief for a
   fresh builder (pointed at its branch and handoff file), or a resume message if it's nearly done.
3. Waves: at most 3 builders at once (usage limits), plus critics and scouts.
4. After merges: push `phase-2`. Publishing to `main` and the `testdrive-*` tags only when the user asks.
5. Keep this board current after every merge or decision. Stop the loop when every track is done.

## Board (2026-10-15: track D phone-tested OK; wave = V-1 critic + L2a + F2a)
| Track | Branch | Round | Last critic | State |
|---|---|---|---|---|
| T tech debt | `worktree-agent-a047ac9311b1f985f` | 1 done | n/a (regression pack `shots/r11T-pack/`) | **merged** (78030b3): v1 + v2 gone, -6,052 lines, -176 KB JS at startup, 0 errors in every area |
| F travel | `worktree-agent-a4e919b8e12914483` | 1 done | not yet run | **merged** (a6f223a): moment director, air events in 3D, impostor rooftop chase. **F-1: NOT YET**: 1/8 (tie), vs AAA 3, vs HTML5 6, feel 4; commute ~85% dead air (`critiques/r11/F-1.md`) **F-3: NOT YET**: 1/8 (hoops), 3 / 6 / feel 5 (F-1 4, F-2 4.5); commute ~50% dead air (`critiques/r11/F-3.md`) |
| L club loop | `worktree-agent-acf0df8fc46297e1d` | 1 done | **L-2: NOT YET**: 2/8 (1 win, 1 tie), 3 / 6.5 / feel 5.5 (L-1 was 0/8, 2.5 / 6 / 5.5) (`critiques/r11/L-2.md`) | **merged** (L2a 42a6e7f, L2b a18038b; round 1): readable bouncer states, tension layer, CCTV on the screens, takedowns, self-talk, touch struggle winnable on hard; 21/21 flows, 0 errors, calls/tris flat. Phone-check: CCTV washed out by stage lights; X-ray tag can sit on her head |
| V club variety | `r11-variety` | 1 done | **V-1: NOT YET**: 0/8, vs AAA 2.5, vs HTML5 5, feel 4, variety 3 (`critiques/r11/V-1.md`) | **merged** (a17368d): casegen (8 suspects × 6 clue types × 5 twists), crowd scandal beats (shots, gotcha selfie, planted glass, ringed in, GONE WILD? headline, snapper, morning paper); 8 gen + 21 old flows, 0 errors; +0.8% calls, +5-10% during a beat. Weak: the knot is hard to read at phone size |
| D device fixes | D1 (748f379), D4 (4d2bff6), D2+D3 (1dc374b), D5 (ee53a17) merged | **done; phone-tested OK by the user 2026-10-15** | n/a (the user's phone test) | **queued 2026-10-14**, from the user's device test: D1 S-shield struggle, D4 Supergirl look (wave 1); D2 idle crowd + D3 cage dance (one builder), D5 camera distance setting (wave 2). Specs under "Device test fixes" below |
| refs scout | done 2026-10-13 | n/a | n/a | **built**: `club3d/` 12 (Hitman ×4, Cyberpunk ×2, GTA V, Yakuza ×2, LEGO ×2…), `travel/` 12 (Spider-Man, Arkham Knight, LEGO); all ≥1280 px. Gaps: no Hitman club/Iceberg Lounge, few dancefloor-with-guards shots, mostly daytime travel |

## Next (in order, each one a small fresh agent from its handoff file)
0. **Device test fixes first (user, 2026-10-14; specs below).** Wave 1 = D1 + D4 (no shared files).
   Wave 2 = D2 + D3 as one club-floor builder, alongside D5. Then a `testdrive-*` tag for the phone (on the
   user's go). Then resume at step 3 below.
1. ~~Merge L~~ done 2026-10-13.
2. ~~Reference pools~~ done 2026-10-13 (README sections in `docs/references/README.md`).
3. **First blind critics** (L done: see L round 2 below) for L and F (one fresh critic each, 8 pairs + strips): needs each track's critic
   pack (`club3d.js --label r11L-<n>`; `travel.js --label r11F-1` + `--commute --secs 180 --every 6`).
3b. **L round 2** (fresh builder from `loop-r11.md`, after V merges: both in `src/club3d/`), from L-1:
   1) ~~crowd dither~~ moved to D5 (2026-10-14);
   2) crowd variety: 8-tone palette lifted off black, 3-4 head/hair variants, scale/lean, phase offsets;
   3) floor: beat-tinted LED tile canvas texture, light pools, blob shadows (the KO'd bouncer floats);
   4) ~~cape clamp~~ moved to D4 (2026-10-14); 5) "spotted" as an event: clear
   bubbles/tips, brief slow-mo, red vignette, CCTV of her on the stage screen, "LOST THEM" stamp;
   6) show the grab in-world before the struggle panel; 7) HUD diet: "GET CLOSER" overlaps the title
   card, one transient layer at a time, slim stat bars; 8) X-ray: nearest 3 tags, de-overlap, icons,
   beacon on the clue; 9) cheap bloom on emissives (quality-gated); 10) dress the DJ booth + sign.
4. ~~V round 1~~ merged 2026-10-13. **V-1 blind critic** next (8 pairs from `shots/r11V-1/club3d/gen*`).
   **V round 2** (after L2a merges: it needs the phone-up pose), from V-1 ("one story, new names"), ranked:
   1) beats per twist: the snapper only when the photo is real; one new beat each for setup / planted /
   lookalike (the knockoff on a club screen); no beat in every visit (the "One shot with us!" one is in all);
   2) the morning paper: its photo = a grab of the real gotcha frame (no green placeholder circle), ≥6
   headline templates; 3) stage beats in 3D (phones up, flashes, the glass in her hand, the snapper running)
   instead of dialog boxes; 4) per-venue fog + light colour + one landmark prop; 5) vary the pacing and the
   case board (every visit closes ~16 s with 1 clue; gen5 = gen8 frame for frame: seeds must differ);
   6) real venues for generated leads. Her readability in the crowd (ink silhouette through figures,
   replace the dither band) goes to L2b (crowd.js / the camera are L's).
5. **F round 2** (from F-1, ranked): 1) the black box bottom-right = a video panel with no frame yet
   (likely headless Chromium can't decode the clip; check on a phone). Fix with a poster frame / ink
   placeholder until `playing`; never hide, shrink or move the panel (user rule). 2) spawn moments in a
   ±35° cone ahead, 80-160 m out, beacon pillar + big outlined target (car, faller, hoops, kitten were
   never in frame). 3) flight-native beats every 10-15 s (updraft ribbon, 3-hoop gate, blimp/birds,
   skim bonus); offers as a flare she flies into. 4) speed lines + FOV kick on BOOST (lens, not camera).
   5) one toast at a time. 6) land wins/losses (freeze + SAVED!/ESCAPED! panel). 7) streamlined cruise
   pose, 15% smaller. 8) facade repulsion + fade. 9) directional captions. 10) daytime city texture.
   Plus Act 2's first flight piece (docs/design/act2.md): a drug stash on a rooftop, as one of the
   flight-native beats (perch to take it: intoxication + a memory flash on the LIVE feed).
   Harness first: in `--commute` the bot stays perched after a won rescue (kitten), so a
   180 s run logs no offers; `impostor` was "never offered" in the full run but won with `--only faller,impostor` (run-order/act state). Then courier-van tail (trail + warehouse gate), Polaroids blowing off a roof, super-hearing
   street rescue, Puzzle Maker riddle chain, news chopper; check the impostor's knockoff colours.
6. **T round 2:** split `overworld.js` (1,103 lines) and `brawler.js` (911); renames (clubzone →
   building engine, `NightCase` → asylum's); harness tidy (`premade3d` → `clubs`).
7. ~~Ask the user~~ deleted 2026-10-13 (user OK): the 28 MB of assets (`assets/clubs/*`, 2 plates; list in
   `docs/polish/handoff/tech-r11.md`)?

## Device test fixes (track D, from the user's device test, 2026-10-14)
One small fresh agent per job (credit-lean rules below), handoff `docs/polish/handoff/d<n>-r11.md`,
done = the listed harness flows with 0 errors, perf within 5%, frames in the handoff. The user owns
the crowd's text arrays (`GROPE`, `LAUGH`, `SHOT` in `danger.js`; `ATMOS`, `REACT` in `chatter.js`;
the beats' lines in `casebeats.js`) and may edit them by hand: add new lines, never rewrite theirs.

- **D1 S-shield struggle** (`struggle.js`, a `/* === r11 D === */` style.css block). The pad is the S
  on her chest, cropped from the user's photo: `assets/ui/s_shield.webp` (source:
  `docs/references/user/sg-classic-greenscreen.jpg`, local). It takes the ring's spot and footprint;
  never cover more of the clip than the ring did. The photo is soft (~234×160 source px), so a crisp SVG
  ink guide sits on top: the S stroke as a ~40-point polyline fitted to the photo, a glowing start dot,
  a trail that fills as she traces. A trace scores while the thumb stays inside a corridor (~14% of the
  pad) moving forward along the S; either end can start. Each full trace: "I'm Supergirl!" (bubble,
  jolt, punch sound). Off the corridor or backtracking: "No… never… you won't get away with this." and
  only that trace resets (finished ones stay banked); standing still drains the current trace. Lines
  in `SAY_WIN` / `SAY_MISS` at the top. Same `struggle()` API (callers: story.js, sedation.js,
  flashpoint.js, hotel.js, ballroom.js). Normal 3 traces / 12 s, hard 4 / 14 s, winnable on touch;
  keyboard keeps the WASD roll. `window.__struggle` gains `trace()`. Flows: a synthetic S-trace wins
  normal and hard; club3d.js + act.js.
- **D2 The crowd closes in when she stands still** (`danger.js`; generalise `formKnot` in
  `casebeats.js` so it runs outside generated cases). After ~4 s still on the floor (not dancing, not
  in a room, not busy) the nearest 4–8 dancers drift into a ring, phones up; the longer she stands the
  faster the incidents (up to ~2.5×): more SNAP/FLASH, skirt flips, hands, fans/paparazzi cards in the
  envelope. Moving ~1 m breaks the ring (no dead end). A skirt flip calls D4's `flip()` if merged.
  Tunables `DANGER.idle { after, max, faster }`; new lines in an `IDLE` const by `GROPE`. Flow: `idle`.
- **D3 Cage dance (the Gilded Cage)** (`build.js` cage door, `story.js`; reuse `vip.js danceGame`).
  The empty cage (index 0, door open): "Dance in the cage" → onto the plinth, the door swings shut,
  the crowd gathers with phones, the on-the-beat dance. −8 rep (`CAGE.rep`), a dance card, a LIVE feed
  line. Tap to step out any time; again after 20 s; the bouncers ignore her while caged. Act 2's fast
  way to a negative rep (docs/design/act2.md). Flow: `cage`.
- **D4 Supergirl look** (`cape.js`, `capefly3d.js`, `herolook3d.js`, `hero3d.js`). Cape to mid-back in
  the zones (`LENGTH` 1.02 → ~0.5 m, narrower hem) and in flight (`CAPE.len` and the boost/dive length
  bumps ~halved), plus the L-1 lift clamp (~70°, damped); `?cape=long` keeps the old one. Shorter skirt
  on every costume, Dark the most (per-skin amounts): at load, move the skirt-rect vertices (`SKIRT.uv`,
  the same atlas on every skin) toward the waist. **Target (user, 2026-10-14): a bit shorter than the
  photo**, upper thigh, because in game it reads longer than it is; one tunable per skin, corrected
  from the user's phone feedback.
  Check first that legs exist under the skirt; if not, do it in Blender (sg_blender / dark_blender
  step) and flag it. Skirt flutter: a vertex-shader sway on the skirt's lower half (same UV mask),
  driven by the cloth cape's wind (`M.setWind`) and flight speed, plus a `flip()` impulse. Shots: hero
  lab (front/side/back, supergirl + dark), flight, club.
- **D5 Camera distance setting, every 3D zone** (`club3d.js` `render()`, `zonekit.js` `CAM_DIST` /
  `CAM_PITCHES`, the crowd dither in `crowd.js`; director hooks in `settings.js` + the pause menu).
  **Camera: Far (today, default) / Medium / Close / Closest**, saved, `?camdist=`. A multiplier on
  `CAM_OPEN` / `CAM_CROWD` / `CAM_HUNT` and the zones' `CAM_DIST`: Closest ≈ 2.6 m, pitch lower but
  ≥ ~0.35 rad; hunted still eases out. Same fixed angle and controls (not over-the-shoulder: that's a
  later job if the phone test asks for it). The L-1 crowd dither moves here (figures between camera and
  her fade out). Perf: measure each step; >5% → thin the far sprite crowd at that step on
  Balanced/Saver. Flight's chase camera untouched. Flows: club3d + act.js at Far and Closest.

## Credit-lean process (lessons from round 11; applies from round 12)
- **Never resume a long builder transcript** (a resume re-sends its whole history: track T alone used
  ~620k tokens). Start a fresh agent pointed at the branch + handoff file instead.
- **Small jobs, not whole tracks:** one milestone per agent (e.g. "wire the courier tail + 0 errors"),
  with a token budget in the brief: commit + update the handoff + report at ~150k tokens, whatever
  state it's in.
- **Effort and model by job:** default effort for builders; `max` only for a hard bug or the critic's
  judgement; sonnet for scouts, harness runs and mechanical cleanup.
- **The director runs harnesses itself** (plain shell, no model tokens) and reads only final reports of
  ≤25 lines; builders put detail in the handoff file, not the report.
- **Images are the expensive tokens:** builders look at ≤6 frames per iteration and prefer one contact
  sheet over many PNGs; critics get exactly 8 pairs + ≤5 strips.
- **Knowledge passes through files:** the handoff (≤40 lines: done / next / numbers) plus
  `docs/polish/LEARNINGS.md` (harness quirks, gotchas; append-only, one line each). A critic's report is
  distilled by the director into a ≤20-line ranked fix list that becomes the next brief.
- **One round per director thread:** start it with "Continue round N: read docs/polish/ROUND11.md".
- **At most 2 builders at once** near the monthly limit; long builds can go to cloud sessions
  (docs/polish/CLOUD.md) on cloud credit.

## Log
- 2026-10-11: round planned. Wave 1 = T, L, F and the reference scout; V starts once T is merged (both
  touch the club's case files).
- 2026-10-11/12: the monthly spend limit stopped every agent three times mid-work (no work lost: all in
  worktrees). User: finish the build, identify the next, pause. T, F and L merged and pushed; loop paused 2026-10-13.
- 2026-10-13: resumed. Running: the refs scout (step 2) and V round 1 (step 4, pulled ahead of the critics,
  which need the pools). User's new ask folded into V: at the club's story beats, a crowd closes in on
  Supergirl (fans pushing drinks to get her tipsy, phones up, posing for gotcha shots), and a tabloid
  storyline about catching her "being naughty" whose photo can be real, fake (staged, lookalike,
  doctored) or a setup. PG-13, no new clips. Next: step 3 critics for L and F once the pools land.
- 2026-10-13: refs pools built; L-1 NOT YET (0/8, 2.5/6/5.5); F-1 NOT YET (1/8, 3/6/4); V round 1 merged.
- 2026-10-14: the user's device test → track D (5 jobs, specs above), first in line. The user drafted
  Act 2: docs/design/act2.md (boss = the impostor cult's leader in Supergirl's stolen suit; 5 finds per
  suit piece; the crop top built in Blender from the user's reference image). Pulled early: the S-shield
  struggle (D1), the cage dance (D3), a rooftop drug stash (F round 2). Waiting on the user's go for wave 1.
- 2026-10-14: user: Act 2 waits (images, cult leader, drugs still to come); cult look refs saved; skirt a bit
  shorter than the photo. Wave 1 launched: D1 (S-shield struggle) + D4 (cape, skirt, flutter).
- 2026-10-14: D4 merged (4d2bff6): cape to mid-back (zones 0.5 m + lift clamp; flight 5×0.12), skirt hem at upper
  thigh (`SKIRT_TRIM` in herolook3d.js: 0.12 m, dark 0.135; `?skirt=`, `?cape=long`), blue briefs under it on
  Classic/Ponytail/Dark, skirt flutter morphs + `heroModel.flip()` for D2. Club rave 0 errors; calls/tris flat.
- 2026-10-14: D1 merged (748f379): the S-shield struggle. The thumb draws its S anywhere (relative, its size
  learnt per trace) and a bead follows the S on a 156 px shield in the ring's spot: tracing ON a pad that
  small failed real-thumb tests. Phone question for the user: clear enough, or a big centre shield (would
  cover part of the clip)? Director: shield clip fitted to the photo's curved edge (no blue sliver);
  club3d.js `touch`/`caught` flows finish S traces via `__struggle.trace()` (0 errors).
- 2026-10-14: D2+D3 merged (1dc374b): idle ring (`DANGER.idle`, `IDLE` lines), the knot outside generated cases
  (`knotHost()`), the cage dance (`CAGE`, `CAGE_SAY`; -8 rep, feed plays CLIPS.shame). idle/cage/sedate 0 errors
  on the merge. Open: the ring reads as "more people" in a packed rave (V round 2's phone-up pose); early
  step-out still costs the full 8; the beat window needs a phone.
- 2026-10-15: D5 merged (ee53a17): Camera Far/Medium/Close/Closest (`camDist` setting, `?camdist=`; pause menu in
  main.js), crowd dither; every step within ±3% calls/tris. Smoke test on the merge, 0 errors: club (rave, pit,
  idle/cage/touch/caught/talker/stealth), act.js (11 flows), flying (11), brawler (5), 3D rooms at Closest (4),
  investigations (12). Published to main as testdrive-2026-10-15 (user asked). Next after the phone test:
  step 3 (V-1 critic), L round 2 (trimmed), F round 2, T round 2.
- 2026-10-15: user's phone test of testdrive-2026-10-15: S-shield struggle fine (swipe the S anywhere); skirt + cape
  OK, leave them; idle ring OK but too many messages at once (chaotic, "I guess that is the point": L2b caps
  overlapping bubbles, never edits the user's lines); cage dance fine; camera distance works at every step, Close
  feels best (3D zones only: flight's chase camera stays, by the user's rule). Go: run the rest of round 11.
  L round 2 and F round 2 split into two small jobs each (credit-lean). Wave: V-1 critic (pairs built in the
  r11-variety worktree, `shots/blind/club3d-r11V-1/` + 5 strips), L2a (the look: crowd variety + phone-up pose,
  floor, DJ booth), F2a (harness fixes, video placeholder, cone spawn + beacon, one toast, win/loss panel, boost
  speed lines). Next: L2b (the feel: spotted event, grab in-world, HUD diet + bubble cap, X-ray, CCTV, bloom),
  F2b (flight-native beats, cruise pose, facades, captions, new moments), V round 2 (after V-1 + L2a), T round 2.
- 2026-10-15: V-1 NOT YET (0/8; 2.5 / 5 / feel 4 / variety 3): the 8 visits read as one story reskinned. V round 2
  brief rewritten in Next step 4; her silhouette in the crowd added to L2b.
- 2026-10-15: F2a merged partial (26553c4, budget hit): in-frame spawns (±35°, lead, beacon, 2× targets), one toast at a
  time (+ director: `clearToasts()` on zone change), verdict panels, harness commute fixes. Smoke on the merge: travel
  impostor/faller won, rings lost (bot); club rave touch/caught/idle; 0 errors. The black box is in the WebGL canvas
  (not the video panel). F2a-finish running: black box, bot tuning, perf A/B, critic pack r11F2a.
- 2026-10-15: L2a merged (42a6e7f): crowd colour/hair/heads/scale/lean, phone-up pose (`p.phone`), LED floor + pools + blob
  shadows (`floor.js`), dressed DJ booth (`booth.js`); +1-1.5% calls, +2.3-2.6% tris over 5 rooms. Merge smoke: rave +
  centre, stealth/touch/caught/idle/cage, 0 errors. Pack `shots/r11L2a/` in its worktree. Still mannequins (stick
  limbs, plain heads); idle-ring bubbles overlap (as the user saw). L2b launched.
- 2026-10-15: the monthly spend limit stopped L2b and F2a-finish mid-work (user: resume). F2a-finish merged (3dfb474):
  black box fixed (Chromium skipped the GL canvas in the LIVE video's mirrored rect; `#feed video` no-op filter), bot
  plays car/rings/kitten/faller to wins with approach frames, commute boosts; flybench ±3.5% (noise). The director runs
  its critic pack (r11F2a + 180 s commute). L2b: WIP saved (b10883d, unverified); the director runs its flows, then a
  fresh agent finishes from `handoff/l2b-r11.md`.
- 2026-10-15: r11F2a pack on phase-2: all 7 moments won, 0 errors. 180 s commute: 3 offers in the first 68 s (rings,
  impostor, kitten: ~1 per 20 s), then the bot sat perched from 72 s (the post-rescue perch bug is back in `--commute`:
  F2b fixes it first). The critic's commute strip is cropped to 0-66 s. F-2 critic running. L2b flows by the director
  on b10883d: 6/6, 0 errors, calls +3-4%; idle-ring bubbles still overlap, near-lens ring members fill the frame.
  L2b-finish running (~120k budget).
- 2026-10-15: F-2 NOT YET (1/8 tie; 3 / 6 / 4.5, was 3 / 6 / 4): small gain only; one more flat round = stalled (change
  approach + tell the user). Targets still never in frame (car never visible; its win is a +7 REP toast). The harness
  saved the same getaway frame as approach and close (pair2_B = pair8_B). F2b brief (ranked): perch bug in --commute;
  target in frame (1.5× more, ink outline + halo, screen-edge arrow, a lens FOV widen while one is in reach); payoff on
  screen (grab freeze, car lifted, washer in her arms, wig flying, UNMASKED! panel instead of the Continue box); one
  message lane during a moment (mute ticker/captions, toasts off the banner, captions clear of the joystick); threat
  before the clock (rig snaps, a crosswalk for the car, one miss + recovery); speed (speed lines visible, wind streaks,
  near-miss pop); next offer 6-8 s after a resolution; the brown lump on roofs; key hints on touch. F2b launched.
- 2026-10-15: F2b merged (db0c7b6): halo + edge arrow + lens widen, payoff (car overhead, washer in arms, wig, UNMASKED!
  panel), one message lane, perch fix; flybench ±2%; act 11 flows + club 0 errors. Car still not in frame on approach.
  L2b-finish merged (a18038b; style.css: both blocks kept): bubbles ≤2 and apart, ring on her far side; +0.9% calls, +2%
  tris. L-2 NOT YET but up: 2/8, 3 / 6.5 / 5.5. **L round 3 brief** (from L-2, ranked): 1) the foreground dither reads as
  a glitch: bodies between the camera and her = flat dark ink silhouette ~35% + outline, halftone only near her, hide
  meshes within ~2 m of the lens (bouncers too); 2) bouncers read as threats: shades + earpiece, black SECURITY tee,
  1.15×; 3) the grab: hand meshes on her arm, a real 0.3 s dip, ONE stamp per beat (BUSTED!/GRABBED!/BREAK FREE!/SHAKEN!
  land in ~3 s); 4) chase: no clue bubbles/tips while alert, heartbeat on the red edge, LOST THEM! 6-8 s after out of
  sight; 5) idle escalates (ring shrinks, flashes up, "That's HER!" ~5 s, a bouncer turns with ? ~8 s; she can always
  leave); 6) X-ray darkens the crowd (not deletes), chips 2×, beacon in a safe inset; 7) a real CCTV cut (128 px second
  camera + REC); 8) one tutorial/TIP/NEWS at a time; 9) stats panel 85% fill; 10) 3/4 camera at the DJ booth.
- 2026-10-15: F-3 NOT YET (1/8; 3 / 6 / 5). **F stalls on pairs and vs-AAA over 3 critics (feel +0.5 each): approach
  changed** (rule "If a track stalls"; user told). The critic could not see what F2b reported built: no car overhead, no
  chopper under her, the washer halo circling an empty wall, a giant floating kitten (pair 7). New approach for F2c =
  verification first: the builder looks at a frame for each payoff/target before claiming it, the harness captures the
  hold frame, and the director checks a sheet before any critic. F2c brief (from F-3): 1) payoff on her body (car /
  chopper / washer in her hands ~2.5 s, panel held until it's on screen); 2) target in frame before the halo (spawn at
  cruise height ahead; halo only when the target projects on screen, else the edge arrow; fix the kitten's scale); 3) gaps
  between offers ≤15 s with cheap route content (hoop strings, slipstream ribbons, pigeon flocks, smoke plumes); 4) every
  moment ends on an inked panel (washer had a toast, getaway nothing); 5) mute MEANWHILE / closing-time / new-case toasts
  during a moment. V2 launched (builder) with F-3 (critic).
- 2026-10-15: the spend limit stopped V2 and F2c again (user: resume). Both nearly done; all work committed (director
  saved F2c's last route.js edit). V2 (`worktree-agent-abbacccd4eff984fb`): beats per twist (runner roles: booth / double /
  breakout; snapper only for a real photo), seeds differ (pace, need 5-7, titles + headlines, venues), real-frame paper
  photo, flashes/glass/beat camera push, per-venue fog + landmark (`venue.js`), generated leads at real venues. F2c
  (`worktree-agent-a638615b8eaae9db4`): payoff in screen space round her (proof frames in its handoff), LOS halo, washer
  on the facing facade, route content every 5-7 s (`route.js`), one text lane. The director runs both packs + V2's
  regression itself, then merges, then the critics (V-2, F-4).
