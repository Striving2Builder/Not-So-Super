// Static server for the harness tools: this checkout, with an optional overlay folder whose files
// replace the checkout's (e.g. a frozen copy of src/ from another commit, for A/B runs).
const path = require('path');
const fs = require('fs');
const http = require('http');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

module.exports = function serve(root, port, overlay = null) {
  return http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]), rel = url === '/' ? 'index.html' : url.slice(1);
    const file = [overlay && path.join(overlay, rel), path.join(root, rel)].filter(Boolean).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }).listen(port);
};
