// A part drawn on its own: picking a part in the Draw tab opens it alone on the stage, large, and the pen draws on it there; the stroke belongs to the part.
// Usage: node walkbase/tests/ui-solo.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const browser = await pw[name].launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'WalkBase.html')).href); await page.waitForFunction(() => window.__walkBase);
page.setDefaultTimeout(10000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]`);

await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.S.design = {}; w.setTab('Draw'); });
await wait(400);
await q('draw-part-head').click(); await wait(500);
const st = () => ev(() => { const w = window.__walkBase; w.paint?.(); const keys = Object.keys(w.S.last.frames || {}); const m = w.S.map; return { keys, zoom: w.S.zoom, shapes: w.S.last.shapes.filter((s) => s.part && !s.attach).map((s) => s.part), bar: !document.querySelector('[data-testid=draw-solo-bar]')?.hidden, name: document.querySelector('[data-testid=draw-solo-name]')?.textContent }; });
let s = await st();
check('picking the head opens it alone: only the head is on the stage', s.keys.length === 1 && s.keys[0] === 'head' && s.shapes.every((p) => p === 'head'), s);
check('it is zoomed in, and the bar names the part', s.zoom > 1.5 && s.bar && /head/i.test(s.name || ''), s);
if (shots) await page.screenshot({ path: path.join(shots, `wb-solo-head-${name}.png`) });
// draw on it with the mouse, in the middle of the head
const box = await ev(() => { const w = window.__walkBase; const m = w.S.map; const sh = w.S.last.shapes.find((s) => s.part === 'head'); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of sh.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const sc = m.zw / m.fcw; const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + (m.x0 + cx * sc) / m.d, y: r.top + (m.y0 + cy * sc) / m.d, w: ((x1 - x0) * sc) / m.d }; });
await page.mouse.move(box.x - box.w * 0.2, box.y); await page.mouse.down(); await page.mouse.move(box.x, box.y - box.w * 0.1, { steps: 6 }); await page.mouse.move(box.x + box.w * 0.2, box.y, { steps: 6 }); await page.mouse.up(); await wait(300);
const ink = await ev(() => { const w = window.__walkBase; const d = w.S.design[w.S.figure || 'human'] || Object.values(w.S.design)[0] || {}; const all = Object.entries(Object.fromEntries(Object.values(w.S.design).flatMap((o) => Object.entries(o)))); return all.map(([k, p]) => [k, p.ink ? p.ink.strokes.length : 0]).filter(([, n]) => n); });
check('the line drawn there is on the head, and only the head', ink.length === 1 && ink[0][0] === 'head' && ink[0][1] >= 1, ink);
// a picture imported onto the part
await q('draw-picture-file').setInputFiles(path.join(root, 'icons/icon-180.png')); await wait(700);
check('Import a picture puts a skin on the head (and offers to replace or remove it)', (await ev(() => JSON.stringify(Object.values(window.__walkBase.S.design).map((d) => d.head?.skin?.img ? 1 : 0)))).includes('1') && (await q('draw-picture-remove').count()) === 1);
await q('draw-picture-remove').click(); await wait(300);
check('Remove the picture takes the skin off', !(await ev(() => JSON.stringify(window.__walkBase.S.design).includes('"skin":{'))));
// another part
await q('draw-part-neck').click().catch(() => {}); await wait(400);
s = await st();
check('picking another part opens that one alone', s.keys.length === 1 && s.keys[0] !== 'head', s.keys);
// back to the whole figure
await q('draw-solo-done').click(); await wait(400);
s = await st();
check('Back to the whole figure shows everything again at the normal view', s.keys.length > 5 && s.zoom === 1 && !s.bar, s);
await q('draw-solo').check().catch(() => {}); await wait(300);
check('the head still has its drawing when the whole figure is shown', (await ev(() => JSON.stringify(window.__walkBase.S.design).includes('strokes'))));
await q('draw-solo').click().catch(() => {}); await wait(300);
check('leaving the Draw tab shows the whole figure', await ev(() => { const w = window.__walkBase; w.setTab('Gait'); w.paint?.(); return w.S.zoom === 1 && Object.keys(w.S.last.frames || {}).length !== 1; }));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
