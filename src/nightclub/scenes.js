// Close-up investigation scenes in the detective nightclubs: per room kind, the user's render and
// WHERE its objects are (x, y, r as fractions of the image's width/height). WHAT an object means is
// the case's business (src/nightclub/cases/*.js: clue text, items, drinks), so another case
// (e.g. blackmail) reuses the same rooms and objects with its own story.

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
