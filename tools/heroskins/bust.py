"""Fuller bust for every hero skin, run inside Blender (5.x), e.g. through blender-mcp:
    ROOT = r'<repo>'; exec(open(ROOT + '/tools/heroskins/bust.py').read())
    reshape('assets/models/hero_classic.glb')        # import -> bust() -> export, in place
    bust(bpy.data.objects['SG_new'])                  # or on a mesh mid-pipeline (rest pose)
A smooth displacement field in mesh-local space (y up, +z front, +x = her left), masked off the arms
and the back. Normals are carried through the field's Jacobian, so custom normals (the hair shell's)
and UV seams survive; skin weights are untouched, so the chest follows Spine1/Spine2 as before.
"""
import bpy, os
import numpy as np

# apex per side at (±x, y), pushed `amp` forward; radii toward the sternum / armpit / collarbone / underbust
BUST = dict(x=0.088, y=1.290, amp=0.052, pw=1.6, med=0.072, lat=0.114, up=0.13, down=0.072, drop=0.16, out=0.3, z0=0.03, z1=0.11)
ARM_BONES = ('Arm', 'ForeArm', 'Hand')


def field(P, k=BUST):
    """displacement (N,3) for mesh-local points P (N,3)"""
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    D = np.zeros_like(P)
    zf = np.clip((z - k['z0']) / (k['z1'] - k['z0']), 0, 1); zf = zf * zf * (3 - 2 * zf)
    for s in (-1.0, 1.0):
        dx = x - s * k['x']; dy = y - k['y']
        rx = np.where(dx * s < 0, k['med'], k['lat']); ry = np.where(dy > 0, k['up'], k['down'])
        w = np.clip(1 - (dx / rx) ** 2 - (dy / ry) ** 2, 0, 1) ** k['pw'] * zf  # pw < 2: a rounder dome
        side = np.clip(dx * s / k['lat'], 0, 1)
        D[:, 2] += k['amp'] * w
        D[:, 1] -= k['amp'] * k['drop'] * w
        D[:, 0] += s * k['amp'] * k['out'] * w * side
    return D


def _arm_share(o):
    """per-vertex fraction of skin weight on arm / hand bones"""
    arm = {g.index for g in o.vertex_groups
           if g.name.replace('mixamorig:', '').replace('Left', '').replace('Right', '').startswith(ARM_BONES)}
    a = np.zeros(len(o.data.vertices))
    for v in o.data.vertices:
        t = sum(g.weight for g in v.groups)
        if t > 0: a[v.index] = sum(g.weight for g in v.groups if g.group in arm) / t
    return a


def bust(o, k=BUST):
    me = o.data
    P = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', P); P = P.reshape(-1, 3)
    m = 1 - _arm_share(o)
    D = field(P, k) * m[:, None]
    nl = len(me.loops)
    lv = np.zeros(nl, np.int64); me.loops.foreach_get('vertex_index', lv)
    cn = np.zeros(nl * 3); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(-1, 3)
    h = 1e-4; J = np.zeros((len(P), 3, 3))
    for j in range(3):
        e = np.zeros(3); e[j] = h
        J[:, :, j] = (field(P + e, k) - field(P - e, k)) / (2 * h)
    M = np.eye(3)[None] + J * m[:, None, None]
    n2 = np.linalg.solve(np.transpose(M[lv], (0, 2, 1)), cn[..., None])[..., 0]  # n' = M^-T n
    n2 /= np.maximum(1e-9, np.linalg.norm(n2, axis=1, keepdims=True))
    me.vertices.foreach_set('co', (P + D).ravel())
    me.normals_split_custom_set(n2.tolist())
    me.update()
    return float(np.abs(D[:, 2]).max())


def _ctx():
    win = bpy.context.window_manager.windows[0]
    return win, next(a for a in win.screen.areas if a.type == 'VIEW_3D')


def load(rel):
    """fresh import (rest pose, bone shapes off: they break the importer under MCP)"""
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    bpy.data.orphans_purge(do_recursive=True)
    win, area = _ctx()
    with bpy.context.temp_override(window=win, area=area):
        bpy.ops.import_scene.gltf(filepath=ROOT + '/' + rel, disable_bone_shape=True)
    arm = bpy.data.objects['Armature']
    if arm.animation_data: arm.animation_data.action = None
    for b in arm.pose.bones: b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0); b.scale = (1, 1, 1)
    return [o for o in bpy.data.objects if o.type == 'MESH']


def save(rel):
    for o in bpy.data.objects: o.select_set(o.type in ('MESH', 'ARMATURE'))
    path = ROOT + '/' + rel
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=False,
                              export_skins=True, export_morph=False, export_yup=True, export_attributes=False)
    return os.path.getsize(path)


def reshape(rel, out=None, k=BUST):
    moved = [bust(o, k) for o in load(rel)]
    return moved, save(out or rel)
