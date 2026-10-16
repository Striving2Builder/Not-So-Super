# Act 2 job H2: the Supergurl boss fight and the act's end (handoff)

Brief: docs/polish/ACT2BUILD.md (job H2); design: docs/design/act2.md ("The hotel's new floor and the
boss", "The cast", the content line). Built on H1 (`src/mirrors/`, see `act2-h1.md` "Next (H2)").

## Scope
- **The boss room** behind the antechamber's sealed door (cut the gap at `ANTE.z0` in
  `src/mirrors/plan.js`); `bossDoor()` opens only when `two.B.bossReady` (else the stub line). Mirrors
  all round; same look as the floor.
- **Supergurl** (user): the cult's leader, real name unknown. A long black coat with red braided cord on
  the shoulder, a black hood, a glossy red sculpted mask, black riding boots, **over Supergirl's stolen
  original suit** (reference, local and git-ignored:
  `C:/Users/ngnic/Documents/App Projects/Sandbox - Top Down Super Flying Game/docs/references/user/act2-cult-leader.jpg`).
  Stand-in: the hero's own classic model (`supergirl.glb`, cloned like H1's twin) with a procedural
  coat, hood and mask on top. **The coat and mask come off during the fight** (the reveal).
- **The fight is built around the drug** (user): reuse Act 1's ballroom fight shape
  (`src/hotel/ballroom.js`: phases, interactions, the struggle, the meter). Every hit or trap raises
  intoxication; as it climbs, the mirrors multiply her and Supergurl (`twinOf` in `glass.js`). Over the
  haze line, Supergirl has to pick the real Supergurl out of the reflections (the call: tap the real one,
  or `spotCall`). Captive moments use the S-shield struggle. No dead ends: failure hands control back
  within ~8 s and changes the situation.
- **The dialogue** (user): a lot of back and forth. Supergurl insults the real Supergirl and accuses her
  of the things Supergurl did herself: the Polaroids, the tape, the crime spree, Super Squirt, the stolen
  suit. Supergirl answers back each time. One exchange per phase, harder to deny as she gets higher.
  Lines in a data file (`src/mirrors/lines.js`), comic boxes like Act 1's beats. PG-13.
- **The end:** win = her real suit back, stains and all (`two.B.done`, a final beat: the papers, an
  "End of Act 2: Not So Super" card). Hand back to the overworld like Act 1's `complete()` does.
- Debug entry `?act=act2boss&zone=mirrors` straight to the fight + a harness flow (the fight to the win,
  a capture + struggle, the reveal, the mirror call).

## Done
(nothing yet)

## Next / notes
