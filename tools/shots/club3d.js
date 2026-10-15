// The 3D infiltration clubs (src/club3d/, ?club=v3): screenshots of every main-room variation and
// its side rooms, fps / draw calls / triangles per view, and the club's flows played through
// (Talker → clue, close-up + phone, VIP quiz → dance, a back-room fight, sedation → wake → capture,
// the owner's confession → solved → skylight, the leak → thrown out, each per-visit event).
//   node tools/shots/club3d.js [--label c3] [--port 8881] [--rooms rave,pit] [--flows all|none|sedate,confess]
//                              [--case squirt|blackmail|earworm] [--w 844 --h 390] [--gen 1-8] [--query '&camdist=closest']
//   flows idle (D2: the crowd rings her when she stands still) and cage (D3: the Gilded Cage dance)
//   --gen a-b: generated cases (club3d/casegen.js), one visit per seed, each crowd beat played
//   (flows gen<seed>; strips in shots/<label>/strips/gen<seed>)
// → shots/<label>/club3d/*.png + metrics.json (fps is SwiftShader: compare runs, never a phone)
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
const LABEL = arg('--label', 'c3'), PORT = +arg('--port', 8881), CASE = arg('--case', 'squirt');
const ROOMS = arg('--rooms', 'rave,mezzanine,pit,centre,tunnel').split(',').filter((r) => r && r !== 'none');
const FLOWS = arg('--flows', 'all');
const W = +arg('--w', 844), H = +arg('--h', 390), DPR = +arg('--dpr', 1);
const EXTRA = arg('--query', ''); // e.g. --query '&camdist=closest' (appended to every visit's query)
const OUT = path.join(ROOT, 'shots', LABEL, 'club3d');
const want = (f) => FLOWS === 'all' || FLOWS.split(',').includes(f) || (/^gen\d+$/.test(f) && GEN.length);
const GEN = (() => { const g = arg('--gen', ''); if (!g) return []; const [a, b] = g.split('-').map(Number); return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i); })();

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const metrics = { views: {}, flows: {}, errors: [] };

  /** A fresh visit: new game, straight into a club zone. Resolves a helper bag. */
  async function visit(query) {
    const errors = [];
    const frozen = async (fn) => {
      await page.evaluate(async () => { (await import('/src/ui.js')).UI.open++; }).catch(() => {});
      try { return await fn(); } finally { await page.evaluate(async () => { const U = (await import('/src/ui.js')).UI; U.open = Math.max(0, U.open - 1); }).catch(() => {}); }
    };
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: DPR > 1, isMobile: DPR > 1 });
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const modal = () => page.evaluate(() => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); if (!el) return null; return { text: el.innerText.slice(0, 240).replace(/\s+/g, ' '), opts: [...el.querySelectorAll('.opt')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) }; });
    const clickTop = (idx) => page.evaluate((idx) => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); if (!el) return; const o = el.querySelectorAll('.opt'); if (o.length) o[Math.max(0, Math.min(o.length - 1, idx))].click(); else (el.querySelector('button') || el).click(); }, idx); // (the act's panels have plain buttons)
    const V = {
      page, errors,
      // (the clock stops while a frame is written: under SwiftShader a screenshot costs seconds of game
      // time, and a 6 s window, like the cover after breaking free, ran out between two frames)
      shot: (n) => frozen(() => page.screenshot({ path: path.join(OUT, `${n}.png`) })),
      modal,
      /** Pick an option (index or label substring) on the next dialog. */
      async pick(match = 0, wait = 15000) {
        const t0 = Date.now();
        while (Date.now() - t0 < wait) {
          const m = await modal();
          if (m) { const i = typeof match === 'number' ? match : Math.max(0, m.opts.findIndex((o) => o.toLowerCase().includes(match.toLowerCase()))); await clickTop(i); await page.waitForTimeout(300); return m; }
          await page.waitForTimeout(200);
        }
        return null;
      },
      /** Click through dialogs, papers and cutscenes until until() holds. */
      async through(until, wait = 40000) {
        const t0 = Date.now();
        while (Date.now() - t0 < wait) {
          if (await page.evaluate(until)) return true;
          if (await modal()) { await clickTop(0); await page.waitForTimeout(300); continue; }
          if (await page.evaluate(() => !!document.querySelector('#cutscene.on'))) { await page.evaluate(() => { const c = document.querySelector('#cutscene'); for (let i = 0; i < 4; i++) c.click(); }); await page.waitForTimeout(500); continue; }
          await page.waitForTimeout(250);
        }
        return false;
      },
      fps: () => page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(+(n / 2).toFixed(1)); }; requestAnimationFrame(tick); })),
      gl: () => page.evaluate(() => { const r = window.__game.mode.renderer.info.render; return { calls: r.calls, tris: r.triangles }; }),
      /** Put her somewhere (the camera follows at once) and let it settle. */
      async put(x, z, ms = 1300) { await page.evaluate(([x, z]) => { const m = window.__game.mode; m.hero.position.set(x, 0, z); m.camSnap = true; m.still = 0; }, [x, z]); await page.waitForTimeout(ms); },
      /** Let `secs` of GAME time pass (SwiftShader runs ~5 fps and the game clamps dt to 50 ms: game time is ~1/4 of real time). */
      async gwait(secs, maxMs = 60000) {
        const t0 = await page.evaluate(() => window.__game.mode.t || 0);
        await page.waitForFunction((t) => (window.__game.mode.t || 0) >= t || window.__game.modeName !== 'club3', t0 + secs, { timeout: maxMs, polling: 50 }).catch(() => {});
      },
      /** The on-screen stick, as a thumb would push it (x right, y down; 0.7 = a sneak, 1 = a run). null lets go. */
      stick: (x, y) => page.evaluate(([x, y]) => { const s = window.__game.input.stick; if (x === null) { s.id = null; s.x = s.y = 0; } else { s.id = 777; s.x = x; s.y = y; } }, [x, y]),
      /** A frame for a strip: shots/<label>/strips/<dir>/fNN_<game ms>.png */
      async strip(dir, n) {
        const d = path.join(ROOT, 'shots', LABEL, 'strips', dir);
        fs.mkdirSync(d, { recursive: true });
        const ms = await page.evaluate(() => Math.round((window.__game.mode.t || 0) * 1000));
        await frozen(() => page.screenshot({ path: path.join(d, `f${String(n).padStart(2, '0')}_${ms}.png`) }));
      },
      /** Pin bouncer i at (x, z) facing rot (he stands there on his round); the others go blind (posed strips). */
      pin: (i, x, z, rot, blindOthers = true) => page.evaluate(([i, x, z, rot, blind]) => {
        const m = window.__game.mode, gd = m.guards[i], p = gd.mesh.position.clone();
        p.set(x, p.y, z); gd.route = [p]; gd.wp = 0; gd.mesh.position.set(x, gd.mesh.position.y, z); gd.mesh.rotation.y = rot;
        gd.torch = false;
        if (blind) for (const q of m.guards) if (q !== gd) q.away = true;
        m.grace = 0; m.dropT = 999;
        return { st: gd.st, sus: gd.sus };
      }, [i, x, z, rot, blindOthers]),
      /** The bouncers' heads: [state, sus, seeing] each. */
      minds: () => page.evaluate(() => window.__game.mode.guards.map((g) => `${g.st}:${Math.round(g.sus || 0)}${g.seeing ? '*' : ''}`).join(' ')),
    };
    await page.goto(`http://localhost:${PORT}/?flight=2d&club=v3&club3under=0${/club3case=/.test(query) ? '' : `&club3case=${CASE}`}${query}${EXTRA}`); // (a flow may bring its own case)
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.mouse.click(W / 2, H / 2); // (skips the intro video)
    await page.waitForTimeout(300);
    await page.click('#btn-new');
    await page.waitForTimeout(500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
    // (an empty map first: spawn() finds no free block in a small, crowded nightclub district)
    await page.evaluate(() => { const g = window.__game, ow = g.overworld; g.setMode('overworld'); ow.zones = []; g.startZone(ow.spawn('special', true, 'Nightclub')); });
    await page.waitForFunction(() => window.__game.modeName === 'club3' && !window.__game.mode.warming, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
    await page.evaluate(() => { const m = window.__game.mode; m.dropT = 999; m.grace = 1e9; }); // no drop, no bouncers: the views are posed
    return V;
  }
  const flow = async (name, query, fn) => {
    if (!want(name)) return;
    console.log('flow', name);
    let V;
    try { V = await visit(query); metrics.flows[name] = await fn(V); } catch (e) { metrics.flows[name] = { failed: e.message }; }
    if (V) { metrics.errors.push(...V.errors.map((e) => `${name}: ${e}`)); await V.page.close(); }
    console.log('  ', JSON.stringify(metrics.flows[name]));
  };

  try {
    // ---- every variation: the entrance, the crowd, the DJ wall, each side room + the alley
    for (const room of ROOMS) {
      console.log('room', room);
      const V = await visit(`&club3room=${room}&club3seed=7&club3event=none`);
      const plan = await V.page.evaluate(() => { const m = window.__game.mode, p = m.plan; return { hw: p.V.hw, hd: p.V.hd, fz: p.V.floor.z, rooms: p.all.map((q) => ({ k: q.kind, x: q.cx, z: q.cz })), crowd: m.crowd.people.length, guards: m.guards.length }; });
      const M = (metrics.views[room] = { crowd: plan.crowd, guards: plan.guards });
      await V.shot(`${room}_01_entrance`); M.entrance = { fps: await V.fps(), ...(await V.gl()) };
      await V.put(0, plan.fz + 2); await V.shot(`${room}_02_crowd`); M.crowd_view = { fps: await V.fps(), ...(await V.gl()) };
      await V.put(0, -plan.hd + 5); await V.shot(`${room}_03_djwall`);
      for (const q of plan.rooms) { await V.put(q.x, q.z + 2, 1000); await V.shot(`${room}_10_${q.k}`); }
      metrics.errors.push(...V.errors.map((e) => `${room}: ${e}`));
      await V.page.close();
    }
    // ---- the flows
    await flow('talker', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => { const m = window.__game.mode, t = m.talkers[0]; m.hero.position.set(t.pos.x + 1.6, 0, t.pos.z); m.camSnap = true; t.ev = 70; });
      await V.page.waitForTimeout(1500); await V.shot('flow_talker_listening');
      await V.page.evaluate(() => { window.__game.mode.talkers[0].ev = 99; });
      const d = await V.pick(0, 40000);
      return { dialog: d && d.text.slice(0, 80), clues: await V.page.evaluate(() => window.__game.mode.book.count) };
    });
    await flow('closeup', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => window.__game.mode.openCloseup('bar'));
      await V.page.waitForTimeout(1000); await V.shot('flow_closeup_bar');
      // every close-up's framing, its spots ringed: none may sit under the button column or off screen
      for (const k of ['entrance', 'main', 'vip', 'restroom', 'office']) {
        await V.page.evaluate((k) => { const m = window.__game.mode; m.sub = null; document.body.classList.remove('c3-flat', 'closeup-on'); m.openCloseup(k); }, k);
        await V.page.waitForTimeout(700);
        const bad = await V.page.evaluate(async (k) => {
          const { CLOSEUPS, closeupFrame, CLOSEUP_RAIL } = await import('/src/nightclub/scenes.js');
          const g = window.__game, sc = CLOSEUPS[k], R = closeupFrame(g.w, g.h, sc.img.naturalWidth, sc.img.naturalHeight, sc.spots);
          return sc.spots.filter((s) => { const x = R.x + s.x * R.w, y = R.y + s.y * R.h; return x < 0 || x > g.w - CLOSEUP_RAIL || y < 40 || y > g.h; }).map((s) => s.id);
        }, k);
        if (bad.length) V.errors.push(`close-up ${k}: spots off screen or under the buttons: ${bad.join(', ')}`);
        await V.shot(`flow_closeup_${k}`);
      }
      await V.page.evaluate(() => { const m = window.__game.mode; m.sub = null; document.body.classList.remove('c3-flat', 'closeup-on'); m.openCloseup('bar'); });
      await V.page.waitForTimeout(700);
      await V.page.evaluate(async () => {
        const { CLOSEUPS, closeupFrame } = await import('/src/nightclub/scenes.js');
        const g = window.__game, sc = CLOSEUPS.bar, img = sc.img;
        const R = closeupFrame(g.w, g.h, img.naturalWidth, img.naturalHeight, sc.spots), p = sc.spots.find((q) => q.id === 'phone');
        g.input.taps.push({ x: R.x + p.x * R.w, y: R.y + p.y * R.h });
      });
      await V.page.waitForTimeout(900); await V.shot('flow_closeup_phone');
      // put the phone back, then photograph it with the CAMERA
      await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
      await V.page.evaluate(() => { const g = window.__game; g.input.taps.push({ x: 5, y: 5 }); });
      await V.page.waitForTimeout(300);
      await V.page.evaluate(async () => {
        const { CLOSEUPS, closeupFrame } = await import('/src/nightclub/scenes.js');
        const g = window.__game, sc = CLOSEUPS.bar, img = sc.img;
        const R = closeupFrame(g.w, g.h, img.naturalWidth, img.naturalHeight, sc.spots), p = sc.spots.find((q) => q.id === 'phone');
        g.input.pressedSet.add('camera');
        setTimeout(() => g.input.taps.push({ x: R.x + p.x * R.w, y: R.y + p.y * R.h }), 300);
      });
      await V.page.waitForTimeout(1200); await V.shot('flow_closeup_camera');
      return { clues: await V.page.evaluate(() => window.__game.mode.book.count), photos: await V.page.evaluate(() => [...window.__game.mode.snapped]), bonus: await V.page.evaluate(() => window.__game.mode.bonus) };
    });
    await flow('screens', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // the office's live CCTV + her recorded dance; the restroom mirror when she's dosed
      await V.page.evaluate(() => { const m = window.__game.mode; m.officeOpen = true; m.openDoorOf('office'); m.addCard('dance', 'test', null); const b = m.roomA.office.recorder; m.hero.position.set(b.x, 0, b.z - 0.8); m.camSnap = true; });
      await V.page.waitForTimeout(2500); await V.shot('flow_screens_cctv');
      await V.page.evaluate(() => { const m = window.__game.mode, c = m.roomA.restroom.closeup; m.g.state.intox = 60; m.hero.position.set(c.x, 0, c.z); m.camSnap = true; });
      await V.page.waitForTimeout(2500); await V.shot('flow_screens_mirror');
      return await V.page.evaluate(() => ({ video: window.__game.mode.videoWant, cctv: !!window.__game.mode.cctvRT }));
    });
    await flow('dance', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => { const m = window.__game.mode, h = m.roomA.vip.quiz; m.vipIn = true; m.openDoorOf('vip'); m.hero.position.set(h.x, 0, h.z); m.camSnap = true; m.run(() => m.vipFail()); });
      await V.pick(0);
      await V.page.waitForTimeout(1500); await V.shot('flow_dance_landscape');
      await V.page.setViewportSize({ width: H, height: W }); await V.page.waitForTimeout(600); await V.shot('flow_dance_portrait');
      await V.page.setViewportSize({ width: W, height: H });
      // (a lost dance loops the playback until a tap: tap the clip's corner, clear of the keys)
      await V.through(() => { const m = window.__game.mode; if (m.sub) m.g.input.taps.push({ x: 2, y: 2 }); return !m.sub && !document.querySelector('#modal-root .modal-back'); }, 90000);
      return { envelope: await V.page.evaluate(() => window.__game.mode.envelope.map((c) => c.id + (c.img ? '*' : ''))) };
    });
    await flow('backroom', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // the dark room's screen (its clip plays while she's in there) and the floor's flashlight bouncers
      await V.page.evaluate(() => { const m = window.__game.mode, q = m.plan.byKind.dark; m.hero.position.set(q.cx, 0, q.z0 + 4.5); m.camSnap = true; });
      await V.page.waitForTimeout(2500); await V.shot('flow_backroom_screen');
      const want = await V.page.evaluate(() => window.__game.mode.videoWant);
      await V.page.evaluate(() => { const m = window.__game.mode, F = m.plan.V.floor; m.hero.position.set(F.x, 0, F.z + 3); m.camSnap = true; });
      await V.page.waitForTimeout(2500); await V.shot('flow_backroom_torches');
      return { video: want, torches: await V.page.evaluate(() => window.__game.mode.guards.filter((g) => g.torch).map((g) => g.phase)) };
    });
    await flow('brawl', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      const out = {};
      for (const k of ['restroom', 'dark', 'alley']) {
        await V.page.evaluate((k) => { const m = window.__game.mode; m.run(() => m.startBrawl(k)); }, k);
        await V.pick(0);
        await V.page.waitForFunction(() => window.__game.modes.brawler.loading === null, null, { timeout: 30000 });
        await V.page.waitForTimeout(1800); await V.shot(`flow_brawl_${k}`);
        await V.page.evaluate(() => window.__game.modes.brawler.finish(true));
        await V.through(() => !window.__game.mode.sub && !window.__game.mode.busy && !document.querySelector('#modal-root .modal-back'), 20000);
        out[k] = await V.page.evaluate((k) => !!window.__game.mode.fought[k], k);
      }
      return out;
    });
    await flow('sedate', '&club3room=rave&club3seed=7&club3event=none&club3wake=vip', async (V) => {
      // (a story club: every capture is a struggle; lose them all and she's carried out)
      if (await V.page.evaluate(() => !!window.__game.mode.caseDef.clips?.trap)) {
        for (let i = 0; i < 3 && await V.page.evaluate(() => window.__game.modeName === 'club3'); i++) {
          await V.page.evaluate(() => window.__game.mode.foundOut('A bouncer clocks you.'));
          await V.page.waitForFunction(() => window.__struggle || window.__game.modeName !== 'club3', null, { timeout: 20000 });
          await V.page.evaluate(() => window.__struggle?.lose());
          await V.through(() => window.__game.modeName !== 'club3' || (!window.__game.mode.sedating && !document.querySelector('#modal-root .modal-back') && !document.querySelector('#cutscene.on')), 60000);
        }
        await V.through(() => window.__game.modeName === 'captured', 60000);
        await V.shot('flow_sedate_captured');
        return { story: true, mode: await V.page.evaluate(() => window.__game.modeName) };
      }
      await V.page.evaluate(() => window.__game.mode.foundOut('A bouncer clocks you.'));
      await V.page.waitForFunction(() => document.querySelector('#cutscene.on'), null, { timeout: 20000 });
      await V.page.waitForTimeout(1000); await V.shot('flow_sedate_clip');
      await V.through(() => { const m = window.__game.mode; return !m.sedating && !document.querySelector('#modal-root .modal-back'); });
      await V.page.waitForTimeout(1000); await V.shot('flow_sedate_woke');
      const woke = await V.page.evaluate(() => window.__game.mode.room?.kind);
      for (let i = 0; i < 2; i++) { await V.page.evaluate(() => window.__game.mode.foundOut('Again.')); await V.through(() => window.__game.modeName === 'captured' || (!window.__game.mode.sedating && !document.querySelector('#modal-root .modal-back') && !document.querySelector('#cutscene.on')), 60000); }
      await V.through(() => window.__game.modeName === 'captured', 60000);
      await V.shot('flow_sedate_captured');
      return { woke, mode: await V.page.evaluate(() => window.__game.modeName) };
    });
    await flow('confess', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => {
        const m = window.__game.mode;
        for (const cat of ['deal', 'supply', 'drop', 'deal']) { const k = Object.keys(m.caseDef.clues).find((q) => m.caseDef.clues[q].cat === cat && !m.caseDef.clues[q].v3 && !m.book.found.has(q)); m.book.find(...k.split(':')); }
        m.officeOpen = true; m.openDoorOf('office');
        const c = m.roomA.office.confront; m.hero.position.set(c.x, 0, c.z); m.camSnap = true;
        m.run(() => m.confront());
      });
      await V.pick('lay out');
      for (let i = 0; i < 3; i++) {
        const d = await V.modal();
        const idx = await V.page.evaluate(([opts, i]) => { const m = window.__game.mode, cat = m.caseDef.boss.steps[i].cat; return opts.findIndex((o) => { const k = Object.keys(m.caseDef.clues).find((q) => o.includes(m.caseDef.clues[q].note)); return k && m.caseDef.clues[k].cat === cat; }); }, [d.opts, i]);
        if (i === 0) await V.shot('flow_confess_step');
        await V.pick(idx);
      }
      await V.through(() => window.__game.mode.caseSolved && !document.querySelector('#modal-root .modal-back'));
      await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.skylight()); });
      const won = await V.through(() => window.__game.modeName === 'overworld');
      return { won, leads: await V.page.evaluate(() => window.__game.state.leads.map((l) => l.id)) };
    });
    await flow('leak', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => { const m = window.__game.mode; m.book.find('bar', 'phone'); m.officeOpen = true; m.openDoorOf('office'); const c = m.roomA.office.confront; m.hero.position.set(c.x, 0, c.z); m.camSnap = true; });
      await V.page.waitForTimeout(900);
      await V.page.evaluate(() => { const m = window.__game.mode; m.addCard('pill', 'Supergirl taking a pill on the dance floor'); });
      await V.page.waitForTimeout(500);
      await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.confront()); });
      await V.pick('lay out');
      await V.page.waitForTimeout(500); await V.shot('flow_leak_polaroid');
      await V.pick(0); // the only card she has proves the drop, not who deals it: the wrong one
      await V.pick('release');
      await V.page.waitForTimeout(1200); await V.shot('flow_leak_paper');
      const out = await V.through(() => window.__game.modeName === 'overworld');
      return { thrownOut: out, rep: await V.page.evaluate(() => window.__game.state.rep) };
    });
    await flow('quick', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // the bar's quick prompt (the club keeps going behind it), answered with a key
      await V.page.evaluate(() => { const m = window.__game.mode, b = m.hallA.spots.bar; m.hero.position.set(b.x, 0, b.z); m.camSnap = true; m.run(() => m.barOrder()); });
      await V.page.waitForTimeout(800); await V.shot('flow_quick_bar');
      const open = await V.page.evaluate(() => !!document.querySelector('#c3-quick.on') && !window.__game.mode.busy);
      await V.page.keyboard.press('2');
      await V.page.waitForTimeout(500);
      const closed = await V.page.evaluate(() => !document.querySelector('#c3-quick.on') && !window.__game.mode.quickOn);
      // the restroom's first stall: bag a sample (a clue card, still modal)
      await V.page.evaluate(() => { const m = window.__game.mode, r = m.roomA.restroom.powder; m.hero.position.set(r.x, 0, r.z); m.camSnap = true; m.run(() => m.powder()); });
      await V.page.waitForTimeout(700);
      await V.page.keyboard.press('2');
      await V.through(() => !document.querySelector('#modal-root .modal-back') && !window.__game.mode.busy, 8000);
      // a bouncer sees her: the one-time tip, the ring flashing red
      await V.page.evaluate(() => { const m = window.__game.mode; m.grace = 0; const gd = m.guards.find((g) => !g.high && g !== m.ropeGuard), p = gd.mesh.position; m.hero.position.set(p.x + Math.sin(gd.mesh.rotation.y) * 4, 0, p.z + Math.cos(gd.mesh.rotation.y) * 4); m.camSnap = true; });
      await V.page.waitForTimeout(900); await V.shot('flow_quick_seen');
      return { open, closed, clues: await V.page.evaluate(() => window.__game.mode.book.count), tip: await V.page.evaluate(() => !!document.querySelector('#c3-tip.on')) };
    });
    // ---- the struggle (the office wake-up everywhere; every capture in a story club)
    await flow('struggle', '&club3seed=7&club3event=none&club3wake=office', async (V) => {
      const story = await V.page.evaluate(() => !!window.__game.mode.caseDef.clips?.trap);
      if (story) await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.sedate('A bouncer clocks you.')); });
      else {
        await V.page.evaluate(() => window.__game.mode.foundOut('A bouncer clocks you.'));
        await V.through(() => !!document.querySelector('.c3-struggle'), 40000);
      }
      await V.page.waitForFunction(() => document.querySelector('.c3-struggle') && window.__struggle, null, { timeout: 20000 });
      const trace = [];
      for (let i = 0; i < 6; i++) { await V.page.waitForTimeout(250); trace.push(await V.page.evaluate(() => window.__struggle ? window.__struggle.state() : document.querySelector('.c3-struggle')?.className || 'gone')); }
      const idle = trace[trace.length - 1];
      if (!idle?.stalled) return { story, trace };
      await V.shot('flow_struggle_stalled');
      // turn the "stick": circles with a thumb on the screen
      await V.page.mouse.move(W / 2 + 60, H / 2); await V.page.mouse.down();
      for (let i = 0; i <= 40; i++) { const a = (i / 20) * Math.PI * 2; await V.page.mouse.move(W / 2 + Math.cos(a) * 60, H / 2 + Math.sin(a) * 60); }
      const turning = await V.page.evaluate(() => window.__struggle?.state() || 'over');
      await V.shot('flow_struggle_turning');
      await V.page.mouse.up();
      await V.page.evaluate(() => window.__struggle?.win());
      await V.through(() => { const m = window.__game.mode; return !document.querySelector('.c3-struggle') && !m.sedating && !m.busy && !document.querySelector('#modal-root .modal-back'); }, 30000);
      const after = await V.page.evaluate(() => ({ sedations: window.__game.mode.sedations, alert: Math.round(window.__game.mode.alert) }));
      // and losing one: the humiliation clip, then she comes to somewhere else
      let lost = null;
      if (story) {
        await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.sedate('Again.')); });
        await V.page.waitForFunction(() => window.__struggle, null, { timeout: 20000 });
        await V.page.evaluate(() => window.__struggle.lose());
        await V.page.waitForFunction(() => document.querySelector('#cutscene.on'), null, { timeout: 20000 });
        await V.page.waitForTimeout(1200); await V.shot('flow_struggle_shame');
        await V.through(() => { const m = window.__game.mode; return !m.sedating && !document.querySelector('#modal-root .modal-back') && !document.querySelector('#cutscene.on'); }, 40000);
        lost = await V.page.evaluate(() => ({ sedations: window.__game.mode.sedations, mode: window.__game.modeName }));
      }
      return { story, idle, turning, after, lost };
    });
    // ---- round 11 (the club loop): the bouncers' "?", being made, the X-ray read, the struggle on a
    // thumb, caught and free, and a compressed loop. Each writes a strip (shots/<label>/strips/<flow>/).
    // Rave, seed 7: open floor at (11, 17), seven dancers 3 m north of it at (11, 14).
    await flow('stealth', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      const P = V.page, log = [];
      await V.put(11, 17, 300);
      await P.evaluate(() => { const m = window.__game.mode; m.hero.rotation.y = Math.PI; });
      await V.pin(3, 11, 10.3, 0);
      await V.gwait(0.15); await V.strip('stealth', 1); log.push(await V.minds());
      const sus = () => P.evaluate(() => window.__game.mode.guards[3].sus);
      const st = () => P.evaluate(() => window.__game.mode.guards[3].st);
      await P.waitForFunction(() => window.__game.mode.guards[3].sus >= 22, null, { timeout: 30000, polling: 30 });
      await V.strip('stealth', 2); log.push(await V.minds());
      // she sneaks (a light push on the stick: not a run) up into the dancers between them
      await V.stick(0, -0.72);
      await V.gwait(0.45); await V.strip('stealth', 3); log.push(await V.minds());
      await P.waitForFunction(() => window.__game.mode.blend >= 0.75 || window.__game.mode.hero.position.z < 13.6, null, { timeout: 30000, polling: 30 }).catch(() => {});
      await V.stick(null);
      await P.keyboard.down('KeyG'); // and dances: lost in it
      await V.gwait(0.5); await V.strip('stealth', 4); log.push(await V.minds());
      await V.gwait(1.6); await V.strip('stealth', 5); log.push(await V.minds());
      await V.gwait(1.8); await V.strip('stealth', 6); log.push(await V.minds());
      await P.waitForFunction(() => window.__game.mode.guards[3].st === 'calm' || window.__game.mode.guards[3].st === 'alert', null, { timeout: 90000, polling: 30 }).catch(() => {});
      await V.gwait(0.25); await V.strip('stealth', 7); log.push(await V.minds());
      await V.gwait(1.4); await V.strip('stealth', 8); log.push(await V.minds());
      await P.keyboard.up('KeyG');
      await V.shot('loop_closecall');
      return { log, final: await st(), sus: Math.round(await sus()), closeAt: await P.evaluate(() => window.__game.mode.closeAt) };
    });
    await flow('spot', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // made: the "!", the radio, the screens cut to her; she runs for the crowd; lost them
      const P = V.page, log = [];
      await V.put(11, 17, 300);
      await P.evaluate(() => { const m = window.__game.mode; m.hero.rotation.y = Math.PI; });
      await V.pin(3, 11, 11.0, 0);
      await P.waitForFunction(() => window.__game.mode.guards[3].sus >= 62, null, { timeout: 30000, polling: 30 });
      await V.strip('spot', 1); log.push(await V.minds());
      await P.waitForFunction(() => window.__game.mode.guards[3].st === 'alert', null, { timeout: 30000, polling: 30 });
      await V.gwait(0.1); await V.strip('spot', 2); log.push(await V.minds());
      // she breaks for the dancers to the west (a run: they can see her go)
      await V.stick(-0.95, -0.3);
      await V.gwait(0.55); await V.strip('spot', 3); await V.shot('loop_spotted'); log.push(await V.minds());
      await V.gwait(0.55); await V.strip('spot', 4); log.push(await V.minds());
      await P.waitForFunction(() => window.__game.mode.blend >= 0.75 || window.__game.mode.hero.position.x < 4, null, { timeout: 30000, polling: 30 }).catch(() => {});
      await V.stick(null); await P.keyboard.down('KeyG');
      await V.gwait(0.6); await V.strip('spot', 5); await V.shot('loop_cctv_wall'); log.push(await V.minds());
      await V.gwait(2.0); await V.strip('spot', 6); log.push(await V.minds());
      await P.waitForFunction(() => !window.__game.mode.wasHot || window.__game.modeName !== 'club3', null, { timeout: 120000, polling: 30 }).catch(() => {});
      await V.gwait(0.15); await V.strip('spot', 7); await V.shot('loop_lostthem'); log.push(await V.minds());
      await P.keyboard.up('KeyG');
      return { log, mode: await P.evaluate(() => window.__game.modeName), cctv: await P.evaluate(() => ({ k: window.__game.mode.cctvK, fed: window.__game.mode.camFed, alert: Math.round(window.__game.mode.alert || 0) })) };
    });
    await flow('xrayread', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // X-ray as a detective read: the room goes dark, every bouncer glows in what he knows, labelled
      const P = V.page, log = [];
      const at = await P.evaluate(() => { const m = window.__game.mode, q = m.plan.byKind.office; return { x: q.door.x + (q.side === 'W' ? 4.5 : -4.5), z: q.door.z + 2.5, side: q.side }; });
      await V.put(at.x, at.z, 600);
      await P.evaluate((side) => {
        const m = window.__game.mode; m.hero.rotation.y = side === 'W' ? -Math.PI / 2 : Math.PI / 2;
        // a room in three states: one staring, one searching, the rest on their rounds
        const g = m.guards.filter((q) => !q.high && q !== m.ropeGuard);
        g[0].sus = 48; g[0].st = 'sus'; g[0].stT = 0; g[0].holdT = 30; g[0].lastSeen = { x: m.hero.position.x, z: m.hero.position.z };
        m.startSearch(g[1], { x: m.hero.position.x + 4, z: m.hero.position.z - 3 }, null); g[1].sus = 70;
      }, at.side);
      await V.gwait(0.3); await V.strip('xrayread', 1);
      await P.keyboard.press('KeyX');
      await V.gwait(0.08); await V.strip('xrayread', 2);
      await V.gwait(0.5); await V.strip('xrayread', 3); await V.shot('loop_xray_read');
      await V.put(at.x + (at.side === 'W' ? -1.5 : 1.5), at.z - 6, 300);
      await V.gwait(0.6); await V.strip('xrayread', 4); await V.shot('loop_xray_office');
      await V.put(0, 6, 300);
      await V.gwait(0.6); await V.strip('xrayread', 5); await V.shot('loop_xray_floor'); log.push(await V.minds());
      await P.keyboard.press('KeyX');
      await V.gwait(0.4); await V.strip('xrayread', 6);
      return { log, en: await P.evaluate(() => Math.round(window.__game.mode.en)) };
    });
    await flow('touch', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      // the hard struggle on a phone: the thumb is already down (she was running on the stick), then draws
      // slow, wobbly circles at ~1 loop/s without lifting. It must win with seconds to spare.
      const P = V.page, cx = 560, cy = 230, r = 46;
      await P.mouse.move(cx + r, cy); await P.mouse.down();
      const res = P.evaluate(async () => { const { struggle } = await import('/src/club3d/struggle.js'); const { CLIPS, clipsReady, nextClip } = await import('/src/club3d/clips.js'); await clipsReady; const t0 = performance.now(); const ok = await struggle({ clip: nextClip(CLIPS.captive), title: 'BREAK FREE!', text: 'A test on a thumb. <b>Lose this one and they carry you out.</b>', diff: 'hard' }); return { ok, secs: +((performance.now() - t0) / 1000).toFixed(1) }; });
      await P.waitForFunction(() => window.__struggle, null, { timeout: 20000 });
      await P.waitForTimeout(500); await V.shot('loop_struggle_hint'); await V.strip('touch', 1);
      // (measure the input, not SwiftShader: the club under the overlay stops drawing for this test, so
      // pointer events arrive at a phone's rate instead of one per 5 fps frame)
      await P.evaluate(() => { const m = window.__game.mode; m._render = m.render; m.render = () => {}; });
      // (the page runs ~5 fps under SwiftShader and takes about one pointer event a frame: the thumb
      // follows the struggle's own clock in 0.9 rad steps, under the 1.65 rad jump filter)
      let last = null, a = 0;
      const t0 = await P.evaluate(() => window.__struggle.state().t), trace = [];
      for (let i = 0; i < 4000; i++) {
        const s = await P.evaluate(() => window.__struggle && window.__struggle.state());
        if (!s) break;
        if (s.t === last) { await P.waitForTimeout(8); continue; }
        last = s.t;
        if (trace.length < 40) trace.push(`${s.got.toFixed(1)}@${s.t.toFixed(1)}`);
        // (round 11 D1: the struggle is an S trace now; its thumb input is tested by tools/shots/struggle.js,
        // so here one S is finished per ~1.5 s of the struggle's clock, an average thumb's pace)
        const target = Math.floor((s.t - t0) / 1.5);
        while (a < target) { a++; await P.evaluate(() => window.__struggle?.trace()); }
      }
      await P.mouse.up();
      await P.evaluate(() => { const m = window.__game.mode; if (m._render) m.render = m._render; });
      return { ...(await res), trace: trace.filter((q, i) => i % 4 === 0).join(' ') };
    });
    await flow('caught', '&club3case=auction&club3seed=7&club3event=none', async (V) => {
      // a story club: made, grabbed, the struggle (won on a thumb), free: they're down, she's in the crowd
      const P = V.page, log = [];
      const spot = await P.evaluate(() => {
        const m = window.__game.mode, D = m.crowd.people.filter((p) => p.pose === 'dance'), V = m.plan.V;
        const cov = (x, z) => D.filter((p) => Math.hypot(p.hx - x, p.hz - z) < 1.7).length;
        for (let z = V.hd - 3; z > 0; z -= 0.5) for (let x = -V.hw + 6; x < V.hw - 6; x += 1) if (cov(x, z) <= 1 && cov(x - 3, z - 2) >= 5) return { x, z };
        return { x: 0, z: V.hd - 4 };
      });
      await V.put(spot.x, spot.z, 300);
      await P.evaluate(() => { const m = window.__game.mode; m.hero.rotation.y = Math.PI; });
      const gi = await P.evaluate(() => window.__game.mode.guards.findIndex((g) => !g.high && !g.torch && g !== window.__game.mode.ropeGuard));
      await V.pin(gi, spot.x, spot.z - 4.5, 0);
      await P.waitForFunction((i) => window.__game.mode.guards[i].st === 'alert', gi, { timeout: 30000, polling: 30 });
      await V.gwait(0.3); await V.strip('caught', 1); log.push(await V.minds());
      // r11 L2b: the grab, in the world, before the struggle panel
      const grabbed = await P.waitForFunction(() => window.__game.mode.grabbing && window.__game.mode.grabK > 0.6, null, { timeout: 30000, polling: 30 }).then(() => true).catch(() => false);
      if (grabbed) { await V.strip('caught', 2); await V.shot('loop_grab'); }
      log.push({ grabbed });
      await P.waitForFunction(() => window.__struggle, null, { timeout: 30000, polling: 50 });
      await P.waitForTimeout(700); await V.strip('caught', 3);
      const cx = 560, cy = 230, r = 46;
      await P.mouse.move(cx + r, cy); await P.mouse.down();
      let k = 0, n = 4, last = null, a = 0;
      const t0 = await P.evaluate(() => window.__struggle.state().t);
      for (let i = 0; i < 4000; i++) {
        const s = await P.evaluate(() => window.__struggle && window.__struggle.state());
        if (!s) break;
        if (s.t === last) { await P.waitForTimeout(8); continue; }
        last = s.t;
        const target = Math.floor((s.t - t0) / 1.3); // (one S per ~1.3 s: see the touch flow)
        while (a < target) { a++; await P.evaluate(() => window.__struggle?.trace()); }
        if (++k === 14 && n === 4) await V.strip('caught', n++);
      }
      await P.mouse.up();
      await P.waitForTimeout(250); await V.strip('caught', 5);
      await P.waitForFunction(() => !document.querySelector('.c3-struggle'), null, { timeout: 30000 });
      await V.gwait(0.25); await V.strip('caught', 6); await V.shot('loop_free'); log.push(await V.minds());
      await V.stick(-0.7, -0.45); await V.gwait(0.9); await V.strip('caught', 7);
      await V.stick(null); await P.keyboard.down('KeyG');
      await V.gwait(1.0); await V.strip('caught', 8); log.push(await V.minds());
      await P.keyboard.up('KeyG');
      return { log, sedations: await P.evaluate(() => window.__game.mode.sedations), freeAt: await P.evaluate(() => window.__game.mode.freeAt) };
    });
    // round 11 D2: she stands still on the rave floor: the ring closes in, the incidents speed up, a skirt
    // flip fires, she walks off and the ring lets go (strips in shots/<label>/strips/idle)
    await flow('idle', '&club3room=rave&club3seed=7&club3event=none', async (V) => {
      const P = V.page, ev = (f) => P.evaluate(f), log = [];
      const fz = await ev(() => window.__game.mode.plan.V.floor.z);
      await V.put(0, fz + 1.5, 600);
      const gl0 = await V.gl();
      const ring = () => ev(() => { const m = window.__game.mode, K = m.knotHost().knot; return { still: +m.still.toFixed(1), ring: !!m.idleRing, n: K ? K.k.length : 0, rate: m.idleRing ? +m.idleRate().toFixed(2) : 1, flips: m.idleFlips, leaving: (m.knotHost().leaving || []).length, env: (m.envelope || []).map((c) => c.id) }; });
      await V.gwait(4.6); log.push(await ring());
      await V.gwait(1.0); await V.strip('idle', 1); await V.shot('flow_idle_ring');
      const gl1 = await V.gl();
      // the longer she stands, the faster: jump her clock on and let the incidents roll until a flip fires
      await ev(() => { window.__game.mode.still = 24; }); log.push(await ring());
      let inc = 0;
      for (let i = 0; i < 40 && !(await ev(() => window.__game.mode.idleFlips > 0)); i++) { await ev(() => { const m = window.__game.mode; m.incT = 0; m.stunT = 0; }); await V.gwait(0.15); inc++; }
      await V.gwait(0.1); await V.strip('idle', 2); log.push({ incidents: inc, ...(await ring()) });
      await V.gwait(1.2); await V.strip('idle', 3);
      // she walks off: the ring breaks, the dancers drift home
      await ev(() => { window.__game.mode.stunT = 0; });
      await V.stick(0.9, 0); await V.gwait(0.5); await V.stick(null); log.push(await ring());
      await V.gwait(0.3); await V.strip('idle', 4);
      await V.gwait(2.4); log.push(await ring()); await V.strip('idle', 5);
      return { log, gl: { before: gl0, ring: gl1 } };
    });
    // round 11 D3: the Gilded Cage: walk to the empty cage, dance in it, −8 rep, step out
    await flow('cage', '&club3case=auction&club3seed=7&club3event=none', async (V) => {
      const P = V.page, ev = (f) => P.evaluate(f), log = [];
      const o = await ev(() => { const o = window.__game.mode.inter.find((q) => q.label === 'Dance in the cage'); return o && { x: o.pos.x, z: o.pos.z }; });
      if (!o) return { failed: 'no cage interactable' };
      await V.put(o.x + 1.2, o.z + 1.2, 500);
      await V.stick(-0.6, -0.6); await V.gwait(0.35); await V.stick(null); await V.gwait(0.3);
      const near = await ev(() => window.__game.mode.near?.label || null);
      await V.strip('cage', 1);
      const rep0 = await ev(() => window.__game.state.rep);
      await ev(() => { const m = window.__game.mode; m.grace = 0; }); // (the bouncers are live: they must let her be)
      if (near === 'Dance in the cage') await P.keyboard.press('KeyE');
      else await ev(() => { const m = window.__game.mode; m.run(() => m.inter.find((q) => q.label === 'Dance in the cage').act()); });
      await P.waitForFunction(() => !!window.__game.mode.caged, null, { timeout: 15000 });
      await V.gwait(0.8); await V.strip('cage', 2);
      for (let i = 0; i < 6; i++) { await P.keyboard.press('1'); await V.gwait(0.3); }
      await V.strip('cage', 3); await V.shot('flow_cage_dance');
      const gl = await V.gl();
      const mid = await ev(() => { const m = window.__game.mode, C = m.caged; return { y: +m.hero.position.y.toFixed(2), door: +C.cg.door.scale.y.toFixed(2), knot: m.knotHost().knot?.k.length || 0, hits: C.hits, misses: C.misses, ignored: m.grace > m.t, seeing: m.guards.filter((g) => g.seeing).length, feed: m.g.overworld?.feed?.playing?.cat || null }; });
      await P.keyboard.press('2');
      await P.waitForFunction(() => !window.__game.mode.caged && !window.__game.mode.busy, null, { timeout: 15000 });
      await V.gwait(0.4); await V.strip('cage', 4);
      const end = await ev(() => { const m = window.__game.mode, o = m.inter.find((q) => q.label === 'Dance in the cage'); return { rep: m.g.state.rep, env: (m.envelope || []).map((c) => c.id), again: o.can(), door: m.hallA.cages[0].door.visible, col: !m.colliders.find((c) => c.mesh === m.hallA.cages[0].plinth).disabled, y: +m.hero.position.y.toFixed(2) }; });
      return { near, rep0, repDrop: rep0 - end.rep, mid, end, gl };
    });
    // ---- the story clubs' own systems
    if (CASE === 'flashpoint') await flow('hotseat', '&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => { const m = window.__game.mode; m.grace = 0; m.scandal = 99.5; const p = m.pap[0].m.position; m.hero.position.set(p.x, 0, p.z - 3); m.camSnap = true; });
      await V.page.waitForFunction(() => window.__struggle, null, { timeout: 20000 });
      await V.page.waitForTimeout(800); await V.shot('flow_hotseat');
      await V.page.evaluate(() => window.__struggle.win());
      await V.through(() => !window.__game.mode.sedating && !document.querySelector('.c3-struggle'), 20000);
      await V.page.waitForTimeout(800); await V.shot('flow_hotseat_free');
      return await V.page.evaluate(() => { const m = window.__game.mode; return { scandal: Math.round(m.scandal), y: +m.hero.position.y.toFixed(2), pap: m.pap.length }; });
    });
    if (CASE === 'auction') await flow('booths', '&club3seed=7&club3event=none', async (V) => {
      await V.page.evaluate(() => { const m = window.__game.mode, b = m.hallA.booths[2]; m.hero.position.set(b.x, 0, b.z); m.camSnap = true; m.setXray(true); m.run(() => m.peekBooth(b, m.caseDef.booths[2])); });
      await V.page.waitForTimeout(900); await V.shot('flow_booth_xray');
      await V.through(() => !document.querySelector('#modal-root .modal-back') && !window.__game.mode.busy, 8000);
      await V.page.evaluate(() => { const m = window.__game.mode, b = m.hallA.booths[3]; m.setXray(false); m.hero.position.set(b.x, 0, b.z); m.camSnap = true; m.run(() => m.peekBooth(b, m.caseDef.booths[3])); });
      await V.page.waitForTimeout(600); await V.page.keyboard.press('1');
      await V.through(() => !document.querySelector('#modal-root .modal-back') && !window.__game.mode.busy, 8000);
      return await V.page.evaluate(() => { const m = window.__game.mode; return { found: [...m.book.found], alert: Math.round(m.alert), env: m.envelope.map((c) => c.id) }; });
    });
    if (CASE === 'halo') await flow('gate', '&club3seed=7&club3event=none', async (V) => {
      const sober = await V.page.evaluate(() => { const m = window.__game.mode, o = m.inter.find((q) => q.base === 'Search the DJ booth'); m.g.state.intox = 0; o.act(); return { label: (m.stepStory(0), o.label), sub: !!m.sub }; });
      await V.page.waitForTimeout(400);
      const high = await V.page.evaluate(() => { const m = window.__game.mode, o = m.inter.find((q) => q.base === 'Search the DJ booth'); m.g.state.intox = 50; m.stepStory(0); o.act(); return { label: o.label, sub: !!m.sub, garbled: m.garbled() }; });
      await V.page.waitForTimeout(900); await V.shot('flow_gate_high');
      return { sober, high };
    });
    // ---- generated cases: each seed's crowd beats, in its own order, the phones up, the headline
    for (const seed of GEN) {
      await flow(`gen${seed}`, `&club3case=gen&club3gen=${seed}&club3seed=${seed}&club3event=none&club3beat=9999`, async (V) => {
        const info = await V.page.evaluate(() => { const m = window.__game.mode, d = m.caseDef; return { title: d.title, ...d.gen, profile: undefined, room: m.plan.id, fz: m.plan.V.floor.z, need: d.need, obj: m.objectiveList().map((o) => o.t) }; });
        let n = 0;
        await V.put(info.seed % 2 ? -3 : 3, info.fz + 3, 900);
        await V.shot(`gen${seed}_00_start`); await V.strip(`gen${seed}`, n++);
        const out = { title: info.title, suspect: info.suspect, clue: info.clue, twist: info.twist, room: info.room, obj: info.obj, beats: [] };
        for (const [bi, kind] of info.beats.entries()) {
          await V.page.evaluate((k) => { const m = window.__game.mode; m.run(() => m.beat(k)); }, kind);
          await V.gwait(kind === 'headline' ? 1.4 : 1.1);
          const gl = await V.gl();
          await V.shot(`gen${seed}_${bi + 1}_${kind}`); await V.strip(`gen${seed}`, n++);
          // answer the beat (each seed answers differently: down it / palm it / say no …)
          const pickI = (seed + bi) % 3;
          if (await V.page.evaluate(() => !!document.querySelector('#c3-quick.on'))) { await V.page.keyboard.press(String(pickI + 1)); }
          await V.gwait(1.3); await V.strip(`gen${seed}`, n++);
          await V.through(() => !window.__game.mode.busy && !document.querySelector('#c3-quick.on'), 15000);
          out.beats.push({ kind, pick: pickI, calls: gl.calls });
        }
        // the snapper (if one ran) and the case board line
        const tail = await V.page.evaluate(() => { const m = window.__game.mode, B = m.gb; return { snapper: !!B.snapper, snapRoom: B.snapper?.room?.kind || null, photo: B.photo, intox: Math.round(m.g.state.intox), env: (m.envelope || []).map((c) => c.id), noted: [...m.noted], obj: m.objectiveList().map((o) => o.t) }; });
        if (tail.snapper) {
          await V.gwait(2.5);
          await V.page.evaluate(() => { const m = window.__game.mode, p = m.gb.snapper.m.position; m.hero.position.set(p.x + 1, 0, p.z + 0.6); m.camSnap = true; m.gb.snapper.walk = 0; m.gb.snapper.path = []; });
          await V.page.waitForTimeout(900);
          await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.confrontSnapper()); });
          await V.gwait(0.5); await V.shot(`gen${seed}_8_snapper`); await V.strip(`gen${seed}`, n++);
          await V.page.keyboard.press('2');
          await V.page.waitForTimeout(1200);
          await V.through(() => !window.__game.mode.busy && !document.querySelector('#c3-quick.on'), 15000);
        }
        // the proof (a fake) or the phone (real): then solve it and read the morning paper
        await V.page.evaluate(async () => { const m = window.__game.mode, d = m.caseDef, T = (await import('/src/club3d/casedata.js')).TWISTS[d.gen.twist]; if (T.proof) m.run(() => m.gotClue(T.proof, { title: 'Proof' })); });
        await V.page.waitForTimeout(1200); await V.shot(`gen${seed}_9_proof`); await V.strip(`gen${seed}`, n++);
        await V.through(() => !window.__game.mode.busy, 10000);
        await V.page.evaluate(() => { const m = window.__game.mode; m.run(() => m.solveCase('accusation')); });
        await V.through(() => !!document.querySelector('.paper'), 12000);
        await V.page.waitForTimeout(800); await V.shot(`gen${seed}_9_paper`); await V.strip(`gen${seed}`, n++);
        await V.through(() => !window.__game.mode.busy, 15000);
        return { ...out, ...tail, after: await V.page.evaluate(() => ({ proof: window.__game.mode.gb.proof, phone: window.__game.mode.gb.phoneBack, solved: window.__game.mode.caseSolved })) };
      });
    }
    for (const ev of ['redcarpet', 'paparazzi', 'raid', 'firealarm', 'fight']) {
      await flow(`ev_${ev}`, `&club3room=rave&club3seed=7&club3event=${ev}`, async (V) => {
        await V.put(0, 6, 800);
        await V.page.evaluate(() => { const m = window.__game.mode; if (m.event) m.event.t = 200; });
        await V.page.waitForTimeout(2500);
        await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
        await V.shot(`flow_ev_${ev}`);
        return await V.page.evaluate(() => { const m = window.__game.mode; return { mode: window.__game.modeName, phase: m.event?.phase, hint: m.dropHint() }; });
      });
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(metrics, null, 1));
    console.log(`errors: ${metrics.errors.length}`); for (const e of metrics.errors.slice(0, 10)) console.log('  ', e.split('\n')[0]);
    console.log(`→ ${path.relative(ROOT, OUT)}`);
    await browser.close();
    srv.kill();
  }
})();
