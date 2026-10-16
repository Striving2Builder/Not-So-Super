// Act 2 Recall (src/act/recall.js; docs/design/act2.md "The drug: Super Squirt"): a rooftop stash taken,
// a memory clue read sober (nothing) and over the haze line (the flashback on the LIVE feed + the ink-wash
// card), the act board's "The night: n/5 remembered", the casino's memory clue, and Act 1 untouched.
//   node tools/shots/recall.js [--label recall] [--port 8899] [--flows all|sky,club,act1] [--w 844 --h 390]
// → shots/<label>/recall/*.png + report.json (errors per flow)
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
const LABEL = arg('--label', 'recall'), PORT = +arg('--port', 8899), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const EXTRA = arg('--query', '');
const glOf = (V) => V.page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
const OUT = path.join(ROOT, 'shots', LABEL, 'recall');
const ALL = ['sky', 'club', 'act1'];
const want = (f) => (FLOWS === 'all' ? ALL : FLOWS.split(',')).includes(f);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = { gl: {} };

  async function game(query) {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/?${query}${EXTRA}`);
    try { await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 }); } catch (e) { throw new Error(`the page never started: ${errors.join(' | ').slice(0, 500)}`); }
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.evaluate(() => { const c = document.querySelector('#cutscene'); if (c) for (let i = 0; i < 4; i++) c.click(); });
    await page.waitForTimeout(600);
    await page.click('#btn-new');
    await page.waitForTimeout(600);
    const top = () => page.evaluate(() => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); return el ? el.innerText.slice(0, 200) : null; });
    const press = (sel = '.opt, button') => page.evaluate((sel) => {
      const el = [...document.querySelectorAll('#modal-root .modal-back')].pop();
      if (!el) return false;
      const b = el.querySelector(sel) || el.querySelector('button');
      if (b) b.click(); else el.click();
      return true;
    }, sel);
    const V = {
      page, errors, top, press,
      shot: (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }),
      async through(until = () => false, wait = 30000) {
        const t0 = Date.now();
        while (Date.now() - t0 < wait) {
          if (await page.evaluate(until)) return true;
          if (await top()) { await press(); await page.waitForTimeout(350); continue; }
          if (await page.evaluate(() => !!document.querySelector('#cutscene.on'))) { await page.evaluate(() => { const c = document.querySelector('#cutscene'); for (let i = 0; i < 4; i++) c.click(); }); await page.waitForTimeout(500); continue; }
          await page.waitForTimeout(250);
        }
        return false;
      },
      close: () => page.close(),
    };
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000); // the welcome
    return V;
  }

  async function flow(name, fn) {
    if (!want(name)) return;
    const t0 = Date.now();
    let V = null;
    try { V = await fn(); } catch (e) { (report[name] = report[name] || {}).fail = String(e.stack || e).slice(0, 600); }
    report[name] = { ...(report[name] || {}), secs: Math.round((Date.now() - t0) / 1000), errors: V ? V.errors.slice(0, 12) : ['(flow failed before the page came back)'] };
    console.log(name, JSON.stringify(report[name]));
    if (V) await V.close().catch(() => {});
  }

  const ready = (V) => V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'rldwalk' && m.scene && !m.warming && m.hero; }, null, { timeout: 120000 });

  const night = (V) => V.page.evaluate(() => window.__game.state.act.act2?.night || 0);
  const fbOpen = (V) => V.page.waitForSelector('#modal-root .recall-fb', { timeout: 15000 }).then(() => true, () => false);

  // In the sky: a rooftop stash taken by perching, a memory clue sober (nothing) and over the haze line
  // (the flashback: the ink-wash card, the LIVE feed), the board line.
  await flow('sky', async () => {
    const V = await game('act=act2lair&flight=2d');
    await V.page.waitForTimeout(1500);
    await V.through(() => window.__game.state.act?.act2?.beats?.lair && !document.querySelector('#modal-root .modal-back'), 60000);
    const s = {};
    s.stash = await V.page.evaluate(async () => {
      const g = window.__game, ow = g.overworld, R = g.act.two.recall, M = await import('/src/act/recall.js');
      M.RECALL.stashFlash = 0;
      const spawned = !!R.spawnStash(ow); // (a random roof: may find none near her)
      for (const z of ow.zones.filter((q) => q.actDive === 'stash')) ow.removeZone(z);
      g.state.intox = 0;
      ow.zones.push({ uid: ow.uid++, t: 0, kind: 'stash', stash: true, actDive: 'stash', x: ow.hero.x + 40, y: ow.hero.y, ttl: 90, name: 'A stash on a rooftop', color: '#ff5fd0', glyph: '💊', reward: 0, lockKey: 'Stashes', blurb: '' });
      ow.hero.perch = { z: 60 };
      return { spawned };
    });
    await V.page.waitForFunction(() => !window.__game.overworld.zones.some((q) => q.actDive === 'stash'), null, { timeout: 10000 });
    Object.assign(s.stash, await V.page.evaluate(() => ({ intox: window.__game.state.intox })));
    await V.page.evaluate(() => { window.__game.overworld.hero.perch = null; });
    s.sober = await V.page.evaluate(async () => { const g = window.__game; g.state.intox = 0; const r = await g.act.two.recall.memory('A test clue'); return { r, night: g.state.act.act2.night || 0 }; });
    await V.page.evaluate(() => { const g = window.__game; g.state.intox = 60; g.act.two.recall.memory('A glass by the bar'); });
    s.fb = await fbOpen(V);
    await V.page.waitForTimeout(700);
    s.feed = await V.page.evaluate(() => ({ recall: document.querySelector('#feed')?.classList.contains('recall'), playing: window.__game.overworld.feed.playing?.cat || null }));
    await V.shot('recall_flashback');
    await V.press();
    s.night = await night(V);
    V.page.evaluate(() => window.__game.act.openBoard()).catch(() => {});
    await V.page.waitForSelector('.ab', { timeout: 10000 });
    s.board = await V.page.evaluate(() => (document.querySelector('.ab')?.innerText.match(/The night: [^\n]*/) || [''])[0]);
    await V.shot('recall_board');
    await V.press('.ab-x');
    report.sky = s;
    const bad = [];
    if (!(s.stash.intox >= 15)) bad.push('stash dose');
    if (s.sober.r || s.sober.night) bad.push('sober read');
    if (!s.fb || s.night !== 1) bad.push('flashback');
    if (!/1\/5 remembered/.test(s.board)) bad.push('board line');
    if (bad.length) throw new Error(`sky: ${bad.join(', ')}: ${JSON.stringify(s)}`);
    return V;
  });

  // In a 3D venue (the casino, a club3d): the memory clue by the bar reads only over the haze line.
  await flow('club', async () => {
    const V = await game('act=act2lair&zone=casino&flight=2d&club3beat=9999');
    await V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'club3' && m.scene && !m.warming && m.hero; }, null, { timeout: 120000 });
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; });
    await V.through(() => !document.querySelector('#modal-root .modal-back') && !window.__game.mode.busy, 20000);
    const s = {};
    s.clue = await V.page.evaluate(() => {
      const g = window.__game, m = g.mode, o = m.inter.find((q) => q.recall);
      if (!o) return null;
      g.state.intox = 0;
      const sober = o.label;
      g.state.intox = 60;
      m.hero.position.set(o.pos.x, 0, o.pos.z + 1.6);
      return { sober, high: o.label, can: o.can() };
    });
    await V.page.waitForTimeout(900);
    await V.shot('recall_club');
    V.page.evaluate(() => window.__game.mode.inter.find((q) => q.recall).act()).catch(() => {});
    s.fb = await fbOpen(V);
    await V.press();
    await V.page.waitForTimeout(400);
    s.after = await V.page.evaluate(() => ({ night: window.__game.state.act.act2.night, done: window.__game.mode.inter.find((q) => q.recall).recall.done }));
    report.club = s;
    if (!s.clue || !/means something/.test(s.clue.sober) || !/Remember/.test(s.clue.high) || !s.fb || s.after.night !== 1 || !s.after.done) throw new Error(`club: ${JSON.stringify(s)}`);
    return V;
  });

  // Act 1: no Recall (no stash on the map, no memory clue, the investigation bait unchanged).
  await flow('act1', async () => {
    const V = await game('flight=2d');
    await V.page.waitForTimeout(2500);
    const s = await V.page.evaluate(async () => {
      const g = window.__game, M = await import('/src/act/recall.js');
      return { recall: !!M.recallOf(g), stash: g.overworld.zones.some((q) => q.actDive === 'stash'), clue: M.memoryClue({ g, scene: null }, { x: 0, z: 0 }, 'x') };
    });
    report.act1 = s;
    if (s.recall || s.stash || s.clue) throw new Error(`act1: ${JSON.stringify(s)}`);
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
  console.log(`shots → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
