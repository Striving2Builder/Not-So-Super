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

## Next
- Export hero_classic.glb / hero_ponytail.glb; settings `hero` option + pause menu; `?hero=`; shoot.js `--query`.
