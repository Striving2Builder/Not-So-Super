// Stability harness: flying (3D) → dive into a zone → back to flying, several times, on an iPad
// descriptor in WebKit (closest to iOS Safari we can run) and/or Chromium. Per transition it reports
// how long the call blocked, the longest frame gap in the next seconds, the time until frames are
// steady again, the live WebGL contexts and an estimate of GPU memory across every context
// (textures, buffers, renderbuffers, drawing buffers), plus the JS heap where the browser has one.
//
//   node tools/shots/stab.js [--browser webkit|chromium|both] [--port 8801] [--rounds 2] [--lose]
//   --lose  also loses + restores the shared WebGL context mid-flight (WEBGL_lose_context)
//   --overlay dir  serve dir's files over the checkout's (e.g. a frozen baseline src/)
//   --tour N  first flies a tour of the whole city (N stops, day and night) and reports memory after it
const path = require('path');
const fs = require('fs');
const serve = require('./serve.js');

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
const PORT = +arg('--port', 8801);
const ROUNDS = +arg('--rounds', 2);
const WHICH = arg('--browser', 'both');
const LOSE = argv.includes('--lose');
const QUERY = arg('--query', '');
const OUT = arg('--out', null);

// Runs in the page before any game code: counts WebGL contexts and estimates their GPU memory.
const GL_TRACK = `(() => {
  const S = window.__glt = { made: 0, ctxs: [], bytes: new Map() };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const c = orig.call(this, type, attrs);
    if (c && /webgl/.test(type) && !S.ctxs.some((x) => x.gl === c)) { S.made++; S.ctxs.push({ gl: c, canvas: this, aa: !attrs || attrs.antialias !== false, id: S.made }); }
    return c;
  };
  const wrap = (P) => {
    if (!P) return;
    const o = {}; for (const k of ['bindTexture', 'texImage2D', 'texStorage2D', 'compressedTexImage2D', 'deleteTexture', 'bindBuffer', 'bufferData', 'deleteBuffer', 'bindRenderbuffer', 'renderbufferStorage', 'renderbufferStorageMultisample', 'deleteRenderbuffer', 'texImage3D', 'texStorage3D']) o[k] = P[k];
    const put = function (obj, key, b) { if (!obj) return; let m = S.bytes.get(obj); if (!m) { m = new Map(); S.bytes.set(obj, m); } m.gl = this; m.set(key, b); };
    P.bindTexture = function (t, x) { (this.__bt || (this.__bt = {}))[t] = x; return o.bindTexture.apply(this, arguments); };
    P.bindBuffer = function (t, x) { (this.__bb || (this.__bb = {}))[t] = x; return o.bindBuffer.apply(this, arguments); };
    P.bindRenderbuffer = function (t, x) { this.__br = x; return o.bindRenderbuffer.apply(this, arguments); };
    const texT = (gl, target) => (target >= 0x8515 && target <= 0x851A ? 0x8513 : target); // cube faces → cube map
    P.texImage2D = function (target, level) {
      let w, h;
      if (arguments.length >= 8) { w = arguments[3]; h = arguments[4]; } else { const s = arguments[5]; w = s && (s.videoWidth || s.naturalWidth || s.width) || 0; h = s && (s.videoHeight || s.naturalHeight || s.height) || 0; }
      put.call(this, this.__bt && this.__bt[texT(this, target)], target + ':' + level, w * h * 4);
      return o.texImage2D.apply(this, arguments);
    };
    P.compressedTexImage2D = function (target, level) { const d = arguments[arguments.length - 1]; put.call(this, this.__bt && this.__bt[texT(this, target)], target + ':' + level, d && d.byteLength || 0); return o.compressedTexImage2D.apply(this, arguments); };
    if (o.texStorage2D) P.texStorage2D = function (target, levels, fmt, w, h) { put.call(this, this.__bt && this.__bt[target], 'st', w * h * 4 * (levels > 1 ? 1.33 : 1) * (target === 0x8513 ? 6 : 1)); return o.texStorage2D.apply(this, arguments); };
    if (o.texImage3D) P.texImage3D = function (target, level, fmt, w, h, d) { put.call(this, this.__bt && this.__bt[target], target + ':' + level, w * h * d * 4); return o.texImage3D.apply(this, arguments); };
    if (o.texStorage3D) P.texStorage3D = function (target, levels, fmt, w, h, d) { put.call(this, this.__bt && this.__bt[target], 'st', w * h * d * 4 * (levels > 1 ? 1.33 : 1)); return o.texStorage3D.apply(this, arguments); };
    P.deleteTexture = function (x) { S.bytes.delete(x); return o.deleteTexture.apply(this, arguments); };
    // mip chains: +1/3 of the base level (generateMipmap after the upload)
    const gm = P.generateMipmap;
    P.generateMipmap = function (target) { const t = this.__bt && this.__bt[target], m = t && S.bytes.get(t); if (m && !m.has('mip') && !m.has('st')) { let b = 0; for (const v of m.values()) b += v; m.set('mip', b / 3); } return gm.apply(this, arguments); };
    P.bufferData = function (t, d) { put.call(this, this.__bb && this.__bb[t], 'b', typeof d === 'number' ? d : (d && d.byteLength) || 0); return o.bufferData.apply(this, arguments); };
    P.deleteBuffer = function (x) { S.bytes.delete(x); return o.deleteBuffer.apply(this, arguments); };
    P.renderbufferStorage = function (t, f, w, h) { put.call(this, this.__br, 'r', w * h * 4); return o.renderbufferStorage.apply(this, arguments); };
    if (o.renderbufferStorageMultisample) P.renderbufferStorageMultisample = function (t, s, f, w, h) { put.call(this, this.__br, 'r', w * h * 4 * Math.max(1, s)); return o.renderbufferStorageMultisample.apply(this, arguments); };
    P.deleteRenderbuffer = function (x) { S.bytes.delete(x); return o.deleteRenderbuffer.apply(this, arguments); };
  };
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  // biggest live objects: [MB, kind, context id]
  S.top = (n = 12) => [...S.bytes.entries()].map(([o, m]) => { let b = 0; for (const v of m.values()) b += v; const c = S.ctxs.find((x) => x.gl === m.gl); return [+(b / 1048576).toFixed(2), o.constructor.name.replace('WebGL', ''), c ? c.id : '?']; }).sort((a, b) => b[0] - a[0]).slice(0, n);
  S.perCtx = () => { const r = {}; for (const m of S.bytes.values()) { const c = S.ctxs.find((x) => x.gl === m.gl), k = c ? c.id + (c.gl.isContextLost() ? 'x' : '') + ' ' + c.canvas.width + 'x' + c.canvas.height : '?'; let b = 0; for (const v of m.values()) b += v; r[k] = +(((r[k] || 0) + b / 1048576)).toFixed(1); } return r; };
  S.report = () => {
    let res = 0, n = 0;
    for (const m of S.bytes.values()) { if (m.gl && m.gl.isContextLost()) continue; n++; for (const b of m.values()) res += b; }
    let live = 0, draw = 0;
    for (const c of S.ctxs) {
      if (c.gl.isContextLost()) continue;
      live++;
      draw += c.canvas.width * c.canvas.height * 4 * (c.aa ? 4 + 1 : 2); // back (+MSAA) + front buffer, roughly
    }
    return { made: S.made, live, objects: n, resMB: +(res / 1048576).toFixed(1), drawMB: +(draw / 1048576).toFixed(1), cv2dMB: S.canvasMB() };
  };
  // 2D canvases still alive (weakly held: a canvas the game dropped stops counting once collected),
  // e.g. the ground tiles' and plan's paint canvases; WebGL canvases are counted as drawing buffers
  const cvs = [], ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t) { const e = ce.apply(this, arguments); if (/^canvas$/i.test(t)) cvs.push(new WeakRef(e)); return e; };
  S.canvasMB = () => { let b = 0; for (const r of cvs) { const c = r.deref(); if (c && !S.ctxs.some((x) => x.canvas === c)) b += c.width * c.height * 4; } return +(b / 1048576).toFixed(1); };
  // frame gaps
  const F = window.__frames = [];
  const tick = (t) => { F.push(t); if (F.length > 20000) F.splice(0, 10000); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

async function heap(page, cdp) {
  if (cdp) { const m = await cdp.send('Performance.getMetrics'); const v = m.metrics.find((x) => x.name === 'JSHeapUsedSize'); return v ? +(v.value / 1048576).toFixed(0) : null; }
  return page.evaluate(() => (performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null));
}

const ZONES = {
  brawler: `(() => { const g = window.__game; let z = null; for (let i = 0; i < 60 && !z; i++) z = g.overworld.spawn('street', true); return z; })()`,
  investigate: `(() => { const g = window.__game; let z = null; for (let i = 0; i < 60 && !(z && z.mode === 'investigate'); i++) { g.state.clock = 12 * 60; z = g.overworld.spawn('case', true); } return z; })()`,
  special: `(() => window.__game.overworld.spawn('special', true, 'Warehouse'))()`,
};
const READY = {
  overworld: `(() => { const g = window.__game, ow = g.overworld; return g.modeName === 'overworld' && (!ow.view3d || document.body.classList.contains('fly3d')); })()`,
  brawler: `(() => !!window.__game.mode.coreWarm)()`,
  investigate: `(() => { const m = window.__game.mode; return !m.paint || !!(m.lay && m.lay.baseKey); })()`,
  special: `(() => { const m = window.__game.mode; return !!(m.hero && m.scene && !m.warming); })()`,
};

/** Run fn (a string evaluated in the page) as a transition and measure it. */
async function transition(page, cdp, label, js, readyJs) {
  const t0 = await page.evaluate(() => performance.now());
  const sync = await page.evaluate(`(() => { const a = performance.now(); ${js}; return performance.now() - a; })()`);
  // wait until ready (≤ 25 s) then 2 s more for stragglers
  const tReady = await page.evaluate(async (readyJs) => {
    const a = performance.now();
    while (performance.now() - a < 25000) { try { if (eval(readyJs)) return performance.now(); } catch (e) { /* not yet */ } await new Promise((r) => setTimeout(r, 50)); }
    return null;
  }, readyJs);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(([t0, tReady]) => {
    const F = window.__frames.filter((t) => t >= t0 - 1);
    const gaps = []; for (let i = 1; i < F.length; i++) gaps.push([F[i], F[i] - F[i - 1]]);
    const tail = gaps.slice(-40).map((g) => g[1]).sort((a, b) => a - b), med = tail[tail.length >> 1] || 16;
    // steady: the first frame after which 8 frames in a row run under max(2 × steady median, 50 ms)
    const lim = Math.max(2 * med, 50);
    let steady = null;
    for (let i = 0; i + 8 <= gaps.length; i++) if (gaps.slice(i, i + 8).every((g) => g[1] < lim)) { steady = gaps[i][0] - gaps[i][1]; break; }
    const longest = gaps.reduce((m, g) => Math.max(m, g[1]), 0);
    const over = gaps.filter((g) => g[1] > 100).length;
    return { longest: Math.round(longest), over100: over, readyMs: tReady ? Math.round(tReady - t0) : null, steadyMs: steady !== null ? Math.round(Math.max(steady, tReady || 0) - t0) : null, medFrame: Math.round(med), gl: window.__glt.report(), perCtx: window.__glt.perCtx(), top: window.__glt.top(8) };
  }, [t0, tReady]);
  return { label, syncMs: Math.round(sync), ...r, heapMB: await heap(page, cdp) };
}

/**
 * Lose the shared WebGL context while flying. restore: the browser gives it back after 1.5 s;
 * never: it doesn't (the game must rebuild the renderer); nogl: it doesn't and no new context can
 * be made either (the game must fall back to 2D flight, deliberately).
 */
async function loseTest(page, how) {
  const r = await page.evaluate(async (how) => {
    const g = window.__game, r0 = g.modes.special.renderer, ext = r0.getContext().getExtension('WEBGL_lose_context');
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    if (how === 'nogl') { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { return /webgl/.test(t) ? null : o.call(this, t, a); }; }
    ext.loseContext();
    await sleep(1500);
    const shown = !!document.querySelector('#gfx-panel.on'), tick = g.overworld.t;
    await sleep(500);
    const paused = g.overworld.t === tick;
    if (how === 'restore') ext.restoreContext();
    await sleep(how === 'restore' ? 2000 : 4500);
    const r1 = g.modes.special.renderer;
    return { how, panelWhileLost: shown, simPaused: paused, rebuilt: !!r1 && r1 !== r0, glOk: !!r1 && !r1.getContext().isContextLost(), panelAfter: !!document.querySelector('#gfx-panel.on'),
      fly3d: document.body.classList.contains('fly3d'), view3d: !!g.overworld.view3d, toast: document.getElementById('toasts')?.textContent.slice(0, 90) };
  }, how);
  await page.screenshot({ path: path.join(ROOT, 'shots', 'stab', `lose_${how}.png`) });
  return { label: `lose (${how})`, ...r, gl: await page.evaluate(() => window.__glt.report()) };
}

/**
 * Fly straight out across the city for `out` s in a band (stick held forward), then pull a U-turn
 * and fly back over what was just freed: the frame gaps after the turn are the rebuild hitch.
 */
async function turnBack(page, cdp, band, out = 10, back = 9) {
  await page.evaluate((band) => {
    const g = window.__game, ow = g.overworld, h = ow.hero, c = g.city;
    if (!window.__axisHooked) { window.__axisHooked = true; const ax = g.input.axis.bind(g.input); g.input.axis = () => window.__axis || ax(); }
    if (ow.view3d) ow.view3d.steer = (a) => a; // (the stick in world axes: east out, west back)
    // time the city's update (builds, tile paints) and the whole 3D frame (+ uploads) on the CPU
    const v = ow.view3d, T = window.__tb = { city: 0, frame: 0 };
    if (v && !v.__timed) {
      v.__timed = true;
      const cu = v.city3.update.bind(v.city3), vr = v.render.bind(v);
      const c3 = v.city3, bu = c3.build.bind(c3), pt = c3.art.paintTile.bind(c3.art);
      let nb = 0, np = 0, bt = 0, ptm = 0;
      c3.build = (...a) => { const t = performance.now(); bu(...a); bt += performance.now() - t; nb++; };
      c3.art.paintTile = (...a) => { const t = performance.now(); pt(...a); ptm += performance.now() - t; np++; };
      v.city3.update = (...a) => {
        nb = np = 0; bt = ptm = 0;
        const t = performance.now(); cu(...a); const T = window.__tb;
        T.city = Math.max(T.city, performance.now() - t); T.builds = Math.max(T.builds || 0, nb); T.paints = Math.max(T.paints || 0, np);
        T.buildMs = Math.max(T.buildMs || 0, bt / (nb || 1)); T.paintMs = Math.max(T.paintMs || 0, ptm / (np || 1)); T.nb = (T.nb || 0) + nb; T.np = (T.np || 0) + np;
      };
      v.render = (...a) => { const t = performance.now(); vr(...a); window.__tb.frame = Math.max(window.__tb.frame, performance.now() - t); };
    }
    Object.assign(h, { x: c.coastX * 0.08, y: c.H * (band ? 0.45 : 0.6), band, ang: 0, speed: 0 });
    ow.view3d && (ow.view3d.cam.placed = false);
    g.state.clock = 12 * 60;
    window.__axis = { x: 1, y: 0 };
  }, band);
  const rows = [];
  const leg = async (label, js, ms) => {
    const t0 = await page.evaluate((js) => { eval(js); window.__tb = { city: 0, frame: 0 }; window.__x0 = window.__game.overworld.hero.x; return performance.now(); }, js);
    await page.waitForTimeout(ms);
    const r = await page.evaluate((t0) => {
      const F = window.__frames.filter((t) => t >= t0), gaps = [], at = [];
      for (let i = 1; i < F.length; i++) { gaps.push(F[i] - F[i - 1]); at.push([Math.round(F[i] - F[i - 1]), Math.round(F[i - 1] - t0)]); }
      at.sort((a, b) => b[0] - a[0]);
      const s = [...gaps].sort((a, b) => a - b), med = s[s.length >> 1] || 0;
      const c3 = window.__game.overworld.view3d?.city3;
      return { longest: Math.round(s[s.length - 1] || 0), over100: gaps.filter((x) => x > 100).length, over2med: gaps.filter((x) => x > 2 * med + 16).length, medFrame: Math.round(med), frames: gaps.length,
        gl: window.__glt.report(), top: at.slice(0, 4), moved: Math.round(window.__game.overworld.hero.x - window.__x0), cityMs: Math.round(window.__tb.city), frameMs: Math.round(window.__tb.frame), tb: Object.fromEntries(Object.entries(window.__tb).map(([k, v]) => [k, +v.toFixed(1)])), near: c3 ? [...c3.chunks.values()].filter((ch) => ch.near).length : null };
    }, t0);
    rows.push({ label: `${label} (${band ? 'cruise' : 'skim'})`, syncMs: 0, readyMs: 0, steadyMs: 0, ...r, heapMB: await heap(page, cdp) });
  };
  // (real-time speed whatever the harness's frame rate: she is carried at cruise speed, 280 m/s)
  const drive = (dir) => `clearInterval(window.__drive); window.__axis = { x: 0, y: 0 }; let last = performance.now(); window.__drive = setInterval(() => { const h = window.__game.overworld.hero, now = performance.now(); h.ang = ${dir} > 0 ? 0 : Math.PI; h.speed = 0; h.x += ${dir} * 560 * Math.min(0.5, (now - last) / 1000); last = now; }, 20)`;
  await leg('fly out', drive(1), out * 1000);
  await leg('turn back', drive(-1), back * 1000);
  await page.evaluate(() => { clearInterval(window.__drive); window.__axis = null; });
  return rows;
}

async function run(browserType, name, devices) {
  const browser = await browserType.launch(name === 'chromium' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] } : {});
  const dev = devices['iPad Pro 11 landscape'];
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.addInitScript(GL_TRACK);
  const cdp = name === 'chromium' ? await ctx.newCDPSession(page) : null;
  if (cdp) await cdp.send('Performance.enable');
  await page.goto(`http://localhost:${PORT}/${QUERY}`);
  await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 60000 });
  await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
  const env = await page.evaluate(async () => {
    const s = await import('/src/settings.js');
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { profile: s.quality().id, dpr: devicePixelRatio, w: innerWidth, h: innerHeight, gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl ? 'webgl' : 'none', ua: navigator.userAgent.slice(0, 80), touch: matchMedia('(pointer: coarse)').matches };
  });
  // (that probe context is ours, not the game's: release it so it isn't counted)
  await page.evaluate(() => { const S = window.__glt, c = S.ctxs.pop(); S.made--; c.gl.getExtension('WEBGL_lose_context')?.loseContext(); });
  const rows = [];
  await page.waitForTimeout(500);
  rows.push(await transition(page, cdp, 'title → fly', `document.getElementById('btn-new').click()`, READY.overworld));
  const opt = page.locator('#modal-root .opt').first();
  if (await opt.count()) await opt.click();
  await page.evaluate(async () => { await (await import('/src/enemies.js')).loadEnemies(); });
  await page.evaluate(() => { const g = window.__game; g.overworld.nav.autopilot = false; });
  const TOUR = +arg('--tour', 0);
  if (TOUR) {
    const t0 = Date.now(), curve = [];
    for (let i = 0; i < TOUR; i++) {
      await page.evaluate(([i, n]) => {
        const g = window.__game, c = g.city, h = g.overworld.hero, k = Math.ceil(Math.sqrt(n));
        const fx = ((i % k) + 0.5) / k, fy = (Math.floor(i / k) + 0.5) / k;
        Object.assign(h, { x: c.coastX * (Math.floor(i / k) % 2 ? 1 - fx : fx), y: c.H * fy, band: i % 3 });
        g.state.clock = i % 2 ? 23 * 60 : 12 * 60;
      }, [i, TOUR]);
      await page.waitForTimeout(1500);
      if ((i + 1) % Math.max(1, Math.round(TOUR / 4)) === 0) { const r = await page.evaluate(() => window.__glt.report()); curve.push(`${r.resMB}+${r.cv2dMB}`); }
    }
    console.log(`  tour MB (GPU res + 2D canvases) every quarter: ${curve.join(' → ')}`);
    rows.push({ label: `tour (${TOUR} stops, ${Math.round((Date.now() - t0) / 1000)} s)`, syncMs: 0, readyMs: 0, steadyMs: 0, longest: 0, over100: 0, medFrame: 0, gl: await page.evaluate(() => window.__glt.report()), heapMB: await heap(page, cdp),
      info: await page.evaluate(() => {
        const v = window.__game.overworld.view3d; if (!v) return null;
        const c = { near: 0, lite: 0, tiles: 0, tilePx: 0 };
        for (const ch of v.city3.chunks.values()) { if (ch.near) c.near++; if (ch.lite) c.lite++; for (const k of ['gl', 'gd']) if (ch[k]) { c.tiles++; c.tilePx = ch[k].material.map.image.width; } }
        const u = v.city3.ground.material.uniforms, rt = (t) => t && `${t.width}x${t.height}${t.samples ? 'x' + t.samples : ''}`;
        return { ...v.renderer.info.memory, ...c, plan: u.day.value.source?.data?.width ?? u.day.value.image.width, post: rt(v.post.rt), postB: rt(v.post.rtB), hero: rt(v.heroPass.rt) };
      }) });
  }
  if (argv.includes('--turnback')) for (const band of [1, 0]) rows.push(...await turnBack(page, cdp, band));
  for (let round = 0; round < ROUNDS; round++) {
    for (const z of ['brawler', 'investigate', 'special']) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
      if (LOSE && round === 0 && z === 'brawler') rows.push(await loseTest(page, 'restore'));
      if (LOSE && round === 0 && z === 'investigate') rows.push(await loseTest(page, 'never'));
      if (LOSE && round === ROUNDS - 1 && z === 'special') rows.push(await loseTest(page, 'nogl'));
      rows.push(await transition(page, cdp, `fly → ${z}`, `window.__game.startZone(${ZONES[z]})`, READY[z]));
      if (z === 'brawler') { await page.keyboard.down('KeyD'); for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(200); } await page.keyboard.up('KeyD'); }
      else await page.waitForTimeout(1200);
      rows.push(await transition(page, cdp, `${z} → fly`, `window.__game.setMode('overworld', { returnFrom: window.__game.mode.zone })`, READY.overworld));
    }
  }
  const fly3d = await page.evaluate(() => document.body.classList.contains('fly3d'));
  await browser.close();
  return { env, rows, errors: [...new Set(errors)], endedIn3D: fly3d };
}

(async () => {
  const pw = loadPlaywright();
  const srv = serve(ROOT, PORT, arg('--overlay', null) && path.resolve(ROOT, arg('--overlay')));
  const out = {};
  try {
    for (const b of WHICH === 'both' ? ['webkit', 'chromium'] : [WHICH]) {
      const r = await run(pw[b], b, pw.devices);
      out[b] = r;
      console.log(`\n== ${b}  ${JSON.stringify(r.env)}`);
      console.log('transition'.padEnd(22), 'sync', 'ready', 'steady', 'longest', '>100ms', 'frame', 'ctx(live/made)', 'gpuMB(res+draw)', 'heapMB', 'canvas2D MB');
      for (const x of r.rows) {
        if (x.label.startsWith('lose')) { console.log(x.label.padEnd(22), JSON.stringify(x)); continue; }
        if (x.info) console.log('  three memory:', JSON.stringify(x.info));
        if (x.cityMs !== undefined) console.log(`  worst city update ${x.cityMs} ms, worst 3D frame (CPU) ${x.frameMs} ms, near builds ${x.near}, moved ${x.moved}, top gaps [ms, at ms] ${JSON.stringify(x.top)}, frames ${x.frames}, >2x median ${x.over2med}  ${JSON.stringify(x.tb)}`);
        console.log(x.label.padEnd(22), String(x.syncMs).padStart(4), String(x.readyMs).padStart(5), String(x.steadyMs).padStart(6), String(x.longest).padStart(7), String(x.over100).padStart(6), String(x.medFrame).padStart(5),
          `${x.gl.live}/${x.gl.made}`.padStart(14), `${x.gl.resMB}+${x.gl.drawMB}`.padStart(15), String(x.heapMB).padStart(6), String(x.gl.cv2dMB).padStart(6));
      }
      if (argv.includes('--dump')) for (const x of r.rows) console.log(x.label, JSON.stringify(x.perCtx), JSON.stringify(x.top));
      console.log('ended in 3D flight:', r.endedIn3D, ' errors:', r.errors.length ? r.errors : 'none');
    }
  } finally { srv.close(); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
