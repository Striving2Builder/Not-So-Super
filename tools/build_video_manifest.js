// Lists the media in each assets/video/<folder>/ into assets/video/manifest.json, which the game
// reads to know what it can play (a static site can't list a folder by itself).
// Run after adding or removing clips:   node tools/build_video_manifest.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets', 'video');
const MEDIA = /\.(mp4|webm|m4v|mov|jpe?g|png|webp|gif)$/i;

const folders = {};
for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const files = fs.readdirSync(path.join(ROOT, dir.name))
    .filter((f) => MEDIA.test(f) && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));
  folders[dir.name] = files.map((f) => `${dir.name}/${f}`);
}
const out = path.join(ROOT, 'manifest.json');
fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), folders }, null, 1) + '\n');
for (const [name, files] of Object.entries(folders)) console.log(`${name.padEnd(20)} ${files.length} file(s)`);
console.log(`→ ${path.relative(process.cwd(), out)}`);
