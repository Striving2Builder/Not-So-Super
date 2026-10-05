// Dive check on an iPad descriptor: from 3D flight, the real dive (tryDive → plunge → THUD panel →
// startZone) into each kind of zone, logging the mode over time, the LOADING card, page errors and
// console errors. Catches "can't get from flying into a zone" bugs that a direct startZone() skips.
//   node tools/shots/divecheck.js [--browser webkit|chromium] [--port 8871] [--query club=v1]
// → prints one block per zone kind, and shots/divecheck/<browser>_<kind>.png 6 s after the dive.
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
const PORT = +arg('--port', 8871), WHICH = arg('--browser', 'webkit'), QUERY = arg('--query', '');
const OUT = path.join(ROOT, 'shots', 'divecheck');
// kind → how to spawn it (overworld.spawn(kind, true, venue))
const CASES = { club: ['special', 'Triangle Club'], brawl: ['street'], investigate: ['case'], special: ['special', 'Warehouse'] };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pw = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await pw[WHICH].launch(WHICH === 'chromium' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  try {
    for (const [kind, spawnArgs] of Object.entries(CASES)) {
      const ctx = await browser.newContext({ ...pw.devices['iPad Pro 11 landscape'] });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
      await page.goto(`http://localhost:${PORT}/?flight=3d${QUERY ? '&' + QUERY : ''}`);
      await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
      await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
      await page.waitForTimeout(800);
      await page.click('#btn-new');
      await page.waitForTimeout(800);
      const opt = page.locator('#modal-root .opt').first();
      if (await opt.count()) await opt.click();
      await page.waitForTimeout(3000);
      const setup = await page.evaluate((a) => {
        const g = window.__game, ow = g.overworld;
        const z = ow.spawn(a[0], true, a[1]);
        if (!z) return { err: 'no zone' };
        ow.hero.x = z.x; ow.hero.y = z.y; ow.near = z;
        ow.tryDive();
        return { mode: z.mode, venue: z.venue, view3d: !!ow.view3d, diving: !!ow.diving };
      }, spawnArgs);
      const t0 = Date.now(), timeline = [];
      let last = '';
      while (Date.now() - t0 < 10000) {
        const s = await page.evaluate(() => {
          const g = window.__game, ld = document.querySelector('#loading-panel, .loading-panel');
          return `${g.modeName}${g.overworld.diving ? '/diving' + (g.overworld.diving.fired ? '+fired' : '') : ''}${document.body.classList.contains('divefx-hold') ? '/hold' : ''}`;
        }).catch((e) => 'eval-failed: ' + e.message.slice(0, 80));
        if (s !== last) { timeline.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`); last = s; }
        if (Date.now() - t0 > 6000 && !timeline.some((x) => x.includes('png'))) {
          await page.screenshot({ path: path.join(OUT, `${WHICH}_${kind}.png`) }).catch(() => {});
          timeline.push('png');
        }
        await page.waitForTimeout(200);
      }
      console.log(`\n== ${WHICH} ${kind} ${JSON.stringify(setup)}\n  ${timeline.join('\n  ')}\n  errors: ${errors.length ? '\n    ' + [...new Set(errors)].slice(0, 12).join('\n    ') : 'none'}`);
      await ctx.close();
    }
  } finally { await browser.close(); srv.kill(); }
})();
