"""Contact sheet: every image in a folder (sorted), in a grid, each labelled with its file name's
time stamp (f###_<ms>.jpg → "<ms> ms").  python tools/shots/sheet.py <dir> <out.png> [cols] [cellWidth]"""
import os, sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 400  # cell width, px
files = sorted(f for f in os.listdir(src) if f.lower().endswith(('.jpg', '.png')))
if not files:
    sys.exit('no frames in ' + src)
ims = [Image.open(os.path.join(src, f)).convert('RGB') for f in files]
# (a mobile-emulation screencast frame is the device screen: the 844x390 page sits at its top)
ims = [im.crop((0, 0, im.width, round(im.width * 390 / 844))) if im.height > im.width * 0.6 else im for im in ims]
w, h = cell, round(cell * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 4) + 4, rows * (h + 4) + 4), (20, 20, 24))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = 4 + (i % cols) * (w + 4), 4 + (i // cols) * (h + 4)
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    label = f.split('_', 1)[1].rsplit('.', 1)[0] + ' ms' if '_' in f else f
    d.rectangle([x, y, x + 62, y + 14], fill=(0, 0, 0))
    d.text((x + 3, y + 2), label, fill=(255, 255, 0))
sheet.save(out)
print('sheet', out, len(ims), 'frames')
