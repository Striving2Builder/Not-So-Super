// Audio smoke test: every recorded sample in assets/audio/game/ loads and decodes in the browser,
// the flight wind hands over to the recorded loops, and each zone mode gets its ambience bed
// (dropped again back in the sky). It can't judge how anything sounds; that needs ears.
//
//   node tools/shots/audio.js [--port 8832]
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through to the npx cache */ }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  for (const d of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, d, 'node_modules', 'playwright');
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error('playwright not found');
}

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const PORT = +(argv[argv.indexOf('--port') + 1] || 8832);
const FILES = fs.readdirSync(path.join(ROOT, 'assets', 'audio', 'game'));

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  let fails = 0;
  const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };
  try {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 768 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' || /unavailable/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    await page.goto(`http://localhost:${PORT}/?flight=2d`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.click('#btn-new'); // the gesture that unlocks audio and starts decoding the voices
    await page.waitForTimeout(600);
    const opt = page.locator('#modal-root .opt').first();
    if (await opt.count()) await opt.click();

    // every file decodes (loadSample resolves to a buffer); report its decoded length
    const decoded = await page.evaluate(async (files) => {
      const { loadSample } = await import('/src/sfx.js');
      const out = {};
      for (const f of files) { const b = await loadSample(f); out[f] = b ? +b.duration.toFixed(2) : null; }
      return out;
    }, FILES);
    for (const [f, d] of Object.entries(decoded)) check(d > 0, `decode ${f} (${d}s)`);

    // flight: the wind swaps to the recorded loops
    await page.waitForFunction(() => window.__game.overworld.audio.nodes?.rec, null, { timeout: 8000 }).catch(() => {});
    check(await page.evaluate(() => !!window.__game.overworld.audio.nodes?.rec), 'flight wind uses the recorded loops');

    // zones: the right bed per mode, none back in the sky
    const want = { street: ['brawl', 'street.wav'], case: ['investigate', 'crime-scene.wav'], asylum: ['asylum', 'drone.wav'] };
    for (const [kind, [zoneMode, file]] of Object.entries(want)) {
      const mode = await page.evaluate(async ([kind, zoneMode]) => {
        const g = window.__game; g.setMode('overworld');
        // (after dark most cases are night cases in the clubs: spawn until it's the zone mode we want)
        let z = null;
        for (let i = 0; i < 100 && !(z && z.mode === zoneMode); i++) {
          if (z) g.overworld.zones = g.overworld.zones.filter((o) => o !== z);
          z = g.overworld.spawn(kind, true);
        }
        g.startZone(z);
        return g.modeName;
      }, [kind, zoneMode]);
      await page.waitForTimeout(2500);
      const playing = await page.evaluate(async () => (await import('/src/ambience.js')).ambience.playing);
      check(playing === file, `${kind} (${mode}) bed: ${playing}`);
    }
    await page.evaluate(() => window.__game.setMode('overworld'));
    await page.waitForTimeout(300);
    check(await page.evaluate(async () => (await import('/src/ambience.js')).ambience.playing) === null, 'sky: no bed');

    // every sfx entry plays without throwing
    const threw = await page.evaluate(async () => {
      const { sfx } = await import('/src/sfx.js');
      const bad = [];
      for (const [k, f] of Object.entries(sfx)) if (typeof f === 'function' && !['toggle', 'unlock'].includes(k)) { try { f(); } catch (e) { bad.push(`${k}: ${e.message}`); } }
      return bad;
    });
    check(!threw.length, `all sfx voices play ${threw.join('; ')}`);
    check(!errors.length, `no console errors ${errors.slice(0, 5).join(' | ')}`);
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
