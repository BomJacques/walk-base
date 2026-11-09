// The scene: other figures and scenery.
// Usage: node walkbase/tests/ui-scene.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const stagePng = () => page.locator('[data-testid="stage"]').screenshot();
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

await ev(() => window.__walkBase.setTab('Scene')); await wait(150);
check('there is a Scene tab with Add figure and Add scenery', (await q('scene-add-figure').count()) === 1 && (await q('scene-add-prop').count()) === 1);
const empty = await stagePng();

// figures
await q('scene-add-figure').click(); await page.locator('[data-testid="scene-add-hose"]').click(); await wait(200);
await q('scene-add-figure').click(); await page.locator('[data-testid="scene-add-dog"]').click(); await wait(200);
const n = await ev(() => window.__walkBase.S.scene.actors.map((a) => [a.fig, a.preset]));
check('figures are added with their own first walk', n.length === 2 && n[0][0] === 'hose' && n[0][1] === 'Bouncy' && n[1][0] === 'dog', n);
check('they appear on the stage', Buffer.compare(empty, await stagePng()) !== 0);
await ev(() => { const a = window.__walkBase.S.scene.actors[0]; window.__walkBase.S.sceneSel = a.id; window.__walkBase.setTab('Scene'); }); await wait(150);
await page.locator('[data-testid="scene-preset"]').selectOption('Strut'); await wait(150);
check('a figure keeps its own walk, apart from the main one', await ev(() => { const w = window.__walkBase; return w.S.scene.actors[0].preset === 'Strut' && w.S.preset !== 'Strut' && w.S.scene.actors[0].p.model === 'hose'; }));
await ev(() => { const w = window.__walkBase; w.setFrame(0); w.render(); });
const a0 = await stagePng(); await ev(() => { window.__walkBase.setFrame(6); window.__walkBase.render(); }); await wait(100);
check('they move with the playhead', Buffer.compare(a0, await stagePng()) !== 0);
await ev(() => { const w = window.__walkBase; w.S.scene.actors[0].x = 1.2; w.S.scene.actors[0].z = 0.4; w.render(); }); await wait(80);
const placed = await stagePng();
await ev(() => { const w = window.__walkBase; w.S.scene.actors[0].x = 2.4; w.render(); }); await wait(80);
check('along and depth move a figure', Buffer.compare(placed, await stagePng()) !== 0);

// tapping a second figure on the stage selects it, and the list has a quick remove
await ev(() => { const w = window.__walkBase; w.S.scene.actors[0].x = 2.6; w.S.scene.actors[0].z = 0.9; w.S.sceneSel = null; w.S.s.camYaw = 0; w.setFrame(3); w.render(); }); await wait(150);
const tap = await ev(() => { const w = window.__walkBase; const hit = w.S.last.sceneHits[0]; const sh = hit.shapes.find((x) => x.part === 'spine.mid') || hit.shapes[0]; const cx = sh.pts.reduce((t, q) => t + q[0], 0) / sh.pts.length; const cy = sh.pts.reduce((t, q) => t + q[1], 0) / sh.pts.length; const m = w.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { id: hit.id, x: r.left + (m.x0 + (cx / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (cy / m.fch) * m.zh) / m.d }; });
await page.mouse.click(tap.x, tap.y); await wait(250);
check('tapping a second figure on the stage selects it', (await ev(() => window.__walkBase.S.sceneSel)) === tap.id, tap);
check('the Scene section is on the Body tab, with a remove button on every row', (await page.locator('[data-testid^="scene-del-"]').count()) === 2 && (await page.locator('[data-testid="tab-Scene"]').count()) === 0);
await page.locator(`[data-testid="scene-del-${tap.id}"]`).click(); await wait(200);
check('the remove button takes the figure away in one tap', (await ev(() => window.__walkBase.S.scene.actors.length)) === 1);
await wait(350); await ev(() => window.__walkBase.undo()); await wait(200);
check('and undo brings it back', (await ev(() => window.__walkBase.S.scene.actors.length)) === 2);
// a second figure keeps in step: its place relative to the main figure is the same on the last frame of the cycle as on the first
const drift = await ev(() => { const w = window.__walkBase; const at = (f) => { w.setFrame(f); w.render(); const h = w.S.last.sceneHits[0].shapes.find((x) => x.part === 'spine.mid'); const m = w.S.last.shapes.find((x) => x.part === 'spine.mid'); return h.pts.reduce((t, q) => t + q[0], 0) / h.pts.length - m.pts.reduce((t, q) => t + q[0], 0) / m.pts.length; }; const n = w.S.p.cycleFrames; return [at(0), at(n - 1), at(1)]; });
check('a second figure does not creep ahead and snap back round the loop', Math.abs(drift[1] - drift[0]) < 40 && Math.abs(drift[2] - drift[0]) < 40, drift);
// dragging a figure and a piece of scenery along the ground
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = -30; w.S.s.camPitch = 35; w.S.scene.actors[0].x = 2; w.S.scene.actors[0].z = 0.8; w.setFrame(3); w.render(); }); await wait(150);
const centre = (id) => ev((i) => { const w = window.__walkBase; const hit = w.S.last.sceneHits.find((h) => h.id === i); const sh = hit.shapes.find((x) => x.part === 'spine.mid') || hit.shapes[0]; const cx = sh.pts.reduce((t, q) => t + q[0], 0) / sh.pts.length; const cy = sh.pts.reduce((t, q) => t + q[1], 0) / sh.pts.length; const m = w.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (cx / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (cy / m.fch) * m.zh) / m.d }; }, id);
const before = await ev(() => { const a = window.__walkBase.S.scene.actors[0]; return [a.x, a.z]; });
const c0 = await centre(tap.id);
await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await page.mouse.move(c0.x + 60, c0.y + 30, { steps: 6 }); await page.mouse.move(c0.x + 120, c0.y + 60, { steps: 6 }); await page.mouse.up(); await wait(250);
const after = await ev(() => { const a = window.__walkBase.S.scene.actors[0]; return [a.x, a.z]; });
check('dragging a figure moves it along the ground', Math.abs(after[0] - before[0]) > 0.2 || Math.abs(after[1] - before[1]) > 0.2, { before, after });
check('and it stays selected', (await ev(() => window.__walkBase.S.sceneSel)) === (await ev(() => window.__walkBase.S.scene.actors[0].id)), await ev(() => ({ sel: window.__walkBase.S.sceneSel, a0: window.__walkBase.S.scene.actors[0].id, tap: null })));
const orbit = await ev(() => window.__walkBase.S.s.camYaw); check('dragging a figure does not orbit the camera', orbit === -30, orbit);
// scenery
for (const k of ['tree', 'wall', 'box', 'ball', 'step', 'pillar', 'lamp', 'fence', 'rock']) { await q('scene-add-prop').click(); await page.locator(`[data-testid="scene-prop-${k}"]`).click(); await wait(60); }
const props = await ev(() => window.__walkBase.S.scene.props.map((p) => p.type));
check('all the scenery can be added', props.length === 9, props);
await ev(() => window.__walkBase.render()); await wait(120);
check('scenery draws without errors', errors.length === 0, errors);
await ev(() => { window.__walkBase.S.s.showScene = false; window.__walkBase.render(); }); await wait(100);
const hidden = await stagePng();
await ev(() => { window.__walkBase.S.s.showScene = true; window.__walkBase.render(); }); await wait(100);
check('Show the scene turns it off', Buffer.compare(hidden, await stagePng()) !== 0);

// edit, copy, remove
await q(`scene-item-${await ev(() => window.__walkBase.S.scene.props[0].id)}`).click();
const w0 = await ev(() => window.__walkBase.S.scene.props[0].w);
await ev(() => { const e = document.querySelector('[data-testid="scene-w"]'); e.value = 1.5; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
check('a slider resizes scenery', (await ev(() => window.__walkBase.S.scene.props[0].w)) === 1.5 && w0 !== 1.5);
await wait(350); await q('scene-copy').click(); await wait(350);
check('Copy adds another', (await ev(() => window.__walkBase.S.scene.props.length)) === 10);
await q('scene-remove').click(); await wait(350);
check('Remove takes it away', (await ev(() => window.__walkBase.S.scene.props.length)) === 9);

// undo, reload, export
await ev(() => window.__walkBase.undo()); await wait(200);
check('undo brings the removed item back', (await ev(() => window.__walkBase.S.scene.props.length)) === 10);
await wait(500); await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(300);
const back = await ev(() => ({ a: window.__walkBase.S.scene.actors.length, p: window.__walkBase.S.scene.props.length, w: window.__walkBase.S.scene.props[0].w }));
check('the scene survives a reload', back.a === 2 && back.p === 10 && back.w === 1.5, back);
// raising scenery and a figure's own colours
await q(`scene-item-${await ev(() => window.__walkBase.S.scene.props[0].id)}`).click();
await ev(() => { const e = document.querySelector('[data-testid="scene-y"]'); e.value = 1.2; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
check('scenery can be raised off the ground', (await ev(() => window.__walkBase.S.scene.props[0].y)) === 1.2);
await wait(350);
await q(`scene-item-${await ev(() => window.__walkBase.S.scene.actors[0].id)}`).click();
const before2 = await stagePng();
await ev(() => { for (const [id, v] of [['scene-fill', '#c03030'], ['scene-line', '#2030c0']]) { const e = document.querySelector(`[data-testid="${id}"]`); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await wait(150);
check('a figure can have its own colours', (await ev(() => { const a = window.__walkBase.S.scene.actors[0]; return [a.fill, a.line]; })).join() === '#c03030,#2030c0' && Buffer.compare(before2, await stagePng()) !== 0);
await q('scene-colour-reset').click(); await wait(100);
check('and go back to the main figure colours', (await ev(() => window.__walkBase.S.scene.actors[0].fill)) === '');
await wait(350);
const frame = await ev(async () => { const r = await window.__walkBase.frame(3); return r?.blob?.size ?? r?.size ?? 1; }).catch(() => 0);
check('a frame exports with the scene in it', frame > 0);
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = -35; w.S.s.camPitch = 8; w.setFrame(5); w.render(); }); await wait(150);
if (shots) await page.screenshot({ path: path.join(shots, `wb-scene-${name}.png`) });
for (const fig of ['dog', 'bird', 'human']) { await ev((f) => window.__walkBase.setFigure(f), fig); await wait(120); }
check('switching the main figure leaves the scene alone', (await ev(() => window.__walkBase.S.scene.actors.length)) === 2 && errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
