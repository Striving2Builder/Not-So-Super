// Shoot the hero lab sheet (tools/supergirl/lab.html) headless:
//   node tools/supergirl/lab.js --label NAME [--port 8812] [--query hero=classic&only=fly]
// → shots/supergirl/<label>.png (+ crops of the flight grid and the sprite strip).
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
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LABEL = arg('--label', 'lab');
const PORT = +arg('--port', 8812);
const QUERY = arg('--query', '');
const OUT = path.join(ROOT, 'shots', 'supergirl');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GPU stall|CONTEXT_LOST/.test(m.text())) errs.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/tools/supergirl/lab.html${QUERY ? '?' + QUERY : ''}`);
    await page.waitForFunction(() => window.__labDone, null, { timeout: 240000 });
    const png = await page.evaluate(() => document.getElementById('sheet').toDataURL('image/png'));
    const f = path.join(OUT, LABEL + '.png');
    fs.writeFileSync(f, Buffer.from(png.split(',')[1], 'base64'));
    console.log(await page.title());
    console.log(f, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no errors');
  } finally { await browser.close(); srv.kill(); }
})();
