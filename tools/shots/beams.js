// Incident beacons in the 3D flight: shoots each band (and a look round from cruise) and reports
// what the beam mesh holds, so a missing or faint beacon shows up without a phone.
//   node tools/shots/beams.js [--label beams] [--port 8137] [--query '&x=1']
// → shots/<label>/beams/*.png + report.json
const path = require('path');
const fs = require('fs');
const serve = require('./serve.js');

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
const LABEL = arg('--label', 'beams'), PORT = +arg('--port', 8137), QUERY = arg('--query', '');
const OUT = path.join(ROOT, 'shots', LABEL, 'beams');
const INIT = `(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve(ROOT, PORT);
  const browser = await loadPlaywright().chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = { errors: [], shots: [] };
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${PORT}/?dynres=off${QUERY}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 90000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(500);
  await page.click('#btn-new'); await page.waitForTimeout(800);
  const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 6; i++) { // (any intro cards/cutscenes)
    if (await page.evaluate(() => window.__game.mode === window.__game.overworld)) break;
    await page.evaluate(() => window.__game.setMode('overworld')); await page.waitForTimeout(600);
  }
  await page.evaluate(() => { const g = window.__game, ow = g.overworld; ow.nav.autopilot = false; g.state.clock = 21 * 60; });

  const state = () => page.evaluate(() => {
    const ow = window.__game.overworld, v = ow.view3d, b = v && v.beacons, h = ow.hero;
    return {
      view3d: !!v, beacons: !!(b && b.lit), inScene: !!(b && b.lit && b.lit.parent === v.scene && b.ghost.parent === v.scene), drawCount: b && b.geo && b.geo.drawRange.count,
      zones: ow.zones.map((z) => ({ name: z.name, kind: z.kind, color: z.color, d: Math.round(Math.hypot(z.x - h.x, z.y - h.y) * 0.5) })),
      band: h.band,
      proj: v && ow.zones.map((z) => { const P = v.projector(); const a = P.proj(z.x, z.y, 300 / 0.5); return [z.glyph, Math.round(a[0]), Math.round(a[1]), a[2], v.underHud(a[0], a[1], 4), v.onHero(a[0], a[1], 14)]; }),
    };
  });
  const shoot = async (name, setup) => {
    await page.evaluate(setup);
    await page.waitForTimeout(2500);
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    report.shots.push({ name, ...(await state()) });
  };
  for (const band of [0, 1, 2]) {
    await shoot('band' + band, `(() => { const ow = window.__game.overworld; ow.hero.band = ${band}; ow.view3d && (ow.view3d.patrolForced = false); })()`);
  }
  // cruise, looking round her at the four headings
  for (let i = 0; i < 4; i++) {
    await shoot('cruise-look' + i, `(() => { const ow = window.__game.overworld; ow.hero.band = 1; ow.hero.ang = ${(i * Math.PI) / 2}; })()`);
  }
  // by day
  await shoot('day-cruise', `(() => { const g = window.__game, ow = g.overworld; g.state.clock = 13 * 60; ow.hero.band = 1; ow.hero.ang = ${Math.PI / 2}; })()`);
  await shoot('day-patrol', `(() => { const g = window.__game, ow = g.overworld; g.state.clock = 13 * 60; ow.hero.band = 2; })()`);
  // close by an incident, facing it (its ground ring and the bold shaft); then in DIVE range
  for (const [name, gap, band] of [['close', 700, 1], ['dive', 120, 0]]) {
    await shoot(name, `(() => { const g = window.__game, ow = g.overworld, h = ow.hero; g.state.clock = 21 * 60;
      const z = ow.zones.filter((q) => !q.impostor).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      h.x = z.x - ${gap}; h.y = z.y; h.ang = 0; h.speed = 0; h.band = ${band}; if (ow.view3d) { ow.view3d.cam.placed = false; ow.view3d.cam.yaw = null; } })()`);
  }
  // back to the title and on again (a new City object): the flight rebuilds its scene, the beacons must follow
  await shoot('rebuilt', `(async () => { const g = window.__game, { City } = await import('/src/city.js'); g.city = new City(g.state.seed); g.overworld.reset(); g.setMode('overworld'); g.state.clock = 21 * 60; g.overworld.nav.autopilot = false; g.overworld.hero.band = 1; })()`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ errors: report.errors, shots: report.shots.map((s) => ({ name: s.name, beacons: s.beacons, inScene: s.inScene, draw: s.drawCount, zones: s.zones.length, proj: s.name === 'cruise-look1' ? s.proj : undefined, near: s.zones.map((z) => z.d).sort((a, b) => a - b).slice(0, 4) })) }, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
