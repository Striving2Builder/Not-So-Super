// Premade 3D clubs: is every gameplay spot reachable on foot? For each club it
//   1. walks the whole scanned floor from the entrance with the game's own collide() (capsule push +
//      step-up grounding, 8 cm steps) → the set of floor points she can really stand on;
//   2. checks the placement pool (ClubZone.walkFloor, from clubgeo.reachableFloor) against it;
//   3. re-runs the raid layout (and the night-case layout) --seeds times and checks every
//      interaction (items, evidence, captives, informant, clues, witnesses) is within her 2 m reach of
//      a walkable spot, and the boss/guards stand on one;
//   4. reports what the old placement rules would have picked (raw floor / table tops vs mainY).
//
//   node tools/shots/clubreach.js --port 8832 [--seeds 25] [--clubs triangle,clubhouse,stripclub] [--label NAME]
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
  throw new Error('playwright not found');
}

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const PORT = +arg('--port', 8832);
const SEEDS = +arg('--seeds', 25);
const VENUE = { triangle: 'Triangle Club', clubhouse: 'The Clubhouse', stripclub: 'Velvet Lounge' };
const CLUBS = arg('--clubs', 'triangle,clubhouse,stripclub').split(',');
const OUT = path.join(ROOT, 'shots', arg('--label', 'clubreach'));
fs.mkdirSync(OUT, { recursive: true });

async function enter(page, venue, night) {
  await page.evaluate(([venue, night]) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld');
    let zone = null;
    if (night) {
      for (let i = 0; i < 300 && !(zone && zone.mode === 'nightcase' && zone.venue === venue); i++) { if (zone) ow.removeZone(zone); g.state.clock = 23 * 60; zone = ow.spawn('case', true); }
    } else zone = ow.spawn('special', true, venue);
    if (!zone || (night && zone.venue !== venue)) throw new Error('no zone for ' + venue);
    zone.boss = zone.boss || (night ? null : 'Madame Mesmer');
    g.startZone(zone);
  }, [venue, night]);
  await page.waitForFunction(() => { const m = window.__game.mode; return m && m.hero && m.scene && !m.warming; }, null, { timeout: 180000 });
  await page.evaluate(() => { const m = window.__game.mode; m.grace = 1e9; m.bossMet = true; });
}

// In-page: the walk test with the game's collide(), then layouts re-rolled `seeds` times.
const CHECK = async ([seeds, night]) => {
  const m = window.__game.mode, c = m.club, all = c.floor;
  const { reachableFloor } = await import('/src/clubgeo.js');
  const t0 = performance.now(); reachableFloor(c.collider, all, m.spawn); const floodMs = performance.now() - t0;
  const saved = m.colliders; m.colliders = []; // cages placed this visit aren't part of the building
  const sim = (a, b) => {
    const p = a.clone(); m._lastGood = a.clone();
    for (let i = 0; i < 40; i++) {
      const rem = Math.hypot(b.x - p.x, b.z - p.z);
      if (rem < 0.04) break;
      const s = Math.min(0.08, rem); p.x += ((b.x - p.x) / rem) * s; p.z += ((b.z - p.z) / rem) * s;
      m.collide(p, 0.38);
    }
    return Math.hypot(b.x - p.x, b.z - p.z) < 0.3 && Math.abs(p.y - b.y) < 0.2;
  };
  // flood over the floor grid with real movement
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`, grid = new Map();
  for (const p of all) { const k = key(p.x, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  let s0 = all[0], sd = Infinity; for (const p of all) { const d = p.distanceToSquared(m.spawn); if (d < sd) { sd = d; s0 = p; } }
  const ok = new Set([s0]), q = [s0];
  const t1 = performance.now();
  while (q.length) {
    const a = q.pop();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const b of grid.get(`${Math.round(a.x) + dx},${Math.round(a.z) + dz}`) || []) {
      if (ok.has(b) || Math.hypot(b.x - a.x, b.z - a.z) < 0.01) continue;
      if (sim(a, b)) { ok.add(b); q.push(b); }
    }
  }
  const simMs = performance.now() - t1;
  const walk = [...ok];
  const reachOf = (x, z, r = 2.0) => walk.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);
  const pool = m.walkFloor || all;
  const poolBad = pool.filter((p) => !ok.has(p)).length;
  const unreach = all.filter((p) => !ok.has(p));
  const hist = {}; for (const p of unreach) { const k = (p.y - c.mainY).toFixed(1); hist[k] = (hist[k] || 0) + 1; }
  // old rules: any floor point; table tops 0.55–1.25 m above mainY with no stand test
  const oldFloorBad = all.length ? unreach.length / all.length : 0;
  const THREE = await import('three');
  const ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 3;
  let oldSurf = 0, oldSurfBad = 0;
  for (let i = 0; i < 3000; i++) {
    const x = c.box.min.x + Math.random() * (c.box.max.x - c.box.min.x), z = c.box.min.z + Math.random() * (c.box.max.z - c.box.min.z);
    ray.set(new THREE.Vector3(x, c.mainY + 2.2, z), new THREE.Vector3(0, -1, 0));
    const h = ray.intersectObject(c.collider)[0];
    if (!h || h.face.normal.y < 0.9) continue;
    const lift = h.point.y - c.mainY;
    if (lift < 0.55 || lift > 1.25) continue;
    oldSurf++; if (!reachOf(x, z)) oldSurfBad++;
  }
  // re-roll the layout `seeds` times and check every interaction / NPC
  const bad = [], counts = {};
  for (let s = 0; s < seeds; s++) {
    for (const o of [...m.scene.children]) if (o !== c.scene && !o.isLight && o !== m.hero) { /* leave the old props; harmless for the check */ }
    m.inter = []; m.guards = []; m.captives = []; m.evidence = []; m.boss = null; m.clueObjs = [];
    try {
      if (night) m.placeNightCase ? m.placeNightCase() : m.placeClubGameplay(); else m.placeClubGameplay();
    } catch (e) { bad.push({ seed: s, error: String(e).slice(0, 200) }); continue; }
    for (const o of m.inter) {
      counts[o.tag || o.label.split(':')[0]] = (counts[o.tag || o.label.split(':')[0]] || 0) + 1;
      if (!reachOf(o.pos.x, o.pos.z)) bad.push({ seed: s, what: o.label, x: +o.pos.x.toFixed(1), z: +o.pos.z.toFixed(1) });
    }
    for (const g of m.guards) for (const p of g.route) { counts.guardWp = (counts.guardWp || 0) + 1; if (!reachOf(p.x, p.z, 0.8)) bad.push({ seed: s, what: 'guard waypoint', x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2) }); }
    if (m.boss) { counts.boss = (counts.boss || 0) + 1; if (!reachOf(m.boss.position.x, m.boss.position.z, 0.8)) bad.push({ seed: s, what: 'boss', y: +m.boss.position.y.toFixed(2) }); }
  }
  m.colliders = saved;
  return { floor: all.length, walkable: walk.length, pool: pool.length, poolNotWalkable: poolBad, unreachableByLift: hist, oldFloorBadFrac: +oldFloorBad.toFixed(3), oldSurf, oldSurfBad, floodMs: Math.round(floodMs), simMs: Math.round(simMs), counts, bad: bad.slice(0, 30), nBad: bad.length };
};

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = {};
  try {
    for (const club of CLUBS) for (const night of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
      await page.goto(`http://localhost:${PORT}/?flight=2d`);
      await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
      await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
      await page.waitForTimeout(800);
      await page.click('#btn-new');
      await page.waitForTimeout(600);
      const opt = page.locator('#modal-root .opt').first();
      if (await opt.count()) await opt.click();
      const tag = `${club}${night ? '_night' : ''}`;
      try {
        await enter(page, VENUE[club], night);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
        report[tag] = { ...(await page.evaluate(CHECK, [SEEDS, night])), errors };
      } catch (e) { report[tag] = { failed: e.message.split('\n')[0], errors }; }
      console.log(tag, JSON.stringify(report[tag]));
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  fs.writeFileSync(path.join(OUT, 'clubreach.json'), JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
