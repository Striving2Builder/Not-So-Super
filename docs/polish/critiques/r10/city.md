# City and flight critique, round 10 (fresh critic, judged from the images only)

## Scores
- **City vs AAA (Superman UE5 demo): 3/10.** Up close the near towers have a strong comic identity. It falls apart at mid and far distance: toy-block LODs, flat lilac haze, water that reads as fog, empty roofs and a board-game ground grid. The REF frames win on three cheap things this game could copy: sun-aligned lighting with real lit/shadow faces, a city that fills the frame from a high camera, and water that reflects the sky and sun.
- **City vs the best HTML5/WebGL games: 6/10.** The day frames (`fly3d_day_1/2`) and `patrolview_1` already hold up next to good WebGL flight demos. What keeps it from 7–8 is mostly consistency (LOD, window noise, palette), not missing technology.

## Ranked fixes (most impact first)

1. **Mid and far buildings fall back to flat, untextured, unoutlined blocks.** — expensive done properly, **medium** with the cheap version
   - *What I see:* `fly3d_high_2` has the whole lower third (x≈420–1500, y≈500–780) as flat blue-grey extrusions with no windows, no ink and no halftone, directly under the hero. `patrolview_1/2` show the same thing as orange, purple and pink boxes. `low_1` has grey cardboard spires at x≈960–1080.
   - *Why it matters:* this is the main thing that makes it look "low-poly toy city" instead of "comic city". High patrol is where players spend their time and see the most buildings, and that is exactly where the style switches off.
   - *Cheap fix:* switch LOD by projected screen size, not camera distance. Give the far LOD the same shader with (a) a 64×64 window-grid atlas sampled at the right floor count, (b) a cheap ink edge (back-face hull or vertex-color edge darkening) and (c) the per-face lit/shadow tint. For the farthest ring, use a single merged mesh and a vertex-color "lit window speckle" at night. Never show a tower with no windows within ~600 m of the hero.

2. **The hero is shown side-on to the direction of travel, and the high camera wastes the city.** — **cheap**
   - *What I see:* in `cruise_2`, `day_2`, `night_2`, `high_2`, `boost_2` and `vice_2` she is in pure profile, pointing right, while the street canyon vanishes at screen centre. That reads as strafing or sliding. She also covers 30–40% of the frame width right over the vanishing point. In `high_1` the horizon sits at ~45%, with sky on top and clouds hiding the city strip below.
   - *Why it matters:* in both REF frames the hero sits behind and above, a bit below centre, and the city fills 70–80% of the frame. That composition *is* the fantasy.
   - *Cheap fix:* (a) Tighten the camera yaw lag so the camera sits behind the velocity vector within ~0.3 s, or yaw the model toward the camera's forward so her back and three-quarter view shows. (b) Pitch the camera down with altitude: about 10° at rooftop height, 30–40° at high patrol, and pull back. Put the hero in the lower-centre third and push the horizon to the top 20–25% when high. `patrolview_1` is already close and should become the default high-altitude framing. (c) Shrink the hero about 15% in cruise.

3. **Lighting is not tied to the sun.** — **cheap**
   - *What I see:* in `cruise_1` and `boost_1` the sun sets behind the city (orange horizon), yet the facades facing the camera are evenly lit, saturated blue and gold. In `day_1` the left tower (x≈40–260) has both visible faces at nearly the same value.
   - *Why it matters:* the REF frames get most of their realism from one strong key light: bright sun-side faces, cool shadow faces and backlit silhouettes. Without it, depth and form read flat even with outlines.
   - *Cheap fix:* drive the directional light from the same azimuth and elevation as the sky sun. In the toon ramp, set a hard 2-step lit/shadow ratio of about 1.0 / 0.55, a warm tint on lit faces and a cool, sky-coloured tint on shadow faces. At dusk, add a thin rim term on the sun side of silhouettes. This is one uniform plus a ramp tweak.

4. **Water reads as fog.** — **cheap**
   - *What I see:* in `boost_2` the sea on the left (x≈0–900, y≈380–780) is the same flat lilac as the haze, with no horizon line. In `high_1` (x≈900–1650, y≈480–600) the bay is an undefined pale plane with grey city blobs on it. Only the near river in `patrolview_1` and `day_1` reads as water.
   - *Why it matters:* the REF dusk frame is built around sun glint on water. Water is also the cheapest scale and depth cue an open-world city has.
   - *Cheap fix:* water shader = Fresnel lerp(deep navy, sky-horizon colour) + one anisotropic sun-glint streak (pow(dot(reflect, sunDir))) stretched toward the camera. Add 2–3 scrolling comic "ripple dash" lines in ink colour, fogged with a *lower* fog density than land so the coastline holds its edge.

5. **Haze is a single flat lilac with a hard world edge.** — **cheap**
   - *What I see:* `patrolview_1` has a visible horizontal band/edge (top-left, y≈150–210) where the ground plane ends, then a strip of grey rectangles as the far skyline. `high_1` and `boost_2` show the same uniform lavender soup beyond ~1 km, and mid-ground value contrast collapses.
   - *Why it matters:* aerial perspective is how AAA sells scale. Right now it reads as "draw distance".
   - *Cheap fix:* (a) Tint the fog colour by view-direction · sunDir (warm toward the sun, cool away), plus height fog that is thicker near the ground than at roof level. (b) Ring the world with one skyline-silhouette cylinder or billboard band (2–3 layered parallax strips with lit-window dots at night), and hide the ground-plane edge inside it. (c) Lower the fog start so the transition is gradual and the near-mid distance keeps contrast.

6. **Window moiré and pinstripe noise on mid-distance facades.** — **cheap**
   - *What I see:* in `low_1` the left towers (x≈0–560) are a speckled checker. In `day_2` the left towers (x≈0–420) show fine vertical pinstripes. `cruise_1` has its centre towers (x≈560–920) shimmering mesh-like.
   - *Why it matters:* it looks broken in motion (crawling), and it fights the ink outline style.
   - *Cheap fix:* make sure the window textures have mipmaps and `anisotropy = renderer.capabilities.getMaxAnisotropy()` (or at least 4). In the shader, fade the window pattern to its average facade colour once a window is smaller than ~3 px (use fwidth on the window UV). Keep the halftone, but clamp its screen-space frequency.

7. **Lit-window patterns look like pixel-art glyphs, and window scale changes building to building.** — **cheap**
   - *What I see:* in `boost_1` the right tower (x≈1120–1270) has lit windows forming letter-like blobs, and `night_2` and `cruise_1` have Tetris shapes. In `low_1` unlit windows carry small "x" marks that read as text. Floor height varies wildly: `vice_1` and `vice_2` have ~6 chunky floors per screen next to `cruise_2` towers with ~80 tiny floors at similar depth.
   - *Why it matters:* window rhythm is the main scale cue a city has. When it is inconsistent, the towers read as different-scale props.
   - *Cheap fix:* use one world-space floor height (~3.5 m) and window width for all buildings, with variety from facade type, not scale. For lit windows, hash per *floor* and per *column band* (whole lit floors, lit vertical stacks, a sparse random scatter) instead of 2D noise. Use 2–3 colour temperatures (warm, cool office, TV-blue), and drop the "x" glyph on unlit windows.

8. **Roofs are empty slabs, and mid-ground colours are toy-saturated.** — **medium**
   - *What I see:* in `night_1` and `day_1` the near roofs (x≈900–1350, y≈530–640) are flat planes with at most one box. Mid-ground blocks in `day_1`/`day_2` (x≈1210–1380, y≈400–700) and `patrolview_2` are hot pink, cyan and violet.
   - *Why it matters:* in a flight game, roofs are what you look at most. In REF high altitude the roof clutter is the texture of the city. Candy colours read "Lego", not "Metropolis".
   - *Cheap fix:* one InstancedMesh kit (AC boxes, water tower, stair bulkhead, antenna, helipad decal, parapet lip) scattered by building seed, 3–6 items per roof, with LOD culled past ~400 m. Restrict the facade palette per district to 3–4 desaturated hues plus one accent. Keep the neon saturation for vice only.

9. **No contact shading or altitude cue.** — **cheap**
   - *What I see:* buildings meet the ground with no darkening in any frame. At rooftop height (`low_1`, `night_1`) nothing tells you how high she is above the roof below.
   - *Why it matters:* it makes buildings look pasted onto the ground, and it makes "skimming" feel like nothing.
   - *Cheap fix:* (a) A vertical AO gradient on facades (darken the bottom ~15–20% of every building, more in narrow streets) plus a dark blob decal around each footprint. (b) A soft hero drop-shadow blob raycast straight down onto roofs and streets, scaled and faded by height. This is the classic flight-game altitude cue, and one raycast per frame is enough.

10. **Speed and boost are not readable.** — **cheap**
    - *What I see:* `boost_1` and `boost_2` look almost the same as cruise: a few thin streaks (`boost_2`, bottom-right), no visible FOV change, cape and hair static.
    - *Why it matters:* boost is the main verb of flight, and the frames don't show it.
    - *Cheap fix:* on boost, FOV +10–14° eased in over 150 ms, a screen-space radial speed-line overlay in ink style (an additive or multiply quad with a scrolling texture), a camera pull-back of 1–2 m, and a short cape and hair flutter. Car light trails already exist in the street canyons (`low_1`); stretch them with speed.

11. **Ground plan is a uniform board-game grid.** — **medium**
    - *What I see:* in `patrolview_2` (x≈640–1688, y≈260–780) every lot is the same green-dotted tile and the orange arterial grid is perfectly regular. `patrolview_1` has the same lot texture across districts.
    - *Why it matters:* from high patrol the ground is half the frame, and the repetition is obvious.
    - *Cheap fix:* 4–6 lot variants (parking with car dots, plaza, park with tree clusters, rail yard, construction pit) chosen by hash. Add one or two diagonal avenues or a bent street so the grid breaks. Vary the street tone per district. Darken asphalt so the orange arterials don't read as glowing.

12. **Dive landing: no ground rush, and the hold is dead.** — **cheap**
    - *What I see:* in `dive/brawl3d` and `dive/club3d`, from 150 to 900 ms she hangs head-down at screen centre while the ground barely approaches. Focus lines only appear around 650 ms, and the cut to the flash at 1000 ms happens while still visibly high. The 150 ms frame is an awkward flat belly-flop pose. Frames 1400–1650 are identical (static burst, static puffs). In `brawl3d` at 1150–1650 the shockwave ellipse floats over the distant city with no ground under it. The radiating ink cracks plus the tiny splayed hero read as a *spider*, especially at club 1400–1650.
    - *Why it matters:* the punch of a landing is built from anticipation (ground rushing up), then impact, then follow-through. Right now the anticipation is missing and the hold reads as a loading freeze.
    - *Cheap fix:*
      - Ease-in the camera descent (exponential) so the roofs visibly fill the frame by 850–950 ms.
      - Ramp the FOV and focus lines from about 400 ms.
      - Skip or shorten the belly-flop pose by going straight from hover to head-down in ~100 ms.
      - Frame the landing camera low on a ground or rooftop plane so the ring and cracks sit on a surface, as the club rooftop does.
      - Make the hero ~1.5× bigger in the impact frame, and draw the cracks as a ground decal in a lighter, ground-tinted ink, not black lines from her body.
      - During the hold, add a 2–3% scale pulse or wobble on the burst, drifting dust puffs, a decaying camera shake and a few debris chips, so it never looks frozen while loading.

## Bugs and glitches (look broken, not just unpolished)
- **`fly3d_high_2`, lower third:** towers right under the hero render with no windows, outlines or halftone (LOD or material fallback). This is the most visible defect in the set.
- **`fly3d_cruise_2`, lower-left x≈430–840, y≈590–660 and top of centre tower x≈800–1000, y≈110–130:** thin yellow and cyan lines float across and in front of buildings at angles that don't follow the facades. They look like stray debug or wire lines. **`vice_1`** (pink horizontal lines spanning the gap between buildings, x≈700–1000, y≈590–610) and **`vice_2`** (cyan band x≈360–800, y≈290–330, starting outside the tower silhouette) look like the same feature. If these are meant as neon trim, they need to follow the facade, have thickness and glow, and stop at building edges.
- **`fly3d_boost_1`, right edge x≈1560–1688, y≈260–345:** a hollow orange ring arc, apparently the sun disk drawn as outline only with no fill. It reads as a hoop or marker.
- **`fly3d_patrolview_1`, top-left y≈150–210:** a hard horizontal edge where the ground plane ends inside the haze, then cardboard skyline rectangles.
- **`fly3d_high_1`, x≈900–1650, y≈480–600:** the far city is a flat dark decal-like silhouette on a pale plane, with no height read.
- **`dive/brawl3d` 1150–1650:** the shockwave ring and dust puffs hover in mid-air over the skyline, with no landing surface in frame.
- **`dive/*` 1000 ms:** the zone HUD (HEALTH/POWER, JUMP/PUNCH) is already swapped in under the flash. It is mostly hidden, but it pops through the semi-transparent flash. Swap it at the wipe (1750 ms) instead.

## Keep list (must not be lost)
1. **Near-tower comic treatment and silhouette variety:** ink outlines, halftone, art-deco setbacks and spires (`cruise_1`, `day_2`, `night_2`). The skyline silhouettes are genuinely varied and stylish.
2. **The day look** in `day_1`: blue aerial haze, river with green park banks, warm roofs. It is the closest frame to the REF and the palette target for the other times of day.
3. **The patrol-view composition** in `patrolview_1`: higher, pitched-down camera, river cutting through, city filling the frame. Make it the template for all high-altitude flight.
4. **The vice district identity:** magenta and blue facades with chunky lit windows and street-canyon light trails (`vice_2`, `low_1`). Keep the mood, and fix only the floating lines and window scale.
5. **The dive-landing structure:** focus lines, then flash, then onomatopoeia burst with "TRIANGLE CLUB"/"KIDNAPPING" sub-tag, then diagonal panel wipe, then title card, at ~1.9 s total. The length is right. The club version, landing on a rooftop against the neon skyline, is the one to match.
