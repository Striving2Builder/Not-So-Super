# Travel round 11 (track F, branch `worktree-agent-a4e919b8e12914483`, from phase-2 0cc680e)

Brief: make the time between markers gameplay (a moment every ~20-40 s of commuting, in 3D, readable
from the chase camera). Ports 8941-8949. Camera untouched; LIVE panel untouched.

## Finding
In the 3D flight (the default) none of the old air events (window-washer, cars, helicopter, hoops,
kitten) or the tabloid drones were drawn at all: only edge chips and minimap dots.

## Done (WIP, not wired into the game yet)
- `src/moments/actors3d.js`: merged vertex-coloured geometry: comic figures with baked pose frames
  (run cycle, flail, hang, fall, cheer), car / getaway / van, news chopper + rotor, drone, kitten,
  stroller, wig, window-washer rig, Polaroid card + Puzzle Maker "?" canvases.
- `src/moments/kit3d.js`: pooled kit (built once, lazily; hidden = no draws): cel material + a
  screen-constant ink hull (plain + instanced), instanced drones / cards / hoops, additive glow points
  (flashes, sparks) + smoke puffs (1 draw each), ground ring decals, moment beams, "?" sprite,
  spotlight cone, ropes; `warm()` precompiles once; `dispose()` frees only the kit's own resources.
- `src/moments/hud.js`: overlay tags, lock-on reticle + DIVE!, the moment banner (title, clock, meters).
- `src/moments/base.js`: Moment base class (update / draw3d / overlay / draw2d / diveTarget / banner).
- `src/moments/director.js`: pacing (first 9-14 s, then 20-40 s of commuting; max 2 live, 1 story-sized;
  no offers while arriving at the waypoint; sooner on long trips), eligibility by rank + act state,
  placement ahead / toward the waypoint, clear of markers; the swoop (DIVE onto a target), slow-mo,
  `celebrate()` (burst, kick = the boost's own FOV punch, sparks, stinger); timeline `.log`;
  `?moment=<kind>` (harness), `?moments=off` (A/B).
- `src/moments/air3d.js`: 3D views of the old air events + the tabloid drones, their tags / banners,
  and `AirMoment` (an air event in the director's schedule).

## In progress / next
1. Moments: impostor rooftop chase (her model, recoloured; poses for drones, rocket-hops roof to roof;
   drop to skim, DIVE = swoop tackle, slow-mo, the wig flies off), help (super-hearing ping → swoop
   rescue of a purse snatcher / runaway pram), Polaroid scatter (catch the cards before the street;
   one is called in the act's Supergirl-or-Impostor screen), courier van tail (reveals a raid:
   trail + warehouse gate), riddle chain (billboard riddle → landmark "?" against the clock), news
   chopper (break line of sight or fly at it to blind it).
2. Hooks: overworld (director, swoop, slow-mo dt, tryDive/prompt, markers, 2D draw), flight3d (3 tiny:
   render3d, overlay, slow-mo dt), airevents (director schedules; 3D heights; outcome), act
   (sightingDue / spawnSighting), flightaudio (stingers).
3. Harness `tools/shots/travel.js` (per-moment strips, commute run + timeline), perf A/B, critic pack.

## Perf baseline (r11F-base, SwiftShader, before any change)
fly3d.js: skim 13.6 fps / 56 calls / 70k tris, cruise 10.1 / 81 / 92k, high 12.4 / 67 / 82k
(3D/2D ratios 0.99 / 1.12 / 1.16). shoot.js flying: shots/r11F-base/flying/.
