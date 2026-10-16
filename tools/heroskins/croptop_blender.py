"""The crop-top Supergirl (Act 2's default costume): build assets/models/hero_croptop.glb (comic) and
hero_croptop_real.glb (realistic) in Blender (5.x, e.g. through blender-mcp). Same skeleton, bone names,
skin weights and atlas layout as supergirl.glb, so supergirl_anims.glb and the flight shaders work unchanged.
    ROOT = r'<repo>'; exec(open(ROOT + '/tools/heroskins/croptop_blender.py').read())
    prep_croptop()                  # original model + texel maps + the source atlases, in a call of its own
    # system python:  uv run --no-project --with numpy,pillow,scipy python tools/heroskins/paint_croptop.py
    build_comic_ct(); export_croptop()           # supergirl.glb's hair shell, with a soft wave
    build_real_ct(); export_croptop(real=True)   # the original's hair cards
    pose_ct('CT_comic', 'Running', 12)           # pose check (Running / Flying / Jump)
No cape on this skin (the modelled cape's islands are deleted from both files; the game skips the cloth
cape for it). Wide cuffs: the sleeve's last 7 cm bulge out ~4 mm (paint_croptop.py paints them silver).
Both get the fuller bust (bust.py). Mesh-local space: y up, +z front, +x = her left.
"""
import json, struct
exec(open(ROOT + '/tools/heroskins/dark_blender.py').read())


def _glb_images(path, out):
    """the PNGs packed in a GLB, by image name, into `out` (supergirl.glb's comic atlas: sg_A / sg_N)"""
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); b0 = 20 + jl + 8
    for im in j['images']:
        bv = j['bufferViews'][im['bufferView']]; o = b0 + bv.get('byteOffset', 0)
        open(f"{out}/{im['name']}.png", 'wb').write(b[o:o + bv['byteLength']])


def prep_croptop():
    """(sg_blender) prep() on the original (git show fc7c052:assets/models/supergirl.glb >
    shots/supergirl/work/supergirl_src.glb) + its atlases + supergirl.glb's comic atlas, for paint_croptop.py"""
    k = prep()
    for n in ('SG_DCU_A', 'SG_DCU_N'):
        im = bpy.data.images[n]; im.filepath_raw = f'{SG_WORK}/{n}.png'; im.file_format = 'PNG'; im.save()
    _glb_images(ROOT + '/assets/models/supergirl.glb', SG_WORK)
    return k


def _wave(me, verts, amp=0.007):
    """long soft waves down the hair: a radial ripple growing toward the tips (no frizz, no ragged hem)"""
    ys = [me.vertices[i].co.y for i in verts]
    top, bot = 1.66, min(ys)
    for i in verts:
        v = me.vertices[i]; p = v.co.copy()
        t = _smooth(0, 1, (top - p.y) / (top - bot))
        radial = Vector((p.x, 0, p.z - 0.02))
        radial = radial.normalized() if radial.length > 1e-6 else Vector((0, 0, -1))
        ph = math.atan2(p.x, p.z - 0.02)
        face = _smooth(0.03, 0.08, p.z) * (1 - _smooth(0.08, 0.13, abs(p.x))) * _smooth(1.42, 1.48, p.y)
        d = radial * (0.004 * t + amp * t * math.sin(p.y * 34 + ph * 3)) + noise.noise_vector(p * 9) * 0.004 * t
        v.co = p + d * (1 - 0.8 * face)
    me.update()


def _cuffs(o, push=0.004, ramp=0.008):
    """bulge the sleeve's last CUFF m out along the normals (smooth ramps at both rims: no tearing); the
    band comes from paint_croptop.py (the right arm's axis; the left one mirrored)"""
    c = json.load(open(DK_WORK + '/croptop_cuffs.json'))['R']
    me = o.data; n = 0
    for v in me.vertices:
        s = 1 if v.co.x > 0 else -1
        org = Vector((c['o'][0] * -s, c['o'][1], c['o'][2])); ax = Vector((c['ax'][0] * -s, c['ax'][1], c['ax'][2]))
        if abs(v.co.x) < 0.4: continue
        q = v.co - org; t = q.dot(ax); r = (q - ax * t).length
        if r > 0.07: continue
        k = _smooth(c['tw'] - c['w'] - ramp, c['tw'] - c['w'], t) * (1 - _smooth(c['tw'] - ramp, c['tw'], t))
        if k > 0: v.co = v.co + v.normal * push * k; n += 1
    me.update()
    return n


def _no_cape(o):
    """the modelled cape's islands out (the real file kept it for stripModelCape; this skin has none)"""
    me = o.data
    if 'isl' not in me.attributes: return 0
    bm = bmesh.new(); bm.from_mesh(me); lay = bm.faces.layers.int['isl']
    dead = [f for f in bm.faces if f[lay] in SG_CAPE]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me); bm.free()
    return len(dead)


def build_comic_ct():
    shell()
    hs = bpy.data.objects['SG_hairshell']
    _wave(hs.data, range(len(hs.data.vertices)))
    build()
    _drop('CT_comic')
    o = bpy.data.objects['SG_new']; o.name = o.data.name = 'CT_comic'
    bust(o)
    nc = _cuffs(o)
    _dk_tex(o, 'croptop')
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles), nc


def build_real_ct():
    src = bpy.data.objects[SG_SRC]
    _drop('CT_real')
    o = src.copy(); o.data = src.data.copy(); o.name = o.data.name = 'CT_real'
    bpy.context.scene.collection.objects.link(o)
    _no_cape(o)
    bust(o)
    nc = _cuffs(o)
    _dk_tex(o, 'croptop_real')
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles), nc


def export_croptop(real=False):
    """GLB without clips, with the source's node / material names"""
    o = bpy.data.objects['CT_real' if real else 'CT_comic']
    src, arm = bpy.data.objects[SG_SRC], bpy.data.objects['Armature']
    smat, mat = src.data.materials[0], o.data.materials[0]
    if 'isl' in o.data.attributes: o.data.attributes.remove(o.data.attributes['isl'])
    path = f'{ROOT}/assets/models/hero_croptop{"_real" if real else ""}.glb'
    for ob in bpy.data.objects: ob.select_set(False)
    o.select_set(True); arm.select_set(True)
    on, mn, sn, smn = o.name, mat.name, src.name, smat.name
    src.name = 'CT_src'; smat.name = 'CT_src_mat'; o.name = SG_SRC; mat.name = smn
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                                  export_skins=True, export_morph=False, export_yup=True, export_attributes=False)
    finally:
        o.name = on; mat.name = mn; smat.name = smn; src.name = sn
    return os.path.getsize(path)


def pose_ct(obj, clip=None, frame=1):
    """show only `obj`, the armature on one of the source file's clips (Running / Flying / Jump) at a frame"""
    arm = bpy.data.objects['Armature']
    for ob in bpy.data.objects:
        if ob.type == 'MESH': ob.hide_set(ob.name != obj); ob.hide_render = ob.name != obj
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions.get(clip) if clip else None
    if not clip:
        for b in arm.pose.bones: b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
    bpy.context.scene.frame_set(frame)
