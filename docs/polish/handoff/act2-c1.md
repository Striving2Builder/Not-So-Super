# Act 2 job C1: the crop-top Supergirl (handoff)

Brief: docs/polish/ACT2BUILD.md (job C1); design: docs/design/act2.md ("Costumes"). Blender 5.2.1 is open
on the user's machine with blender-mcp connected (2026-10-16): a default scene, nothing to keep.

## Scope
- A new hero skin **`croptop`**, made the way Supergirl_Dark was (`docs/polish/handoff/heroskins.md`
  "2026-10-10": `tools/heroskins/dark_blender.py` + `paint_dark.py`, bust.py): same rig, animations,
  atlas layout, from `assets/models/supergirl.glb`. Comic file `hero_croptop.glb` (+ a realistic
  `hero_croptop_real.glb` if cheap). New scripts `tools/heroskins/croptop_blender.py`, `paint_croptop.py`.
- **The look** (user's reference, local and git-ignored, absolute path:
  `C:/Users/ngnic/Documents/App Projects/Sandbox - Top Down Super Flying Game/docs/references/user/act2-croptop-sg.jpg`):
  a glossy **light-blue long-sleeve crop top** with the red and yellow S, **bare midriff** (skin between
  the top's hem and the skirt), a glossy **red mini skirt with a yellow V waistband**, **wide silver
  cuffs** at the wrists, long wavy blonde hair. **The same red boots as the other Supergirls, no cape
  for now** (user). Skirt length: the game's current trim (`SKIRT_TRIM` in herolook3d.js; the user
  likes it a bit shorter than photos).
- Game hook: `croptop` in hero3d.js `HERO_FILES` (comic + real), `?hero=croptop`; the cape off for this
  skin (the way the game strips the model cape + no procedural cape); **Act 2's default costume**: while
  Act 2 is on (`game.act.two.on()`) she wears the crop top, except the casino night's knockoff (job D's
  `loadSkin`/`HeroModel(src)` path in hero3d.js). herolook3d / capefly3d palettes if they need a `croptop` entry.
- Check poses in Blender (Running / Flying / Jump): no tearing at the midriff or cuffs. Hero lab +
  `shoot.js selfbuilt3d --only warehouse --query hero=croptop` (no page errors); download size noted.

## Done
- Branch `act2-c1` off phase-2 0410567. Models: `assets/models/hero_croptop.glb` (comic, 2.24 MB, 14266 tris,
  supergirl.glb's hair shell with a soft wave) + `hero_croptop_real.glb` (2.91 MB, original hair cards); 1 mesh,
  1 material, two 1024² PNGs; same 51 nodes / bone names; both without the modelled cape.
- Rebuild: `tools/heroskins/croptop_blender.py` (prep_croptop, build_comic_ct / build_real_ct, export_croptop,
  pose_ct) + `paint_croptop.py` (comic from supergirl.glb's atlas, real from the original's; masks in mesh
  space: HEM 1.215, waistband BAND + V dip, cuffs = the sleeve's last 7 cm, also bulged 4 mm in Blender).
- Pose check (Running / Flying / Jump): no tearing; edge stretch at the midriff / cuffs = the source's.

## Next / notes
