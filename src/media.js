// The clip library: assets/video/manifest.json lists every file in each assets/video/<folder>/
// (written by tools/build_video_manifest.js). Loaded once; anything that plays clips asks here.
let manifest = null;

/** Promise of { folderName: [url, …] } (URLs ready to use; empty if there's no manifest). */
export function mediaFolders() {
  if (!manifest) {
    manifest = fetch('assets/video/manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((m) => {
        const out = {};
        for (const [name, files] of Object.entries(m.folders || {})) {
          out[name] = files.map((f) => 'assets/video/' + f.split('/').map(encodeURIComponent).join('/'));
        }
        return out;
      });
  }
  return manifest;
}

export const isImage = (url) => /\.(jpe?g|png|webp|gif)$/i.test(url);

/**
 * Keep a looping <video> looping; call it every half second or so while it should be playing.
 * Starts it again when something paused it under us (a stall, iOS handing the audio elsewhere),
 * and rewinds it when it hangs on its last frame instead of wrapping (the clips' audio ends a frame
 * before the picture, and a browser can wait there for good). `play` is how to start it (a muted
 * fallback, say). A clip that isn't set to loop is only restarted, never rewound.
 */
const lastT = new WeakMap();
export function keepLooping(v, play = () => v.play()) {
  if (!v || !v.getAttribute('src')) return;
  const t = v.currentTime, was = lastT.get(v);
  lastT.set(v, t);
  if (v.paused) { if (!v.ended) play().catch(() => {}); return; }
  if (v.loop && t === was && v.duration && t >= v.duration - 0.3) v.currentTime = 0; // hung on the last frame
}
