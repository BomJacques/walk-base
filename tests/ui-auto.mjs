// Automation in the browser: movements, recording by hand (touch and latch), the lane editor, saved settings.
// Usage: node walkbase/tests/ui-auto.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { press } from './helpers.mjs';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `wb-auto-${name}-${n}.png`) }); };
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
await page.waitForTimeout(300);
await ev(() => { try { localStorage.clear(); } catch { /* none */ } });

// ---- the Auto tab and a movement ----
await q('tab-Auto').click();
check('Auto tab opens', await q('clip-stop').isVisible());
check('four movements to choose from', (await page.locator('[data-testid^="clip-"][data-testid$="stop"], [data-testid="clip-reach"], [data-testid="clip-pickup"], [data-testid="clip-trip"]').count()) === 4);
await press(page, 'perf-x6');
check('the performance is six cycles', await ev(() => window.__walkBase.P().perf?.T === 144), await ev(() => window.__walkBase.P().perf?.T));
check('the timeline strip has one cell per frame', (await page.locator('#strip .cell').count()) === 144);
await page.waitForTimeout(150);
check('cycle starts are labelled', (await page.locator('#strip .cell .k', { hasText: 'c3' }).count()) === 1);
await q('clip-stop').click();
await page.locator('[data-testid="clip-start"]').fill('49');
await page.locator('[data-testid="clip-start"]').dispatchEvent('change');
await q('clip-add').click();
const afterStop = await ev(() => { const w = window.__walkBase; const pf = w.P().perf; return { lanes: Object.keys(w.S.lanes).length, hasCadence: 'cadence' in w.S.lanes, end: pf.x[pf.T] - pf.x[pf.T - 12], mid: pf.x[48] - pf.x[36], T: pf.T }; });
check('walk to stop wrote lanes', afterStop.lanes >= 10 && afterStop.hasCadence, afterStop);
check('it keeps travelling before the stop and is still at the end', afterStop.mid > 0.2 && Math.abs(afterStop.end) < 1e-6, afterStop);
await ev(() => window.__walkBase.setFrame(110));
check('the figure draws at a late frame without errors', errors.length === 0, errors.slice(0, 2));
await shot('stopped');

// ---- the lane editor ----
await q('lane-edit-cadence').click();
check('the lane pop-out opens', await q('lane-host').isVisible());
const box = await q('lane-host').boundingBox();
const before = await ev(() => window.__walkBase.S.lanes.cadence.pts.length);
await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height * 0.4);
const afterTap = await ev(() => window.__walkBase.S.lanes.cadence.pts.length);
check('tapping the lane adds a point', afterTap === before + 1, `${before} to ${afterTap}`);
await shot('lane');
await q('lane-close').click();
await q('lanes-clear-all').click();
check('clear all removes the automation', await ev(() => Object.keys(window.__walkBase.S.lanes).length === 0));

// ---- recording by hand ----
const record = async (mode) => {
  await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.ver++; w.setTab('Gait'); w.setFrame(0); });
  await q('tab-Gait').click();
  if (mode === 'latch') { await q('tab-Auto').click(); await q('rec-mode-latch').click(); await q('tab-Gait').click(); }
  else { await q('tab-Auto').click(); await q('rec-mode-touch').click(); await q('tab-Gait').click(); }
  if (!(await ev(() => window.__walkBase.S.armed))) await q('rec').click();
  check(`${mode}: Rec is armed`, await ev(() => window.__walkBase.S.armed));
  await q('play').click();
  check(`${mode}: recording starts with room to record`, await ev(() => window.__walkBase.S.recording && window.__walkBase.P().perf?.T === 144));
  await page.waitForTimeout(700);
  const sel = '[data-testid="rng-stepLength"]';
  await ev((s) => { const el = document.querySelector(s); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.value = '0.3'; el.dispatchEvent(new Event('input', { bubbles: true })); }, sel);
  await page.waitForTimeout(600);
  await ev((s) => { const el = document.querySelector(s); el.value = '0.45'; el.dispatchEvent(new Event('input', { bubbles: true })); }, sel);
  await page.waitForTimeout(500);
  await ev((s) => document.querySelector(s).dispatchEvent(new PointerEvent('pointerup', { bubbles: true })), sel);
  await page.waitForTimeout(500);
  await q('play').click();
  return ev(() => { const w = window.__walkBase; return { lane: w.S.lanes['p:stepLength']?.pts ?? null, base: w.S.p.stepLength, rec: w.S.recording }; });
};
const t = await record('touch');
check('touch: the move became a lane', t.lane && t.lane.length >= 3, t);
check('touch: the base value was not changed by the take', Math.abs(t.base - 0.78) < 1e-9, t.base);
const vals = (t.lane ?? []).map((p) => p.v);
check('touch: it recorded both values you set', vals.some((v) => Math.abs(v - 0.3) < 0.02) && vals.some((v) => Math.abs(v - 0.45) < 0.02), vals);
check('touch: it glides back to the old value after you let go', Math.abs((t.lane ?? []).at(-1)?.v - 0.78) < 1e-6, t.lane?.at(-1));
check('the take stopped when playback stopped', t.rec === false);
await shot('recorded');

const l = await record('latch');
const lv = (l.lane ?? []).map((p) => p.v);
check('latch: it recorded', l.lane && l.lane.length >= 3, l);
const lastTwo = l.lane?.slice(-2);
check('latch: holds your last value until the take stops, then lets go', lastTwo && Math.abs(lastTwo[0].v - 0.45) < 0.02 && Math.abs(lastTwo[1].v - 0.78) < 1e-6, lastTwo);

// ---- slider follows the lane, and a saved copy keeps it ----
await ev(() => { const w = window.__walkBase; w.setTab('Gait'); w.setFrame(20); });
await page.waitForTimeout(200);
const sliderAt5 = await ev(() => Number(document.querySelector('[data-testid="rng-stepLength"]').value));
await ev(() => window.__walkBase.setFrame(40));
await page.waitForTimeout(200);
const sliderAt60 = await ev(() => Number(document.querySelector('[data-testid="rng-stepLength"]').value));
check('the slider follows the automation as the playhead moves', Math.abs(sliderAt5 - sliderAt60) > 0.05, { sliderAt5, sliderAt60 });
check('the row is marked as automated', await page.locator('.row.auto').count() >= 1);
await page.waitForTimeout(500);
await page.reload();
await page.waitForFunction(() => window.__walkBase);
check('automation survives a reload', await ev(() => Object.keys(window.__walkBase.S.lanes).length >= 1 && window.__walkBase.S.perfLen === 144));

// ---- the other movements ----
for (const id of ['reach', 'pickup', 'trip']) {
  await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.ver++; });
  await q('tab-Auto').click();
  await q(`clip-${id}`).click();
  await q('clip-add').click();
  const ok = await ev(() => { const w = window.__walkBase; const pf = w.P().perf; w.setFrame(Math.min(20, pf.T - 1)); return Object.keys(w.S.lanes).length >= 4 && pf.T >= 72; });
  check(`${id} adds lanes and extends the performance`, ok);
}
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
