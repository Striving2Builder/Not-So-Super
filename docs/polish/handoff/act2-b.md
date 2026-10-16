# Act 2 job B: the reputation pendulum (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 2, job B); the design is docs/design/act2.md ("The reputation
pendulum", "The cult and the Supergirl or Impostor games"). Builds on job A (`act2run.js`, `act2.js`).

## Done (2026-10-16; flows act1save/act2/act2gates/act2handoff/act2promo + Act 1 polaroid/sighting pass, 0 errors)
- **The impostors' rep** (`act2run.js impRep()`): `-her rep + B.impAdj` (saved; `norm()` adds it to old
  Act 2 saves), clamped -100..300. impAdj moves with what she does (`IMP` in act2.js): promotion caught
  -15, the photo op +12, a promotion nobody stopped +8, a cult Polaroid proved fake -3. On the board page 2
  with "Polaroids everywhere / drying up" and "Disgraced-only doors open / shut".
- **It drives the Polaroids:** `Act.strayRate()` → `two.strayRate()` = `strayRate(imp)` (0.4..3, act2.js)
  ×1.4 while the Polaroid gate is short. polaroids.js uses it when defined (Act 1: undefined → old rule).
- **Negative-rep doors:** `DISGRACED_DOORS` in act2.js, ONE TABLE for the user to edit (rows by `casino`,
  `venue`, `story` case id, `cases` ids, optional `districts`, `on: false` to drop one). Default: the
  casino, the three story clubs (Hive/halo, Gilded Cage/auction, Flashpoint), the naughty district's
  Gentlemen's Club, the Spiked Drinks investigation. At rep ≥ 0 (Act 2, after the opening): 🔒 icon, the
  prompt says why + `DOOR_HINT`, DIVE refused with a toast. The plain 'Nightclub' venue stays open
  (the clubs gate can still be met at positive rep).
- **Promotions / grand openings:** a map event (`kind 'promo'`, `actDive: 'promo'`, `actGate` so it's
  beyond the quota) in redlight/nightclub/naughty, first after 50 s, then every 110-170 s (×1.5 once the
  gate is met), ttl 110 s; toast + comic headline. DIVE → a lineup of 3 stage cards (marquee + a still
  of her, `makeStill()` from polaroids.js), one `spotCall` each, ≥1 fake (impostorize, subtler per
  promotion). All right = `count('promotions')`, rep +10, impostors -15. One wrong ends it: the photo op,
  rep -6. Missed: rep -4. Data/lines: `PROMO`, `PROMO_VENUES`, `PROMO_LINES` in act2.js.

## Hooks outside src/act/
- `overworld.js`: tryDive (`z.actDive` → `act.dive`; `act.doorShut` refuses), updatePrompt (shut line),
  ttl expiry (`act.diveLost`), map icon shows 🔒 when shut. `polaroids.js`: `makeStill()` split out of
  `makePolaroid` (same output), stray rate via `act.strayRate?.()`. main.js, data.js, style.css: untouched.

## Test
`node tools/shots/act.js --flows act1save,act2,act2gates,act2handoff,act2promo` (act2promo: a right and a
wrong lineup, the casino door shut at rep 10 and open at -10, the stray rate, Act 1 untouched).
Shots: `act2promo_stage.png`, `act2promo_door.png`.

## Next / notes
- The user still has to confirm which clubs are disgraced-only (edit `DISGRACED_DOORS`).
- Not done: rep-gating the suit finds (`suitFind` still counts at any rep; act2.md says finds only while
  negative — the finders (I, C2, D) can check `state.rep < 0`, or add it in suitFind).
- Promotions are a modal lineup (no 3D stage zone); stills are the same clip frames as the Polaroids.
