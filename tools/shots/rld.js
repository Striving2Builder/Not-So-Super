// RLD Walks (src/rld/; docs/design/act2.md): the level played through in headless Chromium. Entering
// the walk, entering with the act's opening (tied up, the note, the Polaroids), a capture + escape,
// X-ray and a rescue, the perfume, a lead door + "Which one is hers?", and the asylum still opening.
//   node tools/shots/rld.js [--label rld] [--port 8897] [--flows all|walk,opening,trapped,capture,lead,asylum] [--w 844 --h 390] [--query '&rldcam=far']
// → shots/<label>/rld/*.png + report.json (errors per flow; draw calls/triangles per view)
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
const LABEL = arg('--label', 'rld'), PORT = +arg('--port', 8897), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const EXTRA = arg('--query', '');
const glOf = (V) => V.page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
const OUT = path.join(ROOT, 'shots', LABEL, 'rld');
const ALL = ['walk', 'opening', 'trapped', 'capture', 'lead', 'asylum'];
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
  const at = (V, s) => V.page.evaluate((s) => { const m = window.__game.mode; m.hero.position.set(s.x, 0, s.z); m.hero.rotation.y = s.yaw + Math.PI; m.yaw = s.yaw; m.camPitch = null; m._lastGood = null; }, s);
  const spots = (V) => V.page.evaluate(() => window.__game.mode.debugSpots());

  await flow('walk', async () => {
    const V = await game('zone=rldwalk&flight=2d');
    await ready(V);
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; });
    await V.page.waitForTimeout(2500);
    await V.shot('walk_arrival'); report.gl.walk_arrival = await glOf(V);
    const S = await spots(V);
    for (const s of S) { await at(V, s); await V.page.waitForTimeout(900); report.gl[s.name] = await glOf(V); if (s.name === 'captive_door') await V.shot('walk_captive_door'); }
    await at(V, S.find((q) => q.name === 'captive_door'));
    report.rescue = await V.page.evaluate(() => {
      const m = window.__game.mode, st = window.__game.state, cap = m.captives[0], rep0 = st.rep;
      m.setXray(true);
      const seen = cap.seen;
      m.openRedDoor(cap.room.doorRef);
      m.freeCaptive(cap);
      return { captives: m.captives.length, seen, freed: cap.freed, rep: st.rep - rep0 };
    });
    await V.page.waitForTimeout(900);
    await V.shot('walk_xray'); report.gl.walk_xray = await glOf(V);
    report.perfume = await V.page.evaluate(async () => {
      const m = window.__game.mode, st = window.__game.state, v = m.vents[0], i0 = st.intox;
      m.setXray(false);
      m.hero.position.set(v.pos.x, 0, v.pos.z); m.grace = 0; m.guards.forEach((gd) => { gd.ko = true; });
      await new Promise((r) => setTimeout(r, 9500));
      return { vents: m.vents.length, hostesses: m.hostesses.length, intox: st.intox - i0 };
    });
    return V;
  });

  await flow('opening', async () => {
    const V = await game('zone=rldwalk&opening=1&flight=2d');
    await ready(V);
    await V.page.waitForSelector('.c3-struggle', { timeout: 20000 });
    await V.page.waitForTimeout(800);
    await V.shot('opening_struggle');
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle') && !window.__game.mode.busy, null, { timeout: 40000 });
    await V.page.waitForTimeout(1200);
    await V.shot('opening_free'); report.gl.opening_free = await glOf(V);
    V.page.evaluate(() => window.__game.mode.readNote());
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    await V.shot('opening_note');
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    V.page.evaluate(() => window.__game.mode.seePolaroids());
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    await V.page.waitForTimeout(400);
    await V.shot('opening_polaroids');
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    report.opening = await V.page.evaluate(() => { const m = window.__game.mode; return { intox: window.__game.state.intox, clues: m.zone.clues, busy: m.busy }; });
    return V;
  });

  // the opening: the door's USE prompt beats the props on the floor; the third capture never throws
  // her out, it locks her in another room in front of 3 to 5 clips
  await flow('trapped', async () => {
    const V = await game('zone=rldwalk&opening=1&flight=2d');
    await ready(V);
    await V.page.waitForSelector('.c3-struggle', { timeout: 20000 });
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle') && !window.__game.mode.busy, null, { timeout: 40000 });
    report.trapped = await V.page.evaluate(async () => {
      const m = window.__game.mode, r = m.opening.room, out = {};
      // every spot on the inside of the door, across the doorway: what does USE pick?
      out.doorPicks = [];
      for (const s of [-0.4, -0.2, 0, 0.2, 0.4]) {
        const side = r.alongX ? [s, 0] : [0, s];
        m.hero.position.set(r.door.x + r.inward.x * 0.45 + side[0], 0, r.door.z + r.inward.z * 0.45 + side[1]);
        m.grace = 1e9;
        await new Promise((res) => setTimeout(res, 250));
        out.doorPicks.push(m.near?.label || null);
      }
      m.hero.position.copy(r.wake);
      return out;
    });
    await V.page.evaluate(() => { const m = window.__game.mode; m.captures = 2; window.__cuts = 0; new MutationObserver(() => { const on = document.querySelector('#cutscene').classList.contains('on'); if (on && !window.__was) window.__cuts++; window.__was = on; }).observe(document.querySelector('#cutscene'), { attributes: true }); m.capture('The minders spot you and close in.'); });
    await V.page.waitForSelector('#cutscene.on', { timeout: 15000 });
    await V.page.waitForTimeout(1500);
    await V.shot('trapped_clip');
    for (let i = 0; i < 12 && !(await V.page.evaluate(() => !!document.querySelector('.c3-struggle'))); i++) {
      await V.page.evaluate(() => { const c = document.querySelector('#cutscene'); if (c.classList.contains('on')) for (let k = 0; k < 4; k++) c.click(); });
      await V.page.waitForTimeout(700);
    }
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle') && !window.__game.mode.busy, null, { timeout: 40000 });
    await V.page.waitForTimeout(1500);
    await V.shot('trapped_after');
    Object.assign(report.trapped, await V.page.evaluate(() => { const m = window.__game.mode; return { clips: window.__cuts, captures: m.captures, done: m.done, mode: window.__game.modeName, room: m.lastWake?.num }; }));
    return V;
  });

  await flow('capture', async () => {
    const V = await game('zone=rldwalk&flight=2d');
    await ready(V);
    await V.page.waitForTimeout(1000);
    await V.page.evaluate(() => { const m = window.__game.mode; m.capture('The minders spot you and close in.'); });
    await V.page.waitForSelector('.c3-struggle', { timeout: 15000 });
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle') && !window.__game.mode.busy, null, { timeout: 40000 });
    await V.page.waitForTimeout(1500);
    await V.shot('capture_after');
    report.capture = await V.page.evaluate(() => { const m = window.__game.mode, h = m.hero.position; const r = m.club.rooms.find((q) => h.x > q.x0 && h.x < q.x1 && h.z > q.z0 && h.z < q.z1); return { captures: m.captures, inRoom: r?.num || null, doorOpen: r?.doorRef.open, alert: m.alert, done: m.done, mode: window.__game.modeName }; });
    return V;
  });

  await flow('lead', async () => {
    const V = await game('zone=rldwalk&flight=2d');
    await ready(V);
    await V.page.evaluate(() => { const g = window.__game; g.mode.grace = 1e9; g.state.rep = 5; });
    report.lead = {};
    V.page.evaluate(() => { const m = window.__game.mode; m.leadDoor(m.leadRooms[0]); });
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    report.lead.closedAtPositive = await V.page.evaluate(() => !window.__game.mode.leadRooms[0].open);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await V.page.evaluate(async () => { const g = window.__game, m = g.mode; g.state.rep = -50; g.state.intox = 45; await m.leadDoor(m.leadRooms[0]); });
    await V.page.waitForFunction(() => !!window.__game.mode.leadRooms[0].copies, null, { timeout: 15000 });
    await at(V, (await spots(V)).find((q) => q.name === 'lead_room'));
    await V.page.waitForTimeout(1200);
    await V.shot('lead_room'); report.gl.lead_room = await glOf(V);
    V.page.evaluate(() => { const m = window.__game.mode; m.pickPiece(m.leadRooms[0]); });
    await V.page.waitForSelector('.rld-which', { timeout: 5000 });
    await V.page.waitForTimeout(500);
    await V.shot('lead_which');
    await V.press('.opt.rld-c');
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    Object.assign(report.lead, await V.page.evaluate(() => { const m = window.__game.mode, L = m.leadRooms[0]; return { piece: L.piece, solved: L.solved, finds: m.zone.finds || [] }; }));
    return V;
  });

  await flow('asylum', async () => {
    const V = await game('flight=2d');
    await V.page.evaluate(() => { const g = window.__game; g.startZone(g.overworld.spawn('asylum', true)); });
    await V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'asylum' && m.scene && !m.warming; }, null, { timeout: 120000 });
    await V.page.waitForTimeout(2500);
    await V.shot('asylum'); report.gl.asylum = await glOf(V);
    report.asylum = { ...(report.asylum || {}), cells: await V.page.evaluate(() => window.__game.mode.club.cells.length) };
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
})();
