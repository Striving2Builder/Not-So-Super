// Dive-transition capture: flies to an incident, presses DIVE and records the screen as a frame
// sequence (CDP screencast: every frame the compositor produces, with its timestamp), then builds a
// contact sheet per case with tools/shots/sheet.py. Phone viewport (844x390 @2x, touch).
//
//   node tools/shots/dive.js [--port 8841] [--label dive] [--cases brawl3d,club3d,brawl2d,club2d] [--secs 3.2] [--reduced]
//   cases: <zone><view> — zone: brawl | club | cold (a club still downloading) | inv | spec (a self-built 3D zone) ; view: 3d | 2d
// Output: shots/<label>/<case>/f###_<ms>.jpg + shots/<label>/<case>.png (sheet) + errors in log.json.
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

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
const PORT = +arg('--port', 8841);
const LABEL = arg('--label', 'dive');
const CASES = arg('--cases', 'brawl3d,club3d,brawl2d,club2d').split(',');
const SECS = +arg('--secs', 2.4);
const REDUCED = argv.includes('--reduced');
const COLS = +arg('--cols', 5), PICK = +arg('--pick', 20), EVERY = +arg('--every', 3); // EVERY: shoot every Nth 60 Hz frame
const OUT = path.join(ROOT, 'shots', LABEL);

const ZONE = {
  brawl: (g) => { g.state.clock = 21 * 60; return g.overworld.spawn('street', true); },
  club: (g) => g.overworld.spawn('special', true, 'Triangle Club'),
  spec: (g) => g.overworld.spawn('special', true, 'Warehouse'),
  cold: (g) => g.overworld.spawn('special', true, 'The Clubhouse'), // dived at once: the club isn't preloaded
  inv: (g) => { let z = null; for (let i = 0; i < 40 && !(z && z.mode === 'investigate'); i++) { g.state.clock = 12 * 60; z = g.overworld.spawn('case', true); } return z; },
};

// Switchable virtual clock (off until __vtOn): performance.now, requestAnimationFrame, setTimeout,
// and every CSS/Web animation (paused, then moved on by hand in __vtStep).
const VTIME = `(() => {
  const P = performance.now.bind(performance), RAF = window.requestAnimationFrame.bind(window), ST = window.setTimeout.bind(window);
  let on = false, vt = 0, raf = [], tm = [], id = 1;
  performance.now = () => (on ? vt : P());
  window.requestAnimationFrame = (cb) => (on ? (raf.push(cb), -1) : RAF(cb));
  window.setTimeout = (cb, ms, ...a) => { if (!on) return ST(cb, ms, ...a); const i = id++; tm.push({ i, at: vt + (ms || 0), cb, a }); return i; };
  const CT = window.clearTimeout.bind(window);
  window.clearTimeout = (i) => { tm = tm.filter((t) => t.i !== i); CT(i); };
  window.__vtOn = () => { vt = P(); on = true; };
  window.__vtStep = (ms) => {
    vt += ms;
    for (const t of tm.filter((t) => t.at <= vt)) { tm = tm.filter((x) => x !== t); try { typeof t.cb === 'function' && t.cb(...t.a); } catch (e) { console.error(e); } }
    const q = raf; raf = [];
    for (const cb of q) { try { cb(vt); } catch (e) { console.error(e); } }
    for (const an of document.getAnimations()) {
      if (!an.__v) { an.__v = true; an.pause(); an.currentTime = 0; continue; }
      const t = an.effect && an.effect.target; // (a CSS animation-play-state: paused hold is honoured)
      if (an.animationName && t && getComputedStyle(t).animationPlayState.includes('paused')) continue;
      an.currentTime = (an.currentTime || 0) + ms;
    }
  };
})();`;

async function run(browser, name) {
  const zone = name.replace(/(2d|3d)$/, ''), view = name.slice(-2);
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.addInitScript(VTIME);
  await page.addInitScript(`(() => { let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`);
  await page.goto(`http://localhost:${PORT}/?flight=${view}&dynres=off`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  await page.waitForTimeout(800);
  await page.click('#btn-new');
  await page.waitForTimeout(600);
  const opt = page.locator('#modal-root .opt').first();
  if (await opt.count()) await opt.click();
  await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
  // put her over a fresh incident, cruising toward it
  await page.evaluate((src) => {
    const g = window.__game, ow = g.overworld;
    g.setMode('overworld'); ow.nav.autopilot = false;
    const z = (0, eval)(src)(g);
    Object.assign(ow.hero, { x: z.x - 40, y: z.y + 60, ang: -Math.PI / 2, vx: 0, vy: -200, speed: 200 });
    window.__diveZone = z;
  }, ZONE[zone].toString());
  await page.waitForTimeout(zone === 'cold' ? 100 : 2500);
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Virtual time from the dive on: each step runs one 60 Hz game frame and advances every CSS
  // animation by the same 1/60 s, so the frames show the timing a phone at 60 fps would (SwiftShader
  // itself manages ~7 fps, which would turn the dive into slow motion).
  await page.evaluate(() => window.__vtOn());
  await page.evaluate(() => { const ow = window.__game.overworld; ow.near = window.__diveZone; ow.tryDive(); });
  const frames = [];
  const steps = Math.round(SECS * 60);
  for (let i = 0; i <= steps; i++) {
    if (i % EVERY === 0) frames.push({ data: await page.screenshot({ type: 'jpeg', quality: 82 }), ms: Math.round((i * 1000) / 60) });
    await page.evaluate(() => window.__vtStep(1000 / 60));
  }
  const mode = await page.evaluate(() => window.__game.modeName);
  // keep up to PICK frames spread evenly in time (all of them if fewer)
  const fr = frames;
  let keep = fr;
  if (fr.length > PICK) { keep = []; for (let i = 0; i < PICK; i++) keep.push(fr[Math.round((i * (fr.length - 1)) / (PICK - 1))]); }
  keep.forEach((f, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}_${f.ms}.jpg`), f.data));
  await ctx.close();
  try { execFileSync('python', [path.join(__dirname, 'sheet.py'), dir, path.join(OUT, `${name}.png`), String(COLS)], { stdio: 'inherit' }); } catch (e) { console.error('sheet failed', e.message); }
  return { frames: fr.length, kept: keep.length, mode, errors };
}

(async () => {
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const log = {};
  try {
    for (const c of CASES) {
      try { log[c] = await run(browser, c); } catch (e) { log[c] = { failed: e.message.split('\n')[0] }; }
      console.log(c, JSON.stringify(log[c]));
    }
  } finally { await browser.close(); srv.kill(); }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 2));
  console.log(`\nsheets → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
