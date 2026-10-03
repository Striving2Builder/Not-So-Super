// Painted crime-scene rooms (assets/scenes/*.webp, 2000x1200 = the 1000x600 logical stage at 2x):
// which painting a case gets, and where things are in each one. Placed by eye on the paintings.
//   floor   y where the back wall meets the floor (story dressing and tents stay below it)
//   spots   one rect [x, y, w, h] per prop of the setting, in SETTINGS[setting].props order: the
//           painted thing that prop is. A 5th/6th entry renames it to what this painting shows
//           (same prop type, so clue hosting is unchanged).
//   bait    [x, y] bottom-centre of the bait item, standing on a painted surface
//   witness [x, y, s] feet position and drawHumanoid scale (the lower right is left empty for them)
//   chalk   [x, y, wallX] clear floor spot for the case's story dressing (+ an open stretch of wall)
//   lamp    [x, y, 'r,g,b'] the painting's key light: glow, dust, the side props shade away from
//   tint    ambient colour multiplied over everything drawn on top, so it sits in the painting's light
//   fx      live touches over painted screens/lights: ['screen', x, y, w, h, hue] | ['blink', x, y, r, colour]
//           | ['spin', x, y, r] (roulette) | ['flicker', x, y, w, h, 'r,g,b'] (neon/practicals)
//   story   false = the painting already shows what happened (no code-drawn dressing)
//   fg      optional foreground strip [x, y, w, h] re-laid from the painting over the live layers
import { SETTINGS } from './sceneprops.js';

export const SCENES = {
  office: {
    floor: 395, bait: [585, 332], witness: [735, 590, 2.8], chalk: [470, 545, 520],
    lamp: [348, 262, '255,214,140'], tint: '#9aa8cc',
    fx: [['screen', 387, 252, 90, 56, 200]],
    spots: [[245, 330, 378, 168], [383, 248, 98, 82], [2, 186, 113, 272], [922, 75, 78, 375],
      [140, 26, 136, 166], [662, 128, 78, 280], [612, 384, 66, 66], [125, 215, 115, 222]],
  },
  office_2: {
    floor: 385, bait: [548, 310], witness: [740, 592, 2.8], chalk: [300, 540, 470],
    lamp: [426, 40, '255,220,150'], tint: '#b4ae96',
    fx: [['screen', 310, 225, 86, 55, 120]],
    spots: [[180, 305, 395, 148], [305, 220, 95, 85], [0, 272, 205, 195, 'Filing Cabinet', 'Drawers yanked open, files everywhere. Someone was looking for something.'], [850, 90, 132, 370],
      [28, 38, 192, 170, 'Landscape Painting', 'Pine trees and mountains, hung slightly crooked.'], [640, 130, 72, 270], [487, 400, 100, 82, 'Wastebasket', 'Knocked over in a hurry. Crumpled memos everywhere.'], [700, 348, 125, 112, 'Potted Plant', 'Knocked off its stand. Soil across the tiles.']],
  },
  apartment: {
    floor: 420, bait: [470, 356], witness: [760, 592, 2.8], chalk: [420, 535, 530],
    lamp: [637, 196, '255,206,130'], tint: '#d0b494',
    fx: [['screen', 34, 222, 98, 74, 0]],
    spots: [[195, 255, 402, 190], [0, 205, 158, 120], [866, 132, 134, 302], [343, 85, 160, 118],
      [703, 200, 135, 180], [125, 355, 90, 120], [600, 145, 82, 290], [5, 50, 240, 115]],
  },
  apartment_2: {
    floor: 430, bait: [440, 366], witness: [745, 592, 2.8], chalk: [380, 540, 300],
    lamp: [535, 205, '255,214,150'], tint: '#9c8ca8',
    fx: [['screen', 13, 263, 88, 64, 0], ['flicker', 630, 8, 270, 155, '255,80,200']],
    spots: [[205, 282, 395, 175], [0, 250, 125, 95], [838, 178, 162, 290], [393, 113, 95, 90, 'Framed Print', 'A city skyline in a cheap frame. The glass is cracked.'],
      [630, 195, 190, 165], [137, 350, 75, 100], [508, 150, 75, 185, 'Desk Lamp', 'Bent on its stand. The bulb buzzes.'], [8, 70, 225, 120]],
  },
  hotel: {
    floor: 355, bait: [712, 244], witness: [770, 590, 2.8], chalk: [400, 520, 300],
    lamp: [560, 212, '255,214,150'], tint: '#a6b0c0',
    spots: [[222, 203, 335, 225, 'Hotel Bed', 'Made with military corners. Nobody slept in it.'],
      [903, 275, 97, 160, 'Room-Service Cart', 'A silver cloche over a dinner that went cold.'],
      [0, 55, 175, 300, 'Wardrobe', 'One door hangs open. Empty hangers rattle.'],
      [645, 95, 102, 135, 'Wall Mirror', 'A smudged handprint on the glass.'],
      [150, 203, 128, 175, 'Open Suitcase', 'Half-packed. Whoever owned it left in a hurry.'],
      [768, 250, 72, 110, 'Minibar', 'Every tiny bottle is gone.'],
      [527, 185, 90, 175, 'Bedside Lamp', 'The phone beside it is off the hook.'],
      [622, 240, 148, 120, 'Dresser', 'Drawers of folded hotel towels.']],
  },
  burned: {
    floor: 395, bait: [400, 330], witness: [745, 594, 2.8], chalk: [520, 520, 300], story: false,
    lamp: [760, 110, '220,230,245'], tint: '#a0a4ac',
    spots: [[168, 238, 265, 155, 'Burnt Sofa', 'The springs show through the ash. It went up first.'],
      [838, 160, 100, 115, 'Fuse Box', 'Hanging open. The breakers were flipped.'],
      [455, 195, 152, 190, 'Charred Armchair', 'The fabric melted into the frame.'],
      [690, 0, 140, 215, 'Broken Window', 'Blown out from the inside.'],
      [648, 305, 80, 95, 'Gas Can', 'Red jerry can. Empty, and it reeks.'],
      [800, 250, 200, 195, 'Fallen Beams', 'The ceiling came down here.'],
      [235, 385, 200, 50, 'Ash Heap', 'Grey drifts on the floor. Something glints in it.'],
      [0, 58, 150, 345, 'Scorched Bookcase', 'Books burned down to their spines.']],
  },
  alley: {
    floor: 445, bait: [330, 362], witness: [770, 594, 2.8], chalk: [420, 535, 470],
    lamp: [662, 50, '255,214,140'], tint: '#a0909c',
    fx: [['flicker', 640, 20, 46, 60, '255,214,140']],
    spots: [[0, 237, 240, 210], [245, 350, 155, 100], [418, 295, 104, 152], [262, 60, 178, 232, 'Torn Poster', 'Shredded by the rain. A club flyer used to be here.'],
      [940, 0, 50, 435], [560, 85, 205, 350], [785, 282, 125, 165]],
  },
  alley_2: {
    floor: 450, bait: [440, 300], witness: [770, 594, 2.8], chalk: [380, 540, 420],
    lamp: [200, 16, '255,200,130'], tint: '#ac9888',
    spots: [[5, 255, 235, 195], [352, 298, 168, 160, 'Wooden Crates', 'Stamped "PRODUCE". They rattle like glass.'], [543, 322, 82, 135], [270, 205, 75, 130],
      [948, 0, 48, 445], [662, 163, 165, 282], [845, 340, 78, 110]],
  },
  pier: {
    floor: 425, bait: [420, 282], witness: [760, 594, 2.8], chalk: [380, 520, 300],
    lamp: [820, 125, '255,190,110'], tint: '#b09a80',
    fx: [['flicker', 800, 95, 42, 60, '255,190,110']],
    spots: [[0, 192, 250, 230, 'Shipping Container', 'Doors ajar. It smells of salt and diesel.'],
      [328, 278, 165, 142, 'Cargo Crates', 'Stencilled "MACHINE PARTS". Too light for that.'],
      [492, 288, 125, 138, 'Fish Baskets', 'Yesterday\'s catch. The ice has melted.'],
      [190, 333, 135, 100, 'Coiled Rope', 'Mooring line, freshly cut at one end.'],
      [795, 60, 60, 375, 'Lamp Post', 'The lantern hums. Someone scratched a tally into the post.'],
      [655, 200, 92, 180, 'Harbour Office Door', 'Locked. A light on inside.'],
      [890, 350, 110, 100, 'Mooring Bollard', 'Rope burns on the iron.']],
  },
  clubbar: {
    floor: 350, bait: [300, 234], witness: [760, 592, 2.8], chalk: [420, 500, 520],
    lamp: [858, 92, '255,200,150'], tint: '#a888b4',
    fx: [['flicker', 10, 20, 225, 150, '255,60,200'], ['flicker', 672, 148, 160, 18, '80,220,255']],
    spots: [[0, 0, 250, 228, 'Back Bar', 'Rows of bottles under pink neon. One label is wrong.'],
      [0, 228, 380, 125, 'Bar Counter', 'Sticky rings and a forgotten martini.'],
      [262, 155, 100, 82, 'Cash Register', 'The drawer is jammed shut.'],
      [380, 215, 305, 140, 'Velvet Booth', 'A torn cushion and a lipstick-stained glass.'],
      [668, 135, 170, 45, 'Neon Tube', 'It hums and flickers.'],
      [880, 55, 112, 282, 'Back Door', 'Steel. Locked from the inside.'],
      [680, 218, 200, 128, 'DJ Decks', 'A record still spinning down.']],
  },
  barn: {
    floor: 400, bait: [110, 262], witness: [770, 594, 2.8], chalk: [160, 515, 300],
    lamp: [490, 26, '255,214,140'], tint: '#c8a888',
    spots: [[0, 258, 230, 180], [588, 212, 265, 240], [252, 448, 365, 92], [235, 312, 190, 125],
      [888, 288, 112, 165], [785, 45, 215, 205], [402, 0, 192, 232]],
  },
  casino: {
    floor: 360, bait: [870, 262], witness: [690, 594, 2.8], chalk: [420, 520, 520],
    lamp: [500, 40, '255,206,130'], tint: '#c4a090',
    fx: [['spin', 430, 312, 30], ['blink', 50, 140, 30, '255,60,60'], ['blink', 148, 150, 30, '80,140,255'], ['screen', 900, 34, 70, 60, 0]],
    spots: [[262, 278, 315, 140], [0, 115, 102, 275], [100, 128, 105, 250], [722, 190, 278, 270],
      [245, 40, 140, 225], [885, 22, 115, 110], [565, 105, 162, 175]],
  },
  factory: {
    floor: 405, bait: [580, 275], witness: [770, 594, 2.8], chalk: [380, 540, 500],
    lamp: [620, 20, '255,232,190'], tint: '#a8acb0',
    fx: [['blink', 30, 130, 14, '255,60,40']],
    spots: [[0, 55, 175, 360], [350, 322, 160, 98], [533, 270, 95, 132], [822, 145, 178, 255],
      [192, 137, 152, 140], [650, 112, 172, 290], [205, 308, 128, 105]],
  },
};

/** Which paintings fit a case. Some cases have a room of their own; otherwise the setting's. */
const BY_CASE = { arson: ['burned'], missing: ['apartment', 'apartment_2', 'hotel'], spiked: ['clubbar'], smuggle: ['pier', 'alley', 'alley_2'] };
const BY_SETTING = { office: ['office', 'office_2'], apartment: ['apartment', 'apartment_2'], alley: ['alley', 'alley_2'], barn: ['barn'], casino: ['casino'], factory: ['factory'] };

/** Pick a painting for this case (random among the variants that fit), or null for the code painter. */
export function pickScene(setting, caseId, force) {
  if (force && SCENES[force]) return force;
  const list = (BY_CASE[caseId] || BY_SETTING[setting] || []).filter((k) => SCENES[k] && SCENES[k].spots.length === (SETTINGS[setting] || { props: [] }).props.length);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

// ------------------------------------------------------------------ loading (one painting at a time)

let cur = null; // { key, img, ok, edges }
/** Start loading a painting; resolves with it (or null on failure). Only the one in use is kept. */
export function loadScene(key) {
  if (cur && cur.key === key) return cur.p;
  const img = new Image();
  const rec = { key, img, ok: false, edges: null };
  img.decoding = 'async';
  rec.p = new Promise((res) => {
    img.onload = () => { const done = () => { rec.ok = true; res(rec); }; img.decode ? img.decode().then(done, done) : done(); };
    img.onerror = () => res(null);
  });
  img.src = `assets/scenes/${key}.webp`;
  cur = rec;
  return rec.p;
}
/** The loaded painting for key, or null while it loads / if it failed. */
export function sceneImage(key) { return cur && cur.key === key && cur.ok ? cur : null; }
/** Leaving the scene: let the painting (and its derived edge map) go. */
export function dropScene() { if (cur) { cur.img.onload = cur.img.onerror = null; cur.img.src = ''; } cur = null; }

/** Detective vision's edge map of the painting (cyan lines on transparent), computed once at
 *  half the logical size and cached with the painting. */
export function sceneEdges(rec) {
  if (rec.edges) return rec.edges;
  const w = 500, h = 300;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  // soften first (down to a third and back up) so texture (hay, grit, wood grain) doesn't read as edges
  const s = document.createElement('canvas'); s.width = w / 3 | 0; s.height = h / 3 | 0;
  s.getContext('2d').drawImage(rec.img, 0, 0, s.width, s.height);
  g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, w, h);
  const src = g.getImageData(0, 0, w, h), d = src.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  const out = g.createImageData(w, h), o = out.data;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
    const gy = lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
    const m = Math.min(255, Math.max(0, Math.hypot(gx, gy) - 22) * 3);
    if (m > 0) { o[i * 4] = 140; o[i * 4 + 1] = 240; o[i * 4 + 2] = 255; o[i * 4 + 3] = m; }
  }
  g.putImageData(out, 0, 0);
  rec.edges = c;
  return c;
}
