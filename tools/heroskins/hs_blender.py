"""Hero skins: build the Classic / Ponytail variants of assets/models/supergirl.glb in Blender.

Same skeleton, bone names, skin weights and UV atlas layout as supergirl.glb, so
supergirl_anims.glb drives them unchanged. Run inside Blender (5.x), e.g. through blender-mcp:
    ROOT = r'<repo>'; exec(open(ROOT + '/tools/heroskins/hs_blender.py').read())
    setup(); bake()            # -> shots/heroskins/work/*.npy + source atlas PNGs
    # then (system python):  python tools/heroskins/paint.py classic|ponytail
    build('classic'); export('classic')
    build('ponytail'); export('ponytail')
    render('classic')          # turnarounds -> shots/heroskins/
Mesh-local space of the model: y up, +z front, +x = her left. Islands are identified by their
index in a BMesh flood fill of the source mesh (stable for this file), stored as the face int
attribute 'isl' on the working copies.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

WORK = ROOT + '/shots/heroskins/work'
SRC = 'SG_DCU_L1_Sk'
ISL = dict(boots=(209, 389), arms=(53, 54), front=399, back=383, shield=(417, 385, 414, 415), knee_trim=(410, 411), head=(388, 390))
NEW_CAP, NEW_TAIL = 900, 901
# free atlas rects (the unused brown coat panels), inside herofly3d's hair UV rect (glTF u<0.6, v>0.58)
SW_CAP, SW_TAIL = (110, 620, 330, 830), (370, 620, 590, 830)


def setup():
    """Fresh import of supergirl.glb (bone shapes off: they break the importer under MCP)."""
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    win = bpy.context.window_manager.windows[0]
    area = next(a for a in win.screen.areas if a.type == 'VIEW_3D')
    with bpy.context.temp_override(window=win, area=area):
        bpy.ops.import_scene.gltf(filepath=ROOT + '/assets/models/supergirl.glb', disable_bone_shape=True)
    arm = bpy.data.objects['Armature']
    if arm.animation_data: arm.animation_data.action = None
    for b in arm.pose.bones: b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0); b.scale = (1, 1, 1)
    src = bpy.data.objects[SRC]
    me = src.data
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
    os.makedirs(WORK, exist_ok=True)
    for n in ('SG_DCU_A', 'SG_DCU_N'):
        im = bpy.data.images[n]; im.filepath_raw = f'{WORK}/{n}.png'; im.file_format = 'PNG'; im.save()
    src.hide_render = True
    return k


def _raster(me, per_loop, N=1024):
    """rasterise a per-loop vector attribute into UV space (rows bottom-up, like Blender UVs)"""
    nl = len(me.loops)
    uv = np.zeros(nl * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    me.calc_loop_triangles()
    tl = np.zeros(len(me.loop_triangles) * 3, np.int64); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(-1, 3)
    tp = np.zeros(len(me.loop_triangles), np.int64); me.loop_triangles.foreach_get('polygon_index', tp)
    out = np.full((N, N, per_loop.shape[1]), np.nan, np.float32); tri = np.full((N, N), -1, np.int64)
    for t in range(len(tl)):
        L = tl[t]; U = uv[L] * N; Vv = per_loop[L]
        x0 = int(max(0, np.floor(U[:, 0].min()))); x1 = int(min(N - 1, np.ceil(U[:, 0].max())))
        y0 = int(max(0, np.floor(U[:, 1].min()))); y1 = int(min(N - 1, np.ceil(U[:, 1].max())))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        a, b, c = U
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-12: continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not m.any(): continue
        p = w0[..., None] * Vv[0] + w1[..., None] * Vv[1] + w2[..., None] * Vv[2]
        yy = (ys[m] - 0.5).astype(int); xx = (xs[m] - 0.5).astype(int)
        out[yy, xx] = p[m]; tri[yy, xx] = tp[t]
    return out, tri


def bake():
    """texel -> 3D position, normal and island maps for paint.py"""
    me = bpy.data.objects[SRC].data
    nl = len(me.loops)
    lv = np.zeros(nl, np.int64); me.loops.foreach_get('vertex_index', lv)
    co = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    cn = np.zeros(nl * 3); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
    isl = np.zeros(len(me.polygons), np.int32); me.attributes['isl'].data.foreach_get('value', isl)
    P, tri = _raster(me, co[lv])
    Nm, _ = _raster(me, cn)
    I = np.where(tri >= 0, isl[np.maximum(tri, 0)], -1).astype(np.int32)
    np.save(WORK + '/posmap.npy', P); np.save(WORK + '/normmap.npy', Nm); np.save(WORK + '/islmap.npy', I)
    # hair cards: islands whose UVs sit in the hair-strand strip of the atlas
    uv = np.zeros(nl * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    ls = np.zeros(len(me.polygons), np.int64); me.polygons.foreach_get('loop_start', ls)
    pu = uv[ls]
    cards = sorted(set(isl[(pu[:, 0] < 0.09) & (pu[:, 1] < 0.185)].tolist()))
    np.save(WORK + '/cards.npy', np.array(cards))
    return len(cards)


def _variant(name):
    old = bpy.data.objects.get(name)
    if old: bpy.data.objects.remove(old)
    src = bpy.data.objects[SRC]
    o = src.copy(); o.data = src.data.copy(); o.name = name; o.data.name = name
    bpy.context.scene.collection.objects.link(o)
    o.hide_render = False
    for other in bpy.data.objects:
        if other.type == 'MESH' and other is not o: other.hide_render = True
    return o


def _textures(o, v):
    """point the (single) material's colour and normal textures at the painted atlases"""
    mat = o.data.materials[0].copy(); mat.name = 'hero_' + v  # renamed to the source's name on export
    o.data.materials[0] = mat
    for node in mat.node_tree.nodes:
        if node.type != 'TEX_IMAGE' or not node.image: continue
        kind = 'A' if node.image.name.endswith('_A') or node.image.name.startswith('SG_DCU_A') else 'N'
        nm = f'{v}_{kind}'
        im = bpy.data.images.get(nm)
        if im: im.filepath = f'{WORK}/{v}_{kind}.png'; im.reload()
        else: im = bpy.data.images.load(f'{WORK}/{v}_{kind}.png'); im.name = nm
        im.colorspace_settings.name = 'sRGB' if kind == 'A' else 'Non-Color'
        node.image = im


def _delete_islands(bm, ids):
    lay = bm.faces.layers.int['isl']
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[lay] in ids], context='FACES')


def _style_cards_classic(bm, cards):
    """loose, wavy, shoulder-length: lift the ends to the shoulders, fluff them out, add a wave"""
    lay = bm.faces.layers.int['isl']
    C = Vector((0, 1.62, 0.10))
    vs = {v for f in bm.faces if f[lay] in cards for v in f.verts}
    for v in vs:
        p = v.co
        below = max(0.0, 1.60 - p.y)
        if below <= 0: continue
        k = min(1.0, below / 0.26)
        y = 1.60 - below * 0.78                                  # shoulder length
        r = Vector((p.x - C.x, 0, p.z - C.z))
        rl = max(1e-4, r.length); rd = r / rl
        r2 = rl + min(0.028, rl * 0.2 * k) + 0.008 * k * math.sin(below * 48)  # volume + wave
        v.co = Vector((C.x + rd.x * r2, y, C.z + rd.z * r2))


def _cap(bm, o):
    """slicked-back hair shell over the scalp (head faces above the hairline, pushed out)"""
    lay = bm.faces.layers.int['isl']; uvl = bm.loops.layers.uv[0]
    C = Vector((0, 1.62, 0.10)); T = Vector((0, 1.690, 0.008))
    a = (T - C).normalized(); e1 = Vector((1, 0, 0)); e2 = a.cross(e1).normalized()
    def hair(p):
        if abs(p.x) > 0.078 and 1.55 < p.y < 1.645 and 0.055 < p.z < 0.15: return False  # ears stay out
        return p.y > 1.662 or (p.z < 0.158 and p.y > 1.585) or (p.z < 0.075 and p.y > 1.545)
    capf = [f for f in bm.faces if f[lay] in ISL['head'] and all(hair(v.co) for v in f.verts)]
    ret = bmesh.ops.duplicate(bm, geom=capf)
    nf = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    nfs = set(nf)
    dist = {v: (0 if any(sum(1 for lf in e.link_faces if lf in nfs) < 2 for e in v.link_edges) else None) for v in nv}
    front = [v for v in nv if dist[v] == 0]; k = 0
    while front:
        k += 1; nxt = []
        for v in front:
            for e in v.link_edges:
                w = e.other_vert(v)
                if w in dist and dist[w] is None: dist[w] = k; nxt.append(w)
        front = nxt
    for v in nv:
        n = (v.co - C).normalized()
        vol = 0.006 + 0.009 * max(0, min(1, (v.co.y - 1.58) / 0.13))
        v.co = v.co + n * (0.0015 + vol * min(1, (dist[v] or 0) / 3))
    for f in nf:
        f[lay] = NEW_CAP; f.smooth = True
        for l in f.loops:
            q = (l.vert.co - C).normalized()
            th = math.acos(max(-1, min(1, q.dot(a)))); ph = math.atan2(q.dot(e2), q.dot(e1))
            l[uvl].uv = _sw_uv(SW_CAP, abs(ph) / math.pi, min(1, th / 2.4))  # strands converge on the tie


def _sw_uv(sw, u, v):
    x0, y0, x1, y1 = sw
    return ((x0 + 2 + u * (x1 - x0 - 4)) / 1024, 1 - (y0 + 2 + v * (y1 - y0 - 4)) / 1024)


def _ponytail(bm, o):
    """a high, lumpy, wavy tapered tube skinned Head -> Head/Neck/Spine2 along its length"""
    lay = bm.faces.layers.int['isl']; uvl = bm.loops.layers.uv[0]; dl = bm.verts.layers.deform.verify()
    vg = {g.name: g.index for g in o.vertex_groups}
    H, Nk, S2 = vg['mixamorig:Head'], vg['mixamorig:Neck'], vg['mixamorig:Spine2']
    ctrl = [Vector(c) for c in [(0, 1.690, 0.012), (0, 1.712, -0.028), (0, 1.700, -0.072), (0.006, 1.655, -0.100),
                                (0.014, 1.590, -0.112), (0.006, 1.520, -0.110), (-0.010, 1.450, -0.098),
                                (-0.004, 1.380, -0.085), (0.010, 1.315, -0.075)]]
    def cr(t):
        n = len(ctrl) - 1; s = t * n; i = min(int(s), n - 1); f = s - i
        p0, p1, p2, p3 = ctrl[max(i - 1, 0)], ctrl[i], ctrl[i + 1], ctrl[min(i + 2, n)]
        return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)
    prof = [(0, 0.020), (0.12, 0.040), (0.3, 0.047), (0.55, 0.040), (0.8, 0.026), (0.93, 0.014), (1, 0.003)]
    def rad(t):
        for (t0, r0), (t1, r1) in zip(prof, prof[1:]):
            if t <= t1: return r0 + (r1 - r0) * (t - t0) / (t1 - t0)
        return 0.003
    def weigh(v, t):
        wh, wn, ws = 1 - 0.5 * t ** 1.1, 0.32 * t, 0.18 * t; s = wh + wn + ws
        v[dl][H] = wh / s; v[dl][Nk] = wn / s; v[dl][S2] = ws / s
    SIDES, RINGS = 12, 26
    rings = []
    for r in range(RINGS + 1):
        t = r / RINGS
        c = cr(t); tan = (cr(min(1, t + 0.01)) - cr(max(0, t - 0.01))).normalized()
        side = Vector((1, 0, 0)); side = (side - tan * side.dot(tan)).normalized(); up = tan.cross(side).normalized()
        c = c + side * 0.010 * math.sin(t * math.pi * 3.2)
        ring = []
        for s in range(SIDES):
            ang = 2 * math.pi * s / SIDES
            R = rad(t) * (1 + 0.13 * math.sin(ang * 4 + t * 9) + 0.06 * math.sin(ang * 7 - t * 13))
            v = bm.verts.new(c + side * math.cos(ang) * R * 1.18 + up * math.sin(ang) * R * 0.85)
            weigh(v, t); ring.append(v)
        rings.append(ring)
    tip = bm.verts.new(cr(1.0) + (cr(1.0) - cr(0.97)).normalized() * 0.01); weigh(tip, 1.0)
    def u_of(s): return abs(((2 * math.pi * s / SIDES + math.pi) % (2 * math.pi)) - math.pi) / math.pi
    faces = []
    for r in range(RINGS):
        for s in range(SIDES):
            s2 = (s + 1) % SIDES
            f = bm.faces.new((rings[r][s], rings[r + 1][s], rings[r + 1][s2], rings[r][s2]))
            for l, (rr, ss) in zip(f.loops, ((r, s), (r + 1, s), (r + 1, s2), (r, s2))): l[uvl].uv = _sw_uv(SW_TAIL, u_of(ss), rr / RINGS)
            faces.append(f)
    for s in range(SIDES):
        s2 = (s + 1) % SIDES
        f = bm.faces.new((rings[-1][s], tip, rings[-1][s2]))
        for l, ss in zip(f.loops, (s, s, s2)): l[uvl].uv = _sw_uv(SW_TAIL, u_of(ss), 1.0)
        faces.append(f)
    for f in faces: f[lay] = NEW_TAIL; f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def _slim_collar(bm):
    """the suit's high collar becomes bare neck: pull it in toward the neck so it doesn't read as a flap"""
    lay = bm.faces.layers.int['isl']
    ids = set(ISL['arms']) | {ISL['front'], ISL['back']}
    vs = {v for f in bm.faces if f[lay] in ids for v in f.verts if v.co.y > 1.44}
    for v in vs:
        k = min(1, (v.co.y - 1.44) / 0.07) * 0.22
        ax = Vector((0, v.co.y, 0.085))
        v.co = v.co + (ax - v.co) * Vector((1, 0, 1)) * k


def build(v):
    cards = set(np.load(WORK + '/cards.npy').tolist())
    o = _variant('hero_' + v)
    bm = bmesh.new(); bm.from_mesh(o.data)
    # knee boots are painted (paint.py): the boot shell above the knee and the old knee trims become bare leg
    if v == 'classic':
        _style_cards_classic(bm, cards)
    elif v == 'ponytail':
        _cap(bm, o)
        _ponytail(bm, o)
        _slim_collar(bm)
        _delete_islands(bm, cards)
    bm.to_mesh(o.data); bm.free()
    _textures(o, v)
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def export(v):
    o = bpy.data.objects['hero_' + v]
    arm = bpy.data.objects['Armature']
    if 'isl' in o.data.attributes: o.data.attributes.remove(o.data.attributes['isl'])
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); arm.select_set(True)
    # same node / material names as the source model (the source keeps them while not exported)
    src = bpy.data.objects[SRC]; smat = src.data.materials[0]; vmat = o.data.materials[0]
    src.name = 'HS_src'; smat_name = smat.name; smat.name = 'HS_src_mat'
    o.name = SRC; vmat.name = smat_name
    try:
        bpy.ops.export_scene.gltf(filepath=f'{ROOT}/assets/models/hero_{v}.glb', export_format='GLB', use_selection=True,
                                  export_animations=False, export_skins=True, export_morph=False, export_yup=True)
    finally:
        o.name = 'hero_' + v; vmat.name = 'hero_' + v; smat.name = smat_name; src.name = SRC
    return os.path.getsize(f'{ROOT}/assets/models/hero_{v}.glb')


def render(v, angles=(0, 90, 180, 45), zc=0.95, scale=2.1, tag=None, res=(600, 900)):
    """turnaround renders -> shots/heroskins/<v>_<angle>.png (Eevee, one sun, flat grey world)"""
    sc = bpy.context.scene
    try: sc.render.engine = 'BLENDER_EEVEE'
    except TypeError: pass
    sc.render.resolution_x, sc.render.resolution_y = res
    w = sc.world or bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bg.inputs[0].default_value = (0.25, 0.3, 0.35, 1)
    co = bpy.data.objects.get('HS_Cam')
    if not co:
        cam = bpy.data.cameras.new('HS_Cam'); cam.type = 'ORTHO'
        co = bpy.data.objects.new('HS_Cam', cam); sc.collection.objects.link(co)
        L = bpy.data.lights.new('HS_Key', 'SUN'); L.energy = 3.5
        lo = bpy.data.objects.new('HS_Key', L); sc.collection.objects.link(lo)
    lo = bpy.data.objects['HS_Key']
    sc.camera = co; co.data.ortho_scale = scale
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = o.name != 'hero_' + v and not (v == 'supergirl' and o.name == SRC)
    out = []
    os.makedirs(ROOT + '/shots/heroskins', exist_ok=True)
    for ang in angles:
        r = math.radians(ang)
        co.location = (10 * math.sin(r), -10 * math.cos(r), zc); co.rotation_euler = (math.radians(90), 0, r)
        lo.rotation_euler = (math.radians(55), 0, r + math.radians(35))
        f = f'{ROOT}/shots/heroskins/{tag or v}_{ang}.png'; sc.render.filepath = f
        bpy.ops.render.render(write_still=True); out.append(f)
    return out
