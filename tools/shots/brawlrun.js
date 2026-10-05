// Brawler playthrough bot: starts street brawls and plays them to the end with keyboard input from
// Playwright (walk with A/D/W/S, punch J, special K), like a player would. Proves every brawl
// completes and returns to the city; reports stalls (no objective progress for --stall s) with a
// state dump and a screenshot.
//
//   node tools/shots/brawlrun.js --port 8831 [--crimes robbery,kidnap,fire] [--runs 2] [--view ipad|phone|both]
//                                 [--punch-only] [--label NAME] [--timeout 240] [--stall 45]
//   --punch-only: never uses heat vision on crooks (a naive player); freeze breath still puts out fires.
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
const PORT = +arg('--port', 8831);
const CRIMES = arg('--crimes', 'petty,mugging,robbery,gang,kidnap,rustlers,fire,heist,mob').split(',');
const RUNS = +arg('--runs', 1);
const VIEWS = { ipad: { width: 1024, height: 768 }, phone: { width: 844, height: 390 } };
const VIEW = arg('--view', 'both');
const PUNCH_ONLY = argv.includes('--punch-only');
const TIMEOUT = +arg('--timeout', 240) * 1000;
const STALL = +arg('--stall', 45) * 1000;
const OUT = path.join(ROOT, 'shots', arg('--label', 'brawlrun'));
fs.mkdirSync(OUT, { recursive: true });

// In-page brain: reads the brawl state and returns which keys to hold / press this tick.
const BRAIN = `window.__bot = (punchOnly) => {
  const g = window.__game, m = g.mode;
  if (g.modeName !== 'brawler') return { end: true, mode: g.modeName };
  if (m.loading !== null) return { wait: true };
  if (m.done) return { done: true };
  const p = m.p; p.hp = 100; // god mode: we test the level flow, not difficulty
  const st = window.__botSt || (window.__botSt = { stuck: 0, last: 0, tgt: null });
  const now = performance.now(), dtb = Math.min(0.5, (now - (st.last || now)) / 1000); st.last = now;
  const out = { x: 0, z: 0, act: null };
  const goTo = (tx, tz, tol = 14) => {
    if (Math.abs(tx - p.x) > tol) out.x = Math.sign(tx - p.x);
    if (Math.abs(tz - p.z) > 0.03) out.z = Math.sign(tz - p.z);
  };
  const foes = m.enemies.filter((e) => !e.dead && e.hp > 0 && !(e.st === 'enter' && e.y > 30));
  let e = null, bd = 1e9;
  for (const o of foes) { const d = Math.abs(o.x - p.x) + Math.abs(o.z - p.z) * 600; if (d < bd) { bd = d; e = o; } }
  const fire = m.fires.filter((f) => f.hp > 0).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  const cap = m.captives.filter((c) => !c.done && !c.blocked).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  if (e) {
    const side = Math.sign(e.x - p.x) || 1, adx = Math.abs(e.x - p.x), dz = Math.abs(e.z - p.z);
    if (e.st === 'down' || e.st === 'getup') { goTo(e.x - side * 70, e.z); }
    else if (adx < 66 && dz < 0.08) {
      if (p.facing !== side) out.x = side; else out.act = 'attack';
    } else goTo(e.x - side * 50, e.z, 8);
    st.stuck = adx < 80 && dz < 0.1 ? 0 : st.stuck + dtb;
    if (!punchOnly && st.stuck > 4 && p.en >= 30 && dz < 0.2) { out.act = 'special'; st.stuck = 0; }
    out.why = 'enemy ' + e.type + ' dx=' + Math.round(e.x - p.x) + ' st=' + e.st;
  } else if (fire && (!cap || Math.abs(fire.x - p.x) <= Math.abs(cap.x - p.x) + 200 || m.captives.some((c) => !c.done && c.blocked))) {
    const tx = fire.x - 180;
    if (Math.abs(tx - p.x) > 60 || Math.abs(fire.z - p.z) > 0.1) goTo(tx, fire.z, 30);
    else if (p.facing !== 1) out.x = 1;
    else if (p.en >= 15 && p.st !== 'breath') out.act = 'special';
    out.why = 'fire hp=' + Math.round(fire.hp);
  } else if (cap) {
    goTo(cap.x, cap.z + 0.02, 30);
    out.why = 'captive freed=' + cap.freed.toFixed(2);
  } else { out.x = 1; out.why = 'walk right'; }
  const ow = m.waves.filter((w) => w.cleared).length, oc = m.captives.filter((c) => c.done).length, of = m.fires.filter((f) => f.hp <= 0).length;
  out.prog = ow * 100 + oc * 10 + of + Math.floor(p.x / 200) * 1000;
  out.obj = ow + '/' + m.waves.length + ' waves, ' + oc + '/' + m.captives.length + ' captives, ' + of + '/' + m.fires.length + ' fires';
  out.px = Math.round(p.x); out.len = m.len;
  return out;
};
window.__botDump = () => {
  const m = window.__game.mode, p = m.p;
  return { t: +m.t.toFixed(1), p: { x: Math.round(p.x), z: +p.z.toFixed(2), st: p.st, en: Math.round(p.en) }, cam: Math.round(m.cam), viewHalf: Math.round(m.viewHalf), len: m.len,
    lock: m.lock ? { x: m.lock.x, queue: m.lock.queue.length } : null,
    waves: m.waves.map((w) => ({ x: w.x, spawned: w.spawned, cleared: w.cleared, queue: w.queue.length })),
    enemies: m.enemies.filter((e) => !e.dead).map((e) => ({ type: e.type, x: Math.round(e.x), z: +e.z.toFixed(2), st: e.st, hp: e.hp })),
    captives: m.captives.map((c) => ({ x: Math.round(c.x), z: +c.z.toFixed(2), done: c.done, blocked: c.blocked })),
    fires: m.fires.map((f) => ({ x: Math.round(f.x), hp: Math.round(f.hp) })) };
};`;

// Close whatever dialog is up, like a player: its button / option if it has one (a .first() over one
// selector list picks in document order, i.e. the dialog's own wrapper, which ignores clicks: a
// "Mission failed" dialog then stayed up, pausing the game, and the next brawl hung on LOADING),
// else tap the dialog itself (the newspaper: "tap to continue").
async function tapModal(page) {
  for (const sel of ['#modal-root .opt:not([disabled])', '#modal-root button:not([disabled])', '#modal-root > *']) {
    const m = page.locator(sel).first();
    if (await m.count()) { await m.click({ force: true }).catch(() => {}); return; }
  }
}

async function runBrawl(page, crime, tag) {
  await page.evaluate((crime) => {
    const g = window.__game; g.setMode('overworld');
    let z = null;
    for (let i = 0; i < 300 && !(z && z.def.id === crime); i++) {
      if (z) g.overworld.zones = g.overworld.zones.filter((o) => o !== z);
      z = g.overworld.spawn('street', true);
    }
    window.__botSt = null; window.__outcome = null;
    if (!g.__ezWrapped) { const ez = g.endZone; g.endZone = (zz, r) => { window.__outcome = r.outcome; return ez(zz, r); }; g.__ezWrapped = true; }
    g.startZone(z);
    g.mode.hurtPlayer = () => {};
  }, crime);
  await page.evaluate(BRAIN);
  const held = new Set();
  const hold = async (keys) => {
    for (const k of held) if (!keys.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of keys) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const t0 = Date.now();
  let best = -1, bestT = Date.now(), last = null, res = null;
  while (true) {
    const o = await page.evaluate((po) => window.__bot(po), PUNCH_ONLY);
    const outcome = await page.evaluate(() => window.__outcome);
    if (o.end || outcome) { res = { ok: outcome === 'win', outcome, ended: o.mode }; break; }
    const stuck = Date.now() - t0 > TIMEOUT;
    if ((o.done || o.wait) && !stuck) {
      // (a dialog left open pauses the game: close it, like a player would)
      await tapModal(page);
      await hold(new Set()); await page.waitForTimeout(200); if (o.wait) bestT = Date.now(); continue;
    }
    last = o;
    if (o.prog > best) { best = o.prog; bestT = Date.now(); }
    const keys = new Set();
    if (o.x > 0) keys.add('KeyD'); if (o.x < 0) keys.add('KeyA');
    if (o.z > 0) keys.add('KeyS'); if (o.z < 0) keys.add('KeyW');
    await hold(keys);
    if (o.act === 'attack') await page.keyboard.press('KeyJ');
    if (o.act === 'special') await page.keyboard.press('KeyK');
    if (Date.now() - bestT > STALL || stuck) {
      const dump = await page.evaluate(() => { try { return window.__botDump(); } catch (e) { return { modal: document.querySelector('#modal-root')?.innerText.slice(0, 200), err: String(e) }; } });
      const shot = path.join(OUT, `${tag}_STALL.png`);
      await page.screenshot({ path: shot });
      res = { ok: false, stalled: true, secs: Math.round((Date.now() - t0) / 1000), last: last && { why: last.why, obj: last.obj, px: last.px, len: last.len }, state: o, dump, shot };
      break;
    }
    await page.waitForTimeout(50);
  }
  await hold(new Set());
  res.secs = res.secs || Math.round((Date.now() - t0) / 1000);
  // a win shows the newspaper ("tap to continue", no button) then flies on: tap until we're flying
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => window.__game.modeName === 'overworld' && !document.querySelector('#modal-root > *'))) break;
    await tapModal(page);
    await page.waitForTimeout(400);
  }
  return res;
}

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = [];
  try {
    for (const vname of VIEW === 'both' ? Object.keys(VIEWS) : [VIEW]) {
      const ctx = await browser.newContext({ viewport: VIEWS[vname], deviceScaleFactor: 1, isMobile: true, hasTouch: true });
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
      await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
      for (let r = 0; r < RUNS; r++) for (const crime of CRIMES) {
        const tag = `${vname}_${crime}_${r}`;
        const nErr = errors.length;
        const res = await runBrawl(page, crime, tag);
        const row = { tag, ...res, errors: errors.slice(nErr) };
        report.push(row);
        console.log(JSON.stringify(row));
        if (res.stalled) { // leave the stuck brawl the way a player would
          await page.evaluate(() => { const g = window.__game; if (g.modeName === 'brawler') g.mode.abort(); });
          await page.waitForTimeout(600);
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  fs.writeFileSync(path.join(OUT, 'brawlrun.json'), JSON.stringify(report, null, 2));
  const ok = report.filter((r) => r.ok).length;
  console.log(`\n${ok}/${report.length} brawls completed → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
