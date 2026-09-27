// All tunable game content lives here.

export const HERO = 'Supergirl';
export const PAPER = 'The Metro Gazette';
export const TABLOID = 'THE DAILY SCOOP';

/**
 * City districts. `style` picks the block generator in city.js, `vice` districts raise
 * tabloid heat while you linger, `venue` is the special (3D) zone found there.
 */
export const DISTRICTS = {
  downtown:      { name: 'Downtown',        map: '#9aa0ad', lot: '#5a606c', pal: ['#8a93a6', '#a7aebd', '#6f7889', '#b8a98f', '#7d8aa0'], hMin: 70, hMax: 210, style: 'mixed', venue: 'Penthouse' },
  financial:     { name: 'Financial',       map: '#5f8ed0', lot: '#4b5467', pal: ['#86a8d2', '#6386b3', '#a3bedf', '#4f6a8f', '#9fb3c8'], hMin: 150, hMax: 340, style: 'towers', glass: true, venue: 'Penthouse' },
  retail:        { name: 'Retail',          map: '#e8a45a', lot: '#6d6b64', pal: ['#d9825b', '#e0b25a', '#6fb3a6', '#c96b8a', '#8aa0d6', '#e07a5a'], hMin: 22, hMax: 60, style: 'shops' },
  residential:   { name: 'Residential',     map: '#c07b5e', lot: '#5d6857', pal: ['#a4553f', '#b8704f', '#8d5a45', '#c9a27e', '#9a8c7a'], hMin: 40, hMax: 120, style: 'apartments' },
  entertainment: { name: 'Entertainment',   map: '#a86fe6', lot: '#4d4460', pal: ['#8e5ab5', '#c24f7a', '#e0a042', '#4e7fc4'], hMin: 40, hMax: 130, style: 'venues', neon: ['#ffcc33', '#33ddff', '#ff55aa'] },
  nightclub:     { name: 'Nightclub',       map: '#6c3fd0', lot: '#231d33', pal: ['#2c2440', '#3a2c55', '#1f1b2e', '#35284d'], hMin: 30, hMax: 90, style: 'clubs', neon: ['#ff2fd0', '#27e0ff', '#9d4dff'], vice: true, venue: 'Nightclub' },
  casino:        { name: 'Casino',          map: '#ecc84a', lot: '#3b2f1c', pal: ['#c9a13b', '#a8812a', '#e0c068', '#7a1f2b'], hMin: 60, hMax: 200, style: 'casino', neon: ['#ffd84d', '#ff4d4d', '#ffffff'], venue: 'High-Roller Suite' },
  warehouse:     { name: 'Warehouse',       map: '#8f8270', lot: '#4f4b45', pal: ['#7b6d5c', '#6a6259', '#8a7f70', '#5a5f66'], hMin: 28, hMax: 52, style: 'warehouses', vice: true, venue: 'Warehouse' },
  docks:         { name: 'Docks',           map: '#3f9ab4', lot: '#4a4d52', pal: ['#b8452f', '#2f6fb8', '#d9a53a', '#3a8a5a', '#8a3ab8', '#c46a2a'], hMin: 14, hMax: 30, style: 'docks', venue: 'Warehouse' },
  factory:       { name: 'Factory',         map: '#7d7262', lot: '#51504a', pal: ['#6d6a60', '#807765', '#5b6260', '#8b5a3c'], hMin: 40, hMax: 80, style: 'factory' },
  suburb:        { name: 'Suburb',          map: '#8fd07a', lot: '#5f8a4a', pal: ['#e8dcc0', '#c9d6e3', '#e3c9c9', '#d8e3c0', '#f0e6d0'], hMin: 14, hMax: 24, style: 'houses' },
  farm:          { name: 'Farm',            map: '#cadb6a', lot: '#7a9a4a', pal: ['#a8322d', '#c9b27a', '#e8e0d0'], hMin: 12, hMax: 40, style: 'farm' },
  redlight:      { name: 'Red Light District', map: '#e8344f', lot: '#2a1418', pal: ['#3a1a22', '#4a1f2a', '#2e161c', '#41202a'], hMin: 30, hMax: 80, style: 'clubs', neon: ['#ff2244', '#ff6688', '#ffaa33'], vice: true, special: true, venue: 'Red Light Den' },
  naughty:       { name: 'Naughty Nightclub District', map: '#ff5fd0', lot: '#2a1430', pal: ['#3d1a44', '#2d1636', '#4a1e52'], hMin: 30, hMax: 90, style: 'clubs', neon: ['#ff44cc', '#cc66ff', '#ff88ee'], vice: true, special: true, venue: "Gentlemen's Club" },
  lair:          { name: "Villains' Lair",  map: '#2fdf62', lot: '#141a14', pal: ['#1d2420', '#252b27', '#101512'], hMin: 20, hMax: 60, style: 'lair', neon: ['#39ff6a', '#a0ff39'], vice: true, special: true, venue: 'Underground Lair' },
};

// Brawler zones (side-scrolling beat 'em up).
export const STREET_CRIMES = [
  { id: 'petty',    name: 'Petty Crime',     districts: '*', reward: 8, diff: 1, enemies: ['thug', 'thug', 'knife'], captives: 0, blurb: 'Punks shaking down shopkeepers.' },
  { id: 'mugging',  name: 'Mugging',         districts: ['downtown', 'residential', 'entertainment', 'retail', 'nightclub', 'redlight', 'casino'], reward: 10, diff: 1, enemies: ['thug', 'knife'], captives: 1, blurb: 'A victim cornered in an alley.' },
  { id: 'stealing', name: 'Car Thieves',     districts: ['downtown', 'retail', 'suburb', 'casino', 'financial', 'residential'], reward: 11, diff: 1, enemies: ['thug', 'knife', 'thug'], captives: 0, blurb: 'A crew is stripping cars in broad daylight.' },
  { id: 'vandal',   name: 'Vandals',         districts: ['retail', 'residential', 'entertainment', 'suburb', 'downtown'], reward: 8, diff: 1, enemies: ['thug', 'thug'], captives: 0, blurb: 'A gang is trashing the neighborhood.' },
  { id: 'robbery',  name: 'Robbery',         districts: ['retail', 'financial', 'downtown', 'casino', 'entertainment'], reward: 14, diff: 2, enemies: ['thug', 'knife', 'gunman'], captives: 1, blurb: 'Armed robbers are holding up a store.' },
  { id: 'drugs',    name: 'Drug Dealers',    districts: ['nightclub', 'warehouse', 'docks', 'redlight', 'residential', 'naughty'], reward: 14, diff: 2, enemies: ['thug', 'knife', 'brute'], captives: 0, blurb: 'Dealers are working the corner.' },
  { id: 'gang',     name: 'Gang Fight',      districts: ['warehouse', 'factory', 'docks', 'residential', 'nightclub', 'lair'], reward: 16, diff: 3, enemies: ['thug', 'knife', 'brute', 'gunman'], captives: 0, blurb: 'Two crews are about to go to war.' },
  { id: 'kidnap',   name: 'Kidnapping',      districts: ['suburb', 'residential', 'docks', 'downtown', 'warehouse'], reward: 18, diff: 3, enemies: ['thug', 'brute', 'gunman'], captives: 3, blurb: 'Hostages are being loaded into a van.' },
  { id: 'rustlers', name: 'Cattle Rustlers', districts: ['farm'], reward: 12, diff: 2, enemies: ['thug', 'knife', 'brute'], captives: 1, blurb: 'Rustlers have the farmer tied up.' },
  { id: 'fire',     name: 'Fire',            variant: 'fire', districts: ['residential', 'factory', 'farm', 'suburb', 'retail', 'downtown', 'warehouse'], reward: 15, diff: 2, enemies: ['arsonist'], captives: 3, blurb: 'A blaze is spreading. People are trapped!' },
  { id: 'heist',    name: 'Bank Heist',      districts: ['financial', 'downtown'], reward: 30, diff: 4, enemies: ['thug', 'gunman', 'brute'], captives: 2, boss: 'Vault Breaker', blurb: 'A crew is cracking the central vault.' },
  { id: 'mob',      name: 'Mob Muscle',      districts: ['casino', 'entertainment', 'nightclub'], reward: 22, diff: 3, enemies: ['gunman', 'brute', 'thug'], captives: 1, boss: 'The Enforcer', blurb: 'The mob is collecting "protection" money.' },
];

// Investigation zones (detective / reporter hotspot scenes).
export const CASES = [
  { id: 'missing',   name: 'Missing Person',   districts: ['residential', 'suburb', 'downtown', 'entertainment'], setting: 'apartment', reward: 20, crime: 'the missing heiress' },
  { id: 'blackmail', name: 'Blackmail Letters', districts: ['financial', 'downtown', 'entertainment', 'residential'], setting: 'office', reward: 22, crime: 'the blackmail letters' },
  { id: 'insider',   name: 'Insider Trading',  districts: ['financial'], setting: 'office', reward: 24, crime: 'the insider-trading scheme' },
  { id: 'rigged',    name: 'Rigged Tables',    districts: ['casino'], setting: 'casino', reward: 22, crime: 'the rigged roulette tables' },
  { id: 'sabotage',  name: 'Sabotage',         districts: ['factory', 'docks', 'warehouse'], setting: 'factory', reward: 22, crime: 'the production-line sabotage' },
  { id: 'arson',     name: 'Arson Mystery',    districts: ['residential', 'suburb', 'retail'], setting: 'apartment', reward: 20, crime: 'the string of arsons' },
  { id: 'poison',    name: 'Poisoned Crops',   districts: ['farm'], setting: 'barn', reward: 20, crime: 'the poisoned harvest' },
  { id: 'smuggle',   name: 'Smuggling Tip-off', districts: ['docks', 'warehouse', 'lair'], setting: 'alley', reward: 22, crime: 'the smuggling ring' },
  { id: 'spiked',    name: 'Spiked Drinks',    districts: ['nightclub', 'entertainment', 'naughty', 'redlight'], setting: 'alley', reward: 22, crime: 'the spiked-drinks scandal' },
];

// Night cases: 3D investigations inside the premade clubs (src/nightcase.js). They replace the
// 2D scenes in nightlife districts after dark. `clueProps` are the evidence objects you search;
// `captives` adds people to free (one of them becomes the witness); `extraTemptations` adds drinks.
export const NIGHT_DISTRICTS = ['nightclub', 'entertainment', 'naughty', 'redlight', 'casino', 'warehouse', 'docks', 'lair'];
export const NIGHT_JOBS = ['bouncer', 'bartender', 'club promoter', 'DJ', 'VIP host', 'club manager', 'coat-check attendant', 'regular customer', 'dealer'];
export const NIGHT_CASES = {
  trafficking:   { name: 'Trafficking Ring', crime: 'the trafficking ring', captives: 2, clueProps: ['Forged Passports', 'Cargo Manifest', 'Burner Phone'] },
  humantraffic:  { name: 'Human Trafficking', crime: 'the human-trafficking pipeline', captives: 3, clueProps: ['Bus Tickets', 'Stack of Fake IDs', 'Ledger of Names'] },
  drugs:         { name: 'Drug Ring', crime: "the club's drug ring", clueProps: ['Baggies Stash', 'Cash Envelope', 'Pager'] },
  weapons:       { name: 'Secret Weapon Parts', crime: 'the smuggled weapon parts', clueProps: ['Machined Trigger Assembly', 'Blueprint Scraps', 'Crate Label'] },
  gang:          { name: 'Gang Shakedown', crime: 'the gang shakedown', clueProps: ['Gang Colors', 'Protection Ledger', 'Brass Knuckles'] },
  murder:        { name: 'Murder in the VIP Room', crime: 'the VIP-room murder', chalk: true, clueProps: ['Broken Glass', 'Torn Cufflink', 'Lipstick Note'] },
  intoxication:  { name: 'Drug Intoxication', crime: 'the spiked-drink poisonings', extraTemptations: 2, clueProps: ['Vial of Powder', 'Pipette', 'Bar Tab'] },
  blackmail:     { name: 'Blackmail', crime: 'the blackmail photos', clueProps: ['Photo Negatives', 'Hidden Camera', 'Ransom Letter'] },
  captive:       { name: 'Captive Situation', crime: 'the hostage situation', captives: 2, clueProps: ['Zip Ties', 'Ransom Recording', 'Van Keys'] },
};

// Special zones (3D third-person). One venue per special district.
export const VENUES = {
  'Nightclub':         { districts: ['nightclub'], themes: ['drugs', 'intoxication', 'gang', 'blackmail', 'hypnosis'], vice: true, kind: 'club', bg: '#0c0716', floor: '#1b1428', wall: '#2c2142', lights: [0xff2fd0, 0x27e0ff, 0x9d4dff] },
  'Warehouse':         { districts: ['warehouse', 'docks'], themes: ['weapons', 'drugs', 'trafficking', 'gang'], vice: true, kind: 'warehouse', bg: '#0b0c0e', floor: '#3a3a3c', wall: '#57524a', lights: [0xffd9a0, 0xfff2d0, 0x9fc8ff] },
  'Penthouse':         { districts: ['financial', 'downtown'], themes: ['blackmail', 'extortion', 'mindcontrol', 'intoxication'], vice: true, kind: 'penthouse', bg: '#050a18', floor: '#a8a296', wall: '#9fb8d8', lights: [0xfff1d6, 0x9fd0ff, 0xffd08a] },
  'High-Roller Suite': { districts: ['casino'], themes: ['extortion', 'blackmail', 'gang', 'hypnosis'], vice: false, kind: 'casino', bg: '#12060a', floor: '#5a1830', wall: '#3a1a24', lights: [0xffd84d, 0xff4d4d, 0xfff1c0] },
  'Red Light Den':     { districts: ['redlight'], themes: ['trafficking', 'blackmail', 'intoxication', 'drugs'], vice: true, kind: 'redlight', bg: '#12040a', floor: '#2a0e14', wall: '#4a1420', lights: [0xff2244, 0xff6688, 0xffaa33] },
  "Gentlemen's Club":  { districts: ['naughty'], themes: ['blackmail', 'hypnosis', 'extortion', 'intoxication'], vice: true, kind: 'gentlemens', bg: '#0e0610', floor: '#2a1430', wall: '#3d1a44', lights: [0xff44cc, 0xcc66ff, 0xffc890] },
  // Premade clubs (see src/clubzone.js / tools/export_club.py). `club` = key in CLUBS.
  'Triangle Club':     { districts: ['nightclub', 'entertainment', 'naughty'], themes: ['drugs', 'blackmail', 'trafficking', 'intoxication', 'gang'], vice: true, kind: 'premade', club: 'triangle', bg: '#0a0610', floor: '#2a1d33', wall: '#3a2a44', lights: [0xff5fd0, 0x7fd0ff, 0xffc890] },
  'The Clubhouse':     { districts: ['warehouse', 'nightclub', 'lair'], themes: ['gang', 'weapons', 'drugs', 'extortion'], vice: true, kind: 'premade', club: 'clubhouse', bg: '#05070c', floor: '#1a1a20', wall: '#3a1a18', lights: [0x27e0ff, 0xff3030, 0xffc890] },
  'Velvet Lounge':     { districts: ['naughty', 'redlight', 'nightclub'], themes: ['blackmail', 'hypnosis', 'intoxication', 'extortion'], vice: true, kind: 'premade', club: 'stripclub', bg: '#07050a', floor: '#2a1d22', wall: '#3a1a22', lights: [0xff3fb8, 0x9d4dff, 0xffc890] },
  'Underground Lair':  { districts: ['lair'], themes: ['mindcontrol', 'hypnosis', 'weapons', 'trafficking'], vice: true, kind: 'lair', bg: '#030805', floor: '#1a201c', wall: '#2a322c', lights: [0x39ff6a, 0xa0ff39, 0x39ffd0] },
};

export const THEMES = {
  blackmail:    { name: 'Blackmail',        evidence: ['Blackmail Photos', 'Negatives Safe'], verb: 'Secure the blackmail photos', headline: 'BLACKMAIL RING', captives: 0 },
  drugs:        { name: 'Drug Ring',        evidence: ['Drug Stash', 'Supplier Ledger'], verb: 'Destroy the stash & grab the ledger', headline: 'DRUG RING', captives: 0 },
  trafficking:  { name: 'Trafficking',      evidence: ['Shipping Manifest'], verb: 'Free the captives', headline: 'TRAFFICKING RING', captives: 3 },
  weapons:      { name: 'Weapons Smuggling', evidence: ['Rifle Crates', 'Buyer List'], verb: 'Seize the weapons shipment', headline: 'GUN-RUNNING OPERATION', captives: 0 },
  extortion:    { name: 'Extortion',        evidence: ['Extortion Ledger'], verb: 'Recover the extortion ledger', headline: 'EXTORTION RACKET', captives: 1 },
  hypnosis:     { name: 'Hypnosis',         evidence: ['Hypno-Projector'], verb: 'Smash the hypno-projector & wake the victims', headline: 'HYPNOSIS PLOT', captives: 2, mind: true },
  mindcontrol:  { name: 'Mind Control',     evidence: ['Control Transmitter', 'Subject Files'], verb: 'Shut down the mind-control transmitter', headline: 'MIND-CONTROL SCHEME', captives: 2, mind: true },
  intoxication: { name: 'Spiked Drinks',    evidence: ['Spiking Chemicals', 'Victim List'], verb: 'Seize the spiking chemicals', headline: 'SPIKED-DRINK RING', captives: 1, extraTraps: 2 },
  gang:         { name: 'Gang Summit',      evidence: ['War Plans'], verb: 'Steal the gang war plans', headline: 'GANG SUMMIT', captives: 0, extraGuards: 1 },
};

export const BOSSES = ['Mister Midas', 'Madame Mesmer', 'The Velvet Viper', 'Doctor Dollar', 'Baron Blackmail', 'Lady Lullaby', 'The Ringmaster', 'Count Cashflow', 'Queen Venom', 'Professor Puppet', 'Silk Sinclair', 'The Chairman'];

// Items that raise intoxication when taken (investigations & special zones).
export const INTOX_ITEMS = [
  { name: 'Complimentary Champagne', desc: 'A flute of bubbly with a card: <em>"For our favorite hero."</em> It might steady your nerves… and it would please the crowd.', intox: 22, perk: 'rep' },
  { name: 'Bowl of Candies', desc: 'Brightly wrapped candies. A quick sugar rush would recharge your powers.', intox: 15, perk: 'energy' },
  { name: 'Strange Perfume', desc: 'An elegant bottle of perfume. One spritz and the whole room smells like roses… and something else.', intox: 25, perk: 'none' },
  { name: '"Energy" Pills', desc: 'Unlabeled pills on a silver tray. <em>"Super-strength formula,"</em> says the note.', intox: 35, perk: 'energy' },
  { name: 'Mystery Cocktail', desc: 'A glowing cocktail left on the bar, still ice-cold. The bartender winks at you.', intox: 28, perk: 'rep' },
];

// Items that might be bait. X-ray shows which ones are wired.
export const BAIT_ITEMS = [
  { name: 'Unattended Briefcase', desc: 'Might hold evidence worth a front page… or it might not be as unattended as it looks.' },
  { name: 'Hypnotic Pendant', desc: 'A swirling gemstone on a chain. It could be evidence of the scheme. It is very hard to look away from.' },
  { name: 'VIP Wristband', desc: 'An all-access VIP band. It could get you past the guards without a fight.' },
  { name: 'Glowing Green Crystal', desc: 'It pulses with a sickly green light. The villains would pay a fortune for it — so would the police lab.' },
  { name: 'Sealed Envelope', desc: 'Marked <em>"Hero — urgent, private."</em> Could be a tip-off from an informant.' },
];

// Detective clue attributes. Each suspect has one value per attribute.
export const ATTRS = {
  hand:  { label: 'Hand',    values: ['left-handed', 'right-handed'],
           clue: { 'left-handed': 'The ink is smeared left-to-right and the letters slant backward. The writer is <b>left-handed</b>.',
                   'right-handed': 'Neat, forward-slanting script with no smudges. The writer is <b>right-handed</b>.' } },
  shoes: { label: 'Shoes',   values: ['red heels', 'muddy work boots', 'shiny loafers'],
           clue: { 'red heels': 'A scuff of red lacquer and a stiletto-sized dent: someone in <b>red heels</b>.',
                   'muddy work boots': 'Heavy tread prints caked in mud: <b>muddy work boots</b>.',
                   'shiny loafers': 'A smear of black shoe polish on the rug: someone in <b>shiny loafers</b>.' } },
  scent: { label: 'Scent',   values: ['cigar smoke', 'cheap cologne', 'peppermint'],
           clue: { 'cigar smoke': 'Fresh ash and the stale stink of <b>cigar smoke</b>.',
                   'cheap cologne': 'A cloying cloud of <b>cheap cologne</b> still hangs here.',
                   'peppermint': 'A sticky <b>peppermint</b> wrapper, recently unwrapped.' } },
  ride:  { label: 'Vehicle', values: ['a black van', 'a red sports car', 'a motorbike'],
           clue: { 'a black van': 'A parking ticket stub, issued to <b>a black van</b> outside at the time of the crime.',
                   'a red sports car': 'Flakes of <b>red sports-car</b> paint scraped onto the doorframe.',
                   'a motorbike': 'A <b>motorbike</b> key fob with a snapped keyring.' } },
  mark:  { label: 'Mark',    values: ['a snake tattoo', 'a gold ring', 'a bandaged hand'],
           clue: { 'a snake tattoo': 'A security still: a <b>snake tattoo</b> coiled around a wrist.',
                   'a gold ring': 'Deep scratches from <b>a heavy gold ring</b> on the handle.',
                   'a bandaged hand': 'Bloody gauze in the trash: someone with <b>a bandaged hand</b>.' } },
  hair:  { label: 'Hair',    values: ['bright red hair', 'silver hair', 'jet-black hair'],
           clue: { 'bright red hair': 'A long <b>bright red hair</b> caught on the latch.',
                   'silver hair': 'A single <b>silver hair</b> on the chair back.',
                   'jet-black hair': 'A few <b>jet-black hairs</b> in a torn hairnet.' } },
};

export const FIRST_NAMES = ['Vic', 'Tony', 'Rita', 'Lou', 'Mona', 'Sal', 'Gina', 'Rex', 'Dolores', 'Frankie', 'Ivy', 'Hank', 'Stella', 'Nico', 'Babs', 'Carl', 'Lana', 'Mickey', 'Vera', 'Duke'];
export const LAST_NAMES = ['Marconi', 'Slade', 'Delacroix', 'Price', 'Vance', 'Moretti', 'Crane', 'Holloway', 'Quill', 'Barrow', 'Fontaine', 'Kasprzak', 'Lark', 'Ostrander', 'Pike', 'Reyes'];
export const JOBS = {
  office: ['junior accountant', 'office manager', 'rival executive', 'night janitor', 'personal assistant', 'IT contractor'],
  apartment: ['landlord', 'upstairs neighbour', 'ex-boyfriend', 'building super', 'delivery driver', 'roommate'],
  alley: ['bouncer', 'bartender', 'club promoter', 'dock foreman', 'fence', 'cab driver'],
  barn: ['farmhand', 'feed supplier', 'rival farmer', 'vet', 'land developer', 'crop duster'],
  casino: ['croupier', 'pit boss', 'high roller', 'security chief', 'cocktail waitress', 'card counter'],
  factory: ['shift foreman', 'union rep', 'safety inspector', 'machinist', 'night guard', 'plant manager'],
};

export const WITNESS_MOODS = [
  { hint: 'She is trembling and keeps glancing at the door.', works: 'reassure' },
  { hint: 'He smirks with his arms crossed. He thinks he is untouchable.', works: 'intimidate' },
  { hint: 'She chatters nervously and keeps changing the subject.', works: 'facts' },
  { hint: 'He looks exhausted and scared for his family.', works: 'reassure' },
  { hint: 'She rolls her eyes: "Heroes. Always so dramatic."', works: 'facts' },
  { hint: 'He cracks his knuckles and sizes you up.', works: 'intimidate' },
];

// Captor's deals when the heroine is captured. Embarrassing but harmless.
export const DEALS = [
  { task: 'Wear a giant foam "I ♥ {V}" hat at tonight\'s ballgame', headline: '{H} CHEERS FOR {V}?!' },
  { task: 'Sing {V}\'s cologne jingle live on the evening news', headline: '{H} SINGS FOR SLEAZY SPONSOR!' },
  { task: 'Cut the ribbon at the mall opening dressed as a giant rubber chicken', headline: 'CLUCK! {H} GOES FOWL' },
  { task: 'Publicly apologize to {V}\'s goons for "hurting their feelings"', headline: '{H} SAYS SORRY — TO THUGS?!' },
  { task: 'Pose for a billboard endorsing {V}\'s "Totally Legit" energy drink', headline: '{H}\'S BIZARRE BILLBOARD BAFFLES CITY' },
];

// Videos for the wall TV in the capture room. Put files in assets/video/ (MP4 H.264 or WebM plays
// everywhere) and list their file names here. 'any' clips play in every venue; add a venue name
// key (e.g. 'Nightclub': ['nightclub_villain.mp4']) for venue-specific ones. One is picked at random.
// With no videos listed, the TV shows the villain's green silhouette feed.
export const CAPTURE_VIDEOS = {
  any: [],
  folder: 'Captive', // every clip in assets/video/Captive/ plays on the capture-room TV (see media.js)
};

// City feed: clips in the minimap corner (src/cityfeed.js). Folders are under assets/video/;
// run `node tools/build_video_manifest.js` after adding clips.
export const CITY_FEED = {
  folders: { flying: 'Flying', rooftop: 'Roof Top' },
  hot: ['redlight', 'entertainment'], // clips keep coming while she's in these districts
  cooldown: 35,        // seconds between district-entry clips elsewhere
  perchCooldown: 20,   // seconds between rooftop clips
  hotGap: [14, 24],    // seconds between clips while in a hot district
  clipMax: 12,         // cut videos off after this many seconds
  imageSecs: 6,        // how long a still stays up
};

export const SIGN_WORDS = {
  shops: ['DELI', 'BOOKS', 'PAWN', 'SHOES', 'PIZZA', 'BAKERY', 'TOYS', 'PHONES', 'FLORIST', 'DINER', 'MARKET', 'LAUNDRY'],
  clubs: ['CLUB NOVA', 'VELVET', 'NEON', 'AFTER DARK', 'PULSE', 'MIDNIGHT', 'LUXE'],
  redlight: ['HOTEL', 'OPEN 24H', 'LOUNGE', 'PEEP', 'KARAOKE', 'MASSAGE', 'BAR'],
  naughty: ['PINK FLAMINGO', 'THE KITTEN', 'CABARET', 'GENTS', 'BURLESQUE', 'SATIN'],
  casino: ['LUCKY 7', 'JACKPOT', 'ROYAL', 'SLOTS', 'GOLD RUSH'],
  venues: ['THEATER', 'CINEMA', 'ARCADE', 'BOWLING', 'COMEDY', 'LIVE MUSIC'],
  lair: ['KEEP OUT', 'DANGER', 'SECTOR 9', 'NO ENTRY'],
};
