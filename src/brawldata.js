// Street-fight tunables: enemy stats, hit geometry, sprite scale, breakable sizes.
export const EN = {
  thug:     { hp: 30, spd: 120, dmg: 7, reach: 70, name: 'THUG' },
  knife:    { hp: 24, spd: 165, dmg: 9, reach: 64, name: 'SLASHER' },
  brute:    { hp: 75, spd: 85, dmg: 14, reach: 86, name: 'BRUTE' },
  gunman:   { hp: 26, spd: 110, dmg: 12, reach: 60, ranged: true, name: 'DIRTY COP' },
  arsonist: { hp: 26, spd: 125, dmg: 8, reach: 66, name: 'FIREBUG' },
  boss:     { hp: 260, spd: 115, dmg: 16, reach: 96, boss: true, name: 'BOSS' },
};
export const DZ = 0.11;  // depth tolerance for hits
export const M = 54;     // world units per metre (sprites are authored in metres)
export const HERO_SCALE = 1.12; // the star reads a head taller than the crooks
export const CROOK_SCALE = 0.95;
export const BREAK = { can: { w: 34, h: 50 }, crate: { w: 44, h: 44 }, barrel: { w: 36, h: 52 }, newsbox: { w: 30, h: 46 } };
