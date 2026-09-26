# Flight Experience Upgrade Plan

Goal: flying should feel like being a superhero, not steering a cursor over a map.

## Phase 1 — Feel ✅ done
Touches only the flight code; biggest payoff per change.

1. **Flight physics** (`src/flight.js`): speed from stick distance, snappy acceleration and a
   gliding stop, limited turn rate at speed (wide arcs when fast, tight when slow).
2. **Body language**: bank into turns, lean into acceleration, pitch upright into a hover when
   stopped; the arm pose relaxes while hovering.
3. **Speed-aware camera**: zooms out and looks further ahead with speed; shake on boost ignition.
4. **Speed you can feel**: wind streaks that scale with speed, sonic boom ring + contrail at top
   speed, cape pulled tighter by the airflow.
5. **Sky layer** (`src/sky.js`): clouds at several heights with true parallax (above and around
   her altitude); flying through one gives a brief white-out and whoosh.
6. **Flight audio** (`src/flightaudio.js`): wind loop pitched by speed, boost whoosh, sonic boom,
   sirens from the nearest incident, louder as you approach.

## Phase 2 — The sky is a place ✅ done
7. **Altitude bands**: high patrol (fast, wide view), cruise, rooftop skim (towers become
   obstacles, street life visible). Climb/dive control; zone dives become real descents.
8. **District atmospheres** (a layer between rooftops and her altitude):
   Red Light = red neon smog · Naughty Nightclub = pink/purple haze · Villains' Lair = toxic green
   fog · Factory = industrial smog · Docks = sea mist · Farm = dawn ground fog · Financial = clear.
   Thinner seen from below; crime beacons always cut through; lit by neon at night.
9. **Airspace traffic**: birds, news/police helicopters, planes, night searchlights.
10. **Rooftop perching + super-hearing**: land on a tower; super-hearing reveals hidden crimes and
    night cases nearby (feeds the lead network).
11. **Camera tilt**: slight oblique view so buildings read more 3D.

## Phase 3 — Flight is gameplay
12. **Airborne events**: catch a falling window-washer, stop a runaway car / crashing helicopter,
    getaway chases from above, optional speed rings and rooftop collectibles.
13. **The city reacts**: news helicopters follow a popular hero, tabloid drones tail her in vice
    districts at night (tabloid heat), crowds point up.
14. **Navigation**: tap the map to set a waypoint, incident list by distance, optional steering
    assist toward the chosen target.
15. **Launch & landing**: super-jump launch out of zones, steerable dives with the ground rushing up.

## Guardrails
- Crime beacons and markers stay readable over every atmosphere/cloud layer.
- Atmosphere is subtle: thin drifting layers with gaps, never a blanket.
- Mobile budget: pre-rendered soft sprites, few large alpha overlays, auto-reduce if fps drops.
