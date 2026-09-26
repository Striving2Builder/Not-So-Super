// District atmospheres: a thin haze layer between the rooftops and cruise height that gives each
// district a mood — red neon smog, toxic lair fog, sea mist… Seen from below it's thinner.
// Crime markers are always drawn after this layer, so it never hides them.
import { hash2 } from './rng.js';
import { BLOCK, ROAD, LOT } from './city.js';

export const FOG_Z = 215; // above almost every rooftop, below cruise altitude

// Per district: colour, density, whether it glows (additive) at night, and when it appears.
const ATMOS = {
  redlight: { color: '#ff2a3a', a: 0.24, glow: true },
  naughty: { color: '#e04cff', a: 0.28, glow: true },
  nightclub: { color: '#7a4dff', a: 0.14, glow: true },
  lair: { color: '#39ff6a', a: 0.24, glow: true, bubble: true },
  factory: { color: '#8a7a5a', a: 0.34 },
  warehouse: { color: '#7a7468', a: 0.14 },
  docks: { color: '#dcecff', a: 0.26, drift: 14 },
  farm: { color: '#f4f4ec', a: 0.30, dawnOnly: true },
};

const spriteCache = new Map();
/** A soft, lumpy haze sprite tinted with `color`, built once per colour. */
function hazeSprite(color) {
  let c = spriteCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 192;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 96 + Math.cos(i * 2.4) * 34, y = 96 + Math.sin(i * 1.7) * 26, r = 52 + (i % 3) * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 192, 192);
  }
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, 192, 192);
  spriteCache.set(color, c);
  return c;
}

/** Is this district's haze visible at this time of day? Dawn fog: 5:00–8:30. */
function active(def, clock) {
  if (!def.dawnOnly) return true;
  const h = (clock / 60) % 24;
  return h >= 5 && h < 8.5;
}

/**
 * Draw haze for the visible blocks. `fromBelow` = the hero is under the layer (thinner, since
 * you're looking through the underside of it).
 */
export function drawAtmosphere(ctx, V, city, blocks, clock, fromBelow) {
  if (V.camH - FOG_Z < 200) return; // camera has dropped through it (diving)
  const glowNight = V.night > 0.4;
  for (const b of blocks) {
    const def = ATMOS[b.d];
    if (!def || !active(def, clock)) continue;
    const spr = hazeSprite(def.color);
    const seed = hash2(b.bx, b.by, 77);
    // Two drifting puffs per block, offset so neighbouring blocks overlap into a continuous layer.
    for (let i = 0; i < 2; i++) {
      const phase = V.t * (0.03 + seed * 0.02) + i * 3 + seed * 6;
      const wx = b.x0 + LOT / 2 + Math.cos(phase) * 50 + (def.drift ? (V.t * def.drift) % BLOCK - BLOCK / 2 : 0);
      const wy = b.y0 + LOT / 2 + Math.sin(phase * 1.3) * 40 + (i ? ROAD : -ROAD);
      const s = (BLOCK * 0.95) * V.k * V.P(FOG_Z);
      const x = V.SX(wx, FOG_Z), y = V.SY(wy, FOG_Z);
      if (x < -s || y < -s || x > V.W + s || y > V.H + s) continue;
      let a = def.a * (fromBelow ? 0.5 : 1);
      if (def.bubble) a *= 0.8 + 0.2 * Math.sin(V.t * 2 + seed * 10);
      ctx.save();
      if (def.glow && glowNight) { ctx.globalCompositeOperation = 'lighter'; a *= 0.35; } // additive: overlaps add up fast
      else a *= 0.75 - 0.35 * V.night; // daytime haze stays light; plain haze dims itself at night
      ctx.globalAlpha = a;
      ctx.drawImage(spr, x - s, y - s, s * 2, s * 2);
      ctx.restore();
    }
  }
}
