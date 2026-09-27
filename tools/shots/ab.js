// A/B fps: the same 3D zone in this checkout and in another checkout (e.g. a baseline export),
// measured alternately in one browser so background load hits both equally.
//   node tools/shots/ab.js <Venue|asylum> <otherRoot> [--port 8133] [--rounds 4]
const path = require('path'); const fs = require('fs'); const { spawn } = require('child_process');
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* npx cache */ }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  for (const d of fs.readdirSync(cache)) { const p = path.join(cache, d, 'node_modules', 'playwright'); if (fs.existsSync(p)) return require(p); }
}
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const venue = argv[0] || 'Warehouse';
const roots = { new: path.resolve(__dirname, '..', '..'), base: path.resolve(argv[1]) };
const PORT = +arg('--port', 8133), BPORT = +arg('--bport', 8183), ROUNDS = +arg('--rounds', 4);

async function open(browser, port) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', port, e.message));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'));
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(800); await page.click('#btn-new'); await page.waitForTimeout(600);
  const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
  await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
  await page.evaluate((v) => { const g = window.__game, ow = g.overworld; g.setMode('overworld'); const z = v === 'asylum' ? ow.spawn('asylum', true) : ow.spawn('special', true, v); if (z.boss !== undefined && v !== 'asylum') z.boss = z.boss || null; g.startZone(z); }, venue);
  await page.waitForFunction(() => { const m = window.__game.mode; return m && m.hero && m.scene && !m.warming; }, null, { timeout: 120000 });
  await page.evaluate(() => { window.__game.mode.grace = 1e9; });
  await page.waitForTimeout(2000);
  return page;
}
const fps = (page) => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else { const i = window.__game.mode.renderer.info.render; res({ fps: n / 2.5, calls: i.calls, tris: i.triangles }); } }; requestAnimationFrame(tick); }));

(async () => {
  const srv = Object.entries(roots).map(([k, root], i) => spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(i ? BPORT : PORT) }, stdio: 'ignore' }));
  await new Promise((r) => setTimeout(r, 900));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const res = { new: [], base: [] };
    for (let r = 0; r < ROUNDS; r++) {
      for (const [i, k] of (r % 2 ? ['base', 'new'] : ['new', 'base']).entries()) {
        const page = await open(browser, k === 'new' ? PORT : BPORT);
        const m = await fps(page);
        res[k].push(m);
        console.log(k.padEnd(5), m.fps.toFixed(1), 'fps', m.calls, 'calls', m.tris, 'tris');
        await page.context().close();
      }
    }
    const avg = (a) => a.reduce((s, m) => s + m.fps, 0) / a.length;
    console.log(`avg new ${avg(res.new).toFixed(1)}  base ${avg(res.base).toFixed(1)}  ratio ${(avg(res.new) / avg(res.base)).toFixed(2)}`);
  } finally { await browser.close(); srv.forEach((s) => s.kill()); }
})();
