"""Supergirl_Dark atlases from the original Supergirl atlas, dev only:
    uv run --no-project --with numpy,pillow,scipy python tools/heroskins/paint_dark.py
Inputs: shots/supergirl/work/SG_DCU_A.png, SG_DCU_N.png (the original model's atlas) and the texel maps
baked by sg_blender.prep() into shots/supergirl/hswork/. Output (shots/heroskins/work/):
  dark_A/N.png       comic: flat colour blocking, inked distressed face, messy lock swatch for the hair shell
  dark_real_A/N.png  realistic: recoloured keeping the source's shading, smudged mascara and tear tracks
The look: sky-blue long-sleeve suit, crimson/gold shield, maroon skirt and cape, brass belt, bare thighs,
glossy maroon knee boots with a gold V trim, long messy dirty-blonde hair, red-rimmed teary eyes.
Image px, rows top-down. The face sits upright in the atlas: eyes y~103, mouth y~173, centre line x~165.
Mesh-local space (posmap): y up, +z front, +x = her left."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

HERE = os.path.dirname(os.path.abspath(__file__))
SH = os.path.join(HERE, '..', '..', 'shots')
SRC, BAKE = os.path.join(SH, 'supergirl', 'work'), os.path.join(SH, 'supergirl', 'hswork')
OUT = os.path.join(SH, 'heroskins', 'work')
os.makedirs(OUT, exist_ok=True)
A = np.asarray(Image.open(os.path.join(SRC, 'SG_DCU_A.png')).convert('RGB')).astype(np.float32)
NM = np.asarray(Image.open(os.path.join(SRC, 'SG_DCU_N.png')).convert('RGB')).astype(np.float32)
P = np.load(os.path.join(BAKE, 'posmap.npy'))[::-1]
NRM = np.load(os.path.join(BAKE, 'normmap.npy'))[::-1]
I = np.load(os.path.join(BAKE, 'islmap.npy'))[::-1]
H, W = I.shape
X, Y, Z = P[..., 0], P[..., 1], P[..., 2]
used = I >= 0
lum = A @ np.array([0.299, 0.587, 0.114], np.float32)
FLATN = np.array([128, 128, 255], np.float32)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

ARMS, SKIRT, BOOTS, THIGHS = (53, 54), (382, 387), (209, 389), (393, 394)
HEAD, SHIELD = (388, 390), (417, 385, 414, 415)
EYES = ((125, 103, -1), (205, 103, 1))  # eye openings: centre, and which way is her outer corner
EYEBALLS = ((771, 52), (867, 52))
MOUTH = (165, 173)
SW = (100, 600, 590, 1010)  # the hair shell's lock swatch (sg_blender.SG_SW)

C = dict(  # comic / realistic palettes
    suit=((58, 124, 206), (66, 128, 204)), crimson=((178, 22, 36), (168, 26, 38)),
    maroon=((122, 16, 28), (116, 20, 30)), boot=((104, 14, 24), (96, 16, 24)),
    brass=((212, 162, 46), (196, 150, 54)), sgold=((242, 194, 50), (226, 180, 60)),
    skin=((234, 172, 134), (196, 136, 104)), hair=((222, 176, 98), (204, 160, 92)),
    root=((126, 86, 40), (98, 66, 34)))


def isl(*ids): return np.isin(I, ids)
def rect(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = True; return m
def dilate(m, r=1):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))) > 127
def blob(cx, cy, rx, ry): return np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2))
def mix(out, a, col):
    """alpha-blend a colour in (a: HxW in 0..1)"""
    a = np.clip(a, 0, 1)[..., None]
    out[...] = out * (1 - a) + np.asarray(col, np.float32) * a


# ---- masks from the source colours (as paint_sg.py)
hue_r = A[..., 0] > A[..., 2] * 1.4
mouth_px = rect(915, 0, 1024, 115)  # teeth / mouth interior: left alone
blue = (A[..., 2] > A[..., 0] + 10) & used & ~isl(*HEAD)
red = used & hue_r & (A[..., 0] > 90) & (A[..., 1] < A[..., 0] * 0.55) & ~isl(*HEAD) & ~mouth_px & ~isl(*ARMS)
gold = (used & (A[..., 0] > 120) & (A[..., 1] > A[..., 0] * 0.55) & (A[..., 2] < A[..., 1] * 0.75)
        & (A[..., 0] - A[..., 2] > 70) & ~isl(*HEAD) & ~isl(*ARMS) & ~mouth_px & (Y > 0.3))
face_skin = used & isl(*HEAD) & (A[..., 0] > A[..., 2] + 12)
hands = used & isl(*ARMS) & (A[..., 0] > A[..., 2] + 25) & (A[..., 0] > 140)
scalp = used & isl(*HEAD) & (lum < 120) & (A[..., 0] >= A[..., 2]) & ((Y > 1.64) | ((Z < 0.10) & (Y > 1.52)))
cheek_hair = used & isl(*HEAD) & (lum < 130) & (A[..., 0] >= A[..., 2]) & ~scalp & (Z > 0.05) & (Y < 1.66) & (Y > 1.48)
strip = rect(0, 835, 92, 1024)  # the hair cards' strand strip
shield = isl(*SHIELD)


def knee_boots():
    """the boot shell above a V-notched top edge (and the thigh-boot trims) becomes bare leg"""
    m = isl(*BOOTS)
    cx = np.where(X > 0, 0.13, -0.13)
    top = 0.475 - 0.05 * np.clip(1 - np.abs(np.arctan2(X - cx, Z - 0.075)) / 0.55, 0, 1)
    leg = (m & (Y > top)) | isl(410, 411) | (rect(760, 900, 885, 1024) & (Y > 0.4)) | isl(*THIGHS)
    return m & ~leg & used, leg & used


def gloss(out, m, hi, k=0.84, edge=0.05, L=(0.35, 0.55, 0.76), amt=0.75):
    """painted patent-leather highlight where the surface faces a fixed key light"""
    L = np.asarray(L, np.float32); L /= np.linalg.norm(L)
    n = np.nan_to_num(NRM); n /= np.maximum(1e-6, np.linalg.norm(n, axis=-1, keepdims=True))
    d = n @ L
    mix(out, np.clip((d - k) / edge, 0, 1) * m * amt, hi)
    mix(out, np.clip((d - (k - 0.25)) / edge, 0, 1) * m * (1 - np.clip((d - k) / edge, 0, 1)) * 0.16, hi)


def bleed(out, nout):
    """grow painted islands 3 px into the gutters so filtering/mips never pick up the old colours"""
    changed = np.any(np.abs(out - A) > 1, -1) & used
    for _ in range(3):
        acc = np.zeros_like(out); cnt = np.zeros((H, W), np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            m = np.roll(np.roll(changed, dy, 0), dx, 1)
            acc += np.roll(np.roll(out, dy, 0), dx, 1) * m[..., None]; cnt += m
        grow = (cnt > 0) & ~used & ~changed
        out[grow] = acc[grow] / cnt[grow][:, None]
        changed |= grow


def save(out, nout, name):
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + '_A.png'))
    Image.fromarray(np.clip(nout, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + '_N.png'))


def streaks(S=4, wob=1.0):
    """tear / mascara tracks running down from each lower lid: (centre lines, widths) in image px"""
    rng = np.random.default_rng(11)
    lines = []
    for cx, cy, o in EYES:
        for x0, y0, length, drift, w in ((cx + 1 * o, cy + 7, 40, 4, 1.7), (cx + 13 * o, cy + 5, 31, 7, 1.3),
                                         (cx - 7 * o, cy + 7, 18, 1, 1.0)):
            pts = []
            for i in range(13):
                t = i / 12
                pts.append((x0 + drift * o * t + wob * 1.3 * np.sin(t * 7 + rng.random() * 0.6), y0 + length * t))
            lines.append((pts, w))
    return lines


# ======================================================================= comic
def comic():
    out, nout = A.copy(), NM.copy()

    def block(m, target, keep=0.35, detail=0.55, flatten=0.5):
        """flat comic colour keeping the source's small detail (seams, panel lines) and a little of its form"""
        if not m.any(): return
        lb = gaussian_filter(np.where(m, lum, np.median(lum[m])).astype(np.float32), 12)
        med = max(1, np.median(lum[m]))
        broad = 1 + (np.clip(lb[m] / med, 0.5, 1.6) - 1) * keep
        fine = 1 + (np.clip(lum[m] / np.maximum(1, lb[m]), 0.55, 1.4) - 1) * detail
        out[m] = np.asarray(target, np.float32) * (broad * fine)[:, None]
        if flatten: nout[m] = nout[m] * (1 - flatten) + FLATN * flatten

    def skin(m, keep):
        if not m.any(): return
        tone = np.asarray(C['skin'][0], np.float32)
        med = np.median(lum[m])
        broad = gaussian_filter(np.where(m, lum, med).astype(np.float32), 10)
        fine = np.clip(lum / np.maximum(1, gaussian_filter(np.where(m, lum, med).astype(np.float32), 2.5)), 0.6, 1.3)
        k = (0.9 + 0.1 * np.clip(broad / med, 0.7, 1.2)) * (1 + (fine - 1) * keep)
        out[m] = tone * k[m][:, None]; nout[m] = FLATN

    block(blue & ~shield, C['suit'][0], keep=0.3, detail=0.7, flatten=0.4)
    block(red & ~shield, C['maroon'][0], keep=0.3, detail=0.25, flatten=0.3)
    block(red & shield, C['crimson'][0], keep=0.3, detail=0.25, flatten=0.3)
    block(gold & ~shield, C['brass'][0], keep=0.3, detail=0.5, flatten=0.3)
    block(gold & shield, C['sgold'][0], keep=0.25, detail=0.4, flatten=0.3)
    plate = isl(413) & used
    out[plate] = np.asarray(C['suit'][0], np.float32) * 0.9; nout[plate] = FLATN
    skin(face_skin, 0.25); skin(hands, 0.35)
    boot, leg = knee_boots()
    out[leg] = np.asarray(C['skin'][0], np.float32) * (0.96 + 0.04 * np.clip(Y[leg] / 1.0, 0, 1))[:, None]
    nout[leg] = FLATN
    block(boot, C['boot'][0], keep=0.35, detail=0.3, flatten=0.4)
    gloss(out, boot, (236, 120, 132), k=0.8, edge=0.04)
    trim = boot & dilate(leg, 2)
    out[trim] = np.asarray(C['brass'][0], np.float32)
    out[boot & dilate(leg, 3) & ~trim] = np.asarray((60, 6, 14), np.float32)  # ink under the trim
    # skirt: a darker hem fold so the maroon pleats read
    gloss(out, isl(*SKIRT) & red, (196, 70, 84), k=0.86, amt=0.45)

    # face: flushed, teary, frightened
    mix(out, (blob(112, 141, 17, 11) + blob(220, 141, 17, 11)) * 0.42 * face_skin, (230, 96, 92))
    mix(out, blob(166, 149, 8, 6) * 0.3 * face_skin, (226, 104, 98))
    for cx, cy, o in EYES:  # smudged mascara under each eye
        mix(out, blob(cx + 2 * o, cy + 10, 15, 5.5) * 0.42 * face_skin, (88, 58, 74))
    out[scalp] = np.asarray((176, 124, 56), np.float32)
    out[cheek_hair] = np.asarray(C['skin'][0], np.float32)
    out[strip] = np.asarray(C['hair'][0], np.float32)

    # hair shell swatch: more, wilder locks than supergirl.glb's, dark roots, stray frizz strokes
    x0, y0, x1, y1 = SW
    w, h = x1 - x0, y1 - y0
    rng = np.random.default_rng(5)
    uu, vv = np.meshgrid((np.arange(w) + 0.5) / w, (np.arange(h) + 0.5) / h)
    NL = 14; lock_px = w / NL
    # wavy down each lock; d(wave)/du stays < 1 or the lock boundaries fold into closed loops
    wave = 0.022 * np.sin(vv * 9 + uu * 14) + 0.012 * np.sin(vv * 17 - uu * 19) + 0.006 * np.sin(vv * 31 + uu * 7)
    q = (uu + wave) * NL; li = np.floor(q).astype(int) % NL; p = q - np.floor(q)
    base, shade, hi = np.asarray(C['hair'][0], np.float32), np.array([150, 100, 44], np.float32), np.array([250, 232, 160], np.float32)
    rnd = np.sin(np.pi * p) ** 0.6
    sw = shade * (1 - rnd[..., None]) + base * rnd[..., None]
    root = np.clip(1 - vv / 0.2, 0, 1) ** 1.5 * 0.75
    sw = sw * (1 - root[..., None]) + np.asarray(C['root'][0], np.float32) * root[..., None]
    sh_v = 0.36 + 0.03 * np.sin(li * 2.1) - 0.05 * p
    sh_a = np.clip((0.026 * np.sin(np.pi * np.clip(p * 1.1 - 0.05, 0, 1)) - np.abs(vv - sh_v)) * h, 0, 1) * 0.8
    sw = sw * (1 - sh_a[..., None]) + hi * sh_a[..., None]
    INKC = np.array([34, 26, 40], np.float32)

    def stroke(dist_px, start, end, wmax):
        t = np.clip((vv - start) / 0.12, 0, 1) * np.clip((end - vv) / 0.05, 0, 1)
        return np.clip(wmax * t - dist_px + 0.5, 0, 1) * (vv > start) * (vv < end)
    on = rng.random(NL) < 0.9; st = 0.05 + rng.random(NL) * 0.2
    db = np.minimum(p, 1 - p) * lock_px; bi = np.where(p < 0.5, li, (li + 1) % NL)
    a1 = stroke(db, st[bi], 1.02, 2.0) * on[bi]
    on2 = rng.random(NL) < 0.6; st2 = 0.5 + rng.random(NL) * 0.2
    dm = np.abs(p - (0.45 + 0.1 * np.sin(li * 1.7))) * lock_px
    a2 = stroke(dm, st2[li], 1.02, 1.4) * on2[li]
    al = np.maximum(a1, a2) * np.clip((np.minimum(uu, 1 - uu) - 0.03) / 0.03, 0, 1)
    sw = sw * (1 - al[..., None]) + INKC * al[..., None]
    sim = Image.fromarray(np.clip(sw, 0, 255).astype(np.uint8)); ds = ImageDraw.Draw(sim)
    for _ in range(36):  # frizz: short wavy strays toward the tips
        sx, sy = rng.random() * w, h * (0.55 + rng.random() * 0.42)
        ds.line([(sx + 3 * np.sin(k * 1.3), sy + k * 6) for k in range(6)], fill=(96, 64, 40), width=1)
    out[y0:y1, x0:x1] = np.asarray(sim).astype(np.float32); nout[y0:y1, x0:x1] = FLATN

    # face ink (4x, then down: anti-aliased)
    S = 4
    ov = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    def poly(pts, col): d.polygon([(x * S, y * S) for x, y in pts], fill=col)
    def line(pts, col, w): d.line([(x * S, y * S) for x, y in pts], fill=col, width=max(1, int(w * S)), joint='curve')
    INK = (34, 20, 22, 255)
    for cx, cy, o in EYES:
        # wide eyes: a higher lash arc, a full red-rimmed lower lid
        a = [(cx - 19 * o, cy + 1), (cx - 10 * o, cy - 5.5), (cx, cy - 7), (cx + 10 * o, cy - 6), (cx + 19 * o, cy - 2), (cx + 23 * o, cy - 5)]
        line(a[:5], INK, 2.4); line(a[3:], INK, 2.8)
        line([(cx - 15 * o, cy + 5), (cx - 4 * o, cy + 7.5), (cx + 8 * o, cy + 7), (cx + 17 * o, cy + 3)], (196, 70, 74, 230), 1.6)
        line([(cx - 13 * o, cy + 6.5), (cx, cy + 8.5), (cx + 13 * o, cy + 5.5)], (70, 40, 50, 150), 1.0)
        # worried brows: the inner ends pulled up
        poly([(cx - 21 * o, cy - 23), (cx - 9 * o, cy - 27.5), (cx + 5 * o, cy - 25), (cx + 21 * o, cy - 17),
              (cx + 6 * o, cy - 21.5), (cx - 8 * o, cy - 23.5), (cx - 20 * o, cy - 19.5)], (112, 64, 30, 245))
        line([(cx - 17 * o, cy - 30), (cx - 8 * o, cy - 32.5)], (150, 90, 70, 120), 1.0)  # a strain crease
    for pts, w in streaks():  # mascara tracks with a wet highlight beside them
        line(pts, (58, 36, 52, 215), w)
        line([(x + 1.6, y) for x, y in pts[2:]], (214, 236, 255, 150), 0.8)
    mx, my = MOUTH  # an open, gasping mouth: lips round a dark oval, upper teeth
    d.ellipse([(mx - 15) * S, (my - 8.5) * S, (mx + 15) * S, (my + 9.5) * S], fill=(198, 58, 66, 235))
    d.ellipse([(mx - 10) * S, (my - 5) * S, (mx + 10) * S, (my + 6.5) * S], fill=(58, 12, 20, 255))
    d.chord([(mx - 8) * S, (my - 5) * S, (mx + 8) * S, (my + 2) * S], 180, 360, fill=(240, 236, 228, 255))
    d.ellipse([(mx - 10) * S, (my - 5) * S, (mx + 10) * S, (my + 6.5) * S], outline=(40, 10, 16, 255), width=int(1.2 * S))
    line([(161, 147), (166, 149.5), (171, 147)], (150, 90, 70, 200), 1.3)
    ov = np.asarray(ov.resize((W, H), Image.LANCZOS)).astype(np.float32)
    al = ov[..., 3:4] / 255
    out[...] = out * (1 - al) + ov[..., :3] * al

    ev = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)); d2 = ImageDraw.Draw(ev)
    for cx, cy in EYEBALLS:  # whites shot pink at the rim, small frightened pupils
        d2.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=(240, 206, 208))
        d2.ellipse((cx - 36, cy - 36, cx + 36, cy + 36), fill=(240, 232, 234))
        d2.ellipse((cx - 16, cy - 16, cx + 16, cy + 16), fill=(40, 108, 210))
        d2.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(24, 62, 150))
        d2.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(10, 10, 16))
        d2.ellipse((cx - 12, cy - 12, cx - 6, cy - 6), fill=(255, 255, 255))
    out = np.asarray(ev).astype(np.float32)
    bleed(out, nout)
    save(out, nout, 'dark')


# ================================================================== realistic
def real():
    out, nout = A.copy(), NM.copy()

    def recolor(m, target, keep=0.6):
        """target colour, keeping `keep` of the source's relative shading (panel lines, folds, AO)"""
        if not m.any(): return
        rel = 1 + (np.clip(lum[m] / max(1, np.median(lum[m])), 0.45, 1.7) - 1) * keep
        out[m] = np.asarray(target, np.float32) * rel[:, None]

    recolor(blue & ~shield, C['suit'][1], 0.7)
    recolor(red & ~shield, C['maroon'][1], 0.75)
    recolor(red & shield, C['crimson'][1], 0.65)
    recolor(gold & ~shield, C['brass'][1], 0.65)
    recolor(gold & shield, C['sgold'][1], 0.6)
    boot, leg = knee_boots()
    ao = np.clip(gaussian_filter(lum, 6) / max(1, np.median(lum[leg])), 0.8, 1.12)
    out[leg] = np.asarray(C['skin'][1], np.float32) * (0.9 + 0.1 * ao[leg])[:, None]; nout[leg] = FLATN
    recolor(boot, C['boot'][1], 0.6)
    gloss(out, boot, (200, 140, 150), k=0.82, edge=0.12, amt=0.35)
    trim = boot & dilate(leg, 1)
    out[trim] = np.asarray(C['brass'][1], np.float32) * 0.92

    # hair: the cards' strands and the scalp paint go dirty blonde, darker at the roots
    hs = strip
    l = lum[hs]; t = np.clip((l - np.percentile(l, 5)) / (np.percentile(l, 95) - np.percentile(l, 5) + 1), 0, 1)
    out[hs] = np.asarray(C['root'][1], np.float32) * (1 - t[:, None]) + np.asarray(C['hair'][1], np.float32) * t[:, None]
    out[scalp] = out[scalp] * 0.55 + np.asarray(C['root'][1], np.float32) * 0.45

    # face: flushed cheeks and nose, red-rimmed eyes, smudged mascara, tear tracks
    f = face_skin.astype(np.float32)
    mix(out, (blob(112, 141, 18, 12) + blob(220, 141, 18, 12)) * 0.3 * f, (210, 92, 88))
    mix(out, blob(166, 149, 9, 7) * 0.24 * f, (206, 98, 92))
    for cx, cy, o in EYES:
        mix(out, blob(cx, cy + 2, 23, 11) * 0.22 * f, (196, 86, 88))
        mix(out, blob(cx + 2 * o, cy + 9, 14, 4.5) * 0.4 * f, (70, 50, 58))
    S = 4
    m = Image.new('L', (W * S, H * S), 0); d = ImageDraw.Draw(m)
    for pts, w in streaks(wob=0.6):
        d.line([(x * S, y * S) for x, y in pts], fill=255, width=max(1, int(w * 0.8 * S)), joint='curve')
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(S * 0.8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    mix(out, m * 0.5 * f, (64, 46, 58))
    for cx, cy in EYEBALLS:  # bloodshot: the whites tinted pink toward the rim
        r = np.hypot(xx - cx, yy - cy)
        mix(out, np.clip((r - 22) / 22, 0, 1) * (r < 44) * 0.35, (226, 140, 140))
    bleed(out, nout)
    save(out, nout, 'dark_real')


comic()
real()
print('ok', int(blue.sum()), int(red.sum()), int(gold.sum()), int(face_skin.sum()), int(scalp.sum()))
