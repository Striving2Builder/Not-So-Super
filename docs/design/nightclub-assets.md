# Nightclub assets: specs and prompts for the user

Companion to [nightclub.md](nightclub.md). The user produces these with their own tools (AI image and
video generators, Blender) and drops them into `assets/nightclub/incoming/<batch>/` using the file
names below. The director keys, crops, compresses and wires them in.

## Style block (paste at the start of every prompt)
> Comic book noir illustration of a nightclub interior. Bold black ink outlines, flat cel shading,
> halftone dot texture in the shadows. Thick atmospheric haze lit from behind, volumetric light beams
> from a ceiling lighting rig, thin laser fans. Limited palette: deep blue and cyan haze, magenta and
> amber accents, inky black shadows. Moody, cinematic, high contrast.

Always add: **no text, no logos, no brand names, no real people, no superhero symbols, no
watermark.** If a tool takes a negative prompt, put those there plus: photorealistic faces, blurry,
low detail.

## Plate rules (every walk-view room)
No panoramas needed (generators can't make them): a room is **2–3 normal 16:9 images ("bays") of
the same room**, joined by `tools/nightclub/stitch.py` behind a foreground pillar.
- 16:9, 1280×720 or larger; **2–3 variations of the same room** (same palette and style) per room.
- Looking into the room from the dance floor: the back wall's foot around 2/3 down, open floor in the
  front third (she walks along the front), no people.
- **Arched doorways on the back wall are great**: they become the room's doors (neon signs go above).
- Ink linework (walk _06/_11/_15 style) matches the game best; painterly is OK for dark rooms.

## Batch 1: the look test (needed first)
Drop into `assets/nightclub/incoming/batch1/`.

**1. `mainfloor_djview.mp4`: the set-piece loop (video)**
- 16:9, 1920×1080 (or the tool's highest), 6–8 s, **static locked-off camera**, seamless loop
  (first and last frame match, or I'll cross-fade).
- Prompt: *[style block]* Wide shot from the back of a packed dance floor looking toward a raised DJ
  booth on a steel truss stage. Two DJs as dark silhouettes behind glowing decks. Light beams from the
  ceiling rig sweep slowly through the haze; thin cyan laser fans across the ceiling. The crowd is a
  sea of solid black silhouettes with raised hands, darker and larger in the foreground. Static
  camera, seamless loop, slow motion.

**2. `mainfloor_djview.png`: a still of the same shot**
- Same prompt as 1 as an image; it's the poster frame while the video loads.

**3. `mainfloor_walk.png`: the walk-view plate (image)**
- 4096×1024 (4:1), plate rules above.
- Prompt: *[style block]* Side view at eye level of a large nightclub dance floor, like a 2D
  side-scrolling game stage. Polished dark floor reflecting the lights, a steel truss and lighting
  rig along the top, the DJ booth stage at the right side, speaker stacks, a bar glowing faintly in
  the far left background, arched doorways at both ends. Thick haze, backlit beams. No people.
  Panoramic, flat side-on composition.

**4. `mainfloor_front.png`: the foreground occluders (image)**
- 4096×1024, **pure green background (#00FF00)**, same proportions as 3.
- Prompt: *[style block]* Only the foreground elements of a nightclub in solid black silhouette on a
  pure flat green background: two thick steel pillars, a railing section, hanging cables, a speaker
  stack edge. Nothing else, flat green everywhere else.

**5. `dancers_01.mp4` … `dancers_06.mp4`: silhouette dancers (video)**
- Vertical or square, one full-body dancer per clip, **solid black silhouette on pure green**, 4 s
  seamless loop, static camera, the whole body always in frame.
- Prompt: *A single person dancing in a nightclub, full body, rendered as a solid flat black
  silhouette with no detail, on a pure flat green (#00FF00) background. Static camera, seamless
  loop.* Vary it per clip: arms raised, swaying, jumping, head-nodding, couple dancing, someone
  holding a drink.
- Alternative: I can make these locally in Blender from Mixamo dance clips on our existing rig
  (consistent proportions, no generator needed). That costs session time instead of the user's.

**6. `bar_closeup.png`: one investigation close-up (image)**
- 16:9, 1920×1080.
- Prompt: *[style block]* Close-up of a nightclub bar counter from the customer's side, eye level.
  Glowing bottle shelves behind, a half-empty cocktail with a strange faint glow in it, a crumpled
  napkin with writing (unreadable scribbles), a small zip bag of glittering pills half hidden under a
  coaster, a phone face down, a tip jar, wet rings on the counter. Moody backlight, haze.
- Every clue object in an investigation prompt should be visible, separate from the others and not
  tiny: they become tap spots.

**7. `club_*.mp3`: music**: the user's own tracks; drop 1–3 in the batch folder.

## Later batches (prompts come per batch)
- **Batch 2, the flagship rooms:** walk plates for the entrance + coat check, bar, lounge/seating,
  dark dance room, VIP balcony (plus a looking-down view of the main floor), one VIP room, restrooms,
  back office; foreground occluders for each; 4–6 investigation close-ups; informant silhouettes with
  a coloured rim light.
- **Batch 3, the blackout:** the blackout cinematic (POV: lights smear, panels crack apart, fade to
  black), 3 wake-up rooms (VIP back room, cellar, the inside of a van), 6–8 memory-fragment panels
  (comic panels of the night, out of order).
- **Batch 4+, the room kit:** 3 variants per room kind under the plate rules, plus signage and props
  as separate green-screen images, so the engine can mix them.
