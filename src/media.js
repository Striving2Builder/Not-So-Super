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
