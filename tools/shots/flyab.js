// 3D flight fps A/B across code variants, all pages open in one browser and measured round-robin
// (background load hits every variant equally). A variant is this checkout with an optional overlay
// folder (files in it replace the checkout's: e.g. a few src/ files from an older commit) and an
// optional snippet run in the page once flying (runtime toggles: profile keys, hidden meshes).
//
//   node tools/shots/flyab.js --variants "head;r7=shots/stabab/r7;taps2=|PROFILES.high.fly3dSharpTaps=2"
//        [--bands 0,1,2] [--rounds 6] [--port 8803] [--graphics high|auto|saver]
// Snippets see `g` (the game), `v` (Flight3D), `PROFILES` (settings.js). dynres is pinned (?dynres=off)
// so every variant renders the same pixel count.
const path = require('path');
const fs = require('fs');
const http = require('http');

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
const PORT = +arg('--port', 8803), ROUNDS = +arg('--rounds', 6), GFX = arg('--graphics', 'auto');
const BANDS = arg('--bands', '0,1,2').split(',').map(Number);
const VARIANTS = arg('--variants', 'head').split(';').filter(Boolean).map((s, i) => {
  const [name, rest = ''] = s.split('=');
  const [overlay, js] = rest.split('|');
  return { name, overlay: overlay ? path.resolve(ROOT, overlay) : null, js: js || '', port: PORT + i };
});
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
function serve(v) {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const rel = url === '/' ? 'index.html' : url.slice(1);
    const cands = [v.overlay && path.join(v.overlay, rel), path.join(ROOT, rel)].filter(Boolean);
    const file = cands.find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }).listen(v.port);
}
const INIT = `(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
try { localStorage.setItem('supergirl-settings', JSON.stringify({ graphics: '${GFX}' })); } catch (e) {}`;

async function open(browser, v, band) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', v.name, e.message));
  await page.goto(`http://localhost:${v.port}/?flight=3d&dynres=off`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('btn-new').click());
  await page.waitForFunction(() => document.querySelector('#modal-root .opt'), null, { timeout: 120000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('#modal-root .opt')?.click());
  await page.evaluate(async ([band, js]) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld'); ow.nav.autopilot = false; g.state.clock = 21 * 60;
    ow.hero.band = band;
    window.__axis = null;
    const ax = g.input.axis.bind(g.input);
    g.input.axis = () => window.__axis || ax();
    await new Promise((r) => setTimeout(r, 300));
    const v = ow.view3d, { PROFILES } = await import('/src/settings.js');
    if (js) eval(js);
    window.__profile = (await import('/src/settings.js')).quality().id;
  }, [band, v.js]);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__axis = { x: 0.6, y: -0.8 }; window.__m = window.__game.mode; window.__game.mode = null; }); // paused until measured
  return page;
}
const fpsOf = (p) => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));

(async () => {
  const servers = VARIANTS.map(serve);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const band of BANDS) {
      const pages = [];
      for (const v of VARIANTS) pages.push(await open(browser, v, band));
      const fps = VARIANTS.map(() => []);
      for (let r = 0; r < ROUNDS; r++) {
        const order = VARIANTS.map((_, i) => i); if (r % 2) order.reverse();
        for (const i of order) {
          const p = pages[i];
          await p.evaluate(() => { window.__game.mode = window.__m; });
          await p.waitForTimeout(300);
          fps[i].push(await fpsOf(p));
          await p.evaluate(() => { window.__game.mode = null; });
        }
      }
      const res = [];
      for (const [i, p] of pages.entries()) {
        await p.evaluate(() => { window.__game.mode = window.__m; });
        await p.waitForTimeout(400);
        const info = await p.evaluate(() => { const r = window.__game.overworld.renderer; return { profile: window.__profile, calls: r && r.info.render.calls, tris: r && r.info.render.triangles }; });
        const a = fps[i], mean = a.reduce((s, x) => s + x, 0) / a.length;
        res.push({ variant: VARIANTS[i].name, fps: +mean.toFixed(2), ...info });
        await p.context().close();
      }
      const base = res[0].fps;
      for (const r of res) r.vsFirst = +(r.fps / base).toFixed(3);
      out[band] = res;
      console.log(`band ${band}:`);
      for (const r of res) console.log('  ', r.variant.padEnd(12), String(r.fps).padStart(6), 'fps', String(r.vsFirst).padStart(6), '×', String(r.calls).padStart(5), 'calls', String(r.tris).padStart(8), 'tris', r.profile);
    }
  } finally { await browser.close(); servers.forEach((s) => s.close()); }
  const f = arg('--out', null);
  if (f) fs.writeFileSync(f, JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
