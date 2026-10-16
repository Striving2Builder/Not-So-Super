# Act 2 job H2: the Supergurl boss fight and the act's end (handoff)

Brief: docs/polish/ACT2BUILD.md (job H2); design: docs/design/act2.md ("The hotel's new floor and the boss", "The cast",
the content line). Built on H1 (`src/mirrors/`, `act2-h1.md`).

## Done (2026-10-16, branch worktree-agent-ad245ed7e84e885dc off phase-2 5ba12ff)
- `bossroom.js`: Supergurl's room north of the antechamber (16 x 12 m), the sealed door's gap cut (plan.js hooks:
  `bossLayout`/`bossDress`; the old solid frame box is now posts + lintel), mirrors down both long walls with the room
  built again behind each glass (+ the dais/throne copies), purple tubes, the throne.
- `gurl.js`: Supergurl = a `HeroModel` of supergirl.glb (own mixer) + procedural coat (torso, long skirt, sleeves),
  open-faced hood + cowl over her hair, glossy red mask + eye slits, red braided cord on the LEFT shoulder, black
  riding boots; sized from her real head (raycast crown). `reveal()` = coat/hood/mask off (they land on the floor),
  cape + a lipstick kiss on the left of the S show. Reflections = `twinOf` clones mirrored across vertical planes
  through the room's centre (everything backwards: the call's tell); decoys skip the ink hulls.
- `boss.js` (mixed into MirrorsZone): `bossDoor()` opens when `B.bossReady`, or (no dead end: nothing else sets it in
  normal play) once the floor's done: both rails checked + 3 portraits called (sets `bossReady`, saves). Phases
  coat (3 hits) → reveal → suit (3) → haze (2 right calls) → down. Her moves: run the ring, pink Super Squirt kisses
  (dodge), strikes up close (push + dose), 3 pink floor vents (puff every 6 s). Reflections appear as intox climbs
  (punch one = glass + dose); over `INTOX_HAZE` punches/timer bring the call (numbered rings over her and the
  reflections, pushed apart for thumbs; keys 1-n): right = a hit, wrong = held. Captive moments (wrong call, intox
  100 via `capture()`, her hold at intox ≥ 70) = the S-shield struggle; free or not the room changes (back by the
  door, new reflections and vents; a fail gives her a hit back, rep −3, next struggle easier).
- `lines.js`: 5 exchanges (door: the Polaroids; reveal: the stolen suit; mirrors: the tape + crime spree; haze: Super
  Squirt; end), her line then Supergirl's answer as the button (hazier above the haze line), fight bubbles, the call,
  the ending (paper "THE REAL ONE" + "END OF ACT 2 / NOT SO SUPER" card).
- The end: win → `endZone(win)` → main.js (now `zone.hotel || zone.mirrors`) → `act.complete()` → `two.complete()`
  (act2run.js, 1 method) → `endAct2` (boss.js): B.done, B.suitBack, every piece at 5 finds, rep +80, intox 0, papers, card.
- Hooks outside my files: `main.js` endZone condition (1 line), `act.js` complete() (1 line), `act2run.js` complete()
  (3 lines), `mirrors.js` (import/mixin, placeBossRoom, punch/update/objectives/hud delegation, stub bossDoor moved,
  debug in announce), `plan.js` (3 lines), `tools/shots/mirrors.js` (flow `boss`).
- Debug: `?act=act2boss&zone=mirrors&flight=2d` (straight into the fight; `debugBossWanted()` in boss.js).

## Perf (headless, full look): coat phase 116 calls / 172k tris; mirrors + 5 reflections 126 / 241k (decoys
without ink hulls; it was 270k with them). Balanced: 3 reflections, side twins only in the nearer wall; saver: 2, no side twins.
Tris are the model clones (~25k each with ink): if phones struggle, cut `FIGHT.decoys`.

## Next / notes
- Not phone-tested. The Act 2 hero is still the classic model (C1's crop top isn't in), so Supergurl and Supergirl
  look alike once the coat's off apart from the stain and the cape: the call relies on the backwards cord/kiss + flicker.
- Supergurl's hands-behind-the-back pose isn't there (no clip); she uses combatIdle.
