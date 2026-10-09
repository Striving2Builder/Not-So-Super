// The clips the three story clubs (The Hive, The Gilded Cage, Flashpoint) are allowed to play, by
// file. Each one checked frame by frame at full size, start to end: she stays in costume and
// nothing is sexual. The rest of SG_Humiliation_Game / SG_Captured_Game / SG_Intox_Game is NOT
// played here (stripping, groping, the costume pulled down, crotch-framed shots, sexual captions):
// keep a new clip out of these lists until someone has looked through all of it.
const at = (folder, names) => names.map((n) => `assets/video/${folder}/${n}.mp4`);

export const CLIPS = {
  // caught and held: the goo tank against the clock, the cage over the laser floor, the glass box on the club floor
  captive: at('SG_Captured_Game', ['SG_Captured28', 'SG_Captured40', 'SG_Captured61']),
  // on show: the Joker parading her through the lobby crowd, gagged and crying
  shame: at('SG_Humiliation_Game', ['SG_Humiliation43', 'SG_Humiliation45', 'SG_Humiliation97']),
  // the paparazzi on the street, the crowd's laser floor (she holds her head)
  press: at('SG_Captured_Game', ['SG_Captured43', 'SG_Captured62']),
  // high: slumped in a booth, staggering to the exit, the powder table, the dizzy selfie
  high: at('SG_Intox_Game', ['SG_Intox1', 'SG_Intox9', 'SG_Intox59', 'Supergirl_NCVL_41']),
};

/** Per clip list: the next one each time (so a struggle never replays the last one). */
const turn = {};
export function nextClip(list) {
  if (!list || !list.length) return null;
  const k = list[0];
  turn[k] = ((turn[k] ?? Math.floor(Math.random() * list.length)) + 1) % list.length;
  return list[turn[k]];
}
