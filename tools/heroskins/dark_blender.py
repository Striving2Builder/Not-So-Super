"""Supergirl_Dark: build assets/models/hero_dark.glb (comic) and hero_dark_real.glb (realistic) in Blender
(5.x, e.g. through blender-mcp). Same skeleton, bone names, skin weights and atlas layout as supergirl.glb,
so supergirl_anims.glb, the cloth cape and the flight shaders work unchanged.
    ROOT = r'<repo>'; exec(open(ROOT + '/tools/heroskins/dark_blender.py').read())
    prep()                                   # (sg_blender) original model + texel maps, in a call of its own
    # system python:  uv run --no-project --with numpy,pillow,scipy python tools/heroskins/paint_dark.py
    build_comic(); export_dark()             # supergirl.glb's hair shell, made fuller and messier
    build_real(); export_dark(real=True)     # the original's hair cards, made messier
    render('dark', obj='DK_comic', angles=(0, 90, 180), target=(0, 0, 0.95), scale=2.1)
Both get the fuller bust (bust.py). Mesh-local space: y up, +z front, +x = her left.
"""
exec(open(ROOT + '/tools/supergirl/sg_blender.py').read())
exec(open(ROOT + '/tools/heroskins/bust.py').read())
from mathutils import noise

DK_WORK = ROOT + '/shots/heroskins/work'


def _smooth(a, b, x):
    k = min(1.0, max(0.0, (x - a) / (b - a))); return k * k * (3 - 2 * k)


def _messy(p, t, seed):
    """offset for a hair point p (t = 0 at the crown .. 1 at the tips): volume out from the head axis,
    lumpy locks, frizz, and a ragged hem (clumps of tips hanging lower than others)"""
    radial = Vector((p.x, 0, p.z - 0.02))
    radial = radial.normalized() if radial.length > 1e-6 else Vector((0, 0, -1))
    lump = noise.noise_vector(p * 14 + Vector((seed, 0, 0)))
    frizz = noise.noise_vector(p * 55 + Vector((0, seed, 0)))
    d = radial * (0.005 + 0.016 * t) + lump * (0.011 * t) + frizz * (0.003 * t)
    clump = max(0.0, noise.noise(Vector((p.x * 30 + seed, 0.0, p.z * 30))))
    d.y -= 0.045 * clump * _smooth(0.65, 1.0, t)
    # keep her face clear: little push in front of it
    face = _smooth(0.03, 0.08, p.z) * (1 - _smooth(0.08, 0.13, abs(p.x))) * _smooth(1.42, 1.48, p.y)
    return d * (1 - 0.8 * face)


def _mess(me, verts, seed):
    ys = [me.vertices[i].co.y for i in verts]
    top, bot = 1.66, min(ys)
    for i in verts:
        v = me.vertices[i]
        v.co = v.co + _messy(v.co.copy(), _smooth(0, 1, (top - v.co.y) / (top - bot)), seed)
    me.update()


def _dk_tex(o, tag):
    """a copy of the material on the painted atlases shots/heroskins/work/<tag>_A.png / _N.png"""
    mat = o.data.materials[0].copy(); mat.name = 'dk_' + tag
    o.data.materials[0] = mat
    for node in mat.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image: continue
        kind = 'N' if node.image.name.endswith('_N') else 'A'
        nm, path = f'{tag}_{kind}', f'{DK_WORK}/{tag}_{kind}.png'
        im = bpy.data.images.get(nm)
        if im: im.filepath = path; im.reload()
        else: im = bpy.data.images.load(path); im.name = nm
        im.colorspace_settings.name = 'sRGB' if kind == 'A' else 'Non-Color'
        node.image = im


def _drop(name):
    old = bpy.data.objects.get(name)
    if old:
        me = old.data; bpy.data.objects.remove(old)
        if me.users == 0: bpy.data.meshes.remove(me)


def build_comic(seed=3):
    shell()
    hs = bpy.data.objects['SG_hairshell']
    _mess(hs.data, range(len(hs.data.vertices)), seed)
    build()
    _drop('DK_comic')
    o = bpy.data.objects['SG_new']; o.name = o.data.name = 'DK_comic'
    bust(o)
    _dk_tex(o, 'dark')
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def build_real(seed=3):
    src = bpy.data.objects[SG_SRC]
    _drop('DK_real')
    o = src.copy(); o.data = src.data.copy(); o.name = o.data.name = 'DK_real'
    bpy.context.scene.collection.objects.link(o)
    me = o.data
    cards = np.load(SG_BAKE + '/cards.npy')
    isl = np.zeros(len(me.polygons), np.int32); me.attributes['isl'].data.foreach_get('value', isl)
    verts = sorted({v for p in me.polygons if isl[p.index] in cards for v in p.vertices})
    _mess(me, verts, seed)
    bust(o)
    _dk_tex(o, 'dark_real')
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def export_dark(real=False):
    """GLB without clips, with the source's node / material names"""
    o = bpy.data.objects['DK_real' if real else 'DK_comic']
    src, arm = bpy.data.objects[SG_SRC], bpy.data.objects['Armature']
    smat, mat = src.data.materials[0], o.data.materials[0]
    if 'isl' in o.data.attributes: o.data.attributes.remove(o.data.attributes['isl'])
    path = f'{ROOT}/assets/models/hero_dark{"_real" if real else ""}.glb'
    for ob in bpy.data.objects: ob.select_set(False)
    o.select_set(True); arm.select_set(True)
    on, mn, sn, smn = o.name, mat.name, src.name, smat.name
    src.name = 'DK_src'; smat.name = 'DK_src_mat'; o.name = SG_SRC; mat.name = smn
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                                  export_skins=True, export_morph=False, export_yup=True, export_attributes=False)
    finally:
        o.name = on; mat.name = mn; smat.name = smn; src.name = sn
    return os.path.getsize(path)
