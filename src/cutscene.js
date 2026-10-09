// Full-screen cutscenes: a random clip (video or still) from an assets/video/<folder>/, with a caption,
// tap/click/key to skip. The game pauses while it plays. With no clips in the folder it shows the
// caption on its own for a moment, so the flow never depends on the files being there.
import { mediaFolders, isImage, keepLooping } from './media.js';
import { UI } from './ui.js';
import { cycle, $ } from './util.js';

/**
 * Keep a clip repeating. The `loop` attribute is not enough: the first play of a clip with sound
 * (iOS, and the shared cutscene element after the intro) runs to the end and stops. `ended`
 * starts it again; if that play is blocked, it retries muted.
 */
function holdLoop(video) {
  video.loop = true;
  video.setAttribute('loop', '');
  video.onended = () => {
    if (!video.loop) return;
    video.currentTime = 0;
    video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
  };
}

/**
 * @param folder    assets/video/<folder>/ to pick a clip from
 * @param src       one file to play instead of a folder (the game intro)
 * @param caption   HTML over the bottom of the screen
 * @param maxSecs   cut videos off after this long (the clip loops until then); 0: no timer
 * @param tapSkips  a tap always ends it (otherwise the first tap turns sound on)
 * @param loops     end after the clip has played this many times through (the forced capture clip: 3)
 * @param skipTaps  taps it takes to skip (after the sound tap); a counter shows what's left
 * @param untilTap  loop the clip (or hold the still) until the player skips it: no timer, no loop count
 * @param once      play the clip a single time and end with it (the game intro); everything else loops
 * @returns Promise that resolves when it's over
 */
export async function playCutscene({ folder, src, caption = '', maxSecs = 12, holdSecs = 3.2, tapSkips = false, loops = 0, skipTaps = 1, untilTap = false, once = false }) {
  const el = $('cutscene');
  if (!el) return;
  const url = src || cycle(`clips:${folder}`, (await mediaFolders())[folder] || []) || null;
  const video = el.querySelector('video'), img = el.querySelector('img');
  const skipEl = el.querySelector('.cs-skip'), skipText = skipEl.textContent;
  el.querySelector('.cs-cap').innerHTML = caption;
  el.classList.toggle('bare', !url);
  el.classList.add('on');
  UI.open++;
  return new Promise((resolve) => {
    let done = false, timer = null, alive = null, played = 0, lastT = 0, taps = 0;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearInterval(alive);
      removeEventListener('keydown', key, true);
      el.removeEventListener('click', onClick);
      video.pause(); video.loop = false; video.removeAttribute('loop'); video.onended = video.ontimeupdate = video.onerror = null; video.removeAttribute('src'); video.load();
      img.removeAttribute('src');
      skipEl.textContent = skipText;
      el.classList.remove('on');
      UI.open = Math.max(0, UI.open - 1);
      resolve();
    };
    const left = () => { skipEl.textContent = skipTaps > 1 ? (taps ? `tap ${skipTaps - taps} more to skip` : `tap ${skipTaps}× to skip`) : skipText; };
    // a skip takes skipTaps deliberate taps (or keys), so a stray one never ends a forced clip
    const skip = () => { if (++taps >= skipTaps) end(); else left(); };
    const key = (e) => { e.preventDefault(); e.stopPropagation(); skip(); };
    const onClick = () => {
      if (!tapSkips && video.muted && video.src && !video.paused) { video.muted = false; return; }
      skip();
    };
    addEventListener('keydown', key, true);
    el.addEventListener('click', onClick);
    left();
    if (url && !isImage(url)) {
      el.classList.remove('still');
      video.src = url;
      if (once) { video.loop = false; video.removeAttribute('loop'); } else holdLoop(video);
      // A pass ends with the browser wrapping it (the playhead jumps back to the start) or, when it
      // ignored `loop` (the first play of a clip with sound, iOS), with `ended`: we start it again.
      const pass = () => loops > 0 && !untilTap && ++played >= loops;
      video.onended = () => { if (once || pass()) return end(); lastT = 0; video.currentTime = 0; go().catch(() => {}); };
      video.ontimeupdate = () => {
        const t = video.currentTime;
        if (t < lastT - 0.5 && pass()) end();
        lastT = t;
      };
      video.onerror = () => { clearInterval(alive); timer = setTimeout(end, holdSecs * 1000); }; // missing file: caption only
      const go = () => video.play().catch(() => { video.muted = true; return video.play(); }); // sound if allowed
      go().catch(() => {});
      alive = setInterval(() => keepLooping(video, go), 600); // paused under it or hung on the last frame: back on
      if (maxSecs > 0 && !loops && !untilTap) timer = setTimeout(end, maxSecs * 1000);
    } else {
      el.classList.add('still');
      if (url) img.src = url;
      if (!url || !untilTap) timer = setTimeout(end, holdSecs * 1000);
    }
  });
}

/**
 * A clip played inside a green-screen still (a cell TV, a billboard…), full screen. Story beats are
 * told this way. `lockSecs` makes it unskippable for that long (a countdown shows; a short clip
 * loops); after that a tap ends it, or it ends with the clip. `untilTap` keeps the clip looping
 * until a tap, with no timer. With no clip in `folder` the screen shows static for `holdSecs`
 * and the flow carries on.
 * @param screens  still URLs to pick from (see greenscreen.js)
 * @param folder   assets/video/<folder>/ for the clip, or a list (the first folder with clips wins)
 * @param clipUrl  one clip to play instead of a folder's
 * @param image    a still (canvas or image) to show on the screen instead of a clip
 * @returns Promise that resolves when it's over
 */
export async function playScreenScene({ screens, folder, clipUrl = null, image = null, caption = '', lockSecs = 0, maxSecs = 60, holdSecs = 3.5, untilTap = false }) {
  const el = $('cutscene');
  if (!el || !screens || !screens.length) return;
  const [{ loadScreen, drawScreen }, folders] = await Promise.all([import('./greenscreen.js'), mediaFolders()]);
  const scr = await loadScreen(cycle(`screens:${screens[0].replace(/[^/]*$/, '')}`, screens));
  if (!scr) return;
  const pool = [].concat(folder || []).map((f) => (folders[f] || []).filter((u) => !isImage(u))).find((l) => l.length) || [];
  const url = pool;
  const clip = image ? null : clipUrl || cycle(`clips:${[].concat(folder || []).join(',')}`, url) || null;
  const lock = clip ? lockSecs : 0;
  const cv = document.createElement('canvas');
  cv.className = 'cs-screen';
  el.appendChild(cv);
  const skipEl = el.querySelector('.cs-skip'), skipText = skipEl.textContent;
  el.querySelector('.cs-cap').innerHTML = caption;
  el.classList.add('on', 'bare', 'screen');
  UI.open++;
  const video = el.querySelector('video');
  return new Promise((resolve) => {
    const t0 = performance.now();
    let done = false, raf = 0, kick = 0;
    const elapsed = () => (performance.now() - t0) / 1000;
    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', key, true);
      el.removeEventListener('click', tap);
      video.pause(); video.loop = false; video.removeAttribute('loop'); video.onended = video.onerror = null; video.removeAttribute('src'); video.load();
      cv.remove(); skipEl.textContent = skipText;
      el.classList.remove('on', 'bare', 'screen');
      UI.open = Math.max(0, UI.open - 1);
      resolve();
    };
    const tap = () => { if (elapsed() >= lock) end(); };
    const key = (e) => { e.preventDefault(); e.stopPropagation(); tap(); };
    addEventListener('keydown', key, true);
    el.addEventListener('click', tap);
    let source = null, failed = false;
    if (clip) {
      video.src = clip;
      holdLoop(video); // shorter than the lock, and an untilTap scene, both repeat; the first play included
      video.onerror = () => { source = null; failed = true; };
      video.play().then(() => { source = video; }).catch(() => { video.muted = true; video.play().then(() => { source = video; }).catch(() => {}); });
    }
    const frame = () => {
      if (done) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      drawScreen(ctx, scr, image || (source && source.readyState >= 2 ? source : null), 0, 0, w, h);
      const t = elapsed();
      // paused under it or hung on the last frame: back on
      if (clip && !failed && t - kick > 0.6) {
        kick = t; keepLooping(video, () => video.play().catch(() => { video.muted = true; return video.play(); }).then(() => { source = video; }));
      }
      skipEl.textContent = t < lock ? `🔒 ${Math.ceil(lock - t)}s` : 'tap to continue';
      if (image) { if (!untilTap && t >= maxSecs) return end(); raf = requestAnimationFrame(frame); return; }
      if ((!clip || failed) && t >= holdSecs) return end();
      if (untilTap && clip && !failed) { raf = requestAnimationFrame(frame); return; }
      if ((clip && !video.loop && video.ended) || t >= Math.max(maxSecs, lock)) return end();
      if (clip && t >= lock && lock > 0) { video.loop = false; video.removeAttribute('loop'); } // served: let it finish on its own
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
