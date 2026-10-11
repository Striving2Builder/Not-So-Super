// Every clip in a folder plays for the activity that folder belongs to. The lists fill in from
// assets/video/manifest.json (same array objects, so a case that already holds CLIPS.shame sees
// the files arrive). Drop a new file in the folder and rebuild the manifest; it joins the rotation.
import { mediaFolders, isImage } from '../media.js';

const ROLES = {
  captive: 'SG_Captured_Game', // held: struggles, the leaked-footage billboard, the capture rooms
  shame: 'SG_Humiliation_Game', // on show: story-club screens, the hotel stage, a deal
  press: 'SG_Captured_Game', // the same captured set: paparazzi screens and the hotel film
  high: 'SG_Intox_Game', // high: the Hive's screens and the club LIVE feed
};

export const CLIPS = { captive: [], shame: [], press: [], high: [] };

const joined = new Map();
let loaded = false;

function fill(arr, urls) {
  const next = urls.filter((u) => !isImage(u));
  if (arr.length === next.length && arr.every((u, i) => u === next[i])) return;
  arr.splice(0, arr.length, ...next);
}

function fillJoined() {
  for (const [key, arr] of joined) {
    const seen = new Set(), urls = [];
    for (const role of key.split('+')) for (const u of CLIPS[role] || []) if (!seen.has(u)) { seen.add(u); urls.push(u); }
    fill(arr, urls);
  }
}

/** One array of every clip in those roles, filled when the manifest arrives (and deduped). */
export function joinClips(...roles) {
  const key = roles.join('+');
  let arr = joined.get(key);
  if (!arr) { arr = []; joined.set(key, arr); }
  if (loaded) fillJoined();
  return arr;
}

export const clipsReady = mediaFolders().then((all) => {
  for (const [role, folder] of Object.entries(ROLES)) fill(CLIPS[role], all[folder] || []);
  loaded = true;
  fillJoined();
});

/** Per clip list: the next one each time (so a struggle never replays the last one). */
const turn = {};
export function nextClip(list) {
  if (!list || !list.length) return null;
  const k = list[0];
  turn[k] = ((turn[k] ?? Math.floor(Math.random() * list.length)) + 1) % list.length;
  return list[turn[k]];
}
