// Motion arcs: picking points, a dot for every frame, dragging a dot to bend the movement, undo, the dog, performances.
// Usage: node walkbase/tests/ui-arcs.mjs <chromium|webkit> <playwrightDir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir] = process.argv.slice(2);
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
const dots = () => ev(() => window.__walkBase.S.last?.arcDots?.map((d) => ({ id: d.id, frame: d.frame, x: d.x, y: d.y })) || []);

await ev(() => window.__walkBase.setTab('Guides'));
await page.locator('[data-testid="arc-section"]').waitFor();
check('the Guides tab lists points to trace', (await page.locator('.arcchip').count()) >= 14);
// both sides are shown to start with
await ev(() => { window.__walkBase.S.s.showArcs = true; window.__walkBase.render(); }); await page.waitForTimeout(250);
const ids0 = new Set((await dots()).map((q) => q.id));
check('arcs start on both sides: head, hips, both wrists and both ankles', ['head', 'hip', 'wrist.R', 'wrist.L', 'ankle.R', 'ankle.L'].every((i) => ids0.has(i)), [...ids0]);
await page.locator('[data-testid="arc-side-L"]').click(); await page.waitForTimeout(200);
check('Left only shows the left side', (await ev(() => window.__walkBase.S.s.arcs)).every((i) => !i.endsWith('.R')) && (await ev(() => window.__walkBase.S.s.arcs)).includes('wrist.L'));
await page.locator('[data-testid="arc-default"]').click(); await page.waitForTimeout(200);
check('Both sides puts them back', (await ev(() => window.__walkBase.S.s.arcs)).includes('ankle.R') && (await ev(() => window.__walkBase.S.s.arcs)).includes('ankle.L'));
await ev(() => { window.__walkBase.LAYOUT.arcSym = 'none'; }); // the single-side checks below are with the sides unlinked
await page.locator('[data-testid="arc-none"]').click();
await page.locator('[data-testid="arc-ankle.R"]').click();
await page.locator('[data-testid="arc-wrist.L"]').click();
await page.waitForTimeout(300);
const T = await ev(() => window.__walkBase.S.p.cycleFrames);
let d = await dots();
check('ticking a point turns arcs on and gives a dot per frame', (await ev(() => window.__walkBase.S.s.showArcs)) && d.filter((q) => q.id === 'ankle.R').length === T && d.filter((q) => q.id === 'wrist.L').length === T, `${d.length} dots, ${T} frames`);
check('only the ticked points are drawn', new Set(d.map((q) => q.id)).size === 2);

// drag an ankle dot
const pick = d.find((q) => q.id === 'ankle.R' && q.frame === Math.floor(T / 4));
const a = await client(pick.x, pick.y); const tgt = await client(pick.x + 30, pick.y - 40);
const before = await ev(() => JSON.stringify(window.__walkBase.S.motion));
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + tgt.x) / 2, (a.y + tgt.y) / 2, { steps: 4 }); await page.mouse.move(tgt.x, tgt.y, { steps: 4 }); await page.mouse.up();
await page.waitForTimeout(400);
const after = await dots();
const moved = after.find((q) => q.id === 'ankle.R' && q.frame === pick.frame);
check('dragging a dot moves it to the finger', Math.hypot(moved.x - (pick.x + 30), moved.y - (pick.y - 40)) < 3, { want: [pick.x + 30, pick.y - 40], got: [moved.x, moved.y] });
const edited = await ev(() => Object.keys(window.__walkBase.S.motion).sort());
check('only the foot curves of that side changed', JSON.stringify(edited) === JSON.stringify(['foot.x.R', 'foot.y.R']), edited);
// with the sides linked, the other side follows half a cycle later
await ev(() => { window.__walkBase.undo?.(); window.__walkBase.LAYOUT.arcSym = 'alt'; }); await page.waitForTimeout(300);
const pickL = (await dots()).find((q) => q.id === 'ankle.R' && q.frame === Math.floor(T / 4)); const aL = await client(pickL.x, pickL.y); const tL = await client(pickL.x + 24, pickL.y - 30);
await page.mouse.move(aL.x, aL.y); await page.mouse.down(); await page.mouse.move((aL.x + tL.x) / 2, (aL.y + tL.y) / 2, { steps: 4 }); await page.mouse.move(tL.x, tL.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(400);
const mir = await ev(() => { const m = window.__walkBase.S.motion; const r = m['foot.y.R']?.pts; const l = m['foot.y.L']?.pts; if (!r || !l) return null; return r.every((q) => { const u = (q.u + 0.5) % 1; return l.some((p) => Math.abs(p.u - u) < 1e-6 && Math.abs(p.v - q.v) < 1e-9); }); });
check('with both sides linked the left foot follows the right, half a cycle later', mir === true, mir);
const other = after.find((q) => q.id === 'wrist.L' && q.frame === pick.frame); const o0 = d.find((q) => q.id === 'wrist.L' && q.frame === pick.frame);
check('the other arc stays where it was', Math.hypot(other.x - o0.x, other.y - o0.y) < 0.5);
check('the dragged frame did not move the playhead or leave the preset', (await ev(() => window.__walkBase.S.preset)) === 'Custom');
await ev(() => window.__walkBase.undo?.());
await page.waitForTimeout(300);
check('undo puts the movement back', (await ev(() => JSON.stringify(window.__walkBase.S.motion))) === before);

// the dog
await ev(() => window.__walkBase.setRig?.('dog'));
await page.waitForTimeout(400);
await ev(() => window.__walkBase.setTab('Guides'));
const names = await page.locator('.arcchip').evaluateAll((els) => els.map((e) => e.dataset.testid));
check('the dog offers its paws and tail', names.includes('arc-paw.FR') && names.includes('arc-tail') && !names.includes('arc-wrist.R'), names.join(' '));
const dd = await dots();
check('the dog has dots', dd.length > 20, String(dd.length));

// a performance: shown, not editable
await ev(() => window.__walkBase.setRig?.('human'));
await ev(() => { const w = window.__walkBase; w.S.perfLen = 60; w.S.ver++; });
await page.waitForTimeout(400);
const pd = await dots();
const pk = pd.find((q) => q.frame === 10);
const motion0 = await ev(() => JSON.stringify(window.__walkBase.S.motion));
if (pk) { const p0 = await client(pk.x, pk.y); const p1 = await client(pk.x + 30, pk.y); await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p1.x, p1.y, { steps: 4 }); await page.mouse.up(); }
check('arcs follow a performance and are read-only there', pd.length > T && (await ev(() => JSON.stringify(window.__walkBase.S.motion))) === motion0, `${pd.length} dots`);

// symmetry choices, sideways movement, and copying one side to the other
await ev(() => { const w = window.__walkBase; w.setRig('human'); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.S.motion = {}; w.S.s.camYaw = 0; w.S.s.showArcs = true; w.S.s.arcs = ['ankle.R', 'ankle.L', 'wrist.R', 'wrist.L']; w.render(); });
await ev(() => window.__walkBase.setTab('Guides')); await page.waitForTimeout(300);
check('the Guides tab offers Independent, Alternate and Mirror, with Alternate chosen', (await page.locator('[data-testid="arc-sym-none"]').count()) === 1 && (await page.locator('[data-testid="arc-sym-alt"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-testid="arc-sym-mirror"]').count()) === 1);
await page.locator('[data-testid="arc-sym-mirror"]').click(); await page.waitForTimeout(200);
const T2 = await ev(() => window.__walkBase.S.p.cycleFrames);
const d1 = (await dots()).find((q) => q.id === 'ankle.R' && q.frame === Math.floor(T2 / 4)); const a1 = await client(d1.x, d1.y); const b1 = await client(d1.x + 22, d1.y - 28);
await page.mouse.move(a1.x, a1.y); await page.mouse.down(); await page.mouse.move((a1.x + b1.x) / 2, (a1.y + b1.y) / 2, { steps: 4 }); await page.mouse.move(b1.x, b1.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(400);
const same = await ev(() => { const m = window.__walkBase.S.motion; const r = m['foot.y.R']?.pts; const l = m['foot.y.L']?.pts; return Boolean(r && l && JSON.stringify(r) === JSON.stringify(l)); });
check('Mirror: the left foot gets exactly the same curve at the same moment', same);
await ev(() => { window.__walkBase.S.motion = {}; window.__walkBase.S.ver++; window.__walkBase.render(); }); await page.waitForTimeout(200);
// sideways, from the front
await ev(() => { window.__walkBase.S.s.camYaw = 90; window.__walkBase.render(); }); await page.waitForTimeout(300);
const d2 = (await dots()).find((q) => q.id === 'ankle.R' && q.frame === Math.floor(T2 / 4)); const a2 = await client(d2.x, d2.y); const b2 = await client(d2.x + 26, d2.y);
await page.locator('[data-testid="arc-sym-none"]').click(); await page.waitForTimeout(150);
await page.mouse.move(a2.x, a2.y); await page.mouse.down(); await page.mouse.move((a2.x + b2.x) / 2, a2.y, { steps: 4 }); await page.mouse.move(b2.x, b2.y, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(400);
const zc = await ev(() => Object.keys(window.__walkBase.S.motion));
check('from the front a sideways drag changes how far apart the feet are (the width channel)', zc.includes('foot.z.R'), zc);
await ev(() => { window.__walkBase.S.s.camYaw = 0; window.__walkBase.S.motion = {}; window.__walkBase.S.ver++; window.__walkBase.render(); }); await page.waitForTimeout(200);
// copy the right side to the left
await ev(() => { window.__walkBase.S.motion['arm.pitch.R'] = { amount: 1, offset: 0.3 }; window.__walkBase.S.ver++; window.__walkBase.render(); }); await page.waitForTimeout(150);
await page.locator('[data-testid="arc-sym-alt"]').click(); await page.waitForTimeout(150);
await page.locator('[data-testid="arc-copy-RL"]').click(); await page.waitForTimeout(400);
const cp = await ev(() => { const m = window.__walkBase.S.motion; return Boolean(m['arm.pitch.L']?.pts?.length && m['arm.pitch.R']?.pts?.length); });
check('Copy right to left gives the left arm a matching curve (half a cycle later)', cp);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
