// The act (src/act/, src/hotel/; docs/design/act1.md): its screens and flows played through in
// headless Chromium. Story beats, the act board, a Polaroid call (right and wrong), an unmasking,
// an impostor sighting caught, and (with --flows hotel,ballroom) the 13th floor and its boss.
//   node tools/shots/act.js [--label act] [--port 8882] [--flows all|board,polaroid,unmask,sighting,hotel,ballroom] [--w 844 --h 390]
// → shots/<label>/act/*.png + report.json (errors per flow; fps is SwiftShader: compare runs only)
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
const LABEL = arg('--label', 'act'), PORT = +arg('--port', 8882), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const OUT = path.join(ROOT, 'shots', LABEL, 'act');
const ALL = ['board', 'trail', 'polaroid', 'unmask', 'sighting', 'tower', 'hotel', 'kell', 'seal', 'ballroom'];
const want = (f) => (FLOWS === 'all' ? ALL : FLOWS.split(',')).includes(f);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = {};

  async function game(query) {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/?${query}`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.evaluate(() => { const c = document.querySelector('#cutscene'); if (c) for (let i = 0; i < 4; i++) c.click(); }); // the intro
    await page.waitForTimeout(600);
    await page.click('#btn-new');
    await page.waitForTimeout(600);
    const top = () => page.evaluate(() => {
      const el = [...document.querySelectorAll('#modal-root .modal-back')].pop();
      return el ? el.innerText.slice(0, 200).replace(/\s+/g, ' ') : null;
    });
    /** Click the top modal's first button (dialogs, the call, the unmask panel, boards). */
    const press = (sel = '.opt, .spot-b, .um-go, .cb-close, button') => page.evaluate((sel) => {
      const el = [...document.querySelectorAll('#modal-root .modal-back')].pop();
      if (!el) return false;
      const b = el.querySelector(sel) || el.querySelector('button');
      if (b) b.click(); else el.click();
      return true;
    }, sel);
    const V = {
      page, errors, top, press,
      shot: (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }),
      /** Click through modals, papers and cutscenes until until() holds (or the time runs out). */
      async through(until = () => false, wait = 30000) {
        const t0 = Date.now();
        while (Date.now() - t0 < wait) {
          if (await page.evaluate(until)) return true;
          if (await top()) { await press(); await page.waitForTimeout(350); continue; }
          if (await page.evaluate(() => !!document.querySelector('#cutscene.on'))) { await page.evaluate(() => { const c = document.querySelector('#cutscene'); for (let i = 0; i < 4; i++) c.click(); }); await page.waitForTimeout(500); continue; }
          if (await page.evaluate(() => !!document.querySelector('.c3-struggle'))) { await page.waitForTimeout(500); continue; }
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
    report[name] = { ...(report[name] || {}), secs: Math.round((Date.now() - t0) / 1000), errors: V ? V.errors.slice(0, 12) : [] };
    console.log(name, JSON.stringify(report[name]));
    if (V) await V.close().catch(() => {});
  }

  await flow('board', async () => {
    const V = await game('act=guardian&flight=2d');
    // the beats queue up at once (start, local, guardian): play them through
    await V.page.waitForTimeout(1500);
    await V.through(() => window.__game.state.act?.beats?.guardian && !document.querySelector('#modal-root .modal-back'), 60000);
    await V.page.evaluate(() => { const A = window.__game.act.A; A.unmasked.fixer = true; A.unmasked.queen = true; A.fakes = 4; A.unsorted = 1; A.counts.clubs = 3; });
    V.page.evaluate(() => window.__game.act.openBoard());
    await V.page.waitForTimeout(900);
    await V.shot('board');
    await V.press('.ab-x');
    return V;
  });

  await flow('trail', async () => {
    const V = await game('act=guardian&flight=2d');
    await V.through(() => window.__game.state.act?.beats?.guardian && !document.querySelector('#modal-root .modal-back'), 60000);
    const name = await V.page.evaluate(() => {
      const g = window.__game, ow = g.overworld; let z = null;
      for (let i = 0; i < 40 && !(z && z.thread); i++) { if (z) ow.removeZone(z); z = ow.spawn('case', true); const r = Math.random; Math.random = () => 0.1; g.act.tagZone(z); Math.random = r; }
      window.__tz = z; return z.name;
    });
    V.page.evaluate(() => window.__game.act.onZoneWin(window.__tz));
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    await V.shot('trail_step');
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    report.trail = { name, trails: await V.page.evaluate(() => window.__game.state.act.trails) };
    return V;
  });

  await flow('polaroid', async () => {
    const V = await game('act=local&flight=2d');
    await V.through(() => window.__game.state.act?.beats?.local && !document.querySelector('#modal-root .modal-back'), 60000);
    V.page.evaluate(() => window.__game.act.callPolaroid({ fake: true, where: 'pinned to a lamp post' }));
    await V.page.waitForSelector('.spot', { timeout: 15000 });
    await V.page.waitForTimeout(500);
    await V.shot('polaroid_call');
    await V.press('.spot-b.real'); // wrong (if it was made a fake)
    await V.page.waitForTimeout(700);
    await V.shot('polaroid_wrong');
    await V.press('.spot-b');
    V.page.evaluate(() => window.__game.act.callPolaroid({ fake: true, where: 'in a newsstand rack' }));
    await V.page.waitForSelector('.spot', { timeout: 15000 });
    await V.page.waitForTimeout(400);
    await V.press('.spot-b.fake');
    await V.page.waitForTimeout(700);
    await V.shot('polaroid_right');
    await V.press('.spot-b');
    report.polaroid = { act: await V.page.evaluate(() => ({ fakes: window.__game.state.act.fakes, unsorted: window.__game.state.act.unsorted })) };
    return V;
  });

  await flow('unmask', async () => {
    const V = await game('act=guardian&flight=2d');
    await V.through(() => window.__game.state.act?.beats?.guardian && !document.querySelector('#modal-root .modal-back'), 60000);
    V.page.evaluate(async () => { const { LIEUTENANTS } = await import('/src/act/act1.js'); window.__game.act.unmask(LIEUTENANTS[1]); });
    await V.page.waitForSelector('.um', { timeout: 8000 });
    await V.page.waitForTimeout(900);
    await V.shot('unmask');
    await V.press('.um-go');
    return V;
  });

  await flow('sighting', async () => {
    const V = await game('act=guardian');
    await V.through(() => window.__game.state.act?.beats?.guardian && !document.querySelector('#modal-root .modal-back'), 60000);
    await V.page.evaluate(() => { window.__game.act.sightT = 0; });
    await V.page.waitForFunction(() => window.__game.overworld.zones.some((z) => z.impostor), null, { timeout: 10000 });
    const a = await V.page.evaluate(() => { const z = window.__game.overworld.zones.find((q) => q.impostor); return [z.x, z.y]; });
    await V.page.waitForTimeout(2000);
    const b = await V.page.evaluate(() => { const z = window.__game.overworld.zones.find((q) => q.impostor); return z ? [z.x, z.y] : null; });
    await V.shot('sighting');
    // fly onto her and dive
    await V.page.evaluate(() => { const ow = window.__game.overworld, z = ow.zones.find((q) => q.impostor); Object.assign(ow.hero, { x: z.x + 20, y: z.y }); ow.near = z; ow.tryDive(); });
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 8000 });
    await V.shot('sighting_caught');
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 15000);
    report.sighting = { moved: b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : null, impostor: await V.page.evaluate(() => !!window.__game.state.act.unmasked.impostor) };
    return V;
  });

  await flow('probe', async () => {
    const V = await game('act=lair');
    await V.through(() => window.__game.overworld.zones.some((z) => z.hotel) && !document.querySelector('#modal-root .modal-back'), 60000);
    report.probe = await V.page.evaluate(() => {
      const g = window.__game, ow = g.overworld, lm = ow.view3d.city3.landmarks.find((l) => l.hotel), z = ow.zones.find((q) => q.hotel);
      const blk = g.city.blocks.find((b) => b.hotel);
      return { lm: [lm.x, lm.y, lm.o.x, lm.o.y, lm.o.w, lm.o.d, lm.o.h3], zone: [z.x, z.y], blk: [blk.bx, blk.by, blk.x0, blk.y0], boxes: blk.b.filter((o) => o.kind === 'box').map((o) => [o.x, o.y, o.w, o.d, !!o.landmark]), hero: [ow.hero.x, ow.hero.y] };
    });
    return V;
  });

  await flow('tower', async () => {
    const V = await game('act=lair');
    await V.through(() => window.__game.overworld.zones.some((z) => z.hotel) && !document.querySelector('#modal-root .modal-back'), 60000);
    // night, south of the tower, facing it, then fly in
    await V.page.evaluate(() => {
      const g = window.__game, ow = g.overworld, lm = ow.view3d.city3.landmarks.find((l) => l.hotel);
      g.state.clock = 21 * 60;
      Object.assign(ow.hero, { x: lm.x + 60, y: lm.y + 1100, z: 150, band: 0, ang: -Math.PI / 2, vx: 0, vy: 0, speed: 0 });
      ow.cam.x = ow.hero.x; ow.cam.y = ow.hero.y; if (ow.view3d) ow.view3d.cam.yaw = ow.hero.ang;
    });
    await V.page.waitForTimeout(1500);
    await V.shot('tower_1_far');
    await V.page.keyboard.down('KeyW'); await V.page.waitForTimeout(1100); await V.page.keyboard.up('KeyW');
    await V.page.waitForTimeout(600);
    await V.shot('tower_2_near');
    report.towerProbe = await V.page.evaluate(() => {
      const ow = window.__game.overworld, lm = ow.view3d.city3.landmarks.find((l) => l.hotel), P = ow.view3d.projector();
      const band = ow.view3d.city3.hotelBand;
      return { hero: [ow.hero.x, ow.hero.y, ow.hero.z, ow.hero.ang], lm: [lm.x, lm.y], top: P.proj(lm.x, lm.y, 340), base: P.proj(lm.x, lm.y, 0), band: band && [band.position.x, band.position.y, band.position.z, band.visible], cam: ow.view3d.cam.cam.position.toArray().map(Math.round) };
    });
    return V;
  });

  await flow('hotel', async () => {
    const V = await game('act=lair');
    await V.through(() => window.__game.overworld.zones.some((z) => z.hotel) && !document.querySelector('#modal-root .modal-back'), 60000);
    await V.page.evaluate(() => { const g = window.__game, z = g.overworld.zones.find((q) => q.hotel); g.startZone(z); });
    await V.page.waitForFunction(() => { const m = window.__game.mode; return window.__game.modeName === 'hotel' && m.scene && !m.warming; }, null, { timeout: 120000 });
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; });
    await V.page.waitForTimeout(2500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await V.shot('hotel_arrival');
    for (const [i, spot] of (await V.page.evaluate(() => window.__game.mode.debugSpots())).entries()) {
      await V.page.evaluate((s) => { const m = window.__game.mode; m.hero.position.set(s.x, 0, s.z); m.yaw = s.yaw; }, spot);
      await V.page.waitForTimeout(1200);
      await V.shot(`hotel_${i + 1}_${spot.name}`);
    }
    report.hotelMem = await V.page.evaluate(() => ({ heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6), posters: window.__game.mode.posters.filter((p) => p.canvas).length, info: window.__game.mode.renderer.info.memory }));
    console.log('mem', JSON.stringify(report.hotelMem));
    // a poster call
    V.page.evaluate(() => { const m = window.__game.mode; m.examinePoster(m.posters.find((p) => p.canvas) || m.posters[0]); });
    await V.page.waitForSelector('.spot', { timeout: 20000 }).catch(() => {});
    await V.page.waitForTimeout(400);
    await V.shot('hotel_poster');
    await V.press('.spot-b.real'); await V.page.waitForTimeout(500);
    await V.shot('hotel_poster_called');
    await V.press('.spot-b');
    report.hotel = { fps: await V.page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(n / 2); }; requestAnimationFrame(tick); })) };
    return V;
  });

  /** Into the hotel (act=lair), past the arrival; resolves the helper bag. */
  async function hotel(query = 'act=lair') {
    const V = await game(query);
    await V.through(() => window.__game.overworld.zones.some((z) => z.hotel) && !document.querySelector('#modal-root .modal-back'), 60000);
    await V.page.evaluate(() => { const g = window.__game, z = g.overworld.zones.find((q) => q.hotel); g.startZone(z); });
    await V.page.waitForFunction(() => { const m = window.__game.mode; return window.__game.modeName === 'hotel' && m.scene && !m.warming; }, null, { timeout: 120000 });
    await V.page.waitForTimeout(1500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    return V;
  }

  await flow('kell', async () => {
    const V = await hotel();
    // Kell three metres in front of her, looking at her: he charges, fires, she's wiped
    await V.page.evaluate(() => {
      const m = window.__game.mode, k = m.kell, h = m.hero.position;
      m.grace = 0; m.hero.position.set(0, 0, -8); m.hero.rotation.y = Math.PI;
      k.mesh.position.set(0, 0, -11); k.mesh.rotation.y = 0; k.path = [];
    });
    await V.page.waitForTimeout(500);
    await V.shot('kell_charge');
    await V.page.waitForFunction(() => window.__game.mode.wiping, null, { timeout: 8000 });
    await V.page.waitForTimeout(800);
    await V.shot('kell_zap');
    await V.through(() => !window.__game.mode.wiping, 30000);
    await V.page.waitForTimeout(800);
    await V.shot('kell_woke');
    report.kell = await V.page.evaluate(() => { const m = window.__game.mode; return { wipes: m.wipes, room: m.wokeIn?.num, doorsOpen: m.doors.filter((d) => d.open).length, exp: [m.tagT, m.xrayLockT, m.sensT].map(Math.round) }; });
    return V;
  });

  await flow('seal', async () => {
    const V = await hotel();
    await V.page.evaluate(() => { const m = window.__game.mode, o = m.sealObjs[0]; m.hero.position.copy(o.pos).add({ x: o.pos.x < 0 ? 1.2 : -1.2, y: 0, z: 0 }); m.run ? 0 : 0; m.setSeal(o); });
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    await V.shot('seal_riddle');
    const ans = await V.page.evaluate(async () => { const { SEALS } = await import('/src/act/act1.js'); return SEALS[window.__game.mode.sealObjs[0].i].a; });
    await V.page.evaluate((ans) => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); [...el.querySelectorAll('.opt')].find((b) => b.innerText.includes(ans)).click(); }, ans);
    await V.page.waitForTimeout(800);
    await V.shot('seal_set');
    report.seal = await V.page.evaluate(() => ({ set: window.__game.mode.sealCount(), saved: JSON.parse(localStorage.getItem('sg-city-patrol-v1')).act.seals }));
    return V;
  });

  await flow('ballroom', async () => {
    const V = await game('act=boss');
    await V.through(() => window.__game.overworld.zones.some((z) => z.hotel) && !document.querySelector('#modal-root .modal-back'), 60000);
    await V.page.evaluate(() => { const g = window.__game, z = g.overworld.zones.find((q) => q.hotel); g.startZone(z); });
    await V.page.waitForFunction(() => { const m = window.__game.mode; return window.__game.modeName === 'hotel' && m.scene && !m.warming; }, null, { timeout: 120000 });
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; });
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await V.page.evaluate(() => window.__game.mode.debugBallroom());
    await V.page.waitForTimeout(2000);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await V.shot('ballroom_masquerade');
    await V.page.evaluate(() => window.__game.mode.debugBallroom('fight'));
    await V.page.waitForTimeout(2000);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await V.shot('ballroom_fight');
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
  console.log(`shots → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
