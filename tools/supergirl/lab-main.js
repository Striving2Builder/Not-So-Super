// Hero lab sheet (dev only): rows = flight states, columns = camera angles, rendered through the real
// flight code (FlyHero3D + her sharp pass + keyline), then a strip of her 2D-mode sprites (2D flight
// FlightHero, the brawler's side-on HeroSprite + ink, a portrait). window.__labDone = true when drawn.
import * as THREE from 'three';
import { loadHero, HeroSprite } from '/src/hero3d.js';
import { FlyHero3D } from '/src/herofly3d.js';
import { HeroPass, HERO_LAYER } from '/src/heropass3d.js';
import { lookFrame } from '/src/look3d.js';
import { FlightHero } from '/src/herofly.js';
import { inkOutline } from '/src/brawlsprite.js';

const Q = new URLSearchParams(location.search);
const T = 300; // tile, CSS px (rendered at 2x)
const DPR = 2;
const STATES = [
  { id: 'cruise', speed: 520 },
  { id: 'turnR', speed: 520, turn: 1 },
  { id: 'turnL', speed: 520, turn: -1, night: 1 },
  { id: 'boost', speed: 1150, boost: true },
  { id: 'climb', speed: 480, vz: 360 },
  { id: 'descend', speed: 480, vz: -360, night: 1 },
  { id: 'dive', speed: 600, dive: true },
  { id: 'slow', speed: 60 },
  { id: 'hover', speed: 0 },
];
// camera: azimuth off her tail (deg, + = her right), elevation (deg), distance (m), target 'body'|'head'
const CAMS = [
  { id: 'chase', az: 32, el: 14, d: 7.5 },
  { id: 'phone', az: 32, el: 14, d: 15 },
  { id: 'side', az: 90, el: 4, d: 7.5 },
  { id: 'front', az: 150, el: 10, d: 7.5 },
  { id: 'below', az: 30, el: -28, d: 7.5 },
  { id: 'head', az: 35, el: 12, d: 2.6, head: true },
  { id: 'face', az: 160, el: 8, d: 2.4, head: true },
];

const sheet = document.getElementById('sheet');
const only = Q.get('only');
const flyRows = only === 'sprite' ? [] : STATES;
const SPR_H = only === 'fly' ? 0 : 340;
sheet.width = (CAMS.length * T + 90) * DPR; sheet.height = (flyRows.length * T + SPR_H + 20) * DPR;
sheet.style.width = sheet.width / DPR + 'px';
const sg = sheet.getContext('2d');
sg.scale(DPR, DPR);
sg.fillStyle = '#222'; sg.fillRect(0, 0, sheet.width, sheet.height);

let renderer = null;
const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xffffff, 0x505a68, 1.25);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.3);
const fill = new THREE.DirectionalLight(0xffe8cc, 0.7);
scene.add(hemi, sun, sun.target, fill, fill.target);
for (const l of [hemi, sun, fill]) l.layers.enable(HERO_LAYER);
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const pass = new HeroPass();

function label(x, y, s) { sg.fillStyle = '#ddd'; sg.font = '12px sans-serif'; sg.fillText(s, x, y); }

async function main() {
  await loadHero();
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(DPR); renderer.setSize(T, T);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const fh = new FlyHero3D(scene);
  let first = true;
  for (let r = 0; r < flyRows.length; r++) {
    const S = flyRows[r];
    const night = S.night ? 1 : 0;
    scene.background = new THREE.Color(night ? '#1c1a3a' : '#7d9be0');
    sun.color.set(night ? '#8fa6ff' : '#fff4e0'); sun.intensity = night ? 0.7 : 2.3;
    hemi.color.set(night ? '#5a5ca8' : '#ffffff'); hemi.groundColor.set(night ? '#2a1e3a' : '#505a68'); hemi.intensity = night ? 0.55 : 1.25;
    const h = { x: 0, y: 0, z: 400, ang: 0, bank: 0, speed: S.speed, lean: 0, hover: S.speed < 110 ? 1 : 0, perch: null };
    // settle the state for 3 s (her pose blends ease in)
    const dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      const t = (first ? 0 : 0) + i * dt;
      const omega = (S.turn || 0) * 1.6;
      h.ang += omega * dt;
      h.bank += (Math.max(-1, Math.min(1, (omega * h.speed) / 1400)) - h.bank) * Math.min(1, dt * 6);
      h.z += (S.vz || 0) * dt;
      h.x += Math.cos(h.ang) * h.speed * dt; h.y += Math.sin(h.ang) * h.speed * dt;
      fh.update(h, dt, 10 + t, !!S.dive, 0, 0, !!S.boost);
    }
    first = false;
    if (fh.model) fh.pivot.traverse((o) => o.layers.set(HERO_LAYER));
    const P = fh.group.position.clone();
    if (r === 0) { const B = fh.model.bones, g = (n) => B[n].getWorldPosition(new THREE.Vector3()); const fw = new THREE.Vector3(1, 0, 0);
      const ang = (a, b) => +(Math.acos(g(b).sub(g(a)).normalize().dot(fw)) * 57.3).toFixed(1), up = (a, b) => +g(b).sub(g(a)).normalize().y.toFixed(2);
      document.title = JSON.stringify({ crown: [ang('Head', 'HeadTop_End'), up('Head', 'HeadTop_End')], neck: [ang('Neck', 'Head'), up('Neck', 'Head')], spine: [ang('Spine1', 'Spine2'), up('Spine1', 'Spine2')], hips: [ang('Hips', 'Spine'), up('Hips', 'Spine')] }); }
    const f = new THREE.Vector3(Math.cos(h.ang), 0, Math.sin(h.ang)), side = new THREE.Vector3(-f.z, 0, f.x);
    label(6, r * T + 20, S.id);
    for (let c = 0; c < CAMS.length; c++) {
      const C = CAMS[c];
      const tgt = P.clone();
      if (C.head && fh.model) fh.model.bones.Head.getWorldPosition(tgt);
      const az = (C.az * Math.PI) / 180, el = (C.el * Math.PI) / 180;
      const off = f.clone().multiplyScalar(-Math.cos(az) * Math.cos(el) * C.d).addScaledVector(side, Math.sin(az) * Math.cos(el) * C.d).add(new THREE.Vector3(0, Math.sin(el) * C.d, 0));
      cam.position.copy(tgt).add(off); cam.up.set(0, 1, 0); cam.lookAt(tgt); cam.updateProjectionMatrix();
      cam.layers.disable(HERO_LAYER);
      fill.position.copy(cam.position); fill.target.position.copy(P);
      sun.position.copy(P).add(new THREE.Vector3(-300, 400, 200)); sun.target.position.copy(P);
      fh.update(h, 0, 13, !!S.dive, 0, 0, !!S.boost); // (re-sync the cape light with the sun moved)
      lookFrame(renderer);
      renderer.render(scene, cam);
      const rad = C.head ? 1.0 : FlyHero3D.RADIUS * fh.size;
      pass.render(renderer, scene, cam, C.head ? tgt : P, rad, T, T, [4, 1], fh.keyline(night, 0));
      sg.drawImage(renderer.domElement, 90 + c * T, r * T, T, T);
      if (r === 0) label(90 + c * T + 6, 14, C.id);
    }
  }
  if (only !== 'fly') sprites(flyRows.length * T + 10);
  window.__labDone = true;
}

/** Her 2D-mode sprites through the real code paths. */
function sprites(y0) {
  label(6, y0 + 16, '2D flight');
  const fhr = new FlightHero();
  const c2 = document.createElement('canvas'); c2.width = c2.height = 300 * DPR;
  const g2 = c2.getContext('2d');
  const states = [{ ang: -Math.PI / 2, bank: 0, speed: 500, hover: 0 }, { ang: 0.4, bank: 0.7, speed: 500, hover: 0 }, { ang: 2.5, bank: 0, speed: 0, hover: 1 }];
  states.forEach((s, i) => {
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = '#6a7f9a'; g2.fillRect(0, 0, c2.width, c2.height);
    g2.scale(DPR, DPR);
    fhr.last = null;
    fhr.draw(g2, { x: 0, y: 0, z: 300, lean: 0, perch: null, ...s }, 150, 150, 0.9, { t: 1 + i, diving: false, rich: true, night: 0, dpr: DPR, max: 512 });
    sg.drawImage(c2, 90 + i * 220, y0, 210, 210);
  });
  // brawler: side-on, three-quarter turned, 3 px ink (as brawlactors.drawPlayerModel)
  const sp = new HeroSprite(220, 300);
  const poses = [['run', 0.4], ['punch', 1.5], ['kick2', 0.67], ['punch', 1.16], ['pose', 0.9]];
  const ink = document.createElement('canvas'); ink.width = 228; ink.height = 308;
  const copy = document.createElement('canvas'); copy.width = 220; copy.height = 300;
  poses.forEach(([n, t], i) => {
    sp.hero.pose(n, t);
    const img = sp.render({ view: 'side', yaw: Math.PI / 2 - 0.4, span: 2.6, lift: 0.12 });
    const cx = copy.getContext('2d'); cx.clearRect(0, 0, 220, 300); cx.drawImage(img, 0, 0);
    const ix = ink.getContext('2d'); ix.clearRect(0, 0, 228, 308);
    inkOutline(ix, copy, 220, 300, 3, 4, 4);
    const x = 90 + 3 * 220 + i * 165;
    sg.fillStyle = '#5a4a5a'; sg.fillRect(x, y0, 160, 218);
    sg.drawImage(ink, x, y0, 160, 218);
  });
  label(90 + 3 * 220, y0 + 232, 'brawler (HeroSprite side + ink)');
}

main().catch((e) => { console.error(e); document.title = 'ERR ' + e.message; window.__labDone = true; });
