# City round 10 handoff (cloud session 1, branch `cloud/city-r10`)

Brief: STATUS.md "Round 10 review" → City items C1–C13 (bugs first). Gauntlet loop: fix → re-shoot →
fresh sonnet critic (new fly3d frames + C-list only) → commit + push, up to 4 cycles.
Base for A/B: `git archive b615a78 src` (= phase-2 1e65910 + stub) in the scratchpad.

## Done (cycle 1)
- **C1 far LOD textured** (buildings3d FRAG, no geometry, no texture): `groups()` draws windows grouped
  2^k (k from the pixel footprint; level 0 = the near windows, 2×2 groups, then the mean), next level
  faded in over the last third only; replaces the flat average for any window under ~3 px (also C9).
  **In-shader ink** for the lite builds: each quad's edges from its corner id, packed into the spare
  bits of the kind byte (`Builder.v(..., q)`, VERT `vQ`): roof outlines, corners, setback lips.
- **C2 neon**: rings go on the wall of the tier at their height (`tiers`/`foot()` in blocks3d; rings
  round the base footprint floated beside stepped tiers), corner posts only up the bottom tier; VS:
  tubes off until `uLit` 0.2, widened to ≥ ~2 px (posts sideways via style 1); unlit glass tint.
- **C3 sun**: dusk disc fill pale cream (yellow disc on yellow glow read as a hollow ring).
- **C4 far ring**: layers fade on steep rays (`RING.dip`) and their bases melt into the ground haze.
- **C5**: prism faces leaning back > ~33° use the roof material (pyramids, spire/dome tops).
- **C7 water** (skyline3d sea): navy → sky Fresnel, drifting ink ripple dashes (box-filtered), a glint
  streak stretched toward the lens, hazed ×0.8 (was ×1.35: the river ring read as a lilac band).
- **C10 lights**: `litWin()` = whole lit floors + 2-wide stacks + sparse scatter, 3 colour temps;
  transom dropped (each pane was a "+").
- tools: `shoot.js --only a,b` takes a list.

## Done (cycle 2)
- **C8** haze takes the dome's warm toSun glow toward the sun (`uSunAir`/`uSunDirH`, `gRay` set per
  shader; same term as the sky just above the horizon: no seam). **C6** dusk rim: warm line on the
  sun-side edge of shaded faces (quad position). **C11** non-vice walls 25% to grey, roofs half way
  to warm grey, less moon on roofs. **C12** AO 0.5/6.5 m, street floors' window light sinks too.
  **C10** lit panes drop mullion/recess. Sea hazed like land (×1: ×0.8 made a hard dark coast).
  Perf trims: 2×2 groups fade to the mean by f 1.75; ring layers skipped on steep rays.
- Critic cycle 2: 6/10 (C3 fixed; C1 C2 C5 C6 C7 C9 C13 improved; C4 C8 C10 C11 not, C12 can't tell).
- **Perf cycle 2 (frozen, 8 rounds): skim 0.917, cruise 0.907, high 0.922: OVER budget** (haze sun
  term + rim run per pixel even when off). Fix first in cycle 3.

## Perf cycle 1 (frozen-pose bench, Balanced, SwiftShader, 21:00, 8 rounds; head vs base)
- skim 0.985, cruise 0.947, high 0.937 (≈1% over budget at cruise/high; trimming next). Calls/tris
  unchanged (±noise). No new textures/targets (GPU memory unchanged). Bench: flyab.js with the
  measurement swapped for a frozen pose (start spot +300 wu), median of 10 synced renders per round.
  flyab's live flight is ±8% noisy here. Bisect: far ink ~free, water ≤3%, groups() ~5%.
- Baseline fly3d.js (3D/2D): skim 0.70, cruise 0.71, high 0.70.

## Critic (cycle 1, fresh sonnet): 6/10 vs best HTML5
C3 C5 fixed; C1 C2 C6 C7 C13 improved; C4 C8 C9 C10 C11 C12 not fixed. Ranked: flat dusk haze;
far ground edge/ribbon (pv1, high_2); lit glyphs/"x"; blank saturated roofs; candy lite blocks;
pale blotchy far lit windows; no base contact shade; far water fog-coloured, bridge pylon ghosts.

## Next
Perf trim (groups range, ring skip) → C8 sun-tinted haze → C4 edge → C10 plain lit cells → C11
palettes/roofs → C12 → C6 dusk rim → C13.

## Flagged for local
- none (all procedural so far)
