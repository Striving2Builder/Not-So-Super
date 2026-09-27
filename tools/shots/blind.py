# Blind A/B pairs for the polish critics: each pair = one of our screenshots + one AAA reference,
# centre-cropped to the same phone aspect and size, randomly assigned to A/B. The answer key goes to
# a separate file the critic never sees.
#
#   python tools/shots/blind.py <area> <shots-label> [--pairs 6] [--refs docs/references]
#   → shots/blind/<area>-<label>/pair1_A.png, pair1_B.png, ...  and  shots/blind/<area>-<label>.key.json
import json, os, random, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
args = sys.argv[1:]
area, label = args[0], args[1]
opt = lambda k, d: args[args.index(k) + 1] if k in args else d
pairs = int(opt('--pairs', '6'))
refs_dir = os.path.join(ROOT, opt('--refs', 'docs/references'))
W, H = 1280, 592  # our phone frames are 844x390 (2.16:1)

ours = sorted(os.path.join(ROOT, 'shots', label, area, f) for f in os.listdir(os.path.join(ROOT, 'shots', label, area)) if f.endswith('.png') and 'FAILED' not in f)
pool = [os.path.join(refs_dir, area, f) for f in os.listdir(os.path.join(refs_dir, area))] if os.path.isdir(os.path.join(refs_dir, area)) else []
pool = [p for p in pool if p.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
if not ours or not pool: sys.exit(f'need screenshots ({len(ours)}) and references ({len(pool)}) for {area}')


def fit(path):
    im = Image.open(path).convert('RGB')
    r = W / H
    if im.width / im.height > r:  # too wide: crop the sides
        nw = int(im.height * r); x = (im.width - nw) // 2; im = im.crop((x, 0, x + nw, im.height))
    else:
        nh = int(im.width / r); y = (im.height - nh) // 2; im = im.crop((0, y, im.width, y + nh))
    return im.resize((W, H), Image.LANCZOS)


out = os.path.join(ROOT, 'shots', 'blind', f'{area}-{label}')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out): os.remove(os.path.join(out, f))
rng = random.Random()
our_pick = rng.sample(ours, min(pairs, len(ours)))
ref_pick = [pool[i % len(pool)] for i in rng.sample(range(max(len(pool), len(our_pick))), len(our_pick))]
key = {}
for i, (o, r) in enumerate(zip(our_pick, ref_pick), 1):
    ours_is_a = rng.random() < 0.5
    a, b = (o, r) if ours_is_a else (r, o)
    fit(a).save(os.path.join(out, f'pair{i}_A.png'))
    fit(b).save(os.path.join(out, f'pair{i}_B.png'))
    key[f'pair{i}'] = {'ours': 'A' if ours_is_a else 'B', 'our_shot': os.path.relpath(o, ROOT), 'reference': os.path.relpath(r, ROOT)}
with open(os.path.join(ROOT, 'shots', 'blind', f'{area}-{label}.key.json'), 'w') as fh: json.dump(key, fh, indent=2)
print(f'{len(key)} pairs → {out}')
