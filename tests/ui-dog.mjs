// The dog in the browser: switching figures, the same customisation, picking parts, movements, automation, export, saving.
// Usage: node walkbase/tests/ui-dog.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `wb-dog-${name}-${n}.png`) }); };
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
await ev(() => { try { localStorage.clear(); } catch { /* none */ } });
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);

// ---- switching figure ----
await page.locator('[data-testid="rig"]').selectOption('dog');
check('the figure becomes a dog', await ev(() => window.__walkBase.S.p.rig === 'dog' && window.__walkBase.P().rig === 'dog'));
const presets = await page.locator('[data-testid="preset"] option').allTextContents();
check('the preset list is the dog\'s', presets.includes('Trot') && presets.includes('Sniffing') && !presets.includes('Brisk'), presets);
await q('tab-Gait').click();
check('the Gait tab shows the dog\'s controls and not the human\'s', await page.locator('[data-testid="rng-dogStride"]').count() === 1 && await page.locator('[data-testid="rng-stepLength"]').count() === 0);
await q('tab-Gait').click();
check('the Body tab shows dog body and proportions', await page.locator('[data-testid="rng-dogFlex"]').count() === 1 && await page.locator('[data-testid="rng-dLeg"]').count() === 1 && await page.locator('[data-testid="rng-armSwing"]').count() === 0);
await q('tab-Parts').click();
check('the Parts tab lists dog parts', await page.locator('[data-testid="part-dog.neck"]').count() === 1 && await page.locator('[data-testid="part-dog.fpaw-R"]').count() === 1 && await page.locator('[data-testid="part-spine.lower"]').count() === 0);
await shot('dog');

// ---- presets and gait ----
await page.locator('[data-testid="preset"]').selectOption('Trot');
check('Trot sets the gait and timing', await ev(() => window.__walkBase.S.p.dogGait === 'trot' && window.__walkBase.S.p.cycleFrames === 16));
await page.locator('[data-testid="preset"]').selectOption('Walk');
check('Walk puts it back', await ev(() => window.__walkBase.S.p.dogGait === 'walk' && window.__walkBase.S.p.cycleFrames === 24));

// ---- picking a part by tapping the dog ----
const where = await ev(() => {
  const w = window.__walkBase; w.setFrame(0); w.render();
  const info = w.S.last; const m = w.S.map;
  const out = {};
  for (const part of ['dog.head', 'dog.tail1', 'dog.hleg']) {
    const sh = info.shapes.filter((s) => s.part === part && (s.role !== 'far'));
    if (!sh.length) continue;
    const pts = sh[0].pts; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length; const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect();
    out[part] = { x: r.left + (m.x0 + (cx / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (cy / m.fch) * m.zh) / m.d };
  }
  return out;
});
await page.touchscreen.tap(where['dog.head'].x, where['dog.head'].y);
check('tapping the head selects the dog head', await ev(() => window.__walkBase.S.sel?.part === 'dog.head'), await ev(() => window.__walkBase.S.sel));
check('and its channels appear', await page.locator('[data-testid="chan-dog.head.pitch"]').count() === 1);

// ---- the same customisation ----
await ev(() => window.__walkBase.selectPart({ part: 'dog.tail3', side: null }, { openTab: true }));
await page.locator('[data-testid="ch-dog.tail3.yaw-amount-num"]').fill('2');
await page.locator('[data-testid="ch-dog.tail3.yaw-amount-num"]').dispatchEvent('change');
check('amount changes the wag', await ev(() => window.__walkBase.S.motion['dog.tail3.yaw']?.amount === 2));
await page.locator('[data-testid="more-ch-dog.tail3.yaw"]').click();
await page.locator('[data-testid="ch-dog.tail3.yaw-freq-2"]').click();
check('repeats doubles the wag rate', await ev(() => window.__walkBase.S.motion['dog.tail3.yaw']?.freq === 2));
await page.locator('[data-testid="draw-dog.tail3.yaw"]').click();
check('the curve pop-out opens for a dog channel', await q('curve-host').isVisible());
await q('edit-close').click();
await ev(() => window.__walkBase.selectPart({ part: 'dog.jaw', side: null }, { openTab: true }));
await page.locator('[data-testid="more-ch-dog.jaw.open"]').click();
await page.locator('[data-testid="ch-dog.jaw.open-offset-num"]').fill('30');
await page.locator('[data-testid="ch-dog.jaw.open-offset-num"]').dispatchEvent('change');
check('the jaw opens when you offset it', await ev(() => { const w = window.__walkBase; return w.S.motion['dog.jaw.open']?.offset > 0.4; }));
check('the sides link on ears', await ev(() => { const w = window.__walkBase; w.patchMotion('dog.ear.flop.R', { amount: 2 }); return w.S.motion['dog.ear.flop.L']?.amount === 2; }));

// ---- orbit around the dog ----
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = -90; w.render(); });
check('the dog draws from the front without errors', errors.length === 0, errors.slice(0, 2));
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.S.s.camPitch = 80; w.render(); });
await shot('top');
await ev(() => { const w = window.__walkBase; w.S.s.camYaw = 0; w.S.s.camPitch = 0; w.S.s.style = 'stick'; w.render(); });
await shot('stick');
await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; w.render(); });

// ---- movements on the dog ----
await q('tab-Auto').click();
check('the dog has its own four movements', await page.locator('[data-testid^="clip-"]').evaluateAll((els) => els.map((e) => e.dataset.testid).filter((t) => /^clip-(stop|reach|pickup|trip)$/.test(t)).length) === 4);
await q('clip-pickup').click();
await q('clip-add').click();
const pick = await ev(() => { const w = window.__walkBase; return { lanes: Object.keys(w.S.lanes), T: w.P().perf?.T }; });
check('pick up writes dog lanes and extends the performance', pick.lanes.includes('c:dog.jaw.open:offset') && pick.T >= 72, pick);
await ev(() => window.__walkBase.setFrame(26));
await page.waitForTimeout(150);
const nose = await ev(() => { const z = window.__walkBase.S.last.pz; return z.noseTip[1]; });
check('at the pick-up frame the nose is low, and not under the ground', nose < 0.4 && nose > -0.1, nose);
await shot('pickup');
await q('lane-edit-c:dog.jaw.open:offset').click();
check('a dog lane opens in the lane editor', await q('lane-host').isVisible());
await q('lane-close').click();

// ---- each figure keeps its own work ----
await page.locator('[data-testid="rig"]').selectOption('human');
check('switching back gives the human and no dog lanes', await ev(() => { const w = window.__walkBase; return w.S.p.rig === 'human' && Object.keys(w.S.lanes).length === 0; }));
await q('tab-Gait').click();
check('the human Gait tab is back', await page.locator('[data-testid="rng-stepLength"]').count() === 1);
await page.locator('[data-testid="rig"]').selectOption('dog');
check('and the dog still has its lanes and edits', await ev(() => { const w = window.__walkBase; return Object.keys(w.S.lanes).length > 4 && w.S.motion['dog.tail3.yaw']?.amount === 2; }));

// ---- export and save ----
const man = await ev(() => window.__walkBase.manifest());
check('the manifest says it is a dog and carries the automation', man.gait.rig === 'dog' && man.automation?.frames >= 72 && Object.keys(man.automation.lanes).length > 4, { rig: man.gait.rig, a: man.automation?.frames });
const zipOk = await ev(async () => { const r = await window.__walkBase.exportZip({ cycles: 1, format: 'png-zip' }); return r.blob.size > 5000; });
check('a PNG export of the dog is produced', zipOk);
await page.waitForTimeout(500);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(200);
check('the dog and its automation survive a reload', await ev(() => { const w = window.__walkBase; return w.S.p.rig === 'dog' && Object.keys(w.S.lanes).length > 4; }));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
