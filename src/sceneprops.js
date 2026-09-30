// Crime-scene sets: what stands in each room (data), and how each prop is drawn. Props are drawn in
// scene coordinates; static art is baked once per case, drawPropAnim adds the moving parts live.
import { LW, FLOOR, INK, CAPTION } from './crimescene.js';

/** Per setting: room colours/material flags and props [type, name, x, y, w, h, description]. */
export const SETTINGS = {
  office: { wall: '#4f5d70', floor: '#3d3326', window: [560, 60, 240, 150], props: [
    ['desk', 'Executive Desk', 330, 330, 280, 120, 'Paperwork, a stapler and three coffee rings.'],
    ['computer', 'Computer', 420, 262, 96, 70, 'Password-locked. The screensaver scrolls "SELL SELL SELL".'],
    ['cabinet', 'Filing Cabinet', 70, 240, 110, 220, 'Alphabetized folders. Mostly tax forms.'],
    ['shelf', 'Bookshelf', 830, 160, 150, 300, 'Business books nobody has opened.'],
    ['painting', 'Oil Painting', 220, 90, 150, 110, 'A stern portrait of the company founder.'],
    ['coat', 'Coat Rack', 700, 240, 60, 230, 'An umbrella and a lonely scarf.'],
    ['bin', 'Wastebasket', 640, 410, 50, 60, 'Crumpled memos about the coffee machine.'],
    ['plant', 'Potted Plant', 200, 380, 60, 100, 'A ficus. Surprisingly healthy.'],
  ] },
  apartment: { wall: '#7a5f55', floor: '#5a4030', window: [560, 60, 200, 150], props: [
    ['sofa', 'Sofa', 360, 350, 270, 120, 'Lumpy cushions. Someone left in a hurry.'],
    ['tv', 'Television', 90, 290, 160, 120, 'The news is on mute.'],
    ['fridge', 'Fridge', 830, 190, 110, 280, 'Expired milk and a sad lemon.'],
    ['painting', 'Framed Photo', 380, 100, 150, 100, 'A family at the beach, all smiles.'],
    ['coat', 'Coat Hooks', 720, 240, 60, 230, 'A rain jacket, still damp.'],
    ['bin', 'Trash Can', 290, 420, 50, 60, 'Takeout boxes. Lots of them.'],
    ['lamp', 'Floor Lamp', 660, 290, 40, 180, 'The bulb flickers.'],
    ['shelf', 'Wall Shelf', 130, 110, 160, 110, 'Knick-knacks and a snow globe.'],
  ] },
  alley: { wall: '#5a3a33', floor: '#2e2e33', brick: true, props: [
    ['dumpster', 'Dumpster', 90, 330, 230, 140, 'It smells exactly how you would expect.'],
    ['crate', 'Wooden Crate', 420, 380, 110, 90, 'Stamped "PRODUCE". It rattles like glass.'],
    ['barrel', 'Oil Drum', 570, 370, 70, 110, 'Half-full of rainwater.'],
    ['painting', 'Torn Poster', 330, 130, 120, 160, 'A peeling club flyer: "LADIES NIGHT — FREE DRINKS".'],
    ['pipe', 'Drainpipe', 900, 40, 34, 440, 'Rusty, loose at the joint.'],
    ['door', 'Back Door', 690, 180, 120, 250, 'Steel. Locked from the inside.'],
    ['bin', 'Trash Can', 850, 410, 60, 70, 'Broken bottles and cigarette butts.'],
  ] },
  barn: { wall: '#7a3b2a', floor: '#8a7443', planks: true, props: [
    ['hay', 'Hay Bales', 60, 350, 220, 130, 'Stacked neat and tight.'],
    ['tractor', 'Tractor', 560, 300, 260, 180, 'The engine is still warm.'],
    ['trough', 'Feed Trough', 310, 430, 190, 50, 'The feed smells chemical.'],
    ['crate', 'Seed Crate', 330, 340, 100, 80, 'Seed packets, some torn open.'],
    ['barrel', 'Chemical Drum', 860, 370, 70, 110, 'A skull-and-crossbones label, half scraped off.'],
    ['shelf', 'Tool Shelf', 820, 110, 150, 170, 'Pitchforks, rope, a rusty sickle.'],
    ['door', 'Hayloft Door', 380, 90, 170, 200, 'The latch has been forced.'],
  ] },
  casino: { wall: '#3a1a24', floor: '#5a1830', carpet: true, props: [
    ['pokertable', 'Roulette Table', 300, 380, 300, 100, 'The wheel lands on 17. Again. And again.'],
    ['slot', 'Slot Machine', 50, 220, 100, 240, 'JACKPOT lights, no jackpots.'],
    ['slot', 'Slot Machine', 160, 220, 100, 240, 'It eats your quarter and blinks smugly.'],
    ['bar', 'Cocktail Bar', 690, 320, 290, 140, 'Bottles glitter under the lights.'],
    ['painting', 'Gilded Mirror', 420, 90, 160, 110, 'Two-way glass? Could be.'],
    ['tv', 'Security Monitor', 820, 90, 130, 90, 'Camera 4 shows static.'],
    ['cabinet', 'Cashier Cage', 580, 170, 100, 160, 'Chips stacked in neat towers.'],
  ] },
  factory: { wall: '#4a4d52', floor: '#35373b', props: [
    ['machine', 'Press Machine', 60, 230, 270, 240, 'Hydraulic press. Someone jammed a wrench in it.'],
    ['crate', 'Parts Crate', 420, 380, 100, 90, 'Bolts and brackets.'],
    ['barrel', 'Oil Drum', 540, 370, 70, 110, 'Leaking a rainbow puddle.'],
    ['cabinet', 'Staff Lockers', 860, 190, 110, 280, 'Names taped on each door.'],
    ['painting', 'Shift Board', 400, 110, 170, 110, 'The night shift roster, pinned with darts.'],
    ['shelf', 'Parts Shelf', 650, 180, 150, 270, 'Everything labeled, one gap.'],
    ['bin', 'Scrap Bin', 350, 440, 50, 50, 'Metal shavings.'],
  ] },
};
/** Prop types that can hide an X-ray clue, and ones the bait item can sit on. */
export const CONTAINERS = ['cabinet', 'painting', 'crate', 'barrel', 'dumpster', 'fridge', 'sofa', 'machine', 'hay', 'slot', 'desk', 'tv', 'door', 'tractor'];
export const SURFACES = ['desk', 'bar', 'pokertable', 'crate', 'sofa', 'trough', 'hay', 'dumpster'];
/** Props with moving parts (see drawPropAnim). */
export const ANIM = ['computer', 'tv', 'slot', 'pokertable', 'machine'];

/** Contact shadow under a floor-standing prop (drawn on the room, so it isn't inked). */
export function contactShadow(g, p) {
  if (p.y + p.h <= FLOOR) return;
  const cx = p.x + p.w / 2, cy = p.y + p.h, rx = p.w * 0.62;
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, rx);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.7, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.save(); g.translate(cx, cy); g.scale(1, 16 / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.restore(); g.fill();
}

/** Evidence tent: yellow A-frame card with the marker number. */
export function tent(g, x, y, n, photo) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(4, 2, 24, 6, 0, 0, Math.PI * 2); g.fill();
  g.lineJoin = 'round'; g.strokeStyle = INK; g.lineWidth = 3;
  g.fillStyle = '#c9a20e'; g.beginPath(); g.moveTo(-6, -40); g.lineTo(12, -40); g.lineTo(24, 0); g.lineTo(6, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd21a'; g.beginPath(); g.moveTo(-8, -40); g.lineTo(6, -40); g.lineTo(18, 0); g.lineTo(-20, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = INK; g.font = `26px ${CAPTION}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), -1, -16);
  if (photo) { g.fillStyle = '#3ee08a'; g.beginPath(); g.arc(16, -40, 9, 0, Math.PI * 2); g.fill(); g.stroke(); g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(11, -40); g.lineTo(15, -36); g.lineTo(21, -44); g.stroke(); }
  g.restore();
}

/** Light from above: warm highlight on top, falloff toward the floor, painted over the prop only. */
export function shadeProp(g, p) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, p.y, 0, p.y + p.h);
  gr.addColorStop(0, 'rgba(255,236,200,.16)'); gr.addColorStop(0.35, 'rgba(255,236,200,0)'); gr.addColorStop(1, 'rgba(12,4,24,.42)');
  g.fillStyle = gr; g.fillRect(p.x - 12, p.y - 12, p.w + 24, p.h + 12);
  const sg = g.createLinearGradient(p.x, 0, p.x + p.w, 0); // the side away from the lamp falls into shadow
  const away = p.x + p.w / 2 < LW / 2;
  sg.addColorStop(0, away ? 'rgba(12,4,24,.22)' : 'rgba(12,4,24,0)'); sg.addColorStop(1, away ? 'rgba(12,4,24,0)' : 'rgba(12,4,24,.22)');
  g.fillStyle = sg; g.fillRect(p.x - 12, p.y - 12, p.w + 24, p.h + 12);
  g.restore();
}

// --------------------------------------------------------------------------
// Prop drawings (logical coordinates, x/y = top-left).
// --------------------------------------------------------------------------
export function drawProp(ctx, p, t) {
  const { x, y, w, h } = p;
  // Every panel gets a thin ink line so the props read as drawn, not flat-filled.
  const box = (xx, yy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, ww, hh); if (ww > 5 && hh > 5) { ctx.strokeStyle = 'rgba(14,6,18,.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(xx, yy, ww, hh); } };
  switch (p.type) {
    case 'desk':
      box(x, y, w, 18, '#6b4424'); box(x + 10, y + 18, 70, h - 18, '#5a381c'); box(x + w - 80, y + 18, 70, h - 18, '#5a381c');
      box(x + 20, y + 35, 50, 6, '#c9a24a'); box(x + 20, y + 70, 50, 6, '#c9a24a');
      box(x + w * 0.62, y - 8, 50, 8, '#eee'); break;
    case 'computer':
      box(x, y, w, h - 12, '#222'); box(x + 5, y + 5, w - 10, h - 24, `hsl(${(t * 40) % 360},60%,40%)`); box(x + w / 2 - 8, y + h - 12, 16, 12, '#333'); break;
    case 'cabinet':
      box(x, y, w, h, '#7d8590');
      for (let i = 0; i < 4; i++) { box(x + 6, y + 8 + i * (h / 4), w - 12, h / 4 - 12, '#8f98a3'); box(x + w / 2 - 12, y + 20 + i * (h / 4), 24, 5, '#444'); }
      break;
    case 'shelf':
      box(x, y, w, h, '#5a3a22');
      for (let i = 0; i < 4; i++) {
        const sy = y + 10 + i * (h / 4);
        box(x + 6, sy + h / 4 - 14, w - 12, 5, '#3a2414');
        for (let j = 0; j < 7; j++) box(x + 10 + j * ((w - 20) / 7), sy + 8 + (j % 3) * 4, (w - 20) / 7 - 3, h / 4 - 22 - (j % 3) * 4, ['#a33', '#35a', '#3a5', '#aa3', '#737', '#a63'][(i + j) % 6]);
      }
      break;
    case 'painting': drawWallPiece(ctx, p, box); break;
    case 'coat':
      box(x + w / 2 - 4, y, 8, h, '#4a3020'); box(x + w / 2 - 25, y + h - 8, 50, 8, '#4a3020');
      ctx.fillStyle = '#6a2a2a'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 20); ctx.lineTo(x + w / 2 + 26, y + 120); ctx.lineTo(x + w / 2 - 6, y + 120); ctx.fill(); break;
    case 'bin':
      ctx.fillStyle = '#556'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x + 6, y + h); ctx.fill();
      ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(x + w / 2, y + 2, 9, Math.PI, 0); ctx.fill(); break;
    case 'plant':
      box(x + 10, y + h - 36, w - 20, 36, '#8a4a2a');
      ctx.fillStyle = '#3a8a3a'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x + w / 2 + Math.cos(i) * 14, y + 30 + Math.sin(i * 2) * 14, 10, 22, i, 0, Math.PI * 2); ctx.fill(); } break;
    case 'sofa':
      box(x, y + 20, w, h - 20, '#6a3a5a'); box(x, y, w, 40, '#7a4a6a'); box(x - 10, y + 20, 26, h - 20, '#5a2a4a'); box(x + w - 16, y + 20, 26, h - 20, '#5a2a4a');
      box(x + 20, y + 45, w / 2 - 25, 30, '#8a5a7a'); box(x + w / 2 + 5, y + 45, w / 2 - 25, 30, '#8a5a7a'); break;
    case 'tv':
      box(x, y, w, h * 0.7, '#111'); box(x + 6, y + 6, w - 12, h * 0.7 - 12, '#3a5a8a');
      ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 6, y + 6 + ((t * 30 + i * 12) % (h * 0.7 - 12)), w - 12, 2);
      box(x + w / 2 - 20, y + h * 0.7, 40, h * 0.3, '#333'); break;
    case 'fridge':
      box(x, y, w, h, '#e8e8e4'); box(x, y + h * 0.35, w, 3, '#bbb'); box(x + w - 16, y + 30, 6, 40, '#999'); box(x + w - 16, y + h * 0.45, 6, 60, '#999'); break;
    case 'lamp':
      box(x + w / 2 - 3, y + 40, 6, h - 40, '#333'); box(x + w / 2 - 18, y + h - 6, 36, 6, '#333');
      ctx.fillStyle = '#f0e0b0'; ctx.beginPath(); ctx.moveTo(x - 6, y + 44); ctx.lineTo(x + w + 6, y + 44); ctx.lineTo(x + w - 6, y); ctx.lineTo(x + 6, y); ctx.fill(); break;
    case 'dumpster':
      // bin bags spilling over, a lid propped open, ribs, wheels, grime
      ctx.fillStyle = '#1a1a20'; for (const [bx, r] of [[x + 50, 34], [x + 110, 40], [x + 170, 30]]) { ctx.beginPath(); ctx.arc(bx, y + 22, r, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 100, y - 6, 6, 18);
      box(x, y + 20, w, h - 20, '#2f6a3a');
      for (let i = 1; i < 5; i++) box(x + i * (w / 5) - 4, y + 24, 8, h - 34, '#26562f');
      ctx.fillStyle = 'rgba(30,20,10,.35)'; ctx.fillRect(x, y + h - 40, w, 30);
      ctx.save(); ctx.translate(x - 6, y + 12); ctx.rotate(-0.35); box(0, -8, w * 0.55, 12, '#26562f'); ctx.restore();
      box(x - 6, y + 12, w + 12, 12, '#26562f');
      ctx.fillStyle = '#111'; for (const wx of [x + 24, x + w - 24]) { ctx.beginPath(); ctx.arc(wx, y + h, 10, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'crate':
      box(x, y, w, h, '#a8804a'); ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 6; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke(); break;
    case 'barrel':
      box(x, y, w, h, '#3a5a8a'); box(x, y + 12, w, 6, '#2a3a5a'); box(x, y + h - 20, w, 6, '#2a3a5a');
      ctx.fillStyle = '#f2d21a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2); ctx.fill(); break;
    case 'pipe':
      box(x, y, w, h, '#6a6a6a'); for (let i = 0; i < h; i += 90) box(x - 4, y + i, w + 8, 10, '#555'); break;
    case 'door':
      box(x, y, w, h, '#4a4f58'); box(x + 10, y + 10, w - 20, h * 0.4, '#555c66'); box(x + w - 24, y + h / 2, 12, 12, '#c9a24a'); break;
    case 'hay':
      for (let i = 0; i < 3; i++) { box(x + (i % 2) * 20, y + i * (h / 3), w - 20, h / 3 - 4, '#d8b85a'); ctx.fillStyle = '#b8983a'; for (let j = 0; j < 8; j++) ctx.fillRect(x + (i % 2) * 20 + j * (w / 9), y + i * (h / 3), 3, h / 3 - 4); }
      break;
    case 'tractor':
      box(x + 20, y + 40, w - 80, h - 90, '#3a8a3a'); box(x + w - 110, y, 80, 80, '#3a8a3a'); box(x + w - 100, y + 8, 60, 40, '#9cc8e8');
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 60, y + h - 40, 40, 0, Math.PI * 2); ctx.arc(x + w - 60, y + h - 50, 50, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(x + 60, y + h - 40, 16, 0, Math.PI * 2); ctx.arc(x + w - 60, y + h - 50, 20, 0, Math.PI * 2); ctx.fill(); break;
    case 'trough':
      box(x, y, w, h, '#7a5a3a'); box(x + 8, y + 6, w - 16, 14, '#b8a860'); break;
    case 'pokertable':
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 30, w / 2, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a6a3a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 28, w / 2 - 12, 26, 0, 0, Math.PI * 2); ctx.fill();
      box(x + 40, y + 50, 16, h - 50, '#3a2410'); box(x + w - 56, y + 50, 16, h - 50, '#3a2410');
      ctx.save(); ctx.translate(x + w / 2, y + 26); ctx.rotate(t * 2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a22'; for (let i = 0; i < 8; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4); ctx.fill(); } ctx.restore(); break;
    case 'slot':
      box(x, y, w, h, '#8a1a2a'); box(x + 6, y + 6, w - 12, 40, '#ffd84d');
      ctx.fillStyle = '#222'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('JACKPOT', x + w / 2, y + 31);
      box(x + 12, y + 60, w - 24, 50, '#eee');
      ctx.font = '900 22px system-ui'; ctx.fillStyle = '#a22'; ctx.fillText(['7', '$', '♦'][Math.floor(t * 8) % 3] + ' 7 ' + ['♦', '7', '$'][Math.floor(t * 6) % 3], x + w / 2, y + 94);
      box(x + w - 4, y + 60, 10, 60, '#bbb'); break;
    case 'bar':
      box(x, y, w, 20, '#3a1a0a'); box(x, y + 20, w, h - 20, '#5a2a14');
      for (let i = 0; i < 8; i++) box(x + 20 + i * 32, y - 50 - (i % 3) * 10, 12, 50 + (i % 3) * 10, ['#3a8a3a', '#8a3a3a', '#c9a24a', '#3a3a8a'][i % 4]);
      break;
    case 'board':
      box(x, y, w, h, '#b8905a'); for (let i = 0; i < 5; i++) box(x + 10 + (i % 3) * 50, y + 10 + Math.floor(i / 3) * 50, 40, 36, '#f2ead8'); break;
    case 'machine':
      box(x, y + 40, w, h - 40, '#5a6a7a'); box(x + 30, y, w - 60, 60, '#4a5a6a'); box(x + w / 2 - 30, y + 60, 60, h * 0.5, '#8a9aaa');
      box(x + 20, y + h - 60, 40, 20, (Math.sin(t * 5) > 0 ? '#ff4040' : '#401010'));
      box(x + w - 60, y + 80, 30, 30, '#f2d21a'); break;
    default:
      box(x, y, w, h, '#777');
  }
}

/** Framed wall pieces: each one is its own thing, not the same painting everywhere. */
function drawWallPiece(ctx, p, box) {
  const { x, y, w, h, name } = p;
  const line = (c = 'rgba(14,6,18,.7)', lw = 2) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };
  if (name === 'Torn Poster') { // club flyer, corner peeling
    ctx.fillStyle = '#f2e14a'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + 6); ctx.lineTo(x + w - 6, y + h - 30); ctx.lineTo(x + w - 34, y + h); ctx.lineTo(x + 4, y + h - 4); ctx.closePath(); ctx.fill(); line();
    ctx.fillStyle = '#d8122e'; ctx.font = '26px "Bangers", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LADIES', x + w / 2, y + 34); ctx.fillText('NIGHT', x + w / 2, y + 62);
    ctx.fillStyle = '#111'; ctx.font = '700 12px system-ui'; ctx.fillText('FREE DRINKS', x + w / 2, y + 92);
    ctx.fillStyle = '#c8b030'; ctx.beginPath(); ctx.moveTo(x + w - 6, y + h - 30); ctx.lineTo(x + w - 34, y + h); ctx.lineTo(x + w - 30, y + h - 26); ctx.closePath(); ctx.fill(); line();
    return;
  }
  if (name === 'Shift Board') { // cork board, rota sheets, darts
    box(x, y, w, h, '#6a4a2a'); box(x + 6, y + 6, w - 12, h - 12, '#b8905a');
    for (let i = 0; i < 4; i++) box(x + 14 + i * 38, y + 14 + (i % 2) * 8, 32, 44, '#f2ead8');
    ctx.fillStyle = '#d8122e'; for (const [dx, dy] of [[30, 20], [100, 30], [140, 70]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x + 18 + i * 38, y + 26 + j * 8 + (i % 2) * 8); ctx.lineTo(x + 40 + i * 38, y + 26 + j * 8 + (i % 2) * 8); ctx.stroke(); }
    return;
  }
  if (name === 'Hayloft Door') { // big plank door, Z-brace, forced latch
    box(x, y, w, h, '#7a4a2a'); for (let i = 1; i < 5; i++) box(x + i * (w / 5) - 1, y, 3, h, '#5a3218');
    ctx.strokeStyle = '#5a3218'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x + 10, y + 20); ctx.lineTo(x + w - 10, y + 20); ctx.lineTo(x + 10, y + h - 20); ctx.lineTo(x + w - 10, y + h - 20); ctx.stroke();
    box(x + w - 30, y + h / 2 - 8, 22, 16, '#6a6a6a'); ctx.save(); ctx.translate(x + w - 14, y + h / 2 + 12); ctx.rotate(0.6); box(-3, 0, 6, 22, '#8a8a8a'); ctx.restore();
    return;
  }
  // gilt frame, then the picture inside
  box(x, y, w, h, '#c9a24a');
  ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  const ix = x + 10, iy = y + 10, iw = w - 20, ih = h - 20;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  if (name === 'Framed Photo') { // family at the beach
    const sky = ctx.createLinearGradient(0, iy, 0, iy + ih); sky.addColorStop(0, '#8cc8f0'); sky.addColorStop(0.6, '#cfe8f6'); sky.addColorStop(0.61, '#3a8ac8'); sky.addColorStop(0.75, '#3a8ac8'); sky.addColorStop(0.76, '#f0d8a0'); ctx.fillStyle = sky; ctx.fillRect(ix, iy, iw, ih);
    for (const [fx, fh, c] of [[0.3, 0.5, '#d8122e'], [0.45, 0.62, '#1e3cff'], [0.6, 0.42, '#e8c21a'], [0.72, 0.3, '#2a8a3a']]) { ctx.fillStyle = '#e0b890'; ctx.beginPath(); ctx.arc(ix + iw * fx, iy + ih * (1 - fh) + 4, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = c; ctx.fillRect(ix + iw * fx - 5, iy + ih * (1 - fh) + 9, 10, ih * fh); }
  } else if (name === 'Gilded Mirror') { // silvered glass with a reflected lamp and streaks
    const gl = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih); gl.addColorStop(0, '#9aa6b4'); gl.addColorStop(0.5, '#56606e'); gl.addColorStop(1, '#2a3040'); ctx.fillStyle = gl; ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = 'rgba(255,240,200,.7)'; ctx.beginPath(); ctx.arc(ix + iw * 0.62, iy + 16, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(ix + 10, iy + ih); ctx.lineTo(ix + 40, iy); ctx.lineTo(ix + 56, iy); ctx.lineTo(ix + 26, iy + ih); ctx.fill();
  } else { // oil portrait of a stern founder
    ctx.fillStyle = '#2a2016'; ctx.fillRect(ix, iy, iw, ih);
    const bg = ctx.createRadialGradient(ix + iw / 2, iy + ih * 0.4, 4, ix + iw / 2, iy + ih * 0.4, iw * 0.7); bg.addColorStop(0, '#6a4a2a'); bg.addColorStop(1, '#1a120a'); ctx.fillStyle = bg; ctx.fillRect(ix, iy, iw, ih);
    ctx.fillStyle = '#141018'; ctx.beginPath(); ctx.ellipse(ix + iw / 2, iy + ih + 6, iw * 0.34, ih * 0.42, 0, 0, Math.PI * 2); ctx.fill(); // coat
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(ix + iw / 2 - 8, iy + ih * 0.66); ctx.lineTo(ix + iw / 2 + 8, iy + ih * 0.66); ctx.lineTo(ix + iw / 2, iy + ih); ctx.fill(); // collar
    ctx.fillStyle = '#d8a882'; ctx.beginPath(); ctx.ellipse(ix + iw / 2, iy + ih * 0.42, iw * 0.13, ih * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8c8c8'; ctx.beginPath(); ctx.ellipse(ix + iw / 2, iy + ih * 0.24, iw * 0.14, ih * 0.08, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ix + iw / 2 - 8, iy + ih * 0.4); ctx.lineTo(ix + iw / 2 - 3, iy + ih * 0.41); ctx.moveTo(ix + iw / 2 + 3, iy + ih * 0.41); ctx.lineTo(ix + iw / 2 + 8, iy + ih * 0.4); ctx.moveTo(ix + iw / 2 - 6, iy + ih * 0.54); ctx.lineTo(ix + iw / 2 + 6, iy + ih * 0.54); ctx.stroke();
  }
  ctx.restore();
}

/** Just the moving parts of a prop, drawn over its baked image every frame. */
export function drawPropAnim(ctx, p, t) {
  const { x, y, w, h } = p;
  const box = (xx, yy, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(xx, yy, ww, hh); ctx.strokeStyle = 'rgba(14,6,18,.6)'; ctx.lineWidth = 1.6; ctx.strokeRect(xx, yy, ww, hh); };
  switch (p.type) {
    case 'computer': box(x + 5, y + 5, w - 10, h - 24, `hsl(${(t * 40) % 360},60%,40%)`); break;
    case 'tv':
      box(x + 6, y + 6, w - 12, h * 0.7 - 12, '#3a5a8a');
      ctx.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 6, y + 6 + ((t * 30 + i * 12) % (h * 0.7 - 12)), w - 12, 2);
      break;
    case 'slot':
      box(x + 12, y + 60, w - 24, 50, '#eee');
      ctx.font = '900 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#a22';
      ctx.fillText(['7', '$', '♦'][Math.floor(t * 8) % 3] + ' 7 ' + ['♦', '7', '$'][Math.floor(t * 6) % 3], x + w / 2, y + 94);
      break;
    case 'pokertable':
      ctx.save(); ctx.translate(x + w / 2, y + 26); ctx.rotate(t * 2); ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#120a16'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#a22'; for (let i = 0; i < 8; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4); ctx.fill(); } ctx.restore();
      break;
    case 'machine': box(x + 20, y + h - 60, 40, 20, (Math.sin(t * 5) > 0 ? '#ff4040' : '#401010')); break;
  }
}

