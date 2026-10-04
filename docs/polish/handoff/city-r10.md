# City round 10 handoff (cloud session 1, branch `cloud/city-r10`)

Brief: STATUS.md "Round 10 review" → City items C1–C13 (bugs C1–C5 first). Critic reports:
`docs/polish/critiques/r10/city.md`, `blind.md`. Run locally on Windows (harness works as-is:
`--use-gl=swiftshader`, Playwright from the npx cache).

## Done
- Branch created off phase-2 1e65910; baseline shots `shots/base/flying` (git-ignored); base copy for
  A/B: `git archive phase-2` into a scratch folder, `tools/shots/flyab.js --variants "head;base=<dir>"`.

## In progress
- Baseline perf A/B (head vs base, noise check).

## Next
- C1 → C13 in order.

## Perf (flyab.js, Balanced/auto, SwiftShader, night 21:00)
- pending

## Flagged for local
- none yet
