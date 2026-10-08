// The 3D infiltration clubs (src/club3d/, ?club=v3): screenshots of every main-room variation and
// its side rooms, fps / draw calls / triangles per view, and the club's flows played through
// (Talker → clue, close-up + phone, VIP quiz → dance, a back-room fight, sedation → wake → capture,
// the owner's confession → solved → skylight, the leak → thrown out, each per-visit event).
//   node tools/shots/club3d.js [--label c3] [--port 8881] [--rooms rave,pit] [--flows all|none|sedate,confess]
//                              [--case squirt|blackmail|earworm] [--w 844 --h 390]
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
const W = +arg('--w', 844), H = +arg('--h', 390);
const OUT = path.join(ROOT, 'shots', LABEL, 'club3d');
const want = (f) => FLOWS === 'all' || FLOWS.split(',').includes(f);

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
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const modal = () => page.evaluate(() => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); if (!el) return null; return { text: el.innerText.slice(0, 240).replace(/\s+/g, ' '), opts: [...el.querySelectorAll('.opt')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) }; });
    const clickTop = (idx) => page.evaluate((idx) => { const el = [...document.querySelectorAll('#modal-root .modal-back')].pop(); if (!el) return; const o = el.querySelectorAll('.opt'); if (o.length) o[Math.max(0, Math.min(o.length - 1, idx))].click(); else el.click(); }, idx);
    const V = {
      page, errors,
      shot: (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }),
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
    };
    await page.goto(`http://localhost:${PORT}/?flight=2d&club=v3&club3under=0&club3case=${CASE}${query}`);
    await page.waitForFunction(() => window.__game && document.querySelector('#btn-new'), null, { timeout: 30000 });
    await page.evaluate(async () => { (await import('/src/settings.js')).autoTune.done = true; });
    await page.mouse.click(W / 2, H / 2); // (skips the intro video)
    await page.waitForTimeout(300);
    await page.click('#btn-new');
    await page.waitForTimeout(500);
    await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
    await page.evaluate(() => { const g = window.__game; g.setMode('overworld'); g.startZone(g.overworld.spawn('special', true, 'Nightclub')); });
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
      await V.page.evaluate(async () => {
        const { CLOSEUPS } = await import('/src/nightclub/scenes.js');
        const g = window.__game, sc = CLOSEUPS.bar, img = sc.img, s = Math.max(g.w / img.naturalWidth, g.h / img.naturalHeight);
        const R = { x: (g.w - img.naturalWidth * s) / 2, y: (g.h - img.naturalHeight * s) * 0.8, w: img.naturalWidth * s, h: img.naturalHeight * s }, p = sc.spots.find((q) => q.id === 'phone');
        g.input.taps.push({ x: R.x + p.x * R.w, y: R.y + p.y * R.h });
      });
      await V.page.waitForTimeout(900); await V.shot('flow_closeup_phone');
      // put the phone back, then photograph it with the CAMERA
      await V.through(() => !document.querySelector('#modal-root .modal-back'), 5000);
      await V.page.evaluate(() => { const g = window.__game; g.input.taps.push({ x: 5, y: 5 }); });
      await V.page.waitForTimeout(300);
      await V.page.evaluate(async () => {
        const { CLOSEUPS } = await import('/src/nightclub/scenes.js');
        const g = window.__game, sc = CLOSEUPS.bar, img = sc.img, s = Math.max(g.w / img.naturalWidth, g.h / img.naturalHeight);
        const R = { x: (g.w - img.naturalWidth * s) / 2, y: (g.h - img.naturalHeight * s) * 0.8, w: img.naturalWidth * s, h: img.naturalHeight * s }, p = sc.spots.find((q) => q.id === 'phone');
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
      await V.through(() => !window.__game.mode.sub && !document.querySelector('#modal-root .modal-back'), 90000);
      return { envelope: await V.page.evaluate(() => window.__game.mode.envelope.map((c) => c.id + (c.img ? '*' : ''))) };
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
