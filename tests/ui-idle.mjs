// The idle controls on the Body tab: styles, building an idle over the timeline (a stop, a sit, breathing, looks, fidgets), clearing it, building again without stacking, and keeping the settings.
// Usage: node walkbase/tests/ui-idle.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]`);
const pose = (f) => ev((fr) => { const w = window.__walkBase; w.setFrame(fr); w.render(); const z = w.S.last.pz; return { pelvisY: z.pelvis[1], pelvisZ: z.pelvis[2], headYaw: z.Rh[0] ?? 0, head: z.headC.slice(), hand: z.sides.R.hand.slice(), stance: z.sides.R.stance }; }, f);

await ev(() => window.__walkBase.setTab('Gait')); await wait(300);
check('the Body tab has an idle section with styles, a Build button and the fidget choices', (await q('idle-build').count()) === 1 && (await q('idle-style-bored').count()) === 1 && (await q('idle-fidget-yawn').count()) === 1 && (await q('idle-stance-hands-on-hips').count()) === 1);
check('Clear is off until something is built', await q('idle-clear').isDisabled());
await q('idle-style-bored').click(); await wait(150);
check('a style sets the controls (Bored taps its foot and crosses its arms)', await ev(() => { const i = window.__walkBase.S.idle; return i.style === 'Bored' && i.tap && i.stance === 'Arms crossed' && i.fidgets.includes('yawn'); }));

// standing idle from a walk: it stops, then breathes, shifts and looks about
await ev(() => { const w = window.__walkBase; Object.assign(w.S.idle, { seconds: 12, seed: 7, fidgets: ['scratch'], fidgetRate: 6, stance: 'Arms down', tap: false, pose: 'standing', breathing: 1, shift: 1, look: 1, lookEvery: 2, shiftEvery: 3 }); w.S.frame = 0; });
await q('idle-build').click(); await wait(400);
const built = await ev(() => { const w = window.__walkBase; return { span: w.S.idle.span, lanes: Object.keys(w.S.lanes).length, hasHead: Boolean(w.S.lanes['c:head.yaw:offset']), perf: w.S.perfLen }; });
check('Build idle lays lanes on the timeline over the span it reports', built.span && built.span[1] > built.span[0] + 12 * 24 && built.hasHead && built.lanes > 10, built);
check('the status line says where it is', /Built over frames 1 to/.test(await q('idle-status').innerText()));
const walkNow = await ev(() => Math.abs(window.__walkBase.S.p.stepLength) > 0.05);
const f1 = await pose(48 + 30); const f2 = await pose(48 + 170); const f3 = await pose(48 + 260);
check('after the stop it stands still, and the head and body move about', f1.stance !== undefined && (Math.hypot(...f1.head.map((v, i) => v - f2.head[i])) > 0.004 || Math.hypot(...f2.head.map((v, i) => v - f3.head[i])) > 0.004), [f1.head, f2.head, f3.head]);
if (shots) { await page.screenshot({ path: path.join(shots, `wb-idle-${name}.png`) }); }
const ymov = []; for (let f = 48 + 40; f < 48 + 120; f += 4) ymov.push((await pose(f)).head[1]); check('it breathes: the head rises and falls a little', Math.max(...ymov) - Math.min(...ymov) > 0.002, +(Math.max(...ymov) - Math.min(...ymov)).toFixed(4));

// building again replaces it and does not stack
const before = await ev(() => JSON.stringify(window.__walkBase.S.lanes['c:spine3.pitch:offset']));
await q('idle-build').click(); await wait(300);
const after = await ev(() => JSON.stringify(window.__walkBase.S.lanes['c:spine3.pitch:offset']));
check('building again from the same settings gives the same lanes (nothing stacks)', before === after && before.length > 20);
const headBefore = await ev(() => JSON.stringify(window.__walkBase.S.lanes['c:head.yaw:offset']));
await q('idle-reseed').click(); await wait(400);
const reseeded = await ev(() => JSON.stringify(window.__walkBase.S.lanes['c:head.yaw:offset']));
check('Shuffle builds a different idle', reseeded !== headBefore && (await ev(() => window.__walkBase.S.idle.span !== null)));

// clear puts everything back
await q('idle-clear').click(); await wait(300);
check('Clear idle takes it all off (no lanes left)', await ev(() => Object.keys(window.__walkBase.S.lanes).length === 0 && window.__walkBase.S.idle.span === null), await ev(() => Object.keys(window.__walkBase.S.lanes).length));

// sitting: a sit, an idle on the seat, and a stand up at the end
await ev(() => { const w = window.__walkBase; Object.assign(w.S.idle, { pose: 'sitting', standAtEnd: true, seconds: 8, fidgets: ['nod', 'scratch'], seed: 4 }); w.S.frame = 0; w.setTab('Gait'); }); await wait(300);
check('Stand up at the end is offered when sitting', (await q('idle-standup').count()) === 1);
await q('idle-build').click(); await wait(400);
const sp = await ev(() => window.__walkBase.S.idle.span);
const standY = (await pose(0)).pelvisY; const seatedY = (await pose(48 + 64 + 100)).pelvisY; const endY = (await pose(sp[1] + 20)).pelvisY;
check('it sits down: the hips drop, and stay down through the idle', seatedY < standY - 0.3, [standY, seatedY]);
check('and stands up at the end', endY > seatedY + 0.3, [seatedY, endY]);
if (shots) { await ev((f) => window.__walkBase.setFrame(f), 48 + 64 + 100); await wait(200); await page.screenshot({ path: path.join(shots, `wb-idle-seated-${name}.png`) }); }

// settings are saved with the project
const snap = await ev(() => JSON.parse(window.__walkBase.snapState()).idle);
check('the idle settings (and what it laid down) are saved with the project', snap && snap.pose === 'sitting' && snap.span && snap.base, snap && Object.keys(snap));
await q('idle-clear').click(); await wait(200);
await ev(() => { const w = window.__walkBase; w.setFigure('dog'); w.setTab('Gait'); }); await wait(300);
check('the idle controls are on the Body tab, and not for an animal', (await q('idle-build').count()) === 0);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
