// Flashpoint's paparazzi (the case's `press`): Roxy Flash's photographers hunt her all night. Two
// work the press pit (they cover the catwalk and the stage), the rest roam the floor toward wherever
// she was last seen. A clear shot of her is scandal (more on the catwalk, less in Kara's coat, none
// hidden in the crowd); at 100 they've got their star: she's dragged to the hot seat (story.js's
// trap, played to the room on every screen). Mixed into Club3D.prototype.
import * as THREE from 'three';
import { basic } from '../zonekit.js';
import { npcLook } from '../art.js';
import { rand } from '../util.js';
import { toast } from '../ui.js';
import { sfx } from '../sfx.js';
import { comic } from '../comic.js';
import { onCatwalk } from './plan.js';

const DECAY = 4;      // scandal lost per second out of every lens
const SPEED = 1.6;    // a roaming photographer's walk

export const pressMethods = {
  placePress() {
    const P = this.caseDef.press, V = this.plan.V, pit = V.press || { x: 0, z: V.hd - 8 };
    this.pap = [];
    for (let i = 0; i < P.n; i++) {
      const inPit = i < 2;
      const x = inPit ? pit.x + (i ? 3 : -3) : rand(-V.hw * 0.6, V.hw * 0.6), z = inPit ? pit.z : rand(-V.hd * 0.5, V.hd * 0.4);
      const m = this.npc({ ...npcLook('civilian'), top: i % 2 ? '#2a2a2a' : '#3a1a22', bottom: '#1a1a1a', skirt: null, hairStyle: 'cap' }, x, z, Math.PI);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(P.range, 20, -Math.PI / 2 - P.fov / 2, P.fov).rotateX(-Math.PI / 2), basic(0x7fd0ff, { transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = 0.05; m.add(cone);
      this.pap.push({ m, cone, pit: inPit, home: { x, z }, tx: x, tz: z, t: rand(0, 3), flashT: rand(0.5, 2), seen: null });
    }
    this._castPos = null;
  },

  stepPress(dt) {
    if (!this.pap || this.busy || this.sedating) return;
    const P = this.caseDef.press, V = this.plan.V, h = this.hero.position;
    let shots = 0;
    for (const p of this.pap) {
      const m = p.m;
      // roamers walk toward where she was last seen (she's in a side room: they wait in the hall)
      if (!p.pit) {
        p.t += dt;
        if (p.t > 3.5) {
          p.t = 0;
          const tgt = this.room ? p.seen || p.home : h;
          p.tx = Math.max(-V.hw + 2, Math.min(V.hw - 2, tgt.x + rand(-4, 4)));
          p.tz = Math.max(-V.hd + 3, Math.min(V.hd - 3, tgt.z + rand(1, 5)));
          if (onCatwalk(V, p.tx, p.tz, 0.6)) p.tx += p.tx < 0 ? -3 : 3;
        }
        const dx = p.tx - m.position.x, dz = p.tz - m.position.z, d = Math.hypot(dx, dz);
        if (d > 0.4) {
          m.position.x += (dx / d) * SPEED * dt; m.position.z += (dz / d) * SPEED * dt;
          const s = Math.sin(this.t * 8) * 0.4; if (m.legs) { m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s; }
        }
      }
      // the lens swings toward her (not instantly: she can slip out of frame)
      const fx = h.x - m.position.x, fz = h.z - m.position.z, fd = Math.hypot(fx, fz);
      let da = Math.atan2(fx, fz) - m.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (fd < P.range * 1.6) m.rotation.y += da * Math.min(1, dt * 1.4);
      const sees = fd < P.range && Math.abs(da) < P.fov / 2 && !this.room && this.clearLOS(m.position, h);
      p.cone.material.color.set(sees ? 0xffffff : 0x7fd0ff); p.cone.material.opacity = sees ? 0.32 : 0.14;
      if (!sees) continue;
      shots++;
      p.seen = { x: h.x, z: h.z };
      p.flashT -= dt;
      if (p.flashT <= 0) {
        p.flashT = rand(0.35, 1.0);
        const s = this.screenOf(m.position, 1.8);
        if (s) comic.pow('FLASH', s.x, s.y, { size: 0.5, colors: ['#ffffff', '#7fd0ff'] });
        sfx.shutter();
      }
    }
    if (shots) {
      const k = (onCatwalk(V, h.x, h.z) ? P.catwalk : 1) * (this.undercover ? 0.45 : 1) * (1 + 0.35 * (shots - 1));
      const was = this.scandal;
      this.scandal = Math.min(100, this.scandal + P.rate * k * dt);
      if (was < 60 && this.scandal >= 60) toast('The flashes are all on you. Get into the crowd!', 'bad');
      if (was < 35 && this.scandal >= 35 && !this._papCard) { this._papCard = true; this.addCard('paparazzi', 'Paparazzi shots: Supergirl at Flashpoint'); }
    } else this.scandal = Math.max(0, this.scandal - DECAY * dt);
    if (this.scandal >= 100) this.run(() => this.hotSeat());
  },

  /** Scandal 100: Roxy's crew drags her up onto the stage and straps her into the hot seat. */
  async hotSeat() {
    if (this.sedating || this.done) return;
    this.sedating = true;
    const S = this.hallA.hotSeat || { x: 0, z: 0 };
    this.hero.position.set(S.x, 0, S.z + 0.4); this.hero.rotation.y = 0; this.camSnap = true;
    toast('"THERE SHE IS!" Roxy\'s crew grabs her out of the crowd.', 'bad');
    await this.storyTrap('The cameras have her.');
    this.scandal = 30;
  },
};
