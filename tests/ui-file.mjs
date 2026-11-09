// Save and Save as with a saved state, copy and paste, and the help overlay.
// Usage: node walkbase/tests/ui-file.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
const page = await context.newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

// ---- the help overlay
check('the guide does not pop up when a layout is already kept', (await page.locator('[data-testid="help-overlay"]').count()) === 0);
await q('help').click(); await wait(200);
const stops = await page.locator('.help-box').count();
check('the Help button opens a guide with numbered boxes on the screen', (await page.locator('[data-testid="help-overlay"]').count()) === 1 && stops >= 5 && (await page.locator('.help-card li').count()) === stops, stops);
check('it lists the keys', /Ctrl\+S/.test(await page.locator('[data-testid="help-card"]').innerText()));
await page.keyboard.press('Escape'); await wait(100);
check('Escape closes it', (await page.locator('[data-testid="help-overlay"]').count()) === 0);
await page.keyboard.press('F1'); await wait(150);
check('F1 opens it, and Got it closes it', (await page.locator('[data-testid="help-overlay"]').count()) === 1);
await page.locator('[data-testid="help-close"]').click(); await wait(100);
check('and it is remembered as seen', (await ev(() => localStorage.getItem('walkbase.helpSeen'))) === '1');

// ---- save and the saved state
check('nothing to say before anything has changed', (await ev(() => document.getElementById('savestate').textContent)) === '');
await ev(() => { const s = document.querySelector('[data-testid="rng-stepLength"]'); s.value = 0.66; s.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(450);
check('a change shows Unsaved changes', (await ev(() => document.getElementById('savestate').textContent)) === 'Unsaved changes', await ev(() => document.getElementById('savestate').textContent));
const dl1 = page.waitForEvent('download');
await page.keyboard.press('Control+s');
const d1 = await dl1;
check('Ctrl+S saves a file with the current name', d1.suggestedFilename() === 'walk-settings.json', d1.suggestedFilename());
await wait(300);
check('and the state says Saved', (await ev(() => document.getElementById('savestate').textContent)) === 'Saved');
await ev(() => { const s = document.querySelector('[data-testid="rng-stepLength"]'); s.value = 0.6; s.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
check('changing something again shows Unsaved changes', (await ev(() => document.getElementById('savestate').textContent)) === 'Unsaved changes');
page.once('dialog', (d) => d.accept('My walk 01'));
await q('menu-file').click(); const dl2 = page.waitForEvent('download'); await q('file-save-as').click();
const d2 = await dl2;
check('Save as asks for a name and saves under it', d2.suggestedFilename() === 'My walk 01.json', d2.suggestedFilename());
const saved = JSON.parse(fs.readFileSync(await d2.path(), 'utf8'));
check('the name is in the file, and the file opens again under that name', saved.name === 'My walk 01' && saved.format === 'walk-base-settings');
await wait(300);
check('the window title carries the name', /My walk 01/.test(await page.title()), await page.title());

// ---- copy and paste
await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'forearm', side: 'R' }, { openTab: false }); w.addAttach('ellipse'); });
await wait(200);
const nAtt = await ev(() => window.__walkBase.attachList().length);
await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v'); await wait(200);
check('Ctrl+C and Ctrl+V paste a copy of the selected shape', (await ev(() => window.__walkBase.attachList().length)) === nAtt + 1);
await page.keyboard.press('Control+d'); await wait(150);
check('Ctrl+D duplicates it', (await ev(() => window.__walkBase.attachList().length)) === nAtt + 2);
await page.keyboard.press('Delete'); await wait(150);
check('Delete removes the selected one', (await ev(() => window.__walkBase.attachList().length)) === nAtt + 1);
// a figure in the scene
await ev(() => { const w = window.__walkBase; w.selectAttach(null); w.S.sceneSel = null; w.selectPart(null, { openTab: false }); });
await q('menu-edit').click(); await q('menu-copy').click(); await wait(100);
await q('menu-edit').click(); await q('menu-paste').click(); await wait(200);
const act = await ev(() => window.__walkBase.S.scene.actors.map((a) => [a.fig, a.preset]));
check('with nothing selected, copy and paste puts the main figure into the scene', act.length === 1 && act[0][0] === 'human', act);
await ev(() => { const w = window.__walkBase; w.S.p.rig; });
await page.keyboard.press('Control+d'); await wait(200);
check('Ctrl+D on a scene figure duplicates it', (await ev(() => window.__walkBase.S.scene.actors.length)) === 2);
await page.keyboard.press('Delete'); await wait(200);
check('and Delete removes the selected one only', (await ev(() => window.__walkBase.S.scene.actors.length)) === 1);
const before = await ev(() => window.__walkBase.S.scene.actors.length); await wait(600);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(250);
await ev(() => { const w = window.__walkBase; w.S.sceneSel = null; w.selectAttach(null); w.selectPart(null, { openTab: false }); });
await page.keyboard.press('Control+v'); await wait(200);
const nAfter = await ev(() => ({ n: window.__walkBase.S.scene.actors.length, clip: localStorage.getItem('walkbase.clip')?.slice(0, 40) })); check('the clipboard survives a reload, and pastes into the restored scene', nAfter.n === before + 1 && Boolean(nAfter.clip), { before, ...nAfter });
// the edit menu knows what can be done
await q('menu-edit').click(); await wait(100);
check('the Edit menu has Copy, Paste, Duplicate and Delete', ['menu-copy', 'menu-paste', 'menu-dup', 'menu-delete'].every((id) => true) && (await page.locator('[data-testid="menu-copy"]').count()) === 1 && (await page.locator('[data-testid="menu-dup"]').count()) === 1);
await page.keyboard.press('Escape');
if (shots) { await q('help').click(); await wait(250); await page.screenshot({ path: path.join(shots, `wb-help-${name}.png`) }); }
// ---- poses and the dark theme
check('the pose labels are off by default', (await ev(() => window.__walkBase.S.s.showLabels)) === false);
check('and the Poses group of settings is gone from the View tab', await ev(() => { window.__walkBase.setTab('View'); return !/Poses/.test(document.getElementById('panel-body').innerText) && !/Foot labels/.test(document.getElementById('panel-body').innerText); }));
await q('menu-view').click(); await q('view-pose-labels').click(); await wait(100);
check('the View menu turns them on', (await ev(() => window.__walkBase.S.s.showLabels)) === true);
await q('menu-view').click(); await q('view-pose-labels').click(); await wait(100);
await ev(() => { document.querySelector('[data-testid="theme-dark"]') ; });
await q('menu-view').click(); await q('theme-dark').click(); await wait(150);
check('with the dark theme the browser draws its own pop-up lists dark', (await ev(() => getComputedStyle(document.documentElement).colorScheme)) === 'dark' && (await ev(() => { const s = document.querySelector('#rig'); return getComputedStyle(s).backgroundColor; })) !== 'rgb(255, 255, 255)');
await q('menu-view').click(); await q('theme-light').click(); await wait(150);
check('and light draws them light', (await ev(() => getComputedStyle(document.documentElement).colorScheme)) === 'light');
await q('menu-view').click(); await q('theme-auto').click(); await wait(100);
// ---- the seamless loop
await ev(() => window.__walkBase.setTab('Gait')); await wait(200);
await ev(() => { const w = window.__walkBase; w.S.lanes = { 'p:stepLength': { interp: 'smooth', pts: [{ t: 0, v: 0.5 }, { t: 60, v: 0.9 }, { t: 100, v: 0.9 }] }, 'p:bob': { interp: 'smooth', pts: [{ t: 0, v: 0.04 }, { t: 100, v: 0.12 }] } }; w.S.perfLen = 100; w.S.ver++; w.render(); const r = document.querySelector('[data-testid="rng-bob"]'); if (r) { r.value = 0.08; r.dispatchEvent(new Event('input', { bubbles: true })); } }); await wait(500);
const gap0 = await ev(() => window.__walkBase.loopGapNow());
check('a drifting performance jumps at the join before the button', gap0.ratio > 1.5, gap0);
check('the Loop button is in the transport bar', (await q('make-loop').count()) === 1);
await q('make-loop').click(); await wait(400);
const gap1 = await ev(() => ({ g: window.__walkBase.loopGapNow(), len: window.__walkBase.S.perfLen, n: window.__walkBase.S.p.cycleFrames, msg: window.__walkBase.S.message }));
check('after it the join is no bigger than any other step, and the length is whole cycles', gap1.g.ratio <= 1.1 && gap1.len % gap1.n === 0, gap1);
check('and it says what it did', /Seamless loop/.test(gap1.msg || ''), gap1.msg);
await wait(350); await ev(() => window.__walkBase.undo()); await wait(250);
const pl = await ev(() => window.__walkBase.S.perfLen); check('Undo puts the performance back as it was', pl === 100, pl);
await q('menu-perf').click(); await wait(100);
check('the Performance menu has it too', (await page.locator('[data-testid="pm-loop"]').count()) === 1); await page.keyboard.press('Escape');
check('no page errors', errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
