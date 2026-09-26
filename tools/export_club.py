# Blender (background) script: convert a club .blend into a web-ready GLB + light/metadata JSON.
#
#   blender -b "assets/models/3D Nightclubs/GTA4_The_Triangle_Club.blend" --python tools/export_club.py -- \
#       assets/clubs/triangle.glb [--max-tex 1024] [--max-tris 250000] [--replace assets/clubs/replacements]
#
# What it does:
#   * realizes collection instances (props placed as instances) into real geometry
#   * swaps any texture whose file name matches a PNG in --replace (used to swap out explicit posters)
#   * downsizes textures above --max-tex and decimates heavy meshes until the scene is under --max-tris
#   * records lights (position/colour/power, glTF Y-up) into <name>.json and drops lights & cameras
#   * exports GLB with Draco-compressed geometry and WebP textures
import bpy, bmesh, os, sys, json, mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_glb = os.path.abspath(argv[0])
opt = {'--max-tex': '1024', '--max-tris': '250000', '--replace': ''}
for i, a in enumerate(argv):
    if a in opt and i + 1 < len(argv):
        opt[a] = argv[i + 1]
MAX_TEX, MAX_TRIS, REPLACE = int(opt['--max-tex']), int(opt['--max-tris']), opt['--replace']
log = lambda *a: print('EXPORT', *a, flush=True)

scene = bpy.context.scene
view_layer = bpy.context.view_layer

# 1) realize collection instances
for o in list(scene.objects):
    o.select_set(False)
inst = [o for o in scene.objects if o.instance_type == 'COLLECTION' and o.instance_collection]
for o in inst:
    o.hide_set(False)
    o.select_set(True)
if inst:
    view_layer.objects.active = inst[0]
    bpy.ops.object.duplicates_make_real(use_base_parent=False, use_hierarchy=False)
log('realized instances', len(inst))

# 2) swap replacement textures
swapped = 0
if REPLACE and os.path.isdir(REPLACE):
    reps = {os.path.splitext(f)[0].lower(): os.path.join(os.path.abspath(REPLACE), f) for f in os.listdir(REPLACE) if f.lower().endswith('.png')}
    for img in bpy.data.images:
        base = os.path.splitext(os.path.basename(bpy.path.abspath(img.filepath) or img.name))[0].lower()
        if base in reps:
            if img.packed_file:
                img.unpack(method='REMOVE')
            img.filepath = reps[base]
            img.source = 'FILE'
            img.reload()
            swapped += 1
            log('replaced texture', base)
log('replaced', swapped)

# 3a) drop images with no pixel data (missing files) so the GLB never references a broken texture
dropped = 0
for img in list(bpy.data.images):
    if img.type != 'IMAGE':
        continue
    try:
        ok = img.has_data or (img.pixels and len(img.pixels) > 0)
    except Exception:
        ok = False
    if not ok or not img.size[0]:
        bpy.data.images.remove(img)
        dropped += 1
log('dropped unloadable images', dropped)

# DDS sources report no file_format, which trips the glTF image encoder; give them a known one
# (the exporter re-encodes everything to WebP from pixel data anyway).
retagged = 0
for img in bpy.data.images:
    if img.type == 'IMAGE' and img.file_format not in ('PNG', 'JPEG', 'WEBP', 'TARGA', 'BMP'):
        img.file_format = 'PNG'
        retagged += 1
log('retagged image formats', retagged)

# 3b) downsize big textures
scaled = 0
for img in bpy.data.images:
    w, h = img.size[:]
    if w and h and max(w, h) > MAX_TEX:
        k = MAX_TEX / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
        scaled += 1
log('downsized textures', scaled)

# 4) record + remove lights and cameras
lights = []
for o in list(scene.objects):
    if o.type == 'LIGHT':
        p = o.matrix_world.translation
        L = o.data
        lights.append({'type': L.type, 'pos': [round(p.x, 3), round(p.z, 3), round(-p.y, 3)],
                       'color': [round(c, 3) for c in L.color], 'power': round(L.energy, 2)})
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)

# 5) decimate heavy meshes if the scene is too dense
deps = bpy.context.evaluated_depsgraph_get()
def tri_count(o):
    me = o.evaluated_get(deps).to_mesh()
    t = sum(len(p.vertices) - 2 for p in me.polygons)
    o.evaluated_get(deps).to_mesh_clear()
    return t
meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
counts = {o.name: tri_count(o) for o in meshes}
total = sum(counts.values())
log('tris before', total)
if total > MAX_TRIS:
    heavy = [o for o in meshes if counts[o.name] > 3000]
    heavy_sum = sum(counts[o.name] for o in heavy)
    keep = total - heavy_sum
    ratio = max(0.02, (MAX_TRIS - keep) / max(1, heavy_sum))
    for o in heavy:
        m = o.modifiers.new('WebDecimate', 'DECIMATE')
        m.ratio = ratio
        m.use_collapse_triangulate = True
    log('decimated', len(heavy), 'meshes at ratio', round(ratio, 3))
    deps = bpy.context.evaluated_depsgraph_get()
    log('tris after', sum(tri_count(o) for o in meshes))

# 6) bounds (glTF Y-up)
bb_min = mathutils.Vector((1e9, 1e9, 1e9)); bb_max = -bb_min.copy()
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        bb_min = mathutils.Vector(map(min, bb_min, w)); bb_max = mathutils.Vector(map(max, bb_max, w))

# 7) export
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_glb, export_format='GLB', export_apply=True, use_renderable=True,
    export_image_format='WEBP', export_image_quality=80,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_lights=False, export_cameras=False, export_yup=True,
)
meta = {
    'source': os.path.basename(bpy.data.filepath),
    'bounds': {'min': [bb_min.x, bb_min.z, -bb_max.y], 'max': [bb_max.x, bb_max.z, -bb_min.y]},
    'lights': sorted(lights, key=lambda l: -l['power']),
}
with open(os.path.splitext(out_glb)[0] + '.json', 'w') as f:
    json.dump(meta, f, indent=1)
log('wrote', out_glb, os.path.getsize(out_glb) // 1024, 'KB', 'lights', len(lights))
