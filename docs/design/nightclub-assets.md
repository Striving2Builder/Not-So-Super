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

## Batch 1 result (2026-10-04)
Used: walk _06/_11/_15 (main floor), _02 (bar), _10/_13 (corridor), _14 (dark room), djview _03/_05
(lounge), djview _11 (DJ still), video v8 (DJ loop), bar_closeup (the inked one). The crowd dancers are
baked from our own models (`tools/nightclub/dancers.js`), so no dancer clips are needed.

## Batch 2: the rest of the flagship (Club Nova)
Drop into `assets/nightclub/incoming/batch2/`. Every image **16:9, 1280×720 or larger**, **no people**,
no text/logos. **Attach `mainfloor_walk_11.jpg` as a style reference** if the tool allows (it is the
look: inked linework, crosshatching, cyan/magenta/amber light, haze).

**Style block v2** (paste first): *Comic book noir illustration, bold black ink linework and
crosshatching like a graphic novel, flat cel colours, atmospheric haze, dramatic coloured light from
behind. Nightclub interior. No people, no text, no logos.*

**Walk rooms**: make **3 variations of each**, same room and palette, camera at eye level looking
across the room at its back wall, back wall's foot about 2/3 down, open floor in the front third,
**1–3 arched or framed doorways in the back wall**. Name `<room>_01.jpg` … `_03.jpg`.
- `entrance`: *[style] A nightclub entrance lobby: a coat-check counter with hanging coats, velvet
  rope stanchions, a ticket window glowing pink, a neon arrow pointing deeper inside, street door
  light spilling in from the side. Magenta and warm amber light.*
- `balcony`: *[style] A VIP balcony running along the back of a nightclub: a brass railing across
  the front third, beyond it the dance floor below glowing cyan with light beams rising through the
  haze, plush booths along the back wall, gold accents.*
- `vip`: *[style] A private VIP room in a nightclub: a curved velvet sofa, a low table with a
  champagne bucket, a gold-framed mirror, red velvet curtains, a two-way window glowing on the back
  wall. Deep red and gold light, smoky.*
- `restroom`: *[style] A nightclub restroom: a row of sinks under backlit mirrors, graffiti on the
  tiles, three stall doors along the back wall (one ajar), flickering teal light, wet floor
  reflections.*
- `office`: *[style] A nightclub back office: a cluttered desk with a green-shaded lamp, security
  monitors on the wall, filing cabinets, a wall safe, a two-way mirror looking onto the club, cold
  fluorescent and green light.*
- `storage`: *[style] A nightclub cellar storeroom: stacked crates and kegs, metal shelves of
  bottles, a caged section with a padlock, a single bare bulb, pipes along the ceiling, cold blue and
  sickly green light.*
- `alley`: *[style] The back alley exit of a nightclub at night: a steel stage door under a red bulb,
  dumpsters, wet cobblestones, fire escape, steam from a grate, neon spill from the street, a van
  parked in the shadows.*

**Close-ups** (investigation scenes): **2 variations each**, objects large and clearly separated
(each becomes a tap spot), shot from the customer's eye level. Name `closeup_<name>_01.jpg`.
- `closeup_dj`: *[style] Close-up of DJ decks on a booth: two turntables, a mixer with glowing
  faders, a phone propped against the mixer showing a map pin, a set list taped down with one track
  circled, a small glowing green vial tucked behind the mixer, headphones.*
- `closeup_vip`: *[style] Close-up of a VIP table: an ice bucket with champagne, three glasses (one
  with lipstick), a silver tray with a dusting of glittering green powder, a business card for a
  shipping company, a wristwatch left behind, a matchbook from a motel.*
- `closeup_restroom`: *[style] Close-up of a restroom sink counter: a cracked mirror with a phone
  number written in lipstick, a soap dispenser, a crumpled receipt, a small zip bag of glowing green
  pills stuck behind the paper towel holder, a dropped earring.*
- `closeup_office`: *[style] Close-up of a desk in a nightclub office: an open ledger with columns of
  numbers, a stack of cash with a rubber band, a burner phone, a framed photo, a security monitor
  showing a hallway, a key on a red tag.*
- `closeup_coatcheck`: *[style] Close-up of a coat-check counter: numbered claim tickets, a leather
  jacket with something bulging in the pocket, a guest list clipboard with names crossed out, a bowl of
  mints, a VIP wristband.*

**Batch 2 result (2026-10-04):** all 31 used or kept. Walk plates: entrance 01+03, balcony 01+02+03,
vip 01 (mirrored)+03, restroom 01+03, office 01+03, storage 01+02, alley 01+03. Close-ups: coat check
01, DJ 02, VIP 02, restroom 02, office 01 (the other variations are spares for a second club).

**Later**: batch 3 = the blackout (wake-up rooms, memory-fragment comic panels); batch 4 = a second
club's set (a palette swap of the same rooms is fine).
