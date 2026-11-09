// Proportional editing in the curve editor, the top bar, and pictures: layering and the body under them.
// Usage: node walkbase/tests/ui-edit.mjs <chromium|webkit> <playwrightDir> [shotDir]
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

// ---- the top bar: the caption sits beside the value, and nothing overlaps
for (const [w, h] of [[1366, 900], [1024, 768], [820, 1180], [390, 844]]) {
  await page.setViewportSize({ width: w, height: h }); await wait(150);
  const bad = await ev(() => {
    const pills = [...document.querySelectorAll('.pillfield')]; const out = [];
    for (const p of pills) { const s = p.querySelector('select'); const c = p.querySelector('small'); const a = c.getBoundingClientRect(); const b = s.getBoundingClientRect(); if (a.width > 2 && a.right > b.left + 1) out.push('caption over value'); if (s.scrollWidth > s.clientWidth + 1) out.push('value clipped'); }
    const hit = (x, y) => x.left < y.right - 1 && y.left < x.right - 1 && x.top < y.bottom - 1 && y.top < x.bottom - 1;
    for (let i = 0; i < pills.length; i++) for (let j = i + 1; j < pills.length; j++) if (hit(pills[i].getBoundingClientRect(), pills[j].getBoundingClientRect())) out.push('pills overlap');
    const menus = [...document.querySelectorAll('header.bar .menu-trigger')].map((e) => e.getBoundingClientRect());
    for (let i = 0; i < menus.length; i++) for (let j = i + 1; j < menus.length; j++) if (hit(menus[i], menus[j])) out.push('menus overlap');
    return out;
  });
  check(`the top bar has no overlap at ${w}px`, bad.length === 0, bad);
}
await page.setViewportSize({ width: 1280, height: 820 }); await wait(150);

// ---- a mouse: the middle button pivots the camera, Shift with it pans
{
  const box = await page.locator('[data-testid="stage"]').boundingBox(); const mx = box.x + box.width / 2; const my = box.y + box.height * 0.3;
  const y0 = await ev(() => window.__walkBase.S.s.camYaw);
  await page.mouse.move(mx, my); await page.mouse.down({ button: 'middle' }); await page.mouse.move(mx + 60, my + 10, { steps: 5 }); await page.mouse.up({ button: 'middle' }); await wait(100);
  const y1 = await ev(() => window.__walkBase.S.s.camYaw);
  check('dragging with the middle button pivots the camera', Math.abs(y1 - y0) > 10, { y0, y1 });
  const p0 = await ev(() => window.__walkBase.S.panX);
  await page.keyboard.down('Shift'); await page.mouse.move(mx, my); await page.mouse.down({ button: 'middle' }); await page.mouse.move(mx + 50, my, { steps: 5 }); await page.mouse.up({ button: 'middle' }); await page.keyboard.up('Shift'); await wait(100);
  check('Shift with the middle button pans', (await ev(() => window.__walkBase.S.panX)) - p0 > 20);
  const yb = await ev(() => window.__walkBase.S.s.camYaw);
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx + 80, my + 10, { steps: 5 }); await page.mouse.up(); await wait(100);
  check('a plain mouse drag on empty space leaves the camera alone with the Select tool', (await ev(() => window.__walkBase.S.s.camYaw)) === yb);
  await ev(() => { window.__walkBase.S.s.camYaw = 0; window.__walkBase.S.panX = 0; window.__walkBase.render(); });
}

// ---- proportional editing in the curve editor
await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'forearm', side: 'R' }); w.openEditor('elbow.flex.R'); }); await wait(300);
check('the curve editor has the proportional controls', (await page.locator('[data-testid="prop-toggle"]:visible').count()) === 1 && (await page.locator('[data-testid="prop-radius"]:visible').count()) === 1 && (await page.locator('[data-testid="prop-falloff"]:visible').count()) === 1);
await ev(() => { const e = window.__walkBase.editor(); e.commit(e.ensurePoints()); }); await wait(100);
const dragHandle = async (index, dy) => {
  const p = await ev((i) => { const e = window.__walkBase.editor(); const L = e.layout(); const R = e.range(); const q = e.settings().pts[i]; const s = e.toXY(q.u, q.v, L, R); const r = e.canvas.getBoundingClientRect(); return { x: r.left + s.x, y: r.top + s.y }; }, index);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x, p.y + dy / 2, { steps: 4 }); await page.mouse.move(p.x, p.y + dy, { steps: 4 }); await page.mouse.up(); await wait(120);
};
const vals = () => ev(() => window.__walkBase.editor().settings().pts.map((q) => q.v));
let before = await vals(); await dragHandle(3, -60); let after = await vals();
const moved = after.map((v, i) => Math.abs(v - before[i]) > 1e-6);
check('off: only the dragged handle moves', moved[3] && moved.filter(Boolean).length === 1, moved);
await page.locator('[data-testid="prop-toggle"]:visible').click(); await wait(100);
before = await vals(); await dragHandle(6, -60); after = await vals();
const dv = after.map((v, i) => v - before[i]);
check('on: the neighbours follow, less the further they are', Math.abs(dv[6]) > 1e-6 && Math.abs(dv[5]) > 1e-6 && Math.abs(dv[7]) > 1e-6 && Math.abs(dv[5]) < Math.abs(dv[6]) && Math.abs(dv[4]) < Math.abs(dv[5]) + 1e-9 && Math.sign(dv[5]) === Math.sign(dv[6]), dv.map((v) => +v.toFixed(3)));
check('on: handles far away stay put', Math.abs(dv[0]) < 1e-9 && Math.abs(dv[11]) < 1e-9, dv.map((v) => +v.toFixed(3)));
await ev(() => { const e = document.querySelector('[data-testid="prop-radius"]'); e.value = 50; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(80);
await wait(450); // a second tap on the same handle straight away would remove it
before = await vals(); await dragHandle(6, -50); after = await vals();
const wide = after.map((v, i) => Math.abs(v - before[i]));
check('a wider reach moves more of them', wide.filter((v) => v > 1e-6).length >= 8, wide.map((v) => +v.toFixed(3)));
await ev(() => window.__walkBase.closeEditor());
await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(200);
await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'forearm', side: 'R' }); w.openEditor('elbow.flex.R'); }); await wait(250);
check('the setting is remembered', (await page.locator('[data-testid="prop-toggle"]:visible').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-testid="prop-radius"]:visible').inputValue()) === '50');
await ev(() => window.__walkBase.closeEditor());

// ---- pictures: four layers, and the body under them
const png = (col) => ev((c) => { const k = document.createElement('canvas'); k.width = 60; k.height = 200; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 60, 200); return k.toDataURL('image/png').split(',')[1]; }, col);
for (const [side, col] of [['R', '#d02020'], ['L', '#2040d0']]) {
  await ev((s) => window.__walkBase.selectPart({ part: 'leg', seg: 0, side: s }, { openTab: false }), side);
  await page.locator('[data-testid="tab-Attach"]:visible').first().click();
  await page.locator('[data-testid="attach-file"]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(await png(col), 'base64') });
  await page.waitForFunction(() => window.__walkBase.attachItem()?.kind === 'image');
  await ev(() => { const w = window.__walkBase; w.patchAttach(w.S.attachSel, { w: 0.2, h: 0.7, x: 0.15, y: 0 }); });
}
const depthBtns = await page.locator('[data-testid^="attach-depth-"]:visible').evaluateAll((b) => b.map((x) => x.getAttribute('data-testid')));
check('the picture has four layer choices', ['back', 'behind', 'front', 'top'].every((k) => depthBtns.includes(`attach-depth-${k}`)), depthBtns);
const shot = () => page.locator('[data-testid="stage"]').screenshot();
await ev(() => { window.__walkBase.S.s.pictureModel = 'show the model'; window.__walkBase.render(); }); await wait(100);
const shown = await shot();
await ev(() => { window.__walkBase.S.s.pictureModel = 'hide covered parts'; window.__walkBase.render(); }); await wait(100);
const hidden = await shot();
await ev(() => { window.__walkBase.S.s.pictureModel = 'hide the model'; window.__walkBase.render(); }); await wait(100);
const none = await shot();
check('the body is drawn under a picture only when asked', Buffer.compare(shown, hidden) !== 0 && Buffer.compare(hidden, none) !== 0);
check('the setting is in the Look tab', await ev(() => { window.__walkBase.setTab('Look'); return document.getElementById('panel-body').innerText.includes('Body under pictures'); }));
const order = await ev(() => { const w = window.__walkBase; const items = w.attachList(); w.patchAttach(items[1].id, { depth: 'top' }); w.patchAttach(items[0].id, { depth: 'back' }); w.S.s.pictureModel = 'show the model'; w.render(); return w.attachList().map((i) => i.depth); });
check('Back and Top can be set', order[0] === 'back' && order[1] === 'top', order);
if (shots) { await wait(100); await page.screenshot({ path: path.join(shots, `wb-edit-${name}.png`) }); }
check('no page errors', errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
