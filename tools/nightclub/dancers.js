// Bakes the nightclub crowd's silhouette dancer atlas from the game's rigged models + Mixamo clips:
//   node tools/nightclub/dancers.js [--port 8861]
// → assets/nightclub/dancers.png (+ dancers.json: cell size, frames, per-row body/clip/loop length)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* npx cache */ }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  for (const d of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, d, 'node_modules', 'playwright');
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error('playwright not found');
}

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const PORT = +(argv[argv.indexOf('--port') + 1] || 8861);
const OUT = path.join(ROOT, 'assets', 'nightclub');

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/tools/nightclub/dancers.html`);
    await page.waitForFunction(() => window.__out, null, { timeout: 300000 });
    const out = await page.evaluate(() => window.__out);
    if (out.error) throw new Error(out.error);
    fs.writeFileSync(path.join(OUT, 'dancers.png'), Buffer.from(out.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'dancers.json'), JSON.stringify(out.meta, null, 1));
    console.log(JSON.stringify({ ...out.meta, errors }, null, 1));
  } finally { await browser.close(); srv.kill(); }
})();
