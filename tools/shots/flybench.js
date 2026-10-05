// 3D flight fps A/B across code variants at a FROZEN pose (flyab.js measures live flight, which
// swings ±8% between pages here: each page's sim advances by its own frame count, so altitude,
// position and what's in view differ). Each page settles in its band, then the hero is pinned to
// the same spot / heading / band altitude / speed and the sim stops; a round renders that one
// frame 10 times (synced with a 1-pixel readPixels) and takes the median. Rounds alternate order.
// Same frame on every page (calls/tris match); page-to-page noise ~±4% (run the head twice to see).
//
//   node tools/shots/flybench.js --variants "head;base=<dir with an old src/>;head2=<empty dir>"
//        [--bands 0,1,2] [--rounds 6] [--port 8803] [--graphics high|auto|saver] [--noclouds]
// Variants and overlays as in flyab.js. --noclouds hides the cloud deck (city cost alone).
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
try { localStorage.setItem('supergirl-settings', JSON.stringify({ graphics: '${GFX}' })); } catch (e) {}
window.__noclouds = ${argv.includes('--noclouds')};`;

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
    window.__axis = null; window.__h0 = { x: ow.hero.x, y: ow.hero.y, ang: ow.hero.ang };
    const ax = g.input.axis.bind(g.input);
    g.input.axis = () => window.__axis || ax();
    await new Promise((r) => setTimeout(r, 300));
    const v = ow.view3d, { PROFILES } = await import('/src/settings.js');
    if (js) eval(js);
    window.__profile = (await import('/src/settings.js')).quality().id;
    window.__axis = { x: 0.6, y: -0.8 };
  }, [band, v.js]);
  await page.waitForTimeout(3500);
  // frozen pose: back to the start spot (same for every variant), heading kept, camera settled
  await page.evaluate(async () => { const { BANDS } = await import('/src/flight.js'); const h = window.__game.overworld.hero, h0 = window.__h0; window.__m = window.__game.mode; window.__game.mode = null; h.ang = h0.ang; h.x = h0.x + 300 * Math.cos(h0.ang); h.y = h0.y + 300 * Math.sin(h0.ang); h.z = BANDS[h.band].z; h.speed = 260; h.vz = 0; });
  return page;
}
const fpsOf = (p) => p.evaluate(() => {
  const ow = window.__game.overworld, v = ow.view3d, r = v.renderer, gl = r.getContext(), px = new Uint8Array(4);
  const ctx = window.__bctx || (window.__bctx = document.createElement('canvas').getContext('2d'));

  if (window.__noclouds) v.sky.clouds.onBeforeRender = function () { this.visible = false; };
  const one = () => { if (window.__noclouds) v.sky.clouds.visible = false; ow.render(ctx); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < (window.__warm ? 2 : 20); i++) one(); window.__warm = 1;
  const ts = [];
  for (let i = 0; i < 10; i++) { const t0 = performance.now(); one(); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  window.__fi = { calls: r.info.render.calls, tris: r.info.render.triangles };
  return 1000 / ts[5]; // median frame → fps
});

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
          fps[i].push(await fpsOf(p));
        }
      }
      const res = [];
      for (const [i, p] of pages.entries()) {
        const info = await p.evaluate(() => ({ profile: window.__profile, ...window.__fi }));
        const a = fps[i], mean = a.reduce((s, x) => s + x, 0) / a.length;
        res.push({ variant: VARIANTS[i].name, fps: +mean.toFixed(2), ...info }); console.log('   ', VARIANTS[i].name, a.map((x) => x.toFixed(2)).join(' '));
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
