// Prepares exported clubs for low-end devices. For each club in assets/clubs/:
//   * <club>.lite.glb — same model with every texture scaled to fit 512 px (about ¼ the GPU memory)
//   * <club>.json     — gains the walkable-floor scan ("floor", "mainY") so the game skips it on load
// The scan and the resizing run in headless Chrome, using the game's own code (src/clubgeo.js).
//
// Setup once:  npm install --prefix tools
// Usage:       node tools/bake_clubs.js [club ...]        (default: every club)
// Set CHROME=<path to chrome> if Chrome isn't in a standard location.
const fs = require('fs');
const path = require('path');
const http = require('http');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) {
  console.error('puppeteer-core is missing. Run: npm install --prefix tools');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const CLUB_DIR = path.join(ROOT, 'assets/clubs');
const LITE_MAX = 512;   // px, longest side
const WEBP_Q = 0.85;

const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => fs.existsSync(p));

// ---------------------------------------------------------------- GLB read/write
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ' is not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
  const binLen = buf.readUInt32LE(20 + jsonLen);
  const bin = buf.slice(28 + jsonLen, 28 + jsonLen + binLen);
  return { json, bin };
}

const pad4 = (b, fill) => { const p = (4 - (b.length % 4)) % 4; return p ? Buffer.concat([b, Buffer.alloc(p, fill)]) : b; };

/** Write a GLB, rebuilding the binary chunk with some buffer views' bytes replaced. */
function writeGlb(file, json, bin, replace) {
  const chunks = []; let offset = 0;
  json.bufferViews.forEach((bv, i) => {
    const data = replace.get(i) || bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const padded = pad4(data, 0);
    bv.byteOffset = offset; bv.byteLength = data.length;
    chunks.push(padded); offset += padded.length;
  });
  json.buffers[0].byteLength = offset;
  const binOut = Buffer.concat(chunks);
  const js = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binOut.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(binOut.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, binOut]));
}

// ---------------------------------------------------------------- tiny static server
function serve() {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
  const srv = http.createServer((req, res) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

// ---------------------------------------------------------------- bake
async function bakeClub(page, key) {
  const glbPath = path.join(CLUB_DIR, key + '.glb'), metaPath = path.join(CLUB_DIR, key + '.json');
  const t0 = Date.now();

  // 1) walkable floor → <club>.json
  const baked = await page.evaluate((u) => window.bakeFloor(u), `/assets/clubs/${key}.glb`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  delete meta.floor; delete meta.mainY;
  const text = JSON.stringify({ ...meta, mainY: baked.mainY, floor: '@FLOOR@' }, null, 1)
    .replace('"@FLOOR@"', JSON.stringify(baked.floor)); // keep the point list on one line
  fs.writeFileSync(metaPath, text + '\n');

  // 2) lite copy with textures scaled to fit LITE_MAX
  const { json, bin } = readGlb(glbPath);
  const replace = new Map();
  let shrunk = 0;
  for (const im of json.images || []) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView];
    const bytes = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const out = await page.evaluate((b, m, max, q) => window.shrinkImage(b, m, max, q), bytes.toString('base64'), im.mimeType, LITE_MAX, WEBP_Q);
    if (!out) continue;
    replace.set(im.bufferView, Buffer.from(out, 'base64'));
    if (im.mimeType !== 'image/webp') {
      // re-encoded as WebP: point the textures at it through EXT_texture_webp
      im.mimeType = 'image/webp';
      const idx = json.images.indexOf(im);
      for (const t of json.textures || []) {
        if (t.source === idx) { delete t.source; t.extensions = { ...t.extensions, EXT_texture_webp: { source: idx } }; }
      }
      json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'EXT_texture_webp'])];
      json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'EXT_texture_webp'])];
    }
    shrunk++;
  }
  const litePath = path.join(CLUB_DIR, key + '.lite.glb');
  writeGlb(litePath, json, bin, replace);
  const mb = (f) => (fs.statSync(f).size / 1e6).toFixed(1) + ' MB';
  console.log(`${key}: floor ${baked.floor.length} spots (mainY ${baked.mainY}); lite ${mb(litePath)} (full ${mb(glbPath)}), ${shrunk} textures shrunk — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

(async () => {
  if (!CHROME) { console.error('Chrome not found. Set CHROME=<path to chrome executable>.'); process.exit(1); }
  const all = fs.readdirSync(CLUB_DIR).filter((f) => f.endsWith('.glb') && !f.endsWith('.lite.glb')).map((f) => f.slice(0, -4));
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : all;
  const srv = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 600000 });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('page:', e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/tools/bake.html`);
    await page.waitForFunction('window.bakeReady === true');
    for (const key of keys) await bakeClub(page, key);
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
