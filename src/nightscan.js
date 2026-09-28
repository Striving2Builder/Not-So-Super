// Detective vision inside the 3D clubs (night cases and the asylum). Toggling X-ray drains the club
// to dark, desaturated navy (exposure + a CSS filter on the WebGL canvas, profile-gated) and draws a
// 2D scan layer over it: sealed containers glow orange through the walls with a data card, and
// every person shows a skeleton with a pulse readout. Owned by the zone; built on first use.
import { quality } from './settings.js';
import { $ } from './util.js';
import { paintSkeleton } from './crimescene.js';
import { SCAN, honey, scanGlyph, clueTag, pulseTag, drawScanTags } from './scanhud.js';

const LOOK = { exposure: 0.72, filter: 'saturate(.2) contrast(1.15)', tint: 'rgba(0,18,52,.26)', open: 420, sweep: 5.5, height: 1.75, bystanders: 2 };

export class NightScan {
  constructor(zone) { this.z = zone; this.cv = null; this.on = false; this.exposure = null; }

  set(on) {
    const r = this.z.renderer;
    if (on === this.on) return;
    this.on = on;
    this.at = performance.now();
    if (on) {
      if (!this.cv) {
        this.cv = document.createElement('canvas');
        this.cv.style.pointerEvents = 'none';
        $('three-host').appendChild(this.cv);
      }
      this.cv.style.display = 'block';
      $('xray-tint').classList.remove('on'); // this layer replaces the flat tint
      if (r) {
        this.exposure = r.toneMappingExposure; r.toneMappingExposure = this.exposure * LOOK.exposure;
        if (quality().scanFilter) r.domElement.style.filter = LOOK.filter;
      }
    } else {
      if (this.cv) this.cv.style.display = 'none';
      if (r) { if (this.exposure !== null) r.toneMappingExposure = this.exposure; r.domElement.style.filter = ''; }
      this.exposure = null;
    }
  }

  dispose() { this.set(false); if (this.cv) this.cv.remove(); this.cv = null; }

  /** People worth a skeleton: witness first (with their condition), then guards, informant, captives. */
  people() {
    const z = this.z, out = [];
    if (z.witness && z.witness.mesh) out.push({ o: z.witness.mesh, works: z.witness.talked ? null : z.witness.mood.works });
    for (const g of z.guards || []) if (!g.ko && g.mesh) out.push({ o: g.mesh, works: null });
    if (z.informant && z.informant.mesh) out.push({ o: z.informant.mesh, works: null });
    for (const c of z.captives || []) if (c.person) out.push({ o: c.person, works: null });
    return out;
  }

  draw(t) {
    if (!this.on || !this.cv) return;
    const z = this.z, W = z.g.w, H = z.g.h, dpr = Math.min(devicePixelRatio || 1, quality().dpr2d);
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (this.cv.width !== cw || this.cv.height !== ch) { this.cv.width = cw; this.cv.height = ch; }
    const g = this.cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const open = Math.min(1, (performance.now() - this.at) / LOOK.open);
    g.save();
    if (open < 1) { g.beginPath(); g.arc(W / 2, H / 2, open * Math.hypot(W, H) * 0.6, 0, Math.PI * 2); g.clip(); }
    g.fillStyle = LOOK.tint; g.fillRect(0, 0, W, H);
    // slow soft sweep
    const sx = -300 + ((t / LOOK.sweep) % 1) * (W + 600);
    const sg = g.createLinearGradient(sx - 260, 0, sx + 60, 0);
    sg.addColorStop(0, 'rgba(60,200,255,0)'); sg.addColorStop(0.8, 'rgba(90,215,255,.12)'); sg.addColorStop(1, 'rgba(60,200,255,0)');
    g.fillStyle = sg; g.fillRect(sx - 260, 0, 320, H);
    const tags = [];
    // skeletons, through walls
    let bystanders = 0;
    for (const p of this.people()) {
      const feet = z.screenOf(p.o.position, 0), head = z.screenOf(p.o.position, LOOK.height);
      if (!feet || !head) continue;
      const hpx = feet.y - head.y;
      if (hpx < 12 || feet.x < -40 || feet.x > W + 40 || head.y > H + 20 || feet.y < -20) continue;
      paintSkeleton(g, feet.x, feet.y, 2.1 * hpx / 190, t + feet.x);
      if (p.works || bystanders < LOOK.bystanders) {
        if (!p.works) bystanders++;
        tags.push(pulseTag({ x: head.x - hpx * 0.06, y: head.y + hpx * 0.2 }, p.works, t, Math.round(feet.x) % 7));
      }
    }
    // sealed evidence glowing orange through whatever is in the way
    for (const o of z.clueObjs || []) {
      if (!o.inner) continue;
      const s = z.screenOf(o.pos, 0.35), s1 = z.screenOf(o.pos, 1.35);
      if (!s || !s1) continue;
      const px = Math.max(40, Math.min(150, (s.y - s1.y) * 1.1));
      const col = o.clue.found ? SCAN.green : SCAN.orange;
      const hit = Math.max(0, 1 - Math.abs(sx - s.x) / 160);
      const rg = g.createRadialGradient(s.x, s.y, 4, s.x, s.y, px);
      rg.addColorStop(0, o.clue.found ? 'rgba(80,255,170,.35)' : 'rgba(255,150,40,.45)'); rg.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(s.x, s.y, px, 0, Math.PI * 2); g.fill();
      g.save(); g.globalAlpha = 0.4 + hit * 0.3; g.fillStyle = honey(g, col);
      g.beginPath(); g.rect(s.x - px * 0.55, s.y - px * 0.45, px * 1.1, px * 0.9); g.fill(); g.restore();
      g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(s.x - px * 0.55, s.y - px * 0.45, px * 1.1, px * 0.9);
      const gs = px * (0.85 + Math.sin(t * 4) * 0.04 + hit * 0.1);
      g.save(); g.shadowColor = col; g.shadowBlur = 18 + hit * 16; g.drawImage(scanGlyph(o.clue, col), s.x - gs / 2, s.y - gs / 2, gs, gs); g.restore();
      tags.push(clueTag({ x: s.x, y: s.y }, o.clue, z.case));
    }
    g.restore();
    if (open < 1) {
      g.strokeStyle = `rgba(160,245,255,${1 - open})`; g.lineWidth = 5; g.shadowColor = '#5fe8ff'; g.shadowBlur = 16;
      g.beginPath(); g.arc(W / 2, H / 2, open * Math.hypot(W, H) * 0.6, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
    }
    drawScanTags(g, tags, t, W, H);
  }
}
