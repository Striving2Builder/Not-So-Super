# Blender (background) script: turn a downloaded character model into a web-ready enemy GLB.
#
#   blender -b --python tools/export_enemy.py -- <in.glb|in.fbx> assets/models/enemies/<name>.glb \
#       [--max-tris 20000] [--max-tex 1024] [--height 1.85] [--rot-z 0] [--preview out.png] [--drop Icosphere]
#
# What it does:
#   * drops cameras, lights and any object whose name contains a --drop pattern (comma-separated)
#   * static meshes: joins them and decimates to --max-tris; rigged meshes are left as they are
#   * scales to --height metres, feet on the ground at the origin, turned --rot-z degrees about Z
#   * downsizes textures above --max-tex, drops metallic/roughness maps (NPCs read fine without)
#   * exports GLB with Draco-compressed geometry and WebP textures (+ animations, if rigged)
#   * optionally renders a front + side preview PNG so the result can be checked without a GPU
import bpy, os, sys, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
src, out_glb = os.path.abspath(argv[0]), os.path.abspath(argv[1])
opt = {'--max-tris': '20000', '--max-tex': '1024', '--height': '1.85', '--rot-z': '0', '--preview': '', '--drop': '', '--keep': ''}
for i, a in enumerate(argv):
    if a in opt and i + 1 < len(argv):
        opt[a] = argv[i + 1]
# --mixamo: rename bones to Supergirl's rig names (mixamorigHips...) so her clips can drive this model
# --no-anims: drop the model's own clips and export it in its rest pose
MIXAMO, NO_ANIMS = '--mixamo' in argv, '--no-anims' in argv
MAX_TRIS, MAX_TEX, HEIGHT, ROT_Z = int(opt['--max-tris']), int(opt['--max-tex']), float(opt['--height']), float(opt['--rot-z'])
DROP = [d for d in opt['--drop'].split(',') if d]

if src.lower().endswith('.blend'): bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.lower().endswith(('.glb', '.gltf')): bpy.ops.import_scene.gltf(filepath=src)
    else: bpy.ops.import_scene.fbx(filepath=src)
scene = bpy.context.scene
bpy.context.view_layer.objects.active = None
if bpy.context.object and bpy.context.object.mode != 'OBJECT': bpy.ops.object.mode_set(mode='OBJECT')

# FBX exports often point textures at the author's machine: relink by file name from next to the
# source (including its .fbm folder), ignoring case.
local = {}
for root, _, files in os.walk(os.path.dirname(src)):
    for f in files: local.setdefault(f.lower(), os.path.join(root, f))
for img in bpy.data.images:
    if img.source == 'FILE' and not img.packed_file and not os.path.exists(bpy.path.abspath(img.filepath)):
        hit = local.get(os.path.basename(bpy.path.abspath(img.filepath)).lower())
        if hit: img.filepath = hit; img.reload(); print(f'[enemy] relinked {os.path.basename(hit)}')
        else: print(f'[enemy] MISSING texture {img.filepath}')


def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ---- clean up
def root_of(o):
    while o.parent: o = o.parent
    return o
KEEP = opt['--keep']  # several characters in one file: keep the hierarchy whose root name has this
for o in list(scene.objects):
    if o.type in ('CAMERA', 'LIGHT') or any(d in o.name for d in DROP) or (KEEP and KEEP not in root_of(o).name):
        bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in scene.objects if o.type == 'MESH']
rigged = any(o.find_armature() for o in meshes)
arms = [o for o in scene.objects if o.type == 'ARMATURE']
if NO_ANIMS:
    for o in arms:
        if o.animation_data: o.animation_data_clear()
        for pb in o.pose.bones: pb.matrix_basis.identity()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
if MIXAMO:
    import re
    for o in arms:
        for bone in o.data.bones:  # 'mixamorig:Hips_Tpose' / 'Hips' -> 'mixamorigHips'
            base = re.sub(r'_(Tpose|Idle|Walk|Death)$', '', re.sub(r'^mixamorig\d*:?', '', bone.name))
            bone.name = 'mixamorig' + base
        print(f'[enemy] {o.name}: bones renamed, e.g. {[b.name for b in o.data.bones][:3]}')
print(f'[enemy] {os.path.basename(src)}: {len(meshes)} meshes, {sum(map(tris, meshes))} tris, rigged={rigged}')

# ---- static: join + decimate
if not rigged:
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o, do_unlink=True)
    # merge the split vertices scanned/AI models come with first (they wreck the decimator)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001); bpy.ops.object.mode_set(mode='OBJECT')
    n = tris(body)
    if n > MAX_TRIS:
        m = body.modifiers.new('dec', 'DECIMATE'); m.ratio = MAX_TRIS / n; m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in body.data.polygons: p.use_smooth = True
    meshes = [body]
    print(f'[enemy] decimated {n} -> {tris(body)} tris')

# ---- normalise size / placement / facing (on the top-level objects)
bpy.context.view_layer.update()
# measure the mesh as it's actually drawn (skinned meshes: after the armature deforms them)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in meshes:
    ev = o.evaluated_get(dg)
    pts += [ev.matrix_world @ v.co for v in ev.to_mesh().vertices]
    ev.to_mesh_clear()
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
s = HEIGHT / (hi.z - lo.z)
feet = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
M = mathutils.Matrix.Rotation(math.radians(ROT_Z), 4, 'Z') @ mathutils.Matrix.Scale(s, 4) @ mathutils.Matrix.Translation(-feet)
for o in [o for o in scene.objects if o.parent is None]:
    o.matrix_world = M @ o.matrix_world
bpy.context.view_layer.update()
print(f'[enemy] scaled x{s:.3f} to {HEIGHT} m')

# ---- textures
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    nt = mat.node_tree
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
    surf = out.inputs['Surface'].links[0].from_node if out and out.inputs['Surface'].links else None
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    if out and surf and surf.type != 'BSDF_PRINCIPLED' and tex:
        # glTF only understands Principled BSDF: rebuild older shaders (Diffuse etc.) around the image
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf: continue
    for name in ('Metallic', 'Roughness'):
        for l in list(bsdf.inputs[name].links): nt.links.remove(l)
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Roughness'].default_value = 0.75
    for sock in ('Specular IOR Level', 'Transmission Weight'):
        if sock in bsdf.inputs:
            for l in list(bsdf.inputs[sock].links): nt.links.remove(l)
for n in [n for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and not n.outputs['Color'].links and not n.outputs['Alpha'].links]:
    n.id_data.nodes.remove(n)
for img in bpy.data.images:
    if img.size[0] > MAX_TEX or img.size[1] > MAX_TEX:
        k = MAX_TEX / max(img.size)
        img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))

# ---- export
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_glb, export_format='GLB', export_image_format='WEBP', export_image_quality=80,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_animations=rigged and not NO_ANIMS, export_skins=rigged, export_apply=not rigged,
    export_cameras=False, export_lights=False, export_extras=False)
print(f'[enemy] wrote {out_glb} ({os.path.getsize(out_glb) / 1e6:.2f} MB)')

# ---- preview: front and side, textured, flat light
if opt['--preview']:
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'
    scene.render.resolution_x, scene.render.resolution_y = 384, 512
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('w'); scene.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = HEIGHT * 1.15
    scene.camera = cam
    base = os.path.splitext(opt['--preview'])[0]
    for tag, loc, rot in (('front', (0, -6, HEIGHT / 2), (math.pi / 2, 0, 0)), ('side', (6, 0, HEIGHT / 2), (math.pi / 2, 0, math.pi / 2))):
        cam.location = loc; cam.rotation_euler = rot
        scene.render.filepath = f'{base}_{tag}.png'
        bpy.ops.render.render(write_still=True)
    print('[enemy] preview', base)
