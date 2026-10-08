// Close-up investigation scenes in the detective nightclubs: per room kind, the user's render and
// WHERE its objects are (x, y, r as fractions of the image's width/height). WHAT an object means is
// the case's business (src/nightclub/cases/*.js: clue text, items, drinks), so another case
// (e.g. blackmail) reuses the same rooms and objects with its own story.

export const CLOSEUP_RAIL = 96; // px down the right edge for BACK / CASE / CAMERA (style.css body.closeup-on #btns)
const CLOSEUP_TOP = 40;         // the "THE BAR · 2/6 SEARCHED" label

/** Where a close-up sits: as big as the screen allows. The picture covers the screen (cropping
 *  what it must), slid so every spot stays clear of the label and of the button column on the
 *  right; it only shrinks below cover when the spots wouldn't fit otherwise (a 4:3 iPad). The
 *  joystick is hidden for the search (it covered the left of the picture). */
export function closeupFrame(w, h, iw = 1280, ih = 720, spots = []) {
  // the spots' extent in image fractions (r is in units of the image height, as the hit test has it)
  let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
  if (spots.length) {
    u0 = Math.min(...spots.map((s) => s.x - s.r * ih / iw)); u1 = Math.max(...spots.map((s) => s.x + s.r * ih / iw));
    v0 = Math.min(...spots.map((s) => s.y - s.r)); v1 = Math.max(...spots.map((s) => s.y + s.r));
  }
  const sw = Math.max(80, w - CLOSEUP_RAIL), sh = Math.max(80, h - CLOSEUP_TOP);
  const s = Math.min(Math.max(w / iw, h / ih), sw / ((u1 - u0) * iw), sh / ((v1 - v0) * ih));
  const dw = iw * s, dh = ih * s;
  // start centred (crop the top rather than the counter), keep the screen covered, then the spots in view
  const place = (pref, d, size, lo, hi, a, b) => {
    let p = d >= size ? Math.min(0, Math.max(size - d, pref)) : pref;
    return Math.min(b - hi * d, Math.max(a - lo * d, p));
  };
  return {
    x: place((w - dw) / 2, dw, w, u0, u1, 0, sw),
    y: place(dh >= h ? (h - dh) * 0.8 : (h - dh) / 2, dh, h, v0, v1, CLOSEUP_TOP, h),
    w: dw, h: dh,
  };
}

export const CLOSEUPS = {
  bar: {
    src: 'closeup_bar.jpg', title: 'The bar',
    spots: [
      { id: 'glass', x: 0.133, y: 0.6, r: 0.085 }, { id: 'napkin', x: 0.26, y: 0.76, r: 0.09 },
      { id: 'pills', x: 0.42, y: 0.83, r: 0.07 }, { id: 'coaster', x: 0.52, y: 0.86, r: 0.055 },
      { id: 'phone', x: 0.69, y: 0.78, r: 0.1 }, { id: 'jar', x: 0.89, y: 0.58, r: 0.09 },
    ],
  },
  entrance: {
    src: 'closeup_coatcheck.jpg', title: 'The coat check',
    spots: [
      { id: 'tickets', x: 0.13, y: 0.18, r: 0.09 }, { id: 'jacket', x: 0.34, y: 0.42, r: 0.14 },
      { id: 'list', x: 0.72, y: 0.34, r: 0.12 }, { id: 'mints', x: 0.86, y: 0.71, r: 0.08 },
      { id: 'band', x: 0.78, y: 0.9, r: 0.08 },
    ],
  },
  main: {
    src: 'closeup_dj.jpg', title: 'The DJ booth',
    spots: [
      { id: 'phone', x: 0.49, y: 0.28, r: 0.07 }, { id: 'setlist', x: 0.68, y: 0.29, r: 0.08 },
      { id: 'vial', x: 0.78, y: 0.35, r: 0.05 }, { id: 'mixer', x: 0.39, y: 0.66, r: 0.1 },
      { id: 'headphones', x: 0.89, y: 0.4, r: 0.07 },
    ],
  },
  vip: {
    src: 'closeup_vip.jpg', title: 'The VIP table',
    spots: [
      { id: 'tray', x: 0.37, y: 0.58, r: 0.12 }, { id: 'glass', x: 0.56, y: 0.21, r: 0.06 },
      { id: 'card', x: 0.67, y: 0.71, r: 0.07 }, { id: 'watch', x: 0.87, y: 0.64, r: 0.06 },
      { id: 'matches', x: 0.83, y: 0.27, r: 0.05 }, { id: 'bucket', x: 0.14, y: 0.23, r: 0.1 },
    ],
  },
  restroom: {
    src: 'closeup_restroom.jpg', title: 'The restroom',
    spots: [
      { id: 'mirror', x: 0.33, y: 0.26, r: 0.12 }, { id: 'pills', x: 0.75, y: 0.56, r: 0.07 },
      { id: 'towels', x: 0.86, y: 0.39, r: 0.07 }, { id: 'receipt', x: 0.56, y: 0.73, r: 0.07 },
      { id: 'soap', x: 0.29, y: 0.52, r: 0.05 },
    ],
  },
  office: {
    src: 'closeup_office.jpg', title: 'The back office',
    spots: [
      { id: 'ledger', x: 0.235, y: 0.67, r: 0.14 }, { id: 'cash', x: 0.55, y: 0.59, r: 0.07 },
      { id: 'phone', x: 0.74, y: 0.63, r: 0.06 }, { id: 'key', x: 0.79, y: 0.85, r: 0.06 },
      { id: 'photo', x: 0.57, y: 0.24, r: 0.07 }, { id: 'monitor', x: 0.83, y: 0.28, r: 0.09 },
    ],
  },
};
