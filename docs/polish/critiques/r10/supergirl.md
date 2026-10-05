# Supergirl hero critique (round 10)

Judged from images only: `shots/crit-r10/supergirl/*`.

## Scores
- **Against AAA stylised hero renders (Spider-Man, Hi-Fi Rush, Fortnite, LEGO Batman): 4/10.** The costume colours and the ink style are right, and the face holds up at close range. The gameplay camera does her no favours, though: hair, cape and boost do not read, and the frame always shows the underside of the skirt.
- **Against the best HTML5/WebGL game heroes: 6.5/10.** For a 14k-triangle skinned model in a browser she is above average. She is recognisable at phone size, the brawler sprites are good, and the cel and ink look is consistent. A few cheap fixes would move her to 7.5–8.

## Ranked fixes (most impact first)

1. **The chase camera is an upskirt shot in every in-game frame.** Cheap–medium.
   - *What I see:* in `ingame_cruise_1`, `ingame_boost_1`, `ingame_low_1` and `ingame_night_1` the centre of the frame is the inside of the skirt: bare upper thighs, the curve of the buttocks and blue briefs. Head and shoulders are the smallest, farthest part of her. `chase_side` (cruise, boost, turnL) and the descend chase show the same.
   - *Why it matters:* this is the frame players watch 90% of the time. It is unflattering, it looks bad in any trailer or screenshot, and it pushes the hero's identity (S-shield, cape, hair) to the far edge.
   - *Fix, in this order:*
     - (a) Raise the chase camera's pitch so it looks down on her back by about 10–15°, instead of level with or below her hips. The cape and S-shoulders then become the frame.
     - (b) Pitch her body so the hips sit lower than the shoulders in cruise. Right now the legs rise toward the lens.
     - (c) Give the skirt a heavier, pinned-down underside: stiffer skirt bones, or a few skirt vertices weighted to the thighs so it stays closed in flight.
     - (d) Paint the skirt's inner face a dark red and the briefs in suit red, so whatever still shows reads as costume rather than skin.

2. **The cape reads as a ribbon or a small dark flag, not a cape.** Medium.
   - *What I see:*
     - `chase_side`, every side view: edge-on it is a thin plank about hip length, narrower than the shoulders. In slow it is a stiff horizontal board, and in hover a black stick.
     - In-game it is a small crumpled maroon patch sitting on her back like a backpack.
     - Climb nape (`close_b` row 1): it starts at mid-back, below the hair, and does not hang from the shoulders.
   - *Why it matters:* the cape is the main motion and speed signal for a flying hero, and the second-biggest part of her silhouette after the hair.
   - *Fix:* in Blender, widen the cape root to the full shoulder line (to the deltoids) and lengthen it to the calves, about 1.4× its current length. In the cloth sim, add a small amount of lateral billow (sideways spread) so it never goes fully edge-on. It should keep a curved, cupped cross-section, not a flat sheet. Triangle cost is near zero.

3. **The cape lining is maroon-black from the gameplay camera.** Cheap.
   - *What I see:* the chase camera mostly sees the shadow side of the cape. In every in-game shot it renders as maroon close to black (`ingame_night_1` is the worst), and on the night sky it merges into the outline.
   - *Fix:* give the backface (inside) of the cape its own flat colour, a saturated mid-red about 15% darker than the outside, never below roughly #8a1020. Alternatively, clamp the cel shadow band on the cape material so it cannot go darker than that. This is a shader tweak.

4. **The hair is a bald yellow helmet from behind.** Medium.
   - *What I see:*
     - The chase and nape views (all in-game shots, `close_a` nape, the cruise/boost head views) show a smooth flat-yellow dome with low-poly facet blotches in the cel shading.
     - There is no lock separation, no ink strand lines and no shine.
     - The hem is a jagged alpha-cut fringe with loose shreds and floating flecks.
   - *Why it matters:* from the gameplay camera the back of the head is her face, and blonde hair is half of how players recognise Supergirl.
   - *Fix:*
     - (a) In the hair texture, paint 4–6 dark ink strand lines that flow from the crown to the hem, plus one stylised anime shine band (hard-edged, pale cream) across the crown.
     - (b) Smooth the hair normals, or bake a smooth normal, so the cel bands follow the dome instead of the faces.
     - (c) Re-cut the hem into 5–7 clear pointed locks instead of the ragged alpha. Opaque geometry works better here than alpha-cut cards.
     - (d) Add one or two loose lock bones driven by flight velocity so the hair streams back. Today it only sags, which leads into fix 6.

5. **Boost looks the same as cruise from the chase camera.** Cheap.
   - *What I see:* the chase and side views for cruise and boost in `chase_side`, and `ingame_boost_1` against `ingame_cruise_1`, are nearly identical poses. The cape is no longer and no straighter.
   - *Fix (pose and animation):* one fist driven forward with the arm locked straight, the other arm pinned to her side, legs pressed together with toes pointed, and the chin tucked. Cloth wind multiplier about 2×, so the cape stretches flat and long. Add a slight stretch on the forward axis at boost onset (squash-and-stretch, about 5% for 150 ms).

6. **Turns do not read as banks, and turnL does not mirror turnR.** Cheap.
   - *What I see:*
     - The turnR chase shows her flat in profile, which looks like a 90° yaw.
     - The turnL chase is a curled, foreshortened knot.
     - Neither has a clear roll line through the shoulders.
   - *Fix:*
     - Animate the turn as a 30–40° roll about the forward axis, with the inside shoulder dropped and the head turned into the turn.
     - Bring the outside arm across slightly, like a swimmer's lead.
     - Make turnL an exact mirror of turnR.
     - Keep yaw on the root and put the bank on the spine and pelvis, so the chase camera sees a tilted back, not a profile.

7. **The dive reads as falling, not a power dive.** Cheap.
   - *What I see:* the dive side, chase and close-ups (`close_b` row 2) show her arms limp along her body. The hair hangs ahead of her head toward the ground, gravity only, and the cape is a rigid V sticking out.
   - *Fix:* both arms locked overhead toward the ground (or one fist leading), hair and cape streaming back toward her feet. That means driving the hair and cape from airflow (the opposite of velocity), not world-down.

8. **Skin shadow is too dark and orange, so the thighs look like a different skin tone from the face.** Cheap.
   - *What I see:* in-game the thigh shadow samples at about RGB(185,100,65), while the face in close-ups is a pale peach. At phone size the thigh shadow reads as tan tights or a darker skin than her face. Hands share the dark tan.
   - *Fix:* lift the skin material's shadow band to a desaturated, rosier tone, for example the lit colour × (0.85, 0.75, 0.75). Do not let the warm or red bounce push it to orange.

9. **The ink outline is lumpy, haloed and speckled at gameplay size.** Cheap–medium.
   - *What I see:*
     - In-game the outline is about 6–8 px thick, with blobby bulges at the boots and knees and notches near the skirt.
     - A pale grey fringe sits outside the black, visible on the night and dusk skies.
     - In `chase_side` and the slow and hover cells, stray black specks and scribbles gather at the nape and hair base.
   - *Fix:*
     - Scale outline width by screen-space depth so it stays about 3–4 px at chase distance.
     - Clamp the dilation so a single pixel cannot form a lump.
     - Composite the outline with premultiplied alpha, or use a tighter AA kernel, to remove the grey halo.
     - Drop the outline on hair-card edges below a size threshold to kill the specks.

10. **Lab and secondary camera framing and texture noise.** Cheap.
    - The skirt's dark halftone or dot speckle reads as dirt at gameplay size (in-game skirt, close-up skirts). Either reduce its contrast by about 50% or keep it only in the shadow band.
    - In close-ups the hand-model fists are large and brown next to slim forearms. Re-tint them to fix 8's skin ramp.
    - The lab "head" camera clips into the body in cruise, boost and descend: it fills the frame with skirt and thigh. The "face" camera cannot see the face in prone states. Only the lab is affected, but the head and face rows are not usable for judging the face until those cameras are offset off the body's forward axis.

## Bugs and glitches
- **Blue (sometimes white) flat triangle or plate at the nape and cape root.** It shows in climb nape (`close_b` row 1, right: an unshaded blue rhombus with no outline between the hair and the cape), the cruise side (white sliver at the nape, `chase_side` row 1 right) and the turnR nape. It looks like a cape-attachment or collar polygon with a wrong material or normals, poking through. The last brawler sprite also has a blue patch on the hair.
- **The cape renders in front of her body in hover.** In the hover chase she faces the camera and the cape is drawn over her front, across her legs, with a thick black ink stroke running down the torso. Either the cape is clipping through her body or it is wrapping around to the front. Collision with the body, or a hover cape pose that hangs behind, is needed.
- **The hover yaw appears flipped against the camera rig.** In hover the "nape" camera sees her face and the "face" camera sees the back of her head (`close_b` row 4). If the hover is meant to turn her toward the camera, fine. Otherwise the model is rotated 180°.
- **White slivers on the skirt's inner waist edge and hem, and white flecks on the boot edges.** See `ingame_cruise_1` / `ingame_low_1` zoomed, and the cruise/boost head close-ups. These are probably unlit backfaces or rim light leaking through the outline.
- **Hair hem alpha shreds.** Floating fragments, some showing blue or background colour, sit at the hair tips in the hover nape and slow face close-ups.
- **Faceted cel banding on the hair dome.** Hard-edged patches follow the polygons rather than the form (`close_a` / `close_b`, every hair close-up).
- **Lab "head" camera near-plane clip.** Cruise, boost, turnL and descend show the inside of the skirt and thigh. Only the lab is affected.

## Keep list (do not lose these)
1. **Flat costume colour blocking with the thick comic ink.** Royal blue, red and gold, and a clean S-shield on the chest. At phone size she is unmistakably Supergirl from her colours alone.
2. **The face at close range** (climb face, slow face, hover nape). The soft blush, small red lips and blue eyes are an appealing, restrained, stylised face. Do not push it toward anime-big eyes or add heavy ink to it.
3. **The climb pose and the slow-glide pose.** Climb's single fist-up diagonal is the most heroic read in the sheet. Slow's upright, legs-dangling decelerate is clear and different from cruise.
4. **The brawler sprites** (bottom strip). Good silhouettes: the guard, the cross and especially the high kick read instantly, and the ink matches the 3D model.
5. **The thick dark outline plus a light separation edge**, which keeps her readable against busy day and night city backgrounds. Tidy it (fix 9) but do not remove it.
