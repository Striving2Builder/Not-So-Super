"""Supergirl look pass: rebuild assets/models/supergirl.glb in Blender (5.x, e.g. through blender-mcp).
    ROOT = r'<repo>'; exec(open(ROOT + '/tools/supergirl/sg_blender.py').read())
    prep()                 # fresh import of the ORIGINAL model (git show fc7c052:assets/models/supergirl.glb
                           # > shots/supergirl/work/supergirl_src.glb) + texel maps (heroskins bake)
    # then (system python):  python tools/supergirl/paint_sg.py   -> shots/supergirl/work/sg_A.png, sg_N.png
    shell(); build(); textures(); export()
    render('tag')          # Workbench turnarounds -> shots/supergirl/bl_<tag>_<angle>.png
What it does: the ~3.9k hair-card triangles become one solid hair shell (the cards solidified, voxel
remeshed into one mass, smoothed, decimated to ~1.9k tris, nudged out 3 mm), UV-mapped into a painted
lock swatch (u = round the head from the back, v = crown -> tips) and skinned by a weight transfer from
the cards (Head / Neck / Spine2 only, so a punching arm never drags hair). The modelled cape (stripped
at runtime anyway) is deleted. Same skeleton, bone names, node / material names and atlas layout, so
supergirl_anims.glb, the flight shaders and the zone cape work unchanged.
Mesh-local space: y up, +z front, +x = her left.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

SG_WORK = ROOT + '/shots/supergirl/work'
SG_BAKE = ROOT + '/shots/supergirl/hswork'
SG_SRC = 'SG_DCU_L1_Sk'
SG_SW = (100, 600, 590, 1010)  # hair swatch rect (image px), inside herofly3d's HAIR.uv rect
SG_CAPE = (395, 396, 397, 398)  # the modelled cape's islands (flood-fill ids of the source mesh)
SG_DROP = (413,)  # the gold plate on her upper back: floats off the suit, pokes out between hair and cape
SG_LASH = (0.33, 0.05, 0.4, 0.11)  # lash cards' atlas rect (glTF uv, v down): drawn opaque they're black slabs; the paint has a lash line


def _ctx():
    win = bpy.context.window_manager.windows[0]
    return win, next(a for a in win.screen.areas if a.type == 'VIEW_3D')


def prep():
    """fresh import of the original model + island ids + texel maps (reuses the heroskins pipeline)"""
    global WORK
    exec(open(ROOT + '/tools/heroskins/hs_blender.py').read(), globals())
    WORK = SG_BAKE
    os.makedirs(SG_BAKE, exist_ok=True)
    src_glb = SG_WORK + '/supergirl_src.glb'
    win, area = _ctx()
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    with bpy.context.temp_override(window=win, area=area):
        bpy.ops.import_scene.gltf(filepath=src_glb, disable_bone_shape=True)
    arm = bpy.data.objects['Armature']
    if arm.animation_data: arm.animation_data.action = None
    for b in arm.pose.bones: b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0); b.scale = (1, 1, 1)
    me = bpy.data.objects[SG_SRC].data
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    isl = np.full(len(bm.faces), -1, np.int32); k = 0
    for f in bm.faces:
        if isl[f.index] >= 0: continue
        st = [f]; isl[f.index] = k
        while st:
            g = st.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if isl[h.index] < 0: isl[h.index] = k; st.append(h)
        k += 1
    bm.free()
    a = me.attributes.new('isl', 'INT', 'FACE'); a.data.foreach_set('value', isl)
    bake()  # (heroskins) posmap / normmap / islmap / cards.npy into SG_BAKE
    return k


def shell(voxel=0.011, ratio=0.2, inflate=0.003, face=(0.085, 1.45, 1.70, 0.09), soft=30):
    """the hair cards -> one skinned, UV-mapped hair mass (object SG_hairshell); face = the oval cut
    open in front of her face: half-width x, y range, in front of z"""
    src = bpy.data.objects[SG_SRC]
    cards = set(np.load(SG_BAKE + '/cards.npy').tolist())
    for n in ('SG_hairsrc', 'SG_hairshell'):
        o = bpy.data.objects.get(n)
        if o: bpy.data.objects.remove(o)
    hs = src.copy(); hs.data = src.data.copy(); hs.name = hs.data.name = 'SG_hairsrc'
    bpy.context.scene.collection.objects.link(hs)
    bm = bmesh.new(); bm.from_mesh(hs.data); lay = bm.faces.layers.int['isl']
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[lay] not in cards], context='FACES')
    bm.to_mesh(hs.data); bm.free()
    o = hs.copy(); o.data = hs.data.copy(); o.name = o.data.name = 'SG_hairshell'
    bpy.context.scene.collection.objects.link(o)
    for m in list(o.modifiers): o.modifiers.remove(m)
    o.vertex_groups.clear()
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.014; sol.offset = 0
    rem = o.modifiers.new('rem', 'REMESH'); rem.mode = 'VOXEL'; rem.voxel_size = voxel
    sm = o.modifiers.new('sm', 'SMOOTH'); sm.factor = 0.8; sm.iterations = 6
    dec = o.modifiers.new('dec', 'DECIMATE'); dec.ratio = ratio
    me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    o.data = me; me.name = 'SG_hairshell'
    for m in list(o.modifiers): o.modifiers.remove(m)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.normal_update()
    for v in bm.verts: v.co += v.normal * inflate
    # UVs: polar about the head (u from the back round, seam at the front parting; v = crown -> tips)
    uvl = bm.loops.layers.uv.verify()
    C = Vector((0, 1.62, 0.03)); ax = (Vector((0, 1.70, 0.0)) - C).normalized()
    ex = Vector((1, 0, 0)); e2 = ax.cross(ex).normalized()
    def polar(p):
        q = (p - C).normalized()
        return math.acos(max(-1, min(1, q.dot(ax)))), math.atan2(q.dot(ex), q.dot(e2))
    x0, y0, x1, y1 = SG_SW
    for f in bm.faces:
        f.smooth = True
        cph = polar(f.calc_center_median())[1]
        for l in f.loops:
            th, ph = polar(l.vert.co)
            if abs(ph - cph) > math.pi: ph = cph
            u = (ph + math.pi) / (2 * math.pi); v = min(1, th / 2.9)
            l[uvl].uv = ((x0 + 2 + u * (x1 - x0 - 4)) / 1024, 1 - (y0 + 2 + v * (y1 - y0 - 4)) / 1024)
    # open the face: the remesh fused the strands hanging by her cheeks into a hood over it (the
    # opening's rim gets the ink hull: a framing line round her face)
    fx, fy0, fy1, fz = face
    def in_face(c): return c.z > fz and (c.x / fx) ** 2 + ((c.y - (fy0 + fy1) / 2) / ((fy1 - fy0) / 2)) ** 2 < 1
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if in_face(f.calc_center_median())], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    for _ in range(12):  # relax the cut's rim into a smooth curve (no stair-stepped triangles)
        rim = [v for v in bm.verts if v.is_boundary]
        new = {}
        for v in rim:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2: new[v] = v.co * 0.5 + (nb[0].co + nb[1].co) * 0.25
        for v, c in new.items(): v.co = c
    bm.to_mesh(me); bm.free()
    me.uv_layers[0].name = 'UVMap'
    # weights by height (smooth bands, no noise): the skull's hair follows the Head, the hair down her
    # back follows Neck then Spine2 (so a tilted-back head doesn't crumple the hair into her back);
    # never a shoulder / arm (a punching arm must not drag hair)
    def sm(a0, a1, x): k = min(1, max(0, (x - a0) / (a1 - a0))); return k * k * (3 - 2 * k)
    G = {n: o.vertex_groups.new(name='mixamorig:' + n) for n in ('Head', 'Neck', 'Spine2')}
    for v in o.data.vertices:
        y = v.co.y - 0.04 * max(0, v.co.z - 0.05)  # (hair over the shoulders in front hangs from the chest)
        hd = sm(1.45, 1.60, y); nk = (1 - hd) * sm(1.33, 1.46, y); s2 = 1 - hd - nk
        for n, w in (('Head', hd), ('Neck', nk), ('Spine2', s2)):
            if w > 1e-3: G[n].add([v.index], w, 'REPLACE')
    # cel-friendly normals: taken from a heavily smoothed copy, so the hard light bands fall as a few
    # big comic shapes over the hair instead of following every lump of the remesh
    if soft:
        px = o.copy(); px.data = o.data.copy(); px.name = 'SG_hairproxy'
        bpy.context.scene.collection.objects.link(px)
        s = px.modifiers.new('s', 'SMOOTH'); s.factor = 1.0; s.iterations = soft
        pm = bpy.data.meshes.new_from_object(px.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(px)
        px = bpy.data.objects.new('SG_hairproxy', pm); bpy.context.scene.collection.objects.link(px)
        px.matrix_world = o.matrix_world.copy()
        dt = o.modifiers.new('dtn', 'DATA_TRANSFER')
        dt.object = px; dt.use_loop_data = True; dt.data_types_loops = {'CUSTOM_NORMAL'}
        dt.loop_mapping = 'POLYINTERP_NEAREST'
        win, area = _ctx()
        for ob in bpy.data.objects: ob.select_set(False)
        o.select_set(True); bpy.context.view_layer.objects.active = o
        with bpy.context.temp_override(window=win, area=area, object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier='dtn')
        bpy.data.objects.remove(px)
    o.data.materials.clear()
    me = o.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def build():
    """SG_new = the source minus the cards and the modelled cape, plus the shell (one mesh, one material)"""
    src = bpy.data.objects[SG_SRC]
    old = bpy.data.objects.get('SG_new')
    if old: bpy.data.objects.remove(old)
    cards = set(np.load(SG_BAKE + '/cards.npy').tolist())
    o = src.copy(); o.data = src.data.copy(); o.name = o.data.name = 'SG_new'
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new(); bm.from_mesh(o.data); lay = bm.faces.layers.int['isl']
    uvl = bm.loops.layers.uv.active
    def lash(f):
        u, v = f.loops[0][uvl].uv; v = 1 - v
        return SG_LASH[0] < u < SG_LASH[2] and SG_LASH[1] < v < SG_LASH[3]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[lay] in cards or f[lay] in SG_CAPE or f[lay] in SG_DROP or lash(f)], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    sh = bpy.data.objects['SG_hairshell'].copy(); sh.data = bpy.data.objects['SG_hairshell'].data.copy()
    bpy.context.scene.collection.objects.link(sh)
    sh.data.materials.clear(); sh.data.materials.append(o.data.materials[0])
    sh.parent = o.parent; sh.matrix_world = o.matrix_world.copy()
    win, area = _ctx()
    for ob in bpy.data.objects: ob.hide_set(False); ob.select_set(False)
    sh.select_set(True); o.select_set(True); bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(window=win, area=area, active_object=o, selected_editable_objects=[o, sh], selected_objects=[o, sh]):
        bpy.ops.object.join()
    if 'isl' in o.data.attributes: o.data.attributes.remove(o.data.attributes['isl'])
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def textures():
    """point SG_new's (copied) material at the painted atlases"""
    o = bpy.data.objects['SG_new']; smat = bpy.data.objects[SG_SRC].data.materials[0]
    mat = bpy.data.materials.get('sg_mat')
    if not mat: mat = smat.copy(); mat.name = 'sg_mat'
    o.data.materials[0] = mat
    for node in mat.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image: continue
        n = node.image.name
        kind = 'N' if (n.endswith('_N') or n == 'sg_N') else 'A'
        im = bpy.data.images.get('sg_' + kind)
        if im: im.filepath = f'{SG_WORK}/sg_{kind}.png'; im.reload()
        else: im = bpy.data.images.load(f'{SG_WORK}/sg_{kind}.png'); im.name = 'sg_' + kind
        im.colorspace_settings.name = 'sRGB' if kind == 'A' else 'Non-Color'
        node.image = im


def export(path=None):
    """GLB without clips, with the source's node / material names"""
    path = path or ROOT + '/assets/models/supergirl.glb'
    o = bpy.data.objects['SG_new']; src = bpy.data.objects[SG_SRC]; arm = bpy.data.objects['Armature']
    smat = src.data.materials[0]; mat = o.data.materials[0]
    for ob in bpy.data.objects: ob.select_set(False)
    o.select_set(True); arm.select_set(True)
    sn = smat.name
    src.name = 'SG_src'; smat.name = 'SG_src_mat'; o.name = SG_SRC; mat.name = 'SG_DCU_Material.002'
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                                  export_skins=True, export_morph=False, export_yup=True, export_attributes=False)
    finally:
        o.name = 'SG_new'; mat.name = 'sg_mat'; smat.name = sn; src.name = SG_SRC
    return os.path.getsize(path)


def render(tag, obj='SG_new', angles=(0, 90, 180, 135), target=(0, 0, 1.84), scale=0.6, el=5, res=500):
    """Workbench (flat, textured, outlined) turnaround of the head -> shots/supergirl/bl_<tag>_<a>.png"""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
    sc.display.shading.show_object_outline = True
    sc.render.resolution_x = sc.render.resolution_y = res
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = o.name != obj
    cam = bpy.data.objects.get('SG_cam')
    if not cam:
        cam = bpy.data.objects.new('SG_cam', bpy.data.cameras.new('SG_cam')); sc.collection.objects.link(cam)
    sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = scale
    t = Vector(target); out = []
    for a in angles:
        r = math.radians(a); e = math.radians(el)
        cam.location = t + Vector((math.sin(r) * math.cos(e), -math.cos(r) * math.cos(e), math.sin(e))) * 5
        cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
        f = f'{ROOT}/shots/supergirl/bl_{tag}_{a}.png'; sc.render.filepath = f
        bpy.ops.render.render(write_still=True); out.append(f)
    return out
