# Turn the user's green-screen Supergirl stills into web-ready cutouts (transparent WebP).
#
#   python tools/export_greenscreen.py <in.jpg> [...] --out assets/greenscreen/<costume>/ [--max 1024]
#   python tools/export_greenscreen.py <in.jpg> [...] --faces --out assets/greenscreen/face/<costume>/ --max 160
#   python tools/export_greenscreen.py --classify <dir> [--sheet out.jpg]
#   python tools/export_greenscreen.py --manifest        (after any change: what the game can show)
#
# The raw stills live in assets/greenscreen/raw/ (local only, see .gitignore). What it does:
#   * keys the green by hue, not exact RGB (the backdrops run from pure #00ff00 to a darker lit green):
#     soft alpha on the edge, and green spill pulled out of what's kept (blonde hair against green)
#   * trims to her silhouette (+ a small margin) and caps the long side at --max px
#   * --classify: guesses the costume from what's left: classic (royal-blue long-sleeve suit), croptop
#     (glossy light-blue long-sleeve, Act 2's backup suit) or tube (strapless bandeau, the knockoff)
import os, sys
import numpy as np
from PIL import Image

argv = sys.argv[1:]
opt = {'--out': '', '--max': '1024', '--sheet': '', '--classify': ''}
files = []
i = 0
while i < len(argv):
    if argv[i] in opt: opt[argv[i]] = argv[i + 1]; i += 2
    else: files.append(argv[i]); i += 1
MAX = int(opt['--max'])


def key(img):
    """RGBA float array: green → transparent, spill suppressed on what's kept."""
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)                       # how much green dominates
    alpha = 1 - np.clip((spill - 0.08) / (0.22 - 0.08), 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) * 1.02 + 0.02)  # despill: green never above the other two
    g = np.where(spill > 0, g2, g)
    return np.dstack([r, g, b, alpha])


def trim(rgba, pad=0.03):
    ys, xs = np.nonzero(rgba[..., 3] > 0.5)
    h, w = rgba.shape[:2]
    p = int(max(h, w) * pad)
    y0, y1 = max(ys.min() - p, 0), min(ys.max() + p + 1, h)
    x0, x1 = max(xs.min() - p, 0), min(xs.max() + p + 1, w)
    return rgba[y0:y1, x0:x1]


def costume(rgba):
    """classic | croptop | tube, from the blue of the suit and how much of the body it covers."""
    r, g, b, al = (rgba[..., k] for k in range(4))
    body = al > 0.9
    blue = body & (b > r + 0.12) & (b > g + 0.02)
    skin = body & (r > b + 0.12) & (r > 0.45) & (g > 0.3) & (r < g * 1.6)
    nb, ns = blue.sum(), skin.sum()
    if nb < 50: return 'unknown', 0, 0
    light = float(((r + g + b) / 3)[blue].mean())      # royal blue ≈ 0.3, the glossy light blue ≈ 0.5+
    cover = nb / max(nb + ns, 1)                         # long sleeves: the suit outweighs bare skin
    if cover < 0.32: return 'tube', light, cover
    return ('croptop' if light > 0.42 else 'classic'), light, cover


def to_image(rgba):
    im = Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA')
    if max(im.size) > MAX: im.thumbnail((MAX, MAX), Image.LANCZOS)
    return im


if opt['--classify']:
    d = opt['--classify']
    rows = []
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.jpg'): continue
        rgba = trim(key(Image.open(os.path.join(d, f))))
        c, light, cover = costume(rgba)
        rows.append((f, c, rgba))
        print(f'{c:8s} light={light:.2f} cover={cover:.2f}  {f}')
    if opt['--sheet']:
        from PIL import ImageDraw
        for c in ('classic', 'croptop', 'tube', 'unknown'):
            sel = [x for x in rows if x[1] == c]
            if not sel: continue
            tw, th, cols = 120, 160, 12
            sheet = Image.new('RGB', (cols * tw, ((len(sel) + cols - 1) // cols) * (th + 12)), (60, 60, 70))
            dr = ImageDraw.Draw(sheet)
            for k, (f, _, rgba) in enumerate(sel):
                im = to_image(rgba); im.thumbnail((tw, th))
                x, y = (k % cols) * tw, (k // cols) * (th + 12)
                sheet.paste(im, (x, y), im); dr.text((x + 2, y + th), f[:-4][:20], fill='white')
            base, ext = os.path.splitext(opt['--sheet'])
            sheet.save(f'{base}_{c}{ext}', quality=80)
    sys.exit()

# --manifest: list what's exported into assets/greenscreen/manifest.json (a static site can't list a
# folder; src/herophotos.js reads it). Run after adding or removing cutouts.
if '--manifest' in argv:
    import json
    root = 'assets/greenscreen'
    m = {fr: {c: sorted(f[:-5] for f in os.listdir(f'{root}/{fr}/{c}') if f.endswith('.webp'))
              for c in sorted(os.listdir(f'{root}/{fr}'))} for fr in ('full', 'portrait', 'face')}
    with open(f'{root}/manifest.json', 'w') as fh: json.dump(m, fh, separators=(',', ':'))
    for fr, cs in m.items(): print(fr, {c: len(v) for c, v in cs.items()})
    sys.exit()


def face_box(rgb):
    """(cx, cy, size) of her face: OpenCV's stock Haar cascades (frontal, then profile both ways), the
    biggest hit in the top 70% of the frame (a skirt or a fist isn't her face). None if nothing."""
    import cv2
    grey = cv2.equalizeHist(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    h, w = grey.shape
    found = []
    for need in (6, 3):                                  # strict first; a looser pass for turned/tilted heads
        for name, flip in (('haarcascade_frontalface_default.xml', False), ('haarcascade_frontalface_alt2.xml', False), ('haarcascade_profileface.xml', False), ('haarcascade_profileface.xml', True)):
            cc = cv2.CascadeClassifier(cv2.data.haarcascades + name)
            img = np.ascontiguousarray(grey[:, ::-1]) if flip else grey
            for (x, y, fw, fh) in cc.detectMultiScale(img, 1.08, need, minSize=(w // 14, w // 14)):
                if flip: x = w - x - fw
                if y + fh / 2 < h * 0.7: found.append((fw * fh, x + fw / 2, y + fh / 2, fw))
            if found: break
        if found: break
    if not found: return None
    _, cx, cy, s = max(found)
    return cx, cy, s


# --faces: a square head-and-shoulders crop around her face (HUD face, bubble insets), keyed, --max px
if '--faces' in argv:
    os.makedirs(opt['--out'], exist_ok=True)
    miss = []
    for f in files:
        if f == '--faces': continue
        src = Image.open(f).convert('RGB')
        box = face_box(np.asarray(src))
        if not box: miss.append(os.path.basename(f)); continue
        cx, cy, s = box
        half = s * 1.05                                  # the face fills ~half the square, hair in frame
        rgba = key(src)
        H, W = rgba.shape[:2]
        x0, y0 = int(cx - half), int(cy - half * 0.85)   # a little more room below (chin, collar)
        pad = np.zeros((int(half * 2), int(half * 2), 4), np.float32)
        sx0, sy0, sx1, sy1 = max(x0, 0), max(y0, 0), min(x0 + pad.shape[1], W), min(y0 + pad.shape[0], H)
        pad[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgba[sy0:sy1, sx0:sx1]
        im = to_image(pad)
        out = os.path.join(opt['--out'], os.path.splitext(os.path.basename(f))[0] + '.webp')
        im.save(out, 'WEBP', quality=80, method=4)
    print(f'{len(files) - len(miss)} faces, no face found in: {" ".join(miss) or "none"}')
    sys.exit()

os.makedirs(opt['--out'], exist_ok=True)
for f in files:
    im = to_image(trim(key(Image.open(f))))
    out = os.path.join(opt['--out'], os.path.splitext(os.path.basename(f))[0] + '.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    print(f'{out}  {im.size[0]}x{im.size[1]}  {os.path.getsize(out) // 1024} KB')
