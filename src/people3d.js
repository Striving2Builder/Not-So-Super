// Procedural people for the 3D zones (civilians, informants, patients, orderlies) and the
// fallback heroine used until her rigged model loads. Mixed into Special3D.prototype.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { quality } from './settings.js';
import { inkCharacter } from './look3d.js';
import { drawEmblem } from './art.js';
import { lam, canvasTex } from './zonekit.js';


export const peopleMethods = {
  // ------------------------------------------------------------------ characters
  emblemTex() {
    return canvasTex(128, 128, (c) => { c.translate(64, 60); drawEmblem(c, 44); });
  },

  makeHero() {
    const G = new THREE.Group();
    const skin = lam(0xf6d1b3), blue = lam(0x7ec8f4), red = lam(0xd82630), boots = lam(0xc91f2b), gold = lam(0xf7d31e), hair = lam(0xf5d442);
    const add = (geo, mat, x, y, z, parent = G) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
    const leg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.92, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.085, 0.075, 0.44, 10), skin, 0, -0.22, 0, p);
      add(new THREE.CylinderGeometry(0.08, 0.065, 0.48, 10), boots, 0, -0.67, 0, p);
      add(new THREE.BoxGeometry(0.12, 0.07, 0.2), boots, 0, -0.9, 0.05, p);
      return p;
    };
    this.legL = leg(-0.1); this.legR = leg(0.1);
    add(new THREE.CylinderGeometry(0.19, 0.28, 0.22, 16), red, 0, 0.93, 0);
    add(new THREE.CylinderGeometry(0.195, 0.195, 0.06, 16), gold, 0, 1.05, 0);
    const torso = add(new THREE.CylinderGeometry(0.2, 0.16, 0.52, 14), blue, 0, 1.33, 0);
    torso.scale.z = 0.8;
    add(new THREE.SphereGeometry(0.085, 10, 8), blue, -0.075, 1.43, 0.1);
    add(new THREE.SphereGeometry(0.085, 10, 8), blue, 0.075, 1.43, 0.1);
    const em = add(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: this.emblemTex(), transparent: true }), 0, 1.42, 0.19);
    em.rotation.x = -0.1;
    const arm = (x) => {
      const p = new THREE.Group(); p.position.set(x, 1.55, 0); G.add(p);
      add(new THREE.CylinderGeometry(0.055, 0.05, 0.56, 8), blue, 0, -0.28, 0, p);
      add(new THREE.SphereGeometry(0.058, 8, 6), skin, 0, -0.58, 0, p);
      return p;
    };
    this.armL = arm(-0.26); this.armR = arm(0.26);
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 8), skin, 0, 1.63, 0);
    add(new THREE.SphereGeometry(0.14, 14, 12), skin, 0, 1.78, 0.01);
    const h1 = add(new THREE.SphereGeometry(0.155, 14, 12), hair, 0, 1.81, -0.025); h1.scale.set(1, 0.95, 1);
    add(new THREE.BoxGeometry(0.28, 0.42, 0.08), hair, 0, 1.6, -0.13);
    for (const x of [-0.05, 0.05]) add(new THREE.SphereGeometry(0.018, 6, 4), lam(0x1a4aa8), x, 1.79, 0.135);
    this.cape = new THREE.Group(); this.cape.position.set(0, 1.56, -0.17); G.add(this.cape);
    add(new THREE.PlaneGeometry(0.52, 1.0), lam(0xc11d27, { side: THREE.DoubleSide }), 0, -0.5, 0, this.cape);
    return G;
  },

  /**
   * A procedural person (civilians, informants, patients, orderlies): a stylised figure in the
   * same proportions as the rigged cast, built as five vertex-coloured meshes (body, 2 legs,
   * 2 arms) so a crowd stays cheap. Keeps the old API: G.legs / G.arms pivot groups to swing.
   */
  makeNPC(look, size = 1) {
    const G = new THREE.Group();
    const C = (c, d = '#333333') => new THREE.Color(c || d);
    const skin = C(look.skin, '#e0b08a'), top = C(look.top), bottom = C(look.bottom || look.skirt, '#333333');
    const hair = C(look.hair, '#2a1a10'), shoe = C(look.boots, '#151515'), ink = new THREE.Color(0x141014);
    const gown = look.gown;
    const parts = () => [];
    const put = (list, geo, col, x, y, z, { sx = 1, sy = 1, sz = 1, rx = 0, rz = 0 } = {}) => {
      geo.scale(sx, sy, sz); if (rx) geo.rotateX(rx); if (rz) geo.rotateZ(rz); geo.translate(x, y, z);
      const n = geo.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      list.push(geo);
    };
    const mat = this.npcMat || (this.npcMat = lam(0xffffff, { vertexColors: true }));
    mat.userData.comic.rimK.value = 0.55; mat.userData.comic.rimCol.value.set(0xfff0d0);
    const mesh = (list, parent) => { const m = new THREE.Mesh(mergeGeometries(list, false), mat); parent.add(m); return m; };
    const Sph = (r, w = 12, h = 10, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest);
    const Cyl = (a, b, h, n = 10) => new THREE.CylinderGeometry(a, b, h, n);

    // body: pelvis/skirt, torso, neck, head, face, hair
    const B = parts();
    if (look.skirt || gown) put(B, Cyl(0.19, gown ? 0.3 : 0.3, gown ? 0.62 : 0.42, 12), gown ? top : bottom, 0, gown ? 0.72 : 0.82, 0);
    else put(B, Cyl(0.2, 0.19, 0.22, 12), bottom, 0, 0.95, 0, { sz: 0.75 });
    const torso = new THREE.LatheGeometry([[0.001, 0], [0.18, 0.0], [0.195, 0.12], [0.2, 0.28], [look.skirt ? 0.21 : 0.24, 0.46], [0.23, 0.56], [0.13, 0.64], [0.001, 0.65]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
    put(B, torso, top, 0, 1.0, 0, { sz: 0.64 });
    if (!gown && !look.skirt) put(B, Cyl(0.205, 0.205, 0.05, 12), ink, 0, 1.04, 0, { sz: 0.68 }); // belt
    put(B, Cyl(0.058, 0.064, 0.14, 8), skin, 0, 1.68, 0);
    put(B, Sph(0.132), skin, 0, 1.82, 0.005, { sy: 1.13, sz: 1.04 });
    put(B, Sph(0.026, 6, 5), skin, 0, 1.8, 0.135);                               // nose
    for (const x of [-0.047, 0.047]) put(B, Sph(0.02, 6, 5), ink, x, 1.83, 0.118); // eyes
    for (const x of [-0.05, 0.05]) put(B, new THREE.BoxGeometry(0.055, 0.013, 0.02), hair, x, 1.868, 0.118, { rz: x > 0 ? -0.15 : 0.15 });
    const hs = look.hairStyle;
    if (hs !== 'bald') {
      const capTop = (col, s = 1.06) => put(B, Sph(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), col, 0, 1.835, -0.012, { sy: s, sz: 1.08 });
      if (hs === 'cap' || hs === 'beanie') {
        capTop(hair, 0.9);
        const cc = C(look.capCol, '#223');
        put(B, Sph(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), cc, 0, 1.86, -0.01, { sy: hs === 'beanie' ? 1.25 : 0.95, sz: 1.06 });
        if (hs === 'cap') put(B, new THREE.CylinderGeometry(0.1, 0.1, 0.018, 10, 1, false, 0, Math.PI), cc, 0, 1.87, 0.1, { sz: 1.3 });
      } else capTop(hair, hs === 'slick' ? 0.95 : 1.08);
      if (hs === 'long') put(B, Sph(1, 10, 8), hair, 0, 1.66, -0.085, { sx: 0.16, sy: 0.27, sz: 0.085 });
    }
    if (look.beard) put(B, Sph(0.11, 10, 8), hair, 0, 1.74, 0.045, { sy: 0.8, sz: 0.85 });
    if (look.shades) put(B, new THREE.BoxGeometry(0.25, 0.055, 0.03), ink, 0, 1.835, 0.13);
    if (look.tie) put(B, new THREE.BoxGeometry(0.065, 0.38, 0.025), C(look.tie), 0, 1.38, 0.155, { rx: -0.08 });
    if (look.badge) put(B, Sph(0.03, 6, 5), C(look.badge), 0.1, 1.45, 0.15, { sz: 0.4 });
    mesh(B, G);

    G.legs = [];
    for (const x of [-0.1, 0.1]) {
      const p = new THREE.Group(); p.position.set(x, 0.92, 0); G.add(p);
      const L = parts();
      const legCol = look.skirt || gown ? skin : bottom;
      put(L, Cyl(0.1, 0.07, 0.84, 10), legCol, 0, -0.44, 0, { sz: 0.9 });
      put(L, Sph(1, 10, 8), shoe, 0, -0.875, 0.05, { sx: 0.075, sy: 0.06, sz: 0.145 });
      mesh(L, p);
      G.legs.push(p);
    }
    G.arms = [];
    for (const x of [-0.27, 0.27]) {
      const p = new THREE.Group(); p.position.set(x, 1.52, 0); p.rotation.z = x < 0 ? -0.1 : 0.1; G.add(p);
      const A = parts();
      const sleeve = look.tank ? skin : top;
      put(A, Sph(0.078, 10, 8), top, 0, 0, 0);
      put(A, Cyl(0.066, 0.056, 0.32, 8), sleeve, 0, -0.17, 0);
      put(A, Cyl(0.056, 0.047, 0.3, 8), look.tank || look.short ? skin : sleeve, 0, -0.47, 0.01);
      put(A, Sph(0.055, 8, 6), skin, 0, -0.66, 0.015, { sy: 1.2, sz: 0.8 });
      mesh(A, p);
      G.arms.push(p);
    }
    G.scale.setScalar(size * (look.size || 1));
    inkCharacter(G, { rim: 0xfff0d0, outline: quality().look3d !== 'min' });
    this.scene.add(G);
    this.shadows && this.shadows.track(G, 0.45 * size * (look.size || 1));
    return G;
  },
};
