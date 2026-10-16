# Act 2 job D: the casino (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 3, job D); design: docs/design/act2.md ("The casino" under The
venues, "The casino stakes" under Gates). Built on A (`act2run.js`), B (`DISGRACED_DOORS`), I (card style).

## Done (2026-10-16; casino.js win/lose/act1 + act.js act1save/act2/act2gates/act2promo pass, 0 errors)
- **The venue:** `plan.js` VARIANTS.casino (story: never rolled at random): two card tables (high card
  W, 21 E), a roulette wheel, the cashier's cage by the door, slot banks, chandeliers, casino carpet,
  "HIGH-ROLLER SUITE" neon; pit bosses = the club's bouncer routes round the tables. Built by
  `casino.js buildCasinoHall` (called from `build.js buildStoryHall` when `V.tables`). Crowd ×0.35,
  standing, kept off the tables (`casinoKeepOut`). The club's case, VIP, office etc. still run.
- **Routing:** `main.js startZone`: in Act 2 after the opening, a `special` mission at a `kind: 'casino'`
  venue (the High-Roller Suite) gets `zone.casino = true` → `modeFor` → club3. Act 1: unchanged (the old
  special zone; harness `act1` checks it). Entry at rep ≥ 0 is B's door (unchanged).
- **The knockoff:** `hero3d.js loadSkin('dark')` / `skinScene()` load Supergirl_Dark on demand (same rig);
  `startZone` waits for it (≤8 s, the dive's repeat calls ignored); `Special3D` builds her from
  `this.heroSrc?.()`. The next zone builds her own costume again. The doorman dialog replaces "how do you go in?".
- **The tables** (`cards.js sitAt`, DOM overlay, z 56, phone-first: felt left, big buttons right, keys 1-4):
  high card (keep / swap once / X-ray his card), 21 (hit / stand / X-ray the hole card; dealer to 17;
  pushes redeal). X-ray: 30% the pit boss sees → the hand is lost. Over the haze line the cards swim.
- **Stakes** (`CASINO` in casino.js): win a table → `game.act.suitFind('top' | 'skirt')` (high → top,
  21 → skirt) + `unlockLead` (a dealer's tip) + a lead line; both → the night (cash out at the cashier or
  the exit → `outcome: 'win'` → act2run counts `casino`). Lost hand → +20 intox, −8 rep, the next
  accessory (cape (visibly: the cloth cape hides), gloves, belt, boots: on the HUD "Kit" line and the
  overlay), an envelope card. 4th loss → thrown out (`outcome: 'lose'`, the night lost). Leaving early /
  case solved without both tables = abort (doesn't count).
- Debug: `?zone=casino` (rep set to −30 if higher), `&casinorig=win|lose` stacks the deck.

## Hooks outside my files
main.js (startZone casino + knockoff wait, modeFor, debugZone), hero3d.js (prepScene/loadSkin/skinScene,
HeroModel(src)), special3d.js (1 line heroSrc), club3d.js (VISIT.casino, plan room, startCasino,
casinoDoor, casinoHud, crowd keepOut/count/pose, exit removes overlay, mixin), build.js (2 lines),
cast.js (1 line placeCasino), plan.js (the variant).

## Test
`node tools/shots/casino.js` (flows win, lose, act1; port 8898) → shots/casino/casino/.
Perf: casino floor 288-327 calls / ~400k tris at 844×390 (varies with the seeded case and crowd); the
knockoff adds one ~2.3 MB glb, loaded on the first casino night and kept for the session.

## Next / notes
- Supply: casino nights only come from random High-Roller Suite `special` spawns; 6 are needed. The act
  may want an `ensureCasino` like `ensureWalk` (act2run.js, job F's file this wave).
- Gloves/belt/boots aren't separable on Supergirl_Dark's mesh: HUD only. C2's real knockoff could split them.
- Lead lines (`LEADS`) are flavour; the map lead is a generic `unlockLead`.
