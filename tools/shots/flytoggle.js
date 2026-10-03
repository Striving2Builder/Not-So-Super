// Per-feature cost of the 3D flight frame: one page per band, the simulation frozen (the same frame
// rendered over and over), each feature switched off in turn and measured against the full frame,
// alternating (base, A, base, B, ...) so drift hits everything equally.
//   node tools/shots/flytoggle.js [--graphics high|auto|saver] [--bands 0,1,2] [--rounds 4] [--port 8808]
//        [--overlay dir]  (files in dir replace the checkout's: e.g. a frozen copy of src/ while you edit)
// Prints fps(full), and per toggle fps(off) and the % of frame time the feature costs.
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
const PORT = +arg('--port', 8808), ROUNDS = +arg('--rounds', 4), GFX = arg('--graphics', 'auto');
const BANDS = arg('--bands', '0,1,2').split(',').map(Number);
const ONLY = arg('--only', null);
const OVERLAY = arg('--overlay', null) && path.resolve(ROOT, arg('--overlay'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const serve = () => http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]), rel = url === '/' ? 'index.html' : url.slice(1);
  const file = [OVERLAY && path.join(OVERLAY, rel), path.join(ROOT, rel)].filter(Boolean).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!file) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT);
const NIGHT = argv.includes('--day') ? 12 * 60 : 21 * 60;

// [name, off, on] snippets; they see v (Flight3D), P (the active profile object), T (a stash)
const TOGGLES = [
  ['sharpen 4→2 taps', 'T.t = P.fly3dSharpTaps; P.fly3dSharpTaps = 2', 'P.fly3dSharpTaps = T.t'],
  ['sharpen off', 'T.s = P.fly3dSharp; P.fly3dSharp = 0', 'P.fly3dSharp = T.s'],
  ['keyline off', 'v.hero.keyline = () => [0, 0]', 'delete v.hero.keyline'],
  ['hero pass off', 'T.h = P.fly3dHero; P.fly3dHero = [0, 0]', 'P.fly3dHero = T.h'],
  ['AA → none', 'T.a = P.fly3dAA; P.fly3dAA = "none"', 'P.fly3dAA = T.a'],
  ['clouds off', 'v.sky.clouds.visible = false', 'v.sky.clouds.visible = true'],
  ['ground plan off', 'v.city3.ground.visible = false', 'v.city3.ground.visible = true'],
  ['river off', 'if (v.city3.river) for (const m of Object.values(v.city3.river)) m.visible = false', 'if (v.city3.river) for (const m of Object.values(v.city3.river)) m.visible = true'],
  ['car glows off', 'v.city3.street.cars.visible = false', 'v.city3.street.cars.visible = true'],
  ['sky dome off', 'v.sky.dome.visible = false', 'v.sky.dome.visible = true'],
].filter((t) => !ONLY || ONLY.split(',').some((o) => t[0].includes(o)));

const INIT = `(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
try { localStorage.setItem('supergirl-settings', JSON.stringify({ graphics: '${GFX}' })); } catch (e) {}`;

(async () => {
  const srv = serve();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = {};
  try {
    for (const band of BANDS) {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript(INIT);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('ERR', e.message));
      await page.goto(`http://localhost:${PORT}/?flight=3d&dynres=off`);
      await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
      await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
      await page.evaluate(() => document.getElementById('btn-new').click());
      await page.waitForFunction(() => document.querySelector('#modal-root .opt'), null, { timeout: 120000 }).catch(() => {});
      await page.evaluate(() => document.querySelector('#modal-root .opt')?.click());
      await page.evaluate(([band, clock]) => {
        const g = window.__game, ow = g.overworld;
        g.setMode('overworld'); ow.nav.autopilot = false; g.state.clock = clock; ow.hero.band = band;
        const ax = g.input.axis.bind(g.input);
        g.input.axis = () => ({ x: 0.6, y: -0.8 });
      }, [band, NIGHT]);
      await page.waitForTimeout(4000);
      // freeze: the same frame from here on (render only)
      const profile = await page.evaluate(async () => {
        const g = window.__game, m = g.mode;
        g.mode = { render: (c) => m.render(c), update() {} };
        window.__T = {};
        return (await import('/src/settings.js')).quality().id;
      });
      const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));
      const run = (js) => page.evaluate(async (js) => { const v = window.__game.overworld.view3d, P = (await import('/src/settings.js')).quality(), T = window.__T; eval(js); }, js);
      const base = [], off = TOGGLES.map(() => []);
      await page.waitForTimeout(500);
      for (let r = 0; r < ROUNDS; r++) {
        for (const [i, t] of TOGGLES.entries()) {
          await page.waitForTimeout(150); base.push(await fps());
          await run(t[1]); await page.waitForTimeout(250); off[i].push(await fps()); await run(t[2]);
        }
      }
      const info = await page.evaluate(() => { const r = window.__game.overworld.view3d.renderer; return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
      await ctx.close();
      const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length, b = mean(base);
      console.log(`band ${band} (${profile}): full frame ${b.toFixed(2)} fps, ${info.calls} calls, ${info.tris} tris`);
      out[band] = { profile, fps: +b.toFixed(2), ...info, toggles: {} };
      for (const [i, t] of TOGGLES.entries()) {
        const f = mean(off[i]), cost = 1 - b / f; // share of the frame time the feature takes
        out[band].toggles[t[0]] = { fps: +f.toFixed(2), cost: +(cost * 100).toFixed(1) };
        console.log('  ', t[0].padEnd(18), f.toFixed(2).padStart(6), 'fps', `${(cost * 100).toFixed(1)}%`.padStart(7), 'of frame time');
      }
    }
  } finally { await browser.close(); srv.close(); }
  const f = arg('--out', null);
  if (f) fs.writeFileSync(f, JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
