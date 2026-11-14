// Sitting down while walking: the walk stops and the figure sits (does not keep stepping on the seat).
// Usage: node walkbase/tests/ui-sitwalk.mjs <chromium|webkit> <playwrightDir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const browser = await pw[name].launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'WalkBase.html')).href); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.S.frame = 0; w.setTab('Gait'); });
await page.waitForTimeout(300);
await page.locator('[data-testid=sit-seat-invisible-chair]').click();
await ev(() => { window.__walkBase.S.frame = 24; });
await page.locator('[data-testid=sit-down]').click(); await page.waitForTimeout(300);
const sample = (f) => ev((fr) => { const w = window.__walkBase; w.setFrame(fr); w.render(); const s = w.S.last.pz.sides; return { r: s.R.ankle[0], l: s.L.ankle[0], hip: w.S.last.pz.pelvis[1] }; }, f);
const f0 = 24 + (await ev(() => window.__walkBase.S.sit.frames)) + 10;
const a = await sample(f0); const b = await sample(f0 + 5); const c = await sample(f0 + 11);
check('seated: the feet do not keep stepping', Math.abs(a.r - b.r) < 0.01 && Math.abs(b.r - c.r) < 0.01 && Math.abs(a.l - c.l) < 0.01, [a, b, c]);
const w0 = await sample(10); const w1 = await sample(16);
check('before the sit the figure is walking', Math.abs(w0.r - w1.r) > 0.02, [w0, w1]);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
