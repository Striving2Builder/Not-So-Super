// Generates many clubs and proves each one is fully accessible (src/nightclub/layout.js).
//   node tools/nightclub/layoutcheck.mjs [--n 500] [--show 3]
// Prints failures (there should be none), room-count and lock stats, and a few sample graphs.
import { buildClub, checkClub } from '../../src/nightclub/layout.js';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const N = arg('--n', 500), SHOW = arg('--show', 2);

const draw = (c) => c.rooms.map((r) => `  ${r.id.padEnd(10)} f${r.floor} w${r.w}  ` +
  r.doors.map((d) => `${d.x}:${d.to || 'STREET'}${d.lock ? `[${d.lock}]` : ''}${d.kind === 'stairs' ? '^' : ''}`).join('  ') +
  (r.spots.length ? `  spots ${r.spots.map((s) => s.type).join(',')}` : '')).join('\n') +
  `\n  keys: ${c.keys.map((k) => `${k.item} @ ${k.room}:${k.x}`).join(', ') || 'none'}`;

let fails = 0;
const sizes = {}, locks = {};
const flag = buildClub({ flagship: true });
const fr = checkClub(flag);
console.log(`flagship ${flag.name}: ${fr.ok ? 'OK' : 'FAIL ' + JSON.stringify(fr)}\n${draw(flag)}\n`);
if (!fr.ok) fails++;
for (const size of ['small', 'medium', 'large']) {
  for (let s = 1; s <= N; s++) {
    let c;
    try { c = buildClub({ seed: s, size }); } catch (e) { fails++; console.log(`${size} seed ${s}: ${e.message}`); continue; }
    const r = checkClub(c);
    if (!r.ok) { fails++; console.log(`${size} seed ${s}: FAIL ${JSON.stringify(r)}`); }
    (sizes[size] = sizes[size] || []).push(c.rooms.length);
    for (const k of c.keys) locks[k.item] = (locks[k.item] || 0) + 1;
    if (s <= SHOW && size === 'medium') console.log(`medium seed ${s}:\n${draw(c)}\n`);
  }
}
for (const [k, v] of Object.entries(sizes)) console.log(`${k}: rooms ${Math.min(...v)}–${Math.max(...v)}, avg ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`);
console.log(`locks used: ${JSON.stringify(locks)}`);
console.log(fails ? `${fails} FAILED` : `all ${3 * N + 1} clubs accessible`);
process.exit(fails ? 1 : 0);
