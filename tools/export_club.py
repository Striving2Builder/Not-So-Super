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
opt = {'--max-tex': '1024', '--max-tris': '250000', '--replace': '', '--img': 'WEBP'}
for i, a in enumerate(argv):
    if a in opt and i + 1 < len(argv):
        opt[a] = argv[i + 1]
MAX_TEX, MAX_TRIS, REPLACE, IMG_FMT = int(opt['--max-tex']), int(opt['--max-tris']), opt['--replace'], opt['--img']
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

# 1b) drop volume-only objects (fog/haze boxes): invisible in glTF, but their faces would block
#     floor probes and collisions in the game.
def volume_only(mat):
    nt = mat.node_tree if mat else None
    if not nt:
        return False
    outs = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL']
    return bool(outs) and all(o.inputs['Volume'].is_linked and not o.inputs['Surface'].is_linked for o in outs)
vol = [o for o in scene.objects if o.type == 'MESH' and o.material_slots and
       all(volume_only(s.material) for s in o.material_slots)]
for o in vol:
    log('dropped volume object', o.name)
    bpy.data.objects.remove(o, do_unlink=True)

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

# 2b) normalize materials into something glTF understands.
#     Game rips (GTA etc.) use Diffuse BSDFs, colour Mix nodes / groups in front of the texture, and
#     "Mix Shader(Transparent, Surface, fac=alpha)" for cut-outs. The glTF exporter can't follow any of
#     that and writes blank grey materials. Rebuild each as: Image → Principled BSDF → Output,
#     with image alpha → (> 0.5) → Alpha so leaves/railings export as alpha-mask cut-outs.
def upstream(node, want, seen=None):
    """First node of type `want` feeding into `node` (depth-first through any links)."""
    seen = seen or set()
    if node in seen:
        return None
    seen.add(node)
    for inp in node.inputs:
        for l in inp.links:
            if l.from_node.type == want:
                return l.from_node
            f = upstream(l.from_node, want, seen)
            if f:
                return f
    return None

fixed = cutouts = 0
for m in bpy.data.materials:
    nt = m.node_tree
    if not nt:
        continue
    N, Lk = nt.nodes, nt.links
    outs = [n for n in N if n.type == 'OUTPUT_MATERIAL']
    if not outs:
        continue
    P = next((n for n in N if n.type == 'BSDF_PRINCIPLED'), None)
    D = next((n for n in N if n.type == 'BSDF_DIFFUSE'), None)
    E = next((n for n in N if n.type == 'EMISSION'), None)
    # the transparency mix is driven by a texture's alpha (not the Cycles "Is Shadow Ray" trick)
    alpha_mix = next((n for n in N if n.type == 'MIX_SHADER' and n.inputs[0].is_linked and
                      n.inputs[0].links[0].from_node.type != 'LIGHT_PATH' and
                      any(l.from_node.type == 'BSDF_TRANSPARENT' for i in n.inputs[1:] for l in i.links)), None)
    principled_ok = P and any(l.from_node == P for o in outs for l in o.inputs['Surface'].links)
    if principled_ok and not alpha_mix:
        continue  # already exports fine
    if not P:
        P = N.new('ShaderNodeBsdfPrincipled')
        P.location = (outs[0].location.x - 300, outs[0].location.y)
        src = D or E
        # base colour: the texture upstream of the old shader's colour, else its flat colour
        col_in = src.inputs['Color'] if src else None
        img = None
        if col_in and col_in.is_linked:
            fn = col_in.links[0].from_node
            img = fn if fn.type == 'TEX_IMAGE' else upstream(fn, 'TEX_IMAGE')
        if not img:
            img = next((n for n in N if n.type == 'TEX_IMAGE' and n.image and 'diffuse' in n.name.lower()), None) or \
                  next((n for n in N if n.type == 'TEX_IMAGE' and n.image), None)
        if img:
            Lk.new(img.outputs['Color'], P.inputs['Base Color'])
        elif col_in:
            P.inputs['Base Color'].default_value = col_in.default_value
        nm = next((n for n in N if n.type == 'NORMAL_MAP'), None)
        if nm:
            Lk.new(nm.outputs['Normal'], P.inputs['Normal'])
        # only carry emission over if the Emission node actually drives the output and glows
        feeds = E and any(upstream(o, 'EMISSION') == E for o in outs)
        if feeds and E.inputs['Strength'].default_value > 0:
            ec = E.inputs['Color']
            if ec.is_linked:
                Lk.new(ec.links[0].from_socket, P.inputs['Emission Color'])
            else:
                P.inputs['Emission Color'].default_value = ec.default_value
            P.inputs['Emission Strength'].default_value = E.inputs['Strength'].default_value
        P.inputs['Roughness'].default_value = 0.8
    if alpha_mix:
        fac = alpha_mix.inputs[0].links[0].from_socket
        # Mix: fac=0 → shader 1, fac=1 → shader 2. Transparent in slot 1 means alpha = fac.
        transparent_first = any(l.from_node.type == 'BSDF_TRANSPARENT' for l in alpha_mix.inputs[1].links)
        base_img = P.inputs['Base Color'].links[0].from_node if P.inputs['Base Color'].is_linked else None
        # glTF can only cut out using the base-colour texture's own alpha channel. Anything else
        # (inverted alpha, alpha from another image) would force the exporter to bake a new image,
        # which is exactly where it crashes — so those stay opaque rather than lose their texture.
        if transparent_first and fac.name == 'Alpha' and fac.node == base_img:
            clip = N.new('ShaderNodeMath'); clip.operation = 'GREATER_THAN'; clip.inputs[1].default_value = 0.5
            Lk.new(fac, clip.inputs[0])
            Lk.new(clip.outputs[0], P.inputs['Alpha'])
            cutouts += 1
        else:
            # e.g. translucent light-beam cones: keep the original material (it exports as a blend)
            log('kept original transparency (not a texture cut-out):', m.name)
            continue
    for o in outs:
        Lk.new(P.outputs['BSDF'], o.inputs['Surface'])
        o.target = 'ALL'  # engine-specific (Cycles-only) outputs are invisible to the glTF exporter
    outs[0].is_active_output = True
    fixed += 1
log('normalized materials', fixed, 'cut-outs', cutouts)

# 3a) drop images with no pixel data (missing files) so the GLB never references a broken texture
dropped = 0
for img in list(bpy.data.images):
    if img.type != 'IMAGE':
        continue
    if img.source in ('MOVIE', 'SEQUENCE'):  # video textures (e.g. TV screens) can't go into glTF
        bpy.data.images.remove(img)
        dropped += 1
        continue
    try:
        ok = img.has_data or (img.pixels and len(img.pixels) > 0)
    except Exception:
        ok = False
    if not ok or not img.size[0]:
        bpy.data.images.remove(img)
        dropped += 1
log('dropped unloadable images', dropped)

# DDS (and other odd) sources trip the glTF image encoder, especially premultiplied-alpha ones.
# Write each out as a real PNG in a temp folder and point the image at it, so the exporter
# always starts from a plain PNG file.
# Convert DDS files on disk with ffmpeg (handles DXT alpha correctly) and repoint the images.
import tempfile, subprocess, shutil
png_dir = tempfile.mkdtemp(prefix='club_png_')
ffmpeg = shutil.which('ffmpeg')
converted = 0
for i, img in enumerate(bpy.data.images):
    if img.type != 'IMAGE' or img.packed_file:
        continue
    src = bpy.path.abspath(img.filepath)
    if not src.lower().endswith('.dds') or not os.path.isfile(src):
        continue
    if not ffmpeg:
        img.file_format = 'PNG'  # fallback: at least give the encoder a known format
        continue
    dst = os.path.join(png_dir, f'img{i}.png')
    r = subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', src, dst], capture_output=True)
    if r.returncode or not os.path.isfile(dst):
        log('ffmpeg failed on', os.path.basename(src), r.stderr[:120])
        continue
    img.filepath = dst
    img.source = 'FILE'
    img.alpha_mode = 'STRAIGHT'
    img.reload()
    converted += 1
log('converted DDS to PNG', converted, '(ffmpeg found)' if ffmpeg else '(NO ffmpeg on PATH)')
# Anything still in an odd format (packed DDS, EXR, TIFF…) gets a known one so the glTF
# encoder re-encodes it from pixel data instead of choking on it.
for img in bpy.data.images:
    if img.type == 'IMAGE' and img.file_format not in ('PNG', 'JPEG', 'WEBP'):
        img.file_format = 'PNG'

# 3b) downsize big textures
scaled = 0
for img in bpy.data.images:
    w, h = img.size[:]
    if w and h and max(w, h) > MAX_TEX:
        k = MAX_TEX / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))
        scaled += 1
log('downsized textures', scaled)

# 3c) WebP can't store 1-channel (grayscale) images — bump/roughness/displacement maps.
#     Copy them into ordinary RGBA images and remap every user.
expanded = 0
for img in list(bpy.data.images):
    # Blender reports 4 channels for everything; the real format shows in the bit depth
    # (8 or 16 bits per pixel = single-channel grayscale).
    if img.type != 'IMAGE' or not img.size[0] or img.depth >= 24:
        continue
    try:
        w, h = img.size[:]
        rgb = bpy.data.images.new(img.name + '_rgb', w, h, alpha=True)  # keep gray+alpha cut-outs
        rgb.pixels.foreach_set(list(img.pixels))  # Blender exposes pixels as RGBA even for grayscale
        rgb.colorspace_settings.name = img.colorspace_settings.name
        rgb.pack()
        img.user_remap(rgb)
        expanded += 1
    except Exception as e:
        log('could not expand grayscale image', img.name, e)
log('expanded grayscale images', expanded)

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
    export_image_format=IMG_FMT, export_image_quality=80,
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
