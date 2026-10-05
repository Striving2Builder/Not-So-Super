// Screenshots of the detective nightclub (src/nightclub/, ?club=v2): every room of a club at the
// phone size, the DJ set piece, Super Squirt at three levels, plus fps per room and page errors.
//   node tools/shots/nightclub.js [--label nc] [--port 8851] [--seed 0 (= flagship)] [--w 844 --h 390]
// → shots/<label>/nightclub/*.png + metrics.json
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
const LABEL = arg('--label', 'nc'), PORT = +arg('--port', 8851), SEED = +arg('--seed', 0);
const W = +arg('--w', 844), H = +arg('--h', 390);
const OUT = path.join(ROOT, 'shots', LABEL, 'nightclub');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], metrics = {};
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/?club=v2&flight=2d${SEED ? `&clubseed=${SEED}` : ''}`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.waitForTimeout(800);
    await page.click('#btn-new');
    await page.waitForTimeout(600);
    const opt = page.locator('#modal-root .opt').first();
    if (await opt.count()) await opt.click();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const g = window.__game, ow = g.overworld;
      g.setMode('overworld');
      const z = ow.spawn('special', true, 'Triangle Club');
      if (!z) throw new Error('could not spawn a club zone');
      g.startZone(z);
    });
    await page.waitForFunction(() => window.__game.modeName === 'nightclub', null, { timeout: 15000 }).catch(async (e) => {
      throw new Error(`not in the nightclub: ${JSON.stringify(await page.evaluate(() => ({ mode: window.__game.modeName, url: location.search })))} ${errors.join(' | ')}`);
    });
    await page.waitForTimeout(2500); // banner + her sprite renderer
    const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(+(n / 2).toFixed(1)); }; requestAnimationFrame(tick); }));
    const rooms = await page.evaluate(() => window.__game.mode.club.rooms.map((r) => r.id));
    for (const id of rooms) {
      // stand her a third of the way in, facing the room, the camera settled
      await page.evaluate((id) => { const m = window.__game.mode; m.go(id, null); m.p.x = m.room.w * 0.28; m.cam = m.p.x; m.fade = { a: 0, dir: 0 }; }, id);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `room_${id}.png`) });
      metrics[id] = await fps();
    }
    // the DJ set piece
    await page.evaluate(() => { const m = window.__game.mode; m.go('main', null); m.view = 'set'; m.setT = -99; });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, 'set_djview.png') });
    await page.evaluate(() => { const m = window.__game.mode; m.view = 'walk'; m.setVideo(false); });
    // the bar close-up: the scene, then a tap on the napkin (its clue dialog)
    await page.evaluate(() => { const m = window.__game.mode; m.go('bar', null); m.use({ spot: { type: 'closeup' } }); });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, 'closeup_bar.png') });
    await page.evaluate(() => { const m = window.__game.mode, R = m.closeupRect(m.g.w, m.g.h), s = m.scene.spots.find((q) => q.id === 'napkin'); m.g.input.taps.push({ x: R.x + s.x * R.w, y: R.y + s.y * R.h }); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, 'closeup_bar_clue.png') });
    await page.evaluate(() => { document.querySelectorAll('#modal-root .opt').forEach((b) => b.click()); const m = window.__game.mode; m.view = 'walk'; });
    // every other room's close-up
    for (const id of ['entrance', 'main', 'vip', 'restroom', 'office']) {
      const ok = await page.evaluate((id) => { const m = window.__game.mode; if (!m.byId[id]) return false; m.go(id, null); m.use({ spot: { type: 'closeup' } }); return m.view === 'closeup'; }, id);
      if (!ok) continue;
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT, `closeup_${id}.png`) });
      await page.evaluate(() => { window.__game.mode.view = 'walk'; });
    }
    await page.evaluate(() => { window.__game.mode.go('main', null); });
    await page.waitForTimeout(400);
    // Super Squirt: light / medium / heavy on the main floor
    for (const lv of [35, 65, 92]) {
      await page.evaluate((lv) => { const m = window.__game.mode; m.g.state.intox = lv; m.p.x = m.room.w * 0.55; m.cam = m.p.x; }, lv);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `intox_${lv}.png`) });
      metrics[`intox_${lv}`] = await fps();
    }
    await page.evaluate(() => { window.__game.mode.g.state.intox = 0; });
  } finally {
    fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify({ fps: metrics, errors }, null, 1));
    await browser.close(); srv.kill();
  }
  console.log(JSON.stringify({ out: OUT, fps: metrics, errors }, null, 1));
})();
