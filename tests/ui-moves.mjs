// The movement library (grouped, chained, eased) and corrections (fix a part at a frame without changing the animation underneath).
// Usage: node walkbase/tests/ui-moves.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const client = (fx, fy) => ev(([x, y]) => { const m = window.__walkBase.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (x / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (y / m.fch) * m.zh) / m.d }; }, [fx, fy]);
const lanes = () => ev(() => Object.fromEntries(Object.entries(window.__walkBase.S.lanes).map(([k, v]) => [k, v.pts.length])));
const wait = (ms) => page.waitForTimeout(ms);

// ---- the movement list
await ev(() => window.__walkBase.setTab('Auto')); await wait(300);
const heads = await page.locator('.cliprow h4').allTextContents();
check('human movements are in groups', ['Pace', 'Posture', 'Action', 'Gesture'].every((g) => heads.includes(g)), heads);
const chips = await page.locator('[data-testid^="clip-"].pchip').count();
check('the human has well over a dozen movements', chips >= 18, chips);
for (const id of ['sit', 'standup', 'crouch', 'jump', 'wave', 'run', 'begin']) check(`human: ${id} is offered`, (await page.locator(`.pchip[data-testid="clip-${id}"]`).count()) === 1);

// ---- chain: stop, sit, stand up, start
await ev(() => { const w = window.__walkBase; const c = (id) => w.clipsFor('human').find((x) => x.id === id); const seq = [['stop', 0], ['sit', 30], ['standup', 110], ['begin', 175]]; for (const [id, at] of seq) w.addClip(c(id), at, c(id).frames, 1); });
await wait(400);
const L = await lanes();
check('chained movements write ordinary lanes', Object.keys(L).length > 20 && 'c:pelvis.y:offset' in L && 'cadence' in L, Object.keys(L).length);
const hips = []; for (const f of [28, 100, 106, 175, 240]) { await ev((k) => window.__walkBase.setFrame(k), f); await wait(120); hips.push(await ev(() => window.__walkBase.S.last.pz.pelvis[1])); }
check('standing, sitting, held, standing again', hips[1] < hips[0] - 0.3 && Math.abs(hips[1] - hips[2]) < 1e-6 && Math.abs(hips[3] - hips[0]) < 0.05 && Math.abs(hips[4] - hips[0]) < 0.12, hips.map((v) => +v.toFixed(2)));
if (shots) { await ev(() => window.__walkBase.setFrame(100)); await wait(150); await page.screenshot({ path: path.join(shots, `wb-moves-sit-${name}.png`) }); }

// ---- the dog
await ev(() => { window.__walkBase.S.lanes = {}; window.__walkBase.S.perfLen = 0; window.__walkBase.S.ver++; window.__walkBase.setFigure('dog'); }); await wait(300);
await ev(() => window.__walkBase.setTab('Auto')); await wait(300);
const dchips = await page.locator('[data-testid^="clip-"].pchip').count();
check('the dog has its own movements', dchips >= 18 && (await page.locator('[data-testid="clip-tailchase"]').count()) === 1 && (await page.locator('[data-testid="clip-sit"]').count()) === 1, dchips);
await ev(() => { const w = window.__walkBase; const c = (id) => w.clipsFor('dog').find((x) => x.id === id); for (const [id, at] of [['stop', 0], ['sit', 30], ['beg', 90], ['standup', 160]]) w.addClip(c(id), at, c(id).frames, 1); });
await wait(300);
const dh = []; for (const f of [20, 80, 140, 215]) { await ev((k) => window.__walkBase.setFrame(k), f); await wait(120); dh.push(await ev(() => window.__walkBase.S.last.pz.pelvis[1])); }
check('the dog stands, sits, begs and stands again', dh[1] < dh[0] - 0.3 && dh[2] < dh[0] - 0.3 && Math.abs(dh[3] - dh[0]) < 0.05, dh.map((v) => +v.toFixed(2)));
if (shots) { await ev(() => window.__walkBase.setFrame(120)); await wait(150); await page.screenshot({ path: path.join(shots, `wb-moves-beg-${name}.png`) }); }

// ---- corrections
await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setFigure('human'); }); await wait(300);
await ev(() => { window.__walkBase.S.s.showArcs = false; window.__walkBase.setTab('Parts'); }); await wait(300);
await page.locator('[data-testid="part-neck"]').click(); await wait(300);
check('the Parts tab offers Fix alignment for the selected part', (await page.locator('[data-testid="fix-section"]').count()) === 1 && (await page.locator('[data-testid="fix-count"]').innerText()).includes('No corrections'));
await ev(() => window.__walkBase.setFrame(8)); await page.locator('[data-testid="fix-on"]').check(); await wait(300);
const h0 = await ev(() => { const h = window.__walkBase.S.last.fixHandle; return h ? { x: h.x, y: h.y } : null; });
check('a handle appears at the end of the neck', Boolean(h0), h0);
const before = await ev(() => JSON.stringify(window.__walkBase.S.motion) + JSON.stringify(window.__walkBase.S.p));
const hip0 = await ev(() => window.__walkBase.S.last.pz.pelvis.join());
const a = await client(h0.x, h0.y); const b = await client(h0.x + 30, h0.y + 4);
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 3 }); await page.mouse.up(); await wait(400);
const h1 = await ev(() => { const h = window.__walkBase.S.last.fixHandle; return h ? { x: h.x, y: h.y } : null; });
const L2 = await lanes();
check('dragging the handle writes correction lanes for the neck only', Object.keys(L2).length >= 1 && Object.keys(L2).every((k) => k.endsWith(':fix') && /neck|head/.test(k)), L2);
check('the handle follows to where it was dropped', h1 && Math.hypot(h1.x - h0.x, h1.y - h0.y) > 5, { h0, h1 });
check('the movement itself and the gait settings are untouched', (await ev(() => JSON.stringify(window.__walkBase.S.motion) + JSON.stringify(window.__walkBase.S.p))) === before);
check('the hips did not move', (await ev(() => window.__walkBase.S.last.pz.pelvis.join())) === hip0);
check('the panel counts the corrections', /correction point/.test(await page.locator('[data-testid="fix-count"]').innerText()));
// far from the frame the neck is as it was
await ev(() => window.__walkBase.setFrame(20)); await wait(120);
const far = await ev(() => window.__walkBase.S.last.pz.neckTop.join());
await ev(() => { const w = window.__walkBase; w.S.lanes = Object.fromEntries(Object.entries(w.S.lanes).filter(([k]) => !k.endsWith(':fix'))); w.S.ver++; w.render(); }); await wait(150);
const farAfter = await ev(() => window.__walkBase.S.last.pz.neckTop.join());
check('beyond the spread the animation is exactly what it was', Math.hypot(...far.split(',').map((v, i) => Number(v) - Number(farAfter.split(',')[i]))) < 1e-9, { far, farAfter, lanes: await lanes() });
// clear and undo
await ev(() => window.__walkBase.undo()); await wait(300);
await page.locator('[data-testid="part-neck"]').click().catch(() => {}); await wait(200);
await ev(() => window.__walkBase.setFrame(8)); await page.locator('[data-testid="fix-on"]').check().catch(() => {});
const h2 = await ev(() => { const h = window.__walkBase.S.last.fixHandle; return h ? { x: h.x, y: h.y } : null; });
if (h2) { const a2 = await client(h2.x, h2.y); const b2 = await client(h2.x + 25, h2.y + 3); await page.mouse.move(a2.x, a2.y); await page.mouse.down(); await page.mouse.move(b2.x, b2.y, { steps: 5 }); await page.mouse.up(); await wait(400); }
if (shots) { await page.screenshot({ path: path.join(shots, `wb-fix-${name}.png`) }); }
await page.locator('[data-testid="fix-clear"]').click(); await wait(300);
check('Clear corrections removes them all', Object.keys(await lanes()).filter((k) => k.endsWith(':fix')).length === 0 && /No corrections/.test(await page.locator('[data-testid="fix-count"]').innerText()));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
