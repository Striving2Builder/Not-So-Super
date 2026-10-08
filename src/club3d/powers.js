// Her powers in the club (docs/design/nightclub.md "Powers"), on one shared energy bar.
// X-ray: walls go glassy (who's in a side room), the dealers in the crowd light up, the safe
// behind the office painting, the stash in the stock room. Super-hearing: the music muffles, the
// whispered rumours come through, Talkers can be heard from outside their ring, the guards' radios
// and the boss behind his door. Drug-vision (the DJ's vial, or high enough): the UV writing on the
// walls. Intoxicated, X-ray flickers and lies and hearing scrambles; at the drop, hearing stuns.
import * as THREE from 'three';
import { basic } from '../zonekit.js';
import { tex, cnv, neonText } from '../nlkit.js';
import { toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { $ } from '../util.js';
import { scramble } from './cast.js';
import { INTOX_HAZE } from '../state.js';

const DRAIN = { xray: 11, hear: 9 };
const RADIO = ['"Floor\'s packed. Watch the VIP rope."', '"Lenny wants eyes on the staff door."', '"Swap at the drop. Doors are yours for a beat."', '"Anyone seen the cape? Boss says photograph her."', '"Courier\'s out back. Bag\'s heavy tonight."'];

export const powerMethods = {
  /** Make the club's power props once the world is built (called lazily). */
  initPowers() {
    if (this.pw) return;
    const S = this.scene, P = (this.pw = { rings: [], marks: [], fakes: [] });
    // super-hearing: two sound rings rippling out from her
    for (let i = 0; i < 2; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40).rotateX(-Math.PI / 2), basic(0xffd84d, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      r.renderOrder = 4; r.visible = false; S.add(r); P.rings.push(r);
    }
    // X-ray: the dealers in the crowd (a few dancers carry), marked with a glowing vial
    const vialT = tex(cnv(64, 96, (c) => { c.fillStyle = '#000'; c.fillRect(0, 0, 64, 96); c.fillStyle = '#39ff6a'; c.shadowColor = '#39ff6a'; c.shadowBlur = 18; c.fillRect(22, 26, 20, 50); c.fillStyle = '#d8ffe0'; c.fillRect(24, 16, 16, 12); }));
    const dancers = this.crowd.people.filter((p) => p.pose === 'dance' && Math.abs(p.hx) < this.plan.V.hw && Math.abs(p.hz) < this.plan.V.hd);
    for (let i = 0; i < 6 && dancers.length; i++) {
      const p = dancers.splice(Math.floor(Math.random() * dancers.length), 1)[0];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: vialT, blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
      s.scale.set(0.35, 0.52, 1); s.renderOrder = 12; s.visible = false; S.add(s);
      p.carrier = true;
      P.marks.push({ p, s });
    }
    // the UV writing beside the stock room door: its code and the drop, only in drug-vision
    const q = this.plan.byKind.storage, sgn = q.side === 'W' ? 1 : -1;
    const uvT = tex(cnv(512, 256, (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 512, 256);
      neonText(c, `STOCK ${this.stockCode}`, 256, 80, 70, '#c070ff', { maxW: 480 });
      neonText(c, this.caseDef.uvLine || '', 256, 180, 54, '#7affd8', { maxW: 480 });
    }));
    const uv = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: uvT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    uv.position.set(this.uvSpot.x + sgn * 0.04, 1.9, this.uvSpot.z); uv.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
    S.add(uv); P.uv = uv;
    for (const mk of P.marks) this.addInter({ get x() { return mk.p.x; }, get z() { return mk.p.z; }, y: 0 }, 'Lift a vial off the dealer', () => this.xray && !mk.lifted, () => this.liftVial(mk));
    // what X-ray finds: the safe behind the office painting, the stash behind the beer
    const A = this.roomA, glow = (w, h, d, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic(c, { transparent: true, opacity: 0.75, depthTest: false })); m.renderOrder = 11; m.visible = false; S.add(m); return m; };
    if (A.office?.safe) { const s = A.office.safe; this.safeGlow = glow(0.25, 0.7, 0.8, 0xffd84d); this.safeGlow.position.set(s.wx, 1.7, s.wz); }
    if (A.storage?.stash) { const s = A.storage.stash; this.stashGlow = glow(1.1, 0.7, 1.1, 0x39ff6a); this.stashGlow.position.set(s.x, 0.4, s.z - 1.2); }
    this.en = 100; this.dvision = 0; this.hearing = false;
    this.radioT = 6;
  },

  async liftVial(mk) {
    mk.lifted = true; mk.s.visible = false;
    sfx.pickup();
    this.bonus = (this.bonus || 0) + 3;
    toast(`You lift a vial off him. ${this.caseDef.carrierLine || ''}`, 'good');
  },

  stepPowers(dt) {
    this.initPowers();
    const inp = this.g.input, st = this.g.state, P = this.pw;
    if (inp.pressed('xray')) this.setXray(!this.xray);
    if (inp.pressed('hear')) this.setHearing(!this.hearing);
    if (this.undercover && (this.xray || this.hearing)) { this.setXray(false); this.setHearing(false); toast('No powers while you\'re undercover. Change in the restroom.', 'bad'); }
    if (this.xray && !this.xrayFree) this.en -= dt * DRAIN.xray;
    if (this.hearing) this.en -= dt * DRAIN.hear;
    this.xrayFree = Math.max(0, (this.xrayFree || 0) - dt);
    if (this.en <= 0) { this.en = 0; this.setXray(false); this.setHearing(false); toast('Out of power. Lie low in the crowd to recharge.', 'bad'); }
    if (!this.xray && !this.hearing) this.en = Math.min(100, this.en + dt * (this.dancing || this.blend >= 0.75 ? 14 : 5));
    // X-ray marks follow their dealers (intoxicated, they flicker and some are lies)
    const high = st.intox >= INTOX_HAZE;
    for (const m of P.marks) {
      m.s.position.set(m.p.x, (m.p.y ?? 0) + 2.25, m.p.z);
      m.s.visible = this.xray && !m.lifted && (!high || Math.sin(this.t * 13 + m.p.ph * 7) > -0.2);
    }
    if (this.xray && high && Math.random() < dt * 0.6) this.fakeMark();
    for (const f of P.fakes) { f.t -= dt; f.s.visible = this.xray && f.t > 0; }
    // drug-vision: the DJ's vial, or simply far enough gone
    this.dvision = Math.max(0, (this.dvision || 0) - dt);
    const uvOn = this.dvision > 0 || st.intox >= 60;
    P.uv.material.opacity += ((uvOn ? 0.95 : 0) - P.uv.material.opacity) * Math.min(1, dt * 3);
    if (uvOn && !this.dvisionWas) toast('Drug-vision: the walls are covered in glowing writing.', 'info');
    this.dvisionWas = uvOn;
    if (this.dvision <= 0 && st.intox < 60) this.dvision = 0;
    // super-hearing: the rings, the radios, the boss through his door
    for (let i = 0; i < P.rings.length; i++) {
      const r = P.rings[i];
      r.visible = this.hearing;
      if (!this.hearing) continue;
      const ph = (this.t * 0.8 + i * 0.5) % 1;
      r.position.set(this.hero.position.x, this.hero.position.y + 0.05, this.hero.position.z);
      r.scale.setScalar(0.6 + ph * 4.5);
      r.material.opacity = (1 - ph) * 0.55;
    }
    if (this.hearing) {
      this.radioT -= dt;
      if (this.radioT <= 0) {
        this.radioT = 5 + Math.random() * 4;
        const gd = this.guards.filter((q) => !q.ko).sort((a, b) => a.mesh.position.distanceTo(this.hero.position) - b.mesh.position.distanceTo(this.hero.position))[0];
        const s = gd && this.screenOf(gd.mesh.position, 2.2);
        if (s) { const txt = RADIO[Math.floor(Math.random() * RADIO.length)]; comic.say(high ? scramble(txt, 0.3) : txt, s.x, s.y, { kind: 'shout', speaker: 'RADIO', ms: 2600, anchor: () => this.screenOf(gd.mesh.position, 2.2) }); }
      }
      this.listenAtOffice?.(dt);
    }
    // visible powers draw the eye: a guard who sees glowing eyes notices faster
    if ((this.xray || this.hearing) && this.guards.some((g) => g.seeing)) this.alert = Math.min(100, this.alert + dt * 12);
  },

  fakeMark() {
    const P = this.pw, p = this.crowd.nearest(this.hero.position.x + (Math.random() - 0.5) * 8, this.hero.position.z - Math.random() * 6, 5, (q) => !q.carrier);
    if (!p) return;
    const s = P.marks[0]?.s.clone();
    if (!s) return;
    s.material = s.material.clone(); s.material.color.set(0xff70ff);
    s.position.set(p.x, 2.25, p.z); this.scene.add(s);
    P.fakes.push({ s, t: 1.5 + Math.random() * 2 });
    if (P.fakes.length > 6) { const f = P.fakes.shift(); f.s.removeFromParent(); f.s.material.dispose(); }
  },

  /** X-ray: every wall in the club goes glassy (not just the hall's), the hidden things show. */
  setXray(on) {
    if (on && this.en < 10) { toast('Not enough power', 'bad'); return; }
    if (on && this.undercover) { toast('No powers while you\'re undercover.', 'bad'); return; }
    this.xray = on;
    this.g.input.setButton('xray', { toggled: on });
    $('xray-tint').classList.toggle('on', on);
    for (const m of this.wallMats || []) {
      m.transparent = on; m.opacity = on ? 0.16 : 1; m.depthWrite = !on; m.needsUpdate = true;
    }
    for (const m of this.hidden) m.visible = on;
    if (this.safeGlow) this.safeGlow.visible = on && !this.safeDone;
    if (this.stashGlow) this.stashGlow.visible = on && !this.stashFound;
    if (on) sfx.xray();
  },

  setHearing(on) {
    if (on && this.en < 10) { toast('Not enough power', 'bad'); return; }
    if (on && this.undercover) { toast('No powers while you\'re undercover.', 'bad'); return; }
    this.hearing = on;
    this.g.input.setButton('hear', { toggled: on });
    if (on) { sfx.whoosh(); this.chatterT = Math.min(this.chatterT || 0, 0.6); }
  },
};
