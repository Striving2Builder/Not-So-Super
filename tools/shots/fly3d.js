// Measurements for the three.js flight slice vs today's 2D flight (same city seed, same paths):
//   fps     2D and 3D pages interleaved in one browser (1.2 s samples, round-robin), per band
//   calls / triangles of the 3D frame
//   beams   from high patrol, hovering: % of incidents within 1.5 km whose icon is on screen
//           in at least one of 8 camera headings (the overlay draws icons over everything)
//   wayp.   time for autopilot to reach a waypoint ~1.2 km away at cruise (2D vs 3D city)
// Output: shots/fly3d/metrics.json + summary.md.   node tools/shots/fly3d.js [--port 8131] [--rounds 6]
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
const PORT = +arg('--port', 8131), ROUNDS = +arg('--rounds', 6);
const OUT = path.join(ROOT, 'shots', 'fly3d');
const INIT = `(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

async function open(browser, three, band) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', three ? '3d' : '2d', e.message));
  await page.goto(`http://localhost:${PORT}/${three ? '?flight=3d' : ''}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(500);
  await page.click('#btn-new'); await page.waitForTimeout(500);
  const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
  await page.evaluate((band) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld'); ow.nav.autopilot = false; g.state.clock = 21 * 60;
    ow.hero.band = band;
    window.__axis = null;
    const ax = g.input.axis.bind(g.input);
    g.input.axis = () => window.__axis || ax();
  }, band);
  await page.waitForTimeout(3500); // settle into the band
  return page;
}

const fpsOf = (p) => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1200) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));

async function fpsAB(browser, band) {
  const pages = [await open(browser, false, band), await open(browser, true, band)];
  for (const p of pages) await p.evaluate(() => { window.__axis = { x: 0.6, y: -0.8 }; window.__m = window.__game.mode; window.__game.mode = null; });
  const out = [[], []];
  for (let r = 0; r < ROUNDS; r++) for (let i = 0; i < 2; i++) {
    const p = pages[i];
    await p.evaluate(() => { window.__game.mode = window.__m; });
    await p.waitForTimeout(250);
    out[i].push(await fpsOf(p));
    await p.evaluate(() => { window.__game.mode = null; });
  }
  await pages[1].evaluate(() => { window.__game.mode = window.__m; });
  await pages[1].waitForTimeout(400);
  const info = await pages[1].evaluate(() => { const r = window.__game.overworld.renderer; return r ? { calls: r.info.render.calls, triangles: r.info.render.triangles } : {}; });
  for (const p of pages) await p.context().close();
  const m = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1);
  return { fps2d: m(out[0]), fps3d: m(out[1]), ratio: +(m(out[1]) / m(out[0])).toFixed(2), ...info };
}

async function beams(browser) {
  const page = await open(browser, true, 2);
  const res = await page.evaluate(async () => {
    const g = window.__game, ow = g.overworld, v = ow.view3d, h = ow.hero;
    v.patrolForced = false;
    const near = ow.zones.filter((z) => Math.hypot(z.x - h.x, z.y - h.y) * 0.5 < 1500);
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      v.cam.orbit = (i / 8) * Math.PI * 2 - v.cam.yaw + h.ang; // look round her
      await new Promise((r) => setTimeout(r, 450));
      const P = v.projector();
      for (const z of near) {
        const [x, y, front] = P.proj(z.x, z.y, 420 / 0.5 * 0.55);
        if (front && x > 0 && y > 0 && x < g.w && y < g.h) seen.add(z.uid);
      }
    }
    return { incidentsWithin1500m: near.length, seenFromAltitude: seen.size };
  });
  await page.context().close();
  return { ...res, pct: res.incidentsWithin1500m ? Math.round((100 * res.seenFromAltitude) / res.incidentsWithin1500m) : null };
}

async function waypoint(browser, three) {
  const page = await open(browser, three, 1);
  const t = await page.evaluate(async () => {
    const g = window.__game, ow = g.overworld, h = ow.hero;
    // a fixed spot ~1.2 km (2400 units) north-east of her, clamped inside the city
    const x = Math.min(g.city.coastX - 300, h.x + 1700), y = Math.max(300, h.y - 1700);
    ow.nav.set({ x, y, name: 'test' }); ow.nav.autopilot = true; window.__axis = { x: 0, y: 0 };
    const t0 = performance.now();
    return await new Promise((res) => {
      const iv = setInterval(() => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < 140 || !ow.nav.target) { clearInterval(iv); res((performance.now() - t0) / 1000); }
        else if (performance.now() - t0 > 60000) { clearInterval(iv); res(null); }
      }, 50);
    });
  });
  await page.context().close();
  return t;
}

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const M = { fps: {} };
  try {
    for (const [name, band] of [['skim', 0], ['cruise', 1], ['high', 2]]) { M.fps[name] = await fpsAB(browser, band); console.log(name, JSON.stringify(M.fps[name])); }
    M.beams = await beams(browser); console.log('beams', JSON.stringify(M.beams));
    M.waypoint = { t2d: await waypoint(browser, false), t3d: await waypoint(browser, true) }; console.log('waypoint', JSON.stringify(M.waypoint));
  } finally { await browser.close(); srv.kill(); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(M, null, 2));
  let md = '# 3D flight slice vs 2D flight\n\nSoftware rendering (SwiftShader): fps is only meaningful as a 2D-vs-3D ratio (pages interleaved).\n\n| band | fps 2D | fps 3D | 3D / 2D | draw calls | triangles |\n|---|---|---|---|---|---|\n';
  for (const [b, r] of Object.entries(M.fps)) md += `| ${b} | ${r.fps2d} | ${r.fps3d} | ${r.ratio} | ${r.calls ?? '-'} | ${r.triangles ?? '-'} |\n`;
  md += `\n**Incident beams from high patrol:** ${M.beams.seenFromAltitude}/${M.beams.incidentsWithin1500m} incidents within 1.5 km visible (${M.beams.pct}%) over 8 headings.\n`;
  md += `\n**Time to a waypoint ~1.2 km away (autopilot, cruise):** 2D ${M.waypoint.t2d?.toFixed(1)} s · 3D ${M.waypoint.t3d?.toFixed(1)} s.\n`;
  fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  console.log('\n' + md);
})().catch((e) => { console.error(e); process.exit(1); });
