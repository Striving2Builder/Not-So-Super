# Travel round 11 (track F, branch `worktree-agent-a4e919b8e12914483`, from phase-2 0cc680e)

Brief: make the time between markers gameplay (a moment every ~20-40 s of commuting, in 3D, readable
from the chase camera). Ports 8941-8949. Camera untouched; LIVE panel untouched. Wrapped up early
(director's call): only what's built ships; nothing half-wired.

## Shipped (in the default game)
- **The moment director** (`src/moments/director.js`): one offer per 20-40 s of commuting (first after
  9-14 s), placed ahead of her / toward her waypoint, clear of incident markers; max 2 live, 1
  story-sized; none while she's arriving at her waypoint, sooner on long trips; rank / act gates and
  cooldowns per kind; timeline `.log` (offered / taken / won / lost / expired). It now schedules the
  old air events and the act's impostor sightings (their own timers are gone). `?moment=<kind>`
  calls one up; `?moments=off` turns offers off (A/B only: it also stops sightings).
- **The old air events drawn in 3D at last** (`src/moments/air3d.js`; before: only chips and minimap
  dots): window-washer on his rig (ropes, hang / flail poses, a landing ring), runaway / getaway cars
  (exhaust, flashers), the helicopter (spinning, smoke, rotor), the hoop course (glowing inked hoops),
  the kitten on its roof, the tabloid drones + flashes. Tags, CATCH! lock-ons, ▲/▼ height hints and a
  banner (title, clock, meter) under the title panel, clear of her and the LIVE panel.
- **The impostor sighting as a rooftop chase** (`src/moments/impostor.js`): her own model in a knockoff
  (teal / hot pink, no cape) posing for 3 camera drones on a low roof; she bolts and rocket-hops roof to
  roof; drop to skim, DIVE = a swoop tackle (slow-mo, burst, FOV kick = the boost's, sparks), the wig
  flies off, then the act's catch + UNMASKED. Fly through a drone: SMASH (+1). Flashes add heat.
- **Catch juice for every air event** (`celebrate()`): slow motion 0.25× for ~0.7 s, burst at the spot,
  the boost's own FOV punch, sparks, an ink ring; synth stingers (`flightaudio.js sting()`).
- Kit (`kit3d.js`, `actors3d.js`, `hud.js`, `base.js`): pooled, built once; hidden = no draws.

## Hooks outside my files
`flight3d.js`: 3 one-liners (slow-mo × its dt, `moments.render3d`, `moments.overlay`).
`overworld.js` (mine): director, swoop, DIVE routing / prompt, waypoint, minimap ping, 2D draw.
`act.js` (sightings, mine): `sightingDue()` / `spawnSighting()`; the act keeps its clock + catch flow.

## Checks
travel.js: faller, rings, impostor played to a win, 0 page errors. Perf: see the report (flybench A/B).

## Next (designed, not built)
1. Critic pack: `node tools/shots/travel.js --label r11F-1 --port 8943` (stills + strips per kind) and
   `--commute --secs 180 --every 6` (commute strip + timeline). The bot's framing hides some targets
   (it parks under the washer): give it an approach shot before the catch.
2. More moments (kit pieces exist): courier-van tail (reveals a raid: trail + warehouse gate),
   Polaroids blowing off a roof (catch them; one goes to the Supergirl-or-Impostor call), a
   super-hearing street rescue (swoop a purse snatcher / runaway pram), a Puzzle Maker riddle chain
   (billboard riddle → landmark "?" against the clock), a news chopper (break line of sight / blind it).
3. Check the impostor's knockoff colours at full size; a jet-pack mesh; her hop pose.
