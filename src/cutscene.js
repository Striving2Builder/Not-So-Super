// Full-screen cutscenes: a random clip (video or still) from an assets/video/<folder>/, with a caption,
// tap/click/key to skip. The game pauses while it plays. With no clips in the folder it shows the
// caption on its own for a moment, so the flow never depends on the files being there.
import { mediaFolders, isImage } from './media.js';
import { UI } from './ui.js';
import { pick, $ } from './util.js';

/**
 * @param folder   assets/video/<folder>/ to pick a clip from
 * @param caption  HTML over the bottom of the screen
 * @param maxSecs  cut videos off after this long (stills and caption-only show for `holdSecs`)
 * @returns Promise that resolves when it's over
 */
export async function playCutscene({ folder, caption = '', maxSecs = 12, holdSecs = 3.2 }) {
  const el = $('cutscene');
  if (!el) return;
  const folders = await mediaFolders();
  const url = pick(folders[folder] || []) || null;
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
      el.removeEventListener('click', end);
      video.pause(); video.removeAttribute('src'); video.load();
      img.removeAttribute('src');
      el.classList.remove('on');
      UI.open = Math.max(0, UI.open - 1);
      resolve();
    };
    const key = (e) => { e.preventDefault(); e.stopPropagation(); end(); };
    addEventListener('keydown', key, true);
    el.addEventListener('click', end);
    if (url && !isImage(url)) {
      el.classList.remove('still');
      video.src = url;
      video.onended = end;
      video.onerror = () => { timer = setTimeout(end, holdSecs * 1000); }; // missing file: caption only
      video.play().catch(() => { video.muted = true; video.play().catch(() => {}); }); // sound if allowed
      timer = setTimeout(end, maxSecs * 1000);
    } else {
      el.classList.add('still');
      if (url) img.src = url;
      timer = setTimeout(end, holdSecs * 1000);
    }
  });
}
