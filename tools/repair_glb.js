// Post-export fix-up for GLBs from Blender: removes textures that ended up without an image
// (Blender's encoder occasionally fails on an odd source texture) and renumbers every reference,
// so three.js never trips over a dangling texture.   Usage: node tools/repair_glb.js file.glb
const fs = require('fs');
const file = process.argv[2];
const buf = fs.readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const rest = buf.slice(20 + jsonLen); // BIN chunk (header + data), untouched

const srcOf = (t) => t.source ?? t.extensions?.EXT_texture_webp?.source;
const bad = new Set((json.textures || []).map((t, i) => (srcOf(t) === undefined || !json.images[srcOf(t)] ? i : -1)).filter((i) => i >= 0));
if (!bad.size) { console.log('repair_glb: nothing to fix'); process.exit(0); }

const remap = new Map();
json.textures = json.textures.filter((t, i) => { if (bad.has(i)) return false; remap.set(i, remap.size); return true; });

// Every textureInfo lives under a key ending in "Texture" (baseColorTexture, normalTexture, clearcoatTexture…).
let dropped = 0;
const walk = (o) => {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (k.endsWith('Texture') && v && typeof v === 'object' && 'index' in v) {
      if (bad.has(v.index)) { delete o[k]; dropped++; } else v.index = remap.get(v.index);
    } else walk(v);
  }
};
(json.materials || []).forEach(walk);

let js = Buffer.from(JSON.stringify(json));
const pad = (4 - (js.length % 4)) % 4;
js = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + js.length + rest.length, 8);
header.writeUInt32LE(js.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
fs.writeFileSync(file, Buffer.concat([header, js, rest]));
console.log(`repair_glb: removed ${bad.size} broken texture(s), cleared ${dropped} material slot(s)`);
