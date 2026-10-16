# Act 2 job D: the casino (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 3, job D); design: docs/design/act2.md ("The casino" under The
venues, "The casino stakes" under Gates). Built so far: A (`src/act/act2run.js`: `zone.casino` counts the
casino gate, `suitFind(piece)` refuses at rep ≥ 0), B (`DISGRACED_DOORS` shuts the High-Roller Suite at
rep ≥ 0), I (`src/rld/whichone.js` for the card-overlay style).

## Scope
- The High-Roller Suite as a 3D club venue: a `club3d` plan variant like the Gilded Cage (tables, a
  cashier, pit bosses as bouncers, the crowd), gold/red casino dressing. `zone.casino = true`.
- Entry: rep < 0 (B's door) **and the knockoff suit**: switch her to Supergirl_Dark (the placeholder,
  `hero3d.js` costume switch) for the night, back to her costume after.
- Two tables as a DOM overlay (like the VIP dance numpad, phone-first): **high card** and **21**.
- Win a table: `game.act.suitFind('top' | 'skirt')` + a lead line. Win both: the night counts.
- Lose a hand: one dose of Super Squirt (+intoxication), one knockoff accessory off in order cape,
  gloves, belt, boots (visibly where herolook3d allows it, else on the HUD), −8 rep. Four losses:
  thrown out, the night is lost. Never below the top and skirt (content line).
- Debug entry + a harness flow (enter, win a table, lose to thrown out).

## Done
(nothing yet)

## Next / notes
