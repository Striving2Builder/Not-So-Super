// Tilt-camera prototype measurements (flight view): for each variant (off / mild / strong) and
// altitude band (skim / cruise / high) it flies the same scripted path (same city seed, same
// start, legs right / down / left / up) and records:
//   1. screenshots at the end of each leg            → shots/tilt/<variant>/<band>_<dir>.png
//   2. forward visibility: world distance from her ground position to the screen edge ahead
//   3. target visibility: % of samples where her sprite and each on-screen incident icon actually
//      show in the final frame (pixel test: the frame rendered with vs. without that item)
//   4. fps, the variants interleaved in one browser (1 s samples, round-robin)
// Output: shots/tilt/metrics.json + shots/tilt/summary.md
//   node tools/shots/tilt.js [--port 8131] [--rounds 6]
// FPS is software rendering (SwiftShader): compare the variants with each other only.
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
const OUT = path.join(ROOT, 'shots', 'tilt');
const VARIANTS = ['off', 'mild', 'strong'];
const BANDS = { skim: 0, cruise: 1, high: 2 };
const LEGS = [['right', 1, 0], ['down', 0, 1], ['left', -1, 0], ['up', 0, -1]];
const SEED = 4242, LEG_MS = 2600, SAMPLE_MS = 260;

// deterministic Math.random so both the city and the incidents line up across variants
const INIT = `(() => { let s = 1234567; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

async function open(browser, variant, band) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', variant, e.message));
  await page.goto(`http://localhost:${PORT}/?tilt=${variant}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(500);
  await page.fill('#seed-input', String(SEED)).catch(() => {});
  await page.click('#btn-new'); await page.waitForTimeout(500);
  const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
  await page.evaluate((band) => {
    const g = window.__game, ow = g.overworld, h = ow.hero;
    g.setMode('overworld'); ow.nav.autopilot = false;
    g.state.clock = 21 * 60; // night: the look being judged
    h.band = band; h.z = [150, 360, 620][band];
    ow.camH = h.z + [560, 740, 1020][band];
    window.__axis = { x: 0, y: 0 };
    g.input.axis = () => window.__axis;
  }, band);
  await page.waitForTimeout(1200);
  return page;
}

/** In-page: forward visibility + pixel visibility of hero and icons for the current frame. */
const SAMPLE = () => {
  const g = window.__game, ow = g.overworld, h = ow.hero, V = ow.V;
  const W = g.w, H = g.h, k = V.k, c = V.tilt ? V.tilt.c : 1;
  const gx = V.SX(h.x, 0), gy = V.SY(h.y, 0);
  const ahead = { right: (W - gx) / k, left: gx / k, down: (H - gy) / (k * c), up: gy / (k * c) };
  const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d'), dpr = canvas.width / W;
  const icons = [];
  const drawIcon = ow.drawIcon, heroDraw = ow.heroArt.draw;
  ow.drawIcon = function (cx, x, y, ...rest) { icons.push([x, y]); return drawIcon.call(this, cx, x, y, ...rest); };
  const patch = (x, y) => {
    const r = 4, px = Math.round(x * dpr), py = Math.round(y * dpr);
    if (px < r || py < r || px > canvas.width - r || py > canvas.height - r) return null;
    return ctx.getImageData(px - r, py - r, r * 2, r * 2).data;
  };
  ow.render(ctx);
  const hs = ow.heroScreen, A = { hero: patch(hs.x, hs.y), icons: icons.map(([x, y]) => patch(x, y)) };
  ow.drawIcon = () => {}; ow.heroArt.draw = () => {};
  ow.render(ctx);
  const B = { hero: patch(hs.x, hs.y), icons: icons.map(([x, y]) => patch(x, y)) };
  ow.drawIcon = drawIcon; ow.heroArt.draw = heroDraw;
  const diff = (a, b) => { if (!a || !b) return null; let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return d / (a.length / 4) / 3; };
  const vis = (a, b) => { const d = diff(a, b); return d === null ? null : d > 10; };
  return { ahead, hero: vis(A.hero, B.hero), icons: A.icons.map((a, i) => vis(a, B.icons[i])).filter((v) => v !== null) };
};

async function flights(browser, variant, band) {
  const page = await open(browser, variant, band);
  const dir = path.join(OUT, variant); fs.mkdirSync(dir, { recursive: true });
  const res = { ahead: {}, hero: [0, 0], icons: [0, 0] };
  for (const [name, x, y] of LEGS) {
    await page.evaluate(([x, y]) => { window.__axis = { x, y }; }, [x, y]);
    const aheads = [];
    for (let t = 0; t < LEG_MS; t += SAMPLE_MS) {
      await page.waitForTimeout(SAMPLE_MS);
      const s = await page.evaluate(SAMPLE);
      if (t > LEG_MS / 2) aheads.push(s.ahead[name]); // once the camera has settled into the turn
      if (s.hero !== null) { res.hero[1]++; if (s.hero) res.hero[0]++; }
      for (const v of s.icons) { res.icons[1]++; if (v) res.icons[0]++; }
    }
    res.ahead[name] = Math.round(aheads.reduce((a, b) => a + b, 0) / aheads.length);
    await page.screenshot({ path: path.join(dir, `${Object.keys(BANDS)[band]}_${name}.png`) });
  }
  await page.context().close();
  return res;
}

async function fps(browser, band) {
  const pages = [];
  for (const v of VARIANTS) {
    const p = await open(browser, v, band);
    await p.evaluate(() => { const g = window.__game; g.input.axis = () => { const t = performance.now() / 4000; return { x: Math.cos(t), y: Math.sin(t) }; }; window.__m = g.mode; g.mode = null; });
    pages.push(p);
  }
  const out = Object.fromEntries(VARIANTS.map((v) => [v, []]));
  for (let r = 0; r < ROUNDS; r++) {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await p.evaluate(() => { window.__game.mode = window.__m; });
      await p.waitForTimeout(250);
      out[VARIANTS[i]].push(await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 1200) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); })));
      await p.evaluate(() => { window.__game.mode = null; });
    }
  }
  for (const p of pages) await p.context().close();
  return Object.fromEntries(VARIANTS.map((v) => [v, +(out[v].reduce((a, b) => a + b, 0) / out[v].length).toFixed(1)]));
}

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const M = {};
  try {
    for (const [bname, band] of Object.entries(BANDS)) {
      M[bname] = {};
      for (const v of VARIANTS) { M[bname][v] = await flights(browser, v, band); console.log(bname, v, JSON.stringify(M[bname][v])); }
      const f = await fps(browser, band);
      for (const v of VARIANTS) M[bname][v].fps = f[v];
      console.log(bname, 'fps', JSON.stringify(f));
    }
  } finally { await browser.close(); srv.kill(); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(M, null, 2));
  // summary table
  const pct = ([a, n]) => (n ? `${Math.round((100 * a) / n)}% (${n})` : 'n/a');
  let md = '# Tilt-camera prototype: metrics\n\nForward visibility = world units from her ground position to the screen edge ahead (mean over the second half of each leg). Spread = (max − min) / max across the 4 directions. Visibility = % of sampled frames where the item shows in the final pixels (sample count). FPS: software rendering, variants interleaved; compare within a band only.\n\n';
  md += '| band | variant | ahead → | ahead ↓ | ahead ← | ahead ↑ | spread | worst vs off | hero visible | icons visible | fps |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  for (const [b, row] of Object.entries(M)) for (const v of VARIANTS) {
    const r = row[v], a = r.ahead, vals = [a.right, a.down, a.left, a.up];
    const spread = Math.round((100 * (Math.max(...vals) - Math.min(...vals))) / Math.max(...vals));
    const off = row.off.ahead, worst = Math.min(...['right', 'down', 'left', 'up'].map((d) => a[d] / off[d]));
    md += `| ${b} | ${v} | ${a.right} | ${a.down} | ${a.left} | ${a.up} | ${spread}% | ${(worst * 100).toFixed(0)}% | ${pct(r.hero)} | ${pct(r.icons)} | ${r.fps} |\n`;
  }
  fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  console.log('\n' + md);
})().catch((e) => { console.error(e); process.exit(1); });
