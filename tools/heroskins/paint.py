"""Paint the Classic / Ponytail atlases from the Supergirl atlas using a texel->3D position map
(baked by hs_blender.bake() into shots/heroskins/work/). Output: work/<variant>_A.png, _N.png.
usage: python tools/heroskins/paint.py classic|ponytail
Mesh-local space: y up, +z front, +x = her left. Rows of the .npy maps are bottom-up (Blender UV)."""
import sys
import numpy as np
from PIL import Image, ImageFilter

import os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'shots', 'heroskins', 'work').replace('\\', '/')
V = sys.argv[1]
A = np.asarray(Image.open(D + '/SG_DCU_A.png').convert('RGB')).astype(np.float32)
NM = np.asarray(Image.open(D + '/SG_DCU_N.png').convert('RGB')).astype(np.float32)
P = np.load(D + '/posmap.npy')[::-1]
NRM = np.load(D + '/normmap.npy')[::-1]
I = np.load(D + '/islmap.npy')[::-1]
H, W = I.shape
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
used = I >= 0
lum = A @ np.array([0.299, 0.587, 0.114], np.float32)

def isl(*ids): return np.isin(I, ids)
def blur(a, r):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
def dilate(m, r=1):
    im = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))
    return np.asarray(im) > 127
def rect(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = True; return m

ARMS, T_FRONT, T_BACK = (53, 54), 399, 383
SKIRT, BOOTS, THIGHS = (382, 387), (209, 389), (393, 394)
BELT = (391, 404, 407, 403)
HEAD = (388, 390)
hairstrip = rect(0, 835, 92, 1024)

out = A.copy()
nout = NM.copy()
FLATN = np.array([128, 128, 255], np.float32)

# --- skin: her cheeks' / hands' tone, with a soft AO taken from the source's blurred luminance
skin_ref = np.array([182, 121, 94], np.float32)  # her cheeks / hands
def skin_fill(m, ao_src_lum=None):
    l = blur(np.repeat(lum[..., None], 3, -1), 6)[..., 0]
    k = np.clip(l / max(1, np.median(l[m])), 0.8, 1.12) if ao_src_lum is None else ao_src_lum
    out[m] = skin_ref * (0.9 + 0.1 * k[m])[:, None]
    nout[m] = FLATN

def recolor(m, target, keep=0.35, flatten=0.0):
    """target colour, keeping `keep` of the source's relative shading."""
    if not m.any(): return
    l = lum[m]; rel = l / max(1, np.median(l))
    rel = 1 + (np.clip(rel, 0.5, 1.6) - 1) * keep
    out[m] = np.asarray(target, np.float32) * rel[:, None]
    if flatten: nout[m] = nout[m] * (1 - flatten) + FLATN * flatten

def gloss(m, hi, k=0.9, edge=0.06, L=(0.35, 0.55, 0.76)):
    """comic gloss: hard-edged painted highlight where the surface faces a fixed key light."""
    L = np.asarray(L, np.float32); L /= np.linalg.norm(L)
    n = np.nan_to_num(NRM); n /= np.maximum(1e-6, np.linalg.norm(n, axis=-1, keepdims=True))
    d = n @ L
    a = np.clip((d - k) / edge, 0, 1) * m
    out[...] = out * (1 - a[..., None] * 0.75) + np.asarray(hi, np.float32) * (a[..., None] * 0.75)
    sec = np.clip((d - (k - 0.25)) / edge, 0, 1) * m * (1 - a)  # a softer second band
    out[...] = out * (1 - sec[..., None] * 0.18) + np.asarray(hi, np.float32) * (sec[..., None] * 0.18)

def seam(cloth, skin, col, r=1):
    """dark hem line on the cloth side of a cloth/skin boundary (reads as ink at game scale)."""
    e = cloth & dilate(skin, r)
    out[e] = np.asarray(col, np.float32)

# --- knee boots: everything on the boot shell above a V-notched top edge becomes bare leg
def knee_boots():
    m = isl(*BOOTS)
    cx = np.where(X > 0, 0.13, -0.13)
    ang = np.arctan2(X - cx, Z - 0.075)  # 0 = straight ahead
    top = 0.475 - 0.05 * np.clip(1 - np.abs(ang) / 0.55, 0, 1)
    sk = m & (Y > top)
    sk |= isl(410, 411) | (rect(760, 900, 885, 1024) & (Y > 0.4))  # the thigh-boot trims bridge the thigh mesh and the boot shell: keep them, as leg
    out[sk] = skin_ref * 0.97; nout[sk] = FLATN  # flat: the boot's old trim shading must not show through
    return m & ~sk, sk

# --- hair: golden blonde strands (strip used by the cards + scalp paint)
def blonde_strip(m, base=(232, 188, 104), dark=(150, 102, 42)):
    l = lum[m]; t = np.clip((l - np.percentile(l, 5)) / (np.percentile(l, 95) - np.percentile(l, 5) + 1), 0, 1)
    out[m] = np.asarray(dark, np.float32) * (1 - t[:, None]) + np.asarray(base, np.float32) * t[:, None]

def scalp_mask():
    m = isl(*HEAD) & used
    hairline = (Y > 1.655) | ((Z < 0.165) & (Y > 1.54) & (np.abs(X) > 0.055)) | ((Z < 0.115) & (Y > 1.50))
    dark = (lum < 110) & (A[..., 0] >= A[..., 2])
    return m & hairline & dark

def paint_strands(region, base, dark, seed, horizontal=False):
    """a painted hair swatch (strands along v) in a free atlas rect"""
    x0, y0, x1, y1 = region
    rng = np.random.default_rng(seed)
    w, h = x1 - x0, y1 - y0
    n = rng.random(w if not horizontal else h)
    n = np.convolve(n, np.ones(3) / 3, 'same')
    n2 = np.convolve(rng.random(w if not horizontal else h), np.ones(9) / 9, 'same')
    t = np.clip(0.62 + 0.55 * (n - 0.5) + 0.6 * (n2 - 0.5), 0, 1)
    if horizontal: t = np.repeat(t[:, None], w, 1)
    else: t = np.repeat(t[None, :], h, 0)
    sw = np.asarray(dark, np.float32) * (1 - t[..., None]) + np.asarray(base, np.float32) * t[..., None]
    out[y0:y1, x0:x1] = sw
    nout[y0:y1, x0:x1] = FLATN

if V == 'classic':
    blue = isl(*ARMS, T_FRONT, T_BACK) & (A[..., 2] > A[..., 0] + 10)
    recolor(blue, (34, 98, 205), keep=0.45, flatten=0.6)
    recolor(isl(*SKIRT) & (A[..., 0] > A[..., 2]), (196, 22, 30), keep=0.6)
    recolor(isl(*BELT), (246, 196, 38), keep=0.4, flatten=0.5)
    skin_fill(isl(*THIGHS))
    boot, sk = knee_boots()
    recolor(boot, (186, 18, 28), keep=0.5)
    gloss(boot, (255, 150, 150), k=0.86)
    seam(boot, sk, (90, 6, 12))
    blonde_strip(hairstrip)
    sm = scalp_mask(); out[sm] = np.asarray((212, 160, 80), np.float32) * (0.75 + 0.25 * np.clip(lum[sm] / 80, 0, 1.3))[:, None]
elif V == 'ponytail':
    blue = (231, 63, 178)  # placeholder, replaced below
    # the suit: its torso/arm islands plus any small blue suit bits (seam pieces) on the upper body
    torso = (isl(*ARMS, T_FRONT, T_BACK) | ((A[..., 2] > A[..., 0] + 10) & ~isl(*HEAD, 417, 385, 414, 415) & (Y > 1.0))) & used
    zf = np.clip((Z - 0.0) / 0.22, 0, 1)        # 0 back .. 1 front
    bot = 1.276 - 0.004 * zf                     # cut at the underbust (as in the reference), a touch higher at the back
    topl = 1.398 + 0.022 * zf                    # straight across above the bust; the shield fills the band's height
    band = torso & isl(*ARMS, T_FRONT, T_BACK) & (np.abs(X) < 0.168) & (Y > bot) & (Y < topl)
    skin = (torso & ~band)
    # collar on the neck/back-of-head island
    skin |= isl(*HEAD) & (A[..., 2] > A[..., 0] + 15)
    skin_fill(skin)
    recolor(band, (22, 52, 168), keep=0.3, flatten=0.85)
    # top and bottom hems a shade darker (a finished tube-top edge) + ink seam
    hem = band & (dilate(skin, 3))
    out[hem] = out[hem] * 0.72
    seam(band, skin, (8, 14, 60))
    # navel
    nav = isl(T_FRONT) & (np.hypot(X / 0.006, (Y - 1.135) / 0.011) < 1)
    out[nav] = skin_ref * 0.55
    recolor(isl(*SKIRT) & (A[..., 0] > A[..., 2]), (205, 18, 26), keep=0.55)
    gloss(isl(*SKIRT), (255, 175, 170), k=0.82)
    recolor(isl(*BELT), (214, 160, 32), keep=0.5, flatten=0.4)
    gloss(isl(*BELT), (255, 246, 190), k=0.8)
    skin_fill(isl(*THIGHS))
    boot, sk = knee_boots()
    recolor(boot, (196, 14, 24), keep=0.45)
    gloss(boot, (255, 185, 185), k=0.8, edge=0.04)
    seam(boot, sk, (90, 6, 12))
    blonde_strip(hairstrip)
    # swatches for the new hair cap and the ponytail (inside the flight shader's hair UV rect)
    paint_strands((110, 620, 330, 830), (236, 196, 112), (160, 112, 48), 1)
    paint_strands((370, 620, 590, 830), (236, 196, 112), (150, 102, 42), 2)
    sm = scalp_mask() | (isl(388) & (Y > 1.70))
    nape = sm & (Y < 1.585) & (Z < 0.075)
    out[sm & ~nape] = np.asarray((214, 166, 86), np.float32)
    skin_fill(nape)

# bleed painted islands 3 px into the gutters so filtering/mips never pick up the old colours at seams
changed = np.any(np.abs(out - A) > 1, -1) & used
for _ in range(3):
    acc = np.zeros_like(out); cnt = np.zeros((H, W), np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        m = np.roll(np.roll(changed, dy, 0), dx, 1)
        acc += np.roll(np.roll(out, dy, 0), dx, 1) * m[..., None]; cnt += m
    grow = (cnt > 0) & ~used & ~changed
    out[grow] = acc[grow] / cnt[grow][:, None]
    changed |= grow
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{D}/{V}_A.png')
Image.fromarray(np.clip(nout, 0, 255).astype(np.uint8)).save(f'{D}/{V}_N.png')
print('ok', V, skin_ref)
