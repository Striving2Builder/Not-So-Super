// The hotel's hall of mirrors (src/mirrors/; job H1, docs/polish/handoff/act2-h1.md) played through in
// headless Chromium: entering, the views (draw calls), her twin in the glass, a portrait call, a rail
// (Which one is hers?), the shrine's stash, the sealed door; a trap + the struggle and a dart (she wakes
// in a room); the act putting the floor on the hotel once the lair is open; everything within reach.
//   node tools/shots/mirrors.js [--label mirrors] [--port 8897] [--flows all|floor,dart,map,reach] [--w 844 --h 390] [--shots 0]
// -> shots/<label>/mirrors/*.png + report.json (errors per flow; draw calls/triangles per view)
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
const LABEL = arg('--label', 'mirrors'), PORT = +arg('--port', 8897), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const EXTRA = arg('--query', '');
const SHOTS = arg('--shots', '1') !== '0';
const glOf = (V) => V.page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
const OUT = path.join(ROOT, 'shots', LABEL, 'mirrors');
const ALL = ['floor', 'dart', 'map', 'reach'];
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

  const shot = (V, n) => (SHOTS ? V.shot(n) : null);
  const ready = (V) => V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'mirrors' && m.scene && !m.warming && m.hero; }, null, { timeout: 120000 });
  const at = (V, s) => V.page.evaluate((s) => { const m = window.__game.mode; m.hero.position.set(s.x, 0, s.z); m.hero.rotation.y = s.yaw + Math.PI; m.yaw = s.yaw; m.camPitch = null; m._lastGood = null; }, s);
  const calm = (V) => V.page.evaluate(() => { const m = window.__game.mode; m.grace = 1e9; for (const k of m.hunters) k.stun = 1e9; });

  await flow('floor', async () => {
    const V = await game('zone=mirrors&act=act2lair&flight=2d');
    await ready(V);
    await calm(V);
    await V.page.waitForTimeout(2500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    report.gl.arrival = await glOf(V);
    for (const s of await V.page.evaluate(() => window.__game.mode.debugSpots())) {
      await at(V, s); await V.page.waitForTimeout(900); report.gl[s.name] = await glOf(V);
      if (s.name === 'mirror') {
        report.twin = await V.page.evaluate(() => { const m = window.__game.mode, t = m.twins[0]; return { twins: m.twins.length, visible: !!t?.t.holder.visible, x: t ? +t.t.holder.matrix.elements[12].toFixed(2) : null }; });
        await shot(V, 'mirror');
      }
      if (s.name === 'gallery') await shot(V, 'gallery');
    }
    if (!report.twin.visible) throw new Error(`no twin in the glass: ${JSON.stringify(report.twin)}`);
    // a portrait: Supergirl or Impostor?
    await V.page.waitForFunction(() => window.__game.mode.portraits.every((p) => p.canvas), null, { timeout: 30000 });
    V.page.evaluate(() => { const m = window.__game.mode; m.callPortrait(m.portraits[0]); }).catch(() => {});
    await V.page.waitForSelector('.spot-b.real', { timeout: 8000 });
    await V.page.click('.spot-b.real'); await V.page.waitForTimeout(300); await V.page.click('.spot-b.next');
    await V.page.waitForTimeout(300);
    // a rail: Which one is hers? (the first card)
    await V.page.waitForFunction(() => window.__game.mode.rails.every((L) => L.copies), null, { timeout: 30000 });
    V.page.evaluate(() => { const m = window.__game.mode; m.pickPiece(m.rails[0]); }).catch(() => {});
    await V.page.waitForSelector('#modal-root .opt.rld-c', { timeout: 8000 });
    await V.press('.opt.rld-c');
    await V.through(() => window.__game.mode.rails[0].solved && !document.querySelector('#modal-root .modal-back'), 15000);
    // the shrine's stash, and the sealed door
    report.floor = await V.page.evaluate(async () => {
      const m = window.__game.mode, st = window.__game.state, i0 = st.intox;
      const stash = m.inter.find((q) => /^Take it: super squirt/i.test(q.label));
      await stash.act();
      const clue = m.inter.some((q) => q.tag === 'clue' && q.recall);
      return { called: m.called, rail: m.rails[0].solved, intox: Math.round(st.intox - i0), clue, rooms: m.club.rooms.length, mirrors: m.club.mirrors.length, portraits: m.portraits.length, traps: m.trapObjs.length };
    });
    await V.through(() => !document.querySelector('#modal-root .modal-back') && !document.querySelector('#cutscene.on'), 15000);
    const sd = await V.page.evaluate(() => window.__game.mode.debugSpots().find((s) => s.name === 'sealed_door'));
    await at(V, sd); await V.page.waitForTimeout(900);
    await shot(V, 'sealed_door');
    V.page.evaluate(() => window.__game.mode.bossDoor()).catch(() => {});
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    report.floor.door = (await V.top()).slice(0, 60);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
    report.floor.reached = await V.page.evaluate(() => window.__game.mode.reached);
    if (report.floor.called !== 1 || !report.floor.rail || !report.floor.reached || report.floor.intox <= 0 || !report.floor.clue) throw new Error(`the floor didn't play: ${JSON.stringify(report.floor)}`);
    // leave by the elevator
    V.page.evaluate(() => window.__game.mode.leave()).catch(() => {});
    await V.page.waitForSelector('#modal-root .opt', { timeout: 5000 });
    await V.press('.opt');
    await V.through(() => window.__game.modeName === 'overworld' && !document.querySelector('#modal-root .modal-back'), 30000);
    return V;
  });

  await flow('dart', async () => {
    const V = await game('zone=mirrors&act=act2lair&flight=2d');
    await ready(V);
    await calm(V);
    await V.page.waitForTimeout(2000);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    V.page.evaluate(() => { const m = window.__game.mode, t = m.trapObjs[0]; m.hero.position.set(t.r.cx, 0, t.r.cz); m.springTrap(t); }).catch(() => {});
    await V.page.waitForFunction(() => document.querySelector('.c3-struggle') && window.__struggle, null, { timeout: 20000 });
    await V.page.waitForTimeout(700);
    await shot(V, 'struggle');
    await V.page.evaluate(() => window.__struggle.win());
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle'), null, { timeout: 8000 });
    await V.page.waitForTimeout(300);
    report.trap = await V.page.evaluate(() => ({ polaroids: window.__game.mode.polaroids, sprung: window.__game.mode.trapObjs[0].sprung }));
    if (report.trap.polaroids !== 1) throw new Error(`the trap didn't play: ${JSON.stringify(report.trap)}`);
    // the High Acolyte three metres in front of her: she charges, fires, Supergirl is darted
    await V.page.evaluate(() => {
      const m = window.__game.mode, k = m.hunters[0];
      for (const q of m.hunters) q.stun = 0;
      for (const q of m.hunters.slice(1)) q.stun = 1e9;
      m.grace = 0; m.hero.position.set(0, 0, -12); m.hero.rotation.y = Math.PI;
      k.mesh.position.set(0, 0, -15); k.mesh.rotation.y = 0; k.path = []; k.state = 'patrol';
    });
    await V.page.waitForFunction(() => window.__game.mode.wiping, null, { timeout: 10000 });
    await V.through(() => !window.__game.mode.wiping, 40000);
    await V.page.waitForTimeout(800);
    report.dart = await V.page.evaluate(() => { const m = window.__game.mode; return { darts: m.darts, room: m.wokeIn?.num, doorsOpen: m.doors.filter((d) => d.open).length, intox: Math.round(window.__game.state.intox) }; });
    if (report.dart.darts !== 1 || report.dart.doorsOpen) throw new Error(`the dart didn't land as designed: ${JSON.stringify(report.dart)}`);
    return V;
  });

  await flow('map', async () => {
    const V = await game('act=act2lair&flight=2d');
    await V.through(() => window.__game.overworld.zones.some((z) => z.mode === 'mirrors') && !document.querySelector('#modal-root .modal-back'), 40000);
    report.map = await V.page.evaluate(() => { const zs = window.__game.overworld.zones; const z = zs.filter((q) => q.mode === 'mirrors'); return { n: z.length, district: z[0]?.district, act1Hotel: zs.filter((q) => q.hotel).length }; });
    if (report.map.n !== 1 || report.map.act1Hotel) throw new Error(`the hall of mirrors isn't on the hotel: ${JSON.stringify(report.map)}`);
    return V;
  });

  await flow('reach', async () => {
    const V = await game('zone=mirrors&act=act2lair&flight=2d');
    await ready(V);
    report.reach = await V.page.evaluate(() => {
      const m = window.__game.mode, far = [];
      for (const d of m.doors) m.openDoor(d, true);
      for (const d of m.doors) d.col.disabled = true;
      const walk = (pts, r = 0.38) => {
        const p = pts[0].clone(); p.y = 0; m._lastGood = null;
        for (const q of pts.slice(1)) for (let i = 0; i < 600; i++) {
          const dx = q.x - p.x, dz = q.z - p.z, rem = Math.hypot(dx, dz);
          if (rem < 0.05) break;
          const st = Math.min(0.08, rem); p.x += (dx / rem) * st; p.z += (dz / rem) * st;
          m.collide(p, r);
        }
        const g = pts[pts.length - 1]; return Math.hypot(g.x - p.x, g.z - p.z);
      };
      const V3 = (x, z) => m.hero.position.clone().set(x, 0, z);
      const inRoom = (o) => m.club.rooms.find((r) => o.pos.x > r.x0 && o.pos.x < r.x1 && o.pos.z > r.z0 && o.pos.z < r.z1);
      for (const o of m.inter) {
        const r = inRoom(o);
        const d = r ? walk([V3(0, r.door.z), V3(r.door.x - r.inward.x * 1.0, r.door.z), V3(r.door.x + r.inward.x * 0.9, r.door.z), o.pos]) : walk([V3(0, 3), V3(0, Math.max(o.pos.z, -36)), o.pos]);
        if (d > 1.6) far.push(`${r ? r.num : 'hall'} ${o.label} ${d.toFixed(2)}`);
      }
      // the glass: she can't walk into her reflection
      for (const mi of m.club.mirrors) { const d = walk([V3(0, mi.zc), V3(mi.x - mi.n.x * 1.5, mi.zc)]); if (d < 1.2) far.push(`walked into mirror ${mi.i}`); }
      for (const n of m.kellNodes) for (const q of n.nb) { const d = walk([n.p, q.p], 0.3); if (d > 0.3) far.push(`edge ${n.rect} ${n.p.x.toFixed(1)},${n.p.z.toFixed(1)} -> ${q.p.x.toFixed(1)},${q.p.z.toFixed(1)} ${d.toFixed(2)}`); }
      return { inter: m.inter.length, nodes: m.kellNodes.length, far };
    });
    if (report.reach.far.length) throw new Error(`out of reach: ${report.reach.far.join(' | ')}`);
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
})();
