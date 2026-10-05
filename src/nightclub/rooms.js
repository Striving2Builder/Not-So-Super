// Room kinds for the detective nightclubs (docs/design/nightclub.md). World units are plate pixels:
// every walk plate is 1024 px tall with the floor line at 80% (PLATE.floor), so a room is as wide
// as its plate (small 2048, medium 3072, big 4096). The user's art drops into PLATE.dir; until it
// does, stage.js paints a placeholder from the room's `look`.

export const PLATE = { h: 1024, floor: 820, dir: 'assets/nightclub/plates/' };

/**
 * w: walk width; floor: where it may sit (-1 basement, 0 street level, 1 upstairs);
 * crowd: silhouettes per 1000 px (0 = empty); light: the room's live rig
 * (beams = moving heads + lasers, strobe = darkness + flashes, warm = bar/lounge glow, dim = staff);
 * lock: the item that opens it (null = open); sign: the word over its doorway.
 */
export const ROOMS = {
  entrance: { name: 'Entrance', w: 2048, floor: [0], crowd: 3, light: 'warm', sign: 'EXIT', look: { haze: '#3a2a5c', wall: '#140f22', accent: '#ff3fb8' } },
  main:     { name: 'Main Floor', w: 4096, floor: [0], crowd: 9, light: 'beams', sign: 'DANCE', look: { haze: '#2c5d9c', wall: '#0b1430', accent: '#27e0ff' } },
  dark:     { name: 'Dark Room', w: 3072, floor: [0, -1], crowd: 7, light: 'strobe', sign: 'DARK', look: { haze: '#1a1430', wall: '#05040a', accent: '#b04dff' } },
  bar:      { name: 'Bar', w: 3072, floor: [0, 1], crowd: 4, light: 'warm', sign: 'BAR', look: { haze: '#5c3a2a', wall: '#1a0f0c', accent: '#ffb347' } },
  lounge:   { name: 'Lounge', w: 3072, floor: [0, 1], crowd: 3, light: 'warm', sign: 'LOUNGE', look: { haze: '#4a2a4c', wall: '#160c18', accent: '#ff5fd0' } },
  balcony:  { name: 'VIP Balcony', w: 3072, floor: [1], crowd: 2, light: 'beams', sign: 'VIP', look: { haze: '#2a3a6c', wall: '#0c1024', accent: '#ffd84d' } },
  vip:      { name: 'VIP Room', w: 2048, floor: [1], crowd: 2, light: 'warm', sign: 'VIP', lock: 'VIP wristband', look: { haze: '#5c2a3a', wall: '#1a0810', accent: '#ffd84d' } },
  restroom: { name: 'Restrooms', w: 2048, floor: [0, 1, -1], crowd: 1, light: 'dim', sign: 'WC', look: { haze: '#2a4a4c', wall: '#0c1618', accent: '#7fffd4' } },
  corridor: { name: 'Corridor', w: 3072, floor: [0, 1, -1], crowd: 1, light: 'dim', sign: 'STAIRS', connector: true, look: { haze: '#2a2a3c', wall: '#0c0c14', accent: '#9fb8ff' } },
  office:   { name: 'Back Office', w: 2048, floor: [1, 0], crowd: 0, light: 'dim', sign: 'STAFF', lock: 'staff keycard', look: { haze: '#3a3a2a', wall: '#14140c', accent: '#fff2a0' } },
  storage:  { name: 'Storage', w: 2048, floor: [-1], crowd: 0, light: 'dim', sign: 'STOCK', lock: 'cellar key', look: { haze: '#2a3a2a', wall: '#0a100a', accent: '#a0ff9f' } },
  alley:    { name: 'Alley Exit', w: 2048, floor: [0], crowd: 1, light: 'dim', sign: 'ALLEY', look: { haze: '#1f2f3f', wall: '#080c10', accent: '#ff6b5a' } },
};

/**
 * The user's art, wired in as it arrives (assets/nightclub/incoming → processed into PLATE.dir).
 * plates: room kind → walk plate image (replaces the painted placeholder; same 1024 px height and
 * floor line); setPiece: room kind → set-piece loop video (the DJ booth view); dancers: clip urls.
 */
export const ART = { plates: {}, setPiece: {}, dancers: [] };

/** Which rooms a room kind may hang off (the generator walks these when it grows a club). */
export const ATTACH = {
  main: ['entrance'],
  bar: ['main', 'lounge', 'balcony'],
  lounge: ['main', 'bar', 'balcony'],
  dark: ['main', 'corridor'],
  balcony: ['corridor', 'main'],
  vip: ['balcony', 'lounge'],
  restroom: ['main', 'corridor', 'bar', 'lounge'],
  corridor: ['main', 'bar', 'lounge'],
  office: ['corridor', 'bar'],
  storage: ['corridor'],
  alley: ['corridor', 'main', 'storage'],
};

/** The flagship club: a fixed, hand-made graph (the main floor is its set piece). */
export const FLAGSHIP = {
  name: 'Club Nova',
  rooms: ['entrance', 'main', 'bar', 'lounge', 'dark', 'corridor', 'balcony', 'vip', 'restroom', 'office'],
  links: [['entrance', 'main'], ['main', 'bar'], ['main', 'dark'], ['main', 'corridor'], ['bar', 'lounge'],
    ['corridor', 'balcony'], ['balcony', 'vip'], ['corridor', 'restroom'], ['corridor', 'office'], ['lounge', 'restroom']],
};

/** Generated clubs: how many rooms beyond the core, by size. */
export const CLUB_SIZE = { small: [6, 7], medium: [8, 10], large: [11, 14] };
