// Slims the exported clubs' geometry for phones: meshes far denser than a phone camera 7 m away
// can show (a 78k-triangle sofa, neon tubes with 64 sides) are simplified with meshoptimizer,
// keeping their silhouette within a fraction of a centimetre. Textures, materials and the node
// layout are untouched, so the game's floor bake (<club>.json) stays valid.
//
// Setup once:  npm install --prefix tools
// Usage:       node tools/slim_clubs.js [--dry] [club ...]     (default: every club; both .glb and .lite.glb)
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CLUB_DIR = path.join(ROOT, 'assets/clubs');
const MIN_TRIS = 300;    // lighter meshes aren't worth touching
const ERROR = 0.01;      // allowed deviation, fraction of the mesh's size
const ABS_ERROR = 0.02;  // ... but never more than this many metres (about a pixel at the game camera)

(async () => {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS, KHRDracoMeshCompression } = await import('@gltf-transform/extensions');
  const { weld, simplifyPrimitive, getBounds } = await import('@gltf-transform/functions');
  const { MeshoptSimplifier } = await import('meshoptimizer');
  const draco3d = require('draco3dgltf');
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const clubs = args.filter((a) => !a.startsWith('--'));
  const keys = clubs.length ? clubs : fs.readdirSync(CLUB_DIR).filter((f) => f.endsWith('.glb') && !f.endsWith('.lite.glb')).map((f) => f.slice(0, -4));
  const tris = (p) => (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3;

  for (const key of keys) {
    for (const file of [`${key}.glb`, `${key}.lite.glb`]) {
      const full = path.join(CLUB_DIR, file);
      if (!fs.existsSync(full)) continue;
      const doc = await io.read(full);
      const root = doc.getRoot();
      // world-space size of each mesh (the largest node using it) → an absolute error cap
      const size = new Map();
      for (const node of root.listNodes()) {
        const mesh = node.getMesh();
        if (!mesh) continue;
        const b = getBounds(node);
        const d = Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
        size.set(mesh, Math.max(size.get(mesh) || 0, d));
      }
      await doc.transform(weld()); // the simplifier needs shared vertices to collapse edges
      let before = 0, after = 0;
      const log = [];
      for (const mesh of root.listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          const t0 = tris(prim);
          before += t0;
          if (t0 < MIN_TRIS || prim.getMode() !== 4) { after += t0; continue; }
          const d = size.get(mesh) || 1;
          // meshopt's error is relative to the primitive's own extent (≈ its world size here)
          const err = Math.min(ERROR, ABS_ERROR / Math.max(d, 0.01));
          simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: err, lockBorder: false });
          const t1 = tris(prim);
          after += t1;
          log.push([t0, t1, mesh.getName(), d.toFixed(2)]);
        }
      }
      log.sort((a, b) => b[0] - a[0]);
      console.log(`${file}: ${before | 0} → ${after | 0} triangles`);
      for (const [a, b, n, d] of log.slice(0, 12)) console.log(`   ${a | 0} → ${b | 0}  ${n} (${d} m)`);
      if (!dry) {
        doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER });
        await io.write(full, doc);
        console.log(`   wrote ${(fs.statSync(full).size / 1e6).toFixed(1)} MB`);
      }
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
