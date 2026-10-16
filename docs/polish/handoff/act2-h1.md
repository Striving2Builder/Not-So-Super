# Act 2 job H1: the hotel's new floor, the hall of mirrors (handoff)

Brief: docs/polish/ACT2BUILD.md (job H1; H2 = the boss fight, same floor). Design: docs/design/act2.md
("The hotel's new floor and the boss", the content line). Mood: docs/references/user/act2-mirror-mood.jpg (main checkout).

## Done (2026-10-16, branch act2-h1-mirrors; harness green, 0 console errors)
- `src/mirrors/` (new): `plan.js` (hotel `Builder`: lobby, a 4 m tiled gallery to z −37, the antechamber, 9 rooms
  M1-M9 behind mirrored doors alternating with 9 tall mirrors; each mirror = solid glass in a wall gap with a
  mirrored copy of the gallery built behind it), `art.js` (graffiti tiles, wet tiles with neon streaks, purple tubes,
  the sealed door's cracked S), `glass.js` (`twinOf(src)`: a SkeletonUtils clone posed bone-for-bone each frame in a
  holder whose matrix reflects across the glass; hers on every look but saver, hunters' on `full` only; no render
  targets), `cult.js` (High Acolyte + 2 acolytes in red robes/gold masks via the factory's `crewMethods` + Kell's
  brain; 1 acolyte on saver), `mirrors.js` (`MirrorsZone extends HotelZone`, `mirrorsFields()`).
- On the floor: 8 portraits (Supergirl or Impostor, `spotCall`; right = rep +1, wrong = intox +6), 2 rails in the
  dressing rooms (Which one is hers?, the 2 pieces furthest behind; right = `suitFind` + `stainRead`), the shrine (a
  stash via `stashTaken` + a `memoryClue`), a stash in a parlour, 3 parlour traps baited with a Polaroid (the
  struggle; free = rep +2, fail = alarm), darts (rep −3, intox +20 cap 70, the captive clip, wake in a random room).
- The sealed door (antechamber north wall): `bossDoor()` = the stub dialog; sets `this.reached`. Leave = the elevator.
- Hooks outside src/mirrors/: `main.js` (import, mode `mirrors`, `game.mirrorsFields`, resize, `modeFor`,
  `?zone=mirrors`), `act2run.js` (`ensureMirrors`: the floor on the hotel tower while `B.lairOpen`), `commentary.js`
  (ZONE_OPEN.mirrors). Venue = the hotel's own VENUES entry (never rolled at random). Act 1's hotel untouched.
- Harness `node tools/shots/mirrors.js` (floor, dart, map, reach). Also passing: act.js hotel,kell,act2,act2gates;
  factory.js lines. Debug: `?zone=mirrors&act=act2lair&flight=2d`.

## Perf (desktop/high profile, headless)
- gallery 162 calls / 77k tris (twin in the glass + hunters), mirror 105 / 68k, lobby 181 / 52k, door 58 / 42k.
  Factory reference 230 / 63k. Tris are over at the gallery on desktop (hunter twins are `full` only); phones get her
  twin only. If it matters: drop hunter twins (glass.js `setupGlass`).

## Next (H2) / notes
- H2 overrides `bossDoor()` (gate on `two.B.bossReady`), cuts a gap in the antechamber's north wall (plan.js
  `ANTE.z0`) and builds the boss room beyond; `twinOf` can multiply her and the boss in the glass.
- Seen from the cut-away camera the room in the glass reads as a room with her double in it (comic floor plan).
- Not phone-tested yet. Portrait frames load slowly in swiftshader (the harness waits up to 90 s).
