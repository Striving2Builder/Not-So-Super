import { Input, goFullscreen } from './input.js';
import { City } from './city.js';
import { GameState, VICE_LIMIT, INTOX_LIMIT } from './state.js';
import { Overworld } from './overworld.js';
import { Brawler } from './brawler.js';
import { Investigate } from './investigate.js';
import { Special3D } from './special3d.js';
import { Captured } from './captured.js';
import { ClubZone } from './clubzone.js';
import { NightCase } from './nightcase.js';
import { AsylumZone } from './asylum.js';
import { Nightclub } from './nightclub/nightclub.js';
import { showNewspaper } from './newspaper.js';
import { HERO, DISTRICTS, THEMES, DEALS, BOSSES, VENUES, BILLBOARDS } from './data.js';
import { UI, dialog, toast } from './ui.js';
import { sfx } from './sfx.js';
import { ambience } from './ambience.js';
import { $, pick, chance, fmtTime } from './util.js';
import { loadHero, HERO_SKIN } from './hero3d.js';
import { loadEnemies } from './enemies.js';
import { playScreenScene } from './cutscene.js';
import { comic } from './comic.js';
import { Commentary } from './commentary.js';
import { settings, quality, autoTune, HERO_SKIN_LABELS } from './settings.js';
import { perfHud } from './perfhud.js';
import { gfxLost, crashedLastTime } from './gfx.js';
import { BUILD } from './version.js';

loadHero();
loadEnemies(); // guard and boss models for the 3D zones (procedural stand-ins until they arrive)

const canvas = $('c2d');
const ctx = canvas.getContext('2d');
const game = { canvas, ctx, w: 0, h: 0, input: new Input(), state: null, city: null, vice: { active: false }, title: true };
game.modes = {
  overworld: new Overworld(game),
  brawler: new Brawler(game),
  investigate: new Investigate(game),
  special: new Special3D(game),
  captured: new Captured(game),
  club: new ClubZone(game),
  nightcase: new NightCase(game),
  asylum: new AsylumZone(game),
  nightclub: new Nightclub(game),
};
game.overworld = game.modes.overworld;
game.commentary = new Commentary(game);
window.__game = game; // handy for debugging from the console

function resize() {
  game.w = innerWidth; game.h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, quality().dpr2d);
  canvas.width = Math.round(game.w * dpr);
  canvas.height = Math.round(game.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.modes.special.resize();
  game.modes.club.resize();
  game.modes.nightcase.resize();
  game.modes.asylum.resize();
}
addEventListener('resize', resize);
settings.onChange(() => resize()); // resolution follows the graphics profile
addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

game.setMode = (name, p) => {
  if (game.mode && game.mode.exit) game.mode.exit();
  game.modeName = name;
  game.mode = game.modes[name];
  document.body.dataset.mode = name;
  game.input.reset();
  // speech bubbles and bursts point at things in the old scene; captions/headlines/spin survive
  document.querySelectorAll('#comic-layer .bubble, #comic-layer .pow').forEach((e) => e.remove());
  $('toasts').innerHTML = ''; // the last mode's notices don't stack onto the new scene's intro
  $('prompt').classList.remove('on');
  $('marker').classList.remove('on');
  game.mode.enter(p || {});
  ambience.setMode(name);
};

// WebGL can't be had at all any more: 3D flight drops to the 2D view; a 3D zone in progress is left.
game.gfxFailed = () => {
  game.overworld.drop3D();
  const m = game.mode;
  if (m && m !== game.overworld && 'renderer' in m && !m.renderer && m.zone && !m.done) { m.done = true; game.endZone(m.zone, { outcome: 'abort', rep: 0 }); }
};

// ---------------------------------------------------------------- zone flow
// the detective nightclubs are the default since 2026-10-05; ?club=v1 brings back the premade 3D clubs
const NEW_CLUBS = !/[?&]club=v1(&|$)/.test(location.search);
game.newClubs = NEW_CLUBS; // the overworld skips loading the premade club buildings

/** Which game mode plays a zone. */
function modeFor(z) {
  // the detective nightclub redesign (docs/design/nightclub.md)
  if (NEW_CLUBS && z.mode === 'special' && (VENUES[z.venue]?.club || VENUES[z.venue]?.kind === 'club')) return 'nightclub';
  if (z.mode === 'special' && VENUES[z.venue]?.club) return 'club';  // raid inside a premade club
  return { brawl: 'brawler', investigate: 'investigate', special: 'special', nightcase: 'nightcase', asylum: 'asylum' }[z.mode];
}

game.startZone = (z) => {
  try { game.setMode(modeFor(z), { zone: z }); } catch (e) {
    // (a 3D zone without a WebGL context, out of memory…): back to the sky, not a frozen half-scene
    console.error(e);
    toast("Couldn't open that scene. Try again in a moment.", 'bad');
    try { game.mode.exit?.(); } catch (e2) { /* half-entered */ }
    game.mode = null;
    game.setMode('overworld', { returnFrom: z });
    return;
  }
  game.commentary.onZoneStart(z);
  if (z.mode === 'brawl' && game.h > game.w) toast('Tip: rotate to landscape for street fights', 'info');
};

game.endZone = async (zone, res) => {
  const st = game.state;
  game.overworld.removeZone(zone);
  if (res.outcome === 'captured') {
    st.stats.captures++;
    game.setMode('captured', { zone, reason: res.reason, direct: chance(0.25) });
    game.commentary.onZoneEnd('captured');
    return;
  }
  if (res.outcome === 'win') {
    st.addRep(res.rep, 'Saved the day');
    if (zone.mode === 'brawl') st.stats.saves++;
    if (zone.mode === 'investigate' || zone.mode === 'nightcase' || zone.mode === 'asylum') st.stats.cases++;
    if (zone.mode === 'special') st.stats.specials++;
    await showNewspaper({ ...victoryPaper(zone, res), rep: res.rep });
  } else if (res.outcome === 'lose') {
    st.addRep(res.rep, 'Mission failed');
    if (zone.mode === 'brawl') {
      // story beat: the city wakes up to her defeat on every billboard
      const vice = BILLBOARDS.vice.includes(zone.district);
      await playScreenScene({
        screens: vice ? BILLBOARDS.rld : BILLBOARDS.downtown, folder: BILLBOARDS.folders, maxSecs: 14, holdSecs: 4,
        caption: `By morning, every billboard in ${DISTRICTS[zone.district]?.name || 'the city'} is playing it…`,
      });
    }
    await dialog({ title: 'Mission failed', text: res.text || 'The crooks got away this time.' });
  } else {
    st.addRep(res.rep, 'Left the scene');
  }
  st.save();
  game.setMode('overworld', { returnFrom: zone });
  game.commentary.onZoneEnd(res.outcome);
};

game.endCapture = async (zone, escaped, villain) => {
  const st = game.state;
  const venue = zone.venue.toUpperCase();
  if (escaped) {
    st.addRep(-10, 'Captured');
    await showNewspaper({
      tabloid: true, photo: 'tabloid', rep: -10,
      headline: pick([`${HERO.toUpperCase()} IN A BIND!`, `HEROINE NABBED AT ${venue}`, `WHO SAVES THE SAVIOR?`]),
      sub: `…but the Girl of Steel wriggles free before ${villain} can finish the job`,
      body: [`Witnesses at the ${zone.venue} say ${HERO} was seen being carried into a back room by thugs late last night.`, `She emerged an hour later, rope burns and all. "No comment," she said. Our readers have plenty of comments.`],
    });
  } else {
    await ultimatum(zone, villain);
  }
  st.save();
  game.setMode('overworld', { returnFrom: zone });
};

async function ultimatum(zone, villain) {
  const st = game.state;
  const deal = pick(DEALS);
  const task = deal.task.replaceAll('{V}', villain);
  const v = await dialog({
    title: 'THE ULTIMATUM', speaker: villain, cls: 'danger',
    text: `"Here's my offer, hero. Choose."<br><br><b>A)</b> I release the footage of you tied up in my ${zone.venue}. Every paper in town runs it tomorrow.<br><br><b>B)</b> You <b>${task}</b>. And you stay out of every <b>${zone.lockKey}</b> in the city for three minutes.<br><br>"Do we have a deal?"`,
    options: [
      { label: 'A — Take the public humiliation', note: '−30 reputation', value: 'A', cls: 'bad' },
      { label: 'B — Take the embarrassing deal', note: `−8 reputation · no ${zone.lockKey} zones for 3:00`, value: 'B', cls: 'risky' },
    ],
  });
  if (v === 'A') {
    st.addRep(-30, 'Public humiliation');
    await showNewspaper({
      tabloid: true, photo: 'tabloid', rep: -30,
      headline: `SHOCK FOOTAGE: ${HERO.toUpperCase()} HELPLESS IN ${zone.venue.toUpperCase()}!`,
      sub: `Villain ${villain} leaks video of the caped crusader tied to a chair`,
      body: [`The grainy clip, sent anonymously to every newsroom in the city, shows ${HERO} slumped in a chair beside a glowing green rock.`, `"Some hero," scoffed one commuter. City Hall declined to comment.`],
    });
  } else {
    st.addRep(-8, 'Humiliating deal');
    st.lockouts[zone.lockKey] = 180;
    await showNewspaper({
      tabloid: true, photo: 'deal', rep: -8,
      headline: deal.headline.replaceAll('{H}', HERO.toUpperCase()).replaceAll('{V}', villain.toUpperCase()),
      sub: `Fans baffled as ${HERO} agrees to ${task.charAt(0).toLowerCase() + task.slice(1)}`,
      body: [`Nobody knows why the city's favorite heroine would do such a thing. Insiders whisper about "some kind of deal."`, `Meanwhile, ${zone.lockKey} owners across the city report a strange lack of superheroines on the premises.`],
    });
    toast(`You can't dive into ${zone.lockKey} zones for 3:00`, 'bad');
  }
}

function victoryPaper(zone, res) {
  const H = HERO.toUpperCase();
  const D = DISTRICTS[zone.district].name;
  if (zone.mode === 'brawl') {
    const fire = zone.variant === 'fire';
    return {
      photo: fire ? 'fire' : 'hero',
      headline: chance(0.6) ? `${H} SAVES THE DAY!` : pick(fire ? [`${H} BATTLES BLAZE IN ${D.toUpperCase()}!`] : zone.boss ? [`${zone.boss.toUpperCase()} BEHIND BARS!`] : [`${zone.name.toUpperCase()} FOILED!`, `THUGS NO MATCH FOR ${H}`]),
      sub: fire ? `Heroine pulls ${res.saved} from the flames in ${D}` : `${zone.name} stopped cold in ${D}${res.saved ? `; ${res.saved} rescued` : ''}`,
      body: [
        `${D} residents watched in awe as ${HERO} dropped from the sky and ${fire ? 'smothered the blaze with a single breath' : 'sent a gang of crooks flying'}.`,
        `"She was amazing," said one onlooker. "Light blue, red boots, and a punch like a freight train." Police arrived to find the suspects ${fire ? 'already cuffed to a lamppost' : 'neatly stacked on the sidewalk'}.`,
      ],
    };
  }
  if (zone.mode === 'investigate' || zone.mode === 'nightcase' || zone.mode === 'asylum') {
    return {
      photo: 'case',
      headline: chance(0.5) ? `${H} CRACKS THE CASE!` : `MYSTERY SOLVED!`,
      sub: `${res.culprit}, ${res.job}, exposed as the culprit behind ${zone.def.crime}`,
      body: [
        `In a stunning piece of detective work, ${HERO} pieced together the clues in ${D} and named ${res.culprit} as the mastermind.`,
        res.photos ? `Exclusive photos of the evidence (${res.photos} in all) were supplied to this paper by our staff photographer. See pages 2–5.` : 'The Gazette regrets that no photographs of the evidence were available.',
      ],
    };
  }
  const th = THEMES[zone.theme];
  return {
    photo: 'special',
    headline: zone.boss ? `${zone.boss.toUpperCase()} TAKEN DOWN!` : `${H} SMASHES ${th.headline}!`,
    sub: `${zone.venue} raided${zone.venue !== D ? ` in ${D}` : ''}${zone.boss ? ` — ${th.headline.toLowerCase()} kingpin in custody` : ''}`,
    body: [
      `Acting on a tip, ${HERO} slipped into the ${zone.venue} last night and dismantled a ${th.name.toLowerCase()} operation from the inside.`,
      `Police say the evidence she recovered will keep prosecutors busy for months. "We owe her one," said the Commissioner. "Again."`,
    ],
  };
}

// ---------------------------------------------------------------- menus
const HOWTO = `<div class="howto">
  <h3>Patrol</h3>Fly over the city with the joystick (or <kbd>WASD</kbd>/arrows). <kbd>Shift</kbd>/BOOST to go fast. Change altitude with <kbd>R</kbd>/▲ and <kbd>F</kbd>/▼: high patrol is fast and hides you from tabloid cameras; skimming the rooftops lets you see the streets, but towers get in the way. Slow down over a rooftop and press <kbd>H</kbd>/PERCH to land and use super-hearing to pick up nearby crimes. Glowing beacons are incidents — fly over one and press DIVE (<kbd>Space</kbd>); you can steer your dive. <kbd>M</kbd> opens the map: tap it (or an incident in the list) to set a waypoint, and with autopilot on she flies there whenever you let go of the stick.<h3>In the air</h3>Emergencies happen mid-flight: catch a falling window-washer or a spiralling helicopter at <i>their</i> height, drop to rooftop height to grab runaway and getaway cars, fly a stunt course of hoops, and perch on a roof to rescue a stranded kitten. At night in vice districts, tabloid drones tail you and every flash adds tabloid heat: boost away or climb to high patrol to lose them.
  <h3>Street crime ( ! and fires)</h3>Side-scrolling brawls. PUNCH (<kbd>J</kbd>) combos, JUMP (<kbd>L</kbd>/<kbd>Space</kbd>) for flying kicks, HEAT VISION / FREEZE BREATH (<kbd>K</kbd>). Stand next to captives to untie them.
  <h3>Investigations ( ? )</h3>Tap objects to search. X-RAY (<kbd>X</kbd>) sees inside sealed things. CAMERA (<kbd>C</kbd>) photographs found clues for bonus rep. Question the witness, then accuse the suspect whose traits match your clues.
  <h3>Special zones ( ★ and ☠ bosses)</h3>3D infiltrations. Get the door code, find the keycard, get into the back room, finish the job and escape. USE (<kbd>E</kbd>), PUNCH (<kbd>F</kbd>) guards from behind, X-RAY reveals bait. Drag the screen to turn the camera. <b>You can be captured here.</b>
  <h3>Ravenmoor Asylum ( ✚ )</h3>A 3D investigation in padded-cell corridors. Open cell doors (USE) to find clues, patients and witnesses; X-RAY sees through the doors. Orderlies patrol the halls. <b>Get caught and you're sedated</b>: you wake in a cell with the same case reset. The only way out is to name the culprit (SUSPECTS).
  <h3>Reputation</h3>Victories make the front page. You lose reputation for getting captured, failing, lingering in vice districts and venues (<i>tabloid heat</i>), and being seen intoxicated. Tempting drinks and gifts raise intoxication; some "gifts" are traps.
</div>`;

async function pauseMenu() {
  if (UI.open || game.title) return;
  const st = game.state;
  const inMission = game.modeName !== 'overworld' && game.modeName !== 'captured';
  const v = await dialog({
    title: 'Paused',
    text: `<div class="list"><div class="item"><b>${st.rep} REP</b> · ${st.rank}<br>Saves ${st.stats.saves} · Cases ${st.stats.cases} · Special zones ${st.stats.specials} · Captures ${st.stats.captures} · Photos ${st.stats.photos}</div></div><div class="hint">Build ${BUILD}</div>`,
    options: [
      { label: 'Resume', value: 'r' },
      { label: `Sound: ${sfx.enabled ? 'ON' : 'OFF'}`, value: 's' },
      { label: `Comic commentary: ${comic.enabled ? 'ON' : 'OFF'}`, value: 'c' },
      { label: `Graphics: ${settings.graphicsLabel}`, note: 'Battery saver: 30 fps, lighter clubs', value: 'g' },
      { label: `City feed videos: ${settings.cityFeed ? 'ON' : 'OFF'}`, note: 'Clips in the minimap corner', value: 'f' },
      { label: `Hero: ${HERO_SKIN_LABELS[settings.hero]}`, note: settings.hero === HERO_SKIN ? 'Supergirl / Classic / Ponytail costume' : 'Reload the page to change costume', value: 'v' },
      { label: 'How to play', value: 'h' },
      ...(inMission ? [{ label: 'Abort mission', note: '−3 reputation', value: 'a', cls: 'bad' }] : []),
      ...(game.modeName === 'overworld' ? [{ label: 'Save & quit to title', value: 'q' }] : []),
    ],
  });
  if (v === 's') { sfx.toggle(); return pauseMenu(); }
  if (v === 'c') { comic.toggle(); return pauseMenu(); }
  if (v === 'g') { settings.cycleGraphics(); return pauseMenu(); }
  if (v === 'f') { if (!settings.toggleCityFeed()) game.overworld.feed.stop(); return pauseMenu(); }
  if (v === 'v') { settings.cycleHero(); return pauseMenu(); }
  if (v === 'h') { await dialog({ title: 'How to play', text: HOWTO }); return pauseMenu(); }
  if (v === 'a' && game.mode.abort) game.mode.abort();
  if (v === 'q') { st.save(); showTitle(); }
}
$('pause-btn').addEventListener('click', () => pauseMenu());
$('fs-btn').addEventListener('click', () => goFullscreen());

function showTitle() {
  game.title = true;
  document.body.classList.add('title-on');
  const saved = GameState.load();
  $('btn-continue').style.display = saved ? '' : 'none';
  const seed = saved ? saved.seed : Math.floor(Math.random() * 1e8);
  $('seed-input').value = seed;
  game.city = new City(seed);
  game.state = null;
  game.overworld.attract = true;
  game.overworld.reset();
  game.setMode('overworld');
}

function startGame(state) {
  sfx.unlock();
  state.onRep = (n) => game.commentary.onRep(n);
  game.commentary.tier = null;
  if (document.body.classList.contains('touch')) goFullscreen(); // needs the tap that started the game
  game.state = state;
  game.city = new City(state.seed);
  game.title = false;
  document.body.classList.remove('title-on');
  game.overworld.attract = false;
  game.overworld.reset();
  game.setMode('overworld');
  state.save();
}

$('btn-continue').addEventListener('click', () => { const s = GameState.load(); if (s) startGame(s); });
$('btn-new').addEventListener('click', async () => {
  let seed = parseInt($('seed-input').value, 10);
  const saved = GameState.load();
  if (!seed || (saved && saved.seed === seed)) seed = Math.floor(Math.random() * 1e8);
  if (saved) {
    const ok = await dialog({ title: 'Start a new city?', text: 'This replaces your saved reputation and stats.', options: [{ label: 'New city', value: true, cls: 'bad' }, { label: 'Cancel', value: false }] });
    if (!ok) return;
  }
  startGame(new GameState(seed));
  await dialog({ title: `Welcome to the city, ${HERO}`, text: HOWTO, options: [{ label: 'Start patrolling', value: true }] });
});
$('btn-how').addEventListener('click', () => dialog({ title: 'How to play', text: HOWTO }));

// ---------------------------------------------------------------- HUD + loop
let hudT = 0;
function updateHUD() {
  const st = game.state;
  $('rep-val').textContent = st.rep;
  $('rank').textContent = st.rank;
  const ib = $('intox-bar'), vb = $('vice-bar');
  ib.style.width = st.intox + '%';
  vb.style.width = st.vice + '%';
  ib.parentElement.classList.toggle('warn', st.intox >= INTOX_LIMIT);
  vb.parentElement.classList.toggle('warn', st.vice >= VICE_LIMIT);
  // empty meters (and their labels) stay out of the way until they mean something
  for (const [b, v] of [[ib, st.intox], [vb, st.vice]]) {
    const row = b.parentElement, nil = v < 0.5;
    if (row._nil !== nil) { row._nil = nil; row.classList.toggle('nil', nil); row.previousElementSibling.classList.toggle('nil', nil); }
  }
  $('intox-tint').style.opacity = Math.max(0, (st.intox - 25) / 110);
  const lk = Object.entries(st.lockouts).map(([k, s]) => `<div>🔒 ${k} · ${fmtTime(s)}</div>`).join('');
  const el = $('lockouts');
  if (el._h !== lk) { el.innerHTML = lk; el._h = lk; }
}

// Objectives show just the current step on a phone; tap to see the whole list.
$('objectives').addEventListener('click', () => $('objectives').classList.toggle('open'));

let last = performance.now();
function frame(now) {
  // Battery saver caps the frame rate: skip display refreshes until a frame is due. Input edges
  // stay queued (endFrame isn't called), so no key presses are lost on skipped refreshes.
  const cap = quality().fpsCap;
  if (cap && now - last < 1000 / cap - 4) { requestAnimationFrame(frame); return; }
  const realDt = (now - last) / 1000;
  const dt = Math.min(0.05, realDt);
  last = now;
  const m = game.mode;
  // Auto graphics: measure while flying (the overworld is the steady, representative scene)
  if (game.modeName === 'overworld' && !UI.open && autoTune.sample(realDt)) {
    toast('Switched graphics to Battery saver for smoother play (change it in the pause menu)', 'info');
  }
  ambience.update(dt, !m || UI.open || gfxLost());
  if (m) {
    try {
      if (UI.open || gfxLost()) { if (m.onPaused) m.onPaused(); } // (graphics restoring: the world waits)
      else {
        m.update(dt);
        if (game.state && !game.title) {
          game.state.tick(dt, game.vice);
          game.commentary.update(dt);
          if (game.input.pressed('pause')) pauseMenu();
        }
      }
      m.render(ctx);
      if (game.state && !game.title) {
        if (m.hud) m.hud();
        hudT -= dt;
        if (hudT <= 0) { hudT = 0.1; updateHUD(); }
      }
    } catch (e) { console.error(e); }
  }
  perfHud(realDt, game, settings.graphicsLabel); // ?perf=1 only
  game.input.endFrame();
  requestAnimationFrame(frame);
}

if (game.h > game.w) $('rotate-hint').textContent = 'Tip: rotate your phone to landscape for the best experience.';
showTitle();
requestAnimationFrame(frame);
// iOS killed the last visit for memory (it reloads the tab): lighter graphics from here on, once
if (crashedLastTime() && settings.afterCrash()) setTimeout(() => toast('The browser ran out of memory last time, so graphics are now on Battery saver. You can change this in the pause menu.', 'info'), 1500);

// Periodic autosave.
setInterval(() => { if (game.state && !game.title) game.state.save(); }, 10000);

export { game };
