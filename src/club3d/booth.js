// The DJ booth, dressed (round 11 L2a; critic L-1: "a flat orange slab on a black box", "the
// NIGHTCLUB neon half covered by her"): the glowing slab becomes a dark deck top with a lit lip and a
// chrome rail, two decks, a mixer with lit meters, a laptop, speaker cones on the stacks, and the
// club's name twice across the booth front so it reads either side of her. Static boxes go through
// the zone's merge; the decks' faces and the cones are one canvas, one draw; the lights ride the
// kit's glow batch. Runs after buildHall, before bakeStatic / buildKit. Returns step(t, B).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../look3d.js';
import { cnv, tex, floorQ, wallQ, neonText, neonPath, boltPath, TAU } from '../nlkit.js';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** One canvas: a speaker cone (left half) and the mixer's face (right half). */
function gearCanvas(accent) {
  return cnv(256, 128, (c) => {
    // the cone: surround, cone, dust cap
    c.fillStyle = '#050407'; c.fillRect(0, 0, 128, 128);
    const g = c.createRadialGradient(64, 64, 6, 64, 64, 60);
    g.addColorStop(0, '#3a3644'); g.addColorStop(0.22, '#121018'); g.addColorStop(0.75, '#22202a'); g.addColorStop(0.86, '#0a090d'); g.addColorStop(0.95, '#4a4656'); g.addColorStop(1, '#050407');
    c.fillStyle = g; c.beginPath(); c.arc(64, 64, 60, 0, TAU); c.fill();
    c.strokeStyle = accent; c.globalAlpha = 0.7; c.lineWidth = 3; c.beginPath(); c.arc(64, 64, 61, 0, TAU); c.stroke(); c.globalAlpha = 1;
    // the mixer: a dark panel, rows of knobs, two meters, faders
    c.fillStyle = '#121119'; c.fillRect(128, 0, 128, 128);
    c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(130, 2, 124, 124);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      c.fillStyle = '#c8ccd8'; c.beginPath(); c.arc(146 + k * 14 + (k > 1 ? 40 : 0), 18 + r * 16, 4.5, 0, TAU); c.fill();
      c.fillStyle = '#000'; c.fillRect(145 + k * 14 + (k > 1 ? 40 : 0), 14 + r * 16, 2, 4);
    }
    for (const x of [184, 196]) for (let i = 0; i < 9; i++) { c.fillStyle = i > 6 ? '#ff3a3a' : i > 4 ? '#ffd84d' : '#3aff8a'; c.fillRect(x, 64 - i * 6, 8, 4); }
    for (const x of [148, 168, 216, 236]) { c.fillStyle = '#000'; c.fillRect(x - 1, 74, 3, 40); c.fillStyle = '#e8e8f0'; c.fillRect(x - 5, 84 + (x % 3) * 8, 11, 6); }
    c.fillStyle = '#000'; c.fillRect(170, 116, 46, 3); c.fillStyle = '#e8e8f0'; c.fillRect(186, 112, 12, 10);
  });
}

/** The booth's name panel, the club's name at each end (she stands in the middle) and a bolt between. */
function frontCanvas(name, color) {
  return cnv(1024, 128, (c) => {
    c.fillStyle = '#05040a'; c.fillRect(0, 0, 1024, 128);
    c.strokeStyle = color; c.globalAlpha = 0.5; c.lineWidth = 4; c.strokeRect(8, 8, 1008, 112); c.globalAlpha = 1;
    for (const x of [230, 794]) neonText(c, name, x, 66, 64, color, { maxW: 400 });
    neonPath(c, '#ffe14d', 4, boltPath(c, 512, 64, 40));
  });
}

export function dressBooth(zn, plan, M, X) {
  const V = plan.V, S = zn.scene, B = V.booth, acc = V.accent[0], acc2 = V.accent[1];
  const top = B.round ? 1.26 : 1.3, fz = B.round ? B.z + B.w / 2 : B.z + B.d / 2;
  // the slab: a dark deck top with the accent kept only as a low glow
  for (const m of zn._static || []) {
    const p = m.geometry?.parameters;
    if (m.isMesh && p && m.geometry.type === 'BoxGeometry' && Math.abs(m.position.y - 1.25) < 0.01 && Math.abs(p.width - (B.w - 0.2)) < 0.01 && Math.abs(p.height - 0.1) < 0.01) {
      m.material = toon(0x26232f, {}, { halftone: 0.3 }); // (any emissive here reads as the old flat slab)
    }
  }
  // the front panel: the club's name twice (the old single name hid behind her)
  if (!B.round) {
    S.traverse((o) => {
      const im = o.isMesh && o.material?.map?.image;
      if (im && im.width === 512 && im.height === 96) o.material.map = tex(frontCanvas((zn.clubName || zn.zone?.venue || 'CLUB').toUpperCase(), hex(acc)));
    });
  }
  // lit lips: along the top front edge and the kick at the floor, a chrome rail on the top
  const lights = [];
  if (B.round) {
    lights.push(X.glow.push(new THREE.TorusGeometry(B.w / 2 + 0.07, 0.025, 4, 48).rotateX(Math.PI / 2).translate(B.x, 1.2, B.z), acc, 0.9));
    lights.push(X.glow.push(new THREE.TorusGeometry(B.w / 2 + 0.22, 0.03, 4, 48).rotateX(Math.PI / 2).translate(B.x, 0.06, B.z), acc2, 0.8));
  } else {
    lights.push(X.glow.push(new THREE.BoxGeometry(B.w, 0.045, 0.045).translate(B.x, 1.19, fz + 0.04), acc, 0.95));
    lights.push(X.glow.push(new THREE.BoxGeometry(B.w + 0.1, 0.05, 0.05).translate(B.x, 0.05, fz + 0.05), acc2, 0.85));
    zn.box(B.w - 0.1, 0.05, 0.05, B.x, top + 0.02, fz - 0.08, M.chrome, { collide: false });
    for (const s of [-1, 1]) lights.push(X.glow.push(new THREE.BoxGeometry(0.045, 1.15, 0.045).translate(B.x + s * (B.w / 2 + 0.01), 0.62, fz + 0.04), acc2, 0.7));
  }
  // the gear on top: two decks, the mixer between, a laptop on a stand (the DJs stand behind it)
  const gz = B.round ? B.z : B.z - 0.15, dx = B.round ? 0.75 : Math.min(1.35, B.w * 0.17);
  const faces = [];
  for (const s of [-1, 1]) {
    const x = B.x + s * dx;
    zn.box(0.66, 0.09, 0.52, x, top + 0.045, gz, M.steel, { collide: false });
    zn.cyl(0.21, 0.21, 0.025, x - 0.05, top + 0.1, gz, M.black);
    X.glow.push(floorQ(x - 0.05, gz, 0.13, 0.13, top + 0.115), s > 0 ? acc : acc2, 0.9);  // the label, lit
    X.glow.push(floorQ(x + 0.24, gz + 0.16, 0.06, 0.06, top + 0.095), 0xff3a3a, 0.9);   // start / stop
  }
  zn.box(0.44, 0.12, 0.48, B.x, top + 0.06, gz, M.black, { collide: false });
  const mf = new THREE.PlaneGeometry(0.42, 0.46).rotateX(-Math.PI / 2).translate(B.x, top + 0.125, gz);
  const uvM = mf.attributes.uv; for (let i = 0; i < uvM.count; i++) uvM.setX(i, 0.5 + uvM.getX(i) * 0.5);
  faces.push(mf);
  const lx = B.x + (B.round ? -1.7 : Math.min(2.6, B.w * 0.33));
  zn.box(0.08, 0.16, 0.08, lx, top + 0.08, gz, M.steel, { collide: false });
  zn.box(0.38, 0.02, 0.26, lx, top + 0.17, gz, M.chrome, { collide: false });
  const lid = zn.box(0.38, 0.25, 0.02, lx, top + 0.3, gz + 0.12, M.chrome, { collide: false });
  lid.rotation.x = 0.25;
  X.glow.push(wallQ(lx, top + 0.3, gz + 0.16, 0.09, 0.09, 0), 0xffffff, 0.8);                 // the sticker on its back, lit by the screen
  X.glow.push(wallQ(lx, top + 0.45, gz + 0.05, 0.5, 0.25, 0), 0x9fd8ff, 0.25);               // its screen's spill
  // speaker cones on the two stacks either side (the straight booth's)
  if (!B.round) {
    for (const s of [-1, 1]) {
      const x = B.x + s * (B.w / 2 + 1.0), z = B.z - 0.3 + 0.61;
      for (const [y, r] of [[0.62, 0.44], [1.5, 0.44], [2.22, 0.24]]) {
        const q = new THREE.PlaneGeometry(r * 2, r * 2).translate(x, y, z);
        const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
        faces.push(q);
      }
      lights.push(X.glow.push(new THREE.BoxGeometry(1.2, 0.04, 0.04).translate(x, 2.6, z), acc, 0.7));
    }
  }
  const fm = new THREE.Mesh(mergeGeometries(faces), new THREE.MeshBasicMaterial({ map: tex(gearCanvas(hex(acc))) }));
  fm.name = 'c3-booth'; S.add(fm);
  return (t, B2) => {
    if (!X.glow.col) return;
    const e = B2.pulse;
    for (let i = 0; i < lights.length; i++) X.glow.set(lights[i], 0.55 + 0.45 * (i % 2 ? e : 1 - e * 0.5));
  };
}
