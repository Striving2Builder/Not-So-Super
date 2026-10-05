"""Stitch 16:9 room renders into one walkable plate (the generators can't make 4:1 panoramas).

Each source image becomes a "bay"; neighbouring bays cross-fade over SEAM px and the game hides the
join behind a foreground pillar (stage.js). Mirrored bays (name ending in '~') add variety.
Writes assets/nightclub/plates/<room>.jpg and prints the ART entry for src/nightclub/rooms.js
(width in plate units = 1024 px tall, seam and arch x positions in plate units).

    python tools/nightclub/stitch.py            # every room in ROOMS below
    python tools/nightclub/stitch.py main dark  # just these
"""
import json
import os
import sys
from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'nightclub', 'incoming', 'batch1')
OUT = os.path.join(ROOT, 'assets', 'nightclub', 'plates')
H, SEAM, PLATE_H = 720, 220, 1024

# room -> bays (file stem, '~' = mirrored) and the arch centres in each source image (0..1 across)
ARCH_WALK = [0.31, 0.5, 0.67]
ROOMS = {
    'main': [('mainfloor_walk_06', ARCH_WALK), ('mainfloor_walk_11', ARCH_WALK), ('mainfloor_walk_15', ARCH_WALK)],
    'corridor': [('mainfloor_walk_10', [0.36, 0.5, 0.64]), ('mainfloor_walk_13', [0.36, 0.5, 0.64])],
    'dark': [('mainfloor_walk_14', []), ('mainfloor_walk_14~', [])],
    'bar': [('mainfloor_walk_02', []), ('mainfloor_walk_02~', [])],
    'lounge': [('mainfloor_djview_05', []), ('mainfloor_djview_03', [])],
}


def load(stem):
    flip = stem.endswith('~')
    im = Image.open(os.path.join(SRC, stem.rstrip('~') + '.jpg')).convert('RGB')
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    return ImageOps.mirror(im) if flip else im, flip


def stitch(room, bays):
    ims = [load(s) for s, _ in bays]
    w = sum(im.width for im, _ in ims) - SEAM * (len(ims) - 1)
    out = Image.new('RGB', (w, H))
    x, seams, arches = 0, [], []
    for i, ((im, flip), (_, arch)) in enumerate(zip(ims, bays)):
        if i == 0:
            out.paste(im, (0, 0))
        else:
            # linear cross-fade over the seam, then the rest of the bay
            mask = Image.linear_gradient('L').rotate(90, expand=True).resize((SEAM, H))
            mask = ImageOps.mirror(mask)  # 0 at the left edge of the seam → 255 at the right
            region = out.crop((x, 0, x + SEAM, H))
            out.paste(Image.composite(im.crop((0, 0, SEAM, H)), region, mask), (x, 0))
            out.paste(im.crop((SEAM, 0, im.width, H)), (x + SEAM, 0))
            seams.append(x + SEAM / 2)
        for a in arch:
            arches.append(x + (1 - a if flip else a) * im.width)
        x += im.width - SEAM
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, f'{room}.jpg'), quality=84, optimize=True)
    k = PLATE_H / H
    entry = {'src': f'{room}.jpg', 'w': round(w * k), 'seams': [round(s * k) for s in seams], 'arches': sorted(round(a * k) for a in arches)}
    kb = os.path.getsize(os.path.join(OUT, f'{room}.jpg')) // 1024
    print(f"  {room}: {json.dumps(entry)},  // {w}x{H}, {kb} KB")


if __name__ == '__main__':
    for r in (sys.argv[1:] or ROOMS):
        stitch(r, ROOMS[r])
