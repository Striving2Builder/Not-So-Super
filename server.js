// Zero-dependency static server. ES modules don't load from file://, so run:  node server.js
// Then open http://localhost:8080 (or http://<your-LAN-IP>:8080 on a phone on the same Wi-Fi).
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.glb': 'model/gltf-binary', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const head = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    // iOS Safari asks for video in byte ranges and won't play it without a 206 answer
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const a = m[1] ? +m[1] : Math.max(0, data.length - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
      if (a > b || a >= data.length) { res.writeHead(416, { 'Content-Range': `bytes */${data.length}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${a}-${b}/${data.length}`, 'Content-Length': b - a + 1 });
      return res.end(data.subarray(a, b + 1));
    }
    res.writeHead(200, { ...head, 'Content-Length': data.length });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Supergirl: City Patrol → http://localhost:${PORT}`);
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) if (n.family === 'IPv4' && !n.internal) console.log(`  on your phone → http://${n.address}:${PORT}`);
  }
});
