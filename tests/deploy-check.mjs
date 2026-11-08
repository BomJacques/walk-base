// Checks the site folder as a static host serves it (GitHub Pages: no custom headers, maybe under /repo/): page, policy, manifest, icons, paths, and the offline cache.
// Usage: node walkbase/tests/deploy-check.mjs <chromium|webkit> <playwrightDir> <baseUrl>
import { createRequire } from 'node:module';
import path from 'node:path';

const [name, pwDir, base] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const results = [];
const check = (label, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });

const bp = new URL(base).pathname; // '/' or '/repo/'
const res = await page.goto(base);
const h = res.headers();
check('page is served', res.status() === 200 && (h['content-type'] || '').includes('text/html'), h['content-type']);
// GitHub Pages cannot set headers, so the policy and the referrer rule travel inside the page.
const meta = await page.evaluate(() => ({ csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '', referrer: document.querySelector('meta[name="referrer"]')?.content || '', robots: document.querySelector('meta[name="robots"]')?.content || '' }));
check('a content security policy is in the page and allows no outside sources', /default-src 'self'/.test(meta.csp) && !/https?:\/\//.test(meta.csp), meta.csp.slice(0, 120));
check('referrer and robots rules are in the page', meta.referrer === 'no-referrer' && /noindex/.test(meta.robots), meta);
await page.waitForFunction(() => window.__walkBase);
check('the app runs under the policy, with no console errors or warnings', errors.length === 0, errors.slice(0, 3));

const man = await (await page.request.get(`${base}manifest.webmanifest`)).json();
check('manifest names the app and has icons', man.name === 'Walk Base' && man.icons.length >= 2 && man.display === 'standalone', man.icons.map((i) => i.sizes));
for (const i of man.icons) { const r = await page.request.get(new URL(i.src, base).href); check(`icon ${i.sizes} loads`, r.status() === 200 && (r.headers()['content-type'] || '').includes('png')); }
const robots = await (await page.request.get(`${base}robots.txt`)).text();
check('robots.txt asks search engines to stay away', /Disallow: \//.test(robots));
const touchIcon = await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'));
check('the home-screen icon is a real file', touchIcon === 'icons/icon-180.png', touchIcon);

// Every feature that could be blocked by the policy
const feat = await page.evaluate(async () => {
  const w = window.__walkBase; const out = {};
  out.zip = (await w.exportZip({ width: 320, height: 180 })).blob.size > 1000;
  out.canvas = Boolean(w.frame(0, null, { width: 320, height: 180 }));
  const blob = new Blob(['x'], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
  out.blobUrl = (await fetch(url)).ok;
  try { out.bitmap = (await createImageBitmap(new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/png' }))).width === 1; } catch (e) { out.bitmap = e.message; }
  return out;
});
check('export, canvas, blob URLs and image decoding all work under the policy', feat.zip && feat.canvas && feat.blobUrl && feat.bitmap === true, feat);
check('no policy violations appeared while using them', errors.length === 0, errors.slice(0, 3));

// Offline cache
const sw = await page.evaluate(async () => { if (!('serviceWorker' in navigator)) return 'unsupported'; try { const r = await navigator.serviceWorker.ready; return r.active ? 'active' : 'waiting'; } catch (e) { return e.message; } });
if (sw === 'unsupported') console.log(`NOT TESTED  offline cache  this ${name} build has no service workers`);
else {
  check('the offline cache installs', sw === 'active', sw);
  await page.reload(); await page.waitForFunction(() => window.__walkBase);
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return { names: keys, files: (await c.keys()).map((r) => new URL(r.url).pathname) }; });
  check('the page, manifest and icons are cached', cached.files.includes(bp + 'index.html') && cached.files.includes(bp + 'manifest.webmanifest') && cached.files.some((f) => f.includes('icon-512')), cached);
  await context.setOffline(true);
  await page.reload(); await page.waitForFunction(() => window.__walkBase, null, { timeout: 15000 });
  const offline = await page.evaluate(() => { const w = window.__walkBase; w.setFrame(5); return { frame: w.S.frame, sampledUi: typeof w.openCuts }; });
  check('it opens and works with the network off', offline.frame === 5, offline);
  await context.setOffline(false);
}
await browser.close();
console.log(`\n${name}: ${results.filter(Boolean).length} passed, ${results.filter((r) => !r).length} failed`);
process.exit(0);
