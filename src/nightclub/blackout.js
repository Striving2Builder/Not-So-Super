// Polaroids of her night (docs/design/nightclub.md "The envelope"): the club owner's pictures, in the
// 3D club's envelope (club3d/sedation.js) and loose in the city (polaroids.js).

/** A polaroid of one snapshot (or one of the user's photos): white frame, square-ish crop, a time. */
export function polaroid(src, caption) {
  const c = document.createElement('canvas');
  c.width = 260; c.height = 300;
  const x = c.getContext('2d');
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 260, 300);
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, side = Math.min(sw, sh);
  x.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 14, 14, 232, 232);
  // flash-lit and a little washed out, like an instant photo
  x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,230,200,0.35)'; x.fillRect(14, 14, 232, 232);
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.strokeRect(14, 14, 232, 232);
  x.fillStyle = '#2a2230'; x.font = 'italic 22px "Comic Sans MS", "Marker Felt", cursive'; x.textAlign = 'center';
  x.fillText(caption, 130, 280);
  return c;
}
