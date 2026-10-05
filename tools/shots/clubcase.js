// End-to-end check of the detective club's case loop (src/nightclub/): the blackout cinematic, the
// polaroid hunt and its remembered clue, capture on the third blackout, the case board, a correct
// accusation (case solved → leads on the map, saved), and a lead mission starting from the map.
//   node tools/shots/clubcase.js [--port 8878] [--label clubcase] [--solve (only the case-board → solve → leads part)]
// → shots/<label>/*.png + a pass/fail line per step.
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
const PORT = +arg('--port', 8878), LABEL = arg('--label', 'clubcase');
const OUT = path.join(ROOT, 'shots', LABEL);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], results = [];
  const ok = (name, pass, info = '') => { results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
  try {
    const newPage = async () => { const p = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); p.on('pageerror', (e) => errors.push(String(e).slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); }); return p; };
    let page = await newPage();
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
    const closeModals = () => page.evaluate(() => { document.querySelectorAll('#modal-root .opt').forEach((b) => b.click()); document.querySelectorAll('#modal-root .paper, #modal-root .newspaper, #modal-root > *').forEach((el) => { if (!el.querySelector('.opt')) el.click(); }); });
    const enterClub = async () => {
      await page.evaluate(() => { const g = window.__game, ow = g.overworld; g.setMode('overworld'); const z = ow.spawn('special', true, 'Triangle Club'); g.startZone(z); });
      await page.waitForFunction(() => window.__game.modeName === 'nightclub', null, { timeout: 15000 });
      await page.waitForTimeout(2000);
    };
    await page.goto(`http://localhost:${PORT}/?flight=2d`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { localStorage.clear(); (await import('/src/settings.js')).autoTune.done = true; });
    await page.click('#btn-new'); await page.waitForTimeout(600);
    const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
    await page.waitForTimeout(800);

    if (!argv.includes('--solve')) {
    // 1) blackout → cinematic → wake → polaroid hunt → remembered clue
    await enterClub();
    await page.evaluate(() => { const m = window.__game.mode; m.go('main', null); m.p.x = 1500; m.cam = 1500; m.g.state.intox = 70; m.snapT = -99; });
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__game.mode.g.state.intox = 100; });
    await page.waitForTimeout(1600);
    await shot('1_cinematic');
    ok('blackout starts the cinematic', await page.evaluate(() => window.__game.mode.blackout?.phase === 'cine'));
    await page.waitForFunction(() => { const m = window.__game.mode; return !m.blackout || m.blackout.phase === 'wake'; }, null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    const hunt = await page.evaluate(() => { const m = window.__game.mode; return m.photos ? { n: m.photos.list.length, rooms: m.photos.list.map((p) => p.room), imgs: m.photos.list.filter((p) => p.img).length, hud: document.getElementById('hud-extra').textContent } : null; });
    ok('wake scatters 3 polaroids', hunt && hunt.n === 3, JSON.stringify(hunt));
    // walk to the first polaroid's room and stand next to it
    await page.evaluate(() => { const m = window.__game.mode, p = m.photos.list[0]; m.go(p.room, null); m.p.x = p.x + 300; m.cam = p.x + 150; m.blackout = null; });
    await page.waitForTimeout(700);
    await shot('2_polaroid_on_floor');
    for (let i = 0; i < 3; i++) {
      await page.evaluate((i) => { const m = window.__game.mode, p = m.photos.list[i]; m.go(p.room, null); m.p.x = p.x; m.cam = p.x; }, i);
      await page.waitForTimeout(900);
      if (i === 0) await shot('3_polaroid_dialog');
      await closeModals(); await page.waitForTimeout(500);
    }
    await page.waitForTimeout(600);
    await shot('4_remembered_clue');
    const after = await page.evaluate(() => { const m = window.__game.mode; return { photos: !!m.photos, count: m.case.count }; });
    ok('all polaroids → hunt over + a remembered clue', !after.photos && after.count >= 1, JSON.stringify(after));
    await closeModals();

    // 2) three blackouts in one visit → captured (keep the meter full and dialogs closed until it happens)
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 40; k++) {
        const s = await page.evaluate(() => { const g = window.__game; document.querySelectorAll('#modal-root .opt').forEach((b) => b.click()); if (g.modeName !== 'nightclub') return 'left'; if (g.mode.blackout) return g.mode.blackout.phase; g.state.intox = 100; return 'set'; });
        if (s === 'cine' || s === 'left') break;
        await page.waitForTimeout(250);
      }
      await page.waitForFunction(() => { const g = window.__game; return g.modeName !== 'nightclub' || !g.mode.blackout || g.mode.blackout.phase === 'wake'; }, null, { timeout: 20000 });
      await page.waitForTimeout(1600);
    }
    const capt = await page.evaluate(() => window.__game.modeName);
    ok('third blackout → captured', capt === 'captured', capt);
    await page.waitForTimeout(1500);
    await shot('5_captured');
    }

    // 3) case board → accusation → solved → leads on the map (a fresh game: the capture story is still running)
    if (!argv.includes('--solve')) {
    await page.close(); page = await newPage();
    await page.goto(`http://localhost:${PORT}/?flight=2d`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { localStorage.clear(); (await import('/src/settings.js')).autoTune.done = true; });
    await page.click('#btn-new'); await page.waitForTimeout(600);
    { const o = page.locator('#modal-root .opt').first(); if (await o.count()) await o.click(); }
    await page.waitForTimeout(800);
    }
    await enterClub();
    await page.evaluate(() => {
      const m = window.__game.mode;
      for (const k of ['bar:napkin', 'bar:phone', 'entrance:jacket', 'entrance:list', 'main:headphones', 'main:phone', 'vip:watch', 'vip:card', 'vip:matches', 'office:cash']) { const [a, b] = k.split(':'); m.case.find(a, b); }
    });
    await page.evaluate(() => { window.__game.mode.caseBoard(); });
    await page.waitForTimeout(700);
    await shot('6_case_board');
    await page.click('#modal-root .opt:has-text("Make the accusation")');
    for (const a of ['Moe, the DJ', 'Kraken Shipping', 'Thursday, Pier 9']) { await page.waitForTimeout(500); await page.click(`#modal-root .opt:has-text("${a}")`); }
    await page.waitForTimeout(900);
    await shot('7_case_solved');
    for (let i = 0; i < 40; i++) { await closeModals(); if (await page.evaluate(() => window.__game.modeName === 'overworld')) break; await page.waitForTimeout(500); }
    for (let i = 0; i < 6; i++) { await closeModals(); await page.waitForTimeout(400); }
    await page.waitForTimeout(2000);
    const leads = await page.evaluate(() => { const g = window.__game, saved = Object.keys(localStorage).map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }).find((v) => v && v.leads) || null; return { mode: g.modeName, leads: g.state.leads.map((l) => l.id), zones: g.overworld.zones.filter((z) => z.leadId).map((z) => `${z.name} (${z.mode}, +${z.reward})`), saved: saved ? (saved.leads || []).length : null }; });
    ok('solved → 3 leads in state + on the map + saved', leads.leads.length === 3 && leads.zones.length === 3 && leads.saved === 3, JSON.stringify(leads));
    // 4) a lead mission starts from the map
    const started = await page.evaluate(() => { const g = window.__game, z = g.overworld.zones.find((q) => q.leadId); if (!z) return { mode: 'no lead zone' }; g.startZone(z); return { mode: g.modeName, name: z.name }; });
    await page.waitForTimeout(3000);
    await shot('8_lead_mission');
    ok('a lead mission starts', ['special', 'brawler'].includes(started.mode), JSON.stringify(started));
  } catch (e) {
    ok('script', false, e.message.slice(0, 300));
  } finally {
    console.log(results.join('\n'));
    console.log('page errors:', errors.length ? [...new Set(errors)].slice(0, 8) : 'none');
    await browser.close(); srv.kill();
  }
})();
