"""Move shipped hero models from the v1 bust to today's (bust.py), straight in the GLB, no Blender:
    python tools/heroskins/bust_glb.py assets/models/supergirl.glb [more.glb ...]
Only POSITION / NORMAL (and POSITION's min / max) change; every other byte (skin, UVs, textures, node and
material names) stays as it was. Blender's mesh coordinates (bust.py's space) are the GLB's divided by
the Armature node's scale. Normals go through the same Jacobian as bust.py's, arms masked by skin weight
the same way. A file is stamped asset.extras.bust = 'v2' and skipped if run twice.
"""
import json, os, struct, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_ns = {'__name__': 'bust'}
exec(open(os.path.join(HERE, 'bust.py')).read(), _ns)
field, unbust_v1, BUST, ARM_BONES = _ns['field'], _ns['unbust_v1'], _ns['BUST'], _ns['ARM_BONES']
STAMP = 'v2'


def _read(path):
    b = open(path, 'rb').read()
    n0 = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + n0])
    n1 = struct.unpack_from('<I', b, 20 + n0)[0]
    return j, bytearray(b[28 + n0:28 + n0 + n1])


def _write(path, j, bin_):
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    bin_ += b'\0' * (-len(bin_) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
    open(path, 'wb').write(out)


def _view(j, bin_, acc, dtype, ncomp):
    a = j['accessors'][acc]; bv = j['bufferViews'][a['bufferView']]
    assert not bv.get('byteStride') or bv['byteStride'] == np.dtype(dtype).itemsize * ncomp
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(bin_, dtype, a['count'] * ncomp, off).reshape(-1, ncomp), off


def _is_arm(name):
    return name.replace('mixamorig:', '').replace('Left', '').replace('Right', '').startswith(ARM_BONES)


def migrate(path, k=BUST):
    j, bin_ = _read(path)
    extras = j['asset'].setdefault('extras', {})
    if extras.get('bust') == STAMP: return path, 'already ' + STAMP
    s = next(n for n in j['nodes'] if n.get('name') == 'Armature').get('scale', [1, 1, 1])[0]
    moved = 0.0
    for node in j['nodes']:
        if 'mesh' not in node or 'skin' not in node: continue
        joints = j['skins'][node['skin']]['joints']
        arm = np.array([_is_arm(j['nodes'][n].get('name', '')) for n in joints])
        for pr in j['meshes'][node['mesh']]['primitives']:
            at = pr['attributes']
            P, poff = _view(j, bin_, at['POSITION'], '<f4', 3)
            N, noff = _view(j, bin_, at['NORMAL'], '<f4', 3)
            assert j['accessors'][at['JOINTS_0']]['componentType'] == 5121
            Jn, _ = _view(j, bin_, at['JOINTS_0'], 'u1', 4)
            W, _ = _view(j, bin_, at['WEIGHTS_0'], '<f4', 4)
            m = 1 - (W * arm[Jn]).sum(1) / np.maximum(1e-9, W.sum(1))
            Pb = P.astype(np.float64) / s

            def disp(Q):
                Q0 = unbust_v1(Q)
                return Q0 + field(Q0, k) - Q
            D = disp(Pb) * m[:, None]
            h = 1e-4; Jac = np.zeros((len(Pb), 3, 3))
            for c in range(3):
                e = np.zeros(3); e[c] = h
                Jac[:, :, c] = (disp(Pb + e) - disp(Pb - e)) / (2 * h)
            M = np.eye(3)[None] + Jac * m[:, None, None]
            N2 = np.linalg.solve(np.transpose(M, (0, 2, 1)), N.astype(np.float64)[..., None])[..., 0]
            N2 /= np.maximum(1e-9, np.linalg.norm(N2, axis=1, keepdims=True))
            P2 = ((Pb + D) * s).astype('<f4')
            bin_[poff:poff + P2.nbytes] = P2.tobytes()
            bin_[noff:noff + N2.size * 4] = N2.astype('<f4').tobytes()
            a = j['accessors'][at['POSITION']]
            a['min'] = P2.min(0).tolist(); a['max'] = P2.max(0).tolist()
            moved = max(moved, float(np.abs(D).max() * s))
    extras['bust'] = STAMP
    _write(path, j, bin_)
    return path, f'moved up to {moved * 100:.1f} cm'


if __name__ == '__main__':
    for p in sys.argv[1:]: print(*migrate(p))
