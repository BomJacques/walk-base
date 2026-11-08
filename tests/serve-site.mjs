// Serves walkbase/site/ the way GitHub Pages does: plain static files, no custom headers, a ten minute cache, and (optionally) under a sub-path
// such as /walk-base/, because a project site lives at https://USER.github.io/REPO/. For testing the package locally.
// Usage: node walkbase/tests/serve-site.mjs [port] [base path, default /]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../site');
const port = Number(process.argv[2] || 8097);
let base = process.argv[3] || '/'; if (!base.startsWith('/')) base = `/${base}`; if (!base.endsWith('/')) base += '/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain' };

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (!p.startsWith(base)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; } // outside the project's path, like Pages
  const rel = decodeURIComponent(p.slice(base.length)) || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(fs.readFileSync(path.join(root, '404.html'))); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log(`http://localhost:${port}${base}`));
