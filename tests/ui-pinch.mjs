// Two fingers on the stage: while they move the page it is not drawn again for each frame (it is moved and scaled), it is drawn crisply when they lift,
// and the page cannot be moved right off the stage.
// Usage: node walkbase/tests/ui-pinch.mjs <chromium|webkit> <playwrightDir>
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
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'WalkBase.html')).href); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.setTab('Gait'); w.S.zoom = 1; w.S.panX = w.S.panY = 0; w.render(); }); await page.waitForTimeout(400);
const r = await ev(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
const fire = (id, type, x, y) => ev(([id, type, x, y]) => document.querySelector('canvas').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, pressure: 0.5, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 })), [id, type, x, y]);
const raf = () => page.waitForTimeout(40);

await ev(() => { window.__lastInfo = window.__walkBase.S.last; });
await fire(11, 'pointerdown', cx - 60, cy); await fire(12, 'pointerdown', cx + 60, cy);
for (let i = 1; i <= 8; i++) { await fire(11, 'pointermove', cx - 60 - i * 12, cy); await fire(12, 'pointermove', cx + 60 + i * 12, cy); await raf(); }
const mid = await ev(() => ({ zoom: window.__walkBase.S.zoom, same: window.__walkBase.S.last === window.__lastInfo }));
check('pinching out zooms, and the stage is not drawn again for each frame while the fingers are down', mid.zoom > 1.3 && mid.same, mid);
await fire(11, 'pointerup', cx - 160, cy); await fire(12, 'pointerup', cx + 160, cy); await page.waitForTimeout(250);
const end = await ev(() => ({ zoom: window.__walkBase.S.zoom, same: window.__walkBase.S.last === window.__lastInfo }));
check('it is drawn crisply again when the fingers lift, at the zoom the fingers made', !end.same && end.zoom > 1.3, end);

// moving the page a long way: it stays on the stage
await ev(() => { const w = window.__walkBase; w.S.zoom = 1; w.S.panX = w.S.panY = 0; w.render(); }); await page.waitForTimeout(200);
await fire(11, 'pointerdown', cx, cy); await fire(12, 'pointerdown', cx + 80, cy);
for (let i = 1; i <= 30; i++) { await fire(11, 'pointermove', cx + i * 40, cy - i * 30); await fire(12, 'pointermove', cx + 80 + i * 40, cy - i * 30); await raf(); }
await fire(11, 'pointerup', cx + 1200, cy - 900); await fire(12, 'pointerup', cx + 1280, cy - 900); await page.waitForTimeout(300);
const pan = await ev(() => { const w = window.__walkBase; const c = document.querySelector('canvas').getBoundingClientRect(); const m = w.S.map; return { panX: w.S.panX, panY: w.S.panY, left: m.x0 / m.d, right: (m.x0 + m.zw) / m.d, top: m.y0 / m.d, bottom: (m.y0 + m.zh) / m.d, cw: c.width, ch: c.height }; });
check('dragged far, the page is still partly on the stage (it cannot be lost off the screen)', pan.right > pan.cw * 0.15 && pan.left < pan.cw * 0.85 && pan.bottom > pan.ch * 0.15 && pan.top < pan.ch * 0.85, pan);
check('Reset the view (double tap) brings it back', await ev(() => { const w = window.__walkBase; document.querySelector('canvas').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return w.S.zoom === 1 && w.S.panX === 0; }));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
