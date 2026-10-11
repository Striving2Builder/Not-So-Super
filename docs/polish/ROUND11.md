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
| L club loop | `src/club3d/`: `club3d.js` (camera, HUD, update), `danger.js`, `feel.js`, `story.js`, `struggle.js`, `sedation.js`, `cast.js` (bouncer and guard AI), `press.js`, `powers.js`, `crowd.js` (cover, parting), `quick.js`, `music.js`, `video.js`, `livefeed.js`, new club files for feel; `src/cutscene.js` (skip affordances) |
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

## Board
| Track | Builder (agent / branch) | Round | Last critic (pairs better / vs HTML5 / feel / verdict) | State |
|---|---|---|---|---|
| T tech debt | (launching) | 1 | n/a | wave 1 |
| L club loop | (launching) | 1 | baseline pending | wave 1 |
| V club variety | (waits for T's merge) | 0 | baseline pending | wave 2 |
| F travel | (launching) | 1 | baseline pending | wave 1 |
| refs scout | (launching) | n/a | n/a | building `club3d` + `travel` pools |

## Log
- 2026-10-11: round planned. Wave 1 = T, L, F and the reference scout; V starts once T is merged (both
  touch the club's case files).
