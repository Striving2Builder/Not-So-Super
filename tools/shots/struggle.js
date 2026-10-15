// The S-shield struggle (src/club3d/struggle.js) on a synthetic thumb: pointer events dispatched in the
// page along the S at ~1.5 s a trace, with jitter and a thumb's S that isn't the pad's (a bit taller,
// skewed), the way a phone delivers them. Runs: normal + hard traced back and forth without lifting,
// hard lifting between traces, a wander off the S (must say the miss line, once per 1.2 s at most),
// standing still (drains), the keyboard roll, and the test hook's trace().
//   node tools/shots/struggle.js [--label d1] [--port 8961] [--w 844 --h 390] [--runs pingpong,hard,lift,wander,still,keys,hook]
// → shots/<label>/struggle/*.png + report.json
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
const LABEL = arg('--label', 'd1'), PORT = +arg('--port', 8961);
const W = +arg('--w', 844), H = +arg('--h', 390);
const RUNS = arg('--runs', 'pingpong,hard,lift,wander,still,keys,hook').split(',');
const OUT = path.join(ROOT, 'shots', LABEL, 'struggle');

// in the page: start a struggle, then trace it with a synthetic thumb. opts: { diff, mode, secsPer, jitter }
async function run(page, opts) {
  return page.evaluate(async (o) => {
    const { struggle, S_PATH } = await import('/src/club3d/struggle.js');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const t0 = performance.now();
    const done = struggle({ clip: null, title: 'BREAK FREE!', text: 'A synthetic thumb.', diff: o.diff }).then((ok) => ({ ok, secs: +((performance.now() - t0) / 1000).toFixed(2) }));
    await sleep(50);
    const el = document.querySelector('.c3-struggle'), H = window.__struggle;
    const padW = document.querySelector('.st-shield').getBoundingClientRect().width;
    // the thumb's S: the ghost's size, a bit taller and skewed (nobody draws the pad's exact S)
    const k = (padW / 468) * 2.4 * (o.scale || 1); // (2.4: the ghost S's size)
    const cx = innerWidth * 0.55, cy = innerHeight * 0.55;
    const toScreen = ([x, y], off) => [cx + off[0] + (x - 250) * k + (y - 125) * 0.08 * k, cy + off[1] + (y - 125) * k * (o.tall || 1.12)];
    const L = []; let acc = 0; for (let i = 0; i < S_PATH.length; i++) { if (i) acc += Math.hypot(S_PATH[i][0] - S_PATH[i - 1][0], S_PATH[i][1] - S_PATH[i - 1][1]); L.push(acc); }
    const along = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / (L[i] - L[i - 1] || 1), a = S_PATH[i - 1], b = S_PATH[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    const id = 7, j = () => (Math.random() * 2 - 1) * (o.jitter ?? 4);
    let pos = null;
    const ev = (type, x, y) => { pos = [x, y]; (type === 'pointerdown' ? el : document.body).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 })); };
    const log = [], says = [];
    let lastWhy = [];
    const watch = setInterval(() => { const s = H.state(); lastWhy = s.whyMiss; if (s.say && says[says.length - 1]?.say !== s.say) says.push({ say: s.say, t: +s.t.toFixed(2) }); if (!s.say && says.length) says.push({ say: '', t: +s.t.toFixed(2) }); }, 40);
    const step = 16;
    // (on the page's clock: a phone sends a move every ~16 ms however busy the page is)
    const trace = async (rev, off, upto = 1) => {
      const T = (o.secsPer || 1.5) * 1000, a = performance.now();
      for (;;) {
        if (!window.__struggle) return;
        const u = Math.min(upto, (performance.now() - a) / T), s = acc * (rev ? 1 - u : u);
        const p = toScreen(along(s), off); ev('pointermove', p[0] + j(), p[1] + j());
        if (u >= upto) return;
        await sleep(step);
      }
    };
    const off = [0, 0];
    if (o.mode === 'keys') {
      const seq = ['KeyW', 'KeyD', 'KeyS', 'KeyA']; let held = [];
      const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      for (let i = 0; i < 200 && window.__struggle; i++) {
        const c = seq[i % 4]; key('keydown', c); held.push(c); await sleep(70);
        if (held.length > 1) key('keyup', held.shift()); await sleep(70);
      }
    } else if (o.mode === 'hook') {
      for (let i = 0; i < 9 && window.__struggle; i++) { H.trace(); log.push(H.state().traces); await sleep(100); }
    } else if (o.mode === 'still') {
      ev('pointerdown', ...toScreen(S_PATH[0], off));
      await trace(false, off, 0.6); log.push(['traced', +H.state().cur.toFixed(2)]);
      await sleep(1500); log.push(['still', +H.state().cur.toFixed(2), H.state().stalled]);
      H.lose();
    } else if (o.mode === 'wander') {
      for (let r = 0; r < 4 && window.__struggle; r++) {
        if (pos) { ev('pointerup', ...pos); await sleep(400); }
        ev('pointerdown', ...toScreen(S_PATH[0], off));
        await trace(false, off, 0.45);
        log.push(['before', +H.state().cur.toFixed(2)]);
        for (let i = 0; i < 20; i++) { ev('pointermove', pos[0] + 3, pos[1] + 6); await sleep(step); } // off down the screen
        log.push(['after', +H.state().cur.toFixed(2), H.state().misses]);
        await sleep(r === 0 ? 100 : 300);
      }
      H.lose();
    } else {
      // pingpong: back and forth without lifting; lift: each trace from the top, lifting between them
      ev('pointerdown', ...toScreen(S_PATH[0], off));
      for (let r = 0; r < 12 && window.__struggle; r++) {
        if (o.mode === 'lift') {
          ev('pointerup', ...pos); await sleep(220);
          off[0] = (Math.random() * 2 - 1) * 60; off[1] = (Math.random() * 2 - 1) * 30;
          ev('pointerdown', ...toScreen(S_PATH[0], off));
        }
        await trace(o.mode === 'lift' ? false : r % 2 === 1, off);
        log.push(window.__struggle ? [+window.__struggle.state().t.toFixed(2), window.__struggle.state().misses] : 'end');
      }
      if (window.__struggle) ev('pointerup', ...pos);
    }
    const res = await done, why = lastWhy;
    clearInterval(watch);
    return { ...res, why, log, says: says.filter((q, i) => q.say || (says[i - 1] && says[i - 1].say)) };
  }, opts);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const report = { runs: {}, errors: [] };
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => report.errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) report.errors.push(m.text()); });
  try {
    await page.goto(`http://localhost:${PORT}/?flight=2d`);
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    await page.evaluate(() => document.body.classList.add('touch'));
    await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(400);
    const shoot = async (n, wait) => { await page.waitForFunction(wait, null, { timeout: 20000, polling: 20 }).catch(() => {}); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };
    const cases = {
      pingpong: { diff: 'normal', mode: 'pingpong' },
      hard: { diff: 'hard', mode: 'pingpong' },
      lift: { diff: 'hard', mode: 'lift' },
      sloppy: { diff: 'hard', mode: 'pingpong', jitter: 8, scale: 1.25, tall: 1.4, secsPer: 2.2 }, // a big, tall, shaky, slow S
      small: { diff: 'hard', mode: 'lift', jitter: 5, scale: 0.75, tall: 1.0, secsPer: 1.8 },      // a small one, lifting
      tiny: { diff: 'normal', mode: 'pingpong', jitter: 3, scale: 0.5, tall: 1.2, secsPer: 1.5 },  // a cramped thumb
      big: { diff: 'hard', mode: 'pingpong', jitter: 6, scale: 1.6, tall: 0.9, secsPer: 1.8 },     // a sweeping one
      wander: { diff: 'normal', mode: 'wander' },
      still: { diff: 'normal', mode: 'still' },
      keys: { diff: 'normal', mode: 'keys' },
      hook: { diff: 'hard', mode: 'hook' },
    };
    for (const name of RUNS) {
      const c = cases[name]; if (!c) continue;
      const p = run(page, c);
      if (name === 'pingpong') {
        await shoot('s1_hint', () => document.querySelector('.c3-struggle.gesture'));
        await shoot('s2_tracing', () => window.__struggle && window.__struggle.state().cur > 0.55);
        await shoot('s3_win', () => document.querySelector('.st-say.on.win'));
      }
      if (name === 'wander') await shoot('s4_miss', () => document.querySelector('.st-say.on.miss'));
      if (name === 'still') await shoot('s5_stall', () => document.querySelector('.c3-struggle.stall'));
      report.runs[name] = await p;
      const D = { normal: 12, hard: 14 }[c.diff];
      const r = report.runs[name];
      console.log(name, c.diff, r.ok ? `WON in ${r.secs}s (${(D - r.secs).toFixed(1)}s to spare)` : `lost after ${r.secs}s`, JSON.stringify(r.log), 'misses:', r.why.join(' '), 'lines:', r.says.filter((q) => q.say).map((q) => `${q.say.slice(0, 8)}@${q.t}`).join(' '));
      await page.waitForTimeout(400);
    }
  } catch (e) { report.errors.push('harness: ' + e.message); }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log('errors', report.errors.length, report.errors.slice(0, 5));
  await browser.close(); srv.kill();
})();
