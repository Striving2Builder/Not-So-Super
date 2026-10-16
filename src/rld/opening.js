// The night she lost the suit (docs/design/act2.md): Act 2 opens inside an RLD Walk. She wakes up
// tied up in one of the rooms, in the crop-top suit, her own suit gone; Polaroids of her scattered
// on the floor and a blackmail note beside her, about a videotape (a note and a cassette label only:
// nothing from the tape is shown). The easy struggle, then a first spray of the house perfume before
// she's out of the door. The clues point to the casinos. Mixed into RldWalk.prototype.
import * as THREE from 'three';
import { dialog, toast, banner } from '../ui.js';
import { sfx } from '../sfx.js';
import { HERO } from '../data.js';
import { pick, rand } from '../util.js';

const POL_CAPTIONS = ['SUPERGIRL?', 'ROOM 9 · 3:12 AM', 'SHE CAME WILLINGLY', 'WHO\'S THE HERO NOW', 'SMILE ♥'];
const NOTE = `<div class="h13-note" style="text-align:left">WE HAVE THE TAPE.<br><br>Every minute of last night, from the Gilded Cage to this room. Copies go to every paper in the city unless you do as you're told.<br><br>Stay out of our business. Smile for the cameras. We'll be in touch.<i>— a friend of the High-Roller Suite</i></div>`;

/** One Polaroid (a canvas): a red-lit room, a blonde figure on a bed in a crop top, a time stamp, a scrawl. */
function polaroid(caption) {
  const W = 200, H = 236, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, W, H);
  const x0 = 12, y0 = 12, w = W - 24, h = 176;
  const gr = g.createRadialGradient(x0 + w * 0.6, y0 + 40, 10, x0 + w / 2, y0 + h / 2, 150);
  gr.addColorStop(0, '#ff6a7a'); gr.addColorStop(0.5, '#8a0c22'); gr.addColorStop(1, '#1a0408');
  g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  // the bed, and her on it, slumped (shapes only: the flash caught her from across the room)
  g.fillStyle = '#f4c8d8'; g.fillRect(x0 + 16, y0 + 120, w - 32, 34);
  g.fillStyle = '#5a1020'; g.fillRect(x0 + 10, y0 + 96, 18, 58);
  const fx = x0 + 70 + rand(-10, 10);
  g.fillStyle = '#f2d24a'; g.beginPath(); g.ellipse(fx, y0 + 108, 16, 13, -0.4, 0, 7); g.fill();         // her hair
  g.fillStyle = '#e8b896'; g.beginPath(); g.arc(fx + 6, y0 + 112, 8, 0, 7); g.fill();
  g.fillStyle = '#7ec8f0'; g.fillRect(fx + 10, y0 + 108, 26, 14);                                          // the crop top
  g.fillStyle = '#d4183a'; g.fillRect(fx + 34, y0 + 108, 22, 15);                                          // the red skirt
  g.fillStyle = '#c01020'; g.fillRect(fx + 56, y0 + 114, 34, 7);                                           // red boots
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x0 + w - 22, y0 + 22, 16, 0, 7); g.fill(); // the flash
  g.fillStyle = '#ff9a3a'; g.font = 'bold 13px monospace'; g.fillText(`'26 10 1${Math.floor(rand(0, 9))}  3:${10 + Math.floor(rand(0, 49))}`, x0 + w - 104, y0 + h - 8);
  g.fillStyle = '#1a1a40'; g.font = 'italic 18px "Segoe Script", "Brush Script MT", cursive'; g.textAlign = 'center';
  g.fillText(caption, W / 2, H - 16, W - 20);
  return c;
}

export const openingMethods = {
  /** The props round where she wakes: Polaroids on the floor, the note and the cassette beside her. */
  placeOpening(room) {
    const S = this.scene, p = room.wake;
    this.opening = { room, polaroids: [], seenPols: false, readNote: false, pics: POL_CAPTIONS.slice(0, 4).map(polaroid) };
    const mats = this.opening.pics.map((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t }); });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3), r = rand(0.5, 1.1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.24).rotateX(-Math.PI / 2).rotateY(rand(0, 6)), mats[i % mats.length]);
      m.position.set(p.x + Math.cos(a) * r, 0.015 + i * 0.002, p.z + Math.sin(a) * r);
      m.raycast = () => {};
      S.add(m);
      this.opening.polaroids.push(m);
    }
    // the note (folded paper) and the cassette, by her hand
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.16), new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
    note.position.set(p.x + 0.35, 0.02, p.z - 0.3); note.rotation.y = 0.4; S.add(note);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.025, 0.12), new THREE.MeshLambertMaterial({ color: 0x141018 }));
    tape.position.set(p.x + 0.55, 0.02, p.z - 0.1); tape.rotation.y = -0.3; S.add(tape);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.5, depthWrite: false }));
    glow.position.set(p.x + 0.42, 0.03, p.z - 0.2); S.add(glow);
    this.anims.push((t) => { glow.material.opacity = this.opening.readNote && this.opening.seenPols ? 0 : 0.3 + 0.25 * Math.sin(t * 4); });
    this.addInter(new THREE.Vector3(p.x + 0.4, 0, p.z - 0.2), 'Read the note', () => true, () => this.readNote(), 'clue');
    this.addInter(new THREE.Vector3(p.x - 0.4, 0, p.z + 0.3), 'Pick up the Polaroids', () => !this.opening.seenPols, () => this.seePolaroids(), 'clue');
  },

  /** On her feet: the struggle first (easy), then the perfume from the door. */
  async runOpening() {
    const o = this.opening;
    this.busy = true;
    this.grace = Infinity;
    banner('WAKE UP', `Room ${o.room.num} · the red-light district`, '#ff6688');
    await new Promise((r) => setTimeout(r, 1300));
    if (this.g.mode !== this || this.done) return;
    await this.tiedStruggle({ title: 'TIED UP', text: `You come to on a red-lit floor, wrists tied to the bedpost. This isn't your suit. <b>Your suit is gone.</b>` });
    if (this.g.mode !== this || this.done) return;
    this.heroClip('getUp', 2.6);
    // the house perfume, straight from the vent over this room's door
    const v = this.vents.find((q) => q.room === o.room);
    if (v) this.emitPuff(v.top, new THREE.Vector3(0, -0.6, 0).addScaledVector(o.room.inward, 0.9), 16);
    this.g.state.intox = Math.max(this.g.state.intox, 30);
    this.spray(12, 'The door hisses as you reach it: the house perfume, right in your face.');
    this.busy = false;
    this.grace = this.t + 3;
    setTimeout(() => { if (!this.done) toast('Polaroids on the floor, and a note. Read them before you go (USE).', 'info'); }, 1600);
  },

  async seePolaroids() {
    const o = this.opening;
    o.seenPols = true;
    for (const m of o.polaroids) m.visible = false;
    sfx.paper?.();
    const imgs = o.pics.map((c) => `<img src="${c.toDataURL('image/jpeg', 0.85)}" style="width:23%;margin:0 1%;transform:rotate(${rand(-6, 6).toFixed(1)}deg)">`).join('');
    await dialog({ title: 'Polaroids', text: `<div style="text-align:center">${imgs}</div>Her, in this room, in a suit that isn't hers, out cold. Somebody took their time.<span class="hint">Evidence for the act board: the first clues of the night you lost.</span>` });
    this.g.act?.openingClue?.('polaroids');
    this.zone.clues = [...(this.zone.clues || []), 'polaroids'];
  },

  async readNote() {
    const o = this.opening, first = !o.readNote;
    o.readNote = true;
    sfx.paper?.();
    await dialog({ title: 'A note, and a cassette', cls: 'villain', text: `${NOTE}A cassette lies beside it. The label, in the same hand: <b>"SG · 3 AM · MASTER"</b>.<span class="hint">${pick(['The High-Roller Suite: the casino district.', 'Somebody at the casinos knows what happened last night.'])}</span>` });
    if (first) {
      this.g.act?.openingClue?.('note');
      this.zone.clues = [...(this.zone.clues || []), 'note'];
      toast(`The casinos. That's where ${HERO}'s night started.`, 'info');
    }
  },
};
