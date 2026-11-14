// The Draw tab's part list is ordered from the head to the toes, and the stage can zoom in on the chosen part (by a button, or by itself as parts are picked).
// Usage: node walkbase/tests/ui-drawzoom.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
const order = () => page.locator('[data-testid="draw-main"] [data-testid^="draw-part-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('draw-part-', '')));
const rank = (keys, list) => keys.map((k) => list.findIndex((p) => k === p || k.startsWith(`${p}.`)));

for (const [fig, expected] of [['human', ['head', 'neck', 'girdle', 'spine.upper', 'arm', 'forearm', 'hand', 'spine.mid', 'spine.lower', 'pelvis', 'leg', 'foot']], ['dog', ['dog.head', 'dog.jaw', 'dog.ear', 'dog.neck', 'dog.fshoulder', 'dog.spine3', 'dog.fleg', 'dog.fpaw', 'dog.spine2', 'dog.spine1', 'dog.pelvis', 'dog.hleg', 'dog.hpaw', 'dog.tail1', 'dog.tail2', 'dog.tail3']]]) {
  await ev((f) => { const w = window.__walkBase; w.pause(); w.setFigure(f); w.S.draw.mode = 'part'; w.S.draw.target = { kind: 'fig' }; w.S.sel = null; w.setTab('Draw'); w.render(); }, fig); await wait(400);
  const keys = await order(); const r = rank(keys, expected);
  check(`${fig}: the parts are listed from the head to the toes`, keys.length >= 8 && r.every((v, i) => v >= 0 && (i === 0 || v >= r[i - 1])), keys);
}
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.S.sel = null; w.setTab('Draw'); w.render(); }); await wait(300);
const R = await order(); check('the right side comes before the left', R.indexOf('arm.R') >= 0 && R.indexOf('arm.R') < R.indexOf('arm.L') && R.indexOf('leg.R') < R.indexOf('leg.L'), R);

// zoom to the chosen part
check('the zoom buttons sit with the part list, and are off until a part is chosen', (await q('draw-zoom-sel').count()) === 1 && (await q('draw-zoom-sel').isDisabled()) && (await q('draw-follow-zoom').count()) === 1);
await q('draw-part-head').click(); await wait(300);
const z0 = await ev(() => window.__walkBase.S.zoom);
await q('draw-zoom-sel').click(); await wait(300);
const z1 = await ev(() => window.__walkBase.S.zoom);
check('Zoom to this part brings the head up large', z1 > z0 * 2, [z0, z1]);
await q('draw-zoom-out').click(); await wait(250);
check('Whole figure view puts the stage back', (await ev(() => window.__walkBase.S.zoom)) === 1);

// zoom by itself as parts are picked
await page.locator('[data-testid="draw-follow-zoom"] input, input[data-testid="draw-follow-zoom"]').first().check().catch(async () => { await q('draw-follow-zoom').click(); }); await wait(500);
const zh = await ev(() => window.__walkBase.S.zoom);
await q('draw-part-hand.R').click(); await wait(700);
const zr = await ev(() => ({ z: window.__walkBase.S.zoom, px: window.__walkBase.S.panX, py: window.__walkBase.S.panY }));
check('with the switch on, picking a part zooms to it', zh > 1.5 && zr.z > 1.5 && (zr.px !== 0 || zr.py !== 0), [zh, zr]);
if (shots) await page.screenshot({ path: path.join(shots, `wb-drawzoom-${name}.png`) });
await q('draw-part-foot.R').click(); await wait(700);
const zf = await ev(() => window.__walkBase.S.panY);
check('and again for the next part', zf !== zr.py, [zr.py, zf]);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
