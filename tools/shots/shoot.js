// Screenshot + performance harness for the polish passes. Stages each game area in headless
// Chromium emulating a phone (844x390 landscape, 2x DPR, touch → the "Balanced" profile) and saves
// PNGs plus metrics (fps over 3 s, WebGL draw calls/triangles for 3D) to shots/<label>/<area>/.
//
//   node tools/shots/shoot.js <area|all> [--label NAME] [--port 8120] [--only SCENARIO]
//   areas: flying premade3d selfbuilt3d brawler investigation nightlife
//
// FPS comes from software rendering (SwiftShader): compare runs against each other, not phones.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through to the npx cache */ }
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  for (const d of fs.existsSync(cache) ? fs.readdirSync(cache) : []) {
    const p = path.join(cache, d, 'node_modules', 'playwright');
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error('playwright not found: run `npx playwright --version` once to install it');
}

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const AREA = argv[0] || 'all';
const LABEL = arg('--label', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
const PORT = +arg('--port', 8120);
const ONLY = arg('--only', null);
const OUT = path.join(ROOT, 'shots', LABEL);

// ------------------------------------------------------------------ scenarios
// 3D zone: { zone: {kind, venue?, boss?, mode?} } → 3 shots: arrival, camera swung round, a guard up close.
const Z3 = (kind, venue, boss = null, extra = {}) => ({ type: '3d', zone: { kind, venue, boss, ...extra } });
const AREAS = {
  flying: {
    cruise: { type: 'fly', plan: 'cruise' },
    low: { type: 'fly', plan: 'low' },
    high: { type: 'fly', plan: 'high' },
    // the three.js flight slice (?flight=3d): same city seed, chase camera, flown forward then into a turn
    fly3d_cruise: { type: 'fly3d', plan: 'cruise' },
    fly3d_low: { type: 'fly3d', plan: 'low' },
    fly3d_high: { type: 'fly3d', plan: 'high' },
    fly3d_boost: { type: 'fly3d', plan: 'boost' },
    fly3d_night: { type: 'fly3d', plan: 'night' },
    fly3d_patrolview: { type: 'fly3d', plan: 'patrolview' },
  },
  premade3d: {
    triangle: Z3('special', 'Triangle Club', 'Madame Mesmer'),
    clubhouse: Z3('special', 'The Clubhouse', 'Mister Midas'),
    velvet: Z3('special', 'Velvet Lounge'),
  },
  selfbuilt3d: {
    warehouse: Z3('special', 'Warehouse', 'Count Cashflow'),
    penthouse: Z3('special', 'Penthouse'),
    lair: Z3('special', 'Underground Lair', 'Doctor Dollar'),
    asylum: Z3('asylum'),
  },
  brawler: {
    street: { type: 'brawl' },
    downtown: { type: 'brawl', crime: 'gang', clock: 21 * 60, crowd: true, god: true },
    shops: { type: 'brawl', crime: 'robbery', district: 'retail', clock: 13 * 60, crowd: true, god: true },
  },
  investigation: {
    daycase: { type: 'investigate', setting: 'rigged' },          // setting = case id (data.js CASES)
    dayoffice: { type: 'investigate', setting: 'blackmail', moments: true },
    dayalley: { type: 'investigate', setting: 'smuggle' },
    dayarson: { type: 'investigate', setting: 'arson' },
    nightcase: { ...Z3('nightcase', 'Triangle Club'), clues: true },
  },
  nightlife: {
    nightclub: Z3('special', 'Nightclub'),
    redlight: Z3('special', 'Red Light Den'),
    gentlemens: Z3('special', "Gentlemen's Club"),
    casino: Z3('special', 'High-Roller Suite'),
    velvet: Z3('special', 'Velvet Lounge', 'The Velvet Viper'),
  },
};

// ------------------------------------------------------------------ page helpers
async function newGame(page, query = '') {
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; }); // SwiftShader is "slow"
  await page.waitForTimeout(800);
  await page.click('#btn-new');
  await page.waitForTimeout(600);
  const opt = page.locator('#modal-root .opt').first();
  if (await opt.count()) await opt.click();
  await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
  await page.waitForTimeout(500);
}

async function metrics(page) {
  return page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else done(); };
    const done = () => {
      const m = window.__game.mode, info = m && m.renderer && m.renderer.info;
      res({ fps: +(n / ((performance.now() - t0) / 1000)).toFixed(1), mode: window.__game.modeName, calls: info ? info.render.calls : null, triangles: info ? info.render.triangles : null });
    };
    requestAnimationFrame(tick);
  }));
}

async function hold(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }

async function start3d(page, z) {
  await page.evaluate((z) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld');
    let zone = null;
    if (z.kind === 'asylum') zone = ow.spawn('asylum', true);
    else if (z.kind === 'nightcase') {
      // keep rolling until a night case lands in the wanted club (its name/caption carry the venue)
      const ok = (q) => q && q.mode === 'nightcase' && (!z.venue || q.venue === z.venue);
      for (let i = 0; i < 200 && !ok(zone); i++) { if (zone) ow.removeZone(zone); g.state.clock = 23 * 60; zone = ow.spawn('case', true); }
    } else zone = ow.spawn('special', true, z.venue);
    if (!zone) throw new Error('could not spawn ' + JSON.stringify(z));
    if ('boss' in z && z.kind === 'special') { zone.boss = z.boss; }
    g.startZone(zone);
  }, z);
  await page.waitForFunction(() => { const m = window.__game.mode; return m && m.hero && m.scene && !m.warming; }, null, { timeout: 120000 });
  await page.evaluate(() => { const m = window.__game.mode; m.grace = 1e9; m.bossMet = true; });
  await page.waitForTimeout(2500);
}

async function shoot3d(page, dir, name, z) {
  await start3d(page, z);
  const out = [];
  await page.screenshot({ path: path.join(dir, `${name}_1_arrival.png`) }); out.push(`${name}_1_arrival.png`);
  const m = await metrics(page);
  await page.evaluate(() => { const m = window.__game.mode; m.yaw += Math.PI * 0.75; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(dir, `${name}_2_turned.png`) }); out.push(`${name}_2_turned.png`);
  const gotGuard = await page.evaluate(() => {
    const m = window.__game.mode, t = (m.guards.find((g) => !g.ko) || {}).mesh || m.boss;
    if (!t) return false;
    const f = { x: Math.sin(t.rotation.y), z: Math.cos(t.rotation.y) };
    m.hero.position.set(t.position.x + f.x * 3, t.position.y, t.position.z + f.z * 3);
    m.hero.rotation.y = Math.atan2(-f.x, -f.z); m.yaw = m.hero.rotation.y - Math.PI;
    return true;
  });
  if (gotGuard) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(dir, `${name}_3_closeup.png`) }); out.push(`${name}_3_closeup.png`); }
  return { shots: out, ...m };
}

async function shootFly(page, dir, name, plan) {
  await page.evaluate(() => window.__game.setMode('overworld'));
  if (plan === 'low') { await hold(page, 'KeyF', 4000); }
  if (plan === 'high') { await hold(page, 'KeyR', 4000); }
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(dir, `${name}_1.png`) });
  const m = await metrics(page);
  await page.keyboard.up('KeyD');
  await hold(page, 'KeyW', 1500);
  await page.screenshot({ path: path.join(dir, `${name}_2.png`) });
  return { shots: [`${name}_1.png`, `${name}_2.png`], ...m };
}

/** The 3D flight slice: fixed seed, a band, then forward (camera-relative) and a banked turn. */
async function shootFly3d(page, dir, name, plan) {
  await page.evaluate((night) => {
    const g = window.__game; g.setMode('overworld'); g.overworld.nav.autopilot = false;
    if (night) g.state.clock = 23 * 60;
  }, plan === 'night');
  await page.waitForTimeout(800);
  if (plan === 'low') await hold(page, 'KeyF', 4000);
  if (plan === 'high' || plan === 'patrolview') await hold(page, 'KeyR', 4500);
  if (plan === 'boost') await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(dir, `${name}_1.png`) });
  const m = await metrics(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(dir, `${name}_2.png`) });
  await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  return { shots: [`${name}_1.png`, `${name}_2.png`], ...m };
}

// sc.crime / sc.clock pin the street crime and time of day (repeatable frames); sc.crowd adds a
// fourth shot mid-brawl (mashing a combo into the pack).
async function shootBrawl(page, dir, name, sc = {}) {
  await page.evaluate((sc) => {
    const g = window.__game; g.setMode('overworld');
    if (sc.clock != null) g.state.clock = sc.clock;
    let z = null;
    for (let i = 0; i < 200 && !(z && (!sc.crime || z.def.id === sc.crime) && (!sc.district || z.district === sc.district)); i++) {
      if (z) g.overworld.zones = g.overworld.zones.filter((o) => o !== z);
      z = g.overworld.spawn('street', true);
    }
    g.startZone(z);
    // pinned scenarios keep her on her feet so every frame shows the move being shot, not a stagger
    if (sc.god) g.mode.hurtPlayer = () => {};
  }, sc);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(dir, `${name}_1_start.png`) });
  const m = await metrics(page);
  await page.keyboard.down('KeyD');
  for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(250); }
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: path.join(dir, `${name}_2_fight.png`) });
  await page.keyboard.press('KeyK');
  // the super freeze: comic cut-in panel (shoot at once: a capture takes a few hundred ms)
  await page.screenshot({ path: path.join(dir, `${name}_3a_cutin.png`) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(dir, `${name}_3_special.png`) });
  const shots = [`${name}_1_start.png`, `${name}_2_fight.png`, `${name}_3a_cutin.png`, `${name}_3_special.png`];
  if (sc.crowd) {
    await page.waitForTimeout(600);
    for (let i = 0; i < 9; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(i % 3 === 2 ? 180 : 110); }
    await page.screenshot({ path: path.join(dir, `${name}_4_crowd.png`) });
    shots.push(`${name}_4_crowd.png`);
  }
  return { shots, ...m };
}

async function shootInvestigate(page, dir, name, setting, moments) {
  await page.evaluate(async (caseId) => {
    const g = window.__game; g.setMode('overworld');
    let z = null;
    for (let i = 0; i < 40 && !(z && z.mode === 'investigate'); i++) { g.state.clock = 12 * 60; z = g.overworld.spawn('case', true); }
    if (caseId) { const def = (await import('/src/data.js')).CASES.find((c) => c.id === caseId); if (def) { z.def = def; z.name = def.name; } }
    g.startZone(z);
  }, setting);
  await page.waitForTimeout(2500);
  const shots = [];
  const snap = async (n) => { const f = `${name}_${n}.png`; await page.screenshot({ path: path.join(dir, f) }); shots.push(f); };
  await snap('1_scene');
  const m = await metrics(page);
  await page.keyboard.press('KeyX'); await page.waitForTimeout(900);
  await snap('2_xray');
  await page.keyboard.press('KeyX'); await page.keyboard.press('KeyC'); await page.waitForTimeout(900);
  await snap('3_camera');
  await page.keyboard.press('KeyC'); await page.waitForTimeout(400);
  if (moments) {
    const closeDlg = async () => { const o = page.locator('#modal-root .opt, #modal-root .cb-close').first(); if (await o.count()) await o.click(); await page.waitForTimeout(500); };
    // a clue found: punch-in + evidence card
    await page.evaluate(() => { const m = window.__game.mode; const c = m.clues.find((c) => c.method === 'visible'); m.search(c.host); });
    await page.waitForTimeout(1100);
    await snap('4_clue');
    await closeDlg(); await page.waitForTimeout(500);
    // photograph it
    await page.evaluate(() => { const m = window.__game.mode; m.camera = true; const c = m.clues.find((c) => c.found && c.host); m.search(c.host); });
    await page.waitForTimeout(450);
    await snap('5_snap');
    await page.waitForTimeout(2200);
    await page.evaluate(() => { const m = window.__game.mode; m.camera = false; for (const c of m.clues) if (!c.found && c.method !== 'witness') m.case.find(c); });
    await page.waitForTimeout(300);
    await snap('6_markers');
    await page.evaluate(() => { window.__game.mode.showNotes(); });
    await page.waitForTimeout(900);
    await snap('7_board');
    await closeDlg();
    await page.evaluate(() => { window.__game.mode.showSuspects(); });
    await page.waitForTimeout(900);
    await snap('8_suspects');
    await page.evaluate(() => { const m = window.__game.mode; const i = m.case.suspects.findIndex((s) => s.culprit); document.querySelectorAll('.cb-acc')[i].click(); });
    await page.waitForTimeout(2000);
    await snap('9_reveal');
  }
  return { shots, ...m };
}

// Night case: walk up to a piece of evidence, then look again with X-ray (clue marker, beam, scan).
async function shootNightClues(page, dir, name) {
  const out = [];
  const place = (i) => page.evaluate((i) => {
    const m = window.__game.mode, o = m.clueObjs[i % m.clueObjs.length];
    if (!o) return false;
    m.hero.position.set(o.pos.x, o.pos.y, o.pos.z + 2.6);
    m.hero.rotation.y = Math.PI; m.yaw = 0;
    return true;
  }, i);
  if (!(await place(0))) return out;
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(dir, `${name}_4_clue.png`) }); out.push(`${name}_4_clue.png`);
  const xi = await page.evaluate(() => window.__game.mode.clueObjs.findIndex((o) => o.inner));
  if (xi >= 0) await place(xi);
  await page.keyboard.press('KeyX'); await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(dir, `${name}_5_xray.png`) }); out.push(`${name}_5_xray.png`);
  await page.keyboard.press('KeyX');
  return out;
}

// ------------------------------------------------------------------ main
(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const areas = AREA === 'all' ? Object.keys(AREAS) : AREA.split(',');
  const report = {};
  try {
    for (const area of areas) {
      if (!AREAS[area]) throw new Error(`unknown area ${area}; one of ${Object.keys(AREAS).join(', ')}`);
      const dir = path.join(OUT, area);
      fs.mkdirSync(dir, { recursive: true });
      report[area] = {};
      for (const [name, sc] of Object.entries(AREAS[area])) {
        if (ONLY && ONLY !== name) continue;
        const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
        try {
          if (sc.type === 'fly3d') await page.addInitScript(`(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);
          await newGame(page, sc.type === 'fly3d' ? '?flight=3d' : '');
          let r;
          if (sc.type === '3d') { r = await shoot3d(page, dir, name, sc.zone); if (sc.clues) r.shots.push(...await shootNightClues(page, dir, name)); }
          else if (sc.type === 'fly') r = await shootFly(page, dir, name, sc.plan);
          else if (sc.type === 'fly3d') r = await shootFly3d(page, dir, name, sc.plan);
          else if (sc.type === 'brawl') r = await shootBrawl(page, dir, name, sc);
          else if (sc.type === 'investigate') r = await shootInvestigate(page, dir, name, sc.setting, sc.moments);
          report[area][name] = { ...r, errors };
        } catch (e) {
          report[area][name] = { failed: e.message.split('\n')[0], errors };
          await page.screenshot({ path: path.join(dir, `${name}_FAILED.png`) }).catch(() => {});
        }
        console.log(`${area}/${name}:`, JSON.stringify(report[area][name]));
        await ctx.close();
      }
      fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(report[area], null, 2));
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  console.log(`\nshots → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
