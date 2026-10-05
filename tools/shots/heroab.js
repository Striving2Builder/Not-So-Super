// Her sharp pass, A/B'd inside ONE page (no page-to-page noise): the flybench frozen pose per band,
// then each round renders the same frame under every hero-pass config (alternating order) and
// takes the median of 10 frames. Configs are [name, js] where js runs with v = the Flight3D view.
//
//   node tools/shots/heroab.js [--bands 1,2,p] (p = high band in the patrol view) [--rounds 6] [--port 8811] [--graphics auto|high|saver]
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('--port', 8811), ROUNDS = +arg('--rounds', 6), GFX = arg('--graphics', 'auto');
const BANDS = arg('--bands', '1,2,p').split(',');
const SHOTS = arg('--shots', null), CHECK = arg('--check', null);
const CONFIGS = JSON.parse(arg('--configs', JSON.stringify([
  ['p2', 'v.heroQ = null; v.noBox = true'],
  ['box', 'v.heroQ = null; v.noBox = false'],
  ['none', 'v.heroQ = [0, 0]; v.noBox = false'],
])));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).slice(1) || 'index.html', file = path.join(ROOT, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT);

async function open(browser, band) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(`(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
try { localStorage.setItem('supergirl-settings', JSON.stringify({ graphics: '${GFX}' })); } catch (e) {}`);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://localhost:${PORT}/?flight=3d&dynres=off`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('btn-new').click());
  await page.waitForFunction(() => document.querySelector('#modal-root .opt'), null, { timeout: 120000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('#modal-root .opt')?.click());
  const b = band === 'p' ? 2 : +band;
  await page.evaluate(async ([band, patrol]) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld'); ow.nav.autopilot = false; g.state.clock = 21 * 60;
    ow.hero.band = band; ow.view3d.patrolForced = patrol;
    window.__h0 = { x: ow.hero.x, y: ow.hero.y, ang: ow.hero.ang };
    const ax = g.input.axis.bind(g.input); g.input.axis = () => ({ x: 0.6, y: -0.8 });
  }, [b, band === 'p']);
  await page.waitForTimeout(3500);
  await page.evaluate(async () => { const { BANDS } = await import('/src/flight.js'); const h = window.__game.overworld.hero, h0 = window.__h0; window.__game.mode = null; h.ang = h0.ang; h.x = h0.x + 300 * Math.cos(h0.ang); h.y = h0.y + 300 * Math.sin(h0.ang); h.z = BANDS[h.band].z; h.speed = 260; h.vz = 0; });
  return page;
}
const fpsOf = (p, js) => p.evaluate((js) => {
  const ow = window.__game.overworld, v = ow.view3d, r = v.renderer, gl = r.getContext(), px = new Uint8Array(4);
  eval(js);
  const ctx = window.__bctx || (window.__bctx = document.createElement('canvas').getContext('2d'));
  const one = () => { ow.render(ctx); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < 4; i++) one();
  const ts = [];
  for (let i = 0; i < 10; i++) { const t0 = performance.now(); one(); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  return { ms: ts[5], calls: r.info.render.calls, box: v.heroPass.last ? v.heroPass.last.slice(0, 2).join('x') : '' };
}, js);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    for (const band of BANDS) {
      const page = await open(browser, band);
      const ms = CONFIGS.map(() => []), info = [];
      for (let r = 0; r < ROUNDS; r++) {
        const order = CONFIGS.map((_, i) => i); if (r % 2) order.reverse();
        for (const i of order) { const o = await fpsOf(page, CONFIGS[i][1]); ms[i].push(o.ms); info[i] = o; }
      }
      if (SHOTS) for (const [name, js] of CONFIGS) { // a crop round her per config (CSS px × 2)
        const hs = await page.evaluate((js) => { const ow = window.__game.overworld, v = ow.view3d; eval(js); ow.render(window.__bctx); ow.render(window.__bctx); return ow.heroScreen; }, js);
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `${band}_${name}.png`), clip: argv.includes('--full') ? undefined : { x: Math.max(0, hs.x - 90), y: Math.max(0, hs.y - 60), width: 180, height: 120 } });
      }
      if (CHECK) for (const [name, js] of CONFIGS) { // a js file that leaves its findings in window.__chk
        const res = await page.evaluate((js) => { eval(js); return window.__chk; }, js + ';' + fs.readFileSync(CHECK, 'utf8'));
        console.log(band, name, JSON.stringify(res));
      }
      const prof = await page.evaluate(async () => (await import('/src/settings.js')).quality().id);
      console.log(`band ${band} (${prof}):`);
      const base = ms[0].reduce((s, x) => s + x, 0) / ROUNDS;
      for (const [i, c] of CONFIGS.entries()) {
        const m = ms[i].reduce((s, x) => s + x, 0) / ROUNDS;
        console.log('  ', c[0].padEnd(10), (1000 / m).toFixed(2).padStart(6), 'fps', (m.toFixed(1) + ' ms').padStart(9), (base / m).toFixed(3), '×', String(info[i].calls).padStart(4), 'calls', 'rt', info[i].box);
      }
      await page.context().close();
    }
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
