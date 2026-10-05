// Close-up investigation scenes in the detective nightclubs (the investigation rooms' tap-the-spot
// play on the user's renders): per room kind, an image and its spots (x, y, r as fractions of the
// image's width/height). A spot can hand over an item (`item`, e.g. a key the layout also uses) or be
// the Super Squirt drink (`drink`). Clue text is the first case's (docs/design/nightclub.md "Cases").

export const CLOSEUPS = {
  bar: {
    src: 'closeup_bar.jpg', title: 'The bar',
    spots: [
      { id: 'glass', x: 0.133, y: 0.6, r: 0.085, drink: true,
        text: 'A glowing green drink nobody ordered. It fizzes when you lean in. The bartender calls it the house special: <b>Super Squirt</b>.' },
      { id: 'napkin', x: 0.26, y: 0.76, r: 0.09,
        text: 'A napkin covered in scrawl. Under the smudges: <b>"2 AM. Back room. Ask for Moe."</b>' },
      { id: 'pills', x: 0.42, y: 0.83, r: 0.07,
        text: 'Rainbow-speckled pills in a zip bag: the same glitter as the Super Squirt shots. Someone is cutting it here.' },
      { id: 'coaster', x: 0.52, y: 0.86, r: 0.055, item: 'VIP wristband',
        text: 'Something stiff under the coaster: a <b>VIP wristband</b>, left for whoever knows where to look.' },
      { id: 'phone', x: 0.69, y: 0.78, r: 0.1,
        text: 'A face-down phone, still buzzing. Lock screen: <b>"Shipment lands Thursday. Usual drop. — K"</b>' },
      { id: 'jar', x: 0.89, y: 0.58, r: 0.09,
        text: 'The tip jar is stuffed with fifties. Far too much for a bar this quiet. Somebody is paying for silence.' },
    ],
  },
};
