// Profiling helper for the 3D zone look: fps with each comic-look feature toggled off in turn.
//   node tools/shots/prof.js <Venue|asylum> [--port 8133]
const path = require('path'); const fs = require('fs'); const { spawn } = require('child_process');
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* npx cache */ }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  for (const d of fs.readdirSync(cache)) { const p = path.join(cache, d, 'node_modules', 'playwright'); if (fs.existsSync(p)) return require(p); }
}
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const PORT = +(argv.includes('--port') ? argv[argv.indexOf('--port') + 1] : 8133);
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const venue = argv[0] || 'Warehouse';
(async () => {
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'));
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(800); await page.click('#btn-new'); await page.waitForTimeout(600);
  const opt = page.locator('#modal-root .opt').first(); if (await opt.count()) await opt.click();
  await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
  await page.evaluate((v) => { const g = window.__game, ow = g.overworld; g.setMode('overworld'); const z = v === 'asylum' ? ow.spawn('asylum', true) : ow.spawn('special', true, v); g.startZone(z); }, venue);
  await page.waitForFunction(() => { const m = window.__game.mode; return m && m.hero && m.scene && !m.warming; }, null, { timeout: 120000 });
  await page.evaluate(() => { window.__game.mode.grace = 1e9; });
  await page.waitForTimeout(2500);
  const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else { const i = window.__game.mode.renderer.info.render; res(`${(n / 2.5).toFixed(1)}fps calls=${i.calls} tris=${i.triangles}`); } }; requestAnimationFrame(tick); }));
  const mode = argv.includes('--mats') ? 'mats' : 'look';
  const steps = mode === 'look' ? [
    ['all on', null],
    ['no hulls', () => window.__game.mode.scene.traverse((o) => { if (o.userData.ink) o.visible = false; })],
    ['+no halftone', () => window.__game.mode.scene.traverse((o) => { const c = o.material && o.material.userData && o.material.userData.comic; if (c) c.htK.value = 0; })],
    ['+no grade', () => { const m = window.__game.mode; if (m.grade) m.grade.visible = false; }],
    ['+no edges', () => window.__game.mode.scene.traverse((o) => { if (o.isLineSegments) o.visible = false; })],
    ['+no pools', () => window.__game.mode.scene.traverse((o) => { if (o.material && o.material.blending === 2) o.visible = false; })],
    ['+no blobs', () => { window.__game.mode.shadows.mesh.visible = false; }],
    ['+no hero', () => { window.__game.mode.hero.visible = false; }],
    ['+no guards', () => { const m = window.__game.mode; for (const g of m.guards) g.mesh.visible = false; if (m.boss) m.boss.visible = false; }],
  ] : [
    ['all on', null],
    ['all on again', null],
    ['toon->lambert', async () => { const T = await import('three'); window.__game.mode.scene.traverse((o) => { const m = o.material; if (m && m.isMeshToonMaterial) { const l = new T.MeshLambertMaterial({ color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap, transparent: m.transparent, opacity: m.opacity, vertexColors: m.vertexColors, side: m.side }); if (m.userData.comic) { l.userData.comic = m.userData.comic; l.onBeforeCompile = m.onBeforeCompile; l.customProgramCacheKey = m.customProgramCacheKey; } o.material = l; } }); }],
    ['no key light', () => { window.__game.mode.key.visible = false; }],
    ['2 plights', () => { window.__game.mode.plights.slice(2).forEach((l) => { l.visible = false; }); }],
    ['no tonemap', () => { window.__game.mode.renderer.toneMapping = 0; window.__game.mode.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }],
    ['dpr 1', () => { const m = window.__game.mode; m.renderer.setPixelRatio(1); m.renderer.setSize(m.g.w, m.g.h, false); }],
  ];
  if (argv.includes('--iso')) {
    // each feature off vs on, alternating, so drift hits both sides
    const T = {
      hulls: (on) => window.__game.mode.scene.traverse((o) => { if (o.userData.ink) o.visible = on; }),
      halftone: (on) => window.__game.mode.scene.traverse((o) => { const c = o.material && o.material.userData && o.material.userData.comic; if (c) c.htK.value = on ? (c._ht ?? (c._ht = c.htK.value)) : ((c._ht = c._ht ?? c.htK.value), 0); }),
      grade: (on) => { const m = window.__game.mode; if (m.grade) m.grade.visible = on; },
      edges: (on) => window.__game.mode.scene.traverse((o) => { if (o.isLineSegments) o.visible = on; }),
      pools: (on) => window.__game.mode.scene.traverse((o) => { if (o.material && o.material.blending === 2) o.visible = on; }),
      cones: (on) => window.__game.mode.guards.forEach((g) => { g.cone.visible = on; }),
      tonemap: (on) => { const m = window.__game.mode; m.renderer.toneMapping = on ? 4 : 0; m.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((x) => { x.needsUpdate = true; }); }); },
      key: (on) => { window.__game.mode.key.visible = on; },
      office: (on) => { const m = window.__game.mode; m.scene.traverse((o) => { if (o.isPointLight && !m.plights.includes(o)) o.visible = on; }); },
      floorTex: (on) => { const m = window.__game.mode; m.scene.traverse((o) => { const x = o.material; if (x && x.map && x.map.image && x.map.image.width === 1024) { x.userData._m = x.userData._m || [x.map, x.emissiveMap]; x.map = on ? x.userData._m[0] : null; x.emissiveMap = on ? x.userData._m[1] : null; x.needsUpdate = true; } }); },
      coneShape: (on) => { const m = window.__game.mode; if (on) delete m.shapeCone; else m.shapeCone = () => {}; },
      heroHull: (on) => window.__game.mode.hero.traverse((o) => { if (o.userData.ink) o.visible = on; }),
      particles: (on) => window.__game.mode.particles.forEach((p) => { p.mesh.visible = on; }),
      backdrop: (on) => window.__game.mode.scene.traverse((o) => { if (o.userData.backdrop) o.visible = on; }),
      glass: (on) => window.__game.mode.scene.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && !o.userData.ink && o.material.type !== 'ShaderMaterial') o.visible = on; }),
      chars: (on) => { const m = window.__game.mode; for (const g of m.guards) g.mesh.visible = on; if (m.boss) m.boss.visible = on; m.hero.visible = on; if (m.informant) m.informant.mesh.visible = on; },
    };
    for (const [name, f] of Object.entries(T)) {
      if (ONLY && !ONLY.includes(name)) continue;
      const r = { on: 0, off: 0 };
      for (const st of [false, true, false, true]) {
        await page.evaluate(`(${f.toString()})(${st})`); await page.waitForTimeout(400);
        const v = await fps(); r[st ? 'on' : 'off'] += parseFloat(v) / 2;
      }
      console.log(name.padEnd(10), 'on', r.on.toFixed(1), 'off', r.off.toFixed(1));
    }
  } else
  for (const [name, fn] of steps) { if (fn) { await page.evaluate(fn); await page.waitForTimeout(800); } console.log(name.padEnd(14), await fps()); }
  await browser.close(); srv.kill();
})();
