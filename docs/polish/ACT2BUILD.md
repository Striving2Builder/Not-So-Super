# Act 2 build: Not So Super (started 2026-10-16)

The design is [docs/design/act2.md](../design/act2.md) (approved by the user 2026-10-16: "ok approved,
you can build"). This file is the build board. A new thread picks the build up from here plus
[STATUS.md](STATUS.md) for the standing decisions. Round 11 is paused (its resume list is on
[ROUND11.md](ROUND11.md)'s board); this build runs instead of it.

## Process (credit-lean, from ROUND11.md "Credit-lean process")
- One small job per fresh builder (worktree branch + handoff file `docs/polish/handoff/act2-<job>.md`),
  default effort, ~150k-token budget: commit WIP, update the handoff, report (≤25 lines).
- **At most 2 builders at once.** Never resume a long transcript: a fresh agent reads the handoff.
- The director merges into `phase-2`, runs the harnesses in shell, updates this board after every merge.
- Standing rules for builders: ROUND11.md "Standing rules for every builder" (phone first, perf ≤5%,
  clips only from `src/club3d/clips.js`, no dead ends, comic style, saves keep loading, WIP commits,
  split files past ~800 lines) plus act2.md's "Content line".

## Waves
| Wave | Job | Phase | Status |
|---|---|---|---|
| 1 | **A**: the Act 2 skeleton (`src/act/act2.js`, the runtime per act, state, board page 2, `?act=` params, Act 2 opening after `act.complete()`, the opening scandal: rep set to −50) | A | running |
| 1 | **I**: RLD Walks, the level (H-shaped red-light street on the asylum engine, rescues, perfume, tied-up capture, lead doors + "Which one is hers?", the waking-captured opening variant, try the over-the-shoulder camera) | I | running |
| 2 | C1: the crop-top Supergirl in Blender (needs blender-mcp + the user's Blender open; `docs/references/user/act2-croptop-sg.jpg`, red boots, no cape) | C | next |
| 2 | B: the pendulum (negative-rep doors, impostors' rep → Polaroids, promotions as map events) | B | next |
| 3 | C2: the knockoff switch, the 5 × 5 suit finds, the act board's suit | C | |
| 3 | D: the casino (High-Roller Suite plan, high card, 21, stakes) | D | |
| 4 | F: the Act 2 asylum · G: Recall + drug finds | F, G | |
| 5 | E: the factory lines · H: the hall of mirrors + Supergurl | E, H | |

## The contract between A and I (wave 1)
- I owns `src/rld/` (new folder) and registers a zone mode **`rldwalk`** in `main.js` (`modes`,
  `modeFor`), with `rldWalkFields(opts)` (like `asylumFields()`) for a map zone in the `redlight`
  district. `enter(p)` accepts **`p.opening: true`**: she wakes up tied up in a room, Polaroids on the
  floor, the blackmail note beside her (the opening of act2.md).
- I reports finished walks the way the asylum does (zone `mode` + `venue`), and calls
  `game.act?.suitFind?.(piece, real)` if that hook exists when a "Which one is hers?" pick is right.
- A owns `src/act/` and starts the opening with `game.startZone({ ...rldWalkFields({ opening: true }) })`
  (or the equivalent the code uses), guarded so it no-ops if the mode isn't registered yet. A counts
  `rldwalk` missions toward the Act 2 gates and adds the `suitFind(piece, real)` hook (state only;
  the board's suit picture is C2).
- Neither job edits the other's files. Shared hooks (`main.js`, `data.js`) are small and listed in
  the report.

## Log
- 2026-10-16: design approved; wave 1 = A + I launched.
