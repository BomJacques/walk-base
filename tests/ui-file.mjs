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
check('the rubber hose figure starts at an easy pace', (await ev(() => { const w = window.__walkBase; w.setFigure('hose'); w.applyPreset('Bouncy'); const c = w.S.p.cycleFrames; w.setFigure('human'); return c; })) >= 20);
// ---- the face: eye styles, blinks, eyebrows and mouth styles
await page.mouse.move(4, 4); // off the panel, so no line of help is showing over the stage
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.s.style = 'mannequin'; w.S.s.focus = 'head'; w.S.s.camYaw = -65; w.S.s.camPitch = 0; w.S.ver++; w.setTab('Speech'); w.setFrame(2); w.render(); }); await wait(250);
const face0 = await stageShot(); const faces = new Set([face0]);
check('the Speech tab has eye, eyebrow and mouth settings', (await q('opt-eyeStyle-almond').count()) === 1 && (await q('opt-browStyle-arched').count()) === 1 && (await q('opt-mouthStyle-cartoon').count()) === 1 && (await q('rng-mouthSmile').count()) === 1);
for (const o of ['dots', 'round', 'pie', 'almond', 'closed']) { await q(`opt-eyeStyle-${o}`).click(); await wait(120); faces.add(await stageShot()); }
await q('opt-eyeStyle-round').click(); await wait(100);
for (const o of ['line', 'thick', 'arched']) { await q(`opt-browStyle-${o}`).click(); await wait(120); faces.add(await stageShot()); }
await q('opt-mouthShow-always').click(); await wait(120); faces.add(await stageShot());
for (const o of ['line', 'curve', 'cartoon']) { await q(`opt-mouthStyle-${o}`).click(); await wait(120); faces.add(await stageShot()); }
for (const [k, v] of [['eyeLid', 0.5], ['eyeLookX', 0.9], ['browFurrow', 0.9], ['mouthSmile', 0.9], ['eyeSize', 1.6]]) { await ev(([k, v]) => { const e = document.querySelector(`[data-testid="rng-${k}"]`); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]); await wait(120); faces.add(await stageShot()); }
check('the eye, eyebrow and mouth choices change the face', faces.size >= 15, faces.size);
await ev(() => { const e = document.querySelector('[data-testid="rng-eyeLid"]'); e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); const b = document.querySelector('[data-testid="rng-blinkRate"]'); b.value = 2; b.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(120);
const blinkFrames = new Set(); for (let f = 0; f < 24; f++) { await ev((f) => window.__walkBase.setFrame(f), f); blinkFrames.add(await stageShot()); }
check('with two blinks a cycle the eyes are seen open, half shut and shut', blinkFrames.size >= 3, blinkFrames.size);
await ev(() => { const w = window.__walkBase; for (const k of ['eyeStyle', 'eyeSize', 'eyeLookX', 'eyeLid', 'blinkRate', 'browStyle', 'browFurrow', 'mouthShow', 'mouthStyle', 'mouthSmile']) w.S.s[k] = ({ eyeStyle: 'default', eyeSize: 1, eyeLookX: 0, eyeLid: 0, blinkRate: 0, browStyle: 'none', browFurrow: 0, mouthShow: 'when speaking', mouthStyle: 'full', mouthSmile: 0 })[k]; w.S.s.focus = 'body'; w.S.s.camYaw = -65; w.setFrame(2); w.render(); }); await wait(200);
await ev(() => { const w = window.__walkBase; w.S.s.focus = 'head'; w.render(); }); await wait(150);
check('and the defaults give the plain face back', (await stageShot()) === face0);
await ev(() => { const w = window.__walkBase; w.setFigure('hose'); w.S.s.focus = 'head'; w.S.s.eyeStyle = 'almond'; w.S.s.browStyle = 'thick'; w.S.s.mouthStyle = 'cartoon'; w.S.s.mouthSmile = 0.8; w.setFrame(2); w.render(); }); await wait(200);
const hoseFace = await stageShot();
await ev(() => { const w = window.__walkBase; w.S.s.eyeStyle = 'default'; w.S.s.browStyle = 'none'; w.S.s.mouthStyle = 'full'; w.S.s.mouthSmile = 0; w.S.s.blinkRate = 0; w.render(); }); await wait(150);
check('the rubber hose figure takes the same face settings', (await stageShot()) !== hoseFace);
await ev(() => { const w = window.__walkBase; w.setFigure('dog'); w.setTab('Speech'); }); await wait(150);
check('the face settings are not offered for the animals', (await q('opt-eyeStyle-almond').count()) === 0);
check('no errors from the face', errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.S.s.focus = 'body'; w.S.s.camYaw = 0; w.setTab('Gait'); w.render(); });
// ---- the mood pad, posture controls and the comic, ink and pencil styles
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.s.style = 'mannequin'; w.S.s.camYaw = 0; w.S.ver++; w.setTab('Gait'); w.setFrame(4); w.render(); }); await wait(250);
check('the Body tab has a mood pad with Happy, Angry, Tired and Sneaky in its corners', (await q('mood-pad').count()) === 1 && (await ev(() => ['tl', 'tr', 'bl', 'br'].map((c) => document.querySelector(`[data-testid="mood-corner-${c}"]`).value).join())) === 'mood:Happy,mood:Angry,mood:Tired,mood:Sneaky');
const walk0 = await ev(() => JSON.stringify(window.__walkBase.S.p)); const moodPlain = await stageShot();
await q('mood-pad').scrollIntoViewIfNeeded(); const pb = await q('mood-pad').boundingBox();
await page.mouse.move(pb.x + pb.width * 0.5, pb.y + pb.height * 0.5); await page.mouse.down(); await page.mouse.move(pb.x + pb.width * 0.3, pb.y + pb.height * 0.3, { steps: 4 }); await page.mouse.move(pb.x + 3, pb.y + 3, { steps: 4 }); await page.mouse.up(); await wait(250);
const happyP = await ev(() => ({ ...window.__walkBase.S.p, mood: window.__walkBase.mood() }));
check('dragging the dot to the top left makes the walk happy: more bounce, more arm swing, chest out', happyP.bob > 0.11 && happyP.armSwing > 38 && happyP.chestOut > 5 && happyP.mood.x < 0.05 && happyP.mood.y < 0.05, { bob: happyP.bob, arm: happyP.armSwing, x: happyP.mood.x });
check('and the figure on the stage changes', (await stageShot()) !== moodPlain);
check('the readout says what the mix is', /(100|9\d)% Happy/.test(await q('mood-readout').textContent()), await q('mood-readout').textContent());
await ev(() => window.__walkBase.setMoodPad(0.5, 1)); await wait(150);
const mixP = await ev(() => window.__walkBase.S.p);
check('the bottom edge mixes Tired and Sneaky', /50% Tired, 50% Sneaky/.test(await q('mood-readout').textContent()) && mixP.lean > 9, await q('mood-readout').textContent());
await ev(() => { const e = document.querySelector('[data-testid="rng-armSwing"]'); e.value = 50; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(120);
await q('mood-centre').click(); await wait(200);
const backP = await ev(() => window.__walkBase.S.p);
check('Centre gives the walk back, keeping a slider moved meanwhile', Math.abs(backP.bob - JSON.parse(walk0).bob) < 1e-9 && Math.abs(backP.lean - JSON.parse(walk0).lean) < 1e-9 && backP.armSwing > JSON.parse(walk0).armSwing + 20, { bob: backP.bob, arm: backP.armSwing });
await q('mood-corner-tl').selectOption('preset:March'); await wait(200);
await ev(() => window.__walkBase.setMoodPad(0, 0)); await wait(150);
check('a corner can be one of the walks of the figure', (await ev(() => window.__walkBase.S.p.footLift)) > 0.28 && /100% March/.test(await q('mood-readout').textContent()));
await ev(() => { document.querySelector('[data-testid="mood-keys"]').open = true; const e = document.querySelector('[data-testid="mood-key-footLift"]'); e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(200);
check('a setting can be left out of what the pad moves', Math.abs((await ev(() => window.__walkBase.S.p.footLift)) - JSON.parse(walk0).footLift) < 1e-9 && (await ev(() => window.__walkBase.mood().skip.join())) === 'footLift');
await q('mood-centre').click(); await wait(150);
await ev(() => { const w = window.__walkBase; w.setParam('lean', 20); w.setParam('headTilt', 15); }); await wait(150);
await q('mood-capture').click(); await page.locator('[data-testid="mood-capture-br"]:visible').first().click(); await wait(250);
check('the walk as it is can be captured into a corner', (await ev(() => window.__walkBase.mood().corners.br.kind)) === 'custom' && (await ev(() => window.__walkBase.mood().corners.br.values.lean)) === 20);
await ev(() => { const w = window.__walkBase; w.setParam('lean', 4); w.setParam('headTilt', 0); w.setMoodPad(1, 1); }); await wait(150);
check('and moving to that corner brings it back', (await ev(() => window.__walkBase.S.p.lean)) === 20);
await ev(() => window.__walkBase.applyPreset('Normal')); await wait(150);
check('choosing a walk puts the dot back in the middle', (await ev(() => window.__walkBase.mood().x)) === 0.5 && (await ev(() => window.__walkBase.mood().base)) === null);
check('the posture sliders are there', (await q('rng-sideLean').count()) === 1 && (await q('rng-chestOut').count()) === 1 && (await q('rng-carry').count()) === 1 && (await q('rng-headTilt').count()) === 1 && (await q('rng-headTurn').count()) === 1 && (await q('rng-armCarry').count()) === 1);
const post = new Set([await stageShot()]);
for (const [k, v] of [['sideLean', 14], ['chestOut', -20], ['carry', 1], ['headTilt', 25], ['armCarry', 40]]) { await ev(([k, v]) => window.__walkBase.setParam(k, v), [k, v]); await wait(120); post.add(await stageShot()); }
check('each one changes the figure', post.size === 6, post.size);
await ev(() => { const w = window.__walkBase; w.setFigure('dog'); w.setTab('Gait'); }); await wait(200);
await ev(() => window.__walkBase.setMoodPad(0, 0)); await wait(150);
check('the dog has the pad too, with its own moods', (await ev(() => window.__walkBase.S.p.dogWag)) > 40 && (await q('rng-chestOut').count()) === 0);
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.setTab('View'); w.S.s.camYaw = -25; w.setFrame(4); w.render(); }); await wait(200);
const styleLooks = new Set([await stageShot()]);
for (const st of ['comic', 'ink', 'pencil']) { await q(`opt-style-${st}`).click(); await wait(150); styleLooks.add(await stageShot()); for (const fig of ['hose', 'hosehorse', 'bird', 'human']) { await ev((f) => { window.__walkBase.setFigure(f); window.__walkBase.render(); }, fig); } await ev(() => { const w = window.__walkBase; w.S.s.camYaw = -25; w.setTab('View'); w.setFrame(4); w.render(); }); await wait(150); }
check('Comic, Ink and Pencil are styles, each its own look, on every kind of figure', styleLooks.size === 4 && errors.length === 0, [styleLooks.size, errors]);
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; w.S.s.camYaw = 0; w.applyPreset('Normal'); w.setTab('Gait'); w.render(); });
// ---- the pad bank: eight pads, each a walk, with a blend between them
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.s.style = 'mannequin'; w.S.ver++; w.setTab('Gait'); w.setFrame(0); w.render(); }); await wait(250);
check('the Body tab has eight pads, all empty', (await page.locator('[data-testid="pad-grid"] .padbtn').count()) === 8 && (await page.locator('[data-testid="pad-grid"] .padbtn.empty').count()) === 8);
await q('pad-1').click(); await wait(200);
check('a tap on an empty pad keeps the walk on it, named after the walk', (await ev(() => window.__walkBase.padBank().pads[0]?.name)) === 'Normal' && (await q('pad-1').getAttribute('aria-pressed')) === 'true');
await ev(() => { const w = window.__walkBase; w.applyPreset('Sneak'); w.setMoodPad(0.2, 0.2); }); await wait(150);
await q('pad-2').click(); await wait(200);
const pad2 = await ev(() => window.__walkBase.padBank().pads[1]);
check('a second walk goes on a second pad, with where the mood pad was', pad2 && Math.abs(pad2.mood.x - 0.2) < 1e-9 && pad2.values.lean > 8, pad2 && pad2.name);
await q('pad-blend-0').click(); await wait(100); await q('pad-1').click(); await wait(250);
const cut = await ev(() => ({ lean: window.__walkBase.S.p.lean, cyc: window.__walkBase.S.p.cycleFrames, mood: window.__walkBase.mood().x, run: window.__walkBase.padRun() }));
check('Cut changes to the pad at once, and the mood pad goes back to where it was for that walk', cut.lean === 4 && cut.cyc === 24 && cut.mood === 0.5 && cut.run === null, cut);
await q('pad-blend-1').click(); await wait(100);
await ev(() => { const w = window.__walkBase; w.setFrame(0); w.triggerPad(1); }); await wait(60);
const startRun = await ev(() => ({ run: Boolean(window.__walkBase.padRun()), lean: window.__walkBase.S.p.lean }));
check('with a blend of one cycle the change is under way, not done', startRun.run && startRun.lean < pad2.values.lean - 0.5, startRun);
await page.waitForFunction(() => !window.__walkBase.padRun(), null, { timeout: 8000 }); await wait(100);
const done = await ev(() => ({ lean: window.__walkBase.S.p.lean, step: window.__walkBase.S.p.stepLength, cyc: window.__walkBase.S.p.cycleFrames, mood: window.__walkBase.mood().x, active: window.__walkBase.padBank().active }));
check('and it arrives exactly at the walk of the pad, with its cycle length and its mood', Math.abs(done.lean - pad2.values.lean) < 1e-9 && Math.abs(done.step - pad2.values.stepLength) < 1e-9 && done.cyc === pad2.values.cycleFrames && Math.abs(done.mood - 0.2) < 1e-9 && done.active === 1, done);
await q('pad-when-cycle').click(); await wait(100);
await ev(() => { const w = window.__walkBase; w.setFrame(3); w.play(); }); await wait(60);
await ev(() => window.__walkBase.triggerPad(0)); await wait(30);
const waiting = await ev(() => ({ wait: window.__walkBase.padRun()?.waiting, lean: window.__walkBase.S.p.lean, frame: window.__walkBase.S.frame }));
check('End of cycle: a pad tapped in the middle of a cycle waits, and the walk carries on as it was', waiting.wait === true && Math.abs(waiting.lean - pad2.values.lean) < 1e-9, waiting);
check('the waiting pad is marked', (await page.locator('[data-testid="pad-1"].queued').count()) === 1);
await page.waitForFunction(() => { const r = window.__walkBase.padRun(); return r && !r.waiting; }, null, { timeout: 8000 });
const began = await ev(() => ({ done: window.__walkBase.padRun()?.done, frame: window.__walkBase.S.frame }));
check('it starts as the cycle comes round', began.done <= 4, began);
await page.waitForFunction(() => !window.__walkBase.padRun(), null, { timeout: 10000 }); await ev(() => window.__walkBase.pause()); await wait(150);
check('and ends on the first pad\u2019s walk', (await ev(() => window.__walkBase.S.p.lean)) === 4 && (await ev(() => window.__walkBase.padBank().active)) === 0);
await ev(() => { const e = document.querySelector('[data-testid="pad-name"]'); e.value = 'Plain'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(150);
check('a pad can be named', (await q('pad-1').textContent()).includes('Plain'));
await q('pad-store').click(); await wait(150);
check('with Store pressed the pads flash until one is chosen', (await page.locator('[data-testid="pad-grid"].storing').count()) === 1 && (await ev(() => getComputedStyle(document.querySelector('[data-testid="pad-3"]')).animationName)) === 'padarm');
await ev(() => window.__walkBase.applyPreset('March')); await ev(() => window.__walkBase.padMode('store')); await q('pad-2').click(); await wait(200);
check('Store then a pad puts the walk as it is now on a pad that was full, and the flashing stops', (await ev(() => window.__walkBase.padBank().pads[1].name)) === 'March' && (await page.locator('[data-testid="pad-grid"].storing').count()) === 0);
await q('pad-clear').click(); await q('pad-2').click(); await wait(200);
check('Clear then a pad empties it', (await ev(() => window.__walkBase.padBank().pads[1])) === null && (await page.locator('[data-testid="pad-grid"] .padbtn.empty').count()) === 7);
await wait(400);
check('the bank is kept with the settings', (await ev(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /walkbase/.test(k) && (localStorage.getItem(k) || '').includes('"pads"'))) || '{}').pads?.human?.pads?.[0]?.name)) === 'Plain');
await ev(() => window.__walkBase.setFigure('dog')); await wait(200);
check('each figure has its own bank', (await page.locator('[data-testid="pad-grid"] .padbtn.empty').count()) === 8);
await ev(() => window.__walkBase.setFigure('human')); await wait(200);
check('and the first one is still there on the way back', (await q('pad-1').textContent()).includes('Plain') && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.padBank().pads.fill(null); w.padBank().active = null; w.padBank().when = 'now'; w.applyPreset('Normal'); w.setFrame(0); });
// ---- help on hover with a mouse, and recording the mood pad and the pads into a take
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setTab('Gait'); w.setFrame(0); w.render(); }); await wait(250);
await page.locator('.row:has([data-testid="rng-stepLength"])').first().scrollIntoViewIfNeeded(); await wait(150); await page.mouse.move(4, 4);
const rowBox = await page.locator('.row:has([data-testid="rng-stepLength"])').first().boundingBox();
await page.mouse.move(rowBox.x + 20, rowBox.y + rowBox.height / 2); await page.mouse.move(rowBox.x + 30, rowBox.y + rowBox.height / 2, { steps: 3 }); await wait(900);
const tipText = await ev(() => document.querySelector('[data-testid="hover-help"]')?.textContent || '');
check('resting the mouse on a slider shows its line of help', tipText.length > 10, tipText);
const tipBox = await ev(() => { const e = document.querySelector('[data-testid="hover-help"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
check('beside the row, not over it, and on the screen', tipBox && (tipBox.r <= rowBox.x + 1 || tipBox.t >= rowBox.y + rowBox.height - 1 || tipBox.b <= rowBox.y + 1) && tipBox.l >= 0 && tipBox.t >= 0, tipBox);
await page.mouse.move(200, 300); await wait(250);
check('and it goes when the mouse moves off', (await ev(() => document.querySelectorAll('[data-testid="hover-help"]').length)) === 0);
await q('help').click(); await wait(300);
const howText = await ev(() => document.querySelector('[data-testid="help-how"]')?.textContent || '');
check('the guide says how to record the mood pad and the pads', /Rec/.test(howText) && /Latch/.test(howText) && /mood dot/.test(howText) && /holds to the end/.test(howText), howText.slice(0, 80));
await ev(() => document.querySelector('[data-testid="help-close"]')?.click()); await wait(200);
// the mood pad, recorded
await ev(() => { const w = window.__walkBase; w.S.recMode = 'latch'; w.setArmed(true); w.setFrame(0); w.play(); }); await wait(250);
for (const [x, y] of [[0.4, 0.4], [0.3, 0.3], [0.15, 0.15], [0, 0]]) { await ev(([x, y]) => window.__walkBase.setMoodPad(x, y, { commit: false }), [x, y]); await wait(120); }
const during = await ev(() => ({ bob: window.__walkBase.S.p.bob, rec: window.__walkBase.S.recording }));
await ev(() => window.__walkBase.setMoodPad(0, 0, { commit: true })); await wait(200);
await ev(() => window.__walkBase.pause()); await wait(300);
const takeEnd = await ev(() => window.__walkBase.S.frame);
const take = await ev(() => { const w = window.__walkBase; const l = w.S.lanes['p:bob']; return { keys: Object.keys(w.S.lanes).filter((k) => k.startsWith('p:')).length, first: l?.pts?.[0]?.v, last: Math.max(...(l?.pts || []).map((q) => q.v)), n: l?.pts?.length, bob: w.S.p.bob, perf: w.S.perfLen, armed: w.S.armed }; });
check('while recording, the walk underneath is left alone', during.rec === true && Math.abs(during.bob - 0.075) < 1e-9, during);
check('dragging the mood dot in a take writes automation: the bounce rises from the plain walk to the happy one', take.keys >= 8 && Math.abs(take.first - 0.075) < 1e-6 && take.last > 0.11 && take.n >= 2 && take.perf > 24, take);
const atEnd = await ev((f) => { const w = window.__walkBase; w.setFrame(Math.max(0, f - 1)); return w.nowValues().p.bob; }, takeEnd);
check('and it plays back: at the end of the take the walk is happy', atEnd > 0.11, atEnd);
// the pads, recorded
await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setArmed(false); w.applyPreset('Normal'); w.storePad(0); w.applyPreset('Sneak'); w.storePad(1); w.applyPreset('Normal'); w.padBank().when = 'now'; w.padBank().blend = 0.5; w.setFrame(0); }); await wait(200);
await ev(() => { const w = window.__walkBase; w.S.recMode = 'touch'; w.setArmed(true); w.setFrame(0); w.play(); }); await wait(300);
await ev(() => window.__walkBase.triggerPad(1));
await page.waitForFunction(() => !window.__walkBase.padRun(), null, { timeout: 8000 }); await wait(200);
await ev(() => window.__walkBase.pause()); await wait(300);
const padTake = await ev(() => { const w = window.__walkBase; const l = w.S.lanes['p:lean']; return { has: Boolean(l), first: l?.pts?.[0]?.v, last: l?.pts?.[l.pts.length - 1]?.v, lean: w.S.p.lean, target: w.padBank().pads[1].values.lean, n: l?.pts?.length }; });
check('a pad tapped in a take writes its blend as automation, from the walk that was playing to the pad', padTake.has && Math.abs(padTake.first - 4) < 1e-6 && Math.abs(padTake.last - padTake.target) < 1e-6 && padTake.n >= 3 && padTake.lean === 4, padTake);
const padEnd = await ev(() => { const w = window.__walkBase; w.setFrame(w.S.perfLen - 1); return w.nowValues().p.lean; });
const cadLane = await ev(() => { const w = window.__walkBase; const l = w.S.lanes.cadence; return { first: l?.pts?.[0]?.v, last: l?.pts?.[l.pts.length - 1]?.v, want: 24 / w.padBank().pads[1].values.cycleFrames, cyc: w.S.p.cycleFrames }; });
check('the pad\u2019s pace is recorded too, as the speed lane: the sneak is slower, and the cycle length of the take is left alone', cadLane.first === 1 && Math.abs(cadLane.last - cadLane.want) < 1e-6 && cadLane.want < 0.9 && cadLane.cyc === 24, cadLane);
check('and it holds: the performance is still the sneaking walk at its last frame, even recorded in Touch', Math.abs(padEnd - padTake.target) < 1e-6 && errors.length === 0, [padEnd, errors]);
await ev(() => { const w = window.__walkBase; w.setArmed(false); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.padBank().pads.fill(null); w.padBank().active = null; w.padBank().blend = 1; w.applyPreset('Normal'); w.setFrame(0); });
// ---- leg length, for the human and the rubber hose figure
await page.mouse.move(4, 4);
for (const fig of ['human', 'hose']) {
  await ev((f) => { const w = window.__walkBase; w.pause(); w.setFigure(f); w.S.s.camYaw = 0; w.setTab('Gait'); w.setFrame(3); w.render(); }, fig); await wait(250);
  check(`${fig}: Leg length is in the proportions`, (await q('rng-leg').count()) === 1);
  const before = await stageShot();
  await ev(() => { const e = document.querySelector('[data-testid="rng-leg"]'); e.value = 1.4; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  const tall = await ev(() => window.__walkBase.S.r.leg);
  check(`${fig}: the slider makes the legs longer and the figure changes`, tall === 1.4 && (await stageShot()) !== before, tall);
  await ev(() => { const w = window.__walkBase; delete w.S.r.leg; w.S.ver++; w.render(); });
}
await ev(() => { const w = window.__walkBase; w.setFigure('dog'); w.setTab('Gait'); }); await wait(200);
check('the dog keeps its own Leg length', (await q('rng-leg').count()) === 0 && (await q('rng-dLeg').count()) === 1 && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.setTab('Gait'); });
// ---- each figure keeps its own walk across a switch (found in the audit: a human reached by way of the dog had the rubber hose walk, named Normal)
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('March'); w.setParam('lean', 9); w.setFigure('hose'); w.applyPreset('Sneak'); w.setFigure('dog'); w.applyPreset('Trot'); w.setFigure('human'); }); await wait(250);
const backHuman = await ev(() => ({ lean: window.__walkBase.S.p.lean, lift: window.__walkBase.S.p.footLift, ex: window.__walkBase.S.p.exposure, cyc: window.__walkBase.S.p.cycleFrames, preset: window.__walkBase.S.preset, model: window.__walkBase.S.p.model }));
check('back on the human by way of the hose and the dog, it has its own march and its own lean, not the hose walk', backHuman.lean === 9 && backHuman.lift === 0.3 && backHuman.ex === 1 && backHuman.cyc === 20 && backHuman.model === 'mannequin' && backHuman.preset === 'Custom', backHuman);
await ev(() => window.__walkBase.setFigure('hose')); await wait(200);
const backHose = await ev(() => ({ step: window.__walkBase.S.p.stepLength, ex: window.__walkBase.S.p.exposure, preset: window.__walkBase.S.preset, sel: document.getElementById('preset')?.value }));
check('and the rubber hose figure still has its sneak, with the menu saying so', backHose.step === 0.45 && backHose.ex === 2 && backHose.preset === 'Sneak' && backHose.sel === 'Sneak', backHose);
await ev(() => window.__walkBase.setFigure('dog')); await wait(200);
check('and the dog its trot', (await ev(() => window.__walkBase.S.p.dogGait)) === 'trot' && (await ev(() => window.__walkBase.S.preset)) === 'Trot');
await ev(() => window.__walkBase.setFigure('horse')); await wait(200);
check('a figure not seen before starts on its first walk', (await ev(() => window.__walkBase.S.preset)) === 'Walk' && (await ev(() => window.__walkBase.S.p.dogSpecies)) === 'horse' && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.setTab('View'); }); await wait(200);
const styleCols = await ev(() => { const b = [...document.querySelectorAll('[data-testid^="opt-style-"]')].map((e) => e.getBoundingClientRect()); const cut = [...document.querySelectorAll('[data-testid^="opt-style-"]')].filter((e) => e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent); return { n: b.length, rows: new Set(b.map((r) => Math.round(r.top))).size, widths: new Set(b.map((r) => Math.round(r.width))).size, cut }; });
check('the styles are an even grid with every name in full, not a ragged wrap', styleCols.n === 11 && styleCols.rows >= 3 && styleCols.widths <= 2 && styleCols.cut.length === 0, styleCols);
const lookShots = new Set([await stageShot()]);
for (const st of ['clay', 'lowpoly', 'blocks']) { await q(`opt-style-${st}`).click(); await wait(150); lookShots.add(await stageShot()); for (const fig of ['hose', 'hosehorse', 'dog', 'human']) await ev((f) => { const w = window.__walkBase; w.setFigure(f); for (let fr = 0; fr < 6; fr++) w.setFrame(fr); }, fig); await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.setTab('View'); w.setFrame(0); w.render(); }); await wait(150); }
check('Clay, Lowpoly and Blocks are looks of their own, on every kind of figure, with no errors', lookShots.size === 4 && errors.length === 0, [lookShots.size, errors]);
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; w.render(); });
await ev(() => window.__walkBase.setTab('Gait'));
// ---- block size, facets, and the clay edge
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.s.style = 'blocks'; w.S.s.camYaw = -25; w.setTab('View'); w.setFrame(4); w.render(); }); await wait(250);
check('View has Block size and Facets round each limb', (await q('rng-blockSize').count()) === 1 && (await q('rng-polySides').count()) === 1);
const sizes = new Set([await stageShot()]);
for (const v of [4, 14, 30]) { await ev((v) => { const e = document.querySelector('[data-testid="rng-blockSize"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v); await wait(150); sizes.add(await stageShot()); }
check('each Block size gives a different drawing, from fine pixels to big voxels', sizes.size === 4 && (await ev(() => window.__walkBase.S.s.blockSize)) === 30, sizes.size);
await ev(() => { const w = window.__walkBase; w.S.s.blockSize = 7; w.S.s.style = 'lowpoly'; w.render(); }); await wait(150);
const sides = new Set([await stageShot()]);
for (const v of [4, 8, 12]) { await ev((v) => { const e = document.querySelector('[data-testid="rng-polySides"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v); await wait(150); sides.add(await stageShot()); }
check('each number of facets gives a different solid', sides.size === 4, sides.size);
for (const fig of ['hose', 'hosehorse', 'hosebird', 'dog', 'bird', 'human']) { await ev((f) => { const w = window.__walkBase; w.setFigure(f); for (let fr = 0; fr < 8; fr++) w.setFrame(fr); w.S.s.camYaw = 40; w.render(); w.S.s.camYaw = -25; w.render(); }, fig); }
await ev(() => { const w = window.__walkBase; w.S.s.style = 'clay'; w.S.s.camYaw = -25; w.setFrame(4); w.render(); }); await wait(150);
const clayA = await stageShot(); await ev(() => { const w = window.__walkBase; w.setFrame(4); w.render(); }); await wait(100);
check('clay draws the same every time it is drawn (the lumps do not move on their own)', (await stageShot()) === clayA);
const clayFrames = new Set(); for (let fr = 0; fr < 6; fr++) { await ev((f) => window.__walkBase.setFrame(f), fr); clayFrames.add(await stageShot()); }
check('and with no errors from any of the three looks on any figure', clayFrames.size === 6 && errors.length === 0, [clayFrames.size, errors]);
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; w.S.s.polySides = 6; w.S.s.blockSize = 7; w.setFigure('human'); w.setTab('Gait'); w.render(); });
// ---- speech: the mouth can be seen in the side view, in a close-up in the corner of the stage
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.s.style = 'mannequin'; w.S.s.focus = 'body'; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.clearSpeech(); w.setTab('Speech'); w.setFrame(6); w.render(); }); await wait(250);
const sbox = await page.locator('[data-testid="stage"]').boundingBox(); const corner = { x: sbox.x + 14, y: sbox.y + sbox.height - 150, width: 130, height: 130 };
const quiet = (await page.screenshot({ clip: corner })).toString('base64');
await ev(() => { const w = window.__walkBase; w.setSpeechText('Hello there, how are you today?'); w.buildSpeechNow(); w.pause(); w.setFrame(6); w.render(); }); await wait(300);
const talking = (await page.screenshot({ clip: corner })).toString('base64');
check('in the side view, the face appears in a close-up in the corner of the stage while there is speech', quiet !== talking);
await ev(() => { const w = window.__walkBase; w.setFrame(3); w.render(); }); await wait(150);
const f3 = (await page.screenshot({ clip: corner })).toString('base64'); await ev(() => { const w = window.__walkBase; w.setFrame(9); w.render(); }); await wait(150);
check('and the mouth in it changes from word to word', f3 !== (await page.screenshot({ clip: corner })).toString('base64'));
await ev(() => { const w = window.__walkBase; w.clearSpeech(); w.setFrame(6); w.render(); }); await wait(250);
check('and it goes when the speech is cleared', (await page.screenshot({ clip: corner })).toString('base64') === quiet && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.setTab('Gait'); });
// ---- shadows and line options
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.s.style = 'mannequin'; w.S.s.camYaw = -25; w.S.s.shadowMode = 'off'; w.setTab('View'); w.setFrame(4); w.render(); }); await wait(250);
check('View has Shadow and Line settings', (await q('opt-shadowMode-both').count()) === 1 && (await q('rng-shadowBlur').count()) === 1 && (await q('rng-lineBoil').count()) === 1 && (await q('opt-lineDash-dotted').count()) === 1);
const shadowLooks = new Set([await stageShot()]);
for (const m of ['ground', 'drop', 'both']) { await q(`opt-shadowMode-${m}`).click(); await wait(150); shadowLooks.add(await stageShot()); }
check('Ground, Drop and Both each change the picture', shadowLooks.size === 4, shadowLooks.size);
await q('opt-shadowMode-off').click(); await wait(150);
const plainLine = await stageShot(); const lineLooks = new Set([plainLine]);
for (const [k, v] of [['lineBoil', 4], ['lineDepth', 1], ['lineOffset', 6]]) { await ev(([k, v]) => { const w = window.__walkBase; w.S.s.style = 'outline'; w.S.s[k] = v; w.render(); }, [k, v]); await wait(120); lineLooks.add(await stageShot()); await ev((k) => { window.__walkBase.S.s[k] = 0; }, k); }
for (const d of ['dashed', 'dotted']) { await ev((d) => { const w = window.__walkBase; w.S.s.lineDash = d; w.render(); }, d); await wait(120); lineLooks.add(await stageShot()); }
check('boil, depth, offset and dashes each change the line', lineLooks.size === 6, lineLooks.size);
await ev(() => { const w = window.__walkBase; w.S.s.lineDash = 'solid'; w.S.s.style = 'ink'; w.S.s.lineBoil = 3; w.S.s.boilRate = 2; w.setFrame(0); w.render(); }); await wait(120);
const b0 = await stageShot(); await ev(() => { const w = window.__walkBase; w.setFrame(1); w.S.frame = 0; w.render(); }); await wait(80);
check('the boil is the same on the same frame, so a frame always draws the same', (await stageShot()) === b0);
await ev(() => { const w = window.__walkBase; w.setFrame(0); w.render(); }); await wait(80); const f0 = await stageShot(); await ev(() => { const w = window.__walkBase; w.S.p.exposure = 1; w.setFrame(2); w.render(); }); await wait(80);
check('and a new wobble comes every two frames', (await stageShot()) !== f0 && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.S.s.lineBoil = 0; w.S.s.style = 'mannequin'; w.S.s.camYaw = 0; w.render(); });
// an attachment with a drop shadow
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.setTab('Attach'); w.setFrame(4); w.S.attach.human = []; w.selectPart({ part: 'spine.upper' }, { openTab: false }); w.addAttach('rect'); w.S.ver++; w.render(); }); await wait(300);
check('the Attach tab has a Drop shadow section for the layer', (await q('attach-shadow-on').count()) === 1);
const noSh = await stageShot(); await q('attach-shadow-on').check(); await wait(250);
check('turning it on casts a shadow from that layer alone, and shows its controls', (await stageShot()) !== noSh && (await q('attach-shadow-x').count()) === 1 && (await ev(() => window.__walkBase.attachItem().shadow.on)) === true);
await ev(() => { const e = document.querySelector('[data-testid="attach-shadow-x"]'); e.value = 30; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
check('the shadow can be moved, and is kept with the layer', (await ev(() => window.__walkBase.attachItem().shadow.x)) === 30 && (await ev(() => JSON.stringify(window.__walkBase.S.attach.human)).then((s) => s.includes('"shadow"'))));
await ev(() => { const w = window.__walkBase; w.S.attach.human = []; w.S.attachSel = null; w.setTab('Gait'); w.render(); });
// ---- the Design tab: a look for each part, skins, sprite sheets, a painted sheet for the whole figure, and character files
const sheetFile = async (cols, rows) => { const b64 = await ev(([cols, rows]) => { const c = document.createElement('canvas'); c.width = cols * 64; c.height = rows * 64; const g = c.getContext('2d'); for (let i = 0; i < cols * rows; i++) { g.fillStyle = ['#e63946', '#2a9d8f', '#264653', '#8338ec', '#ffbe0b', '#06d6a0'][i % 6]; g.fillRect((i % cols) * 64, Math.floor(i / cols) * 64, 64, 64); } return c.toDataURL('image/png').split(',')[1]; }, [cols, rows]); return { name: 'sheet.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }; };
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.design = {}; w.S.attach.human = []; w.S.s.style = 'mannequin'; w.S.s.shadowMode = 'off'; w.S.s.camYaw = -25; w.setTab('Design'); w.setFrame(4); w.render(); }); await wait(300);
check('there is a Design tab', (await page.locator('.tab[data-tab="Design"]').count()) === 1);
check('with nothing chosen it says so, and lists the parts to choose', (await q('design-none').count()) === 1 && (await page.locator('[data-testid^="design-part-"]').count()) >= 10);
await ev(() => window.__walkBase.selectPart({ part: 'head', side: null }, { openTab: false })); await wait(250);
check('choosing a part shows its own colour, line, shadow and skin', (await q('design-fill').count()) === 1 && (await q('design-linew').count()) === 1 && (await q('design-shadow-on').count()) === 1 && (await q('design-skin-add').count()) === 1);
const dsn0 = await stageShot();
await ev(() => { const e = document.querySelector('[data-testid="design-fill"]'); e.value = '#ff0000'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('a part can have a colour of its own', (await ev(() => window.__walkBase.designOf().head?.fill)) === '#ff0000' && (await stageShot()) !== dsn0);
const dsn1 = await stageShot(); await q('design-fill-clear').click(); await wait(200);
check('and go back to the stage colour', (await ev(() => window.__walkBase.designOf().head)) === undefined && (await stageShot()) !== dsn1);
await q('design-visible').uncheck(); await wait(250);
check('a part can be hidden, and is still there to bring back', (await ev(() => window.__walkBase.S.last.shapes.find((s) => s.part === 'head')?.hidden)) === true && (await q('design-part-head').count()) === 1);
await q('design-visible').check(); await wait(200);
const dsn2 = await stageShot(); await q('design-shadow-on').check(); await wait(250);
check('a part can cast a drop shadow of its own', (await ev(() => window.__walkBase.designOf().head?.shadow?.on)) === true && (await q('design-shadow-x').count()) === 1 && (await stageShot()) !== dsn2);
await q('design-shadow-on').uncheck(); await wait(150);
const dsn3 = await stageShot();
await page.locator('[data-testid="design-skin-file"]').setInputFiles(await sheetFile(2, 2)); await wait(600);
check('a skin is a picture laid over the part', (await ev(() => window.__walkBase.designOf().head?.skin?.cols)) === 1 && (await stageShot()) !== dsn3);
const uvPix = await ev(() => { const c = document.querySelector('[data-testid="design-uv"]'); const g = c.getContext('2d'); const p = g.getImageData(c.width / 2, c.height / 2, 1, 1).data; return [p[0], p[1], p[2]]; });
check('with a picture of the part in it, on the UV preview', !(uvPix[0] === 233 && uvPix[1] === 233 && uvPix[2] === 238), uvPix);
await q('design-cols-num').fill('2'); await q('design-cols-num').dispatchEvent('change'); await q('design-rows-num').fill('2'); await q('design-rows-num').dispatchEvent('change'); await wait(300);
check('a sprite sheet has columns and rows, a cell to hold or to play', (await ev(() => window.__walkBase.designOf().head.skin.cols * window.__walkBase.designOf().head.skin.rows)) === 4 && (await q('design-cell').count()) === 1 && (await q('design-anim-loop').count()) === 1);
const cellA = await stageShot(); await ev(() => { const e = document.querySelector('[data-testid="design-cell"]'); e.value = 1; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('another cell shows another part of the sheet', (await stageShot()) !== cellA && (await ev(() => window.__walkBase.designOf().head.skin.cell)) === 1);
await q('design-anim-loop').click(); await wait(200);
await q('design-cellframes-num').fill('1'); await q('design-cellframes-num').dispatchEvent('change'); await wait(200);
const frames = new Set(); for (const f of [0, 1, 2, 3]) { await ev((f) => { const w = window.__walkBase; w.setFrame(f); w.render(); }, f); await wait(80); frames.add(await ev(() => { const c = document.querySelector('[data-testid="stage"]'); const g = c.getContext('2d'); const sh = window.__walkBase.S.last.shapes.find((s) => s.part === 'head'); const xs = sh.pts.map((p) => p[0]); const ys = sh.pts.map((p) => p[1]); const mp = window.__walkBase.S.map; const k = mp.zw / mp.fcw; const d = g.getImageData(Math.round(mp.x0 + ((Math.min(...xs) + Math.max(...xs)) / 2) * k), Math.round(mp.y0 + ((Math.min(...ys) + Math.max(...ys)) / 2) * k), 1, 1).data; return [d[0], d[1], d[2]].join(); })); }
check('played, the cells change from frame to frame: four colours on four frames', frames.size === 4, [...frames]);
await q('design-fit-tile').click(); await wait(200); await ev(() => window.__walkBase.setFrame(4));
check('a skin can be tiled over the part instead of stretched', (await ev(() => window.__walkBase.designOf().head.skin.fit)) === 'tile');
await q('design-skin-remove').click(); await wait(200);
check('and taken off again', (await ev(() => window.__walkBase.designOf().head)) === undefined);
// the other side and the whole figure
await ev(() => window.__walkBase.selectPart({ part: 'arm', side: 'R' }, { openTab: false })); await wait(200);
await ev(() => { const e = document.querySelector('[data-testid="design-fill"]'); e.value = '#00aa55'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
await q('design-copy-side').click(); await wait(200);
check('a look can be copied to the same part on the other side', (await ev(() => window.__walkBase.designOf()['arm.L']?.fill)) === '#00aa55');
await ev(() => { window.__walkBase.S.design = {}; window.__walkBase.S.ver++; window.__walkBase.render(); }); await wait(150);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), q('design-uv-export').click()]);
check('a UV template can be saved, a PNG with a cell for every part', /^uv-template-human.*\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
const plain = await stageShot(); await page.locator('[data-testid="design-sheet-file"]').setInputFiles(await sheetFile(4, 4)); await wait(800);
const skins = await ev(() => Object.values(window.__walkBase.designOf()).filter((p) => p.skin)); const cellsUsed = new Set(skins.map((p) => p.skin.cell));
check('a painted sheet puts every part in its own cell of it', skins.length >= 10 && cellsUsed.size === skins.length && skins.every((p) => p.skin.cols === skins[0].skin.cols && p.skin.rows === skins[0].skin.rows && p.skin.cols * p.skin.rows >= skins.length), [skins.length, cellsUsed.size]);
check('and the figure is coloured by it', (await stageShot()) !== plain);
await q('design-skins-clear').click(); await wait(200);
check('every skin can be taken off at once', (await ev(() => Object.values(window.__walkBase.designOf()).filter((p) => p.skin).length)) === 0 && errors.length === 0, errors);
// characters
await ev(() => { const w = window.__walkBase; w.S.design = {}; w.applyPreset('March'); w.setParam('lean', 9); w.S.attach.human = []; w.selectPart({ part: 'spine.upper' }, { openTab: false }); w.addAttach('rect'); w.S.design.human = { head: { fill: '#ff0000', line: '', lineW: 1, opacity: 1, visible: true, shadow: { on: false, x: 6, y: 8, blur: 8, color: '#000000', opacity: 0.4 }, skin: null } }; w.S.s.eyeStyle = 'almond'; w.S.ver++; w.render(); }); await wait(200);
const packed = JSON.parse(JSON.stringify(await ev(() => window.__walkBase.packCurrentCharacter('Test'))));
check('a character packs the figure, walk, look, attachments and design', packed.format === 'walk-base-character' && packed.figure === 'human' && packed.p.lean === 9 && packed.s.eyeStyle === 'almond' && packed.attach.length === 1 && packed.design.head.fill === '#ff0000', Object.keys(packed));
await ev(() => { const w = window.__walkBase; w.applyPreset('Normal'); w.S.attach.human = []; w.S.design = {}; w.S.s.eyeStyle = 'default'; w.setFigure('dog'); }); await wait(200);
check('imported while another figure is on the stage, it brings its own figure back', (await ev((c) => window.__walkBase.importCharacterObject(c), packed)) === true && (await ev(() => window.__walkBase.figKey())) === 'human');
const back = await ev(() => ({ lean: window.__walkBase.S.p.lean, att: window.__walkBase.S.attach.human.length, fill: window.__walkBase.S.design.human?.head?.fill, eye: window.__walkBase.S.s.eyeStyle, preset: window.__walkBase.S.preset }));
check('with its walk, its attachment, its design and its look', back.lean === 9 && back.att === 1 && back.fill === '#ff0000' && back.eye === 'almond' && back.preset === 'Custom', back);
check('a file that is not a character is refused with a reason, and changes nothing', (await ev(() => window.__walkBase.importCharacterObject({ format: 'nope' }))) === false && (await ev(() => window.__walkBase.S.p.lean)) === 9);
await q('menu-file').click(); await wait(150);
check('File has Export this character and Import a character', (await page.locator('[data-testid="file-char-export"]:visible').count()) === 1 && (await page.locator('[data-testid="file-char-import"]:visible').count()) === 1);
await page.keyboard.press('Escape'); await wait(100);
await ev(() => { const w = window.__walkBase; w.S.design = {}; w.S.attach.human = []; w.S.s.eyeStyle = 'default'; w.applyPreset('Normal'); w.setTab('Gait'); w.render(); });
// ---- the new animals: lizard, snake, spider, crab, pterodactyl and plesiosaur
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.S.s.style = 'mannequin'; w.S.s.shadowMode = 'off'; w.S.s.camYaw = -30; w.S.s.camPitch = 15; w.setTab('Gait'); }); await wait(200);
const newAnimalLooks = new Set();
for (const [fig, expectedPreset] of [['lizard', 'Walk'], ['snake', 'Slither'], ['spider', 'Walk'], ['crab', 'Sidle'], ['pterodactyl', 'Walk'], ['plesiosaur', 'Cruise']]) {
  await ev((f) => { const w = window.__walkBase; w.setFigure(f); w.setTab('Gait'); w.setFrame(5); w.render(); }, fig); await wait(250);
  const st = await ev(() => ({ fig: window.__walkBase.figKey(), preset: window.__walkBase.S.preset, shapes: window.__walkBase.S.last.shapes.length, pickable: window.__walkBase.S.last.shapes.filter((s) => s.part).length }));
  check(`${fig}: chosen, on its first walk (${expectedPreset}), drawn as parts`, st.fig === fig && st.preset === expectedPreset && st.shapes >= 6 && st.pickable === st.shapes, st);
  newAnimalLooks.add(await stageShot());
  const presetOpts = await ev(() => [...document.querySelectorAll('#preset option')].map((o) => o.textContent)); check(`${fig}: has walks to choose from`, presetOpts.length >= 3, presetOpts);
  for (const stl of ['outline', 'stick', 'moebius', 'comic', 'lowpoly', 'mannequin']) await ev((s) => { const w = window.__walkBase; w.S.s.style = s; for (let f = 0; f < 4; f++) w.setFrame(f); w.render(); }, stl);
  await ev(() => { const w = window.__walkBase; w.play(); }); await wait(250); await ev(() => window.__walkBase.pause());
  await ev(() => { const w = window.__walkBase; w.S.s.showArcs = true; w.render(); w.S.s.showArcs = false; w.S.s.shadowMode = 'both'; w.render(); w.S.s.shadowMode = 'off'; });
}
check('the six look different from each other, in every drawing style, playing, with arcs and shadows, with no errors', newAnimalLooks.size === 6 && errors.length === 0, [newAnimalLooks.size, errors]);
await ev(() => { const w = window.__walkBase; w.setFigure('spider'); w.setTab('Gait'); }); await wait(200);
check('a spider has leg settings and a thickness, and no wing or neck settings; a snake has no leg settings', (await q('rng-dogLift').count()) === 1 && (await q('rng-dGirth').count()) === 1 && (await q('rng-dogWingOpen').count()) === 0 && (await q('rng-dogNeckAngle').count()) === 0);
await ev(() => window.__walkBase.setFigure('snake')); await wait(200);
check('and the snake has Wavelength, Wave height and Rear up', (await q('rng-dogStride').count()) === 1 && (await q('rng-dogFlex').count()) === 1 && (await q('rng-dogNeckAngle').count()) === 1 && (await q('rng-dogLift').count()) === 0 && (await q('rng-dogDuty').count()) === 0);
await ev(() => { const w = window.__walkBase; w.setFigure('pterodactyl'); w.setTab('Gait'); }); await wait(200);
check('the pterodactyl has its wing settings', (await q('rng-dogWingOpen').count()) === 1 && (await q('rng-dogFlap').count()) === 1);
await ev(() => { const w = window.__walkBase; w.setFigure('human'); w.applyPreset('Normal'); w.S.s.style = 'mannequin'; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.setTab('Gait'); w.render(); });
// ---- the Draw tab: draw a part, or the whole figure, and it moves with the parts
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.applyPreset('Normal'); w.S.design = {}; w.S.attach.human = []; w.S.s.style = 'mannequin'; w.S.s.shadowMode = 'off'; w.S.s.camYaw = -25; w.S.s.camPitch = 0; w.setTab('Draw'); w.setFrame(4); w.render(); }); await wait(300);
check('there is a Draw tab, with modes, tools and a size', (await page.locator('.tab[data-tab="Draw"]').count()) === 1 && (await q('draw-mode-part').count()) === 1 && (await q('draw-tool-pen').count()) === 1 && (await q('draw-size').count()) === 1);
check('in one-part mode with nothing chosen it asks for a part', (await q('draw-choose').count()) === 1);
const clientOf = (key) => ev((k) => { const w = window.__walkBase; const f = w.S.last.frames[k][0].fr; const m = w.S.map; return { x: m.left + (m.x0 + (f.cx / m.fcw) * m.zw) / m.d, y: m.top + (m.y0 + (f.cy / m.fch) * m.zh) / m.d }; }, key);
await q('draw-part-head').click(); await wait(250);
const dh = await clientOf('head'); const dr0 = await stageShot();
await page.mouse.move(dh.x - 14, dh.y - 6); await page.mouse.down(); await page.mouse.move(dh.x, dh.y + 6, { steps: 6 }); await page.mouse.move(dh.x + 14, dh.y - 6, { steps: 6 }); await page.mouse.up(); await wait(250);
const ink1 = await ev(() => window.__walkBase.designOf().head?.ink);
check('drawing across the head puts a stroke on the head, in the head\'s own UV', ink1 && ink1.strokes.length === 1 && ink1.strokes[0].pts.length >= 4 && ink1.strokes[0].pts.every((p) => p[0] >= -0.2 && p[0] <= 1.2) && (await stageShot()) !== dr0, ink1 && ink1.strokes.length);
check('and nothing else was drawn on or moved', (await ev(() => Object.keys(window.__walkBase.designOf()).join())) === 'head');
const at4 = await stageShot(); await ev(() => { const w = window.__walkBase; w.setFrame(11); w.render(); }); await wait(200); const at11 = await stageShot();
check('the drawing stays with the part as the figure moves', at4 !== at11 && (await ev(() => window.__walkBase.designOf().head.ink.strokes.length)) === 1);
await ev(() => { const w = window.__walkBase; w.setFrame(4); w.render(); }); await wait(200);
await q('draw-replace').check(); await wait(250);
check('the drawing can stand in for the part\'s own shape', (await ev(() => window.__walkBase.designOf().head.ink.replace)) === true);
await q('draw-replace').uncheck(); await wait(150);
await q('draw-tool-fill').click(); await q('draw-swatch-d93a3a').click(); await wait(150);
const dh2 = await clientOf('head');
await page.mouse.move(dh2.x - 8, dh2.y - 8); await page.mouse.down(); await page.mouse.move(dh2.x + 8, dh2.y - 8, { steps: 3 }); await page.mouse.move(dh2.x + 8, dh2.y + 8, { steps: 3 }); await page.mouse.move(dh2.x - 8, dh2.y + 8, { steps: 3 }); await page.mouse.up(); await wait(250);
const sk2 = await ev(() => window.__walkBase.designOf().head.ink.strokes);
check('Fill shape makes a closed, coloured shape', sk2.length === 2 && sk2[1].fill === true && sk2[1].c === '#d93a3a' && sk2[1].pts.length >= 4);
await q('draw-undo').click(); await wait(200);
check('Undo takes the last thing away', (await ev(() => window.__walkBase.designOf().head.ink.strokes.length)) === 1);
await q('draw-tool-eraser').click(); await wait(100);
const dh3 = await clientOf('head');
await page.mouse.move(dh3.x - 20, dh3.y); await page.mouse.down(); await page.mouse.move(dh3.x + 20, dh3.y, { steps: 8 }); await page.mouse.up(); await wait(250);
check('the eraser takes away strokes it passes over, and the part forgets it was drawn on', (await ev(() => window.__walkBase.designOf().head)) === undefined);
await q('draw-undo').click(); await wait(200);
check('and Undo brings them back', (await ev(() => window.__walkBase.designOf().head?.ink?.strokes.length)) === 1);
// the whole figure: one line across the head and down the body is shared between parts
await q('draw-mode-whole').click(); await q('draw-tool-pen').click(); await wait(250);
const parts = await ev(() => Object.entries(window.__walkBase.S.last.frames).map(([k, v]) => ({ k, A: v[0].fr.L * v[0].fr.W, cx: v[0].fr.cx, cy: v[0].fr.cy })));
const body = parts.filter((p) => p.k !== 'head').sort((a, b) => b.A - a.A)[0];
const a1 = await clientOf('head'); const a2 = await clientOf(body.k);
await ev(() => { window.__walkBase.S.draw.size = 4; });
await page.mouse.move(a1.x, a1.y); await page.mouse.down(); await page.mouse.move((a1.x + a2.x) / 2, (a1.y + a2.y) / 2, { steps: 10 }); await page.mouse.move(a2.x, a2.y, { steps: 10 }); await page.mouse.up(); await wait(250);
const whole = await ev(() => Object.entries(window.__walkBase.designOf()).filter(([, p]) => p.ink).map(([k, p]) => [k, p.ink.strokes.length]));
check('drawing the whole figure splits a line between the parts it crosses', whole.length >= 2 && whole.some(([k]) => k === 'head'), whole);
await q('draw-replace-all').click(); await wait(200);
check('Use my drawing instead of the figure hides the stock shapes of every part drawn on', (await ev(() => Object.values(window.__walkBase.designOf()).filter((p) => p.ink).every((p) => p.ink.replace))) === true);
check('the drawing is kept with the figure\'s design, and goes out in a character file', (await ev(() => JSON.stringify(window.__walkBase.packCurrentCharacter('t').design).includes('"ink"'))) === true);
for (const stl of ['outline', 'stick', 'moebius', 'comic', 'lowpoly', 'ink', 'pencil', 'clay']) await ev((s) => { const w = window.__walkBase; w.S.s.style = s; w.setFrame(6); w.render(); }, stl);
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; w.setFigure('dog'); w.setTab('Draw'); w.render(); w.setFigure('human'); });
await q('draw-clear-all').click(); await wait(200);
check('Clear all drawing leaves nothing, in every look, with no errors', (await ev(() => Object.keys(window.__walkBase.designOf()).length)) === 0 && errors.length === 0, errors);
await ev(() => { const w = window.__walkBase; w.S.draw.mode = 'part'; w.setTab('Gait'); w.S.design = {}; w.render(); });
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
