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
// ---- several takes over lanes that already exist, a slider that is held, punching in and out, and muting a lane
{
  await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.punch = null; w.S.ver++; w.setTab('Gait'); w.setFrame(0); w.render(); });
  await q('tab-Auto').click(); await q('rec-mode-touch').click(); await q('tab-Gait').click();
  if (!(await ev(() => window.__walkBase.S.armed))) await q('rec').click();
  const takeOn = async (sel, vals) => {
    await ev(() => window.__walkBase.setFrame(0)); await q('play').click(); await page.waitForTimeout(250);
    await ev(async ({ sel, vals }) => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); for (const v of vals) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 300)); } el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); await new Promise((r) => setTimeout(r, 250)); }, { sel, vals });
    await q('play').click(); await page.waitForTimeout(150);
  };
  const laneVals = (id) => ev((id) => (window.__walkBase.S.lanes['p:' + id]?.pts || []).map((p) => +p.v.toFixed(2)), id);
  await takeOn('[data-testid="rng-stepLength"]', [0.3, 0.5]);
  await takeOn('[data-testid="rng-stepLength"]', [0.9, 0.4]);
  const second = await laneVals('stepLength'); check('a second take over the same slider replaces the first', second.includes(0.9) && second.includes(0.4) && second.filter((v) => v === 0.3).length <= 1, second); // at most the one point from before this take began
  await takeOn('[data-testid="rng-armSwing"]', [10, 40]);
  await takeOn('[data-testid="rng-stepLength"]', [0.35, 0.7]);
  const lanes4 = await ev(() => Object.keys(window.__walkBase.S.lanes).sort());
  const third = await laneVals('stepLength');
  check('after four takes on two sliders both are automated', lanes4.includes('p:stepLength') && lanes4.includes('p:armSwing'), lanes4);
  check('and the newest take is the one that is kept', third.includes(0.7) && third.includes(0.35) && Math.abs(third.at(-1) - 0.78) < 1e-9, third); // the lane held its old value until this take began, then followed it
  check('the base values were never changed by any take', await ev(() => Math.abs(window.__walkBase.S.p.stepLength - 0.78) < 1e-9));
  // a slider that is held is not reset by the lane that drives it (an iPad does not focus a slider it is touching)
  await ev(() => { const w = window.__walkBase; w.setFrame(20); });
  const kept = await ev(async () => { const el = document.querySelector('[data-testid="rng-stepLength"]'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.value = '1.2'; await new Promise((r) => setTimeout(r, 60)); window.__walkBase.setFrame(30); window.__walkBase.setFrame(31); const v = Number(el.value); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return v; });
  check('a slider you are holding is left where your finger put it', Math.abs(kept - 1.2) < 1e-6, kept);
  // punch in and out
  await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.punch = null; w.S.ver++; w.setFrame(0); }); await q('tab-Auto').click();
  await q('punch-on').check(); await page.locator('[data-testid="punch-a"]').fill('21'); await page.locator('[data-testid="punch-a"]').dispatchEvent('change');
  await page.locator('[data-testid="punch-b"]').fill('45'); await page.locator('[data-testid="punch-b"]').dispatchEvent('change');
  check('punch in and out keeps its two frames', await ev(() => { const p = window.__walkBase.S.punch; return p.on && p.a === 21 && p.b === 45; }), await ev(() => window.__walkBase.S.punch));
  await q('tab-Gait').click(); await q('play').click(); await page.waitForTimeout(150);
  check('a take that punches in starts at the first frame', await ev(() => window.__walkBase.S.recording && window.__walkBase.S.frame >= 20), await ev(() => window.__walkBase.S.frame));
  await ev(async () => { const el = document.querySelector('[data-testid="rng-stepLength"]'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.value = '0.4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(1800);
  const out = await ev(() => ({ playing: window.__walkBase.S.playing, frame: window.__walkBase.S.frame, rec: window.__walkBase.S.recording, lane: (window.__walkBase.S.lanes['p:stepLength']?.pts || []).map((p) => p.t) }));
  await ev(() => document.querySelector('[data-testid="rng-stepLength"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
  check('and stops by itself at the last frame', !out.playing && !out.rec && out.frame <= 45, out);
  check('only the punched span was written', out.lane.length >= 2 && Math.min(...out.lane) >= 18 && Math.max(...out.lane) <= 50, out.lane);
  await ev(() => { window.__walkBase.S.punch = null; });
  // mute a lane: it stays in the list but the walk ignores it, and unmuting brings it back
  await ev(() => { const w = window.__walkBase; w.S.lanes = { 'p:stepLength': { pts: [{ t: 0, v: 0.3 }, { t: 40, v: 0.3 }], interp: 'smooth' } }; w.S.perfLen = 48; w.S.ver++; w.setTab('Auto'); w.setFrame(20); w.render(); }); await page.waitForTimeout(250);
  const at = () => ev(() => window.__walkBase.nowValues().p.stepLength);
  check('a lane drives the walk', Math.abs((await at()) - 0.3) < 1e-6, await at());
  await q('tab-Auto').click(); await q('lane-mute-p:stepLength').click(); await page.waitForTimeout(150);
  check('a muted lane is ignored but kept', Math.abs((await at()) - 0.78) < 1e-6 && (await ev(() => window.__walkBase.S.lanes['p:stepLength'].mute === true)), await at());
  await q('lane-mute-p:stepLength').click(); await page.waitForTimeout(150);
  check('and unmuting brings it back', Math.abs((await at()) - 0.3) < 1e-6, await at());
}
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
