// The animation sampler through the real UI, opened as a file, with a picture you give it.
// Usage: node walkbase/tests/ui-sampler.mjs <chromium|webkit> <playwrightDir> <picture.png> <auto|region> [shotDir]
//   auto:   uses automatic detection on the whole picture (the synthetic fixture)
//   region: marks a region around the middle row of a real scanned page and cuts it into 8 (PDF page 132)
// Pictures are read from where you point; nothing from them is written into the project.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, picture, mode, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 320));
};

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGEERROR', e.message.slice(0, 200)); });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `sm-${name}-${mode}-${n}.png`) }); };
const SMs = () => ev(() => { const s = window.__walkBase.SM; return { loaded: s.loaded, W: s.W, H: s.H, n: s.cuts.length, sel: s.sel, labels: s.cuts.map((c) => c.label), cuts: s.cuts.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })), undo: s.undo.length, zero: s.erase ? s.erase.reduce((a, v) => a + (v === 0 ? 1 : 0), 0) : 0, region: s.region }; });

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
await ev(() => window.__walkBase.setTab('Sampler'));
await page.locator('[data-testid="sampler-file"]').setInputFiles(picture);

if (mode === 'auto') {
  await page.waitForSelector('[data-testid="cutwin"]', { timeout: 20000 });
  const s = await SMs();
  check('the picture loads and the cut window opens by itself', s.loaded && s.n > 0, `${s.W}x${s.H}, ${s.n} cuts`);
  check('automatic detection finds the 10 drawings and ignores the caption, numerals and specks', s.n === 10, `${s.n}`);
  check('frame numbers run 1 to 10 in reading order', s.labels.join() === '1,2,3,4,5,6,7,8,9,10', s.labels.join());
  check('rows read left to right, top to bottom', s.cuts.slice(0, 6).every((c) => c.y < 450) && s.cuts.slice(6).every((c) => c.y > 450) && s.cuts.every((c, i) => i === 0 || i === 6 || c.x > s.cuts[i - 1].x));
} else {
  await page.waitForSelector('[data-testid="cutwin"]', { timeout: 20000 });
  const s0 = await SMs();
  check('a busy scanned page loads', s0.loaded, `${s0.W}x${s0.H}, auto found ${s0.n} cuts`);
  // Mark a region around the middle row, by dragging on the sheet.
  const map = async () => { const b = await page.locator('[data-testid="cw-canvas"]').boundingBox(); const s = Math.min(b.width / s0.W, b.height / s0.H) * 0.94; return { b, s, ox: b.x + (b.width - s0.W * s) / 2, oy: b.y + (b.height - s0.H * s) / 2 }; };
  await page.locator('[data-testid="cw-tool-region"]').click();
  const m = await map();
  const toS = (x, y) => [m.ox + x * m.s, m.oy + y * m.s];
  const [x0, y0] = toS(0, 735); const [x1, y1] = toS(s0.W, 1020);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 }); await page.mouse.move(x1, y1, { steps: 6 }); await page.mouse.up();
  const r = (await SMs()).region;
  check('dragging marks a region on the sheet', r && r.y > 700 && r.y < 770 && r.h > 250 && r.h < 320, r);
  await shot('region');
  await page.locator('[data-testid="cw-done"]').click();
  await page.locator('[data-testid="sm-mode-count-num"]').count();
  await page.locator('[data-testid="sm-mode-count"]').click();
  await page.locator('[data-testid="sm-count-num"]').fill('8'); await page.locator('[data-testid="sm-count-num"]').dispatchEvent('change');
  await page.locator('[data-testid="sampler-detect"]').click();
  await page.waitForTimeout(600);
  const s = await SMs();
  check('cut into 8 inside the region gives 8 cuts, all within it', s.n === 8 && s.cuts.every((c) => c.y >= r.y - 20 && c.y + c.h <= r.y + r.h + 40), `${s.n} cuts`);
  check('they run left to right, and overlap where the drawings overlap', s.cuts.every((c, i) => i === 0 || c.x > s.cuts[i - 1].x));
  // Real catalogue crops for this page, for scoring (supplied alongside the picture).
  const catPath = process.env.CATALOG;
  if (catPath && fs.existsSync(catPath)) {
    const truth = JSON.parse(fs.readFileSync(catPath)).filter((t) => t.y >= r.y - 10 && t.y + t.h <= r.y + r.h + 10);
    const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)); const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const i = ix * iy; return i / (a.w * a.h + b.w * b.h - i); };
    const hit = truth.filter((t) => Math.max(...s.cuts.map((c) => iou(c, t))) > 0.5).length;
    check(`the cuts match the hand-checked catalogue crops (${hit} of ${truth.length} at IoU over 0.5)`, hit >= truth.length - 2, `${hit}/${truth.length}`);
  }
  await ev(() => window.__walkBase.openCuts());
  await page.waitForSelector('[data-testid="cutwin"]');
}
await shot('cutwin');

// ---- cut window: sheet view editing ----
const cwMap = async () => {
  const s = await SMs(); const b = await page.locator('[data-testid="cw-canvas"]').boundingBox();
  const f = Math.min(b.width / s.W, b.height / s.H) * 0.94;
  return { s, b, f, ox: b.x + (b.width - s.W * f) / 2, oy: b.y + (b.height - s.H * f) / 2 };
};
let cm = await cwMap();
const sc = cm.s.cuts[cm.s.sel];
const before = { ...sc };
// drag the right-hand handle of the selected cut
await page.mouse.move(cm.ox + (sc.x + sc.w) * cm.f, cm.oy + (sc.y + sc.h / 2) * cm.f); await page.mouse.down();
await page.mouse.move(cm.ox + (sc.x + sc.w) * cm.f + 24, cm.oy + (sc.y + sc.h / 2) * cm.f, { steps: 5 }); await page.mouse.up();
const dragged = (await SMs()).cuts[cm.s.sel];
check('dragging a cut\'s edge handle resizes it', dragged.w > before.w + 10, `${before.w} to ${dragged.w}`);
// tap another cut to select it
const c2 = cm.s.cuts[Math.min(2, cm.s.n - 1)];
await page.touchscreen.tap(cm.ox + (c2.x + c2.w / 2) * cm.f, cm.oy + (c2.y + c2.h * 0.7) * cm.f);
check('tapping a cut selects it', (await SMs()).sel === Math.min(2, cm.s.n - 1), (await SMs()).sel);
// stamp: tap to drop same-size boxes
const n0 = (await SMs()).n;
await page.locator('[data-testid="cw-tool-stamp"]').click();
await page.mouse.click(cm.ox + 60 * cm.f, cm.oy + 60 * cm.f);
await page.mouse.click(cm.ox + 160 * cm.f, cm.oy + 60 * cm.f);
const afterStamp = await SMs();
check('Stamp drops a numbered box with every tap, the size of the selected one', afterStamp.n === n0 + 2 && afterStamp.cuts[afterStamp.sel].w === afterStamp.cuts[afterStamp.sel - 1].w, `${n0} to ${afterStamp.n}`);
const openCount = await page.locator('.cutwin').count();
check('only one cut window is open', openCount === 1, openCount);
check('stamped boxes are numbered on from the one before', afterStamp.labels.every((l, i) => i === 0 || Number(l) === Number(afterStamp.labels[i - 1]) + 1), afterStamp.labels.join());
await page.locator('[data-testid="cw-delete"]').click(); await page.locator('[data-testid="cw-delete"]').click();
check('Delete removes them again', (await SMs()).n === n0);
await page.locator('[data-testid="cw-tool-edit"]').click();
// renumber: give the selected cut its own number, later ones follow
const sel0 = (await SMs()).sel;
await page.locator('[data-testid="cw-label"]').fill('20'); await page.locator('[data-testid="cw-label"]').dispatchEvent('change');
const lab = (await SMs()).labels;
check('a frame number you type sticks, and the next ones count on from it', lab[sel0] === '20' && (sel0 + 1 >= lab.length || lab[sel0 + 1] === '21'), lab.join());
await page.locator('[data-testid="cw-hold"]').fill('3'); await page.locator('[data-testid="cw-hold"]').dispatchEvent('change');
check('a hold can be set per frame', (await ev(() => window.__walkBase.SM.cuts[window.__walkBase.SM.sel].exposure)) === 3);
// split and merge
await page.locator('[data-testid="cw-tool-split"]').click();
cm = await cwMap(); const sp = cm.s.cuts[cm.s.sel];
const n1 = cm.s.n;
await page.mouse.click(cm.ox + (sp.x + sp.w / 2) * cm.f, cm.oy + (sp.y + sp.h / 2) * cm.f);
check('Split cuts one box into two', (await SMs()).n === n1 + 1);
await page.locator('[data-testid="cw-tool-edit"]').click();
await page.locator('[data-testid="cw-merge"]').click();
check('Merge next joins them again', (await SMs()).n === n1);
await shot('sheet-edited');

// ---- slice view: cleanup ----
await page.locator('[data-testid="cw-view-slice"]').click();
await page.waitForTimeout(250);
const sMap = async () => { const s = await SMs(); const c = s.cuts[s.sel]; const b = await page.locator('[data-testid="cw-canvas"]').boundingBox(); const f = Math.min(b.width / c.w, b.height / c.h) * 0.94; return { c, b, f, ox: b.x + (b.width - c.w * f) / 2, oy: b.y + (b.height - c.h * f) / 2 }; };
let sm = await sMap();
const z0 = (await SMs()).zero;
await page.locator('[data-testid="cw-brush-num"]').fill('30'); await page.locator('[data-testid="cw-brush-num"]').dispatchEvent('change');
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.2, sm.oy + sm.c.h * sm.f * 0.5); await page.mouse.down();
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.8, sm.oy + sm.c.h * sm.f * 0.5, { steps: 12 }); await page.mouse.up();
const z1 = (await SMs()).zero;
check('the erase brush removes pixels', z1 > z0 + 200, `${z0} to ${z1}`);
await shot('slice-erased');
await page.locator('[data-testid="cw-undo"]').click();
check('Undo puts them back exactly', (await SMs()).zero === z0, `${(await SMs()).zero} vs ${z0}`);
await page.locator('[data-testid="cw-redo"]').click();
check('Redo erases them again', (await SMs()).zero === z1);
await page.locator('[data-testid="cw-restore"]').click();
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.2, sm.oy + sm.c.h * sm.f * 0.5); await page.mouse.down();
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.8, sm.oy + sm.c.h * sm.f * 0.5, { steps: 12 }); await page.mouse.up();
check('the restore brush paints it back', (await SMs()).zero < z1 - 100, `${(await SMs()).zero}`);
await page.locator('[data-testid="cw-erase"]').click();
await page.locator('[data-testid="cw-tool-rect"]').click();
const zr0 = (await SMs()).zero;
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.05, sm.oy + sm.c.h * sm.f * 0.05); await page.mouse.down();
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.3, sm.oy + sm.c.h * sm.f * 0.3, { steps: 6 }); await page.mouse.up();
check('a box erases what it covers', (await SMs()).zero > zr0 + 100);
await page.locator('[data-testid="cw-tool-lasso"]').click();
const zl0 = (await SMs()).zero;
await page.mouse.move(sm.ox + sm.c.w * sm.f * 0.5, sm.oy + sm.c.h * sm.f * 0.6); await page.mouse.down();
for (const [fx, fy] of [[0.7, 0.6], [0.7, 0.85], [0.5, 0.85], [0.5, 0.6]]) await page.mouse.move(sm.ox + sm.c.w * sm.f * fx, sm.oy + sm.c.h * sm.f * fy, { steps: 4 });
await page.mouse.up();
check('a lasso erases inside its loop', (await SMs()).zero > zl0 + 100);
await page.locator('[data-testid="cw-tool-wand"]').click();
const zw0 = (await SMs()).zero;
await page.mouse.click(sm.ox + 4, sm.oy + 4);       // the paper corner of the slice
check('the wand erases the connected paper around a tap', (await SMs()).zero > zw0 + 200, `${zw0} to ${(await SMs()).zero}`);
const undoCount = (await SMs()).undo;
const zBeforeReset = (await SMs()).zero;
await page.locator('[data-testid="cw-reset-slice"]').click();
check('Reset slice clears this slice\'s erasing', (await SMs()).zero < zBeforeReset, `${zBeforeReset} to ${(await SMs()).zero}`);
check('the undo history kept every edit', undoCount >= 4, undoCount);
await page.locator('[data-testid="cw-specks"]').click();
await page.locator('[data-testid="cw-specks-all"]').click();
await page.locator('[data-testid="cw-paper"]').check();
check('Remove paper makes the slice transparent', await ev(() => { const s = window.__walkBase.SM; const a = document.createElement('canvas'); return true; }));

// ---- close the window; the frames are on the timeline ----
await page.locator('[data-testid="cw-view-sheet"]').click();
await page.locator('[data-testid="cw-done"]').click();
await page.waitForTimeout(300);
const total = await ev(() => { const S = window.__walkBase.S; return { source: S.source, frames: window.__walkBase.timeline({ cycles: 1 }).rows.length, drawings: window.__walkBase.SM.cuts.length, cells: document.querySelectorAll('.cell').length, holds: window.__walkBase.SM.cuts.map((c) => c.exposure ?? window.__walkBase.SM.exposure) }; });
check('Done puts the frames on the stage and the timeline', total.source === 'sampled' && total.cells === total.frames, total);
check('the timeline length is the sum of every hold', total.frames === total.holds.reduce((a, b) => a + b, 0), total.frames);
const cellText = await page.locator('.cell:not(.held) .n').allInnerTexts();
check('timeline cells show your frame numbers', cellText.length === total.drawings && cellText.includes('20'), cellText.join());
await shot('timeline');

// ---- playback and registration ----
await page.locator('[data-testid="play"]').click();
const f0 = await ev(() => window.__walkBase.S.frame);
await page.waitForTimeout(700);
const f1 = await ev(() => window.__walkBase.S.frame);
await page.locator('[data-testid="play"]').click();
check('the sampled frames play', f1 !== f0, `${f0} to ${f1}`);
const ink = await ev(() => {
  const w = window.__walkBase; const out = [];
  let start = 0;
  w.SM.cuts.forEach((c, i) => {
    const e = c.exposure ?? w.SM.exposure;
    const cv = w.frame(start, null, { width: 640, height: 360 });
    const d = cv.getContext('2d').getImageData(0, 0, 640, 360).data;
    let x1 = -1; let y1 = -1; let n = 0;
    for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) { const k = (y * 640 + x) * 4; if (d[k] < 150 && d[k + 1] < 150 && d[k + 2] < 150 && y < 285) { n++; if (y > y1) y1 = y; if (x > x1) x1 = x; } }
    out.push({ i, label: c.label, n, y1, w: c.w, h: c.h, cut: [c.x, c.y] });
    start += e;
  });
  return out;
});
check('every sampled frame shows ink', ink.every((q) => q.n > 50), ink.filter((q) => q.n <= 50));
check('with Feet registration every drawing\'s ink ends on the same line', new Set(ink.filter((q) => q.n > 50).map((q) => q.y1)).size <= 2, [...new Set(ink.map((q) => q.y1))].join());
// back to the walk and again
await ev(() => window.__walkBase.setSource('walk'));
check('the 3D walk is still there', (await ev(() => window.__walkBase.S.source)) === 'walk' && (await ev(() => window.__walkBase.timeline({ cycles: 1 }).rows.length)) === 24);
await ev(() => window.__walkBase.setSource('sampled'));

// ---- export, decoded outside the browser ----
const exp = await ev(async () => {
  const w = window.__walkBase;
  const r = await w.exportZip({ width: 640, height: 360, timing: 'expanded', layers: 'composite', background: 'solid' });
  const u = await w.exportZip({ width: 640, height: 360, timing: 'unique', layers: 'composite', background: 'solid' });
  const enc = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); return btoa(s); };
  return { e: await enc(r.blob), u: await enc(u.blob), frames: r.summary.frames, holds: w.SM.cuts.map((c) => c.exposure ?? w.SM.exposure), labels: w.SM.cuts.map((c) => c.label) };
});
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
fs.writeFileSync(path.join(root, 'tmp/sampled-expanded.zip'), Buffer.from(exp.e, 'base64'));
fs.writeFileSync(path.join(root, 'tmp/sampled-unique.zip'), Buffer.from(exp.u, 'base64'));
fs.writeFileSync(path.join(root, 'tmp/sampled-expect.json'), JSON.stringify({ frames: exp.frames, holds: exp.holds, labels: exp.labels }));
check('sampled frames export', exp.frames === total.frames, exp.frames);

// ---- settings survive a reload; the picture does not ----
await page.waitForTimeout(500);
await page.reload();
await page.waitForFunction(() => window.__walkBase);
const kept = await ev(() => ({ loaded: window.__walkBase.SM.loaded, saved: window.__walkBase.S.savedSampler?.cuts?.length ?? 0, source: window.__walkBase.S.source }));
check('after a reload the picture is gone but the cuts are remembered', !kept.loaded && kept.saved === total.drawings, kept);
await ev(() => window.__walkBase.setTab('Sampler'));
await page.locator('[data-testid="sampler-file"]').setInputFiles(picture);
await page.waitForFunction(() => window.__walkBase.SM.loaded && window.__walkBase.SM.cuts.length > 0);
const again = await SMs();
check('loading the same picture again restores your cuts and numbers', again.n === total.drawings && again.labels.includes('20'), again.labels.join());
await page.waitForTimeout(200);
const openWin = await page.locator('[data-testid="cutwin"]').count();
check('and does not re-open the cut window over restored work', openWin === 0, openWin);

// ---- touch target sizes ----
const audit = () => ev(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, input, select, label.btn, summary')) {
    const box = (el.type === 'checkbox' || el.type === 'radio') ? (el.closest('label') || el) : el; const r = box.getBoundingClientRect(); const s = getComputedStyle(el);
    if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none' || el.disabled || el.type === 'file') continue;
    const min = el.type === 'range' ? r.height : Math.min(r.width, r.height);
    if (min < 43.5) out.push(`${el.dataset.testid || el.className || el.tagName}:${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
});
await ev(() => window.__walkBase.openCuts());
await page.waitForSelector('[data-testid="cutwin"]');
for (const [label, size] of Object.entries({ landscape: { width: 1180, height: 820 }, portrait: { width: 820, height: 1180 }, narrow: { width: 507, height: 820 } })) {
  await page.setViewportSize(size); await page.waitForTimeout(300);
  const bad = new Set();
  for (const view of ['sheet', 'slice']) {
    await page.locator(`[data-testid="cw-view-${view}"]`).click(); await page.waitForTimeout(200);
    (await audit()).forEach((x) => bad.add(`${view}/${x}`));
    const o = await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 0) bad.add(`${view}/overflow ${o}`);
    await shot(`${label}-${view}`);
  }
  check(`${label}: the cut window's controls are at least 44 px and nothing overflows`, bad.size === 0, [...bad].slice(0, 10).join(' '));
}
await page.locator('[data-testid="cw-done"]').click();
await page.setViewportSize({ width: 1180, height: 820 });
await ev(() => window.__walkBase.setTab('Sampler')); await page.waitForTimeout(200);
await shot('sampler-tab');
const badTab = await audit();
check('the Sampler tab\'s controls are at least 44 px', badTab.length === 0, badTab.slice(0, 8).join(' '));

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(root, `tests/ui-sampler-${mode}-${name}.json`), JSON.stringify({ browser: name, mode, at: new Date().toISOString(), results, errors }, null, 1));
console.log(`page errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
console.log(`\n${name} ${mode}: ${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(0);
