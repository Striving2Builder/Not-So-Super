// City feed: short clips of the heroine (videos or stills) that play in the minimap corner. The
// corner grows into a 16:9 panel while a clip plays (the map shrinks to an inset), then settles back.
//   entering a district → a clip from the "flying" folder
//   the Red Light district → a clip from the "rld" folder (and more while she stays)
//   intoxicated (the bar is in the warning range) → a clip from the "intox" folder
//   perching on a roof  → a clip from the "rooftop" folder
//   other hot districts (Entertainment) → flying clips keep coming while she's there
// Flying-in clips play once; the others loop until CITY_FEED.clipMax.
// Clips are listed in assets/video/manifest.json (tools/build_video_manifest.js); what plays where
// is tuned in CITY_FEED (data.js). With no clips on disk it simply never shows.
import { CITY_FEED } from './data.js';
import { INTOX_LIMIT } from './state.js';
import { settings } from './settings.js';
import { rand, shuffle, $ } from './util.js';
import { mediaFolders, isImage as imageUrl, keepLooping } from './media.js';

export class CityFeed {
  constructor() {
    this.box = $('mapbox');
    this.panel = $('feed');
    this.video = this.panel && this.panel.querySelector('video');
    this.img = this.panel && this.panel.querySelector('img');
    this.label = this.panel && this.panel.querySelector('.feed-where');
    this.lists = {};   // category → clip URLs
    this.bags = {};    // category → shuffled clips not yet played (no repeats until all have shown)
    this.playing = null;
    this.last = -1e9;  // time the last clip started (seconds, on this.t)
    this.hotGap = CITY_FEED.hotGap[0];
    this.t = 0;
    this.load();
    if (!this.panel) return;
    // tap the clip: sound on/off (a tap is the gesture iOS needs to unmute); the ✕ closes it
    this.snd = document.createElement('span'); this.snd.className = 'feed-snd';
    this.panel.querySelector('.feed-cap')?.appendChild(this.snd);
    try { this.soundOn = localStorage.getItem('feedSound') === '1'; } catch (e) { this.soundOn = false; }
    this.showSound();
    this.panel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.feed-x') || !this.playing || !this.playing.video) { this.stop(); return; }
      this.soundOn = this.video.muted; // muted → turn it on, and the other way round
      this.video.muted = !this.soundOn;
      try { localStorage.setItem('feedSound', this.soundOn ? '1' : '0'); } catch (err) { /* private mode */ }
      this.showSound();
    });
    this.video.addEventListener('ended', () => this.stop());
    this.video.addEventListener('error', () => this.drop());
    this.img.addEventListener('error', () => this.drop());
  }

  load() {
    mediaFolders().then((folders) => {
      for (const [cat, folder] of Object.entries(CITY_FEED.folders)) this.lists[cat] = folders[folder] || [];
    });
  }

  get enabled() { return settings.cityFeed && !!this.panel; }

  /** Which clip set this moment uses. Red Light wins over intoxication; both win over flying. */
  clipCat(intox) {
    if (this.district === CITY_FEED.rld) return 'rld';
    if (intox >= INTOX_LIMIT) return 'intox';
    return 'flying';
  }

  /** She flew into a new district. */
  onDistrict(key, name, intox = 0) {
    this.district = key;
    const cat = this.clipCat(intox);
    const hot = cat !== 'flying' || CITY_FEED.hot.includes(key);
    if (hot || this.t - this.last > CITY_FEED.cooldown) this.play(cat, name, hot);
  }

  /** She landed on a rooftop. */
  onPerch(name) {
    if (this.t - this.last > CITY_FEED.perchCooldown) this.play('rooftop', name ? `Rooftops · ${name}` : 'Rooftops');
  }

  update(dt, districtName, intox = 0) {
    this.t += dt;
    if (this.playing) {
      if (this.playing.video && this.t - (this.kickT || 0) > 0.6) { this.kickT = this.t; keepLooping(this.video); } // resume after a pause; a loop that hangs on its last frame wraps
      if (this.t - this.playing.start > (this.playing.video ? CITY_FEED.clipMax : CITY_FEED.imageSecs)) this.stop();
      return;
    }
    // Red Light, intoxication, and other hot districts: more clips for as long as that lasts
    const cat = this.clipCat(intox);
    if ((cat !== 'flying' || CITY_FEED.hot.includes(this.district)) && this.t - this.last > this.hotGap) this.play(cat, districtName, true);
  }

  /** Game paused (dialog, map): freeze the clip. */
  pause() { if (this.playing && this.playing.video) this.video.pause(); }

  play(cat, where, hot = false) {
    if (!this.enabled || this.playing) return false;
    const url = this.next(cat);
    if (!url) return false;
    const isImage = imageUrl(url);
    this.playing = { url, start: this.t, video: !isImage };
    this.last = this.t;
    this.hotGap = rand(...CITY_FEED.hotGap);
    this.label.textContent = where || '';
    this.panel.classList.toggle('hot', hot);
    this.panel.classList.toggle('still', isImage);
    if (isImage) { this.img.src = url; this.video.removeAttribute('src'); }
    else {
      this.img.removeAttribute('src');
      // with sound if the player turned it on (iOS may refuse outside a tap: then muted, badge says so)
      this.video.muted = !this.soundOn;
      this.video.loop = cat !== 'flying'; // flying in plays once; the rest loop until clipMax
      this.video.src = url;
      this.video.play().catch(() => { this.video.muted = true; this.video.play().catch(() => {}); }).finally(() => this.showSound());
    }
    this.box.classList.add('feed-on');
    return true;
  }

  showSound() { if (this.snd) this.snd.textContent = this.video && !this.video.muted ? '🔊' : '🔇 TAP FOR SOUND'; }

  stop() {
    if (!this.playing) return;
    this.playing = null;
    this.box.classList.remove('feed-on');
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load(); // release the decoder
  }

  /** A clip failed to load: forget it and close. */
  drop() {
    if (!this.playing) return;
    const bad = this.playing.url;
    for (const k in this.lists) this.lists[k] = this.lists[k].filter((u) => u !== bad);
    this.stop();
  }

  next(cat) {
    const all = this.lists[cat] || [];
    if (!all.length) return null;
    if (!this.bags[cat] || !this.bags[cat].length) this.bags[cat] = shuffle([...all]);
    return this.bags[cat].pop();
  }
}
