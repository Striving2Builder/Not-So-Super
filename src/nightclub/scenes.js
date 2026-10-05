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
  entrance: {
    src: 'closeup_coatcheck.jpg', title: 'The coat check',
    spots: [
      { id: 'tickets', x: 0.13, y: 0.18, r: 0.09, text: 'Claim tickets. One number is circled in green ink: <b>#13</b>. Nobody has collected it.' },
      { id: 'jacket', x: 0.34, y: 0.42, r: 0.14, text: 'Ticket #13\'s leather jacket. Something heavy in the pocket: a roll of cash and a card that says only <b>"K — Pier 9"</b>.' },
      { id: 'list', x: 0.72, y: 0.34, r: 0.12, text: 'The guest list. Half the names are crossed out. One isn\'t crossed out but underlined twice: <b>"Moe — all night, all rooms."</b>' },
      { id: 'mints', x: 0.86, y: 0.71, r: 0.08, text: 'A bowl of mints. A few are green and glitter under the light: Super Squirt, pressed to look like candy.' },
      { id: 'band', x: 0.78, y: 0.9, r: 0.08, item: 'VIP wristband', text: 'A spare <b>VIP wristband</b>, left on the counter. Nobody will miss it.' },
    ],
  },
  main: {
    src: 'closeup_dj.jpg', title: 'The DJ booth',
    spots: [
      { id: 'phone', x: 0.49, y: 0.28, r: 0.07, text: 'The DJ\'s phone, propped on the mixer: a map pin on the docks. <b>Pier 9.</b>' },
      { id: 'setlist', x: 0.68, y: 0.29, r: 0.08, text: 'The set list. One track circled in red: <b>"Shadow Walk"</b>. The DJ plays it every night at 2 AM, right before the back room opens.' },
      { id: 'vial', x: 0.78, y: 0.35, r: 0.05, drink: true, text: 'A tiny glowing green vial tucked behind the mixer. Pure <b>Super Squirt</b>, uncut.' },
      { id: 'mixer', x: 0.39, y: 0.66, r: 0.1, text: 'The mixer\'s faders are sticky with green residue. Whoever runs this booth handles the product.' },
      { id: 'headphones', x: 0.89, y: 0.4, r: 0.07, text: 'Headphones with a name scratched into the band: <b>"MOE"</b>.' },
    ],
  },
  vip: {
    src: 'closeup_vip.jpg', title: 'The VIP table',
    spots: [
      { id: 'tray', x: 0.37, y: 0.58, r: 0.12, text: 'A silver tray dusted with glittering green powder. Super Squirt before it\'s mixed into the shots.' },
      { id: 'glass', x: 0.56, y: 0.21, r: 0.06, text: 'A glass with a lipstick print. Someone left in a hurry when the doors opened.' },
      { id: 'card', x: 0.67, y: 0.71, r: 0.07, text: 'A business card with a tall ship: <b>Kraken Shipping, Pier 9</b>. "K" again.' },
      { id: 'watch', x: 0.87, y: 0.64, r: 0.06, text: 'An expensive watch, stopped at 2:00. Engraved on the back: <b>"To Moe, from K."</b>' },
      { id: 'matches', x: 0.83, y: 0.27, r: 0.05, text: 'A matchbook from the Bayside Motel. Room 9 is written inside the cover.' },
      { id: 'bucket', x: 0.14, y: 0.23, r: 0.1, text: 'The champagne is real. The money behind it isn\'t. This table runs on Super Squirt.' },
    ],
  },
  restroom: {
    src: 'closeup_restroom.jpg', title: 'The restroom',
    spots: [
      { id: 'mirror', x: 0.33, y: 0.26, r: 0.12, text: 'A number in lipstick on the cracked mirror, half wiped off. A phone number, or a pier.' },
      { id: 'pills', x: 0.75, y: 0.56, r: 0.07, text: 'A zip bag of glowing green pills stuck behind the towel holder. This is the drop point.' },
      { id: 'towels', x: 0.86, y: 0.39, r: 0.07, text: 'The towel holder\'s cover is loose. A hollow space behind it, just the size of a bag.' },
      { id: 'receipt', x: 0.56, y: 0.73, r: 0.07, text: 'A crumpled receipt: forty shots of the "house special", paid in cash, 1:58 AM.' },
      { id: 'soap', x: 0.29, y: 0.52, r: 0.05, text: 'The soap smells faintly of something sweet and chemical. Someone washed their hands of green powder here.' },
    ],
  },
  office: {
    src: 'closeup_office.jpg', title: 'The back office',
    spots: [
      { id: 'ledger', x: 0.235, y: 0.67, r: 0.14, text: 'The ledger: two sets of numbers. Drinks on the left, and on the right a column headed <b>"SS"</b>, ten times bigger.' },
      { id: 'cash', x: 0.55, y: 0.59, r: 0.07, text: 'A brick of cash with a band marked <b>"K — Thursday"</b>.' },
      { id: 'phone', x: 0.74, y: 0.63, r: 0.06, text: 'A burner phone. One contact: <b>K</b>. Last message: "Usual drop. Don\'t be late again, Moe."' },
      { id: 'key', x: 0.79, y: 0.85, r: 0.06, item: 'cellar key', text: 'A key on a red tag: <b>CELLAR</b>. You take it.' },
      { id: 'photo', x: 0.57, y: 0.24, r: 0.07, text: 'A framed photo of the pier at night. Pier 9.' },
      { id: 'monitor', x: 0.83, y: 0.28, r: 0.09, text: 'The security feed shows the back hallway. The 2 AM recording has been erased.' },
    ],
  },
};
