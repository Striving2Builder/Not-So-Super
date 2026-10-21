// Her photos: the user's green-screen stills of Supergirl, keyed into transparent cutouts
// (tools/export_greenscreen.py → assets/greenscreen/<framing>/<costume>/<name>.webp, listed in
// manifest.json). Three framings: `full` (full body), `portrait` (waist up, an expression each) and
// `face` (a square head crop: the HUD face, speech-bubble insets). Three costumes, as the story has them:
// `classic` (her own suit), `croptop` (Act 2's backup suit) and `tube` (the casino's knockoff).
//
// The file names say what each shot is (053-chased-glance, 014-heat-vision…), so a mood is just a word
// list over them. main.js keeps the costume and her baseline mood current; anything that shows her asks
// here for a URL (or a loaded <img>) and gets null until the manifest is in.

let manifest = null;
const ready = fetch('assets/greenscreen/manifest.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null)).then((m) => { manifest = m; return m; }).catch(() => null);
export const photosReady = () => ready;

/** Moods, by the words in a shot's name (a shot can carry several). */
const MOODS = {
  heroic: /salute|fist|classic|triumph|heroic|proud|determined|battle|steely|victory|power|ready|hips|emblem|rising|launch|rocket|stance|grit|flex/,
  happy: /smile|laugh|grin|giggle|joy|whoop|excited|content|thumbs|peace|wave|cheer|delight|wink|bright|amused|takeoff/,
  worried: /worried|alarm|startled|surprised|double-take|danger|chased|gasp|warning|suspicious|turbulence|wince|storm|palms|stop/,
  sad: /melanchol|tear|wistful|gaze-down|sigh|relieved|hopeful|distant/,
  dazed: /sleepy|yawn|dreamy|blissful|meditative|eyes-closed|serene|hair-giggle|wonder|gentle/,
  focused: /concentrat|focus|scan|listening|hearing|xray|heat-vision|watch|look|shading|thoughtful|alert|curious|skeptical|pointing|point/,
  playful: /smirk|sly|teasing|tongue|eye-roll|playful|smug|kiss|shh|pout|bashful|shy|hair-brush|hair-tuck/,
};
/** Full-body shots she's standing in (a front page, the title), not mid-flight. */
const STANDING = /hips|salute|stance|crossed|folded|thumbs|wave|pointing|emblem|listening|watchful|calm|clasped|behind-back|hair-brush|cape-hold|peace|laughing|surprised|wonder|palms|scanning|shading|looking-up|helping|open-arms|triumph|flex|fist-raised|fist-up$|fist-up-left|grin|smile/;
const FLYING = /fly|glide|dive|swoop|speed|climb|launch|rising|straight-up|reach-up|arms-forward|arms-ahead|fists-up|descent|hover|headwind|playful-glide|joy-left|fierce-left|fist-left|fist-right|fist-forward|open-hand|fist-rise|fist-up-rise/;

let costume = 'classic', baseMood = 'heroic';
/** 'classic' | 'croptop' | 'tube' (main.js, from the act and the zone). */
export function setPhotoCostume(c) { costume = c; }
export const photoCostume = () => costume;
/** Her mood when nothing more specific is known (main.js, from rep and intoxication). */
export function setHeroMood(m) { baseMood = m; }
export const heroMood = () => baseMood;

const names = (framing, c) => manifest?.[framing]?.[c] || [];
const url = (framing, c, n) => `assets/greenscreen/${framing}/${c}/${n}.webp`;

/**
 * A URL for a shot of her: `framing` 'full' | 'portrait' | 'face', in a mood (falls back to any shot),
 * `filter` an extra RegExp on the name (STANDING / FLYING via the `pose` option), `avoid` a URL not to
 * repeat. Null until the manifest has loaded or if there's nothing at all.
 */
export function heroPhoto(framing, mood = baseMood, { pose, avoid, c = costume } = {}) {
  if (!manifest?.[framing]?.[c]?.length) c = 'classic';
  let all = names(framing, c);
  if (pose) {
    const posed = all.filter((n) => (pose === 'standing' ? STANDING.test(n) && !FLYING.test(n) : FLYING.test(n)));
    if (posed.length) all = posed;
  }
  const re = MOODS[mood];
  let pool = re ? all.filter((n) => re.test(n)) : all;
  if (!pool.length) pool = all;
  if (!pool.length) return null;
  const urls = pool.map((n) => url(framing, c, n));
  const fresh = urls.length > 1 ? urls.filter((u) => u !== avoid) : urls;
  return fresh[(Math.random() * fresh.length) | 0];
}

const imgs = new Map(); // url → Promise<HTMLImageElement|null>
/** The image at a URL, loaded once (null if it fails). */
export function photoImage(src) {
  if (!src) return Promise.resolve(null);
  if (!imgs.has(src)) imgs.set(src, new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  }));
  return imgs.get(src);
}

/** Like photoImage(heroPhoto(…)), but gives up after `ms` (null): callers fall back to the model. */
export async function heroPhotoImage(framing, mood, opts = {}, ms = 900) {
  await Promise.race([ready, new Promise((r) => setTimeout(r, ms))]);
  const src = heroPhoto(framing, mood, opts);
  return Promise.race([photoImage(src), new Promise((r) => setTimeout(() => r(null), ms))]);
}

/** A mood read off one of her lines (null: no clear read, use her baseline). */
export function moodOfLine(text, kind = 'speech') {
  const t = String(text).toLowerCase();
  if (/haze|dizzy|spinning|woozy|so warm|floaty|sleepy|hic/.test(t)) return 'dazed';
  if (/sorry|can't|cannot|oh no|help|where am i|what happened|why|scared|no!|don't/.test(t)) return 'worried';
  if (/remember|alone|miss|lost|tired|ashamed/.test(t)) return 'sad';
  if (/haha|ha!|fun|love|yay|easy|nice|thank/.test(t)) return 'happy';
  if (/x-ray|hear|listen|look|clue|hmm|think|wonder|\?/.test(t)) return 'focused';
  if (kind === 'shout' || /!/.test(t)) return 'heroic';
  return kind === 'thought' ? 'focused' : null;
}

/** Her baseline mood from the game state: the drink first, then how the city sees her. */
export function moodOfState(rep, intox, intoxLimit) {
  if (intox >= intoxLimit) return 'dazed';
  if (intox >= 25) return 'playful';
  if (rep >= 150) return 'happy';
  if (rep >= 60) return 'heroic';
  if (rep >= 0) return 'focused';
  if (rep >= -50) return 'worried';
  return 'sad';
}
