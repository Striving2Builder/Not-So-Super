// Act 2's casino (src/club3d/casino.js, cards.js; docs/design/act2.md "The casino"): a casino night in
// headless Chromium. win: an Act 2 High-Roller Suite mission opens the 3D casino in the knockoff, both
// tables won on a stacked deck (top + skirt finds, leads), cashed out = the casino gate counts. lose: four
// lost hands (doses, the knockoff's cape/gloves/belt/boots, -8 rep each), thrown out, the night lost.
// act1: an Act 1 High-Roller Suite mission is still the old special zone.
//   node tools/shots/casino.js [--label casino] [--port 8898] [--flows all|win,lose,act1] [--w 844 --h 390]
// → shots/<label>/casino/*.png + report.json (errors per flow; draw calls/triangles)
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
const LABEL = arg('--label', 'casino'), PORT = +arg('--port', 8898), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const EXTRA = arg('--query', '');
const glOf = (V) => V.page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
const OUT = path.join(ROOT, 'shots', LABEL, 'casino');
const ALL = ['win', 'lose', 'act1'];
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


  /** Act 2 under way (the opening done), disgraced; then a High-Roller Suite mission from the map, as a dive would start it. */
  const casinoNight = (V) => V.page.evaluate(() => {
    const g = window.__game, st = g.state, ow = g.overworld;
    g.act.two.applyDebug(st, 'act2'); st.act.act2.opening = 'done'; st.rep = -40;
    const b = g.city.blocks.find((k) => k.d === 'casino' && !k.river);
    g.startZone({ uid: ow.uid++, t: 0, kind: 'special', mode: 'special', venue: 'High-Roller Suite', theme: 'extortion', name: 'High-Roller Suite: Extortion', reward: 40, lockKey: 'High-Roller Suite', district: 'casino', x: b.x0 + 60, y: b.y0 + 60 });
  });
  const ready = (V) => V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'club3' && m.scene && !m.warming && m.hero; }, null, { timeout: 120000 });
  const doorDone = (V) => V.through(() => !document.querySelector('#modal-root .modal-back') && window.__game.mode.t > 1.5, 20000);
  /** Tap an overlay button whose text has `txt` (waits for it). */
  const tap = async (V, txt) => {
    await V.page.waitForFunction((t) => [...document.querySelectorAll('#cas-table .btns button')].some((b) => b.textContent.includes(t)), txt, { timeout: 15000 });
    await V.page.evaluate((t) => [...document.querySelectorAll('#cas-table .btns button')].find((b) => b.textContent.includes(t)).click(), txt);
    await V.page.waitForTimeout(250);
  };
  const sit = (V, i) => V.page.evaluate((i) => { const m = window.__game.mode, t = m.hallA.casino.tables[i]; m.hero.position.set(t.seat.x, 0, t.seat.z); m.grace = 1e9; m.run(() => m.playTable(t)); }, i);
  const night = (V) => V.page.evaluate(() => { const g = window.__game, m = g.mode, st = g.state, B = st.act.act2; return { mode: g.modeName, casino: !!m.zone?.casino, plan: m.plan?.id, knockoff: !!m.heroSrc?.(), losses: m.casino?.losses, won: m.casino ? Object.keys(m.casino.won) : null, night: m.casino?.night, cape: m.heroModel?.cape.mesh.visible, rep: st.rep, intox: Math.round(st.intox), suit: { ...B.suit }, casinoGate: B.counts.casino, leads: st.stats.leads || 0 }; });

  await flow('win', async () => {
    const V = await game('flight=2d&casinorig=win&club3beat=9999');
    await casinoNight(V);
    await ready(V);
    await doorDone(V);
    await V.page.waitForTimeout(1500);
    await V.shot('casino_floor'); report.gl.casino_floor = await glOf(V);
    report.win = { entered: await night(V) };
    await sit(V, 0);
    await tap(V, 'Deal me in'); await tap(V, 'Show cards');
    await V.page.waitForSelector('#cas-table .msg.good', { timeout: 10000 });
    await V.shot('casino_highcard_win');
    await tap(V, 'Leave the table');
    await V.page.waitForFunction(() => !window.__game.mode.busy && !document.querySelector('#cas-table'), null, { timeout: 10000 });
    report.win.high = await night(V);
    await sit(V, 1);
    await tap(V, 'Deal me in');
    await V.page.waitForSelector('#cas-table .msg.good', { timeout: 10000 });
    await tap(V, 'Leave the table');
    await V.page.waitForFunction(() => !window.__game.mode.busy && !document.querySelector('#cas-table'), null, { timeout: 10000 });
    report.win.both = await night(V);
    await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.cashier()); });
    await V.page.waitForTimeout(500);
    await V.press('.opt');
    await V.through(() => window.__game.modeName === 'overworld' && !document.querySelector('#modal-root .modal-back'), 40000);
    report.win.after = await night(V);
    return V;
  });

  await flow('lose', async () => {
    const V = await game('flight=2d&casinorig=lose&club3beat=9999');
    await casinoNight(V);
    await ready(V);
    await doorDone(V);
    await sit(V, 0);
    await tap(V, 'Deal me in');
    report.lose = { hands: [] };
    for (let i = 0; i < 4; i++) {
      await tap(V, i ? 'Show cards' : 'Swap yours');
      if (!i) await tap(V, 'Show cards');
      await V.page.waitForSelector('#cas-table .msg.bad', { timeout: 10000 });
      await V.page.waitForTimeout(300);
      report.lose.hands.push(await night(V));
      if (i === 2) await V.shot('casino_lost_hand');
      if (i < 3) await tap(V, 'Deal again');
    }
    await tap(V, 'walk you out');
    await V.through(() => window.__game.modeName === 'overworld' && !document.querySelector('#modal-root .modal-back'), 40000);
    report.lose.after = await night(V);
    return V;
  });

  await flow('act1', async () => {
    const V = await game('flight=2d');
    await V.page.evaluate(() => { const g = window.__game; g.startZone(g.overworld.spawn('special', true, 'High-Roller Suite')); });
    await V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName !== 'overworld' && m.scene && !m.warming; }, null, { timeout: 120000 });
    report.act1 = await V.page.evaluate(() => ({ mode: window.__game.modeName, casino: !!window.__game.mode.zone?.casino }));
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
})();
