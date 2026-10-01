// Vertical slice: the flight view rendered in real 3D with three.js, behind ?flight=3d (default
// OFF: the 2D canvas flight is untouched). A renderer swap, not a rewrite: the Overworld keeps
// simulating (hero, altitude bands, zones, nav, events); this module draws it as a 3D city with a
// chase camera, and a transparent 2D overlay keeps the comic extras (speed lines, WHOOSH!, edge
// markers, incident icons).
import * as THREE from 'three';
import { City3D, M, height3 } from './city3d.js';
import { Sky3D } from './sky3d.js';
import { FlyHero3D } from './herofly3d.js';
import { FlightCam3D } from './flightcam3d.js';
import { lookFrame } from './look3d.js';
import { drawEdgeMarkers } from './flightmarks.js';
import { setBandHeights, speedFraction, BANDS } from './flight.js';
import { DISTRICTS } from './data.js';
import { quality } from './settings.js';

/** Flight in 3D? Read once from the URL (?flight=3d). */
let on;
export function flight3dEnabled() {
  if (on === undefined) { try { on = new URLSearchParams(location.search).get('flight') === '3d'; } catch (e) { on = false; } }
  return on;
}

/**
 * 3D look tunables. Altitude bands are re-set for the taller 3D city: skim threads the street
 * canyons, cruise weaves between the towers, high patrol rides above the cloud deck.
 */
const LOOK3 = {
  bands: [110, 560, 1100],     // world units (×0.5 m)
  fog: [1100, 1600, 2400],     // fog far (m) per band
  beam: { radius: 7, height: 420, alpha: 0.45 },
  iconPx: 26,
};

let beamTex = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.7, 'rgba(255,255,255,.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

export class Flight3D {
  constructor(ow) {
    this.ow = ow;
    this.g = ow.g;
    setBandHeights(LOOK3.bands);
    this.scene = null;
    this.beams = new Map();
    this.frame = 0;
  }

  /** World height (units) of a building for collisions/perching in the 3D city. */
  heightOf(o) { return o.h3 ?? o.h; }

  /** The overworld's collision ceiling: in 3D the towers go much higher. */
  get maxBuilding() { return 900; }

  build() {
    const city = this.g.city;
    this.city = city;
    this.scene = new THREE.Scene();
    this.cam = new FlightCam3D(this.g.w / this.g.h);
    this.sky = new Sky3D(this.scene, city.W * M, city.H * M);
    this.city3 = new City3D(city, this.scene, { tileRes: quality().flyTileRes });
    this.hero = new FlyHero3D(this.scene);
    // a soft fill from the camera so she (and the façades facing us) never go to black at night
    this.fill = new THREE.DirectionalLight(0xffe8cc, 0.7);
    this.scene.add(this.fill, this.fill.target);
    for (const b of city.blocks) for (const o of b.b) height3(o, b.d);
  }

  enter() {
    const special = this.g.modes.special;
    special.initRenderer(); // the one WebGL renderer the 3D zones share
    this.renderer = special.renderer;
    if (!this.scene || this.city !== this.g.city) this.build();
    document.body.classList.add('fly3d');
    if (!this.dragHooked) {
      // drag anywhere on the 3D view (the stick and buttons sit above it) to orbit the camera
      this.dragHooked = true;
      let last = null;
      const host = document.getElementById('three-host');
      host.addEventListener('pointerdown', (e) => { if (document.body.classList.contains('fly3d')) last = e.clientX; });
      addEventListener('pointermove', (e) => { if (last !== null) { this.orbit(e.clientX - last); last = e.clientX; } });
      addEventListener('pointerup', () => { last = null; });
    }
    this.cam.placed = this.cam.lookPlaced = false; this.cam.yaw = null;
  }

  exit() { document.body.classList.remove('fly3d'); }

  steer(a) { return this.cam ? this.cam.steer(a) : a; }
  boost() { this.cam?.boost(); }

  /** Drag on the screen (not the stick): orbit the camera round her. */
  orbit(dx) { if (this.cam) this.cam.orbit += dx * 0.006; }

  syncBeams() {
    const ow = this.ow, seen = new Set();
    for (const z of ow.zones) {
      seen.add(z.uid);
      let b = this.beams.get(z.uid);
      if (!b) {
        const geo = new THREE.CylinderGeometry(LOOK3.beam.radius, LOOK3.beam.radius * 1.4, LOOK3.beam.height, 12, 1, true);
        geo.translate(0, LOOK3.beam.height / 2, 0);
        b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: beamTexture(), color: z.color, transparent: true, opacity: LOOK3.beam.alpha, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        b.renderOrder = 6;
        this.scene.add(b);
        this.beams.set(z.uid, b);
      }
      b.position.set(z.x * M, 0, z.y * M);
    }
    for (const [uid, b] of this.beams) if (!seen.has(uid)) { this.scene.remove(b); b.geometry.dispose(); b.material.dispose(); this.beams.delete(uid); }
  }

  /** Screen projection helpers for the 2D overlay (markers), in CSS px. */
  projector() {
    const cam = this.cam.cam, W = this.g.w, H = this.g.h, v = new THREE.Vector3();
    const proj = (x, y, z) => {
      v.set(x * M, z * M, y * M).project(cam);
      let sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      if (v.z > 1) { sx = W - sx; sy = H * 2; } // behind the camera: push it off the bottom edge
      return [sx, sy, v.z <= 1];
    };
    return { proj };
  }

  render(ctx) {
    const ow = this.ow, g = this.g, h = ow.hero, st = g.state, W = g.w, H = g.h;
    const dt = Math.min(0.05, (performance.now() - (this.lastT || performance.now())) / 1000);
    this.lastT = performance.now();
    this.frame++;
    const night = st ? st.night : 0.8, clock = st ? st.clock : 22 * 60;
    const frac = speedFraction(h);
    const D = DISTRICTS[ow.district];
    // ground (or roof) under her, for the contact shadow
    const b = ow.buildingAt(h.x, h.y), ground = b && this.heightOf(b) < h.z ? this.heightOf(b) : 0;
    this.hero.update(h, dt, ow.t, !!ow.diving, ground);
    const band = h.band ?? 1;
    this.cam.update(h, dt, frac, band === BANDS.length - 1 && !ow.diving, (x, y, z) => { const o = ow.buildingAt(x, y); return !!o && z < this.heightOf(o); });
    this.fill.position.copy(this.cam.cam.position); this.fill.target.position.copy(this.hero.group.position);
    const fogFar = LOOK3.fog[band] || 1600;
    this.sky.update(clock, night, D?.map, this.cam.cam.position, fogFar);
    this.city3.update(this.cam.cam, { far: fogFar, near: Math.min(700, fogFar * 0.5), night, frame: this.frame });
    this.syncBeams();
    // render
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    if (this.cam.cam.aspect !== W / H) { this.cam.cam.aspect = W / H; this.cam.cam.updateProjectionMatrix(); }
    lookFrame(r);
    r.render(this.scene, this.cam.cam);
    this.overlay(ctx, night);
  }

  /** The 2D comic layer over the 3D view: incident icons at the beam tops, edge markers, juice. */
  overlay(ctx, night) {
    const ow = this.ow, W = this.g.w, H = this.g.h, h = ow.hero;
    ctx.clearRect(0, 0, W, H);
    const P = this.projector(), hs = P.proj(h.x, h.y, h.z);
    ow.heroScreen = { x: hs[0], y: hs[1] };
    // incident icons over everything
    for (const z of ow.zones) {
      const [x, y, front] = P.proj(z.x, z.y, LOOK3.beam.height / M * 0.55);
      if (!front || x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ow.drawIcon(ctx, x, y, 11, z, ow.g.state && ow.g.state.locked(z.lockKey), z === ow.near);
    }
    ow.fx.draw(ctx, hs[0], hs[1], 1.2); // wind streaks, sonic-boom ring, launch burst
    ow.fx.drawComic(ctx, W / 2, H / 2, W, H, night);
    ow.heroArt.drawPops(ctx, hs[0], hs[1], Math.min(W, H) / 390);
    // off-screen markers: ground points projected to the screen (identity SX/SY), real distances
    const marks = [...ow.zones, ...ow.events.markers()];
    if (ow.nav.target) marks.push({ ...ow.nav.target, color: '#78ffc8', waypoint: true });
    const screen = marks.map((m) => { const [x, y] = P.proj(m.x, m.y, 0); return { ...m, x, y, dist: Math.hypot(m.x - h.x, m.y - h.y) }; });
    drawEdgeMarkers(ctx, { SX: (x) => x, SY: (y) => y, cx: W / 2, scy: H / 2 }, screen, h, W, H);
  }
}
