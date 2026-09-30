// Special activity zones: an immersive 3D venue in third person. A multi-step infiltration:
// informant → keycard → security door → evidence/captives (→ boss) → exit, with guards,
// intoxicating temptations and bait items that can get the heroine captured.
import * as THREE from 'three';
import { quality } from './settings.js';
import { HeroModel, heroReady } from './hero3d.js';
import { Enemy, enemyReady, GUARD_KINDS, bossKind } from './enemies.js';
import { updateNightlife } from './nightlife.js';
import { VENUES, THEMES, INTOX_ITEMS, BAIT_ITEMS, HERO, FIRST_NAMES, LAST_NAMES } from './data.js';
import { pick, shuffle, chance, clamp, rand, wobble, $ } from './util.js';
import { dialog, toast, banner, qte, keypad, flash, avoidHud } from './ui.js';
import { portrait, npcLook } from './art.js';
import { sfx } from './sfx.js';
import { SPEED, GUARD_RANGE, GUARD_FOV, lam, basic } from './zonekit.js';
import { cameraMethods } from './camera3d.js';
import { guardMethods } from './guards3d.js';
import { peopleMethods } from './people3d.js';
import { roomMethods } from './rooms3d.js';
import { inkCharacter, BlobShadows, bakeStatic, gradeQuad, comicScene, inkEdges, groundBackdrop } from './look3d.js';
import { venueMats, VENUE_KINDS } from './venues3d.js';

export { CAM_DIST, CAM_PITCHES } from './zonekit.js';

// The code-built venues' floor plan bounds (main hall, back room, office; see rooms3d.js).
const FOOTPRINT = { min: { x: -15, z: -22 }, max: { x: 25, z: 12 } };

export class Special3D {
  constructor(g) { this.g = g; }

  initRenderer() {
    if (this.renderer) return;
    // One WebGL renderer shared by every 3D mode (special zones and club raids).
    if (!Special3D.sharedRenderer) {
      // antialiasing is fixed at creation: on for 1× screens, except in Battery saver
      const r = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2 && !quality().fpsCap, powerPreference: 'high-performance' });
      r.outputColorSpace = THREE.SRGBColorSpace;
      $('three-host').appendChild(r.domElement);
      Special3D.sharedRenderer = r;
    }
    this.renderer = Special3D.sharedRenderer;
    this.resize();
  }

  /**
   * Tone mapping + exposure for this zone (the renderer is shared, so it's set on every entry).
   * Filmic contrast with saturated pulp colours; zones may override.
   */
  applyLook() {
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.exposure ?? 1.1;
  }

  resize() {
    if (!this.renderer) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality().dpr3d));
    this.renderer.setSize(this.g.w, this.g.h, false);
    if (this.cam) { this.cam.aspect = this.g.w / this.g.h; this.cam.updateProjectionMatrix(); }
  }

  enter({ zone }) {
    const g = this.g;
    this.initRenderer();
    document.body.classList.add('three');
    this.zone = zone;
    this.V = VENUES[zone.venue];
    this.theme = this.themeFor(zone);
    Object.assign(this, {
      done: false, busy: false, t: 0, alert: 0, en: 100, xray: false, inside: 0, bonus: 0, wrong: 0,
      hasCode: false, hasKey: false, doorOpen: false, bossDone: !zone.boss, bossMet: false, punchT: 0,
      code: String(1000 + Math.floor(Math.random() * 9000)),
      colliders: [], inter: [], guards: [], anims: [], hidden: [], itemSpots: [], evidence: [], captives: [], cast: [],
      // per-zone references: this object is reused for every zone, so nothing may carry over
      boss: null, informant: null, near: null, _lastGood: null, nl: null, castRim: null, backdrop: null, particles: [],
    });
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color(this.V.bg);
    S.fog = new THREE.Fog(this.V.bg, 24, 62);
    this.cam = new THREE.PerspectiveCamera(58, g.w / g.h, 0.1, 160);
    this.resize();
    this.applyLook();
    this.shadows = new BlobShadows(S);
    // Key light: gives the cel shading a direction to step along (characters read as solid forms).
    this.key = new THREE.DirectionalLight(0xfff1dc, this.keyK ?? 1.1);
    this.key.position.set(-6, 14, 8);
    S.add(this.key);
    this.particles = [];
    this.buildWorld();
    this.finishLook();
    if (quality().look3d === 'full') { this.grade = gradeQuad(this.gradeTint ?? 0x07040c, this.gradeK ?? 0.6); S.add(this.grade); }
    this.heroModel = heroReady() ? new HeroModel() : null;
    this.keepAnimating = false;
    this.camPitch = null; // first frame places the camera directly (no sweep in through walls)
    this.landT = 0;
    if (this.heroModel) {
      this.hero = new THREE.Group();
      this.hero.add(this.heroModel.root);
      this.heroClip('land', 1.4); // she arrives with a superhero landing
      inkCharacter(this.heroModel.root, { rim: 0xfff4d0, skip: [this.heroModel.cape.mesh] });
      inkCharacter(this.heroModel.cape.mesh, { rim: 0xfff4d0, outline: false });
    } else this.hero = inkCharacter(this.makeHero());
    this.shadows.track(this.hero, 0.5);
    // Guards can't spot her until she's had 3 s on her feet (after the landing / getting-up clip).
    this.grace = this.landT + 3;
    const sp = this.spawnPoint();
    this.hero.position.copy(sp.pos);
    this.hero.rotation.y = sp.heading;
    this.yaw = sp.heading - Math.PI; // camera behind her
    S.add(this.hero);

    g.input.setStick(true);
    this.setupControls();
    $('hud-title').textContent = zone.name;
    $('objectives').classList.add('on');
    this.announce();
  }

  // ---- presentation hooks (night cases override these)
  themeFor(zone) { return THEMES[zone.theme]; }

  setupControls() {
    this.g.input.setButtons([
      { id: 'interact', label: 'USE', key: 'E', cls: 'big' },
      { id: 'punch', label: 'PUNCH', key: 'F' },
      { id: 'xray', label: 'X-RAY', key: 'X', slot: 2 },
    ]);
    $('hud-extra').innerHTML = `<div class="barlabel"><span>Guard alert</span></div><div class="bar"><i id="b-alert" class="b-alert"></i></div>
      <div class="barlabel"><span>X-ray power</span></div><div class="bar"><i id="b-en" class="b-en"></i></div>`;
  }

  announce() {
    banner(this.zone.venue.toUpperCase(), `${this.theme.name} · Risk of capture`, '#ff3fb8');
    setTimeout(() => { if (!this.done) toast('Drag the screen to turn the camera. Stay out of the guards\' vision cones.', 'info'); }, 1600);
  }

  // ---- overridable world hooks (ClubZone replaces these with a premade building)
  buildWorld() {
    const k = this.V.kind;
    this.vmats = VENUE_KINDS.has(k) ? venueMats(this, k) : null;
    this.wallMat = this.vmats ? this.vmats.wall : k === 'penthouse'
      ? lam(0x9fd0ff, { transparent: true, opacity: 0.28 })
      : lam(this.V.wall);
    this.wallBaseOpacity = this.wallMat.opacity;
    this.buildLights();
    // our own venues: everything built from here to placeGameplay() is merged into a few meshes
    this._static = this.vmats ? [] : null;
    this.buildRooms();
    this.decorate();
    if (this._static) { bakeStatic(this.scene, this._static); this._static = null; }
    this.placeGameplay();
  }

  // (far enough in that the camera behind her hangs over the entrance, not the street)
  spawnPoint() { return { pos: new THREE.Vector3(0, 0, 8.2), heading: Math.PI }; }

  /**
   * The shared comic finish for whatever buildWorld() made (own venues, premade clubs, nightlife):
   * cel bands + halftone in the shade on every lit material, ink lines along a prebuilt
   * building's hard edges (once per cached building), and ground out to the fog so no room
   * floats in the void. Zones tune it with this.backdrop = false | { color, y }.
   */
  finishLook() {
    const S = this.scene;
    comicScene(S);
    if (this.club && this.club.scene) inkEdges(this.club.scene);
    const bd = this.backdrop ?? (this.vmats && this.vmats.backdrop);
    if (bd === false) return;
    const bg = S.background && S.background.isColor ? S.background.clone() : new THREE.Color(0x101014);
    const color = bd && bd.color !== undefined ? new THREE.Color(bd.color) : bg.clone().lerp(new THREE.Color(0x3a3a44), 0.25);
    const y = bd && bd.y !== undefined ? bd.y : this.club && this.club.box ? this.club.box.min.y - 0.06 : -0.04;
    // leave out what the building's own floors cover (inset so no seam shows at the walls)
    const fp = this.club && this.club.box ? this.club.box : this.vmats ? FOOTPRINT : null;
    const hole = fp ? [fp.min.x + 0.6, fp.max.x - 0.6, fp.min.z + 0.6, fp.max.z - 0.6] : null;
    S.add(groundBackdrop(color, y, { hole }));
  }

  /** Should the boss confrontation start now? */
  bossTrigger(h) { return this.doorOpen && h.position.z < -13; }

  /** Anything to pull out of the scene before it's disposed (e.g. a cached building). */
  detachShared() {}

  exit() {
    this.detachShared();
    for (const e of this.cast || []) e.root.remove(e.model); // shares geometry/textures with the loaded templates
    document.body.classList.remove('three');
    $('marker').classList.remove('on');
    $('xray-tint').classList.remove('on');
    $('objectives').classList.remove('on');
    $('prompt').classList.remove('on');
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      this.scene = null;
    }
    this.renderer && this.renderer.renderLists.dispose();
  }

  /** A cast enemy model (enemies.js) once it has loaded, else the procedural NPC in `look`. */
  makeCharacter(kind, look, scale = 1) {
    if (!enemyReady(kind)) return this.makeNPC(look);
    const e = new Enemy(kind, scale);
    // ink hulls on the skinned cast double their vertex skinning: only on the High profile
    inkCharacter(e.model, { rim: this.castRim ?? 0xffd6a0, outline: quality().look3d === 'full' });
    this.scene.add(e.root);
    this.cast.push(e);
    this.shadows && this.shadows.track(e.root, 0.5 * scale);
    return e.root;
  }

  makeGuard() { return this.makeCharacter(pick(GUARD_KINDS), npcLook('guard')); }
  makeBoss() { return this.makeCharacter(bossKind(this.zone.boss), npcLook('boss'), 1.06); }

  // ------------------------------------------------------------------ gameplay setup
  placeGameplay() {
    const z = this.zone, th = this.theme, V = this.V;
    // Informant
    const spots = shuffle([[-11, 4], [10, 9], [-11, -6], [9, -9], [5, 5], [-5, 9]]);
    const [ix, iz] = spots[0];
    const infLook = npcLook('civilian');
    const inf = (this.informant = { mesh: this.makeNPC(infLook), look: infLook, name: `${pick(FIRST_NAMES)} "${pick(['Whispers', 'Ears', 'Lucky', 'Two-Tone', 'Slick', 'Canary'])}"`, works: pick(['charm', 'press']), burned: false });
    inf.mesh.position.set(ix, 0, iz);
    inf.mesh.rotation.y = Math.atan2(-ix, -iz);
    this.addInter(inf.mesh.position, 'Talk to the informant', () => !this.hasCode || true, () => this.talkInformant(), 'informant');

    // Guards
    // Patrol routes stay clear of the entrance so nobody spots you the moment you arrive.
    const routes = shuffle([
      [[-10, -8], [10, -8]], [[12, 6], [12, -9]], [[-12, 5], [-5, 1], [-12, -5]],
      [[17, -3], [23, 3], [17, 3]], [[-6, -3], [6, -3]], [[5, -10], [5, 2]],
    ]);
    const nG = Math.min(5, 2 + (z.boss ? 1 : 0) + (th.extraGuards || 0) + (chance(0.5) ? 1 : 0));
    for (let i = 0; i < nG; i++) {
      const route = routes[i].map(([x, zz]) => new THREE.Vector3(x, 0, zz));
      const mesh = this.makeGuard();
      mesh.position.copy(route[0]);
      const cone = new THREE.Mesh(
        new THREE.CircleGeometry(GUARD_RANGE, 24, -Math.PI / 2 - GUARD_FOV / 2, GUARD_FOV).rotateX(-Math.PI / 2),
        basic(0xffe040, { transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = 0.04;
      mesh.add(cone);
      this.guards.push({ mesh, cone, route, wp: 1, ko: false, look: 0, seeing: false, t: rand(0, 3) });
    }

    // Office containers: one keycard, one gas trap
    const cont = shuffle(['key', 'trap', 'empty', 'empty']);
    const defs = [['Filing Cabinet', 16.3, -4.2, 0x7d8590, [0.9, 1.6, 0.6]], ['Staff Locker', 23.7, -4.2, 0x4a6a8a, [0.8, 2, 0.6]], ['Wall Safe', 23.7, 4.2, 0x333333, [0.9, 0.9, 0.6]], ['Desk Drawer Unit', 16.3, 4.2, 0x6a4a2a, [0.9, 0.8, 0.6]]];
    this.containers = defs.map(([name, x, zz, c, [w, h, d]], i) => {
      const mesh = this.box(w, h, d, x, h / 2, zz, lam(c));
      const content = cont[i];
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), basic(content === 'key' ? 0x40e0ff : content === 'trap' ? 0xff4db8 : 0x444444, { depthTest: false, transparent: true, opacity: 0.95 }));
      inner.position.set(x, h / 2, zz); inner.renderOrder = 10; inner.visible = false;
      this.scene.add(inner);
      if (content !== 'empty') this.hidden.push(inner);
      const o = { name, mesh, content, opened: false, inner };
      this.addInter(new THREE.Vector3(x, 0, zz), `Search the ${name.toLowerCase()}`, () => !o.opened, () => this.searchContainer(o));
      return o;
    });

    // Tempting items and bait
    const spotsI = shuffle([...this.itemSpots]);
    const nItems = Math.min(spotsI.length, 3 + (th.extraTraps || 0));
    for (let i = 0; i < nItems; i++) {
      const bait = i === 0 || (i === 3 && chance(0.5));
      const def = bait ? pick(BAIT_ITEMS) : pick(INTOX_ITEMS);
      const p = spotsI[i];
      const trapped = bait ? chance(0.6) : false;
      const col = bait ? 0xffd84d : 0xff7ad0;
      const mesh = new THREE.Mesh(bait ? new THREE.BoxGeometry(0.4, 0.25, 0.3) : new THREE.CylinderGeometry(0.07, 0.05, 0.28, 10), lam(col, { emissive: col, emissiveIntensity: 0.4 }));
      mesh.position.set(p.x, p.y + 0.14, p.z);
      this.scene.add(mesh);
      const aura = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24), basic(trapped ? 0xff2020 : bait ? 0xffd84d : 0xff4db8, { depthTest: false, transparent: true }));
      aura.rotation.x = -Math.PI / 2; aura.position.set(p.x, p.y + 0.05, p.z); aura.renderOrder = 11; aura.visible = false;
      this.scene.add(aura); this.hidden.push(aura);
      const it = { def, bait, trapped, mesh, aura, taken: false };
      this.anims.push((t) => { mesh.rotation.y = t * 1.5; mesh.position.y = p.y + 0.16 + Math.sin(t * 3 + p.x) * 0.04; });
      this.addInter(new THREE.Vector3(p.x, 0, p.z), `Examine: ${def.name}`, () => !it.taken, () => this.takeItem(it));
    }

    // Back room: evidence + captives
    const ev = th.evidence;
    ev.forEach((name, i) => {
      const x = ev.length === 1 ? 0 : -2.2 + i * 4.4, zz = -20;
      this.box(1, 0.9, 1, x, 0.45, zz, lam(0x333333));
      const glowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.45), lam(0x39ff6a, { emissive: 0x39ff6a, emissiveIntensity: 0.6 }));
      glowMesh.position.set(x, 1.12, zz); this.scene.add(glowMesh);
      const e = { name, mesh: glowMesh, done: false };
      this.evidence.push(e);
      this.addInter(new THREE.Vector3(x, 0, zz + 0.8), `${th.mind && i === 0 ? 'Smash' : 'Secure'}: ${name}`, () => !e.done, () => this.secureEvidence(e), 'evidence');
    });
    const cageSpots = [[-4.4, -14.6], [4.4, -14.6], [-4.4, -19], [4.4, -19]];
    for (let i = 0; i < (th.captives || 0); i++) {
      const [x, zz] = cageSpots[i];
      const person = this.makeNPC(npcLook('civilian'));
      person.position.set(x, 0, zz);
      person.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.4), new THREE.MeshBasicMaterial({ color: 0x999999, wireframe: true }));
      cage.position.set(x, 1.15, zz); this.scene.add(cage);
      this.colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: zz - 0.7, maxZ: zz + 0.7, mesh: cage });
      const c = { person, cage, freed: false, x, z: zz };
      this.captives.push(c);
      this.addInter(new THREE.Vector3(x + (x < 0 ? 1.1 : -1.1), 0, zz), th.mind ? 'Snap them out of the trance' : 'Break open the cage', () => !c.freed, () => this.freeCaptive(c), 'captive');
    }
    // Boss
    if (z.boss) {
      this.boss = this.makeBoss();
      this.boss.position.set(0, 0, -21.2);
    }
    this.keypadInter = this.addInter(new THREE.Vector3(2.1, 0, -11), 'Use the security door', () => !this.doorOpen, () => this.useDoor(), 'door');
  }

  addInter(pos, label, can, act, tag) {
    const o = { pos: pos.clone ? pos.clone() : pos, label, can, act, tag };
    o.pos.y = 0;
    this.inter.push(o);
    return o;
  }

  // ------------------------------------------------------------------ interactions
  async talkInformant() {
    const inf = this.informant;
    if (this.hasCode) {
      await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: `"The code is <b>${this.code}</b>. The keycard's somewhere in the office. Now get lost before they see us together."` });
      return;
    }
    const hint = inf.works === 'charm'
      ? 'They keep glancing at the back room door, guilt written all over their face.'
      : 'They\'re sweating and their eyes dart to every exit. A coward.';
    const v = await dialog({
      speaker: `Informant · ${inf.name}`, portrait: portrait(inf.look),
      text: `"Psst. Hero. You want in the back room? Whole ${this.theme.name.toLowerCase()} racket runs through there. I know the door code… but talk ain't cheap in here."<span class="hint">${hint}</span>`,
      options: [
        { label: '"Have a drink with me first." — Accept the drink', note: '+25 intoxication, guaranteed code', value: 'drink', cls: 'risky' },
        { label: 'Appeal to their conscience', value: 'charm', disabled: inf.burned },
        { label: 'Pin them against the wall', value: 'press', disabled: inf.burned },
        { label: 'Walk away', value: null },
      ],
    });
    if (!v) return;
    if (v === 'drink') {
      sfx.drink();
      this.g.state.addIntox(25);
      toast('🥴 Intoxication +25', 'bad');
      this.hasCode = true;
    } else if (v === inf.works) this.hasCode = true;
    else {
      inf.burned = true;
      this.alert = Math.min(99, this.alert + 30);
      sfx.alarm();
      await dialog({ speaker: inf.name, text: '"Hey! Keep it down!" Heads turn toward you.<span class="hint">Guard alert +30. They\'ll only talk over a drink now.</span>' });
      return;
    }
    sfx.pickup();
    await dialog({ speaker: inf.name, portrait: portrait(inf.look), text: `"Alright, alright. The back room code is <b>${this.code}</b>. You'll need the keycard too — the manager keeps it in the office. Watch the guards."` });
  }

  async searchContainer(o) {
    const hint = this.xray
      ? (o.content === 'key' ? '<span class="hint">X-ray: a keycard is inside!</span>' : o.content === 'trap' ? '<span class="hint">X-ray: a pressurized gas canister is rigged to the latch.</span>' : '<span class="hint">X-ray: nothing but paper.</span>')
      : '<span class="hint">X-ray vision would show you what\'s inside.</span>';
    const v = await dialog({ title: o.name, text: `It's closed.${hint}`, options: [{ label: 'Open it', value: true }, { label: 'Leave it', value: false }] });
    if (!v) return;
    o.opened = true;
    o.inner.visible = false;
    this.hidden = this.hidden.filter((h) => h !== o.inner);
    o.mesh.rotation.y = 0.25;
    if (o.content === 'key') { this.hasKey = true; sfx.pickup(); await dialog({ title: 'Keycard found!', text: 'A security keycard for the back room.' }); }
    else if (o.content === 'trap') { sfx.trap(); this.g.state.addIntox(28); toast('🥴 Knockout gas! Intoxication +28', 'bad'); }
    else toast('Empty — just old receipts.', 'info');
  }

  async takeItem(it) {
    const d = it.def;
    const note = it.bait ? 'Could be evidence (+15)… or a trap' : `+${d.intox} intoxication${d.perk === 'rep' ? ', +2 rep' : d.perk === 'energy' ? ', recharges power' : ''}`;
    const xr = this.xray ? (it.bait ? (it.trapped ? '<span class="hint">X-ray: wires and a tracking beacon — it\'s bait!</span>' : '<span class="hint">X-ray: looks clean.</span>') : '<span class="hint">X-ray: chemical traces.</span>') : '';
    const v = await dialog({ title: d.name, text: d.desc + xr, options: [{ label: 'Take it', note, value: true, cls: 'risky' }, { label: 'Leave it', value: false }] });
    if (!v) return;
    it.taken = true;
    it.mesh.visible = false; it.aura.visible = false;
    this.hidden = this.hidden.filter((h) => h !== it.aura);
    if (it.bait) {
      if (it.trapped) { this.capture(`The ${d.name.toLowerCase()} was bait! A net drops from the ceiling and the guards pile on.`); return; }
      this.bonus += 15; sfx.pickup(); toast('Evidence! +15 rep when you finish', 'good');
    } else {
      sfx.drink();
      this.g.state.addIntox(d.intox);
      toast(`🥴 Intoxication +${d.intox}`, 'bad');
      if (d.perk === 'rep') this.g.state.addRep(2, 'The crowd cheers you');
      if (d.perk === 'energy') this.en = 100;
    }
  }

  async useDoor() {
    if (this.doorOpen) return;
    const opts = [];
    if (this.hasKey) opts.push({ label: 'Swipe the keycard & enter a code', value: 'code' });
    opts.push({ label: 'Smash it down', note: 'Very loud: guard alert +60', value: 'smash', cls: 'risky' });
    opts.push({ label: 'Step away', value: null });
    const v = await dialog({
      title: 'Security Door',
      text: `Reinforced steel. A keycard reader and a keypad.${this.hasKey ? ' You have the keycard.' : ' You need the <b>keycard</b> (try the office).'}${this.hasCode ? ` The code is <b>${this.code}</b>.` : ' You don\'t know the <b>code</b> (the informant does).'}`,
      options: opts,
    });
    if (v === 'smash') {
      sfx.hit(); sfx.alarm();
      this.alert = Math.min(99, this.alert + 60);
      this.openDoor();
      toast('CRASH! Everyone heard that.', 'bad');
    } else if (v === 'code') {
      const code = await keypad(this.hasCode ? `Enter code (${this.code})` : 'Enter 4-digit code');
      if (code === null) return;
      if (code === this.code) { this.openDoor(); toast('Access granted', 'good'); }
      else { this.wrong++; this.alert = Math.min(99, this.alert + 25); sfx.alarm(); toast('ACCESS DENIED — the alarm chirps!', 'bad'); }
    }
  }

  openDoor() {
    this.doorOpen = true;
    this.doorCol.disabled = true;
    this.keypadMesh.material.color.set(0x3ee08a);
    sfx.door();
    const d = this.door;
    this.anims.push(() => { if (d.position.y < 5) d.position.y += 0.06; });
  }

  async secureEvidence(e) {
    const th = this.theme;
    const v = await dialog({ title: e.name, text: `This is it — the proof behind the ${th.name.toLowerCase()} operation.`, options: [{ label: th.mind ? 'Smash it with super-strength' : 'Secure it for the police', value: true }, { label: 'Not yet', value: false }] });
    if (!v) return;
    e.done = true; e.mesh.visible = false;
    sfx.pickup(); flash('#3ee08a');
    toast(`${e.name} secured`, 'good');
  }

  async freeCaptive(c) {
    c.freed = true;
    c.cage.visible = false;
    this.colliders = this.colliders.filter((col) => col.mesh !== c.cage);
    sfx.hit();
    toast(this.theme.mind ? 'They blink awake: "Where… where am I?"' : '"Thank you, Supergirl!"', 'good');
    const p = c.person;
    this.anims.push((t, dt) => {
      if (!p.visible) return;
      const target = new THREE.Vector3(0, 0, 13);
      const d = target.clone().sub(p.position);
      if (d.length() < 0.5) { p.visible = false; return; }
      const via = p.position.z < -12.5 && Math.abs(p.position.x) > 0.8 ? new THREE.Vector3(0, 0, p.position.z) : target;
      const dir = via.clone().sub(p.position).normalize();
      p.position.addScaledVector(dir, dt * 4);
      p.rotation.y = Math.atan2(dir.x, dir.z);
      p.legs[0].rotation.x = Math.sin(t * 12) * 0.6; p.legs[1].rotation.x = -Math.sin(t * 12) * 0.6;
    });
  }

  async bossFight() {
    this.bossMet = true;
    const name = this.zone.boss, th = this.theme;
    const lines = {
      hypnosis: '"Look into my eyes, darling… you are getting very… sleepy…"',
      mindcontrol: '"One press of this button and you\'ll be MY hero. Obedient. Adoring."',
      blackmail: '"I have photos of half this city. By tomorrow, I\'ll have some of you."',
      intoxication: '"Relax, have a drink. Everybody does, eventually."',
    };
    const v = await dialog({
      title: name, speaker: 'BOSS', cls: 'villain',
      text: `${lines[th.name === 'Hypnosis' ? 'hypnosis' : th.mind ? 'mindcontrol' : th.name === 'Blackmail' ? 'blackmail' : th.name === 'Spiked Drinks' ? 'intoxication' : 'blackmail'] || '"Well, well. The famous hero walks right into my parlor."'}`,
      options: [
        { label: `"It's over, ${name}!" — Attack`, value: 'fight' },
        { label: '"The police are right behind me." — Bluff', note: 'Works if you haven\'t raised the alarm much', value: 'bluff' },
        { label: 'Accept a "truce" drink', note: '+30 intoxication — the boss relaxes', value: 'drink', cls: 'risky' },
      ],
    });
    let need = th.mind ? 16 : 13;
    if (v === 'bluff') {
      if (this.alert < 40) { await dialog({ speaker: name, text: '"The police?! I— this isn\'t over!" The boss panics and trips over a crate. Out cold.' }); return this.defeatBoss(); }
      await dialog({ speaker: name, text: '"Nice try. My guards already told me you came alone."' });
      need += 3;
    } else if (v === 'drink') {
      sfx.drink(); this.g.state.addIntox(30); toast('🥴 Intoxication +30', 'bad');
      need -= 4;
      if (this.g.state.intox >= 100) return this.capture(`${HERO} passes out mid-toast. ${name} laughs.`);
    }
    const ok = await qte(th.mind
      ? { title: 'RESIST!', text: `${name} unleashes the ${th.evidence[0].toLowerCase()} at full power. Fight for your mind!`, label: 'RESIST!', need, time: 4 }
      : { title: 'SHOWDOWN!', text: `${name} lunges at you. Overpower them!`, label: 'PUNCH!', need, time: 4 });
    if (!ok) return this.capture(th.mind ? `${HERO}'s eyes glaze over. "Yes… master…"` : `${name} lands a sucker punch and the goons pile on.`);
    this.defeatBoss();
  }

  /** World position (+ height) → screen pixels, or null if behind the camera. */
  screenOf(pos, up = 0) {
    const v = new THREE.Vector3(pos.x, pos.y + up, pos.z).project(this.cam);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.g.w, y: (-v.y * 0.5 + 0.5) * this.g.h };
  }

  defeatBoss() {
    { const s = this.screenOf(this.boss.position, 2.2); if (s) this.g.commentary.hit(s.x, s.y, { big: true }); }
    this.bossDone = true;
    sfx.hit(); flash('#fff');
    const b = this.boss;
    if (b.enemy) b.enemy.knockDown();
    else this.anims.push(() => { if (b.rotation.x > -Math.PI / 2) { b.rotation.x -= 0.08; b.position.y = 0.2; } });
    banner(`${this.zone.boss.toUpperCase()} DEFEATED`, '', '#3ee08a');
    this.bonus += 10;
  }

  animateHero(dt, mag) {
    const M = this.heroModel;
    if (M) {
      // Rigged model: pick a clip from what she's doing.
      if (this.landT > 0) this.landT -= dt;
      else if (mag > 0) {
        if (this.g.state.intox >= 50) M.play('drunkWalk', { speed: 0.8 + mag * 0.5 });
        else if (mag < 0.55) M.play('jog', { speed: 0.7 + mag });
        else M.play('run', { speed: 0.75 + mag * 0.35 });
      } else M.play(this.g.state.intox >= 50 ? 'happyIdle' : this.guards.some((gd) => gd.seeing) ? 'combatIdle' : 'idle', { fade: 0.3 });
      M.setWind(Math.sin(this.t * 1.3) * 0.7, 0.4, -(0.8 + mag * 6.5));
      M.update(dt);
      return;
    }
    const walk = mag ? Math.sin(this.t * 11) * 0.55 * mag : 0;
    this.legL.rotation.x = walk; this.legR.rotation.x = -walk;
    this.armL.rotation.x = -walk * 0.8;
    this.armR.rotation.x = this.punchT > 0 ? -1.5 : walk * 0.8;
    this.cape.rotation.x = 0.15 + mag * 0.5 + Math.sin(this.t * 6) * 0.06;
  }

  /** Play a one-off clip on the rigged model while the game logic freezes her in place. */
  heroClip(name, hold = 1.5) {
    if (!this.heroModel) return;
    this.heroModel.play(name, { fade: 0.15, restart: true });
    this.landT = hold;
  }

  capture(reason) {
    if (this.done) return;
    if (this.heroModel) { this.heroModel.play('defeated', { fade: 0.2 }); this.keepAnimating = true; }
    this.done = true;
    sfx.trap(); flash('#ff3fb8');
    banner('CAPTURED!', '', '#ff3fb8');
    $('prompt').classList.remove('on');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'captured', reason }), 1300);
  }

  win() {
    if (this.done) return;
    if (this.heroModel) { this.heroModel.play('excited', { fade: 0.2 }); this.keepAnimating = true; }
    this.done = true;
    sfx.win();
    banner('ZONE CLEARED!', '', '#3ee08a');
    setTimeout(() => this.g.endZone(this.zone, { outcome: 'win', rep: this.zone.reward + this.bonus, photo: 'special' }), 1100);
  }

  abort() { this.done = true; this.g.endZone(this.zone, { outcome: 'abort', rep: -3 }); }

  // ------------------------------------------------------------------ objectives
  objectives() {
    const ev = this.evidence.every((e) => e.done), cap = this.captives.every((c) => c.freed);
    const list = [
      { t: this.hasCode ? `Door code: ${this.code}` : 'Get the door code from the informant', done: this.hasCode, target: this.informant.mesh.position, tag: 'informant', skip: this.doorOpen },
      { t: 'Find the keycard in the office', done: this.hasKey, target: new THREE.Vector3(20, 0, 0), skip: this.doorOpen },
      { t: 'Get into the back room', done: this.doorOpen, target: new THREE.Vector3(2.1, 0, -11) },
    ];
    if (this.zone.boss) list.push({ t: `Take down ${this.zone.boss}`, done: this.bossDone, target: this.boss.position });
    list.push({ t: `${this.theme.verb}${this.captives.length ? ` (${this.captives.filter((c) => c.freed).length}/${this.captives.length} captives freed)` : ''}`, done: ev && cap, target: (this.evidence.find((e) => !e.done) || {}).mesh?.position || (this.captives.find((c) => !c.freed) || {}).person?.position });
    list.push({ t: 'Escape through the front entrance', done: false, target: this.exitRing.position, final: true });
    return list;
  }

  allDone() { return this.doorOpen && this.bossDone && this.evidence.every((e) => e.done) && this.captives.every((c) => c.freed); }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (this.done && this.keepAnimating && this.heroModel) this.heroModel.update(dt);
    if (this.scene) for (const e of this.cast) e.update(dt);
    if (this.done || !this.scene) return;
    const g = this.g, inp = g.input, st = g.state;
    this.t += dt;
    this.inside += dt;
    g.vice = { active: this.V.vice, where: this.zone.venue, rate: 1.6 };

    // camera yaw from drags (not while using the joystick)
    if (inp.drag.dx) this.yaw -= inp.drag.dx * 0.0065;

    // movement relative to camera
    const a = wobble(inp.axis(), st.intox, this.t);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const mx = fx * -a.y + rx * a.x, mz = fz * -a.y + rz * a.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const h = this.hero;
    if (mag > 0.05 && !this.busy && this.landT <= 0) {
      h.position.x += mx * SPEED * dt;
      h.position.z += mz * SPEED * dt;
      const target = Math.atan2(mx, mz);
      let da = target - h.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      h.rotation.y += da * Math.min(1, dt * 12);
    }
    this.collide(h.position, 0.38);
    this.punchT = Math.max(0, this.punchT - dt);
    this.animateHero(dt, mag > 0.05 && !this.busy && this.landT <= 0 ? mag : 0);
    this.frameDt = dt;
    this.moving = (this.moving || 0) + ((mag > 0.05 && !this.busy ? mag : 0) - (this.moving || 0)) * Math.min(1, dt * 3);

    // X-ray
    if (inp.pressed('xray')) this.setXray(!this.xray);
    if (this.xray) { this.en -= dt * 12; if (this.en <= 0) { this.en = 0; this.setXray(false); } }
    else this.en = Math.min(100, this.en + dt * 7);

    // punch
    if (inp.pressed('punch') && !this.busy) this.punch();

    this.updateGuards(dt);
    this.alert = Math.max(0, this.alert - dt * (this.guards.some((g) => g.seeing) ? 0 : 7));
    if (this.alert >= 100) return this.capture(`The guards swarm ${HERO} and drag her into the back.`);
    if (st.intox >= 100) return this.capture(`${HERO}'s knees buckle. The room spins… and goes dark.`);

    // boss trigger
    if (this.boss && !this.bossMet && this.bossTrigger(h)) {
      this.busy = true;
      this.bossFight().finally(() => { this.busy = false; });
    }

    // interactables
    let best = null, bd = 2.0;
    for (const o of this.inter) {
      if (!o.can()) continue;
      const d = Math.hypot(o.pos.x - h.position.x, o.pos.z - h.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    this.near = best;
    if (best && inp.pressed('interact') && !this.busy) {
      this.busy = true;
      Promise.resolve(best.act()).finally(() => { this.busy = false; });
    }

    // exit
    const done = this.allDone();
    this.exitRing.material.opacity = done ? 0.5 + Math.sin(this.t * 5) * 0.3 : 0.12;
    const ex = this.exitRing.position;
    if (done && Math.hypot(h.position.x - ex.x, h.position.z - ex.z) < 1.4) this.win();

    for (const f of this.anims) f(this.t, dt);
    updateNightlife(this, dt);
  }

  punch() {
    this.punchT = 0.25;
    // The jab from "Fist Fight A" (lands ~0.23 s in); she plants her feet for the strike.
    if (this.heroModel) { this.heroModel.play('punch', { fade: 0.08, restart: true, from: 1.3 }); this.landT = 0.45; }
    sfx.whoosh();
    const h = this.hero;
    const fx = Math.sin(h.rotation.y), fz = Math.cos(h.rotation.y);
    for (const gd of this.guards) {
      if (gd.ko) continue;
      const dx = gd.mesh.position.x - h.position.x, dz = gd.mesh.position.z - h.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.9 && (dx * fx + dz * fz) / d > 0.3) {
        gd.ko = true;
        gd.cone.visible = false;
        sfx.hit();
        const m = gd.mesh;
        const s = this.screenOf(m.position, 1.6);
        if (s) this.g.commentary.hit(s.x, s.y, { big: true });
        if (m.enemy) m.enemy.knockDown();
        else this.anims.push(() => { if (m.rotation.x > -Math.PI / 2) { m.rotation.x -= 0.12; m.position.y = 0.15; } });
        if (gd.seeing) { this.alert = Math.min(99, this.alert + 20); toast('He got a shout off before going down!', 'bad'); }
        else toast('Silent takedown', 'good');
        return;
      }
    }
  }

  collide(p, r) {
    for (const c of this.colliders) {
      if (c.disabled) continue;
      const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); }
      else {
        const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
      }
    }
  }

  setXray(on) {
    if (on && this.en < 10) { toast('Not enough X-ray power', 'bad'); return; }
    this.xray = on;
    this.g.input.setButton('xray', { toggled: on });
    $('xray-tint').classList.toggle('on', on);
    if (this.wallMat) {
      this.wallMat.transparent = on || this.wallBaseOpacity < 1;
      this.wallMat.opacity = on ? 0.15 : this.wallBaseOpacity;
      this.wallMat.depthWrite = !on;
      this.wallMat.needsUpdate = true;
    }
    for (const m of this.hidden) m.visible = on;
    if (on) sfx.beam();
  }

  // ------------------------------------------------------------------ HUD + render
  hud() {
    const al = $('b-alert'), en = $('b-en');
    if (al) { al.style.width = this.alert + '%'; al.parentElement.classList.toggle('warn', this.alert > 60); }
    if (en) en.style.width = this.en + '%';
    if (!this.scene) return;
    const list = this.objectives();
    let cur = null;
    const html = list.filter((o) => !o.skip || o.done).map((o) => {
      const isCur = !o.done && !cur && (!o.final || this.allDone());
      if (isCur) cur = o;
      return `<div class="${o.done ? 'done' : isCur ? 'cur' : ''}">${o.done ? '✓' : '•'} ${o.t}</div>`;
    }).join('');
    const el = $('objectives');
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    $('hud-sub').textContent = `Inside ${Math.floor(this.inside)}s${this.V.vice ? ' · tabloids watching' : ''}${this.xray ? ' · X-RAY' : ''}`;
    // objective marker
    const mk = $('marker');
    if (cur && cur.target && !this.done) {
      const v = new THREE.Vector3(cur.target.x, 2.6, cur.target.z).project(this.cam);
      let x = (v.x * 0.5 + 0.5) * this.g.w, y = (-v.y * 0.5 + 0.5) * this.g.h;
      if (v.z > 1) { x = this.g.w - x; y = this.g.h - 40; }
      x = clamp(x, 30, this.g.w - 30); y = clamp(y, 70, this.g.h - 40);
      [x, y] = avoidHud(x, y); // never over HUD text or under a thumb button
      mk.style.transform = `translate(${x}px,${y}px)`;
      mk.querySelector('span').textContent = `${Math.round(Math.hypot(cur.target.x - this.hero.position.x, cur.target.z - this.hero.position.z))}m`;
      mk.classList.add('on');
    } else mk.classList.remove('on');
    // prompt
    const pr = $('prompt');
    if (this.near && !this.busy && !this.done) {
      const key = document.body.classList.contains('touch') ? 'USE' : 'E';
      const html2 = `<b>${key}</b> ${this.near.label}`;
      if (pr._html !== html2) { pr.innerHTML = html2; pr._html = html2; }
      pr.classList.add('on');
    } else pr.classList.remove('on');
    this.g.input.setButton('interact', { lit: !!this.near });
  }

}

// The zone's parts, each in its own module (camera, guards + cones, people, floor plan).
Object.assign(Special3D.prototype, cameraMethods, guardMethods, peopleMethods, roomMethods);
