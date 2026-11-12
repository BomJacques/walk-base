// The pen stroke engine in the browser: smoothing, width factors from speed and pressure, one ribbon at one opacity, undo, saving, old drawings.
// Usage: node walkbase/tests/ui-stroke.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
const page = await context.newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.design = {}; w.S.attach.human = []; w.S.s.style = 'mannequin'; w.S.s.shadowMode = 'off'; w.S.s.camYaw = -25; w.S.s.camPitch = 0; w.setTab('Draw'); w.setFrame(4); w.render(); }); await wait(300);
check('the Draw tab has a Smoothing slider and a Pressure switch', (await q('draw-smooth').count()) === 1 && (await q('draw-pressure').count()) === 1);
await q('draw-part-head').click(); await wait(250);
const clientOf = (key) => ev((k) => { const w = window.__walkBase; const f = w.S.last.frames[k][0].fr; const m = w.S.map; return { x: m.left + (m.x0 + (f.cx / m.fcw) * m.zw) / m.d, y: m.top + (m.y0 + (f.cy / m.fch) * m.zh) / m.d }; }, 'head');
const toClient = (pt) => ev(([u, v]) => { const w = window.__walkBase; const fr = w.inkFrame('head'); const [X, Y] = w.fromUV(fr, u, v); const m = w.S.map; return { x: m.left + (m.x0 + (X / m.fcw) * m.zw) / m.d, y: m.top + (m.y0 + (Y / m.fch) * m.zh) / m.d }; }, pt);
const strokes = () => ev(() => window.__walkBase.designOf().head?.ink?.strokes || []);
const setSmooth = (v) => ev((x) => { window.__walkBase.S.draw.smooth = x; }, v);
const setPressure = (v) => ev((x) => { window.__walkBase.S.draw.pressure = x; }, v);
const drag = async (pts, delay = 0) => { await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const [x, y] of pts.slice(1)) { await page.mouse.move(x, y); if (delay) await wait(delay); } await page.mouse.up(); await wait(150); };
const c0 = await clientOf();
// a wavy line with a little hand shake, made the same way each time
const wave = (n, step, shake) => { let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; }; return Array.from({ length: n }, (_, i) => [c0.x - 40 + i * step + r() * shake, c0.y + Math.sin(i / 5) * 12 + r() * shake]); };
const rough = (pts) => { let t = 0; for (let i = 2; i < pts.length; i++) t += Math.abs(pts[i][0] - 2 * pts[i - 1][0] + pts[i - 2][0]) + Math.abs(pts[i][1] - 2 * pts[i - 1][1] + pts[i - 2][1]); return t / pts.length; };

// ---- the stabiliser
await setSmooth(0); await setPressure(true); const shaky = wave(40, 2, 2.4); await drag(shaky, 12);
let st = await strokes();
check('a stroke is kept as [u, v, p] points, p from 0 to 1 with two decimals', st.length === 1 && st[0].pts.length >= 10 && st[0].pts.every((p) => p.length === 3 && p[2] >= 0 && p[2] <= 1 && Math.abs(p[2] * 100 - Math.round(p[2] * 100)) < 1e-6), st[0] && st[0].pts.slice(0, 3));
const r0 = rough(st[0].pts);
await ev(() => window.__walkBase.designOf().head.ink.strokes.length = 0);
await setSmooth(1); await drag(shaky, 12); st = await strokes(); const r1 = rough(st[0].pts);
check('smoothing 1 takes the shake out of the line (much less rough than smoothing 0)', r1 < r0 * 0.8, { r0, r1 });
const first = await toClient(st[0].pts[0]); const last = await toClient(st[0].pts[st[0].pts.length - 1]);
check('it starts where the pen went down and ends where it lifted', Math.hypot(first.x - shaky[0][0], first.y - shaky[0][1]) < 2.5 && Math.hypot(last.x - shaky[39][0], last.y - shaky[39][1]) < 3.5, { first, last, a: shaky[0], b: shaky[39] });
check('a stroke of a few dozen events is a few dozen points, not hundreds', st[0].pts.length < 200, st[0].pts.length);

// ---- width follows speed (no pressure on a mouse)
await ev(() => window.__walkBase.designOf().head.ink.strokes.length = 0); await setSmooth(0.5);
await drag(wave(30, 3, 0), 30); await drag(wave(12, 8, 0).map(([x, y]) => [x, y + 20]), 0); st = await strokes();
const mean = (s) => s.pts.slice(3, -3).reduce((t, p) => t + p[2], 0) / Math.max(1, s.pts.length - 6);
check('drawn slowly the line is wider than drawn fast', st.length === 2 && mean(st[0]) > mean(st[1]) + 0.03, st.map(mean));
await ev(() => window.__walkBase.designOf().head.ink.strokes.length = 0); await setPressure(false); await drag(wave(30, 3, 0), 20); await drag(wave(12, 8, 0).map(([x, y]) => [x, y + 20]), 0); st = await strokes();
check('with Pressure off the width factor does not change with speed', st.length === 2 && st.every((s) => s.pts.every((p) => p[2] === 0.5)));
await setPressure(true);

// ---- undo and the old way of keeping points
await q('draw-undo').click(); await wait(150); check('Undo takes the last stroke away', (await strokes()).length === 1);
await q('draw-undo').click(); await wait(150); check('and the one before', (await strokes()).length === 0);
await drag(wave(10, 3, 0)); await ev(() => { const w = window.__walkBase; const ink = w.designOf().head.ink; ink.strokes[0] = { c: '#1b1b1f', w: 0.05, a: 1, fill: false, pts: [[0.1, 0.5], [0.3, 0.3], [0.5, 0.7], [0.9, 0.5]] }; w.S.ver++; w.render(); }); await wait(200);
const shotOld = await page.locator('[data-testid="stage"]').screenshot();
check('an old stroke (points of two numbers) still paints', (await ev(() => window.__walkBase.designOf().head.ink.strokes[0].pts[0].length)) === 2 && shotOld.length > 1000);
await ev(() => { const w = window.__walkBase; const ink = w.designOf().head.ink; ink.strokes.length = 0; w.S.ver++; w.render(); }); await wait(100);

// ---- one ribbon at one opacity: a self-crossing line at half opacity is the same tone where it crosses
await q('draw-swatch-d93a3a').click(); await ev(() => { window.__walkBase.S.draw.opacity = 0.5; }); await setSmooth(0.3);
const loop = Array.from({ length: 70 }, (_, i) => { const t = (i / 69) * Math.PI * 2; return [c0.x + 30 * Math.sin(t), c0.y + 22 * Math.sin(2 * t)]; });
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; }); await drag(loop, 6);
if (shots) await page.locator('[data-testid="stage"]').screenshot({ path: path.join(shots, `stroke-loop-${name}.png`) });
const tones = await ev((c) => {
  const cv = document.querySelector('[data-testid="stage"]'); const r = cv.getBoundingClientRect(); const g = cv.getContext('2d'); const sx = cv.width / r.width; const sy = cv.height / r.height;
  const k = (x, y) => { const d = g.getImageData(Math.round((x - r.left) * sx), Math.round((y - r.top) * sy), 1, 1).data; return d[0] - d[1]; }; // how red it is
  const mid = k(c.x, c.y); const arm = [[5.8, 8.3], [-5.8, -8.3], [5.8, -8.3], [-5.8, 8.3]].map(([dx, dy]) => k(c.x + dx, c.y + dy)); const off = k(c.x + 40, c.y + 40);
  return { mid, arm, off };
}, c0);
check('the loop is there, and where it crosses itself it is the same tone, not darker', tones.arm.every((a) => a - tones.off > 15) && Math.abs(tones.mid - tones.arm.reduce((s, a) => s + a, 0) / 4) <= 5, tones);
await ev(() => { window.__walkBase.S.draw.opacity = 1; }); await q('draw-undo').click(); await wait(150);

// ---- reload keeps the widths
await drag(wave(30, 3, 0), 8); const before = await strokes(); await wait(600);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(500);
const after = await ev(() => window.__walkBase.designOf().head?.ink?.strokes || []);
check('after a reload the stroke has the same points, with their widths', after.length === 1 && after[0].pts.length === before[0].pts.length && after[0].pts.every((p, i) => p.length === 3 && Math.abs(p[2] - before[0].pts[i][2]) < 0.006), { n: after.length });

// ---- many strokes paint fast enough
const ms = await ev(() => {
  const w = window.__walkBase; const ink = w.designOf().head.ink; ink.strokes.length = 0;
  for (let k = 0; k < 300; k++) ink.strokes.push({ c: '#1b1b1f', w: 0.03, a: 0.8, fill: false, pts: Array.from({ length: 120 }, (_, i) => [0.1 + i * 0.007, 0.5 + 0.3 * Math.sin(i / 9 + k), 0.4 + 0.2 * Math.sin(i / 7)]) });
  const t0 = performance.now(); for (let i = 0; i < 10; i++) { w.S.ver++; w.render(); } return (performance.now() - t0) / 10;
});
check('300 strokes of 120 points paint in a few dozen ms at most (headless, no GPU)', ms < 80, `${ms.toFixed(1)} ms`);
await ev(() => { const w = window.__walkBase; w.designOf().head.ink.strokes.length = 0; w.S.ver++; w.render(); }); await wait(100);

// ---- a pencil's pressure (chromium: touch with force)
if (name === 'chromium') {
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(300);
  await ev(() => { const w = window.__walkBase; w.pause(); w.S.design = {}; w.setTab('Draw'); w.setFrame(4); w.render(); }); await wait(300);
  await q('draw-part-head').click(); await wait(250); const cc = await clientOf(); const cdp = await context.newCDPSession(page);
  const tch = (type, x, y, force) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, force }] });
  const forces = [0.2, 0.25, 0.3, 0.35, 0.4, 0.6, 0.7, 0.8, 0.9, 0.95]; const px = (i) => cc.x - 40 + i * 9;
  await tch('touchStart', px(0), cc.y, forces[0]); for (let i = 1; i < forces.length; i++) { await tch('touchMove', px(i), cc.y + Math.sin(i) * 3, forces[i]); await wait(16); } await tch('touchEnd'); await wait(250);
  const t = (await strokes())[0]; const ps = t ? t.pts.map((p) => p[2]) : [];
  check('a touch with force makes the line wider where it presses harder (pressure from the pointer event)', t && ps.length >= 6 && ps[ps.length - 3] > ps[2] + 0.2, ps);
}
check('with no errors', errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
