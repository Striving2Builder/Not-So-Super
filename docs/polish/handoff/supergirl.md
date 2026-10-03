# Supergirl look pass: handoff

Branch based on phase-2 fc7c052. Scope: the player hero only (flight 3D/2D, brawler sprite, portraits).
TODO before reporting: merge phase-2 (stability: HeroSprite now renders through `src/offscreen3d.js`)
and re-test the sprites (keep the heroMaterial swap in HeroSprite's constructor).

## Tools
- Hero lab: `node tools/supergirl/lab.js --label NAME --port 8812 [--query only=fly|sprite&rows=hover,cruise&noink=1&hero=classic]`
  → `shots/supergirl/NAME.png`: rows = flight states (cruise, turnR, turnL night, boost, climb, descend
  night, dive, slow, hover), cols = cameras (chase, phone-size, side, front, below, head, face, nape),
  then 2D-flight and brawler sprites. Crops: `python tools/supergirl/crop.py NAME OUT rows cols [scale]`.
- Model rebuild (Blender via blender-mcp): `tools/supergirl/sg_blender.py` (docstring: prep / shell /
  build / textures / export / render) + `python tools/supergirl/paint_sg.py` (atlas repaint).
  Source model: `git show fc7c052:assets/models/supergirl.glb > shots/supergirl/work/supergirl_src.glb`.
- Baselines: `shots/supergirl/lab-base.png`, harness `shots/sg-base/` (flying + brawler street).
- Lab note: create the WebGL renderer after `loadHero()` (SwiftShader lost the context otherwise).

## Done
- `src/heropose3d.js` (new): FlightPose = attitude springs (roll with overshoot, pitch from climb angle,
  yaw slip, float bob) + blended bone offsets: cruise / boost / dive / slow glide / hover / turns.
- `src/herolook3d.js` (new): her cel material (moved out of herofly3d; hair palettes for ACES vs raw,
  painted locks kept via hairD) + `hullGeometry` (no ink hull on eyeballs/teeth/lashes/face interior).
- `src/hero3d.js`: HeroSprite uses heroMaterial (cel + rim + blonde hair) instead of raw PBR.
- `src/capefly3d.js`: narrower/shorter cape that rises off her back at speed (body reads under it).
- supergirl.glb: hair cards (3.9k tris) → one solid skinned hair shell (~2.2k tris, face opened,
  Head/Neck/Spine2 weights by height), modelled cape + back plate + lash cards removed, no clips;
  atlas repainted (flat blue/red/gold blocking, clean skin + blush, comic eyes/brows/lips, blue
  irises, lock swatch). 14.3k tris, 2.35 MB (was 17k, 3.28 MB).

- Merged phase-2 (774c006+ stability: HeroSprite via offscreen3d). `dressHero` / `inkHull` in
  herolook3d used by herofly3d, special3d (2-line hook: her zone model gets the same look) and
  HeroSprite (cel + inner ink hull sized per sprite via LOOK.res/dpr swap around renderToCanvas).
- herofly.js (2D flight sprite) uses FlightPose too (attitude + bone blends), not superFly.
- Hair shell has smoothed custom normals (soft=30) so the cel bands are big shapes.

## In progress / next
- fps A/B running: `shots/supergirl/ab.sh` (base = git archive of phase-2 in shots/supergirl/base).
- Harness shots sg2 (flying + brawler street) after the A/B.
