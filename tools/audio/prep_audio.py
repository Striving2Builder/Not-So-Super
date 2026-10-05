"""Turn the raw SFX library (assets/audio/<category>/) into the game-ready files the game loads
(assets/audio/game/). Re-run after changing a recipe below:  python tools/audio/prep_audio.py

One-shots -> mono MP3: leading silence trimmed, cut where the sound dies away (ignoring the stray
clicks some ElevenLabs clips end with), short fades, peak-normalised to -1 dBFS. Mix levels live
in src/sfx.js, so every file here peaks at the same level.

Loops -> mono 16-bit WAV (MP3 adds encoder padding, which clicks at every loop seam): a segment
whose tail is crossfaded into its head, so it repeats seamlessly; RMS-normalised to -20 dBFS.
Needs numpy and ffmpeg on PATH.
"""
import os, subprocess, sys
import numpy as np

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LIB = os.path.join(ROOT, 'assets', 'audio')
OUT = os.path.join(LIB, 'game')
SR = 44100

# name: (library file, options). start/end in seconds (end=None: auto), fade = fade-out seconds,
# ramp = gain at the start rising linearly to 1 at the end (a crescendo).
ONESHOTS = {
    'click':   ('ui/click.mp3', {}),
    'pickup':  ('ui/clue-found.mp3', {}),
    'xray':    ('ui/scan.mp3', {}),
    'paper':   ('ui/page-flip.mp3', {}),
    'heat':    ('powers/heat-blast.mp3', {'fade': 0.25}),
    'breath':  ('powers/frost-breath.mp3', {'fade': 0.3}),
    'boost':   ('flight/boost-rush.mp3', {'end': 1.8, 'fade': 0.8}),
    'whoosh':  ('flight/whoosh-sharp.mp3', {}),
    'dive':    ('flight/dive-swell.mp3', {'start': 1.5, 'end': 2.75, 'fade': 0.08, 'fadein': 0.06, 'ramp': 0.45}),
    'thud':    ('impacts/bass-thud.mp3', {'fade': 0.2}),
    'alarm':   ('tension/alarm-loop.mp3', {'fade': 0.05}),
    'trap':    ('tension/braam-eerie.mp3', {'fade': 0.6}),
    'radio1':  ('ambience/police-radios-b.mp3', {'start': 0.15, 'end': 4.6, 'fade': 0.4, 'fadein': 0.1}),
    'radio2':  ('ambience/police-radios-c.mp3', {'start': 0.9, 'end': 7.4, 'fade': 0.5, 'fadein': 0.15}),
}

# name: (library file, start, end, crossfade seconds, sample rate)
LOOPS = {
    'wind-cruise': ('flight/wind-cruise-loop.mp3', 0.0, 5.0, 0.8, 22050),
    'wind-fast':   ('flight/wind-fast-loop.mp3', 1.2, 11.4, 1.2, 22050),
    'crime-scene': ('ambience/crime-scene.mp3', 0.4, 15.0, 2.0, 22050),
    'drone':       ('tension/sub-drone-loop.mp3', 0.0, 4.9, 1.0, 22050),
    'street':      ('ambience/city-street-loop.mp3', 0.0, 7.6, 1.0, 22050),
}


def decode(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def envelope_db(x, sr, win=0.01):
    n = max(1, int(sr * win))
    frames = len(x) // n
    e = np.sqrt((x[:frames * n].reshape(frames, n) ** 2).mean(1))
    return 20 * np.log10(e + 1e-9), n


def auto_bounds(x, sr, floor=45, quiet=0.15):
    """First sample above (peak - floor) dB; end = the first point after the peak that stays below
    it for `quiet` seconds (so a click after a silent gap is dropped)."""
    env, n = envelope_db(x, sr)
    thr = env.max() - floor
    loud = np.where(env > thr)[0]
    start = loud[0]
    run, need, end = 0, int(quiet / 0.01), len(env)
    for i in range(int(np.argmax(env)), len(env)):
        run = run + 1 if env[i] <= thr else 0
        if run >= need: end = i - need + 1; break
    return max(0, start * n - int(0.005 * sr)), min(len(x), end * n)


def encode(y, sr, path, fmt):
    args = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-']
    args += ['-c:a', 'libmp3lame', '-b:a', '112k'] if fmt == 'mp3' else ['-c:a', 'pcm_s16le']
    subprocess.run(args + [path], input=y.astype(np.float32).tobytes(), check=True)


def oneshot(name, src, o):
    x = decode(os.path.join(LIB, src), SR)
    a, b = auto_bounds(x, SR)
    if 'start' in o: a = int(o['start'] * SR)
    if o.get('end'): b = int(o['end'] * SR)
    y = x[a:b].copy()
    if 'ramp' in o: y *= np.linspace(o['ramp'], 1, len(y))
    fi = int(o.get('fadein', 0.003) * SR); y[:fi] *= np.linspace(0, 1, fi)
    fo = int(o.get('fade', 0.04) * SR); y[-fo:] *= np.linspace(1, 0, fo) ** 2
    y *= 10 ** (-1 / 20) / np.abs(y).max()
    path = os.path.join(OUT, name + '.mp3')
    encode(y, SR, path, 'mp3')
    return f'{name:12s} {len(y) / SR:5.2f}s  {os.path.getsize(path) // 1024:4d} KB  <- {src}'


def loop(name, src, t0, t1, xf, sr):
    x = decode(os.path.join(LIB, src), sr)
    seg = x[int(t0 * sr):int(t1 * sr)].copy()
    n = int(xf * sr)
    k = np.linspace(0, np.pi / 2, n)
    # equal-power: the head fades in under the tail that is cut off, so end -> start is continuous
    seg[:n] = seg[:n] * np.sin(k) + seg[-n:] * np.cos(k)
    y = seg[:-n]
    rms = np.sqrt((y ** 2).mean())
    y *= min(10 ** (-20 / 20) / rms, 10 ** (-1 / 20) / np.abs(y).max())
    path = os.path.join(OUT, name + '.wav')
    encode(y, sr, path, 'wav')
    # seam check: the jump across end -> start vs typical sample-to-sample steps
    d = np.abs(np.diff(y)); seam = abs(y[0] - y[-1]) / (np.percentile(d, 99) + 1e-9)
    return f'{name:12s} {len(y) / sr:5.2f}s  {os.path.getsize(path) // 1024:4d} KB  seam {seam:.2f}x p99 step  <- {src}'


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    for name, (src, o) in ONESHOTS.items():
        if not only or name in only: print(oneshot(name, src, o))
    for name, (src, *args) in LOOPS.items():
        if not only or name in only: print(loop(name, src, *args))
