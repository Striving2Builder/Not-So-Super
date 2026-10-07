// Full-screen cutscenes: a random clip (video or still) from an assets/video/<folder>/, with a caption,
// tap/click/key to skip. The game pauses while it plays. With no clips in the folder it shows the
// caption on its own for a moment, so the flow never depends on the files being there.
import { mediaFolders, isImage } from './media.js';
import { UI } from './ui.js';
import { pick, $ } from './util.js';

/**
 * @param folder    assets/video/<folder>/ to pick a clip from
 * @param src       one file to play instead of a folder (the game intro)
 * @param caption   HTML over the bottom of the screen
 * @param maxSecs   cut videos off after this long; 0 plays until the clip ends
 * @param tapSkips  a tap always ends it (otherwise the first tap turns sound on)
 * @returns Promise that resolves when it's over
 */
export async function playCutscene({ folder, src, caption = '', maxSecs = 12, holdSecs = 3.2, tapSkips = false }) {
  const el = $('cutscene');
  if (!el) return;
  const url = src || pick((await mediaFolders())[folder] || []) || null;
  const video = el.querySelector('video'), img = el.querySelector('img');
  el.querySelector('.cs-cap').innerHTML = caption;
  el.classList.toggle('bare', !url);
  el.classList.add('on');
  UI.open++;
  return new Promise((resolve) => {
    let done = false, timer = null;
    const end = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      removeEventListener('keydown', key, true);
      el.removeEventListener('click', onClick);
      video.pause(); video.loop = false; video.removeAttribute('src'); video.load();
      img.removeAttribute('src');
      el.classList.remove('on');
      UI.open = Math.max(0, UI.open - 1);
      resolve();
    };
    const key = (e) => { e.preventDefault(); e.stopPropagation(); end(); };
    const onClick = () => {
      if (!tapSkips && video.muted && video.src && !video.paused) { video.muted = false; return; }
      end();
    };
    addEventListener('keydown', key, true);
    el.addEventListener('click', onClick);
    if (url && !isImage(url)) {
      el.classList.remove('still');
      video.loop = false;
      video.src = url;
      video.onended = end;
      video.onerror = () => { timer = setTimeout(end, holdSecs * 1000); }; // missing file: caption only
      video.play().catch(() => { video.muted = true; video.play().catch(() => {}); }); // sound if allowed
      if (maxSecs > 0) timer = setTimeout(end, maxSecs * 1000);
    } else {
      el.classList.add('still');
      if (url) img.src = url;
      timer = setTimeout(end, holdSecs * 1000);
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
 * @returns Promise that resolves when it's over
 */
export async function playScreenScene({ screens, folder, caption = '', lockSecs = 0, maxSecs = 60, holdSecs = 3.5, untilTap = false }) {
  const el = $('cutscene');
  if (!el || !screens || !screens.length) return;
  const [{ loadScreen, drawScreen }, folders] = await Promise.all([import('./greenscreen.js'), mediaFolders()]);
  const scr = await loadScreen(pick(screens));
  if (!scr) return;
  const pool = [].concat(folder).map((f) => (folders[f] || []).filter((u) => !isImage(u))).find((l) => l.length) || [];
  const url = pool;
  const clip = pick(url) || null;
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
    let done = false, raf = 0;
    const elapsed = () => (performance.now() - t0) / 1000;
    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      removeEventListener('keydown', key, true);
      el.removeEventListener('click', tap);
      video.pause(); video.loop = false; video.removeAttribute('src'); video.load();
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
      video.loop = true; // a clip shorter than the lock repeats until it's served; untilTap never turns this off
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
      drawScreen(ctx, scr, source && source.readyState >= 2 ? source : null, 0, 0, w, h);
      const t = elapsed();
      skipEl.textContent = t < lock ? `🔒 ${Math.ceil(lock - t)}s` : 'tap to continue';
      if ((!clip || failed) && t >= holdSecs) return end();
      if (untilTap && clip && !failed) { raf = requestAnimationFrame(frame); return; }
      if ((clip && !video.loop && video.ended) || t >= Math.max(maxSecs, lock)) return end();
      if (clip && t >= lock && lock > 0) video.loop = false; // served: let it finish on its own
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
