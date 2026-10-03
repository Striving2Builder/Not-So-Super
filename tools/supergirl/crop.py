"""Crop hero-lab sheet tiles (dev only):
    python tools/supergirl/crop.py <label> <out> <rows> <cols> [scale]
rows/cols: comma lists of indices (rows = lab STATES order, cols = CAMS order); rows -1 = the sprite strip.
Reads/writes shots/supergirl/."""
import os
import sys
from PIL import Image

T, D, X0 = 300, 2, 90
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'shots', 'supergirl')
lab, out = sys.argv[1], sys.argv[2]
rows = [int(v) for v in sys.argv[3].split(',')]
cols = [int(v) for v in sys.argv[4].split(',')]
sc = float(sys.argv[5]) if len(sys.argv) > 5 else 1
im = Image.open(os.path.join(SHOTS, lab + '.png'))
if rows == [-1]:
    y0 = (im.height // D - 360) * D
    c = im.crop((0, y0, im.width, im.height))
else:
    c = Image.new('RGB', (len(cols) * T * D, len(rows) * T * D))
    for i, r in enumerate(rows):
        for j, k in enumerate(cols):
            c.paste(im.crop(((X0 + k * T) * D, r * T * D, (X0 + (k + 1) * T) * D, (r + 1) * T * D)), (j * T * D, i * T * D))
if sc != 1:
    c = c.resize((int(c.width * sc), int(c.height * sc)), Image.LANCZOS)
c.save(os.path.join(SHOTS, out + '.png'))
