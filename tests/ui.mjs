// Walk Base in a browser, opened as a file, with emulated touch. Emulation proves the logic, not iPad hardware.
// Usage: node walkbase/tests/ui.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { press } from './helpers.mjs';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 330));
};

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `wb-${name}-${n}.png`) }); };
const tap = (id) => press(page, id, { tap: true });

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
check(process.env.WB_URL ? 'opens from the served address' : 'opens as a file', process.env.WB_URL ? page.url().startsWith('http') : page.url().startsWith('file:'));
await page.waitForTimeout(400);

// ---- orbit: one finger drags, pinch does not orbit ----
let cdp = null;
if (name === 'chromium') cdp = await context.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const stageBox = await page.locator('[data-testid="stage"]').boundingBox();
const cx = stageBox.x + stageBox.width / 2; const cy = stageBox.y + stageBox.height * 0.62;
if (cdp) {
  check('the Select tool is the default, so one finger does not move the camera', (await ev(() => window.__walkBase.S.tool)) === 'select');
  { const yS = await ev(() => window.__walkBase.S.s.camYaw); await touch('touchStart', [[cx - 100, cy]]); for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 100 + i * 12, cy]]); await touch('touchEnd', []); check('with Select a one-finger drag leaves the camera alone', (await ev(() => window.__walkBase.S.s.camYaw)) === yS); }
  await ev(() => { window.__walkBase.S.tool = 'orbit'; });
  const y0 = await ev(() => window.__walkBase.S.s.camYaw);
  await touch('touchStart', [[cx - 100, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 100 + i * 12, cy]]);
  await touch('touchEnd', []);
  const y1 = await ev(() => window.__walkBase.S.s.camYaw);
  check('one-finger drag orbits the camera', Math.abs(y1 - y0) > 20, `${y0} to ${y1}`);
  const z0 = await ev(() => window.__walkBase.S.zoom);
  await touch('touchStart', [[cx - 60, cy], [cx + 60, cy]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 60 - i * 10, cy], [cx + 60 + i * 10, cy]]);
  await touch('touchEnd', []);
  const y2 = await ev(() => window.__walkBase.S.s.camYaw);
  check('pinch zooms and does not orbit', (await ev(() => window.__walkBase.S.zoom)) > z0 && y2 === y1, `zoom ${z0} to ${await ev(() => window.__walkBase.S.zoom)}`);
  await tap('fit');
}
await tap('view-side');
check('Side preset sets the side view', (await ev(() => [window.__walkBase.S.s.camYaw, window.__walkBase.S.s.camPitch])).join() === '0,0');
await tap('view-front');
check('Front preset', (await ev(() => window.__walkBase.S.s.camYaw)) === -90);
await shot('front');
await tap('view-34');
await shot('three-quarter');
await tap('view-top');
await shot('top');
await tap('view-side');

// ---- tap a part on the figure ----
await ev(() => window.__walkBase.setFrame(5));
await page.waitForTimeout(200);
const where = await ev(() => {
  const S = window.__walkBase.S; const m = S.map; const info = S.last;
  const out = {};
  for (const want of ['forearm', 'head', 'foot', 'pelvis', 'spine.mid']) {
    const sh = info.shapes.filter((q) => q.part === want && (!q.side || q.side === 'R')).pop() || info.shapes.find((q) => q.part === want);
    if (!sh) continue;
    let x = 0; let y = 0; for (const p of sh.pts) { x += p[0]; y += p[1]; } x /= sh.pts.length; y /= sh.pts.length;
    out[want] = { cx: m.left + ((x / m.fcw) * m.zw + m.x0) / m.d, cy: m.top + ((y / m.fch) * m.zh + m.y0) / m.d };
  }
  return out;
});
await page.touchscreen.tap(where.head.cx, where.head.cy);
await page.waitForTimeout(250);
check('tapping the head selects it', (await ev(() => window.__walkBase.S.sel?.part)) === 'head', await ev(() => window.__walkBase.S.sel));
check('Parts tab opens with that part\'s channels', (await page.locator('[data-testid^="chan-head."]').count()) === 3);
await page.touchscreen.tap(where['spine.mid'].cx, where['spine.mid'].cy);
await page.waitForTimeout(250);
check('tapping the torso selects a spine joint', String(await ev(() => window.__walkBase.S.sel?.part)).startsWith('spine'), await ev(() => window.__walkBase.S.sel));
await shot('selected');

// ---- change a channel with its own slider and see the pose respond ----
await ev(() => window.__walkBase.selectPart({ part: 'pelvis', side: null }));
const before = await ev(() => window.__walkBase.liveValue('pelvis.yaw'));
const hip0 = await ev(() => { const z = window.__walkBase.S.last.pz; return z.sides.R.hip.join(); });
await page.locator('[data-testid="ch-pelvis.yaw-amount-num"]').fill('2.5');
await page.locator('[data-testid="ch-pelvis.yaw-amount-num"]').dispatchEvent('change');
await page.waitForTimeout(250);
const after = await ev(() => window.__walkBase.liveValue('pelvis.yaw'));
check('Amount scales a channel', Math.abs(after - 2.5 * before) < 1e-9 && Math.abs(before) > 1e-4, `${before} to ${after}`);
check('the pose follows', hip0 !== (await ev(() => window.__walkBase.S.last.pz.sides.R.hip.join())));
check('the card is marked changed', (await page.locator('[data-testid="chan-pelvis.yaw"] .badge').count()) === 1);
await page.locator('[data-testid="reset-ch-pelvis.yaw"]').tap();
check('Reset puts it back', Math.abs((await ev(() => window.__walkBase.liveValue('pelvis.yaw'))) - before) < 1e-9);

// ---- frequency: hip bob repeats more often ----
await ev(() => window.__walkBase.selectPart({ part: 'pelvis', side: null }));
await ev(() => window.__walkBase.setFrame(6));
const bob1 = await ev(() => window.__walkBase.liveValue('pelvis.y'));       // phase 0.25 at the built-in rate
await page.locator('[data-testid="more-ch-pelvis.y"]').tap();
check('the Repeats control is folded away until asked for', (await page.locator('[data-testid="ch-pelvis.y-freq-2"]:visible').count()) === 1);
check('half speed is offered for hip bob but not for an arm swing', (await page.locator('[data-testid="ch-pelvis.y-freq-0.5"]').count()) === 1 && (await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'arm', side: 'R' }); const n = document.querySelectorAll('[data-testid="ch-arm.pitch.R-freq-0.5"]').length; w.selectPart({ part: 'pelvis', side: null }); return n; })) === 0);
await page.locator('[data-testid="more-ch-pelvis.y"]').tap();
await page.locator('[data-testid="ch-pelvis.y-freq-2"]').tap();
await ev(() => window.__walkBase.setFrame(3));                               // phase 0.125: twice as fast, so the value phase 0.25 had
const bob2 = await ev(() => window.__walkBase.liveValue('pelvis.y'));
check('Repeats x2 makes the hip bob twice as often', (await ev(() => window.__walkBase.S.motion['pelvis.y']?.freq)) === 2 && Math.abs(bob2 - bob1) < 1e-9, `${bob1} vs ${bob2}`);
check('the card is marked changed', (await page.locator('[data-testid="chan-pelvis.y"] .badge').count()) === 1);
await page.locator('[data-testid="reset-ch-pelvis.y"]').tap();
check('Reset puts the frequency back', (await ev(() => window.__walkBase.S.motion['pelvis.y']?.freq)) == null);


// ---- linked sides ----
await ev(() => window.__walkBase.selectPart({ part: 'arm', side: 'R' }));
await ev(() => window.__walkBase.patchMotion('arm.pitch.R', { amount: 2 }));
const link = await ev(() => [window.__walkBase.S.motion['arm.pitch.R'], window.__walkBase.S.motion['arm.pitch.L']]);
check('left follows right when linked', link[1] && link[1].amount === 2, link);
await ev(() => window.__walkBase.setMotion('arm.pitch.R', null));
check('and clears with it', (await ev(() => Object.keys(window.__walkBase.S.motion).length)) === 0);

// ---- the curve pop-out: handles ----
await ev(() => window.__walkBase.selectPart({ part: 'pelvis', side: null }));
await page.locator('[data-testid="draw-pelvis.y"]').tap();
await page.waitForTimeout(300);
check('pop-out opens over the controls and leaves the stage visible', (await page.locator('[data-testid="popout"]:visible').count()) === 1 && (await page.locator('[data-testid="stage"]:visible').count()) === 1);
await shot('curve-open');
const cb = await page.locator('.curve-canvas').boundingBox();
const tx = (u) => cb.x + 46 + u * (cb.width - 56);
const ty = (f) => cb.y + 40 + (1 - f) * (cb.height - 64);
await ev(() => window.__walkBase.setFrame(5));
const bobBefore = await ev(() => window.__walkBase.liveValue('pelvis.y'));
if (cdp) {
  await touch('touchStart', [[tx(0.5), ty(0.5)]]); await touch('touchEnd', []);
  await page.waitForTimeout(150);
  const n0 = await ev(() => window.__walkBase.S.motion['pelvis.y']?.pts?.length);
  check('first tap turns the curve into handles', n0 === 12, n0);
  // drag the handle nearest u=0.25 upward
  const pts = await ev(() => window.__walkBase.S.motion['pelvis.y'].pts.map((p) => ({ ...p })));
  const ed = await ev(() => { const e = window.__walkBase.editor(); const L = e.layout(); const R = e.range(); return { L, R, c: { to: null } }; });
  const handle = pts.find((p) => Math.abs(p.u - 0.25) < 0.05);
  const hy = cb.y + ed.L.t + (1 - ((handle.v * 1 - ed.R.lo) / (ed.R.hi - ed.R.lo))) * (cb.height - ed.L.t - ed.L.b);
  await touch('touchStart', [[tx(handle.u), hy]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[tx(handle.u), hy - i * 10]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(150);
  const after = await ev(() => window.__walkBase.S.motion['pelvis.y'].pts.find((p) => Math.abs(p.u - 0.25) < 0.05));
  check('dragging a handle moves that part of the curve', after.v > handle.v + 0.001, `${handle.v} to ${after.v}`);
  await ev(() => window.__walkBase.setFrame(6));          // frame 7 of 24 sits at phase 0.25
  const atHandle = await ev(() => window.__walkBase.liveValue('pelvis.y'));
  check('the hips follow the drawn curve', Math.abs(atHandle - after.v) < 0.003, `${atHandle} vs handle ${after.v}`);

  // freehand
  await page.locator('[data-testid="edit-draw"]').tap();
  await touch('touchStart', [[tx(0.55), ty(0.2)]]);
  for (let i = 1; i <= 20; i++) await touch('touchMove', [[tx(0.55 + i * 0.015), ty(0.2 + Math.sin(i / 3) * 0.1)]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(150);
  const n1 = await ev(() => window.__walkBase.S.motion['pelvis.y'].pts.length);
  check('freehand drawing replaces the stretch it covers', n1 > 0 && n1 !== 12, n1);
  await shot('curve-drawn');
  await page.locator('[data-testid="edit-smooth"]').tap();
  check('smooth keeps the curve', (await ev(() => window.__walkBase.S.motion['pelvis.y'].pts.length)) === n1);
  // scrub strip
  const f0 = await ev(() => window.__walkBase.S.frame);
  await touch('touchStart', [[tx(0.7), cb.y + 8]]); await touch('touchMove', [[tx(0.75), cb.y + 8]]); await touch('touchEnd', []);
  check('dragging the top strip scrubs the frame', (await ev(() => window.__walkBase.S.frame)) !== f0, `${f0} to ${await ev(() => window.__walkBase.S.frame)}`);
}
await ev(() => window.__walkBase.setFrame(5));
// A click, not a tap: after the scripted scrub gesture above, Chromium does not synthesise a click from the next scripted tap. The other pop-out buttons are tapped.
await page.locator('[data-testid="edit-reset"]').click();
const bobNow = await ev(() => window.__walkBase.liveValue('pelvis.y'));
check('Back to built-in restores the motion', Math.abs(bobNow - bobBefore) < 1e-9, `before ${bobBefore} now ${bobNow} keys ${await ev(() => Object.keys(window.__walkBase.S.motion).join())} frame ${await ev(() => window.__walkBase.S.frame)}`);
await page.locator('[data-testid="edit-close"]').click();
check('Close hides the pop-out', (await page.locator('[data-testid="popout"]:visible').count()) === 0);

// ---- persistence of drawn motion ----
await ev(() => { const w = window.__walkBase; w.setMotion('spine2.pitch', { pts: Array.from({ length: 8 }, (_, i) => ({ u: i / 8, v: 0.1 * Math.sin(i) })), amount: 1, offset: 0, phase: 0 }); });
await page.waitForTimeout(500);
await page.reload();
await page.waitForFunction(() => window.__walkBase);
check('drawn motion survives a reload', (await ev(() => window.__walkBase.S.motion['spine2.pitch']?.pts?.length)) === 8);
await ev(() => window.__walkBase.setMotion('spine2.pitch', null));

// ---- the divider between the animation window and the tools ----
{
  const box = (sel) => page.locator(sel).first().boundingBox();
  const grab = async () => { const b = await box('[data-testid="splitter"]'); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }; };
  await page.setViewportSize({ width: 1180, height: 820 }); await page.waitForTimeout(300);
  const s0 = await box('.stage-wrap'); const p0 = await box('.panel'); const g0 = await grab();
  check('the divider is at least 44 px to grab', g0.w >= 44, g0);
  await page.mouse.move(g0.x, g0.y); await page.mouse.down(); await page.mouse.move(g0.x - 60, g0.y, { steps: 5 }); await page.mouse.move(g0.x - 120, g0.y, { steps: 5 }); await page.mouse.up();
  const s1 = await box('.stage-wrap'); const p1 = await box('.panel');
  check('dragging the divider left widens the tools and narrows the animation window', Math.abs((p1.width - p0.width) - 120) < 6 && Math.abs((s0.width - s1.width) - 120) < 6, `${Math.round(p0.width)} to ${Math.round(p1.width)}`);
  const stageNow = await ev(() => { const r = document.querySelector('.stage').getBoundingClientRect(); return [Math.round(r.width), window.__walkBase.S.last ? true : false]; });
  check('the stage redraws at its new size', stageNow[0] === Math.round(s1.width), stageNow);
  const g1 = await grab();
  await page.mouse.move(g1.x, g1.y); await page.mouse.down(); await page.mouse.move(g1.x + 900, g1.y, { steps: 8 }); await page.mouse.up();
  const p2 = await box('.panel');
  check('the tools cannot be dragged smaller than a usable width', p2.width >= 258, Math.round(p2.width));
  const g2 = await grab();
  await page.mouse.move(g2.x, g2.y); await page.mouse.down(); await page.mouse.move(g2.x - 2000, g2.y, { steps: 8 }); await page.mouse.up();
  const s3 = await box('.stage-wrap'); const p3a = await box('.panel');
  check('and the animation window cannot be dragged away', s3.width >= 250, Math.round(s3.width));
  check('a wild drag is stored as the width actually applied', (await ev(() => window.__walkBase.LAYOUT.panelW)) === Math.round(p3a.width), await ev(() => window.__walkBase.LAYOUT.panelW));
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  const p3 = await box('.panel');
  check('the layout is remembered after a reload', Math.abs(p3.width - p3a.width) < 2, `${Math.round(p3a.width)} then ${Math.round(p3.width)}`);
  await page.locator('[data-testid="splitter"]').dblclick();
  const p4 = await box('.panel');
  check('double-tapping the divider resets it', Math.abs(p4.width - 390) < 4, Math.round(p4.width));
  await page.locator('[data-testid="splitter"]').focus();
  const pk0 = (await box('.panel')).width;
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  check('arrow keys move it too', Math.abs(((await box('.panel')).width - pk0) - 40) < 4);
  await page.locator('[data-testid="splitter"]').dblclick();
  // portrait: a horizontal divider
  await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForTimeout(900);
  const sp0 = await box('.stage-wrap'); const gp = await grab();
  check('in portrait the divider runs across and is 44 px tall', gp.h >= 44 && gp.w > 400, gp);
  await page.mouse.move(gp.x, gp.y); await page.mouse.down(); await page.mouse.move(gp.x, gp.y + 100, { steps: 6 }); await page.mouse.move(gp.x, gp.y + 180, { steps: 6 }); await page.mouse.up();
  const sp1 = await box('.stage-wrap');
  check('dragging down makes the animation window taller', Math.abs((sp1.height - sp0.height) - 180) < 8, `${Math.round(sp0.height)} to ${Math.round(sp1.height)}`);
  const pp = await box('.panel');
  check('the tools keep room underneath', pp.height >= 180, Math.round(pp.height));
  const touchOk = await ev(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  check('nothing overflows sideways while resized', touchOk);
  await page.locator('[data-testid="splitter"]').dblclick();
  await page.setViewportSize({ width: 1180, height: 820 });
}

// ---- target sizes, text size, overflow, in every tab and size ----
const audit = () => ev(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, input, select, label.btn, summary, [role="tab"]')) {
    // A checkbox is a small square inside a label; the label is what a finger hits.
    const box = (el.type === 'checkbox' || el.type === 'radio') ? (el.closest('label') || el) : el;
    const r = box.getBoundingClientRect(); const s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none' || el.disabled || el.type === 'file') continue;
    if (el.closest('.pillfield')) continue; // the top-bar pop-ups are deliberately compact (34 px)
    const min = el.type === 'range' ? r.height : Math.min(r.width, r.height);
    if (min < 43.5) out.push(`${el.dataset.testid || el.className || el.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
});
const small16 = () => ev(() => [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=color]):not([type=file]), select')].filter((e) => !e.closest('.pillfield') && e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.dataset.testid || e.className));
await ev(() => window.__walkBase.selectPart({ part: 'forearm', side: 'R' }));
for (const [label, size] of Object.entries({ landscape: { width: 1180, height: 820 }, portrait: { width: 820, height: 1180 }, narrow: { width: 507, height: 820 } })) {
  await page.setViewportSize(size); await page.waitForTimeout(300);
  const bad = new Set(); const bad16 = new Set(); const over = [];
  for (const tab of ['Gait', 'Parts', 'Attach', 'Auto', 'Body', 'View', 'Look', 'Guides', 'Export']) {
    if (tab === 'Attach') await ev(() => { const w = window.__walkBase; if (!w.attachList().length) w.addAttach('rect'); w.selectAttach(w.attachList()[0].id); });
    await ev((t) => window.__walkBase.setTab(t), tab); await page.waitForTimeout(250);
    (await audit()).forEach((x) => bad.add(`${tab}/${x}`)); (await small16()).forEach((x) => bad16.add(`${tab}/${x}`));
    if ((await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) > 0) over.push(tab);
    await shot(`${label}-${tab}`);
  }
  // the dog's panels
  await ev(() => { const w = window.__walkBase; w.setRig('dog'); w.selectPart({ part: 'dog.fleg', side: 'R' }); w.S.lanes = { cadence: { pts: [{ t: 0, v: 1 }, { t: 30, v: 0.5 }], interp: 'smooth' } }; w.S.ver++; });
  for (const tab of ['Gait', 'Parts', 'Auto', 'Body']) {
    await ev((t) => window.__walkBase.setTab(t), tab); await page.waitForTimeout(250);
    (await audit()).forEach((x) => bad.add(`dog-${tab}/${x}`)); (await small16()).forEach((x) => bad16.add(`dog-${tab}/${x}`));
    if ((await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) > 0) over.push(`dog-${tab}`);
  }
  await ev(() => window.__walkBase.openLaneEditor('cadence')); await page.waitForTimeout(250);
  (await audit()).forEach((x) => bad.add(`lane-popout/${x}`));
  await ev(() => { const w = window.__walkBase; w.closeEditor(); w.S.lanes = {}; w.S.ver++; w.setRig('human'); w.selectPart({ part: 'forearm', side: 'R' }); });
  await page.waitForTimeout(200);
  await ev(() => window.__walkBase.openEditor('elbow.flex.R')); await page.waitForTimeout(300);
  (await audit()).forEach((x) => bad.add(`popout/${x}`)); (await small16()).forEach((x) => bad16.add(`popout/${x}`));
  const fit = await ev(() => { const r = (sel) => document.querySelector(sel).getBoundingClientRect(); const po = r('[data-testid="popout"]'); const st = r('.stage-wrap'); const cv = r('.curve-canvas'); return { w: innerWidth, popRight: po.right, stageRight: st.right, canvasRight: cv.right, popLeft: po.left }; });
  check(`${label}: pop-out and stage fit inside the window`, fit.popRight <= fit.w + 1 && fit.stageRight <= fit.w + 1 && fit.canvasRight <= fit.w + 1, fit);
  const axis = await ev(() => { const e = window.__walkBase.editor(); const R = e.range(); return R; });
  check(`${label}: elbow graph axis is in degrees`, axis.hi < 400 && axis.lo > -100, axis);
  await shot(`${label}-popout`);
  await ev(() => window.__walkBase.closeEditor());
  check(`${label}: every control at least 44 px`, bad.size === 0, [...bad].slice(0, 12).join(' '));
  check(`${label}: text fields at least 16 px`, bad16.size === 0, [...bad16].slice(0, 8).join(' '));
  check(`${label}: no sideways scroll`, over.length === 0, over.join(' '));
}
await page.setViewportSize({ width: 1180, height: 820 });

// ---- export with an orbit, decoded outside the browser ----
const exp = await ev(async () => {
  const w = window.__walkBase; w.setTab('Export');
  const r = await w.exportZip({ orbit: 360, cycles: 1, timing: 'expanded', width: 640, height: 360 });
  const buf = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return { b64: btoa(s), frames: r.summary.frames, manifest: r.manifest.frames.length };
});
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
const zipPath = path.join(root, 'tmp/orbit.zip');
fs.writeFileSync(zipPath, Buffer.from(exp.b64, 'base64'));
check('export builds', exp.frames === 24 && exp.manifest === 24, exp);

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(root, `tests/ui-${name}.json`), JSON.stringify({ browser: name, at: new Date().toISOString(), note: 'Emulated touch, not a physical iPad.', results, errors }, null, 1));
console.log(`page errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
console.log(`\n${name}: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(0);
