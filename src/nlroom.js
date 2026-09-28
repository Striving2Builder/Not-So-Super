// Nightlife room surfaces: themed wall and floor textures (world-scale UVs, glowing trims in the
// emissive map), the static floor glow map, and the venue's light rig.
import * as THREE from 'three';
import { TAU, WALL_H, C, rnd, pickR, cnv, tex, speckle } from './nlkit.js';
// ------------------------------------------------------------------ room surfaces
// Walls get world-space UVs (1 texture tile = 3.4 m square, so v runs exactly floor→top and the
// painted trims/neon strips line up on every wall), and an emissive map for the glowing parts.
export function worldUV(mesh, su, sv) {
  const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, o = mesh.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + o.x, y = p.getY(i) + o.y, z = p.getZ(i) + o.z;
    const nx = Math.abs(n.getX(i)), nz = Math.abs(n.getZ(i));
    // wall tops read as an ink-black cap (the texture's top rows), like the comic floor plan
    if (nx < 0.5 && nz < 0.5) uv.setXY(i, 0.5, 0.997);
    else uv.setXY(i, (nx > 0.5 ? z : x) / su, Math.min(y / sv, 0.985));
  }
  uv.needsUpdate = true;
}
export const WS = 512 / WALL_H; // wall texture pixels per metre
export const WY = (m) => 512 - m * WS; // canvas y of a height on the wall

export function neonLine(c, y, color, w, blur) {
  c.save(); c.shadowColor = color; c.shadowBlur = blur; c.fillStyle = color;
  c.fillRect(-60, y - w / 2, 632, w); c.fillRect(-60, y - w / 2, 632, w);
  c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(-60, y - w / 6, 632, w / 3);
  c.restore();
}
export function coveWash(c, color, from, to, a) {
  const g = c.createLinearGradient(0, WY(from), 0, WY(to));
  g.addColorStop(0, color.replace('A', a)); g.addColorStop(1, color.replace('A', 0));
  c.fillStyle = g; c.fillRect(0, WY(from), 512, WY(to) - WY(from));
}
export function wainscot(c, top, wood, edge, rail) {
  c.fillStyle = wood; c.fillRect(0, WY(top), 512, WY(0) - WY(top));
  for (let x = 0; x < 512; x += 128) {
    c.strokeStyle = edge; c.lineWidth = 4; c.strokeRect(x + 14, WY(top - 0.12), 100, (top - 0.3) * WS);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 2; c.strokeRect(x + 19, WY(top - 0.17), 90, (top - 0.4) * WS);
  }
  c.fillStyle = rail; c.fillRect(0, WY(top + 0.07), 512, 0.07 * WS);
  c.fillStyle = 'rgba(255,240,180,.6)'; c.fillRect(0, WY(top + 0.07), 512, 2);
  c.fillStyle = '#050204'; c.fillRect(0, WY(0.08), 512, 0.08 * WS);
}
export function damask(c, y0, y1, bg, fg, cw = 64, ch = 96) {
  c.fillStyle = bg; c.fillRect(0, WY(y1), 512, WY(y0) - WY(y1));
  c.save(); c.beginPath(); c.rect(0, WY(y1), 512, WY(y0) - WY(y1)); c.clip();
  c.fillStyle = fg;
  for (let r = 0; r * ch < 600; r++) for (let q = -1; q <= 512 / cw; q++) {
    const cx = q * cw + (r % 2) * cw / 2, cy = WY(y1) + r * ch / 2;
    c.beginPath(); c.ellipse(cx, cy, 7, 17, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - 11, cy + 5, 5, 11, -0.7, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx + 11, cy + 5, 5, 11, 0.7, 0, TAU); c.fill();
    c.beginPath(); c.arc(cx, cy - 22, 3.5, 0, TAU); c.fill();
  }
  c.restore();
}

export const WALLS = {
  club: [
    (c) => {
      c.fillStyle = '#0b0816'; c.fillRect(0, 0, 512, 512);
      const y0 = WY(2.7), y1 = WY(0.18), D = 64;
      c.save(); c.beginPath(); c.rect(0, y0, 512, y1 - y0); c.clip();
      for (let r = -1; r * D / 2 < y1 - y0 + D; r++) for (let q = -1; q <= 8; q++) {
        const cx = q * D + ((r + 2) % 2) * D / 2, cy = y0 + r * D / 2;
        const g = c.createLinearGradient(cx - D / 4, cy - D / 4, cx + D / 4, cy + D / 4);
        g.addColorStop(0, '#3e3278'); g.addColorStop(1, '#171230');
        c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy - D / 2); c.lineTo(cx + D / 2, cy); c.lineTo(cx, cy + D / 2); c.lineTo(cx - D / 2, cy); c.closePath(); c.fill();
        c.strokeStyle = '#05030a'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#4a3f7a'; c.beginPath(); c.arc(cx, cy - D / 2, 2.5, 0, TAU); c.fill();
      }
      c.restore();
      c.fillStyle = '#3a3550'; c.fillRect(0, y0 - 3, 512, 3); c.fillRect(0, y1, 512, 3);
      c.fillStyle = '#05040a'; c.fillRect(0, 0, 512, y0 - 3);
      c.fillStyle = '#020104'; c.fillRect(0, y1 + 3, 512, 512);
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      coveWash(c, 'rgba(255,47,208,A)', 2.86, 1.0, 0.34);
      // vertical LED bars every 1.7 m: the walls are lit, never a black void
      for (const [x, col] of [[64, '#27e0ff'], [320, '#9d4dff']]) {
        c.save(); c.shadowColor = col; c.shadowBlur = 14; c.fillStyle = col; c.fillRect(x - 3, WY(2.7), 6, (2.7 - 0.3) * WS); c.restore();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - 1, WY(2.7), 2, (2.7 - 0.3) * WS);
      }
      neonLine(c, WY(2.86), '#ff2fd0', 5, 16);
      coveWash(c, 'rgba(39,224,255,A)', 0.1, 0.6, 0.22);
      neonLine(c, WY(0.1), '#27e0ff', 4, 14);
    },
  ],
  redlight: [
    (c) => {
      c.fillStyle = '#120605'; c.fillRect(0, 0, 512, 512);
      const cols = ['#4a1a16', '#3e1512', '#552019', '#3a1714', '#2e100e', '#5e231b'];
      for (let r = 0, y = 0; y < 512; r++, y += 12) {
        const off = (r % 2) * 16;
        for (let x = -32; x < 512; x += 32) { c.fillStyle = pickR(cols); c.fillRect(x + off + 1, y + 1, 30, 10); }
      }
      speckle(c, 512, 512, 1800, 0.08);
      let g = c.createLinearGradient(0, WY(1.2), 0, 512); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)');
      c.fillStyle = g; c.fillRect(0, WY(1.2), 512, 1.2 * WS);
      g = c.createLinearGradient(0, 0, 0, WY(2.6)); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 512, WY(2.6));
      // drips of grime
      for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(Math.random() * 512, WY(2.9), 3 + Math.random() * 4, rnd(40, 200)); }
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      coveWash(c, 'rgba(255,34,68,A)', 2.95, 1.3, 0.34);
      neonLine(c, WY(2.95), '#ff2244', 5, 18);
    },
  ],
  gentlemens: [
    (c) => {
      c.fillStyle = '#16060f'; c.fillRect(0, 0, 512, 512);
      damask(c, 1.12, 2.85, '#3a0c2c', '#58184a');
      wainscot(c, 1.05, '#2a120b', '#4a2414', '#b8902a');
      c.fillStyle = '#b8902a'; c.fillRect(0, WY(2.92), 512, 0.07 * WS);
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#3a2a08'; c.fillRect(0, WY(1.12), 512, 0.07 * WS); c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      coveWash(c, 'rgba(255,68,204,A)', 3.3, 1.4, 0.3);
      neonLine(c, WY(3.3), '#ff44cc', 3, 12);
    },
  ],
  casino: [
    (c) => {
      c.fillStyle = '#12060a'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#4d0a16'; c.fillRect(0, WY(2.85), 512, (2.85 - 1.1) * WS);
      c.save(); c.beginPath(); c.rect(0, WY(2.85), 512, (2.85 - 1.1) * WS); c.clip();
      c.strokeStyle = '#8a6a22'; c.lineWidth = 2;
      for (let x = -512; x < 1024; x += 64) {
        c.beginPath(); c.moveTo(x, WY(2.85)); c.lineTo(x + 300, WY(2.85) + 300); c.stroke();
        c.beginPath(); c.moveTo(x, WY(2.85)); c.lineTo(x - 300, WY(2.85) + 300); c.stroke();
      }
      c.fillStyle = '#b08a30';
      for (let x = 0; x < 512; x += 64) for (let y = WY(2.85); y < WY(1.1); y += 64) { c.beginPath(); c.arc(x + 32, y, 5, 0, TAU); c.fill(); c.beginPath(); c.arc(x, y + 32, 5, 0, TAU); c.fill(); }
      c.restore();
      wainscot(c, 1.05, '#1f0d06', '#3e1d0c', '#c09a34');
      c.fillStyle = '#c09a34'; c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      c.fillStyle = '#0c0306'; c.fillRect(0, 0, 512, WY(2.92));
    },
    (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
      c.fillStyle = '#4a3408'; c.fillRect(0, WY(1.12), 512, 0.07 * WS); c.fillRect(0, WY(2.92), 512, 0.07 * WS);
      coveWash(c, 'rgba(255,200,100,A)', 3.4, 1.3, 0.4);
    },
  ],
};

// floors: [tile size in metres, painter]
export const FLOORS = {
  club: [3, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 128, y = j * 128, g = c.createLinearGradient(x, y, x + 128, y + 128);
      g.addColorStop(0, '#2c2650'); g.addColorStop(0.5, '#15122c'); g.addColorStop(1, '#1f1a3c');
      c.fillStyle = g; c.fillRect(x + 2, y + 2, 124, 124);
    }
    speckle(c, 512, 512, 900, 0.05);
  }],
  redlight: [4, (c) => {
    c.fillStyle = '#0c0504'; c.fillRect(0, 0, 512, 512);
    const cols = ['#2b140f', '#24110c', '#301812', '#27120d'];
    for (let y = 0; y < 512; y += 28) {
      let x = -rnd(0, 300);
      while (x < 512) {
        const L = rnd(160, 360); c.fillStyle = pickR(cols); c.fillRect(x + 1, y + 1, L - 2, 26);
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
        for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(x, y + 4 + k * 6 + rnd(-2, 2)); c.lineTo(x + L, y + 4 + k * 6 + rnd(-2, 2)); c.stroke(); }
        x += L;
      }
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,120,120,.05)'; c.fillRect(rnd(0, 512), 0, rnd(20, 60), 512); }
    speckle(c, 512, 512, 800, 0.06);
  }],
  gentlemens: [3, (c) => {
    // plush plum carpet: a quiet lattice, no bright dots (characters must pop off it)
    c.fillStyle = '#2a0c26'; c.fillRect(0, 0, 512, 512);
    speckle(c, 512, 512, 4000, 0.04, 2);
    c.strokeStyle = '#3a1432'; c.lineWidth = 3;
    for (let x = -512; x <= 512; x += 128) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 512, 512); c.stroke();
      c.beginPath(); c.moveTo(x + 512, 0); c.lineTo(x, 512); c.stroke();
    }
    c.fillStyle = '#3a1030';
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) {
      for (const [dx, dy] of [[0, 0], [64, 64]]) { c.beginPath(); c.arc(x + dx, y + dy, 9, 0, TAU); c.fill(); }
    }
    c.fillStyle = '#5a4020';
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) for (const [dx, dy] of [[0, 0], [64, 64]]) { c.beginPath(); c.arc(x + dx, y + dy, 3, 0, TAU); c.fill(); }
  }],
  casino: [3.6, (c) => {
    c.fillStyle = '#360810'; c.fillRect(0, 0, 512, 512);
    speckle(c, 512, 512, 3000, 0.05, 2);
    for (let x = 0; x <= 512; x += 128) for (let y = 0; y <= 512; y += 128) {
      for (const [dx, dy] of [[0, 0], [64, 64]]) {
        const cx = x + dx, cy = y + dy;
        c.strokeStyle = '#5a3a18'; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, 26, 0, TAU); c.stroke();
        c.strokeStyle = '#1a3a36'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.stroke();
        c.fillStyle = '#5a4020'; for (let a = 0; a < 8; a++) { c.beginPath(); c.arc(cx + Math.cos(a * TAU / 8) * 38, cy + Math.sin(a * TAU / 8) * 38, 4, 0, TAU); c.fill(); }
        c.fillStyle = '#2a0408'; c.beginPath(); c.arc(cx, cy, 8, 0, TAU); c.fill();
      }
    }
    c.strokeStyle = 'rgba(20,60,56,.35)'; c.lineWidth = 3;
    for (let x = 0; x <= 512; x += 64) { c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 30, 128, x - 30, 384, x, 512); c.stroke(); }
  }],
};

export function styleRoom(zn, k) {
  const [wallAlb, wallEm] = WALLS[k];
  const wm = zn.wallMat;
  wm.color.set(0xffffff);
  const cap = (c, col) => { c.fillStyle = col; c.fillRect(0, 0, 512, 5); };
  wm.map = tex(cnv(512, 512, (c) => { wallAlb(c); cap(c, '#0c070c'); }), { repeat: true });
  wm.emissive = C(0xffffff); wm.emissiveMap = tex(cnv(512, 512, (c) => { wallEm(c); cap(c, '#000'); }), { repeat: true });
  wm.needsUpdate = true;
  for (const c of zn.colliders) if (c.wall && c.mesh) worldUV(c.mesh, WALL_H, WALL_H);
  const [T, paint] = FLOORS[k];
  let floorMat = null;
  const floors = [];
  zn.scene.traverse((o) => {
    if (!o.isMesh || o.geometry.type !== 'PlaneGeometry' || !o.material.map || o.position.y > 0.01 || Math.abs(o.rotation.x + Math.PI / 2) > 1e-3) return;
    floorMat = o.material; floors.push(o);
    const uv = o.geometry.attributes.uv, p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + o.position.x) / T, (p.getY(i) - o.position.z) / T);
    uv.needsUpdate = true;
  });
  if (floorMat) {
    floorMat.map.dispose();
    floorMat.map = tex(cnv(512, 512, paint), { repeat: true });
    floorMat.color.set(0xffffff);
    floorMat.needsUpdate = true;
  }
  // Darker ambient: contrast comes from the neon, not from flat fill light.
  const amb = { club: [0.45, 0.12], redlight: [0.55, 0.14], gentlemens: [0.55, 0.14], casino: [0.7, 0.2] }[k];
  for (const o of zn.scene.children) {
    if (o.isHemisphereLight) o.intensity = amb[0];
    else if (o.isAmbientLight) o.intensity = amb[1];
  }
  // Three point lights, not five: every lit pixel pays for each one. Two light the hall (driven
  // by the show); the third follows her, so wherever she goes (back room, office) she's in the neon.
  const pl = [];
  zn.scene.traverse((o) => { if (o.isPointLight) pl.push(o); });
  for (const l of pl) if (!zn.plights.includes(l) || zn.plights.indexOf(l) > 2) l.visible = false;
  const follow = zn.plights[2];
  follow.distance = 11; follow.decay = 1.2; follow.intensity = 16; follow.color = C(zn.V.lights[0]);
  // no black void past the walls: a deep neon-tinted night instead
  const bg = { club: 0x1c0d38, redlight: 0x2a0a12, gentlemens: 0x260b28, casino: 0x22120a }[k];
  zn.scene.background = C(bg); zn.scene.fog.color = C(bg);
  return { floorMat, floors, follow, hall: zn.plights.slice(0, 2) };
}

// Static light pools and sign reflections are painted into one glow texture on the floor
// (emissive, second UV set spanning the whole building), so they cost no overdraw at all.
export const LM = { x0: -15, z0: -22, w: 40, d: 36, px: 512 };
export function paintFloorGlow(room, list) {
  if (!room.floorMat || !list.length) return;
  const c = cnv(LM.px, LM.px), g = c.getContext('2d'), sx = LM.px / LM.w, sz = LM.px / LM.d;
  g.fillStyle = '#000'; g.fillRect(0, 0, LM.px, LM.px);
  g.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const col = C(p.color).convertLinearToSRGB();
    const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
    g.save();
    g.translate((p.x - LM.x0) * sx, (p.z - LM.z0) * sz);
    g.rotate(p.rot || 0);
    g.scale(p.rx * sx, p.rz * sz);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, `rgba(${rgb},${Math.min(1, p.k * 1.6)})`); gr.addColorStop(0.3, `rgba(${rgb},${p.k * 0.8})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
    g.restore();
  }
  const t = tex(c);
  t.channel = 1;
  for (const f of room.floors) {
    const pos = f.geometry.attributes.position, uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + f.position.x, z = -pos.getY(i) + f.position.z;
      uv1[i * 2] = (x - LM.x0) / LM.w; uv1[i * 2 + 1] = 1 - (z - LM.z0) / LM.d;
    }
    f.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  }
  const m = room.floorMat;
  m.emissive = C(0xffffff); m.emissiveMap = t; m.emissiveIntensity = 1;
  m.needsUpdate = true;
}
