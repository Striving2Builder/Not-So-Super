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

## Phase 3 — Flight is gameplay ✅ done
12. **Airborne events** (`src/airevents.js`): a window-washer dangling then falling (catch them at
    their height), runaway and getaway cars (the getaway car turns away from her; both can only be
    grabbed from rooftop height), a news helicopter spiralling down (catch it at its height), a
    stunt course of six hoops at different heights against the clock (record kept), and kittens
    stranded on rooftops (perch on the roof to rescue). Rewards, small penalties for misses, stats.
13. **The city reacts**: news choppers tail her at 150+ / 300+ rep (`airspace.follow`); tabloid
    drones (`src/paparazzi.js`) swarm her in vice districts at night, every flash adds tabloid heat,
    shaken by boosting or climbing to high patrol; pedestrians point up and crowds shout as she skims.
14. **Navigation** (`src/nav.js`): tap the map (or an incident in the nearest-first list) to set a
    waypoint that follows moving targets; autopilot flies there while the stick is idle, any input
    takes over. Waypoint shown on the ground, the minimap, the HUD and as an edge arrow.
15. **Launch & landing**: super-jump out of zones (shockwave, debris, burst lines, shake); dives are
    steerable, accelerate toward the ground with speed lines rushing in, and end in an impact.

## Guardrails
- Crime beacons and markers stay readable over every atmosphere/cloud layer.
- Atmosphere is subtle: thin drifting layers with gaps, never a blanket.
- Mobile budget: pre-rendered soft sprites, few large alpha overlays, auto-reduce if fps drops.
