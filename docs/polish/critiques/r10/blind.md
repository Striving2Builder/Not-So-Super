# Blind critique: flying3d-r10crit (8 pairs)

## Per-pair verdicts

| Pair | HTML5 | Confidence | Tells | HTML5 vs AAA partner |
|---|---|---|---|---|
| 1 | **B** | 99% | Toy-block city from high altitude: flat, saturated roof caps and no roof clutter. Behind the river the city turns into empty footprint tiles with floating impostor rows in purple fog. The hero's hair is a solid yellow helmet and the cape is a stub. (Partner A: Prototype at the Manhattan bridge) | **3.5** |
| 2 | **B** | 99% | The hero is a stiff plank seen exactly side-on, with the cape plastered flat on the back. The hero texture looks low-resolution and smeared. A big empty purple sea fills the left half. (Partner A: GTA V Superman mod) | **3** |
| 3 | **B** | 99% | Towers are textured on one face only (the left faces are blank tan). The pyramid roof carries the window texture. The cape is a stiff dark-red paper flap. (Partner A: LEGO DC) | **3.5** |
| 4 | **B** | 98% | Facades are window-tile grids with no depth or reveal. Trees are green blobs. The hero is horizontal, rigid and flat-lit. (Partner A: Prototype) | **3.5** |
| 5 | **B** | 99% | The hero has the same daylight saturation in a night scene, so she reads as a pasted-on sticker. The rear angle puts the crotch and underwear at screen centre. The cape is a stiff flap. (Partner A: GTA V jetpack) | **4** |
| 6 | **A** | 99% | A plank pose, blank-faced head and white halo around the ink outline. Stray yellow and cyan lines cut through the towers. (Partner B: Saints Row IV) | **3.5** |
| 7 | **A** | 99% | A near top-down map view of uniform boxes. The hero is vertical with almost no cape. The window texture turns into moire noise at distance. (Partner B: Marvel's Spider-Man 2) | **2.5** |
| 8 | **B** | 99% | A low rear chase camera frames the hero's hips and underwear. Hair is a solid ball and the cape is a rigid slab. The plaza is flat grey with blob trees. (Partner A: Miles Morales) | **2.5** |

The hero was the deciding tell in every pair. The city alone would have needed a second look in pairs 3, 5 and 8.

## 1. Overall score

- **vs AAA: 3 / 10.** The style is consistent, but the hero model, pose and the toy-block mid-distance read clearly as a budget game.
- **vs the best HTML5/WebGL games: 6.5 / 10.** It is above most three.js city and flight demos on mood: dusk sky, ink edges and night windows. It falls behind the top showcase pieces (Bruno Simon-tier polish, Slow Roads' atmosphere) on character quality and world-edge handling.

## 2. Ranked fixes (most impact first)

### 1. Hair is a solid yellow ellipsoid with no face [hero]
- **What I see:** In every shot (1B, 2B, 4B, 6A, 8B, most clearly in the 3x crops) the head is a smooth yellow "bowling ball" with a few ink scratches. No face, chin or strands are visible from any chase angle.
- **Why it costs the AAA read:** Head and hair are where the eye lands first. AAA flyers (2A, 4A, 8A) always show a readable head silhouette, and the hair or hood reacts to speed. A rigid yellow ball reads as a placeholder.
- **Cheapest fix:** Add 4 to 6 hair ribbon cards (thin strip meshes, roughly 6 segments each) from the crown, trailing backwards. Give them a vertex-shader sine sway scaled by speed, a darker ochre underside band and 2 or 3 ink strand lines in the texture. Break the back of the head silhouette into 3 or 4 points. Pitch the head up 15 to 20 degrees so the jaw and nose show in side views.
- **Cost:** cheap to medium.

### 2. The cape is vestigial [hero]
- **What I see:**
  - In side views (2B, 4B, 6A) it is a red sheet glued flat on the back, ending at the hips.
  - In 3B, 5B and 8B it is a stiff dark-red flap sticking up off the shoulders like folded paper.
  - In 1B and 7A it is almost invisible.
- **Why it costs the AAA read:** The cape is the genre's speed signifier. In 2A it is a huge trailing sail that doubles the silhouette. Without it the hero reads as a falling figure, not a flyer.
- **Cheapest fix:** Real cloth simulation is too expensive. Use one plane of about 8x12 segments pinned at the shoulders, long enough to reach the calves. Drive it in the vertex shader with a travelling sine wave whose amplitude and frequency scale with speed. Add a lift term so the free end trails behind and slightly above the body, never on it. Make the inside face a darker red so the cape reads as two-sided. Keep the ink outline on it.
- **Cost:** cheap to medium.

### 3. Rigid plank pose and bad camera framing [flight]
- **What I see:**
  - 2B, 4B and 6A: perfectly straight body, legs locked together, both arms dead forward, seen exactly side-on. She looks like a mannequin on a wire.
  - 1B, 5B and 8B: the low rear chase cam puts the skirt and underwear at the optical centre of the frame.
- **Why it costs the AAA read:** AAA poses have a line of action: an arched chest, one knee bent, one fist forward with the other arm back, and the head up (2A, 4A, 7B). The camera sits off-axis so the body reads in three-quarter view.
- **Cheapest fix:**
  1. Author one "cruise" pose with an arched spine, a 20 to 30 degree bend in one knee and one fist forward.
  2. Add procedural roll into turns (up to about 25 degrees), pitch from vertical speed, and spring-lagged secondary motion on the limbs.
  3. Default the chase camera to 15 to 25 degrees above and 20 to 30 degrees off the tail axis, with the hero in the lower-centre third. Clamp the camera so it never sits below the hips.
  4. Lengthen the skirt or add matching shorts so rear views never frame the crotch.
- **Cost:** cheap.

### 4. The hero is lit like a sticker, not lit by the scene [hero]
- **What I see:** In 5B (night) she is exactly as saturated and bright as in the dusk shots. The surrounding city is dark navy and amber, so she floats on top of it. A grey-white halo sits outside the black ink outline on every shot (clearest on the boots and legs in the 4B and 6A crops).
- **Why it costs the AAA read:** Every AAA frame here (4A warm, 6B red neon, 7B golden) tints the character with environment light. That tint is what puts the hero in the world.
- **Cheapest fix:** Multiply the hero's albedo by a time-of-day ambient colour. Add a fresnel rim term coloured from the sky gradient (orange at dusk, cool blue at night). Remove the halo by premultiplying alpha in the outline pass, or by shrinking the outline's outer edge by 1px.
- **Cost:** cheap.

### 5. The mid-distance city reads as toy blocks [city/buildings]
- **What I see:** In 1B and 7A every block is a plain extruded box with a flat, saturated roof (purple, teal, pink, red) and no parapet, roof clutter or ground contact. It looks like a voxel playset.
- **Why it costs the AAA read:** AAA roofscapes (5A, 6B, 4A) are mostly busy grey and brown roofs with water towers, AC units and stair bulkheads. The variety lives in the roofs, not in candy-coloured caps.
- **Cheapest fix:**
  - Desaturate roof caps towards grey-brown and keep colour only on facades.
  - Add a darker parapet lip (an inset roof).
  - Add 1 to 3 instanced roof props per building: water tower, AC box, bulkhead. Use one InstancedMesh per prop type.
  - Add vertex-colour AO: darken the bottom 10 to 15% of each facade and the inner roof edge. This is the allowed contact-shading substitute for shadows.
- **Cost:** cheap to medium.

### 6. The world edge and far LOD collapse [city/buildings]
- **What I see:**
  - In 1B (upper left) the land beyond the river is empty footprint tiles, with rows of grey impostor skyline hovering in the fog. The rows are not anchored to the ground.
  - There are translucent ghost building shapes at about x 300–400, y 155–190.
  - In 7A (top band) the grid simply runs out into haze.
- **Why it costs the AAA read:** AAA cities (5A, 1A) stay dense to the horizon and only fade by atmosphere. An empty grid reveals a finite toy map, especially at High Patrol altitude where the player sees it constantly.
- **Cheapest fix:** Build a far ring of low-poly box towers merged into one mesh (1 draw call), anchored to the ground, with emissive window dots at night. Use height-based fog so tall far towers poke above the haze while the ground fades. Replace the floating impostor strips with this ring.
- **Cost:** cheap to medium.

### 7. Facade texturing is inconsistent and aliased [city/buildings]
- **What I see:**
  - 3B, big left tower: the front face has windows but the left faces are blank flat tan, and the pyramid roof carries the window texture.
  - 6A: some side faces are flat grey.
  - 1B and 7A: at distance the window grid shimmers into "x" moire noise.
  - 4B: windows are big flat tiles with no frame depth.
- **Why it costs the AAA read:** Blank faces read as unfinished placeholder boxes. Moire reads as low-end rendering.
- **Cheapest fix:**
  - Put the window material on every vertical face, darkened per face for cel lighting. Pyramid and roof faces get a roof material.
  - Turn on mipmaps and anisotropy (4x) on the facade texture, or fade window detail to the facade's average colour beyond about 300m.
  - Add a 1px dark frame and a lighter sill line to each window tile in the texture. This is free fake depth.
- **Cost:** cheap.

### 8. Weak sense of altitude in High Patrol [flight]
- **What I see:** 1B and 7A are high, near top-down views with uniform contrast from foreground to mid-ground. Only the far band is fogged, so it reads as looking at a map, not as hanging 300m over a city.
- **Why it costs the AAA read:** 5A sells height with atmospheric perspective: contrast and saturation drop steadily with distance, plus a slight tilt-shift feel.
- **Cheapest fix:**
  - Use a depth-based desaturation and contrast fade starting much closer, at about 30% of fog distance.
  - Add a subtle ground-level haze gradient.
  - Push the camera pitch towards the horizon (about 25 to 35 degrees below horizontal instead of near-vertical) so the skyline is always in frame.
  - Add a gentle FOV widening with altitude.
- **Cost:** cheap.

### 9. Soft, aliased render [hero + city]
- **What I see:**
  - In the 2B and 6A crops the hero's fill texture is pixelated and smeared.
  - Tower edges in 3B and 6A stair-step.
  - The whole frame looks rendered below native resolution and upscaled.
- **Why it costs the AAA read:** Jaggies and blur on the focal character are the clearest "web game" tell.
- **Cheapest fix:**
  - Use a 1024 hero texture with mipmaps.
  - Allow a pixelRatio of 1.5 on capable devices, falling back adaptively by frame time.
  - Add an FXAA pass, which is cheap and works well with ink outlines.
  - If GPU budget is tight, render the hero at full DPR into its own pass and the city at lower DPR.
- **Cost:** medium (performance trade-off).

### 10. Ground and plazas are flat grey [city/buildings]
- **What I see:** 8B lower left and 4B lower left show flat untextured grey plaza and lawn with identical green blob trees.
- **Why it costs the AAA read:** Up close, empty ground reads as unfinished. 8A has paths, paving and varied tree tones.
- **Cheapest fix:**
  - Add a tiling paving texture with curb lines.
  - Vary tree tint per instance across 2 or 3 greens.
  - Keep the soft blob AO under trees.
- **Cost:** cheap.

## 3. Bugs and glitches

1. **Pair 6A, lower left (about x 330–640, y 450–592):** a thin yellow polyline floats through and across the towers, ignoring occlusion. A cyan dashed line runs along the tower tops at about x 600–760, y 90–125. Both look like debug, route or district-border lines rendered through geometry.
2. **Pair 6A, x ≈ 930, y 0–330:** a long dark-brown vertical stripe runs between towers. It could be a seam or gap showing a far object, or z-fighting. Low confidence; worth a look.
3. **Pair 1B, upper left (x 0–400, y 100–200):** rows of far skyline impostors hover above the fog at different heights, not anchored to the ground. Translucent ghost silhouettes appear around x 300–400, y 155–190.
4. **All hero shots:** a grey-white halo fringe sits outside the black ink outline (clearest on the boots and legs in 4B and 6A). It looks like an alpha or matte edge artifact.
5. **Pair 3B, left tower:** the window texture is mapped onto the pyramid roof faces while the adjacent side faces have no texture (blank tan). This is a material or UV assignment error.
6. **Pairs 1B, 5B and 8B:** the skirt rides up and the chase camera puts the underwear at the centre of the frame. It is not technically broken, but it reads as unintended framing and is the most noticeable thing in those shots.
7. **Pair 8B and 3B:** the cape is a rigid slab sticking up above the shoulder line, with no deformation. It looks detached rather than worn.
8. **Pair 5B, right edge (x ≈ 1265, y ≈ 310):** an orange off-screen incident marker is half cut off by the screen edge and has no distance label, unlike all the other edge markers.
9. **Pair 3B, top right (x 1180–1280, y 195–260):** a partial orange arc or ring. It could be a legitimate marker, but it reads as a stray element; verify.

## 4. Keep list (do not lose these)

1. **Night and dusk window lighting with ink edges** (3B, 5B, 8B). The amber window patterns on navy facades, the art-deco setback towers with spires and the black ink contour lines are the game's strongest look and genuinely distinctive.
2. **Dusk sky and purple atmospheric haze** (2B, 3B, 6A). The orange-to-violet gradient and layered haze give real depth and mood.
3. **Street-level life** (4B, 8B, 2B). Motion-blurred streets, warm lamp pools and car light streaks sell speed and scale when flying low.
4. **Speed lines and boost streaks** (2B, 3B). They are cheap and effective; keep them, and tie FOV to them.
5. **The bold costume read.** The primary red, blue and yellow palette with the thick ink silhouette keeps the hero readable against any background. Fix the hair, cape and pose, but keep this graphic clarity.
