// Travel moments harness (src/moments/): each flight moment called up on demand (?moment=<kind>) and
// played to its resolution by a scripted player (an in-page bot on the stick, the band buttons, BOOST
// and DIVE), with frames captured along the way; plus a "commute": a scripted flight between far
// markers with the director running free, logging what it offered and what was taken.
//   node tools/shots/travel.js [--label r11F-1] [--port 8943] [--only impostor,faller] [--commute] [--secs 180] [--every 6] [--no-moments]
// → shots/<label>/frames/<kind>/f###_<ms>.png, shots/<label>/travel/<kind>_*.png (stills),
//   shots/<label>/strips/<kind>.png (contact sheets), shots/<label>/travel/report.json
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

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
const LABEL = arg('--label', 'travel'), PORT = +arg('--port', 8943), ONLY = arg('--only', null);
const COMMUTE = argv.includes('--commute'), SECS = +arg('--secs', 180), EVERY = +arg('--every', 6);
const OUT = path.join(ROOT, 'shots', LABEL);
const SEED = `(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

/** Moments: kind → clock (in-game minutes), act rank, extra query. Times of day vary across the set. */
const SCENES = {
  impostor: { clock: 18 * 60 + 40, act: 'guardian', band: 1 },
  faller: { clock: 12 * 60, band: 1 },
  car: { clock: 21 * 60 + 30, band: 1 },
  getaway: { clock: 23 * 60, band: 1 },
  heli: { clock: 17 * 60 + 50, band: 1 },
  rings: { clock: 10 * 60, band: 1 },
  kitten: { clock: 13 * 60, band: 1 },
};

// ------------------------------------------------------------------ the in-page player
/* eslint-disable */
function installBot() {
  const g = window.__game, ow = g.overworld, inp = g.input;
  const ax = inp.axis.bind(inp);
  const B = window.__bot = { on: true, log: [], want: null, band: null, boost: false, perch: false, last: 0 };
  const BANDZ = () => [0, 1, 2].map((i) => (ow.view3d ? [110, 560, 1100][i] : [150, 360, 620][i]));
  const nearestBand = (z) => { const b = BANDZ(); let k = 0; for (let i = 1; i < 3; i++) if (Math.abs(b[i] - z) < Math.abs(b[k] - z)) k = i; return k; };
  /** World direction → the camera-relative stick the 3D view expects. */
  const stick = (xw, yw) => {
    const cam = ow.view3d?.cam;
    if (!cam || cam.yaw === null) return { x: xw, y: yw };
    const fx = Math.cos(cam.yaw), fy = Math.sin(cam.yaw);
    return { x: -fy * xw + fx * yw, y: -(fx * xw + fy * yw) };
  };
  const seek = (x, y, { stopAt = 0, slow = 0 } = {}) => {
    const h = ow.hero, dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy) || 1;
    let mag = 1;
    if (slow) mag = Math.max(0.12, Math.min(1, (d - stopAt) / slow));
    if (d < stopAt) mag = 0;
    return mag ? stick((dx / d) * mag, (dy / d) * mag) : { x: 0, y: 0 };
  };
  /** What the bot does this frame for the moment it's playing. */
  B.plan = () => {
    const h = ow.hero, M = ow.moments, m = M.live.find((q) => !q.result && q.kind === B.kind) || M.live.find((q) => !q.result);
    B.boost = false; B.band = null; B.perch = false;
    if (!m) return B.idle ? B.idle() : null;
    const e = m.e, t = m.target ? m.target() : null;
    switch (m.kind) {
      case 'impostor': { B.band = 0; const d = m.dist(); B.boost = d > 700; return seek(m.x, m.y, { slow: 260 }); }
      case 'faller': { B.band = e.phase === 'fall' && e.z > 400 ? nearestBand(e.z) : 0; return seek(e.x, e.y + 4, { stopAt: 10, slow: 200 }); }
      case 'car': case 'getaway': { B.band = 0; B.boost = m.dist() > 500; return seek(e.x, e.y, { slow: 120 }); }
      case 'heli': { B.band = nearestBand(e.z); return seek(e.x, e.y, { slow: 160 }); }
      case 'rings': { const r = e.rings[e.next]; if (!r) return null; B.band = nearestBand(r.z); return seek(r.x, r.y); }
      case 'kitten': { B.band = 0; const d = m.dist(); B.perch = d < 50 && h.speed < 130; return seek(e.x, e.y, { stopAt: 4, slow: 260 }); }
      default: {
        if (!t) return null;
        if (t.band != null) B.band = t.band;
        B.boost = !!t.boost;
        if (t.stick) return stick(t.stick.x, t.stick.y);
        return seek(t.x, t.y, { stopAt: t.stopAt || 0, slow: t.slow || 0 });
      }
    }
  };
  inp.axis = () => {
    if (!B.on) return ax();
    let a = null;
    try { a = B.plan(); } catch (err) { B.log.push(String(err)); }
    const h = ow.hero, now = performance.now();
    if (B.band != null && now - B.last > 450 && !h.perch) {
      if (h.band < B.band) { inp.pressedSet.add('climb'); B.last = now; } else if (h.band > B.band) { inp.pressedSet.add('descend'); B.last = now; }
    }
    if (B.boost) inp.btnHeld.add('boost'); else inp.btnHeld.delete('boost');
    if (B.perch && !h.perch) inp.pressedSet.add('perch');
    else if (!B.perch && h.perch && now - B.last > 450) { inp.pressedSet.add('perch'); B.last = now; } // (a won rooftop rescue: take off again)
    if (B.dive !== false && ow.moments.diveTarget()) inp.pressedSet.add('dive');
    return a || ax();
  };
}
/* eslint-enable */

async function newGame(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e).slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${PORT}/?flight=3d&dynres=off${query ? '&' + query : ''}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.evaluate(() => { const c = document.querySelector('#cutscene'); if (c) for (let i = 0; i < 4; i++) c.click(); });
  await page.waitForTimeout(600);
  await page.click('#btn-new');
  await page.waitForTimeout(600);
  // click through the welcome and any story beats that queue up
  for (let i = 0; i < 40; i++) {
    const top = await page.evaluate(() => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); if (!el) return false; const b = el.querySelector('.opt, .spot-b, .um-go, .cb-close, button'); if (b) b.click(); else el.click(); return true; });
    const cut = await page.evaluate(() => { const c = document.querySelector('#cutscene.on'); if (c) for (let i = 0; i < 4; i++) c.click(); return !!c; });
    if (!top && !cut) { if (i > 6) break; }
    await page.waitForTimeout(350);
  }
  return { ctx, page, errors };
}

/** Keep modals (story beats, dialogs, papers) clicked through while a flow runs. */
async function clearModals(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const el of [...document.querySelectorAll('#modal-root .modal-back')].reverse()) {
      const b = el.querySelector('.opt, .spot-b, .um-go, .cb-close, button');
      if (b) b.click(); else { (el.querySelector('.modal') || el).click(); el.click(); } // (a newspaper: tap to continue)
      n++;
    }
    const c = document.querySelector('#cutscene.on'); if (c) { for (let i = 0; i < 4; i++) c.click(); n++; }
    return n;
  });
}

async function shotTo(page, file) { await page.screenshot({ path: file }); }

/** One moment, called up and played through: frames into frames/<kind>/. */
async function playMoment(browser, kind, sc) {
  const query = [`moment=${kind}`, sc.act ? `act=${sc.act}` : ''].filter(Boolean).join('&');
  const { ctx, page, errors } = await newGame(browser, query);
  const dir = path.join(OUT, 'frames', kind);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const r = { kind, frames: [], errors };
  try {
    await page.evaluate(({ clock, band }) => {
      const g = window.__game, ow = g.overworld;
      g.state.clock = clock; ow.nav.clear(); ow.hero.band = band;
      for (const z of [...ow.zones]) if (!z.storyId && !z.leadId && !z.impostor && Math.hypot(z.x - ow.hero.x, z.y - ow.hero.y) < 900) ow.removeZone(z); // (a clear sky round her)
    }, sc);
    await page.evaluate(installBot);
    await page.evaluate((k) => { window.__bot.kind = k; }, kind);
    const t0 = Date.now();
    // wait for the moment to be offered (story-beat dialogs pause the game: keep clicking them through)
    for (let i = 0; ; i++) {
      await clearModals(page);
      if (await page.evaluate((k) => window.__game.overworld.moments.live.some((m) => m.kind === k), kind)) break;
      if (i > 120) throw new Error(`${kind} was never offered`);
      await page.waitForTimeout(250);
    }
    let n = 0, settled = null;
    while (Date.now() - t0 < (sc.wall || 150000)) {
      await clearModals(page);
      const s = await page.evaluate((k) => {
        const ow = window.__game.overworld, m = ow.moments.live.find((q) => q.kind === k);
        return { t: +ow.t.toFixed(2), result: m ? m.result : 'gone', state: m?.state || m?.e?.phase || null, d: m ? Math.round(m.dist()) : null, z: Math.round(ow.hero.z), slow: ow.moments.scale };
      }, kind);
      const f = `f${String(n).padStart(3, '0')}_${Math.round(s.t * 1000)}.png`;
      await shotTo(page, path.join(dir, f));
      r.frames.push({ f, ...s });
      n++;
      if (s.result && !settled) settled = Date.now();
      if (settled && Date.now() - settled > (sc.after || 2500)) break;
      await page.waitForTimeout(sc.gap || 500);
    }
    r.result = r.frames.length ? r.frames[r.frames.length - 1].result : null;
    r.log = await page.evaluate(() => window.__game.overworld.moments.log);
    r.bot = await page.evaluate(() => window.__bot.log.slice(0, 5));
    r.metrics = await page.evaluate(() => { const i = window.__game.overworld.renderer?.info; return i ? { calls: i.render.calls, tris: i.render.triangles, tex: i.memory.textures, geo: i.memory.geometries } : null; });
  } catch (e) {
    r.fail = String(e.message || e).split('\n')[0];
    await page.screenshot({ path: path.join(dir, 'FAILED.png') }).catch(() => {});
  }
  await ctx.close();
  return r;
}

/** Pick ~7 frames spread over spawn → test → resolution and build a contact sheet. */
function strip(kind, r) {
  const src = path.join(OUT, 'frames', kind), sel = path.join(OUT, 'strips', `_${kind}`);
  fs.rmSync(sel, { recursive: true, force: true }); fs.mkdirSync(sel, { recursive: true });
  const F = r.frames;
  if (!F.length) return null;
  const end = F.findIndex((q) => q.result) + 3, last = Math.min(F.length - 1, end > 2 ? end : F.length - 1);
  const pickN = 7, idx = new Set();
  for (let i = 0; i < pickN; i++) idx.add(Math.round((i / (pickN - 1)) * last));
  for (const i of idx) fs.copyFileSync(path.join(src, F[i].f), path.join(sel, F[i].f));
  const out = path.join(OUT, 'strips', `${kind}.png`);
  try { execFileSync('python', [path.join(__dirname, 'sheet.py'), sel, out, '4', '420'], { stdio: 'pipe' }); } catch (e) { return null; }
  return out;
}

// ------------------------------------------------------------------ the commute
/* eslint-disable */
function commuteSetup(every) {
  const g = window.__game, ow = g.overworld, M = ow.moments;
  const B = window.__bot;
  // two far markers: the pair of incidents furthest apart
  const zs = ow.zones.filter((z) => !z.impostor && !z.polaroid);
  let a = zs[0], b = zs[1], best = 0;
  for (const p of zs) for (const q of zs) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d > best) { best = d; a = p; b = q; } }
  window.__legs = [a, b];
  window.__leg = 0;
  Object.assign(ow.hero, { x: a.x + 300, y: a.y + 300 });
  ow.nav.set({ x: b.x, y: b.y, name: b.name, ref: b });
  window.__taken = new Set();
  // the commuting player: take most offers (detour, play it), skip some, then back on the route
  B.kind = null;
  B.idle = () => {
    const legs = window.__legs, t = legs[window.__leg % 2];
    if (!ow.nav.target || Math.hypot(t.x - ow.hero.x, t.y - ow.hero.y) < 400) { window.__leg++; const n = legs[window.__leg % 2]; ow.nav.set({ x: n.x, y: n.y, name: n.name }); }
    B.band = 1;
    return { x: 0, y: 0 }; // (autopilot flies the waypoint)
  };
  const plan0 = B.plan;
  B.plan = () => {
    const live = M.live.filter((m) => !m.result);
    for (const m of live) if (!window.__taken.has(m) && !m.__decided) { m.__decided = true; if (Math.random() < 0.75) window.__taken.add(m); }
    const m = live.find((q) => window.__taken.has(q));
    B.kind = m ? m.kind : null;
    if (!m) return B.idle();
    return plan0();
  };
}
/* eslint-enable */

async function commute(browser) {
  const { ctx, page, errors } = await newGame(browser, argv.includes('--no-moments') ? 'moments=off' : '');
  const dir = path.join(OUT, 'frames', 'commute');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const r = { frames: [], errors };
  try {
    await page.evaluate(() => { const g = window.__game; g.state.clock = 17 * 60 + 30; g.state.rep = 160; });
    await page.evaluate(installBot);
    await page.evaluate(commuteSetup);
    let next = 0, n = 0, prev = null, liveSecs = 0;
    const tEnd = SECS, timeline = [];
    while (true) {
      await clearModals(page);
      const s = await page.evaluate(() => { const ow = window.__game.overworld; return { t: ow.moments.clock, live: ow.moments.live.filter((m) => !m.result).map((m) => m.kind) }; });
      if (prev && prev.live.length) liveSecs += Math.max(0, s.t - prev.t); // (seconds with a live offer up)
      if (!prev || prev.live.join() !== s.live.join()) timeline.push(`${s.t.toFixed(1)}s ${s.live.join('+') || '-'}`);
      prev = s;
      if (s.t >= next) {
        const f = `f${String(n).padStart(3, '0')}_${Math.round(s.t * 1000)}.png`;
        await shotTo(page, path.join(dir, f)); r.frames.push({ f, ...s }); n++; next += EVERY;
      }
      if (s.t >= tEnd) break;
      await page.waitForTimeout(250);
    }
    r.log = await page.evaluate(() => window.__game.overworld.moments.log);
    r.liveSecs = +liveSecs.toFixed(1); r.timeline = timeline;
    r.offers = r.log.filter((q) => q.ev === 'offered').length;
    r.commute = await page.evaluate(() => ({ commuteSecs: window.__game.overworld.moments.commute, clock: window.__game.overworld.moments.clock }));
  } catch (e) { r.fail = String(e.message || e).split('\n')[0]; }
  await ctx.close();
  return r;
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'travel'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'strips'), { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = {};
  try {
    if (COMMUTE) {
      report.commute = await commute(browser);
      console.log('commute', JSON.stringify({ ...report.commute, frames: report.commute.frames.length }));
    } else {
      for (const [kind, sc] of Object.entries(SCENES)) {
        if (ONLY && !ONLY.split(',').includes(kind)) continue;
        const r = await playMoment(browser, kind, sc);
        r.strip = strip(kind, r);
        report[kind] = { ...r, frames: r.frames.length, path: r.frames.map((q) => `${q.t}s ${q.state || ''} d${q.d} z${q.z}${q.result ? ' ' + q.result : ''}`) };
        console.log(kind, JSON.stringify({ result: r.result, frames: r.frames.length, errors: r.errors.slice(0, 3), fail: r.fail, metrics: r.metrics, log: r.log }));
      }
    }
  } finally {
    await browser.close();
    srv.kill();
  }
  const file = path.join(OUT, 'travel', COMMUTE ? 'commute.json' : `report${ONLY ? '-' + ONLY.replace(/,/g, '-') : ''}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('→', file);
})().catch((e) => { console.error(e); process.exit(1); });
