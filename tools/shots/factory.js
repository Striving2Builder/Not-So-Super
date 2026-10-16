// The Super Squirt factory (src/factory/; docs/design/act2.md "The factory production lines") played
// through in headless Chromium: entering, a locked lever, the four keys and levers, the walk out (the
// act's factory gate counts it); a trap + the struggle and a dart (she wakes in a bay, a lever back in
// the red); the act keeping a factory line on the map while the gate is short.
//   node tools/shots/factory.js [--label factory] [--port 8898] [--flows all|lines,dart,map,reach] [--w 844 --h 390] [--shots 0]
// -> shots/<label>/factory/*.png + report.json (errors per flow; draw calls/triangles per view)
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
const LABEL = arg('--label', 'factory'), PORT = +arg('--port', 8898), FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390);
const EXTRA = arg('--query', '');
const SHOTS = arg('--shots', '1') !== '0';
const glOf = (V) => V.page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
const OUT = path.join(ROOT, 'shots', LABEL, 'factory');
const ALL = ['lines', 'dart', 'map', 'reach'];
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
  const ready = (V) => V.page.waitForFunction(() => { const g = window.__game, m = g.mode; return g.modeName === 'factory' && m.scene && !m.warming && m.hero; }, null, { timeout: 120000 });
  const at = (V, s) => V.page.evaluate((s) => { const m = window.__game.mode; m.hero.position.set(s.x, 0, s.z); m.hero.rotation.y = s.yaw + Math.PI; m.yaw = s.yaw; m.camPitch = null; m._lastGood = null; }, s);

  await flow('lines', async () => {
    const V = await game('zone=factory&act=act2lair&flight=2d');
    await ready(V);
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; window.__game.state.act.act2.counts.factory = 0; });
    await V.page.waitForTimeout(2500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    await shot(V, 'arrival'); report.gl.arrival = await glOf(V);
    for (const s of await V.page.evaluate(() => window.__game.mode.debugSpots())) {
      await at(V, s); await V.page.waitForTimeout(900); report.gl[s.name] = await glOf(V);
      if (s.name === 'line_mixing') await shot(V, 'line_mixing');
    }
    // a lever without its key: the padlock
    V.page.evaluate(() => { const m = window.__game.mode; m.throwLever(m.leverObjs[0]); }).catch(() => {});
    await V.page.waitForSelector('#modal-root .modal-back', { timeout: 5000 });
    report.locked = { text: (await V.top()).slice(0, 80), on: await V.page.evaluate(() => window.__game.mode.leverObjs[0].on) };
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
    // the four keys (their real interactions), the four levers
    report.lines = await V.page.evaluate(async () => {
      const m = window.__game.mode, out = { keys: 0 };
      for (const it of m.inter.filter((q) => /^Take the key/.test(q.label))) { await it.act(); out.keys++; }
      for (const o of m.leverObjs) { m.hero.position.copy(o.pos).add({ x: o.pos.x < 0 ? 1.2 : -1.2, y: 0, z: 0 }); await m.throwLever(o); }
      out.down = m.linesDown(); out.allDone = m.allDone(); out.workers = m.workers.length; out.hunters = m.hunters.length;
      return out;
    });
    await V.page.waitForTimeout(600);
    const lv = await V.page.evaluate(() => window.__game.mode.debugSpots().find((s) => s.name === 'lever_packing'));
    await at(V, lv); await V.page.waitForTimeout(900);
    await shot(V, 'lever_green');
    // walk out: onto the green ring
    await V.page.evaluate(() => { const m = window.__game.mode, e = m.exitRing.position; m.hero.position.set(e.x, 0, e.z); });
    await V.through(() => window.__game.modeName === 'overworld' && !document.querySelector('#modal-root .modal-back') && window.__game.state.act.act2.counts.factory > 0, 40000);
    report.win = await V.page.evaluate(() => ({ mode: window.__game.modeName, factory: window.__game.state.act.act2.counts.factory }));
    if (report.win.factory !== 1) throw new Error(`the factory gate didn't count the win: ${JSON.stringify(report.win)}`);
    return V;
  });

  await flow('dart', async () => {
    const V = await game('zone=factory&act=act2lair&flight=2d');
    await ready(V);
    await V.page.evaluate(() => { window.__game.mode.grace = 1e9; });
    await V.page.waitForTimeout(2000);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 8000);
    // a trap: take the sample, the struggle, win it
    V.page.evaluate(() => { const m = window.__game.mode, t = m.trapObjs[0]; m.hero.position.set(t.r.cx, 0, t.r.cz); m.springTrap(t); }).catch(() => {});
    await V.page.waitForFunction(() => document.querySelector('.c3-struggle') && window.__struggle, null, { timeout: 20000 });
    await V.page.waitForTimeout(700);
    await shot(V, 'struggle');
    await V.page.evaluate(() => window.__struggle.win());
    await V.page.waitForFunction(() => !document.querySelector('.c3-struggle'), null, { timeout: 8000 });
    await V.page.waitForTimeout(300);
    report.trap = await V.page.evaluate(() => ({ samples: window.__game.mode.samples, sprung: window.__game.mode.trapObjs[0].sprung }));
    // one lever green, then the foreman three metres in front of her: he charges, fires, she's darted
    await V.page.evaluate(() => {
      const m = window.__game.mode, o = m.leverObjs[1]; m.keys[o.i] = true; m.throwLever(o);
      const k = m.hunters[0];
      for (const q of m.hunters.slice(1)) q.stun = 1e9;
      for (const w of m.workers) w.stun = 1e9;
      m.grace = 0; m.hero.position.set(0, 0, -8); m.hero.rotation.y = Math.PI;
      k.mesh.position.set(0, 0, -11); k.mesh.rotation.y = 0; k.path = []; k.state = 'patrol';
    });
    await V.page.waitForFunction(() => window.__game.mode.wiping, null, { timeout: 10000 });
    await V.through(() => !window.__game.mode.wiping, 40000);
    await V.page.waitForTimeout(800);
    await shot(V, 'woke');
    report.dart = await V.page.evaluate(() => { const m = window.__game.mode; return { darts: m.darts, bay: m.wokeIn?.num, doorsOpen: m.doors.filter((d) => d.open).length, down: m.linesDown(), unlocked: m.leverObjs[1].unlocked, intox: Math.round(window.__game.state.intox) }; });
    if (report.dart.darts !== 1 || report.dart.down !== 0) throw new Error(`the dart didn't land as designed: ${JSON.stringify(report.dart)}`);
    return V;
  });

  await flow('map', async () => {
    const V = await game('act=act2lair&flight=2d');
    await V.page.evaluate(() => { window.__game.state.act.act2.counts.factory = 0; });
    await V.through(() => window.__game.overworld.zones.some((z) => z.mode === 'factory') && !document.querySelector('#modal-root .modal-back'), 40000);
    report.map = await V.page.evaluate(() => { const z = window.__game.overworld.zones.filter((q) => q.mode === 'factory'); return { n: z.length, district: z[0]?.district, gate: z[0]?.actGate }; });
    if (report.map.n !== 1 || report.map.district !== 'factory') throw new Error(`no factory line on the map: ${JSON.stringify(report.map)}`);
    return V;
  });

  await flow('reach', async () => {
    // every interaction and every hunter's graph node within reach of the floor she can walk to
    const V = await game('zone=factory&flight=2d');
    await ready(V);
    report.reach = await V.page.evaluate(() => {
      // walk her capsule (the game's own collide) along a route; how far from the goal she ends up
      const m = window.__game.mode, far = [];
      for (const d of m.doors) m.openDoor(d, true);
      for (const d of m.doors) d.col.disabled = true;
      const walk = (pts, r = 0.38) => {
        const p = pts[0].clone(); p.y = 0; m._lastGood = null;
        for (const q of pts.slice(1)) for (let i = 0; i < 400; i++) {
          const dx = q.x - p.x, dz = q.z - p.z, rem = Math.hypot(dx, dz);
          if (rem < 0.05) break;
          const st = Math.min(0.08, rem); p.x += (dx / rem) * st; p.z += (dz / rem) * st;
          m.collide(p, r);
        }
        const g = pts[pts.length - 1]; return Math.hypot(g.x - p.x, g.z - p.z);
      };
      const V3 = (x, z) => m.hero.position.clone().set(x, 0, z);
      for (const r of m.club.rooms) {
        const out = V3(r.door.x - r.inward.x * 1.2, r.door.z - r.inward.z * 1.2), inn = V3(r.door.x + r.inward.x * 0.9, r.door.z + r.inward.z * 0.9);
        for (const o of m.inter) {
          if (!(o.pos.x > r.x0 && o.pos.x < r.x1 && o.pos.z > r.z0 && o.pos.z < r.z1)) continue;
          const d = walk([out, inn, o.pos]); if (d > 1.6) far.push(`${r.num} ${o.label} ${d.toFixed(2)}`);
        }
      }
      for (const L of m.leverObjs) {
        const w = m.club.wings.find((q) => q.id === L.line), s = w.side;
        const d = walk([V3(0, w.zc), V3(s * 2.4, w.zc), V3(s * 2.7, w.zc + 1.6), V3(s * 14.6, w.zc + 1.6), L.pos]); if (d > 1.6) far.push(`lever ${L.name} ${d.toFixed(2)}`);
      }
      for (const n of m.kellNodes) for (const q of n.nb) { const d = walk([n.p, q.p], 0.3); if (d > 0.3) far.push(`edge ${n.rect} ${n.p.x.toFixed(1)},${n.p.z.toFixed(1)} -> ${q.p.x.toFixed(1)},${q.p.z.toFixed(1)} ${d.toFixed(2)}`); }
      return { inter: m.inter.length, nodes: m.kellNodes.length, far };
    });
    if (report.reach.far.length) throw new Error(`out of reach: ${report.reach.far.join(' | ')}`);
    // a worker who sees her shouts, and the nearest hunter comes running; a punch from behind puts him down
    await V.page.evaluate(() => {
      const m = window.__game.mode, w = m.workers[0], f = w.mesh.rotation.y;
      for (const d of m.doors) d.col.disabled = d.open = false;
      m.grace = 0; m.hero.position.set(w.mesh.position.x + Math.sin(f) * 2, 0, w.mesh.position.z + Math.cos(f) * 2);
      for (const k of m.hunters) k.mesh.position.set(0, 0, 3); // (all in the dock, out of sight)
    });
    await V.page.waitForTimeout(600);
    report.shout = await V.page.evaluate(() => { const m = window.__game.mode, w = m.workers[0]; const r = { shoutT: Math.round(w.shoutT), hunting: m.hunters.filter((k) => k.state === 'hunt').length }; m.hero.position.copy(w.mesh.position).add({ x: -Math.sin(w.mesh.rotation.y) * 1.0, y: 0, z: -Math.cos(w.mesh.rotation.y) * 1.0 }); m.hero.rotation.y = w.mesh.rotation.y; r.punched = m.punchCrew(); r.stun = Math.round(w.stun); return r; });
    if (!report.shout.shoutT || !report.shout.hunting || !report.shout.punched) throw new Error(`the worker didn't raise the alarm / go down: ${JSON.stringify(report.shout)}`);
    return V;
  });

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  srv.kill();
})();
