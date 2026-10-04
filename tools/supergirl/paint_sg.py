"""Comic repaint of Supergirl's atlas (assets/models/supergirl.glb), dev only:
    python tools/supergirl/paint_sg.py
Inputs (shots/supergirl/work/): SG_DCU_A.png / SG_DCU_N.png (extracted from the shipped model) and the
texel maps baked by tools/heroskins/hs_blender.py bake() into shots/supergirl/hswork/ (posmap, islmap).
Output: shots/supergirl/work/sg_A.png, sg_N.png, which sg_blender.py packs into the GLB.
- hair: a painted lock swatch for the new hair shell (glTF UV rect inside herofly3d's HAIR.uv), the old
  dark scalp paint turned blonde
- face: comic eyes (bold upper lash line with a flick, lower lid), defined brows, red lips, cleaner skin,
  bigger blue irises on the eyeball texture
- costume: flat colour blocking (blue suit, red skirt/boots, gold belt/trim) keeping seams as ink
Mesh-local space: y up, +z front, +x = her left. Map rows are bottom-up (Blender UV), flipped here."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, '..', '..', 'shots', 'supergirl')
W_ = os.path.join(SH, 'work'); B_ = os.path.join(SH, 'hswork')
A = np.asarray(Image.open(os.path.join(W_, 'SG_DCU_A.png')).convert('RGB')).astype(np.float32)
NM = np.asarray(Image.open(os.path.join(W_, 'SG_DCU_N.png')).convert('RGB')).astype(np.float32)
P = np.load(os.path.join(B_, 'posmap.npy'))[::-1]
I = np.load(os.path.join(B_, 'islmap.npy'))[::-1]
H, W = I.shape
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
used = I >= 0
lum = A @ np.array([0.299, 0.587, 0.114], np.float32)
out = A.copy(); nout = NM.copy()
FLATN = np.array([128, 128, 255], np.float32)

ARMS, T_FRONT, T_BACK = (53, 54), 399, 383
SKIRT, BOOTS, THIGHS = (382, 387), (209, 389), (393, 394)
BELT = (391, 404, 407, 403)
HEAD = (388, 390)
SHIELD = (417, 385, 414, 415)


def isl(*ids): return np.isin(I, ids)
def blurf(a, r):
    """gaussian blur of a float field"""
    return gaussian_filter(a.astype(np.float32), r)
def dilate(m, r=1):
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))
    return np.asarray(im) > 127


def block(m, target, keep=0.35, detail=0.55, flatten=0.5):
    """flat comic colour: the class colour, keeping the source's small detail (seams, panel lines:
    luminance over a wide blur) at `detail` and only `keep` of its broad baked shading."""
    if not m.any(): return
    lb = blurf(np.where(m, lum, np.median(lum[m])), 12)
    med = max(1, np.median(lum[m]))
    broad = 1 + (np.clip(lb[m] / med, 0.5, 1.6) - 1) * keep
    fine = 1 + (np.clip(lum[m] / np.maximum(1, lb[m]), 0.55, 1.4) - 1) * detail
    out[m] = np.asarray(target, np.float32) * (broad * fine)[:, None]
    if flatten: nout[m] = nout[m] * (1 - flatten) + FLATN * flatten


hue_r = A[..., 0] > A[..., 2] * 1.4
mouth = np.zeros((H, W), bool); mouth[0:115, 915:1024] = True  # teeth / mouth interior: left alone
blue = (A[..., 2] > A[..., 0] + 10) & used & ~isl(*HEAD)
# ---- costume colour blocking
block(blue & ~isl(*SHIELD), (30, 92, 214), keep=0.3, detail=0.7, flatten=0.4)
red = used & hue_r & (A[..., 0] > 90) & (A[..., 1] < A[..., 0] * 0.55) & ~isl(*HEAD) & ~mouth & ~isl(*ARMS)
block(red, (214, 24, 34), keep=0.3, detail=0.25, flatten=0.3)
gold = used & (A[..., 0] > 120) & (A[..., 1] > A[..., 0] * 0.55) & (A[..., 2] < A[..., 1] * 0.75) & (A[..., 0] - A[..., 2] > 70) & ~isl(*HEAD) & ~isl(*ARMS) & ~mouth & (Y > 0.3)
block(gold & ~isl(*SHIELD), (250, 196, 40), keep=0.3, detail=0.5, flatten=0.3)
# the gold emblem on her upper back (island 413) peeks out between hair and cape as a bright fleck: suit blue
out[isl(413) & used] = np.array([30, 92, 214], np.float32) * 0.9; nout[isl(413) & used] = FLATN

# ---- skin: warm, clean, light: one flat tone with a soft hint of the source's form (and a quarter
# of its fine detail: nostrils, ear folds), the features are painted on top below
skin_tone = np.array([242, 184, 146], np.float32)
skin = used & isl(*HEAD) & (A[..., 0] > A[..., 2] + 12)
hands = used & isl(*ARMS) & (A[..., 0] > A[..., 2] + 25) & (A[..., 0] > 140)
for m, keep in ((skin, 0.25), (hands, 0.35)):
    if not m.any(): continue
    med = np.median(lum[m])
    broad = blurf(np.where(m, lum, med), 10)
    fine = np.clip(lum / np.maximum(1, blurf(np.where(m, lum, med), 2.5)), 0.6, 1.3)
    k = (0.9 + 0.1 * np.clip(broad / med, 0.7, 1.2)) * (1 + (fine - 1) * keep)
    out[m] = skin_tone * k[m][:, None]
    nout[m] = FLATN
# cheeks: a soft blush
blush = np.zeros((H, W), np.float32)
yy, xx = np.mgrid[0:H, 0:W]
for cx in (112, 220):
    blush += np.exp(-(((xx - cx) / 16.0) ** 2 + ((yy - 140) / 11.0) ** 2))
blush = np.clip(blush, 0, 1) * 0.28 * skin
out[...] = out * (1 - blush[..., None]) + np.array([236, 120, 110], np.float32) * blush[..., None]
# ---- scalp: the old dark-brown painted hair under the shell becomes a shadow blonde
scalp = used & isl(*HEAD) & (lum < 120) & (A[..., 0] >= A[..., 2]) & ((Y > 1.64) | ((Z < 0.10) & (Y > 1.52)))
out[scalp] = np.array([196, 140, 58], np.float32)
# dark hair paint on the cheeks / in front of the ears (shows under the shell's edge): skin
cheek = used & isl(*HEAD) & (lum < 130) & (A[..., 0] >= A[..., 2]) & ~scalp & (Z > 0.05) & (Y < 1.66) & (Y > 1.48)
out[cheek] = skin_tone
# the old card strand strip, if anything still samples it
strip = np.zeros((H, W), bool); strip[835:1024, 0:92] = True
out[strip] = np.array([226, 178, 84], np.float32)

# ---- hair shell swatch (glTF UV: u around the head from the back, v = crown -> tips)
SW = (100, 600, 590, 1010)
x0, y0, x1, y1 = SW
sw_w, sw_h = x1 - x0, y1 - y0
rng = np.random.default_rng(7)
uu, vv = np.meshgrid((np.arange(sw_w) + 0.5) / sw_w, (np.arange(sw_h) + 0.5) / sw_h)
NL = 10                                                 # locks round the head
lock_px = sw_w / NL
wave = 0.018 * np.sin(vv * 7 + uu * 25) + 0.01 * np.sin(vv * 13 - uu * 40)
q = (uu + wave) * NL
li = np.floor(q).astype(int) % NL
p = q - np.floor(q)
base = np.array([240, 194, 96], np.float32); shade = np.array([184, 118, 40], np.float32); hi = np.array([255, 240, 170], np.float32)
rnd = np.sin(np.pi * p) ** 0.6                           # each lock is rounded: lit in its middle
sw = shade[None, None] * (1 - rnd[..., None]) + base[None, None] * rnd[..., None]
# comic shine: a tapered light crescent across each lock near the crown
sh_v = 0.34 + 0.02 * np.sin(li * 2.1) - 0.04 * p
sh_a = np.clip((0.03 * np.sin(np.pi * np.clip(p * 1.1 - 0.05, 0, 1)) - np.abs(vv - sh_v)) * sw_h, 0, 1)
sw = sw * (1 - sh_a[..., None]) + hi * sh_a[..., None]
INKC = np.array([34, 26, 40], np.float32)               # (blue-leaning: the flight shader keeps it as ink, not hair)
def stroke(dist_px, start, end, wmax):
    """anti-aliased tapered stroke: alpha from the distance (px) to its centre line"""
    t = np.clip((vv - start) / 0.12, 0, 1) * np.clip((end - vv) / 0.05, 0, 1)
    return np.clip(wmax * t - dist_px + 0.5, 0, 1) * (vv > start) * (vv < end)
# lock boundaries: most of them, starting below the crown at random heights
on = rng.random(NL) < 0.75
st = 0.06 + rng.random(NL) * 0.22
db = np.minimum(p, 1 - p) * lock_px
bi = np.where(p < 0.5, li, (li + 1) % NL)               # the boundary this texel is nearest
a1 = stroke(db, st[bi], 1.02, 3.2) * on[bi]
# a short inner stroke toward the tips of some locks
on2 = rng.random(NL) < 0.5
st2 = 0.55 + rng.random(NL) * 0.2
dm = np.abs(p - (0.45 + 0.1 * np.sin(li * 1.7))) * lock_px
a2 = stroke(dm, st2[li], 1.02, 2.4) * on2[li]
al = np.maximum(a1, a2) * np.clip((np.minimum(uu, 1 - uu) - 0.03) / 0.03, 0, 1)  # (no stroke on the front parting seam)
sw = sw * (1 - al[..., None]) + INKC * al[..., None]
out[y0:y1, x0:x1] = sw
nout[y0:y1, x0:x1] = FLATN

# ---- face paint (image px, at 4x then down: anti-aliased)
S = 4
ov = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
def poly(pts, col): d.polygon([(x * S, y * S) for x, y in pts], fill=col)
def line(pts, col, w): d.line([(x * S, y * S) for x, y in pts], fill=col, width=int(w * S), joint='curve')
INK = (34, 20, 22, 255)
for cx, cy, out_dir in ((125, 103, -1), (205, 103, 1)):
    # upper lash line: a bold arc over the opening, thicker toward the outer corner, with a flick
    o = out_dir
    a = [(cx - 19 * o, cy + 1), (cx - 10 * o, cy - 4), (cx, cy - 5.5), (cx + 10 * o, cy - 4.5), (cx + 19 * o, cy - 1.5), (cx + 24 * o, cy - 5)]
    line(a[:5], INK, 2.6)
    line(a[3:], INK, 3.2)
    # lower lid: a short soft line
    line([(cx - 12 * o, cy + 5), (cx, cy + 6.5), (cx + 13 * o, cy + 4)], (120, 70, 60, 170), 1.2)
    # brow: a clean arch, darker blonde-brown, thick at the inner end
    poly([(cx - 20 * o, cy - 17), (cx - 6 * o, cy - 23.5), (cx + 8 * o, cy - 24), (cx + 22 * o, cy - 19),
          (cx + 8 * o, cy - 20.5), (cx - 6 * o, cy - 19.5), (cx - 19 * o, cy - 13.5)], (112, 64, 30, 245))
# lips: a red mouth with an ink parting line
poly([(146, 170), (156, 166), (165, 168), (174, 166), (184, 170), (174, 173), (165, 174), (156, 173)], (206, 54, 62, 220))
poly([(148, 171), (156, 175), (165, 180), (174, 175), (182, 171), (174, 172), (165, 173), (156, 172)], (222, 84, 88, 220))
line([(146, 171), (156, 172.5), (165, 173.5), (174, 172.5), (184, 171)], (90, 24, 30, 255), 1.4)
# nose: one short ink tick under the tip
line([(161, 147), (166, 149), (171, 147)], (150, 90, 70, 200), 1.3)
ov = ov.resize((W, H), Image.LANCZOS)
oa = np.asarray(ov).astype(np.float32)
al = oa[..., 3:4] / 255
out[...] = out * (1 - al) + oa[..., :3] * al

# ---- eyeballs: bigger blue irises, black pupils, a catch-light (the two eye discs, top right)
ev = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); d2 = ImageDraw.Draw(ev)
for cx, cy in ((771, 52), (867, 52)):
    d2.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=(236, 238, 244))
    d2.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill=(34, 104, 214))
    d2.ellipse((cx - 11, cy - 11, cx + 11, cy + 11), fill=(22, 60, 150))
    d2.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(10, 10, 16))
    d2.ellipse((cx - 13, cy - 13, cx - 6, cy - 6), fill=(255, 255, 255))
out = np.asarray(ev).astype(np.float32)

# bleed changed texels 3 px into the gutters (no old colours at seams under filtering)
changed = np.any(np.abs(out - A) > 1, -1) & used
for _ in range(3):
    acc = np.zeros_like(out); cnt = np.zeros((H, W), np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        m = np.roll(np.roll(changed, dy, 0), dx, 1)
        acc += np.roll(np.roll(out, dy, 0), dx, 1) * m[..., None]; cnt += m
    grow = (cnt > 0) & ~used & ~changed
    out[grow] = acc[grow] / cnt[grow][:, None]
    changed |= grow
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(W_, 'sg_A.png'))
Image.fromarray(np.clip(nout, 0, 255).astype(np.uint8)).save(os.path.join(W_, 'sg_N.png'))
print('ok', int(blue.sum()), int(red.sum()), int(gold.sum()), int(skin.sum()), int(scalp.sum()))
