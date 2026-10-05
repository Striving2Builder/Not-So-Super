// Brawler drift check (iPad descriptor): does the player move with no input? Starts a street brawl,
// then logs her x for 6 s untouched, then after a touch tap-and-release on the joystick zone.
//   node tools/shots/drift.js [--browser webkit|chromium] [--port 8872]
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
const PORT = +arg('--port', 8872), WHICH = arg('--browser', 'webkit');

(async () => {
  const pw = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await pw[WHICH].launch(WHICH === 'chromium' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  try {
    const ctx = await browser.newContext({ ...pw.devices['iPad Pro 11 landscape'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`http://localhost:${PORT}/?flight=2d`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.click('#btn-new'); await page.waitForTimeout(800);
    const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const g = window.__game, z = g.overworld.spawn('street', true); g.startZone(z); });
    await page.waitForFunction(() => window.__game.modeName === 'brawler' && window.__game.mode.loading === null, null, { timeout: 60000 });
    await page.waitForTimeout(2500); // banner
    const sample = async (label) => {
      const xs = [];
      for (let i = 0; i < 12; i++) { xs.push(await page.evaluate(() => { const m = window.__game.mode, s = window.__game.input.stick; return `${Math.round(m.p.x)}${s.id !== null ? '[stick ' + s.x.toFixed(2) + ']' : ''}${m.lock ? '[lock]' : ''}`; })); await page.waitForTimeout(500); }
      console.log(`${label}: ${xs.join(' ')}`);
    };
    const info = await page.evaluate(() => { const m = window.__game.mode; return { w: innerWidth, h: innerHeight, viewHalf: Math.round(m.viewHalf), cam: Math.round(m.cam), len: m.len, waves: m.waves.map((w) => w.x), captives: m.captives.map((c) => Math.round(c.x)) }; });
    console.log(JSON.stringify(info));
    await sample('untouched');
    const z = await page.evaluate(() => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    await page.touchscreen.tap(z.x, z.y);
    await sample('after stick tap');
    console.log('errors:', errors.length ? errors : 'none');
  } finally { await browser.close(); srv.kill(); }
})();
