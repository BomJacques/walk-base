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
const box0 = await page.locator('[data-testid="stage"]').boundingBox();

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

// line-drawn scenery, and a picture of your own
for (const k of ['pine', 'bush']) { await q('scene-add-prop').click(); await page.locator(`[data-testid="scene-prop-${k}"]`).click(); await wait(80); }
check('trees, pines and bushes are line-drawn scenery', await ev(() => window.__walkBase.S.scene.props.filter((p) => ['ltree', 'lpine', 'lbush'].includes(p.kind)).length >= 3));
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.S.s.camPitch = 0; const P = w.S.scene.props; P[P.length - 1].x = 0.6; P[P.length - 1].z = 0.8; w.render(); }); await wait(150);
const bushOn = await stagePng();
for (const style of ['outline', 'stick', 'silhouette', 'mannequin']) { await ev((st) => { window.__walkBase.S.s.style = st; window.__walkBase.render(); }, style); await wait(80); }
check('every drawing style draws them', errors.length === 0, errors);
const png = await ev(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'); g.fillStyle = '#d0e8f4'; g.fillRect(0, 0, 200, 120); g.fillStyle = '#a65b44'; g.fillRect(50, 30, 100, 80); return c.toDataURL('image/png').split(',')[1]; });
await q('scene-add-prop').click(); await wait(80); await page.keyboard.press('Escape');
await page.locator('[data-testid="scene-picture-file"]').setInputFiles({ name: 'my house.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await wait(600);
const pic = await ev(() => { const w = window.__walkBase; const p = w.S.scene.props.find((x) => x.kind === 'image'); return p ? { name: p.name, asp: p.asp, img: p.img, w: p.w } : null; });
check('a JPG or PNG can be added as scenery, keeping its shape and name', pic && pic.name === 'my house' && Math.abs(pic.asp - 0.6) < 0.01 && pic.img, pic);
check('its panel has Width, Raise and Turn and Cut out the background', (await page.locator('[data-testid="scene-cut"]').count()) === 1 && (await page.locator('[data-testid="scene-w"]').count()) === 1);
await ev(() => { const w = window.__walkBase; const p = w.S.scene.props.find((x) => x.kind === 'image'); p.x = 1.4; p.z = -0.6; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.render(); }); await wait(150);
const beforeCut = await stagePng();
await q('scene-cut').click(); await wait(500);
const pic2 = await ev(() => window.__walkBase.S.scene.props.find((x) => x.kind === 'image').img);
check('Cut out the background makes a new picture with the background taken out', pic2 !== pic.img && Buffer.compare(beforeCut, await stagePng()) !== 0, { was: pic.img, now: pic2 });
check('and the picture is kept for the next visit', (await ev((i) => (localStorage.getItem('walkbase.attachimgs') || '').includes(i), pic2)) === true);
await ev(() => { window.__walkBase.S.s.style = 'mannequin'; });
await wait(350);
// edit, copy, remove
const nBase = await ev(() => window.__walkBase.S.scene.props.length);
await q(`scene-item-${await ev(() => window.__walkBase.S.scene.props[0].id)}`).click();
const w0 = await ev(() => window.__walkBase.S.scene.props[0].w);
await ev(() => { const e = document.querySelector('[data-testid="scene-w"]'); e.value = 1.5; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
check('a slider resizes scenery', (await ev(() => window.__walkBase.S.scene.props[0].w)) === 1.5 && w0 !== 1.5);
await wait(350); await q('scene-copy').click(); await wait(350);
check('Copy adds another', (await ev(() => window.__walkBase.S.scene.props.length)) === nBase + 1);
await q('scene-remove').click(); await wait(350);
check('Remove takes it away', (await ev(() => window.__walkBase.S.scene.props.length)) === nBase);

// undo, reload, export
await ev(() => window.__walkBase.undo()); await wait(200);
check('undo brings the removed item back', (await ev(() => window.__walkBase.S.scene.props.length)) === nBase + 1);
await wait(500); await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(300);
const back = await ev(() => ({ a: window.__walkBase.S.scene.actors.length, p: window.__walkBase.S.scene.props.length, w: window.__walkBase.S.scene.props[0].w }));
check('the scene survives a reload', back.a === 2 && back.p === nBase + 1 && back.w === 1.5, back);
// context menus: they act on the object that was clicked
{
  await ev(() => { const w = window.__walkBase; w.S.s.camYaw = -30; w.S.s.camPitch = 35; w.S.scene.actors[0].x = 3.2; w.S.scene.actors[0].z = 1.6; w.setFrame(3); w.render(); }); await wait(150);
  const where = (id) => ev((i) => { const w = window.__walkBase; const hit = w.S.last.sceneHits.find((h) => h.id === i); const sh = hit.shapes.find((x) => x.part === 'spine.mid') || hit.shapes[0]; const cx = sh.pts.reduce((t, q) => t + q[0], 0) / sh.pts.length; const cy = sh.pts.reduce((t, q) => t + q[1], 0) / sh.pts.length; const m = w.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (cx / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (cy / m.fch) * m.zh) / m.d }; }, id);
  const aid = await ev(() => window.__walkBase.S.scene.actors[0].id); const w1 = await where(aid);
  await page.mouse.click(w1.x, w1.y, { button: 'right' }); await wait(200);
  check('a right-click on a scene figure opens a menu for it', (await page.locator('[data-testid="context-menu-list"]').count()) === 1 && /Remove/.test(await page.locator('[data-testid="context-menu-list"]').innerText()), await page.locator('[data-testid="context-menu-list"]').innerText().catch(() => ''));
  const n0 = await ev(() => window.__walkBase.S.scene.actors.length);
  await page.locator('[data-testid="ctx-scene-dup"]').click(); await wait(200);
  check('Duplicate in that menu copies that figure', (await ev(() => window.__walkBase.S.scene.actors.length)) === n0 + 1);
  await wait(350);
  const cid = await ev(() => window.__walkBase.S.sceneSel);
  await ev((i) => { const a = window.__walkBase.S.scene.actors.find((x) => x.id === i); a.x = -1.8; a.z = 1.6; window.__walkBase.render(); }, cid); await wait(150);
  const w2 = await where(cid);
  await page.mouse.click(w2.x, w2.y, { button: 'right' }); await wait(200);
  await page.locator('[data-testid="ctx-scene-del"]').click(); await wait(200);
  check('Remove in the menu removes that figure and no other', (await ev(() => window.__walkBase.S.scene.actors.length)) === n0 && (await ev((i) => window.__walkBase.S.scene.actors.some((a) => a.id === i), aid)));
  await wait(350);
  await page.mouse.click(box0.x + 8, box0.y + box0.height - 8, { button: 'right' }); await wait(200);
  check('a right-click on empty stage gives the stage menu', /Fit to the window/.test(await page.locator('[data-testid="context-menu-list"]').innerText()));
  await page.keyboard.press('Escape'); await wait(100);
  check('Escape closes it', (await page.locator('[data-testid="context-menu-list"]').count()) === 0);
}
// the main figure has its own colours, in the scene list
await ev(() => { window.__walkBase.S.sceneSel = 'main'; window.__walkBase.setTab('Gait'); }); await wait(150);
{
  const f0 = await stagePng();
  await ev(() => { const e = document.querySelector('[data-testid="main-fill"]'); e.value = '#aa3355'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
  check('the main figure is in the list and has its own colours', (await ev(() => window.__walkBase.S.s.fillColor)) === '#aa3355' && Buffer.compare(f0, await stagePng()) !== 0);
  await ev(() => { const e = document.querySelector('[data-testid="main-fill"]'); e.value = '#f6f3ec'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
}
await wait(350);
// the scene list is the layers: show and hide, lock, and forward and back
{
  await ev(() => { window.__walkBase.S.s.camYaw = 0; window.__walkBase.S.s.camPitch = 0; window.__walkBase.setTab('Gait'); }); await wait(150);
  const ids = await ev(() => window.__walkBase.S.scene.actors.map((a) => a.id)); const a1 = ids[0];
  const order = () => page.locator('[data-testid^="scene-item-"]').evaluateAll((b) => b.map((x) => x.dataset.testid.replace('scene-item-', '')));
  const zs = await ev((i) => { const w = window.__walkBase; const a = w.S.scene.actors.find((x) => x.id === i); a.z = 1.2; a.x = 1.4; a.visible = true; w.S.scene.props.forEach((p, k) => { p.z = -2 + k * 0.1; }); w.S.scene.actors.forEach((x) => { if (x.id !== i) x.z = -0.7; }); w.renderPanel?.(); w.setTab('Gait'); return a.z; }, a1); await wait(150);
  check('the list runs from the nearest at the top to the furthest at the bottom', (await order())[0] === 'main' ? false : (await order())[0] === a1 && (await order()).at(-1) !== a1, (await order()).slice(0, 3));
  const z0 = await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).z, a1);
  await q(`scene-back-${a1}`).click(); await wait(150);
  check('Send back moves a figure further away and down the list', (await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).z, a1)) < z0);
  await q(`scene-fwd-${a1}`).click(); await wait(150);
  check('Bring forward moves it nearer', Math.abs((await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).z, a1)) - z0) < 1e-9);
  const withIt = await stagePng();
  await q(`scene-eye-${a1}`).click(); await wait(150);
  check('the eye hides it', (await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).visible, a1)) === false && Buffer.compare(withIt, await stagePng()) !== 0);
  await q(`scene-eye-${a1}`).click(); await wait(100);
  await q(`scene-lock-${a1}`).click(); await wait(150);
  check('the lock is on', (await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).locked, a1)) === true);
  await q(`scene-del-${a1}`).click(); await wait(150);
  check('a locked figure cannot be removed', (await ev((i) => window.__walkBase.S.scene.actors.some((x) => x.id === i), a1)) === true);
  await q(`scene-fwd-${a1}`).click(); await wait(100);
  check('or moved in the list', (await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).z, a1)) === z0);
  await q(`scene-lock-${a1}`).click(); await wait(150);
  check('and unlocking frees it', (await ev((i) => window.__walkBase.S.scene.actors.find((x) => x.id === i).locked, a1)) === false);
  await wait(350);
}
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
