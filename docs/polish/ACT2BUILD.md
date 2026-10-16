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
| 1 | **A**: the Act 2 skeleton (`src/act/act2.js`, the runtime per act, state, board page 2, `?act=` params, Act 2 opening after `act.complete()`, the opening scandal: rep set to −50) | A | **merged** 5ca5eed (`act2run.js`; flows act1save/act2/act2gates/act2handoff pass, 0 errors) |
| 1 | **I**: RLD Walks, the level (H-shaped red-light street on the asylum engine, rescues, perfume, tied-up capture, lead doors + "Which one is hers?", the waking-captured opening variant, try the over-the-shoulder camera) | I | **merged** 7c78493 (`src/rld/`; `node tools/shots/rld.js` 5 flows 0 errors; debug `?zone=rldwalk&opening=1`) |
| 2 | C1: the crop-top Supergirl in Blender (needs blender-mcp + the user's Blender open; `docs/references/user/act2-croptop-sg.jpg`, red boots, no cape) | C | next |
| 2 | **B**: the pendulum (negative-rep doors, impostors' rep → Polaroids, promotions as map events) | B | **merged** c872e85 (`DISGRACED_DOORS` in act2.js = the user's table; flows incl. act2promo pass, 0 errors) |
| 3 | C2: the knockoff switch, the 5 × 5 suit finds, the act board's suit | C | |
| 3 | **D**: the casino (High-Roller Suite plan, high card, 21, stakes) | D | **merged** 749cd64 (`src/club3d/casino.js`, `cards.js`; `node tools/shots/casino.js` 3 flows 0 errors; debug `?zone=casino&casinorig=win|lose`) |
| 3 | **F**: the Act 2 asylum (always high, powers lost, costume clue, the spree counter) | F | **merged** 5af8b89 (`src/asylum2.js`; flow act2asylum; debug `?act=act2&zone=asylum&flight=2d`) |
| 4 | **G**: Recall + drug finds | G | **merged** 2731420 (`src/act/recall.js`; `node tools/shots/recall.js` 3 flows 0 errors) |
| 3 | **E**: the factory lines (hotel engine, 4 levers, the foreman) | E | **merged** 05c9773 (`src/factory/`; `node tools/shots/factory.js` 4 flows; debug `?zone=factory&act=act2lair&flight=2d`) |
| 5 | **H1**: the hotel's new floor, the hall of mirrors (games, puzzles, traps, fake reflections) | H | running, 2nd try (the 1st hit the spend limit before writing code) |
| 5 | H2: the Supergurl boss fight (coat + mask off, the drug meter, the mirror call, the back-and-forth, the act's end) | H | next |

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
- 2026-10-16: A merged (5ca5eed); its contract notes sent to I. B launched in A's slot.
- 2026-10-16: B merged (c872e85). Director: `suitFind` refuses while rep ≥ 0 (act2.md rule), so jobs I/C2/D needn't check. Open for the user: which clubs go in `DISGRACED_DOORS`; Blender open for C1.
- 2026-10-16: I merged (7c78493). Director fixed `tools/shots/act.js` for the real walk (flows leave it by abort; act2 asserts the walk opened with `opening`). All 11 Act 1 + 5 Act 2 + 5 RLD flows: 0 errors. Wave 3: D + F launched (C1 waits on Blender, C2 after D).
- 2026-10-16: F merged (5af8b89); act 6 flows + rld 5 flows 0 errors. E launched in F's slot.
- 2026-10-16: D merged (749cd64; director resolved the `debugZone` conflict with F's `?zone=asylum`). Casino 3 flows,
  club3d all flows (rave, pit, events, cage, idle) 0 errors. **Perf flag:** casino floor 288-327 draw calls vs a club's
  196-259 (tris same ~400k): batch the slot banks/chandeliers in a follow-up; phone check. **To do (director, after E
  merges):** `ensureCasino` in act2run.js (keep a High-Roller Suite night on the map while the casino gate is short, like
  `ensureWalk`). Only the cape comes off visibly (Supergirl_Dark has no separate gloves/belt/boots). G launched.
- 2026-10-16: E merged (05c9773; director resolved the `debugZone` conflict again). Director added `ensureCasino`
  (e92324f). All harnesses 0 errors: factory 4, act 8 (hotel, kell, act1save, act2*), casino 3, rld 5. Factory perf:
  230 calls / 63k tris vs the hotel's 192 / 35k at the same spot (hunters + workers; phones get fewer). H1 launched.
- 2026-10-16: the monthly spend limit stopped G (nearly done) and H1 (still reading). User: "resume". Director committed
  G's harness, ran it (3 flows, 0 errors), wrote its handoff, merged (2731420; kept both the map helpers and the
  recall tick in act2run's update). H1 restarted as a fresh agent from phase-2.
