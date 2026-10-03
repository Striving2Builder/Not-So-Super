# Handoff: hero skins (Classic / Ponytail variants of supergirl.glb)

Branch based on phase-2 b1af2f6. Blender 5.2 via blender-mcp.

## Findings so far
- supergirl.glb = 1 skinned mesh `SG_DCU_L1_Sk` (12865 v, 17001 tris), 1 material `SG_DCU_Material.002`,
  1024² albedo `SG_DCU_A` + normal `SG_DCU_N` (PNG, ~1 MB each), 49 mixamorig bones, 5 unused embedded clips.
- Blender round trip (import with `disable_bone_shape=True`, export GLB without animations) keeps every
  bone node TRS within 3e-6 and the skin intact; file drops to 2.9 MB (no clips).
- Atlas: large brown "coat" panels (lower-left/middle) are unused = free space for new parts.
  Hair cards use the strip at image (0-90, 835-1024); flight shader (herofly3d HAIR.uv) recolours
  orange-brown texels in glTF-UV rect x0-0.6, v0.58-1.0 to blonde: keep new hair UVs in that rect.
- Procedural cape (cape.js) samples atlas glTF-UV (0.30-0.76, 0.27-0.41) = the skirt's red panel: keep red.
- Mesh local space: y up (0..1.72), +z front, cape island reaches z -0.9 (stripModelCape keys on that).

## In progress
- Bake a texel→3D position/island map (scratchpad), paint variant atlases by rules, mesh edits for hair.

- Game hook: `settings.hero` (persisted with graphics, `cycleHero()`), pause menu "Hero: X" (note says
  reload needed when it differs from the loaded one), `?hero=classic|ponytail` in hero3d.js (`HERO_SKIN`),
  shoot.js `--query hero=ponytail`.
- Blender pose check (Running/Flying/Jump clips from the source file): no tearing; ponytail follows the head,
  skirt/boots follow legs. Renders: shots/heroskins/anim_*_strip.png, *_strip.png (turnarounds).

## Measured (SwiftShader, flying harness)
- Shots: shots/skin-base, skin-classic, skin-ponytail (`--query hero=...`); no page errors.
- Paired fly3d_cruise A/B x2: base 5.5/5.5, classic 5.5/5.2, ponytail 5.7/5.2 fps = noise. Same draw
  calls (hero is still 1 mesh, 1 material, 2x 1024� textures); ponytail hero -2981 tris (14020 vs 17001).
- Download: supergirl 3.28 MB (with 5 unused clips) -> classic 2.88 MB, ponytail 2.28 MB.

## Next / known issues
- Ponytail: faint outline of the old knee-trim V on the thighs; a tiny blue suit seam fleck at her left
  armpit; slight seam ring at the back of the neck (slimmed collar).
- Gloss is painted (comic highlight) not a roughness map: the toon flight shader ignores roughness.
