// Undo and redo, free-running channels, lane tools, the reference picture, saved performances, and the data exports, in the browser.
// Usage: node walkbase/tests/ui-tools.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { press } from './helpers.mjs';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, acceptDownloads: true });
const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true })); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `wb-tools-${name}-${n}.png`) }); };

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
await ev(() => { try { localStorage.clear(); } catch { /* none */ } });
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);

// ---------------- undo and redo ----------------
check('nothing to undo at the start', await q('undo').isDisabled() && await q('redo').isDisabled());
const bobBefore = await ev(() => window.__walkBase.S.p.bob);
await ev(() => { const w = window.__walkBase; for (let i = 1; i <= 6; i++) w.setParam('bob', 0.02 + i * 0.01); });
await page.waitForTimeout(700);
check('a change makes Undo available', await q('undo').isEnabled());
await q('undo').click();
check('Undo puts the value back, and a drag of six moves is one step', await ev((b) => window.__walkBase.S.p.bob === b, bobBefore), await ev(() => window.__walkBase.S.p.bob));
check('and Redo is now available', await q('redo').isEnabled() && await q('undo').isDisabled());
await q('redo').click();
check('Redo brings it back', await ev(() => Math.abs(window.__walkBase.S.p.bob - 0.08) < 1e-9), await ev(() => window.__walkBase.S.p.bob));
await page.waitForTimeout(700);
await page.keyboard.press('Control+z');
check('Ctrl+Z undoes from the keyboard', await ev((b) => window.__walkBase.S.p.bob === b, bobBefore));
await page.keyboard.press('Control+Shift+z');
check('Ctrl+Shift+Z redoes', await ev(() => Math.abs(window.__walkBase.S.p.bob - 0.08) < 1e-9));
// an automation change, a part edit and a clip are all undoable
await page.waitForTimeout(700);
await q('tab-Auto').click(); await q('clip-stop').click(); await q('clip-add').click();
check('a movement added makes lanes', await ev(() => Object.keys(window.__walkBase.S.lanes).length > 0));
await page.waitForTimeout(700);
await q('undo').click();
check('undo removes the movement\'s lanes', await ev(() => Object.keys(window.__walkBase.S.lanes).length === 0 && window.__walkBase.S.perfLen === 0), await ev(() => ({ n: Object.keys(window.__walkBase.S.lanes).length, len: window.__walkBase.S.perfLen })));
await page.waitForTimeout(700);
await ev(() => window.__walkBase.patchMotion('arm.pitch.R', { amount: 2 }));
await page.waitForTimeout(700);
await ev(() => window.__walkBase.patchMotion('arm.pitch.R', { amount: 1.5 }));
await page.waitForTimeout(700);
await q('undo').click();
check('undo steps back one part edit at a time', await ev(() => window.__walkBase.S.motion['arm.pitch.R']?.amount === 2), await ev(() => window.__walkBase.S.motion['arm.pitch.R']));
await q('undo').click();
check('and then removes the edit', await ev(() => !window.__walkBase.S.motion['arm.pitch.R']));
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
check('a reload starts a fresh history', await q('undo').isDisabled());
await ev(() => { try { localStorage.clear(); } catch { /* none */ } });
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);

// ---------------- free running ----------------
await page.locator('[data-testid="rig"]').selectOption('dog');
await q('tab-Auto').click();
await q('clip-stop').click();
await q('clip-start').fill('20'); await q('clip-start').dispatchEvent('change');
await q('clip-add').click();
const freed = await ev(() => { const m = window.__walkBase.S.motion; return ['dog.tail1.yaw', 'dog.tail3.yaw', 'dog.ear.flop.R'].every((id) => m[id]?.free === true); });
check('Walk to stop sets the tail and ears to free running', freed);
const T = await ev(() => window.__walkBase.P().perf.T);
const tailAt = async (f) => { await ev((x) => window.__walkBase.setFrame(x), f); await page.waitForTimeout(80); return ev(() => { const z = window.__walkBase.S.last.pz; return { tail: z.tail[3].slice(), paw: z.legs.FR.paw.slice(), u: z.u }; }); };
const a = await tailAt(T - 14); const b = await tailAt(T - 9);
check('once the dog has stopped, the paws and the cycle stay still', Math.abs(a.paw[0] - b.paw[0]) < 1e-6 && Math.abs(a.u - b.u) < 1e-6, { a: a.u, b: b.u });
check('and the tail carries on moving', Math.abs(a.tail[2] - b.tail[2]) > 0.003, { a: a.tail[2], b: b.tail[2] });
await q('tab-Parts').click();
await ev(() => window.__walkBase.selectPart({ part: 'dog.tail3', side: null }, { openTab: true }));
if (!(await page.locator('[data-testid="ch-dog.tail3.yaw-free"]').isVisible())) await page.locator('[data-testid="more-ch-dog.tail3.yaw"]').click();
check('the channel shows a Free running tick that is on', await page.locator('[data-testid="ch-dog.tail3.yaw-free"]').isChecked());
await page.locator('[data-testid="ch-dog.tail3.yaw-free"]').uncheck();
check('and it can be turned off', await ev(() => !window.__walkBase.S.motion['dog.tail3.yaw']?.free));
await page.locator('[data-testid="rig"]').selectOption('human');

// ---------------- lane tools ----------------
await ev(() => {
  const w = window.__walkBase; w.S.lanes = { 'c:arm.pitch.R:offset': { interp: 'linear', pts: [{ t: 0, v: 0 }, { t: 6, v: 0.4 }, { t: 12, v: 0 }, { t: 40, v: 0 }] }, cadence: { interp: 'linear', pts: [{ t: 0, v: 1 }, { t: 30, v: 1 }] } };
  w.S.perfLen = 60; w.S.ver++; w.setTab('Auto'); w.openLaneEditor('c:arm.pitch.R:offset');
});
await page.waitForTimeout(200);
check('the lane pop-out has the lane tools', await q('lane-tools').isVisible() && await q('lane-span-menu').isVisible() && await q('lane-move-menu').isVisible() && await q('lane-more-menu').isVisible());
await q('lane-from').fill('1'); await q('lane-to').fill('13');
await press(page, 'lane-copy');
await ev(() => window.__walkBase.setFrame(30));
await press(page, 'lane-paste');
const lane = () => ev(() => window.__walkBase.S.lanes['c:arm.pitch.R:offset'].pts.map((p) => [p.t, +p.v.toFixed(3)]));
let pts = await lane();
check('Paste puts the shape down at the playhead', pts.some(([t, v]) => t === 36 && v === 0.4), pts);
await q('lane-by').fill('3');
await press(page, 'lane-later');
pts = await lane();
check('Later moves every point', pts.some(([t, v]) => t === 39 && v === 0.4) && pts.some(([t, v]) => t === 9 && v === 0.4), pts);
await press(page, 'lane-earlier');
await q('lane-from').fill('1'); await q('lane-to').fill('13');
await press(page, 'lane-loop');
pts = await lane();
check('Loop repeats the span to the end', pts.filter(([, v]) => v === 0.4).length >= 4, pts.filter(([, v]) => v === 0.4).length);
await press(page, 'lane-mirror');
await page.waitForTimeout(500);
check('Copy to other side makes the left lane', await ev(() => JSON.stringify(window.__walkBase.S.lanes['c:arm.pitch.L:offset']) === JSON.stringify(window.__walkBase.S.lanes['c:arm.pitch.R:offset'])));
await ev(() => window.__walkBase.openLaneEditor('c:arm.pitch.R:offset'));
await ev(() => window.__walkBase.setFrame(6));
await press(page, 'lane-bake');
const baked = await ev(() => { const w = window.__walkBase; return { pts: w.S.motion['arm.pitch.R']?.pts?.length, lane: Boolean(w.S.lanes['c:arm.pitch.R:offset']) }; });
check('Bake writes a drawn curve and removes the lane', baked.pts >= 8 && baked.lane === false, baked);
check('the pop-out closed after baking', !(await q('lane-tools').isVisible().catch(() => false)));
await q('undo').click();
check('undo brings the lane back', await ev(() => Boolean(window.__walkBase.S.lanes['c:arm.pitch.R:offset']) && !window.__walkBase.S.motion['arm.pitch.R']?.pts));
await ev(() => window.__walkBase.closeEditor());

// ---------------- reference picture ----------------
await q('tab-Guides').click();
check('the Guides tab has the reference picture section', await q('ref-section').isVisible() && await q('ref-file').count() === 1);
const png = await ev(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#e02020'; g.fillRect(0, 0, 120, 200); return c.toDataURL('image/png').split(',')[1]; });
const redCount = () => ev(() => { const c = document.querySelector('[data-testid="stage"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 170 && d[i + 2] < 170) n++; return n; });
await ev(() => window.__walkBase.render());
await page.waitForTimeout(150);
const redBefore = await redCount();
await page.locator('[data-testid="ref-file"]').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
await page.waitForFunction(() => window.__walkBase.REF.img);
await page.waitForTimeout(250);
const redAfter = await redCount();
check('adding a picture puts it under the figure', redAfter > redBefore + 2000, { redBefore, redAfter });
await page.locator('[data-testid="ref-on"]').uncheck();
await page.waitForTimeout(250);
check('Show it off hides it', await redCount() < redAfter / 2);
await page.locator('[data-testid="ref-on"]').check();
await ev(() => { const r = window.__walkBase.REF; r.opacity = 0.2; r.size = 1.4; r.ground = 0.8; r.flip = true; window.__walkBase.render(); });
await page.waitForTimeout(250);
const moved = await redCount();
check('size and opacity change what is drawn', Math.abs(moved - redAfter) > 500, { moved, redAfter });
await shot('ref');
await ev(() => { const r = window.__walkBase.REF; r.opacity = 0.5; r.size = 1; r.ground = 0.9; r.flip = false; });
await page.locator('[data-testid="ref-export"]').check();
const exported = await ev(async () => { const r = await window.__walkBase.exportZip({ cycles: 1, format: 'png-zip', timing: 'every', width: 320, height: 240 }); return r.blob.size; });
check('an export can include the picture', exported > 2000, exported);
await page.waitForTimeout(500);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(500);
check('the picture and its settings come back after a reload', await ev(() => Boolean(window.__walkBase.REF.img) && window.__walkBase.REF.export === true));
await q('tab-Guides').click();
await q('ref-remove').click();
check('Remove takes it away', await ev(() => !window.__walkBase.REF.img));

// ---------------- saved performances ----------------
await page.locator('[data-testid="rig"]').selectOption('dog');
await q('tab-Auto').click();
check('nothing is saved yet', await page.locator('[data-testid^="perf-item-"]').count() === 0);
await q('clip-pickup').click(); await q('clip-add').click();
const laneCount = await ev(() => Object.keys(window.__walkBase.S.lanes).length);
await q('perf-name').fill('Pick up at 1');
await q('perf-save').click();
check('Save current keeps it under its name', await page.locator('[data-testid="perf-item-Pick up at 1"]').count() === 1);
await q('lanes-clear-all').click();
check('the working copy can be cleared', await ev(() => Object.keys(window.__walkBase.S.lanes).length === 0));
await page.locator('[data-testid="perf-load-Pick up at 1"]').click();
check('Load brings the lanes and length back', await ev((n) => Object.keys(window.__walkBase.S.lanes).length === n && window.__walkBase.S.perfLen > 0, laneCount));
await page.locator('[data-testid="rig"]').selectOption('human');
await q('tab-Auto').click();
check('the human has its own list', await page.locator('[data-testid^="perf-item-"]').count() === 0);
await page.locator('[data-testid="rig"]').selectOption('dog');
await q('tab-Auto').click();
await page.waitForTimeout(500);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(400);
await page.locator('[data-testid="rig"]').selectOption('dog').catch(() => {});
await q('tab-Auto').click();
check('saved performances survive a reload', await page.locator('[data-testid="perf-item-Pick up at 1"]').count() === 1);
await page.locator('[data-testid="perf-del-Pick up at 1"]').click();
check('Delete removes it', await page.locator('[data-testid^="perf-item-"]').count() === 0);

// ---------------- data exports ----------------
await q('tab-Export').click();
const kf = await ev(() => window.__walkBase.findKeyFrames());
const total = await ev(() => window.__walkBase.timeline({ cycles: 1 }).rows.length);
check('the key frames are a few of the frames, in order', kf.length >= 4 && kf.length < total && kf[0].frame === 0, { n: kf.length, total });
const zip = await ev(async () => { const r = await window.__walkBase.exportKeys({ width: 320, height: 240 }); return { size: r.blob.size, count: r.count }; });
check('Key poses only makes a zip of just those frames', zip.size > 2000 && zip.count === kf.length, zip);
const [dl] = await Promise.all([page.waitForEvent('download'), press(page, 'export-lanes-csv')]);
const csvPath = await dl.path();
const csv = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
check('Lane data (CSV) downloads one row per frame', dl.suggestedFilename() === 'walk-lanes.csv' && csv[0].startsWith('frame,seconds,cycle_phase,position') && csv.length === total + 1, { name: dl.suggestedFilename(), rows: csv.length });
const [dl2] = await Promise.all([page.waitForEvent('download'), press(page, 'export-lanes-json')]);
const js = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
check('Lane data (JSON) carries the lanes and the table', js.format === 'walk-base-lanes' && js.rows.length === total && Array.isArray(js.columns), { fmt: js.format });
await shot('export');

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
