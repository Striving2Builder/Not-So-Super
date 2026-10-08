// Undercover (docs/design/nightclub.md "Undercover"): she can go in as Kara, in a long dark coat
// over the costume (the cape tucked away). Nobody recognises her and she blends in better, but her
// powers stay off until she changes in a restroom stall: the phone-booth moment. If anyone sees
// her change, the cover's blown at once.
import * as THREE from 'three';
import { toon, inkCharacter } from '../look3d.js';
import { dialog, toast, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';

export const undercoverMethods = {
  async askUndercover() {
    const q = new URLSearchParams(location.search).get('club3under');
    const v = q != null ? q === '1' : await dialog({ title: 'How do you go in?', text: `The line outside is round the block. ${HERO} or Kara?`, options: [
      { label: `As ${HERO}`, note: 'Powers on · people recognise you · some doors open for a famous face', value: false },
      { label: 'Undercover, as Kara', note: 'Nobody looks twice · you blend in better · no powers until you change in the restroom', value: true },
    ] });
    if (v) this.goUndercover();
  },

  goUndercover() {
    this.undercover = true;
    if (!this.coat) {
      // a long coat over the costume: an open cone from the shoulders to the knees, inked
      const g = new THREE.CylinderGeometry(0.2, 0.34, 1.08, 14, 1, true);
      const coat = (this.coat = new THREE.Mesh(g, toon(0x26232c, { side: THREE.DoubleSide })));
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.21, 0.16, 12, 1, true), toon(0x1a181f, { side: THREE.DoubleSide }));
      collar.position.y = 0.58; coat.add(collar);
      inkCharacter(coat, { rim: 0xfff0d0, outline: true });
      this.hero.add(coat);
    }
    this.coat.visible = true;
    if (this.heroModel) this.heroModel.cape.mesh.visible = false;
    this.g.input.setButton('xray', { dim: true }); this.g.input.setButton('hear', { dim: true });
    this.anims.push(this.coatFollow || (this.coatFollow = () => {
      if (!this.coat?.visible || !this.heroModel) return;
      const hips = this.heroModel.bones.Hips;
      if (hips) { hips.getWorldPosition(this._cv || (this._cv = new THREE.Vector3())); this.coat.position.set(0, this._cv.y - this.hero.position.y + 0.18, 0.01); }
    }));
    toast('Undercover: nobody\'s looking at you. Change in the restroom when you need your powers.', 'info');
  },

  async suitUp() {
    const seen = !this.fought?.restroom && Math.random() < 0.3;
    toast('The middle stall: you bolt the door. Coat off, cape out…', 'info');
    this.undercover = false;
    this.coat.visible = false;
    if (this.heroModel) this.heroModel.cape.mesh.visible = true;
    this.g.input.setButton('xray', { dim: false }); this.g.input.setButton('hear', { dim: false });
    sfx.whoosh();
    if (seen) {
      this.alert = Math.max(this.alert, 75);
      this.recog = 100;
      banner('COVER BLOWN!', 'Someone saw the cape come out', '#ff3fb8');
      this.addCard('fans', `${HERO} changing in a restroom stall`);
      return;
    }
    banner(HERO.toUpperCase(), 'Powers back on', '#7ec8f4');
  },
};
