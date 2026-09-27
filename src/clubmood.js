// Mood for the premade clubs: coloured lighting from the club's own light list, fake light pools
// and beams, neon that glows, haze, a grade, and characters that pop off the room (rim light,
// contact shadows). Everything here is cheap on a phone: the pools, beams and shadows are one
// draw call each, and only a few real lights exist; they follow her round the club.
import * as THREE from 'three';
import { quality } from './settings.js';
import { DOWN } from './clubgeo.js';

// Per club: grade (exposure), haze colour/density, ambient fill, rim colour, pool/beam/neon strength.
const MOODS = {
  triangle: { exposure: 1.25, haze: 0x12081e, density: 0.03, sky: 0x5a6cff, ground: 0x3a1638, hemi: 0.55, amb: 0.1, rim: 0x8fe0ff, pools: 0.8, beams: 0.5, neon: 3, light: 1 },
  clubhouse: { exposure: 1.05, haze: 0x0c0608, density: 0.035, sky: 0x8a90ff, ground: 0x2a0e0a, hemi: 0.3, amb: 0.05, rim: 0xffc070, pools: 0.7, beams: 0.45, neon: 3, light: 1 },
  stripclub: { exposure: 1.2, haze: 0x1a0614, density: 0.032, sky: 0xff4fb0, ground: 0x2a0a1a, hemi: 0.45, amb: 0.08, rim: 0xff90e0, pools: 0.85, beams: 0.55, neon: 2.5, light: 1.1 },
};
const DEFAULT_MOOD = MOODS.triangle;

// real point lights (besides her own key light), by profile
const LIGHTS = { high: 5, balanced: 3, saver: 2 };

let _radial = null, _beam = null;
/** Soft round spot: white centre fading to transparent. */
function radialTex() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}
/** Light shaft: bright core down the middle, fading out sideways and toward the floor. */
function beamTex() {
  if (_beam) return _beam;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d'), d = x.createImageData(64, 128);
  for (let j = 0; j < 128; j++) for (let i = 0; i < 64; i++) {
    const u = Math.abs(i / 63 * 2 - 1), v = j / 127; // v: 0 = top (the lamp)
    const a = Math.pow(1 - u, 2.2) * (0.25 + 0.75 * Math.pow(1 - v, 1.4)) * Math.min(1, v * 8);
    const k = (j * 64 + i) * 4;
    d.data[k] = d.data[k + 1] = d.data[k + 2] = 255; d.data[k + 3] = Math.round(a * 255);
  }
  x.putImageData(d, 0, 0);
  _beam = new THREE.CanvasTexture(c);
  return _beam;
}

/** Club lights (metadata) plus glowing neon, merged where they bunch up. */
function lightSources(club, chunks) {
  const raw = club.meta.lights.map((l) => ({ pos: new THREE.Vector3(...l.pos), color: new THREE.Color(...l.color), power: l.power, spot: l.type === 'SPOT' }));
  // neon/emissive surfaces light the room too (the Velvet Lounge's pink tubes have no lamp of their own)
  const box = new THREE.Box3(), c = new THREE.Vector3();
  for (const m of chunks) {
    const mat = m.material, e = mat.emissive;
    if (!e || Math.max(e.r, e.g, e.b) * (mat.emissiveIntensity || 1) < 0.15) continue;
    box.copy(m.geometry.boundingBox);
    const size = box.getSize(c).length();
    if (size < 0.4) continue;
    box.getCenter(c);
    const col = e.clone();
    if (Math.max(col.r, col.g, col.b) > 0.9 && Math.min(col.r, col.g, col.b) > 0.8 && mat.color) col.lerp(mat.color, 0.6); // white × texture: guess from the base colour
    raw.push({ pos: c.clone(), color: col, power: 40 * Math.min(size, 5), spot: false, neon: true });
  }
  raw.sort((a, b) => b.power - a.power);
  const out = [];
  for (const l of raw) {
    const near = out.find((o) => o.pos.distanceTo(l.pos) < 2.2);
    if (near) {
      const w = l.power / (near.power + l.power);
      near.color.lerp(l.color, w); near.power += l.power; near.spot = near.spot || l.spot;
    } else out.push({ ...l, color: l.color.clone() });
  }
  return out.slice(0, 48);
}

export class ClubMood {
  constructor(zone, key) {
    this.z = zone;
    const M = (this.M = MOODS[key] || DEFAULT_MOOD);
    const S = zone.scene, club = zone.club, q = quality();
    this.chunks = club.scene.userData.chunks || [];

    // grade + haze. The background matches the haze so sliced-off walls fade into it.
    const r = zone.renderer;
    this.prevTone = [r.toneMapping, r.toneMappingExposure];
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = M.exposure;
    S.background = new THREE.Color(M.haze);
    S.fog = new THREE.FogExp2(M.haze, M.density);

    // neon glows (once per cached building)
    for (const m of this.chunks) {
      const mat = m.material;
      if (mat.userData.neon || !mat.emissive || mat.emissive.getHex() === 0) continue;
      mat.userData.neon = true;
      mat.emissiveIntensity = (mat.emissiveIntensity || 1) * M.neon;
    }

    // low fill so the pools and lamps carry the room; hemisphere gives walls a coloured gradient
    S.add(new THREE.HemisphereLight(M.sky, M.ground, M.hemi));
    S.add(new THREE.AmbientLight(0xffffff, M.amb));

    const src = (this.sources = lightSources(club, this.chunks));
    // where each source lands on the floor below it
    const ray = new THREE.Raycaster(); ray.firstHitOnly = true; ray.far = 14;
    for (const s of src) {
      ray.set(s.pos.clone().setY(s.pos.y + 0.05), DOWN);
      const h = ray.intersectObject(club.collider)[0];
      s.floor = h && h.face.normal.y > 0.6 ? h.point.clone() : null;
    }
    this.buildPools(src.filter((s) => s.floor));
    this.buildBeams(src.filter((s) => s.floor && s.pos.y - s.floor.y > 1.8 && (s.spot || s.power >= 150)).slice(0, 8));

    // a few real lights: they move to the strongest sources near her as she walks the club
    this.slots = [];
    for (let i = 0; i < (LIGHTS[q.id] || 3); i++) {
      const l = new THREE.PointLight(0xffffff, 0, 13, 1.5);
      S.add(l);
      this.slots.push({ l, src: null, want: null });
    }
    zone.plights = this.slots.map((s) => s.l); // (nightlife hooks animate these)
    // her own soft key light, from over the camera's shoulder: she reads in any corner
    this.key = new THREE.PointLight(0xfff0e0, 2.2, 4.5, 1.2);
    S.add(this.key);
    this.pickT = 0;

    this.buildBlobs();
    this.rimU = { value: new THREE.Color(M.rim) };
    this.rimmed = new WeakSet();
    this.vignette();
  }

  // ---------------------------------------------------------------- fake lighting
  /** Coloured pools of light on the floor under every lamp: one additive mesh. */
  buildPools(src) {
    const pos = [], uv = [], col = [], idx = [];
    for (const s of src) {
      const r = THREE.MathUtils.clamp(1.3 + Math.sqrt(s.power) * 0.13, 1.6, 4.2);
      const k = THREE.MathUtils.clamp(0.25 + s.power / 400, 0.3, 0.65) * this.M.pools;
      const n = pos.length / 3, y = s.floor.y + 0.03;
      for (const [dx, dz, u, v] of [[-r, -r, 0, 0], [r, -r, 1, 0], [r, r, 1, 1], [-r, r, 0, 1]]) {
        pos.push(s.floor.x + dx, y, s.floor.z + dz); uv.push(u, v); col.push(s.color.r * k, s.color.g * k, s.color.b * k);
      }
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map: radialTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.pools = new THREE.Mesh(g, mat);
    this.pools.renderOrder = 2;
    this.z.scene.add(this.pools);
  }

  /** Soft light shafts from the lamps down to the floor, turned to face the camera every frame. */
  buildBeams(src) {
    if (!src.length) return;
    this.beamSrc = src;
    const n = src.length, g = new THREE.BufferGeometry();
    const uv = [], col = [], idx = [];
    for (let i = 0; i < n; i++) {
      const c = src[i].color, k = this.M.beams * THREE.MathUtils.clamp(src[i].power / 600, 0.5, 1);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let j = 0; j < 4; j++) col.push(c.r * k, c.g * k, c.b * k);
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ map: beamTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
    this.beams = new THREE.Mesh(g, mat);
    this.beams.frustumCulled = false; // vertices move every frame
    this.beams.renderOrder = 3;
    this.z.scene.add(this.beams);
  }

  updateBeams(cam) {
    if (!this.beams) return;
    const p = this.beams.geometry.attributes.position, a = p.array;
    const side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), to = new THREE.Vector3();
    this.beamSrc.forEach((s, i) => {
      to.subVectors(cam.position, s.floor); to.y = 0;
      side.crossVectors(up, to).normalize();
      // a shaft right by the camera would wash the whole screen (and cost a screenful of fill)
      const near = THREE.MathUtils.smoothstep(Math.hypot(to.x, to.z), 2.5, 5);
      const top = 0.18 * near, bot = THREE.MathUtils.clamp(Math.sqrt(s.power) * 0.06, 0.9, 2.2) * near;
      const T = s.pos, B = s.floor, k = i * 12;
      a[k] = T.x - side.x * top; a[k + 1] = T.y; a[k + 2] = T.z - side.z * top;
      a[k + 3] = T.x + side.x * top; a[k + 4] = T.y; a[k + 5] = T.z + side.z * top;
      a[k + 6] = B.x + side.x * bot; a[k + 7] = B.y + 0.05; a[k + 8] = B.z + side.z * bot;
      a[k + 9] = B.x - side.x * bot; a[k + 10] = B.y + 0.05; a[k + 11] = B.z - side.z * bot;
    });
    p.needsUpdate = true;
  }

  /** Contact shadows under everyone: one instanced mesh. */
  buildBlobs() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: null, map: radialTex(), transparent: true, opacity: 0.7, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, 24);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.blobs.count = 0;
    this.z.scene.add(this.blobs);
  }

  /** Everyone who needs a shadow and a rim: her, guards, boss, informant, captives. */
  people() {
    const z = this.z, out = [z.hero];
    for (const g of z.guards) out.push(g.mesh);
    if (z.boss) out.push(z.boss);
    if (z.informant) out.push(z.informant.mesh);
    for (const c of z.captives) out.push(c.person);
    for (const x of z.extraPeople ? z.extraPeople() : []) out.push(x);
    return out.filter((o) => o && o.visible !== false);
  }

  // ---------------------------------------------------------------- rim light
  /** Fresnel rim in the club's colour on a character's materials (cloned: models share them). */
  rim(root) {
    if (this.rimmed.has(root)) return;
    this.rimmed.add(root);
    const U = this.rimU, done = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const patch = (m) => {
        if (!m || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial)) return m;
        if (done.has(m)) return done.get(m);
        const c = m.clone(), prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
        c.onBeforeCompile = (sh, r) => {
          if (prev) prev.call(c, sh, r);
          sh.uniforms.uRim = U;
          sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
            '{ float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); outgoingLight += uRim * (rimF * rimF * rimF); }\n#include <opaque_fragment>');
        };
        c.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|clubrim';
        done.set(m, c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(patch) : patch(o.material);
    });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const z = this.z, h = z.hero.position;
    // lights: every so often, re-pick the strongest sources near her; fade across on a change
    if ((this.pickT -= dt) <= 0) {
      this.pickT = 0.4;
      const score = (s) => s.power / (1 + s.pos.distanceToSquared(h) / 30);
      const best = this.sources.filter((s) => Math.abs(s.pos.y - h.y) < 6).sort((a, b) => score(b) - score(a)).slice(0, this.slots.length);
      const free = best.filter((s) => !this.slots.some((sl) => sl.src === s));
      for (const sl of this.slots) {
        if (sl.src && best.includes(sl.src)) sl.want = sl.src;
        else sl.want = free.shift() || null;
      }
    }
    const snap = !this.started; // first frame: lights straight on, no fade-in
    this.started = true;
    for (const sl of this.slots) {
      const l = sl.l;
      if (snap && sl.want) { sl.src = sl.want; l.position.copy(sl.src.pos); l.color.copy(sl.src.color); l.intensity = 0; }
      if (sl.src !== sl.want) {
        l.intensity = Math.max(0, l.intensity - dt * 60);
        if (l.intensity <= 0) { sl.src = sl.want; if (sl.src) { l.position.copy(sl.src.pos); l.color.copy(sl.src.color); } }
      } else if (sl.src) {
        const target = THREE.MathUtils.clamp(sl.src.power / 14, 8, 24) * this.M.light;
        l.intensity = snap ? target : Math.min(target, l.intensity + dt * 60);
      }
    }
    // her key light hangs above and in front of her, on the camera's side
    const cam = z.cam;
    // (chest height, 1.6 m toward the camera: it lights her front and barely touches the floor)
    const dx = cam.position.x - h.x, dz = cam.position.z - h.z, d = Math.hypot(dx, dz) || 1;
    this.key.position.set(h.x + dx / d * 1.6, h.y + 1.7, h.z + dz / d * 1.6);

    // rim everyone (new cast members get patched the first time they show up) + contact shadows
    const ppl = this.people(), mtx = new THREE.Matrix4(), s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
    let n = 0;
    for (const o of ppl) {
      this.rim(o);
      if (n >= 24) continue;
      const w = o.getWorldPosition(p);
      const k = o === z.hero ? 1.25 : 1.1;
      mtx.compose(p.set(w.x, w.y + 0.025, w.z), q, s.set(k, 1, k));
      this.blobs.setMatrixAt(n++, mtx);
    }
    this.blobs.count = n;
    this.blobs.instanceMatrix.needsUpdate = true;
    this.updateBeams(cam);
  }

  /** Skip merged chunks lying wholly above the slice plane (ceilings, upper floors). */
  cull(clipY) {
    for (const m of this.chunks) m.visible = m.userData.minY < clipY;
  }

  vignette() {
    const host = document.getElementById('three-host');
    if (!host) return;
    const v = (this.vig = document.createElement('div'));
    v.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 70% at 50% 55%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)';
    host.appendChild(v);
  }

  dispose() {
    const r = this.z.renderer;
    if (r) [r.toneMapping, r.toneMappingExposure] = this.prevTone;
    if (this.vig) this.vig.remove();
    for (const m of this.chunks) m.visible = true;
    for (const o of [this.pools, this.beams, this.blobs]) if (o) { o.geometry.dispose(); o.material.dispose(); }
  }
}
