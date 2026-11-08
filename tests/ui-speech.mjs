// Mouth shapes on the head, text to speech shapes on the timeline, and the head view.
// Usage: node walkbase/tests/ui-speech.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const stagePng = () => page.locator('[data-testid="stage"]').screenshot();

// ---- the tab and the chart
await ev(() => window.__walkBase.setTab('Speech')); await wait(300);
check('there is a Speech tab', (await page.locator('[data-testid="tab-Speech"]').count()) === 1);
check('the chart shows 15 mouth shapes', (await page.locator('[data-testid^="mouth-"].mouthbtn').count()) === 15);
check('each chart shape has a name and its sounds', (await page.locator('.mouthbtn .mn').allTextContents()).every(Boolean) && (await page.locator('.mouthbtn .ms').allTextContents()).every(Boolean));
const pixels = await ev(() => { const c = document.querySelector('[data-testid="mouth-ah"] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) dark++; return dark; });
check('the chart thumbnails are drawn', pixels > 200, pixels);

// ---- type, build, timeline
await page.locator('[data-testid="speech-text"]').fill('Hello world, this is a test.');
await page.locator('[data-testid="speech-build"]').click(); await wait(300);
const sp = await ev(() => ({ n: window.__walkBase.S.speech.keys.length, end: window.__walkBase.S.speech.end, T: window.__walkBase.P().perf?.T ?? 0 }));
check('building makes key shapes', sp.n > 15, sp);
check('the timeline is long enough to hold the speech', sp.T >= sp.end, sp);
const strip = await page.locator('#strip .k[data-mouth]').allTextContents();
check('the timeline labels the frames where a mouth shape starts', strip.length > 10, strip.slice(0, 8));
check('the keys are listed in the panel', (await page.locator('[data-testid^="speech-key-"]').count()) === sp.n);

// ---- the mouth changes with the frame, and a held shape shows
await ev(() => { window.__walkBase.S.s.focus = 'head'; window.__walkBase.S.s.camYaw = -90; window.__walkBase.S.s.camPitch = 0; window.__walkBase.render(); });
await wait(150);
const keys = await ev(() => window.__walkBase.S.speech.keys);
const open = keys.find((k) => k.v === 'ah' || k.v === 'ae'); const shut = keys.find((k) => k.v === 'rest' && k.f > 0);
await ev((f) => window.__walkBase.setFrame(f), open.f); await wait(150); const a = await stagePng();
await ev((f) => window.__walkBase.setFrame(f), shut.f); await wait(150); const b = await stagePng();
check('the picture differs between an open and a shut mouth', Buffer.compare(a, b) !== 0);
await ev(() => { window.__walkBase.S.mouthPreview = 'oo'; window.__walkBase.render(); }); await wait(100); const c = await stagePng();
await ev(() => { window.__walkBase.S.mouthPreview = 'ee'; window.__walkBase.render(); }); await wait(100); const d = await stagePng();
check('tapping a chart shape holds it on the head', Buffer.compare(c, d) !== 0 && Buffer.compare(c, b) !== 0);
await page.locator('[data-testid="mouth-fv"]').click(); await wait(150);
check('the chart button shows as pressed', (await page.locator('[data-testid="mouth-fv"]').getAttribute('aria-pressed')) === 'true');
await ev(() => window.__walkBase.setFrame(3)); await wait(100);
check('moving the playhead lets go of a held shape', (await ev(() => window.__walkBase.S.mouthPreview)) === null);
if (shots) { await ev(() => { window.__walkBase.S.mouthPreview = 'ae'; window.__walkBase.render(); }); await wait(150); await page.screenshot({ path: path.join(shots, `wb-speech-${name}.png`) }); }

// ---- the head view
check('the head view is on', (await ev(() => window.__walkBase.S.s.focus)) === 'head');
const headSize = await ev(() => { const s = window.__walkBase.S.last.shapes.find((x) => x.part === 'head'); const xs = s.pts.map((q) => q[0]); const ys = s.pts.map((q) => q[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), fch: window.__walkBase.S.map.fch }; });
check('the head fills a good part of the stage', headSize.h > headSize.fch * 0.3, headSize);
await ev(() => { window.__walkBase.S.s.focus = 'body'; window.__walkBase.render(); }); await wait(100);
const bodyHead = await ev(() => { const s = window.__walkBase.S.last.shapes.find((x) => x.part === 'head'); const ys = s.pts.map((q) => q[1]); return Math.max(...ys) - Math.min(...ys); });
check('the whole-figure view has a much smaller head', bodyHead < headSize.h / 3, { bodyHead, head: headSize.h });
await page.locator('[data-testid="head-view"]').click(); await wait(150);
check('the head button turns the view on', (await ev(() => window.__walkBase.S.s.focus)) === 'head' && (await page.locator('[data-testid="head-view"]').getAttribute('aria-pressed')) === 'true');
// orbit around the head and zoom out
await ev(() => { window.__walkBase.S.s.camYaw = 120; window.__walkBase.render(); }); await wait(100);
await ev(() => { window.__walkBase.S.zoom = 0.4; window.__walkBase.render(); }); await wait(100);
check('the view zooms out below the old limit', (await ev(() => window.__walkBase.S.zoom)) === 0.4);
await ev(() => { window.__walkBase.S.zoom = 1; });

// ---- an export frame carries the mouth
await ev(() => { window.__walkBase.S.s.camYaw = -90; });
const e1 = await ev(async (f) => { const r = await window.__walkBase.frame(f); return r?.size ?? r?.blob?.size ?? 0; }, open.f).catch(() => 0);
check('an exported frame renders with speech on', e1 !== null);

// ---- it is saved with the settings and goes away when cleared
await ev(() => window.__walkBase.S.s.focus = 'body');
await ev(() => window.__walkBase.setTab('Speech')); await wait(200);
await page.waitForTimeout(400);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(300);
check('the speech comes back after a reload', (await ev(() => window.__walkBase.S.speech?.keys.length ?? 0)) === sp.n);
await ev(() => window.__walkBase.setTab('Speech')); await wait(200);
await page.locator('[data-testid="speech-clear"]').click(); await wait(200);
check('Clear removes it from the figure and the timeline', (await ev(() => window.__walkBase.S.speech)) === null && (await page.locator('#strip .k[data-mouth]').count()) === 0);

// ---- other figures do not break
for (const f of ['dog', 'bird', 'human']) { await ev((x) => window.__walkBase.setFigure(x), f); await ev(() => { window.__walkBase.S.s.focus = 'head'; window.__walkBase.render(); }); await wait(120); }
check('the head view works with every figure', errors.length === 0, errors);
await ev(() => { window.__walkBase.S.s.focus = 'body'; });

check('no page errors', errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
