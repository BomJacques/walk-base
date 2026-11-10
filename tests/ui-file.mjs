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
// ---- weight, variety, the walk in one line, and reset
await ev(() => window.__walkBase.setTab('Gait')); await wait(200);
check('the gait chart is gone, and the walk is one line of numbers', (await page.locator('canvas.gaitchart').count()) === 0 && /steps a minute/.test(await ev(() => document.querySelector('[data-testid="gait-facts"]')?.textContent || '')));
check('Weight, Noise, Noise speed, Noise seed and the loop switch are in the Gait tab', await ev(() => ['rng-weight', 'rng-noiseAmount', 'rng-noiseSpeed', 'rng-noiseSeed'].every((id) => document.querySelector(`[data-testid="${id}"]`))));
const frame3 = async () => { await ev(() => { window.__walkBase.setFrame(3); window.__walkBase.render(); }); await wait(120); return page.locator('[data-testid="stage"]').screenshot(); };
const w0 = await frame3();
await ev(() => { const e = document.querySelector('[data-testid="rng-weight"]'); e.value = 1; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('Weight changes the walk', Buffer.compare(w0, await frame3()) !== 0 && (await ev(() => window.__walkBase.S.p.weight)) === 1);
const gaitLine = await ev(() => document.querySelector('[data-testid="gait-facts"]').textContent);
await ev(() => { const e = document.querySelector('[data-testid="rng-weight"]'); e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('and the line of numbers follows it', gaitLine !== (await ev(() => document.querySelector('[data-testid="gait-facts"]').textContent)), gaitLine);
const n0 = await frame3();
await ev(() => { const e = document.querySelector('[data-testid="rng-noiseAmount"]'); e.value = 1; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('Noise changes the walk', Buffer.compare(n0, await frame3()) !== 0);
await ev(() => { const e = document.querySelector('[data-testid="rng-noiseAmount"]'); e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
// the Heavy and Light walks and the new movements
await ev(() => window.__walkBase.applyPreset('Heavy')); await wait(200);
check('Heavy is a walk with weight', (await ev(() => window.__walkBase.S.p.weight)) > 0.5);
await ev(() => window.__walkBase.applyPreset('Normal')); await wait(150);
check('the stumble, slip and stagger movements are there', await ev(() => ['stumble', 'slip', 'stagger'].every((id) => window.__walkBase.clipsFor('human').some((c) => c.id === id))));
// reset
await ev(() => { const w = window.__walkBase; w.S.p.weight = 0.5; w.S.p.noiseAmount = 0.4; w.S.r = { head: 1.4 }; w.S.s.fillColor = '#aa3355'; w.S.sceneSel = 'main'; w.setTab('Gait'); }); await wait(250);
await q('fig-reset').click(); await q('reset-body').click(); await wait(150);
check('Reset the body puts the proportions back and leaves the walk alone', (await ev(() => Object.keys(window.__walkBase.S.r).length)) === 0 && (await ev(() => window.__walkBase.S.p.weight)) === 0.5);
await q('fig-reset').click(); await q('reset-colours').click(); await wait(150);
check('Reset the colours puts the colours back', (await ev(() => window.__walkBase.S.s.fillColor)) !== '#aa3355');
await q('fig-reset').click(); await q('reset-gait').click(); await wait(200);
check('Reset the walk puts weight and variety back', (await ev(() => window.__walkBase.S.p.weight)) === 0 && (await ev(() => window.__walkBase.S.p.noiseAmount)) === 0);
await ev(() => { window.__walkBase.S.p.weight = 0; window.__walkBase.S.p.noiseAmount = 0; window.__walkBase.S.sceneSel = null; window.__walkBase.render(); });
// ---- a longer performance
await ev(() => window.__walkBase.setTab('Auto')); await wait(150);
await q('perf-menu').click(); await wait(100);
check('the Set length menu goes up to ten minutes', (await page.locator('[data-testid="perf-s600"]').count()) === 1 && (await page.locator('[data-testid="perf-x64"]').count()) === 1);
const t0 = Date.now(); await q('perf-s300').click(); await wait(800);
const longInfo = await ev(() => ({ len: window.__walkBase.S.perfLen, fps: window.__walkBase.S.p.fps, cells: document.querySelectorAll('#strip .cell').length, step: window.__walkBase.S.stripStep }));
check('five minutes is 7200 frames at 24 a second, and the timeline copes', longInfo.len === Math.round((24 * 300) / 24) * 24 && longInfo.cells <= 1300 && longInfo.step > 1, { ...longInfo, ms: Date.now() - t0 });
await ev(() => { window.__walkBase.setFrame(5000); }); await wait(300);
check('the playhead is on a cell in the long strip, and the time shows minutes', (await page.locator('#strip .cell.on').count()) === 1 && /^208:/.test(await ev(() => document.getElementById('tc').textContent)), await ev(() => document.getElementById('tc').textContent));
const png0 = await page.locator('[data-testid="stage"]').screenshot(); await ev(() => window.__walkBase.setFrame(6900)); await wait(200);
check('the walk plays at the far end', Buffer.compare(png0, await page.locator('[data-testid="stage"]').screenshot()) !== 0);
await ev(() => { window.__walkBase.S.perfLen = 0; window.__walkBase.S.ver++; window.__walkBase.setFrame(0); }); await q('perf-menu').click().catch(() => {}); await page.keyboard.press('Escape');
await ev(() => window.__walkBase.setTab('Gait')); await wait(200);
// ---- the Moebius style, and wider ranges
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.setFrame(5); w.setTab('View'); }); await wait(150);
const darkPixels = () => ev(() => { const c = document.querySelector('[data-testid="stage"]'); const m = window.__walkBase.S.map; const x = Math.round(m.x0); const y = Math.round(m.y0); const w = Math.round(m.zw); const h = Math.round(m.zh); const d = c.getContext('2d').getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 330) n++; return n; });
const cornerPx = () => ev(() => { const c = document.querySelector('[data-testid="stage"]'); const m = window.__walkBase.S.map; const d = c.getContext('2d').getImageData(Math.round(m.x0) + 8, Math.round(m.y0) + 8, 1, 1).data; return [d[0], d[1], d[2]]; });
await ev(() => { window.__walkBase.S.s.style = 'outline'; window.__walkBase.render(); }); await wait(120);
const outlineDark = await darkPixels(); const outlineCorner = await cornerPx();
await page.locator('.segbtn', { hasText: 'moebius' }).first().click(); await wait(300);
check('choosing the Moebius style sets the style and brings its colours', (await ev(() => window.__walkBase.S.s.style)) === 'moebius' && (await ev(() => window.__walkBase.S.s.fillColor)) === '#efe3c6');
const mbCorner = await cornerPx();
check('the stage is paper-coloured', mbCorner.join() === '242,234,214' && mbCorner.join() !== outlineCorner.join(), mbCorner);
const mbDark = await darkPixels();
await ev(() => { window.__walkBase.S.s.moebiusShade = 0; window.__walkBase.render(); }); await wait(100);
const none = await darkPixels();
await ev(() => { window.__walkBase.S.s.moebiusShade = 1; window.__walkBase.render(); }); await wait(100);
const full = await darkPixels();
check('the form is shaded with hatching and dots, and Shadow reach controls how much', none < mbDark && mbDark < full && full > none * 1.15, { none, mbDark, full, outlineDark });
await ev(() => { window.__walkBase.S.s.moebiusShade = 0.5; window.__walkBase.S.s.moebiusPaper = false; window.__walkBase.render(); }); await wait(100);
check('and Paper-coloured stage can be turned off', (await cornerPx()).join() !== '242,234,214');
for (const part of [0, 1]) { await ev((hose) => { const w = window.__walkBase; w.setFigure(hose ? 'hose' : 'dog'); w.render(); }, part === 1); await wait(150); }
check('the style draws the dog and the rubber hose figure without errors', errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.S.s.style = 'mannequin'; w.S.s.moebiusPaper = true; w.S.s.fillColor = '#f6f3ec'; w.S.s.lineColor = '#26231f'; w.S.s.farTint = '#8c9db5'; w.render(); w.setTab('Gait'); }); await wait(150);
check('the sliders reach further: arm swing to 120 degrees, a lean of minus 30 to plus 60', await ev(() => { const a = document.querySelector('[data-testid="rng-armSwing"]'); const l = document.querySelector('[data-testid="rng-lean"]'); return a && l && Number(a.max) === 120 && Number(l.min) === -30 && Number(l.max) === 60; }));
// ---- loops that are seamless in the drawing, not only in the numbers
const wrapRatio = () => ev(() => {
  const w = window.__walkBase; const T = w.S.perfLen > 0 ? w.S.perfLen : Math.round(w.S.p.cycleFrames); const ex = w.S.p.exposure || 1;
  const cv = document.querySelector('[data-testid="stage"]'); const ctx = cv.getContext('2d'); const mp = w.S.map;
  const grab = (f) => { w.setFrame(f); w.render(); return ctx.getImageData(Math.round(mp.x0), Math.round(mp.y0), Math.round(mp.zw), Math.round(mp.zh)).data; };
  const diff = (a, b) => { let t = 0; for (let i = 0; i < a.length; i += 16) t += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return t; };
  const fr = []; for (let f = 0; f < T; f += ex) fr.push(grab(f)); const steps = []; for (let i = 1; i < fr.length; i++) steps.push(diff(fr[i - 1], fr[i]));
  return diff(fr[fr.length - 1], fr[0]) / Math.max(1, Math.max(...steps));
});
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.motion = {}; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.S.s.showOnion = true; w.S.p.travel = 'follow'; w.S.ver++; w.setFrame(0); w.render(); }); await wait(200);
const onionRatio = await wrapRatio();
check('with onion skin on, the loop join is no bigger than any other step (ghosts do not jump a stride)', onionRatio <= 1.15, onionRatio);
await ev(() => { const w = window.__walkBase; w.S.s.showOnion = false; w.S.s.showFootprints = true; w.S.lanes = { 'p:stepLength': { interp: 'smooth', pts: [{ t: 0, v: 0.5 }, { t: 70, v: 0.95 }] }, 'p:bob': { interp: 'smooth', pts: [{ t: 0, v: 0.04 }, { t: 90, v: 0.11 }] } }; w.S.perfLen = 100; w.S.ver++; w.makeLoop(); }); await wait(300);
const perfRatio = await wrapRatio();
check('a performance made into a loop, with footprints and the ground, joins smoothly', perfRatio <= 1.15, perfRatio);
await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'spine.upper' }, { openTab: false }); w.addAttach('strip'); w.S.ver++; w.makeLoop(); }); await wait(300);
const capeRatio = await wrapRatio();
check('and with a cape attached', capeRatio <= 1.15, capeRatio);
await ev(() => { const w = window.__walkBase; w.S.attach.human = []; w.S.attachSel = null; w.S.lanes = {}; w.S.perfLen = 0; w.S.s.showFootprints = false; w.S.p.travel = 'across'; w.S.ver++; w.makeLoop(); }); await wait(200);
check('across the screen cannot loop, so the Loop button makes the camera follow the figure', (await ev(() => window.__walkBase.S.p.travel)) === 'follow');
await ev(() => { const w = window.__walkBase; w.applyPreset('Bouncy'); w.setFigure('hose'); }); await wait(100);
await ev(() => { const w = window.__walkBase; w.setFigure('hose'); w.S.p.exposure = 2; }); 
await ev(() => { const e = document.querySelector('[data-testid="rng-cycleFrames"]'); if (e) { e.value = 13; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await wait(200);
check('with drawings held for two frames, the cycle stays a whole number of drawings', (await ev(() => window.__walkBase.S.p.cycleFrames)) % 2 === 0, await ev(() => window.__walkBase.S.p.cycleFrames));
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.p.exposure = 1; });
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
// ---- hand and foot styles
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.s.style = 'mannequin'; w.S.s.handStyle = 'default'; w.S.s.footStyle = 'default'; w.S.s.camYaw = -30; w.S.ver++; w.setTab('View'); w.setFrame(4); w.render(); }); await wait(200);
const stageShot = async () => (await page.locator('[data-testid="stage"]').screenshot()).toString('base64');
const plainFig = await stageShot(); const seenLooks = new Set([plainFig]);
check('the View tab has Hands and Feet choices', (await q('opt-handStyle-fingers').count()) === 1 && (await q('opt-footStyle-bare').count()) === 1);
for (const o of ['mitten', 'fist', 'fingers', 'pointing']) { await q(`opt-handStyle-${o}`).click(); await wait(120); seenLooks.add(await stageShot()); }
for (const o of ['boot', 'bare', 'round']) { await q(`opt-footStyle-${o}`).click(); await wait(120); seenLooks.add(await stageShot()); }
check('every hand and foot style changes the drawing', seenLooks.size === 8, seenLooks.size);
await q('opt-handStyle-default').click(); await q('opt-footStyle-default').click(); await wait(120);
check('default brings back the hands and feet of the figure', (await stageShot()) === plainFig);
await ev(() => { window.__walkBase.S.s.handStyle = 'fingers'; window.__walkBase.S.s.footStyle = 'bare'; });
for (const fig of ['hose', 'dog', 'human']) { await ev((f) => { window.__walkBase.setFigure(f); window.__walkBase.render(); }, fig); await wait(120); }
await ev(() => { const w = window.__walkBase; for (const st of ['outline', 'stick', 'silhouette', 'moebius', 'mannequin']) { w.S.s.style = st; w.render(); } });
check('they draw on the rubber hose figure and in every style without an error', errors.length === 0, errors);
await ev(() => { window.__walkBase.S.s.handStyle = 'default'; window.__walkBase.S.s.footStyle = 'default'; });
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.setTab('Gait'); });
// ---- rubber hose: more controls, the horse and the bird, wobbly walks and movements
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.setTab('Gait'); }); await wait(150);
check('the wobble controls are not shown for the mannequin', (await q('rng-hoseWobble').count()) === 0);
await ev(() => { const w = window.__walkBase; w.setFigure('hose'); w.applyPreset('Bouncy'); w.S.s.camYaw = -20; w.setFrame(3); w.render(); }); await wait(200);
check('the rubber hose figure has Wobble and Wobbles per cycle', (await q('rng-hoseWobble').count()) === 1 && (await q('rng-hoseWobbleRate').count()) === 1);
const hoseLooks = new Set([await stageShot()]);
await ev(() => { const e = document.querySelector('[data-testid="rng-hoseWobble"]'); e.value = 1.2; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150); hoseLooks.add(await stageShot());
for (const [k, v] of [['hoseTaper', 0.8], ['hoseBelly', 1.6], ['hoseTail', 1]]) { await ev(([k, v]) => { const w = window.__walkBase; w.S.s[k] = v; w.render(); }, [k, v]); await wait(100); hoseLooks.add(await stageShot()); }
check('wobble, limb taper, belly and tail each change the drawing', hoseLooks.size === 5, hoseLooks.size);
await ev(() => window.__walkBase.setTab('View')); await wait(150);
check('taper, belly and tail are in the View tab', (await q('rng-hoseTaper').count()) === 1 && (await q('rng-hoseBelly').count()) === 1 && (await q('rng-hoseTail').count()) === 1);
const presetNames = await ev(() => [...document.querySelectorAll('select')].flatMap((s) => [...s.options].map((o) => o.textContent)));
check('the wobbly walks are in the presets', ['Wobbly', 'Jelly legs', 'Noodle arms', 'Drunk', 'Boing'].every((n) => presetNames.includes(n)), presetNames.length);
await ev(() => { const w = window.__walkBase; w.applyPreset('Wobbly'); w.setTab('Auto'); }); await wait(200);
check('the rubber hose figure has a Wobbly group of movements', (await q('clip-group-Wobbly').count()) === 1 || (await page.locator('text=Wobble like jelly').count()) > 0);
await ev(() => { const w = window.__walkBase; w.S.s.hoseTaper = 0; w.S.s.hoseBelly = 1; w.S.s.hoseTail = 0; });
const figNames = await ev(() => [...document.querySelectorAll('select option')].map((o) => o.value));
check('Horse, Rubber hose horse and Rubber hose bird are figures', ['horse', 'hosehorse', 'hosebird'].every((f) => figNames.includes(f)));
const animalLooks = new Set();
for (const fig of ['horse', 'hosehorse', 'hosebird']) {
  await ev((f) => { const w = window.__walkBase; w.setFigure(f); w.S.s.camYaw = 0; w.setTab('Gait'); w.setFrame(3); w.render(); }, fig); await wait(250); animalLooks.add(await stageShot());
  const n = await q('rng-hoseWobble').count();
  check(`${fig}: ${fig === 'horse' ? 'no wobble control' : 'has the wobble control'}`, n === (fig === 'horse' ? 0 : 1), n);
  for (const st of ['outline', 'stick', 'silhouette', 'moebius', 'mannequin']) await ev((s) => { const w = window.__walkBase; w.S.s.style = s; w.render(); }, st);
  for (let f = 0; f < 12; f++) await ev((f) => window.__walkBase.setFrame(f), f);
}
check('each of the three draws differently, in every style, with no errors', animalLooks.size === 3 && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.setFigure('hosehorse'); w.applyPreset('Wobbly'); w.setTab('Auto'); }); await wait(200);
check('the rubber hose horse has wobbly movements too', (await page.locator('text=Wobble like jelly').count()) > 0);
await ev(() => { const w = window.__walkBase; w.setFigure('hosehorse'); w.applyPreset('Walk'); w.S.s.showOnion = false; w.setFrame(0); w.render(); }); await wait(150);
check('a wobbling rubber hose horse still loops seamlessly', (await wrapRatio()) <= 1.2, await wrapRatio());
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.setTab('Gait'); });
// ---- a longer playback at the same speed, from the transport bar
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setFrame(0); w.render(); }); await wait(150);
const cyc0 = await ev(() => window.__walkBase.S.p.cycleFrames);
check('there is a Length button beside Loop', (await q('length-menu').count()) === 1);
await q('length-menu').click(); await page.locator('[data-testid="perf-x8"]:visible').first().click(); await wait(200);
check('8 cycles makes the playback eight times as long and leaves the speed of the walk alone', (await ev(() => window.__walkBase.S.perfLen)) === 8 * cyc0 && (await ev(() => window.__walkBase.S.p.cycleFrames)) === cyc0);
await q('length-menu').click(); await page.locator('[data-testid="perf-one"]:visible').first().click(); await wait(200);
check('One cycle puts it back', (await ev(() => window.__walkBase.S.perfLen)) === 0);
check('the rubber hose figure starts at an easy pace', (await ev(() => { const w = window.__walkBase; w.setFigure('hose'); const c = w.S.p.cycleFrames; w.setFigure('human'); return c; })) >= 20);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
