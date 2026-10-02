// The painted side-view street façades (assets/brawl/backdrops, 2000x1200 WebP) used as some of the
// street-fight's building blocks, mixed in among the generated ones. Each entry records where the
// painting's buildings meet the pavement (fraction of image height): everything above that line is
// used, aligned to the stage's own pavement. Loading is async and off the fight's critical path; a
// block shows its generated stand-in until its painting has decoded. Only the current street's few
// paintings are kept (decoded 2000x1200 images are ~10 MB each).
const DIR = 'assets/brawl/backdrops/';

export const PAINTINGS = {
  // daylight storefronts (downtown / retail); scale = world units per source pixel
  downtown: {
    scale: 0.21, night: false,
    list: [['downtown-01', 0.77], ['downtown-02', 0.8], ['downtown-03', 0.78], ['downtown-04', 0.75], ['downtown-05', 0.7],
      ['downtown-06', 0.72], ['downtown-07', 0.72], ['downtown-08', 0.75], ['downtown-09', 0.73], ['downtown-10', 0.71]],
  },
  // red-light alley façades, painted at night (neon, lit windows with silhouettes)
  rld: {
    scale: 0.22, night: true,
    list: [['rld-alley-01', 0.69], ['rld-alley-02', 0.68], ['rld-alley-03', 0.68], ['rld-alley-04', 0.67], ['rld-alley-05', 0.69],
      ['rld-alley-06', 0.67], ['rld-alley-07', 0.7], ['rld-alley-08', 0.69], ['rld-alley-09', 0.68], ['rld-alley-10', 0.7]],
  },
};
// Which painted set a district draws from (others stay fully generated); share = chance a block is painted.
export const DISTRICT_PAINTINGS = {
  downtown: { set: 'downtown', share: 0.45 }, retail: { set: 'downtown', share: 0.45 }, financial: { set: 'downtown', share: 0.3 },
  redlight: { set: 'rld', share: 0.5 }, nightclub: { set: 'rld', share: 0.45 }, naughty: { set: 'rld', share: 0.45 },
};

const loaded = new Map(); // name → { img, ready }

/** Start loading these paintings (and drop any others: the cache only holds the current street's). */
export function usePaintings(names) {
  for (const k of [...loaded.keys()]) if (!names.includes(k)) loaded.delete(k);
  for (const n of names) {
    if (loaded.has(n)) continue;
    const e = { img: new Image(), ready: false };
    e.img.decoding = 'async';
    e.img.src = DIR + n + '.webp';
    (e.img.decode ? e.img.decode() : new Promise((res) => { e.img.onload = res; })).then(() => { e.ready = true; }, () => { loaded.delete(n); });
    loaded.set(n, e);
  }
}

/** The decoded image, or null while it's still loading (or failed: the block stays generated). */
export function painting(name) { const e = loaded.get(name); return e && e.ready ? e.img : null; }
