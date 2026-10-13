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
| L club loop | `worktree-agent-acf0df8fc46297e1d` | 1 done | **L-1: NOT YET**: 0/8 pairs, vs AAA 2.5, vs HTML5 6, feel 5.5 (`critiques/r11/L-1.md`) | **merged**: readable bouncer states, tension layer, CCTV on the screens, takedowns, self-talk, touch struggle winnable on hard; 21/21 flows, 0 errors, calls/tris flat. Phone-check: CCTV washed out by stage lights; X-ray tag can sit on her head |
| V club variety | `src/club3d/`: `plan.js`, `events.js`, `casework.js`, `chatter.js`, `backrooms.js`, `office.js`, `vip.js`, `rooms.js`, `build.js`, `dressing.js`, `vices.js`, `undercover.js`; `src/nightclub/cases/`; new `src/club3d/casegen.js` (+ data files); `CLUB_CASE_LABELS` in `data.js`; `clubCase` in `overworld.js` |
| F travel | `src/overworld.js` (not the camera), `src/airevents.js`, `src/paparazzi.js`, `src/nav.js`, `src/flightmarks.js`, `src/flightfx3d.js`, `src/polaroids.js` strays, the sightings in `src/act/act.js`, `src/airspace.js`, `src/flightaudio.js`, new flight-moment files |
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
T 8911–8919 · L 8921–8929 · V 8931–8939 · F 8941–8949 · director and critics 8951–8959.

## Director protocol (each loop tick)
1. Read the board. For each running agent that has reported: review its report and handoff, merge its
   branch into `phase-2` (`--no-ff`), run the area harness (0 errors, perf within budget), look at frames.
2. When a builder round lands: build the blind pairs and strips, then launch a fresh critic. When the
   critic reports: record the scores on the board. NOT YET → the ranked fixes become the next brief for a
   fresh builder (pointed at its branch and handoff file), or a resume message if it's nearly done.
3. Waves: at most 3 builders at once (usage limits), plus critics and scouts.
4. After merges: push `phase-2`. Publishing to `main` and the `testdrive-*` tags only when the user asks.
5. Keep this board current after every merge or decision. Stop the loop when every track is done.

## Board (resumed 2026-10-13: steps 2 + 4 running, ≤2 agents)
| Track | Branch | Round | Last critic | State |
|---|---|---|---|---|
| T tech debt | `worktree-agent-a047ac9311b1f985f` | 1 done | n/a (regression pack `shots/r11T-pack/`) | **merged** (78030b3): v1 + v2 gone, -6,052 lines, -176 KB JS at startup, 0 errors in every area |
| F travel | `worktree-agent-a4e919b8e12914483` | 1 done | not yet run | **merged** (a6f223a): moment director, air events in 3D, impostor rooftop chase. F-1 blind critic running (pack `shots/r11F-crit/` on phase-2, pairs `shots/blind/travel-r11F-crit/`) |
| L club loop | `worktree-agent-acf0df8fc46297e1d` | 1 done | **L-1: NOT YET**: 0/8 pairs, vs AAA 2.5, vs HTML5 6, feel 5.5 (`critiques/r11/L-1.md`) | **merged**: readable bouncer states, tension layer, CCTV on the screens, takedowns, self-talk, touch struggle winnable on hard; 21/21 flows, 0 errors, calls/tris flat. Phone-check: CCTV washed out by stage lights; X-ray tag can sit on her head |
| V club variety | worktree agent (handoff `variety-r11.md`) | 1, running | n/a | casegen templates + the user's crowd/scandal beats (see Log 2026-10-13) |
| refs scout | done 2026-10-13 | n/a | n/a | **built**: `club3d/` 12 (Hitman ×4, Cyberpunk ×2, GTA V, Yakuza ×2, LEGO ×2…), `travel/` 12 (Spider-Man, Arkham Knight, LEGO); all ≥1280 px. Gaps: no Hitman club/Iceberg Lounge, few dancefloor-with-guards shots, mostly daytime travel |

## Next (in order, each one a small fresh agent from its handoff file)
1. ~~Merge L~~ done 2026-10-13.
2. ~~Reference pools~~ done 2026-10-13 (README sections in `docs/references/README.md`).
3. **First blind critics** (L done: see L round 2 below) for L and F (one fresh critic each, 8 pairs + strips): needs each track's critic
   pack (`club3d.js --label r11L-<n>`; `travel.js --label r11F-1` + `--commute --secs 180 --every 6`).
3b. **L round 2** (fresh builder from `loop-r11.md`, after V merges: both in `src/club3d/`), from L-1:
   1) dither out crowd figures between camera and her (shader discard near her screen pos);
   2) crowd variety: 8-tone palette lifted off black, 3-4 head/hair variants, scale/lean, phase offsets;
   3) floor: beat-tinted LED tile canvas texture, light pools, blob shadows (the KO'd bouncer floats);
   4) cape points straight up (pairs 2/7/8): clamp ~70° + damping; 5) "spotted" as an event: clear
   bubbles/tips, brief slow-mo, red vignette, CCTV of her on the stage screen, "LOST THEM" stamp;
   6) show the grab in-world before the struggle panel; 7) HUD diet: "GET CLOSER" overlaps the title
   card, one transient layer at a time, slim stat bars; 8) X-ray: nearest 3 tags, de-overlap, icons,
   beacon on the clue; 9) cheap bloom on emissives (quality-gated); 10) dress the DJ booth + sign.
4. **V round 1:** case templates (suspect × clue type × twist) in `src/club3d/casegen.js`, per-visit
   variation of events, objectives, NPC profiles and layout; 8 seeded visits as the critic pack.
5. **F round 2:** harness first: in `--commute` the bot stays perched after a won rescue (kitten), so a
   180 s run logs no offers; `impostor` is "never offered" on phase-2 (gate/act state). Then courier-van tail (trail + warehouse gate), Polaroids blowing off a roof, super-hearing
   street rescue, Puzzle Maker riddle chain, news chopper; check the impostor's knockoff colours.
6. **T round 2:** split `overworld.js` (1,103 lines) and `brawler.js` (911); renames (clubzone →
   building engine, `NightCase` → asylum's); harness tidy (`premade3d` → `clubs`).
7. **Ask the user:** delete the now-unreferenced 28 MB of assets (`assets/clubs/*`, 2 plates; list in
   `docs/polish/handoff/tech-r11.md`)?

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
