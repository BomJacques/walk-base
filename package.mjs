// Packages the built WalkBase.html as a static site: walkbase/site/ is the folder to publish (GitHub Pages, or any static host).
// It adds an installable manifest, an offline cache and icons. All paths are relative, so it works at the root of a domain or under /repo-name/.
// Static hosts like GitHub Pages cannot set headers, so the security policy goes in the page itself.
// Usage: node walkbase/package.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'site');
const src = fs.readFileSync(path.join(here, 'WalkBase.html'), 'utf8');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });

for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(here, 'icons', f), path.join(out, 'icons', f));

const hash = crypto.createHash('sha256').update(src).digest('hex').slice(0, 12);

// Inline script and style are needed because the app is one file; nothing is loaded from elsewhere and nothing leaves the device.
// (frame-ancestors cannot be set from a page, so it is left out.)
const csp = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "media-src 'self' blob:", "connect-src 'self' blob: data:", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ');

let html = src
  .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="referrer" content="no-referrer">`)
  .replace('<meta name="theme-color" content="#f4f1e9">', '<meta name="theme-color" content="#f4f1e9">\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="apple-mobile-web-app-title" content="Walk Base">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">')
  .replace(/<link rel="icon" href="data:image\/png;base64,[^"]*">/, '<link rel="icon" href="icons/icon-192.png">')
  .replace(/<link rel="apple-touch-icon" href="data:image\/png;base64,[^"]*">/, '<link rel="apple-touch-icon" href="icons/icon-180.png">');
if (!html.includes('rel="manifest"') || !html.includes('Content-Security-Policy')) throw new Error('Could not add the manifest link or the policy: the page head has changed.');
html = html.replace('</body>', `<script>
// Offline cache, only where the browser allows it (HTTPS, or localhost). Without it the app still runs.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>`);
fs.writeFileSync(path.join(out, 'index.html'), html);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Walk Base', short_name: 'Walk Base', description: 'An adjustable 3D walk and frame sampler to trace movement from. Runs on this device.',
  start_url: './', scope: './', display: 'standalone', background_color: '#f4f1e9', theme_color: '#f4f1e9', orientation: 'any',
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
}, null, 2));

fs.writeFileSync(path.join(out, 'sw.js'), `// Walk Base offline cache. The version changes whenever the page changes, so an update replaces the old copy.
const VERSION = 'walkbase-${hash}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('walkbase-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // The page itself: network first (checked with the server, not the browser's ten minute cache), so an update shows on the first open. The cache is for when there is no connection.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('index.html', copy)); } return res; }).catch(() => caches.match('index.html')));
    return;
  }
  // Everything else: cache first, so it opens with no network; fall back to the network and keep what it returns.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
`);

fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(out, '.nojekyll'), ''); // GitHub Pages: serve the files as they are
fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><title>Not found</title><meta http-equiv="refresh" content="0; url=./"><p>That page is not here. <a href="./">Open Walk Base</a>.</p>\n');
console.log(`site/ written (offline cache version walkbase-${hash})`);
for (const f of fs.readdirSync(out, { recursive: true })) console.log(f);
