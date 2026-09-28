// Street-fight actor drawing (mixed into Brawler.prototype): the heroine's 3D sprite with ink and
// key poses, the baked crook sprites with headgear and props, captives, breakables, pickups, fires.
import { drawHumanoid, pose, HERO_LOOK, glow } from './art.js';
import { rand } from './util.js';
import { heroReady, HeroSprite } from './hero3d.js';
import { INK } from './brawlstage.js';
import { frame as spriteFrame, inkOutline, SPAN, LIFT, LOOKS } from './brawlsprite.js';
import { M, HERO_SCALE, CROOK_SCALE, BREAK } from './brawldata.js';

export const actorDraw = {
  drawShadow(ctx, x, y, s, w = 24, air = 0, alpha = 1) {
    const f = Math.max(0.35, 1 - air / 320);
    ctx.globalAlpha = 0.55 * f * alpha;
    const rw = w * s * f * 1.25, rh = 7 * s * f;
    ctx.drawImage(shadowSprite(), x - rw, y - rh, rw * 2, rh * 2);
    ctx.globalAlpha = 1;
  },

  drawPlayer(ctx, x, y, s) {
    const p = this.p;
    if (p.inv > 0 && p.st !== 'down' && Math.sin(this.t * 40) > 0.3) return;
    if (heroReady()) { this.drawPlayerModel(ctx, x, y, s); return; }
    let P;
    switch (p.st) {
      case 'walk': P = pose('walk', this.t); break;
      case 'attack': P = pose(p.combo === 3 ? 'kick' : p.combo === 2 ? 'punch2' : 'punch1'); break;
      case 'flykick': P = pose('flykick'); break;
      case 'hurt': P = pose('hurt'); break;
      case 'down': P = pose('down'); break;
      case 'beam': P = pose('beam'); break;
      case 'breath': P = pose('breath'); break;
      default: P = p.y > 0 ? pose('jump') : pose('idle', this.t);
    }
    this.inkedHumanoid(ctx, x, y - p.y * s, s, p.facing, { ...HERO_LOOK, cape: HERO_LOOK.cape }, P);
    this.drawSwing(ctx, x, y, s);
  },

  /** Rigged 3D Supergirl rendered side-on as a sprite, clip chosen from the fight state. */
  drawPlayerModel(ctx, x, y, s) {
    const p = this.p;
    if (!this.sprite) this.sprite = new HeroSprite(220, 300);
    // The 3D render + readback is the priciest thing in a frame: animate her at 30 Hz (arcade sprites run
    // slower still), but re-render at once whenever her state changes so hits stay frame-exact.
    const now = performance.now();
    this.heroN = (this.heroN || 0) + 1;
    const due = !this.heroCopy || this.heroN % 2 === 0 || now - (this.heroAt || 0) > 70 || p.st !== this.heroSt || p.combo !== this.heroCombo || p.facing !== this.heroFacing;
    if (due) {
    this.heroAt = now; this.heroSt = p.st; this.heroCombo = p.combo; this.heroFacing = p.facing;
    const H = this.sprite.hero;
    switch (p.st) {
      case 'walk': if (p.vertical) H.pose('jog', this.t * 1.1); else H.pose('run', this.t * 0.95); break;
      case 'attack': {
        // Real clips, time-mapped so the blow lands inside the hit window (st_t 0.06–0.16):
        // 1 = left jab, 2 = right cross (both from "Fist Fight A"), 3 = front-kick finisher ("Kick").
        const u = Math.min(1, p.st_t / (p.combo === 3 ? 0.36 : 0.24));
        if (p.combo === 1) H.pose('punch', 1.30 + u * 0.37);
        else if (p.combo === 2) H.pose('punch', 2.05 + u * 0.5);
        else H.pose('kick2', 0.30 + u * 0.7);
        break;
      }
      case 'flykick': H.pose('kick2', 0.67); break;
      case 'hurt': H.pose('hit', 0.15 + p.st_t * 1.6); break;
      case 'down': H.pose(p.hp > 0 && p.st_t > 0.5 ? 'getUp' : 'fallFlat', p.hp > 0 && p.st_t > 0.5 ? 4 + (p.st_t - 0.5) * 6 : 0.6 + p.st_t * 1.8); break;
      case 'beam': case 'breath': H.pose('punch', 1.2); break;
      default:
        // Guard up (fists raised, wide stance, chin up) while crooks are about; the hands-on-hips hero
        // pose when the street is clear. (combatIdle hangs her head: it read as dejected.)
        if (p.y > 0) H.pose('jump', 1.0);
        else if (this.enemies.some((e) => !e.dead && Math.abs(e.x - p.x) < 520)) H.pose('punch', 1.16 + Math.sin(this.t * 3) * 0.04);
        else H.pose('pose', 0.5 + this.t * 0.4);
    }
    // Cape wind: running pushes it out behind her; jumping/falling lifts it.
    const run = p.st === 'walk' ? 7 : p.st === 'attack' || p.st === 'flykick' ? 3 : 0.8;
    H.setWind(Math.sin(this.t * 1.7) * 0.8, p.y > 0 ? (p.vy < 0 ? 9 : -3) : 0.5, -run);
    // Fighting moves always face the enemy side-on; walking uses the smoothed movement heading.
    const sideOn = p.st !== 'walk' && p.st !== 'idle';
    // three-quarter turn toward the viewer (emblem and face read) instead of flat profile
    const q = p.facing > 0 ? Math.PI / 2 - 0.4 : -Math.PI / 2 + 0.4;
    const yaw = sideOn ? q : (p.yaw ?? q);
    const img = this.sprite.render({ view: 'side', yaw, span: 2.6, lift: 0.12 });
    // one readback of the WebGL canvas into 2D, then outline from the copy (each WebGL drawImage is a readback)
    if (!this.heroCopy) { this.heroCopy = document.createElement('canvas'); this.heroCopy.width = img.width; this.heroCopy.height = img.height; this.hcx = this.heroCopy.getContext('2d'); }
    this.hcx.clearRect(0, 0, img.width, img.height); this.hcx.drawImage(img, 0, 0);
    // ink it once per render (not per frame): 3 px outline in sprite pixels, 4 px padding
    if (!this.heroInk) { this.heroInk = document.createElement('canvas'); this.heroInk.width = img.width + 8; this.heroInk.height = img.height + 8; this.hix = this.heroInk.getContext('2d'); }
    this.hix.clearRect(0, 0, this.heroInk.width, this.heroInk.height);
    inkOutline(this.hix, this.heroCopy, img.width, img.height, 3, 4, 4);
    }
    // Sprite frame is 2.6 m tall at 54 units per metre.
    const hpx = 2.6 * M * s * HERO_SCALE, wpx = hpx * (220 / 300);
    const top = y - p.y * s - hpx * (1 - 0.12 / 2.6);
    // hero rim light: a warm back-glow so she pops off the set
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18;
    ctx.drawImage(glow('#ffd070'), x - wpx * 0.5, top + hpx * 0.1, wpx, hpx * 0.8);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const hc = this.heroCopy;
    const pk = wpx / 220;
    ctx.drawImage(this.heroInk, x - wpx / 2 - 4 * pk, top - 4 * pk, wpx + 8 * pk, hpx + 8 * pk);
    if (p.flash > 0) { p.flash -= 1 / 60; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(hc, x - wpx / 2, top, wpx, hpx); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    this.drawSwing(ctx, x, y, s);
    if (p.st === 'breath') {
      ctx.fillStyle = 'rgba(200,240,255,.6)';
      ctx.beginPath(); ctx.arc(x + p.facing * 14 * s, y - 88 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    }
  },

  /** Impact smears: a white arc trailing the fist/boot during the active frames. */
  drawSwing(ctx, x, y, s) {
    const p = this.p;
    let u = -1, r = 0, hy = 0, big = false;
    if (p.st === 'attack' && p.st_t > 0.03 && p.st_t < 0.17) { u = (p.st_t - 0.03) / 0.14; big = p.combo === 3; r = (big ? 62 : 50) * s; hy = (big ? 60 : 82) * s; }
    else if (p.st === 'flykick') { u = 0.6; r = 58 * s; hy = 45 * s; big = true; }
    if (u < 0) return;
    const cx = x + p.facing * 6 * s, cy = y - p.y * s - hy;
    const a0 = p.facing > 0 ? -0.9 : Math.PI + 0.9, sweep = 1.5 * p.facing;
    ctx.save();
    ctx.globalAlpha = 0.85 * (1 - u * 0.6);
    ctx.fillStyle = big ? '#fff3b0' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + sweep * (0.35 + u * 0.65), p.facing < 0);
    ctx.arc(cx, cy, r * 0.72, a0 + sweep * (0.35 + u * 0.65), a0, p.facing > 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.globalAlpha *= 0.6; ctx.stroke();
    ctx.restore();
  },

  drawEnemy(ctx, e, x, y, s) {
    s *= CROOK_SCALE;
    let alpha = e.alpha != null ? e.alpha : 1;
    if (e.dead) alpha *= Math.max(0, 1 - e.st_t / 0.9) * (Math.sin(e.st_t * 40) > 0 ? 1 : 0.35);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const jitter = e.flash > 0 ? rand(-2, 2) * s : 0;
    const fy = y - e.y * s;
    const f = this.enemyFrame(e);
    const scale = e.look.size || 1;
    let head = 108 * scale * s, hand = null;
    if (f) {
      const hpx = SPAN * M * s, wpx = hpx * (f.img.width / f.img.height), top = fy - hpx * (1 - LIFT / SPAN);
      // knocked down: the clip falls face-first, so flip it to fly away from the blow
      const dir = e.st === 'down' || e.st === 'getup' || e.dead ? -e.facing : e.facing;
      const ox = -wpx / 2 - (f.shift || 0) * M * s;
      ctx.save(); ctx.translate(x + jitter, 0); ctx.scale(dir, 1);
      if (e.scorch > 0) ctx.filter = `brightness(${0.35 + (1 - Math.min(1, e.scorch)) * 0.65}) sepia(0.5)`;
      ctx.drawImage(f.img, ox, top, wpx, hpx);
      if (e.scorch > 0) ctx.filter = 'none';
      if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.85; ctx.drawImage(f.img, ox, top, wpx, hpx); ctx.globalCompositeOperation = 'source-over'; }
      if (f.head && f.top) this.drawHeadgear(ctx, e, f, fy, s);
      ctx.restore();
      ctx.globalAlpha = alpha;
      if (f.head) head = (Math.max(f.head[1], f.top ? f.top[1] : 0) + 0.25) * M * s;
      e.drawDir = dir;
      if (f.hand) hand = [x + dir * f.hand[0] * M * s, fy - f.hand[1] * M * s];
    } else {
      let P;
      switch (e.st) {
        case 'wind': P = pose('wind'); break;
        case 'strike': P = pose(e.type === 'brute' || e.type === 'boss' ? 'punch2' : 'punch1'); break;
        case 'hurt': P = pose('hurt'); break;
        case 'down': case 'getup': P = pose('down'); break;
        case 'aim': P = pose('aim'); break;
        case 'charge': P = e.st_t < 0.6 ? pose('wind') : pose('run', this.t); break;
        case 'frozen': P = pose('hurt'); break;
        case 'enter': P = e.entry === 'drop' ? pose('jump') : pose('run', this.t); break;
        default: P = pose(e.moving ? 'walk' : 'idle', this.t + e.x * 0.01);
      }
      if (e.dead) P = pose('down');
      this.inkedHumanoid(ctx, x + jitter, fy, s, e.facing, e.look, P);
      hand = [x + e.facing * 30 * s * scale, fy - 72 * s * scale];
    }
    // held weapons ride the baked hand anchor
    if (hand && !e.dead && e.st !== 'down' && e.st !== 'frozen') {
      const [hx, hy] = hand;
      if (e.type === 'knife') {
        ctx.save(); ctx.translate(hx, hy); ctx.scale(e.facing, 1); ctx.rotate(e.st === 'strike' ? 0 : -0.6);
        ctx.fillStyle = '#e8eef4'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, -1.5 * s); ctx.lineTo(16 * s, -0.5 * s); ctx.lineTo(0, 2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2418'; ctx.fillRect(-6 * s, -1.8 * s, 6 * s, 3.6 * s);
        if (e.st === 'wind' && Math.sin(this.t * 30) > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffffff'), 6 * s, -8 * s, 16 * s, 16 * s); ctx.globalCompositeOperation = 'source-over'; }
        ctx.restore();
      } else if (e.type === 'gunman' || (e.type === 'boss' && e.st === 'aim')) {
        ctx.save(); ctx.translate(hx, hy); ctx.scale(e.facing, 1);
        ctx.fillStyle = '#1c1c22'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.fillRect(-2 * s, -3 * s, 15 * s, 4.5 * s); ctx.fillRect(-2 * s, -3 * s, 4 * s, 9 * s);
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, -2.6 * s, 12 * s, 1.2 * s);
        ctx.restore();
      } else if (e.type === 'arsonist') {
        ctx.save(); ctx.translate(hx, hy);
        ctx.fillStyle = '#4a8a3a'; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.fillRect(-3 * s, -9 * s, 6 * s, 12 * s); ctx.strokeRect(-3 * s, -9 * s, 6 * s, 12 * s);
        ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ff8a30'), -9 * s, -24 * s, 18 * s, 18 * s);
        ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.ellipse(0, -13 * s + Math.sin(this.t * 20) * s, 2.4 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    if (e.st === 'frozen') {
      const hh = 112 * scale * s;
      ctx.fillStyle = 'rgba(170,230,255,.45)'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 26 * s, y); ctx.lineTo(x - 30 * s, y - hh * 0.6); ctx.lineTo(x - 18 * s, y - hh); ctx.lineTo(x + 22 * s, y - hh * 1.02); ctx.lineTo(x + 30 * s, y - hh * 0.5); ctx.lineTo(x + 26 * s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(x - 16 * s, y - hh * 0.8); ctx.lineTo(x - 8 * s, y - hh * 0.3); ctx.stroke();
    }
    // wind-up tell: a red "!" and a flash glint
    if ((e.st === 'wind' || (e.st === 'charge' && e.st_t < 0.6) || e.st === 'aim') && Math.sin(this.t * 30) > -0.3) {
      const ty = fy - head - 18 * s;
      ctx.font = `900 ${26 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('!', x, ty); ctx.fillStyle = '#ff3030'; ctx.fillText('!', x, ty);
    }
    if (e.st === 'aim') {
      // short telegraph from the muzzle + a glint that sharpens as the shot comes
      const ay = hand ? hand[1] : fy - 72 * s, ax = (hand ? hand[0] : x) + e.facing * 14 * s, u = Math.min(1, e.st_t / 0.75);
      const gr = ctx.createLinearGradient(ax, 0, ax + e.facing * 150, 0); gr.addColorStop(0, `rgba(255,60,40,${0.3 + u * 0.5})`); gr.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + e.facing * 150, ay); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; const gs = (6 + u * 14) * s; ctx.drawImage(glow('#ffffff'), ax - gs / 2, ay - gs / 2, gs, gs); ctx.globalCompositeOperation = 'source-over';
    }
    // health tag (SoR style): name + inked bar, shown for a while after taking a hit
    if (!e.def.boss && !e.dead && (e.barT > 0 || e.hp < e.max) && e.st !== 'enter') {
      const bw = 46 * s, bx = x - bw / 2, by = fy - head - 8 * s;
      ctx.fillStyle = INK; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, 5 * s + 3);
      ctx.fillStyle = '#5a1020'; ctx.fillRect(bx, by, bw, 5 * s);
      ctx.fillStyle = e.hp / e.max > 0.35 ? '#ffd23f' : '#ff4d4d'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.max), 5 * s);
      if (e.barT > 0) {
        ctx.font = `900 ${9 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
        ctx.strokeText(e.def.name, x, by - 3 * s); ctx.fillStyle = '#fff'; ctx.fillText(e.def.name, x, by - 3 * s);
      }
    }
    ctx.globalAlpha = 1;
  },

  /**
   * Hats, bandanas, shades and an angry comic face on the baked head anchor (drawn in the sprite's own
   * mirrored space): the low-poly crooks get personality and crews read apart at a glance.
   */
  drawHeadgear(ctx, e, f, fy, s) {
    const L = LOOKS[e.type];
    if (!L || !L.hat) return;
    const m = M * s;
    const hx = f.head[0] * m, hy = fy - f.head[1] * m, tx = f.top[0] * m, ty = fy - f.top[1] * m;
    const ux = tx - hx, uy = ty - hy, len = Math.hypot(ux, uy) || 1;
    const r = len * 0.62, ang = Math.atan2(uy, ux) + Math.PI / 2;
    const cx = hx + ux * 0.45, cy = hy + uy * 0.45;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, 1.6 * s);
    const down = e.st === 'down' || e.dead;
    // face on the 3/4 side toward the viewer (+x in sprite space)
    if (L.model !== 'riddler') {
      const ex = r * 0.42, ey = r * 0.02;
      if (down) { ctx.beginPath(); for (const d of [-1, 1]) { ctx.moveTo(ex + d * r * 0.2 - r * 0.08, ey - r * 0.08); ctx.lineTo(ex + d * r * 0.2 + r * 0.08, ey + r * 0.08); ctx.moveTo(ex + d * r * 0.2 + r * 0.08, ey - r * 0.08); ctx.lineTo(ex + d * r * 0.2 - r * 0.08, ey + r * 0.08); } ctx.stroke(); }
      else {
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.ellipse(ex - r * 0.16, ey, r * 0.07, r * 0.12, 0, 0, Math.PI * 2); ctx.ellipse(ex + r * 0.2, ey, r * 0.06, r * 0.11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ex - r * 0.32, ey - r * 0.26); ctx.lineTo(ex - r * 0.04, ey - r * 0.14); ctx.moveTo(ex + r * 0.06, ey - r * 0.14); ctx.lineTo(ex + r * 0.34, ey - r * 0.24); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - r * 0.12, ey + r * 0.42); ctx.quadraticCurveTo(ex + r * 0.05, ey + r * 0.34, ex + r * 0.22, ey + r * 0.44); ctx.stroke();
        if (L.beard) { ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(ex, ey + r * 0.55, r * 0.42, r * 0.3, 0, 0, Math.PI); ctx.fill(); ctx.stroke(); }
      }
    }
    const col = L.hatCol || '#333';
    if (L.hat === 'cap') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.1); ctx.quadraticCurveTo(r * 1.3, -r * 0.14, r * 1.45, r * 0.05); ctx.lineTo(r * 0.7, r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-r * 0.5, -r * 0.8, r * 0.3, r * 0.12);
    } else if (L.hat === 'beanie') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 1.04, Math.PI, 0); ctx.lineTo(r * 1.04, r * 0.08); ctx.lineTo(-r * 1.04, r * 0.08); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a5a64'; ctx.fillRect(-r * 1.04, -r * 0.16, r * 2.08, r * 0.26); ctx.strokeRect(-r * 1.04, -r * 0.16, r * 2.08, r * 0.26);
    } else if (L.hat === 'bandana') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(r * 0.98, -r * 0.1); ctx.lineTo(-r * 0.98, -r * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.2); ctx.lineTo(-r * 1.6, r * 0.2 + Math.sin(this.t * 12) * r * 0.1); ctx.lineTo(-r * 1.35, r * 0.4); ctx.lineTo(-r * 0.9, r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-0.4, -0.55], [0.1, -0.7], [0.5, -0.45]]) { ctx.beginPath(); ctx.arc(dx * r, dy * r, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
    } else if (L.hat === 'shades' && !down) {
      ctx.fillStyle = '#0a0a10'; ctx.beginPath(); ctx.roundRect(r * 0.1, -r * 0.2, r * 0.8, r * 0.3, r * 0.1); ctx.fill();
      ctx.fillStyle = 'rgba(160,220,255,.7)'; ctx.fillRect(r * 0.2, -r * 0.16, r * 0.25, r * 0.06);
    }
    ctx.restore();
  },

  /** Which baked sprite frame shows this crook right now. */
  enemyFrame(e) {
    const t = e.type;
    let anim = 'idle', u = this.t * 0.8 + e.phase;
    const brute = t === 'brute';
    switch (e.st) {
      case 'enter': if (e.entry === 'drop') { anim = 'jump'; u = 0.5 + Math.max(-0.5, Math.min(0.5, -e.vy / 900)); } else { anim = e.entry === 'run' ? 'run' : 'walk'; u = e.phase; } break;
      case 'approach': if (e.landT > 0) { e.landT -= 1 / 60; anim = 'fall'; u = 0; } else if (e.moving) { anim = e.def.spd > 140 ? 'run' : 'walk'; u = e.phase; } break;
      case 'wind': if (brute) { anim = 'kick'; u = (e.st_t / 0.42) * 0.3; } else { anim = 'wind'; u = e.st_t / (e.def.boss ? 0.5 : 0.42); } break;
      case 'strike': if (brute) { anim = 'kick'; u = 0.4 + Math.min(1, e.st_t / 0.12) * 0.6; } else { anim = 'strike'; u = Math.min(1, e.st_t / 0.1); } break;
      case 'aim': anim = 'strike'; u = 1; break;
      case 'charge': if (e.st_t < 0.6) { anim = 'wind'; u = 0.3; } else { anim = 'run'; u = this.t * 1.6; } break;
      case 'hurt': anim = 'hit'; u = e.st_t / 0.3; break;
      case 'down': anim = 'fall'; u = e.landed ? 1 : Math.min(0.85, e.st_t / 0.55); break;
      case 'getup': anim = 'getup'; u = e.st_t / 0.5; break;
      case 'frozen': return e.lastFrame || null;
    }
    if (e.dead) { anim = 'fall'; u = 1; }
    const f = spriteFrame(t, anim, u);
    if (f) e.lastFrame = f;
    return f || (e.lastFrame && e.st !== 'enter' ? e.lastFrame : null);
  },

  /** Procedural figure with the same ink outline as the baked sprites (captives, fallbacks). */
  inkedHumanoid(ctx, x, y, s, facing, look, P) {
    const dpr = this.stage.dpr || 1, sz = look.size || 1;
    const w = 130 * s * sz, h = 150 * s * sz;
    if (!this.scratch) { this.scratch = document.createElement('canvas'); this.sctx = this.scratch.getContext('2d'); }
    const cw = Math.ceil(w * dpr), ch = Math.ceil(h * dpr);
    if (this.scratch.width < cw || this.scratch.height < ch) { this.scratch.width = Math.max(cw, this.scratch.width); this.scratch.height = Math.max(ch, this.scratch.height); }
    const c = this.sctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.scratch.width, this.scratch.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHumanoid(c, w / 2, h - 12 * s * sz, s, facing, look, P, this.t);
    // outline only the used region: draw via a sub-rect copy
    if (!this.scratch2) { this.scratch2 = document.createElement('canvas'); }
    const s2 = this.scratch2;
    if (s2.width !== cw || s2.height !== ch) { s2.width = cw; s2.height = ch; }
    const g2 = s2.getContext('2d'); g2.clearRect(0, 0, cw, ch); g2.drawImage(this.scratch, 0, 0, cw, ch, 0, 0, cw, ch);
    inkOutline(ctx, s2, w, h, 1.4, x - w / 2, y - h + 12 * s * sz);
  },

  drawCaptive(ctx, c, x, y, s) {
    if (c.done) {
      if (c.run > 2.5) return;
      this.inkedHumanoid(ctx, x, y, s, -1, c.look, pose('run', this.t));
      return;
    }
    this.inkedHumanoid(ctx, x, y, s, 1, c.look, pose('sitFloor', this.t));
    // comic "HELP!" balloon
    const bob = Math.sin(this.t * 4) * 3;
    const label = c.blocked ? 'TRAPPED BY FIRE!' : 'HELP!';
    ctx.font = `900 ${12 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 14 * s, th = 20 * s, bx = x + 10 * s, by = y - 92 * s + bob;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(bx, by, tw / 2, th / 2 + 2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 8 * s, by + th / 2 - 1 * s); ctx.lineTo(x - 2 * s, y - 62 * s); ctx.lineTo(bx + 2 * s, by + th / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 7 * s, by + th / 2 - 3.5 * s, 9 * s, 3 * s);
    ctx.fillStyle = c.blocked ? '#d8122e' : INK; ctx.fillText(label, bx, by + 1);
    ctx.textBaseline = 'alphabetic';
    if (c.freed > 0) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.arc(x, y - 118 * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3ee08a'; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.arc(x, y - 118 * s, 12 * s, -Math.PI / 2, -Math.PI / 2 + c.freed * Math.PI * 2); ctx.stroke();
    }
  },

  drawBreakable(ctx, b, x, y, s) {
    const d = BREAK[b.kind], w = d.w * s, h = d.h * s;
    ctx.save(); ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const L = -w / 2, T = -h;
    if (b.kind === 'can') {
      const gr = ctx.createLinearGradient(L, 0, L + w, 0); gr.addColorStop(0, '#6a747c'); gr.addColorStop(0.35, '#b8c2ca'); gr.addColorStop(1, '#4a545c');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(L + 2 * s, T + 6 * s); ctx.lineTo(L + w - 2 * s, T + 6 * s); ctx.lineTo(L + w - 4 * s, 0); ctx.lineTo(L + 4 * s, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L + (w * i) / 4, T + 8 * s); ctx.lineTo(L + (w * i) / 4, -2 * s); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = '#8a949c'; ctx.beginPath(); ctx.ellipse(0, T + 5 * s, w / 2 + 1 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5c666e'; ctx.fillRect(-4 * s, T - 1 * s, 8 * s, 4 * s);
    } else if (b.kind === 'crate') {
      ctx.fillStyle = '#b07a44'; ctx.fillRect(L, T, w, h); ctx.strokeRect(L, T, w, h);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(L, T, w, 5 * s); ctx.fillRect(L, -5 * s, w, 5 * s);
      ctx.beginPath(); ctx.moveTo(L + 3 * s, T + 5 * s); ctx.lineTo(L + w - 3 * s, -5 * s); ctx.moveTo(L + w - 3 * s, T + 5 * s); ctx.lineTo(L + 3 * s, -5 * s); ctx.stroke();
      ctx.strokeRect(L, T, w, h);
    } else if (b.kind === 'barrel') {
      const gr = ctx.createLinearGradient(L, 0, L + w, 0); gr.addColorStop(0, '#8a2a20'); gr.addColorStop(0.35, '#e0503a'); gr.addColorStop(1, '#6a1a14');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(L, T, w, h, 5 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(L, T + h * 0.25, w, 3 * s); ctx.fillRect(L, T + h * 0.7, w, 3 * s);
      ctx.fillStyle = '#ffe14a'; ctx.font = `900 ${9 * s}px Impact, system-ui`; ctx.textAlign = 'center'; ctx.fillText('☢', 0, T + h * 0.56);
    } else {
      ctx.fillStyle = '#1e3cff'; ctx.fillRect(L, T, w, h - 6 * s); ctx.strokeRect(L, T, w, h - 6 * s);
      ctx.fillStyle = '#dfe8f0'; ctx.fillRect(L + 3 * s, T + 4 * s, w - 6 * s, 12 * s); ctx.strokeRect(L + 3 * s, T + 4 * s, w - 6 * s, 12 * s);
      ctx.fillStyle = INK; ctx.fillRect(L + 3 * s, -6 * s, 3 * s, 6 * s); ctx.fillRect(L + w - 6 * s, -6 * s, 3 * s, 6 * s);
    }
    ctx.restore();
  },

  drawPickup(ctx, q, x, y, s) {
    const bob = Math.sin(this.t * 5 + q.x) * 3 * s, pop = Math.min(1, q.t / 0.25);
    const blink = q.t > 16 && Math.sin(this.t * 20) > 0;
    if (blink) return;
    ctx.save(); ctx.translate(x, y - 10 * s + bob - (1 - pop) * 30 * s); ctx.scale(pop, pop);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    ctx.drawImage(glow(q.kind === 'food' ? '#ffe070' : '#39c6ff'), -22 * s, -30 * s, 44 * s, 44 * s);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    if (q.kind === 'food') {
      // roast chicken on a plate
      ctx.fillStyle = '#f2f2ea'; ctx.beginPath(); ctx.ellipse(0, 0, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8742a'; ctx.beginPath(); ctx.ellipse(0, -8 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.ellipse(-3 * s, -11 * s, 5 * s, 2.5 * s, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(9 * s, -14 * s, 6 * s, 3 * s); ctx.strokeRect(9 * s, -14 * s, 6 * s, 3 * s);
    } else {
      ctx.fillStyle = '#39c6ff'; ctx.beginPath(); ctx.moveTo(2 * s, -24 * s); ctx.lineTo(-8 * s, -8 * s); ctx.lineTo(0, -8 * s); ctx.lineTo(-3 * s, 4 * s); ctx.lineTo(9 * s, -13 * s); ctx.lineTo(1 * s, -13 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  },

  drawFire(ctx, f, x, y, s) {
    if (f.hp <= 0) {
      ctx.fillStyle = 'rgba(30,30,30,.5)'; ctx.beginPath(); ctx.ellipse(x, y, f.w / 2 * s, 10 * s, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const k = f.hp / 100;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55; ctx.drawImage(glow('#ff8a30'), x - f.w * 1.2 * s, y - 150 * s, f.w * 2.4 * s, 200 * s); ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const fx = x + ((i / 8) - 0.5) * f.w * s;
      const h = (70 + Math.sin(this.t * 9 + i * 1.7) * 20) * s * (0.4 + 0.6 * k);
      const grd = ctx.createLinearGradient(fx, y, fx, y - h);
      grd.addColorStop(0, 'rgba(255,220,90,.95)'); grd.addColorStop(0.5, 'rgba(255,100,20,.75)'); grd.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(fx - 17 * s, y); ctx.quadraticCurveTo(fx - 8 * s, y - h * 0.6, fx + Math.sin(this.t * 7 + i) * 6 * s, y - h); ctx.quadraticCurveTo(fx + 8 * s, y - h * 0.6, fx + 17 * s, y); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

let shadowC = null;
/** Soft contact shadow blob (cached). */
function shadowSprite() {
  if (shadowC) return shadowC;
  shadowC = document.createElement('canvas'); shadowC.width = 64; shadowC.height = 32;
  const g = shadowC.getContext('2d');
  const r = g.createRadialGradient(32, 16, 0, 32, 16, 32);
  r.addColorStop(0, 'rgba(8,4,16,1)'); r.addColorStop(0.55, 'rgba(8,4,16,.8)'); r.addColorStop(1, 'rgba(8,4,16,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 8); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return shadowC;
}
