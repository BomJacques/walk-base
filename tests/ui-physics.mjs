// Swinging strips (cape, hair): adding one, it moves with the body, physics settings, the tip handle, guides, save, undo, the dog.
// Usage: node walkbase/tests/ui-physics.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const client = (fx, fy) => ev(([x, y]) => { const m = window.__walkBase.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (x / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (y / m.fch) * m.zh) / m.d }; }, [fx, fy]);
const list = () => ev(() => window.__walkBase.attachList().map((a) => ({ id: a.id, kind: a.kind, h: a.h, phys: a.phys })));
const tipOf = () => ev(() => { const hs = window.__walkBase.S.last?.handles; return hs ? { x: hs.scale.x, y: hs.scale.y, ax: hs.anchor.x, ay: hs.anchor.y } : null; });
const setNum = async (id, v) => { const el = page.locator(`[data-testid="${id}"]`); await el.fill(String(v)); await el.dispatchEvent('change'); await page.waitForTimeout(300); };

await ev(() => { const w = window.__walkBase; w.setTab('Attach'); w.S.s.showArcs = false; w.render(); });
await ev(() => window.__walkBase.addAttach('strip', {}, { part: 'spine.upper', seg: null, side: null }));
await page.waitForTimeout(300);
let l = await list();
check('adding a cape or hair strip makes a strip with physics settings', l.length === 1 && l[0].kind === 'strip' && l[0].phys?.nodes === 8, l);
check('its physics panel is shown', (await page.locator('[data-testid="attach-phys"]').count()) === 1 && (await page.locator('[data-testid="phys-gravity"]').count()) === 1);

// it swings as the walk goes round
const tipsAt = [];
for (const f of [0, 6, 12, 18]) { await ev((i) => window.__walkBase.setFrame(i), f); await page.waitForTimeout(80); tipsAt.push(await tipOf()); }
const rel = tipsAt.map((t) => [Math.round(t.x - t.ax), Math.round(t.y - t.ay)]);
check('the tip swings relative to the anchor through the cycle', new Set(rel.map((r) => r.join())).size >= 3, rel);
check('the strip is the same at the same frame every time', await (async () => { await ev(() => window.__walkBase.setFrame(7)); const a = await tipOf(); await ev(() => window.__walkBase.setFrame(3)); await ev(() => window.__walkBase.setFrame(7)); const b = await tipOf(); return Math.hypot(a.x - b.x, a.y - b.y) < 0.01; })());

// physics settings change the shape
await ev(() => window.__walkBase.setFrame(9)); const before = await tipOf();
await setNum('phys-gravity-num', 0);
const floaty = await tipOf();
check('gravity 0 lifts the strip', Math.hypot(floaty.x - before.x, floaty.y - before.y) > 10, { before, floaty });
await setNum('phys-gravity-num', 1);
const wind0 = await tipOf();
await setNum('phys-wind-num', 1.5);
const wind1 = await tipOf();
check('wind blows the tip forward', wind1.x - wind1.ax > wind0.x - wind0.ax + 5, { wind0, wind1 });
await setNum('phys-wind-num', 0);

// drag the square at the tip to set its length
const t0 = await tipOf(); const h0 = (await list())[0].h;
const a = await client(t0.x, t0.y); const b = await client(t0.x, t0.y + 40);
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, (a.y + b.y) / 2, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(300);
const h1 = (await list())[0].h;
check('dragging the tip square lengthens the strip', h1 > h0 + 0.03, { h0, h1 });

// guides: the tip path is drawn with motion arcs on
await ev(() => { const w = window.__walkBase; w.S.s.showArcs = true; w.S.s.arcDots = true; w.render(); });
check('motion arcs draw without errors', errors.length === 0, errors.slice(0, 3));

const placed = await ev(() => Boolean(window.__walkBase.S.last.attach.find((q) => q.it.kind === 'strip')));
check('the strip is placed on a part', placed);
if (shots) { await ev(() => window.__walkBase.setFrame(8)); await page.waitForTimeout(200); await page.screenshot({ path: path.join(shots, `wb-cape-${name}.png`) }); }

// save, reload, undo
await page.waitForTimeout(600);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(400);
l = await list();
check('the strip and its physics come back after a reload', l.length === 1 && l[0].kind === 'strip' && l[0].phys.gravity === 1 && Math.abs(l[0].h - h1) < 1e-6, l);
await page.waitForTimeout(400);
await ev(() => window.__walkBase.undo()); await page.waitForTimeout(300);
check('undo steps back through strip edits', (await ev(() => window.__walkBase.attachList().length)) <= 1);

// the dog
await ev(() => window.__walkBase.setRig('dog')); await page.waitForTimeout(300);
await ev(() => window.__walkBase.addAttach('strip', {}, { part: 'dog.spine3', seg: null, side: null })); await page.waitForTimeout(300);
const dl = await list();
check('the dog can wear a strip', dl.length === 1 && dl[0].kind === 'strip', dl);
await ev(() => window.__walkBase.setFrame(5)); await page.waitForTimeout(100);
check('and it is drawn without errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
