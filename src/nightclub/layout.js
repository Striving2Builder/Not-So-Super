// The club engine's layout: a graph of rooms (flagship = hand-made, or grown from a seed), doors
// placed along each room's walk, locks and the keys that open them. Hard rule from the design: every
// room is reachable from the entrance; checkClub() proves it, and buildClub() never returns a club
// that fails it. Pure logic (no DOM): tools/nightclub/layoutcheck.mjs runs it in node.
import { RNG } from '../rng.js';
import { ROOMS, ATTACH, FLAGSHIP, CLUB_SIZE } from './rooms.js';

const MARGIN = 260;    // doors and items keep clear of the plate edges (the camera stops there)
const DOOR_GAP = 600;  // min spacing between doors on one wall
const KEY_GAP = 180;   // a key never sits on a door

/** Door slots a room's wall has room for (the entrance keeps one for the street). */
const slots = (kind) => Math.max(2, Math.floor((ROOMS[kind].w - 2 * MARGIN) / DOOR_GAP) + 1) - (kind === 'entrance' ? 1 : 0);

/** Grow a random club: entrance → main floor, then rooms hung off allowed parents, then 1–2 loops. */
function grow(rng, size) {
  const [lo, hi] = CLUB_SIZE[size] || CLUB_SIZE.medium;
  const n = rng.int(lo, hi);
  const rooms = [{ id: 'entrance', kind: 'entrance' }, { id: 'main', kind: 'main' }];
  const links = [['entrance', 'main']];
  const deg = (id) => links.filter((l) => l[0] === id || l[1] === id).length;
  const count = {};
  const uid = (k) => { count[k] = (count[k] || 0) + 1; return count[k] === 1 ? k : `${k}${count[k]}`; };
  const pool = ['lounge', 'dark', 'balcony', 'vip', 'vip', 'office', 'storage', 'alley', 'restroom', 'vip', 'bar', 'dark', 'lounge'];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // the core first (every club has a bar, restrooms and a stair corridor), then the shuffled rest,
  // twice over, so a room whose parent comes later in the list still gets a second chance
  const queue = ['bar', 'restroom', 'corridor', ...pool, ...pool];
  const placed = new Set();
  for (let qi = 0; qi < queue.length && rooms.length < n; qi++) {
    const kind = queue[qi];
    if (qi >= 3 + pool.length && placed.has(qi - pool.length)) continue; // second pass: only what failed
    const parents = rooms.filter((r) => ATTACH[kind]?.includes(r.kind) && deg(r.id) < slots(r.kind));
    if (!parents.length) continue;
    const p = rng.pick(parents), id = uid(kind);
    rooms.push({ id, kind }); links.push([p.id, id]); placed.add(qi);
  }
  // loops: a walk that circles back (bar ↔ lounge, corridor ↔ alley) instead of a pure tree
  const linked = (a, b) => links.some((l) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
  const cand = [];
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id || linked(a.id, b.id) || ROOMS[a.kind].lock || ROOMS[b.kind].lock) continue;
    if ((ATTACH[a.kind]?.includes(b.kind) || ATTACH[b.kind]?.includes(a.kind)) && deg(a.id) < slots(a.kind) && deg(b.id) < slots(b.kind)) cand.push([a.id, b.id]);
  }
  for (let k = rng.int(1, 2); k > 0 && cand.length; k--) links.push(cand.splice(Math.floor(rng.next() * cand.length), 1)[0]);
  return { rooms, links };
}

/** Doors along each room's wall, evenly spread; a dead end gets its one door at one end. */
function placeDoors(rng, rooms, links) {
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
  for (const r of rooms) {
    r.w = ROOMS[r.kind].w;
    r.doors = [];
    const mine = links.filter((l) => l[0] === r.id || l[1] === r.id).map((l) => (l[0] === r.id ? l[1] : l[0]));
    const m = mine.length + (r.kind === 'entrance' ? 1 : 0);
    const xs = m === 1 ? [rng.chance(0.5) ? MARGIN : r.w - MARGIN] : Array.from({ length: m }, (_, j) => MARGIN + (r.w - 2 * MARGIN) * (j / (m - 1)));
    let j = 0;
    if (r.kind === 'entrance') r.doors.push({ x: xs[j++], to: null, kind: 'street' }); // back to the sky
    for (const to of mine) r.doors.push({ x: xs[j++], to, kind: 'arch' });
  }
  // floors: a room sits on its parent's floor when it may; a link between floors is a staircase
  const floorOf = { entrance: 0 };
  const seen = new Set(['entrance']), q = ['entrance'];
  while (q.length) {
    const r = byId[q.shift()];
    for (const d of r.doors) {
      if (!d.to || seen.has(d.to)) continue;
      const t = byId[d.to], fl = ROOMS[t.kind].floor;
      floorOf[t.id] = fl.includes(floorOf[r.id]) ? floorOf[r.id] : fl[0];
      seen.add(t.id); q.push(t.id);
    }
  }
  for (const r of rooms) {
    r.floor = floorOf[r.id] ?? 0;
    for (const d of r.doors) {
      if (!d.to) continue;
      const t = byId[d.to];
      d.kind = floorOf[t.id] !== r.floor ? 'stairs' : ROOMS[t.kind].lock || t.kind === 'restroom' || t.kind === 'office' ? 'door' : 'arch';
      d.lock = ROOMS[t.kind].lock || null;
    }
  }
}

/** Rooms reachable from the entrance holding `held` items (a locked room needs its item). */
function reach(rooms, held) {
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const seen = new Set(['entrance']), q = ['entrance'];
  while (q.length) {
    for (const d of byId[q.shift()].doors) {
      if (!d.to || seen.has(d.to) || (d.lock && !held.has(d.lock))) continue;
      seen.add(d.to); q.push(d.to);
    }
  }
  return seen;
}

/** Each lock's item goes in a room reachable with the items placed so far: always solvable. */
function placeKeys(rng, rooms) {
  const keys = [], held = new Set();
  const locks = [...new Set(rooms.map((r) => ROOMS[r.kind].lock).filter(Boolean))];
  for (const item of locks) {
    const open = [...reach(rooms, held)].map((id) => rooms.find((r) => r.id === id)).filter((r) => ROOMS[r.kind].lock !== item);
    const r = rng.pick(open);
    let x = 0;
    for (let tries = 0; tries < 20; tries++) {
      x = rng.range(MARGIN, r.w - MARGIN);
      if (r.doors.every((d) => Math.abs(d.x - x) > KEY_GAP)) break;
    }
    keys.push({ item, room: r.id, x: Math.round(x) });
    held.add(item);
  }
  return keys;
}

/** The look-test props: a drink at every bar, the DJ set piece at the main floor's far end. */
function placeSpots(rng, rooms) {
  for (const r of rooms) {
    r.spots = [];
    const free = (x) => r.doors.every((d) => Math.abs(d.x - x) > KEY_GAP);
    if (r.kind === 'bar') { let x = r.w * 0.5; if (!free(x)) x = r.w * 0.38; r.spots.push({ type: 'drink', x: Math.round(x) }); }
    if (r.kind === 'main') r.spots.push({ type: 'djview', x: r.w - MARGIN - 120 });
  }
}

/** Accessibility proof: doors pair up both ways, every room has a door, all reachable with the keys. */
export function checkClub(club) {
  const { rooms, keys } = club;
  const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const problems = [];
  for (const r of rooms) {
    if (!r.doors.length) problems.push(`${r.id}: no doors`);
    for (const d of r.doors) {
      if (!d.to) continue;
      if (!byId[d.to]) problems.push(`${r.id}: door to missing ${d.to}`);
      else if (!byId[d.to].doors.some((e) => e.to === r.id)) problems.push(`${r.id} → ${d.to}: no way back`);
    }
  }
  if (!rooms.some((r) => r.doors.some((d) => d.kind === 'street'))) problems.push('no street exit');
  const held = new Set();
  let seen = reach(rooms, held);
  for (let grew = true; grew;) {
    grew = false;
    for (const k of keys) if (seen.has(k.room) && !held.has(k.item)) { held.add(k.item); grew = true; }
    if (grew) seen = reach(rooms, held);
  }
  const unreachable = rooms.filter((r) => !seen.has(r.id)).map((r) => r.id);
  return { ok: !problems.length && !unreachable.length, problems, unreachable };
}

/**
 * A club: { name, seed, rooms: [{ id, kind, w, floor, doors: [{x, to, kind, lock}], spots }], keys }.
 * flagship = the hand-made graph; otherwise grown from `seed` (re-seeded until it passes checkClub).
 */
export function buildClub({ seed = 1, flagship = false, size = 'medium', name } = {}) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const rng = new RNG(((seed + attempt * 7919) * 2654435761) >>> 0);
    const g = flagship
      ? { rooms: FLAGSHIP.rooms.map((k) => ({ id: k, kind: k })), links: FLAGSHIP.links.map((l) => l.slice()) }
      : grow(rng, size);
    placeDoors(rng, g.rooms, g.links);
    const club = { name: name || (flagship ? FLAGSHIP.name : 'Club'), seed, rooms: g.rooms, keys: placeKeys(rng, g.rooms) };
    placeSpots(rng, club.rooms);
    if (checkClub(club).ok) return club;
  }
  throw new Error(`no valid club for seed ${seed}`);
}
