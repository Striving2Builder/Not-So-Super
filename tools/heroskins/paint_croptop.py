"""The crop-top Supergirl's atlases (Act 2's default costume), dev only:
    uv run --no-project --with numpy,pillow,scipy python tools/heroskins/paint_croptop.py
Inputs: shots/supergirl/work/sg_A.png, sg_N.png (the comic atlas packed in assets/models/supergirl.glb) and
SG_DCU_A.png, SG_DCU_N.png (the original's, = supergirl_real.glb's), the texel maps baked by
sg_blender.prep() into shots/supergirl/hswork/ (croptop_blender.py prep_croptop() writes all of them).
Output (shots/heroskins/work/):
  croptop_A/N.png       comic (from supergirl.glb's painted atlas: her comic face, hair swatch, boots kept)
  croptop_real_A/N.png  realistic (from the original's atlas, keeping its shading)
  croptop_cuffs.json    each wrist's cuff band (arm axis, wrist t), for the cuff bulge in croptop_blender.py
The look (docs/references/user/act2-croptop-sg.jpg): a glossy light-blue long-sleeve crop top ending under
the bust (the S kept), bare midriff with a navel, a yellow waistband whose lower and upper edges dip to a
V at the front, a glossy red mini skirt, wide silver cuffs at the wrists, the same red boots.
Image px, rows top-down. Mesh-local space (posmap): y up, +z front, +x = her left."""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, '..', '..', 'shots')
SRC, BAKE = os.path.join(SH, 'supergirl', 'work'), os.path.join(SH, 'supergirl', 'hswork')
OUT = os.path.join(SH, 'heroskins', 'work')
os.makedirs(OUT, exist_ok=True)
P = np.nan_to_num(np.load(os.path.join(BAKE, 'posmap.npy'))[::-1])  # (NaN off the islands)
NRM = np.nan_to_num(np.load(os.path.join(BAKE, 'normmap.npy'))[::-1])
I = np.load(os.path.join(BAKE, 'islmap.npy'))[::-1]
CARDS = np.load(os.path.join(BAKE, 'cards.npy'))
H, W = I.shape
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
used = I >= 0
FLATN = np.array([128, 128, 255], np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

ARMS, SKIRT, THIGHS, CAPE = (53, 54), (382, 387), (393, 394), (395, 396, 397, 398)
HEAD, SHIELD = (388, 390), (417, 385, 414, 415)
HEM = 1.215          # the top's hem (the bust apex is y 1.29)
BAND = (1.152, 1.088)  # the waistband's top / bottom edge at her sides (over the belt ridge)
VDIP, VW = 0.07, 0.15  # how far both edges dip at the front centre, and the V's half width (x)
CUFF = 0.07          # cuff width along the forearm (m)

C = dict(  # comic / realistic
    top=((118, 176, 232), (112, 164, 214)), hemc=((70, 124, 190), (74, 116, 168)),
    skirt=((214, 22, 32), (190, 24, 30)), yellow=((250, 206, 40), (236, 190, 52)),
    silver=((184, 192, 204), (170, 176, 186)), sdark=((92, 98, 112), (86, 90, 100)))


def isl(*ids): return np.isin(I, ids)
def dilate(m, r=1):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127
def mix(out, a, col):
    a = np.clip(a, 0, 1)[..., None]
    out[...] = out * (1 - a) + np.asarray(col, np.float32) * a


def gloss(out, m, hi, k=0.84, edge=0.05, L=(0.35, 0.55, 0.76), amt=0.75):
    """painted latex / patent highlight where the surface faces a fixed key light (the toon shader ignores roughness)"""
    L = np.asarray(L, np.float32); L /= np.linalg.norm(L)
    n = np.nan_to_num(NRM); n /= np.maximum(1e-6, np.linalg.norm(n, axis=-1, keepdims=True))
    d = n @ L
    hard = np.clip((d - k) / edge, 0, 1)
    mix(out, hard * m * amt, hi)
    mix(out, np.clip((d - (k - 0.25)) / edge, 0, 1) * m * (1 - hard) * 0.16, hi)


def regions(A):
    """masks from mesh space (+ the source colours for the arm's hand)"""
    body = used & ~isl(*ARMS, *HEAD, *CAPE, *CARDS) & (np.abs(X) < 0.26)
    front = np.clip((Z - 0.02) / 0.06, 0, 1)  # the V is on her front only
    v = np.clip(1 - np.abs(X) / VW, 0, 1) * front
    yt, yb = BAND[0] - VDIP * v, BAND[1] - VDIP * v
    torso = body & (Y < HEM) & (Y > 0.6) & ~isl(*THIGHS)
    skin = torso & (Y > yt) & ~isl(*SKIRT)
    band = torso & (Y <= yt) & (Y > yb)
    skirt = torso & (Y <= yb) & (isl(*SKIRT) | (Y > 0.95))
    hem = body & (Y >= HEM) & (Y < HEM + 0.012) & ~isl(*SHIELD)
    top = used & ((body & (Y >= HEM)) | isl(*ARMS)) & (A[..., 2] > A[..., 0] + 10) & ~isl(*SHIELD)
    hands = used & isl(9, 10, 12) & (A[..., 0] > A[..., 2] + 25) & (A[..., 0] > 120)
    return dict(skin=skin, band=band, skirt=skirt, hem=hem, top=top, hands=hands)


def cuffs(R):
    """per side: the arm's axis (PCA of its texels), the wrist = the sleeve island's far end (the hands
    are islands of their own); cuff = the sleeve's last CUFF metres. Also written out for the Blender bulge."""
    m = np.zeros((H, W), bool); info = {}
    for side, isle in (('L', 53), ('R', 54)):
        a = isl(isle) & used
        p = P[a]; o = p.mean(0); ax = np.linalg.svd(p - o, full_matrices=False)[2][0]
        if ax[0] * (1 if side == 'L' else -1) < 0: ax = -ax  # pointing out to the hand
        # (the left sleeve shares the right one's texels: island 53 is a sliver, its numbers are for show)
        t = (P - o) @ ax
        tw = float(np.percentile(t[a], 99.7))
        m |= a & (t > tw - CUFF)
        info[side] = dict(o=o.tolist(), ax=ax.tolist(), tw=tw, w=CUFF)
    json.dump(info, open(os.path.join(OUT, 'croptop_cuffs.json'), 'w'), indent=1)
    return m, info


def navel_px():
    m = used & (Z > 0.1) & (np.abs(X) < 0.02) & (np.abs(Y - 1.135) < 0.008) & ~isl(*ARMS, *CARDS)
    ys, xs = np.nonzero(m)
    return (xs.mean(), ys.mean()) if len(xs) else None


def bleed(out, A):
    """grow painted islands 3 px into the gutters so filtering / mips never pick up the old colours"""
    changed = np.any(np.abs(out - A) > 1, -1) & used
    for _ in range(3):
        acc = np.zeros_like(out); cnt = np.zeros((H, W), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            m = np.roll(np.roll(changed, dy, 0), dx, 1)
            acc += np.roll(np.roll(out, dy, 0), dx, 1) * m[..., None]; cnt += m
        grow = (cnt > 0) & ~used & ~changed
        out[grow] = acc[grow] / cnt[grow][:, None]
        changed |= grow


def paint(a_name, n_name, out_name, k):
    A = np.asarray(Image.open(os.path.join(SRC, a_name)).convert('RGB')).astype(np.float32)
    NM = np.asarray(Image.open(os.path.join(SRC, n_name)).convert('RGB')).astype(np.float32)
    out, nout = A.copy(), NM.copy()
    lum = A @ np.array([0.299, 0.587, 0.114], np.float32)
    R = regions(A)
    cuff, _ = cuffs(R)
    keep = 0.3 if k == 0 else 0.65  # how much of the source's shading survives

    def recolor(m, target, keep=keep, flatten=0.0):
        if not m.any(): return
        lb = gaussian_filter(np.where(m, lum, np.median(lum[m])).astype(np.float32), 8)
        rel = 1 + (np.clip(lb[m] / max(1, np.median(lum[m])), 0.5, 1.6) - 1) * keep
        fine = 1 + (np.clip(lum[m] / np.maximum(1, lb[m]), 0.6, 1.4) - 1) * keep
        out[m] = np.asarray(target, np.float32) * (rel * fine)[:, None]
        if flatten: nout[m] = nout[m] * (1 - flatten) + FLATN * flatten

    # skin tone: her own (the hands' median), a touch lighter on the belly
    tone = np.median(A[R['hands']], 0) * (1.04 if k == 0 else 1.0)
    recolor(R['top'] & ~cuff, C['top'][k], flatten=0.3 if k == 0 else 0)
    recolor(R['hem'], C['hemc'][k])
    sk = R['skin']
    ao = np.clip(gaussian_filter(np.where(sk, lum, np.median(lum[sk])), 6) / max(1, np.median(lum[sk])), 0.85, 1.1)
    out[sk] = tone * (0.93 + 0.07 * (ao[sk] if k else np.ones(int(sk.sum()))))[:, None]; nout[sk] = FLATN
    # a soft shadow under the hem and above the waistband, the navel
    top_edge = R['skin'] & (Y > HEM - 0.025)
    mix(out, top_edge * np.clip((Y - (HEM - 0.025)) / 0.025, 0, 1) * 0.35, tone * 0.62)
    nv = navel_px()
    if nv:
        mix(out, np.exp(-(((xx - nv[0]) / 2.4) ** 2 + ((yy - nv[1]) / 3.4) ** 2)) * 0.75 * sk, tone * 0.45)
    recolor(R['skirt'], C['skirt'][k], flatten=0.4 if k == 0 else 0)
    recolor(R['band'], C['yellow'][k], keep=keep * 0.6, flatten=0.5)
    out[cuff] = np.asarray(C['silver'][k], np.float32); nout[cuff] = FLATN
    # ink / shade lines round the waistband and both cuff rims
    for m, col in ((R['band'], (120, 70, 10)), (cuff, C['sdark'][k])):
        rim = m & dilate(~m & used, 1)
        out[rim] = out[rim] * 0.35 + np.asarray(col, np.float32) * 0.65
    gloss(out, R['top'] & ~cuff, (236, 246, 255), k=0.82, edge=0.04, amt=0.7 if k == 0 else 0.4)
    gloss(out, R['skirt'], (255, 170, 160), k=0.8, edge=0.04, amt=0.75 if k == 0 else 0.45)
    gloss(out, R['band'], (255, 250, 210), k=0.84, edge=0.05, amt=0.6)
    gloss(out, cuff, (255, 255, 255), k=0.7, edge=0.08, amt=0.9)
    mix(out, cuff * np.clip((0.3 - (np.nan_to_num(NRM) @ np.array([0.35, 0.55, 0.76]))) / 0.3, 0, 1) * 0.5, C['sdark'][k])
    bad = ~np.isfinite(out).all(-1)
    if bad.any(): print('non-finite px', int(bad.sum()), np.unique(I[bad])[:10])
    bleed(out, A)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, out_name + '_A.png'))
    Image.fromarray(np.clip(nout, 0, 255).astype(np.uint8)).save(os.path.join(OUT, out_name + '_N.png'))
    return {n: int(m.sum()) for n, m in R.items()} | dict(cuff=int(cuff.sum()), navel=nv)


print('comic', paint('sg_A.png', 'sg_N.png', 'croptop', 0))
print('real', paint('SG_DCU_A.png', 'SG_DCU_N.png', 'croptop_real', 1))
